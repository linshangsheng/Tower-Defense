// 英雄与雇佣兵的联动（羁绊）
const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load');
const P = TD.progression;
const L = TD.config.merc.link;

function mk(skills, opts) {
  const s = P.newSave();
  for (const id of TD.data.mercOrder) s.levels[TD.data.mercs[id].unlock - 1] = { stars: 3, clears: 1 };
  P.setMercLoadout(s, ['swordsman', 'archer', 'guard']);
  const lo = P.battleLoadout(s);
  lo.active = (skills || []).slice();
  lo.autoCast = false;
  if (opts && opts.ult) lo.ultimate = true;
  const b = new TD.Battle({ level: 20, stats: P.heroStats(s), loadout: lo, seed: 3 });
  b.hero.cooldown = 1e9;
  b.wall.hp = b.wall.max = 1e12;
  b.waveState = 'waiting';
  b.eliteOK = false;
  b.funds = 1e6;
  return b;
}
function addMercs(b, n) {
  for (let i = 0; i < n; i++) {
    const k = i % 3;
    b.mercSlots[k].cd = 0;
    assert.ok(b.deployMerc(k, 1));
  }
}
const tick = (b, sec) => { for (let i = 0; i < sec * 60; i++) b.step(1 / 60); };

test('羁绊：每个兵 +3% 攻速，封顶 +15%，兵死了就减少', () => {
  const b = mk();
  const base = b.currentAspd();
  tick(b, 0.5);
  assert.ok(Math.abs(b.currentAspd() - base) < 1e-9, '没有兵没有加成');
  addMercs(b, 3);
  tick(b, 0.6);
  assert.ok(Math.abs(b.currentAspd() / base - 1.09) < 1e-6, '3 个兵 +9%，实际 ' + b.currentAspd() / base);
  assert.strictEqual(b.bond, 0.09);
  addMercs(b, 3);
  tick(b, 0.6);
  assert.ok(Math.abs(b.currentAspd() / base - 1.15) < 1e-6, '6 个兵触及上限 +15%');
  assert.ok(b.bondBonus() <= L.aspdCap + 1e-9);
  b.mercs[0].dead = true;
  tick(b, 0.6);
  assert.ok(Math.abs(b.currentAspd() / base - 1.15) < 1e-6, '5 个兵仍是 +15%');
  b.mercs[1].dead = true;
  tick(b, 0.6);
  assert.ok(Math.abs(b.currentAspd() / base - 1.12) < 1e-6, '4 个兵 +12%');
  assert.ok(b.buffs.filter((x) => x.src === 'bond').length <= 1, 'bond buff 不重复堆叠');
});

test('羁绊：关闭开关时没有任何联动', () => {
  const b = mk();
  addMercs(b, 2);
  L.on = false;
  try {
    tick(b, 1);
    assert.strictEqual(b.bondBonus(), 0);
    assert.strictEqual(b.mercHaste(), 1);
  } finally { L.on = true; }
});

test('战鼓：兵的攻击间隔也缩短（鼓点加成的一半）', () => {
  const b = mk(['drum']);
  addMercs(b, 1);
  assert.strictEqual(b.mercHaste(), 1);
  assert.ok(b.castSkill(0));
  const want = 1 + TD.data.activeSkills.drum.aspdBonus * L.drumShare;
  assert.ok(Math.abs(b.mercHaste() - want) < 1e-9);
  const u = b.mercs[0];
  u.cool = 10;
  const m = b.spawnMonster('goblin', 1, 300);
  m.hp = m.maxHp = 1e12;
  m.speedMult = 0;
  u.x = 260;
  m.x = 285;
  const c0 = u.cool;
  b.step(1 / 60);
  assert.ok(c0 - u.cool > (1 / 60) * 1.2, '冷却下降比正常速度快');
  tick(b, 9);
  assert.strictEqual(b.mercHaste(), 1, '鼓结束后恢复');
});

test('修缮：兵同时回血', () => {
  const b = mk(['repair']);
  addMercs(b, 2);
  for (const u of b.mercs) u.hp = u.maxHp * 0.2;
  assert.ok(b.castSkill(0));
  const r = TD.data.activeSkills.repair.healRatio * L.repairShare;
  for (const u of b.mercs) assert.ok(Math.abs(u.hp / u.maxHp - (0.2 + r)) < 1e-9);
});

test('掩护射击：箭雨命中兵身边的怪 +15%，没兵时没有', () => {
  const run = (withMerc) => {
    const b = mk(['arrowRain']);
    if (withMerc) {
      addMercs(b, 1);
      b.mercs[0].x = 400;
    }
    const m = b.spawnMonster('goblin', 1, 430);
    m.speedMult = 0;
    m.hp = m.maxHp = 1e12;
    const seen = [];
    const orig = b.damage.bind(b);
    b.damage = (t, a, o) => {
      if (o && o.source === 'arrowRain') seen.push(a);
      return orig(t, a, o);
    };
    b.rain = { left: 1, every: 1, timer: 0, dmg: 100, ignite: false };
    b.updateRain(0.01);
    return { seen, b };
  };
  const a = run(false);
  const c = run(true);
  assert.ok(a.seen.length === 1 && c.seen.length === 1);
  assert.ok(Math.abs(c.seen[0] / a.seen[0] - L.coverMult) < 1e-9);
  assert.strictEqual(c.b.coverHits, 1);
  assert.ok(!a.b.coverHits);
});

test('万箭天降：期间兵无敌 2 秒，之后恢复受伤', () => {
  const b = mk([], { ult: true });
  addMercs(b, 2);
  const u = b.mercs[0];
  const hp0 = u.hp;
  while (b.waveState === 'prepare') b.step(1 / 60);
  assert.ok(b.startUltimate());
  b.mercHurt(u, 999999, null);
  assert.strictEqual(u.hp, hp0, '无敌期间不掉血');
  assert.ok(!u.dead);
  tick(b, L.ultInvuln + 0.1);
  b.mercHurt(u, 1, null);
  assert.ok(u.hp < hp0, '2 秒后正常受伤');
});
