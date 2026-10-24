// 深渊回响（第 11–20 章）的终章 Boss：焚天巨龙（设计书 114、115）
// 西方神话里的巨龙，侧面像，朝左（城墙方向），悬在半空、翅膀高举。
// 坐标约定同 creatures.js：s 是 def.size，原点 = 身体中心（不是脚下），向上为负；整条龙宽约 2.5 s，翼尖高约 0.75 s。
// v1.14 重画：脖子 + 躯干 + 尾巴是同一条"脊柱曲线"（Catmull-Rom）按粗细剖面生成的连续轮廓，
// 不再是椭圆 + 圆串；四肢是大腿 / 小腿 / 脚三段的肌肉轮廓；翅膀有臂骨、四根指骨和扇贝形的后缘；头是真正的龙头侧面（眉骨、长吻、颧骨刺、双角）。
// 状态（o.ai）：mode === 'warn' 时按 skill（fire / shock / bolt）和蓄力进度做预备动作；phase 2 发怒，phase 3 狂暴。
(function (TD) {
  'use strict';

  const K = TD.creatures;
  const D = K.drawers;
  const TAU = Math.PI * 2;
  const { deep, light, rgba, glow, shadow, veins, scales, seeded, linear } = K;

  // 均匀 Catmull-Rom：点列 P（每点 [x, y, ...附加量]）→ n 个采样点，附加量同样平滑插值；每个采样点带单位切线 (tx, ty)
  function spline(P, n) {
    const m = P.length;
    const g = (i) => P[Math.max(0, Math.min(m - 1, i))];
    const out = [];
    for (let k = 0; k < n; k++) {
      const f = (k / (n - 1)) * (m - 1);
      const i = Math.min(m - 2, Math.floor(f));
      const u = f - i;
      const a = g(i - 1), b = g(i), c = g(i + 1), d = g(i + 2);
      const u2 = u * u, u3 = u2 * u;
      const q = b.map((_, j) => 0.5 * (2 * b[j] + (-a[j] + c[j]) * u + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * u2 + (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * u3));
      out.push(q);
    }
    for (let k = 0; k < n; k++) {
      const p = out[Math.max(0, k - 1)];
      const q = out[Math.min(n - 1, k + 1)];
      const dx = q[0] - p[0], dy = q[1] - p[1];
      const l = Math.hypot(dx, dy) || 1;
      out[k].tx = dx / l;
      out[k].ty = dy / l;
    }
    return out;
  }

  // 肉管轮廓：沿采样点，向"上"（切线左手边，(ty, −tx)）偏 w[2]，向"下"偏 w[3]；q 是整体粗细倍数
  function edges(S, q) {
    const top = S.map((p) => [p[0] + p.ty * p[2] * q, p[1] - p.tx * p[2] * q]);
    const bot = S.map((p) => [p[0] - p.ty * p[3] * q, p[1] + p.tx * p[3] * q]);
    return { top, bot };
  }
  function ribbonPath(ctx, S, q) {
    const { top, bot } = edges(S, q || 1);
    ctx.beginPath();
    top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
    ctx.closePath();
    return { top, bot };
  }
  function polyline(ctx, pts, from, to) {
    ctx.beginPath();
    for (let i = from === undefined ? 0 : from; i <= (to === undefined ? pts.length - 1 : to); i++) (i === (from || 0) ? ctx.moveTo : ctx.lineTo).call(ctx, pts[i][0], pts[i][1]);
  }
  // 封闭的光滑曲线（头、下颌）
  function closedPath(ctx, P) {
    const m = P.length;
    ctx.beginPath();
    ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 0; i < m; i++) {
      const p0 = P[(i + m - 1) % m], p1 = P[i], p2 = P[(i + 1) % m], p3 = P[(i + 2) % m];
      ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
    }
    ctx.closePath();
  }

  // 鳞片：K.scales 每次要描上千条小弧线（龙身那么大，占了一帧的三分之二），改成先画一块可平铺的小图，再用图案铺满
  const tiles = {};
  function scaleFill(ctx, x0, y0, x1, y1, size, color, a) {
    if (typeof document === 'undefined') return scales(ctx, x0, y0, x1, y1, size, color, a);
    const key = color + a;
    let tile = tiles[key];
    if (!tile) {
      const W = 32;
      const RH = 22.4;
      const c = document.createElement('canvas');
      c.width = W;
      c.height = RH * 2;
      const g = c.getContext('2d');
      g.strokeStyle = rgba(color, a);
      g.lineWidth = 3.8;
      for (let row = 0; row < 2; row++) {
        const y = row * RH;
        g.beginPath();
        for (let x = (row ? W / 2 : 0) - W; x <= W * 2; x += W) {
          g.moveTo(x - W / 2, y);
          g.quadraticCurveTo(x, y + W * 0.65, x + W / 2, y);
        }
        g.stroke();
      }
      tile = tiles[key] = { c, pat: ctx.createPattern(c, 'repeat') };
    }
    const k = size / 32;
    ctx.save();
    ctx.scale(k, k);
    ctx.fillStyle = tile.pat;
    ctx.fillRect(x0 / k, y0 / k, (x1 - x0) / k, (y1 - y0) / k);
    ctx.restore();
  }

  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const mixc = (a, b, t) => {
    const A = hex(a);
    const B = hex(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  };

  D.abyssDragon = function (ctx, s, t, o) {
    const ai = o.ai || {};
    const warn = ai.mode === 'warn';
    const skill = warn ? ai.skill : null;
    const k = warn && ai.warnMax ? Math.min(1, Math.max(0, 1 - ai.warnTimer / ai.warnMax)) : 0; // 蓄力进度 0 → 1
    const phase = ai.phase || 1;
    const rage = phase >= 3;
    const angry = phase >= 2;
    const fallen = !!ai.fallen;
    // 变黑的进度：第二条命 = 1；倒下期间从 0 渐变到 1（重生前一刻已经是黑的）
    const rebirth = fallen && ai.rebirthMax ? Math.min(1, Math.max(0, 1 - ai.rebirthTimer / ai.rebirthMax)) : 0;
    const dark = ai.form === 2 ? 1 : rebirth;
    const spd = rage ? 3.2 : 2.2;
    const flap = fallen ? 0.9 : Math.sin(t * spd);
    const flap2 = fallen ? 0.8 : Math.sin(t * spd + 0.8);
    const bob = fallen ? 0 : Math.sin(t * 1.5) * 0.016 * s;

    // 配色（参考设计图「灭世巨龙」）：第一条命是炭黑带暗红的鳞甲 + 岩浆裂纹 + 深红翼膜；第二条命（黑龙）几乎全黑，裂纹和眼睛是血红色
    const BODY = mixc(rage ? '#2a1114' : '#1d1013', '#0b0810', dark);
    const BODY_LIT = mixc(rage ? '#8a3426' : '#6a2a24', '#2e1428', dark);
    const BELLY = mixc('#8a4c30', '#34202c', dark);
    const MEMB = mixc('#a21626', '#2c0a2a', dark);
    const SPIKE = mixc('#8a6a5c', '#6a4a6c', dark);
    const CLAW = mixc('#e2d0b2', '#b8a0b8', dark);
    const RIM = mixc('#ff9a60', '#ff3a6a', dark);
    const EYE = mixc(rage ? '#fff0c0' : '#ffb830', '#ff4a50', dark);
    const LAVA = dark > 0.5 ? '#ff2a5a' : rage ? '#ffd060' : '#ff8a2a';
    const heat = (fallen ? 0.12 + 0.9 * rebirth * rebirth : 0.42 + (angry ? 0.2 : 0) + (rage ? 0.25 : 0) + (skill === 'fire' ? 0.5 * k : 0)) + (dark > 0.5 ? 0.2 : 0);
    const lw = (v) => Math.max(1, s * v);

    // 头的姿态：待机略低头盯着城墙；龙息向前下方；龙吼和雷暴抬头
    const headAng = fallen ? 0.55 - 0.5 * rebirth * rebirth : skill === 'shock' ? 0.42 * k - 0.1 : skill === 'bolt' ? 0.3 * k - 0.1 : skill === 'fire' ? -0.2 - 0.05 * k : -0.12 + Math.sin(t * 1.1) * 0.03;
    const jaw = fallen ? 0.02 + 0.3 * rebirth * rebirth : skill ? 0.1 + (skill === 'fire' ? 0.5 : skill === 'shock' ? 0.62 : 0.3) * k : 0.04 + 0.03 * Math.sin(t * 2.1);

    ctx.save();
    ctx.translate(0, bob + (0.12 + (fallen ? 0.08 * (1 - rebirth * rebirth) : 0)) * s); // 整体下移一点：翼尖和头不要顶到 Boss 血条；倒下时趴得更低，重生时抬起来

    // 背光：身体是炭黑的，要靠红光把轮廓从深紫的背景里托出来
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0.05 * s, -0.12 * s, s * 1.25, dark > 0.5 ? '#ff1a4a' : '#ff4a1a', 0.12 + 0.12 * Math.min(1, heat));
    ctx.restore();

    // 地面上的影子（龙悬在半空，影子落得很远很淡）
    ctx.save();
    ctx.globalAlpha = 0.4;
    shadow(ctx, s * 0.1, s * 0.5 - bob, s * 0.95);
    ctx.restore();

    // ---------- 脊柱：头 → 脖子 → 胸 → 腹 → 尾（x, y, 背侧半宽, 腹侧半宽），单位 s ----------
    const sw = (a, ph) => Math.sin(t * 1.7 + ph) * a;
    const ctl = [
      [-0.93, -0.55, 0.075, 0.075],
      [-0.83, -0.59, 0.085, 0.09],
      [-0.7, -0.5, 0.1, 0.105],
      [-0.64, -0.35, 0.115, 0.125],
      [-0.54, -0.22, 0.14, 0.16],
      [-0.36, -0.12, 0.225, 0.26],
      [-0.08, -0.09, 0.235, 0.3],
      [0.22, -0.08, 0.215, 0.25],
      [0.46, -0.03 + sw(0.01, 0), 0.155, 0.17],
      [0.68, 0.06 + sw(0.04, 0.6), 0.11, 0.115],
      [0.88, 0.13 + sw(0.07, 1.2), 0.075, 0.075],
      [1.03, 0.1 + sw(0.09, 1.8), 0.045, 0.045],
      [1.14, 0.0 + sw(0.1, 2.4), 0.02, 0.02],
    ].map(([x, y, a, b]) => [x * s, y * s, a * s, b * s]);
    const S = spline(ctl, 96);
    const NECK = 38; // 采样点 0..NECK 是脖子，之后是躯干和尾巴
    const TAIL0 = 62; // 尾巴从这里开始变细

    // ---------- 翅膀 ----------
    // 肩 → 肘 → 腕 三节臂骨；腕上长出四根指骨，翼膜撑在指骨之间，后缘是下凹的扇贝；末端连到腰上
    const wing = (sx, sy, rx, ry, f, near) => {
      const a1 = -0.85 + 0.45 * f;
      const E = [sx + Math.cos(a1) * 0.27 * s, sy + Math.sin(a1) * 0.27 * s];
      const a2 = -1.65 + 0.5 * f;
      const W = [E[0] + Math.cos(a2) * 0.31 * s, E[1] + Math.sin(a2) * 0.31 * s];
      const lens = [0.86, 0.9, 0.8, 0.6];
      const tips = lens.map((l, i) => {
        const th = 0.12 + 0.42 * i + 0.22 * f;
        return [W[0] + Math.cos(th) * l * s, W[1] + Math.sin(th) * l * s];
      });
      const R = [rx * s, ry * s];
      const dk = near ? 0 : 0.45; // 远侧的翅膀整体暗一档
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // 翼膜
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(E[0], E[1]);
      ctx.lineTo(W[0], W[1]);
      ctx.lineTo(tips[0][0], tips[0][1]);
      for (let i = 1; i < 4; i++) {
        const [px, py] = tips[i - 1];
        const [tx, ty] = tips[i];
        // 控制点向腕部收：扇贝形的后缘
        ctx.quadraticCurveTo((px + tx) / 2 + (W[0] - (px + tx) / 2) * 0.3, (py + ty) / 2 + (W[1] - (py + ty) / 2) * 0.3, tx, ty);
      }
      ctx.quadraticCurveTo((tips[3][0] + R[0]) / 2 + (W[0] - (tips[3][0] + R[0]) / 2) * 0.2, (tips[3][1] + R[1]) / 2 + (W[1] - (tips[3][1] + R[1]) / 2) * 0.2 + 0.02 * s, R[0], R[1]);
      ctx.closePath();
      ctx.fillStyle = linear(ctx, W[0], W[1], tips[3][0] * 0.7 + R[0] * 0.3, tips[3][1] + 0.1 * s, [
        [0, deep(MEMB, 0.2 + dk)],
        [0.55, deep(MEMB, 0.05 + dk * 0.8)],
        [1, rgba(near ? '#ff7a44' : '#b8442a', near ? 0.8 : 0.55)],
      ]);
      ctx.fill();
      // 翼膜上：指骨之间的褶皱 + 岩浆纹路 + 靠近臂骨的暗影
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = rgba('#1a0610', 0.35);
      ctx.lineWidth = lw(0.006);
      for (let i = 0; i < 3; i++) {
        const mx = (tips[i][0] + tips[i + 1][0]) / 2;
        const my = (tips[i][1] + tips[i + 1][1]) / 2;
        ctx.beginPath();
        ctx.moveTo(W[0], W[1]);
        ctx.quadraticCurveTo((W[0] + mx) / 2 + 0.02 * s, (W[1] + my) / 2 + 0.03 * s, mx, my);
        ctx.stroke();
      }
      for (let i = 0; i < 4; i++) veins(ctx, W[0], W[1], 0.34 * s, Math.atan2(tips[i][1] - W[1], tips[i][0] - W[0]), 1, LAVA, (near ? 0.5 : 0.28) + heat * 0.22, 31 + i * 7 + (near ? 0 : 50), s * 0.011);
      glow(ctx, sx + 0.1 * s, sy, s * 0.3, '#18040a', 0.35);
      ctx.restore();
      // 后缘一圈亮边
      ctx.strokeStyle = rgba('#ffb078', near ? 0.4 : 0.18);
      ctx.lineWidth = lw(0.007);
      ctx.beginPath();
      ctx.moveTo(tips[0][0], tips[0][1]);
      for (let i = 1; i < 4; i++) {
        const [px, py] = tips[i - 1];
        const [tx, ty] = tips[i];
        ctx.quadraticCurveTo((px + tx) / 2 + (W[0] - (px + tx) / 2) * 0.3, (py + ty) / 2 + (W[1] - (py + ty) / 2) * 0.3, tx, ty);
      }
      ctx.stroke();
      // 指骨：粗 → 细
      ctx.strokeStyle = deep(SPIKE, 0.25 + dk);
      for (const [tx, ty] of tips) {
        // 指尖的钩爪：顺着指骨再延伸出去一截
        const fa = Math.atan2(ty - W[1], tx - W[0]);
        ctx.fillStyle = deep(CLAW, dk);
        ctx.beginPath();
        ctx.moveTo(tx - Math.cos(fa) * 0.01 * s + Math.sin(fa) * 0.014 * s, ty - Math.sin(fa) * 0.01 * s - Math.cos(fa) * 0.014 * s);
        ctx.quadraticCurveTo(tx + Math.cos(fa) * 0.05 * s, ty + Math.sin(fa) * 0.05 * s + 0.01 * s, tx + Math.cos(fa) * 0.1 * s, ty + Math.sin(fa) * 0.1 * s + 0.045 * s);
        ctx.quadraticCurveTo(tx + Math.cos(fa) * 0.05 * s, ty + Math.sin(fa) * 0.05 * s - 0.005 * s, tx - Math.cos(fa) * 0.01 * s - Math.sin(fa) * 0.014 * s, ty - Math.sin(fa) * 0.01 * s + Math.cos(fa) * 0.014 * s);
        ctx.fill();
        ctx.lineWidth = lw(0.016);
        ctx.beginPath();
        ctx.moveTo(W[0], W[1]);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.fillStyle = deep(SPIKE, 0.2 + dk);
        ctx.beginPath();
        ctx.arc(tx, ty, lw(0.014), 0, TAU);
        ctx.fill();
      }
      // 臂骨：带肌肉的粗臂（肩粗腕细），骨色高光
      const arm = spline([[sx, sy, 0.04 * s, 0.04 * s], [E[0], E[1], 0.028 * s, 0.028 * s], [W[0], W[1], 0.018 * s, 0.018 * s]], 14);
      ribbonPath(ctx, arm);
      ctx.fillStyle = linear(ctx, sx, sy - 0.1 * s, sx, sy + 0.1 * s, [[0, deep(BODY_LIT, 0.1 + dk)], [1, deep(BODY, 0.5 + dk)]]);
      ctx.fill();
      ctx.strokeStyle = rgba(RIM, near ? 0.45 : 0.2);
      ctx.lineWidth = lw(0.005);
      ctx.stroke();
      // 腕上的钩爪（翼拇指）
      ctx.fillStyle = deep(CLAW, dk);
      ctx.beginPath();
      ctx.moveTo(W[0] - 0.02 * s, W[1] - 0.01 * s);
      ctx.quadraticCurveTo(W[0] - 0.06 * s, W[1] - 0.06 * s, W[0] - 0.13 * s, W[1] - 0.08 * s);
      ctx.quadraticCurveTo(W[0] - 0.07 * s, W[1] - 0.03 * s, W[0] + 0.02 * s, W[1] + 0.02 * s);
      ctx.fill();
      ctx.restore();
      return { W, tips, E };
    };
    wing(-0.02 * s, -0.27 * s, 0.38, -0.08, flap2, false);

    // ---------- 肢体：大腿 / 小腿 / 脚三段的肌肉轮廓 + 趾爪 ----------
    const limb = (pts, dark, claw) => {
      const L = spline(pts.map(([x, y, w]) => [x * s, y * s, w * s, w * s]), 18);
      ribbonPath(ctx, L);
      ctx.fillStyle = linear(ctx, pts[0][0] * s, pts[0][1] * s - 0.1 * s, pts[0][0] * s, pts[0][1] * s + 0.3 * s, [[0, deep(BODY_LIT, dark + 0.3)], [0.5, deep(BODY, dark)], [1, deep(BODY, 0.7 + dark * 0.3)]]);
      ctx.fill();
      ctx.save();
      ctx.clip();
      veins(ctx, pts[0][0] * s, pts[0][1] * s, 0.25 * s, 1.6, 1, LAVA, 0.3 + heat * 0.4, 61 + Math.round(pts[0][0] * 10), s * 0.011);
      glow(ctx, pts[1][0] * s, pts[1][1] * s, s * 0.07, LAVA, 0.25 + heat * 0.3);
      ctx.restore();
      ctx.strokeStyle = rgba(RIM, 0.2 + 0.3 * (1 - dark));
      ctx.lineWidth = lw(0.006);
      ctx.stroke();
      // 趾爪：向前（左）下方弯的三根
      const [fx, fy] = [pts[pts.length - 1][0] * s, pts[pts.length - 1][1] * s];
      ctx.fillStyle = deep(CLAW, dark * 0.5);
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(fx + i * 0.022 * s - 0.01 * s, fy - 0.01 * s);
        ctx.quadraticCurveTo(fx + (i * 0.04 - 0.06 * claw) * s, fy + 0.05 * s, fx + (i * 0.05 - 0.11 * claw) * s, fy + 0.1 * s);
        ctx.quadraticCurveTo(fx + (i * 0.03 - 0.02) * s, fy + 0.03 * s, fx + i * 0.022 * s + 0.02 * s, fy - 0.01 * s);
        ctx.fill();
      }
    };
    const sway = Math.sin(t * 1.5) * 0.015;
    // 远侧后腿 / 前腿（暗一点，躲在身体后面）
    limb([[0.4, -0.02, 0.1], [0.34, 0.18, 0.065], [0.5, 0.28 + sway, 0.035], [0.4, 0.44 + sway, 0.026]], 0.5, 1);
    limb([[-0.22, 0.04, 0.075], [-0.2, 0.22, 0.045], [-0.3, 0.3 - sway, 0.03], [-0.38, 0.38 - sway, 0.022]], 0.5, 1);

    // ---------- 尾巴的骨刺背脊和尾尖的刃（画在身体之前，被身体盖住一部分） ----------
    {
      const e = S[S.length - 1];
      ctx.save();
      ctx.translate(e[0], e[1]);
      ctx.rotate(Math.atan2(e.ty, e.tx));
      ctx.beginPath();
      ctx.moveTo(-0.02 * s, 0);
      ctx.quadraticCurveTo(0.03 * s, -0.09 * s, 0.17 * s, 0);
      ctx.quadraticCurveTo(0.03 * s, 0.09 * s, -0.02 * s, 0);
      ctx.fillStyle = linear(ctx, 0, -0.07 * s, 0.17 * s, 0, [[0, deep(BODY_LIT, 0.1)], [1, deep(SPIKE, 0.1)]]);
      ctx.fill();
      ctx.strokeStyle = rgba('#140404', 0.75);
      ctx.lineWidth = lw(0.005);
      ctx.stroke();
      ctx.restore();
    }

    // ---------- 躯干 + 脖子 + 尾巴：一个连续的轮廓 ----------
    const bodyPath = () => ribbonPath(ctx, S);
    const { top, bot } = bodyPath();
    ctx.fillStyle = linear(ctx, 0, -0.62 * s, 0, 0.3 * s, [[0, deep(BODY_LIT, 0.0)], [0.38, BODY], [1, deep(BODY, 0.82)]]);
    ctx.fill();
    ctx.save();
    bodyPath();
    ctx.clip();
    // 受光：从右上来，背脊上一条亮带；腹下一条暗带
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = rgba(RIM, 0.22);
    ctx.lineWidth = s * 0.1;
    polyline(ctx, top);
    ctx.stroke();
    ctx.strokeStyle = rgba(RIM, 0.55);
    ctx.lineWidth = s * 0.03;
    polyline(ctx, top);
    ctx.stroke();
    ctx.strokeStyle = rgba('#0a0204', 0.4);
    ctx.lineWidth = s * 0.17;
    polyline(ctx, bot);
    ctx.stroke();
    // 腹甲：脖子下缘到尾根的金色宽带，横向分成一块块甲片
    {
      const inner = S.map((p) => [p[0] - p.ty * p[3] * 0.42, p[1] + p.tx * p[3] * 0.42]);
      const a = 4;
      const b = 80;
      ctx.beginPath();
      for (let i = a; i <= b; i++) (i === a ? ctx.moveTo : ctx.lineTo).call(ctx, bot[i][0], bot[i][1]);
      for (let i = b; i >= a; i--) ctx.lineTo(inner[i][0], inner[i][1]);
      ctx.closePath();
      ctx.fillStyle = linear(ctx, 0, -0.1 * s, 0, 0.3 * s, [[0, rgba(BELLY, 0.55)], [1, deep(BELLY, 0.25)]]);
      ctx.fill();
      ctx.strokeStyle = rgba('#6a3a10', 0.6);
      ctx.lineWidth = lw(0.005);
      for (let i = a + 1; i <= b; i += 3) {
        ctx.beginPath();
        ctx.moveTo(bot[i][0], bot[i][1]);
        ctx.lineTo(inner[i][0] + S[i].tx * 0.012 * s, inner[i][1] + S[i].ty * 0.012 * s);
        ctx.stroke();
      }
    }
    // 鳞片（只画一遍，别的靠渐变）
    scaleFill(ctx, -0.95 * s, -0.7 * s, 1.15 * s, 0.35 * s, s * 0.055, '#140404', 0.6);
    // 鳞片之间透出的岩浆光（加亮叠加）
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(0.75, 0.2 + heat * 0.4);
    scaleFill(ctx, -0.95 * s, -0.7 * s, 1.15 * s, 0.35 * s, s * 0.055, LAVA, 0.5);
    ctx.restore();
    // 岩浆裂纹：沿背脊、肩、胸、腹、尾根一路裂开（参考图里鳞甲之间透出的熔岩光），加亮叠加
    veins(ctx, -0.02 * s, -0.12 * s, 0.4 * s, -0.35, 3, LAVA, 0.45 + heat * 0.6, 3, s * 0.02);
    veins(ctx, 0.3 * s, -0.14 * s, 0.34 * s, -0.7, 3, LAVA, 0.4 + heat * 0.55, 9, s * 0.018);
    veins(ctx, -0.22 * s, -0.16 * s, 0.26 * s, -2.6, 2, LAVA, 0.4 + heat * 0.5, 15, s * 0.016);
    veins(ctx, 0.1 * s, 0.05 * s, 0.3 * s, 0.3, 2, LAVA, 0.35 + heat * 0.5, 21, s * 0.015);
    veins(ctx, -0.5 * s, -0.2 * s, 0.22 * s, -1.5, 2, LAVA, 0.35 + heat * 0.45, 27, s * 0.013);
    veins(ctx, 0.62 * s, 0.0, 0.3 * s, 0.1, 2, LAVA, 0.3 + heat * 0.4, 33, s * 0.012);
    glow(ctx, -0.36 * s, -0.06 * s, s * (0.18 + 0.1 * (skill === 'fire' ? k : 0)), LAVA, 0.3 + heat * 0.5);
    glow(ctx, 0.0, -0.12 * s, s * 0.22, LAVA, 0.12 + heat * 0.25);
    ctx.restore();
    // 轮廓线（细、暗）+ 受光边
    bodyPath();
    ctx.strokeStyle = rgba('#120304', 0.85);
    ctx.lineWidth = lw(0.007);
    ctx.stroke();
    K.rimEdge(ctx, bodyPath, '#ffb890', 0.3, s * 0.012, s * 0.012, s * 0.012);

    // 脊背上的骨刺：沿背侧轮廓，朝后倾；脖子上密而小，肩背最大，尾巴上渐小
    const spikeCol = deep(SPIKE, 0.15);
    for (let i = 3; i < S.length - 2; i += 3) {
      const p = S[i];
      const base = p[2];
      const h = Math.max(0.012 * s, (i < NECK ? 0.05 : i < TAIL0 ? 0.115 : 0.07) * s * (1 - Math.max(0, (i - TAIL0) / (S.length - TAIL0)) * 0.8));
      const [bx, by] = top[i];
      const nx = p.ty;
      const ny = -p.tx;
      const back = 0.5;
      const hw = Math.max(0.01 * s, base * 0.24);
      ctx.beginPath();
      ctx.moveTo(bx - p.tx * hw, by - p.ty * hw);
      ctx.lineTo(bx + (nx * 1 + p.tx * back) * h, by + (ny * 1 + p.ty * back) * h);
      ctx.lineTo(bx + p.tx * hw, by + p.ty * hw);
      ctx.closePath();
      ctx.fillStyle = spikeCol;
      ctx.fill();
      ctx.strokeStyle = rgba(RIM, 0.5);
      ctx.lineWidth = lw(0.004);
      ctx.stroke();
    }

    // ---------- 头 ----------
    const Hp = S[0];
    const hx = Hp[0] + 0.02 * s;
    const hy = Hp[1] + 0.01 * s;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(headAng);
    ctx.scale(1.12, 1.12);
    const skull = [
      [0.1, -0.11], [0.0, -0.145], [-0.1, -0.155], [-0.17, -0.115], [-0.3, -0.085], [-0.4, -0.06], [-0.435, -0.025],
      [-0.42, 0.012], [-0.3, 0.032], [-0.15, 0.042], [-0.02, 0.07], [0.07, 0.1], [0.13, 0.0],
    ].map(([x, y]) => [x * s, y * s]);
    const jawPts = [
      [-0.0, 0.04], [-0.18, 0.052], [-0.34, 0.045], [-0.395, 0.062], [-0.385, 0.092], [-0.24, 0.125], [-0.07, 0.15], [0.05, 0.13], [0.07, 0.07],
    ].map(([x, y]) => [x * s, y * s]);

    // 脖子上、头后面的鬃刺（先画，躲在头后面）
    ctx.fillStyle = deep(SPIKE, 0.55);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo((0.08 + i * 0.03) * s, (-0.07 + i * 0.045) * s);
      ctx.lineTo((0.2 + i * 0.03) * s, (-0.1 + i * 0.06) * s);
      ctx.lineTo((0.11 + i * 0.03) * s, (-0.01 + i * 0.045) * s);
      ctx.fill();
    }
    // 双角：一对向后弯的粗角，近的亮、远的暗
    for (const [x0, y0, d, rot] of [[0.1, -0.1, 0.55, 0.12], [0.08, -0.11, 0.0, -0.1]]) {
      const hn = spline([[x0 * s, y0 * s, 0.03 * s, 0.03 * s], [(x0 + 0.13) * s, (y0 - 0.07 + rot * 0.2) * s, 0.032 * s, 0.032 * s], [(x0 + 0.27) * s, (y0 - 0.06 + rot * 0.2) * s, 0.019 * s, 0.019 * s], [(x0 + 0.42) * s, (y0 + 0.07 + rot * 0.2) * s, 0.003 * s, 0.003 * s]], 14);
      ribbonPath(ctx, hn);
      ctx.fillStyle = linear(ctx, x0 * s, y0 * s, (x0 + 0.42) * s, y0 * s, [[0, deep(SPIKE, 0.45 - d * 0.5)], [1, light(SPIKE, 0.05)]]);
      ctx.fill();
      ctx.strokeStyle = rgba(RIM, 0.45 + 0.3 * d);
      ctx.lineWidth = lw(0.004);
      ctx.stroke();
    }
    // 颧骨刺（下颌后上方的一对短刺）
    ctx.fillStyle = deep(SPIKE, 0.2);
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo((0.04 + i * 0.05) * s, (0.03 + i * 0.045) * s);
      ctx.lineTo((0.19 + i * 0.03) * s, (0.07 + i * 0.075) * s);
      ctx.lineTo((0.07 + i * 0.05) * s, (0.1 + i * 0.045) * s);
      ctx.fill();
    }
    // 下颌（绕铰链张开）
    ctx.save();
    ctx.translate(0.05 * s, 0.07 * s);
    ctx.rotate(jaw);
    ctx.translate(-0.05 * s, -0.07 * s);
    // 嘴里的火光（张嘴的缝里）：喷火蓄力越久越亮；平时是暗红
    const mouthA = skill === 'fire' ? 0.35 + 0.65 * k : skill ? 0.3 : 0.14 + (angry ? 0.14 : 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, -0.25 * s, 0.03 * s, s * (0.12 + (skill === 'fire' ? 0.2 * k : 0.03)), '#ff9a3a', mouthA, true);
    ctx.restore();
    closedPath(ctx, jawPts);
    ctx.fillStyle = linear(ctx, 0, 0.04 * s, 0, 0.15 * s, [[0, deep(BODY, 0.55)], [1, deep(BODY, 0.85)]]);
    ctx.fill();
    ctx.strokeStyle = rgba('#120304', 0.85);
    ctx.lineWidth = lw(0.005);
    ctx.stroke();
    // 下颌的牙（向上）
    ctx.fillStyle = '#f4ecd0';
    for (let i = 0; i < 5; i++) {
      const x = (-0.36 + i * 0.062) * s;
      ctx.beginPath();
      ctx.moveTo(x, 0.052 * s);
      ctx.lineTo(x + 0.013 * s, 0.052 * s - (i === 0 ? 0.052 : 0.036) * s);
      ctx.lineTo(x + 0.028 * s, 0.05 * s);
      ctx.fill();
    }
    // 下巴上的几根尖刺
    ctx.fillStyle = deep(SPIKE, 0.3);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo((-0.2 + i * 0.07) * s, 0.12 * s);
      ctx.lineTo((-0.17 + i * 0.07) * s, 0.18 * s);
      ctx.lineTo((-0.13 + i * 0.07) * s, 0.135 * s);
      ctx.fill();
    }
    ctx.restore();
    // 颅骨 + 上颌
    closedPath(ctx, skull);
    ctx.fillStyle = linear(ctx, 0.1 * s, -0.16 * s, -0.3 * s, 0.07 * s, [[0, deep(BODY_LIT, 0.0)], [0.55, BODY], [1, deep(BODY, 0.55)]]);
    ctx.fill();
    ctx.save();
    closedPath(ctx, skull);
    ctx.clip();
    scaleFill(ctx, -0.45 * s, -0.17 * s, 0.14 * s, 0.1 * s, s * 0.035, '#140404', 0.45);
    // 眉骨的高光、嘴角的暗影
    ctx.strokeStyle = rgba('#ffa880', 0.35);
    ctx.lineWidth = s * 0.016;
    ctx.beginPath();
    ctx.moveTo(-0.17 * s, -0.12 * s);
    ctx.quadraticCurveTo(-0.1 * s, -0.16 * s, 0.0 * s, -0.145 * s);
    ctx.stroke();
    ctx.strokeStyle = rgba('#0a0204', 0.4);
    ctx.lineWidth = s * 0.03;
    ctx.beginPath();
    ctx.moveTo(-0.4 * s, 0.03 * s);
    ctx.lineTo(0.05 * s, 0.075 * s);
    ctx.stroke();
    veins(ctx, 0.02 * s, -0.03 * s, 0.16 * s, 3.3, 1, LAVA, 0.3 + heat * 0.4, 41, s * 0.007);
    ctx.restore();
    ctx.strokeStyle = rgba('#120304', 0.9);
    ctx.lineWidth = lw(0.006);
    closedPath(ctx, skull);
    ctx.stroke();
    K.rimEdge(ctx, () => closedPath(ctx, skull), '#ffb890', 0.3, s * 0.01, s * 0.008, s * 0.008);
    // 头冠：眉骨后面一排向后倾的尖刺，鼻梁上也有（参考图里的"龙冠"）
    ctx.fillStyle = deep(SPIKE, 0.1);
    ctx.strokeStyle = rgba(RIM, 0.55);
    ctx.lineWidth = lw(0.004);
    for (const [x, y, h] of [[-0.14, -0.14, 0.07], [-0.08, -0.155, 0.1], [-0.01, -0.148, 0.115], [0.05, -0.13, 0.1], [0.1, -0.1, 0.075]]) {
      ctx.beginPath();
      ctx.moveTo((x - 0.025) * s, (y + 0.012) * s);
      ctx.lineTo((x + h * 0.9) * s, (y - h * 0.8) * s);
      ctx.lineTo((x + 0.03) * s, (y + 0.02) * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // 上颌的牙（向下），最前面一对是獠牙
    ctx.fillStyle = '#f4ecd0';
    for (let i = 0; i < 6; i++) {
      const x = (-0.4 + i * 0.058) * s;
      const hgt = (i === 1 ? 0.06 : 0.038) * s;
      ctx.beginPath();
      ctx.moveTo(x, 0.026 * s);
      ctx.lineTo(x + 0.014 * s, 0.026 * s + hgt);
      ctx.lineTo(x + 0.03 * s, 0.032 * s);
      ctx.fill();
    }
    // 鼻孔 + 鼻梁上的突起；生气时喷火星 / 烟
    const nx = -0.395 * s;
    const ny = -0.03 * s;
    ctx.fillStyle = '#100303';
    ctx.beginPath();
    ctx.ellipse(nx, ny, s * 0.014, s * 0.008, -0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = deep(SPIKE, 0.45);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo((-0.34 + i * 0.06) * s, (-0.08 + i * 0.012) * s);
      ctx.lineTo((-0.32 + i * 0.06) * s, (-0.115 + i * 0.012) * s);
      ctx.lineTo((-0.29 + i * 0.06) * s, (-0.09 + i * 0.012) * s);
      ctx.fill();
    }
    if (angry || skill === 'fire') {
      const rr = seeded(9);
      for (let i = 0; i < 6; i++) {
        const f = (t * 1.2 + rr()) % 1;
        const px = nx - f * 0.12 * s - rr() * 0.02 * s;
        const py = ny - f * 0.14 * s - Math.sin(f * 6 + i) * 0.01 * s;
        ctx.globalAlpha = (1 - f) * 0.8;
        glow(ctx, px, py, s * (0.012 + f * 0.015), i % 2 ? '#ffd070' : '#ff6a2a', 0.9);
      }
      ctx.globalAlpha = 1;
    }
    // 眼睛：杏仁形、竖瞳，压在眉骨下，发着火光（狂暴时发白）
    {
      const ex = -0.115 * s;
      const ey = -0.08 * s;
      const ec = EYE;
      glow(ctx, ex, ey, s * 0.075, ec, 0.75);
      ctx.beginPath();
      ctx.moveTo(ex + 0.045 * s, ey - 0.028 * s);
      ctx.quadraticCurveTo(ex - 0.005 * s, ey - 0.03 * s, ex - 0.05 * s, ey + 0.012 * s);
      ctx.quadraticCurveTo(ex - 0.0 * s, ey + 0.026 * s, ex + 0.045 * s, ey - 0.028 * s);
      ctx.fillStyle = ec;
      ctx.fill();
      ctx.fillStyle = '#2a0404';
      ctx.beginPath();
      ctx.ellipse(ex - 0.004 * s, ey - 0.002 * s, s * 0.0065, s * 0.017, -0.5, 0, TAU);
      ctx.fill();
      // 眉骨压下来的怒意
      ctx.strokeStyle = deep(BODY, 0.8);
      ctx.lineWidth = s * 0.016;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex + s * 0.06, ey - s * 0.05);
      ctx.lineTo(ex - s * 0.065, ey - s * 0.008);
      ctx.stroke();
    }
    ctx.restore(); // 头

    // ---------- 近侧的腿（盖在身体前面）：大腿肌肉鼓出来 ----------
    limb([[0.3, -0.05, 0.135], [0.2, 0.16, 0.085], [0.4, 0.28 - sway, 0.045], [0.3, 0.46 - sway, 0.03]], 0.0, 1);
    limb([[-0.3, 0.0, 0.095], [-0.26, 0.21, 0.058], [-0.38, 0.3 + sway, 0.035], [-0.47, 0.39 + sway, 0.025]], 0.0, 1);

    // ---------- 近侧的翅膀（在最前面） ----------
    const nw = wing(-0.12 * s, -0.27 * s, 0.32, -0.13, flap, true);

    // ---------- 技能预备的特效 ----------
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cosA = Math.cos(headAng);
    const sinA = Math.sin(headAng);
    const mouth = [hx + (-0.44 * cosA - 0.03 * sinA) * s, hy + (-0.44 * sinA + 0.03 * cosA) * s]; // 嘴尖的世界坐标
    if (skill === 'bolt') {
      // 雷暴：翼尖、角尖之间窜动的电弧，越来越密
      const fr = Math.floor(t * 14);
      const n = 2 + Math.round(k * 5);
      for (let i = 0; i < n; i++) {
        const [tx, ty] = nw.tips[i % 4];
        veins(ctx, tx, ty, 0.24 * s, -1.6 + (i % 3) * 0.5, 2, '#bfe4ff', 0.5 + 0.4 * k, fr * 5 + i * 11, s * 0.014);
      }
      veins(ctx, hx + 0.2 * s, hy - 0.15 * s, 0.3 * s, -1.0, 2, '#e8f4ff', 0.6 + 0.35 * k, fr * 7, s * 0.016);
      glow(ctx, 0, -0.1 * s, s * (0.5 + 0.3 * k), '#9fd0ff', 0.12 + 0.2 * k);
    } else if (skill === 'shock') {
      // 龙吼：头前一圈圈向外扩的声波
      for (let i = 0; i < 3; i++) {
        const f = (k * 1.6 + i * 0.33) % 1;
        ctx.strokeStyle = rgba('#ffe0b0', (1 - f) * (0.25 + 0.5 * k));
        ctx.lineWidth = s * 0.02 * (1 - f * 0.6);
        ctx.beginPath();
        ctx.arc(mouth[0] + 0.05 * s, mouth[1], s * (0.08 + f * 0.5), 0.55 * Math.PI, 1.45 * Math.PI);
        ctx.stroke();
      }
      glow(ctx, mouth[0] + 0.1 * s, mouth[1], s * 0.4, '#ffd8a0', 0.18 * k);
    } else if (skill === 'fire') {
      // 龙息：嘴边的火越聚越大
      glow(ctx, mouth[0] + 0.02 * s, mouth[1], s * (0.12 + 0.34 * k), '#ffd070', 0.35 + 0.5 * k, true);
    }
    // 狂暴：整条龙裹着一层红光，身上冒火星
    if (rage) {
      glow(ctx, 0, -0.1 * s, s * 1.1, '#ff3a1a', 0.14 + 0.06 * Math.sin(t * 6));
      const rr = seeded(17);
      for (let i = 0; i < 12; i++) {
        const f = (t * 0.7 + rr()) % 1;
        const px = (rr() - 0.5) * 1.8 * s;
        const py = -0.1 * s - f * 0.6 * s;
        ctx.globalAlpha = (1 - f) * 0.8;
        glow(ctx, px, py, s * 0.015 * (1 + rr()), i % 2 ? '#ffb040' : '#ff5a2a', 0.9);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    ctx.restore();
  };
})((globalThis.TD = globalThis.TD || {}));
