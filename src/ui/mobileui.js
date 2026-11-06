// 手机 / 触屏适配（设计书见 docs-parts/mobileui.md）：舞台被缩小后，界面里小于 11 个屏幕像素的字太小看不清。
// 紧凑模式（#ui.compact，见 main.js fit）下，这里把每个"屏幕上实际字号 < 11px"的文字元素的字号抬到 11px（舞台里按缩放倒推），
// 并在界面内容变化时（开关弹窗、换页签、翻译器改字）重新扫一遍。离开紧凑模式时把改过的字号还原。桌面端不受影响。
(function (TD) {
  'use strict';

  const MAX_GROW = 2.7; // 单个元素最多放大到原来的 2.7 倍，避免版面被撑爆
  let pending = false;
  let obs = null;

  function zoomOf(el) {
    let z = 1;
    for (let p = el; p && p !== document.documentElement; p = p.parentElement) z *= parseFloat(getComputedStyle(p).zoom) || 1;
    return z;
  }

  function restore() {
    for (const el of document.querySelectorAll('#ui [data-mfs]')) {
      el.style.removeProperty('font-size');
      el.removeAttribute('data-mfs');
    }
  }

  function apply() {
    pending = false;
    const ui = document.getElementById('ui');
    const G = TD.game;
    if (!ui || !G || !G.scale) return;
    if (!ui.classList.contains('compact')) {
      if (ui.querySelector('[data-mfs]')) restore();
      return;
    }
    const floor = TD.touch.MIN_FONT;
    const todo = [];
    // 读阶段：先全部量完，再统一写，避免反复触发布局
    for (const el of ui.querySelectorAll('*')) {
      let has = false;
      for (const n of el.childNodes) {
        if (n.nodeType === 3 && n.nodeValue.trim()) {
          has = true;
          break;
        }
      }
      if (!has) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none') continue;
      const base = parseFloat(cs.fontSize);
      if (!(base > 0)) continue;
      const z = zoomOf(el);
      // 已经被我们改过的元素：用原值判断（data-mfs 存的是改之前的字号）
      const orig = el.hasAttribute('data-mfs') ? parseFloat(el.getAttribute('data-mfs')) : base;
      const shown = orig * G.scale * z;
      if (shown >= floor - 0.05) {
        if (el.hasAttribute('data-mfs')) todo.push([el, null]); // 缩放变大了，不用再抬
        continue;
      }
      const want = Math.min(orig * MAX_GROW, floor / (G.scale * z));
      if (Math.abs(want - base) < 0.2 && el.hasAttribute('data-mfs')) continue;
      todo.push([el, want, orig]);
    }
    for (const [el, want, orig] of todo) {
      if (want === null) {
        el.style.removeProperty('font-size');
        el.removeAttribute('data-mfs');
      } else {
        if (!el.hasAttribute('data-mfs')) el.setAttribute('data-mfs', String(orig));
        el.style.setProperty('font-size', want.toFixed(2) + 'px', 'important');
      }
    }
  }

  function schedule() {
    if (pending) return;
    pending = true;
    (window.requestAnimationFrame || setTimeout)(apply);
  }

  TD.mobileUI = {
    refresh: schedule,
    // 只在浏览器里有 DOM 时才监听
    start() {
      const ui = document.getElementById('ui');
      if (!ui || obs || typeof MutationObserver === 'undefined') return;
      // 只盯节点增减（不盯文字变化）：战斗界面每帧刷新数字，不能每帧都重扫
      obs = new MutationObserver(schedule);
      obs.observe(ui, { childList: true, subtree: true });
    },
  };
})(globalThis.TD);
