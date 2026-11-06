// 战斗提示层：关卡提示队列（同时只显示 1 条，后来的排队）
const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load');

function harness(opts) {
  let now = 0;
  let id = 0;
  const timers = new Map();
  const log = [];
  const q = new TD.ToastQueue(
    {
      show: (it) => log.push('show:' + it.msg),
      hide: (it) => log.push('hide:' + it.msg),
      remove: (it) => log.push('remove:' + it.msg),
      setTimer: (fn, ms) => (timers.set(++id, { fn, at: now + ms }), id),
      clearTimer: (i) => timers.delete(i),
    },
    opts
  );
  const advance = (ms) => {
    const end = now + ms;
    for (;;) {
      let best = null;
      for (const [i, t] of timers) if (t.at <= end && (!best || t.at < best[1].at)) best = [i, t];
      if (!best) break;
      timers.delete(best[0]);
      now = best[1].at;
      best[1].fn();
    }
    now = end;
  };
  return { q, log, advance };
}

test('提示同时只显示 1 条，后来的排队', () => {
  const { q, log, advance } = harness();
  q.push('A');
  q.push('B');
  assert.deepStrictEqual(log, ['show:A']);
  advance(3999);
  assert.deepStrictEqual(log, ['show:A']);
  advance(1); // 4 秒：A 开始滑出
  assert.deepStrictEqual(log, ['show:A', 'hide:A']);
  advance(350); // 滑完：A 移除，B 出现
  assert.deepStrictEqual(log, ['show:A', 'hide:A', 'remove:A', 'show:B']);
});

test('点击立即收起，随后显示排队的下一条', () => {
  const { q, log, advance } = harness();
  q.push('A');
  q.push('B');
  advance(500);
  q.dismiss();
  q.dismiss(); // 重复点击无副作用
  assert.deepStrictEqual(log, ['show:A', 'hide:A']);
  advance(350);
  assert.strictEqual(q.current.msg, 'B');
  assert.deepStrictEqual(log.slice(-2), ['remove:A', 'show:B']);
});

test('重复的提示不排两遍，排队最多 3 条', () => {
  const { q, advance } = harness();
  q.push('A');
  q.push('A');
  assert.strictEqual(q.queue.length, 0);
  ['B', 'B', 'C', 'D', 'E'].forEach((m) => q.push(m));
  assert.deepStrictEqual(q.queue, ['C', 'D', 'E']);
  advance(4350);
  assert.strictEqual(q.current.msg, 'C');
});

test('clear 清空当前和排队，之后可以重新开始', () => {
  const { q, log } = harness();
  q.push('A');
  q.push('B');
  q.clear();
  assert.strictEqual(q.current, null);
  assert.strictEqual(q.queue.length, 0);
  assert.strictEqual(log[log.length - 1], 'remove:A');
  q.push('C');
  assert.strictEqual(log[log.length - 1], 'show:C');
});

test('最后一条放完后队列空闲，新的立刻显示', () => {
  const { q, log, advance } = harness();
  q.push('A');
  advance(4350);
  assert.strictEqual(q.current, null);
  q.push('B');
  assert.strictEqual(log[log.length - 1], 'show:B');
});
