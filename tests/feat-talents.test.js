// 兵种天赋：解锁时机、选择生效、洗点、存档迁移
const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load');
const P = TD.progression;
const D = TD.data;
const C = TD.config;

function saveWith(ids, lv) {
  const s = P.newSave();
  for (const id of D.mercOrder) s.levels[D.mercs[id].unlock - 1] = { stars: 3, clears: 1 };
  for (const id of ids) s.mercLv[id] = lv;
  P.setMercLoadout(s, ids);
  return s;
}

function mk(id, lv, picks, level = 20) {
  const s = saveWith([id], lv);
  s.mercTalent[id] = picks;
  const b = new TD.Battle({ level, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 3 });
  b.hero.cooldown = 1e9; b.wall.hp = b.wall.max = 1e12; b.waveState = 'waiting'; b.eliteOK = false;
  b.funds = 1e6;
  assert.ok(b.deployMerc(0, 1));
  return { b, u: b.mercs[0], s };
}

const iconNames = [...require('node:fs').readFileSync(require('node:path').join(__dirname, '../src/ui/icons.js'), 'utf8').matchAll(/^    (\w+): \{/gm)].map((m) => m[1]);

test('每个兵种都有 3 档、每档 2 条天赋，数据完整', () => {
  for (const id of D.mercOrder) {
    assert.strictEqual(D.mercTalents[id].length, 3, id);
    for (const tier of D.mercTalents[id]) {
      assert.strictEqual(tier.length, 2);
      for (const t of tier) assert.ok(t.name && t.desc && t.icon && t.fx && iconNames.includes(t.icon), id + t.id);
    }
  }
  assert.deepStrictEqual(C.merc.talentLevels, [3, 6, 9]);
});

test('解锁时机：3 / 6 / 9 级各开一档，没到等级不能选', () => {
  const s = saveWith(['swordsman'], 1);
  assert.strictEqual(P.mercTalentTiers(s, 'swordsman'), 0);
  assert.strictEqual(P.mercTalentChoose(s, 'swordsman', 0, 0).ok, false);
  const tiers = (lv) => { s.mercLv.swordsman = lv; return P.mercTalentTiers(s, 'swordsman'); };
  assert.deepStrictEqual([2, 3, 5, 6, 8, 9, 10].map(tiers), [0, 1, 1, 2, 2, 3, 3]);
  s.mercLv.swordsman = 3;
  assert.strictEqual(P.mercTalentChoose(s, 'swordsman', 1, 0).ok, false, '6 级才能选第二档');
  assert.strictEqual(P.mercTalentChoose(s, 'swordsman', 0, 1).ok, true);
  assert.deepStrictEqual(P.mercTalentPicks(s, 'swordsman'), [1, null, null]);
  // 没解锁的兵种选不了
  const s2 = P.newSave(); s2.mercLv.guard = 9;
  assert.strictEqual(P.mercTalentChoose(s2, 'guard', 0, 0).ok, false);
});

test('洗点：第一次选免费，改选花铜币（按档位递增），钱不够不行', () => {
  const s = saveWith(['mage'], 9);
  s.copper = 1000;
  assert.strictEqual(P.mercTalentChoose(s, 'mage', 0, 0).cost, 0);
  assert.strictEqual(s.copper, 1000);
  assert.strictEqual(P.mercTalentChoose(s, 'mage', 0, 0).ok, false, '选同一条不扣钱');
  assert.strictEqual(P.mercTalentRespecCost(s, 'mage', 0), C.merc.respecBase);
  assert.strictEqual(P.mercTalentChoose(s, 'mage', 0, 1).ok, true);
  assert.strictEqual(s.copper, 1000 - C.merc.respecBase);
  P.mercTalentChoose(s, 'mage', 2, 0);
  s.copper = 10;
  assert.strictEqual(P.mercTalentChoose(s, 'mage', 2, 1).ok, false, '钱不够');
  assert.deepStrictEqual(P.mercTalentPicks(s, 'mage'), [1, null, 0]);
  assert.strictEqual(P.mercTalentRespecCost(s, 'mage', 1), 0, '没选过的档位免费');
});

test('存档迁移：新存档有 mercTalent，旧存档补齐，坏数据容错', () => {
  assert.deepStrictEqual(P.newSave().mercTalent, {});
  const old = P.newSave(); delete old.mercTalent;
  assert.deepStrictEqual(P.migrate(old).mercTalent, {});
  const bad = P.migrate(Object.assign(P.newSave(), { mercTalent: { swordsman: [1, 'x', 7, 9], ghost: [0], guard: 'zz', mage: [0] } }));
  assert.deepStrictEqual(bad.mercTalent, { swordsman: [1, null, null], mage: [0, null, null] });
  const bad2 = P.migrate(Object.assign(P.newSave(), { mercTalent: 5 }));
  assert.deepStrictEqual(bad2.mercTalent, {});
  const ok = P.newSave(); ok.mercTalent = { archer: [0, 1, 0] };
  assert.deepStrictEqual(P.migrate(JSON.parse(JSON.stringify(ok))).mercTalent, { archer: [0, 1, 0] });
});

test('进战斗的兵带着天赋；等级不够的选择不生效', () => {
  const s = saveWith(['archer'], 4);
  s.mercTalent.archer = [1, 1, 1]; // 4 级只有第一档生效
  assert.deepStrictEqual(P.battleLoadout(s).mercs[0].talents, [1, 1, 1]);
  const { u } = mk('archer', 4, [1, 1, 1]);
  assert.ok(Math.abs(u.every - D.mercs.archer.every / 1.25) < 1e-9, '速射 +25% 攻速');
  assert.strictEqual(u.fx.hp, undefined, '坚韧 9 级才生效');
  const base = mk('archer', 4, [null, null, null]).u;
  assert.strictEqual(base.every, D.mercs.archer.every);
  assert.strictEqual(u.maxHp, base.maxHp);
  const hi = mk('archer', 9, [1, 1, 1]).u;
  const hiBase = mk('archer', 9, [null, null, null]).u;
  assert.ok(Math.abs(hi.maxHp / hiBase.maxHp - 1.4) < 1e-9, '坚韧 +40% 血量');
});

test('数值类天赋：盾卫铁壁 / 骑士精锐 / 法师聚能与扩爆', () => {
  const g = mk('guard', 3, [0, null, null]);
  const g0 = mk('guard', 3, [null, null, null]);
  const slime = g.b.spawnMonster('slime', 1, 700);
  g.u.hp = g.u.maxHp; g0.u.hp = g0.u.maxHp;
  g.b.mercHurt(g.u, 100, slime); g0.b.mercHurt(g0.u, 100, slime);
  assert.ok(Math.abs((g.u.maxHp - g.u.hp) - 55) < 1e-6, '减伤 45%');
  assert.ok(Math.abs((g0.u.maxHp - g0.u.hp) - 65) < 1e-6, '减伤 35%');
  const k = mk('knight', 9, [0, 1, 1]); const k0 = mk('knight', 9, [null, null, null]);
  assert.ok(Math.abs(k.u.maxHp / k0.u.maxHp - 1.25) < 1e-9 && Math.abs(k.u.dmg / k0.u.dmg - 1.25) < 1e-9, '长枪 +15% 与精锐 +10% 相加');
  const m = mk('mage', 9, [0, 0, 0]); const m0 = mk('mage', 9, [null, null, null]);
  assert.ok(Math.abs(m.u.aoe / m0.u.aoe - 1.25) < 1e-9);
  const m2 = mk('mage', 9, [0, 1, 0]);
  assert.ok(Math.abs(m2.u.dmg / m0.u.dmg - 1.2) < 1e-9);
});

test('复仇反伤、不死保命、灼烧与减速', () => {
  const g = mk('guard', 3, [1, null, null]);
  const gob = g.b.spawnMonster('goblin', 1, 700);
  const hp0 = gob.hp;
  g.b.mercHurt(g.u, 100, gob);
  assert.ok(gob.hp < hp0, '反伤让攻击者掉血');
  const sw = mk('swordsman', 9, [0, 0, 1]);
  const mon = sw.b.spawnMonster('slime', 1, 700);
  sw.b.mercHurt(sw.u, sw.u.maxHp * 5, mon);
  assert.ok(!sw.u.dead && Math.abs(sw.u.hp - sw.u.maxHp * 0.3) < 1e-6, '不死：留 30% 血');
  sw.b.mercHurt(sw.u, sw.u.maxHp * 5, mon);
  assert.ok(sw.u.dead, '只有一次');
  const mg = mk('mage', 3, [0, null, null]);
  const t = mg.b.spawnMonster('knight' in D.monsters ? 'goblin' : 'goblin', 1, 600);
  mg.b.mercAttack(mg.u, t);
  assert.ok(t.burnUntil > mg.b.time && t.burnDps > 0, '灼烧');
  const mf = mk('mage', 3, [1, null, null]);
  const t2 = mf.b.spawnMonster('goblin', 1, 600);
  mf.b.mercAttack(mf.u, t2);
  assert.ok(t2.slowUntil > mf.b.time && t2.slowAmt === 0.4, '减速 40%');
});

test('穿云射穿、破甲对高护甲加伤、牧师庇护与复苏', () => {
  const a = mk('archer', 3, [0, null, null]);
  const m1 = a.b.spawnMonster('goblin', 1, 500), m2 = a.b.spawnMonster('goblin', 1, 560);
  const h1 = m1.hp, h2 = m2.hp;
  a.b.mercAttack(a.u, m1);
  assert.ok(m1.hp < h1 && m2.hp < h2, '穿云打到第二个');
  const a0 = mk('archer', 3, [1, null, null]);
  const n1 = a0.b.spawnMonster('goblin', 1, 500), n2 = a0.b.spawnMonster('goblin', 1, 560);
  a0.b.mercAttack(a0.u, n1);
  assert.strictEqual(n2.hp, n2.maxHp, '没选穿云就只打一个');

  const s = saveWith(['cleric', 'swordsman'], 3); s.mercTalent.cleric = [0, null, null];
  const b = new TD.Battle({ level: 20, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 3 });
  b.hero.cooldown = 1e9; b.wall.hp = b.wall.max = 1e12; b.waveState = 'waiting'; b.eliteOK = false; b.funds = 1e6;
  b.deployMerc(1, 1); b.deployMerc(0, 1);
  const sw = b.mercs[0], c = b.mercs[1];
  sw.hp = sw.maxHp * 0.5; sw.x = c.x;
  for (let i = 0; i < 30; i++) b.step(1 / 60);
  assert.ok(sw.hp > sw.maxHp * 0.5, '治疗了');
  assert.ok(sw.protectUntil > b.time, '庇护：目标获得减伤');
  const s3 = saveWith(['cleric', 'swordsman'], 3); s3.mercTalent.cleric = [1, null, null];
  const b3 = new TD.Battle({ level: 20, stats: P.heroStats(s3), loadout: P.battleLoadout(s3), seed: 3 });
  b3.hero.cooldown = 1e9; b3.wall.hp = b3.wall.max = 1e12; b3.waveState = 'waiting'; b3.eliteOK = false; b3.funds = 1e6;
  b3.deployMerc(1, 1); b3.deployMerc(0, 1);
  const sw3 = b3.mercs[0]; sw3.hp = sw3.maxHp * 0.5; sw3.x = b3.mercs[1].x;
  for (let i = 0; i < 30; i++) b3.step(1 / 60);
  const healed3 = sw3.hp - sw3.maxHp * 0.5, healed = sw.hp - sw.maxHp * 0.5;
  assert.ok(Math.abs(healed3 / healed - 1.3) < 1e-6, '复苏 +30% 治疗量');
});

test('骑士：不屈冲锋回血、复冲重新装填', () => {
  const k = mk('knight', 9, [1, 0, 0]);
  const t = k.b.spawnMonster('goblin', 1, 400);
  k.u.hp = k.u.maxHp * 0.5;
  k.b.mercAttack(k.u, t);
  assert.ok(Math.abs(k.u.hp - k.u.maxHp * 0.7) < 1e-6, '回 20%');
  const r = mk('knight', 9, [0, 0, 0]);
  const t2 = r.b.spawnMonster('goblin', 1, 400);
  r.b.mercAttack(r.u, t2);
  assert.strictEqual(r.u.charging, false);
  assert.ok(r.u.rechargeAt > r.b.time);
  for (let i = 0; i < 60 * 11; i++) r.b.step(1 / 60);
  assert.strictEqual(r.u.charging, true, '10 秒后可以再冲锋');
});

test('六个兵种全开天赋的战斗能正常运行，数值不出 NaN', () => {
  for (const id of D.mercOrder) {
    const picks = [0, 1, 0];
    const { b } = mk(id, 10, picks);
    for (let i = 0; i < 60 * 5; i++) b.step(1 / 60);
    assert.ok(b.mercs.every((u) => Number.isFinite(u.hp)), id);
  }
});
