// Boss 弱点（设计书 198）：Boss 身上隔一阵亮起一个弱点，3 秒内点中它——
// 造成 Boss 最大血量 2.5% 的破绽伤害（无视大部分护甲）并让 Boss 踉跄 0.6 秒。不点也不吃亏，机器人不点。
(function (TD) {
  'use strict';

  const C = TD.config;
  C.weakSpot = { first: 6, gapMin: 9, gapRand: 4, life: 3, dmgPct: 0.025, stagger: 0.6, radius: 38 };
  // Boss 蓄力（设计书 219）：血量降到 66% / 33% 时蓄力 3 秒，身上出现大号红色弱点——点中打断（踉跄 2 秒 + 5% 最大血量），
  // 没点中就狂暴（移动速度 +25%，持续 8 秒）。机器人对局（自动补给）没有蓄力，已标定的数值不变
  C.bossRage = { marks: [0.66, 0.33], windup: 3, radius: 54, dmgPct: 0.05, stun: 2, rushMult: 1.25, rushDur: 8 };

  const eligible = (m) => m && !m.dead && !!m.def.boss && !m.def.towerOf && !m.fallen && !m.burrowed && !m.hidden && m.x < C.width - 40;

  Object.assign(TD.Battle.prototype, {
    updateWeakSpots() {
      const W = C.weakSpot;
      const R = C.bossRage;
      for (const m of this.monsters) {
        if (!eligible(m)) {
          if (m.weak) m.weak = null;
          if (m.rage) m.rage = null;
          continue;
        }
        // 蓄力：到血量档位就开始；时间到了没被打断 → 狂暴
        if (!this.autoSupply) {
          if (m.rageMark === undefined) m.rageMark = 0;
          if (!m.rage && m.rageMark < R.marks.length && m.hp / m.maxHp <= R.marks[m.rageMark]) {
            m.rageMark++;
            m.rage = { until: this.time + R.windup, born: this.time };
            m.weak = { until: this.time + R.windup, ox: 0, oy: -m.def.size * 0.55, born: this.time, rage: true };
            this.emit('bossRage', { m });
            continue;
          }
          if (m.rage && this.time >= m.rage.until) {
            m.rage = null;
            m.weak = null;
            m.rushUntil = this.time + R.rushDur;
            m.weakNext = Math.max(m.weakNext || 0, this.time + 3);
            this.emit('rageLand', { m });
            continue;
          }
          if (m.rage) continue; // 蓄力中：弱点固定是蓄力的那个
        }
        if (m.weakNext === undefined) m.weakNext = this.time + W.first;
        if (m.weak && this.time >= m.weak.until) {
          m.weak = null;
          this.emit('weakMiss', { m });
        }
        if (!m.weak && this.time >= m.weakNext) {
          const s = m.def.size;
          m.weak = { until: this.time + W.life, ox: (this.rng() - 0.5) * s * 0.7, oy: -s * (0.35 + this.rng() * 0.45), born: this.time };
          m.weakNext = this.time + (W.gapMin + this.rng() * W.gapRand) * (1 - ((this.mods && this.mods.weakGap) || 0));
          this.emit('weakSpot', { m });
        }
      }
    },

    // 弱点在画面上的位置
    weakPos(m) {
      return { x: m.x + m.weak.ox, y: m.y + m.yOffset + m.weak.oy };
    },

    // 点击 (px, py)：点中某个 Boss 的弱点就结算；返回是否点中
    hitWeakAt(px, py) {
      if (this.over) return false;
      const W = C.weakSpot;
      for (const m of this.monsters) {
        if (!m.weak || m.dead) continue;
        const p = this.weakPos(m);
        const dx = p.x - px;
        const dy = p.y - py;
        const rad = m.weak.rage ? C.bossRage.radius : W.radius;
        if (dx * dx + dy * dy > rad * rad) continue;
        if (m.weak.rage) {
          // 打断蓄力
          const R = C.bossRage;
          m.weak = null;
          m.rage = null;
          this.weakHits = (this.weakHits || 0) + 1;
          this.rageBreaks = (this.rageBreaks || 0) + 1;
          this.damage(m, m.maxHp * R.dmgPct * (1 + ((this.mods && this.mods.weakDmg) || 0)), { type: 'phys', fromFront: false, armorIgnore: 0.8, source: 'weak' });
          if (!m.dead) m.stunUntil = Math.max(m.stunUntil || 0, this.time + R.stun + ((this.mods && this.mods.weakStun) || 0));
          m.weakNext = Math.max(m.weakNext || 0, this.time + 4);
          this.emit('rageBroken', { m, x: p.x, y: p.y });
          return true;
        }
        m.weak = null;
        this.weakHits = (this.weakHits || 0) + 1;
        this.damage(m, m.maxHp * W.dmgPct * (1 + ((this.mods && this.mods.weakDmg) || 0)), { type: 'phys', fromFront: false, armorIgnore: 0.8, source: 'weak' });
        if (!m.dead) m.stunUntil = Math.max(m.stunUntil || 0, this.time + W.stagger + ((this.mods && this.mods.weakStun) || 0));
        this.emit('weakHit', { m, x: p.x, y: p.y });
        return true;
      }
      return false;
    },
  });
})((globalThis.TD = globalThis.TD || {}));
