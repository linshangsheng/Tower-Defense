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
  const C_W = () => (TD.config && TD.config.width) || 1280;
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
  // 油罐：车道上泼开一片油，亮晶晶的油膜（持续 dur 秒，和减速时间一致）
  V.oilPuddle = function (x0, x1, y0, h, dur) {
    this.fx.push({ kind: 'oilPuddle', x0, x1, y0, h, life: dur, age: 0 });
    this.spawn(16, (i) => ({ kind: 'spark', x: x0 + 30 + (i / 16) * (x1 - x0 - 60), y: y0 + h * 0.5 + rnd(-8, 8), vx: rnd(-20, 20), vy: rnd(-160, -60), g: 360, life: rnd(0.4, 0.8), r: rnd(1.6, 3), color: '#d8a850', drag: 0.97, delay: (i / 16) * 0.3 }));
  };
  // 烟雾弹：整个战场飘过一层灰烟，慢慢散去
  V.smokeVeil = function (x0, x1, y0, y1, dur) {
    this.fx.push({ kind: 'smokeVeil', x0, x1, y0, y1, life: dur, age: 0, seed: Math.random() * 50 });
  };
  // 怪物倒下时按章节主题多溅一点"这个地方的东西"（设计书 131）：草原的叶子、沙漠的沙尘、沼泽的萤火、雪原的冰晶、
  // 熔岩的火星和焦烟、云端的白色光点、海边的水珠、月影的蓝光、熔炉的金属火花、虚空的紫色光点
  V.deathFlavor = function (art, x, y, size, boss) {
    const k = boss ? 2.2 : 1;
    const n = (v) => Math.round(v * 1.5 * k);
    const fan = (speed, up) => {
      const a = rnd(0, TAU);
      const v = rnd(0.35, 1) * speed * 1.7;
      return [Math.cos(a) * v, Math.sin(a) * v - up];
    };
    const puff = (color, cnt) =>
      this.spawn(n(cnt), () => ({ kind: 'smoke', x: x + rnd(-size * 0.4, size * 0.4), y: y + rnd(-size * 0.3, size * 0.2), vx: rnd(-26, 26), vy: rnd(-40, -10), life: rnd(0.5, 0.9), r: rnd(12, 20) * (boss ? 1.6 : 1), color }));
    const bits = (kind, color, cnt, speed, up, g, life, r) =>
      this.spawn(n(cnt), () => {
        const [vx, vy] = fan(speed, up);
        return { kind, x, y, vx, vy, g, life: rnd(life * 0.7, life * 1.2), r: rnd(r * 0.7, r * 1.3) * 1.5, color: Array.isArray(color) ? color[Math.floor(Math.random() * color.length)] : color, rot: rnd(0, TAU), vr: rnd(-7, 7), drag: 0.93 };
      });
    switch (art) {
      case 'meadow':
        bits('leaf', ['#a6e86a', '#7fd05a', '#d8f09a'], 8, 150, 70, 120, 0.9, 5);
        break;
      case 'desert':
        puff('#d8b878', 6);
        bits('mote', ['#f0d79a', '#e8c070'], 5, 110, 40, 60, 0.7, 1.8);
        break;
      case 'swamp':
        puff('#7ab088', 4);
        bits('mote', ['#9cffb0', '#c4ffd0'], 6, 50, 60, -30, 1.1, 2.2);
        break;
      case 'snow':
        bits('shard', ['#dff4ff', '#bfe4ff', '#ffffff'], 8, 190, 90, 380, 0.7, 4);
        puff('#e8f6ff', 3);
        break;
      case 'lava':
        bits('ember', ['#ff9a3a', '#ffd070', '#ff6a2a'], 9, 170, 110, 320, 0.8, 2.2);
        puff('#3a2a2c', 3);
        break;
      case 'cloud':
        bits('mote', ['#ffffff', '#ffd0e4', '#d8ecff'], 8, 80, 90, -60, 1.0, 2.2);
        break;
      case 'sea':
        bits('spark', ['#9fe6ff', '#dff8ff'], 9, 190, 120, 520, 0.55, 1.8);
        bits('mote', ['#c8f2ff'], 4, 40, 40, -80, 1.0, 2.4);
        break;
      case 'moon':
        bits('mote', ['#b8c8ff', '#e0e8ff'], 8, 90, 70, -50, 1.1, 2.2);
        break;
      case 'forge':
        bits('spark', ['#ffd070', '#ff9a3a', '#fff2c0'], 10, 260, 120, 640, 0.5, 1.8);
        puff('#2e2426', 3);
        break;
      case 'void':
        bits('mote', ['#d8b8ff', '#a47cff', '#ffffff'], 9, 120, 80, -40, 1.0, 2.2);
        break;
      default:
        break;
    }
  };
  // 回声低语：一行淡紫色的斜体字从下方缓缓浮起、淡出（delay 秒后才出现，让开场横幅先过去）
  V.whisper = function (str, delay) {
    this.fx.push({ kind: 'whisper', str: TD.i18n ? TD.i18n.t(str) : str, life: 5.2, age: -(delay || 0) });
  };
  // Boss 登场：屏幕正中亮出名牌（大 Boss 更大更红），地面震一下
  V.bossCard = function (name, major, color, quote) {
    this.fx.push({ kind: 'bossCard', str: name, quote: quote || '', major: !!major, color: color || '#ff5a3a', life: major ? 2.6 : 1.9, age: 0 });
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

  // v1.05 道具特效：石刺、烟雾 / 毒雾、渔网
  V.spikeRow = function (x0, x1, y, n, color) {
    for (let i = 0; i < n; i++) {
      const x = x0 + ((x1 - x0) * (i + 0.5)) / n + rnd(-8, 8);
      this.fx.push({ kind: 'rockSpike', x, y: y + rnd(-10, 12), h: rnd(34, 74), w: rnd(8, 14), lean: rnd(-0.25, 0.2), color: color || '#a89478', life: 1.1, age: -(i % 5) * 0.04 });
    }
    this.spawn(Math.min(24, n * 2), () => ({ kind: 'smoke', x: rnd(x0, x1), y: y + rnd(-4, 14), vx: rnd(-14, 14), vy: rnd(-26, -8), life: 0.9, r: rnd(6, 11), color: '#8a7a68' }));
  };
  V.fogCloud = function (x0, x1, y0, y1, dur, color, count) {
    const blobs = [];
    for (let i = 0; i < (count || 20); i++) blobs.push({ x: rnd(x0, x1), y: rnd(y0, y1), r: rnd(40, 90), ph: rnd(0, TAU), sp: rnd(0.3, 0.9) });
    this.fx.push({ kind: 'fogCloud', blobs, color, life: dur, age: 0 });
    this.spawn(Math.min(16, count || 16), () => ({ kind: 'mote', x: rnd(x0, x1), y: rnd(y0, y1), vx: rnd(-8, 8), vy: rnd(-30, -10), life: rnd(0.8, 1.6), r: rnd(1.6, 3), color, drag: 0.98 }));
  };
  V.netCast = function (x0, x1, y0, h) {
    this.fx.push({ kind: 'net', x0, x1, y0, h, life: 0.9, age: 0 });
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
    rockSpike(ctx, f, k) {
      // 石刺：快速顶出（前 20%）→ 停留 → 碎掉淡出
      const grow = 1 - Math.pow(1 - Math.min(1, k / 0.2), 3);
      const fade = k > 0.7 ? (1 - k) / 0.3 : 1;
      const h = f.h * grow;
      ctx.translate(f.x, f.y);
      ctx.rotate(f.lean);
      ctx.globalAlpha = fade;
      const g = ctx.createLinearGradient(-f.w, 0, f.w, 0);
      g.addColorStop(0, rgba(f.color, 0.75));
      g.addColorStop(0.5, '#e8dcc8');
      g.addColorStop(1, rgba(f.color, 0.9));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-f.w * 0.65, 0);
      ctx.lineTo(-f.w * 0.1, -h * 0.6);
      ctx.lineTo(f.w * 0.05, -h);
      ctx.lineTo(f.w * 0.4, -h * 0.5);
      ctx.lineTo(f.w * 0.65, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(40,30,20,0.6)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    },
    fogCloud(ctx, f, k) {
      const fade = Math.min(1, f.age / 0.4) * (k > 0.75 ? (1 - k) / 0.25 : 1);
      ctx.globalCompositeOperation = 'lighter';
      for (const b of f.blobs) {
        const x = b.x + Math.sin(f.age * b.sp + b.ph) * 18;
        const y = b.y + Math.cos(f.age * b.sp * 0.8 + b.ph) * 8;
        this.glow(ctx, x, y, b.r, f.color, 0.14 * fade);
      }
    },
    net(ctx, f, k) {
      const fade = k < 0.6 ? 1 : (1 - k) / 0.4;
      const drop = easeOut(k / 0.25);
      ctx.strokeStyle = rgba('#d8b878', 0.9 * fade);
      ctx.lineWidth = 2.4;
      const n = 14;
      const cols = Math.floor((f.x1 - f.x0) / 36);
      for (let i = 0; i <= cols; i++) {
        const x = f.x0 + (i / cols) * (f.x1 - f.x0);
        ctx.beginPath();
        ctx.moveTo(x, f.y0 - 30 * (1 - drop));
        ctx.lineTo(x, f.y0 + f.h * drop);
        ctx.stroke();
      }
      for (let j = 0; j <= 4; j++) {
        const y = f.y0 + (j / 4) * f.h * drop;
        ctx.beginPath();
        ctx.moveTo(f.x0, y);
        ctx.lineTo(f.x1, y);
        ctx.stroke();
      }
      ctx.fillStyle = rgba('#8a6a3a', 0.9 * fade);
      for (let i = 0; i <= cols; i++) for (let j = 0; j <= 4; j++) ctx.fillRect(f.x0 + (i / cols) * (f.x1 - f.x0) - 2, f.y0 + (j / 4) * f.h * drop - 2, 4, 4);
    },
    oilPuddle(ctx, f, k) {
      const rest = f.life - f.age;
      const fade = Math.min(1, f.age / 0.4) * (rest < 0.8 ? Math.max(0, rest / 0.8) : 1);
      const w = f.x1 - f.x0;
      const cy = f.y0 + f.h * 0.62;
      // 油膜：几块互相叠着的深褐色椭圆，边缘比中间亮
      for (let i = 0; i < 9; i++) {
        const cx = f.x0 + 30 + hash(i, 1) * (w - 60);
        const rx = 46 + hash(i, 2) * 70;
        const ry = (f.h * 0.28 + hash(i, 3) * 10) * Math.min(1, f.age / 0.35 + 0.15);
        const y = cy + (hash(i, 4) - 0.5) * f.h * 0.35;
        const g = ctx.createRadialGradient(cx, y, 2, cx, y, rx);
        g.addColorStop(0, rgba('#3a2610', 0.52 * fade));
        g.addColorStop(0.7, rgba('#6a4818', 0.42 * fade));
        g.addColorStop(1, rgba('#a8782a', 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(cx, y, rx, ry, 0, 0, TAU);
        ctx.fill();
      }
      // 油面上的彩色反光：一条条缓缓滑动的细弧
      ctx.globalCompositeOperation = 'lighter';
      const cols = ['#ffd27a', '#8fe0c8', '#d8a0ff', '#ffb070'];
      for (let i = 0; i < 18; i++) {
        const cx = f.x0 + 30 + ((hash(i, 7) * (w - 60) + f.age * (8 + i * 1.5)) % (w - 60));
        const y = cy + (hash(i, 8) - 0.5) * f.h * 0.34;
        ctx.strokeStyle = rgba(cols[i % 4], (0.45 + 0.35 * Math.sin(f.age * 2.4 + i)) * fade);
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(cx, y, 10 + hash(i, 9) * 22, 2.6 + hash(i, 10) * 3, 0, Math.PI * 1.05, Math.PI * 1.95);
        ctx.stroke();
      }
      // 偶尔冒一个油泡
      for (let i = 0; i < 5; i++) {
        const ph = (f.age * 0.7 + hash(i, 11)) % 1;
        const cx = f.x0 + 40 + hash(i, 12) * (w - 80);
        ctx.fillStyle = rgba('#ffe6a8', 0.5 * Math.sin(ph * Math.PI) * fade);
        ctx.beginPath();
        ctx.arc(cx, cy - ph * 14, 2 + hash(i, 13) * 2.4, 0, TAU);
        ctx.fill();
      }
    },
    smokeVeil(ctx, f, k) {
      const rest = f.life - f.age;
      const fade = Math.min(1, f.age / 0.5) * (rest < 1.2 ? Math.max(0, rest / 1.2) : 1);
      const w = f.x1 - f.x0;
      const h = f.y1 - f.y0;
      for (let i = 0; i < 26; i++) {
        const sp = 14 + hash(i, 1) * 22;
        const x = f.x0 + (((hash(i, 2) * w - f.age * sp) % w) + w) % w;
        const y = f.y0 + hash(i, 3) * h + Math.sin(f.age * 0.9 + i) * 10;
        const r = 54 + hash(i, 4) * 60 + f.age * 6;
        const g = ctx.createRadialGradient(x, y, 4, x, y, r);
        g.addColorStop(0, rgba('#d4d8e0', 0.52 * fade));
        g.addColorStop(0.6, rgba('#b4bac6', 0.3 * fade));
        g.addColorStop(1, rgba('#aab0bc', 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
      }
    },
    whisper(ctx, f, k) {
      const t = f.age;
      const a = Math.min(1, t / 1.2) * (f.life - t < 1.4 ? Math.max(0, (f.life - t) / 1.4) : 1);
      const W = C_W();
      const y = 372 - t * 5;
      ctx.textAlign = 'center';
      ctx.font = 'italic 24px Georgia, "Trebuchet MS", serif';
      ctx.globalAlpha = a * 0.9;
      ctx.shadowColor = 'rgba(190,140,255,0.9)';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#efe4ff';
      ctx.fillText(f.str, W / 2, y, W - 160);
      ctx.shadowBlur = 0;
    },
    bossCard(ctx, f, k) {
      const t = f.age;
      const inK = easeOut(t / 0.35);
      const outK = f.life - t < 0.5 ? Math.max(0, (f.life - t) / 0.5) : 1;
      const a = Math.min(inK, outK);
      const W = C_W();
      const cy = f.major ? 170 : 150;
      const bh = (f.major ? 112 : 74) + (f.quote ? 26 : 0);
      // 暗红色的横带，从两边合拢
      const spread = (f.major ? 1 : 0.8) * W * 0.5 * inK;
      const g = ctx.createLinearGradient(W / 2 - spread, 0, W / 2 + spread, 0);
      g.addColorStop(0, rgba('#1a0408', 0));
      g.addColorStop(0.18, rgba('#1a0408', 0.78 * a));
      g.addColorStop(0.82, rgba('#1a0408', 0.78 * a));
      g.addColorStop(1, rgba('#1a0408', 0));
      ctx.fillStyle = g;
      ctx.fillRect(W / 2 - spread, cy - bh / 2, spread * 2, bh);
      // 上下两条亮线 + 中间的小菱形
      ctx.globalCompositeOperation = 'lighter';
      for (const dy of [-bh / 2, bh / 2]) {
        const lg = ctx.createLinearGradient(W / 2 - spread, 0, W / 2 + spread, 0);
        lg.addColorStop(0, rgba(f.color, 0));
        lg.addColorStop(0.5, rgba(f.color, 0.9 * a));
        lg.addColorStop(1, rgba(f.color, 0));
        ctx.fillStyle = lg;
        ctx.fillRect(W / 2 - spread, cy + dy - 1.5, spread * 2, 3);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = a;
      ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
      ctx.fillStyle = rgba(f.color, 0.95);
      ctx.fillText(f.major ? '—  B O S S  —' : '—  M I N I   B O S S  —', W / 2, cy - bh * (f.quote ? 0.36 : 0.3));
      // 名字：字从大到正常缩进来，带红色辉光
      const sc = 1 + (1 - inK) * 0.8;
      ctx.save();
      ctx.translate(W / 2, cy + (f.quote ? -10 : bh * 0.08));
      ctx.scale(sc, sc);
      ctx.font = `bold ${f.major ? 48 : 34}px "Trebuchet MS", sans-serif`;
      ctx.shadowColor = rgba(f.color, 0.95);
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#fff2e0';
      ctx.fillText(f.str, 0, 0);
      ctx.restore();
      ctx.shadowBlur = 0;
      if (f.quote) {
        ctx.font = 'italic 17px "Trebuchet MS", sans-serif';
        ctx.fillStyle = rgba('#ffe8d0', 0.88 * Math.min(1, Math.max(0, (t - 0.3) / 0.4)));
        ctx.fillText('「' + f.quote + '」', W / 2, cy + bh * 0.34, 820);
      }
      ctx.textBaseline = 'alphabetic';
      // 登场瞬间的一圈冲击光
      if (t < 0.5) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgba(f.color, (1 - t / 0.5) * 0.7);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(W / 2, cy, 40 + t * 900, 12 + t * 120, 0, 0, TAU);
        ctx.stroke();
      }
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
