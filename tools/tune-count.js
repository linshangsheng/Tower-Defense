#!/usr/bin/env node
// 自动平衡每关的怪物数量倍率 countMult（设计书 84）：主线第 N 关多出了小怪，原有怪物要相应少一点，难度才能落回原来的目标
// 做法：先用"不加小怪"的旧平衡让机器人一路推进，存下每一关开打前的存档（缓存在临时目录），
//   再对每一关独立地二分查找 countMult，让首次挑战的平均城墙剩余落在该类型的目标附近（胜率不低于 75%、用时不超过 330 秒），写回 src/data/levels.js。
//   每关用自己的存档，所以可以分给几个进程同时调。
// 用法：node tools/tune-count.js <起始关> <结束关> [--seeds 2] [--dry] [--rebuild]
const fs = require('fs');
const os = require('os');
const path = require('path');
const TD = require('./load');
const P = TD.progression;

const args = process.argv.slice(2);
const from = +args[0];
const to = +args[1];
const seeds = +(args[args.indexOf('--seeds') + 1] || 0) || 3;
const dry = args.includes('--dry');
const CACHE = path.join(os.tmpdir(), 'scyx-count-saves.json');
const TARGET = { tutorial: 0.95, normal: 0.8, raid: 0.85, rush: 0.7, armored: 0.65, dark: 0.75, union: 0.6, miniboss: 0.6, elite: 0.6, boss: 0.55 };
const LAST = Math.max(...Object.keys(TD.data.levels).map(Number));

function buildSaves() {
  const keep = TD.config.extraMonstersPerLevel;
  TD.config.extraMonstersPerLevel = 0;
  const save = P.newSave();
  const snaps = {};
  for (let n = 1; n <= LAST; n++) {
    snaps[n] = JSON.parse(JSON.stringify(save));
    let t = 0;
    let r;
    do {
      t++;
      TD.bot.shop(save);
      r = TD.bot.playLevel(save, n, { seed: 1000 + n * 10 + t }).res;
      P.applyResult(save, n, r);
    } while (!r.win && t < 12);
    if (!r.win) throw new Error(`老平衡下机器人卡在第 ${n} 关`);
  }
  TD.config.extraMonstersPerLevel = keep;
  fs.writeFileSync(CACHE, JSON.stringify(snaps));
  return snaps;
}
const snaps = !args.includes('--rebuild') && fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : buildSaves();

const results = {};
for (let n = from; n <= to; n++) {
  const lvl = TD.data.levels[n];
  const target = TARGET[lvl.type] || 0.8;
  const start = lvl.countMult || 1;
  const measure = (s) => {
    lvl.countMult = s;
    let wins = 0;
    let wall = 0;
    let time = 0;
    let runs = 0;
    for (let k = 0; k < seeds; k++)
      for (const extra of [0, 1]) {
        const save = JSON.parse(JSON.stringify(snaps[n]));
        TD.bot.shop(save);
        const { res } = TD.bot.playLevel(save, n, { seed: 4242 + k * 31 + extra * 7 });
        runs++;
        if (res.win) {
          wins++;
          wall += res.wallRatio;
        }
        time += res.time;
      }
    return { s, winRate: wins / runs, wall: wall / runs, time: time / runs };
  };
  // 在对数刻度上二分：lo 是"够简单"（城墙剩余 ≥ 目标）的倍率，hi 是"太难"的倍率；倍率越大怪越多
  let lo = 0.3;
  let hi = 3.5;
  let best = null;
  for (let it = 0; it < 8; it++) {
    const m = it === 0 ? Math.min(3.5, Math.max(0.3, start)) : Math.sqrt(lo * hi);
    const r = measure(+m.toFixed(3));
    const ok = r.winRate >= 0.75 && r.time <= 330;
    if (ok && r.wall >= target) {
      lo = m; // 这个倍率城墙剩余够多：还可以更难一点
      if (!best || r.s > best.s) best = r;
      if (r.wall - target < 0.06) break;
    } else hi = m;
  }
  if (!best) best = measure(0.3); // 最低倍率都不行（说明是别的原因）：照最低
  const mult = +best.s.toFixed(2);
  results[n] = mult;
  console.log(`第${n}关（${lvl.type}）目标城墙 ${Math.round(target * 100)}% → countMult ${mult}（原 ${start}）  胜率 ${Math.round(best.winRate * 100)}%  城墙 ${Math.round(best.wall * 100)}%  用时 ${Math.round(best.time)}s`);
}

if (!dry) {
  // 多个进程同时跑时各自只改自己的关卡：读文件、改这几关、马上写回
  const file = path.join(__dirname, '..', 'src/data/levels.js');
  let src = fs.readFileSync(file, 'utf8');
  for (const n of Object.keys(results)) {
    const start = src.indexOf(`\n    ${n}: {`) + 1;
    const end = src.indexOf('\n    },\n', start);
    let block = src.slice(start, end);
    if (/countMult: [\d.]+,/.test(block)) block = block.replace(/countMult: [\d.]+,/, `countMult: ${results[n]},`);
    else block = block.replace(/(\n      type: '\w+',)/, `$1\n      countMult: ${results[n]},`);
    src = src.slice(0, start) + block + src.slice(end);
  }
  fs.writeFileSync(file, src);
  console.log('已写回 src/data/levels.js');
}
