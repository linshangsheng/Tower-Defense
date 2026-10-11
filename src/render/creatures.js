// 光影生灵（设计书第 56 章）：修长比例、深色剪影 + 发光的眼睛和纹路，与光影场景统一
// 坐标约定与 sprites.js 相同：原点在脚下，向上为负；s 是怪物的 size；朝左（城墙方向）
// S.monster / S.hero 会优先使用这里的画法，还没重画的怪物沿用 sprites.js 的旧画法
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

  // ======================================================================
  // 主角（设计书 56.3）
  // ======================================================================
  const HERO_COL = { cape: '#e04848', body: '#5b7bd5', helmTop: '#eef2f7', helmBottom: '#a9b4c2', brim: '#8c97a6', plume: '#ff5a4f', plumeHi: '#ffb3ad', shield: '#c9a24a', shieldHi: '#ffe08a' };
  K.hero = function (ctx, x, y, st) {
    const S = TD.sprites;
    const t = st.t;
    const s = 32;
    const outfit = TD.data.outfitById ? TD.data.outfitById(st.outfit) : null;
    const col = outfit ? outfit.colors : HERO_COL;
    const extra = outfit && outfit.extra;
    const ding = st.hero === 'ding';
    const sc = ding ? 0.93 : 1;
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
    const eye = '#fff2c4';
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
      ctx.translate(s * 0.12, 0);
      S.weaponInHand(ctx, st.weapon, s * 0.9, st.shotAge);
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

  // ======================================================================
  // 第一章 · 翠绿草原（设计书 56.4）
  // ======================================================================
  const D = K.drawers;

  D.slime = function (ctx, s, t, o) {
    shadow(ctx, 0, 2, s);
    const h = jelly(ctx, s, t, '#3aa860', '#c8ffb0', o);
    jellyEyes(ctx, -s * 0.38, -h * 0.68, s * 0.3, s * 0.1);
    // 漂在身边的小孢子
    for (let i = 0; i < 2; i++) {
      const a = t * 1.5 + i * 3 + (o.seed || 0);
      dot(ctx, Math.cos(a) * s * 0.9, -h * 0.9 + Math.sin(a * 1.3) * s * 0.3, 1.2, '#c8ffb0', 0.7);
    }
  };

  D.minijelly = function (ctx, s, t, o) {
    shadow(ctx, 0, 2, s);
    const h = jelly(ctx, s, t, '#3a8ad8', '#bfe8ff', o);
    jellyEyes(ctx, -s * 0.38, -h * 0.68, s * 0.3, s * 0.11);
  };

  D.jellyPrince = function (ctx, s, t, o) {
    shadow(ctx, 0, 2, s * 1.1);
    const h = jelly(ctx, s, t, '#2a7ad0', '#bfe4ff', o, 1.1);
    jellyEyes(ctx, -s * 0.36, -h * 0.68, s * 0.3, s * 0.09);
    // 漂浮的光晶冠
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.32;
      const bobc = Math.sin(t * 2 + i) * s * 0.05;
      const cx = Math.sin(a) * s * 0.55;
      const cy = -h * 1.45 - Math.cos(a) * s * 0.25 + bobc;
      const ch = s * (i === 2 ? 0.42 : 0.28);
      glow(ctx, cx, cy - ch * 0.4, ch * 1.2, '#ffe9a0', 0.55);
      ctx.fillStyle = 'rgba(255,240,190,0.9)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - ch);
      ctx.lineTo(cx + ch * 0.22, cy - ch * 0.35);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx - ch * 0.22, cy - ch * 0.35);
      ctx.closePath();
      ctx.fill();
    }
  };

  D.bunny = function (ctx, s, t, o) {
    const run = o.attack ? 0.4 : 1.4;
    const ph = t * 12 * run + (o.seed || 0);
    const leap = Math.max(0, Math.sin(ph)) * s * (o.attack ? 0.1 : 0.45);
    shadow(ctx, 0, 2, s * 0.9);
    ctx.save();
    ctx.translate(0, -leap);
    const base = '#c47aa0';
    const stretch = 1 + Math.sin(ph) * 0.15;
    // 后腿（长而有力）
    ctx.fillStyle = deep(base, 0.7);
    ctx.beginPath();
    ctx.ellipse(s * 0.55, -s * 0.35, s * 0.42 * stretch, s * 0.22, 0.5 + Math.sin(ph) * 0.4, 0, TAU);
    ctx.fill();
    // 身体：流线型
    ctx.fillStyle = bodyGrad(ctx, -s, -s * 1.1, s, -s * 0.2, base);
    ctx.beginPath();
    ctx.moveTo(-s * 0.75, -s * 0.75);
    ctx.bezierCurveTo(-s * 0.55, -s * 1.15, s * 0.5, -s * 1.05 * stretch, s * 0.85, -s * 0.6);
    ctx.bezierCurveTo(s * 0.9, -s * 0.25, s * 0.2, -s * 0.2, -s * 0.4, -s * 0.38);
    ctx.closePath();
    ctx.fill();
    // 前腿
    ctx.strokeStyle = deep(base, 0.6);
    ctx.lineWidth = s * 0.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, -s * 0.45);
    ctx.lineTo(-s * 0.6 - Math.sin(ph) * s * 0.25, -s * 0.05);
    ctx.stroke();
    // 头
    ctx.fillStyle = bodyGrad(ctx, -s * 1.1, -s * 1.15, -s * 0.5, -s * 0.6, base, 0.2, 0.6);
    ctx.beginPath();
    ctx.ellipse(-s * 0.8, -s * 0.85, s * 0.32, s * 0.24, -0.3, 0, TAU);
    ctx.fill();
    // 长耳朵往后飘，耳尖发光
    for (const [dx, k] of [[0, 1], [s * 0.12, 0.85]]) {
      ctx.save();
      ctx.translate(-s * 0.7 + dx, -s * 1.02);
      ctx.rotate(-1.15 * k + 1.9 + Math.sin(ph * 0.5) * 0.1);
      ctx.fillStyle = deep(base, 0.45 + (1 - k));
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.5, s * 0.09, s * 0.55, 0, 0, TAU);
      ctx.fill();
      dot(ctx, 0, -s * 0.95, 1.4, '#ffc0e0', 0.9);
      ctx.restore();
    }
    // 尾巴：一团小光
    glow(ctx, s * 0.85, -s * 0.7, s * 0.35, '#ffd8ec', 0.7, true);
    eyes(ctx, -s * 0.95, -s * 0.9, 0.01, s * 0.07, '#ffe0f0', -0.25);
    ctx.restore();
  };

  D.mushroom = function (ctx, s, t, o) {
    const step = Math.sin(t * 7 + (o.seed || 0));
    shadow(ctx, 0, 2, s * 0.8);
    const base = '#c8a890';
    // 根须一样的细腿
    for (const [lx, p] of [[-s * 0.2, 1], [s * 0.2, -1]]) {
      ctx.strokeStyle = deep(base, 0.6);
      ctx.lineWidth = s * 0.08;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lx * 0.5, -s * 0.5);
      ctx.quadraticCurveTo(lx + step * p * s * 0.15, -s * 0.25, lx + step * p * s * 0.25, -s * 0.02);
      ctx.stroke();
    }
    // 修长的菌柄
    ctx.fillStyle = bodyGrad(ctx, -s * 0.3, -s * 1.5, s * 0.3, -s * 0.4, base, 0.35, 0.7);
    ctx.beginPath();
    ctx.moveTo(-s * 0.22, -s * 0.45);
    ctx.quadraticCurveTo(-s * 0.3, -s * 1.0, -s * 0.18, -s * 1.45);
    ctx.lineTo(s * 0.18, -s * 1.45);
    ctx.quadraticCurveTo(s * 0.3, -s * 1.0, s * 0.22, -s * 0.45);
    ctx.closePath();
    ctx.fill();
    // 菌褶下透出的光和眼睛
    glow(ctx, 0, -s * 1.45, s * 0.8, '#ffd9a0', 0.5);
    eyes(ctx, -s * 0.12, -s * 1.25, s * 0.18, s * 0.06, '#fff0c0', -0.15);
    // 伞盖：宽、深红、边缘下垂
    const cap = '#d84a48';
    ctx.fillStyle = bodyGrad(ctx, -s * 1.1, -s * 2.3, s * 1.1, -s * 1.4, cap, 0.2, 0.68);
    ctx.beginPath();
    ctx.moveTo(-s * 1.1, -s * 1.35);
    ctx.bezierCurveTo(-s * 1.0, -s * 2.3, s * 1.0, -s * 2.3, s * 1.1, -s * 1.35);
    ctx.quadraticCurveTo(s * 0.5, -s * 1.5, 0, -s * 1.45);
    ctx.quadraticCurveTo(-s * 0.5, -s * 1.5, -s * 1.1, -s * 1.35);
    ctx.fill();
    // 伞盖上发光的斑点
    for (const [px, py, r] of [[-0.5, -1.85, 2], [0.15, -2.05, 2.4], [0.62, -1.7, 1.6], [-0.15, -1.68, 1.3]]) dot(ctx, s * px, s * py, r, '#ffe0a8', 0.95);
  };

  D.bee = function (ctx, s, t, o) {
    const bob = Math.sin(t * 7 + (o.seed || 0)) * 3;
    ctx.save();
    ctx.globalAlpha = 0.5;
    shadow(ctx, 0, 34, s * 0.7);
    ctx.restore();
    ctx.translate(0, bob - s * 0.4);
    const base = '#e0a020';
    // 透光的长翅膀
    const flap = Math.sin(t * 46);
    wing(ctx, s * 0.1, -s * 0.55, s * 1.1, s * 0.4, 0.5 + flap * 0.45, '#d8f0ff');
    wing(ctx, s * 0.3, -s * 0.5, s * 0.9, s * 0.35, 0.95 + flap * 0.4, '#d8f0ff');
    // 细长的腹部，发光的环纹
    ctx.fillStyle = bodyGrad(ctx, s * 0.1, -s * 0.6, s * 1.3, s * 0.1, base, 0.35, 0.75);
    ctx.beginPath();
    ctx.ellipse(s * 0.65, -s * 0.2, s * 0.62, s * 0.3, 0.35, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(s * 0.65, -s * 0.2, s * 0.62, s * 0.3, 0.35, 0, TAU);
    ctx.clip();
    for (let i = 0; i < 3; i++) {
      const bx = s * (0.42 + i * 0.25);
      rune(ctx, [[bx, -s * 0.65], [bx + s * 0.12, s * 0.2]], '#ffcf4a', s * 0.08, 0.75);
    }
    ctx.restore();
    // 尾刺
    ctx.fillStyle = deep(base, 0.8);
    ctx.beginPath();
    ctx.moveTo(s * 1.15, -s * 0.05);
    ctx.lineTo(s * 1.55, s * 0.12);
    ctx.lineTo(s * 1.12, s * 0.08);
    ctx.fill();
    // 胸部和头
    ctx.fillStyle = bodyGrad(ctx, -s * 0.5, -s * 0.8, s * 0.2, -s * 0.1, base, 0.45, 0.82);
    ctx.beginPath();
    ctx.ellipse(-s * 0.05, -s * 0.4, s * 0.32, s * 0.28, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-s * 0.45, -s * 0.5, s * 0.22, s * 0.2, 0, 0, TAU);
    ctx.fill();
    // 触角和垂下的细腿
    ctx.strokeStyle = deep(base, 0.8);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, -s * 0.65);
    ctx.quadraticCurveTo(-s * 0.75, -s * 1.0, -s * 0.95, -s * 0.95);
    for (let i = 0; i < 3; i++) {
      ctx.moveTo(-s * 0.1 + i * s * 0.12, -s * 0.18);
      ctx.lineTo(-s * 0.2 + i * s * 0.12, s * 0.15);
    }
    ctx.stroke();
    eyes(ctx, -s * 0.55, -s * 0.52, 0.01, s * 0.09, '#fff0a0', -0.3);
  };

  // 哥布林：瘦长的四肢、前倾的身体、长鼻子和往后竖起的长耳朵
  function goblin(ctx, s, t, o, base, shield) {
    const ph = t * 8 + (o.seed || 0);
    const step = Math.sin(ph);
    shadow(ctx, 0, 2, s * 0.8);
    const hipY = -s * 0.85;
    // 腿：大腿 + 小腿，弯着膝盖
    for (const [lx, p, far] of [[s * 0.12, 1, true], [-s * 0.1, -1, false]]) {
      const kx = lx + s * 0.15 + step * p * s * 0.12;
      const fx = lx + step * p * s * 0.25;
      ctx.strokeStyle = deep(base, far ? 0.82 : 0.6);
      ctx.lineWidth = s * 0.11;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(lx * 0.4, hipY);
      ctx.lineTo(kx, -s * 0.45);
      ctx.lineTo(fx, -s * 0.06);
      ctx.stroke();
      ctx.fillStyle = deep(base, 0.85);
      ctx.beginPath();
      ctx.ellipse(fx - s * 0.06, -s * 0.04, s * 0.11, s * 0.05, 0, 0, TAU);
      ctx.fill();
    }
    // 破旧的腰布
    ctx.fillStyle = deep('#7a5a3a', 0.55);
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, hipY - s * 0.12);
    ctx.lineTo(s * 0.22, hipY - s * 0.12);
    ctx.lineTo(s * 0.18, hipY + s * 0.18);
    ctx.lineTo(s * 0.02, hipY + s * 0.08);
    ctx.lineTo(-s * 0.12, hipY + s * 0.2);
    ctx.closePath();
    ctx.fill();
    // 前倾的身体
    ctx.fillStyle = bodyGrad(ctx, -s * 0.45, -s * 1.7, s * 0.4, hipY, base, 0.28, 0.7);
    ctx.beginPath();
    ctx.ellipse(-s * 0.02, -s * 1.2, s * 0.28, s * 0.42, -0.22, 0, TAU);
    ctx.fill();
    // 远侧手臂
    ctx.strokeStyle = deep(base, 0.82);
    ctx.lineWidth = s * 0.09;
    ctx.beginPath();
    ctx.moveTo(s * 0.05, -s * 1.45);
    ctx.quadraticCurveTo(s * 0.2, -s * 1.1, s * 0.05 + step * s * 0.1, -s * 0.85);
    ctx.stroke();
    // 头：往前探，长鼻子
    const hx = -s * 0.3;
    const hy = -s * 1.78;
    // 两只叶子形的大耳朵，往后上方张开（远处那只更暗）
    const ew = Math.sin(ph * 0.5) * 0.08;
    for (const [far, ang] of [[true, -0.55], [false, -0.25]]) {
      ctx.save();
      ctx.translate(hx + s * 0.12, hy - s * 0.08);
      ctx.rotate(ang + ew);
      ctx.fillStyle = far ? deep(base, 0.78) : bodyGrad(ctx, 0, -s * 0.2, s * 0.5, s * 0.1, base, 0.25, 0.62);
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.06);
      ctx.quadraticCurveTo(s * 0.3, -s * 0.2, s * 0.48, -s * 0.08);
      ctx.quadraticCurveTo(s * 0.3, s * 0.08, 0, s * 0.06);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = bodyGrad(ctx, hx - s * 0.3, hy - s * 0.3, hx + s * 0.3, hy + s * 0.25, base, 0.22, 0.62);
    ctx.beginPath();
    ctx.ellipse(hx, hy, s * 0.27, s * 0.25, -0.1, 0, TAU);
    ctx.fill();
    // 小鼻子
    ctx.beginPath();
    ctx.moveTo(hx - s * 0.22, hy - s * 0.0);
    ctx.quadraticCurveTo(hx - s * 0.38, hy + s * 0.06, hx - s * 0.32, hy + s * 0.12);
    ctx.quadraticCurveTo(hx - s * 0.24, hy + s * 0.12, hx - s * 0.16, hy + s * 0.1);
    ctx.fill();
    eyes(ctx, hx - s * 0.12, hy - s * 0.05, s * 0.12, s * 0.045, '#e8ff9a', -0.2);
    // 近侧手臂 + 盾牌 / 匕首
    ctx.strokeStyle = deep(base, 0.55);
    ctx.lineWidth = s * 0.1;
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, -s * 1.42);
    ctx.quadraticCurveTo(-s * 0.4, -s * 1.2, -s * 0.55, -s * 1.12);
    ctx.stroke();
    if (shield) {
      // 木盾：深色木头 + 发光的符文环（正面很硬）
      ctx.save();
      ctx.translate(-s * 0.68, -s * 1.0);
      ctx.fillStyle = bodyGrad(ctx, -s * 0.4, -s * 0.55, s * 0.4, s * 0.55, '#8a6a42', 0.35, 0.78);
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.3, s * 0.52, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = rgba('#d8ff8a', 0.55);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.19, s * 0.36, 0, 0, TAU);
      ctx.stroke();
      dot(ctx, 0, 0, 1.8, '#d8ff8a', 0.9);
      ctx.restore();
    } else {
      ctx.strokeStyle = 'rgba(220,240,255,0.85)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-s * 0.55, -s * 1.12);
      ctx.lineTo(-s * 0.95, -s * 1.3);
      ctx.stroke();
      glow(ctx, -s * 0.95, -s * 1.3, s * 0.2, '#dff0ff', 0.5);
    }
  }
  D.goblin = (ctx, s, t, o) => goblin(ctx, s, t, o, '#5a8a48', true);
  D.gobling = (ctx, s, t, o) => goblin(ctx, s, t, o, '#6a9a58', false);

  D.boarKing = function (ctx, s, t, o) {
    const ai = o.ai || {};
    const angry = ai.mode === 'warn' || ai.mode === 'charge';
    const run = ai.mode === 'charge' ? 2.6 : ai.mode === 'hold' ? 0.25 : 0.9;
    const ph = t * 8 * run + (o.seed || 0);
    shadow(ctx, 0, 2, s * 1.4);
    ctx.save();
    if (ai.mode === 'warn') ctx.translate(Math.sin(t * 50) * 2, 0);
    const base = '#9a6440';
    const by = -s * 0.75 - Math.abs(Math.sin(ph)) * s * 0.05;
    // 四条腿：粗壮、末端是蹄子
    for (const [lx, p, far] of [[-s * 0.75, 0, true], [s * 0.75, Math.PI, true], [-s * 0.55, Math.PI, false], [s * 0.95, 0, false]]) {
      const sw = Math.sin(ph + p) * s * 0.22 * Math.min(1, run);
      ctx.strokeStyle = deep(base, far ? 0.85 : 0.68);
      ctx.lineCap = 'round';
      ctx.lineWidth = s * 0.2;
      ctx.beginPath();
      ctx.moveTo(lx, by + s * 0.1);
      ctx.quadraticCurveTo(lx + sw * 0.5, by + s * 0.45, lx + sw, -s * 0.1);
      ctx.stroke();
      ctx.fillStyle = '#120c0a';
      ctx.beginPath();
      ctx.ellipse(lx + sw - s * 0.03, -s * 0.06, s * 0.11, s * 0.07, 0, 0, TAU);
      ctx.fill();
    }
    // 身体：前高后低的驼峰，长鼻子低垂
    ctx.fillStyle = bodyGrad(ctx, -s * 1.7, by - s * 0.8, s * 1.3, by + s * 0.5, base, 0.22, 0.74);
    ctx.beginPath();
    ctx.moveTo(s * 1.15, by + s * 0.25);
    ctx.quadraticCurveTo(s * 1.3, by - s * 0.3, s * 0.8, by - s * 0.55);
    ctx.quadraticCurveTo(0, by - s * 0.95, -s * 0.6, by - s * 0.78);
    ctx.quadraticCurveTo(-s * 1.05, by - s * 0.62, -s * 1.3, by - s * 0.2);
    ctx.quadraticCurveTo(-s * 1.55, by + s * 0.05, -s * 1.72, by + s * 0.18);
    ctx.quadraticCurveTo(-s * 1.65, by + s * 0.38, -s * 1.3, by + s * 0.32);
    ctx.quadraticCurveTo(-s * 0.9, by + s * 0.45, -s * 0.5, by + s * 0.42);
    ctx.quadraticCurveTo(s * 0.4, by + s * 0.55, s * 1.15, by + s * 0.25);
    ctx.fill();
    // 背上的鬃毛：深色的硬毛，毛尖受光
    for (let i = 0; i < 9; i++) {
      const k = i / 8;
      const mx = -s * 0.85 + k * s * 1.6;
      const my = by - s * (0.72 + Math.sin(k * Math.PI) * 0.18);
      const mh = s * (0.22 + Math.sin(k * Math.PI) * 0.18) * (angry ? 1.3 : 1);
      ctx.strokeStyle = deep(base, 0.85);
      ctx.lineWidth = s * 0.07;
      ctx.beginPath();
      ctx.moveTo(mx, my + s * 0.08);
      ctx.lineTo(mx + s * 0.12, my - mh);
      ctx.stroke();
      ctx.strokeStyle = rgba('#ffcf8a', 0.45);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mx + s * 0.08, my - mh * 0.6);
      ctx.lineTo(mx + s * 0.12, my - mh);
      ctx.stroke();
    }
    // 皮毛上几道受光的笔触
    rune(ctx, [[s * 0.2, by - s * 0.55], [s * 0.6, by - s * 0.45], [s * 0.95, by - s * 0.2]], '#ffcf8a', 1.2, 0.25);
    // 耳朵
    ctx.fillStyle = deep(base, 0.6);
    ctx.beginPath();
    ctx.moveTo(-s * 0.95, by - s * 0.6);
    ctx.lineTo(-s * 0.75, by - s * 0.95);
    ctx.lineTo(-s * 0.7, by - s * 0.6);
    ctx.fill();
    // 发光的獠牙
    ctx.strokeStyle = 'rgba(255,248,225,0.95)';
    ctx.lineWidth = s * 0.07;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 1.45, by + s * 0.25);
    ctx.quadraticCurveTo(-s * 1.72, by + s * 0.2, -s * 1.7, by - s * 0.12);
    ctx.stroke();
    glow(ctx, -s * 1.68, by - s * 0.05, s * 0.35, '#fff0d0', 0.4);
    eyes(ctx, -s * 1.12, by - s * 0.32, 0.01, s * 0.09, angry ? '#ff7a3a' : '#ffd890', -0.25);
    if (angry) glow(ctx, -s * 1.12, by - s * 0.32, s * 0.6, '#ff5a2a', 0.45);
    // 骑手：哥布林国王
    ctx.save();
    ctx.translate(-s * 0.1, by - s * 0.82);
    const kb = '#5a8a48';
    // 斗篷
    ctx.fillStyle = bodyGrad(ctx, -s * 0.35, -s * 0.9, s * 0.4, 0, '#a83a3a', 0.25, 0.72);
    ctx.beginPath();
    ctx.moveTo(-s * 0.25, 0);
    ctx.quadraticCurveTo(-s * 0.32, -s * 0.55, -s * 0.08, -s * 0.78);
    ctx.quadraticCurveTo(s * 0.3, -s * 0.6, s * 0.55 + Math.sin(t * 3) * s * 0.05, s * 0.05);
    ctx.closePath();
    ctx.fill();
    // 头和往后耷拉的长耳朵
    ctx.fillStyle = bodyGrad(ctx, -s * 0.5, -s * 1.15, 0, -s * 0.65, kb, 0.25, 0.65);
    ctx.beginPath();
    ctx.ellipse(-s * 0.15, -s * 0.92, s * 0.22, s * 0.19, -0.2, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 0.02, -s * 0.98);
    ctx.quadraticCurveTo(s * 0.35, -s * 1.05, s * 0.55, -s * 0.88);
    ctx.quadraticCurveTo(s * 0.25, -s * 0.9, -s * 0.0, -s * 0.84);
    ctx.fill();
    eyes(ctx, -s * 0.25, -s * 0.94, s * 0.12, s * 0.05, '#e8ff9a', -0.25);
    // 发光的王冠
    glow(ctx, -s * 0.12, -s * 1.2, s * 0.45, '#ffd27a', 0.6);
    ctx.fillStyle = '#ffd96a';
    ctx.beginPath();
    ctx.moveTo(-s * 0.32, -s * 1.08);
    for (let i = 0; i <= 4; i++) ctx.lineTo(-s * 0.32 + i * s * 0.1, -s * (i % 2 ? 1.16 : 1.32));
    ctx.lineTo(s * 0.08, -s * 1.08);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
  };
})((globalThis.TD = globalThis.TD || {}));
