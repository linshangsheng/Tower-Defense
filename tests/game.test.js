// 核心逻辑测试：node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load');
const P = TD.progression;
const D = TD.data;

function clearUpTo(save, n) {
  for (let k = 1; k <= n; k++) save.levels[k] = { stars: 1, clears: 1 };
}

test('难度系数 D(n) 与设计书 8.2 一致', () => {
  assert.strictEqual(TD.config.difficulty(1), 1);
  assert.ok(Math.abs(TD.config.difficulty(10) - 2.6335) < 0.01);
  assert.ok(Math.abs(TD.config.difficulty(50) - 16.75) < 0.05);
});

test('新存档的初始属性', () => {
  const s = P.newSave();
  const st = P.heroStats(s);
  assert.strictEqual(st.atk, 10);
  assert.strictEqual(st.aspd, 1);
  assert.ok(Math.abs(st.crit - 0.1) < 1e-9, '木弓自带 5% 额外暴击');
  assert.strictEqual(st.wallMax, 1000);
  assert.strictEqual(P.slotCount(s, 'active'), 1);
  assert.strictEqual(P.slotCount(s, 'passive'), 0);
  assert.strictEqual(P.slotCount(s, 'item'), 0);
});

test('购买属性会扣钱并提升属性', () => {
  const s = P.newSave();
  s.copper = 1000;
  const cost = P.attrCost(s, 'atk').copper;
  assert.ok(P.buyAttr(s, 'atk'));
  assert.strictEqual(s.copper, 1000 - cost);
  assert.strictEqual(P.heroStats(s).atk, 12);
  s.copper = 0;
  assert.ok(!P.buyAttr(s, 'atk'), '钱不够不能买');
});

test('槽位随通关解锁', () => {
  const s = P.newSave();
  clearUpTo(s, 2);
  assert.strictEqual(P.slotCount(s, 'item'), 1);
  clearUpTo(s, 5);
  assert.strictEqual(P.slotCount(s, 'active'), 2);
  assert.strictEqual(P.slotCount(s, 'passive'), 1);
  clearUpTo(s, 10);
  assert.strictEqual(P.slotCount(s, 'item'), 3);
  assert.strictEqual(P.slotCount(s, 'passive'), 2);
});

test('首通奖励只发一次；重复通关铜币减半', () => {
  const s = P.newSave();
  const r1 = P.applyResult(s, 1, { win: true, wallRatio: 1, killCopper: 0, earlyCopper: 0 });
  assert.strictEqual(r1.silver, 2, '首通 1 银 + 首次三星 1 银');
  assert.strictEqual(r1.copper, Math.round(TD.config.rewards.baseCopper(1) * 1.5));
  const r2 = P.applyResult(s, 1, { win: true, wallRatio: 1, killCopper: 0, earlyCopper: 0 });
  assert.strictEqual(r2.silver, 0);
  assert.strictEqual(r2.copper, Math.round(TD.config.rewards.baseCopper(1) * 1.5 * 0.5));
});

test('Boss 关首通发金币', () => {
  const s = P.newSave();
  clearUpTo(s, 9);
  const r = P.applyResult(s, 10, { win: true, wallRatio: 0.3, killCopper: 0, earlyCopper: 0 });
  assert.strictEqual(r.gold, 3);
  assert.strictEqual(r.silver, 10);
});

test('失败给安慰奖励，不记通关', () => {
  const s = P.newSave();
  const r = P.applyResult(s, 3, { win: false, wallRatio: 0, killCopper: 10, earlyCopper: 0 });
  assert.strictEqual(r.copper, Math.round(TD.config.rewards.baseCopper(3) * 0.15 + 10));
  assert.ok(!P.isCleared(s, 3));
});

test('消耗品：买、放入槽、使用后扣除', () => {
  const s = P.newSave();
  clearUpTo(s, 2);
  s.copper = 500;
  assert.ok(P.buyItem(s, 'bomb'));
  assert.strictEqual(s.loadout.items[0], 'bomb', '有空槽自动放入');
  assert.deepStrictEqual(P.battleLoadout(s).items, ['bomb']);
  P.consumeItem(s, 'bomb');
  assert.strictEqual(s.inventory.bomb, 0);
  assert.strictEqual(s.loadout.items[0], null, '用完后槽位清空');
});

