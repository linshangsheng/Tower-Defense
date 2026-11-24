const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load');
const P = TD.progression;
const X = TD.chest;

function seq(vals) {
  let i = 0;
  return () => vals[i++ % vals.length];
}

test('胜利宝箱：准备 3 张卡，翻开 1 张发奖励并清空', () => {
  const s = P.newSave();
  X.rand = seq([0.9, 0.5, 0.01, 0.3, 0.2]);
  const c = X.prepare(s, 12, 3);
  assert.strictEqual(c.cards.length, 3);
  assert.ok(X.pending(s));
  const kinds = c.cards.map((x) => x.kind);
  assert.deepStrictEqual(kinds, ['copper', 'silver', 'item']);
  const base = TD.config.rewards.baseCopper(12);
  assert.ok(c.cards[0].amount >= base * 0.35 - 5 && c.cards[0].amount <= base * 0.7 + 5);
  const cu = s.copper;
  const r = X.open(s, 0);
  assert.strictEqual(s.copper, cu + c.cards[0].amount);
  assert.strictEqual(r.cards.length, 3);
  assert.strictEqual(X.pending(s), null);
  assert.strictEqual(X.open(s, 1), null, '只能翻一次');
  assert.strictEqual(s.stats.chests, 1);
  X.rand = Math.random;
});

test('胜利宝箱：银币和道具卡；坏数据不会发出离谱的奖励', () => {
  const s = P.newSave();
  X.rand = seq([0.01]);
  X.prepare(s, 5, 3);
  const ag = s.silver;
  X.open(s, 2);
  assert.strictEqual(s.silver, ag + 1);
  X.rand = seq([0.3, 0]);
  const c = X.prepare(s, 8, 1);
  assert.strictEqual(c.cards[0].kind, 'item');
  const id = c.cards[0].id;
  X.open(s, 0);
  assert.strictEqual(s.inventory[id], TD.config.chest.itemQty);
  s.pendingChest = { n: 5, cards: [{ kind: 'silver', amount: 1e9 }, { kind: 'copper', amount: 'x' }, {}] };
  const ag2 = s.silver;
  X.open(s, 0);
  assert.ok(s.silver - ag2 <= 3);
  s.pendingChest = { cards: 'bad' };
  assert.strictEqual(X.pending(s), null);
  X.rand = Math.random;
});

test('胜利宝箱：机器人结算（applyResult）不会准备宝箱，数值标定不受影响', () => {
  const s = P.newSave();
  P.applyResult(s, 1, { win: true, wallRatio: 1, killCopper: 0, earlyCopper: 0, kills: 1 });
  assert.ok(!s.pendingChest);
});

test('最快通关纪录（设计书 212）：第一次只记下，之后更快才算新纪录', () => {
  const s = P.newSave();
  const r1 = P.applyResult(s, 3, { win: true, wallRatio: 1, time: 120.04, kills: 1 });
  assert.strictEqual(s.levels[3].bestTime, 120);
  assert.ok(!r1.newBest);
  const r2 = P.applyResult(s, 3, { win: true, wallRatio: 1, time: 130, kills: 1 });
  assert.ok(!r2.newBest);
  assert.strictEqual(s.levels[3].bestTime, 120);
  const r3 = P.applyResult(s, 3, { win: true, wallRatio: 1, time: 101.26, kills: 1 });
  assert.deepStrictEqual(r3.newBest, { time: 101.3, prev: 120 });
  assert.ok(r3.notes.some((x) => x.includes('最快通关')));
  P.applyResult(s, 3, { win: false, wallRatio: 0, time: 10, kills: 1 });
  assert.strictEqual(s.levels[3].bestTime, 101.3, '失败不算');
});
