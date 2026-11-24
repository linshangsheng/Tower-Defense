// 关卡任务（设计书第 36 章）：每关一个可选任务，首次完成奖励银币
(function (TD) {
  'use strict';

  TD.data.missions = {
    early3: { live: (b) => ({ cur: b.earlyCalls || 0, goal: 3 }), name: '急行军', desc: '至少提前召唤 3 次，并通关', check: (r) => (r.earlyCalls || 0) >= 3 },
    wall70: { live: (b) => ({ keep: true, failed: b.minWallRatio < 0.7, pct: b.minWallRatio }), name: '铜墙铁壁', desc: '城墙血量始终不低于 70%，并通关', check: (r) => (r.minWallRatio === undefined ? r.wallRatio : r.minWallRatio) >= 0.7 },
    noItems: { live: (b) => ({ keep: true, failed: (b.itemsUsed || []).length > 0 }), name: '轻装上阵', desc: '不使用任何道具，并通关', check: (r) => !(r.itemsUsed && r.itemsUsed.length) },
    interrupt2: { live: (b) => ({ cur: b.interrupts || 0, goal: 2 }), name: '打断专家', desc: '打断 Boss 至少 2 次，并通关', check: (r) => (r.interrupts || 0) >= 2 },
    // ---- 新玩法任务（设计书 200）：完美防守、精英、连击、Boss 弱点 ----
    perfect3: { noMerc: true, live: (b) => ({ cur: b.perfectWaves || 0, goal: 3 }), name: '完美主义', desc: '至少打出 3 次完美防守，并通关', check: (r) => (r.perfectWaves || 0) >= 3 },
    elite4: { noMerc: true, live: (b) => ({ cur: b.elitesKilled || 0, goal: 4 }), name: '精英猎人', desc: '击败至少 4 只精英怪，并通关', check: (r) => (r.elites || 0) >= 4 },
    streak60: { noMerc: true, live: (b) => ({ cur: b.bestStreak || 0, goal: 60 }), name: '连击达人', desc: '单场打出 60 连击，并通关', check: (r) => (r.bestStreak || 0) >= 60 },
    weak3: { noMerc: true, live: (b) => ({ cur: b.weakHits || 0, goal: 3 }), name: '弱点猎手', desc: '点中 Boss 弱点至少 3 次，并通关', check: (r) => (r.weakHits || 0) >= 3 },
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
  // 战斗中的任务进度（设计书 200）：live(battle) → { cur, goal } 计数型，或 { keep: true, failed } 保持型
  TD.data.missionLive = function (id, b) {
    const m = TD.data.missions[id];
    if (!m || !m.live || !b) return null;
    const v = m.live(b);
    if (v.keep) return { state: v.failed ? 'failed' : 'holding', text: v.pct !== undefined ? Math.round(v.pct * 100) + '%' : '' };
    const cur = Math.min(v.cur, v.goal);
    return { state: cur >= v.goal ? 'done' : 'going', text: `${cur}/${v.goal}` };
  };
  TD.data.missionReward = { silver: 2, copper: 200 };

  // 有可打断机制的 Boss（咕噜大王、墨墨、呼呼、雷雷）
  const INTERRUPT_BOSSES = ['boarKing', 'inkBoss', 'windGiant', 'thunderKing'];
  // 限制技能的任务（不放技能 / 只带 1 个技能）模拟下来几乎完成不了，没有采用（设计书 36.5）
  const ROTATION = ['early3', 'wall70', 'noItems'];
  const MERC_FROM = 30;
  const MERC_TYPES = ['normal', 'raid', 'rush', 'armored', 'dark', 'union'];
  const MERC_ROTATION = ['mercNoDeath', 'mercBlock20', 'mercCap3', 'mercVet2', 'mercNoRally', 'mercSolo', 'mercShare30'];
  // 没有雇佣兵时，原来雇佣兵任务的位置（第 10 关起、每 4 关一个）换成新玩法任务（设计书 200）
  const NEW_FROM = 10;
  const NEW_ROTATION = ['perfect3', 'elite4', 'streak60'];
  TD.data.isMercMission = (id) => !!(TD.data.missions[id] && TD.data.missions[id].merc);

  // 第 n 关的任务 id（第 1、2 关没有任务）
  TD.data.missionFor = function (n) {
    const lvl = TD.data.levels[n];
    if (!lvl || n < 3) return null;
    const types = new Set();
    for (const w of lvl.waves) for (const [t] of w.groups) types.add(t);
    if (INTERRUPT_BOSSES.some((b) => types.has(b))) return 'interrupt2';
    const mercs = TD.config.merc && TD.config.merc.enabled;
    // 大 Boss 关：点 Boss 弱点（设计书 198）——没有雇佣兵的版本才换，老测试数据不变
    if (lvl.type === 'boss' && !mercs) return 'weak3';
    if (lvl.type === 'boss' || lvl.type === 'miniboss' || lvl.type === 'elite') return 'noItems';
    // 雇佣兵任务：第 30 关起（剑士、盾卫、弓手、法师都已解锁）、普通类型关卡里每 4 关一个；
    // missionFor 拿不到存档，所以不判断玩家有没有带兵——没带兵就完成不了，面板上会照常显示（可选的星外挑战）
    if (!mercs && n >= NEW_FROM && n % 4 === 2 && !lvl.tower && MERC_TYPES.includes(lvl.type)) {
      const id = NEW_ROTATION[((n - 2) / 4) % NEW_ROTATION.length | 0];
      // 突袭关波次重叠，不判定完美防守；精英怪第 20 关前很少
      if (id === 'perfect3' && lvl.type === 'rush') return 'streak60';
      if (id === 'elite4' && n < 20) return 'perfect3';
      return id;
    }
    if (mercs && n >= MERC_FROM && n % 4 === 2 && !lvl.tower && MERC_TYPES.includes(lvl.type)) return MERC_ROTATION[((n - 2) / 4) % MERC_ROTATION.length | 0];
    return ROTATION[n % 3];
  };
})((globalThis.TD = globalThis.TD || {}));
