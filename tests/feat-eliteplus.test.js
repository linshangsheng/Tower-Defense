const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load');

function mk(mercIds) {
  const P = TD.progression;
  const s = P.newSave();
  for (const id of TD.data.mercOrder) s.levels[TD.data.mercs[id].unlock - 1] = { stars: 3, clears: 1 };
  P.setMercLoadout(s, mercIds || []);
  const b = new TD.Battle({ level: 30, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 7 });
  b.hero.cooldown = 1e9; b.wall.hp = b.wall.max = 1e12; b.waveState = 'waiting'; b.eliteOK = false;
  return b;
}

// 强制生成一只带指定词缀的精英：第 1 次 rng 过精英概率，第 2 次选词缀
function elite(b, affix, type) {
  const ks = Object.keys(TD.config.eliteAffixes);
  const old = TD.config.eliteRate;
  const rng = b.rng;
  let seq = 0;
  const fake = () => {
    seq++;
    if (seq === 1) return 0; // < eliteRate
    return rng();
  };
  fake.int = rng.int.bind(rng);
  // 词缀选择用的是 Math.floor(rng()*len)：在 spawn 之后直接改写最稳
  b.eliteOK = true;
  TD.config.eliteRate = 1;
  b.rng = fake;
  const orig = TD.config.eliteAffixes;
  TD.config.eliteAffixes = { [affix]: orig[affix] };
  const m = b.spawnMonster(type || 'slime', 1);
  TD.config.eliteAffixes = orig;
  b.rng = rng;
  TD.config.eliteRate = old;
  b.eliteOK = false;
  void ks;
  return m;
}

test('护盾精英：出生带 40% 血量护盾，先吸收伤害，没有 ai 也不崩', () => {
  const b = mk();
  const m = elite(b, 'shield');
  assert.strictEqual(m.affix, 'shield');
  assert.ok(m.elite && !m.ai, '普通怪没有 ai');
  assert.ok(Math.abs(m.shield - m.maxHp * 0.4) <= 1);
  const hp = m.hp;
  b.damage(m, m.shield * 0.5, { type: 'phys', source: 'weapon' });
  assert.strictEqual(m.hp, hp, '护盾吸收期间不掉血');
  assert.ok(m.shield > 0);
  b.damage(m, m.maxHp, { type: 'phys', source: 'weapon' }); // 击破（不能崩）
  assert.strictEqual(m.shield, 0);
  assert.strictEqual(m.hp, hp, '击破的这一击仍被吸收');
  b.damage(m, 1, { type: 'phys', source: 'weapon' });
  assert.ok(m.hp < hp, '护盾破了之后正常掉血');
});

test('召唤精英：每 6 秒一只同种小怪，最多 3 只，小怪不是精英且不掉奖励', () => {
  const b = mk();
  const m = elite(b, 'summon');
  assert.strictEqual(m.affix, 'summon');
  m.speedMult = 0;
  b.eliteOK = true; // 打开精英开关也不应让召唤物变精英
  TD.config.eliteRate = 1;
  for (let i = 0; i < 60 * 40; i++) { m.x = 900; b.step(1 / 60); }
  TD.config.eliteRate = 0.015;
  const kids = b.monsters.filter((o) => o.summonedBy === m.id && !o.dead);
  assert.strictEqual(kids.length, 3, '上限 3');
  for (const k of kids) { assert.ok(!k.elite); assert.strictEqual(k.type, m.type); assert.ok(k.noReward); }
  b.eliteOK = false;
  const kills = b.kills, cu = b.killCopper, drops = (b.drops || []).length;
  b.kill(kids[0]);
  assert.strictEqual(b.kills, kills);
  assert.strictEqual(b.killCopper, cu);
  assert.strictEqual((b.drops || []).length, drops);
});

test('援军光球：权重 8，三种分支', () => {
  assert.strictEqual(TD.data.drops.reinforce.w, 8);
  assert.strictEqual(TD.data.drops.reinforce.ico, 'flag');
  const drop = () => ({ id: 1, kind: 'reinforce', x: 300, y: 300, until: 99, copper: 1 });
  // 1) 带兵：免费来一个兵，不扣军饷、不进冷却
  let b = mk(['swordsman', 'guard']);
  b.drops = [];
  const f0 = b.funds;
  let d = drop(); b.drops.push(d);
  b.collectDrop(d);
  assert.strictEqual(b.mercs.length, 1);
  assert.strictEqual(b.funds, f0);
  assert.ok(b.mercSlots.every((s) => s.cd === 0));
  // 2) 场上已满：+50 军饷
  while (b.mercAlive() < TD.config.merc.cap) b.spawnMerc(0, 0);
  const n = b.mercs.length, f1 = b.funds;
  d = drop(); b.drops.push(d);
  b.collectDrop(d);
  assert.strictEqual(b.mercs.length, n);
  assert.strictEqual(b.funds, f1 + 50);
  // 3) 没带兵：+50 军饷
  b = mk();
  b.drops = [];
  const f2 = b.funds;
  d = drop(); b.drops.push(d);
  b.collectDrop(d);
  assert.strictEqual(b.funds, f2 + 50);
  assert.strictEqual(b.mercs.length, 0);
});
