#!/usr/bin/env node
// 把 i18n/<语言>.json（{中文原文: 译文}）生成游戏用的词典 src/i18n/<语言>.js
// 用法：node tools/i18n-build.js            生成所有已有 json 的语言
//       node tools/i18n-build.js en ja      只生成指定语言
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const LANGS = ['en', 'es', 'pt-BR', 'pt-PT', 'ru', 'ja', 'ko', 'de', 'fr', 'zh-Hant', 'tr', 'pl', 'it', 'id', 'vi', 'th'];
const want = process.argv.slice(2).length ? process.argv.slice(2) : LANGS;
for (const code of want) {
  const src = path.join(ROOT, 'i18n', `${code}.json`);
  if (!fs.existsSync(src)) {
    console.log(`${code}：没有 i18n/${code}.json，跳过`);
    continue;
  }
  const table = JSON.parse(fs.readFileSync(src, 'utf8'));
  const body = Object.keys(table)
    .map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(table[k])},`)
    .join('\n');
  const out = `// 自动生成：node tools/i18n-build.js（来源 i18n/${code}.json，不要手改）\nTD.i18n.register(${JSON.stringify(code)}, {\n${body}\n});\n`;
  fs.writeFileSync(path.join(ROOT, 'src', 'i18n', `${code}.js`), out);
  console.log(`${code}：${Object.keys(table).length} 条 → src/i18n/${code}.js`);
}
