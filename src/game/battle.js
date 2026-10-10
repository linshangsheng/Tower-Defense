// 战斗逻辑（与画面完全分离，可在 Node 中无头运行，设计书 2 章、9 章、13.2）
(function (TD) {
  'use strict';

  const C = TD.config;
  const D = TD.data;

  let nextId = 1;

  class Battle extends TD.Emitter {
    // opts: { level, stats, loadout: {active, items, target, autoCast}, seed, autoItems }
    constructor(opts) {
      super();
      // opts.levelDef：自定义关卡（无尽模式、每日挑战）；stage：用于补给卡池、场景的"等效关卡号"
      this.levelNo = opts.level;
      this.level = opts.levelDef || D.levels[opts.level];
      this.stage = opts.stage || (typeof opts.level === 'number' ? opts.level : 1);
      this.D = C.difficulty(this.stage);
      this.rules = this.level.rules || {};
      this.stats = opts.stats;
      this.rng = TD.util.rng(opts.seed || Date.now());
      this.lanes = this.level.lanes;
      this.time = 0;
      this.over = false;
      this.result = null;

      const wallMult = (1 + (this.rules.wallHp || 0)) * (this.rules.wallHalf ? 0.5 : 1);
      this.wall = { hp: Math.round(this.stats.wallMax * wallMult), max: Math.round(this.stats.wallMax * wallMult) };
      this.monsters = [];
      this.projectiles = [];
      this.laneEffects = []; // {lane, type:'frost'|'freeze', until}
      this.buffs = []; // {aspd, until, src}
      this.target = opts.loadout.target || 'nearest';
      this.autoCast = !!opts.loadout.autoCast;
      this.autoItems = !!opts.autoItems;

      const lvs = opts.loadout.activeLv || {};
      this.skills = (opts.loadout.active || []).map((id) => {
        const base = D.activeSkills[id];
        const lv = lvs[id] || 1;
        const def = Object.assign({}, base, (base.tiers || [])[lv - 1] || {}, { lv });
        return { id, lv, def, cd: 0 };
      });
      this.tempDr = { amt: 0, until: 0 };
      this.items = (opts.loadout.items || []).filter((id) => !D.items[id].passive).map((id) => ({ id, def: D.items[id], used: false }));
      this.charm = (opts.loadout.items || []).includes('charm');
      this.itemsUsed = [];
      if (this.charm) this.itemsUsed.push('charm');

      this.hero = { cooldown: 0.6, attacks: 0, aimX: C.width / 2, aimY: C.height / 2, shotAt: -1 };
      this.heroY = (C.fieldTop + C.fieldBottom) / 2;

      // 波次
      this.waveIndex = -1;
      this.waveState = 'prepare'; // prepare | spawning | waiting | final
      this.countdown = 3;
      this.spawnQueue = [];
      this.spawnTimer = 0;
      this.waveStartTime = 0;

      // 战场补给（设计书 2.7）
      this.mods = { atkMult: 0, aspdMult: 0, crit: 0, critDmg: 0, cdMult: 0, copperBonus: 0, wallDr: 0, range: 0, slowOnHit: 0, magicMult: 0, armorIgnore: 0, dotReduce: 0, spiritPierce: 0, chillResist: 0, igniteOnHit: 0, fireproof: 0, reveal: 0 };
      this.zones = []; // 地面区域：{ x, y, r, until, haste }
      this.heroStunUntil = 0;
      this.chillStacks = 0;
      this.wallSealedUntil = 0;
      this.pack = null;
      this.wallDots = []; // 城墙持续伤害：{ dps, until, src }
      this.dotTick = 0.5;
      this.supplyWaves = this.computeSupplyWaves();
      this.supplyOffered = {};
      this.supplyPicked = [];
      this.pendingSupply = null;
      this.autoSupply = !!opts.autoSupply;
      this.castCount = 0;

      this.killsByType = {};
      this.interrupts = 0;
      this.earlyCalls = 0;
      this.on('bossInterrupt', () => this.interrupts++);

      this.killCopper = 0;
      this.earlyCopper = 0;
      this.kills = 0;
      this.damageDealt = 0;
      this.wallDamageTaken = 0;
    }

    // 补给出现在哪几波之后（波序号从 0 开始）
    computeSupplyWaves() {
      const n = this.level.waves.length;
      if (this.level.supplyEvery) {
        const out = [];
        for (let i = this.level.supplyEvery - 1; i < n - 1; i += this.level.supplyEvery) out.push(i);
        return out;
      }
      if (this.level.noSupply || n < 3) return [];
      if (this.level.type === 'boss' || n < 5) return [1];
      return [1, n - 2];
    }

    get atk() {
      return this.stats.atk * (1 + this.mods.atkMult);
    }

    get range() {
      return this.stats.range * (1 + this.mods.range) * (this.level.dark ? 0.7 : 1);
    }

    offerSupply() {
      const all = Object.keys(D.supplies).filter((id) => {
        if (this.supplyPicked.includes(id)) return false;
        if (D.supplies[id].needSkills && !this.skills.length) return false;
        if (D.supplies[id].minLevel && this.stage < D.supplies[id].minLevel) return false;
        return true;
      });
      const choices = [];
      while (choices.length < 3 && all.length) choices.push(all.splice(this.rng.int(all.length), 1)[0]);
      this.supplyOffered[this.waveIndex] = true;
      this.pendingSupply = choices;
      this.emit('supply', { choices });
      if (this.autoSupply) this.chooseSupply(this.botSupplyChoice(choices));
    }

    botSupplyChoice(choices) {
      if (this.wall.hp / this.wall.max < 0.6 && choices.includes('bricks')) return 'bricks';
      for (const id of D.supplyBotOrder) if (choices.includes(id)) return id;
      return choices[0];
    }

    chooseSupply(id) {
      if (!this.pendingSupply || !this.pendingSupply.includes(id)) return false;
      const sup = D.supplies[id];
      for (const k of Object.keys(sup.mods)) this.mods[k] += sup.mods[k];
      if (sup.heal) this.healWall(this.wall.max * sup.heal, 'supply');
      if (sup.refresh) for (const sk of this.skills) sk.cd = 0;
      this.supplyPicked.push(id);
      this.pendingSupply = null;
      this.emit('supplyPicked', { id });
      this.endWaveHeal();
      this.startWave(this.waveIndex + 1);
      return true;
    }

    laneY(lane) {
      const h = (C.fieldBottom - C.fieldTop) / this.lanes;
      return C.fieldTop + h * (lane + 0.5);
    }

    get totalWaves() {
      return this.level.waves.length;
    }

    // ---------- 波次 ----------
    startWave(i) {
      this.waveIndex = i;
      const wave = this.level.waves[i];
      if (wave.D) this.D = wave.D; // 无尽模式：每波有自己的难度
      // countMult：自动平衡工具（tools/tune.js）写入的每关数量倍率，Boss 不受影响
      const cm = (this.level.countMult || 1) * (1 + (this.rules.countBonus || 0));
      const groups = wave.groups.map(([type, count]) => ({ type, left: D.monsters[type].boss ? count : Math.max(1, Math.round(count * cm)) }));
      const queue = [];
      let any = true;
      while (any) {
        any = false;
        for (const g of groups) {
          if (g.left > 0) {
            queue.push(g.type);
            g.left--;
            any = true;
          }
        }
      }
      this.spawnQueue = queue;
      // 数量倍率提高时出怪更密集，避免关卡时间被拉长
      this.spawnGap = cm > 1 ? wave.gap / Math.pow(cm, 0.75) : wave.gap;
      this.spawnTimer = 0;
      this.waveState = 'spawning';
      this.waveStartTime = this.time;
      this.clearedOnce = false;
      this.emit('waveStart', { index: i, total: this.totalWaves, chapter: wave.chapter });
    }

    endWaveHeal() {
      if (this.stats.mend > 0 && this.waveIndex >= 0) this.healWall(this.wall.max * this.stats.mend, 'mend');
    }

    callNextWave() {
      if (this.waveState !== 'waiting' || this.waveIndex >= this.totalWaves - 1) return -1;
      const bonus = Math.floor(this.countdown) * C.earlyCallCopperPerSec;
      this.earlyCopper += bonus;
      this.earlyCalls++;
      this.countdown = 0;
      this.emit('earlyCall', { bonus });
      return bonus;
    }

    updateWaves(dt) {
      if (this.waveState === 'prepare') {
        this.countdown -= dt;
        if (this.countdown <= 0) this.startWave(0);
        return;
      }
      if (this.waveState === 'spawning') {
        this.spawnTimer -= dt;
        while (this.spawnTimer <= 0 && this.spawnQueue.length) {
          if (this.level.waves[this.waveIndex].burst) {
            // 联合关：所有车道同时各出一只
            for (let lane = 0; lane < this.lanes && this.spawnQueue.length; lane++) this.spawnMonster(this.spawnQueue.shift(), lane);
          } else this.spawnMonster(this.spawnQueue.shift());
          this.spawnTimer += this.spawnGap;
        }
        if (!this.spawnQueue.length) {
          if (this.waveIndex >= this.totalWaves - 1) {
            this.waveState = 'final';
          } else {
            this.waveState = 'waiting';
            if (this.level.type === 'rush') {
              this.countdown = Math.max(1, this.level.rushInterval - (this.time - this.waveStartTime));
            } else this.countdown = C.waveMaxDelay;
          }
        }
        return;
      }
      if (this.waveState === 'waiting') {
        if (this.level.type !== 'rush' && !this.clearedOnce && this.aliveCount() === 0) {
          this.clearedOnce = true;
          this.countdown = Math.min(this.countdown, C.waveClearDelay);
        }
        // 无尽模式：Boss 还活着时下一波不来（普通关卡的 Boss 都在最后一波）
        const bossHold = this.level.endless && this.monsters.some((m) => m.def.boss && !m.dead);
        if (!bossHold) this.countdown -= dt;
        if (this.countdown <= 0) {
          if (this.supplyWaves.includes(this.waveIndex) && !this.supplyOffered[this.waveIndex]) {
            this.offerSupply();
            return;
          }
          this.endWaveHeal();
          this.startWave(this.waveIndex + 1);
        }
        return;
      }
      if (this.waveState === 'final') {
        if (this.aliveCount() === 0) this.finish(true);
      }
    }

    aliveCount() {
      let n = 0;
      for (const m of this.monsters) if (!m.dead) n++;
      return n;
    }

    // ---------- 怪物 ----------
    spawnMonster(type, lane, x) {
      const def = D.monsters[type];
      if (lane === undefined && def.pack) {
        // 狼群：同一组从同一条车道出来
        if (!this.pack || this.pack.type !== type || this.pack.left <= 0) this.pack = { type, lane: this.rng.int(this.lanes), left: def.pack };
        lane = this.pack.lane;
        this.pack.left--;
      }
      if (lane === undefined) lane = def.boss ? Math.floor(this.lanes / 2) : this.rng.int(this.lanes);
      const hp = Math.round(def.hp * this.D * (1 + (this.rules.monsterHp || 0)));
      const m = {
        id: nextId++,
        type,
        def,
        lane,
        x: x !== undefined ? x : C.spawnX + this.rng() * 20,
        y: this.laneY(lane),
        yOffset: def.flying ? -34 : (this.rng() - 0.5) * 26,
        hp,
        maxHp: hp,
        pending: 0,
        dps: def.dps * this.D,
        state: 'walk',
        attackTimer: 0.3 + this.rng() * 0.5,
        hasteUntil: 0,
        hasteAmt: 0,
        slowUntil: 0,
        slowAmt: 0,
        frozenUntil: 0,
        burnUntil: 0,
        burnDps: 0,
        burnTick: 0,
        stunUntil: 0,
        hitFlash: 0,
        dead: false,
        bornAt: this.time,
      };
      if (def.split) m.nextSplit = 1 - def.split.every;
      if (def.ai === 'boarKing') {
        m.ai = { phase: 1, summonTimer: 3, chargeTimer: 2, mode: 'walk', chargeDmg: 0, warnTimer: 0, laneTimer: D.boarKing.laneSwitchEvery };
      } else if (def.ai === 'kingScorpion') {
        m.ai = { phase: 1, mode: 'walk', burrowTimer: D.kingScorpion.firstBurrow, clawTimer: D.kingScorpion.clawEvery };
      } else if (def.ai === 'pharaoh') {
        m.ai = { phase: 1, mode: 'walk', stormTimer: D.pharaoh.stormFirst, summonTimer: 4, healTimer: 1, shieldTimer: -1 };
        m.shield = 0;
        m.shieldMax = 0;
      }
      if (def.healer) m.healTimer = 1;
      if (def.ranged) m.rangedTimer = 0.8;
      if (def.laneHop) m.hopTimer = def.laneHop.every * (0.6 + this.rng() * 0.6);
      if (def.regen) m.lastHit = -99;
      if (def.ai === 'boneMage') m.ai = { phase: 1, mode: 'walk', summonTimer: D.boneMage.summonFirst, revived: false };
      else if (def.ai === 'witch') m.ai = { phase: 1, mode: 'walk', fogTimer: D.witch.fogFirst, cookTimer: 3, pourTimer: 2 };
      else if (def.ai === 'iceGiant') m.ai = { phase: 1, mode: 'walk', freezeTimer: D.iceGiant.freezeFirst };
      else if (def.ai === 'rockGolem') m.ai = { phase: 1, mode: 'walk', stompTimer: D.rockGolem.stompFirst, warn: 0 };
      else if (def.ai === 'inkBoss') m.ai = { phase: 1, mode: 'walk', summonTimer: 2, slamTimer: 4, chargeDmg: 0, rageTimer: -1 };
      if (def.stealth) {
        m.stealthed = true;
        m.hopTimer = def.stealth.hopEvery;
      }
      else if (def.ai === 'frostQueen') {
        const Q = D.frostQueen;
        m.ai = { phase: 1, mode: 'walk', blizzardTimer: Q.blizzardFirst, sealTimer: 3, wolfTimer: 2, dragonTimer: 1 };
      }
      this.monsters.push(m);
      this.emit('spawn', m);
      return m;
    }

    isTargetable(m) {
      return !m.dead && !m.burrowed && !m.bones && !m.hidden && !m.stealthed && m.x <= C.width + 5;
    }

    monsterSpeed(m) {
      if (this.time < m.frozenUntil || this.time < m.stunUntil) return 0;
      let s = m.def.speed * (1 + (this.rules.monsterSpeed || 0));
      if (m.def.ai === 'boarKing' && m.ai.phase === 3) s *= D.boarKing.enrageSpeedMult;
      if (m.burrowed && m.def.burrow) s *= m.def.burrow.speedMult;
      if (m.def.ai === 'pharaoh' && m.ai.phase === 3) s *= D.pharaoh.phase3SpeedMult;
      if (m.cooked) s *= 1 + D.witch.cookSpeed;
      if (this.zones.length && !this.mods.fireproof) {
        for (const z of this.zones) {
          if (this.time < z.until && Math.abs(m.x - z.x) <= z.r && Math.abs(m.y - z.y) <= z.r) {
            s *= 1 + z.haste;
            break;
          }
        }
      }
      if (this.time < m.hasteUntil) s *= 1 + m.hasteAmt;
      let slow = this.time < m.slowUntil ? m.slowAmt : 0;
      for (const e of this.laneEffects) {
        if (e.lane === m.lane && this.time < e.until) {
          if (e.type === 'freeze') return 0;
          if (e.type === 'frost') slow = Math.max(slow, e.slow);
          if (e.type === 'poison') s *= 1 + e.haste;
          if (e.type === 'lava' && !this.mods.fireproof) s *= 1 + e.haste;
        }
      }
      return s * (1 - slow);
    }

    wallStopX(m) {
      return C.wallX + m.def.size * 0.6 + (m.def.flying ? 4 : 0);
    }

    updateMonsters(dt) {
      let chill = 0;
      for (const m of this.monsters) if (!m.dead && m.def.chill && m.x <= C.width) chill++;
      this.chillStacks = chill;
      for (const m of this.monsters) {
        if (m.dead) continue;
        if (m.hitFlash > 0) m.hitFlash -= dt;
        // 灼烧
        if (this.time < m.burnUntil) {
          m.burnTick -= dt;
          if (m.burnTick <= 0) {
            m.burnTick += 0.5;
            this.damage(m, m.burnDps * 0.5, { type: 'magic', fromFront: false, source: 'burn' });
            if (m.dead) continue;
          }
        }
        if (m.ai) {
          if (m.def.ai === 'boarKing') this.updateBoarKing(m, dt);
          else if (m.def.ai === 'kingScorpion') this.updateKingScorpion(m, dt);
          else if (m.def.ai === 'pharaoh') this.updatePharaoh(m, dt);
          else if (m.def.ai === 'boneMage') this.updateBoneMage(m, dt);
          else if (m.def.ai === 'witch') this.updateWitch(m, dt);
          else if (m.def.ai === 'iceGiant') this.updateIceGiant(m, dt);
          else if (m.def.ai === 'frostQueen') this.updateFrostQueen(m, dt);
          else if (m.def.ai === 'rockGolem') this.updateRockGolem(m, dt);
          else if (m.def.ai === 'inkBoss') this.updateInkBoss(m, dt);
          if (m.dead) continue;
          if (m.ai.mode !== 'walk') continue;
        }
        // 隐身（暗影刺客）：远处隐身并换道，靠近后现身
        const st = m.def.stealth;
        if (st) {
          const revealX = this.mods.reveal ? 800 : st.revealX;
          const was = m.stealthed;
          m.stealthed = m.x > revealX;
          if (was && !m.stealthed) this.emit('reveal', { m });
          if (m.stealthed && this.lanes > 1) {
            m.hopTimer -= dt;
            if (m.hopTimer <= 0) {
              m.hopTimer = st.hopEvery;
              m.lane = m.lane === 0 ? 1 : m.lane === this.lanes - 1 ? m.lane - 1 : m.lane + (this.rng() < 0.5 ? -1 : 1);
            }
          }
          const ty = this.laneY(m.lane);
          if (m.y !== ty) m.y += Math.sign(ty - m.y) * Math.min(Math.abs(ty - m.y), 140 * dt);
        }
        // 再生（树桩怪）
        if (m.def.regen && this.time - m.lastHit >= m.def.regen.delay && m.hp < m.maxHp) {
          m.hp = Math.min(m.maxHp, m.hp + m.maxHp * m.def.regen.pct * dt);
        }
        // 换道（蝙蝠）
        if (m.def.laneHop && this.lanes > 1) {
          m.hopTimer -= dt;
          if (m.hopTimer <= 0) {
            m.hopTimer = m.def.laneHop.every;
            const dir = m.lane === 0 ? 1 : m.lane === this.lanes - 1 ? -1 : this.rng() < 0.5 ? -1 : 1;
            m.lane += dir;
          }
          const ty = this.laneY(m.lane);
          if (m.y !== ty) m.y += Math.sign(ty - m.y) * Math.min(Math.abs(ty - m.y), 160 * dt);
        }
        // 钻地（设计书 19.2）
        const bur = m.def.burrow;
        if (bur && !m.burrowDone) {
          if (!m.burrowed && m.x <= bur.at) {
            m.burrowed = true;
            this.emit('burrow', { m });
          } else if (m.burrowed && m.x <= bur.until) {
            m.burrowed = false;
            m.burrowDone = true;
            this.emit('surface', { m });
          }
        }
        // 治疗型：停在后排，给周围的怪回血
        const heal = m.def.healer;
        if (heal) {
          m.healTimer -= dt;
          if (m.healTimer <= 0) {
            m.healTimer += 1;
            this.healAround(m, heal.radius, heal.pct);
          }
        }
        const ranged = m.def.ranged;
        const chillDef = m.def.chill;
        const stopX = heal ? heal.holdX : ranged ? ranged.holdX : chillDef ? chillDef.holdX : this.wallStopX(m);
        if (m.x > stopX) {
          m.state = 'walk';
          m.x = Math.max(stopX, m.x - this.monsterSpeed(m) * dt);
        } else if (heal || chillDef) {
          m.state = 'hold';
        } else if (ranged) {
          // 远程型：停在远处向城墙吐毒液
          m.state = 'hold';
          if (this.time >= m.frozenUntil && this.time >= m.stunUntil) {
            m.rangedTimer -= dt;
            if (m.rangedTimer <= 0) {
              m.rangedTimer = ranged.every;
              this.emit('spit', { m, x: m.x, y: m.y });
              this.hitWall(ranged.damage * this.D, m);
              if (ranged.poison) this.addWallDot(ranged.poison.dps * this.D, ranged.poison.duration, 'poison', true);
            }
          }
        } else if (m.def.explode) {
          // 自爆型：到达城墙立即爆炸，不掉铜币
          this.hitWall(m.def.explode.damage * this.D, m, true);
          this.emit('explode', { m });
          this.kill(m, true);
        } else {
          m.state = 'attack';
          if (m.def.slam && !m.slammed) {
            m.slammed = true;
            this.hitWall(m.def.slam * this.D, m, true);
            this.emit('slam', { m });
          }
          if (this.time >= m.frozenUntil && this.time >= m.stunUntil) {
            m.attackTimer -= dt;
            if (m.attackTimer <= 0) {
              m.attackTimer += 1;
              this.hitWall(m.dps, m);
              if (this.stats.thorns > 0 && !m.dead) {
                this.damage(m, this.atk * this.stats.thorns, { type: 'magic', fromFront: false, source: 'thorns' });
              }
            }
          }
        }
      }
      // 清理死亡怪物
      if (this.monsters.length > 60 && this.monsters.some((m) => m.dead)) {
        this.monsters = this.monsters.filter((m) => !m.dead || this.time - m.diedAt < 0.05);
      }
    }

    updateBoarKing(m, dt) {
      const B = D.boarKing;
      const ai = m.ai;
      const ratio = m.hp / m.maxHp;
      if (ai.phase === 1 && ratio < B.chargeBelow) {
        ai.phase = 2;
        ai.chargeTimer = 1.5;
        this.emit('bossPhase', { m, phase: 2, text: '咕噜大王愤怒了：野猪冲锋！' });
      }
      if (ai.phase === 2 && ratio < B.enrageBelow) {
        ai.phase = 3;
        this.emit('bossPhase', { m, phase: 3, text: '咕噜大王狂暴了！' });
      }
      // 召唤
      ai.summonTimer -= dt;
      if (ai.summonTimer <= 0) {
        ai.summonTimer += ai.phase === 3 ? B.summonEveryEnraged : B.summonEvery;
        for (let i = 0; i < B.summonCount; i++) {
          const lane = this.rng.int(this.lanes);
          this.spawnMonster(B.summonType, lane, Math.min(C.spawnX, m.x + 30 + this.rng() * 40));
        }
        this.emit('bossSummon', { m });
      }
      // 换道
      if (ai.phase === 3 && ai.mode === 'walk' && this.lanes > 1) {
        ai.laneTimer -= dt;
        if (ai.laneTimer <= 0) {
          ai.laneTimer += B.laneSwitchEvery;
          let lane = this.rng.int(this.lanes - 1);
          if (lane >= m.lane) lane++;
          m.lane = lane;
          m.y = this.laneY(lane);
          this.emit('laneSwitch', { m });
        }
      }
      // 第一、二阶段：走到中段停下指挥；第三阶段：压向城墙
      if (ai.mode === 'walk' && ai.phase < 3 && m.x <= B.holdX) {
        m.x = B.holdX;
        ai.mode = 'hold';
      }
      if (ai.mode === 'hold' && ai.phase === 3) ai.mode = 'walk';
      if (ai.phase < 2) return;
      // 冲锋
      if (ai.mode === 'hold') {
        ai.chargeTimer -= dt;
        if (ai.chargeTimer <= 0 && ai.phase === 2) {
          ai.mode = 'warn';
          ai.warnTimer = B.chargeWarn;
          ai.chargeDmg = 0;
          this.emit('bossWarn', { m, lane: m.lane, duration: B.chargeWarn });
        }
      } else if (ai.mode === 'return') {
        m.x = Math.min(B.holdX, m.x + B.returnSpeed * dt);
        if (m.x >= B.holdX) {
          ai.mode = ai.phase === 3 ? 'walk' : 'hold';
        }
      } else if (ai.mode === 'warn') {
        ai.warnTimer -= dt;
        if (ai.warnTimer <= 0) {
          ai.mode = 'charge';
          this.emit('bossCharge', { m });
        }
      } else if (ai.mode === 'charge') {
        if (this.time >= m.frozenUntil) {
          let sp = B.chargeSpeed;
          for (const e of this.laneEffects) if (e.lane === m.lane && this.time < e.until && e.type === 'frost') sp *= 1 - e.slow;
          m.x -= sp * dt;
        }
        if (m.x <= this.wallStopX(m)) {
          m.x = this.wallStopX(m);
          this.hitWall(B.chargeDamage * this.D, m, true);
          this.emit('chargeHit', { m });
          ai.mode = 'return';
          ai.chargeTimer = B.chargeEvery;
        }
      }
    }

    healAround(src, radius, pct) {
      let any = false;
      for (const o of this.monsters) {
        if (o.dead || o === src || o.hp >= o.maxHp) continue;
        const dx = o.x - src.x;
        const dy = o.y - src.y;
        if (dx * dx + dy * dy > radius * radius) continue;
        o.hp = Math.min(o.maxHp, o.hp + o.maxHp * pct);
        any = true;
      }
      this.emit('healPulse', { m: src, radius, any });
    }

    // 钳钳：钻地换道突袭，贴墙后钳击（设计书 19.3）
    updateKingScorpion(m, dt) {
      const K = D.kingScorpion;
      const ai = m.ai;
      const atWall = m.x <= this.wallStopX(m) + 1;
      if (ai.mode === 'walk') {
        if (atWall) {
          ai.clawTimer -= dt;
          if (ai.clawTimer <= 0 && this.time >= m.frozenUntil && this.time >= m.stunUntil) {
            ai.clawTimer = K.clawEvery;
            this.hitWall(K.clawDamage * this.D, m, true);
            this.emit('claw', { m });
          }
          return;
        }
        ai.burrowTimer -= dt;
        if (ai.burrowTimer <= 0 && m.x < C.width - 40) {
          ai.mode = 'under';
          ai.underTimer = K.underTime;
          m.burrowed = true;
          let lane = this.lanes > 1 ? this.rng.int(this.lanes - 1) : m.lane;
          if (this.lanes > 1 && lane >= m.lane) lane++;
          ai.toLane = lane;
          ai.toX = Math.max(this.wallStopX(m), m.x - K.jump);
          ai.warned = false;
          this.emit('burrow', { m, boss: true });
        }
      } else if (ai.mode === 'under') {
        ai.underTimer -= dt;
        if (!ai.warned && ai.underTimer <= 1) {
          ai.warned = true;
          this.emit('surfaceWarn', { lane: ai.toLane, x: ai.toX, y: this.laneY(ai.toLane), duration: 1 });
        }
        if (ai.underTimer <= 0) {
          m.lane = ai.toLane;
          m.y = this.laneY(m.lane);
          m.x = ai.toX;
          m.burrowed = false;
          ai.mode = 'walk';
          ai.burrowTimer = K.burrowEvery;
          this.emit('surface', { m, boss: true });
        }
      }
    }

    // 胖法老：沙暴、召唤与治疗、金字塔护盾（设计书 19.3）
    updatePharaoh(m, dt) {
      const F = D.pharaoh;
      const ai = m.ai;
      const ratio = m.hp / m.maxHp;
      if (ai.phase === 1 && ratio < F.phase2Below) {
        ai.phase = 2;
        this.emit('bossPhase', { m, phase: 2, text: '胖法老召唤了木乃伊！' });
      }
      if (ai.phase === 2 && ratio < F.phase3Below) {
        ai.phase = 3;
        this.raiseShield(m);
        this.emit('bossPhase', { m, phase: 3, text: '金字塔护盾！用魔法击破它！' });
      }
      // 沙暴
      ai.stormTimer -= dt;
      if (ai.stormTimer <= 0) {
        ai.stormTimer = F.stormEvery;
        this.buffs.push({ aspd: F.stormAspd, until: this.time + F.stormDuration, src: 'sandstorm' });
        this.emit('sandstorm', { duration: F.stormDuration });
      }
      if (ai.phase >= 2) {
        ai.summonTimer -= dt;
        if (ai.summonTimer <= 0) {
          ai.summonTimer = F.summonEvery;
          for (let i = 0; i < F.summonCount; i++) this.spawnMonster(F.summonType, this.rng.int(this.lanes), Math.min(C.spawnX, m.x + 40 + this.rng() * 40));
          this.emit('bossSummon', { m });
        }
        ai.healTimer -= dt;
        if (ai.healTimer <= 0) {
          ai.healTimer = 1;
          this.healAround(m, F.healRadius, F.healPct);
        }
      }
      if (ai.phase === 3 && m.shield <= 0 && ai.shieldTimer > 0) {
        ai.shieldTimer -= dt;
        if (ai.shieldTimer <= 0) this.raiseShield(m);
      }
      // 第一、二阶段停在中段
      if (ai.mode === 'walk' && ai.phase < 3 && m.x <= F.holdX) {
        m.x = F.holdX;
        ai.mode = 'hold';
      }
      if (ai.mode === 'hold' && ai.phase === 3) ai.mode = 'walk';
    }

    // 骨头先生：中段召唤小幽灵，第一次倒下后复活（设计书 21.3）
    updateBoneMage(m, dt) {
      const B = D.boneMage;
      const ai = m.ai;
      if (ai.mode === 'bones') {
        ai.reviveTimer -= dt;
        if (ai.reviveTimer <= 0) {
          m.bones = false;
          m.hp = m.maxHp * B.reviveHp;
          ai.mode = 'walk';
          ai.summonTimer = 0;
          this.emit('bossPhase', { m, phase: 2, text: '骨头先生复活了！' });
        }
        return;
      }
      ai.summonTimer -= dt;
      if (ai.summonTimer <= 0 && m.x < C.width - 30) {
        ai.summonTimer = B.summonEvery;
        const lanes = [];
        for (let i = 0; i < this.lanes; i++) lanes.push(i);
        for (let k = 0; k < Math.min(B.summonLanes, this.lanes); k++) {
          const lane = lanes.splice(this.rng.int(lanes.length), 1)[0];
          const g = this.spawnMonster(B.summonType, lane, Math.min(C.spawnX, m.x + 30));
          g.splitFrom = { x: m.x, y: m.y };
        }
        this.emit('bossSummon', { m });
      }
      if (ai.mode === 'walk' && !ai.revived && m.x <= B.holdX) {
        m.x = B.holdX;
        ai.mode = 'hold';
      }
    }

    boneDown(m) {
      m.hp = 1;
      m.bones = true;
      m.ai.revived = true;
      m.ai.mode = 'bones';
      m.ai.reviveTimer = D.boneMage.reviveTime;
      m.burnUntil = 0;
      this.emit('boneDown', { m });
    }

    // 毒汤婆婆：毒雾、煮汤、大锅倾倒（设计书 21.3）
    updateWitch(m, dt) {
      const W2 = D.witch;
      const ai = m.ai;
      const ratio = m.hp / m.maxHp;
      if (ai.phase === 1 && ratio < W2.phase2Below) {
        ai.phase = 2;
        this.emit('bossPhase', { m, phase: 2, text: '毒汤婆婆开始煮汤了！' });
      }
      if (ai.phase === 2 && ratio < W2.phase3Below) {
        ai.phase = 3;
        ai.pourTimer = 0.5;
        this.emit('bossPhase', { m, phase: 3, text: '大锅倾倒！毒池让怪物加速！' });
      }
      ai.fogTimer -= dt;
      if (ai.fogTimer <= 0) {
        ai.fogTimer = ai.phase === 3 ? W2.fogEveryP3 : W2.fogEvery;
        this.addWallDot(W2.fogDps * this.D, W2.fogDuration, 'fog', false);
        this.emit('poisonFog', { duration: W2.fogDuration });
      }
      if (ai.phase >= 2) {
        ai.cookTimer -= dt;
        if (ai.cookTimer <= 0) {
          ai.cookTimer = W2.cookEvery;
          let n = 0;
          for (const o of this.monsters) {
            if (o.dead || o.def.boss || o.cooked) continue;
            o.cooked = true;
            o.maxHp *= 1 + W2.cookHp;
            o.hp *= 1 + W2.cookHp;
            n++;
          }
          for (let i = 0; i < W2.summonCount; i++) this.spawnMonster(W2.summonType, this.rng.int(this.lanes), Math.min(C.spawnX, m.x + 40 + this.rng() * 40));
          this.emit('cook', { m, count: n });
        }
      }
      if (ai.phase === 3) {
        ai.pourTimer -= dt;
        if (ai.pourTimer <= 0) {
          ai.pourTimer = W2.pourEvery;
          const lanes = [];
          for (let i = 0; i < this.lanes; i++) lanes.push(i);
          for (let k = 0; k < Math.min(W2.pourLanes, this.lanes); k++) {
            const lane = lanes.splice(this.rng.int(lanes.length), 1)[0];
            this.laneEffects.push({ lane, type: 'poison', haste: W2.poolSpeed, until: this.time + W2.poolDuration, start: this.time });
          }
          this.emit('pour', { m });
        }
      }
      if (ai.mode === 'walk' && ai.phase < 3 && m.x <= W2.holdX) {
        m.x = W2.holdX;
        ai.mode = 'hold';
      }
      if (ai.mode === 'hold' && ai.phase === 3) ai.mode = 'walk';
    }

    // 冰棍大叔：周期性冻结一个技能槽（设计书 22.2）
    updateIceGiant(m, dt) {
      const G = D.iceGiant;
      const ai = m.ai;
      if (ai.phase === 1 && m.hp / m.maxHp < G.walkBelow) {
        ai.phase = 2;
        if (ai.mode === 'hold') ai.mode = 'walk';
        this.emit('bossPhase', { m, phase: 2, text: '冰棍大叔向城墙走来了！' });
      }
      ai.freezeTimer -= dt;
      if (ai.freezeTimer <= 0 && this.skills.length) {
        ai.freezeTimer = G.freezeEvery;
        const free = this.skills.map((sk, i) => i).filter((i) => !(this.time < (this.skills[i].frozenUntil || 0)));
        if (free.length) {
          const ready = free.filter((i) => this.skills[i].cd <= 0);
          const pick = (ready.length ? ready : free)[this.rng.int((ready.length ? ready : free).length)];
          this.skills[pick].frozenUntil = this.time + G.freezeDuration;
          this.emit('skillFrozen', { index: pick, id: this.skills[pick].id, m });
        }
      }
      if (ai.mode === 'walk' && ai.phase === 1 && m.x <= G.holdX) {
        m.x = G.holdX;
        ai.mode = 'hold';
      }
    }

    // 霜霜女王：暴风雪、冰封城墙、召唤狼群和小冰龙（设计书 22.2）
    updateFrostQueen(m, dt) {
      const Q = D.frostQueen;
      const ai = m.ai;
      const ratio = m.hp / m.maxHp;
      if (ai.phase === 1 && ratio < Q.phase2Below) {
        ai.phase = 2;
        this.emit('bossPhase', { m, phase: 2, text: '霜霜女王冰封了城墙！' });
      }
      if (ai.phase === 2 && ratio < Q.phase3Below) {
        ai.phase = 3;
        this.emit('bossPhase', { m, phase: 3, text: '小冰龙来了！空中地面一起压上！' });
      }
      ai.blizzardTimer -= dt;
      if (ai.blizzardTimer <= 0) {
        ai.blizzardTimer = Q.blizzardEvery;
        this.buffs.push({ aspd: Q.blizzardAspd, until: this.time + Q.blizzardDuration, src: 'blizzard' });
        this.emit('blizzard', { duration: Q.blizzardDuration });
      }
      if (ai.phase >= 2) {
        ai.sealTimer -= dt;
        if (ai.sealTimer <= 0) {
          ai.sealTimer = Q.sealEvery;
          this.wallSealedUntil = this.time + Q.sealDuration;
          this.emit('wallSeal', { duration: Q.sealDuration });
        }
        ai.wolfTimer -= dt;
        if (ai.wolfTimer <= 0) {
          ai.wolfTimer = Q.wolfEvery;
          const lane = this.rng.int(this.lanes);
          for (let i = 0; i < Q.wolfCount; i++) this.spawnMonster('wolf', lane, C.spawnX + i * 24);
          this.emit('bossSummon', { m });
        }
      }
      if (ai.phase === 3) {
        ai.dragonTimer -= dt;
        if (ai.dragonTimer <= 0) {
          ai.dragonTimer = Q.dragonEvery;
          for (let i = 0; i < Q.dragonCount; i++) this.spawnMonster('iceDragon', this.rng.int(this.lanes), Math.min(C.spawnX, m.x + 60));
          this.emit('bossSummon', { m });
        }
      }
      if (ai.mode === 'walk' && ai.phase < 3 && m.x <= Q.holdX) {
        m.x = Q.holdX;
        ai.mode = 'hold';
      }
      if (ai.mode === 'hold' && ai.phase === 3) ai.mode = 'walk';
    }

    // 岩岩：跺脚震晕英雄；死亡爆炸（设计书 23.2）
    updateRockGolem(m, dt) {
      const R = D.rockGolem;
      const ai = m.ai;
      if (ai.warn > 0) {
        ai.warn -= dt;
        if (ai.warn <= 0) {
          this.heroStunUntil = this.time + R.stunDuration;
          this.emit('stomp', { m, duration: R.stunDuration });
        }
        return;
      }
      ai.stompTimer -= dt;
      if (ai.stompTimer <= 0) {
        ai.stompTimer = R.stompEvery;
        ai.warn = R.stompWarn;
        this.emit('stompWarn', { m });
      }
    }

    // 墨墨：召唤墨影 → 分身 → 魔王重击 → 裂隙狂暴（设计书 23.2）
    updateInkBoss(m, dt) {
      const K = D.inkBoss;
      const ai = m.ai;
      const ratio = m.hp / m.maxHp;
      if (ai.phase === 1 && ratio < K.phase2Below) {
        ai.phase = 2;
        this.splitInk(m);
        this.emit('bossPhase', { m, phase: 2, text: '墨墨分身了！打掉三个分身！' });
      }
      if (ai.phase === 2 && !m.hidden && ratio < K.phase3Below) {
        ai.phase = 3;
        ai.big = true;
        ai.slamTimer = 3;
        this.emit('bossPhase', { m, phase: 3, text: '魔王形态！蓄力时集中火力打断！' });
      }
      if (ai.phase === 3 && ratio < K.phase4Below) {
        ai.phase = 4;
        ai.rageTimer = K.rageFirst;
        this.emit('bossPhase', { m, phase: 4, text: '裂隙狂暴！30 秒内击败墨墨！' });
      }
      if (m.hidden) return;
      // 召唤墨影（复刻前四章的小怪）
      if (ai.phase < 3 || ai.phase === 4) {
        ai.summonTimer -= dt;
        if (ai.summonTimer <= 0) {
          ai.summonTimer = K.summonEvery;
          for (let i = 0; i < K.summonCount; i++) {
            const sh = this.spawnMonster(this.rng.pick(K.shadePool), this.rng.int(this.lanes), Math.min(C.spawnX, m.x + 40 + this.rng() * 40));
            sh.shade = true;
          }
          this.emit('bossSummon', { m });
        }
      }
      // 魔王重击
      if (ai.phase >= 3) {
        if (ai.mode === 'warn') {
          ai.warnTimer -= dt;
          if (ai.warnTimer <= 0) {
            ai.mode = 'hold';
            ai.slamTimer = K.slamEvery;
            this.hitWall(K.slamDamage * this.D, m, true);
            this.emit('inkSlam', { m });
          }
        } else if (this.time >= m.stunUntil) {
          ai.slamTimer -= dt;
          if (ai.slamTimer <= 0) {
            ai.mode = 'warn';
            ai.warnTimer = K.slamWarn;
            ai.chargeDmg = 0;
            this.emit('bossWarn', { m, lane: m.lane, duration: K.slamWarn, ink: true });
          }
        }
      }
      // 裂隙狂暴倒计时
      if (ai.phase === 4) {
        ai.rageTimer -= dt;
        if (ai.rageTimer <= 0) {
          ai.rageTimer = K.rageEvery;
          this.hitWall(this.wall.max * K.rageRatio, m, true);
          this.emit('riftStrike', { m });
        }
      }
      if (ai.mode === 'walk' && m.x <= K.holdX) {
        m.x = K.holdX;
        ai.mode = 'hold';
      }
    }

    splitInk(m) {
      const K = D.inkBoss;
      m.hidden = true;
      m.ai.mode = 'hold';
      const lanes = [];
      for (let i = 0; i < this.lanes; i++) lanes.push(i);
      for (let k = 0; k < Math.min(K.cloneCount, this.lanes); k++) {
        const lane = lanes.splice(this.rng.int(lanes.length), 1)[0];
        const c = this.spawnMonster('inkClone', lane, m.x);
        c.hp = c.maxHp = m.maxHp * K.cloneHp;
        c.cloneOf = m;
        c.splitFrom = { x: m.x, y: m.y };
      }
      this.emit('inkSplit', { m });
    }

    clonesDown(m) {
      const K = D.inkBoss;
      m.hidden = false;
      m.stunUntil = this.time + K.stunAfterClones;
      m.vulnUntil = this.time + K.vulnDuration;
      this.emit('inkReform', { m });
    }

    raiseShield(m) {
      m.shieldMax = m.maxHp * D.pharaoh.shieldRatio;
      m.shield = m.shieldMax;
      m.ai.shieldTimer = -1;
      this.emit('shieldUp', { m });
    }

    // 冲锋期间累计伤害，达到阈值就打断
    onBossDamaged(m, dmg) {
      const ai = m.ai;
      if (m.def.ai === 'inkBoss') {
        if (ai.mode !== 'warn') return;
        ai.chargeDmg += dmg;
        if (ai.chargeDmg >= m.maxHp * D.inkBoss.interruptRatio) {
          ai.mode = ai.phase >= 3 ? 'hold' : 'hold';
          ai.slamTimer = D.inkBoss.slamEvery;
          m.stunUntil = this.time + 1.2;
          this.emit('bossInterrupt', { m });
        }
        return;
      }
      if (m.def.ai !== 'boarKing') return;
      if (!ai || (ai.mode !== 'warn' && ai.mode !== 'charge')) return;
      ai.chargeDmg += dmg;
      if (ai.chargeDmg >= m.maxHp * D.boarKing.interruptRatio) {
        ai.mode = 'return';
        ai.chargeTimer = D.boarKing.chargeEvery;
        m.x = Math.min(D.boarKing.holdX, m.x + D.boarKing.knockback);
        m.stunUntil = this.time + 1.2;
        this.emit('bossInterrupt', { m });
      }
    }

    // 城墙持续伤害（毒液、毒雾）。refresh=true 时同来源只刷新时间不叠加
    addWallDot(dps, duration, src, refresh) {
      if (refresh) {
        const e = this.wallDots.find((d) => d.src === src && d.until > this.time);
        if (e) {
          e.until = this.time + duration;
          e.dps = Math.max(e.dps, dps);
          return;
        }
      }
      this.wallDots.push({ dps, until: this.time + duration, src });
    }

    updateWallDots(dt) {
      if (!this.wallDots.length) return;
      this.dotTick -= dt;
      if (this.dotTick > 0) return;
      this.dotTick += 0.5;
      let total = 0;
      for (const d of this.wallDots) if (this.time < d.until) total += d.dps * 0.5;
      this.wallDots = this.wallDots.filter((d) => this.time < d.until);
      if (total > 0) this.hitWall(total * (1 - Math.min(0.9, this.mods.dotReduce)), null, false, 'dot');
    }

    hitWall(amount, m, big, kind) {
      const temp = this.time < this.tempDr.until ? this.tempDr.amt : 0;
      const dmg = amount * (1 - Math.min(0.8, this.stats.wallDr + this.mods.wallDr + temp));
      this.wall.hp = Math.max(0, this.wall.hp - dmg);
      this.wallDamageTaken += dmg;
      this.emit('wallHit', { amount: dmg, m, big: !!big, kind });
      if (this.wall.hp <= 0) this.finish(false);
    }

    healWall(amount, src) {
      if (this.time < this.wallSealedUntil) {
        this.emit('healBlocked', { src });
        return;
      }
      const before = this.wall.hp;
      this.wall.hp = Math.min(this.wall.max, this.wall.hp + amount);
      this.emit('wallHeal', { amount: this.wall.hp - before, src });
    }

    // ---------- 伤害 ----------
    // 无视护甲比例：穿甲被动 + 补给 + 武器自带，最多 80%
    armorIgnore(opts) {
      if (opts && opts.source === 'thorns') return 0;
      let ig = this.mods.armorIgnore || 0;
      if (this.stats.passives.pierceArmor) ig += D.passiveSkills.pierceArmor.ignore;
      if (opts && opts.armorIgnore) ig += opts.armorIgnore;
      return Math.min(0.8, ig);
    }

    armorFactor(m, fromFront, type, weaponIgnore) {
      if (m.shield > 0) return type === 'magic' ? 0.5 : 0.1;
      if (type === 'magic') return 1;
      let armor = (m.def.armor || 0) + (fromFront ? m.def.frontArmor || 0 : 0);
      armor *= 1 - this.armorIgnore({ armorIgnore: weaponIgnore });
      return 1 - armor / (armor + 100);
    }

    // opts: { type: 'phys'|'magic', fromFront, crit, source }
    damage(m, amount, opts) {
      if (m.dead) return 0;
      if (opts.type === 'magic' && opts.source !== 'thorns') amount *= 1 + this.mods.magicMult;
      if (m.vulnUntil && this.time < m.vulnUntil) amount *= D.inkBoss.vulnMult;
      // 护盾：先吸收伤害，魔法效果更好（设计书 19.3）
      if (m.shield > 0) {
        const P2 = D.pharaoh;
        const eff = amount * (opts.type === 'magic' ? P2.shieldMagicMult : P2.shieldPhysMult);
        m.shield -= eff;
        m.hitFlash = 0.08;
        this.emit('shieldHit', { m, x: m.x, y: m.y + m.yOffset, dmg: eff, magic: opts.type === 'magic' });
        if (m.shield <= 0) {
          m.shield = 0;
          m.ai.shieldTimer = P2.shieldRegen;
          this.emit('shieldBreak', { m });
        }
        return 0;
      }
      let armor = 0;
      if (opts.type !== 'magic') {
        armor = (m.def.armor || 0) + (opts.fromFront ? m.def.frontArmor || 0 : 0);
        armor *= 1 - this.armorIgnore(opts);
        // 灵体：物理伤害大打折扣（设计书 21.2）
        if (m.def.physResist) amount *= Math.min(1, 1 - m.def.physResist + this.mods.spiritPierce);
      } else {
        armor = m.def.mres || 0;
      }
      const dmg = Math.max(1, amount * (1 - armor / (armor + 100)));
      m.hp -= dmg;
      m.hitFlash = 0.12;
      m.lastHit = this.time;
      this.damageDealt += dmg;
      this.emit('hit', {
        m,
        x: m.x,
        y: m.y + m.yOffset,
        dmg,
        crit: !!opts.crit,
        source: opts.source,
        blocked: opts.type !== 'magic' && opts.fromFront && m.def.frontArmor > 0,
      });
      if (m.ai) this.onBossDamaged(m, dmg);
      if (m.def.split && m.hp > 0) {
        while (m.hp / m.maxHp <= m.nextSplit && m.nextSplit > 0) {
          m.nextSplit -= m.def.split.every;
          this.split(m, m.def.split.count);
        }
      }
      if (m.hp <= 0) {
        if (m.def.ai === 'boneMage' && !m.ai.revived) this.boneDown(m);
        else this.kill(m);
      }
      return dmg;
    }

    split(m, count) {
      const sp = m.def.split;
      for (let i = 0; i < count; i++) {
        let lane = m.lane;
        if (this.lanes > 1) {
          const dir = i % 2 === 0 ? -1 : 1;
          lane = TD.util.clamp(m.lane + dir, 0, this.lanes - 1);
          if (lane === m.lane) lane = TD.util.clamp(m.lane - dir, 0, this.lanes - 1);
        }
        const c = this.spawnMonster(sp.child, lane, m.x + 20 + this.rng() * 30);
        c.splitFrom = { x: m.x, y: m.y };
      }
      this.emit('split', { m, count });
    }

    kill(m, noReward) {
      m.dead = true;
      m.hp = 0;
      m.diedAt = this.time;
      const copper = noReward ? 0 : m.def.copper;
      if (!noReward) {
        this.kills++;
        this.killsByType[m.type] = (this.killsByType[m.type] || 0) + 1;
      }
      this.killCopper += copper;
      this.emit('death', { m, copper, noReward: !!noReward });
      const od = m.def.onDeath;
      if (od && od.type === 'spore') {
        for (const o of this.monsters) {
          if (o.dead || o === m) continue;
          const dx = o.x - m.x;
          const dy = o.y + o.yOffset - (m.y + m.yOffset);
          if (dx * dx + dy * dy <= od.radius * od.radius) {
            o.hasteUntil = this.time + od.duration;
            o.hasteAmt = od.speedBonus;
          }
        }
        this.emit('spore', { x: m.x, y: m.y + m.yOffset, radius: od.radius });
      }
      if (m.def.split) this.split(m, m.def.split.deathCount);
      if (m.def.fireZone) {
        const fz = m.def.fireZone;
        this.zones.push({ x: m.x, y: m.y, r: fz.radius, until: this.time + fz.duration, haste: fz.haste });
        this.emit('fireZone', { x: m.x, y: m.y, r: fz.radius, duration: fz.duration });
      }
      if (m.def.ai === 'rockGolem') {
        const R = D.rockGolem;
        if (m.x < C.wallX + R.boomRange) this.hitWall(R.boomDamage * this.D, m, true);
        this.laneEffects.push({ lane: m.lane, type: 'lava', haste: R.lavaHaste, until: this.time + R.lavaDuration, start: this.time });
        this.emit('golemBoom', { m, near: m.x < C.wallX + R.boomRange });
      }
      if (m.cloneOf) {
        const boss = m.cloneOf;
        if (boss.ai && !boss.dead && this.monsters.every((o) => o.dead || o.cloneOf !== boss)) this.clonesDown(boss);
      }
      const ds = m.def.deathSpawn;
      if (ds) {
        for (let i = 0; i < ds.count; i++) {
          const c = this.spawnMonster(ds.type, m.lane, m.x + (i - 1) * 22);
          c.splitFrom = { x: m.x, y: m.y };
        }
        this.emit('split', { m, count: ds.count });
      }
    }

    // ---------- 英雄 ----------
    // 攻速：增益相加；减益（沙暴、暴风雪、冰晶精灵光环）相加后受"暖手炉"减免
    aspdMalus() {
      let malus = 0;
      for (const b of this.buffs) if (this.time < b.until && b.aspd < 0) malus -= b.aspd;
      const sprite = D.monsters.iceSprite.chill;
      malus += Math.min(sprite.maxStacks, this.chillStacks) * sprite.aspd;
      return malus * (1 - Math.min(0.9, this.mods.chillResist));
    }

    currentAspd() {
      let bonus = 0;
      for (const b of this.buffs) if (this.time < b.until && b.aspd > 0) bonus += b.aspd;
      return this.stats.aspd * (1 + this.mods.aspdMult) * Math.max(0.3, 1 + bonus - this.aspdMalus());
    }

    inRange(m) {
      return m.x <= C.wallX + this.range;
    }

    // 按目标优先级排序可攻击目标
    rankTargets() {
      const list = [];
      for (const m of this.monsters) {
        if (!this.isTargetable(m) || !this.inRange(m)) continue;
        if (m.hp - m.pending <= 0) continue; // 已经有足够的弹道在路上
        list.push(m);
      }
      const mode = this.target;
      const byX = (a, b) => a.x - b.x;
      if (mode === 'weakest') list.sort((a, b) => a.hp - b.hp || byX(a, b));
      else if (mode === 'strongest') list.sort((a, b) => b.hp - a.hp || byX(a, b));
      else if (mode === 'flying') list.sort((a, b) => (b.def.flying ? 1 : 0) - (a.def.flying ? 1 : 0) || byX(a, b));
      else if (mode === 'boss') list.sort((a, b) => (b.def.boss ? 1 : 0) - (a.def.boss ? 1 : 0) || byX(a, b));
      else if (mode === 'smart') {
        // 威胁优先：逼近城墙的先打；城墙安全时优先打辅助型怪物（治疗、光环、远程）
        const danger = (m) => m.x < C.wallX + C.smartDanger;
        const support = (m) => !!(m.def.healer || m.def.chill || m.def.ranged);
        list.sort((a, b) => (danger(b) ? 1 : 0) - (danger(a) ? 1 : 0) || (support(b) ? 1 : 0) - (support(a) ? 1 : 0) || byX(a, b));
      } else list.sort(byX);
      return list;
    }

    rollHit(mult) {
      let dmg = this.atk * this.stats.weaponMult * mult;
      let buffCrit = 0;
      for (const b of this.buffs) if (b.crit && this.time < b.until) buffCrit += b.crit;
      const crit = this.rng() < this.stats.crit + this.mods.crit + buffCrit;
      if (crit) dmg *= this.stats.critDmg + this.mods.critDmg;
      return { dmg, crit };
    }

    updateHero(dt) {
      if (this.time < this.heroStunUntil) return;
      this.hero.cooldown -= dt;
      if (this.hero.cooldown > 0) return;
      const targets = this.rankTargets();
      if (!targets.length) {
        this.hero.cooldown = 0;
        return;
      }
      this.fire(targets);
      this.hero.attacks++;
      if (this.stats.passives.combo && this.hero.attacks % D.passiveSkills.combo.every === 0) {
        const again = this.rankTargets();
        if (again.length) {
          this.fire(again);
          this.emit('combo', {});
        }
      }
      this.hero.cooldown += 1 / this.currentAspd();
    }

    weaponDef() {
      return this.stats.weaponDef || D.weapons[this.stats.weapon];
    }

    fire(targets) {
      const w = this.weaponDef();
      const sx = C.heroX + 26;
      const sy = this.heroY - 46;
      const t0 = targets[0];
      this.hero.aimX = t0.x;
      this.hero.aimY = t0.y + t0.yOffset;
      this.hero.shotAt = this.time;
      if (w.boomerang) {
        const lanes = [t0.lane];
        if (w.twin && this.lanes > 1) lanes.push(t0.lane + 1 < this.lanes ? t0.lane + 1 : t0.lane - 1);
        for (const lane of lanes) {
          this.projectiles.push({
            kind: 'boomerang',
            lane,
            x: C.wallX,
            y: this.laneY(lane),
            dir: 1,
            speed: w.projSpeed,
            maxX: C.wallX + this.range,
            hitOut: new Set(),
            hitBack: new Set(),
            spin: 0,
          });
        }
        this.emit('shoot', { weapon: 'boomerang' });
        return;
      }
      const shots = [];
      if (w.bolts) {
        for (let i = 0; i < w.bolts; i++) {
          if (i < targets.length) shots.push({ m: targets[i], mult: 1 });
          else shots.push({ m: t0, mult: w.extraBoltMult });
        }
      } else shots.push({ m: t0, mult: 1 });
      for (const s of shots) {
        let mult = s.mult;
        if (w.flyingMult && s.m.def.flying) mult *= w.flyingMult;
        const roll = this.rollHit(mult);
        if (!w.splash) s.m.pending += roll.dmg * this.armorFactor(s.m, true, w.dmgType, w.armorIgnore);
        const kind = { crossbow: 'bolt', staff: 'orb', cannon: 'shell', orb: 'zap' }[this.stats.weapon] || 'arrow';
        this.projectiles.push({
          kind,
          x: sx,
          y: sy,
          sx,
          sy,
          target: s.m,
          tx: s.m.x,
          ty: s.m.y + s.m.yOffset,
          speed: w.projSpeed,
          dmg: roll.dmg,
          crit: roll.crit,
          angle: 0,
          dmgType: w.dmgType || 'phys',
          splash: w.splash,
          armorIgnore: w.armorIgnore || 0,
          arc: !!w.arc,
          travel: 0,
          dist0: Math.hypot(s.m.x - sx, s.m.y + s.m.yOffset - sy),
          chain: w.chain,
        });
      }
      this.emit('shoot', { weapon: this.stats.weapon });
    }

    ignite(m) {
      const b = D.passiveSkills.burn;
      if (this.time >= m.burnUntil) m.burnTick = 0.5;
      m.burnUntil = this.time + b.duration;
      m.burnDps = Math.max(m.burnDps || 0, (this.atk * b.atkMult) / b.duration);
    }

    applyWeaponHit(m, dmg, crit, fromFront, p) {
      const type = p && p.dmgType === 'magic' ? 'magic' : 'phys';
      this.damage(m, dmg, { type, fromFront, crit, source: 'weapon', armorIgnore: p ? p.armorIgnore : 0 });
      if (this.stats.passives.burn && !m.dead) {
        const b = D.passiveSkills.burn;
        if (this.time >= m.burnUntil) m.burnTick = 0.5;
        m.burnUntil = this.time + b.duration;
        m.burnDps = (this.atk * b.atkMult) / b.duration;
      }
      if (this.mods.igniteOnHit && !m.dead) this.ignite(m);
      if (this.mods.slowOnHit > 0 && !m.dead) {
        const prev = this.time < m.slowUntil ? m.slowAmt : 0;
        m.slowAmt = Math.max(prev, this.mods.slowOnHit);
        m.slowUntil = Math.max(m.slowUntil, this.time + 1.5);
      }
    }

    // 链式闪电：从命中的目标跳向附近没被打过的怪
    chainFrom(first, p) {
      const hit = new Set([first.id]);
      let cur = first;
      let dmg = p.dmg;
      for (let i = 0; i < p.chain.count; i++) {
        let best = null;
        let bd = p.chain.range;
        for (const o of this.monsters) {
          if (hit.has(o.id) || !this.isTargetable(o)) continue;
          const d = Math.hypot(o.x - cur.x, o.y + o.yOffset - (cur.y + cur.yOffset));
          if (d <= bd) {
            bd = d;
            best = o;
          }
        }
        if (!best) break;
        dmg *= p.chain.falloff;
        hit.add(best.id);
        this.emit('thunderChain', { x0: cur.x, y0: cur.y + cur.yOffset, x: best.x, y: best.y + best.yOffset, small: true });
        this.damage(best, dmg, { type: 'magic', fromFront: false, source: 'chain' });
        cur = best;
      }
    }

    // 范围爆炸：主目标以外的怪受到部分伤害
    splashAt(x, y, p, primary) {
      const r = p.splash.radius;
      for (const o of this.monsters.slice()) {
        if (o === primary || !this.isTargetable(o)) continue;
        const dx = o.x - x;
        const dy = o.y + o.yOffset - y;
        if (dx * dx + dy * dy > r * r) continue;
        this.damage(o, p.dmg * p.splash.mult, { type: p.dmgType === 'magic' ? 'magic' : 'phys', fromFront: false, source: 'splash', armorIgnore: p.armorIgnore });
      }
      this.emit('splash', { x, y, radius: r, magic: p.dmgType === 'magic' });
    }

    updateProjectiles(dt) {
      for (const p of this.projectiles) {
        if (p.done) continue;
        if (p.kind === 'boomerang') {
          p.spin += dt * 20;
          p.x += p.dir * p.speed * dt;
          if (p.dir === 1 && p.x >= p.maxX) p.dir = -1;
          const hitSet = p.dir === 1 ? p.hitOut : p.hitBack;
          for (const m of this.monsters) {
            if (m.dead || m.lane !== p.lane || hitSet.has(m.id) || !this.isTargetable(m)) continue;
            if (Math.abs(m.x - p.x) <= m.def.size + 8) {
              hitSet.add(m.id);
              const roll = this.rollHit(1);
              this.applyWeaponHit(m, roll.dmg, roll.crit, p.dir === 1);
            }
          }
          if (p.dir === -1 && p.x <= C.wallX) p.done = true;
          continue;
        }
        const m = p.target;
        if (!m.dead && !m.burrowed) {
          p.tx = m.x;
          p.ty = m.y + m.yOffset;
        }
        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        const dist = Math.hypot(dx, dy);
        const step = p.speed * dt;
        p.angle = Math.atan2(dy, dx);
        p.travel += step;
        if (dist <= step + 4) {
          p.done = true;
          if (!p.splash) m.pending = Math.max(0, m.pending - p.dmg * this.armorFactor(m, true, p.dmgType, p.armorIgnore));
          if (this.isTargetable(m)) this.applyWeaponHit(m, p.dmg, p.crit, true, p);
          else if (!m.dead) this.emit('miss', { x: p.tx, y: p.ty });
          if (p.splash) this.splashAt(p.tx, p.ty, p, m);
          if (p.chain && this.isTargetable(m)) this.chainFrom(m, p);
        } else {
          p.x += (dx / dist) * step;
          p.y += (dy / dist) * step;
        }
      }
      if (this.projectiles.length > 40) this.projectiles = this.projectiles.filter((p) => !p.done);
    }

    // ---------- 技能与道具 ----------
    skillReady(i) {
      const s = this.skills[i];
      return s && s.cd <= 0 && !this.over && this.waveState !== 'prepare' && !(this.time < (s.frozenUntil || 0));
    }

    // 车道类技能未指定车道时自动选怪最多的车道
    bestLane() {
      const score = new Array(this.lanes).fill(0);
      for (const m of this.monsters) {
        if (m.dead || !this.isTargetable(m)) continue;
        score[m.lane] += m.hp * (1.5 - (m.x - C.wallX) / C.fieldWidth);
      }
      let best = 0;
      for (let i = 1; i < this.lanes; i++) if (score[i] > score[best]) best = i;
      return best;
    }

    castSkill(i, lane) {
      if (!this.skillReady(i)) return false;
      const s = this.skills[i];
      const def = s.def;
      if (def.targetLane && lane === undefined) lane = this.bestLane();
      const atk = this.atk;
      switch (s.id) {
        case 'drum':
          this.buffs.push({ aspd: def.aspdBonus, crit: def.critBonus || 0, until: this.time + def.duration, src: 'drum' });
          break;
        case 'repair':
          this.healWall(this.wall.max * def.healRatio, 'repair');
          if (def.drBonus) this.tempDr = { amt: def.drBonus, until: this.time + def.drDuration };
          break;
        case 'arrowRain':
          this.rain = { left: def.arrows, every: def.duration / def.arrows, timer: 0, dmg: atk * def.atkMult, ignite: !!def.ignite };
          break;
        case 'frost':
          this.laneEffects.push({ lane, type: 'frost', slow: def.slow, until: this.time + def.duration, start: this.time, freezeEnd: def.freezeEnd || 0 });
          break;
        case 'thunder': {
          let best = null;
          for (const m of this.monsters) if (this.isTargetable(m) && (!best || m.hp > best.hp)) best = m;
          if (!best) return false;
          this.emit('thunder', { x: best.x, y: best.y + best.yOffset });
          const bx = best.x;
          const by = best.y;
          this.damage(best, atk * def.atkMult, { type: 'magic', fromFront: false, source: 'thunder' });
          if (def.chain) {
            const near = this.monsters
              .filter((m) => m !== best && this.isTargetable(m) && Math.hypot(m.x - bx, m.y - by) <= def.chainRange)
              .sort((a, b) => Math.hypot(a.x - bx, a.y - by) - Math.hypot(b.x - bx, b.y - by))
              .slice(0, def.chain);
            for (const m of near) {
              this.emit('thunderChain', { x0: bx, y0: by + best.yOffset, x: m.x, y: m.y + m.yOffset });
              this.damage(m, atk * def.atkMult * def.chainMult, { type: 'magic', fromFront: false, source: 'thunder' });
            }
          }
          break;
        }
      }
      s.cd = def.cd * Math.max(0.3, 1 + this.mods.cdMult);
      this.castCount++;
      this.emit('skill', { id: s.id, lane });
      return true;
    }

    useItem(i, lane) {
      const it = this.items[i];
      if (!it || it.used || this.over || this.waveState === 'prepare') return false;
      const def = it.def;
      if (def.targetLane && lane === undefined) lane = this.bestLane();
      const atk = this.atk;
      switch (it.id) {
        case 'bomb':
          for (const m of this.monsters.slice()) {
            if (m.lane === lane && this.isTargetable(m)) this.damage(m, atk * def.atkMult, { type: 'phys', fromFront: false, source: 'bomb' });
          }
          break;
        case 'patch':
          this.healWall(this.wall.max * def.healRatio, 'patch');
          break;
        case 'haste':
          this.buffs.push({ aspd: def.aspdBonus, until: this.time + def.duration, src: 'haste' });
          break;
        case 'freeze':
          this.laneEffects.push({ lane, type: 'freeze', until: this.time + def.duration, start: this.time });
          for (const m of this.monsters) if (m.lane === lane && !m.dead) m.frozenUntil = this.time + def.duration;
          break;
      }
      it.used = true;
      this.itemsUsed.push(it.id);
      this.emit('item', { id: it.id, lane });
      return true;
    }

    // 箭雨：逐支落下，每支随机命中射程内的一只怪
    updateRain(dt) {
      const r = this.rain;
      if (!r) return;
      r.timer -= dt;
      while (r.timer <= 0 && r.left > 0) {
        r.timer += r.every;
        r.left--;
        const pool = this.monsters.filter((m) => this.isTargetable(m) && this.inRange(m));
        if (!pool.length) continue;
        const m = this.rng.pick(pool);
        this.emit('rainArrow', { x: m.x, y: m.y + m.yOffset });
        this.damage(m, r.dmg, { type: 'phys', fromFront: false, source: 'arrowRain' });
        if (r.ignite && !m.dead) this.ignite(m);
      }
      if (r.left <= 0) this.rain = null;
    }

    // 自动释放（玩家开启自动释放，或模拟机器人）
    updateAuto() {
      const inRange = this.monsters.filter((m) => this.isTargetable(m) && this.inRange(m));
      const all = this.monsters.filter((m) => this.isTargetable(m));
      const hasBoss = all.some((m) => m.def.boss);
      const wallRatio = this.wall.hp / this.wall.max;
      if (this.autoCast) {
        this.skills.forEach((s, i) => {
          if (!this.skillReady(i)) return;
          let go = false;
          switch (s.id) {
            case 'drum':
              go = inRange.length >= 3 || (hasBoss && inRange.length > 0);
              break;
            case 'repair':
              go = wallRatio < 0.6 && this.time >= this.wallSealedUntil;
              break;
            case 'arrowRain':
              go = inRange.length >= 6 || (hasBoss && inRange.length >= 2);
              break;
            case 'frost': {
              const near = all.filter((m) => m.x < C.wallX + 400).length;
              go = near >= 4 || this.monsters.some((m) => m.ai && m.ai.mode === 'warn');
              break;
            }
            case 'thunder':
              go = all.some((m) => m.hp >= this.atk * 4) || this.monsters.some((m) => m.ai && m.ai.mode === 'warn');
              break;
          }
          if (go) {
            const warnBoss = this.monsters.find((m) => m.ai && m.ai.mode === 'warn');
            this.castSkill(i, s.id === 'frost' && warnBoss ? warnBoss.lane : undefined);
          }
        });
      }
      if (this.autoItems) {
        this.items.forEach((it, i) => {
          if (it.used) return;
          let go = false;
          switch (it.id) {
            case 'bomb': {
              const lane = this.bestLane();
              go = all.filter((m) => m.lane === lane).length >= 5;
              break;
            }
            case 'patch':
              go = wallRatio < 0.45 && this.time >= this.wallSealedUntil;
              break;
            case 'haste':
              go = inRange.length >= 6 || (hasBoss && inRange.length > 0 && wallRatio < 0.8);
              break;
            case 'freeze':
              go = wallRatio < 0.7 && all.filter((m) => m.x < C.wallX + 200).length >= 4;
              break;
          }
          if (go) this.useItem(i);
        });
      }
    }

    // ---------- 主循环 ----------
    step(dt) {
      if (this.over || this.pendingSupply) return;
      this.time += dt;
      for (const s of this.skills) if (s.cd > 0) s.cd = Math.max(0, s.cd - dt);
      if (this.buffs.length && this.buffs[0].until < this.time) this.buffs = this.buffs.filter((b) => b.until >= this.time);
      if (this.laneEffects.length) {
        const keep = [];
        for (const e of this.laneEffects) {
          if (e.until >= this.time) keep.push(e);
          else if (e.freezeEnd) {
            // 冰冻领域 Lv3：结束时冻结整条车道
            keep.push({ lane: e.lane, type: 'freeze', until: this.time + e.freezeEnd, start: this.time });
            for (const m of this.monsters) if (m.lane === e.lane && !m.dead) m.frozenUntil = this.time + e.freezeEnd;
            this.emit('laneFreeze', { lane: e.lane });
          }
        }
        this.laneEffects = keep;
      }
      this.updateWaves(dt);
      if (this.over) return;
      this.updateMonsters(dt);
      if (this.over) return;
      this.updateWallDots(dt);
      if (this.over) return;
      if (this.zones.length && this.zones[0].until < this.time) this.zones = this.zones.filter((z) => z.until >= this.time);
      this.updateHero(dt);
      this.updateRain(dt);
      this.updateProjectiles(dt);
      if (this.autoCast || this.autoItems) this.updateAuto();
    }

    finish(win) {
      if (this.over) return;
      this.over = true;
      const wallRatio = this.wall.hp / this.wall.max;
      this.result = {
        win,
        wallRatio,
        stars: win ? TD.progression.starsFor(wallRatio) : 0,
        killCopper: this.killCopper,
        earlyCopper: this.earlyCopper,
        kills: this.kills,
        time: this.time,
        charm: this.charm,
        copperBonus: this.mods.copperBonus,
        supplies: this.supplyPicked.slice(),
        killsByType: Object.assign({}, this.killsByType),
        interrupts: this.interrupts,
        earlyCalls: this.earlyCalls,
        skillsCarried: this.skills.length,
        itemsUsed: this.itemsUsed.slice(),
        wave: this.waveIndex + 1,
        // 无尽模式：清完的波数（最后一波没打完不算）
        wavesCleared: win ? this.waveIndex + 1 : Math.max(0, this.waveIndex + (this.waveState === 'waiting' && this.aliveCount() === 0 ? 1 : 0)),
      };
      this.emit(win ? 'win' : 'lose', this.result);
      this.emit('end', this.result);
    }

    // 无头运行到结束（用于模拟）
    runToEnd(maxTime) {
      const dt = 1 / C.tickRate;
      maxTime = maxTime || 1200;
      while (!this.over && this.time < maxTime) {
        if (this.pendingSupply) this.chooseSupply(this.botSupplyChoice(this.pendingSupply));
        this.step(dt);
      }
      if (!this.over) this.finish(false);
      return this.result;
    }
  }

  TD.Battle = Battle;
})((globalThis.TD = globalThis.TD || {}));
