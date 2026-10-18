# 生成音乐用的乐器采样（设计书 68）：
#   从 gleitz/midi-js-soundfonts（FluidR3_GM 音色库，CC BY 3.0）取真实乐器录音的采样，
#   每个乐器只留稀疏的几个音（间隔 4 个半音，播放时用变速补足），持续音做成可循环，
#   压成 MP3 后以 base64 写进 src/render/samples.js（file:// 下也能加载，不用 fetch）。
# 用法：python3 tools/build-samples.py [缓存目录]    （需要 ffmpeg、numpy；缓存目录里没有的文件会从 raw.githubusercontent.com 下载）
import base64, os, re, subprocess, sys, json, tempfile, urllib.request
import numpy as np

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cache = sys.argv[1] if len(sys.argv) > 1 else os.path.join(tempfile.gettempdir(), 'fluidr3-cache')
os.makedirs(cache, exist_ok=True)
BASE = 'https://raw.githubusercontent.com/gleitz/midi-js-soundfonts/gh-pages/FluidR3_GM/'
SR = 32000
PC = {'C': 0, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4, 'F': 5, 'Gb': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11}

def midi_of(name):
    m = re.match(r'([A-G][b]?)(\d)', name)
    return 12 * (int(m.group(2)) + 1) + PC[m.group(1)]

def notes(lo, hi, stride):
    return list(range(lo, hi + 1, stride))

# 持续音（loop=True）：循环区间从 LOOP_A 秒到 dur 秒；其余是衰减音，按 dur 截断
LOOP_A = 0.8
INST = {
    'contrabass': dict(notes=notes(28, 52, 4), dur=2.4, loop=True),
    'cello': dict(notes=notes(36, 72, 4), dur=2.4, loop=True),
    'string_ensemble_1': dict(notes=notes(48, 84, 4), dur=2.4, loop=True),
    'tremolo_strings': dict(notes=notes(48, 84, 4), dur=2.4, loop=True),
    'french_horn': dict(notes=notes(36, 89, 4), dur=2.4, loop=True),
    'brass_section': dict(notes=notes(36, 84, 4), dur=2.4, loop=True),
    'choir_aahs': dict(notes=notes(48, 84, 4), dur=2.4, loop=True),
    'flute': dict(notes=notes(60, 96, 4), dur=2.4, loop=True),
    'oboe': dict(notes=notes(58, 94, 4), dur=2.4, loop=True),
    'timpani': dict(notes=notes(36, 60, 3), dur=2.2, loop=False),
    'taiko_drum': dict(notes=notes(36, 60, 6), dur=1.8, loop=False),
    'tubular_bells': dict(notes=notes(60, 96, 4), dur=3.0, loop=False),
    'orchestral_harp': dict(notes=notes(48, 96, 4), dur=2.0, loop=False),
    'marimba': dict(notes=notes(48, 96, 4), dur=1.4, loop=False),
    'pizzicato_strings': dict(notes=notes(48, 84, 4), dur=0.9, loop=False),
    'celesta': dict(notes=notes(72, 100, 4), dur=2.0, loop=False),
}

def fetch(name):
    p = os.path.join(cache, name + '.js')
    if not os.path.exists(p) or os.path.getsize(p) < 1000:
        print('下载', name)
        urllib.request.urlretrieve(BASE + name + '-mp3.js', p)
    s = open(p).read()
    return {k: v for k, v in re.findall(r'"([A-G][b#]?\d)"\s*:\s*"data:audio/mp3;base64,([^"]+)"', s)}

def decode(b64):
    with tempfile.NamedTemporaryFile(suffix='.mp3') as f:
        f.write(base64.b64decode(b64)); f.flush()
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f.name, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()

def encode(x):
    with tempfile.NamedTemporaryFile(suffix='.raw') as f:
        f.write(x.astype(np.float32).tobytes()); f.flush()
        out = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', f.name, '-c:a', 'libmp3lame', '-b:a', '56k', '-f', 'mp3', '-'], capture_output=True).stdout
    return base64.b64encode(out).decode()

out = {}
total = 0
for name, spec in INST.items():
    bank = fetch(name)
    by_midi = {midi_of(k): v for k, v in bank.items()}
    inst = {'loop': [LOOP_A, spec['dur']] if spec['loop'] else None, 'notes': {}}
    for m in spec['notes']:
        x = decode(by_midi[m])
        n = int(SR * spec['dur'])
        x = x[:n] if len(x) >= n else np.pad(x, (0, n - len(x)))
        if spec['loop']:
            # 循环的交叉淡化不在这里做：MP3 解码后开头会多出一点编码延迟，位置对不准会爆音，
            # 所以改成游戏里解码后在实际数据上做（见 music.js 的 loadSamples）
            a, b = int(SR * LOOP_A), n
            rms = np.sqrt(np.mean(x[a:b] ** 2)) + 1e-9
            x = x * (10 ** (-26 / 20) / rms)  # 持续音：循环段 RMS 统一到 -26 dBFS
        else:
            fo = int(SR * 0.2)
            x[-fo:] *= np.linspace(1, 0, fo, dtype=np.float32)
            x = x * (0.5 / (np.max(np.abs(x)) + 1e-9))  # 衰减音：峰值统一到 0.5
        x[:int(SR * 0.004)] *= np.linspace(0, 1, int(SR * 0.004), dtype=np.float32)
        x = np.clip(x, -0.99, 0.99)
        inst['notes'][str(m)] = encode(x)
    size = sum(len(v) for v in inst['notes'].values())
    total += size
    print(f'{name:20s} {len(inst["notes"]):2d} 个采样 {size / 1024:7.0f} KB (base64)')
    out[name] = inst

js = '''// 乐器采样（自动生成，请勿手改：python3 tools/build-samples.py）
// 来源：gleitz/midi-js-soundfonts 里的 FluidR3_GM 音色库（Frank Wen），CC BY 3.0 许可，见设计书第 68 章。
(function (TD) {
  'use strict';
  TD.samples = %s;
})((globalThis.TD = globalThis.TD || {}));
''' % json.dumps(out, separators=(',', ':'))
open(os.path.join(root, 'src', 'render', 'samples.js'), 'w').write(js)
print(f'合计 {total / 1024 / 1024:.2f} MB')
