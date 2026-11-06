// 关卡提示的队列（和界面无关的小状态机，方便在 Node 里测试）：
// 同一时间只显示 1 条，后来的排队；每条显示 showMs 毫秒后滑出（outMs 毫秒），点击可以立刻收起。
(function (TD) {
  'use strict';

  TD.ToastQueue = class ToastQueue {
    // deps: { show(item), hide(item), remove(item), setTimer(fn, ms) -> id, clearTimer(id) }
    constructor(deps, opts) {
      this.deps = deps;
      this.showMs = (opts && opts.showMs) || 4000;
      this.outMs = (opts && opts.outMs) || 350;
      this.max = (opts && opts.max) || 3; // 排队的最多留 3 条，再多的丢掉最旧的
      this.queue = [];
      this.current = null; // { msg, phase: 'in' | 'out' }
      this.timer = null;
    }
    push(msg) {
      if (!msg) return;
      if (this.current && this.current.msg === msg && this.current.phase === 'in') return; // 同样的话不重复
      if (this.queue.includes(msg)) return;
      this.queue.push(msg);
      while (this.queue.length > this.max) this.queue.shift();
      if (!this.current) this._next();
    }
    _next() {
      const msg = this.queue.shift();
      if (msg === undefined) return;
      const item = (this.current = { msg, phase: 'in' });
      this.deps.show(item);
      this.timer = this.deps.setTimer(() => this.dismiss(), this.showMs);
    }
    // 开始滑出；滑完后再显示下一条
    dismiss() {
      const item = this.current;
      if (!item || item.phase === 'out') return;
      item.phase = 'out';
      this.deps.clearTimer(this.timer);
      this.deps.hide(item);
      this.timer = this.deps.setTimer(() => {
        this.deps.remove(item);
        this.current = null;
        this._next();
      }, this.outMs);
    }
    // 弹窗打开等场合：全部清掉，不再排队
    clear() {
      this.queue.length = 0;
      if (this.current) {
        this.deps.clearTimer(this.timer);
        this.deps.remove(this.current);
        this.current = null;
      }
    }
  };
})((globalThis.TD = globalThis.TD || {}));
