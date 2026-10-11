// 第三章 · 迷雾沼泽（设计书 56.4）的怪物画法：工具函数（发光、眼睛、符文、胶质、四足……）在 creatures.js
(function (TD) {
  'use strict';

  const K = TD.creatures;
  const D = K.drawers;
  const TAU = Math.PI * 2;
  const { deep, light, rgba, bodyGrad, glow, shadow, eyes, rune, dot, wing, jelly, jellyEyes, quadruped } = K;

  // ======================================================================
  // 第三章 · 迷雾沼泽（设计书 56.4）
  // ======================================================================

  // 小幽灵：半透明的光雾，尾巴渐隐
  D.ghost = function (ctx, s, t, o) {
    const ph = t * 3 + (o.seed || 0);
    const fl = Math.sin(ph) * s * 0.12;
    ctx.save();
    ctx.translate(0, -s * 1.0 + fl);
    const g = ctx.createRadialGradient(-s * 0.1, -s * 0.2, s * 0.1, 0, 0, s * 1.1);
    g.addColorStop(0, 'rgba(235,245,255,0.95)');
    g.addColorStop(0.5, 'rgba(160,200,255,0.55)');
    g.addColorStop(1, 'rgba(120,150,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, -s * 0.1);
    ctx.bezierCurveTo(-s * 0.6, -s * 0.85, s * 0.45, -s * 0.9, s * 0.5, -s * 0.15);
    // 往后飘的尾巴
    const tw = Math.sin(ph * 1.6) * s * 0.15;
    ctx.bezierCurveTo(s * 0.6, s * 0.3, s * 1.0, s * 0.35 + tw, s * 1.35, s * 0.2 - tw);
    ctx.bezierCurveTo(s * 0.9, s * 0.65 + tw, s * 0.2, s * 0.6, -s * 0.55, -s * 0.1);
    ctx.fill();
    glow(ctx, 0, -s * 0.25, s * 0.8, '#cfe4ff', 0.45);
    // 深色的眼窝 + 一点光
    for (const dx of [-0.28, -0.02]) {
      ctx.fillStyle = 'rgba(20,24,60,0.75)';
      ctx.beginPath();
      ctx.ellipse(s * dx, -s * 0.32, s * 0.08, s * 0.12, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  };

  // 毒蛙：修长的后腿、发光的毒斑；吐毒时喉囊鼓起发光
  D.frog = function (ctx, s, t, o) {
    const ph = t * 2 + (o.seed || 0);
    shadow(ctx, 0, 2, s * 0.9);
    const base = '#6a4ab0';
    const puff = o.attack ? 0.5 + Math.max(0, Math.sin(t * 5)) * 0.5 : 0;
    // 后腿（折起来）
    ctx.fillStyle = deep(base, 0.7);
    ctx.beginPath();
    ctx.ellipse(s * 0.45, -s * 0.3, s * 0.45, s * 0.22, -0.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = deep(base, 0.75);
    ctx.lineWidth = s * 0.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.7, -s * 0.15);
    ctx.lineTo(s * 0.35, -s * 0.03);
    ctx.lineTo(s * 0.7, -s * 0.03);
    ctx.stroke();
    // 身体：前高后低地坐着
    ctx.fillStyle = bodyGrad(ctx, -s * 0.7, -s * 1.2, s * 0.7, 0, base, 0.25, 0.72);
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, -s * 0.85);
    ctx.quadraticCurveTo(-s * 0.15, -s * 1.15, s * 0.5, -s * 0.6);
    ctx.quadraticCurveTo(s * 0.55, -s * 0.15, s * 0.1, -s * 0.15);
    ctx.quadraticCurveTo(-s * 0.4, -s * 0.2, -s * 0.55, -s * 0.85);
    ctx.fill();
    // 喉囊
    if (puff > 0) {
      glow(ctx, -s * 0.4, -s * 0.45, s * 0.5 * (0.6 + puff), '#c8ff8a', 0.6 * puff);
      ctx.fillStyle = rgba('#c8ff8a', 0.5 * puff);
      ctx.beginPath();
      ctx.ellipse(-s * 0.4, -s * 0.48, s * 0.22 * (0.6 + puff), s * 0.18 * (0.6 + puff), 0, 0, TAU);
      ctx.fill();
    }
    // 前腿
    ctx.strokeStyle = deep(base, 0.55);
    ctx.lineWidth = s * 0.08;
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, -s * 0.4);
    ctx.lineTo(-s * 0.45, -s * 0.02);
    ctx.stroke();
    // 发光的毒斑
    for (const [px, py, r] of [[-0.05, -0.85, 1.6], [0.25, -0.72, 1.3], [0.05, -0.55, 1.1], [0.35, -0.45, 1.2]]) dot(ctx, s * px, s * py, r, '#c8ff8a', 0.6 + Math.sin(ph + px * 9) * 0.3);
    // 鼓鼓的大眼睛
    ctx.fillStyle = deep(base, 0.4);
    ctx.beginPath();
    ctx.arc(-s * 0.4, -s * 0.92, s * 0.16, 0, TAU);
    ctx.fill();
    eyes(ctx, -s * 0.43, -s * 0.94, 0.01, s * 0.07, '#ffe07a', 0);
  };

  // 树桩怪：根须当脚、树皮的纹理、裂缝里透出琥珀色的光（回血时变绿）
  D.stump = function (ctx, s, t, o) {
    const step = Math.sin(t * 5 + (o.seed || 0));
    shadow(ctx, 0, 2, s);
    const base = '#7a5a3a';
    const sap = o.regen ? '#9aff8a' : '#ffb04a';
    // 根须脚
    for (let i = 0; i < 4; i++) {
      const rx = -s * 0.55 + i * s * 0.36;
      const sw = Math.sin(t * 5 + i * 1.5) * s * 0.06 * (i % 2 ? 1 : -1) * Math.abs(step);
      ctx.strokeStyle = deep(base, 0.7);
      ctx.lineWidth = s * 0.12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(rx * 0.7, -s * 0.35);
      ctx.quadraticCurveTo(rx + sw, -s * 0.15, rx * 1.2 + sw, -s * 0.02);
      ctx.stroke();
    }
    // 树干
    ctx.fillStyle = bodyGrad(ctx, -s * 0.7, -s * 1.6, s * 0.7, -s * 0.2, base, 0.3, 0.75);
    ctx.beginPath();
    ctx.moveTo(-s * 0.65, -s * 0.3);
    ctx.quadraticCurveTo(-s * 0.7, -s * 1.0, -s * 0.55, -s * 1.45);
    ctx.lineTo(s * 0.55, -s * 1.45);
    ctx.quadraticCurveTo(s * 0.7, -s * 1.0, s * 0.65, -s * 0.3);
    ctx.closePath();
    ctx.fill();
    // 年轮切面
    ctx.fillStyle = deep('#c8a070', 0.4);
    ctx.beginPath();
    ctx.ellipse(0, -s * 1.45, s * 0.55, s * 0.15, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = deep('#c8a070', 0.6);
    ctx.lineWidth = 1;
    for (const r of [0.38, 0.22]) {
      ctx.beginPath();
      ctx.ellipse(0, -s * 1.45, s * r, s * r * 0.27, 0, 0, TAU);
      ctx.stroke();
    }
    // 切面上的一株小芽和苔藓
    ctx.strokeStyle = '#4a8a3a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(s * 0.2, -s * 1.45);
    ctx.quadraticCurveTo(s * 0.25, -s * 1.7, s * 0.4, -s * 1.75);
    ctx.stroke();
    // 树皮纹理
    ctx.strokeStyle = deep(base, 0.82);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.45 + i * s * 0.3, -s * 1.35);
      ctx.quadraticCurveTo(-s * 0.4 + i * s * 0.3, -s * 0.9, -s * 0.5 + i * s * 0.32, -s * 0.4);
      ctx.stroke();
    }
    // 裂缝里的光
    rune(ctx, [[s * 0.15, -s * 1.2], [s * 0.05, -s * 0.95], [s * 0.2, -s * 0.7]], sap, 2, 0.8);
    // 树洞一样的眼睛
    ctx.fillStyle = '#0a0606';
    for (const dx of [-0.35, -0.08]) {
      ctx.beginPath();
      ctx.ellipse(s * dx, -s * 1.0, s * 0.1, s * 0.13, 0, 0, TAU);
      ctx.fill();
    }
    eyes(ctx, -s * 0.22, -s * 1.0, s * 0.27, s * 0.045, sap, 0);
  };

  // 蝙蝠：薄膜翅膀，翅膀的骨架清楚
  D.bat = function (ctx, s, t, o) {
    const flap = Math.sin(t * 16 + (o.seed || 0));
    ctx.save();
    ctx.globalAlpha = 0.5;
    shadow(ctx, 0, 34, s * 0.7);
    ctx.restore();
    ctx.translate(0, -s * 0.6);
    const base = '#6a4a98';
    for (const [dir, far] of [[1, true], [-1, false]]) {
      const lift = flap * s * 0.7;
      ctx.fillStyle = far ? deep(base, 0.85) : bodyGrad(ctx, -s * 1.3, -s, s * 1.3, s * 0.3, base, 0.35, 0.75);
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.05);
      ctx.quadraticCurveTo(dir * s * 0.6, -s * 0.5 - lift, dir * s * 1.35, -s * 0.2 - lift);
      ctx.quadraticCurveTo(dir * s * 1.1, 0, dir * s * 0.95, s * 0.05 - lift * 0.3);
      ctx.quadraticCurveTo(dir * s * 0.75, -s * 0.05, dir * s * 0.55, s * 0.12 - lift * 0.2);
      ctx.quadraticCurveTo(dir * s * 0.35, s * 0.02, 0, s * 0.15);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = bodyGrad(ctx, -s * 0.3, -s * 0.4, s * 0.3, s * 0.3, base, 0.3, 0.7);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.25, s * 0.3, 0, 0, TAU);
    ctx.fill();
    // 尖耳
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, -s * 0.2);
    ctx.lineTo(-s * 0.18, -s * 0.5);
    ctx.lineTo(-s * 0.05, -s * 0.25);
    ctx.lineTo(s * 0.08, -s * 0.48);
    ctx.lineTo(s * 0.15, -s * 0.2);
    ctx.fill();
    eyes(ctx, -s * 0.08, -s * 0.08, s * 0.16, s * 0.05, '#ff9ae0', -0.1);
  };

  // 南瓜头：雕刻的南瓜脸，里面点着火；藤蔓当腿
  function pumpkinBody(ctx, s, t, o, small) {
    const hop = Math.abs(Math.sin(t * (small ? 14 : 8) + (o.seed || 0))) * s * (small ? 0.4 : 0.15);
    shadow(ctx, 0, 2, s * 0.9);
    const base = '#e07a20';
    ctx.save();
    ctx.translate(0, -hop);
    if (!small) {
      for (const [lx, p] of [[-s * 0.3, 0], [s * 0.3, Math.PI]]) {
        const sw = Math.sin(t * 8 + p) * s * 0.12;
        ctx.strokeStyle = '#2a4a1a';
        ctx.lineWidth = s * 0.08;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(lx * 0.5, -s * 0.4);
        ctx.quadraticCurveTo(lx + sw, -s * 0.2, lx + sw * 1.4, hop - s * 0.02);
        ctx.stroke();
      }
    }
    const cy = small ? -s * 0.7 : -s * 1.05;
    // 一瓣瓣的南瓜
    for (const [dx, w, k] of [[-0.42, 0.42, 0.75], [0.42, 0.42, 0.75], [0, 0.5, 0.45]]) {
      ctx.fillStyle = bodyGrad(ctx, s * (dx - w), cy - s * 0.65, s * (dx + w), cy + s * 0.6, base, 0.25 + (k - 0.45) * 0.3, 0.75);
      ctx.beginPath();
      ctx.ellipse(s * dx, cy, s * w, s * 0.62, 0, 0, TAU);
      ctx.fill();
    }
    // 南瓜蒂和卷须
    ctx.strokeStyle = '#2a4a1a';
    ctx.lineWidth = s * 0.1;
    ctx.beginPath();
    ctx.moveTo(0, cy - s * 0.58);
    ctx.quadraticCurveTo(s * 0.05, cy - s * 0.85, s * 0.25, cy - s * 0.9);
    ctx.stroke();
    // 雕出来的脸：里面的火光
    const fire = 0.75 + Math.sin(t * 9) * 0.15 + Math.sin(t * 23) * 0.08;
    glow(ctx, -s * 0.15, cy + s * 0.05, s * 0.9, '#ffb040', fire * 0.7);
    ctx.fillStyle = rgba('#ffd27a', fire);
    // 三角眼
    for (const ex of [-0.42, 0.02]) {
      ctx.beginPath();
      ctx.moveTo(s * ex, cy - s * 0.05);
      ctx.lineTo(s * (ex + 0.12), cy - s * 0.25);
      ctx.lineTo(s * (ex + 0.24), cy - s * 0.05);
      ctx.closePath();
      ctx.fill();
    }
    // 锯齿嘴
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, cy + s * 0.15);
    for (let i = 0; i <= 6; i++) ctx.lineTo(-s * 0.5 + i * s * 0.12, cy + s * (i % 2 ? 0.25 : 0.33));
    ctx.lineTo(s * 0.22, cy + s * 0.15);
    ctx.quadraticCurveTo(-s * 0.14, cy + s * 0.48, -s * 0.5, cy + s * 0.15);
    ctx.fill();
    ctx.restore();
  }
  D.pumpkin = (ctx, s, t, o) => pumpkinBody(ctx, s, t, o, false);
  D.minipumpkin = (ctx, s, t, o) => pumpkinBody(ctx, s, t, o, true);

  // 骨头先生：高高的骷髅法师，破旧的长袍，骷髅眼窝里的蓝色鬼火；倒下时是一堆骨头
  D.boneMage = function (ctx, s, t, o) {
    const ai = o.ai || {};
    const bone = '#e8e2d0';
    if (ai.mode === 'bones') {
      shadow(ctx, 0, 2, s);
      ctx.strokeStyle = deep(bone, 0.35);
      ctx.lineWidth = s * 0.1;
      ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const a = i * 1.1;
        const bx = -s * 0.6 + i * s * 0.24;
        ctx.beginPath();
        ctx.moveTo(bx - Math.cos(a) * s * 0.22, -s * 0.12 - Math.sin(a) * s * 0.05);
        ctx.lineTo(bx + Math.cos(a) * s * 0.22, -s * 0.12 + Math.sin(a) * s * 0.05);
        ctx.stroke();
      }
      ctx.fillStyle = deep(bone, 0.25);
      ctx.beginPath();
      ctx.ellipse(s * 0.1, -s * 0.35, s * 0.3, s * 0.26, 0.3, 0, TAU);
      ctx.fill();
      // 闪烁的鬼火：快要复活了
      const fl = 0.4 + Math.max(0, Math.sin(t * 12)) * 0.6;
      glow(ctx, s * 0.05, -s * 0.4, s * 0.6, '#7ad0ff', fl * 0.8, true);
      return;
    }
    const sway = Math.sin(t * 2.5 + (o.seed || 0)) * 0.04;
    shadow(ctx, 0, 2, s * 0.9);
    ctx.save();
    ctx.rotate(sway);
    // 长袍：下摆撕成一条条
    const base = '#4a3a6a';
    ctx.fillStyle = bodyGrad(ctx, -s * 0.7, -s * 2.0, s * 0.7, 0, base, 0.3, 0.78);
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
    ctx.fill();
    // 肋骨（从袍子的领口露出来）
    ctx.strokeStyle = rgba(bone, 0.5);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, -s * 1.55 + i * s * 0.14, s * 0.2, 0.3, Math.PI - 0.3);
      ctx.stroke();
    }
    // 骷髅头
    ctx.fillStyle = bodyGrad(ctx, -s * 0.4, -s * 2.4, s * 0.4, -s * 1.8, bone, 0.05, 0.45);
    ctx.beginPath();
    ctx.ellipse(-s * 0.05, -s * 2.1, s * 0.32, s * 0.3, 0, 0, TAU);
    ctx.fill();
    ctx.fillRect(-s * 0.25, -s * 1.95, s * 0.36, s * 0.16);
    ctx.fillStyle = '#08080e';
    for (const dx of [-0.2, 0.06]) {
      ctx.beginPath();
      ctx.ellipse(s * dx, -s * 2.12, s * 0.09, s * 0.1, 0, 0, TAU);
      ctx.fill();
    }
    eyes(ctx, -s * 0.07, -s * 2.12, s * 0.26, s * 0.045, '#7ad0ff', 0);
    // 兜帽
    ctx.fillStyle = deep(base, 0.55);
    ctx.beginPath();
    ctx.moveTo(-s * 0.42, -s * 1.95);
    ctx.quadraticCurveTo(-s * 0.4, -s * 2.55, s * 0.12, -s * 2.55);
    ctx.quadraticCurveTo(s * 0.55, -s * 2.4, s * 0.38, -s * 1.85);
    ctx.quadraticCurveTo(s * 0.3, -s * 2.3, -s * 0.05, -s * 2.38);
    ctx.quadraticCurveTo(-s * 0.32, -s * 2.3, -s * 0.42, -s * 1.95);
    ctx.fill();
    ctx.restore();
    // 法杖和鬼火
    ctx.strokeStyle = deep('#c8b090', 0.45);
    ctx.lineWidth = s * 0.06;
    ctx.beginPath();
    ctx.moveTo(-s * 0.75, -s * 0.05);
    ctx.lineTo(-s * 0.8, -s * 2.3);
    ctx.stroke();
    const fl = 0.7 + Math.sin(t * 7) * 0.2;
    glow(ctx, -s * 0.8, -s * 2.45, s * 0.6, '#7ad0ff', fl, true);
  };

  // 毒汤婆婆：尖帽子、长袍、搅着一口冒绿光的大锅
  D.witch = function (ctx, s, t, o) {
    const ai = o.ai || {};
    shadow(ctx, s * 0.2, 2, s * 1.4);
    // 大锅
    ctx.save();
    ctx.translate(-s * 0.85, 0);
    for (let i = 0; i < 3; i++) {
      const f = Math.sin(t * 12 + i) * 3;
      glow(ctx, -s * 0.25 + i * s * 0.25, -s * 0.15 - f, s * 0.25, '#ff8a3d', 0.7);
    }
    ctx.fillStyle = bodyGrad(ctx, -s * 0.7, -s * 1.1, s * 0.7, 0, '#3a3a48', 0.2, 0.7);
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.6, s * 0.68, s * 0.5, 0, 0, TAU);
    ctx.fill();
    const brew = ai.phase === 3 ? 0.6 : 1;
    glow(ctx, 0, -s * 1.05, s * 0.9, '#7aff6a', 0.7 * brew, true);
    ctx.fillStyle = rgba('#7aff6a', 0.85 * brew);
    ctx.beginPath();
    ctx.ellipse(0, -s * 1.0, s * 0.62, s * 0.14, 0, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const bt = (t * 1.5 + i * 0.33) % 1;
      dot(ctx, -s * 0.3 + i * s * 0.3, -s * 1.05 - bt * s * 0.7, 1.5 + bt * 2, '#9dff8a', 1 - bt);
    }
    if (ai.phase === 3) {
      // 倒翻的毒汤
      ctx.fillStyle = 'rgba(111,255,106,0.45)';
      ctx.beginPath();
      ctx.ellipse(-s * 0.9, -s * 0.08, s * 0.55, s * 0.12, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // 婆婆
    ctx.save();
    ctx.translate(s * 0.35, 0);
    const base = '#3a5a3a';
    const stir = Math.sin(t * 3) * 0.25;
    ctx.fillStyle = bodyGrad(ctx, -s * 0.6, -s * 2.0, s * 0.6, 0, base, 0.3, 0.78);
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, -s * 1.8);
    ctx.quadraticCurveTo(-s * 0.6, -s * 0.9, -s * 0.6, 0);
    ctx.lineTo(s * 0.6, 0);
    ctx.quadraticCurveTo(s * 0.55, -s * 0.9, s * 0.22, -s * 1.8);
    ctx.closePath();
    ctx.fill();
    // 搅汤的长勺
    ctx.save();
    ctx.translate(-s * 0.25, -s * 1.3);
    ctx.rotate(-0.9 + stir);
    ctx.strokeStyle = deep('#a07a50', 0.35);
    ctx.lineWidth = s * 0.07;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, s * 1.1);
    ctx.stroke();
    ctx.restore();
    // 脸：尖鼻子，藏在帽檐下
    ctx.fillStyle = deep('#a8c890', 0.45);
    ctx.beginPath();
    ctx.ellipse(-s * 0.05, -s * 1.95, s * 0.25, s * 0.26, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 0.25, -s * 1.95);
    ctx.quadraticCurveTo(-s * 0.55, -s * 1.85, -s * 0.48, -s * 1.75);
    ctx.lineTo(-s * 0.22, -s * 1.85);
    ctx.fill();
    eyes(ctx, -s * 0.15, -s * 2.0, s * 0.16, s * 0.045, '#d8ff8a', -0.1);
    // 宽檐尖帽子，帽尖往后弯
    ctx.fillStyle = deep('#3a2a4a', 0.4);
    ctx.beginPath();
    ctx.ellipse(-s * 0.02, -s * 2.15, s * 0.65, s * 0.12, -0.08, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 0.35, -s * 2.18);
    ctx.quadraticCurveTo(-s * 0.1, -s * 2.9, s * 0.45, -s * 3.0 + Math.sin(t * 2) * s * 0.05);
    ctx.quadraticCurveTo(s * 0.1, -s * 2.7, s * 0.3, -s * 2.2);
    ctx.closePath();
    ctx.fill();
    rune(ctx, [[-s * 0.3, -s * 2.24], [s * 0.28, -s * 2.26]], '#b08aff', 1.5, 0.7);
    ctx.restore();
  };
})((globalThis.TD = globalThis.TD || {}));
