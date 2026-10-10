#!/usr/bin/env node
// 自动数值模拟：验证设计书 18.10 的原型验收目标
// 用法：node tools/sim.js [--seeds 5] [--verbose]
const TD = require('./load');
const P = TD.progression;

const args = process.argv.slice(2);
const seeds = +(args[args.indexOf('--seeds') + 1] || 0) || 5;
const verbose = args.includes('--verbose');
const LAST = Math.max(...Object.keys(TD.data.levels).map(Number));

function pct(x) {
  return Math.round(x * 100) + '%';
}

// 目标 1：不做任何购买
function noPurchase() {
  const rates = {};
  for (let n = 1; n <= LAST; n++) {
    let wins = 0;
    for (let s = 0; s < seeds; s++) {
      const save = P.newSave();
      for (let k = 1; k < n; k++) save.levels[k] = { stars: 1, clears: 1 };
      const { res } = TD.bot.playLevel(save, n, { seed: 100 + s });
      if (res.win) wins++;
    }
    rates[n] = wins / seeds;
  }
  return rates;
}

// 目标 2：机器人按性价比花钱，一路推进
function campaign(seed, opts) {
  opts = opts || {};
  const save = P.newSave();
  const log = [];
  const before = {};
  let retries = 0;
  for (let n = 1; n <= LAST; n++) {
    let attempts = 0;
    before[n] = TD.util.deepClone(save);
    let res;
    let battle;
    do {
      attempts++;
      if (!opts.noShop) TD.bot.shop(save);
      ({ res, battle } = TD.bot.playLevel(save, n, { seed: seed * 1000 + n * 10 + attempts, noSkills: opts.noSkills }));
      const reward = P.applyResult(save, n, res);
      if (verbose)
        console.log(
          `  第${n}关 尝试${attempts} ${res.win ? '胜' : '负'} 城墙${pct(res.wallRatio)} 用时${Math.round(res.time)}s 波${res.wave}/${battle.totalWaves} +${reward.copper}铜 +${reward.silver}银 战力${P.power(save)} 铜余${save.copper}`
        );
    } while (!res.win && attempts < 12);
    if (!res.win) {
      log.push({ n, attempts, win: false });
      break;
    }
    retries += attempts - 1;
    log.push({ n, attempts, win: true, stars: res.stars, time: res.time, wall: res.wallRatio, power: P.power(save) });
  }
  return { log, retries, save, before };
}

console.log('=== 目标 1：不做任何购买时的通过率 ===');
const np = noPurchase();
console.log(Object.entries(np).map(([n, r]) => `第${n}关 ${pct(r)}`).join('  '));

console.log('\n=== 目标 2：机器人正常升级推进 ===');
let totalRetries = 0;
let allClear = 0;
const perLevel = {};
for (let s = 1; s <= seeds; s++) {
  if (verbose) console.log(`-- 种子 ${s}`);
  const { log, retries } = campaign(s);
  totalRetries += retries;
  if (log.length === LAST && log.every((l) => l.win)) allClear++;
  for (const l of log) {
    const p = (perLevel[l.n] = perLevel[l.n] || { attempts: 0, stars: 0, time: 0, wall: 0, count: 0, power: 0 });
    p.attempts += l.attempts;
    p.count++;
    if (l.win) {
      p.stars += l.stars;
      p.time += l.time;
      p.wall += l.wall;
      p.power += l.power;
    }
  }
}
for (const [n, p] of Object.entries(perLevel)) {
  console.log(
    `第${n}关  平均尝试 ${(p.attempts / p.count).toFixed(1)}  平均星级 ${(p.stars / p.count).toFixed(1)}  平均用时 ${Math.round(p.time / p.count)}s  城墙剩余 ${pct(p.wall / p.count)}  战力 ${Math.round(p.power / p.count)}`
  );
}
console.log(`全部通关的种子：${allClear}/${seeds}，平均重试次数：${(totalRetries / seeds).toFixed(1)}`);

