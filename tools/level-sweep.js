#!/usr/bin/env node
// 全关卡通关扫描（设计书 147）：用一个很强的存档 + 近乎无限的城墙，把指定范围的关卡各打一遍，
// 600 秒内没打完的标 ✗ 并列出剩下的怪（多半是"停在射程外"或"被强制停住"的卡死）。
// 用法：node tools/level-sweep.js 1 100    （约 3–5 分钟；可以同时开两个进程分别扫 1–100、101–200）
const TD = require('./load');
const P = TD.progression, D = TD.data;
const from = +process.argv[2], to = +process.argv[3];
const s = P.newSave();
for (let k = 1; k <= 200; k++) s.levels[k] = { stars: 3, clears: 1 };
s.copper = 5e8; s.silver = 5e7; s.gold = 5e6;
for (let i = 0; i < 700; i++) for (const a of ['atk', 'aspd', 'crit', 'critDmg']) P.buyAttr(s, a);
let bad = 0;
for (let n = from; n <= to; n++) {
  const b = new TD.Battle({ level: n, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 5, autoSupply: true, autoItems: true });
  b.wall.hp = b.wall.max = 1e15;
  for (let i = 0; i < 60 * 600 && !b.over; i++) b.step(1 / 60);
  if (!(b.over && b.result.win)) { bad++; const al = b.monsters.filter((m) => !m.dead); console.log('✗ 第' + n + '关', 'time', Math.round(b.time), 'over', b.over, 'alive', al.length, al.slice(0, 3).map((m) => m.type + '@' + (m.x | 0) + ' ' + (m.hp / m.maxHp).toFixed(2)).join(',')); }
}
console.log('range', from, to, 'bad', bad);
