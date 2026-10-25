// 第三章 · 迷雾沼泽（设计书 56.4）的怪物画法：工具函数（发光、眼睛、符文、胶质、四足……）在 creatures.js
(function (TD) {
  'use strict';

  const K = TD.creatures;
  const D = K.drawers;
  const TAU = Math.PI * 2;
  const { deep, light, rgba, bodyGrad, glow, shadow, eyes, rune, dot, wing, jelly, jellyEyes, quadruped, seeded, strokes, speckle, scales, veins, sparkles, rimEdge, linear, radial } = K;

  // 带透明度的深色 / 亮色
  const deepA = (hex, v, a) => deep(hex, v).replace('rgb(', 'rgba(').replace(')', ',' + a + ')');
  const lightA = (hex, v, a) => light(hex, v).replace('rgb(', 'rgba(').replace(')', ',' + a + ')');

  // 一片小叶子（带叶脉），从 (x, y) 沿 ang 方向长出去
  function leaf(ctx, x, y, len, ang, col) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = linear(ctx, 0, -len * 0.3, 0, len * 0.3, [[0, light(col, 0.15)], [1, deep(col, 0.45)]]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -len * 0.42, len, 0);
    ctx.quadraticCurveTo(len * 0.5, len * 0.42, 0, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232,255,192,0.45)';
    ctx.lineWidth = Math.max(0.6, len * 0.06);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len * 0.85, 0);
    ctx.stroke();
    ctx.restore();
  }

  // 一簇火苗（水滴形：外焰 + 内焰，加色混合），(x, y) 是火苗底部
  function flame(ctx, x, y, w, h, outer, inner, a) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [k, c] of [[1, outer], [0.55, inner]]) {
      const by = y + w * (1 - k) * 0.6;
      ctx.fillStyle = rgba(c, a);
      ctx.beginPath();
      ctx.moveTo(x - w * k, by);
      ctx.quadraticCurveTo(x - w * k, by - h * k * 0.55, x, by - h * k);
      ctx.quadraticCurveTo(x + w * k, by - h * k * 0.55, x + w * k, by);
      ctx.arc(x, by, w * k, 0, Math.PI);
      ctx.fill();
    }
    ctx.restore();
  }

  // 一根骨头（两头圆鼓鼓）
  function boneStick(ctx, x0, y0, x1, y1, w, col) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    const a = Math.atan2(y1 - y0, x1 - x0);
    const nx = -Math.sin(a) * w * 0.42;
    const ny = Math.cos(a) * w * 0.42;
    ctx.fillStyle = col;
    for (const [x, y] of [[x0, y0], [x1, y1]]) {
      for (const k of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(x + nx * k, y + ny * k, w * 0.6, 0, TAU);
        ctx.fill();
      }
    }
  }

  // ======================================================================
  // 第三章 · 迷雾沼泽（设计书 56.4）
  // ======================================================================

  // 小幽灵：几层半透明的光雾叠在一起，体内的光雾慢慢流动；尾巴渐隐，边缘飘散出小光点
  D.ghost = function (ctx, s, t, o) {
    const seed = o.seed || 0;
    const ph = t * 3 + seed;
    const fl = Math.sin(ph) * s * 0.12;
    const tw = Math.sin(ph * 1.6) * s * 0.15;
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.55, -s * 0.1);
      ctx.bezierCurveTo(-s * 0.6, -s * 0.85, s * 0.45, -s * 0.9, s * 0.5, -s * 0.15);
      // 往后飘的尾巴
      ctx.bezierCurveTo(s * 0.6, s * 0.3, s * 1.0, s * 0.35 + tw, s * 1.35, s * 0.2 - tw);
      ctx.bezierCurveTo(s * 0.9, s * 0.65 + tw, s * 0.2, s * 0.6, -s * 0.55, -s * 0.1);
    };
    ctx.save();
    ctx.translate(0, -s * 1.0 + fl);
    ctx.lineCap = 'round';
    // 最外层：同一个形状放大一圈、很淡，像身边的雾气
    ctx.save();
    ctx.translate(s * 0.25, -s * 0.05);
    ctx.scale(1.2, 1.25);
    ctx.translate(-s * 0.25, s * 0.05);
    body();
    // 边缘前就淡完，不留一圈硬边
    ctx.fillStyle = radial(ctx, 0, -s * 0.2, 0, s * 0.85, [[0, 'rgba(190,215,255,0.3)'], [0.55, 'rgba(170,195,255,0.12)'], [1, 'rgba(150,170,255,0)']]);
    ctx.fill();
    ctx.restore();
    // 两缕拖在后面的细雾
    for (let i = 0; i < 2; i++) {
      const w = Math.sin(ph * 1.3 + i * 2) * s * 0.1;
      ctx.strokeStyle = linear(ctx, s * 0.3, 0, s * 1.3, 0, [[0, 'rgba(205,228,255,0.45)'], [1, 'rgba(160,190,255,0)']]);
      ctx.lineWidth = s * (0.08 - i * 0.03);
      ctx.beginPath();
      ctx.moveTo(s * 0.3, s * (0.05 + i * 0.15));
      ctx.bezierCurveTo(s * 0.65, s * (0.38 + i * 0.1) + w, s * 0.95, s * (0.08 + i * 0.25) - w, s * (1.3 - i * 0.15), s * (0.28 + i * 0.15) + w);
      ctx.stroke();
    }
    // 往前伸的小手
    const wave = Math.sin(t * 4 + seed) * s * 0.05;
    ctx.fillStyle = 'rgba(215,232,255,0.72)';
    ctx.beginPath();
    ctx.moveTo(-s * 0.42, -s * 0.24);
    ctx.quadraticCurveTo(-s * 0.6, -s * 0.22 + wave, -s * 0.64, -s * 0.08 + wave);
    ctx.quadraticCurveTo(-s * 0.54, -s * 0.04, -s * 0.46, -s * 0.06);
    ctx.fill();
    // 身体：右上最亮，往左下渐渐变透
    body();
    ctx.fillStyle = radial(ctx, 0, -s * 0.15, s * 0.05, s * 1.15, [[0, 'rgba(246,251,255,0.96)'], [0.45, 'rgba(188,216,255,0.7)'], [0.68, 'rgba(130,160,255,0.28)'], [1, 'rgba(120,150,255,0)']], s * 0.12, -s * 0.45);
    ctx.fill();
    ctx.save();
    body();
    ctx.clip();
    // 背光的左下偏蓝紫（只染已经画上的雾，不让渐隐的尾巴变实）
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = linear(ctx, s * 0.4, -s * 0.7, -s * 0.4, s * 0.3, [[0, 'rgba(110,120,230,0)'], [1, 'rgba(90,100,210,0.32)']]);
    ctx.fillRect(-s, -s, s * 2.6, s * 2);
    // 体内慢慢流动的光雾
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const a = 0.2 - i * 0.04;
      ctx.strokeStyle = linear(ctx, -s * 0.6, 0, s * 0.9, 0, [[0, `rgba(210,232,255,${a})`], [0.6, `rgba(210,232,255,${a})`], [1, 'rgba(210,232,255,0)']]);
      ctx.lineWidth = s * (0.12 - i * 0.025);
      ctx.beginPath();
      for (let k = 0; k <= 10; k++) {
        const x = -s * 0.6 + k * s * 0.15;
        const y = -s * (0.5 - i * 0.2) + Math.sin(k * 0.8 - t * 2.2 + i * 2) * s * 0.06 + k * i * s * 0.025;
        if (k) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
    glow(ctx, 0, -s * 0.25, s * 0.8, '#cfe4ff', 0.4);
    // 胸口一团暖暖的光核
    glow(ctx, -s * 0.02, -s * 0.18, s * 0.38, '#ffffff', 0.32 + Math.sin(t * 2.5 + seed) * 0.08, true);
    // 轮廓光：头顶最亮，顺着尾巴渐渐淡掉
    ctx.save();
    body();
    ctx.clip();
    ctx.translate(-s * 0.05, s * 0.05);
    body();
    ctx.strokeStyle = linear(ctx, s * 0.2, 0, s * 1.2, 0, [[0, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]);
    ctx.lineWidth = s * 0.05;
    ctx.stroke();
    ctx.restore();
    // 深色的眼窝 + 眼底一点光 + 高光（偶尔眨眼）
    const blink = (t * 0.45 + seed * 0.31) % 1 < 0.05 ? 0.25 : 1;
    for (const dx of [-0.28, -0.02]) {
      ctx.fillStyle = 'rgba(20,24,60,0.78)';
      ctx.beginPath();
      ctx.ellipse(s * dx, -s * 0.32, s * 0.08, s * 0.12 * blink, 0, 0, TAU);
      ctx.fill();
      if (blink === 1) {
        dot(ctx, s * (dx - 0.01), -s * 0.27, s * 0.035, '#9fdcff', 0.9);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.arc(s * (dx + 0.025), -s * 0.37, s * 0.025, 0, TAU);
        ctx.fill();
      }
    }
    // 小小的 "o" 嘴
    ctx.fillStyle = 'rgba(20,24,60,0.5)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.16, -s * 0.13, s * 0.035, s * 0.045 + Math.sin(t * 2 + seed) * s * 0.01, 0, 0, TAU);
    ctx.fill();
    // 从尾巴上飘散的小光点
    const r = seeded(7);
    for (let i = 0; i < 5; i++) {
      const p = (t * 0.35 + i / 5 + r() * 0.1) % 1;
      const x = s * (0.3 + r() * 1.0) + Math.sin(t * 2 + i) * s * 0.08;
      dot(ctx, x, s * (0.3 - p * 0.9), Math.max(0.6, s * 0.05 * (1 - p)), '#d6ecff', (1 - p) * 0.8);
    }
    ctx.restore();
  };

  // 毒蛙：修长的后腿和蹼脚、带斑点的湿润皮肤、发光的毒斑；喉囊一鼓一鼓，吐毒时鼓起发光
  D.frog = function (ctx, s, t, o) {
    const seed = o.seed || 0;
    const ph = t * 2 + seed;
    shadow(ctx, 0, 2, s * 0.9);
    const base = '#6a4ab0';
    const tox = '#c8ff8a';
    const puff = o.attack ? 0.5 + Math.max(0, Math.sin(t * 5)) * 0.5 : 0;
    const breath = 0.5 + Math.sin(t * 4 + seed) * 0.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // 远侧的前腿（更暗）
    ctx.strokeStyle = deep(base, 0.82);
    ctx.lineWidth = s * 0.07;
    ctx.beginPath();
    ctx.moveTo(-s * 0.16, -s * 0.4);
    ctx.lineTo(-s * 0.28, -s * 0.03);
    ctx.stroke();
    // 后腿：小腿 + 往后伸的蹼脚
    ctx.strokeStyle = deep(base, 0.72);
    ctx.lineWidth = s * 0.1;
    ctx.beginPath();
    ctx.moveTo(s * 0.72, -s * 0.16);
    ctx.lineTo(s * 0.36, -s * 0.04);
    ctx.lineTo(s * 0.68, -s * 0.03);
    ctx.stroke();
    ctx.fillStyle = deepA(base, 0.55, 0.8);
    ctx.beginPath();
    ctx.moveTo(s * 0.6, -s * 0.04);
    ctx.lineTo(s * 0.9, -s * 0.13);
    ctx.lineTo(s * 0.86, -s * 0.05);
    ctx.lineTo(s * 0.93, s * 0.01);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = light(base, 0.1);
    for (const [tx, ty] of [[0.9, -0.13], [0.86, -0.05], [0.93, 0.01]]) {
      ctx.beginPath();
      ctx.arc(s * tx, s * ty, s * 0.03, 0, TAU);
      ctx.fill();
    }
    // 大腿：带两道深色横纹
    const thigh = () => {
      ctx.beginPath();
      ctx.ellipse(s * 0.45, -s * 0.3, s * 0.45, s * 0.22, -0.4, 0, TAU);
    };
    thigh();
    ctx.fillStyle = bodyGrad(ctx, 0, -s * 0.6, s * 0.9, 0, base, 0.35, 0.8);
    ctx.fill();
    ctx.save();
    thigh();
    ctx.clip();
    ctx.strokeStyle = deepA(base, 0.85, 0.55);
    ctx.lineWidth = s * 0.07;
    for (const bx of [0.38, 0.62]) {
      ctx.beginPath();
      ctx.moveTo(s * bx, -s * 0.6);
      ctx.quadraticCurveTo(s * (bx - 0.08), -s * 0.35, s * (bx + 0.02), -s * 0.05);
      ctx.stroke();
    }
    ctx.restore();
    rimEdge(ctx, thigh, '#d9c8ff', 0.4, s * 0.05, s * 0.04, s * 0.04);
    // 身体：前高后低地坐着
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.55, -s * 0.85);
      ctx.quadraticCurveTo(-s * 0.15, -s * 1.15, s * 0.5, -s * 0.6);
      ctx.quadraticCurveTo(s * 0.55, -s * 0.15, s * 0.1, -s * 0.15);
      ctx.quadraticCurveTo(-s * 0.4, -s * 0.2, -s * 0.55, -s * 0.85);
    };
    body();
    ctx.fillStyle = bodyGrad(ctx, -s * 0.7, -s * 1.2, s * 0.7, 0, base, 0.25, 0.72);
    ctx.fill();
    ctx.save();
    body();
    ctx.clip();
    // 浅色的肚皮、背上受光的一块
    ctx.fillStyle = radial(ctx, -s * 0.25, -s * 0.3, 0, s * 0.45, [[0, lightA(base, 0.25, 0.45)], [1, lightA(base, 0.25, 0)]]);
    ctx.fillRect(-s, -s * 1.2, s * 2, s * 1.2);
    ctx.fillStyle = radial(ctx, s * 0.1, -s * 0.95, 0, s * 0.4, [[0, lightA(base, 0.35, 0.35)], [1, lightA(base, 0.35, 0)]]);
    ctx.fillRect(-s, -s * 1.2, s * 2, s * 1.2);
    // 湿润的皮肤：深色小斑 + 细小的疙瘩
    speckle(ctx, s * 0.1, -s * 0.62, s * 0.4, s * 0.25, 9, '#1a1030', 0.45, 23, s * 0.03, s * 0.06);
    speckle(ctx, s * 0.05, -s * 0.7, s * 0.45, s * 0.3, 14, '#e0d0ff', 0.2, 31, s * 0.015, s * 0.03);
    // 背脊上一道浅色的褶
    ctx.strokeStyle = lightA(base, 0.4, 0.3);
    ctx.lineWidth = s * 0.035;
    ctx.beginPath();
    ctx.moveTo(-s * 0.32, -s * 0.95);
    ctx.quadraticCurveTo(s * 0.02, -s * 1.02, s * 0.4, -s * 0.62);
    ctx.stroke();
    ctx.restore();
    rimEdge(ctx, body, '#d9c8ff', 0.5, s * 0.06, s * 0.05, s * 0.05);
    // 发光的毒斑：深色的环 + 一明一暗地呼吸
    for (const [px, py, r] of [[-0.05, -0.85, 0.08], [0.25, -0.72, 0.065], [0.05, -0.55, 0.055], [0.35, -0.45, 0.06]]) {
      ctx.fillStyle = 'rgba(26,16,48,0.6)';
      ctx.beginPath();
      ctx.arc(s * px, s * py, s * r * 1.5, 0, TAU);
      ctx.fill();
      dot(ctx, s * px, s * py, s * r, tox, 0.6 + Math.sin(ph + px * 9) * 0.3);
    }
    // 喉囊：平时随呼吸轻轻鼓起；吐毒时鼓得很大、透出绿光
    const sac = puff > 0 ? 0.6 + puff : 0.42 + breath * 0.14;
    if (puff > 0) glow(ctx, -s * 0.4, -s * 0.45, s * 0.5 * sac, tox, 0.6 * puff);
    ctx.fillStyle = puff > 0 ? rgba(tox, 0.5 * puff) : lightA(base, 0.35, 0.55);
    ctx.beginPath();
    ctx.ellipse(-s * 0.4, -s * 0.48, s * 0.22 * sac, s * 0.18 * sac, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = s * 0.02;
    ctx.beginPath();
    ctx.ellipse(-s * 0.4, -s * 0.48, s * 0.15 * sac, s * 0.12 * sac, 0, -1.4, -0.4);
    ctx.stroke();
    // 近侧的前腿 + 圆圆的趾垫
    ctx.strokeStyle = deep(base, 0.55);
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, -s * 0.4);
    ctx.lineTo(-s * 0.45, -s * 0.03);
    ctx.stroke();
    ctx.strokeStyle = lightA(base, 0.3, 0.35);
    ctx.lineWidth = s * 0.025;
    ctx.beginPath();
    ctx.moveTo(-s * 0.27, -s * 0.38);
    ctx.lineTo(-s * 0.41, -s * 0.06);
    ctx.stroke();
    ctx.fillStyle = light(base, 0.15);
    for (const tx of [-0.56, -0.47, -0.38]) {
      ctx.beginPath();
      ctx.arc(s * tx, -s * 0.01, s * 0.035, 0, TAU);
      ctx.fill();
    }
    // 嘴角一条笑线
    ctx.strokeStyle = deep(base, 0.88);
    ctx.lineWidth = s * 0.025;
    ctx.beginPath();
    ctx.moveTo(-s * 0.58, -s * 0.8);
    ctx.quadraticCurveTo(-s * 0.45, -s * 0.7, -s * 0.28, -s * 0.76);
    ctx.stroke();
    // 吐毒时嘴边滴下的毒液
    if (puff > 0) {
      const p = (t * 2) % 1;
      dot(ctx, -s * 0.56, -s * 0.76 + p * s * 0.6, s * 0.04, tox, (1 - p) * puff);
    }
    // 鼓鼓的大眼睛：远侧那只小一点、暗一点（偶尔眨眼）
    const open = (t * 0.5 + seed * 0.37) % 1 < 0.05 ? 0.15 : 1;
    ctx.fillStyle = deep(base, 0.6);
    ctx.beginPath();
    ctx.arc(-s * 0.2, -s * 1.0, s * 0.11, 0, TAU);
    ctx.fill();
    eyes(ctx, -s * 0.22, -s * 1.02, 0, s * 0.045, '#ffe07a', 0, open);
    ctx.fillStyle = radial(ctx, -s * 0.4, -s * 0.92, s * 0.02, s * 0.18, [[0, deep(base, 0.15)], [1, deep(base, 0.55)]], -s * 0.33, -s * 1.0);
    ctx.beginPath();
    ctx.arc(-s * 0.4, -s * 0.92, s * 0.16, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#120a24';
    ctx.beginPath();
    ctx.ellipse(-s * 0.43, -s * 0.94, s * 0.1, s * 0.08, 0, 0, TAU);
    ctx.fill();
    eyes(ctx, -s * 0.43, -s * 0.94, 0.01, s * 0.07, '#ffe07a', 0, open);
  };

  // 树桩怪：根须当脚、深沟树皮和树结、年轮切面上长着小芽，苔藓和发光的小木耳；裂缝里透出琥珀色的光（回血时变绿）
  D.stump = function (ctx, s, t, o) {
    const seed = o.seed || 0;
    const step = Math.sin(t * 5 + seed);
    shadow(ctx, 0, 2, s);
    const base = '#7a5a3a';
    const sap = o.regen ? '#9aff8a' : '#ffb04a';
    const moss = '#5a9a4a';
    const wood = '#c8a070';
    const pulse = 0.75 + Math.sin(t * 3 + seed) * 0.25;
    ctx.lineCap = 'round';
    // 根须脚：远侧的先画、更暗；近侧的带一道受光的亮线，根尖往外卷
    for (const i of [1, 3, 0, 2]) {
      const far = i % 2 === 1;
      const rx = -s * 0.55 + i * s * 0.36;
      const sw = Math.sin(t * 5 + i * 1.5) * s * 0.06 * (far ? 1 : -1) * Math.abs(step);
      const ex = rx * 1.2 + sw;
      const curl = rx < 0 ? -1 : 1;
      const root = () => {
        ctx.beginPath();
        ctx.moveTo(rx * 0.7, -s * 0.35);
        ctx.quadraticCurveTo(rx + sw, -s * 0.15, ex, -s * 0.02);
        ctx.quadraticCurveTo(ex + curl * s * 0.06, s * 0.01, ex + curl * s * 0.09, -s * 0.04);
      };
      root();
      ctx.strokeStyle = deep(base, far ? 0.8 : 0.65);
      ctx.lineWidth = s * (far ? 0.1 : 0.13);
      ctx.stroke();
      if (!far) {
        ctx.save();
        ctx.translate(s * 0.025, -s * 0.02);
        root();
        ctx.strokeStyle = lightA(base, 0.15, 0.35);
        ctx.lineWidth = s * 0.03;
        ctx.stroke();
        ctx.restore();
      }
    }
    // 树干
    const trunk = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.65, -s * 0.3);
      ctx.quadraticCurveTo(-s * 0.7, -s * 1.0, -s * 0.55, -s * 1.45);
      ctx.lineTo(s * 0.55, -s * 1.45);
      ctx.quadraticCurveTo(s * 0.7, -s * 1.0, s * 0.65, -s * 0.3);
      ctx.quadraticCurveTo(0, -s * 0.22, -s * 0.65, -s * 0.3);
      ctx.closePath();
    };
    trunk();
    ctx.fillStyle = bodyGrad(ctx, -s * 0.7, -s * 1.6, s * 0.7, -s * 0.2, base, 0.3, 0.75);
    ctx.fill();
    ctx.save();
    trunk();
    ctx.clip();
    // 圆柱的明暗：左边背光、右边受光，最右缘再暗一点
    ctx.fillStyle = linear(ctx, -s * 0.7, 0, s * 0.7, 0, [[0, 'rgba(6,8,18,0.5)'], [0.45, 'rgba(6,8,18,0)'], [0.78, 'rgba(255,214,160,0.14)'], [1, 'rgba(6,8,18,0.25)']]);
    ctx.fillRect(-s * 0.8, -s * 1.6, s * 1.6, s * 1.4);
    // 树皮：一条条竖着的深沟，沟旁边一道亮棱
    const r = seeded(41);
    for (let i = 0; i < 7; i++) {
      const x = -s * 0.56 + i * s * 0.18 + (r() - 0.5) * s * 0.06;
      const bend = (r() - 0.5) * s * 0.12;
      for (const [dx, c, w] of [[0, deepA(base, 0.88, 0.85), 0.045], [0.04, lightA(base, 0.3, 0.2), 0.02]]) {
        ctx.strokeStyle = c;
        ctx.lineWidth = s * w;
        ctx.beginPath();
        ctx.moveTo(x + s * dx, -s * 1.42);
        ctx.bezierCurveTo(x + bend + s * dx, -s * 1.1, x - bend + s * dx, -s * 0.7, x * 1.08 + s * dx, -s * 0.3);
        ctx.stroke();
      }
    }
    // 树皮上的横裂纹
    ctx.strokeStyle = deepA(base, 0.9, 0.5);
    ctx.lineWidth = s * 0.02;
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const x = (r() - 0.5) * s * 1.1;
      const y = -s * 1.35 + r() * s * 0.95;
      ctx.moveTo(x, y);
      ctx.lineTo(x + s * 0.08, y + s * 0.02);
    }
    ctx.stroke();
    // 树结：鼓起的一圈木纹，中间一个小小的深点（不要像一个洞）
    ctx.fillStyle = radial(ctx, s * 0.38, -s * 0.6, 0, s * 0.1, [[0, deep(base, 0.8)], [0.35, deep(base, 0.55)], [1, deep(base, 0.4)]], s * 0.36, -s * 0.62);
    ctx.beginPath();
    ctx.ellipse(s * 0.38, -s * 0.6, s * 0.08, s * 0.1, 0.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = lightA(base, 0.25, 0.35);
    ctx.lineWidth = s * 0.025;
    ctx.beginPath();
    ctx.ellipse(s * 0.38, -s * 0.6, s * 0.11, s * 0.14, 0.2, -2.2, 0.6);
    ctx.stroke();
    // 苔藓：底部往上长，顶上往下垂
    strokes(ctx, 0, -s * 0.38, s * 0.62, s * 0.1, 26, moss, 0.65, 3, -1.7, s * 0.14);
    strokes(ctx, -s * 0.3, -s * 1.38, s * 0.25, s * 0.05, 12, moss, 0.55, 5, 1.6, s * 0.12);
    // 脚下的暗部
    ctx.fillStyle = linear(ctx, 0, -s * 0.6, 0, -s * 0.25, [[0, 'rgba(6,8,18,0)'], [1, 'rgba(6,8,18,0.45)']]);
    ctx.fillRect(-s * 0.8, -s * 0.6, s * 1.6, s * 0.4);
    ctx.restore();
    rimEdge(ctx, trunk, '#ffd9a8', 0.45, s * 0.06, s * 0.05, s * 0.05);
    // 背光一侧长着两朵发光的小木耳
    for (const [my, mr] of [[-0.66, 0.14], [-0.5, 0.1]]) {
      const mx = -s * 0.62 - mr * s * 0.3;
      const y = s * my;
      glow(ctx, mx, y, s * mr * 2.6, '#8ff0e0', 0.35 + pulse * 0.15);
      // 伞盖：上面亮、下缘暗，底下一道深色的菌褶
      ctx.fillStyle = linear(ctx, 0, y - s * mr * 0.5, 0, y, [[0, '#a8f4e8'], [1, '#3a7e78']]);
      ctx.beginPath();
      ctx.ellipse(mx, y, s * mr, s * mr * 0.5, 0, Math.PI, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(16,40,40,0.7)';
      ctx.beginPath();
      ctx.ellipse(mx, y, s * mr * 0.9, s * mr * 0.14, 0, 0, Math.PI);
      ctx.fill();
      ctx.strokeStyle = 'rgba(200,255,244,0.8)';
      ctx.lineWidth = s * 0.022;
      ctx.beginPath();
      ctx.ellipse(mx, y, s * mr, s * mr * 0.5, 0, Math.PI * 1.15, TAU * 0.98);
      ctx.stroke();
    }
    // 裂缝：深色的缝，里面透出树液的光，细细的光脉往两边爬
    ctx.fillStyle = '#140a04';
    ctx.beginPath();
    ctx.moveTo(s * 0.13, -s * 1.24);
    ctx.lineTo(s * 0.0, -s * 0.95);
    ctx.lineTo(s * 0.17, -s * 0.66);
    ctx.lineTo(s * 0.11, -s * 0.95);
    ctx.closePath();
    ctx.fill();
    glow(ctx, s * 0.1, -s * 0.95, s * 0.55, sap, 0.35 * pulse);
    rune(ctx, [[s * 0.15, -s * 1.2], [s * 0.05, -s * 0.95], [s * 0.2, -s * 0.7]], sap, s * 0.07, 0.85 * pulse);
    veins(ctx, s * 0.08, -s * 1.02, s * 0.16, -0.5, 1, sap, 0.55 * pulse, 9, s * 0.035);
    veins(ctx, s * 0.15, -s * 0.78, s * 0.14, 0.5, 1, sap, 0.5 * pulse, 12, s * 0.03);
    // 年轮切面：一圈树皮 + 浅色的木头 + 不太圆的年轮 + 放射裂纹
    ctx.fillStyle = deep(base, 0.55);
    ctx.beginPath();
    ctx.ellipse(0, -s * 1.45, s * 0.56, s * 0.155, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = radial(ctx, 0, -s * 1.45, 0, s * 0.5, [[0, light(wood, 0.1)], [1, deep(wood, 0.45)]], s * 0.15, -s * 1.5);
    ctx.beginPath();
    ctx.ellipse(0, -s * 1.45, s * 0.48, s * 0.125, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = deepA(wood, 0.55, 0.6);
    ctx.lineWidth = Math.max(0.7, s * 0.025);
    for (const k of [0.39, 0.29, 0.2, 0.11]) {
      ctx.beginPath();
      ctx.ellipse(-s * k * 0.15, -s * 1.45, s * k, s * k * 0.26, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-s * 0.02, -s * 1.45);
    ctx.lineTo(s * 0.3, -s * 1.41);
    ctx.moveTo(-s * 0.05, -s * 1.46);
    ctx.lineTo(-s * 0.25, -s * 1.53);
    ctx.stroke();
    speckle(ctx, -s * 0.38, -s * 1.46, s * 0.15, s * 0.05, 8, moss, 0.8, 7, s * 0.025, s * 0.05);
    // 切面上的小芽：两片叶子，轻轻摇
    const sway = Math.sin(t * 2.2 + seed) * s * 0.06;
    ctx.strokeStyle = '#4a8a3a';
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.moveTo(s * 0.2, -s * 1.45);
    ctx.quadraticCurveTo(s * 0.25, -s * 1.7, s * 0.38 + sway, -s * 1.78);
    ctx.stroke();
    leaf(ctx, s * 0.38 + sway, -s * 1.78, s * 0.24, -0.5 + sway / s, '#5aaa4a');
    leaf(ctx, s * 0.26 + sway * 0.5, -s * 1.66, s * 0.17, -2.7, '#4a9a3a');
    if (o.regen) glow(ctx, s * 0.35, -s * 1.75, s * 0.4, sap, 0.5 * pulse);
    // 树洞一样的眼睛，上面一道树皮眉骨；下面一个小树洞嘴
    for (const dx of [-0.35, -0.08]) {
      ctx.fillStyle = '#0a0606';
      ctx.beginPath();
      ctx.ellipse(s * dx, -s * 1.0, s * 0.1, s * 0.13, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = lightA(base, 0.2, 0.45);
      ctx.lineWidth = s * 0.035;
      ctx.beginPath();
      ctx.ellipse(s * dx, -s * 1.0, s * 0.13, s * 0.16, 0, -2.7, -0.5);
      ctx.stroke();
    }
    eyes(ctx, -s * 0.22, -s * 1.0, s * 0.27, s * 0.045, sap, 0);
    ctx.fillStyle = '#0a0606';
    ctx.beginPath();
    ctx.ellipse(-s * 0.22, -s * 0.74, s * 0.07, s * 0.05, 0, 0, TAU);
    ctx.fill();
    glow(ctx, -s * 0.22, -s * 0.74, s * 0.14, sap, 0.3 * pulse);
    // 回血时：绿色的光点往上飘
    if (o.regen) sparkles(ctx, 0, -s * 1.1, s * 0.75, s * 0.55, 6, t, sap, 31, 1.4);
  };

  // 蝙蝠：半透明的薄膜翅膀，翅骨清楚、振翅时翅缘发亮；毛茸茸的身体，拖着一串粉色光尘
  D.bat = function (ctx, s, t, o) {
    const seed = o.seed || 0;
    const fp = t * 16 + seed;
    const flap = Math.sin(fp);
    const edge = 0.3 + Math.abs(Math.cos(fp)) * 0.5;
    ctx.save();
    ctx.globalAlpha *= 0.5;
    shadow(ctx, 0, 34, s * 0.7);
    ctx.restore();
    ctx.translate(0, -s * 0.6);
    const base = '#6a4a98';
    const pink = '#ff9ae0';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // 拖在身后的光尘
    for (let i = 0; i < 5; i++) {
      const p = (t * 1.1 + i / 5) % 1;
      dot(ctx, s * (0.25 + p * 1.3), s * (0.15 + Math.sin(p * 7 + i) * 0.12 + p * 0.2), Math.max(0.5, s * 0.07 * (1 - p)), pink, (1 - p) * 0.55);
    }
    for (const [dir, far] of [[1, true], [-1, false]]) {
      const lift = flap * s * 0.7;
      const tip = [dir * s * 1.35, -s * 0.2 - lift];
      const f1 = [dir * s * 0.95, s * 0.05 - lift * 0.3];
      const f2 = [dir * s * 0.55, s * 0.12 - lift * 0.2];
      const wr = [dir * s * 0.62, -s * 0.3 - lift * 0.75]; // 腕关节
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.05);
        ctx.quadraticCurveTo(dir * s * 0.6, -s * 0.5 - lift, tip[0], tip[1]);
        ctx.quadraticCurveTo(dir * s * 1.1, 0, f1[0], f1[1]);
        ctx.quadraticCurveTo(dir * s * 0.75, -s * 0.05, f2[0], f2[1]);
        ctx.quadraticCurveTo(dir * s * 0.35, s * 0.02, 0, s * 0.15);
        ctx.closePath();
      };
      // 薄膜：靠身体处深，越往外越透光
      path();
      ctx.fillStyle = linear(ctx, 0, 0, dir * s * 1.35, 0, far ? [[0, deepA(base, 0.82, 0.95)], [1, deepA(base, 0.7, 0.7)]] : [[0, deepA(base, 0.55, 0.97)], [0.6, deepA(base, 0.4, 0.85)], [1, deepA(base, 0.22, 0.65)]]);
      ctx.fill();
      ctx.save();
      path();
      ctx.clip();
      // 薄膜上的细纹：从腕关节散开
      ctx.strokeStyle = lightA(base, 0.3, far ? 0.08 : 0.16);
      ctx.lineWidth = s * 0.02;
      ctx.beginPath();
      for (let k = 1; k < 6; k++) {
        const q = k / 6;
        ctx.moveTo(wr[0], wr[1]);
        ctx.lineTo(f2[0] + (tip[0] - f2[0]) * q, f2[1] + (tip[1] - f2[1]) * q + s * 0.08);
      }
      ctx.stroke();
      // 翅骨：上臂 + 三根指骨
      const bones = (dy) => {
        ctx.beginPath();
        ctx.moveTo(dir * s * 0.12, -s * 0.05 + dy);
        ctx.lineTo(wr[0], wr[1] + dy);
        for (const p of [tip, f1, f2]) {
          ctx.moveTo(wr[0], wr[1] + dy);
          ctx.quadraticCurveTo((wr[0] + p[0]) / 2, (wr[1] + p[1]) / 2 - s * 0.05 + dy, p[0], p[1] + dy);
        }
      };
      bones(0);
      ctx.strokeStyle = deep(base, far ? 0.9 : 0.78);
      ctx.lineWidth = s * 0.06;
      ctx.stroke();
      if (!far) {
        bones(-s * 0.02);
        ctx.strokeStyle = lightA(base, 0.35, 0.35);
        ctx.lineWidth = s * 0.02;
        ctx.stroke();
      }
      ctx.restore();
      // 翅膀边缘：扇得最快的时候最亮
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      path();
      ctx.strokeStyle = rgba(pink, edge * (far ? 0.25 : 0.5));
      ctx.lineWidth = s * 0.045;
      ctx.stroke();
      ctx.restore();
      // 腕上的小钩爪
      ctx.strokeStyle = light(base, 0.35);
      ctx.lineWidth = s * 0.04;
      ctx.beginPath();
      ctx.moveTo(wr[0], wr[1]);
      ctx.quadraticCurveTo(wr[0] - dir * s * 0.02, wr[1] - s * 0.12, wr[0] - dir * s * 0.08, wr[1] - s * 0.12);
      ctx.stroke();
    }
    // 两只小脚爪
    ctx.strokeStyle = deep(base, 0.7);
    ctx.lineWidth = s * 0.05;
    for (const fx of [-0.07, 0.08]) {
      ctx.beginPath();
      ctx.moveTo(s * fx, s * 0.22);
      ctx.lineTo(s * fx, s * 0.36);
      ctx.lineTo(s * (fx - 0.04), s * 0.36);
      ctx.stroke();
    }
    // 尖耳（会轻轻抖）：外面深色、里面粉色的光
    const tw = Math.sin(t * 2.3 + seed) * s * 0.03;
    ctx.fillStyle = bodyGrad(ctx, -s * 0.3, -s * 0.5, s * 0.3, s * 0.3, base, 0.3, 0.7);
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, -s * 0.2);
    ctx.lineTo(-s * 0.18 + tw, -s * 0.5);
    ctx.lineTo(-s * 0.05, -s * 0.25);
    ctx.lineTo(s * 0.08 - tw, -s * 0.48);
    ctx.lineTo(s * 0.15, -s * 0.2);
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(pink, 0.3);
    ctx.beginPath();
    ctx.moveTo(-s * 0.16, -s * 0.24);
    ctx.lineTo(-s * 0.165 + tw, -s * 0.42);
    ctx.lineTo(-s * 0.09, -s * 0.27);
    ctx.moveTo(s * 0.02, -s * 0.27);
    ctx.lineTo(s * 0.075 - tw, -s * 0.4);
    ctx.lineTo(s * 0.11, -s * 0.24);
    ctx.fill();
    ctx.restore();
    // 身体：毛茸茸的，胸口一撮浅色的毛
    const bodyP = () => {
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.25, s * 0.3, 0, 0, TAU);
    };
    bodyP();
    ctx.fillStyle = bodyGrad(ctx, -s * 0.3, -s * 0.4, s * 0.3, s * 0.3, base, 0.3, 0.7);
    ctx.fill();
    ctx.save();
    bodyP();
    ctx.clip();
    ctx.fillStyle = radial(ctx, -s * 0.06, s * 0.08, 0, s * 0.18, [[0, lightA(base, 0.3, 0.4)], [1, lightA(base, 0.3, 0)]]);
    ctx.fillRect(-s * 0.3, -s * 0.3, s * 0.6, s * 0.6);
    strokes(ctx, 0, -s * 0.02, s * 0.22, s * 0.27, 22, '#c8b0f0', 0.35, 5, -1.9, s * 0.08);
    strokes(ctx, -s * 0.05, s * 0.12, s * 0.12, s * 0.1, 8, '#e8d8ff', 0.4, 9, 1.7, s * 0.07);
    ctx.restore();
    rimEdge(ctx, bodyP, '#ead6ff', 0.5, s * 0.05, s * 0.04, s * 0.04);
    // 小鼻头 + 一颗小尖牙 + 发光的眼睛
    ctx.fillStyle = deep(base, 0.85);
    ctx.beginPath();
    ctx.ellipse(-s * 0.1, -s * 0.0, s * 0.045, s * 0.03, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,250,245,0.9)';
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, s * 0.06);
    ctx.lineTo(-s * 0.07, s * 0.06);
    ctx.lineTo(-s * 0.085, s * 0.11);
    ctx.fill();
    eyes(ctx, -s * 0.08, -s * 0.08, s * 0.16, s * 0.05, pink, -0.1);
  };

  // 南瓜头：五瓣带细纹的南瓜，雕开的刀口里亮着火光；有棱的蒂、卷须和小叶子，藤蔓当腿
  function pumpkinBody(ctx, s, t, o, small) {
    const seed = o.seed || 0;
    const hop = Math.abs(Math.sin(t * (small ? 14 : 8) + seed)) * s * (small ? 0.4 : 0.15);
    shadow(ctx, 0, 2, s * 0.9);
    const base = '#e07a20';
    const vine = '#2a4a1a';
    ctx.save();
    ctx.translate(0, -hop);
    ctx.lineCap = 'round';
    if (!small) {
      for (const [lx, p] of [[-s * 0.3, 0], [s * 0.3, Math.PI]]) {
        const sw = Math.sin(t * 8 + p) * s * 0.12;
        for (const [c, w, d] of [[vine, 0.08, 0], [lightA(vine, 0.35, 0.5), 0.025, 0.02]]) {
          ctx.strokeStyle = c;
          ctx.lineWidth = s * w;
          ctx.beginPath();
          ctx.moveTo(lx * 0.5 + s * d, -s * 0.4);
          ctx.quadraticCurveTo(lx + sw + s * d, -s * 0.2, lx + sw * 1.4 + s * d, hop - s * 0.02);
          ctx.stroke();
        }
        leaf(ctx, lx * 0.75 + sw * 0.5, -s * 0.28, s * 0.16, lx < 0 ? 3.6 : -0.5, '#3a7a2a');
      }
    }
    const cy = small ? -s * 0.7 : -s * 1.05;
    // 一瓣瓣的南瓜：两边的瓣转到背光里更暗，中间的瓣最亮
    for (const [dx, w, d] of [[-0.42, 0.42, 0.5], [0.42, 0.42, 0.42], [-0.22, 0.38, 0.36], [0.22, 0.38, 0.3], [0, 0.32, 0.22]]) {
      const lobe = () => {
        ctx.beginPath();
        ctx.ellipse(s * dx, cy, s * w, s * 0.62, 0, 0, TAU);
      };
      lobe();
      ctx.fillStyle = radial(ctx, s * dx, cy, s * 0.02, s * w * 1.35, [[0, deep(base, Math.max(0, d - 0.22))], [0.6, deep(base, d + 0.12)], [1, deep(base, d + 0.38)]], s * (dx + w * 0.4), cy - s * 0.3);
      ctx.fill();
      ctx.save();
      lobe();
      ctx.clip();
      // 顺着瓣的弧度的细纹
      ctx.strokeStyle = deepA(base, 0.65, 0.25);
      ctx.lineWidth = s * 0.02;
      ctx.beginPath();
      ctx.ellipse(s * dx, cy, s * w * 0.5, s * 0.6, 0, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(s * dx, cy, s * w * 0.5, s * 0.6, 0, Math.PI / 2, Math.PI * 1.5);
      ctx.stroke();
      // 受光的一道高光
      ctx.strokeStyle = lightA(base, 0.5, 0.32);
      ctx.lineWidth = s * 0.035;
      ctx.beginPath();
      ctx.ellipse(s * dx, cy, s * w * 0.7, s * 0.5, 0, -1.3, -0.4);
      ctx.stroke();
      ctx.restore();
      rimEdge(ctx, lobe, '#ffd8a0', 0.35, s * 0.04, s * 0.04, s * 0.04);
    }
    if (!small) speckle(ctx, s * 0.1, cy + s * 0.35, s * 0.55, s * 0.15, 8, '#ffd8a0', 0.22, 13, s * 0.015, s * 0.035);
    // 南瓜蒂：有棱的短柄，顶上一个浅色的切口
    ctx.strokeStyle = vine;
    ctx.lineWidth = s * 0.1;
    ctx.beginPath();
    ctx.moveTo(0, cy - s * 0.58);
    ctx.quadraticCurveTo(s * 0.05, cy - s * 0.85, s * 0.25, cy - s * 0.9);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(150,190,100,0.45)';
    ctx.lineWidth = s * 0.03;
    ctx.beginPath();
    ctx.moveTo(s * 0.03, cy - s * 0.6);
    ctx.quadraticCurveTo(s * 0.08, cy - s * 0.84, s * 0.24, cy - s * 0.93);
    ctx.stroke();
    ctx.fillStyle = '#8aa860';
    ctx.beginPath();
    ctx.ellipse(s * 0.26, cy - s * 0.9, s * 0.03, s * 0.05, 0.4, 0, TAU);
    ctx.fill();
    // 卷须：从蒂上绕出来，轻轻晃
    const cw = Math.sin(t * 3 + seed) * s * 0.05;
    ctx.strokeStyle = '#4a7a2a';
    ctx.lineWidth = s * 0.025;
    ctx.beginPath();
    ctx.moveTo(s * 0.06, cy - s * 0.72);
    ctx.quadraticCurveTo(-s * 0.15, cy - s * 0.95 + cw, -s * 0.28, cy - s * 0.82 + cw);
    ctx.arc(-s * 0.23, cy - s * 0.8 + cw, s * 0.05, Math.PI, Math.PI * 2.6);
    ctx.stroke();
    if (!small) leaf(ctx, -s * 0.02, cy - s * 0.62, s * 0.32, -2.75 + cw / s, '#3a7a2a');
    // 雕出来的脸：刀口是被火照亮的浅色果肉，再往里是火光
    const fire = 0.75 + Math.sin(t * 9 + seed) * 0.15 + Math.sin(t * 23) * 0.08;
    glow(ctx, -s * 0.15, cy + s * 0.05, s * 0.9, '#ffb040', fire * 0.65);
    const face = (ox, oy) => {
      ctx.beginPath();
      for (const ex of [-0.42, 0.02]) {
        ctx.moveTo(s * ex + ox, cy - s * 0.05 + oy);
        ctx.lineTo(s * (ex + 0.12) + ox, cy - s * 0.25 + oy);
        ctx.lineTo(s * (ex + 0.24) + ox, cy - s * 0.05 + oy);
        ctx.closePath();
      }
      ctx.moveTo(-s * 0.5 + ox, cy + s * 0.15 + oy);
      for (let i = 0; i <= 6; i++) ctx.lineTo(-s * 0.5 + i * s * 0.12 + ox, cy + s * (i % 2 ? 0.25 : 0.33) + oy);
      ctx.lineTo(s * 0.22 + ox, cy + s * 0.15 + oy);
      ctx.quadraticCurveTo(-s * 0.14 + ox, cy + s * 0.48 + oy, -s * 0.5 + ox, cy + s * 0.15 + oy);
      ctx.closePath();
    };
    face(0, 0);
    ctx.fillStyle = rgba('#ffe9a8', Math.min(1, fire * 1.1));
    ctx.fill();
    ctx.save();
    face(0, 0);
    ctx.clip();
    face(-s * 0.03, s * 0.03);
    ctx.fillStyle = radial(ctx, -s * 0.14, cy + s * 0.08, 0, s * 0.6, [[0, rgba('#fff2b0', fire)], [0.5, rgba('#ffb040', fire)], [1, rgba('#e0601a', fire)]]);
    ctx.fill();
    ctx.restore();
    for (const ex of [-0.3, 0.14]) glow(ctx, s * ex, cy - s * 0.12, s * 0.2, '#fff0b0', 0.45 * fire, true);
    // 从刀口里飘出来的火星
    if (!small) {
      for (let i = 0; i < 3; i++) {
        const p = (t * 0.8 + i / 3 + seed * 0.13) % 1;
        dot(ctx, s * (-0.35 + i * 0.25) + Math.sin(p * 6 + i) * s * 0.06, cy - s * 0.15 - p * s * 0.9, s * 0.04, '#ffc060', (1 - p) * 0.75);
      }
    }
    ctx.restore();
  }
  D.pumpkin = (ctx, s, t, o) => pumpkinBody(ctx, s, t, o, false);
  D.minipumpkin = (ctx, s, t, o) => pumpkinBody(ctx, s, t, o, true);

  // 骨头先生：高高的骷髅法师。打着补丁、绣着发光符文的旧长袍；胸腔里一团魂火；
  // 骨手握着叉形法杖，杖头托着蓝色鬼火、系着飘带；倒下时是一堆骨头和摊开的袍子
  D.boneMage = function (ctx, s, t, o) {
    const ai = o.ai || {};
    const seed = o.seed || 0;
    const bone = '#e8e2d0';
    const soul = ai.revived ? '#a6f0ff' : '#7ad0ff'; // 复活后的鬼火更亮
    const base = '#4a3a6a';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (ai.mode === 'bones') {
      shadow(ctx, 0, 2, s);
      // 摊在地上的旧袍子
      ctx.fillStyle = bodyGrad(ctx, -s * 0.85, -s * 0.35, s * 0.85, 0, base, 0.35, 0.8);
      ctx.beginPath();
      ctx.moveTo(-s * 0.85, -s * 0.02);
      ctx.quadraticCurveTo(-s * 0.6, -s * 0.3, -s * 0.1, -s * 0.24);
      ctx.quadraticCurveTo(s * 0.45, -s * 0.32, s * 0.82, -s * 0.04);
      for (let i = 0; i < 6; i++) ctx.lineTo(s * (0.68 - i * 0.29), i % 2 ? -s * 0.06 : s * 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(8,6,20,0.4)';
      ctx.lineWidth = s * 0.04;
      ctx.beginPath();
      ctx.moveTo(-s * 0.5, -s * 0.18);
      ctx.quadraticCurveTo(-s * 0.4, -s * 0.08, -s * 0.45, 0);
      ctx.moveTo(s * 0.35, -s * 0.2);
      ctx.quadraticCurveTo(s * 0.45, -s * 0.1, s * 0.4, -s * 0.02);
      ctx.stroke();
      // 一根根骨头：先画暗的，再描一道亮边
      for (let i = 0; i < 6; i++) {
        const a = i * 1.1;
        const bx = -s * 0.6 + i * s * 0.24;
        const pts = [bx - Math.cos(a) * s * 0.2, -s * 0.14 - Math.sin(a) * s * 0.05, bx + Math.cos(a) * s * 0.2, -s * 0.14 + Math.sin(a) * s * 0.05];
        boneStick(ctx, pts[0], pts[1], pts[2], pts[3], s * 0.08, deep(bone, 0.3));
        ctx.strokeStyle = 'rgba(255,252,240,0.5)';
        ctx.lineWidth = s * 0.025;
        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1] - s * 0.025);
        ctx.lineTo(pts[2], pts[3] - s * 0.025);
        ctx.stroke();
      }
      // 骷髅头歪在骨头堆上
      ctx.fillStyle = radial(ctx, s * 0.1, -s * 0.35, s * 0.02, s * 0.36, [[0, light(bone, 0.1)], [1, deep(bone, 0.5)]], s * 0.2, -s * 0.48);
      ctx.beginPath();
      ctx.ellipse(s * 0.1, -s * 0.35, s * 0.3, s * 0.26, 0.3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#08080e';
      for (const [ex, ey] of [[-0.02, -0.4], [0.18, -0.33]]) {
        ctx.beginPath();
        ctx.ellipse(s * ex, s * ey, s * 0.07, s * 0.08, 0.3, 0, TAU);
        ctx.fill();
      }
      // 闪烁的鬼火：快要复活了
      const fl = 0.4 + Math.max(0, Math.sin(t * 12)) * 0.6;
      glow(ctx, s * 0.05, -s * 0.4, s * 0.6, soul, fl * 0.8, true);
      for (const [ex, ey] of [[-0.02, -0.4], [0.18, -0.33]]) dot(ctx, s * ex, s * ey, s * 0.03, soul, fl);
      for (let i = 0; i < 3; i++) {
        const p = (t * 0.7 + i / 3) % 1;
        dot(ctx, s * (-0.2 + i * 0.25) + Math.sin(p * 5 + i) * s * 0.08, -s * 0.3 - p * s * 0.9, s * 0.035, soul, (1 - p) * fl);
      }
      return;
    }
    const sway = Math.sin(t * 2.5 + seed) * 0.04;
    const pulse = 0.75 + Math.sin(t * 3 + seed) * 0.25;
    shadow(ctx, 0, 2, s * 0.9);
    ctx.save();
    ctx.rotate(sway);
    // 长袍：下摆撕成一条条
    const robe = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.3, -s * 1.85);
      ctx.quadraticCurveTo(-s * 0.7, -s * 1.0, -s * 0.7, -s * 0.15);
      for (let i = 0; i < 6; i++) {
        const fx = -s * 0.7 + (i + 1) * s * 0.24;
        ctx.lineTo(fx - s * 0.12, -s * 0.02 - Math.sin(t * 4 + i) * s * 0.06);
        ctx.lineTo(fx, -s * 0.18);
      }
      ctx.quadraticCurveTo(s * 0.65, -s * 1.0, s * 0.3, -s * 1.85);
      ctx.closePath();
    };
    robe();
    ctx.fillStyle = bodyGrad(ctx, -s * 0.7, -s * 2.0, s * 0.7, 0, base, 0.3, 0.78);
    ctx.fill();
    ctx.save();
    robe();
    ctx.clip();
    // 布褶：暗的褶沟 + 旁边一道亮棱
    for (let i = 0; i < 5; i++) {
      const x = -s * 0.46 + i * s * 0.22;
      for (const [dx, c, w] of [[0, 'rgba(8,6,20,0.38)', 0.07], [0.06, lightA(base, 0.3, 0.14), 0.03]]) {
        ctx.strokeStyle = c;
        ctx.lineWidth = s * w;
        ctx.beginPath();
        ctx.moveTo(x * 0.4 + s * dx, -s * 1.7);
        ctx.quadraticCurveTo(x * 0.85 + s * (dx + 0.05), -s * 1.0, x + s * dx, -s * 0.1);
        ctx.stroke();
      }
    }
    // 布纹
    strokes(ctx, 0, -s * 0.9, s * 0.62, s * 0.8, 50, '#0a0818', 0.16, 21, -1.57, s * 0.12);
    // 前襟一条深色的滚边，绣着发光的小符文
    ctx.strokeStyle = deepA(base, 0.85, 0.85);
    ctx.lineWidth = s * 0.1;
    ctx.beginPath();
    ctx.moveTo(-s * 0.04, -s * 1.25);
    ctx.lineTo(-s * 0.2, -s * 0.12);
    ctx.stroke();
    for (let k = 0; k < 5; k++) {
      const x = -s * (0.06 + k * 0.032);
      const y = -s * (1.12 - k * 0.22);
      const d = s * 0.035;
      rune(ctx, [[x, y - d], [x + d, y], [x, y + d], [x - d, y], [x, y - d]], soul, s * 0.018, 0.6 * pulse);
    }
    // 下摆一道发光的波浪绣线
    const hem = [];
    for (let k = 0; k <= 12; k++) hem.push([-s * 0.7 + k * s * 0.12, -s * 0.3 + Math.sin(k * 1.4) * s * 0.03]);
    rune(ctx, hem, soul, s * 0.02, 0.35 * pulse);
    // 一块打着针脚的补丁
    ctx.save();
    ctx.translate(s * 0.32, -s * 0.66);
    ctx.rotate(0.15);
    ctx.fillStyle = deep('#6a5a8a', 0.35);
    ctx.fillRect(-s * 0.1, -s * 0.08, s * 0.2, s * 0.16);
    ctx.strokeStyle = rgba(bone, 0.55);
    ctx.lineWidth = s * 0.012;
    ctx.setLineDash([s * 0.025, s * 0.02]);
    ctx.strokeRect(-s * 0.085, -s * 0.065, s * 0.17, s * 0.13);
    ctx.restore();
    // 下摆的暗部
    ctx.fillStyle = linear(ctx, 0, -s * 0.7, 0, 0, [[0, 'rgba(5,4,15,0)'], [1, 'rgba(5,4,15,0.45)']]);
    ctx.fillRect(-s, -s * 0.7, s * 2, s * 0.7);
    ctx.restore();
    rimEdge(ctx, robe, '#c8b8ff', 0.4, s * 0.05, s * 0.05, s * 0.05);
    // 领口里露出肋骨，胸腔里一团魂火
    const collar = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.27, -s * 1.84);
      ctx.quadraticCurveTo(0, -s * 1.87, s * 0.27, -s * 1.84);
      ctx.quadraticCurveTo(s * 0.13, -s * 1.42, -s * 0.02, -s * 1.12);
      ctx.quadraticCurveTo(-s * 0.15, -s * 1.42, -s * 0.27, -s * 1.84);
    };
    collar();
    ctx.fillStyle = '#0c0a18';
    ctx.fill();
    ctx.save();
    collar();
    ctx.clip();
    glow(ctx, -s * 0.02, -s * 1.5, s * 0.42, soul, 0.65 * pulse, true);
    for (let i = 0; i < 3; i++) {
      const y = -s * 1.72 + i * s * 0.14;
      const rr = s * (0.2 - i * 0.02);
      ctx.strokeStyle = deep(bone, 0.25);
      ctx.lineWidth = s * 0.045;
      ctx.beginPath();
      ctx.arc(-s * 0.02, y, rr, 0.35, Math.PI - 0.35);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,252,240,0.45)';
      ctx.lineWidth = s * 0.015;
      ctx.beginPath();
      ctx.arc(-s * 0.02, y - s * 0.015, rr, 0.5, Math.PI * 0.5);
      ctx.stroke();
    }
    ctx.strokeStyle = deep(bone, 0.2);
    ctx.lineWidth = s * 0.045;
    ctx.beginPath();
    ctx.moveTo(-s * 0.02, -s * 1.8);
    ctx.lineTo(-s * 0.02, -s * 1.38);
    ctx.stroke();
    ctx.restore();
    // 腰绳和一枚会晃的发光小坠
    ctx.strokeStyle = deep('#c8b090', 0.5);
    ctx.lineWidth = s * 0.045;
    ctx.beginPath();
    ctx.moveTo(-s * 0.56, -s * 1.05);
    ctx.quadraticCurveTo(0, -s * 0.95, s * 0.53, -s * 1.08);
    ctx.stroke();
    ctx.save();
    ctx.translate(-s * 0.14, -s * 0.99);
    ctx.rotate(Math.sin(t * 2.6 + seed) * 0.25);
    ctx.strokeStyle = deep('#c8b090', 0.4);
    ctx.lineWidth = s * 0.015;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, s * 0.2);
    ctx.stroke();
    glow(ctx, 0, s * 0.28, s * 0.2, soul, 0.6 * pulse);
    ctx.fillStyle = light(soul, 0.4);
    ctx.beginPath();
    ctx.moveTo(0, s * 0.19);
    ctx.lineTo(s * 0.045, s * 0.28);
    ctx.lineTo(0, s * 0.38);
    ctx.lineTo(-s * 0.045, s * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // 法杖：弯弯的老木头、一道金属箍，杖头分叉托着鬼火
    const staff = (dx) => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.75 + dx, -s * 0.05);
      ctx.quadraticCurveTo(-s * 0.72 + dx, -s * 1.2, -s * 0.8 + dx, -s * 2.3);
      ctx.moveTo(-s * 0.8 + dx, -s * 2.28);
      ctx.quadraticCurveTo(-s * 1.0 + dx, -s * 2.4, -s * 0.94 + dx, -s * 2.66);
      ctx.moveTo(-s * 0.8 + dx, -s * 2.28);
      ctx.quadraticCurveTo(-s * 0.6 + dx, -s * 2.4, -s * 0.66 + dx, -s * 2.66);
    };
    staff(0);
    ctx.strokeStyle = deep('#c8b090', 0.5);
    ctx.lineWidth = s * 0.065;
    ctx.stroke();
    staff(s * 0.018);
    ctx.strokeStyle = 'rgba(240,226,196,0.35)';
    ctx.lineWidth = s * 0.02;
    ctx.stroke();
    ctx.fillStyle = deep('#c8b090', 0.7);
    for (const ky of [-0.75, -1.75]) {
      ctx.beginPath();
      ctx.ellipse(-s * 0.74, s * ky, s * 0.045, s * 0.06, 0, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = '#8a8aa8';
    ctx.lineWidth = s * 0.07;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(-s * 0.79, -s * 2.08);
    ctx.lineTo(-s * 0.79, -s * 2.17);
    ctx.stroke();
    ctx.lineCap = 'round';
    ctx.fillStyle = 'rgba(230,236,255,0.7)';
    ctx.fillRect(-s * 0.775, -s * 2.17, s * 0.02, s * 0.09);
    // 杖头下系着的飘带
    const rw = Math.sin(t * 3.5 + seed) * s * 0.06;
    ctx.strokeStyle = '#7a62c0';
    ctx.lineWidth = s * 0.035;
    for (const k of [0, 1]) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.79, -s * 2.22);
      ctx.bezierCurveTo(-s * 0.65, -s * (2.18 - k * 0.04) + rw, -s * 0.6, -s * (2.02 - k * 0.06) - rw, -s * (0.5 - k * 0.05), -s * (1.95 - k * 0.08) + rw);
      ctx.stroke();
    }
    // 鬼火：外焰 + 白色内核 + 绕着转的小光点
    const fl = 0.7 + Math.sin(t * 7) * 0.2;
    glow(ctx, -s * 0.8, -s * 2.48, s * 0.6, soul, fl, true);
    const fw = Math.sin(t * 9 + seed) * s * 0.02;
    flame(ctx, -s * 0.8 + fw, -s * 2.38, s * 0.1, s * 0.34 + fw, soul, '#ffffff', 0.75 * fl);
    sparkles(ctx, -s * 0.8, -s * 2.5, s * 0.28, s * 0.18, 4, t, soul, 11, s * 0.035);
    // 握着法杖的袖子和骨手
    const sleeve = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.2, -s * 1.8);
      ctx.quadraticCurveTo(-s * 0.55, -s * 1.72, -s * 0.66, -s * 1.42);
      ctx.lineTo(-s * 0.6, -s * 1.2);
      ctx.quadraticCurveTo(-s * 0.42, -s * 1.38, -s * 0.18, -s * 1.46);
      ctx.closePath();
    };
    sleeve();
    ctx.fillStyle = bodyGrad(ctx, -s * 0.7, -s * 1.85, -s * 0.2, -s * 1.2, base, 0.35, 0.8);
    ctx.fill();
    rimEdge(ctx, sleeve, '#c8b8ff', 0.4, s * 0.04, s * 0.04, s * 0.04);
    for (let k = 0; k < 3; k++) boneStick(ctx, -s * 0.66, -s * (1.36 - k * 0.07), -s * 0.8, -s * (1.33 - k * 0.07), s * 0.04, k === 1 ? bone : deep(bone, 0.2));
    // 骷髅头：头顶受光、颧骨下有阴影，一道小裂纹
    const skull = () => {
      ctx.beginPath();
      ctx.ellipse(-s * 0.05, -s * 2.1, s * 0.32, s * 0.3, 0, 0, TAU);
    };
    skull();
    ctx.fillStyle = radial(ctx, -s * 0.05, -s * 2.1, s * 0.02, s * 0.42, [[0, light(bone, 0.3)], [0.55, bone], [1, deep(bone, 0.45)]], s * 0.08, -s * 2.25);
    ctx.fill();
    // 下巴和一排牙
    ctx.fillStyle = bodyGrad(ctx, -s * 0.3, -s * 2.0, s * 0.12, -s * 1.78, bone, 0.08, 0.5);
    ctx.beginPath();
    ctx.moveTo(-s * 0.27, -s * 1.97);
    ctx.lineTo(s * 0.1, -s * 1.97);
    ctx.quadraticCurveTo(s * 0.1, -s * 1.8, -s * 0.06, -s * 1.79);
    ctx.quadraticCurveTo(-s * 0.26, -s * 1.8, -s * 0.27, -s * 1.97);
    ctx.fill();
    ctx.strokeStyle = deep(bone, 0.6);
    ctx.lineWidth = s * 0.015;
    ctx.beginPath();
    ctx.moveTo(-s * 0.24, -s * 1.9);
    ctx.lineTo(s * 0.07, -s * 1.9);
    for (let k = 0; k < 5; k++) {
      const x = -s * 0.2 + k * s * 0.06;
      ctx.moveTo(x, -s * 1.95);
      ctx.lineTo(x, -s * 1.85);
    }
    ctx.moveTo(s * 0.12, -s * 2.36);
    ctx.lineTo(s * 0.07, -s * 2.28);
    ctx.lineTo(s * 0.13, -s * 2.22);
    ctx.stroke();
    ctx.fillStyle = deepA(bone, 0.7, 0.4);
    ctx.beginPath();
    ctx.ellipse(-s * 0.07, -s * 2.02, s * 0.26, s * 0.06, 0, 0, Math.PI);
    ctx.fill();
    // 鼻孔（倒过来的小桃心）和眼窝
    ctx.fillStyle = '#08080e';
    ctx.beginPath();
    ctx.moveTo(-s * 0.07, -s * 1.96);
    ctx.lineTo(-s * 0.11, -s * 2.03);
    ctx.lineTo(-s * 0.03, -s * 2.03);
    ctx.closePath();
    ctx.fill();
    for (const dx of [-0.2, 0.06]) {
      ctx.beginPath();
      ctx.ellipse(s * dx, -s * 2.12, s * 0.09, s * 0.1, 0, 0, TAU);
      ctx.fill();
    }
    eyes(ctx, -s * 0.07, -s * 2.12, s * 0.26, s * 0.045, soul, 0);
    // 眼窝里往上飘的小鬼火
    for (const dx of [-0.2, 0.06]) {
      const p = (t * 1.6 + dx * 3) % 1;
      dot(ctx, s * dx + Math.sin(p * 6) * s * 0.02, -s * (2.17 + p * 0.18), s * 0.025 * (1 - p) + 0.4, soul, (1 - p) * 0.8);
    }
    // 兜帽：内侧一圈发光的绣线
    const hood = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.42, -s * 1.95);
      ctx.quadraticCurveTo(-s * 0.4, -s * 2.55, s * 0.12, -s * 2.55);
      ctx.quadraticCurveTo(s * 0.55, -s * 2.4, s * 0.38, -s * 1.85);
      ctx.quadraticCurveTo(s * 0.3, -s * 2.3, -s * 0.05, -s * 2.38);
      ctx.quadraticCurveTo(-s * 0.32, -s * 2.3, -s * 0.42, -s * 1.95);
    };
    hood();
    ctx.fillStyle = bodyGrad(ctx, -s * 0.45, -s * 2.6, s * 0.5, -s * 1.85, base, 0.35, 0.75);
    ctx.fill();
    ctx.save();
    hood();
    ctx.clip();
    ctx.strokeStyle = 'rgba(8,6,20,0.4)';
    ctx.lineWidth = s * 0.04;
    ctx.beginPath();
    ctx.moveTo(s * 0.1, -s * 2.5);
    ctx.quadraticCurveTo(s * 0.35, -s * 2.35, s * 0.36, -s * 2.0);
    ctx.stroke();
    ctx.restore();
    rimEdge(ctx, hood, '#c8b8ff', 0.5, s * 0.05, s * 0.045, s * 0.045);
    rune(ctx, [[-s * 0.37, -s * 2.0], [-s * 0.3, -s * 2.25], [-s * 0.05, -s * 2.35], [s * 0.2, -s * 2.3], [s * 0.33, -s * 2.0]], soul, s * 0.02, 0.4 * pulse);
    ctx.restore();
    // 身边飘着的小鬼火
    sparkles(ctx, -s * 0.1, -s * 1.3, s * 0.85, s * 0.9, 5, t, soul, 17, s * 0.035);
  };

  // 毒汤婆婆：尖帽子（帽带、补丁、帽尖挂着小星星）、披肩、腰上挂着发光的小药瓶，
  // 用长勺搅着一口铁锅：柴火、锅上的箍和铆钉、漩涡和泡泡、绿色的蒸汽
  D.witch = function (ctx, s, t, o) {
    const ai = o.ai || {};
    const seed = o.seed || 0;
    const brewC = '#7aff6a';
    const brew = ai.phase === 3 ? 0.6 : 1;
    const boil = ai.phase === 2 ? 1.6 : 1; // 煮汤阶段：翻滚得更厉害
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    shadow(ctx, s * 0.2, 2, s * 1.4);
    // ===== 大锅 =====
    ctx.save();
    ctx.translate(-s * 0.85, 0);
    if (ai.phase === 3) {
      // 倒翻的毒汤：从锅沿流下来，在地上积成一滩
      glow(ctx, -s * 0.72, -s * 0.1, s * 0.55, brewC, 0.45);
      ctx.fillStyle = radial(ctx, -s * 0.72, -s * 0.08, 0, s * 0.5, [[0, 'rgba(170,255,150,0.6)'], [1, 'rgba(111,255,106,0.3)']]);
      ctx.beginPath();
      ctx.ellipse(-s * 0.72, -s * 0.08, s * 0.5, s * 0.12, 0, 0, TAU);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        const p = (t * 1.2 + i / 3) % 1;
        ctx.strokeStyle = rgba('#d8ffc0', (1 - p) * 0.6);
        ctx.lineWidth = s * 0.015;
        ctx.beginPath();
        ctx.ellipse(-s * (1.0 - i * 0.25), -s * 0.08, s * 0.08 * p, s * 0.025 * p, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.strokeStyle = rgba(brewC, 0.55);
      ctx.lineWidth = s * 0.08;
      ctx.beginPath();
      ctx.moveTo(-s * 0.6, -s * 1.0);
      ctx.quadraticCurveTo(-s * 0.82, -s * 0.8, -s * 0.74, -s * 0.12);
      ctx.stroke();
    }
    // 三条短腿
    ctx.strokeStyle = '#1a1a24';
    ctx.lineWidth = s * 0.09;
    for (const lx of [-0.42, 0.42, 0]) {
      ctx.beginPath();
      ctx.moveTo(s * lx, -s * 0.2);
      ctx.lineTo(s * lx * 1.12, -s * 0.02);
      ctx.stroke();
    }
    // 锅身：有光泽的铁，上面映着绿光、下面映着火光
    const pot = () => {
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.6, s * 0.68, s * 0.5, 0, 0, TAU);
    };
    pot();
    ctx.fillStyle = radial(ctx, 0, -s * 0.6, s * 0.03, s * 0.78, [[0, '#6a6a80'], [0.45, '#3a3a48'], [1, '#121219']], s * 0.25, -s * 0.85);
    ctx.fill();
    ctx.save();
    pot();
    ctx.clip();
    ctx.fillStyle = linear(ctx, 0, -s * 1.1, 0, -s * 0.55, [[0, rgba(brewC, 0.35 * brew)], [1, rgba(brewC, 0)]]);
    ctx.fillRect(-s * 0.7, -s * 1.1, s * 1.4, s * 0.6);
    ctx.fillStyle = linear(ctx, 0, -s * 0.1, 0, -s * 0.5, [[0, 'rgba(255,138,61,0.45)'], [1, 'rgba(255,138,61,0)']]);
    ctx.fillRect(-s * 0.7, -s * 0.5, s * 1.4, s * 0.4);
    speckle(ctx, 0, -s * 0.5, s * 0.6, s * 0.35, 14, '#000000', 0.22, 5, s * 0.015, s * 0.04);
    // 一圈带铆钉的铁箍
    ctx.strokeStyle = 'rgba(10,10,16,0.65)';
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.74, s * 0.68, s * 0.16, 0, 0, Math.PI);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(170,175,205,0.3)';
    ctx.lineWidth = s * 0.015;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.765, s * 0.68, s * 0.16, 0, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(200,205,225,0.65)';
    for (let k = -3; k <= 3; k++) {
      const x = k * s * 0.18;
      ctx.beginPath();
      ctx.arc(x, -s * 0.74 + s * 0.16 * Math.sqrt(Math.max(0, 1 - (x / (s * 0.68)) ** 2)), s * 0.022, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(225,230,255,0.3)';
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.6, s * 0.55, s * 0.38, 0, -1.1, -0.35);
    ctx.stroke();
    ctx.restore();
    rimEdge(ctx, pot, '#c8d0ff', 0.35, s * 0.05, s * 0.04, s * 0.04);
    // 两边的环形把手
    for (const dir of [-1, 1]) {
      ctx.strokeStyle = '#24242e';
      ctx.lineWidth = s * 0.045;
      ctx.beginPath();
      ctx.ellipse(dir * s * 0.7, -s * 0.8, s * 0.08, s * 0.1, 0, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(200,205,235,0.35)';
      ctx.lineWidth = s * 0.015;
      ctx.beginPath();
      ctx.ellipse(dir * s * 0.7, -s * 0.8, s * 0.08, s * 0.1, 0, -1.6, -0.2);
      ctx.stroke();
    }
    // 柴火和火苗（舔着锅底）
    for (const [x0, y0, x1, y1] of [[-0.48, -0.03, 0.38, -0.12], [-0.4, -0.12, 0.48, -0.03]]) {
      ctx.strokeStyle = '#3a2618';
      ctx.lineWidth = s * 0.1;
      ctx.beginPath();
      ctx.moveTo(s * x0, s * y0);
      ctx.lineTo(s * x1, s * y1);
      ctx.stroke();
      ctx.fillStyle = '#a0784a';
      ctx.beginPath();
      ctx.ellipse(s * x0, s * y0, s * 0.03, s * 0.045, 0, 0, TAU);
      ctx.fill();
    }
    for (let i = 0; i < 3; i++) {
      const f = Math.sin(t * 12 + i) * 3;
      glow(ctx, -s * 0.25 + i * s * 0.25, -s * 0.15 - f, s * 0.25, '#ff8a3d', 0.7);
    }
    [[-0.32, 0.065], [-0.1, 0.085], [0.12, 0.07], [0.31, 0.055]].forEach(([fx, fw], i) => {
      const h = s * (0.16 + 0.07 * Math.sin(t * 12 + i * 1.7) + (i % 2) * 0.05);
      flame(ctx, s * fx, -s * 0.05, s * fw, h, '#ff6a2a', '#ffd27a', 0.75);
    });
    // 厚厚的锅沿
    ctx.fillStyle = linear(ctx, 0, -s * 1.15, 0, -s * 0.86, [[0, '#5a5a6e'], [1, '#1a1a24']]);
    ctx.beginPath();
    ctx.ellipse(0, -s * 1.0, s * 0.71, s * 0.17, 0, 0, TAU);
    ctx.fill();
    // 毒汤：亮绿的汤面，慢慢转的漩涡，冒起又破掉的泡泡
    glow(ctx, 0, -s * 1.05, s * 0.9, brewC, 0.7 * brew * (boil > 1 ? 1.2 : 1), true);
    const soup = () => {
      ctx.beginPath();
      ctx.ellipse(0, -s * 1.0, s * 0.6, s * 0.12, 0, 0, TAU);
    };
    soup();
    ctx.fillStyle = radial(ctx, 0, -s * 1.0, 0, s * 0.6, [[0, rgba('#d8ffc0', 0.95 * brew)], [0.5, rgba(brewC, 0.9 * brew)], [1, rgba('#2a8a3a', 0.9 * brew)]]);
    ctx.fill();
    ctx.save();
    soup();
    ctx.clip();
    const sw = [];
    for (let k = 0; k <= 24; k++) {
      const a = k * 0.45 + t * 1.5 * boil;
      const rr = (k / 24) * s * 0.55;
      sw.push([Math.cos(a) * rr, -s * 1.0 + Math.sin(a) * rr * 0.2]);
    }
    rune(ctx, sw, '#eaffd0', s * 0.025, 0.45 * brew);
    const r = seeded(19);
    for (let i = 0; i < Math.round(4 * boil); i++) {
      const p = (t * 0.9 * boil + i * 0.27 + r() * 0.2) % 1;
      const bx = (r() - 0.5) * s * 0.9;
      ctx.strokeStyle = rgba('#f0ffe0', (1 - p) * 0.7 * brew);
      ctx.lineWidth = s * 0.015;
      ctx.beginPath();
      ctx.ellipse(bx, -s * 1.0 + (r() - 0.5) * s * 0.12, s * 0.07 * p + 0.5, s * 0.025 * p + 0.3, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(205,215,255,0.45)';
    ctx.lineWidth = s * 0.025;
    ctx.beginPath();
    ctx.ellipse(0, -s * 1.0, s * 0.68, s * 0.15, 0, -1.3, -0.15);
    ctx.stroke();
    // 绿色的蒸汽和往上冒的泡泡
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.45 * boil + i / 3) % 1;
      ctx.fillStyle = rgba('#b8ffb0', 0.2 * (1 - p) * brew);
      ctx.beginPath();
      ctx.ellipse(-s * 0.3 + i * s * 0.3 + Math.sin(p * 5 + i) * s * 0.12, -s * 1.08 - p * s * 0.9, s * (0.1 + p * 0.18), s * (0.07 + p * 0.1), 0, 0, TAU);
      ctx.fill();
    }
    for (let i = 0; i < 3; i++) {
      const bt = (t * 1.5 * boil + i * 0.33) % 1;
      dot(ctx, -s * 0.3 + i * s * 0.3, -s * 1.05 - bt * s * 0.7, 1.5 + bt * 2, '#9dff8a', 1 - bt);
    }
    ctx.restore();
    // ===== 婆婆 =====
    ctx.save();
    ctx.translate(s * 0.35, 0);
    const base = '#3a5a3a';
    const skin = '#a8c890';
    const hatC = '#3a2a4a';
    const runeC = '#b08aff';
    // 搅汤：勺子的一头在锅里画圈，手跟着轻轻动
    const st = t * 3;
    const end = [-s * 1.15 + Math.sin(st) * s * 0.22, -s * 1.0 + Math.cos(st) * s * 0.03];
    const hand = [-s * 0.45 + Math.sin(st) * s * 0.05, -s * 1.38];
    // 从帽子下面飘出来的长头发（在身体后面）
    for (let i = 0; i < 5; i++) {
      const w = Math.sin(t * 2 + i) * s * 0.05;
      ctx.strokeStyle = i % 2 ? deep('#a8a0c0', 0.45) : deep('#a8a0c0', 0.25);
      ctx.lineWidth = s * 0.055;
      ctx.beginPath();
      ctx.moveTo(s * (0.04 + i * 0.04), -s * 2.1);
      ctx.bezierCurveTo(s * (0.3 + i * 0.05), -s * 1.95, s * (0.25 + i * 0.06) + w, -s * 1.7, s * (0.42 + i * 0.05) + w * 1.5, -s * (1.42 - i * 0.03));
      ctx.stroke();
    }
    // 长袍：下摆是一圈轻轻摆动的波浪
    const robe = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.2, -s * 1.8);
      ctx.quadraticCurveTo(-s * 0.6, -s * 0.9, -s * 0.6, 0);
      for (let i = 1; i <= 4; i++) ctx.quadraticCurveTo(-s * 0.6 + (i - 0.5) * s * 0.3, -s * 0.08 + Math.sin(t * 3 + i) * s * 0.03, -s * 0.6 + i * s * 0.3, 0);
      ctx.quadraticCurveTo(s * 0.55, -s * 0.9, s * 0.22, -s * 1.8);
      ctx.closePath();
    };
    robe();
    ctx.fillStyle = bodyGrad(ctx, -s * 0.6, -s * 2.0, s * 0.6, 0, base, 0.3, 0.78);
    ctx.fill();
    ctx.save();
    robe();
    ctx.clip();
    for (let i = 0; i < 4; i++) {
      const x = -s * 0.36 + i * s * 0.24;
      for (const [dx, c, w] of [[0, 'rgba(6,12,8,0.4)', 0.07], [0.06, lightA(base, 0.3, 0.14), 0.03]]) {
        ctx.strokeStyle = c;
        ctx.lineWidth = s * w;
        ctx.beginPath();
        ctx.moveTo(x * 0.4 + s * dx, -s * 1.6);
        ctx.quadraticCurveTo(x * 0.85 + s * (dx + 0.04), -s * 0.9, x * 1.1 + s * dx, 0);
        ctx.stroke();
      }
    }
    strokes(ctx, 0, -s * 0.8, s * 0.55, s * 0.75, 45, '#061008', 0.16, 29, -1.57, s * 0.12);
    // 下摆的发光锯齿绣线
    const zig = [];
    for (let k = 0; k <= 14; k++) zig.push([-s * 0.62 + k * s * 0.09, -s * (k % 2 ? 0.14 : 0.2)]);
    rune(ctx, zig, runeC, s * 0.022, 0.5);
    // 补丁
    ctx.save();
    ctx.translate(s * 0.26, -s * 0.55);
    ctx.rotate(-0.12);
    ctx.fillStyle = deep('#6a5a3a', 0.4);
    ctx.fillRect(-s * 0.09, -s * 0.08, s * 0.18, s * 0.15);
    ctx.strokeStyle = 'rgba(232,220,190,0.55)';
    ctx.lineWidth = s * 0.012;
    ctx.setLineDash([s * 0.022, s * 0.018]);
    ctx.strokeRect(-s * 0.075, -s * 0.065, s * 0.15, s * 0.12);
    ctx.restore();
    ctx.fillStyle = linear(ctx, 0, -s * 0.6, 0, 0, [[0, 'rgba(4,8,6,0)'], [1, 'rgba(4,8,6,0.45)']]);
    ctx.fillRect(-s * 0.7, -s * 0.6, s * 1.4, s * 0.6);
    ctx.restore();
    rimEdge(ctx, robe, '#d8ffc8', 0.35, s * 0.05, s * 0.05, s * 0.05);
    // 腰绳和三只发光的小药瓶（会晃）
    ctx.strokeStyle = deep('#c8a070', 0.45);
    ctx.lineWidth = s * 0.04;
    ctx.beginPath();
    ctx.moveTo(-s * 0.48, -s * 1.05);
    ctx.quadraticCurveTo(0, -s * 0.97, s * 0.44, -s * 1.08);
    ctx.stroke();
    [[-0.06, '#ff8ad8'], [0.14, '#7ad0ff'], [0.32, '#ffe07a']].forEach(([vx, vc], i) => {
      ctx.save();
      ctx.translate(s * vx, -s * (1.0 + vx * 0.08));
      ctx.rotate(Math.sin(t * 2.2 + i * 1.3 + seed) * 0.2);
      ctx.strokeStyle = 'rgba(200,170,120,0.7)';
      ctx.lineWidth = s * 0.012;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, s * 0.07);
      ctx.stroke();
      glow(ctx, 0, s * 0.15, s * 0.16, vc, 0.55);
      ctx.fillStyle = 'rgba(210,230,255,0.3)';
      ctx.beginPath();
      ctx.arc(0, s * 0.15, s * 0.06, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgba(vc, 0.9);
      ctx.beginPath();
      ctx.arc(0, s * 0.15, s * 0.05, 0.1, Math.PI - 0.1);
      ctx.fill();
      ctx.fillStyle = '#8a6a40';
      ctx.fillRect(-s * 0.018, s * 0.06, s * 0.036, s * 0.04);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.arc(s * 0.02, s * 0.13, s * 0.012, 0, TAU);
      ctx.fill();
      ctx.restore();
    });
    // 披肩：盖住肩膀，边缘剪成几个尖角
    const pw = Math.sin(t * 2.5 + seed) * s * 0.03;
    const shawl = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.27, -s * 1.8);
      ctx.quadraticCurveTo(-s * 0.46, -s * 1.5, -s * 0.43, -s * 1.22);
      ctx.lineTo(-s * 0.27, -s * 1.34);
      ctx.lineTo(-s * 0.12, -s * 1.12 + pw);
      ctx.lineTo(s * 0.05, -s * 1.32);
      ctx.lineTo(s * 0.22, -s * 1.12 + pw);
      ctx.lineTo(s * 0.34, -s * 1.32);
      ctx.quadraticCurveTo(s * 0.36, -s * 1.62, s * 0.24, -s * 1.8);
      ctx.closePath();
    };
    shawl();
    ctx.fillStyle = bodyGrad(ctx, -s * 0.45, -s * 1.85, s * 0.36, -s * 1.1, '#4a3a5e', 0.3, 0.75);
    ctx.fill();
    ctx.save();
    shawl();
    ctx.clip();
    strokes(ctx, 0, -s * 1.45, s * 0.4, s * 0.25, 22, '#d8c8ff', 0.12, 37, 1.3, s * 0.08);
    ctx.restore();
    rimEdge(ctx, shawl, '#d8c8ff', 0.4, s * 0.04, s * 0.04, s * 0.04);
    // 搅汤的长勺：勺头没进汤里，汤面上一圈涟漪
    const ux = end[0] - hand[0];
    const uy = end[1] - hand[1];
    ctx.strokeStyle = deep('#a07a50', 0.35);
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.moveTo(hand[0] - ux * 0.3, hand[1] - uy * 0.3);
    ctx.lineTo(end[0], end[1]);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(230,200,150,0.35)';
    ctx.lineWidth = s * 0.018;
    ctx.beginPath();
    ctx.moveTo(hand[0] - ux * 0.3, hand[1] - uy * 0.3 - s * 0.015);
    ctx.lineTo(end[0], end[1] - s * 0.015);
    ctx.stroke();
    glow(ctx, end[0], end[1], s * 0.2, brewC, 0.5 * brew);
    ctx.strokeStyle = rgba('#e8ffd8', 0.55 * brew);
    ctx.lineWidth = s * 0.015;
    ctx.beginPath();
    ctx.ellipse(end[0], end[1], s * 0.1, s * 0.025, 0, 0, TAU);
    ctx.stroke();
    // 袖子和绿色的手
    const sleeve = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.08, -s * 1.76);
      ctx.quadraticCurveTo(-s * 0.32, -s * 1.7, hand[0] + s * 0.05, hand[1] - s * 0.12);
      ctx.lineTo(hand[0] + s * 0.12, hand[1] + s * 0.1);
      ctx.quadraticCurveTo(-s * 0.18, -s * 1.36, s * 0.04, -s * 1.46);
      ctx.closePath();
    };
    sleeve();
    ctx.fillStyle = bodyGrad(ctx, -s * 0.5, -s * 1.8, 0, -s * 1.3, '#4a3a5e', 0.3, 0.8);
    ctx.fill();
    rimEdge(ctx, sleeve, '#d8c8ff', 0.4, s * 0.035, s * 0.035, s * 0.035);
    ctx.fillStyle = deep(skin, 0.4);
    ctx.beginPath();
    ctx.ellipse(hand[0], hand[1], s * 0.07, s * 0.06, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = deep(skin, 0.25);
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(hand[0] - s * 0.05, hand[1] - s * 0.03 + k * s * 0.035, s * 0.022, 0, TAU);
      ctx.fill();
    }
    // 脸：尖下巴、长鼻子上一颗小痣，帽檐的阴影盖住额头
    const face = () => {
      ctx.beginPath();
      ctx.ellipse(-s * 0.05, -s * 1.95, s * 0.25, s * 0.26, 0, 0, TAU);
      ctx.moveTo(-s * 0.22, -s * 1.84);
      ctx.quadraticCurveTo(-s * 0.24, -s * 1.68, -s * 0.12, -s * 1.7);
      ctx.lineTo(-s * 0.02, -s * 1.76);
    };
    face();
    ctx.fillStyle = radial(ctx, -s * 0.05, -s * 1.95, s * 0.02, s * 0.32, [[0, deep(skin, 0.22)], [1, deep(skin, 0.62)]], s * 0.06, -s * 2.02);
    ctx.fill();
    ctx.save();
    face();
    ctx.clip();
    ctx.fillStyle = linear(ctx, 0, -s * 2.2, 0, -s * 1.9, [[0, 'rgba(10,8,20,0.65)'], [1, 'rgba(10,8,20,0)']]);
    ctx.fillRect(-s * 0.35, -s * 2.25, s * 0.6, s * 0.4);
    ctx.restore();
    ctx.fillStyle = deep(skin, 0.4);
    ctx.beginPath();
    ctx.moveTo(-s * 0.25, -s * 1.95);
    ctx.quadraticCurveTo(-s * 0.55, -s * 1.85, -s * 0.48, -s * 1.75);
    ctx.lineTo(-s * 0.22, -s * 1.85);
    ctx.fill();
    ctx.strokeStyle = lightA(skin, 0.2, 0.4);
    ctx.lineWidth = s * 0.015;
    ctx.beginPath();
    ctx.moveTo(-s * 0.26, -s * 1.94);
    ctx.quadraticCurveTo(-s * 0.48, -s * 1.86, -s * 0.47, -s * 1.77);
    ctx.stroke();
    ctx.fillStyle = deep(skin, 0.25);
    ctx.beginPath();
    ctx.arc(-s * 0.38, -s * 1.86, s * 0.022, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = deep(skin, 0.8);
    ctx.lineWidth = s * 0.018;
    ctx.beginPath();
    ctx.moveTo(-s * 0.24, -s * 1.8);
    ctx.quadraticCurveTo(-s * 0.17, -s * 1.75, -s * 0.08, -s * 1.8);
    ctx.stroke();
    const blink = (t * 0.35 + seed * 0.21) % 1 < 0.04 ? 0.2 : 1;
    eyes(ctx, -s * 0.15, -s * 2.0, s * 0.16, s * 0.045, '#d8ff8a', -0.1, blink);
    // 脸旁边垂下来的几缕头发
    ctx.strokeStyle = deep('#a8a0c0', 0.2);
    ctx.lineWidth = s * 0.03;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(s * (0.08 + i * 0.05), -s * 2.1);
      ctx.quadraticCurveTo(s * (0.16 + i * 0.05), -s * 1.95, s * (0.12 + i * 0.07) + Math.sin(t * 2 + i) * s * 0.02, -s * (1.78 + i * 0.02));
      ctx.stroke();
    }
    // 宽檐尖帽子：帽尖往后弯，有褶、有补丁，一条发光的帽带和小扣子，帽尖挂着一颗小星星
    const tipY = -s * 3.0 + Math.sin(t * 2) * s * 0.05;
    const brim = () => {
      ctx.beginPath();
      ctx.ellipse(-s * 0.02, -s * 2.15, s * 0.65, s * 0.12, -0.08, 0, TAU);
    };
    brim();
    ctx.fillStyle = linear(ctx, s * 0.5, -s * 2.27, -s * 0.5, -s * 2.05, [[0, deep(hatC, 0.15)], [1, deep(hatC, 0.6)]]);
    ctx.fill();
    rimEdge(ctx, brim, '#e0d0ff', 0.5, s * 0.04, s * 0.03, s * 0.03);
    const cone = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.35, -s * 2.18);
      ctx.quadraticCurveTo(-s * 0.1, -s * 2.9, s * 0.45, tipY);
      ctx.quadraticCurveTo(s * 0.1, -s * 2.7, s * 0.3, -s * 2.2);
      ctx.closePath();
    };
    cone();
    ctx.fillStyle = linear(ctx, -s * 0.35, 0, s * 0.3, 0, [[0, deep(hatC, 0.62)], [0.7, deep(hatC, 0.28)], [1, deep(hatC, 0.42)]]);
    ctx.fill();
    ctx.save();
    cone();
    ctx.clip();
    ctx.strokeStyle = 'rgba(6,4,14,0.45)';
    ctx.lineWidth = s * 0.03;
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, -s * 2.45);
    ctx.quadraticCurveTo(s * 0.05, -s * 2.5, s * 0.18, -s * 2.42);
    ctx.moveTo(-s * 0.02, -s * 2.68);
    ctx.quadraticCurveTo(s * 0.12, -s * 2.72, s * 0.22, -s * 2.66);
    ctx.stroke();
    ctx.save();
    ctx.translate(-s * 0.05, -s * 2.55);
    ctx.rotate(-0.3);
    ctx.fillStyle = deep('#5a4a2a', 0.45);
    ctx.fillRect(-s * 0.07, -s * 0.06, s * 0.14, s * 0.12);
    ctx.strokeStyle = 'rgba(232,220,190,0.5)';
    ctx.lineWidth = s * 0.01;
    ctx.setLineDash([s * 0.018, s * 0.015]);
    ctx.strokeRect(-s * 0.058, -s * 0.048, s * 0.116, s * 0.096);
    ctx.restore();
    ctx.restore();
    rimEdge(ctx, cone, '#e0d0ff', 0.5, s * 0.04, s * 0.035, s * 0.035);
    ctx.fillStyle = deep(runeC, 0.65);
    ctx.beginPath();
    ctx.moveTo(-s * 0.34, -s * 2.2);
    ctx.lineTo(s * 0.3, -s * 2.22);
    ctx.lineTo(s * 0.26, -s * 2.32);
    ctx.lineTo(-s * 0.3, -s * 2.3);
    ctx.closePath();
    ctx.fill();
    rune(ctx, [[-s * 0.3, -s * 2.24], [s * 0.28, -s * 2.26]], runeC, 1.5, 0.7);
    glow(ctx, -s * 0.06, -s * 2.26, s * 0.12, '#ffe07a', 0.5);
    ctx.strokeStyle = '#ffe07a';
    ctx.lineWidth = s * 0.015;
    ctx.strokeRect(-s * 0.1, -s * 2.31, s * 0.08, s * 0.08);
    // 帽尖挂着的小星星
    ctx.save();
    ctx.translate(s * 0.45, tipY);
    ctx.rotate(Math.sin(t * 2.4 + seed) * 0.3);
    ctx.strokeStyle = 'rgba(220,200,255,0.6)';
    ctx.lineWidth = s * 0.01;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, s * 0.14);
    ctx.stroke();
    glow(ctx, 0, s * 0.19, s * 0.2, '#ffe07a', 0.6);
    ctx.fillStyle = '#fff2b0';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const q = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = s * (i % 2 ? 0.025 : 0.06);
      ctx.lineTo(Math.cos(q) * rr, s * 0.19 + Math.sin(q) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    // 飘在身边的紫色小光点
    sparkles(ctx, s * 0.2, -s * 1.9, s * 0.8, s * 0.7, 4, t, runeC, 23, s * 0.03);
  };
})((globalThis.TD = globalThis.TD || {}));
