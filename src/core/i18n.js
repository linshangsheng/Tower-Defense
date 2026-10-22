// 多语言（设计书第 83 章）：游戏里所有文字都是简体中文写的，运行时按所选语言翻译。
// 做法：不改任何界面代码——把"中文原文 → 译文"做成词典（src/i18n/<语言>.js），
//   1. 界面（DOM）：用 MutationObserver 盯着页面，文字节点和 title / placeholder 属性里只要有中文就翻译；
//   2. 画布上的字（战斗里的横幅、飘字）：包一层 fillText / strokeText / measureText；
//   3. 翻译的顺序：整句精确匹配 → 带 {0} {1} 占位符的句式匹配（数字、名字照搬）→ 句子里能认出的词条逐个替换。
// 简体中文（zh）不用翻译，直接显示原文；默认语言是英语（en）。
(function (TD) {
  'use strict';

  const STORE_KEY = 'shouchengyingxiong.lang';
  const HAS_CJK = /[㐀-鿿]/;

  // 17 种语言：[代码, 本语言里的名字, 英文名]。顺序就是选择界面里的顺序
  const LANGUAGES = [
    ['en', 'English', 'English'],
    ['zh', '简体中文', 'Simplified Chinese'],
    ['es', 'Español', 'Spanish'],
    ['pt-BR', 'Português (Brasil)', 'Brazilian Portuguese'],
    ['pt-PT', 'Português (Portugal)', 'European Portuguese'],
    ['ru', 'Русский', 'Russian'],
    ['ja', '日本語', 'Japanese'],
    ['ko', '한국어', 'Korean'],
    ['de', 'Deutsch', 'German'],
    ['fr', 'Français', 'French'],
    ['zh-Hant', '繁體中文', 'Traditional Chinese'],
    ['tr', 'Türkçe', 'Turkish'],
    ['pl', 'Polski', 'Polish'],
    ['it', 'Italiano', 'Italian'],
    ['id', 'Bahasa Indonesia', 'Indonesian'],
    ['vi', 'Tiếng Việt', 'Vietnamese'],
    ['th', 'ไทย', 'Thai'],
  ].map(([code, native, english]) => ({ code, native, english }));
  const CODES = LANGUAGES.map((l) => l.code);
  // 这几种语言本身用全角标点，其余语言把残留的全角标点换成半角
  const FULLWIDTH_OK = { zh: 1, 'zh-Hant': 1, ja: 1 };

  const SINGLE = ['铜', '银', '金', '钻', '红', '蓝', '绿', '紫'];
  const NUMERALS = '一二三四五六七八九十'; // 第"三"章：不用词典，直接换成阿拉伯数字（日语 / 中文保持汉字）
  const dicts = {}; // 语言代码 → { 中文原文: 译文 }
  let lang = 'en';
  let dict = null;
  let patterns = [];
  let fragRe = null;
  const cache = new Map();

  function normalizeLang(code) {
    return CODES.includes(code) ? code : 'en';
  }

  function readStored() {
    try {
      return normalizeLang(globalThis.localStorage && localStorage.getItem(STORE_KEY));
    } catch (e) {
      return 'en';
    }
  }

  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // 词典 → 句式（含 {0} 的）和碎片（不含占位符的、至少 2 个字，用来在长句里找词）
  function prepare() {
    cache.clear();
    patterns = [];
    fragRe = null;
    dict = dicts[lang] || null;
    if (!dict || lang === 'zh') return;
    const frags = [];
    for (const key of Object.keys(dict)) {
      if (/\{\d+\}/.test(key)) {
        const parts = key.split(/\{(\d+)\}/); // 文字, 序号, 文字, 序号, …
        let src = '^';
        const order = [];
        for (let i = 0; i < parts.length; i++) {
          if (i % 2 === 0) src += escapeRe(parts[i]);
          else {
            // 两个占位符紧挨着（"{1}{2}"）时，前一个只吃数字（或什么都不吃），后一个吃剩下的
            src += parts[i + 1] === '' && i + 2 < parts.length ? '([+\\-−]?\\d[\\d.,]*%?|)' : '([\\s\\S]*?)';
            order.push(+parts[i]);
          }
        }
        src += '$';
        const literal = parts.filter((_, i) => i % 2 === 0).join('').length;
        patterns.push({ re: new RegExp(src), order, out: dict[key], literal });
      } else if (key.length >= 2) frags.push(key);
    }
    // 单字词条只有货币和颜色这几个能当碎片用（"775 铜"、"绿 6"），其余单字太容易误伤
    for (const key of SINGLE) if (dict[key] !== undefined) frags.push(key);
    patterns.sort((a, b) => b.literal - a.literal);
    frags.sort((a, b) => b.length - a.length);
    if (frags.length) fragRe = new RegExp(frags.map(escapeRe).join('|'), 'g');
  }

  // 残留的全角标点换成半角（拉丁 / 西里尔 / 韩 / 泰等语言）
  const PUNCT = { '，': ', ', '。': '. ', '：': ': ', '；': '; ', '！': '! ', '？': '? ', '、': ', ', '（': ' (', '）': ') ', '「': '"', '」': '"', '『': '"', '』': '"', '～': '~', '％': '%' };
  function halfwidth(s) {
    if (FULLWIDTH_OK[lang] || !/[，。：；！？、（）「」『』～％]/.test(s)) return s;
    return s
      .replace(/[，。：；！？、（）「」『』～％]/g, (c) => PUNCT[c])
      .replace(/ {2,}/g, ' ')
      .replace(/ ([,.;:!?)])/g, '$1')
      .replace(/\( /g, '(')
      .trim();
  }

  function fill(out, caps) {
    return out.replace(/\{(\d+)\}/g, (m, i) => (caps[+i] === undefined ? m : t(caps[+i])));
  }

  const SEP = /([，。；：、！？\n「」（）]| · |, |: )/;
  const HAS_SEP = /[，。；：、！？\n「」（）]| · |, |: /;
  function matchPattern(core, strict) {
    for (const p of patterns) {
      const m = p.re.exec(core);
      if (!m) continue;
      if (strict && m.slice(1).some((c) => HAS_SEP.test(c))) continue; // 占位符里夹着逗号的，多半是几句话拼在一起，先别按句式套
      const caps = [];
      p.order.forEach((idx, k) => (caps[idx] = m[k + 1]));
      return fill(p.out, caps);
    }
    return null;
  }
  // 按标点拆开的几句话（bits 是 文字, 标点, 文字, 标点…）：从每个位置起，先试"连着后面几段（含标点）"能不能整条对上词典 / 句式，对不上再单译这一小段
  function translateRuns(bits) {
    const n = bits.length;
    let out = '';
    for (let i = 0; i < n; ) {
      let took = 0;
      for (let j = Math.min(n - 1, i + 15); j >= i && !took; j--) {
        const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(bits.slice(i, j + 1).join(''));
        if (!m[2]) continue;
        const r = dict[m[2]] !== undefined ? dict[m[2]] : j > i ? matchPattern(m[2], true) : null;
        if (r !== null && r !== undefined) {
          out += m[1] + r + m[3];
          took = j - i + 1;
        }
      }
      if (took) {
        i += took;
        continue;
      }
      const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(bits[i]);
      out += i % 2 || !m[2] ? bits[i] : m[1] + translateCore(m[2], true) + m[3];
      i++;
    }
    return out;
  }
  function translateCore(core, noSplit) {
    const exact = dict[core];
    if (exact !== undefined) return exact;
    if (core.length === 1 && !FULLWIDTH_OK[lang] && NUMERALS.includes(core)) return String(NUMERALS.indexOf(core) + 1);
    const hit = matchPattern(core, !noSplit);
    if (hit !== null) return hit;
    if (!noSplit) {
      let best = null;
      // 前面带符号 / 序号的（"✎ 今天…"、"Lv2: 攻速 +65%"）：前缀原样保留，翻译后面的
      // "Lv2：4 道雷，每道…"：后面的文字以数字开头时上面的"前缀"会把数字吃掉，先单独处理 "Lv数字 + 冒号"
      const lm = /^(Lv\d+[:：]\s*)([\s\S]+)$/.exec(core);
      if (lm) {
        const rest = translateCore(lm[2]);
        if (rest !== lm[2]) best = lm[1] + rest;
      }
      const pm = /^([^\u3400-\u9fff]+)([\u3400-\u9fff][\s\S]*)$/.exec(core);
      if (best === null && pm && !/^[\w\s]*$/.test(pm[1])) {
        const toks = pm[1].match(/\S+\s*|\s+/g); // 从短的前缀试起："✦ " → "✦ 🎯 "
        for (let cut = 1; cut <= toks.length && best === null; cut++) {
          const post = toks.slice(cut).join('') + pm[2];
          const rest = translateCore(post);
          if (rest !== post) best = toks.slice(0, cut).join('') + rest;
        }
      }
      // 几句话拼在一起的（"攻速 +1.5%，对飞行怪伤害 +4%"）：按标点拆开再译
      const bits = core.split(SEP);
      if (best === null && bits.length > 1) best = translateRuns(bits);
      if (best !== null && !HAS_CJK.test(best)) return best;
      const loose = matchPattern(core, false); // 占位符里带逗号的（成就描述等）最后再按句式套
      if (loose !== null) return loose;
      if (best !== null) return best;
    }
    if (fragRe) {
      fragRe.lastIndex = 0;
      return core.replace(fragRe, (k) => dict[k]);
    }
    return core;
  }

  // 翻译一段文字：没有中文就原样返回；首尾的空白保留
  function t(s) {
    if (lang === 'zh' || typeof s !== 'string' || !dict || !HAS_CJK.test(s)) return s;
    const hit = cache.get(s);
    if (hit !== undefined) return hit;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    const out = m[1] + halfwidth(translateCore(m[2])) + m[3];
    if (cache.size > 6000) cache.clear();
    cache.set(s, out);
    return out;
  }

  // ---------- 浏览器里：翻译页面 ----------
  const done = typeof WeakMap !== 'undefined' ? new WeakMap() : null; // 文字节点 → 我们写进去的译文（日语等译文里也有汉字，靠这个避免重复翻译）
  let observer = null;
  const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];

  function translateTextNode(node) {
    const text = node.data;
    if (!text || done.get(node) === text || !HAS_CJK.test(text)) return;
    const out = t(text);
    done.set(node, out);
    if (out !== text) node.data = out;
  }
  function translateAttrs(el) {
    for (const a of ATTRS) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v && HAS_CJK.test(v)) {
        const out = t(v);
        if (out !== v) el.setAttribute(a, out);
      }
    }
  }
  function walk(root) {
    if (root.nodeType === 3) return translateTextNode(root);
    if (root.nodeType !== 1) return;
    translateAttrs(root);
    for (let c = root.firstChild; c; c = c.nextSibling) walk(c);
  }

  function patchCanvas() {
    if (typeof CanvasRenderingContext2D === 'undefined' || CanvasRenderingContext2D.prototype.__i18n) return;
    const proto = CanvasRenderingContext2D.prototype;
    proto.__i18n = true;
    for (const name of ['fillText', 'strokeText', 'measureText']) {
      const orig = proto[name];
      proto[name] = function (text, ...rest) {
        return orig.call(this, typeof text === 'string' && lang !== 'zh' ? t(text) : text, ...rest);
      };
    }
  }

  function applyDocument() {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = lang;
    document.title = t('城头射手');
  }

  const I18n = (TD.i18n = {
    languages: LANGUAGES,
    codes: CODES,
    storeKey: STORE_KEY,
    dicts,
    get lang() {
      return lang;
    },
    t,
    // 词典文件（src/i18n/<语言>.js）加载后调用
    register(code, table) {
      dicts[code] = table;
      if (code === lang) prepare();
    },
    // 切换语言：必要时先加载词典，然后重新翻译。onDone(是否成功)
    setLang(code, onDone) {
      code = normalizeLang(code);
      const finish = () => {
        lang = code;
        try {
          localStorage.setItem(STORE_KEY, code);
        } catch (e) {}
        prepare();
        applyDocument();
        onDone && onDone(true);
      };
      if (code === 'zh' || dicts[code] || typeof document === 'undefined') return finish();
      const sc = document.createElement('script');
      sc.src = `src/i18n/${code}.js`;
      sc.onload = finish;
      sc.onerror = () => onDone && onDone(false);
      document.head.appendChild(sc);
    },
    // 启动时：读存好的语言（词典已由 index.html 里的小脚本同步加载好），翻译当前页面并开始盯着页面
    init() {
      lang = readStored();
      prepare();
      if (typeof document === 'undefined') return;
      patchCanvas();
      applyDocument();
      if (typeof MutationObserver === 'undefined') return;
      const root = document.body;
      walk(root);
      observer = new MutationObserver((records) => {
        if (lang === 'zh') return;
        for (const r of records) {
          if (r.type === 'characterData') translateTextNode(r.target);
          else if (r.type === 'attributes') translateAttrs(r.target);
          else for (const n of r.addedNodes) walk(n);
        }
      });
      observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    },
    // 只测试用：直接指定语言和词典
    _use(code, table) {
      lang = code;
      dicts[code] = table;
      prepare();
    },
  });
})((globalThis.TD = globalThis.TD || {}));
