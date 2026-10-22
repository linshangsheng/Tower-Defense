// 新技能的特效（设计书 103）：贯穿光矢、引力漩涡、烈焰之墙、飞行的火球、追踪的灵箭、剑气、霜爆
// 是 vfx.js 里 TD.Vfx 的扩展（和 vfx2.js 一样）：新增方法 + 新的 fx 种类；全部加色混合，不用 canvas 滤镜
(function (TD) {
  'use strict';

  const V = TD.Vfx.prototype;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 2.6);
  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const hash = (i, s) => {
    const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };

  // ---------------- 触发 ----------------
  // 贯穿光矢：从英雄身边射向车道尽头；ys 是要画的车道中心线（第一条是主车道）
  V.lance = function (x0, x1, ys) {
    this.fx.push({ kind: 'lance', x0, x1, ys, life: 0.75, age: 0 });
    this.fx.push({ kind: 'flare', x: x0 + 10, y: ys[0], r: 130, color: '#fff0b0', life: 0.3, age: 0 });
    this.spawn(34, (i) => {
      const x = x0 + 60 + (i / 34) * (x1 - x0) * 0.9;
      return { kind: 'spark', x, y: ys[0] + rnd(-14, 14), vx: rnd(-30, 60), vy: rnd(-120, 40), g: 120, life: rnd(0.3, 0.6), r: rnd(1.4, 2.6), color: Math.random() < 0.5 ? '#fff2c0' : '#ffd23f', drag: 0.96, delay: (i / 34) * 0.18 };
    });
  };
  V.lanceHit = function (x, y) {
    this.fx.push({ kind: 'star', x, y, r: 46, color: '#fff2c0', rays: 8, life: 0.4, age: 0, rot: rnd(0, TAU) });
    this.fx.push({ kind: 'ring', x, y, r0: 6, r1: 46, color: '#ffd23f', w: 3, life: 0.35, age: 0 });
    this.spawn(8, () => {
      const a = rnd(0, TAU);
      const v = rnd(80, 220);
      return { kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, g: 400, life: rnd(0.25, 0.5), r: rnd(1.4, 2.4), color: '#fff2c0', drag: 0.95 };
    });
  };
  // 引力漩涡
  V.vortexOpen = function (x, y, r, dur) {
    this.fx.push({ kind: 'vortex', x, y, r, life: dur, age: 0 });
    this.fx.push({ kind: 'flare', x, y, r: r * 1.1, color: '#b98cff', life: 0.35, age: 0 });
  };
  V.vortexBurst = function (x, y, r, soft) {
    this.fx.push({ kind: 'ring', x, y, r0: r * 0.2, r1: r * (soft ? 1.0 : 1.5), color: '#d8b8ff', w: soft ? 3 : 6, life: soft ? 0.35 : 0.5, age: 0, flat: 0.55 });
    if (soft) return;
    this.fx.push({ kind: 'flare', x, y, r: r * 1.8, color: '#e8d0ff', life: 0.4, age: 0 });
    this.fx.push({ kind: 'ring', x, y, r0: r * 0.1, r1: r * 1.0, color: '#ffffff', w: 3, life: 0.3, age: 0.05, flat: 0.55 });
    this.fx.push({ kind: 'star', x, y, r: r * 0.9, color: '#e8d0ff', rays: 10, life: 0.5, age: 0, rot: 0 });
    this.spawn(26, () => {
      const a = rnd(0, TAU);
      const v = rnd(120, 360);
      return { kind: 'mote', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6, g: 0, life: rnd(0.4, 0.8), r: rnd(1.6, 3.2), color: Math.random() < 0.5 ? '#d8b8ff' : '#ffffff', drag: 0.93 };
    });
  };
  // 烈焰之墙：整条车道上持续燃烧 dur 秒
  V.flameLane = function (x0, x1, y0, h, dur) {
    this.fx.push({ kind: 'flameLane', x0, x1, y0, h, life: dur, age: 0 });
    this.fx.push({ kind: 'laneFlash', x0, x1, y0, h, color: '#ffb060', life: 0.5, age: 0 });
  };
  V.flamePulse = function (x0, x1, y0, h) {
    this.spawn(5, () => ({ kind: 'ember', x: rnd(x0 + 40, x1), y: y0 + h * rnd(0.5, 0.95), vx: rnd(-10, 30), vy: rnd(-140, -60), g: 60, life: rnd(0.5, 1.0), r: rnd(1.4, 2.6), color: Math.random() < 0.5 ? '#ffd27a' : '#ff7a3a' }));
  };
  // 飞行的火球 / 灵箭 / 剑气
  V.comet = function (x0, y0, x1, y1, life, color, size) {
    this.fx.push({ kind: 'comet', x0, y0, x1, y1, life, age: 0, color: color || '#ff8a2a', size: size || 14 });
  };
  V.wisp = function (x0, y0, x1, y1, life, color, i) {
    this.fx.push({ kind: 'wisp', x0, y0, x1, y1, life, age: 0, color: color || '#7fe0ff', side: i % 2 ? 1 : -1, bend: 50 + i * 16 });
  };
  V.crescent = function (x0, x1, y, dur) {
    this.fx.push({ kind: 'crescent', x0, x1, y, life: dur, age: 0 });
  };
  V.crescentHit = function (x, y) {
    this.slashes(x, y, '#cfeaff', 3, 42);
    this.fx.push({ kind: 'star', x, y, r: 30, color: '#e8f6ff', rays: 6, life: 0.3, age: 0, rot: rnd(0, TAU) });
  };
  // 霜爆：落点炸开一圈冰刺和寒气
  V.frostNova = function (x, y, r) {
    this.fx.push({ kind: 'ring', x, y, r0: 10, r1: r, color: '#bfeeff', w: 5, life: 0.45, age: 0, flat: 0.6 });
    this.fx.push({ kind: 'ring', x, y, r0: 6, r1: r * 0.7, color: '#ffffff', w: 2, life: 0.3, age: 0.03, flat: 0.6 });
    this.fx.push({ kind: 'flare', x, y: y - 10, r: r * 1.2, color: '#9fe0ff', life: 0.35, age: 0 });
    this.fx.push({ kind: 'runeRing', x, y: y + 4, r: r * 0.8, color: '#9fe0ff', life: 0.6, age: 0 });
    this.iceSpikes(x - r * 0.8, x + r * 0.8, y + 4, 8);
    this.shards(x - r * 0.6, x + r * 0.6, y, 10);
  };
  V.fireballBoom = function (x, y, r) {
    this.boom(x, y, Math.max(0.8, r / 95));
    this.fx.push({ kind: 'ring', x, y, r0: 10, r1: r, color: '#ffb060', w: 4, life: 0.4, age: 0, flat: 0.6 });
  };
  V.spiritHit = function (x, y) {
    this.fx.push({ kind: 'star', x, y, r: 34, color: '#bff0ff', rays: 6, life: 0.32, age: 0, rot: rnd(0, TAU) });
    this.fx.push({ kind: 'ring', x, y, r0: 4, r1: 30, color: '#7fe0ff', w: 2.4, life: 0.3, age: 0 });
  };

  // ---------------- 绘制 ----------------
  const DRAW = {
    lance(ctx, f, k) {
      const head = f.x0 + (f.x1 - f.x0) * easeOut(k / 0.2);
      const fade = k < 0.25 ? 1 : 1 - (k - 0.25) / 0.75;
      ctx.globalCompositeOperation = 'lighter';
      f.ys.forEach((y, n) => {
        const a = (n ? 0.55 : 1) * fade;
        const w = (n ? 7 : 13) * (0.6 + 0.4 * fade);
        const g = ctx.createLinearGradient(f.x0, 0, head, 0);
        g.addColorStop(0, rgba('#ffb83a', 0));
        g.addColorStop(0.25, rgba('#ffd23f', 0.55 * a));
        g.addColorStop(1, rgba('#fff6d0', 0.95 * a));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(f.x0, y - 1);
        ctx.lineTo(head - 18, y - w);
        ctx.lineTo(head + 14, y);
        ctx.lineTo(head - 18, y + w);
        ctx.lineTo(f.x0, y + 1);
        ctx.closePath();
        ctx.fill();
        // 白热的核心
        ctx.strokeStyle = rgba('#ffffff', 0.95 * a);
        ctx.lineWidth = n ? 2 : 3.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(f.x0 + (head - f.x0) * 0.1, y);
        ctx.lineTo(head, y);
        ctx.stroke();
        // 两侧的气流线
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 4; i++) {
          const o = (i - 1.5) * w * 0.9;
          const l = (head - f.x0) * (0.4 + hash(i, n) * 0.5);
          ctx.strokeStyle = rgba('#ffe6a0', 0.5 * a);
          ctx.beginPath();
          ctx.moveTo(head - l, y + o);
          ctx.lineTo(head - l * 0.3, y + o * 1.3);
          ctx.stroke();
        }
        this.glow(ctx, head, y, n ? 36 : 70, '#fff0b0', 0.9 * a);
      });
    },
    vortex(ctx, f, k) {
      const open = easeOut(f.age / 0.25);
      const rest = f.life - f.age;
      const fade = rest < 0.3 ? Math.max(0, rest / 0.3) : 1;
      const r = f.r * (0.4 + 0.6 * open);
      const t = f.age;
      ctx.translate(f.x, f.y);
      ctx.scale(1, 0.62);
      ctx.globalCompositeOperation = 'lighter';
      this.glow(ctx, 0, 0, r * 1.15, '#7a4cff', 0.45 * fade * open);
      // 外圈
      ctx.strokeStyle = rgba('#d8b8ff', 0.8 * fade * open);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.stroke();
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.7, 0, TAU);
      ctx.stroke();
      // 四条旋臂：光点沿螺旋向中心流
      for (let arm = 0; arm < 4; arm++) {
        for (let i = 0; i < 26; i++) {
          const u = (i / 26 + t * 0.9) % 1;
          const rr = r * (1 - u);
          const a = (arm * TAU) / 4 + u * 4.8 + t * 3.2;
          const x = Math.cos(a) * rr;
          const y = Math.sin(a) * rr;
          const al = Math.sin(u * Math.PI) * 0.95 * fade * open;
          this.glow(ctx, x, y, 4 + (1 - u) * 6, arm % 2 ? '#e8d0ff' : '#a47cff', al);
        }
      }
      // 中心的黑洞
      ctx.fillStyle = rgba('#05020c', 0.9 * fade * open);
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.16, r * 0.16, 0, 0, TAU);
      ctx.fill();
      this.glow(ctx, 0, 0, r * 0.3, '#ffffff', 0.5 * fade * open);
    },
    flameLane(ctx, f, k) {
      const rest = f.life - f.age;
      const fade = Math.min(1, f.age / 0.25) * (rest < 0.5 ? Math.max(0, rest / 0.5) : 1);
      const t = f.age;
      ctx.globalCompositeOperation = 'lighter';
      const base = f.y0 + f.h * 0.92;
      const n = Math.floor((f.x1 - f.x0) / 13);
      for (let i = 0; i < n; i++) {
        const x = f.x0 + 40 + i * 13;
        if (x > f.x1) break;
        const hh = f.h * (0.55 + hash(i, 2) * 0.55) * (0.65 + 0.35 * Math.sin(t * 13 + i * 1.9));
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
      const mid = (f.x0 + f.x1) / 2;
      this.glow(ctx, mid, f.y0 + f.h * 0.6, (f.x1 - f.x0) * 0.45, '#ff7a2a', 0.18 * fade);
    },
    comet(ctx, f, k) {
      const p = k * k * 0.45 + k * 0.55;
      const x = f.x0 + (f.x1 - f.x0) * p;
      const y = f.y0 + (f.y1 - f.y0) * p - Math.sin(p * Math.PI) * 26;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 10; i >= 1; i--) {
        const q = Math.max(0, p - i * 0.035);
        const tx = f.x0 + (f.x1 - f.x0) * q;
        const ty = f.y0 + (f.y1 - f.y0) * q - Math.sin(q * Math.PI) * 26;
        this.glow(ctx, tx, ty, f.size * (1 - i / 12) * 1.5, f.color, 0.5 * (1 - i / 11));
      }
      this.glow(ctx, x, y, f.size * 2.4, f.color, 0.8);
      this.glow(ctx, x, y, f.size * 1.1, '#fff2c0', 1);
    },
    wisp(ctx, f, k) {
      const e = easeOut(k * 1.05);
      const cx = (f.x0 + f.x1) / 2 + 0;
      const cy = Math.min(f.y0, f.y1) - f.bend * (f.side > 0 ? 0.6 : 1.0);
      const bz = (t) => {
        const u = 1 - t;
        return [u * u * f.x0 + 2 * u * t * (cx + f.side * 30) + t * t * f.x1, u * u * f.y0 + 2 * u * t * cy + t * t * f.y1];
      };
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      const t0 = Math.max(0, e - 0.4);
      ctx.beginPath();
      for (let i = 0; i <= 14; i++) {
        const [x, y] = bz(t0 + ((e - t0) * i) / 14);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.strokeStyle = rgba(f.color, 0.45);
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.strokeStyle = rgba('#ffffff', 0.9);
      ctx.lineWidth = 2;
      ctx.stroke();
      const [hx, hy] = bz(e);
      this.glow(ctx, hx, hy, 20, f.color, 0.9);
      this.glow(ctx, hx, hy, 9, '#ffffff', 1);
    },
    crescent(ctx, f, k) {
      const fade = k > 0.85 ? (1 - k) / 0.15 : 1;
      const x = f.x0 + (f.x1 - f.x0) * k;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 5; i >= 0; i--) {
        const cx = x - i * 22;
        const al = (1 - i / 6) * fade;
        ctx.save();
        ctx.translate(cx, f.y);
        ctx.fillStyle = rgba(i ? '#7fd0ff' : '#f2fbff', 0.55 * al);
        ctx.beginPath();
        ctx.moveTo(-12, -34);
        ctx.quadraticCurveTo(30, -22, 30, 0);
        ctx.quadraticCurveTo(30, 22, -12, 34);
        ctx.quadraticCurveTo(10, 14, 10, 0);
        ctx.quadraticCurveTo(10, -14, -12, -34);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      this.glow(ctx, x + 14, f.y, 54, '#bfe8ff', 0.5 * fade);
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
      if (f.kind === 'lance') out.push([f.x0 + (f.x1 - f.x0) * easeOut(f.age / f.life / 0.2), f.ys[0], 220, Math.min(1, k * 1.6)]);
      else if (f.kind === 'vortex') out.push([f.x, f.y, f.r * 1.3, Math.min(1, k * 3)]);
      else if (f.kind === 'flameLane') out.push([(f.x0 + f.x1) / 2, f.y0 + f.h * 0.6, (f.x1 - f.x0) * 0.5, Math.min(1, k * 3)]);
      else if (f.kind === 'comet') {
        const p = (f.age / f.life) * (f.age / f.life) * 0.45 + (f.age / f.life) * 0.55;
        out.push([f.x0 + (f.x1 - f.x0) * p, f.y0 + (f.y1 - f.y0) * p, 120, 0.9]);
      } else if (f.kind === 'crescent') out.push([f.x0 + (f.x1 - f.x0) * (1 - k), f.y, 140, 0.8]);
    }
    return out;
  };
})((globalThis.TD = globalThis.TD || {}));
