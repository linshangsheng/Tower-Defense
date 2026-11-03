// 普通怪物的独特技能（设计书 165）：每种怪一个"拿手好戏"，数据在 monsters.js 的 def.trait = { id, ... }
// 实现挂在 Battle 原型上，由 battle.js 在这几个时机调用：出生（initTrait）、每帧（updateTraits / traitSpeedMult）、
// 被打中（traitOnHit）、啃城墙（traitWallDps / traitOnWallHit）、有怪死亡（traitOnKill）。变体怪（echo）直接继承基础怪的 trait。
(function (TD) {
  'use strict';

  const D = TD.data;

  Object.assign(TD.Battle.prototype, {
    initTrait(m) {
      const t = m.def.trait;
      m.tr = { next: this.time + (t.every || 0) * (0.5 + this.rng() * 0.7), wallHits: 0 };
      if (t.id === 'scavenge') this.hasScavenger = true;
    },

    traitEmit(m, id, extra) {
      this.emit('trait', Object.assign({ m, id, x: m.x, y: m.y + m.yOffset }, extra || {}));
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
