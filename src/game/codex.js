// 图鉴 / 成就页的纯函数（过滤、分组、进度）：不碰 DOM，Node 里也能加载测试。只管展示，不改任何数据和结算逻辑。
(function (TD) {
  'use strict';

  const X = (TD.codex = {});

  // ---------- 图鉴：搜索与类型过滤 ----------
  // 类型分段控件的候选（按顺序）：key 是 monsterTags 里的标签；Boss 同时匹配"大 Boss"和"小 Boss"
  const TYPE_PREF = ['飞行', '远程', '治疗', '重甲', '盾牌', '隐身', '自爆', '分裂', 'Boss'];
  const isBossTag = (t) => t === '大 Boss' || t === '小 Boss';
  X.TYPE_PREF = TYPE_PREF;

  // 一个怪物的标签是否命中某个类型键
  X.hasType = function (tags, key) {
    if (!key || key === 'all') return true;
    if (key === 'Boss') return tags.some(isBossTag);
    return tags.indexOf(key) >= 0;
  };

  // 生成类型分段：[{key, count}]，第一项永远是 all；只保留至少有 2 只怪的类型，最多 maxN 个
  X.typeSegments = function (tagLists, maxN) {
    const out = [{ key: 'all', count: tagLists.length }];
    for (const key of TYPE_PREF) {
      const count = tagLists.filter((tags) => X.hasType(tags, key)).length;
      if (count >= 2 && out.length - 1 < (maxN || 6)) out.push({ key, count });
    }
    return out;
  };

  const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();

  // 文字是否包含查询（忽略大小写和多余空格）
  X.matchText = function (query, ...texts) {
    const q = norm(query);
    if (!q) return true;
    return texts.some((t) => norm(t).indexOf(q) >= 0);
  };

  // 过滤图鉴条目。items: [{type, name, desc, tags, known, chapter}]
  // opts: {query, typeKey, chapter, tr}  tr 是翻译函数（英文界面时同时按译文搜）
  // 规则：没解锁的怪物不参与搜索（否则能靠搜索"透视"名字）；有搜索词或类型筛选时跨章节，否则只看当前章节
  X.filterBestiary = function (items, opts) {
    const q = norm(opts.query);
    const typeKey = opts.typeKey || 'all';
    const tr = opts.tr || ((s) => s);
    const global = !!q || typeKey !== 'all';
    return items.filter((it) => {
      if (!global && it.chapter !== opts.chapter) return false;
      if (!q && typeKey === 'all') return true;
      if (!it.known) return false;
      if (!X.hasType(it.tags, typeKey)) return false;
      if (!q) return true;
      return X.matchText(q, it.name, it.desc, tr(it.name), tr(it.desc), it.tags.join(' '), it.tags.map(tr).join(' '));
    });
  };

  // ---------- 成就：分组 ----------
  const GROUPS = [
    { key: 'campaign', name: '进度类', ids: ['first', 'ch1', 'ch2', 'ch3', 'ch4', 'hero', 'ch6', 'ch7', 'ch8', 'ch9', 'ch10', 'abyss15', 'abyss20', 'tower1', 'tower5', 'tower9', 'endless30', 'daily7', 'diary'] },
    { key: 'combat', name: '战斗类', ids: ['ultimate', 'refresh3', 'perfect', 'close', 'noskill', 'interrupt', 'early', 'supply', 'streak30', 'combo50', 'kill1k', 'kill10k', 'bosses', 'elite30', 'treasure10', 'scavenger', 'bubbles'] },
    { key: 'collect', name: '收集类', ids: ['stars50', 'stars150', 'starsAll', 'weapons', 'skills', 'lv3', 'ascend', 'dex30', 'dexAll', 'crown10', 'crownAll', 'mission20', 'missionAll', 'rich'] },
    { key: 'merc', name: '雇佣兵类', ids: ['merc30', 'mercKill200', 'mercLv5'] },
  ];
  X.GROUPS = GROUPS;
  const FALLBACK = { key: 'other', name: '其他类', ids: [] };

  X.groupOf = function (id) {
    for (const g of GROUPS) if (g.ids.indexOf(id) >= 0) return g.key;
    return FALLBACK.key;
  };

  // 分组：返回 [{key, name, items, done, total}]，组内保持成就原顺序；空组不出现
  X.groupAchievements = function (list, doneMap) {
    const all = GROUPS.concat([FALLBACK]);
    const byKey = {};
    for (const g of all) byKey[g.key] = { key: g.key, name: g.name, items: [], done: 0, total: 0 };
    for (const a of list) {
      const g = byKey[X.groupOf(a.id)];
      g.items.push(a);
      g.total++;
      if (doneMap && doneMap[a.id]) g.done++;
    }
    return all.map((g) => byKey[g.key]).filter((g) => g.total > 0);
  };

  // ---------- 成就：进度（只有"能量化"的成就才有） ----------
  const stat = (k) => (s) => (s.stats || {})[k] || 0;
  const starsOf = (s) => Object.values(s.levels || {}).reduce((a, r) => a + (r.stars || 0), 0);
  const crownsOf = (s) => Object.values(s.levels || {}).filter((r) => r.crown).length;
  const missionsOf = (s) => Object.values(s.levels || {}).filter((r) => r.mission).length;
  const maxOf = (o) => Math.max(0, ...Object.values(o || {}).map(Number));
  // 通关第 n 关：用"已通关关卡数 / n"表示章节进度（clears > 0 的关卡里编号 ≤ n 的个数）
  const clearedUpTo = (n) => (s) => Object.keys(s.levels || {}).filter((k) => +k <= n && (s.levels[k] || {}).clears > 0).length;
  // 条件表：id -> [当前值函数, 目标]
  const PROGRESS = {
    elite30: [stat('elites'), 30],
    treasure10: [stat('treasures'), 10],
    merc30: [stat('mercDeployed'), 30],
    mercKill200: [stat('mercKills'), 200],
    mercLv5: [(s) => maxOf(s.mercLv), 5],
    scavenger: [stat('drops'), 50],
    bubbles: [stat('bubbles'), 100],
    interrupt: [stat('interrupts'), 10],
    early: [stat('earlyCalls'), 30],
    supply: [stat('supplies'), 50],
    stars50: [starsOf, 50],
    stars150: [starsOf, 150],
    crown10: [crownsOf, 10],
    crownAll: [crownsOf, 50],
    mission20: [missionsOf, 20],
    streak30: [stat('bestStreak'), 30],
    combo50: [stat('combos'), 50],
    kill1k: [stat('kills'), 1000],
    kill10k: [stat('kills'), 10000],
    daily7: [(s) => Object.keys(s.daily || {}).length, 7],
    dex30: [(s) => Object.keys(s.seenMonsters || {}).length, 30],
    tower1: [(s) => (s.tower || {}).best || 0, 1],
    tower5: [(s) => (s.tower || {}).best || 0, 5],
    tower9: [(s) => (s.tower || {}).best || 0, 9],
    endless30: [(s) => (s.endless || {}).best || 0, 30],
    lv3: [(s) => maxOf(s.skillLv), 3],
    rich: [(s) => s.copper || 0, 5000],
    ch1: [clearedUpTo(10), 10],
    ch2: [clearedUpTo(20), 20],
    ch3: [clearedUpTo(30), 30],
    ch4: [clearedUpTo(40), 40],
    hero: [clearedUpTo(50), 50],
    ch6: [clearedUpTo(60), 60],
    ch7: [clearedUpTo(70), 70],
    ch8: [clearedUpTo(80), 80],
    ch9: [clearedUpTo(90), 90],
    ch10: [clearedUpTo(100), 100],
    abyss15: [clearedUpTo(150), 150],
    abyss20: [clearedUpTo(200), 200],
  };
  X.hasProgress = (id) => !!PROGRESS[id] || id === 'starsAll';

  // 返回 {cur, target, ratio, done, tracked}；没有量化条件的只返回完成态（tracked=false）
  X.achProgress = function (ach, save, doneMap) {
    const done = !!(doneMap || save.achievements || {})[ach.id];
    let cur = 0;
    let target = 0;
    const p = PROGRESS[ach.id];
    if (p) {
      cur = p[0](save);
      target = p[1];
    } else if (ach.id === 'starsAll') {
      cur = starsOf(save);
      target = Object.keys((TD.data || {}).levels || {}).length * 3;
    }
    if (!target) return { cur: done ? 1 : 0, target: 1, ratio: done ? 1 : 0, done, tracked: false };
    if (done) cur = target;
    cur = Math.max(0, Math.min(cur, target));
    return { cur, target, ratio: cur / target, done, tracked: true };
  };

  // 总完成度：{done, total, ratio, pct}
  X.overall = function (list, doneMap) {
    const total = list.length;
    const done = list.filter((a) => doneMap && doneMap[a.id]).length;
    const ratio = total ? done / total : 0;
    return { done, total, ratio, pct: Math.round(ratio * 100) };
  };

  // 环形进度的描边偏移：周长 c，进度 ratio（0..1）
  X.ringOffset = function (c, ratio) {
    return c * (1 - Math.max(0, Math.min(1, ratio || 0)));
  };
})((globalThis.TD = globalThis.TD || {}));
