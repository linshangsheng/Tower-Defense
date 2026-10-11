// 第四章 · 冰霜雪原（设计书 56.4）的怪物画法：工具函数（发光、眼睛、符文、胶质、四足……）在 creatures.js
(function (TD) {
  'use strict';

  const K = TD.creatures;
  const D = K.drawers;
  const TAU = Math.PI * 2;
  const { deep, light, rgba, bodyGrad, glow, shadow, eyes, rune, dot, wing, jelly, jellyEyes, quadruped } = K;

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
})((globalThis.TD = globalThis.TD || {}));
