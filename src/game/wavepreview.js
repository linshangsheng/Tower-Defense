// 下一波预告（设计书 201）：两波之间的倒计时里，在波次信息下方列出下一波的怪物和数量，
// 让玩家提前决定留技能、换道具。数量算法和 startWave 一致（含数量倍率、越往后多出来的小怪、回归的小 Boss）。
(function (TD) {
  'use strict';

  const D = TD.data;

  Object.assign(TD.Battle.prototype, {
    // 第 i 波的组成：[{ type, count, boss }]，Boss 在前，其余按数量从多到少；拿不到就返回 null
    wavePreview(i) {
      const wave = this.level.waves && this.level.waves[i];
      if (!wave || !wave.groups) return null;
      const cm = (this.level.countMult || 1) * (1 + ((this.rules && this.rules.countBonus) || 0));
      const counts = new Map();
      const add = (type, n) => counts.set(type, (counts.get(type) || 0) + n);
      for (const [type, count] of wave.groups) {
        const def = D.monsters[type];
        if (!def) continue;
        add(type, def.boss ? count : Math.max(1, Math.round(count * cm)));
      }
      for (const [type, count] of (this.extraPlan && this.extraPlan[i]) || []) add(type, count);
      for (const r of this.returnBosses || []) if (r.wave === i) add(r.type, 1);
      const out = [...counts].map(([type, count]) => ({ type, count, boss: !!D.monsters[type].boss }));
      out.sort((a, b) => b.boss - a.boss || b.count - a.count);
      return out;
    },

    // HUD 用：现在该预告哪一波（准备阶段 = 第 1 波；两波之间 = 下一波）；不该显示时返回 -1
    previewWaveIndex() {
      if (this.over || this.pendingSupply) return -1;
      if (this.waveState === 'prepare') return 0;
      if (this.waveState === 'waiting' && this.waveIndex < this.totalWaves - 1) return this.waveIndex + 1;
      return -1;
    },
  });
})((globalThis.TD = globalThis.TD || {}));
