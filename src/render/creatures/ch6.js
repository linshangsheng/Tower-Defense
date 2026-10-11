// 第六章 · 云端王国（设计书 56.4）的怪物画法：工具函数（发光、眼睛、符文、胶质、四足……）在 creatures.js
(function (TD) {
  'use strict';

  const K = TD.creatures;
  const D = K.drawers;
  const TAU = Math.PI * 2;
  const { deep, light, rgba, bodyGrad, glow, shadow, eyes, rune, dot, wing, jelly, jellyEyes, quadruped } = K;

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
})((globalThis.TD = globalThis.TD || {}));
