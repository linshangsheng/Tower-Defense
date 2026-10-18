// 背景音乐（设计书第 11、64、68 章）：真实乐器采样（FluidR3_GM，CC BY 3.0）+ 合成鼓点 / 噪声 + 混响 + 压缩器，沉重的小调；
// 采样还没解码好（或浏览器不支持）时自动退回到原来的纯合成声音；
// 标题一首、七章各一首；战斗按"四档紧张度"分层，Boss 来了更紧张。
// 引擎是一个可以挂在任意 AudioContext 上的类：实时播放和离线渲染（测试 / 试听）用同一套代码。
(function (TD) {
  'use strict';

  const PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const midiOf = (name) => {
    const m = /^([A-G][#b]?)(\d)$/.exec(name);
    return m ? 12 * (+m[2] + 1) + PC[m[1]] : null;
  };
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // 和弦符号 → { root: 根音 midi（第 2 八度）, tones: [根, 三, 五, 高八度根]（第 3 八度起）}
  function parseChord(sym) {
    const m = /^([A-G][#b]?)(m|dim|5)?$/.exec(sym);
    const r = PC[m[1]];
    const q = m[2] || '';
    const third = q === 'm' || q === 'dim' ? 3 : q === '5' ? 7 : 4;
    const fifth = q === 'dim' ? 6 : 7;
    const base3 = 48 + r; // 第 3 八度的根音
    return { sym, root: 36 + r, tones: [base3, base3 + third, base3 + fifth, base3 + 12] };
  }

  // 每首曲子：bpm；prog 每小节一个和弦；melody 每小节 8 个八分音符（"." 延长 / "-" 休止）；lead = 菜单 / 地图里的主奏乐器
  const THEMES = {
    0: {
      name: '最后的堡垒',
      bpm: 72,
      lead: 'bell',
      prog: ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'C', 'A'],
      melody: ['A4 . . . D5 . F5 .', 'D5 . . . C5 . Bb4 .', 'G4 . Bb4 . D5 . G5 .', 'F5 . E5 . C#5 . E5 .', 'A4 . . . D5 . F5 .', 'G5 . . . F5 . D5 .', 'E5 . G5 . C6 . G5 .', 'A5 . . . E5 . - -'],
    },
    1: {
      name: '翠绿草原',
      bpm: 100,
      lead: 'pluck',
      prog: ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E'],
      melody: ['E5 . . D5 C5 . A4 .', 'C5 . . . A4 . C5 .', 'E5 . G5 . E5 . D5 .', 'D5 . . . B4 . D5 .', 'E5 . A5 . G5 . E5 .', 'F5 . . E5 C5 . A4 .', 'D5 . F5 . A5 . F5 .', 'G#5 . . B5 . G#5 E5 .'],
    },
    2: {
      name: '黄金沙漠',
      bpm: 104,
      lead: 'reed',
      prog: ['D', 'Eb', 'D', 'Cm', 'D', 'Eb', 'Cm', 'D'],
      melody: ['D5 . Eb5 . F#5 . G5 .', 'A5 . . G5 F#5 . Eb5 .', 'D5 . . . F#5 A5 . .', 'G5 . F#5 . Eb5 . D5 .', 'D5 Eb5 F#5 . G5 . A5 .', 'Bb5 . A5 . G5 F#5 Eb5 .', 'F#5 . . Eb5 D5 . C5 .', 'D5 . . . - - - -'],
    },
    3: {
      name: '迷雾沼泽',
      bpm: 88,
      lead: 'flute',
      prog: ['Am', 'Am', 'F', 'E', 'Am', 'Dm', 'F', 'E'],
      melody: ['A4 . C5 . B4 . A4 .', 'E5 . . D#5 E5 . - -', 'F5 . E5 . D5 . C5 .', 'B4 . . G#4 A4 . - -', 'A4 C5 E5 . D5 . C5 .', 'B4 . C5 . D5 . E5 .', 'F5 . E5 D5 C5 . B4 .', 'A4 . . . - - - -'],
    },
    4: {
      name: '冰霜雪原',
      bpm: 92,
      lead: 'bell',
      prog: ['Em', 'C', 'G', 'D', 'Em', 'C', 'Am', 'B'],
      melody: ['B5 . G5 . E5 . G5 .', 'A5 . . . G5 . E5 .', 'D5 . G5 . B5 . G5 .', 'F#5 . . . A5 . F#5 .', 'E5 . G5 . B5 . E6 .', 'D6 . . B5 A5 . G5 .', 'E5 . A5 . C6 . A5 .', 'D#5 . F#5 . B5 . - -'],
    },
    5: {
      name: '熔岩裂隙',
      bpm: 124,
      lead: 'horn',
      prog: ['Cm', 'Ab', 'Bb', 'G', 'Cm', 'Ab', 'Fm', 'G'],
      melody: ['C5 . Eb5 . G5 . Eb5 .', 'Ab5 . G5 . Eb5 . C5 .', 'D5 . F5 . Bb5 . F5 .', 'G5 . . . B4 . D5 .', 'C5 Eb5 G5 . C6 . Bb5 .', 'Ab5 . G5 . F5 Eb5 C5 .', 'C5 . F5 . Ab5 . C6 .', 'B5 . G5 . D5 . - -'],
    },
    6: {
      name: '云端王国',
      bpm: 116,
      lead: 'flute',
      prog: ['Gm', 'Eb', 'Bb', 'F', 'Gm', 'Eb', 'Cm', 'D'],
      melody: ['D5 . G5 . Bb5 . A5 .', 'G5 . . F5 Eb5 . G5 .', 'F5 . Bb5 . D6 . C6 .', 'A5 . . . F5 . A5 .', 'G5 . Bb5 . D6 . G6 .', 'F6 . Eb6 . G5 . Bb5 .', 'C6 . Eb6 . G6 . Eb6 .', 'D6 . . . A5 . - -'],
    },
    7: {
      name: '珊瑚海湾',
      bpm: 100,
      lead: 'marimba',
      prog: ['Bbm', 'Gb', 'Db', 'Ab', 'Bbm', 'Gb', 'Ebm', 'F'],
      melody: ['F5 . Bb5 . Db6 . C6 .', 'Bb5 . . Ab5 Gb5 . F5 .', 'Db5 . F5 . Ab5 . F5 .', 'Eb5 . . . C5 . Eb5 .', 'F5 . Bb5 . Db6 . F6 .', 'Eb6 . Db6 . Bb5 . Ab5 .', 'Gb5 . Bb5 . Eb6 . Bb5 .', 'A5 . C6 . F5 . - -'],
    },
  };
  // 预先解析：和弦、旋律（每个八分音符位置 { midi, len } 或 null）
  for (const id of Object.keys(THEMES)) {
    const th = THEMES[id];
    th.chords = th.prog.map(parseChord);
    const toks = [];
    th.melody.forEach((bar) => bar.split(/\s+/).forEach((t) => toks.push(t)));
    th.notes = toks.map((tok, i) => {
      if (tok === '.' || tok === '-') return null;
      let len = 1;
      while (toks[i + len] === '.') len++;
      return { midi: midiOf(tok), len };
    });
  }

  // 鼓点（16 步一小节）：K 太鼓重击 k 轻击 T 通鼓 t 轻通鼓 S 军鼓 s 军鼓装饰音 h 踩镲
  const DRUMS = [
    { kick: 'K.....k.K.....k.', snare: '....t.......t...', hat: 'h.h.h.h.h.h.h.h.' },
    { kick: 'K..k..k.K..k..k.', snare: '....S.......S...', hat: 'hhhhhhhhhhhhhhhh' },
    { kick: 'K.kkK.k.K.kkK.kk', snare: '....S.......S..s', hat: 'hhhhhhhhhhhhhhhh' },
    { kick: 'KkkKkkKkKkkKkkKk', snare: '....S...S...S.SS', hat: 'hhhhhhhhhhhhhhhh' },
  ];
  const TEMPO = [1, 1.06, 1.1, 1.16]; // 战斗各档的速度倍率
  const ARP = [0, 2, 1, 3, 2, 3, 1, 2]; // 琶音在 [根, 三, 五, 高八度根] 里的取音顺序

  // 采样乐器（设计书 68.3）：每首曲子要预先解码的乐器 = 共用的 + 这一首的主奏
  const SHARED = ['cello', 'contrabass', 'string_ensemble_1', 'tremolo_strings', 'pizzicato_strings', 'french_horn', 'brass_section', 'choir_aahs', 'timpani', 'taiko_drum'];
  const LEAD_INST = { bell: ['tubular_bells', 'celesta'], pluck: ['orchestral_harp'], marimba: ['marimba'], reed: ['oboe'], flute: ['flute'], horn: [] };
  // 采样音量相对旧合成声音的倍率（由 tools/music.js --calibrate 标定，设计书 68.3）
  const GAIN = {
    cello: 7.2, contrabass: 7.2, string_ensemble_1: 10.2, tremolo_strings: 7.3, pizzicato_strings: 2.7, french_horn: 9, brass_section: 10.2, choir_aahs: 4.5,
    timpani: 1.4, taiko_drum: 1.4, tubular_bells: 6.8, celesta: 4.5, orchestral_harp: 4.5, marimba: 2.1, oboe: 8.8, flute: 13,
  };

  class Engine {
    constructor(ctx, dest) {
      this.ctx = ctx;
      this.theme = null;
      this.themeId = null;
      this.mode = 'calm';
      this.tension = 0;
      this.step = 0;
      this.nextTime = 0;
      // 总线：各声部 → mix（干声）+ 混响发送 → 压缩器 → 总音量 → 输出
      this.out = ctx.createGain();
      this.out.gain.value = 0.0001;
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -18;
      this.comp.knee.value = 14;
      this.comp.ratio.value = 5;
      this.comp.attack.value = 0.008;
      this.comp.release.value = 0.25;
      this.mix = ctx.createGain();
      this.mix.gain.value = 1;
      this.mix.connect(this.comp);
      this.comp.connect(this.out);
      this.out.connect(dest);
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this.impulse(2.4);
      this.wet = ctx.createGain();
      this.wet.gain.value = 0.32;
      this.reverb.connect(this.wet);
      this.wet.connect(this.mix);
      this.bus = {};
      const sends = { strings: 0.5, bass: 0.12, brass: 0.45, choir: 0.9, perc: 0.3, lead: 0.55 };
      for (const k of Object.keys(sends)) {
        const g = ctx.createGain();
        g.gain.value = 1;
        g.connect(this.mix);
        const s = ctx.createGain();
        s.gain.value = sends[k];
        g.connect(s);
        s.connect(this.reverb);
        this.bus[k] = g;
      }
      this.noise = this.makeNoise(3);
      this.S = {}; // 已解码的采样乐器：名字 → { loop, len, bufs: [{ midi, buf }] }
      this.loading = {};
      this.hold = false; // 为 true 时先不排音符（等采样解码）
      this.useSamples = true;
    }

    // 这首曲子要用到的采样乐器
    static instrumentsFor(themeId) {
      const th = THEMES[themeId] || THEMES[1];
      return SHARED.concat(LEAD_INST[th.lead] || []);
    }

    // 解码采样（只解码还没解码过的）；没有采样数据 / 解码失败就返回，保持合成声音
    loadSamples(names) {
      const data = TD.samples;
      if (!data) return Promise.resolve();
      const c = this.ctx;
      const jobs = [];
      for (const name of names) {
        if (this.S[name] || !data[name]) continue;
        if (!this.loading[name]) {
          const inst = data[name];
          this.loading[name] = Promise.all(
            Object.keys(inst.notes).map(async (k) => {
              const bin = typeof atob === 'function' ? atob(inst.notes[k]) : Buffer.from(inst.notes[k], 'base64').toString('binary');
              const ab = new ArrayBuffer(bin.length);
              const u8 = new Uint8Array(ab);
              for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
              const buf = await new Promise((res, rej) => {
                const p = c.decodeAudioData(ab, res, rej);
                if (p && p.then) p.then(res, rej);
              });
              return { midi: +k, buf };
            })
          )
            .then((bufs) => {
              bufs.sort((a, b) => a.midi - b.midi);
              // 持续音的循环接缝：在解码后的实际数据上，把末尾 0.35 秒淡化成循环起点之前的那一段，
              // 这样无论 MP3 解码带不带编码延迟，首尾都能接上（不会"啪"一声）
              if (inst.loop) {
                for (const { buf } of bufs) {
                  const sr = buf.sampleRate;
                  const a = Math.round(inst.loop[0] * sr);
                  const b = Math.min(buf.length, Math.round(inst.loop[1] * sr));
                  const L = Math.round(0.35 * sr);
                  if (b - L <= a || a - L < 0) continue;
                  const ch = buf.getChannelData(0);
                  for (let i = 0; i < L; i++) {
                    const w = (i / L) * (Math.PI / 2);
                    ch[b - L + i] = ch[b - L + i] * Math.cos(w) + ch[a - L + i] * Math.sin(w);
                  }
                }
              }
              this.S[name] = { loop: inst.loop, len: bufs[0].buf.duration, bufs };
            })
            .catch(() => {
              this.loading[name] = null; // 解码失败：这个乐器继续用合成声音
            });
        }
        jobs.push(this.loading[name]);
      }
      return Promise.all(jobs);
    }

    // 采样乐器弹一个音：找最近的采样，变速补足音高；持续音用循环拉长。没有这个乐器就返回 false（调用方退回合成声音）
    samp(inst, m, t, dur, vol, o) {
      const S = this.useSamples && this.S[inst];
      if (!S) return false;
      o = o || {};
      let best = S.bufs[0];
      for (const b of S.bufs) if (Math.abs(b.midi - m) < Math.abs(best.midi - m)) best = b;
      const c = this.ctx;
      const rate = Math.pow(2, (m - best.midi) / 12);
      const src = c.createBufferSource();
      src.buffer = best.buf;
      src.playbackRate.value = rate;
      if (S.loop) {
        src.loop = true;
        src.loopStart = S.loop[0];
        src.loopEnd = S.loop[1];
      }
      let node = src;
      if (o.lp) {
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = o.lp;
        node.connect(lp);
        node = lp;
      }
      const g = c.createGain();
      const a = o.attack || 0.02;
      const r = o.release || 0.25;
      const v = vol * (GAIN[inst] || 1);
      // 衰减音（鼓、钟、竖琴）自己会衰减，最多放到采样结束
      const end = S.loop ? dur : Math.min(dur, S.len / rate);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + a);
      g.gain.setValueAtTime(v, t + Math.max(a, end));
      g.gain.exponentialRampToValueAtTime(0.0001, t + end + r);
      node.connect(g);
      let out = g;
      if (o.pan && c.createStereoPanner) {
        const pn = c.createStereoPanner();
        pn.pan.value = o.pan;
        g.connect(pn);
        out = pn;
      }
      out.connect(o.bus || this.bus.strings);
      src.start(t);
      src.stop(t + end + r + 0.05);
      return true;
    }

    // 程序生成的"房间"：随时间衰减的立体声噪声，高频衰减得更快
    impulse(sec) {
      const sr = this.ctx.sampleRate;
      const len = Math.floor(sr * sec);
      const buf = this.ctx.createBuffer(2, len, sr);
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        let lp = 0;
        for (let i = 0; i < len; i++) {
          const x = i / len;
          const k = 0.35 + 0.6 * x; // 越到后面越暗
          lp += (Math.random() * 2 - 1 - lp) * (1 - k * 0.85);
          d[i] = lp * Math.pow(1 - x, 2.6) * 1.8;
        }
      }
      return buf;
    }

    makeNoise(sec) {
      const sr = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, Math.floor(sr * sec), sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    }

    setVolume(v, sec) {
      const t = this.ctx.currentTime;
      const g = this.out.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(Math.max(0.0001, g.value), t);
      if (sec) g.exponentialRampToValueAtTime(Math.max(0.0001, v), t + sec);
      else g.setValueAtTime(Math.max(0.0001, v), t);
    }

    // ---------------- 基础积木 ----------------
    // 一个振荡器经过可选滤波器和包络，送到某个声部总线
    tone(o) {
      const c = this.ctx;
      const osc = c.createOscillator();
      osc.type = o.type || 'sawtooth';
      osc.frequency.setValueAtTime(o.f, o.t);
      if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, o.t + (o.slideTime || o.dur));
      if (o.detune) osc.detune.value = o.detune;
      let node = osc;
      if (o.lp) {
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.Q.value = o.q || 0.7;
        lp.frequency.setValueAtTime(o.lp, o.t);
        if (o.lpTo) {
          lp.frequency.linearRampToValueAtTime(o.lpTo, o.t + (o.lpTime || 0.1));
          if (o.lpEnd) lp.frequency.exponentialRampToValueAtTime(o.lpEnd, o.t + o.dur);
        }
        node.connect(lp);
        node = lp;
      }
      const g = c.createGain();
      const a = o.attack || 0.01;
      const r = o.release || 0.1;
      g.gain.setValueAtTime(0.0001, o.t);
      g.gain.linearRampToValueAtTime(o.vol, o.t + a);
      g.gain.setValueAtTime(o.vol, o.t + Math.max(a, o.dur - r));
      g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur + 0.02);
      node.connect(g);
      g.connect(o.bus || this.bus.strings);
      if (o.vibrato) {
        const lfo = c.createOscillator();
        const lg = c.createGain();
        lfo.frequency.value = 5.2 + Math.random() * 0.6;
        lg.gain.value = o.f * o.vibrato;
        lfo.connect(lg);
        lg.connect(osc.frequency);
        lfo.start(o.t);
        lfo.stop(o.t + o.dur + 0.05);
      }
      osc.start(o.t);
      osc.stop(o.t + o.dur + 0.06);
      return osc;
    }

    noiseHit(o) {
      const c = this.ctx;
      const src = c.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = o.filter || 'highpass';
      f.Q.value = o.q || 0.7;
      f.frequency.setValueAtTime(o.f, o.t);
      if (o.fTo) f.frequency.exponentialRampToValueAtTime(o.fTo, o.t + o.dur);
      const g = c.createGain();
      const a = o.attack || 0.002;
      g.gain.setValueAtTime(0.0001, o.t);
      g.gain.linearRampToValueAtTime(o.vol, o.t + a);
      if (o.swell) g.gain.linearRampToValueAtTime(o.vol, o.t + o.dur * 0.9);
      g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
      src.connect(f);
      f.connect(g);
      g.connect(o.bus || this.bus.perc);
      src.start(o.t, Math.random() * 2);
      src.stop(o.t + o.dur + 0.05);
    }

    // ---------------- 乐器 ----------------
    // 低音弦乐：三个走音的锯齿波 + 颤音
    cello(m, t, dur, vol) {
      if (this.samp('cello', m, t, dur, vol, { attack: 0.12, release: 0.5, bus: this.bus.strings })) {
        if (m < 52) this.samp('contrabass', m, t, dur, vol * 0.7, { attack: 0.14, release: 0.5, bus: this.bus.bass });
        return;
      }
      const f = hz(m);
      for (const d of [-9, 0, 9]) this.tone({ f, t, dur, vol: vol / 2.2, detune: d, lp: Math.min(2400, f * 5), attack: 0.14, release: 0.4, vibrato: 0.004, bus: this.bus.strings });
    }
    // 弦乐群：高一点、亮一点
    strings(m, t, dur, vol) {
      if (this.samp('string_ensemble_1', m, t, dur, vol, { attack: 0.45, release: 0.9, pan: (Math.random() - 0.5) * 0.7, bus: this.bus.strings })) return;
      const f = hz(m);
      for (const d of [-8, 8]) this.tone({ f, t, dur, vol: vol / 1.6, detune: d, lp: 2800, attack: 0.4, release: 0.7, vibrato: 0.003, bus: this.bus.strings });
    }
    // 短弓（紧张时的快速音型）
    spiccato(m, t, vol) {
      if (this.samp('pizzicato_strings', m, t, 0.6, vol, { attack: 0.003, release: 0.3, pan: (Math.random() - 0.5) * 0.5, bus: this.bus.strings })) return;
      const f = hz(m);
      this.tone({ f, t, dur: 0.12, vol, lp: 3200, lpTo: 1500, lpTime: 0.1, attack: 0.004, release: 0.08, bus: this.bus.strings });
      this.tone({ f, t, dur: 0.12, vol: vol * 0.6, detune: 11, lp: 2600, attack: 0.004, release: 0.08, bus: this.bus.strings });
    }
    // 颤音弦乐：紧张档的"发抖"
    trem(m, t, dur, vol) {
      if (this.samp('tremolo_strings', m, t, dur, vol, { attack: 0.35, release: 0.7, pan: (Math.random() - 0.5) * 0.8, bus: this.bus.strings })) return;
      this.strings(m, t, dur, vol * 0.7);
    }
    // 铜管组：Boss 的重音和弦
    brass(m, t, dur, vol) {
      if (this.samp('brass_section', m, t, dur, vol, { attack: 0.05, release: 0.25, bus: this.bus.brass })) return;
      this.horn(m, t, dur, vol);
    }
    // 圆号 / 铜管：低通随起音打开
    horn(m, t, dur, vol, attack) {
      if (this.samp('french_horn', m, t, dur, vol, { attack: attack || 0.07, release: 0.25, bus: this.bus.brass })) return;
      const f = hz(m);
      const a = attack || 0.06;
      this.tone({ f, t, dur, vol: vol * 0.7, lp: f * 1.6, lpTo: Math.min(f * 7, 4200), lpTime: a + 0.04, lpEnd: f * 2.6, attack: a, release: 0.18, bus: this.bus.brass });
      this.tone({ f, t, dur, vol: vol * 0.45, type: 'square', detune: 6, lp: f * 2, lpTo: Math.min(f * 5, 3000), lpTime: a + 0.04, lpEnd: f * 2, attack: a, release: 0.18, bus: this.bus.brass });
    }
    // 合唱"啊"：锯齿波 → 三个共振峰
    choir(m, t, dur, vol) {
      if (this.samp('choir_aahs', m, t, dur, vol, { attack: Math.min(0.9, dur * 0.4), release: 0.8, pan: (Math.random() - 0.5) * 0.9, bus: this.bus.choir })) return;
      const c = this.ctx;
      const f = hz(m);
      const sum = c.createGain();
      const a = Math.min(0.9, dur * 0.4);
      sum.gain.setValueAtTime(0.0001, t);
      sum.gain.linearRampToValueAtTime(vol, t + a);
      sum.gain.setValueAtTime(vol, t + Math.max(a, dur - 0.8));
      sum.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.02);
      sum.connect(this.bus.choir);
      for (const [ff, q, gain] of [[730, 5, 1], [1090, 6, 0.6], [2440, 8, 0.2]]) {
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = ff;
        bp.Q.value = q;
        const gg = c.createGain();
        gg.gain.value = gain;
        bp.connect(gg);
        gg.connect(sum);
        for (const d of [-7, 7]) {
          const o = c.createOscillator();
          o.type = 'sawtooth';
          o.frequency.setValueAtTime(f, t);
          o.detune.value = d;
          const lfo = c.createOscillator();
          const lg = c.createGain();
          lfo.frequency.value = 4.8 + Math.random() * 0.8;
          lg.gain.value = f * 0.006;
          lfo.connect(lg);
          lg.connect(o.frequency);
          o.connect(bp);
          o.start(t);
          o.stop(t + dur + 0.06);
          lfo.start(t);
          lfo.stop(t + dur + 0.06);
        }
      }
    }
    // 太鼓 / 定音鼓：正弦下滑 + 膜体二次谐波 + 撞击噪声
    taiko(t, vol, f) {
      f = f || 62;
      const mm = Math.max(34, Math.min(62, Math.round(12 * Math.log2(f / 440) + 69)));
      if (this.useSamples && this.S.timpani) {
        this.samp('timpani', mm, t, 3, vol, { attack: 0.002, bus: this.bus.perc });
        if (vol >= 0.3) this.samp('taiko_drum', Math.max(36, mm - 4), t, 2, vol * 0.8, { attack: 0.002, bus: this.bus.perc });
        // 底下仍叠一层低频正弦，保证"沉"
        this.tone({ type: 'sine', f: f * 1.6, slideTo: f, slideTime: 0.2, t, dur: 0.45, vol: vol * 0.55, attack: 0.003, release: 0.35, bus: this.bus.perc });
        return;
      }
      this.tone({ type: 'sine', f: f * 2.6, slideTo: f, slideTime: 0.2, t, dur: 0.5, vol, attack: 0.003, release: 0.4, bus: this.bus.perc });
      this.tone({ type: 'triangle', f: f * 1.7, slideTo: f * 0.85, slideTime: 0.25, t, dur: 0.35, vol: vol * 0.45, attack: 0.003, release: 0.3, bus: this.bus.perc });
      this.noiseHit({ filter: 'bandpass', f: 240, q: 1, t, dur: 0.07, vol: vol * 0.7 });
    }
    snare(t, vol) {
      this.noiseHit({ filter: 'bandpass', f: 1900, q: 0.9, t, dur: 0.17, vol });
      this.tone({ type: 'triangle', f: 200, slideTo: 130, slideTime: 0.1, t, dur: 0.12, vol: vol * 0.8, attack: 0.002, release: 0.1, bus: this.bus.perc });
    }
    hat(t, vol, open) {
      this.noiseHit({ filter: 'highpass', f: 7500, t, dur: open ? 0.16 : 0.04, vol });
    }
    cymbalSwell(t, dur, vol) {
      this.noiseHit({ filter: 'highpass', f: 3600, t, dur, vol, swell: true, attack: dur * 0.85, q: 0.5 });
    }
    crash(t, vol) {
      this.noiseHit({ filter: 'highpass', f: 3000, t, dur: 1.5, vol, q: 0.5 });
    }
    riser(t, dur, vol) {
      this.noiseHit({ filter: 'bandpass', f: 300, fTo: 6500, q: 3, t, dur, vol, swell: true, attack: dur * 0.9, bus: this.bus.perc });
    }
    // 钟 / 钢片琴：非整数倍泛音，长衰减
    bell(m, t, vol, dur) {
      if (m >= 84 ? this.samp('celesta', m, t, 2, vol, { attack: 0.003, bus: this.bus.lead }) : this.samp('tubular_bells', m, t, 3, vol, { attack: 0.003, bus: this.bus.lead })) return;
      const f = hz(m);
      dur = dur || 2.2;
      [[1, 1, 1], [2.76, 0.5, 0.65], [5.4, 0.25, 0.4], [8.93, 0.12, 0.25]].forEach(([mul, g, dd]) => this.tone({ type: 'sine', f: f * mul, t, dur: dur * dd, vol: vol * g, attack: 0.004, release: dur * dd * 0.9, bus: this.bus.lead }));
    }
    pluck(m, t, vol) {
      if (this.samp('orchestral_harp', m, t, 2, vol, { attack: 0.003, bus: this.bus.lead })) return;
      const f = hz(m);
      this.tone({ type: 'triangle', f, t, dur: 0.6, vol, attack: 0.004, release: 0.5, bus: this.bus.lead });
      this.tone({ type: 'sine', f: f * 2, t, dur: 0.18, vol: vol * 0.4, attack: 0.003, release: 0.15, bus: this.bus.lead });
    }
    marimba(m, t, vol) {
      if (this.samp('marimba', m, t, 1.4, vol, { attack: 0.003, bus: this.bus.lead })) return;
      const f = hz(m);
      this.tone({ type: 'sine', f, t, dur: 0.45, vol, attack: 0.003, release: 0.4, bus: this.bus.lead });
      this.tone({ type: 'sine', f: f * 4, t, dur: 0.08, vol: vol * 0.5, attack: 0.002, release: 0.07, bus: this.bus.lead });
    }
    reed(m, t, dur, vol) {
      if (this.samp('oboe', m, t, dur, vol, { attack: 0.06, release: 0.2, bus: this.bus.lead })) return;
      const f = hz(m);
      this.tone({ type: 'sawtooth', f, t, dur, vol: vol * 0.6, lp: 1700, q: 2.5, attack: 0.06, release: 0.12, vibrato: 0.005, bus: this.bus.lead });
      this.tone({ type: 'square', f, t, dur, vol: vol * 0.3, detune: 5, lp: 1300, attack: 0.06, release: 0.12, vibrato: 0.005, bus: this.bus.lead });
    }
    flute(m, t, dur, vol) {
      if (this.samp('flute', m, t, dur, vol, { attack: 0.08, release: 0.25, bus: this.bus.lead })) return;
      const f = hz(m);
      this.tone({ type: 'sine', f, t, dur, vol, attack: 0.09, release: 0.2, vibrato: 0.006, bus: this.bus.lead });
      this.tone({ type: 'triangle', f: f * 2, t, dur, vol: vol * 0.25, attack: 0.1, release: 0.2, bus: this.bus.lead });
      this.noiseHit({ filter: 'bandpass', f: 4200, q: 1.5, t, dur: Math.min(dur, 0.4), vol: vol * 0.08, bus: this.bus.lead, attack: 0.05 });
    }
    sub(m, t, dur, vol) {
      const f = hz(m);
      this.samp('contrabass', m + 12, t, dur, vol * 0.8, { attack: 0.02, release: 0.12, bus: this.bus.bass });
      this.tone({ type: 'sine', f, t, dur, vol, attack: 0.012, release: 0.1, bus: this.bus.bass });
      this.tone({ type: 'sawtooth', f, t, dur, vol: vol * 0.5, lp: 190, attack: 0.012, release: 0.1, bus: this.bus.bass });
    }
    // 主奏：菜单 / 地图 / 标题里的旋律音色
    leadNote(kind, m, t, dur, vol) {
      switch (kind) {
        case 'bell':
          return this.bell(m, t, vol, Math.max(1.6, dur * 1.4));
        case 'pluck':
          return this.pluck(m, t, vol * 1.3);
        case 'marimba':
          return this.marimba(m, t, vol * 1.4);
        case 'reed':
          return this.reed(m, t, dur, vol);
        case 'flute':
          return this.flute(m, t, dur, vol * 1.2);
        default:
          return this.horn(m, t, dur, vol * 1.1);
      }
    }

    // ---------------- 编曲 ----------------
    setTheme(id, mode) {
      const changed = this.themeId !== id;
      this.themeId = id;
      this.theme = THEMES[id] || THEMES[1];
      this.mode = mode;
      if (changed || this.nextTime === 0) {
        this.step = 0;
        this.nextTime = this.ctx.currentTime + 0.1;
      }
    }

    // 排好 until 之前的所有音符
    schedule(until) {
      const th = this.theme;
      if (!th || this.hold) return;
      while (this.nextTime < until) {
        this.scheduleStep(this.step, this.nextTime);
        const tf = this.mode === 'battle' ? TEMPO[Math.min(3, this.tension)] : 1;
        this.nextTime += 60 / (th.bpm * tf) / 4;
        this.step++;
      }
    }

    scheduleStep(i, t) {
      const th = this.theme;
      const sd = 60 / th.bpm / 4; // 一个十六分音符
      const bar = Math.floor(i / 16) % 8;
      const pos = i % 16;
      const ch = th.chords[bar];
      const battle = this.mode === 'battle';
      const title = this.mode === 'title';
      const L = battle ? Math.min(3, this.tension) : -1;
      const barLen = sd * 16;
      const notes = th.notes;
      const mel = notes[bar * 8 + Math.floor(pos / 2)];
      const onBeat8 = pos % 2 === 0;

      // —— 铺底：低音弦乐、弦乐群（每小节一次）——
      if (pos === 0) {
        this.cello(ch.root, t, barLen, battle ? 0.2 : title ? 0.24 : 0.17);
        if (bar % 2 === 0) this.cello(ch.root + 7, t, barLen * 2, 0.07);
        const sv = battle ? 0.045 : 0.05;
        for (const m of ch.tones.slice(0, 3)) this.strings(m, t, barLen, sv);
      }

      if (!battle) {
        // —— 菜单 / 地图 / 标题：深沉、缓慢 ——
        if (pos === 0 && (title || bar % 2 === 0)) this.taiko(t, title ? 0.42 : 0.2, 55);
        if (title && pos === 8 && bar % 2 === 1) this.taiko(t, 0.22, 62);
        if (pos === 0 && (title || bar % 2 === 0)) for (const m of ch.tones.slice(0, 3)) this.choir(m + 12, t, barLen * (title ? 1 : 2), title ? 0.035 : 0.02);
        if (title && pos === 0 && bar % 4 === 0) {
          this.cymbalSwell(t, barLen * 0.95, 0.05);
          this.crash(t + barLen, 0.05);
        }
        if (mel && (title || bar % 2 === 0 || pos < 8)) this.leadNote(th.lead, mel.midi, t, mel.len * sd * 2, title ? 0.1 : 0.085);
        // 地图上稀疏的低沉脉冲
        if (!title && pos === 8 && bar % 2 === 1) this.sub(ch.root, t, sd * 6, 0.1);
        return;
      }

      // —— 战斗 ——
      const D = DRUMS[L];
      // 低音脉冲
      const pulse = L === 0 ? pos === 0 || pos === 6 || pos === 8 || pos === 14 : L === 3 ? true : onBeat8;
      if (pulse) this.sub(ch.root, t, sd * (L === 3 ? 1.5 : 2.6), L === 3 && pos % 4 !== 0 ? 0.1 : 0.17);
      // 短弓琶音
      if (L >= 1 || onBeat8) {
        const idx = ARP[pos % 8];
        const accent = pos % 4 === 0;
        this.spiccato(ch.tones[idx], t, (L >= 1 ? 0.04 : 0.032) * (accent ? 1.4 : 1));
        if (L >= 2 && pos % 4 === 2) this.spiccato(ch.tones[idx] + 12, t, 0.025);
      }
      // 鼓
      const k = D.kick[pos];
      if (k === 'K') this.taiko(t, L >= 2 ? 0.46 : 0.36, L === 3 && bar % 2 ? 58 : 62);
      else if (k === 'k') this.taiko(t, 0.17, 78);
      const sn = D.snare[pos];
      if (sn === 'S') this.snare(t, 0.22);
      else if (sn === 's') this.snare(t, 0.1);
      else if (sn === 't') this.taiko(t, 0.2, 98);
      if (D.hat[pos] === 'h') this.hat(t, L === 0 ? 0.022 : pos % 4 === 2 ? 0.045 : 0.026, L >= 2 && pos === 14);
      // 通鼓过门（每四小节的最后一小节）
      if (L >= 2 && bar % 4 === 3 && pos >= 12) this.taiko(t, 0.2 + (pos - 12) * 0.05, 100 - (pos - 12) * 8);
      if (L === 3 && bar % 4 === 3 && pos >= 12) this.snare(t, 0.12 + (pos - 12) * 0.05);
      // 圆号：主旋律（正常档只奏偶数小节，之后每小节）
      if (mel && (L >= 1 || bar % 2 === 0)) {
        this.horn(mel.midi, t, mel.len * sd * 2 * 0.95, L >= 2 ? 0.15 : 0.12);
        if (L === 3) this.horn(mel.midi + 12, t, mel.len * sd * 2 * 0.9, 0.07);
        if (th.lead !== 'horn') this.leadNote(th.lead, mel.midi, t, mel.len * sd * 2, 0.05);
      }
      // 圆号长音渐强（危险以上）
      if (pos === 0 && L >= 1) {
        this.horn(ch.root + 12, t, barLen * 0.98, 0.05, barLen * 0.5);
        this.horn(ch.root + 19, t, barLen * 0.98, 0.04, barLen * 0.5);
      }
      // 颤音弦乐：危险档偶数小节、Boss 档每小节，铺一层"发抖"的紧张感
      if (pos === 0 && L >= 1 && (L >= 2 || bar % 2 === 0)) for (const m of ch.tones.slice(0, 3)) this.trem(m + (L === 3 ? 12 : 0), t, barLen, L >= 2 ? 0.05 : 0.035);
      // 合唱：危险时偶数小节，Boss 档每小节
      if (pos === 0 && L >= 1 && (L >= 2 || bar % 2 === 0)) for (const m of ch.tones.slice(0, 3)) this.choir(m + 12, t, barLen, L >= 2 ? 0.05 : 0.025);
      // Boss 档：铜管重音 + 低频压迫 + 增四度不和谐音 + 镲渐强
      if (L >= 2) {
        if (pos === 0 || pos === 10 || (L === 3 && pos === 6)) {
          for (const m of [ch.root + 12, ch.root + 19, ch.root + 24]) this.brass(m, t, sd * 3, 0.085);
        }
        if (pos === 0 && bar % 2 === 0) {
          this.cello(ch.root - 12 + 6, t, barLen * 2, 0.05);
          this.sub(ch.root - 12, t, barLen * 2, 0.12);
        }
        if (pos === 0 && (L === 3 || bar % 2 === 1)) {
          this.cymbalSwell(t, barLen * 0.95, 0.045);
          this.crash(t + barLen, 0.06);
        }
        if (L === 3 && pos === 0 && bar % 4 === 0) this.riser(t, sd * 14, 0.05);
      }
    }

    // 一次性的"结束音 / 登场音"（立刻播放）
    stinger(name) {
      const t = this.ctx.currentTime + 0.05;
      const th = this.theme || THEMES[1];
      const sd = 60 / th.bpm / 4;
      const root = (th.chords[0] || parseChord('Dm')).root;
      if (name === 'boss') {
        // 低音铜管重击 + 合唱渐强 + 上升噪声 + 三下太鼓 + 镲
        this.horn(root, t, 1.8, 0.2, 0.05);
        this.horn(root + 7, t, 1.8, 0.16, 0.05);
        this.horn(root + 12, t, 1.8, 0.14, 0.05);
        this.cello(root - 12 + 6, t, 2.4, 0.1);
        for (const m of [root + 12, root + 19, root + 24]) this.choir(m, t, 2.2, 0.07);
        this.riser(t, 1.5, 0.09);
        [0, 0.2, 0.4, 1.5].forEach((d, k) => this.taiko(t + d, k === 3 ? 0.65 : 0.5, 50));
        this.crash(t + 1.5, 0.12);
      } else if (name === 'win') {
        const C = 60;
        [0, 4, 7, 12].forEach((s, k) => this.horn(C + s, t + k * 0.16, k === 3 ? 1.6 : 0.5, 0.22));
        for (const m of [C - 12, C - 5, C + 4]) this.strings(m, t, 2.2, 0.06);
        this.taiko(t, 0.5, 70);
        this.crash(t + 0.5, 0.11);
      } else if (name === 'lose') {
        [0, -2, -4, -7].forEach((s, k) => this.cello(root + 12 + s, t + k * 0.55, 1.2, 0.26));
        this.horn(root, t, 3, 0.09, 0.4);
        this.taiko(t + 1.7, 0.55, 46);
        this.choir(root + 12, t, 3, 0.04);
      } else if (name === 'wave') {
        this.taiko(t, 0.35, 70);
        this.horn(root + 12, t, sd * 4, 0.09);
      }
    }
  }

  const M = (TD.music = { enabled: true, theme: null, mode: 'calm', tension: 0, playing: false, Engine, THEMES, DRUMS, GAIN });

  let engine = null;
  let timer = null;
  let loadToken = 0;
  const LEVEL = { title: 0.5, calm: 0.42, battle: [0.5, 0.55, 0.6, 0.66] };
  // 总音量随模式和紧张度走：越紧张越响（设计书 64.5）
  M.levelFor = (mode, tension) => (mode === 'battle' ? LEVEL.battle[Math.max(0, Math.min(3, tension | 0))] : LEVEL[mode] || 0.42);

  function ensure() {
    if (!TD.audio || !TD.audio.ctx) return null;
    if (!engine) engine = new Engine(TD.audio.ctx, TD.audio.ctx.destination);
    return engine;
  }

  function tick() {
    if (!engine) return;
    engine.schedule(engine.ctx.currentTime + 0.3);
  }

  // 音量 0–1（设计书 49）
  M.volume = 1;
  M.setVolume = function (v) {
    M.volume = Math.max(0, Math.min(1, v));
    if (M.playing && engine) engine.setVolume(M.levelFor(M.mode, M.tension) * M.volume, 0.2);
  };

  // 切换曲子：theme 为章节号（0 = 标题），mode 为 'title' / 'calm'（菜单、地图）/ 'battle'
  M.play = function (theme, mode) {
    M.want = { theme, mode };
    const eng = ensure();
    if (!M.enabled || !eng || eng.ctx.state !== 'running') return;
    if (M.theme === theme && M.mode === mode && M.playing) return;
    const wasPlaying = M.playing;
    M.theme = theme;
    M.mode = mode;
    if (mode !== 'battle') M.tension = 0;
    eng.tension = M.tension;
    eng.setTheme(theme, mode);
    if (!wasPlaying) eng.nextTime = eng.ctx.currentTime + 0.1;
    // 要用的乐器采样还没解码好：先不排音符，解码完（最多等 4 秒）再开始，避免"先合成声、后真乐器"的音色突变
    const names = Engine.instrumentsFor(theme);
    if (TD.samples && names.some((n) => TD.samples[n] && !eng.S[n])) {
      const token = ++loadToken;
      eng.hold = true;
      const go = () => {
        if (token !== loadToken || !eng.hold) return;
        eng.hold = false;
        eng.nextTime = eng.ctx.currentTime + 0.1;
      };
      eng.loadSamples(names).then(go, go);
      setTimeout(go, 4000);
    } else eng.hold = false;
    eng.setVolume(M.levelFor(mode, M.tension) * M.volume, 0.8);
    if (!timer) timer = setInterval(tick, 40);
    M.playing = true;
  };

  // 紧张度（设计书 64.5）：0 战斗 1 危险 2 Boss 3 Boss + 危险
  M.setTension = function (level) {
    if (level === M.tension) return;
    M.tension = level;
    if (engine) {
      engine.tension = level;
      if (M.playing && M.mode === 'battle') engine.setVolume(M.levelFor('battle', level) * M.volume, 1.2);
    }
  };

  // 一次性的音乐"刺"：boss / win / lose / wave
  const lastStinger = {};
  M.stinger = function (name) {
    if (!M.enabled || !engine || engine.ctx.state !== 'running') return;
    const now = engine.ctx.currentTime;
    if (lastStinger[name] && now - lastStinger[name] < 4) return;
    lastStinger[name] = now;
    engine.stinger(name);
  };

  // 战斗结束：音乐回到"菜单"档，配一段结束音
  M.battleEnd = function (win) {
    if (M.theme === null) return;
    M.mode = 'calm';
    M.tension = 0;
    if (engine) {
      engine.mode = 'calm';
      engine.tension = 0;
      engine.setVolume(M.levelFor('calm', 0) * M.volume, 1.5);
    }
    M.stinger(win ? 'win' : 'lose');
  };

  M.stop = function () {
    M.playing = false;
    if (engine) engine.setVolume(0.0001, 0.6);
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
  // 调试用：看看采样解码到哪了
  M.status = () => (engine ? { loaded: Object.keys(engine.S), hold: engine.hold, state: engine.ctx.state } : null);
})((globalThis.TD = globalThis.TD || {}));
