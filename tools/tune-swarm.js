#!/usr/bin/env node
// 自动平衡"多出来的小怪"的强度（设计书 84）：逐关调关卡里的 swarm（0.0003–1），写回 src/data/levels.js
// 做法：先用"不加小怪"的老平衡让机器人一路推进，存下每一关开打前的存档（缓存在临时目录），
//   再对每一关独立地调 swarm：强度越高，撞城墙造成的伤害越大；二分查找到"首次挑战的平均城墙剩余 ≈ 该类型目标 − 0.1"。
//   因为每关用自己的存档，不同关卡可以分给几个进程同时调（--from / --to）。
// 用法：node tools/tune-swarm.js <起始关> <结束关> [--seeds 3] [--dry] [--rebuild] [--offset 0.1]
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
const offset = args.includes('--offset') ? +args[args.indexOf('--offset') + 1] : 0.1;
const CACHE = path.join(os.tmpdir(), 'scyx-swarm-saves.json');
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
  const target = Math.max(0.2, (TARGET[lvl.type] || 0.8) - offset);
  const measure = (s) => {
    lvl.swarm = s;
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
  // 在对数刻度上二分：lo 是"够轻"（城墙剩余 ≥ 目标）的强度，hi 是"太重"的强度
  let lo = 0.0003;
  let hi = 1;
  let best = null;
  for (let it = 0; it < 9; it++) {
    const s = it === 0 ? 0.03 : Math.sqrt(lo * hi);
    const r = measure(s);
    const ok = r.winRate >= 0.75 && r.time <= 330;
    if (ok && r.wall >= target) {
      lo = s;
      if (!best || r.s > best.s) best = r;
      if (r.wall - target < 0.05) break;
    } else hi = s;
  }
  if (!best) best = measure(lo); // 轻到最低都不行（说明是别的原因）：照最低强度
  const swarm = +best.s.toPrecision(2);
  results[n] = swarm;
  console.log(`第${n}关（${lvl.type}）目标城墙 ${Math.round(target * 100)}% → swarm ${swarm}  胜率 ${Math.round(best.winRate * 100)}%  城墙 ${Math.round(best.wall * 100)}%  用时 ${Math.round(best.time)}s`);
}

if (!dry) {
  // 多个进程同时跑时各自只改自己的关卡：读文件、改这几关、马上写回
  const file = path.join(__dirname, '..', 'src/data/levels.js');
  let src = fs.readFileSync(file, 'utf8');
  for (const n of Object.keys(results)) {
    const start = src.indexOf(`\n    ${n}: {`) + 1;
    const end = src.indexOf('\n    },\n', start);
    let block = src.slice(start, end);
    if (/\n      swarm: [\d.e-]+,/.test(block)) block = block.replace(/\n      swarm: [\d.e-]+,/, `\n      swarm: ${results[n]},`);
    else block = block.replace(/(\n      type: '\w+',)/, `$1\n      swarm: ${results[n]},`);
    src = src.slice(0, start) + block + src.slice(end);
  }
  fs.writeFileSync(file, src);
  console.log('已写回 src/data/levels.js');
}
