// 雇佣兵造型（设计书 186）：六个兵种各有剪影、装备和动作。风格和英雄 / 怪物一致：大头 Q 版、渐变体积感、深紫描边。
// 脚底在 (0,0)，向上是负方向，朝右（朝怪物）；face = -1 时整体镜像。
// st: { t 时间, state 'idle'|'move'|'attack', age 距上一次出手的秒数, wind 0..1 蓄力, flash 受击闪白, dead 阵亡进度 0..1, charging, level, healAge }
(function (TD) {
  'use strict';

  const S = TD.sprites;
  const M = (TD.mercArt = {});
  const OUT = 'rgba(26,22,52,0.72)';
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ease = (x) => {
    x = clamp(x, 0, 1);
    return x * x * (3 - 2 * x);
  };

  const ell = (c, x, y, rx, ry, f, s, lw) => S.ellipse(c, x, y, rx, ry, f, s, lw);

  // 一根带描边的圆头线（四肢、武器杆）
  function limb(c, x0, y0, x1, y1, w, col) {
    c.lineCap = 'round';
    c.strokeStyle = OUT;
    c.lineWidth = w + 3;
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
    c.strokeStyle = col;
    c.lineWidth = w;
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
  }

  // 多边形：上亮下暗的渐变 + 描边
  function poly(c, pts, col, y0, y1, lw) {
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    const g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, S.lighten(col, 0.28));
    g.addColorStop(0.55, col);
    g.addColorStop(1, S.darken(col, 0.35));
    c.fillStyle = g;
    c.fill();
    c.lineWidth = lw || 2;
    c.strokeStyle = OUT;
    c.lineJoin = 'round';
    c.stroke();
  }

  // 躯干：圆角矩形 + 左上亮右下暗的渐变
  function torso(c, x, y, w, h, col, r) {
    S.roundRect(c, x - w / 2, y, w, h, r === undefined ? w * 0.3 : r);
    const g = c.createLinearGradient(x + w / 2, y, x - w / 2, y + h);
    g.addColorStop(0, S.lighten(col, 0.3));
    g.addColorStop(0.5, col);
    g.addColorStop(1, S.darken(col, 0.38));
    c.fillStyle = g;
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = OUT;
    c.stroke();
  }

  // 圆脸：肤色 + 朝右看的眼睛 + 腮红
  function face(c, x, y, r, st, skin) {
    ell(c, x, y, r, r * 0.95, st.tint(skin || '#ffd9b8'), OUT, 2);
    for (const dx of [-r * 0.1, r * 0.5]) {
      ell(c, x + dx, y + r * 0.02, r * 0.2, r * 0.26, '#fff', OUT, 1);
      ell(c, x + dx + r * 0.08, y + r * 0.05, r * 0.11, r * 0.17, '#2a1d14');
    }
    c.globalAlpha *= 0.4;
    ell(c, x + r * 0.2, y + r * 0.42, r * 0.28, r * 0.14, '#ff7b9c');
    c.globalAlpha /= 0.4;
    if (st.state === 'attack' && st.age < 0.25) {
      // 出手的一瞬间张嘴
      ell(c, x + r * 0.45, y + r * 0.55, r * 0.16, r * 0.13, '#7a2a2a');
    }
  }

  // 双腿：走路时交替迈步，站着有一点呼吸
  function legs(c, st, pant, boot, wide) {
    const w = wide || 5.5;
    const walk = st.state === 'move' ? Math.sin(st.t * 12) : 0;
    for (const side of [-1, 1]) {
      const ph = side * walk;
      const fx = side * w + ph * 6;
      const lift = Math.max(0, ph) * 4;
      limb(c, side * w * 0.8, -9, fx, -3 - lift, 6, st.tint(pant));
      ell(c, fx + 2, -1.5 - lift, 5, 3, st.tint(boot), OUT, 1.5);
    }
  }

  // 手（圆圆的小拳头）
  const hand = (c, x, y, st, r) => ell(c, x, y, r || 3.4, r || 3.4, st.tint('#ffd9b8'), OUT, 1.5);

  // ---------- 剑士 ----------
  function swordsman(c, st) {
    const t = st.t;
    const ka = st.state === 'attack' ? clamp(st.age / 0.3, 0, 1) : 1;
    const swing = st.state === 'attack' ? -2.1 + ease(ka * 1.4) * 2.9 : -0.6 + Math.sin(t * 3) * 0.05;
    // 披风
    poly(c, [[-5, -27], [-15, -18 + Math.sin(t * 6) * 2], [-12, -5], [-3, -10]], st.tint('#c8413b'), -27, -5);
    legs(c, st, '#4a4f78', '#5b3c2a');
    // 背后的圆盾
    ell(c, -8, -20, 6.5, 7.5, st.tint('#b9893c'), OUT, 1.8);
    ell(c, -8, -20, 2.6, 3, st.tint('#f4d27a'));
    torso(c, 0, -27, 17, 19, st.tint('#5b7bd5'), 6);
    // 皮带 + 白色十字带
    c.fillStyle = st.tint('#8a5a3c');
    c.fillRect(-8.5, -13, 17, 3);
    limb(c, -6, -26, 6, -12, 2.4, st.tint('#f2efe6'));
    // 头
    face(c, 1, -37, 9.5, st);
    // 头盔：钢盔 + 红缨
    c.beginPath();
    c.arc(1, -38, 10.2, Math.PI * 1.02, Math.PI * 1.98);
    c.lineTo(11, -37);
    c.lineTo(-9, -37);
    c.closePath();
    const hg = c.createLinearGradient(0, -48, 0, -36);
    hg.addColorStop(0, st.tint('#eef2f7'));
    hg.addColorStop(1, st.tint('#8f9aab'));
    c.fillStyle = hg;
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = OUT;
    c.stroke();
    limb(c, 1, -48, 1 + Math.sin(t * 5) * 2 - 6, -55, 4, st.tint('#e2483f'));
    // 握剑的手臂 + 剑（绕肩膀转）
    c.save();
    c.translate(6, -23);
    c.rotate(swing);
    limb(c, 0, 0, 8, 0, 4.5, st.tint('#5b7bd5'));
    hand(c, 9, 0, st);
    // 剑：护手 + 刃（带高光）
    limb(c, 9, 0, 12, 0, 3, st.tint('#6a4a3a'));
    limb(c, 12, -5, 12, 5, 2.2, st.tint('#c9a24a'));
    c.beginPath();
    c.moveTo(13, -2.2);
    c.lineTo(31, -1.2);
    c.lineTo(34, 0);
    c.lineTo(31, 1.2);
    c.lineTo(13, 2.2);
    c.closePath();
    const bg = c.createLinearGradient(0, -2.2, 0, 2.2);
    bg.addColorStop(0, st.tint('#ffffff'));
    bg.addColorStop(1, st.tint('#9aa6b8'));
    c.fillStyle = bg;
    c.fill();
    c.lineWidth = 1.6;
    c.strokeStyle = OUT;
    c.stroke();
    c.restore();
    // 挥砍的白色弧光
    if (st.state === 'attack' && st.age < 0.22) {
      c.save();
      c.globalAlpha = 0.85 * (1 - st.age / 0.22);
      c.strokeStyle = '#ffffff';
      c.lineWidth = 3;
      c.lineCap = 'round';
      c.beginPath();
      c.arc(6, -23, 30, -1.5, 0.7);
      c.stroke();
      c.restore();
    }
  }

  // ---------- 盾卫 ----------
  function guard(c, st) {
    const t = st.t;
    const bash = st.state === 'attack' ? Math.sin(clamp(st.age / 0.35, 0, 1) * Math.PI) * 9 : 0;
    poly(c, [[-6, -28], [-17, -17], [-14, -4], [-3, -9]], st.tint('#33508c'), -28, -4);
    legs(c, st, '#454a5e', '#3a3f50', 6.5);
    // 厚重的铠甲躯干 + 肩甲
    torso(c, 0, -28, 22, 21, st.tint('#8aa0c2'), 7);
    c.fillStyle = st.tint('#c9a24a');
    c.fillRect(-11, -14, 22, 3);
    ell(c, -11, -26, 6, 5, st.tint('#a9bad4'), OUT, 1.8);
    ell(c, 11, -26, 6, 5, st.tint('#a9bad4'), OUT, 1.8);
    // 胸甲上的纹章
    ell(c, 0, -20, 3.2, 3.8, st.tint('#e8c15a'), OUT, 1);
    // 头：圆顶盔 + 护颊 + 眼缝
    ell(c, 1, -39, 11, 11, st.tint('#9db0cf'), OUT, 2);
    c.fillStyle = st.tint('#2a2f45');
    c.fillRect(-4, -41, 15, 4.5);
    ell(c, 6, -39, 1.7, 1.6, '#fff4c8');
    poly(c, [[-8, -37], [-5, -28], [4, -28], [9, -37]], st.tint('#8197ba'), -37, -28, 1.6);
    limb(c, 1, -50, 1, -55, 4, st.tint('#c9a24a'));
    // 短锤（在身后的手）
    limb(c, -4, -22, -12, -34, 3.5, st.tint('#6a4a3a'));
    ell(c, -13, -36, 4.6, 4, st.tint('#9aa6b8'), OUT, 1.6);
    // 前面的大盾：攻击时向前猛顶
    c.save();
    c.translate(11 + bash, 0);
    poly(c, [[0, -34], [14, -31], [15, -14], [7, -2], [-1, -14]], st.tint('#3f6fc4'), -34, -2, 2.4);
    c.beginPath();
    c.moveTo(1, -31);
    c.lineTo(12, -29);
    c.lineTo(12.5, -15);
    c.lineTo(6.5, -6);
    c.lineTo(0, -15);
    c.closePath();
    c.lineWidth = 2;
    c.strokeStyle = st.tint('#e8c15a');
    c.stroke();
    limb(c, 6.5, -30, 6.5, -9, 2.6, st.tint('#e8c15a'));
    limb(c, 2, -21, 11, -21, 2.6, st.tint('#e8c15a'));
    c.restore();
    hand(c, 14 + bash, -20, st, 3.2);
    if (st.state === 'attack' && st.age < 0.2) {
      c.save();
      c.globalAlpha = 0.7 * (1 - st.age / 0.2);
      ell(c, 26 + bash, -18, 8, 14, '#ffffff');
      c.restore();
    }
  }

  // ---------- 弓手 ----------
  function archer(c, st) {
    const t = st.t;
    const draw = st.state === 'attack' ? st.wind : 0;
    const rel = st.state === 'attack' && st.age < 0.18 ? 1 - st.age / 0.18 : 0;
    // 披风式兜帽尾巴
    poly(c, [[-4, -28], [-14, -22 + Math.sin(t * 6) * 2], [-10, -10], [-2, -14]], st.tint('#3f7d46'), -28, -10);
    // 背后的箭袋
    limb(c, -7, -16, -11, -31, 5.5, st.tint('#7a4c2a'));
    for (const k of [0, 1, 2]) limb(c, -11 + k * 1.6, -31, -12 + k * 1.6, -36, 1.4, st.tint('#e8e0c0'));
    legs(c, st, '#6a5a3a', '#4a3a24');
    torso(c, 0, -27, 16, 19, st.tint('#6fae5a'), 6);
    c.fillStyle = st.tint('#7a4c2a');
    c.fillRect(-8, -13, 16, 3);
    // 头 + 绿色兜帽 + 羽毛
    face(c, 1.5, -37, 9.2, st);
    c.beginPath();
    c.arc(1, -38.5, 10.6, Math.PI * 0.96, Math.PI * 2.0);
    c.lineTo(10, -33);
    c.quadraticCurveTo(0, -35, -9.5, -31);
    c.closePath();
    const hg = c.createLinearGradient(0, -49, 0, -32);
    hg.addColorStop(0, st.tint('#7fcf6a'));
    hg.addColorStop(1, st.tint('#2f6a3a'));
    c.fillStyle = hg;
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = OUT;
    c.stroke();
    poly(c, [[-2, -47], [-9, -57], [-4, -49]], st.tint('#e8483f'), -57, -47, 1.4);
    // 弓：前手握弓，后手拉弦
    const bx = 14;
    const by = -24;
    c.lineCap = 'round';
    c.strokeStyle = OUT;
    c.lineWidth = 6;
    c.beginPath();
    c.arc(bx - 8, by, 15, -1.15, 1.15);
    c.stroke();
    c.strokeStyle = st.tint('#a9743d');
    c.lineWidth = 3.4;
    c.stroke();
    const tx = bx - 8 + Math.cos(-1.15) * 15;
    const ty = by + Math.sin(-1.15) * 15;
    const ux = bx - 8 + Math.cos(1.15) * 15;
    const uy = by + Math.sin(1.15) * 15;
    const pull = draw * 9 - rel * 2;
    c.strokeStyle = '#f2efe6';
    c.lineWidth = 1.3;
    c.beginPath();
    c.moveTo(tx, ty);
    c.lineTo(bx - 8 + 2 - pull, by);
    c.lineTo(ux, uy);
    c.stroke();
    // 搭在弦上的箭
    if (draw > 0.05 || (st.state !== 'attack')) {
      limb(c, bx - 8 + 2 - pull, by, bx + 14, by, 1.8, st.tint('#e8e0c0'));
      poly(c, [[bx + 14, by - 2.6], [bx + 20, by], [bx + 14, by + 2.6]], st.tint('#cfd6e0'), by - 3, by + 3, 1);
    }
    limb(c, 5, -23, bx - 3, by, 4, st.tint('#6fae5a'));
    hand(c, bx - 2, by, st, 3.2);
    limb(c, 5, -22, bx - 8 + 2 - pull, by + 1, 3.6, st.tint('#6fae5a'));
    hand(c, bx - 8 + 2 - pull, by + 1, st, 3);
  }

  // ---------- 法师 ----------
  function mage(c, st) {
    const t = st.t;
    const cast = st.state === 'attack' ? clamp(1 - st.age / 0.45, 0, 1) : 0;
    const orbR = 5 + Math.sin(t * 6) * 0.8 + cast * 5;
    // 飘起来的长袍
    c.beginPath();
    c.moveTo(-8, -28);
    c.quadraticCurveTo(-17, -12, -13 + Math.sin(t * 5) * 1.5, -1);
    c.lineTo(13 + Math.sin(t * 5 + 1) * 1.5, -1);
    c.quadraticCurveTo(17, -12, 8, -28);
    c.closePath();
    const rg = c.createLinearGradient(0, -28, 0, 0);
    rg.addColorStop(0, st.tint('#a07be0'));
    rg.addColorStop(0.6, st.tint('#7a4fc0'));
    rg.addColorStop(1, st.tint('#4a2a8a'));
    c.fillStyle = rg;
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = OUT;
    c.stroke();
    // 金边 + 星星
    c.strokeStyle = st.tint('#e8c15a');
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(-13, -2);
    c.lineTo(13, -2);
    c.stroke();
    ell(c, -3, -14, 1.6, 1.6, '#ffe9a8');
    ell(c, 5, -9, 1.2, 1.2, '#ffe9a8');
    // 上身
    torso(c, 0, -29, 15, 12, st.tint('#8a5fd0'), 5);
    ell(c, 0, -22, 2.4, 2.4, st.tint('#e8c15a'), OUT, 1);
    // 头 + 尖帽
    face(c, 1.5, -37.5, 9.2, st);
    poly(c, [[-12, -42], [14, -42], [6, -45], [4, -62 + Math.sin(t * 3) * 1.5], [-3, -46]], st.tint('#6a3fb0'), -62, -42, 2);
    c.beginPath();
    c.ellipse(1, -42.5, 14, 3.6, 0, 0, TAU);
    c.fillStyle = st.tint('#5a32a0');
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = OUT;
    c.stroke();
    ell(c, 2, -45, 2, 2, '#ffe9a8');
    // 法杖 + 光球
    const sx = 15;
    limb(c, sx, -3, sx, -38, 3.2, st.tint('#8a5a2a'));
    c.save();
    c.globalAlpha = 0.35 + cast * 0.3;
    ell(c, sx, -42, orbR * 2.2, orbR * 2.2, '#c49bff');
    c.restore();
    ell(c, sx, -42, orbR, orbR, st.tint('#e6d0ff'), OUT, 1.6);
    ell(c, sx - orbR * 0.3, -42 - orbR * 0.3, orbR * 0.3, orbR * 0.3, '#ffffff');
    limb(c, 5, -25, sx - 1, -27, 3.8, st.tint('#8a5fd0'));
    hand(c, sx, -27, st, 3);
    // 环绕的小符文
    for (let i = 0; i < 3; i++) {
      const a = t * 2 + i * 2.1;
      c.globalAlpha = 0.8;
      ell(c, sx + Math.cos(a) * 11, -42 + Math.sin(a) * 5, 1.3, 1.3, '#ffe9a8');
      c.globalAlpha = 1;
    }
  }

  // ---------- 牧师 ----------
  function cleric(c, st) {
    const t = st.t;
    const pulse = st.healAge !== undefined && st.healAge < 0.5 ? 1 - st.healAge / 0.5 : 0;
    // 白色长袍
    c.beginPath();
    c.moveTo(-8, -28);
    c.quadraticCurveTo(-15, -12, -12, -1);
    c.lineTo(12, -1);
    c.quadraticCurveTo(15, -12, 8, -28);
    c.closePath();
    const rg = c.createLinearGradient(0, -28, 0, 0);
    rg.addColorStop(0, st.tint('#ffffff'));
    rg.addColorStop(1, st.tint('#cfd6e6'));
    c.fillStyle = rg;
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = OUT;
    c.stroke();
    c.strokeStyle = st.tint('#e8c15a');
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-12, -2);
    c.lineTo(12, -2);
    c.stroke();
    // 披肩 + 金色圣徽
    torso(c, 0, -29, 17, 11, st.tint('#f6e7b0'), 5);
    limb(c, 0, -27, 0, -19, 2.4, st.tint('#e8c15a'));
    limb(c, -3.5, -23.5, 3.5, -23.5, 2.4, st.tint('#e8c15a'));
    // 头 + 兜帽：先画帽子的后半，再画脸，最后在额头上盖一道帽檐
    ell(c, -0.5, -37, 11.4, 11.2, st.tint('#f4efe2'), OUT, 2);
    face(c, 1.8, -37, 8.6, st);
    c.beginPath();
    c.arc(0.5, -38, 11, Math.PI * 1.02, Math.PI * 1.98);
    c.arc(1.5, -35, 9.4, Math.PI * 1.98, Math.PI * 1.02, true);
    c.closePath();
    c.fillStyle = st.tint('#fbf7ec');
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = OUT;
    c.stroke();
    // 光环
    c.save();
    c.globalAlpha = 0.85;
    c.strokeStyle = '#ffe9a8';
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(1, -52 + Math.sin(t * 3) * 1, 9, 3, 0, 0, TAU);
    c.stroke();
    c.restore();
    // 法杖：顶端是圣徽
    const sx = 15;
    limb(c, sx, -3, sx, -40, 3, st.tint('#c9a24a'));
    c.save();
    c.globalAlpha = 0.3 + pulse * 0.5;
    ell(c, sx, -44, 11 + pulse * 8, 11 + pulse * 8, '#fff2a8');
    c.restore();
    limb(c, sx, -50, sx, -38, 3.4, st.tint('#fff2a8'));
    limb(c, sx - 6, -45, sx + 6, -45, 3.4, st.tint('#fff2a8'));
    limb(c, 5, -25, sx - 1, -27, 3.8, st.tint('#f6e7b0'));
    hand(c, sx, -27, st, 3);
    // 飘起的光点
    for (let i = 0; i < 3; i++) {
      const k = (t * 0.7 + i / 3) % 1;
      c.globalAlpha = 0.8 * (1 - k);
      ell(c, -8 + i * 8, -20 - k * 22, 1.3, 1.3, '#fff2a8');
      c.globalAlpha = 1;
    }
  }

  // ---------- 骑士（骑着马）----------
  function knight(c, st) {
    const t = st.t;
    const gallop = st.state === 'move' ? Math.sin(t * (st.charging ? 18 : 13)) : Math.sin(t * 2) * 0.1;
    const rear = st.state === 'attack' ? Math.sin(clamp(st.age / 0.4, 0, 1) * Math.PI) * 0.35 : 0;
    c.save();
    c.translate(0, -4);
    c.rotate(-rear);
    // 马尾 + 后腿 + 前腿
    limb(c, -17, -22, -26, -12 + gallop * 3, 4.5, st.tint('#e8e0d0'));
    for (const [lx, ph] of [[-12, 0], [-7, Math.PI], [9, Math.PI * 0.5], [14, Math.PI * 1.5]]) {
      const sw = Math.sin(t * (st.charging ? 18 : 13) + ph) * (st.state === 'move' ? 5 : 0.5);
      limb(c, lx, -12, lx + sw, -2 - Math.max(0, -sw) * 0.6, 5, st.tint('#8b5a2b'));
      ell(c, lx + sw + 1, -1, 3.6, 2.4, st.tint('#3a2a1a'), OUT, 1.2);
    }
    // 马身 + 脖子 + 马头
    ell(c, 0, -17, 21, 11, st.tint('#a0693a'), OUT, 2);
    poly(c, [[10, -22], [22, -34], [29, -31], [20, -16]], st.tint('#a0693a'), -34, -16, 2);
    ell(c, 28, -30, 7.5, 5.2, st.tint('#a0693a'), OUT, 2);
    ell(c, 33, -29, 1.4, 1.4, '#2a1d14');
    ell(c, 25, -33, 1.6, 1.6, '#2a1d14');
    poly(c, [[21, -37], [24, -43], [26, -35]], st.tint('#a0693a'), -43, -35, 1.4);
    // 鬃毛
    for (let i = 0; i < 4; i++) limb(c, 14 + i * 2.4, -27 - i * 2.4, 11 + i * 2.4, -25 - i * 2.4 + Math.sin(t * 8 + i) * 1.5, 3, st.tint('#e8e0d0'));
    // 马鞍 + 红色鞍毯
    poly(c, [[-8, -26], [8, -26], [10, -16], [-10, -16]], st.tint('#c8413b'), -26, -16, 1.6);
    c.restore();
    // 骑士本人
    const by = -8 - gallop * 1.5 - 4;
    c.save();
    c.translate(0, by);
    poly(c, [[-4, -30], [-15, -24 + Math.sin(t * 8) * 2], [-12, -12], [-3, -16]], st.tint('#c8413b'), -30, -12);
    torso(c, 0, -31, 17, 16, st.tint('#c9d2e0'), 5);
    c.fillStyle = st.tint('#e8c15a');
    c.fillRect(-8.5, -19, 17, 2.6);
    ell(c, 0, -26, 2.6, 3, st.tint('#e8483f'), OUT, 1);
    // 全封闭头盔 + 面甲缝 + 红羽
    ell(c, 1, -42, 10.5, 10.5, st.tint('#d6dde8'), OUT, 2);
    c.fillStyle = st.tint('#2a2f45');
    c.fillRect(0, -44, 11, 4);
    ell(c, 6, -42, 1.6, 1.5, '#fff4c8');
    limb(c, 1, -52, 1 + Math.sin(t * 6) * 3 - 8, -58, 4.4, st.tint('#e2483f'));
    // 长枪：前压，冲锋时更平
    const tilt = st.charging ? -0.05 : st.state === 'attack' ? -0.12 + Math.sin(clamp(st.age / 0.3, 0, 1) * Math.PI) * 0.35 : -0.5;
    c.save();
    c.translate(7, -29);
    c.rotate(tilt);
    limb(c, -10, 0, 40, 0, 3.4, st.tint('#8a5a2a'));
    poly(c, [[40, -3.4], [52, 0], [40, 3.4]], st.tint('#e8eef6'), -4, 4, 1.4);
    poly(c, [[26, 0], [34, -8 + Math.sin(t * 9) * 1.5], [34, 8 - Math.sin(t * 9) * 1.5]], st.tint('#e2483f'), -8, 8, 1);
    c.restore();
    limb(c, 5, -27, 12, -28, 4.2, st.tint('#c9d2e0'));
    hand(c, 13, -28, st, 3.2);
    c.restore();
    // 冲锋时的速度线
    if (st.charging && st.state === 'move') {
      c.save();
      c.strokeStyle = 'rgba(255,255,255,0.55)';
      c.lineWidth = 2;
      c.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.moveTo(-30 - i * 6, -40 + i * 9);
        c.lineTo(-44 - i * 6, -40 + i * 9);
        c.stroke();
      }
      c.restore();
    }
  }

  const DRAW = { swordsman, guard, archer, mage, cleric, knight };
  M.has = (type) => !!DRAW[type];
  M.scale = { swordsman: 1.15, guard: 1.2, archer: 1.15, mage: 1.15, cleric: 1.15, knight: 1.1 };

  // 画一个兵。x, y = 脚底位置；face = 1 朝右，-1 朝左
  M.draw = function (ctx, type, x, y, st, face) {
    const fn = DRAW[type];
    if (!fn) return false;
    const s = M.scale[type] || 1;
    st.tint = (hex) => (st.flash ? S.lighten(hex, 0.78) : hex);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale((face < 0 ? -1 : 1) * s, s);
    if (st.dead) {
      // 阵亡：向后倒下并淡出
      ctx.rotate(-st.dead * 1.25);
      ctx.translate(-st.dead * 8, st.dead * 4);
      ctx.globalAlpha *= Math.max(0, 1 - st.dead);
    }
    fn(ctx, st);
    ctx.restore();
    return true;
  };
})((globalThis.TD = globalThis.TD || {}));
