// 商店页统一规范的纯函数：缺口计算、折叠提示状态、分段控件
const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load');
const S = TD.shopui;

test('shortage：够了返回 null，不够只列缺口', () => {
  assert.strictEqual(S.shortage({ copper: 30 }, { copper: 30 }), null);
  assert.strictEqual(S.shortage({ copper: 30 }, { copper: 100, silver: 0 }), null);
  assert.deepStrictEqual(S.shortage({ copper: 30 }, { copper: 12 }), { copper: 18 });
  assert.deepStrictEqual(S.shortage({ copper: 10, gold: 5 }, { copper: 50, gold: 2 }), { gold: 3 });
  assert.deepStrictEqual(S.shortage({ silver: 4, diamond: 10 }, {}), { silver: 4, diamond: 10 });
});

test('shortage：空价格 / 缺字段不报错', () => {
  assert.strictEqual(S.shortage(null, { copper: 1 }), null);
  assert.strictEqual(S.shortage({}, {}), null);
  assert.strictEqual(S.shortage({ copper: 5 }, null).copper, 5);
});

test('shortageParts：按铜 / 银 / 金 / 钻固定顺序', () => {
  assert.deepStrictEqual(S.shortageParts({ diamond: 2, copper: 7 }), [['copper', 7], ['diamond', 2]]);
  assert.deepStrictEqual(S.shortageParts(null), []);
});

test('shortage 与 progression.canAfford 一致', () => {
  const P = TD.progression;
  const s = P.newSave();
  for (const cost of [{ copper: 1 }, { copper: 99999 }, { silver: 3 }, { gold: 1, copper: 5 }, { diamond: 1 }]) {
    assert.strictEqual(S.shortage(cost, s) === null, P.canAfford(s, cost));
  }
});

test('折叠提示：默认折叠，切换开合，各 id 互不影响', () => {
  const st = {};
  assert.strictEqual(S.tipOpen(st, 'items'), false);
  assert.strictEqual(S.tipToggle(st, 'items'), true);
  assert.strictEqual(S.tipOpen(st, 'items'), true);
  assert.strictEqual(S.tipOpen(st, 'skills'), false);
  assert.strictEqual(S.tipToggle(st, 'items'), false);
  assert.strictEqual(S.tipOpen(undefined, 'x'), false);
});

test('分段控件：选中项唯一，非法值退回第一项', () => {
  const a = S.segments([0, 1, 2, 3], 2);
  assert.deepStrictEqual(a.filter((x) => x.on).map((x) => x.id), [2]);
  assert.deepStrictEqual(S.segments([0, 1, 2], 9).filter((x) => x.on).map((x) => x.id), [0]);
});
