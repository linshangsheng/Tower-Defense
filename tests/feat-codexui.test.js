// 图鉴 / 成就页的纯函数：过滤、分组、进度
const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load');
const X = TD.codex;
const D = TD.data;
const P = TD.progression;

const mk = (type, name, desc, tags, known, chapter) => ({ type, name, desc, tags, known, chapter });
const ITEMS = [
  mk('a', '绿团', '最基础的怪物，慢吞吞', [], true, 1),
  mk('b', '嗡嗡蜂', '成群飞行，直扑城墙', ['飞行'], true, 1),
  mk('c', '弓手', '远程攻击城墙', ['远程'], true, 2),
  mk('d', '巨龙', '大 Boss', ['大 Boss', '飞行'], true, 2),
  mk('e', '隐藏怪', '没见过的怪', ['飞行'], false, 2),
];
const EN = { 绿团: 'Green Blob', 嗡嗡蜂: 'Buzzbee', 弓手: 'Archer', 巨龙: 'Dragon', 最基础的怪物: 'basic' };
const tr = (s) => EN[s] || s;

test('图鉴：无搜索无类型时只看当前章节', () => {
  assert.deepStrictEqual(X.filterBestiary(ITEMS, { chapter: 1 }).map((i) => i.type), ['a', 'b']);
  assert.deepStrictEqual(X.filterBestiary(ITEMS, { chapter: 2 }).map((i) => i.type), ['c', 'd', 'e']);
});

test('图鉴：搜索跨章节，中英文都能搜，忽略大小写和空格', () => {
  assert.deepStrictEqual(X.filterBestiary(ITEMS, { query: '城墙', chapter: 1 }).map((i) => i.type), ['b', 'c']);
  assert.deepStrictEqual(X.filterBestiary(ITEMS, { query: 'green', chapter: 2, tr }).map((i) => i.type), ['a']);
  assert.deepStrictEqual(X.filterBestiary(ITEMS, { query: '  BUZZ ', chapter: 2, tr }).map((i) => i.type), ['b']);
  assert.deepStrictEqual(X.filterBestiary(ITEMS, { query: '飞行', chapter: 1 }).map((i) => i.type), ['b', 'd']);
});

test('图鉴：没解锁的怪物不会被搜出来；无结果返回空数组', () => {
  assert.ok(!X.filterBestiary(ITEMS, { query: '隐藏', chapter: 2 }).length);
  assert.ok(!X.filterBestiary(ITEMS, { typeKey: '飞行', chapter: 2 }).some((i) => i.type === 'e'));
  assert.deepStrictEqual(X.filterBestiary(ITEMS, { query: 'zzzqq', chapter: 1 }), []);
});

test('图鉴：类型过滤（Boss 同时匹配大小 Boss）与分段生成', () => {
  assert.deepStrictEqual(X.filterBestiary(ITEMS, { typeKey: 'Boss', chapter: 1 }).map((i) => i.type), ['d']);
  assert.deepStrictEqual(X.filterBestiary(ITEMS, { typeKey: '飞行', query: '龙', chapter: 1 }).map((i) => i.type), ['d']);
  const segs = X.typeSegments(ITEMS.filter((i) => i.known).map((i) => i.tags));
  assert.strictEqual(segs[0].key, 'all');
  assert.deepStrictEqual(segs.map((s) => s.key), ['all', '飞行']); // 远程、Boss 只有 1 只，不够 2 只不出现
});

test('图鉴：用真实怪物数据生成的类型分段包含飞行 / 远程 / 治疗 / Boss', () => {
  const tags = Object.keys(D.monsters).filter((t) => !D.monsters[t].towerOf).map((t) => D.monsterTags(D.monsters[t]));
  const keys = X.typeSegments(tags, 99).map((s) => s.key);
  for (const k of ['all', '飞行', '远程', '治疗', 'Boss']) assert.ok(keys.includes(k), k);
});

test('成就：每个成就都分到一个组，没有重复 id，组内保持原顺序', () => {
  const all = D.achievements;
  const groups = X.groupAchievements(all, {});
  assert.strictEqual(groups.reduce((a, g) => a + g.total, 0), all.length);
  assert.ok(!groups.some((g) => g.key === 'other'), '现有成就不应落进"其他"：' + all.filter((a) => X.groupOf(a.id) === 'other').map((a) => a.id));
  const ids = groups.flatMap((g) => g.items.map((a) => a.id));
  assert.strictEqual(new Set(ids).size, all.length);
  for (const g of groups) {
    const idx = g.items.map((a) => all.indexOf(a));
    assert.deepStrictEqual(idx, idx.slice().sort((x, y) => x - y));
  }
  const merc = groups.find((g) => g.key === 'merc');
  assert.deepStrictEqual(merc.items.map((a) => a.id), ['merc30', 'mercKill200', 'mercLv5']);
});

