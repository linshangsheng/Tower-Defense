// 多语言测试（设计书第 83 章）：node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
require('../tools/load');
require('../src/core/i18n.js');
const I = globalThis.TD.i18n;
const ROOT = path.join(__dirname, '..');
const { collect } = require('../tools/i18n-extract.js');

const keys = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n/keys.json'), 'utf8'));
const FOREIGN = I.codes.filter((c) => c !== 'zh');
const ph = (s) => (s.match(/\{\d+\}/g) || []).sort().join(',');

test('语言清单：17 种，默认英语，代码不重复', () => {
  assert.strictEqual(I.languages.length, 17);
  assert.strictEqual(new Set(I.codes).size, 17);
  assert.strictEqual(I.codes[0], 'en');
  for (const l of I.languages) assert.ok(l.native && l.english);
});

test('keys.json 与源码里的中文文字一致（改了文字要重新 node tools/i18n-extract.js）', () => {
  assert.deepStrictEqual(collect(), keys);
});

for (const code of FOREIGN) {
  test(`词典 ${code}：覆盖全部原文，占位符一致，无多余汉字`, () => {
    const file = path.join(ROOT, 'src/i18n', `${code}.js`);
    assert.ok(fs.existsSync(file), `缺 ${file}`);
    delete I.dicts[code];
    require(file);
    const table = I.dicts[code];
    assert.ok(table, '词典没有注册');
    const missing = keys.filter((k) => table[k] === undefined || table[k] === '');
    assert.deepStrictEqual(missing.slice(0, 5), [], `缺 ${missing.length} 条`);
    for (const k of keys) {
      assert.strictEqual(ph(table[k]), ph(k), `占位符不一致：${k}`);
      if (code !== 'ja' && code !== 'zh-Hant') assert.ok(!/[㐀-鿿]/.test(table[k]), `还有汉字：${k} → ${table[k]}`);
    }
  });
}

test('翻译顺序：整句 → 句式（占位符）→ 碎片；简体中文原样；无中文不动', () => {
  I._use('xx', {
    开始游戏: 'Start',
    '第 {0} 波': 'Wave {0}',
    '{0} 套装「{1}」': 'Set "{1}" ({0})',
    铜币: 'copper',
    你有: 'You have',
  });
  assert.strictEqual(I.t('开始游戏'), 'Start');
  assert.strictEqual(I.t('  开始游戏 \n'), '  Start \n', '首尾空白保留');
  assert.strictEqual(I.t('第 12 波'), 'Wave 12');
  assert.strictEqual(I.t('2 套装「铜币」'), 'Set "copper" (2)', '捕获的内容递归翻译');
  assert.strictEqual(I.t('你有 5 铜币'), 'You have 5 copper', '碎片替换');
  assert.strictEqual(I.t('Hello 123'), 'Hello 123');
  assert.strictEqual(I.t('未知词'), '未知词', '没有词条的原样保留');
  I._use('zh', {});
  assert.strictEqual(I.t('开始游戏'), '开始游戏');
  I._use('en', I.dicts.en || {});
});

test('全角标点：拉丁语系换半角，日语 / 繁中保留', () => {
  I._use('xx', { 好: 'ok' });
  assert.strictEqual(I.t('好，好！'), 'ok, ok!');
  I._use('ja', { 好: 'よし' });
  assert.strictEqual(I.t('好，好！'), 'よし，よし！');
  I._use('en', I.dicts.en || {});
});

test('setLang 记住语言，不认识的代码回到英语', () => {
  I.setLang('zh');
  assert.strictEqual(I.lang, 'zh');
  I.setLang('klingon');
  assert.strictEqual(I.lang, 'en');
});
