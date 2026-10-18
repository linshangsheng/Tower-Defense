// 九层妖塔难度标定（设计书 74.5）：战役机器人打到第 N 关留下的存档，逐层挑战妖塔，统计每一层的通过率和城墙剩余
// 用法：node tools/tower.js [--levels 60,70] [--seeds 3] [--floors 1,2,3,4,5,6,7,8,9] [--base 1] [--grow 1.15] [--independent]
const TD = require('./load');
const P = TD.progression;
const D = TD.data;
const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const levels = arg('--levels', '60,70').split(',').map(Number);
const seeds = +arg('--seeds', 3);
const floors = arg('--floors', '1,2,3,4,5,6,7,8,9').split(',').map(Number);
if (arg('--base')) D.tower.base = +arg('--base');
if (arg('--grow')) D.tower.grow = +arg('--grow');
const LAST = Math.max(...levels);

// 战役机器人打到各关之前的存档（缓存到 /tmp，换系数重跑时不用重新打战役）
const fs = require('fs');
function saves(seed) {
  const cache = `/tmp/tower-saves-${seed}-${levels.join('_')}.json`;
  if (fs.existsSync(cache) && !args.includes('--fresh')) return JSON.parse(fs.readFileSync(cache, 'utf8'));
  const out = build(seed);
  fs.writeFileSync(cache, JSON.stringify(out));
  return out;
}
function build(seed) {
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
  // 打完最后一关后的存档（这时已通关 LAST 关）
  out.final = TD.util.deepClone(save);
  return out;
}

// 土豪存档：资源拉满，把能买的都买了、所有武器练满，挑 DPS 最高的武器（--whale）
function whale(save) {
  P.maxResources(save);
  for (let i = 0; i < 8; i++) TD.bot.shop(save);
  for (const id of Object.keys(D.equipment)) save.equipOwned[id] = true;
  let best = null;
  for (const id of Object.keys(D.weapons)) {
    save.weapons[id] = { owned: true, lv: D.weaponUpgrade.max, asc: !!D.weapons[id].ascend };
    const dps = P.estimateDps(P.heroStats(save, { weapon: id }));
    if (!best || dps > best.dps) best = { id, dps };
  }
  save.loadout.weapon = best.id;
  return best.id;
}

function runFloor(save, floor, seed, wallRatio) {
  const s = TD.util.deepClone(save);
  s.towerRun = { floor, state: 'battle', wallRatio };
  if (args.includes('--whale')) whale(s);
  P.recommend(s, 60);
  const lo = P.battleLoadout(s);
  lo.autoCast = true;
  const def = TD.modes.buildTower(s, floor);
  const b = new TD.Battle({ level: 'tower', levelDef: def, stage: def.stage, stats: P.heroStats(s), loadout: lo, seed, autoItems: true, autoSupply: true, difficulty: 'normal' });
  let guard = 0;
  while (!b.over && guard++ < 60 * 900) b.step(1 / 60);
  const res = b.over ? b.result : { win: false };
  return { win: !!res.win, wall: b.wall.hp / b.wall.max, time: b.time };
}

const rows = {};
for (let seed = 1; seed <= seeds; seed++) {
  const sv = saves(seed);
  for (const n of levels) {
    // 这个存档是"打第 n 关之前"的，加上第 n 关通关后就是"已通关 n 关"
    const base = TD.util.deepClone(sv[n]);
    for (let k = 1; k <= n; k++) if (!base.levels[k] || !base.levels[k].clears) base.levels[k] = { stars: 1, clears: 1 };
    // 一趟挑战从第 1 层爬起，城墙血量接着上一层（设计书 78.2）；输了以后的层都算没过。--independent：每层单独打、城墙满血
    let ratio = 1;
    let alive = true;
    for (const f of floors) {
      let r = { win: false, wall: 0, time: 0 };
      if (alive) {
        r = runFloor(base, f, seed * 7 + f, args.includes('--independent') ? 1 : ratio);
        if (!r.win) alive = false;
        else if (!args.includes('--independent')) ratio = Math.max(0.01, r.wall);
      }
      const key = n + ':' + f;
      (rows[key] = rows[key] || []).push(r);
    }
  }
  console.log(`种子 ${seed} 完成`);
}
console.log(`妖塔标定：base=${D.tower.base} grow=${D.tower.grow}；${seeds} 个种子`);
console.log('已通关  层  通过率  平均城墙剩余  平均用时(秒)');
for (const n of levels)
  for (const f of floors) {
    const rs = rows[n + ':' + f];
    const win = rs.filter((r) => r.win).length;
    const wall = rs.reduce((a, r) => a + r.wall, 0) / rs.length;
    const time = rs.reduce((a, r) => a + r.time, 0) / rs.length;
    console.log(`${String(n).padStart(4)}   ${f}   ${Math.round((100 * win) / rs.length)}%   ${Math.round(wall * 100)}%   ${Math.round(time)}`);
  }
