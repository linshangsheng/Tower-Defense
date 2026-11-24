const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load');
const P = TD.progression;
const D = TD.data;

function battle(n) {
  const s = P.newSave();
  for (let k = 1; k < n; k++) s.levels[k] = { stars: 1, clears: 1 };
  return new TD.Battle({ level: n, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 3 });
}

test('补给羁绊：数据有效，两张卡都存在', () => {
  assert.ok(D.supplySets.length >= 8);
  for (const s of D.supplySets) {
    assert.strictEqual(s.cards.length, 2);
    for (const id of s.cards) assert.ok(D.supplies[id], id);
    for (const k of Object.keys(s.mods)) assert.ok(k in battle(5).mods, `mod ${k}`);
  }
});

test('补给羁绊：凑齐两张后生效一次，加成叠到 mods 上', () => {
  const b = battle(12);
  let ev = null;
  b.on('supplySet', (e) => (ev = e));
  b.startWave(0);
  b.pendingSupply = ['sharp', 'quick', 'purse'];
  const crit0 = b.mods.crit;
  b.chooseSupply('sharp');
  assert.strictEqual(ev, null);
  assert.deepStrictEqual(b.supplySetHint('eagle'), { kind: 'complete', set: D.supplySets.find((s) => s.id === 'marksman') });
  assert.strictEqual(b.supplySetHint('quick').kind, 'part');
  b.pendingSupply = ['eagle', 'quick', 'purse'];
  b.chooseSupply('eagle');
  assert.ok(ev && ev.set.id === 'marksman');
  assert.ok(Math.abs(b.mods.crit - (crit0 + 0.08 + 0.06)) < 1e-9);
  assert.deepStrictEqual(b.activeSets, ['marksman']);
  assert.strictEqual(b.checkSupplySets().length, 0, '不会重复生效');
  assert.strictEqual(b.supplySetHint('sharp'), null);
});

test('补给羁绊：拿了一半后，三选一里出现另一半的机会明显变高', () => {
  let seen = 0;
  const N = 300;
  for (let i = 0; i < N; i++) {
    const b = battle(12);
    b.rng = TD.util.rng ? TD.util.rng(1000 + i) : b.rng;
    b.supplyPicked = ['sharp'];
    if (b.rollSupply().includes('eagle')) seen++;
  }
  assert.ok(seen / N > 0.3, `partner shows ${seen}/${N}`);
});

test('补给羁绊：结果里的羁绊记进档案，成就按发现数量达成（设计书 207）', () => {
  const s = P.newSave();
  const five = D.supplySets.slice(0, 5).map((x) => x.id);
  P.recordStats(s, { kills: 1, supplySets: five }, true);
  for (const id of five) assert.ok(s.stats.setsFound[id]);
  let got = P.checkAchievements(s).map((a) => a.id);
  assert.ok(got.includes('sets5') && !got.includes('setsAll'));
  P.recordStats(s, { kills: 1, supplySets: D.supplySets.map((x) => x.id) }, true);
  got = P.checkAchievements(s).map((a) => a.id);
  assert.ok(got.includes('setsAll'));
  s.stats.setsFound = 'bad';
  P.recordStats(s, { kills: 1, supplySets: ['marksman'] }, true);
  assert.deepStrictEqual(s.stats.setsFound, { marksman: true });
});
