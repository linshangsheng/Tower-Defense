// Q 版角色与怪物的程序化绘制（原型阶段的占位美术，设计书 10 章、17.2）
(function (TD) {
  'use strict';

  const S = (TD.sprites = {});

  function ellipse(ctx, x, y, rx, ry, fill, stroke, lw) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.lineWidth = lw || 2;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }
  S.ellipse = ellipse;

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  S.roundRect = roundRect;

  const OUTLINE = '#3b2a1e';

  // 圆眼睛（看向左边，也就是城墙方向）
  function eyes(ctx, x, y, gap, r, look) {
    look = look === undefined ? -1 : look;
    for (const dx of [-gap / 2, gap / 2]) {
      ellipse(ctx, x + dx, y, r, r * 1.15, '#fff', OUTLINE, 1.5);
      ellipse(ctx, x + dx + look * r * 0.35, y + r * 0.1, r * 0.55, r * 0.65, '#2a1d14');
      ellipse(ctx, x + dx + look * r * 0.35 - r * 0.2, y - r * 0.25, r * 0.2, r * 0.2, '#fff');
    }
  }

  function squintEyes(ctx, x, y, gap, r) {
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    for (const [dx, dir] of [
      [-gap / 2, 1],
      [gap / 2, -1],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x + dx - r * dir, y - r * 0.7);
      ctx.lineTo(x + dx + r * 0.3 * dir, y);
      ctx.lineTo(x + dx - r * dir, y + r * 0.7);
      ctx.stroke();
    }
  }

  function blush(ctx, x, y, gap, r) {
    ctx.globalAlpha *= 0.45;
    ellipse(ctx, x - gap / 2, y, r, r * 0.6, '#ff7b9c');
    ellipse(ctx, x + gap / 2, y, r, r * 0.6, '#ff7b9c');
    ctx.globalAlpha /= 0.45;
  }

  function shadow(ctx, x, y, w) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ellipse(ctx, x, y, w, w * 0.28, '#000');
    ctx.restore();
  }
  S.shadow = shadow;

  function lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255;
    let g = (n >> 8) & 255;
    let b = n & 255;
    r = Math.round(r + (255 - r) * amt);
    g = Math.round(g + (255 - g) * amt);
    b = Math.round(b + (255 - b) * amt);
    return `rgb(${r},${g},${b})`;
  }
  function darken(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * (1 - amt));
    const g = Math.round(((n >> 8) & 255) * (1 - amt));
    const b = Math.round((n & 255) * (1 - amt));
    return `rgb(${r},${g},${b})`;
  }
  S.lighten = lighten;
  S.darken = darken;

  // ---------- 怪物 ----------
  // m: 怪物实体或 { def, ... }；t：时间；opts.flash：受击闪白；opts.attack：攻城中
  S.monster = function (ctx, type, x, y, size, t, opts) {
    opts = opts || {};
    const fn = S.drawers[type] || S.drawers.slime;
    ctx.save();
    ctx.translate(x, y);
    if (opts.scale) ctx.scale(opts.scale, opts.scale);
    fn(ctx, size, t, opts);
    if (opts.flash > 0) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = Math.min(1, opts.flash * 7);
      ctx.fillStyle = '#fff';
      ctx.fillRect(-size * 2, -size * 3, size * 4, size * 4);
    }
    ctx.restore();
  };

  function slimeBody(ctx, s, t, color, opts) {
    const wob = Math.sin(t * 6 + (opts.seed || 0)) * 0.08;
    const bite = opts.attack ? Math.max(0, Math.sin(t * 12)) * 0.12 : 0;
    const w = s * (1 + wob + bite);
    const h = s * (0.85 - wob - bite * 0.5);
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    ctx.bezierCurveTo(-w, -h * 1.5, w, -h * 1.5, w, 0);
    ctx.quadraticCurveTo(0, h * 0.28, -w, 0);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.92;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.strokeStyle = darken(color, 0.45);
    ctx.stroke();
    ellipse(ctx, -w * 0.45, -h * 0.85, w * 0.22, h * 0.16, 'rgba(255,255,255,0.65)');
    return h;
  }

  S.drawers = {
    slime(ctx, s, t, o) {
      shadow(ctx, 0, 2, s);
      const h = slimeBody(ctx, s, t, '#6fd36a', o);
      eyes(ctx, -s * 0.15, -h * 0.55, s * 0.62, s * 0.2);
      blush(ctx, -s * 0.15, -h * 0.25, s * 0.95, s * 0.13);
    },
    minijelly(ctx, s, t, o) {
      shadow(ctx, 0, 2, s);
      const h = slimeBody(ctx, s, t, '#7fd0ff', o);
      eyes(ctx, -s * 0.15, -h * 0.55, s * 0.62, s * 0.22);
    },
    jellyPrince(ctx, s, t, o) {
      shadow(ctx, 0, 2, s);
      const h = slimeBody(ctx, s, t, '#5bbcf5', o);
      eyes(ctx, -s * 0.15, -h * 0.6, s * 0.55, s * 0.16);
      blush(ctx, -s * 0.15, -h * 0.32, s * 0.9, s * 0.1);
      // 小嘴
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-s * 0.15, -h * 0.4, s * 0.08, 0.1, Math.PI - 0.1);
      ctx.stroke();
      // 王冠
      ctx.save();
      ctx.translate(s * 0.05, -h * 1.12);
      ctx.rotate(-0.15);
      crown(ctx, s * 0.5, '#ffd23f');
      ctx.restore();
    },
    bunny(ctx, s, t, o) {
      const hop = Math.abs(Math.sin(t * 14 + (o.seed || 0))) * s * (o.attack ? 0.15 : 0.5);
      shadow(ctx, 0, 2, s * 0.9);
      ctx.translate(0, -hop);
      // 耳朵
      for (const dx of [-0.25, 0.25]) {
        ctx.save();
        ctx.translate(s * dx, -s * 1.2);
        ctx.rotate(0.3 + dx * 0.8 + Math.sin(t * 10) * 0.08);
        ellipse(ctx, 0, -s * 0.5, s * 0.22, s * 0.62, '#fbe3ec', OUTLINE, 1.8);
        ellipse(ctx, 0, -s * 0.45, s * 0.1, s * 0.45, '#f4a6bf');
        ctx.restore();
      }
      ellipse(ctx, 0, -s * 0.6, s * 0.95, s * 0.75, '#fbe3ec', OUTLINE, 2);
      ellipse(ctx, s * 0.85, -s * 0.45, s * 0.22, s * 0.22, '#fff', OUTLINE, 1.5);
      squintEyes(ctx, -s * 0.2, -s * 0.72, s * 0.62, s * 0.18);
      blush(ctx, -s * 0.2, -s * 0.42, s * 0.95, s * 0.13);
    },
    mushroom(ctx, s, t, o) {
      const step = Math.sin(t * 9 + (o.seed || 0));
      shadow(ctx, 0, 2, s * 0.8);
      // 小脚
      ellipse(ctx, -s * 0.3 + step * 3, -s * 0.05, s * 0.18, s * 0.12, '#8a5a3c');
      ellipse(ctx, s * 0.3 - step * 3, -s * 0.05, s * 0.18, s * 0.12, '#8a5a3c');
      roundRect(ctx, -s * 0.5, -s * 0.85, s, s * 0.8, s * 0.3);
      ctx.fillStyle = '#fff2dc';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      eyes(ctx, -s * 0.08, -s * 0.48, s * 0.42, s * 0.14);
      // 伞盖
      ctx.beginPath();
      ctx.moveTo(-s * 1.05, -s * 0.8);
      ctx.bezierCurveTo(-s * 1.05, -s * 1.9, s * 1.05, -s * 1.9, s * 1.05, -s * 0.8);
      ctx.quadraticCurveTo(0, -s * 0.6, -s * 1.05, -s * 0.8);
      ctx.fillStyle = '#e8524a';
      ctx.fill();
      ctx.stroke();
      ellipse(ctx, -s * 0.45, -s * 1.2, s * 0.17, s * 0.14, '#fff');
      ellipse(ctx, s * 0.2, -s * 1.4, s * 0.2, s * 0.16, '#fff');
      ellipse(ctx, s * 0.62, -s * 1.05, s * 0.13, s * 0.11, '#fff');
    },
    bee(ctx, s, t, o) {
      const bob = Math.sin(t * 8 + (o.seed || 0)) * 3;
      ctx.save();
      ctx.globalAlpha = 0.12;
      ellipse(ctx, 0, 34, s * 0.8, s * 0.22, '#000');
      ctx.restore();
      ctx.translate(0, bob);
      // 翅膀
      const flap = Math.abs(Math.sin(t * 40)) * 0.6 + 0.4;
      ctx.globalAlpha = 0.75;
      ellipse(ctx, s * 0.1, -s * 0.9, s * 0.42, s * 0.6 * flap, '#e8f7ff', '#9cc7dd', 1.5);
      ellipse(ctx, s * 0.55, -s * 0.8, s * 0.35, s * 0.5 * flap, '#e8f7ff', '#9cc7dd', 1.5);
      ctx.globalAlpha = 1;
      ctx.save();
      ellipse(ctx, 0, -s * 0.3, s, s * 0.78, '#ffd23f', OUTLINE, 2);
      ctx.clip();
      ctx.fillStyle = '#3b2a1e';
      ctx.fillRect(s * 0.05, -s * 1.2, s * 0.25, s * 2);
      ctx.fillRect(s * 0.55, -s * 1.2, s * 0.22, s * 2);
      ctx.restore();
      ellipse(ctx, 0, -s * 0.3, s, s * 0.78, null, OUTLINE, 2);
      // 尾刺
      ctx.beginPath();
      ctx.moveTo(s * 0.95, -s * 0.35);
      ctx.lineTo(s * 1.35, -s * 0.25);
      ctx.lineTo(s * 0.92, -s * 0.12);
      ctx.fillStyle = OUTLINE;
      ctx.fill();
      eyes(ctx, -s * 0.5, -s * 0.42, s * 0.42, s * 0.17);
    },
    goblin(ctx, s, t, o) {
      goblinBody(ctx, s, t, o, '#7cae5b', true);
    },
    gobling(ctx, s, t, o) {
      goblinBody(ctx, s, t, o, '#8cc06b', false);
    },
    boarKing(ctx, s, t, o) {
      const ai = o.ai || {};
      const run = ai.mode === 'charge' ? 3 : ai.mode === 'hold' ? 0.3 : 1;
      const gal = Math.sin(t * 8 * run) * (ai.mode === 'hold' ? 1 : 3);
      shadow(ctx, 0, 2, s * 1.1);
      ctx.save();
      if (ai.mode === 'warn') ctx.translate(Math.sin(t * 50) * 2, 0);
      // 野猪
      for (const [lx, ph] of [
        [-0.6, 0],
        [-0.25, 1.5],
        [0.35, 3],
        [0.7, 4.5],
      ]) {
        const k = Math.sin(t * 8 * run + ph) * 4;
        roundRect(ctx, s * lx - 5 + k * 0.5, -s * 0.35, 10, s * 0.38, 4);
        ctx.fillStyle = '#6b4a35';
        ctx.fill();
      }
      ctx.translate(0, gal * 0.3);
      ellipse(ctx, s * 0.05, -s * 0.62, s * 1.05, s * 0.5, '#9a6b4f', OUTLINE, 2.5);
      // 鬃毛
      ctx.fillStyle = '#5b3c2a';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(s * (-0.2 + i * 0.22), -s * 1.05);
        ctx.lineTo(s * (-0.1 + i * 0.22), -s * 1.28);
        ctx.lineTo(s * (0.02 + i * 0.22), -s * 1.05);
        ctx.fill();
      }
      // 猪头
      ellipse(ctx, -s * 0.85, -s * 0.6, s * 0.48, s * 0.42, '#a87658', OUTLINE, 2.5);
      ellipse(ctx, -s * 1.22, -s * 0.5, s * 0.2, s * 0.17, '#e7a5a0', OUTLINE, 2);
      ellipse(ctx, -s * 1.27, -s * 0.5, s * 0.04, s * 0.06, OUTLINE);
      ellipse(ctx, -s * 1.17, -s * 0.5, s * 0.04, s * 0.06, OUTLINE);
      // 獠牙
      ctx.fillStyle = '#fff8e0';
      ctx.beginPath();
      ctx.moveTo(-s * 1.12, -s * 0.36);
      ctx.quadraticCurveTo(-s * 1.3, -s * 0.4, -s * 1.28, -s * 0.62);
      ctx.lineTo(-s * 1.2, -s * 0.38);
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ellipse(ctx, -s * 0.9, -s * 0.78, s * 0.08, s * 0.1, '#fff', OUTLINE, 1.5);
      ellipse(ctx, -s * 0.93, -s * 0.76, s * 0.04, s * 0.06, OUTLINE);
      if (ai.mode === 'warn' || ai.mode === 'charge') {
        // 生气的眉毛
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-s * 1.02, -s * 0.95);
        ctx.lineTo(-s * 0.8, -s * 0.86);
        ctx.stroke();
      }
      // 骑手：哥布林国王
      ctx.save();
      ctx.translate(s * 0.2, -s * 1.1);
      ellipse(ctx, 0, 0, s * 0.42, s * 0.36, '#c94b4b', OUTLINE, 2);
      ellipse(ctx, -s * 0.05, -s * 0.48, s * 0.4, s * 0.34, '#7cae5b', OUTLINE, 2);
      // 尖耳
      ctx.fillStyle = '#7cae5b';
      ctx.beginPath();
      ctx.moveTo(s * 0.3, -s * 0.52);
      ctx.lineTo(s * 0.62, -s * 0.66);
      ctx.lineTo(s * 0.32, -s * 0.38);
      ctx.fill();
      ctx.stroke();
      eyes(ctx, -s * 0.15, -s * 0.5, s * 0.3, s * 0.1);
      ctx.translate(s * 0.02, -s * 0.85);
      ctx.rotate(0.35);
      crown(ctx, s * 0.36, '#ffd23f');
      ctx.restore();
      ctx.restore();
    },

    // ---------- 第二章 · 黄金沙漠 ----------
    scorpion(ctx, s, t, o) {
      const step = Math.sin(t * 14 + (o.seed || 0));
      shadow(ctx, 0, 2, s * 0.95);
      // 小腿
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const lx = -s * 0.4 + i * s * 0.4;
        ctx.beginPath();
        ctx.moveTo(lx, -s * 0.25);
        ctx.lineTo(lx - 4 + step * 2 * (i % 2 ? 1 : -1), 0);
        ctx.stroke();
      }
      ellipse(ctx, 0, -s * 0.4, s * 0.85, s * 0.5, '#e0a050', OUTLINE, 2);
      // 尾巴与小球
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.fillStyle = '#e0a050';
      const wag = Math.sin(t * 6) * 0.15;
      ctx.save();
      ctx.translate(s * 0.7, -s * 0.5);
      ctx.rotate(-0.9 + wag);
      for (let i = 0; i < 3; i++) ellipse(ctx, i * s * 0.32, 0, s * 0.2, s * 0.17, '#e7ad5c', OUTLINE, 1.8);
      ellipse(ctx, s * 1.0, -s * 0.05, s * 0.2, s * 0.2, '#c96f2e', OUTLINE, 1.8);
      ctx.restore();
      // 钳子
      for (const dy of [-0.15, 0.15]) {
        ellipse(ctx, -s * 0.95, -s * 0.4 + dy * s * 2, s * 0.25, s * 0.17, '#e7ad5c', OUTLINE, 1.8);
      }
      eyes(ctx, -s * 0.35, -s * 0.55, s * 0.36, s * 0.15);
    },
    kingScorpion(ctx, s, t, o) {
      const step = Math.sin(t * 9 + (o.seed || 0));
      shadow(ctx, 0, 2, s * 1.1);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const lx = -s * 0.5 + i * s * 0.35;
        ctx.beginPath();
        ctx.moveTo(lx, -s * 0.25);
        ctx.lineTo(lx - 6 + step * 3 * (i % 2 ? 1 : -1), 0);
        ctx.stroke();
      }
      ellipse(ctx, 0, -s * 0.45, s * 0.95, s * 0.52, '#d9822b', OUTLINE, 2.5);
      ellipse(ctx, -s * 0.2, -s * 0.62, s * 0.4, s * 0.16, 'rgba(255,255,255,0.35)');
      const wag = Math.sin(t * 4) * 0.12;
      ctx.save();
      ctx.translate(s * 0.75, -s * 0.55);
      ctx.rotate(-1.0 + wag);
      for (let i = 0; i < 4; i++) ellipse(ctx, i * s * 0.28, 0, s * 0.17, s * 0.15, '#e48f38', OUTLINE, 2);
      ctx.fillStyle = '#7a2f12';
      ctx.beginPath();
      ctx.moveTo(s * 1.05, -s * 0.12);
      ctx.lineTo(s * 1.4, -s * 0.02);
      ctx.lineTo(s * 1.05, s * 0.12);
      ctx.fill();
      ctx.restore();
      // 巨大的钳子（比身体还大）
      const snap = o.attack ? Math.abs(Math.sin(t * 6)) * 0.4 : 0.15;
      for (const dir of [-1, 1]) {
        ctx.save();
        ctx.translate(-s * 1.0, -s * 0.45 + dir * s * 0.3);
        ellipse(ctx, -s * 0.3, 0, s * 0.42, s * 0.3, '#e48f38', OUTLINE, 2.5);
        ctx.rotate(dir * snap);
        ctx.beginPath();
        ctx.moveTo(-s * 0.5, 0);
        ctx.quadraticCurveTo(-s * 1.0, -dir * s * 0.35, -s * 1.1, -dir * s * 0.05);
        ctx.lineTo(-s * 0.6, 0);
        ctx.fillStyle = '#e48f38';
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      eyes(ctx, -s * 0.35, -s * 0.62, s * 0.36, s * 0.12);
      ctx.save();
      ctx.translate(-s * 0.1, -s * 0.95);
      crown(ctx, s * 0.36, '#ffd23f');
      ctx.restore();
    },
    mummy(ctx, s, t, o) {
      const roll = Math.sin(t * 5 + (o.seed || 0)) * 0.06;
      shadow(ctx, 0, 2, s * 0.85);
      ctx.save();
      ctx.translate(0, -s * 0.85);
      ctx.rotate(roll);
      ellipse(ctx, 0, 0, s * 0.9, s * 0.85, '#efe4c8', OUTLINE, 2);
      ctx.save();
      ellipse(ctx, 0, 0, s * 0.9, s * 0.85, null);
      ctx.clip();
      ctx.strokeStyle = '#c9b993';
      ctx.lineWidth = 2;
      for (let i = -4; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-s, i * s * 0.22 - s * 0.2);
        ctx.lineTo(s, i * s * 0.22 + s * 0.15);
        ctx.stroke();
      }
      ctx.restore();
      // 眼缝
      ctx.fillStyle = '#2a1d14';
      ctx.fillRect(-s * 0.62, -s * 0.28, s * 0.8, s * 0.32);
      ellipse(ctx, -s * 0.42, -s * 0.12, s * 0.12, s * 0.12, '#ffeb6b');
      ellipse(ctx, -s * 0.05, -s * 0.12, s * 0.12, s * 0.12, '#ffeb6b');
      // 飘带
      ctx.strokeStyle = '#efe4c8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(s * 0.6, s * 0.2);
      ctx.quadraticCurveTo(s * 1.0, s * 0.3 + Math.sin(t * 6) * 4, s * 1.2, s * 0.1);
      ctx.stroke();
      ctx.restore();
    },
    cactus(ctx, s, t, o) {
      const spin = -t * 4 - (o.seed || 0);
      shadow(ctx, 0, 2, s * 0.85);
      ctx.save();
      ctx.translate(0, -s * 0.85);
      ellipse(ctx, 0, 0, s * 0.85, s * 0.85, '#5fb85a', OUTLINE, 2);
      ctx.save();
      ctx.rotate(spin);
      ctx.strokeStyle = '#3d7a2f';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.85, s * (0.25 + i * 0.2), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.strokeStyle = '#fff8e0';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * s * 0.85, Math.sin(a) * s * 0.85);
        ctx.lineTo(Math.cos(a) * s * 1.05, Math.sin(a) * s * 1.05);
        ctx.stroke();
      }
      ctx.restore();
      eyes(ctx, -s * 0.2, -s * 0.05, s * 0.45, s * 0.16);
      // 抱着的小花
      ellipse(ctx, s * 0.1, -s * 0.85, s * 0.18, s * 0.18, '#ff7bb0', OUTLINE, 1.5);
      ellipse(ctx, s * 0.1, -s * 0.85, s * 0.07, s * 0.07, '#ffd23f');
      ctx.restore();
    },
    vulture(ctx, s, t, o) {
      const flap = Math.sin(t * 14 + (o.seed || 0));
      ctx.save();
      ctx.globalAlpha = 0.12;
      ellipse(ctx, 0, 34, s * 0.9, s * 0.22, '#000');
      ctx.restore();
      ctx.translate(0, Math.sin(t * 6) * 3);
      // 翅膀
      ctx.fillStyle = '#6b4f3a';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-s * 0.1, -s * 0.5);
      ctx.quadraticCurveTo(s * 0.6, -s * (1.3 + flap * 0.5), s * 1.3, -s * (0.8 + flap * 0.6));
      ctx.quadraticCurveTo(s * 0.7, -s * 0.4, s * 0.3, -s * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ellipse(ctx, s * 0.2, -s * 0.35, s * 0.75, s * 0.45, '#8a6a50', OUTLINE, 2);
      // 白色毛领与光头
      ellipse(ctx, -s * 0.45, -s * 0.5, s * 0.32, s * 0.26, '#f3ead8', OUTLINE, 1.8);
      ellipse(ctx, -s * 0.8, -s * 0.72, s * 0.36, s * 0.32, '#f2a6a0', OUTLINE, 2);
      ctx.fillStyle = '#ffcf4a';
      ctx.beginPath();
      ctx.moveTo(-s * 1.1, -s * 0.72);
      ctx.lineTo(-s * 1.38, -s * 0.6);
      ctx.lineTo(-s * 1.08, -s * 0.55);
      ctx.fill();
      ctx.stroke();
      eyes(ctx, -s * 0.85, -s * 0.8, s * 0.26, s * 0.13);
    },
    priest(ctx, s, t, o) {
      const sway = Math.sin(t * 4 + (o.seed || 0)) * 0.08;
      shadow(ctx, 0, 2, s * 0.75);
      ctx.save();
      ctx.rotate(sway);
      // 袍子
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, 0);
      ctx.quadraticCurveTo(-s * 0.6, -s * 1.0, 0, -s * 1.05);
      ctx.quadraticCurveTo(s * 0.6, -s * 1.0, s * 0.7, 0);
      ctx.closePath();
      ctx.fillStyle = '#9a6bd5';
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.stroke();
      // 猫头
      ellipse(ctx, 0, -s * 1.3, s * 0.55, s * 0.48, '#f7d9a8', OUTLINE, 2);
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(d * s * 0.2, -s * 1.7);
        ctx.lineTo(d * s * 0.45, -s * 1.95);
        ctx.lineTo(d * s * 0.5, -s * 1.55);
        ctx.fillStyle = '#f7d9a8';
        ctx.fill();
        ctx.stroke();
      }
      // 头巾
      ctx.beginPath();
      ctx.moveTo(-s * 0.58, -s * 1.38);
      ctx.quadraticCurveTo(0, -s * 1.95, s * 0.58, -s * 1.38);
      ctx.quadraticCurveTo(0, -s * 1.6, -s * 0.58, -s * 1.38);
      ctx.fillStyle = '#fff2dc';
      ctx.fill();
      ctx.stroke();
      squintEyes(ctx, -s * 0.05, -s * 1.25, s * 0.4, s * 0.1);
      ctx.restore();
      // 法杖与光球
      ctx.strokeStyle = '#8a5a3c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, -s * 0.1);
      ctx.lineTo(-s * 0.7, -s * 1.5);
      ctx.stroke();
      const glow = 0.6 + Math.sin(t * 6) * 0.3;
      ctx.globalAlpha = glow;
      ellipse(ctx, -s * 0.7, -s * 1.6, s * 0.22, s * 0.22, '#7dff9a', '#3d7a2f', 1.5);
      ctx.globalAlpha = 1;
    },
    pharaoh(ctx, s, t, o) {
      const ai = o.ai || {};
      const float = Math.sin(t * 2.5) * 5;
      shadow(ctx, 0, 2, s * 1.1);
      ctx.save();
      ctx.translate(0, -s * 0.35 + float);
      // 金棺材
      roundRect(ctx, -s * 1.1, -s * 0.35, s * 2.2, s * 0.6, s * 0.2);
      ctx.fillStyle = '#e8b830';
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#5b8fd5';
      for (let i = 0; i < 5; i++) ctx.fillRect(-s * 0.9 + i * s * 0.42, -s * 0.2, s * 0.18, s * 0.3);
      // 圆滚滚的身体
      ellipse(ctx, 0, -s * 0.85, s * 0.75, s * 0.62, '#fff2dc', OUTLINE, 2.5);
      ctx.fillStyle = '#5b8fd5';
      ctx.fillRect(-s * 0.6, -s * 0.65, s * 1.2, s * 0.12);
      // 脸
      ellipse(ctx, 0, -s * 1.5, s * 0.5, s * 0.45, '#e8c49a', OUTLINE, 2);
      // 法老头巾（条纹）
      ctx.beginPath();
      ctx.moveTo(-s * 0.55, -s * 1.55);
      ctx.quadraticCurveTo(-s * 0.6, -s * 2.15, 0, -s * 2.2);
      ctx.quadraticCurveTo(s * 0.6, -s * 2.15, s * 0.55, -s * 1.55);
      ctx.lineTo(s * 0.75, -s * 0.95);
      ctx.lineTo(s * 0.45, -s * 1.0);
      ctx.lineTo(s * 0.38, -s * 1.45);
      ctx.lineTo(-s * 0.38, -s * 1.45);
      ctx.lineTo(-s * 0.45, -s * 1.0);
      ctx.lineTo(-s * 0.75, -s * 0.95);
      ctx.closePath();
      ctx.fillStyle = '#ffd23f';
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#5b8fd5';
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-s * 0.55, -s * (1.75 + i * 0.13));
        ctx.quadraticCurveTo(0, -s * (1.95 + i * 0.13), s * 0.55, -s * (1.75 + i * 0.13));
        ctx.stroke();
      }
      eyes(ctx, -s * 0.08, -s * 1.5, s * 0.38, s * 0.13);
      // 胡子
      ctx.fillStyle = '#5b8fd5';
      ctx.fillRect(-s * 0.08, -s * 1.15, s * 0.16, s * 0.22);
      ctx.restore();
      if (ai.phase === 3 && o.shield > 0) {
        // 金字塔护盾
        const a = 0.35 + Math.sin(t * 5) * 0.1;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = '#ffe58a';
        ctx.strokeStyle = '#c99a12';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, -s * 2.9);
        ctx.lineTo(s * 1.6, s * 0.15);
        ctx.lineTo(-s * 1.6, s * 0.15);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = Math.min(1, a + 0.4);
        ctx.stroke();
        ctx.restore();
      }
    },
  };

  function goblinBody(ctx, s, t, o, color, shield) {
    const step = Math.sin(t * 8 + (o.seed || 0));
    shadow(ctx, 0, 2, s * 0.8);
    ellipse(ctx, -s * 0.25 + step * 3, -s * 0.1, s * 0.18, s * 0.12, '#5b3c2a');
    ellipse(ctx, s * 0.25 - step * 3, -s * 0.1, s * 0.18, s * 0.12, '#5b3c2a');
    ellipse(ctx, 0, -s * 0.55, s * 0.55, s * 0.5, '#a0784f', OUTLINE, 2);
    ellipse(ctx, 0, -s * 1.15, s * 0.6, s * 0.52, color, OUTLINE, 2);
    ctx.fillStyle = color;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    for (const d of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(d * s * 0.5, -s * 1.25);
      ctx.lineTo(d * s * 1.0, -s * 1.45);
      ctx.lineTo(d * s * 0.55, -s * 1.0);
      ctx.fill();
      ctx.stroke();
    }
    eyes(ctx, -s * 0.12, -s * 1.15, s * 0.45, s * 0.15);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-s * 0.32, -s * 0.9);
    ctx.lineTo(-s * 0.02, -s * 0.92);
    ctx.stroke();
    if (shield) {
      // 木盾在身体前方（左侧）
      const bump = o.attack ? Math.max(0, Math.sin(t * 10)) * 4 : 0;
      ctx.save();
      ctx.translate(-s * 0.72 - bump, -s * 0.7);
      roundRect(ctx, -s * 0.22, -s * 0.55, s * 0.44, s * 1.0, s * 0.18);
      ctx.fillStyle = '#b07a43';
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.strokeStyle = '#7d5128';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-s * 0.1, -s * 0.5);
      ctx.lineTo(-s * 0.1, s * 0.4);
      ctx.moveTo(s * 0.08, -s * 0.5);
      ctx.lineTo(s * 0.08, s * 0.4);
      ctx.stroke();
      ellipse(ctx, 0, -s * 0.05, s * 0.09, s * 0.09, '#c9c9c9', OUTLINE, 1.2);
      ctx.restore();
    } else {
      // 小长矛
      ctx.strokeStyle = '#7d5128';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-s * 0.2, -s * 0.2);
      ctx.lineTo(-s * 1.0, -s * 0.95);
      ctx.stroke();
      ctx.fillStyle = '#d0d0d0';
      ctx.beginPath();
      ctx.moveTo(-s * 1.0, -s * 0.95);
      ctx.lineTo(-s * 1.25, -s * 1.15);
      ctx.lineTo(-s * 0.95, -s * 1.12);
      ctx.fill();
    }
  }

  function crown(ctx, w, color) {
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(-w / 2, -w * 0.45);
    ctx.lineTo(-w / 4, -w * 0.2);
    ctx.lineTo(0, -w * 0.55);
    ctx.lineTo(w / 4, -w * 0.2);
    ctx.lineTo(w / 2, -w * 0.45);
    ctx.lineTo(w / 2, 0);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ellipse(ctx, 0, -w * 0.12, w * 0.08, w * 0.08, '#e8524a');
  }
  S.crown = crown;

  // ---------- 英雄：铛铛 ----------
  // st: { weapon, aimAngle, shotAge, mood: 'idle'|'focus'|'worried'|'win'|'lose', t }
  S.hero = function (ctx, x, y, st) {
    const t = st.t;
    const s = 32;
    ctx.save();
    ctx.translate(x, y);
    let bob = Math.sin(t * 3) * 1.5;
    if (st.mood === 'win') bob = -Math.abs(Math.sin(t * 7)) * 14;
    if (st.mood === 'worried') ctx.translate(Math.sin(t * 30) * 1.2, 0);
    ctx.translate(0, bob);
    if (st.mood === 'lose') ctx.translate(0, 10);

    // 披风
    const capeWave = Math.sin(t * 5) * 3;
    ctx.beginPath();
    ctx.moveTo(-s * 0.45, -s * 1.15);
    ctx.quadraticCurveTo(-s * 1.1, -s * 0.4 + capeWave, -s * 0.8 + capeWave, s * 0.05);
    ctx.lineTo(s * 0.1, -s * 0.1);
    ctx.closePath();
    ctx.fillStyle = '#e04848';
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.stroke();
    // 背后小圆盾
    ellipse(ctx, -s * 0.55, -s * 0.65, s * 0.32, s * 0.36, '#c9a24a', OUTLINE, 2);
    ellipse(ctx, -s * 0.55, -s * 0.65, s * 0.12, s * 0.13, '#ffe08a');
    // 身体
    roundRect(ctx, -s * 0.38, -s * 1.0, s * 0.8, s * 0.95, s * 0.3);
    ctx.fillStyle = '#5b7bd5';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#8a5a3c';
    ctx.fillRect(-s * 0.38, -s * 0.42, s * 0.8, s * 0.12);
    // 脚
    ellipse(ctx, -s * 0.15, -s * 0.02, s * 0.17, s * 0.1, '#5b3c2a');
    ellipse(ctx, s * 0.2, -s * 0.02, s * 0.17, s * 0.1, '#5b3c2a');

    // 武器（指向目标）
    if (st.mood !== 'lose') {
      ctx.save();
      ctx.translate(s * 0.4, -s * 0.7);
      ctx.rotate(st.aimAngle || 0);
      S.weaponInHand(ctx, st.weapon, s, st.shotAge);
      if (st.ascended) {
        // 进阶武器：金色光点
        ctx.fillStyle = '#ffd23f';
        const tw = 0.6 + Math.sin(t * 8) * 0.4;
        ctx.globalAlpha = tw;
        star(ctx, s * 0.7, -s * 0.35, 5);
        star(ctx, s * 0.3, s * 0.4, 3.5);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }

    // 头
    ctx.save();
    const headTilt = st.critAge !== undefined && st.critAge < 0.25 ? Math.sin(st.critAge * 60) * 0.12 : 0;
    ctx.translate(0, -s * 1.45);
    ctx.rotate(headTilt);
    ellipse(ctx, 0, s * 0.12, s * 0.62, s * 0.55, '#ffd9b8', OUTLINE, 2);
    // 表情
    if (st.mood === 'lose') {
      squintEyes(ctx, s * 0.05, s * 0.2, s * 0.5, s * 0.12);
    } else if (st.mood === 'win') {
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.2;
      for (const dx of [-0.2, 0.3]) {
        ctx.beginPath();
        ctx.arc(s * dx, s * 0.24, s * 0.1, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
    } else {
      eyes(ctx, s * 0.05, s * 0.18, s * 0.5, s * 0.14, 1);
    }
    blush(ctx, s * 0.05, s * 0.4, s * 0.75, s * 0.1);
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (st.mood === 'focus') {
      ellipse(ctx, s * 0.12, s * 0.48, s * 0.07, s * 0.05, '#c46a5a');
    } else if (st.mood === 'worried' || st.mood === 'lose') {
      ctx.arc(s * 0.1, s * 0.56, s * 0.09, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    } else {
      ctx.arc(s * 0.1, s * 0.42, s * 0.1, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
    if (st.mood === 'worried') {
      ellipse(ctx, s * 0.62, -s * 0.05, s * 0.07, s * 0.11, '#7fd0ff');
    }
    // 大头盔
    ctx.beginPath();
    ctx.ellipse(0, s * 0.02, s * 0.78, s * 0.62, 0, Math.PI, Math.PI * 2);
    ctx.lineTo(s * 0.82, s * 0.08);
    ctx.lineTo(-s * 0.82, s * 0.08);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -s * 0.6, 0, s * 0.1);
    g.addColorStop(0, '#eef2f7');
    g.addColorStop(1, '#a9b4c2');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2;
    ctx.stroke();
    roundRect(ctx, -s * 0.86, -s * 0.02, s * 1.72, s * 0.16, s * 0.06);
    ctx.fillStyle = '#8c97a6';
    ctx.fill();
    ctx.stroke();
    ellipse(ctx, -s * 0.35, -s * 0.32, s * 0.14, s * 0.08, 'rgba(255,255,255,0.8)');
    // 红缨
    const tuft = Math.sin(t * 6) * 0.15;
    ctx.save();
    ctx.translate(0, -s * 0.58);
    ctx.rotate(tuft);
    ellipse(ctx, 0, -s * 0.14, s * 0.17, s * 0.17, '#ff5a4f', OUTLINE, 1.8);
    ellipse(ctx, -s * 0.05, -s * 0.2, s * 0.05, s * 0.04, '#ffb3ad');
    ctx.restore();
    if (st.critAge !== undefined && st.critAge < 0.4) {
      ctx.fillStyle = '#ffd23f';
      for (let i = 0; i < 3; i++) {
        const a = st.critAge * 8 + (i * Math.PI * 2) / 3;
        star(ctx, Math.cos(a) * s * 0.8, -s * 0.5 + Math.sin(a) * s * 0.25, 5);
      }
    }
    ctx.restore();
    ctx.restore();
  };

  S.weaponInHand = function (ctx, weapon, s, shotAge) {
    const pull = shotAge !== undefined && shotAge < 0.12 ? 1 - shotAge / 0.12 : 0;
    ctx.lineCap = 'round';
    if (weapon === 'crossbow') {
      roundRect(ctx, -s * 0.1, -s * 0.1, s * 0.9, s * 0.2, 3);
      ctx.fillStyle = '#8a5a3c';
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.strokeStyle = '#5b3c2a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(s * 0.6, -s * 0.45);
      ctx.quadraticCurveTo(s * 0.8, 0, s * 0.6, s * 0.45);
      ctx.stroke();
      ctx.strokeStyle = '#eee';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(s * 0.6, -s * 0.45);
      ctx.lineTo(s * 0.35 - pull * 4, 0);
      ctx.lineTo(s * 0.6, s * 0.45);
      ctx.stroke();
    } else if (weapon === 'staff') {
      ctx.strokeStyle = '#8a5a3c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-s * 0.1, s * 0.15);
      ctx.lineTo(s * 0.75, -s * 0.05);
      ctx.stroke();
      const glow = shotAge !== undefined && shotAge < 0.2 ? 1.6 : 1;
      ellipse(ctx, s * 0.82, -s * 0.06, s * 0.17 * glow, s * 0.17 * glow, '#c58cff', OUTLINE, 1.8);
      ellipse(ctx, s * 0.78, -s * 0.1, s * 0.05, s * 0.05, '#fff');
      ellipse(ctx, s * 0.15, 0, s * 0.13, s * 0.13, '#ffd9b8', OUTLINE, 1.5);
    } else if (weapon === 'cannon') {
      const kick = shotAge !== undefined && shotAge < 0.15 ? (1 - shotAge / 0.15) * 6 : 0;
      roundRect(ctx, -s * 0.2 - kick, -s * 0.2, s * 1.1, s * 0.4, s * 0.15);
      ctx.fillStyle = '#4a4a58';
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.stroke();
      ellipse(ctx, s * 0.9 - kick, 0, s * 0.08, s * 0.2, '#2a2a33');
      ellipse(ctx, s * 0.05, s * 0.05, s * 0.13, s * 0.13, '#ffd9b8', OUTLINE, 1.5);
    } else if (weapon === 'boomerang') {
      if (shotAge === undefined || shotAge > 0.5) {
        ctx.save();
        ctx.translate(s * 0.4, 0);
        S.boomerang(ctx, s * 0.5, 0);
        ctx.restore();
      }
      ellipse(ctx, s * 0.2, 0, s * 0.14, s * 0.14, '#ffd9b8', OUTLINE, 1.5);
    } else {
      ctx.strokeStyle = '#8a5a3c';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(s * 0.15, 0, s * 0.62, -1.2, 1.2);
      ctx.stroke();
      ctx.strokeStyle = '#f5f5f5';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(s * 0.15 + Math.cos(-1.2) * s * 0.62, Math.sin(-1.2) * s * 0.62);
      ctx.lineTo(s * 0.15 - pull * 8, 0);
      ctx.lineTo(s * 0.15 + Math.cos(1.2) * s * 0.62, Math.sin(1.2) * s * 0.62);
      ctx.stroke();
      ellipse(ctx, s * 0.12, 0, s * 0.13, s * 0.13, '#ffd9b8', OUTLINE, 1.5);
    }
  };

  S.boomerang = function (ctx, size, spin) {
    ctx.save();
    ctx.rotate(spin);
    ctx.beginPath();
    ctx.moveTo(-size, -size * 0.2);
    ctx.quadraticCurveTo(0, -size * 0.55, size * 0.15, size * 0.05);
    ctx.quadraticCurveTo(size * 0.1, -size * 0.95, size * 0.35, -size);
    ctx.quadraticCurveTo(size * 0.4, size * 0.35, -size, size * 0.1);
    ctx.closePath();
    ctx.fillStyle = '#e6a34a';
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();
  };

  function star(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }
  S.star = star;

  // 铜、银、金币图标
  S.coin = function (ctx, x, y, r, kind) {
    const colors = { copper: ['#e39a5a', '#b4692e'], silver: ['#e8edf2', '#9aa6b2'], gold: ['#ffd84a', '#c99a12'] }[kind || 'copper'];
    ellipse(ctx, x, y, r, r, colors[0], colors[1], Math.max(1, r * 0.22));
    ellipse(ctx, x - r * 0.3, y - r * 0.3, r * 0.28, r * 0.2, 'rgba(255,255,255,0.7)');
  };


  // ---------- 图标（技能、道具、补给按钮） ----------
  S.icon = function (ctx, id, cx, cy, r) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const k = r / 20;
    ctx.scale(k, k);
    const f = ICONS[id] || ICONS.default;
    f(ctx);
    ctx.restore();
  };

  function arrowShape(ctx, x, y, len, angle, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = '#8a5a3c';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-len / 2, 0);
    ctx.lineTo(len / 2 - 3, 0);
    ctx.stroke();
    ctx.fillStyle = color || '#cfd6de';
    ctx.beginPath();
    ctx.moveTo(len / 2 + 3, 0);
    ctx.lineTo(len / 2 - 5, -4.5);
    ctx.lineTo(len / 2 - 5, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  const ICONS = {
    default(ctx) {
      ellipse(ctx, 0, 0, 14, 14, '#ffd23f', OUTLINE, 2);
    },
    drum(ctx) {
      ellipse(ctx, 0, 6, 15, 7, '#c94b4b', OUTLINE, 2);
      ctx.fillStyle = '#e04848';
      ctx.fillRect(-15, -6, 30, 12);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.strokeRect(-15, -6, 30, 12);
      ellipse(ctx, 0, -6, 15, 7, '#fff2dc', OUTLINE, 2);
      ctx.strokeStyle = '#8a5a3c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-14, -20);
      ctx.lineTo(-3, -9);
      ctx.moveTo(14, -20);
      ctx.lineTo(3, -9);
      ctx.stroke();
    },
    repair(ctx) {
      ctx.fillStyle = '#c9c2b5';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      for (const [x, y] of [
        [-15, 2],
        [1, 2],
        [-7, -10],
      ]) {
        ctx.fillRect(x, y, 15, 11);
        ctx.strokeRect(x, y, 15, 11);
      }
      ctx.fillStyle = '#ff5a6e';
      ctx.beginPath();
      ctx.moveTo(10, -6);
      ctx.bezierCurveTo(10, -14, 20, -14, 18, -6);
      ctx.lineTo(10, 3);
      ctx.lineTo(2, -6);
      ctx.bezierCurveTo(0, -14, 10, -14, 10, -6);
      ctx.fill();
      ctx.stroke();
    },
    arrowRain(ctx) {
      for (const [x, y] of [
        [-10, -6],
        [0, 2],
        [10, -6],
        [-5, 10],
        [8, 12],
      ])
        arrowShape(ctx, x, y, 16, Math.PI / 2 + 0.15);
    },
    frost(ctx) {
      ctx.strokeStyle = '#3d8fd1';
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 3);
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(0, 16);
        ctx.moveTo(-5, -12);
        ctx.lineTo(0, -7);
        ctx.lineTo(5, -12);
        ctx.moveTo(-5, 12);
        ctx.lineTo(0, 7);
        ctx.lineTo(5, 12);
        ctx.stroke();
        ctx.restore();
      }
      ellipse(ctx, 0, 0, 4, 4, '#bfe9ff', '#3d8fd1', 2);
    },
    thunder(ctx) {
      ctx.fillStyle = '#ffd23f';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(4, -18);
      ctx.lineTo(-10, 2);
      ctx.lineTo(-1, 2);
      ctx.lineTo(-5, 18);
      ctx.lineTo(10, -4);
      ctx.lineTo(1, -4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    },
    bomb(ctx) {
      ellipse(ctx, -2, 4, 13, 13, '#3b3b48', OUTLINE, 2);
      ellipse(ctx, -6, 0, 4, 3, 'rgba(255,255,255,0.5)');
      ctx.strokeStyle = '#8a5a3c';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(6, -6);
      ctx.quadraticCurveTo(12, -14, 8, -18);
      ctx.stroke();
      ellipse(ctx, 8, -18, 4, 4, '#ffb347');
      ellipse(ctx, 8, -18, 2, 2, '#fff3c4');
    },
    patch(ctx) {
      ctx.save();
      ctx.rotate(-0.6);
      roundRect(ctx, -18, -7, 36, 14, 6);
      ctx.fillStyle = '#f5d7b3';
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillRect(-6, -7, 12, 14);
      ctx.strokeRect(-6, -7, 12, 14);
      ctx.fillStyle = '#e04848';
      ctx.fillRect(-1.5, -4, 3, 8);
      ctx.fillRect(-4, -1.5, 8, 3);
      ctx.restore();
    },
    haste(ctx) {
      ctx.fillStyle = '#ffb347';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-4, -16);
      ctx.lineTo(4, -16);
      ctx.lineTo(4, -8);
      ctx.lineTo(12, 6);
      ctx.quadraticCurveTo(14, 16, 0, 16);
      ctx.quadraticCurveTo(-14, 16, -12, 6);
      ctx.lineTo(-4, -8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ellipse(ctx, -3, 6, 3, 4, 'rgba(255,255,255,0.6)');
      ctx.fillStyle = '#8a5a3c';
      ctx.fillRect(-5, -20, 10, 5);
    },
    freeze(ctx) {
      ctx.fillStyle = '#bfe9ff';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      roundRect(ctx, -11, -10, 22, 26, 7);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#8a5a3c';
      ctx.fillRect(-5, -17, 10, 7);
      ICONS.frostMini(ctx);
    },
    frostMini(ctx) {
      ctx.strokeStyle = '#3d8fd1';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(0, 3);
        ctx.rotate((i * Math.PI) / 3);
        ctx.beginPath();
        ctx.moveTo(0, -7);
        ctx.lineTo(0, 7);
        ctx.stroke();
        ctx.restore();
      }
    },
    charm(ctx) {
      ctx.fillStyle = '#5aa845';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.8;
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 2 + Math.PI / 4);
        ellipse(ctx, 0, -8, 6.5, 8, '#6fd36a', OUTLINE, 1.8);
        ctx.restore();
      }
      ctx.strokeStyle = '#3d7a2f';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.quadraticCurveTo(4, 12, 10, 18);
      ctx.stroke();
    },
    arrowUp(ctx) {
      arrowShape(ctx, 0, 0, 30, -Math.PI / 4, '#ffd23f');
      ctx.fillStyle = '#e04848';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('+', 6, 14);
    },
    eye(ctx) {
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-17, 0);
      ctx.quadraticCurveTo(0, -16, 17, 0);
      ctx.quadraticCurveTo(0, 16, -17, 0);
      ctx.fill();
      ctx.stroke();
      ellipse(ctx, 0, 0, 7, 7, '#5b8fd5', OUTLINE, 1.5);
      ellipse(ctx, 0, 0, 3, 3, OUTLINE);
    },
    fury(ctx) {
      ctx.fillStyle = '#ffd23f';
      star(ctx, 0, 0, 17);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#e04848';
      star(ctx, 0, 1, 7);
    },
    master(ctx) {
      ellipse(ctx, 0, 0, 16, 16, '#fff3c4', OUTLINE, 2);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -10);
      ctx.moveTo(0, 0);
      ctx.lineTo(8, 4);
      ctx.stroke();
      ctx.strokeStyle = '#e04848';
      ctx.beginPath();
      ctx.arc(0, 0, 20, -2.4, -0.6);
      ctx.stroke();
    },
    purse(ctx) {
      ellipse(ctx, 0, 5, 15, 12, '#c98b4a', OUTLINE, 2);
      ctx.fillStyle = '#a86d32';
      ctx.beginPath();
      ctx.moveTo(-7, -6);
      ctx.lineTo(0, -14);
      ctx.lineTo(7, -6);
      ctx.fill();
      ctx.stroke();
      S.coin(ctx, 3, 6, 6, 'copper');
    },
    bow(ctx) {
      ctx.strokeStyle = '#8a5a3c';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(-6, 0, 17, -1.2, 1.2);
      ctx.stroke();
      ctx.strokeStyle = '#eee';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-6 + Math.cos(-1.2) * 17, Math.sin(-1.2) * 17);
      ctx.lineTo(-6 + Math.cos(1.2) * 17, Math.sin(1.2) * 17);
      ctx.stroke();
      arrowShape(ctx, 0, 0, 26, 0);
    },
    crossbow(ctx) {
      S.weaponInHand(ctx, 'crossbow', 24, 1);
    },
    boomerang(ctx) {
      S.boomerang(ctx, 17, 0.4);
    },
    staff(ctx) {
      ctx.save();
      ctx.rotate(0.6);
      ctx.strokeStyle = '#8a5a3c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 18);
      ctx.lineTo(0, -8);
      ctx.stroke();
      ellipse(ctx, 0, -12, 7, 7, '#c58cff', OUTLINE, 2);
      ellipse(ctx, -2, -14, 2.5, 2, '#fff');
      ctx.restore();
    },
    cannon(ctx) {
      ctx.save();
      ctx.rotate(-0.35);
      roundRect(ctx, -14, -7, 30, 14, 6);
      ctx.fillStyle = '#4a4a58';
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      ellipse(ctx, -6, 10, 7, 7, '#8a5a3c', OUTLINE, 2);
    },
  };

  S.iconCanvas = function (id, px) {
    const c = document.createElement('canvas');
    c.width = px;
    c.height = px;
    S.icon(c.getContext('2d'), id, px / 2, px / 2, px * 0.4);
    c.className = 'icon';
    return c;
  };

  // 把怪物画成头像（用于关卡预览、图鉴）
  S.portrait = function (type, size) {
    const c = document.createElement('canvas');
    const px = size || 64;
    c.width = px;
    c.height = px;
    const ctx = c.getContext('2d');
    const def = TD.data.monsters[type];
    const s = def.boss ? px * 0.27 : px * 0.3;
    const y = def.flying ? px * 0.75 : px * 0.88;
    S.monster(ctx, type, px / 2, y, s, 0.3, {});
    return c;
  };
})((globalThis.TD = globalThis.TD || {}));
