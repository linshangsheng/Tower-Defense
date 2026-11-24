// Boss 弱点（设计书 198）：Boss 身上隔一阵亮起一个弱点，3 秒内点中它——
// 造成 Boss 最大血量 2.5% 的破绽伤害（无视大部分护甲）并让 Boss 踉跄 0.6 秒。不点也不吃亏，机器人不点。
(function (TD) {
  'use strict';

  const C = TD.config;
  C.weakSpot = { first: 6, gapMin: 9, gapRand: 4, life: 3, dmgPct: 0.025, stagger: 0.6, radius: 38 };

  const eligible = (m) => m && !m.dead && !!m.def.boss && !m.def.towerOf && !m.fallen && !m.burrowed && !m.hidden && m.x < C.width - 40;

  Object.assign(TD.Battle.prototype, {
    updateWeakSpots() {
      const W = C.weakSpot;
      for (const m of this.monsters) {
        if (!eligible(m)) {
          if (m.weak) m.weak = null;
          continue;
        }
        if (m.weakNext === undefined) m.weakNext = this.time + W.first;
        if (m.weak && this.time >= m.weak.until) {
          m.weak = null;
          this.emit('weakMiss', { m });
        }
        if (!m.weak && this.time >= m.weakNext) {
          const s = m.def.size;
          m.weak = { until: this.time + W.life, ox: (this.rng() - 0.5) * s * 0.7, oy: -s * (0.35 + this.rng() * 0.45), born: this.time };
          m.weakNext = this.time + W.gapMin + this.rng() * W.gapRand;
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
        if (dx * dx + dy * dy > W.radius * W.radius) continue;
        m.weak = null;
        this.weakHits = (this.weakHits || 0) + 1;
        this.damage(m, m.maxHp * W.dmgPct, { type: 'phys', fromFront: false, armorIgnore: 0.8, source: 'weak' });
        if (!m.dead) m.stunUntil = Math.max(m.stunUntil || 0, this.time + W.stagger);
        this.emit('weakHit', { m, x: p.x, y: p.y });
        return true;
      }
      return false;
    },
  });
})((globalThis.TD = globalThis.TD || {}));
