// 技能与道具特效（设计书 60.4）：法阵、多层闪电、冲击波、火球、冰晶、治疗光柱、粒子
// 全部用加色混合和缓存好的光晕贴图（TD.art.drawGlow），不用 canvas 滤镜；粒子有上限
(function (TD) {
  'use strict';

  const TAU = Math.PI * 2;
  const CAP_MAX = 520; // 同屏粒子上限：超过 70% 时新粒子减半，到上限就不再生成
  let CAP = CAP_MAX;

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const rnd = (a, b) => a + Math.random() * (b - a);

  // 一条锯齿闪电的折点（从 (x0,y0) 到 (x1,y1)），带几条分叉
  function boltPath(x0, y0, x1, y1, jag, branches) {
    const main = [[x0, y0]];
    const n = Math.max(6, Math.round(Math.hypot(x1 - x0, y1 - y0) / 28));
    for (let i = 1; i < n; i++) {
      const u = i / n;
      main.push([x0 + (x1 - x0) * u + rnd(-jag, jag) * (1 - u * 0.6), y0 + (y1 - y0) * u + rnd(-jag, jag) * 0.3]);
    }
    main.push([x1, y1]);
    const forks = [];
    for (let b = 0; b < branches; b++) {
      const i = 2 + Math.floor(Math.random() * (n - 3));
      const [bx, by] = main[i];
      const len = rnd(50, 110);
      const dir = Math.random() < 0.5 ? -1 : 1;
      const pts = [[bx, by]];
      for (let k = 1; k <= 4; k++) pts.push([bx + dir * len * (k / 4) * 0.7 + rnd(-10, 10), by + len * (k / 4) + rnd(-8, 8)]);
      forks.push(pts);
    }
    return { main, forks };
  }

  function strokePath(ctx, pts) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }

  class Vfx {
    constructor() {
      this.parts = [];
      this.fx = [];
    }

    glow(ctx, x, y, r, color, a) {
      if (TD.art && TD.art.drawGlow) TD.art.drawGlow(ctx, x, y, r, color, a, true);
    }

    // 粒子：kind = spark（拖尾的亮线）| ember（会落下的火星）| mote（上升的光点）| leaf（光叶）| smoke（烟）| shard（冰晶碎片）
    spawn(n, make) {
      if (this.parts.length >= CAP) return;
      const k = this.parts.length > CAP * 0.7 ? Math.ceil(n / 2) : n;
      for (let i = 0; i < k; i++) this.parts.push(Object.assign({ age: 0, drag: 0.9, g: 0, rot: 0, vr: 0 }, make(i)));
    }

    // ---------------- 效果 ----------------
    // 金色法阵（箭雨）：在天上展开、旋转，向下洒光
    sigil(x, y, r, color, life) {
      this.fx.push({ kind: 'sigil', x, y, r, color: color || '#ffd27a', life: life || 2.2, age: 0 });
      this.spawn(24, () => ({ kind: 'mote', x: x + rnd(-r, r), y: y + rnd(-r * 0.2, r * 0.2), vx: rnd(-10, 10), vy: rnd(20, 70), life: rnd(0.8, 1.6), r: rnd(1.5, 3), color: '#ffe6a0' }));
    }

    // 箭雨的一支：从天上拖着光尾落下，落地溅起火花和小光圈
    rainArrow(x, y) {
      this.fx.push({ kind: 'streak', x, y, life: 0.16, age: 0 });
      this.fx.push({ kind: 'ring', x, y, r0: 4, r1: 26, color: '#ffe6a0', w: 2, life: 0.3, age: -0.14 });
      this.spawn(5, () => {
        const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05);
        const v = rnd(80, 200);
        return { kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 500, life: rnd(0.25, 0.45), r: 1.6, color: '#ffe0a0', delay: 0.14 };
      });
    }

    // 雷霆一击：主闪电 + 分叉 + 落点焦痕 + 迸射的电火花
    thunder(x, y, scale) {
      const k = scale || 1;
      const top = Math.max(-20, y - 520);
      this.fx.push({ kind: 'bolt', x, y, path: boltPath(x + rnd(-30, 30), top, x, y, 34 * k, 3), life: 0.42, age: 0, w: k, color: '#c9a0ff' });
      this.fx.push({ kind: 'bolt', x, y, path: boltPath(x + rnd(-40, 40), top, x, y, 40 * k, 1), life: 0.3, age: -0.06, w: k * 0.6, color: '#9fd0ff' });
      this.fx.push({ kind: 'scorch', x, y: y + 6, r: 46 * k, life: 1.4, age: 0 });
      this.fx.push({ kind: 'ring', x, y, r0: 10, r1: 110 * k, color: '#d8c0ff', w: 4, life: 0.45, age: 0 });
      this.fx.push({ kind: 'flare', x, y: y - 20, r: 170 * k, color: '#e8d8ff', life: 0.35, age: 0 });
      this.spawn(22, () => {
        const a = rnd(-Math.PI, 0);
        const v = rnd(160, 420) * k;
        return { kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 300, life: rnd(0.25, 0.55), r: 1.8, color: Math.random() < 0.5 ? '#e8d8ff' : '#9fd0ff' };
      });
    }

    // 小一号的闪电（雷鸣箭袋、连锁）
    zap(x, y) {
      this.fx.push({ kind: 'bolt', x, y, path: boltPath(x + rnd(-14, 14), y - 190, x, y, 14, 1), life: 0.22, age: 0, w: 0.45, color: '#c9a0ff' });
      this.spawn(6, () => {
        const a = rnd(-Math.PI, 0);
        const v = rnd(80, 200);
        return { kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 200, life: rnd(0.15, 0.3), r: 1.4, color: '#e8d8ff' };
      });
    }

    // 爆炸：火球 + 冲击波 + 火星 + 烟
    boom(x, y, scale) {
      const k = scale || 1;
      this.fx.push({ kind: 'fireball', x, y: y - 10, r: 50 * k, life: 0.6, age: 0 });
      this.fx.push({ kind: 'flare', x, y: y - 10, r: 120 * k, color: '#ffb060', life: 0.3, age: 0 });
      this.fx.push({ kind: 'ring', x, y: y - 6, r0: 12, r1: 95 * k, color: '#ffd8a0', w: 5, life: 0.4, age: 0, flat: 0.5 });
      this.fx.push({ kind: 'scorch', x, y: y + 4, r: 34 * k, life: 1.2, age: 0 });
      this.spawn(16, () => {
        const a = rnd(-Math.PI, 0);
        const v = rnd(120, 340) * k;
        return { kind: 'ember', x, y: y - 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 520, life: rnd(0.4, 0.8), r: rnd(1.5, 3), color: Math.random() < 0.5 ? '#ffd27a' : '#ff8a3d' };
      });
      // 烟在火球消散之后才冒出来，颜色偏暖、很淡，不会像一个个黑洞
      this.spawn(5, () => ({ kind: 'smoke', x: x + rnd(-22, 22), y: y - 24 + rnd(-10, 10), vx: rnd(-20, 20), vy: rnd(-45, -20), life: rnd(0.8, 1.2), r: rnd(10, 16) * k, color: '#7a6a66', delay: 0.25 }));
    }

    // 一圈金色冲击波（战鼓）
    shockwave(x, y, color, n) {
      for (let i = 0; i < (n || 3); i++) this.fx.push({ kind: 'ring', x, y, r0: 20, r1: 220, color: color || '#ffcf6a', w: 6 - i * 1.5, life: 0.6, age: -i * 0.14, flat: 0.55 });
      this.fx.push({ kind: 'flare', x, y: y - 30, r: 130, color: color || '#ffcf6a', life: 0.4, age: 0 });
      this.spawn(18, () => {
        const a = rnd(0, TAU);
        return { kind: 'mote', x: x + Math.cos(a) * rnd(10, 60), y: y - 20 + Math.sin(a) * 20, vx: Math.cos(a) * 40, vy: rnd(-90, -40), life: rnd(0.6, 1.1), r: rnd(1.5, 3), color: '#ffe6a0' };
      });
    }

    // 城墙修复：绿金色的光柱从城墙底部升起，飘出光叶
    heal(x, yTop, yBot, big) {
      const n = big ? 6 : 3;
      for (let i = 0; i < n; i++) {
        const y = yTop + ((i + 0.5) / n) * (yBot - yTop);
        this.fx.push({ kind: 'pillar', x: x + rnd(-14, 14), y, h: rnd(90, 150), life: 1.0, age: -i * 0.06 });
      }
      this.fx.push({ kind: 'wallGlow', x, y0: yTop, y1: yBot, life: big ? 1.1 : 0.8, age: 0 });
      this.spawn(big ? 22 : 10, () => ({ kind: 'leaf', x: x + rnd(-30, 30), y: rnd(yTop, yBot), vx: rnd(-30, 30), vy: rnd(-90, -40), life: rnd(0.9, 1.5), r: rnd(3, 5), color: Math.random() < 0.5 ? '#9df58a' : '#ffe08a', rot: rnd(0, TAU), vr: rnd(-4, 4) }));
      this.spawn(big ? 18 : 8, () => ({ kind: 'mote', x: x + rnd(-24, 24), y: rnd(yTop, yBot), vx: 0, vy: rnd(-80, -40), life: rnd(0.6, 1.2), r: rnd(1.5, 2.5), color: '#c8ffb0' }));
    }

    // 冰晶碎片向外迸开（冰冻领域、冰冻瓶）
    shards(x0, x1, y, n) {
      this.spawn(n || 24, () => {
        const x = rnd(x0, x1);
        const a = rnd(-Math.PI * 0.9, -Math.PI * 0.1);
        const v = rnd(60, 200);
        return { kind: 'shard', x, y: y + rnd(-20, 20), vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 380, life: rnd(0.4, 0.8), r: rnd(2.5, 5), color: '#dff4ff', rot: rnd(0, TAU), vr: rnd(-8, 8) };
      });
    }

    // 车道一下子结冰的闪光
    laneFlash(x0, x1, y0, h, color) {
      this.fx.push({ kind: 'laneFlash', x0, x1, y0, h, color: color || '#dff4ff', life: 0.45, age: 0 });
    }

    // 暗夜关：特效在黑幕上挖出的光（设计书 57.3）
    lights() {
      const out = [];
      for (const f of this.fx) {
        if (f.age < 0) continue;
        const k = 1 - f.age / f.life;
        if (f.kind === 'bolt') out.push([f.x, f.y, 200, k]);
        else if (f.kind === 'fireball') out.push([f.x, f.y, f.r * 3.2, k]);
        else if (f.kind === 'flare') out.push([f.x, f.y, f.r * 1.2, k * 0.8]);
        else if (f.kind === 'pillar') out.push([f.x, f.y, 90, k * 0.7]);
        else if (f.kind === 'sigil') out.push([f.x, f.y + 40, f.r * 1.4, Math.min(1, k * 2) * 0.6]);
      }
      return out;
    }

    // ---------------- 每帧更新 + 绘制 ----------------
    draw(ctx, dt) {
      const keep = [];
      for (const f of this.fx) {
        f.age += dt;
        if (f.age > f.life) continue;
        keep.push(f);
        if (f.age < 0) continue;
        this.drawFx(ctx, f, f.age / f.life);
      }
      this.fx = keep;
      // 粒子
      const kp = [];
      for (const p of this.parts) {
        if (p.delay > 0) {
          p.delay -= dt;
          kp.push(p);
          continue;
        }
        p.age += dt;
        if (p.age > p.life) continue;
        kp.push(p);
        const dr = Math.pow(p.drag, dt * 10);
        p.vx *= dr;
        p.vy = p.vy * dr + p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        this.drawPart(ctx, p, p.age / p.life);
      }
      this.parts = kp;
    }

    drawPart(ctx, p, k) {
      const a = 1 - k;
      if (p.kind === 'smoke') {
        ctx.save();
        ctx.globalAlpha = 0.16 * a * Math.min(1, p.age * 6);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 + k * 1.4), 0, TAU);
        ctx.fill();
        ctx.restore();
        return;
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (p.kind === 'spark') {
        ctx.strokeStyle = rgba(p.color, a);
        ctx.lineWidth = p.r;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
        ctx.stroke();
      } else if (p.kind === 'leaf') {
        this.glow(ctx, p.x, p.y, p.r * 3, p.color, 0.4 * a);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = rgba(p.color, 0.85 * a);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r, p.r * 0.45, 0, 0, TAU);
        ctx.fill();
      } else if (p.kind === 'shard') {
        this.glow(ctx, p.x, p.y, p.r * 3, '#9fd8ff', 0.4 * a);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = rgba(p.color, 0.9 * a);
        ctx.beginPath();
        ctx.moveTo(0, -p.r);
        ctx.lineTo(p.r * 0.45, 0);
        ctx.lineTo(0, p.r);
        ctx.lineTo(-p.r * 0.45, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        // ember / mote：发光的圆点
        this.glow(ctx, p.x, p.y, p.r * 4, p.color, 0.55 * a);
        ctx.fillStyle = rgba('#ffffff', 0.9 * a);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.6, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    drawFx(ctx, f, k) {
      const a = 1 - k;
      ctx.save();
      switch (f.kind) {
        case 'sigil': {
          // 展开（前 15%）→ 停留旋转 → 淡出（最后 20%）
          const open = Math.min(1, k / 0.15);
          const fade = k > 0.8 ? (1 - k) / 0.2 : 1;
          const r = f.r * (0.6 + 0.4 * open);
          ctx.translate(f.x, f.y);
          ctx.globalCompositeOperation = 'lighter';
          // 向下洒的光
          const lg = ctx.createLinearGradient(0, 0, 0, 260);
          lg.addColorStop(0, rgba(f.color, 0.22 * fade * open));
          lg.addColorStop(1, rgba(f.color, 0));
          ctx.fillStyle = lg;
          ctx.beginPath();
          ctx.moveTo(-r, 0);
          ctx.lineTo(r, 0);
          ctx.lineTo(r * 1.3, 260);
          ctx.lineTo(-r * 1.3, 260);
          ctx.closePath();
          ctx.fill();
          ctx.scale(1, 0.32);
          this.glow(ctx, 0, 0, r * 1.5, f.color, 0.35 * fade * open);
          ctx.strokeStyle = rgba(f.color, 0.9 * fade * open);
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, TAU);
          ctx.stroke();
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.78, 0, TAU);
          ctx.stroke();
          // 旋转的符文刻度和内部的星形
          ctx.rotate(f.age * 1.2);
          for (let i = 0; i < 16; i++) {
            const q = (i / 16) * TAU;
            ctx.beginPath();
            ctx.moveTo(Math.cos(q) * r * 0.8, Math.sin(q) * r * 0.8);
            ctx.lineTo(Math.cos(q) * r * (i % 4 ? 0.9 : 0.98), Math.sin(q) * r * (i % 4 ? 0.9 : 0.98));
            ctx.stroke();
          }
          ctx.rotate(-f.age * 2.2);
          ctx.beginPath();
          for (let i = 0; i <= 5; i++) {
            const q = (i * 2 * TAU) / 5 - Math.PI / 2;
            ctx.lineTo(Math.cos(q) * r * 0.7, Math.sin(q) * r * 0.7);
          }
          ctx.stroke();
          break;
        }
        case 'streak': {
          // 箭雨：一道从天而降的光
          const y0 = f.y - 220 * (1 - k);
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createLinearGradient(f.x + 20, y0 - 90, f.x, y0);
          g.addColorStop(0, 'rgba(255,230,160,0)');
          g.addColorStop(1, 'rgba(255,240,200,0.95)');
          ctx.strokeStyle = g;
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(f.x + 20, y0 - 90);
          ctx.lineTo(f.x, y0);
          ctx.stroke();
          this.glow(ctx, f.x, y0, 14, '#ffe6a0', 0.8);
          break;
        }
        case 'bolt': {
          ctx.globalCompositeOperation = 'lighter';
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          const flick = 0.75 + Math.random() * 0.25;
          const w = f.w;
          for (const [lw, col, al] of [[16 * w, f.color, 0.22], [7 * w, f.color, 0.6], [2.6 * w, '#ffffff', 1]]) {
            ctx.strokeStyle = rgba(col, al * a * flick);
            ctx.lineWidth = lw;
            strokePath(ctx, f.path.main);
            ctx.lineWidth = lw * 0.55;
            for (const fk of f.path.forks) strokePath(ctx, fk);
          }
          this.glow(ctx, f.x, f.y, 60 * w, '#ffffff', 0.7 * a);
          break;
        }
        case 'scorch': {
          // 落点的焦痕：深色椭圆，边缘一圈慢慢冷却的余光
          ctx.globalAlpha = Math.min(1, a * 1.5) * 0.55;
          ctx.fillStyle = '#120a14';
          ctx.beginPath();
          ctx.ellipse(f.x, f.y, f.r, f.r * 0.32, 0, 0, TAU);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = rgba('#ff9a5a', 0.5 * a * a);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(f.x, f.y, f.r * 0.8, f.r * 0.24, 0, 0, TAU);
          ctx.stroke();
          break;
        }
        case 'ring': {
          const r = f.r0 + (f.r1 - f.r0) * (1 - Math.pow(1 - k, 2.2));
          ctx.globalCompositeOperation = 'lighter';
          ctx.translate(f.x, f.y);
          if (f.flat) ctx.scale(1, f.flat);
          ctx.strokeStyle = rgba(f.color, 0.25 * a);
          ctx.lineWidth = (f.w || 3) * 3;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, TAU);
          ctx.stroke();
          ctx.strokeStyle = rgba(f.color, 0.9 * a);
          ctx.lineWidth = f.w || 3;
          ctx.stroke();
          break;
        }
        case 'flare':
          ctx.globalCompositeOperation = 'lighter';
          this.glow(ctx, f.x, f.y, f.r * (0.6 + k * 0.6), f.color, 0.75 * a);
          break;
        case 'fireball': {
          const r = f.r * (0.5 + Math.pow(k, 0.5) * 0.9);
          ctx.globalCompositeOperation = 'lighter';
          this.glow(ctx, f.x, f.y, r * 2.4, '#ff8a3d', 0.7 * a);
          const g = ctx.createRadialGradient(f.x, f.y - r * 0.15, 0, f.x, f.y, r);
          g.addColorStop(0, rgba('#ffffff', a));
          g.addColorStop(0.3, rgba('#ffe28a', 0.95 * a));
          g.addColorStop(0.7, rgba('#ff8a3d', 0.7 * a));
          g.addColorStop(1, rgba('#c0301a', 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(f.x, f.y, r, 0, TAU);
          ctx.fill();
          break;
        }
        case 'pillar': {
          // 治疗光柱：从下往上长出来再淡掉
          const grow = Math.min(1, k / 0.3);
          const h = f.h * grow;
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createLinearGradient(0, f.y + 30, 0, f.y + 30 - h);
          g.addColorStop(0, rgba('#c8ffb0', 0.6 * a));
          g.addColorStop(1, rgba('#ffe08a', 0));
          ctx.fillStyle = g;
          ctx.fillRect(f.x - 13, f.y + 30 - h, 26, h);
          ctx.fillStyle = rgba('#ffffff', 0.5 * a);
          ctx.fillRect(f.x - 2, f.y + 30 - h * 0.9, 4, h * 0.9);
          this.glow(ctx, f.x, f.y + 20, 60, '#9df58a', 0.7 * a);
          this.glow(ctx, f.x, f.y + 30 - h, 30, '#ffe08a', 0.6 * a);
          break;
        }
        case 'wallGlow': {
          // 修城墙时整面墙的砖缝亮一下
          const pulse = Math.sin(k * Math.PI);
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createLinearGradient(f.x - 40, 0, f.x + 40, 0);
          g.addColorStop(0, rgba('#9df58a', 0));
          g.addColorStop(0.5, rgba('#c8ffb0', 0.35 * pulse));
          g.addColorStop(1, rgba('#9df58a', 0));
          ctx.fillStyle = g;
          ctx.fillRect(f.x - 40, f.y0, 80, f.y1 - f.y0);
          break;
        }
        case 'laneFlash': {
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createLinearGradient(f.x0, 0, f.x1, 0);
          g.addColorStop(0, rgba(f.color, 0.55 * a));
          g.addColorStop(1, rgba(f.color, 0.1 * a));
          ctx.fillStyle = g;
          ctx.fillRect(f.x0, f.y0, f.x1 - f.x0, f.h);
          break;
        }
      }
      ctx.restore();
    }
  }

  TD.Vfx = Vfx;
  Vfx.setCap = (n) => {
    CAP = n;
  };
})((globalThis.TD = globalThis.TD || {}));
