// 机器人智能雇兵（botmerc）：smart 策略在构造场景里的决策
const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load');
const P = TD.progression;

function mk(ids, policy) {
  const s = P.newSave();
  for (const id of TD.data.mercOrder) s.levels[TD.data.mercs[id].unlock - 1] = { stars: 3, clears: 1 };
  P.setMercLoadout(s, ids);
  const b = new TD.Battle({ level: 20, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 3 });
  b.hero.cooldown = 1e9; b.wall.hp = b.wall.max = 1e12; b.waveState = 'waiting'; b.eliteOK = false;
  b.monsters = [];
  b.mercPolicy = policy || 'smart';
  b.funds = 999;
  return b;
}
const mon = (b, type, lane, x) => { const m = b.spawnMonster(type, lane, x); m.x = x; return m; };
const alive = (b) => b.mercs.filter((u) => !u.dead);
const traitOf = (id) => Object.keys(TD.data.monsters).find((k) => TD.data.monsters[k].trait && TD.data.monsters[k].trait.id === id);

test('后排兵雇在已有盾卫的车道（即使最近的怪在别的车道）', () => {
  const b = mk(['guard', 'archer', 'swordsman']);
  b.deployMerc(0, 2);
  b.mercSlots[2].cd = 99;
  mon(b, 'goblin', 2, 900);
  mon(b, 'goblin', 0, 600);
  b.rallyAt = 1e9;
  b.autoMercs();
  const a = alive(b).find((u) => u.type === 'archer');
  assert.ok(a, '弓手被雇了');
  assert.strictEqual(a.lane, 2);
});

test('simple 策略保持旧行为：派到最近的怪所在车道', () => {
  const b = mk(['guard', 'archer', 'swordsman'], 'simple');
  b.deployMerc(0, 2);
  mon(b, 'goblin', 0, 600);
  b.mercSlots[2].cd = 99;
  b.autoMercs();
  const a = alive(b).find((u) => u.type === 'archer');
  assert.ok(a && a.lane === 0);
});

test('狼出现在有后排的车道：给后排补近战兵', () => {
  const b = mk(['guard', 'archer', 'swordsman']);
  b.deployMerc(0, 1); b.deployMerc(1, 1);
  b.mercSlots.forEach((s) => (s.cd = 0));
  mon(b, traitOf('flank'), 1, 800);
  b.autoMercs();
  assert.ok(alive(b).some((u) => u.type === 'swordsman' && u.lane === 1));
});

test('蝙蝠俯冲：车道里没有远程输出就补远程兵', () => {
  const b = mk(['guard', 'cleric', 'archer']);
  b.deployMerc(0, 0); b.deployMerc(1, 0);
  b.mercSlots.forEach((s) => (s.cd = 0));
  mon(b, traitOf('dive'), 0, 800);
  b.autoMercs();
  assert.ok(alive(b).some((u) => u.type === 'archer' && u.lane === 0));
});

test('压力在别的车道、兵都不在那里：使用集结令；冷却中不再集结', () => {
  const b = mk(['guard', 'swordsman', 'archer']);
  b.deployMerc(0, 0); b.deployMerc(1, 0);
  for (let i = 0; i < 4; i++) mon(b, 'goblin', 2, 300 + i * 40);
  b.rallyAt = 0;
  b.autoMercs();
  assert.ok(alive(b).every((u) => u.lane === 2));
  assert.strictEqual(b.rallies, 1);
  b.monsters = [];
  for (let i = 0; i < 4; i++) mon(b, 'goblin', 0, 280 + i * 20);
  b.autoMercs();
  assert.strictEqual(b.rallies, 1);
});

test('资金管理：没有盾卫时给盾卫留钱，不花光买别的兵', () => {
  const b = mk(['guard', 'swordsman', 'archer']);
  const g = b.mercCost(0), sw = b.mercCost(1);
  mon(b, 'goblin', 1, 700);
  b.funds = sw + g - 1;
  b.mercSlots[0].cd = 5;
  b.autoMercs();
  assert.strictEqual(alive(b).length, 0, '为盾卫留钱');
  b.funds = sw + g;
  b.autoMercs();
  assert.strictEqual(alive(b).length, 1);
});

test('Bot.playLevel 支持 mercPolicy / carryMercs，且默认 smart', () => {
  const save = P.newSave();
  for (let k = 1; k <= 12; k++) save.levels[k] = { stars: 1, clears: 1 };
  for (const o of [{ mercPolicy: 'simple' }, {}, { carryMercs: false }]) {
    const { res, battle } = TD.bot.playLevel(TD.util.deepClone(save), 13, o);
    assert.ok(typeof res.win === 'boolean');
    assert.strictEqual(battle.mercPolicy, o.mercPolicy || 'smart');
    if (o.carryMercs === false) assert.strictEqual(battle.mercsOn, false);
  }
});
