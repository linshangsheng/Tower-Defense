// 自适应画质（设计书 111）：电脑性能差时，自动一档一档降低画面负担，避免卡死；性能够了再慢慢升回来
(function (TD) {
  'use strict';

  const KEY = 'shouchengyingxiong.quality';
  const Q = (TD.quality = {});

  // 每一档：scale = 画布分辨率比例；fx = 粒子上限倍率；lit = 光影缓存刷新率倍率；其余是各层光影要不要画
  Q.LEVELS = [
    { scale: 1, fx: 1, lit: 1, shafts: true, motes: true, glow: true, front: true },
    { scale: 1, fx: 0.6, lit: 0.7, shafts: false, motes: false, glow: true, front: true },
    { scale: 0.75, fx: 0.35, lit: 0.5, shafts: false, motes: false, glow: false, front: true },
    { scale: 0.5, fx: 0.2, lit: 0.35, shafts: false, motes: false, glow: false, front: false },
  ];
  Q.MAX = Q.LEVELS.length - 1;
  Q.level = 0;
  Q.mode = 'auto'; // auto = 自动；high / medium / low = 手动固定在 0 / 1 / 2 档
  Q.changes = 0; // 档位变化次数（测试用）

  const WINDOW = 24; // 每 24 帧取一次中位数
  const DOWN_MS = 38; // 中位帧间隔超过它（不到 26 帧 / 秒）就降一档（30 帧 / 秒的显示器 33 毫秒，不会误判）
  const HEAVY_MS = 70;
  const UP_MS = 18.5; // 低于它（满 60 帧）并且连续稳定一阵才升一档
  const UP_WINDOWS = 24; // 约 12 秒
  const SETTLE_FRAMES = 6;
  const BAN_MS = 40000; // 刚升上去 40 秒内又掉下来：这一档在这台电脑上撑不住，本次不再升

  let buf = [];
  let good = 0;
  let settle = 0; // 刚换档，丢掉接下来的几帧（重设画布大小会有一次卡顿）
  let banned = -1;
  let lastUp = -1e9;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  Q.params = () => Q.LEVELS[Q.level];

  Q.set = function (level, why) {
    level = Math.max(0, Math.min(Q.MAX, level));
    if (level === Q.level) return;
    Q.level = level;
    Q.changes++;
    buf = [];
    good = 0;
    settle = SETTLE_FRAMES;
    if (Q.mode === 'auto') {
      try {
        if (globalThis.localStorage) localStorage.setItem(KEY, String(level));
      } catch (e) {
        /* 存不了就算了 */
      }
    }
    if (Q.onChange) Q.onChange(level, why);
  };

  // 设置里的"画质"：auto / high / medium / low
  Q.setMode = function (mode) {
    if (!['auto', 'high', 'medium', 'low'].includes(mode)) mode = 'auto';
    Q.mode = mode;
    banned = -1;
    if (mode === 'high') Q.set(0, 'manual');
    else if (mode === 'medium') Q.set(1, 'manual');
    else if (mode === 'low') Q.set(2, 'manual');
    else {
      let start = 0;
      try {
        start = +(globalThis.localStorage && localStorage.getItem(KEY)) || 0;
      } catch (e) {
        start = 0;
      }
      Q.set(Math.max(0, Math.min(Q.MAX, start | 0)), 'auto');
    }
    buf = [];
    good = 0;
  };

  // 每一帧把"这一帧和上一帧的间隔（毫秒）"交给它；暂停、切后台、单次卡顿 > 250 毫秒的不要算
  Q.record = function (ms) {
    if (Q.mode !== 'auto' || !(ms > 0) || ms > 250) return;
    if (settle > 0) {
      settle--;
      return;
    }
    buf.push(ms);
    if (buf.length < WINDOW) return;
    const sorted = buf.slice().sort((a, b) => a - b);
    const med = sorted[WINDOW >> 1];
    buf = [];
    if (med > DOWN_MS && Q.level < Q.MAX) {
      if (now() - lastUp < BAN_MS) banned = Q.level;
      Q.set(Q.level + (med > HEAVY_MS ? 2 : 1), 'slow'); // 特别卡（不到 14 帧 / 秒）一次降两档
    } else if (med < UP_MS && Q.level > 0 && banned !== Q.level - 1) {
      if (++good >= UP_WINDOWS) {
        lastUp = now();
        Q.set(Q.level - 1, 'fast');
      }
    } else good = 0;
  };

  // 测试 / 开发用：把状态清回初始
  Q._reset = function () {
    buf = [];
    good = 0;
    settle = 0;
    banned = -1;
    lastUp = -1e9;
    Q.level = 0;
    Q.mode = 'auto';
    Q.changes = 0;
    Q.onChange = null;
  };
})((globalThis.TD = globalThis.TD || {}));
