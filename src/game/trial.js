// 契约试炼（设计书 217）：每周一关。开局就背着两个契约诅咒，同时白送一张金色补给卡；
// 每周第一次通过奖励 1 金 + 3 银，可以反复挑战。通关第 20 关后开放。不影响关卡星级记录。
(function (TD) {
  'use strict';

  const M = TD.modes;
  const P = TD.progression;
  const D = TD.data;
  const C = TD.config;

  M.TRIAL_FROM = 20;
  M.trialUnlocked = (save) => P.isCleared(save, M.TRIAL_FROM);
  M.trialReward = { gold: 1, silver: 3 };
  M.trialHp = 1.0; // 试炼本身：怪物血量再 +100%（机器人在自己最近 8 关上约 90% 胜率）

  // 周编号：从 1970-01-05（周一）起算的第几周，同一周（周一到周日）相同
  M.weekKey = function (date) {
    const d = date || new Date();
    const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
    return 'W' + Math.floor((day - 4) / 7);
  };

  M.trialInfo = function (save, date) {
    const key = M.weekKey(date);
    let seed = 7;
    for (const ch of key) seed = (seed * 131 + ch.charCodeAt(0)) >>> 0;
    const rng = TD.util.rng(seed);
    const h = Math.max(M.TRIAL_FROM, P.highestCleared(save));
    const top = Math.min(h, M.poolLast(save));
    // 选一关普通类型的关卡（不要 Boss / 教学关：两个诅咒压在 Boss 关上太狠）
    const cand = [];
    // 从玩家最近打通的 8 关里选：试炼要有挑战性
    for (let n = Math.max(10, top - 8); n <= top; n++) if (D.levels[n] && ['normal', 'raid', 'armored', 'dark', 'union'].includes(D.levels[n].type)) cand.push(n);
    if (!cand.length) for (let n = 10; n <= top; n++) if (D.levels[n] && D.levels[n].type === 'normal') cand.push(n);
    const level = cand.length ? cand[rng.int(cand.length)] : 12;
    const curseIds = Object.keys(D.pactCurses);
    const curses = [];
    while (curses.length < 2) {
      const c = curseIds[rng.int(curseIds.length)];
      if (!curses.includes(c)) curses.push(c);
    }
    const golds = Object.keys(D.supplies).filter((id) => D.supplies[id].rarity === 'gold' && !D.supplies[id].needSkills && !D.supplies[id].humanOnly);
    const boon = golds[rng.int(golds.length)];
    return { key, level, curses, boon, seed, done: !!(save.trial && save.trial[key]) };
  };

  M.buildTrial = function (info) {
    const base = D.levels[info.level];
    const def = Object.assign({}, base, { rules: {}, trial: true });
    def.tip = `契约试炼：${info.curses.map((c) => D.pactCurses[c].name).join('、')}，开局获得「${D.supplies[info.boon].name}」`;
    return def;
  };

  // 开战时调用：诅咒生效，白送的金卡生效（和选卡一样计入已选补给、能参与羁绊）
  M.applyTrialStart = function (battle, info) {
    battle.curseHp = (battle.curseHp || 0) + M.trialHp;
    for (const c of info.curses) {
      D.pactCurses[c].apply(battle);
      battle.pactsTaken = (battle.pactsTaken || []).concat(c);
    }
    const sup = D.supplies[info.boon];
    for (const k of Object.keys(sup.mods || {})) battle.mods[k] = (battle.mods[k] || 0) + sup.mods[k];
    if (sup.delayed) battle.delayed.push({ kind: sup.delayed.kind, def: sup.delayed, at: null });
    battle.supplyPicked.push(info.boon);
    if (battle.checkSupplySets) battle.checkSupplySets();
  };

  M.applyTrialResult = function (save, info, result) {
    save.trial = save.trial && typeof save.trial === 'object' ? save.trial : {};
    const out = { copper: 0, silver: 0, gold: 0, notes: [], unlocks: [] };
    const st = P.heroStats(save);
    const diff = C.difficulties[save.settings.difficulty || 'normal'] || C.difficulties.normal;
    out.copper = Math.round((result.killCopper || 0) * (1 + st.luck + (result.copperBonus || 0) + diff.copper));
    if (result.win && !save.trial[info.key]) {
      save.trial[info.key] = true;
      out.gold = M.trialReward.gold;
      out.silver = M.trialReward.silver;
      out.notes.push('本周契约试炼完成！');
    } else if (result.win) out.notes.push('本周的奖励已经领过了');
    save.copper += out.copper;
    save.silver += out.silver;
    save.gold += out.gold;
    P.recordStats(save, result, result.win);
    out.achievements = P.checkAchievements(save, Object.assign({ level: info.level }, result));
    return out;
  };
})((globalThis.TD = globalThis.TD || {}));
