// 光影手绘场景（设计书第 54 章）：景深分层、主光源、光束、漂浮光点、景深雾、前景剪影、暗角
// 静态的层全部预渲染成画布，每帧只做少量 drawImage；不使用 canvas filter（模糊用"小画布画、放大显示"）
(function (TD) {
  'use strict';

  const C = TD.config;
  const A = (TD.art = {});
  // 开关（性能排查 / 低画质用）
  A.opts = { lit: true, motes: true, front: true, shafts: true, glow: true };
  const W = C.width;
  const H = C.height;

  // 可复现的伪随机（同一章节每次画出来一样）
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  A.rgba = rgba;

  // ---------- 光晕贴图（加色混合用） ----------
  const glowCache = {};
  // 白色核心 + 指定颜色外圈 + 透明边缘
  A.glow = function (color, core) {
    const key = color + (core ? 'c' : '');
    if (glowCache[key]) return glowCache[key];
    const c = canvas(64, 64);
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    if (core) grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(core ? 0.18 : 0, rgba(color, 0.9));
    grd.addColorStop(0.45, rgba(color, 0.32));
    grd.addColorStop(1, rgba(color, 0));
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return (glowCache[key] = c);
  };

  // 在 (x, y) 画一个半径 r 的加色光晕
  A.drawGlow = function (ctx, x, y, r, color, alpha, core) {
    const prevOp = ctx.globalCompositeOperation;
    const prevA = ctx.globalAlpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = prevA * (alpha === undefined ? 1 : alpha);
    ctx.drawImage(A.glow(color, core), x - r, y - r, r * 2, r * 2);
    ctx.globalCompositeOperation = prevOp;
    ctx.globalAlpha = prevA;
  };

  // ---------- 章节光影设定（设计书 54.4） ----------
  const PALETTES = {
    meadow: {
      sky: ['#0f2a44', '#2d6577', '#f0ad68'],
      sun: { x: 1060, y: 40, r: 330, color: '#ffd28a' },
      far: ['#2c5d6c', '#356b62'],
      haze: '#f6c58a',
      ground: ['#123238', '#18402a', '#10301d'],
      lane: '#ffd98e',
      laneEdge: '#a8c86a',
      tuft: '#163824',
      tuftTip: '#bde07a',
      flowers: ['#ffe9a0', '#9fe8ff', '#ffb0d0'],
      fore: '#08160f',
      rim: '#ffcf7a',
      mote: '#ffe7a8',
      fog: '#9fd0d8',
      shafts: '#ffe0a0',
      window: '#ffcf6a',
      shape: 'forest',
    },
    desert: {
      sky: ['#2a1f4a', '#9a5a6a', '#ffc98a'],
      sun: { x: 1000, y: 70, r: 360, color: '#ffd59a' },
      far: ['#7a4a52', '#9a5e4a'],
      haze: '#ffc88a',
      ground: ['#4a3036', '#5e3f2c', '#4a3020'],
      lane: '#ffe2a6',
      laneEdge: '#e0b070',
      tuft: '#2e1c14',
      tuftTip: '#ffcf80',
      flowers: ['#ffe6a0', '#ffd27a'],
      fore: '#140c0a',
      rim: '#ffcc88',
      mote: '#ffe2a8',
      fog: '#f0b88a',
      shafts: '#ffe2b0',
      window: '#ffcf6a',
      shape: 'dunes',
    },
    swamp: {
      sky: ['#070a1c', '#22285a', '#5f6a9a'],
      sun: { x: 1080, y: 46, r: 260, color: '#d8ecff' },
      far: ['#2a3150', '#323c58'],
      haze: '#9fb0d8',
      ground: ['#0f1824', '#13241e', '#0c1812'],
      lane: '#c8f0e8',
      laneEdge: '#6fa89a',
      tuft: '#08120e',
      tuftTip: '#8fd8b8',
      flowers: ['#7affd0', '#b08aff', '#7ad8ff'],
      fore: '#04080a',
      rim: '#bfe0ff',
      mote: '#9fffe0',
      fog: '#8aa0c8',
      shafts: '#cfe4ff',
      window: '#9fffd0',
      shape: 'deadtrees',
    },
    snow: {
      sky: ['#040c22', '#10305a', '#3a6a8a'],
      sun: { x: 300, y: 30, r: 240, color: '#bfffe8' },
      far: ['#2a4668', '#3a5a80'],
      haze: '#a8d8f0',
      ground: ['#16263e', '#1c3352', '#15253c'],
      lane: '#cfe8ff',
      laneAlpha: 0.5,
      laneEdge: '#9fd0ee',
      tuft: '#0c1a2a',
      tuftTip: '#dff4ff',
      flowers: ['#bff4ff', '#9fe8ff', '#d8f0ff'],
      fore: '#040a14',
      rim: '#bfeaff',
      mote: '#e0f8ff',
      fog: '#a8d0f0',
      shafts: null,
      window: '#ffd27a',
      shape: 'mountains',
    },
    lava: {
      sky: ['#06030a', '#24080e', '#6a1a12'],
      sun: { x: 820, y: 96, r: 380, color: '#ff7a3a' },
      far: ['#2a1216', '#341418'],
      haze: '#ff6a2a',
      ground: ['#24141a', '#2e1820', '#1c0f12'],
      lane: '#ffb47a',
      laneEdge: '#ff7a3d',
      tuft: '#08040a',
      tuftTip: '#ff8a4a',
      flowers: ['#ff8a3d', '#ffcf6a', '#ff5a3a'],
      fore: '#040204',
      rim: '#ff9a5a',
      mote: '#ffb060',
      fog: '#7a2a2a',
      shafts: null,
      window: '#ff9a4a',
      shape: 'volcano',
    },
    cloud: {
      sky: ['#2e3a7a', '#b080b0', '#ffd8c4'],
      sun: { x: 1020, y: 60, r: 340, color: '#ffe2c8' },
      far: ['#7a76b0', '#9a90c8'],
      haze: '#ffd8e0',
      ground: ['#4a5690', '#5c68a8', '#4a5490'],
      lane: '#ffe8f0',
      laneAlpha: 0.55,
      laneEdge: '#ffd8e8',
      tuft: '#3c467c',
      tuftTip: '#ffffff',
      flowers: ['#ffb0d0', '#ffe9a0', '#a0e0ff'],
      fore: '#1a1c3a',
      rim: '#ffe0c8',
      mote: '#ffffff',
      fog: '#d8c8f0',
      shafts: '#fff0e0',
      window: '#ffe6a0',
      shape: 'clouds',
    },
    sea: {
      sky: ['#10203e', '#3a5a8a', '#ff9a7a'],
      sun: { x: 960, y: 84, r: 360, color: '#ffc08a' },
      far: ['#2a4a6a', '#3a5a78'],
      haze: '#ffb08a',
      ground: ['#2a2a3a', '#3e3540', '#2a2430'],
      lane: '#ffdcb6',
      laneEdge: '#e0a080',
      tuft: '#18161e',
      tuftTip: '#ffc890',
      flowers: ['#9fe8ff', '#ffb0d0', '#ffe0a0'],
      fore: '#08080e',
      rim: '#ffb890',
      mote: '#ffe0c8',
      fog: '#c8a0b0',
      shafts: '#ffd8b0',
      window: '#ffd27a',
      shape: 'sea',
    },
    // 第八至十章（设计书 75）
    moon: {
      sky: ['#05060f', '#1c2050', '#6a6ab0'],
      sun: { x: 300, y: 56, r: 300, color: '#cfd8ff' },
      far: ['#1a1e3c', '#242a4a'],
      haze: '#8a90d0',
      ground: ['#0c1020', '#121830', '#0a0e1c'],
      lane: '#b8c4f0',
      laneEdge: '#6a78b8',
      tuft: '#080a16',
      tuftTip: '#9aa8e8',
      flowers: ['#b8a0ff', '#8ad0ff', '#e0e8ff'],
      fore: '#03040a',
      rim: '#bcc8ff',
      mote: '#c8d0ff',
      fog: '#7a82c0',
      shafts: '#c8d4ff',
      window: '#ffe08a',
      shape: 'castle',
    },
    forge: {
      sky: ['#0a0406', '#2a1018', '#8a3a22'],
      sun: { x: 700, y: 110, r: 400, color: '#ff8a3a' },
      far: ['#1c0e12', '#2a1418'],
      haze: '#ff7a3a',
      ground: ['#241618', '#30201c', '#1c1214'],
      lane: '#ffc08a',
      laneEdge: '#c06a3a',
      tuft: '#0c0608',
      tuftTip: '#ff9a5a',
      flowers: ['#ff8a3d', '#ffd070', '#ff5a3a'],
      fore: '#050204',
      rim: '#ffa060',
      mote: '#ffb878',
      fog: '#8a3a2a',
      shafts: null,
      window: '#ffa04a',
      shape: 'forge',
    },
    void: {
      sky: ['#07031a', '#2a1060', '#a050c8'],
      sun: { x: 860, y: 70, r: 380, color: '#e0a0ff' },
      far: ['#2a1a58', '#3a2470'],
      haze: '#c080f0',
      ground: ['#1c1240', '#281a56', '#1a1038'],
      lane: '#e8c8ff',
      laneAlpha: 0.55,
      laneEdge: '#b080e8',
      tuft: '#140c30',
      tuftTip: '#e0b0ff',
      flowers: ['#ff9ae8', '#9ae0ff', '#f0e0ff'],
      fore: '#08041a',
      rim: '#e0b0ff',
      mote: '#f0d0ff',
      fog: '#9a6ad8',
      shafts: '#e8c8ff',
      window: '#ffe6a0',
      shape: 'shards',
    },
  };
  A.palettes = PALETTES;

  A.paletteFor = function (theme) {
    if (theme && theme.art && PALETTES[theme.art]) return PALETTES[theme.art];
    return null;
  };

  // ---------- 远景形状 ----------
  // 一排圆冠树林的剪影：用很多重叠的椭圆拼出起伏的树冠线
  function treeLine(g, r, base, height, color, step) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(-50, H);
    g.lineTo(-50, base);
    for (let x = -50; x <= W + 60; x += step) {
      const h = height * (0.6 + r() * 0.5);
      g.moveTo(x + step, base);
      g.ellipse(x + step / 2, base - h * 0.55, step * (0.6 + r() * 0.3), h * 0.6, 0, 0, Math.PI * 2);
    }
    g.fill();
    g.fillRect(-50, base - 4, W + 120, H);
  }

  // ---------- 场景预渲染 ----------
  // 返回 { back, shafts, front }：back 画在最底下，shafts 每帧加色叠加，front 盖在所有战斗物体之上
  A.paintScene = function (theme, lanes) {
    const P = A.paletteFor(theme);
    if (!P) return null;
    const r = rng(theme.sky.length * 977 + lanes * 31);
    const top = C.fieldTop;
    const bottom = C.fieldBottom;
    const laneH = (bottom - top) / lanes;

    // ===== 1. 天空 + 主光源 =====
    const back = canvas(W, H);
    const g = back.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, top + 30);
    sky.addColorStop(0, P.sky[0]);
    sky.addColorStop(0.55, P.sky[1]);
    sky.addColorStop(1, P.sky[2]);
    g.fillStyle = sky;
    g.fillRect(0, 0, W, top + 40);
    // 太阳的大光晕
    g.globalCompositeOperation = 'lighter';
    const sun = g.createRadialGradient(P.sun.x, P.sun.y, 0, P.sun.x, P.sun.y, P.sun.r);
    sun.addColorStop(0, rgba(P.sun.color, 0.95));
    sun.addColorStop(0.08, rgba(P.sun.color, 0.6));
    sun.addColorStop(0.35, rgba(P.sun.color, 0.18));
    sun.addColorStop(1, rgba(P.sun.color, 0));
    g.fillStyle = sun;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';

    // ===== 2. 远景（1/4 分辨率画，再放大 → 柔和的模糊） =====
    const q = 4;
    const far = canvas(W / q, H / q);
    const fg = far.getContext('2d');
    fg.scale(1 / q, 1 / q);
    if (P.shape === 'forest') {
      treeLine(fg, r, top - 22, 70, P.far[0], 46);
      // 远处树林的受光一侧更亮（太阳在右上）
      fg.globalCompositeOperation = 'lighter';
      const lit = fg.createLinearGradient(W * 0.45, 0, W, 0);
      lit.addColorStop(0, 'rgba(0,0,0,0)');
      lit.addColorStop(1, rgba(P.haze, 0.25));
      fg.fillStyle = lit;
      fg.fillRect(0, 0, W, top + 10);
      fg.globalCompositeOperation = 'source-over';
      treeLine(fg, r, top + 2, 54, P.far[1], 38);
    }
    else if (P.shape === 'dunes') {
      // 远处的金字塔和沙丘
      fg.fillStyle = P.far[0];
      for (const [px, ph] of [[460, 70], [580, 48], [980, 62]]) {
        fg.beginPath();
        fg.moveTo(px - ph * 1.1, top);
        fg.lineTo(px, top - ph);
        fg.lineTo(px + ph * 1.1, top);
        fg.fill();
      }
      for (const [col, base, amp, f] of [[P.far[0], top - 12, 16, 0.006], [P.far[1], top + 6, 12, 0.01]]) {
        fg.fillStyle = col;
        fg.beginPath();
        fg.moveTo(0, H);
        for (let x = 0; x <= W; x += 20) fg.lineTo(x, base - Math.sin(x * f + base) * amp - Math.sin(x * f * 2.7) * amp * 0.4);
        fg.lineTo(W, H);
        fg.fill();
      }
    } else if (P.shape === 'deadtrees') {
      // 月光下的枯树林
      for (const [col, base, n] of [[P.far[0], top - 4, 9], [P.far[1], top + 8, 6]]) {
        fg.strokeStyle = col;
        fg.fillStyle = col;
        for (let k = 0; k < n; k++) {
          const tx = (k + r()) * (W / n);
          const th = 50 + r() * 50;
          fg.lineWidth = 7;
          fg.beginPath();
          fg.moveTo(tx, base);
          fg.lineTo(tx + (r() - 0.5) * 10, base - th);
          fg.stroke();
          fg.lineWidth = 3.5;
          for (let b = 0; b < 4; b++) {
            const by = base - th * (0.45 + b * 0.15);
            const dir = b % 2 ? 1 : -1;
            fg.beginPath();
            fg.moveTo(tx, by);
            fg.quadraticCurveTo(tx + dir * 14, by - 8, tx + dir * (20 + r() * 16), by - 18 - r() * 10);
            fg.stroke();
          }
        }
        fg.fillRect(0, base - 2, W, H);
      }
    } else if (P.shape === 'mountains') {
      // 极光
      fg.globalCompositeOperation = 'lighter';
      for (const [col, y0, amp] of [['#3affb0', 18, 16], ['#5ad0ff', 34, 12], ['#b07aff', 10, 10]]) {
        const ag = fg.createLinearGradient(0, y0 - 20, 0, y0 + 40);
        ag.addColorStop(0, rgba(col, 0));
        ag.addColorStop(0.4, rgba(col, 0.35));
        ag.addColorStop(1, rgba(col, 0));
        fg.fillStyle = ag;
        fg.beginPath();
        fg.moveTo(0, y0 + 40);
        for (let x = 0; x <= W; x += 30) fg.lineTo(x, y0 + Math.sin(x * 0.008 + y0) * amp);
        for (let x = W; x >= 0; x -= 30) fg.lineTo(x, y0 + 40 + Math.sin(x * 0.006) * amp);
        fg.fill();
      }
      fg.globalCompositeOperation = 'source-over';
      // 雪山：受光的一侧发亮
      for (const [col, base, hmax] of [[P.far[0], top - 4, 90], [P.far[1], top + 8, 60]]) {
        let x = -40;
        while (x < W + 40) {
          const w = 120 + r() * 160;
          const ph = hmax * (0.55 + r() * 0.45);
          fg.fillStyle = col;
          fg.beginPath();
          fg.moveTo(x, base);
          fg.lineTo(x + w / 2, base - ph);
          fg.lineTo(x + w, base);
          fg.fill();
          fg.fillStyle = 'rgba(230,246,255,0.75)';
          fg.beginPath();
          fg.moveTo(x + w / 2 - ph * 0.22, base - ph * 0.72);
          fg.lineTo(x + w / 2, base - ph);
          fg.lineTo(x + w / 2 + ph * 0.25, base - ph * 0.7);
          fg.lineTo(x + w / 2 + ph * 0.05, base - ph * 0.62);
          fg.fill();
          x += w * 0.7;
        }
        fg.fillRect(0, base - 2, W, H);
      }
    } else if (P.shape === 'volcano') {
      // 火山与岩柱，火山口发光
      fg.fillStyle = P.far[0];
      fg.beginPath();
      fg.moveTo(600, top);
      fg.lineTo(780, top - 90);
      fg.lineTo(860, top - 90);
      fg.lineTo(1040, top);
      fg.fill();
      for (let k = 0; k < 12; k++) {
        const sx = r() * W;
        const sh = 30 + r() * 60;
        fg.beginPath();
        fg.moveTo(sx - 12, top + 4);
        fg.lineTo(sx - 4, top - sh);
        fg.lineTo(sx + 6, top - sh * 0.8);
        fg.lineTo(sx + 14, top + 4);
        fg.fill();
      }
      fg.fillStyle = P.far[1];
      fg.fillRect(0, top - 6, W, H);
      fg.globalCompositeOperation = 'lighter';
      const crater = fg.createRadialGradient(820, top - 90, 4, 820, top - 90, 90);
      crater.addColorStop(0, 'rgba(255,190,90,0.9)');
      crater.addColorStop(1, 'rgba(255,90,30,0)');
      fg.fillStyle = crater;
      fg.fillRect(700, top - 180, 240, 200);
      fg.globalCompositeOperation = 'source-over';
    } else if (P.shape === 'clouds') {
      // 云海和浮空岛
      for (const [col, base, rad] of [[P.far[0], top - 18, 46], [P.far[1], top + 4, 36]]) {
        fg.fillStyle = col;
        for (let x = -40; x < W + 60; x += rad * 1.1) {
          fg.beginPath();
          fg.ellipse(x, base - r() * 16, rad * (0.9 + r() * 0.5), rad * 0.6, 0, 0, Math.PI * 2);
          fg.fill();
        }
        fg.fillRect(0, base, W, H);
      }
      for (const [ix, iy, iw] of [[400, top - 60, 70], [1120, top - 74, 50]]) {
        fg.fillStyle = '#5a4a6a';
        fg.beginPath();
        fg.moveTo(ix - iw, iy);
        fg.lineTo(ix + iw, iy);
        fg.lineTo(ix + iw * 0.2, iy + 34);
        fg.lineTo(ix - iw * 0.3, iy + 26);
        fg.fill();
        fg.fillStyle = '#7ab88a';
        fg.fillRect(ix - iw - 4, iy - 8, iw * 2 + 8, 10);
      }
    } else if (P.shape === 'sea') {
      // 海平面、太阳的倒影、灯塔
      fg.fillStyle = P.far[0];
      fg.fillRect(0, top - 40, W, H);
      fg.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 26; k++) {
        const yy = top - 36 + k * 1.8;
        const ww = 30 + k * 6 + r() * 30;
        fg.fillStyle = rgba(P.sun.color, 0.35 - k * 0.011);
        fg.fillRect(P.sun.x - ww / 2 + (r() - 0.5) * 20, yy, ww, 1.2);
      }
      fg.globalCompositeOperation = 'source-over';
      fg.fillStyle = '#1a2a3a';
      fg.beginPath();
      fg.moveTo(1040, top - 30);
      fg.lineTo(1048, top - 96);
      fg.lineTo(1064, top - 96);
      fg.lineTo(1072, top - 30);
      fg.fill();
      fg.fillRect(1044, top - 112, 24, 16);
      fg.fillStyle = P.far[1];
      fg.fillRect(0, top - 6, W, H);
    } else if (P.shape === 'castle') {
      // 月夜下的古堡：一排带垛口的塔楼和尖顶
      fg.fillStyle = P.far[0];
      fg.fillRect(0, top - 8, W, H);
      for (let k = 0; k < 9; k++) {
        const cx = 80 + k * 140 + r() * 40;
        const tw = 26 + r() * 22;
        const th = 50 + r() * 70;
        fg.fillRect(cx - tw, top - th, tw * 2, th + 10);
        for (let m = -tw; m < tw - 4; m += 10) fg.fillRect(cx + m, top - th - 8, 6, 8);
        if (k % 2 === 0) {
          fg.beginPath();
          fg.moveTo(cx - tw - 4, top - th - 8);
          fg.lineTo(cx, top - th - 44);
          fg.lineTo(cx + tw + 4, top - th - 8);
          fg.fill();
        }
      }
      fg.fillStyle = P.far[1];
      fg.fillRect(0, top - 6, W, H);
    } else if (P.shape === 'forge') {
      // 熔炉：一排烟囱，冒着暗红的烟，炉口发光
      fg.fillStyle = P.far[0];
      fg.fillRect(0, top - 14, W, H);
      for (let k = 0; k < 8; k++) {
        const cx = 60 + k * 150 + r() * 50;
        const ch = 60 + r() * 80;
        fg.fillRect(cx - 14, top - ch, 28, ch + 10);
        fg.fillRect(cx - 18, top - ch - 6, 36, 8);
        fg.globalAlpha = 0.5;
        fg.beginPath();
        fg.ellipse(cx + 16, top - ch - 24, 26, 14, 0, 0, Math.PI * 2);
        fg.fill();
        fg.globalAlpha = 1;
      }
      fg.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 6; k++) {
        const gx = 100 + r() * (W - 200);
        const gl = fg.createRadialGradient(gx, top - 4, 2, gx, top - 4, 56);
        gl.addColorStop(0, 'rgba(255,170,80,0.8)');
        gl.addColorStop(1, 'rgba(255,80,30,0)');
        fg.fillStyle = gl;
        fg.fillRect(gx - 60, top - 64, 120, 80);
      }
      fg.globalCompositeOperation = 'source-over';
      fg.fillStyle = P.far[1];
      fg.fillRect(0, top - 6, W, H);
    } else if (P.shape === 'shards') {
      // 虚空：漂浮的碎岩和一道裂缝里透出的光
      fg.fillStyle = P.far[0];
      fg.fillRect(0, top - 10, W, H);
      for (let k = 0; k < 14; k++) {
        const sx = r() * W;
        const sy = top - 110 + r() * 100;
        const sw = 10 + r() * 26;
        fg.fillStyle = k % 3 === 0 ? P.far[1] : P.far[0];
        fg.beginPath();
        fg.moveTo(sx, sy - sw);
        fg.lineTo(sx + sw * 0.7, sy);
        fg.lineTo(sx + sw * 0.2, sy + sw * 1.4);
        fg.lineTo(sx - sw * 0.6, sy + sw * 0.2);
        fg.fill();
      }
      fg.globalCompositeOperation = 'lighter';
      const rift = fg.createLinearGradient(0, top - 120, 0, top);
      rift.addColorStop(0, 'rgba(224,160,255,0)');
      rift.addColorStop(1, 'rgba(224,160,255,0.35)');
      fg.fillStyle = rift;
      fg.fillRect(P.sun.x - 14, top - 120, 28, 120);
      fg.globalCompositeOperation = 'source-over';
      fg.fillStyle = P.far[1];
      fg.fillRect(0, top - 6, W, H);
    }
    // 雾带：地平线附近一层暖色的雾
    const haze = fg.createLinearGradient(0, top - 70, 0, top + 20);
    haze.addColorStop(0, rgba(P.haze, 0));
    haze.addColorStop(0.7, rgba(P.haze, 0.35));
    haze.addColorStop(1, rgba(P.haze, 0.1));
    fg.fillStyle = haze;
    fg.fillRect(0, top - 70, W, 90);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(far, 0, 0, W, H);

    // ===== 3. 地面：远处（上方车道）偏冷偏暗，近处（下方车道）偏暖 =====
    const gr = g.createLinearGradient(0, top, 0, bottom);
    gr.addColorStop(0, P.ground[0]);
    gr.addColorStop(0.5, P.ground[1]);
    gr.addColorStop(1, P.ground[2]);
    g.fillStyle = gr;
    g.fillRect(0, top + 6, W, H - top);
    // 地平线的柔和过渡（远景树林脚下）
    const edge = g.createLinearGradient(0, top - 6, 0, top + 40);
    edge.addColorStop(0, rgba(P.far[1], 1));
    edge.addColorStop(1, rgba(P.far[1], 0));
    g.fillStyle = edge;
    g.fillRect(0, top - 6, W, 46);

    // 地面的深浅斑块（像手绘的笔触）：在 1/4 画布上画，放大后边缘是柔的
    const blot = canvas(W / q, H / q);
    const bg2 = blot.getContext('2d');
    bg2.scale(1 / q, 1 / q);
    for (let k = 0; k < 160; k++) {
      const bx = C.wallX + r() * (W - C.wallX);
      const by = top + 10 + r() * (bottom - top);
      const dark = r() < 0.6;
      bg2.fillStyle = dark ? 'rgba(4,14,12,0.2)' : rgba(P.tuftTip, 0.07);
      bg2.beginPath();
      bg2.ellipse(bx, by, 20 + r() * 70, 8 + r() * 16, (r() - 0.5) * 0.4, 0, Math.PI * 2);
      bg2.fill();
    }
    g.drawImage(blot, 0, 0, W, H);
    // 地面上被阳光照亮的一大片区域
    g.globalCompositeOperation = 'lighter';
    const pool = g.createRadialGradient(W * 0.72, top + 40, 20, W * 0.72, top + 40, W * 0.7);
    pool.addColorStop(0, rgba(P.sun.color, 0.16));
    pool.addColorStop(0.5, rgba(P.sun.color, 0.05));
    pool.addColorStop(1, rgba(P.sun.color, 0));
    g.fillStyle = pool;
    g.fillRect(0, top, W, bottom - top);
    g.globalCompositeOperation = 'source-over';

    // ===== 4. 战场地面：整片连续的地面 =====
    // 车道只存在于逻辑里（怪物沿着各自的车道走），画面上看不出一条一条的路：不画分道的光带、不在车道之间画草丛 / 花带，
    // 整个战场是一块被阳光照亮的完整地面，边缘柔和地融进周围
    const fieldH = bottom - top;
    const la = P.laneAlpha || 1;
    const ground = g.createLinearGradient(0, top, 0, bottom);
    ground.addColorStop(0, rgba(P.lane, 0));
    ground.addColorStop(0.1, rgba(P.lane, 0.34 * la));
    ground.addColorStop(0.5, rgba(P.lane, 0.52 * la));
    ground.addColorStop(0.9, rgba(P.lane, 0.34 * la));
    ground.addColorStop(1, rgba(P.lane, 0));
    g.fillStyle = ground;
    g.fillRect(C.wallX - 10, top, W - C.wallX + 20, fieldH);
    // 地面上的小石子（暗）和光斑（亮），在整个战场里随机撒开
    const specks = Math.round(((W - C.wallX) / 33) * Math.max(3, lanes));
    for (let k = 0; k < specks; k++) {
      const x = C.wallX + 20 + r() * (W - C.wallX - 20);
      const y = top + 14 + r() * (fieldH - 28);
      g.fillStyle = 'rgba(60,45,30,0.22)';
      g.beginPath();
      g.ellipse(x, y, 2 + r() * 3, 1.2 + r() * 1.5, 0, 0, Math.PI * 2);
      g.fill();
      if (r() < 0.35) {
        g.fillStyle = rgba(P.rim, 0.35);
        g.beginPath();
        g.ellipse(x + 3, y - 2, 1.5, 1, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    // 草丛（深色草叶 + 受光的亮叶尖）和发光的小花，同样在整个战场里随机分布
    const tufts = Math.round(((W - C.wallX + 50) / 17) * (Math.max(3, lanes) + 1) * 0.35);
    for (let k = 0; k < tufts; k++) {
      const x = C.wallX - 30 + r() * (W - C.wallX + 50);
      const y = top + 6 + r() * (fieldH - 6);
      const h = 6 + r() * 10;
      const lean = (r() - 0.3) * 6;
      g.fillStyle = P.tuft;
      g.beginPath();
      g.moveTo(x - 3, y + 4);
      g.quadraticCurveTo(x + lean * 0.5, y - h * 0.5, x + lean, y - h);
      g.quadraticCurveTo(x + lean * 0.3 + 2, y - h * 0.4, x + 4, y + 4);
      g.fill();
      if (r() < 0.55) {
        g.strokeStyle = rgba(P.tuftTip, 0.55);
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(x + lean * 0.6, y - h * 0.6);
        g.lineTo(x + lean, y - h);
        g.stroke();
      }
    }
    for (let k = 0; k < 7 * (Math.max(3, lanes) + 1); k++) {
      const fx = C.wallX + 40 + r() * (W - C.wallX - 60);
      const fy = top + 8 + r() * (fieldH - 16);
      const col = P.flowers[Math.floor(r() * P.flowers.length)];
      A.drawGlow(g, fx, fy, 10 + r() * 6, col, 0.55);
      g.fillStyle = col;
      g.beginPath();
      g.arc(fx, fy, 1.8, 0, Math.PI * 2);
      g.fill();
    }

    // ===== 5. 城墙后的村子：剪影小屋 + 暖色的窗灯 =====
    g.fillStyle = rgba(P.fore, 0.55);
    g.fillRect(0, top, C.wallX - 60, bottom - top);
    for (let i = 0; i < 4; i++) {
      const y = top + 70 + i * 130;
      g.fillStyle = '#132a22';
      g.fillRect(16, y + 6, 50, 32);
      g.beginPath();
      g.moveTo(10, y + 8);
      g.lineTo(41, y - 16);
      g.lineTo(72, y + 8);
      g.fill();
      A.drawGlow(g, 41, y + 22, 26, P.window, 0.6);
      g.fillStyle = P.window;
      g.fillRect(36, y + 17, 10, 9);
    }

    // ===== 6. 光束（单独一张，每帧加色叠加、缓慢明暗） =====
    const shafts = canvas(W, H);
    const sg = shafts.getContext('2d');
    for (let k = 0; k < (P.shafts ? 4 : 0); k++) {
      const x0 = P.sun.x - 160 + k * 90 + r() * 30;
      const w0 = 10 + r() * 18;
      const len = 700 + r() * 200;
      const ang = 2.25 + r() * 0.12; // 指向左下
      const x1 = x0 + Math.cos(ang) * len;
      const y1 = P.sun.y + Math.sin(ang) * len;
      const lg = sg.createLinearGradient(x0, P.sun.y, x1, y1);
      lg.addColorStop(0, rgba(P.shafts, 0.2));
      lg.addColorStop(0.6, rgba(P.shafts, 0.05));
      lg.addColorStop(1, rgba(P.shafts, 0));
      sg.fillStyle = lg;
      sg.beginPath();
      sg.moveTo(x0 - w0 * 0.3, P.sun.y);
      sg.lineTo(x0 + w0 * 0.3, P.sun.y);
      sg.lineTo(x1 + w0 * 1.1, y1);
      sg.lineTo(x1 - w0 * 1.1, y1);
      sg.fill();
    }

    // ===== 7. 前景：景深雾 + 上下剪影 + 暗角 =====
    const front = canvas(W, H);
    const ft = front.getContext('2d');
    // 远处（右侧怪物出生的地方）淡淡的雾
    const depth = ft.createLinearGradient(W * 0.62, 0, W, 0);
    depth.addColorStop(0, rgba(P.fog, 0));
    depth.addColorStop(1, rgba(P.fog, 0.16));
    ft.fillStyle = depth;
    ft.fillRect(0, top, W, bottom - top);
    // 上方的车道更远：一层很淡的冷雾
    const vf = ft.createLinearGradient(0, top, 0, top + laneH * 1.4);
    vf.addColorStop(0, rgba(P.fog, 0.16));
    vf.addColorStop(1, rgba(P.fog, 0));
    ft.fillStyle = vf;
    ft.fillRect(0, top, W, laneH * 1.4);
    // 底部前景：深色的大草叶剪影（只在战场下方）
    ft.fillStyle = P.fore;
    ft.beginPath();
    ft.moveTo(0, H);
    for (let x = 0; x <= W; x += 14 + r() * 18) {
      const h = 24 + r() * 46;
      ft.lineTo(x, bottom + 34 - h * 0.25);
      ft.quadraticCurveTo(x + 6 + r() * 10, bottom + 30 - h, x + 12 + r() * 10, bottom + 22 - h * 0.6);
    }
    ft.lineTo(W, H);
    ft.closePath();
    ft.fill();
    ft.fillRect(0, bottom + 30, W, H);
    // 底部叶尖的轮廓光
    // 左上、右上：垂下来的叶子剪影
    for (const [cx, dir] of [
      [0, 1],
      [W, -1],
    ]) {
      for (let k = 0; k < 9; k++) {
        const x = cx + dir * (k * 26 + r() * 20);
        const len = 30 + r() * 60 - k * 3;
        ft.fillStyle = P.fore;
        ft.beginPath();
        ft.moveTo(x - 8, -4);
        ft.quadraticCurveTo(x + dir * 10, len * 0.6, x + dir * 4, len);
        ft.quadraticCurveTo(x - dir * 6, len * 0.5, x + 8, -4);
        ft.fill();
      }
    }
    // 暗角
    const vg = ft.createRadialGradient(W / 2, H * 0.55, H * 0.42, W / 2, H * 0.55, W * 0.72);
    vg.addColorStop(0, 'rgba(4,8,16,0)');
    vg.addColorStop(1, 'rgba(4,8,16,0.55)');
    ft.fillStyle = vg;
    ft.fillRect(0, 0, W, H);

    return { back, shafts, front, palette: P };
  };

  // ---------- 角色光影（设计书 54.5） ----------
  // 每只怪物有自己的小缓存画布：背光光晕 + 精灵 + 明暗 + 轮廓光
  // 动画按约 15 帧/秒更新缓存（不同怪物的更新时刻自然错开），每帧只 drawImage 一次——没有显卡加速时也够快
  let tmp = null;
  A.LIT_FPS = 12;
  A.litSprite = function (holder, key, s, light, glowAlpha, draw) {
    const w = Math.ceil(s * 4.4);
    const h = Math.ceil(s * 4.2);
    const OX = Math.round(w / 2);
    const OY = Math.round(h - s * 0.9);
    let c = holder.litCache;
    if (c && c.key === key && c.canvas.width === w && c.canvas.height === h) return c;
    if (!c || c.canvas.width !== w || c.canvas.height !== h) c = holder.litCache = { canvas: canvas(w, h), ox: OX, oy: OY };
    c.key = key;
    if (!tmp || tmp.width < w || tmp.height < h) tmp = canvas(Math.max(w, tmp ? tmp.width : 0), Math.max(h, tmp ? tmp.height : 0));
    const g = c.canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, w, h);
    g.translate(OX, OY);
    draw(g);
    g.setTransform(1, 0, 0, 1, 0, 0);
    // 明暗：右上受光、左下背光，只染在精灵自己的像素上
    g.globalCompositeOperation = 'source-atop';
    const lg = g.createLinearGradient(OX + s * 1.1, OY - s * 2.4, OX - s * 0.9, OY + s * 0.3);
    lg.addColorStop(0, rgba(light, 0.38));
    lg.addColorStop(0.4, rgba(light, 0));
    lg.addColorStop(0.55, 'rgba(10,16,44,0)');
    lg.addColorStop(1, 'rgba(10,16,44,0.55)');
    g.fillStyle = lg;
    g.fillRect(0, 0, w, h);
    // 轮廓光：剪影减去"往背光方向挪一点"的剪影，剩下受光一侧的一道亮边
    const r = Math.max(2, s * 0.09);
    const gb = tmp.getContext('2d');
    gb.globalCompositeOperation = 'source-over';
    gb.clearRect(0, 0, w, h);
    gb.drawImage(c.canvas, 0, 0);
    gb.globalCompositeOperation = 'source-in';
    gb.fillStyle = light;
    gb.fillRect(0, 0, w, h);
    gb.globalCompositeOperation = 'destination-out';
    gb.drawImage(c.canvas, -r, r);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.5;
    g.drawImage(tmp, 0, 0, w, h, 0, 0, w, h);
    // 背光光晕垫在最后面
    if (glowAlpha > 0) {
      g.globalCompositeOperation = 'destination-over';
      g.globalAlpha = glowAlpha;
      const gr = s * 1.85;
      g.drawImage(A.glow(light), OX - gr, OY - s * 0.8 - gr, gr * 2, gr * 2);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    return c;
  };

  // ---------- 漂浮光点 ----------
  A.makeMotes = function (n) {
    const motes = [];
    for (let i = 0; i < n; i++) {
      motes.push({
        x: Math.random() * W,
        y: C.fieldTop + Math.random() * (H - C.fieldTop),
        vx: -6 - Math.random() * 10,
        vy: -4 - Math.random() * 8,
        ph: Math.random() * 6.28,
        r: 4 + Math.random() * 7,
      });
    }
    return motes;
  };

  A.drawMotes = function (ctx, motes, color, dt, t) {
    for (const m of motes) {
      m.x += (m.vx + Math.sin(t * 0.7 + m.ph) * 8) * dt;
      m.y += (m.vy + Math.cos(t * 0.9 + m.ph) * 6) * dt;
      if (m.x < -20) m.x = W + 20;
      if (m.y < C.fieldTop - 40) {
        m.y = H - 20;
        m.x = Math.random() * W;
      }
      const tw = 0.15 + 0.6 * Math.max(0, Math.sin(t * 1.3 + m.ph * 3));
      A.drawGlow(ctx, m.x, m.y, m.r, color, tw, true);
    }
  };
})((globalThis.TD = globalThis.TD || {}));
