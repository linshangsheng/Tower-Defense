// v1.96：雇佣兵（出兵）玩法已移除——默认关闭状态下，游戏里不应再有任何雇佣兵的痕迹（设计书 196）
const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load.js');
const P = TD.progression;
const D = TD.data;

const fullSave = () => {
  const s = P.newSave();
  for (let n = 1; n <= 200; n++) s.levels[n] = { stars: 3, clears: 1 };
  return s;
};

test('总开关默认关闭', () => {
  assert.strictEqual(TD.config.merc.enabled, false);
});

test('战斗里没有兵：不能雇佣、没有军饷、怪物没有"带兵增强"', () => {
  const s = fullSave();
  const lo = P.battleLoadout(s);
  const b = new TD.Battle({ level: 40, stats: P.heroStats(s), loadout: lo, seed: 1, autoMercs: true });
  assert.strictEqual(b.mercsOn, false);
  assert.strictEqual(b.funds, 0);
  b.waveState = 'waiting';
  assert.strictEqual(b.mercReady(0), false);
  assert.strictEqual(b.deployMerc(0, 0), false);
  assert.strictEqual(b.rallyReady(), false);
  // 怪物血量和不带兵的战斗一样
  const lo2 = Object.assign({}, lo, { mercs: [] });
  const b2 = new TD.Battle({ level: 40, stats: P.heroStats(s), loadout: lo2, seed: 1 });
  const m1 = b.spawnMonster('goblin', 0, 900);
  const m2 = b2.spawnMonster('goblin', 0, 900);
  assert.strictEqual(m1.maxHp, m2.maxHp);
  for (let i = 0; i < 60 * 30 && !b.over; i++) b.step(1 / 60);
  assert.strictEqual(b.mercs.length, 0, '机器人也不会雇兵');
});

test('成就、成就分组、每日规则、援军光球、团长剧情都不再出现', () => {
  assert.ok(!D.achievements.some((a) => /^merc/.test(a.id)));
  assert.ok(!TD.codex.GROUPS.some((g) => g.key === 'merc'));
  assert.ok(!('mercfair' in TD.modes.dailyRules));
  assert.strictEqual(D.drops.reinforce.w, 0);
  assert.ok(!D.storyOrder.some((k) => /^merc\d+$/.test(k)));
});

test('关卡任务里没有雇佣兵任务', () => {
  for (let n = 1; n <= 200; n++) {
    const m = D.missionFor(n);
    assert.ok(!m || !D.isMercMission(m), '第 ' + n + ' 关');
  }
});

test('玩家能看到的说明文字里不再提到兵', () => {
  for (const [k, def] of Object.entries(D.monsters)) assert.ok(!/雇佣兵|前排的兵|后排的弓手/.test(def.desc || ''), k);
  for (const [k, def] of Object.entries(D.activeSkills)) assert.ok(!def.link, k);
  assert.ok(!D.ultimate.link);
  assert.ok(!/雇佣兵/.test(D.levels[6].tip) && !/雇佣兵/.test(D.levels[106].tip || ''));
});

test('老存档里的雇佣兵字段不影响读档和开战', () => {
  const s = fullSave();
  s.mercLv = { swordsman: 5 };
  s.mercLoadout = ['swordsman', 'guard'];
  s.mercChosen = true;
  const m = P.migrate(s);
  const b = new TD.Battle({ level: 20, stats: P.heroStats(m), loadout: P.battleLoadout(m), seed: 2 });
  assert.strictEqual(b.mercsOn, false);
});

test('没有雇佣兵时：原雇佣兵任务位换成新玩法任务，大 Boss 关是弱点猎手（设计书 200）', () => {
  const ids = new Set();
  for (let n = 1; n <= 200; n++) {
    const id = D.missionFor(n);
    if (id) ids.add(id);
    assert.ok(!id || !D.isMercMission(id), `第 ${n} 关不该有雇佣兵任务`);
    if (D.levels[n].type === 'rush') assert.notStrictEqual(id, 'perfect3', `突袭关 ${n} 不判定完美防守`);
    if (id === 'elite4') assert.ok(n >= 20);
  }
  for (const id of ['perfect3', 'elite4', 'streak60', 'weak3']) assert.ok(ids.has(id), id);
  assert.strictEqual(D.missionFor(20), 'weak3');
  assert.strictEqual(D.missionFor(10), 'interrupt2', '可打断的 Boss 还是打断任务');
  assert.ok(D.missions.weak3.check({ weakHits: 3 }));
  assert.ok(!D.missions.perfect3.check({ perfectWaves: 2 }));
  assert.ok(D.missions.elite4.check({ elites: 4 }));
  assert.ok(D.missions.streak60.check({ bestStreak: 61 }));
});
