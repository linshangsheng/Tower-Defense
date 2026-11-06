const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load');
const P = TD.progression;
const T = TD.titleinfo;

test('新存档：首次启动，没有最近进度', () => {
  const s = P.newSave();
  assert.strictEqual(T.isFirstRun(s), true);
  assert.strictEqual(T.progress(s), null);
  assert.strictEqual(T.progressText(s), '');
});

test('只玩过没通关（clears=0）仍算首次启动', () => {
  const s = P.newSave();
  s.levels[1] = { stars: 0, clears: 0 };
  assert.strictEqual(T.isFirstRun(s), true);
});

test('最近进度：最高通关关数、章节名、累计星数', () => {
  const s = P.newSave();
  for (let k = 1; k <= 23; k++) s.levels[k] = { stars: k % 3 === 0 ? 3 : 2, clears: 1 };
  const stars = Object.values(s.levels).reduce((a, r) => a + r.stars, 0);
  const p = T.progress(s);
  assert.strictEqual(p.level, 23);
  assert.strictEqual(p.stars, stars);
  assert.strictEqual(p.chapter, TD.data.chapterOf(23).name);
  assert.strictEqual(T.progressText(s), `第 23 关 · ${p.chapter} · ${stars} 星`);
  assert.strictEqual(T.isFirstRun(s), false);
});

test('坏记录不会让进度计算崩溃', () => {
  const s = P.newSave();
  s.levels[5] = { stars: 3, clears: 2 };
  s.levels[6] = null;
  assert.strictEqual(T.progress(s).level, 5);
});
