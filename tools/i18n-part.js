#!/usr/bin/env node
// 多语言翻译辅助（设计书 83.3）：把 keys.json 分成 4 段，打印某一段（编号 \t 原文，换行写成 \n）；--size 看每段范围
// 用法：node tools/i18n-part.js <1-4>
const keys = require('../i18n/keys.json');
const PARTS = 4;
const per = Math.ceil(keys.length / PARTS);
const n = +process.argv[2];
if (!n) {
  for (let i = 1; i <= PARTS; i++) console.log(`第 ${i} 段：下标 ${(i - 1) * per} – ${Math.min(keys.length, i * per) - 1}，共 ${Math.min(keys.length, i * per) - (i - 1) * per} 条`);
  process.exit(0);
}
keys.slice((n - 1) * per, n * per).forEach((k, i) => console.log(`${(n - 1) * per + i}\t${k.replace(/\n/g, '\\n')}`));
