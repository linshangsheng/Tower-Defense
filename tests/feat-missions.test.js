// 雇佣兵关卡任务：判定与分配规则
const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load');
const D = TD.data;
const M = D.missions;

const MERC_IDS = Object.keys(M).filter((id) => M[id].merc);

test('有 7 个雇佣兵任务，且都有中文名与说明', () => {
  assert.strictEqual(MERC_IDS.length, 7);
  for (const id of MERC_IDS) {
    assert.ok(M[id].name && M[id].desc, id);
    assert.ok(D.isMercMission(id));
  }
  assert.ok(!D.isMercMission('early3'));
});

test('同生共死：至少雇 3 个且无阵亡', () => {
  const c = M.mercNoDeath.check;
  assert.ok(c({ mercDeployed: 3, mercDeaths: 0 }));
  assert.ok(!c({ mercDeployed: 3, mercDeaths: 1 }));
  assert.ok(!c({ mercDeployed: 2, mercDeaths: 0 }), '雇得太少不算');
  assert.ok(!c({}), '没带兵不算');
});

test('精兵简政：同时最多 3 个', () => {
  const c = M.mercCap3.check;
  assert.ok(c({ mercDeployed: 5, mercPeak: 3 }));
  assert.ok(!c({ mercDeployed: 5, mercPeak: 4 }));
  assert.ok(!c({ mercDeployed: 2, mercPeak: 2 }));
  assert.ok(!c({}));
});

test('铜墙铁卫：盾卫挡 20 次', () => {
  const c = M.mercBlock20.check;
  assert.ok(c({ mercBlocks: 20 }));
  assert.ok(!c({ mercBlocks: 19 }));
  assert.ok(!c({}));
});

test('百战老兵：2 个兵晋升到 3 级', () => {
  const c = M.mercVet2.check;
  assert.ok(c({ mercMaxRanks: 2 }));
  assert.ok(!c({ mercMaxRanks: 1 }));
  assert.ok(!c({}));
});

test('专精一道：只带 1 个兵种且雇 4 个', () => {
  const c = M.mercSolo.check;
  assert.ok(c({ mercCarried: 1, mercDeployed: 4 }));
  assert.ok(!c({ mercCarried: 2, mercDeployed: 8 }));
  assert.ok(!c({ mercCarried: 1, mercDeployed: 3 }));
  assert.ok(!c({ mercCarried: 0, mercDeployed: 0 }));
});

test('各守其路：不使用集结令', () => {
  const c = M.mercNoRally.check;
  assert.ok(c({ mercDeployed: 3, mercRallies: 0 }));
  assert.ok(c({ mercDeployed: 3 }));
  assert.ok(!c({ mercDeployed: 3, mercRallies: 1 }));
  assert.ok(!c({ mercDeployed: 0, mercRallies: 0 }), '没带兵不算');
});

test('兵锋所向：雇佣兵击杀占 30% 以上', () => {
  const c = M.mercShare30.check;
  assert.ok(c({ mercDeployed: 4, mercKills: 30, kills: 100 }));
  assert.ok(!c({ mercDeployed: 4, mercKills: 29, kills: 100 }));
  assert.ok(!c({ mercDeployed: 0, mercKills: 0, kills: 100 }));
  assert.ok(!c({ mercDeployed: 4, mercKills: 0, kills: 0 }), '除零保护');
});

test('分配规则：兵任务只出现在第 30 关以后的普通类型关卡', () => {
  let count = 0;
  for (const n of Object.keys(D.levels).map(Number)) {
    const id = D.missionFor(n);
    if (!id) continue;
    assert.ok(M[id], `第 ${n} 关任务 ${id} 存在`);
    if (!D.isMercMission(id)) continue;
    count++;
    const lvl = D.levels[n];
    assert.ok(n >= 30, `第 ${n} 关太早`);
    assert.ok(!['boss', 'miniboss', 'elite', 'tutorial'].includes(lvl.type), `第 ${n} 关是特殊关卡`);
    assert.ok(!lvl.tower);
  }
  assert.ok(count >= 20, '兵任务数量足够：' + count);
  for (let n = 1; n < 30; n++) assert.ok(!D.isMercMission(D.missionFor(n)));
});

test('分配规则：7 种兵任务都会出现；特殊关卡任务不变', () => {
  const seen = new Set();
  for (let n = 1; n <= 200; n++) if (D.isMercMission(D.missionFor(n))) seen.add(D.missionFor(n));
  assert.strictEqual(seen.size, 7);
  for (let n = 1; n <= 200; n++) {
    const t = D.levels[n].type;
    if (t === 'boss' || t === 'miniboss') assert.ok(!D.isMercMission(D.missionFor(n)));
  }
});

test('战斗结果带有雇佣兵统计字段，且任务判定可用', () => {
  const save = TD.progression.newSave();
  for (let k = 1; k <= 33; k++) save.levels[k] = { stars: 1, clears: 1 };
  const lo = TD.progression.battleLoadout(save);
  assert.ok(lo.mercs.length >= 1);
  const b = new TD.Battle({ level: 34, stats: TD.progression.heroStats(save), loadout: lo, seed: 3, autoMercs: true, autoSupply: true });
  const res = b.runToEnd(120);
  for (const k of ['mercBlocks', 'mercPeak', 'mercMaxRanks', 'mercRallies', 'mercCarried', 'mercDeployed', 'mercKills', 'kills']) assert.strictEqual(typeof res[k], 'number', k);
  assert.ok(res.mercCarried >= 1 && res.mercCarried <= 3);
  assert.ok(res.mercPeak <= TD.config.merc.cap);
  assert.strictEqual(res.mercRallies, 0);
  for (const id of MERC_IDS) assert.strictEqual(typeof M[id].check(res), 'boolean');
});

test('不带兵的战斗：统计全为 0，兵任务都不通过', () => {
  const save = TD.progression.newSave();
  for (let k = 1; k <= 33; k++) save.levels[k] = { stars: 1, clears: 1 };
  const lo = TD.progression.battleLoadout(save);
  lo.mercs = [];
  const b = new TD.Battle({ level: 34, stats: TD.progression.heroStats(save), loadout: lo, seed: 3 });
  const res = b.runToEnd(60);
  assert.strictEqual(res.mercCarried, 0);
  for (const id of MERC_IDS) assert.strictEqual(M[id].check(res), false, id);
});
