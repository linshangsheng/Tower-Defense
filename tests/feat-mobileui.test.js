// 手机 / 触屏适配：热区换算与 compact 判断（纯函数）
const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load');
const T = TD.touch;

test('compact：缩放 < 0.7 才进入；电脑 1.0 不进', () => {
  assert.strictEqual(T.isCompact(1), false);
  assert.strictEqual(T.isCompact(0.75), false);
  assert.strictEqual(T.isCompact(0.7), false);
  assert.strictEqual(T.isCompact(0.69), true);
  assert.strictEqual(T.isCompact(0.44), true);
});

test('compact：触屏设备放宽到 0.9（平板竖屏），电脑窗口不放宽', () => {
  assert.strictEqual(T.isCompact(0.8, true), true);
  assert.strictEqual(T.isCompact(0.8, false), false);
  assert.strictEqual(T.isCompact(1, true), false);
});

test('compact：非法缩放不进入', () => {
  for (const v of [0, -1, NaN, undefined, null, '0.5']) assert.strictEqual(T.isCompact(v), false);
});

test('stageMin：屏幕 44px 对应的舞台像素 = 44 / 缩放', () => {
  assert.ok(Math.abs(T.stageMin(0.5) - 88) < 1e-9);
  assert.ok(Math.abs(T.stageMin(1) - 44) < 1e-9);
  assert.ok(Math.abs(T.stageMin(0.5, 11) - 22) < 1e-9);
});

test('screenSize / meetsTarget：舞台 80px 的按钮在 0.5 缩放下只有 40px，不达标', () => {
  const s = T.screenSize(80, 80, 0.5);
  assert.deepStrictEqual(s, { w: 40, h: 40 });
  assert.strictEqual(T.meetsTarget(s.w, s.h), false);
  assert.strictEqual(T.meetsTarget(44, 44), true);
  assert.strictEqual(T.meetsTarget(44, 30), false);
  assert.strictEqual(T.meetsTarget(43.8, 44.2), true, '半像素的取整误差不算不达标');
});

test('boostFor：放大倍数刚好够热区，已达标返回 1，封顶', () => {
  assert.ok(Math.abs(T.boostFor(44, 44, 0.5) - 2) < 1e-9);
  assert.strictEqual(T.boostFor(100, 100, 0.5), 1);
  assert.strictEqual(T.boostFor(10, 10, 0.4, 3), 3);
  assert.ok(T.boostFor(44, 88, 0.5) >= 1 && T.boostFor(44, 88, 0.5) <= 2);
});

test('fontFloor / screenFont：11px 字号换算互为逆运算', () => {
  assert.ok(Math.abs(T.fontFloor(0.5) - 22) < 1e-9);
  assert.ok(Math.abs(T.screenFont(T.fontFloor(0.44), 0.44) - 11) < 1e-9);
  assert.ok(T.screenFont(13, 0.52) < 11, '13px 的字在 0.52 缩放下不到 11px');
});

test('stagePoint 旋转：舞台四角往返一致（点击坐标换算）', () => {
  const W = 1280;
  const H = 720;
  const s = 0.5;
  const cx = 200;
  const cy = 400;
  const rect = { left: cx - (H * s) / 2, top: cy - (W * s) / 2, width: H * s, height: W * s };
  for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H], [640, 360], [123, 456]]) {
    const sx = cx - (y - H / 2) * s;
    const sy = cy + (x - W / 2) * s;
    const p = TD.util.stagePoint(sx, sy, rect, W, H, true);
    assert.ok(Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6, `(${x},${y}) -> (${p.x},${p.y})`);
  }
});
