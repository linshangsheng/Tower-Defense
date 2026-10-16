// 第五章 · 熔岩裂隙（设计书 56.4、60.3）的怪物画法：工具函数（发光、眼睛、符文、光脉、光点……）在 creatures.js
(function (TD) {
  'use strict';

  const K = TD.creatures;
  const D = K.drawers;
  const TAU = Math.PI * 2;
  const { deep, light, rgba, bodyGrad, glow, shadow, eyes, rune, dot, wing, jelly, jellyEyes, quadruped, seeded, strokes, speckle, scales, veins, sparkles, rimEdge, linear, radial } = K;

  // ---------- 本章小工具 ----------
  // 折线轮廓（填充、clip、rimEdge 共用）
  function poly(ctx, P) {
    ctx.beginPath();
    P.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
  }

  // 往上飘、渐渐熄灭的火星（t 驱动，确定性）
  function embers(ctx, x, y, spread, rise, n, t, color, seed, size) {
    const r = seeded(seed);
    for (let i = 0; i < n; i++) {
      const off = r();
      const sp = 0.45 + r() * 0.5;
      const dx = (r() - 0.5) * 2 * spread;
      const k = (t * sp + off) % 1;
      const a = Math.max(0.05, Math.sin(k * Math.PI)) * 0.9;
      dot(ctx, x + dx + Math.sin(t * 2.5 + i * 1.7) * spread * 0.3 * k, y - k * rise, (size || 1.2) * (1 - k * 0.4), color, a);
    }
  }

  // 一把石纹颗粒：所有小圆点拼进一条路径、只填一次（岩块多，逐个填太慢）
  function grains(ctx, x, y, rx, ry, n, color, a, seed, rMin, rMax) {
    const r = seeded(seed);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const q = r() * TAU;
      const d = Math.sqrt(r());
      const px = x + Math.cos(q) * rx * d;
      const py = y + Math.sin(q) * ry * d;
      const rr = rMin + r() * (rMax - rMin);
      ctx.moveTo(px + rr, py);
      ctx.arc(px, py, rr, 0, TAU);
    }
    ctx.fillStyle = rgba(color, a);
    ctx.fill();
  }

  // 一块熔岩岩石：外圈背光、右上的斜切面受光、正面有明暗，加上石纹颗粒、细裂纹和右上轮廓光
  function rockChunk(ctx, x, y, w, h, base, seed, far) {
    const P = [[x - w, y - h * 0.6], [x - w * 0.4, y - h], [x + w * 0.8, y - h * 0.8], [x + w, y + h * 0.4], [x + w * 0.3, y + h], [x - w * 0.9, y + h * 0.7]];
    const cx = x + w * 0.1;
    const cy = y - h * 0.1;
    const I = P.map(([px, py]) => [cx + (px - x) * 0.68, cy + (py - y) * 0.68]);
    const dk = far ? 0.12 : 0;
    poly(ctx, P);
    ctx.fillStyle = deep(base, 0.8 + dk);
    ctx.fill();
    // 斜切面：右上受光、左上半亮
    poly(ctx, [P[1], P[2], P[3], I[3], I[2], I[1]]);
    ctx.fillStyle = deep(base, 0.3 + dk);
    ctx.fill();
    poly(ctx, [P[0], P[1], I[1], I[0]]);
    ctx.fillStyle = deep(base, 0.55 + dk);
    ctx.fill();
    // 正面
    poly(ctx, I);
    ctx.fillStyle = bodyGrad(ctx, x - w * 0.6, y - h * 0.7, x + w * 0.7, y + h * 0.6, base, 0.42 + dk, 0.72 + dk);
    ctx.fill();
    // 石纹：亮颗粒、暗坑、一条细裂纹，再加右上轮廓光（都只画在岩石里面，共用一次 clip）
    ctx.save();
    poly(ctx, P);
    ctx.clip();
    grains(ctx, x, y, w * 0.85, h * 0.85, 6, '#f0d0b0', 0.16, seed, 0.4, Math.max(0.9, w * 0.05));
    grains(ctx, x, y, w * 0.85, h * 0.85, 6, '#120806', 0.45, seed + 3, 0.4, Math.max(1, w * 0.06));
    const r = seeded(seed + 5);
    const sx = x + (r() - 0.5) * w;
    const sy = y - h * (0.2 + r() * 0.5);
    ctx.strokeStyle = 'rgba(14,6,4,0.6)';
    ctx.lineWidth = Math.max(0.7, w * 0.05);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (r() - 0.3) * w * 0.6, sy + h * 0.3);
    ctx.lineTo(sx + (r() - 0.5) * w * 0.7, sy + h * 0.65);
    ctx.stroke();
    // 轮廓往左下挪一点再描边，留在岩石里的只有右上那道亮边
    const e = Math.max(1, w * 0.07);
    ctx.translate(-e, e);
    poly(ctx, P);
    ctx.strokeStyle = rgba('#ffd8b0', far ? 0.25 : 0.5);
    ctx.lineWidth = e * 2;
    ctx.stroke();
    ctx.restore();
    return P;
  }

  // 一颗发光的熔岩晶体（岩岩肩上、头上）
  function crystal(ctx, x, y, len, wid, ang, a) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    glow(ctx, 0, -len * 0.5, len * 0.9, '#ff9a3a', 0.45 * a);
    ctx.fillStyle = linear(ctx, wid, -len, -wid, 0, [[0, '#ffe6a8'], [0.45, '#ff9a3a'], [1, '#6a2410']]);
    poly(ctx, [[-wid, 0], [-wid * 0.7, -len * 0.7], [0, -len], [wid * 0.8, -len * 0.65], [wid, 0]]);
    ctx.fill();
    // 晶面：中间一道亮棱
    ctx.strokeStyle = rgba('#fff2c8', 0.55 * a);
    ctx.lineWidth = Math.max(0.8, wid * 0.18);
    ctx.beginPath();
    ctx.moveTo(wid * 0.1, -len * 0.08);
    ctx.lineTo(0, -len * 0.92);
    ctx.stroke();
    ctx.restore();
  }

  // ======================================================================
  // 第五章 · 熔岩裂隙（设计书 56.4）
  // ======================================================================

  // 岩浆团：里面是流动的岩浆，外面一块块冷却的深色岩壳，壳缝里透出光；头顶冒泡、飘火星
  D.magma = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    const wob = Math.sin(t * 5 + sd) * 0.07;
    const bite = o.attack ? Math.max(0, Math.sin(t * 11)) * 0.1 : 0;
    const w = s * (1.0 + wob + bite);
    const h = s * 0.9 * (1 - wob - bite * 0.5);
    const lean = Math.sin(t * 2.5 + sd) * w * 0.08;
    const heat = 0.8 + Math.sin(t * 3 + sd) * 0.15;
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(-w * 1.05, 0);
      ctx.bezierCurveTo(-w * 1.02, -h * 0.55, -w * 0.7 + lean, -h * 1.15, -w * 0.05 + lean, -h * 1.18);
      ctx.bezierCurveTo(w * 0.62 + lean, -h * 1.15, w * 1.0, -h * 0.6, w * 1.02, 0);
      ctx.quadraticCurveTo(0, h * 0.16, -w * 1.05, 0);
      ctx.closePath();
    };
    shadow(ctx, 0, 2, s);
    glow(ctx, 0, -s * 0.4, s * 1.1, '#ff6a2a', 0.45);
    // ① 岩浆内芯
    body();
    ctx.fillStyle = radial(ctx, -w * 0.05, -h * 0.3, 0, w * 1.15, [[0, '#ffe08a'], [0.35, '#ff9a3a'], [0.75, '#d8461e'], [1, '#7a2414']]);
    ctx.fill();
    ctx.save();
    body();
    ctx.clip();
    glow(ctx, w * 0.1 + Math.sin(t * 1.7 + sd) * w * 0.25, -h * 0.5, w * 0.75, '#ffd070', 0.55 * heat, true);
    // ② 冷却的岩壳：几块不规则的深色碎壳浮在岩浆上，互相压着的地方只剩一道细缝（底下露出的岩浆更多，更烫）；壳边被烤红，右上沿受光
    const r = seeded(11);
    const shell = linear(ctx, w * 0.7, -h * 1.2, -w * 0.8, 0, [[0, '#6e4436'], [0.5, '#3e2219'], [1, '#1c0d09']]);
    const plates = [[-0.5, -0.72, 0.52, 0.4], [0.15, -0.98, 0.5, 0.3], [0.7, -0.55, 0.44, 0.4], [-0.02, -0.5, 0.38, 0.28], [-0.9, -0.26, 0.3, 0.3], [0.45, -0.18, 0.36, 0.2], [-0.4, -0.16, 0.3, 0.17]];
    ctx.lineJoin = 'round';
    for (const P of plates) {
      const cx = P[0] * w - lean * P[1];
      const cy = P[1] * h;
      const Q = [];
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU + (r() - 0.5) * 0.5;
        const f = 0.8 + r() * 0.22;
        Q.push([cx + Math.cos(a) * P[2] * w * f, cy + Math.sin(a) * P[3] * h * f]);
      }
      poly(ctx, Q);
      ctx.fillStyle = shell;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,120,50,0.5)';
      ctx.lineWidth = Math.max(0.8, s * 0.05);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,215,180,0.3)';
      ctx.lineWidth = Math.max(0.7, s * 0.035);
      ctx.beginPath();
      ctx.moveTo(Q[5][0], Q[5][1]);
      ctx.lineTo(Q[6][0], Q[6][1]);
      ctx.lineTo(Q[0][0], Q[0][1]);
      ctx.stroke();
    }
    // 岩壳上的亮颗粒
    speckle(ctx, w * 0.2, -h * 0.8, w * 0.6, h * 0.35, 6, '#ffd2a8', 0.22, 14, 0.4, 0.9);
    // 头顶的岩浆泡：慢慢鼓起，破掉
    const bk = (t * 0.6 + sd * 0.3) % 1;
    if (bk < 0.85) {
      const br = s * 0.13 * Math.sin((bk / 0.85) * Math.PI * 0.5);
      glow(ctx, w * 0.18 + lean, -h * 1.02, br * 2.2, '#ffb050', 0.6);
      ctx.fillStyle = radial(ctx, w * 0.18 + lean, -h * 1.02, 0, br, [[0, '#fff0b0'], [0.6, '#ffb050'], [1, '#e05a20']], w * 0.18 + lean + br * 0.3, -h * 1.02 - br * 0.3);
      ctx.beginPath();
      ctx.arc(w * 0.18 + lean, -h * 1.02, Math.max(0.5, br), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // 底边一圈熔化的亮边
    rune(ctx, [[-w * 0.85, -h * 0.05], [-w * 0.3, h * 0.07], [w * 0.3, h * 0.07], [w * 0.85, -h * 0.05]], '#ffb050', Math.max(1.2, s * 0.07), 0.5 * heat);
    rimEdge(ctx, body, '#ffc890', 0.5, Math.max(2, s * 0.1), 1.6, 1.6);
    // 眼睛嵌在岩壳上：先压一圈暗窝，光才看得清
    ctx.fillStyle = 'rgba(16,6,4,0.75)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.38, -h * 0.72, s * 0.29, s * 0.11, -0.15, 0, TAU);
    ctx.fill();
    eyes(ctx, -s * 0.38, -h * 0.72, s * 0.3, s * 0.08, '#ffd27a', -0.15);
    // 火星
    embers(ctx, s * 0.1, -h * 1.05, s * 0.35, s * 0.9, 3, t, '#ffb050', 21 + sd, 1.1);
    if (bk >= 0.85) sparkles(ctx, w * 0.18 + lean, -h * 1.1, s * 0.15, s * 0.1, 3, t * 3, '#ffd070', 5, 0.9);
  };

  // 熔岩傀儡：一块块凿出来的石头拼成的人形，石缝里透出岩浆的光，胸口一颗熔岩核心
  D.lavaGolem = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    const step = Math.sin(t * 4 + sd);
    const pulse = 0.75 + Math.sin(t * 3 + sd) * 0.2;
    const base = '#6a4a40';
    shadow(ctx, 0, 2, s);
    glow(ctx, 0, -s * 1.1, s * 0.9, '#ff6a2a', 0.5);
    // 关节处的岩浆光：先画，岩块盖上后只从缝里透出来
    for (const [jx, jy, jr] of [[0, -0.6, 0.45], [-0.55, -1.3, 0.24], [0.55, -1.3, 0.24], [-0.05, -1.5, 0.26]]) glow(ctx, s * jx, s * jy, s * jr, '#ff7a2a', 0.9 * pulse, true);
    const sw = step * 2;
    rockChunk(ctx, s * 0.25 - sw, -s * 0.3, s * 0.22, s * 0.3, base, 3, true);
    rockChunk(ctx, -s * 0.25 + sw, -s * 0.3, s * 0.22, s * 0.3, base, 4);
    rockChunk(ctx, s * 0.6, -s * 1.05 + step * 1.5, s * 0.2, s * 0.35, base, 5, true);
    const T = rockChunk(ctx, 0, -s * 1.05, s * 0.55, s * 0.5, base, 1);
    // 胸口：分叉的岩浆缝 + 跳动的核心
    ctx.save();
    poly(ctx, T);
    ctx.clip();
    const cx = -s * 0.05;
    const cy = -s * 1.05;
    for (const [a, sv, d] of [[-2.55, 1, 2], [-0.55, 2, 2], [1.65, 3, 1]]) veins(ctx, cx, cy, s * 0.26, a, d, '#ff8a3a', 0.75 + pulse * 0.25, sv, Math.max(1.4, s * 0.06));
    glow(ctx, cx, cy, s * 0.32, '#ffb050', pulse, true);
    ctx.restore();
    dot(ctx, cx, cy, s * 0.05, '#ffe0a0', 0.9);
    rockChunk(ctx, -s * 0.65, -s * 1.0 - step * 1.5, s * 0.2, s * 0.4, base, 6);
    veins(ctx, -s * 0.62, -s * 1.22 - step * 1.5, s * 0.22, 1.75, 1, '#ff8a3a', 0.6 * pulse, 7, Math.max(1, s * 0.045));
    // 头：压低的眉骨下一对光眼
    rockChunk(ctx, -s * 0.05, -s * 1.75, s * 0.3, s * 0.28, base, 2);
    ctx.fillStyle = 'rgba(12,5,3,0.7)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.13, -s * 1.77, s * 0.2, s * 0.075, 0, 0, TAU);
    ctx.fill();
    eyes(ctx, -s * 0.13, -s * 1.78, s * 0.2, s * 0.05, '#ffc04a', 0);
    embers(ctx, 0, -s * 1.35, s * 0.5, s * 0.95, 3, t, '#ffb050', 9 + sd, 1.0);
  };

  // 火焰小恶魔：半透光的蝙蝠翅膀（有翅骨和翅脉）、桃心尖尾巴，身上有发光的火纹，手里托着一团火
  D.imp = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    const fl = Math.sin(t * 5 + sd) * s * 0.1;
    ctx.save();
    ctx.globalAlpha = 0.5;
    shadow(ctx, 0, 34, s * 0.7);
    ctx.restore();
    ctx.translate(0, -s * 1.0 + fl);
    const base = '#c03a3a';
    const flap = Math.sin(t * 14);
    // 翅膀：远的一只更暗；后缘是一段段弧（翅骨之间的膜）
    for (const [cxk, tipk, far] of [[0.7, 0.9, true], [-0.1, 0.8, false]]) {
      const A = [s * 0.1, -s * 0.22];
      const Tp = [s * tipk, -s * 0.7 - flap * s * 0.3];
      const F1 = [s * 0.72, -s * 0.36 - flap * s * 0.1];
      const F2 = [s * 0.52, -s * 0.14];
      const mid = (p, q) => [(p[0] + q[0]) / 2 + (A[0] - (p[0] + q[0]) / 2) * 0.2, (p[1] + q[1]) / 2 + (A[1] - (p[1] + q[1]) / 2) * 0.2];
      const m1 = mid(Tp, F1);
      const m2 = mid(F1, F2);
      ctx.beginPath();
      ctx.moveTo(A[0], A[1]);
      ctx.quadraticCurveTo(s * cxk, -s * 0.9 - flap * s * 0.3, Tp[0], Tp[1]);
      ctx.quadraticCurveTo(m1[0], m1[1], F1[0], F1[1]);
      ctx.quadraticCurveTo(m2[0], m2[1], F2[0], F2[1]);
      ctx.lineTo(A[0], A[1]);
      ctx.closePath();
      ctx.fillStyle = linear(ctx, A[0], A[1], Tp[0], Tp[1], far ? [[0, deep(base, 0.85)], [1, 'rgba(120,40,36,0.8)']] : [[0, deep(base, 0.6)], [1, 'rgba(225,90,60,0.72)']]);
      ctx.fill();
      // 翅骨 + 透光的翅脉
      ctx.strokeStyle = deep(base, far ? 0.88 : 0.72);
      ctx.lineWidth = Math.max(0.8, s * 0.06);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(A[0], A[1]);
      ctx.quadraticCurveTo(s * cxk, -s * 0.9 - flap * s * 0.3, Tp[0], Tp[1]);
      ctx.moveTo(A[0], A[1]);
      ctx.lineTo(F1[0], F1[1]);
      ctx.stroke();
      if (!far) {
        rune(ctx, [A, [(A[0] + m1[0]) / 2, (A[1] + m1[1]) / 2 - s * 0.03], m1], '#ff9a5a', 0.8, 0.35);
        rune(ctx, [A, m2], '#ff9a5a', 0.8, 0.3);
        // 前缘受光
        ctx.strokeStyle = 'rgba(255,190,150,0.45)';
        ctx.lineWidth = Math.max(0.7, s * 0.035);
        ctx.beginPath();
        ctx.moveTo(A[0] + s * 0.05, A[1] - s * 0.06);
        ctx.quadraticCurveTo(s * cxk, -s * 0.94 - flap * s * 0.3, Tp[0], Tp[1] - s * 0.02);
        ctx.stroke();
      }
    }
    // 尾巴：细长、末端一片发光的桃心尖
    const tx = s * 0.9;
    const ty = s * 0.3 + Math.sin(t * 6 + sd) * s * 0.1;
    ctx.strokeStyle = deep(base, 0.6);
    ctx.lineWidth = Math.max(1, s * 0.08);
    ctx.beginPath();
    ctx.moveTo(s * 0.15, s * 0.22);
    ctx.quadraticCurveTo(s * 0.6, s * 0.65, tx, ty);
    ctx.stroke();
    glow(ctx, tx + s * 0.04, ty - s * 0.03, s * 0.2, '#ff8a3a', 0.6);
    ctx.fillStyle = '#ff8a4a';
    poly(ctx, [[tx - s * 0.03, ty + s * 0.02], [tx + s * 0.06, ty - s * 0.14], [tx + s * 0.16, ty - s * 0.02], [tx + s * 0.05, ty + s * 0.02]]);
    ctx.fill();
    // 两条小短腿
    for (const [lx, far] of [[s * 0.12, true], [-s * 0.04, false]]) {
      ctx.strokeStyle = deep(base, far ? 0.82 : 0.62);
      ctx.lineWidth = s * 0.09;
      ctx.beginPath();
      ctx.moveTo(lx, s * 0.22);
      ctx.quadraticCurveTo(lx + s * 0.07, s * 0.4, lx - s * 0.02 + Math.sin(t * 5 + sd + lx) * s * 0.03, s * 0.52);
      ctx.stroke();
    }
    // 身体：浅色的肚皮、暗斑、胸口一枚火苗形的发光纹
    const torso = () => {
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.3, s * 0.38, 0.2, 0, TAU);
    };
    torso();
    ctx.fillStyle = bodyGrad(ctx, -s * 0.4, -s * 0.5, s * 0.35, s * 0.4, base, 0.22, 0.75);
    ctx.fill();
    ctx.save();
    torso();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,150,90,0.28)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.1, s * 0.08, s * 0.15, s * 0.24, 0.2, 0, TAU);
    ctx.fill();
    speckle(ctx, s * 0.08, -s * 0.05, s * 0.2, s * 0.28, 5, '#3a0e0e', 0.45, 31, 0.5, 1.1);
    ctx.restore();
    rune(ctx, [[-s * 0.06, s * 0.06], [-s * 0.12, -s * 0.06], [-s * 0.04, -s * 0.02], [-s * 0.02, -s * 0.16]], '#ffb050', Math.max(0.8, s * 0.05), 0.55 + Math.sin(t * 6) * 0.2);
    rimEdge(ctx, torso, '#ffb8a0', 0.5, Math.max(1.5, s * 0.1), 1.2, 1.2);
    // 托着火球的小手
    ctx.strokeStyle = deep(base, 0.5);
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.moveTo(-s * 0.12, -s * 0.18);
    ctx.quadraticCurveTo(-s * 0.3, -s * 0.2, -s * 0.4, s * 0.06);
    ctx.stroke();
    // 头：尖耳朵、弯弯的角
    ctx.fillStyle = deep(base, 0.5);
    poly(ctx, [[s * 0.06, -s * 0.58], [s * 0.34, -s * 0.68], [s * 0.1, -s * 0.44]]);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,130,90,0.35)';
    poly(ctx, [[s * 0.1, -s * 0.56], [s * 0.27, -s * 0.64], [s * 0.12, -s * 0.49]]);
    ctx.fill();
    const head = () => {
      ctx.beginPath();
      ctx.ellipse(-s * 0.1, -s * 0.5, s * 0.25, s * 0.22, 0, 0, TAU);
    };
    head();
    ctx.fillStyle = bodyGrad(ctx, -s * 0.35, -s * 0.72, s * 0.15, -s * 0.28, base, 0.18, 0.7);
    ctx.fill();
    for (const [bx, tipx, tipy] of [[-s * 0.2, -s * 0.34, -s * 0.92], [s * 0.0, -s * 0.02, -s * 0.96]]) {
      ctx.fillStyle = linear(ctx, bx, -s * 0.66, tipx, tipy, [[0, '#3a1610'], [1, '#f0b88a']]);
      ctx.beginPath();
      ctx.moveTo(bx - s * 0.06, -s * 0.66);
      ctx.quadraticCurveTo(bx - s * 0.08, -s * 0.84, tipx, tipy);
      ctx.quadraticCurveTo(bx + s * 0.02, -s * 0.8, bx + s * 0.07, -s * 0.68);
      ctx.closePath();
      ctx.fill();
    }
    rimEdge(ctx, head, '#ffc0a8', 0.55, Math.max(1.5, s * 0.1), 1.2, 1.2);
    // 额头的小火纹、调皮的笑
    dot(ctx, -s * 0.14, -s * 0.64, Math.max(0.6, s * 0.035), '#ffb050', 0.8);
    eyes(ctx, -s * 0.18, -s * 0.52, s * 0.14, s * 0.045, '#ffe07a', -0.1);
    ctx.strokeStyle = 'rgba(255,200,140,0.6)';
    ctx.lineWidth = Math.max(0.6, s * 0.035);
    ctx.beginPath();
    ctx.arc(-s * 0.22, -s * 0.47, s * 0.07, 0.5, 2.3);
    ctx.stroke();
    // 手里的火球：外焰往后飘的水滴形 + 白热的芯 + 小火星
    const fx = -s * 0.5;
    const fy = -s * 0.05;
    const fire = 0.7 + Math.sin(t * 10) * 0.2;
    const fk = Math.sin(t * 13 + sd) * s * 0.04;
    glow(ctx, fx, fy, s * 0.5, '#ff9a3a', fire * 0.8);
    const flame = (k) => {
      ctx.beginPath();
      ctx.moveTo(fx - s * 0.14 * k, fy);
      ctx.quadraticCurveTo(fx - s * 0.14 * k, fy - s * 0.16 * k, fx + s * 0.08 * k + fk, fy - s * 0.34 * k);
      ctx.quadraticCurveTo(fx + s * 0.16 * k, fy - s * 0.12 * k, fx + s * 0.13 * k, fy);
      ctx.quadraticCurveTo(fx, fy + s * 0.17 * k, fx - s * 0.14 * k, fy);
      ctx.closePath();
    };
    flame(1);
    ctx.fillStyle = 'rgba(255,110,40,0.85)';
    ctx.fill();
    flame(0.6);
    ctx.fillStyle = '#ffd060';
    ctx.fill();
    glow(ctx, fx, fy, s * 0.3, '#ffe0a0', fire, true);
    sparkles(ctx, fx + s * 0.05, fy - s * 0.15, s * 0.22, s * 0.16, 3, t * 2, '#ffb050', 5 + sd, 0.7);
  };

  // 暗影刺客：兜帽下只露出一双紫光眼；绑腿、腰带、身后翻飞的衣摆和长围巾；两把发光的弯刀；脚下拖着暗影烟
  D.assassin = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    const ph = t * 10 + sd;
    const step = Math.sin(ph);
    shadow(ctx, 0, 2, s * 0.7);
    const base = '#2a2a3a';
    const glowC = '#d08aff';
    // 脚下往身后飘散的暗影烟
    for (let i = 0; i < 4; i++) {
      const k = (t * 1.6 + i / 4 + sd * 0.1) % 1;
      ctx.fillStyle = 'rgba(70,36,100,' + (0.3 * (1 - k)).toFixed(3) + ')';
      ctx.beginPath();
      ctx.ellipse(s * (0.15 + k * 0.9), -s * (0.1 + k * 0.35 + (i % 2) * 0.08), s * (0.1 + k * 0.18), s * (0.07 + k * 0.1), 0, 0, TAU);
      ctx.fill();
    }
    // 身后翻飞的衣摆
    const fl = Math.sin(t * 9 + sd) * s * 0.06;
    ctx.fillStyle = deep(base, 0.45);
    poly(ctx, [[s * 0.05, -s * 1.15], [s * 0.52, -s * 0.9 + fl], [s * 0.4, -s * 0.8 + fl], [s * 0.34, -s * 0.86 + fl * 0.5], [s * 0.26, -s * 0.72 + fl * 0.6], [s * 0.02, -s * 0.86]]);
    ctx.fill();
    // 腿：大步奔跑，大腿粗、小腿细，小腿缠着浅色绑带
    for (const [p, far] of [[1, true], [-1, false]]) {
      const kx = step * p * s * 0.3 + s * 0.05;
      const fx = step * p * s * 0.45;
      const col = deep(base, far ? 0.6 : 0.3);
      ctx.strokeStyle = col;
      ctx.lineCap = 'round';
      ctx.lineWidth = s * 0.14;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.85);
      ctx.lineTo(kx, -s * 0.45);
      ctx.stroke();
      ctx.lineWidth = s * 0.1;
      ctx.beginPath();
      ctx.moveTo(kx, -s * 0.45);
      ctx.lineTo(fx, -s * 0.05);
      ctx.stroke();
      ctx.strokeStyle = far ? 'rgba(120,100,150,0.3)' : 'rgba(170,140,210,0.5)';
      ctx.lineWidth = Math.max(0.6, s * 0.035);
      ctx.beginPath();
      for (const u of [0.35, 0.6]) {
        const wx = kx + (fx - kx) * u;
        const wy = -s * 0.45 + s * 0.4 * u;
        ctx.moveTo(wx - s * 0.06, wy - s * 0.02);
        ctx.lineTo(wx + s * 0.06, wy + s * 0.03);
      }
      ctx.stroke();
      // 尖头软靴
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(fx - s * 0.06, -s * 0.03, s * 0.11, s * 0.05, 0.1, 0, TAU);
      ctx.fill();
    }
    // 远侧的手臂（在身体后面）
    ctx.strokeStyle = deep(base, 0.55);
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.moveTo(s * 0.05, -s * 1.5);
    ctx.quadraticCurveTo(s * 0.32, -s * 1.3, s * 0.3, -s * 1.0);
    ctx.stroke();
    // 前倾的身体：明暗、衣褶、斜挎的带子、腰带上一颗紫光扣
    const torso = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.15, -s * 0.85);
      ctx.quadraticCurveTo(-s * 0.4, -s * 1.4, -s * 0.25, -s * 1.7);
      ctx.lineTo(s * 0.15, -s * 1.65);
      ctx.quadraticCurveTo(s * 0.2, -s * 1.2, s * 0.15, -s * 0.85);
      ctx.closePath();
    };
    torso();
    ctx.fillStyle = linear(ctx, s * 0.2, -s * 1.7, -s * 0.3, -s * 0.85, [[0, light(base, 0.12)], [0.5, deep(base, 0.2)], [1, deep(base, 0.55)]]);
    ctx.fill();
    ctx.save();
    torso();
    ctx.clip();
    ctx.strokeStyle = 'rgba(8,6,14,0.55)';
    ctx.lineWidth = Math.max(0.7, s * 0.04);
    ctx.beginPath();
    ctx.moveTo(-s * 0.05, -s * 1.6);
    ctx.quadraticCurveTo(-s * 0.2, -s * 1.3, -s * 0.08, -s * 1.0);
    ctx.moveTo(s * 0.08, -s * 1.55);
    ctx.quadraticCurveTo(s * 0.0, -s * 1.3, s * 0.08, -s * 1.05);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(150,130,180,0.4)';
    ctx.lineWidth = Math.max(0.8, s * 0.05);
    ctx.beginPath();
    ctx.moveTo(s * 0.12, -s * 1.62);
    ctx.lineTo(-s * 0.3, -s * 1.05);
    ctx.stroke();
    ctx.fillStyle = 'rgba(12,10,20,0.9)';
    ctx.fillRect(-s * 0.4, -s * 1.0, s * 0.6, s * 0.08);
    ctx.restore();
    dot(ctx, -s * 0.12, -s * 0.96, Math.max(0.7, s * 0.04), glowC, 0.85);
    rimEdge(ctx, torso, '#c8b0ff', 0.35, Math.max(1.5, s * 0.1), 1.2, 1.2);
    // 飘在身后的长围巾：从脖子左边绕过来，一条波浪形的带子，末端有两道浅色条纹和一点光
    const N = 10;
    const top = [];
    const bot = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const x = -s * 0.3 + u * s * 1.47;
      const y = -s * 1.6 - u * s * 0.02 + Math.sin(t * 7 - u * 5 + sd) * s * 0.11 * u;
      const hw = s * (0.08 - u * 0.035);
      top.push([x, y - hw]);
      bot.push([x, y + hw]);
    }
    poly(ctx, top.concat(bot.slice().reverse()));
    ctx.fillStyle = linear(ctx, -s * 0.3, 0, s * 1.2, 0, [[0, 'rgba(170,70,210,0.95)'], [1, 'rgba(130,50,180,0.55)']]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(240,200,255,0.5)';
    ctx.lineWidth = Math.max(0.8, s * 0.05);
    ctx.beginPath();
    for (const i of [7, 8]) {
      ctx.moveTo(top[i][0], top[i][1]);
      ctx.lineTo(bot[i][0], bot[i][1]);
    }
    ctx.stroke();
    rune(ctx, top.slice(0, 7), '#e0b0ff', Math.max(0.7, s * 0.035), 0.45);
    dot(ctx, (top[N][0] + bot[N][0]) / 2, (top[N][1] + bot[N][1]) / 2, Math.max(0.7, s * 0.04), glowC, 0.7);
    // 兜帽：尖尖的帽尾往后飘，里面黑黑的，只露出一双光眼
    const hs = Math.sin(t * 7 + sd) * s * 0.04;
    const hood = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.4, -s * 1.8);
      ctx.quadraticCurveTo(-s * 0.36, -s * 2.08, -s * 0.12, -s * 2.08);
      ctx.quadraticCurveTo(s * 0.12, -s * 2.07, s * 0.2, -s * 1.94);
      ctx.quadraticCurveTo(s * 0.3, -s * 1.88 + hs, s * 0.44, -s * 1.8 + hs);
      ctx.quadraticCurveTo(s * 0.22, -s * 1.78, s * 0.1, -s * 1.64);
      ctx.lineTo(-s * 0.3, -s * 1.64);
      ctx.closePath();
    };
    hood();
    ctx.fillStyle = linear(ctx, s * 0.2, -s * 2.08, -s * 0.3, -s * 1.64, [[0, light(base, 0.15)], [1, deep(base, 0.45)]]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(8,6,14,0.5)';
    ctx.lineWidth = Math.max(0.7, s * 0.035);
    ctx.beginPath();
    ctx.moveTo(-s * 0.02, -s * 2.05);
    ctx.quadraticCurveTo(s * 0.06, -s * 1.85, s * 0.02, -s * 1.68);
    ctx.stroke();
    rimEdge(ctx, hood, '#c8b0ff', 0.35, Math.max(1.5, s * 0.1), 1.2, 1.2);
    ctx.fillStyle = '#06050c';
    ctx.beginPath();
    ctx.ellipse(-s * 0.25, -s * 1.84, s * 0.13, s * 0.12, 0, 0, TAU);
    ctx.fill();
    eyes(ctx, -s * 0.26, -s * 1.86, s * 0.14, s * 0.045, glowC, -0.1);
    // 近侧的手臂 + 两把弯刀（刀刃发光，前面那把挥出一道弧光）
    ctx.strokeStyle = deep(base, 0.25);
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.moveTo(-s * 0.12, -s * 1.52);
    ctx.quadraticCurveTo(-s * 0.4, -s * 1.42, -s * 0.55, -s * 1.1);
    ctx.stroke();
    for (const [dx, dy, front] of [[-0.55, -1.1, true], [0.3, -1.0, false]]) {
      const hx = s * dx;
      const hy = s * dy;
      const bx = s * (dx - 0.3);
      const by = s * (dy - 0.15);
      if (front) {
        ctx.strokeStyle = 'rgba(208,138,255,0.22)';
        ctx.lineWidth = Math.max(1.2, s * 0.08);
        ctx.beginPath();
        ctx.arc(hx, hy, s * 0.34, Math.PI * 1.15 + step * 0.2, Math.PI * 1.55 + step * 0.2);
        ctx.stroke();
      }
      ctx.fillStyle = linear(ctx, hx, hy, bx, by, [[0, '#8a80a8'], [1, '#f4ecff']]);
      ctx.beginPath();
      ctx.moveTo(hx, hy - s * 0.03);
      ctx.quadraticCurveTo((hx + bx) / 2, (hy + by) / 2 - s * 0.08, bx, by);
      ctx.quadraticCurveTo((hx + bx) / 2, (hy + by) / 2 + s * 0.02, hx, hy + s * 0.03);
      ctx.closePath();
      ctx.fill();
      rune(ctx, [[hx - s * 0.05, hy - s * 0.04], [(hx + bx) / 2, (hy + by) / 2 - s * 0.055], [bx, by]], glowC, Math.max(0.7, s * 0.03), 0.6);
      ctx.strokeStyle = '#1a1626';
      ctx.lineWidth = Math.max(1, s * 0.05);
      ctx.beginPath();
      ctx.moveTo(hx - s * 0.02, hy - s * 0.07);
      ctx.lineTo(hx + s * 0.02, hy + s * 0.07);
      ctx.stroke();
      ctx.fillStyle = deep(base, front ? 0.15 : 0.5);
      ctx.beginPath();
      ctx.arc(hx + s * 0.03, hy, s * 0.05, 0, TAU);
      ctx.fill();
      glow(ctx, bx, by, s * 0.18, glowC, 0.6);
    }
  };

  // 骷髅战车：木板拼的车身包着铁箍、骨头栏杆、铁箍木轮；小骷髅车夫围着飘带，车头挑着一盏鬼火灯
  D.chariot = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    const spin = -t * 10 - sd;
    const bump = Math.abs(Math.sin(t * 14 + sd)) * s * 0.03;
    const wood = '#6a4a30';
    const bone = '#e6e1d2';
    shadow(ctx, 0, 2, s * 1.2);
    // 车轮后扬起的尘土
    for (let i = 0; i < 3; i++) {
      const k = (t * 2.2 + i / 3 + sd * 0.1) % 1;
      ctx.fillStyle = 'rgba(150,110,80,' + (0.26 * (1 - k)).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(s * (0.8 + k * 0.7), -s * (0.08 + k * 0.25), s * (0.1 + k * 0.18), 0, TAU);
      ctx.fill();
    }
    // 骨头：骨干 + 两头的圆疙瘩 + 受光的亮线
    const boneLine = (x0, y0, x1, y1, bw) => {
      const len = Math.hypot(x1 - x0, y1 - y0) || 1;
      const nx = (-(y1 - y0) / len) * bw * 0.45;
      const ny = ((x1 - x0) / len) * bw * 0.45;
      ctx.strokeStyle = deep(bone, 0.22);
      ctx.fillStyle = deep(bone, 0.22);
      ctx.lineWidth = bw;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.beginPath();
      for (const [ex, ey] of [[x0, y0], [x1, y1]]) {
        for (const sg of [1, -1]) {
          ctx.moveTo(ex + nx * sg + bw * 0.55, ey + ny * sg);
          ctx.arc(ex + nx * sg, ey + ny * sg, bw * 0.55, 0, TAU);
        }
      }
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,252,240,0.7)';
      ctx.lineWidth = Math.max(0.6, bw * 0.3);
      ctx.beginPath();
      ctx.moveTo(x0 + bw * 0.2, y0 - bw * 0.2);
      ctx.lineTo(x1 + bw * 0.2, y1 - bw * 0.2);
      ctx.stroke();
    };
    ctx.save();
    ctx.translate(0, -bump);
    // 骨头栏杆（在车夫和车身后面）
    for (let i = 0; i < 4; i++) boneLine(-s * 0.5 + i * s * 0.38, -s * 0.9, -s * 0.45 + i * s * 0.38, -s * 1.13, Math.max(1.2, s * 0.08));
    boneLine(-s * 0.52, -s * 1.13, s * 0.7, -s * 1.17, Math.max(1, s * 0.06));
    // 小骷髅车夫：深色斗篷、往后飘的飘带、拉着缰绳的手
    const wave = Math.sin(t * 9 + sd);
    ctx.fillStyle = 'rgba(90,130,110,0.85)';
    ctx.beginPath();
    ctx.moveTo(s * 0.32, -s * 1.22);
    ctx.quadraticCurveTo(s * 0.6, -s * 1.3 + wave * s * 0.05, s * 0.88, -s * 1.22 - wave * s * 0.08);
    ctx.lineTo(s * 0.8, -s * 1.12 - wave * s * 0.06);
    ctx.quadraticCurveTo(s * 0.6, -s * 1.16 + wave * s * 0.04, s * 0.32, -s * 1.12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = linear(ctx, s * 0.45, -s * 1.25, s * 0.05, -s * 0.9, [[0, '#4a4658'], [1, '#18161f']]);
    poly(ctx, [[s * 0.08, -s * 0.9], [s * 0.14, -s * 1.2], [s * 0.38, -s * 1.22], [s * 0.45, -s * 0.9]]);
    ctx.fill();
    ctx.strokeStyle = deep(bone, 0.3);
    ctx.lineWidth = Math.max(1, s * 0.06);
    ctx.beginPath();
    ctx.moveTo(s * 0.16, -s * 1.15);
    ctx.lineTo(-s * 0.05, -s * 1.02);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(60,40,30,0.8)';
    ctx.lineWidth = Math.max(0.6, s * 0.025);
    ctx.beginPath();
    ctx.moveTo(-s * 0.05, -s * 1.02);
    ctx.quadraticCurveTo(-s * 0.5, -s * 0.98, -s * 0.86, -s * 1.22);
    ctx.stroke();
    // 骷髅头：受光的骨色、下颌、一排小牙、两个眼窝里的绿光
    const skull = () => {
      ctx.beginPath();
      ctx.ellipse(s * 0.25, -s * 1.38, s * 0.22, s * 0.2, 0, 0, TAU);
    };
    ctx.fillStyle = radial(ctx, s * 0.25, -s * 1.38, 0, s * 0.24, [[0, '#f4f0e4'], [0.6, '#cfc8b6'], [1, '#8a826f']], s * 0.32, -s * 1.47);
    ctx.beginPath();
    ctx.ellipse(s * 0.18, -s * 1.22, s * 0.13, s * 0.08, 0, 0, TAU);
    ctx.fill();
    skull();
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,50,40,0.55)';
    ctx.lineWidth = Math.max(0.5, s * 0.02);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      ctx.moveTo(s * (0.1 + i * 0.06), -s * 1.24);
      ctx.lineTo(s * (0.1 + i * 0.06), -s * 1.17);
    }
    ctx.moveTo(s * 0.34, -s * 1.56);
    ctx.lineTo(s * 0.3, -s * 1.5);
    ctx.lineTo(s * 0.34, -s * 1.45);
    ctx.stroke();
    rimEdge(ctx, skull, '#ffffff', 0.5, Math.max(1.2, s * 0.08), 1, 1);
    ctx.fillStyle = '#0a0a10';
    for (const ex of [0.12, 0.25]) {
      ctx.beginPath();
      ctx.ellipse(s * ex, -s * 1.38, s * 0.065, s * 0.07, 0, 0, TAU);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(s * 0.15, -s * 1.3);
    ctx.lineTo(s * 0.12, -s * 1.26);
    ctx.lineTo(s * 0.18, -s * 1.26);
    ctx.fill();
    eyes(ctx, s * 0.185, -s * 1.38, s * 0.13, s * 0.035, '#7affc0', 0);
    // 车身：木板、木纹、三道铁箍和铆钉
    const cart = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 1.0, -s * 0.55);
      ctx.lineTo(s * 0.9, -s * 0.6);
      ctx.lineTo(s * 0.8, -s * 0.95);
      ctx.lineTo(-s * 0.7, -s * 0.85);
      ctx.closePath();
    };
    cart();
    ctx.fillStyle = bodyGrad(ctx, -s, -s * 1.0, s, -s * 0.3, wood, 0.25, 0.8);
    ctx.fill();
    ctx.save();
    cart();
    ctx.clip();
    strokes(ctx, -s * 0.05, -s * 0.74, s * 0.9, s * 0.17, 16, '#e0b080', 0.2, 31, 0, s * 0.3);
    ctx.strokeStyle = 'rgba(20,10,6,0.65)';
    ctx.lineWidth = Math.max(0.7, s * 0.035);
    ctx.beginPath();
    for (const k of [0.36, 0.68]) {
      ctx.moveTo(-s * 1.0, -s * 0.85 + k * s * 0.3 - s * 0.02);
      ctx.lineTo(s * 0.9, -s * 0.95 + k * s * 0.35);
    }
    ctx.stroke();
    for (const bx of [-0.72, -0.05, 0.6]) {
      ctx.fillStyle = linear(ctx, s * (bx - 0.05), 0, s * (bx + 0.05), 0, [[0, '#2a2a32'], [0.6, '#8a8a98'], [1, '#3a3a44']]);
      ctx.fillRect(s * (bx - 0.05), -s * 1.0, s * 0.1, s * 0.5);
      ctx.fillStyle = '#d8d8e0';
      for (const ry of [-0.86, -0.64]) {
        ctx.beginPath();
        ctx.arc(s * (bx + 0.005), s * ry, Math.max(0.6, s * 0.025), 0, TAU);
        ctx.fill();
      }
    }
    // 车身下沿压暗
    ctx.fillStyle = linear(ctx, 0, -s * 0.72, 0, -s * 0.55, [[0, 'rgba(10,6,4,0)'], [1, 'rgba(10,6,4,0.55)']]);
    ctx.fillRect(-s * 1.1, -s * 0.75, s * 2.1, s * 0.25);
    ctx.restore();
    rimEdge(ctx, cart, '#ffd8a8', 0.55, Math.max(2, s * 0.1), 1.5, 1.5);
    // 车头的挑杆 + 摇晃的鬼火灯笼
    const swing = Math.sin(t * 6 + sd) * 0.18;
    ctx.strokeStyle = '#3a2a1e';
    ctx.lineWidth = Math.max(1.2, s * 0.06);
    ctx.beginPath();
    ctx.moveTo(-s * 0.66, -s * 0.86);
    ctx.lineTo(-s * 0.86, -s * 1.26);
    ctx.lineTo(-s * 1.05, -s * 1.28);
    ctx.stroke();
    const lx = -s * 1.05 + Math.sin(swing) * s * 0.3;
    const ly = -s * 1.28 + Math.cos(swing) * s * 0.32;
    ctx.strokeStyle = 'rgba(160,160,170,0.8)';
    ctx.lineWidth = Math.max(0.6, s * 0.025);
    ctx.beginPath();
    ctx.moveTo(-s * 1.05, -s * 1.28);
    ctx.lineTo(lx, ly - s * 0.1);
    ctx.stroke();
    const flick = 0.8 + Math.sin(t * 9) * 0.15;
    glow(ctx, lx, ly, s * 0.6, '#7affc0', flick, true);
    // 灯罩里透出的绿光
    ctx.fillStyle = radial(ctx, lx, ly, 0, s * 0.14, [[0, 'rgba(130,240,190,0.95)'], [1, 'rgba(30,110,80,0.85)']]);
    ctx.fillRect(lx - s * 0.1, ly - s * 0.1, s * 0.2, s * 0.2);
    ctx.fillStyle = '#ecfff6';
    ctx.beginPath();
    ctx.moveTo(lx, ly - s * 0.09 - Math.sin(t * 17) * s * 0.02);
    ctx.quadraticCurveTo(lx + s * 0.07, ly + s * 0.02, lx, ly + s * 0.07);
    ctx.quadraticCurveTo(lx - s * 0.07, ly + s * 0.02, lx, ly - s * 0.09);
    ctx.fill();
    glow(ctx, lx, ly, s * 0.2, '#c8ffe8', flick, true);
    ctx.strokeStyle = '#22222a';
    ctx.lineWidth = Math.max(0.8, s * 0.035);
    ctx.strokeRect(lx - s * 0.1, ly - s * 0.1, s * 0.2, s * 0.2);
    ctx.beginPath();
    ctx.moveTo(lx, ly - s * 0.1);
    ctx.lineTo(lx, ly + s * 0.1);
    ctx.stroke();
    ctx.fillStyle = '#22222a';
    poly(ctx, [[lx - s * 0.13, ly - s * 0.1], [lx, ly - s * 0.18], [lx + s * 0.13, ly - s * 0.1]]);
    ctx.fill();
    ctx.restore();
    sparkles(ctx, lx + s * 0.25, ly, s * 0.3, s * 0.15, 3, t * 2, '#7affc0', 13 + sd, 0.8);
    // 轮子：木轮 + 铁箍（右上一道亮边）+ 骨头辐条 + 金属轮毂，下面一道速度弧
    for (const wx of [s * 0.55, -s * 0.6]) {
      const wy = -s * 0.32;
      const R = s * 0.3;
      ctx.strokeStyle = 'rgba(255,240,220,0.18)';
      ctx.lineWidth = Math.max(1, s * 0.05);
      ctx.beginPath();
      ctx.arc(wx, wy, R * 1.15, 0.2, 1.5);
      ctx.stroke();
      ctx.fillStyle = radial(ctx, wx, wy, 0, R, [[0, deep(wood, 0.35)], [1, deep(wood, 0.75)]]);
      ctx.beginPath();
      ctx.arc(wx, wy, R, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#44444e';
      ctx.lineWidth = R * 0.18;
      ctx.beginPath();
      ctx.arc(wx, wy, R * 0.9, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(225,230,240,0.6)';
      ctx.lineWidth = Math.max(0.7, R * 0.07);
      ctx.beginPath();
      ctx.arc(wx, wy, R * 0.95, -1.9, 0.2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(230,225,210,0.8)';
      ctx.lineWidth = Math.max(1, R * 0.1);
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = spin + (k * Math.PI) / 3;
        ctx.moveTo(wx + Math.cos(a) * R * 0.2, wy + Math.sin(a) * R * 0.2);
        ctx.lineTo(wx + Math.cos(a) * R * 0.78, wy + Math.sin(a) * R * 0.78);
      }
      ctx.stroke();
      ctx.fillStyle = radial(ctx, wx, wy, 0, R * 0.22, [[0, '#d8d8e0'], [1, '#4a4a54']], wx + R * 0.06, wy - R * 0.06);
      ctx.beginPath();
      ctx.arc(wx, wy, R * 0.22, 0, TAU);
      ctx.fill();
    }
  };

  // 墨墨的分身 / 本体：一团孤单的墨色小精灵。多层半透明的墨，里面有慢慢转的墨纹和星点，
  // 触须越来越细、末端一点紫光；脚下一圈墨晕；会眨眼。boss 头顶多一根卷卷的墨芽，身边飘着光点
  function inkSpirit(ctx, s, t, o, scale, angry, boss) {
    const sd = o.seed || 0;
    const ph = t * 3 + sd;
    const r = s * scale;
    const glowC = angry ? '#ff8ad0' : '#b08aff';
    const br = 1 + Math.sin(t * 2 + sd) * 0.03;
    // 脚下的墨晕（边缘化开），一圈圈慢慢往外扩
    ctx.save();
    ctx.scale(1, 0.16);
    ctx.fillStyle = radial(ctx, 0, 0, 0, r * 0.85, [[0, 'rgba(40,20,70,0.5)'], [0.6, 'rgba(40,20,70,0.32)'], [1, 'rgba(40,20,70,0)']]);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.85, 0, TAU);
    ctx.fill();
    ctx.restore();
    const rk = (t * 0.5 + sd * 0.2) % 1;
    ctx.strokeStyle = rgba(glowC, 0.35 * (1 - rk));
    ctx.lineWidth = Math.max(0.8, r * 0.025);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * (0.6 + rk * 0.55), r * (0.09 + rk * 0.08), 0, 0, TAU);
    ctx.stroke();
    // 往下垂、越来越细的墨须
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * 0.15 + (i / 5) * Math.PI * 0.7;
      const len = r * (0.5 + Math.sin(ph + i) * 0.15);
      const x0 = Math.cos(a) * r * 0.6;
      const y0 = -r * 0.6 + Math.sin(a) * r * 0.5;
      const qx = Math.cos(a) * r * 0.9 + Math.sin(ph + i) * r * 0.15;
      const qy = -r * 0.3 + Math.sin(a) * r * 0.6;
      const x1 = Math.cos(a) * r * 0.75;
      const y1 = -r * 0.02 + len * 0.1;
      ctx.strokeStyle = 'rgba(30,20,50,0.9)';
      ctx.lineCap = 'round';
      let px = x0;
      let py = y0;
      for (let k = 1; k <= 5; k++) {
        const u = k / 5;
        const nx = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * qx + u * u * x1;
        const ny = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * qy + u * u * y1;
        ctx.lineWidth = r * 0.14 * (1.1 - u * 0.7);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        px = nx;
        py = ny;
      }
      dot(ctx, x1, y1, Math.max(0.7, r * 0.028), glowC, 0.5 + 0.3 * Math.sin(ph * 1.3 + i));
    }
    const body = (k) => {
      ctx.beginPath();
      ctx.moveTo(-r * 0.8 * k, -r * 0.2);
      ctx.bezierCurveTo(-r * 0.95 * k, -r * 1.2 * k * br, r * 0.9 * k, -r * 1.35 * k * br, r * 0.82 * k, -r * 0.25);
      ctx.quadraticCurveTo(0, r * 0.05, -r * 0.8 * k, -r * 0.2);
      ctx.closePath();
    };
    // 边缘渐隐的墨雾（两层）
    body(1.14);
    ctx.fillStyle = 'rgba(60,36,110,0.1)';
    ctx.fill();
    body(1.06);
    ctx.fillStyle = 'rgba(40,24,80,0.18)';
    ctx.fill();
    // 主体
    body(1);
    ctx.fillStyle = radial(ctx, 0, -r * 0.65, r * 0.1, r, [[0, angry ? '#6a3a7a' : '#4a3a6a'], [0.6, '#1e1630'], [1, '#0a0614']], r * 0.25, -r * 1.0);
    ctx.fill();
    ctx.save();
    body(1);
    ctx.clip();
    // 里面慢慢飘动的光雾
    glow(ctx, r * 0.15 + Math.sin(t * 0.8 + sd) * r * 0.25, -r * 0.72, r * 0.55, angry ? '#c04a9a' : '#7a4ad0', 0.4);
    // 慢慢转的墨纹（三个小漩涡）
    ctx.strokeStyle = angry ? 'rgba(255,170,230,0.22)' : 'rgba(190,160,255,0.22)';
    ctx.lineWidth = Math.max(0.8, r * 0.03);
    ctx.lineCap = 'round';
    for (const [sx, sy, dir, sz] of [[-0.45, -0.5, 1, 1], [0.35, -0.75, -1, 0.85], [0.05, -0.35, 1, 0.7]]) {
      const rot = t * 0.5 * dir + sx * 3;
      ctx.beginPath();
      for (let k = 0; k <= 14; k++) {
        const q = (k / 14) * Math.PI * 2.6;
        const rr = r * (0.03 + q * 0.04) * sz;
        const px = r * sx + Math.cos(q * dir + rot) * rr;
        const py = r * sy + Math.sin(q * dir + rot) * rr * 0.75;
        if (k) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    // 星星点点（像夜空）
    speckle(ctx, r * 0.05, -r * 0.62, r * 0.68, r * 0.36, boss ? 10 : 6, '#e8d8ff', 0.75, 17, Math.max(0.4, r * 0.012), Math.max(0.8, r * 0.025), 0.3);
    sparkles(ctx, r * 0.05, -r * 0.6, r * 0.45, r * 0.25, boss ? 3 : 2, t * 0.6, '#d8c0ff', 19 + sd, Math.max(0.6, r * 0.022));
    // 下半身压暗
    ctx.fillStyle = linear(ctx, 0, -r * 0.45, 0, r * 0.05, [[0, 'rgba(5,2,12,0)'], [1, 'rgba(5,2,12,0.55)']]);
    ctx.fillRect(-r, -r * 0.5, r * 2, r * 0.6);
    // 裂隙狂暴：身上裂开发光的粉紫色纹路
    if (angry) for (const [a, sv] of [[-2.2, 1], [-0.6, 2], [2.6, 3]]) veins(ctx, r * 0.05, -r * 0.55, r * 0.35, a, 2, '#ff8ad0', 0.7, sv, Math.max(1, r * 0.035));
    // 墨的光泽：右上一道弧形高光 + 一个小亮点
    ctx.strokeStyle = 'rgba(235,220,255,0.4)';
    ctx.lineWidth = Math.max(1.2, r * 0.05);
    ctx.beginPath();
    ctx.arc(r * 0.12, -r * 0.6, r * 0.48, -1.25, -0.5);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(r * 0.5, -r * 0.93, Math.max(0.6, r * 0.03), 0, TAU);
    ctx.fill();
    ctx.restore();
    rimEdge(ctx, () => body(1), '#c8a8ff', 0.5, Math.max(2, r * 0.07), r * 0.035, r * 0.035);
    // 紫色的流光：沿着头顶流过，一颗亮珠顺着它跑
    const flow = [];
    for (let k = 0; k <= 8; k++) {
      const u = k / 8;
      flow.push([-r * 0.5 + u * r, -r * 0.9 - Math.sin(u * Math.PI) * r * 0.12 + Math.sin(u * 9 + t * 2) * r * 0.025]);
    }
    rune(ctx, flow, glowC, Math.max(1.2, r * 0.035), 0.5);
    const bi = Math.floor(((t * 0.35 + sd * 0.1) % 1) * 8);
    dot(ctx, flow[bi][0], flow[bi][1], Math.max(0.8, r * 0.03), glowC, 0.8);
    // 身侧的卷云纹
    const curl = [];
    for (let k = 0; k <= 10; k++) {
      const q = (k / 10) * Math.PI * 1.8;
      curl.push([r * 0.45 + Math.cos(q + 1) * r * (0.04 + q * 0.025), -r * 0.5 + Math.sin(q + 1) * r * (0.04 + q * 0.025)]);
    }
    rune(ctx, curl, glowC, Math.max(1, r * 0.025), 0.4);
    // 眼睛：圆一点、带高光，偶尔眨一下
    const blink = (t * 0.23 + sd * 0.37) % 1 < 0.035 ? 0.15 : 1;
    const ex = -r * 0.2;
    const ey = -r * 0.7;
    eyes(ctx, ex, ey, r * 0.32, r * 0.07, angry ? '#ff8ad0' : '#d0a8ff', -0.1, blink * (boss ? 1.5 : 1.25));
    if (blink > 0.5) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (const dx of [-r * 0.16, r * 0.16]) {
        ctx.beginPath();
        ctx.arc(ex + dx + r * 0.025, ey - r * 0.02, Math.max(0.5, r * 0.016), 0, TAU);
        ctx.fill();
      }
    }
    // 头顶卷卷的墨芽，尖上一颗光珠
    if (boss) {
      const sw = Math.sin(t * 2.2 + sd) * r * 0.05;
      const tipX = r * 0.2 + sw;
      const tipY = -r * 1.22;
      ctx.strokeStyle = '#1e1630';
      ctx.lineCap = 'round';
      ctx.lineWidth = r * 0.07;
      ctx.beginPath();
      ctx.moveTo(-r * 0.02, -r * 0.98 * br);
      ctx.quadraticCurveTo(r * 0.0, -r * 1.16, tipX, tipY);
      ctx.stroke();
      ctx.lineWidth = r * 0.045;
      ctx.beginPath();
      ctx.arc(tipX + r * 0.06, tipY + r * 0.01, r * 0.06, Math.PI, Math.PI * 2.6);
      ctx.stroke();
      ctx.strokeStyle = rgba('#c8a8ff', 0.5);
      ctx.lineWidth = Math.max(0.8, r * 0.018);
      ctx.beginPath();
      ctx.moveTo(r * 0.02, -r * 1.0 * br);
      ctx.quadraticCurveTo(r * 0.04, -r * 1.15, tipX + r * 0.02, tipY - r * 0.01);
      ctx.stroke();
      dot(ctx, tipX + r * 0.06, tipY + r * 0.04, Math.max(1, r * 0.035), glowC, 0.9);
      sparkles(ctx, 0, -r * 0.65, r * 0.92, r * 0.5, 5, t, glowC, 23, Math.max(1, r * 0.03));
    }
  }
  D.inkClone = function (ctx, s, t, o) {
    shadow(ctx, 0, 2, s * 0.9);
    inkSpirit(ctx, s, t, o, 1.0, false, false);
  };
  D.inkBoss = function (ctx, s, t, o) {
    const ai = o.ai || {};
    const big = ai.big ? 1.55 : 1;
    const warn = ai.mode === 'warn';
    shadow(ctx, 0, 2, s * big);
    if (warn) ctx.translate(Math.sin(t * 50) * 2, 0);
    glow(ctx, 0, -s * 0.8 * big, s * 1.4 * big, '#7a4ab8', 0.35 + (ai.phase >= 4 ? 0.25 : 0));
    inkSpirit(ctx, s, t, o, 1.15 * big, warn || ai.phase >= 4, true);
    // 蓄力重击：一圈圈光往身体里收
    if (warn) {
      const r = s * 1.15 * big;
      for (let i = 0; i < 2; i++) {
        const k = (t * 1.5 + i * 0.5) % 1;
        ctx.strokeStyle = rgba('#ff8ad0', 0.5 * k);
        ctx.lineWidth = Math.max(1.5, r * 0.04);
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.6, r * (1.22 - k * 0.65), r * (0.85 - k * 0.45), 0, 0, TAU);
        ctx.stroke();
      }
    }
  };

  // 岩岩：熔岩核心的巨大岩石傀儡。凿出来的岩块、肩上和头顶长着发光的熔岩晶体、拳头往下滴岩浆；
  // 要跺脚时全身的裂缝亮起来，脚下的地面也裂开透光
  D.rockGolem = function (ctx, s, t, o) {
    const ai = o.ai || {};
    const warn = ai.warn > 0;
    const sd = o.seed || 0;
    const step = Math.sin(t * 2.5 + sd);
    const base = '#7a5a4a';
    shadow(ctx, 0, 2, s * 1.3);
    ctx.save();
    if (warn) ctx.translate(Math.sin(t * 60) * 3, 0);
    const core = warn ? 1 : 0.55 + Math.sin(t * 3) * 0.15;
    const a = 0.6 + core * 0.4;
    if (warn) {
      ctx.save();
      ctx.scale(1, 0.32);
      for (const [x, ang, sv] of [[-s * 0.45, Math.PI * 0.92, 1], [s * 0.4, 0.1, 2], [-s * 0.1, Math.PI * 0.55, 3]]) veins(ctx, x, 0, s * 0.45, ang, 2, '#ff8a3a', 0.8 + Math.sin(t * 20) * 0.2, sv, Math.max(2, s * 0.06));
      ctx.restore();
    }
    glow(ctx, 0, -s * 1.2, s * 1.3, '#ff6a2a', core * 0.6);
    // 关节缝里的岩浆光
    for (const [jx, jy, jr] of [[-0.4, -0.72, 0.36], [0.4, -0.72, 0.36], [-0.85, -1.5, 0.3], [0.8, -1.5, 0.3], [-0.1, -1.78, 0.32], [-1.0, -1.0, 0.22], [1.0, -1.0, 0.22]]) glow(ctx, s * jx, s * jy, s * jr, '#ff7a2a', 0.55 + core * 0.45, true);
    const sw = step * 2;
    rockChunk(ctx, s * 0.4 - sw, -s * 0.35, s * 0.3, s * 0.35, base, 3, true);
    rockChunk(ctx, -s * 0.4 + sw, -s * 0.35, s * 0.3, s * 0.35, base, 4);
    // 远侧手臂：上臂 + 拳头
    rockChunk(ctx, s * 0.95, -s * 1.32 + step, s * 0.28, s * 0.36, base, 5, true);
    rockChunk(ctx, s * 1.0, -s * 0.82 + step * 1.5, s * 0.3, s * 0.26, base, 6, true);
    // 身体 + 胸口的熔岩核心和放射状的岩浆缝
    const T = rockChunk(ctx, 0, -s * 1.2, s * 0.85, s * 0.65, base, 1);
    const cx = -s * 0.05;
    const cy = -s * 1.25;
    ctx.save();
    poly(ctx, T);
    ctx.clip();
    for (const [ang, sv, l] of [[-2.63, 1, 0.34], [-0.5, 2, 0.36], [1.25, 3, 0.3], [2.9, 4, 0.22], [0.25, 5, 0.22]]) veins(ctx, cx, cy, s * l, ang, 2, warn ? '#ffb040' : '#ff8a3a', a, sv, Math.max(2, s * 0.055));
    ctx.restore();
    ctx.strokeStyle = 'rgba(20,8,4,0.8)';
    ctx.lineWidth = Math.max(2, s * 0.05);
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.17, 0, TAU);
    ctx.stroke();
    glow(ctx, cx, cy, s * 0.5, '#ffb050', core, true);
    ctx.fillStyle = radial(ctx, cx, cy, 0, s * 0.15, [[0, '#fff6d0'], [0.5, '#ffc050'], [1, '#e0601e']], cx + s * 0.04, cy - s * 0.04);
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.15, 0, TAU);
    ctx.fill();
    // 近侧手臂：上臂 + 拳头，拳头往下滴岩浆
    rockChunk(ctx, -s * 1.0, -s * 1.28 - step, s * 0.3, s * 0.38, base, 7);
    rockChunk(ctx, -s * 1.05, -s * 0.78 - step * 1.5, s * 0.32, s * 0.27, base, 8);
    veins(ctx, -s * 0.98, -s * 1.5 - step, s * 0.28, 1.6, 2, '#ff8a3a', a * 0.8, 9, Math.max(1.5, s * 0.045));
    const dk = (t * 0.9 + sd * 0.2) % 1;
    dot(ctx, -s * 1.08, -s * 0.52 - step * 1.5 + dk * s * 0.45, Math.max(1, s * 0.035), '#ffb050', Math.max(0.05, 1 - dk));
    // 头：眉骨压下来的阴影 + 一对光眼
    rockChunk(ctx, -s * 0.1, -s * 2.05, s * 0.4, s * 0.35, base, 2);
    ctx.fillStyle = 'rgba(12,5,3,0.7)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.2, -s * 2.07, s * 0.26, s * 0.085, 0, 0, TAU);
    ctx.fill();
    eyes(ctx, -s * 0.2, -s * 2.08, s * 0.25, s * 0.07, warn ? '#ff7a3a' : '#ffc04a', 0);
    // 发光的熔岩晶体：两肩 + 头顶（像一顶小王冠）
    const ca = warn ? 1 : 0.7 + Math.sin(t * 2 + sd) * 0.15;
    for (const [x, y, l, w, ang] of [[-s * 1.02, -s * 1.62, s * 0.3, s * 0.08, -0.35], [-s * 0.82, -s * 1.6, s * 0.2, s * 0.06, 0.15], [s * 0.85, -s * 1.6, s * 0.26, s * 0.07, 0.3], [s * 1.02, -s * 1.55, s * 0.17, s * 0.055, 0.7], [-s * 0.02, -s * 2.36, s * 0.2, s * 0.06, 0.25], [s * 0.12, -s * 2.3, s * 0.13, s * 0.045, 0.7]]) crystal(ctx, x, y, l, w, ang, ca);
    embers(ctx, 0, -s * 1.6, s * 0.9, s * 1.1, 6, t, '#ffb050', 41 + sd, Math.max(1.2, s * 0.03));
    ctx.restore();
  };
})((globalThis.TD = globalThis.TD || {}));
