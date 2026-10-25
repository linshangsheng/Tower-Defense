// 新消耗品的特效（设计书 62.4）：火墙、符文护盾、战旗、地裂、冰霜扫过、洪水、圣光柱、陨石、时间环
// 是 vfx.js 里 TD.Vfx 的扩展：新增方法 + 新的 fx 种类；全部加色混合，不用 canvas 滤镜
(function (TD) {
  'use strict';

  const V = TD.Vfx.prototype;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const easeOut = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 2.4);
  const easeInOut = (x) => {
    x = Math.min(1, Math.max(0, x));
    return x * x * (3 - 2 * x);
  };
  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }
  // 固定的伪随机：同一道特效每帧的形状稳定
  const hash = (i, s) => {
    const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };

  // ---------------- 触发 ----------------
  // 燃烧瓶：一道火墙从城墙沿车道推进
  V.fireWall = function (x0, x1, y0, h) {
    this.fx.push({ kind: 'fireWall', x0, x1, y0, h, life: 1.1, age: 0 });
    this.spawn(30, (i) => ({ kind: 'ember', x: x0 + 40 + (i / 30) * (x1 - x0) * 0.9, y: y0 + h * rnd(0.4, 0.9), vx: rnd(-20, 40), vy: rnd(-140, -50), g: 80, life: rnd(0.6, 1.2), r: rnd(1.5, 3), color: Math.random() < 0.5 ? '#ffd27a' : '#ff7a3a', delay: (i / 30) * 0.7 }));
  };

  // 守护符文：符文阵在城墙前亮起，凝成一个金色泡泡
  V.barrier = function (x, y0, y1) {
    this.fx.push({ kind: 'barrierForm', x, y0, y1, life: 1.3, age: 0 });
    this.spawn(26, () => {
      const a = rnd(0, TAU);
      const d = rnd(60, 120);
      const cx = x;
      const cy = (y0 + y1) / 2;
      return { kind: 'mote', x: cx + Math.cos(a) * d * 1.4, y: cy + Math.sin(a) * d * 2.6, vx: -Math.cos(a) * d * 1.1, vy: -Math.sin(a) * d * 2.0, life: 1.0, r: rnd(1.6, 3), color: '#ffe6a0', drag: 0.97 };
    });
  };
  V.barrierBreak = function (x, y0, y1) {
    this.fx.push({ kind: 'ring', x, y: (y0 + y1) / 2, r0: 40, r1: 240, color: '#ffe6a0', w: 4, life: 0.5, age: 0, flat: 2.2 });
    this.spawn(34, () => ({ kind: 'shard', x: x + rnd(-20, 40), y: rnd(y0, y1), vx: rnd(-60, 160), vy: rnd(-120, 80), g: 200, life: rnd(0.5, 1.0), r: rnd(3, 6), color: '#ffe6a0', rot: rnd(0, TAU), vr: rnd(-8, 8) }));
  };

  // 战旗：英雄身后升起一面旗
  V.bannerRaise = function (x, y) {
    this.shockwave(x, y, '#ff9a4a', 2);
    this.fx.push({ kind: 'flare', x, y: y - 60, r: 160, color: '#ff8a3a', life: 0.5, age: 0 });
  };

  // 地震符：地面裂开，裂缝发光向远处蔓延，一圈圈尘土
  V.quake = function (x0, x1, y0, y1) {
    const cracks = [];
    for (let c = 0; c < 6; c++) {
      const pts = [[x0 + rnd(0, 60), y0 + (y1 - y0) * rnd(0.25, 0.9)]];
      let x = pts[0][0];
      let y = pts[0][1];
      while (x < x1) {
        x += rnd(30, 60);
        y += rnd(-16, 16);
        pts.push([x, Math.max(y0 + 6, Math.min(y1 - 4, y))]);
      }
      cracks.push(pts);
    }
    this.fx.push({ kind: 'cracks', cracks, life: 1.6, age: 0 });
    for (let i = 0; i < 3; i++) this.fx.push({ kind: 'ring', x: x0 + 60 + i * 170, y: y1 - 30, r0: 10, r1: 150, color: '#e0c090', w: 5 - i, life: 0.6, age: -i * 0.15, flat: 0.28 });
    this.spawn(26, (i) => ({ kind: 'smoke', x: x0 + 40 + (i / 26) * (x1 - x0), y: rnd(y0 + 20, y1), vx: rnd(-10, 20), vy: rnd(-70, -25), life: rnd(0.9, 1.5), r: rnd(14, 26), color: '#8a7a66', delay: (i / 26) * 0.5 }));
    this.spawn(24, (i) => ({ kind: 'ember', x: x0 + 40 + (i / 24) * (x1 - x0), y: rnd(y0 + 30, y1 - 10), vx: rnd(-30, 30), vy: rnd(-220, -100), g: 600, life: rnd(0.5, 0.9), r: rnd(1.5, 3), color: '#ffcf8a', delay: (i / 24) * 0.5 }));
  };

  // 暴风雪卷轴：冰蓝色的光墙从左往右扫过全屏
  V.frostSweep = function (width, height) {
    this.fx.push({ kind: 'frostSweep', w: width, h: height, life: 1.2, age: 0 });
    this.spawn(60, (i) => ({ kind: 'mote', x: (i / 60) * width * 0.9, y: rnd(30, height - 30), vx: rnd(-10, 40), vy: rnd(10, 60), life: rnd(1.2, 2.2), r: rnd(1.6, 3.2), color: '#e8f8ff', delay: (i / 60) * 0.8 }));
    this.spawn(26, (i) => ({ kind: 'shard', x: (i / 26) * width * 0.9, y: rnd(80, height - 60), vx: rnd(-30, 30), vy: rnd(-60, 20), g: 90, life: rnd(0.8, 1.4), r: rnd(3, 6), color: '#dff4ff', rot: rnd(0, TAU), vr: rnd(-4, 4), delay: (i / 26) * 0.8 }));
  };

  // 洪水：一道大浪从城墙冲到屏幕右边
  V.flood = function (x0, x1, y0, y1) {
    this.fx.push({ kind: 'flood', x0, x1, y0, y1, life: 1.7, age: 0 });
  };

  // 圣光：一根光柱落在城墙上
  V.holyBeam = function (x, y0, y1) {
    this.fx.push({ kind: 'holyBeam', x, y0, y1, life: 1.8, age: 0 });
    this.spawn(28, () => ({ kind: 'leaf', x: x + rnd(-40, 50), y: rnd(y0, y1), vx: rnd(-20, 20), vy: rnd(-90, -30), life: rnd(1.0, 1.8), r: rnd(3, 5), color: Math.random() < 0.5 ? '#fff6d8' : '#ffe08a', rot: rnd(0, TAU), vr: rnd(-3, 3) }));
  };

  // 陨石：从天上斜着砸下来
  V.meteorFall = function (x, y, fall) {
    this.fx.push({ kind: 'meteor', x, y, life: fall, age: 0 });
  };
  V.meteorLand = function (x, y, radius) {
    this.boom(x, y, 1.15);
    this.fx.push({ kind: 'ring', x, y, r0: 10, r1: radius * 1.3, color: '#ff9a5a', w: 4, life: 0.4, age: 0, flat: 0.5 });
    this.fx.push({ kind: 'flare', x, y: y - 10, r: radius * 2, color: '#ff7a3a', life: 0.35, age: 0 });
  };

  // 时间静止：时钟般的刻度环从英雄身上向全屏扩散
  V.chronoRings = function (x, y, W, H) {
    this.fx.push({ kind: 'clock', x, y, W, H, life: 1.7, age: 0 });
  };

  // ---------------- 绘制 ----------------
  const DRAW = {
    fireWall(ctx, f, k) {
      const head = f.x0 + (f.x1 - f.x0) * easeOut(k * 1.5);
      const fade = k > 0.7 ? (1 - k) / 0.3 : 1;
      const t = f.age;
      ctx.globalCompositeOperation = 'lighter';
      const n = Math.floor((head - f.x0) / 14);
      for (let i = 0; i < n; i++) {
        const x = f.x0 + i * 14;
        const behind = (head - x) / (f.x1 - f.x0);
        const hh = f.h * (0.5 + hash(i, 1) * 0.5) * (0.45 + 0.55 * Math.sin(t * 14 + i * 1.7) * 0.5 + 0.275) * Math.max(0.25, 1 - behind * 1.2);
        const base = f.y0 + f.h * 0.92;
        const g = ctx.createLinearGradient(0, base, 0, base - hh);
        g.addColorStop(0, rgba('#ffe28a', 0.85 * fade));
        g.addColorStop(0.45, rgba('#ff8a3a', 0.7 * fade));
        g.addColorStop(1, rgba('#c0301a', 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - 8, base);
        ctx.quadraticCurveTo(x - 4 + Math.sin(t * 10 + i) * 4, base - hh * 0.6, x + Math.sin(t * 12 + i * 2) * 5, base - hh);
        ctx.quadraticCurveTo(x + 6, base - hh * 0.55, x + 8, base);
        ctx.closePath();
        ctx.fill();
      }
      this.glow(ctx, head, f.y0 + f.h * 0.6, f.h * 1.3, '#ff9a4a', 0.85 * fade);
      this.glow(ctx, head, f.y0 + f.h * 0.6, f.h * 0.6, '#fff0c0', 0.8 * fade);
    },
    barrierForm(ctx, f, k) {
      const cy = (f.y0 + f.y1) / 2;
      const rr = (f.y1 - f.y0) / 2 + 20;
      const open = easeOut(k / 0.4);
      const bub = easeInOut((k - 0.35) / 0.4);
      const fade = k > 0.75 ? (1 - k) / 0.25 : 1;
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(f.x, cy);
      ctx.save();
      ctx.scale(0.42, 1);
      // 符文阵：两圈转动的圆 + 六芒星
      ctx.strokeStyle = rgba('#ffe6a0', 0.9 * open * fade);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, rr * open, 0, TAU);
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, rr * open * 0.9, 0, TAU);
      ctx.stroke();
      ctx.rotate(f.age * 0.9);
      for (let i = 0; i < 24; i++) {
        const q = (i / 24) * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(q) * rr * open * 0.9, Math.sin(q) * rr * open * 0.9);
        ctx.lineTo(Math.cos(q) * rr * open * (i % 3 ? 0.96 : 1.04), Math.sin(q) * rr * open * (i % 3 ? 0.96 : 1.04));
        ctx.stroke();
      }
      ctx.rotate(-f.age * 1.8);
      for (const off of [0, Math.PI / 3]) {
        ctx.beginPath();
        for (let i = 0; i <= 3; i++) {
          const q = off + (i * TAU) / 3 - Math.PI / 2;
          ctx.lineTo(Math.cos(q) * rr * open * 0.75, Math.sin(q) * rr * open * 0.75);
        }
        ctx.stroke();
      }
      ctx.restore();
      // 凝成泡泡：一圈亮边向外扩一下
      if (bub > 0) {
        ctx.save();
        ctx.scale(0.5, 1);
        ctx.strokeStyle = rgba('#fff2c4', 0.8 * (1 - bub) * fade);
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, rr * (0.9 + bub * 0.25), 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
      this.glow(ctx, 0, 0, rr * 0.9, '#ffd27a', 0.4 * open * fade);
    },
    cracks(ctx, f, k) {
      const grow = easeOut(k * 2.2);
      const fade = k > 0.6 ? (1 - k) / 0.4 : 1;
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const pts of f.cracks) {
        const n = Math.max(2, Math.floor(pts.length * grow));
        for (const [w, col, a] of [[9, '#ff8a3a', 0.22], [4, '#ffb060', 0.7], [1.6, '#fff0c0', 1]]) {
          ctx.strokeStyle = rgba(col, a * fade);
          ctx.lineWidth = w;
          ctx.beginPath();
          for (let i = 0; i < n; i++) (i ? ctx.lineTo(pts[i][0], pts[i][1]) : ctx.moveTo(pts[i][0], pts[i][1]));
          ctx.stroke();
        }
        const [hx, hy] = pts[n - 1];
        this.glow(ctx, hx, hy, 36, '#ffb060', 0.6 * fade);
      }
    },
    frostSweep(ctx, f, k) {
      const p = easeInOut(k / 0.7);
      const x = -120 + (f.w + 240) * p;
      const fade = k > 0.65 ? Math.max(0, (1 - k) / 0.35) : 1;
      ctx.globalCompositeOperation = 'lighter';
      // 光墙
      const g = ctx.createLinearGradient(x - 160, 0, x + 40, 0);
      g.addColorStop(0, rgba('#9fdcff', 0));
      g.addColorStop(0.7, rgba('#bfe8ff', 0.5 * fade));
      g.addColorStop(0.95, rgba('#ffffff', 0.9 * fade));
      g.addColorStop(1, rgba('#ffffff', 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - 160, 0, 200, f.h);
      // 身后留下的冷光
      const tg = ctx.createLinearGradient(0, 0, x, 0);
      tg.addColorStop(0, rgba('#8fd0ff', 0.18 * fade));
      tg.addColorStop(1, rgba('#bfe8ff', 0.3 * fade));
      ctx.fillStyle = tg;
      ctx.fillRect(0, 0, Math.max(0, x - 100), f.h);
      // 光墙上的冰晶尖刺
      ctx.fillStyle = rgba('#ffffff', 0.7 * fade);
      for (let i = 0; i < 14; i++) {
        const y = (i + hash(i, 3)) * (f.h / 14);
        const len = 30 + hash(i, 5) * 40;
        ctx.beginPath();
        ctx.moveTo(x + 30, y);
        ctx.lineTo(x - len, y - 5);
        ctx.lineTo(x - len * 0.6, y + 5);
        ctx.closePath();
        ctx.fill();
      }
    },
    flood(ctx, f, k) {
      const p = easeInOut(k / 0.82);
      const front = f.x0 - 30 + (f.x1 - f.x0 + 160) * p;
      const fade = k > 0.82 ? Math.max(0, (1 - k) / 0.18) : 1;
      const t = f.age;
      const H = f.y1 - f.y0;
      // 水面：浪头后面一大片半透明的水
      ctx.globalCompositeOperation = 'source-over';
      const wg = ctx.createLinearGradient(f.x0, 0, front, 0);
      wg.addColorStop(0, rgba('#2a7ad0', 0));
      wg.addColorStop(0.5, rgba('#3a9ae8', 0.28 * fade));
      wg.addColorStop(1, rgba('#6ac8ff', 0.5 * fade));
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.moveTo(f.x0, f.y0);
      for (let y = f.y0; y <= f.y1; y += 8) ctx.lineTo(front + Math.sin(y * 0.05 + t * 9) * 16 - 20, y);
      ctx.lineTo(f.x0, f.y1);
      ctx.closePath();
      ctx.fill();
      // 水面反光的细线
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba('#e8f8ff', 0.4 * fade);
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 16; i++) {
        const y = f.y0 + hash(i, 7) * H;
        const xs = f.x0 + hash(i, 9) * (front - f.x0) * 0.8;
        ctx.beginPath();
        ctx.moveTo(xs, y);
        ctx.quadraticCurveTo(xs + 20, y - 4, xs + 48, y);
        ctx.stroke();
      }
      // 浪头：一道白色的浪峰 + 泡沫
      for (let y = f.y0; y <= f.y1; y += 6) {
        const wob = Math.sin(y * 0.05 + t * 9) * 16;
        const bx = front + wob;
        const g = ctx.createLinearGradient(bx - 56, 0, bx + 24, 0);
        g.addColorStop(0, rgba('#8fd8ff', 0));
        g.addColorStop(0.7, rgba('#d8f4ff', 0.75 * fade));
        g.addColorStop(1, rgba('#ffffff', 0));
        ctx.fillStyle = g;
        ctx.fillRect(bx - 56, y, 80, 7);
        if (hash(Math.floor(y), Math.floor(t * 12)) < 0.35) {
          ctx.fillStyle = rgba('#ffffff', 0.85 * fade);
          ctx.beginPath();
          ctx.arc(bx + 6 + hash(y, 2) * 14, y + 3, 2 + hash(y, 4) * 4, 0, TAU);
          ctx.fill();
        }
      }
      this.glow(ctx, front, (f.y0 + f.y1) / 2, 260, '#8fd8ff', 0.25 * fade);
      // 浪花向上溅起
      if (k < 0.85 && Math.random() < 0.9) {
        this.spawn(3, () => ({ kind: 'mote', x: front + rnd(-20, 20), y: rnd(f.y0, f.y1), vx: rnd(-40, 30), vy: rnd(-160, -60), life: rnd(0.4, 0.8), r: rnd(1.6, 3), color: '#e8f8ff', g: 220 }));
      }
    },
    holyBeam(ctx, f, k) {
      const open = easeOut(k / 0.25);
      const fade = k > 0.7 ? (1 - k) / 0.3 : 1;
      const mid = (f.y0 + f.y1) / 2;
      ctx.globalCompositeOperation = 'lighter';
      // 光柱：从屏幕顶部落到城墙
      const w = 44 * open * (1 + Math.sin(f.age * 9) * 0.06);
      const g = ctx.createLinearGradient(f.x - w, 0, f.x + w, 0);
      g.addColorStop(0, rgba('#ffe08a', 0));
      g.addColorStop(0.5, rgba('#fff6d8', 0.75 * fade));
      g.addColorStop(1, rgba('#ffe08a', 0));
      ctx.fillStyle = g;
      ctx.fillRect(f.x - w, 0, w * 2, f.y1 + 30);
      // 放射的光芒
      ctx.save();
      ctx.translate(f.x, mid);
      ctx.rotate(f.age * 0.5);
      for (let i = 0; i < 12; i++) {
        ctx.rotate(TAU / 12);
        const len = 220 * open * (0.7 + 0.3 * hash(i, 11));
        const lg = ctx.createLinearGradient(0, 0, len, 0);
        lg.addColorStop(0, rgba('#fff2c4', 0.5 * fade));
        lg.addColorStop(1, rgba('#ffd27a', 0));
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(len, 0);
        ctx.lineTo(0, 5);
        ctx.fill();
      }
      ctx.restore();
      this.glow(ctx, f.x, mid, 260 * open, '#ffe6a0', 0.55 * fade);
      this.glow(ctx, f.x, mid, 90 * open, '#ffffff', 0.7 * fade);
    },
    meteor(ctx, f, k) {
      const sx = f.x + 300;
      const sy = f.y - 560;
      const x = sx + (f.x - sx) * k;
      const y = sy + (f.y - sy) * k;
      ctx.globalCompositeOperation = 'lighter';
      const tx = x + (sx - f.x) * 0.22;
      const ty = y + (sy - f.y) * 0.22;
      const g = ctx.createLinearGradient(tx, ty, x, y);
      g.addColorStop(0, rgba('#ff5a2a', 0));
      g.addColorStop(0.6, rgba('#ff9a4a', 0.6));
      g.addColorStop(1, rgba('#fff0c0', 0.95));
      ctx.strokeStyle = g;
      ctx.lineCap = 'round';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = rgba('#ffffff', 0.9);
      ctx.stroke();
      this.glow(ctx, x, y, 44, '#ff8a3a', 0.9);
      this.glow(ctx, x, y, 16, '#ffffff', 0.9);
      // 落点预警：地面上一个收缩的红圈
      ctx.save();
      ctx.translate(f.x, f.y + 6);
      ctx.scale(1, 0.32);
      ctx.strokeStyle = rgba('#ff6a3a', 0.6 * k);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 60 * (1.2 - k * 0.5), 0, TAU);
      ctx.stroke();
      ctx.restore();
    },
    clock(ctx, f, k) {
      ctx.globalCompositeOperation = 'lighter';
      // 全屏冷紫色的一层
      const tint = Math.sin(Math.min(1, k * 1.2) * Math.PI) * 0.2;
      ctx.fillStyle = rgba('#7a60ff', tint);
      ctx.fillRect(0, 0, f.W, f.H);
      ctx.translate(f.x, f.y);
      ctx.scale(1, 0.62);
      for (let r = 0; r < 3; r++) {
        const kk = k * 1.5 - r * 0.18;
        if (kk <= 0 || kk >= 1) continue;
        const R = 40 + easeOut(kk) * 1100;
        const a = (1 - kk) * 0.9;
        ctx.strokeStyle = rgba('#c8b8ff', a);
        ctx.lineWidth = 5 - r;
        ctx.beginPath();
        ctx.arc(0, 0, R, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = rgba('#ffffff', a * 0.8);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.96, 0, TAU);
        ctx.stroke();
        // 刻度：每 15 度一格，整点更长，整圈缓慢转
        ctx.rotate(f.age * (0.4 + r * 0.2));
        for (let i = 0; i < 24; i++) {
          const q = (i / 24) * TAU;
          const l = i % 6 === 0 ? 26 : 12;
          ctx.beginPath();
          ctx.moveTo(Math.cos(q) * R, Math.sin(q) * R);
          ctx.lineTo(Math.cos(q) * (R - l), Math.sin(q) * (R - l));
          ctx.stroke();
        }
        ctx.rotate(-f.age * (0.4 + r * 0.2));
      }
      this.glow(ctx, 0, 0, 160 * (1 - k * 0.5), '#c8b8ff', 0.6 * (1 - k));
    },
  };

  const baseDrawFx = V.drawFx;
  V.drawFx = function (ctx, f, k) {
    const fn = DRAW[f.kind];
    if (!fn) return baseDrawFx.call(this, ctx, f, k);
    ctx.save();
    fn.call(this, ctx, f, k);
    ctx.restore();
  };

  // 暗夜关：新特效也会在黑幕上挖出光
  const baseLights = V.lights;
  V.lights = function () {
    const out = baseLights.call(this);
    for (const f of this.fx) {
      if (f.age < 0) continue;
      const k = 1 - f.age / f.life;
      if (f.kind === 'fireWall') out.push([f.x0 + (f.x1 - f.x0) * easeOut((f.age / f.life) * 1.5), f.y0 + f.h * 0.6, 180, k]);
      else if (f.kind === 'cracks') out.push([f.cracks[0][0] + 300, f.cracks[0][1], 360, k * 0.8]);
      else if (f.kind === 'holyBeam') out.push([f.x, (f.y0 + f.y1) / 2, 380, Math.min(1, k * 2)]);
      else if (f.kind === 'flood') out.push([f.x0 + (f.x1 - f.x0) * easeInOut(f.age / f.life / 0.82), (f.y0 + f.y1) / 2, 360, k * 0.7]);
      else if (f.kind === 'frostSweep') out.push([f.w * 0.5, f.h * 0.5, 700, k * 0.6]);
      else if (f.kind === 'clock') out.push([f.x, f.y, 600, k * 0.7]);
      else if (f.kind === 'meteor') {
        const p = f.age / f.life;
        out.push([f.x + 300 - 300 * p, f.y - 560 + 560 * p, 140, 0.9]);
      } else if (f.kind === 'barrierForm') out.push([f.x, (f.y0 + f.y1) / 2, 260, k * 0.7]);
    }
    return out;
  };
})((globalThis.TD = globalThis.TD || {}));
