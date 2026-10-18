// 离线渲染音乐并检查（设计书 64.8）：同一套引擎跑在 OfflineAudioContext 上，
// 检查 NaN、峰值、各紧张度的响度和频段能量，并把试听用的 WAV 写到输出目录。
// 用法：node tools/music.js [输出目录] [--wav]
const path = require('path');
const fs = require('fs');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  ({ chromium } = require(path.join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright')));
}
const SR = 32000;

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [re[i], re[j]] = [re[j], re[i]], [im[i], im[j]] = [im[j], im[i]];
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len)
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const a = i + k, b = i + k + len / 2;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
      }
  }
}

function analyse(x) {
  let peak = 0, sum = 0, nan = 0;
  for (const v of x) {
    if (!Number.isFinite(v)) nan++;
    else {
      peak = Math.max(peak, Math.abs(v));
      sum += v * v;
    }
  }
  const N = 4096;
  const bands = [0, 0, 0, 0]; // <200, 200-1k, 1k-4k, >4k
  let frames = 0;
  for (let o = 0; o + N <= x.length; o += N * 2) {
    const re = Float64Array.from(x.subarray(o, o + N)).map((v, i) => v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N)));
    const im = new Float64Array(N);
    fft(re, im);
    for (let k = 1; k < N / 2; k++) {
      const f = (k * SR) / N;
      bands[f < 200 ? 0 : f < 1000 ? 1 : f < 4000 ? 2 : 3] += re[k] * re[k] + im[k] * im[k];
    }
    frames++;
  }
  const tot = bands.reduce((a, b) => a + b, 0) || 1;
  return { peak, rmsDb: 20 * Math.log10(Math.sqrt(sum / x.length) + 1e-9), nan, bandPct: bands.map((b) => Math.round((100 * b) / tot)) };
}

function wav(x) {
  const buf = Buffer.alloc(44 + x.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + x.length * 2, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))), 44 + i * 2);
  return buf;
}

const SCENES = [
  { name: 'title', theme: 0, mode: 'title', tension: 0, dur: 24 },
  { name: 'map-ch1', theme: 1, mode: 'calm', tension: 0, dur: 20 },
  { name: 'battle-ch1-t0', theme: 1, mode: 'battle', tension: 0, dur: 20 },
  { name: 'battle-ch1-t1', theme: 1, mode: 'battle', tension: 1, dur: 20 },
  { name: 'battle-ch1-t2-boss', theme: 1, mode: 'battle', tension: 2, dur: 20, stinger: 'boss' },
  { name: 'battle-ch1-t3-boss-low', theme: 1, mode: 'battle', tension: 3, dur: 20 },
  { name: 'battle-ch5-t0', theme: 5, mode: 'battle', tension: 0, dur: 16 },
  { name: 'battle-ch5-t3', theme: 5, mode: 'battle', tension: 3, dur: 16 },
  { name: 'stinger-win', theme: 1, mode: 'calm', tension: 0, dur: 5, stinger: 'win', mute: true },
  { name: 'stinger-lose', theme: 1, mode: 'calm', tension: 0, dur: 6, stinger: 'lose', mute: true },
];
for (let c = 0; c <= 7; c++) if (![1, 5].includes(c) && c) SCENES.push({ name: `battle-ch${c}-t1`, theme: c, mode: 'battle', tension: 1, dur: 12 });

