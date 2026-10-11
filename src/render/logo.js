// 徽章 Logo 与启动动画（设计书 57.4）：全部用代码画，标题画面、启动动画、应用图标共用
(function (TD) {
  'use strict';

  const L = (TD.logo = {});
  const GOLD = '#f3c867';
  const GOLD_HI = '#fff1c2';
  const GOLD_DK = '#8a5a1e';

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function softGlow(ctx, x, y, r, col, a) {
    if (a <= 0 || r <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(col, a));
    g.addColorStop(0.35, rgba(col, a * 0.45));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // 盾牌轮廓：以 (0,0) 为中心，宽 w 高 h
  function shieldPath(ctx, w, h) {
    const top = -h * 0.5;
    const bot = h * 0.5;
    ctx.beginPath();
    ctx.moveTo(0, top + h * 0.05);
    ctx.quadraticCurveTo(w * 0.26, top - h * 0.03, w * 0.5, top + h * 0.07);
    ctx.lineTo(w * 0.5, top + h * 0.42);
    ctx.bezierCurveTo(w * 0.5, bot - h * 0.2, w * 0.24, bot - h * 0.07, 0, bot);
    ctx.bezierCurveTo(-w * 0.24, bot - h * 0.07, -w * 0.5, bot - h * 0.2, -w * 0.5, top + h * 0.42);
    ctx.lineTo(-w * 0.5, top + h * 0.07);
    ctx.quadraticCurveTo(-w * 0.26, top - h * 0.03, 0, top + h * 0.05);
    ctx.closePath();
  }

  // 一片叶子（沿 +x 方向）
  function leaf(ctx, len, wid) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.45, -wid, len, 0);
    ctx.quadraticCurveTo(len * 0.45, wid, 0, 0);
    ctx.closePath();
  }

  // 盾牌两侧的叶枝
  function sprig(ctx, R, side, a) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.globalAlpha *= a;
    ctx.strokeStyle = rgba('#d9b45a', 0.9);
    ctx.lineWidth = R * 0.022;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.0, Math.PI * 0.62, Math.PI * 0.93);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const an = Math.PI * (0.65 + i * 0.065);
      const x = Math.cos(an) * R * 1.0;
      const y = Math.sin(an) * R * 1.0;
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(an + Math.PI / 2 + s * 0.7 + Math.PI);
        const lg = ctx.createLinearGradient(0, 0, R * 0.16, 0);
        lg.addColorStop(0, '#c9a24a');
        lg.addColorStop(1, '#fff0b8');
        ctx.fillStyle = lg;
        leaf(ctx, R * (0.16 - i * 0.012), R * 0.045);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // 城塔：底部中心在 (0, base)
  function tower(ctx, R, a) {
    ctx.save();
    ctx.globalAlpha *= a;
    const w = R * 0.3;
    const top = -R * 0.12;
    const base = R * 0.42;
    const g = ctx.createLinearGradient(-w / 2, top, w / 2, base);
    g.addColorStop(0, GOLD_HI);
    g.addColorStop(0.45, GOLD);
    g.addColorStop(1, GOLD_DK);
    ctx.fillStyle = g;
    ctx.beginPath();
    // 塔身略收腰
    ctx.moveTo(-w * 0.56, base);
    ctx.lineTo(-w * 0.48, top);
    // 城垛
    const mw = (w * 1.12) / 5;
    let x = -w * 0.56;
    ctx.lineTo(x, top - R * 0.08);
    for (let i = 0; i < 5; i++) {
      const nx = x + mw;
      if (i % 2 === 0) {
        ctx.lineTo(nx, top - R * 0.08);
        ctx.lineTo(nx, top);
      } else {
        ctx.lineTo(nx, top);
        ctx.lineTo(nx, top - R * 0.08);
      }
      x = nx;
    }
    ctx.lineTo(w * 0.56, top - R * 0.08);
    ctx.lineTo(w * 0.48, top);
    ctx.lineTo(w * 0.56, base);
    ctx.closePath();
    ctx.fill();
    // 石缝
    ctx.strokeStyle = rgba('#5a3a12', 0.45);
    ctx.lineWidth = R * 0.008;
    for (let i = 1; i < 5; i++) {
      const y = top + ((base - top) * i) / 5;
      ctx.beginPath();
      ctx.moveTo(-w * 0.5, y);
      ctx.lineTo(w * 0.5, y);
      ctx.stroke();
    }
    // 发光的窗
    ctx.fillStyle = '#1a1206';
    ctx.beginPath();
    ctx.moveTo(-R * 0.035, R * 0.08);
    ctx.lineTo(-R * 0.035, R * 0.0);
    ctx.arc(0, R * 0.0, R * 0.035, Math.PI, 0);
    ctx.lineTo(R * 0.035, R * 0.08);
    ctx.closePath();
    ctx.fill();
    softGlow(ctx, 0, R * 0.04, R * 0.12, '#ffd56b', 0.9);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(-R * 0.022, R * 0.005, R * 0.044, R * 0.07);
    // 城门
    ctx.fillStyle = '#1a1206';
    ctx.beginPath();
    ctx.moveTo(-R * 0.06, base);
    ctx.lineTo(-R * 0.06, base - R * 0.08);
    ctx.arc(0, base - R * 0.08, R * 0.06, Math.PI, 0);
    ctx.lineTo(R * 0.06, base);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 弓（拱在塔后面）和一支向上的箭
  function bowAndArrow(ctx, R, a, t) {
    ctx.save();
    ctx.globalAlpha *= a;
    const cy = R * 0.3;
    const r = R * 0.44;
    const a0 = Math.PI * 1.08;
    const a1 = Math.PI * 1.92;
    // 弓臂
    ctx.lineCap = 'round';
    ctx.strokeStyle = GOLD_DK;
    ctx.lineWidth = R * 0.055;
    ctx.beginPath();
    ctx.arc(0, cy, r, a0, a1);
    ctx.stroke();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = R * 0.03;
    ctx.stroke();
    ctx.strokeStyle = GOLD_HI;
    ctx.lineWidth = R * 0.01;
    ctx.beginPath();
    ctx.arc(0, cy, r - R * 0.01, a0 + 0.1, a1 - 0.1);
    ctx.stroke();
    // 弓弦：拉到箭尾
    const lx = Math.cos(a0) * r;
    const ly = cy + Math.sin(a0) * r;
    const nock = R * 0.5;
    ctx.strokeStyle = rgba('#fff6d8', 0.85);
    ctx.lineWidth = R * 0.008;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(0, nock);
    ctx.lineTo(-lx, ly);
    ctx.stroke();
    ctx.restore();
  }

  function arrowUp(ctx, R, a, t) {
    ctx.save();
    ctx.globalAlpha *= a;
    const tip = -R * 0.6;
    const nock = R * 0.5;
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = R * 0.022;
    ctx.beginPath();
    ctx.moveTo(0, nock);
    ctx.lineTo(0, tip + R * 0.1);
    ctx.stroke();
    // 箭羽
    ctx.fillStyle = '#e8b85a';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, nock - R * 0.02);
      ctx.lineTo(s * R * 0.05, nock + R * 0.02);
      ctx.lineTo(s * R * 0.05, nock - R * 0.06);
      ctx.lineTo(0, nock - R * 0.1);
      ctx.closePath();
      ctx.fill();
    }
    // 发光的箭头
    softGlow(ctx, 0, tip + R * 0.05, R * 0.2, '#ffe6a0', 0.55 + Math.sin(t * 3) * 0.15);
    const g = ctx.createLinearGradient(0, tip, 0, tip + R * 0.12);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, GOLD);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, tip);
    ctx.lineTo(R * 0.055, tip + R * 0.12);
    ctx.lineTo(0, tip + R * 0.09);
    ctx.lineTo(-R * 0.055, tip + R * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 四角星光
  function sparkle(ctx, x, y, r, rot, a) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha *= a;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const an = (i * Math.PI) / 2;
      ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r);
      ctx.lineTo(Math.cos(an + Math.PI / 4) * r * 0.18, Math.sin(an + Math.PI / 4) * r * 0.18);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 画徽章。o: { t, ring, outline, fill, glow }（0~1，用于启动动画逐步显现；省略时全部画完）
  L.drawEmblem = function (ctx, cx, cy, R, o) {
    o = o || {};
    const t = o.t || 0;
    const ring = o.ring ?? 1;
    const outline = o.outline ?? 1;
    const fill = o.fill ?? 1;
    const glow = o.glow ?? 1;
    ctx.save();
    ctx.translate(cx, cy);
    // 背后的光
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    softGlow(ctx, 0, 0, R * 1.6, '#ffb84a', 0.22 * glow);
    softGlow(ctx, 0, -R * 0.2, R * 0.9, '#7fe0ff', 0.1 * glow);
    ctx.restore();
    // 叶枝
    if (fill > 0) {
      sprig(ctx, R, 1, fill);
      sprig(ctx, R, -1, fill);
    }
    // 外圈光环（从顶部顺时针画出）
    if (ring > 0) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgba(GOLD, 0.35);
      ctx.lineWidth = R * 0.07;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.92, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ring);
      ctx.stroke();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = R * 0.028;
      ctx.stroke();
      ctx.strokeStyle = GOLD_HI;
      ctx.lineWidth = R * 0.008;
      ctx.stroke();
      // 圈上的符文点
      for (let i = 0; i < 24; i++) {
        const an = -Math.PI / 2 + (i / 24) * Math.PI * 2;
        if (i / 24 > ring) break;
        const rr = i % 6 === 0 ? R * 0.03 : R * 0.012;
        ctx.fillStyle = i % 6 === 0 ? GOLD_HI : rgba(GOLD, 0.8);
        ctx.beginPath();
        ctx.arc(Math.cos(an) * R * 0.82, Math.sin(an) * R * 0.82, rr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    const sw = R * 1.08;
    const sh = R * 1.3;
    ctx.save();
    ctx.translate(0, R * 0.03);
    // 盾面
    if (fill > 0) {
      ctx.save();
      ctx.globalAlpha *= fill;
      shieldPath(ctx, sw, sh);
      const g = ctx.createLinearGradient(0, -sh / 2, 0, sh / 2);
      g.addColorStop(0, '#26355e');
      g.addColorStop(0.55, '#141d38');
      g.addColorStop(1, '#0a0f20');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.clip();
      // 盾面上的斜光
      const lg = ctx.createLinearGradient(-sw / 2, -sh / 2, sw / 2, sh / 2);
      lg.addColorStop(0, 'rgba(160,200,255,0.18)');
      lg.addColorStop(0.4, 'rgba(160,200,255,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(-sw, -sh, sw * 2, sh * 2);
      // 星点
      for (let i = 0; i < 14; i++) {
        const x = Math.sin(i * 12.9898) * sw * 0.4;
        const y = Math.cos(i * 78.233) * sh * 0.4;
        ctx.fillStyle = `rgba(200,225,255,${0.25 + 0.25 * Math.sin(t * 2 + i)})`;
        ctx.fillRect(x, y, R * 0.012, R * 0.012);
      }
      bowAndArrow(ctx, R, 1, t);
      tower(ctx, R, 1);
      arrowUp(ctx, R, 1, t);
      ctx.restore();
    }
    // 盾牌金边（描线动画）
    if (outline > 0) {
      ctx.save();
      shieldPath(ctx, sw, sh);
      const len = R * 4.6;
      ctx.setLineDash([len * outline, len * 2]);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = GOLD_DK;
      ctx.lineWidth = R * 0.075;
      ctx.stroke();
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = R * 0.045;
      ctx.stroke();
      ctx.strokeStyle = GOLD_HI;
      ctx.lineWidth = R * 0.012;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    // 顶上的森林之光
    if (glow > 0) {
      const y = -R * 0.92;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      softGlow(ctx, 0, y, R * 0.42, '#bff4ff', 0.6 * glow);
      softGlow(ctx, 0, y, R * 0.16, '#ffffff', 0.9 * glow);
      ctx.restore();
      sparkle(ctx, 0, y, R * 0.2 * (0.9 + Math.sin(t * 2.4) * 0.1), t * 0.4, glow);
    }
    ctx.restore();
  };

  // 把徽章画进一个新画布（标题画面、应用图标用）
  L.emblemCanvas = function (size, t) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    L.drawEmblem(c.getContext('2d'), size / 2, size / 2 + size * 0.03, size * 0.36, { t: t || 0 });
    return c;
  };

  // 标题画面上的徽章：缓慢呼吸的光
  L.liveEmblem = function (size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    c.className = 'title-emblem';
    const ctx = c.getContext('2d');
    let start = 0;
    const tick = (ts) => {
      if (!c.isConnected && start) return;
      if (!start) start = ts;
      const t = (ts - start) / 1000;
      ctx.clearRect(0, 0, size, size);
      L.drawEmblem(ctx, size / 2, size / 2 + size * 0.03, size * 0.36, { t, glow: 0.8 + Math.sin(t * 1.6) * 0.2 });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return c;
  };

  // ---------------- 启动动画 ----------------
  const W = 1280;
  const H = 720;
  const CX = W / 2;
  const CY = 270;
  const R = 120;
  const TOTAL = 4.9;

  function rand(seed) {
    let s = seed;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  // 黑暗森林背景（只画一次）
  function forest() {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#03050b');
    g.addColorStop(0.55, '#081224');
    g.addColorStop(1, '#03060c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const rnd = rand(7);
    // 三层树干：越近越黑越粗
    const layers = [
      { n: 16, col: 'rgba(30,52,82,0.55)', w: [10, 22] },
      { n: 11, col: 'rgba(14,26,44,0.85)', w: [18, 36] },
      { n: 6, col: '#04070d', w: [40, 70] },
    ];
    for (const ly of layers) {
      ctx.fillStyle = ly.col;
      for (let i = 0; i < ly.n; i++) {
        const x = rnd() * W;
        const w = ly.w[0] + rnd() * (ly.w[1] - ly.w[0]);
        const lean = (rnd() - 0.5) * 40;
        ctx.beginPath();
        ctx.moveTo(x - w / 2, H);
        ctx.quadraticCurveTo(x - w * 0.3 + lean * 0.5, H * 0.5, x - w * 0.35 + lean, -10);
        ctx.lineTo(x + w * 0.35 + lean, -10);
        ctx.quadraticCurveTo(x + w * 0.3 + lean * 0.5, H * 0.5, x + w / 2, H);
        ctx.closePath();
        ctx.fill();
        // 枝杈
        for (let k = 0; k < 2; k++) {
          const by = H * (0.2 + rnd() * 0.4);
          const dir = rnd() < 0.5 ? -1 : 1;
          ctx.beginPath();
          ctx.moveTo(x + lean * 0.5, by);
          ctx.quadraticCurveTo(x + dir * w * 1.5, by - 40, x + dir * w * 2.6, by - 90 - rnd() * 60);
          ctx.lineTo(x + dir * w * 2.6 + 3, by - 88 - rnd() * 60);
          ctx.quadraticCurveTo(x + dir * w * 1.2, by - 20, x + lean * 0.5, by + w * 0.5);
          ctx.fill();
        }
      }
      // 一层雾
      const fg = ctx.createLinearGradient(0, H * 0.55, 0, H);
      fg.addColorStop(0, 'rgba(60,110,150,0)');
      fg.addColorStop(1, 'rgba(60,110,150,0.08)');
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, W, H);
    }
    // 垂下的藤蔓
    ctx.strokeStyle = '#02040a';
    ctx.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const x = rnd() * W;
      const len = 40 + rnd() * 140;
      ctx.lineWidth = 2 + rnd() * 3;
      ctx.beginPath();
      ctx.moveTo(x, -5);
      ctx.quadraticCurveTo(x + (rnd() - 0.5) * 30, len * 0.6, x + (rnd() - 0.5) * 20, len);
      ctx.stroke();
    }
    // 地面草丛剪影
    ctx.fillStyle = '#010309';
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 9) {
      const h = 30 + rnd() * 60;
      ctx.lineTo(x, H - h * 0.4);
      ctx.lineTo(x + 3, H - h);
      ctx.lineTo(x + 6, H - h * 0.4);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
    return c;
  }

  // 标题文字（带一道扫光）
  function titleText(ctx, alpha, sweep) {
    if (alpha <= 0) return;
    const tc = titleText.c || (titleText.c = document.createElement('canvas'));
    tc.width = 760;
    tc.height = 200;
    const t = tc.getContext('2d');
    t.textAlign = 'center';
    t.textBaseline = 'middle';
    t.font = '900 104px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC",sans-serif';
    const g = t.createLinearGradient(0, 40, 0, 160);
    g.addColorStop(0, '#fff6d6');
    g.addColorStop(0.5, '#f6c65a');
    g.addColorStop(1, '#b8772a');
    t.lineWidth = 10;
    t.strokeStyle = 'rgba(40,20,5,0.85)';
    t.lineJoin = 'round';
    t.strokeText('守城英雄', 380, 100);
    t.fillStyle = g;
    t.fillText('守城英雄', 380, 100);
    // 扫光
    t.globalCompositeOperation = 'source-atop';
    const sx = -200 + sweep * 1160;
    const sg = t.createLinearGradient(sx - 120, 0, sx + 120, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0.85)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    t.fillStyle = sg;
    t.setTransform(1, 0, -0.35, 1, 0, 0);
    t.fillRect(0, 0, 1200, 200);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'lighter';
    softGlow(ctx, CX, CY + 230, 360, '#ff9a3a', 0.12 * alpha);
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(tc, CX - 380, CY + 130 + (1 - alpha) * 16);
    ctx.restore();
  }

  const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const span = (t, a, b) => ease((t - a) / (b - a));

  // 播放启动动画；结束（或被跳过）后调用 onDone
  L.playSplash = function (stage, onDone) {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    c.id = 'splash';
    stage.appendChild(c);
    const ctx = c.getContext('2d');
    const bg = forest();
    const rnd = rand(42);
    const flies = Array.from({ length: 70 }, () => ({ x: rnd() * W, y: rnd() * H, vx: (rnd() - 0.5) * 20, vy: -5 - rnd() * 15, ph: rnd() * 6, r: 1 + rnd() * 2, on: rnd() * 3.5 }));
    const burst = Array.from({ length: 90 }, () => {
      const an = rnd() * Math.PI * 2;
      const sp = 80 + rnd() * 380;
      return { vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, r: 1 + rnd() * 2.5 };
    });
    const trail = [];
    let t = 0;
    let last = 0;
    let done = false;
    const skip = () => {
      if (t < TOTAL - 0.6) t = TOTAL - 0.6;
    };
    c.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', skip);
    // 光点的位置：先从右下飘来，再绕徽章转一圈，最后停在徽章顶上
    const orbAt = (t) => {
      if (t < 1.3) {
        const k = ease(t / 1.3);
        const x0 = W + 60;
        const y0 = H * 0.78;
        const x1 = CX + R * 0.92;
        const y1 = CY;
        const mx = W * 0.72;
        const my = H * 0.25;
        const u = 1 - k;
        return { x: u * u * x0 + 2 * u * k * mx + k * k * x1, y: u * u * y0 + 2 * u * k * my + k * k * y1 };
      }
      if (t < 2.4) {
        // 从右边（0 度）顺时针绕一圈多，停在顶上
        const k = ease((t - 1.3) / 1.1);
        const an = k * Math.PI * 2.5;
        return { x: CX + Math.cos(an) * R * 0.92, y: CY + Math.sin(an) * R * 0.92 };
      }
      return { x: CX, y: CY - R * 0.92 };
    };
    const frame = (ts) => {
      const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
      last = ts;
      t += dt;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(bg, 0, 0);
      // 萤火：随时间一只只亮起来
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const f of flies) {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (f.y < -10) f.y = H + 10;
        const a = Math.min(1, Math.max(0, t - f.on)) * (0.4 + 0.4 * Math.sin(t * 2 + f.ph));
        softGlow(ctx, f.x, f.y, f.r * 7, '#c9ff9a', a * 0.5);
      }
      ctx.restore();
      // 徽章
      const ring = t < 1.3 ? 0 : span(t, 1.3, 2.4);
      const outline = span(t, 1.9, 2.8);
      const fill = span(t, 2.5, 3.1);
      const emGlow = span(t, 2.8, 3.2);
      if (ring > 0) L.drawEmblem(ctx, CX, CY, R, { t, ring, outline, fill, glow: emGlow });
      // 点亮那一下的闪光
      if (t > 2.8 && t < 3.6) {
        const k = 1 - (t - 2.8) / 0.8;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        softGlow(ctx, CX, CY, R * 3.2 * (1.2 - k * 0.4), '#ffe2a0', 0.5 * k);
        ctx.restore();
      }
      // 标题与副标题
      const ta = span(t, 3.0, 3.6);
      titleText(ctx, ta, span(t, 3.2, 4.3));
      const sa = span(t, 3.5, 4.0);
      if (sa > 0) {
        ctx.save();
        ctx.globalAlpha = sa;
        ctx.textAlign = 'center';
        ctx.font = '700 26px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
        ctx.fillStyle = '#d8e8ff';
        ctx.fillText('— 小卫兵铛铛的守城日记 —', CX, CY + 330);
        ctx.restore();
      }
      // 光点和光尾
      if (t < 3.0) {
        const p = orbAt(t);
        trail.push({ x: p.x, y: p.y });
        if (trail.length > 26) trail.shift();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        trail.forEach((q, i) => {
          const k = i / trail.length;
          softGlow(ctx, q.x, q.y, 6 + k * 18, '#9fe8ff', 0.35 * k);
        });
        softGlow(ctx, p.x, p.y, 60, '#bff4ff', 0.55);
        softGlow(ctx, p.x, p.y, 14, '#ffffff', 1);
        ctx.restore();
      }
      // 散成萤火
      if (t > 3.9) {
        const k = t - 3.9;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const b of burst) {
          const x = CX + b.vx * k * (1 - k * 0.25);
          const y = CY - R * 0.92 + b.vy * k * (1 - k * 0.25) + 30 * k * k;
          softGlow(ctx, x, y, b.r * 6, '#d8ffb0', Math.max(0, 0.8 - k * 0.7));
        }
        ctx.restore();
      }
      // 淡出
      const out = span(t, TOTAL - 0.6, TOTAL);
      c.style.opacity = String(1 - out);
      if (out > 0.3) c.style.pointerEvents = 'none';
      if (t >= TOTAL) {
        if (!done) {
          done = true;
          window.removeEventListener('keydown', skip);
          c.remove();
          if (onDone) onDone();
        }
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    return c;
  };
})((globalThis.TD = globalThis.TD || {}));
