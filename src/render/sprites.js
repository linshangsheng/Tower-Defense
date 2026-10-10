// Q 版角色与怪物的程序化绘制（原型阶段的占位美术，设计书 10 章、17.2）
(function (TD) {
  'use strict';

  const S = (TD.sprites = {});

  // 检测 canvas 滤镜支持（Safari 不支持）
  S.filterSupported = (function () {
    try {
      if (typeof document === 'undefined') return false;
      const c = document.createElement('canvas').getContext('2d');
      c.filter = 'brightness(2)';
      return c.filter === 'brightness(2)';
    } catch (e) {
      return false;
    }
  })();

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
    // 受击闪白：用"叠加"混合再画一遍，只提亮怪物本身（不用 canvas 滤镜，滤镜在没有显卡加速时非常慢）
    if (opts.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, opts.flash * 7) * 0.55;
      fn(ctx, size, t, opts);
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

    // ---------- 第三章 · 迷雾沼泽 ----------
    ghost(ctx, s, t, o) {
      const bob = Math.sin(t * 4 + (o.seed || 0)) * 4;
      ctx.save();
      ctx.globalAlpha = 0.12;
      ellipse(ctx, 0, 2, s * 0.7, s * 0.2, '#000');
      ctx.restore();
      ctx.translate(0, -s * 0.5 + bob);
      ctx.globalAlpha = 0.82;
      ctx.beginPath();
      ctx.moveTo(-s * 0.8, 0);
      ctx.bezierCurveTo(-s * 0.85, -s * 1.6, s * 0.85, -s * 1.6, s * 0.8, 0);
      // 波浪下摆
      for (let i = 0; i < 4; i++) {
        const x0 = s * 0.8 - (i + 1) * s * 0.4;
        ctx.quadraticCurveTo(x0 + s * 0.2, s * (0.25 + Math.sin(t * 8 + i) * 0.08), x0, 0);
      }
      ctx.closePath();
      ctx.fillStyle = '#eef3ff';
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#8f9bc0';
      ctx.stroke();
      eyes(ctx, -s * 0.15, -s * 0.75, s * 0.42, s * 0.14);
      // 吐舌头
      ellipse(ctx, -s * 0.1, -s * 0.38, s * 0.12, s * 0.09, '#ff8fa8', OUTLINE, 1.2);
    },
    frog(ctx, s, t, o) {
      const puff = o.attack ? 0 : Math.max(0, Math.sin(t * 3 + (o.seed || 0))) * 0.08;
      shadow(ctx, 0, 2, s * 0.9);
      // 后腿
      ellipse(ctx, s * 0.55, -s * 0.2, s * 0.35, s * 0.22, '#7a54b0', OUTLINE, 2);
      ellipse(ctx, 0, -s * 0.55, s * (0.9 + puff), s * (0.62 + puff), '#9a6bd5', OUTLINE, 2);
      ellipse(ctx, -s * 0.1, -s * 0.35, s * 0.6, s * 0.3, '#c9b0f0');
      // 大嘴
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-s * 0.85, -s * 0.5);
      ctx.quadraticCurveTo(-s * 0.3, -s * 0.25, s * 0.2, -s * 0.5);
      ctx.stroke();
      // 鼓鼓的眼睛
      for (const dx of [-0.45, 0.05]) {
        ellipse(ctx, s * dx, -s * 1.08, s * 0.24, s * 0.24, '#9a6bd5', OUTLINE, 2);
        ellipse(ctx, s * dx, -s * 1.1, s * 0.15, s * 0.15, '#fff');
        ellipse(ctx, s * dx - s * 0.05, -s * 1.1, s * 0.07, s * 0.09, '#2a1d14');
      }
      ellipse(ctx, -s * 0.2, -s * 0.85, s * 0.08, s * 0.06, '#7dff9a');
      ellipse(ctx, s * 0.35, -s * 0.7, s * 0.07, s * 0.05, '#7dff9a');
    },
    stump(ctx, s, t, o) {
      const step = Math.sin(t * 6 + (o.seed || 0));
      shadow(ctx, 0, 2, s * 0.9);
      // 小脚（树根）
      ctx.strokeStyle = '#5b3c2a';
      ctx.lineWidth = 4;
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(d * s * 0.35, -s * 0.25);
        ctx.lineTo(d * s * 0.55 + step * d * 3, 0);
        ctx.stroke();
      }
      roundRect(ctx, -s * 0.7, -s * 1.5, s * 1.4, s * 1.3, s * 0.3);
      ctx.fillStyle = '#8a6a4a';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.strokeStyle = '#6b4f36';
      ctx.lineWidth = 2;
      for (const x of [-0.35, 0.05, 0.4]) {
        ctx.beginPath();
        ctx.moveTo(s * x, -s * 1.4);
        ctx.lineTo(s * x + 2, -s * 0.3);
        ctx.stroke();
      }
      // 年轮顶
      ellipse(ctx, 0, -s * 1.5, s * 0.7, s * 0.22, '#d9b88a', OUTLINE, 2);
      ctx.strokeStyle = '#b08a5a';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(0, -s * 1.5, s * 0.4, s * 0.12, 0, 0, Math.PI * 2);
      ctx.stroke();
      // 树洞眼睛
      ellipse(ctx, -s * 0.32, -s * 1.0, s * 0.14, s * 0.18, '#2a1d14');
      ellipse(ctx, s * 0.12, -s * 1.0, s * 0.14, s * 0.18, '#2a1d14');
      ellipse(ctx, -s * 0.3, -s * 1.05, s * 0.05, s * 0.05, '#ffd23f');
      ellipse(ctx, s * 0.14, -s * 1.05, s * 0.05, s * 0.05, '#ffd23f');
      // 小叶子
      ellipse(ctx, s * 0.45, -s * 1.7, s * 0.18, s * 0.1, '#6fd36a', OUTLINE, 1.5);
      if (o.regen) {
        ctx.fillStyle = '#7dff9a';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText('+', s * 0.6, -s * 1.9 - ((t * 20) % 10));
      }
    },
    bat(ctx, s, t, o) {
      const flap = Math.sin(t * 22 + (o.seed || 0));
      ctx.save();
      ctx.globalAlpha = 0.12;
      ellipse(ctx, 0, 34, s * 0.8, s * 0.2, '#000');
      ctx.restore();
      ctx.translate(0, Math.sin(t * 7) * 3 - s * 0.4);
      ctx.fillStyle = '#5a3f80';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.8;
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(d * s * 0.4, 0);
        ctx.quadraticCurveTo(d * s * 1.2, -s * (0.9 + flap * 0.5), d * s * 1.6, -s * (0.1 + flap * 0.4));
        ctx.quadraticCurveTo(d * s * 1.1, s * 0.1, d * s * 0.9, s * 0.35);
        ctx.quadraticCurveTo(d * s * 0.6, s * 0.1, d * s * 0.4, s * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ellipse(ctx, 0, 0, s * 0.6, s * 0.55, '#7a5aa8', OUTLINE, 2);
      // 大耳朵
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(d * s * 0.15, -s * 0.45);
        ctx.lineTo(d * s * 0.5, -s * 1.05);
        ctx.lineTo(d * s * 0.5, -s * 0.35);
        ctx.fillStyle = '#7a5aa8';
        ctx.fill();
        ctx.stroke();
      }
      eyes(ctx, -s * 0.05, -s * 0.05, s * 0.36, s * 0.13);
    },
    pumpkin(ctx, s, t, o) {
      const step = Math.sin(t * 8 + (o.seed || 0));
      shadow(ctx, 0, 2, s * 0.8);
      // 稻草人身体
      ctx.strokeStyle = '#8a5a3c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.9);
      ctx.lineTo(-s * 0.2 + step * 3, 0);
      ctx.moveTo(0, -s * 0.9);
      ctx.lineTo(s * 0.2 - step * 3, 0);
      ctx.stroke();
      roundRect(ctx, -s * 0.45, -s * 1.15, s * 0.9, s * 0.6, s * 0.15);
      ctx.fillStyle = '#6b8fc0';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
      ctx.strokeStyle = '#e6c46a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-s * 0.45, -s * 0.85);
      ctx.lineTo(-s * 0.75, -s * 0.7);
      ctx.moveTo(s * 0.45, -s * 0.85);
      ctx.lineTo(s * 0.75, -s * 0.7);
      ctx.stroke();
      pumpkinHead(ctx, 0, -s * 1.55, s * 0.62, t);
    },
    minipumpkin(ctx, s, t, o) {
      const hop = Math.abs(Math.sin(t * 14 + (o.seed || 0))) * s * 0.4;
      shadow(ctx, 0, 2, s * 0.8);
      pumpkinHead(ctx, 0, -s * 0.75 - hop, s * 0.8, t);
    },
    boneMage(ctx, s, t, o) {
      const ai = o.ai || {};
      if (ai.mode === 'bones') {
        // 散落的骨头
        shadow(ctx, 0, 2, s);
        ctx.fillStyle = '#f2efe6';
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          ctx.save();
          ctx.translate(-s * 0.6 + i * s * 0.3, -s * 0.12);
          ctx.rotate(i * 1.3);
          roundRect(ctx, -s * 0.25, -s * 0.06, s * 0.5, s * 0.12, s * 0.06);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        ellipse(ctx, s * 0.1, -s * 0.35, s * 0.35, s * 0.3, '#f2efe6', OUTLINE, 2);
        ellipse(ctx, 0, -s * 0.38, s * 0.07, s * 0.08, OUTLINE);
        ellipse(ctx, s * 0.2, -s * 0.38, s * 0.07, s * 0.08, OUTLINE);
        const shake = Math.sin(t * 30) * 2;
        ctx.save();
        ctx.translate(shake, 0);
        ctx.fillStyle = '#7a5aa8';
        ctx.beginPath();
        ctx.moveTo(-s * 0.3, -s * 0.55);
        ctx.lineTo(s * 0.1, -s * 1.2);
        ctx.lineTo(s * 0.35, -s * 0.55);
        ctx.fill();
        ctx.restore();
        return;
      }
      const sway = Math.sin(t * 3) * 0.05;
      shadow(ctx, 0, 2, s * 0.85);
      ctx.save();
      ctx.rotate(sway);
      // 长袍
      ctx.beginPath();
      ctx.moveTo(-s * 0.75, 0);
      ctx.quadraticCurveTo(-s * 0.6, -s * 1.1, 0, -s * 1.15);
      ctx.quadraticCurveTo(s * 0.6, -s * 1.1, s * 0.75, 0);
      ctx.closePath();
      ctx.fillStyle = '#5a3f80';
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // 骷髅头
      ellipse(ctx, 0, -s * 1.45, s * 0.48, s * 0.42, '#f2efe6', OUTLINE, 2);
      ellipse(ctx, -s * 0.18, -s * 1.47, s * 0.12, s * 0.14, '#2a1d14');
      ellipse(ctx, s * 0.16, -s * 1.47, s * 0.12, s * 0.14, '#2a1d14');
      ellipse(ctx, -s * 0.18, -s * 1.47, s * 0.04, s * 0.04, '#7dff9a');
      ellipse(ctx, s * 0.16, -s * 1.47, s * 0.04, s * 0.04, '#7dff9a');
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.5;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * s * 0.07, -s * 1.22);
        ctx.lineTo(i * s * 0.07, -s * 1.12);
        ctx.stroke();
      }
      // 尖帽子
      ctx.beginPath();
      ctx.moveTo(-s * 0.55, -s * 1.7);
      ctx.lineTo(s * 0.25, -s * 2.65);
      ctx.lineTo(s * 0.55, -s * 1.7);
      ctx.closePath();
      ctx.fillStyle = '#7a5aa8';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.stroke();
      ellipse(ctx, 0, -s * 1.72, s * 0.62, s * 0.12, '#7a5aa8', OUTLINE, 2);
      ctx.fillStyle = '#ffd23f';
      star(ctx, s * 0.05, -s * 2.1, s * 0.1);
      ctx.restore();
      // 魔法书
      ctx.save();
      ctx.translate(-s * 0.7, -s * 0.75);
      ctx.rotate(-0.2);
      roundRect(ctx, -s * 0.3, -s * 0.22, s * 0.6, s * 0.44, 4);
      ctx.fillStyle = '#c94b4b';
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffd23f';
      star(ctx, 0, 0, s * 0.1);
      ctx.restore();
    },
    witch(ctx, s, t, o) {
      const ai = o.ai || {};
      shadow(ctx, s * 0.2, 2, s * 1.4);
      // 大锅（在女巫身前）
      ctx.save();
      ctx.translate(-s * 0.85, 0);
      ctx.fillStyle = '#ff8a3d';
      for (let i = 0; i < 3; i++) {
        const f = Math.sin(t * 12 + i) * 3;
        ctx.beginPath();
        ctx.moveTo(-s * 0.35 + i * s * 0.35, -s * 0.05);
        ctx.lineTo(-s * 0.25 + i * s * 0.35, -s * 0.35 - f);
        ctx.lineTo(-s * 0.15 + i * s * 0.35, -s * 0.05);
        ctx.fill();
      }
      ellipse(ctx, 0, -s * 0.6, s * 0.7, s * 0.5, '#3b3b48', OUTLINE, 2.5);
      ellipse(ctx, 0, -s * 0.98, s * 0.66, s * 0.16, '#6fd36a', OUTLINE, 2);
      for (let i = 0; i < 3; i++) {
        const bt = (t * 1.5 + i * 0.33) % 1;
        ctx.globalAlpha = 1 - bt;
        ellipse(ctx, -s * 0.3 + i * s * 0.3, -s * 1.0 - bt * s * 0.6, s * 0.08 + bt * s * 0.06, s * 0.08 + bt * s * 0.06, '#9df58a', OUTLINE, 1);
      }
      ctx.globalAlpha = 1;
      if (ai.phase === 3) {
        // 大锅倾斜
        ctx.fillStyle = 'rgba(111,211,106,0.7)';
        ctx.beginPath();
        ctx.ellipse(-s * 0.9, -s * 0.1, s * 0.5, s * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      // 小女巫
      ctx.save();
      ctx.translate(s * 0.35, 0);
      const stir = Math.sin(t * 4) * 0.3;
      ctx.beginPath();
      ctx.moveTo(-s * 0.55, 0);
      ctx.quadraticCurveTo(-s * 0.45, -s * 1.0, 0, -s * 1.05);
      ctx.quadraticCurveTo(s * 0.45, -s * 1.0, s * 0.55, 0);
      ctx.closePath();
      ctx.fillStyle = '#4d6b3f';
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ellipse(ctx, 0, -s * 1.35, s * 0.42, s * 0.38, '#cfe8b8', OUTLINE, 2);
      eyes(ctx, -s * 0.08, -s * 1.35, s * 0.32, s * 0.12);
      blush(ctx, -s * 0.08, -s * 1.18, s * 0.5, s * 0.08);
      // 尖帽
      ctx.beginPath();
      ctx.moveTo(-s * 0.6, -s * 1.55);
      ctx.lineTo(s * 0.1, -s * 2.5);
      ctx.lineTo(s * 0.55, -s * 1.55);
      ctx.closePath();
      ctx.fillStyle = '#2f2f3a';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.stroke();
      ellipse(ctx, 0, -s * 1.57, s * 0.68, s * 0.12, '#2f2f3a', OUTLINE, 2);
      ctx.fillStyle = '#9a6bd5';
      ctx.fillRect(-s * 0.4, -s * 1.72, s * 0.8, s * 0.1);
      // 搅拌勺
      ctx.save();
      ctx.translate(-s * 0.45, -s * 0.8);
      ctx.rotate(-0.8 + stir);
      ctx.strokeStyle = '#8a5a3c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-s * 0.9, 0);
      ctx.stroke();
      ctx.restore();
      ctx.restore();
    },

    // ---------- 第四章 · 冰霜雪原 ----------
    snowman(ctx, s, t, o) {
      const wob = Math.sin(t * 6 + (o.seed || 0)) * 0.06;
      shadow(ctx, 0, 2, s * 0.85);
      ctx.save();
      ctx.rotate(wob);
      ellipse(ctx, 0, -s * 0.55, s * 0.75, s * 0.6, '#f7fbff', '#9fb6cc', 2);
      ellipse(ctx, 0, -s * 1.35, s * 0.52, s * 0.46, '#f7fbff', '#9fb6cc', 2);
      eyes(ctx, -s * 0.12, -s * 1.42, s * 0.34, s * 0.11);
      // 胡萝卜鼻子
      ctx.fillStyle = '#ff8a3d';
      ctx.beginPath();
      ctx.moveTo(-s * 0.12, -s * 1.28);
      ctx.lineTo(-s * 0.55, -s * 1.22);
      ctx.lineTo(-s * 0.12, -s * 1.18);
      ctx.fill();
      // 围巾
      ctx.fillStyle = '#e04848';
      ctx.fillRect(-s * 0.45, -s * 1.02, s * 0.9, s * 0.14);
      ctx.fillRect(s * 0.18, -s * 1.0, s * 0.14, s * 0.35);
      // 纽扣
      ellipse(ctx, -s * 0.05, -s * 0.7, s * 0.06, s * 0.06, OUTLINE);
      ellipse(ctx, -s * 0.05, -s * 0.45, s * 0.06, s * 0.06, OUTLINE);
      ctx.restore();
    },
    snowball(ctx, s, t, o) {
      const roll = -t * 8 - (o.seed || 0);
      shadow(ctx, 0, 2, s * 0.8);
      ctx.save();
      ctx.translate(0, -s * 0.75);
      ellipse(ctx, 0, 0, s * 0.8, s * 0.8, '#f7fbff', '#9fb6cc', 2);
      ctx.rotate(roll);
      ellipse(ctx, s * 0.3, -s * 0.2, s * 0.12, s * 0.1, '#dbe8f5');
      ctx.restore();
      eyes(ctx, -s * 0.15, -s * 0.8, s * 0.42, s * 0.14);
    },
    penguin(ctx, s, t, o) {
      const slide = o.attack ? 0 : 1;
      shadow(ctx, 0, 2, s * 1.0);
      ctx.save();
      ctx.translate(0, -s * 0.45);
      ctx.rotate(slide * -1.25);
      ellipse(ctx, 0, 0, s * 0.62, s * 0.95, '#3b4a6b', OUTLINE, 2);
      ellipse(ctx, -s * 0.12, s * 0.05, s * 0.42, s * 0.72, '#fff');
      // 鳍
      ellipse(ctx, s * 0.55, s * 0.1, s * 0.15, s * 0.42, '#2f3b57', OUTLINE, 1.5);
      ctx.restore();
      // 头（滑行时朝前）
      const hx = slide ? -s * 0.85 : 0;
      const hy = slide ? -s * 0.5 : -s * 1.35;
      ellipse(ctx, hx, hy, s * 0.42, s * 0.38, '#3b4a6b', OUTLINE, 2);
      ellipse(ctx, hx - s * 0.05, hy + s * 0.05, s * 0.28, s * 0.24, '#fff');
      eyes(ctx, hx - s * 0.05, hy, s * 0.24, s * 0.09);
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.moveTo(hx - s * 0.32, hy + s * 0.08);
      ctx.lineTo(hx - s * 0.6, hy + s * 0.14);
      ctx.lineTo(hx - s * 0.32, hy + s * 0.2);
      ctx.fill();
      if (slide) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(s * 0.8 + i * 6, -s * 0.2 - i * 6);
          ctx.lineTo(s * 1.3 + i * 6, -s * 0.2 - i * 6);
          ctx.stroke();
        }
      }
    },
    iceSprite(ctx, s, t, o) {
      const bob = Math.sin(t * 3 + (o.seed || 0)) * 4;
      ctx.save();
      ctx.globalAlpha = 0.12;
      ellipse(ctx, 0, 34, s * 0.7, s * 0.2, '#000');
      ctx.restore();
      ctx.translate(0, -s * 0.6 + bob);
      // 光环
      ctx.save();
      ctx.globalAlpha = 0.25 + Math.sin(t * 5) * 0.1;
      ellipse(ctx, 0, 0, s * 1.6, s * 1.6, '#bfe9ff');
      ctx.restore();
      ctx.save();
      ctx.rotate(t * 0.8);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.lineTo(Math.cos(a) * s * 0.95, Math.sin(a) * s * 0.95);
        const a2 = a + Math.PI / 6;
        ctx.lineTo(Math.cos(a2) * s * 0.6, Math.sin(a2) * s * 0.6);
      }
      ctx.closePath();
      ctx.fillStyle = '#9fe3ff';
      ctx.fill();
      ctx.strokeStyle = '#3d8fd1';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      ellipse(ctx, 0, 0, s * 0.5, s * 0.5, '#e8f8ff', '#3d8fd1', 1.5);
      eyes(ctx, -s * 0.05, -s * 0.05, s * 0.36, s * 0.12);
    },
    wolf(ctx, s, t, o) {
      const run = Math.sin(t * 16 + (o.seed || 0));
      shadow(ctx, 0, 2, s * 1.0);
      ctx.strokeStyle = '#9fb6cc';
      ctx.lineWidth = 4;
      for (const [lx, ph] of [
        [-0.5, 0],
        [-0.2, 1.5],
        [0.4, 3],
        [0.7, 4.5],
      ]) {
        ctx.beginPath();
        ctx.moveTo(s * lx, -s * 0.4);
        ctx.lineTo(s * lx + Math.sin(t * 16 + ph) * 5, 0);
        ctx.stroke();
      }
      ellipse(ctx, s * 0.1, -s * 0.6, s * 0.85, s * 0.42, '#dfe9f5', '#7f97b0', 2);
      // 尾巴
      ctx.fillStyle = '#dfe9f5';
      ctx.beginPath();
      ctx.moveTo(s * 0.85, -s * 0.7);
      ctx.quadraticCurveTo(s * 1.35, -s * (1.0 + run * 0.1), s * 1.3, -s * 0.5);
      ctx.fill();
      ctx.strokeStyle = '#7f97b0';
      ctx.lineWidth = 2;
      ctx.stroke();
      // 头
      ellipse(ctx, -s * 0.7, -s * 0.85, s * 0.42, s * 0.36, '#eef4fb', '#7f97b0', 2);
      for (const dx of [-0.85, -0.55]) {
        ctx.beginPath();
        ctx.moveTo(s * dx - s * 0.1, -s * 1.1);
        ctx.lineTo(s * dx, -s * 1.38);
        ctx.lineTo(s * dx + s * 0.1, -s * 1.1);
        ctx.fillStyle = '#eef4fb';
        ctx.fill();
        ctx.stroke();
      }
      ellipse(ctx, -s * 1.08, -s * 0.8, s * 0.12, s * 0.09, OUTLINE);
      eyes(ctx, -s * 0.72, -s * 0.92, s * 0.26, s * 0.09);
    },
    yeti(ctx, s, t, o) {
      const step = Math.sin(t * 5 + (o.seed || 0));
      shadow(ctx, 0, 2, s * 1.0);
      ellipse(ctx, -s * 0.35 + step * 3, -s * 0.12, s * 0.28, s * 0.16, '#cfdbe8', '#7f97b0', 2);
      ellipse(ctx, s * 0.35 - step * 3, -s * 0.12, s * 0.28, s * 0.16, '#cfdbe8', '#7f97b0', 2);
      ellipse(ctx, 0, -s * 0.95, s * 0.9, s * 0.85, '#f2f6fb', '#7f97b0', 2.5);
      // 毛茸茸的边
      ctx.fillStyle = '#f2f6fb';
      for (let i = 0; i < 8; i++) {
        const a = Math.PI * 0.15 + (i / 7) * Math.PI * 0.7;
        ellipse(ctx, Math.cos(a + Math.PI) * s * 0.9, -s * 0.95 + Math.sin(a + Math.PI) * s * 0.85, s * 0.14, s * 0.14, '#f2f6fb');
      }
      // 手臂
      ellipse(ctx, -s * 0.85, -s * 0.75 + step * 2, s * 0.25, s * 0.42, '#e8eff7', '#7f97b0', 2);
      // 脸
      ellipse(ctx, -s * 0.15, -s * 1.15, s * 0.45, s * 0.35, '#9fb6cc', OUTLINE, 1.8);
      eyes(ctx, -s * 0.18, -s * 1.22, s * 0.32, s * 0.1);
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-s * 0.18, -s * 1.02, s * 0.1, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    },
    iceDragon(ctx, s, t, o) {
      const flap = Math.sin(t * 10 + (o.seed || 0));
      ctx.save();
      ctx.globalAlpha = 0.12;
      ellipse(ctx, 0, 34, s * 1.0, s * 0.22, '#000');
      ctx.restore();
      ctx.translate(0, Math.sin(t * 4) * 4 - s * 0.4);
      ctx.fillStyle = '#bfe3ff';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.2);
      ctx.lineTo(s * 0.5, -s * (1.2 + flap * 0.4));
      ctx.lineTo(s * 0.9, -s * (0.6 + flap * 0.3));
      ctx.lineTo(s * 0.4, -s * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ellipse(ctx, s * 0.2, 0, s * 0.75, s * 0.42, '#7fc8f8', OUTLINE, 2);
      // 尾巴
      ctx.beginPath();
      ctx.moveTo(s * 0.9, 0);
      ctx.quadraticCurveTo(s * 1.4, s * 0.2, s * 1.6, -s * 0.2);
      ctx.strokeStyle = '#7fc8f8';
      ctx.lineWidth = 5;
      ctx.stroke();
      ellipse(ctx, -s * 0.65, -s * 0.25, s * 0.42, s * 0.34, '#9fd6fb', OUTLINE, 2);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(-s * 0.55, -s * 0.55);
      ctx.lineTo(-s * 0.45, -s * 0.85);
      ctx.lineTo(-s * 0.38, -s * 0.52);
      ctx.fill();
      eyes(ctx, -s * 0.72, -s * 0.32, s * 0.26, s * 0.09);
    },
    iceGiant(ctx, s, t, o) {
      const step = Math.sin(t * 4 + (o.seed || 0));
      shadow(ctx, 0, 2, s * 1.0);
      ellipse(ctx, -s * 0.35 + step * 3, -s * 0.15, s * 0.3, s * 0.18, '#8fc6ee', OUTLINE, 2);
      ellipse(ctx, s * 0.35 - step * 3, -s * 0.15, s * 0.3, s * 0.18, '#8fc6ee', OUTLINE, 2);
      roundRect(ctx, -s * 0.8, -s * 1.7, s * 1.6, s * 1.55, s * 0.5);
      ctx.fillStyle = '#bfe3ff';
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ellipse(ctx, -s * 0.3, -s * 1.4, s * 0.25, s * 0.12, 'rgba(255,255,255,0.6)');
      // 胡子（冰柱）
      ctx.fillStyle = '#e8f8ff';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-s * 0.45 + i * s * 0.22, -s * 0.95);
        ctx.lineTo(-s * 0.34 + i * s * 0.22, -s * 0.55);
        ctx.lineTo(-s * 0.23 + i * s * 0.22, -s * 0.95);
        ctx.fill();
      }
      eyes(ctx, -s * 0.15, -s * 1.25, s * 0.42, s * 0.13);
      // 冰棍
      ctx.save();
      ctx.translate(-s * 0.95, -s * 1.0);
      ctx.rotate(-0.4 + Math.sin(t * 2) * 0.1);
      ctx.fillStyle = '#c9a26a';
      ctx.fillRect(-s * 0.05, 0, s * 0.1, s * 0.5);
      roundRect(ctx, -s * 0.2, -s * 0.6, s * 0.4, s * 0.65, s * 0.15);
      ctx.fillStyle = '#ff9ec4';
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    },
    frostQueen(ctx, s, t, o) {
      const float = Math.sin(t * 2) * 4;
      shadow(ctx, 0, 2, s * 0.9);
      ctx.save();
      ctx.translate(0, float);
      // 雪花披风
      ctx.beginPath();
      ctx.moveTo(-s * 0.9, -s * 0.1);
      ctx.quadraticCurveTo(-s * 0.7, -s * 1.3, 0, -s * 1.35);
      ctx.quadraticCurveTo(s * 0.7, -s * 1.3, s * 0.9, -s * 0.1);
      ctx.closePath();
      ctx.fillStyle = '#9fd6fb';
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 5; i++) star(ctx, -s * 0.6 + i * s * 0.3, -s * 0.35 - (i % 2) * s * 0.3, s * 0.08);
      // 裙子
      ctx.beginPath();
      ctx.moveTo(-s * 0.5, -s * 0.15);
      ctx.lineTo(0, -s * 1.1);
      ctx.lineTo(s * 0.5, -s * 0.15);
      ctx.closePath();
      ctx.fillStyle = '#e8f8ff';
      ctx.fill();
      ctx.stroke();
      // 头
      ellipse(ctx, 0, -s * 1.5, s * 0.42, s * 0.38, '#ffe6d6', OUTLINE, 2);
      // 头发
      ctx.fillStyle = '#e8f4ff';
      ctx.beginPath();
      ctx.ellipse(0, -s * 1.62, s * 0.48, s * 0.3, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      eyes(ctx, -s * 0.05, -s * 1.48, s * 0.3, s * 0.11);
      blush(ctx, -s * 0.05, -s * 1.32, s * 0.48, s * 0.07);
      // 冰皇冠
      ctx.save();
      ctx.translate(0, -s * 1.85);
      ctx.fillStyle = '#9fe3ff';
      ctx.beginPath();
      ctx.moveTo(-s * 0.3, 0);
      ctx.lineTo(-s * 0.22, -s * 0.3);
      ctx.lineTo(-s * 0.1, -s * 0.1);
      ctx.lineTo(0, -s * 0.42);
      ctx.lineTo(s * 0.1, -s * 0.1);
      ctx.lineTo(s * 0.22, -s * 0.3);
      ctx.lineTo(s * 0.3, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#3d8fd1';
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.restore();
      // 冰杖
      ctx.strokeStyle = '#9fe3ff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, -s * 0.2);
      ctx.lineTo(-s * 0.7, -s * 1.6);
      ctx.stroke();
      ctx.save();
      ctx.translate(-s * 0.7, -s * 1.75);
      ctx.scale(s / 40, s / 40);
      ICONS.frost(ctx);
      ctx.restore();
      ctx.restore();
    },

    // ---------- 第五章 · 熔岩裂隙 ----------
    magma(ctx, s, t, o) {
      shadow(ctx, 0, 2, s);
      const h = slimeBody(ctx, s, t, '#ff7a3d', o);
      // 发光的裂纹
      ctx.strokeStyle = '#ffe28a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-s * 0.5, -h * 0.3);
      ctx.lineTo(-s * 0.2, -h * 0.55);
      ctx.lineTo(s * 0.15, -h * 0.35);
      ctx.lineTo(s * 0.45, -h * 0.6);
      ctx.stroke();
      eyes(ctx, -s * 0.15, -h * 0.75, s * 0.55, s * 0.18);
      // 火苗
      ctx.fillStyle = '#ffd23f';
      for (let i = 0; i < 3; i++) {
        const f = Math.sin(t * 10 + i * 2) * 3;
        ctx.beginPath();
        ctx.moveTo(-s * 0.3 + i * s * 0.3, -h * 1.1);
        ctx.lineTo(-s * 0.2 + i * s * 0.3, -h * 1.4 - f);
        ctx.lineTo(-s * 0.1 + i * s * 0.3, -h * 1.1);
        ctx.fill();
      }
    },
    lavaGolem(ctx, s, t, o) {
      const step = Math.sin(t * 4 + (o.seed || 0));
      shadow(ctx, 0, 2, s * 1.0);
      ellipse(ctx, -s * 0.35 + step * 3, -s * 0.15, s * 0.3, s * 0.2, '#5a4440', OUTLINE, 2);
      ellipse(ctx, s * 0.35 - step * 3, -s * 0.15, s * 0.3, s * 0.2, '#5a4440', OUTLINE, 2);
      // 石块身体
      ctx.fillStyle = '#7a5a50';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-s * 0.85, -s * 0.3);
      ctx.lineTo(-s * 0.95, -s * 1.1);
      ctx.lineTo(-s * 0.5, -s * 1.6);
      ctx.lineTo(s * 0.4, -s * 1.65);
      ctx.lineTo(s * 0.9, -s * 1.1);
      ctx.lineTo(s * 0.85, -s * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // 熔岩缝
      ctx.strokeStyle = '#ff8a3d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-s * 0.6, -s * 0.5);
      ctx.lineTo(-s * 0.2, -s * 0.8);
      ctx.lineTo(s * 0.1, -s * 0.55);
      ctx.lineTo(s * 0.6, -s * 0.9);
      ctx.stroke();
      ellipse(ctx, -s * 0.3, -s * 1.2, s * 0.13, s * 0.11, '#ffd23f');
      ellipse(ctx, s * 0.2, -s * 1.2, s * 0.13, s * 0.11, '#ffd23f');
    },
    imp(ctx, s, t, o) {
      const flap = Math.sin(t * 16 + (o.seed || 0));
      ctx.save();
      ctx.globalAlpha = 0.12;
      ellipse(ctx, 0, 34, s * 0.7, s * 0.2, '#000');
      ctx.restore();
      ctx.translate(0, Math.sin(t * 5) * 3 - s * 0.3);
      ctx.fillStyle = '#8a2a2a';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.8;
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(d * s * 0.3, -s * 0.3);
        ctx.lineTo(d * s * 1.2, -s * (0.9 + flap * 0.4));
        ctx.lineTo(d * s * 0.9, -s * 0.1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ellipse(ctx, 0, -s * 0.2, s * 0.6, s * 0.6, '#e04848', OUTLINE, 2);
      // 小角
      ctx.fillStyle = '#ffe28a';
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(d * s * 0.25, -s * 0.7);
        ctx.lineTo(d * s * 0.42, -s * 1.1);
        ctx.lineTo(d * s * 0.45, -s * 0.62);
        ctx.fill();
        ctx.stroke();
      }
      // 尖尾巴
      ctx.strokeStyle = '#8a2a2a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(s * 0.5, 0);
      ctx.quadraticCurveTo(s * 1.0, s * 0.3, s * 1.1, -s * 0.1);
      ctx.stroke();
      eyes(ctx, -s * 0.1, -s * 0.25, s * 0.34, s * 0.12);
      if (o.attack) ellipse(ctx, -s * 0.8, -s * 0.2, s * 0.25, s * 0.25, '#ffb347', '#ff7a3d', 1.5);
    },
    assassin(ctx, s, t, o) {
      const step = Math.sin(t * 10 + (o.seed || 0));
      shadow(ctx, 0, 2, s * 0.8);
      ellipse(ctx, -s * 0.25 + step * 3, -s * 0.1, s * 0.16, s * 0.1, '#1f1f28');
      ellipse(ctx, s * 0.25 - step * 3, -s * 0.1, s * 0.16, s * 0.1, '#1f1f28');
      ellipse(ctx, 0, -s * 0.7, s * 0.6, s * 0.65, '#2f2f3a', '#111', 2);
      ellipse(ctx, 0, -s * 1.3, s * 0.5, s * 0.45, '#2f2f3a', '#111', 2);
      // 只露出两个白眼睛
      ctx.fillStyle = '#fff';
      ctx.fillRect(-s * 0.45, -s * 1.4, s * 0.7, s * 0.2);
      ellipse(ctx, -s * 0.25, -s * 1.3, s * 0.08, s * 0.06, '#fff');
      ellipse(ctx, s * 0.05, -s * 1.3, s * 0.08, s * 0.06, '#fff');
      ctx.fillStyle = '#2f2f3a';
      ctx.fillRect(-s * 0.45, -s * 1.4, s * 0.7, s * 0.04);
      // 围巾飘带
      ctx.strokeStyle = '#c94b4b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(s * 0.35, -s * 1.1);
      ctx.quadraticCurveTo(s * 0.8, -s * (1.0 + Math.sin(t * 8) * 0.1), s * 1.1, -s * 1.2);
      ctx.stroke();
    },
    chariot(ctx, s, t, o) {
      shadow(ctx, 0, 2, s * 1.1);
      const spin = -t * 15;
      for (const wx of [-0.55, 0.55]) {
        ctx.save();
        ctx.translate(wx * s, -s * 0.3);
        ctx.rotate(spin);
        ellipse(ctx, 0, 0, s * 0.3, s * 0.3, '#5b3c2a', OUTLINE, 2);
        ctx.strokeStyle = '#d9b88a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-s * 0.25, 0);
        ctx.lineTo(s * 0.25, 0);
        ctx.moveTo(0, -s * 0.25);
        ctx.lineTo(0, s * 0.25);
        ctx.stroke();
        ctx.restore();
      }
      roundRect(ctx, -s * 0.9, -s * 0.95, s * 1.8, s * 0.55, s * 0.12);
      ctx.fillStyle = '#8a6a4a';
      ctx.fill();
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.stroke();
      // 骷髅车夫
      ellipse(ctx, s * 0.2, -s * 1.3, s * 0.36, s * 0.32, '#f2efe6', OUTLINE, 2);
      ellipse(ctx, s * 0.08, -s * 1.32, s * 0.08, s * 0.1, OUTLINE);
      ellipse(ctx, s * 0.3, -s * 1.32, s * 0.08, s * 0.1, OUTLINE);
      ctx.fillStyle = '#c94b4b';
      ctx.beginPath();
      ctx.moveTo(-s * 0.2, -s * 1.55);
      ctx.lineTo(s * 0.2, -s * 1.95);
      ctx.lineTo(s * 0.55, -s * 1.55);
      ctx.fill();
    },
    inkClone(ctx, s, t, o) {
      shadow(ctx, 0, 2, s);
      ctx.globalAlpha = 0.85;
      const h = slimeBody(ctx, s, t, '#3a3050', o);
      ctx.globalAlpha = 1;
      ellipse(ctx, -s * 0.3, -h * 0.6, s * 0.1, s * 0.13, '#fff');
      ellipse(ctx, s * 0.05, -h * 0.6, s * 0.1, s * 0.13, '#fff');
    },
    rockGolem(ctx, s, t, o) {
      const ai = o.ai || {};
      const shake = ai.warn > 0 ? Math.sin(t * 60) * 3 : 0;
      ctx.translate(shake, 0);
      S.drawers.lavaGolem(ctx, s, t, o);
      // 憨厚的表情
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(-s * 0.05, -s * 0.95, s * 0.18, 0.2, Math.PI - 0.2);
      ctx.stroke();
      blush(ctx, -s * 0.05, -s * 0.95, s * 0.8, s * 0.09);
      if (ai.warn > 0) {
        ctx.fillStyle = '#ff5050';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', 0, -s * 1.9);
      }
    },
    inkBoss(ctx, s, t, o) {
      const ai = o.ai || {};
      const big = ai.big ? 1.6 : 1;
      const pulse = 1 + Math.sin(t * 3) * 0.04;
      shadow(ctx, 0, 2, s * big);
      ctx.save();
      ctx.scale(big * pulse, big * (2 - pulse));
      // 墨团
      ctx.beginPath();
      ctx.moveTo(-s, 0);
      ctx.bezierCurveTo(-s * 1.15, -s * 1.7, s * 1.15, -s * 1.7, s, 0);
      for (let i = 0; i < 5; i++) {
        const x0 = s - (i + 1) * s * 0.4;
        ctx.quadraticCurveTo(x0 + s * 0.2, s * (0.18 + Math.sin(t * 6 + i) * 0.06), x0, 0);
      }
      ctx.closePath();
      const g = ctx.createRadialGradient(-s * 0.3, -s * 0.9, s * 0.1, 0, -s * 0.6, s * 1.2);
      g.addColorStop(0, '#4a4060');
      g.addColorStop(1, '#1a1426');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = '#7a5aa8';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // 两个白点眼睛
      const look = Math.sin(t * 0.7) * s * 0.05;
      ellipse(ctx, -s * 0.35 + look, -s * 0.75, s * 0.13, s * 0.16, '#fff');
      ellipse(ctx, s * 0.12 + look, -s * 0.75, s * 0.13, s * 0.16, '#fff');
      if (ai.big) {
        // 魔王形态：小角和怒眉
        ctx.fillStyle = '#7a5aa8';
        for (const d of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(d * s * 0.4, -s * 1.15);
          ctx.lineTo(d * s * 0.6, -s * 1.6);
          ctx.lineTo(d * s * 0.7, -s * 1.1);
          ctx.fill();
        }
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-s * 0.55, -s * 1.0);
        ctx.lineTo(-s * 0.2, -s * 0.9);
        ctx.moveTo(s * 0.32, -s * 1.0);
        ctx.lineTo(0, -s * 0.9);
        ctx.stroke();
      }
      ctx.restore();
      if (ai.mode === 'warn') {
        ctx.save();
        ctx.globalAlpha = 0.5 + Math.sin(t * 20) * 0.3;
        ellipse(ctx, 0, -s * big * 0.8, s * big * 1.4, s * big * 1.2, null, '#c58cff', 5);
        ctx.restore();
      }
    },
  };

  function pumpkinHead(ctx, x, y, r, t) {
    ctx.save();
    ctx.translate(x, y);
    for (const dx of [-0.45, 0.45]) ellipse(ctx, dx * r, 0, r * 0.6, r * 0.85, '#e8781a', OUTLINE, 2);
    ellipse(ctx, 0, 0, r * 0.65, r * 0.9, '#f08a24', OUTLINE, 2);
    ctx.fillStyle = '#5b8a3a';
    ctx.fillRect(-r * 0.08, -r * 1.1, r * 0.16, r * 0.3);
    const glow = 0.7 + Math.sin(t * 6) * 0.3;
    ctx.fillStyle = `rgba(255,230,90,${glow})`;
    for (const dx of [-0.35, 0.25]) {
      ctx.beginPath();
      ctx.moveTo(dx * r - r * 0.13, -r * 0.1);
      ctx.lineTo(dx * r, -r * 0.35);
      ctx.lineTo(dx * r + r * 0.13, -r * 0.1);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, r * 0.25);
    ctx.lineTo(-r * 0.2, r * 0.4);
    ctx.lineTo(0, r * 0.28);
    ctx.lineTo(r * 0.2, r * 0.4);
    ctx.lineTo(r * 0.4, r * 0.25);
    ctx.lineTo(0, r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

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
    } else if (weapon === 'orb') {
      const glow = shotAge !== undefined && shotAge < 0.15 ? 1.3 : 1;
      ellipse(ctx, s * 0.55, 0, s * 0.3 * glow, s * 0.3 * glow, '#c9e6ff', '#3d8fd1', 2);
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s * 0.45, -s * 0.15);
      ctx.lineTo(s * 0.6, 0);
      ctx.lineTo(s * 0.5, s * 0.02);
      ctx.lineTo(s * 0.65, s * 0.17);
      ctx.stroke();
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
    orb(ctx) {
      ellipse(ctx, 0, 0, 14, 14, '#c9e6ff', '#3d8fd1', 2.5);
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-6, -8);
      ctx.lineTo(2, -1);
      ctx.lineTo(-3, 1);
      ctx.lineTo(6, 9);
      ctx.stroke();
      ellipse(ctx, -5, -6, 3, 2, 'rgba(255,255,255,0.8)');
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

  // 剪影缓存：每种怪物生成一次纯色剪影，之后直接贴图（用于暗夜远处的怪、墨墨召唤的墨影）
  const silhouetteCache = {};
  S.silhouette = function (type, size, color) {
    const key = type + '|' + size + '|' + color;
    if (silhouetteCache[key]) return silhouetteCache[key];
    if (typeof document === 'undefined') return null;
    const w = Math.ceil(size * 7);
    const h = Math.ceil(size * 7);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const cx = c.getContext('2d');
    const ox = w / 2;
    const oy = h * 0.72;
    S.monster(cx, type, ox, oy, size, 0.3, { attack: false });
    cx.globalCompositeOperation = 'source-in';
    cx.fillStyle = color;
    cx.fillRect(0, 0, w, h);
    return (silhouetteCache[key] = { canvas: c, ox, oy });
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
