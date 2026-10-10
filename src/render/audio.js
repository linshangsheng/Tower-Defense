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
    A.master.gain.value = 0.35;
    A.master.connect(A.ctx.destination);
    return A.ctx;
  }

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
    g.connect(A.master);
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
    g.connect(A.master);
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
  };

  // 同一种音效有最小间隔，避免成群怪物时刺耳
  const MIN_GAP = { hit: 0.05, pop: 0.04, wall: 0.12, shoot: 0.07, coin: 0.06, crit: 0.08, dodge: 0.1, shear: 0.15, zap: 0.3 };

  A.play = function (name) {
    if (!A.enabled) return;
    const ctx = ensure();
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (MIN_GAP[name] && A.last[name] && now - A.last[name] < MIN_GAP[name]) return;
    A.last[name] = now;
    const fn = SOUNDS[name];
    if (fn) fn();
  };
})((globalThis.TD = globalThis.TD || {}));
