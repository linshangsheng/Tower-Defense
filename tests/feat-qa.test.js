// QA 对抗测试的回归用例（坏存档 + 小型模糊战斗）
const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load');
const P = TD.progression;
const D = TD.data;

test('mercLoadout 不是数组（数字 / 对象 / 布尔）时 mercLoadoutIds 不抛异常', () => {
  for (const bad of [7, -5, Infinity, {}, { 0: 'swordsman', length: 1 }, true, () => 1]) {
    const s = P.newSave();
    s.levels[10] = { stars: 1, clears: 1 };
    s.mercLoadout = bad;
    assert.doesNotThrow(() => P.mercLoadoutIds(s));
    assert.doesNotThrow(() => P.battleLoadout(s));
  }
});

test('recordStats：后加的计数字段是字符串 / 数组 / 对象时不会变成拼接字符串', () => {
  for (const bad of ['x', [1, 2], {}, NaN, '__proto__']) {
    const s = P.migrate(JSON.parse(JSON.stringify(P.newSave())));
    for (const k of ['mercDeployed', 'mercKills', 'treasures', 'elites', 'drops']) s.stats[k] = bad;
    P.recordStats(s, { kills: 3, mercDeployed: 2, mercKills: 1, treasures: 1, elites: 1, drops: 1, killsByType: {}, combos: {}, supplies: [] }, true);
    for (const k of ['mercDeployed', 'mercKills', 'treasures', 'elites', 'drops']) assert.ok(Number.isFinite(s.stats[k]) && s.stats[k] <= 3, k + ' ' + s.stats[k]);
  }
});

test('坏的 mercLv / mercLoadout 经 migrate 后能正常开战并雇兵', () => {
  const cases = [{ mercLv: 'x' }, { mercLv: [3] }, { mercLv: { swordsman: '5abc', guard: 1e308, archer: -3 } }, { mercLoadout: ['nope', 'swordsman', 'swordsman', 'guard', 'guard', 'archer'] }, { mercLoadout: Array.from({ length: 5000 }, (_, i) => 'x' + i) }];
  for (const c of cases) {
    const s = Object.assign(P.newSave(), c);
    for (let k = 1; k <= 30; k++) s.levels[k] = { stars: 1, clears: 1 };
    const m = P.migrate(JSON.parse(JSON.stringify(s)));
    const lo = P.battleLoadout(m);
    assert.ok(lo.mercs.length <= 3 && lo.mercs.every((x) => D.mercs[x.id] && x.level >= 1 && x.level <= 10 && Number.isInteger(x.level)));
    const b = new TD.Battle({ level: 20, stats: P.heroStats(m), loadout: lo, seed: 3, autoMercs: true });
    for (let i = 0; i < 1500 && !b.over; i++) b.step(0.1);
    assert.ok(Number.isFinite(b.funds) && b.funds >= 0);
  }
});

test('卡顿大步长下的小型模糊局：不变量成立', () => {
  const C = TD.config;
  for (let seed = 1; seed <= 6; seed++) {
    const s = P.newSave();
    for (let k = 1; k < 40; k++) s.levels[k] = { stars: 1, clears: 1 };
    const lo = P.battleLoadout(s);
    const b = new TD.Battle({ level: 10 + seed * 5, stats: P.heroStats(s), loadout: lo, seed, autoMercs: seed % 2 === 0 });
    let i = 0;
    while (!b.over && i++ < 20000) {
      if (b.pendingSupply) { b.chooseSupply(b.botSupplyChoice(b.pendingSupply)); continue; }
      if (i % 37 === 0) b.rallyMercs(i % b.lanes);
      if (i % 53 === 0) b.deployMerc(i % 3, i % b.lanes);
      if (i % 29 === 0 && b.monsters[0]) b.focusAt(b.monsters[0].x, b.monsters[0].y + b.monsters[0].yOffset);
      if (i % 61 === 0) b.repairAt(100, 300);
      b.step(i % 11 === 0 ? 0.2 : 1 / 60);
      assert.ok(Number.isFinite(b.funds) && b.funds >= 0);
      for (const u of b.mercs) if (!u.dead) assert.ok(u.x >= C.wallX && u.x <= 1290 && Number.isFinite(u.hp));
    }
    if (b.over) for (const v of Object.values(b.result)) if (typeof v === 'number') assert.ok(Number.isFinite(v));
  }
});
