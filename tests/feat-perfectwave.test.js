const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load');
const P = TD.progression;

function battleFor(n) {
  const save = P.newSave();
  for (let k = 1; k < n; k++) save.levels[k] = { stars: 1, clears: 1 };
  TD.bot.shop(save);
  return TD.bot.playLevel(save, n, { seed: 11 });
}

test('完美防守：零伤波次计数并给铜币，结果里带上', () => {
  const { res, battle } = battleFor(1);
  assert.ok(res.win);
  assert.ok(res.perfectWaves >= 1, 'perfect waves ' + res.perfectWaves);
  assert.ok(res.perfectCopper > 0);
  assert.equal(res.perfectWaves, battle.perfectWaves);
});

test('完美防守：城墙掉血就断连，连击倍率封顶', () => {
  const save = P.newSave();
  const b = new TD.Battle({ level: 3, stats: P.heroStats(save), loadout: P.battleLoadout(save), seed: 1 });
  b.waveIndex = 0;
  b.markPerfectWave();
  assert.ok(b.checkPerfectWave());
  assert.equal(b.perfectStreak, 1);
  const first = b.perfectCopper;
  b.waveIndex = 1;
  b.markPerfectWave();
  assert.ok(b.checkPerfectWave());
  assert.ok(b.perfectCopper - first > first, 'streak pays more');
  assert.equal(b.checkPerfectWave(), false, 'same wave not counted twice');
  b.waveIndex = 2;
  b.markPerfectWave();
  b.wallDamageTaken += 5;
  let broke = null;
  b.on('perfectBreak', (e) => (broke = e));
  assert.equal(b.checkPerfectWave(), false);
  assert.equal(b.perfectStreak, 0);
  assert.equal(broke.streak, 2);
  b.perfectStreak = 50;
  b.waveIndex = 3;
  b.markPerfectWave();
  let ev;
  b.on('perfectWave', (e) => (ev = e));
  b.checkPerfectWave();
  assert.equal(ev.mult, TD.config.perfectWave.maxMult);
});

test('完美防守：奖励算进结算铜币、统计和今日任务池', () => {
  const save = P.newSave();
  const r = P.applyResult(save, 1, { win: true, wallRatio: 1, killCopper: 0, earlyCopper: 0, perfectCopper: 17, perfectWaves: 3, kills: 1 });
  assert.equal(r.perfectCopper, 17);
  assert.ok(TD.quests.POOL.perfect);
  assert.equal(TD.quests.POOL.perfect.stat({ perfectWaves: 4 }), 4);
});

test('突袭关和妖塔不算完美防守', () => {
  const save = P.newSave();
  const b = new TD.Battle({ level: 3, stats: P.heroStats(save), loadout: P.battleLoadout(save), seed: 1 });
  b.level = Object.assign({}, b.level, { type: 'rush' });
  b.waveIndex = 0;
  b.markPerfectWave();
  assert.equal(b.checkPerfectWave(), false);
});

test('新成就：完美防守 / 弱点 / 今日任务累计（设计书 202）', () => {
  const save = P.newSave();
  for (let k = 1; k <= 5; k++) save.levels[k] = { stars: 1, clears: 1 };
  P.recordStats(save, { kills: 1, perfectWaves: 50, bestPerfectStreak: 8, weakHits: 20 }, true);
  assert.strictEqual(save.stats.perfectWaves, 50);
  assert.strictEqual(save.stats.bestPerfectStreak, 8);
  save.stats.questsDone = 29;
  const st = TD.quests.today(save);
  st.list[0].prog = TD.quests.POOL[st.list[0].id].goal;
  assert.ok(TD.quests.claim(save, 0));
  assert.strictEqual(save.stats.questsDone, 30);
  const got = P.checkAchievements(save).map((a) => a.id);
  for (const id of ['perfect50', 'perfectRun8', 'weak20', 'quests30']) assert.ok(got.includes(id), id);
  const grouped = new Set(TD.codex.GROUPS.flatMap((g) => g.ids));
  for (const id of ['perfect50', 'perfectRun8', 'weak20', 'quests30']) assert.ok(grouped.has(id), id + ' 在图鉴分组里');
});
