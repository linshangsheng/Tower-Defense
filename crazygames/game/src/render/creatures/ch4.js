// 第四章 · 冰霜雪原（设计书 56.4、60.3）的怪物画法：工具函数（发光、眼睛、符文、毛发笔触、冰裂纹……）在 creatures.js
(function (TD) {
  'use strict';

  const K = TD.creatures;
  const D = K.drawers;
  const TAU = Math.PI * 2;
  const { deep, light, rgba, bodyGrad, glow, shadow, eyes, rune, dot, wing, jelly, jellyEyes, quadruped, seeded, strokes, speckle, scales, veins, sparkles, rimEdge, linear, radial } = K;

  // ======================================================================
  // 第四章 · 冰霜雪原（设计书 56.4；细节见 60.3）
  // ======================================================================

  // ---------- 本章的小工具 ----------
  // 二次贝塞尔曲线上 u 处的点
  function qb(p0, p1, p2, u) {
    const v = 1 - u;
    return [v * v * p0[0] + 2 * v * u * p1[0] + u * u * p2[0], v * v * p0[1] + 2 * v * u * p1[1] + u * u * p2[1]];
  }

  // 十字形的冰晶闪光
  function twinkle(ctx, x, y, r, color, a) {
    glow(ctx, x, y, r * 2.4, color, a * 0.55);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba(color, Math.min(1, a));
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.fill();
    ctx.restore();
  }

  // 一根有棱面的冰晶（尖朝局部 -y）：受光的右半边亮、背光的左半边深，中间一道亮棱
  function crystal(ctx, x, y, w, h, ang, col, a) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang || 0);
    ctx.globalAlpha *= a === undefined ? 1 : a;
    ctx.fillStyle = deep(col, 0.5);
    ctx.beginPath();
    ctx.moveTo(-w * 0.4, 0);
    ctx.lineTo(-w * 0.5, -h * 0.62);
    ctx.lineTo(0, -h);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = light(col, 0.5);
    ctx.beginPath();
    ctx.moveTo(w * 0.4, 0);
    ctx.lineTo(w * 0.5, -h * 0.62);
    ctx.lineTo(0, -h);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(0.6, w * 0.1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.94);
    ctx.lineTo(0, -h * 0.15);
    ctx.stroke();
    ctx.restore();
  }

  // 垂下来的冰柱：受光一侧亮，左边一道高光
  function icicle(ctx, x, y, w, h, a) {
    ctx.fillStyle = linear(ctx, x + w / 2, y, x - w / 2, y + h, [[0, `rgba(240,252,255,${a})`], [1, `rgba(70,130,200,${a * 0.85})`]]);
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.quadraticCurveTo(x - w * 0.12, y + h * 0.6, x, y + h);
    ctx.quadraticCurveTo(x + w * 0.15, y + h * 0.5, x + w / 2, y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(255,255,255,${a * 0.75})`;
    ctx.lineWidth = Math.max(0.6, w * 0.16);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.12, y + h * 0.08);
    ctx.lineTo(x + w * 0.03, y + h * 0.65);
    ctx.stroke();
  }

  // 发光的六角雪花
  function snowflake(ctx, x, y, r, col, a, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(col, a);
    ctx.lineWidth = Math.max(0.8, r * 0.13);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const q = (i / 6) * TAU;
      const cx = Math.cos(q);
      const cy = Math.sin(q);
      ctx.moveTo(0, 0);
      ctx.lineTo(cx * r, cy * r);
      const bx = cx * r * 0.55;
      const by = cy * r * 0.55;
      for (const d of [-0.65, 0.65]) {
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(q + d) * r * 0.32, by + Math.sin(q + d) * r * 0.32);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  // 压实的雪球：右上受光、左下冷蓝阴影 + 雪地反上来的青光；表面有雪粒、凸起的雪团（spin 时纹理跟着转）和闪烁的冰晶
  function snowOrb(ctx, x, y, r, t, seed, spin) {
    const path = () => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
    };
    path();
    ctx.fillStyle = radial(ctx, x, y, r * 0.05, r * 1.05, [[0, '#ffffff'], [0.42, '#dce9f6'], [0.8, '#8ea8ca'], [1, '#3a5276']], x + r * 0.4, y - r * 0.42);
    ctx.fill();
    ctx.save();
    path();
    ctx.clip();
    // 纹理（滚动时跟着转）
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin || 0);
    // 雪粒：亮的多、暗的少而淡（暗点多了会像月球坑）
    speckle(ctx, 0, 0, r * 0.88, r * 0.88, 8, '#4a6890', 0.16, seed, r * 0.025, r * 0.05);
    speckle(ctx, 0, 0, r * 0.85, r * 0.85, 12, '#ffffff', 0.8, seed + 5, r * 0.025, r * 0.055);
    // 几个鼓起来的雪团：亮的顶面 + 下沿一道淡影
    const rr = seeded(seed + 9);
    ctx.lineWidth = Math.max(0.8, r * 0.04);
    for (let i = 0; i < 3; i++) {
      const q = rr() * TAU;
      const d = 0.3 + rr() * 0.45;
      const cx = Math.cos(q) * r * d;
      const cy = Math.sin(q) * r * d;
      const cr = r * (0.12 + rr() * 0.08);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(cx + cr * 0.1, cy - cr * 0.15, cr * 0.85, cr * 0.7, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(40,64,100,0.18)';
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0.5, 2.8);
      ctx.stroke();
    }
    ctx.restore();
    // 背光一侧的冷色阴影（盖在纹理上，暗处的雪粒也跟着暗）+ 底部的雪地反光
    ctx.fillStyle = linear(ctx, x + r * 0.5, y - r * 0.6, x - r * 0.6, y + r * 0.9, [[0.4, 'rgba(24,40,78,0)'], [1, 'rgba(24,40,78,0.5)']]);
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    glow(ctx, x - r * 0.15, y + r * 1.05, r * 0.8, '#8fdcff', 0.4);
    ctx.restore();
    rimEdge(ctx, path, '#ffffff', 0.85, Math.max(1.5, r * 0.12), r * 0.08, r * 0.08);
    // 表面的冰晶闪光
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + t * 0.5 + seed;
      const tw = Math.max(0, Math.sin(t * 3 + i * 2 + seed));
      if (tw > 0.3) twinkle(ctx, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.5 - r * 0.1, r * 0.17 * tw, '#eefaff', tw);
    }
  }

  // 树枝手臂：一根主枝 + 两根小杈，弯折处沾着雪；up=1 时小杈朝局部 -y
  function twig(ctx, x, y, len, ang, up, col, w) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -up * len * 0.06, len, 0);
    ctx.moveTo(len * 0.6, -up * len * 0.03);
    ctx.lineTo(len * 0.84, -up * len * 0.26);
    ctx.moveTo(len * 0.82, -up * len * 0.01);
    ctx.lineTo(len * 1.02, up * len * 0.12);
    ctx.stroke();
    // 树皮上一道亮边
    ctx.strokeStyle = 'rgba(200,170,140,0.45)';
    ctx.lineWidth = w * 0.35;
    ctx.beginPath();
    ctx.moveTo(len * 0.1, -up * w * 0.3);
    ctx.quadraticCurveTo(len * 0.5, -up * (len * 0.06 + w * 0.3), len * 0.9, -up * w * 0.3);
    ctx.stroke();
    // 沾着的雪
    ctx.fillStyle = 'rgba(236,246,255,0.95)';
    ctx.beginPath();
    ctx.ellipse(len * 0.6, -up * len * 0.06, len * 0.08, len * 0.045, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // 雪团团：两个压实的雪球，冰蓝围巾在身后飘；树枝手、煤球眼里透出蓝光、冰柱小鼻子、冰晶纽扣
  D.snowman = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    const sway = Math.sin(t * 6 + sd) * 0.06;
    const wave = Math.sin(t * (o.attack ? 14 : 5) + sd);
    shadow(ctx, 0, 2, s * 0.9);
    ctx.save();
    ctx.rotate(sway);
    // 远侧的树枝手（在身体后面）
    twig(ctx, s * 0.36, -s * 0.9, s * 0.5, -0.75 - wave * 0.12, 1, '#20140c', s * 0.065);
    // 围巾的尾巴往后飘（在身体后面）
    const fl = Math.sin(t * 8 + sd) * s * 0.05;
    const scarf = '#2f6fae';
    ctx.fillStyle = linear(ctx, s * 0.2, -s * 1.15, s * 0.85, -s * 0.8, [[0, deep(scarf, 0.15)], [1, deep(scarf, 0.55)]]);
    ctx.beginPath();
    ctx.moveTo(s * 0.18, -s * 1.17);
    ctx.quadraticCurveTo(s * 0.55, -s * 1.12 + fl, s * 0.86, -s * 0.94 + fl * 1.6);
    ctx.lineTo(s * 0.8, -s * 0.8 + fl * 1.4);
    ctx.quadraticCurveTo(s * 0.5, -s * 0.94 + fl * 0.6, s * 0.2, -s * 1.0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,230,255,0.55)';
    ctx.lineWidth = s * 0.035;
    ctx.beginPath();
    for (const u of [0.55, 0.75]) {
      ctx.moveTo(s * (0.2 + u * 0.66), -s * (1.17 - u * 0.22) + fl * u * 1.5);
      ctx.lineTo(s * (0.2 + u * 0.6), -s * (1.0 - u * 0.2) + fl * u * 1.2);
    }
    ctx.stroke();
    // 流苏
    ctx.strokeStyle = deep(scarf, 0.3);
    ctx.lineWidth = s * 0.025;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const fx = s * (0.86 - i * 0.03);
      const fy = -s * (0.92 - i * 0.06) + fl * 1.55;
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + s * 0.1, fy + s * 0.03 + fl * 0.4);
    }
    ctx.stroke();
    // 两个雪球
    snowOrb(ctx, 0, -s * 0.6, s * 0.62, t, 1);
    snowOrb(ctx, -s * 0.05, -s * 1.45, s * 0.42, t + 1, 4);
    // 冰晶纽扣：深色底 + 一点蓝光，轮流闪
    for (let i = 0; i < 3; i++) {
      const bx = -s * (0.24 + i * 0.02);
      const by = -s * (0.98 - i * 0.24);
      ctx.fillStyle = 'rgba(16,30,56,0.85)';
      ctx.beginPath();
      ctx.arc(bx, by, s * 0.055, 0, TAU);
      ctx.fill();
      dot(ctx, bx, by, s * 0.03, '#8fe6ff', 0.6 + 0.4 * Math.max(0, Math.sin(t * 4 - i * 1.2)));
    }
    // 围巾绕在脖子上
    ctx.fillStyle = linear(ctx, s * 0.36, -s * 1.24, -s * 0.4, -s * 1.0, [[0, light(scarf, 0.2)], [0.5, scarf], [1, deep(scarf, 0.55)]]);
    ctx.beginPath();
    ctx.moveTo(-s * 0.4, -s * 1.2);
    ctx.quadraticCurveTo(-s * 0.02, -s * 1.1, s * 0.37, -s * 1.22);
    ctx.lineTo(s * 0.38, -s * 1.08);
    ctx.quadraticCurveTo(0, -s * 0.94, -s * 0.42, -s * 1.06);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,230,255,0.5)';
    ctx.lineWidth = s * 0.03;
    ctx.beginPath();
    for (const dx of [-0.22, 0.08]) {
      ctx.moveTo(s * dx, -s * (1.15 - dx * 0.04));
      ctx.lineTo(s * (dx + 0.04), -s * (1.0 - dx * 0.06));
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = s * 0.025;
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, -s * 1.14);
    ctx.quadraticCurveTo(s * 0.15, -s * 1.16, s * 0.34, -s * 1.2);
    ctx.stroke();
    // 前面的树枝手：走路时轻轻挥，攻击时挥得更快
    twig(ctx, -s * 0.4, -s * 0.82, s * 0.74, 3.57 + wave * 0.15, -1, '#3a2418', s * 0.075);
    // 脸：煤球眼窝里透出蓝光、冰柱小鼻子、一排煤球笑嘴
    const hx = -s * 0.05;
    const hy = -s * 1.45;
    ctx.fillStyle = 'rgba(14,22,40,0.9)';
    for (const dx of [-0.25, -0.05]) {
      ctx.beginPath();
      ctx.ellipse(hx + s * dx, hy - s * 0.05, s * 0.075, s * 0.06, -0.15, 0, TAU);
      ctx.fill();
    }
    eyes(ctx, -s * 0.2, -s * 1.5, s * 0.2, s * 0.05, '#7ad8ff', 0);
    ctx.fillStyle = linear(ctx, hx - s * 0.2, hy - s * 0.04, hx - s * 0.56, hy + s * 0.04, [[0, '#dff6ff'], [1, '#5fb4ea']]);
    ctx.beginPath();
    ctx.moveTo(hx - s * 0.2, hy - s * 0.045);
    ctx.lineTo(hx - s * 0.56, hy + s * 0.03);
    ctx.lineTo(hx - s * 0.2, hy + s * 0.05);
    ctx.closePath();
    ctx.fill();
    dot(ctx, hx - s * 0.54, hy + s * 0.03, s * 0.022, '#bff4ff', 0.8);
    ctx.fillStyle = 'rgba(16,24,40,0.85)';
    for (let i = 0; i < 4; i++) {
      const u = i / 3;
      ctx.beginPath();
      ctx.arc(hx - s * (0.32 - u * 0.24), hy + s * (0.17 + Math.sin(u * Math.PI) * 0.05), s * 0.025, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // 身边飘的雪沫
    sparkles(ctx, 0, -s * 1.0, s * 0.95, s * 0.7, 4, t, '#e8f8ff', 3, s * 0.05);
  };

  // 小雪团：滚动的雪球（纹理和嵌着的小石子跟着转，明暗不转），身后扬起雪沫
  D.snowball = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    shadow(ctx, 0, 2, s * 0.8);
    const r = s * 0.65;
    // 身后扬起的雪沫：一团团往后飘、变大、变淡
    for (let i = 0; i < 3; i++) {
      const k = (t * 2.2 + i / 3 + sd * 0.13) % 1;
      ctx.fillStyle = `rgba(228,242,255,${(1 - k) * 0.55})`;
      ctx.beginPath();
      ctx.arc(r * (0.6 + k * 1.3), -r * (0.15 + k * 0.45), r * (0.12 + k * 0.18), 0, TAU);
      ctx.fill();
    }
    // 速度线
    ctx.strokeStyle = 'rgba(220,240,255,0.35)';
    ctx.lineWidth = Math.max(0.8, r * 0.06);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [dy, l] of [[-1.5, 0.5], [-1.0, 0.75], [-0.5, 0.45]]) {
      const ox = Math.sin(t * 9 + dy * 3) * r * 0.08;
      ctx.moveTo(r * 1.1 + ox, r * dy);
      ctx.lineTo(r * (1.1 + l) + ox, r * dy);
    }
    ctx.stroke();
    const spin = -t * 6 - sd;
    snowOrb(ctx, 0, -r, r, t, 2, spin);
    // 嵌在雪里的小石子和一截小树枝：跟着滚
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, -r, r, 0, TAU);
    ctx.clip();
    ctx.translate(0, -r);
    ctx.rotate(spin);
    ctx.fillStyle = 'rgba(30,40,58,0.8)';
    ctx.beginPath();
    ctx.ellipse(r * 0.5, r * 0.3, r * 0.1, r * 0.07, 0.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(58,36,24,0.85)';
    ctx.lineWidth = Math.max(0.8, r * 0.07);
    ctx.beginPath();
    ctx.moveTo(-r * 0.62, -r * 0.2);
    ctx.lineTo(-r * 0.35, -r * 0.45);
    ctx.stroke();
    ctx.restore();
    // 眼睛：深色眼窝里一点蓝光（白雪上也看得清）
    ctx.fillStyle = 'rgba(14,22,40,0.9)';
    for (const dx of [-0.175, 0.175]) {
      ctx.beginPath();
      ctx.ellipse(-r * 0.3 + r * dx, -r * 1.1, r * 0.13, r * 0.1, -0.15, 0, TAU);
      ctx.fill();
    }
    eyes(ctx, -r * 0.3, -r * 1.1, r * 0.35, r * 0.09, '#7ad8ff', 0);
  };

  // 企鹅：肚皮贴地的流线型身体，背上一层细羽毛，头顶两撮金色冠羽，脚蹼在身后蹬
  D.penguin = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    shadow(ctx, 0, 2, s * 1.1);
    // 冰面上划出的一道光痕
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = linear(ctx, s * 0.6, 0, s * 2.0, 0, [[0, 'rgba(160,225,255,0.5)'], [1, 'rgba(160,225,255,0)']]);
    ctx.lineWidth = s * 0.05;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.5, s * 0.02);
    ctx.lineTo(s * 2.0, s * 0.02);
    ctx.stroke();
    ctx.restore();
    const wob = Math.sin(t * 10 + sd) * 0.04;
    ctx.save();
    ctx.translate(0, -s * 0.35);
    ctx.rotate(-0.08 + wob);
    // 脚蹼在身后一蹬一蹬
    for (const [dy, p] of [[0.06, 0], [0.18, Math.PI]]) {
      const kk = Math.sin(t * 14 + sd + p) * s * 0.06;
      ctx.fillStyle = p ? '#c4642a' : '#ff9a3a';
      ctx.beginPath();
      ctx.moveTo(s * 0.92, s * dy - s * 0.05);
      ctx.lineTo(s * 1.24 + kk, s * dy - s * 0.09 + kk * 0.4);
      ctx.lineTo(s * 1.2 + kk, s * dy + s * 0.07 + kk * 0.4);
      ctx.closePath();
      ctx.fill();
    }
    const bodyPath = () => {
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 1.05, s * 0.36, 0, 0, TAU);
    };
    bodyPath();
    ctx.fillStyle = linear(ctx, s * 0.4, -s * 0.36, s * 0.1, s * 0.36, [[0, '#4d6896'], [0.45, '#22314f'], [1, '#0c1426']]);
    ctx.fill();
    ctx.save();
    bodyPath();
    ctx.clip();
    // 背上的细羽毛（往后梳）和几点发光的霜斑
    strokes(ctx, s * 0.15, -s * 0.16, s * 0.85, s * 0.16, 34, '#9cbce6', 0.28, 11, 0.08, s * 0.14);
    strokes(ctx, s * 0.1, s * 0.0, s * 0.8, s * 0.1, 16, '#0a1220', 0.4, 12, 0.1, s * 0.12);
    speckle(ctx, s * 0.3, -s * 0.2, s * 0.45, s * 0.07, 5, '#9fe6ff', 0.85, 21, s * 0.02, s * 0.035, 0.35);
    // 白肚皮：上沿亮、下沿透一点冰面的蓝光，有一排排小羽片
    const bellyPath = () => {
      ctx.beginPath();
      ctx.ellipse(-s * 0.1, s * 0.12, s * 0.85, s * 0.2, 0, 0, TAU);
    };
    bellyPath();
    ctx.fillStyle = linear(ctx, 0, -s * 0.08, 0, s * 0.34, [[0, 'rgba(240,248,255,0.97)'], [0.6, 'rgba(176,200,230,0.95)'], [1, 'rgba(96,130,180,0.92)']]);
    ctx.fill();
    ctx.save();
    bellyPath();
    ctx.clip();
    scales(ctx, -s * 0.95, -s * 0.05, s * 0.75, s * 0.3, s * 0.11, '#5a76a6', 0.22);
    glow(ctx, -s * 0.1, s * 0.4, s * 0.5, '#8fdcff', 0.35);
    ctx.restore();
    // 背上一道亮光
    ctx.strokeStyle = 'rgba(200,225,255,0.4)';
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.ellipse(s * 0.05, s * 0.04, s * 0.95, s * 0.32, 0, -2.2, -0.9);
    ctx.stroke();
    ctx.restore();
    rimEdge(ctx, bodyPath, '#d6ecff', 0.6, s * 0.06, s * 0.04, s * 0.05);
    // 眼后一道发光的霜纹
    rune(ctx, [[-s * 0.82, -s * 0.15], [-s * 0.62, -s * 0.23], [-s * 0.4, -s * 0.21]], '#9fe6ff', s * 0.035, 0.55);
    // 往后贴着的鳍：轻轻拍
    ctx.save();
    ctx.translate(s * 0.02, -s * 0.06);
    ctx.rotate(0.15 + Math.sin(t * 10 + sd + 1) * 0.12);
    ctx.fillStyle = linear(ctx, 0, -s * 0.1, 0, s * 0.1, [[0, '#3a527e'], [1, '#0c1426']]);
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.06);
    ctx.quadraticCurveTo(s * 0.4, -s * 0.13, s * 0.72, s * 0.02);
    ctx.quadraticCurveTo(s * 0.4, s * 0.1, 0, s * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,228,255,0.6)';
    ctx.lineWidth = s * 0.025;
    ctx.beginPath();
    ctx.moveTo(s * 0.05, -s * 0.06);
    ctx.quadraticCurveTo(s * 0.4, -s * 0.13, s * 0.7, s * 0.01);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(150,185,230,0.3)';
    ctx.lineWidth = s * 0.018;
    ctx.beginPath();
    for (const fx of [0.25, 0.42, 0.56]) {
      ctx.moveTo(s * fx, -s * 0.05);
      ctx.lineTo(s * (fx + 0.1), s * 0.03);
    }
    ctx.stroke();
    ctx.restore();
    // 头顶两撮金色冠羽，滑行时一颤一颤
    for (let i = 0; i < 2; i++) {
      const bob = Math.sin(t * 12 + sd + i) * s * 0.04;
      ctx.strokeStyle = i ? '#e0a83a' : '#ffd36a';
      ctx.lineWidth = s * (0.05 - i * 0.012);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-s * (0.74 - i * 0.08), -s * 0.24);
      ctx.quadraticCurveTo(-s * (0.66 - i * 0.08), -s * 0.42, -s * (0.42 - i * 0.06), -s * (0.42 + i * 0.03) + bob);
      ctx.stroke();
      dot(ctx, -s * (0.42 - i * 0.06), -s * (0.42 + i * 0.03) + bob, s * 0.025, '#ffe08a', 0.6);
    }
    // 喙：上喙亮、下喙深，一道高光
    ctx.fillStyle = '#ffb040';
    ctx.beginPath();
    ctx.moveTo(-s * 1.0, -s * 0.09);
    ctx.lineTo(-s * 1.32, -s * 0.02);
    ctx.lineTo(-s * 1.0, s * 0.0);
    ctx.fill();
    ctx.fillStyle = '#c8701e';
    ctx.beginPath();
    ctx.moveTo(-s * 1.0, s * 0.0);
    ctx.lineTo(-s * 1.26, -s * 0.01);
    ctx.lineTo(-s * 1.0, s * 0.05);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,200,0.7)';
    ctx.lineWidth = s * 0.02;
    ctx.beginPath();
    ctx.moveTo(-s * 1.02, -s * 0.07);
    ctx.lineTo(-s * 1.22, -s * 0.03);
    ctx.stroke();
    // 眼圈 + 发光的眼睛
    ctx.fillStyle = 'rgba(230,242,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.78, -s * 0.12, s * 0.075, s * 0.06, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#0a1220';
    ctx.beginPath();
    ctx.ellipse(-s * 0.78, -s * 0.12, s * 0.05, s * 0.04, 0, 0, TAU);
    ctx.fill();
    eyes(ctx, -s * 0.78, -s * 0.12, 0.01, s * 0.06, '#e8f8ff', 0);
    ctx.restore();
    // 身后溅起的冰屑
    for (let i = 0; i < 4; i++) {
      const k = (t * 1.8 + i / 4 + sd * 0.1) % 1;
      dot(ctx, s * (1.1 + k * 0.9), -s * (0.05 + k * 0.4) + k * k * s * 0.3, s * 0.05 * (1 - k * 0.5), '#cfefff', (1 - k) * 0.8);
    }
  };

  // 冰晶精灵的光翅：半透明的膜上有冰纹翅脉，翼尖一点光
  function iceWing(ctx, x, y, len, wid, ang, col) {
    wing(ctx, x, y, len, wid, ang, col);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    rune(ctx, [[0, 0], [wid * 0.2, -len * 0.5], [wid * 0.12, -len * 0.92]], '#e8fbff', Math.max(0.7, len * 0.03), 0.6);
    rune(ctx, [[wid * 0.12, -len * 0.38], [wid * 0.5, -len * 0.52]], '#e8fbff', Math.max(0.6, len * 0.022), 0.45);
    rune(ctx, [[wid * 0.18, -len * 0.62], [wid * 0.45, -len * 0.78]], '#e8fbff', Math.max(0.6, len * 0.022), 0.45);
    dot(ctx, 0, -len * 0.97, len * 0.035, '#e8fbff', 0.7);
    ctx.restore();
  }

  // 冰晶精灵：漂浮的多棱冰晶（脸是一块深色的冰窟，里面两点光）+ 两对光翅 + 寒气光环 + 身下拖着三片小冰晶
  D.iceSprite = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    const fl = Math.sin(t * 3 + sd) * s * 0.15;
    ctx.translate(0, -s * 1.2 + fl);
    const flap = Math.sin(t * 12);
    // 外层的光雾
    glow(ctx, 0, 0, s * 1.3, '#7fd0ff', 0.35);
    // 身下坠着的三片小冰晶，像短尾巴一样摇
    for (let i = 1; i <= 3; i++) {
      const tx = s * (0.03 + i * 0.05) + Math.sin(t * 4 + sd - i) * s * 0.06;
      const ty = s * (0.55 + i * 0.08);
      glow(ctx, tx, ty + s * 0.05, s * 0.18, '#9fe3ff', 0.45 - i * 0.1);
      crystal(ctx, tx, ty, s * (0.14 - i * 0.025), s * (0.16 - i * 0.03), Math.PI + Math.sin(t * 4 - i) * 0.3, '#9fd8ff', 0.95 - i * 0.2);
    }
    // 寒气光环（两圈，反着转）和光环上的小光点
    ctx.strokeStyle = 'rgba(160,230,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.1, s * 0.35, t * 0.5, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(200,240,255,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.8, s * 0.22, -t * 0.7, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const q = t * 1.6 + i * 2.09;
      const ex = Math.cos(q) * s * 1.1;
      const ey = Math.sin(q) * s * 0.35;
      const c = Math.cos(t * 0.5);
      const sn = Math.sin(t * 0.5);
      dot(ctx, ex * c - ey * sn, ex * sn + ey * c, s * 0.05, '#dff8ff', 0.8);
    }
    // 翅膀：下面一对小的、上面一对大的
    iceWing(ctx, s * 0.08, s * 0.05, s * 0.55, s * 0.26, 2.1 + flap * 0.2, '#bfefff');
    iceWing(ctx, -s * 0.08, s * 0.05, s * 0.55, s * 0.26, -2.1 - flap * 0.2, '#bfefff');
    iceWing(ctx, s * 0.1, -s * 0.1, s * 0.9, s * 0.4, 0.7 + flap * 0.3, '#bfefff');
    iceWing(ctx, -s * 0.1, -s * 0.1, s * 0.9, s * 0.4, -0.7 - flap * 0.3, '#bfefff');
    glow(ctx, 0, 0, s * 1.0, '#9fe3ff', 0.6, true);
    // 多棱冰晶身体：四个棱面明暗不同（光从右上来）
    const T = [0, -s * 0.65];
    const R = [s * 0.3, 0];
    const B = [0, s * 0.6];
    const L = [-s * 0.3, 0];
    const C = [s * 0.04, -s * 0.06];
    const facet = (p, q, col) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
      ctx.lineTo(C[0], C[1]);
      ctx.closePath();
      ctx.fill();
    };
    facet(T, R, 'rgba(244,252,255,0.96)');
    facet(T, L, 'rgba(170,220,248,0.92)');
    facet(R, B, 'rgba(100,165,225,0.9)');
    facet(L, B, 'rgba(40,86,160,0.92)');
    // 体内的光核（呼吸一样明暗）
    glow(ctx, 0, s * 0.12, s * 0.45, '#dff8ff', 0.55 + Math.sin(t * 4 + sd) * 0.2, true);
    // 棱线
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = Math.max(0.7, s * 0.03);
    ctx.beginPath();
    ctx.moveTo(T[0], T[1]);
    ctx.lineTo(C[0], C[1]);
    ctx.lineTo(B[0], B[1]);
    ctx.moveTo(L[0], L[1]);
    ctx.lineTo(C[0], C[1]);
    ctx.lineTo(R[0], R[1]);
    ctx.stroke();
    rimEdge(
      ctx,
      () => {
        ctx.beginPath();
        ctx.moveTo(T[0], T[1]);
        ctx.lineTo(R[0], R[1]);
        ctx.lineTo(B[0], B[1]);
        ctx.lineTo(L[0], L[1]);
        ctx.closePath();
      },
      '#ffffff',
      0.8,
      s * 0.06,
      s * 0.04,
      s * 0.04
    );
    // 脸：一块深色的冰窟，两点光
    ctx.fillStyle = 'rgba(14,34,74,0.82)';
    ctx.beginPath();
    ctx.moveTo(-s * 0.07, -s * 0.2);
    ctx.lineTo(s * 0.08, -s * 0.06);
    ctx.lineTo(-s * 0.07, s * 0.1);
    ctx.lineTo(-s * 0.22, -s * 0.05);
    ctx.closePath();
    ctx.fill();
    eyes(ctx, -s * 0.07, -s * 0.05, s * 0.14, s * 0.035, '#ffffff', 0);
    // 顶尖的闪光和身边飘散的光点
    twinkle(ctx, 0, -s * 0.66, s * 0.14 * (0.6 + 0.4 * Math.sin(t * 5 + sd)), '#ffffff', 0.85);
    sparkles(ctx, 0, s * 0.1, s * 0.85, s * 0.6, 5, t, '#dff8ff', 31, s * 0.05);
  };

  // 北极狼：修长的身体、长腿、蓬松的尾巴往后拖；颈毛一簇簇，侧腹一道发光的霜纹
  D.wolf = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    shadow(ctx, 0, 2, s * 1.1);
    const base = '#9ab0c8';
    const q = quadruped(ctx, s, t, o, { base, len: s * 1.8, high: s * 0.32, legLen: s * 0.62, run: o.attack ? 0.4 : 1.5 });
    const by = q.bodyY;
    const L = q.L;
    const high = s * 0.32;
    // 爪子
    for (const [lx, p, far] of [[-L * 0.32, 0, true], [L * 0.34, Math.PI, true], [-L * 0.28, Math.PI, false], [L * 0.4, 0, false]]) {
      const fx = lx + Math.sin(q.ph + p) * s * 0.45 - s * 0.05;
      ctx.fillStyle = deep(base, far ? 0.78 : 0.55);
      ctx.beginPath();
      ctx.ellipse(fx - s * 0.04, -s * 0.03, s * 0.09, s * 0.045, 0, 0, TAU);
      ctx.fill();
    }
    // 身体：浅色肚皮、两层毛发笔触、侧腹的霜纹
    const bodyPath = () => {
      ctx.beginPath();
      ctx.ellipse(0, by, L * 0.62, high, -0.05, 0, TAU);
    };
    ctx.save();
    bodyPath();
    ctx.clip();
    ctx.fillStyle = 'rgba(225,238,250,0.3)';
    ctx.beginPath();
    ctx.ellipse(-L * 0.05, by + high * 0.75, L * 0.5, high * 0.45, 0, 0, TAU);
    ctx.fill();
    strokes(ctx, 0, by + high * 0.25, L * 0.55, high * 0.6, 20, '#1c2a40', 0.3, 5, 0.3, s * 0.16);
    strokes(ctx, s * 0.1, by - high * 0.45, L * 0.5, high * 0.35, 18, '#eef6ff', 0.5, 8, 0.15, s * 0.15);
    rune(ctx, [[-L * 0.38, by - high * 0.05], [-L * 0.15, by + high * 0.25], [L * 0.1, by + high * 0.05], [L * 0.35, by + high * 0.3]], '#8ae0ff', s * 0.04, 0.5);
    speckle(ctx, -L * 0.12, by - high * 0.25, L * 0.18, high * 0.12, 3, '#8ae0ff', 0.8, 9, s * 0.02, s * 0.03, 0.3);
    ctx.restore();
    rimEdge(ctx, bodyPath, '#eaf6ff', 0.6, s * 0.06, s * 0.04, s * 0.05);
    // 尾巴：蓬松的下沿、毛发笔触、尾尖一团白光
    const tw = Math.sin(q.ph * 0.5) * s * 0.1;
    const tailPath = () => {
      ctx.beginPath();
      ctx.moveTo(s * 0.8, by - s * 0.15);
      ctx.quadraticCurveTo(s * 1.3, by - s * 0.38 + tw, s * 1.72, by - s * 0.12 + tw);
      ctx.quadraticCurveTo(s * 1.58, by - s * 0.04 + tw, s * 1.52, by + s * 0.04 + tw * 0.8);
      ctx.quadraticCurveTo(s * 1.42, by - s * 0.02 + tw * 0.6, s * 1.3, by + s * 0.08 + tw * 0.5);
      ctx.quadraticCurveTo(s * 1.15, by + s * 0.0 + tw * 0.3, s * 1.02, by + s * 0.1);
      ctx.quadraticCurveTo(s * 0.9, by + s * 0.03, s * 0.8, by + s * 0.05);
      ctx.closePath();
    };
    tailPath();
    ctx.fillStyle = bodyGrad(ctx, s * 0.6, by - s * 0.4, s * 1.7, by + s * 0.2, base, 0.2, 0.65);
    ctx.fill();
    ctx.save();
    tailPath();
    ctx.clip();
    strokes(ctx, s * 1.25, by - s * 0.1 + tw * 0.5, s * 0.45, s * 0.14, 14, '#eef6ff', 0.45, 15, 0.05, s * 0.16);
    ctx.fillStyle = radial(ctx, s * 1.62, by - s * 0.1 + tw, 0, s * 0.3, [[0, 'rgba(245,252,255,0.8)'], [1, 'rgba(245,252,255,0)']]);
    ctx.fillRect(s * 1.2, by - s * 0.5 + tw, s * 0.6, s * 0.7);
    ctx.restore();
    rimEdge(ctx, tailPath, '#eaf6ff', 0.6, s * 0.05, s * 0.03, s * 0.04);
    // 远侧的耳朵（暗一点）
    ctx.fillStyle = deep(base, 0.7);
    ctx.beginPath();
    ctx.moveTo(-s * 0.8, by - s * 0.6);
    ctx.lineTo(-s * 0.68, by - s * 0.9);
    ctx.lineTo(-s * 0.62, by - s * 0.55);
    ctx.fill();
    // 颈毛与头
    const headPath = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.55, by - s * 0.3);
      ctx.quadraticCurveTo(-s * 0.85, by - s * 0.75, -s * 1.15, by - s * 0.6);
      ctx.lineTo(-s * 1.55, by - s * 0.42);
      ctx.quadraticCurveTo(-s * 1.5, by - s * 0.3, -s * 1.15, by - s * 0.28);
      ctx.quadraticCurveTo(-s * 0.95, by + s * 0.1, -s * 0.6, by + s * 0.15);
      ctx.closePath();
    };
    const headFill = bodyGrad(ctx, -s * 1.5, by - s * 0.7, -s * 0.5, by + s * 0.2, base, 0.2, 0.65);
    // 颈后和胸前一簇簇的毛（先画，头盖住根部）
    ctx.fillStyle = headFill;
    for (const [p0, p1, p2, us, dx, dy] of [
      [[-s * 0.55, by - s * 0.3], [-s * 0.85, by - s * 0.75], [-s * 1.15, by - s * 0.6], [0.25, 0.5], s * 0.12, -s * 0.06],
      [[-s * 1.15, by - s * 0.28], [-s * 0.95, by + s * 0.1], [-s * 0.6, by + s * 0.15], [0.3, 0.55, 0.8], -s * 0.06, s * 0.13],
    ]) {
      for (const u of us) {
        const a = qb(p0, p1, p2, u - 0.08);
        const b = qb(p0, p1, p2, u + 0.08);
        const m = qb(p0, p1, p2, u);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(m[0] + dx, m[1] + dy);
        ctx.lineTo(b[0], b[1]);
        ctx.closePath();
        ctx.fill();
      }
    }
    headPath();
    ctx.fillStyle = headFill;
    ctx.fill();
    ctx.save();
    headPath();
    ctx.clip();
    strokes(ctx, -s * 0.85, by - s * 0.2, s * 0.3, s * 0.3, 16, '#1c2a40', 0.35, 17, 0.6, s * 0.14);
    strokes(ctx, -s * 0.95, by - s * 0.5, s * 0.3, s * 0.12, 10, '#eef6ff', 0.5, 18, 0.2, s * 0.12);
    // 浅色的口鼻
    ctx.fillStyle = 'rgba(232,242,252,0.4)';
    ctx.beginPath();
    ctx.ellipse(-s * 1.3, by - s * 0.34, s * 0.22, s * 0.07, -0.3, 0, TAU);
    ctx.fill();
    ctx.restore();
    // 轮廓光只描头顶（后脑那条边连着身体，描亮了会像一道接缝）
    rimEdge(ctx, headPath, '#eaf6ff', 0.65, s * 0.05, 0, s * 0.045);
    // 竖起的耳朵（内侧深色）
    ctx.fillStyle = headFill;
    ctx.beginPath();
    ctx.moveTo(-s * 0.95, by - s * 0.62);
    ctx.lineTo(-s * 0.85, by - s * 0.95);
    ctx.lineTo(-s * 0.75, by - s * 0.58);
    ctx.fill();
    ctx.fillStyle = 'rgba(16,24,40,0.55)';
    ctx.beginPath();
    ctx.moveTo(-s * 0.91, by - s * 0.63);
    ctx.lineTo(-s * 0.85, by - s * 0.86);
    ctx.lineTo(-s * 0.8, by - s * 0.61);
    ctx.fill();
    // 鼻头（带一点高光）和嘴线
    ctx.fillStyle = '#121a28';
    ctx.beginPath();
    ctx.ellipse(-s * 1.53, by - s * 0.42, s * 0.05, s * 0.04, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(-s * 1.52, by - s * 0.44, s * 0.015, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(16,24,40,0.55)';
    ctx.lineWidth = s * 0.025;
    ctx.beginPath();
    ctx.moveTo(-s * 1.48, by - s * 0.34);
    ctx.quadraticCurveTo(-s * 1.38, by - s * 0.3, -s * 1.26, by - s * 0.32);
    ctx.stroke();
    // 眼后一道霜纹 + 发光的眼睛
    rune(ctx, [[-s * 1.1, by - s * 0.54], [-s * 0.98, by - s * 0.6], [-s * 0.86, by - s * 0.56]], '#8ae0ff', s * 0.03, 0.45);
    eyes(ctx, -s * 1.18, by - s * 0.5, 0.01, s * 0.06, '#8ae0ff', -0.2);
    // 呼出的白气
    const bk = (t * 1.5 + sd * 0.1) % 1;
    glow(ctx, -s * (1.62 + bk * 0.4), by - s * (0.4 + bk * 0.1), s * (0.1 + bk * 0.15), '#e8f8ff', (1 - bk) * 0.4);
  };

  // 雪怪：驼背的大块头，肩膀很高、长手臂垂到地上；一身一绺绺的长毛，背上长着冰晶，肩上一枚发光的雪花纹
  D.yeti = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    const ph = t * 4 + sd;
    const step = Math.sin(ph);
    shadow(ctx, 0, 2, s * 1.2);
    const base = '#a8bcd4';
    // 腿：毛发笔触 + 三颗浅色钝爪
    for (const [lx, p, far] of [[s * 0.35, 1, true], [-s * 0.05, -1, false]]) {
      const x = lx + step * p * s * 0.12;
      ctx.beginPath();
      ctx.ellipse(x, -s * 0.32, s * 0.22, s * 0.34, 0, 0, TAU);
      ctx.fillStyle = bodyGrad(ctx, x - s * 0.22, -s * 0.66, x + s * 0.22, 0, base, far ? 0.6 : 0.35, far ? 0.85 : 0.72);
      ctx.fill();
      // 毛发笔触落在腿的范围里（笔触往下长，所以区域偏上）
      strokes(ctx, x, -s * 0.42, s * 0.15, s * 0.22, 9, '#0e1828', 0.4, 3 + p, 1.75, s * 0.14);
      if (!far) strokes(ctx, x + s * 0.07, -s * 0.46, s * 0.08, s * 0.18, 6, '#eef6ff', 0.35, 6, 1.7, s * 0.12);
      ctx.fillStyle = far ? 'rgba(150,170,195,0.7)' : '#dfe8f2';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(x - s * 0.17 + i * s * 0.07, -s * 0.03, s * 0.035, s * 0.028, 0, 0, TAU);
        ctx.fill();
      }
    }
    // 远侧手臂
    ctx.strokeStyle = deep(base, 0.8);
    ctx.lineWidth = s * 0.26;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.1, -s * 1.55);
    ctx.quadraticCurveTo(-s * 0.2, -s * 1.0, -s * 0.15 - step * s * 0.1, -s * 0.2);
    ctx.stroke();
    // 身体轮廓外一圈蓬乱的毛簇（先画，身体盖住根部）：背上往右下翘、下摆往下垂
    const bodyPath = () => {
      ctx.beginPath();
      ctx.moveTo(s * 0.6, -s * 0.45);
      ctx.quadraticCurveTo(s * 0.85, -s * 1.3, s * 0.35, -s * 1.85);
      ctx.quadraticCurveTo(-s * 0.2, -s * 2.25, -s * 0.7, -s * 1.85);
      ctx.quadraticCurveTo(-s * 0.95, -s * 1.4, -s * 0.6, -s * 0.9);
      ctx.quadraticCurveTo(-s * 0.3, -s * 0.5, s * 0.6, -s * 0.45);
    };
    const tuft = (p0, p1, p2, us, dx, dy, col) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      for (const u of us) {
        const a = qb(p0, p1, p2, u - 0.06);
        const b = qb(p0, p1, p2, u + 0.06);
        const m = qb(p0, p1, p2, u);
        const sw = Math.sin(ph * 0.8 + u * 6) * s * 0.02;
        ctx.moveTo(a[0], a[1]);
        ctx.quadraticCurveTo(m[0] + dx * 0.4, m[1] + dy * 0.6, m[0] + dx + sw, m[1] + dy);
        ctx.lineTo(b[0], b[1]);
        ctx.closePath();
      }
      ctx.fill();
    };
    tuft([s * 0.6, -s * 0.45], [s * 0.85, -s * 1.3], [s * 0.35, -s * 1.85], [0.2, 0.42, 0.64, 0.86], s * 0.1, s * 0.07, deep(base, 0.35));
    tuft([s * 0.35, -s * 1.85], [-s * 0.2, -s * 2.25], [-s * 0.7, -s * 1.85], [0.12, 0.32], s * 0.1, -s * 0.06, deep(base, 0.2));
    tuft([-s * 0.6, -s * 0.9], [-s * 0.3, -s * 0.5], [s * 0.6, -s * 0.45], [0.15, 0.35, 0.55, 0.75, 0.92], s * 0.02, s * 0.14, deep(base, 0.62));
    // 驼背的身体：肩膀高、往前探；径向明暗，受光的肩头最亮
    const fur = radial(ctx, s * 0.2, -s * 1.7, s * 0.1, s * 1.7, [[0, light(base, 0.3)], [0.35, deep(base, 0.12)], [1, deep(base, 0.72)]], s * 0.3, -s * 1.85);
    bodyPath();
    ctx.fillStyle = fur;
    ctx.fill();
    ctx.save();
    bodyPath();
    ctx.clip();
    // 一层层的毛绺：从下往上画，上面一层盖住下面一层的根部；每绺先落一道影子，再用身体的明暗填色，右侧描一道亮边
    const hiLine = linear(ctx, -s * 0.7, 0, s * 0.6, 0, [[0, 'rgba(240,248,255,0.12)'], [1, 'rgba(240,248,255,0.6)']]);
    const w = s * 0.11;
    ctx.lineWidth = s * 0.028;
    ctx.lineCap = 'round';
    for (let row = 3; row >= 0; row--) {
      const locks = [];
      for (let i = 0; i < 9; i++) {
        const u = (i + (row % 2) * 0.5) / 8.5;
        const fx = -s * 0.7 + u * s * 1.35;
        const fy = -s * (2.02 - Math.sin(u * Math.PI) * 0.16) + (u > 0.75 ? (u - 0.75) * s * 1.6 : 0) + row * s * 0.36;
        const len = s * (0.4 + ((i * 7 + row * 3) % 4) * 0.05);
        locks.push([fx, fy, len, Math.sin(ph + i * 0.7 + row) * s * 0.04]);
      }
      const lockPath = (dx, dy) => {
        ctx.beginPath();
        for (const [fx, fy, len, sw] of locks) {
          ctx.moveTo(fx - w + dx, fy + dy);
          ctx.quadraticCurveTo(fx - w * 0.8 + dx, fy + len * 0.65 + dy, fx + sw + dx, fy + len + dy);
          ctx.quadraticCurveTo(fx + w * 0.9 + dx, fy + len * 0.5 + dy, fx + w + dx, fy + dy);
          ctx.closePath();
        }
      };
      lockPath(-s * 0.035, s * 0.05);
      ctx.fillStyle = 'rgba(12,22,40,0.32)';
      ctx.fill();
      lockPath(0, 0);
      ctx.fillStyle = fur;
      ctx.fill();
      ctx.strokeStyle = hiLine;
      ctx.beginPath();
      for (const [fx, fy, len, sw] of locks) {
        ctx.moveTo(fx + w * 0.55, fy + len * 0.12);
        ctx.quadraticCurveTo(fx + w * 0.6, fy + len * 0.55, fx + sw + w * 0.15, fy + len * 0.85);
      }
      ctx.stroke();
    }
    // 胸前颜色浅一点
    ctx.fillStyle = 'rgba(230,240,252,0.18)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.45, -s * 1.3, s * 0.25, s * 0.4, 0.2, 0, TAU);
    ctx.fill();
    ctx.restore();
    rimEdge(ctx, bodyPath, '#f2f8ff', 0.7, s * 0.07, s * 0.05, s * 0.05);
    // 肩上一枚发光的雪花纹（慢慢转、呼吸一样明暗）
    const pulse = 0.55 + Math.sin(t * 2.5 + sd) * 0.2;
    glow(ctx, s * 0.32, -s * 1.45, s * 0.35, '#8fe0ff', pulse * 0.6);
    snowflake(ctx, s * 0.32, -s * 1.45, s * 0.14, '#9fe8ff', pulse + 0.2, t * 0.4);
    // 背上长出的冰晶
    glow(ctx, s * 0.05, -s * 2.05, s * 0.45, '#9fe3ff', 0.4);
    crystal(ctx, -s * 0.12, -s * 2.04, s * 0.1, s * 0.2, -0.1, '#9fd8ff');
    crystal(ctx, s * 0.08, -s * 2.04, s * 0.13, s * 0.3, 0.2, '#9fd8ff');
    crystal(ctx, s * 0.3, -s * 1.9, s * 0.1, s * 0.2, 0.55, '#9fd8ff');
    // 近侧手臂：从身体中间垂到地面（离脸远一点，免得看起来像象鼻）；暗面、亮面和毛发笔触
    const ax = -s * 0.5 + step * s * 0.1;
    const armPath = (ox) => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.15 + ox, -s * 1.45);
      ctx.quadraticCurveTo(-s * 0.55 + ox, -s * 0.95, ax + ox, -s * 0.28);
    };
    ctx.lineCap = 'round';
    ctx.strokeStyle = deep(base, 0.45);
    ctx.lineWidth = s * 0.28;
    armPath(0);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(10,18,32,0.3)';
    ctx.lineWidth = s * 0.1;
    armPath(-s * 0.07);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(230,240,255,0.35)';
    ctx.lineWidth = s * 0.06;
    armPath(s * 0.08);
    ctx.stroke();
    strokes(ctx, -s * 0.42, -s * 0.9, s * 0.1, s * 0.45, 12, '#e8f2ff', 0.3, 13, 1.85, s * 0.12);
    // 胳膊肘下垂着的毛和两根小冰柱
    tuft([-s * 0.42, -s * 1.15], [-s * 0.5, -s * 1.0], [-s * 0.52, -s * 0.8], [0.3, 0.7], s * 0.12, s * 0.05, deep(base, 0.5));
    icicle(ctx, -s * 0.33, -s * 0.95, s * 0.06, s * 0.16, 0.85);
    icicle(ctx, -s * 0.28, -s * 0.85, s * 0.05, s * 0.11, 0.8);
    // 手：深色的手指 + 浅色的钝爪
    const fx0 = -s * 0.58 + step * s * 0.1;
    ctx.fillStyle = deep(base, 0.55);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      ctx.moveTo(fx0 + i * s * 0.08 + s * 0.06 * Math.cos(0.2), -s * 0.15 + s * 0.06 * Math.sin(0.2));
      ctx.ellipse(fx0 + i * s * 0.08, -s * 0.15, s * 0.06, s * 0.1, 0.2, 0, TAU);
    }
    ctx.fill();
    ctx.fillStyle = '#e6eef6';
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      ctx.moveTo(fx0 + i * s * 0.08 + s * 0.015, -s * 0.05);
      ctx.ellipse(fx0 + i * s * 0.08 - s * 0.015, -s * 0.05, s * 0.03, s * 0.025, 0, 0, TAU);
    }
    ctx.fill();
    // 头：在驼峰的前上方；一圈蓬毛、深色的脸、眉骨、蓝眼睛、带两颗小牙的嘴、两只有环纹的弯角
    const hx = -s * 0.68;
    const hy = -s * 1.88;
    ctx.fillStyle = deep(base, 0.3);
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.95 + i * 0.16);
      const r0 = s * 0.3;
      const sw = Math.sin(ph * 0.8 + i) * s * 0.02;
      ctx.moveTo(hx + Math.cos(a - 0.2) * r0, hy + Math.sin(a - 0.2) * r0);
      ctx.lineTo(hx + Math.cos(a) * s * 0.46 + sw, hy + Math.sin(a) * s * 0.42);
      ctx.lineTo(hx + Math.cos(a + 0.2) * r0, hy + Math.sin(a + 0.2) * r0);
      ctx.closePath();
    }
    ctx.fill();
    const headPath = () => {
      ctx.beginPath();
      ctx.ellipse(hx, hy, s * 0.36, s * 0.32, 0, 0, TAU);
    };
    headPath();
    ctx.fillStyle = radial(ctx, hx + s * 0.1, hy - s * 0.12, s * 0.05, s * 0.45, [[0, light(base, 0.25)], [0.5, deep(base, 0.15)], [1, deep(base, 0.6)]]);
    ctx.fill();
    // 头顶的细毛（区域收在头里面，不用裁剪）
    strokes(ctx, hx + s * 0.08, hy - s * 0.1, s * 0.2, s * 0.16, 14, '#14223a', 0.3, 25, 1.4, s * 0.12);
    rimEdge(ctx, headPath, '#f2f8ff', 0.7, s * 0.06, s * 0.04, s * 0.04);
    ctx.fillStyle = radial(ctx, hx - s * 0.12, hy + s * 0.04, s * 0.02, s * 0.24, [[0, '#3a4a62'], [1, '#141c2c']], hx - s * 0.05, hy - s * 0.06);
    ctx.beginPath();
    ctx.ellipse(hx - s * 0.12, hy + s * 0.04, s * 0.22, s * 0.2, 0, 0, TAU);
    ctx.fill();
    // 眉骨的一道亮边
    ctx.strokeStyle = 'rgba(220,232,248,0.55)';
    ctx.lineWidth = s * 0.035;
    ctx.beginPath();
    ctx.moveTo(hx - s * 0.3, hy - s * 0.08);
    ctx.quadraticCurveTo(hx - s * 0.16, hy - s * 0.16, hx - s * 0.0, hy - s * 0.1);
    ctx.stroke();
    eyes(ctx, hx - s * 0.16, hy - s * 0.02, s * 0.16, s * 0.045, '#7ad8ff', -0.1);
    // 鼻子
    ctx.fillStyle = '#0a0e18';
    ctx.beginPath();
    ctx.ellipse(hx - s * 0.2, hy + s * 0.06, s * 0.035, s * 0.025, 0, 0, TAU);
    ctx.fill();
    // 嘴：攻击时张大一点，上沿两颗圆圆的小门牙
    const mo = o.attack ? 0.06 + Math.max(0, Math.sin(t * 8)) * 0.03 : 0.04;
    ctx.fillStyle = '#0a0e18';
    ctx.beginPath();
    ctx.ellipse(hx - s * 0.16, hy + s * 0.15, s * 0.085, s * mo, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e8f0f8';
    for (const dx of [-0.19, -0.13]) {
      ctx.beginPath();
      ctx.ellipse(hx + s * dx, hy + s * (0.15 - mo * 0.55), s * 0.026, s * 0.03, 0, 0, TAU);
      ctx.fill();
    }
    // 弯角：由粗到细的几段，环纹
    for (const dx of [0.12, -0.2]) {
      const p0 = [hx + s * dx, hy - s * 0.26];
      const p1 = [hx + s * (dx + 0.02), hy - s * 0.48];
      const p2 = [hx + s * (dx + 0.16), hy - s * 0.46];
      const far = dx > 0;
      ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const a = qb(p0, p1, p2, i / 4);
        const b = qb(p0, p1, p2, (i + 1) / 4);
        ctx.strokeStyle = far ? deep('#d8e0e8', 0.35 - i * 0.05) : light('#b8c4d2', i * 0.22);
        ctx.lineWidth = s * (0.085 - i * 0.015);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(40,52,72,0.45)';
      ctx.lineWidth = s * 0.015;
      for (const u of [0.25, 0.5]) {
        const m = qb(p0, p1, p2, u);
        ctx.beginPath();
        ctx.moveTo(m[0] - s * 0.04, m[1] + s * 0.01);
        ctx.lineTo(m[0] + s * 0.035, m[1] - s * 0.01);
        ctx.stroke();
      }
    }
    // 呼出的白气 + 身边飘的雪沫
    const bk = (t * 0.9 + sd * 0.1) % 1;
    glow(ctx, hx - s * (0.32 + bk * 0.45), hy + s * (0.12 - bk * 0.1), s * (0.12 + bk * 0.2), '#e8f8ff', (1 - bk) * 0.45);
    sparkles(ctx, 0, -s * 1.2, s * 0.95, s * 0.8, 4, t, '#e8f8ff', 17, s * 0.04);
  };

  // 冰龙的翅膀：几根翼骨撑开半透明的冰膜，膜的下沿是一道道弧；fine 时膜上加冰纹、翼尖挂小光点（只给近侧那片）
  function dragonWing(ctx, x, y, len, ang, sq, col, a, fine) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(1, sq);
    ctx.globalAlpha *= a;
    const tips = [[len * 0.05, -len], [len * 0.45, -len * 0.84], [len * 0.76, -len * 0.5], [len * 0.62, -len * 0.12]];
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(tips[0][0], tips[0][1]);
    for (let i = 1; i < tips.length; i++) {
      const [ax, ay] = tips[i - 1];
      const [bx, by] = tips[i];
      ctx.quadraticCurveTo(((ax + bx) / 2) * 0.72, ((ay + by) / 2) * 0.72, bx, by);
    }
    ctx.quadraticCurveTo(len * 0.25, -len * 0.02, 0, 0);
    ctx.closePath();
    ctx.fillStyle = linear(ctx, 0, 0, len * 0.4, -len, [[0, rgba(col, 0.3)], [1, rgba(col, 0.62)]]);
    ctx.fill();
    // 膜上细细的冰纹
    if (fine) {
      ctx.save();
      ctx.clip();
      veins(ctx, len * 0.3, -len * 0.75, len * 0.25, 1.9, 1, '#e8fbff', 0.35, 3, len * 0.02);
      veins(ctx, len * 0.55, -len * 0.45, len * 0.2, 2.0, 1, '#e8fbff', 0.3, 4, len * 0.02);
      ctx.restore();
    }
    // 翼骨（前缘最粗最亮）
    ctx.lineCap = 'round';
    tips.slice(0, 3).forEach(([tx, ty], i) => {
      ctx.strokeStyle = rgba('#f0fbff', 0.9 - i * 0.15);
      ctx.lineWidth = len * (0.05 - i * 0.012);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(tx * 0.3 + len * 0.06, ty * 0.55, tx, ty);
      ctx.stroke();
    });
    if (fine) for (const [tx, ty] of tips.slice(0, 3)) dot(ctx, tx, ty, len * 0.03, '#e8fbff', 0.8);
    ctx.restore();
  }

  // 小冰龙：蛇一样弯曲、越来越细的身体（鳞片、浅色腹甲、脊背上一道流动的光），冰晶背刺和冰膜翅膀
  D.iceDragon = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    const ph = t * 6 + sd;
    ctx.save();
    ctx.globalAlpha = 0.5;
    shadow(ctx, 0, 34, s * 0.8);
    ctx.restore();
    ctx.translate(0, -s * 0.8);
    const base = '#5aa8e0';
    const N = 12;
    const pts = [];
    for (let i = 0; i <= N; i++) pts.push([-s * 0.65 + i * s * 0.17, Math.sin(ph - i * 0.45) * s * 0.18]);
    // 每一节的半宽和朝上的法线
    const half = [];
    const nor = [];
    for (let i = 0; i <= N; i++) {
      half.push(s * (0.5 - (i / (N + 1)) * 0.42) * 0.5);
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(N, i + 1)];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      nor.push([(b[1] - a[1]) / l, -(b[0] - a[0]) / l]);
    }
    const side = (i, f) => [pts[i][0] + nor[i][0] * half[i] * f, pts[i][1] + nor[i][1] * half[i] * f];
    // 平滑地连起一串点
    const smooth = (P) => {
      for (let i = 1; i < P.length - 1; i++) ctx.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2);
      ctx.lineTo(P[P.length - 1][0], P[P.length - 1][1]);
    };
    const upper = pts.map((p, i) => side(i, 1));
    const lower = pts.map((p, i) => side(i, -1)).reverse();
    const tip = [pts[N][0] + s * 0.12, pts[N][1]];
    const bodyPath = () => {
      ctx.beginPath();
      ctx.moveTo(upper[0][0], upper[0][1]);
      smooth(upper);
      ctx.lineTo(tip[0], tip[1]);
      ctx.lineTo(lower[0][0], lower[0][1]);
      smooth(lower);
      ctx.closePath();
    };
    const flap = Math.sin(t * 9);
    // 远侧的翅膀（暗、小）
    dragonWing(ctx, s * 0.0, pts[4][1] - s * 0.12, s * 0.85, 0.25 + flap * 0.35, 0.75 + flap * 0.25, '#7fb8e0', 0.6);
    // 背上的冰刺（先画，身体盖住根部）
    for (let i = 1; i < 7; i++) {
      const [px, py] = side(i, 0.75);
      const ang = Math.atan2(nor[i][0], -nor[i][1]) + 0.35;
      crystal(ctx, px, py, s * (0.11 - i * 0.006), s * (0.22 - i * 0.015), ang, '#9fd8ff', 0.95);
    }
    // 尾尖的冰晶鳍
    const tn = Math.atan2(pts[N][1] - pts[N - 1][1], pts[N][0] - pts[N - 1][0]);
    glow(ctx, tip[0], tip[1], s * 0.3, '#9fe3ff', 0.5);
    crystal(ctx, tip[0] - s * 0.04, tip[1], s * 0.12, s * 0.26, tn + Math.PI / 2 - 0.5, '#bfeaff');
    crystal(ctx, tip[0] - s * 0.04, tip[1], s * 0.1, s * 0.2, tn + Math.PI / 2 + 0.35, '#9fd8ff');
    // 身体：头端亮、尾端深
    bodyPath();
    ctx.fillStyle = linear(ctx, -s * 0.7, 0, s * 1.5, 0, [[0, deep(base, 0.2)], [1, deep(base, 0.62)]]);
    ctx.fill();
    ctx.save();
    bodyPath();
    ctx.clip();
    scales(ctx, -s * 0.7, -s * 0.42, s * 1.55, s * 0.32, s * 0.11, '#cfeeff', 0.2);
    // 背上一道亮面、腹下一条浅色腹甲（一节节的）：各是一条跟着身体弯的窄带
    const band = (f0, f1) => {
      const a = pts.map((p, i) => side(i, f0));
      const b = pts.map((p, i) => side(i, f1)).reverse();
      ctx.beginPath();
      ctx.moveTo(a[0][0], a[0][1]);
      smooth(a);
      ctx.lineTo(b[0][0], b[0][1]);
      smooth(b);
      ctx.closePath();
    };
    band(0.3, 0.75);
    ctx.fillStyle = 'rgba(200,238,255,0.14)';
    ctx.fill();
    band(-0.3, -0.95);
    ctx.fillStyle = 'rgba(196,230,252,0.38)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,90,150,0.45)';
    ctx.lineWidth = Math.max(0.6, s * 0.018);
    ctx.beginPath();
    for (let i = 1; i < N; i++) {
      const a = side(i, -0.95);
      const b = side(i, -0.3);
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();
    ctx.restore();
    rimEdge(ctx, bodyPath, '#e6f8ff', 0.45, s * 0.045, s * 0.02, s * 0.035);
    // 脊背上一道发光的霜线，一团光顺着它往尾巴流
    rune(ctx, pts.slice(0, 11).map((p, i) => side(i, 0.3)), '#7fd8ff', Math.max(0.8, s * 0.03), 0.5);
    const fk = ((t * 0.8 + sd * 0.1) % 1) * (N - 1);
    const fi = Math.floor(fk);
    const fa = side(fi, 0.3);
    const fb = side(fi + 1, 0.3);
    glow(ctx, fa[0] + (fb[0] - fa[0]) * (fk - fi), fa[1] + (fb[1] - fa[1]) * (fk - fi), s * 0.2, '#dffaff', 0.7);
    // 近侧的翅膀
    dragonWing(ctx, -s * 0.15, pts[3][1] - s * 0.1, s * 1.15, -0.05 + flap * 0.4, 0.7 + flap * 0.3, '#bfefff', 0.95, true);
    // 头：长吻、下颌线、眉骨、两只往后掠的冰晶角、腮边的小冰刺
    const hy = pts[0][1];
    crystal(ctx, -s * 0.6, hy - s * 0.17, s * 0.07, s * 0.28, 1.05, '#8fc8ee');
    crystal(ctx, -s * 0.58, hy + s * 0.06, s * 0.07, s * 0.18, 2.0, '#9fd8ff');
    const headPath = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.55, hy - s * 0.2);
      ctx.quadraticCurveTo(-s * 0.78, hy - s * 0.3, -s * 0.98, hy - s * 0.17);
      ctx.quadraticCurveTo(-s * 1.12, hy - s * 0.12, -s * 1.2, hy - s * 0.07);
      ctx.quadraticCurveTo(-s * 1.26, hy - s * 0.01, -s * 1.19, hy + s * 0.04);
      ctx.lineTo(-s * 0.95, hy + s * 0.09);
      ctx.quadraticCurveTo(-s * 0.78, hy + s * 0.2, -s * 0.6, hy + s * 0.16);
      ctx.quadraticCurveTo(-s * 0.48, hy, -s * 0.55, hy - s * 0.2);
      ctx.closePath();
    };
    headPath();
    ctx.fillStyle = radial(ctx, -s * 0.8, hy - s * 0.12, s * 0.02, s * 0.42, [[0, light(base, 0.15)], [0.5, deep(base, 0.2)], [1, deep(base, 0.6)]], -s * 0.72, hy - s * 0.2);
    ctx.fill();
    ctx.save();
    headPath();
    ctx.clip();
    scales(ctx, -s * 0.9, hy - s * 0.3, -s * 0.5, hy + s * 0.2, s * 0.08, '#e8f8ff', 0.22);
    ctx.fillStyle = 'rgba(214,240,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.9, hy + s * 0.1, s * 0.28, s * 0.05, -0.12, 0, TAU);
    ctx.fill();
    ctx.restore();
    rimEdge(ctx, headPath, '#e6f8ff', 0.7, s * 0.05, 0, s * 0.045);
    ctx.strokeStyle = 'rgba(20,40,80,0.55)';
    ctx.lineWidth = Math.max(0.6, s * 0.02);
    ctx.beginPath();
    ctx.moveTo(-s * 1.17, hy + s * 0.02);
    ctx.quadraticCurveTo(-s * 0.95, hy + s * 0.05, -s * 0.78, hy + s * 0.02);
    ctx.stroke();
    // 冰晶角（近侧亮）
    ctx.strokeStyle = '#e8f8ff';
    ctx.lineWidth = s * 0.06;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.72, hy - s * 0.18);
    ctx.quadraticCurveTo(-s * 0.6, hy - s * 0.35, -s * 0.42, hy - s * 0.42);
    ctx.stroke();
    ctx.strokeStyle = '#9fd0f0';
    ctx.lineWidth = s * 0.025;
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, hy - s * 0.2);
    ctx.quadraticCurveTo(-s * 0.6, hy - s * 0.31, -s * 0.46, hy - s * 0.38);
    ctx.stroke();
    dot(ctx, -s * 0.42, hy - s * 0.42, s * 0.025, '#e8ffff', 0.8);
    // 眉骨 + 鼻孔的一点冷光 + 眼睛
    ctx.strokeStyle = 'rgba(230,248,255,0.6)';
    ctx.lineWidth = s * 0.03;
    ctx.beginPath();
    ctx.moveTo(-s * 1.04, hy - s * 0.15);
    ctx.quadraticCurveTo(-s * 0.95, hy - s * 0.2, -s * 0.86, hy - s * 0.16);
    ctx.stroke();
    dot(ctx, -s * 1.18, hy - s * 0.04, s * 0.02, '#bff4ff', 0.8);
    eyes(ctx, -s * 0.95, hy - s * 0.08, 0.01, s * 0.06, '#e8ffff', -0.2);
    // 寒气：攻击时从嘴里喷出一串冷雾，平时鼻孔偶尔冒一点
    const nb = o.attack ? 4 : 1;
    for (let i = 0; i < nb; i++) {
      const k = (t * (o.attack ? 2.5 : 0.8) + i / nb + sd * 0.1) % 1;
      glow(ctx, -s * (1.25 + k * (o.attack ? 0.6 : 0.25)), hy + Math.sin(k * 6 + i) * s * 0.05, s * (0.06 + k * 0.16), '#dff8ff', (1 - k) * (o.attack ? 0.6 : 0.35));
    }
    // 尾巴后面飘散的冰尘
    for (let i = 0; i < 2; i++) {
      const k = (t * 1.2 + i / 2 + sd * 0.07) % 1;
      dot(ctx, tip[0] + k * s * 0.6, tip[1] + Math.sin(k * 5 + i * 2) * s * 0.12, s * 0.04, '#dff8ff', (1 - k) * 0.7);
    }
  };

  // 冰棍大叔的一块冰：有棱面（上面、右面受光、左下深）、里面的冰裂纹透出蓝光、细碎的霜点和折光
  function iceBlock(ctx, s, x, y, w, h, k, seed) {
    const P = [
      [x + w * 0.1, y],
      [x + w * 0.9, y + h * 0.04],
      [x + w, y + h * 0.9],
      [x + w * 0.05, y + h],
    ];
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(P[0][0], P[0][1]);
      for (let i = 1; i < 4; i++) ctx.lineTo(P[i][0], P[i][1]);
      ctx.closePath();
    };
    path();
    ctx.fillStyle = linear(ctx, x + w, y, x, y + h, [[0, 'rgba(228,248,255,0.96)'], [0.45, `rgba(110,170,225,${0.93 - k * 0.08})`], [1, 'rgba(22,44,92,0.97)']]);
    ctx.fill();
    ctx.save();
    path();
    ctx.clip();
    // 棱面：顶面一条亮、右面一条半亮、左下一条暗（像有厚度的冰砖）
    const bv = Math.min(w, h) * 0.13;
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.beginPath();
    ctx.moveTo(P[0][0], P[0][1]);
    ctx.lineTo(P[1][0], P[1][1]);
    ctx.lineTo(P[1][0] - bv, P[1][1] + bv);
    ctx.lineTo(P[0][0] + bv * 0.5, P[0][1] + bv);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(200,236,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(P[1][0], P[1][1]);
    ctx.lineTo(P[2][0], P[2][1]);
    ctx.lineTo(P[2][0] - bv, P[2][1] - bv * 0.5);
    ctx.lineTo(P[1][0] - bv, P[1][1] + bv);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(8,20,52,0.32)';
    ctx.beginPath();
    ctx.moveTo(P[2][0], P[2][1]);
    ctx.lineTo(P[3][0], P[3][1]);
    ctx.lineTo(P[0][0], P[0][1]);
    ctx.lineTo(P[0][0] + bv * 0.5, P[0][1] + bv);
    ctx.lineTo(P[3][0] + bv, P[3][1] - bv);
    ctx.lineTo(P[2][0] - bv, P[2][1] - bv * 0.5);
    ctx.closePath();
    ctx.fill();
    if (k > 1) {
      ctx.fillStyle = 'rgba(8,20,52,0.35)';
      ctx.fillRect(x, y, w, h);
    }
    // 冰裂纹、霜点、两道斜斜的折光
    const r = seeded(seed);
    veins(ctx, x + w * (0.3 + r() * 0.4), y + h * 0.15, Math.min(w, h) * 0.38, 1.6 + r() * 0.5, 2, '#9fe3ff', 0.55, seed, s * 0.025);
    speckle(ctx, x + w * 0.55, y + h * 0.45, w * 0.45, h * 0.45, 7, '#ffffff', 0.55, seed + 3, s * 0.01, s * 0.022);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = Math.max(0.8, s * 0.02);
    ctx.beginPath();
    for (const f of [0.35, 0.55]) {
      ctx.moveTo(x + w * (f + 0.35), y + h * 0.1);
      ctx.lineTo(x + w * (f - 0.2), y + h * 0.75);
    }
    ctx.stroke();
    ctx.restore();
    rimEdge(ctx, path, '#f0fbff', 0.75, s * 0.045, s * 0.03, s * 0.03);
    rimEdge(ctx, path, '#081430', 0.4, s * 0.04, -s * 0.025, -s * 0.025);
  }

  // 一团积雪：几个叠在一起的小雪包，上白下浅蓝
  function snowCap(ctx, s, x0, x1, y, h) {
    ctx.fillStyle = linear(ctx, 0, y - h, 0, y + h * 0.6, [[0, '#ffffff'], [0.6, '#dbe9f6'], [1, '#9fb8d6']]);
    const n = 4;
    for (let i = 0; i < n; i++) {
      const cx = x0 + ((i + 0.5) / n) * (x1 - x0);
      ctx.beginPath();
      ctx.ellipse(cx, y - h * (0.3 + (i % 2) * 0.15), ((x1 - x0) / n) * 0.75, h * 0.7, 0, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = Math.max(0.8, s * 0.025);
    ctx.beginPath();
    ctx.moveTo(x0 + (x1 - x0) * 0.4, y - h * 0.95);
    ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.7, y - h * 1.05, x1 - (x1 - x0) * 0.08, y - h * 0.7);
    ctx.stroke();
  }

  // 冰棍大叔：冰块堆成的大个子（友善的巨人）。头顶、肩上有积雪，冰柱胡子，胸口一颗跳动的冰晶心，手里一根草莓冰棍
  D.iceGiant = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    const step = Math.sin(t * 3 + sd);
    shadow(ctx, 0, 2, s * 1.2);
    // 快要冻住技能槽时，冰晶心和眼睛更亮
    const charge = o.ai && o.ai.freezeTimer !== undefined ? Math.max(0, 1 - o.ai.freezeTimer / 1.5) : 0;
    // 远侧的手臂（暗）
    iceBlock(ctx, s, s * 0.52, -s * 1.7, s * 0.32, s * 0.9, 2, 7);
    // 腿
    iceBlock(ctx, s, -s * 0.55 + step * 3, -s * 0.6, s * 0.4, s * 0.6, 1, 11);
    iceBlock(ctx, s, s * 0.15 - step * 3, -s * 0.6, s * 0.4, s * 0.6, 1, 12);
    // 身体
    iceBlock(ctx, s, -s * 0.75, -s * 1.85, s * 1.5, s * 1.3, 0, 13);
    // 身体下沿垂着的冰柱
    for (const [ix, ih] of [[-0.5, 0.14], [-0.38, 0.09], [0.4, 0.12], [0.52, 0.08]]) icicle(ctx, s * ix, -s * 0.58 - s * ix * 0.03, s * 0.07, s * ih, 0.85);
    // 胸口的冰晶心：一跳一跳地亮，四周的冰裂纹跟着亮
    const beat = Math.pow(Math.max(0, Math.sin(t * 3.2 + sd)), 6);
    const ca = 0.45 + beat * 0.35 + charge * 0.4;
    veins(ctx, s * 0.05, -s * 1.25, s * 0.3, -0.6, 2, '#9fe3ff', ca * 0.8, 31, s * 0.03);
    veins(ctx, -s * 0.05, -s * 1.15, s * 0.28, 2.6, 2, '#9fe3ff', ca * 0.7, 32, s * 0.03);
    glow(ctx, 0, -s * 1.2, s * (0.45 + beat * 0.12 + charge * 0.2), '#9fe3ff', ca, true);
    // 一颗心形的冰晶：跳的时候鼓一下，右上一点高光
    const hh = s * 0.15 * (1 + beat * 0.15);
    const hy = -s * 1.2;
    ctx.fillStyle = radial(ctx, 0, hy, hh * 0.1, hh * 1.3, [[0, '#ffffff'], [0.4, '#a8ecff'], [1, '#2f78c0']], hh * 0.35, hy - hh * 0.35);
    ctx.beginPath();
    ctx.moveTo(0, hy + hh * 0.9);
    ctx.bezierCurveTo(-hh * 1.35, hy + hh * 0.05, -hh * 0.75, hy - hh * 0.95, 0, hy - hh * 0.35);
    ctx.bezierCurveTo(hh * 0.75, hy - hh * 0.95, hh * 1.35, hy + hh * 0.05, 0, hy + hh * 0.9);
    ctx.fill();
    dot(ctx, hh * 0.45, hy - hh * 0.35, hh * 0.14, '#ffffff', 0.9);
    // 肩上的冰晶
    glow(ctx, s * 0.5, -s * 1.95, s * 0.4, '#9fe3ff', 0.35);
    crystal(ctx, s * 0.38, -s * 1.86, s * 0.12, s * 0.24, 0.15, '#bfeaff');
    crystal(ctx, s * 0.58, -s * 1.82, s * 0.14, s * 0.34, 0.45, '#bfeaff');
    // 前面的手臂 + 胳膊下的冰柱
    iceBlock(ctx, s, -s * 1.15, -s * 1.75, s * 0.4, s * 1.0, 1, 14);
    icicle(ctx, -s * 0.85, -s * 0.78, s * 0.06, s * 0.12, 0.85);
    crystal(ctx, -s * 1.0, -s * 1.74, s * 0.1, s * 0.2, -0.35, '#bfeaff');
    // 手里的草莓冰棍（小小的，镇上卖的那种）
    ctx.save();
    ctx.translate(-s * 1.05, -s * 0.84);
    ctx.rotate(-0.3 + Math.sin(t * 2 + sd) * 0.06);
    ctx.fillStyle = '#c9a26a';
    ctx.fillRect(-s * 0.025, -s * 0.2, s * 0.05, s * 0.22);
    ctx.fillStyle = linear(ctx, s * 0.08, -s * 0.48, -s * 0.08, -s * 0.18, [[0, '#ffc2da'], [1, '#e2507e']]);
    ctx.beginPath();
    ctx.moveTo(-s * 0.08, -s * 0.18);
    ctx.lineTo(-s * 0.08, -s * 0.4);
    ctx.quadraticCurveTo(0, -s * 0.5, s * 0.08, -s * 0.4);
    ctx.lineTo(s * 0.08, -s * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(s * 0.02, -s * 0.38, s * 0.025, s * 0.15);
    ctx.restore();
    // 头
    iceBlock(ctx, s, -s * 0.55, -s * 2.55, s * 0.9, s * 0.75, 0, 15);
    // 头顶和肩上的积雪
    snowCap(ctx, s, -s * 0.52, s * 0.32, -s * 2.52, s * 0.1);
    snowCap(ctx, s, -s * 0.72, -s * 0.2, -s * 1.83, s * 0.07);
    // 眉下一道深色的凹槽，眼睛在里面发光
    ctx.fillStyle = 'rgba(8,20,52,0.55)';
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, -s * 2.24);
    ctx.quadraticCurveTo(-s * 0.25, -s * 2.3, s * 0.02, -s * 2.24);
    ctx.lineTo(s * 0.0, -s * 2.07);
    ctx.quadraticCurveTo(-s * 0.25, -s * 2.02, -s * 0.48, -s * 2.07);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(240,252,255,0.7)';
    ctx.lineWidth = s * 0.03;
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, -s * 2.26);
    ctx.quadraticCurveTo(-s * 0.25, -s * 2.32, s * 0.02, -s * 2.26);
    ctx.stroke();
    eyes(ctx, -s * 0.25, -s * 2.15, s * 0.28, s * 0.07, '#e0ffff', 0);
    if (charge > 0) glow(ctx, -s * 0.25, -s * 2.15, s * 0.4, '#9fe3ff', charge * 0.6);
    // 冰柱胡子
    for (let i = 0; i < 5; i++) {
      const ix = -s * (0.48 - i * 0.11);
      const ih = s * (0.14 + (2 - Math.abs(i - 2)) * 0.07);
      icicle(ctx, ix, -s * 1.86, s * 0.1, ih, 0.92);
    }
    // 呼出的寒气，里面夹着几片雪花
    const bt = (t * 0.8) % 1;
    glow(ctx, -s * 0.8 - bt * s * 0.6, -s * 2.0, s * (0.2 + bt * 0.3), '#dff6ff', (1 - bt) * 0.5);
    for (let i = 0; i < 2; i++) dot(ctx, -s * (0.85 + bt * 0.7 + i * 0.12), -s * (2.0 + (i - 0.5) * 0.15) - bt * s * 0.1, s * 0.03, '#ffffff', (1 - bt) * 0.8);
    sparkles(ctx, -s * 0.2, -s * 1.4, s * 1.1, s * 1.0, 6, t, '#dff6ff', 41, s * 0.035);
  };

  // 霜霜女王：修长的身形、拖地的两层冰纱长裙、高高的冰晶立领、冰晶王冠和雪花权杖
  D.frostQueen = function (ctx, s, t, o) {
    const sd = o.seed || 0;
    const sway = Math.sin(t * 2 + sd) * 0.04;
    const phase = (o.ai && o.ai.phase) || 1;
    // 每个阶段换一种光：冰蓝 → 淡紫 → 亮白
    const gem = phase >= 3 ? '#f0fbff' : phase === 2 ? '#c8b8ff' : '#9fe3ff';
    shadow(ctx, 0, 2, s * 1.1);
    ctx.save();
    ctx.rotate(sway);
    const hem = Math.sin(t * 3) * s * 0.1;
    const hem2 = Math.sin(t * 3 - 0.8) * s * 0.12;
    // 身后高高的冰晶立领（扇形）
    glow(ctx, s * 0.05, -s * 2.15, s * 0.7, gem, 0.35);
    for (let i = -2; i <= 2; i++) crystal(ctx, s * (0.04 + i * 0.03), -s * 1.98, s * 0.14, s * (0.5 - Math.abs(i) * 0.07), i * 0.42, '#bfe6ff', 0.75);
    // 底层的深色纱：比外裙长一点，往后飘得更远
    ctx.fillStyle = 'rgba(24,40,96,0.75)';
    ctx.beginPath();
    ctx.moveTo(-s * 0.16, -s * 1.9);
    ctx.quadraticCurveTo(-s * 0.36, -s * 1.0, -s * 0.7, s * 0.02);
    ctx.quadraticCurveTo(s * 0.4, s * 0.06, s * 1.3 + hem2, s * 0.0);
    ctx.quadraticCurveTo(s * 0.6, -s * 0.5, s * 0.22, -s * 1.9);
    ctx.closePath();
    ctx.fill();
    // 外裙：下摆往后飘
    const gownPath = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.18, -s * 1.95);
      ctx.quadraticCurveTo(-s * 0.4, -s * 1.0, -s * 0.75, 0);
      ctx.quadraticCurveTo(s * 0.3, s * 0.05, s * 1.2 + hem, -s * 0.05);
      ctx.quadraticCurveTo(s * 0.5, -s * 0.6, s * 0.22, -s * 1.95);
      ctx.closePath();
    };
    gownPath();
    ctx.fillStyle = linear(ctx, s * 0.5, -s * 2.0, -s * 0.5, 0, [[0, 'rgba(232,248,255,0.95)'], [0.4, 'rgba(140,186,236,0.88)'], [0.75, 'rgba(62,96,170,0.86)'], [1, 'rgba(30,46,110,0.9)']]);
    ctx.fill();
    ctx.save();
    gownPath();
    ctx.clip();
    // 裙褶：深浅相间的长弧线，随下摆摆动
    for (let i = 0; i < 6; i++) {
      const u = i / 5;
      const x0 = -s * 0.1 + u * s * 0.25;
      const x1 = -s * 0.6 + u * s * 1.7 + hem * u;
      ctx.strokeStyle = 'rgba(14,26,70,0.28)';
      ctx.lineWidth = s * 0.05;
      ctx.beginPath();
      ctx.moveTo(x0, -s * 1.5);
      ctx.quadraticCurveTo(x0 + (x1 - x0) * 0.3, -s * 0.6, x1, s * 0.05);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(235,248,255,0.3)';
      ctx.lineWidth = s * 0.025;
      ctx.beginPath();
      ctx.moveTo(x0 + s * 0.05, -s * 1.5);
      ctx.quadraticCurveTo(x0 + s * 0.05 + (x1 - x0) * 0.3, -s * 0.6, x1 + s * 0.08, s * 0.05);
      ctx.stroke();
    }
    // 裙上从下摆长上来的发光冰花纹
    veins(ctx, -s * 0.35, s * 0.0, s * 0.42, -1.75, 2, '#e0f8ff', 0.5, 51, s * 0.025);
    veins(ctx, s * 0.25, s * 0.02, s * 0.38, -1.95, 2, '#e0f8ff', 0.45, 52, s * 0.025);
    veins(ctx, s * 0.75, -s * 0.02, s * 0.3, -2.3, 1, '#e0f8ff', 0.4, 53, s * 0.022);
    speckle(ctx, s * 0.1, -s * 0.6, s * 0.6, s * 0.5, 9, '#ffffff', 0.8, 54, s * 0.008, s * 0.018, 0.25);
    // 胸衣：深色的 V 形，金属亮边
    ctx.fillStyle = 'rgba(20,34,84,0.9)';
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, -s * 1.96);
    ctx.lineTo(s * 0.24, -s * 1.96);
    ctx.quadraticCurveTo(s * 0.16, -s * 1.6, s * 0.03, -s * 1.38);
    ctx.quadraticCurveTo(-s * 0.12, -s * 1.6, -s * 0.2, -s * 1.96);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,240,255,0.7)';
    ctx.lineWidth = s * 0.02;
    ctx.stroke();
    ctx.restore();
    rimEdge(ctx, gownPath, '#f4fcff', 0.7, s * 0.05, s * 0.035, s * 0.035);
    // 下摆的一圈冰晶花边
    for (let i = 0; i < 7; i++) {
      const u = 0.06 + i * 0.135;
      const p = qb([-s * 0.75, 0], [s * 0.3, s * 0.05], [s * 1.2 + hem, -s * 0.05], u);
      crystal(ctx, p[0], p[1] + s * 0.01, s * 0.07, s * (0.1 + (i % 2) * 0.05), 0, '#d8f2ff', 0.85);
    }
    // 胸前的冰晶胸针
    glow(ctx, s * 0.02, -s * 1.62, s * 0.22, gem, 0.7);
    crystal(ctx, s * 0.02, -s * 1.55, s * 0.08, s * 0.14, 0, gem);
    // 脖子和脸：脸颊右上受光
    ctx.fillStyle = 'rgba(170,200,236,0.95)';
    ctx.fillRect(-s * 0.05, -s * 2.02, s * 0.1, s * 0.1);
    ctx.fillStyle = radial(ctx, -s * 0.02, -s * 2.2, s * 0.02, s * 0.28, [[0, '#eef7ff'], [0.6, '#c4dcf6'], [1, '#8eaed6']], s * 0.05, -s * 2.3);
    ctx.beginPath();
    ctx.ellipse(-s * 0.02, -s * 2.2, s * 0.2, s * 0.26, 0, 0, TAU);
    ctx.fill();
    // 眼窝一点阴影（白脸上的发光眼也看得清），淡淡的腮红和微笑
    ctx.fillStyle = 'rgba(40,64,120,0.4)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.07, -s * 2.22, s * 0.13, s * 0.045, -0.05, 0, TAU);
    ctx.fill();
    eyes(ctx, -s * 0.07, -s * 2.22, s * 0.13, s * 0.04, '#5ad0ff', -0.05);
    ctx.fillStyle = 'rgba(200,170,230,0.35)';
    ctx.beginPath();
    ctx.ellipse(-s * 0.15, -s * 2.12, s * 0.04, s * 0.025, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,110,170,0.7)';
    ctx.lineWidth = s * 0.016;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.145, -s * 2.08);
    ctx.quadraticCurveTo(-s * 0.1, -s * 2.05, -s * 0.055, -s * 2.08);
    ctx.stroke();
    // 长发往后飘：深色的底层 + 浅色的发丝 + 发梢的光点
    const hw = Math.sin(t * 2.5 + sd) * s * 0.08;
    ctx.fillStyle = 'rgba(70,100,160,0.7)';
    ctx.beginPath();
    ctx.moveTo(s * 0.1, -s * 2.4);
    ctx.quadraticCurveTo(s * 0.8, -s * 2.15 + hw, s * 1.05, -s * 1.38 + hw);
    ctx.quadraticCurveTo(s * 0.55, -s * 1.7, s * 0.15, -s * 1.95);
    ctx.fill();
    const hairPath = () => {
      ctx.beginPath();
      ctx.moveTo(-s * 0.2, -s * 2.3);
      ctx.quadraticCurveTo(-s * 0.05, -s * 2.5, s * 0.15, -s * 2.38);
      ctx.quadraticCurveTo(s * 0.7, -s * 2.2 + hem, s * 0.95, -s * 1.5);
      ctx.quadraticCurveTo(s * 0.5, -s * 1.8, s * 0.15, -s * 2.0);
      ctx.quadraticCurveTo(s * 0.12, -s * 2.25, -s * 0.05, -s * 2.36);
      ctx.quadraticCurveTo(-s * 0.15, -s * 2.34, -s * 0.2, -s * 2.3);
      ctx.closePath();
    };
    hairPath();
    ctx.fillStyle = linear(ctx, s * 0.6, -s * 2.4, s * 0.2, -s * 1.6, [[0, 'rgba(240,250,255,0.92)'], [1, 'rgba(150,190,236,0.85)']]);
    ctx.fill();
    ctx.save();
    hairPath();
    ctx.clip();
    ctx.strokeStyle = 'rgba(90,130,200,0.45)';
    ctx.lineWidth = s * 0.015;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const k = i / 4;
      ctx.moveTo(s * (0.05 + k * 0.1), -s * (2.38 - k * 0.12));
      ctx.quadraticCurveTo(s * (0.6 - k * 0.1), -s * (2.15 - k * 0.12) + hem, s * (0.95 - k * 0.2), -s * (1.5 + k * 0.12) + hem * 0.5);
    }
    ctx.stroke();
    ctx.restore();
    rimEdge(ctx, hairPath, '#ffffff', 0.7, s * 0.04, s * 0.03, s * 0.03);
    sparkles(ctx, s * 0.9, -s * 1.55 + hem, s * 0.15, s * 0.12, 3, t, '#e8f8ff', 55, s * 0.03);
    // 冰晶王冠：银色的冠圈 + 有棱面的冰尖 + 中间一颗随阶段变色的宝石
    glow(ctx, 0, -s * 2.6, s * 0.5, '#bfefff', 0.6);
    for (let i = -2; i <= 2; i++) {
      const h = s * (0.25 + (2 - Math.abs(i)) * 0.12);
      crystal(ctx, i * s * 0.1, -s * 2.4, s * 0.1, h, i * 0.08, '#d8f4ff');
    }
    ctx.strokeStyle = linear(ctx, -s * 0.22, 0, s * 0.22, 0, [[0, '#7f97b8'], [0.6, '#f4faff'], [1, '#a8bcd8']]);
    ctx.lineWidth = s * 0.05;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-s * 0.22, -s * 2.38);
    ctx.quadraticCurveTo(0, -s * 2.44, s * 0.22, -s * 2.38);
    ctx.stroke();
    glow(ctx, 0, -s * 2.47, s * 0.18, gem, 0.8);
    dot(ctx, 0, -s * 2.47, s * 0.035, gem, 1);
    for (let i = 0; i < 2; i++) {
      const tw = Math.max(0, Math.sin(t * 3 + i * 2.5 + sd));
      if (tw > 0.2) twinkle(ctx, (i ? 1 : -1) * s * 0.1, -s * (2.75 - i * 0.05), s * 0.07 * tw, '#ffffff', tw);
    }
    ctx.restore();
    // 握着权杖的手臂（肩膀跟着身体摆，手握在杖上）
    const shx = -s * 0.12;
    const shy = -s * 1.86;
    const cs = Math.cos(sway);
    const sn = Math.sin(sway);
    const sx = shx * cs - shy * sn;
    const sy = shx * sn + shy * cs;
    const handX = -s * 0.665;
    const handY = -s * 1.35;
    ctx.strokeStyle = 'rgba(176,206,240,0.95)';
    ctx.lineWidth = s * 0.06;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(-s * 0.32, -s * 1.42, handX, handY);
    ctx.stroke();
    // 冰纱袖子从手臂上垂下来
    const sl = Math.sin(t * 3 + sd + 1) * s * 0.04;
    ctx.fillStyle = 'rgba(190,226,255,0.5)';
    ctx.beginPath();
    ctx.moveTo(sx + s * 0.04, sy + s * 0.04);
    ctx.quadraticCurveTo(-s * 0.3, -s * 1.38, -s * 0.5, -s * 1.38);
    ctx.quadraticCurveTo(-s * 0.4 + sl, -s * 1.1, -s * 0.2 + sl, -s * 1.02);
    ctx.quadraticCurveTo(-s * 0.15, -s * 1.4, sx + s * 0.04, sy + s * 0.04);
    ctx.fill();
    // 权杖：金属感的杖身 + 一圈圈缠绕的银线 + 杖头慢慢转的雪花和一颗光球
    ctx.strokeStyle = linear(ctx, -s * 0.68, 0, -s * 0.6, 0, [[0, '#6f88b0'], [0.5, '#f0f8ff'], [1, '#8ea6cc']]);
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.moveTo(-s * 0.6, -s * 0.1);
    ctx.lineTo(-s * 0.7, -s * 2.2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(30,50,100,0.6)';
    ctx.lineWidth = s * 0.015;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const y = -s * (0.4 + i * 0.28);
      const x = -s * 0.6 + (y + s * 0.1) * (0.1 / 2.1);
      ctx.moveTo(x - s * 0.03, y + s * 0.02);
      ctx.lineTo(x + s * 0.03, y - s * 0.02);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(200,226,250,0.98)';
    ctx.beginPath();
    ctx.ellipse(handX, handY, s * 0.05, s * 0.04, 0, 0, TAU);
    ctx.fill();
    glow(ctx, -s * 0.7, -s * 2.35, s * 0.5, gem, 0.85, true);
    snowflake(ctx, -s * 0.7, -s * 2.35, s * 0.22, '#e8f8ff', 0.85, t * 0.6);
    dot(ctx, -s * 0.7, -s * 2.35, s * 0.06, gem, 1);
    // 杖头周围绕着转的小冰晶
    for (let i = 0; i < 3; i++) {
      const q = t * 1.8 + i * 2.09;
      dot(ctx, -s * 0.7 + Math.cos(q) * s * 0.36, -s * 2.35 + Math.sin(q) * s * 0.14, s * 0.03, '#e8f8ff', 0.5 + 0.4 * Math.sin(q));
    }
    // 身边飘落的雪花光点
    sparkles(ctx, s * 0.1, -s * 1.1, s * 1.1, s * 0.9, 6, t, '#e8f8ff', 57, s * 0.035);
  };
})((globalThis.TD = globalThis.TD || {}));
