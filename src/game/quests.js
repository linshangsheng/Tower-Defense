// 今日任务（设计书 197）：每天从任务池里随机 3 个小目标，打任何模式的战斗都会累计；
// 每完成一个可领一份铜币，三个都完成再领一份额外奖励。通关第 5 关后开放（和每日挑战一样）。
(function (TD) {
  'use strict';

  const P = TD.progression;
  const C = TD.config;
  const Q = (TD.quests = {});

  // kind：sum = 多场累计；best = 单场达到即可（取单场最大值）
  // stat(result, win) → 这一场贡献的数值
  Q.POOL = {
    kills: { name: '击败 {0} 只怪物', goal: 400, kind: 'sum', stat: (r) => r.kills || 0, icon: 'swords' },
    wins: { name: '赢下 {0} 场战斗', goal: 3, kind: 'sum', stat: (r, w) => (w ? 1 : 0), icon: 'trophy' },
    elites: { name: '击败 {0} 只精英怪', goal: 3, kind: 'sum', stat: (r) => r.elites || 0, icon: 'crown' },
    drops: { name: '拾取 {0} 个战利品光球', goal: 8, kind: 'sum', stat: (r) => r.drops || 0, icon: 'sparkles' },
    streak: { name: '单场打出 {0} 连击', goal: 40, kind: 'best', stat: (r) => r.bestStreak || 0, icon: 'bolt' },
    skills: { name: '释放 {0} 次主动技能', goal: 15, kind: 'sum', stat: (r) => r.skillsCast || 0, icon: 'spark' },
    treasure: { name: '抓住 {0} 只宝箱哥布林', goal: 1, kind: 'sum', stat: (r) => r.treasures || 0, icon: 'coinbag' },
    stars3: { name: '三星通关 {0} 次', goal: 2, kind: 'sum', stat: (r, w) => (w && r.stars >= 3 ? 1 : 0), icon: 'star' },
    weak: { name: '点中 Boss 弱点 {0} 次', goal: 3, kind: 'sum', stat: (r) => r.weakHits || 0, icon: 'target' },
    perfect: { name: '打出 {0} 次完美防守', goal: 8, kind: 'sum', stat: (r) => r.perfectWaves || 0, icon: 'shield' },
    synergy: { name: '凑成 {0} 个补给羁绊', goal: 1, kind: 'sum', stat: (r) => (r.supplySets || []).length, icon: 'sparkles' },
    pact: { name: '接受 {0} 次契约', goal: 1, kind: 'sum', stat: (r) => (r.pacts || []).length, icon: 'flame', from: 15 },
    flawless: { name: '城墙满血赢下 {0} 场', goal: 1, kind: 'sum', stat: (r, w) => (w && (r.minWallRatio || 0) >= 0.999 ? 1 : 0), icon: 'shield' },
  };
  Q.IDS = Object.keys(Q.POOL);
  Q.PER_DAY = 3;

  Q.unlocked = (save) => P.isCleared(save, 5);

  // 按日期生成当天的 3 个任务（同一天、同一存档结果固定）
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
    return h >>> 0;
  }
  // save 可选：给了就只从玩家已经能完成的任务里抽（有的任务要通关到第 from 关，设计书 218）
  Q.rollFor = function (key, save) {
    let h = hash('quests:' + key);
    const top = save ? P.highestCleared(save) : Infinity;
    const ids = Q.IDS.filter((id) => !Q.POOL[id].from || top >= Q.POOL[id].from);
    const out = [];
    while (out.length < Q.PER_DAY && ids.length) {
      h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
      out.push(ids.splice(h % ids.length, 1)[0]);
    }
    return out;
  };

  // 每份任务的铜币奖励：按当前进度缩放（和每日登录奖励同一个基准）
  Q.reward = (save) => ({ copper: Math.round(C.rewards.baseCopper(Math.max(1, P.highestCleared(save))) * 1.5) });
  Q.bonusReward = () => ({ silver: 3 });

  // 取今天的任务状态（跨天自动换新）
  Q.today = function (save, date) {
    const key = TD.modes.todayKey(date);
    const cur = save.quests;
    if (!cur || cur.key !== key || !Array.isArray(cur.list)) {
      save.quests = { key, list: Q.rollFor(key, save).map((id) => ({ id, prog: 0, claimed: false })), bonus: false };
    }
    // 坏数据容错：未知任务丢掉
    save.quests.list = save.quests.list.filter((q) => q && Q.POOL[q.id]);
    return save.quests;
  };

  // 每天可以免费换掉 1 个还没完成的任务（设计书 205）：换成今天列表里没有的随机一个，进度清零
  Q.canReroll = (save, i, date) => {
    const st = Q.today(save, date);
    const q = st.list[i];
    return !!q && !st.rerolled && !q.claimed && !Q.done(q) && Q.IDS.length > st.list.length;
  };
  Q.reroll = function (save, i, date, rand) {
    if (!Q.canReroll(save, i, date)) return null;
    const st = save.quests;
    const top = P.highestCleared(save);
    const pool = Q.IDS.filter((id) => !st.list.some((q) => q.id === id) && (!Q.POOL[id].from || top >= Q.POOL[id].from));
    const id = pool[Math.floor((rand || Math.random)() * pool.length) % pool.length];
    st.list[i] = { id, prog: 0, claimed: false };
    st.rerolled = true;
    return id;
  };

  Q.done = (q) => q.prog >= Q.POOL[q.id].goal;

  // 一场战斗结束：累计进度；返回这一场"刚刚完成"的任务名列表
  Q.onBattle = function (save, result, win, date) {
    if (!result || !Q.unlocked(save)) return [];
    const st = Q.today(save, date);
    const fresh = [];
    for (const q of st.list) {
      const def = Q.POOL[q.id];
      const before = Q.done(q);
      const v = Number(def.stat(result, !!win)) || 0;
      q.prog = def.kind === 'best' ? Math.max(q.prog, v) : q.prog + v;
      q.prog = Math.min(q.prog, def.goal);
      if (!before && Q.done(q)) fresh.push(Q.label(q.id));
    }
    return fresh;
  };

  Q.label = (id) => Q.POOL[id].name.replace('{0}', Q.POOL[id].goal);

  function give(save, r) {
    save.copper += r.copper || 0;
    save.silver += r.silver || 0;
    save.gold += r.gold || 0;
  }

  Q.claim = function (save, i, date) {
    const st = Q.today(save, date);
    const q = st.list[i];
    if (!q || q.claimed || !Q.done(q)) return null;
    const r = Q.reward(save);
    give(save, r);
    q.claimed = true;
    save.stats.questsDone = (Number(save.stats.questsDone) || 0) + 1; // 成就「日日精进」（设计书 202）
    return r;
  };

  Q.bonusReady = (save, date) => {
    const st = Q.today(save, date);
    return !st.bonus && st.list.length > 0 && st.list.every((q) => q.claimed);
  };
  Q.claimBonus = function (save, date) {
    if (!Q.bonusReady(save, date)) return null;
    const r = Q.bonusReward();
    give(save, r);
    save.quests.bonus = true;
    return r;
  };

  // 地图上的小红点：可以领的个数
  Q.claimable = function (save, date) {
    if (!Q.unlocked(save)) return 0;
    const st = Q.today(save, date);
    return st.list.filter((q) => !q.claimed && Q.done(q)).length + (Q.bonusReady(save, date) ? 1 : 0);
  };
})((globalThis.TD = globalThis.TD || {}));
