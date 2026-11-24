const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load');
const P = TD.progression;

function battle(n) {
  const s = P.newSave();
  for (let k = 1; k < n; k++) s.levels[k] = { stars: 1, clears: 1 };
  return new TD.Battle({ level: n, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 2 });
}

test('下一波预告：数量和真正出怪的队列一致', () => {
  for (const n of [5, 40, 72, 135]) {
    const b = battle(n);
    for (let i = 0; i < b.totalWaves; i++) {
      const pre = b.wavePreview(i);
      b.startWave(i);
      const real = {};
      for (const t of b.spawnQueue) {
        const k = t[0] === '@' ? t.slice(1) : t;
        real[k] = (real[k] || 0) + 1;
      }
      const got = {};
      for (const it of pre) got[it.type] = it.count;
      assert.deepStrictEqual(got, real, `第 ${n} 关第 ${i + 1} 波`);
    }
  }
});

test('下一波预告：Boss 排最前；准备阶段预告第 1 波，最后一波和补给中不预告', () => {
  const b = battle(10);
  const last = b.wavePreview(b.totalWaves - 1);
  assert.ok(last[0].boss);
  assert.strictEqual(b.previewWaveIndex(), 0);
  b.startWave(0);
  assert.strictEqual(b.previewWaveIndex(), -1, '出怪中');
  b.waveState = 'waiting';
  assert.strictEqual(b.previewWaveIndex(), 1);
  b.pendingSupply = ['x'];
  assert.strictEqual(b.previewWaveIndex(), -1);
  b.pendingSupply = null;
  b.waveIndex = b.totalWaves - 1;
  assert.strictEqual(b.previewWaveIndex(), -1);
  assert.strictEqual(b.wavePreview(99), null);
});
