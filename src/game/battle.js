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
      this.levelNo = opts.level;
      this.level = D.levels[opts.level];
      this.D = C.difficulty(opts.level);
      this.stats = opts.stats;
      this.rng = TD.util.rng(opts.seed || Date.now());
      this.lanes = this.level.lanes;
      this.time = 0;
      this.over = false;
      this.result = null;

      this.wall = { hp: this.stats.wallMax, max: this.stats.wallMax };
      this.monsters = [];
      this.projectiles = [];
      this.laneEffects = []; // {lane, type:'frost'|'freeze', until}
      this.buffs = []; // {aspd, until, src}
      this.target = opts.loadout.target || 'nearest';
      this.autoCast = !!opts.loadout.autoCast;
      this.autoItems = !!opts.autoItems;

      this.skills = (opts.loadout.active || []).map((id) => ({ id, def: D.activeSkills[id], cd: 0 }));
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

      this.killCopper = 0;
      this.earlyCopper = 0;
      this.kills = 0;
      this.damageDealt = 0;
      this.wallDamageTaken = 0;
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
      const groups = wave.groups.map(([type, count]) => ({ type, left: count }));
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
      this.spawnGap = wave.gap;
      this.spawnTimer = 0;
      this.waveState = 'spawning';
      this.waveStartTime = this.time;
      this.clearedOnce = false;
      this.emit('waveStart', { index: i, total: this.totalWaves });
    }

    endWaveHeal() {
      if (this.stats.mend > 0 && this.waveIndex >= 0) this.healWall(this.wall.max * this.stats.mend, 'mend');
    }

    callNextWave() {
      if (this.waveState !== 'waiting' || this.waveIndex >= this.totalWaves - 1) return -1;
      const bonus = Math.floor(this.countdown) * C.earlyCallCopperPerSec;
      this.earlyCopper += bonus;
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
          this.spawnMonster(this.spawnQueue.shift());
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
        this.countdown -= dt;
        if (this.countdown <= 0) {
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
      if (lane === undefined) lane = def.boss ? Math.floor(this.lanes / 2) : this.rng.int(this.lanes);
      const hp = Math.round(def.hp * this.D);
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
      }
      this.monsters.push(m);
      this.emit('spawn', m);
      return m;
    }

    isTargetable(m) {
      return !m.dead && m.x <= C.width + 5;
    }

    monsterSpeed(m) {
      if (this.time < m.frozenUntil || this.time < m.stunUntil) return 0;
      let s = m.def.speed;
      if (m.ai && m.ai.phase === 3) s *= D.boarKing.enrageSpeedMult;
      if (this.time < m.hasteUntil) s *= 1 + m.hasteAmt;
      let slow = this.time < m.slowUntil ? m.slowAmt : 0;
      for (const e of this.laneEffects) {
        if (e.lane === m.lane && this.time < e.until) {
          if (e.type === 'freeze') return 0;
          if (e.type === 'frost') slow = Math.max(slow, e.slow);
        }
      }
      return s * (1 - slow);
    }

    wallStopX(m) {
      return C.wallX + m.def.size * 0.6 + (m.def.flying ? 4 : 0);
    }

    updateMonsters(dt) {
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
          this.updateBoarKing(m, dt);
          if (m.dead) continue;
          if (m.ai.mode !== 'walk') continue;
        }
        const stopX = this.wallStopX(m);
        if (m.x > stopX) {
          m.state = 'walk';
          m.x = Math.max(stopX, m.x - this.monsterSpeed(m) * dt);
        } else {
          m.state = 'attack';
          if (this.time >= m.frozenUntil && this.time >= m.stunUntil) {
            m.attackTimer -= dt;
            if (m.attackTimer <= 0) {
              m.attackTimer += 1;
              this.hitWall(m.dps, m);
              if (this.stats.thorns > 0 && !m.dead) {
                this.damage(m, this.stats.atk * this.stats.thorns, { type: 'magic', fromFront: false, source: 'thorns' });
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

    // 冲锋期间累计伤害，达到阈值就打断
    onBossDamaged(m, dmg) {
      const ai = m.ai;
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

    hitWall(amount, m, big) {
      const dmg = amount * (1 - this.stats.wallDr);
      this.wall.hp = Math.max(0, this.wall.hp - dmg);
      this.wallDamageTaken += dmg;
      this.emit('wallHit', { amount: dmg, m, big: !!big });
      if (this.wall.hp <= 0) this.finish(false);
    }

    healWall(amount, src) {
      const before = this.wall.hp;
      this.wall.hp = Math.min(this.wall.max, this.wall.hp + amount);
      this.emit('wallHeal', { amount: this.wall.hp - before, src });
    }

    // ---------- 伤害 ----------
    armorFactor(m, fromFront) {
      let armor = (m.def.armor || 0) + (fromFront ? m.def.frontArmor || 0 : 0);
      if (this.stats.passives.pierceArmor) armor *= 1 - D.passiveSkills.pierceArmor.ignore;
      return 1 - armor / (armor + 100);
    }

    // opts: { type: 'phys'|'magic', fromFront, crit, source }
    damage(m, amount, opts) {
      if (m.dead) return 0;
      let armor = 0;
      if (opts.type !== 'magic') {
        armor = (m.def.armor || 0) + (opts.fromFront ? m.def.frontArmor || 0 : 0);
        if (this.stats.passives.pierceArmor && opts.source !== 'thorns') armor *= 1 - D.passiveSkills.pierceArmor.ignore;
      } else {
        armor = m.def.mres || 0;
      }
      const dmg = Math.max(1, amount * (1 - armor / (armor + 100)));
      m.hp -= dmg;
      m.hitFlash = 0.12;
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
      if (m.hp <= 0) this.kill(m);
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

    kill(m) {
      m.dead = true;
      m.hp = 0;
      m.diedAt = this.time;
      this.kills++;
      this.killCopper += m.def.copper;
      this.emit('death', { m, copper: m.def.copper });
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
    }

    // ---------- 英雄 ----------
    currentAspd() {
      let bonus = 0;
      for (const b of this.buffs) if (this.time < b.until) bonus += b.aspd;
      return this.stats.aspd * (1 + bonus);
    }

    inRange(m) {
      return m.x <= C.wallX + this.stats.range;
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
      else list.sort(byX);
      return list;
    }

    rollHit(mult) {
      let dmg = this.stats.atk * this.stats.weaponMult * mult;
      const crit = this.rng() < this.stats.crit;
      if (crit) dmg *= this.stats.critDmg;
      return { dmg, crit };
    }

    updateHero(dt) {
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

    fire(targets) {
      const w = D.weapons[this.stats.weapon];
      const sx = C.heroX + 26;
      const sy = this.heroY - 46;
      const t0 = targets[0];
      this.hero.aimX = t0.x;
      this.hero.aimY = t0.y + t0.yOffset;
      this.hero.shotAt = this.time;
      if (w.boomerang) {
        const lane = t0.lane;
        this.projectiles.push({
          kind: 'boomerang',
          lane,
          x: C.wallX,
          y: this.laneY(lane),
          dir: 1,
          speed: w.projSpeed,
          maxX: C.wallX + this.stats.range,
          hitOut: new Set(),
          hitBack: new Set(),
          spin: 0,
        });
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
        s.m.pending += roll.dmg * this.armorFactor(s.m, true);
        this.projectiles.push({
          kind: this.stats.weapon === 'crossbow' ? 'bolt' : 'arrow',
          x: sx,
          y: sy,
          target: s.m,
          tx: s.m.x,
          ty: s.m.y + s.m.yOffset,
          speed: w.projSpeed,
          dmg: roll.dmg,
          crit: roll.crit,
          angle: 0,
        });
      }
      this.emit('shoot', { weapon: this.stats.weapon });
    }

    applyWeaponHit(m, dmg, crit, fromFront) {
      this.damage(m, dmg, { type: 'phys', fromFront, crit, source: 'weapon' });
      if (this.stats.passives.burn && !m.dead) {
        const b = D.passiveSkills.burn;
        if (this.time >= m.burnUntil) m.burnTick = 0.5;
        m.burnUntil = this.time + b.duration;
        m.burnDps = (this.stats.atk * b.atkMult) / b.duration;
      }
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
        if (!m.dead) {
          p.tx = m.x;
          p.ty = m.y + m.yOffset;
        }
        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        const dist = Math.hypot(dx, dy);
        const step = p.speed * dt;
        p.angle = Math.atan2(dy, dx);
        if (dist <= step + 4) {
          p.done = true;
          m.pending = Math.max(0, m.pending - p.dmg);
          if (!m.dead) this.applyWeaponHit(m, p.dmg, p.crit, true);
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
      return s && s.cd <= 0 && !this.over && this.waveState !== 'prepare';
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
      const atk = this.stats.atk;
      switch (s.id) {
        case 'drum':
          this.buffs.push({ aspd: def.aspdBonus, until: this.time + def.duration, src: 'drum' });
          break;
        case 'repair':
          this.healWall(this.wall.max * def.healRatio, 'repair');
          break;
        case 'arrowRain':
          this.rain = { left: def.arrows, every: def.duration / def.arrows, timer: 0, dmg: atk * def.atkMult };
          break;
        case 'frost':
          this.laneEffects.push({ lane, type: 'frost', slow: def.slow, until: this.time + def.duration, start: this.time });
          break;
        case 'thunder': {
          let best = null;
          for (const m of this.monsters) if (this.isTargetable(m) && (!best || m.hp > best.hp)) best = m;
          if (!best) return false;
          this.emit('thunder', { x: best.x, y: best.y + best.yOffset });
          this.damage(best, atk * def.atkMult, { type: 'magic', fromFront: false, source: 'thunder' });
          break;
        }
      }
      s.cd = def.cd;
      this.emit('skill', { id: s.id, lane });
      return true;
    }

    useItem(i, lane) {
      const it = this.items[i];
      if (!it || it.used || this.over || this.waveState === 'prepare') return false;
      const def = it.def;
      if (def.targetLane && lane === undefined) lane = this.bestLane();
      const atk = this.stats.atk;
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
              go = wallRatio < 0.6;
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
              go = all.some((m) => m.hp >= this.stats.atk * 4) || this.monsters.some((m) => m.ai && m.ai.mode === 'warn');
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
              go = wallRatio < 0.45;
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
      if (this.over) return;
      this.time += dt;
      for (const s of this.skills) if (s.cd > 0) s.cd = Math.max(0, s.cd - dt);
      if (this.buffs.length && this.buffs[0].until < this.time) this.buffs = this.buffs.filter((b) => b.until >= this.time);
      if (this.laneEffects.length) this.laneEffects = this.laneEffects.filter((e) => e.until >= this.time);
      this.updateWaves(dt);
      if (this.over) return;
      this.updateMonsters(dt);
      if (this.over) return;
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
        itemsUsed: this.itemsUsed.slice(),
        wave: this.waveIndex + 1,
      };
      this.emit(win ? 'win' : 'lose', this.result);
      this.emit('end', this.result);
    }

    // 无头运行到结束（用于模拟）
    runToEnd(maxTime) {
      const dt = 1 / C.tickRate;
      maxTime = maxTime || 1200;
      while (!this.over && this.time < maxTime) this.step(dt);
      if (!this.over) this.finish(false);
      return this.result;
    }
  }

  TD.Battle = Battle;
})((globalThis.TD = globalThis.TD || {}));
