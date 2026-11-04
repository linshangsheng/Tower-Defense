// 统一的线性图标（设计书 187）：24×24 网格、1.8 描边、圆端点，和 SF Symbols 同一类语言。
// 同一份路径数据两处用：界面里的内联 SVG（TD.icons.svg），画布里的 Path2D（TD.icons.draw）。
// 界面里原来写在文字里的 emoji 由 TD.icons.iconize 在渲染后统一换成这套图标，文字本身（和翻译词典）不用改。
(function (TD) {
  'use strict';

  const I = (TD.icons = {});

  // 每个图标：d = 路径（描边），f = 可选的填充路径（用在小圆点、实心部分）
  const P = {
    trophy: { d: 'M8 4h8v5a4 4 0 0 1-8 0V4z M8 6H5v2a3 3 0 0 0 3 3 M16 6h3v2a3 3 0 0 1-3 3 M12 13v4 M9 20h6 M10 17h4v3h-4z' },
    check: { d: 'M5 12.5l4.5 4.5L19 7' },
    crown: { d: 'M4 8l4 4 4-6 4 6 4-4-2 10H6L4 8z M6 21h12' },
    star: { d: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8L12 3.5z' },
    target: { d: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z', f: 'M12 10.8a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z' },
    lock: { d: 'M7.5 11V8a4.5 4.5 0 0 1 9 0v3 M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z', f: 'M12 14.2a1.3 1.3 0 0 1 .7 2.4V18h-1.4v-1.4a1.3 1.3 0 0 1 .7-2.4z' },
    unlock: { d: 'M7.5 11V8a4.5 4.5 0 0 1 8.6-1.8 M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z' },
    sparkles: { d: 'M11 3.5l1.7 5L17.5 10l-4.8 1.6L11 16.5l-1.7-4.9L4.5 10l4.8-1.5L11 3.5z M18 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z' },
    spark: { d: 'M12 4l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z' },
    calendar: { d: 'M5 5.5h14a1 1 0 0 1 1 1v12.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1z M4 10h16 M8 3.5v4 M16 3.5v4' },
    bulb: { d: 'M9.5 18h5 M10.5 21h3 M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z' },
    globe: { d: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3c2.6 2.5 3.8 5.5 3.8 9s-1.2 6.5-3.8 9c-2.6-2.5-3.8-5.5-3.8-9S9.4 5.5 12 3z' },
    village: { d: 'M3 20V11l4-3 4 3v9 M11 20v-9l5-4 5 4v9 M2 20h20 M14.5 20v-4.5h3V20' },
    shirt: { d: 'M8.5 4L3 7l2.5 4L8 10v10h8V10l2.5 1L21 7l-5.5-3c-.6 1.4-1.8 2.2-3.5 2.2S9.1 5.4 8.5 4z' },
    book: { d: 'M6 3.5h11a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 18.5V6a2.5 2.5 0 0 1 2-2.5z M8 3.5v17 M11 8h4' },
    openbook: { d: 'M12 6c-1.8-1.5-4.2-2-8-2v13c3.8 0 6.2.5 8 2 1.8-1.5 4.2-2 8-2V4c-3.8 0-6.2.5-8 2z M12 6v13' },
    infinity: { d: 'M7.5 8C4.5 8 3 10 3 12s1.5 4 4.5 4C11 16 13 8 16.5 8 19.5 8 21 10 21 12s-1.5 4-4.5 4C13 16 11 8 7.5 8z' },
    pagoda: { d: 'M12 3l6 4H6l6-4z M8 7v4.5h8V7 M4.5 11.5h15 M7 11.5V20 M17 11.5V20 M3.5 20.5h17 M11 15h2v5.5h-2z' },
    horn: { d: 'M4 10v4h3.5l8.5 4V6L7.5 10H4z M19 9.5a4 4 0 0 1 0 5' },
    coinbag: { d: 'M9 4h6l-1.4 3h-3.2L9 4z M10.4 7C6.2 9 5 12.8 5 15.5 5 18.6 8 20 12 20s7-1.4 7-4.5C19 12.8 17.8 9 13.6 7', f: 'M12 11.2a.9.9 0 0 1 .9.9v.2h.5v1.2h-1.4v.6h.9a1.3 1.3 0 0 1 0 2.6v.2a.9.9 0 0 1-1.8 0v-.2h-.5v-1.2h1.4v-.6h-.9a1.3 1.3 0 0 1 0-2.6v-.2a.9.9 0 0 1 .9-.9z' },
    pause: { d: 'M9 5.5v13 M15 5.5v13', w: 2.8 },
    box: { d: 'M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5v-9z M3.5 7.5L12 12l8.5-4.5 M12 12v9' },
    note: { d: 'M9 18V6l10-2v12 M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z M19 16a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z' },
    gift: { d: 'M4.5 11h15v9h-15z M3.5 7.5h17V11h-17z M12 7.5V20 M12 7.5c-3.2 0-4.4-4-2-4.3 1.6-.2 2 2 2 4.3 0-2.3.4-4.5 2-4.3 2.4.3 1.2 4.3-2 4.3z' },
    swords: { d: 'M5 5l9 9 M11.5 16.5l5-5 M14 14l4.5 4.5 M19 5l-9 9 M12.5 16.5l-5-5 M10 14l-4.5 4.5' },
    arrow: { d: 'M5 12h14 M13 6l6 6-6 6' },
    snowflake: { d: 'M12 3v18 M4.2 7.5l15.6 9 M19.8 7.5l-15.6 9 M9.5 4.8L12 7.3l2.5-2.5 M9.5 19.2L12 16.7l2.5 2.5' },
    warning: { d: 'M12 4l9 16H3L12 4z M12 10v4.5', f: 'M12 16.6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z' },
    refresh: { d: 'M20 11a8 8 0 0 0-14.5-4.5L4 8 M4 4v4h4 M4 13a8 8 0 0 0 14.5 4.5L20 16 M20 20v-4h-4' },
    wrench: { d: 'M14.5 6.5a4 4 0 0 0-5 5L3.5 17.5a1.8 1.8 0 0 0 2.5 2.5l6-6a4 4 0 0 0 5-5l-2.4 2.4-2.4-.6-.6-2.4 2.4-2.4z' },
    chart: { d: 'M5.5 20V11 M12 20V4 M18.5 20v-7 M3 20h18' },
    scroll: { d: 'M8 4h10a2 2 0 0 1 2 2v1H10 M8 4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7 M10 11h6 M10 15h4' },
    pencil: { d: 'M4 20l1-4.2L16 4.8l3.2 3.2L8.2 19 4 20z M14 7l3 3' },
    heart: { d: 'M12 20s-7.5-4.6-7.5-10.2a4.2 4.2 0 0 1 7.5-2.5 4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z' },
    shield: { d: 'M12 3l7 3v5.2c0 4.4-3 7.8-7 9.8-4-2-7-5.4-7-9.8V6l7-3z' },
    flame: { d: 'M12 3c.9 3.4 5 5.4 5 10a5 5 0 0 1-10 0c0-2 1-3.2 2.1-4.2.1 1.6.8 2.6 1.8 2.6C11 8.8 10.5 6 12 3z' },
    wind: { d: 'M3 9h11a3 3 0 1 0-3-3 M3 14h15a3 3 0 1 1-3 3 M3 19h6' },
    wall: { d: 'M4 5h16v14H4z M4 9.7h16 M4 14.3h16 M10 5v4.7 M15.5 9.7v4.6 M8 14.3V19' },
    sliders: { d: 'M4 6h10 M18 6h2 M16 4v4 M4 12h3 M11 12h9 M9 10v4 M4 18h10 M18 18h2 M16 16v4' },
    bolt: { d: 'M13 3L5 13.5h6L10 21l8-10.5h-6L13 3z' },
    helm: { d: 'M5 15a7 7 0 0 1 14 0v4H5v-4z M5 15h14 M12 8v7 M8.5 19v-4 M15.5 19v-4' },
    coin: { d: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 6.8v10.4 M9.4 9.6c0-1 1.2-1.7 2.6-1.7s2.6.7 2.6 1.7-1.2 1.5-2.6 1.8-2.6.8-2.6 1.8 1.2 1.7 2.6 1.7 2.6-.7 2.6-1.7' },
    flag: { d: 'M6 21V4 M6 4.5h11.5l-2.2 3.8 2.2 3.8H6' },
    close: { d: 'M6 6l12 12 M18 6L6 18' },
    dot: { f: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' },
  };
  I.names = Object.keys(P);

  // emoji → 图标名（括号里是 FE0F 变体选择符，一并吞掉）
  const MAP = {
    '🏆': 'trophy', '✔': 'check', '✅': 'check', '👑': 'crown', '♛': 'crown', '🎯': 'target', '🔒': 'lock', '🔓': 'unlock', '✨': 'sparkles', '✦': 'spark',
    '📅': 'calendar', '💡': 'bulb', '🌐': 'globe', '🏘': 'village', '👕': 'shirt', '📔': 'book', '📖': 'openbook', '♾': 'infinity', '🏯': 'pagoda',
    '🎺': 'horn', '💰': 'coinbag', '❚❚': 'pause', '❚': 'pause', '📦': 'box', '♪': 'note', '🎁': 'gift', '⚔': 'swords', '👉': 'arrow', '➜': 'arrow', '❄': 'snowflake',
    '⚠': 'warning', '🔄': 'refresh', '🛠': 'wrench', '🔧': 'wrench', '📊': 'chart', '📜': 'scroll', '✎': 'pencil', '♥': 'heart', '🛡': 'shield',
    '🚩': 'flag', '🔥': 'flame', '💨': 'wind', '🧱': 'wall',
  };
  I.MAP = MAP;
  // 颜色提示：图标默认跟随文字颜色，这几个带一点语义色
  const TONE = { trophy: 'gold', crown: 'gold', star: 'gold', sparkles: 'gold', spark: 'gold', bulb: 'gold', coinbag: 'gold', gift: 'gold', check: 'green', target: 'red', heart: 'red', flame: 'orange', warning: 'orange', snowflake: 'ice', wind: 'ice', horn: 'gold' };
  I.TONE = TONE;
  const TONE_COLOR = { gold: '#ffc54d', green: '#7fe08a', red: '#ff7a6e', orange: '#ff9a4a', ice: '#9fdcff' };
  I.toneColor = (name) => TONE_COLOR[TONE[name]] || null;

  const NS = 'http://www.w3.org/2000/svg';
  // 内联 SVG（界面用）。size 单位 em；返回 <span class="ico ico-name">
  I.svg = function (name, size) {
    const p = P[name];
    if (!p) return null;
    const span = document.createElement('span');
    span.className = 'ico ico-' + name + (TONE[name] ? ' tone-' + TONE[name] : '');
    if (size) span.style.fontSize = size;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    if (p.d) {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', p.d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', p.w || 1.8);
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(path);
    }
    if (p.f) {
      const f = document.createElementNS(NS, 'path');
      f.setAttribute('d', p.f);
      f.setAttribute('fill', 'currentColor');
      svg.appendChild(f);
    }
    span.appendChild(svg);
    return span;
  };

  // 画布里画图标（战场上的光球、提示等）：以 (x, y) 为中心，size 为边长（像素）
  const cache = {};
  I.draw = function (ctx, name, x, y, size, color, lw) {
    const p = P[name];
    if (!p || typeof Path2D === 'undefined') return false;
    const c = cache[name] || (cache[name] = { d: p.d && new Path2D(p.d), f: p.f && new Path2D(p.f) });
    ctx.save();
    ctx.translate(x - size / 2, y - size / 2);
    ctx.scale(size / 24, size / 24);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (c.d) {
      ctx.strokeStyle = color || '#fff';
      ctx.lineWidth = lw || p.w || 1.8;
      ctx.stroke(c.d);
    }
    if (c.f) {
      ctx.fillStyle = color || '#fff';
      ctx.fill(c.f);
    }
    ctx.restore();
    return true;
  };

  // ---------- 把文字里的 emoji 换成图标 ----------
  const KEYS = Object.keys(MAP).sort((a, b) => b.length - a.length);
  const EMO = new RegExp('(' + KEYS.join('|') + ')\\uFE0F?', 'u');
  const CJK = /[㐀-鿿]/;
  const SKIP = new Set(['SCRIPT', 'STYLE', 'CANVAS', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'SVG']);

  // 处理一个文本节点；返回是否做了替换
  I.iconizeText = function (node) {
    const text = node.nodeValue;
    if (!text || !EMO.test(text)) return false;
    const par = node.parentNode;
    if (!par || SKIP.has(par.nodeName.toUpperCase()) || (par.closest && par.closest('.noicon'))) return false;
    // 英文界面：还没翻译的中文先别动，等翻译器改完文字再来（否则词典里带 emoji 的原文就对不上了）
    if (TD.i18n && TD.i18n.lang && TD.i18n.lang !== 'zh' && CJK.test(text)) return false;
    const frag = document.createDocumentFragment();
    let rest = text;
    let m;
    while ((m = EMO.exec(rest))) {
      const before = rest.slice(0, m.index);
      if (before) frag.appendChild(document.createTextNode(before));
      frag.appendChild(I.svg(MAP[m[1]]));
      rest = rest.slice(m.index + m[0].length);
    }
    if (rest) frag.appendChild(document.createTextNode(rest));
    par.replaceChild(frag, node);
    return true;
  };

  I.iconize = function (root) {
    if (!root || !document.createTreeWalker) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (w.nextNode()) if (EMO.test(w.currentNode.nodeValue || '')) nodes.push(w.currentNode);
    for (const n of nodes) I.iconizeText(n);
  };

  // 监听界面容器：新增 / 改文字的节点自动换图标
  I.watch = function (root) {
    if (!root || typeof MutationObserver === 'undefined') return;
    let queued = false;
    const dirty = new Set();
    const flush = () => {
      queued = false;
      const list = Array.from(dirty);
      dirty.clear();
      for (const n of list) {
        if (n.nodeType === 3) I.iconizeText(n);
        else if (n.nodeType === 1) I.iconize(n);
      }
    };
    new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'characterData') dirty.add(m.target);
        else m.addedNodes.forEach((n) => dirty.add(n));
      }
      if (dirty.size && !queued) {
        queued = true;
        Promise.resolve().then(flush);
      }
    }).observe(root, { childList: true, subtree: true, characterData: true });
    I.iconize(root);
  };
})((globalThis.TD = globalThis.TD || {}));