console.log('\n=== 目标 3：第 10 关，有无主动技能对比 ===');
const BOSS1 = 10;
let withSk = 0;
let noSk = 0;
for (let s = 1; s <= seeds; s++) {
  const { before } = campaign(s);
  // 用第一次挑战第 10 关之前的存档
  for (let k = 0; k < 3; k++) {
    const a = TD.util.deepClone(before[BOSS1]);
    const b = TD.util.deepClone(before[BOSS1]);
    TD.bot.shop(a);
    TD.bot.shop(b);
    if (TD.bot.playLevel(a, BOSS1, { seed: 900 + s * 7 + k }).res.win) withSk++;
    if (TD.bot.playLevel(b, BOSS1, { seed: 900 + s * 7 + k, noSkills: true }).res.win) noSk++;
  }
}
console.log(`通关后的存档重打第${BOSS1}关：有技能胜 ${withSk}/${seeds * 3}，无技能胜 ${noSk}/${seeds * 3}`);

if (LAST >= 20) {
  console.log('\n=== 目标 4：第 20 关，有无魔法输出对比 ===');
  let magic = 0;
  let noMagic = 0;
  let total = 0;
  for (let s = 1; s <= seeds; s++) {
    const { before } = campaign(s);
    if (!before[20]) continue;
    // 用第一次挑战第 20 关之前的存档
    for (let k = 0; k < 3; k++) {
      total++;
      const a = TD.util.deepClone(before[20]);
      const b = TD.util.deepClone(before[20]);
      TD.bot.shop(a);
      TD.bot.shop(b);
      if (TD.bot.playLevel(a, 20, { seed: 700 + s * 7 + k }).res.win) magic++;
      // 无魔法：换成木弓/火炮，卸下雷霆一击和灼烧
      b.weapons.staff.owned = false;
      b.activeOwned.thunder = false;
      b.passiveOwned.burn = false;
      if (TD.bot.playLevel(b, 20, { seed: 700 + s * 7 + k }).res.win) noMagic++;
    }
  }
  console.log(`第 20 关：有魔法输出胜 ${magic}/${total}，无魔法输出胜 ${noMagic}/${total}`);
}

if (LAST >= 30) {
  console.log('\n=== 目标 5：第 25 关，有无魔法输出对比 ===');
  let magic = 0;
  let noMagic = 0;
  let total = 0;
  for (let s = 1; s <= seeds; s++) {
    const { before } = campaign(s);
    if (!before[25]) continue;
    for (let k = 0; k < 3; k++) {
      total++;
      const a = TD.util.deepClone(before[25]);
      const b = TD.util.deepClone(before[25]);
      TD.bot.shop(a);
      TD.bot.shop(b);
      if (TD.bot.playLevel(a, 25, { seed: 500 + s * 7 + k }).res.win) magic++;
      b.weapons.staff.owned = false;
      b.weapons.orb.owned = false;
      b.activeOwned.thunder = false;
      b.passiveOwned.burn = false;
      if (TD.bot.playLevel(b, 25, { seed: 500 + s * 7 + k }).res.win) noMagic++;
    }
  }
  console.log(`第 25 关：有魔法输出胜 ${magic}/${total}，无魔法输出胜 ${noMagic}/${total}`);
}

if (LAST >= 40) {
  console.log('\n=== 目标 6：辅助型怪物关卡，威胁优先 vs 最近优先 ===');
  for (const lv of [17, 22]) {
    const res = { smart: [0, 0], nearest: [0, 0] };
    for (let s = 1; s <= seeds; s++) {
      const { before } = campaign(s);
      if (!before[lv]) continue;
      for (let k = 0; k < 2; k++) {
        for (const mode of ['smart', 'nearest']) {
          const a = TD.util.deepClone(before[lv]);
          TD.bot.shop(a);
          P.recommend(a, lv);
          a.loadout.target = mode;
          const r = TD.bot.playLevel(a, lv, { seed: 300 + s * 7 + k, keepLoadout: true }).res;
          res[mode][0] += r.win ? r.wallRatio : 0;
          res[mode][1]++;
        }
      }
    }
    console.log(`第 ${lv} 关平均城墙剩余：威胁优先 ${pct(res.smart[0] / res.smart[1])}，最近优先 ${pct(res.nearest[0] / res.nearest[1])}`);
  }
}
