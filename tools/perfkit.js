// 性能基准 / 回放测试共用：构造"带 6 个兵的大规模战斗"（弱英雄 + 不倒城墙，让怪物堆起来）
const TD = require('./load');
const P = TD.progression;

function makeBattle(level, seed, opts) {
  opts = opts || {};
  const save = P.newSave();
  for (let k = 1; k <= 200; k++) save.levels[k] = { stars: 1, clears: 1 };
  P.setMercLoadout(save, ['guard', 'knight', 'archer']);
  const lo = P.battleLoadout(save);
  lo.active = [];
  lo.autoCast = false;
  if (opts.mercs === false) lo.mercs = [];
  const b = new TD.Battle({ level, stats: P.heroStats(save), loadout: lo, seed, autoMercs: true, autoSupply: true, rally: 0 });
  b.wall.max = b.wall.hp = 1e13;
  if (opts.mercs !== false) b.funds = 1e9;
  return b;
}

function stepOnce(b, dt) {
  if (b.pendingSupply) b.chooseSupply(b.botSupplyChoice(b.pendingSupply));
  b.step(dt);
}

module.exports = { TD, makeBattle, stepOnce };
