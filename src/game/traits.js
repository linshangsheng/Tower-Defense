// 普通怪物的独特技能（设计书 165）：每种怪一个"拿手好戏"，数据在 monsters.js 的 def.trait = { id, ... }
// 实现挂在 Battle 原型上，由 battle.js 在这几个时机调用：出生（initTrait）、每帧（updateTraits / traitSpeedMult）、
// 被打中（traitOnHit）、啃城墙（traitWallDps / traitOnWallHit）、有怪死亡（traitOnKill）。变体怪（echo）直接继承基础怪的 trait。
(function (TD) {
  'use strict';

  const D = TD.data;
  const C0 = TD.config;

  // 战利品（设计书 169）：击败怪物偶尔掉出光球，点一下拾取；不点就消失，不拿也不会输
  const DROPS = {
    purse: { name: '铜钱袋', icon: '💰', color: '#ffd23f', w: 40 },
    mend: { name: '修墙', icon: '🧱', color: '#7fe08a', w: 25 },
    fury: { name: '狂怒', icon: '🔥', color: '#ff7a4f', w: 20 },
    gale: { name: '疾风', icon: '💨', color: '#8fd8ff', w: 15 },
  };
  TD.data.drops = DROPS;
  const DROP_RATE = 0.035;
  const DROP_LIFE = 8;

  Object.assign(TD.Battle.prototype, {
    maybeDrop(m) {
      if (!this.drops) this.drops = [];
      if (this.drops.length >= (m.elite ? 6 : 4)) return;
      if (!m.def.boss && !m.elite && this.rng() >= DROP_RATE) return;
      let r = this.rng() * 100;
      let kind = 'purse';
      for (const k of Object.keys(DROPS)) {
        r -= DROPS[k].w;
        if (r < 0) { kind = k; break; }
      }
      const y = Math.max(C0.fieldTop + 20, Math.min(C0.fieldBottom - 20, m.y + m.yOffset));
      const x = Math.max(C0.wallX + 60, Math.min(1150, m.x));
      const d = { id: (this.dropNo = (this.dropNo || 0) + 1), kind, x, y, born: this.time, until: this.time + DROP_LIFE, copper: m.def.copper };
      this.drops.push(d);
      this.emit('drop', { d });
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
        amount = Math.max(8, Math.round(d.copper * 6));
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
      this.emit('dropGet', { d, kind: d.kind, amount });
    },

    initTrait(m) {
      const t = m.def.trait;
      m.tr = { next: this.time + (t.every || 0) * (0.5 + this.rng() * 0.7), wallHits: 0 };
      if (t.id === 'scavenge') this.hasScavenger = true;
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
