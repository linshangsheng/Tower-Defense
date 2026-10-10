// 无尽模式与每日挑战（设计书第 25 章）
(function (TD) {
  'use strict';

  const D = TD.data;
  const C = TD.config;
  const P = TD.progression;

  const M = (TD.modes = {});

  // ---------- 无尽模式 ----------
  M.endlessUnlocked = (save) => P.isCleared(save, 20);

  // 已解锁章节里出现过的怪物
  function unlockedPool(save) {
    const h = Math.max(1, P.highestCleared(save));
    const normal = new Set();
    const mini = new Set();
    const major = new Set();
    // 第六章的怪物在通关第 60 关后才进入（设计书 34.2）
    const last = P.isCleared(save, 60) ? 60 : 50;
    for (let n = 1; n <= Math.min(h, last); n++) {
      for (const w of D.levels[n].waves)
        for (const [t] of w.groups) {
          const def = D.monsters[t];
          if (def.boss === 'mini') mini.add(t);
          else if (def.boss === 'major') {
            // 最终 Boss 墨墨保持唯一，不进入无尽模式
            if (t !== 'inkBoss') major.add(t);
          }
          else if (!D.noIntro[t]) normal.add(t);
        }
    }
    return { normal: [...normal], mini: [...mini], major: [...major] };
  }

  M.buildEndless = function (save, seed) {
    const rng = TD.util.rng(seed);
    const h = Math.max(20, P.highestCleared(save));
    const start = Math.max(1, h - 10);
    const pool = unlockedPool(save);
    const chapters = D.chapters.filter((c) => P.isUnlocked(save, c.levels[0]));
    const waves = [];
    for (let k = 1; k <= 300; k++) {
      const kinds = 2 + (rng() < 0.4 ? 1 : 0);
      const total = Math.min(40, Math.round(10 + k * 1.2));
      const picks = [];
      while (picks.length < kinds) {
        const t = rng.pick(pool.normal);
        if (!picks.includes(t)) picks.push(t);
      }
      // 克制型怪物（高魔抗、灵体、重甲）每波最多占 25%：无尽模式中途不能换武器
      const isCounter = (t) => {
        const d = D.monsters[t];
        return (d.mres || 0) >= 150 || !!d.physResist || (d.armor || 0) >= 100;
      };
      const groups = picks.map((t, i) => {
        let c = Math.max(1, Math.round(total / kinds + (i === 0 ? total % kinds : 0)));
        if (isCounter(t)) c = Math.max(1, Math.min(c, Math.round(total * 0.25)));
        return [t, c];
      });
      if (k % 10 === 0 && pool.major.length) groups.push([rng.pick(pool.major), 1]);
      else if (k % 5 === 0 && pool.mini.length) groups.push([rng.pick(pool.mini), 1]);
      waves.push({
        gap: Math.max(0.35, 1.0 - k * 0.012),
        groups,
        D: C.difficulty(start + 0.8 * (k - 1)),
        chapter: chapters[Math.floor((k - 1) / 10) % chapters.length].id,
      });
    }
    return {
      name: '无尽模式',
      type: 'endless',
      endless: true,
      lanes: 5,
      waves,
      supplyEvery: 3,
      stage: h,
      tip: '无尽模式：撑得越久越好！每 3 波一次补给，每 5 波一个 Boss。',
    };
  };

  M.applyEndlessResult = function (save, result) {
    const st = P.heroStats(save);
    const e = (save.endless = save.endless || { best: 0, runs: 0 });
    const waves = result.wavesCleared || 0;
    const out = { copper: 0, silver: 0, gold: 0, notes: [], unlocks: [], waves, oldBest: e.best };
    const diff = C.difficulties[save.settings.difficulty || 'normal'] || C.difficulties.normal;
    out.copper = Math.round(waves * 15 * (1 + st.luck + (result.copperBonus || 0) + diff.copper) + (result.killCopper || 0) * 0.5);
    if (waves > e.best) {
      out.silver = Math.floor(waves / 5) - Math.floor(e.best / 5);
      out.notes.push(`新纪录！${e.best} → ${waves} 波`);
      e.best = waves;
    }
    e.runs++;
    save.copper += out.copper;
    save.silver += out.silver;
    save.stats.battles++;
    save.stats.kills += result.kills || 0;
    save.stats.bestStreak = Math.max(save.stats.bestStreak || 0, result.bestStreak || 0);
    save.stats.interrupts += result.interrupts || 0;
    save.stats.earlyCalls += result.earlyCalls || 0;
    save.stats.supplies += (result.supplies || []).length;
    for (const k of Object.keys(result.killsByType || {})) save.stats.killsByType[k] = (save.stats.killsByType[k] || 0) + result.killsByType[k];
    out.achievements = P.checkAchievements(save, Object.assign({ endlessWave: waves }, result, { win: false }));
    return out;
  };

  // ---------- 每日挑战 ----------
  M.dailyRules = {
    swift: { name: '疾风', desc: '怪物速度 +30%', rules: { monsterSpeed: 0.3 } },
    iron: { name: '铁壁', desc: '怪物血量 +40%，城墙血量 +40%', rules: { monsterHp: 0.4, wallHp: 0.4 } },
    plain: { name: '朴素', desc: '不能使用主动技能和道具', rules: { noSkills: true, noItems: true } },
    feast: { name: '补给狂欢', desc: '每 2 波一次补给', supplyEvery: 2 },
    fragile: { name: '危墙', desc: '城墙只有一半血量', rules: { wallHalf: true } },
    horde: { name: '怪物大潮', desc: '怪物数量 +50%', rules: { countBonus: 0.5 } },
    primitive: { name: '原始武器', desc: '只能使用木弓', rules: { forceBow: true } },
  };

  M.dailyUnlocked = (save) => P.isCleared(save, 5);

  M.todayKey = function (date) {
    const d = date || new Date();
    const pad = (x) => String(x).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  M.dailyInfo = function (save, date) {
    const key = M.todayKey(date);
    let seed = 0;
    for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rng = TD.util.rng(seed);
    const h = Math.max(5, P.highestCleared(save));
    const level = 1 + rng.int(Math.min(h, P.isCleared(save, 60) ? 60 : 50));
    const ruleIds = Object.keys(M.dailyRules);
    const rule = ruleIds[rng.int(ruleIds.length)];
    return { key, level, rule, seed, done: !!(save.daily && save.daily[key]) };
  };

  M.buildDaily = function (info) {
    const base = D.levels[info.level];
    const r = M.dailyRules[info.rule];
    const def = Object.assign({}, base, { rules: Object.assign({}, r.rules || {}), daily: true });
    if (r.supplyEvery) def.supplyEvery = r.supplyEvery;
    def.tip = `每日挑战「${r.name}」：${r.desc}`;
    return def;
  };

  M.applyDailyResult = function (save, info, result) {
    save.daily = save.daily || {};
    const out = { copper: 0, silver: 0, gold: 0, notes: [], unlocks: [] };
    const st = P.heroStats(save);
    const diff = C.difficulties[save.settings.difficulty || 'normal'] || C.difficulties.normal;
    out.copper = Math.round((result.killCopper || 0) * (1 + st.luck + (result.copperBonus || 0) + diff.copper));
    if (result.win && !save.daily[info.key]) {
      save.daily[info.key] = true;
      out.silver = 3;
      out.notes.push('今日挑战完成！');
    } else if (result.win) out.notes.push('今天的奖励已经领过了');
    save.copper += out.copper;
    save.silver += out.silver;
    save.stats.battles++;
    if (result.win) save.stats.wins++;
    save.stats.kills += result.kills || 0;
    save.stats.bestStreak = Math.max(save.stats.bestStreak || 0, result.bestStreak || 0);
    save.stats.interrupts += result.interrupts || 0;
    save.stats.earlyCalls += result.earlyCalls || 0;
    save.stats.supplies += (result.supplies || []).length;
    for (const k of Object.keys(result.killsByType || {})) save.stats.killsByType[k] = (save.stats.killsByType[k] || 0) + result.killsByType[k];
    out.achievements = P.checkAchievements(save, Object.assign({ level: info.level }, result));
    return out;
  };
})((globalThis.TD = globalThis.TD || {}));
