const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load');
const P = TD.progression;
const D = TD.data;
const M = TD.modes;

function save(h) {
  const s = P.newSave();
  for (let k = 1; k <= h; k++) s.levels[k] = { stars: 3, clears: 1 };
  return s;
}

test('契约试炼：第 20 关后开放；同一周同一关，下周换；两个不同诅咒 + 一张金卡', () => {
  assert.ok(!M.trialUnlocked(save(19)));
  assert.ok(M.trialUnlocked(save(20)));
  const s = save(60);
  const mon = new Date(2027, 2, 15); // 周一
  const sun = new Date(2027, 2, 21);
  const next = new Date(2027, 2, 22);
  assert.strictEqual(M.weekKey(mon), M.weekKey(sun));
  assert.notStrictEqual(M.weekKey(sun), M.weekKey(next));
  const a = M.trialInfo(s, mon);
  const b = M.trialInfo(s, sun);
  assert.deepStrictEqual([a.level, a.curses, a.boon], [b.level, b.curses, b.boon]);
  assert.strictEqual(a.curses.length, 2);
  assert.notStrictEqual(a.curses[0], a.curses[1]);
  assert.strictEqual(D.supplies[a.boon].rarity, 'gold');
  assert.ok(['normal', 'raid', 'armored', 'dark', 'union'].includes(D.levels[a.level].type));
});

test('契约试炼：开局诅咒和金卡生效；每周第一次通过给 1 金 3 银', () => {
  const s = save(60);
  const info = M.trialInfo(s, new Date(2027, 2, 15));
  const b = new TD.Battle({ level: info.level, levelDef: M.buildTrial(info), stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 3 });
  b.mode = { kind: 'trial', info };
  M.applyTrialStart(b, info);
  assert.deepStrictEqual(b.pactsTaken, info.curses);
  assert.ok(b.supplyPicked.includes(info.boon));
  const g0 = s.gold;
  const r = M.applyTrialResult(s, info, { win: true, killCopper: 100, kills: 10 });
  assert.strictEqual(r.gold, 1);
  assert.ok(s.gold >= g0 + 1);
  const r2 = M.applyTrialResult(s, info, { win: true, killCopper: 100, kills: 10 });
  assert.strictEqual(r2.gold, 0);
  assert.ok(M.trialInfo(s, new Date(2027, 2, 16)).done);
});
