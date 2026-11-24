const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load');
const P = TD.progression;

function run(n, autoCall) {
  const s = P.newSave();
  for (let k = 1; k < n; k++) s.levels[k] = { stars: 1, clears: 1 };
  s.copper = 20000;
  TD.bot.shop(s);
  P.recommend(s, n, { itemQty: 1, itemSlots: 3 });
  const lo = P.battleLoadout(s);
  lo.autoCast = true;
  const b = new TD.Battle({ level: n, stats: P.heroStats(s), loadout: lo, seed: 4, autoItems: true, autoSupply: true });
  b.autoCall = autoCall;
  let firstCallGap = null;
  b.on('earlyCall', () => {
    if (firstCallGap === null) firstCallGap = b.time - b.clearedAt;
  });
  const res = b.runToEnd();
  return { res, firstCallGap };
}

test('自动召唤：场上清空 1.2 秒后自动提前召唤，拿铜币、关卡更快', () => {
  const off = run(4, false);
  const on = run(4, true);
  assert.ok(on.res.win && off.res.win);
  assert.strictEqual(off.res.earlyCalls, 0);
  assert.ok(on.res.earlyCalls >= 1, 'early calls ' + on.res.earlyCalls);
  assert.ok(on.res.earlyCopper > 0);
  assert.ok(on.res.time < off.res.time, `${on.res.time} < ${off.res.time}`);
  assert.ok(on.firstCallGap >= TD.config.autoCallDelay - 1e-6 && on.firstCallGap < TD.config.autoCallDelay + 0.1, 'gap ' + on.firstCallGap);
});

test('自动召唤：场上还有怪时不召唤', () => {
  const s = P.newSave();
  const b = new TD.Battle({ level: 3, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  b.autoCall = true;
  b.startWave(0);
  b.spawnQueue = [];
  b.waveState = 'waiting';
  b.countdown = 10;
  b.spawnMonster('slime', 0);
  for (let i = 0; i < 120; i++) b.updateWaves(1 / 60);
  assert.strictEqual(b.earlyCalls, 0);
});
