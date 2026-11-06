// 刺客斩首（设计书 195）：现身后锁定牧师 / 法师 > 弓手 > 城墙；被近战兵碰到即死
const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load');

function mk(ids) {
  const P = TD.progression; const s = P.newSave();
  for (const id of TD.data.mercOrder) s.levels[TD.data.mercs[id].unlock - 1] = { stars: 3, clears: 1 };
  P.setMercLoadout(s, ids);
  const b = new TD.Battle({ level: 40, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 3 });
  b.hero.cooldown = 1e9; b.wall.hp = b.wall.max = 1e12; b.waveState = 'waiting'; b.funds = 9999; b.eliteOK = false;
  return b;
}
function put(b, i, x, lane) { b.deployMerc(i, lane); const u = b.mercs[b.mercs.length - 1]; u.x = x; u.lane = lane; u.y = b.laneY(lane); u.cool = 99; return u; }
function reveal(b, x, lane) {
  const m = b.spawnMonster('assassin', lane, x);
  m.stealthed = false; m.y = b.laneY(lane);
  return m;
}

test('锁定优先级：牧师 / 法师 > 弓手；隐身时无视兵', () => {
  const b = mk(['archer', 'mage', 'cleric']);
  const a = put(b, 0, 300, 1); const mg = put(b, 1, 260, 1); const cl = put(b, 2, 240, 1);
  const m = reveal(b, 480, 1);
  assert.ok(b.assassinTarget(m) === mg, '法师比弓手近且优先级高，先锁法师');
  mg.dead = true;
  assert.strictEqual(b.assassinTarget(m), cl, '没有法师就锁牧师');
  cl.dead = true;
  assert.strictEqual(b.assassinTarget(m), a, '都没有才弓手');
  m.stealthed = true;
  a.x = m.x - 8;
  assert.strictEqual(b.mercBlockerFor(m), null, '隐身时无视兵');
});

test('没有后排时退化：刺客无视前排，直奔城墙', () => {
  const b = mk(['guard', 'swordsman']);
  const g = put(b, 0, 300, 1);
  const m = reveal(b, 600, 1);
  assert.strictEqual(b.assassinTarget(m), null);
  m.x = g.x + 10;
  assert.strictEqual(b.mercBlockerFor(m), null, '前排拦不住它');
  m.x = 600; g.x = 100; // 兵离得很远，不会碰到
  const x0 = m.x;
  b.updateAssassin(m, 0.1);
  assert.strictEqual(m.lockId, 0, '没有锁定');
  for (let i = 0; i < 30; i++) b.step(1 / 60);
  assert.ok(m.x < x0 || m.dead, '继续往城墙走');
});

test('斩首：缠上后蓄力一击带走法师（盾墙也挡不住）；前排不在也能锁到不同车道的目标', () => {
  const b = mk(['guard', 'mage']);
  put(b, 0, 360, 0); // 盾卫在另一车道，不碰到刺客
  const mg = put(b, 1, 250, 1); mg.covered = true;
  const m = reveal(b, 330, 0); // 刺客在车道 0，法师在车道 1
  const g = b.mercs[0]; g.x = 700; // 把盾卫挪远，避免碰触
  for (let i = 0; i < 60 * 6 && !mg.dead; i++) b.step(1 / 60);
  assert.ok(m.lane === 1 || mg.dead, '换到目标车道');
  assert.ok(mg.dead, '法师被斩首');
  assert.ok(b.assassinKills >= 1);
});

test('锁定提示：目标 markT 被刷新（渲染据此画红色准星）', () => {
  const b = mk(['archer']);
  const a = put(b, 0, 300, 1);
  const m = reveal(b, 500, 1);
  b.updateAssassin(m, 0.016);
  assert.strictEqual(m.lockId, a.id);
  assert.strictEqual(a.markT, b.time);
});

test('被近战兵碰到即死：刺客贴近前排兵当场毙命，不伤到后排', () => {
  const b = mk(['guard', 'mage']);
  const g = put(b, 0, 300, 1); const mg = put(b, 1, 200, 1);
  const m = reveal(b, g.x + 20, 1);
  b.step(1 / 60);
  assert.ok(m.dead, '碰到盾卫就死');
  assert.ok(!mg.dead);
  assert.strictEqual(b.assassinKills || 0, 0);
});

test('关闭 assassinHunt 恢复旧行为（无视兵）', () => {
  const b = mk(['mage']);
  const mg = put(b, 0, 250, 1);
  TD.config.merc.assassinHunt = false;
  try {
    const m = reveal(b, mg.x + 5, 1);
    assert.strictEqual(b.mercBlockerFor(m), null);
  } finally { TD.config.merc.assassinHunt = true; }
});

test('图鉴说明已更新', () => {
  assert.ok(/锁定/.test(TD.data.monsters.assassin.desc));
});
