// 剧情字幕的纯逻辑：旁白判断、逐字显示的节奏与切片（不碰 DOM，Node 里也能测）
(function (TD) {
  'use strict';

  // 标点后多停几拍（一拍 = PAUSE_UNIT 毫秒）
  const PAUSE = { '，': 4, ',': 4, '、': 3, '。': 8, '！': 8, '？': 8, '…': 6, '—': 4, '.': 6, '!': 6, '?': 6 };
  const BASE = 34;
  const PAUSE_UNIT = 9;

  const ST = (TD.storyText = {});
  // 没有说话人（空 / null / 'narrator'）= 旁白
  ST.isNarration = (who) => !who || who === 'narrator';
  // 按字符（不是 UTF-16 码元）切开，避免把 emoji 之类劈成两半
  ST.chars = (text) => Array.from(String(text == null ? '' : text));
  // 显示完这个字符之后，等多久再显示下一个
  ST.delay = (ch) => BASE + (PAUSE[ch] || 0) * PAUSE_UNIT;
  // 前 n 个字符
  ST.slice = (chars, n) => chars.slice(0, Math.max(0, n)).join('');
  // 整句打完要多久（毫秒）
  ST.duration = (chars) => chars.reduce((s, c) => s + ST.delay(c), 0);
})(globalThis.TD || (globalThis.TD = {}));