test('同一技能不能同时放两个槽', () => {
  const s = P.newSave();
  clearUpTo(s, 5);
  s.activeOwned.thunder = true;
  P.setSlot(s, 'active', 1, 'thunder');
  P.setSlot(s, 'active', 0, 'thunder');
  assert.deepStrictEqual(s.loadout.active.slice(0, 2), ['thunder', 'drum']);
});

test('汇兑所是单向的', () => {
  const s = P.newSave();
  s.copper = 250;
  assert.ok(P.exchange(s, 'copper', 2));
  assert.strictEqual(s.copper, 50);
  assert.strictEqual(s.silver, 2);
  assert.ok(!P.exchange(s, 'copper', 1));
});

test('战斗结果可复现（同种子同结果）', () => {
  const run = () => {
    const s = P.newSave();
    const b = new TD.Battle({ level: 2, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 42 });
    return b.runToEnd();
  };
  const a = run();
  const b = run();
  assert.strictEqual(a.win, b.win);
  assert.strictEqual(a.kills, b.kills);
  assert.strictEqual(a.wallRatio, b.wallRatio);
});

test('第 1 关新手不升级也能通过', () => {
  const s = P.newSave();
  const b = new TD.Battle({ level: 1, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 7 });
  const r = b.runToEnd();
  assert.ok(r.win);
});

test('木盾哥布林：正面攻击被护甲减伤，回旋镖返程不减', () => {
  const s = P.newSave();
  const b = new TD.Battle({ level: 8, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  const g1 = b.spawnMonster('goblin', 0, 900);
  const g2 = b.spawnMonster('goblin', 0, 900);
  const front = b.damage(g1, 50, { type: 'phys', fromFront: true });
  const back = b.damage(g2, 50, { type: 'phys', fromFront: false });
  assert.ok(front < back * 0.6, `正面 ${front} 应明显低于背面 ${back}`);
});

test('果冻王子受伤会分裂', () => {
  const s = P.newSave();
  const b = new TD.Battle({ level: 5, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  const jp = b.spawnMonster('jellyPrince', 1, 800);
  const before = b.monsters.length;
  b.damage(jp, jp.maxHp * 0.32, { type: 'magic' });
  assert.strictEqual(b.monsters.length - before, 4, '掉血 32% 跨过两个 15% 阈值，分裂 2×2 只');
});

test('咕噜大王冲锋可以被打断', () => {
  const s = P.newSave();
  const b = new TD.Battle({ level: 10, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  b.waveState = 'final';
  const boss = b.spawnMonster('boarKing', 1, D.boarKing.holdX);
  boss.hp = boss.maxHp * 0.55;
  let warned = false;
  let interrupted = false;
  b.on('bossWarn', () => (warned = true));
  b.on('bossInterrupt', () => (interrupted = true));
  for (let i = 0; i < 60 * 6 && !warned; i++) b.step(1 / 60);
  assert.ok(warned, '进入第二阶段后会预警冲锋');
  b.damage(boss, boss.maxHp * 0.07, { type: 'magic' });
  assert.ok(interrupted, '预警期间受到足够伤害会被打断');
});

test('一键推荐配装：空袭关推荐连发弩和飞行优先', () => {
  const s = P.newSave();
  clearUpTo(s, 6);
  s.weapons.crossbow.owned = true;
  P.recommend(s, 7);
  assert.strictEqual(s.loadout.weapon, 'crossbow');
  assert.strictEqual(s.loadout.target, 'flying');
});

test('存档迁移会补齐缺失字段', () => {
  const old = { version: 0, copper: 5, levels: { 1: { stars: 2, clears: 1 } } };
  const s = P.migrate(old);
  assert.strictEqual(s.copper, 5);
  assert.strictEqual(s.levels[1].stars, 2);
  assert.ok(s.loadout && s.loadout.active);
  assert.strictEqual(s.version, P.SAVE_VERSION);
});
