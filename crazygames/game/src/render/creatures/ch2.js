// 第二章 · 黄金沙漠（设计书 56.4、60.3）的怪物画法：工具函数（发光、眼睛、符文、细节笔触……）在 creatures.js
(function (TD) {
  'use strict';

  const K = TD.creatures;
  const D = K.drawers;
  const TAU = Math.PI * 2;
  const { deep, light, rgba, bodyGrad, glow, shadow, eyes, rune, dot, wing, jelly, jellyEyes, quadruped, seeded, strokes, speckle, scales, veins, sparkles, rimEdge, linear, radial } = K;

  // ---------- 本章的小工具 ----------
  // 球面明暗：亮点偏右上（光从右上来），往左下渐暗
  function lit(ctx, x, y, r, base, hi, mid, lo) {
    return radial(ctx, x, y, 0, r * 1.25, [[0, deep(base, hi)], [0.55, deep(base, mid)], [1, deep(base, lo)]], x + r * 0.35, y - r * 0.45);
  }
  // 轮廓光：偏移和线宽随体型缩放
  function rim(ctx, s, path, color, a) {
    rimEdge(ctx, path, color || '#ffe6b0', a === undefined ? 0.55 : a, Math.max(1, s * 0.05), s * 0.03, s * 0.03);
  }
  // 省事的轮廓光：只描椭圆右上的一段弧（不用 clip），给一节节数量多的甲片、尾节用
  function arcRim(ctx, x, y, rx, ry, rot, color, a, w) {
    const c = -Math.PI / 4 - rot;
    ctx.strokeStyle = rgba(color, a);
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.5, rx - w * 0.6), Math.max(0.5, ry - w * 0.6), rot, c - 1.1, c + 1.1);
    ctx.stroke();
  }
  // 二次曲线上从 u0 到 u1 取 n 段的点（沿曲线画发光纹）
  function qpts(x0, y0, cx, cy, x1, y1, u0, u1, n) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const u = u0 + ((u1 - u0) * i) / n;
      const v = 1 - u;
      pts.push([v * v * x0 + 2 * v * u * cx + u * u * x1, v * v * y0 + 2 * v * u * cy + u * u * y1]);
    }
    return pts;
  }
  // 金属金：右上亮、左下深
  function goldGrad(ctx, x0, y0, x1, y1) {
    return linear(ctx, x1, y0, x0, y1, [[0, '#fff4c0'], [0.35, '#ffd862'], [0.7, '#c08a2a'], [1, '#6a4410']]);
  }

  // ======================================================================
  // 第二章 · 黄金沙漠（设计书 56.4、60.3）
  // ======================================================================

  // 蝎子：低伏的分节甲壳、往上卷的尾巴、发光的毒囊
  // 细节：甲片从后往前一片压一片（前片投影、后缘横纹、细沙粒、轮廓光），两节细腿，
  // 尾节里毒液的光一节节往上流，钳掌鼓鼓的、钳指有亮边
  function scorpionBody(ctx, s, t, o, base, glowCol, big) {
    const ph = t * (big ? 6 : 12) + (o.seed || 0);
    const by = -s * 0.32;
    const hiCol = '#ffe2b0';
    ctx.lineCap = 'round';
    // 腿：每侧 3 条两节细腿，交替摆动；近侧的腿有一道高光
    for (const far of [true, false]) {
      for (let i = 0; i < 3; i++) {
        const lx = -s * 0.3 + i * s * 0.32;
        const sw = Math.sin(ph + i * 2 + (far ? Math.PI : 0)) * s * 0.08;
        const kx = lx + sw - s * 0.08;
        const ky = by - s * 0.2;
        const fx = lx + sw - s * 0.18;
        ctx.strokeStyle = deep(base, far ? 0.85 : 0.62);
        ctx.lineWidth = s * 0.065;
        ctx.beginPath();
        ctx.moveTo(lx, by);
        ctx.lineTo(kx, ky);
        ctx.stroke();
        ctx.lineWidth = s * 0.045;
        ctx.beginPath();
        ctx.moveTo(kx, ky);
        ctx.lineTo(fx, -s * 0.02);
        ctx.stroke();
        if (!far) {
          ctx.strokeStyle = rgba(hiCol, 0.35);
          ctx.lineWidth = s * 0.016;
          ctx.beginPath();
          ctx.moveTo(kx + s * 0.012, ky - s * 0.01);
          ctx.lineTo(fx + s * 0.018, -s * 0.05);
          ctx.stroke();
        }
      }
    }
    // 分节的甲壳：从后往前画，前一节压住后一节
    const plates = [];
    for (let i = 0; i < 4; i++) plates.push([-s * 0.35 + i * s * 0.28, by - s * 0.05, s * 0.26 - i * s * 0.02, s * 0.2]);
    for (let i = 3; i >= 0; i--) {
      const [px, py, rx, ry] = plates[i];
      // 这一节投在后一节上的影子（露出来的那一窄条正好落在后一节里面，不用 clip）
      if (i < 3) {
        ctx.fillStyle = 'rgba(10,6,16,0.4)';
        ctx.beginPath();
        ctx.ellipse(px + s * 0.05, py + s * 0.01, rx, ry, 0, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = lit(ctx, px, py, rx, base, 0.1, 0.42, 0.82);
      ctx.beginPath();
      ctx.ellipse(px, py, rx, ry, 0, 0, TAU);
      ctx.fill();
      // 甲片后缘的横纹：一道暗、一道亮（两头收在甲片里面，不用 clip）
      ctx.lineWidth = s * 0.025;
      ctx.strokeStyle = 'rgba(10,8,20,0.3)';
      ctx.beginPath();
      ctx.moveTo(px + rx * 0.3, py - ry * 0.9);
      ctx.quadraticCurveTo(px + rx * 0.62, py, px + rx * 0.3, py + ry * 0.9);
      ctx.stroke();
      ctx.strokeStyle = rgba(hiCol, 0.3);
      ctx.beginPath();
      ctx.moveTo(px + rx * 0.45, py - ry * 0.82);
      ctx.quadraticCurveTo(px + rx * 0.78, py, px + rx * 0.45, py + ry * 0.82);
      ctx.stroke();
      // 细沙粒一样的小斑
      speckle(ctx, px - rx * 0.1, py + ry * 0.1, rx * 0.7, ry * 0.6, big ? 6 : 4, '#1a0e08', 0.35, i * 7 + (big ? 3 : 1), s * 0.012, s * 0.028);
      // 甲片上的高光
      ctx.fillStyle = 'rgba(255,240,210,0.3)';
      ctx.beginPath();
      ctx.ellipse(px + rx * 0.22, py - ry * 0.58, rx * 0.38, ry * 0.15, -0.12, 0, TAU);
      ctx.fill();
      arcRim(ctx, px, py, rx, ry, 0, hiCol, 0.5, Math.max(1, s * 0.035));
    }
    // 背脊上一排发光的小斑，像一串灯一节节亮过去（大蝎子换成王的菱纹）
    if (!big) {
      plates.forEach(([px, py, rx, ry], i) => dot(ctx, px + rx * 0.3, py - ry * 0.5, s * 0.03, glowCol, 0.3 + 0.6 * Math.max(0, Math.sin(t * 4 - i * 0.9))));
    }
    // 尾巴：一节节往上卷到头顶前方；每节右上受光，毒液的光一节节往上流
    const curl = Math.sin(ph * 0.4) * 0.15 + (o.attack ? 0.3 : 0);
    let tx = s * 0.55;
    let ty = by - s * 0.05;
    let ang = -0.4;
    for (let i = 0; i < 6; i++) {
      ang -= 0.42 + curl * 0.15;
      tx += Math.cos(ang) * s * 0.2;
      ty += Math.sin(ang) * s * 0.2;
      const r = s * (0.13 - i * 0.012);
      ctx.fillStyle = lit(ctx, tx, ty, r, base, 0.12, 0.45 + i * 0.03, 0.85);
      ctx.beginPath();
      ctx.ellipse(tx, ty, r * 1.2, r, ang, 0, TAU);
      ctx.fill();
      arcRim(ctx, tx, ty, r * 1.2, r, ang, hiCol, 0.45, Math.max(1, s * 0.035));
      const flow = Math.max(0, Math.sin(t * 5 - i * 0.8));
      if (flow > 0.05) dot(ctx, tx, ty, r * 0.25, glowCol, 0.75 * flow);
    }
    // 毒囊：半透明的囊里有光在晃；毒针尖挂着一滴会鼓起来的光
    const pulse = 0.7 + Math.sin(t * 5) * 0.2;
    glow(ctx, tx - s * 0.08, ty + s * 0.05, s * 0.45, glowCol, pulse, true);
    ctx.fillStyle = radial(ctx, tx, ty + s * 0.02, 0, s * 0.12, [[0, light(glowCol, 0.65)], [0.55, rgba(glowCol, 0.9)], [1, deep(glowCol, 0.45)]], tx + s * 0.03, ty - s * 0.02);
    ctx.beginPath();
    ctx.ellipse(tx, ty + s * 0.02, s * 0.11, s * 0.085, ang + 0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = linear(ctx, tx, ty, tx - s * 0.2, ty + s * 0.18, [[0, deep(glowCol, 0.35)], [1, light(glowCol, 0.5)]]);
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx - s * 0.18, ty + s * 0.02, tx - s * 0.2, ty + s * 0.18);
    ctx.quadraticCurveTo(tx - s * 0.05, ty + s * 0.12, tx + s * 0.05, ty + s * 0.06);
    ctx.fill();
    dot(ctx, tx - s * 0.2, ty + s * 0.2, s * (0.022 + 0.01 * Math.sin(t * 3)), glowCol, 0.9);
    // 一对钳子：上臂 + 鼓鼓的钳掌 + 两根钳指；远侧整体压暗
    const snap = o.attack ? Math.abs(Math.sin(t * 6)) * 0.4 : 0.12;
    for (const far of [true, false]) {
      const dk = far ? 0.3 : 0;
      ctx.save();
      ctx.translate(-s * 0.55, by + (far ? -s * 0.08 : s * 0.02));
      ctx.fillStyle = lit(ctx, -s * 0.08, 0, s * 0.11, base, 0.3 + dk * 0.5, 0.55 + dk * 0.3, 0.85);
      ctx.beginPath();
      ctx.ellipse(-s * 0.08, 0, s * 0.11, s * 0.065, 0.15, 0, TAU);
      ctx.fill();
      const palm = () => {
        ctx.beginPath();
        ctx.ellipse(-s * 0.27, -s * 0.01, s * 0.15, s * 0.1, 0.05, 0, TAU);
      };
      ctx.fillStyle = lit(ctx, -s * 0.27, -s * 0.01, s * 0.15, base, 0.1 + dk, 0.42 + dk * 0.4, 0.85);
      palm();
      ctx.fill();
      if (!far) {
        rim(ctx, s, palm, hiCol, 0.5);
        rune(ctx, [[-s * 0.36, -s * 0.05], [-s * 0.27, -s * 0.07], [-s * 0.18, -s * 0.04]], glowCol, s * 0.025, 0.5);
      }
      // 大蝎子的钳腕上套一圈金箍
      if (big) {
        ctx.strokeStyle = goldGrad(ctx, -s * 0.18, -s * 0.1, -s * 0.12, s * 0.1);
        ctx.lineWidth = s * 0.03;
        ctx.beginPath();
        ctx.ellipse(-s * 0.15, -s * 0.005, s * 0.02, s * 0.08, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.translate(-s * 0.38, 0);
      const fingerCol = lit(ctx, -s * 0.15, 0, s * 0.18, base, 0.15 + dk, 0.45 + dk * 0.4, 0.85);
      ctx.rotate(-snap);
      ctx.fillStyle = fingerCol;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-s * 0.28, -s * 0.12, -s * 0.34, s * 0.02);
      ctx.quadraticCurveTo(-s * 0.18, -s * 0.02, 0, s * 0.06);
      ctx.fill();
      if (!far) {
        ctx.strokeStyle = rgba(hiCol, 0.45);
        ctx.lineWidth = s * 0.02;
        ctx.beginPath();
        ctx.moveTo(-s * 0.02, -s * 0.02);
        ctx.quadraticCurveTo(-s * 0.22, -s * 0.1, -s * 0.31, -s * 0.02);
        ctx.stroke();
      }
      ctx.rotate(snap * 2);
      ctx.fillStyle = fingerCol;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.02);
      ctx.quadraticCurveTo(-s * 0.24, s * 0.14, -s * 0.3, s * 0.06);
      ctx.quadraticCurveTo(-s * 0.15, s * 0.06, 0, s * 0.06);
      ctx.fill();
      ctx.restore();
    }
    eyes(ctx, -s * 0.5, by - s * 0.15, s * 0.1, s * 0.04, glowCol, -0.1);
    return { by, plates };
  }
  D.scorpion = function (ctx, s, t, o) {
    shadow(ctx, 0, 2, s);
    scorpionBody(ctx, s, t, o, '#c88a4a', '#ffc04a');
  };

  // 钳钳（小 Boss）：大一号的蝎子 + 金尖背刺、一串连起来的发光菱纹、金属小王冠和宝石、钳腕金箍、绕身的金沙光点
  D.kingScorpion = function (ctx, s, t, o) {
    const ai = o.ai || {};
    const gold = '#ffd27a';
    shadow(ctx, 0, 2, s * 1.2);
    const { by, plates } = scorpionBody(ctx, s, t, Object.assign({}, o, { attack: o.attack || ai.mode === 'claw' }), '#c86a2a', '#ffb040', true);
    // 背刺：后三节各一根，尖上是金色
    for (let i = 3; i >= 1; i--) {
      const [px, py, rx, ry] = plates[i];
      const bx = px + rx * 0.05;
      const bt = py - ry * 0.9;
      ctx.fillStyle = linear(ctx, bx, bt - s * 0.15, bx, bt + s * 0.03, [[0, '#fff0b0'], [0.45, '#e09a3a'], [1, deep('#c86a2a', 0.55)]]);
      ctx.beginPath();
      ctx.moveTo(bx - s * 0.05, bt + s * 0.03);
      ctx.quadraticCurveTo(bx - s * 0.01, bt - s * 0.06, bx + s * 0.05, bt - s * 0.15);
      ctx.quadraticCurveTo(bx + s * 0.03, bt - s * 0.04, bx + s * 0.06, bt + s * 0.03);
      ctx.closePath();
      ctx.fill();
    }
    // 背上一串发光的菱纹，用一道光线连起来，光一节节往后走
    const ridge = plates.map(([px, py, rx, ry]) => [px + rx * 0.1, py - ry * 0.4]);
    rune(ctx, ridge, gold, s * 0.025, 0.5);
    ridge.forEach(([cx, cy], i) => {
      const d = s * 0.055;
      const a = 0.45 + 0.45 * Math.max(0, Math.sin(t * 3 - i * 0.9));
      rune(ctx, [[cx - d, cy], [cx, cy - d * 0.75], [cx + d, cy], [cx, cy + d * 0.75], [cx - d, cy]], gold, s * 0.028, a);
      if (a > 0.7) glow(ctx, cx, cy, s * 0.14, gold, (a - 0.7) * 1.5);
    });
    // 头冠：金属质感的三尖小王冠，尖上挂小金球，冠箍正中一颗会发光的宝石
    glow(ctx, -s * 0.45, by - s * 0.32, s * 0.3, gold, 0.6);
    const crown = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.6, by - s * 0.22);
      ctx.lineTo(-s * 0.55, by - s * 0.42);
      ctx.lineTo(-s * 0.47, by - s * 0.3);
      ctx.lineTo(-s * 0.4, by - s * 0.46);
      ctx.lineTo(-s * 0.33, by - s * 0.24);
      ctx.closePath();
    };
    ctx.fillStyle = goldGrad(ctx, -s * 0.6, by - s * 0.46, -s * 0.33, by - s * 0.22);
    crown();
    ctx.fill();
    rim(ctx, s, crown, '#fff8d8', 0.7);
    // 冠箍
    ctx.fillStyle = linear(ctx, 0, by - s * 0.3, 0, by - s * 0.21, [[0, '#ffe8a0'], [1, '#9a6418']]);
    ctx.beginPath();
    ctx.moveTo(-s * 0.61, by - s * 0.21);
    ctx.lineTo(-s * 0.595, by - s * 0.29);
    ctx.quadraticCurveTo(-s * 0.465, by - s * 0.31, -s * 0.335, by - s * 0.3);
    ctx.lineTo(-s * 0.32, by - s * 0.22);
    ctx.quadraticCurveTo(-s * 0.465, by - s * 0.2, -s * 0.61, by - s * 0.21);
    ctx.fill();
    dot(ctx, -s * 0.55, by - s * 0.43, s * 0.025, '#fff0b0', 0.9);
    dot(ctx, -s * 0.4, by - s * 0.47, s * 0.025, '#fff0b0', 0.9);
    const gemA = 0.75 + Math.sin(t * 3) * 0.2;
    glow(ctx, -s * 0.465, by - s * 0.255, s * 0.12, '#ff7a5a', gemA);
    ctx.fillStyle = radial(ctx, -s * 0.465, by - s * 0.255, 0, s * 0.035, [[0, '#ffe0d0'], [0.5, '#ff6a4a'], [1, '#8a1a20']], -s * 0.455, by - s * 0.265);
    ctx.beginPath();
    ctx.ellipse(-s * 0.465, by - s * 0.255, s * 0.03, s * 0.035, 0, 0, TAU);
    ctx.fill();
    // 绕着身子飘的金沙光点
    sparkles(ctx, -s * 0.05, by - s * 0.3, s * 0.75, s * 0.3, 5, t, gold, 21, s * 0.025);
  };

  // 绷带球：缠满绷带的圆滚滚的灵
  // 细节：绷带顺着球面往下弯、一圈一圈（上缘亮、下缘投影、细布纹），两条斜着交叉缠过去；
  // 绷带缝里透出一段段亮起的青光；身后飘着撕成毛边的松绷带，头顶翘着一截会晃的绷带头
  D.mummy = function (ctx, s, t, o) {
    const roll = Math.sin(t * 4 + (o.seed || 0)) * 0.08;
    shadow(ctx, 0, 2, s * 0.9);
    const base = '#d8c090';
    const cloth = '#efe2c0';
    const glowCol = '#7affd8';
    const cy = -s * 0.9;
    const R = s * 0.85;
    const RY = s * 0.82;
    // 身后飘的绷带：有宽度、越往后越透明，末端撕成毛边
    for (let i = 0; i < 3; i++) {
      const w2 = Math.sin(t * 4 + i * 1.7) * s * 0.12;
      const x0 = s * 0.6;
      const y0 = cy - s * 0.2 + i * s * 0.25;
      const x1 = s * 1.0;
      const y1 = cy - s * 0.1 + i * s * 0.25 + w2;
      const x2 = s * 1.35;
      const y2 = cy + i * s * 0.3 - w2;
      const hw = s * (0.06 - i * 0.008);
      ctx.fillStyle = linear(ctx, x0, 0, x2, 0, [[0, rgba(cloth, 0.75 - i * 0.12)], [1, rgba(cloth, 0.15)]]);
      ctx.beginPath();
      ctx.moveTo(x0, y0 - hw);
      ctx.quadraticCurveTo(x1, y1 - hw, x2, y2 - hw);
      ctx.lineTo(x2 + s * 0.06, y2 - hw * 0.4);
      ctx.lineTo(x2 + s * 0.01, y2);
      ctx.lineTo(x2 + s * 0.07, y2 + hw * 0.5);
      ctx.lineTo(x2, y2 + hw);
      ctx.quadraticCurveTo(x1, y1 + hw, x0, y0 + hw);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba('#5a4628', 0.3 - i * 0.07);
      ctx.lineWidth = s * 0.015;
      ctx.beginPath();
      ctx.moveTo(x0, y0 + hw * 0.35);
      ctx.quadraticCurveTo(x1, y1 + hw * 0.35, x2, y2 + hw * 0.35);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(0, cy);
    ctx.rotate(roll);
    const ball = () => {
      ctx.beginPath();
      ctx.ellipse(0, 0, R, RY, 0, 0, TAU);
    };
    // 里层：深色（绷带缝里看到的就是它）
    ctx.fillStyle = lit(ctx, 0, 0, R, base, 0.45, 0.65, 0.88);
    ball();
    ctx.fill();
    ctx.save();
    ball();
    ctx.clip();
    glow(ctx, -R * 0.1, RY * 0.05, R * 1.05, glowCol, 0.32 + Math.sin(t * 3) * 0.1);
    // 一圈圈绷带：顺着球面往下弯
    const bandFill = radial(ctx, 0, 0, 0, R * 1.25, [[0, light(cloth, 0.35)], [0.5, deep(cloth, 0.2)], [1, deep(base, 0.66)]], R * 0.35, -RY * 0.45);
    const bw = s * 0.15;
    const tilt = s * 0.28;
    const bulge = s * 0.16;
    const wrap = (y, dy) => {
      ctx.beginPath();
      ctx.moveTo(-R * 1.1, y - tilt + dy);
      ctx.quadraticCurveTo(0, y + bulge + dy, R * 1.1, y + tilt + dy);
    };
    for (let i = -5; i <= 5; i++) {
      const y = i * s * 0.2 - s * 0.05;
      ctx.strokeStyle = bandFill;
      ctx.lineWidth = bw;
      wrap(y, 0);
      ctx.stroke();
      ctx.lineWidth = s * 0.025;
      ctx.strokeStyle = 'rgba(40,26,12,0.35)';
      wrap(y, bw * 0.42);
      ctx.stroke();
      ctx.strokeStyle = rgba('#fff6dc', 0.35);
      wrap(y, -bw * 0.38);
      ctx.stroke();
    }
    // 缝里的青光一段段亮起
    [[-3, 0.2], [-1, 0.5], [1, 0.12], [2, 0.55]].forEach(([i, u0], k) => {
      const y = i * s * 0.2 + s * 0.05;
      const a = 0.2 + 0.6 * Math.max(0, Math.sin(t * 3 + k * 1.7));
      rune(ctx, qpts(-R * 1.1, y - tilt, 0, y + bulge, R * 1.1, y + tilt, u0, u0 + 0.3, 6), glowCol, s * 0.035, a);
    });
    // 两条斜着交叉缠过去的绷带（压在上面）
    for (const [ang, off] of [[1.15, s * 0.32], [-0.55, s * 0.42]]) {
      const c = Math.cos(ang);
      const sn = Math.sin(ang);
      const P = (x, y) => [x * c - y * sn, x * sn + y * c];
      const cross = (dy) => {
        const p0 = P(-R * 1.2, off - s * 0.1 + dy);
        const p1 = P(0, off + s * 0.1 + dy);
        const p2 = P(R * 1.2, off - s * 0.1 + dy);
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]);
      };
      ctx.strokeStyle = 'rgba(30,20,10,0.35)';
      ctx.lineWidth = bw * 1.2;
      cross(s * 0.03);
      ctx.stroke();
      ctx.strokeStyle = bandFill;
      ctx.lineWidth = bw;
      cross(0);
      ctx.stroke();
      ctx.strokeStyle = rgba('#fff6dc', 0.4);
      ctx.lineWidth = s * 0.022;
      cross(-bw * 0.38);
      ctx.stroke();
    }
    // 细细的布纹
    strokes(ctx, 0, 0, R * 0.95, RY * 0.95, 46, '#4a3a22', 0.2, 5, 0.32, s * 0.07);
    strokes(ctx, R * 0.2, -RY * 0.2, R * 0.7, RY * 0.6, 18, '#fffaf0', 0.22, 9, 0.32, s * 0.06);
    // 球面明暗：右上亮、左下暗，底部一道沙地反光
    ctx.fillStyle = radial(ctx, 0, 0, 0, R * 1.25, [[0, 'rgba(255,250,230,0.22)'], [0.45, 'rgba(0,0,0,0)'], [1, 'rgba(8,10,26,0.5)']], R * 0.35, -RY * 0.45);
    ctx.fillRect(-R, -RY, R * 2, RY * 2);
    ctx.strokeStyle = rgba('#ffd890', 0.28);
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.ellipse(0, 0, R * 0.98, RY * 0.98, 0, 0.5, Math.PI - 0.5);
    ctx.stroke();
    // 绷带缝里的一双眼睛：缝里有一层青光，下沿受光
    ctx.fillStyle = '#06080c';
    ctx.beginPath();
    ctx.ellipse(-s * 0.3, -s * 0.15, s * 0.32, s * 0.1, -0.15, 0, TAU);
    ctx.fill();
    ctx.fillStyle = radial(ctx, -s * 0.3, -s * 0.15, 0, s * 0.3, [[0, rgba(glowCol, 0.3)], [1, rgba(glowCol, 0)]]);
    ctx.fill();
    ctx.strokeStyle = rgba('#fff6dc', 0.5);
    ctx.lineWidth = s * 0.025;
    ctx.beginPath();
    ctx.ellipse(-s * 0.3, -s * 0.15, s * 0.33, s * 0.11, -0.15, 0.3, Math.PI - 0.3);
    ctx.stroke();
    eyes(ctx, -s * 0.32, -s * 0.15, s * 0.22, s * 0.05, glowCol, -0.15);
    ctx.restore();
    rim(ctx, s, ball, '#fff2d0', 0.5);
    // 头顶翘着的一截绷带头，跟着滚动晃
    const flick = Math.sin(t * 6 + (o.seed || 0)) * s * 0.08;
    ctx.fillStyle = linear(ctx, R * 0.2, -RY, R * 0.7, -RY * 1.3, [[0, deep(cloth, 0.25)], [1, light(cloth, 0.2)]]);
    ctx.beginPath();
    ctx.moveTo(R * 0.12, -RY * 0.96);
    ctx.quadraticCurveTo(R * 0.35, -RY * 1.25 + flick * 0.5, R * 0.62 + flick * 0.3, -RY * 1.22 + flick);
    ctx.lineTo(R * 0.58 + flick * 0.3, -RY * 1.1 + flick);
    ctx.quadraticCurveTo(R * 0.4, -RY * 1.08, R * 0.32, -RY * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // 绕着它飘的几点青光
    sparkles(ctx, 0, cy, R * 1.1, RY * 0.9, 3, t, glowCol, 13, s * 0.03);
  };

  // 仙人掌球：带棱带刺的球在地上滚
  // 细节：棱脊朝光的一侧更亮、棱沟里透出越来越亮的火光（快爆了），棱上一排毛茸茸的刺座，
  // 外圈一簇簇的刺；顶上一朵两层花瓣、花心发光的花，快爆炸时迸出几点火星
  D.cactus = function (ctx, s, t, o) {
    const spin = -t * 4 - (o.seed || 0);
    shadow(ctx, 0, 2, s * 0.8);
    const base = '#4a9a50';
    const fire = '#ff8a3a';
    const cy = -s * 0.8;
    const R = s * 0.75;
    const pulse = 0.4 + Math.max(0, Math.sin(t * 7)) * 0.5;
    const ball = () => {
      ctx.beginPath();
      ctx.arc(0, cy, R, 0, TAU);
    };
    ctx.fillStyle = lit(ctx, 0, cy, R, base, 0.05, 0.4, 0.8);
    ball();
    ctx.fill();
    ctx.save();
    ball();
    ctx.clip();
    ctx.translate(0, cy);
    ctx.rotate(spin);
    ctx.lineCap = 'round';
    const rib = (a) => [Math.cos(a + 0.22) * R * 0.55, Math.sin(a + 0.22) * R * 0.55, Math.cos(a) * R, Math.sin(a) * R];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      const am = a + TAU / 20;
      // 棱沟：深色的沟
      const [gcx, gcy, gx, gy] = rib(a);
      ctx.strokeStyle = deep(base, 0.82);
      ctx.lineWidth = s * 0.07;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(gcx, gcy, gx, gy);
      ctx.stroke();
      // 棱脊：朝右上的棱更亮
      const shine = 0.5 + 0.5 * Math.cos(am + spin + Math.PI / 4);
      const [rcx, rcy, rx2, ry2] = rib(am);
      ctx.strokeStyle = rgba('#d0f4a8', 0.08 + 0.4 * shine);
      ctx.lineWidth = s * 0.06;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(rcx, rcy, rx2, ry2);
      ctx.stroke();
    }
    // 棱沟里透出的火光（快爆了的警告）
    for (let i = 0; i < 10; i++) {
      const [gcx, gcy, gx, gy] = rib((i / 10) * TAU);
      rune(ctx, qpts(0, 0, gcx, gcy, gx, gy, 0.15, 0.95, 5), fire, s * 0.03, pulse * 0.6);
    }
    // 刺座：棱脊上一排毛茸茸的小白点，每个点伸出两根细刺
    ctx.strokeStyle = 'rgba(255,244,215,0.7)';
    ctx.lineWidth = Math.max(0.6, s * 0.015);
    for (let i = 0; i < 10; i++) {
      const am = (i / 10) * TAU + TAU / 20;
      const [rcx, rcy, rx2, ry2] = rib(am);
      for (const u of [0.45, 0.72]) {
        const [[px, py]] = qpts(0, 0, rcx, rcy, rx2, ry2, u, u, 1);
        ctx.fillStyle = 'rgba(250,244,225,0.75)';
        ctx.beginPath();
        ctx.arc(px, py, s * 0.028, 0, TAU);
        ctx.fill();
        const q = Math.atan2(py, px);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(q + 0.5) * s * 0.09, py + Math.sin(q + 0.5) * s * 0.09);
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(q - 0.4) * s * 0.08, py + Math.sin(q - 0.4) * s * 0.08);
        ctx.stroke();
      }
    }
    // 棱汇在一起的顶点
    ctx.fillStyle = 'rgba(250,244,225,0.7)';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.05, 0, TAU);
    ctx.fill();
    ctx.restore();
    // 球面明暗（不跟着转）
    ctx.save();
    ball();
    ctx.clip();
    ctx.fillStyle = radial(ctx, 0, cy, 0, R * 1.25, [[0, 'rgba(240,255,210,0.2)'], [0.45, 'rgba(0,0,0,0)'], [1, 'rgba(6,14,20,0.5)']], R * 0.35, cy - R * 0.45);
    ctx.fillRect(-R, cy - R, R * 2, R * 2);
    ctx.restore();
    rim(ctx, s, ball, '#e8ffc0', 0.5);
    // 外圈的刺：每条棱末端一簇三根（跟着转）
    ctx.save();
    ctx.translate(0, cy);
    ctx.rotate(spin);
    ctx.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + TAU / 20;
      for (const [da, k] of [[-0.14, 0.86], [0, 1], [0.14, 0.86]]) {
        ctx.strokeStyle = da ? 'rgba(255,240,200,0.55)' : 'rgba(255,244,210,0.85)';
        ctx.lineWidth = da ? Math.max(0.7, s * 0.03) : Math.max(0.9, s * 0.045);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9);
        ctx.lineTo(Math.cos(a + da + 0.12) * R * 1.32 * k, Math.sin(a + da + 0.12) * R * 1.32 * k);
        ctx.stroke();
      }
    }
    ctx.restore();
    // 体内的火光（爆炸前的警告）
    glow(ctx, 0, cy, s * 0.7, '#ff7a3a', pulse * 0.75);
    if (pulse > 0.6) sparkles(ctx, 0, cy, R * 1.15, R * 1.05, 3, t * 2, '#ffb060', 17, s * 0.03);
    // 眼睛周围压一片暗影，发光的眼睛才不会和白色的刺座混在一起
    ctx.fillStyle = radial(ctx, -s * 0.3, cy - s * 0.1, 0, s * 0.3, [[0, 'rgba(6,18,12,0.85)'], [0.65, 'rgba(6,18,12,0.7)'], [1, 'rgba(6,18,12,0)']]);
    ctx.beginPath();
    ctx.ellipse(-s * 0.3, cy - s * 0.1, s * 0.3, s * 0.19, -0.15, 0, TAU);
    ctx.fill();
    // 顶上的花：外层 6 片粉花瓣、内层 5 片浅色花瓣，花心发光，花瓣慢慢转、轻轻开合
    const fx = s * 0.05;
    const fy = cy - s * 0.8;
    const open = 1 + Math.sin(t * 2.5) * 0.08;
    glow(ctx, fx, fy, s * 0.38, '#ffb0d0', 0.8);
    ctx.save();
    ctx.translate(fx, fy);
    ctx.scale(1, 0.72);
    for (const [n, len, wid, c0, c1, rot] of [[6, 0.19, 0.075, '#d8507e', '#ffd0e4', t], [5, 0.12, 0.055, '#ff9ac0', '#fff0f6', -t * 0.7 + 0.4]]) {
      for (let i = 0; i < n; i++) {
        ctx.save();
        ctx.rotate((i / n) * TAU + rot);
        ctx.fillStyle = linear(ctx, 0, 0, s * len * open, 0, [[0, c0], [1, c1]]);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(s * len * 0.45 * open, -s * wid, s * len * open, 0);
        ctx.quadraticCurveTo(s * len * 0.45 * open, s * wid, 0, 0);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
    dot(ctx, fx, fy, s * 0.04, '#fff0a0', 0.95);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - t;
      dot(ctx, fx + Math.cos(a) * s * 0.07, fy + Math.sin(a) * s * 0.05, s * 0.014, '#ffe080', 0.8);
    }
    eyes(ctx, -s * 0.3, cy - s * 0.1, s * 0.24, s * 0.065, '#fff0a0', -0.15);
  };

  // 秃鹫：两只长翅膀向上张开滑翔
  // 细节：翅膀分成覆羽（一排排鳞状小羽）和分开的飞羽（带羽轴），振翅时前缘发亮；
  // 身上一层层羽毛笔触，脖子一圈蓬松会抖的白领，秃头上有明暗，钩嘴根浅尖深；身后拖一串光尘
  D.vulture = function (ctx, s, t, o) {
    const flap = Math.sin(t * 5 + (o.seed || 0));
    const beat = Math.abs(Math.cos(t * 5 + (o.seed || 0)));
    ctx.save();
    ctx.save();
    ctx.globalAlpha *= 0.5;
    shadow(ctx, 0, 34, s * 0.9);
    ctx.restore();
    ctx.translate(0, -s * 0.5 + flap * 2);
    const base = '#8a6a50';
    const glowCol = '#ffcf6a';
    const skin = '#c89a80';
    // 身后拖的光尘
    for (let i = 0; i < 6; i++) {
      const u = (t * 0.9 + i / 6) % 1;
      dot(ctx, s * (0.85 + u * 0.9), Math.sin(u * 5 + i * 2) * s * 0.12 - s * 0.02, s * 0.03 * (1 - u * 0.5), glowCol, 0.55 * (1 - u));
    }
    const wingPath = (k, lift) => {
      const tipX = s * 0.55 * k;
      const tipY = -s * (1.2 + lift * 0.4) * k;
      ctx.beginPath();
      ctx.moveTo(-s * 0.15, -s * 0.05);
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
      return [tipX, tipY];
    };
    const drawWing = (k, lift, near) => {
      const [tipX, tipY] = wingPath(k, lift);
      ctx.fillStyle = near ? bodyGrad(ctx, -s * 0.2, -s * 1.6, s * 0.9, 0, base, 0.22, 0.72) : deep(base, 0.85);
      ctx.fill();
      ctx.save();
      wingPath(k, lift);
      ctx.clip();
      // 覆羽：靠近翅根的一片浅色鳞状小羽，上沿一道暗影
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(s * 0.12, -s * 0.22 * k, s * 0.48, s * 0.5 * k, 0.45, 0, TAU);
      ctx.clip();
      ctx.fillStyle = rgba('#e0c098', near ? 0.1 : 0.04);
      ctx.fillRect(-s, -s * 2, s * 2, s * 2.5);
      scales(ctx, -s * 0.45, -s * 0.8 * k, s * 0.75, s * 0.1, s * 0.12, '#ecd0a8', near ? 0.18 : 0.08);
      ctx.restore();
      ctx.strokeStyle = 'rgba(16,10,20,0.35)';
      ctx.lineWidth = s * 0.03;
      ctx.beginPath();
      ctx.ellipse(s * 0.12, -s * 0.22 * k, s * 0.48, s * 0.5 * k, 0.45, -2.6, -0.2);
      ctx.stroke();
      // 飞羽的羽轴：从翅膀中段散向每根飞羽的尖
      ctx.strokeStyle = rgba('#f0dcc0', near ? 0.3 : 0.12);
      ctx.lineWidth = Math.max(0.7, s * 0.018);
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const px = tipX - s * 0.08 + i * s * 0.14 * k;
        const py = tipY - s * 0.05 + i * s * 0.12 * k;
        ctx.moveTo(s * 0.05 + (px - s * 0.05) * 0.45, -s * 0.05 + (py + s * 0.05) * 0.45);
        ctx.lineTo(px - s * 0.02, py + s * 0.03);
      }
      ctx.stroke();
      ctx.restore();
      if (near) {
        // 振翅时前缘发亮
        rune(ctx, qpts(-s * 0.15, -s * 0.05, -s * 0.2, -s * 0.7 * k, tipX - s * 0.25, tipY, 0.15, 1, 8), glowCol, s * 0.03, 0.15 + beat * 0.4);
        rim(ctx, s, () => wingPath(k, lift), '#ffe6c0', 0.45);
      }
    };
    drawWing(0.85, flap, false);
    // 尾羽：三根扇开的长羽
    for (let i = -1; i <= 1; i++) {
      ctx.fillStyle = deep(base, 0.5 + Math.abs(i) * 0.15);
      ctx.beginPath();
      ctx.moveTo(s * 0.45, -s * 0.04);
      ctx.quadraticCurveTo(s * 0.75, -s * 0.12 + i * s * 0.09, s * 0.97, -s * 0.03 + i * s * 0.12);
      ctx.quadraticCurveTo(s * 0.72, s * 0.04 + i * s * 0.07, s * 0.45, s * 0.05);
      ctx.closePath();
      ctx.fill();
    }
    // 身体：腹部压暗、背上一层层羽毛笔触
    const body = () => {
      ctx.beginPath();
      ctx.ellipse(s * 0.05, 0, s * 0.55, s * 0.24, -0.1, 0, TAU);
    };
    ctx.fillStyle = bodyGrad(ctx, -s * 0.7, -s * 0.4, s * 0.8, s * 0.3, base, 0.22, 0.78);
    body();
    ctx.fill();
    ctx.save();
    body();
    ctx.clip();
    ctx.fillStyle = 'rgba(8,10,24,0.32)';
    ctx.beginPath();
    ctx.ellipse(s * 0.05, s * 0.2, s * 0.6, s * 0.14, -0.1, 0, TAU);
    ctx.fill();
    strokes(ctx, s * 0.12, -s * 0.05, s * 0.4, s * 0.14, 16, '#f0d4b0', 0.3, 31, 0.15, s * 0.12);
    strokes(ctx, s * 0.1, s * 0.07, s * 0.4, s * 0.1, 10, '#1a1008', 0.3, 37, 0.15, s * 0.1);
    ctx.restore();
    rim(ctx, s, body, '#ffe6c0', 0.5);
    // 长脖子（上沿一道亮）
    ctx.lineCap = 'round';
    ctx.strokeStyle = deep(skin, 0.45);
    ctx.lineWidth = s * 0.12;
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, -s * 0.05);
    ctx.quadraticCurveTo(-s * 0.55, -s * 0.25, -s * 0.62, -s * 0.2);
    ctx.stroke();
    ctx.strokeStyle = rgba('#ffd8c0', 0.3);
    ctx.lineWidth = s * 0.03;
    ctx.beginPath();
    ctx.moveTo(-s * 0.43, -s * 0.11);
    ctx.quadraticCurveTo(-s * 0.54, -s * 0.29, -s * 0.6, -s * 0.26);
    ctx.stroke();
    // 蓬松的白领：一圈波浪边的软羽（几团小羽毛连成一圈），边上的小羽团跟着风轻轻抖
    const ruff = '#e8dcc8';
    const rx0 = -s * 0.37;
    const ry0 = -s * 0.05;
    const collar = () => {
      ctx.beginPath();
      ctx.ellipse(rx0, ry0, s * 0.1, s * 0.08, 0, 0, TAU);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + 0.3;
        const x = rx0 + Math.cos(a) * s * 0.095;
        const y = ry0 + Math.sin(a) * s * 0.075;
        const r = s * (0.042 + 0.008 * Math.sin(t * 9 + i * 1.3));
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, TAU);
      }
    };
    ctx.fillStyle = lit(ctx, rx0, ry0, s * 0.14, ruff, 0.12, 0.38, 0.7);
    collar();
    ctx.fill();
    ctx.save();
    collar();
    ctx.clip();
    strokes(ctx, rx0, ry0 + s * 0.02, s * 0.12, s * 0.09, 10, '#5a4630', 0.3, 43, 0.9, s * 0.05);
    ctx.restore();
    rim(ctx, s, collar, '#fff6e0', 0.5);
    // 秃头：有明暗、后脑两道皱纹
    const head = () => {
      ctx.beginPath();
      ctx.ellipse(-s * 0.66, -s * 0.22, s * 0.15, s * 0.12, 0, 0, TAU);
    };
    ctx.fillStyle = lit(ctx, -s * 0.66, -s * 0.22, s * 0.15, skin, 0.2, 0.42, 0.75);
    head();
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,30,24,0.35)';
    ctx.lineWidth = Math.max(0.6, s * 0.015);
    ctx.beginPath();
    ctx.arc(-s * 0.58, -s * 0.22, s * 0.05, -0.8, 0.8);
    ctx.moveTo(-s * 0.55, -s * 0.15);
    ctx.arc(-s * 0.6, -s * 0.15, s * 0.05, -0.6, 0.6);
    ctx.stroke();
    rim(ctx, s, head, '#ffe0d0', 0.5);
    // 弯钩嘴：根部浅、尖端深，一个小鼻孔
    ctx.fillStyle = linear(ctx, -s * 0.78, -s * 0.24, -s * 0.95, -s * 0.06, [[0, '#f0e2c0'], [0.6, '#c8b088'], [1, '#4a3a2a']]);
    ctx.beginPath();
    ctx.moveTo(-s * 0.78, -s * 0.24);
    ctx.quadraticCurveTo(-s * 0.98, -s * 0.2, -s * 0.93, -s * 0.06);
    ctx.lineTo(-s * 0.78, -s * 0.13);
    ctx.fill();
    ctx.fillStyle = 'rgba(40,24,16,0.6)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.83, -s * 0.2, s * 0.022, s * 0.012, 0, 0, TAU);
    ctx.fill();
    // 眼眶一圈深色，发光的眼睛才看得见
    ctx.fillStyle = 'rgba(30,12,18,0.75)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.7, -s * 0.25, s * 0.065, s * 0.045, -0.2, 0, TAU);
    ctx.fill();
    // 近侧翅膀
    drawWing(1, flap * 0.8 + 0.1, true);
    eyes(ctx, -s * 0.7, -s * 0.25, 0.01, s * 0.05, glowCol, -0.2);
    ctx.restore();
  };

  // 小祭司：兜帽长袍，手持发光的生命权杖，治疗的光点绕着杖头转
  // 细节：长袍上的衣褶（暗褶 + 亮棱，跟着下摆飘）、金色滚边和一排小光点、腰绳和会摆的流苏、
  // 宽袖子和握杖的手；兜帽口一圈金边、额前一颗治疗色的小宝石；权杖有金箍、杖头是金色的生命环
  D.priest = function (ctx, s, t, o) {
    const sway = Math.sin(t * 3 + (o.seed || 0)) * 0.05;
    shadow(ctx, 0, 2, s * 0.7);
    const base = '#7a5ab8';
    const gold = '#ffd27a';
    const heal = '#a8ffcf';
    ctx.save();
    ctx.rotate(sway);
    // 长袍：下摆拖地、微微飘动
    const hem = Math.sin(t * 4) * s * 0.06;
    const robe = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.2, -s * 1.75);
      ctx.quadraticCurveTo(-s * 0.55, -s * 0.8, -s * 0.6 + hem, 0);
      ctx.quadraticCurveTo(0, s * 0.06, s * 0.62 - hem, 0);
      ctx.quadraticCurveTo(s * 0.5, -s * 0.8, s * 0.22, -s * 1.75);
      ctx.closePath();
    };
    ctx.fillStyle = linear(ctx, s * 0.55, -s * 1.7, -s * 0.6, -s * 0.1, [[0, deep(base, 0.1)], [0.45, deep(base, 0.4)], [1, deep(base, 0.8)]]);
    robe();
    ctx.fill();
    ctx.save();
    robe();
    ctx.clip();
    // 衣褶：从肩往下摆散开，暗褶旁边一道亮棱
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const x0 = -s * 0.13 + i * s * 0.065;
      const x1 = -s * 0.46 + i * s * 0.23 + hem * (1 - i * 0.5);
      ctx.strokeStyle = 'rgba(12,6,30,0.35)';
      ctx.lineWidth = s * 0.05;
      ctx.beginPath();
      ctx.moveTo(x0, -s * 1.55);
      ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.25, -s * 0.7, x1, s * 0.05);
      ctx.stroke();
      ctx.strokeStyle = rgba('#e0d0ff', 0.16 + i * 0.04);
      ctx.lineWidth = s * 0.022;
      ctx.beginPath();
      ctx.moveTo(x0 + s * 0.035, -s * 1.55);
      ctx.quadraticCurveTo(x0 + s * 0.035 + (x1 - x0) * 0.25, -s * 0.7, x1 + s * 0.04, s * 0.05);
      ctx.stroke();
    }
    // 腰绳
    ctx.strokeStyle = goldGrad(ctx, -s * 0.45, -s * 1.15, s * 0.45, -s * 0.95);
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, -s * 1.03);
    ctx.quadraticCurveTo(0, -s * 0.95, s * 0.5, -s * 1.08);
    ctx.stroke();
    // 下摆的金色滚边，滚边上一排发光的小点
    ctx.strokeStyle = goldGrad(ctx, -s * 0.6, -s * 0.1, s * 0.6, s * 0.02);
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.moveTo(-s * 0.64 + hem, -s * 0.04);
    ctx.quadraticCurveTo(0, s * 0.02, s * 0.66 - hem, -s * 0.04);
    ctx.stroke();
    for (const [x, y] of qpts(-s * 0.6 + hem, -s * 0.045, 0, s * 0.015, s * 0.62 - hem, -s * 0.045, 0.12, 0.88, 5)) dot(ctx, x, y, s * 0.016, '#fff0c0', 0.7);
    ctx.restore();
    rim(ctx, s, robe, '#e8d8ff', 0.5);
    // 袍子上发光的花纹：Y 形纹，中间一颗会呼吸的小菱形
    rune(ctx, [[-s * 0.3, -s * 0.3], [0, -s * 0.5], [s * 0.3, -s * 0.3]], gold, 1.4, 0.6);
    rune(ctx, [[0, -s * 0.5], [0, -s * 0.95]], gold, 1.2, 0.45);
    const da = 0.45 + 0.35 * Math.sin(t * 2.5);
    rune(ctx, [[-s * 0.07, -s * 0.52], [0, -s * 0.62], [s * 0.07, -s * 0.52], [0, -s * 0.42], [-s * 0.07, -s * 0.52]], gold, 1.2, da);
    glow(ctx, 0, -s * 0.52, s * 0.18, gold, da * 0.5);
    // 腰绳垂下的两根流苏，走路时摆
    const swing = Math.sin(t * 4 + 1) * s * 0.04;
    for (const [x0, len] of [[-s * 0.2, s * 0.32], [-s * 0.12, s * 0.26]]) {
      const ex = x0 - s * 0.02 + swing;
      const ey = -s * 1.0 + len;
      ctx.strokeStyle = rgba('#ffe0a0', 0.75);
      ctx.lineWidth = Math.max(0.8, s * 0.025);
      ctx.beginPath();
      ctx.moveTo(x0, -s * 1.0);
      ctx.quadraticCurveTo(x0, -s * 1.0 + len * 0.6, ex, ey);
      ctx.stroke();
      ctx.fillStyle = goldGrad(ctx, ex - s * 0.03, ey, ex + s * 0.03, ey + s * 0.1);
      ctx.beginPath();
      ctx.moveTo(ex, ey - s * 0.01);
      ctx.lineTo(ex - s * 0.035, ey + s * 0.09);
      ctx.lineTo(ex + s * 0.035, ey + s * 0.09);
      ctx.closePath();
      ctx.fill();
    }
    // 权杖：木杆 + 一道亮边 + 两道金箍
    const sx0 = -s * 0.6;
    const sy0 = -s * 0.1;
    const sx1 = -s * 0.7;
    const sy1 = -s * 2.0;
    ctx.strokeStyle = deep('#c8a060', 0.4);
    ctx.lineWidth = s * 0.07;
    ctx.beginPath();
    ctx.moveTo(sx0, sy0);
    ctx.lineTo(sx1, sy1);
    ctx.stroke();
    ctx.strokeStyle = rgba('#ffe8b0', 0.35);
    ctx.lineWidth = s * 0.02;
    ctx.beginPath();
    ctx.moveTo(sx0 + s * 0.02, sy0);
    ctx.lineTo(sx1 + s * 0.02, sy1);
    ctx.stroke();
    ctx.strokeStyle = goldGrad(ctx, sx1 - s * 0.05, sy1, sx0 + s * 0.05, sy0);
    ctx.lineWidth = s * 0.05;
    ctx.lineCap = 'butt';
    for (const u of [0.35, 0.88]) {
      const x = sx0 + (sx1 - sx0) * u;
      const y = sy0 + (sy1 - sy0) * u;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.055, y - s * 0.003);
      ctx.lineTo(x + s * 0.055, y + s * 0.003);
      ctx.stroke();
    }
    ctx.lineCap = 'round';
    // 宽袖子（袖口金边）和握着权杖的手
    const sleeve = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.06, -s * 1.62);
      ctx.quadraticCurveTo(-s * 0.45, -s * 1.52, -s * 0.62, -s * 1.2);
      ctx.lineTo(-s * 0.5, -s * 1.0);
      ctx.quadraticCurveTo(-s * 0.3, -s * 1.22, -s * 0.06, -s * 1.3);
      ctx.closePath();
    };
    ctx.fillStyle = linear(ctx, -s * 0.1, -s * 1.6, -s * 0.55, -s * 1.05, [[0, deep(base, 0.2)], [1, deep(base, 0.6)]]);
    sleeve();
    ctx.fill();
    rim(ctx, s, sleeve, '#e8d8ff', 0.45);
    ctx.strokeStyle = goldGrad(ctx, -s * 0.62, -s * 1.2, -s * 0.5, -s * 1.0);
    ctx.lineWidth = s * 0.045;
    ctx.beginPath();
    ctx.moveTo(-s * 0.62, -s * 1.2);
    ctx.lineTo(-s * 0.5, -s * 1.0);
    ctx.stroke();
    ctx.fillStyle = lit(ctx, -s * 0.65, -s * 1.1, s * 0.065, '#9a7ac8', 0.15, 0.4, 0.7);
    ctx.beginPath();
    ctx.ellipse(-s * 0.65, -s * 1.1, s * 0.065, s * 0.055, 0, 0, TAU);
    ctx.fill();
    // 兜帽：帽尖跟着轻轻晃，侧面一道布褶
    const peak = Math.sin(t * 3 + 1) * s * 0.03;
    const hood = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.38, -s * 1.6);
      ctx.quadraticCurveTo(-s * 0.42, -s * 2.3, s * 0.1 + peak, -s * 2.38);
      ctx.quadraticCurveTo(s * 0.4, -s * 2.1, s * 0.34, -s * 1.6);
      ctx.closePath();
    };
    ctx.fillStyle = lit(ctx, 0, -s * 1.95, s * 0.42, base, 0.1, 0.38, 0.78);
    hood();
    ctx.fill();
    ctx.save();
    hood();
    ctx.clip();
    ctx.strokeStyle = 'rgba(12,6,30,0.32)';
    ctx.lineWidth = s * 0.035;
    ctx.beginPath();
    ctx.moveTo(s * 0.08 + peak, -s * 2.34);
    ctx.quadraticCurveTo(s * 0.26, -s * 2.0, s * 0.22, -s * 1.62);
    ctx.stroke();
    ctx.restore();
    rim(ctx, s, hood, '#e8d8ff', 0.55);
    // 帽口的金边（下面敞开），里面是藏在阴影里的脸
    ctx.strokeStyle = goldGrad(ctx, -s * 0.3, -s * 2.1, s * 0.14, -s * 1.6);
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.ellipse(-s * 0.08, -s * 1.85, s * 0.215, s * 0.235, 0, Math.PI * 0.8, Math.PI * 2.2);
    ctx.stroke();
    ctx.fillStyle = radial(ctx, -s * 0.1, -s * 1.85, 0, s * 0.22, [[0, '#1a1430'], [1, '#06040c']]);
    ctx.beginPath();
    ctx.ellipse(-s * 0.08, -s * 1.85, s * 0.2, s * 0.22, 0, 0, TAU);
    ctx.fill();
    eyes(ctx, -s * 0.12, -s * 1.88, s * 0.14, s * 0.04, '#bfffd8', -0.1);
    dot(ctx, -s * 0.08, -s * 2.11, s * 0.028, heal, 0.6 + Math.sin(t * 4) * 0.25);
    // 杖头：金色的生命环，环心一颗治疗的光珠，光点绕着转
    const pulse = 0.6 + Math.sin(t * 4) * 0.3;
    glow(ctx, sx1, -s * 2.1, s * 0.55, heal, pulse, true);
    ctx.strokeStyle = goldGrad(ctx, sx1 - s * 0.12, -s * 2.3, sx1 + s * 0.12, -s * 1.95);
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.ellipse(sx1, -s * 2.19, s * 0.08, s * 0.1, 0, 0, TAU);
    ctx.moveTo(sx1 - s * 0.13, -s * 2.05);
    ctx.lineTo(sx1 + s * 0.13, -s * 2.05);
    ctx.stroke();
    dot(ctx, sx1, -s * 2.19, s * 0.035, heal, 0.75 + pulse * 0.25);
    sparkles(ctx, sx1, -s * 2.1, s * 0.32, s * 0.22, 4, t * 1.5, heal, 9, s * 0.03);
    ctx.restore();
  };

  // 胖法老（大 Boss）：圆滚滚的亚麻长袍、宝石项圈、条纹头巾和金面具、手里的弯钩权杖；残血时展开金字塔护盾
  // 细节：长袍缠着几圈亚麻绷带（布纹、上亮下暗）、金腰带和蓝金条纹的前摆、侧面三个发光的小象形符号；
  // 项圈分金 / 青金石 / 绿松石几排、外圈一排垂珠、一道金光扫过；头巾金底蓝纹、额前圣甲虫宝石；
  // 金面具有眼线、眉毛、鼻梁高光和编辫胡子；短胖的手臂握着弯钩权杖；每个阶段宝石换一种光
  const PHARAOH_GEM = { 1: '#ffd27a', 2: '#7affd8', 3: '#fff0b0' };
  D.pharaoh = function (ctx, s, t, o) {
    const ai = o.ai || {};
    const gem = PHARAOH_GEM[ai.phase] || PHARAOH_GEM[1];
    shadow(ctx, 0, 2, s * 1.2);
    const linen = '#f0d8a0';
    const lapis = '#2f56b8';
    const turq = '#3ac8b8';
    const gold = '#ffd27a';
    const bob = Math.sin(t * 2) * s * 0.03;
    ctx.save();
    ctx.translate(0, bob);
    // 圆滚滚的身体（长袍）
    const robe = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.55, -s * 0.05);
      ctx.bezierCurveTo(-s * 1.15, -s * 0.5, -s * 0.95, -s * 1.6, -s * 0.2, -s * 1.65);
      ctx.bezierCurveTo(s * 0.7, -s * 1.65, s * 1.1, -s * 0.5, s * 0.55, -s * 0.05);
      ctx.closePath();
    };
    ctx.fillStyle = radial(ctx, 0, -s * 0.85, 0, s * 1.15, [[0, light(linen, 0.2)], [0.45, deep(linen, 0.2)], [1, deep(linen, 0.62)]], s * 0.35, -s * 1.25);
    robe();
    ctx.fill();
    ctx.save();
    robe();
    ctx.clip();
    // 一圈圈缠着的亚麻绷带：顺着肚子往下弯，上缘亮、下缘暗
    ctx.lineWidth = s * 0.022;
    for (let i = 0; i < 8; i++) {
      const y = -s * 0.2 - i * s * 0.19;
      ctx.strokeStyle = 'rgba(70,46,16,0.3)';
      ctx.beginPath();
      ctx.moveTo(-s * 1.1, y - s * 0.06);
      ctx.quadraticCurveTo(0, y + s * 0.14, s * 1.1, y - s * 0.1);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,250,230,0.32)';
      ctx.beginPath();
      ctx.moveTo(-s * 1.1, y - s * 0.09);
      ctx.quadraticCurveTo(0, y + s * 0.11, s * 1.1, y - s * 0.13);
      ctx.stroke();
    }
    strokes(ctx, 0, -s * 0.8, s * 0.95, s * 0.75, 50, '#6a4a20', 0.16, 41, 0.08, s * 0.09);
    // 金腰带：一排青金石方块，正中一枚随阶段变色的圣甲虫扣
    const beltY = (x) => -s * 0.8 + s * 0.05 * (1 - (x / s) * (x / s));
    ctx.strokeStyle = goldGrad(ctx, -s, -s * 0.9, s, -s * 0.65);
    ctx.lineWidth = s * 0.11;
    ctx.beginPath();
    ctx.moveTo(-s * 1.1, beltY(-s * 1.1));
    ctx.quadraticCurveTo(0, -s * 0.7, s * 1.1, beltY(s * 1.1));
    ctx.stroke();
    ctx.fillStyle = lapis;
    for (let i = -4; i <= 4; i++) {
      const x = i * s * 0.2 + s * 0.1;
      const y = beltY(x) - s * 0.015;
      ctx.fillRect(x - s * 0.035, y, s * 0.07, s * 0.05);
    }
    // 前摆：从腰带垂到下摆，蓝金竖条纹，边上一道金边
    const sw = Math.sin(t * 2.4) * s * 0.02;
    const apron = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.42, -s * 0.72);
      ctx.lineTo(s * 0.02, -s * 0.72);
      ctx.lineTo(s * 0.08 + sw, -s * 0.02);
      ctx.lineTo(-s * 0.54 + sw, -s * 0.02);
      ctx.closePath();
    };
    ctx.fillStyle = goldGrad(ctx, -s * 0.54, -s * 0.72, s * 0.08, 0);
    apron();
    ctx.fill();
    ctx.save();
    apron();
    ctx.clip();
    for (let i = 0; i < 5; i++) {
      const xt = -s * 0.36 + i * s * 0.09;
      const xb = -s * 0.47 + i * s * 0.12 + sw;
      ctx.fillStyle = rgba(lapis, 0.85);
      ctx.beginPath();
      ctx.moveTo(xt, -s * 0.72);
      ctx.lineTo(xt + s * 0.04, -s * 0.72);
      ctx.lineTo(xb + s * 0.055, 0);
      ctx.lineTo(xb, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(8,10,30,0.35)';
    ctx.fillRect(-s * 0.6, -s * 0.72, s * 0.7, s * 0.08);
    ctx.restore();
    ctx.strokeStyle = rgba('#fff0b0', 0.6);
    ctx.lineWidth = s * 0.02;
    apron();
    ctx.stroke();
    // 体积感：左下压暗，右上留一片亮
    ctx.fillStyle = radial(ctx, 0, -s * 0.85, 0, s * 1.2, [[0, 'rgba(255,250,230,0.18)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(10,12,34,0.5)']], s * 0.35, -s * 1.25);
    ctx.fillRect(-s * 1.2, -s * 1.7, s * 2.4, s * 1.7);
    ctx.restore();
    rim(ctx, s, robe, '#fff2c8', 0.6);
    // 腰带扣：圣甲虫宝石
    const buckle = (x, y, r) => {
      glow(ctx, x, y, r * 3.5, gem, 0.55 + Math.sin(t * 3) * 0.15);
      ctx.fillStyle = goldGrad(ctx, x - r * 1.6, y - r, x + r * 1.6, y + r);
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.6, r * 1.05, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = radial(ctx, x, y, 0, r, [[0, light(gem, 0.7)], [0.6, gem], [1, deep(gem, 0.5)]], x + r * 0.3, y - r * 0.3);
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.75, 0, 0, TAU);
      ctx.fill();
    };
    buckle(-s * 0.2, -s * 0.76, s * 0.06);
    // 侧面三个发光的小象形符号：太阳、水波、生命环
    const ga = 0.35 + 0.25 * Math.sin(t * 1.6);
    const gx = s * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(gold, ga);
    ctx.lineWidth = s * 0.025;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(gx, -s * 1.1, s * 0.06, 0, TAU);
    ctx.moveTo(gx + s * 0.015, -s * 1.1);
    ctx.arc(gx, -s * 1.1, s * 0.015, 0, TAU);
    ctx.moveTo(gx - s * 0.08, -s * 0.9);
    for (let i = 1; i <= 4; i++) ctx.lineTo(gx - s * 0.08 + i * s * 0.04, -s * 0.9 + (i % 2 ? -s * 0.03 : 0));
    ctx.moveTo(gx + s * 0.045, -s * 0.66);
    ctx.ellipse(gx, -s * 0.66, s * 0.045, s * 0.055, 0, 0, TAU);
    ctx.moveTo(gx, -s * 0.6);
    ctx.lineTo(gx, -s * 0.42);
    ctx.moveTo(gx - s * 0.07, -s * 0.56);
    ctx.lineTo(gx + s * 0.07, -s * 0.56);
    ctx.stroke();
    ctx.restore();
    // 宝石项圈：金 / 青金石 / 绿松石几排，外圈一排垂珠，一道金光扫过
    const cx = -s * 0.1;
    const cyc = -s * 1.55;
    const a0 = 0.3;
    const a1 = Math.PI - 0.3;
    ctx.lineCap = 'butt';
    for (const [r, w, col] of [[0.44, 0.08, 'g'], [0.52, 0.08, lapis], [0.595, 0.07, turq], [0.665, 0.07, 'g']]) {
      ctx.strokeStyle = col === 'g' ? goldGrad(ctx, cx - s * 0.7, cyc, cx + s * 0.7, cyc + s * 0.7) : col;
      ctx.lineWidth = s * w;
      ctx.beginPath();
      ctx.arc(cx, cyc, s * r, a0, a1);
      ctx.stroke();
    }
    // 青金石那一排的金色分隔珠、外圈的垂珠
    for (let i = 0; i <= 12; i++) {
      const a = a0 + ((a1 - a0) * i) / 12;
      ctx.fillStyle = '#ffe8a0';
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * s * 0.52, cyc + Math.sin(a) * s * 0.52, s * 0.016, 0, TAU);
      ctx.fill();
      const bx = cx + Math.cos(a) * s * 0.735;
      const by2 = cyc + Math.sin(a) * s * 0.735;
      ctx.fillStyle = i % 2 ? lapis : goldGrad(ctx, bx - s * 0.04, by2 - s * 0.04, bx + s * 0.04, by2 + s * 0.04);
      ctx.beginPath();
      ctx.ellipse(bx, by2, s * 0.025, s * 0.04, a - Math.PI / 2, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,250,220,0.45)';
    ctx.lineWidth = s * 0.012;
    ctx.beginPath();
    ctx.arc(cx, cyc, s * 0.405, a0, a1);
    ctx.stroke();
    const sweep = a0 + ((t * 0.45) % 1) * (a1 - a0 + 0.6) - 0.3;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(gold, 0.55);
    ctx.lineWidth = s * 0.3;
    ctx.beginPath();
    ctx.arc(cx, cyc, s * 0.555, Math.max(a0, sweep - 0.18), Math.min(a1, sweep + 0.18));
    ctx.stroke();
    ctx.restore();
    // 握着权杖的短胖手臂：缠着绷带，手腕一圈金镯
    const arm = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.62, -s * 1.38);
      ctx.quadraticCurveTo(-s * 0.95, -s * 1.3, -s * 0.98, -s * 1.02);
      ctx.lineTo(-s * 0.84, -s * 0.94);
      ctx.quadraticCurveTo(-s * 0.78, -s * 1.12, -s * 0.55, -s * 1.12);
      ctx.closePath();
    };
    // 弯钩权杖：蓝金相间的杆，杖头弯钩下一颗随阶段变色的宝石
    const px0 = -s * 0.9;
    const py0 = -s * 0.2;
    const px1 = -s * 1.0;
    const py1 = -s * 1.9;
    ctx.strokeStyle = goldGrad(ctx, px1 - s * 0.05, py1, px0 + s * 0.05, py0);
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.moveTo(px0, py0);
    ctx.lineTo(px1, py1);
    ctx.arc(px1 - s * 0.11, py1, s * 0.11, 0, -Math.PI * 1.15, true);
    ctx.stroke();
    ctx.strokeStyle = lapis;
    for (let i = 0; i < 8; i++) {
      const u = 0.06 + i * 0.12;
      const x = px0 + (px1 - px0) * u;
      const y = py0 + (py1 - py0) * u;
      ctx.beginPath();
      ctx.moveTo(x + (px1 - px0) * 0.03, y + (py1 - py0) * 0.03);
      ctx.lineTo(x - (px1 - px0) * 0.03, y - (py1 - py0) * 0.03);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,250,220,0.5)';
    ctx.lineWidth = s * 0.015;
    ctx.beginPath();
    ctx.moveTo(px0 + s * 0.018, py0);
    ctx.lineTo(px1 + s * 0.018, py1);
    ctx.stroke();
    ctx.fillStyle = lit(ctx, -s * 0.75, -s * 1.2, s * 0.25, linen, 0.1, 0.35, 0.65);
    arm();
    ctx.fill();
    ctx.save();
    arm();
    ctx.clip();
    ctx.strokeStyle = 'rgba(70,46,16,0.35)';
    ctx.lineWidth = s * 0.018;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-s * (0.62 + i * 0.09), -s * 1.45);
      ctx.lineTo(-s * (0.72 + i * 0.09), -s * 0.95);
      ctx.stroke();
    }
    ctx.restore();
    rim(ctx, s, arm, '#fff2c8', 0.5);
    ctx.strokeStyle = goldGrad(ctx, -s * 1.0, -s * 1.05, -s * 0.84, -s * 0.9);
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.moveTo(-s * 0.97, -s * 1.04);
    ctx.lineTo(-s * 0.85, -s * 0.97);
    ctx.stroke();
    ctx.fillStyle = lit(ctx, -s * 0.93, -s * 0.92, s * 0.08, linen, 0.1, 0.35, 0.65);
    ctx.beginPath();
    ctx.ellipse(-s * 0.94, -s * 0.92, s * 0.085, s * 0.07, 0.3, 0, TAU);
    ctx.fill();
    glow(ctx, px1, py1 - s * 0.1, s * 0.45, gem, 0.8, true);
    ctx.fillStyle = radial(ctx, px1, py1 - s * 0.02, 0, s * 0.05, [[0, '#ffffff'], [0.5, gem], [1, deep(gem, 0.4)]], px1 + s * 0.015, py1 - s * 0.035);
    ctx.beginPath();
    ctx.ellipse(px1, py1 - s * 0.02, s * 0.045, s * 0.055, 0, 0, TAU);
    ctx.fill();
    // 头巾：金底，一条条青金石色的横纹（上缘一道亮）
    const hx = -s * 0.15;
    const hy = -s * 1.95;
    const nemes = () => {
      ctx.beginPath();
      ctx.moveTo(hx - s * 0.5, hy + s * 0.45);
      ctx.quadraticCurveTo(hx - s * 0.55, hy - s * 0.45, hx, hy - s * 0.5);
      ctx.quadraticCurveTo(hx + s * 0.55, hy - s * 0.45, hx + s * 0.5, hy + s * 0.45);
      ctx.closePath();
    };
    ctx.fillStyle = goldGrad(ctx, hx - s * 0.55, hy - s * 0.5, hx + s * 0.55, hy + s * 0.45);
    nemes();
    ctx.fill();
    ctx.save();
    nemes();
    ctx.clip();
    for (let i = 0; i < 6; i++) {
      const y = hy - s * 0.36 + i * s * 0.16;
      ctx.fillStyle = rgba(lapis, 0.72);
      ctx.beginPath();
      ctx.moveTo(hx - s * 0.6, y + s * 0.07);
      ctx.quadraticCurveTo(hx, y - s * 0.05, hx + s * 0.6, y + s * 0.07);
      ctx.lineTo(hx + s * 0.6, y + s * 0.14);
      ctx.quadraticCurveTo(hx, y + s * 0.02, hx - s * 0.6, y + s * 0.14);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(170,200,255,0.4)';
      ctx.lineWidth = s * 0.012;
      ctx.beginPath();
      ctx.moveTo(hx - s * 0.6, y + s * 0.075);
      ctx.quadraticCurveTo(hx, y - s * 0.045, hx + s * 0.6, y + s * 0.075);
      ctx.stroke();
    }
    ctx.fillStyle = radial(ctx, hx, hy, 0, s * 0.6, [[0, 'rgba(255,250,220,0.15)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(10,12,34,0.45)']], hx + s * 0.2, hy - s * 0.25);
    ctx.fillRect(hx - s * 0.6, hy - s * 0.55, s * 1.2, s * 1.05);
    ctx.restore();
    rim(ctx, s, nemes, '#fff4c8', 0.65);
    // 金色的面具：眼线、眉毛、鼻梁高光、脸颊阴影，眼睛发光
    const mask = () => {
      ctx.beginPath();
      ctx.moveTo(hx - s * 0.26, hy - s * 0.15);
      ctx.quadraticCurveTo(hx, hy - s * 0.25, hx + s * 0.22, hy - s * 0.15);
      ctx.quadraticCurveTo(hx + s * 0.25, hy + s * 0.2, hx - s * 0.02, hy + s * 0.32);
      ctx.quadraticCurveTo(hx - s * 0.3, hy + s * 0.2, hx - s * 0.26, hy - s * 0.15);
    };
    ctx.fillStyle = linear(ctx, hx + s * 0.25, hy - s * 0.2, hx - s * 0.25, hy + s * 0.35, [[0, '#fff2b8'], [0.45, '#f0c860'], [1, '#8a5a14']]);
    mask();
    ctx.fill();
    ctx.save();
    mask();
    ctx.clip();
    ctx.fillStyle = 'rgba(90,50,10,0.25)';
    ctx.beginPath();
    ctx.ellipse(hx - s * 0.24, hy + s * 0.12, s * 0.12, s * 0.2, 0.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,252,230,0.6)';
    ctx.lineWidth = s * 0.018;
    ctx.beginPath();
    ctx.moveTo(hx - s * 0.04, hy + s * 0.0);
    ctx.quadraticCurveTo(hx - s * 0.03, hy + s * 0.1, hx - s * 0.07, hy + s * 0.14);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(110,60,10,0.5)';
    ctx.lineWidth = s * 0.014;
    ctx.beginPath();
    ctx.moveTo(hx - s * 0.12, hy + s * 0.215);
    ctx.quadraticCurveTo(hx - s * 0.05, hy + s * 0.235, hx + s * 0.02, hy + s * 0.215);
    ctx.stroke();
    ctx.restore();
    rim(ctx, s, mask, '#fffbe0', 0.6);
    // 眉毛和眼线（青金石色）：眼线只描上眼睑，外眼角往外拉一道上翘的尾巴
    ctx.strokeStyle = deep(lapis, 0.3);
    ctx.lineCap = 'round';
    ctx.lineWidth = s * 0.022;
    for (const [ex, side] of [[hx - s * 0.15, -1], [hx + s * 0.05, 1]]) {
      ctx.beginPath();
      ctx.moveTo(ex - s * 0.07, hy - s * 0.07);
      ctx.quadraticCurveTo(ex, hy - s * 0.11, ex + s * 0.07, hy - s * 0.075);
      ctx.moveTo(ex - s * 0.065, hy - s * 0.02);
      ctx.ellipse(ex, hy - s * 0.02, s * 0.065, s * 0.032, 0, Math.PI, TAU);
      ctx.moveTo(ex + side * s * 0.065, hy - s * 0.02);
      ctx.lineTo(ex + side * s * 0.11, hy - s * 0.045);
      ctx.stroke();
    }
    eyes(ctx, hx - s * 0.05, hy - s * 0.02, s * 0.2, s * 0.055, '#7ae0ff', -0.05);
    // 额前的金箍和圣甲虫宝石
    ctx.strokeStyle = goldGrad(ctx, hx - s * 0.3, hy - s * 0.3, hx + s * 0.3, hy - s * 0.15);
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.moveTo(hx - s * 0.3, hy - s * 0.17);
    ctx.quadraticCurveTo(hx - s * 0.02, hy - s * 0.3, hx + s * 0.27, hy - s * 0.17);
    ctx.stroke();
    buckle(hx - s * 0.02, hy - s * 0.27, s * 0.045);
    // 编辫的胡子：青金石底、一道道金箍，末端微微往前翘
    const beard = () => {
      ctx.beginPath();
      ctx.moveTo(hx - s * 0.06, hy + s * 0.27);
      ctx.lineTo(hx + s * 0.04, hy + s * 0.27);
      ctx.lineTo(hx + s * 0.03, hy + s * 0.44);
      ctx.quadraticCurveTo(hx - s * 0.02, hy + s * 0.5, hx - s * 0.07, hy + s * 0.45);
      ctx.closePath();
    };
    ctx.fillStyle = linear(ctx, hx + s * 0.04, 0, hx - s * 0.06, 0, [[0, '#3a5ac0'], [1, '#14204a']]);
    beard();
    ctx.fill();
    ctx.save();
    beard();
    ctx.clip();
    ctx.strokeStyle = goldGrad(ctx, hx - s * 0.06, hy + s * 0.27, hx + s * 0.04, hy + s * 0.5);
    ctx.lineWidth = s * 0.018;
    for (let i = 0; i < 5; i++) {
      const y = hy + s * (0.3 + i * 0.04);
      ctx.beginPath();
      ctx.moveTo(hx - s * 0.08, y + s * 0.01);
      ctx.lineTo(hx + s * 0.06, y - s * 0.01);
      ctx.stroke();
    }
    ctx.restore();
    // 绕着身体飘的金沙光点
    sparkles(ctx, -s * 0.1, -s * 1.2, s * 0.9, s * 0.95, 6, t * 0.7, gold, 51, s * 0.025);
    ctx.restore();
    // 金字塔护盾（第三阶段，设计书 19.3）：一层层砖缝，一道光从下往上扫，塔尖一点亮光
    if (ai.phase === 3 && o.shield > 0) {
      const pyr = () => {
        ctx.beginPath();
        ctx.moveTo(-s * 1.4, 0);
        ctx.lineTo(0, -s * 2.9);
        ctx.lineTo(s * 1.4, 0);
        ctx.closePath();
      };
      ctx.fillStyle = linear(ctx, 0, -s * 2.8, 0, 0, [[0, 'rgba(255,230,140,0.4)'], [1, 'rgba(255,200,90,0.12)']]);
      pyr();
      ctx.fill();
      ctx.save();
      pyr();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,240,180,0.22)';
      ctx.lineWidth = Math.max(1, s * 0.015);
      ctx.beginPath();
      for (let i = 1; i < 8; i++) {
        const y = -i * s * 0.36;
        ctx.moveTo(-s * 1.4, y);
        ctx.lineTo(s * 1.4, y);
        for (let x = -s * 1.4 + (i % 2) * s * 0.2; x < s * 1.4; x += s * 0.4) {
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + s * 0.36);
        }
      }
      ctx.stroke();
      const sy = -((t * 0.6) % 1) * s * 3.2 + s * 0.3;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = linear(ctx, 0, sy - s * 0.3, 0, sy + s * 0.3, [[0, 'rgba(255,240,180,0)'], [0.5, 'rgba(255,240,180,0.28)'], [1, 'rgba(255,240,180,0)']]);
      ctx.fillRect(-s * 1.5, sy - s * 0.3, s * 3, s * 0.6);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,240,180,0.85)';
      ctx.lineWidth = 2;
      pyr();
      ctx.stroke();
      glow(ctx, 0, -s * 2.9, s * 0.4, '#fff0b0', 0.6 + Math.sin(t * 4) * 0.2, true);
    }
  };
})((globalThis.TD = globalThis.TD || {}));
