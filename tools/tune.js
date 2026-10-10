#!/usr/bin/env node
// 自动平衡：按关卡类型的目标城墙剩余，调整每关的怪物数量倍率 countMult，并写回 src/data/levels.js
// 用法：node tools/tune.js <起始关> <结束关> [--seeds 3] [--dry]
const fs = require('fs');
const path = require('path');
const TD = require('./load');
const P = TD.progression;

const args = process.argv.slice(2);
const from = +args[0];
const to = +args[1];
const seeds = +(args[args.indexOf('--seeds') + 1] || 0) || 3;
const dry = args.includes('--dry');

// 目标：首次挑战（机器人正常购物后）的平均城墙剩余
const TARGET = { tutorial: 0.95, normal: 0.8, raid: 0.85, rush: 0.7, armored: 0.65, dark: 0.75, union: 0.6, miniboss: 0.6, boss: 0.45 };

function playUntilWin(save, n, seed) {
  let r;
  let t = 0;
  do {
    t++;
    TD.bot.shop(save);
    r = TD.bot.playLevel(save, n, { seed: seed * 1000 + n * 10 + t }).res;
    P.applyResult(save, n, r);
  } while (!r.win && t < 12);
  return r.win;
}

// 准备每个种子打到 from 之前的存档
const saves = [];
for (let s = 1; s <= seeds; s++) {
  const save = P.newSave();
  for (let n = 1; n < from; n++) playUntilWin(save, n, s);
  saves.push(save);
}

const results = {};
for (let n = from; n <= to; n++) {
  const lvl = TD.data.levels[n];
  const target = TARGET[lvl.type] || 0.8;
  let mult = lvl.countMult || 1;
  let best = null;
  let lo = null; // 已知"太简单"的倍率
  let hi = null; // 已知"太难"的倍率
  for (let it = 0; it < 9; it++) {
    lvl.countMult = mult;
    let wins = 0;
    let wall = 0;
    let time = 0;
    for (let k = 0; k < saves.length; k++) {
      for (const extra of [0, 1]) {
        const s = TD.util.deepClone(saves[k]);
        TD.bot.shop(s);
        const { res } = TD.bot.playLevel(s, n, { seed: 4242 + k * 31 + extra * 7 });
        if (res.win) {
          wins++;
          wall += res.wallRatio;
        }
        time += res.time;
      }
    }
    const runs = saves.length * 2;
    const winRate = wins / runs;
    const avgWall = wall / runs; // 输的局算 0
    const avgTime = time / runs;
    const ok = winRate >= 0.75 && avgTime <= 300; // 关卡时长不超过 5 分钟
    const score = Math.abs(avgWall - target) + (ok ? 0 : 0.5);
    if (!best || score < best.score) best = { mult, winRate, avgWall, time: time / runs, score };
    if (Math.abs(avgWall - target) <= 0.08 && ok) break;
    // 二分查找：在"太简单"和"太难"之间逼近目标
    if (ok && avgWall > target) {
      lo = mult;
      mult = hi !== null ? (lo + hi) / 2 : mult * (1 + Math.min(0.6, (avgWall - target) * 1.5));
    } else {
      hi = mult;
      mult = lo !== null ? (lo + hi) / 2 : mult * 0.8;
    }
    mult = Math.max(0.4, Math.min(3.5, +mult.toFixed(3)));
  }
  lvl.countMult = +best.mult.toFixed(2);
  results[n] = best;
  console.log(
    `第${n}关（${lvl.type}）目标 ${Math.round(target * 100)}% → 倍率 ${lvl.countMult}  胜率 ${Math.round(best.winRate * 100)}%  城墙 ${Math.round(best.avgWall * 100)}%  用时 ${Math.round(best.time)}s`
  );
  // 推进存档
  saves.forEach((save, i) => playUntilWin(save, n, i + 1));
}

if (!dry) {
  const file = path.join(__dirname, '..', 'src/data/levels.js');
  let src = fs.readFileSync(file, 'utf8');
  for (const n of Object.keys(results)) {
    const mult = TD.data.levels[n].countMult;
    const start = src.indexOf(`    ${n}: {`);
    const end = src.indexOf('\n    },\n', start);
    let block = src.slice(start, end);
    if (/countMult: [\d.]+,/.test(block)) block = block.replace(/countMult: [\d.]+,/, `countMult: ${mult},`);
    else block = block.replace(/(\n      type: '\w+',)/, `$1\n      countMult: ${mult},`);
    src = src.slice(0, start) + block + src.slice(end);
  }
  fs.writeFileSync(file, src);
  console.log('已写回 src/data/levels.js');
}
