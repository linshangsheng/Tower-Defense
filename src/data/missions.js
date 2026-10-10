// 关卡任务（设计书第 36 章）：每关一个可选任务，首次完成奖励银币
(function (TD) {
  'use strict';

  TD.data.missions = {
    early3: { name: '急行军', desc: '至少提前召唤 3 次，并通关', check: (r) => (r.earlyCalls || 0) >= 3 },
    wall70: { name: '铜墙铁壁', desc: '城墙血量始终不低于 70%，并通关', check: (r) => (r.minWallRatio === undefined ? r.wallRatio : r.minWallRatio) >= 0.7 },
    noItems: { name: '轻装上阵', desc: '不使用任何道具，并通关', check: (r) => !(r.itemsUsed && r.itemsUsed.length) },
    interrupt2: { name: '打断专家', desc: '打断 Boss 至少 2 次，并通关', check: (r) => (r.interrupts || 0) >= 2 },
  };
  TD.data.missionReward = { silver: 2 };

  // 有可打断机制的 Boss（咕噜大王、墨墨、呼呼、雷雷）
  const INTERRUPT_BOSSES = ['boarKing', 'inkBoss', 'windGiant', 'thunderKing'];
  // 限制技能的任务（不放技能 / 只带 1 个技能）模拟下来几乎完成不了，没有采用（设计书 36.5）
  const ROTATION = ['early3', 'wall70', 'noItems'];

  // 第 n 关的任务 id（第 1、2 关没有任务）
  TD.data.missionFor = function (n) {
    const lvl = TD.data.levels[n];
    if (!lvl || n < 3) return null;
    const types = new Set();
    for (const w of lvl.waves) for (const [t] of w.groups) types.add(t);
    if (INTERRUPT_BOSSES.some((b) => types.has(b))) return 'interrupt2';
    if (lvl.type === 'boss' || lvl.type === 'miniboss' || lvl.type === 'elite') return 'noItems';
    return ROTATION[n % 3];
  };
})((globalThis.TD = globalThis.TD || {}));
