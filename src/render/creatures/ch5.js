// 第五章 · 熔岩裂隙（设计书 56.4）的怪物画法：工具函数（发光、眼睛、符文、胶质、四足……）在 creatures.js
(function (TD) {
  'use strict';

  const K = TD.creatures;
  const D = K.drawers;
  const TAU = Math.PI * 2;
  const { deep, light, rgba, bodyGrad, glow, shadow, eyes, rune, dot, wing, jelly, jellyEyes, quadruped } = K;

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
})((globalThis.TD = globalThis.TD || {}));
