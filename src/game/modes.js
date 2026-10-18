// 无尽模式与每日挑战（设计书第 25 章）
(function (TD) {
  'use strict';

  const D = TD.data;
  const C = TD.config;
  const P = TD.progression;

  const M = (TD.modes = {});

  // ---------- 无尽模式 ----------
  M.endlessUnlocked = (save) => P.isCleared(save, 20);

  // 无尽 / 每日的关卡上限：第六章以后，每通关一章才放开一章
  function poolLast(save) {
    for (const n of [100, 90, 80, 70, 60]) if (P.isCleared(save, n)) return n;
    return 50;
  }
  M.poolLast = poolLast;

  // 已解锁章节里出现过的怪物
  function unlockedPool(save) {
    const h = Math.max(1, P.highestCleared(save));
    const normal = new Set();
    const mini = new Set();
    const major = new Set();
    // 第六章以后的怪物在通关本章最后一关后才进入（设计书 34.2、52.7、75）
    const last = poolLast(save);
    for (let n = 1; n <= Math.min(h, last); n++) {
      for (const w of D.levels[n].waves)
        for (const [t] of w.groups) {
          const def = D.monsters[t];
          if (def.boss === 'mini') mini.add(t);
          else if (def.boss === 'major') {
            // 最终 Boss 墨墨和它的回声保持唯一，不进入无尽模式
            if (t !== 'inkBoss' && t !== 'chaosInk') major.add(t);
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
    P.recordStats(save, result, false);
    out.achievements = P.checkAchievements(save, Object.assign({ endlessWave: waves }, result, { win: false }));
    return out;
  };

  // ---------- 九层妖塔（设计书 74；取代原来的 Boss 连战） ----------
  const T = () => D.tower;
  M.towerUnlocked = (save) => P.isCleared(save, 60);

  // 可以出场的妖王：已经搬进小镇的朋友（设计书 52.7）的"妖塔版"
  M.towerBossList = (save) => D.town.filter((f) => !save || P.isCleared(save, f.level)).map((f) => f.boss);

  M.towerReward = (floor) => Math.pow(2, floor - 1); // 第 N 层：2^(N−1) 钻石
  M.towerCounts = (floor) => ({ boss: T().bossPerFloor * floor, minion: T().minionPerFloor * floor });
  // 难度按已通关的最高关卡折算（至少按第 60 关）；越高的层血量越高
  M.towerStage = (save) => Math.max(60, Math.min(Math.max(...Object.keys(D.levels).map(Number)), P.highestCleared(save)));
  M.towerD = (save, floor) => C.difficulty(M.towerStage(save)) * T().base * Math.pow(T().grow, floor - 1);

  // 把 n 只平均分给一组类型（余数依次补给前面的），返回 [[类型, 数量], ...]
  function spread(types, n) {
    const out = {};
    for (let i = 0; i < n; i++) out[types[i % types.length]] = (out[types[i % types.length]] || 0) + 1;
    return Object.entries(out);
  }

  // 妖塔里的小妖：每个已解锁的章节挑 2 种（同屏几百只时种类太多会拖慢画面，设计书 74.5）
  M.towerMinionPool = function (save) {
    const h = Math.max(1, P.highestCleared(save));
    const last = Math.min(h, poolLast(save));
    const out = [];
    for (const ch of D.chapters) {
      const seen = [];
      for (const n of ch.levels) {
        if (n > last) break;
        for (const w of D.levels[n].waves)
          for (const [t] of w.groups) {
            const d = D.monsters[t];
            if (!d.boss && !d.towerOf && !D.noIntro[t] && !seen.includes(t) && !out.includes(t)) seen.push(t);
          }
      }
      // 第八章以后每章只挑 1 种：同屏的种类越多越慢（设计书 74.5）
      out.push(...seen.slice(0, ch.id > 7 ? 1 : 2));
    }
    return out.length ? out : ['slime'];
  };

  M.buildTower = function (save, floor) {
    const cnt = M.towerCounts(floor);
    const bosses = M.towerBossList(save).map((id) => 'tw_' + id);
    const minions = M.towerMinionPool(save);
    const per = T().waves;
    const stage = M.towerStage(save);
    const waves = [];
    for (let w = 0; w < per; w++) {
      const nb = Math.round(cnt.boss / per);
      const nm = Math.round(cnt.minion / per);
      // 出怪间隔：一波大约在 (12 + 2×层数) 秒里全部涌出
      const gap = Math.max(0.05, (12 + 2 * floor) / (nb + nm));
      waves.push({ gap, groups: [...spread(minions, nm), ...spread(bosses, nb)], D: M.towerD(save, floor), chapter: D.chapterOf(Math.min(stage, 100)).id });
    }
    return {
      name: `九层妖塔 · 第 ${floor} 层`,
      type: 'tower',
      tower: true,
      floor,
      lanes: 5,
      waves,
      supplyEvery: 1,
      stage,
      tip: `第 ${floor} 层：${cnt.boss} 个妖王 + ${cnt.minion} 只小妖同时涌来。打怪没有收益，只有过关才有钻石！`,
    };
  };

  // ---- 一趟挑战的流程（状态存在 save.towerRun，刷新页面不能反悔） ----
  //  null：没在挑战；{ floor, state: 'battle' }：第 floor 层战斗中；{ floor, state: 'choose' }：已通过第 floor 层，等待选择
  // inBattle：此刻是否真的有一场妖塔战斗在进行。战斗中途刷新 / 关页面（存档里是"战斗中"，但没有战斗）= 失败
  M.towerRunState = function (save, inBattle) {
    const run = save.towerRun;
    if (!run) return null;
    if (run.state === 'battle' && !inBattle) {
      M.towerFail(save);
      return null;
    }
    return run;
  };

  M.towerCanStart = (save) => M.towerUnlocked(save) && !save.towerRun && P.canAfford(save, T().fee);

  M.towerStart = function (save) {
    if (!M.towerCanStart(save)) return false;
    P.pay(save, T().fee);
    save.towerRun = { floor: 1, state: 'battle' };
    const t = (save.tower = save.tower || { best: 0, runs: 0, diamonds: 0 });
    t.runs++;
    return true;
  };

  M.towerFail = function (save) {
    save.towerRun = null;
  };

  // 通过当前这一层：返回 { floor, reward, final }
  M.towerFloorCleared = function (save) {
    const run = save.towerRun;
    if (!run || run.state !== 'battle') return null;
    const t = (save.tower = save.tower || { best: 0, runs: 0, diamonds: 0 });
    const floor = run.floor;
    t.best = Math.max(t.best, floor);
    const out = { floor, reward: M.towerReward(floor), final: floor >= T().floors };
    if (out.final) M.towerCashOut(save, floor);
    else run.state = 'choose';
    return out;
  };

  // 领取钻石走人
  M.towerCashOut = function (save, floor) {
    const run = save.towerRun;
    const f = floor || (run && run.floor);
    if (!f) return 0;
    const n = M.towerReward(f);
    save.diamond = (save.diamond || 0) + n;
    const t = (save.tower = save.tower || { best: 0, runs: 0, diamonds: 0 });
    t.diamonds += n;
    save.towerRun = null;
    return n;
  };

  // 继续往上爬：从这一刻起，刷新页面等于失败
  M.towerContinue = function (save) {
    const run = save.towerRun;
    if (!run || run.state !== 'choose' || run.floor >= T().floors) return false;
    run.floor++;
    run.state = 'battle';
    return true;
  };

  // 战斗结束时调用：赢了 → 返回 towerFloorCleared 的结果；输了 → 什么都没有
  M.applyTowerResult = function (save, result) {
    const out = { win: !!result.win, notes: [], achievements: [] };
    if (result.win) {
      Object.assign(out, M.towerFloorCleared(save) || {});
    } else {
      out.floor = (save.towerRun && save.towerRun.floor) || 0;
      M.towerFail(save);
    }
    P.recordStats(save, result, result.win);
    out.achievements = P.checkAchievements(save, Object.assign({}, result, { win: result.win }));
    return out;
  };

  M.fmtTime = (sec) => `${Math.floor(sec / 60)} 分 ${Math.round(sec % 60)} 秒`;

  // ---------- 每日挑战 ----------
  M.dailyRules = {
    swift: { name: '疾风', desc: '怪物速度 +30%', rules: { monsterSpeed: 0.3 } },
    iron: { name: '铁壁', desc: '怪物血量 +40%，城墙血量 +40%', rules: { monsterHp: 0.4, wallHp: 0.4 } },
    // 原"朴素"（不能用技能和道具）：模拟显示中后期不放技能几乎必输（设计书 36.5），改为只禁道具（设计书 44）
    plain: { name: '轻装', desc: '不能使用道具', rules: { noItems: true } },
    feast: { name: '补给狂欢', desc: '每 2 波一次补给', supplyEvery: 2 },
    fragile: { name: '危墙', desc: '城墙只有一半血量', rules: { wallHalf: true } },
    horde: { name: '怪物大潮', desc: '怪物数量 +50%', rules: { countBonus: 0.5 } },
    primitive: { name: '原始武器', desc: '只能使用木弓', rules: { forceBow: true } },
    // v0.36 新增（设计书 44）
    night: { name: '夜战', desc: '整关都是暗夜：射程 −30%', dark: true },
    giants: { name: '巨人', desc: '怪物数量 −40%，但血量 +80%', rules: { countBonus: -0.4, monsterHp: 0.8 } },
    rush: { name: '急袭', desc: '不等清场，每 14 秒来一波', rush: 14 },
    gold: { name: '抢时间', desc: '提前召唤的铜币 ×3', rules: { earlyMult: 2 } },
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
    const level = 1 + rng.int(Math.min(h, poolLast(save)));
    const ruleIds = Object.keys(M.dailyRules);
    const rule = ruleIds[rng.int(ruleIds.length)];
    return { key, level, rule, seed, done: !!(save.daily && save.daily[key]) };
  };

  M.buildDaily = function (info) {
    const base = D.levels[info.level];
    const r = M.dailyRules[info.rule];
    const def = Object.assign({}, base, { rules: Object.assign({}, r.rules || {}), daily: true });
    if (r.supplyEvery) def.supplyEvery = r.supplyEvery;
    if (r.dark) def.dark = true;
    if (r.rush) {
      def.type = 'rush';
      def.rushInterval = r.rush;
    }
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
    P.recordStats(save, result, result.win);
    out.achievements = P.checkAchievements(save, Object.assign({ level: info.level }, result));
    return out;
  };
})((globalThis.TD = globalThis.TD || {}));
