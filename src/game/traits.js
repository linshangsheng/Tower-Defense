// 普通怪物的独特技能（设计书 165）：每种怪一个"拿手好戏"，数据在 monsters.js 的 def.trait = { id, ... }
// 实现挂在 Battle 原型上，由 battle.js 在这几个时机调用：出生（initTrait）、每帧（updateTraits / traitSpeedMult）、
// 被打中（traitOnHit）、啃城墙（traitWallDps / traitOnWallHit）、有怪死亡（traitOnKill）。变体怪（echo）直接继承基础怪的 trait。
(function (TD) {
  'use strict';

  const D = TD.data;
  const C0 = TD.config;

  // 战利品（设计书 169）：击败怪物偶尔掉出光球，点一下拾取；不点就消失，不拿也不会输
  const DROPS = {
    purse: { name: '铜钱袋', icon: '💰', ico: 'coinbag', color: '#ffd23f', w: 40 },
    mend: { name: '修墙', icon: '🧱', ico: 'wall', color: '#7fe08a', w: 25 },
    fury: { name: '狂怒', icon: '🔥', ico: 'flame', color: '#ff7a4f', w: 20 },
    gale: { name: '疾风', icon: '💨', ico: 'wind', color: '#8fd8ff', w: 15 },
    frost: { name: '冰封', icon: '❄️', ico: 'snowflake', color: '#b8f0ff', w: 10 },
    reinforce: { name: '援军', icon: '🚩', ico: 'flag', color: '#9ad0ff', w: 8 },
  };
  TD.data.drops = DROPS;
  const DROP_RATE = 0.035;
  const DROP_LIFE = 8;

  Object.assign(TD.Battle.prototype, {
    maybeDrop(m) {
      if (!this.drops) this.drops = [];
      if (this.drops.length >= (m.elite || m.forceDrop ? 6 : 4)) return;
      if (!m.def.boss && !m.elite && !m.forceDrop && !m.treasure && this.rng() >= DROP_RATE * ((this.rules && this.rules.dropMult) || 1)) return;
      let r = this.rng() * 100;
      let kind = 'purse';
      for (const k of Object.keys(DROPS)) {
        r -= DROPS[k].w;
        if (r < 0) { kind = k; break; }
      }
      const y = Math.max(C0.fieldTop + 20, Math.min(C0.fieldBottom - 20, m.y + m.yOffset));
      const x = Math.max(C0.wallX + 60, Math.min(1150, m.x));
      if (m.treasure) kind = 'purse';
      const d = { id: (this.dropNo = (this.dropNo || 0) + 1), amount: m.treasure ? C0.treasure.copper : 0, kind, x, y, born: this.time, until: this.time + DROP_LIFE, copper: m.def.copper };
      this.drops.push(d);
      this.emit('drop', { d });
    },

    // 宝箱哥布林（设计书 182）：主线战斗里隔一阵跑出一只背着钱袋的哥布林，跑得快、血厚，打死必掉大钱袋
    updateTreasure() {
      // 宝箱哥布林跑到城墙边就溜走（不啃墙、不偷钱，纯粹是奖励，不增加难度）
      for (const o of this.monsters) {
        if (o.treasure && !o.dead && o.x <= C0.wallX + 50) {
          o.dead = true;
          o.hp = 0;
          this.emit('treasureEscape', { x: o.x, y: o.y + o.yOffset });
        }
      }
      if (!this.eliteOK || (this.waveState !== 'spawning' && this.waveState !== 'waiting')) return;
      const T = C0.treasure;
      if (this.treasureAt === undefined) this.treasureAt = this.time + T.first;
      if (this.time < this.treasureAt) return;
      this.treasureAt = this.time + T.gapMin + this.rng() * T.gapRand;
      const m = this.spawnMonster('gobling', Math.floor(this.rng() * this.lanes) % this.lanes);
      m.treasure = true;
      m.hp = m.maxHp = Math.round(m.hp * T.hpMult);
      m.speedMult = (m.speedMult || 1) * T.speed;
      this.emit('treasure', { m });
    },

    updateDrops() {
      if (!this.drops || !this.drops.length) return;
      this.drops = this.drops.filter((d) => d.until >= this.time);
    },

    // 点击坐标 (px, py)：拾取最近的光球（半径 55 以内），返回是否拾到
    collectDropAt(px, py) {
      if (!this.drops || !this.drops.length || this.over) return false;
      let best = null;
      let bd = 55 * 55;
      for (const d of this.drops) {
        const dd = (d.x - px) * (d.x - px) + (d.y - py) * (d.y - py);
        if (dd <= bd) { bd = dd; best = d; }
      }
      if (!best) return false;
      this.collectDrop(best);
      return true;
    },

    collectDrop(d) {
      this.drops = this.drops.filter((o) => o !== d);
      this.dropsTaken = (this.dropsTaken || 0) + 1;
      let amount = 0;
      if (d.kind === 'purse') {
        amount = d.amount || Math.max(8, Math.round(d.copper * 6));
        this.killCopper += amount;
      } else if (d.kind === 'mend') {
        this.wall.hp = Math.min(this.wall.max, this.wall.hp + this.wall.max * 0.04);
      } else if (d.kind === 'fury') {
        this.buffs = this.buffs.filter((b) => b.src !== 'dropfury');
        this.buffs.push({ atk: 0.25, until: this.time + 6, src: 'dropfury' });
      } else if (d.kind === 'gale') {
        this.buffs = this.buffs.filter((b) => b.src !== 'dropgale');
        this.buffs.push({ aspd: 0.3, until: this.time + 6, src: 'dropgale' });
      }
      if (d.kind === 'reinforce') {
        // 援军：免费来一个随机兵种的兵（不扣军饷、不进冷却）；没带兵 / 场上已满就折成 50 军饷
        const idx = this.mercsOn && this.mercSlots.length ? this.rng.int(this.mercSlots.length) : -1;
        if (idx >= 0 && this.mercAlive() < C0.merc.cap) {
          this.spawnMerc(idx, this.rng.int(this.lanes));
          d.reinforced = true;
        } else {
          this.funds += 50;
          amount = 50;
        }
      }
      if (d.kind === 'frost') {
        for (const o of this.monsters) {
          if (o.dead || o.def.boss || o.x > 1300) continue;
          o.frozenUntil = Math.max(o.frozenUntil || 0, this.time + 2.5);
        }
      }
      this.emit('dropGet', { d, kind: d.kind, amount });
    },

    initTrait(m) {
      const t = m.def.trait;
      m.tr = { next: this.time + (t.every || 0) * (0.5 + this.rng() * 0.7), wallHits: 0 };
      if (t.id === 'scavenge') this.hasScavenger = true;
    },

    // 冲阵：大块头撞上兵时，把贴身的前排兵击退一段并眩晕（每只怪每 every 秒一次）。
    // def.trample = { every 冷却, kick 击退距离, stun 眩晕秒数 }；盾卫（嘲讽 + 减伤）眩晕时间 ×trampleGuard；
    // 眩晕结束后有 trampleGrace 秒免疫，几只大怪不会把同一个兵锁死。返回是否真的撞到了兵。
    trampleMercs(m, blk) {
      const T = m.def.trample;
      const MC = C0.merc;
      if (!T || this.time < (m.trampleAt || 0) || this.time < m.frozenUntil || this.time < m.stunUntil) return false;
      const reach = MC.contactPad + m.def.size * 0.5 + MC.trampleReach;
      const floor = C0.wallX + 40;
      const hits = [];
      for (const u of this.mercs) {
        if (u.dead || u.lane !== m.lane || this.time < (u.trampleImmune || 0)) continue;
        const gap = m.x - u.x;
        if (gap < -4 || gap > reach) continue;
        const dist = Math.max(0, Math.min(T.kick, u.x - floor));
        const stun = T.stun * (u.def.taunt && u.def.reduce ? MC.trampleGuard : 1);
        u.x -= dist;
        u.knockAt = this.time;
        u.knockDist = dist;
        u.stunUntil = Math.max(u.stunUntil || 0, this.time + stun);
        u.stunDur = stun;
        u.trampleImmune = u.stunUntil + MC.trampleGrace;
        u.charging = false;
        hits.push({ u, dist, stun });
      }
      if (!hits.length) return false;
      m.trampleAt = this.time + T.every;
      this.trampleCount = (this.trampleCount || 0) + 1;
      this.emit('trample', { m, x: m.x, y: m.y + m.yOffset, hits });
      void blk;
      return true;
    },

    traitEmit(m, id, extra) {
      this.emit('trait', Object.assign({ m, id, x: m.x, y: m.y + m.yOffset }, extra || {}));
    },

    // 回声 Boss 的独有变招（设计书 168）：Boss 行动方式沿用原 Boss，再叠加一招
    updateEchoTwist(m) {
      const t = m.def.echoTwist;
      if (!t || m.x > 1150) return;
      if (m.etNext === undefined) m.etNext = this.time + (t.first || t.every);
      if (this.time < m.etNext) return;
      m.etNext = this.time + t.every;
      switch (t.id) {
        case 'curse':
        case 'gale':
          this.buffs = this.buffs.filter((b) => b.src !== 'echo' + t.id);
          this.buffs.push({ aspd: -t.slow, until: this.time + t.dur, src: 'echo' + t.id });
          break;
        case 'sandrush':
          for (const o of this.monsters) {
            if (o.dead || o === m || o.def.boss) continue;
            o.hasteUntil = Math.max(o.hasteUntil || 0, this.time + t.dur);
            o.hasteAmt = Math.max(o.hasteAmt || 0, t.haste);
          }
          break;
        case 'quake':
          this.wallVulnUntil = Math.max(this.wallVulnUntil || 0, this.time + t.dur);
          this.wallVulnAmt = Math.max(this.wallVulnAmt || 0, t.amt);
          break;
        case 'frostbite':
          this.stunHero(t.stun);
          break;
        case 'inkblot':
          this.addWallDot((m.dps || 10) * t.mult, t.dur, 'poison', true, m.type);
          break;
      }
      this.traitEmit(m, 'echo_' + t.id);
    },

    // 精英词缀（设计书 172）：再生每帧回血；迅捷在 monsterSpeed；复仇在 traitOnKill 之后的 eliteOnDeath
    updateElite(m, dt) {
      if (m.affix === 'regen' && m.hp < m.maxHp && !m.dead) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * C0.eliteAffixes.regen.pct * dt);
      if (m.affix === 'summon' && !m.dead && m.x < 1150 && m.x > C0.wallX + 60) {
        const S = C0.eliteAffixes.summon;
        if (m.sumNext === undefined) m.sumNext = this.time + S.first;
        if (this.time < m.sumNext) return;
        m.sumNext = this.time + S.every;
        const n = this.monsters.reduce((c, o) => c + (!o.dead && o.summonedBy === m.id ? 1 : 0), 0);
        if (n >= S.max) return;
        this.noEliteRoll = true;
        const c = this.spawnMonster(m.type, m.lane, Math.min(C0.spawnX, m.x + 30));
        this.noEliteRoll = false;
        c.summonedBy = m.id;
        c.noReward = true;
        this.emit('eliteSummon', { m, c, x: m.x, y: m.y + m.yOffset });
      }
    },

    eliteOnDeath(m) {
      if (m.affix !== 'vengeful') return;
      const a = C0.eliteAffixes.vengeful;
      for (const o of this.monsters) {
        if (o.dead || o === m) continue;
        const dx = o.x - m.x;
        const dy = o.y + o.yOffset - (m.y + m.yOffset);
        if (dx * dx + dy * dy <= a.radius * a.radius) {
          o.hasteUntil = Math.max(o.hasteUntil || 0, this.time + a.dur);
          o.hasteAmt = Math.max(o.hasteAmt || 0, a.haste);
        }
      }
      this.emit('spore', { x: m.x, y: m.y + m.yOffset, radius: a.radius });
    },

    // 每帧：定时类技能
    updateTraits(m, dt) {
      const t = m.def.trait;
      const tr = m.tr;
      if (!tr) return;
      switch (t.id) {
        case 'sprint': // 兔冲冲：每隔几秒猛冲一小段
          if (this.time >= tr.next && m.x < 1180) {
            tr.dashUntil = this.time + t.dur;
            tr.next = this.time + t.every;
            this.traitEmit(m, 'sprint');
          }
          break;
        case 'petrify': // 石像鬼：周期性石化，几乎不受伤
          if (this.time >= tr.next && m.x < 1100) {
            tr.stoneUntil = this.time + t.dur;
            tr.next = this.time + t.every;
            this.traitEmit(m, 'petrify');
          }
          break;
        case 'frostBreath': // 小冰龙：靠近后朝英雄喷一口冰息，攻速下降
          if (this.time >= tr.next && m.x < t.range) {
            tr.next = this.time + t.every;
            this.buffs = this.buffs.filter((b) => b.src !== 'frostbreath');
            this.buffs.push({ aspd: -t.slow, until: this.time + t.dur, src: 'frostbreath' });
            this.traitEmit(m, 'frostBreath');
          }
          break;
        case 'roar': // 雪怪：第一次走到半场时咆哮，周围的怪加速
          if (!tr.roared && m.x < t.at) {
            tr.roared = true;
            for (const o of this.monsters) {
              if (o.dead || o === m || o.def.boss) continue;
              if (Math.abs(o.x - m.x) <= t.radius) {
                o.hasteUntil = Math.max(o.hasteUntil || 0, this.time + t.dur);
                o.hasteAmt = Math.max(o.hasteAmt || 0, t.haste);
              }
            }
            this.traitEmit(m, 'roar', { radius: t.radius });
          }
          break;
        case 'cleanse': // 提灯鬼：灯光驱散身边怪物的冰冻 / 眩晕 / 减速
          if (this.time >= tr.next) {
            tr.next = this.time + t.every;
            let n = 0;
            for (const o of this.monsters) {
              if (o.dead || o === m || Math.abs(o.x - m.x) > t.radius || Math.abs(o.y - m.y) > t.radius) continue;
              if (o.frozenUntil > this.time || o.stunUntil > this.time || o.slowUntil > this.time) {
                o.frozenUntil = Math.min(o.frozenUntil, this.time);
                o.stunUntil = Math.min(o.stunUntil, this.time);
                o.slowUntil = Math.min(o.slowUntil, this.time);
                n++;
              }
            }
            if (n) this.traitEmit(m, 'cleanse', { radius: t.radius });
          }
          break;
        case 'rewrap': // 绷带球：受伤后重新缠紧，护甲暂时增厚
          if (tr.wrapUntil && this.time >= tr.wrapUntil) {
            m.armorMult /= 1 + t.armor;
            tr.wrapUntil = 0;
          }
          break;
        default:
      }
    },

    // 走路速度的倍数
    traitSpeedMult(m) {
      const t = m.def.trait;
      const tr = m.tr;
      if (!tr) return 1;
      if (t.id === 'sprint' && this.time < (tr.dashUntil || 0)) return t.mult;
      if (t.id === 'roll') return Math.min(t.max, 1 + t.grow * (this.time - m.bornAt)); // 小雪团：越滚越快
      if (t.id === 'slide' && m.x > t.fromX) return t.mult; // 企鹅：远处趴着滑
      return 1;
    },

    // 被打中以后
    traitOnHit(m) {
      const t = m.def.trait;
      const tr = m.tr;
      if (!tr) return;
      if (t.id === 'bounce' && this.lanes > 1 && this.rng() < t.chance && m.x < 1150) {
        // 小果冻：被打中会弹到相邻车道
        const dir = m.lane === 0 ? 1 : m.lane === this.lanes - 1 ? -1 : this.rng() < 0.5 ? -1 : 1;
        m.lane += dir;
        m.y = this.laneY(m.lane);
        this.traitEmit(m, 'bounce');
      } else if (t.id === 'rewrap' && !tr.wrapped && m.hp / m.maxHp < t.below) {
        tr.wrapped = true;
        tr.wrapUntil = this.time + t.dur;
        m.armorMult *= 1 + t.armor;
        this.traitEmit(m, 'rewrap');
      }
    },

    // 远程怪射击：弓手每第三箭齐射（伤害翻倍）
    traitShotMult(m) {
      const t = m.def.trait;
      if (t.id === 'volley') {
        m.tr.shots = (m.tr.shots || 0) + 1;
        if (m.tr.shots % t.every === 0) {
          this.traitEmit(m, 'volley');
          return 2;
        }
      }
      return 1;
    },

    // 远程怪射中城墙以后：裂缝、寒气、电麻、火苗
    traitOnShot(m) {
      const t = m.def.trait;
      if (t.id === 'crack') {
        this.wallVulnUntil = this.time + t.dur;
        this.wallVulnAmt = t.amp;
        this.traitEmit(m, 'crack', { x: C0.wallX, y: m.y + m.yOffset });
      } else if (t.id === 'chillShot') {
        this.buffs = this.buffs.filter((b) => b.src !== 'icemage');
        this.buffs.push({ aspd: -t.slow, until: this.time + t.dur, src: 'icemage' });
        this.traitEmit(m, 'chillShot');
      } else if (t.id === 'stormStun') {
        if (this.rng() < t.chance) {
          this.stunHero(t.dur);
          this.traitEmit(m, 'stormStun');
        }
      } else if (t.id === 'blaze') {
        const r = m.def.ranged;
        this.addWallDot(r.damage * t.mult * this.D, t.dur, 'burn', true, m.type);
        this.traitEmit(m, 'blaze');
      }
    },

    // 战车撞墙：震得英雄晃一下（太频繁不触发，免得一群战车把英雄锁死）
    traitOnSlam(m) {
      const t = m.def.trait;
      if (t.id !== 'ram') return;
      if (this.heroStunUntil > 0 && this.time < this.heroStunUntil + t.gap) return;
      this.stunHero(t.stun);
      this.traitEmit(m, 'ram');
    },

    // 啃城墙时每秒的伤害（绿团团越粘越疼）
    traitWallDps(m) {
      const t = m.def.trait;
      if (t.id === 'cling') {
        const k = Math.min(t.max, 1 + t.grow * (m.tr.wallHits || 0));
        return m.dps * k;
      }
      return m.dps;
    },

    // 每次啃到城墙以后
    traitOnWallHit(m) {
      const t = m.def.trait;
      const tr = m.tr;
      if (!tr) return;
      tr.wallHits++;
      if (t.id === 'pilfer') {
        // 小哥布林：每啃一口顺手偷走一点铜币
        const take = Math.min(this.killCopper, Math.max(1, Math.floor(this.killCopper * t.pct)));
        if (take > 0) {
          this.killCopper -= take;
          this.stolen = (this.stolen || 0) + take;
          if (tr.wallHits === 1 || tr.wallHits % 3 === 0) this.traitEmit(m, 'pilfer', { amount: take });
        }
      } else if (t.id === 'sting') {
        // 蜜蜂：毒刺，城墙中毒
        this.addWallDot(m.dps * t.mult, t.dur, 'poison', true, m.type);
        if (tr.wallHits === 1) this.traitEmit(m, 'sting');
      }
    },

    // 有怪物死亡时：秃鹫啄食、小南瓜籽爆
    traitOnKill(dead) {
      const t = dead.def.trait;
      if (t && t.id === 'seedBurst') {
        let any = false;
        for (const o of this.monsters) {
          if (o.dead || o === dead || o.hp >= o.maxHp) continue;
          if (Math.abs(o.x - dead.x) <= t.radius && Math.abs(o.y - dead.y) <= t.radius) {
            o.hp = Math.min(o.maxHp, o.hp + o.maxHp * t.pct);
            any = true;
          }
        }
        if (any) this.traitEmit(dead, 'seedBurst', { radius: t.radius });
      }
      if (this.hasScavenger) {
        for (const o of this.monsters) {
          const ot = o.def.trait;
          if (o.dead || o === dead || !ot || ot.id !== 'scavenge' || o.hp >= o.maxHp) continue;
          if (Math.abs(o.x - dead.x) <= ot.radius) {
            o.hp = Math.min(o.maxHp, o.hp + o.maxHp * ot.pct);
            this.traitEmit(o, 'scavenge');
          }
        }
      }
    },
  });
})((globalThis.TD = globalThis.TD || {}));
