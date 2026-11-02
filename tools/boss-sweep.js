#!/usr/bin/env node
// Boss 卡死扫描（设计书 143）：对每个有 Boss 的关卡，模拟"Boss 刚出场就被打到 90% / 60% / 35% 血"（相当于输出很高的玩家），
// 用一个很强的存档 + 近乎无限的城墙，看战斗能不能推进到通关。没通关的会标 ✗ 并打印 Boss 当时的状态。
// 用法：node tools/boss-sweep.js            扫全部 Boss 关（约 5 分钟）
//       node tools/boss-sweep.js 20,60 0.6   只扫第 20、60 关，只用 60% 这一档
// 注意：第 200 关巨龙 35% 那一档会输（模拟存档不够强，不是卡死）；第 49 / 149 关是 6 个小 Boss 连战，要 230–360 秒。
const TD = require('./load');
const P = TD.progression, D = TD.data;
const lvls = Object.keys(D.levels).map(Number).sort((a, b) => a - b);
const bossLevels = lvls.filter((n) => D.levels[n].waves.some((w) => w.groups.some(([t]) => D.monsters[t] && D.monsters[t].boss && !D.monsters[t].towerOf)));
const only = process.argv[2] ? process.argv[2].split(',').map(Number) : null;
function save() {
  const s = P.newSave();
  for (let k = 1; k <= 200; k++) s.levels[k] = { stars: 3, clears: 1 };
  s.copper = 5e8; s.silver = 5e7; s.gold = 5e6;
  for (let i = 0; i < 700; i++) for (const a of ['atk', 'aspd', 'crit', 'critDmg']) P.buyAttr(s, a);
  return s;
}
const s = save();
function run(n, ratio) {
  const lo = P.battleLoadout(s);
  const b = new TD.Battle({ level: n, stats: P.heroStats(s), loadout: lo, seed: 7, autoSupply: true });
  b.wall.hp = b.wall.max = 1e15;
  let hit = false, bossSeen = 0, maxT = 0;
  for (let i = 0; i < 60 * 420 && !b.over; i++) {
    const bo = b.monsters.find((m) => !m.dead && m.def.boss && !m.def.bossPart);
    if (bo && !hit && bo.x > 1000) { hit = true; bossSeen = b.time; b.damage(bo, bo.maxHp * (1 - ratio), { type: 'magic', fromFront: false, source: 'test' }); }
    b.step(1 / 60);
    if (hit && !b.over && b.time - bossSeen > 330) break;
  }
  const bo2 = b.monsters.find((m) => !m.dead && m.def.boss && !m.def.bossPart); return { win: !!(b.result && b.result.win), over: b.over, t: +b.time.toFixed(0), bossAt: +bossSeen.toFixed(0), wall: b.wall.hp / b.wall.max, boss: bo2 ? bo2.type + ' ' + (bo2.hp / bo2.maxHp).toFixed(2) + ' x' + (bo2.x | 0) + ' ' + JSON.stringify(bo2.ai).slice(0, 120) : '-' };
}
for (const n of (only || bossLevels)) {
  const out = [];
  for (const r of (process.argv[3] ? process.argv[3].split(',').map(Number) : [0.9, 0.6, 0.35])) { const x = run(n, r); out.push(`${r}:${x.win ? 'ok' + x.t : 'STUCK(' + x.t + ' over=' + x.over + ' wall=' + x.wall.toFixed(3) + ' ' + x.boss + ')'}`); }
  const bad = out.some((o) => o.includes('STUCK'));
  console.log((bad ? '✗ ' : '✓ ') + '第' + n + '关', D.levels[n].waves.flatMap((w) => w.groups.map((g) => g[0])).filter((t) => D.monsters[t].boss).join('/'), out.join(' '));
}
