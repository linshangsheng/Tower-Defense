// 程序化背景音乐（设计书第 11 章）：每章一首主题曲，战斗中按城墙血量切换紧张度
(function (TD) {
  'use strict';

  const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  function freq(name) {
    const m = /^([A-G][#b]?)(\d)$/.exec(name);
    if (!m) return 0;
    const midi = 12 * (+m[2] + 1) + NOTE[m[1]];
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // 每首曲子：bpm；melody 每小节 8 个八分音符（音名 / "." 延长 / "-" 休止）；chords 每小节一个和弦（根音在前）
  const THEMES = {
    1: {
      name: '翠绿草原',
      bpm: 112,
      lead: 'pluck',
      melody: [
        'E5 . G5 . A5 G5 E5 .',
        'D5 . E5 D5 C5 . A4 .',
        'C5 . D5 E5 G5 . E5 .',
        'D5 . . C5 D5 . - -',
        'E5 . G5 . A5 . C6 .',
        'A5 G5 E5 . D5 . E5 .',
        'G5 . E5 D5 C5 . D5 .',
        'C5 . . . - - - -',
      ],
      chords: [['C3', 'E4', 'G4'], ['A2', 'C4', 'E4'], ['F2', 'A3', 'C4'], ['G2', 'B3', 'D4'], ['C3', 'E4', 'G4'], ['A2', 'C4', 'E4'], ['F2', 'A3', 'C4'], ['G2', 'B3', 'D4']],
    },
    2: {
      name: '黄金沙漠',
      bpm: 100,
      lead: 'reed',
      melody: [
        'D5 . Eb5 . F#5 . G5 .',
        'A5 . . G5 F#5 . Eb5 .',
        'D5 . . . - - A4 .',
        'Bb4 . A4 . F#4 . A4 .',
        'D5 . Eb5 F#5 G5 . A5 .',
        'Bb5 . A5 . G5 F#5 Eb5 .',
        'F#5 . . Eb5 D5 . . .',
        '- - - - - - - -',
      ],
      chords: [['D3', 'F#3', 'A3'], ['Eb3', 'G3', 'Bb3'], ['D3', 'F#3', 'A3'], ['C3', 'Eb3', 'G3'], ['D3', 'F#3', 'A3'], ['Eb3', 'G3', 'Bb3'], ['C3', 'Eb3', 'G3'], ['D3', 'F#3', 'A3']],
    },
    3: {
      name: '迷雾沼泽',
      bpm: 92,
      lead: 'woodwind',
      melody: [
        'A4 . C5 . B4 . A4 .',
        'E5 . . D#5 E5 . - -',
        'F5 . E5 . D5 . C5 .',
        'B4 . . G#4 A4 . - -',
        'A4 C5 E5 . D5 . C5 .',
        'B4 . C5 . D5 . E5 .',
        'F5 . E5 D5 C5 . B4 .',
        'A4 . . . - - - -',
      ],
      chords: [['A2', 'C4', 'E4'], ['A2', 'C4', 'E4'], ['F2', 'A3', 'C4'], ['E2', 'G#3', 'B3'], ['A2', 'C4', 'E4'], ['D3', 'F3', 'A3'], ['F2', 'A3', 'C4'], ['E2', 'G#3', 'B3']],
    },
    4: {
      name: '冰霜雪原',
      bpm: 96,
      lead: 'bell',
      melody: [
        'B5 . G#5 . E5 . F#5 .',
        'G#5 . . . A#5 . B5 .',
        'C#6 . B5 . G#5 . E5 .',
        'F#5 . . . - - - -',
        'E5 . F#5 G#5 B5 . . .',
        'A#5 . G#5 . F#5 . E5 .',
        'G#5 . F#5 . D#5 . F#5 .',
        'E5 . . . - - - -',
      ],
      chords: [['E3', 'G#3', 'B3'], ['A2', 'C#4', 'E4'], ['C#3', 'E3', 'G#3'], ['B2', 'D#4', 'F#4'], ['E3', 'G#3', 'B3'], ['A2', 'C#4', 'E4'], ['B2', 'D#4', 'F#4'], ['E3', 'G#3', 'B3']],
    },
    5: {
      name: '熔岩裂隙',
      bpm: 128,
      lead: 'saw',
      melody: [
        'C5 . Eb5 . G5 . Eb5 .',
        'Ab5 . G5 . F5 . Eb5 .',
        'D5 . F5 . Bb5 . F5 .',
        'G5 . . . B4 . D5 .',
        'C5 Eb5 G5 . C6 . Bb5 .',
        'Ab5 . G5 . F5 Eb5 D5 .',
        'Eb5 . D5 . C5 . B4 .',
        'C5 . . . - - - -',
      ],
      chords: [['C3', 'Eb3', 'G3'], ['Ab2', 'C3', 'Eb3'], ['Bb2', 'D3', 'F3'], ['G2', 'B2', 'D3'], ['C3', 'Eb3', 'G3'], ['Ab2', 'C3', 'Eb3'], ['F2', 'Ab2', 'C3'], ['G2', 'B2', 'D3']],
    },
    // 第六章（设计书 33.6）：F 大调，轻快的长笛
    6: {
      name: '云端王国',
      bpm: 120,
      lead: 'woodwind',
      melody: [
        'F5 . A5 . C6 . A5 .',
        'Bb5 . A5 G5 F5 . G5 .',
        'A5 . C6 . F6 . E6 .',
        'D6 . . C6 Bb5 . - -',
        'A5 . G5 . F5 A5 C6 .',
        'D6 . C6 . Bb5 A5 G5 .',
        'A5 . F5 . G5 . E5 .',
        'F5 . . . - - - -',
      ],
      chords: [['F3', 'A3', 'C4'], ['Bb2', 'D4', 'F4'], ['F3', 'A3', 'C4'], ['C3', 'E4', 'G4'], ['D3', 'F3', 'A3'], ['Bb2', 'D4', 'F4'], ['C3', 'E4', 'G4'], ['F3', 'A3', 'C4']],
    },
  };

  const M = (TD.music = { enabled: true, theme: null, mode: 'calm', tension: 0, playing: false });

  let ctx = null;
  let master = null;
  let timer = null;
  let step = 0;
  let nextTime = 0;

  function ensure() {
    if (!TD.audio || !TD.audio.ctx) return null;
    ctx = TD.audio.ctx;
    if (!master) {
      master = ctx.createGain();
      master.gain.value = 0.0001;
      master.connect(ctx.destination);
    }
    return ctx;
  }

  function voice(type, f, t, dur, vol, opts) {
    opts = opts || {};
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (opts.detune) o.detune.setValueAtTime(opts.detune, t);
    const a = opts.attack || 0.01;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (opts.lowpass) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = opts.lowpass;
      o.connect(lp);
      node = lp;
    }
    node.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function lead(kind, f, t, dur) {
    switch (kind) {
      case 'pluck':
        voice('triangle', f, t, Math.min(dur, 0.45), 0.16);
        voice('sine', f * 2, t, 0.12, 0.04);
        break;
      case 'reed':
        voice('square', f, t, dur * 0.95, 0.05, { attack: 0.03, lowpass: 1800 });
        break;
      case 'woodwind':
        voice('triangle', f, t, dur * 0.9, 0.13, { attack: 0.04 });
        break;
      case 'bell':
        voice('sine', f, t, Math.max(0.6, dur), 0.12);
        voice('sine', f * 3, t, 0.3, 0.025);
        break;
      case 'saw':
        voice('sawtooth', f, t, dur * 0.85, 0.045, { lowpass: 2200 });
        break;
    }
  }

  function noiseHit(t, vol, hp) {
    const len = Math.floor(ctx.sampleRate * 0.05);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
  }

  function kick(t, vol) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.2);
  }

  // 解析旋律：返回每个八分音符位置的 { f, len } 或 null
  const parsed = {};
  function parse(theme) {
    if (parsed[theme]) return parsed[theme];
    const th = THEMES[theme];
    const notes = [];
    th.melody.forEach((bar) => bar.split(/\s+/).forEach((tok) => notes.push(tok)));
    const out = notes.map((tok, i) => {
      if (tok === '.' || tok === '-') return null;
      let len = 1;
      while (notes[i + len] === '.') len++;
      return { f: freq(tok), len };
    });
    return (parsed[theme] = out);
  }

  function schedule() {
    if (!ctx || !M.theme) return;
    const th = THEMES[M.theme];
    const eighth = 60 / th.bpm / 2;
    const mel = parse(M.theme);
    while (nextTime < ctx.currentTime + 0.25) {
      const i = step % mel.length;
      const bar = Math.floor(i / 8);
      const pos = i % 8;
      const chord = th.chords[bar];
      const battle = M.mode === 'battle';
      // 旋律：菜单里音量小一点
      const n = mel[i];
      if (n && (battle || bar % 2 === 0 || pos < 4)) lead(th.lead, n.f, nextTime, n.len * eighth);
      // 低音
      if (pos % 4 === 0 || (M.tension >= 2 && pos % 2 === 0)) voice('triangle', freq(chord[0]), nextTime, eighth * (M.tension >= 2 ? 1.6 : 3.2), 0.16, { lowpass: 600 });
      // 和弦铺底（每小节一次）
      if (pos === 0) for (const nn of chord.slice(1)) voice('sine', freq(nn), nextTime, eighth * 7.5, battle ? 0.035 : 0.045, { attack: 0.2 });
      // 战斗：轻鼓点；紧张时加快
      if (battle) {
        if (pos % 4 === 0) kick(nextTime, M.tension >= 2 ? 0.35 : 0.22);
        if (M.tension >= 1 && pos % 2 === 1) noiseHit(nextTime, 0.05, 6000);
        if (M.tension >= 2) noiseHit(nextTime + eighth / 2, 0.03, 8000);
      }
      // Boss 在场：低音长音铺底
      if (M.tension >= 1 && pos === 0 && bar % 2 === 0) voice('sawtooth', freq(chord[0]) / 2, nextTime, eighth * 15, 0.03, { attack: 0.5, lowpass: 300 });
      nextTime += eighth * (M.tension >= 2 ? 0.88 : 1);
      step++;
    }
  }

  function fade(to, sec) {
    if (!master) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t);
    master.gain.exponentialRampToValueAtTime(Math.max(0.0001, to), t + sec);
  }

  // 切换曲子：theme 为章节号，mode 为 'calm'（菜单）或 'battle'
  M.play = function (theme, mode) {
    M.want = { theme, mode };
    if (!M.enabled || !ensure() || ctx.state !== 'running') return;
    if (M.theme === theme && M.mode === mode && M.playing) return;
    const changed = M.theme !== theme;
    M.theme = theme;
    M.mode = mode;
    M.tension = 0;
    if (changed || !M.playing) {
      step = 0;
      nextTime = ctx.currentTime + 0.1;
    }
    fade(mode === 'battle' ? 0.55 : 0.4, 0.8);
    if (!timer) timer = setInterval(schedule, 40);
    M.playing = true;
  };

  M.setTension = function (level) {
    M.tension = level;
  };

  M.stop = function () {
    M.playing = false;
    if (master && ctx) fade(0.0001, 0.6);
    setTimeout(() => {
      if (!M.playing && timer) {
        clearInterval(timer);
        timer = null;
      }
    }, 700);
  };

  M.setEnabled = function (on) {
    M.enabled = on;
    if (!on) M.stop();
    else if (M.want) M.play(M.want.theme, M.want.mode);
  };

  // 音频解锁后补播
  M.resume = function () {
    if (M.want && M.enabled && !M.playing) M.play(M.want.theme, M.want.mode);
  };

  M.themes = THEMES;
})((globalThis.TD = globalThis.TD || {}));
