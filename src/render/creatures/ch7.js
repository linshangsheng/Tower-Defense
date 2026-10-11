// 第七章 · 珊瑚海湾（设计书 56.4）的怪物画法：工具函数（发光、眼睛、符文、胶质、四足……）在 creatures.js
(function (TD) {
  'use strict';

  const K = TD.creatures;
  const D = K.drawers;
  const TAU = Math.PI * 2;
  const { deep, light, rgba, bodyGrad, glow, shadow, eyes, rune, dot, wing, jelly, jellyEyes, quadruped } = K;

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