test('成就：分组完成数', () => {
  const g = X.groupAchievements(D.achievements, { merc30: true, first: true, ch1: true }).reduce((o, x) => ((o[x.key] = x.done), o), {});
  assert.strictEqual(g.merc, 1);
  assert.strictEqual(g.campaign, 2);
  assert.strictEqual(g.combat, 0);
});

test('成就：累计类进度（累计雇佣 30 个）', () => {
  const s = P.newSave();
  const a = D.achievements.find((x) => x.id === 'merc30');
  s.stats.mercDeployed = 12;
  let p = X.achProgress(a, s);
  assert.deepStrictEqual([p.cur, p.target, p.tracked, p.done], [12, 30, true, false]);
  assert.ok(Math.abs(p.ratio - 0.4) < 1e-9);
  s.stats.mercDeployed = 99; // 超过目标不会溢出
  p = X.achProgress(a, s);
  assert.deepStrictEqual([p.cur, p.ratio], [30, 1]);
});

test('成就：已完成的成就进度是满的；没有量化条件的只有完成态', () => {
  const s = P.newSave();
  const a = D.achievements.find((x) => x.id === 'merc30');
  s.achievements.merc30 = true;
  const p = X.achProgress(a, s);
  assert.deepStrictEqual([p.cur, p.target, p.done], [30, 30, true]);
  const u = X.achProgress(D.achievements.find((x) => x.id === 'ultimate'), s);
  assert.strictEqual(u.tracked, false);
  assert.strictEqual(u.ratio, 0);
  s.achievements.ultimate = true;
  assert.strictEqual(X.achProgress(D.achievements.find((x) => x.id === 'ultimate'), s).ratio, 1);
});

test('成就：章节通关进度、星星、最大值类进度', () => {
  const s = P.newSave();
  for (let k = 1; k <= 7; k++) s.levels[k] = { stars: 2, clears: 1 };
  const ch1 = X.achProgress(D.achievements.find((x) => x.id === 'ch1'), s);
  assert.deepStrictEqual([ch1.cur, ch1.target], [7, 10]);
  const st = X.achProgress(D.achievements.find((x) => x.id === 'stars50'), s);
  assert.deepStrictEqual([st.cur, st.target], [14, 50]);
  const all = X.achProgress(D.achievements.find((x) => x.id === 'starsAll'), s);
  assert.strictEqual(all.target, Object.keys(D.levels).length * 3);
  s.mercLv = { archer: 2, knight: 4 };
  assert.strictEqual(X.achProgress(D.achievements.find((x) => x.id === 'mercLv5'), s).cur, 4);
});

test('成就：所有声明了进度的成就 id 都真实存在，且进度函数在空存档上不会抛错', () => {
  const s = P.newSave();
  for (const a of D.achievements) {
    const p = X.achProgress(a, s);
    assert.ok(p.cur >= 0 && p.cur <= p.target, a.id);
    assert.ok(p.ratio >= 0 && p.ratio <= 1, a.id);
  }
  const ids = new Set(D.achievements.map((a) => a.id));
  for (const g of X.GROUPS) for (const id of g.ids) assert.ok(ids.has(id), '分组里的 id 不存在：' + id);
});

test('成就：总完成度与环形进度偏移', () => {
  const o = X.overall(D.achievements, { first: true, ch1: true });
  assert.strictEqual(o.done, 2);
  assert.strictEqual(o.total, D.achievements.length);
  assert.strictEqual(o.pct, Math.round((2 / D.achievements.length) * 100));
  assert.deepStrictEqual(X.overall([], {}), { done: 0, total: 0, ratio: 0, pct: 0 });
  assert.strictEqual(X.ringOffset(100, 0), 100);
  assert.strictEqual(X.ringOffset(100, 1), 0);
  assert.strictEqual(X.ringOffset(100, 0.25), 75);
  assert.strictEqual(X.ringOffset(100, 5), 0); // 越界夹住
});
