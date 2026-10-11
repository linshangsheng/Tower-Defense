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

  // ======================================================================
  // 第二章 · 黄金沙漠（设计书 56.4）
  // ======================================================================

  // 蝎子：低伏的分节身体、往上卷的尾巴、发光的毒针
  function scorpionBody(ctx, s, t, o, base, glowCol, big) {
    const ph = t * (big ? 6 : 12) + (o.seed || 0);
    const by = -s * 0.32;
    // 腿：每侧 3 条细腿，交替摆动
    for (let i = 0; i < 3; i++) {
      for (const far of [true, false]) {
        const lx = -s * 0.3 + i * s * 0.32;
        const sw = Math.sin(ph + i * 2 + (far ? Math.PI : 0)) * s * 0.08;
        ctx.strokeStyle = deep(base, far ? 0.85 : 0.65);
        ctx.lineWidth = s * 0.06;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(lx, by);
        ctx.lineTo(lx + sw - s * 0.08, by - s * 0.2);
        ctx.lineTo(lx + sw - s * 0.18, -s * 0.02);
        ctx.stroke();
      }
    }
    // 分节的身体
    for (let i = 0; i < 4; i++) {
      const sx = -s * 0.35 + i * s * 0.28;
      ctx.fillStyle = bodyGrad(ctx, sx - s * 0.25, by - s * 0.25, sx + s * 0.25, by + s * 0.2, base, 0.3, 0.75);
      ctx.beginPath();
      ctx.ellipse(sx, by - s * 0.05, s * 0.26 - i * s * 0.02, s * 0.2, 0, 0, TAU);
      ctx.fill();
    }
    // 尾巴：一节节往上卷到头顶前方
    const curl = Math.sin(ph * 0.4) * 0.15 + (o.attack ? 0.3 : 0);
    let tx = s * 0.55;
    let ty = by - s * 0.05;
    let ang = -0.4;
    for (let i = 0; i < 6; i++) {
      ang -= 0.42 + curl * 0.15;
      tx += Math.cos(ang) * s * 0.2;
      ty += Math.sin(ang) * s * 0.2;
      ctx.fillStyle = deep(base, 0.4 + i * 0.05);
      ctx.beginPath();
      ctx.arc(tx, ty, s * (0.13 - i * 0.012), 0, TAU);
      ctx.fill();
    }
    // 毒针
    glow(ctx, tx - s * 0.08, ty + s * 0.05, s * 0.45, glowCol, 0.7 + Math.sin(t * 5) * 0.2, true);
    ctx.fillStyle = light(glowCol, 0.4);
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx - s * 0.18, ty + s * 0.02, tx - s * 0.2, ty + s * 0.18);
    ctx.quadraticCurveTo(tx - s * 0.05, ty + s * 0.12, tx + s * 0.05, ty + s * 0.06);
    ctx.fill();
    // 一对钳子
    const snap = o.attack ? Math.abs(Math.sin(t * 6)) * 0.4 : 0.12;
    for (const far of [true, false]) {
      ctx.save();
      ctx.translate(-s * 0.55, by + (far ? -s * 0.08 : s * 0.02));
      ctx.fillStyle = deep(base, far ? 0.8 : 0.45);
      ctx.beginPath();
      ctx.ellipse(-s * 0.18, 0, s * 0.22, s * 0.1, 0.1, 0, TAU);
      ctx.fill();
      ctx.translate(-s * 0.38, 0);
      ctx.rotate(-snap);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-s * 0.28, -s * 0.12, -s * 0.34, s * 0.02);
      ctx.quadraticCurveTo(-s * 0.18, -s * 0.02, 0, s * 0.06);
      ctx.fill();
      ctx.rotate(snap * 2);
      ctx.beginPath();
      ctx.moveTo(0, s * 0.02);
      ctx.quadraticCurveTo(-s * 0.24, s * 0.14, -s * 0.3, s * 0.06);
      ctx.quadraticCurveTo(-s * 0.15, s * 0.06, 0, s * 0.06);
      ctx.fill();
      ctx.restore();
    }
    eyes(ctx, -s * 0.5, by - s * 0.15, s * 0.1, s * 0.04, glowCol, -0.1);
    return { by };
  }
  D.scorpion = function (ctx, s, t, o) {
    shadow(ctx, 0, 2, s);
    scorpionBody(ctx, s, t, o, '#c88a4a', '#ffc04a');
  };

  D.kingScorpion = function (ctx, s, t, o) {
    const ai = o.ai || {};
    shadow(ctx, 0, 2, s * 1.2);
    const { by } = scorpionBody(ctx, s, t, Object.assign({}, o, { attack: o.attack || ai.mode === 'claw' }), '#c86a2a', '#ffb040', true);
    // 背上发光的纹路和头冠
    rune(ctx, [[-s * 0.3, by - s * 0.2], [0, by - s * 0.24], [s * 0.3, by - s * 0.2]], '#ffd27a', 1.6, 0.7);
    glow(ctx, -s * 0.45, by - s * 0.32, s * 0.3, '#ffd27a', 0.6);
    ctx.fillStyle = '#ffd96a';
    ctx.beginPath();
    ctx.moveTo(-s * 0.6, by - s * 0.22);
    ctx.lineTo(-s * 0.55, by - s * 0.42);
    ctx.lineTo(-s * 0.47, by - s * 0.3);
    ctx.lineTo(-s * 0.4, by - s * 0.46);
    ctx.lineTo(-s * 0.33, by - s * 0.24);
    ctx.closePath();
    ctx.fill();
  };

  // 绷带球：缠满绷带的圆滚滚的灵，绷带缝里透出光，松掉的绷带在身后飘
  D.mummy = function (ctx, s, t, o) {
    const roll = Math.sin(t * 4 + (o.seed || 0)) * 0.08;
    shadow(ctx, 0, 2, s * 0.9);
    const base = '#d8c090';
    const cy = -s * 0.9;
    // 身后飘的绷带
    for (let i = 0; i < 3; i++) {
      const w2 = Math.sin(t * 4 + i * 1.7) * s * 0.12;
      ctx.strokeStyle = rgba('#e8dcc0', 0.55 - i * 0.12);
      ctx.lineWidth = s * 0.1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s * 0.6, cy - s * 0.2 + i * s * 0.25);
      ctx.quadraticCurveTo(s * 1.0, cy - s * 0.1 + i * s * 0.25 + w2, s * 1.35, cy + i * s * 0.3 - w2);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(0, cy);
    ctx.rotate(roll);
    ctx.fillStyle = bodyGrad(ctx, -s * 0.85, -s * 0.85, s * 0.85, s * 0.85, base, 0.15, 0.6);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.85, s * 0.82, 0, 0, TAU);
    ctx.fill();
    // 一道道斜缠的绷带（亮暗交替）
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.85, s * 0.82, 0, 0, TAU);
    ctx.clip();
    for (let i = -4; i <= 4; i++) {
      ctx.strokeStyle = i % 2 ? deep(base, 0.55) : rgba('#f0e6cc', 0.4);
      ctx.lineWidth = s * 0.14;
      ctx.beginPath();
      ctx.moveTo(-s, i * s * 0.22 - s * 0.3);
      ctx.lineTo(s, i * s * 0.22 + s * 0.3);
      ctx.stroke();
    }
    ctx.restore();
    // 绷带缝里的一双眼睛
    ctx.fillStyle = '#06080c';
    ctx.beginPath();
    ctx.ellipse(-s * 0.3, -s * 0.15, s * 0.32, s * 0.1, -0.15, 0, TAU);
    ctx.fill();
    eyes(ctx, -s * 0.32, -s * 0.15, s * 0.22, s * 0.05, '#7affd8', -0.15);
    ctx.restore();
  };

  // 仙人掌球：带刺的球在地上滚，顶上一朵发光的花，体内的火光一闪一闪（快爆了）
  D.cactus = function (ctx, s, t, o) {
    const spin = -t * 4 - (o.seed || 0);
    shadow(ctx, 0, 2, s * 0.8);
    const base = '#4a9a50';
    const cy = -s * 0.8;
    ctx.save();
    ctx.translate(0, cy);
    ctx.rotate(spin);
    ctx.fillStyle = bodyGrad(ctx, -s * 0.8, -s * 0.8, s * 0.8, s * 0.8, base, 0.3, 0.75);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.75, 0, TAU);
    ctx.fill();
    // 棱和刺
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      ctx.strokeStyle = deep(base, 0.82);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * s * 0.72, Math.sin(a) * s * 0.72);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,200,0.75)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * s * 0.7, Math.sin(a) * s * 0.7);
      ctx.lineTo(Math.cos(a + 0.12) * s * 0.98, Math.sin(a + 0.12) * s * 0.98);
      ctx.stroke();
    }
    ctx.restore();
    // 体内的火光（爆炸前的警告）
    const pulse = 0.4 + Math.max(0, Math.sin(t * 7)) * 0.5;
    glow(ctx, 0, cy, s * 0.7, '#ff7a3a', pulse);
    // 顶上的花
    glow(ctx, s * 0.05, cy - s * 0.8, s * 0.35, '#ffb0d0', 0.8);
    ctx.fillStyle = '#ffc0dc';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + t;
      ctx.beginPath();
      ctx.ellipse(s * 0.05 + Math.cos(a) * s * 0.12, cy - s * 0.8 + Math.sin(a) * s * 0.12, s * 0.09, s * 0.05, a, 0, TAU);
      ctx.fill();
    }
    eyes(ctx, -s * 0.3, cy - s * 0.1, s * 0.24, s * 0.05, '#fff0a0', -0.15);
  };

  // 秃鹫：两只长翅膀向上张开滑翔，翅尖的飞羽一根根分开
  D.vulture = function (ctx, s, t, o) {
    const flap = Math.sin(t * 5 + (o.seed || 0));
    ctx.save();
    ctx.globalAlpha = 0.5;
    shadow(ctx, 0, 34, s * 0.9);
    ctx.restore();
    ctx.translate(0, -s * 0.5 + flap * 2);
    const base = '#8a6a50';
    const wingUp = (k, lift, col) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-s * 0.15, -s * 0.05);
      const tipX = s * 0.55 * k;
      const tipY = -s * (1.2 + lift * 0.4) * k;
      ctx.quadraticCurveTo(-s * 0.2, -s * 0.7 * k, tipX - s * 0.25, tipY);
      // 分开的飞羽
      for (let i = 0; i < 5; i++) {
        const fx = tipX - s * 0.2 + i * s * 0.14 * k;
        const fy = tipY + i * s * 0.12 * k;
        ctx.lineTo(fx + s * 0.12, fy - s * 0.05);
        ctx.lineTo(fx + s * 0.06, fy + s * 0.08);
      }
      ctx.quadraticCurveTo(s * 0.5 * k, -s * 0.2, s * 0.3, s * 0.02);
      ctx.closePath();
      ctx.fill();
    };
    wingUp(0.85, flap, deep(base, 0.85));
    // 身体与尾羽
    ctx.fillStyle = bodyGrad(ctx, -s * 0.7, -s * 0.4, s * 0.8, s * 0.3, base, 0.3, 0.75);
    ctx.beginPath();
    ctx.ellipse(s * 0.05, 0, s * 0.55, s * 0.24, -0.1, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * 0.5, -s * 0.05);
    ctx.lineTo(s * 0.95, -s * 0.12);
    ctx.lineTo(s * 0.9, s * 0.12);
    ctx.closePath();
    ctx.fill();
    // 秃头、长脖子、弯钩嘴
    ctx.strokeStyle = deep('#c89a80', 0.45);
    ctx.lineWidth = s * 0.12;
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, -s * 0.05);
    ctx.quadraticCurveTo(-s * 0.55, -s * 0.25, -s * 0.62, -s * 0.2);
    ctx.stroke();
    ctx.fillStyle = deep('#c89a80', 0.3);
    ctx.beginPath();
    ctx.ellipse(-s * 0.66, -s * 0.22, s * 0.15, s * 0.12, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e8d8b0';
    ctx.beginPath();
    ctx.moveTo(-s * 0.78, -s * 0.24);
    ctx.quadraticCurveTo(-s * 0.98, -s * 0.2, -s * 0.93, -s * 0.06);
    ctx.lineTo(-s * 0.78, -s * 0.13);
    ctx.fill();
    // 近侧翅膀
    wingUp(1, flap * 0.8 + 0.1, bodyGrad(ctx, -s * 0.2, -s * 1.6, s * 0.9, 0, base, 0.25, 0.7));
    eyes(ctx, -s * 0.7, -s * 0.25, 0.01, s * 0.05, '#ffcf6a', -0.2);
  };

  // 小祭司：兜帽长袍，手持发光的权杖，治疗时周围一圈光
  D.priest = function (ctx, s, t, o) {
    const sway = Math.sin(t * 3 + (o.seed || 0)) * 0.05;
    shadow(ctx, 0, 2, s * 0.7);
    const base = '#7a5ab8';
    ctx.save();
    ctx.rotate(sway);
    // 长袍：下摆拖地、微微飘动
    const hem = Math.sin(t * 4) * s * 0.06;
    ctx.fillStyle = bodyGrad(ctx, -s * 0.6, -s * 2.0, s * 0.6, 0, base, 0.3, 0.75);
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, -s * 1.75);
    ctx.quadraticCurveTo(-s * 0.55, -s * 0.8, -s * 0.6 + hem, 0);
    ctx.quadraticCurveTo(0, s * 0.06, s * 0.62 - hem, 0);
    ctx.quadraticCurveTo(s * 0.5, -s * 0.8, s * 0.22, -s * 1.75);
    ctx.closePath();
    ctx.fill();
    // 袍子上发光的花纹
    rune(ctx, [[-s * 0.3, -s * 0.3], [0, -s * 0.5], [s * 0.3, -s * 0.3]], '#ffd27a', 1.4, 0.6);
    rune(ctx, [[0, -s * 0.5], [0, -s * 1.2]], '#ffd27a', 1.2, 0.45);
    // 兜帽和藏在阴影里的脸
    ctx.fillStyle = bodyGrad(ctx, -s * 0.4, -s * 2.4, s * 0.4, -s * 1.6, base, 0.25, 0.7);
    ctx.beginPath();
    ctx.moveTo(-s * 0.38, -s * 1.6);
    ctx.quadraticCurveTo(-s * 0.42, -s * 2.3, s * 0.1, -s * 2.38);
    ctx.quadraticCurveTo(s * 0.4, -s * 2.1, s * 0.34, -s * 1.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#08060e';
    ctx.beginPath();
    ctx.ellipse(-s * 0.08, -s * 1.85, s * 0.2, s * 0.22, 0, 0, TAU);
    ctx.fill();
    eyes(ctx, -s * 0.12, -s * 1.88, s * 0.14, s * 0.04, '#bfffd8', -0.1);
    ctx.restore();
    // 权杖
    ctx.strokeStyle = deep('#c8a060', 0.4);
    ctx.lineWidth = s * 0.07;
    ctx.beginPath();
    ctx.moveTo(-s * 0.6, -s * 0.1);
    ctx.lineTo(-s * 0.7, -s * 2.0);
    ctx.stroke();
    const pulse = 0.6 + Math.sin(t * 4) * 0.3;
    glow(ctx, -s * 0.7, -s * 2.1, s * 0.55, '#a8ffcf', pulse, true);
    ctx.strokeStyle = 'rgba(220,255,230,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(-s * 0.7, -s * 2.18, s * 0.1, 0, TAU);
    ctx.moveTo(-s * 0.7, -s * 2.08);
    ctx.lineTo(-s * 0.7, -s * 1.92);
    ctx.stroke();
  };

  // 胖法老：圆滚滚的长袍、发光的金色头巾、手里的权杖；残血时展开金字塔护盾
  D.pharaoh = function (ctx, s, t, o) {
    const ai = o.ai || {};
    shadow(ctx, 0, 2, s * 1.2);
    const base = '#d8b850';
    const bob = Math.sin(t * 2) * s * 0.03;
    ctx.save();
    ctx.translate(0, bob);
    // 圆滚滚的身体（长袍）
    ctx.fillStyle = bodyGrad(ctx, -s, -s * 1.8, s, 0, '#f0d8a0', 0.12, 0.58);
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, -s * 0.05);
    ctx.bezierCurveTo(-s * 1.15, -s * 0.5, -s * 0.95, -s * 1.6, -s * 0.2, -s * 1.65);
    ctx.bezierCurveTo(s * 0.7, -s * 1.65, s * 1.1, -s * 0.5, s * 0.55, -s * 0.05);
    ctx.closePath();
    ctx.fill();
    // 发光的金色项圈
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = rgba('#ffd27a', 0.5 - i * 0.12);
      ctx.lineWidth = s * 0.05;
      ctx.beginPath();
      ctx.arc(-s * 0.1, -s * 1.55, s * (0.45 + i * 0.1), 0.3, Math.PI - 0.3);
      ctx.stroke();
    }
    ctx.restore();
    // 头和条纹头巾
    const hx = -s * 0.15;
    const hy = -s * 1.95;
    ctx.fillStyle = bodyGrad(ctx, hx - s * 0.6, hy - s * 0.5, hx + s * 0.6, hy + s * 0.6, base, 0.2, 0.65);
    ctx.beginPath();
    ctx.moveTo(hx - s * 0.5, hy + s * 0.45);
    ctx.quadraticCurveTo(hx - s * 0.55, hy - s * 0.45, hx, hy - s * 0.5);
    ctx.quadraticCurveTo(hx + s * 0.55, hy - s * 0.45, hx + s * 0.5, hy + s * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = rgba('#5a8aff', 0.35);
      ctx.lineWidth = s * 0.06;
      ctx.beginPath();
      ctx.moveTo(hx - s * 0.6, hy - s * 0.3 + i * s * 0.18);
      ctx.lineTo(hx + s * 0.6, hy - s * 0.3 + i * s * 0.18);
      ctx.stroke();
    }
    ctx.restore();
    // 金色的面具，眼睛发光
    const mg = ctx.createLinearGradient(hx + s * 0.25, hy - s * 0.2, hx - s * 0.25, hy + s * 0.35);
    mg.addColorStop(0, '#ffe69a');
    mg.addColorStop(1, '#9a6a1a');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.moveTo(hx - s * 0.26, hy - s * 0.15);
    ctx.quadraticCurveTo(hx, hy - s * 0.25, hx + s * 0.22, hy - s * 0.15);
    ctx.quadraticCurveTo(hx + s * 0.25, hy + s * 0.2, hx - s * 0.02, hy + s * 0.32);
    ctx.quadraticCurveTo(hx - s * 0.3, hy + s * 0.2, hx - s * 0.26, hy - s * 0.15);
    ctx.fill();
    ctx.fillStyle = '#1a1020';
    ctx.fillRect(hx - s * 0.04, hy + s * 0.25, s * 0.08, s * 0.2);
    eyes(ctx, hx - s * 0.05, hy - s * 0.02, s * 0.2, s * 0.055, '#7ae0ff', -0.05);
    // 权杖
    ctx.strokeStyle = deep('#ffd27a', 0.3);
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.moveTo(-s * 0.9, -s * 0.2);
    ctx.lineTo(-s * 1.0, -s * 1.9);
    ctx.stroke();
    glow(ctx, -s * 1.0, -s * 2.0, s * 0.4, '#ffd27a', 0.8, true);
    ctx.restore();
    // 金字塔护盾（第三阶段，设计书 19.3）
    if (ai.phase === 3 && o.shield > 0) {
      const g = ctx.createLinearGradient(0, -s * 2.8, 0, 0);
      g.addColorStop(0, 'rgba(255,230,140,0.4)');
      g.addColorStop(1, 'rgba(255,200,90,0.12)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-s * 1.4, 0);
      ctx.lineTo(0, -s * 2.9);
      ctx.lineTo(s * 1.4, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,240,180,0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  };

  // ======================================================================
  // 第三章 · 迷雾沼泽（设计书 56.4）
  // ======================================================================

  // 小幽灵：半透明的光雾，尾巴渐隐
  D.ghost = function (ctx, s, t, o) {
    const ph = t * 3 + (o.seed || 0);
    const fl = Math.sin(ph) * s * 0.12;
    ctx.save();
    ctx.translate(0, -s * 1.0 + fl);
    const g = ctx.createRadialGradient(-s * 0.1, -s * 0.2, s * 0.1, 0, 0, s * 1.1);
    g.addColorStop(0, 'rgba(235,245,255,0.95)');
    g.addColorStop(0.5, 'rgba(160,200,255,0.55)');
    g.addColorStop(1, 'rgba(120,150,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, -s * 0.1);
    ctx.bezierCurveTo(-s * 0.6, -s * 0.85, s * 0.45, -s * 0.9, s * 0.5, -s * 0.15);
    // 往后飘的尾巴
    const tw = Math.sin(ph * 1.6) * s * 0.15;
    ctx.bezierCurveTo(s * 0.6, s * 0.3, s * 1.0, s * 0.35 + tw, s * 1.35, s * 0.2 - tw);
    ctx.bezierCurveTo(s * 0.9, s * 0.65 + tw, s * 0.2, s * 0.6, -s * 0.55, -s * 0.1);
    ctx.fill();
    glow(ctx, 0, -s * 0.25, s * 0.8, '#cfe4ff', 0.45);
    // 深色的眼窝 + 一点光
    for (const dx of [-0.28, -0.02]) {
      ctx.fillStyle = 'rgba(20,24,60,0.75)';
      ctx.beginPath();
      ctx.ellipse(s * dx, -s * 0.32, s * 0.08, s * 0.12, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  };

  // 毒蛙：修长的后腿、发光的毒斑；吐毒时喉囊鼓起发光
  D.frog = function (ctx, s, t, o) {
    const ph = t * 2 + (o.seed || 0);
    shadow(ctx, 0, 2, s * 0.9);
    const base = '#6a4ab0';
    const puff = o.attack ? 0.5 + Math.max(0, Math.sin(t * 5)) * 0.5 : 0;
    // 后腿（折起来）
    ctx.fillStyle = deep(base, 0.7);
    ctx.beginPath();
    ctx.ellipse(s * 0.45, -s * 0.3, s * 0.45, s * 0.22, -0.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = deep(base, 0.75);
    ctx.lineWidth = s * 0.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.7, -s * 0.15);
    ctx.lineTo(s * 0.35, -s * 0.03);
    ctx.lineTo(s * 0.7, -s * 0.03);
    ctx.stroke();
    // 身体：前高后低地坐着
    ctx.fillStyle = bodyGrad(ctx, -s * 0.7, -s * 1.2, s * 0.7, 0, base, 0.25, 0.72);
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, -s * 0.85);
    ctx.quadraticCurveTo(-s * 0.15, -s * 1.15, s * 0.5, -s * 0.6);
    ctx.quadraticCurveTo(s * 0.55, -s * 0.15, s * 0.1, -s * 0.15);
    ctx.quadraticCurveTo(-s * 0.4, -s * 0.2, -s * 0.55, -s * 0.85);
    ctx.fill();
    // 喉囊
    if (puff > 0) {
      glow(ctx, -s * 0.4, -s * 0.45, s * 0.5 * (0.6 + puff), '#c8ff8a', 0.6 * puff);
      ctx.fillStyle = rgba('#c8ff8a', 0.5 * puff);
      ctx.beginPath();
      ctx.ellipse(-s * 0.4, -s * 0.48, s * 0.22 * (0.6 + puff), s * 0.18 * (0.6 + puff), 0, 0, TAU);
      ctx.fill();
    }
    // 前腿
    ctx.strokeStyle = deep(base, 0.55);
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, -s * 0.4);
    ctx.lineTo(-s * 0.45, -s * 0.02);
    ctx.stroke();
    // 发光的毒斑
    for (const [px, py, r] of [[-0.05, -0.85, 1.6], [0.25, -0.72, 1.3], [0.05, -0.55, 1.1], [0.35, -0.45, 1.2]]) dot(ctx, s * px, s * py, r, '#c8ff8a', 0.6 + Math.sin(ph + px * 9) * 0.3);
    // 鼓鼓的大眼睛
    ctx.fillStyle = deep(base, 0.4);
    ctx.beginPath();
    ctx.arc(-s * 0.4, -s * 0.92, s * 0.16, 0, TAU);
    ctx.fill();
    eyes(ctx, -s * 0.43, -s * 0.94, 0.01, s * 0.07, '#ffe07a', 0);
  };

  // 树桩怪：根须当脚、树皮的纹理、裂缝里透出琥珀色的光（回血时变绿）
  D.stump = function (ctx, s, t, o) {
    const step = Math.sin(t * 5 + (o.seed || 0));
    shadow(ctx, 0, 2, s);
    const base = '#7a5a3a';
    const sap = o.regen ? '#9aff8a' : '#ffb04a';
    // 根须脚
    for (let i = 0; i < 4; i++) {
      const rx = -s * 0.55 + i * s * 0.36;
      const sw = Math.sin(t * 5 + i * 1.5) * s * 0.06 * (i % 2 ? 1 : -1) * Math.abs(step);
      ctx.strokeStyle = deep(base, 0.7);
      ctx.lineWidth = s * 0.12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(rx * 0.7, -s * 0.35);
      ctx.quadraticCurveTo(rx + sw, -s * 0.15, rx * 1.2 + sw, -s * 0.02);
      ctx.stroke();
    }
    // 树干
    ctx.fillStyle = bodyGrad(ctx, -s * 0.7, -s * 1.6, s * 0.7, -s * 0.2, base, 0.3, 0.75);
    ctx.beginPath();
    ctx.moveTo(-s * 0.65, -s * 0.3);
    ctx.quadraticCurveTo(-s * 0.7, -s * 1.0, -s * 0.55, -s * 1.45);
    ctx.lineTo(s * 0.55, -s * 1.45);
    ctx.quadraticCurveTo(s * 0.7, -s * 1.0, s * 0.65, -s * 0.3);
    ctx.closePath();
    ctx.fill();
    // 年轮切面
    ctx.fillStyle = deep('#c8a070', 0.4);
    ctx.beginPath();
    ctx.ellipse(0, -s * 1.45, s * 0.55, s * 0.15, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = deep('#c8a070', 0.6);
    ctx.lineWidth = 1;
    for (const r of [0.38, 0.22]) {
      ctx.beginPath();
      ctx.ellipse(0, -s * 1.45, s * r, s * r * 0.27, 0, 0, TAU);
      ctx.stroke();
    }
    // 切面上的一株小芽和苔藓
    ctx.strokeStyle = '#4a8a3a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(s * 0.2, -s * 1.45);
    ctx.quadraticCurveTo(s * 0.25, -s * 1.7, s * 0.4, -s * 1.75);
    ctx.stroke();
    // 树皮纹理
    ctx.strokeStyle = deep(base, 0.82);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.45 + i * s * 0.3, -s * 1.35);
      ctx.quadraticCurveTo(-s * 0.4 + i * s * 0.3, -s * 0.9, -s * 0.5 + i * s * 0.32, -s * 0.4);
      ctx.stroke();
    }
    // 裂缝里的光
    rune(ctx, [[s * 0.15, -s * 1.2], [s * 0.05, -s * 0.95], [s * 0.2, -s * 0.7]], sap, 2, 0.8);
    // 树洞一样的眼睛
    ctx.fillStyle = '#0a0606';
    for (const dx of [-0.35, -0.08]) {
      ctx.beginPath();
      ctx.ellipse(s * dx, -s * 1.0, s * 0.1, s * 0.13, 0, 0, TAU);
      ctx.fill();
    }
    eyes(ctx, -s * 0.22, -s * 1.0, s * 0.27, s * 0.045, sap, 0);
  };

  // 蝙蝠：薄膜翅膀，翅膀的骨架清楚
  D.bat = function (ctx, s, t, o) {
    const flap = Math.sin(t * 16 + (o.seed || 0));
    ctx.save();
    ctx.globalAlpha = 0.5;
    shadow(ctx, 0, 34, s * 0.7);
    ctx.restore();
    ctx.translate(0, -s * 0.6);
    const base = '#6a4a98';
    for (const [dir, far] of [[1, true], [-1, false]]) {
      const lift = flap * s * 0.7;
      ctx.fillStyle = far ? deep(base, 0.85) : bodyGrad(ctx, -s * 1.3, -s, s * 1.3, s * 0.3, base, 0.35, 0.75);
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.05);
      ctx.quadraticCurveTo(dir * s * 0.6, -s * 0.5 - lift, dir * s * 1.35, -s * 0.2 - lift);
      ctx.quadraticCurveTo(dir * s * 1.1, 0, dir * s * 0.95, s * 0.05 - lift * 0.3);
      ctx.quadraticCurveTo(dir * s * 0.75, -s * 0.05, dir * s * 0.55, s * 0.12 - lift * 0.2);
      ctx.quadraticCurveTo(dir * s * 0.35, s * 0.02, 0, s * 0.15);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = bodyGrad(ctx, -s * 0.3, -s * 0.4, s * 0.3, s * 0.3, base, 0.3, 0.7);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.25, s * 0.3, 0, 0, TAU);
    ctx.fill();
    // 尖耳
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, -s * 0.2);
    ctx.lineTo(-s * 0.18, -s * 0.5);
    ctx.lineTo(-s * 0.05, -s * 0.25);
    ctx.lineTo(s * 0.08, -s * 0.48);
    ctx.lineTo(s * 0.15, -s * 0.2);
    ctx.fill();
    eyes(ctx, -s * 0.08, -s * 0.08, s * 0.16, s * 0.05, '#ff9ae0', -0.1);
  };

  // 南瓜头：雕刻的南瓜脸，里面点着火；藤蔓当腿
  function pumpkinBody(ctx, s, t, o, small) {
    const hop = Math.abs(Math.sin(t * (small ? 14 : 8) + (o.seed || 0))) * s * (small ? 0.4 : 0.15);
    shadow(ctx, 0, 2, s * 0.9);
    const base = '#e07a20';
    ctx.save();
    ctx.translate(0, -hop);
    if (!small) {
      for (const [lx, p] of [[-s * 0.3, 0], [s * 0.3, Math.PI]]) {
        const sw = Math.sin(t * 8 + p) * s * 0.12;
        ctx.strokeStyle = '#2a4a1a';
        ctx.lineWidth = s * 0.08;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(lx * 0.5, -s * 0.4);
        ctx.quadraticCurveTo(lx + sw, -s * 0.2, lx + sw * 1.4, hop - s * 0.02);
        ctx.stroke();
      }
    }
    const cy = small ? -s * 0.7 : -s * 1.05;
    // 一瓣瓣的南瓜
    for (const [dx, w, k] of [[-0.42, 0.42, 0.75], [0.42, 0.42, 0.75], [0, 0.5, 0.45]]) {
      ctx.fillStyle = bodyGrad(ctx, s * (dx - w), cy - s * 0.65, s * (dx + w), cy + s * 0.6, base, 0.25 + (k - 0.45) * 0.3, 0.75);
      ctx.beginPath();
      ctx.ellipse(s * dx, cy, s * w, s * 0.62, 0, 0, TAU);
      ctx.fill();
    }
    // 南瓜蒂和卷须
    ctx.strokeStyle = '#2a4a1a';
    ctx.lineWidth = s * 0.1;
    ctx.beginPath();
    ctx.moveTo(0, cy - s * 0.58);
    ctx.quadraticCurveTo(s * 0.05, cy - s * 0.85, s * 0.25, cy - s * 0.9);
    ctx.stroke();
    // 雕出来的脸：里面的火光
    const fire = 0.75 + Math.sin(t * 9) * 0.15 + Math.sin(t * 23) * 0.08;
    glow(ctx, -s * 0.15, cy + s * 0.05, s * 0.9, '#ffb040', fire * 0.7);
    ctx.fillStyle = rgba('#ffd27a', fire);
    // 三角眼
    for (const ex of [-0.42, 0.02]) {
      ctx.beginPath();
      ctx.moveTo(s * ex, cy - s * 0.05);
      ctx.lineTo(s * (ex + 0.12), cy - s * 0.25);
      ctx.lineTo(s * (ex + 0.24), cy - s * 0.05);
      ctx.closePath();
      ctx.fill();
    }
    // 锯齿嘴
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, cy + s * 0.15);
    for (let i = 0; i <= 6; i++) ctx.lineTo(-s * 0.5 + i * s * 0.12, cy + s * (i % 2 ? 0.25 : 0.33));
    ctx.lineTo(s * 0.22, cy + s * 0.15);
    ctx.quadraticCurveTo(-s * 0.14, cy + s * 0.48, -s * 0.5, cy + s * 0.15);
    ctx.fill();
    ctx.restore();
  }
  D.pumpkin = (ctx, s, t, o) => pumpkinBody(ctx, s, t, o, false);
  D.minipumpkin = (ctx, s, t, o) => pumpkinBody(ctx, s, t, o, true);

  // 骨头先生：高高的骷髅法师，破旧的长袍，骷髅眼窝里的蓝色鬼火；倒下时是一堆骨头
  D.boneMage = function (ctx, s, t, o) {
    const ai = o.ai || {};
    const bone = '#e8e2d0';
    if (ai.mode === 'bones') {
      shadow(ctx, 0, 2, s);
      ctx.strokeStyle = deep(bone, 0.35);
      ctx.lineWidth = s * 0.1;
      ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const a = i * 1.1;
        const bx = -s * 0.6 + i * s * 0.24;
        ctx.beginPath();
        ctx.moveTo(bx - Math.cos(a) * s * 0.22, -s * 0.12 - Math.sin(a) * s * 0.05);
        ctx.lineTo(bx + Math.cos(a) * s * 0.22, -s * 0.12 + Math.sin(a) * s * 0.05);
        ctx.stroke();
      }
      ctx.fillStyle = deep(bone, 0.25);
      ctx.beginPath();
      ctx.ellipse(s * 0.1, -s * 0.35, s * 0.3, s * 0.26, 0.3, 0, TAU);
      ctx.fill();
      // 闪烁的鬼火：快要复活了
      const fl = 0.4 + Math.max(0, Math.sin(t * 12)) * 0.6;
      glow(ctx, s * 0.05, -s * 0.4, s * 0.6, '#7ad0ff', fl * 0.8, true);
      return;
    }
    const sway = Math.sin(t * 2.5 + (o.seed || 0)) * 0.04;
    shadow(ctx, 0, 2, s * 0.9);
    ctx.save();
    ctx.rotate(sway);
    // 长袍：下摆撕成一条条
    const base = '#4a3a6a';
    ctx.fillStyle = bodyGrad(ctx, -s * 0.7, -s * 2.0, s * 0.7, 0, base, 0.3, 0.78);
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, -s * 1.85);
    ctx.quadraticCurveTo(-s * 0.7, -s * 1.0, -s * 0.7, -s * 0.15);
    for (let i = 0; i < 6; i++) {
      const fx = -s * 0.7 + (i + 1) * s * 0.24;
      ctx.lineTo(fx - s * 0.12, -s * 0.02 - Math.sin(t * 4 + i) * s * 0.06);
      ctx.lineTo(fx, -s * 0.18);
    }
    ctx.quadraticCurveTo(s * 0.65, -s * 1.0, s * 0.3, -s * 1.85);
    ctx.closePath();
    ctx.fill();
    // 肋骨（从袍子的领口露出来）
    ctx.strokeStyle = rgba(bone, 0.5);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, -s * 1.55 + i * s * 0.14, s * 0.2, 0.3, Math.PI - 0.3);
      ctx.stroke();
    }
    // 骷髅头
    ctx.fillStyle = bodyGrad(ctx, -s * 0.4, -s * 2.4, s * 0.4, -s * 1.8, bone, 0.05, 0.45);
    ctx.beginPath();
    ctx.ellipse(-s * 0.05, -s * 2.1, s * 0.32, s * 0.3, 0, 0, TAU);
    ctx.fill();
    ctx.fillRect(-s * 0.25, -s * 1.95, s * 0.36, s * 0.16);
    ctx.fillStyle = '#08080e';
    for (const dx of [-0.2, 0.06]) {
      ctx.beginPath();
      ctx.ellipse(s * dx, -s * 2.12, s * 0.09, s * 0.1, 0, 0, TAU);
      ctx.fill();
    }
    eyes(ctx, -s * 0.07, -s * 2.12, s * 0.26, s * 0.045, '#7ad0ff', 0);
    // 兜帽
    ctx.fillStyle = deep(base, 0.55);
    ctx.beginPath();
    ctx.moveTo(-s * 0.42, -s * 1.95);
    ctx.quadraticCurveTo(-s * 0.4, -s * 2.55, s * 0.12, -s * 2.55);
    ctx.quadraticCurveTo(s * 0.55, -s * 2.4, s * 0.38, -s * 1.85);
    ctx.quadraticCurveTo(s * 0.3, -s * 2.3, -s * 0.05, -s * 2.38);
    ctx.quadraticCurveTo(-s * 0.32, -s * 2.3, -s * 0.42, -s * 1.95);
    ctx.fill();
    ctx.restore();
    // 法杖和鬼火
    ctx.strokeStyle = deep('#c8b090', 0.45);
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.moveTo(-s * 0.75, -s * 0.05);
    ctx.lineTo(-s * 0.8, -s * 2.3);
    ctx.stroke();
    const fl = 0.7 + Math.sin(t * 7) * 0.2;
    glow(ctx, -s * 0.8, -s * 2.45, s * 0.6, '#7ad0ff', fl, true);
  };

  // 毒汤婆婆：尖帽子、长袍、搅着一口冒绿光的大锅
  D.witch = function (ctx, s, t, o) {
    const ai = o.ai || {};
    shadow(ctx, s * 0.2, 2, s * 1.4);
    // 大锅
    ctx.save();
    ctx.translate(-s * 0.85, 0);
    for (let i = 0; i < 3; i++) {
      const f = Math.sin(t * 12 + i) * 3;
      glow(ctx, -s * 0.25 + i * s * 0.25, -s * 0.15 - f, s * 0.25, '#ff8a3d', 0.7);
    }
    ctx.fillStyle = bodyGrad(ctx, -s * 0.7, -s * 1.1, s * 0.7, 0, '#3a3a48', 0.2, 0.7);
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.6, s * 0.68, s * 0.5, 0, 0, TAU);
    ctx.fill();
    const brew = ai.phase === 3 ? 0.6 : 1;
    glow(ctx, 0, -s * 1.05, s * 0.9, '#7aff6a', 0.7 * brew, true);
    ctx.fillStyle = rgba('#7aff6a', 0.85 * brew);
    ctx.beginPath();
    ctx.ellipse(0, -s * 1.0, s * 0.62, s * 0.14, 0, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const bt = (t * 1.5 + i * 0.33) % 1;
      dot(ctx, -s * 0.3 + i * s * 0.3, -s * 1.05 - bt * s * 0.7, 1.5 + bt * 2, '#9dff8a', 1 - bt);
    }
    if (ai.phase === 3) {
      // 倒翻的毒汤
      ctx.fillStyle = 'rgba(111,255,106,0.45)';
      ctx.beginPath();
      ctx.ellipse(-s * 0.9, -s * 0.08, s * 0.55, s * 0.12, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // 婆婆
    ctx.save();
    ctx.translate(s * 0.35, 0);
    const base = '#3a5a3a';
    const stir = Math.sin(t * 3) * 0.25;
    ctx.fillStyle = bodyGrad(ctx, -s * 0.6, -s * 2.0, s * 0.6, 0, base, 0.3, 0.78);
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, -s * 1.8);
    ctx.quadraticCurveTo(-s * 0.6, -s * 0.9, -s * 0.6, 0);
    ctx.lineTo(s * 0.6, 0);
    ctx.quadraticCurveTo(s * 0.55, -s * 0.9, s * 0.22, -s * 1.8);
    ctx.closePath();
    ctx.fill();
    // 搅汤的长勺
    ctx.save();
    ctx.translate(-s * 0.25, -s * 1.3);
    ctx.rotate(-0.9 + stir);
    ctx.strokeStyle = deep('#a07a50', 0.35);
    ctx.lineWidth = s * 0.07;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, s * 1.1);
    ctx.stroke();
    ctx.restore();
    // 脸：尖鼻子，藏在帽檐下
    ctx.fillStyle = deep('#a8c890', 0.45);
    ctx.beginPath();
    ctx.ellipse(-s * 0.05, -s * 1.95, s * 0.25, s * 0.26, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 0.25, -s * 1.95);
    ctx.quadraticCurveTo(-s * 0.55, -s * 1.85, -s * 0.48, -s * 1.75);
    ctx.lineTo(-s * 0.22, -s * 1.85);
    ctx.fill();
    eyes(ctx, -s * 0.15, -s * 2.0, s * 0.16, s * 0.045, '#d8ff8a', -0.1);
    // 宽檐尖帽子，帽尖往后弯
    ctx.fillStyle = deep('#3a2a4a', 0.4);
    ctx.beginPath();
    ctx.ellipse(-s * 0.02, -s * 2.15, s * 0.65, s * 0.12, -0.08, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, -s * 2.18);
    ctx.quadraticCurveTo(-s * 0.1, -s * 2.9, s * 0.45, -s * 3.0 + Math.sin(t * 2) * s * 0.05);
    ctx.quadraticCurveTo(s * 0.1, -s * 2.7, s * 0.3, -s * 2.2);
    ctx.closePath();
    ctx.fill();
    rune(ctx, [[-s * 0.3, -s * 2.24], [s * 0.28, -s * 2.26]], '#b08aff', 1.5, 0.7);
    ctx.restore();
  };

  // ======================================================================
  // 第四章 · 冰霜雪原（设计书 56.4）
  // ======================================================================

  function snowOrb(ctx, x, y, r, t) {
    const g = ctx.createRadialGradient(x + r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.05);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, '#b8d4ee');
    g.addColorStop(1, '#3a5a80');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    // 表面的冰晶闪光
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + t * 0.5;
      const tw = Math.max(0, Math.sin(t * 3 + i * 2));
      if (tw > 0.3) dot(ctx, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, 0.9, '#e8f8ff', tw);
    }
  }

  D.snowman = function (ctx, s, t, o) {
    const sway = Math.sin(t * 6 + (o.seed || 0)) * 0.06;
    shadow(ctx, 0, 2, s * 0.9);
    ctx.save();
    ctx.rotate(sway);
    snowOrb(ctx, 0, -s * 0.6, s * 0.62, t);
    snowOrb(ctx, -s * 0.05, -s * 1.45, s * 0.42, t + 1);
    // 树枝手臂
    ctx.strokeStyle = '#3a2418';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, -s * 0.8);
    ctx.lineTo(-s * 0.95, -s * 1.05);
    ctx.lineTo(-s * 1.1, -s * 1.0);
    ctx.moveTo(-s * 0.95, -s * 1.05);
    ctx.lineTo(-s * 1.05, -s * 1.2);
    ctx.stroke();
    eyes(ctx, -s * 0.2, -s * 1.5, s * 0.2, s * 0.05, '#7ad8ff', 0);
    ctx.restore();
  };
  D.snowball = function (ctx, s, t, o) {
    shadow(ctx, 0, 2, s * 0.8);
    const r = s * 0.65;
    ctx.save();
    ctx.translate(0, -r);
    ctx.rotate(-t * 6 - (o.seed || 0));
    snowOrb(ctx, 0, 0, r, t);
    ctx.restore();
    eyes(ctx, -r * 0.3, -r * 1.1, r * 0.35, r * 0.09, '#7ad8ff', 0);
  };

  // 企鹅：肚皮贴地的流线型身体
  D.penguin = function (ctx, s, t, o) {
    shadow(ctx, 0, 2, s * 1.1);
    const wob = Math.sin(t * 10 + (o.seed || 0)) * 0.04;
    ctx.save();
    ctx.translate(0, -s * 0.35);
    ctx.rotate(-0.08 + wob);
    ctx.fillStyle = bodyGrad(ctx, -s, -s * 0.4, s, s * 0.4, '#2a3a5a', 0.15, 0.7);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.05, s * 0.36, 0, 0, TAU);
    ctx.fill();
    // 白肚皮
    const bg = ctx.createLinearGradient(0, -s * 0.1, 0, s * 0.36);
    bg.addColorStop(0, 'rgba(230,240,255,0.95)');
    bg.addColorStop(1, 'rgba(120,150,190,0.9)');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.ellipse(-s * 0.1, s * 0.12, s * 0.85, s * 0.2, 0, 0, TAU);
    ctx.fill();
    // 往后贴着的鳍
    ctx.fillStyle = deep('#2a3a5a', 0.4);
    ctx.beginPath();
    ctx.ellipse(s * 0.3, -s * 0.05, s * 0.4, s * 0.1, 0.15, 0, TAU);
    ctx.fill();
    // 喙和眼睛
    ctx.fillStyle = '#ffb040';
    ctx.beginPath();
    ctx.moveTo(-s * 1.0, -s * 0.08);
    ctx.lineTo(-s * 1.3, -s * 0.02);
    ctx.lineTo(-s * 1.0, s * 0.04);
    ctx.fill();
    eyes(ctx, -s * 0.78, -s * 0.12, 0.01, s * 0.06, '#e8f8ff', 0);
    ctx.restore();
    // 身后的冰屑
    for (let i = 0; i < 3; i++) dot(ctx, s * (1.1 + i * 0.25), -s * 0.05 - i * s * 0.08, 1, '#cfefff', 0.6 - i * 0.15);
  };

  // 冰晶精灵：漂浮的菱形冰晶 + 两片光翅 + 一圈寒气
  D.iceSprite = function (ctx, s, t, o) {
    const fl = Math.sin(t * 3 + (o.seed || 0)) * s * 0.15;
    ctx.translate(0, -s * 1.2 + fl);
    const flap = Math.sin(t * 12);
    wing(ctx, s * 0.1, -s * 0.1, s * 0.9, s * 0.4, 0.7 + flap * 0.3, '#bfefff');
    wing(ctx, -s * 0.1, -s * 0.1, s * 0.9, s * 0.4, -0.7 - flap * 0.3, '#bfefff');
    // 寒气光环
    ctx.strokeStyle = 'rgba(160,230,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.1, s * 0.35, t * 0.5, 0, TAU);
    ctx.stroke();
    glow(ctx, 0, 0, s * 1.0, '#9fe3ff', 0.6, true);
    const g = ctx.createLinearGradient(s * 0.3, -s * 0.6, -s * 0.3, s * 0.6);
    g.addColorStop(0, 'rgba(240,252,255,0.95)');
    g.addColorStop(1, 'rgba(80,150,220,0.85)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.65);
    ctx.lineTo(s * 0.3, 0);
    ctx.lineTo(0, s * 0.6);
    ctx.lineTo(-s * 0.3, 0);
    ctx.closePath();
    ctx.fill();
    eyes(ctx, -s * 0.07, -s * 0.05, s * 0.14, s * 0.035, '#ffffff', 0);
  };

  // 北极狼：修长的身体、长腿、蓬松的尾巴往后拖
  D.wolf = function (ctx, s, t, o) {
    shadow(ctx, 0, 2, s * 1.1);
    const base = '#9ab0c8';
    const q = quadruped(ctx, s, t, o, { base, len: s * 1.8, high: s * 0.32, legLen: s * 0.62, run: o.attack ? 0.4 : 1.5 });
    const by = q.bodyY;
    // 尾巴
    const tw = Math.sin(q.ph * 0.5) * s * 0.1;
    ctx.fillStyle = bodyGrad(ctx, s * 0.6, by - s * 0.4, s * 1.7, by + s * 0.2, base, 0.2, 0.65);
    ctx.beginPath();
    ctx.moveTo(s * 0.8, by - s * 0.15);
    ctx.quadraticCurveTo(s * 1.3, by - s * 0.35 + tw, s * 1.7, by - s * 0.1 + tw);
    ctx.quadraticCurveTo(s * 1.3, by + s * 0.1, s * 0.8, by + s * 0.05);
    ctx.fill();
    // 颈毛与头
    ctx.fillStyle = bodyGrad(ctx, -s * 1.5, by - s * 0.7, -s * 0.5, by + s * 0.2, base, 0.2, 0.65);
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, by - s * 0.3);
    ctx.quadraticCurveTo(-s * 0.85, by - s * 0.75, -s * 1.15, by - s * 0.6);
    ctx.lineTo(-s * 1.55, by - s * 0.42);
    ctx.quadraticCurveTo(-s * 1.5, by - s * 0.3, -s * 1.15, by - s * 0.28);
    ctx.quadraticCurveTo(-s * 0.95, by + s * 0.1, -s * 0.6, by + s * 0.15);
    ctx.closePath();
    ctx.fill();
    // 竖起的耳朵
    ctx.beginPath();
    ctx.moveTo(-s * 0.95, by - s * 0.62);
    ctx.lineTo(-s * 0.85, by - s * 0.95);
    ctx.lineTo(-s * 0.75, by - s * 0.58);
    ctx.fill();
    eyes(ctx, -s * 1.18, by - s * 0.5, 0.01, s * 0.06, '#8ae0ff', -0.2);
  };

  // 雪怪：驼背的大块头，肩膀很高、长手臂垂到地上，一身蓬松的长毛
  D.yeti = function (ctx, s, t, o) {
    const ph = t * 4 + (o.seed || 0);
    const step = Math.sin(ph);
    shadow(ctx, 0, 2, s * 1.2);
    const base = '#a8bcd4';
    // 腿
    for (const [lx, p, far] of [[s * 0.35, 1, true], [-s * 0.05, -1, false]]) {
      ctx.fillStyle = deep(base, far ? 0.78 : 0.58);
      ctx.beginPath();
      ctx.ellipse(lx + step * p * s * 0.12, -s * 0.32, s * 0.22, s * 0.34, 0, 0, TAU);
      ctx.fill();
    }
    // 远侧手臂
    ctx.strokeStyle = deep(base, 0.8);
    ctx.lineWidth = s * 0.26;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.1, -s * 1.55);
    ctx.quadraticCurveTo(-s * 0.2, -s * 1.0, -s * 0.15 - step * s * 0.1, -s * 0.2);
    ctx.stroke();
    // 驼背的身体：肩膀高、往前探
    ctx.fillStyle = bodyGrad(ctx, -s * 1.0, -s * 2.2, s * 0.9, -s * 0.3, base, 0.12, 0.62);
    ctx.beginPath();
    ctx.moveTo(s * 0.6, -s * 0.45);
    ctx.quadraticCurveTo(s * 0.85, -s * 1.3, s * 0.35, -s * 1.85);
    ctx.quadraticCurveTo(-s * 0.2, -s * 2.25, -s * 0.7, -s * 1.85);
    ctx.quadraticCurveTo(-s * 0.95, -s * 1.4, -s * 0.6, -s * 0.9);
    ctx.quadraticCurveTo(-s * 0.3, -s * 0.5, s * 0.6, -s * 0.45);
    ctx.fill();
    // 一缕缕长毛（受光一侧更亮）
    for (let i = 0; i < 9; i++) {
      const fx = -s * 0.6 + i * s * 0.16;
      const fy = -s * (1.75 - Math.sin((i / 8) * Math.PI) * 0.25);
      ctx.strokeStyle = i > 4 ? 'rgba(240,248,255,0.45)' : deep(base, 0.7);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.quadraticCurveTo(fx + s * 0.08, fy + s * 0.35, fx + s * 0.02 + Math.sin(ph + i) * 2, fy + s * 0.6);
      ctx.stroke();
    }
    // 近侧手臂：从身体中间垂到地面（离脸远一点，免得看起来像象鼻）
    ctx.strokeStyle = deep(base, 0.45);
    ctx.lineWidth = s * 0.28;
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, -s * 1.45);
    ctx.quadraticCurveTo(-s * 0.55, -s * 0.95, -s * 0.5 + step * s * 0.1, -s * 0.28);
    ctx.stroke();
    ctx.fillStyle = deep(base, 0.55);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(-s * 0.58 + i * s * 0.08 + step * s * 0.1, -s * 0.15, s * 0.06, s * 0.1, 0.2, 0, TAU);
      ctx.fill();
    }
    // 头：在驼峰的前上方，深色的脸上一双蓝眼睛和张开的嘴，两只小弯角
    const hx = -s * 0.68;
    const hy = -s * 1.88;
    ctx.fillStyle = bodyGrad(ctx, hx - s * 0.35, hy - s * 0.35, hx + s * 0.35, hy + s * 0.3, base, 0.12, 0.55);
    ctx.beginPath();
    ctx.ellipse(hx, hy, s * 0.36, s * 0.32, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = deep('#4a5a70', 0.5);
    ctx.beginPath();
    ctx.ellipse(hx - s * 0.12, hy + s * 0.04, s * 0.22, s * 0.2, 0, 0, TAU);
    ctx.fill();
    eyes(ctx, hx - s * 0.16, hy - s * 0.02, s * 0.16, s * 0.045, '#7ad8ff', -0.1);
    ctx.fillStyle = '#0a0e18';
    ctx.beginPath();
    ctx.ellipse(hx - s * 0.16, hy + s * 0.14, s * 0.08, s * 0.04, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#d8e0e8';
    ctx.lineWidth = s * 0.07;
    for (const dx of [-0.2, 0.12]) {
      ctx.beginPath();
      ctx.moveTo(hx + s * dx, hy - s * 0.26);
      ctx.quadraticCurveTo(hx + s * (dx + 0.02), hy - s * 0.48, hx + s * (dx + 0.16), hy - s * 0.46);
      ctx.stroke();
    }
  };

  // 小冰龙：蛇一样弯曲、越来越细的身体，冰晶翅膀
  D.iceDragon = function (ctx, s, t, o) {
    const ph = t * 6 + (o.seed || 0);
    ctx.save();
    ctx.globalAlpha = 0.5;
    shadow(ctx, 0, 34, s * 0.8);
    ctx.restore();
    ctx.translate(0, -s * 0.8);
    const base = '#5aa8e0';
    const pts = [];
    for (let i = 0; i <= 12; i++) pts.push([-s * 0.65 + i * s * 0.17, Math.sin(ph - i * 0.45) * s * 0.18]);
    // 身体：用一段段越来越细的线画成平滑的蛇形
    ctx.lineCap = 'round';
    for (let i = pts.length - 1; i > 0; i--) {
      const k = i / pts.length;
      ctx.strokeStyle = deep(base, 0.25 + k * 0.45);
      ctx.lineWidth = s * (0.5 - k * 0.42);
      ctx.beginPath();
      ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);
      ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }
    // 背上的冰刺
    for (let i = 1; i < 8; i++) {
      const [px, py] = pts[i];
      ctx.fillStyle = 'rgba(220,245,255,0.85)';
      ctx.beginPath();
      ctx.moveTo(px - s * 0.05, py - s * (0.2 - i * 0.015));
      ctx.lineTo(px, py - s * (0.36 - i * 0.025));
      ctx.lineTo(px + s * 0.05, py - s * (0.2 - i * 0.015));
      ctx.fill();
    }
    const flap = Math.sin(t * 9);
    wing(ctx, -s * 0.15, pts[3][1] - s * 0.1, s * 1.15, s * 0.55, 0.35 + flap * 0.45, '#bfefff');
    // 头和角
    ctx.fillStyle = bodyGrad(ctx, -s * 1.1, -s * 0.4, -s * 0.5, s * 0.2, base, 0.15, 0.6);
    ctx.beginPath();
    ctx.ellipse(-s * 0.85, pts[0][1] - s * 0.04, s * 0.32, s * 0.2, -0.15, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#e8f8ff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-s * 0.72, pts[0][1] - s * 0.18);
    ctx.quadraticCurveTo(-s * 0.6, pts[0][1] - s * 0.35, -s * 0.45, pts[0][1] - s * 0.4);
    ctx.stroke();
    eyes(ctx, -s * 0.95, pts[0][1] - s * 0.08, 0.01, s * 0.06, '#e8ffff', -0.2);
  };

  // 冰棍大叔：冰块堆成的大个子，裂缝里透出蓝光（友善的巨人）
  D.iceGiant = function (ctx, s, t, o) {
    const step = Math.sin(t * 3 + (o.seed || 0));
    shadow(ctx, 0, 2, s * 1.2);
    const ice = (x, y, w, h, k) => {
      const g = ctx.createLinearGradient(x + w, y, x, y + h);
      g.addColorStop(0, 'rgba(230,248,255,0.95)');
      g.addColorStop(0.5, `rgba(120,180,230,${0.9 - k * 0.1})`);
      g.addColorStop(1, `rgba(30,60,110,0.95)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.1, y);
      ctx.lineTo(x + w * 0.9, y + h * 0.04);
      ctx.lineTo(x + w, y + h * 0.9);
      ctx.lineTo(x + w * 0.05, y + h);
      ctx.closePath();
      ctx.fill();
    };
    ice(-s * 0.55 + step * 3, -s * 0.6, s * 0.4, s * 0.6, 1);
    ice(s * 0.15 - step * 3, -s * 0.6, s * 0.4, s * 0.6, 1);
    ice(-s * 0.75, -s * 1.85, s * 1.5, s * 1.3, 0);
    ice(-s * 1.15, -s * 1.75, s * 0.4, s * 1.0, 1);
    ice(-s * 0.55, -s * 2.55, s * 0.9, s * 0.75, 0);
    // 裂缝里的蓝光
    rune(ctx, [[-s * 0.2, -s * 1.7], [0, -s * 1.3], [-s * 0.1, -s * 0.9]], '#9fe3ff', 2, 0.8);
    rune(ctx, [[s * 0.3, -s * 1.6], [s * 0.45, -s * 1.2]], '#9fe3ff', 1.5, 0.6);
    eyes(ctx, -s * 0.25, -s * 2.15, s * 0.28, s * 0.07, '#e0ffff', 0);
    // 呼出的寒气
    const bt = (t * 0.8) % 1;
    glow(ctx, -s * 0.8 - bt * s * 0.6, -s * 2.0, s * (0.2 + bt * 0.3), '#dff6ff', (1 - bt) * 0.5);
  };

  // 霜霜女王：修长的身形、拖地的冰纱长裙、冰晶王冠和权杖
  D.frostQueen = function (ctx, s, t, o) {
    const sway = Math.sin(t * 2 + (o.seed || 0)) * 0.04;
    shadow(ctx, 0, 2, s * 1.1);
    ctx.save();
    ctx.rotate(sway);
    // 长裙：下摆往后飘
    const hem = Math.sin(t * 3) * s * 0.1;
    const g = ctx.createLinearGradient(s * 0.5, -s * 2.0, -s * 0.5, 0);
    g.addColorStop(0, 'rgba(230,248,255,0.95)');
    g.addColorStop(0.5, 'rgba(120,170,230,0.85)');
    g.addColorStop(1, 'rgba(40,60,120,0.8)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-s * 0.18, -s * 1.95);
    ctx.quadraticCurveTo(-s * 0.4, -s * 1.0, -s * 0.75, 0);
    ctx.quadraticCurveTo(s * 0.3, s * 0.05, s * 1.2 + hem, -s * 0.05);
    ctx.quadraticCurveTo(s * 0.5, -s * 0.6, s * 0.22, -s * 1.95);
    ctx.closePath();
    ctx.fill();
    // 裙上的冰晶纹
    rune(ctx, [[-s * 0.4, -s * 0.4], [0, -s * 0.8], [s * 0.4, -s * 0.4]], '#e0f8ff', 1.4, 0.55);
    // 脸
    ctx.fillStyle = 'rgba(200,225,250,0.95)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.02, -s * 2.2, s * 0.2, s * 0.26, 0, 0, TAU);
    ctx.fill();
    eyes(ctx, -s * 0.07, -s * 2.22, s * 0.13, s * 0.04, '#5ad0ff', -0.05);
    // 冰晶王冠
    glow(ctx, 0, -s * 2.6, s * 0.5, '#bfefff', 0.6);
    ctx.fillStyle = 'rgba(235,250,255,0.95)';
    for (let i = -2; i <= 2; i++) {
      const h = s * (0.25 + (2 - Math.abs(i)) * 0.12);
      ctx.beginPath();
      ctx.moveTo(i * s * 0.1 - s * 0.05, -s * 2.42);
      ctx.lineTo(i * s * 0.1, -s * 2.42 - h);
      ctx.lineTo(i * s * 0.1 + s * 0.05, -s * 2.42);
      ctx.fill();
    }
    // 长发往后飘
    ctx.fillStyle = 'rgba(220,240,255,0.7)';
    ctx.beginPath();
    ctx.moveTo(s * 0.12, -s * 2.35);
    ctx.quadraticCurveTo(s * 0.7, -s * 2.2 + hem, s * 0.95, -s * 1.5);
    ctx.quadraticCurveTo(s * 0.5, -s * 1.8, s * 0.15, -s * 2.0);
    ctx.fill();
    ctx.restore();
    // 权杖
    ctx.strokeStyle = 'rgba(200,230,255,0.9)';
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.moveTo(-s * 0.6, -s * 0.1);
    ctx.lineTo(-s * 0.7, -s * 2.2);
    ctx.stroke();
    glow(ctx, -s * 0.7, -s * 2.35, s * 0.5, '#9fe3ff', 0.85, true);
  };

  // ======================================================================
  // 第五章 · 熔岩裂隙（设计书 56.4）
  // ======================================================================

  // 岩浆团：暗色的冷却外壳，裂缝里流着岩浆
  D.magma = function (ctx, s, t, o) {
    shadow(ctx, 0, 2, s);
    glow(ctx, 0, -s * 0.4, s * 1.1, '#ff6a2a', 0.45);
    const h = jelly(ctx, s, t, '#5a2a20', '#ffb050', o, 0.9);
    // 裂缝
    rune(ctx, [[-s * 0.6, -h * 0.3], [-s * 0.2, -h * 0.55], [s * 0.1, -h * 0.35], [s * 0.5, -h * 0.6]], '#ff8a3a', 2, 0.85);
    rune(ctx, [[-s * 0.2, -h * 0.55], [-s * 0.1, -h * 0.9]], '#ff8a3a', 1.6, 0.7);
    eyes(ctx, -s * 0.38, -h * 0.72, s * 0.28, s * 0.07, '#ffd27a', -0.15);
    // 头顶冒出的火星
    const bt = (t * 1.2 + (o.seed || 0) * 0.1) % 1;
    dot(ctx, s * 0.1 + Math.sin(t * 3) * s * 0.2, -h * 1.1 - bt * s * 0.8, 1.2, '#ffb050', 1 - bt);
  };

  // 熔岩傀儡：一块块石头拼成的人形，缝隙里透出岩浆的光
  D.lavaGolem = function (ctx, s, t, o) {
    const step = Math.sin(t * 4 + (o.seed || 0));
    shadow(ctx, 0, 2, s);
    const rock = (x, y, w, h, k) => {
      ctx.fillStyle = bodyGrad(ctx, x - w, y - h, x + w, y + h, '#6a4a40', 0.35 + k * 0.1, 0.8);
      ctx.beginPath();
      ctx.moveTo(x - w, y - h * 0.6);
      ctx.lineTo(x - w * 0.4, y - h);
      ctx.lineTo(x + w * 0.8, y - h * 0.8);
      ctx.lineTo(x + w, y + h * 0.4);
      ctx.lineTo(x + w * 0.3, y + h);
      ctx.lineTo(x - w * 0.9, y + h * 0.7);
      ctx.closePath();
      ctx.fill();
    };
    glow(ctx, 0, -s * 1.1, s * 0.9, '#ff6a2a', 0.5);
    rock(-s * 0.25 + step * 2, -s * 0.3, s * 0.22, s * 0.3, 1);
    rock(s * 0.25 - step * 2, -s * 0.3, s * 0.22, s * 0.3, 1);
    rock(0, -s * 1.05, s * 0.55, s * 0.5, 0);
    rock(-s * 0.65, -s * 1.0, s * 0.2, s * 0.4, 1);
    rock(s * 0.6, -s * 1.05, s * 0.2, s * 0.35, 1);
    rock(-s * 0.05, -s * 1.75, s * 0.3, s * 0.28, 0);
    // 岩浆缝
    rune(ctx, [[-s * 0.3, -s * 1.3], [0, -s * 1.05], [s * 0.25, -s * 1.25]], '#ff8a3a', 2.2, 0.9);
    rune(ctx, [[0, -s * 1.05], [-s * 0.05, -s * 0.7]], '#ff8a3a', 1.8, 0.8);
    eyes(ctx, -s * 0.12, -s * 1.78, s * 0.2, s * 0.05, '#ffc04a', 0);
  };

  // 火焰小恶魔：蝙蝠翅膀、细长的尾巴，手里托着一团火
  D.imp = function (ctx, s, t, o) {
    const fl = Math.sin(t * 5 + (o.seed || 0)) * s * 0.1;
    ctx.save();
    ctx.globalAlpha = 0.5;
    shadow(ctx, 0, 34, s * 0.7);
    ctx.restore();
    ctx.translate(0, -s * 1.0 + fl);
    const base = '#c03a3a';
    const flap = Math.sin(t * 14);
    for (const [dir, far] of [[1, true], [-1, false]]) {
      ctx.fillStyle = far ? deep(base, 0.85) : deep(base, 0.55);
      ctx.beginPath();
      ctx.moveTo(s * 0.1, -s * 0.2);
      ctx.quadraticCurveTo(s * 0.4 * dir + s * 0.3, -s * 0.9 - flap * s * 0.3, s * 0.9 + (dir > 0 ? 0 : -s * 0.1), -s * 0.7 - flap * s * 0.3);
      ctx.lineTo(s * 0.7, -s * 0.35);
      ctx.lineTo(s * 0.55, -s * 0.15);
      ctx.closePath();
      ctx.fill();
    }
    // 尾巴
    ctx.strokeStyle = deep(base, 0.6);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(s * 0.2, s * 0.25);
    ctx.quadraticCurveTo(s * 0.7, s * 0.6, s * 0.9, s * 0.3 + Math.sin(t * 6) * s * 0.1);
    ctx.stroke();
    ctx.fillStyle = bodyGrad(ctx, -s * 0.4, -s * 0.6, s * 0.4, s * 0.4, base, 0.25, 0.7);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.3, s * 0.38, 0.2, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-s * 0.1, -s * 0.5, s * 0.25, s * 0.22, 0, 0, TAU);
    ctx.fill();
    // 小角
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, -s * 0.66);
    ctx.lineTo(-s * 0.28, -s * 0.9);
    ctx.lineTo(-s * 0.08, -s * 0.7);
    ctx.lineTo(s * 0.02, -s * 0.9);
    ctx.lineTo(s * 0.08, -s * 0.62);
    ctx.fill();
    eyes(ctx, -s * 0.18, -s * 0.52, s * 0.14, s * 0.045, '#ffe07a', -0.1);
    // 手里的火球
    const fire = 0.7 + Math.sin(t * 10) * 0.2;
    glow(ctx, -s * 0.5, -s * 0.05, s * 0.45, '#ff9a3a', fire, true);
  };

  // 暗影刺客：几乎融进黑暗的身形，飘动的围巾，两把发光的短刀
  D.assassin = function (ctx, s, t, o) {
    const ph = t * 10 + (o.seed || 0);
    const step = Math.sin(ph);
    shadow(ctx, 0, 2, s * 0.7);
    const base = '#2a2a3a';
    // 腿：大步奔跑
    for (const [p, far] of [[1, true], [-1, false]]) {
      ctx.strokeStyle = deep(base, far ? 0.6 : 0.3);
      ctx.lineWidth = s * 0.12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.85);
      ctx.lineTo(step * p * s * 0.3 + s * 0.05, -s * 0.45);
      ctx.lineTo(step * p * s * 0.45, -s * 0.03);
      ctx.stroke();
    }
    // 前倾的身体
    ctx.fillStyle = deep(base, 0.2);
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, -s * 0.85);
    ctx.quadraticCurveTo(-s * 0.4, -s * 1.4, -s * 0.25, -s * 1.7);
    ctx.lineTo(s * 0.15, -s * 1.65);
    ctx.quadraticCurveTo(s * 0.2, -s * 1.2, s * 0.15, -s * 0.85);
    ctx.closePath();
    ctx.fill();
    // 飘在身后的长围巾
    const sw = Math.sin(t * 7) * s * 0.12;
    ctx.fillStyle = 'rgba(160,60,200,0.85)';
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, -s * 1.65);
    ctx.quadraticCurveTo(s * 0.5, -s * 1.8 + sw, s * 1.2, -s * 1.55 - sw);
    ctx.lineTo(s * 1.1, -s * 1.4 - sw);
    ctx.quadraticCurveTo(s * 0.5, -s * 1.55 + sw, -s * 0.05, -s * 1.5);
    ctx.closePath();
    ctx.fill();
    // 头巾下一道发光的眼缝
    ctx.fillStyle = deep(base, 0.1);
    ctx.beginPath();
    ctx.ellipse(-s * 0.18, -s * 1.85, s * 0.2, s * 0.2, 0, 0, TAU);
    ctx.fill();
    eyes(ctx, -s * 0.24, -s * 1.86, s * 0.14, s * 0.045, '#d08aff', -0.1);
    // 两把短刀
    for (const [dx, dy] of [[-0.55, -1.1], [0.3, -1.0]]) {
      ctx.strokeStyle = 'rgba(220,200,255,0.9)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(s * dx, s * dy);
      ctx.lineTo(s * (dx - 0.3), s * (dy - 0.15));
      ctx.stroke();
      glow(ctx, s * (dx - 0.3), s * (dy - 0.15), s * 0.18, '#d08aff', 0.6);
    }
  };

  // 骷髅战车：骨头拼的小推车，车头一盏鬼火灯
  D.chariot = function (ctx, s, t, o) {
    const spin = -t * 10 - (o.seed || 0);
    shadow(ctx, 0, 2, s * 1.2);
    const wood = '#6a4a30';
    // 车身
    ctx.fillStyle = bodyGrad(ctx, -s, -s * 1.0, s, -s * 0.3, wood, 0.3, 0.78);
    ctx.beginPath();
    ctx.moveTo(-s * 1.0, -s * 0.55);
    ctx.lineTo(s * 0.9, -s * 0.6);
    ctx.lineTo(s * 0.8, -s * 0.95);
    ctx.lineTo(-s * 0.7, -s * 0.85);
    ctx.closePath();
    ctx.fill();
    // 骨头栏杆
    ctx.strokeStyle = 'rgba(230,225,210,0.8)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.5 + i * s * 0.38, -s * 0.9);
      ctx.lineTo(-s * 0.45 + i * s * 0.38, -s * 1.15);
      ctx.stroke();
    }
    // 轮子
    for (const wx of [-s * 0.6, s * 0.55]) {
      ctx.fillStyle = deep(wood, 0.6);
      ctx.beginPath();
      ctx.arc(wx, -s * 0.32, s * 0.3, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(230,225,210,0.7)';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 4; k++) {
        const a = spin + (k * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(wx, -s * 0.32);
        ctx.lineTo(wx + Math.cos(a) * s * 0.28, -s * 0.32 + Math.sin(a) * s * 0.28);
        ctx.stroke();
      }
    }
    // 骷髅车夫
    ctx.fillStyle = 'rgba(225,220,205,0.95)';
    ctx.beginPath();
    ctx.ellipse(s * 0.25, -s * 1.35, s * 0.22, s * 0.2, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#0a0a10';
    ctx.beginPath();
    ctx.ellipse(s * 0.18, -s * 1.36, s * 0.13, s * 0.08, 0, 0, TAU);
    ctx.fill();
    eyes(ctx, s * 0.18, -s * 1.36, s * 0.12, s * 0.035, '#7affc0', 0);
    // 车头的鬼火灯
    glow(ctx, -s * 1.05, -s * 0.85, s * 0.45, '#7affc0', 0.8 + Math.sin(t * 9) * 0.15, true);
  };

  // 墨墨的分身 / 本体：一团墨色的灵，墨汁像触须一样流动，紫色的眼睛
  function inkSpirit(ctx, s, t, o, scale, angry) {
    const ph = t * 3 + (o.seed || 0);
    const r = s * scale;
    // 往下滴、往外飘的墨须
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * 0.15 + (i / 5) * Math.PI * 0.7;
      const len = r * (0.5 + Math.sin(ph + i) * 0.15);
      ctx.strokeStyle = 'rgba(30,20,50,0.85)';
      ctx.lineWidth = r * 0.12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.6, -r * 0.6 + Math.sin(a) * r * 0.5);
      ctx.quadraticCurveTo(Math.cos(a) * r * 0.9 + Math.sin(ph + i) * r * 0.15, -r * 0.3 + Math.sin(a) * r * 0.6, Math.cos(a) * r * 0.75, -r * 0.02 + len * 0.1);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(r * 0.25, -r * 1.0, r * 0.1, 0, -r * 0.65, r);
    g.addColorStop(0, angry ? '#6a3a7a' : '#4a3a6a');
    g.addColorStop(0.6, '#1e1630');
    g.addColorStop(1, '#0a0614');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, -r * 0.2);
    ctx.bezierCurveTo(-r * 0.95, -r * 1.2, r * 0.9, -r * 1.35, r * 0.82, -r * 0.25);
    ctx.quadraticCurveTo(0, r * 0.05, -r * 0.8, -r * 0.2);
    ctx.fill();
    // 紫色的流光
    rune(ctx, [[-r * 0.4, -r * 0.9], [0, -r * 1.1], [r * 0.4, -r * 0.85]], '#b08aff', Math.max(1.2, r * 0.04), 0.55);
    eyes(ctx, -r * 0.2, -r * 0.7, r * 0.32, r * 0.07, angry ? '#ff8ad0' : '#d0a8ff', -0.1);
  }
  D.inkClone = function (ctx, s, t, o) {
    shadow(ctx, 0, 2, s * 0.9);
    inkSpirit(ctx, s, t, o, 1.0, false);
  };
  D.inkBoss = function (ctx, s, t, o) {
    const ai = o.ai || {};
    const big = ai.big ? 1.55 : 1;
    shadow(ctx, 0, 2, s * big);
    if (ai.mode === 'warn') ctx.translate(Math.sin(t * 50) * 2, 0);
    glow(ctx, 0, -s * 0.8 * big, s * 1.4 * big, '#7a4ab8', 0.35 + (ai.phase >= 4 ? 0.25 : 0));
    inkSpirit(ctx, s, t, o, 1.15 * big, ai.mode === 'warn' || ai.phase >= 4);
  };

  // 岩岩：熔岩核心的巨大岩石傀儡；要跺脚时全身的裂缝亮起来
  D.rockGolem = function (ctx, s, t, o) {
    const ai = o.ai || {};
    const warn = ai.warn > 0;
    const step = Math.sin(t * 2.5 + (o.seed || 0));
    shadow(ctx, 0, 2, s * 1.3);
    ctx.save();
    if (warn) ctx.translate(Math.sin(t * 60) * 3, 0);
    const rock = (x, y, w, h) => {
      ctx.fillStyle = bodyGrad(ctx, x - w, y - h, x + w, y + h, '#7a5a4a', 0.3, 0.8);
      ctx.beginPath();
      ctx.moveTo(x - w, y - h * 0.5);
      ctx.lineTo(x - w * 0.5, y - h);
      ctx.lineTo(x + w * 0.7, y - h * 0.9);
      ctx.lineTo(x + w, y + h * 0.3);
      ctx.lineTo(x + w * 0.4, y + h);
      ctx.lineTo(x - w * 0.8, y + h * 0.8);
      ctx.closePath();
      ctx.fill();
    };
    const core = warn ? 1 : 0.55 + Math.sin(t * 3) * 0.15;
    glow(ctx, 0, -s * 1.2, s * 1.3, '#ff6a2a', core * 0.6);
    rock(-s * 0.4 + step * 2, -s * 0.35, s * 0.3, s * 0.35);
    rock(s * 0.4 - step * 2, -s * 0.35, s * 0.3, s * 0.35);
    rock(0, -s * 1.2, s * 0.85, s * 0.65);
    rock(-s * 1.0, -s * 1.1, s * 0.3, s * 0.55);
    rock(s * 0.95, -s * 1.15, s * 0.3, s * 0.5);
    rock(-s * 0.1, -s * 2.05, s * 0.4, s * 0.35);
    // 胸口的熔岩核心 + 裂缝
    glow(ctx, -s * 0.05, -s * 1.25, s * 0.5, '#ffb050', core, true);
    const a = 0.6 + core * 0.4;
    rune(ctx, [[-s * 0.5, -s * 1.5], [-s * 0.05, -s * 1.25], [s * 0.5, -s * 1.55]], '#ff8a3a', 2.5, a);
    rune(ctx, [[-s * 0.05, -s * 1.25], [s * 0.1, -s * 0.8]], '#ff8a3a', 2, a);
    eyes(ctx, -s * 0.2, -s * 2.08, s * 0.25, s * 0.07, warn ? '#ff7a3a' : '#ffc04a', 0);
    ctx.restore();
  };

  // ======================================================================
  // 第六章 · 云端王国（设计书 56.4）
  // ======================================================================

  // 云朵羊：一团发光的云絮包着修长的黑脸小羊；剃光毛后是瘦长的粉色身体
  D.cloudSheep = function (ctx, s, t, o) {
    const woolLeft = o.wool === null || o.wool === undefined ? 1 : o.wool;
    const sheared = woolLeft <= 0;
    shadow(ctx, 0, 2, s);
    const q = quadruped(ctx, s, t, o, { base: sheared ? '#e0a0c0' : '#3a3048', len: s * 1.3, high: s * 0.3, legLen: s * 0.42, run: sheared ? 2.0 : 0.9 });
    const by = q.bodyY;
    if (!sheared) {
      // 云絮：几团发光的柔软的圆
      const k = 0.55 + woolLeft * 0.45;
      for (const [bx, byy, br] of [[-0.35, -0.3, 0.42], [0.1, -0.5, 0.5], [0.5, -0.28, 0.4], [-0.05, -0.1, 0.45], [0.35, -0.05, 0.38]]) {
        const cx = s * bx * k;
        const cy = by + s * byy;
        const r = s * br * k;
        const g = ctx.createRadialGradient(cx + r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.6, '#d8e4f4');
        g.addColorStop(1, '#8a9ab8');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TAU);
        ctx.fill();
      }
      glow(ctx, 0, by - s * 0.3, s * 0.9, '#ffffff', 0.25);
    }
    // 黑色长脸、往后的小耳朵
    ctx.fillStyle = '#2a2236';
    ctx.beginPath();
    ctx.ellipse(-s * 0.72, by - s * 0.25, s * 0.2, s * 0.15, -0.5, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-s * 0.55, by - s * 0.4, s * 0.12, s * 0.05, 0.4, 0, TAU);
    ctx.fill();
    eyes(ctx, -s * 0.76, by - s * 0.3, 0.01, s * 0.05, sheared ? '#ffb0d0' : '#fff6d0', -0.3);
  };

  // 风筝怪：发光的菱形风筝，一条长长的光尾
  D.kite = function (ctx, s, t, o) {
    const sway = Math.sin(t * 3.5 + (o.seed || 0));
    ctx.save();
    ctx.globalAlpha = 0.4;
    shadow(ctx, 0, 34, s * 0.6);
    ctx.restore();
    ctx.translate(0, Math.sin(t * 4) * 4 - s * 0.6);
    ctx.rotate(sway * 0.15);
    // 光尾
    ctx.strokeStyle = 'rgba(255,170,210,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.9);
    for (let i = 1; i <= 5; i++) ctx.quadraticCurveTo(s * 0.35 * (i % 2 ? 1 : -1) + sway * 5, s * (0.9 + i * 0.22), s * 0.22 * i, s * (0.9 + i * 0.3));
    ctx.stroke();
    for (let i = 1; i <= 3; i++) dot(ctx, s * 0.22 * i * 1.3, s * (0.9 + i * 0.45), 1.3, ['#ffd27a', '#8ad0ff', '#9aff8a'][i - 1], 0.9);
    // 风筝面：半透明，受光一侧更亮
    const g = ctx.createLinearGradient(s * 0.6, -s * 0.9, -s * 0.6, s * 0.9);
    g.addColorStop(0, 'rgba(255,200,225,0.95)');
    g.addColorStop(1, 'rgba(160,50,100,0.9)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.95);
    ctx.lineTo(s * 0.68, 0);
    ctx.lineTo(0, s * 0.95);
    ctx.lineTo(-s * 0.68, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,250,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.95);
    ctx.lineTo(0, s * 0.95);
    ctx.moveTo(-s * 0.68, 0);
    ctx.lineTo(s * 0.68, 0);
    ctx.stroke();
    eyes(ctx, -s * 0.05, -s * 0.2, s * 0.28, s * 0.06, '#ffffff', -0.1);
  };

  // 雷团子：一团噼啪作响的电光球
  D.thunderBall = function (ctx, s, t, o) {
    const roll = t * 6 + (o.seed || 0);
    shadow(ctx, 0, 2, s * 0.8);
    ctx.translate(0, -s * 0.8 - Math.abs(Math.sin(roll)) * 3);
    glow(ctx, 0, 0, s * 1.4, '#ffd23f', 0.55);
    const g = ctx.createRadialGradient(-s * 0.2, -s * 0.25, s * 0.1, 0, 0, s * 0.8);
    g.addColorStop(0, '#fff8d0');
    g.addColorStop(0.5, '#ffc21f');
    g.addColorStop(1, '#8a5a10');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.72, 0, TAU);
    ctx.fill();
    // 噼啪的小闪电
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,250,200,0.9)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      const a = roll * 0.7 + (i * TAU) / 3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * s * 0.75, Math.sin(a) * s * 0.75);
      ctx.lineTo(Math.cos(a + 0.2) * s * 1.0, Math.sin(a + 0.2) * s * 1.0);
      ctx.lineTo(Math.cos(a + 0.05) * s * 1.2, Math.sin(a + 0.05) * s * 1.2);
      ctx.stroke();
    }
    ctx.restore();
    // 发光的、斜着的眼睛（看起来在生气）
    eyes(ctx, -s * 0.15, -s * 0.08, s * 0.32, s * 0.08, '#ffffff', 0.25);
  };

  // 彩虹鸟：修长的小鸟，身后拖着一条彩虹色的光尾
  D.rainbowBird = function (ctx, s, t, o) {
    const flap = Math.sin(t * 12 + (o.seed || 0));
    ctx.save();
    ctx.globalAlpha = 0.4;
    shadow(ctx, 0, 34, s * 0.6);
    ctx.restore();
    ctx.translate(0, -s * 0.7 + Math.sin(t * 3) * 3);
    // 彩虹尾巴
    const cols = ['#ff7a7a', '#ffb347', '#ffe066', '#7fd67a', '#7ab8ff', '#b48aff'];
    cols.forEach((c, i) => {
      ctx.strokeStyle = rgba(c, 0.75);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s * 0.4, -s * 0.05 + i * 1.5);
      ctx.quadraticCurveTo(s * 1.0, s * 0.1 + i * 2 + flap * 3, s * 1.6, s * 0.0 + i * 2.5 - flap * 3);
      ctx.stroke();
    });
    wing(ctx, s * 0.05, -s * 0.15, s * 0.9, s * 0.4, 0.6 + flap * 0.5, '#bfe8ff');
    ctx.fillStyle = bodyGrad(ctx, -s * 0.6, -s * 0.4, s * 0.6, s * 0.3, '#5aa8e8', 0.1, 0.55);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.48, s * 0.24, -0.1, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-s * 0.45, -s * 0.15, s * 0.2, s * 0.17, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffd27a';
    ctx.beginPath();
    ctx.moveTo(-s * 0.62, -s * 0.15);
    ctx.lineTo(-s * 0.85, -s * 0.1);
    ctx.lineTo(-s * 0.62, -s * 0.06);
    ctx.fill();
    eyes(ctx, -s * 0.5, -s * 0.18, 0.01, s * 0.05, '#ffffff', 0);
    // 治疗的光点
    dot(ctx, -s * 0.2 + Math.sin(t * 2) * s * 0.3, -s * 0.6, 1.3, '#a8ffcf', 0.6 + Math.sin(t * 4) * 0.3);
  };

  // 热气球：条纹气球、下面挂着藤编小篮子，篮子里探出哥布林的头
  D.balloon = function (ctx, s, t, o) {
    const bob = Math.sin(t * 2 + (o.seed || 0)) * 3;
    ctx.save();
    ctx.globalAlpha = 0.4;
    shadow(ctx, 0, 34, s * 0.8);
    ctx.restore();
    ctx.translate(0, bob - s * 0.4);
    // 篮子和绳子
    ctx.strokeStyle = 'rgba(80,60,40,0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, -s * 1.0);
    ctx.lineTo(-s * 0.25, -s * 0.2);
    ctx.moveTo(s * 0.55, -s * 1.0);
    ctx.lineTo(s * 0.25, -s * 0.2);
    ctx.stroke();
    ctx.fillStyle = bodyGrad(ctx, -s * 0.3, -s * 0.25, s * 0.3, s * 0.1, '#8a6a42', 0.3, 0.75);
    ctx.fillRect(-s * 0.3, -s * 0.25, s * 0.6, s * 0.3);
    ctx.fillStyle = deep('#5a8a48', 0.4);
    ctx.beginPath();
    ctx.ellipse(-s * 0.05, -s * 0.3, s * 0.13, s * 0.11, 0, 0, TAU);
    ctx.fill();
    eyes(ctx, -s * 0.1, -s * 0.31, s * 0.08, s * 0.03, '#e8ff9a', -0.2);
    // 气球：橙色条纹，里面的火光让下半部分发亮
    const g = ctx.createRadialGradient(s * 0.3, -s * 2.0, s * 0.1, 0, -s * 1.6, s * 1.0);
    g.addColorStop(0, '#ffd0a0');
    g.addColorStop(0.5, '#e07a30');
    g.addColorStop(1, '#5a2410');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, -s * 1.0);
    ctx.bezierCurveTo(-s * 1.15, -s * 1.5, -s * 0.85, -s * 2.6, 0, -s * 2.6);
    ctx.bezierCurveTo(s * 0.85, -s * 2.6, s * 1.15, -s * 1.5, s * 0.5, -s * 1.0);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (const sx of [-0.5, 0, 0.5]) {
      ctx.strokeStyle = 'rgba(255,240,210,0.35)';
      ctx.lineWidth = s * 0.12;
      ctx.beginPath();
      ctx.moveTo(sx * s * 0.6, -s * 1.0);
      ctx.quadraticCurveTo(sx * s * 1.6, -s * 1.8, sx * s * 0.2, -s * 2.6);
      ctx.stroke();
    }
    ctx.restore();
    glow(ctx, 0, -s * 1.05, s * 0.45, '#ffb050', 0.8);
  };

  // 呼呼：风车脑袋的石头巨人，叶片会转；蓄力大风时叶片转得飞快、全身发光
  D.windGiant = function (ctx, s, t, o) {
    const ai = o.ai || {};
    const warn = ai.mode === 'warn';
    const spin = t * (warn ? 14 : ai.phase === 2 ? 6 : 3);
    const step = Math.sin(t * 3 + (o.seed || 0));
    shadow(ctx, 0, 2, s * 1.1);
    const base = '#8a98aa';
    for (const d of [-1, 1]) {
      ctx.fillStyle = deep(base, d > 0 ? 0.75 : 0.55);
      ctx.beginPath();
      ctx.ellipse(d * s * 0.32 + (d * step * s) / 25, -s * 0.28, s * 0.2, s * 0.3, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = bodyGrad(ctx, -s * 0.75, -s * 1.6, s * 0.75, -s * 0.4, base, 0.25, 0.75);
    ctx.beginPath();
    ctx.moveTo(-s * 0.6, -s * 0.45);
    ctx.quadraticCurveTo(-s * 0.8, -s * 1.1, -s * 0.45, -s * 1.5);
    ctx.lineTo(s * 0.45, -s * 1.5);
    ctx.quadraticCurveTo(s * 0.8, -s * 1.1, s * 0.6, -s * 0.45);
    ctx.closePath();
    ctx.fill();
    rune(ctx, [[-s * 0.3, -s * 1.2], [0, -s * 0.9], [s * 0.3, -s * 1.2]], '#bfe8ff', 1.6, warn ? 0.95 : 0.5);
    eyes(ctx, -s * 0.12, -s * 1.15, s * 0.32, s * 0.07, warn ? '#ffffff' : '#bfe8ff', 0);
    // 风车脑袋
    ctx.save();
    ctx.translate(0, -s * 1.65);
    if (warn) glow(ctx, 0, 0, s * 1.2, '#bfe8ff', 0.5);
    ctx.rotate(spin);
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      const g = ctx.createLinearGradient(0, 0, s * 0.95, 0);
      g.addColorStop(0, i % 2 ? 'rgba(255,240,220,0.9)' : 'rgba(255,170,200,0.9)');
      g.addColorStop(1, 'rgba(255,255,255,0.35)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(s * 0.2, -s * 0.15);
      ctx.lineTo(s * 0.95, -s * 0.22);
      ctx.lineTo(s * 0.95, s * 0.05);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    glow(ctx, 0, -s * 1.65, s * 0.25, '#ffd27a', 0.9, true);
  };

  // 雷雷：一大团翻滚的雷云，生气时更暗、闪电更多
  D.thunderKing = function (ctx, s, t, o) {
    const ai = o.ai || {};
    const angry = ai.phase >= 2;
    const warn = ai.mode === 'warn';
    ctx.save();
    ctx.globalAlpha = 0.5;
    shadow(ctx, 0, 6, s * 1.4);
    ctx.restore();
    ctx.translate(0, -s * 1.3 + Math.sin(t * 2) * 4);
    // 云团下面的闪电
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const n = warn ? 5 : 2;
    for (let i = 0; i < n; i++) {
      const bx = -s + ((i * 0.53 + Math.floor(t * 8) * 0.37) % 1) * s * 2;
      ctx.strokeStyle = 'rgba(255,245,170,0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(bx, s * 0.4);
      ctx.lineTo(bx - 8, s * 0.8);
      ctx.lineTo(bx + 4, s * 0.85);
      ctx.lineTo(bx - 6, s * 1.25);
      ctx.stroke();
    }
    ctx.restore();
    // 一团团云：上亮下暗
    for (const [cx, cy, r] of [[-0.7, 0.05, 0.55], [-0.2, -0.35, 0.7], [0.45, -0.25, 0.62], [0.85, 0.12, 0.45], [0, 0.2, 0.65]]) {
      const g = ctx.createRadialGradient(s * cx + s * r * 0.3, s * cy - s * r * 0.5, s * r * 0.1, s * cx, s * cy, s * r);
      g.addColorStop(0, angry ? '#8a8aa8' : '#c0c8dc');
      g.addColorStop(0.6, angry ? '#3a3a52' : '#6a7490');
      g.addColorStop(1, angry ? '#14141e' : '#2a2e40');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s * cx, s * cy, s * r, 0, TAU);
      ctx.fill();
    }
    // 体内的电光
    glow(ctx, 0, 0, s * 0.9, '#fff3a0', warn ? 0.7 : 0.3);
    // 生气的眉毛和发光的眼睛
    ctx.strokeStyle = '#0a0a14';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, -s * 0.3);
    ctx.lineTo(-s * 0.12, -s * 0.15);
    ctx.moveTo(s * 0.4, -s * 0.3);
    ctx.lineTo(s * 0.02, -s * 0.15);
    ctx.stroke();
    eyes(ctx, -s * 0.05, -s * 0.02, s * 0.45, s * 0.1, '#fff3a0', 0);
  };

  // ======================================================================
  // 第七章 · 珊瑚海湾（设计书 56.4）
  // ======================================================================

  // 螺旋贝壳
  function spiralShell(ctx, x, y, r, base) {
    const g = ctx.createRadialGradient(x + r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, light(base, 0.5));
    g.addColorStop(0.6, base);
    g.addColorStop(1, deep(base, 0.6));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.9, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba('#fff0e0', 0.45);
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath();
    for (let a = 0; a < 9; a++) {
      const rr = r * 0.85 * (1 - a / 10);
      ctx.lineTo(x + Math.cos(a * 0.9) * rr * 0.9, y + Math.sin(a * 0.9) * rr * 0.8);
    }
    ctx.stroke();
  }

  // 寄居蟹：细长的腿、一对大钳子、背上一只发光的螺旋壳；缩壳时只剩壳和一对眼睛
  D.hermitCrab = function (ctx, s, t, o) {
    const hide = !!o.shellIn;
    const ph = t * 10 + (o.seed || 0);
    shadow(ctx, 0, 2, s * 0.85);
    const base = '#d85a3a';
    if (!hide) {
      for (let i = 0; i < 3; i++) {
        const lx = -s * 0.55 + i * s * 0.2;
        const sw = Math.sin(ph + i * 2) * s * 0.08;
        ctx.strokeStyle = deep(base, 0.55);
        ctx.lineWidth = s * 0.07;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(lx, -s * 0.35);
        ctx.lineTo(lx - s * 0.12 + sw, -s * 0.25);
        ctx.lineTo(lx - s * 0.2 + sw, -s * 0.02);
        ctx.stroke();
      }
      ctx.fillStyle = bodyGrad(ctx, -s * 0.8, -s * 0.7, -s * 0.1, -s * 0.2, base, 0.2, 0.68);
      ctx.beginPath();
      ctx.ellipse(-s * 0.4, -s * 0.42, s * 0.38, s * 0.24, -0.1, 0, TAU);
      ctx.fill();
      const snap = o.attack ? Math.abs(Math.sin(t * 10)) * 0.3 : 0;
      for (const [cy, far] of [[-0.6, true], [-0.32, false]]) {
        ctx.save();
        ctx.translate(-s * 0.82, s * cy);
        ctx.rotate(-snap);
        ctx.fillStyle = deep(base, far ? 0.6 : 0.3);
        ctx.beginPath();
        ctx.moveTo(s * 0.1, 0);
        ctx.quadraticCurveTo(-s * 0.2, -s * 0.18, -s * 0.28, 0);
        ctx.quadraticCurveTo(-s * 0.15, s * 0.1, s * 0.1, s * 0.06);
        ctx.fill();
        ctx.restore();
      }
      // 小柄上的眼睛
      ctx.strokeStyle = deep(base, 0.5);
      ctx.lineWidth = 1.5;
      for (const ex of [-0.55, -0.4]) {
        ctx.beginPath();
        ctx.moveTo(s * ex, -s * 0.6);
        ctx.lineTo(s * ex - s * 0.04, -s * 0.9);
        ctx.stroke();
      }
      eyes(ctx, -s * 0.5, -s * 0.92, s * 0.15, s * 0.05, '#ffe0c0', 0);
    }
    const shake = hide ? Math.sin(t * 30) * 1.5 : 0;
    spiralShell(ctx, s * 0.2 + shake, -s * 0.62, s * (hide ? 0.68 : 0.62), '#e8c8a0');
    glow(ctx, s * 0.05, -s * 0.62, s * 0.35, '#ffe8c8', 0.4);
    if (hide) eyes(ctx, -s * 0.32, -s * 0.48, s * 0.14, s * 0.04, '#ffe0c0', 0);
  };

  // 盾龟：大龟壳上有发光的六边形纹路，周围一圈护卫的光
  D.turtle = function (ctx, s, t, o) {
    const step = Math.sin(t * 4 + (o.seed || 0));
    shadow(ctx, 0, 2, s * 1.05);
    const base = '#3a8a5a';
    for (const [fx, ph] of [[-0.55, 1], [-0.2, -1], [0.25, 1], [0.6, -1]]) {
      ctx.fillStyle = deep('#6ab87a', 0.5);
      ctx.beginPath();
      ctx.ellipse(s * fx + step * ph * 2, -s * 0.1, s * 0.16, s * 0.12, 0, 0, TAU);
      ctx.fill();
    }
    // 长脖子和头
    ctx.fillStyle = bodyGrad(ctx, -s * 1.3, -s * 0.8, -s * 0.6, -s * 0.2, '#6ab87a', 0.25, 0.65);
    ctx.beginPath();
    ctx.moveTo(-s * 0.6, -s * 0.35);
    ctx.quadraticCurveTo(-s * 0.85, -s * 0.6 + step, -s * 1.05, -s * 0.55 + step);
    ctx.quadraticCurveTo(-s * 1.25, -s * 0.5 + step, -s * 1.1, -s * 0.35 + step);
    ctx.quadraticCurveTo(-s * 0.85, -s * 0.3, -s * 0.6, -s * 0.2);
    ctx.fill();
    eyes(ctx, -s * 1.08, -s * 0.5 + step, 0.01, s * 0.05, '#c8ffd8', -0.2);
    // 龟壳
    ctx.fillStyle = bodyGrad(ctx, -s * 0.8, -s * 1.4, s * 0.85, -s * 0.2, base, 0.25, 0.75);
    ctx.beginPath();
    ctx.moveTo(-s * 0.8, -s * 0.25);
    ctx.bezierCurveTo(-s * 0.8, -s * 1.35, s * 0.85, -s * 1.35, s * 0.85, -s * 0.25);
    ctx.closePath();
    ctx.fill();
    // 发光的六边形纹路
    for (const [hx, hy, hr] of [[0, -0.75, 0.22], [-0.45, -0.5, 0.17], [0.45, -0.5, 0.17]]) {
      const pts = [];
      for (let a = 0; a <= 6; a++) pts.push([s * hx + Math.cos((a * Math.PI) / 3) * s * hr, s * hy + Math.sin((a * Math.PI) / 3) * s * hr]);
      rune(ctx, pts, '#8affc8', 1.4, 0.6 + Math.sin(t * 2) * 0.15);
    }
  };

  // 飞鱼：修长的鱼身、一对长长的透明胸鳍，跳起来时翅膀张开
  D.flyingFish = function (ctx, s, t, o) {
    const flap = Math.sin(t * (o.leap ? 30 : 8) + (o.seed || 0));
    if (!o.leap) shadow(ctx, 0, 2, s * 0.8);
    ctx.save();
    ctx.translate(0, -s * 0.7);
    if (o.leap) ctx.rotate(-0.3 + Math.min(1, Math.max(0, o.leap)) * 0.6);
    const base = '#3a8ad8';
    // 尾鳍
    ctx.fillStyle = deep(base, 0.5);
    ctx.beginPath();
    ctx.moveTo(s * 0.55, 0);
    ctx.lineTo(s * 1.05, -s * 0.4);
    ctx.quadraticCurveTo(s * 0.9, 0, s * 1.05, s * 0.4);
    ctx.closePath();
    ctx.fill();
    // 胸鳍（像翅膀）
    wing(ctx, -s * 0.05, -s * 0.05, s * (o.leap ? 1.0 : 0.6), s * 0.35, 1.2 + flap * 0.3, '#bfe8ff');
    ctx.fillStyle = bodyGrad(ctx, -s * 0.7, -s * 0.35, s * 0.7, s * 0.35, base, 0.15, 0.62);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.68, s * 0.28, 0, 0, TAU);
    ctx.fill();
    // 银色的肚子
    ctx.fillStyle = 'rgba(220,240,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.05, s * 0.12, s * 0.5, s * 0.1, 0, 0, TAU);
    ctx.fill();
    // 侧线发光
    rune(ctx, [[-s * 0.45, -s * 0.02], [s * 0.5, -s * 0.02]], '#9fe8ff', 1.2, 0.6);
    eyes(ctx, -s * 0.45, -s * 0.06, 0.01, s * 0.06, '#e8ffff', 0);
    ctx.restore();
  };

  // 海胆：紫色的刺球，刺尖发光
  D.urchin = function (ctx, s, t, o) {
    const roll = t * 2 + (o.seed || 0);
    shadow(ctx, 0, 2, s * 0.8);
    ctx.save();
    ctx.translate(0, -s * 0.75 - Math.abs(Math.sin(roll * 2)) * 1.5);
    for (let i = 0; i < 16; i++) {
      const a = roll * 0.3 + (i * TAU) / 16;
      const len = i % 2 ? 1.05 : 1.25;
      ctx.strokeStyle = deep('#8a5ac8', 0.5);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5);
      ctx.lineTo(Math.cos(a) * s * len, Math.sin(a) * s * len);
      ctx.stroke();
      if (i % 2 === 0) dot(ctx, Math.cos(a) * s * len, Math.sin(a) * s * len, 0.9, '#e0b0ff', 0.7);
    }
    ctx.fillStyle = bodyGrad(ctx, -s * 0.6, -s * 0.6, s * 0.6, s * 0.6, '#8a5ac8', 0.2, 0.7);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.6, 0, TAU);
    ctx.fill();
    eyes(ctx, -s * 0.15, -s * 0.05, s * 0.28, s * 0.07, '#f0d8ff', -0.1);
    ctx.restore();
  };

  // 海马：卷尾巴、长嘴，背鳍轻轻扇动，嘴边冒出发光的泡泡
  D.seahorse = function (ctx, s, t, o) {
    const bob = Math.sin(t * 3 + (o.seed || 0)) * 3;
    shadow(ctx, 0, 2, s * 0.6);
    ctx.save();
    ctx.translate(0, bob);
    const base = '#e0a020';
    // 卷尾巴
    ctx.strokeStyle = deep(base, 0.45);
    ctx.lineWidth = s * 0.18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(s * 0.12, -s * 0.38, s * 0.22, -Math.PI * 0.5, Math.PI * 1.2);
    ctx.stroke();
    // 弯弯的身体（S 形）
    ctx.fillStyle = bodyGrad(ctx, -s * 0.4, -s * 1.8, s * 0.5, -s * 0.5, base, 0.15, 0.62);
    ctx.beginPath();
    ctx.moveTo(s * 0.32, -s * 0.6);
    ctx.quadraticCurveTo(s * 0.45, -s * 1.1, s * 0.2, -s * 1.45);
    ctx.quadraticCurveTo(-s * 0.1, -s * 1.75, -s * 0.2, -s * 1.5);
    ctx.quadraticCurveTo(-s * 0.3, -s * 1.1, -s * 0.05, -s * 0.6);
    ctx.closePath();
    ctx.fill();
    // 背鳍
    const fin = Math.sin(t * 14) * s * 0.05;
    ctx.fillStyle = 'rgba(255,230,150,0.55)';
    ctx.beginPath();
    ctx.moveTo(s * 0.38, -s * 1.15);
    ctx.quadraticCurveTo(s * 0.7 + fin, -s * 0.95, s * 0.4, -s * 0.75);
    ctx.fill();
    // 头和长嘴
    ctx.fillStyle = bodyGrad(ctx, -s * 0.5, -s * 1.85, s * 0.2, -s * 1.35, base, 0.1, 0.55);
    ctx.beginPath();
    ctx.ellipse(-s * 0.08, -s * 1.6, s * 0.24, s * 0.2, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 0.25, -s * 1.62);
    ctx.lineTo(-s * 0.65, -s * 1.52);
    ctx.lineTo(-s * 0.62, -s * 1.44);
    ctx.lineTo(-s * 0.22, -s * 1.48);
    ctx.fill();
    // 头冠小刺
    ctx.beginPath();
    ctx.moveTo(-s * 0.05, -s * 1.78);
    ctx.lineTo(s * 0.02, -s * 1.95);
    ctx.lineTo(s * 0.1, -s * 1.76);
    ctx.fill();
    eyes(ctx, -s * 0.12, -s * 1.64, 0.01, s * 0.05, '#fff6d0', 0);
    ctx.restore();
    // 发光的泡泡
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.8 + i / 3 + (o.seed || 0) * 0.13) % 1;
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = 'rgba(160,230,255,0.9)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(-s * 0.7 - p * s * 0.2, -s * 1.5 - p * s * 1.2 + bob, s * (0.05 + p * 0.08), 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  };

  // 触手：从沙里伸出来的长触手，吸盘发光
  D.tentacle = function (ctx, s, t, o) {
    const sway = Math.sin(t * 2.5 + (o.seed || 0)) * s * 0.35;
    const slap = o.attack ? Math.max(0, Math.sin(t * 3)) : 0;
    ctx.fillStyle = 'rgba(80,60,40,0.5)';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.9, s * 0.22, 0, 0, TAU);
    ctx.fill();
    const base = '#a03a7a';
    ctx.fillStyle = bodyGrad(ctx, -s * 0.6, -s * 2.5, s * 0.6, 0, base, 0.2, 0.7);
    ctx.beginPath();
    ctx.moveTo(-s * 0.42, 0);
    ctx.quadraticCurveTo(-s * 0.5 + sway, -s * 1.3, -s * 0.3 + sway - slap * s * 0.5, -s * 2.4);
    ctx.quadraticCurveTo(-s * 0.05 + sway, -s * 2.5, s * 0.05 + sway, -s * 2.2);
    ctx.quadraticCurveTo(s * 0.2 + sway * 0.6, -s * 1.2, s * 0.42, 0);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      const k = i / 4;
      dot(ctx, -s * 0.22 + sway * k * 0.9, -s * (0.35 + k * 1.6), Math.max(1, s * (0.08 - k * 0.015)), '#ffb0e0', 0.75);
    }
  };

  // 贝贝：巨大的珍珠贝；张壳时露出一颗发光的珍珠
  D.pearlClam = function (ctx, s, t, o) {
    const ai = o.ai || {};
    const open = !!ai.open;
    const ang = open ? 0.55 + Math.sin(t * 4) * 0.04 : 0.04;
    shadow(ctx, 0, 2, s * 1.3);
    const base = '#e07aa8';
    // 下壳
    ctx.fillStyle = bodyGrad(ctx, -s * 1.15, -s * 0.5, s * 1.15, 0, base, 0.25, 0.72);
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.45, s * 1.15, s * 0.5, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    if (open) {
      glow(ctx, -s * 0.15, -s * 0.62, s * 0.9, '#fff0f8', 0.85, true);
      const pg = ctx.createRadialGradient(-s * 0.25, -s * 0.72, s * 0.04, -s * 0.15, -s * 0.62, s * 0.3);
      pg.addColorStop(0, '#ffffff');
      pg.addColorStop(1, '#f0c8e0');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(-s * 0.15, -s * 0.62, s * 0.28, 0, TAU);
      ctx.fill();
    }
    // 上壳（从右边的铰链处打开），一道道发光的放射纹
    ctx.save();
    ctx.translate(s * 1.05, -s * 0.45);
    ctx.rotate(ang);
    ctx.translate(-s * 1.05, s * 0.45);
    ctx.fillStyle = bodyGrad(ctx, -s * 1.15, -s * 1.3, s * 1.15, -s * 0.45, base, 0.15, 0.62);
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.45, s * 1.15, s * 0.85, 0, Math.PI, TAU);
    ctx.closePath();
    ctx.fill();
    for (let i = 1; i < 6; i++) {
      const a = Math.PI + (i * Math.PI) / 6;
      rune(ctx, [[0, -s * 0.45], [Math.cos(a) * s * 1.05, -s * 0.45 + Math.sin(a) * s * 0.78]], '#ffd0e8', 1.2, 0.35);
    }
    eyes(ctx, -s * 0.35, -s * 0.85, s * 0.42, s * 0.08, '#fff0f8', 0);
    ctx.restore();
  };

  // 波波：章鱼大王，大脑袋上发光的斑点、一顶小王冠；大漩涡时眼睛变红
  D.octoKing = function (ctx, s, t, o) {
    const ai = o.ai || {};
    const angry = ai.phase >= 3;
    shadow(ctx, 0, 2, s * 1.4);
    const base = '#b04a8a';
    // 腿
    for (let i = 0; i < 6; i++) {
      const x0 = -s * 0.85 + i * s * 0.34;
      const w = Math.sin(t * 3 + i) * s * 0.22;
      ctx.strokeStyle = deep(base, 0.45 + (i % 2) * 0.2);
      ctx.lineWidth = s * 0.22;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x0, -s * 0.6);
      ctx.quadraticCurveTo(x0 + w, -s * 0.25, x0 + w * 1.6 - s * 0.15, -s * 0.05);
      ctx.stroke();
    }
    // 大脑袋
    ctx.fillStyle = bodyGrad(ctx, -s * 1.0, -s * 2.3, s * 1.0, -s * 0.4, base, 0.15, 0.68);
    ctx.beginPath();
    ctx.ellipse(0, -s * 1.3, s * 1.0, s * 0.95, 0, 0, TAU);
    ctx.fill();
    for (const [px, py, r] of [[0.45, -1.75, 2.2], [0.62, -1.35, 1.6], [-0.55, -1.75, 1.5], [0.15, -2.0, 1.4]]) dot(ctx, s * px, s * py, r, '#ffb0e0', 0.8);
    eyes(ctx, -s * 0.2, -s * 1.2, s * 0.6, s * 0.12, angry ? '#ff6a6a' : '#ffe0f0', angry ? 0.25 : 0);
    // 发光的小王冠
    glow(ctx, 0, -s * 2.3, s * 0.6, '#ffd27a', 0.6);
    ctx.fillStyle = '#ffd96a';
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, -s * 2.12);
    ctx.lineTo(-s * 0.35, -s * 2.45);
    ctx.lineTo(-s * 0.18, -s * 2.28);
    ctx.lineTo(0, -s * 2.5);
    ctx.lineTo(s * 0.18, -s * 2.28);
    ctx.lineTo(s * 0.35, -s * 2.45);
    ctx.lineTo(s * 0.35, -s * 2.12);
    ctx.closePath();
    ctx.fill();
  };
})((globalThis.TD = globalThis.TD || {}));
