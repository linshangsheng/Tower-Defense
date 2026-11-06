// 冲阵：大块头怪物撞上兵时把前排兵击退并眩晕
const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load');
const C = TD.config;
const D = TD.data;

const mk = (ids) => {
  const P = TD.progression;
  const s = P.newSave();
  for (const id of D.mercOrder) s.levels[D.mercs[id].unlock - 1] = { stars: 3, clears: 1 };
  P.setMercLoadout(s, ids);
  const b = new TD.Battle({ level: 20, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 3 });
  b.hero.cooldown = 1e9;
  b.wall.hp = b.wall.max = 1e12;
  b.waveState = 'waiting';
  b.eliteOK = false;
  b.funds = 999;
  return b;
};
// 在 x 处放一个兵，再把怪放到刚好贴住它
const setup = (ids, mon, x = 500) => {
  const b = mk(ids);
  b.deployMerc(0, 1);
  const u = b.mercs[0];
  u.x = x;
  u.hp = u.maxHp = 1e6;
  const m = b.spawnMonster(mon, 1, x + 20);
  return { b, u, m };
};

test('数据：6 种大块头带冲阵，图鉴说明里写了', () => {
  const ids = ['stump', 'yeti', 'steelYeti', 'lavaGolem', 'moltenGolem', 'ironChariot'];
  for (const id of ids) {
    const t = D.monsters[id].trample;
    assert.ok(t && t.every >= 4 && t.kick >= 50 && t.stun >= 0.8 && t.stun <= 1.2, id);
    assert.ok(D.monsters[id].desc.includes('撞'), id + ' 说明');
  }
  assert.ok(!D.monsters.slime.trample && !D.monsters.rockGolem.trample, '普通怪和 Boss 不冲阵');
});

test('撞上兵：击退一段距离并眩晕', () => {
  const { b, u, m } = setup(['swordsman'], 'lavaGolem');
  const x0 = u.x;
  b.step(1 / 60);
  const T = D.monsters.lavaGolem.trample;
  assert.ok(Math.abs(x0 - u.x - T.kick) < 1, '退了 kick 距离: ' + (x0 - u.x));
  assert.ok(Math.abs(u.stunUntil - b.time - T.stun) < 0.05, '眩晕 ' + T.stun);
  assert.strictEqual(b.trampleCount, 1);
  assert.ok(m.trampleAt > b.time);
});

test('眩晕期间兵不能动不能打，结束后恢复', () => {
  const { b, u, m } = setup(['swordsman'], 'lavaGolem');
  b.step(1 / 60);
  const hp = m.hp;
  const x = u.x;
  m.x = u.x + 100; // 怪离远一点，免得又被拦住
  for (let i = 0; i < 40; i++) b.step(1 / 60); // 约 0.67s，仍在眩晕
  assert.strictEqual(u.state, 'stun');
  assert.strictEqual(u.x, x);
  assert.strictEqual(m.hp, hp);
  for (let i = 0; i < 60; i++) b.step(1 / 60);
  assert.notStrictEqual(u.state, 'stun');
});

test('冷却：同一只怪每 every 秒才能冲一次', () => {
  const { b, u, m } = setup(['swordsman'], 'moltenGolem');
  const T = m.def.trample;
  b.step(1 / 60);
  assert.strictEqual(b.trampleCount, 1);
  const again = () => {
    u.x = m.x - 10;
    u.trampleImmune = 0;
    u.stunUntil = 0;
    m.stunUntil = m.frozenUntil = 0;
    return b.trampleMercs(m);
  };
  assert.strictEqual(again(), false, '冷却中');
  assert.strictEqual(b.trampleCount, 1);
  b.time += T.every + 0.1;
  assert.strictEqual(again(), true, '冷却好了');
  assert.strictEqual(b.trampleCount, 2);
});

test('盾卫抗性：眩晕减半，击退不变', () => {
  const sw = setup(['swordsman'], 'steelYeti');
  const gd = setup(['guard'], 'steelYeti');
  const sx = sw.u.x;
  const gx = gd.u.x;
  sw.b.step(1 / 60);
  gd.b.step(1 / 60);
  const T = D.monsters.steelYeti.trample;
  const sStun = sw.u.stunUntil - sw.b.time;
  const gStun = gd.u.stunUntil - gd.b.time;
  assert.ok(Math.abs(sStun - T.stun) < 0.05);
  assert.ok(Math.abs(gStun - T.stun * C.merc.trampleGuard) < 0.05, '盾卫眩晕减半 ' + gStun);
  assert.strictEqual(C.merc.trampleGuard, 0.5);
  assert.ok(Math.abs(sx - sw.u.x - (gx - gd.u.x)) < 1e-6, '击退距离相同');
});

test('不会把兵撞进城墙；只撞贴身前排；眩晕后有免疫', () => {
  const near = setup(['swordsman'], 'lavaGolem', C.wallX + 50);
  near.b.step(1 / 60);
  assert.ok(near.u.x >= C.wallX + 40 - 1e-9, '停在墙前');
  const b = mk(['swordsman', 'archer']);
  b.deployMerc(0, 1);
  b.deployMerc(1, 1);
  const [f, a] = b.mercs;
  f.x = 500;
  a.x = 380;
  f.hp = f.maxHp = a.hp = a.maxHp = 1e6;
  b.spawnMonster('lavaGolem', 1, 520);
  b.step(1 / 60);
  assert.ok(f.stunUntil > b.time && !(a.stunUntil > b.time), '只有贴身前排被撞');
  assert.ok(f.trampleImmune > f.stunUntil, '眩晕后有免疫窗口');
  const m2 = b.spawnMonster('moltenGolem', 1, f.x + 15);
  b.step(1 / 60);
  assert.ok(!m2.trampleAt, '免疫期内第二只怪没撞到人，也没消耗冷却');
});

test('冻住 / 眩晕的怪冲不了；没带兵时不触发', () => {
  const { b, u, m } = setup(['swordsman'], 'lavaGolem');
  m.stunUntil = b.time + 5;
  b.step(1 / 60);
  assert.strictEqual(b.trampleCount || 0, 0);
  assert.ok(!(u.stunUntil > b.time));
  const b2 = new TD.Battle({ level: 20, stats: TD.progression.heroStats(TD.progression.newSave()), loadout: { active: [], items: [], mercs: [] }, seed: 1 });
  const m3 = b2.spawnMonster('lavaGolem', 1, 400);
  for (let i = 0; i < 60; i++) b2.step(1 / 60);
  assert.ok(!m3.trampleAt);
});
