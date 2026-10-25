// 第一章 · 翠绿草原（设计书 56.4、60.3）的怪物画法：工具函数（发光、眼睛、符文、胶质、四足、细节笔触……）在 creatures.js
(function (TD) {
  'use strict';

  const K = TD.creatures;
  const D = K.drawers;
  const TAU = Math.PI * 2;
  const { deep, light, rgba, bodyGrad, glow, shadow, eyes, rune, dot, wing, jelly, jellyEyes, quadruped, seeded, strokes, speckle, scales, veins, sparkles, rimEdge, linear, radial } = K;

  // ---------- 本章用的小工具 ----------
  // 只在轮廓里面画：path 画轮廓，fn 画内容
  function inside(ctx, path, fn) {
    ctx.save();
    path();
    ctx.clip();
    fn();
    ctx.restore();
  }
  // 背光一侧压暗（光从右上来）：在矩形范围里从右上透明过渡到左下深色，配合 inside 使用
  function shade(ctx, x0, y0, x1, y1, a) {
    ctx.fillStyle = linear(ctx, x1, y0, x0, y1, [[0.3, 'rgba(4,8,22,0)'], [1, 'rgba(4,8,22,' + (a === undefined ? 0.45 : a) + ')']]);
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  // 椭圆轮廓（给 inside / rimEdge 用）
  const oval = (ctx, x, y, rx, ry, rot) => () => {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
  };

  // 胶质身体（设计书 60.3）：半透明的胶 + 背光一侧更深 + 光核和折射光圈 + 上浮的小气泡 + 底部透光 + 两层高光 + 轮廓光
  // nb：气泡个数；inner(w, h, lean)：在胶体里面（高光之下）再画点东西
  function gel(ctx, s, t, o, base, core, tall, nb, inner) {
    const sd = o.seed || 0;
    const wob = Math.sin(t * 5 + sd) * 0.07;
    const bite = o.attack ? Math.max(0, Math.sin(t * 11)) * 0.1 : 0;
    const w = s * (1.0 + wob + bite);
    const h = s * (tall || 0.95) * (1 - wob - bite * 0.5);
    const lean = Math.sin(t * 2.5 + sd) * w * 0.08;
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(-w * 1.05, 0);
      ctx.bezierCurveTo(-w * 1.02, -h * 0.55, -w * 0.7 + lean, -h * 1.15, -w * 0.05 + lean, -h * 1.18);
      ctx.bezierCurveTo(w * 0.62 + lean, -h * 1.15, w * 1.0, -h * 0.6, w * 1.02, 0);
      ctx.quadraticCurveTo(0, h * 0.16, -w * 1.05, 0);
      ctx.closePath();
    };
    path();
    ctx.fillStyle = radial(ctx, 0, -h * 0.5, h * 0.1, w * 1.2, [[0, rgba(core, 0.9)], [0.35, deep(base, 0.35)], [1, deep(base, 0.72)]], w * 0.25 + lean, -h);
    ctx.globalAlpha = 0.86;
    ctx.fill();
    ctx.globalAlpha = 1;
    inside(ctx, path, () => {
      shade(ctx, -w * 1.1, -h * 1.2, w * 1.1, h * 0.1, 0.5);
      // 光核：一团光 + 折射出来的两圈光环
      const cx = w * 0.1 + lean * 0.5;
      const cy = -h * 0.4;
      const pulse = Math.sin(t * 3 + sd);
      glow(ctx, cx, cy, w * 0.75, core, 0.6 + pulse * 0.12, true);
      ctx.lineWidth = Math.max(0.8, s * 0.035);
      ctx.strokeStyle = rgba(core, 0.28);
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * (0.34 + pulse * 0.03), h * 0.2, -0.15, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = rgba(core, 0.16);
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * (0.52 + pulse * 0.04), h * 0.3, -0.15, 0.4, 2.6);
      ctx.stroke();
      // 上浮的小气泡：越往上越大，快到顶时淡出
      const r = seeded(7 + nb);
      for (let i = 0; i < nb; i++) {
        const bx0 = (r() - 0.5) * w * 1.4;
        const k = (t * (0.18 + r() * 0.22) + r()) % 1;
        const bx = bx0 * (1 - k * 0.45) + lean * k;
        const by = -h * (0.1 + k * 0.85);
        const br = s * (0.03 + r() * 0.045) * (0.7 + k * 0.4);
        const a = Math.sin(k * Math.PI);
        ctx.fillStyle = rgba(core, 0.18 * a);
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.45 * a).toFixed(3) + ')';
        ctx.lineWidth = Math.max(0.6, br * 0.3);
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,' + (0.8 * a).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(bx + br * 0.35, by - br * 0.35, br * 0.3, 0, TAU);
        ctx.fill();
      }
      if (inner) inner(w, h, lean);
      // 底部透光：脚下的光从胶里透上来
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = linear(ctx, 0, h * 0.1, 0, -h * 0.4, [[0, rgba(core, 0.4)], [1, rgba(core, 0)]]);
      ctx.fillRect(-w * 1.1, -h * 0.4, w * 2.2, h * 0.5);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = rgba(core, 0.35);
      ctx.lineWidth = Math.max(1, s * 0.08);
      ctx.beginPath();
      ctx.moveTo(-w * 0.7, -h * 0.06);
      ctx.quadraticCurveTo(0, h * 0.12, w * 0.7, -h * 0.06);
      ctx.stroke();
      // 两层高光：顶上一片柔光 + 一道亮弧和一个亮点；背光一侧还有一道淡淡的反光
      ctx.fillStyle = radial(ctx, w * 0.2 + lean, -h * 0.95, 0, w * 0.55, [[0, 'rgba(255,255,255,0.2)'], [1, 'rgba(255,255,255,0)']]);
      ctx.fillRect(-w * 0.4, -h * 1.3, w * 1.3, h * 0.9);
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = Math.max(1.2, w * 0.06);
      ctx.beginPath();
      ctx.arc(w * 0.05 + lean, -h * 0.62, h * 0.42, -1.2, -0.4);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.arc(w * 0.05 + lean + h * 0.42, -h * 0.55, Math.max(0.8, w * 0.035), 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = Math.max(0.8, w * 0.04);
      ctx.beginPath();
      ctx.arc(lean, -h * 0.5, w * 0.82, 2.45, 3.0);
      ctx.stroke();
    });
    rimEdge(ctx, path, core, 0.45, Math.max(1.2, s * 0.08), s * 0.06, s * 0.06);
    return { w, h, lean, path };
  }

  // 小嫩芽：一根细茎 + 两片叶子（叶脉发光）
  function sprout(ctx, x, y, len, ang, col, glowCol) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.strokeStyle = deep(col, 0.35);
    ctx.lineWidth = len * 0.12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, len * 0.15);
    ctx.quadraticCurveTo(len * 0.12, -len * 0.4, 0, -len * 0.72);
    ctx.stroke();
    for (const [a, L] of [[-2.55, len * 0.6], [-0.45, len * 0.5]]) {
      ctx.save();
      ctx.translate(0, -len * 0.7);
      ctx.rotate(a);
      ctx.fillStyle = linear(ctx, 0, 0, L, 0, [[0, deep(col, 0.45)], [1, light(col, 0.1)]]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(L * 0.5, -L * 0.38, L, 0);
      ctx.quadraticCurveTo(L * 0.5, L * 0.32, 0, 0);
      ctx.fill();
      rune(ctx, [[L * 0.08, 0], [L * 0.85, -L * 0.02]], glowCol, Math.max(0.6, L * 0.06), 0.55);
      ctx.restore();
    }
    ctx.restore();
  }

  // ======================================================================
  // 第一章 · 翠绿草原（设计书 56.4、60.3）
  // ======================================================================

  D.slime = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    shadow(ctx, 0, 2, s);
    const g = gel(ctx, s, t, o, '#3aa860', '#c8ffb0', 0.95, 6);
    jellyEyes(ctx, -s * 0.38 + g.lean * 0.6, -g.h * 0.68, s * 0.3, s * 0.1);
    // 头顶的小嫩芽：草原史莱姆的标志，跟着身体摇
    sprout(ctx, g.lean - g.w * 0.05, -g.h * 1.13, s * 0.3, Math.sin(t * 3 + sd) * 0.25 + 0.1, '#6ad060', '#e0ffb0');
    // 漂在身边的小孢子
    sparkles(ctx, 0, -g.h * 0.85, s * 0.95, s * 0.32, 3, t + sd, '#c8ffb0', 11, 1.1);
  };

  D.minijelly = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    shadow(ctx, 0, 2, s);
    const g = gel(ctx, s, t, o, '#3a8ad8', '#bfe8ff', 0.95, 4);
    jellyEyes(ctx, -s * 0.38 + g.lean * 0.6, -g.h * 0.68, s * 0.3, s * 0.11);
    // 头顶翘起一缕往后弯的小胶尖，末端挂一颗光珠，一弹一弹
    const tx = g.lean - g.w * 0.05;
    const ty = -g.h * 1.12;
    const sw = Math.sin(t * 4 + sd) * s * 0.06;
    ctx.strokeStyle = rgba('#5aa8f0', 0.8);
    ctx.lineWidth = s * 0.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tx, ty + s * 0.05);
    ctx.quadraticCurveTo(tx + s * 0.02, ty - s * 0.18, tx + s * 0.22 + sw, ty - s * 0.16 + sw * 0.5);
    ctx.stroke();
    dot(ctx, tx + s * 0.22 + sw, ty - s * 0.16 + sw * 0.5, s * 0.07, '#bfe8ff', 0.95);
    sparkles(ctx, 0, -g.h * 0.8, s * 0.9, s * 0.3, 2, t + sd, '#bfe8ff', 5, 0.9);
  };

  // 绕着果冻王子转的小胶珠
  function orb(ctx, x, y, r, base, core) {
    glow(ctx, x, y, r * 2.6, core, 0.35);
    ctx.fillStyle = radial(ctx, x, y, 0, r, [[0, rgba(core, 0.9)], [0.5, deep(base, 0.3)], [1, deep(base, 0.62)]], x + r * 0.35, y - r * 0.35);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.arc(x + r * 0.35, y - r * 0.4, r * 0.24, 0, TAU);
    ctx.fill();
  }

  D.jellyPrince = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    const base = '#2a7ad0';
    const core = '#bfe4ff';
    const gold = '#ffe9a0';
    shadow(ctx, 0, 2, s * 1.1);
    // 三颗小胶珠绕着身体转：转到身后的先画（透过胶体能看见），转到身前的后画
    const orbs = [];
    for (let i = 0; i < 3; i++) {
      const a = t * 0.9 + (i * TAU) / 3 + sd;
      orbs.push([Math.cos(a) * s * 1.22, -s * 0.6 + Math.sin(a * 2) * s * 0.1 - Math.sin(a) * s * 0.18, Math.sin(a), s * (0.1 + 0.025 * Math.sin(a))]);
    }
    for (const [x, y, z, r] of orbs) if (z > 0) orb(ctx, x, y, r, base, core);
    const g = gel(ctx, s, t, o, base, core, 1.1, 9, (w, h, lean) => {
      // 体内星星点点的光屑
      speckle(ctx, lean * 0.5, -h * 0.55, w * 0.8, h * 0.42, 14, core, 0.5, 21, s * 0.012, s * 0.026, 0.22);
      // 光核是一颗晶体，向外伸出分叉的光丝
      const cx = w * 0.1 + lean * 0.5;
      const cy = -h * 0.4;
      const p = 0.5 + 0.5 * Math.sin(t * 3 + sd);
      for (let i = 0; i < 5; i++) veins(ctx, cx, cy, s * 0.3, -Math.PI / 2 + (i - 2) * 0.95 + Math.sin(t * 0.7 + i) * 0.12, 1, core, 0.2 + p * 0.15, 30 + i, s * 0.025);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.sin(t * 1.5 + sd) * 0.15);
      const R = s * 0.15;
      ctx.fillStyle = 'rgba(150,205,255,0.85)';
      ctx.beginPath();
      ctx.moveTo(0, -R * 1.3);
      ctx.lineTo(-R * 0.75, -R * 0.2);
      ctx.lineTo(0, R);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(245,252,255,0.95)';
      ctx.beginPath();
      ctx.moveTo(0, -R * 1.3);
      ctx.lineTo(R * 0.75, -R * 0.2);
      ctx.lineTo(0, R);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      glow(ctx, cx, cy, s * 0.45, core, 0.35 + p * 0.3, true);
      // 背上斜挎一条金边绶带，绶带上一枚发光的勋章（高光会盖在它上面，像贴在胶面上）
      const sash = (dy) => {
        ctx.beginPath();
        ctx.moveTo(w * 0.05 + lean, -h * 1.17 + dy);
        ctx.quadraticCurveTo(w * 0.6 + lean * 0.5, -h * 0.75 + dy, w * 0.95, -h * 0.05 + dy);
      };
      ctx.lineCap = 'butt';
      sash(0);
      ctx.strokeStyle = rgba('#d8486a', 0.85);
      ctx.lineWidth = s * 0.15;
      ctx.stroke();
      ctx.strokeStyle = rgba('#5a0a2a', 0.35);
      ctx.lineWidth = s * 0.05;
      sash(s * 0.04);
      ctx.stroke();
      ctx.strokeStyle = rgba(gold, 0.8);
      ctx.lineWidth = Math.max(0.8, s * 0.022);
      sash(-s * 0.07);
      ctx.stroke();
      sash(s * 0.07);
      ctx.stroke();
      const mx = w * 0.36 + lean * 0.7;
      const my = -h * 0.88;
      ctx.fillStyle = linear(ctx, mx + s * 0.06, my - s * 0.06, mx - s * 0.06, my + s * 0.06, [[0, '#fff6c8'], [1, '#c89030']]);
      ctx.beginPath();
      ctx.arc(mx, my, s * 0.07, 0, TAU);
      ctx.fill();
      dot(ctx, mx, my, s * 0.03, '#ff8ab0', 0.9);
    });
    for (const [x, y, z, r] of orbs) if (z <= 0) orb(ctx, x, y, r, base, core);
    jellyEyes(ctx, -s * 0.36 + g.lean * 0.6, -g.h * 0.68, s * 0.3, s * 0.09);
    // 漂浮的光晶冠：一圈金色冠环托着五片双色晶体，中间那片嵌一颗粉色宝石
    const crownY = -g.h * 1.45;
    const cb = Math.sin(t * 2) * s * 0.03;
    glow(ctx, 0, crownY - s * 0.1, s * 0.7, gold, 0.35);
    const band = (a0, a1, col, w) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.ellipse(0, crownY - s * 0.2 + cb, s * 0.4, s * 0.07, 0, a0, a1);
      ctx.stroke();
    };
    band(Math.PI, TAU, rgba(gold, 0.45), Math.max(0.8, s * 0.035));
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.32;
      const bobc = cb + Math.sin(t * 2.6 + i) * s * 0.02;
      const cx = Math.sin(a) * s * 0.55;
      const cy = crownY - Math.cos(a) * s * 0.25 + bobc;
      const ch = s * (i === 2 ? 0.42 : 0.28);
      glow(ctx, cx, cy - ch * 0.4, ch * 1.2, gold, 0.55);
      ctx.fillStyle = 'rgba(230,180,80,0.92)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - ch);
      ctx.lineTo(cx - ch * 0.22, cy - ch * 0.35);
      ctx.lineTo(cx, cy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,248,215,0.95)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - ch);
      ctx.lineTo(cx + ch * 0.22, cy - ch * 0.35);
      ctx.lineTo(cx, cy);
      ctx.closePath();
      ctx.fill();
      if (i === 2) dot(ctx, cx, cy - ch * 0.38, s * 0.035, '#ff8ab0', 0.95);
    }
    // 冠环前半圈压在晶体根部，上面一道亮线
    band(0, Math.PI, 'rgba(232,180,80,0.95)', Math.max(1, s * 0.06));
    band(0.4, 2.7, 'rgba(255,250,220,0.7)', Math.max(0.6, s * 0.018));
    sparkles(ctx, 0, crownY - s * 0.2, s * 0.6, s * 0.22, 4, t + sd, gold, 17, 1.3);
  };

  D.bunny = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    const run = o.attack ? 0.4 : 1.4;
    const ph = t * 12 * run + sd;
    const leap = Math.max(0, Math.sin(ph)) * s * (o.attack ? 0.1 : 0.45);
    shadow(ctx, 0, 2, s * 0.9);
    const base = '#c47aa0';
    const hi = '#ffc0e0';
    const fur = '#f2b8d6';
    const rim = '#ffd8ec';
    // 奔跑时脚后扬起的一串光尘
    if (!o.attack) {
      for (let i = 0; i < 3; i++) {
        const k = (t * 1.6 + i / 3) % 1;
        dot(ctx, s * (0.75 + k * 0.9), -s * (0.06 + k * 0.28), s * 0.05 * (1 - k * 0.6), hi, (1 - k) * 0.6);
      }
    }
    ctx.save();
    ctx.translate(0, -leap);
    const stretch = 1 + Math.sin(ph) * 0.15;
    // 远侧前腿（更暗）
    ctx.strokeStyle = deep(base, 0.82);
    ctx.lineWidth = s * 0.08;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, -s * 0.48);
    ctx.lineTo(-s * 0.45 + Math.sin(ph) * s * 0.2, -s * 0.06);
    ctx.stroke();
    // 后腿（长而有力）：大腿 + 长脚掌，大腿上有毛
    ctx.save();
    ctx.translate(s * 0.55, -s * 0.35);
    ctx.rotate(0.5 + Math.sin(ph) * 0.4);
    ctx.fillStyle = deep(base, 0.78);
    ctx.beginPath();
    ctx.ellipse(s * 0.32 * stretch, s * 0.12, s * 0.2, s * 0.07, 0.4, 0, TAU);
    ctx.fill();
    const thigh = oval(ctx, 0, 0, s * 0.42 * stretch, s * 0.22, 0);
    thigh();
    ctx.fillStyle = linear(ctx, 0, -s * 0.22, 0, s * 0.22, [[0, deep(base, 0.45)], [1, deep(base, 0.82)]]);
    ctx.fill();
    inside(ctx, thigh, () => strokes(ctx, 0, -s * 0.03, s * 0.36, s * 0.16, 12, fur, 0.28, 3, 0.1, s * 0.12));
    ctx.restore();
    // 身体：流线型
    const bodyP = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.75, -s * 0.75);
      ctx.bezierCurveTo(-s * 0.55, -s * 1.15, s * 0.5, -s * 1.05 * stretch, s * 0.85, -s * 0.6);
      ctx.bezierCurveTo(s * 0.9, -s * 0.25, s * 0.2, -s * 0.2, -s * 0.4, -s * 0.38);
      ctx.closePath();
    };
    bodyP();
    ctx.fillStyle = bodyGrad(ctx, -s, -s * 1.1, s, -s * 0.2, base);
    ctx.fill();
    inside(ctx, bodyP, () => {
      // 浅色的肚皮和胸口软毛
      ctx.fillStyle = rgba(fur, 0.22);
      ctx.beginPath();
      ctx.ellipse(-s * 0.05, -s * 0.3, s * 0.6, s * 0.16, -0.08, 0, TAU);
      ctx.fill();
      ctx.fillStyle = radial(ctx, -s * 0.62, -s * 0.6, 0, s * 0.26, [[0, rgba('#ffe6f2', 0.5)], [1, rgba('#ffe6f2', 0)]]);
      ctx.fillRect(-s * 0.9, -s * 0.9, s * 0.56, s * 0.56);
      shade(ctx, -s * 0.8, -s * 1.1, s * 0.9, -s * 0.2, 0.4);
      // 背上一道柔和的毛光泽
      ctx.strokeStyle = rgba(fur, 0.22);
      ctx.lineWidth = s * 0.12;
      ctx.beginPath();
      ctx.moveTo(-s * 0.45, -s * 0.92);
      ctx.bezierCurveTo(-s * 0.1, -s * 1.02, s * 0.45, -s * 0.95, s * 0.72, -s * 0.66);
      ctx.stroke();
      // 毛：短短的浅色笔触顺着往后梳（背上和胸口）
      strokes(ctx, s * 0.05, -s * 0.74, s * 0.65, s * 0.2, 18, fur, 0.24, 5, -0.1, s * 0.1);
      strokes(ctx, -s * 0.6, -s * 0.58, s * 0.12, s * 0.12, 6, '#ffe6f2', 0.35, 8, 2.3, s * 0.08);
      // 胯上一道发光的弯纹
      rune(ctx, [[s * 0.35, -s * 0.84], [s * 0.55, -s * 0.86], [s * 0.7, -s * 0.73], [s * 0.68, -s * 0.55]], hi, s * 0.045, 0.5);
    });
    rimEdge(ctx, bodyP, rim, 0.4, s * 0.08, s * 0.06, s * 0.06);
    // 毛边：肚皮下沿几撮往下垂的毛，胸前一撮蓬起来的浅色软毛
    ctx.fillStyle = deep(base, 0.42);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const x = -s * 0.24 + i * s * 0.16;
      const y = -s * 0.33 + Math.abs(x - s * 0.1) * 0.12;
      ctx.moveTo(x - s * 0.05, y - s * 0.02);
      ctx.quadraticCurveTo(x + s * 0.02, y + s * 0.02, x + s * 0.07, y + s * 0.06);
      ctx.quadraticCurveTo(x + s * 0.05, y + s * 0.01, x + s * 0.06, y - s * 0.04);
    }
    ctx.fill();
    ctx.fillStyle = linear(ctx, -s * 0.5, -s * 0.7, -s * 0.64, -s * 0.4, [[0, rgba('#ffd8ec', 0.75)], [1, rgba('#95758d', 0.5)]]);
    ctx.beginPath();
    ctx.moveTo(-s * 0.48, -s * 0.7);
    ctx.quadraticCurveTo(-s * 0.64, -s * 0.64, -s * 0.68, -s * 0.52);
    ctx.lineTo(-s * 0.63, -s * 0.53);
    ctx.lineTo(-s * 0.63, -s * 0.43);
    ctx.lineTo(-s * 0.57, -s * 0.48);
    ctx.lineTo(-s * 0.52, -s * 0.4);
    ctx.quadraticCurveTo(-s * 0.47, -s * 0.52, -s * 0.4, -s * 0.54);
    ctx.closePath();
    ctx.fill();
    // 背上两颗小光点
    for (const [px, py] of [[-0.2, -0.9], [0.18, -0.9]]) dot(ctx, s * px, s * py, s * 0.035, hi, 0.65);
    // 尾巴：一团蓬松的小毛球（一圈小绒团 + 亮心），跟着跳动抖一抖
    const tx = s * 0.85 + Math.sin(ph) * s * 0.03;
    const ty = -s * 0.7 - Math.cos(ph) * s * 0.03;
    glow(ctx, tx, ty, s * 0.32, rim, 0.45);
    ctx.fillStyle = radial(ctx, tx, ty, 0, s * 0.17, [[0, '#fff4fa'], [0.6, '#f6c8e0'], [1, deep(fur, 0.3)]], tx + s * 0.04, ty - s * 0.04);
    ctx.beginPath();
    ctx.arc(tx, ty, s * 0.09, 0, TAU);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + Math.sin(ph + i) * 0.08;
      const x = tx + Math.cos(a) * s * 0.075;
      const y = ty + Math.sin(a) * s * 0.075;
      ctx.moveTo(x + s * 0.06, y);
      ctx.arc(x, y, s * 0.06, 0, TAU);
    }
    ctx.fill();
    // 近侧前腿 + 小爪子
    const fx = -s * 0.6 - Math.sin(ph) * s * 0.25;
    ctx.strokeStyle = deep(base, 0.6);
    ctx.lineWidth = s * 0.1;
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, -s * 0.45);
    ctx.lineTo(fx, -s * 0.05);
    ctx.stroke();
    ctx.fillStyle = deep(base, 0.5);
    ctx.beginPath();
    ctx.ellipse(fx - s * 0.04, -s * 0.03, s * 0.08, s * 0.045, 0, 0, TAU);
    ctx.fill();
    // 头：浅色口鼻 + 脸颊的毛
    const headP = oval(ctx, -s * 0.8, -s * 0.85, s * 0.32, s * 0.24, -0.3);
    headP();
    ctx.fillStyle = bodyGrad(ctx, -s * 1.1, -s * 1.15, -s * 0.5, -s * 0.6, base, 0.2, 0.6);
    ctx.fill();
    inside(ctx, headP, () => {
      ctx.fillStyle = rgba(fur, 0.3);
      ctx.beginPath();
      ctx.ellipse(-s * 0.98, -s * 0.78, s * 0.13, s * 0.1, -0.3, 0, TAU);
      ctx.fill();
      shade(ctx, -s * 1.15, -s * 1.1, -s * 0.45, -s * 0.6, 0.35);
      strokes(ctx, -s * 0.68, -s * 0.88, s * 0.18, s * 0.13, 10, fur, 0.3, 9, -0.4, s * 0.1);
    });
    rimEdge(ctx, headP, rim, 0.4, s * 0.07, s * 0.05, s * 0.05);
    // 鼻头高光 + 会抖的胡须
    ctx.fillStyle = '#ff9cc8';
    ctx.beginPath();
    ctx.arc(-s * 1.08, -s * 0.775, s * 0.04, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(-s * 1.07, -s * 0.79, s * 0.015, 0, TAU);
    ctx.fill();
    const tw = Math.sin(t * 9 + sd) * s * 0.02;
    ctx.strokeStyle = 'rgba(255,235,248,0.35)';
    ctx.lineWidth = Math.max(0.5, s * 0.02);
    ctx.beginPath();
    for (const i of [-1, 0, 1]) {
      ctx.moveTo(-s * 1.02, -s * 0.76 + i * s * 0.03);
      ctx.quadraticCurveTo(-s * 1.18, -s * 0.77 + i * s * 0.06 + tw, -s * 1.3, -s * 0.79 + i * s * 0.1 + tw);
    }
    ctx.stroke();
    // 长耳朵往后飘：粉色的耳心、一道发光的耳脉、耳尖一点光
    for (const [dx, k] of [[0, 1], [s * 0.12, 0.85]]) {
      ctx.save();
      ctx.translate(-s * 0.7 + dx, -s * 1.02);
      ctx.rotate(-1.15 * k + 1.9 + Math.sin(ph * 0.5 + k * 2) * 0.1);
      const earP = oval(ctx, 0, -s * 0.5, s * 0.09, s * 0.55, 0);
      earP();
      ctx.fillStyle = linear(ctx, s * 0.09, 0, -s * 0.09, 0, [[0, deep(base, 0.3 + (1 - k))], [1, deep(base, 0.6 + (1 - k))]]);
      ctx.fill();
      inside(ctx, earP, () => {
        ctx.fillStyle = rgba(hi, 0.22 * k);
        ctx.beginPath();
        ctx.ellipse(-s * 0.015, -s * 0.48, s * 0.045, s * 0.42, 0, 0, TAU);
        ctx.fill();
      });
      rune(ctx, [[0, -s * 0.15], [-s * 0.01, -s * 0.55], [0, -s * 0.88]], hi, s * 0.025, 0.4 * k);
      if (k === 1) rimEdge(ctx, earP, rim, 0.35, s * 0.05, s * 0.04, s * 0.03);
      dot(ctx, 0, -s * 0.95, s * 0.075, hi, 0.9);
      ctx.restore();
    }
    eyes(ctx, -s * 0.95, -s * 0.9, 0.01, s * 0.07, '#ffe0f0', -0.25);
    ctx.restore();
  };

  D.mushroom = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    const step = Math.sin(t * 7 + sd);
    shadow(ctx, 0, 2, s * 0.8);
    const base = '#c8a890';
    const cap = '#d84a48';
    const warm = '#ffd9a0';
    // 根须一样的细腿，脚尖再分出两根小根须
    for (const [lx, p] of [[-s * 0.2, 1], [s * 0.2, -1]]) {
      const fx = lx + step * p * s * 0.25;
      ctx.strokeStyle = deep(base, 0.6);
      ctx.lineWidth = s * 0.08;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lx * 0.5, -s * 0.5);
      ctx.quadraticCurveTo(lx + step * p * s * 0.15, -s * 0.25, fx, -s * 0.02);
      ctx.stroke();
      ctx.lineWidth = Math.max(0.6, s * 0.03);
      ctx.beginPath();
      ctx.moveTo(fx, -s * 0.04);
      ctx.quadraticCurveTo(fx - s * 0.08, -s * 0.02, fx - s * 0.14, 0);
      ctx.moveTo(fx, -s * 0.04);
      ctx.quadraticCurveTo(fx + s * 0.08, -s * 0.01, fx + s * 0.12, s * 0.01);
      ctx.stroke();
    }
    // 伞盖随步子轻轻晃（绕菌柄顶端转）
    const capT = () => {
      ctx.translate(0, -s * 1.45);
      ctx.rotate(step * 0.05);
      ctx.translate(0, s * 1.45);
    };
    // 伞盖下的菌褶：一圈透着暖光的细褶（在菌柄后面）
    ctx.save();
    capT();
    const gillP = oval(ctx, 0, -s * 1.4, s * 1.0, s * 0.1, 0);
    gillP();
    ctx.fillStyle = linear(ctx, 0, -s * 1.5, 0, -s * 1.3, [[0, deep(warm, 0.6)], [1, deep(warm, 0.2)]]);
    ctx.fill();
    inside(ctx, gillP, () => {
      ctx.strokeStyle = 'rgba(70,30,20,0.5)';
      ctx.lineWidth = Math.max(0.6, s * 0.02);
      ctx.beginPath();
      for (let i = -9; i <= 9; i++) {
        ctx.moveTo(i * s * 0.025, -s * 1.44);
        ctx.lineTo(i * s * 0.11, -s * 1.28);
      }
      ctx.stroke();
    });
    glow(ctx, 0, -s * 1.38, s * 0.9, warm, 0.45);
    ctx.restore();
    // 修长的菌柄：纵向纤维纹，上半截被菌褶的光照亮
    const stemP = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.22, -s * 0.45);
      ctx.quadraticCurveTo(-s * 0.3, -s * 1.0, -s * 0.18, -s * 1.45);
      ctx.lineTo(s * 0.18, -s * 1.45);
      ctx.quadraticCurveTo(s * 0.3, -s * 1.0, s * 0.22, -s * 0.45);
      ctx.closePath();
    };
    stemP();
    ctx.fillStyle = bodyGrad(ctx, -s * 0.3, -s * 1.5, s * 0.3, -s * 0.4, base, 0.15, 0.55);
    ctx.fill();
    inside(ctx, stemP, () => {
      // 圆柱一样的明暗：左边背光，靠右一道柔和的亮带
      ctx.fillStyle = linear(ctx, -s * 0.3, 0, s * 0.3, 0, [[0, 'rgba(14,8,20,0.45)'], [0.5, 'rgba(14,8,20,0)'], [0.75, 'rgba(255,244,228,0.2)'], [1, 'rgba(255,244,228,0)']]);
      ctx.fillRect(-s * 0.3, -s * 1.45, s * 0.6, s * 1.0);
      // 细细的纵向纤维
      ctx.lineWidth = Math.max(0.5, s * 0.015);
      ctx.strokeStyle = 'rgba(70,40,30,0.16)';
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const x = -s * 0.17 + i * s * 0.085;
        ctx.moveTo(x, -s * 0.45);
        ctx.quadraticCurveTo(x * 1.3, -s * 1.0, x * 0.8, -s * 1.45);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = linear(ctx, 0, -s * 1.45, 0, -s * 1.05, [[0, rgba(warm, 0.35)], [1, rgba(warm, 0)]]);
      ctx.fillRect(-s * 0.3, -s * 1.45, s * 0.6, s * 0.4);
      ctx.globalCompositeOperation = 'source-over';
    });
    rimEdge(ctx, stemP, '#ffe8c8', 0.35, s * 0.07, s * 0.05, s * 0.04);
    // 菌柄下部一圈小裙边（菌环），跟着步子摆
    const sk = step * s * 0.02;
    ctx.fillStyle = linear(ctx, s * 0.3, -s * 0.66, -s * 0.3, -s * 0.48, [[0, light(base, 0.15)], [1, deep(base, 0.55)]]);
    ctx.beginPath();
    ctx.moveTo(-s * 0.24, -s * 0.66);
    ctx.quadraticCurveTo(0, -s * 0.7, s * 0.24, -s * 0.66);
    ctx.lineTo(s * 0.3 + sk, -s * 0.52);
    for (let i = 0; i < 4; i++) {
      const x0 = s * 0.3 - i * s * 0.15 + sk;
      ctx.quadraticCurveTo(x0 - s * 0.075, -s * 0.44, x0 - s * 0.15, -s * 0.52);
    }
    ctx.closePath();
    ctx.fill();
    // 菌褶下透出的光和眼睛
    eyes(ctx, -s * 0.12, -s * 1.25, s * 0.18, s * 0.06, '#fff0c0', -0.15);
    // 伞盖：宽、深红、边缘下垂
    ctx.save();
    capT();
    const capP = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 1.1, -s * 1.35);
      ctx.bezierCurveTo(-s * 1.0, -s * 2.3, s * 1.0, -s * 2.3, s * 1.1, -s * 1.35);
      ctx.quadraticCurveTo(s * 0.5, -s * 1.5, 0, -s * 1.45);
      ctx.quadraticCurveTo(-s * 0.5, -s * 1.5, -s * 1.1, -s * 1.35);
      ctx.closePath();
    };
    capP();
    ctx.fillStyle = bodyGrad(ctx, -s * 1.1, -s * 2.3, s * 1.1, -s * 1.4, cap, 0.2, 0.68);
    ctx.fill();
    inside(ctx, capP, () => {
      // 顶上一片柔和的受光、背光一侧压暗、下缘往里卷的暗边
      glow(ctx, s * 0.35, -s * 2.0, s * 0.75, '#ff8a70', 0.35);
      shade(ctx, -s * 1.1, -s * 2.1, s * 1.1, -s * 1.35, 0.4);
      ctx.fillStyle = linear(ctx, 0, -s * 1.62, 0, -s * 1.38, [[0, 'rgba(30,6,10,0)'], [1, 'rgba(30,6,10,0.45)']]);
      ctx.fillRect(-s * 1.2, -s * 1.62, s * 2.4, s * 0.3);
      // 从顶上往下的细沟纹 + 细小的雀斑
      ctx.strokeStyle = 'rgba(40,6,10,0.18)';
      ctx.lineWidth = Math.max(0.6, s * 0.02);
      ctx.beginPath();
      for (let i = -4; i <= 4; i++) {
        ctx.moveTo(i * s * 0.06, -s * 2.05);
        ctx.quadraticCurveTo(i * s * 0.17, -s * 1.9, i * s * 0.26, -s * 1.42);
      }
      ctx.stroke();
      speckle(ctx, 0, -s * 1.85, s * 0.85, s * 0.3, 16, '#ffd0c0', 0.22, 4, s * 0.012, s * 0.03);
    });
    rimEdge(ctx, capP, '#ffb8a0', 0.45, s * 0.08, s * 0.05, s * 0.05);
    // 伞盖上的斑点：凸起的浅色疣点，中心发光，慢慢一明一暗
    const pul = 0.85 + Math.sin(t * 2 + sd) * 0.15;
    for (const [px, py, r] of [[-0.5, -1.85, 2], [0.12, -1.98, 2.3], [0.62, -1.7, 1.6], [-0.15, -1.68, 1.3], [-0.82, -1.55, 1.1], [0.4, -1.9, 1.0]]) {
      const rr = (r / 22) * s;
      ctx.fillStyle = 'rgba(255,236,210,0.5)';
      ctx.beginPath();
      ctx.ellipse(s * px, s * py, rr * 1.6, rr * 1.2, 0, 0, TAU);
      ctx.fill();
      dot(ctx, s * px, s * py, rr, '#ffe0a8', 0.95 * pul);
    }
    ctx.restore();
    // 从菌褶里飘落的发光孢子
    for (let i = 0; i < 4; i++) {
      const k = (t * 0.35 + i / 4 + sd * 0.13) % 1;
      const side = i % 2 ? 1 : -1;
      const x = side * s * (0.35 + k * 0.55) + Math.sin(t * 2 + i) * s * 0.08;
      dot(ctx, x, -s * 1.35 + k * s * 0.9, s * 0.035, '#ffe0a8', 0.7 * Math.sin(k * Math.PI));
    }
  };

  // 带翅脉的光翅：两层半透明的膜 + 翅脉 + 发亮的前缘
  function veinWing(ctx, x, y, len, wid, ang, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    const p = () => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(wid, -len * 0.5, 0, -len);
      ctx.quadraticCurveTo(-wid * 0.6, -len * 0.5, 0, 0);
    };
    p();
    ctx.fillStyle = linear(ctx, 0, 0, 0, -len, [[0, rgba(color, 0.12)], [1, rgba(color, 0.45)]]);
    ctx.fill();
    inside(ctx, p, () => {
      ctx.fillStyle = rgba(color, 0.16);
      ctx.beginPath();
      ctx.ellipse(wid * 0.18, -len * 0.62, wid * 0.24, len * 0.3, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = rgba(color, 0.5);
      ctx.lineWidth = Math.max(0.5, wid * 0.05);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(wid * 0.3, -len * 0.5, wid * 0.08, -len * 0.92);
      for (const u of [0.3, 0.5, 0.7]) {
        const vx = 2 * u * (1 - u) * wid * 0.3 + u * u * wid * 0.08;
        const vy = -(2 * u * (1 - u) * 0.5 + u * u * 0.92) * len;
        ctx.moveTo(vx, vy);
        ctx.lineTo(vx + wid * 0.4, vy - len * 0.12);
        ctx.moveTo(vx, vy);
        ctx.lineTo(vx - wid * 0.35, vy - len * 0.08);
      }
      ctx.stroke();
    });
    p();
    ctx.strokeStyle = rgba(color, 0.7);
    ctx.lineWidth = Math.max(0.7, wid * 0.06);
    ctx.stroke();
    ctx.restore();
  }

  D.bee = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    const bob = Math.sin(t * 7 + sd) * 3;
    ctx.save();
    ctx.globalAlpha = 0.5;
    shadow(ctx, 0, 34, s * 0.7);
    ctx.restore();
    ctx.translate(0, bob - s * 0.4);
    const base = '#e0a020';
    const gold = '#ffcf4a';
    const fuzz = '#ffe7a0';
    // 身后拖着一串花粉光尘
    for (let i = 0; i < 4; i++) {
      const k = (t * 1.3 + i / 4) % 1;
      dot(ctx, s * (1.2 + k * 0.85), -s * 0.2 + Math.sin(k * 7 + i + t * 2) * s * 0.16, s * 0.05 * (1 - k * 0.5), gold, 0.75 * (1 - k));
    }
    // 透光的长翅膀，带翅脉
    const flap = Math.sin(t * 46);
    veinWing(ctx, s * 0.1, -s * 0.55, s * 1.1, s * 0.4, 0.5 + flap * 0.45, '#d8f0ff');
    veinWing(ctx, s * 0.3, -s * 0.5, s * 0.9, s * 0.35, 0.95 + flap * 0.4, '#d8f0ff');
    // 细长的腹部：发光的金环 + 后面一道深色环、绒毛、背上一道光泽
    const abd = oval(ctx, s * 0.65, -s * 0.2, s * 0.62, s * 0.3, 0.35);
    abd();
    ctx.fillStyle = bodyGrad(ctx, s * 0.1, -s * 0.6, s * 1.3, s * 0.1, base, 0.35, 0.75);
    ctx.fill();
    inside(ctx, abd, () => {
      for (let i = 0; i < 3; i++) {
        const bx = s * (0.42 + i * 0.25);
        ctx.strokeStyle = 'rgba(14,8,4,0.5)';
        ctx.lineWidth = s * 0.09;
        ctx.beginPath();
        ctx.moveTo(bx + s * 0.1, -s * 0.65);
        ctx.lineTo(bx + s * 0.22, s * 0.2);
        ctx.stroke();
        rune(ctx, [[bx, -s * 0.65], [bx + s * 0.12, s * 0.2]], gold, s * 0.08, 0.75);
      }
      strokes(ctx, s * 0.65, -s * 0.2, s * 0.55, s * 0.26, 14, fuzz, 0.2, 13, 0.35, s * 0.07);
      shade(ctx, 0, -s * 0.6, s * 1.3, s * 0.2, 0.45);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = Math.max(0.8, s * 0.04);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.ellipse(s * 0.65, -s * 0.2, s * 0.48, s * 0.19, 0.35, -1.7, -0.8);
      ctx.stroke();
    });
    rimEdge(ctx, abd, fuzz, 0.4, s * 0.07, s * 0.05, s * 0.05);
    // 尾刺
    ctx.fillStyle = deep(base, 0.8);
    ctx.beginPath();
    ctx.moveTo(s * 1.15, -s * 0.05);
    ctx.lineTo(s * 1.55, s * 0.12);
    ctx.lineTo(s * 1.12, s * 0.08);
    ctx.fill();
    // 胸部：毛茸茸的
    const tho = oval(ctx, -s * 0.05, -s * 0.4, s * 0.32, s * 0.28, 0);
    tho();
    ctx.fillStyle = bodyGrad(ctx, -s * 0.5, -s * 0.8, s * 0.2, -s * 0.1, base, 0.45, 0.82);
    ctx.fill();
    inside(ctx, tho, () => {
      strokes(ctx, -s * 0.02, -s * 0.48, s * 0.26, s * 0.2, 16, fuzz, 0.3, 17, -1.6, s * 0.08);
      shade(ctx, -s * 0.4, -s * 0.7, s * 0.3, -s * 0.1, 0.4);
    });
    rimEdge(ctx, tho, fuzz, 0.45, s * 0.07, s * 0.05, s * 0.05);
    // 胸部上沿翘起的一圈绒毛
    ctx.strokeStyle = rgba(fuzz, 0.4);
    ctx.lineWidth = Math.max(0.6, s * 0.025);
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = -2.6 + i * 0.32;
      const x = -s * 0.05 + Math.cos(a) * s * 0.3;
      const y = -s * 0.4 + Math.sin(a) * s * 0.26;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * s * 0.07, y + Math.sin(a) * s * 0.07);
    }
    ctx.stroke();
    // 头
    const head = oval(ctx, -s * 0.45, -s * 0.5, s * 0.22, s * 0.2, 0);
    head();
    ctx.fillStyle = bodyGrad(ctx, -s * 0.5, -s * 0.8, s * 0.2, -s * 0.1, base, 0.45, 0.82);
    ctx.fill();
    inside(ctx, head, () => shade(ctx, -s * 0.7, -s * 0.7, -s * 0.23, -s * 0.3, 0.4));
    rimEdge(ctx, head, fuzz, 0.4, s * 0.05, s * 0.04, s * 0.04);
    // 分两节的细腿，最后一条腿上挂着一团花粉
    ctx.strokeStyle = deep(base, 0.8);
    ctx.lineWidth = Math.max(0.8, s * 0.05);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const lx = -s * 0.1 + i * s * 0.12;
      const sw = Math.sin(t * 6 + i) * s * 0.03;
      ctx.moveTo(lx, -s * 0.18);
      ctx.lineTo(lx - s * 0.06 + sw, -s * 0.02);
      ctx.lineTo(lx - s * 0.12 + sw, s * 0.15);
    }
    ctx.stroke();
    dot(ctx, s * 0.08 + Math.sin(t * 6 + 2) * s * 0.03, -s * 0.02, s * 0.065, gold, 0.85);
    // 触角：会摆，末端发光
    for (const k of [0, 1]) {
      const sw = Math.sin(t * 5 + k * 1.3 + sd) * s * 0.06;
      const ex = -s * 0.95 + k * s * 0.12 + sw;
      const ey = -s * 0.95 - k * s * 0.06 + sw * 0.5;
      ctx.strokeStyle = deep(base, k ? 0.75 : 0.88);
      ctx.lineWidth = Math.max(0.8, s * 0.05);
      ctx.beginPath();
      ctx.moveTo(-s * 0.55 + k * s * 0.08, -s * 0.65);
      ctx.quadraticCurveTo(-s * 0.75 + k * s * 0.1, -s * 1.0, ex, ey);
      ctx.stroke();
      dot(ctx, ex, ey, s * 0.045, gold, k ? 0.85 : 0.5);
    }
    eyes(ctx, -s * 0.55, -s * 0.52, 0.01, s * 0.09, '#fff0a0', -0.3);
  };

  // 哥布林：瘦长的四肢、前倾的身体、长鼻子和往后竖起的叶子形长耳朵
  // shield：木盾哥布林（皮护肩 + 木盾 + 一撮乱发）；否则是小哥布林（红头巾 + 匕首）
  function goblin(ctx, s, t, o, base, shield) {
    const sd = o.seed || 0;
    const ph = t * 8 + sd;
    const step = Math.sin(ph);
    const mark = '#d8ff8a';
    const skinHi = '#e8ff9a';
    const cloth = '#7a5a3a';
    shadow(ctx, 0, 2, s * 0.8);
    const hipY = -s * 0.85;
    // 腿：大腿 + 小腿，弯着膝盖；小腿缠着布条
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
      if (!far) {
        ctx.strokeStyle = rgba(skinHi, 0.3);
        ctx.lineWidth = Math.max(0.7, s * 0.025);
        ctx.beginPath();
        ctx.moveTo(lx * 0.4 + s * 0.05, hipY + s * 0.04);
        ctx.lineTo(kx + s * 0.04, -s * 0.48);
        ctx.stroke();
      }
      ctx.strokeStyle = rgba('#c8a878', far ? 0.25 : 0.5);
      ctx.lineWidth = Math.max(0.7, s * 0.03);
      ctx.beginPath();
      for (const u of [0.3, 0.5, 0.7]) {
        const x = kx + (fx - kx) * u;
        const y = -s * 0.45 + s * 0.39 * u;
        ctx.moveTo(x - s * 0.06, y - s * 0.015);
        ctx.lineTo(x + s * 0.06, y + s * 0.015);
      }
      ctx.stroke();
      // 脚：脚掌 + 脚趾
      ctx.fillStyle = deep(base, 0.85);
      ctx.beginPath();
      ctx.ellipse(fx - s * 0.06, -s * 0.04, s * 0.11, s * 0.05, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(fx - s * 0.16, -s * 0.03, s * 0.035, 0, TAU);
      ctx.fill();
    }
    // 破旧的腰布：毛边 + 布纹，跟着步子晃
    const sway = step * s * 0.03;
    const clothP = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.2, hipY - s * 0.12);
      ctx.lineTo(s * 0.22, hipY - s * 0.12);
      ctx.lineTo(s * 0.2 + sway, hipY + s * 0.18);
      ctx.lineTo(s * 0.12 + sway, hipY + s * 0.12);
      ctx.lineTo(s * 0.04 + sway, hipY + s * 0.2);
      ctx.lineTo(-s * 0.04 + sway, hipY + s * 0.1);
      ctx.lineTo(-s * 0.12 + sway, hipY + s * 0.22);
      ctx.lineTo(-s * 0.18 + sway, hipY + s * 0.12);
      ctx.closePath();
    };
    clothP();
    ctx.fillStyle = linear(ctx, s * 0.2, hipY - s * 0.12, -s * 0.2, hipY + s * 0.2, [[0, deep(cloth, 0.4)], [1, deep(cloth, 0.75)]]);
    ctx.fill();
    inside(ctx, clothP, () => {
      ctx.strokeStyle = 'rgba(255,230,190,0.15)';
      ctx.lineWidth = Math.max(0.6, s * 0.02);
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const x = -s * 0.16 + i * s * 0.09;
        ctx.moveTo(x, hipY - s * 0.1);
        ctx.lineTo(x + sway, hipY + s * 0.2);
      }
      ctx.stroke();
    });
    // 前倾的身体：皮肤上的小疙瘩、粗布短衣（领口一排针脚）、胸口一片发光的叶纹
    const torso = oval(ctx, -s * 0.02, -s * 1.2, s * 0.28, s * 0.42, -0.22);
    torso();
    ctx.fillStyle = bodyGrad(ctx, -s * 0.45, -s * 1.7, s * 0.4, hipY, base, 0.28, 0.7);
    ctx.fill();
    inside(ctx, torso, () => {
      speckle(ctx, s * 0.04, -s * 1.42, s * 0.16, s * 0.1, 6, '#1c3016', 0.3, shield ? 7 : 8, s * 0.015, s * 0.03);
      veins(ctx, s * 0.02, -s * 1.3, s * 0.16, -1.9, 1, mark, 0.45, 5, s * 0.03);
      const vy = -s * 1.22;
      ctx.fillStyle = linear(ctx, s * 0.3, vy, -s * 0.3, hipY, [[0, deep(cloth, 0.35)], [1, deep(cloth, 0.7)]]);
      ctx.beginPath();
      ctx.moveTo(-s * 0.4, vy + s * 0.06);
      ctx.quadraticCurveTo(-s * 0.05, vy - s * 0.06, s * 0.35, vy - s * 0.08);
      ctx.lineTo(s * 0.35, hipY + s * 0.1);
      ctx.lineTo(-s * 0.4, hipY + s * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,230,190,0.1)';
      ctx.lineWidth = Math.max(0.5, s * 0.015);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const y = vy + s * 0.06 + i * s * 0.07;
        ctx.moveTo(-s * 0.4, y);
        ctx.lineTo(s * 0.35, y - s * 0.05);
      }
      ctx.stroke();
      ctx.setLineDash([s * 0.04, s * 0.04]);
      ctx.strokeStyle = rgba('#f0d8a8', 0.45);
      ctx.lineWidth = Math.max(0.6, s * 0.02);
      ctx.beginPath();
      ctx.moveTo(-s * 0.4, vy + s * 0.1);
      ctx.quadraticCurveTo(-s * 0.05, vy - s * 0.02, s * 0.35, vy - s * 0.04);
      ctx.stroke();
      ctx.setLineDash([]);
      shade(ctx, -s * 0.35, -s * 1.65, s * 0.3, hipY + s * 0.1, 0.4);
    });
    rimEdge(ctx, torso, skinHi, 0.4, s * 0.07, s * 0.05, s * 0.05);
    // 腰带 + 铜扣
    ctx.strokeStyle = deep('#5a3a22', 0.4);
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.moveTo(-s * 0.22, hipY - s * 0.06);
    ctx.quadraticCurveTo(0, hipY - s * 0.02, s * 0.22, hipY - s * 0.1);
    ctx.stroke();
    dot(ctx, -s * 0.1, hipY - s * 0.05, s * 0.03, '#ffd27a', 0.8);
    // 远侧手臂 + 手
    const hx2 = s * 0.05 + step * s * 0.1;
    ctx.strokeStyle = deep(base, 0.82);
    ctx.lineWidth = s * 0.09;
    ctx.beginPath();
    ctx.moveTo(s * 0.05, -s * 1.45);
    ctx.quadraticCurveTo(s * 0.2, -s * 1.1, hx2, -s * 0.85);
    ctx.stroke();
    ctx.fillStyle = deep(base, 0.82);
    ctx.beginPath();
    ctx.arc(hx2, -s * 0.83, s * 0.06, 0, TAU);
    ctx.fill();
    // 头：往前探，长鼻子
    const hx = -s * 0.3;
    const hy = -s * 1.78;
    // 两只叶子形的大耳朵，往后上方张开（远处那只更暗）；耳朵上有叶脉一样的光纹，时不时抖一下
    const ew = Math.sin(ph * 0.5) * 0.08;
    const flick = Math.pow(Math.max(0, Math.sin(t * 1.7 + sd)), 12) * 0.3;
    for (const [far, ang] of [[true, -0.55], [false, -0.25]]) {
      ctx.save();
      ctx.translate(hx + s * 0.12, hy - s * 0.08);
      ctx.rotate(ang + ew - (far ? 0 : flick));
      const earP = () => {
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.06);
        ctx.quadraticCurveTo(s * 0.3, -s * 0.2, s * 0.48, -s * 0.08);
        ctx.quadraticCurveTo(s * 0.3, s * 0.08, 0, s * 0.06);
        ctx.closePath();
      };
      earP();
      ctx.fillStyle = far ? deep(base, 0.78) : bodyGrad(ctx, 0, -s * 0.2, s * 0.5, s * 0.1, base, 0.25, 0.62);
      ctx.fill();
      // 叶脉光纹：一条主脉 + 两对侧脉，一笔画完
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(mark, far ? 0.2 : 0.42);
      ctx.lineWidth = Math.max(0.6, s * 0.02);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(s * 0.03, 0);
      ctx.lineTo(s * 0.22, -s * 0.06);
      ctx.lineTo(s * 0.44, -s * 0.08);
      for (const vx of [0.12, 0.24]) {
        ctx.moveTo(s * vx, -s * 0.04);
        ctx.lineTo(s * (vx + 0.08), -s * 0.12);
        ctx.moveTo(s * vx, -s * 0.03);
        ctx.lineTo(s * (vx + 0.09), s * 0.03);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      if (!far) rimEdge(ctx, earP, skinHi, 0.4, s * 0.04, s * 0.03, s * 0.03);
      ctx.restore();
    }
    const headP = oval(ctx, hx, hy, s * 0.27, s * 0.25, -0.1);
    headP();
    ctx.fillStyle = bodyGrad(ctx, hx - s * 0.3, hy - s * 0.3, hx + s * 0.3, hy + s * 0.25, base, 0.22, 0.62);
    ctx.fill();
    inside(ctx, headP, () => {
      shade(ctx, hx - s * 0.3, hy - s * 0.28, hx + s * 0.3, hy + s * 0.26, 0.4);
      // 眉骨的阴影 + 几颗小疙瘩
      ctx.fillStyle = 'rgba(6,12,10,0.3)';
      ctx.beginPath();
      ctx.ellipse(hx - s * 0.1, hy - s * 0.1, s * 0.17, s * 0.05, -0.15, 0, TAU);
      ctx.fill();
      speckle(ctx, hx + s * 0.08, hy + s * 0.04, s * 0.12, s * 0.1, 4, '#1c3016', 0.3, 9, s * 0.012, s * 0.025);
      if (!shield) {
        // 小哥布林的红头巾
        ctx.strokeStyle = deep('#d0503a', 0.2);
        ctx.lineWidth = s * 0.09;
        ctx.beginPath();
        ctx.ellipse(hx, hy + s * 0.04, s * 0.3, s * 0.25, -0.1, Math.PI, TAU);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,220,200,0.3)';
        ctx.lineWidth = Math.max(0.6, s * 0.02);
        ctx.beginPath();
        ctx.ellipse(hx, hy + s * 0.01, s * 0.3, s * 0.25, -0.1, Math.PI * 1.2, Math.PI * 1.9);
        ctx.stroke();
      }
    });
    rimEdge(ctx, headP, skinHi, 0.4, s * 0.06, s * 0.045, s * 0.045);
    if (shield) {
      // 头顶几根乱翘的头发
      ctx.strokeStyle = deep(base, 0.75);
      ctx.lineWidth = Math.max(0.8, s * 0.03);
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const bx = hx - s * 0.06 + i * s * 0.07;
        const by = hy - s * 0.23 + Math.abs(i - 1) * s * 0.01;
        const sw = Math.sin(ph + i) * s * 0.03;
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx + s * 0.02, by - s * 0.12, bx + s * 0.1 + sw, by - s * 0.13 + i * s * 0.02);
      }
      ctx.stroke();
    } else {
      // 头巾在脑后打的结，两条飘带
      const kx = hx + s * 0.22;
      const ky = hy - s * 0.12;
      ctx.lineCap = 'round';
      for (const k of [0, 1]) {
        const w1 = Math.sin(t * 9 + k * 1.5 + sd) * s * 0.06;
        ctx.strokeStyle = deep('#d0503a', 0.3 + k * 0.2);
        ctx.lineWidth = s * 0.06;
        ctx.beginPath();
        ctx.moveTo(kx, ky);
        ctx.quadraticCurveTo(kx + s * 0.18, ky - s * 0.02 + w1 + k * s * 0.06, kx + s * 0.36, ky + s * 0.04 + k * s * 0.1 - w1);
        ctx.stroke();
      }
      ctx.fillStyle = deep('#d0503a', 0.25);
      ctx.beginPath();
      ctx.arc(kx, ky, s * 0.05, 0, TAU);
      ctx.fill();
    }
    // 小鼻子 + 鼻尖高光
    ctx.fillStyle = bodyGrad(ctx, hx - s * 0.4, hy - s * 0.1, hx - s * 0.1, hy + s * 0.15, base, 0.22, 0.62);
    ctx.beginPath();
    ctx.moveTo(hx - s * 0.22, hy - s * 0.0);
    ctx.quadraticCurveTo(hx - s * 0.38, hy + s * 0.06, hx - s * 0.32, hy + s * 0.12);
    ctx.quadraticCurveTo(hx - s * 0.24, hy + s * 0.12, hx - s * 0.16, hy + s * 0.1);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(hx - s * 0.3, hy + s * 0.05, s * 0.02, 0, TAU);
    ctx.fill();
    // 咧嘴笑，露出一颗小尖牙
    ctx.strokeStyle = 'rgba(10,16,10,0.6)';
    ctx.lineWidth = Math.max(0.6, s * 0.025);
    ctx.beginPath();
    ctx.moveTo(hx - s * 0.2, hy + s * 0.15);
    ctx.quadraticCurveTo(hx - s * 0.1, hy + s * 0.19, hx - s * 0.02, hy + s * 0.13);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,250,230,0.85)';
    ctx.beginPath();
    ctx.moveTo(hx - s * 0.15, hy + s * 0.165);
    ctx.lineTo(hx - s * 0.11, hy + s * 0.17);
    ctx.lineTo(hx - s * 0.13, hy + s * 0.21);
    ctx.fill();
    eyes(ctx, hx - s * 0.12, hy - s * 0.05, s * 0.12, s * 0.045, '#e8ff9a', -0.2);
    // 近侧手臂 + 护腕
    ctx.strokeStyle = deep(base, 0.55);
    ctx.lineWidth = s * 0.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, -s * 1.42);
    ctx.quadraticCurveTo(-s * 0.4, -s * 1.2, -s * 0.55, -s * 1.12);
    ctx.stroke();
    ctx.strokeStyle = deep(cloth, 0.3);
    ctx.lineWidth = s * 0.12;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(-s * 0.42, -s * 1.17);
    ctx.lineTo(-s * 0.49, -s * 1.14);
    ctx.stroke();
    ctx.lineCap = 'round';
    if (shield) {
      // 肩上的皮护肩 + 一颗铆钉
      const padP = oval(ctx, -s * 0.1, -s * 1.47, s * 0.14, s * 0.09, -0.35);
      padP();
      ctx.fillStyle = linear(ctx, s * 0.04, -s * 1.56, -s * 0.24, -s * 1.38, [[0, light('#8a6a42', 0.15)], [1, deep('#8a6a42', 0.6)]]);
      ctx.fill();
      ctx.strokeStyle = rgba('#ffe0a0', 0.45);
      ctx.lineWidth = Math.max(0.6, s * 0.025);
      ctx.beginPath();
      ctx.ellipse(-s * 0.1, -s * 1.47, s * 0.12, s * 0.07, -0.35, -2.0, 0.3);
      ctx.stroke();
      dot(ctx, -s * 0.08, -s * 1.49, s * 0.022, '#ffe0a0', 0.7);
      // 木盾：木板拼成，木纹 + 金属包边和铆钉 + 发光的符文环和叶子印记（正面很硬）
      ctx.save();
      ctx.translate(-s * 0.68, -s * 1.0);
      const shP = oval(ctx, 0, 0, s * 0.3, s * 0.52, 0);
      shP();
      ctx.fillStyle = bodyGrad(ctx, -s * 0.4, -s * 0.55, s * 0.4, s * 0.55, '#8a6a42', 0.35, 0.78);
      ctx.fill();
      inside(ctx, shP, () => {
        ctx.lineWidth = Math.max(0.6, s * 0.018);
        ctx.strokeStyle = 'rgba(240,200,140,0.16)';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const x = -s * 0.26 + i * s * 0.075;
          ctx.moveTo(x, -s * 0.55);
          ctx.quadraticCurveTo(x + s * 0.03, 0, x - s * 0.01, s * 0.55);
        }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(12,6,4,0.5)';
        ctx.lineWidth = Math.max(0.7, s * 0.025);
        ctx.beginPath();
        for (const x of [-0.15, 0, 0.15]) {
          ctx.moveTo(s * x, -s * 0.55);
          ctx.lineTo(s * x, s * 0.55);
        }
        ctx.stroke();
        shade(ctx, -s * 0.3, -s * 0.52, s * 0.3, s * 0.52, 0.45);
      });
      shP();
      ctx.strokeStyle = linear(ctx, s * 0.3, -s * 0.5, -s * 0.3, s * 0.5, [[0, '#f0dca0'], [1, '#4a3a22']]);
      ctx.lineWidth = s * 0.05;
      ctx.stroke();
      ctx.fillStyle = '#d8c898';
      ctx.beginPath();
      for (const [rx, ry] of [[0, -0.47], [0, 0.47], [-0.27, 0], [0.27, 0]]) {
        ctx.moveTo(s * (rx + 0.025), s * ry);
        ctx.arc(s * rx, s * ry, s * 0.025, 0, TAU);
      }
      ctx.fill();
      const pa = 0.45 + Math.sin(t * 2 + sd) * 0.15;
      ctx.strokeStyle = rgba(mark, pa + 0.1);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.19, s * 0.36, 0, 0, TAU);
      ctx.stroke();
      rune(ctx, [[0, -s * 0.22], [s * 0.08, -s * 0.06], [0, s * 0.2], [-s * 0.08, -s * 0.06], [0, -s * 0.22]], mark, Math.max(0.7, s * 0.025), pa);
      rune(ctx, [[0, -s * 0.18], [0, s * 0.16]], mark, Math.max(0.6, s * 0.018), pa * 0.8);
      dot(ctx, 0, 0, 1.8, mark, 0.9);
      // 右上内沿一道受光
      ctx.strokeStyle = rgba('#ffe0a0', 0.4);
      ctx.lineWidth = Math.max(0.7, s * 0.03);
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.25, s * 0.47, 0, -1.9, 0.4);
      ctx.stroke();
      ctx.restore();
    } else {
      // 匕首：钢刃上有一道会移动的寒光，柄上缠着布条
      ctx.save();
      ctx.translate(-s * 0.55, -s * 1.12);
      ctx.rotate(Math.atan2(-0.18, -0.4));
      ctx.fillStyle = deep(cloth, 0.4);
      ctx.fillRect(-s * 0.14, -s * 0.035, s * 0.13, s * 0.07);
      ctx.strokeStyle = rgba('#e8d0a0', 0.4);
      ctx.lineWidth = Math.max(0.5, s * 0.015);
      ctx.beginPath();
      for (const x of [-0.11, -0.075, -0.04]) {
        ctx.moveTo(s * x, -s * 0.035);
        ctx.lineTo(s * (x + 0.02), s * 0.035);
      }
      ctx.stroke();
      ctx.fillStyle = deep(base, 0.5);
      ctx.beginPath();
      ctx.arc(-s * 0.07, 0, s * 0.065, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#d8b860';
      ctx.fillRect(-s * 0.02, -s * 0.08, s * 0.035, s * 0.16);
      ctx.fillStyle = linear(ctx, 0, -s * 0.045, 0, s * 0.045, [[0, '#f2f8ff'], [0.5, '#b8c8d8'], [1, '#5a6878']]);
      ctx.beginPath();
      ctx.moveTo(s * 0.02, -s * 0.045);
      ctx.lineTo(s * 0.4, -s * 0.012);
      ctx.lineTo(s * 0.45, 0);
      ctx.lineTo(s * 0.4, s * 0.012);
      ctx.lineTo(s * 0.02, s * 0.045);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = Math.max(0.5, s * 0.012);
      ctx.beginPath();
      ctx.moveTo(s * 0.04, -s * 0.01);
      ctx.lineTo(s * 0.38, -s * 0.003);
      ctx.stroke();
      const k = (t * 0.7 + sd * 0.3) % 1;
      glow(ctx, s * (0.05 + k * 0.38), 0, s * 0.14, '#dff0ff', 0.6 * Math.sin(k * Math.PI));
      glow(ctx, s * 0.44, 0, s * 0.2, '#dff0ff', 0.5);
      ctx.restore();
    }
  }
  D.goblin = (ctx, s, t, o) => goblin(ctx, s, t, o, '#5a8a48', true);
  D.gobling = (ctx, s, t, o) => goblin(ctx, s, t, o, '#6a9a58', false);

  D.boarKing = function (ctx, s, t, o) {
    const ai = o.ai || {};
    const angry = ai.mode === 'warn' || ai.mode === 'charge';
    const run = ai.mode === 'charge' ? 2.6 : ai.mode === 'hold' ? 0.25 : 0.9;
    const ph = t * 8 * run + (o.seed || 0);
    const base = '#9a6440';
    const fur = '#ffcf8a';
    // 发光纹样的颜色：平时是暖金色，预警 / 冲锋时变成橙红（每个阶段换一种光）
    const mark = angry ? '#ff8a4a' : '#ffc46a';
    shadow(ctx, 0, 2, s * 1.4);
    // 冲锋时蹄下扬起的尘土
    if (ai.mode === 'charge') {
      for (let i = 0; i < 5; i++) {
        const k = (t * 2.2 + i / 5) % 1;
        const x = s * (0.5 + k * 1.2) + (i % 2) * s * 0.2;
        const y = -s * (0.06 + k * 0.4);
        const r = s * (0.1 + k * 0.18);
        ctx.fillStyle = radial(ctx, x, y, 0, r, [[0, 'rgba(214,184,140,' + ((1 - k) * 0.4).toFixed(3) + ')'], [1, 'rgba(214,184,140,0)']]);
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
    ctx.save();
    if (ai.mode === 'warn') ctx.translate(Math.sin(t * 50) * 2, 0);
    const by = -s * 0.75 - Math.abs(Math.sin(ph)) * s * 0.05;
    // 卷卷的小尾巴，末端一撮毛，跑起来甩
    ctx.save();
    ctx.translate(s * 1.15, by - s * 0.05);
    ctx.rotate(Math.sin(ph * 1.3) * 0.4);
    ctx.strokeStyle = deep(base, 0.6);
    ctx.lineWidth = s * 0.06;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(s * 0.2, -s * 0.05, s * 0.25, -s * 0.25, s * 0.12, -s * 0.25);
    ctx.quadraticCurveTo(s * 0.02, -s * 0.22, s * 0.1, -s * 0.14);
    ctx.stroke();
    strokes(ctx, s * 0.1, -s * 0.14, s * 0.04, s * 0.04, 7, fur, 0.5, 23, 1.0, s * 0.1);
    ctx.restore();
    // 四条腿：粗壮、末端是蹄子，蹄子上一圈长毛
    for (const [lx, p, far] of [[-s * 0.75, 0, true], [s * 0.75, Math.PI, true], [-s * 0.55, Math.PI, false], [s * 0.95, 0, false]]) {
      const sw = Math.sin(ph + p) * s * 0.22 * Math.min(1, run);
      ctx.strokeStyle = deep(base, far ? 0.85 : 0.68);
      ctx.lineCap = 'round';
      ctx.lineWidth = s * 0.2;
      ctx.beginPath();
      ctx.moveTo(lx, by + s * 0.1);
      ctx.quadraticCurveTo(lx + sw * 0.5, by + s * 0.45, lx + sw, -s * 0.1);
      ctx.stroke();
      if (!far) {
        ctx.strokeStyle = rgba(fur, 0.22);
        ctx.lineWidth = Math.max(0.8, s * 0.03);
        ctx.beginPath();
        ctx.moveTo(lx + s * 0.08, by + s * 0.15);
        ctx.quadraticCurveTo(lx + sw * 0.5 + s * 0.08, by + s * 0.45, lx + sw + s * 0.07, -s * 0.18);
        ctx.stroke();
      }
      const hx = lx + sw - s * 0.03;
      ctx.fillStyle = '#120c0a';
      ctx.beginPath();
      ctx.ellipse(hx, -s * 0.06, s * 0.11, s * 0.07, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,230,200,0.25)';
      ctx.beginPath();
      ctx.ellipse(hx + s * 0.03, -s * 0.09, s * 0.045, s * 0.02, 0, 0, TAU);
      ctx.fill();
      strokes(ctx, lx + sw * 0.95, -s * 0.16, s * 0.08, s * 0.03, 7, far ? '#3a2416' : '#c89060', 0.45, 31, 1.75, s * 0.08);
    }
    // 身体：前高后低的驼峰，长鼻子低垂
    const bodyP = () => {
      ctx.beginPath();
      ctx.moveTo(s * 1.15, by + s * 0.25);
      ctx.quadraticCurveTo(s * 1.3, by - s * 0.3, s * 0.8, by - s * 0.55);
      ctx.quadraticCurveTo(0, by - s * 0.95, -s * 0.6, by - s * 0.78);
      ctx.quadraticCurveTo(-s * 1.05, by - s * 0.62, -s * 1.3, by - s * 0.2);
      ctx.quadraticCurveTo(-s * 1.55, by + s * 0.05, -s * 1.72, by + s * 0.18);
      ctx.quadraticCurveTo(-s * 1.65, by + s * 0.38, -s * 1.3, by + s * 0.32);
      ctx.quadraticCurveTo(-s * 0.9, by + s * 0.45, -s * 0.5, by + s * 0.42);
      ctx.quadraticCurveTo(s * 0.4, by + s * 0.55, s * 1.15, by + s * 0.25);
      ctx.closePath();
    };
    bodyP();
    ctx.fillStyle = bodyGrad(ctx, -s * 1.7, by - s * 0.8, s * 1.3, by + s * 0.5, base, 0.22, 0.74);
    ctx.fill();
    inside(ctx, bodyP, () => {
      // 浅色的肚皮、背上的受光、背光一侧压暗
      ctx.fillStyle = rgba('#d8a878', 0.18);
      ctx.beginPath();
      ctx.ellipse(-s * 0.1, by + s * 0.42, s * 1.0, s * 0.16, 0.05, 0, TAU);
      ctx.fill();
      glow(ctx, s * 0.45, by - s * 0.65, s * 0.9, fur, 0.18);
      shade(ctx, -s * 1.75, by - s * 0.95, s * 1.3, by + s * 0.55, 0.45);
      // 粗硬的毛：深色笔触打底，浅色笔触顺着往后梳
      strokes(ctx, -s * 0.1, by - s * 0.15, s * 1.2, s * 0.5, 70, '#2a1608', 0.35, 41, -0.15, s * 0.16);
      strokes(ctx, s * 0.05, by - s * 0.35, s * 1.1, s * 0.4, 55, fur, 0.22, 43, -0.2, s * 0.15);
      // 脸：鼻子附近更深
      ctx.fillStyle = radial(ctx, -s * 1.6, by + s * 0.2, 0, s * 0.6, [[0, 'rgba(20,8,6,0.45)'], [1, 'rgba(20,8,6,0)']]);
      ctx.fillRect(-s * 2.2, by - s * 0.5, s * 1.2, s * 1.1);
      // 发光的纹样：肩上一个旋涡、后腿上三道
      const sp = [];
      for (let i = 0; i <= 16; i++) {
        const a = i * 0.55 + 1.5;
        const r = s * (0.03 + i * 0.012);
        sp.push([-s * 0.62 + Math.cos(a) * r, by - s * 0.12 + Math.sin(a) * r]);
      }
      rune(ctx, sp, mark, s * 0.035, angry ? 0.75 : 0.5);
      for (let i = 0; i < 3; i++) rune(ctx, [[s * (0.55 + i * 0.13), by - s * 0.42], [s * (0.62 + i * 0.13), by - s * 0.1]], mark, s * 0.035, angry ? 0.7 : 0.45);
      // 鞍毯下面的肚带
      ctx.strokeStyle = deep('#5a3a22', 0.5);
      ctx.lineWidth = s * 0.08;
      ctx.beginPath();
      ctx.moveTo(-s * 0.02, by - s * 0.3);
      ctx.lineTo(-s * 0.1, by + s * 0.55);
      ctx.stroke();
      dot(ctx, -s * 0.06, by + s * 0.12, s * 0.03, '#ffd96a', 0.8);
    });
    rimEdge(ctx, bodyP, fur, 0.4, s * 0.07, s * 0.05, s * 0.05);
    // 背上的鬃毛：后排深色长毛 + 前排短毛，根粗尖细，毛尖受光；生气时竖起来，毛尖跟着纹样一起发光
    for (const layer of [0, 1]) {
      const n = layer ? 9 : 8;
      const hw = s * (layer ? 0.045 : 0.038);
      const tips = [];
      ctx.fillStyle = deep(base, layer ? 0.85 : 0.92);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const k = (i + (layer ? 0 : 0.5)) / 8;
        const mx = -s * 0.85 + k * s * 1.6;
        const my = by - s * (0.64 + Math.sin(k * Math.PI) * 0.18);
        const mh = s * (0.3 + Math.sin(k * Math.PI) * 0.18) * (angry ? 1.3 : 1) * (layer ? 1 : 1.15);
        const ex = mx + s * 0.12 + Math.sin(t * 4 + i * 0.7) * s * 0.02;
        const ey = my - mh;
        ctx.moveTo(mx - hw, my);
        ctx.quadraticCurveTo(mx - hw * 0.2 + (ex - mx) * 0.45, my - mh * 0.55, ex, ey);
        ctx.quadraticCurveTo(mx + hw * 0.7 + (ex - mx) * 0.5, my - mh * 0.45, mx + hw, my);
        tips.push([mx + (ex - mx) * 0.55 + hw * 0.3, my - mh * 0.55, ex, ey]);
      }
      ctx.fill();
      if (layer) {
        ctx.strokeStyle = rgba(angry ? mark : fur, angry ? 0.6 : 0.45);
        ctx.lineWidth = Math.max(0.8, s * 0.02);
        ctx.beginPath();
        for (const [x0, y0, x1, y1] of tips) {
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
        }
        ctx.stroke();
      }
    }
    // 鞍毯：蓝底金边，往下摆开，下摆是三道圆弧，菱形的金纹，弧底挂着会晃的金穗
    const blue = '#3a6ab0';
    const x0 = -s * 0.4;
    const x1 = s * 0.36;
    const xl = x0 - s * 0.06;
    const xr = x1 + s * 0.06;
    const yTop = by - s * 0.8;
    const yBot = by - s * 0.26;
    const hem = () => {
      for (let i = 0; i < 3; i++) {
        const xa = xr - ((xr - xl) * i) / 3;
        const xb = xr - ((xr - xl) * (i + 1)) / 3;
        ctx.quadraticCurveTo((xa + xb) / 2, yBot + s * (i === 1 ? 0.16 : 0.12), xb, yBot);
      }
    };
    const blanketP = () => {
      ctx.beginPath();
      ctx.moveTo(x0 + s * 0.04, yTop + s * 0.04);
      ctx.quadraticCurveTo(0, yTop - s * 0.1, x1 - s * 0.02, yTop);
      ctx.lineTo(xr, yBot);
      hem();
      ctx.closePath();
    };
    blanketP();
    ctx.fillStyle = linear(ctx, x1, yTop, x0, yBot, [[0, deep(blue, 0.15)], [1, deep(blue, 0.65)]]);
    ctx.fill();
    inside(ctx, blanketP, () => {
      ctx.strokeStyle = 'rgba(6,10,30,0.3)';
      ctx.lineWidth = Math.max(0.8, s * 0.025);
      ctx.beginPath();
      for (const fx of [-0.25, -0.05, 0.15]) {
        ctx.moveTo(s * fx, yTop);
        ctx.quadraticCurveTo(s * (fx + 0.04), (yTop + yBot) / 2, s * (fx - 0.03), yBot + s * 0.1);
      }
      ctx.stroke();
      const dy = yBot - s * 0.1;
      const pts = [];
      for (let i = 0; i <= 8; i++) pts.push([x0 + i * s * 0.095, dy + (i % 2 ? -s * 0.05 : s * 0.03)]);
      rune(ctx, pts, '#ffd96a', Math.max(0.8, s * 0.022), 0.55);
      shade(ctx, xl, yTop - s * 0.1, xr, yBot + s * 0.12, 0.3);
    });
    ctx.strokeStyle = rgba('#ffd96a', 0.8);
    ctx.lineWidth = Math.max(0.9, s * 0.035);
    ctx.beginPath();
    ctx.moveTo(xr, yBot);
    hem();
    ctx.stroke();
    rimEdge(ctx, blanketP, '#bfe0ff', 0.35, s * 0.05, s * 0.04, s * 0.04);
    ctx.strokeStyle = rgba('#ffd96a', 0.65);
    ctx.lineWidth = Math.max(0.7, s * 0.02);
    ctx.fillStyle = '#ffd96a';
    for (let i = 0; i < 3; i++) {
      const tx0 = xr - ((xr - xl) * (i + 0.5)) / 3;
      const ty0 = yBot + s * (i === 1 ? 0.08 : 0.06);
      const tx1 = tx0 + Math.sin(ph + i) * s * 0.03;
      ctx.beginPath();
      ctx.moveTo(tx0, ty0);
      ctx.lineTo(tx1, ty0 + s * 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(tx1, ty0 + s * 0.12, s * 0.028, 0, TAU);
      ctx.fill();
    }
    // 耳朵：叶子形，粉色的耳心，时不时抖一下
    ctx.save();
    ctx.translate(-s * 0.82, by - s * 0.6);
    ctx.rotate(Math.sin(t * 2.3) * 0.08 - Math.pow(Math.max(0, Math.sin(t * 1.3 + 1)), 10) * 0.3);
    const earP = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.13, 0);
      ctx.quadraticCurveTo(-s * 0.12, -s * 0.22, s * 0.07, -s * 0.36);
      ctx.quadraticCurveTo(s * 0.06, -s * 0.12, s * 0.12, 0);
      ctx.closePath();
    };
    earP();
    ctx.fillStyle = linear(ctx, s * 0.1, -s * 0.35, -s * 0.1, 0, [[0, deep(base, 0.4)], [1, deep(base, 0.75)]]);
    ctx.fill();
    ctx.fillStyle = rgba('#e8a090', 0.35);
    ctx.beginPath();
    ctx.moveTo(-s * 0.06, -s * 0.02);
    ctx.quadraticCurveTo(-s * 0.05, -s * 0.18, s * 0.05, -s * 0.28);
    ctx.quadraticCurveTo(s * 0.03, -s * 0.1, s * 0.06, -s * 0.02);
    ctx.fill();
    rimEdge(ctx, earP, fur, 0.45, s * 0.04, s * 0.03, s * 0.03);
    ctx.restore();
    // 鼻盘 + 鼻孔 + 高光
    ctx.fillStyle = linear(ctx, -s * 1.6, by + s * 0.1, -s * 1.75, by + s * 0.38, [[0, deep('#d89080', 0.35)], [1, deep('#d89080', 0.72)]]);
    ctx.beginPath();
    ctx.ellipse(-s * 1.67, by + s * 0.24, s * 0.075, s * 0.13, 0.25, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(10,4,4,0.7)';
    for (const ny of [0.19, 0.3]) {
      ctx.beginPath();
      ctx.ellipse(-s * 1.69, by + s * ny, s * 0.02, s * 0.03, 0.25, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,230,220,0.4)';
    ctx.beginPath();
    ctx.ellipse(-s * 1.63, by + s * 0.15, s * 0.022, s * 0.04, 0.25, 0, TAU);
    ctx.fill();
    // 嘴 + 远侧的獠牙（暗一些）+ 近侧发光的獠牙（象牙色渐变 + 高光）
    ctx.strokeStyle = 'rgba(16,6,4,0.5)';
    ctx.lineWidth = Math.max(0.8, s * 0.025);
    ctx.beginPath();
    ctx.moveTo(-s * 1.58, by + s * 0.34);
    ctx.quadraticCurveTo(-s * 1.4, by + s * 0.38, -s * 1.25, by + s * 0.3);
    ctx.stroke();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(190,170,140,0.6)';
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.moveTo(-s * 1.36, by + s * 0.28);
    ctx.quadraticCurveTo(-s * 1.56, by + s * 0.23, -s * 1.54, by - s * 0.0);
    ctx.stroke();
    ctx.strokeStyle = linear(ctx, -s * 1.45, by + s * 0.25, -s * 1.7, by - s * 0.12, [[0, '#c8b490'], [1, '#fff8e6']]);
    ctx.lineWidth = s * 0.07;
    ctx.beginPath();
    ctx.moveTo(-s * 1.45, by + s * 0.25);
    ctx.quadraticCurveTo(-s * 1.72, by + s * 0.2, -s * 1.7, by - s * 0.12);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = Math.max(0.6, s * 0.02);
    ctx.beginPath();
    ctx.moveTo(-s * 1.5, by + s * 0.21);
    ctx.quadraticCurveTo(-s * 1.69, by + s * 0.16, -s * 1.68, by - s * 0.09);
    ctx.stroke();
    glow(ctx, -s * 1.68, by - s * 0.05, s * 0.35, '#fff0d0', 0.4);
    // 眉骨：生气时前端往下压（凶凶的，但不吓人）
    ctx.strokeStyle = deep(base, 0.88);
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.moveTo(-s * 1.26, by - s * (angry ? 0.36 : 0.43));
    ctx.quadraticCurveTo(-s * 1.12, by - s * 0.47, -s * 0.98, by - s * (angry ? 0.47 : 0.42));
    ctx.stroke();
    eyes(ctx, -s * 1.12, by - s * 0.32, 0.01, s * 0.09, angry ? '#ff7a3a' : '#ffd890', -0.25);
    if (angry) {
      glow(ctx, -s * 1.12, by - s * 0.32, s * 0.6, '#ff5a2a', 0.45);
      // 鼻子里喷出的白气
      for (let i = 0; i < 3; i++) {
        const k = (t * 1.8 + i / 3) % 1;
        const x = -s * (1.78 + k * 0.28);
        const y = by + s * (0.22 - k * 0.22);
        const r = s * (0.07 + k * 0.12);
        ctx.fillStyle = radial(ctx, x, y, 0, r, [[0, 'rgba(255,240,230,' + ((1 - k) * 0.4).toFixed(3) + ')'], [1, 'rgba(255,240,230,0)']]);
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
    // 骑手：哥布林国王
    ctx.save();
    ctx.translate(-s * 0.1, by - s * 0.82);
    const kb = '#5a8a48';
    const capeC = '#a83a3a';
    const gold = '#ffd96a';
    const fl = Math.sin(t * 3) * s * 0.05;
    // 斗篷：外面深红、里衬金色，边上一道金线，下摆飘
    const capeP = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.25, 0);
      ctx.quadraticCurveTo(-s * 0.32, -s * 0.55, -s * 0.08, -s * 0.78);
      ctx.quadraticCurveTo(s * 0.3, -s * 0.6, s * 0.55 + fl, s * 0.05);
      ctx.quadraticCurveTo(s * 0.42, -s * 0.02 + fl * 0.4, s * 0.3, s * 0.04);
      ctx.quadraticCurveTo(s * 0.15, -s * 0.03 - fl * 0.3, -s * 0.0, s * 0.03);
      ctx.closePath();
    };
    capeP();
    ctx.fillStyle = bodyGrad(ctx, -s * 0.35, -s * 0.9, s * 0.4, 0, capeC, 0.25, 0.72);
    ctx.fill();
    inside(ctx, capeP, () => {
      ctx.fillStyle = linear(ctx, s * 0.5, -s * 0.1, -s * 0.1, s * 0.05, [[0, deep(gold, 0.3)], [1, deep(gold, 0.7)]]);
      ctx.beginPath();
      ctx.moveTo(s * 0.62 + fl, s * 0.1);
      ctx.quadraticCurveTo(s * 0.3, -s * 0.14, -s * 0.05, s * 0.0);
      ctx.lineTo(-s * 0.05, s * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,4,8,0.35)';
      ctx.lineWidth = Math.max(0.8, s * 0.025);
      ctx.beginPath();
      for (const k of [0.15, 0.3, 0.45]) {
        ctx.moveTo(-s * 0.05, -s * 0.7);
        ctx.quadraticCurveTo(s * k * 0.9, -s * 0.35, s * k * 1.2 + fl * k, 0);
      }
      ctx.stroke();
      shade(ctx, -s * 0.35, -s * 0.8, s * 0.6, s * 0.1, 0.35);
    });
    ctx.strokeStyle = rgba(gold, 0.7);
    ctx.lineWidth = Math.max(0.8, s * 0.025);
    ctx.beginPath();
    ctx.moveTo(-s * 0.08, -s * 0.78);
    ctx.quadraticCurveTo(s * 0.3, -s * 0.6, s * 0.55 + fl, s * 0.05);
    ctx.stroke();
    rimEdge(ctx, capeP, '#ffb0a0', 0.35, s * 0.05, s * 0.04, s * 0.04);
    // 身体（皮短衣 + 金腰带）和举着权杖的手：预警 / 冲锋时权杖往前指
    const tun = oval(ctx, -s * 0.12, -s * 0.42, s * 0.15, s * 0.26, -0.15);
    tun();
    ctx.fillStyle = bodyGrad(ctx, -s * 0.3, -s * 0.7, s * 0.05, -s * 0.15, '#7a5a3a', 0.3, 0.7);
    ctx.fill();
    ctx.strokeStyle = rgba(gold, 0.7);
    ctx.lineWidth = Math.max(0.8, s * 0.03);
    ctx.beginPath();
    ctx.moveTo(-s * 0.26, -s * 0.3);
    ctx.lineTo(s * 0.02, -s * 0.34);
    ctx.stroke();
    const sa = angry ? -1.1 : -0.25 + Math.sin(t * 2) * 0.08;
    const hx = -s * 0.36;
    const hy = -s * 0.42;
    ctx.strokeStyle = deep(kb, 0.55);
    ctx.lineWidth = s * 0.07;
    ctx.beginPath();
    ctx.moveTo(-s * 0.16, -s * 0.58);
    ctx.quadraticCurveTo(-s * 0.3, -s * 0.58, hx, hy);
    ctx.stroke();
    const ex = hx + Math.sin(sa) * s * 0.45;
    const ey = hy - Math.cos(sa) * s * 0.45;
    ctx.strokeStyle = linear(ctx, hx, hy, ex, ey, [[0, '#a8741e'], [1, '#fff0b0']]);
    ctx.lineWidth = Math.max(1, s * 0.035);
    ctx.beginPath();
    ctx.moveTo(hx - Math.sin(sa) * s * 0.1, hy + Math.cos(sa) * s * 0.1);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    glow(ctx, ex, ey, s * 0.22, angry ? '#ffb070' : '#bfe8ff', 0.6, true);
    dot(ctx, ex, ey, s * 0.04, angry ? '#ffb070' : '#bfe8ff', 0.95);
    ctx.fillStyle = deep(kb, 0.5);
    ctx.beginPath();
    ctx.arc(hx, hy, s * 0.045, 0, TAU);
    ctx.fill();
    // 头和往后耷拉的长耳朵（耳朵上有叶脉一样的光纹）
    const headP = oval(ctx, -s * 0.15, -s * 0.92, s * 0.22, s * 0.19, -0.2);
    headP();
    ctx.fillStyle = bodyGrad(ctx, -s * 0.5, -s * 1.15, 0, -s * 0.65, kb, 0.25, 0.65);
    ctx.fill();
    inside(ctx, headP, () => shade(ctx, -s * 0.4, -s * 1.12, s * 0.1, -s * 0.72, 0.4));
    rimEdge(ctx, headP, '#e8ff9a', 0.4, s * 0.04, s * 0.03, s * 0.03);
    ctx.fillStyle = bodyGrad(ctx, -s * 0.05, -s * 1.05, s * 0.55, -s * 0.85, kb, 0.25, 0.65);
    ctx.beginPath();
    ctx.moveTo(-s * 0.02, -s * 0.98);
    ctx.quadraticCurveTo(s * 0.35, -s * 1.05, s * 0.55, -s * 0.88);
    ctx.quadraticCurveTo(s * 0.25, -s * 0.9, -s * 0.0, -s * 0.84);
    ctx.fill();
    rune(ctx, [[s * 0.02, -s * 0.92], [s * 0.28, -s * 0.95], [s * 0.5, -s * 0.89]], '#d8ff8a', Math.max(0.6, s * 0.015), 0.4);
    // 小鼻子
    ctx.fillStyle = bodyGrad(ctx, -s * 0.45, -s * 0.95, -s * 0.3, -s * 0.8, kb, 0.25, 0.65);
    ctx.beginPath();
    ctx.moveTo(-s * 0.32, -s * 0.94);
    ctx.quadraticCurveTo(-s * 0.45, -s * 0.88, -s * 0.4, -s * 0.83);
    ctx.quadraticCurveTo(-s * 0.34, -s * 0.83, -s * 0.28, -s * 0.85);
    ctx.fill();
    eyes(ctx, -s * 0.25, -s * 0.94, s * 0.12, s * 0.05, '#e8ff9a', -0.25);
    // 王冠：金属渐变 + 冠带上三颗发光的宝石 + 尖上的小金珠
    glow(ctx, -s * 0.12, -s * 1.2, s * 0.45, '#ffd27a', 0.6);
    const crownP = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.32, -s * 1.08);
      for (let i = 0; i <= 4; i++) ctx.lineTo(-s * 0.32 + i * s * 0.1, -s * (i % 2 ? 1.16 : 1.32));
      ctx.lineTo(s * 0.08, -s * 1.08);
      ctx.closePath();
    };
    crownP();
    ctx.fillStyle = linear(ctx, s * 0.08, -s * 1.32, -s * 0.32, -s * 1.08, [[0, '#fff6c0'], [0.45, '#ffd96a'], [1, '#a8741e']]);
    ctx.fill();
    ctx.fillStyle = 'rgba(120,70,10,0.45)';
    ctx.fillRect(-s * 0.32, -s * 1.135, s * 0.4, s * 0.055);
    rimEdge(ctx, crownP, '#fffbe0', 0.6, s * 0.03, s * 0.02, s * 0.02);
    for (const [gx, col] of [[-0.22, '#ff6a8a'], [-0.12, '#7ad0ff'], [-0.02, '#9aff8a']]) dot(ctx, s * gx, -s * 1.108, s * 0.022, col, 0.95);
    for (const i of [0, 2, 4]) dot(ctx, -s * 0.32 + i * s * 0.1, -s * 1.33, s * 0.02, '#fff0b0', 0.9);
    sparkles(ctx, -s * 0.12, -s * 1.25, s * 0.4, s * 0.15, 3, t, '#ffe9a0', 29, 1.2);
    ctx.restore();
    ctx.restore();
  };
})((globalThis.TD = globalThis.TD || {}));