(async () => {
  const out = process.argv[2] || 'music-out';
  const writeWav = process.argv.includes('--wav');
const forceSynth = process.argv.includes('--synth');
const calibrate = process.argv.includes('--calibrate');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(300);
  const rows = [];
  if (calibrate) {
    const res = await page.evaluate(async () => {
      const SR = 32000;
      const E = TD.music.Engine;
      const GAIN = TD.music.GAIN;
      const all = ['cello', 'contrabass', 'string_ensemble_1', 'tremolo_strings', 'pizzicato_strings', 'french_horn', 'brass_section', 'choir_aahs', 'timpani', 'taiko_drum', 'tubular_bells', 'celesta', 'orchestral_harp', 'marimba', 'oboe', 'flute'];
      const pats = {
        cello: (e) => [40, 44, 47].forEach((m, i) => e.cello(m, 0.2 + i * 2, 2, 0.17)),
        string_ensemble_1: (e) => [52, 55, 59].forEach((m, i) => e.strings(m, 0.2 + i * 2, 2, 0.05)),
        tremolo_strings: (e) => [52, 55, 59].forEach((m, i) => e.trem(m, 0.2 + i * 2, 2, 0.05)),
        pizzicato_strings: (e) => [0, 1, 2, 3, 4, 5].forEach((i) => e.spiccato([55, 59, 62][i % 3], 0.2 + i * 0.5, 0.04)),
        french_horn: (e) => [60, 64, 67].forEach((m, i) => e.horn(m, 0.2 + i * 2, 1.6, 0.12)),
        brass_section: (e) => [48, 55, 60].forEach((m, i) => e.brass(m, 0.2 + i * 2, 1.6, 0.085)),
        choir_aahs: (e) => [60, 64, 67].forEach((m, i) => e.choir(m, 0.2 + i * 2, 2, 0.035)),
        timpani: (e) => [0, 1, 2].forEach((i) => e.taiko(0.2 + i, 0.4, 62)),
        tubular_bells: (e) => [72, 76, 79].forEach((m, i) => e.bell(m, 0.2 + i * 2, 0.1, 2.2)),
        celesta: (e) => [88, 91].forEach((m, i) => e.bell(m, 0.2 + i * 2, 0.1, 2.2)),
        orchestral_harp: (e) => [72, 76, 79].forEach((m, i) => e.pluck(m, 0.2 + i * 1.2, 0.12)),
        marimba: (e) => [72, 76, 79].forEach((m, i) => e.marimba(m, 0.2 + i * 1.2, 0.12)),
        oboe: (e) => [69, 72, 76].forEach((m, i) => e.reed(m, 0.2 + i * 1.8, 1.6, 0.08)),
        flute: (e) => [72, 76, 79].forEach((m, i) => e.flute(m, 0.2 + i * 1.8, 1.6, 0.1)),
      };
      async function rms(inst, useSamples) {
        const ctx = new OfflineAudioContext(1, SR * 7, SR);
        const eng = new E(ctx, ctx.destination);
        eng.useSamples = useSamples;
        if (useSamples) await eng.loadSamples([inst]);
        eng.setVolume(1);
        pats[inst](eng);
        const d = (await ctx.startRendering()).getChannelData(0);
        let sum = 0;
        let n = 0;
        for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > 1e-5) (sum += d[i] * d[i]), n++;
        return Math.sqrt(sum / Math.max(1, n));
      }
      const out = {};
      for (const inst of Object.keys(pats)) {
        GAIN[inst] = 1;
        const a = await rms(inst, false);
        const b = await rms(inst, true);
        out[inst] = { synth: a, sample: b, gain: +(a / b).toFixed(2) };
      }
      return out;
    });
    console.log(JSON.stringify(res, null, 1));
    await browser.close();
    return;
  }
  for (const sc of SCENES) {
    const t0 = Date.now();
    const { b64, voices } = await page.evaluate(
      async ({ sc, SR }) => {
        const ctx = new OfflineAudioContext(1, SR * sc.dur, SR);
        let voices = 0;
        const co = ctx.createOscillator.bind(ctx);
        ctx.createOscillator = () => (voices++, co());
        const eng = new TD.music.Engine(ctx, ctx.destination);
        eng.useSamples = !sc.synth;
        if (!sc.synth) await eng.loadSamples(TD.music.Engine.instrumentsFor(sc.theme));
        eng.tension = sc.tension;
        eng.setTheme(sc.theme, sc.mode);
        eng.setVolume(TD.music.levelFor(sc.mode, sc.tension));
        if (sc.stinger) {
          if (sc.mute) eng.mode = 'calm';
          eng.stinger(sc.stinger);
        }
        if (!sc.mute) eng.schedule(sc.dur);
        const buf = await ctx.startRendering();
        const d = buf.getChannelData(0);
        const i16 = new Int16Array(d.length);
        for (let i = 0; i < d.length; i++) i16[i] = Math.max(-32768, Math.min(32767, Math.round(d[i] * 32767)));
        let s = '';
        const u8 = new Uint8Array(i16.buffer);
        for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        return { b64: btoa(s), voices };
      },
      { sc: forceSynth ? Object.assign({}, sc, { synth: true, name: sc.name }) : sc, SR }
    );
    const i16 = new Int16Array(Uint8Array.from(Buffer.from(b64, 'base64')).buffer);
    const x = Float32Array.from(i16, (v) => v / 32767);
    const a = analyse(x);
    rows.push({ name: sc.name, ...a, vps: Math.round(voices / sc.dur), sec: ((Date.now() - t0) / 1000).toFixed(1) });
    if (writeWav) fs.writeFileSync(path.join(out, sc.name + '.wav'), wav(x));
  }
  await browser.close();
  console.log('scene'.padEnd(24), 'peak'.padStart(6), 'RMS dB'.padStart(8), 'NaN', ' 低/中/高/亮 %', ' 渲染秒', ' 振荡器/秒');
  for (const r of rows) console.log(r.name.padEnd(24), r.peak.toFixed(2).padStart(6), r.rmsDb.toFixed(1).padStart(8), String(r.nan).padStart(3), ' ', r.bandPct.join('/').padEnd(14), r.sec.padEnd(6), r.vps);
  if (errors.length) console.log('ERRORS', errors);
  process.exit(errors.length || rows.some((r) => r.nan) ? 1 : 0);
})();
