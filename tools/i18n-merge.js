#!/usr/bin/env node
// 多语言翻译：把 i18n/parts/<语言>-<段>.txt（每行 "下标<TAB>译文"，换行写成 \n）合并、检查，写成 i18n/<语言>.json（{中文原文: 译文}）
// 用法：node tools/i18n-merge.js <语言代码>       合并并检查
//       node tools/i18n-merge.js <语言代码> --part 2   只检查第 2 段
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const keys = require('../i18n/keys.json');
const PARTS = 4;
const per = Math.ceil(keys.length / PARTS);
const lang = process.argv[2];
const only = process.argv.includes('--part') ? +process.argv[process.argv.indexOf('--part') + 1] : 0;
if (!lang) {
  console.log('用法：node tools/i18n-merge.js <语言代码> [--part N]');
  process.exit(1);
}
const ph = (s) => (s.match(/\{\d+\}/g) || []).sort().join(',');
const FULLWIDTH_OK = ['zh', 'zh-Hant', 'ja'];
const result = {};
const errors = [];
for (let n = 1; n <= PARTS; n++) {
  if (only && n !== only) continue;
  const file = path.join(ROOT, 'i18n', 'parts', `${lang}-${n}.txt`);
  if (!fs.existsSync(file)) {
    errors.push(`缺文件 ${path.relative(ROOT, file)}`);
    continue;
  }
  const lo = (n - 1) * per;
  const hi = Math.min(keys.length, n * per);
  const got = new Map();
  fs.readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, ln) => {
      if (!line.trim()) return;
      const m = /^(\d+)\t([\s\S]*)$/.exec(line);
      if (!m) return errors.push(`${lang}-${n}.txt 第 ${ln + 1} 行格式不对（要 "下标<TAB>译文"）：${line.slice(0, 40)}`);
      const idx = +m[1];
      if (idx < lo || idx >= hi) return errors.push(`${lang}-${n}.txt 第 ${ln + 1} 行下标 ${idx} 不在 ${lo}–${hi - 1}`);
      if (got.has(idx)) return errors.push(`${lang}-${n}.txt 下标 ${idx} 重复`);
      got.set(idx, m[2].replace(/\\n/g, '\n'));
    });
  for (let i = lo; i < hi; i++) {
    const tr = got.get(i);
    const src = keys[i];
    if (tr === undefined || tr === '') {
      errors.push(`缺译文：${i}\t${src.slice(0, 30)}`);
      continue;
    }
    if (ph(tr) !== ph(src)) errors.push(`占位符不一致：${i}\t${src.slice(0, 30)}  →  ${tr.slice(0, 40)}（要有 ${ph(src) || '无'}）`);
    if ((src.match(/\n/g) || []).length !== (tr.match(/\n/g) || []).length) errors.push(`换行数不一致：${i}\t${src.slice(0, 30)}`);
    if (!FULLWIDTH_OK.includes(lang) && /[㐀-鿿]/.test(tr)) errors.push(`译文里还有中文：${i}\t${tr.slice(0, 40)}`);
    result[src] = tr;
  }
}
if (errors.length) {
  console.log(errors.slice(0, 60).join('\n'));
  console.log(`共 ${errors.length} 个问题`);
  if (!only) process.exit(1);
  process.exit(1);
}
if (!only) {
  fs.writeFileSync(path.join(ROOT, 'i18n', `${lang}.json`), JSON.stringify(result, null, 0) + '\n');
  console.log(`${lang}：${Object.keys(result).length} 条 → i18n/${lang}.json`);
} else console.log(`${lang} 第 ${only} 段没有问题`);
