#!/usr/bin/env node
// 闪电通关的标准时间（设计书 221）：一个很强的存档 + 自动召唤，把每关打一遍，
// 用时基本就是"出怪节奏的极限"；标准时间 = 这个用时 × 1.05，向上取整到 5 秒。写到 src/data/partimes.js。
// 用法：node tools/par.js   （约 3–5 分钟）
const fs = require('fs');
const path = require('path');
const TD = require('./load');
const P = TD.progression, D = TD.data;
const s = P.newSave();
for (let k = 1; k <= 200; k++) s.levels[k] = { stars: 3, clears: 1 };
s.copper = 5e8; s.silver = 5e7; s.gold = 5e6;
for (let i = 0; i < 700; i++) for (const a of ['atk', 'aspd', 'crit', 'critDmg']) P.buyAttr(s, a);
const out = {};
const lvls = Object.keys(D.levels).map(Number).sort((a, b) => a - b);
for (const n of lvls) {
  const lo = P.battleLoadout(s);
  lo.autoCast = true;
  const b = new TD.Battle({ level: n, stats: P.heroStats(s), loadout: lo, seed: 5, autoSupply: true, autoItems: true });
  b.autoCall = true;
  b.wall.hp = b.wall.max = 1e15;
  const r = b.runToEnd(900);
  if (!r.win) { console.log('✗ 第' + n + '关没打完，不设标准时间'); continue; }
  out[n] = Math.ceil((r.time * 1.05) / 5) * 5;
}
const body = '// 自动生成：node tools/par.js（设计书 221）。第 n 关的"闪电通关"标准时间（秒，游戏内时间）\n' +
  '(function (TD) {\n  \'use strict\';\n  TD.data.parTimes = ' + JSON.stringify(out) + ';\n})((globalThis.TD = globalThis.TD || {}));\n';
fs.writeFileSync(path.join(__dirname, '..', 'src/data/partimes.js'), body);
console.log('写入', Object.keys(out).length, '关');
