// 光影生灵（设计书第 56 章）：修长比例、深色剪影 + 发光的眼睛和纹路，与光影场景统一
// 坐标约定与 sprites.js 相同：原点在脚下，向上为负；s 是怪物的 size；朝左（城墙方向）
// S.monster / S.hero 会优先使用这里的画法；这个文件是工具函数和英雄，各章怪物的画法在 creatures/ch1.js … ch7.js
(function (TD) {
  'use strict';

  const K = (TD.creatures = { drawers: {} });
  const TAU = Math.PI * 2;

  // ---------- 颜色工具 ----------
  function hex2rgb(hex) {
    if (hex.length === 4) hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  // 往深蓝黑里混：v=0 原色，v=1 接近 #0a1020（阴影带一点冷色）
  function deep(hex, v) {
    const [r, g, b] = hex2rgb(hex);
    const m = (a, c) => Math.round(a + (c - a) * v);
    return `rgb(${m(r, 10)},${m(g, 16)},${m(b, 32)})`;
  }
  // 往白里混
  function light(hex, v) {
    const [r, g, b] = hex2rgb(hex);
    const m = (a) => Math.round(a + (255 - a) * v);
    return `rgb(${m(r)},${m(g)},${m(b)})`;
  }
  function rgba(hex, a) {
    const [r, g, b] = hex2rgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }
  K.deep = deep;
  K.light = light;
  K.rgba = rgba;

  // 身体填充：右上偏亮、左下深（光从右上来）
  function bodyGrad(ctx, x0, y0, x1, y1, base, hi, lo) {
    const g = ctx.createLinearGradient(x1, y0, x0, y1);
    g.addColorStop(0, deep(base, hi === undefined ? 0.25 : hi));
    g.addColorStop(1, deep(base, lo === undefined ? 0.7 : lo));
    return g;
  }
  K.bodyGrad = bodyGrad;

  function glow(ctx, x, y, r, color, a, core) {
    if (TD.art && TD.art.drawGlow) TD.art.drawGlow(ctx, x, y, r, color, a, core);
  }
  K.glow = glow;

  // 软阴影
  function shadow(ctx, x, y, w) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, w);
    g.addColorStop(0, 'rgba(0,0,0,0.32)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, w, w * 0.26, 0, 0, TAU);
    ctx.fill();
  }
  K.shadow = shadow;

  // 一对发光的细长眼睛（朝左看）
  function eyes(ctx, x, y, gap, len, color, tilt, open) {
    const o = open === undefined ? 1 : open;
    for (const dx of [-gap / 2, gap / 2]) {
      glow(ctx, x + dx, y, len * 2.6, color, 0.6);
      ctx.save();
      ctx.translate(x + dx, y);
      ctx.rotate(tilt || -0.18);
      ctx.fillStyle = light(color, 0.85);
      ctx.beginPath();
      ctx.ellipse(0, 0, len, Math.max(0.6, len * 0.42 * o), 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
  K.eyes = eyes;

  // 发光的纹路（折线 / 曲线）
  function rune(ctx, pts, color, w, a) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(color, a === undefined ? 0.85 : a);
    ctx.lineWidth = w || 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
    ctx.restore();
  }
  K.rune = rune;

  // 发光的点（孢子、斑点）
  function dot(ctx, x, y, r, color, a) {
    glow(ctx, x, y, r * 3, color, (a === undefined ? 1 : a) * 0.6);
    ctx.fillStyle = light(color, 0.55);
    ctx.globalAlpha *= a === undefined ? 1 : a;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha /= a === undefined ? 1 : a;
  }
  K.dot = dot;

  // 半透明的光翅
  function wing(ctx, x, y, len, wid, ang, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    const g = ctx.createLinearGradient(0, 0, 0, -len);
    g.addColorStop(0, rgba(color, 0.15));
    g.addColorStop(1, rgba(color, 0.5));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(wid, -len * 0.5, 0, -len);
    ctx.quadraticCurveTo(-wid * 0.6, -len * 0.5, 0, 0);
    ctx.fill();
    ctx.strokeStyle = rgba(color, 0.7);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
  K.wing = wing;

  // 胶质身体（果冻类）：深色半透明 + 体内光核 + 表面高光
  function jelly(ctx, s, t, base, coreCol, o, tall) {
    const wob = Math.sin(t * 5 + (o.seed || 0)) * 0.07;
    const bite = o.attack ? Math.max(0, Math.sin(t * 11)) * 0.1 : 0;
    const w = s * (1.0 + wob + bite);
    const h = s * (tall || 0.95) * (1 - wob - bite * 0.5);
    const lean = Math.sin(t * 2.5 + (o.seed || 0)) * w * 0.08;
    ctx.beginPath();
    ctx.moveTo(-w * 1.05, 0);
    ctx.bezierCurveTo(-w * 1.02, -h * 0.55, -w * 0.7 + lean, -h * 1.15, -w * 0.05 + lean, -h * 1.18);
    ctx.bezierCurveTo(w * 0.62 + lean, -h * 1.15, w * 1.0, -h * 0.6, w * 1.02, 0);
    ctx.quadraticCurveTo(0, h * 0.16, -w * 1.05, 0);
    ctx.closePath();
    const g = ctx.createRadialGradient(w * 0.25, -h * 1.0, h * 0.1, 0, -h * 0.5, w * 1.2);
    g.addColorStop(0, rgba(coreCol, 0.9));
    g.addColorStop(0.35, deep(base, 0.35));
    g.addColorStop(1, deep(base, 0.72));
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.86;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.clip();
    // 体内的光核
    glow(ctx, w * 0.1, -h * 0.38, w * 0.75, coreCol, 0.6 + Math.sin(t * 3) * 0.12, true);
    // 底部反光
    ctx.strokeStyle = rgba(coreCol, 0.35);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-w * 0.7, -h * 0.06);
    ctx.quadraticCurveTo(0, h * 0.12, w * 0.7, -h * 0.06);
    ctx.stroke();
    // 表面高光：一道弧（在身体里面）
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = Math.max(1.2, w * 0.06);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(w * 0.05 + lean, -h * 0.62, h * 0.42, -1.2, -0.4);
    ctx.stroke();
    ctx.restore();
    return h;
  }
  K.jelly = jelly;

  // 果冻的眼睛：深色、带一点高光（亮身体上用暗眼睛才看得清）
  function jellyEyes(ctx, x, y, gap, r) {
    for (const dx of [-gap / 2, gap / 2]) {
      ctx.fillStyle = 'rgba(6,14,20,0.85)';
      ctx.beginPath();
      ctx.ellipse(x + dx, y, r * 0.75, r, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(x + dx + r * 0.25, y - r * 0.35, r * 0.28, 0, TAU);
      ctx.fill();
    }
  }
  K.jellyEyes = jellyEyes;

  // 修长的四足兽身体
  function quadruped(ctx, s, t, o, c) {
    // c: { base, len, high, legLen, headR, neck, run }
    const run = c.run || 1;
    const ph = t * 10 * run + (o.seed || 0);
    const stretch = Math.sin(ph) * 0.08 * run;
    const bodyY = -c.legLen - Math.abs(Math.sin(ph)) * s * 0.08;
    const L = c.len * (1 + stretch);
    // 腿：前后两对，远侧更暗
    const legs = [
      [-L * 0.32, 0, true],
      [L * 0.34, Math.PI, true],
      [-L * 0.28, Math.PI, false],
      [L * 0.4, 0, false],
    ];
    for (const [lx, p, far] of legs) {
      const sw = Math.sin(ph + p);
      ctx.strokeStyle = deep(c.base, far ? 0.82 : 0.62);
      ctx.lineWidth = s * (far ? 0.12 : 0.15);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lx, bodyY + s * 0.05);
      ctx.quadraticCurveTo(lx + sw * s * 0.35, bodyY + c.legLen * 0.55, lx + sw * s * 0.45 - s * 0.05, -s * 0.02);
      ctx.stroke();
    }
    // 身体
    ctx.fillStyle = bodyGrad(ctx, -L * 0.6, bodyY - c.high, L * 0.6, bodyY + c.high, c.base);
    ctx.beginPath();
    ctx.ellipse(0, bodyY, L * 0.62, c.high, -0.05, 0, TAU);
    ctx.fill();
    return { bodyY, L, ph };
  }
  K.quadruped = quadruped;

  // ---------- 细节工具（设计书 60.2）：让角色更精致，全部确定性（不用 Math.random），画进光影缓存 ----------
  // 固定种子的随机数：同一只怪每次画出来的纹理一样
  function seeded(seed) {
    let v = (Math.abs(Math.floor((seed || 1) * 9301 + 49297)) % 233280) || 1;
    return () => {
      v = (v * 9301 + 49297) % 233280;
      return v / 233280;
    };
  }
  K.seeded = seeded;

  // 在椭圆区域里画一簇短毛 / 羽毛笔触（ang：笔触方向，0 = 向右）
  function strokes(ctx, x, y, rx, ry, n, color, a, seed, ang, len) {
    const r = seeded(seed);
    ctx.save();
    ctx.strokeStyle = rgba(color, a === undefined ? 0.5 : a);
    ctx.lineWidth = Math.max(0.7, Math.min(rx, ry) * 0.03);
    ctx.lineCap = 'round';
    ctx.beginPath();
    const L = len || Math.min(rx, ry) * 0.22;
    for (let i = 0; i < n; i++) {
      const q = r() * TAU;
      const d = Math.sqrt(r());
      const px = x + Math.cos(q) * rx * d;
      const py = y + Math.sin(q) * ry * d;
      const aa = (ang === undefined ? -2.2 : ang) + (r() - 0.5) * 0.6;
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + Math.cos(aa) * L * 0.6 + L * 0.15, py + Math.sin(aa) * L * 0.6, px + Math.cos(aa) * L, py + Math.sin(aa) * L);
    }
    ctx.stroke();
    ctx.restore();
  }
  K.strokes = strokes;

  // 椭圆区域里的斑点（rMin–rMax），glowA > 0 时斑点自己发光
  function speckle(ctx, x, y, rx, ry, n, color, a, seed, rMin, rMax, glowA) {
    const r = seeded(seed);
    for (let i = 0; i < n; i++) {
      const q = r() * TAU;
      const d = Math.sqrt(r());
      const px = x + Math.cos(q) * rx * d;
      const py = y + Math.sin(q) * ry * d;
      const rr = (rMin || 0.8) + r() * ((rMax || 2) - (rMin || 0.8));
      if (glowA) glow(ctx, px, py, rr * 3.5, color, glowA);
      ctx.fillStyle = rgba(color, a === undefined ? 0.6 : a);
      ctx.beginPath();
      ctx.ellipse(px, py, rr, rr * (0.7 + r() * 0.3), q, 0, TAU);
      ctx.fill();
    }
  }
  K.speckle = speckle;

  // 鳞片 / 甲片：一排排小弧线，只画在当前路径（clip）里面；先 ctx.save(); 画轮廓; ctx.clip(); 再调用
  function scales(ctx, x0, y0, x1, y1, size, color, a) {
    ctx.save();
    ctx.strokeStyle = rgba(color, a === undefined ? 0.35 : a);
    ctx.lineWidth = Math.max(0.8, size * 0.12);
    let row = 0;
    for (let y = y0; y <= y1 + size; y += size * 0.7, row++) {
      ctx.beginPath();
      for (let x = x0 + (row % 2 ? size * 0.5 : 0); x <= x1 + size; x += size) {
        ctx.moveTo(x - size * 0.5, y);
        ctx.quadraticCurveTo(x, y + size * 0.65, x + size * 0.5, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  K.scales = scales;

  // 发光的分叉纹路（像叶脉 / 裂缝里透出的光），从 (x, y) 沿 ang 方向长出去
  function veins(ctx, x, y, len, ang, depth, color, a, seed, w) {
    const r = seeded(seed);
    const pts = [];
    const grow = (px, py, l, q, d) => {
      const nx = px + Math.cos(q) * l;
      const ny = py + Math.sin(q) * l;
      const mx = (px + nx) / 2 + (r() - 0.5) * l * 0.4;
      const my = (py + ny) / 2 + (r() - 0.5) * l * 0.4;
      pts.push([px, py, mx, my, nx, ny, d]);
      if (d > 0) {
        grow(nx, ny, l * 0.62, q - 0.5 - r() * 0.3, d - 1);
        if (r() < 0.7) grow(nx, ny, l * 0.55, q + 0.45 + r() * 0.3, d - 1);
      }
    };
    grow(x, y, len, ang, depth === undefined ? 2 : depth);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const [px, py, mx, my, nx, ny, d] of pts) {
      ctx.strokeStyle = rgba(color, (a === undefined ? 0.8 : a) * (0.55 + d * 0.15));
      ctx.lineWidth = (w || 1.4) * (0.6 + d * 0.25);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(mx, my, nx, ny);
      ctx.stroke();
    }
    ctx.restore();
  }
  K.veins = veins;

  // 绕着身体飘的小光点（t 驱动，n 个）
  function sparkles(ctx, x, y, rx, ry, n, t, color, seed, size) {
    const r = seeded(seed);
    for (let i = 0; i < n; i++) {
      const ph = r() * TAU;
      const sp = 0.6 + r() * 0.8;
      const a = 0.35 + 0.45 * Math.max(0, Math.sin(t * 3 * sp + ph));
      dot(ctx, x + Math.cos(t * sp + ph) * rx, y + Math.sin(t * sp * 1.3 + ph) * ry, (size || 1.2) * (0.7 + r() * 0.6), color, a);
    }
  }
  K.sparkles = sparkles;

  // 轮廓光：只在形状的右上边缘描一道亮边（光从右上来）。path 是一个画轮廓的函数：() => { ctx.beginPath(); ... }
  function rimEdge(ctx, path, color, a, w, dx, dy) {
    ctx.save();
    path();
    ctx.clip();
    // 把同一个轮廓往左下挪一点再描边：留在形状里面的只有右上那一侧
    ctx.translate(-(dx === undefined ? 2.5 : dx), dy === undefined ? 2.5 : dy);
    path();
    ctx.strokeStyle = rgba(color, a === undefined ? 0.6 : a);
    ctx.lineWidth = w || 3;
    ctx.stroke();
    ctx.restore();
  }
  K.rimEdge = rimEdge;

  // 渐变填充的小工具：stops = [[0, '#fff'], [1, '#000']]
  function linear(ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (const [o, c] of stops) g.addColorStop(o, c);
    return g;
  }
  K.linear = linear;
  function radial(ctx, x, y, r0, r1, stops, fx, fy) {
    const g = ctx.createRadialGradient(fx === undefined ? x : fx, fy === undefined ? y : fy, r0, x, y, r1);
    for (const [o, c] of stops) g.addColorStop(o, c);
    return g;
  }
  K.radial = radial;

  // ======================================================================
  // 主角（设计书 56.3）
  // ======================================================================
  const HERO_COL = { cape: '#e04848', body: '#5b7bd5', helmTop: '#eef2f7', helmBottom: '#a9b4c2', brim: '#8c97a6', plume: '#ff5a4f', plumeHi: '#ffb3ad', shield: '#c9a24a', shieldHi: '#ffe08a' };
  // v0.51 的三位新英雄（设计书 59.3）：各自固定的配色和体型，衣柜外观只用于铛铛和叮叮
  const HERO_LOOKS = {
    yan: { scale: 1.05, eye: '#ffd08a', col: { cape: '#6f6a62', body: '#8a5a3a', helmTop: '#d6cfc0', helmBottom: '#7d776c', brim: '#5d574e', plume: '#e0893a', plumeHi: '#ffc58a', shield: '#8d8678', shieldHi: '#ffcf7a' } },
    ying: { scale: 0.9, eye: '#d8fff4', col: { cape: '#2f6f68', body: '#3f8f7a', helmTop: '#4a9486', helmBottom: '#1f4a46', brim: '#1a3b38', plume: '#7fe0c0', plumeHi: '#d8fff0', shield: '#e8d27a', shieldHi: '#fff3b0' } },
    mu: { scale: 1.1, eye: '#e8ffb0', col: { cape: '#4d6b34', body: '#6b4a2e', helmTop: '#c49a66', helmBottom: '#6a4a2a', brim: '#4a3220', plume: '#9fd36a', plumeHi: '#e6ffb8', shield: '#7a5a32', shieldHi: '#d8f0a0' } },
  };
  // 新英雄的头部（设计书 59.3）：阿岩的平顶重盔、萤萤的兜帽、阿木的木面具
  function heroHead(ctx, s, t, id, col, eye, open) {
    if (id === 'yan') {
      const hg = ctx.createLinearGradient(s * 0.3, -s * 0.4, -s * 0.3, s * 0.3);
      hg.addColorStop(0, light(col.helmTop, 0.1));
      hg.addColorStop(0.5, deep(col.helmBottom, 0.25));
      hg.addColorStop(1, deep(col.helmBottom, 0.7));
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.moveTo(-s * 0.32, s * 0.3);
      ctx.lineTo(-s * 0.34, -s * 0.28);
      ctx.quadraticCurveTo(0, -s * 0.44, s * 0.34, -s * 0.28);
      ctx.lineTo(s * 0.34, s * 0.3);
      ctx.closePath();
      ctx.fill();
      // 铆钉
      for (const rx of [-0.24, 0.24]) dot(ctx, s * rx, -s * 0.2, 1.2, col.shieldHi, 0.6);
      // T 形观察缝
      ctx.fillStyle = '#07050c';
      ctx.fillRect(-s * 0.04, -s * 0.02, s * 0.38, s * 0.1);
      ctx.fillRect(s * 0.1, -s * 0.02, s * 0.09, s * 0.28);
      glow(ctx, s * 0.17, s * 0.03, s * 0.42, eye, 0.45);
      eyes(ctx, s * 0.15, s * 0.03, s * 0.17, s * 0.05, eye, 0, open);
      ctx.strokeStyle = 'rgba(255,250,235,0.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(s * 0.06, -s * 0.36);
      ctx.quadraticCurveTo(s * 0.26, -s * 0.32, s * 0.31, -s * 0.12);
      ctx.stroke();
      // 一排短短的冠饰
      for (let i = 0; i < 5; i++) {
        const cx = -s * 0.2 + i * s * 0.09;
        const h = s * (0.14 + (i === 2 ? 0.05 : 0)) + Math.sin(t * 3 + i) * 1;
        ctx.fillStyle = i % 2 ? col.plume : light(col.plume, 0.15);
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.04, -s * 0.36);
        ctx.lineTo(cx - s * 0.02, -s * 0.36 - h);
        ctx.lineTo(cx + s * 0.04, -s * 0.36);
        ctx.closePath();
        ctx.fill();
      }
      glow(ctx, 0, -s * 0.5, s * 0.3, col.plumeHi, 0.3);
    } else if (id === 'ying') {
      // 兜帽：软软地往后垂，尖端像一片叶子，挂着一颗小光点
      const fl = Math.sin(t * 3) * 3;
      const hg = ctx.createLinearGradient(s * 0.3, -s * 0.4, -s * 0.6, s * 0.3);
      hg.addColorStop(0, light(col.helmTop, 0.1));
      hg.addColorStop(1, deep(col.helmBottom, 0.5));
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.moveTo(s * 0.3, s * 0.3);
      ctx.quadraticCurveTo(s * 0.42, -s * 0.2, s * 0.05, -s * 0.38);
      ctx.quadraticCurveTo(-s * 0.4, -s * 0.42, -s * 0.62 - fl, -s * 0.1);
      ctx.quadraticCurveTo(-s * 0.95 - fl * 1.5, s * 0.15, -s * 1.05 - fl * 2, s * 0.45);
      ctx.quadraticCurveTo(-s * 0.7, s * 0.2, -s * 0.38, s * 0.3);
      ctx.closePath();
      ctx.fill();
      glow(ctx, -s * 1.02 - fl * 2, s * 0.45, s * 0.3, '#d8ffb0', 0.7);
      dot(ctx, -s * 1.02 - fl * 2, s * 0.45, 2, '#f4ffe0', 1);
      // 帽沿下的脸藏在阴影里
      ctx.fillStyle = '#0a0d10';
      ctx.beginPath();
      ctx.ellipse(s * 0.14, s * 0.06, s * 0.2, s * 0.17, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = rgba(col.plume, 0.6);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(s * 0.3, s * 0.28);
      ctx.quadraticCurveTo(s * 0.4, -s * 0.18, s * 0.05, -s * 0.34);
      ctx.stroke();
      glow(ctx, s * 0.16, s * 0.06, s * 0.45, eye, 0.5);
      eyes(ctx, s * 0.16, s * 0.06, s * 0.14, s * 0.055, eye, -0.05, open);
    } else if (id === 'mu') {
      // 木面具 + 一对小鹿角似的树枝 + 叶冠
      ctx.strokeStyle = deep(col.helmBottom, 0.2);
      ctx.lineCap = 'round';
      for (const [bx, dir] of [[-s * 0.1, -1], [s * 0.1, 1]]) {
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(bx, -s * 0.3);
        ctx.quadraticCurveTo(bx + dir * s * 0.05 - s * 0.1, -s * 0.6, bx - s * 0.25 + dir * s * 0.05, -s * 0.85);
        ctx.stroke();
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(bx - s * 0.06, -s * 0.56);
        ctx.lineTo(bx - s * 0.02 + dir * s * 0.12, -s * 0.72);
        ctx.stroke();
      }
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(-s * 0.22 - i * s * 0.08, -s * 0.84 + i * s * 0.1);
        ctx.rotate(-0.8 + i * 0.3 + Math.sin(t * 3 + i) * 0.1);
        ctx.fillStyle = i === 1 ? light(col.plume, 0.2) : col.plume;
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.05, s * 0.11, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      glow(ctx, -s * 0.3, -s * 0.8, s * 0.3, col.plumeHi, 0.3);
      // 兜帽披在面具后面
      ctx.fillStyle = deep(col.cape, 0.35);
      ctx.beginPath();
      ctx.moveTo(s * 0.1, -s * 0.36);
      ctx.quadraticCurveTo(-s * 0.5, -s * 0.38, -s * 0.5, s * 0.32);
      ctx.lineTo(s * 0.0, s * 0.32);
      ctx.closePath();
      ctx.fill();
      // 面具
      const mg = ctx.createLinearGradient(s * 0.32, -s * 0.3, -s * 0.2, s * 0.3);
      mg.addColorStop(0, light(col.helmTop, 0.15));
      mg.addColorStop(1, deep(col.helmBottom, 0.35));
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.ellipse(s * 0.08, -s * 0.01, s * 0.27, s * 0.33, 0, 0, TAU);
      ctx.fill();
      // 木纹
      ctx.strokeStyle = rgba('#3a2412', 0.45);
      ctx.lineWidth = 1;
      for (const k of [-0.18, 0.2]) {
        ctx.beginPath();
        ctx.moveTo(-s * 0.12, s * k);
        ctx.quadraticCurveTo(s * 0.1, s * (k + 0.06), s * 0.3, s * k);
        ctx.stroke();
      }
      // 眼洞里的光
      ctx.fillStyle = '#0a0c06';
      for (const ex of [s * 0.05, s * 0.24]) {
        ctx.beginPath();
        ctx.ellipse(ex, s * 0.0, s * 0.055, s * 0.04, 0, 0, TAU);
        ctx.fill();
      }
      glow(ctx, s * 0.15, 0, s * 0.42, eye, 0.45);
      eyes(ctx, s * 0.145, 0, s * 0.19, s * 0.04, eye, 0, open);
      // 面具上一道发光的叶纹
      rune(ctx, [[s * 0.15, -s * 0.28], [s * 0.15, -s * 0.12], [s * 0.08, -s * 0.06]], col.plumeHi, 1.2, 0.7);
    }
  }

  // 英雄手里的武器（设计书 60.3）：原点在握把，朝 +x 方向；戴深色手套的手
  function glove(ctx, x, y, r) {
    ctx.fillStyle = radial(ctx, x, y, 0.5, r, [[0, '#5a4030'], [1, '#22160e']], x + r * 0.3, y - r * 0.3);
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.9, 0, 0, TAU);
    ctx.fill();
  }
  K.weapon = function (ctx, weapon, s, shotAge, col) {
    const pull = shotAge !== undefined && shotAge < 0.12 ? 1 - shotAge / 0.12 : 0;
    const fired = shotAge !== undefined && shotAge < 0.25 ? 1 - shotAge / 0.25 : 0;
    const hi = (col && col.shieldHi) || '#ffe08a';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (weapon === 'crossbow') {
      // 弩身：木头 + 两道金属箍，前面的弩臂带发光的端点
      ctx.fillStyle = linear(ctx, 0, -s * 0.12, 0, s * 0.12, [[0, '#9a6a44'], [1, '#3a2416']]);
      ctx.beginPath();
      ctx.moveTo(-s * 0.15, -s * 0.07);
      ctx.lineTo(s * 0.8, -s * 0.05);
      ctx.lineTo(s * 0.82, s * 0.05);
      ctx.lineTo(-s * 0.1, s * 0.12);
      ctx.closePath();
      ctx.fill();
      for (const bx of [0.2, 0.55]) {
        ctx.fillStyle = '#8a8f9a';
        ctx.fillRect(s * bx, -s * 0.07, s * 0.05, s * 0.14);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillRect(s * bx, -s * 0.07, s * 0.05, s * 0.025);
      }
      ctx.strokeStyle = '#2a1a10';
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(s * 0.58, -s * 0.48);
      ctx.quadraticCurveTo(s * 0.84, 0, s * 0.58, s * 0.48);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,220,170,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.strokeStyle = rgba(hi, 0.8);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s * 0.58, -s * 0.48);
      ctx.lineTo(s * 0.36 - pull * 4, 0);
      ctx.lineTo(s * 0.58, s * 0.48);
      ctx.stroke();
      glow(ctx, s * 0.58, -s * 0.48, s * 0.12, hi, 0.6);
      glow(ctx, s * 0.58, s * 0.48, s * 0.12, hi, 0.6);
      glove(ctx, 0, s * 0.02, s * 0.12);
    } else if (weapon === 'staff') {
      // 魔法杖：螺旋缠绕的深色木杖，顶端一颗带光核的水晶
      ctx.strokeStyle = linear(ctx, -s * 0.1, 0, s * 0.75, 0, [[0, '#2a1a12'], [1, '#6a4a32']]);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-s * 0.15, s * 0.16);
      ctx.lineTo(s * 0.72, -s * 0.05);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(210,170,255,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) {
        const u = i / 10;
        const px = -s * 0.1 + u * s * 0.78;
        const py = s * 0.15 - u * s * 0.2 + Math.sin(u * 14) * s * 0.035;
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.stroke();
      const k = 1 + fired * 0.5;
      glow(ctx, s * 0.84, -s * 0.07, s * 0.45 * k, '#c58cff', 0.6 + fired * 0.3);
      ctx.fillStyle = radial(ctx, s * 0.84, -s * 0.07, 0.5, s * 0.17 * k, [[0, '#ffffff'], [0.35, '#e2c8ff'], [1, '#6a3ab0']], s * 0.8, -s * 0.12);
      ctx.beginPath();
      ctx.moveTo(s * 0.84, -s * 0.27 * k);
      ctx.lineTo(s * 0.97, -s * 0.07);
      ctx.lineTo(s * 0.84, s * 0.12 * k);
      ctx.lineTo(s * 0.71, -s * 0.07);
      ctx.closePath();
      ctx.fill();
      // 托住水晶的两根木爪
      ctx.strokeStyle = '#4a3020';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(s * 0.7, -s * 0.03);
      ctx.quadraticCurveTo(s * 0.7, -s * 0.2, s * 0.78, -s * 0.24);
      ctx.moveTo(s * 0.72, s * 0.02);
      ctx.quadraticCurveTo(s * 0.86, s * 0.12, s * 0.94, s * 0.04);
      ctx.stroke();
      glove(ctx, s * 0.12, s * 0.02, s * 0.12);
    } else if (weapon === 'orb') {
      // 雷电法球：浮在手上方的水晶球，里面有一道道细闪电
      const k = 1 + fired * 0.3;
      const ox = s * 0.55;
      glow(ctx, ox, 0, s * 0.7 * k, '#7ac8ff', 0.5 + fired * 0.4);
      ctx.fillStyle = radial(ctx, ox, 0, 0.5, s * 0.3 * k, [[0, 'rgba(230,245,255,0.95)'], [0.6, 'rgba(110,180,255,0.75)'], [1, 'rgba(30,70,140,0.9)']], ox + s * 0.08, -s * 0.1);
      ctx.beginPath();
      ctx.arc(ox, 0, s * 0.3 * k, 0, TAU);
      ctx.fill();
      veins(ctx, ox - s * 0.12, s * 0.12, s * 0.14, -0.8, 2, '#ffffff', 0.85, Math.floor((shotAge || 0) * 20) + 3, 1);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(ox, 0, s * 0.24 * k, -1.4, -0.5);
      ctx.stroke();
      glove(ctx, s * 0.15, 0, s * 0.12);
    } else if (weapon === 'cannon') {
      // 手炮：铁管 + 铜箍，开炮时炮口发光
      const kick = shotAge !== undefined && shotAge < 0.15 ? (1 - shotAge / 0.15) * 6 : 0;
      ctx.save();
      ctx.translate(-kick, 0);
      ctx.fillStyle = linear(ctx, 0, -s * 0.2, 0, s * 0.2, [[0, '#7a7f8c'], [0.4, '#3a3d48'], [1, '#15161c']]);
      ctx.beginPath();
      ctx.moveTo(-s * 0.2, -s * 0.16);
      ctx.lineTo(s * 0.88, -s * 0.2);
      ctx.lineTo(s * 0.88, s * 0.2);
      ctx.lineTo(-s * 0.2, s * 0.16);
      ctx.quadraticCurveTo(-s * 0.3, 0, -s * 0.2, -s * 0.16);
      ctx.fill();
      for (const bx of [0.05, 0.45, 0.82]) {
        ctx.fillStyle = linear(ctx, 0, -s * 0.22, 0, s * 0.22, [[0, '#ffe2a0'], [0.5, '#b8862e'], [1, '#5a3a10']]);
        ctx.fillRect(s * bx, -s * 0.21, s * 0.07, s * 0.42);
      }
      ctx.fillStyle = '#0a0a0e';
      ctx.beginPath();
      ctx.ellipse(s * 0.89, 0, s * 0.06, s * 0.16, 0, 0, TAU);
      ctx.fill();
      if (fired > 0) glow(ctx, s * 0.95, 0, s * 0.6, '#ffb060', fired * 0.9, true);
      ctx.restore();
      glove(ctx, s * 0.05, s * 0.06, s * 0.12);
    } else if (weapon === 'boomerang') {
      if (shotAge === undefined || shotAge > 0.5) {
        ctx.save();
        ctx.translate(s * 0.42, 0);
        K.boomerang(ctx, s * 0.5, 0);
        ctx.restore();
      }
      glove(ctx, s * 0.2, 0, s * 0.12);
    } else {
      // 木弓：反曲的弓臂，中间缠着握把，两端的弓梢发光；拉弓时搭着一支发光的箭
      const R = s * 0.64;
      const a0 = -1.25;
      const a1 = 1.25;
      const cx = s * 0.12;
      const limb = (sign) => {
        ctx.beginPath();
        ctx.moveTo(cx + R * 0.98, 0);
        ctx.quadraticCurveTo(cx + R * 1.02, sign * R * 0.55, cx + Math.cos(sign * 1.1) * R, Math.sin(sign * 1.1) * R);
        // 弓梢向外反曲
        ctx.quadraticCurveTo(cx + Math.cos(sign * 1.25) * R * 0.95, Math.sin(sign * 1.25) * R * 1.02, cx + Math.cos(sign * 1.32) * R * 0.85, Math.sin(sign * 1.32) * R * 1.08);
      };
      for (const sign of [-1, 1]) {
        limb(sign);
        ctx.strokeStyle = '#2a170c';
        ctx.lineWidth = 4.2;
        ctx.stroke();
        limb(sign);
        ctx.strokeStyle = linear(ctx, cx + R, 0, cx + R * 0.4, sign * R, [[0, '#c48a52'], [1, '#7a4a26']]);
        ctx.lineWidth = 2.6;
        ctx.stroke();
        limb(sign);
        ctx.strokeStyle = 'rgba(255,230,190,0.45)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
      const tipX = cx + Math.cos(1.32) * R * 0.85;
      const tipY = Math.sin(1.32) * R * 1.08;
      glow(ctx, tipX, -tipY, s * 0.16, hi, 0.55 + pull * 0.4);
      glow(ctx, tipX, tipY, s * 0.16, hi, 0.55 + pull * 0.4);
      // 弓弦
      const nx = cx - pull * 8;
      ctx.strokeStyle = rgba('#fff6e0', 0.9);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tipX, -tipY);
      ctx.lineTo(nx, 0);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      // 拉弓时搭着的箭
      if (pull > 0) {
        ctx.strokeStyle = '#d8c0a0';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(nx, 0);
        ctx.lineTo(cx + R * 1.25, 0);
        ctx.stroke();
        glow(ctx, cx + R * 1.25, 0, s * 0.25, hi, pull * 0.9, true);
      }
      // 握把的缠绳
      ctx.fillStyle = '#3a2616';
      ctx.fillRect(cx + R * 0.9, -s * 0.11, s * 0.1, s * 0.22);
      ctx.strokeStyle = 'rgba(220,180,120,0.6)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 4; i++) {
        const yy = -s * 0.09 + i * s * 0.06;
        ctx.beginPath();
        ctx.moveTo(cx + R * 0.9, yy);
        ctx.lineTo(cx + R * 0.9 + s * 0.1, yy + s * 0.03);
        ctx.stroke();
      }
      glove(ctx, cx + R * 0.95, 0, s * 0.12);
    }
  };

  // 回旋镖：刻着发光的符文
  K.boomerang = function (ctx, size, spin) {
    ctx.save();
    ctx.rotate(spin);
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(-size, -size * 0.2);
      ctx.quadraticCurveTo(0, -size * 0.55, size * 0.15, size * 0.05);
      ctx.quadraticCurveTo(size * 0.1, -size * 0.95, size * 0.35, -size);
      ctx.quadraticCurveTo(size * 0.4, size * 0.35, -size, size * 0.1);
      ctx.closePath();
    };
    path();
    ctx.fillStyle = linear(ctx, size * 0.4, -size, -size, size * 0.2, [[0, '#e8b064'], [1, '#6a3e1a']]);
    ctx.fill();
    rimEdge(ctx, path, '#fff0c8', 0.7, 2, 1.5, 1.5);
    rune(ctx, [[-size * 0.7, -size * 0.08], [-size * 0.2, -size * 0.2], [size * 0.08, -size * 0.1], [size * 0.22, -size * 0.7]], '#ffd27a', 1.1, 0.7);
    ctx.restore();
  };

  K.hero = function (ctx, x, y, st) {
    const S = TD.sprites;
    const t = st.t;
    const s = 32;
    const look = HERO_LOOKS[st.hero] || null;
    const outfit = !look && TD.data.outfitById ? TD.data.outfitById(st.outfit) : null;
    const col = look ? look.col : outfit ? outfit.colors : HERO_COL;
    const extra = outfit && outfit.extra;
    const ding = st.hero === 'ding';
    const sc = look ? look.scale : ding ? 0.93 : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sc, sc);
    let bob = Math.sin(t * 2.4) * 1.2;
    let lean = 0;
    if (st.mood === 'win') bob = -Math.abs(Math.sin(t * 6)) * 10;
    if (st.mood === 'worried') {
      lean = 0.08;
      ctx.translate(Math.sin(t * 28) * 1, 0);
    }
    if (st.mood === 'lose') {
      lean = 0.22;
      ctx.translate(0, 6);
    }
    shadow(ctx, 0, 2, s * 0.7);
    ctx.translate(0, bob);
    ctx.rotate(-lean);
    const eye = look ? look.eye : '#fff2c4';
    const pull = st.shotAge !== undefined && st.shotAge < 0.15 ? 1 - st.shotAge / 0.15 : 0;
    const wave = Math.sin(t * 3.2) * 4 + pull * 6;
    const neckY = -s * 1.86;

    // ----- 披风（两层：外面是披风颜色，里面是更深的衬里） -----
    const capePath = (k) => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.2, neckY + s * 0.05);
      ctx.bezierCurveTo(-s * 0.7 * k, -s * 1.4 + wave * 0.3, -s * (0.95 * k) - wave * 0.6, -s * 0.7, -s * (1.1 * k) - wave, -s * 0.05);
      // 下摆：几道飘动的波浪
      const x0 = -s * (1.1 * k) - wave;
      for (let i = 1; i <= 3; i++) {
        const xi = x0 + (s * 0.95 * k + wave) * (i / 3);
        ctx.quadraticCurveTo(xi - s * 0.18, -s * 0.02 + Math.sin(t * 4 + i) * 2, xi, -s * 0.12 + (i === 3 ? -s * 0.1 : 0));
      }
      ctx.lineTo(s * 0.12, neckY + s * 0.15);
      ctx.closePath();
    };
    capePath(1.08);
    ctx.fillStyle = deep(col.cape, 0.82);
    ctx.fill();
    capePath(1);
    const capeG = ctx.createLinearGradient(s * 0.1, neckY, -s * 0.8, 0);
    capeG.addColorStop(0, deep(col.cape, 0.2));
    capeG.addColorStop(1, deep(col.cape, 0.66));
    ctx.fillStyle = capeG;
    ctx.fill();
    // 披风的褶皱和一圈绣花滚边（设计书 60.3）
    ctx.save();
    capePath(1);
    ctx.clip();
    ctx.strokeStyle = rgba(deep(col.cape, 0.75), 0.6);
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) {
      const fx = -s * (0.25 + i * 0.2) - wave * (0.2 + i * 0.15);
      ctx.beginPath();
      ctx.moveTo(-s * 0.15 - i * s * 0.05, neckY + s * 0.3);
      ctx.quadraticCurveTo(fx + s * 0.1, -s * 0.9, fx, -s * 0.1);
      ctx.stroke();
    }
    ctx.strokeStyle = rgba(light(col.cape, 0.35), 0.25);
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const fx = -s * (0.32 + i * 0.22) - wave * (0.25 + i * 0.15);
      ctx.beginPath();
      ctx.moveTo(-s * 0.12 - i * s * 0.05, neckY + s * 0.35);
      ctx.quadraticCurveTo(fx + s * 0.12, -s * 0.9, fx + s * 0.03, -s * 0.12);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    capePath(0.93);
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = rgba(col.shieldHi, 0.4);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    if (extra === 'stars' || extra === 'ink') {
      for (const [px, py] of [[-0.6, -0.5], [-0.45, -1.0], [-0.8, -0.25], [-0.35, -0.7]]) {
        if (extra === 'stars') dot(ctx, s * px - wave * 0.4, s * py, 1.3, '#ffd23f', 0.9);
        else {
          ctx.fillStyle = '#05030a';
          ctx.beginPath();
          ctx.arc(s * px - wave * 0.4, s * py, 2, 0, TAU);
          ctx.fill();
        }
      }
    }
    if (st.hero === 'yan') {
      // 阿岩：背上一面高高的石盾，盾面刻着发光的符文
      ctx.save();
      ctx.translate(-s * 0.36, -s * 1.3);
      ctx.rotate(-0.12);
      const sg = ctx.createLinearGradient(-s * 0.3, -s * 0.7, s * 0.3, s * 0.6);
      sg.addColorStop(0, light(col.shield, 0.1));
      sg.addColorStop(1, deep(col.shield, 0.6));
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(-s * 0.3, -s * 0.62);
      ctx.quadraticCurveTo(0, -s * 0.74, s * 0.3, -s * 0.62);
      ctx.lineTo(s * 0.28, s * 0.25);
      ctx.quadraticCurveTo(s * 0.2, s * 0.6, 0, s * 0.72);
      ctx.quadraticCurveTo(-s * 0.2, s * 0.6, -s * 0.28, s * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = deep(col.shield, 0.75);
      ctx.lineWidth = 2;
      ctx.stroke();
      // 石缝
      ctx.strokeStyle = rgba('#2a2620', 0.5);
      ctx.lineWidth = 1;
      for (const [a, b, c2, d] of [[-0.25, -0.2, 0.05, -0.28], [0.05, -0.28, 0.27, -0.1], [-0.27, 0.18, 0.1, 0.12]]) {
        ctx.beginPath();
        ctx.moveTo(s * a, s * b);
        ctx.lineTo(s * c2, s * d);
        ctx.stroke();
      }
      rune(ctx, [[0, -s * 0.45], [0, s * 0.45]], col.shieldHi, 1.6, 0.8);
      rune(ctx, [[-s * 0.16, -s * 0.05], [s * 0.16, -s * 0.05]], col.shieldHi, 1.6, 0.8);
      glow(ctx, 0, -s * 0.05, s * 0.3, col.shieldHi, 0.35);
      ctx.restore();
    } else if (st.hero === 'mu') {
      // 阿木：背上的长箭袋，露出一捆带叶羽的箭
      ctx.save();
      ctx.translate(-s * 0.28, -s * 1.5);
      ctx.rotate(-0.45);
      ctx.fillStyle = deep(col.body, 0.45);
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.11, s * 0.5, 0, 0, TAU);
      ctx.fill();
      for (let i = 0; i < 4; i++) {
        const ax = (i - 1.5) * s * 0.05;
        ctx.strokeStyle = '#3a2a1a';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(ax, -s * 0.3);
        ctx.lineTo(ax, -s * 0.78);
        ctx.stroke();
        ctx.fillStyle = i % 2 ? col.plume : light(col.plume, 0.3);
        ctx.beginPath();
        ctx.ellipse(ax, -s * 0.8, s * 0.035, s * 0.09, 0, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    } else if (st.hero !== 'ying') {
      // 背后的小圆盾（只露出边缘的光）
      ctx.fillStyle = deep(col.shield, 0.55);
      ctx.beginPath();
      ctx.arc(-s * 0.3, -s * 1.42, s * 0.22, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = rgba(col.shieldHi, 0.55);
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(-s * 0.3, -s * 1.42, s * 0.22, -1.2, 0.8);
      ctx.stroke();
    }
    if (st.hero === 'mu') {
      // 阿木的披风下摆缀着一圈叶子
      for (let i = 0; i < 6; i++) {
        const lx = -s * (0.15 + i * 0.17) - wave * (i / 6);
        const ly = -s * 0.1 - Math.sin(t * 4 + i) * 2;
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(0.6 + Math.sin(t * 3 + i) * 0.2);
        ctx.fillStyle = i % 2 ? deep(col.plume, 0.25) : deep(col.plume, 0.45);
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.06, s * 0.13, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }

    // ----- 腿：修长、收在靴子里 -----
    const step = st.mood === 'win' ? 0 : Math.sin(t * 2.4) * 0.02;
    for (const [lx, far] of [[s * 0.1, true], [-s * 0.1, false]]) {
      const fx = lx + step * s * (far ? 1 : -1);
      ctx.fillStyle = deep(col.body, far ? 0.82 : 0.68);
      ctx.beginPath();
      ctx.moveTo(lx - s * 0.09, -s * 0.98);
      ctx.quadraticCurveTo(lx - s * 0.1, -s * 0.5, fx - s * 0.06, -s * 0.2);
      ctx.lineTo(fx + s * 0.06, -s * 0.2);
      ctx.quadraticCurveTo(lx + s * 0.08, -s * 0.5, lx + s * 0.09, -s * 0.98);
      ctx.closePath();
      ctx.fill();
      // 靴子
      ctx.fillStyle = far ? '#140d0a' : '#22160f';
      ctx.beginPath();
      ctx.moveTo(fx - s * 0.08, -s * 0.34);
      ctx.lineTo(fx + s * 0.07, -s * 0.34);
      ctx.quadraticCurveTo(fx + s * 0.22, -s * 0.08, fx + s * 0.2, 0);
      ctx.lineTo(fx - s * 0.09, 0);
      ctx.closePath();
      ctx.fill();
      // 靴子绑带、靴尖亮边、护膝
      ctx.strokeStyle = far ? 'rgba(120,90,60,0.35)' : 'rgba(170,130,85,0.55)';
      ctx.lineWidth = 1;
      for (const by of [-0.28, -0.19]) {
        ctx.beginPath();
        ctx.moveTo(fx - s * 0.08, s * by);
        ctx.lineTo(fx + s * 0.08, s * (by + 0.03));
        ctx.stroke();
      }
      if (!far) {
        ctx.strokeStyle = 'rgba(255,230,190,0.35)';
        ctx.beginPath();
        ctx.moveTo(fx + s * 0.08, -s * 0.12);
        ctx.quadraticCurveTo(fx + s * 0.19, -s * 0.06, fx + s * 0.19, -s * 0.01);
        ctx.stroke();
        const kg = ctx.createRadialGradient(lx + s * 0.03, -s * 0.66, 0.5, lx, -s * 0.62, s * 0.1);
        kg.addColorStop(0, deep(col.helmTop, 0.25));
        kg.addColorStop(1, deep(col.helmBottom, 0.75));
        ctx.fillStyle = kg;
        ctx.beginPath();
        ctx.ellipse(lx + s * 0.005, -s * 0.62, s * 0.07, s * 0.055, 0, 0, TAU);
        ctx.fill();
      }
    }
    // ----- 上衣：收腰、下摆张开 -----
    ctx.fillStyle = bodyGrad(ctx, -s * 0.35, neckY, s * 0.35, -s * 0.8, col.body, 0.3, 0.72);
    ctx.beginPath();
    ctx.moveTo(-s * 0.24, neckY + s * 0.08);
    ctx.quadraticCurveTo(-s * 0.28, -s * 1.5, -s * 0.17, -s * 1.18);
    ctx.quadraticCurveTo(-s * 0.3, -s * 0.95, -s * 0.36, -s * 0.8);
    ctx.lineTo(s * 0.36, -s * 0.8);
    ctx.quadraticCurveTo(s * 0.3, -s * 0.95, s * 0.17, -s * 1.18);
    ctx.quadraticCurveTo(s * 0.28, -s * 1.5, s * 0.24, neckY + s * 0.08);
    ctx.quadraticCurveTo(0, neckY - s * 0.04, -s * 0.24, neckY + s * 0.08);
    ctx.fill();
    // 下摆的光边
    ctx.strokeStyle = rgba(col.shieldHi, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-s * 0.34, -s * 0.82);
    ctx.lineTo(s * 0.34, -s * 0.82);
    ctx.stroke();
    // 胸甲：几块甲片，每块上缘一道金属亮边（设计书 60.3）
    for (let i = 0; i < 3; i++) {
      const py = -s * (1.72 - i * 0.14);
      const pw = s * (0.21 - i * 0.012);
      const pg = ctx.createLinearGradient(pw, py - s * 0.1, -pw, py + s * 0.08);
      pg.addColorStop(0, light(col.helmTop, 0.1));
      pg.addColorStop(0.5, deep(col.helmBottom, 0.35));
      pg.addColorStop(1, deep(col.helmBottom, 0.75));
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.moveTo(-pw, py);
      ctx.quadraticCurveTo(0, py - s * 0.07, pw, py);
      ctx.lineTo(pw * 0.96, py + s * 0.11);
      ctx.quadraticCurveTo(0, py + s * 0.05, -pw * 0.96, py + s * 0.11);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,248,230,0.45)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-pw * 0.2, py - s * 0.04);
      ctx.quadraticCurveTo(pw * 0.5, py - s * 0.05, pw * 0.95, py);
      ctx.stroke();
    }
    // 胸前的发光扣饰
    glow(ctx, s * 0.02, -s * 1.76, s * 0.25, col.shieldHi, 0.55);
    ctx.fillStyle = light(col.shieldHi, 0.4);
    ctx.beginPath();
    ctx.moveTo(s * 0.02, -s * 1.83);
    ctx.lineTo(s * 0.07, -s * 1.76);
    ctx.lineTo(s * 0.02, -s * 1.69);
    ctx.lineTo(-s * 0.03, -s * 1.76);
    ctx.closePath();
    ctx.fill();
    // 腰间的小皮包
    ctx.fillStyle = '#3a2616';
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, -s * 1.15);
    ctx.lineTo(-s * 0.05, -s * 1.15);
    ctx.quadraticCurveTo(-s * 0.04, -s * 0.98, -s * 0.12, -s * 0.96);
    ctx.quadraticCurveTo(-s * 0.21, -s * 0.98, -s * 0.2, -s * 1.15);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,160,110,0.45)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-s * 0.19, -s * 1.1);
    ctx.lineTo(-s * 0.06, -s * 1.1);
    ctx.stroke();
    dot(ctx, -s * 0.125, -s * 1.08, 0.9, col.shieldHi, 0.8);
    // 腰带
    ctx.fillStyle = '#1e140c';
    ctx.fillRect(-s * 0.19, -s * 1.22, s * 0.38, s * 0.07);
    glow(ctx, s * 0.02, -s * 1.185, s * 0.2, col.shieldHi, 0.5);
    ctx.fillStyle = light(col.shieldHi, 0.3);
    ctx.fillRect(-s * 0.02, -s * 1.22, s * 0.07, s * 0.07);
    if (ding) {
      // 叮叮腰间会发光的铃铛
      const ring = st.shotAge !== undefined && st.shotAge < 0.3 ? 1 : 0.4;
      glow(ctx, s * 0.2, -s * 1.08, s * 0.45, '#ffd27a', 0.5 + ring * 0.4);
      ctx.fillStyle = '#ffd96a';
      ctx.beginPath();
      ctx.arc(s * 0.2, -s * 1.08, s * 0.08, 0, TAU);
      ctx.fill();
    }
    if (st.hero === 'ying') {
      // 萤萤腰间的萤火灯：放萤火虫时更亮
      const lit = st.shotAge !== undefined && st.shotAge < 0.3 ? 1 : 0;
      const sway = Math.sin(t * 2.6) * 0.15;
      ctx.save();
      ctx.translate(s * 0.22, -s * 1.18);
      ctx.rotate(sway);
      ctx.strokeStyle = '#2a1e12';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, s * 0.12);
      ctx.stroke();
      glow(ctx, 0, s * 0.24, s * 0.7, '#c8ffb0', 0.45 + lit * 0.35);
      ctx.fillStyle = 'rgba(220,255,200,0.85)';
      ctx.beginPath();
      ctx.ellipse(0, s * 0.24, s * 0.08, s * 0.11, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#3a2a16';
      ctx.fillRect(-s * 0.07, s * 0.11, s * 0.14, s * 0.03);
      ctx.fillRect(-s * 0.06, s * 0.34, s * 0.12, s * 0.03);
      ctx.restore();
      // 绕着她飞的三只萤火虫
      for (let i = 0; i < 3; i++) {
        const a = t * 1.6 + i * 2.1;
        dot(ctx, Math.cos(a) * s * 0.7, -s * 1.5 + Math.sin(a * 1.3) * s * 0.5, 1.6, '#d8ffb0', 0.6 + Math.sin(t * 5 + i) * 0.3);
      }
    }
    // 围巾：从脖子往后飘
    const sw2 = Math.sin(t * 3.6) * 3;
    ctx.fillStyle = deep(col.plume, 0.3);
    ctx.beginPath();
    ctx.moveTo(-s * 0.12, neckY + s * 0.02);
    ctx.quadraticCurveTo(-s * 0.55, neckY + s * 0.1 + sw2, -s * 0.85 - sw2, neckY + s * 0.32);
    ctx.quadraticCurveTo(-s * 0.5, neckY + s * 0.25, -s * 0.05, neckY + s * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = deep(col.plume, 0.15);
    ctx.beginPath();
    ctx.ellipse(-s * 0.02, neckY + s * 0.08, s * 0.18, s * 0.08, 0, 0, TAU);
    ctx.fill();
    // 前肩的护甲
    const pg2 = ctx.createRadialGradient(s * 0.2, -s * 1.82, 1, s * 0.12, -s * 1.74, s * 0.2);
    pg2.addColorStop(0, light(col.helmTop, 0.2));
    pg2.addColorStop(1, deep(col.helmBottom, 0.55));
    ctx.fillStyle = pg2;
    ctx.beginPath();
    ctx.ellipse(s * 0.12, -s * 1.74, s * 0.17, s * 0.12, -0.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,250,235,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(s * 0.12, -s * 1.74, s * 0.15, s * 0.1, -0.2, -2.6, -0.4);
    ctx.stroke();
    for (const rx of [0.02, 0.12, 0.22]) dot(ctx, s * rx, -s * (1.66 + (rx === 0.12 ? -0.01 : 0.02)), 0.8, col.shieldHi, 0.7);

    // ----- 武器与手臂 -----
    if (st.mood !== 'lose') {
      ctx.save();
      ctx.translate(s * 0.18, -s * 1.6);
      ctx.rotate(st.aimAngle || 0);
      ctx.strokeStyle = deep(col.body, 0.45);
      ctx.lineWidth = s * 0.09;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-s * 0.05, s * 0.05);
      ctx.lineTo(s * 0.32, 0);
      ctx.stroke();
      // 护腕：两道金属环
      ctx.strokeStyle = light(col.helmTop, 0.05);
      ctx.lineWidth = s * 0.1;
      ctx.beginPath();
      ctx.moveTo(s * 0.16, s * 0.012);
      ctx.lineTo(s * 0.26, 0.002);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(40,30,20,0.5)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(s * 0.21, -s * 0.045);
      ctx.lineTo(s * 0.21, s * 0.05);
      ctx.stroke();
      // 拉弓时手上一圈光
      if (pull > 0) {
        glow(ctx, s * 0.3, 0, s * 0.35, col.shieldHi, pull * 0.7);
        ctx.strokeStyle = rgba(col.shieldHi, pull * 0.8);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(s * 0.3, 0, s * (0.12 + (1 - pull) * 0.15), 0, TAU);
        ctx.stroke();
      }
      ctx.translate(s * 0.12, 0);
      K.weapon(ctx, st.weapon, s * 0.9, st.shotAge, col);
      if (pull > 0) glow(ctx, s * 0.5, 0, s * 0.7, '#fff0c0', pull * 0.8, true);
      if (st.ascended) {
        const tw = 0.6 + Math.sin(t * 8) * 0.4;
        dot(ctx, s * 0.65, -s * 0.35, 1.6, '#ffd23f', tw);
        dot(ctx, s * 0.3, s * 0.4, 1.2, '#ffd23f', 1 - tw * 0.5);
      }
      ctx.restore();
    }

    // ----- 头与头盔 -----
    ctx.save();
    const tilt = st.critAge !== undefined && st.critAge < 0.25 ? Math.sin(st.critAge * 60) * 0.08 : 0;
    ctx.translate(s * 0.0, -s * 2.12);
    ctx.rotate(tilt + (st.mood === 'lose' ? 0.3 : 0));
    if (ding) {
      // 从头盔下飘出来的长发
      const hw = Math.sin(t * 3) * 3;
      ctx.fillStyle = '#3a2418';
      ctx.beginPath();
      ctx.moveTo(-s * 0.2, -s * 0.02);
      ctx.quadraticCurveTo(-s * 0.55 - hw, s * 0.25, -s * 0.7 - hw * 1.5, s * 0.6);
      ctx.quadraticCurveTo(-s * 0.38, s * 0.38, -s * 0.05, s * 0.2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,170,200,0.5)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-s * 0.3, s * 0.15);
      ctx.quadraticCurveTo(-s * 0.5 - hw, s * 0.34, -s * 0.66 - hw * 1.5, s * 0.56);
      ctx.stroke();
    }
    // 脖子
    ctx.fillStyle = '#1c1420';
    ctx.fillRect(-s * 0.07, s * 0.15, s * 0.14, s * 0.15);
    const openEye = st.mood === 'lose' ? 0.3 : st.mood === 'win' ? 0.55 : 1;
    if (look) {
      heroHead(ctx, s, t, st.hero, col, eye, openEye);
      ctx.restore();
      ctx.restore();
      return;
    }
    // 头盔：圆顶 + 护颊，前面开一道观察缝
    const hg = ctx.createLinearGradient(s * 0.3, -s * 0.4, -s * 0.3, s * 0.3);
    hg.addColorStop(0, light(col.helmTop, 0.15));
    hg.addColorStop(0.45, deep(col.helmBottom, 0.3));
    hg.addColorStop(1, deep(col.helmBottom, 0.72));
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, s * 0.22);
    ctx.quadraticCurveTo(-s * 0.36, -s * 0.38, s * 0.02, -s * 0.42);
    ctx.quadraticCurveTo(s * 0.36, -s * 0.36, s * 0.32, s * 0.08);
    ctx.quadraticCurveTo(s * 0.3, s * 0.26, s * 0.12, s * 0.3);
    ctx.lineTo(-s * 0.18, s * 0.3);
    ctx.closePath();
    ctx.fill();
    // 观察缝（暗）+ 里面一双发光的眼睛
    ctx.fillStyle = '#07050c';
    ctx.beginPath();
    ctx.moveTo(-s * 0.02, s * 0.0);
    ctx.quadraticCurveTo(s * 0.18, -s * 0.06, s * 0.34, s * 0.02);
    ctx.lineTo(s * 0.33, s * 0.12);
    ctx.quadraticCurveTo(s * 0.18, s * 0.1, -s * 0.02, s * 0.14);
    ctx.closePath();
    ctx.fill();
    const open = st.mood === 'lose' ? 0.3 : st.mood === 'win' ? 0.55 : 1;
    glow(ctx, s * 0.17, s * 0.06, s * 0.45, eye, 0.45);
    eyes(ctx, s * 0.17, s * 0.06, s * 0.15, s * 0.055, eye, -0.05, open);
    // 头盔的高光
    ctx.strokeStyle = 'rgba(255,250,235,0.7)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(s * 0.06, -s * 0.36);
    ctx.quadraticCurveTo(s * 0.28, -s * 0.28, s * 0.29, -s * 0.06);
    ctx.stroke();
    // 头盔装饰（衣柜）
    if (extra) {
      ctx.save();
      ctx.translate(s * 0.02, -s * 0.06);
      ctx.scale(0.45, 0.45);
      S.heroExtra(ctx, extra, s, t);
      ctx.restore();
    }
    // 长长的羽饰，随风往后飘
    const fl = Math.sin(t * 4) * 0.18;
    ctx.save();
    ctx.translate(-s * 0.02, -s * 0.4);
    const pw = Math.sin(t * 4.5) * 3;
    const pg = ctx.createLinearGradient(0, 0, -s * 1.2, s * 0.25);
    pg.addColorStop(0, light(col.plume, 0.1));
    pg.addColorStop(0.6, rgba(col.plume, 0.75));
    pg.addColorStop(1, rgba(col.plume, 0.05));
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.moveTo(s * 0.06, 0);
    ctx.bezierCurveTo(-s * 0.25, -s * 0.38 - pw, -s * 0.85, -s * 0.08 + pw, -s * 1.25, s * 0.28 + fl * s);
    ctx.bezierCurveTo(-s * 0.75, s * 0.12 + pw * 0.5, -s * 0.35, -s * 0.06, s * 0.06, s * 0.08);
    ctx.fill();
    glow(ctx, -s * 1.12, s * 0.24 + fl * s, s * 0.28, col.plumeHi, 0.55);
    ctx.restore();
    ctx.restore();
    ctx.restore();
  };
})((globalThis.TD = globalThis.TD || {}));
