// 结算页的数据整理：通知折叠、四张数据卡、滚动计数、星星、奖励明细
const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load');
const R = TD.resultView;

const mk = (kind, i) => ({ kind, text: kind + i });

test('foldNotes：不超过 3 条时全部展开', () => {
  const f = R.foldNotes([mk('note', 1), mk('unlock', 2), mk('achieve', 3)]);
  assert.strictEqual(f.shown.length, 3);
  assert.strictEqual(f.hidden.length, 0);
});

test('foldNotes：超过 3 条时按优先级展开前 3 条，其余折叠（不丢信息）', () => {
  const list = [mk('supply', 1), mk('note', 2), mk('rally', 3), mk('unlock', 4), mk('achieve', 5), mk('note', 6)];
  const f = R.foldNotes(list);
  assert.deepStrictEqual(
    f.shown.map((x) => x.kind),
    ['achieve', 'unlock', 'rally']
  );
  assert.strictEqual(f.hidden.length, 3);
  assert.strictEqual(f.shown.length + f.hidden.length, list.length);
  // 同级保持原顺序
  assert.deepStrictEqual(
    f.hidden.map((x) => x.text),
    ['note2', 'note6', 'supply1']
  );
});

test('foldNotes：只多 1 条时直接展开，不出现“还有 1 条”', () => {
  const f = R.foldNotes([mk('note', 1), mk('note', 2), mk('note', 3), mk('note', 4)]);
  assert.strictEqual(f.shown.length, 4);
  assert.strictEqual(f.hidden.length, 0);
});

test('foldNotes：空输入、自定义上限、不改原数组', () => {
  assert.deepStrictEqual(R.foldNotes([]), { shown: [], hidden: [] });
  assert.deepStrictEqual(R.foldNotes(null), { shown: [], hidden: [] });
  const list = [mk('note', 1), mk('achieve', 2), mk('note', 3), mk('note', 4), mk('note', 5)];
  const copy = list.slice();
  const f = R.foldNotes(list, 2);
  assert.strictEqual(f.shown.length, 2);
  assert.strictEqual(f.hidden.length, 3);
  assert.deepStrictEqual(list, copy);
});

test('fmtTime：分:秒', () => {
  assert.strictEqual(R.fmtTime(0), '0:00');
  assert.strictEqual(R.fmtTime(65), '1:05');
  assert.strictEqual(R.fmtTime(599.6), '10:00');
  assert.strictEqual(R.fmtTime(undefined), '0:00');
});

test('statCards：胜利 4 张卡，最后一张是城墙剩余', () => {
  const c = R.statCards({ win: true, time: 125, kills: 87, bestStreak: 23, wallRatio: 0.724 }, 10);
  assert.deepStrictEqual(
    c.map((x) => x.id),
    ['time', 'kills', 'streak', 'wall']
  );
  assert.deepStrictEqual(
    c.map((x) => x.value),
    ['2:05', '87', '23', '72%']
  );
});

test('statCards：失败时最后一张换成守到波数', () => {
  const c = R.statCards({ win: false, time: 40, kills: 3, bestStreak: 0, wallRatio: 0, wave: 4 }, 9);
  assert.strictEqual(c.length, 4);
  assert.strictEqual(c[3].id, 'wave');
  assert.strictEqual(c[3].value, '4/9');
});

test('countValue：单调、起点 0、终点恰好是目标', () => {
  assert.strictEqual(R.countValue(1234, 0), 0);
  assert.strictEqual(R.countValue(1234, 1), 1234);
  assert.strictEqual(R.countValue(1234, 2), 1234);
  let prev = -1;
  for (let i = 0; i <= 20; i++) {
    const v = R.countValue(1234, i / 20);
    assert.ok(v >= prev && v <= 1234);
    prev = v;
  }
  assert.ok(R.countValue(1000, 0.5) > 500, '先快后慢');
  assert.strictEqual(R.countValue(0, 0.5), 0);
});

test('starFlags：点亮的星数与 stars 一致', () => {
  assert.deepStrictEqual(R.starFlags(0), [false, false, false]);
  assert.deepStrictEqual(R.starFlags(2), [true, true, false]);
  assert.deepStrictEqual(R.starFlags(3), [true, true, true]);
});

test('rewardRows：基础两行 + 提前召唤 / 幸运加成按需出现', () => {
  const base = { baseCopper: 100, killCopper: 50, earlyCopper: 0, copperMult: 1 };
  assert.strictEqual(R.rewardRows(base, { kills: 9 }, true).length, 2);
  assert.strictEqual(R.rewardRows(base, { kills: 9 }, true)[0].label, '通关奖励');
  assert.strictEqual(R.rewardRows(base, { kills: 9 }, false)[0].label, '安慰奖励');
  const rich = R.rewardRows({ baseCopper: 100, killCopper: 50, earlyCopper: 8, copperMult: 1.25 }, { kills: 9 }, true);
  assert.deepStrictEqual(
    rich.map((r) => r.label),
    ['通关奖励', '击杀掉落（9 只）', '提前召唤', '幸运加成']
  );
  assert.strictEqual(rich[3].value, '×1.25');
});

test('与真实战斗结果配合：statCards 读得出 battle.result', () => {
  const lo = TD.progression.newSave();
  const b = new TD.Battle({ level: 1, stats: TD.progression.heroStats(lo), loadout: TD.progression.battleLoadout(lo), seed: 3 });
  b.runToEnd(30);
  const c = TD.resultView.statCards(b.result, b.totalWaves);
  assert.strictEqual(c.length, 4);
  assert.ok(c.every((x) => typeof x.value === 'string' && x.value.length));
});
