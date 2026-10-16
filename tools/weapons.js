// 武器强度对比（设计书 63.6）：强机器人在若干关的存档上，每把武器都练到同样的等级后逐把上场，比较胜率和城墙剩余
// 用法：node tools/weapons.js [--seeds 3] [--levels 15,25,35,45,55,65] [--lv 8]
const TD = require('./load');
const P = TD.progression;
const D = TD.data;
const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const seeds = +arg('--seeds', 3);
const levels = arg('--levels', '15,25,35,45,55,65').split(',').map(Number);
const WLV = +arg('--lv', 8);
const LAST = Math.max(...levels);
const ids = Object.keys(D.weapons);

function saves(seed) {
  const save = P.newSave();
  const out = {};
  for (let n = 1; n <= LAST; n++) {
    let a = 0;
    let res;
    do {
      a++;
      TD.bot.shop(save);
      if (levels.includes(n) && a === 1) out[n] = TD.util.deepClone(save);
      ({ res } = TD.bot.playLevel(save, n, { seed: seed * 1000 + n * 10 + a }));
      P.applyResult(save, n, res);
    } while (!res.win && a < 12);
  }
  return out;
}

function run(save, n, id, seed) {
  const s = TD.util.deepClone(save);
  for (const k of ids) s.weapons[k] = { owned: k === id || s.weapons[k].owned, lv: k === id ? WLV : s.weapons[k].lv, asc: false };
  P.recommend(s, n);
  s.loadout.weapon = id;
  const lo = P.battleLoadout(s);
  lo.weapon = id;
  lo.autoCast = true;
  const b = new TD.Battle({ level: n, stats: P.heroStats(s, { weapon: id }), loadout: lo, seed, autoItems: true, autoSupply: true, difficulty: 'normal' });
  const res = b.runToEnd();
  return { win: res.win, wall: res.wallRatio };
}

const table = {};
for (let seed = 1; seed <= seeds; seed++) {
  const sv = saves(seed);
  for (const n of levels) for (const id of ids) {
    const r = run(sv[n], n, id, seed * 7 + n);
    const t = (table[id] = table[id] || { win: 0, wall: 0, n: 0 });
    t.win += r.win ? 1 : 0;
    t.wall += r.wall;
    t.n++;
  }
  console.error(`种子 ${seed} 完成`);
}
console.log(`关卡 ${levels.join(',')}，${seeds} 个种子，武器都练到 Lv${WLV}（不进阶），每把 ${table[ids[0]].n} 局`);
console.log('品质'.padEnd(3), '武器'.padEnd(9), '价格'.padEnd(8), '胜率', ' 城墙剩余');
const byR = {};
for (const id of ids) {
  const w = D.weapons[id];
  const t = table[id];
  console.log(D.weaponRarity[w.rarity].name.padEnd(3), w.name.padEnd(9), P.costText(w.cost).padEnd(8), `${Math.round((t.win / t.n) * 100)}%`.padStart(4), `${Math.round((t.wall / t.n) * 100)}%`.padStart(7));
  (byR[w.rarity] = byR[w.rarity] || []).push(t);
}
console.log('\n每档平均：');
for (const r of Object.keys(byR)) {
  const ts = byR[r];
  const n = ts.reduce((a, t) => a + t.n, 0);
  console.log(D.weaponRarity[r].name, `胜率 ${Math.round((ts.reduce((a, t) => a + t.win, 0) / n) * 100)}%  城墙剩余 ${Math.round((ts.reduce((a, t) => a + t.wall, 0) / n) * 100)}%`);
}
