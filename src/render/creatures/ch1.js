// 第一章 · 翠绿草原（设计书 56.4）的怪物画法：工具函数（发光、眼睛、符文、胶质、四足……）在 creatures.js
(function (TD) {
  'use strict';

  const K = TD.creatures;
  const D = K.drawers;
  const TAU = Math.PI * 2;
  const { deep, light, rgba, bodyGrad, glow, shadow, eyes, rune, dot, wing, jelly, jellyEyes, quadruped, seeded, strokes, speckle, scales, veins, sparkles, rimEdge, linear, radial } = K;

  // ======================================================================
  // 第一章 · 翠绿草原（设计书 56.4）
  // ======================================================================

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
