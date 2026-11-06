// 关卡任务（设计书第 36 章）：每关一个可选任务，首次完成奖励银币
(function (TD) {
  'use strict';

  TD.data.missions = {
    early3: { name: '急行军', desc: '至少提前召唤 3 次，并通关', check: (r) => (r.earlyCalls || 0) >= 3 },
    wall70: { name: '铜墙铁壁', desc: '城墙血量始终不低于 70%，并通关', check: (r) => (r.minWallRatio === undefined ? r.wallRatio : r.minWallRatio) >= 0.7 },
    noItems: { name: '轻装上阵', desc: '不使用任何道具，并通关', check: (r) => !(r.itemsUsed && r.itemsUsed.length) },
    interrupt2: { name: '打断专家', desc: '打断 Boss 至少 2 次，并通关', check: (r) => (r.interrupts || 0) >= 2 },
    // ---- 雇佣兵任务（第 30 关起的部分普通关卡；数值门槛为估计值）----
    mercNoDeath: { name: '同生共死', desc: '雇佣至少 3 个兵，且一个兵都不阵亡，并通关', merc: true, check: (r) => (r.mercDeployed || 0) >= 3 && (r.mercDeaths || 0) === 0 },
    mercCap3: { name: '精兵简政', desc: '雇佣至少 3 个兵，且场上同时最多 3 个兵，并通关', merc: true, check: (r) => (r.mercDeployed || 0) >= 3 && (r.mercPeak || 0) <= 3 },
    mercBlock20: { name: '铜墙铁卫', desc: '用盾卫挡住怪物的攻击至少 20 次，并通关', merc: true, check: (r) => (r.mercBlocks || 0) >= 20 },
    mercVet2: { name: '百战老兵', desc: '让至少 2 个兵晋升到 3 级，并通关', merc: true, check: (r) => (r.mercMaxRanks || 0) >= 2 },
    mercSolo: { name: '专精一道', desc: '只带 1 个兵种，雇佣至少 4 个兵，并通关', merc: true, check: (r) => (r.mercCarried || 0) === 1 && (r.mercDeployed || 0) >= 4 },
    mercNoRally: { name: '各守其路', desc: '雇佣至少 3 个兵，且不使用集结令，并通关', merc: true, check: (r) => (r.mercDeployed || 0) >= 3 && (r.mercRallies || 0) === 0 },
    mercShare30: { name: '兵锋所向', desc: '雇佣兵击败的怪物占总数 30% 以上，并通关', merc: true, check: (r) => (r.mercDeployed || 0) >= 3 && (r.kills || 0) > 0 && (r.mercKills || 0) / r.kills >= 0.3 },
  };
  // 特殊关卡（小 Boss、大 Boss、精英）首次完成给 2 银；普通关卡不给银币，给 200 铜（设计书 88）
  TD.data.missionReward = { silver: 2, copper: 200 };

  // 有可打断机制的 Boss（咕噜大王、墨墨、呼呼、雷雷）
  const INTERRUPT_BOSSES = ['boarKing', 'inkBoss', 'windGiant', 'thunderKing'];
  // 限制技能的任务（不放技能 / 只带 1 个技能）模拟下来几乎完成不了，没有采用（设计书 36.5）
  const ROTATION = ['early3', 'wall70', 'noItems'];
  const MERC_FROM = 30;
  const MERC_TYPES = ['normal', 'raid', 'rush', 'armored', 'dark', 'union'];
  const MERC_ROTATION = ['mercNoDeath', 'mercBlock20', 'mercCap3', 'mercVet2', 'mercNoRally', 'mercSolo', 'mercShare30'];
  TD.data.isMercMission = (id) => !!(TD.data.missions[id] && TD.data.missions[id].merc);

  // 第 n 关的任务 id（第 1、2 关没有任务）
  TD.data.missionFor = function (n) {
    const lvl = TD.data.levels[n];
    if (!lvl || n < 3) return null;
    const types = new Set();
    for (const w of lvl.waves) for (const [t] of w.groups) types.add(t);
    if (INTERRUPT_BOSSES.some((b) => types.has(b))) return 'interrupt2';
    if (lvl.type === 'boss' || lvl.type === 'miniboss' || lvl.type === 'elite') return 'noItems';
    // 雇佣兵任务：第 30 关起（剑士、盾卫、弓手、法师都已解锁）、普通类型关卡里每 4 关一个；
    // missionFor 拿不到存档，所以不判断玩家有没有带兵——没带兵就完成不了，面板上会照常显示（可选的星外挑战）
    if (n >= MERC_FROM && n % 4 === 2 && !lvl.tower && MERC_TYPES.includes(lvl.type)) return MERC_ROTATION[((n - 2) / 4) % MERC_ROTATION.length | 0];
    return ROTATION[n % 3];
  };
})((globalThis.TD = globalThis.TD || {}));
