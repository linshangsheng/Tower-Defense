#!/usr/bin/env node
// 多语言（设计书 83）：扫描 src 下所有 JS（和 index.html），找出含中文的字符串字面量，写成 i18n/keys.json。
// 模板字符串里的 ${...} 记成 {0} {1} …（按出现顺序）；字面量里的转义（\n、\'、\uXXXX……）还原成真正的字符；首尾空白去掉（运行时保留）。
// 用法：node tools/i18n-extract.js [--check]   --check：只检查 keys.json 是否是最新的（测试用）
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const HAS = /[㐀-鿿]/;

function unescapeStr(s) {
  return s.replace(/\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|\r?\n|.)/gs, (m, c) => {
    if (c[0] === 'u' && c.length === 5) return String.fromCharCode(parseInt(c.slice(1), 16));
    if (c[0] === 'x' && c.length === 3) return String.fromCharCode(parseInt(c.slice(1), 16));
    if (c === 'n') return '\n';
    if (c === 't') return '\t';
    if (c === 'r') return '\r';
    if (c === '\n' || c === '\r\n') return '';
    return c;
  });
}

// 扫描一段 JS 代码，对每个字符串字面量调用 emit(文本)；模板字符串里的表达式递归扫描
function scan(src, emit) {
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2);
      i = e < 0 ? n : e + 2;
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      let s = '';
      while (j < n && src[j] !== c && src[j] !== '\n') {
        if (src[j] === '\\') {
          s += src[j] + src[j + 1];
          j += 2;
        } else s += src[j++];
      }
      emit(unescapeStr(s));
      i = j + 1;
      continue;
    }
    if (c === '`') {
      let j = i + 1;
      let s = '';
      let k = 0;
      while (j < n && src[j] !== '`') {
        if (src[j] === '\\') {
          s += src[j] + src[j + 1];
          j += 2;
        } else if (src[j] === '$' && src[j + 1] === '{') {
          let d = 1;
          let e = j + 2;
          // 找到匹配的 }，期间要跳过里面的字符串和嵌套模板
          while (e < n && d > 0) {
            const ch = src[e];
            if (ch === "'" || ch === '"') {
              e++;
              while (e < n && src[e] !== ch) e += src[e] === '\\' ? 2 : 1;
            } else if (ch === '`') {
              e++;
              let dd = 0;
              while (e < n && (src[e] !== '`' || dd > 0)) {
                if (src[e] === '\\') e += 2;
                else if (src[e] === '$' && src[e + 1] === '{') (dd++, (e += 2));
                else if (src[e] === '}' && dd > 0) (dd--, e++);
                else e++;
              }
            } else if (ch === '{') d++;
            else if (ch === '}') d--;
            e++;
          }
          scan(src.slice(j + 2, e - 1), emit);
          s += `\u0000${k++}\u0000`;
          j = e;
        } else s += src[j++];
      }
      emit(unescapeStr(s).replace(/\u0000(\d+)\u0000/g, '{$1}'));
      i = j + 1;
      continue;
    }
    i++;
  }
}

function collect() {
  const files = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.js') && !p.includes('samples') && !p.includes(path.sep + 'i18n' + path.sep) && !p.endsWith('core' + path.sep + 'i18n.js')) files.push(p);
    }
  })(path.join(ROOT, 'src'));
  const out = new Map();
  const add = (s) => {
    const t = s.trim();
    if (HAS.test(t)) out.set(t, (out.get(t) || 0) + 1);
  };
  for (const f of files) scan(fs.readFileSync(f, 'utf8'), add);
  // index.html 里的静态文字
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  for (const m of html.matchAll(/>([^<>]*[㐀-鿿][^<>]*)</g)) add(m[1]);
  return [...out.keys()].sort((a, b) => a.localeCompare(b, 'zh'));
}

if (require.main === module) {
  const keys = collect();
  const file = path.join(ROOT, 'i18n', 'keys.json');
  if (process.argv.includes('--check')) {
    const old = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
    const missing = keys.filter((k) => !old.includes(k));
    console.log(missing.length ? `keys.json 过期：缺 ${missing.length} 条` : 'keys.json 是最新的');
    process.exit(missing.length ? 1 : 0);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(keys, null, 0) + '\n');
  console.log(`提取 ${keys.length} 条，${keys.reduce((a, s) => a + s.length, 0)} 个字符 → i18n/keys.json`);
}
module.exports = { collect, scan, unescapeStr };
