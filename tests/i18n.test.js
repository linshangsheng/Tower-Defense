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

test('拼在一起的句子：前缀符号、按标点拆开、带标点的词条、数字紧挨占位符', () => {
  I._use('xx', {
    '对 Boss 伤害 +{0}%': 'Boss damage +{0}%',
    '攻击力 +{0}': 'ATK +{0}',
    '攻击力 +{0}%': 'ATK +{0}%',
    '擅长：': 'Good against: ',
    通用: 'general',
    '🎯 完成「{0}」：+{1} 银': '🎯 "{0}" done: +{1} silver',
    轻装: 'Light',
    '现在 {0} / {1}{2}。': 'Now {0} / {1}{2}.',
    '（已满）': '(full)',
    '第 {0} 章': 'Chapter {0}',
    '/秒': '/s',
    银: 'Silver',
  });
  assert.strictEqual(I.t('攻击力 +2，对 Boss 伤害 +4%'), 'ATK +2, Boss damage +4%', '攻击力 +{0}% 不能把整句吞掉');
  assert.strictEqual(I.t('擅长：通用、通用'), 'Good against: general, general');
  assert.strictEqual(I.t('✦ 🎯 完成「轻装」：+2 银'), '✦ 🎯 "Light" done: +2 silver', '前缀符号原样保留，后面按词条翻');
  assert.strictEqual(I.t('现在 0 / 7（已满）。'), 'Now 0 / 7(full).', '紧挨的占位符：数字归前一个');
  assert.strictEqual(I.t('第三章'), '第三章', '没有词条的整词不动');
  assert.strictEqual(I.t('第 三 章'), 'Chapter 3', '汉字数字换成阿拉伯数字');
  assert.strictEqual(I.t('1.00/秒'), '1.00/s');
  assert.strictEqual(I.t('775 银'), '775 Silver', '货币单字也能当碎片');
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
