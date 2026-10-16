// 第七章 · 珊瑚海湾（设计书 56.4）的怪物画法：工具函数（发光、眼睛、符文、胶质、四足……）在 creatures.js
(function (TD) {
  'use strict';

  const K = TD.creatures;
  const D = K.drawers;
  const TAU = Math.PI * 2;
  const { deep, light, rgba, bodyGrad, glow, shadow, eyes, rune, dot, wing, jelly, jellyEyes, quadruped, seeded, strokes, speckle, scales, veins, sparkles, rimEdge, linear, radial } = K;

  // ======================================================================
  // 第七章 · 珊瑚海湾（设计书 56.4、60.3）
  // ======================================================================

  // 偶尔眨一下眼：返回睁眼程度
  function blink(t, sd) {
    return (t * 0.45 + sd * 0.37) % 1 < 0.05 ? 0.15 : 1;
  }

  // 圆圆的发光眼睛：一圈光晕、浅色眼珠、往左看的小瞳孔、右上一点白高光
  function orbEye(ctx, x, y, r, color, open) {
    glow(ctx, x, y, r * 3.2, color, 0.55);
    ctx.fillStyle = light(color, 0.6);
    ctx.beginPath();
    ctx.ellipse(x, y, r, Math.max(0.5, r * open), 0, 0, TAU);
    ctx.fill();
    if (open < 0.5) return;
    ctx.fillStyle = deep(color, 0.75);
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y + r * 0.08, r * 0.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x + r * 0.2, y - r * 0.35, Math.max(0.5, r * 0.3), 0, TAU);
    ctx.fill();
  }

  // 气泡：淡淡的一圈边、右上一点高光
  function bubble(ctx, x, y, r, a) {
    ctx.fillStyle = rgba('#c8f0ff', 0.12 * a);
    ctx.strokeStyle = rgba('#c8f0ff', 0.75 * a);
    ctx.lineWidth = Math.max(0.8, r * 0.18);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = rgba('#ffffff', 0.9 * a);
    ctx.beginPath();
    ctx.arc(x + r * 0.35, y - r * 0.38, Math.max(0.6, r * 0.24), 0, TAU);
    ctx.fill();
  }

  // 三次贝塞尔上取 n 段的点；steps > 0 时尖端再卷一小圈（curl：每步转的角度，负 = 往上 / 逆时针卷）
  function curvePts(p0, p1, p2, p3, n, curl, steps, step) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const m = 1 - k;
      const f = [m * m * m, 3 * m * m * k, 3 * m * k * k, k * k * k];
      pts.push([f[0] * p0[0] + f[1] * p1[0] + f[2] * p2[0] + f[3] * p3[0], f[0] * p0[1] + f[1] * p1[1] + f[2] * p2[1] + f[3] * p3[1]]);
    }
    let [x, y] = pts[n];
    let a = Math.atan2(p3[1] - p2[1], p3[0] - p2[0]);
    let l = step;
    for (let i = 0; i < steps; i++) {
      a += curl;
      l *= 0.8;
      x += Math.cos(a) * l;
      y += Math.sin(a) * l;
      pts.push([x, y]);
    }
    return pts;
  }

  // 沿中线做一根由粗到细的管子（触手、尾巴）：ex 越大越早变细；返回画轮廓的函数和每个点的 [法线 x, 法线 y, 半宽]
  function tube(ctx, pts, w0, w1, ex) {
    const n = pts.length;
    const A = [];
    const B = [];
    const N = [];
    for (let i = 0; i < n; i++) {
      const p = pts[Math.max(0, i - 1)];
      const q = pts[Math.min(n - 1, i + 1)];
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      const nx = -(q[1] - p[1]) / d;
      const ny = (q[0] - p[0]) / d;
      const w = (w1 + (w0 - w1) * Math.pow(1 - i / (n - 1), ex || 0.9)) / 2;
      A.push([pts[i][0] + nx * w, pts[i][1] + ny * w]);
      B.push([pts[i][0] - nx * w, pts[i][1] - ny * w]);
      N.push([nx, ny, w]);
    }
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(A[0][0], A[0][1]);
      for (let i = 1; i < n; i++) ctx.lineTo(A[i][0], A[i][1]);
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(B[i][0], B[i][1]);
      ctx.closePath();
    };
    return { path, N };
  }

  // 一排吸盘：浅粉色的小圆环，中间是柔和的粉色（不画成深色的洞）；list = [[x, y, r, 朝向角]]
  function suckers(ctx, list) {
    for (const [fill, k, ky] of [['#ffd6ea', 1, 0.7], ['#d877aa', 0.55, 0.38]]) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      for (const [x, y, r, a] of list) {
        ctx.moveTo(x + Math.cos(a) * r * k, y + Math.sin(a) * r * k);
        ctx.ellipse(x, y, r * k, r * ky, a, 0, TAU);
      }
      ctx.fill();
    }
  }

  // 半透明的鳍：根部窄、外缘宽，几根鳍条，外缘发亮；ang 是鳍的朝向（0 = 向上）
  function finFan(ctx, x, y, len, wid, ang, color, a) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    const tip = [wid * 0.1, -len];
    const end = [wid, -len * 0.4];
    ctx.fillStyle = linear(ctx, 0, 0, wid * 0.4, -len, [[0, rgba(color, a * 0.2)], [1, rgba(color, a * 0.6)]]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-wid * 0.12, -len * 0.6, tip[0], tip[1]);
    ctx.quadraticCurveTo(wid * 0.95, -len * 0.92, end[0], end[1]);
    ctx.quadraticCurveTo(wid * 0.45, -len * 0.12, 0, 0);
    ctx.fill();
    // 鳍条：从根部散开到外缘
    ctx.strokeStyle = rgba('#ffffff', a * 0.45);
    ctx.lineWidth = Math.max(0.6, len * 0.025);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const k = i / 4;
      ctx.moveTo(0, 0);
      ctx.lineTo(tip[0] + (end[0] - tip[0]) * k + wid * 0.15 * Math.sin(k * Math.PI), tip[1] + (end[1] - tip[1]) * k - len * 0.08 * Math.sin(k * Math.PI));
    }
    ctx.stroke();
    // 外缘一道光
    ctx.strokeStyle = rgba(color, a * 0.8);
    ctx.lineWidth = Math.max(0.8, len * 0.035);
    ctx.beginPath();
    ctx.moveTo(tip[0], tip[1]);
    ctx.quadraticCurveTo(wid * 0.95, -len * 0.92, end[0], end[1]);
    ctx.stroke();
    ctx.restore();
  }

  // 螺旋贝壳：一圈圈内切的螺层，越往里越小、绕着转；每层右上受光、左下暗，螺层间有缝线和亮边，外层有花纹和生长纹
  function spiralShell(ctx, x, y, r, base, band) {
    let cx = x;
    let cy = y;
    let rr = r;
    let a = -0.45;
    for (let i = 0; i < 4; i++) {
      if (i) {
        const nr = rr * 0.64;
        cx += Math.cos(a) * (rr - nr);
        cy += Math.sin(a) * (rr - nr) * 0.9;
        rr = nr;
        a -= 1.75;
      }
      const path = () => {
        ctx.beginPath();
        ctx.ellipse(cx, cy, rr, rr * 0.9, 0, 0, TAU);
      };
      path();
      ctx.fillStyle = radial(ctx, cx, cy, 0, rr, [[0, light(base, 0.55)], [0.55, base], [1, deep(base, 0.42)]], cx + rr * 0.35, cy - rr * 0.4);
      ctx.fill();
      if (i < 2) {
        ctx.save();
        path();
        ctx.clip();
        // 生长纹：从里往外的细弧线
        ctx.strokeStyle = rgba('#8a6038', 0.28);
        ctx.lineWidth = Math.max(0.6, rr * 0.03);
        ctx.beginPath();
        for (let k = 0; k < 11; k++) {
          const q = k * 0.57 + i;
          const c = Math.cos(q);
          const sn = Math.sin(q);
          ctx.moveTo(cx + c * rr * 0.5, cy + sn * rr * 0.45);
          ctx.quadraticCurveTo(cx + (c * 0.8 - sn * 0.12) * rr, cy + (sn * 0.8 + c * 0.12) * rr * 0.9, cx + c * rr, cy + sn * rr * 0.9);
        }
        ctx.stroke();
        // 一圈断断续续的花纹
        ctx.setLineDash([rr * 0.16, rr * 0.12]);
        ctx.strokeStyle = rgba(band, 0.5);
        ctx.lineWidth = rr * 0.09;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rr * 0.76, rr * 0.68, 0, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      if (i) {
        // 螺层之间的缝线
        path();
        ctx.strokeStyle = rgba('#6a4028', 0.45);
        ctx.lineWidth = Math.max(0.7, rr * 0.07);
        ctx.stroke();
      }
      rimEdge(ctx, path, '#fffaf0', 0.7, Math.max(1, rr * 0.12), rr * 0.07, rr * 0.07);
    }
    // 螺心一点柔光
    glow(ctx, cx, cy, rr * 2.2, '#ffe8c8', 0.5);
    dot(ctx, cx, cy, Math.max(0.7, rr * 0.3), '#fff4e0', 0.8);
  }

  // 寄居蟹：细长的腿、一对大钳子（能开合）、柄上的圆眼睛和一对触须；背着发光的螺旋壳，壳口透出暖光；缩壳时只剩壳和壳口里的一对眼睛
  D.hermitCrab = function (ctx, s, t, o) {
    const hide = !!o.shellIn;
    const sd = o.seed || 0;
    const ph = t * 10 + sd;
    shadow(ctx, 0, 2, s * 0.85);
    const base = '#d85a3a';
    const sr = s * (hide ? 0.68 : 0.62);
    const sx = s * 0.2 + (hide ? Math.sin(t * 30) * 1.5 : 0);
    const sy = -s * 0.62;
    // 腿：三条一组，远侧暗、近侧亮；每条两节，上沿受光，脚尖浅色
    const legs = (far) => {
      const P = [];
      for (let i = 0; i < 3; i++) {
        const lx = -s * (far ? 0.48 : 0.55) + i * s * 0.2;
        const sw = Math.sin(ph + i * 2 + (far ? 1.6 : 0)) * s * 0.08;
        P.push([lx, -s * 0.32, lx - s * 0.17 + sw * 0.5, -s * 0.27, lx - s * 0.24 + sw, -s * 0.02]);
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = deep(base, far ? 0.72 : 0.42);
      ctx.lineWidth = s * 0.075;
      ctx.beginPath();
      for (const p of P) {
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(p[2], p[3]);
        ctx.lineTo(p[4], p[5]);
      }
      ctx.stroke();
      if (far) return;
      ctx.strokeStyle = rgba('#ffb08a', 0.6);
      ctx.lineWidth = s * 0.025;
      ctx.beginPath();
      for (const p of P) {
        ctx.moveTo(p[0] + s * 0.01, p[1] - s * 0.025);
        ctx.lineTo(p[2] + s * 0.01, p[3] - s * 0.025);
        ctx.lineTo(p[2] + (p[4] - p[2]) * 0.6 + s * 0.02, p[3] + (p[5] - p[3]) * 0.6);
      }
      ctx.stroke();
      ctx.strokeStyle = '#ffd8c4';
      ctx.lineWidth = s * 0.045;
      ctx.beginPath();
      for (const p of P) {
        ctx.moveTo(p[2] + (p[4] - p[2]) * 0.8, p[3] + (p[5] - p[3]) * 0.8);
        ctx.lineTo(p[4], p[5]);
      }
      ctx.stroke();
    };
    if (!hide) legs(true);
    spiralShell(ctx, sx, sy, sr, '#e8c8a0', '#c86a48');
    // 壳口：一圈珍珠色的唇，里面透出暖光
    const ax = sx - sr * 0.56;
    const ay = sy + sr * 0.32;
    ctx.fillStyle = radial(ctx, ax, ay, 0, sr * 0.38, hide ? [[0, '#9a4a38'], [0.7, '#d07858'], [1, '#ffc8a0']] : [[0, '#fff0d8'], [0.5, '#ffb48a'], [1, '#d06a4a']]);
    ctx.beginPath();
    ctx.ellipse(ax, ay, sr * 0.36, sr * 0.26, -0.6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba('#fff4e8', 0.85);
    ctx.lineWidth = Math.max(1, sr * 0.07);
    ctx.stroke();
    glow(ctx, ax, ay, sr * 0.75, '#ffe0c0', hide ? 0.35 : 0.5);
    if (hide) {
      // 大钳子挡在壳口，一对眼睛从缝里偷看
      ctx.fillStyle = radial(ctx, ax, ay + sr * 0.12, 0, sr * 0.3, [[0, '#ff9070'], [1, deep(base, 0.35)]], ax + sr * 0.1, ay);
      ctx.beginPath();
      ctx.ellipse(ax - sr * 0.02, ay + sr * 0.12, sr * 0.3, sr * 0.13, -0.45, 0, TAU);
      ctx.fill();
      const op = blink(t, sd);
      orbEye(ctx, ax - sr * 0.15, ay - sr * 0.06, s * 0.045, '#ffe0c0', op);
      orbEye(ctx, ax + sr * 0.07, ay - sr * 0.13, s * 0.045, '#ffe0c0', op);
      return;
    }
    legs(false);
    // 身体（头胸甲）：右上受光，表面一粒粒小疙瘩、一道分节的沟
    const bp = () => {
      ctx.beginPath();
      ctx.ellipse(-s * 0.4, -s * 0.42, s * 0.38, s * 0.24, -0.1, 0, TAU);
    };
    bp();
    ctx.fillStyle = radial(ctx, -s * 0.4, -s * 0.42, 0, s * 0.4, [[0, light(base, 0.3)], [0.5, deep(base, 0.1)], [1, deep(base, 0.6)]], -s * 0.28, -s * 0.56);
    ctx.fill();
    ctx.save();
    bp();
    ctx.clip();
    ctx.strokeStyle = rgba('#5a1a10', 0.35);
    ctx.lineWidth = Math.max(0.7, s * 0.025);
    ctx.beginPath();
    ctx.arc(-s * 0.32, -s * 0.2, s * 0.28, -2.3, -1.0);
    ctx.stroke();
    speckle(ctx, -s * 0.4, -s * 0.48, s * 0.28, s * 0.12, 7, '#ffc8a8', 0.5, 3, s * 0.018, s * 0.032);
    ctx.restore();
    rimEdge(ctx, bp, '#ffd8c0', 0.65, s * 0.06, s * 0.035, s * 0.035);
    // 一对钳子：远侧暗、近侧大一点；攻击时上指一开一合
    const snap = o.attack ? Math.abs(Math.sin(t * 10)) * 0.3 : 0;
    for (const [cy, far] of [[-0.6, true], [-0.32, false]]) {
      ctx.strokeStyle = deep(base, far ? 0.65 : 0.38);
      ctx.lineWidth = s * 0.08;
      ctx.beginPath();
      ctx.moveTo(-s * 0.6, -s * 0.45);
      ctx.quadraticCurveTo(-s * 0.72, s * (cy + 0.02), -s * 0.76, s * cy);
      ctx.stroke();
      ctx.save();
      ctx.translate(-s * 0.82, s * cy);
      ctx.rotate(-snap * 0.5);
      ctx.scale(far ? 0.85 : 1.12, far ? 0.85 : 1.12);
      const g = radial(ctx, -s * 0.05, 0, 0, s * 0.3, [[0, light(base, far ? 0 : 0.3)], [0.55, deep(base, far ? 0.4 : 0.1)], [1, deep(base, far ? 0.72 : 0.5)]], s * 0.02, -s * 0.07);
      // 下指（不动）
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-s * 0.08, s * 0.01);
      ctx.quadraticCurveTo(-s * 0.2, s * 0.09, -s * 0.29, s * 0.03);
      ctx.quadraticCurveTo(-s * 0.18, s * 0.035, -s * 0.06, s * 0.06);
      ctx.fill();
      // 上指（会开合）
      ctx.save();
      ctx.translate(-s * 0.08, -s * 0.02);
      ctx.rotate(0.12 + snap);
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.03);
      ctx.quadraticCurveTo(-s * 0.14, -s * 0.08, -s * 0.23, 0);
      ctx.quadraticCurveTo(-s * 0.12, -s * 0.005, 0, s * 0.03);
      ctx.fill();
      ctx.fillStyle = rgba('#ffe4d4', 0.85);
      ctx.beginPath();
      ctx.arc(-s * 0.2, -s * 0.012, s * 0.022, 0, TAU);
      ctx.fill();
      ctx.restore();
      // 钳掌
      const cp = () => {
        ctx.beginPath();
        ctx.ellipse(s * 0.01, s * 0.005, s * 0.13, s * 0.095, -0.15, 0, TAU);
      };
      cp();
      ctx.fillStyle = g;
      ctx.fill();
      ctx.fillStyle = rgba('#ffd0b8', far ? 0.25 : 0.55);
      ctx.beginPath();
      for (const [dx, dy] of [[0.02, -0.04], [0.07, -0.01], [-0.04, -0.03]]) {
        ctx.moveTo(s * (dx + 0.016), s * dy);
        ctx.arc(s * dx, s * dy, s * 0.016, 0, TAU);
      }
      ctx.fill();
      if (!far) rimEdge(ctx, cp, '#ffe0cc', 0.7, s * 0.05, s * 0.03, s * 0.03);
      ctx.restore();
    }
    // 一对细触须，轻轻摆
    const fl = Math.sin(t * 5 + sd);
    ctx.strokeStyle = rgba('#ffc8a8', 0.6);
    ctx.lineWidth = Math.max(0.6, s * 0.014);
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, -s * 0.52);
    ctx.quadraticCurveTo(-s * 1.0, -s * 0.5, -s * 1.02 + fl * s * 0.04, -s * 0.8);
    ctx.moveTo(-s * 0.68, -s * 0.56);
    ctx.quadraticCurveTo(-s * 0.92, -s * 0.66, -s * 0.86 - fl * s * 0.04, -s * 0.95);
    ctx.stroke();
    // 眼柄上的圆眼睛，跟着轻轻晃
    const ew = Math.sin(t * 3 + sd) * s * 0.025;
    ctx.strokeStyle = deep(base, 0.4);
    ctx.lineWidth = s * 0.045;
    ctx.beginPath();
    for (const ex of [-0.55, -0.4]) {
      ctx.moveTo(s * ex, -s * 0.58);
      ctx.lineTo(s * ex - s * 0.04 + ew, -s * 0.86);
    }
    ctx.stroke();
    const op = blink(t, sd);
    for (const ex of [-0.55, -0.4]) orbEye(ctx, s * ex - s * 0.04 + ew, -s * 0.9, s * 0.055, '#ffe0c0', op);
  };

  // 盾龟：拱起的龟壳上一块块甲片（生长纹、甲缝、裙边一排小缘甲），甲片边缘的六边形纹路发光；长脖子、带鳞的脚和摇摇的小尾巴
  D.turtle = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    const step = Math.sin(t * 4 + sd);
    shadow(ctx, 0, 2, s * 1.05);
    const base = '#3a8a5a';
    const skin = '#6ab87a';
    // 小尾巴
    ctx.save();
    ctx.translate(s * 0.78, -s * 0.3);
    ctx.rotate(Math.sin(t * 6 + sd) * 0.25);
    ctx.fillStyle = deep(skin, 0.45);
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.06);
    ctx.quadraticCurveTo(s * 0.12, -s * 0.05, s * 0.2, s * 0.03);
    ctx.quadraticCurveTo(s * 0.08, s * 0.06, 0, s * 0.06);
    ctx.fill();
    ctx.restore();
    // 四只脚：远侧暗、近侧亮；近侧的脚上有小鳞，脚尖三颗浅色的爪
    for (const [fx, ph, far] of [[-0.2, -1, true], [0.6, -1, true], [-0.55, 1, false], [0.25, 1, false]]) {
      const x = s * fx + step * ph * 2;
      const fp = () => {
        ctx.beginPath();
        ctx.ellipse(x, -s * 0.12, s * 0.16, s * 0.13, 0, 0, TAU);
      };
      fp();
      ctx.fillStyle = radial(ctx, x, -s * 0.12, 0, s * 0.17, [[0, deep(skin, far ? 0.4 : 0.02)], [1, deep(skin, far ? 0.75 : 0.5)]], x + s * 0.06, -s * 0.19);
      ctx.fill();
      if (!far) {
        ctx.save();
        fp();
        ctx.clip();
        scales(ctx, x - s * 0.16, -s * 0.24, x + s * 0.16, -s * 0.02, s * 0.075, '#d8ffd8', 0.35);
        ctx.restore();
        rimEdge(ctx, fp, '#e0ffe0', 0.5, s * 0.04, s * 0.025, s * 0.025);
      }
      ctx.fillStyle = rgba('#f0f0d0', far ? 0.35 : 0.85);
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const cx = x - s * 0.12 + k * s * 0.045;
        ctx.moveTo(cx + s * 0.022, -s * 0.02);
        ctx.ellipse(cx, -s * 0.02, s * 0.022, s * 0.016, 0, 0, TAU);
      }
      ctx.fill();
    }
    // 长脖子：几道褶皱
    const neck = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.6, -s * 0.38);
      ctx.quadraticCurveTo(-s * 0.8, -s * 0.56 + step, -s * 0.98, -s * 0.56 + step);
      ctx.lineTo(-s * 0.98, -s * 0.36 + step);
      ctx.quadraticCurveTo(-s * 0.82, -s * 0.3, -s * 0.6, -s * 0.2);
      ctx.closePath();
    };
    neck();
    ctx.fillStyle = bodyGrad(ctx, -s * 1.0, -s * 0.6, -s * 0.6, -s * 0.2, skin, 0.25, 0.65);
    ctx.fill();
    ctx.strokeStyle = rgba('#0a2a18', 0.35);
    ctx.lineWidth = Math.max(0.7, s * 0.02);
    ctx.beginPath();
    for (const nx of [-0.68, -0.77, -0.86]) {
      ctx.moveTo(s * nx, -s * 0.48 + step * 0.6);
      ctx.quadraticCurveTo(s * nx + s * 0.04, -s * 0.38 + step * 0.4, s * nx + s * 0.01, -s * 0.28);
    }
    ctx.stroke();
    // 头：圆圆的，头顶几片小鳞，鼻尖微微上翘，带一点笑
    const hx = -s * 1.03;
    const hy = -s * 0.47 + step;
    const head = () => {
      ctx.beginPath();
      ctx.ellipse(hx, hy, s * 0.16, s * 0.13, -0.2, 0, TAU);
    };
    head();
    ctx.fillStyle = radial(ctx, hx, hy, 0, s * 0.17, [[0, light(skin, 0.3)], [0.55, skin], [1, deep(skin, 0.55)]], hx + s * 0.05, hy - s * 0.07);
    ctx.fill();
    ctx.strokeStyle = rgba('#e8ffe0', 0.4);
    ctx.lineWidth = Math.max(0.6, s * 0.015);
    ctx.beginPath();
    ctx.moveTo(hx - s * 0.05, hy - s * 0.11);
    ctx.lineTo(hx + s * 0.02, hy - s * 0.13);
    ctx.lineTo(hx + s * 0.07, hy - s * 0.06);
    ctx.moveTo(hx + s * 0.02, hy - s * 0.13);
    ctx.lineTo(hx + s * 0.04, hy - s * 0.04);
    ctx.stroke();
    ctx.strokeStyle = rgba('#0a2a18', 0.6);
    ctx.lineWidth = Math.max(0.7, s * 0.018);
    ctx.beginPath();
    ctx.moveTo(hx - s * 0.15, hy + s * 0.03);
    ctx.quadraticCurveTo(hx - s * 0.09, hy + s * 0.07, hx - s * 0.02, hy + s * 0.05);
    ctx.stroke();
    rimEdge(ctx, head, '#e8ffe0', 0.6, s * 0.045, s * 0.03, s * 0.03);
    orbEye(ctx, hx - s * 0.05, hy - s * 0.03, s * 0.045, '#c8ffd8', blink(t, sd));
    // 腹甲边：浅黄绿的一道
    ctx.fillStyle = linear(ctx, 0, -s * 0.3, 0, -s * 0.18, [[0, '#c8d890'], [1, deep('#a8b870', 0.45)]]);
    ctx.beginPath();
    ctx.ellipse(s * 0.02, -s * 0.25, s * 0.8, s * 0.07, 0, 0, Math.PI);
    ctx.fill();
    // 龟壳
    const dome = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.8, -s * 0.25);
      ctx.bezierCurveTo(-s * 0.8, -s * 1.35, s * 0.85, -s * 1.35, s * 0.85, -s * 0.25);
      ctx.closePath();
    };
    dome();
    ctx.fillStyle = bodyGrad(ctx, -s * 0.8, -s * 1.4, s * 0.85, -s * 0.2, base, 0.2, 0.74);
    ctx.fill();
    ctx.save();
    dome();
    ctx.clip();
    ctx.fillStyle = radial(ctx, s * 0.3, -s * 0.9, 0, s * 0.95, [[0, 'rgba(210,255,220,0.3)'], [1, 'rgba(210,255,220,0)']]);
    ctx.fillRect(-s * 0.8, -s * 1.1, s * 1.65, s * 0.85);
    // 甲片：中间一块、两边各一块；每块中间微微鼓起，带两圈生长纹
    const H = [[0, -0.8, 0.21], [-0.46, -0.56, 0.18], [0.46, -0.56, 0.18]];
    const hex = (hx2, hy2, r) => {
      const pts = [];
      for (let a = 0; a <= 6; a++) pts.push([s * hx2 + Math.cos((a * Math.PI) / 3) * s * r, s * hy2 + Math.sin((a * Math.PI) / 3) * s * r]);
      return pts;
    };
    const poly = (pts) => {
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    };
    for (const [hx2, hy2, r] of H) {
      poly(hex(hx2, hy2, r));
      ctx.fillStyle = radial(ctx, s * hx2, s * hy2, 0, s * r, [[0, 'rgba(150,230,170,0.4)'], [1, 'rgba(150,230,170,0.05)']], s * (hx2 + r * 0.3), s * (hy2 - r * 0.35));
      ctx.fill();
      ctx.lineWidth = Math.max(0.6, s * 0.018);
      for (const [k, c, dy] of [[0.62, 'rgba(6,30,16,0.35)', 0], [0.62, 'rgba(200,255,215,0.25)', -0.015], [0.3, 'rgba(6,30,16,0.3)', 0]]) {
        poly(hex(hx2, hy2 + dy, r * k));
        ctx.strokeStyle = c;
        ctx.stroke();
      }
    }
    // 甲缝
    ctx.strokeStyle = 'rgba(4,22,12,0.5)';
    ctx.lineWidth = Math.max(0.8, s * 0.03);
    ctx.beginPath();
    for (const d of [-1, 1]) {
      for (const [x0, y0, x1, y1] of [[0.105, -0.98, 0.26, -1.12], [0.21, -0.8, 0.37, -0.716], [0.105, -0.618, 0.28, -0.56], [0.55, -0.716, 0.62, -0.92], [0.64, -0.56, 0.84, -0.62], [0.55, -0.404, 0.58, -0.38]]) {
        ctx.moveTo(s * x0 * d, s * y0);
        ctx.lineTo(s * x1 * d, s * y1);
      }
    }
    ctx.moveTo(0, -s * 0.618);
    ctx.lineTo(0, -s * 0.4);
    ctx.stroke();
    // 裙边：一排小缘甲
    ctx.fillStyle = 'rgba(190,220,120,0.22)';
    ctx.fillRect(-s * 0.85, -s * 0.4, s * 1.75, s * 0.15);
    ctx.beginPath();
    ctx.moveTo(-s * 0.85, -s * 0.4);
    ctx.lineTo(s * 0.9, -s * 0.4);
    for (let x = -0.72; x < 0.85; x += 0.19) {
      ctx.moveTo(s * x, -s * 0.4);
      ctx.lineTo(s * x, -s * 0.25);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(220,255,200,0.3)';
    ctx.lineWidth = Math.max(0.6, s * 0.015);
    ctx.beginPath();
    ctx.moveTo(-s * 0.85, -s * 0.38);
    ctx.lineTo(s * 0.9, -s * 0.38);
    ctx.stroke();
    // 发光的六边形纹路：一块接一块地亮
    H.forEach(([hx2, hy2, r], i) => rune(ctx, hex(hx2, hy2, r), '#8affc8', Math.max(1, s * 0.045), 0.5 + Math.sin(t * 2 - i * 1.2) * 0.2));
    glow(ctx, 0, -s * 0.8, s * 0.4, '#8affc8', 0.22 + Math.sin(t * 2) * 0.08);
    ctx.restore();
    rimEdge(ctx, dome, '#d8ffe0', 0.6, s * 0.07, s * 0.05, s * 0.05);
  };

  // 飞鱼：流线型的鱼身（深蓝的背、银白的肚子、细细的鳞），侧线和一排小光点发亮；一对带鳍条的大胸鳍像翅膀，跳起来时张开，身后洒下水珠
  D.flyingFish = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    const flap = Math.sin(t * (o.leap ? 30 : 8) + sd);
    if (!o.leap) shadow(ctx, 0, 2, s * 0.8);
    ctx.save();
    ctx.translate(0, -s * 0.7);
    if (o.leap) ctx.rotate(-0.3 + Math.min(1, Math.max(0, o.leap)) * 0.6);
    const base = '#3a8ad8';
    const wl = s * (o.leap ? 1.0 : 0.6);
    // 远侧的胸鳍（在身体后面，暗一点）
    finFan(ctx, s * 0.02, -s * 0.1, wl * 0.9, s * 0.4, 0.85 + flap * 0.3, '#9fd8ff', 0.6);
    // 尾鳍：下叶长一点，带鳍条，轻轻摆
    ctx.save();
    ctx.translate(s * 0.58, 0);
    ctx.rotate(Math.sin(t * 8 + sd) * 0.12);
    const tf = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.04, 0);
      ctx.quadraticCurveTo(s * 0.18, -s * 0.12, s * 0.44, -s * 0.38);
      ctx.quadraticCurveTo(s * 0.32, -s * 0.08, s * 0.3, s * 0.02);
      ctx.quadraticCurveTo(s * 0.36, s * 0.16, s * 0.5, s * 0.42);
      ctx.quadraticCurveTo(s * 0.18, s * 0.14, -s * 0.04, 0);
    };
    tf();
    ctx.fillStyle = linear(ctx, 0, 0, s * 0.5, 0, [[0, deep(base, 0.45)], [1, rgba('#9fd8ff', 0.55)]]);
    ctx.fill();
    ctx.strokeStyle = rgba('#d8f2ff', 0.45);
    ctx.lineWidth = Math.max(0.6, s * 0.02);
    ctx.beginPath();
    for (const [x, y] of [[0.42, -0.34], [0.36, -0.2], [0.34, 0.06], [0.42, 0.24], [0.48, 0.38]]) {
      ctx.moveTo(0, 0);
      ctx.lineTo(s * x, s * y);
    }
    ctx.stroke();
    ctx.restore();
    // 鱼身
    const bp = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, s * 0.02);
      ctx.bezierCurveTo(-s * 0.62, -s * 0.28, s * 0.15, -s * 0.3, s * 0.62, -s * 0.05);
      ctx.lineTo(s * 0.62, s * 0.06);
      ctx.bezierCurveTo(s * 0.15, s * 0.3, -s * 0.55, s * 0.28, -s * 0.7, s * 0.02);
      ctx.closePath();
    };
    // 小背鳍、小腹鳍
    ctx.fillStyle = rgba('#9fd8ff', 0.55);
    ctx.beginPath();
    ctx.moveTo(s * 0.18, -s * 0.2);
    ctx.quadraticCurveTo(s * 0.32, -s * 0.38 + flap * s * 0.03, s * 0.45, -s * 0.12);
    ctx.closePath();
    ctx.moveTo(s * 0.02, s * 0.2);
    ctx.quadraticCurveTo(s * 0.12, s * 0.36, s * 0.24, s * 0.16);
    ctx.closePath();
    ctx.fill();
    bp();
    ctx.fillStyle = linear(ctx, 0, -s * 0.28, 0, s * 0.28, [[0, deep(base, 0.45)], [0.45, base], [0.7, '#9ccbee'], [1, '#d8eefa']]);
    ctx.fill();
    ctx.save();
    bp();
    ctx.clip();
    ctx.fillStyle = radial(ctx, s * 0.1, -s * 0.22, 0, s * 0.45, [[0, 'rgba(160,215,255,0.35)'], [1, 'rgba(160,215,255,0)']]);
    ctx.fillRect(-s * 0.7, -s * 0.3, s * 1.35, s * 0.6);
    scales(ctx, -s * 0.35, -s * 0.3, s * 0.62, s * 0.3, s * 0.1, '#bfe4ff', 0.22);
    // 鳃盖
    ctx.strokeStyle = rgba('#e8f8ff', 0.55);
    ctx.lineWidth = Math.max(0.7, s * 0.025);
    ctx.beginPath();
    ctx.arc(-s * 0.5, s * 0.01, s * 0.17, -1.0, 1.0);
    ctx.stroke();
    ctx.restore();
    // 侧线发光、肚子上一排小光点（一闪一闪往后传）
    rune(ctx, [[-s * 0.32, -s * 0.03], [0, -s * 0.05], [s * 0.3, -s * 0.03], [s * 0.58, 0]], '#9fe8ff', Math.max(1, s * 0.05), 0.55 + Math.sin(t * 3 + sd) * 0.15);
    for (let i = 0; i < 5; i++) dot(ctx, -s * 0.28 + i * s * 0.17, s * (0.13 - i * 0.012), Math.max(0.6, s * 0.028), '#bff4ff', 0.35 + 0.45 * Math.max(0, Math.sin(t * 4 - i * 0.9)));
    rimEdge(ctx, bp, '#e0f6ff', 0.6, s * 0.06, s * 0.03, s * 0.04);
    orbEye(ctx, -s * 0.47, -s * 0.06, s * 0.07, '#e8ffff', blink(t, sd));
    // 近侧的胸鳍
    finFan(ctx, -s * 0.12, -s * 0.02, wl, s * 0.45, 1.2 + flap * 0.3, '#bfe8ff', 1);
    ctx.restore();
    // 跳在空中时身后洒下几颗水珠
    if (o.leap) {
      for (let i = 0; i < 3; i++) {
        const f = (t * 3 + i / 3) % 1;
        dot(ctx, s * (0.7 + f * 0.5), -s * 0.7 + f * s * 0.4 + i * s * 0.08, Math.max(0.8, s * 0.05 * (1 - f * 0.5)), '#bfe8ff', 1 - f);
      }
    }
  };

  // 海胆：紫色的刺球；尖刺细长、受光的一侧亮，刺尖一闪一闪；壳上一圈圈刺座，正面几根短刺；攻击时刺一下子竖起来
  D.urchin = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    const roll = t * 2 + sd;
    const bristle = o.attack ? 1 + Math.abs(Math.sin(t * 12)) * 0.08 : 1;
    shadow(ctx, 0, 2, s * 0.8);
    ctx.save();
    ctx.translate(0, -s * 0.75 - Math.abs(Math.sin(roll * 2)) * 1.5);
    const base = '#8a5ac8';
    const spin = roll * 0.3;
    // 后面一圈长刺：细长的尖锥
    const tips = [];
    ctx.fillStyle = deep(base, 0.5);
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = spin + (i * TAU) / 16;
      const len = (i % 2 ? 1.05 : 1.25) * bristle;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const w = s * 0.055;
      ctx.moveTo(c * s * 0.5 - sn * w, sn * s * 0.5 + c * w);
      ctx.lineTo(c * s * len, sn * s * len);
      ctx.lineTo(c * s * 0.5 + sn * w, sn * s * 0.5 - c * w);
      ctx.closePath();
      tips.push([c, sn, len, a]);
    }
    ctx.fill();
    // 受光的一侧（右上）亮一道
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.7, s * 0.03);
    for (const [c, sn, len, a] of tips) {
      const lit = Math.cos(a + Math.PI * 0.25);
      if (lit <= 0) continue;
      ctx.strokeStyle = rgba('#e8c8ff', lit * 0.6);
      ctx.beginPath();
      ctx.moveTo(c * s * 0.55 + sn * s * 0.02, sn * s * 0.55 - c * s * 0.02);
      ctx.lineTo(c * s * len * 0.92, sn * s * len * 0.92);
      ctx.stroke();
    }
    // 圆壳
    const body = () => {
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.6, 0, TAU);
    };
    body();
    ctx.fillStyle = radial(ctx, 0, 0, 0, s * 0.62, [[0, light(base, 0.3)], [0.5, deep(base, 0.15)], [1, deep(base, 0.62)]], s * 0.2, -s * 0.25);
    ctx.fill();
    ctx.save();
    body();
    ctx.clip();
    glow(ctx, s * 0.1, -s * 0.12, s * 0.55, '#c8a0ff', 0.25);
    // 刺座：外圈一圈小疙瘩（跟着刺一起转），里圈小一点
    for (const [rr, n, k, a0] of [[0.5, 16, 1, 0], [0.36, 12, 0.7, 0.13]]) {
      ctx.fillStyle = rgba('#e0c8ff', 0.4 * k);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const a = spin + a0 + (i * TAU) / n;
        const x = Math.cos(a) * s * rr;
        const y = Math.sin(a) * s * rr * 0.92;
        ctx.moveTo(x + s * 0.035 * k, y);
        ctx.arc(x, y, s * 0.035 * k, 0, TAU);
      }
      ctx.fill();
    }
    ctx.restore();
    rimEdge(ctx, body, '#f0d8ff', 0.65, s * 0.08, s * 0.05, s * 0.05);
    // 正面下半圈几根短刺
    ctx.fillStyle = deep(base, 0.3);
    ctx.beginPath();
    const front = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * (0.12 + i * 0.15) + Math.sin(t * 3 + i + sd) * 0.05;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const len = (i % 2 ? 0.82 : 0.92) * bristle;
      ctx.moveTo(c * s * 0.42 - sn * s * 0.045, sn * s * 0.42 + c * s * 0.045);
      ctx.lineTo(c * s * len, sn * s * len);
      ctx.lineTo(c * s * 0.42 + sn * s * 0.045, sn * s * 0.42 - c * s * 0.045);
      ctx.closePath();
      front.push([c * s * len, sn * s * len]);
    }
    ctx.fill();
    ctx.fillStyle = rgba('#e8d0ff', 0.75);
    ctx.beginPath();
    for (const [x, y] of front) {
      ctx.moveTo(x + s * 0.025, y);
      ctx.arc(x, y, s * 0.025, 0, TAU);
    }
    ctx.fill();
    // 长刺的刺尖发光，一闪一闪
    tips.forEach(([c, sn, len], i) => {
      if (i % 2 === 0) dot(ctx, c * s * len, sn * s * len, Math.max(0.9, s * 0.045), '#e0b0ff', 0.45 + 0.4 * Math.max(0, Math.sin(t * 4 + i)));
    });
    // 脸：发光的眼睛、小小的笑
    eyes(ctx, -s * 0.15, -s * 0.05, s * 0.28, s * 0.07, '#f0d8ff', -0.1, blink(t, sd));
    ctx.strokeStyle = rgba('#f0d8ff', 0.7);
    ctx.lineWidth = Math.max(0.7, s * 0.03);
    ctx.beginPath();
    ctx.arc(-s * 0.16, s * 0.04, s * 0.08, 0.5, Math.PI - 0.5);
    ctx.stroke();
    ctx.restore();
  };

  // 海马：卷尾巴一节节的骨环、身上一道道横纹和浅色的肚子；头顶小冠、长嘴，背鳍有鳍条、一波一波地扇；嘴边冒出气泡
  D.seahorse = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    const bob = Math.sin(t * 3 + sd) * 3;
    shadow(ctx, 0, 2, s * 0.6);
    ctx.save();
    ctx.translate(0, bob);
    const base = '#e0a020';
    // 卷尾巴：越往尾尖越细，一节一节
    const tp = [];
    for (let i = 0; i <= 16; i++) {
      const k = i / 16;
      const a = -Math.PI * 0.5 + k * Math.PI * 1.85;
      const r = s * (0.24 - k * 0.13);
      tp.push([s * 0.12 + Math.cos(a) * r, -s * 0.36 + Math.sin(a) * r]);
    }
    const tail = tube(ctx, tp, s * 0.2, s * 0.06);
    tail.path();
    ctx.fillStyle = bodyGrad(ctx, -s * 0.15, -s * 0.62, s * 0.4, -s * 0.1, base, 0.25, 0.62);
    ctx.fill();
    ctx.strokeStyle = rgba('#ffe8a8', 0.45);
    ctx.lineWidth = Math.max(0.7, s * 0.022);
    ctx.beginPath();
    for (let i = 1; i < 16; i += 2) {
      const [nx, ny, w] = tail.N[i];
      const [x, y] = tp[i];
      ctx.moveTo(x + nx * w * 0.85, y + ny * w * 0.85);
      ctx.lineTo(x - nx * w * 0.85, y - ny * w * 0.85);
    }
    ctx.stroke();
    rimEdge(ctx, tail.path, '#fff0c0', 0.5, s * 0.05, s * 0.03, s * 0.03);
    // 背鳍：几根鳍条，波浪从上往下传
    const fb = [];
    for (let i = 0; i < 5; i++) {
      const k = i / 4;
      const bx = s * (0.38 + Math.sin(k * Math.PI) * 0.05);
      const by = -s * (1.13 - k * 0.38);
      fb.push([bx, by, bx + s * (0.05 + Math.sin(k * Math.PI) * 0.13) + Math.sin(t * 14 - i * 0.9) * s * 0.03, by + s * 0.02]);
    }
    ctx.fillStyle = linear(ctx, s * 0.38, 0, s * 0.6, 0, [[0, 'rgba(255,230,150,0.3)'], [1, 'rgba(255,236,170,0.65)']]);
    ctx.beginPath();
    ctx.moveTo(fb[0][0], fb[0][1]);
    for (const f of fb) ctx.lineTo(f[2], f[3]);
    for (let i = 4; i >= 0; i--) ctx.lineTo(fb[i][0], fb[i][1]);
    ctx.fill();
    ctx.strokeStyle = rgba('#fff4c8', 0.6);
    ctx.lineWidth = Math.max(0.6, s * 0.018);
    ctx.beginPath();
    for (const f of fb) {
      ctx.moveTo(f[0], f[1]);
      ctx.lineTo(f[2], f[3]);
    }
    ctx.stroke();
    rune(ctx, fb.map((f) => [f[2], f[3]]), '#fff0b0', Math.max(0.8, s * 0.03), 0.5);
    // 弯弯的身体（S 形）
    const bp = () => {
      ctx.beginPath();
      ctx.moveTo(s * 0.32, -s * 0.6);
      ctx.quadraticCurveTo(s * 0.45, -s * 1.1, s * 0.2, -s * 1.45);
      ctx.quadraticCurveTo(-s * 0.1, -s * 1.75, -s * 0.2, -s * 1.5);
      ctx.quadraticCurveTo(-s * 0.3, -s * 1.1, -s * 0.05, -s * 0.6);
      ctx.closePath();
    };
    bp();
    ctx.fillStyle = bodyGrad(ctx, -s * 0.4, -s * 1.8, s * 0.5, -s * 0.5, base, 0.1, 0.62);
    ctx.fill();
    ctx.save();
    bp();
    ctx.clip();
    // 浅色的肚子、一道道骨环横纹、几颗白色小斑点
    ctx.fillStyle = linear(ctx, -s * 0.3, 0, s * 0.12, 0, [[0, 'rgba(255,236,160,0.55)'], [1, 'rgba(255,236,160,0)']]);
    ctx.fillRect(-s * 0.35, -s * 1.6, s * 0.5, s * 1.0);
    ctx.lineWidth = Math.max(0.7, s * 0.022);
    for (const [c, dy] of [['rgba(90,48,8,0.16)', 0.022], ['rgba(255,240,184,0.24)', 0]]) {
      ctx.strokeStyle = c;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const y0 = -s * (0.7 + k * 0.13) + s * dy;
        ctx.moveTo(-s * 0.4, y0 + s * 0.02);
        ctx.quadraticCurveTo(s * 0.02, y0 + s * 0.06, s * 0.5, y0 - s * 0.04);
      }
      ctx.stroke();
    }
    speckle(ctx, s * 0.1, -s * 1.05, s * 0.18, s * 0.32, 7, '#fffbe8', 0.6, 4, s * 0.012, s * 0.026);
    ctx.restore();
    rimEdge(ctx, bp, '#fff4c8', 0.6, s * 0.06, s * 0.04, s * 0.04);
    // 侧面三颗柔柔的光点
    for (let i = 0; i < 3; i++) dot(ctx, s * (0.22 - i * 0.05), -s * (0.85 + i * 0.17), Math.max(0.7, s * 0.03), '#fff0a0', 0.4 + 0.35 * Math.max(0, Math.sin(t * 3 - i)));
    // 头和长嘴
    const head = () => {
      ctx.beginPath();
      ctx.ellipse(-s * 0.08, -s * 1.6, s * 0.24, s * 0.2, 0, 0, TAU);
      ctx.moveTo(-s * 0.25, -s * 1.63);
      ctx.lineTo(-s * 0.62, -s * 1.53);
      ctx.quadraticCurveTo(-s * 0.67, -s * 1.49, -s * 0.62, -s * 1.44);
      ctx.lineTo(-s * 0.22, -s * 1.47);
      ctx.closePath();
    };
    head();
    ctx.fillStyle = bodyGrad(ctx, -s * 0.5, -s * 1.85, s * 0.2, -s * 1.35, base, 0.08, 0.55);
    ctx.fill();
    ctx.save();
    head();
    ctx.clip();
    ctx.fillStyle = radial(ctx, -s * 0.02, -s * 1.56, 0, s * 0.16, [[0, 'rgba(255,240,180,0.5)'], [1, 'rgba(255,240,180,0)']]);
    ctx.fillRect(-s * 0.2, -s * 1.75, s * 0.35, s * 0.35);
    ctx.strokeStyle = 'rgba(255,236,170,0.35)';
    ctx.lineWidth = Math.max(0.6, s * 0.02);
    ctx.beginPath();
    ctx.moveTo(-s * 0.6, -s * 1.47);
    ctx.lineTo(-s * 0.25, -s * 1.5);
    ctx.stroke();
    ctx.restore();
    // 鳃盖
    ctx.strokeStyle = rgba('#7a4208', 0.45);
    ctx.lineWidth = Math.max(0.7, s * 0.022);
    ctx.beginPath();
    ctx.arc(-s * 0.1, -s * 1.6, s * 0.16, -0.4, 0.9);
    ctx.stroke();
    rimEdge(ctx, head, '#fff4c8', 0.6, s * 0.05, s * 0.035, s * 0.035);
    // 头顶小冠：三根小刺，中间那根尖上发光
    ctx.fillStyle = bodyGrad(ctx, -s * 0.1, -s * 1.98, s * 0.14, -s * 1.76, base, 0.0, 0.4);
    ctx.beginPath();
    for (const [x, h] of [[-0.06, 0.12], [0.02, 0.2], [0.1, 0.12]]) {
      ctx.moveTo(s * (x - 0.045), -s * 1.76);
      ctx.lineTo(s * x, -s * (1.76 + h));
      ctx.lineTo(s * (x + 0.045), -s * 1.76);
    }
    ctx.fill();
    dot(ctx, s * 0.02, -s * 1.95, Math.max(0.7, s * 0.03), '#fff6c0', 0.55 + Math.sin(t * 4 + sd) * 0.25);
    // 小胸鳍
    finFan(ctx, s * 0.06, -s * 1.42, s * 0.16, s * 0.1, 1.6 + Math.sin(t * 16 + sd) * 0.3, '#ffe696', 0.8);
    // 眼睛和一圈骨环
    ctx.strokeStyle = rgba('#fff0c0', 0.5);
    ctx.lineWidth = Math.max(0.6, s * 0.02);
    ctx.beginPath();
    ctx.arc(-s * 0.12, -s * 1.64, s * 0.085, 0, TAU);
    ctx.stroke();
    orbEye(ctx, -s * 0.12, -s * 1.64, s * 0.055, '#fff6d0', blink(t, sd));
    ctx.restore();
    // 嘴边冒出的气泡
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.8 + i / 3 + sd * 0.13) % 1;
      bubble(ctx, -s * 0.7 - p * s * 0.2, -s * 1.5 - p * s * 1.2 + bob, s * (0.05 + p * 0.08), 1 - p);
    }
  };

  // 触手：从沙堆里伸出来，尖端卷成小钩；内侧一排浅粉色的吸盘（光一节节往上传），外侧有细细的小突起；脚下的水波一圈圈散开
  D.tentacle = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    const sway = Math.sin(t * 2.5 + sd) * s * 0.35;
    const slap = o.attack ? Math.max(0, Math.sin(t * 3)) : 0;
    // 沙堆（后半）和散开的水波
    ctx.fillStyle = radial(ctx, 0, 0, 0, s * 0.9, [[0, 'rgba(200,170,120,0.65)'], [0.75, 'rgba(110,84,56,0.55)'], [1, 'rgba(80,60,40,0.2)']], s * 0.15, -s * 0.08);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.9, s * 0.22, 0, 0, TAU);
    ctx.fill();
    const f = (t * 0.7 + sd * 0.29) % 1;
    ctx.strokeStyle = rgba('#bff0ff', 0.4 * (1 - f));
    ctx.lineWidth = Math.max(0.8, s * 0.03);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * (0.5 + f * 0.38), s * (0.12 + f * 0.09), 0, 0, TAU);
    ctx.stroke();
    const base = '#a03a7a';
    const pts = curvePts([0, 0], [s * 0.05 + sway * 0.2, -s * 0.9], [-s * 0.1 + sway * 0.9, -s * 1.8], [-s * 0.2 + sway - slap * s * 0.5, -s * 2.22], 12, -0.6, 4, s * 0.16);
    const tb = tube(ctx, pts, s * 0.84, s * 0.05);
    tb.path();
    ctx.fillStyle = linear(ctx, -s * 0.5 + sway * 0.5, 0, s * 0.45 + sway * 0.5, 0, [[0, deep(base, 0.72)], [0.55, deep(base, 0.3)], [1, deep(base, 0.08)]]);
    ctx.fill();
    ctx.save();
    tb.path();
    ctx.clip();
    // 埋在沙里的一截暗一点
    ctx.fillStyle = linear(ctx, 0, -s * 0.6, 0, 0, [[0, 'rgba(20,8,24,0)'], [1, 'rgba(20,8,24,0.45)']]);
    ctx.fillRect(-s * 0.6, -s * 0.6, s * 1.2, s * 0.62);
    // 内侧（左边）浅粉色的一条
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,190,225,0.3)';
    for (let i = 0; i < pts.length - 1; i++) {
      const [nx, ny, w] = tb.N[i];
      ctx.lineWidth = w * 0.8;
      ctx.beginPath();
      ctx.moveTo(pts[i][0] - nx * w * 0.6, pts[i][1] - ny * w * 0.6);
      ctx.lineTo(pts[i + 1][0] - tb.N[i + 1][0] * w * 0.6, pts[i + 1][1] - tb.N[i + 1][1] * w * 0.6);
      ctx.stroke();
    }
    // 外侧的小突起
    ctx.fillStyle = rgba('#ff9ad0', 0.35);
    ctx.beginPath();
    for (let i = 1; i < pts.length - 4; i++) {
      const [nx, ny, w] = tb.N[i];
      const x = pts[i][0] + nx * w * (0.25 + (i % 3) * 0.18);
      const y = pts[i][1] + ny * w * (0.25 + (i % 3) * 0.18);
      ctx.moveTo(x + w * 0.09, y);
      ctx.arc(x, y, w * 0.09, 0, TAU);
    }
    ctx.fill();
    ctx.restore();
    rimEdge(ctx, tb.path, '#ffd0ec', 0.6, s * 0.08, s * 0.05, s * 0.05);
    // 吸盘：沿着内侧，越往上越小；光一节节往上传
    const list = [];
    for (let i = 2; i < pts.length - 2; i++) {
      const [nx, ny, w] = tb.N[i];
      list.push([pts[i][0] - nx * w * 0.55, pts[i][1] - ny * w * 0.55, Math.max(0.9, w * 0.36), Math.atan2(ny, nx)]);
    }
    suckers(ctx, list);
    list.forEach(([x, y, r], i) => {
      if (i % 2 === 0) glow(ctx, x, y, r * 3, '#ffb0e0', 0.2 + 0.5 * Math.max(0, Math.sin(t * 4 - i * 0.7)));
    });
    const tip = pts[pts.length - 1];
    dot(ctx, tip[0], tip[1], Math.max(0.8, s * 0.035), '#ffc0e8', 0.6 + Math.sin(t * 3 + sd) * 0.25);
    // 沙堆（前沿）：盖住触手的根，上面几粒沙
    ctx.fillStyle = linear(ctx, 0, -s * 0.06, 0, s * 0.14, [[0, 'rgba(210,180,130,0.85)'], [1, 'rgba(110,84,56,0.6)']]);
    ctx.beginPath();
    ctx.ellipse(0, s * 0.02, s * 0.55, s * 0.1, 0, 0, TAU);
    ctx.fill();
    speckle(ctx, 0, s * 0.02, s * 0.5, s * 0.07, 7, '#fff0d0', 0.6, 5, s * 0.012, s * 0.025);
  };

  // 贝贝：巨大的扇贝。贝壳边一个个小波浪，放射肋一明一暗、几圈生长纹，肋上的光一道道流过；壳顶镶着三颗小珍珠；
  // 合壳时壳缝透出一线珍珠光、冒出小气泡；张壳时露出珍珠层的内壁、荷叶边的外套膜和一颗发光的大珍珠
  D.pearlClam = function (ctx, s, t, o) {
    const ai = o.ai || {};
    const open = !!ai.open;
    const sd = o.seed || 0;
    const ang = open ? 0.55 + Math.sin(t * 4) * 0.04 : 0.04 + Math.sin(t * 2 + sd) * 0.012;
    shadow(ctx, 0, 2, s * 1.3);
    const base = '#e07aa8';
    const cy = -s * 0.45;
    const RIB = 11;
    // 半边贝壳的轮廓：ry 是高度，lower = 下半边；肋的末端鼓成小波浪
    const shell = (ry, lower) => {
      ctx.beginPath();
      for (let i = 0; i <= 44; i++) {
        const u = i / 44;
        const a = lower ? Math.PI * (1 - u) : Math.PI * (1 + u);
        const k = 0.965 + 0.035 * Math.abs(Math.cos(Math.PI * RIB * u));
        const x = Math.cos(a) * s * 1.15 * k;
        const y = cy + Math.sin(a) * s * ry * k;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.closePath();
    };
    // 放射肋：每条肋一道亮、肋间一道暗，朝右上的肋更亮；再加几圈生长纹
    const ribs = (ry, lower, lit) => {
      for (let i = 0; i <= RIB; i++) {
        const a = lower ? Math.PI * (1 - i / RIB) : Math.PI * (1 + i / RIB);
        const f = Math.max(0, Math.cos(a + Math.PI * 0.3));
        ctx.strokeStyle = rgba('#ffe4f0', (0.08 + f * 0.24) * lit);
        ctx.lineWidth = s * 0.07;
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(Math.cos(a) * s * 1.15, cy + Math.sin(a) * s * ry);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(70,10,40,0.22)';
      ctx.lineWidth = Math.max(0.8, s * 0.02);
      ctx.beginPath();
      for (let i = 0; i < RIB; i++) {
        const a = lower ? Math.PI * (1 - (i + 0.5) / RIB) : Math.PI * (1 + (i + 0.5) / RIB);
        ctx.moveTo(0, cy);
        ctx.lineTo(Math.cos(a) * s * 1.15, cy + Math.sin(a) * s * ry);
      }
      ctx.stroke();
      for (const [c, dy] of [['rgba(70,10,40,0.16)', 0], ['rgba(255,228,240,0.16)', -0.015]]) {
        ctx.strokeStyle = c;
        ctx.beginPath();
        for (const k of [0.5, 0.8]) ctx.ellipse(0, cy + s * dy, s * 1.15 * k, s * ry * k, 0, lower ? 0 : Math.PI, lower ? Math.PI : TAU);
        ctx.stroke();
      }
    };
    // 下壳
    const low = () => shell(0.5, true);
    low();
    ctx.fillStyle = bodyGrad(ctx, -s * 1.15, -s * 0.5, s * 1.15, 0, base, 0.25, 0.74);
    ctx.fill();
    ctx.save();
    low();
    ctx.clip();
    ribs(0.5, true, 0.6);
    ctx.restore();
    rimEdge(ctx, low, '#ffe0f0', 0.4, s * 0.05, s * 0.04, s * 0.03);
    if (open) {
      // 珍珠层的内壁、荷叶边的外套膜、发光的大珍珠
      ctx.fillStyle = linear(ctx, -s * 1.1, 0, s * 1.1, 0, [[0, '#f0c8e0'], [0.35, '#fff4fa'], [0.6, '#d8d0f8'], [0.8, '#c8f0f0'], [1, '#e8b8d8']]);
      ctx.beginPath();
      ctx.ellipse(0, cy, s * 1.08, s * 0.17, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,214,236,0.9)';
      ctx.lineWidth = Math.max(1, s * 0.035);
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const a = Math.PI * (i / 24);
        const x = -Math.cos(a) * s * 0.98;
        const y = cy + Math.sin(a) * s * 0.12 + Math.sin(i * 1.7 + t * 5) * s * 0.018;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
      glow(ctx, -s * 0.15, -s * 0.62, s * 0.9, '#fff0f8', 0.85, true);
      const pr = s * 0.28;
      ctx.fillStyle = radial(ctx, -s * 0.15, -s * 0.62, 0, pr, [[0, '#ffffff'], [0.45, '#fbeef6'], [0.8, '#ecc8e8'], [1, '#c8b0e0']], -s * 0.24, -s * 0.72);
      ctx.beginPath();
      ctx.arc(-s * 0.15, -s * 0.62, pr, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(160,230,240,0.45)';
      ctx.lineWidth = Math.max(1, pr * 0.1);
      ctx.beginPath();
      ctx.arc(-s * 0.15, -s * 0.62, pr * 0.78, 1.6, 3.4);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-s * 0.06, -s * 0.73, pr * 0.2, pr * 0.13, -0.6, 0, TAU);
      ctx.fill();
      sparkles(ctx, -s * 0.15, -s * 0.66, s * 0.45, s * 0.25, 4, t, '#ffffff', 7, Math.max(1, s * 0.03));
    }
    // 上壳（从右边的铰链处打开）
    ctx.save();
    ctx.translate(s * 1.05, cy);
    ctx.rotate(ang);
    ctx.translate(-s * 1.05, -cy);
    const up = () => shell(0.85, false);
    up();
    ctx.fillStyle = bodyGrad(ctx, -s * 1.15, -s * 1.3, s * 1.15, cy, base, 0.12, 0.62);
    ctx.fill();
    ctx.save();
    up();
    ctx.clip();
    ctx.fillStyle = radial(ctx, s * 0.4, -s * 1.05, 0, s * 1.0, [[0, 'rgba(255,230,242,0.35)'], [1, 'rgba(255,230,242,0)']]);
    ctx.fillRect(-s * 1.15, -s * 1.35, s * 2.3, s * 0.9);
    ribs(0.85, false, 1);
    // 肋上的光：一道道从左往右流过
    for (let i = 1; i < RIB; i += 2) {
      const a = Math.PI * (1 + i / RIB);
      rune(ctx, [[Math.cos(a) * s * 0.3, cy + Math.sin(a) * s * 0.22], [Math.cos(a) * s * 1.08, cy + Math.sin(a) * s * 0.8]], '#ffd0e8', Math.max(1, s * 0.03), 0.1 + 0.3 * Math.max(0, Math.sin(t * 2 - i * 0.5)));
    }
    ctx.restore();
    rimEdge(ctx, up, '#ffe8f4', 0.7, s * 0.07, s * 0.05, s * 0.05);
    // 壳顶镶着的三颗小珍珠
    for (const a of [1.36, 1.5, 1.64]) {
      const x = Math.cos(Math.PI * a) * s * 1.15 * 0.74;
      const y = cy + Math.sin(Math.PI * a) * s * 0.85 * 0.74;
      const r = s * (a === 1.5 ? 0.06 : 0.045);
      glow(ctx, x, y, r * 3, '#fff0f8', 0.4);
      ctx.fillStyle = radial(ctx, x, y, 0, r, [[0, '#ffffff'], [0.6, '#f8e4f0'], [1, '#c8a8d8']], x + r * 0.3, y - r * 0.35);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    // 大眼睛和腮红
    for (const ex of [-0.56, -0.14]) glow(ctx, s * ex, -s * 0.72, s * 0.14, '#ff8ac0', 0.35);
    eyes(ctx, -s * 0.35, -s * 0.85, s * 0.42, s * 0.09, '#fff0f8', 0, blink(t, sd));
    ctx.restore();
    if (!open) {
      // 壳缝透出一线珍珠光，左边冒出小气泡
      rune(ctx, [[-s * 1.08, cy], [-s * 0.4, cy - s * 0.02], [s * 0.4, cy - s * 0.02], [s * 1.0, cy]], '#ffe0f0', Math.max(1, s * 0.035), 0.35 + Math.sin(t * 3 + sd) * 0.15);
      glow(ctx, -s * 0.3, cy, s * 0.5, '#fff0f8', 0.3);
      for (let i = 0; i < 2; i++) {
        const p = (t * 0.6 + i * 0.5 + sd * 0.17) % 1;
        bubble(ctx, -s * (1.0 + Math.sin(p * 6 + i) * 0.04), cy - p * s * 0.9, s * (0.04 + p * 0.04), 1 - p);
      }
    }
  };

  // 波波：章鱼大王。大脑袋光滑有光泽、身上柔和的斑纹和发光的斑点；六条触腕尖端往外卷、露出吸盘；
  // 头顶一顶金冠（三颗珍珠、宝石发光）；大漩涡时眼睛变红、眉毛竖起来，脚下卷起水流
  D.octoKing = function (ctx, s, t, o) {
    const ai = o.ai || {};
    const angry = ai.phase >= 3;
    const sd = o.seed || 0;
    shadow(ctx, 0, 2, s * 1.4);
    const base = '#b04a8a';
    // 大漩涡：脚下几道转动的水流
    if (angry) {
      ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const a0 = t * 3 + k * 2.1;
        ctx.strokeStyle = rgba('#a8f0ff', 0.45 - k * 0.1);
        ctx.lineWidth = s * (0.05 - k * 0.01);
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.22, s * (1.15 + k * 0.12), s * (0.28 + k * 0.04), 0, a0, a0 + 1.6);
        ctx.stroke();
      }
    }
    // 触腕：后面三条暗、前面三条亮；尖端往外卷起来，内侧露出浅色吸盘
    const arm = (i) => {
      const back = i % 2 === 1;
      const dir = (i - 2.5) / 2.5;
      const x0 = s * (-0.85 + i * 0.34) * 0.92;
      const w = Math.sin(t * 3 + i) * s * 0.22;
      const p2 = [x0 + w + dir * s * 0.06, -s * 0.12];
      const p3 = [x0 + w * 1.3 + dir * s * 0.12, -s * 0.07];
      const curl = p3[0] > p2[0] ? -0.6 : 0.6;
      const pts = curvePts([x0 * 0.85, -s * 0.95], [x0 + w * 0.5, -s * 0.45], p2, p3, 10, curl, 6, s * 0.08);
      const tb = tube(ctx, pts, s * 0.34, s * 0.03, 1.5);
      tb.path();
      ctx.fillStyle = linear(ctx, x0 + s * 0.15, -s * 0.6, x0 - s * 0.15, 0, [[0, deep(base, back ? 0.45 : 0.1)], [1, deep(base, back ? 0.78 : 0.58)]]);
      ctx.fill();
      if (!back) rimEdge(ctx, tb.path, '#ffc8ea', 0.55, s * 0.05, s * 0.03, s * 0.03);
      const side = curl < 0 ? -1 : 1;
      const list = [];
      for (let j = 7; j < pts.length - 2; j++) {
        const [nx, ny, hw] = tb.N[j];
        list.push([pts[j][0] + nx * hw * 0.55 * side, pts[j][1] + ny * hw * 0.55 * side, Math.max(0.9, hw * 0.5), Math.atan2(ny, nx)]);
      }
      if (!back) suckers(ctx, list);
    };
    for (const i of [1, 3, 5, 0, 2, 4]) arm(i);
    // 大脑袋
    const head = () => {
      ctx.beginPath();
      ctx.ellipse(0, -s * 1.3, s * 1.0, s * 0.95, 0, 0, TAU);
    };
    head();
    ctx.fillStyle = radial(ctx, 0, -s * 1.3, 0, s * 1.0, [[0, light(base, 0.3)], [0.4, deep(base, 0.08)], [0.8, deep(base, 0.45)], [1, deep(base, 0.62)]], s * 0.35, -s * 1.75);
    ctx.fill();
    ctx.save();
    head();
    ctx.clip();
    // 柔和的斑纹
    speckle(ctx, s * 0.05, -s * 1.45, s * 0.85, s * 0.65, 9, '#f0a0d0', 0.14, 7, s * 0.06, s * 0.13);
    // 光泽：右上一道弧形高光
    ctx.strokeStyle = 'rgba(255,235,248,0.35)';
    ctx.lineWidth = s * 0.06;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(s * 0.05, -s * 1.35, s * 0.78, -1.3, -0.6);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,240,250,0.7)';
    ctx.beginPath();
    ctx.ellipse(s * 0.55, -s * 1.85, s * 0.07, s * 0.04, -0.6, 0, TAU);
    ctx.fill();
    rimEdge(ctx, head, '#ffd8f0', 0.7, s * 0.08, s * 0.05, s * 0.05);
    // 发光的斑点：一圈浅色的环，一个接一个亮
    [[0.45, -1.75, 0.045], [0.62, -1.35, 0.035], [-0.55, -1.75, 0.033], [0.15, -2.0, 0.03], [0.72, -1.0, 0.03], [-0.75, -1.35, 0.028]].forEach(([px, py, r], i) => {
      ctx.strokeStyle = rgba('#ffc8e8', 0.4);
      ctx.lineWidth = Math.max(0.7, s * 0.012);
      ctx.beginPath();
      ctx.arc(s * px, s * py, s * r * 1.9, 0, TAU);
      ctx.stroke();
      dot(ctx, s * px, s * py, s * r, '#ffb0e0', 0.55 + 0.35 * Math.max(0, Math.sin(t * 2.5 - i * 1.1)));
    });
    // 脸：腮红、笑嘴（生气时变成小圆嘴、眉毛竖起来）
    const op = blink(t, sd);
    if (angry) {
      ctx.strokeStyle = deep(base, 0.82);
      ctx.lineWidth = s * 0.055;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-s * 0.72, -s * 1.47);
      ctx.lineTo(-s * 0.36, -s * 1.36);
      ctx.moveTo(-s * 0.04, -s * 1.36);
      ctx.lineTo(s * 0.32, -s * 1.47);
      ctx.stroke();
      ctx.strokeStyle = rgba('#ffd0e8', 0.75);
      ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.beginPath();
      ctx.ellipse(-s * 0.2, -s * 0.94, s * 0.06, s * 0.05, 0, 0, TAU);
      ctx.stroke();
    } else {
      for (const ex of [-0.55, 0.15]) glow(ctx, s * ex, -s * 1.02, s * 0.24, '#ff9ad0', 0.35);
      ctx.strokeStyle = rgba('#ffd0e8', 0.75);
      ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(-s * 0.2, -s * 1.05, s * 0.12, 0.45, Math.PI - 0.45);
      ctx.stroke();
    }
    eyes(ctx, -s * 0.2, -s * 1.2, s * 0.6, s * 0.12, angry ? '#ff6a6a' : '#ffe0f0', angry ? 0.25 : 0, angry ? 1 : op);
    // 头侧冒出的气泡
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.5 + i / 3 + sd * 0.11) % 1;
      bubble(ctx, s * (1.04 + Math.sin(p * 7 + i) * 0.04), -s * (1.0 + p * 1.2), s * (0.04 + p * 0.05), 1 - p);
    }
    // 金冠：轻轻晃，金属的明暗、亮边，三颗珍珠、宝石发光
    ctx.save();
    ctx.translate(0, -s * 2.15);
    ctx.rotate(Math.sin(t * 2 + sd) * 0.04);
    glow(ctx, 0, -s * 0.15, s * 0.6, '#ffd27a', 0.55);
    const crown = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.35, s * 0.03);
      ctx.lineTo(-s * 0.35, -s * 0.3);
      ctx.lineTo(-s * 0.18, -s * 0.13);
      ctx.lineTo(0, -s * 0.35);
      ctx.lineTo(s * 0.18, -s * 0.13);
      ctx.lineTo(s * 0.35, -s * 0.3);
      ctx.lineTo(s * 0.35, s * 0.03);
      ctx.closePath();
    };
    crown();
    ctx.fillStyle = linear(ctx, s * 0.35, -s * 0.35, -s * 0.35, s * 0.03, [[0, '#fff2b0'], [0.35, '#ffd96a'], [0.7, '#d89a30'], [1, '#a86a20']]);
    ctx.fill();
    // 冠沿：一条更亮的金边
    ctx.fillStyle = linear(ctx, 0, -s * 0.07, 0, s * 0.03, [[0, '#fff0b8'], [1, '#c88a2a']]);
    ctx.fillRect(-s * 0.35, -s * 0.07, s * 0.7, s * 0.1);
    ctx.strokeStyle = 'rgba(110,60,10,0.5)';
    ctx.lineWidth = Math.max(0.7, s * 0.015);
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, -s * 0.07);
    ctx.lineTo(s * 0.35, -s * 0.07);
    ctx.stroke();
    rimEdge(ctx, crown, '#fffbe0', 0.85, s * 0.05, s * 0.03, s * 0.03);
    // 宝石：中间粉色、两边青色
    for (const [x, r, c] of [[0, 0.05, '#ff7ab8'], [-0.22, 0.035, '#7ae8e0'], [0.22, 0.035, '#7ae8e0']]) {
      glow(ctx, s * x, -s * 0.02, s * r * 3.5, c, 0.5 + Math.sin(t * 3 + x * 9) * 0.2);
      ctx.fillStyle = radial(ctx, s * x, -s * 0.02, 0, s * r, [[0, light(c, 0.7)], [0.6, c], [1, deep(c, 0.4)]], s * (x + r * 0.3), -s * (0.02 + r * 0.35));
      ctx.beginPath();
      ctx.ellipse(s * x, -s * 0.02, s * r, s * r * 1.2, 0, 0, TAU);
      ctx.fill();
    }
    // 尖上的三颗珍珠
    for (const [x, y] of [[-0.35, -0.32], [0, -0.38], [0.35, -0.32]]) {
      const r = s * 0.04;
      ctx.fillStyle = radial(ctx, s * x, s * y, 0, r, [[0, '#ffffff'], [0.6, '#fff0f8'], [1, '#d8b8e0']], s * x + r * 0.3, s * y - r * 0.35);
      ctx.beginPath();
      ctx.arc(s * x, s * y, r, 0, TAU);
      ctx.fill();
    }
    sparkles(ctx, 0, -s * 0.2, s * 0.5, s * 0.25, 3, t, '#fff6c8', 13, Math.max(1, s * 0.025));
    ctx.restore();
  };
})((globalThis.TD = globalThis.TD || {}));
