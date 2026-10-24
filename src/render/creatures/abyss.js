// 深渊回响（第 11–20 章）的终章 Boss：焚天巨龙（设计书 114）
// 西方神话里的巨龙：侧面像，朝左（城墙方向）。坐标约定同 creatures.js：s 是 def.size（250），身体中心就在原点附近
// （原点 = 悬停高度的身体中心，不是脚下）；向上为负。宽约 2.3 s，翼尖高约 0.75 s。
// 状态（o.ai）：mode === 'warn' 时按 skill（fire / shock / bolt）和蓄力进度做预备动作；phase 3 狂暴。
(function (TD) {
  'use strict';

  const K = TD.creatures;
  const D = K.drawers;
  const TAU = Math.PI * 2;
  const { deep, light, rgba, glow, shadow, veins, scales, seeded, linear } = K;

  // 沿贝塞尔曲线取点
  function bez(p0, p1, p2, p3, u) {
    const v = 1 - u;
    return [
      v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
      v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1],
    ];
  }

  // 沿曲线串一串圆，半径从 r0 渐变到 r1：并集就是一条粗细渐变的"肉管"（脖子、尾巴）
  function tube(ctx, pts, r0, r1) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const r = r0 + (r1 - r0) * (i / (pts.length - 1));
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, TAU);
    });
  }

  D.abyssDragon = function (ctx, s, t, o) {
    const ai = o.ai || {};
    const warn = ai.mode === 'warn';
    const skill = warn ? ai.skill : null;
    const k = warn && ai.warnMax ? Math.min(1, Math.max(0, 1 - ai.warnTimer / ai.warnMax)) : 0; // 蓄力进度 0 → 1
    const rage = (ai.phase || 1) >= 3;
    const angry = (ai.phase || 1) >= 2;
    const flap = Math.sin(t * (rage ? 3.4 : 2.3));
    const flap2 = Math.sin(t * (rage ? 3.4 : 2.3) + 0.9);
    const bob = Math.sin(t * 1.5) * 0.014 * s;

    // 配色：深红的龙鳞、金色的腹甲、暗紫红的翼膜、岩浆一样的纹路
    const BODY = rage ? '#7a1010' : '#5e1616';
    const BELLY = '#e0a85a';
    const MEMB = '#7a1840';
    const BONE = '#e8d6a8';
    const LAVA = rage ? '#ffd060' : '#ff8a2a';
    const heat = 0.25 + (angry ? 0.2 : 0) + (rage ? 0.25 : 0) + (skill === 'fire' ? 0.5 * k : 0);

    ctx.save();
    ctx.translate(0, bob);

    // 地面上的影子（龙悬在半空，影子落得很远很淡）
    ctx.save();
    ctx.globalAlpha = 0.45;
    shadow(ctx, s * 0.1, s * 0.48 - bob, s * 0.95);
    ctx.restore();

    // ---------- 关键点 ----------
    const headTilt = skill === 'shock' ? -0.3 * k : skill === 'fire' ? -0.1 * k : skill === 'bolt' ? -0.2 * k : 0;
    const H = [-0.9 * s, -0.5 * s + (skill === 'shock' ? -0.07 * s * k : 0)]; // 头的位置
    const jaw = skill ? 0.12 + 0.5 * k : 0.05 + 0.03 * Math.sin(t * 2);
    const chest = [-0.26 * s, -0.16 * s];

    // ---------- 远侧的翅膀（深一点，在身体后面） ----------
    const wingDraw = (sx, sy, a0, flapv, near) => {
      // 肩 (sx, sy)；臂沿 a0 + 扇动 伸到腕；四根指骨从腕向后向下撒开，翼膜在指骨之间下凹
      const a = a0 + flapv * 0.3;
      const L = 0.46 * s;
      const W = [sx + Math.cos(a) * L, sy + Math.sin(a) * L];
      const E = [sx + Math.cos(a - 0.35) * L * 0.55, sy + Math.sin(a - 0.35) * L * 0.55 - 0.04 * s]; // 肘（臂略弯）
      const base = 0.35 - flapv * 0.18; // 指骨的起始方向（向后）
      const tips = [0, 1, 2, 3].map((i) => {
        const b = base + i * 0.5 - flapv * 0.12 * i;
        const len = [0.62, 0.7, 0.62, 0.46][i] * s * (1 + flapv * 0.05);
        return [W[0] + Math.cos(b) * len, W[1] + Math.sin(b) * len];
      });
      const rear = [0.5 * s, -0.04 * s];
      ctx.save();
      // 翼膜
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(E[0], E[1]);
      ctx.lineTo(W[0], W[1]);
      for (let i = 0; i < 4; i++) {
        const [tx, ty] = tips[i];
        const [px, py] = i ? tips[i - 1] : W;
        ctx.quadraticCurveTo((px + tx) / 2 - 0.02 * s, (py + ty) / 2 + 0.05 * s, tx, ty);
      }
      ctx.quadraticCurveTo((tips[3][0] + rear[0]) / 2 - 0.05 * s, (tips[3][1] + rear[1]) / 2 + 0.06 * s, rear[0], rear[1]);
      ctx.closePath();
      const g = linear(ctx, sx, sy - 0.2 * s, tips[3][0], tips[3][1], [[0, deep(MEMB, near ? 0.25 : 0.55)], [0.6, deep(MEMB, near ? 0.45 : 0.7)], [1, rgba('#ff7a3a', near ? 0.55 : 0.3)]]);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = rgba('#14060a', 0.9);
      ctx.lineWidth = Math.max(1.5, s * 0.008);
      ctx.stroke();
      // 翼膜上透出的岩浆纹路
      ctx.save();
      ctx.clip();
      for (let i = 0; i < 4; i++) veins(ctx, W[0], W[1], 0.3 * s, Math.atan2(tips[i][1] - W[1], tips[i][0] - W[0]), 1, LAVA, (near ? 0.5 : 0.28) + heat * 0.25, 31 + i * 7 + (near ? 0 : 50), s * 0.012);
      ctx.restore();
      // 臂骨和指骨
      ctx.strokeStyle = deep(BONE, near ? 0.25 : 0.55);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = s * 0.034;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(E[0], E[1]);
      ctx.lineTo(W[0], W[1]);
      ctx.stroke();
      ctx.lineWidth = s * 0.018;
      for (const [tx, ty] of tips) {
        ctx.beginPath();
        ctx.moveTo(W[0], W[1]);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
      // 腕上的爪
      ctx.fillStyle = BONE;
      ctx.beginPath();
      ctx.moveTo(W[0], W[1]);
      ctx.lineTo(W[0] - 0.05 * s, W[1] - 0.09 * s);
      ctx.lineTo(W[0] + 0.03 * s, W[1] - 0.02 * s);
      ctx.fill();
      ctx.restore();
      return { W, tips };
    };
    wingDraw(-0.02 * s, -0.3 * s, -1.2, flap2, false);

    // ---------- 尾巴（粗 → 细，尖端是一枚骨刺） ----------
    const tailSpine = [];
    {
      const p0 = [0.5 * s, -0.04 * s];
      const p1 = [0.9 * s, 0.08 * s + Math.sin(t * 1.8) * 0.06 * s];
      const p2 = [1.0 * s, -0.12 * s + Math.sin(t * 1.8 + 1.4) * 0.07 * s];
      const p3 = [1.12 * s, 0.14 * s + Math.sin(t * 1.8 + 0.5) * 0.06 * s];
      for (let i = 0; i <= 22; i++) tailSpine.push(bez(p0, p1, p2, p3, i / 22));
    }
    tube(ctx, tailSpine, 0.17 * s, 0.015 * s);
    ctx.fillStyle = linear(ctx, 0.6 * s, -0.2 * s, 1.1 * s, 0.2 * s, [[0, deep(BODY, 0.1)], [1, deep(BODY, 0.65)]]);
    ctx.fill();
    // 尾巴上的背刺
    ctx.fillStyle = deep(BONE, 0.25);
    for (let i = 3; i < 21; i += 2) {
      const [x, y] = tailSpine[i];
      const r = (0.17 - 0.155 * (i / 22)) * s;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.5, y - r * 0.9);
      ctx.lineTo(x, y - r * 1.9);
      ctx.lineTo(x + r * 0.5, y - r * 0.9);
      ctx.fill();
    }
    {
      // 尾尖的骨刺
      const [x, y] = tailSpine[22];
      const [px, py] = tailSpine[19];
      const ang = Math.atan2(y - py, x - px);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.fillStyle = BONE;
      ctx.beginPath();
      ctx.moveTo(-0.02 * s, 0);
      ctx.lineTo(0.02 * s, -0.07 * s);
      ctx.lineTo(0.14 * s, 0);
      ctx.lineTo(0.02 * s, 0.07 * s);
      ctx.fill();
      ctx.restore();
    }

    // ---------- 后腿（在身体后面的那条）和前腿 ----------
    const leg = (x0, y0, kx, ky, px, py, dark, scale) => {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = deep(BODY, dark);
      ctx.lineWidth = s * 0.1 * scale;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(kx, ky);
      ctx.stroke();
      ctx.lineWidth = s * 0.065 * scale;
      ctx.beginPath();
      ctx.moveTo(kx, ky);
      ctx.lineTo(px, py);
      ctx.stroke();
      // 爪子
      ctx.fillStyle = BONE;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(px + i * 0.035 * s - 0.02 * s, py);
        ctx.lineTo(px + i * 0.045 * s - 0.06 * s, py + 0.09 * s);
        ctx.lineTo(px + i * 0.035 * s + 0.02 * s, py);
        ctx.fill();
      }
      ctx.restore();
    };
    const sway = Math.sin(t * 1.5) * 0.02 * s;
    leg(0.32 * s, 0.0, 0.42 * s, 0.17 * s + sway, 0.3 * s, 0.36 * s + sway, 0.75, 0.9); // 远侧后腿
    leg(-0.08 * s, 0.0, 0.0, 0.17 * s - sway, -0.14 * s, 0.34 * s - sway, 0.75, 0.9); // 远侧前腿

    // ---------- 躯干 ----------
    const torso = () => {
      ctx.beginPath();
      ctx.ellipse(0.12 * s, -0.1 * s, 0.52 * s, 0.29 * s, -0.12, 0, TAU);
    };
    // 脖子：从胸口弯向头
    const neckSpine = [];
    {
      const p0 = [chest[0] + 0.08 * s, chest[1] + 0.02 * s];
      const p1 = [-0.55 * s, -0.12 * s];
      const p2 = [-0.62 * s, -0.5 * s + headTilt * 0.1 * s];
      const p3 = [H[0] + 0.1 * s, H[1] + 0.05 * s];
      for (let i = 0; i <= 14; i++) neckSpine.push(bez(p0, p1, p2, p3, i / 14));
    }
    // 把脖子和躯干画进同一条路径，一次填色
    ctx.beginPath();
    ctx.ellipse(0.12 * s, -0.1 * s, 0.52 * s, 0.29 * s, -0.12, 0, TAU);
    neckSpine.forEach(([x, y], i) => {
      const r = (0.2 - 0.1 * (i / 14)) * s;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, TAU);
    });
    ctx.fillStyle = linear(ctx, 0.5 * s, -0.5 * s, -0.5 * s, 0.2 * s, [[0, deep(BODY, 0.0)], [0.5, deep(BODY, 0.35)], [1, deep(BODY, 0.75)]]);
    ctx.fill();
    ctx.save();
    ctx.clip();
    // 腹甲：身体下缘和脖子下缘的金色横纹
    ctx.fillStyle = linear(ctx, 0, -0.1 * s, 0, 0.2 * s, [[0, rgba(BELLY, 0)], [0.5, rgba(BELLY, 0.85)], [1, rgba(BELLY, 0.95)]]);
    ctx.beginPath();
    ctx.ellipse(0.1 * s, 0.1 * s, 0.56 * s, 0.17 * s, -0.1, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba('#6a3a10', 0.55);
    ctx.lineWidth = Math.max(1, s * 0.006);
    for (let i = 0; i < 9; i++) {
      const x = -0.34 * s + i * 0.1 * s;
      ctx.beginPath();
      ctx.moveTo(x, 0.0);
      ctx.quadraticCurveTo(x - 0.02 * s, 0.1 * s, x + 0.01 * s, 0.2 * s);
      ctx.stroke();
    }
    // 脖子下面的腹甲
    ctx.strokeStyle = rgba(BELLY, 0.75);
    ctx.lineWidth = s * 0.05;
    ctx.lineCap = 'round';
    ctx.beginPath();
    neckSpine.forEach(([x, y], i) => {
      const r = (0.2 - 0.1 * (i / 14)) * s;
      if (i) ctx.lineTo(x - r * 0.1, y + r * 0.65);
      else ctx.moveTo(x - r * 0.1, y + r * 0.65);
    });
    ctx.stroke();
    // 鳞片
    scales(ctx, -0.9 * s, -0.7 * s, 0.7 * s, 0.2 * s, s * 0.06, '#1a0606', 0.45);
    scales(ctx, -0.9 * s, -0.7 * s, 0.7 * s, 0.2 * s, s * 0.06, '#ff8a6a', 0.08);
    // 躯干上的岩浆纹路
    veins(ctx, 0.0, -0.05 * s, 0.34 * s, -0.4, 2, LAVA, 0.35 + heat * 0.55, 3, s * 0.014);
    veins(ctx, 0.36 * s, -0.12 * s, 0.26 * s, -0.9, 2, LAVA, 0.3 + heat * 0.5, 9, s * 0.012);
    veins(ctx, -0.18 * s, -0.22 * s, 0.22 * s, -2.5, 1, LAVA, 0.25 + heat * 0.5, 15, s * 0.012);
    // 胸口的火核（喷火前越来越亮）
    glow(ctx, chest[0] + 0.1 * s, chest[1] + 0.04 * s, s * (0.16 + 0.1 * (skill === 'fire' ? k : 0)), LAVA, 0.25 + heat * 0.5);
    // 右上的受光
    ctx.fillStyle = linear(ctx, 0.5 * s, -0.5 * s, 0.1 * s, -0.05 * s, [[0, 'rgba(255,170,120,0.28)'], [1, 'rgba(255,170,120,0)']]);
    ctx.fillRect(-1 * s, -1 * s, 2 * s, 1 * s);
    ctx.restore();
    // 背脊上的一排骨刺：沿躯干上缘、脖子上缘
    ctx.fillStyle = deep(BONE, 0.2);
    for (let i = 1; i < 14; i += 2) {
      const [x, y] = neckSpine[i];
      const r = (0.2 - 0.1 * (i / 14)) * s;
      ctx.beginPath();
      ctx.moveTo(x + r * 0.55, y - r * 0.55);
      ctx.lineTo(x + r * 1.05, y - r * 1.35);
      ctx.lineTo(x + r * 0.15, y - r * 0.95);
      ctx.fill();
    }
    for (let i = 0; i < 6; i++) {
      const x = -0.18 * s + i * 0.15 * s;
      const y = -0.1 * s - 0.285 * s * Math.sqrt(Math.max(0, 1 - Math.pow((x - 0.12 * s) / (0.52 * s), 2))) - 0.012 * s * (i - 2);
      ctx.beginPath();
      ctx.moveTo(x - 0.035 * s, y + 0.02 * s);
      ctx.lineTo(x + 0.01 * s, y - 0.1 * s);
      ctx.lineTo(x + 0.05 * s, y + 0.02 * s);
      ctx.fill();
    }
    // 轮廓光
    K.rimEdge(ctx, torso, '#ffb890', 0.35, s * 0.012, s * 0.012, s * 0.012);

    // ---------- 头 ----------
    ctx.save();
    ctx.translate(H[0], H[1]);
    ctx.rotate(headTilt);
    const head = (open) => {
      // 上颌 + 颅骨
      ctx.beginPath();
      ctx.moveTo(0.12 * s, -0.1 * s);
      ctx.quadraticCurveTo(0.0, -0.17 * s, -0.12 * s, -0.12 * s);
      ctx.lineTo(-0.32 * s, -0.03 * s);
      ctx.quadraticCurveTo(-0.36 * s, 0.0, -0.31 * s, 0.03 * s);
      ctx.lineTo(-0.06 * s, 0.05 * s);
      ctx.quadraticCurveTo(0.1 * s, 0.07 * s, 0.14 * s, -0.02 * s);
      ctx.closePath();
    };
    // 下颌（绕着铰链张开）
    ctx.save();
    ctx.translate(0.04 * s, 0.06 * s);
    ctx.rotate(jaw);
    ctx.beginPath();
    ctx.moveTo(0.06 * s, -0.01 * s);
    ctx.lineTo(-0.28 * s, 0.0);
    ctx.quadraticCurveTo(-0.31 * s, 0.03 * s, -0.27 * s, 0.05 * s);
    ctx.lineTo(0.0, 0.07 * s);
    ctx.quadraticCurveTo(0.08 * s, 0.07 * s, 0.06 * s, -0.01 * s);
    ctx.fillStyle = linear(ctx, 0, -0.02 * s, 0, 0.08 * s, [[0, deep(BODY, 0.45)], [1, deep(BODY, 0.8)]]);
    ctx.fill();
    // 下颌的牙
    ctx.fillStyle = '#f4ecd0';
    for (let i = 0; i < 5; i++) {
      const x = -0.26 * s + i * 0.05 * s;
      ctx.beginPath();
      ctx.moveTo(x, 0.0);
      ctx.lineTo(x + 0.012 * s, -0.045 * s);
      ctx.lineTo(x + 0.028 * s, 0.0);
      ctx.fill();
    }
    ctx.restore();
    // 嘴里的火光（张嘴的缝里）：喷火蓄力越久越亮；平时是暗红
    const mouthA = skill === 'fire' ? 0.35 + 0.65 * k : skill ? 0.25 : 0.12 + (angry ? 0.12 : 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, -0.27 * s, 0.05 * s + Math.sin(jaw) * 0.1 * s * 0.4, s * (0.1 + (skill === 'fire' ? 0.22 * k : 0.03)), '#ff9a3a', mouthA, true);
    ctx.restore();
    // 颅骨
    head();
    ctx.fillStyle = linear(ctx, 0.12 * s, -0.15 * s, -0.3 * s, 0.05 * s, [[0, deep(BODY, 0.05)], [1, deep(BODY, 0.6)]]);
    ctx.fill();
    ctx.save();
    head();
    ctx.clip();
    scales(ctx, -0.4 * s, -0.2 * s, 0.2 * s, 0.1 * s, s * 0.04, '#1a0606', 0.5);
    veins(ctx, -0.02 * s, -0.05 * s, 0.14 * s, 3.3, 1, LAVA, 0.35 + heat * 0.4, 41, s * 0.008);
    ctx.restore();
    K.rimEdge(ctx, head, '#ffb890', 0.35, s * 0.01, s * 0.008, s * 0.008);
    // 上颌的牙
    ctx.fillStyle = '#f4ecd0';
    for (let i = 0; i < 5; i++) {
      const x = -0.3 * s + i * 0.052 * s;
      ctx.beginPath();
      ctx.moveTo(x, 0.035 * s);
      ctx.lineTo(x + 0.014 * s, 0.085 * s);
      ctx.lineTo(x + 0.03 * s, 0.04 * s);
      ctx.fill();
    }
    // 角：向后弯的两只（远的那只暗一点）
    for (const [dx, dy, a, c] of [[0.1 * s, -0.1 * s, 0.0, 0.5], [0.06 * s, -0.12 * s, 0.35, 0.0]]) {
      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(a);
      ctx.fillStyle = deep(BONE, c);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(0.14 * s, -0.04 * s, 0.26 * s, -0.17 * s);
      ctx.quadraticCurveTo(0.13 * s, -0.1 * s, -0.01 * s, 0.03 * s);
      ctx.fill();
      ctx.strokeStyle = rgba('#3a2a14', 0.5);
      ctx.lineWidth = Math.max(1, s * 0.005);
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0.05 * s * i, -0.012 * s * i + 0.01 * s);
        ctx.lineTo(0.05 * s * i - 0.006 * s, -0.012 * s * i - 0.012 * s);
        ctx.stroke();
      }
      ctx.restore();
    }
    // 鼻孔：生气时喷火星 / 烟
    const nx = -0.3 * s;
    const ny = -0.015 * s;
    ctx.fillStyle = '#120404';
    ctx.beginPath();
    ctx.ellipse(nx, ny, s * 0.014, s * 0.008, -0.3, 0, TAU);
    ctx.fill();
    if (angry || skill === 'fire') {
      const rr = seeded(9);
      for (let i = 0; i < 6; i++) {
        const f = (t * 1.2 + rr()) % 1;
        const px = nx - f * 0.12 * s - rr() * 0.02 * s;
        const py = ny - f * 0.16 * s - Math.sin(f * 6 + i) * 0.01 * s;
        ctx.globalAlpha = (1 - f) * 0.8;
        glow(ctx, px, py, s * (0.012 + f * 0.015), i % 2 ? '#ffd070' : '#ff6a2a', 0.9);
      }
      ctx.globalAlpha = 1;
    }
    // 眼睛：竖瞳，发着火光（狂暴时发白）
    {
      const ex = -0.1 * s;
      const ey = -0.065 * s;
      const ec = rage ? '#fff0c0' : '#ffb830';
      glow(ctx, ex, ey, s * 0.07, ec, 0.8);
      ctx.fillStyle = ec;
      ctx.beginPath();
      ctx.ellipse(ex, ey, s * 0.034, s * 0.018, -0.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#2a0404';
      ctx.beginPath();
      ctx.ellipse(ex - s * 0.004, ey, s * 0.007, s * 0.016, -0.4, 0, TAU);
      ctx.fill();
      // 眉骨压下来的怒意
      ctx.strokeStyle = deep(BODY, 0.8);
      ctx.lineWidth = s * 0.014;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex + s * 0.05, ey - s * 0.045);
      ctx.lineTo(ex - s * 0.05, ey - s * 0.012);
      ctx.stroke();
    }
    // 脑后的鬃刺
    ctx.fillStyle = deep(BONE, 0.3);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0.12 * s + i * 0.02 * s, -0.06 * s + i * 0.045 * s);
      ctx.lineTo(0.25 * s + i * 0.03 * s, -0.12 * s + i * 0.06 * s);
      ctx.lineTo(0.14 * s + i * 0.02 * s, -0.01 * s + i * 0.05 * s);
      ctx.fill();
    }
    ctx.restore(); // 头

    // ---------- 近侧的腿 ----------
    leg(0.4 * s, 0.03 * s, 0.5 * s, 0.2 * s - sway, 0.4 * s, 0.4 * s - sway, 0.3, 1.0);
    leg(-0.14 * s, 0.03 * s, -0.04 * s, 0.2 * s + sway, -0.2 * s, 0.38 * s + sway, 0.3, 1.0);

    // ---------- 近侧的翅膀（在最前面） ----------
    const nw = wingDraw(0.04 * s, -0.32 * s, -1.1, flap, true);

    // ---------- 技能预备的特效 ----------
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (skill === 'bolt') {
      // 雷暴：角尖、翼尖之间窜动的电弧，越来越密
      const fr = Math.floor(t * 14);
      const n = 2 + Math.round(k * 5);
      for (let i = 0; i < n; i++) {
        const [tx, ty] = nw.tips[i % 4];
        veins(ctx, tx, ty, 0.24 * s, -1.6 + (i % 3) * 0.5, 2, '#bfe4ff', 0.5 + 0.4 * k, fr * 5 + i * 11, s * 0.014);
      }
      veins(ctx, H[0] + 0.2 * s, H[1] - 0.15 * s, 0.3 * s, -1.0, 2, '#e8f4ff', 0.6 + 0.35 * k, fr * 7, s * 0.016);
      glow(ctx, 0, -0.1 * s, s * (0.5 + 0.3 * k), '#9fd0ff', 0.12 + 0.2 * k);
    } else if (skill === 'shock') {
      // 龙吼：头前一圈圈向外扩的声波
      for (let i = 0; i < 3; i++) {
        const f = (k * 1.6 + i * 0.33) % 1;
        ctx.strokeStyle = rgba('#ffe0b0', (1 - f) * (0.25 + 0.5 * k));
        ctx.lineWidth = s * 0.02 * (1 - f * 0.6);
        ctx.beginPath();
        ctx.arc(H[0] - 0.3 * s, H[1] + 0.02 * s, s * (0.08 + f * 0.5), 0.55 * Math.PI, 1.45 * Math.PI);
        ctx.stroke();
      }
      glow(ctx, H[0] - 0.2 * s, H[1], s * 0.4, '#ffd8a0', 0.18 * k);
    } else if (skill === 'fire') {
      // 龙息：胸口到嘴里一路火光，嘴边的火越聚越大
      glow(ctx, H[0] - 0.3 * s, H[1] + 0.04 * s, s * (0.12 + 0.34 * k), '#ffd070', 0.35 + 0.5 * k, true);
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
