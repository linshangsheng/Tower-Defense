// 今日任务（设计书 197）
const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load.js');
const P = TD.progression;
const Q = TD.quests;

const save = (n) => { const s = P.newSave(); for (let i = 1; i <= n; i++) s.levels[i] = { stars: 3, clears: 1 }; return s; };
const D1 = new Date(2027, 1, 10, 12), D2 = new Date(2027, 1, 11, 12);

test('同一天固定 3 个不同任务，第二天换新', () => {
  const a = Q.rollFor('2027-02-10'), b = Q.rollFor('2027-02-10'), c = Q.rollFor('2027-02-11');
  assert.deepStrictEqual(a, b);
  assert.strictEqual(new Set(a).size, 3);
  assert.ok(a.every((id) => Q.POOL[id]));
  const s = save(10);
  const st1 = Q.today(s, D1);
  st1.list[0].prog = 1;
  assert.strictEqual(Q.today(s, D1).list[0].prog, 1, '同一天保留进度');
  const st2 = Q.today(s, D2);
  assert.ok(st2.list.every((q) => q.prog === 0 && !q.claimed), '第二天换新');
  assert.notDeepStrictEqual(Q.rollFor('2027-02-10'), c.length ? Q.rollFor('2027-02-12') : null);
});

test('第 5 关前不开放、不累计', () => {
  const s = save(3);
  assert.strictEqual(Q.unlocked(s), false);
  assert.deepStrictEqual(Q.onBattle(s, { kills: 999 }, true, D1), []);
  assert.strictEqual(Q.claimable(s, D1), 0);
});

test('战斗累计进度：累计型相加、单场型取最大，到目标封顶；刚完成的会报出来', () => {
  const s = save(10);
  const st = Q.today(s, D1);
  st.list = [{ id: 'kills', prog: 0, claimed: false }, { id: 'streak', prog: 0, claimed: false }, { id: 'wins', prog: 0, claimed: false }];
  Q.onBattle(s, { kills: 300, bestStreak: 20 }, true, D1);
  Q.onBattle(s, { kills: 300, bestStreak: 10 }, false, D1);
  assert.strictEqual(st.list[0].prog, Q.POOL.kills.goal, '击杀累计并封顶');
  assert.strictEqual(st.list[1].prog, 20, '连击取单场最大');
  assert.strictEqual(st.list[2].prog, 1, '只有赢的那场算');
  const fresh = Q.onBattle(s, { bestStreak: 45 }, true, D1);
  assert.deepStrictEqual(fresh, [Q.label('streak')]);
});

test('领取：未完成不能领、完成领一次、三个都领完才能领额外奖励', () => {
  const s = save(10);
  const st = Q.today(s, D1);
  st.list.forEach((q) => (q.prog = 0));
  assert.strictEqual(Q.claim(s, 0, D1), null);
  st.list.forEach((q) => (q.prog = Q.POOL[q.id].goal));
  assert.strictEqual(Q.claimable(s, D1), 3);
  const c0 = s.copper;
  assert.ok(Q.claim(s, 0, D1));
  assert.ok(s.copper > c0);
  assert.strictEqual(Q.claim(s, 0, D1), null, '不能重复领');
  assert.strictEqual(Q.claimBonus(s, D1), null, '还没领完');
  Q.claim(s, 1, D1); Q.claim(s, 2, D1);
  const sv = s.silver;
  assert.ok(Q.claimBonus(s, D1));
  assert.ok(s.silver > sv);
  assert.strictEqual(Q.claimBonus(s, D1), null);
  assert.strictEqual(Q.claimable(s, D1), 0);
});

test('主线结算把战斗结果计入今日任务（recordStats 挂钩）', () => {
  const s = save(10);
  const st = Q.today(s);
  st.list = [{ id: 'kills', prog: 0, claimed: false }, { id: 'wins', prog: 0, claimed: false }, { id: 'drops', prog: 0, claimed: false }];
  P.recordStats(s, { kills: 50, drops: 2, killsByType: {} }, true);
  assert.strictEqual(st.list[0].prog, 50);
  assert.strictEqual(st.list[1].prog, 1);
  assert.strictEqual(st.list[2].prog, 2);
});

test('坏存档：quests 字段被改坏也能自愈', () => {
  const s = save(10);
  s.quests = 'oops';
  const m = P.migrate(s);
  const st = Q.today(m, D1);
  assert.strictEqual(st.list.length, 3);
  m.quests.list.push({ id: 'nope', prog: 1 });
  assert.strictEqual(Q.today(m, D1).list.length, 3, '未知任务丢掉');
});

test('今日任务：每天免费换 1 个没完成的任务（设计书 205）', () => {
  const TD = require('../tools/load');
  const P = TD.progression;
  const Q = TD.quests;
  const s = P.newSave();
  for (let k = 1; k <= 5; k++) s.levels[k] = { stars: 1, clears: 1 };
  const d = new Date(2027, 2, 8);
  const st = Q.today(s, d);
  const before = st.list.map((q) => q.id);
  st.list[0].prog = 1;
  assert.ok(Q.canReroll(s, 0, d));
  const id = Q.reroll(s, 0, d, () => 0);
  assert.ok(id && !before.includes(id));
  assert.strictEqual(s.quests.list[0].prog, 0);
  assert.ok(!Q.canReroll(s, 1, d), '一天只能换一次');
  assert.strictEqual(Q.reroll(s, 1, d), null);
  // 第二天又能换；已完成的不能换
  const d2 = new Date(2027, 2, 9);
  const st2 = Q.today(s, d2);
  st2.list[1].prog = Q.POOL[st2.list[1].id].goal;
  assert.ok(!Q.canReroll(s, 1, d2));
  assert.ok(Q.canReroll(s, 0, d2));
});

test('今日任务：要通关到一定关卡的任务（契约）只在解锁后才会抽到（设计书 218）', () => {
  const TD = require('../tools/load');
  const P = TD.progression;
  const Q = TD.quests;
  const low = P.newSave();
  for (let k = 1; k <= 8; k++) low.levels[k] = { stars: 1, clears: 1 };
  const high = P.newSave();
  for (let k = 1; k <= 40; k++) high.levels[k] = { stars: 1, clears: 1 };
  let sawLow = false;
  let sawHigh = false;
  for (let d = 0; d < 400; d++) {
    const key = '2027-' + (d % 12) + '-' + d;
    if (Q.rollFor(key, low).includes('pact')) sawLow = true;
    if (Q.rollFor(key, high).includes('pact')) sawHigh = true;
  }
  assert.ok(!sawLow);
  assert.ok(sawHigh);
  assert.strictEqual(Q.POOL.synergy.stat({ supplySets: ['a', 'b'] }), 2);
});
