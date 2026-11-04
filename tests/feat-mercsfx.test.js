// 雇佣兵专属音效：注册 / 事件绑定 / 限流 / 增益范围（不含人耳验证）
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const TD = require('../tools/load');
require('../src/render/audio.js');
const A = TD.audio;

const types = Object.keys(TD.data.mercs);
const kinds = ['atk', 'hurt', 'die', 'deploy'];
const extra = ['merc_charge', 'merc_heal', 'merc_rank', 'merc_rally'];

test('每个兵种的出手 / 受击 / 阵亡 / 到场音效都已注册', () => {
  assert.deepStrictEqual([...A.mercTypes].sort(), [...types].sort());
  for (const t of types) {
    for (const k of kinds) {
      const n = A.mercSound(k, t);
      assert.strictEqual(typeof A.SOUNDS[n], 'function', n);
    }
  }
  for (const n of extra) assert.strictEqual(typeof A.SOUNDS[n], 'function', n);
  assert.strictEqual(A.mercSound('atk', 'nope'), 'merc_swordsman_atk');
});

test('MIN_GAP 覆盖所有高频兵音效', () => {
  for (const t of types) for (const k of kinds) assert.ok(A.MIN_GAP[A.mercSound(k, t)] > 0);
  for (const n of extra) assert.ok(A.MIN_GAP[n] > 0, n);
});

test('main.js 里每个兵事件都绑定到按兵种选声音', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf8');
  for (const ev of ['mercDeploy', 'mercSwing', 'mercShot', 'mercHurt', 'mercDie', 'mercCharge', 'mercHeal', 'mercRank', 'mercRally']) {
    assert.ok(new RegExp(`battle\\.on\\('${ev}'`).test(src), ev);
  }
  assert.ok(/mercSound\(kind, e\.u && e\.u\.type\)/.test(src));
});

test('所有兵音效的单个声部增益在 0.04–0.14 之内（偏低，不压英雄）', () => {
  let cur = 0;
  const gain = () => ({
    gain: {
      set value(v) { cur = Math.max(cur, v); },
      setValueAtTime() {},
      exponentialRampToValueAtTime(v) { cur = Math.max(cur, v); },
    },
    connect() {},
  });
  const osc = () => ({ type: '', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} });
  A.ctx = {
    currentTime: 0, sampleRate: 8000, state: 'running',
    createGain: gain, createOscillator: osc,
    createBiquadFilter: () => ({ frequency: {}, connect() {} }),
    createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }),
    createBufferSource: () => ({ connect() {}, start() {} }),
  };
  A.master = { connect() {} };
  for (const n of Object.keys(A.SOUNDS).filter((k) => k.startsWith('merc_'))) {
    cur = 0;
    A.SOUNDS[n]();
    assert.ok(cur >= 0.04 && cur <= 0.14 + 1e-9, `${n} peak ${cur}`);
  }
  A.ctx = null;
});

test('mercHurt 事件存在且每个兵限频（Boss 横扫每帧调用不刷屏）', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/game/mercs.js'), 'utf8');
  assert.ok(/emit\('mercHurt'/.test(src) && /hurtSfxAt/.test(src));
});
