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
  let retries = 0;
  for (let n = 1; n <= LAST; n++) {
    let attempts = 0;
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
  return { log, retries, save };
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
let withSk = 0;
let noSk = 0;
for (let s = 1; s <= seeds; s++) {
  const { save } = campaign(s);
  // 回到第 10 关之前的战力再打一次第 10 关
  for (let k = 0; k < 3; k++) {
    const a = TD.util.deepClone(save);
    const b = TD.util.deepClone(save);
    if (TD.bot.playLevel(a, LAST, { seed: 900 + s * 7 + k }).res.win) withSk++;
    if (TD.bot.playLevel(b, LAST, { seed: 900 + s * 7 + k, noSkills: true }).res.win) noSk++;
  }
}
console.log(`通关后的存档重打第${LAST}关：有技能胜 ${withSk}/${seeds * 3}，无技能胜 ${noSk}/${seeds * 3}`);
