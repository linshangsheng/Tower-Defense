// 战斗逻辑（与画面完全分离，可在 Node 中无头运行，设计书 2 章、9 章、13.2）
(function (TD) {
  'use strict';

  const C = TD.config;
  const D = TD.data;

  let nextId = 1;

  // 技能协同（设计书 45）
  const SYNERGY = { shatter: D.synergies.shatter.mult, drumRain: D.synergies.drumRain.mult };
  const AUTO_ORDER = { drum: 1, frost: 2, repair: 3, arrowRain: 4, thunder: 5 };
  // 英雄自己的攻击（受盾龟护卫影响）：武器、溅射、连锁闪电
  const HERO_SOURCES = { weapon: true, splash: true, chain: true, zap: true };

  // 连击提示（设计书 38.2）
  const STREAK_CALLS = { 10: '10 连击！', 20: '横扫千军！', 30: '势不可挡！', 50: '无人能挡！' };

  // Boss AI 的 update 方法名（实现在 src/game/bosses.js）
  const BOSS_UPDATE = {
    boarKing: 'updateBoarKing',
    kingScorpion: 'updateKingScorpion',
    pharaoh: 'updatePharaoh',
    boneMage: 'updateBoneMage',
    witch: 'updateWitch',
    iceGiant: 'updateIceGiant',
    frostQueen: 'updateFrostQueen',
    rockGolem: 'updateRockGolem',
    inkBoss: 'updateInkBoss',
    windGiant: 'updateWindGiant',
    thunderKing: 'updateThunderKing',
    pearlClam: 'updatePearlClam',
    octoKing: 'updateOctoKing',
  };

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
      const diff = C.difficulties[opts.difficulty || 'normal'] || C.difficulties.normal;
      this.diffHp = 1 + diff.hp;
      this.diffDmg = 1 + diff.dmg;
      this.stats = opts.stats;
      this.rng = TD.util.rng(opts.seed || Date.now());
      this.lanes = this.level.lanes;
      this.time = 0;
      this.over = false;
      this.result = null;

      this.rally = opts.rally || 0; // 援军鼓舞（设计书 27.5）
      const wallMult = (1 + (this.rules.wallHp || 0)) * (this.rules.wallHalf ? 0.5 : 1) * (1 + this.rally);
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
      this.mods = { atkMult: 0, aspdMult: 0, crit: 0, critDmg: 0, cdMult: 0, copperBonus: 0, wallDr: 0, range: 0, slowOnHit: 0, magicMult: 0, armorIgnore: 0, dotReduce: 0, spiritPierce: 0, chillResist: 0, igniteOnHit: 0, fireproof: 0, reveal: 0, woolCut: 0, stunImmune: 0, dodgeCut: 0, slowAll: 0, shellCut: 0, pinPop: 0, leapCut: 0, bossDmg: 0, flyDmg: 0, slowedDmg: 0, igniteChance: 0, darkSight: 0, frostExt: 0, mendBonus: 0, lowWallAtk: 0, healBonus: 0, waveShield: 0 };
      // 装备和套装的特殊效果（设计书 58）
      const gm = this.stats.gearMods || {};
      for (const k of Object.keys(gm)) this.mods[k] = (this.mods[k] || 0) + gm[k];
      this.zapCount = 0;
      // 助战伙伴（设计书 51）
      this.buddy = (opts.loadout && opts.loadout.buddy && D.town.find((f) => f.boss === opts.loadout.buddy)) || null;
      if (this.buddy) {
        const pk = this.buddy.perk;
        for (const k of Object.keys(pk.mods || {})) this.mods[k] += pk.mods[k];
        if (pk.shot) this.buddyTimer = pk.shot.every;
      }
      this.storm = false; // 雷雷第三阶段的暴风雨：全场怪物加速（设计书 33.3）
      this.whirl = false; // 波波第三阶段的大漩涡（设计书 52.3）
      this.guards = []; // 活着的盾龟（设计书 52.2）
      this.bubblesPopped = 0;
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
      this.skillsCast = 0; // 关卡任务（设计书 36）
      this.combos = {}; // 技能协同触发次数（设计书 45）
      this.streak = 0; // 连击（设计书 38.2）
      this.bestStreak = 0;
      this.lastKillAt = -99;
      this.minWallRatio = 1;
      this.on('bossInterrupt', () => this.interrupts++);

      this.killCopper = 0;
      this.earlyCopper = 0;
      this.kills = 0;
      this.damageDealt = 0;
      this.wallDamageTaken = 0;
      // 战斗报告（设计书 32）
      this.report = { bySource: {}, raw: { phys: 0, magic: 0 }, real: { phys: 0, magic: 0 }, wallBy: {} };
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
      // 背水徽章：城墙血量低于 50% 时攻击力提高（设计书 58.3）
      const low = this.mods.lowWallAtk && this.wall.hp < this.wall.max * 0.5 ? this.mods.lowWallAtk : 0;
      return this.stats.atk * (1 + this.mods.atkMult + low) * (1 + this.rally);
    }

    get range() {
      // 暗夜射程 −30%；夜枭盔把惩罚减半
      const dark = this.level.dark ? 1 - 0.3 * (1 - Math.min(1, this.mods.darkSight || 0)) : 1;
      return this.stats.range * (1 + this.mods.range) * dark;
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
      // 贝贝的泡泡护盾（设计书 52.7）：每波开始时刷新
      if (this.buddy && this.buddy.perk.wallBubble) this.wallShield = this.wall.max * this.buddy.perk.wallBubble;
      // 潮汐套装（设计书 58.4）：和贝贝的护盾不叠加，取大的
      if (this.mods.waveShield) this.wallShield = Math.max(this.wallShield || 0, this.wall.max * this.mods.waveShield);
      this.emit('waveStart', { index: i, total: this.totalWaves, chapter: wave.chapter });
    }

    endWaveHeal() {
      const mend = this.stats.mend + (this.mods.mendBonus || 0);
      if (mend > 0 && this.waveIndex >= 0) this.healWall(this.wall.max * mend, 'mend');
      if (this.buddy && this.buddy.perk.waveHeal && this.waveIndex >= 0) this.healWall(this.wall.max * this.buddy.perk.waveHeal, 'buddy');
    }

    callNextWave() {
      if (this.waveState !== 'waiting' || this.waveIndex >= this.totalWaves - 1) return -1;
      const bonus = Math.floor(this.countdown) * C.earlyCallCopperPerSec * (1 + (this.rules.earlyMult || 0));
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
        const bossHold = (this.level.endless || this.level.bossRush) && this.monsters.some((m) => m.def.boss && !m.dead);
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
      if (lane === undefined && def.boss) {
        // Boss 走中间车道；已经有 Boss 在中间时（精英挑战两两出场）换到旁边的车道
        const mid = Math.floor(this.lanes / 2);
        const taken = (l) => this.monsters.some((o) => !o.dead && o.def.boss && o.lane === l);
        lane = [mid, mid - 1, mid + 1, mid - 2, mid + 2].find((l) => l >= 0 && l < this.lanes && !taken(l));
        if (lane === undefined) lane = mid;
      }
      if (lane === undefined) lane = this.rng.int(this.lanes);
      // bossHp：精英挑战里回归的小 Boss 是强化版（设计书 29.2）
      const bossMult = def.boss ? 1 + (this.level.bossHp || 0) : 1;
      const hp = Math.round(def.hp * this.D * (1 + (this.rules.monsterHp || 0)) * this.diffHp * bossMult);
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
      if (def.ai) this.initBossAI(m);
      if (def.healer) m.healTimer = 1;
      // 云朵羊：先扣羊毛（设计书 33.2）
      if (def.wool) m.wool = m.woolMax = hp * def.wool.ratio * (1 - Math.min(1, this.mods.woolCut));
      if (def.ranged) m.rangedTimer = 0.8;
      if (def.laneHop) m.hopTimer = def.laneHop.every * (0.6 + this.rng() * 0.6);
      if (def.regen) m.lastHit = -99;
      // 第七章（设计书 52.2）
      if (def.shell) {
        m.shellHits = 0;
        m.shellUntil = 0;
      }
      if (def.leap) {
        m.leapTimer = def.leap.every * (0.5 + this.rng() * 0.5);
        m.leapUntil = 0;
      }
      if (def.bubbler) m.bubbleTimer = 1;
      if (def.stealth) {
        m.stealthed = true;
        m.hopTimer = def.stealth.hopEvery;
      }
      this.monsters.push(m);
      this.emit('spawn', m);
      return m;
    }

    isTargetable(m) {
      return !m.dead && !m.burrowed && !m.bones && !m.hidden && !m.stealthed && !(m.leapUntil > this.time) && m.x <= C.width + 5;
    }

    monsterSpeed(m) {
      if (this.time < m.frozenUntil || this.time < m.stunUntil || this.time < m.shellUntil) return 0;
      let s = m.def.speed * (1 + (this.rules.monsterSpeed || 0));
      if (m.def.ai === 'boarKing' && m.ai.phase === 3) s *= D.boarKing.enrageSpeedMult;
      if (m.burrowed && m.def.burrow) s *= m.def.burrow.speedMult;
      if (m.def.ai === 'pharaoh' && m.ai.phase === 3) s *= D.pharaoh.phase3SpeedMult;
      if (m.cooked) s *= 1 + D.witch.cookSpeed;
      if (m.sheared) s *= m.def.wool.speedMult;
      if (this.storm && !m.def.boss) s *= 1 + D.thunderKing.stormSpeed;
      if (this.whirl && !m.def.boss) s *= 1 + D.octoKing.whirlSpeed;
      if (this.mods.slowAll) s *= 1 - this.mods.slowAll;
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
      this.guards.length = 0;
      for (const m of this.monsters) if (!m.dead && m.def.guard && m.x <= C.width) this.guards.push(m);
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
          const upd = BOSS_UPDATE[m.def.ai];
          if (upd) this[upd](m, dt);
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
        // 跳跃（飞鱼）：空中无法被攻击，落地前不做别的事
        const lp = m.def.leap;
        if (lp) {
          if (this.time < m.leapUntil) {
            m.x = Math.max(this.wallStopX(m), m.x - (m.leapDist / lp.time) * dt);
            m.state = 'leap';
            continue;
          }
          if (this.time >= m.frozenUntil && this.time >= m.stunUntil) m.leapTimer -= dt;
          const dist = lp.dist * (1 - Math.min(1, this.mods.leapCut));
          if (m.leapTimer <= 0 && m.x <= C.width && m.x - dist > this.wallStopX(m) + 20) {
            m.leapTimer = lp.every;
            m.leapUntil = this.time + lp.time;
            m.leapDist = dist;
            m.leapFrom = m.x;
            this.emit('leap', { m });
          }
        }
        // 吹泡泡（海马）：给最靠近城墙、还没有泡泡的一只怪套上泡泡
        const bub = m.def.bubbler;
        if (bub && m.x <= bub.holdX && this.time >= m.frozenUntil && this.time >= m.stunUntil) {
          m.bubbleTimer -= dt;
          if (m.bubbleTimer <= 0) {
            m.bubbleTimer = bub.every;
            let best = null;
            for (const o of this.monsters) {
              if (o.dead || o === m || o.bubble || o.def.boss || o.def.bossPart || o.x > C.width) continue;
              const dx = o.x - m.x;
              const dy = o.y - m.y;
              if (dx * dx + dy * dy > bub.radius * bub.radius) continue;
              if (!best || o.x < best.x) best = o;
            }
            if (best) {
              best.bubble = true;
              this.emit('bubble', { from: m, m: best });
            }
          }
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
        const stopX = heal ? heal.holdX : ranged ? ranged.holdX : chillDef ? chillDef.holdX : bub ? bub.holdX : this.wallStopX(m);
        if (m.x > stopX) {
          m.state = 'walk';
          m.x = Math.max(stopX, m.x - this.monsterSpeed(m) * dt);
        } else if (heal || chillDef || bub) {
          m.state = 'hold';
        } else if (ranged) {
          // 远程型：停在远处向城墙吐毒液
          m.state = 'hold';
          if (this.time >= m.frozenUntil && this.time >= m.stunUntil) {
            m.rangedTimer -= dt;
            if (m.rangedTimer <= 0) {
              m.rangedTimer = ranged.every;
              this.emit(m.def.bossPart ? 'slap' : 'spit', { m, x: m.x, y: m.y });
              this.hitWall(ranged.damage * this.D, m);
              if (ranged.poison) this.addWallDot(ranged.poison.dps * this.D, ranged.poison.duration, 'poison', true, m.type);
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

    // 英雄被震晕 / 电麻；"避雷针"补给免疫（设计书 33.4）
    stunHero(duration) {
      if (this.mods.stunImmune) {
        this.emit('stunBlocked', {});
        return;
      }
      this.heroStunUntil = Math.max(this.heroStunUntil, this.time + duration);
    }

    // 城墙持续伤害（毒液、毒雾）。refresh=true 时同来源只刷新时间不叠加
    // who：施加持续伤害的怪物种类（战斗报告用）
    addWallDot(dps, duration, src, refresh, who) {
      if (refresh) {
        const e = this.wallDots.find((d) => d.src === src && d.until > this.time);
        if (e) {
          e.until = this.time + duration;
          e.dps = Math.max(e.dps, dps);
          return;
        }
      }
      this.wallDots.push({ dps, until: this.time + duration, src, who });
    }

    updateWallDots(dt) {
      if (!this.wallDots.length) return;
      this.dotTick -= dt;
      if (this.dotTick > 0) return;
      this.dotTick += 0.5;
      const byWho = {};
      for (const d of this.wallDots) if (this.time < d.until) byWho[d.who || 'boss'] = (byWho[d.who || 'boss'] || 0) + d.dps * 0.5;
      this.wallDots = this.wallDots.filter((d) => this.time < d.until);
      for (const who of Object.keys(byWho)) {
        if (this.over) break;
        this.hitWall(byWho[who] * (1 - Math.min(0.9, this.mods.dotReduce)), null, false, 'dot', who);
      }
    }

    hitWall(amount, m, big, kind, who) {
      amount *= this.diffDmg;
      const temp = this.time < this.tempDr.until ? this.tempDr.amt : 0;
      let dmg = amount * (1 - Math.min(0.8, this.stats.wallDr + this.mods.wallDr + temp));
      if (this.wallShield > 0) {
        const take = Math.min(this.wallShield, dmg);
        this.wallShield -= take;
        dmg -= take;
        if (this.wallShield <= 0) this.emit('wallBubblePop', {});
        if (dmg <= 0) return;
      }
      this.wall.hp = Math.max(0, this.wall.hp - dmg);
      this.minWallRatio = Math.min(this.minWallRatio, this.wall.hp / this.wall.max);
      this.wallDamageTaken += dmg;
      const by = who || (m && m.type) || 'boss';
      this.report.wallBy[by] = (this.report.wallBy[by] || 0) + dmg;
      this.emit('wallHit', { amount: dmg, m, big: !!big, kind });
      if (this.wall.hp <= 0) this.finish(false);
    }

    healWall(amount, src) {
      if (this.time < this.wallSealedUntil) {
        this.emit('healBlocked', { src });
        return;
      }
      const before = this.wall.hp;
      amount *= 1 + (this.mods.healBonus || 0);
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
      // 闪避（风筝怪）：只躲武器的物理普通攻击（设计书 33.2）
      if (m.def.dodge && opts.source === 'weapon' && opts.type !== 'magic' && this.rng() < Math.max(0, m.def.dodge - this.mods.dodgeCut)) {
        this.emit('dodge', { m, x: m.x, y: m.y + m.yOffset });
        return 0;
      }
      // 泡泡（海马）：挡住下一次伤害（设计书 52.2）
      if (m.bubble) {
        m.bubble = false;
        this.bubblesPopped++;
        this.emit('bubblePop', { m, x: m.x, y: m.y + m.yOffset });
        if (!this.mods.pinPop) return 0;
        amount *= 1 - Math.min(1, this.mods.pinPop);
      }
      if (opts.type === 'magic' && opts.source !== 'thorns') amount *= 1 + this.mods.magicMult;
      if (m.vulnUntil && this.time < m.vulnUntil) amount *= D.inkBoss.vulnMult;
      amount *= this.damageMult(m, opts);
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
      // 羊毛（云朵羊）：先扣羊毛，剃光后加速
      if (m.wool > 0) {
        const take = Math.min(m.wool, amount);
        m.wool -= take;
        amount -= take;
        m.hitFlash = 0.08;
        this.report.bySource[opts.source || 'weapon'] = (this.report.bySource[opts.source || 'weapon'] || 0) + take;
        this.emit('woolHit', { m, x: m.x, y: m.y + m.yOffset, dmg: take });
        if (m.wool <= 0) {
          m.sheared = true;
          this.emit('shear', { m });
        }
        if (amount <= 0) return 0;
      }
      const raw = amount;
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
      const rp = this.report;
      const kind = opts.type === 'magic' ? 'magic' : 'phys';
      rp.bySource[opts.source || 'weapon'] = (rp.bySource[opts.source || 'weapon'] || 0) + dmg;
      rp.raw[kind] += Math.max(raw, dmg);
      rp.real[kind] += dmg;
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

    // 第七章的减伤 / 增伤（设计书 52.2、52.3）
    damageMult(m, opts) {
      let k = 1;
      const def = m.def;
      // 护卫（盾龟）：周围的其他怪物受到英雄攻击的伤害降低，多只不叠加
      if (this.guards.length && !def.boss && !def.guard && HERO_SOURCES[opts.source || 'weapon']) {
        for (const g of this.guards) {
          if (g.dead) continue;
          const r = g.def.guard.radius;
          const dx = g.x - m.x;
          const dy = g.y - m.y;
          if (dx * dx + dy * dy <= r * r) {
            k *= g.def.guard.mult;
            break;
          }
        }
      }
      // 缩壳（寄居蟹）：每挨几下就缩进壳里；灼烧不计数
      if (def.shell) {
        if (this.time < m.shellUntil) k *= def.shell.mult;
        else if (opts.source !== 'burn' && !opts.peek && ++m.shellHits >= def.shell.hits) {
          m.shellHits = 0;
          m.shellUntil = this.time + def.shell.duration * (1 - Math.min(1, this.mods.shellCut));
          this.emit('shell', { m });
        }
      }
      if (def.ai === 'pearlClam' && m.ai.mode !== 'walk') k *= m.ai.open ? D.pearlClam.openMult : D.pearlClam.closedMult;
      if (def.ai === 'octoKing' && m.ai.guarded) k *= D.octoKing.guardMult;
      // 装备特长（设计书 58.3）：荆棘反伤不算
      if (opts.source !== 'thorns') {
        if (this.mods.bossDmg && (def.boss || def.bossPart)) k *= 1 + this.mods.bossDmg;
        if (this.mods.flyDmg && def.flying) k *= 1 + this.mods.flyDmg;
        if (this.mods.slowedDmg && (this.time < m.slowUntil || this.inFrost(m))) k *= 1 + this.mods.slowedDmg;
      }
      return k;
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
        // 连击：1.2 秒内连续击败
        this.streak = this.time - this.lastKillAt <= 1.2 ? this.streak + 1 : 1;
        this.lastKillAt = this.time;
        if (this.streak > this.bestStreak) this.bestStreak = this.streak;
        if (STREAK_CALLS[this.streak]) this.emit('streak', { count: this.streak, text: STREAK_CALLS[this.streak] });
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
      if (m.def.ai === 'thunderKing') this.storm = false; // 雷雷被打败，雨停了
      // 尖刺（海胆）：扎伤周围的怪物，可能连锁（设计书 52.2）
      const sp = m.def.spikes;
      if (sp && !noReward) {
        this.emit('spikes', { x: m.x, y: m.y + m.yOffset, radius: sp.radius });
        for (const o of this.monsters.slice()) {
          if (o.dead || o === m || o.def.bossPart) continue;
          const dx = o.x - m.x;
          const dy = o.y - m.y;
          if (dx * dx + dy * dy <= sp.radius * sp.radius) this.damage(o, sp.damage * this.D, { type: 'magic', fromFront: false, source: 'spikes' });
        }
      }
      if (m.def.ai === 'octoKing') {
        this.whirl = false;
        for (const o of this.monsters) if (!o.dead && o.owner === m) this.kill(o, true);
        this.emit('tentacleRetract', { m });
      }
      // 静电：电麻后 1.5 秒内不会再被电麻，避免一群雷团子把英雄电到动不了
      const ss = m.def.staticShock;
      if (ss && m.x < C.wallX + ss.range && this.time >= (this.staticImmuneUntil || 0)) {
        this.stunHero(ss.stun);
        this.staticImmuneUntil = this.time + ss.stun + 1.5;
        this.emit('staticShock', { m, duration: ss.stun });
      }
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
      else if (mode === 'boss') {
        // 波波有触手护身时先打触手（设计书 52.3）
        const pri = (m) => (m.def.boss ? (m.ai && m.ai.guarded ? 1 : 3) : m.def.bossPart ? 2 : 0);
        list.sort((a, b) => pri(b) - pri(a) || byX(a, b));
      }
      else if (mode === 'smart') {
        // 威胁优先：逼近城墙的先打；城墙安全时优先打辅助型怪物（治疗、光环、远程）
        const danger = (m) => m.x < C.wallX + C.smartDanger;
        const support = (m) => !!(m.def.healer || m.def.chill || m.def.ranged || m.def.guard || m.def.bubbler);
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
      // 叮叮的铃声（设计书 42.2）：每第 N 次攻击眩晕目标周围的普通怪物
      const bell = this.stats.bell;
      if (bell) {
        this.attackCount = (this.attackCount || 0) + 1;
        if (this.attackCount % bell.every === 0) {
          for (const o of this.monsters) {
            if (o.dead || o.def.boss) continue;
            const dx = o.x - t0.x;
            const dy = o.y + o.yOffset - (t0.y + t0.yOffset);
            if (dx * dx + dy * dy <= bell.radius * bell.radius) o.stunUntil = Math.max(o.stunUntil, this.time + bell.stun);
          }
          this.emit('bell', { x: t0.x, y: t0.y + t0.yOffset, radius: bell.radius });
        }
      }
      this.hero.aimX = t0.x;
      this.hero.aimY = t0.y + t0.yOffset;
      this.hero.shotAt = this.time;
      // 雷鸣箭袋（设计书 58.3）：每第 N 次攻击落下一道小闪电
      const zap = this.stats.zap;
      if (zap && ++this.zapCount % zap.every === 0) {
        this.emit('gearZap', { x: t0.x, y: t0.y + t0.yOffset });
        // 目标被闪电打死时，箭照常射出（飞到原位置落空），不影响后面的攻击节奏
        this.damage(t0, this.atk * zap.atkMult, { type: 'magic', fromFront: false, source: 'zap' });
      }
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
          pierce: w.pierce,
          knock: w.knock,
          bossMult: w.bossMult,
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
      if (p && p.bossMult && (m.def.boss || m.def.bossPart)) dmg *= p.bossMult;
      this.damage(m, dmg, { type, fromFront, crit, source: 'weapon', armorIgnore: p ? p.armorIgnore : 0 });
      if (this.stats.passives.burn && !m.dead) {
        const b = D.passiveSkills.burn;
        if (this.time >= m.burnUntil) m.burnTick = 0.5;
        m.burnUntil = this.time + b.duration;
        m.burnDps = (this.atk * b.atkMult) / b.duration;
      }
      if (this.mods.igniteOnHit && !m.dead) this.ignite(m);
      else if (this.mods.igniteChance && !m.dead && this.rng() < this.mods.igniteChance) this.ignite(m);
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

    // 穿云箭（木弓专精，设计书 53）：继续命中同一车道后方的怪
    pierceFrom(first, p) {
      const pc = p.pierce;
      const behind = this.monsters
        .filter((o) => o.id !== first.id && o.lane === first.lane && this.isTargetable(o) && o.x > first.x && o.x - first.x <= pc.range)
        .sort((a, b) => a.x - b.x)
        .slice(0, pc.count);
      if (!behind.length) return;
      this.emit('pierce', { x0: first.x, x1: behind[behind.length - 1].x, y: this.laneY(first.lane) - 20 });
      for (const o of behind) this.applyWeaponHit(o, p.dmg * pc.mult, p.crit, true, p);
    }

    // 震地炮（火炮专精，设计书 53）：把爆炸范围内的小怪向后震退并减速
    knockAt(x, y, p, primary) {
      const k = p.knock;
      const r = p.splash ? p.splash.radius : 60;
      for (const o of this.monsters) {
        if (o.dead || o.def.boss || o.def.bossPart) continue;
        const dx = o.x - x;
        const dy = o.y + o.yOffset - y;
        if (dx * dx + dy * dy > r * r && o !== primary) continue;
        o.x = Math.min(C.spawnX, o.x + k.dist);
        const prev = this.time < o.slowUntil ? o.slowAmt : 0;
        o.slowAmt = Math.max(prev, k.slow);
        o.slowUntil = Math.max(o.slowUntil, this.time + k.duration);
      }
      this.emit('knock', { x, y, r });
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
          if (p.pierce && !m.dead) this.pierceFrom(m, p);
          else if (p.pierce) this.pierceFrom({ x: p.tx, lane: m.lane, id: m.id }, p);
          if (p.splash) this.splashAt(p.tx, p.ty, p, m);
          if (p.knock) this.knockAt(p.tx, p.ty, p, m);
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
        case 'arrowRain': {
          // 协同"鼓点箭雨"（设计书 45）：战鼓生效期间箭数 +50%
          const drum = this.buffs.some((b) => b.src === 'drum' && this.time < b.until);
          const arrows = drum ? Math.round(def.arrows * SYNERGY.drumRain) : def.arrows;
          this.rain = { left: arrows, every: def.duration / arrows, timer: 0, dmg: atk * def.atkMult, ignite: !!def.ignite };
          if (drum) this.emitCombo('drumRain', C.heroX + 60, this.heroY - 120);
          break;
        }
        case 'frost':
          this.laneEffects.push({ lane, type: 'frost', slow: def.slow, until: this.time + def.duration * (1 + this.mods.frostExt), start: this.time, freezeEnd: def.freezeEnd || 0 });
          break;
        case 'thunder': {
          let best = null;
          for (const m of this.monsters) if (this.isTargetable(m) && (!best || m.hp > best.hp)) best = m;
          if (!best) return false;
          this.emit('thunder', { x: best.x, y: best.y + best.yOffset });
          const bx = best.x;
          const by = best.y;
          // 协同"碎冰"（设计书 45）：打在被冰冻领域减速 / 冰冻的怪身上伤害 ×1.5
          const shatter = (m) => (this.inFrost(m) ? SYNERGY.shatter : 1);
          if (this.inFrost(best)) this.emitCombo('shatter', best.x, best.y + best.yOffset - 40);
          this.damage(best, atk * def.atkMult * shatter(best), { type: 'magic', fromFront: false, source: 'thunder' });
          if (def.chain) {
            const near = this.monsters
              .filter((m) => m !== best && this.isTargetable(m) && Math.hypot(m.x - bx, m.y - by) <= def.chainRange)
              .sort((a, b) => Math.hypot(a.x - bx, a.y - by) - Math.hypot(b.x - bx, b.y - by))
              .slice(0, def.chain);
            for (const m of near) {
              this.emit('thunderChain', { x0: bx, y0: by + best.yOffset, x: m.x, y: m.y + m.yOffset });
              this.damage(m, atk * def.atkMult * def.chainMult * shatter(m), { type: 'magic', fromFront: false, source: 'thunder' });
            }
          }
          break;
        }
      }
      s.cd = def.cd * Math.max(0.3, 1 + this.mods.cdMult);
      this.castCount++;
      this.skillsCast++;
      this.emit('skill', { id: s.id, lane });
      return true;
    }

    // 助战伙伴的主动能力：墨墨的墨团、雷雷的小闪电（设计书 51）
    updateBuddy(dt) {
      const shot = this.buddy.perk.shot;
      this.buddyTimer -= dt;
      if (this.buddyTimer > 0) return;
      const pool = this.monsters.filter((m) => this.isTargetable(m) && this.inRange(m));
      if (!pool.length) {
        this.buddyTimer = 0.5;
        return;
      }
      this.buddyTimer = shot.every;
      const target = shot.pick === 'strongest' ? pool.reduce((a, b) => (b.hp > a.hp ? b : a)) : pool.reduce((a, b) => (b.x < a.x ? b : a));
      this.emit('buddyShot', { buddy: this.buddy.boss, name: shot.name, x: target.x, y: target.y + target.yOffset });
      this.damage(target, this.atk * shot.mult, { type: 'magic', fromFront: false, source: 'buddy' });
    }

    // 怪物是否处在冰冻领域（减速或冰冻）中
    inFrost(m) {
      if (this.time < m.frozenUntil) return true;
      return this.laneEffects.some((e) => e.lane === m.lane && this.time < e.until && (e.type === 'frost' || e.type === 'freeze'));
    }

    emitCombo(id, x, y) {
      this.combos[id] = (this.combos[id] || 0) + 1;
      this.emit('combo', { id, name: D.synergies[id].name + '！', x, y });
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
        case 'freeze': {
          const dur = def.duration * (1 + this.mods.frostExt);
          this.laneEffects.push({ lane, type: 'freeze', until: this.time + dur, start: this.time });
          for (const m of this.monsters) if (m.lane === lane && !m.dead) m.frozenUntil = this.time + dur;
          break;
        }
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
        // 先放战鼓和冰冻领域，再放箭雨和雷霆，这样同一时刻都能放时会触发协同（设计书 45）
        const order = this.skills.map((s, i) => i).sort((a, b) => (AUTO_ORDER[this.skills[a].id] || 9) - (AUTO_ORDER[this.skills[b].id] || 9));
        order.forEach((i) => {
          const s = this.skills[i];
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
            case 'thunder': {
              go = all.some((m) => m.hp >= this.atk * 4) || this.monsters.some((m) => m.ai && m.ai.mode === 'warn');
              // 贝贝合壳、波波有触手护身时先等一等（设计书 52.3）
              const top = all.reduce((a, m) => (!a || m.hp > a.hp ? m : a), null);
              if (top && this.damageMult(top, { source: 'thunder', peek: true }) < 0.5) go = false;
              break;
            }
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
      if (this.buddyTimer !== undefined) this.updateBuddy(dt);
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
        report: TD.util.deepClone(this.report),
        interrupts: this.interrupts,
        earlyCalls: this.earlyCalls,
        skillsCast: this.skillsCast,
        bestStreak: this.bestStreak,
        bubbles: this.bubblesPopped,
        combos: Object.assign({}, this.combos),
        minWallRatio: this.minWallRatio,
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
