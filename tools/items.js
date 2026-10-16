// 道具专项测试（设计书 62.6）：同一个存档、同一关、同一个种子，带 / 不带某个道具，比较结果
// 用法：node tools/items.js [--seeds 3] [--levels 20,30,45,60,70] [--manual]
// --manual：所有道具都在同一个时机使用（第 2 波之后，有 5 只以上怪物离城墙不到 450 像素时），排除各道具自动使用规则的差别
const TD = require('./load');
const P = TD.progression;
const D = TD.data;
const args = process.argv.slice(2);
const seeds = +(args[args.indexOf('--seeds') + 1] || 0) || 3;
const levels = (args[args.indexOf('--levels') + 1] || '20,30,45,55,70').split(',').map(Number);
const LAST = Math.max(...levels);
const manual = args.includes('--manual');
const HEAL = ['patch', 'holyLight', 'barrier']; // 回血 / 护盾类：城墙掉到 55% 以下才用（手动模式）
const ids = Object.keys(D.items).filter((id) => !D.items[id].passive);

// 先用强机器人打出每个种子在各关开打前的存档
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
  P.recommend(s, n);
  s.inventory = id ? { [id]: 1 } : {};
  s.loadout.items = id ? [id, null, null] : [null, null, null];
  const lo = P.battleLoadout(s);
  lo.autoCast = true;
  const b = new TD.Battle({ level: n, stats: P.heroStats(s), loadout: lo, seed, autoItems: !manual, autoSupply: true, difficulty: 'normal' });
  if (!manual) {
    const res = b.runToEnd();
    return { win: res.win, wall: res.wallRatio, used: b.itemsUsed.includes(id) };
  }
  let used = false;
  while (!b.over && b.time < 600) {
    b.step(1 / 60);
    if (id && !used && b.waveIndex >= 1 && b.waveState !== 'prepare' && b.monsters.filter((m) => !m.dead && m.x < TD.config.wallX + 450).length >= 5 && (!HEAL.includes(id) || b.wall.hp < b.wall.max * 0.55)) {
      b.useItem(0, D.items[id].targetLane ? b.bestLane() : undefined);
      used = true;
    }
  }
  const res = b.result || { win: false, wallRatio: 0 };
  return { win: res.win, wall: res.wallRatio, used };
}

const table = {};
for (let seed = 1; seed <= seeds; seed++) {
  const sv = saves(seed);
  for (const n of levels) {
    for (const id of [null, ...ids]) {
      const r = run(sv[n], n, id, seed * 7 + n);
      const t = (table[id || '（不带）'] = table[id || '（不带）'] || { wall: 0, win: 0, used: 0, n: 0 });
      t.wall += r.wall;
      t.win += r.win ? 1 : 0;
      t.used += r.used ? 1 : 0;
      t.n++;
    }
  }
  console.error(`种子 ${seed} 完成`);
}
const base = table['（不带）'];
console.log(`关卡 ${levels.join(',')}，${seeds} 个种子，自动使用，共 ${base.n} 局`);
console.log('道具'.padEnd(10), '价格'.padEnd(10), '胜率', '  城墙剩余', '  比不带多', '  被用到');
for (const [id, t] of Object.entries(table)) {
  const it = D.items[id];
  const price = it ? P.costText(it.cost) : '';
  console.log(((it ? it.name : id)).padEnd(10), price.padEnd(10), `${Math.round((t.win / t.n) * 100)}%`.padStart(4), `${Math.round((t.wall / t.n) * 100)}%`.padStart(8), `${t.wall / t.n - base.wall / base.n >= 0 ? '+' : ''}${Math.round((t.wall / t.n - base.wall / base.n) * 100)}%`.padStart(9), `${Math.round((t.used / t.n) * 100)}%`.padStart(7));
}
