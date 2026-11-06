// 剧情字幕：逐字显示的纯逻辑 + 剧情数据流（storyui）
const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load');
require('../src/ui/storytext.js');
const ST = TD.storyText;
const D = TD.data;
const P = TD.progression;

test('旁白判断：空 / null / narrator 是旁白，角色不是', () => {
  assert.ok(ST.isNarration(''));
  assert.ok(ST.isNarration(null));
  assert.ok(ST.isNarration(undefined));
  assert.ok(ST.isNarration('narrator'));
  assert.ok(!ST.isNarration('dang'));
  assert.ok(!ST.isNarration('king'));
});

test('逐字切片：按字符不劈 emoji，越界安全', () => {
  const chars = ST.chars('A👑B');
  assert.strictEqual(chars.length, 3);
  assert.strictEqual(ST.slice(chars, 0), '');
  assert.strictEqual(ST.slice(chars, 2), 'A👑');
  assert.strictEqual(ST.slice(chars, 99), 'A👑B');
  assert.strictEqual(ST.slice(chars, -3), '');
  assert.deepStrictEqual(ST.chars(null), []);
});

test('逐字节奏：标点后停得更久，且恒为正', () => {
  assert.ok(ST.delay('。') > ST.delay('，'));
  assert.ok(ST.delay('，') > ST.delay('字'));
  assert.ok(ST.delay('!') > ST.delay('a'));
  assert.ok(ST.delay('x') > 0);
});

test('每句台词打完的时间有限（最长的一句不超过 15 秒）', () => {
  let worst = 0;
  for (const key of D.storyOrder) {
    for (const [, text] of D.story[key].lines) worst = Math.max(worst, ST.duration(ST.chars(text)));
  }
  assert.ok(worst < 15000, `最长一句要 ${worst}ms`);
});

test('剧情数据流：每句 [说话人, 文字]，逐字切到最后等于原句', () => {
  for (const key of D.storyOrder) {
    for (const line of D.story[key].lines) {
      assert.strictEqual(typeof line[1], 'string');
      assert.ok(line[1].length > 0, key);
      const chars = ST.chars(line[1]);
      assert.strictEqual(ST.slice(chars, chars.length), line[1], key);
    }
  }
});

test('跳过 / 读完的已读记录规则不变', () => {
  const s = P.newSave();
  P.markStory(s, 'ch1', false);
  assert.strictEqual(s.story.ch1, 'skipped');
  P.markStory(s, 'ch1', true);
  assert.strictEqual(s.story.ch1, 'read');
  P.markStory(s, 'ch1', false);
  assert.strictEqual(s.story.ch1, 'read', '读过的不会被跳过覆盖');
});
