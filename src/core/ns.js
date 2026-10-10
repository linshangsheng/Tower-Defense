// 全局命名空间与基础工具。所有脚本都以普通 <script> 方式加载（支持直接双击打开 index.html），
// 在 Node 中则通过 tools/load.js 依次 require，同样挂到 globalThis.TD 上。
(function (TD) {
  'use strict';

  TD.util = {
    clamp(v, lo, hi) {
      return v < lo ? lo : v > hi ? hi : v;
    },
    lerp(a, b, t) {
      return a + (b - a) * t;
    },
    // 价格取整到 5
    round5(v) {
      return Math.max(5, Math.round(v / 5) * 5);
    },
    // 带种子的随机数（mulberry32），战斗逻辑只用它，便于复现与批量模拟
    rng(seed) {
      let a = seed >>> 0 || 1;
      const next = function () {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      next.int = (n) => Math.floor(next() * n);
      next.pick = (arr) => arr[Math.floor(next() * arr.length)];
      return next;
    },
    deepClone(o) {
      return JSON.parse(JSON.stringify(o));
    },
  };

  // 简单事件总线：战斗逻辑发事件，渲染、音效、界面订阅
  TD.Emitter = class Emitter {
    constructor() {
      this.handlers = {};
    }
    on(type, fn) {
      (this.handlers[type] = this.handlers[type] || []).push(fn);
      return () => this.off(type, fn);
    }
    off(type, fn) {
      const list = this.handlers[type];
      if (list) this.handlers[type] = list.filter((h) => h !== fn);
    }
    emit(type, data) {
      const list = this.handlers[type];
      if (list) for (const h of list.slice()) h(data);
      const any = this.handlers['*'];
      if (any) for (const h of any.slice()) h(type, data);
    }
  };
})((globalThis.TD = globalThis.TD || {}));
