// 合成音效（原型阶段不使用音频文件，设计书 11 章、17.2）
(function (TD) {
  'use strict';

  const A = (TD.audio = {
    enabled: true,
    ctx: null,
    last: {},
  });

  function ensure() {
    if (A.ctx) return A.ctx;
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    A.ctx = new AC();
    A.master = A.ctx.createGain();
    A.master.gain.value = 0.35 * A.volume;
    A.master.connect(A.ctx.destination);
    return A.ctx;
  }

  // 音量 0–1（设计书 49）
  A.volume = 1;
  A.setVolume = function (v) {
    A.volume = Math.max(0, Math.min(1, v));
    if (A.master) A.master.gain.value = 0.35 * A.volume;
  };

  A.unlock = function () {
    const ctx = ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  };

  function tone(freq, dur, type, vol, slide, delay) {
    const ctx = A.ctx;
    const t0 = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.3, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(A.dest || A.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    const ctx = A.ctx;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 1200;
    const g = ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(f);
    f.connect(g);
    g.connect(A.dest || A.master);
    src.start();
  }

  const SOUNDS = {
    shoot: () => tone(880, 0.06, 'triangle', 0.08, 0.6),
    hit: () => tone(320, 0.05, 'square', 0.04, 0.5),
    crit: () => {
      // "当当"：呼应主角名字
      tone(1320, 0.18, 'triangle', 0.22, 0.98);
      tone(1980, 0.12, 'sine', 0.1, 0.98);
    },
    pop: () => tone(520, 0.09, 'sine', 0.12, 1.8),
    coin: () => {
      tone(1400, 0.06, 'square', 0.06);
      tone(2100, 0.1, 'square', 0.05, 1, 0.05);
    },
    wall: () => noise(0.08, 0.12, 500),
    bigWall: () => {
      noise(0.4, 0.5, 300);
      tone(90, 0.4, 'sine', 0.4, 0.5);
    },
    skill: () => {
      tone(523, 0.12, 'triangle', 0.2);
      tone(784, 0.18, 'triangle', 0.2, 1, 0.08);
    },
    drum: () => {
      tone(110, 0.15, 'sine', 0.5, 0.6);
      tone(110, 0.15, 'sine', 0.5, 0.6, 0.18);
    },
    thunder: () => {
      noise(0.5, 0.45, 2500);
      tone(60, 0.5, 'sawtooth', 0.2, 0.5);
    },
    frost: () => tone(1800, 0.4, 'sine', 0.12, 0.4),
    heal: () => {
      tone(660, 0.12, 'sine', 0.15);
      tone(880, 0.2, 'sine', 0.15, 1, 0.1);
    },
    boom: () => {
      noise(0.35, 0.5, 900);
      tone(120, 0.3, 'sine', 0.3, 0.4);
    },
    warn: () => {
      tone(440, 0.15, 'square', 0.12);
      tone(440, 0.15, 'square', 0.12, 1, 0.3);
    },
    interrupt: () => {
      tone(300, 0.08, 'square', 0.2);
      tone(1500, 0.25, 'triangle', 0.2, 0.8, 0.05);
    },
    wave: () => {
      tone(392, 0.12, 'triangle', 0.15);
      tone(523, 0.18, 'triangle', 0.15, 1, 0.12);
    },
    bossDie: () => {
      noise(0.6, 0.4, 800);
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.18, 1, i * 0.1));
    },
    win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.2, 1, i * 0.12)),
    lose: () => [392, 349, 311, 262].forEach((f, i) => tone(f, 0.3, 'triangle', 0.18, 0.98, i * 0.2)),
    click: () => tone(700, 0.04, 'sine', 0.12),
    buy: () => {
      tone(988, 0.07, 'square', 0.08);
      tone(1319, 0.14, 'square', 0.08, 1, 0.07);
    },
    error: () => tone(160, 0.15, 'square', 0.12),
    // 第六章（设计书 34.1）
    dodge: () => tone(1400, 0.08, 'sine', 0.06, 0.5),
    shear: () => {
      noise(0.04, 0.25, 4000);
      noise(0.04, 0.25, 4000);
      tone(2200, 0.05, 'square', 0.05, 0.8, 0.12);
    },
    zap: () => {
      tone(180, 0.25, 'sawtooth', 0.15, 2.5);
      noise(0.2, 0.2, 3000);
    },
    gust: () => noise(0.9, 0.35, 600),
    bolt: () => {
      noise(0.7, 0.6, 2200);
      tone(50, 0.7, 'sawtooth', 0.3, 0.5);
    },
    ding: () => tone(1760, 0.2, 'triangle', 0.15),
    bell: () => {
      tone(2093, 0.35, 'sine', 0.12);
      tone(3136, 0.25, 'sine', 0.06, 1, 0.01);
    },
    streak: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.12, 'triangle', 0.14, 1, i * 0.06)),
    // 第七章（设计书 52.6）
    bubblePop: () => tone(900, 0.06, 'sine', 0.1, 2.2),
    shell: () => tone(320, 0.07, 'square', 0.06, 0.7),
    spikes: () => {
      noise(0.08, 0.2, 5000);
      tone(1200, 0.06, 'triangle', 0.06, 0.6);
    },
    splash: () => noise(0.25, 0.18, 1200),
    clam: () => {
      tone(220, 0.12, 'triangle', 0.15, 0.6);
      tone(660, 0.18, 'sine', 0.08, 1.2, 0.05);
    },
    // 道具与城墙（设计书 64.7）
    item_firebomb: () => {
      noise(0.5, 0.4, 1400);
      tone(220, 0.4, 'sawtooth', 0.14, 0.4);
      tone(90, 0.45, 'sine', 0.3, 0.5);
    },
    item_bomb: () => {
      noise(0.45, 0.55, 800);
      tone(110, 0.45, 'sine', 0.4, 0.35);
      tone(55, 0.6, 'sine', 0.3, 0.6, 0.05);
    },
    item_patch: () => [523, 659, 784].forEach((f, i) => tone(f, 0.22, 'triangle', 0.26, 1, i * 0.07)),
    item_haste: () => {
      [392, 523, 659, 880].forEach((f, i) => tone(f, 0.1, 'square', 0.07, 1, i * 0.05));
      noise(0.3, 0.12, 4000);
    },
    item_freeze: () => {
      tone(2400, 0.7, 'sine', 0.12, 0.4);
      tone(3200, 0.5, 'triangle', 0.07, 0.5, 0.05);
      noise(0.4, 0.15, 6000);
    },
    item_charm: () => [880, 1109, 1319, 1760].forEach((f, i) => tone(f, 0.3, 'sine', 0.2, 1, i * 0.08)),
    item_thunderScroll: () => {
      noise(0.5, 0.5, 3000);
      tone(70, 0.6, 'sawtooth', 0.22, 0.5);
      tone(1400, 0.15, 'square', 0.08, 0.3, 0.02);
    },
    item_bigBomb: () => {
      noise(0.9, 0.7, 700);
      tone(80, 0.9, 'sine', 0.5, 0.3);
      tone(45, 1.1, 'sine', 0.4, 0.6, 0.08);
      tone(160, 0.5, 'sawtooth', 0.12, 0.3);
    },
    item_barrier: () => {
      [330, 495, 660].forEach((f, i) => tone(f, 0.8, 'sine', 0.12, 1.02, i * 0.05));
      tone(1320, 0.6, 'triangle', 0.06, 1, 0.1);
    },
    item_warBanner: () => {
      tone(98, 0.5, 'sawtooth', 0.12, 1);
      tone(147, 0.5, 'sawtooth', 0.1, 1, 0.05);
      tone(196, 0.9, 'sawtooth', 0.12, 1, 0.12);
      tone(70, 0.3, 'sine', 0.45, 0.6);
    },
    item_quake: () => {
      noise(1.2, 0.6, 350);
      tone(40, 1.2, 'sine', 0.55, 0.7);
      tone(60, 1, 'sawtooth', 0.15, 0.5);
    },
    item_blizzard: () => {
      noise(1.6, 0.35, 5000);
      [2093, 2637, 3136, 3951].forEach((f, i) => tone(f, 0.9, 'sine', 0.06, 0.7, i * 0.12));
      tone(120, 1.2, 'sine', 0.2, 0.6);
    },
    item_flood: () => {
      noise(1.8, 0.5, 700);
      tone(65, 1.6, 'sine', 0.4, 0.6);
      tone(130, 1.2, 'triangle', 0.12, 1.4, 0.2);
    },
    item_holyLight: () => {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 1.1, 'sine', 0.18, 1, i * 0.09));
      tone(262, 1.4, 'triangle', 0.252);
    },
    item_meteor: () => {
      tone(900, 0.8, 'sawtooth', 0.08, 0.2);
      noise(0.8, 0.2, 1500);
      tone(50, 0.9, 'sine', 0.3, 0.6, 0.6);
    },
    item_chrono: () => {
      tone(1760, 0.14, 'sine', 0.22);
      tone(1320, 0.14, 'sine', 0.22, 1, 0.16);
      tone(880, 0.14, 'sine', 0.22, 1, 0.32);
      tone(440, 0.8, 'triangle', 0.308, 0.5, 0.5);
    },
    meteorHit: () => {
      noise(0.6, 0.6, 600);
      tone(70, 0.6, 'sine', 0.5, 0.4);
    },
    scrollBolt: () => {
      noise(0.25, 0.3, 4000);
      tone(900, 0.2, 'sawtooth', 0.1, 0.3);
    },
    barrierBreak: () => {
      tone(1400, 0.35, 'triangle', 0.12, 0.3);
      noise(0.3, 0.2, 5000);
    },
    wallBreak: () => {
      noise(0.7, 0.55, 500);
      tone(70, 0.6, 'sine', 0.45, 0.5);
      tone(150, 0.3, 'square', 0.08, 0.4, 0.05);
    },
    wallCollapse: () => {
      noise(1.8, 0.7, 450);
      tone(48, 1.8, 'sine', 0.55, 0.5);
      tone(95, 1.2, 'sawtooth', 0.14, 0.4, 0.1);
    },
  };

  // 同一种音效有最小间隔，避免成群怪物时刺耳
  const MIN_GAP = { hit: 0.05, pop: 0.04, wall: 0.12, shoot: 0.07, coin: 0.06, crit: 0.08, dodge: 0.1, shear: 0.15, zap: 0.3, bubblePop: 0.06, shell: 0.12, spikes: 0.1, splash: 0.2, meteorHit: 0.15, scrollBolt: 0.1, barrierBreak: 0.3, wallBreak: 0.3 };

  const LOUD = /^(item_|meteorHit|wallBreak|wallCollapse|scrollBolt|barrierBreak)/;

  A.play = function (name) {
    if (!A.enabled) return;
    const ctx = ensure();
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (MIN_GAP[name] && A.last[name] && now - A.last[name] < MIN_GAP[name]) return;
    A.last[name] = now;
    const fn = SOUNDS[name];
    if (!fn) return;
    // 道具 / 城墙大事件要盖过音乐：走一个增益节点（设计书 64.9）
    if (LOUD.test(name)) {
      if (!A.loud) {
        A.loud = ctx.createGain();
        A.loud.gain.value = 2.4;
        A.loud.connect(A.master);
      }
      A.dest = A.loud;
    }
    fn();
    A.dest = null;
  };
})((globalThis.TD = globalThis.TD || {}));
