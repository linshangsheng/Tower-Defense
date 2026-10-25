// 第六章 · 云端王国（设计书 56.4）的怪物画法：工具函数（发光、眼睛、符文、胶质、四足……）在 creatures.js
(function (TD) {
  'use strict';

  const K = TD.creatures;
  const D = K.drawers;
  const TAU = Math.PI * 2;
  const { deep, light, rgba, bodyGrad, glow, shadow, eyes, rune, dot, wing, jelly, jellyEyes, quadruped, seeded, strokes, speckle, scales, veins, sparkles, rimEdge, linear, radial } = K;

  // ======================================================================
  // 第六章 · 云端王国（设计书 56.4、60.3）
  // ======================================================================

  // 一串圆连成的轮廓（云絮、云团），用来裁剪
  function puffPath(ctx, list) {
    ctx.beginPath();
    for (const [x, y, r] of list) {
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, TAU);
    }
  }

  // 云絮 / 云团：一团团从后往前画；整体右上亮、左下暗，每团右上有高光和一道轮廓光，团与团之间分得清
  function cloudMass(ctx, list, hi, mid, lo, shade, sa, rim, ra) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [x, y, r] of list) {
      x0 = Math.min(x0, x - r);
      y0 = Math.min(y0, y - r);
      x1 = Math.max(x1, x + r);
      y1 = Math.max(y1, y + r);
    }
    const g = linear(ctx, x1, y0, x0, y1, [[0, hi], [0.5, mid], [1, lo]]);
    for (const [x, y, r] of list) {
      const path = () => {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
      };
      path();
      ctx.fillStyle = g;
      ctx.fill();
      ctx.fillStyle = radial(ctx, x + r * 0.35, y - r * 0.4, 0, r * 1.5, [[0, rgba(hi, 0.7)], [0.3, rgba(hi, 0)], [0.62, rgba(shade, 0)], [1, rgba(shade, sa)]]);
      ctx.fill();
      if (rim) rimEdge(ctx, path, rim, ra, r * 0.2, r * 0.12, r * 0.12);
    }
  }

  // 小卷卷（羊毛卷、云卷）：一段段小弧，a0 是弧的起始角、span 是弧长（角度）；skip = [x, y, rx, ry] 时这块椭圆里不画（留出脸）
  function curls(ctx, x, y, rx, ry, n, color, a, seed, rr, w, a0, span, skip) {
    const r = seeded(seed);
    ctx.save();
    ctx.strokeStyle = rgba(color, a);
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const q = r() * TAU;
      const d = Math.sqrt(r());
      const px = x + Math.cos(q) * rx * d;
      const py = y + Math.sin(q) * ry * d;
      const k = rr * (0.6 + r() * 0.8);
      const b = a0 + (r() - 0.5) * 0.6;
      if (skip && ((px - skip[0]) / skip[2]) ** 2 + ((py - skip[1]) / skip[3]) ** 2 < 1) continue;
      ctx.moveTo(px + Math.cos(b) * k, py + Math.sin(b) * k);
      ctx.arc(px, py, k, b, b + span);
    }
    ctx.stroke();
    ctx.restore();
  }

  // 羽毛翅膀：几根长羽毛扇形排开，半透明，羽轴发亮；ang 是整只翅膀的朝向（0 = 向上）
  function featherWing(ctx, x, y, len, ang, color, a) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    for (let i = 4; i >= 0; i--) {
      const l = len * (1 - i * 0.11);
      ctx.save();
      ctx.rotate((i - 1) * 0.2);
      ctx.fillStyle = linear(ctx, 0, 0, 0, -l, [[0, rgba(color, a * 0.25)], [0.6, rgba(color, a * 0.6)], [1, rgba(color, a * 0.9)]]);
      ctx.beginPath();
      ctx.moveTo(-l * 0.05, 0);
      ctx.quadraticCurveTo(-l * 0.17, -l * 0.6, 0, -l);
      ctx.quadraticCurveTo(l * 0.13, -l * 0.55, l * 0.07, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba('#ffffff', a * 0.55);
      ctx.lineWidth = Math.max(0.6, l * 0.025);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-l * 0.03, -l * 0.55, 0, -l * 0.94);
      ctx.stroke();
      ctx.restore();
    }
    // 翅膀根部的覆羽
    ctx.fillStyle = linear(ctx, 0, 0, 0, -len * 0.42, [[0, rgba(color, a * 0.45)], [1, rgba(color, a)]]);
    ctx.beginPath();
    ctx.ellipse(len * 0.02, -len * 0.2, len * 0.1, len * 0.23, 0.1, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // 云朵羊：一团发光的云絮包着修长的黑脸小羊；剃光毛后是瘦长的粉色身体
  D.cloudSheep = function (ctx, s, t, o) {
    const woolLeft = o.wool === null || o.wool === undefined ? 1 : o.wool;
    const sheared = woolLeft <= 0;
    const sd = o.seed || 0;
    shadow(ctx, 0, 2, s);
    const q = quadruped(ctx, s, t, o, { base: sheared ? '#e0a0c0' : '#3a3048', len: s * 1.3, high: s * 0.3, legLen: s * 0.42, run: sheared ? 2.0 : 0.9 });
    const by = q.bodyY;
    // 小蹄子：近侧两条腿的腿尖
    ctx.fillStyle = sheared ? '#6a3a58' : '#6a6088';
    ctx.beginPath();
    for (const [lx, p] of [[-q.L * 0.32, 0], [q.L * 0.34, Math.PI]]) {
      const hx = lx + Math.sin(q.ph + p) * s * 0.45 - s * 0.05;
      ctx.moveTo(hx + s * 0.065, -s * 0.03);
      ctx.ellipse(hx, -s * 0.03, s * 0.065, s * 0.035, 0, 0, TAU);
    }
    ctx.fill();
    const k = 0.55 + woolLeft * 0.45;
    if (!sheared) {
      // 身后飘散的两缕云气
      for (let i = 0; i < 2; i++) {
        const f = (t * 0.5 + i * 0.5 + sd * 0.13) % 1;
        ctx.fillStyle = rgba('#f4f6ff', 0.4 * Math.sin(f * Math.PI));
        ctx.beginPath();
        ctx.ellipse(s * (0.75 * k + f * 0.6), by - s * (0.12 + i * 0.28) - f * s * 0.1, s * 0.17 * (1 - f * 0.4), s * 0.07, 0, 0, TAU);
        ctx.fill();
      }
      glow(ctx, s * 0.1, by - s * 0.35, s * 1.0, '#ffffff', 0.3);
      // 云絮：一团团软软的圆，会轻轻起伏（呼吸）；羊毛越少团越小
      const br = Math.sin(t * 2.4 + sd) * 0.03;
      const P = [[0.1, -0.5, 0.5], [-0.2, -0.62, 0.3], [0.45, -0.6, 0.28], [-0.35, -0.3, 0.42], [0.5, -0.28, 0.4], [-0.55, -0.08, 0.26], [0.72, -0.06, 0.24], [-0.05, -0.1, 0.45], [0.35, -0.05, 0.38]].map(([x, y, r], i) => [s * x * k, by + s * y, s * r * k * (1 + (i % 2 ? br : -br))]);
      // 外面一圈半透明的云气
      ctx.fillStyle = 'rgba(244,246,255,0.2)';
      ctx.beginPath();
      for (const [x, y, r] of P) {
        ctx.moveTo(x + r * 1.13, y);
        ctx.arc(x, y, r * 1.13, 0, TAU);
      }
      ctx.fill();
      cloudMass(ctx, P, '#ffffff', '#eef1fc', '#aab2da', '#6a70a8', 0.45, '#ffffff', 0.55);
      // 羊毛卷：亮的小弧在卷顶，暗的小弧在卷底，两批错开，不连成一个个圈
      ctx.save();
      puffPath(ctx, P);
      ctx.clip();
      curls(ctx, s * 0.08 * k, by - s * 0.28, s * 0.78 * k, s * 0.42, 18, '#6a70a8', 0.3, 4, s * 0.07 * k, s * 0.03, 0.2 * Math.PI, 0.6 * Math.PI);
      curls(ctx, s * 0.08 * k, by - s * 0.32, s * 0.78 * k, s * 0.42, 24, '#ffffff', 0.85, 3, s * 0.075 * k, s * 0.03, 1.1 * Math.PI, 0.8 * Math.PI);
      ctx.restore();
      sparkles(ctx, s * 0.1, by - s * 0.45, s * 0.95 * k, s * 0.45, 3, t, '#ffffff', 11, 1.1);
    } else {
      // 剃过的短绒：上亮下暗 + 细细的笔触
      const bp = () => {
        ctx.beginPath();
        ctx.ellipse(0, by, q.L * 0.62, s * 0.3, -0.05, 0, TAU);
      };
      ctx.save();
      bp();
      ctx.clip();
      ctx.fillStyle = linear(ctx, q.L * 0.3, by - s * 0.3, -q.L * 0.2, by + s * 0.3, [[0, 'rgba(255,236,246,0.55)'], [0.45, 'rgba(255,236,246,0)'], [0.75, 'rgba(110,40,80,0)'], [1, 'rgba(110,40,80,0.25)']]);
      ctx.fillRect(-q.L, by - s * 0.3, q.L * 2, s * 0.6);
      strokes(ctx, s * 0.05, by - s * 0.08, q.L * 0.5, s * 0.18, 20, '#ffe4f2', 0.4, 5, -2.0, s * 0.06);
      ctx.restore();
      rimEdge(ctx, bp, '#fff0f8', 0.6, s * 0.07, s * 0.05, s * 0.05);
      // 跑得飞快：身后几道粉白的风线
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineWidth = s * 0.035;
      for (let i = 0; i < 3; i++) {
        const f = (t * 2.5 + i / 3) % 1;
        const x = q.L * 0.55 + f * s * 0.7;
        const y = by - s * 0.22 + i * s * 0.17;
        ctx.strokeStyle = rgba('#ffe0f0', 0.6 * (1 - f));
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + s * 0.35 * (1 - f * 0.5), y);
        ctx.stroke();
      }
      ctx.restore();
    }
    // 小尾巴：一小团毛（剃光后是细细的粉尾巴），左右甩
    ctx.save();
    ctx.translate(sheared ? q.L * 0.58 : s * 0.84 * k, by - s * (sheared ? 0.12 : 0.3));
    ctx.rotate(-0.5 + Math.sin(t * 7 + sd) * 0.4);
    if (sheared) {
      ctx.fillStyle = '#c87aa0';
      ctx.beginPath();
      ctx.ellipse(s * 0.1, 0, s * 0.12, s * 0.035, 0, 0, TAU);
      ctx.fill();
    } else cloudMass(ctx, [[s * 0.08, 0, s * 0.1 * k]], '#ffffff', '#e6eaf8', '#aab2d8', '#6a70a8', 0.5);
    ctx.restore();
    // 头：黑色长脸，右上受光；会轻轻点头
    const hx = -s * 0.72;
    const hy = by - s * 0.25 + Math.sin(t * 2.2 + sd) * s * 0.015;
    // 往后贴的耳朵（内侧粉色），偶尔抖一下
    ctx.save();
    ctx.translate(-s * 0.55, hy - s * 0.15);
    ctx.rotate(0.4 + Math.pow(Math.max(0, Math.sin(t * 4 + sd)), 8) * 0.5);
    ctx.fillStyle = '#2a2236';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.13, s * 0.055, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = sheared ? 'rgba(255,160,205,0.75)' : 'rgba(255,150,200,0.5)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.01, s * 0.008, s * 0.085, s * 0.025, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    const head = () => {
      ctx.beginPath();
      ctx.ellipse(hx, hy, s * 0.21, s * 0.15, -0.5, 0, TAU);
    };
    head();
    ctx.fillStyle = radial(ctx, hx, hy, s * 0.02, s * 0.24, [[0, '#5e5078'], [0.55, '#30283f'], [1, '#15111d']], hx + s * 0.07, hy - s * 0.08);
    ctx.fill();
    // 鼻头一点柔光、小鼻孔
    ctx.fillStyle = 'rgba(190,175,230,0.3)';
    ctx.beginPath();
    ctx.ellipse(hx - s * 0.12, hy + s * 0.06, s * 0.065, s * 0.04, -0.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(8,6,14,0.7)';
    ctx.beginPath();
    ctx.arc(hx - s * 0.165, hy + s * 0.075, s * 0.014, 0, TAU);
    ctx.fill();
    rimEdge(ctx, head, '#e0d8ff', 0.5, s * 0.05, s * 0.035, s * 0.035);
    // 额头上的一小撮羊毛
    if (!sheared) cloudMass(ctx, [[hx + s * 0.13, hy - s * 0.11, s * 0.055 * k], [hx + s * 0.02, hy - s * 0.12, s * 0.055 * k], [hx + s * 0.08, hy - s * 0.15, s * 0.065 * k]], '#ffffff', '#e6eaf8', '#aab2d8', '#6a70a8', 0.5);
    eyes(ctx, hx - s * 0.04, hy - s * 0.05, 0.01, s * 0.05, sheared ? '#ffb0d0' : '#fff6d0', -0.3);
  };

  // 风筝怪：菱形的布风筝（木骨架、缝线、四块明暗不同的布面），身后拖着系蝴蝶结的长尾巴
  D.kite = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    const sway = Math.sin(t * 3.5 + sd);
    ctx.save();
    ctx.globalAlpha = 0.4;
    shadow(ctx, 0, 34, s * 0.6);
    ctx.restore();
    ctx.translate(0, Math.sin(t * 4) * 4 - s * 0.6);
    ctx.rotate(sway * 0.15);
    const P = '#ff7a9a';
    // 尾巴：一根细绳往身后飘，波浪越往后越大
    const tail = (f) => [s * 1.45 * f, s * (0.95 + 0.15 * f) + Math.sin(f * 6 - t * 8 + sd) * s * 0.12 * f];
    ctx.save();
    ctx.strokeStyle = 'rgba(255,215,230,0.8)';
    ctx.lineWidth = s * 0.035;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 14; i++) {
      const [x, y] = tail(i / 14);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
    // 尾巴上的三只小蝴蝶结：一扇一扇，微微发光
    ['#ffd27a', '#8ad0ff', '#9aff8a'].forEach((c, i) => {
      const f = 0.3 + i * 0.3;
      const [x, y] = tail(f);
      const [x2, y2] = tail(f + 0.02);
      glow(ctx, x, y, s * 0.32, c, 0.35);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(y2 - y, x2 - x));
      ctx.scale(1, 0.75 + Math.sin(t * 14 + i * 2 + sd) * 0.25);
      const b = s * 0.16;
      ctx.fillStyle = linear(ctx, 0, -b, 0, b, [[0, light(c, 0.45)], [1, deep(c, 0.3)]]);
      ctx.beginPath();
      for (const d of [-1, 1]) {
        ctx.moveTo(0, 0);
        ctx.lineTo(-b * 0.45, d * b);
        ctx.quadraticCurveTo(0, d * b * 0.8, b * 0.45, d * b);
        ctx.closePath();
      }
      ctx.fill();
      ctx.fillStyle = light(c, 0.6);
      ctx.beginPath();
      ctx.arc(0, 0, b * 0.2, 0, TAU);
      ctx.fill();
      ctx.restore();
    });
    // 右边角上的一条小飘带
    ctx.save();
    ctx.strokeStyle = rgba('#ffe6a0', 0.85);
    ctx.lineWidth = s * 0.05;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.66, 0);
    ctx.bezierCurveTo(s * 0.8, -s * 0.06 + sway * s * 0.05, s * 0.9, s * 0.08 - sway * s * 0.06, s * 1.05, s * 0.02 + Math.sin(t * 9 + sd) * s * 0.07);
    ctx.stroke();
    ctx.restore();
    // 风筝面：四块布，被风吹得微微鼓起；右上那块最亮、左下那块最暗
    const T = [0, -s * 0.95];
    const R = [s * 0.68, 0];
    const B = [0, s * 0.95];
    const L = [-s * 0.68, 0];
    const mid = (a, b, kk) => [((a[0] + b[0]) / 2) * (1 + kk), ((a[1] + b[1]) / 2) * (1 + kk)];
    const edge = (a, b, kk) => {
      const m = mid(a, b, kk);
      ctx.quadraticCurveTo(m[0], m[1], b[0], b[1]);
    };
    const diamond = () => {
      ctx.beginPath();
      ctx.moveTo(T[0], T[1]);
      edge(T, R, 0.12);
      edge(R, B, 0.12);
      edge(B, L, 0.12);
      edge(L, T, 0.12);
      ctx.closePath();
    };
    for (const [a, b, c0, c1] of [[T, R, light(P, 0.5), light(P, 0.15)], [L, T, light(P, 0.15), deep(P, 0.12)], [R, B, P, deep(P, 0.32)], [B, L, deep(P, 0.25), deep(P, 0.55)]]) {
      const m = mid(a, b, 0.12);
      ctx.fillStyle = linear(ctx, m[0], m[1], 0, 0, [[0, c0], [1, c1]]);
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(a[0], a[1]);
      edge(a, b, 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.save();
    diamond();
    ctx.clip();
    // 布纹：很淡的斜纹；一道慢慢滑过的光泽
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = s * 0.02;
    ctx.beginPath();
    for (let x = -s * 1.6; x < s * 1.6; x += s * 0.09) {
      ctx.moveTo(x, -s);
      ctx.lineTo(x + s, s);
    }
    ctx.stroke();
    const sh = (((t * 0.35 + sd * 0.17) % 1) * 2.4 - 1.2) * s;
    ctx.fillStyle = linear(ctx, sh - s * 0.3, -s * 0.3, sh + s * 0.3, s * 0.3, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,0.22)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(-s, -s, s * 2, s * 2);
    // 左下那块布上的一个发光的小旋涡（风的记号）
    const sp = [];
    for (let i = 0; i <= 20; i++) {
      const a = i * 0.45;
      const rr = s * 0.012 + i * s * 0.0065;
      sp.push([-s * 0.18 + Math.cos(a) * rr, s * 0.3 + Math.sin(a) * rr]);
    }
    rune(ctx, sp, '#ffd6e6', s * 0.035, 0.7);
    ctx.restore();
    // 布边：深一点的包边 + 一圈虚线缝线
    diamond();
    ctx.strokeStyle = deep(P, 0.5);
    ctx.lineWidth = s * 0.04;
    ctx.stroke();
    ctx.save();
    ctx.scale(0.85, 0.87);
    diamond();
    ctx.restore();
    ctx.save();
    ctx.setLineDash([s * 0.07, s * 0.05]);
    ctx.strokeStyle = 'rgba(255,240,246,0.75)';
    ctx.lineWidth = s * 0.022;
    ctx.stroke();
    ctx.restore();
    // 木头骨架：深色 + 受光一侧一道亮边；横杆被风吹得微微弯
    const spars = (dx, dy) => {
      ctx.beginPath();
      ctx.moveTo(T[0] + dx, T[1] + s * 0.04 + dy);
      ctx.lineTo(B[0] + dx, B[1] - s * 0.04 + dy);
      ctx.moveTo(L[0] + s * 0.04 + dx, dy);
      ctx.quadraticCurveTo(dx, -s * 0.12 + dy, R[0] - s * 0.04 + dx, dy);
    };
    ctx.lineCap = 'round';
    spars(0, 0);
    ctx.strokeStyle = '#4a2a22';
    ctx.lineWidth = s * 0.055;
    ctx.stroke();
    spars(s * 0.012, -s * 0.012);
    ctx.strokeStyle = 'rgba(255,214,170,0.6)';
    ctx.lineWidth = s * 0.018;
    ctx.stroke();
    dot(ctx, 0, -s * 0.06, s * 0.05, '#ffe6a0', 0.9);
    rimEdge(ctx, diamond, '#ffffff', 0.55, s * 0.07, s * 0.045, s * 0.045);
    // 眼睛：先画一点深色的眼窝，粉色布面上也看得清
    ctx.fillStyle = rgba('#5a1030', 0.5);
    ctx.beginPath();
    for (const ex of [-0.19, 0.09]) {
      ctx.moveTo(s * ex + s * 0.1, -s * 0.2);
      ctx.ellipse(s * ex, -s * 0.2, s * 0.1, s * 0.06, -0.1, 0, TAU);
    }
    ctx.fill();
    eyes(ctx, -s * 0.05, -s * 0.2, s * 0.28, s * 0.06, '#ffffff', -0.1);
  };

  // 雷团子：一团毛茸茸、噼啪作响的电光球，头顶翘着一撮闪电形的呆毛
  D.thunderBall = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    const roll = t * 6 + sd;
    const hop = Math.abs(Math.sin(roll));
    shadow(ctx, 0, 2, s * 0.8);
    ctx.translate(0, -s * 0.8 - hop * 3);
    // 落地时稍微压扁一点
    const sq = 1 + (1 - hop) * 0.05;
    ctx.scale(sq, 1 / sq);
    glow(ctx, 0, 0, s * 1.4, '#ffd23f', 0.5);
    const R = s * 0.72;
    const fr = Math.floor(t * 10);
    // 静电绒毛：一圈细细的毛往外炸开，受光一侧亮
    const r = seeded(17);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = s * 0.05;
    ctx.strokeStyle = linear(ctx, R, -R, -R, R, [[0, '#fff6b8'], [0.5, '#ffc828'], [1, '#a86a0c']]);
    ctx.beginPath();
    for (let i = 0; i < 44; i++) {
      const a = (i / 44) * TAU + (r() - 0.5) * 0.12;
      const l = R * (1.06 + r() * 0.14 + (i % 3 === fr % 3 ? 0.05 : 0));
      ctx.moveTo(Math.cos(a) * R * 0.85, Math.sin(a) * R * 0.85);
      ctx.lineTo(Math.cos(a + 0.06) * l, Math.sin(a + 0.06) * l);
    }
    ctx.stroke();
    ctx.restore();
    // 身体：右上一点白光，往左下变成深琥珀色
    const ball = () => {
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, TAU);
    };
    ball();
    ctx.fillStyle = radial(ctx, 0, 0, R * 0.05, R, [[0, '#fffbe0'], [0.3, '#ffd84a'], [0.75, '#e0961a'], [1, '#8a4e0a']], R * 0.3, -R * 0.35);
    ctx.fill();
    ctx.save();
    ball();
    ctx.clip();
    // 表面的短绒：右上亮、左下暗
    const r2 = seeded(29);
    ctx.lineCap = 'round';
    ctx.lineWidth = s * 0.03;
    for (const [col, side] of [['rgba(255,250,215,0.5)', 1], ['rgba(120,60,0,0.35)', -1]]) {
      ctx.strokeStyle = col;
      ctx.beginPath();
      for (let i = 0; i < 40; i++) {
        const a = r2() * TAU;
        const d = R * (0.3 + r2() * 0.62);
        const px = Math.cos(a) * d;
        const py = Math.sin(a) * d;
        if ((px - py > 0 ? 1 : -1) !== side) continue;
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(a) * R * 0.13, py + Math.sin(a) * R * 0.13);
      }
      ctx.stroke();
    }
    // 体内窜动的电光（一闪一闪地换形状）
    for (let i = 0; i < 3; i++) veins(ctx, 0, R * 0.05, R * 0.5, 1.6 + i * 2.1, 2, '#fff8d0', 0.7, 30 + i * 5 + (fr % 4), s * 0.035);
    ctx.restore();
    glow(ctx, 0, 0, R * 0.7, '#fff3a0', 0.35, true);
    rimEdge(ctx, ball, '#ffffff', 0.6, s * 0.07, s * 0.05, s * 0.05);
    // 头顶的闪电呆毛：一抖一抖
    ctx.save();
    ctx.translate(R * 0.12, -R * 0.9);
    ctx.rotate(0.25 + Math.sin(t * 9 + sd) * 0.2);
    const bolt = () => {
      ctx.beginPath();
      ctx.moveTo(-R * 0.08, R * 0.06);
      ctx.lineTo(-R * 0.14, -R * 0.26);
      ctx.lineTo(R * 0.02, -R * 0.24);
      ctx.lineTo(-R * 0.02, -R * 0.5);
      ctx.lineTo(R * 0.16, -R * 0.14);
      ctx.lineTo(R * 0.02, -R * 0.16);
      ctx.lineTo(R * 0.08, R * 0.06);
      ctx.closePath();
    };
    glow(ctx, 0, -R * 0.2, R * 0.5, '#fff3a0', 0.5);
    bolt();
    ctx.fillStyle = linear(ctx, R * 0.15, -R * 0.5, -R * 0.15, R * 0.05, [[0, '#fffbe0'], [1, '#ffb420']]);
    ctx.fill();
    ctx.restore();
    // 绕着身体转的小闪电
    for (let i = 0; i < 3; i++) {
      const a = roll * 0.7 + (i * TAU) / 3;
      veins(ctx, Math.cos(a) * R * 1.0, Math.sin(a) * R * 1.0, R * 0.32, a + 0.2, 1, '#fff6b0', 0.95, 50 + i * 3 + (fr % 3), s * 0.06);
      dot(ctx, Math.cos(a) * R * 1.0, Math.sin(a) * R * 1.0, s * 0.05, '#fff8d0', 0.8);
    }
    sparkles(ctx, 0, 0, R * 1.35, R * 1.2, 4, t * 2, '#fff3a0', 23, 1.1);
    // 发光的、斜着的眼睛（看起来在生气）；先垫一点深色眼窝，亮黄身体上也看得清
    ctx.fillStyle = 'rgba(90,40,0,0.5)';
    ctx.beginPath();
    for (const ex of [-0.31, 0.01]) {
      ctx.moveTo(s * ex + s * 0.12, -s * 0.08);
      ctx.ellipse(s * ex, -s * 0.08, s * 0.12, s * 0.075, 0.25, 0, TAU);
    }
    ctx.fill();
    eyes(ctx, -s * 0.15, -s * 0.08, s * 0.32, s * 0.08, '#ffffff', 0.25);
  };

  // 彩虹鸟：修长的蓝色小鸟，羽毛翅膀、头顶小冠羽，身后拖着一条彩虹色的光尾
  D.rainbowBird = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    const flap = Math.sin(t * 12 + sd);
    ctx.save();
    ctx.globalAlpha = 0.4;
    shadow(ctx, 0, 34, s * 0.6);
    ctx.restore();
    ctx.translate(0, -s * 0.7 + Math.sin(t * 3) * 3);
    const BC = '#5aa8e8';
    const cols = ['#ff7a7a', '#ffb347', '#ffe066', '#7fd67a', '#7ab8ff', '#b48aff'];
    // 远侧的翅膀：更暗、更透
    featherWing(ctx, s * 0.14, -s * 0.12, s * 0.75, 0.95 + flap * 0.45, '#6a9ad8', 0.55);
    // 彩虹尾巴：六条渐细的光带，波浪一样飘，往后散开
    ctx.save();
    ctx.lineCap = 'butt';
    cols.forEach((c, i) => {
      let px = 0;
      let py = 0;
      for (let j = 0; j <= 8; j++) {
        const f = j / 8;
        const x = s * (0.38 + 1.2 * f);
        const y = -s * 0.06 + i * s * (0.05 + 0.035 * f) + Math.sin(f * 3.4 - t * 6 + sd) * s * 0.1 * f + flap * s * 0.05 * f;
        if (j) {
          ctx.strokeStyle = rgba(c, 0.88 * (1 - f * 0.55));
          ctx.lineWidth = s * (0.075 - 0.04 * f);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        px = x;
        py = y;
      }
    });
    ctx.restore();
    glow(ctx, s * 1.45, s * 0.12, s * 0.45, '#ffffff', 0.22);
    // 尾巴末端飘出的彩色光尘
    for (let j = 0; j < 5; j++) {
      const f = (t * 0.7 + j * 0.2 + sd * 0.1) % 1;
      dot(ctx, s * (1.55 + f * 0.45), s * (0.02 + j * 0.06) + Math.sin(f * 6 + j) * s * 0.06, s * 0.05 * (1 - f * 0.4), cols[j], 0.85 * (1 - f));
    }
    // 头顶的冠羽：三根小羽毛，尖上带一点彩光
    for (let i = 0; i < 3; i++) {
      const a = -1.25 + i * 0.35 + Math.sin(t * 5 + i + sd) * 0.12;
      const l = s * (0.3 - i * 0.04);
      ctx.save();
      ctx.translate(-s * 0.42, -s * 0.26);
      ctx.rotate(a);
      ctx.fillStyle = linear(ctx, 0, 0, l, 0, [[0, deep(BC, 0.3)], [0.7, BC], [1, cols[i * 2]]]);
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.025);
      ctx.quadraticCurveTo(l * 0.6, -s * 0.05, l, 0);
      ctx.quadraticCurveTo(l * 0.6, s * 0.03, 0, s * 0.025);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      dot(ctx, -s * 0.42 + Math.cos(a) * l, -s * 0.26 + Math.sin(a) * l, s * 0.035, cols[i * 2], 0.8);
    }
    // 身体 + 头：右上受光
    const body = () => {
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.48, s * 0.24, -0.1, 0, TAU);
      ctx.moveTo(-s * 0.25, -s * 0.15);
      ctx.ellipse(-s * 0.45, -s * 0.15, s * 0.2, s * 0.17, 0, 0, TAU);
    };
    body();
    ctx.fillStyle = radial(ctx, s * 0.12, -s * 0.18, s * 0.02, s * 0.62, [[0, light(BC, 0.35)], [0.3, BC], [0.75, deep(BC, 0.3)], [1, deep(BC, 0.6)]]);
    ctx.fill();
    ctx.save();
    body();
    ctx.clip();
    // 浅色的胸脯（只在下巴到胸前一小块）
    ctx.fillStyle = radial(ctx, -s * 0.38, s * 0.04, 0, s * 0.26, [[0, 'rgba(225,244,255,0.6)'], [1, 'rgba(225,244,255,0)']]);
    ctx.fillRect(-s * 0.8, -s * 0.4, s * 1.4, s * 0.7);
    // 羽毛笔触：顺着身体往后，背上亮、肚子下暗
    strokes(ctx, s * 0.08, -s * 0.1, s * 0.36, s * 0.1, 14, '#e0f2ff', 0.35, 7, 0.15, s * 0.1);
    strokes(ctx, s * 0.05, s * 0.1, s * 0.32, s * 0.08, 8, '#12305a', 0.3, 9, 0.2, s * 0.09);
    // 彩虹光泽：一道慢慢滑过的彩色反光
    const sh = Math.sin(t * 1.5 + sd) * s * 0.3;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = linear(ctx, -s * 0.45 + sh, -s * 0.3, s * 0.3 + sh, s * 0.15, [[0, 'rgba(255,120,120,0)'], [0.2, 'rgba(255,150,90,0.14)'], [0.4, 'rgba(255,230,110,0.14)'], [0.6, 'rgba(120,230,140,0.12)'], [0.8, 'rgba(160,130,255,0.14)'], [1, 'rgba(180,120,255,0)']]);
    ctx.fillRect(-s, -s * 0.5, s * 2, s);
    ctx.restore();
    rimEdge(ctx, body, '#ffffff', 0.6, s * 0.06, s * 0.035, s * 0.035);
    // 金色的小尖嘴
    ctx.fillStyle = linear(ctx, 0, -s * 0.17, 0, -s * 0.05, [[0, '#fff0b8'], [1, '#c8862a']]);
    ctx.beginPath();
    ctx.moveTo(-s * 0.61, -s * 0.17);
    ctx.lineTo(-s * 0.86, -s * 0.1);
    ctx.lineTo(-s * 0.61, -s * 0.05);
    ctx.closePath();
    ctx.fill();
    eyes(ctx, -s * 0.5, -s * 0.18, 0.01, s * 0.05, '#ffffff', 0);
    // 近侧的翅膀
    featherWing(ctx, s * 0.05, -s * 0.15, s * 0.9, 0.6 + flap * 0.5, '#a8dcff', 0.9);
    // 治疗的光点
    const hx = -s * 0.2 + Math.sin(t * 2) * s * 0.3;
    const ha = 0.6 + Math.sin(t * 4) * 0.3;
    dot(ctx, hx, -s * 0.6, 1.3, '#a8ffcf', ha);
    rune(ctx, [[hx - s * 0.08, -s * 0.6], [hx + s * 0.08, -s * 0.6]], '#a8ffcf', s * 0.03, ha * 0.8);
    rune(ctx, [[hx, -s * 0.68], [hx, -s * 0.52]], '#a8ffcf', s * 0.03, ha * 0.8);
    sparkles(ctx, -s * 0.1, -s * 0.2, s * 0.6, s * 0.4, 2, t, '#a8ffcf', 37, 0.9);
  };

  // 热气球：一瓣瓣的条纹布气球（缝线、花边、补丁），喷着火苗的燃烧器，藤编小篮子里探出哥布林的头
  D.balloon = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    const bob = Math.sin(t * 2 + sd) * 3;
    ctx.save();
    ctx.globalAlpha = 0.4;
    shadow(ctx, 0, 34, s * 0.8);
    ctx.restore();
    ctx.translate(0, bob - s * 0.4);
    const fl = 1 + Math.sin(t * 17 + sd) * 0.18 + Math.sin(t * 29 + sd * 2) * 0.1;
    // 绳子：外侧两根清楚，里侧两根淡一点
    ctx.lineWidth = s * 0.03;
    ctx.strokeStyle = 'rgba(90,64,40,0.85)';
    ctx.beginPath();
    for (const d of [-1, 1]) {
      ctx.moveTo(d * s * 0.5, -s * 1.0);
      ctx.lineTo(d * s * 0.27, -s * 0.24);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(90,64,40,0.45)';
    ctx.beginPath();
    for (const d of [-1, 1]) {
      ctx.moveTo(d * s * 0.2, -s * 1.0);
      ctx.lineTo(d * s * 0.12, -s * 0.24);
    }
    ctx.stroke();
    // 气球：一瓣瓣橙色 / 奶油色的布（越靠边越窄，像圆球）
    const gore = (u) => [u * s * 0.5, -s * 1.0, u * s * 1.15, -s * 1.5, u * s * 0.85, -s * 2.6];
    const env = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.5, -s * 1.0);
      ctx.bezierCurveTo(-s * 1.15, -s * 1.5, -s * 0.85, -s * 2.6, 0, -s * 2.6);
      ctx.bezierCurveTo(s * 0.85, -s * 2.6, s * 1.15, -s * 1.5, s * 0.5, -s * 1.0);
      ctx.closePath();
    };
    env();
    ctx.fillStyle = '#ff9f2e';
    ctx.fill();
    ctx.save();
    env();
    ctx.clip();
    const N = 8;
    const us = [];
    for (let i = 0; i <= N; i++) us.push(Math.sin(-Math.PI / 2 + (i * Math.PI) / N));
    for (let i = 0; i < N; i++) {
      const a = gore(us[i]);
      const b = gore(us[i + 1]);
      ctx.fillStyle = i % 2 ? '#ffd9a0' : '#ff9f2e';
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.bezierCurveTo(a[2], a[3], a[4], a[5], 0, -s * 2.6);
      ctx.bezierCurveTo(b[4], b[5], b[2], b[3], b[0], b[1]);
      ctx.closePath();
      ctx.fill();
    }
    // 缝线：每瓣之间一道深线、旁边一道浅线
    for (const [col, dx] of [['rgba(90,36,16,0.45)', 0], ['rgba(255,236,210,0.3)', s * 0.02]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = s * 0.02;
      ctx.beginPath();
      for (let i = 1; i < N; i++) {
        const a = gore(us[i]);
        ctx.moveTo(a[0] + dx, a[1]);
        ctx.bezierCurveTo(a[2] + dx, a[3], a[4] + dx * 0.5, a[5], 0, -s * 2.6);
      }
      ctx.stroke();
    }
    // 一圈红色花边，下面挂着一排小三角
    const band = (y, p) => y + 4 * p * (1 - p) * s * 0.12;
    ctx.fillStyle = '#d8482a';
    ctx.beginPath();
    ctx.moveTo(-s * 1.2, -s * 1.42);
    ctx.quadraticCurveTo(0, -s * 1.3, s * 1.2, -s * 1.42);
    ctx.lineTo(s * 1.2, -s * 1.32);
    ctx.quadraticCurveTo(0, -s * 1.2, -s * 1.2, -s * 1.32);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const p = (i + 0.5) / 14;
      const x = -s * 1.2 + p * s * 2.4;
      const y = band(-s * 1.32, p);
      ctx.moveTo(x - s * 0.07, y - s * 0.01);
      ctx.lineTo(x, y + s * 0.1);
      ctx.lineTo(x + s * 0.07, y - s * 0.01);
    }
    ctx.fillStyle = '#ffd060';
    ctx.fill();
    // 一块缝上去的蓝色小补丁
    ctx.save();
    ctx.translate(-s * 0.42, -s * 1.85);
    ctx.rotate(0.25);
    ctx.fillStyle = '#7ab8e0';
    ctx.fillRect(-s * 0.09, -s * 0.08, s * 0.18, s * 0.16);
    ctx.setLineDash([s * 0.03, s * 0.025]);
    ctx.strokeStyle = 'rgba(255,250,235,0.8)';
    ctx.lineWidth = s * 0.015;
    ctx.strokeRect(-s * 0.07, -s * 0.06, s * 0.14, s * 0.12);
    ctx.restore();
    // 明暗：右上一块高光，左下暗下去
    ctx.fillStyle = radial(ctx, s * 0.32, -s * 2.1, 0, s * 1.55, [[0, 'rgba(255,250,235,0.5)'], [0.3, 'rgba(255,250,235,0)'], [0.6, 'rgba(40,12,40,0)'], [1, 'rgba(40,12,40,0.6)']]);
    ctx.fillRect(-s * 1.3, -s * 2.7, s * 2.6, s * 1.8);
    // 里面的火光把下半部分照亮
    glow(ctx, 0, -s * 1.15, s * 0.95, '#ffb050', 0.4 * fl);
    ctx.restore();
    rimEdge(ctx, env, '#fff0d8', 0.55, s * 0.08, s * 0.06, s * 0.06);
    // 顶上的小盖子
    ctx.fillStyle = linear(ctx, 0, -s * 2.66, 0, -s * 2.56, [[0, '#ffe0b0'], [1, '#8a4a18']]);
    ctx.beginPath();
    ctx.ellipse(0, -s * 2.6, s * 0.16, s * 0.045, 0, 0, TAU);
    ctx.fill();
    // 气球口：深色的开口，里面透着火光
    ctx.fillStyle = '#3a1408';
    ctx.beginPath();
    ctx.ellipse(0, -s * 1.0, s * 0.5, s * 0.06, 0, 0, TAU);
    ctx.fill();
    glow(ctx, 0, -s * 1.05, s * 0.45, '#ffb050', 0.8);
    // 燃烧器：小铁罐 + 两根横撑，火苗一跳一跳
    ctx.strokeStyle = 'rgba(60,50,50,0.85)';
    ctx.lineWidth = s * 0.025;
    ctx.beginPath();
    ctx.moveTo(-s * 0.43, -s * 0.77);
    ctx.lineTo(s * 0.43, -s * 0.77);
    ctx.stroke();
    ctx.fillStyle = linear(ctx, -s * 0.07, 0, s * 0.07, 0, [[0, '#3a3a44'], [0.65, '#c8c8d8'], [1, '#5a5a66']]);
    ctx.fillRect(-s * 0.07, -s * 0.8, s * 0.14, s * 0.08);
    const fh = s * 0.24 * fl;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = radial(ctx, 0, -s * 0.8, 0, fh, [[0, 'rgba(255,250,220,0.95)'], [0.45, 'rgba(255,190,80,0.8)'], [1, 'rgba(255,90,30,0)']]);
    ctx.beginPath();
    ctx.moveTo(-s * 0.06, -s * 0.8);
    ctx.quadraticCurveTo(-s * 0.08, -s * 0.8 - fh * 0.6, 0, -s * 0.8 - fh);
    ctx.quadraticCurveTo(s * 0.08, -s * 0.8 - fh * 0.6, s * 0.06, -s * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    glow(ctx, 0, -s * 0.9, s * 0.3, '#ffb050', 0.5 * fl);
    // 哥布林：尖耳朵、发光的眼睛，从篮子里探出头（一探一探）
    const gx = -s * 0.05;
    const gy = -s * 0.31 + Math.sin(t * 3 + sd) * s * 0.02;
    const gc = '#5a8a48';
    ctx.fillStyle = deep(gc, 0.45);
    ctx.beginPath();
    for (const d of [-1, 1]) {
      ctx.moveTo(gx + d * s * 0.08, gy - s * 0.04);
      ctx.quadraticCurveTo(gx + d * s * 0.2, gy - s * 0.12, gx + d * s * 0.26, gy - s * 0.13);
      ctx.quadraticCurveTo(gx + d * s * 0.18, gy + s * 0.01, gx + d * s * 0.08, gy + s * 0.03);
      ctx.closePath();
    }
    ctx.fill();
    ctx.fillStyle = radial(ctx, gx, gy, s * 0.01, s * 0.15, [[0, deep(gc, 0.05)], [1, deep(gc, 0.6)]], gx + s * 0.05, gy - s * 0.05);
    ctx.beginPath();
    ctx.ellipse(gx, gy, s * 0.13, s * 0.11, 0, 0, TAU);
    ctx.fill();
    eyes(ctx, gx - s * 0.05, gy - s * 0.01, s * 0.08, s * 0.03, '#e8ff9a', -0.2);
    // 篮子：藤编的纹理、上沿一圈粗藤边
    const bk = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.32, -s * 0.25);
      ctx.lineTo(s * 0.32, -s * 0.25);
      ctx.lineTo(s * 0.27, s * 0.05);
      ctx.lineTo(-s * 0.27, s * 0.05);
      ctx.closePath();
    };
    bk();
    ctx.fillStyle = bodyGrad(ctx, -s * 0.32, -s * 0.25, s * 0.32, s * 0.05, '#b08a52', 0.1, 0.7);
    ctx.fill();
    ctx.save();
    bk();
    ctx.clip();
    // 一行行藤条：每根上半亮、下沿一道暗缝
    for (const [col, oy, rx, ry] of [['rgba(255,225,170,0.35)', -0.01, 0.04, 0.017], ['rgba(40,20,8,0.4)', 0.022, 0.045, 0.01]]) {
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let row = 0; row < 5; row++) {
        const y = -s * 0.19 + row * s * 0.07 + s * oy;
        for (let x = -s * 0.36 + (row % 2) * s * 0.05; x < s * 0.38; x += s * 0.1) {
          ctx.moveTo(x + s * rx, y);
          ctx.ellipse(x, y, s * rx, s * ry, 0, 0, TAU);
        }
      }
      ctx.fill();
    }
    ctx.restore();
    // 上沿的粗藤边
    ctx.fillStyle = linear(ctx, 0, -s * 0.29, 0, -s * 0.21, [[0, '#e8c08a'], [1, '#7a5228']]);
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.25, s * 0.34, s * 0.04, 0, 0, TAU);
    ctx.fill();
    rimEdge(ctx, bk, '#ffe8c0', 0.5, s * 0.05, s * 0.035, s * 0.035);
    // 扒着篮沿的两只小手
    ctx.fillStyle = deep(gc, 0.25);
    ctx.beginPath();
    for (const hx of [gx - s * 0.15, gx + s * 0.13]) {
      ctx.moveTo(hx + s * 0.035, -s * 0.27);
      ctx.arc(hx, -s * 0.27, s * 0.035, 0, TAU);
    }
    ctx.fill();
    // 两边挂着的小沙袋，跟着气球晃
    for (const d of [-1, 1]) {
      const a = Math.sin(t * 2.5 + sd + d) * 0.3;
      const x0 = d * s * 0.3;
      const x1 = x0 + Math.sin(a) * s * 0.13;
      const y1 = -s * 0.19 + Math.cos(a) * s * 0.13;
      ctx.strokeStyle = 'rgba(90,64,40,0.8)';
      ctx.lineWidth = s * 0.02;
      ctx.beginPath();
      ctx.moveTo(x0, -s * 0.21);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.fillStyle = radial(ctx, x1, y1 + s * 0.05, 0, s * 0.08, [[0, '#e8d0a0'], [1, '#7a6040']], x1 + s * 0.02, y1 + s * 0.02);
      ctx.beginPath();
      ctx.ellipse(x1, y1 + s * 0.055, s * 0.05, s * 0.06, 0, 0, TAU);
      ctx.fill();
    }
  };

  // 呼呼：风车脑袋的石头巨人——石砖砌的身体、鳞瓦小屋顶、带木格子的帆布叶片；蓄力大风时叶片转得飞快、全身发光
  D.windGiant = function (ctx, s, t, o) {
    const ai = o.ai || {};
    const warn = ai.mode === 'warn';
    const spin = t * (warn ? 14 : ai.phase === 2 ? 6 : 3);
    const step = Math.sin(t * 3 + (o.seed || 0));
    const base = '#8a98aa';
    const gc = '#bfe8ff';
    const runeA = warn ? 0.95 : ai.phase === 2 ? 0.7 : 0.5;
    shadow(ctx, 0, 2, s * 1.1);
    // 绕着身体转的风（后半圈在身体后面，前半圈在前面）
    const windRing = (front) => {
      ctx.save();
      ctx.strokeStyle = rgba('#ffffff', warn ? 0.65 : 0.3);
      ctx.lineWidth = s * 0.035;
      ctx.lineCap = 'round';
      ctx.setLineDash([s * 0.3, s * 0.22]);
      ctx.lineDashOffset = -t * s * (warn ? 4 : 1.5);
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.85, s * 0.98, s * 0.2, -0.12, front ? 0.15 : Math.PI + 0.1, front ? Math.PI - 0.1 : TAU - 0.15);
      ctx.stroke();
      ctx.restore();
    };
    windRing(false);
    // 腿：两根石柱，远侧更暗，有两道石缝
    for (const d of [-1, 1]) {
      const lx = d * s * 0.32 + (d * step * s) / 25;
      const leg = () => {
        ctx.beginPath();
        ctx.ellipse(lx, -s * 0.28, s * 0.2, s * 0.3, 0, 0, TAU);
      };
      leg();
      ctx.fillStyle = bodyGrad(ctx, lx - s * 0.2, -s * 0.58, lx + s * 0.2, s * 0.02, base, d > 0 ? 0.5 : 0.25, d > 0 ? 0.88 : 0.72);
      ctx.fill();
      ctx.save();
      leg();
      ctx.clip();
      ctx.strokeStyle = rgba('#141a28', 0.55);
      ctx.lineWidth = s * 0.025;
      ctx.beginPath();
      ctx.moveTo(lx - s * 0.25, -s * 0.38);
      ctx.quadraticCurveTo(lx, -s * 0.34, lx + s * 0.25, -s * 0.39);
      ctx.moveTo(lx - s * 0.25, -s * 0.17);
      ctx.quadraticCurveTo(lx, -s * 0.13, lx + s * 0.25, -s * 0.18);
      ctx.stroke();
      ctx.restore();
      rimEdge(ctx, leg, '#e8f4ff', d > 0 ? 0.25 : 0.45, s * 0.06, s * 0.04, s * 0.04);
    }
    // 身体：一层层错开的石砖，每块上沿一道亮边；整体像圆柱，左边暗、右边亮
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.6, -s * 0.45);
      ctx.quadraticCurveTo(-s * 0.8, -s * 1.1, -s * 0.45, -s * 1.5);
      ctx.lineTo(s * 0.45, -s * 1.5);
      ctx.quadraticCurveTo(s * 0.8, -s * 1.1, s * 0.6, -s * 0.45);
      ctx.closePath();
    };
    body();
    ctx.fillStyle = bodyGrad(ctx, -s * 0.75, -s * 1.6, s * 0.75, -s * 0.4, base, 0.2, 0.72);
    ctx.fill();
    ctx.save();
    body();
    ctx.clip();
    const rr = seeded(31);
    const bh = s * 0.16;
    for (let row = 0; row < 7; row++) {
      const y = -s * 0.45 - row * bh;
      const xs = [];
      for (let x = -s * 0.85 + (row % 2) * s * 0.17; x < s * 0.85; x += s * 0.34) xs.push(x);
      for (const x of xs) {
        const v = rr();
        ctx.fillStyle = v > 0.5 ? rgba('#ffffff', (v - 0.5) * 0.18) : rgba('#08101e', (0.5 - v) * 0.3);
        ctx.fillRect(x, y - bh, s * 0.34, bh);
      }
      ctx.strokeStyle = rgba('#141a28', 0.55);
      ctx.lineWidth = s * 0.025;
      ctx.beginPath();
      ctx.moveTo(-s, y);
      ctx.lineTo(s, y);
      for (const x of xs) {
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - bh);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(235,244,255,0.2)';
      ctx.lineWidth = s * 0.018;
      ctx.beginPath();
      ctx.moveTo(-s, y - bh + s * 0.025);
      ctx.lineTo(s, y - bh + s * 0.025);
      ctx.stroke();
    }
    ctx.fillStyle = linear(ctx, -s * 0.75, 0, s * 0.75, 0, [[0, 'rgba(8,12,28,0.5)'], [0.45, 'rgba(8,12,28,0)'], [0.8, 'rgba(255,255,255,0.1)'], [1, 'rgba(8,12,28,0.12)']]);
    ctx.fillRect(-s, -s * 1.6, s * 2, s * 1.2);
    // 石缝里透出的风之光
    veins(ctx, -s * 0.55, -s * 0.62, s * 0.28, -0.8, 2, gc, runeA * 0.75, 41, s * 0.03);
    veins(ctx, s * 0.55, -s * 1.28, s * 0.24, 2.4, 1, gc, runeA * 0.7, 43, s * 0.03);
    ctx.restore();
    rimEdge(ctx, body, '#eef6ff', 0.55, s * 0.07, s * 0.045, s * 0.045);
    // 小拱门：木板门，门缝里透出暖暖的光（打败后它会搬进小镇）
    const door = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.13, -s * 0.45);
      ctx.lineTo(-s * 0.13, -s * 0.6);
      ctx.arc(0, -s * 0.6, s * 0.13, Math.PI, 0);
      ctx.lineTo(s * 0.13, -s * 0.45);
      ctx.closePath();
    };
    door();
    ctx.fillStyle = linear(ctx, s * 0.13, -s * 0.73, -s * 0.13, -s * 0.45, [[0, '#6a4630'], [1, '#2a180e']]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,10,6,0.6)';
    ctx.lineWidth = s * 0.015;
    ctx.beginPath();
    ctx.moveTo(-s * 0.045, -s * 0.45);
    ctx.lineTo(-s * 0.045, -s * 0.71);
    ctx.moveTo(s * 0.045, -s * 0.45);
    ctx.lineTo(s * 0.045, -s * 0.71);
    ctx.stroke();
    door();
    ctx.strokeStyle = rgba('#c8d4e4', 0.7);
    ctx.lineWidth = s * 0.035;
    ctx.stroke();
    rune(ctx, [[-s * 0.11, -s * 0.465], [s * 0.11, -s * 0.465]], '#ffd27a', s * 0.025, 0.8);
    dot(ctx, s * 0.07, -s * 0.56, s * 0.018, '#ffd27a', 0.9);
    // V 形的发光纹路 + 刻在石头里的眼窝和发光的眼睛
    rune(ctx, [[-s * 0.3, -s * 1.2], [0, -s * 0.9], [s * 0.3, -s * 1.2]], gc, 1.6, runeA);
    ctx.fillStyle = 'rgba(10,16,30,0.55)';
    ctx.beginPath();
    for (const ex of [-0.28, 0.04]) {
      ctx.moveTo(s * ex + s * 0.11, -s * 1.15);
      ctx.ellipse(s * ex, -s * 1.15, s * 0.11, s * 0.065, 0, 0, TAU);
    }
    ctx.fill();
    eyes(ctx, -s * 0.12, -s * 1.15, s * 0.32, s * 0.07, warn ? '#ffffff' : gc, 0);
    // 鳞瓦小屋顶
    const roof = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.56, -s * 1.44);
      ctx.quadraticCurveTo(-s * 0.5, -s * 1.86, 0, -s * 1.9);
      ctx.quadraticCurveTo(s * 0.5, -s * 1.86, s * 0.56, -s * 1.44);
      ctx.closePath();
    };
    roof();
    ctx.fillStyle = bodyGrad(ctx, -s * 0.56, -s * 1.9, s * 0.56, -s * 1.44, '#7a8cb8', 0.1, 0.65);
    ctx.fill();
    ctx.save();
    roof();
    ctx.clip();
    scales(ctx, -s * 0.6, -s * 1.95, s * 0.6, -s * 1.42, s * 0.14, '#141c30', 0.55);
    ctx.translate(0, -s * 0.03);
    scales(ctx, -s * 0.6, -s * 1.95, s * 0.6, -s * 1.42, s * 0.14, '#e8f0ff', 0.2);
    ctx.restore();
    ctx.strokeStyle = 'rgba(16,22,40,0.7)';
    ctx.lineWidth = s * 0.03;
    ctx.beginPath();
    ctx.moveTo(-s * 0.56, -s * 1.44);
    ctx.lineTo(s * 0.56, -s * 1.44);
    ctx.stroke();
    rimEdge(ctx, roof, '#ffffff', 0.5, s * 0.06, s * 0.04, s * 0.04);
    windRing(true);
    // 脚边缠着的小云朵，慢慢飘
    const fc = [[-0.62, -0.06, 0.13], [-0.46, -0.02, 0.1], [0.52, -0.05, 0.12], [0.68, -0.03, 0.09]].map(([x, y, r], i) => [s * x + Math.sin(t * 1.5 + i) * s * 0.03, s * y, s * r]);
    cloudMass(ctx, fc, '#ffffff', '#e4e8f8', '#a8b0d8', '#6a70a8', 0.45, '#ffffff', 0.4);
    // 风车脑袋：四片带木格子的帆布叶片，转起来有残影
    ctx.save();
    ctx.translate(0, -s * 1.65);
    if (warn) glow(ctx, 0, 0, s * 1.2, gc, 0.5);
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate(spin + ((i + 1) * Math.PI) / 2);
      ctx.strokeStyle = rgba('#ffffff', warn ? 0.35 : 0.12);
      ctx.lineWidth = s * 0.14;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.8, -0.6, -0.1);
      ctx.stroke();
      const sail = () => {
        ctx.beginPath();
        ctx.moveTo(s * 0.18, 0);
        ctx.lineTo(s * 0.22, -s * 0.16);
        ctx.lineTo(s * 0.95, -s * 0.23);
        ctx.lineTo(s * 0.95, s * 0.02);
        ctx.closePath();
      };
      sail();
      ctx.fillStyle = linear(ctx, 0, 0, s * 0.95, 0, [[0, i % 2 ? 'rgba(255,240,220,0.95)' : 'rgba(255,170,200,0.95)'], [1, i % 2 ? 'rgba(255,250,240,0.55)' : 'rgba(255,215,230,0.55)']]);
      ctx.fill();
      ctx.save();
      sail();
      ctx.clip();
      // 帆布的明暗：靠杆子一侧深一点
      ctx.fillStyle = linear(ctx, 0, -s * 0.23, 0, s * 0.02, [[0, 'rgba(255,255,255,0.2)'], [1, 'rgba(60,20,40,0.25)']]);
      ctx.fillRect(0, -s * 0.25, s, s * 0.3);
      ctx.strokeStyle = 'rgba(90,58,44,0.6)';
      ctx.lineWidth = s * 0.022;
      ctx.beginPath();
      for (const x of [0.36, 0.52, 0.68, 0.84]) {
        ctx.moveTo(s * x, -s * 0.25);
        ctx.lineTo(s * x, s * 0.03);
      }
      ctx.moveTo(s * 0.2, -s * 0.08);
      ctx.lineTo(s * 0.95, -s * 0.1);
      ctx.stroke();
      ctx.restore();
      // 木杆
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#5a3a2a';
      ctx.lineWidth = s * 0.06;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.01);
      ctx.lineTo(s * 0.98, s * 0.03);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,214,170,0.5)';
      ctx.lineWidth = s * 0.018;
      ctx.beginPath();
      ctx.moveTo(s * 0.15, -s * 0.005);
      ctx.lineTo(s * 0.97, s * 0.015);
      ctx.stroke();
      dot(ctx, s * 0.95, -s * 0.1, warn ? s * 0.05 : s * 0.03, warn ? '#ffffff' : '#ffe6f0', warn ? 0.95 : 0.6);
      ctx.restore();
    }
    // 轮毂：金色，四颗铆钉
    ctx.fillStyle = radial(ctx, 0, 0, 0, s * 0.16, [[0, '#fff0b0'], [0.5, '#e0a840'], [1, '#7a5018']], s * 0.05, -s * 0.05);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.15, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(70,40,10,0.8)';
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = spin + k * (Math.PI / 2) + Math.PI / 4;
      ctx.moveTo(Math.cos(a) * s * 0.09 + s * 0.022, Math.sin(a) * s * 0.09);
      ctx.arc(Math.cos(a) * s * 0.09, Math.sin(a) * s * 0.09, s * 0.022, 0, TAU);
    }
    ctx.fill();
    ctx.restore();
    glow(ctx, 0, -s * 1.65, s * 0.25, '#ffd27a', 0.75, true);
    sparkles(ctx, 0, -s * 1.0, s * 1.05, s * 0.7, warn ? 7 : 4, t * (warn ? 3 : 1.5), '#e8f6ff', 61, 1.3);
  };

  // 雷雷：一大团翻滚的雷云，歪戴一顶小金冠；云里窜着电光，下面下着小雨；生气时更暗、闪电更多
  D.thunderKing = function (ctx, s, t, o) {
    const ai = o.ai || {};
    const angry = ai.phase >= 2;
    const warn = ai.mode === 'warn';
    const bolt = '#fff3a0';
    const fr = Math.floor(t * 8);
    ctx.save();
    ctx.globalAlpha = 0.5;
    shadow(ctx, 0, 6, s * 1.4);
    ctx.restore();
    ctx.translate(0, -s * 1.3 + Math.sin(t * 2) * 4);
    // 小雨：从云底斜斜落下（生气时更密）
    const rr = seeded(71);
    const nr = angry ? 16 : 9;
    ctx.save();
    ctx.lineWidth = s * 0.025;
    ctx.lineCap = 'round';
    for (let i = 0; i < nr; i++) {
      const x = -s * 0.95 + ((i + rr() * 0.6) / nr) * s * 1.9;
      const f = (t * 1.4 + rr()) % 1;
      const y = s * 0.45 + f * s * 0.8;
      ctx.strokeStyle = rgba('#c8dcff', 0.55 * (1 - f));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - s * 0.04, y + s * 0.13);
      ctx.stroke();
    }
    ctx.restore();
    // 云团下面的闪电：外面一层光晕、中间亮、芯是白的，还带小分叉
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const n = warn ? 5 : 2;
    for (let i = 0; i < n; i++) {
      const bx = -s + ((i * 0.53 + fr * 0.37) % 1) * s * 2;
      const pts = [[bx, s * 0.4], [bx - s * 0.16, s * 0.8], [bx + s * 0.08, s * 0.85], [bx - s * 0.12, s * 1.25]];
      for (const [w, c] of [[s * 0.14, rgba(bolt, 0.2)], [s * 0.06, rgba(bolt, 0.6)], [s * 0.025, 'rgba(255,255,240,0.95)']]) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.beginPath();
        pts.forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        ctx.stroke();
      }
      veins(ctx, bx - s * 0.16, s * 0.8, s * 0.18, 2.3, 1, bolt, 0.7, fr * 7 + i, s * 0.03);
      glow(ctx, bx, s * 0.45, s * 0.3, bolt, 0.5);
    }
    ctx.restore();
    // 云团：后面一层更暗的小云 + 前面五大团；每团上亮下暗，边上一道银边
    const back = [[-0.95, 0.15, 0.36], [-0.5, -0.55, 0.42], [0.22, -0.72, 0.36], [0.9, -0.3, 0.36], [1.05, 0.28, 0.3]].map(([x, y, r]) => [s * x, s * y, s * r]);
    const main = [[-0.2, -0.35, 0.7], [0.45, -0.25, 0.62], [-0.7, 0.05, 0.55], [0.85, 0.12, 0.45], [0, 0.2, 0.65]].map(([x, y, r]) => [s * x, s * y, s * r]);
    const all = back.concat(main);
    // 外面一圈半透明的水汽
    ctx.fillStyle = angry ? 'rgba(120,120,160,0.16)' : 'rgba(200,210,235,0.18)';
    ctx.beginPath();
    for (const [x, y, r] of all) {
      ctx.moveTo(x + r * 1.1, y);
      ctx.arc(x, y, r * 1.1, 0, TAU);
    }
    ctx.fill();
    const rim = angry ? '#ffe9a0' : '#fff8e8';
    if (angry) {
      cloudMass(ctx, back, '#6a6a86', '#2a2a3c', '#0c0c14', '#05050a', 0.5, rim, 0.35);
      cloudMass(ctx, main, '#9a9ab8', '#3e3e56', '#14141e', '#05050a', 0.55, rim, 0.55);
    } else {
      cloudMass(ctx, back, '#a8b2c8', '#525c78', '#1e2232', '#101420', 0.5, rim, 0.35);
      cloudMass(ctx, main, '#d4dcee', '#76809c', '#2a2e40', '#101420', 0.5, rim, 0.55);
    }
    ctx.save();
    puffPath(ctx, all);
    ctx.clip();
    // 云卷的纹理：下半圈暗、上半圈亮
    curls(ctx, 0, -s * 0.15, s * 1.15, s * 0.75, 30, angry ? '#05050a' : '#141826', 0.3, 5, s * 0.1, s * 0.03, 0.15 * Math.PI);
    curls(ctx, 0, -s * 0.15, s * 1.15, s * 0.75, 30, '#ffffff', angry ? 0.12 : 0.22, 5, s * 0.1, s * 0.025, 1.15 * Math.PI);
    // 云里窜动的电光（一闪一闪）
    const va = (warn ? 0.95 : angry ? 0.7 : 0.45) * (0.6 + 0.4 * Math.abs(Math.sin(t * 9)));
    veins(ctx, -s * 1.0, s * 0.05, s * 0.4, -0.5, 2, bolt, va, 11 + (fr % 3), s * 0.035);
    veins(ctx, s * 1.0, s * 0.2, s * 0.38, -2.6, 2, bolt, va, 17 + (fr % 4), s * 0.035);
    if (angry || warn) veins(ctx, -s * 0.2, -s * 0.9, s * 0.35, 0.35, 2, bolt, va, 23 + (fr % 2), s * 0.035);
    ctx.restore();
    // 体内的电光
    glow(ctx, 0, 0, s * 0.9, bolt, warn ? 0.65 : 0.25);
    // 小金冠：歪戴在头顶，金属的亮边 + 一颗会发光的宝石
    ctx.save();
    ctx.translate(-s * 0.12, -s * 0.99);
    ctx.rotate(-0.18 + Math.sin(t * 2 + 1) * 0.05);
    const cw = s * 0.22;
    const ch = s * 0.24;
    const crown = () => {
      ctx.beginPath();
      ctx.moveTo(-cw, 0);
      ctx.lineTo(-cw * 1.1, -ch);
      ctx.lineTo(-cw * 0.45, -ch * 0.55);
      ctx.lineTo(0, -ch * 1.2);
      ctx.lineTo(cw * 0.45, -ch * 0.55);
      ctx.lineTo(cw * 1.1, -ch);
      ctx.lineTo(cw, 0);
      ctx.closePath();
    };
    crown();
    ctx.fillStyle = linear(ctx, cw, -ch, -cw, 0, [[0, '#fff4c0'], [0.35, '#f0c040'], [0.7, '#a87018'], [1, '#6a4410']]);
    ctx.fill();
    ctx.save();
    crown();
    ctx.clip();
    ctx.fillStyle = linear(ctx, 0, -ch * 0.3, 0, 0, [[0, 'rgba(255,250,220,0.55)'], [1, 'rgba(110,60,10,0.4)']]);
    ctx.fillRect(-cw * 1.2, -ch * 0.3, cw * 2.4, ch * 0.3);
    ctx.restore();
    rimEdge(ctx, crown, '#ffffff', 0.75, s * 0.035, s * 0.02, s * 0.02);
    for (const [px, py] of [[-cw * 1.1, -ch], [0, -ch * 1.2], [cw * 1.1, -ch]]) dot(ctx, px, py, s * 0.025, '#ffe680', 0.9);
    dot(ctx, 0, -ch * 0.16, s * 0.04, '#8ad8ff', 0.95);
    ctx.restore();
    // 眼窝：深一点，发光的眼睛才看得清
    ctx.fillStyle = rgba('#0a0a18', angry ? 0.55 : 0.4);
    ctx.beginPath();
    for (const ex of [-0.275, 0.175]) {
      ctx.moveTo(s * ex + s * 0.17, -s * 0.01);
      ctx.ellipse(s * ex, -s * 0.01, s * 0.17, s * 0.1, 0, 0, TAU);
    }
    ctx.fill();
    // 生气的眉毛、发光的眼睛和噘着的嘴
    ctx.strokeStyle = '#0a0a14';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, -s * 0.3);
    ctx.quadraticCurveTo(-s * 0.3, -s * 0.28, -s * 0.12, -s * 0.15);
    ctx.moveTo(s * 0.4, -s * 0.3);
    ctx.quadraticCurveTo(s * 0.2, -s * 0.28, s * 0.02, -s * 0.15);
    ctx.stroke();
    eyes(ctx, -s * 0.05, -s * 0.02, s * 0.45, s * 0.1, bolt, 0);
    ctx.strokeStyle = 'rgba(10,10,20,0.6)';
    ctx.lineWidth = s * 0.045;
    ctx.beginPath();
    ctx.arc(-s * 0.05, s * 0.3, s * 0.09, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    sparkles(ctx, 0, -s * 0.2, s * 1.3, s * 0.85, warn ? 8 : 5, t * 1.5, bolt, 81, 1.6);
  };
})((globalThis.TD = globalThis.TD || {}));
