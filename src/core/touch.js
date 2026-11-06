// 触屏热区换算（纯函数，Node 里也能测）：舞台固定 1280×720，手机上被缩小到 0.4~0.6 倍，
// 舞台里 44px 的按钮到了屏幕上只剩 20 多个 CSS 像素，手指点不准。这里把"屏幕要多大"换算成"舞台里要多大"。
(function (TD) {
  'use strict';

  const touch = (TD.touch = {
    MIN_TARGET: 44, // 可点击元素在屏幕上的最小边长（CSS 像素，苹果 HIG 的 44pt）
    MIN_FONT: 11, // 屏幕上实际显示的最小字号
    COMPACT_BELOW: 0.7, // 舞台缩放比例低于它就进入紧凑模式
    COARSE_BELOW: 0.9, // 触屏设备（pointer: coarse）放宽到 0.9：平板竖屏也是手指在点
    // 舞台缩放比例 → 是否进入紧凑模式（手机；电脑窗口不进，除非缩得很小）
    isCompact(scale, coarse) {
      if (typeof scale !== 'number' || !(scale > 0)) return false;
      return scale < touch.COMPACT_BELOW || (!!coarse && scale < touch.COARSE_BELOW);
    },
    // 屏幕上 min 个 CSS 像素，在舞台里是多少像素
    stageMin(scale, min) {
      return (min == null ? touch.MIN_TARGET : min) / scale;
    },
    // 舞台里 w×h 的元素，屏幕上实际多大
    screenSize(w, h, scale) {
      return { w: w * scale, h: h * scale };
    },
    // 屏幕上的尺寸是否达到触控标准
    meetsTarget(screenW, screenH, min) {
      const m = min == null ? touch.MIN_TARGET : min;
      return screenW >= m - 0.5 && screenH >= m - 0.5;
    },
    // 舞台里 w×h 的元素要放大到多少倍才够热区（不放大返回 1；max 封顶，免得把版面撑爆）
    boostFor(w, h, scale, max) {
      const need = touch.stageMin(scale);
      const f = Math.max(need / Math.max(1, w), need / Math.max(1, h));
      return Math.min(max || 2, Math.max(1, f));
    },
    // 屏幕上 minPx 的字，舞台里至少要几 px
    fontFloor(scale, minPx) {
      return (minPx == null ? touch.MIN_FONT : minPx) / scale;
    },
    // 舞台里的字号 → 屏幕上实际字号
    screenFont(stagePx, scale) {
      return stagePx * scale;
    },
  });
})(globalThis.TD);
