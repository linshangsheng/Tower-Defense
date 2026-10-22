// 配乐的"作曲层"（设计书 105）：把每首曲子手写的 8 小节主题（和弦 + 旋律），展开成 32 小节的完整总谱：
//   A  主题陈述（原曲）
//   A' 变奏：旋律加装饰音，配上低八度的三度对位旋律，和声加七音 / 九音
//   B  桥段：新的和声进行（相对大调 / 下属方向），旋律是主题动机的"模进"，层层上行，最后停在新调的属七和弦上
//   A''高潮：整体升高一个大二度转调，最后一小节回到原调的属七和弦，下一遍循环接回 A
// 只有纯数据和算法（没有 Web Audio），所以 Node 里也能跑、能测。
(function (TD) {
  'use strict';

  const S = (TD.score = {});
  const PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const mod12 = (n) => ((n % 12) + 12) % 12;

  // ---------- 和弦 ----------
  // 支持：大 / 小 / 减 / 5 / 7 / m7 / maj7 / m9 / dim7 / sus2 / sus4 / add9，以及斜线低音（如 Dm/F）
  const CHORD_RE = /^([A-G][#b]?)(maj7|m7|m9|dim7|dim|sus4|sus2|add9|m|7|5)?(?:\/([A-G][#b]?))?$/;
  S.chord = function (sym) {
    const m = CHORD_RE.exec(sym);
    if (!m) throw new Error('unknown chord: ' + sym);
    return S.mk(PC[m[1]], m[2] || '', m[3] ? PC[m[3]] : undefined);
  };
  // 由根音音级 + 性质造和弦。root 是第 2 八度的根音；tones 是 [根, 三, 五, 高八度根]（第 3 八度起，琶音用）；
  // third / fifth / seventh / ninth 是相对根音的半音数（没有就是 null）
  S.mk = function (pc, q, bassPc) {
    pc = mod12(pc);
    let third = 4;
    let fifth = 7;
    let seventh = null;
    let ninth = null;
    switch (q) {
      case 'm': third = 3; break;
      case 'dim': third = 3; fifth = 6; break;
      case '5': third = 7; break;
      case '7': seventh = 10; break;
      case 'm7': third = 3; seventh = 10; break;
      case 'maj7': seventh = 11; break;
      case 'm9': third = 3; seventh = 10; ninth = 14; break;
      case 'dim7': third = 3; fifth = 6; seventh = 9; break;
      case 'sus4': third = 5; break;
      case 'sus2': third = 2; break;
      case 'add9': ninth = 14; break;
      default:
    }
    const base3 = 48 + pc;
    const bassP = bassPc === undefined ? pc : mod12(bassPc);
    return {
      sym: NAMES[pc] + q + (bassPc === undefined || bassP === pc ? '' : '/' + NAMES[bassP]),
      pc,
      q,
      root: 36 + pc,
      bassPc: bassP,
      bass: 36 + bassP,
      third,
      fifth,
      seventh,
      ninth,
      tones: [base3, base3 + third, base3 + fifth, base3 + 12],
    };
  };
  // 和弦里所有音级（0..11）：根 + 三 + 五 (+ 七 + 九)
  S.pcs = (ch) => [ch.pc, ch.pc + ch.third, ch.pc + ch.fifth].concat(ch.seventh === null ? [] : [ch.pc + ch.seventh], ch.ninth === null ? [] : [ch.pc + ch.ninth]).map(mod12);

  // ---------- 调式 ----------
  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    harm: [0, 2, 3, 5, 7, 8, 11],
    phrygDom: [0, 1, 4, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixo: [0, 2, 4, 5, 7, 9, 10],
  };
  // 按旋律音和和弦音，在 7 种调式 × 候选主音里挑最合适的一个
  S.detectKey = function (th) {
    const weight = new Array(12).fill(0);
    for (const n of th.notes) if (n) weight[mod12(n.midi)] += n.len * 2;
    for (const ch of th.chords) for (const p of S.pcs(ch)) weight[p] += 1;
    const cands = new Set([th.chords[0].pc, th.chords[th.chords.length - 1].pc, th.chords[2].pc, th.chords[4].pc]);
    let best = null;
    for (const tonic of cands) {
      for (const name of Object.keys(SCALES)) {
        const set = new Set(SCALES[name].map((x) => mod12(x + tonic)));
        let sc = 0;
        for (let p = 0; p < 12; p++) sc += set.has(p) ? weight[p] : -weight[p] * 1.5;
        // 开头的和弦是主和弦：主音的三度对得上大 / 小调再加分
        const first = th.chords[0];
        if (first.pc === tonic) sc += 6 + (set.has(mod12(first.pc + first.third)) ? 4 : 0);
        if (!best || sc > best.score) best = { tonic, name, score: sc };
      }
    }
    const scale = SCALES[best.name].map((x) => mod12(x + best.tonic));
    return { tonic: best.tonic, name: best.name, scale, minor: scale.includes(mod12(best.tonic + 3)) && !scale.includes(mod12(best.tonic + 4)), degrees: SCALES[best.name] };
  };

  // 音高 ↔ 音阶级数（把不在音阶里的音归到最近的音阶音）
  function toIdx(midi, key) {
    const rel = midi - key.tonic;
    const oct = Math.floor(rel / 12);
    const within = mod12(rel);
    let bi = 0;
    let bd = 99;
    key.degrees.forEach((d, i) => {
      const dd = Math.abs(d - within);
      if (dd < bd) {
        bd = dd;
        bi = i;
      }
    });
    return oct * 7 + bi;
  }
  function fromIdx(idx, key) {
    const oct = Math.floor(idx / 7);
    const i = ((idx % 7) + 7) % 7;
    return key.tonic + oct * 12 + key.degrees[i];
  }
  S.stepsOf = (midi, key) => toIdx(midi, key);
  S.shiftSteps = (midi, steps, key) => fromIdx(toIdx(midi, key) + steps, key);

  // ---------- 和声润色：给三和弦加七音 / 九音 ----------
  // variant 0：七和弦为主；variant 1：加九 / 小九为主（A' 用，更亮更开阔）
  S.colour = function (ch, key, variant) {
    if (ch.q !== '' && ch.q !== 'm') return ch;
    const deg = mod12(ch.pc - key.tonic);
    const minor = ch.q === 'm';
    let q = ch.q;
    if (key.minor) {
      if (minor && (deg === 0 || deg === 5)) q = variant ? 'm9' : 'm7';
      else if (!minor && (deg === 8 || deg === 3)) q = variant ? 'add9' : 'maj7';
      else if (!minor && deg === 7) q = '7';
      else if (!minor && deg === 10) q = variant ? 'add9' : '';
    } else {
      if (!minor && (deg === 0 || deg === 5)) q = variant ? 'add9' : 'maj7';
      else if (!minor && deg === 7) q = '7';
      else if (minor && (deg === 9 || deg === 2 || deg === 4)) q = variant ? 'm9' : 'm7';
    }
    return q === ch.q ? ch : S.mk(ch.pc, q, ch.bassPc === ch.pc ? undefined : ch.bassPc);
  };
  // 旋律音和新加的七 / 九音差一个半音会很刺耳：这样的和弦退回三和弦
  S.safeColour = function (ch, melodyPcs) {
    if (ch.seventh === null && ch.ninth === null) return ch;
    const ext = [ch.seventh === null ? null : mod12(ch.pc + ch.seventh), ch.ninth === null ? null : mod12(ch.pc + ch.ninth)].filter((x) => x !== null);
    for (const e of ext) for (const mp of melodyPcs) if (Math.abs(mod12(mp - e + 6) - 6) === 1) return S.mk(ch.pc, ch.q === 'm9' || ch.q === 'm7' ? 'm' : ch.q === 'dim7' ? 'dim' : '', ch.bassPc === ch.pc ? undefined : ch.bassPc);
    return ch;
  };

  // ---------- 声部连接：相邻和弦的内声部尽量就近走 ----------
  // 返回 [最低 … 最高] 4 个音（midi），音域大致在 50~78，用来给弦乐 / 圆号 / 人声垫和弦。
  // prev = 上一小节的声部；melPcs = 这一小节旋律用到的音级：垫底的音如果和旋律音差一个半音就会打架，
  // 所以那样的和弦音尽量不用（换成别的和弦音加倍），三音一定要有（和弦的性格在三音上）。
  S.voice = function (ch, prev, melPcs, melLow) {
    const cand = S.pcs(ch);
    const thirdPc = mod12(ch.pc + ch.third);
    const target = prev || [55, 59, 62, 67];
    const mel = melPcs || [];
    const clashes = (pc) => mel.some((mp) => Math.abs(mod12(mp - pc + 6) - 6) === 1);
    // 一遍搜索：ceil 声部最高音上限，spanMax 最宽跨度，distinct 至少几种音级
    const search = (ceil, spanMax, distinct) => {
      const opts = [];
      for (let m = 48; m <= ceil; m++) if (cand.includes(mod12(m))) opts.push(m);
      let best = null;
      const rec = (i, cur, cost) => {
        if (best && cost >= best.cost) return;
        if (i === 4) {
          const span = cur[3] - cur[0];
          if (span < 9 || span > spanMax) return;
          if (!cur.some((m) => mod12(m) === thirdPc)) return;
          if (new Set(cur.map(mod12)).size < distinct) return;
          const c2 = cost + Math.abs(cur[0] - 52) * 0.2;
          if (!best || c2 < best.cost) best = { cost: c2, notes: cur.slice() };
          return;
        }
        for (const m of opts) {
          if (i > 0 && m <= cur[i - 1]) continue; // 从低到高排，不重复
          cur.push(m);
          rec(i + 1, cur, cost + Math.abs(m - target[i]) + (clashes(mod12(m)) ? 14 : 0));
          cur.pop();
        }
      };
      rec(0, [], 0);
      return best && best.notes;
    };
    // 垫底的和声压在旋律下面（旋律最低音下方两个半音），免得和旋律挤在同一个音区互相遮盖；旋律很低时最多压到 64。
    // 找不到就逐步放宽：先放开上限，再放宽跨度和音级数，最后退回"根位叠三度"。
    const ceil = melLow ? Math.max(64, Math.min(78, melLow - 2)) : 78;
    const got = search(ceil, 22, 3) || search(78, 22, 3) || search(80, 26, 3) || search(84, 30, 2);
    if (got) return got;
    const root = 48 + ch.pc;
    return [root + 7 - 12 + 12, root + ch.third + 12, root + ch.fifth + 12, root + 24].sort((a, b) => a - b);
  };

  // ---------- 旋律处理 ----------
  // 旋律在 64 个八分音符位置里：{ midi, len } 或 null。events ↔ slots
  const toEvents = (slots) => {
    const ev = [];
    slots.forEach((n, i) => n && ev.push({ pos: i, midi: n.midi, len: n.len }));
    return ev;
  };
  const toSlots = (events, n) => {
    const out = new Array(n || 64).fill(null);
    for (const e of events) if (e.pos >= 0 && e.pos < out.length) out[e.pos] = { midi: e.midi, len: Math.max(1, Math.min(e.len, out.length - e.pos)) };
    return out;
  };
  S.transpose = (slots, semis) => slots.map((n) => (n ? { midi: n.midi + semis, len: n.len } : null));

  // 装饰：长音（四个八分音符以上）的最后两拍改成"上邻音 → 本音"的回旋，旋律不再干巴巴地停着
  S.embellish = function (slots, key) {
    const out = [];
    for (const e of toEvents(slots)) {
      if (e.len >= 4 && e.pos % 2 === 0 && e.pos % 8 !== 7) {
        const up = fromIdx(toIdx(e.midi, key) + 1, key);
        out.push({ pos: e.pos, midi: e.midi, len: e.len - 2 });
        out.push({ pos: e.pos + e.len - 2, midi: up, len: 1 });
        out.push({ pos: e.pos + e.len - 1, midi: e.midi, len: 1 });
      } else out.push(e);
    }
    return toSlots(out);
  };

  // 对位旋律：每个旋律音下方的"音阶三度"（够不着就用六度），落在中提琴 / 大提琴舒服的音域里
  S.counter = function (slots, key) {
    return slots.map((n) => {
      if (!n) return null;
      let m = fromIdx(toIdx(n.midi, key) - 2, key);
      while (m > 79) m -= 12;
      while (m < 52) m += 12;
      return { midi: m, len: n.len };
    });
  };

  // 桥段旋律：把主题开头两小节当"动机"，沿着桥段的和弦一组一组地模进（每一组再高一个音阶级数，越走越高），
  // 强拍上的音拉到和弦音上；最后一组换成一串上行的琶音，托着气氛冲向高潮
  S.bridgeMelody = function (th, key, chords) {
    const motif = toEvents(th.notes.slice(0, 16));
    const base = chords[0];
    const ev = [];
    for (let k = 0; k < 4; k++) {
      const ch = chords[k * 2];
      const bar0 = k * 16;
      if (k < 3) {
        const shift = toIdx(48 + ch.pc, key) - toIdx(48 + base.pc, key) + k;
        for (const e of motif) {
          let m = fromIdx(toIdx(e.midi, key) + shift, key);
          // 强拍（每小节第 1 拍、第 3 拍）对到和弦音
          if (e.pos % 4 === 0) m = nearestChordTone(m, ch);
          while (m > 91) m -= 12;
          while (m < 62) m += 12;
          ev.push({ pos: bar0 + e.pos, midi: m, len: e.len });
        }
      } else {
        // 上行琶音：七和弦的 根 → 三 → 五 → 七 → 高八度根，每个音两个八分音符，最后一个音拉长
        const tones = [ch.pc, ch.pc + ch.third, ch.pc + ch.fifth, ch.pc + (ch.seventh === null ? 12 : ch.seventh), ch.pc + 12];
        let m = 62;
        const notes = tones.map((t) => {
          while (mod12(m) !== mod12(t) || m < 62) m++;
          const v = m;
          m += 1;
          return v;
        });
        notes.forEach((v, j) => ev.push({ pos: bar0 + j * 2, midi: v, len: j === 4 ? 6 : 2 }));
        ev.push({ pos: bar0 + 10, midi: notes[4] + 2, len: 6 });
      }
    }
    return toSlots(ev);
  };
  function nearestChordTone(m, ch) {
    const pcs = S.pcs(ch);
    for (const d of [0, 1, -1, 2, -2, 3, -3]) if (pcs.includes(mod12(m + d))) return m + d;
    return m;
  }

  // 桥段的和声进行：4 个和弦各 2 小节，最后一个是"新调（原调升大二度）的属七"
  // 每项是 [相对主音的半音数, 性质]
  const BRIDGES = {
    minor: [
      [[8, 'maj7'], [10, ''], [3, 'maj7']],
      [[5, 'm7'], [8, 'maj7'], [10, '']],
      [[8, 'maj7'], [3, 'maj7'], [10, '']],
      [[3, 'maj7'], [8, 'maj7'], [5, 'm7']],
    ],
    major: [
      [[9, 'm7'], [5, 'maj7'], [2, 'm7']],
      [[5, 'maj7'], [7, ''], [4, 'm7']],
      [[9, 'm7'], [4, 'm7'], [5, 'maj7']],
      [[5, ''], [9, 'm7'], [2, 'm7']],
    ],
  };
  const hashOf = (s) => {
    let h = 7;
    for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h;
  };

  // 把一个和弦整体移调（保持性质，斜线低音一并移）
  const shiftChord = (ch, semis) => S.mk(ch.pc + semis, ch.q, ch.bassPc === ch.pc ? undefined : ch.bassPc + semis);

  // ---------- 总谱 ----------
  // 返回 { key, sections: [A, A', B, A''] }，每段：
  //   name, bars[8]: { chord, voicing }, melody[64], counter[64] | null, trans（相对原调升了几个半音）
  S.build = function (th) {
    const key = S.detectKey(th);
    const pcsOfBar = (slots, bar) => {
      const out = [];
      for (let i = bar * 8; i < bar * 8 + 8; i++) if (slots[i]) out.push(mod12(slots[i].midi));
      return out;
    };
    // 每一小节的和弦 + 声部连接
    const withVoicing = (chords, melody) => {
      let prev = null;
      return chords.map((chord, b) => {
        const lows = [];
        for (let k = b * 8; k < b * 8 + 8; k++) if (melody[k]) lows.push(melody[k].midi);
        const voicing = S.voice(chord, prev, pcsOfBar(melody, b), lows.length ? Math.min(...lows) : 0);
        prev = voicing;
        return { chord, voicing };
      });
    };
    const A = th.chords.map((c, b) => S.safeColour(S.colour(c, key, 0), pcsOfBar(th.notes, b)));
    const A2 = th.chords.map((c, b) => S.safeColour(S.colour(c, key, 1), pcsOfBar(th.notes, b)));
    const tpl = BRIDGES[key.minor ? 'minor' : 'major'][hashOf(th.name) % 4];
    const bridge = [];
    tpl.forEach(([off, q]) => {
      const c = S.mk(key.tonic + off, q);
      bridge.push(c, c);
    });
    // 最后两小节：新调的属七
    const vNew = S.mk(key.tonic + 2 + 7, '7');
    bridge.push(vNew, vNew);
    const bMel = S.bridgeMelody(th, key, bridge);
    const mel2 = S.embellish(th.notes, key);
    // 高潮：整体升高大二度；最后一小节落在原调的属七上，接回下一遍循环的 A
    const climaxChords = th.chords.map((c, b) => shiftChord(S.safeColour(S.colour(c, key, 0), pcsOfBar(th.notes, b)), 2));
    climaxChords[7] = S.mk(key.tonic + 7, '7');
    const climaxMel = S.transpose(th.notes, 2);
    // 最后一小节：原调属七的"五音"拖长，别把转调前的音带进来
    for (let i = 56; i < 64; i++) climaxMel[i] = null;
    climaxMel[56] = { midi: 60 + mod12(key.tonic + 7 + 7) + 12, len: 8 };
    return {
      key,
      sections: [
        { name: 'A', bars: withVoicing(A, th.notes), melody: th.notes, counter: null, trans: 0 },
        { name: "A'", bars: withVoicing(A2, mel2), melody: mel2, counter: S.counter(th.notes, key), trans: 0 },
        { name: 'B', bars: withVoicing(bridge, bMel), melody: bMel, counter: S.counter(bMel, key), trans: 0 },
        { name: "A''", bars: withVoicing(climaxChords, climaxMel), melody: climaxMel, counter: S.counter(climaxMel, key), trans: 2 },
      ],
    };
  };
})((globalThis.TD = globalThis.TD || {}));
