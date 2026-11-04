// 雇佣兵的故事与角色：数据完整性、剧情登记、翻译覆盖
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const TD = require('../tools/load');
const P = TD.progression;
const D = TD.data;

const len = (s) => Array.from(s).length;
const add = JSON.parse(fs.readFileSync(path.join(__dirname, '../i18n-add/mercstory.json'), 'utf8'));
const KEYS = { guard: 'merc11', archer: 'merc17', mage: 'merc29', cleric: 'merc44', knight: 'merc59', swordsman: 'merc5' };

test('每个兵种都有背景和三类台词，每类 3 句，每句 ≤ 12 字', () => {
  for (const id of D.mercOrder) {
    const l = D.mercLore[id];
    assert.ok(l, id);
    assert.ok(l.bio && len(l.bio) >= 20 && len(l.bio) <= 80, `${id} 背景长度 ${len(l.bio || '')}`);
    for (const kind of ['deploy', 'die', 'rank']) {
      assert.strictEqual(l[kind].length, 3, `${id}.${kind}`);
      assert.strictEqual(new Set(l[kind]).size, 3, `${id}.${kind} 重复`);
      for (const s of l[kind]) assert.ok(len(s) > 0 && len(s) <= 12, `${id}.${kind} "${s}" ${len(s)} 字`);
    }
  }
});

test('台词的英文译文也要短（飘字 ≤ 32 字符），且每句都有整句翻译', () => {
  for (const id of D.mercOrder) {
    const l = D.mercLore[id];
    assert.ok(add[l.bio], `${id} 背景缺翻译`);
    for (const kind of ['deploy', 'die', 'rank'])
      for (const s of l[kind]) {
        assert.ok(add[s], `缺翻译：${s}`);
        assert.ok(add[s].length <= 32, `${s} -> ${add[s]}`);
      }
  }
});

test('佣兵团长剧情：解锁关 − 1 对应一段，登记进 storyOrder 且能遍历', () => {
  assert.ok(D.speakers.captain && D.speakers.captain.name);
  for (const id of D.mercOrder) {
    const key = KEYS[id];
    assert.strictEqual(key, 'merc' + (D.mercs[id].unlock - 1), id);
    const sc = D.story[key];
    assert.ok(sc, key);
    assert.ok(D.storyOrder.includes(key), `${key} 没登记`);
    assert.strictEqual(D.storyOrder.filter((k) => k === key).length, 1);
    assert.ok(sc.diary, `${key} 缺日记`);
    assert.ok(sc.lines.length >= 2);
    assert.ok(sc.lines.some(([who]) => who === 'captain'));
    for (const [who, text] of sc.lines) {
      assert.ok(D.speakers[who], `${key} 说话人 ${who}`);
      assert.ok(add[text], `${key} 缺翻译：${text}`);
    }
    assert.ok(add[sc.title] && add[sc.diary]);
  }
  assert.ok(D.story.merc5.lines.length >= 4 && D.story.merc5.lines.length <= 6, '首次剧情 4–6 句');
  // 日记里的位置：在对应的战后对话 / 章节开场之后
  assert.ok(D.storyOrder.indexOf('merc5') > D.storyOrder.indexOf('post5'));
  assert.ok(D.storyOrder.indexOf('merc11') > D.storyOrder.indexOf('ch2'));
  assert.ok(D.storyOrder.indexOf('merc11') < D.storyOrder.indexOf('pre15'));
  assert.ok(D.storyOrder.indexOf('merc59') > D.storyOrder.indexOf('post55'));
});

test('剧情解锁 / 播放 / 老存档迁移：通关对应关卡才解锁，之前的老存档记为跳过', () => {
  const s = P.newSave();
  assert.ok(!P.storyUnlocked(s, 'merc5'));
  assert.ok(!P.storyDue(s, 'merc5'));
  s.levels[5] = { stars: 1, clears: 1 };
  assert.ok(P.storyUnlocked(s, 'merc5'));
  assert.ok(P.storyDue(s, 'merc5'));
  assert.ok(!P.storyUnlocked(s, 'merc11'));
  assert.ok(P.storyPassed(s, 'merc5'));
  P.markStory(s, 'merc5', true);
  assert.ok(!P.storyDue(s, 'merc5'), '读过不再自动播放');
  const old = P.newSave();
  for (let k = 1; k <= 12; k++) old.levels[k] = { stars: 1, clears: 1 };
  delete old.story;
  P.migrate(old);
  assert.strictEqual(old.story.merc5, 'skipped');
  assert.strictEqual(old.story.merc11, 'skipped');
  assert.ok(!old.story.merc17);
});

test('兵种解锁和剧情同步：mercUnlocked 变真的那一关，剧情同时变得可播', () => {
  for (const id of D.mercOrder) {
    const key = KEYS[id];
    const s = P.newSave();
    const n = D.mercs[id].unlock - 1;
    for (let k = 1; k < n; k++) s.levels[k] = { stars: 1, clears: 1 };
    assert.ok(!P.mercUnlocked(s, id) && !P.storyUnlocked(s, key), id);
    s.levels[n] = { stars: 1, clears: 1 };
    assert.ok(P.mercUnlocked(s, id) && P.storyUnlocked(s, key), id);
  }
});

test('全部通关后遍历 storyOrder 读完，日记成就仍能拿到', () => {
  const s = P.newSave();
  for (let k = 1; k <= Math.max(...Object.keys(D.levels).map(Number)); k++) s.levels[k] = { stars: 1, clears: 1 };
  s.stats.heroWins = { ding: 99, yan: 99, ying: 99, mu: 99 };
  let got = [];
  for (const k of D.storyOrder) {
    assert.ok(P.storyUnlocked(s, k), k);
    got = got.concat(P.markStory(s, k, true));
  }
  assert.ok(got.some((a) => a.id === 'diary'));
});
