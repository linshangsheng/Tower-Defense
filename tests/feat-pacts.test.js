const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load');
const P = TD.progression;
const D = TD.data;

function battle(n, seed) {
  const s = P.newSave();
  for (let k = 1; k < n; k++) s.levels[k] = { stars: 1, clears: 1 };
  return new TD.Battle({ level: n, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: seed || 3 });
}

test('契约：第 15 关起有时出现，给一张红 / 金卡；机器人（自动补给）和前期关卡不会出现', () => {
  let seen = 0;
  for (let i = 1; i <= 60; i++) {
    const b = battle(25, i);
    b.startWave(0);
    b.offerSupply();
    if (b.pendingPact) {
      seen++;
      assert.ok(['red', 'gold'].includes(D.supplies[b.pendingPact.card].rarity));
      assert.ok(D.pactCurses[b.pendingPact.curse]);
    }
  }
  assert.ok(seen > 8 && seen < 40, 'seen ' + seen);
  for (let i = 1; i <= 30; i++) {
    const b = battle(10, i);
    b.startWave(0);
    b.offerSupply();
    assert.strictEqual(b.pendingPact, null);
  }
  const s = P.newSave();
  const bot = new TD.Battle({ level: 25, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1, autoSupply: true });
  assert.strictEqual(bot.pactOn(), false);
});

test('契约：接受后诅咒生效、拿到卡、铜币 +20%，并继续下一波', () => {
  const b = battle(25, 5);
  b.startWave(0);
  b.pendingSupply = ['sharp', 'quick', 'eagle'];
  b.pendingPact = { curse: 'hp', card: 'overdrive' };
  const cb = b.mods.copperBonus;
  const atk = b.mods.atkMult;
  assert.ok(b.choosePact());
  assert.strictEqual(b.curseHp, 0.25);
  assert.ok(b.supplyPicked.includes('overdrive'));
  assert.ok(Math.abs(b.mods.copperBonus - cb - 0.2) < 1e-9);
  assert.ok(b.mods.atkMult > atk);
  assert.strictEqual(b.waveIndex, 1);
  assert.deepStrictEqual(b.pactsTaken, ['hp']);
  // 之后出的怪血量更高
  const m = b.spawnMonster('slime', 0);
  const b2 = battle(25, 5);
  const m2 = b2.spawnMonster('slime', 0);
  assert.ok(m.maxHp > m2.maxHp * 1.2);
});

test('契约：城墙契约降低上限；没有待选补给时不能接受', () => {
  const b = battle(25, 5);
  const max = b.wall.max;
  b.startWave(0);
  b.pendingSupply = ['sharp', 'quick', 'eagle'];
  b.pendingPact = { curse: 'wall', card: 'midas' };
  b.choosePact();
  assert.strictEqual(b.wall.max, Math.round(max * 0.85));
  assert.ok(b.wall.hp <= b.wall.max);
  assert.strictEqual(b.choosePact(), false);
});

test('无尽模式也会出现契约（设计书 213），妖塔和每日挑战不会', () => {
  const s = P.newSave();
  for (let k = 1; k <= 30; k++) s.levels[k] = { stars: 3, clears: 1 };
  const def = TD.modes.buildEndless(s, 7);
  const b = new TD.Battle({ level: 'endless', levelDef: def, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 7 });
  b.mode = { kind: 'endless' };
  assert.ok(b.pactOn());
  b.mode = { kind: 'daily' };
  assert.ok(!b.pactOn());
  b.mode = null;
  assert.ok(!b.pactOn());
});
