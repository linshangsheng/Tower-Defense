// 第二章 · 黄金沙漠（设计书 56.4）的怪物画法：工具函数（发光、眼睛、符文、胶质、四足……）在 creatures.js
(function (TD) {
  'use strict';

  const K = TD.creatures;
  const D = K.drawers;
  const TAU = Math.PI * 2;
  const { deep, light, rgba, bodyGrad, glow, shadow, eyes, rune, dot, wing, jelly, jellyEyes, quadruped } = K;

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
})((globalThis.TD = globalThis.TD || {}));
