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
            src += '([\\s\\S]*?)';
            order.push(+parts[i]);
          }
        }
        src += '$';
        const literal = parts.filter((_, i) => i % 2 === 0).join('').length;
        patterns.push({ re: new RegExp(src), order, out: dict[key], literal });
      } else if (key.length >= 2) frags.push(key);
    }
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
      .replace(/\( /g, '(');
  }

  function fill(out, caps) {
    return out.replace(/\{(\d+)\}/g, (m, i) => (caps[+i] === undefined ? m : t(caps[+i])));
  }

  function translateCore(core) {
    const exact = dict[core];
    if (exact !== undefined) return exact;
    for (const p of patterns) {
      const m = p.re.exec(core);
      if (m) {
        const caps = [];
        p.order.forEach((idx, k) => (caps[idx] = m[k + 1]));
        return fill(p.out, caps);
      }
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
    document.title = t('最后的堡垒');
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
