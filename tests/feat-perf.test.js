// 性能优化的回放对比：固定种子跑 20 秒，每帧的怪物 hp 总和 / 怪物数 / 兵位置 hp 序列的哈希必须和优化前一致
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { makeBattle, stepOnce } = require('../tools/perfkit');

function replay(level, seed, secs, mercs) {
  const b = makeBattle(level, seed, { mercs });
  const h = crypto.createHash('sha256');
  let maxMon = 0;
  for (let i = 0; i < secs * 60 && !b.over; i++) {
    stepOnce(b, 1 / 60);
    let hp = 0;
    let n = 0;
    for (const m of b.monsters) if (!m.dead) { hp += m.hp; n++; }
    maxMon = Math.max(maxMon, n);
    let s = hp.toPrecision(17) + '|' + n;
    for (const u of b.mercs) s += '|' + u.id + ':' + u.x.toPrecision(17) + ',' + u.y + ',' + u.hp.toPrecision(17) + ',' + u.state + (u.dead ? 'x' : '');
    h.update(s + '\n');
  }
  h.update([b.mercKills, b.mercDeaths, b.mercDeployed, b.kills || 0, b.funds.toPrecision(17)].join(','));
  return { hash: h.digest('hex'), maxMon, mercs: b.mercDeployed };
}

// 基线哈希：合并其他功能后，用「perf 合并前的提交」重新记录，并确认与合并后的结果逐位相同（证明 perf 优化仍然行为等价）
const EXPECT = {
  'L40/s1/20s': 'b7854444e4e0ef61f8766c888a334e752f74a4a1f3b866875d7d939ed2567feb',
  'L100/s2/20s': 'dc06dfbdb746be36db72f040cfa06bd6c2d680e67bd5a794db2da99442465d93',
  'L150/s3/20s': '7bfd9c4f8214fbc57462ce910061aa6b54bc51e800459f2a2f5d5c8cd7399dc3',
};

for (const [key, [level, seed]] of Object.entries({ 'L40/s1/20s': [40, 1], 'L100/s2/20s': [100, 2], 'L150/s3/20s': [150, 3] })) {
  test('回放哈希一致：' + key, () => {
    const r = replay(level, seed, 20, true);
    assert.ok(r.mercs >= 3, '场上确实有兵');
    assert.ok(r.maxMon >= 30, '场上确实有一批怪');
    if (process.env.PERF_PRINT) console.log(key, r.hash);
    assert.strictEqual(r.hash, EXPECT[key]);
  });
}

test('没有兵时回放同样确定（两次跑结果相同）', () => {
  assert.strictEqual(replay(60, 5, 10, false).hash, replay(60, 5, 10, false).hash);
});
