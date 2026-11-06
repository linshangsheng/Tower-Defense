// 无尽模式 / 每日挑战里的雇佣兵：每波军饷、怪物加成系数、结算字段
const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load');
const P = TD.progression;
const C = TD.config;

function mkSave(mercs) {
  const s = P.newSave();
  for (let k = 1; k <= 30; k++) s.levels[k] = { stars: 3, clears: 1 };
  P.setMercLoadout(s, mercs);
  return s;
}
function mkEndless(mercs, extra) {
  const s = mkSave(mercs);
  const lv = TD.modes.buildEndless(s, 5);
  const b = new TD.Battle(Object.assign({ level: 'endless', levelDef: lv, stage: lv.stage, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 }, extra || {}));
  return { s, lv, b };
}

test('无尽军饷：随波数缓增、有上限', () => {
  const f = TD.modes.endlessWaveFunds;
  assert.ok(f(1) > 0);
  assert.ok(f(10) > f(1));
  assert.ok(f(1000) === C.merc.endlessWaveFunds[2], '封顶');
  assert.ok(f(30) <= C.merc.endlessWaveFunds[2]);
});

test('无尽军饷：带兵时每清一波增加，不带兵不增加', () => {
  const { b } = mkEndless(['swordsman']);
  assert.ok(b.mercsOn);
  b.startWave(0);
  const f0 = b.funds;
  b.startWave(1);
  assert.strictEqual(b.funds, f0 + TD.modes.endlessWaveFunds(1));
  b.startWave(5);
  assert.strictEqual(b.funds, f0 + TD.modes.endlessWaveFunds(1) + TD.modes.endlessWaveFunds(5));
  const n = mkEndless([]).b;
  n.startWave(0);
  n.startWave(3);
  assert.strictEqual(n.funds, 0);
});

test('普通关卡不送每波军饷', () => {
  const s = mkSave(['swordsman']);
  const b = new TD.Battle({ level: 20, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  b.startWave(0);
  const f0 = b.funds;
  b.startWave(1);
  assert.strictEqual(b.funds, f0);
});

test('endlessMerc 系数缩放无尽里怪物的带兵加成，普通关卡不受影响', () => {
  const old = C.merc.endlessMerc;
  try {
    const hp = (em) => {
      C.merc.endlessMerc = em;
      const { b } = mkEndless(['swordsman']);
      b.startWave(0);
      const m = b.spawnMonster('goblin', 1, 900);
      return { hp: m.maxHp, dps: m.dps };
    };
    const full = hp(1);
    const none = hp(0);
    const half = hp(0.5);
    assert.ok(full.hp > half.hp && half.hp > none.hp);
    assert.ok(full.dps > none.dps);
    assert.ok(Math.abs(full.hp / none.hp - (1 + C.merc.monsterHp)) < 0.02);
    // 普通关卡：系数不起作用
    const s = mkSave(['swordsman']);
    const mk = () => new TD.Battle({ level: 20, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
    C.merc.endlessMerc = 0;
    const a = mk().spawnMonster('goblin', 1, 900);
    C.merc.endlessMerc = 1;
    const c = mk().spawnMonster('goblin', 1, 900);
    assert.strictEqual(a.maxHp, c.maxHp);
  } finally {
    C.merc.endlessMerc = old;
  }
});

test('无尽 / 每日结算带兵字段', () => {
  const { b } = mkEndless(['swordsman'], { autoMercs: true });
  const r = b.runToEnd(60);
  for (const k of ['mercDeployed', 'mercDeaths', 'mercKills']) assert.strictEqual(typeof r[k], 'number', k);
  const s = mkSave(['swordsman']);
  const daily = TD.modes.buildDaily({ level: 8, rule: 'swift', key: 'x' });
  const d = new TD.Battle({ level: 8, levelDef: daily, stage: 8, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 2, autoMercs: true });
  assert.ok(d.mercsOn);
  const dr = d.runToEnd(30);
  assert.ok('mercDeployed' in dr && 'mercDeaths' in dr && 'mercKills' in dr);
});
