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
  assert.strictEqual(r1.silver, 0, '普通关卡不给银币（设计书 88）');
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

test('消耗品：买进背包、装备到栏位（每种最多 3 个）、使用后已装备的个数减 1', () => {
  const s = P.newSave();
  clearUpTo(s, 2);
  s.copper = 500;
  assert.ok(P.buyItem(s, 'bomb'));
  assert.strictEqual(s.inventory.bomb, 1);
  assert.strictEqual(s.loadout.items[0], null, '买下来只是进背包，不会自动装备');
  assert.deepStrictEqual(P.battleLoadout(s).items, []);
  assert.ok(P.adjustItem(s, 'bomb', 1));
  assert.strictEqual(s.loadout.items[0], 'bomb');
  assert.strictEqual(P.itemEquipped(s, 'bomb'), 1);
  assert.strictEqual(P.itemStock(s, 'bomb'), 0);
  assert.deepStrictEqual(P.battleLoadout(s).items, ['bomb']);
  P.consumeItem(s, 'bomb');
  assert.strictEqual(P.itemEquipped(s, 'bomb'), 0);
  assert.strictEqual(s.loadout.items[0], null, '用完后槽位清空');
  assert.strictEqual(s.inventory.bomb, 0, '用掉的不会回到背包');
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

test('战场补给：第 2 波结束后出现三选一，选择后生效并继续下一波', () => {
  const s = P.newSave();
  const b = new TD.Battle({ level: 4, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 3 });
  let offered = null;
  b.on('supply', (e) => (offered = e.choices));
  while (!b.pendingSupply && !b.over && b.time < 400) b.step(1 / 60);
  assert.ok(offered && offered.length === 3, '应出现 3 张补给卡');
  assert.strictEqual(b.waveIndex, 1, '在第 2 波之后');
  const t = b.time;
  b.step(1 / 60);
  assert.strictEqual(b.time, t, '选择前战斗暂停');
  const pick = offered.includes('sharp') ? 'sharp' : offered[0];
  const atk0 = b.atk;
  assert.ok(b.chooseSupply(pick));
  assert.strictEqual(b.waveIndex, 2, '选完立即进入第 3 波');
  if (pick === 'sharp') assert.ok(b.atk > atk0);
});

test('补给的铜币加成计入结算', () => {
  const s = P.newSave();
  const r = P.applyResult(s, 1, { win: true, wallRatio: 1, killCopper: 0, earlyCopper: 0, copperBonus: 0.25 });
  assert.strictEqual(r.copper, Math.round(TD.config.rewards.baseCopper(1) * 1.5 * 1.25));
});

// ---------- 第二章机制 ----------
function newBattle(level, mutate) {
  const s = P.newSave();
  if (mutate) mutate(s);
  const b = new TD.Battle({ level, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 9 });
  b.waveState = 'final';
  return b;
}

test('沙沙蝎钻地后无法被选中，到 x=450 后钻出', () => {
  const b = newBattle(11);
  const m = b.spawnMonster('scorpion', 0, 1060);
  for (let i = 0; i < 60 && !m.burrowed; i++) b.step(1 / 60);
  assert.ok(m.burrowed, '越过 x=1050 后钻地');
  assert.ok(!b.isTargetable(m));
  while (m.burrowed && b.time < 60) b.step(1 / 60);
  assert.ok(m.x <= 450 && b.isTargetable(m), '钻出后可以被攻击');
});

test('仙人掌球撞墙爆炸，不掉铜币', () => {
  const b = newBattle(14);
  const m = b.spawnMonster('cactus', 0, 200);
  const hp0 = b.wall.hp;
  for (let i = 0; i < 120 && !m.dead; i++) b.step(1 / 60);
  assert.ok(m.dead);
  assert.ok(hp0 - b.wall.hp >= 60 * b.D * 0.99, '一次造成 60×D 伤害');
  assert.strictEqual(b.killCopper, 0);
});

test('小祭司给周围的怪回血', () => {
  const b = newBattle(17);
  const pr = b.spawnMonster('priest', 0, 560);
  const mu = b.spawnMonster('mummy', 0, 600);
  mu.hp = mu.maxHp * 0.5;
  b.hero.cooldown = 999;
  for (let i = 0; i < 70; i++) b.step(1 / 60);
  assert.ok(mu.hp > mu.maxHp * 0.5, '一秒后回血');
  assert.ok(!pr.dead);
});

test('魔法伤害无视绷带球的物理护甲', () => {
  const b = newBattle(12);
  const a = b.spawnMonster('mummy', 0, 800);
  const c = b.spawnMonster('mummy', 0, 800);
  const phys = b.damage(a, 50, { type: 'phys' });
  const magic = b.damage(c, 50, { type: 'magic' });
  assert.ok(phys < 25 && magic === 50, `物理 ${phys}，魔法 ${magic}`);
});

test('魔法杖命中后范围爆炸', () => {
  const b = newBattle(12, (s) => {
    s.weapons.staff.owned = true;
    s.loadout.weapon = 'staff';
  });
  const m1 = b.spawnMonster('slime', 1, 700);
  const m2 = b.spawnMonster('slime', 1, 730);
  for (let i = 0; i < 120; i++) b.step(1 / 60);
  assert.ok(m1.hp < m1.maxHp && m2.hp < m2.maxHp, '两只都受到伤害');
});

test('胖法老的金字塔护盾：物理效果很差，魔法效果好', () => {
  const b = newBattle(20);
  const f = b.spawnMonster('pharaoh', 1, 820);
  b.raiseShield(f);
  const sh = f.shield;
  const hp = f.hp;
  b.damage(f, 100, { type: 'phys' });
  assert.strictEqual(f.hp, hp, '护盾存在时本体不掉血');
  const physLoss = sh - f.shield;
  const before = f.shield;
  b.damage(f, 100, { type: 'magic' });
  const magicLoss = before - f.shield;
  assert.ok(magicLoss >= physLoss * 5, `魔法 ${magicLoss} 远高于物理 ${physLoss}`);
});

test('胖法老的沙暴降低英雄攻速', () => {
  const b = newBattle(20);
  b.spawnMonster('pharaoh', 1, 820);
  const a0 = b.currentAspd();
  let storm = false;
  b.on('sandstorm', () => (storm = true));
  for (let i = 0; i < 60 * 8 && !storm; i++) b.step(1 / 60);
  assert.ok(storm);
  assert.ok(b.currentAspd() < a0 * 0.8);
});

test('补给卡池按章节扩充', () => {
  const b1 = newBattle(5);
  const b2 = newBattle(15);
  const pool = (b) => {
    const seen = new Set();
    for (let i = 0; i < 40; i++) {
      b.supplyPicked = [];
      b.offerSupply();
      b.pendingSupply.forEach((x) => seen.add(x));
    }
    return seen;
  };
  assert.ok(!pool(b1).has('arcane'), '第一章没有奥术涌动');
  assert.ok(pool(b2).has('arcane'), '第二章有奥术涌动');
});

// ---------- v0.8 成长深度 ----------
test('技能升阶：Lv2 银币、Lv3 金币，效果随等级提升', () => {
  const s = P.newSave();
  s.silver = 10;
  s.gold = 5;
  s.activeOwned.thunder = true;
  assert.deepStrictEqual(P.skillUpgradeCost(s, 'thunder'), { silver: 6 });
  assert.ok(P.upgradeSkill(s, 'thunder'));
  assert.strictEqual(P.skillLevel(s, 'thunder'), 2);
  assert.deepStrictEqual(P.skillUpgradeCost(s, 'thunder'), { gold: 2 });
  assert.ok(P.upgradeSkill(s, 'thunder'));
  // 第 3 级以后还能继续升（设计书 76）：费用按等级涨，满级是 999999 级
  assert.ok(P.skillUpgradeCost(s, 'thunder'), 'Lv3 以后还能升');
  s.skillLv.thunder = D.levelCap;
  assert.strictEqual(P.skillUpgradeCost(s, 'thunder'), null, '满级');
  assert.strictEqual(P.skillDef('thunder', 3).atkMult, 3.5);
  assert.strictEqual(P.skillDef('thunder', 1).atkMult, 2.5);
});

test('雷霆一击 Lv3 会连锁', () => {
  const s = P.newSave();
  s.activeOwned.thunder = true;
  s.skillLv.thunder = 3;
  s.loadout.active = ['thunder', null, null];
  const b = new TD.Battle({ level: 1, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  b.waveState = 'final';
  const big = b.spawnMonster('goblin', 0, 600);
  const others = [b.spawnMonster('slime', 0, 640), b.spawnMonster('slime', 0, 680)];
  b.time = 1;
  let chains = 0;
  b.on('thunderChain', () => chains++);
  assert.ok(b.castSkill(0));
  assert.strictEqual(chains, 2);
  assert.ok(others.every((m) => m.hp < m.maxHp));
  assert.ok(big.hp < big.maxHp);
});

test('武器进阶：需要 Lv5，连环弩射 4 支', () => {
  const s = P.newSave();
  s.silver = 20;
  s.weapons.crossbow.owned = true;
  assert.ok(!P.canAscend(s, 'crossbow'), 'Lv0 不能进阶');
  s.weapons.crossbow.lv = 5;
  assert.ok(P.ascendWeapon(s, 'crossbow'));
  assert.strictEqual(s.silver, 12);
  s.loadout.weapon = 'crossbow';
  const st = P.heroStats(s);
  assert.strictEqual(st.weaponDef.bolts, 4);
  assert.strictEqual(st.weaponDef.name, '连环弩');
});

test('木弓进阶后射程和暴击伤害提升', () => {
  const s = P.newSave();
  const st0 = P.heroStats(s);
  s.weapons.bow.lv = 5;
  s.silver = 8;
  assert.ok(P.ascendWeapon(s, 'bow'));
  const st1 = P.heroStats(s);
  assert.ok(st1.range > st0.range);
  assert.ok(Math.abs(st1.critDmg - st0.critDmg - 0.3) < 1e-9);
});

test('存档导出再导入，内容一致（含中文）', () => {
  const s = P.newSave();
  s.copper = 1234;
  s.levels[3] = { stars: 2, clears: 4 };
  s.note = '守城英雄';
  const code = TD.saveStore.exportCode(s);
  assert.ok(code.startsWith('SCYX1:'));
  const back = TD.saveStore.importCode('  ' + code + '\n');
  assert.strictEqual(back.copper, 1234);
  assert.strictEqual(back.levels[3].clears, 4);
  assert.strictEqual(back.note, '守城英雄');
  assert.strictEqual(TD.saveStore.importCode('乱写的'), null);
  assert.strictEqual(TD.saveStore.importCode('SCYX1:@@@'), null);
});

// ---------- 第三章机制 ----------
test('小幽灵：物理伤害只有 30%，驱魔之箭提升到 70%', () => {
  const b = newBattle(21);
  const g1 = b.spawnMonster('ghost', 0, 800);
  const g2 = b.spawnMonster('ghost', 0, 800);
  const g3 = b.spawnMonster('ghost', 0, 800);
  assert.ok(Math.abs(b.damage(g1, 100, { type: 'phys' }) - 30) < 0.01);
  assert.strictEqual(b.damage(g2, 100, { type: 'magic' }), 100);
  b.mods.spiritPierce = 0.4;
  assert.ok(Math.abs(b.damage(g3, 100, { type: 'phys' }) - 70) < 0.01);
});

test('毒蛙停在远处吐毒，城墙持续中毒；解毒剂减免持续伤害', () => {
  const run = (antidote) => {
    const b = newBattle(22);
    b.hero.cooldown = 1e9;
    if (antidote) b.mods.dotReduce = 0.6;
    const f = b.spawnMonster('frog', 0, 490);
    for (let i = 0; i < 60 * 6; i++) b.step(1 / 60);
    assert.ok(Math.abs(f.x - 480) < 1, '停在 x=480');
    return b.wall.max - b.wall.hp;
  };
  const plain = run(false);
  const cured = run(true);
  assert.ok(plain > 0);
  assert.ok(cured < plain, `解毒后 ${cured} < ${plain}`);
});

test('树桩怪 2 秒没挨打就回血', () => {
  const b = newBattle(26);
  b.hero.cooldown = 1e9;
  const m = b.spawnMonster('stump', 0, 1200);
  b.damage(m, m.maxHp * 0.5, { type: 'magic' });
  const hp0 = m.hp;
  for (let i = 0; i < 60; i++) b.step(1 / 60);
  assert.ok(Math.abs(m.hp - hp0) < 1e-6, '2 秒内不回血');
  for (let i = 0; i < 120; i++) b.step(1 / 60);
  assert.ok(m.hp > hp0, '之后开始回血');
});

test('蝙蝠会换车道', () => {
  const b = newBattle(24);
  b.hero.cooldown = 1e9;
  const m = b.spawnMonster('bat', 2, 1250);
  const lanes = new Set([m.lane]);
  for (let i = 0; i < 60 * 8; i++) {
    b.step(1 / 60);
    lanes.add(m.lane);
  }
  assert.ok(lanes.size >= 2);
});

test('南瓜头死后裂成 3 只小南瓜', () => {
  const b = newBattle(28);
  const m = b.spawnMonster('pumpkin', 1, 700);
  const n0 = b.monsters.length;
  b.damage(m, 1e6, { type: 'magic' });
  assert.strictEqual(b.monsters.filter((x) => x.type === 'minipumpkin').length, 3);
  assert.strictEqual(b.monsters.length, n0 + 3);
});

test('骨头先生第一次倒下会复活，第二次才死', () => {
  const b = newBattle(25);
  b.hero.cooldown = 1e9;
  const m = b.spawnMonster('boneMage', 2, 760);
  b.damage(m, 1e7, { type: 'magic' });
  assert.ok(!m.dead && m.bones && !b.isTargetable(m), '化成骨头，无法被攻击');
  for (let i = 0; i < 60 * 3.2; i++) b.step(1 / 60);
  assert.ok(!m.bones && b.isTargetable(m));
  assert.ok(Math.abs(m.hp - m.maxHp * 0.5) < 1);
  b.damage(m, 1e7, { type: 'magic' });
  assert.ok(m.dead);
});

test('毒汤婆婆煮汤：小怪血量 +50%', () => {
  const b = newBattle(30);
  b.hero.cooldown = 1e9;
  const w = b.spawnMonster('witch', 2, 760);
  const slime = b.spawnMonster('slime', 0, 1200);
  const hp0 = slime.maxHp;
  w.hp = w.maxHp * 0.6;
  for (let i = 0; i < 60 * 4; i++) b.step(1 / 60);
  assert.ok(slime.cooked);
  assert.ok(Math.abs(slime.maxHp - hp0 * 1.5) < 1e-6);
});

test('联合关：所有车道同时出怪', () => {
  const s = P.newSave();
  const b = new TD.Battle({ level: 29, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  const spawned = [];
  b.on('spawn', (m) => spawned.push(m));
  while (!spawned.length) b.step(1 / 60);
  assert.strictEqual(spawned.length, 5);
  assert.deepStrictEqual(spawned.map((m) => m.lane).sort(), [0, 1, 2, 3, 4]);
});

test('暗夜关射程降低 30%', () => {
  const s = P.newSave();
  const a = new TD.Battle({ level: 22, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  const d = new TD.Battle({ level: 23, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  assert.ok(Math.abs(d.range - a.range * 0.7) < 1e-6);
});

test('雷电法球：闪电在怪之间跳跃', () => {
  const b = newBattle(21, (s) => {
    s.weapons.orb.owned = true;
    s.loadout.weapon = 'orb';
  });
  const ms = [b.spawnMonster('slime', 1, 700), b.spawnMonster('slime', 1, 760), b.spawnMonster('slime', 1, 820), b.spawnMonster('slime', 2, 740)];
  let chains = 0;
  b.on('thunderChain', () => chains++);
  b.hero.cooldown = 0;
  for (let i = 0; i < 30; i++) b.step(1 / 60);
  assert.ok(chains >= 3, `跳跃 ${chains} 次`);
  assert.ok(ms.every((m) => m.hp < m.maxHp));
});

// ---------- 第四章机制 ----------
test('冰晶精灵光环降低英雄攻速，最多叠 3 层；暖手炉减免', () => {
  const b = newBattle(34);
  b.hero.cooldown = 1e9;
  const a0 = b.currentAspd();
  for (let i = 0; i < 4; i++) b.spawnMonster('iceSprite', i, 700);
  b.step(1 / 60);
  assert.ok(Math.abs(b.currentAspd() / a0 - 0.4) < 1e-6, '3 层 −60%');
  b.mods.chillResist = 0.6;
  assert.ok(Math.abs(b.currentAspd() / a0 - 0.76) < 1e-6, '暖手炉减免 60%');
});

test('北极狼三只一组从同一条车道出来', () => {
  const b = newBattle(36);
  const lanes = [];
  for (let i = 0; i < 6; i++) lanes.push(b.spawnMonster('wolf').lane);
  assert.strictEqual(lanes[0], lanes[1]);
  assert.strictEqual(lanes[1], lanes[2]);
  assert.strictEqual(lanes[3], lanes[4]);
});

test('企鹅第一次撞墙造成额外伤害', () => {
  const b = newBattle(32);
  b.hero.cooldown = 1e9;
  b.spawnMonster('penguin', 0, 200);
  const hp0 = b.wall.hp;
  let slam = false;
  b.on('slam', () => (slam = true));
  for (let i = 0; i < 30; i++) b.step(1 / 60);
  assert.ok(slam);
  assert.ok(hp0 - b.wall.hp >= D.monsters.penguin.slam * b.D * 0.99);
});

test('冰棍大叔冻结技能槽', () => {
  const s = P.newSave();
  s.activeOwned.thunder = true;
  for (let k = 1; k <= 10; k++) s.levels[k] = { stars: 1, clears: 1 };
  s.loadout.active = ['drum', 'thunder', null];
  const b = new TD.Battle({ level: 35, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 2 });
  b.waveState = 'final';
  b.hero.cooldown = 1e9;
  b.spawnMonster('iceGiant', 2, 760);
  let frozen = null;
  b.on('skillFrozen', (e) => (frozen = e.index));
  for (let i = 0; i < 60 * 5 && frozen === null; i++) b.step(1 / 60);
  assert.ok(frozen !== null);
  assert.ok(!b.skillReady(frozen), '被冻住的技能不能释放');
});

test('霜霜女王冰封城墙时无法修复', () => {
  const b = newBattle(40);
  b.wall.hp = b.wall.max * 0.5;
  b.wallSealedUntil = b.time + 5;
  b.healWall(100, 'test');
  assert.strictEqual(b.wall.hp, b.wall.max * 0.5);
  b.time += 6;
  b.healWall(100, 'test');
  assert.ok(b.wall.hp > b.wall.max * 0.5);
});

test('countMult 按倍率调整小怪数量，Boss 不变', () => {
  const s = P.newSave();
  const lvl = TD.data.levels[40];
  const old = lvl.countMult;
  lvl.countMult = 2;
  const extra = TD.config.extraMonstersPerLevel;
  TD.config.extraMonstersPerLevel = 0; // 这里只测 countMult，多出的小怪另有测试
  const b = new TD.Battle({ level: 40, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  b.startWave(2);
  assert.strictEqual(b.spawnQueue.filter((x) => x === 'frostQueen').length, 1);
  assert.strictEqual(b.spawnQueue.filter((x) => x === 'wolf').length, 12);
  lvl.countMult = old;
  TD.config.extraMonstersPerLevel = extra;
});

// ---------- 第五章机制 ----------
test('熔岩傀儡：魔法伤害减免 75%，物理正常', () => {
  const b = newBattle(43);
  const a = b.spawnMonster('lavaGolem', 0, 800);
  const c = b.spawnMonster('lavaGolem', 0, 800);
  assert.ok(Math.abs(b.damage(a, 100, { type: 'magic' }) - 25) < 0.01);
  assert.strictEqual(b.damage(c, 100, { type: 'phys' }), 100);
});

test('岩浆团死后留下火焰地带，经过的怪加速；灭火器无效化', () => {
  const b = newBattle(41);
  const m = b.spawnMonster('magma', 1, 700);
  const s = b.spawnMonster('slime', 1, 700);
  const v0 = b.monsterSpeed(s);
  b.damage(m, 1e6, { type: 'magic' });
  assert.ok(Math.abs(b.monsterSpeed(s) - v0 * 1.5) < 1e-6);
  b.mods.fireproof = 1;
  assert.ok(Math.abs(b.monsterSpeed(s) - v0) < 1e-6);
});

test('暗影刺客远处隐身，靠近现身；透视镜提前现身', () => {
  const b = newBattle(44);
  b.hero.cooldown = 1e9;
  const m = b.spawnMonster('assassin', 2, 900);
  b.step(1 / 60);
  assert.ok(m.stealthed && !b.isTargetable(m));
  b.mods.reveal = 1;
  m.x = 790;
  b.step(1 / 60);
  assert.ok(!m.stealthed && b.isTargetable(m));
});

test('岩岩跺脚会震晕英雄；在城墙边爆炸会炸城墙', () => {
  const b = newBattle(45);
  b.hero.cooldown = 1e9;
  const g = b.spawnMonster('rockGolem', 2, 900);
  let stomp = false;
  b.on('stomp', () => (stomp = true));
  for (let i = 0; i < 60 * 8 && !stomp; i++) b.step(1 / 60);
  assert.ok(stomp && b.time < b.heroStunUntil);
  g.x = 300;
  b.wall.max = b.wall.hp = 1e6;
  const hp0 = b.wall.hp;
  b.damage(g, 1e9, { type: 'phys' });
  assert.ok(g.dead);
  assert.ok(hp0 - b.wall.hp > 150 * b.D, '城墙被炸');
  assert.ok(b.laneEffects.some((e) => e.type === 'lava' && e.lane === g.lane));
});

test('墨墨：分身阶段本体无敌，打掉 3 个分身后现身并受到额外伤害', () => {
  const b = newBattle(50);
  b.hero.cooldown = 1e9;
  const m = b.spawnMonster('inkBoss', 2, 760);
  b.damage(m, m.maxHp * 0.3, { type: 'magic' });
  b.step(1 / 60);
  assert.ok(m.hidden && !b.isTargetable(m), '进入分身阶段');
  const clones = b.monsters.filter((o) => o.cloneOf === m && !o.dead);
  assert.strictEqual(clones.length, 3);
  for (const c of clones) b.damage(c, 1e9, { type: 'magic' });
  assert.ok(!m.hidden && m.vulnUntil > b.time);
  const hp0 = m.hp;
  b.damage(m, 100, { type: 'magic' });
  assert.ok(Math.abs(hp0 - m.hp - 150) < 1e-6, '受到 150% 伤害');
});

test('墨墨：魔王形态的重击可以被打断；裂隙狂暴会倒计时', () => {
  const b = newBattle(50);
  b.hero.cooldown = 1e9;
  const m = b.spawnMonster('inkBoss', 2, 760);
  m.ai.phase = 3;
  m.ai.big = true;
  m.ai.mode = 'hold';
  m.ai.slamTimer = 0.01;
  let warned = false;
  let interrupted = false;
  b.on('bossWarn', () => (warned = true));
  b.on('bossInterrupt', () => (interrupted = true));
  for (let i = 0; i < 10; i++) b.step(1 / 60);
  assert.ok(warned);
  b.damage(m, m.maxHp * 0.025, { type: 'magic' });
  assert.ok(interrupted);
  m.hp = m.maxHp * 0.15;
  b.step(1 / 60);
  assert.strictEqual(m.ai.phase, 4);
  assert.ok(m.ai.rageTimer > 25);
});

// ---------- 成就 ----------
test('成就：首通第 1 关发奖励，且只发一次', () => {
  const s = P.newSave();
  const r = P.applyResult(s, 1, { win: true, wallRatio: 1, killCopper: 0, earlyCopper: 0 });
  assert.ok(r.achievements.some((a) => a.id === 'first'));
  const silver = s.silver;
  const r2 = P.applyResult(s, 1, { win: true, wallRatio: 1, killCopper: 0, earlyCopper: 0 });
  assert.ok(!r2.achievements.some((a) => a.id === 'first'));
  assert.strictEqual(s.silver, silver, '重复通关不再发首通和成就奖励');
});

test('成就：毫发无损、不靠技能按战斗结果判定', () => {
  const s = P.newSave();
  for (let k = 1; k <= 11; k++) s.levels[k] = { stars: 1, clears: 1 };
  const r = P.applyResult(s, 12, { win: true, wallRatio: 1, killCopper: 0, earlyCopper: 0, skillsCarried: 0 });
  const ids = r.achievements.map((a) => a.id);
  assert.ok(ids.includes('perfect'));
  assert.ok(ids.includes('noskill'));
});

test('成就：累计统计（打断、击败 Boss）', () => {
  const s = P.newSave();
  const kbt = {};
  for (const k of Object.keys(D.monsters)) if (D.monsters[k].boss) kbt[k] = 1;
  const r = P.applyResult(s, 1, { win: false, wallRatio: 0, killCopper: 0, earlyCopper: 0, interrupts: 10, killsByType: kbt });
  const ids = r.achievements.map((a) => a.id);
  assert.ok(ids.includes('interrupt'));
  assert.ok(ids.includes('bosses'));
});

test('战斗统计击败数和提前召唤次数', () => {
  const s = P.newSave();
  const b = new TD.Battle({ level: 1, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 3 });
  const r = b.runToEnd();
  assert.strictEqual(Object.values(r.killsByType).reduce((a, c) => a + c, 0), r.kills);
});

// ---------- 无尽模式与每日挑战 ----------
test('无尽模式：生成 300 波，难度递增，每 5 / 10 波有 Boss，每 3 波补给', () => {
  const s = P.newSave();
  for (let k = 1; k <= 20; k++) s.levels[k] = { stars: 1, clears: 1 };
  assert.ok(TD.modes.endlessUnlocked(s));
  const lv = TD.modes.buildEndless(s, 1);
  assert.strictEqual(lv.waves.length, 300);
  assert.ok(lv.waves[20].D > lv.waves[0].D);
  assert.ok(lv.waves[4].groups.some(([t]) => D.monsters[t].boss === 'mini'));
  assert.ok(lv.waves[9].groups.some(([t]) => D.monsters[t].boss === 'major'));
  assert.ok(!lv.waves.some((w) => w.groups.some(([t]) => t === 'inkBoss')), '墨墨不进无尽模式');
  const b = new TD.Battle({ level: 'endless', levelDef: lv, stage: lv.stage, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  assert.deepStrictEqual(b.supplyWaves.slice(0, 3), [2, 5, 8]);
});

test('无尽模式：只按刷新纪录发银币', () => {
  const s = P.newSave();
  const r1 = TD.modes.applyEndlessResult(s, { wavesCleared: 12, kills: 0 });
  assert.strictEqual(r1.silver, 2);
  assert.strictEqual(s.endless.best, 12);
  const r2 = TD.modes.applyEndlessResult(s, { wavesCleared: 14, kills: 0 });
  assert.strictEqual(r2.silver, 0, '12 → 14 没跨过 15');
  const r3 = TD.modes.applyEndlessResult(s, { wavesCleared: 30, kills: 0 });
  assert.strictEqual(r3.silver, 4);
  assert.ok(r3.achievements.some((a) => a.id === 'endless30'));
});

test('每日挑战：同一天同一进度结果相同，奖励每天一次', () => {
  const s = P.newSave();
  for (let k = 1; k <= 12; k++) s.levels[k] = { stars: 1, clears: 1 };
  const day = new Date(2026, 9, 11);
  const a = TD.modes.dailyInfo(s, day);
  const b = TD.modes.dailyInfo(s, day);
  assert.deepStrictEqual(a, b);
  assert.ok(a.level >= 1 && a.level <= 12);
  const r1 = TD.modes.applyDailyResult(s, a, { win: true, killCopper: 10 });
  assert.strictEqual(r1.silver, 3);
  const r2 = TD.modes.applyDailyResult(s, a, { win: true, killCopper: 10 });
  assert.strictEqual(r2.silver, 0);
  assert.strictEqual(s.levels[a.level].clears, 1, '不影响关卡记录');
});

test('每日规则生效：危墙、疾风', () => {
  const s = P.newSave();
  const info = { level: 3, rule: 'fragile', seed: 1, key: 'x' };
  const b = new TD.Battle({ level: 3, levelDef: TD.modes.buildDaily(info), stage: 3, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  assert.strictEqual(b.wall.max, 500);
  const info2 = { level: 3, rule: 'swift', seed: 1, key: 'x' };
  const b2 = new TD.Battle({ level: 3, levelDef: TD.modes.buildDaily(info2), stage: 3, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  const m = b2.spawnMonster('slime', 0, 900);
  assert.ok(Math.abs(b2.monsterSpeed(m) - D.monsters.slime.speed * m.speedMult * 1.3) < 1e-9);
});

test('无尽模式：Boss 活着时下一波不来', () => {
  const s = P.newSave();
  for (let k = 1; k <= 20; k++) s.levels[k] = { stars: 1, clears: 1 };
  const lv = TD.modes.buildEndless(s, 1);
  const b = new TD.Battle({ level: 'endless', levelDef: lv, stage: lv.stage, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  b.hero.cooldown = 1e9;
  b.startWave(0);
  b.spawnQueue = [];
  b.waveState = 'waiting';
  b.countdown = 1;
  b.spawnMonster('boneMage', 2, 1200);
  for (let i = 0; i < 120; i++) b.step(1 / 60);
  assert.strictEqual(b.waveIndex, 0);
});

test('老存档迁移：已通关的玩家不显示商店"新"角标', () => {
  const old = { version: 1, copper: 0, levels: { 1: { stars: 3, clears: 1 }, 2: { stars: 2, clears: 1 } }, loadout: { active: ['drum'] }, stats: { battles: 2 } };
  const s = P.migrate(old);
  assert.ok(s.seenTabs.skills && s.seenTabs.exchange);
  assert.ok(s.stats.shopGuided);
  const fresh = P.migrate(P.newSave());
  assert.ok(!fresh.seenTabs.skills, '新存档的技能页是"新"的');
});

test('难度：轻松降低怪物血量和攻城伤害，挑战提高铜币', () => {
  const s = P.newSave();
  const mk = (difficulty) => new TD.Battle({ level: 5, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1, difficulty });
  const easy = mk('easy');
  const normal = mk('normal');
  const me = easy.spawnMonster('slime', 0);
  const mn = normal.spawnMonster('slime', 0);
  assert.ok(Math.abs(me.maxHp / mn.maxHp - 0.75) < 0.02);
  easy.hitWall(100);
  normal.hitWall(100);
  assert.ok(easy.wall.hp > normal.wall.hp);
  const a = P.newSave();
  const b = P.newSave();
  b.settings.difficulty = 'hard';
  const res = { win: true, wallRatio: 1, killCopper: 100 };
  assert.ok(P.applyResult(b, 1, res).copper > P.applyResult(a, 1, res).copper);
});

test('援军鼓舞：连续失败累积、上限 25%、通关清零', () => {
  const s = P.newSave();
  const lose = { win: false, wallRatio: 0, killCopper: 0 };
  assert.strictEqual(P.rally(s, 3), 0);
  P.applyResult(s, 3, lose);
  assert.ok(Math.abs(P.rally(s, 3) - 0.05) < 1e-9);
  for (let i = 0; i < 9; i++) P.applyResult(s, 3, lose);
  assert.ok(Math.abs(P.rally(s, 3) - 0.25) < 1e-9);
  assert.strictEqual(P.rally(s, 4), 0, '只影响失败的那一关');
  P.applyResult(s, 3, { win: true, wallRatio: 1, killCopper: 0 });
  assert.strictEqual(P.rally(s, 3), 0);
  assert.strictEqual(P.rally(s, 'endless'), 0);
});

test('援军鼓舞：战斗中提高攻击和城墙', () => {
  const s = P.newSave();
  const mk = (rally) => new TD.Battle({ level: 5, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1, rally });
  const a = mk(0);
  const b = mk(0.2);
  assert.ok(Math.abs(b.wall.max / a.wall.max - 1.2) < 0.01);
  assert.ok(Math.abs(b.atk / a.atk - 1.2) < 1e-9);
});

test('推荐配装：克制武器明显没练时不硬切，失败提示去升级它', () => {
  const s = P.newSave();
  clearUpTo(s, 7);
  s.weapons.bow.lv = 8;
  s.weapons.boomerang.owned = true;
  s.weapons.boomerang.lv = 0;
  P.recommend(s, 8);
  assert.strictEqual(s.loadout.weapon, 'bow');
  assert.ok(P.weaponLagging(s, 'boomerang'));
  assert.ok(P.suggestions(s, 8).some((x) => x.label === 'advWeapon'));
  s.weapons.boomerang.lv = 7;
  P.recommend(s, 8);
  assert.strictEqual(s.loadout.weapon, 'boomerang');
});

test('失败提示：没开自动释放时建议开启；标准难度连败 3 次建议轻松', () => {
  const s = P.newSave();
  s.activeOwned.arrowRain = true;
  s.loadout.active[0] = 'arrowRain';
  s.loadout.autoCast = false;
  for (let i = 0; i < 3; i++) P.applyResult(s, 2, { win: false, wallRatio: 0, killCopper: 0 });
  const t = P.suggestions(s, 2).map((x) => x.text).join('|');
  assert.ok(t.includes('自动释放'));
  assert.ok(t.includes('轻松'));
});

test('守城日记：每个段落都有台词，说话人都存在', () => {
  for (const key of D.storyOrder) {
    const sc = D.story[key];
    assert.ok(sc && sc.lines.length >= 2, key);
    for (const [who, text] of sc.lines) {
      assert.ok(D.speakers[who] || D.monsters[who], `${key} 的说话人 ${who}`);
      assert.ok(text.length > 0);
    }
    if (key.startsWith('ch') || key.startsWith('post')) assert.ok(sc.diary, `${key} 缺日记`);
  }
  // 每章的小 Boss 和大 Boss 都有战前、战后
  for (const n of Object.keys(D.levels).map(Number)) {
    const t = D.levels[n].type;
    if ((t === 'boss' || t === 'miniboss') && !D.levels[n].abyss) assert.ok(D.story['pre' + n] && D.story['post' + n], `第 ${n} 关缺对话`);
  }
});

test('守城日记：解锁、自动播放一次、读完全部得成就', () => {
  const s = P.newSave();
  assert.ok(P.storyDue(s, 'ch1'));
  assert.ok(!P.storyUnlocked(s, 'ch2'));
  assert.ok(!P.storyDue(s, 'pre5'), '第 5 关还没开放');
  P.markStory(s, 'ch1', false);
  assert.strictEqual(s.story.ch1, 'skipped');
  assert.ok(!P.storyDue(s, 'ch1'), '跳过后不再自动播放');
  P.markStory(s, 'ch1', true);
  assert.strictEqual(s.story.ch1, 'read');
  P.markStory(s, 'ch1', false);
  assert.strictEqual(s.story.ch1, 'read', '读过的不会被跳过覆盖');
  clearUpTo(s, Math.max(...Object.keys(D.levels).map(Number)));
  for (const k of D.storyOrder) assert.ok(P.storyUnlocked(s, k), k);
  let got = [];
  for (const k of D.storyOrder) got = got.concat(P.markStory(s, k, true));
  assert.ok(got.some((a) => a.id === 'diary'));
});

test('守城日记：老存档迁移时已过去的段落记为跳过', () => {
  const s = P.newSave();
  clearUpTo(s, 12);
  delete s.story;
  P.migrate(s);
  assert.strictEqual(s.story.ch1, 'skipped');
  assert.strictEqual(s.story.post10, 'skipped');
  assert.strictEqual(s.story.ch2, 'skipped');
  assert.ok(!s.story.pre15);
  assert.ok(P.storyDue(s, 'pre15') === false, '第 15 关还没开放');
});

test('精英挑战：同时出场的两个 Boss 走不同车道', () => {
  const s = P.newSave();
  const b = new TD.Battle({ level: 49, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 3 });
  const a = b.spawnMonster('jellyPrince');
  const c = b.spawnMonster('kingScorpion');
  assert.strictEqual(a.lane, 2);
  assert.notStrictEqual(c.lane, a.lane);
  assert.ok(D.levels[49].waves.some((w) => w.groups.filter(([t]) => D.monsters[t].boss).length === 2));
});

test('角色衣柜：9 位不同的人物，用金币买，买了才能穿；额外属性只在 Kael 出战时生效', () => {
  assert.strictEqual(D.outfits.length, 10);
  assert.strictEqual(new Set(D.outfits.map((o) => o.style)).size, 10, '每位的造型（style）都不同');
  const s = P.newSave();
  assert.strictEqual(s.outfit, 'classic');
  assert.ok(!P.setOutfit(s, 'mage'), '没买不能穿');
  assert.ok(!P.buyOutfit(s, 'mage'), '没有金币买不起');
  s.gold = 20;
  const base = P.heroStats(s);
  assert.ok(P.buyOutfit(s, 'mage'));
  assert.strictEqual(s.gold, 15, '星辰法师 5 金');
  assert.strictEqual(s.outfit, 'mage', '买下直接穿上');
  assert.ok(!P.buyOutfit(s, 'mage'), '不会重复购买');
  const eq = P.equipMods(s);
  assert.ok(Math.abs(eq.magicMult - 0.12) < 1e-9 && Math.abs(eq.cdMult + 0.05) < 1e-9, '法师：魔法伤害 +12%，冷却 −5%');
  // 属性类的额外属性并入英雄属性（海盗：幸运 +4%、铜币 +12%）
  s.gold = 10;
  assert.ok(P.buyOutfit(s, 'pirate'));
  assert.ok(Math.abs(P.heroStats(s).luck - base.luck - 0.04) < 1e-9);
  assert.ok(Math.abs(P.equipMods(s).copperBonus - 0.12) < 1e-9);
  // 换回默认：没有额外属性；换成别的英雄：额外属性不生效
  assert.ok(P.setOutfit(s, 'classic'));
  assert.ok(Math.abs(P.heroStats(s).luck - base.luck) < 1e-9);
  P.setOutfit(s, 'pirate');
  clearUpTo(s, 20);
  assert.ok(P.setHero(s, 'ding'));
  assert.ok(Math.abs(P.heroStats(s).luck - P.heroStats(Object.assign(P.newSave(), { hero: 'ding' })).luck) < 1e-9, '其他英雄不吃衣柜的属性');
  // 价格逐档上涨、都是金币；每套都有完整的颜色表和属性说明
  const prices = D.outfits.filter((o) => o.cost).map((o) => o.cost.gold);
  assert.ok(prices.every((x) => x > 0) && prices.length === 9);
  assert.ok(Math.max(...prices) >= 15);
  for (const o of D.outfits) {
    for (const k of ['cape', 'body', 'helmTop', 'helmBottom', 'brim', 'plume', 'plumeHi', 'shield', 'shieldHi']) assert.ok(o.colors[k], `${o.id}.${k}`);
    assert.ok(o.id === 'classic' || (o.bonusText && (Object.keys(o.stats).length || Object.keys(o.mods).length)), `${o.id} 要有额外属性`);
  }
  // 额外属性不比一件传说装备夸张
  for (const o of D.outfits) for (const v of Object.values(Object.assign({}, o.stats, o.mods))) assert.ok(Math.abs(v) <= 0.25, o.id);
});

test('角色衣柜：旧存档穿着旧的颜色外观，迁移后改回默认；买过的角色不会丢', () => {
  const old = P.newSave();
  old.outfit = 'meadow';
  assert.strictEqual(P.migrate(old).outfit, 'classic');
  const s = P.newSave();
  s.gold = 5;
  P.buyOutfit(s, 'ranger');
  const m = P.migrate(JSON.parse(JSON.stringify(s)));
  assert.strictEqual(m.outfit, 'ranger');
  assert.ok(m.outfitsOwned.ranger);
});

test('挑战王冠：挑战难度通关得王冠（Boss 关另给 1 银），只给一次；标准难度不给', () => {
  const s = P.newSave();
  const win = { win: true, wallRatio: 1, killCopper: 0 };
  P.applyResult(s, 1, win);
  assert.ok(!s.levels[1].crown);
  s.settings.difficulty = 'hard';
  const silver0 = s.silver;
  const r = P.applyResult(s, 1, win);
  assert.ok(s.levels[1].crown);
  assert.ok(r.notes.some((x) => x.includes('王冠')));
  assert.strictEqual(s.silver, silver0, '普通关卡的王冠不给银币');
  const boss = P.newSave();
  clearUpTo(boss, 9);
  boss.settings.difficulty = 'hard';
  const b0 = boss.silver;
  const rb = P.applyResult(boss, 10, win);
  assert.ok(rb.silver >= 1 && rb.notes.some((x) => x.includes('王冠')), 'Boss 关的王冠还给 1 银');
  assert.strictEqual(b0, 0);
  const r2 = P.applyResult(s, 1, win);
  assert.ok(!r2.notes.some((x) => x.includes('王冠')));
  assert.strictEqual(P.crowns(s), 1);
  assert.strictEqual(P.crowns(s, [2, 3]), 0);
});

test('机器人战斗使用存档里的难度', () => {
  const s = P.newSave();
  s.settings.difficulty = 'hard';
  const { battle } = TD.bot.playLevel(s, 1, { seed: 1 });
  assert.ok(Math.abs(battle.diffHp - 1.3) < 1e-9);
});

test('战斗报告：统计伤害来源、被挡比例、城墙伤害来源', () => {
  const s = P.newSave();
  const b = new TD.Battle({ level: 8, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 5 });
  const g = b.spawnMonster('goblin', 0);
  b.damage(g, 100, { type: 'phys', fromFront: true, source: 'weapon' });
  b.damage(g, 50, { type: 'magic', fromFront: false, source: 'thunder' });
  const rp = b.report;
  assert.ok(rp.bySource.weapon > 0 && rp.bySource.thunder > 0);
  assert.ok(rp.real.phys < rp.raw.phys, '木盾挡掉了一部分物理伤害');
  assert.ok(Math.abs(rp.real.magic - rp.raw.magic) < 1e-9);
  b.hitWall(30, g);
  b.addWallDot(10, 5, 'poison', true, 'frog');
  for (let i = 0; i < 120; i++) b.updateWallDots(1 / 60);
  assert.ok(rp.wallBy.goblin > 0 && rp.wallBy.frog > 0);
  const res = b.runToEnd();
  assert.ok(res.report && res.report.bySource);
});

// ---------- 第六章（设计书 33） ----------
function ch6Battle(level, seed) {
  const s = P.newSave();
  return new TD.Battle({ level, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: seed || 1 });
}

test('云朵羊：先扣羊毛，剃光后加速；羊毛剪减少羊毛', () => {
  const b = ch6Battle(51);
  const m = b.spawnMonster('cloudSheep', 0);
  assert.ok(Math.abs(m.wool - m.maxHp * 0.6) < 1e-6);
  const v0 = b.monsterSpeed(m);
  b.damage(m, m.wool * 0.5, { type: 'phys', source: 'weapon' });
  assert.strictEqual(m.hp, m.maxHp, '羊毛没剃光前不掉血');
  b.damage(m, m.wool + 1, { type: 'phys', source: 'weapon' });
  assert.ok(m.sheared && m.hp < m.maxHp);
  assert.ok(Math.abs(b.monsterSpeed(m) / v0 - 2.2) < 1e-9);
  const b2 = ch6Battle(51);
  b2.mods.woolCut = 0.6;
  const m2 = b2.spawnMonster('cloudSheep', 0);
  assert.ok(Math.abs(m2.wool - m2.maxHp * 0.6 * 0.4) < 1e-6);
});

test('风筝怪：只闪避武器的物理普通攻击，顺风旗降低闪避', () => {
  const b = ch6Battle(52, 7);
  let miss = 0;
  for (let i = 0; i < 400; i++) {
    const m = b.spawnMonster('kite', 0);
    if (b.damage(m, 1, { type: 'phys', source: 'weapon' }) === 0) miss++;
    m.dead = true;
  }
  assert.ok(miss > 100 && miss < 180, `闪避约 35%：${miss}/400`);
  const m = b.spawnMonster('kite', 0);
  for (let i = 0; i < 30; i++) assert.ok(b.damage(m, 0.01, { type: 'magic', source: 'chain' }) > 0, '魔法不会被躲开');
  b.mods.dodgeCut = 0.35;
  for (let i = 0; i < 30; i++) assert.ok(b.damage(m, 0.01, { type: 'phys', source: 'weapon' }) > 0);
});

test('雷团子：城墙附近被打死电麻英雄，之后 1.5 秒内不会再被电；避雷针免疫', () => {
  const b = ch6Battle(53);
  const far = b.spawnMonster('thunderBall', 0, 900);
  b.kill(far);
  assert.strictEqual(b.heroStunUntil, 0, '远处打死不会电');
  const near = b.spawnMonster('thunderBall', 0, 300);
  b.kill(near);
  assert.ok(Math.abs(b.heroStunUntil - 0.8) < 1e-9);
  b.time = 1;
  b.kill(b.spawnMonster('thunderBall', 0, 300));
  assert.ok(Math.abs(b.heroStunUntil - 0.8) < 1e-9, '冷却中不再电麻');
  const b2 = ch6Battle(53);
  b2.mods.stunImmune = 1;
  b2.kill(b2.spawnMonster('thunderBall', 0, 300));
  assert.strictEqual(b2.heroStunUntil, 0);
});

test('呼呼：大风把怪物吹向城墙，预警期间打够伤害就打断', () => {
  const G = D.windGiant;
  const b = ch6Battle(55);
  const boss = b.spawnMonster('windGiant', 2, G.holdX);
  const sheep = b.spawnMonster('cloudSheep', 0, 1000);
  b.updateWindGiant(boss, 0.01);
  assert.strictEqual(boss.ai.mode, 'hold');
  boss.ai.gustTimer = 0.001;
  b.updateWindGiant(boss, 0.01);
  assert.strictEqual(boss.ai.mode, 'warn');
  for (let i = 0; i < 250; i++) b.updateWindGiant(boss, 0.01);
  assert.ok(Math.abs(sheep.x - (1000 - G.gustPush)) < 1e-6, '被吹近 140');
  // 打断
  boss.ai.gustTimer = 0.001;
  b.updateWindGiant(boss, 0.01);
  b.damage(boss, boss.maxHp * 0.05, { type: 'magic', source: 'thunder' });
  assert.strictEqual(boss.ai.mode, 'hold');
  assert.ok(b.interrupts >= 1);
});

test('雷雷：三个阶段——召唤、落雷蓄力可打断、暴风雨全场加速', () => {
  const T = D.thunderKing;
  const b = ch6Battle(60);
  const boss = b.spawnMonster('thunderKing', 2, T.holdX);
  for (let i = 0; i < 300; i++) b.updateThunderKing(boss, 0.01);
  assert.ok(b.monsters.some((m) => m.type === 'thunderBall'), '召唤雷团子');
  boss.hp = boss.maxHp * 0.6;
  b.updateThunderKing(boss, 0.01);
  assert.strictEqual(boss.ai.phase, 2);
  boss.ai.chargeTimer = 0.001;
  b.updateThunderKing(boss, 0.01);
  assert.strictEqual(boss.ai.mode, 'warn');
  const wall0 = b.wall.hp;
  for (let i = 0; i < 300; i++) b.updateThunderKing(boss, 0.01);
  assert.ok(b.wall.hp < wall0, '没打断：落雷打城墙');
  assert.ok(b.heroStunUntil > 0, '没打断：英雄被电麻');
  boss.ai.chargeTimer = 0.001;
  b.time = 50;
  b.updateThunderKing(boss, 0.01);
  b.damage(boss, boss.maxHp * 0.03, { type: 'magic', source: 'thunder' });
  assert.notStrictEqual(boss.ai.mode, 'warn', '打断');
  const sheep = b.spawnMonster('cloudSheep', 0, 900);
  const v0 = b.monsterSpeed(sheep);
  boss.hp = boss.maxHp * 0.2;
  boss.stunUntil = 0;
  b.updateThunderKing(boss, 0.01);
  assert.strictEqual(boss.ai.phase, 3);
  assert.ok(Math.abs(b.monsterSpeed(sheep) / v0 - 1.3) < 1e-9, '暴风雨加速');
});

test('第六章：通关第 50 关后开放，章节、关卡、补给齐全', () => {
  const s = P.newSave();
  clearUpTo(s, 50);
  assert.ok(P.isUnlocked(s, 51));
  assert.strictEqual(D.chapterOf(55).id, 6);
  for (let n = 51; n <= 60; n++) assert.ok(D.levels[n] && D.levels[n].waves.length >= 3, `第 ${n} 关`);
  for (const id of ['shears', 'lightningRod', 'windFlag']) assert.strictEqual(D.supplies[id].minLevel, 51);
});

test('无尽模式：通关第 60 关后才出现云端怪物', () => {
  const ch6 = new Set(['cloudSheep', 'kite', 'thunderBall', 'rainbowBird', 'balloon', 'thunderKing']);
  const types = (save) => {
    const set = new Set();
    for (const w of TD.modes.buildEndless(save, 7).waves) for (const [t] of w.groups) set.add(t);
    return set;
  };
  const a = P.newSave();
  clearUpTo(a, 55);
  assert.ok(![...types(a)].some((t) => ch6.has(t)));
  const b = P.newSave();
  clearUpTo(b, 60);
  assert.ok([...types(b)].some((t) => ch6.has(t)));
});

test('关卡任务：分配规则', () => {
  assert.strictEqual(D.missionFor(1), null);
  assert.strictEqual(D.missionFor(2), null);
  for (const n of [10, 50, 55, 60]) assert.strictEqual(D.missionFor(n), 'interrupt2', `第 ${n} 关`);
  assert.strictEqual(D.missionFor(20), 'noItems');
  assert.strictEqual(D.missionFor(49), 'noItems');
  const ids = new Set(Object.keys(D.levels).map((n) => D.missionFor(+n)).filter(Boolean));
  for (const id of Object.keys(D.missions)) assert.ok(ids.has(id), `任务 ${id} 至少出现一次`);
});

test('关卡任务：首次完成给 2 银，只给一次；失败不算', () => {
  const s = P.newSave();
  const n = 3;
  const id = D.missionFor(n);
  const ok = { win: true, wallRatio: 1, minWallRatio: 1, killCopper: 0, earlyCalls: 5, skillsCast: 0, itemsUsed: [], interrupts: 3 };
  assert.ok(D.missions[id].check(ok));
  P.applyResult(s, n, Object.assign({}, ok, { win: false }));
  assert.ok(!s.levels[n].mission);
  const silver0 = s.silver;
  const r = P.applyResult(s, n, ok);
  assert.ok(s.levels[n].mission);
  assert.ok(r.notes.some((x) => x.includes('关卡任务')));
  assert.ok(s.silver >= silver0 + 2);
  const r2 = P.applyResult(s, n, ok);
  assert.ok(!r2.notes.some((x) => x.includes('关卡任务')));
});

test('关卡任务：战斗统计技能释放次数和城墙最低血量', () => {
  const s = P.newSave();
  s.activeOwned.drum = true;
  s.loadout.active[0] = 'drum';
  const b = new TD.Battle({ level: 5, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  b.waveState = 'running';
  b.castSkill(0);
  assert.strictEqual(b.skillsCast, 1);
  b.hitWall(b.wall.max * 0.4, null);
  assert.ok(b.minWallRatio <= 0.61);
  b.healWall(b.wall.max);
  assert.ok(b.minWallRatio <= 0.61, '回血不影响最低值');
});

test('连击：1.2 秒内连续击败才算，记录最高连击；不影响奖励', () => {
  const s = P.newSave();
  const b = new TD.Battle({ level: 5, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  const calls = [];
  b.on('streak', (e) => calls.push(e.count));
  for (let i = 0; i < 12; i++) {
    b.time = i * 0.5;
    b.kill(b.spawnMonster('slime', 0));
  }
  assert.strictEqual(b.streak, 12);
  assert.deepStrictEqual(calls, [10]);
  b.time += 2;
  b.kill(b.spawnMonster('slime', 0));
  assert.strictEqual(b.streak, 1);
  assert.strictEqual(b.bestStreak, 12);
  const res = b.runToEnd();
  assert.ok(res.bestStreak >= 12);
  P.applyResult(s, 5, Object.assign({}, res, { bestStreak: 31 }));
  assert.ok(s.achievements.streak30);
});

test('王国小镇：每个 Boss 都有房子和 3 句台词，关卡号对得上', () => {
  const bosses = Object.keys(D.monsters).filter((t) => D.monsters[t].boss && !D.monsters[t].towerOf && !D.monsters[t].echo && !D.monsters[t].abyss);
  for (const t of bosses) assert.ok(D.town.some((f) => f.boss === t), `${t} 没有房子`);
  for (const f of D.town) {
    assert.strictEqual(f.lines.length, 3);
    assert.ok(D.levels[f.level].waves.some((w) => w.groups.some(([t]) => t === f.boss)), `${f.boss} 不在第 ${f.level} 关`);
  }
});

test('首次通关第 10 关提示解锁 3 倍速，重复通关不再提示', () => {
  const s = P.newSave();
  clearUpTo(s, 9);
  const win = { win: true, wallRatio: 1, killCopper: 0 };
  assert.ok(P.applyResult(s, 10, win).unlocks.some((x) => x.includes('3 倍速')));
  assert.ok(!P.applyResult(s, 10, win).unlocks.some((x) => x.includes('3 倍速')));
});

test('叮叮：通关第 20 关解锁；攻击 ×0.82、攻速 ×1.2；铃声每 10 次攻击眩晕周围小怪，不眩晕 Boss', () => {
  const s = P.newSave();
  assert.ok(!P.setHero(s, 'ding'));
  clearUpTo(s, 20);
  const a = P.heroStats(s);
  assert.ok(P.setHero(s, 'ding'));
  const b = P.heroStats(s);
  assert.ok(Math.abs(b.atk / a.atk - 0.82) < 1e-9);
  assert.ok(Math.abs(b.aspd / a.aspd - 1.2) < 1e-9);
  assert.ok(Math.abs(P.estimateDps(b) / P.estimateDps(a) - 0.984) < 0.01);
  const battle = new TD.Battle({ level: 21, stats: b, loadout: P.battleLoadout(s), seed: 1 });
  const target = battle.spawnMonster('slime', 0, 500);
  const near = battle.spawnMonster('slime', 0, 560);
  const far = battle.spawnMonster('slime', 0, 800);
  const boss = battle.spawnMonster('boarKing', 0, 520);
  for (let i = 0; i < 10; i++) battle.fire([target]);
  assert.ok(near.stunUntil > 0 && target.stunUntil > 0);
  assert.strictEqual(far.stunUntil, 0);
  assert.strictEqual(boss.stunUntil, 0);
});

test('版本号：config、设计书、离线缓存名一致', () => {
  const fs = require('fs');
  const path = require('path');
  const v = TD.config.version;
  const doc = fs.readFileSync(path.join(__dirname, '..', 'tower-defense-design.md'), 'utf8');
  assert.ok(doc.includes(`> 版本：${v}`), `设计书版本应为 ${v}`);
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  assert.ok(sw.includes(`'scyx-${v}'`), `sw.js 的 VERSION 应为 scyx-${v}`);
});

test('每日挑战新规则：夜战变暗夜、急袭变速攻、巨人减数量加血、抢时间提前召唤铜币 ×3', () => {
  const night = TD.modes.buildDaily({ level: 12, rule: 'night' });
  assert.ok(night.dark);
  const rush = TD.modes.buildDaily({ level: 12, rule: 'rush' });
  assert.strictEqual(rush.type, 'rush');
  assert.strictEqual(rush.rushInterval, 14);
  assert.ok(!TD.data.levels[12].dark && TD.data.levels[12].type !== 'rush', '不改动原关卡');
  const s = P.newSave();
  const mk = (rule) => new TD.Battle({ level: 12, levelDef: TD.modes.buildDaily({ level: 12, rule }), stage: 12, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  const g = mk('gold');
  g.waveState = 'waiting';
  g.waveIndex = 0;
  g.countdown = 10;
  const normal = mk('swift');
  normal.waveState = 'waiting';
  normal.waveIndex = 0;
  normal.countdown = 10;
  assert.strictEqual(g.callNextWave(), normal.callNextWave() * 3);
});

test('技能协同：碎冰（冰冻领域里雷霆加伤）、鼓点箭雨（战鼓期间箭数增加）', () => {
  const s = P.newSave();
  for (const k of ['frost', 'thunder', 'drum', 'arrowRain']) s.activeOwned[k] = true;
  s.loadout.active = ['frost', 'thunder', 'drum'];
  clearUpTo(s, 25);
  const mk = () => {
    const b = new TD.Battle({ level: 21, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
    b.waveState = 'running';
    return b;
  };
  // 碎冰
  const a = mk();
  const m1 = a.spawnMonster('snowman', 1, 600);
  m1.hp = m1.maxHp = 1e6;
  a.castSkill(1);
  const plain = 1e6 - m1.hp;
  const b = mk();
  const m2 = b.spawnMonster('snowman', 1, 600);
  m2.hp = m2.maxHp = 1e6;
  b.castSkill(0, 1);
  b.castSkill(1);
  const frozen = 1e6 - m2.hp;
  assert.ok(Math.abs(frozen / plain - D.synergies.shatter.mult) < 0.01, `碎冰倍率 ${frozen / plain}`);
  assert.strictEqual(b.combos.shatter, 1);
  // 鼓点箭雨
  s.activeOwned.arrowRain = true;
  s.loadout.active = ['drum', 'arrowRain', null];
  const c = mk();
  c.castSkill(1);
  const n0 = c.rain.left;
  const d = mk();
  d.castSkill(0);
  d.castSkill(1);
  assert.strictEqual(d.rain.left, Math.round(n0 * D.synergies.drumRain.mult));
  assert.strictEqual(d.combos.drumRain, 1);
});

test('九层妖塔：一开始就开放；第 N 层共 200N 只怪（妖王占比 10% → 50%），分 3 波；钻石 2^(N−1)', () => {
  const s = P.newSave();
  assert.ok(TD.modes.towerUnlocked(s), '新存档也能进');
  assert.strictEqual(TD.modes.towerStage(s), 1, '难度按通关进度折算，刚开始按第 1 关');
  // 还没有小镇朋友时没有妖王可用：名额换成小妖，总数不变
  const first = TD.modes.buildTower(s, 3);
  assert.ok(!first.waves.some((w) => w.groups.some(([t]) => D.monsters[t].boss)));
  assert.strictEqual(first.waves.reduce((a, w) => a + w.groups.reduce((x, [, n]) => x + n, 0), 0), 600);
  clearUpTo(s, 60);
  assert.ok(TD.modes.towerUnlocked(s));
  assert.strictEqual(TD.modes.towerStage(s), 60);
  assert.strictEqual(D.tower.floors, 9);
  assert.deepStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => TD.modes.towerReward(k)), [1, 2, 4, 8, 16, 32, 64, 128, 256]);
  for (const k of [1, 2, 5, 9]) {
    const def = TD.modes.buildTower(s, k);
    assert.strictEqual(def.waves.length, 3);
    let boss = 0;
    let minion = 0;
    for (const w of def.waves)
      for (const [t, n] of w.groups) {
        if (D.monsters[t].boss) boss += n;
        else minion += n;
      }
    const want = TD.modes.towerCounts(k);
    assert.ok(Math.abs(boss - want.boss) <= 3 && Math.abs(minion - want.minion) <= 3, `第 ${k} 层：${boss} + ${minion}`);
    assert.strictEqual(want.boss + want.minion, 200 * k);
    assert.ok(def.tower && def.floor === k && def.supplyEvery === 1);
  }
  // 妖王用妖塔版（没有特殊行动），种类循环；到第七章通关后 14 种
  const types = new Set(TD.modes.buildTower(s, 9).waves.flatMap((w) => w.groups.map(([t]) => t)).filter((t) => D.monsters[t].boss));
  assert.strictEqual(types.size, 12);
  for (const t of types) assert.ok(t.startsWith('tw_') && !D.monsters[t].ai && D.monsters[t].art);
  clearUpTo(s, 70);
  assert.strictEqual(TD.modes.towerBossList(s).length, 14);
  // 难度系数按关卡折算、再乘妖塔系数；每上一层，怪物的属性 ×grow，数量也随层数增加（设计书 77）
  assert.ok(Math.abs(TD.modes.towerD(s, 9) - TD.modes.towerD(s, 1) * 9) < 1e-9);
  assert.ok(TD.modes.towerD(s, 1) < TD.config.difficulty(70) * 0.5, '妖塔系数把单只怪物的强度压到普通关卡的一小部分');
});

test('九层妖塔：门票 1 金；过一层可以领钻石或继续（翻倍）；失败什么都没有；打怪没有收益', () => {
  const s = P.newSave();
  clearUpTo(s, 60);
  assert.ok(!TD.modes.towerCanStart(s), '没有金币');
  assert.ok(!TD.modes.towerStart(s));
  s.gold = 3;
  assert.ok(TD.modes.towerStart(s));
  assert.strictEqual(s.gold, 2, '门票 1 金');
  assert.ok(!TD.modes.towerStart(s), '一趟没结束不能再开');
  // 第 1 层通过 → 选择
  let out = TD.modes.applyTowerResult(s, { win: true, kills: 100, killCopper: 99999 });
  assert.strictEqual(out.floor, 1);
  assert.strictEqual(out.reward, 1);
  assert.strictEqual(s.copper, 0, '杀怪不给铜币');
  assert.strictEqual(s.towerRun.state, 'choose');
  assert.strictEqual(s.diamond, 0, '还没领');
  // 继续 → 第 2 层
  assert.ok(TD.modes.towerContinue(s));
  assert.strictEqual(s.towerRun.floor, 2);
  assert.strictEqual(s.towerRun.state, 'battle');
  out = TD.modes.applyTowerResult(s, { win: true, kills: 200 });
  assert.strictEqual(out.reward, 2);
  assert.ok(TD.modes.towerContinue(s));
  out = TD.modes.applyTowerResult(s, { win: true, kills: 300 });
  assert.strictEqual(out.floor, 3);
  assert.strictEqual(TD.modes.towerCashOut(s), 4, '走人：第 3 层 = 4 钻');
  assert.strictEqual(s.diamond, 4);
  assert.strictEqual(s.towerRun, null);
  assert.strictEqual(s.tower.best, 3);
  assert.strictEqual(s.tower.diamonds, 4);
  // 失败：什么都没有，连之前过的层也没有
  assert.ok(TD.modes.towerStart(s));
  TD.modes.applyTowerResult(s, { win: true });
  TD.modes.towerContinue(s);
  out = TD.modes.applyTowerResult(s, { win: false });
  assert.strictEqual(s.diamond, 4, '失败不加钻石');
  assert.strictEqual(s.towerRun, null);
  // 通关第 9 层自动领取 256
  s.gold = 1;
  TD.modes.towerStart(s);
  for (let k = 1; k <= 9; k++) {
    out = TD.modes.applyTowerResult(s, { win: true });
    if (k < 9) TD.modes.towerContinue(s);
  }
  assert.ok(out.final);
  assert.strictEqual(s.diamond, 4 + 256);
  assert.strictEqual(s.tower.best, 9);
  assert.ok(!TD.modes.towerContinue(s));
});

test('九层妖塔：战斗中途刷新页面算失败；待选择的状态刷新后还在', () => {
  const s = P.newSave();
  clearUpTo(s, 60);
  s.gold = 2;
  TD.modes.towerStart(s);
  assert.ok(TD.modes.towerRunState(s, true), '战斗进行中');
  assert.strictEqual(TD.modes.towerRunState(s, false), null, '没有战斗了（刷新）= 失败');
  assert.strictEqual(s.towerRun, null);
  TD.modes.towerStart(s);
  TD.modes.applyTowerResult(s, { win: true });
  assert.strictEqual(TD.modes.towerRunState(s, false).state, 'choose', '过了一层待选择：刷新后仍在');
  TD.modes.towerContinue(s);
  assert.strictEqual(TD.modes.towerRunState(s, false), null, '选了继续之后刷新 = 失败');
  assert.strictEqual(s.diamond || 0, 0);
});

test('九层妖塔：一层真的能打起来——大量怪物涌出，没有铜币收益、提前召唤不给铜币，打完能结算', () => {
  const s = P.newSave();
  clearUpTo(s, 70);
  const def = TD.modes.buildTower(s, 2);
  const b = new TD.Battle({ level: 'tower', levelDef: def, stage: def.stage, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 3, autoItems: true, autoSupply: true });
  b.wall.max = b.wall.hp = 1e12;
  let peak = 0;
  for (let i = 0; i < 60 * 40; i++) {
    b.step(1 / 60);
    peak = Math.max(peak, b.aliveCount());
  }
  assert.ok(peak >= 60, `大量涌现：峰值同屏 ${peak}`);
  assert.strictEqual(b.callNextWave() >= 0 ? b.earlyCopper : 0, 0, '提前召唤不给铜币');
  const bosses = b.monsters.filter((m) => m.def.towerOf);
  assert.ok(bosses.length > 0 && bosses.every((m) => m.ai === undefined), '妖王没有特殊行动');
});

test('助战伙伴：打败对应 Boss 后才能带；属性类加成生效；墨墨定时吐墨团', () => {
  const s = P.newSave();
  assert.ok(!P.setBuddy(s, 'boarKing'));
  clearUpTo(s, 50);
  assert.ok(P.setBuddy(s, 'boarKing'));
  const b1 = new TD.Battle({ level: 41, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  assert.ok(Math.abs(b1.mods.copperBonus - 0.05) < 1e-9);
  P.setBuddy(s, 'inkBoss');
  const b2 = new TD.Battle({ level: 41, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  const m = b2.spawnMonster('slime', 0, 400);
  m.hp = m.maxHp = 1e6;
  let shots = 0;
  b2.on('buddyShot', () => shots++);
  b2.waveState = 'running';
  for (let i = 0; i < 60 * 26; i++) b2.updateBuddy(1 / 60);
  assert.strictEqual(shots, 1);
  assert.ok(m.hp < 1e6);
  P.setBuddy(s, null);
  assert.strictEqual(P.battleLoadout(s).buddy, null);
});

test('统计：普通关卡、无尽、每日、九层妖塔都用同一套累计（含提前召唤）', () => {
  const s = P.newSave();
  clearUpTo(s, 60);
  const r = { kills: 5, earlyCalls: 2, interrupts: 1, supplies: ['sharp'], killsByType: { slime: 5 }, bestStreak: 7, combos: { shatter: 1 }, time: 100 };
  TD.modes.applyTowerResult(s, r);
  TD.modes.applyEndlessResult(s, Object.assign({ wavesCleared: 3 }, r));
  assert.strictEqual(s.stats.battles, 2);
  assert.strictEqual(s.stats.earlyCalls, 4);
  assert.strictEqual(s.stats.kills, 10);
  assert.strictEqual(s.stats.combos, 2);
  assert.strictEqual(s.stats.killsByType.slime, 10);
  assert.strictEqual(s.stats.wins, 0);
});

test('设计书目录列出了每一章', () => {
  const fs = require('fs');
  const path = require('path');
  const doc = fs.readFileSync(path.join(__dirname, '..', 'tower-defense-design.md'), 'utf8');
  const toc = doc.slice(doc.indexOf('## 目录'), doc.indexOf('## 0. 文档说明'));
  for (const m of doc.matchAll(/^## (\d+)\. (.+)$/gm)) assert.ok(toc.includes(`${m[1]}. ${m[2]}`), `目录缺少第 ${m[1]} 章`);
});

// ---------- 第七章 · 珊瑚海湾（设计书 52） ----------
function ch7Battle(level, seed) {
  const s = P.newSave();
  return new TD.Battle({ level, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: seed || 1 });
}

test('第七章：通关第 60 关后开放，章节、关卡、补给、故事、小镇齐全', () => {
  const s = P.newSave();
  clearUpTo(s, 60);
  assert.ok(P.isUnlocked(s, 61));
  assert.strictEqual(D.chapterOf(65).id, 7);
  for (let n = 61; n <= 70; n++) assert.ok(D.levels[n] && D.levels[n].waves.length >= 3, `第 ${n} 关`);
  for (const id of ['crowbar', 'pin', 'net']) assert.strictEqual(D.supplies[id].minLevel, 61);
  for (const k of ['ch7', 'pre65', 'post65', 'pre70', 'post70']) assert.ok(D.storyOrder.includes(k), k);
  assert.strictEqual(D.town.length, 14);
});

test('寄居蟹：每挨 4 下缩壳，壳里伤害 ×0.1 且不走路；灼烧不计数；小撬棍缩短缩壳', () => {
  const b = ch7Battle(61);
  const m = b.spawnMonster('hermitCrab', 0, 900);
  m.hp = m.maxHp = 1e6;
  for (let i = 0; i < 3; i++) b.damage(m, 10, { type: 'magic', source: 'weapon' });
  b.damage(m, 10, { type: 'magic', source: 'burn' });
  assert.strictEqual(m.shellUntil, 0, '灼烧不计数');
  b.damage(m, 10, { type: 'magic', source: 'weapon' });
  assert.ok(Math.abs(m.shellUntil - 1.2) < 1e-9, '第 4 下缩壳');
  assert.strictEqual(b.monsterSpeed(m), 0);
  const hp0 = m.hp;
  b.damage(m, 100, { type: 'magic', source: 'weapon' });
  assert.ok(Math.abs(hp0 - m.hp - 10) < 1e-6, '壳里只受 10% 伤害');
  const b2 = ch7Battle(61);
  b2.mods.shellCut = 0.6;
  const m2 = b2.spawnMonster('hermitCrab', 0, 900);
  m2.hp = m2.maxHp = 1e6;
  for (let i = 0; i < 4; i++) b2.damage(m2, 1, { type: 'magic', source: 'weapon' });
  assert.ok(Math.abs(m2.shellUntil - 1.2 * 0.4) < 1e-9);
});

test('盾龟：周围的怪受到英雄攻击 ×0.6，技能不受影响，盾龟自己不受影响', () => {
  const b = ch7Battle(62);
  const turtle = b.spawnMonster('turtle', 0, 900);
  const near = b.spawnMonster('slime', 0, 960);
  const far = b.spawnMonster('slime', 0, 1200);
  for (const m of [turtle, near, far]) m.hp = m.maxHp = 1e6;
  b.updateMonsters(0);
  const hit = (m, source) => {
    const h0 = m.hp;
    b.damage(m, 100, { type: 'magic', source });
    return h0 - m.hp;
  };
  assert.ok(Math.abs(hit(near, 'weapon') - 60) < 1e-6);
  assert.ok(Math.abs(hit(near, 'chain') - 60) < 1e-6);
  assert.ok(Math.abs(hit(near, 'thunder') - 100) < 1e-6, '技能不受影响');
  assert.ok(Math.abs(hit(far, 'weapon') - 100) < 1e-6, '离得远不受保护');
  assert.ok(Math.abs(hit(turtle, 'weapon') - 100) < 1e-6);
});

test('飞鱼：定时向前跳，空中无法被攻击；渔网缩短跳跃距离', () => {
  const b = ch7Battle(63);
  const m = b.spawnMonster('flyingFish', 0, 1000);
  m.leapTimer = 0.001;
  b.updateMonsters(1 / 60);
  assert.ok(m.leapUntil > b.time, '起跳');
  assert.ok(!b.isTargetable(m), '空中打不到');
  const x0 = m.leapFrom;
  for (let i = 0; i < 60; i++) {
    b.time += 1 / 60;
    b.updateMonsters(1 / 60);
  }
  assert.ok(b.isTargetable(m));
  assert.ok(x0 - m.x > 130, `跳了 130 以上：${x0 - m.x}`);
  const b2 = ch7Battle(63);
  b2.mods.leapCut = 0.5;
  const m2 = b2.spawnMonster('flyingFish', 0, 1000);
  m2.leapTimer = 0.001;
  b2.updateMonsters(1 / 60);
  assert.ok(Math.abs(m2.leapDist - 65) < 1e-9);
});

test('海胆：被打死时扎伤周围的怪（可以连锁），远处的不受影响', () => {
  const b = ch7Battle(64);
  const u = b.spawnMonster('urchin', 0, 800);
  const u2 = b.spawnMonster('urchin', 0, 880);
  const near = b.spawnMonster('slime', 0, 850);
  const far = b.spawnMonster('slime', 0, 1200);
  near.hp = near.maxHp = far.hp = far.maxHp = 1e6;
  u2.hp = 1;
  b.kill(u);
  assert.ok(u2.dead, '扎死了另一只海胆');
  assert.ok(Math.abs(1e6 - near.hp - 2 * 20 * b.D) < 1e-6, '两次尖刺');
  assert.strictEqual(far.hp, 1e6);
});

test('海马：停在远处给怪套泡泡；泡泡挡住一次伤害；戳戳针让一半伤害生效', () => {
  const b = ch7Battle(64);
  const sh = b.spawnMonster('seahorse', 0, 640);
  const m = b.spawnMonster('slime', 0, 600);
  m.hp = m.maxHp = 1e6;
  for (let i = 0; i < 60 * 1.1; i++) {
    b.time += 1 / 60;
    b.updateMonsters(1 / 60);
  }
  assert.ok(m.bubble, '套上泡泡');
  assert.strictEqual(sh.x, 640, '海马停在 640');
  assert.strictEqual(b.damage(m, 500, { type: 'magic', source: 'weapon' }), 0);
  assert.ok(!m.bubble && b.bubblesPopped === 1);
  assert.ok(b.damage(m, 500, { type: 'magic', source: 'weapon' }) > 0);
  m.bubble = true;
  b.mods.pinPop = 0.5;
  assert.ok(Math.abs(b.damage(m, 500, { type: 'magic', source: 'weapon' }) - 250) < 1e-6);
});

test('贝贝：合壳 ×0.1 并召唤寄居蟹，张壳 ×1.3 并吐珍珠；残血后开合更快', () => {
  const B = D.pearlClam;
  const b = ch7Battle(65);
  const boss = b.spawnMonster('pearlClam', 2, B.holdX);
  b.updatePearlClam(boss, 0.01);
  assert.strictEqual(boss.ai.mode, 'hold');
  assert.ok(!boss.ai.open);
  assert.strictEqual(b.monsters.filter((m) => m.type === 'hermitCrab').length, B.crabCount);
  let h0 = boss.hp;
  b.damage(boss, 1000, { type: 'magic', source: 'thunder' });
  assert.ok(Math.abs(h0 - boss.hp - 100) < 1e-6, '合壳 ×0.1');
  for (let i = 0; i < B.closedTime * 100 + 1; i++) b.updatePearlClam(boss, 0.01);
  assert.ok(boss.ai.open, '张壳');
  h0 = boss.hp;
  b.damage(boss, 1000, { type: 'magic', source: 'thunder' });
  assert.ok(Math.abs(h0 - boss.hp - 1300) < 1e-6, '张壳 ×1.3');
  const w0 = b.wall.hp;
  for (let i = 0; i < 100; i++) b.updatePearlClam(boss, 0.01);
  assert.ok(b.wall.hp < w0, '吐珍珠');
  boss.hp = boss.maxHp * 0.3;
  b.updatePearlClam(boss, 0.01);
  assert.strictEqual(boss.ai.phase, 2);
});

test('波波：在其余车道伸出触手；2 条以上触手护身；吸盘回血；触手会长回来；打败后触手缩回', () => {
  const O = D.octoKing;
  const b = ch7Battle(70);
  const boss = b.spawnMonster('octoKing', 2, O.holdX);
  b.updateOctoKing(boss, 0.01);
  const tents = b.monsters.filter((m) => m.type === 'tentacle');
  assert.strictEqual(tents.length, 4);
  assert.ok(!tents.some((t) => t.lane === boss.lane), '触手不在 Boss 的车道');
  assert.ok(boss.ai.guarded);
  let h0 = boss.hp;
  b.damage(boss, 1000, { type: 'magic', source: 'thunder' });
  assert.ok(Math.abs(h0 - boss.hp - 1000 * O.guardMult) < 1e-6, '护身减伤');
  for (const t of tents.slice(0, 3)) b.kill(t);
  b.updateOctoKing(boss, 0.01);
  assert.ok(!boss.ai.guarded, '只剩 1 条触手：护身消失');
  h0 = boss.hp;
  b.damage(boss, 1000, { type: 'magic', source: 'thunder' });
  assert.ok(Math.abs(h0 - boss.hp - 1000) < 1e-6);
  b.time += O.regrow + 0.1;
  b.updateOctoKing(boss, 0.01);
  assert.strictEqual(b.monsters.filter((m) => m.type === 'tentacle' && !m.dead).length, 4, '触手长回来');
  boss.hp = boss.maxHp * 0.5;
  b.updateOctoKing(boss, 0.01);
  assert.strictEqual(boss.ai.phase, 2);
  h0 = boss.hp;
  b.updateOctoKing(boss, 1);
  assert.ok(boss.hp > h0, '吸盘回血');
  boss.hp = boss.maxHp * 0.2;
  b.updateOctoKing(boss, 0.01);
  assert.strictEqual(boss.ai.phase, 3);
  assert.ok(b.whirl);
  b.kill(boss);
  assert.ok(!b.whirl);
  assert.ok(b.monsters.filter((m) => m.type === 'tentacle').every((m) => m.dead), '触手缩回');
});

test('助战伙伴贝贝：每波开始给城墙一个泡泡护盾', () => {
  const s = P.newSave();
  clearUpTo(s, 70);
  assert.ok(P.setBuddy(s, 'pearlClam'));
  const b = new TD.Battle({ level: 61, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  b.startWave(0);
  assert.ok(Math.abs(b.wallShield - b.wall.max * 0.03) < 1e-6);
  const hp0 = b.wall.hp;
  b.hitWall(b.wall.max * 0.02, null);
  assert.strictEqual(b.wall.hp, hp0, '护盾吸收');
  b.hitWall(b.wall.max * 0.02, null);
  assert.ok(b.wall.hp < hp0 && b.wall.hp > hp0 - b.wall.max * 0.02);
});

test('无尽 / 每日：通关第 70 关后才出现海湾怪物', () => {
  const sea = new Set(['hermitCrab', 'turtle', 'flyingFish', 'urchin', 'seahorse', 'pearlClam', 'octoKing']);
  const types = (save) => {
    const set = new Set();
    for (let seed = 1; seed <= 5; seed++) for (const w of TD.modes.buildEndless(save, seed).waves) for (const [t] of w.groups) set.add(t);
    return set;
  };
  const a = P.newSave();
  clearUpTo(a, 65);
  assert.ok(![...types(a)].some((t) => sea.has(t)));
  assert.strictEqual(TD.modes.poolLast(a), 60);
  const b = P.newSave();
  clearUpTo(b, 70);
  assert.ok([...types(b)].some((t) => sea.has(t)));
  assert.strictEqual(TD.modes.poolLast(b), 70);
});

// ---------- 满级专精（设计书 53） ----------
test('满级专精：只有木弓、火炮、魔法杖有；武器 Lv10 才解锁', () => {
  const s = P.newSave();
  s.weapons.cannon.owned = true;
  s.weapons.cannon.lv = 9;
  assert.ok(!P.hasMastery(s, 'cannon'));
  s.weapons.cannon.lv = 10;
  assert.ok(P.hasMastery(s, 'cannon'));
  assert.ok(P.weaponDef(s, 'cannon').knock && P.weaponDef(s, 'cannon').bossMult === 1.5);
  s.weapons.staff.owned = true;
  s.weapons.staff.lv = 10;
  s.weapons.staff.asc = true;
  const st = P.weaponDef(s, 'staff');
  assert.strictEqual(st.splash.radius, 105, '进阶 85 + 专精 20');
  assert.strictEqual(st.splash.mult, 1);
  for (const id of ['crossbow', 'orb', 'boomerang']) assert.ok(!D.weapons[id].mastery, id);
});

test('穿云箭：命中后再打同一车道后方最多 2 只怪', () => {
  const s = P.newSave();
  s.weapons.bow.lv = 10;
  const b = new TD.Battle({ level: 41, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  const a = b.spawnMonster('slime', 0, 500);
  const c = b.spawnMonster('slime', 0, 560);
  const d = b.spawnMonster('slime', 0, 600);
  const e = b.spawnMonster('slime', 0, 640);
  const other = b.spawnMonster('slime', 1, 560);
  for (const m of [a, c, d, e, other]) m.hp = m.maxHp = 1e6;
  b.pierceFrom(a, { dmg: 100, crit: false, pierce: b.stats.weaponDef.pierce, dmgType: 'phys' });
  assert.ok(c.hp < 1e6 && d.hp < 1e6, '后面两只被穿透');
  assert.strictEqual(e.hp, 1e6, '最多 2 只');
  assert.strictEqual(other.hp, 1e6, '别的车道不受影响');
});

test('震地炮：把小怪震退并减速，Boss 不动', () => {
  const s = P.newSave();
  const b = new TD.Battle({ level: 41, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  const m = b.spawnMonster('slime', 0, 500);
  const boss = b.spawnMonster('boarKing', 0, 520);
  b.knockAt(500, m.y + m.yOffset, { knock: { dist: 60, slow: 0.4, duration: 1.5 }, splash: { radius: 80 } }, m);
  assert.strictEqual(m.x, 560);
  assert.ok(Math.abs(m.slowAmt - 0.4) < 1e-9);
  assert.strictEqual(boss.x, 520);
});

// ---------- 装备扩充（设计书 58） ----------
test('装备扩充：每件栏位合法；套装部件存在且属于该套装', () => {
  assert.strictEqual(Object.keys(D.equipment).length, 180);
  for (const id of Object.keys(D.equipment)) assert.ok(D.equipSlots[D.equipment[id].slot], id);
  for (const k of Object.keys(D.gearSets)) for (const id of D.gearSets[k].parts) assert.strictEqual(D.equipment[id].set, k, id);
});

test('装备随时可买（只看钱）；箭袋栏位一开始就有；minLevel 只是推荐关卡', () => {
  const s = P.newSave();
  s.copper = 10000;
  assert.strictEqual(P.slotCount(s, 'quiver'), 1);
  assert.ok(P.recommended(s, D.equipment.leatherQuiver), '第 15 关前商店里提示推荐关卡');
  assert.ok(P.buyEquip(s, 'leatherQuiver'), '没通关也能买');
  assert.strictEqual(s.loadout.equip.quiver, 'leatherQuiver', '自动穿上');
  const base = P.heroStats(P.newSave()).critDmg;
  assert.ok(Math.abs(P.heroStats(s).critDmg - base - 0.15) < 1e-9);
  const poor = P.newSave();
  poor.copper = 10;
  assert.ok(!P.buyEquip(poor, 'windCape'), '钱不够照样买不起');
  clearUpTo(s, 15);
  assert.ok(!P.recommended(s, D.equipment.leatherQuiver), '到了推荐关卡后提示消失');
  // 老存档迁移后有箭袋栏位
  const old = P.newSave();
  delete old.loadout.equip.quiver;
  assert.strictEqual(P.migrate(old).loadout.equip.quiver, null);
});

function gearBattle(ids, level) {
  const s = P.newSave();
  clearUpTo(s, 69);
  for (const id of ids) {
    s.equipOwned[id] = true;
    const slot = D.equipment[id].slot;
    const key = slot === 'trinket' ? (s.loadout.equip.trinket1 ? 'trinket2' : 'trinket1') : slot;
    s.loadout.equip[key] = id;
  }
  return new TD.Battle({ level: level || 41, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
}

test('屠龙盔对 Boss +20%，疾风披风对飞行怪 +15%，普通怪不变', () => {
  const b0 = gearBattle([]);
  const b1 = gearBattle(['dragonHelm', 'windCape']);
  const opts = { type: 'magic', source: 'weapon' };
  const boss = b1.spawnMonster('boarKing', 0, 600);
  const bee = b1.spawnMonster('bee', 0, 600);
  const slime = b1.spawnMonster('slime', 0, 600);
  assert.ok(Math.abs(b1.damageMult(boss, opts) - 1.2) < 1e-9);
  assert.ok(Math.abs(b1.damageMult(bee, opts) - 1.15) < 1e-9);
  assert.strictEqual(b1.damageMult(slime, opts), 1);
  assert.strictEqual(b0.damageMult(b0.spawnMonster('boarKing', 0, 600), opts), 1);
  assert.strictEqual(b1.damageMult(boss, { type: 'phys', source: 'thorns' }), 1, '荆棘不吃加成');
});

test('夜枭盔：暗夜射程惩罚减半', () => {
  const plain = gearBattle([], 23);
  const owl = gearBattle(['owlHelm'], 23);
  const full = plain.stats.range;
  assert.ok(Math.abs(plain.range - full * 0.7) < 1e-6);
  assert.ok(Math.abs(owl.range - owl.stats.range * 0.85) < 1e-6);
});

test('寒霜套装：凑齐后对减速的怪 +15%；寒铁盔让冰冻瓶多冻 30%', () => {
  const s = P.newSave();
  clearUpTo(s, 40);
  s.equipOwned.frostHelm = s.equipOwned.frostQuiver = true;
  s.loadout.equip.helm = 'frostHelm';
  assert.deepStrictEqual(P.activeSets(s), []);
  s.loadout.equip.quiver = 'frostQuiver';
  assert.deepStrictEqual(P.activeSets(s), ['frost']);
  const b = gearBattle(['frostHelm', 'frostQuiver']);
  const m = b.spawnMonster('slime', 0, 600);
  assert.strictEqual(b.damageMult(m, { source: 'weapon' }), 1);
  m.slowUntil = b.time + 1;
  assert.ok(Math.abs(b.damageMult(m, { source: 'weapon' }) - 1.15) < 1e-9);
  b.waveState = 'spawning';
  b.items = [{ id: 'freeze', def: D.items.freeze, left: 1, cd: 0 }];
  b.useItem(0, 0);
  assert.ok(Math.abs(m.frozenUntil - b.time - D.items.freeze.duration * 1.3) < 1e-9);
});

test('雷鸣箭袋：每第 6 次攻击落一道小闪电（魔法伤害，算进战斗报告）', () => {
  const b = gearBattle(['thunderQuiver']);
  const m = b.spawnMonster('slime', 0, 400);
  m.hp = m.maxHp = 1e7;
  let zaps = 0;
  b.on('gearZap', () => zaps++);
  for (let i = 0; i < 12; i++) b.fire([m]);
  assert.strictEqual(zaps, 2);
  assert.ok(b.report.bySource.zap > 0);
});

test('潮汐套装：每波开始城墙有 4% 护盾；贝壳护符让回血 +25%', () => {
  const b = gearBattle(['tideCape', 'shellCharm']);
  b.startWave(0);
  assert.ok(Math.abs(b.wallShield - b.wall.max * 0.04) < 1e-6);
  b.wall.hp = b.wall.max / 2;
  b.healWall(100, 'test');
  assert.ok(Math.abs(b.wall.hp - (b.wall.max / 2 + 125)) < 1e-6);
});

test('背水徽章：城墙低于一半时攻击力 +20%', () => {
  const b = gearBattle(['rageBadge']);
  const a0 = b.atk;
  b.wall.hp = b.wall.max * 0.4;
  assert.ok(Math.abs(b.atk / a0 - 1.2) < 1e-9);
});

test('自动配装：Boss 关挑屠龙盔、暗夜关挑夜枭盔', () => {
  const s = P.newSave();
  clearUpTo(s, 69);
  s.attrs.atk = 25; // 中期的攻击力，铁皮盔 +3 不再显得很大
  for (const id of ['ironHelm', 'dragonHelm', 'owlHelm']) s.equipOwned[id] = true;
  P.recommend(s, 30);
  assert.strictEqual(s.loadout.equip.helm, 'dragonHelm');
  P.recommend(s, 23);
  assert.strictEqual(s.loadout.equip.helm, 'owlHelm');
});

// ---------- 英雄扩充（设计书 59） ----------
test('五位英雄：按关卡加入，都有名字、定位和说明', () => {
  const C = TD.config;
  assert.deepStrictEqual(Object.keys(C.heroes), ['dang', 'ding', 'yan', 'ying', 'mu']);
  for (const id of Object.keys(C.heroes)) assert.ok(C.heroes[id].name && C.heroes[id].role && C.heroes[id].desc, id);
  const s = P.newSave();
  clearUpTo(s, 9);
  assert.ok(!P.setHero(s, 'yan'));
  clearUpTo(s, 10);
  assert.ok(P.setHero(s, 'yan'));
  assert.strictEqual(P.heroId(s), 'yan');
  assert.ok(!P.heroUnlocked(s, 'ying') && !P.heroUnlocked(s, 'mu'));
  for (const id of ['yan', 'ying', 'mu']) assert.ok(D.speakers[id] && D.speakers[id].hero === id, '剧情里能说话');
});

function heroBattle(id, level) {
  const s = P.newSave();
  clearUpTo(s, 69);
  P.setHero(s, id);
  return new TD.Battle({ level: level || 41, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
}

test('阿岩：城墙减伤 12%、每波多修 3%', () => {
  const b = heroBattle('yan');
  assert.ok(Math.abs(b.mods.wallDr - 0.12) < 1e-9);
  b.waveIndex = 0;
  b.wall.hp = b.wall.max / 2;
  b.endWaveHeal();
  assert.ok(Math.abs(b.wall.hp - b.wall.max * 0.53) < 1e-6);
});

test('萤萤：暗夜射程不减；每第 12 次攻击放出 3 只萤火虫（魔法，不触发命中效果）', () => {
  const dark = heroBattle('ying', 23);
  assert.ok(Math.abs(dark.range - dark.stats.range) < 1e-6);
  const b = heroBattle('ying');
  const m = b.spawnMonster('slime', 0, 400);
  m.hp = m.maxHp = 1e7;
  for (let i = 0; i < 12; i++) b.fire([m]);
  const flies = b.projectiles.filter((p) => p.kind === 'firefly');
  assert.strictEqual(flies.length, 3);
  assert.ok(flies.every((p) => p.dmgType === 'magic' && Math.abs(p.dmg - b.atk * 0.6) < 1e-9));
  for (let i = 0; i < 120; i++) b.updateProjectiles(1 / 60);
  assert.ok(b.report.bySource.firefly > 0);
});

test('阿木：重箭把普通怪推后 12 像素，Boss 不动；无视 25% 护甲', () => {
  const b = heroBattle('mu');
  const m = b.spawnMonster('slime', 0, 500);
  const boss = b.spawnMonster('boarKing', 0, 500);
  m.hp = m.maxHp = boss.hp = boss.maxHp = 1e7;
  b.applyWeaponHit(m, 10, false, true, null);
  b.applyWeaponHit(boss, 10, false, true, null);
  assert.strictEqual(m.x, 512);
  assert.strictEqual(boss.x, 500);
  assert.ok(Math.abs(b.mods.armorIgnore - 0.25) < 1e-9);
});

// ---------- 改名、钻石、出售装备（设计书 61） ----------
test('英雄显示名：Kael / Lyra / Atlas / Nova / Rowan，id 不变', () => {
  const C = TD.config;
  assert.deepStrictEqual(Object.keys(C.heroes).map((k) => C.heroes[k].name), ['Kael', 'Lyra', 'Atlas', 'Nova', 'Rowan']);
  assert.deepStrictEqual(Object.keys(C.heroes), ['dang', 'ding', 'yan', 'ying', 'mu']);
  assert.strictEqual(D.speakers.dang.name, 'Kael');
});

test('兑换所：100 铜 = 1 银，100 银 = 1 金；钻石暂时无法获得', () => {
  const s = P.newSave();
  s.silver = 99;
  assert.ok(!P.exchange(s, 'silver', 1), '99 银不够');
  s.silver = 100;
  assert.ok(P.exchange(s, 'silver', 1));
  assert.strictEqual(s.silver, 0);
  assert.strictEqual(s.gold, 1);
  assert.strictEqual(s.diamond, 0);
  assert.ok(!P.exchange(s, 'gold', 1), '金不能换钻石');
  assert.strictEqual(TD.config.exchange.diamondObtainable, true, '钻石只能在九层妖塔里获得');
  const old = P.newSave();
  delete old.diamond;
  assert.strictEqual(P.migrate(old).diamond, 0, '老存档补上钻石');
  assert.ok(!P.canAfford(s, { diamond: 1 }));
  assert.strictEqual(P.costText({ diamond: 2 }), '2 钻');
});

test('出售装备：卖价是买价的一半，零头折成下一级货币', () => {
  assert.deepStrictEqual(P.halfCost({ copper: 150 }), { copper: 75 });
  assert.deepStrictEqual(P.halfCost({ copper: 120 }), { copper: 60 });
  assert.deepStrictEqual(P.halfCost({ silver: 7 }), { silver: 3, copper: 50 });
  assert.deepStrictEqual(P.halfCost({ silver: 6 }), { silver: 3 });
  assert.deepStrictEqual(P.halfCost({ gold: 3 }), { gold: 1, silver: 50 });
  assert.deepStrictEqual(P.halfCost({ gold: 4 }), { gold: 2 });
});

test('出售装备：自动卸下、退钱、可以原价买回；不能卖没有的', () => {
  const s = P.newSave();
  clearUpTo(s, 20);
  const price = D.equipment.ironHelm.cost.copper;
  s.copper = price * 2;
  assert.ok(P.buyEquip(s, 'ironHelm'));
  assert.strictEqual(s.loadout.equip.helm, 'ironHelm');
  assert.strictEqual(s.copper, price);
  assert.deepStrictEqual(P.sellEquip(s, 'ironHelm'), { copper: price / 2 });
  assert.strictEqual(s.copper, price * 1.5);
  assert.strictEqual(s.loadout.equip.helm, null);
  assert.ok(!s.equipOwned.ironHelm);
  assert.strictEqual(P.sellEquip(s, 'ironHelm'), null);
  assert.ok(P.buyEquip(s, 'ironHelm'), '可以买回');
  assert.strictEqual(s.copper, price * 0.5);
});

test('饰品栏 3 个，且同一件饰品不能重复佩戴；头盔披风箭袋各 1', () => {
  const s = P.newSave();
  clearUpTo(s, 40);
  for (const id of ['clover', 'fang', 'eagleEye', 'coinCharm']) s.equipOwned[id] = true;
  assert.ok(P.setEquip(s, 'trinket1', 'clover'));
  assert.ok(P.setEquip(s, 'trinket2', 'fang'));
  assert.ok(P.setEquip(s, 'trinket3', 'eagleEye'));
  assert.ok(!P.setEquip(s, 'trinket4', 'coinCharm'));
  assert.deepStrictEqual(P.wornEquip(s).sort(), ['clover', 'eagleEye', 'fang']);
  P.setEquip(s, 'trinket3', 'clover');
  assert.strictEqual(s.loadout.equip.trinket1, null, '同一件饰品只能戴一个栏位');
  assert.ok(!P.setEquip(s, 'helm', 'clover'), '饰品不能放进头盔栏');
  assert.deepStrictEqual(P.migrate(Object.assign(P.newSave(), { loadout: Object.assign(P.newSave().loadout, { equip: { helm: null, cape: null, quiver: null, trinket1: null, trinket2: null } }) })).loadout.equip.trinket3, null);
});

// ---------- 消耗品扩充（设计书 62） ----------
function itemBattle(id, level) {
  const s = P.newSave();
  clearUpTo(s, 69);
  s.inventory = { [id]: 1 };
  P.equipItem(s, 0, id, 1);
  const b = new TD.Battle({ level: level || 41, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 3 });
  b.waveState = 'spawning';
  return b;
}
const bigHp = (m) => ((m.hp = m.maxHp = 1e9), m);

test('消耗品：共 45 种（铜 / 银 / 金每档 15 种，银档含被动幸运符），价格按铜 → 银 → 金分档', () => {
  const ids = Object.keys(D.items);
  assert.strictEqual(ids.length, 45);
  const tier = (it) => (it.cost.gold || it.cost.diamond ? 3 : it.cost.silver ? 2 : 1);
  const by = { 1: [], 2: [], 3: [] };
  for (const id of ids) by[tier(D.items[id])].push(id);
  assert.deepStrictEqual([by[1].length, by[2].length, by[3].length], [15, 15, 15]);
  for (const id of ['firebomb', 'bomb', 'patch', 'haste', 'freeze']) assert.strictEqual(tier(D.items[id]), 1, id);
  for (const id of ['thunderScroll', 'bigBomb', 'barrier', 'warBanner', 'quake']) assert.strictEqual(tier(D.items[id]), 2, id);
  for (const id of ['blizzard', 'flood', 'holyLight', 'meteor', 'chrono']) assert.strictEqual(tier(D.items[id]), 3, id);
  assert.ok(D.items.chrono.cost.gold > D.items.blizzard.cost.gold, '时间静止比暴风雪更贵');
  assert.ok(D.items.quake.cost.silver > D.items.thunderScroll.cost.silver);
  // 每个道具都有冷却（被动的幸运符除外）、名字和说明，名字不重复
  for (const id of ids) {
    assert.ok(D.items[id].name && D.items[id].desc, id);
    if (!D.items[id].passive) assert.ok(D.items[id].cd > 0, id + ' 没有冷却');
  }
  assert.strictEqual(new Set(ids.map((id) => D.items[id].name)).size, 45, '名字不重复');
});

test('新增 29 个道具：每个都能用出去、有效果、进冷却、少一个；需要选车道的会打在选定的车道上', () => {
  const NEW = ['spikeTrap', 'smokeBomb', 'bandage', 'whetstone', 'luckyCoin', 'ropeNet', 'firecracker', 'oilFlask', 'woodShield', 'farsightPotion', 'chainScroll', 'poisonFlask', 'mirrorShield', 'vampDraught', 'earthSpike', 'glueTrap', 'rageDraught', 'thunderStorm', 'steelArrows', 'dragonBreath', 'blackHole', 'sanctuary', 'phoenixFeather', 'stormCall', 'timeLoop', 'godWrath', 'goldenArrow', 'plague', 'shadowLegion'];
  assert.strictEqual(NEW.length, 29);
  for (const id of NEW) {
    const b = itemBattle(id);
    const ms = [bigHp(b.spawnMonster('slime', 1, 500)), bigHp(b.spawnMonster('slime', 1, 640)), bigHp(b.spawnMonster('slime', 2, 560))];
    b.wall.hp = b.wall.max * 0.5;
    const hp0 = ms.map((m) => m.hp);
    const left0 = b.items[0].left;
    assert.ok(b.useItem(0, 1), id + ' 用不出去');
    assert.strictEqual(b.items[0].left, left0 - 1, id + ' 没有少一个');
    assert.ok(b.items[0].cd > 0, id + ' 没进冷却');
    for (let i = 0; i < 400; i++) b.step(0.05); // 让延时 / 持续的效果走完，不应该报错
  }
});

test('新道具的具体效果（铜档）', () => {
  const step = (b, sec) => {
    for (let i = 0; i < sec * 20; i++) b.step(0.05);
  };
  // 尖刺陷阱：选定车道受伤并减速，别的车道不受影响
  let b = itemBattle('spikeTrap');
  let a1 = bigHp(b.spawnMonster('slime', 1, 600));
  let a2 = bigHp(b.spawnMonster('slime', 2, 600));
  b.heroStunUntil = Infinity;
  b.useItem(0, 1);
  assert.ok(a1.hp < 1e9 && a1.slowAmt >= D.items.spikeTrap.slow - 1e-9 && a2.hp === 1e9);
  // 烟雾弹：全场减速
  b = itemBattle('smokeBomb');
  a1 = bigHp(b.spawnMonster('slime', 1, 600));
  a2 = bigHp(b.spawnMonster('slime', 3, 700));
  b.useItem(0);
  assert.ok(a1.slowAmt >= 0.35 - 1e-9 && a2.slowAmt >= 0.35 - 1e-9);
  // 绷带：6 秒内逐渐回血，共 12%
  b = itemBattle('bandage');
  b.heroStunUntil = Infinity;
  b.wall.hp = b.wall.max * 0.5;
  b.useItem(0);
  step(b, 1);
  assert.ok(b.wall.hp > b.wall.max * 0.5 && b.wall.hp < b.wall.max * 0.62, '才过 1 秒，还没回完');
  step(b, 7);
  assert.ok(Math.abs(b.wall.hp - b.wall.max * 0.62) < b.wall.max * 0.002, `共回 12%：${b.wall.hp / b.wall.max}`);
  // 磨刀石：暴击率 +25%，到时间失效
  b = itemBattle('whetstone');
  const c0 = b.rollHitCritRate ? 0 : 0;
  b.useItem(0);
  assert.ok(b.buffs.some((x) => x.crit === 0.25 && x.until > b.time));
  // 幸运铜币：击败的怪掉 2 倍铜币，过期恢复
  b = itemBattle('luckyCoin');
  b.heroStunUntil = Infinity;
  a1 = b.spawnMonster('slime', 1, 600);
  const cu = a1.def.copper;
  const k0 = b.killCopper;
  b.useItem(0);
  b.kill(a1);
  assert.strictEqual(b.killCopper - k0, cu * 2);
  b.time += 16;
  const a3 = b.spawnMonster('slime', 1, 600);
  const k1 = b.killCopper;
  b.kill(a3);
  assert.strictEqual(b.killCopper - k1, cu);
  // 绳网：选定车道眩晕，Boss 只晕 0.8 秒
  b = itemBattle('ropeNet');
  a1 = bigHp(b.spawnMonster('slime', 1, 600));
  const boss = bigHp(b.spawnMonster('boarKing', 1, 700));
  a2 = bigHp(b.spawnMonster('slime', 2, 600));
  b.useItem(0, 1);
  assert.ok(Math.abs(a1.stunUntil - b.time - 2) < 1e-9 && Math.abs(boss.stunUntil - b.time - 0.8) < 1e-9 && a2.stunUntil <= b.time);
  // 鞭炮：随机 8 只受伤并眩晕（怪不足 8 只就全打）
  b = itemBattle('firecracker');
  b.heroStunUntil = Infinity;
  const crackers = Array.from({ length: 10 }, (_, i) => bigHp(b.spawnMonster('slime', i % 4, 500 + i * 30)));
  b.useItem(0);
  assert.strictEqual(crackers.filter((m) => m.hp < 1e9).length, 8);
  assert.ok(crackers.filter((m) => m.hp < 1e9).every((m) => m.stunUntil > b.time));
  // 油罐：减速 + 受到的伤害 +30%
  b = itemBattle('oilFlask');
  a1 = bigHp(b.spawnMonster('slime', 1, 600));
  b.useItem(0, 1);
  assert.ok(a1.slowAmt >= 0.5 - 1e-9);
  const plain = bigHp(b.spawnMonster('slime', 2, 600));
  assert.ok(Math.abs(b.damageMult(a1, { source: 'weapon' }) / b.damageMult(plain, { source: 'weapon' }) - 1.3) < 1e-9);
  // 木盾：护盾吸收 12% 最大血量
  b = itemBattle('woodShield');
  b.useItem(0);
  assert.ok(Math.abs(b.itemShield - b.wall.max * 0.12) < 1e-9);
  // 远望药水：射程 +25%，到时间恢复
  b = itemBattle('farsightPotion');
  const r0 = b.range;
  b.useItem(0);
  assert.ok(Math.abs(b.range / r0 - 1.25) < 1e-9);
  step(b, 16);
  assert.ok(Math.abs(b.range - r0) < 1e-9, '射程恢复');
});

test('新道具的具体效果（银档）', () => {
  const step = (b, sec) => {
    for (let i = 0; i < sec * 20; i++) b.step(0.05);
  };
  // 连锁闪电符：劈血量最高的怪，再连锁跳（最多 8 次）
  let b = itemBattle('chainScroll');
  b.heroStunUntil = Infinity;
  const ms = Array.from({ length: 10 }, (_, i) => bigHp(b.spawnMonster('slime', i % 4, 500 + i * 40)));
  ms[3].hp = ms[3].maxHp = 2e9; // 血最多
  b.useItem(0);
  const hit = ms.filter((m) => m.hp < m.maxHp);
  assert.strictEqual(hit.length, 9, `先劈 1 只 + 连锁 8 只：${hit.length}`);
  assert.ok(ms[3].hp < ms[3].maxHp);
  // 毒瓶：选定车道中毒，持续掉血共 ATK×6；别的车道没事
  b = itemBattle('poisonFlask');
  b.heroStunUntil = Infinity;
  let a1 = bigHp(b.spawnMonster('slime', 1, 700));
  let a2 = bigHp(b.spawnMonster('slime', 2, 700));
  b.useItem(0, 1);
  step(b, 7);
  const dealt = 1e9 - a1.hp;
  assert.ok(Math.abs(dealt / (b.atk * 6) - 1) < 0.15, `毒伤约 ATK×6：${dealt / b.atk}`);
  assert.strictEqual(a2.hp, 1e9);
  // 反射盾：怪打城墙时被反弹
  b = itemBattle('mirrorShield');
  b.heroStunUntil = Infinity;
  a1 = bigHp(b.spawnMonster('slime', 1, 150));
  b.useItem(0);
  step(b, 3);
  assert.ok(a1.hp < 1e9, '被反弹了');
  // 吸血药剂：12 秒内每击败一只怪，回复 1.2% 城墙血量
  b = itemBattle('vampDraught');
  b.heroStunUntil = Infinity;
  b.wall.hp = b.wall.max * 0.5;
  b.useItem(0);
  a1 = b.spawnMonster('slime', 1, 900);
  b.kill(a1);
  assert.ok(Math.abs(b.wall.hp - b.wall.max * 0.512) < 1e-6);
  step(b, 13);
  const hp1 = b.wall.hp;
  b.kill(b.spawnMonster('slime', 1, 900));
  assert.ok(Math.abs(b.wall.hp - hp1) < 1e-6, '到时间不再回血');
  // 地刺符：离城墙近的怪受伤并眩晕，远处的不受影响
  b = itemBattle('earthSpike');
  b.heroStunUntil = Infinity;
  const near = bigHp(b.spawnMonster('slime', 1, 300));
  const far = bigHp(b.spawnMonster('slime', 1, 1000));
  b.useItem(0);
  assert.ok(near.hp < 1e9 && near.stunUntil > b.time && far.hp === 1e9);
  // 粘胶：全场减速 60%，Boss 只减 30%
  b = itemBattle('glueTrap');
  a1 = bigHp(b.spawnMonster('slime', 1, 600));
  const boss = bigHp(b.spawnMonster('boarKing', 2, 700));
  b.useItem(0);
  assert.ok(Math.abs(a1.slowAmt - 0.6) < 1e-9 && Math.abs(boss.slowAmt - 0.3) < 1e-9);
  // 狂暴药水：攻击力 +40%、攻速 +30%
  b = itemBattle('rageDraught');
  const atk0 = b.atk;
  const as0 = b.currentAspd();
  b.useItem(0);
  assert.ok(Math.abs(b.atk / atk0 - 1.4) < 1e-9 && b.currentAspd() > as0 * 1.25);
  // 雷暴符：8 道落雷
  b = itemBattle('thunderStorm');
  b.heroStunUntil = Infinity;
  bigHp(b.spawnMonster('slime', 1, 600));
  let bolts = 0;
  const old = b.emit.bind(b);
  b.emit = (t, e) => (t === 'stormBolt' && bolts++, old(t, e));
  b.useItem(0);
  step(b, 5);
  assert.strictEqual(bolts, 8);
  // 钢箭：无视护甲 +40%，到时间恢复
  b = itemBattle('steelArrows');
  const ai0 = b.mods.armorIgnore;
  b.useItem(0);
  assert.ok(Math.abs(b.mods.armorIgnore - ai0 - 0.4) < 1e-9);
  step(b, 13);
  assert.ok(Math.abs(b.mods.armorIgnore - ai0) < 1e-9);
});

test('新道具的具体效果（金档）', () => {
  const step = (b, sec) => {
    for (let i = 0; i < sec * 20; i++) b.step(0.05);
  };
  // 龙息：全场魔法伤害 + 点燃 + 眩晕
  let b = itemBattle('dragonBreath');
  b.heroStunUntil = Infinity;
  let a1 = bigHp(b.spawnMonster('slime', 0, 600));
  let a2 = bigHp(b.spawnMonster('slime', 3, 900));
  b.useItem(0);
  assert.ok(a1.hp < 1e9 && a2.hp < 1e9 && a1.burnUntil > b.time && a2.stunUntil > b.time);
  // 黑洞：把怪拉向中心
  b = itemBattle('blackHole');
  b.heroStunUntil = Infinity;
  a1 = bigHp(b.spawnMonster('slime', 1, 560));
  a2 = bigHp(b.spawnMonster('slime', 1, 780));
  const gap = Math.abs(a1.x - a2.x);
  assert.ok(b.useItem(0));
  step(b, 1.5);
  assert.ok(Math.abs(a1.x - a2.x) < gap * 0.6 && a1.hp < 1e9);
  // 圣域：6 秒内城墙受到的伤害 −95%
  b = itemBattle('sanctuary');
  const w0 = b.wall.hp;
  const hitAmt = w0 * 0.1;
  b.hitWall(hitAmt, null);
  const lossNormal = w0 - b.wall.hp;
  b.wall.hp = w0;
  b.useItem(0);
  b.hitWall(hitAmt, null);
  assert.ok((w0 - b.wall.hp) / lossNormal < 0.1, '圣域减伤');
  // 凤凰之羽：城墙被打倒时复活并回 80%；只触发一次；已经武装 / 已经用过复活不能再用
  b = itemBattle('phoenixFeather');
  assert.ok(b.useItem(0));
  b.hitWall(1e9, null);
  assert.ok(!b.over && Math.abs(b.wall.hp - b.wall.max * 0.8) < 1e-6, '复活并回 80%');
  b.hitWall(1e9, null);
  assert.ok(b.over, '第二次被打倒就结束了');
  // 风暴召唤：20 道落雷
  b = itemBattle('stormCall');
  b.heroStunUntil = Infinity;
  bigHp(b.spawnMonster('slime', 1, 600));
  let bolts = 0;
  const old = b.emit.bind(b);
  b.emit = (t, e) => (t === 'stormBolt' && bolts++, old(t, e));
  b.useItem(0);
  step(b, 6);
  assert.strictEqual(bolts, 20);
  // 时光回溯：技能冷却清零 + 回血 30%
  const s = P.newSave();
  clearUpTo(s, 69);
  s.activeOwned.thunder = true;
  s.loadout.active = ['thunder', null, null];
  s.inventory = { timeLoop: 1 };
  P.equipItem(s, 0, 'timeLoop', 1);
  b = new TD.Battle({ level: 41, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 3 });
  b.waveState = 'spawning';
  b.skills[0].cd = 12;
  b.wall.hp = b.wall.max * 0.4;
  b.useItem(0);
  assert.strictEqual(b.skills[0].cd, 0);
  assert.ok(Math.abs(b.wall.hp - b.wall.max * 0.7) < 1e-6);
  // 天罚：血量低于 40% 的普通怪当场抹杀，Boss 吃魔法伤害不会被秒
  b = itemBattle('godWrath');
  b.heroStunUntil = Infinity;
  const weak = b.spawnMonster('slime', 0, 600);
  weak.hp = weak.maxHp * 0.3;
  const healthy = bigHp(b.spawnMonster('slime', 1, 600));
  const lowBoss = bigHp(b.spawnMonster('boarKing', 2, 700));
  lowBoss.hp = lowBoss.maxHp * 0.1;
  b.useItem(0);
  assert.ok(weak.dead, '低血量的当场抹杀');
  assert.ok(!healthy.dead && healthy.hp < 1e9);
  assert.ok(!lowBoss.dead, 'Boss 不会被直接抹杀');
  // 黄金箭：接下来 10 次攻击必定暴击并额外放大
  b = itemBattle('goldenArrow');
  b.useItem(0);
  assert.strictEqual(b.goldenShots, 10);
  const r = b.rollHit(1);
  assert.ok(r.crit && b.goldenShots === 9);
  const normal = (() => {
    const c = itemBattle('goldenArrow');
    c.goldenShots = 0;
    let best = 0;
    for (let i = 0; i < 50; i++) best = Math.max(best, c.rollHit(1).dmg);
    return best;
  })();
  assert.ok(r.dmg >= normal * 2.4, `放大后至少是普通暴击的 2.5 倍：${r.dmg} vs ${normal}`);
  // 瘟疫：全场中毒，共 ATK×14
  b = itemBattle('plague');
  b.heroStunUntil = Infinity;
  a1 = bigHp(b.spawnMonster('slime', 0, 700));
  a2 = bigHp(b.spawnMonster('slime', 3, 900));
  b.useItem(0);
  step(b, 9);
  assert.ok(Math.abs((1e9 - a1.hp) / (b.atk * 14) - 1) < 0.1 && Math.abs((1e9 - a2.hp) / (b.atk * 14) - 1) < 0.1);
  // 影分身军团：12 秒内每次攻击多 3 箭
  const shots = (use) => {
    const c = itemBattle('shadowLegion');
    const m = bigHp(c.spawnMonster('slime', 1, 400));
    if (use) c.useItem(0);
    let n = 0;
    const o = c.emit.bind(c);
    c.emit = (t, e) => (t === 'shoot' && n++, o(t, e));
    step(c, 3);
    return n;
  };
  assert.ok(shots(true) >= shots(false) * 3.5, '影分身多射 3 箭');
});

test('暴风雪卷轴：冻结全体 6 秒，Boss 3 秒，解冻后减速', () => {
  const b = itemBattle('blizzard');
  const def = D.items.blizzard;
  const a = bigHp(b.spawnMonster('slime', 0, 600));
  const c = bigHp(b.spawnMonster('slime', 3, 900));
  const boss = bigHp(b.spawnMonster('boarKing', 1, 700));
  assert.ok(b.useItem(0, 0));
  assert.ok(Math.abs(a.frozenUntil - b.time - def.duration) < 1e-9 && Math.abs(c.frozenUntil - b.time - def.duration) < 1e-9, '所有车道的怪都冻住');
  assert.ok(Math.abs(boss.frozenUntil - b.time - def.bossDuration) < 1e-9, 'Boss 只冻一半时间');
  assert.ok(boss.stunUntil >= b.time + def.bossDuration - 1e-9, 'Boss 的行动也停下');
  assert.ok(a.slowUntil > a.frozenUntil && Math.abs(a.slowAmt - def.slowAfter) < 1e-9, '解冻后还有减速');
  const x0 = a.x;
  for (let i = 0; i < 60; i++) b.step(1 / 60);
  assert.strictEqual(a.x, x0, '冻住的怪不会走');
  const fresh = bigHp(b.spawnMonster('slime', 2, 800));
  assert.ok(Math.abs(b.damageMult(a, { source: 'weapon' }) / b.damageMult(fresh, { source: 'weapon' }) - (1 + def.shatter)) < 1e-9, '冻住期间伤害提高');
});

test('洪水：全体后退 350（Boss 100），受伤并减速，不会退出出怪点之外', () => {
  const b = itemBattle('flood');
  const def = D.items.flood;
  const a = bigHp(b.spawnMonster('slime', 0, 600));
  const edge = bigHp(b.spawnMonster('slime', 1, 1250));
  const boss = bigHp(b.spawnMonster('boarKing', 2, 700));
  const hp0 = a.hp;
  b.useItem(0, 0);
  assert.strictEqual(a.x, 600 + def.push);
  assert.strictEqual(boss.x, 700 + def.bossPush);
  assert.ok(edge.x <= TD.config.spawnX + 60);
  assert.ok(a.hp < hp0, '洪水有伤害');
  assert.ok(Math.abs(a.slowAmt - def.slow) < 1e-9 && a.slowUntil > b.time);
  assert.ok(Math.abs(b.damageMult(a, { source: 'weapon' }) - (1 + def.shatter)) < 1e-9, '被浸湿的怪伤害提高');
});

test('时间静止：连 Boss 也冻住 7 秒，英雄攻速 +60%', () => {
  const b = itemBattle('chrono');
  const def = D.items.chrono;
  const boss = bigHp(b.spawnMonster('boarKing', 0, 700));
  const m = bigHp(b.spawnMonster('slime', 1, 700));
  const asp0 = b.currentAspd();
  b.useItem(0, 0);
  assert.ok(Math.abs(boss.frozenUntil - b.time - def.duration) < 1e-9 && boss.stunUntil >= b.time + def.duration - 1e-9);
  assert.ok(Math.abs(m.frozenUntil - b.time - def.duration) < 1e-9);
  assert.ok(Math.abs(b.currentAspd() / asp0 - (1 + def.aspdBonus)) < 0.01);
  assert.strictEqual(b.monsterSpeed(boss), 0);
  assert.ok(Math.abs(b.damageMult(m, { source: 'weapon' }) - (1 + def.shatter)) < 1e-9, '冻住期间伤害提高');
});

test('地震符：全体眩晕 2.5 秒（Boss 1 秒）并受伤', () => {
  const b = itemBattle('quake');
  const def = D.items.quake;
  const m = bigHp(b.spawnMonster('slime', 0, 900));
  const boss = bigHp(b.spawnMonster('boarKing', 1, 900));
  const h0 = m.hp;
  b.useItem(0, 0);
  assert.ok(Math.abs(m.stunUntil - b.time - def.stun) < 1e-9);
  assert.ok(Math.abs(boss.stunUntil - b.time - def.bossStun) < 1e-9);
  assert.ok(m.hp < h0, '有伤害（射程外也算全场）');
});

test('守护符文：护盾先吸收 35% 最大血量，打完才扣城墙', () => {
  const b = itemBattle('barrier');
  b.useItem(0, 0);
  const shield = b.wall.max * D.items.barrier.shieldRatio;
  assert.ok(Math.abs(b.itemShield - shield) < 1e-9);
  b.hitWall(shield / 2);
  assert.strictEqual(b.wall.hp, b.wall.max, '护盾没破，城墙不掉血');
  b.hitWall(shield);
  assert.ok(b.itemShield === 0 && b.wall.hp < b.wall.max);
});

test('战旗：攻击力 +25%，8 秒后恢复', () => {
  const b = itemBattle('warBanner');
  const a0 = b.atk;
  b.useItem(0, 0);
  assert.ok(Math.abs(b.atk / a0 - (1 + D.items.warBanner.atkBonus)) < 1e-9);
  b.time += D.items.warBanner.duration + 0.5;
  assert.ok(Math.abs(b.atk / a0 - 1) < 1e-9);
});

test('圣光：回复 70% 城墙并让之后 8 秒的城墙伤害 −60%', () => {
  const b = itemBattle('holyLight');
  b.wall.hp = b.wall.max * 0.2;
  b.useItem(0, 0);
  assert.ok(Math.abs(b.wall.hp - b.wall.max * 0.9) < 1e-6, '0.2 + 0.7');
  const before = b.wall.hp;
  b.hitWall(100);
  const lost = before - b.wall.hp;
  assert.ok(lost < 100 * 0.45, '减伤约 60%：' + lost);
  b.time += 9;
  const before2 = b.wall.hp;
  b.hitWall(100);
  assert.ok(before2 - b.wall.hp > 80, '8 秒后恢复正常');
});

test('雷霆符：劈血量最高的 4 只；燃烧瓶打一条车道并点燃；重磅炸弹打三条车道', () => {
  const b = itemBattle('thunderScroll');
  const ms = [1, 2, 3, 4, 5, 6, 7].map((i) => {
    const m = b.spawnMonster('slime', i % 3, 500 + i * 20);
    m.hp = m.maxHp = 1e8 + i;
    return m;
  });
  const hp0 = ms.map((m) => m.hp);
  b.useItem(0, 0);
  const hit = ms.filter((m, i) => m.hp < hp0[i]);
  assert.strictEqual(hit.length, D.items.thunderScroll.count);
  assert.ok(ms.slice(7 - D.items.thunderScroll.count).every((m) => hit.includes(m)), '打中的是血量最高的几只');

  const f = itemBattle('firebomb');
  const a = bigHp(f.spawnMonster('slime', 1, 500));
  const o = bigHp(f.spawnMonster('slime', 0, 500));
  f.useItem(0, 1);
  assert.ok(a.hp < a.maxHp && a.burnUntil > f.time, '同车道的怪受伤并被点燃');
  assert.strictEqual(o.hp, o.maxHp, '别的车道不受影响');

  const g = itemBattle('bigBomb');
  const l0 = bigHp(g.spawnMonster('slime', 0, 500));
  const l1 = bigHp(g.spawnMonster('slime', 1, 500));
  const l2 = bigHp(g.spawnMonster('slime', 2, 500));
  g.useItem(0, 0);
  assert.ok(l0.hp < l0.maxHp && l1.hp < l1.maxHp, '本车道和相邻车道');
  assert.strictEqual(l2.hp, l2.maxHp, '隔一条的不受影响');
});

test('陨石雨：12 颗陆续砸下，周围吃六成', () => {
  const b = itemBattle('meteor');
  const m = bigHp(b.spawnMonster('slime', 0, 500));
  const near = bigHp(b.spawnMonster('slime', 0, 550));
  let lands = 0;
  b.on('meteorHit', () => lands++);
  b.useItem(0, 0);
  for (let i = 0; i < 60 * 5; i++) b.step(1 / 60);
  assert.strictEqual(lands, D.items.meteor.count);
  assert.ok(m.hp < m.maxHp && near.hp < near.maxHp);
});

test('所有新道具自动使用：整场战斗不报错，道具会被用掉', () => {
  const ids = ['firebomb', 'thunderScroll', 'bigBomb', 'barrier', 'warBanner', 'quake', 'blizzard', 'flood', 'holyLight', 'meteor', 'chrono'];
  for (let k = 0; k < ids.length; k += 3) {
    const s = P.newSave();
    clearUpTo(s, 69);
    const pick = ids.slice(k, k + 3);
    for (const id of pick) s.inventory[id] = 1;
    s.loadout.items = pick.concat([null, null]).slice(0, 3);
    s.loadout.active = ['drum'];
    const b = new TD.Battle({ level: 30, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 5 + k, autoItems: true, autoSupply: true });
    const res = b.runToEnd();
    assert.ok(res, pick.join());
  }
});

// ---------- 武器扩充：五色品质（设计书 63） ----------
test('武器：25 把，每个品质 5 把，价格逐档上涨，升级费用逐档上涨', () => {
  const ids = Object.keys(D.weapons);
  assert.strictEqual(ids.length, 25);
  const byR = {};
  for (const id of ids) (byR[D.weapons[id].rarity] = byR[D.weapons[id].rarity] || []).push(id);
  assert.deepStrictEqual(Object.keys(byR), ['1', '2', '3', '4', '5']);
  for (const r of Object.keys(byR)) assert.strictEqual(byR[r].length, 5, '品质 ' + r);
  for (let r = 1; r < 5; r++) {
    const maxLow = Math.max(...byR[r].map((id) => P.costValue(D.weapons[id].cost)));
    const minHigh = Math.min(...byR[r + 1].map((id) => P.costValue(D.weapons[id].cost)));
    assert.ok(minHigh > maxLow, `品质 ${r + 1} 最便宜的比品质 ${r} 最贵的还贵`);
  }
  const mult = [1, 2, 3, 4, 5].map((r) => D.weaponRarity[r].upgradeMult);
  for (let i = 1; i < 5; i++) assert.ok(mult[i] >= mult[i - 1]);
  assert.ok(mult[4] > mult[0]);
  assert.deepStrictEqual([1, 2, 3, 4, 5].map((r) => D.weaponRarity[r].name), ['绿', '蓝', '紫', '红', '金']);
  const s = P.newSave();
  for (const id of ['bow', 'frostBow', 'meteorCannon', 'genesisBow']) s.weapons[id] = { owned: true, lv: 3, asc: false };
  // 升级货币按品质：绿 铜币，蓝 / 紫 银币，红 金币，金 钻石；每级费用 ×1.3；每种品质满级不同（20 / 40 / 60 / 80 / 100），满级后不能再升
  const curOf = { 1: 'copper', 2: 'silver', 3: 'silver', 4: 'gold', 5: 'diamond' };
  const maxOf = { 1: 20, 2: 40, 3: 60, 4: 80, 5: 100 };
  assert.deepStrictEqual(D.weaponMaxLevel, maxOf);
  const base0 = { 1: 5, 2: 1, 3: 2, 4: 1, 5: 1 };
  for (const id of ids) {
    const r = D.weapons[id].rarity;
    const cur = curOf[r];
    const MAX = P.weaponMaxLv(id);
    assert.strictEqual(MAX, maxOf[r], id + ' 的满级');
    s.weapons[id] = { owned: true, lv: 3, asc: false };
    assert.deepStrictEqual(Object.keys(P.weaponUpgradeCost(s, id)), [cur], id + ' 的升级货币');
    for (let lv = 0; lv < MAX; lv++) {
      const c = P.weaponUpgradeCostAt(id, lv);
      assert.deepStrictEqual(Object.keys(c), [cur], id + ' 第 ' + lv + ' 级的升级货币');
      assert.strictEqual(c[cur], Math.ceil(base0[r] * Math.pow(1.3, lv)), `${id} 第 ${lv} 级 = 起步价 × 1.3^${lv}`);
      if (lv > 0) assert.ok(c[cur] >= P.weaponUpgradeCostAt(id, lv - 1)[cur], '越往后越贵');
    }
    for (const lv of [MAX, MAX + 1, 500, 999999]) assert.strictEqual(P.weaponUpgradeCostAt(id, lv), null, id + ' 满级后不能再升');
    s.weapons[id].lv = MAX;
    assert.strictEqual(P.weaponUpgradeCost(s, id), null);
    P.maxResources(s);
    assert.ok(!P.upgradeWeapon(s, id) && s.weapons[id].lv === MAX, id + ' 满级后升级失败');
  }
  const v = (id, lv) => P.costValue(P.weaponUpgradeCostAt(id, lv));
  for (const lv of [0, 5, 9, 15]) assert.ok(v('bow', lv) < v('frostBow', lv) && v('frostBow', lv) < v('meteorCannon', lv) && v('meteorCannon', lv) < v('genesisBow', lv), '品质越高升级越贵 @' + lv);
  for (const id of ids) if (D.weapons[id].look) assert.ok(['bow', 'crossbow', 'staff', 'orb', 'cannon', 'boomerang'].includes(D.weapons[id].look.base), id);
});

test('武器随时可买（只看钱）；老存档自动补上新武器', () => {
  const s = P.newSave();
  s.silver = 1000;
  s.gold = 5000;
  assert.ok(P.buyWeapon(s, 'frostBow'), '没通关也能买蓝色');
  assert.ok(P.buyWeapon(s, 'meteorCannon'));
  assert.ok(P.buyWeapon(s, 'genesisBow'));
  assert.strictEqual(s.gold, 5000 - D.weapons.meteorCannon.cost.gold - D.weapons.genesisBow.cost.gold);
  const poor = P.newSave();
  poor.silver = 3;
  assert.ok(!P.buyWeapon(poor, 'frostBow'), '钱不够照样买不起');
  assert.ok(P.recommended(P.newSave(), D.weapons.genesisBow));
  assert.ok(!P.recommended(Object.assign(P.newSave(), { levels: Object.fromEntries(Array.from({ length: 60 }, (_, i) => [i + 1, { stars: 1, clears: 1 }])) }), D.weapons.genesisBow));
  const old = P.newSave();
  delete old.weapons.genesisBow;
  assert.deepStrictEqual(P.migrate(old).weapons.genesisBow, { owned: false, lv: 0 });
});

function weaponBattle(id) {
  const s = P.newSave();
  clearUpTo(s, 69);
  s.weapons[id] = { owned: true, lv: 0, asc: false };
  s.loadout.weapon = id;
  return new TD.Battle({ level: 41, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 2 });
}

test('寒霜弓和时之回旋命中减速；烈焰弩和创世之弓命中点燃；普通木弓不会', () => {
  for (const [id, slow, ignite] of [['frostBow', 0.3, false], ['chronoBoomerang', 0.4, false], ['flameCrossbow', 0, true], ['genesisBow', 0, true], ['bow', 0, false]]) {
    const b = weaponBattle(id);
    const m = b.spawnMonster('slime', 0, 500);
    m.hp = m.maxHp = 1e9;
    b.applyWeaponHit(m, 10, false, true, null);
    if (slow) assert.ok(Math.abs(m.slowAmt - slow) < 1e-9 && m.slowUntil > b.time, id + ' 减速');
    else assert.ok(!(m.slowUntil > b.time), id + ' 不减速');
    assert.strictEqual(m.burnUntil > b.time, ignite, id + ' 点燃');
  }
});

test('穿心长弓一次 3 箭、各穿透 3 只；陨星炮对 Boss ×1.3 且无视 60% 护甲；风暴法球跳 5 次；时之回旋扔三支', () => {
  const b = weaponBattle('piercer');
  assert.strictEqual(b.weaponDef().pierce.count, 3);
  const ms = [500, 540, 580, 620, 660].map((x) => {
    const m = b.spawnMonster('slime', 0, x);
    m.hp = m.maxHp = 1e9;
    return m;
  });
  b.pierceFrom(ms[0], { dmg: 100, crit: false, pierce: b.weaponDef().pierce, dmgType: 'phys' });
  assert.strictEqual(ms.filter((m) => m.hp < m.maxHp).length, 3, '后面最多 3 只被穿透（不含第一只）');
  const mc = weaponBattle('meteorCannon');
  assert.strictEqual(mc.weaponDef().bossMult, 1.3);
  assert.ok(Math.abs(mc.armorIgnore({ armorIgnore: mc.weaponDef().armorIgnore }) - 0.6) < 1e-9);
  assert.strictEqual(weaponBattle('stormOrb').weaponDef().chain.count, 5);
  const cb = weaponBattle('chronoBoomerang');
  const t = cb.spawnMonster('slime', 1, 500);
  t.hp = t.maxHp = 1e9;
  cb.fire([t]);
  assert.strictEqual(cb.projectiles.filter((p) => p.kind === 'boomerang').length, 3);
});

test('新武器的弹道带品质色；射出的弹道种类跟基础形状一致', () => {
  const b = weaponBattle('flameCrossbow');
  const m = b.spawnMonster('slime', 0, 500);
  m.hp = m.maxHp = 1e9;
  b.fire([m]);
  // 弹道颜色 = 武器品质色（烈焰弩是紫色品质，设计书 78.4）
  assert.ok(b.projectiles.every((p) => p.kind === 'bolt' && p.tint === D.weaponRarity[3].color));
  assert.ok(weaponBattle('stormOrb').weaponDef().look.base === 'orb');
});

// ---------- 音乐与音效（设计书 64） ----------
function mockAudioCtx() {
  const calls = { osc: 0, noise: 0 };
  const param = () => ({ value: 0, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
  const node = () => ({ setTargetAtTime() {}, connect() {}, disconnect() {}, start() {}, stop() {}, playbackRate: param(), pan: param(), gain: param(), frequency: param(), detune: param(), Q: param(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() });
  return {
    calls,
    currentTime: 0,
    sampleRate: 8000,
    state: 'running',
    destination: node(),
    createGain: node,
    createBiquadFilter: node,
    createDynamicsCompressor: node,
    createConvolver: node,
    createOscillator: () => (calls.osc++, node()),
    createBufferSource: () => (calls.noise++, node()),
    createStereoPanner: node,
    decodeAudioData: (ab, ok) => {
      const buf = { duration: 2.45, sampleRate: 8000, length: 19600, getChannelData: () => new Float32Array(19600) };
      if (ok) ok(buf);
      return Promise.resolve(buf);
    },
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
  };
}

test('音乐：标题 3 首 + 十章各 2 首共 23 首，每首 8 小节和弦、64 个八分音符位置，音高在合理范围', () => {
  globalThis.window = globalThis.window || undefined;
  delete require.cache[require.resolve('../src/render/score.js')];
  require('../src/render/score.js');
  delete require.cache[require.resolve('../src/render/music.js')];
  require('../src/render/music.js');
  const M = TD.music;
  assert.strictEqual(Object.keys(M.THEMES).length, 23);
  for (const id of Object.keys(M.THEMES)) {
    const th = M.THEMES[id];
    assert.ok(th, `缺少第 ${id} 首`);
    assert.strictEqual(th.chords.length, 8);
    assert.strictEqual(th.notes.length, 64);
    const played = th.notes.filter(Boolean);
    assert.ok(played.length >= 14, `第 ${id} 首旋律音符太少`);
    for (const n of played) assert.ok(Number.isFinite(n.midi) && n.midi >= 60 && n.midi <= 96, `第 ${id} 首有越界音高 ${n.midi}`);
    assert.ok(th.bpm >= 66 && th.bpm <= 130);
    assert.ok(th.name && th.lead);
  }
  // 每章都有 A / B 两首，标题有 3 首，且名字互不相同
  for (let ch = 1; ch <= 10; ch++) assert.ok(M.THEMES[ch] && M.THEMES[ch + 'b'], `第 ${ch} 章缺 B 曲`);
  assert.deepStrictEqual(M.TITLE_IDS, [0, 'T1', 'T2']);
  assert.strictEqual(new Set(Object.values(M.THEMES).map((t) => t.name)).size, 23, '曲名不重复');
  assert.strictEqual(new Set(Object.values(M.THEMES).map((t) => t.melody.join('|'))).size, 23, '旋律不重复');
  assert.strictEqual(M.THEMES[5].lead, 'horn');
});

test('音乐：每首曲子在每种模式 / 紧张度下都能排完整个循环，且越紧张声音事件越多', () => {
  const M = TD.music;
  const events = {};
  for (const id of Object.keys(M.THEMES)) {
    const isTitle = M.TITLE_IDS.map(String).includes(id);
    for (const [mode, tension] of [['title', 0], ['calm', 0], ['battle', 0], ['battle', 1], ['battle', 2], ['battle', 3]]) {
      if (isTitle && mode !== 'title') continue;
      if (!isTitle && mode === 'title') continue;
      const ctx = mockAudioCtx();
      const eng = new M.Engine(ctx, ctx.destination);
      eng.tension = tension;
      eng.setTheme(id, mode);
      eng.schedule(40); // 足够跑完 8 小节循环
      const n = ctx.calls.osc + ctx.calls.noise;
      assert.ok(n > 20, `第 ${id} 首 ${mode}/${tension} 几乎没有声音`);
      if (id === '1') events[mode + tension] = n / Math.min(40, eng.nextTime);
    }
  }
  assert.ok(events.battle0 > events.calm0, '战斗比地图更密');
  assert.ok(events.battle1 > events.battle0 && events.battle2 > events.battle1 && events.battle3 > events.battle2, '紧张度越高，声音事件越密');
});

test('音乐：一次性的结束音 / 登场音可以播放；紧张度越高总音量越大', () => {
  const M = TD.music;
  for (const name of ['boss', 'win', 'lose', 'wave']) {
    const ctx = mockAudioCtx();
    const eng = new M.Engine(ctx, ctx.destination);
    eng.setTheme(1, 'battle');
    eng.stinger(name);
    assert.ok(ctx.calls.osc + ctx.calls.noise >= 4, `${name} 结束音太单薄`);
  }
  const lv = [0, 1, 2, 3].map((t) => M.levelFor('battle', t));
  assert.ok(lv[0] < lv[1] && lv[1] < lv[2] && lv[2] < lv[3] && lv[3] <= 0.7);
  assert.ok(M.levelFor('calm', 0) < lv[0]);
});

test('音效：每个道具都有专属音效，城墙破损 / 坍塌 / 陨石落地等也有', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'src/render/audio.js'), 'utf8');
  for (const id of Object.keys(D.items)) assert.ok(src.includes(`item_${id}:`), `道具 ${id} 没有音效`);
  for (const n of ['meteorHit', 'scrollBolt', 'barrierBreak', 'wallBreak', 'wallCollapse']) assert.ok(src.includes(`${n}:`), `缺少音效 ${n}`);
});

test('采样乐器：25 种乐器 / 鼓件都有采样，持续音带循环区间，每个乐器覆盖足够的音高范围', () => {
  delete require.cache[require.resolve('../src/render/samples.js')];
  require('../src/render/samples.js');
  const S = TD.samples;
  const names = ['cello', 'contrabass', 'string_ensemble_1', 'tremolo_strings', 'pizzicato_strings', 'french_horn', 'brass_section', 'choir_aahs', 'timpani', 'taiko_drum', 'tubular_bells', 'celesta', 'orchestral_harp', 'marimba', 'oboe', 'flute', 'violin', 'drum_kick', 'drum_snare', 'drum_hat', 'drum_ohat', 'drum_crash', 'drum_tom_hi', 'drum_tom_mid', 'drum_tom_lo', 'drum_tom_floor'];
  for (const n of names) {
    assert.ok(S[n], `缺少乐器 ${n}`);
    const keys = Object.keys(S[n].notes).map(Number);
    assert.ok(keys.length >= (n.startsWith('drum_') ? 1 : 5), `${n} 采样太少`);
    for (const v of Object.values(S[n].notes)) assert.ok(v.length > 2000, `${n} 有空采样`);
  }
  for (const n of ['cello', 'string_ensemble_1', 'french_horn', 'choir_aahs', 'flute', 'oboe']) assert.deepStrictEqual(S[n].loop, [0.8, 2.4]);
  assert.strictEqual(S.timpani.loop, null);
  // 每首曲子要用的乐器采样里都有
  for (const id of Object.keys(TD.music.THEMES)) for (const n of TD.music.Engine.instrumentsFor(id)) assert.ok(S[n], `第 ${id} 首要用 ${n}，但没有采样`);
  // 主旋律用到的最高 / 最低音，采样范围内变速不超过 3 个半音
  for (const id of Object.keys(TD.music.THEMES)) {
    const th = TD.music.THEMES[id];
    const inst = { bell: 'tubular_bells', pluck: 'orchestral_harp', marimba: 'marimba', reed: 'oboe', flute: 'flute', horn: 'french_horn' }[th.lead];
    const keys = Object.keys(S[inst].notes).map(Number);
    for (const n of th.notes.filter(Boolean)) {
      const near = Math.min(...keys.map((k) => Math.abs(k - n.midi)));
      assert.ok(near <= 3 || (inst === 'tubular_bells' && n.midi >= 84), `第 ${id} 首旋律音 ${n.midi} 离 ${inst} 的采样太远（${near}）`);
    }
  }
});

test('采样乐器：解码后用采样演奏（振荡器变少、播放源变多），没解码时退回合成', async () => {
  const M = TD.music;
  const play = async (withSamples) => {
    const ctx = mockAudioCtx();
    const eng = new M.Engine(ctx, ctx.destination);
    if (withSamples) await eng.loadSamples(M.Engine.instrumentsFor(1));
    eng.tension = 2;
    eng.setTheme(1, 'battle');
    eng.schedule(20);
    return { ctx, eng };
  };
  const synth = await play(false);
  const samp = await play(true);
  assert.ok(Object.keys(samp.eng.S).length >= 11, '共用乐器 + 主奏都解码了');
  assert.ok(samp.ctx.calls.osc < synth.ctx.calls.osc * 0.6, `用采样后振荡器应明显变少：${samp.ctx.calls.osc} vs ${synth.ctx.calls.osc}`);
  assert.ok(samp.ctx.calls.noise > synth.ctx.calls.noise, '采样是播放源节点');
  // 最近采样 + 变速：不会越界
  assert.strictEqual(samp.eng.samp('cello', 40, 0, 1, 0.1), true);
  assert.strictEqual(synth.eng.samp('cello', 40, 0, 1, 0.1), false);
});

test('战斗曲子：32 小节分四段（主题 / 弦乐 / 间奏 / 高潮），段与段配器不同；所有曲子所有紧张度都能排完整个循环', async () => {
  const M = TD.music;
  // 每段 8 小节的声音事件数（用合成声音的模拟环境按时间切段）
  const perSection = (id, tension, withSamples) => {
    const ctx = mockAudioCtx();
    const eng = new M.Engine(ctx, ctx.destination);
    const th = M.THEMES[id];
    const secSec = ((60 / th.bpm) * 4 * 8) / M.TEMPO_OF(tension);
    const counts = [];
    eng.tension = tension;
    eng.setTheme(id, 'battle');
    let last = 0;
    const read = () => ctx.calls.osc + ctx.calls.noise;
    const run = async () => {
      if (withSamples) await eng.loadSamples(M.Engine.instrumentsFor(id));
      for (let q = 1; q <= 4; q++) {
        eng.schedule(secSec * q);
        counts.push(read() - last);
        last = read();
      }
      return counts;
    };
    return run();
  };
  for (const withSamples of [false, true]) {
    const c = await perSection(1, 1, withSamples);
    assert.ok(Math.max(...c) / Math.min(...c) > 1.05, `四段的配器应有差别：${c}`);
    assert.ok(c.every((n) => n > 50), `每段都要有足够的声音：${c}`);
  }
  for (let id = 1; id <= 7; id++) for (let t = 0; t <= 3; t++) assert.ok((await perSection(id, t, true)).every((n) => n > 30), `第 ${id} 首 ${t} 档某一段几乎没声音`);
});

// ---------- 道具去重、补给重做（设计书 71） ----------
test('道具：同一种只占一个栏位；背包和已装备分开记；用一个少一个，用完清栏位；旧存档迁移', () => {
  const s = P.newSave();
  clearUpTo(s, 10);
  s.copper = 10000;
  for (let i = 0; i < 5; i++) assert.ok(P.buyItem(s, 'bomb'));
  assert.strictEqual(s.inventory.bomb, 5);
  assert.ok(P.buyItem(s, 'patch'));
  // 装备：默认装满 3 个，其余留在背包
  assert.ok(P.setSlot(s, 'item', 0, 'bomb'));
  assert.strictEqual(P.itemEquipped(s, 'bomb'), 3);
  assert.strictEqual(P.itemStock(s, 'bomb'), 2);
  assert.ok(!P.adjustItem(s, 'bomb', 1), '每种最多装备 3 个');
  // 指定个数：带 2 个，另一个退回背包
  assert.ok(P.equipItem(s, 0, 'bomb', 2));
  assert.strictEqual(P.itemEquipped(s, 'bomb'), 2);
  assert.strictEqual(P.itemStock(s, 'bomb'), 3);
  // 同一种换栏位：只占一个
  assert.ok(P.setSlot(s, 'item', 2, 'bomb'));
  assert.strictEqual(s.loadout.items.filter((x) => x === 'bomb').length, 1);
  assert.strictEqual(s.loadout.items[2], 'bomb');
  // 栏位里换成别的道具：原来的全部退回背包
  assert.ok(P.setSlot(s, 'item', 2, 'patch'));
  assert.strictEqual(P.itemEquipped(s, 'patch'), 1);
  assert.strictEqual(P.itemStock(s, 'bomb'), 5);
  assert.ok(!P.setSlot(s, 'item', 0, 'meteor'), '一个都没有的道具装备不上');
  // 最多 7 种：栏位数随进度解锁，前面几种解锁前装不进去
  assert.deepStrictEqual(D.slotUnlocks.item.length, 7);
  assert.ok(!P.equipItem(s, 6, 'bomb', 1), '第 7 个栏位还没解锁');
  // 用一个少一个，已装备的个数记在存档里
  P.equipItem(s, 0, 'bomb', 3);
  const lo = P.battleLoadout(s);
  assert.deepStrictEqual(lo.itemQty, { bomb: 3, patch: 1 });
  P.consumeItem(s, 'bomb');
  assert.strictEqual(P.itemEquipped(s, 'bomb'), 2);
  assert.ok(s.loadout.items.includes('bomb'), '还剩 2 个，下一关继续带');
  P.consumeItem(s, 'bomb');
  P.consumeItem(s, 'bomb');
  assert.ok(!s.loadout.items.includes('bomb'), '用完了清栏位');
  assert.strictEqual(P.itemEquipped(s, 'bomb'), 0);
  assert.strictEqual(P.itemStock(s, 'bomb'), 2, '背包里的还在，要重新装备才会带进战斗');
  // 旧存档迁移：栏位里的道具最多 3 个从背包挪到"已装备"，重复栏位去重，栏位补到 7 个
  const old = P.newSave();
  delete old.loadout.itemQtyMigrated;
  old.inventory = { bomb: 5, patch: 2 };
  old.loadout.items = ['bomb', 'bomb', 'patch'];
  old.loadout.itemQty = {};
  const m = P.migrate(old);
  assert.strictEqual(m.loadout.items.length, 7);
  assert.deepStrictEqual(m.loadout.items.slice(0, 3), ['bomb', null, 'patch']);
  assert.deepStrictEqual(m.loadout.itemQty, { bomb: 3, patch: 2 });
  assert.deepStrictEqual(m.inventory, { bomb: 2, patch: 0 });
});

test('战斗里的道具：每种带 1–3 个，用一个少一个；用完一次要等冷却；每次使用都记进存档', () => {
  const s = P.newSave();
  clearUpTo(s, 20);
  s.inventory = { bomb: 3, patch: 1 };
  P.equipItem(s, 0, 'bomb', 3);
  P.equipItem(s, 1, 'patch', 1);
  const b = new TD.Battle({ level: 10, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 2 });
  assert.deepStrictEqual(b.items.map((it) => [it.id, it.left]), [['bomb', 3], ['patch', 1]]);
  b.waveState = 'spawning';
  assert.ok(b.useItem(0, 0));
  assert.strictEqual(b.items[0].left, 2);
  assert.ok(Math.abs(b.items[0].cd - D.items.bomb.cd) < 1e-9, '用完进入冷却');
  assert.ok(!b.useItem(0, 0), '冷却中不能再用');
  assert.ok(!b.itemReady(0));
  for (let i = 0; i < 60 * (D.items.bomb.cd + 1); i++) b.step(1 / 60);
  assert.ok(b.itemReady(0), '冷却好了又能用');
  assert.ok(b.useItem(0, 0));
  assert.strictEqual(b.items[0].left, 1);
  // 每次使用都扣已装备的个数（main.js 里监听 item 事件），道具独立冷却
  const ev = [];
  b.on('item', (e) => ev.push(e));
  assert.ok(b.useItem(1, 0));
  assert.strictEqual(ev[0].id, 'patch');
  assert.strictEqual(b.items[1].left, 0);
  assert.ok(!b.useItem(1, 0), '用完了');
  P.consumeItem(s, 'bomb');
  P.consumeItem(s, 'bomb');
  P.consumeItem(s, 'patch');
  assert.strictEqual(P.itemEquipped(s, 'bomb'), 1);
  assert.strictEqual(P.itemEquipped(s, 'patch'), 0);
  // 每种道具都有冷却（幸运符除外），越强越长
  for (const id of Object.keys(D.items)) if (!D.items[id].passive) assert.ok(D.items[id].cd > 0, id);
  assert.ok(D.items.chrono.cd > D.items.bigBomb.cd && D.items.bigBomb.cd > D.items.bomb.cd);
});

test('补给：每 3 波一次（最多 4 次）；三档品质；越往后稀有 / 史诗越多', () => {
  const mk = (n) => new TD.Battle({ level: 28, levelDef: Object.assign({}, TD.data.levels[28], { waves: Array.from({ length: n }, () => TD.data.levels[28].waves[0]) }), stats: P.heroStats(P.newSave()), loadout: { active: [], items: [] }, seed: 1 });
  assert.deepStrictEqual(mk(7).supplyWaves, [1, 4]);
  assert.deepStrictEqual(mk(10).supplyWaves, [1, 4, 7]);
  assert.deepStrictEqual(mk(12).supplyWaves, [1, 4, 7, 10]);
  assert.strictEqual(mk(20).supplyWaves.length, 4);
  for (const [id, sup] of Object.entries(D.supplies)) assert.ok(!sup.rarity || D.supplyRarity[sup.rarity], id);
  const count = (r) => Object.values(D.supplies).filter((x) => (x.rarity || 'blue') === r).length;
  assert.deepStrictEqual(Object.keys(D.supplyRarity), ['blue', 'purple', 'red', 'gold'], '四档，从低到高');
  assert.ok(count('blue') >= 8 && count('purple') >= 6 && count('red') >= 4 && count('gold') >= 4);
  // 权重：每次补给都是 蓝 > 紫 > 红 > 金，而且越往后高品质越多
  for (const w of D.supplyWeights) assert.ok(w[0] > w[1] && w[1] > w[2] && w[2] > w[3], '品质越高概率越低：' + w);
  for (let k = 1; k < D.supplyWeights.length; k++) assert.ok(D.supplyWeights[k][3] > D.supplyWeights[k - 1][3] && D.supplyWeights[k][0] < D.supplyWeights[k - 1][0]);
  // 统计：第 1 次补给里各档出现的次数递减；第 4 次补给的红 + 金明显更多
  const tally = (k) => {
    const t = { blue: 0, purple: 0, red: 0, gold: 0 };
    for (let seed = 1; seed <= 1500; seed++) {
      const b = mk(10);
      b.rng = TD.util.rng(seed);
      b.supplyPicked = new Array(k).fill('x');
      b.offerSupply();
      for (const id of b.pendingSupply) t[D.supplies[id].rarity || 'blue']++;
    }
    return t;
  };
  const t0 = tally(0);
  assert.ok(t0.blue > t0.purple && t0.purple > t0.red && t0.red > t0.gold && t0.gold > 0, `第 1 次补给各档次数应递减：${JSON.stringify(t0)}`);
  const t3 = tally(3);
  assert.ok(t3.red + t3.gold > (t0.red + t0.gold) * 2, `第 4 次补给红 + 金应明显更多：${JSON.stringify(t0)} → ${JSON.stringify(t3)}`);
});

function supplyBattle(extra) {
  const s = P.newSave();
  clearUpTo(s, 30);
  const b = new TD.Battle({ level: 30, stats: P.heroStats(s), loadout: Object.assign({ active: ['drum'], items: [] }, extra || {}), seed: 3 });
  b.waveState = 'spawning';
  return b;
}

test('补给卡：战地医院立刻回血；处决对残血怪 +60%；回春箭每击杀回血；铜墙铁壁每波给护盾', () => {
  const take = (b, id) => {
    b.pendingSupply = [id];
    assert.ok(b.chooseSupply(id));
  };
  let b = supplyBattle();
  b.wall.hp = b.wall.max * 0.3;
  take(b, 'hospital');
  assert.ok(Math.abs(b.wall.hp - b.wall.max * 0.75) < 1e-6);

  b = supplyBattle();
  const m = b.spawnMonster('slime', 0, 600);
  m.hp = m.maxHp = 1000;
  const base = b.damageMult(m, { source: 'weapon' });
  take(b, 'executioner');
  m.hp = 400;
  assert.ok(Math.abs(b.damageMult(m, { source: 'weapon' }) - base) < 1e-9, '血量高于 30% 不触发');
  m.hp = 200;
  assert.ok(Math.abs(b.damageMult(m, { source: 'weapon' }) / base - 1.6) < 1e-9);

  b = supplyBattle();
  take(b, 'mender');
  b.wall.hp = b.wall.max * 0.5;
  const k = b.spawnMonster('slime', 0, 600);
  b.kill(k);
  assert.ok(Math.abs(b.wall.hp - b.wall.max * 0.503) < 1e-6);

  b = supplyBattle();
  take(b, 'fortress');
  assert.ok(Math.abs(b.mods.waveShield - 0.12) < 1e-9 && Math.abs(b.mods.wallDr - 0.1) < 1e-9);
});

test('补给卡：空袭、冰封令在下一波开始后才触发；战鼓雷鸣刷新冷却并加攻击；连锁闪电有几率放闪电', () => {
  let b = supplyBattle();
  const m = b.spawnMonster('slime', 0, 600);
  m.hp = m.maxHp = 1e6;
  b.pendingSupply = ['airstrike'];
  b.chooseSupply('airstrike');
  assert.strictEqual(b.delayed.length, 1);
  assert.ok(b.delayed[0].at !== null, '选卡后立刻开始下一波，计时开始');
  const hp0 = m.hp;
  b.time = b.delayed[0].at - 0.5;
  b.step(1 / 60);
  assert.strictEqual(m.hp, hp0, '没到时间不触发');
  b.time = b.delayed[0].at + 0.1;
  b.step(1 / 60);
  assert.ok(m.hp < hp0, '到时间对全场造成魔法伤害');
  assert.strictEqual(b.delayed.length, 0);

  b = supplyBattle();
  const f = b.spawnMonster('slime', 1, 700);
  const boss = b.spawnMonster('boarKing', 2, 700);
  b.pendingSupply = ['coldSnap'];
  b.chooseSupply('coldSnap');
  b.time = b.delayed[0].at + 0.1;
  b.step(1 / 60);
  assert.ok(f.frozenUntil > b.time + 3 && boss.frozenUntil > b.time && boss.frozenUntil < f.frozenUntil, 'Boss 冻得短');

  b = supplyBattle();
  b.skills[0].cd = 50;
  const a0 = b.atk;
  b.pendingSupply = ['warDrum'];
  b.chooseSupply('warDrum');
  assert.strictEqual(b.skills[0].cd, 0);
  assert.ok(Math.abs(b.atk / a0 - 1.35) < 1e-9);
  b.time += 31;
  assert.ok(Math.abs(b.atk / a0 - 1) < 1e-9, '30 秒后恢复');

  b = supplyBattle();
  b.mods.chainChance = 1;
  const t1 = b.spawnMonster('slime', 0, 500);
  const t2 = b.spawnMonster('slime', 0, 560);
  t1.hp = t1.maxHp = t2.hp = t2.maxHp = 1e6;
  b.applyWeaponHit(t1, 100, false, true, undefined);
  assert.ok(t2.hp < t2.maxHp, '闪电跳到了旁边的怪');
});

test('补给：所有补给卡都能被机器人选中并跑完整场战斗不报错', () => {
  for (const id of Object.keys(D.supplies)) {
    const s = P.newSave();
    clearUpTo(s, 69);
    const b = new TD.Battle({ level: 12, stats: P.heroStats(s), loadout: { active: ['drum'], items: [] }, seed: 11, autoSupply: true });
    b.pendingSupply = [id];
    assert.ok(b.chooseSupply(id), id);
    b.pendingSupply = null;
    assert.ok(b.runToEnd(), id);
  }
});

test('补给卡（金）：神圣庇佑复活一次；狂暴全属性；时光沙漏刷新冷却；天火降临每波开始后落下', () => {
  const take = (b, id) => {
    b.pendingSupply = [id];
    assert.ok(b.chooseSupply(id));
  };
  let b = supplyBattle();
  take(b, 'aegis');
  b.hitWall(b.wall.max * 5);
  assert.ok(!b.over, '第一次被打倒时复活');
  assert.ok(Math.abs(b.wall.hp - b.wall.max * 0.6) < 1e-6);
  b.hitWall(b.wall.max * 5);
  assert.ok(b.over, '只复活一次');

  b = supplyBattle();
  const a0 = b.atk;
  const asp0 = b.currentAspd();
  take(b, 'frenzy');
  assert.ok(Math.abs(b.atk / a0 - 1.35) < 1e-9 && Math.abs(b.currentAspd() / asp0 - 1.25) < 0.01);

  b = supplyBattle();
  b.skills[0].cd = 60;
  take(b, 'hourglass');
  assert.strictEqual(b.skills[0].cd, 0);
  assert.ok(Math.abs(b.mods.cdMult + 0.4) < 1e-9);

  b = supplyBattle();
  take(b, 'skyfire');
  assert.ok(b.mods.waveStrike);
  const n0 = b.delayed.length;
  b.startWave(b.waveIndex + 1);
  assert.ok(b.delayed.length > n0, '每波开始时安排一次天火');
});

// ---------- 第八至十章 · 混沌回声（设计书 75） ----------
test('前 100 关：十章、每章 10 关，类型顺序固定，所有怪物都存在', () => {
  assert.strictEqual(D.chapters.length, 20);
  assert.strictEqual(Object.keys(D.levels).length, 200);
  assert.strictEqual(D.chapterOf(75).id, 8);
  assert.strictEqual(D.chapterOf(85).id, 9);
  assert.strictEqual(D.chapterOf(100).id, 10);
  const order = ['normal', 'normal', 'rush', 'dark', 'miniboss', 'armored', 'raid', 'dark', 'union', 'boss'];
  for (let ch = 8; ch <= 10; ch++)
    for (let i = 0; i < 10; i++) {
      const n = (ch - 1) * 10 + 1 + i;
      const lvl = D.levels[n];
      // 第十章第 4 关（虚空盾阵）是普通关，和第七章的排法一样：整章只有第 98 关是暗夜
      assert.strictEqual(lvl.type, ch === 10 && i === 3 ? 'normal' : order[i], `第 ${n} 关类型`);
      assert.strictEqual(lvl.lanes, 5);
      assert.ok(lvl.waves.length >= 3 && lvl.tip, `第 ${n} 关`);
      if (lvl.type === 'dark') assert.ok(lvl.dark);
      for (const w of lvl.waves) for (const [t, c] of w.groups) assert.ok(D.monsters[t] && c >= 1, `第 ${n} 关的 ${t}`);
    }
  for (const k of ['ch8', 'pre75', 'post75', 'pre80', 'post80', 'ch9', 'pre85', 'post85', 'pre90', 'post90', 'ch10', 'pre95', 'post95', 'pre100', 'post100']) {
    assert.ok(D.story[k] && D.storyOrder.includes(k), k);
    for (const [who] of D.story[k].lines || []) assert.ok(D.speakers[who] || D.monsters[who], `${k} 的说话人 ${who}`);
  }
});

test('混沌回声：怪物沿用原来的画法（art）+ 换色（tint），Boss 沿用原来的行动（ai）但血量更高', () => {
  const echoes = Object.keys(D.monsters).filter((k) => D.monsters[k].echo);
  assert.ok(echoes.length >= 31);
  for (const id of echoes) {
    const d = D.monsters[id];
    assert.ok(d.art && D.monsters[d.art] && d.tint, id);
  }
  const pairs = { chaosBoneMage: 'boneMage', chaosPharaoh: 'pharaoh', chaosGolem: 'rockGolem', chaosQueen: 'frostQueen', chaosGiant: 'windGiant', chaosInk: 'inkBoss' };
  for (const [e, o] of Object.entries(pairs)) {
    assert.strictEqual(D.monsters[e].ai, D.monsters[o].ai, e);
    assert.ok(D.monsters[e].hp > D.monsters[o].hp, e);
    assert.strictEqual(D.monsters[e].boss, D.monsters[o].boss, e);
  }
  // 回声 Boss 不影响"击败全部 Boss"成就和小镇
  const done = P.newSave();
  for (const id of Object.keys(D.monsters)) if (D.monsters[id].boss && !D.monsters[id].towerOf && !D.monsters[id].echo) done.stats.killsByType[id] = 1;
  assert.ok(D.achievements.find((a) => a.id === 'bosses').check(done));
});

test('第 70 关以后的难度系数缓慢增长（每关 +1%）', () => {
  const d70 = TD.config.difficulty(70);
  assert.ok(Math.abs(TD.config.difficulty(71) - d70 * 1.01) < 1e-9);
  assert.ok(Math.abs(TD.config.difficulty(100) - d70 * 1.3) < 1e-9);
  for (let n = 2; n <= 100; n++) assert.ok(TD.config.difficulty(n) > TD.config.difficulty(n - 1));
});

test('无尽 / 每日 / 妖塔：第八至十章通关后才放开对应章节的怪物', () => {
  for (const [cleared, last] of [[65, 60], [70, 70], [80, 80], [90, 90], [100, 100]]) {
    const s = P.newSave();
    clearUpTo(s, cleared);
    assert.strictEqual(TD.modes.poolLast(s), last);
  }
  const s = P.newSave();
  clearUpTo(s, 100);
  const echoMinions = Object.keys(D.monsters).filter((k) => D.monsters[k].echo && !D.monsters[k].boss);
  const seen = new Set();
  for (let seed = 1; seed <= 6; seed++) for (const w of TD.modes.buildEndless(s, seed).waves) for (const [t] of w.groups) seen.add(t);
  assert.ok(echoMinions.some((t) => seen.has(t)));
  assert.ok(![...seen].includes('chaosInk'), '墨墨的回声保持唯一，不进入无尽模式');
  // 妖塔：同屏的小妖种类不超过 17 种；难度按已通关的最高关卡折算
  const pool = TD.modes.towerMinionPool(s);
  assert.ok(pool.length <= 17 && pool.some((t) => D.monsters[t].echo));
  assert.strictEqual(TD.modes.towerStage(s), 100);
});

test('第 100 关：墨墨的回声登场，战斗可以正常跑完前 60 秒', () => {
  const s = P.newSave();
  clearUpTo(s, 99);
  const b = new TD.Battle({ level: 100, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 3 });
  for (let i = 0; i < 60 * 60 && !b.over; i++) b.step(1 / 60);
  assert.ok(b.time > 0);
  assert.ok(D.levels[100].waves.some((w) => w.groups.some(([t]) => t === 'chaosInk')));
});

// ---------- v0.68：装备七类 × 30 件、等级上限 999999（设计书 76） ----------
test('装备：头盔、披风、盔甲、箭袋、饰品、鞋子各 30 件，五档品质各 6 件，名字不重复，价格和属性合法', () => {
  assert.deepStrictEqual(Object.keys(D.equipSlots), ['helm', 'cape', 'armor', 'quiver', 'trinket', 'boots']);
  const names = new Set();
  for (const slot of Object.keys(D.equipSlots)) {
    const ids = Object.keys(D.equipment).filter((id) => D.equipment[id].slot === slot);
    assert.strictEqual(ids.length, 30, slot);
    for (let t = 1; t <= 5; t++) assert.strictEqual(ids.filter((id) => D.equipment[id].rarity === t).length, 6, `${slot} 第 ${t} 档`);
    for (const id of ids) {
      const e = D.equipment[id];
      assert.ok(!names.has(e.name), `名字重复：${e.name}`);
      names.add(e.name);
      assert.ok(e.cost && P.costValue(e.cost) > 0 && e.desc && D.weaponRarity[e.rarity], id);
      assert.ok(Object.keys(e.stats).length + Object.keys(e.mods || {}).length + (e.zap ? 1 : 0) > 0, `${id} 没有属性`);
    }
    // 同一类里品质越高越贵
    const price = (t) => Math.min(...ids.filter((id) => D.equipment[id].rarity === t).map((id) => P.costValue(D.equipment[id].cost)));
    for (let t = 2; t <= 5; t++) assert.ok(price(t) > price(t - 1), `${slot} 第 ${t} 档比第 ${t - 1} 档贵`);
  }
  // 武器也在装备分类里
  assert.deepStrictEqual(D.equipCats.map((c) => c.id), ['weapon', 'helm', 'cape', 'armor', 'quiver', 'trinket', 'boots']);
  // 金色装备：每类只有第 1 件能用金币买，其余 5 件只能用钻石，最便宜 10 钻，越往后越贵（设计书 79）
  for (const slot of Object.keys(D.equipSlots)) {
    const gold = Object.values(D.equipment).filter((e) => e.slot === slot && e.rarity === 5);
    const byGold = gold.filter((e) => !e.cost.diamond);
    const byDia = gold.filter((e) => e.cost.diamond).sort((a, b) => a.cost.diamond - b.cost.diamond);
    assert.strictEqual(byGold.length, 1, `${slot} 金色只有 1 件能用金币买`);
    assert.strictEqual(byDia.length, 5, slot);
    assert.ok(byDia.every((e) => Object.keys(e.cost).length === 1), '只收钻石，不混别的货币');
    assert.ok(byDia[0].cost.diamond >= 10, `${slot} 最便宜的也要 10 钻`);
    for (let i = 1; i < 5; i++) assert.ok(byDia[i].cost.diamond > byDia[i - 1].cost.diamond, slot);
  }
  // 没有钻石就买不了：钻石不够、金币再多也不行
  const poor = P.newSave();
  P.maxResources(poor);
  poor.diamond = 9;
  const dia = Object.keys(D.equipment).find((id) => D.equipment[id].cost.diamond);
  assert.ok(!P.buyEquip(poor, dia), '9 钻买不起 10 钻的装备');
  poor.diamond = D.equipment[dia].cost.diamond;
  assert.ok(P.buyEquip(poor, dia));
  assert.strictEqual(poor.diamond, 0);
});

test('装备穿戴：买了自动穿（栏位空着时），否则点"穿戴"换上；卸下、出售都正确；新栏位盔甲和鞋子', () => {
  const s = P.newSave();
  P.maxResources(s);
  assert.ok('armor' in s.loadout.equip && 'boots' in s.loadout.equip);
  assert.ok(P.buyEquip(s, 'g_armor_1_0'));
  assert.strictEqual(s.loadout.equip.armor, 'g_armor_1_0');
  assert.ok(P.buyEquip(s, 'g_armor_2_0'));
  assert.strictEqual(s.loadout.equip.armor, 'g_armor_1_0', '栏位占着时不自动换');
  assert.ok(P.wearEquip(s, 'g_armor_2_0'));
  assert.strictEqual(s.loadout.equip.armor, 'g_armor_2_0', '点穿戴换上新的');
  assert.ok(P.wornEquip(s).includes('g_armor_2_0') && !P.wornEquip(s).includes('g_armor_1_0'));
  P.unwearEquip(s, 'g_armor_2_0');
  assert.strictEqual(s.loadout.equip.armor, null);
  // 饰品三个栏位：先放空位，满了换第 1 个
  const tr = Object.keys(D.equipment).filter((id) => D.equipment[id].slot === 'trinket').slice(0, 4);
  for (const id of tr) P.buyEquip(s, id);
  assert.deepStrictEqual([s.loadout.equip.trinket1, s.loadout.equip.trinket2, s.loadout.equip.trinket3], tr.slice(0, 3));
  assert.ok(P.wearEquip(s, tr[3]));
  assert.strictEqual(s.loadout.equip.trinket1, tr[3]);
  // 出售：穿着的会被卸下，钱退一半
  const before = s.copper;
  assert.ok(P.sellEquip(s, tr[3]));
  assert.strictEqual(s.loadout.equip.trinket1, null);
  assert.ok(s.copper > before && !s.equipOwned[tr[3]]);
  assert.ok(!P.wearEquip(s, tr[3]), '卖掉的穿不上');
  // 老存档没有 armor / boots 栏位：迁移后补上
  const old = P.newSave();
  delete old.loadout.equip.armor;
  delete old.loadout.equip.boots;
  assert.ok('armor' in P.migrate(old).loadout.equip);
});

test('装备属性生效：盔甲加城墙血量和减伤；效果叠加有上限', () => {
  const s = P.newSave();
  P.maxResources(s);
  const base = P.heroStats(s);
  const a = D.equipment.g_armor_5_0;
  P.buyEquip(s, 'g_armor_5_0');
  const st = P.heroStats(s);
  assert.ok(Math.abs(st.wallMax / base.wallMax - (1 + a.stats.wallHpPct)) < 0.01);
  // 同一种效果叠到上限：6 件减冷却的金色装备也不会把冷却降到 −60% 以下
  for (const id of Object.keys(D.equipment)) if (D.equipment[id].mods && D.equipment[id].mods.cdMult && D.equipment[id].rarity >= 4) P.buyEquip(s, id);
  for (const k of ['cape', 'trinket1', 'trinket2', 'trinket3', 'boots']) {
    const id = Object.keys(D.equipment).find((x) => s.equipOwned[x] && D.equipment[x].mods && D.equipment[x].mods.cdMult && !P.wornEquip(s).includes(x));
    if (id) s.loadout.equip[k] = id;
  }
  assert.ok(P.equipMods(s).cdMult >= -0.6 - 1e-9);
});

test('等级上限 999999：原来的上限以内费用不变，超出以后费用越来越高、越来越多用银币金币钻石', () => {
  assert.strictEqual(D.levelCap, 999999);
  // 基础上限以内：和以前一样的铜币
  assert.deepStrictEqual(P.attrCostAt('atk', 0), { copper: D.attributeCost('atk', 0) });
  assert.deepStrictEqual(P.attrCostAt('atk', 29), { copper: D.attributeCost('atk', 29) });
  // 超出以后：单调上升，货币档位依次是铜 → 银 → 金 → 钻石，满级没有下一级
  let last = 0;
  const kinds = [];
  for (const lv of [30, 31, 50, 100, 300, 1000, 5000, 20000, 999998]) {
    const c = P.attrCostAt('atk', lv);
    const v = P.costValue(c);
    assert.ok(v > last, `Lv${lv}`);
    last = v;
    kinds.push(Object.keys(c)[0]);
  }
  assert.deepStrictEqual([...new Set(kinds)], ['copper', 'silver', 'gold', 'diamond']);
  assert.strictEqual(P.attrCostAt('atk', 999999), null);
  assert.strictEqual(P.wallCostAt('level', 999999), null);
});

test('满级数值不会爆：属性、武器、城墙都升到 999999 级，战斗属性仍是有限数，攻速、减伤有上限', () => {
  const s = P.newSave();
  for (const k of Object.keys(s.attrs)) s.attrs[k] = D.levelCap;
  s.wall = { level: D.levelCap, fortify: D.levelCap, mend: D.levelCap, thorns: D.levelCap };
  s.weapons.bow.lv = D.levelCap;
  const st = P.heroStats(s);
  for (const k of ['atk', 'aspd', 'crit', 'critDmg', 'luck', 'wallMax', 'wallDr', 'mend', 'thorns', 'weaponMult']) assert.ok(Number.isFinite(st[k]) && st[k] >= 0, k);
  assert.ok(st.aspd <= 20 && st.crit <= 1 && st.luck <= 10 && st.wallDr <= 0.75 && st.mend <= 0.5);
  assert.ok(st.atk > 5e5 && st.wallMax > 1e8);
  // 基础上限以内的数值没变（第 30 级攻击力、第 30 级城墙）
  const s2 = P.newSave();
  s2.attrs.atk = 30;
  assert.strictEqual(P.heroStats(s2).atk, 10 + 30 * 2);
  s2.wall.level = 30;
  assert.strictEqual(P.heroStats(s2).wallMax, Math.round(1000 * Math.pow(1.1, 29)));
  // 能打：满级存档跑 20 秒战斗不出 NaN
  const b = new TD.Battle({ level: 1, stats: st, loadout: P.battleLoadout(s), seed: 1 });
  for (let i = 0; i < 60 * 20 && !b.over; i++) b.step(1 / 60);
  assert.ok(Number.isFinite(b.wall.hp) && b.time > 0);
});

test('批量升级：+10 / +100 / 最大；钱不够就升到买得起为止，dry 只算不买', () => {
  const s = P.newSave();
  s.copper = 100000;
  const dry = P.bulkUpgrade(s, 'attr', 'atk', 10, { dry: true });
  assert.strictEqual(dry.count, 10);
  assert.strictEqual(s.copper, 100000);
  assert.strictEqual(s.attrs.atk, 0);
  const r = P.bulkUpgrade(s, 'attr', 'atk', 10);
  assert.strictEqual(r.count, 10);
  assert.strictEqual(s.attrs.atk, 10);
  assert.strictEqual(s.copper, 100000 - r.cost.copper);
  // 和一级一级买花的钱完全一样
  const t = P.newSave();
  t.copper = 100000;
  for (let i = 0; i < 10; i++) P.buyAttr(t, 'atk');
  assert.strictEqual(t.copper, s.copper);
  // 最大：买到买不起为止，剩下的钱不够下一级
  const m = P.bulkUpgrade(s, 'attr', 'atk', Infinity);
  assert.ok(m.count > 0);
  assert.ok(!P.canAfford(s, P.attrCost(s, 'atk')));
  // 没钱：什么也不升
  const poor = P.newSave();
  assert.strictEqual(P.bulkUpgrade(poor, 'weapon', 'bow', 5).count, 0);
  // 武器、城墙、技能同样可批量
  const rich = P.newSave();
  P.maxResources(rich);
  rich.activeOwned.thunder = true;
  rich.skillLv.thunder = 3;
  assert.strictEqual(P.bulkUpgrade(rich, 'weapon', 'bow', 25).count, 20, '绿色武器最多升到 20 级');
  assert.strictEqual(rich.weapons.bow.lv, 20);
  assert.strictEqual(P.bulkUpgrade(rich, 'wall', 'level', 40).count, 40);
  assert.strictEqual(rich.wall.level, 41);
  assert.strictEqual(P.bulkUpgrade(rich, 'skill', 'thunder', 10).count, 10);
  assert.strictEqual(rich.skillLv.thunder, 13);
});

test('技能 Lv3 以后继续变强，战斗里也用升级后的数值；机器人只买到基础上限（战役标定不变）', () => {
  const d3 = P.skillDef('thunder', 3);
  const d20 = P.skillDef('thunder', 20);
  assert.ok(d20.atkMult > d3.atkMult && d20.cd < d3.cd && d20.cd >= D.activeSkills.thunder.cd * 0.5);
  const a3 = P.skillDef('arrowRain', 3);
  assert.ok(P.skillDef('arrowRain', 30).arrows > a3.arrows);
  const heal = P.skillDef('repair', 999999);
  assert.ok(heal.healRatio <= 1 && Number.isFinite(heal.cd));
  const s = P.newSave();
  s.activeOwned.thunder = true;
  s.skillLv.thunder = 20;
  s.loadout.active = ['thunder', null, null];
  const b = new TD.Battle({ level: 1, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  assert.strictEqual(b.skills[0].def.atkMult, d20.atkMult);
  // 机器人不会买过基础上限
  const bot = P.newSave();
  P.maxResources(bot);
  for (let n = 1; n <= 30; n++) bot.levels[n] = { stars: 3, clears: 1 };
  TD.bot.shop(bot);
  for (const k of Object.keys(D.attributes)) assert.ok(bot.attrs[k] <= D.attributes[k].max, k);
  assert.ok(bot.wall.level <= D.wallUpgrades.level.max && bot.weapons.bow.lv <= D.weaponUpgrade.max);
});

// ---------- v0.69：九层妖塔——每波恢复城墙、数量 ×2、每层属性成长（设计书 77） ----------
test('九层妖塔：每上一层怪物属性都变强（×grow）；每层的城墙血量接着上一层，不会恢复', () => {
  const s = P.newSave();
  clearUpTo(s, 100);
  assert.ok(D.tower.bossPerFloor === 20 && D.tower.minionPerFloor === 180);
  for (let k = 2; k <= 9; k++) {
    const r = TD.modes.towerD(s, k) / TD.modes.towerD(s, k - 1);
    assert.ok(Math.abs(r - k / (k - 1)) < 1e-9, `第 ${k} 层是第 1 层的 ${k} 倍`);
    // 战斗里每一波都用本层的系数
    for (const w of TD.modes.buildTower(s, k).waves) assert.ok(Math.abs(w.D - TD.modes.towerD(s, k)) < 1e-9);
  }
  const st = P.heroStats(s);
  const mk = (def) => new TD.Battle({ level: 'tower', levelDef: def, stage: 100, stats: st, loadout: P.battleLoadout(s), seed: 1 });
  s.gold = 5;
  assert.ok(TD.modes.towerStart(s));
  // 第 1 层：满血开始
  const b1 = mk(TD.modes.buildTower(s, 1));
  assert.strictEqual(b1.wall.hp, b1.wall.max);
  // 打完第 1 层城墙剩 50% → 选"继续" → 第 2 层从 50% 开始，不恢复
  b1.hitWall(b1.wall.max * 0.5, null);
  const ratio = b1.wall.hp / b1.wall.max;
  assert.ok(Math.abs(ratio - 0.5) < 1e-6);
  const res = TD.modes.applyTowerResult(s, { win: true, wallRatio: ratio, kills: 1 });
  assert.ok(res.win && !res.final);
  assert.ok(TD.modes.towerContinue(s));
  const def2 = TD.modes.buildTower(s, 2);
  assert.ok(Math.abs(def2.startWallRatio - 0.5) < 1e-6);
  const b2 = mk(def2);
  assert.ok(Math.abs(b2.wall.hp / b2.wall.max - 0.5) < 0.001, '第 2 层从 50% 开始');
  // 第 2 层又掉到 20% → 第 3 层从 20% 开始
  b2.hitWall(b2.wall.hp - b2.wall.max * 0.2, null);
  TD.modes.applyTowerResult(s, { win: true, wallRatio: b2.wall.hp / b2.wall.max, kills: 1 });
  TD.modes.towerContinue(s);
  assert.ok(Math.abs(mk(TD.modes.buildTower(s, 3)).wall.hp / b2.wall.max - 0.2) < 0.001);
  // 领钻石走人后重新挑战：又是满血；妖塔里每清一波也不会回满（只有修缮这类效果能回血）
  TD.modes.towerCashOut(s);
  s.gold = 5;
  TD.modes.towerStart(s);
  assert.strictEqual(TD.modes.buildTower(s, 1).startWallRatio, 1);
  const t = mk(TD.modes.buildTower(s, 1));
  t.hitWall(t.wall.max * 0.5, null);
  const hurt = t.wall.hp;
  t.waveIndex = 0;
  t.endWaveHeal();
  assert.ok(t.wall.hp < t.wall.max * 0.99 && t.wall.hp >= hurt);
  // 普通关卡不受影响
  assert.strictEqual(mk(D.levels[10]).wall.hp, st.wallMax);
});

test('角色衣柜：选了角色（或买下）城墙上就换成这个角色，别的英雄在场时自动换回 Kael', () => {
  const s = P.newSave();
  clearUpTo(s, 20);
  s.gold = 20;
  s.hero = 'ding';
  assert.strictEqual(P.heroId(s), 'ding');
  assert.ok(P.buyOutfit(s, 'pirate'));
  assert.strictEqual(s.outfit, 'pirate');
  assert.strictEqual(P.heroId(s), 'dang', '买下后由 Kael 出战');
  s.hero = 'ding';
  assert.ok(P.setOutfit(s, 'classic'));
  assert.strictEqual(P.heroId(s), 'dang');
  assert.ok(!P.setOutfit(s, 'mage'), '没买的穿不上');
  // 战斗画面传给英雄的就是衣柜里选的角色
  assert.strictEqual(s.outfit, 'classic');
});

test('武器的特效颜色跟武器品质走：每把武器发出的弹道都是自己品质的颜色', () => {
  const colors = new Set();
  for (const id of Object.keys(D.weapons)) {
    const s = P.newSave();
    s.weapons[id].owned = true;
    s.loadout.weapon = id;
    const b = new TD.Battle({ level: 1, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
    b.spawnMonster('slime', 0, 400);
    b.hero.cooldown = 0;
    b.updateHero(1 / 60);
    const p = b.projectiles[0];
    assert.ok(p, `${id} 开火后有弹道`);
    const want = D.weaponRarity[D.weapons[id].rarity || 1].color;
    assert.strictEqual(p.tint, want, id);
    colors.add(p.tint);
  }
  assert.strictEqual(colors.size, 5, '五档品质五种颜色');
});

test('九层妖塔：越往上妖王的比例越高，第 1 层 10%、第 9 层 50%，每层总数仍是 200N', () => {
  const share = (k) => TD.modes.towerCounts(k).share;
  assert.ok(Math.abs(share(1) - 0.1) < 1e-9);
  assert.ok(Math.abs(share(9) - 0.5) < 1e-9);
  for (let k = 2; k <= 9; k++) assert.ok(share(k) > share(k - 1), `第 ${k} 层比第 ${k - 1} 层妖王更多`);
  assert.deepStrictEqual([1, 9].map((k) => TD.modes.towerCounts(k).boss), [20, 900]);
  assert.strictEqual(TD.modes.towerCounts(9).minion, 900);
  // 真的按这个比例出怪（3 波加起来）
  const s = P.newSave();
  clearUpTo(s, 70);
  for (const k of [1, 5, 9]) {
    let boss = 0;
    let all = 0;
    for (const w of TD.modes.buildTower(s, k).waves)
      for (const [t, n] of w.groups) {
        all += n;
        if (D.monsters[t].boss) boss += n;
      }
    assert.ok(Math.abs(boss / all - share(k)) < 0.01, `第 ${k} 层实际妖王占 ${(boss / all).toFixed(3)}`);
  }
});

// ---------- v0.76：汇兑所档位、主线多出的小怪（设计书 84、85） ----------
test('汇兑所：一次可换 1 / 10 / 100 / 1000，铜换银、银换金都按档位', () => {
  assert.deepStrictEqual(TD.config.exchange.amounts, [1, 10, 100, 1000]);
  const s = P.newSave();
  s.copper = 100 * 1000;
  assert.ok(P.exchange(s, 'copper', 1000));
  assert.strictEqual(s.copper, 0);
  assert.strictEqual(s.silver, 1000);
  assert.ok(!P.exchange(s, 'copper', 1), '铜币不够不能换');
  assert.ok(P.exchange(s, 'silver', 10));
  assert.strictEqual(s.silver, 0);
  assert.strictEqual(s.gold, 10);
  assert.ok(!P.exchange(s, 'silver', 10), '银币不够不能换');
});

function queuedTotals(n, opts) {
  const s = P.newSave();
  const b = new TD.Battle(Object.assign({ level: n, stats: P.heroStats(s), seed: 5, loadout: { active: [], items: [] } }, opts));
  const types = {};
  let minions = 0;
  let bosses = 0;
  for (let i = 0; i < b.level.waves.length; i++) {
    b.startWave(i);
    for (const t of b.spawnQueue) {
      if (t[0] === '@') continue; // 回归的小 Boss（设计书 110）另测
      types[t] = (types[t] || 0) + 1;
      if (D.monsters[t].boss) bosses++;
      else minions++;
    }
  }
  return { minions, bosses, types, b };
}

const baseCounts = (n) => {
  const lv = D.levels[n];
  const cm = lv.countMult || 1;
  return {
    minions: lv.waves.reduce((a, w) => a + w.groups.reduce((x, [t, c]) => x + (D.monsters[t].boss ? 0 : Math.max(1, Math.round(c * cm))), 0), 0),
    bosses: lv.waves.reduce((a, w) => a + w.groups.reduce((x, [t, c]) => x + (D.monsters[t].boss ? c : 0), 0), 0),
  };
};
const expectedExtra = (n) => (n < TD.config.extraFromLevel ? 0 : Math.round(n * TD.config.extraMonstersPerLevel * (D.levels[n].extraMult !== undefined ? D.levels[n].extraMult : 1)));

test('主线第 5 关起，第 N 关总共多出 N × 5 只小怪（和原有的同类怪一模一样），Boss 数量不变；前 4 关不加', () => {
  assert.strictEqual(TD.config.extraFromLevel, 5);
  assert.strictEqual(TD.config.extraMonstersPerLevel, 5);
  for (let n = 1; n <= 100; n++) {
    const base = baseCounts(n);
    const r = queuedTotals(n);
    assert.strictEqual(r.minions - base.minions, expectedExtra(n), `第 ${n} 关多出的小怪数`);
    assert.strictEqual(r.bosses, base.bosses, `第 ${n} 关 Boss 数量不变`);
  }
  assert.strictEqual(expectedExtra(4), 0);
  assert.strictEqual(expectedExtra(5), 25);
  assert.strictEqual(expectedExtra(100), 500);
});

test('多出来的小怪就是本关原有的小怪种类：不是 Boss、不是要停在远处或会影响别的怪的类型（本关没有可用的才借本章的）', () => {
  const deny = ['boss', 'towerOf', 'bossPart', 'ai', 'healer', 'ranged', 'chill', 'bubbler', 'fireZone', 'onDeath', 'staticShock', 'stealth'];
  for (const n of [5, 10, 30, 50, 65, 87, 100]) {
    const own = new Set(D.levels[n].waves.flatMap((w) => w.groups.map(([t]) => t)));
    for (const p of queuedTotals(n).b.extraPlan) {
      if (!p) continue;
      for (const [t] of p) {
        assert.ok(!deny.some((k) => D.monsters[t][k]), `第 ${n} 关的 ${t} 不该当小怪`);
        if ([...own].some((o) => !deny.some((k) => D.monsters[o][k]))) assert.ok(own.has(t), `第 ${n} 关多出的 ${t} 应该是本关原有的种类`);
      }
    }
  }
});

test('多出的小怪：只在主线关卡里加（自定义关卡不加），按各波原有数量比例分摊，且结果固定', () => {
  const a = queuedTotals(40).b.extraPlan;
  const b = queuedTotals(40).b.extraPlan;
  assert.deepStrictEqual(a, b);
  const custom = queuedTotals(40, { levelDef: Object.assign({}, D.levels[40]) });
  assert.strictEqual(custom.minions, baseCounts(40).minions, '自定义关卡（无尽、每日挑战、妖塔）不加');
  const cm = D.levels[40].countMult || 1;
  const sums = D.levels[40].waves.map((w) => w.groups.reduce((x, [t, c]) => x + (D.monsters[t].boss ? 0 : Math.max(1, Math.round(c * cm))), 0));
  const extra = a.map((p) => (p ? p.reduce((x, [, c]) => x + c, 0) : 0));
  const tot = sums.reduce((x, y) => x + y, 0);
  const want = expectedExtra(40);
  assert.strictEqual(extra.reduce((x, y) => x + y, 0), want);
  extra.forEach((e, i) => assert.ok(Math.abs(e - (want * sums[i]) / tot) <= 8, `第 ${i + 1} 波分摊`));
});

test('多出的小怪和原有的同类怪完全一样：血量、伤害、铜币都不打折，会停在城墙前啃', () => {
  const s = P.newSave();
  const b = new TD.Battle({ level: 3, stats: P.heroStats(s), seed: 9, loadout: { active: [], items: [] } });
  const m = b.spawnMonster('bunny', 1, TD.config.wallX + 5);
  assert.strictEqual(m.maxHp, Math.round(D.monsters.bunny.hp * b.D), '血量和原有的一样');
  b.heroStunUntil = 1e9; // 英雄不出手，只看怪自己的行为
  const hp0 = b.wall.hp;
  for (let i = 0; i < 60 * 3; i++) b.step(1 / 60);
  assert.ok(!m.dead && b.wall.hp < hp0, '停在城墙前继续啃，不会消失');
  assert.ok(Math.abs(m.dps - D.monsters.bunny.dps * b.D) < 1e-9, '伤害和原有的一样');
});

// ---------- v0.78：普通关卡不给银币、装备和被动技能涨价（设计书 88、89） ----------
test('普通关卡不给银币：首次通关、首次三星、王冠都没有银；关卡任务改给 200 铜', () => {
  const ordinary = Object.keys(D.levels).map(Number).filter((n) => !P.givesSilver(D.levels[n]));
  assert.ok(ordinary.length > 60, '大部分关卡是普通关卡');
  const s = P.newSave();
  for (const n of ordinary.filter((_, i) => i % 5 === 0)) {
    const r = P.applyResult(s, n, { win: true, wallRatio: 1, killCopper: 0, earlyCopper: 0, itemsUsed: [] });
    assert.strictEqual(r.silver, 0, `第 ${n} 关（${D.levels[n].type}）首通不给银`);
    assert.strictEqual(r.gold, 0);
  }
  assert.strictEqual(TD.data.missionReward.copper, 200);
  // 关卡任务：普通关卡给铜币，不给银币（第 3 关起有任务；"轻装上阵"之外的任务这里用 earlyCalls / minWallRatio 满足）
  const n = ordinary.find((k) => k >= 3 && D.missionFor(k) && D.missionFor(k) !== 'interrupt2');
  const m = P.newSave();
  const base = Math.round(TD.config.rewards.baseCopper(n) * 1.5);
  const r = P.applyResult(m, n, { win: true, wallRatio: 1, killCopper: 0, earlyCopper: 0, itemsUsed: [], earlyCalls: 5, minWallRatio: 1 });
  assert.ok(m.levels[n].mission, `第 ${n} 关的任务应该完成`);
  assert.strictEqual(r.silver, 0, '任务奖励不是银币');
  assert.strictEqual(r.copper, base + 200, '任务奖励 200 铜');
  assert.ok(r.notes.some((x) => x.includes('+200 铜')));
  // 特殊关卡的任务还是 2 银
  const sp = Number(Object.keys(D.levels).find((k) => D.levels[k].type === 'miniboss'));
  const t = P.newSave();
  clearUpTo(t, sp - 1);
  const rs = P.applyResult(t, sp, { win: true, wallRatio: 1, killCopper: 0, earlyCopper: 0, itemsUsed: [], interrupts: 5 });
  assert.ok(rs.notes.some((x) => x.includes('+2 银')), '小 Boss 关的任务给 2 银');
});

test('银币只在首次通关小 Boss、大 Boss、精英挑战关时给', () => {
  for (const type of ['miniboss', 'boss', 'elite']) {
    const n = Number(Object.keys(D.levels).find((k) => D.levels[k].type === type));
    assert.ok(P.givesSilver(D.levels[n]), type);
    const s = P.newSave();
    clearUpTo(s, n - 1);
    const r = P.applyResult(s, n, { win: true, wallRatio: 1, killCopper: 0, earlyCopper: 0 });
    assert.ok(r.silver > 0, `${type} 首通有银`);
  }
});

test('装备和被动技能涨价：价格 = 原价 × 倍数（装备 绿 6 / 蓝 6 / 紫 4 / 红 10 / 金 30（金币）、3（钻石），武器蓝色 4.5、红 10、金 30，被动 8）', () => {
  assert.deepStrictEqual(D.priceMult, { gear: { 1: 6, 2: 6, 3: 4, 4: 10, 5: { gold: 30, diamond: 3 } }, weapon: { 1: 6, 2: 4.5, 3: 4, 4: 10, 5: 30 }, passive: 8 });
  // 红色装备用金币，价格 ×10；金色装备每类第 1 件用金币（×30），其余用钻石（×3）
  for (const e of Object.values(D.equipment).filter((x) => x.rarity === 4 && x.gen)) assert.ok(e.cost.gold >= 50 && Object.keys(e.cost).join() === 'gold', e.name + ' 红色装备要用金币且 ≥ 50');
  for (const e of Object.values(D.equipment).filter((x) => x.rarity === 5 && x.gen)) assert.ok(e.cost.diamond ? e.cost.diamond >= 30 : e.cost.gold >= 500, e.name + ' 金色装备价格');
  assert.deepStrictEqual(D.weapons.staff.cost, { silver: 36 }, 'v1.10：蓝色武器单独便宜（魔法杖原价 8 银 × 4.5）');
  assert.strictEqual(D.equipment.ironHelm.cost.copper, 720, '铁头盔原价 120 铜');
  assert.deepStrictEqual(D.passiveSkills.precision.cost, { silver: 24 }, '精准原价 3 银');
  assert.deepStrictEqual(D.passiveSkills.combo.cost, { silver: 32 });
  assert.deepStrictEqual(D.weapons.crossbow.cost, { copper: 1800 }, '连发弩原价 300 铜');
  assert.deepStrictEqual(D.weapons.genesisBow.cost, { gold: 600 }, 'v1.15：金色武器原价 20 金 × 30');
  assert.deepStrictEqual(D.weapons.meteorCannon.cost, { gold: 80 }, 'v1.15：红色武器原价 8 金 × 10');
  // 金色装备除了每类第 1 件，其余仍然只用钻石，最便宜的比以前更贵
  const diamonds = Object.values(D.equipment).filter((e) => e.rarity === 5 && e.cost.diamond).map((e) => e.cost.diamond);
  assert.ok(diamonds.length >= 25 && Math.min(...diamonds) >= 20);
  // 同一品质内价格仍然越来越贵、品质越高越贵
  const v = (e) => P.costValue(e.cost);
  const avg = (r) => Object.values(D.equipment).filter((e) => e.rarity === r).reduce((a, e) => a + v(e), 0) / Object.values(D.equipment).filter((e) => e.rarity === r).length;
  for (let r = 1; r < 5; r++) assert.ok(avg(r) < avg(r + 1), `品质 ${r} 比 ${r + 1} 便宜`);
});

// ---------- v0.79：被动技能可升级（设计书 90） ----------
test('被动技能买下来是 1 级、效果很弱；每升一级变强；10 级时和老版本的满效果差不多；之后每级提升变小', () => {
  const s = P.newSave();
  s.silver = 1000;
  for (const id of Object.keys(D.passiveSkills)) assert.strictEqual(P.passiveLevel(s, id), 0, '没买之前是 0 级');
  assert.ok(P.buyPassive(s, 'precision'));
  assert.strictEqual(P.passiveLevel(s, 'precision'), 1);
  const v = (id, lv) => P.passiveValue(id, lv);
  // 老版本的满效果：精准 +10%、连珠每 5 次（0.2）、灼烧 ×0.6、穿甲 50%
  const old = { precision: 0.1, combo: 0.2, burn: 0.6, pierceArmor: 0.5 };
  for (const id of Object.keys(old)) {
    assert.ok(v(id, 1) < old[id] * 0.3, `${id} 1 级只有老版本的三成不到`);
    for (let lv = 1; lv < 20; lv++) assert.ok(v(id, lv + 1) > v(id, lv), `${id} 越升越强`);
    assert.ok(Math.abs(v(id, 10) - old[id]) / old[id] < 0.15, `${id} 10 级和老版本差不多：${v(id, 10)}`);
    assert.ok(v(id, 100) > v(id, 10), '10 级以后还能继续变强');
    const eff = D.passiveSkills[id].eff;
    assert.ok(v(id, 11) - v(id, 10) < v(id, 10) - v(id, 9), `${id} 10 级以后每级提升变小`);
    assert.ok(v(id, 999999) <= eff.cap + 1e-9, '有上限');
  }
});

test('被动技能升级：花铜币（10 级以内）、越升越贵、10 级以后越来越贵；可以批量升；存档记等级', () => {
  const s = P.newSave();
  s.silver = 100;
  P.buyPassive(s, 'combo');
  const costs = [];
  for (let lv = 1; lv <= 12; lv++) costs.push(P.passiveCostAt('combo', lv));
  for (let i = 0; i < 9; i++) assert.ok(costs[i].copper, '10 级以内用铜币');
  for (let i = 1; i < costs.length; i++) assert.ok(P.costValue(costs[i]) > P.costValue(costs[i - 1]), `第 ${i + 1} 级比上一级贵`);
  assert.strictEqual(costs[0].copper, 600);
  s.copper = 600;
  assert.ok(P.upgradePassive(s, 'combo'));
  assert.strictEqual(P.passiveLevel(s, 'combo'), 2);
  assert.strictEqual(s.copper, 0);
  assert.ok(!P.upgradePassive(s, 'combo'), '钱不够不能升');
  assert.ok(!P.upgradePassive(s, 'burn'), '没买的不能升');
  s.copper = 1e6;
  const r = P.bulkUpgrade(s, 'passive', 'combo', 5);
  assert.strictEqual(r.count, 5);
  assert.strictEqual(P.passiveLevel(s, 'combo'), 7);
  assert.strictEqual(s.passiveLv.combo, 7);
});

test('被动技能的效果按等级算进英雄属性：精准加暴击、穿甲算无视护甲、连珠和灼烧进 DPS 估算', () => {
  const s = P.newSave();
  clearUpTo(s, 40);
  s.silver = 1000;
  const base = P.heroStats(s);
  const stat = (lv) => {
    for (const id of ['precision', 'combo', 'burn', 'pierceArmor']) {
      s.passiveOwned[id] = true;
      s.passiveLv[id] = lv;
    }
    s.loadout.passive = ['precision', 'combo', 'burn'];
    s.silver = 1000;
    return P.heroStats(s);
  };
  const a = stat(1);
  const b = stat(10);
  assert.ok(Math.abs(a.crit - (base.crit + P.passiveValue('precision', 1))) < 1e-9);
  assert.ok(Math.abs(b.crit - (base.crit + P.passiveValue('precision', 10))) < 1e-9);
  assert.ok(P.estimateDps(b) > P.estimateDps(a) && P.estimateDps(a) > P.estimateDps(base), '等级越高 DPS 越高');
  assert.ok(Math.abs(b.passiveVals.burn - P.passiveValue('burn', 10)) < 1e-9);
});

test('连珠按几率累计追加攻击；灼烧伤害跟着等级；穿甲无视护甲跟着等级', () => {
  const s = P.newSave();
  clearUpTo(s, 40);
  s.silver = 1000;
  for (const id of ['combo', 'burn', 'pierceArmor']) {
    s.passiveOwned[id] = true;
    s.passiveLv[id] = 1;
  }
  s.loadout.passive = ['combo', 'burn', 'pierceArmor'];
  const mk = () => new TD.Battle({ level: 3, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 4 });
  const count = (rate) => {
    const b = mk();
    b.stats.passiveVals.combo = rate;
    b.spawnMonster('slime', 1, 400);
    let combos = 0;
    b.on('combo', () => combos++);
    b.monsters.forEach((m) => (m.hp = m.maxHp = 1e12));
    for (let i = 0; i < 60 * 20; i++) b.step(1 / 60);
    return { combos, attacks: b.hero.attacks };
  };
  const r5 = count(0.5);
  assert.ok(Math.abs(r5.combos - r5.attacks * 0.5) <= 1.01, `几率 0.5：${r5.combos} / ${r5.attacks}`);
  const r2 = count(0.2);
  assert.ok(Math.abs(r2.combos - r2.attacks * 0.2) <= 1.01);
  const r2x = count(2);
  assert.ok(Math.abs(r2x.combos - r2x.attacks * 2) <= 1.01, '几率超过 1 时一次追加多次');
  const b = mk();
  assert.ok(Math.abs(b.armorIgnore({}) - P.passiveValue('pierceArmor', 1)) < 1e-9);
  b.stats.passiveVals.pierceArmor = P.passiveValue('pierceArmor', 10);
  assert.ok(Math.abs(b.armorIgnore({}) - P.passiveValue('pierceArmor', 10)) < 1e-9);
});

test('老存档里已经拥有的被动技能补成 10 级（效果和以前差不多）；新买的从 1 级开始', () => {
  const old = P.newSave();
  delete old.passiveLv;
  old.passiveOwned = { precision: true, burn: true };
  const m = P.migrate(old);
  assert.strictEqual(m.passiveLv.precision, 10);
  assert.strictEqual(m.passiveLv.burn, 10);
  assert.strictEqual(P.passiveLevel(m, 'combo'), 0);
  m.silver = 100;
  assert.ok(P.buyPassive(m, 'combo'));
  assert.strictEqual(m.passiveLv.combo, 1);
});

// ---------- v0.80：武器扩充到每个品质 5 把（设计书 91） ----------
test('新增的 10 把武器：每个品质 2 把、都有图标和外观、不重名、老存档自动补上', () => {
  const added = ['huntBow', 'mortar', 'twinCrossbow', 'galeBoomerang', 'thunderMortar', 'arcaneStaff', 'dragonBow', 'infernoStaff', 'worldCannon', 'starfallOrb'];
  assert.deepStrictEqual(added.map((id) => D.weapons[id].rarity), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  const names = Object.values(D.weapons).map((w) => w.name);
  assert.strictEqual(new Set(names).size, names.length, '武器不重名');
  for (const id of added) {
    const w = D.weapons[id];
    assert.ok(w.desc && w.good && w.cost && w.look && w.look.color, id);
    assert.ok(P.weaponUnlocked(P.newSave(), id), '随时可买');
  }
  const old = P.newSave();
  for (const id of added) delete old.weapons[id];
  const m = P.migrate(old);
  for (const id of added) assert.deepStrictEqual(m.weapons[id], { owned: false, lv: 0 });
});

test('新增武器都能上战场打一阵子：弹道、溅射、穿透、连锁、震退、点燃、双镖都正常，不报错', () => {
  const added = ['huntBow', 'mortar', 'twinCrossbow', 'galeBoomerang', 'thunderMortar', 'arcaneStaff', 'dragonBow', 'infernoStaff', 'worldCannon', 'starfallOrb'];
  for (const id of added) {
    const s = P.newSave();
    clearUpTo(s, 69);
    s.weapons[id] = { owned: true, lv: 0, asc: false };
    s.loadout.weapon = id;
    const b = new TD.Battle({ level: 41, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 3 });
    let shots = 0;
    b.on('shoot', () => shots++);
    for (let i = 0; i < 60 * 25; i++) b.step(1 / 60);
    assert.ok(shots > 3, `${id} 打出了 ${shots} 发`);
    assert.ok(b.damageDealt > 0, `${id} 造成了伤害`);
  }
});

test('每个新武器的效果和描述对得上：数值字段都在', () => {
  const W = D.weapons;
  assert.ok(W.huntBow.bonusCrit === 0.15 && W.huntBow.aspdMult > 1 && W.huntBow.dmgMult * W.huntBow.aspdMult > W.bow.dmgMult * W.bow.aspdMult);
  assert.ok(W.mortar.arc && W.mortar.splash);
  assert.ok(W.twinCrossbow.bolts === 2 && W.twinCrossbow.flyingMult === 1.3);
  assert.ok(W.galeBoomerang.boomerang && W.galeBoomerang.slow.amt === 0.25);
  assert.ok(W.thunderMortar.knock && W.thunderMortar.armorIgnore === 0.3);
  assert.ok(W.arcaneStaff.dmgType === 'magic' && W.arcaneStaff.bossMult === 1.2);
  assert.ok(W.dragonBow.pierce.count === 3 && W.dragonBow.bolts === 3 && W.dragonBow.bossMult === 1.5);
  assert.ok(W.infernoStaff.ignite && W.infernoStaff.dmgType === 'magic');
  assert.ok(W.worldCannon.armorIgnore === 0.8 && W.worldCannon.knock.dist === 70);
  assert.ok(W.starfallOrb.chain.count === 8 && W.starfallOrb.bonusCrit === 0.12);
});

// ---------- v1.07：武器重新设计（设计书 109） ----------
// 强度估值：单发伤害 × 攻速 × 一次几箭 × 范围收益 × 加成（炮弹慢、单发大，打折）
function weaponScoreOf(w) {
  const bolts = w.bolts || 1;
  const bn = w.boomerangs || (w.twin ? 2 : 1);
  let S = w.dmgMult * w.aspdMult * (bolts > 1 ? 1 + (bolts - 1) * (w.extraBoltMult || 0.5) : 1) * (w.boomerang ? 2 : 1) * (1 + (w.bonusCrit || 0));
  let aoe = 1;
  if (w.chain) for (let i = 1; i <= w.chain.count; i++) aoe += Math.pow(w.chain.falloff, i) * 0.3;
  if (w.splash) aoe += w.splash.mult * 0.9 * Math.min(1.8, Math.max(0.7, w.splash.radius / 75));
  if (bolts > 1) aoe += 0.05 + 0.1 * bolts;
  if (w.boomerang) aoe += 0.25 + 0.2 * (bn - 1);
  if (w.pierce) aoe += w.pierce.count * w.pierce.mult * 0.3;
  if (w.slow || w.ignite) aoe += 0.08;
  if (w.knock) aoe += 0.08;
  let m = 1;
  if (w.boomerang) m *= 1.6;
  if (w.armorIgnore) m *= 1 + w.armorIgnore * 0.4;
  if (w.bossMult) m *= 1 + (w.bossMult - 1) * 0.25;
  if (w.flyingMult) m *= 1 + (w.flyingMult - 1) * 0.1;
  if (w.dmgType === 'magic') m *= 1.1;
  if (w.arc) m *= 0.6;
  return S * aoe * m;
}

test('武器平衡：同品质的 5 把强度接近（最高 / 最低 ≤ 1.3），不同品质逐档拉开（下一档最弱的 ≥ 上一档最强的 1.3 倍）', () => {
  const byR = {};
  for (const id of Object.keys(D.weapons)) (byR[D.weapons[id].rarity] = byR[D.weapons[id].rarity] || []).push(weaponScoreOf(D.weapons[id]));
  for (let r = 1; r <= 5; r++) assert.ok(Math.max(...byR[r]) / Math.min(...byR[r]) <= 1.3, '品质 ' + r + ' 内部差距太大');
  for (let r = 1; r < 5; r++) assert.ok(Math.min(...byR[r + 1]) / Math.max(...byR[r]) >= 1.3, '品质 ' + (r + 1) + ' 和 ' + r + ' 差距不够');
});

test('多箭武器：寒霜弓 / 穿心长弓 / 屠龙弓 / 创世之弓默认 3 箭，升级后加箭；疾风镖 2 支、时之回旋 3 支', () => {
  const W = D.weapons;
  for (const id of ['frostBow', 'piercer', 'dragonBow', 'genesisBow']) assert.strictEqual(W[id].bolts, 3, id);
  const at = (id, lv) => {
    const s = P.newSave();
    s.weapons[id] = { owned: true, lv, asc: false };
    return P.weaponDef(s, id);
  };
  assert.strictEqual(at('frostBow', 5).bolts, 3);
  assert.strictEqual(at('frostBow', 6).bolts, 5);
  assert.strictEqual(at('piercer', 7).bolts, 3);
  assert.strictEqual(at('piercer', 8).bolts, 4);
  assert.strictEqual(at('dragonBow', 8).bolts, 4);
  assert.deepStrictEqual([0, 4, 5, 9, 10].map((lv) => at('genesisBow', lv).bolts), [3, 3, 4, 4, 5]);
  // 加箭以后单发伤害降一点，总输出只涨一截（同品质不会被甩开）
  assert.ok(at('frostBow', 6).dmgMult < at('frostBow', 5).dmgMult);
  assert.ok(weaponScoreOf(at('frostBow', 6)) > weaponScoreOf(at('frostBow', 5)) && weaponScoreOf(at('frostBow', 6)) < weaponScoreOf(at('frostBow', 5)) * 1.3);
  // 开火：一次射出对应数量的箭，分别射向不同目标
  const b = weaponBattle('frostBow');
  const ms = [500, 540, 580, 620, 660].map((x, i) => {
    const m = b.spawnMonster('slime', i % 2, x);
    m.hp = m.maxHp = 1e9;
    return m;
  });
  b.fire(ms);
  assert.strictEqual(b.projectiles.filter((p) => p.kind === 'arrow').length, b.weaponDef().bolts);
  assert.strictEqual(new Set(b.projectiles.map((p) => p.target.id)).size, b.weaponDef().bolts, '箭射向不同的怪');
  // 回旋镖：疾风镖默认 2 支，时之回旋 3 支（目标车道 + 相邻车道）
  const count = (id) => {
    const bb = weaponBattle(id);
    const t = bb.spawnMonster('slime', 1, 500);
    t.hp = t.maxHp = 1e9;
    bb.fire([t]);
    return bb.projectiles.filter((p) => p.kind === 'boomerang').map((p) => p.lane);
  };
  assert.strictEqual(count('galeBoomerang').length, 2);
  assert.deepStrictEqual(new Set(count('chronoBoomerang')).size, 3);
  assert.strictEqual(count('boomerang').length, 1);
});

test('土炮：爆炸范围比原来大、一发更狠', () => {
  const m = D.weapons.mortar;
  assert.ok(m.splash.radius >= 90 && m.splash.mult >= 0.6 && m.dmgMult > 4.4);
  const b = weaponBattle('mortar');
  const t = b.spawnMonster('slime', 0, 500);
  const near = b.spawnMonster('slime', 0, 500 + 85);
  const far = b.spawnMonster('slime', 0, 500 + 140);
  for (const x of [t, near, far]) x.hp = x.maxHp = 1e9;
  b.splashAt(t.x, t.y + t.yOffset, { dmg: 100, splash: m.splash, dmgType: 'phys', armorIgnore: 0 }, t);
  assert.ok(near.hp < near.maxHp, '85 像素内的怪被炸到');
  assert.ok(far.hp === far.maxHp, '140 像素外的怪没事');
});

// ---------- v0.81：主角动作随武器、技能变化（设计书 92） ----------
test('主角动作：每种武器出手前后的姿势各不相同', () => {
  require('../src/render/heroanim.js');
  const H = TD.heroAnim;
  const pose = (weapon, extra) => H.pose(Object.assign({ t: 0, weapon, mood: 'focus', shotAge: 5, readyIn: 0 }, extra), -0.1);
  for (const w of ['bow', 'crossbow', 'staff', 'orb', 'cannon', 'boomerang']) {
    const idle = pose(w);
    const wind = pose(w, { readyIn: 0.05 });
    const rel = pose(w, { shotAge: 0.03 });
    assert.ok(wind.wind > 0.5 && rel.rel > 0.5, w);
    // 蓄力和出手时身体或手臂的姿势一定和站着不动时不同
    const moved = (p) => Math.abs(p.torso - idle.torso) + Math.abs(p.dx - idle.dx) + Math.abs(p.arm - idle.arm) + Math.abs(p.dy - idle.dy);
    assert.ok(moved(wind) > 0.02 || moved(rel) > 0.02, w);
    assert.ok(moved(rel) > 0.05, w + ' 出手要有明显动作');
  }
  // 弓拉开、炮后坐、回旋镖甩臂
  assert.ok(pose('bow', { readyIn: 0.02 }).draw > 0.8);
  assert.ok(pose('cannon', { shotAge: 0.02 }).dx < -3);
  assert.ok(pose('boomerang', { readyIn: 0.02 }).arm < -1);
  // 所有武器都能在不同的出手进度下算出有限的数
  for (const id of Object.keys(D.weapons)) for (const readyIn of [0, 0.1, 0.5]) for (const shotAge of [0, 0.1, 0.3, 2]) {
    const p = pose(id, { readyIn, shotAge });
    for (const k of ['torso', 'dx', 'dy', 'arm', 'jump']) assert.ok(Number.isFinite(p[k]), id + k);
  }
  // 没有出手信息（标题、剧情里的主角）和输赢状态不受影响
  assert.strictEqual(H.pose({ t: 1, weapon: 'bow', mood: 'win' }, 0).wind, 0);
  assert.strictEqual(H.pose({ t: 1, weapon: 'bow', mood: 'focus' }, 0).cast, null);
});

test('主角动作：5 个技能各有不同的施法姿势，施法结束后恢复', () => {
  require('../src/render/heroanim.js');
  const H = TD.heroAnim;
  const ids = Object.keys(D.activeSkills);
  assert.deepStrictEqual(Object.keys(H.CAST_DUR).sort(), ids.slice().sort(), '每个主动技能都有施法时长');
  const at = (id, a) => H.pose({ t: 0, weapon: 'staff', mood: 'focus', shotAge: 5, readyIn: 0, castId: id, castAge: a, castAim: 0.2 }, -0.1);
  const sig = (p) => [p.arm, p.torso, p.dx, p.dy, p.jump].map((v) => v.toFixed(2)).join(',');
  const seen = new Set();
  for (const id of ids) {
    const mid = at(id, id === 'thunder' ? 0.4 : 0.5);
    assert.strictEqual(mid.cast, id);
    assert.ok(mid.castBlend > 0.9, id);
    seen.add(sig(mid));
    const done = at(id, H.CAST_DUR[id] + 0.1);
    assert.strictEqual(done.cast, null, id + ' 施法结束后恢复');
    // 动作的开头和结尾平滑过渡（不突然跳变）
    assert.ok(Math.abs(at(id, 0).arm - at(id, 0.001).arm) < 0.05, id);
    assert.ok(Math.abs(at(id, H.CAST_DUR[id] - 0.001).arm - at(id, H.CAST_DUR[id] + 0.001).arm) < 0.1, id);
  }
  assert.strictEqual(seen.size, ids.length, '5 个技能的姿势互不相同');
  // 具体姿势：箭雨和雷霆举向天空，修复弯腰按向城墙，战鼓跳起，冰冻朝车道横扫
  assert.ok(at('arrowRain', 0.5).arm < -1.2 && at('thunder', 0.4).arm < -1.2);
  assert.ok(at('repair', 0.6).arm > 0.8 && at('repair', 0.6).dy > 3);
  assert.ok(at('drum', 0.3).jump < -5);
  assert.ok(Math.abs(at('frost', 0.7).arm - 0.3) < 0.15, '冰冻领域朝选定的车道');
});

test('主角动作：光效函数在各种时刻都能画出来而不出错', () => {
  require('../src/render/heroanim.js');
  const H = TD.heroAnim;
  let calls = 0;
  const ctx = new Proxy(function () {}, {
    get: (t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => void calls++),
    set: () => true,
  });
  const K = (TD.creatures = TD.creatures || {});
  for (const k of ['glow', 'dot', 'veins', 'sparkles']) K[k] = K[k] || (() => void calls++);
  K.rgba = K.rgba || ((c, a) => `rgba(${c},${a})`);
  for (const id of Object.keys(H.CAST_DUR)) {
    for (const layer of ['back', 'front']) for (let a = 0; a < H.CAST_DUR[id]; a += 0.1) H.fx(ctx, 100, 200, id, a, a * 3, layer);
    const P = H.pose({ t: 0, weapon: 'bow', mood: 'focus', shotAge: 5, readyIn: 0, castId: id, castAge: 0.4 }, 0);
    H.tipFx(ctx, P, 32, 1.2);
  }
  assert.ok(calls > 100);
  // 没有施法或施法结束：什么也不画
  const before = calls;
  H.fx(ctx, 0, 0, undefined, 0, 0, 'back');
  H.fx(ctx, 0, 0, 'thunder', 99, 0, 'front');
  assert.strictEqual(calls, before);
});

test('战斗里放技能会记下施法动作所需的信息', () => {
  const save = P.newSave();
  save.activeOwned.frost = true;
  save.loadout.active = ['frost'];
  const b = new TD.Battle({ level: 3, stats: P.heroStats(save), loadout: P.battleLoadout(save), seed: 1 });
  assert.strictEqual(b.hero.castId, null);
  for (let i = 0; i < 3000 && b.waveState === 'prepare'; i++) b.step(1 / 60);
  b.skills[0].cd = 0;
  assert.ok(b.castSkill(0, 1));
  assert.strictEqual(b.hero.castId, 'frost');
  assert.strictEqual(b.hero.castLane, 1);
  assert.ok(Math.abs(b.hero.castAt - b.time) < 1e-9);
});

// ---------- v0.83：雷霆一击连劈多道雷（设计书 94） ----------
test('雷霆一击：1 级就是 3 道雷，等级越高道数越多，上限 15', () => {
  const n = (lv) => P.skillDef('thunder', lv).strikes;
  assert.deepStrictEqual([n(1), n(2), n(3)], [3, 4, 5]);
  assert.strictEqual(n(4), 5);
  assert.strictEqual(n(8), 6);
  assert.strictEqual(n(13), 7);
  assert.ok(n(20) > n(8) && n(60) > n(20));
  assert.strictEqual(n(500), 15);
  assert.strictEqual(n(D.levelCap), 15);
  // 其他技能没有道数
  assert.strictEqual(P.skillDef('arrowRain', 1).strikes, undefined);
});

function thunderBattle(lv, monsters) {
  const s = P.newSave();
  s.activeOwned.thunder = true;
  s.skillLv.thunder = lv;
  s.loadout.active = ['thunder', null, null];
  const b = new TD.Battle({ level: 1, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  b.waveState = 'final';
  const ms = monsters.map(([type, x], i) => b.spawnMonster(type, i % 3, x));
  for (const m of ms) m.hp = m.maxHp = 1e9;
  b.time = 1;
  return { b, ms };
}

test('雷霆一击：连续落下对应道数的雷，第一道马上落下，其余隔一会儿，尽量各劈不同的怪', () => {
  for (const lv of [1, 2, 3]) {
    const { b, ms } = thunderBattle(lv, [['goblin', 600], ['goblin', 640], ['goblin', 680], ['goblin', 720], ['goblin', 760], ['goblin', 800]]);
    ms[3].hp = 2e9; // 血量最高的先挨第一道
    const hits = [];
    b.on('thunder', (e) => hits.push({ x: e.x, idx: e.idx, t: b.time }));
    assert.ok(b.castSkill(0));
    assert.strictEqual(hits.length, 1, '第一道马上落下');
    assert.strictEqual(hits[0].x, ms[3].x);
    assert.strictEqual(b.hero.castStrikes, 2 + lv);
    assert.ok(b.hero.castEvery > 0 && b.hero.castEvery <= 0.22);
    for (let i = 0; i < 120; i++) b.step(1 / 60);
    assert.strictEqual(hits.length, 2 + lv, `${lv} 级共 ${2 + lv} 道雷`);
    assert.deepStrictEqual(hits.map((h) => h.idx), [...Array(2 + lv).keys()]);
    assert.strictEqual(new Set(hits.map((h) => h.x)).size, 2 + lv, '怪够多时每道雷劈不同的怪');
    assert.ok(hits[hits.length - 1].t - hits[0].t > 0.3 && hits[hits.length - 1].t - hits[0].t < 1.3);
    assert.strictEqual(b.thunderQ, null);
  }
});

test('雷霆一击：怪不够多时重复劈血量最高的，没有怪时不放', () => {
  const { b, ms } = thunderBattle(1, [['goblin', 600]]);
  let hits = 0;
  b.on('thunder', () => hits++);
  const hp0 = ms[0].hp;
  assert.ok(b.castSkill(0));
  for (let i = 0; i < 120; i++) b.step(1 / 60);
  assert.strictEqual(hits, 3);
  assert.ok(hp0 - ms[0].hp > 0);
  const empty = thunderBattle(1, []);
  assert.strictEqual(empty.b.castSkill(0), false);
});

test('雷霆一击：总伤害随道数增加，每道的伤害低于原来的单道', () => {
  const per = (lv) => P.skillDef('thunder', lv).atkMult;
  assert.ok(per(1) < 5 && per(3) < 7, '每道比以前单道弱');
  const total = (lv) => per(lv) * P.skillDef('thunder', lv).strikes;
  assert.ok(total(1) > 5 && total(2) > total(1) && total(3) > total(2));
});

test('雷霆一击：施法动作的时长随道数变化，每道雷都有脉冲', () => {
  require('../src/render/heroanim.js');
  const H = TD.heroAnim;
  assert.ok(H.castDur('thunder', 5, 0.22) > H.castDur('thunder', 3, 0.22));
  assert.ok(Math.abs(H.castDur('thunder', 15, 0.08) - (14 * 0.08 + 0.75)) < 1e-9);
  assert.strictEqual(H.castDur('frost'), H.CAST_DUR.frost);
  for (let i = 0; i < 4; i++) assert.ok(H.thunderPulse(i * 0.22, 4, 0.22) > 0.99);
  assert.ok(H.thunderPulse(0.11, 4, 0.22) < 0.2);
  const at = (a) => H.pose({ t: 0, weapon: 'staff', mood: 'focus', shotAge: 5, readyIn: 0, castId: 'thunder', castAge: a, castStrikes: 5, castEvery: 0.22 }, -0.1);
  assert.ok(at(0.44).arm > at(0.33).arm, '落雷时手臂往下压一下');
  assert.ok(at(1.0).cast === 'thunder', '5 道雷的动作比 3 道长');
  assert.strictEqual(at(0.4).castBlend > 0.9, true);
});

test('主角双腿迈开：站姿有前后分开的两只脚', () => {
  require('../src/render/heroanim.js');
  const H = TD.heroAnim;
  const base = H.pose({ t: 0, weapon: 'bow', mood: 'focus' }, 0);
  assert.strictEqual(base.stance, 1);
  assert.ok(H.pose({ t: 0, weapon: 'staff', mood: 'focus', castId: 'repair', castAge: 0.6 }, 0).stance > 1.2, '修复时蹲得更开');
  assert.ok(H.pose({ t: 0, weapon: 'staff', mood: 'focus', castId: 'drum', castAge: 0.33 }, 0).stance < 0.8, '战鼓跳起时两脚并拢');
});

// ---------- v0.94：武器命中和技能的华丽特效（设计书 97） ----------
test('特效：星芒、斩击、法术绽放、彩虹环、地面电弧、冰刺都能画出来并按时消失', () => {
  TD.art = TD.art || {};
  TD.art.drawGlow = TD.art.drawGlow || (() => {});
  require('../src/render/vfx.js');
  const V = new TD.Vfx();
  let calls = 0;
  const ctx = new Proxy(function () {}, {
    get: (t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => void calls++),
    set: () => true,
  });
  V.star(100, 100, '#ffd23f', 60, 8, 0.4);
  V.slashes(100, 100, '#ffffff', 4, 40);
  V.bloom(100, 100, '#c58cff', 60);
  V.prism(100, 100, 70);
  V.groundArcs(100, 100, 90, '#d8c0ff');
  V.iceSpikes(50, 300, 200, 8);
  V.thunder(150, 200, 1);
  V.rainArrow(120, 220);
  const kinds = new Set(V.fx.map((f) => f.kind));
  for (const k of ['star', 'slash', 'runeRing', 'prism', 'groundArc', 'iceSpike', 'bolt', 'ring']) assert.ok(kinds.has(k), k);
  for (let i = 0; i < 60; i++) V.draw(ctx, 0.05);
  assert.ok(calls > 200);
  assert.strictEqual(V.fx.length, 0, '3 秒后所有特效都已消失');
  assert.strictEqual(V.parts.length, 0);
  // 特效太多时新的装饰性特效不再添加
  for (let i = 0; i < 200; i++) V.fx.push({ kind: 'ring', x: 0, y: 0, r0: 1, r1: 2, color: '#ffffff', life: 9, age: 0 });
  const n = V.fx.length;
  V.star(0, 0, '#fff', 10);
  V.slashes(0, 0, '#fff', 3);
  V.bloom(0, 0, '#fff', 10);
  V.prism(0, 0, 10);
  assert.strictEqual(V.fx.length, n);
});

// ---------- v0.95：选曲 ----------
test('音乐选曲：标题轮流播三首，关卡单数关 A 曲、双数关 B 曲、Boss 关一律 B 曲', () => {
  const M = TD.music;
  // 标题：连续进入三次，三首都会轮到（顺序随机起点、之后依次轮换）
  const seen = [];
  for (let i = 0; i < 3; i++) {
    seen.push(M.titleTheme());
    M.mode = 'calm'; // 离开标题再回来才会换下一首
    M.playing = false;
  }
  assert.strictEqual(new Set(seen).size, 3, '三首标题曲轮流');
  assert.ok(seen.every((id) => M.TITLE_IDS.includes(id)));
  // 已经在播标题曲时再进标题不换歌
  M.mode = 'title';
  M.playing = true;
  M.theme = 'T1';
  assert.strictEqual(M.titleTheme(), 'T1');
  M.playing = false;
  M.mode = 'calm';
  // 关卡
  assert.strictEqual(M.levelTheme(3, 21, 'normal'), 3);
  assert.strictEqual(M.levelTheme(3, 22, 'normal'), '3b');
  assert.strictEqual(M.levelTheme(3, 25, 'boss'), '3b');
  assert.strictEqual(M.levelTheme(3, 25, 'miniboss'), '3b');
  for (let ch = 1; ch <= 10; ch++) assert.ok(M.THEMES[M.levelTheme(ch, ch * 10, 'boss')]);
  // 没有 B 曲的章节退回 A 曲
  assert.strictEqual(M.levelTheme(99, 2, 'normal'), 99);
});

test('通关奖励：随关卡越来越丰厚，第 100 关远多于以前', () => {
  const f = TD.config.rewards.baseCopper;
  let prev = 0;
  for (let n = 1; n <= 100; n++) {
    assert.ok(f(n) > prev, `第 ${n} 关奖励应比上一关多`);
    prev = f(n);
  }
  for (const n of [1, 10, 30, 60, 100]) assert.ok(f(n) > 40 + 10 * n, `第 ${n} 关比旧公式多`);
  assert.ok(f(100) >= 10 * (40 + 10 * 100), '第 100 关约是旧公式的 10 倍');
  assert.ok(f(50) / f(10) > 8, '高关卡的奖励增长比线性快');
  // 通关结算：第 N 关首通 3 星 = baseCopper × 1.5（原有倍率不变）
  const s = P.newSave();
  const r = P.applyResult(s, 40, { win: true, stars: 3, kills: 0, copperDrops: 0 });
  assert.ok(r.baseCopper >= Math.round(f(40) * 1.5) - 1);
});

test('Boss 血量：主线 Boss ×3，九层妖塔的妖王和关卡 Boss 一样厚，普通小怪不变', () => {
  const s = P.newSave();
  const mk = (level) => new TD.Battle({ level, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  const b = mk(10);
  const boss = b.spawnMonster('boarKing' in D.monsters ? 'boarKing' : Object.keys(D.monsters).find((k) => D.monsters[k].boss && !D.monsters[k].towerOf), undefined, 600);
  const slime = b.spawnMonster('slime', 0, 600);
  const d = (def) => def.hp * b.D * (1 + (b.rules.monsterHp || 0)) * b.diffHp;
  assert.strictEqual(TD.config.bossHpMult, 3);
  assert.ok(Math.abs(boss.maxHp - Math.round(d(boss.def) * (1 + (b.level.bossHp || 0)) * 3)) <= 1);
  assert.ok(Math.abs(slime.maxHp - Math.round(d(slime.def))) <= 1);
  const cs = P.newSave();
  clearUpTo(cs, 70);
  for (const floor of [1, 4]) {
    const def = TD.modes.buildTower(cs, floor);
    const tb = new TD.Battle({ level: 'tower', levelDef: def, stage: def.stage, stats: P.heroStats(cs), loadout: P.battleLoadout(cs), seed: 2 });
    for (let i = 0; i < 60 * 30 && !tb.bossHpD; i++) tb.step(1 / 60); // 第一波开始后才用妖塔的难度
    const t = tb.spawnMonster('tw_boarKing', 0, 600);
    assert.ok(t.dps <= D.monsters.tw_boarKing.dps * TD.config.difficulty(70) * 0.02 * floor * 1.01, '攻城伤害仍按妖塔的小难度 ' + t.dps + ' D=' + tb.D + ' hpD=' + tb.bossHpD);
    const want = Math.round(D.monsters.tw_boarKing.hp * TD.config.difficulty(70) * floor * tb.diffHp * 3);
    assert.ok(Math.abs(t.maxHp - want) <= 1, `第 ${floor} 层妖王血量 ${t.maxHp} ≠ ${want}`);
  }
});

// ---------- 新技能（设计书 104）：主动技能 10 种、被动技能 10 种 ----------
test('技能数量：主动、被动各 10 种；每个主动技能 3 档说明，外放型被动都有几率和倍数', () => {
  assert.strictEqual(Object.keys(D.activeSkills).length, 10);
  assert.strictEqual(Object.keys(D.passiveSkills).length, 10);
  for (const [id, k] of Object.entries(D.activeSkills)) {
    assert.strictEqual(k.tierDesc.length, 3, id);
    assert.strictEqual(k.tiers.length, 3, id);
  }
  const procs = Object.entries(D.passiveSkills).filter(([, k]) => k.proc);
  assert.strictEqual(procs.length, 6);
  for (const [id, k] of procs) {
    assert.ok(P.passiveValue(id, 1) > 0.04 && P.passiveValue(id, 1) < 0.1, id + ' 1 级几率');
    assert.ok(P.passiveValue(id, 10) > P.passiveValue(id, 1) * 2, id + ' 升级几率变大');
    assert.ok(P.passiveMult(id, 10) > P.passiveMult(id, 1), id + ' 升级倍数变大');
    assert.ok(P.passiveValue(id, 9999) <= k.eff.cap, id + ' 几率有上限');
  }
});

test('新主动技能：贯穿光矢打整条车道、猎杀标记加伤、引力漩涡拉怪、烈焰之墙点燃、幻影连射多射', () => {
  const s = P.newSave();
  clearUpTo(s, 25);
  const ids = ['pierce', 'vortex', 'firewall', 'mark', 'clones'];
  for (const k of ids) s.activeOwned[k] = true;
  const mk = (loadout, lv) => {
    s.loadout.active = loadout;
    for (const k of ids) s.skillLv[k] = lv || 1;
    const b = new TD.Battle({ level: 21, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 3 });
    b.waveState = 'running';
    return b;
  };
  const step = (b, sec) => {
    for (let i = 0; i < sec * 20; i++) b.step(0.05);
  };
  // 贯穿光矢：同一车道的怪都挨一下，别的车道不受影响；Lv3 相邻车道吃 50%
  let b = mk(['pierce', null, null]);
  const a1 = b.spawnMonster('snowman', 1, 500);
  const a2 = b.spawnMonster('snowman', 1, 800);
  const a3 = b.spawnMonster('snowman', 3, 600);
  for (const m of [a1, a2, a3]) m.hp = m.maxHp = 1e6;
  assert.ok(b.castSkill(0, 1));
  step(b, 1);
  assert.ok(a1.hp < 1e6 && a2.hp < 1e6, '车道里的怪都挨到');
  assert.strictEqual(a3.hp, 1e6, '别的车道没事');
  b = mk(['pierce', null, null], 3);
  const s1 = b.spawnMonster('snowman', 1, 500);
  const s2 = b.spawnMonster('snowman', 2, 500);
  s1.hp = s1.maxHp = 1e6;
  s2.hp = s2.maxHp = 1e6;
  b.heroStunUntil = Infinity; // 不让主角自己的箭干扰伤害比例
  b.castSkill(0, 1);
  step(b, 1);
  assert.ok(Math.abs((1e6 - s2.hp) / (1e6 - s1.hp) - 0.5) < 0.02, '相邻车道 50%');
  // 猎杀标记：标记血量最高的怪，伤害 +40%；没有怪时放不出去
  b = mk(['mark', null, null]);
  assert.strictEqual(b.castSkill(0), false);
  const strong = b.spawnMonster('snowman', 1, 600);
  const weak = b.spawnMonster('snowman', 2, 600);
  strong.hp = strong.maxHp = 1e6;
  weak.hp = weak.maxHp = 1e5;
  assert.ok(b.castSkill(0));
  assert.ok(strong.markUntil > b.time && !weak.markUntil, '只标记血量最高的');
  const hp0 = strong.hp;
  b.damage(strong, 1000, { type: 'phys', fromFront: false, source: 'test' });
  const marked = hp0 - strong.hp;
  strong.markUntil = 0;
  const hp1 = strong.hp;
  b.damage(strong, 1000, { type: 'phys', fromFront: false, source: 'test' });
  assert.ok(Math.abs(marked / (hp1 - strong.hp) - 1.4) < 0.01, `标记增伤 ${marked / (hp1 - strong.hp)}`);
  // 引力漩涡：周围的怪被拽向中心
  b = mk(['vortex', null, null]);
  const v1 = b.spawnMonster('snowman', 1, 560);
  const v2 = b.spawnMonster('snowman', 1, 700);
  v1.hp = v1.maxHp = v2.hp = v2.maxHp = 1e6;
  assert.ok(b.castSkill(0));
  const gap0 = Math.abs(v1.x - v2.x);
  step(b, 1);
  assert.ok(Math.abs(v1.x - v2.x) < gap0, '两只怪靠近了');
  assert.ok(v1.hp < 1e6 && v2.hp < 1e6);
  // 烈焰之墙：车道里的怪被点燃并持续掉血，别的车道不受影响
  b = mk(['firewall', null, null]);
  const f1 = b.spawnMonster('snowman', 1, 600);
  const f2 = b.spawnMonster('snowman', 3, 600);
  f1.hp = f1.maxHp = f2.hp = f2.maxHp = 1e6;
  assert.ok(b.castSkill(0, 1));
  step(b, 2);
  assert.ok(f1.hp < 1e6 && f1.burnUntil > b.time - 3, '烧到了');
  assert.strictEqual(f2.hp, 1e6);
  step(b, 8);
  assert.strictEqual(b.fireWalls.length, 0, '火墙到时间熄灭');
  // 幻影连射：开着的时候每次攻击多射几箭（弹道数明显更多）
  const shots = (withClones) => {
    const bb = mk(['clones', null, null], 3);
    const m = bb.spawnMonster('snowman', 1, 400);
    m.hp = m.maxHp = 1e9;
    if (withClones) bb.castSkill(0);
    let n = 0;
    const old = bb.emit.bind(bb);
    bb.emit = (t, e) => (t === 'shoot' && n++, old(t, e));
    step(bb, 3);
    return n;
  };
  assert.ok(shots(true) >= shots(false) * 3, '幻影多射');
});

test('外放型被动：几率拉满时每次攻击都触发，各自造成伤害 / 治疗；几率为 0 时不触发', () => {
  const s = P.newSave();
  clearUpTo(s, 25);
  const procs = ['lightning', 'frostNova', 'fireball', 'spiritArrows', 'bladeWave', 'renewal'];
  for (const id of procs) {
    s.passiveOwned[id] = true;
    s.passiveLv[id] = 1;
  }
  const run = (id, chance) => {
    s.loadout.passive = [id, null, null];
    const stats = P.heroStats(s);
    stats.passiveVals[id] = chance;
    const b = new TD.Battle({ level: 21, stats, loadout: P.battleLoadout(s), seed: 9 });
    b.waveState = 'running';
    const ms = [b.spawnMonster('snowman', 1, 450), b.spawnMonster('snowman', 1, 520), b.spawnMonster('snowman', 1, 590), b.spawnMonster('snowman', 2, 520)];
    for (const m of ms) m.hp = m.maxHp = 1e9;
    b.wall.hp = b.wall.max * 0.5;
    const hp0 = b.wall.hp;
    for (let i = 0; i < 80; i++) b.step(0.05);
    const dealt = ms.reduce((a, m) => a + (1e9 - m.hp), 0);
    return { dealt, healed: b.wall.hp - hp0, src: b.report.bySource };
  };
  const srcOf = { lightning: 'procLightning', frostNova: 'procFrost', fireball: 'procFireball', spiritArrows: 'procSpirit', bladeWave: 'procWave' };
  for (const id of procs) {
    const on = run(id, 1);
    const off = run(id, 0);
    if (id === 'renewal') {
      assert.ok(on.healed > off.healed, '回春治疗了城墙');
      continue;
    }
    assert.ok(on.src[srcOf[id]] > 0, id + ' 触发了');
    assert.ok(!off.src[srcOf[id]], id + ' 几率为 0 不触发');
    assert.ok(on.dealt > off.dealt, id + ' 多造成了伤害');
  }
  // 霜爆会减速
  s.loadout.passive = ['frostNova', null, null];
  const st = P.heroStats(s);
  st.passiveVals.frostNova = 1;
  const b = new TD.Battle({ level: 21, stats: st, loadout: P.battleLoadout(s), seed: 9 });
  b.waveState = 'running';
  const m = b.spawnMonster('snowman', 1, 450);
  m.hp = m.maxHp = 1e9;
  for (let i = 0; i < 40; i++) b.step(0.05);
  assert.ok(m.slowAmt >= D.passiveSkills.frostNova.slow - 1e-9 || b.time > m.slowUntil, '霜爆减速');
});

// ---------- 交响乐配乐（设计书 105）：作曲层 + 新乐器 ----------
test('和弦解析：七和弦、挂留、加九、减七、斜线低音', () => {
  const SC = TD.score;
  const c = (s) => SC.chord(s);
  assert.deepStrictEqual([c('Dm7').third, c('Dm7').seventh], [3, 10]);
  assert.strictEqual(c('Cmaj7').seventh, 11);
  assert.strictEqual(c('G7').seventh, 10);
  assert.strictEqual(c('Gsus4').third, 5);
  assert.strictEqual(c('Fadd9').ninth, 14);
  assert.deepStrictEqual([c('Bdim7').fifth, c('Bdim7').seventh], [6, 9]);
  assert.strictEqual(c('C/E').bassPc, 4);
  assert.strictEqual(c('C/E').pc, 0);
  assert.deepStrictEqual(c('Am').tones, [57, 60, 64, 69]);
  assert.throws(() => c('H#'));
});

test('作曲层：每首曲子展开成 4 段 × 8 小节的总谱，转调 / 回调、声部连接、对位旋律都合规', () => {
  const M = TD.music;
  const SC = TD.score;
  const mod12 = (n) => ((n % 12) + 12) % 12;
  for (const id of Object.keys(M.THEMES)) {
    const th = M.THEMES[id];
    const sc = th.score;
    assert.ok(sc, `第 ${id} 首没有总谱`);
    assert.deepStrictEqual(sc.sections.map((s) => s.name), ['A', "A'", 'B', "A''"]);
    for (const s of sc.sections) {
      assert.strictEqual(s.bars.length, 8);
      assert.strictEqual(s.melody.length, 64);
      assert.ok(s.melody.filter(Boolean).length >= 8, `第 ${id} 首 ${s.name} 段旋律太少`);
      for (const n of s.melody.filter(Boolean)) assert.ok(n.midi >= 55 && n.midi <= 100, `第 ${id} 首 ${s.name} 段旋律音 ${n.midi} 越界`);
      if (s.counter) for (const n of s.counter.filter(Boolean)) assert.ok(n.midi >= 52 && n.midi <= 79, `第 ${id} 首对位旋律音 ${n.midi} 越界`);
      for (const b of s.bars) {
        assert.strictEqual(b.voicing.length, 4);
        assert.ok(b.voicing.every((m, i) => m >= 48 && m <= 78 && (i === 0 || m > b.voicing[i - 1])), '声部从低到高、在音域里');
        assert.ok(b.voicing.some((m) => mod12(m) === mod12(b.chord.pc + b.chord.third)), `第 ${id} 首和弦 ${b.chord.sym} 的声部里没有三音`);
      }
    }
    const [A, A2, B, C] = sc.sections;
    // 第二段：旋律是装饰过的原旋律（音更多），对位旋律每个音都在旋律下方
    assert.ok(A2.melody.filter(Boolean).length >= A.melody.filter(Boolean).length);
    assert.ok(A2.counter.filter(Boolean).length === A.melody.filter(Boolean).length);
    // 桥段最后两小节：新调（原调升大二度）的属七；高潮整体升大二度，最后一小节回到原调的属七
    const t = sc.key.tonic;
    assert.strictEqual(B.bars[7].chord.pc, mod12(t + 9));
    assert.strictEqual(B.bars[7].chord.seventh, 10);
    assert.strictEqual(C.trans, 2);
    assert.strictEqual(C.bars[7].chord.pc, mod12(t + 7));
    assert.strictEqual(C.bars[7].chord.seventh, 10);
    assert.strictEqual(C.bars[0].chord.pc, mod12(th.chords[0].pc + 2));
  }
  // 调式识别
  assert.deepStrictEqual([M.THEMES[0].score.key.tonic, M.THEMES[0].score.key.minor], [2, true]); // D 小调
  assert.deepStrictEqual([M.THEMES[1].score.key.tonic, M.THEMES[1].score.key.minor], [9, true]); // A 小调
  assert.deepStrictEqual([M.THEMES['1b'].score.key.tonic, M.THEMES['1b'].score.key.minor], [0, false]); // C 大调
  assert.ok(SC.shiftSteps(60, 2, M.THEMES['1b'].score.key) === 64); // C 大调里 C 上行两级是 E
});

test('旋律每个音只弹一次（旧版在相邻的 16 分音符上又弹了一遍）；桥段换主奏，高潮转调', async () => {
  const M = TD.music;
  const ctx = mockAudioCtx();
  const eng = new M.Engine(ctx, ctx.destination);
  await eng.loadSamples(M.Engine.instrumentsFor(1));
  const ev = [];
  const orig = eng.samp.bind(eng);
  eng.samp = (inst, m, t, dur, vol, o) => (ev.push({ inst, m, t }), orig(inst, m, t, dur, vol, o));
  eng.tension = 1;
  eng.setTheme(1, 'battle');
  const th = eng.theme;
  const sd = 60 / th.bpm / 4;
  const total = 32 * 16;
  while (eng.step < total) {
    eng.scheduleStep(eng.step, eng.nextTime);
    eng.nextTime += (sd / M.TEMPO_OF(1));
    eng.step++;
  }
  const secOf = (e) => Math.floor(e.t / ((sd / M.TEMPO_OF(1)) * 16 * 8) - 0.0001);
  // 第二段（小提琴唱）：小提琴起音数 = A' 旋律的音数
  const vio = ev.filter((e) => e.inst === 'violin' && secOf(e) === 1);
  assert.strictEqual(vio.length, th.score.sections[1].melody.filter(Boolean).length);
  // 同一时刻不会有两个同音高的小提琴起音
  assert.strictEqual(new Set(vio.map((e) => e.t.toFixed(4) + ':' + e.m)).size, vio.length);
  // 桥段用单簧管 / 长笛等木管唱旋律，高潮出现小号和长号
  assert.ok(ev.some((e) => e.inst === 'clarinet' && secOf(e) === 2));
  assert.ok(ev.some((e) => e.inst === 'trumpet' && secOf(e) === 3));
  assert.ok(ev.some((e) => e.inst === 'trombone' && secOf(e) === 3));
  assert.ok(ev.some((e) => e.inst === 'tuba' && secOf(e) === 3));
  // 第一段没有小号（高潮才进）
  assert.ok(!ev.some((e) => e.inst === 'trumpet' && secOf(e) === 0));
});

test('交响乐新乐器：8 个新采样都在，标题 / 地图 / 战斗都用得到；音域折叠不越界', () => {
  delete require.cache[require.resolve('../src/render/samples.js')];
  require('../src/render/samples.js');
  const S = TD.samples;
  const inst = TD.music.Engine.instrumentsFor(1);
  for (const n of ['viola', 'trumpet', 'trombone', 'tuba', 'bassoon', 'clarinet', 'voice_oohs', 'glockenspiel']) {
    assert.ok(S[n] && Object.keys(S[n].notes).length >= 8, `缺少 ${n}`);
    assert.ok(inst.includes(n), `${n} 没有在曲子里预加载`);
    assert.ok(TD.music.GAIN[n] > 0, `${n} 没有音量标定`);
  }
  for (const n of ['viola', 'trumpet', 'trombone', 'tuba', 'bassoon', 'clarinet', 'voice_oohs']) assert.deepStrictEqual(S[n].loop, [0.8, 2.4]);
  assert.strictEqual(S.glockenspiel.loop, null);
  // 每种模式下，每首曲子的新乐器都真的发了声（不是白加载）
  for (const [mode, ten] of [['title', 0], ['calm', 0], ['battle', 3]]) {
    const ctx = mockAudioCtx();
    const eng = new TD.music.Engine(ctx, ctx.destination);
    eng.tension = ten;
    eng.setTheme(mode === 'title' ? 0 : 1, mode);
    eng.schedule(150);
    assert.ok(ctx.calls.osc + ctx.calls.noise > 100, `${mode} 声音太少`);
  }
});

test('结束音：胜利 / 失败 / 登场 / 新一波都用上了铜管、定音鼓滚奏等交响乐写法，声音事件更丰满', () => {
  const M = TD.music;
  const counts = {};
  for (const name of ['boss', 'win', 'lose', 'wave']) {
    const ctx = mockAudioCtx();
    const eng = new M.Engine(ctx, ctx.destination);
    eng.setTheme(1, 'battle');
    eng.stinger(name);
    counts[name] = ctx.calls.osc + ctx.calls.noise;
  }
  assert.ok(counts.win >= 40, `胜利号角应该很丰满：${counts.win}`);
  assert.ok(counts.boss >= 30 && counts.lose >= 15 && counts.wave >= 6, JSON.stringify(counts));
});

// ---------- v1.10：回归的小 Boss（设计书 110） ----------
test('回归的小 Boss：51 关起普通小关卡常常出现，是之前小 Boss 关里的小 Boss；小 Boss / 大 Boss / 精英挑战关和 51 关以前不出现', () => {
  const s = P.newSave();
  const mk = (n, seed) => new TD.Battle({ level: n, stats: P.heroStats(s), seed, loadout: { active: [], items: [] } });
  const minis = new Set();
  for (let k = 1; k <= 100; k++) if (D.levels[k].type === 'miniboss') for (const w of D.levels[k].waves) for (const [t] of w.groups) if (D.monsters[t].boss) minis.add(t);
  let hit = 0;
  let total = 0;
  for (let n = 51; n <= 100; n++) {
    if (['miniboss', 'boss', 'elite'].includes(D.levels[n].type)) {
      assert.deepStrictEqual(mk(n, 1).returnBosses, [], `第 ${n} 关不加`);
      continue;
    }
    for (let seed = 1; seed <= 4; seed++) {
      const b = mk(n, seed);
      total++;
      if (b.returnBosses.length) hit++;
      for (const r of b.returnBosses) {
        assert.ok(minis.has(r.type), r.type + ' 是小 Boss');
        // 只出现"之前"的小 Boss
        assert.ok([...Array(n).keys()].some((k) => k >= 1 && k < n && D.levels[k].type === 'miniboss' && D.levels[k].waves.some((w) => w.groups.some(([t]) => t === r.type))), `第 ${n} 关出现的 ${r.type} 之前没打过`);
        assert.ok(r.wave >= 0 && r.wave < D.levels[n].waves.length);
      }
      assert.ok(b.returnBosses.length <= (n >= TD.config.returnBossLateFrom ? 2 : 1));
    }
  }
  assert.ok(hit / total > 0.45 && hit / total < 0.75, '大约 60% 的小关卡会出现：' + hit / total);
  for (const n of [1, 30, 49, 50]) assert.deepStrictEqual(mk(n, 1).returnBosses, []);
  // 自定义关卡不加；同一个种子结果固定
  assert.deepStrictEqual(new TD.Battle({ level: 52, levelDef: D.levels[52], stats: P.heroStats(s), seed: 1, loadout: { active: [], items: [] } }).returnBosses, []);
  assert.deepStrictEqual(mk(53, 3).returnBosses, mk(53, 3).returnBosses);
});

test('回归的小 Boss：排在那一波最后出场、血量打折，击败得 1 银币，通关结算加上；没击败不给', () => {
  const s = P.newSave();
  let b = null;
  for (let seed = 1; seed < 40 && !b; seed++) {
    const c = new TD.Battle({ level: 61, stats: P.heroStats(s), seed, loadout: { active: [], items: [] } });
    if (c.returnBosses.length) b = c;
  }
  assert.ok(b);
  const r = b.returnBosses[0];
  b.startWave(r.wave);
  assert.strictEqual(b.spawnQueue[b.spawnQueue.length - 1], '@' + r.type);
  const m = b.spawnFromQueue('@' + r.type, 1);
  const full = Math.round(D.monsters[r.type].hp * b.D * b.diffHp * TD.config.bossHpMult);
  assert.ok(m.returning && Math.abs(m.maxHp - full * TD.config.returnBossHpMult) <= 1, '血量打折');
  assert.strictEqual(b.killSilver, 0);
  b.kill(m);
  assert.strictEqual(b.killSilver, TD.config.returnBossSilver);
  // 普通怪不给银币
  const slime = b.spawnMonster('slime', 0);
  b.kill(slime);
  assert.strictEqual(b.killSilver, TD.config.returnBossSilver);
  // 结算：银币和提示，普通关卡本来不给银币
  const save = P.newSave();
  const out = P.applyResult(save, 61, { win: true, wallRatio: 1, killCopper: 0, earlyCopper: 0, killSilver: 1 });
  assert.strictEqual(out.silver, 1);
  assert.ok(out.notes.some((x) => x.includes('回归的小 Boss')));
  const out2 = P.applyResult(P.newSave(), 62, { win: true, wallRatio: 1, killCopper: 0, earlyCopper: 0, killSilver: 0 });
  assert.strictEqual(out2.silver, 0);
});

// ---------- v1.10：兼容性与卡死防护（设计书 111） ----------
test('自适应画质：持续卡就一档档降，很卡一次降两档；手动档位不自动变；性能够了才慢慢升回来；刚升上去又掉下来的档位不再升', () => {
  const fs = require('fs');
  require('../src/core/quality.js');
  const Q = TD.quality;
  Q._reset();
  Q.setMode('auto');
  const frames = (n, ms) => {
    for (let i = 0; i < n; i++) Q.record(ms);
  };
  assert.strictEqual(Q.level, 0);
  frames(200, 16.7);
  assert.strictEqual(Q.level, 0, '正常帧率不降');
  frames(200, 33.4);
  assert.strictEqual(Q.level, 0, '30 帧 / 秒（显示器就是 30Hz）不算卡');
  frames(40, 55);
  assert.strictEqual(Q.level, 1, '55 毫秒一帧：降一档');
  frames(40, 110);
  assert.strictEqual(Q.level, 3, '110 毫秒一帧：一次降两档，直到最低');
  frames(500, 300);
  assert.strictEqual(Q.level, 3, '超过 250 毫秒的单帧是切后台之类的，不算');
  // 档位参数：越低画布越小、粒子越少、光影越少
  const P0 = Q.LEVELS[0];
  const P3 = Q.LEVELS[3];
  assert.ok(P0.scale === 1 && P3.scale < P0.scale && P3.fx < P0.fx && P3.lit < P0.lit && P0.shafts && !P3.shafts && !P3.glow);
  for (let i = 1; i < Q.LEVELS.length; i++) assert.ok(Q.LEVELS[i].scale <= Q.LEVELS[i - 1].scale && Q.LEVELS[i].fx <= Q.LEVELS[i - 1].fx);
  // 性能回来了：稳定很久才升一档（不是一下子升回去）
  frames(24 * 5, 16.5);
  assert.strictEqual(Q.level, 3, '稳定时间不够不升');
  frames(24 * 30, 16.5);
  assert.ok(Q.level < 3, '稳定很久以后升一档');
  // 手动档位：不受帧率影响
  Q.setMode('low');
  assert.strictEqual(Q.level, 2);
  frames(300, 120);
  assert.strictEqual(Q.level, 2);
  Q.setMode('high');
  assert.strictEqual(Q.level, 0);
  Q.setMode('nonsense');
  assert.strictEqual(Q.mode, 'auto');
  // 档位变化会通知渲染器
  const seen = [];
  Q.onChange = (l) => seen.push(l);
  Q.set(2);
  Q.set(2);
  assert.deepStrictEqual(seen, [2]);
  Q._reset();
});

test('防卡死：入口页有浏览器检查和加载超时提示，乐器采样异步加载，质量模块在渲染器之前加载；帧循环先排下一帧并有出错保护', () => {
  const fs = require('fs');
  const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(html.includes('兼容性检查') && html.includes('__tdOld') && html.includes('25000'));
  assert.ok(/<script src="src\/render\/samples\.js" async><\/script>/.test(html), '采样 5 MB，异步加载不挡首屏');
  assert.ok(html.indexOf('src/core/quality.js') > 0 && html.indexOf('src/core/quality.js') < html.indexOf('src/render/renderer.js'));
  const main = fs.readFileSync(require('path').join(__dirname, '..', 'src', 'main.js'), 'utf8');
  assert.ok(/function frame\(ts\) \{\s*requestAnimationFrame\(frame\);\s*try \{/.test(main), '先排下一帧再干活，出错也不会停');
  assert.ok(main.includes('performance.now() - t0 > 20') && main.includes('game.crash'));
  // 源码里没有老浏览器不认识的语法 / 接口（?? 和 ?. 要 Chrome 80+，这里全部换成老写法）
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(require('path').join(d, e.name)) : [require('path').join(d, e.name)]));
  for (const f of walk(require('path').join(__dirname, '..', 'src')).filter((x) => x.endsWith('.js') && !x.includes('/i18n/') && !x.endsWith('samples.js'))) {
    const src = fs.readFileSync(f, 'utf8');
    assert.ok(!/ \?\? /.test(src), f + ' 用了 ??');
    assert.ok(!/\?\.[A-Za-z_\[(]/.test(src.replace(/'[^'\n]*'/g, '').replace(/`[^`]*`/g, '')), f + ' 用了 ?.');
  }
});

test('采样解码限流：同时最多 4 个，全部完成，失败也不卡住队列', async () => {
  delete require.cache[require.resolve('../src/render/music.js')];
  require('../src/render/music.js');
  const Engine = TD.music.Engine || (TD.music && TD.music._Engine);
  if (!Engine || !Engine.prototype.limited) return; // 引擎类没有导出就跳过
  const eng = Object.create(Engine.prototype);
  let active = 0;
  let peak = 0;
  const job = (fail) => () =>
    new Promise((res, rej) => {
      active++;
      peak = Math.max(peak, active);
      setTimeout(() => {
        active--;
        fail ? rej(new Error('x')) : res(1);
      }, 3);
    });
  const out = await Promise.all(Array.from({ length: 20 }, (_, i) => eng.limited(job(i % 7 === 3)).then(() => 'ok', () => 'fail')));
  assert.strictEqual(out.length, 20);
  assert.ok(peak <= 4 && peak >= 2, '同时解码数 ' + peak);
  assert.strictEqual(out.filter((x) => x === 'fail').length, 3);
});

test('多出的小怪不会全堆进一波：每关各波分到的数量和该波原有小怪数量成比例（第 50 关以前是一波 250 只战车）', () => {
  for (const n of [20, 30, 45, 50, 57, 70, 88, 100]) {
    const b = queuedTotals(n).b;
    const lv = D.levels[n];
    const cm = lv.countMult || 1;
    const per = b.extraPlan.map((p) => (p ? p.reduce((x, [, c]) => x + c, 0) : 0));
    const total = per.reduce((x, y) => x + y, 0);
    if (!total) continue;
    const minions = lv.waves.map((w) => w.groups.reduce((x, [t, c]) => x + (D.monsters[t].boss ? 0 : Math.max(1, Math.round(c * cm))), 0));
    const msum = minions.reduce((x, y) => x + y, 0);
    per.forEach((e, i) => assert.ok(Math.abs(e - (total * minions[i]) / msum) <= 8, `第 ${n} 关第 ${i + 1} 波：多出 ${e} 只，按比例应约 ${Math.round((total * minions[i]) / msum)}`));
  }
  // 第 50 关：每一波都分到了
  const e50 = queuedTotals(50).b.extraPlan;
  assert.ok(e50.every((p) => p && p.length), '第 50 关每一波都有多出的小怪');
});

// ---------- v1.11：200 关，深渊回响（设计书 112） ----------
test('200 关：第 11–20 章是前 10 章的深渊版，第 100 + j 关由第 j 关改来', () => {
  assert.strictEqual(D.chapters.length, 20);
  assert.strictEqual(Object.keys(D.levels).length, 200);
  for (let n = 1; n <= 200; n++) assert.ok(D.levels[n], '第 ' + n + ' 关');
  assert.strictEqual(D.chapterOf(101).id, 11);
  assert.strictEqual(D.chapterOf(150).id, 15);
  assert.strictEqual(D.chapterOf(200).id, 20);
  assert.deepStrictEqual(['一', '十', '十一', '十五', '十九', '二十'], [1, 10, 11, 15, 19, 20].map(D.chapterNo));
  for (let i = 0; i < 10; i++) {
    const base = D.chapters[i];
    const ab = D.chapters[10 + i];
    assert.ok(ab.abyss && ab.theme.abyss && ab.name === '深渊 · ' + base.name && ab.music === base.id);
    assert.deepStrictEqual(ab.levels, base.levels.map((j) => 100 + j));
    assert.strictEqual(ab.theme.art, base.theme.art, '场景沿用前 10 章');
  }
  const bossTypes = (n) => new Set(D.levels[n].waves.flatMap((w) => w.groups.map(([t]) => t)).filter((t) => D.monsters[t].boss));
  for (let j = 1; j <= 100; j++) {
    const o = D.levels[j];
    const lv = D.levels[100 + j];
    assert.ok(lv.abyss && lv.echoOf === j && (lv.name === '深渊 · ' + o.name || j === 100), `第 ${100 + j} 关`);
    assert.strictEqual(lv.type, o.type === 'tutorial' ? 'normal' : o.type, `第 ${100 + j} 关类型`);
    assert.ok(lv.lanes >= 3 && lv.waves.length === o.waves.length && lv.tip);
    for (const w of lv.waves) for (const [t, c] of w.groups) assert.ok(D.monsters[t] && c >= 1, `第 ${100 + j} 关的 ${t}`);
    if (j === 100) continue; // 第 200 关的 Boss 换成了焚天巨龙（下面单独断言）
    // 原来的 Boss 都还在；大 Boss 关里本章的小 Boss 一起登场
    for (const b of bossTypes(j)) assert.ok(bossTypes(100 + j).has(b), `第 ${100 + j} 关少了 ${b}`);
    if (o.type === 'boss' || o.type === 'miniboss') assert.ok(lv.bossHp > 0);
    if (j % 10 === 0 && j !== 100) assert.ok(bossTypes(100 + j).size >= 2, `第 ${100 + j} 关应该是两个 Boss`);
    // 搭档章节的小怪混进来了（第 2 波起）
    if (lv.waves.length > 1) assert.ok(lv.waves[1].groups.length > o.waves[1].groups.length, `第 ${100 + j} 关第 2 波有搭档章节的小怪`);
  }
  // 只有第 50 和第 200 关是最终 Boss（播结局）；第 200 关是焚天巨龙
  assert.deepStrictEqual(Object.keys(D.levels).filter((n) => D.levels[n].final).map(Number), [50, 200]);
  assert.deepStrictEqual([...bossTypes(200)], ['abyssDragon'], '第 200 关只有焚天巨龙一个 Boss');
  assert.ok(D.story.ch11 && D.story.post200 && D.storyOrder.includes('ch11') && D.storyOrder.includes('post200'));
  assert.ok(D.achievements.find((a) => a.id === 'abyss20').check(Object.assign(P.newSave(), { levels: { 200: { stars: 1, clears: 1 } } })));
});

test('深渊回响：难度系数继续增长；多出的小怪封顶 500；通关第 100 关才开放第 101 关；音乐沿用对应章节', () => {
  assert.ok(TD.config.difficulty(150) > TD.config.difficulty(100) && TD.config.difficulty(200) > TD.config.difficulty(150));
  assert.ok(Math.abs(TD.config.difficulty(200) / TD.config.difficulty(100) - (1 + 0.01 * 130) / (1 + 0.01 * 30)) < 1e-9);
  const s = P.newSave();
  const mk = (n) => new TD.Battle({ level: n, stats: P.heroStats(s), seed: 3, loadout: { active: [], items: [] } });
  const total = (b) => b.extraPlan.reduce((a, p) => a + (p ? p.reduce((x, [, c]) => x + c, 0) : 0), 0);
  assert.strictEqual(total(mk(100)), 500 * (D.levels[100].extraMult !== undefined ? D.levels[100].extraMult : 1));
  for (const n of [101, 150, 200]) assert.strictEqual(total(mk(n)), 500, `第 ${n} 关多出的小怪封顶 500`);
  assert.ok(!P.isUnlocked(s, 101));
  s.levels[100] = { stars: 1, clears: 1 };
  assert.ok(P.isUnlocked(s, 101));
  // 战斗能正常跑完（深渊关的怪物种类混合）
  for (const n of [101, 110, 135, 160, 200]) {
    const st = Object.assign({}, P.heroStats(s), { atk: 1e8, aspd: 20 }); // 打得动才能跑完（每发只打一只，攻速也要高）：这里只验证深渊关能正常出怪、结算
    const b = new TD.Battle({ level: n, stats: st, seed: 11, loadout: P.battleLoadout(s), autoSupply: true });
    b.wall.max = b.wall.hp = 1e12;
    let guard = 0;
    while (!b.over && guard++ < 60 * 400) b.step(1 / 30);
    assert.ok(b.over, `第 ${n} 关没跑完`);
  }
});

// ---------- v1.12：浏览器翻译和游戏自己的翻译打架会卡死页面（设计书 113） ----------
test('防翻译打架：页面声明不要被浏览器翻译；回调太密集时观察器会自己停下来', () => {
  const fs = require('fs');
  const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(/<html[^>]*translate="no"/.test(html) && /<meta name="google" content="notranslate"/.test(html));
  require('../src/core/i18n.js');
  const guard = TD.i18n._makeLoopGuard(60, 1000, 3);
  // 正常使用：每秒几十次变化，不会停
  let now = 0;
  for (let s = 0; s < 10; s++) for (let i = 0; i < 40; i++) assert.ok(!guard((now += 25)), '正常变化不该停');
  // 翻译器和我们来回改：每秒几百次、连续 3 秒 → 停
  let stopped = false;
  for (let s = 0; s < 6 && !stopped; s++) for (let i = 0; i < 400 && !stopped; i++) stopped = guard((now += 2.5));
  assert.ok(stopped, '来回改页面应该停下来');
});

// ---------- v1.13：第 200 关 Boss 焚天巨龙（设计书 114） ----------
test('焚天巨龙：体型至少是其他 Boss 的 5 倍，血量最厚；停在 holdX 放技能，打断会眩晕', () => {
  const M = TD.data.monsters;
  const others = Object.entries(M).filter(([k, d]) => d.boss && !/abyssDragon/.test(k)).map(([, d]) => d);
  assert.ok(M.abyssDragon.size >= 5 * Math.max(...others.map((d) => d.size)), '体型 ≥ 5 倍');
  assert.ok(M.abyssDragon.hp > Math.max(...others.map((d) => d.hp)), '血量最厚');
  const G = D_dragon();
  assert.ok(G.fire.damage + G.fire.dot * G.fire.dotTime >= 0.2 && G.shock.damage >= 0.15 && G.bolt.damage * G.bolt.count[0] >= 0.1, '巨龙的伤害很大：龙息 ≥ 20%、冲击 ≥ 15%、一轮雷暴 ≥ 10% 城墙血量');
  const b = newBattle(200);
  b.wall.max = b.wall.hp = 1e15;
  const m = b.spawnMonster('abyssDragon', 2, 1100);
  const seen = new Set();
  for (const ev of ['dragonFire', 'dragonShock', 'dragonBoltStart', 'dragonBolt', 'dragonIce', 'bossSummon', 'bossPhase']) b.on(ev, () => seen.add(ev));
  const hp0 = b.wall.hp;
  m.hp = m.maxHp; // 不让玩家打它
  let worst = 1;
  const topUp = () => {
    worst = Math.min(worst, b.wall.hp / b.wall.max);
    b.wall.hp = b.wall.max; // 技能按城墙最大血量的比例打，每帧补满，只看单次最大伤害
  };
  for (let i = 0; i < 60 * 75; i++) {
    b.step(1 / 60);
    topUp();
  }
  assert.ok(Math.abs(m.x - D_dragon().holdX) < 2, '停在 holdX 附近');
  for (const ev of ['dragonFire', 'dragonShock', 'dragonBoltStart', 'dragonBolt', 'dragonIce', 'bossSummon']) assert.ok(seen.has(ev), '放出过 ' + ev);
  assert.ok(worst < 0.9, '技能伤到了城墙：单次最多打掉 ' + Math.round((1 - worst) * 100) + '%');
  void hp0;
  // 第二、三阶段
  m.hp = m.maxHp * 0.6;
  b.step(1 / 60);
  assert.strictEqual(m.ai.phase, 2);
  m.hp = m.maxHp * 0.3;
  b.step(1 / 60);
  assert.strictEqual(m.ai.phase, 3);
  assert.strictEqual(m.ai.holdX, D_dragon().holdX3, '第三阶段压向城墙');
  for (let i = 0; i < 60 * 15; i++) {
    b.step(1 / 60);
    topUp();
  }
  assert.ok(m.x < D_dragon().holdX - 100, '第三阶段向前走');
  assert.ok(m.x >= D_dragon().holdX3 - 1);
  // 蓄力时集中火力可以打断
  m.ai.mode = 'warn'; m.ai.skill = 'fire'; m.ai.warnMax = m.ai.warnTimer = 2; m.ai.chargeDmg = 0;
  b.damage(m, m.maxHp * 0.1, { source: "test" });
  assert.notStrictEqual(m.ai.mode, 'warn', '被打断');
  assert.ok(m.stunUntil > b.time, '打断后眩晕');
});
function D_dragon() { return TD.data.abyssDragon; }

// ---------- v1.14：设置里的测试模式（密码开启：资源拉满、所有关卡随便选） ----------
test('测试模式：密码不对不开；密码对了资源拉满、第 200 关也能直接选；普通存档不受影响', () => {
  const s = P.newSave();
  assert.ok(!P.isUnlocked(s, 200) && P.isUnlocked(s, 1));
  assert.ok(!P.enableTestMode(s, 'wrong') && !P.enableTestMode(s, 'linsstdtest') && !P.testMode(s) && !P.isUnlocked(s, 5));
  assert.ok(P.enableTestMode(s, '1314520'));
  assert.ok(P.testMode(s) && P.isUnlocked(s, 200) && P.isUnlocked(s, 101));
  assert.strictEqual(s.copper, P.MAX_CURRENCY);
  assert.strictEqual(s.silver, P.MAX_CURRENCY);
  assert.strictEqual(s.gold, P.MAX_CURRENCY);
  assert.strictEqual(s.diamond, P.MAX_DIAMOND);
  assert.ok(!P.isUnlocked(P.newSave(), 200));
  // 所有需要通关才能解锁的东西都解锁：英雄、伙伴、栏位、商店页签、小镇、各种模式
  for (const id of Object.keys(TD.config.heroes)) assert.ok(P.heroUnlocked(s, id), '英雄 ' + id);
  for (const f of D.town) assert.ok(P.buddyUnlocked(s, f.boss), '伙伴 ' + f.boss);
  for (const kind of Object.keys(D.slotUnlocks)) assert.strictEqual(P.slotCount(s, kind), D.slotUnlocks[kind].length, '栏位 ' + kind);
  assert.ok(TD.modes.endlessUnlocked(s) && TD.modes.dailyUnlocked(s) && TD.modes.towerUnlocked(s));
  assert.strictEqual(P.highestCleared(s), Math.max(...Object.keys(D.levels).map(Number)));
  const fresh = P.newSave();
  assert.ok(Object.keys(TD.config.heroes).some((id) => !P.heroUnlocked(fresh, id)), '普通存档的英雄仍然要通关解锁');
  assert.ok(Object.keys(D.slotUnlocks).some((k) => P.slotCount(fresh, k) < D.slotUnlocks[k].length), '普通存档的栏位仍然要通关解锁');
  assert.strictEqual(Object.keys(s.levels).length, 0, '测试模式只改判断，不写关卡记录');
});

// ---------- v1.14：怪物所有属性随关卡增强；妖塔第 N 层 = 第 1 层的 N 倍 ----------
test('怪物属性随关卡增强：护甲 / 魔抗 / 速度单调增长，护甲有上限；妖塔第 9 层所有属性是第 1 层的 9 倍', () => {
  const C = TD.config;
  let pa = 0, ps = 0;
  for (const n of [1, 10, 30, 50, 100, 150, 200]) {
    const sc = C.monsterScale(n);
    assert.ok(sc.armor >= pa && sc.speed >= ps, '随关卡单调增长');
    pa = sc.armor; ps = sc.speed;
  }
  assert.ok(C.monsterScale(1).armor < 1.05 && C.monsterScale(200).armor > 2.2 && C.monsterScale(200).speed > 1.25);
  assert.strictEqual(C.scaledArmor(0, 3), 0, '没有护甲的怪物不会凭空长出护甲');
  assert.strictEqual(C.scaledArmor(250, 3), 250, '本来就超过上限的不再涨');
  assert.strictEqual(C.scaledArmor(70, 3), C.armorCap, '涨到上限为止');
  assert.ok(Math.abs(C.scaledArmor(20, 2) - 40) < 1e-9);
  // 实战：第 100 关的有甲怪比第 1 关的更难打、更快
  const b1 = newBattle(1);
  const b100 = newBattle(100);
  const armored = Object.keys(D.monsters).find((k) => !D.monsters[k].boss && D.monsters[k].armor >= 20 && D.monsters[k].armor <= 60 && !D.monsters[k].towerOf);
  const m1 = b1.spawnMonster(armored, 0, 900);
  const m100 = b100.spawnMonster(armored, 0, 900);
  assert.ok(b100.armorFactor(m100, false, 'phys', 0) < b1.armorFactor(m1, false, 'phys', 0));
  assert.ok(b100.monsterSpeed(m100) > b1.monsterSpeed(m1));
  // 妖塔：第 N 层是第 1 层的 N 倍（生命、攻城伤害、护甲 / 魔抗的倍数）
  const s = P.newSave();
  clearUpTo(s, 70);
  const mk = (floor) => {
    const def = TD.modes.buildTower(s, floor);
    const tb = new TD.Battle({ level: 'tower', levelDef: def, stage: def.stage, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 2 });
    for (let i = 0; i < 60 * 30 && !tb.bossHpD; i++) tb.step(1 / 60);
    const m = tb.spawnMonster('tw_boarKing', 0, 600);
    const k = tb.spawnMonster('slime', 1, 600);
    return { m, k };
  };
  const f1 = mk(1);
  const f9 = mk(9);
  for (const key of ['m', 'k']) {
    assert.ok(Math.abs(f9[key].maxHp / f1[key].maxHp - 9) < (key === 'k' ? 1 : 0.01), key + ' 生命 ×9（小怪血量小，取整误差放宽）');
    assert.ok(Math.abs(f9[key].dps / f1[key].dps - 9) < 0.01, key + ' 攻城伤害 ×9');
    assert.ok(Math.abs(f9[key].armorMult / f1[key].armorMult - 9) < 1e-9, key + ' 护甲倍数 ×9');
  }
});

// ---------- v1.15：焚天巨龙有两条命 ----------
test('焚天巨龙两条命：第一条命倒下 → 趴下不受伤 → 化作黑龙（生命 / 伤害 ×3、阶段重来）→ 第二条命打完才算赢', () => {
  const G = TD.data.abyssDragon;
  const b = newBattle(200);
  b.wall.max = b.wall.hp = 1e15;
  const m = b.spawnMonster('abyssDragon', 2, 800);
  const hp1 = m.maxHp;
  const seen = new Set();
  for (const ev of ['dragonFall', 'dragonRebirth']) b.on(ev, () => seen.add(ev));
  b.damage(m, hp1 * 4, { source: 'test' });
  assert.ok(!m.dead && m.fallen && m.hp === 1 && seen.has('dragonFall'), '第一条命打光：没死，趴下了');
  assert.ok(!b.isTargetable(m) && b.damage(m, 1e12, { source: 'test' }) === 0, '倒下期间打不到');
  assert.strictEqual(b.monsters.filter((x) => !x.dead && x.def.boss).length, 1);
  for (let i = 0; i < 60 * (G.rebirthDelay + 0.5); i++) b.step(1 / 60);
  assert.ok(seen.has('dragonRebirth') && !m.fallen && m.ai.form === 2, '过一会儿化作黑龙');
  assert.strictEqual(m.def.name, '灭世黑龙');
  assert.strictEqual(m.maxHp, hp1 * G.rebirthMult);
  assert.strictEqual(m.hp, m.maxHp, '满血');
  assert.strictEqual(m.ai.phase, 1, '阶段重来');
  assert.ok(b.isTargetable(m));
  // 黑龙的伤害是原来的 3 倍，单次最多 hitCap
  assert.ok(Math.abs(b.dragonHit(m, 0.15) - 0.45 * b.wall.max) < 1 && Math.abs(b.dragonHit(m, 0.2) - G.hitCap * b.wall.max) < 1);
  m.ai.form = 1;
  assert.ok(Math.abs(b.dragonHit(m, 0.15) - 0.15 * b.wall.max) < 1);
  m.ai.form = 2;
  // 第二条命打光才是真的死；关卡才能赢（第 200 关）
  b.damage(m, m.maxHp * 4, { source: 'test' });
  assert.ok(m.dead, '第二条命打光 = 死');
});

// ---------- v1.20：巨龙放弃图片素材，纯矢量重画（设计书 121） ----------
test('巨龙矢量画法：红 / 黑 / 倒下 / 四个技能的预备和释放都能画，且不依赖图片素材；嘴的位置随技能变化', () => {
  const fs = require('fs');
  const path = require('path');
  const root = path.join(__dirname, '..');
  assert.ok(!fs.existsSync(path.join(root, 'assets', 'dragon')), '图片素材已经删掉');
  assert.ok(!fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes('assets/dragon'), 'Service Worker 不再缓存巨龙素材');
  // 画法文件平时不在 Node 测试里加载：加载一份新的，用完把原来的还回去
  const saved = TD.creatures;
  for (const f of ['creatures.js', 'creatures/abyss.js']) delete require.cache[require.resolve(path.join(root, 'src', 'render', f))];
  delete TD.creatures;
  require(path.join(root, 'src', 'render', 'creatures.js'));
  require(path.join(root, 'src', 'render', 'creatures', 'abyss.js'));
  const K = TD.creatures;
  TD.creatures = saved;
  const calls = [];
  const ctx = new Proxy({}, { get: (t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : k === 'createPattern' ? () => ({}) : k === 'measureText' ? () => ({ width: 1 }) : (...a) => calls.push(k)), set: () => true });
  const draw = K.drawers.abyssDragon;
  const states = [
    { form: 1, phase: 1, mode: 'walk' },
    { form: 1, phase: 3, mode: 'walk' },
    { form: 2, phase: 2, mode: 'walk' },
    { form: 1, phase: 1, fallen: true, rebirthTimer: 3, rebirthMax: 5 },
    { form: 2, phase: 1, fallen: true, rebirthTimer: 1, rebirthMax: 5 },
  ];
  for (const skill of ['fire', 'shock', 'bolt', 'ice']) {
    states.push({ form: 1, phase: 2, mode: 'warn', skill, warnTimer: 1, warnMax: 2 });
    states.push({ form: 2, phase: 1, mode: 'walk', anim: { fire: 'fire', shock: 'ram', bolt: 'bolt', ice: 'ice' }[skill], animTimer: 0.8 });
  }
  for (const ai of states) for (const t of [0, 1.7, 4.2]) assert.doesNotThrow(() => draw(ctx, 290, t, { ai }), JSON.stringify(ai));
  assert.ok(calls.length > 2000, '细节很多（鳞片、翼骨、牙、裂纹）');
  const walk = K.dragonMouthAt('walk');
  const fire = K.dragonMouthAt(true);
  const bolt = K.dragonMouthAt('bolt');
  assert.ok(walk.x < -0.5 && fire.x < -0.5 && bolt.x < -0.5, '嘴在身体左边（朝城墙）');
  assert.ok(Math.abs(walk.x - fire.x) > 0.01 || Math.abs(walk.y - fire.y) > 0.01, '喷火时头的姿势和行走不同');
  assert.ok(Math.abs(bolt.y - walk.y) > 0.01, '雷击时头的姿势也不同');
});

// ---------- v1.18：寒冰冻住英雄 3 秒、雷击电麻 2 秒（设计书 119） ----------
test('巨龙的寒冰和雷击：寒冰把英雄冻住 3 秒，雷击把英雄电麻 2 秒；避雷针（免疫眩晕）挡得住', () => {
  const G = TD.data.abyssDragon;
  assert.strictEqual(G.ice.freeze, 3);
  assert.strictEqual(G.bolt.heroStun, 2);
  const mk = () => {
    const b = newBattle(200);
    b.wall.max = b.wall.hp = 1e15;
    const m = b.spawnMonster('abyssDragon', 2, 800);
    return { b, m };
  };
  let { b, m } = mk();
  const events = [];
  b.on('heroStun', (e) => events.push(e));
  m.ai.skill = 'ice';
  b.castDragonSkill(m);
  assert.ok(Math.abs(b.heroStunUntil - b.time - 3) < 1e-9 && b.heroStunKind === 'freeze', '冻住 3 秒');
  assert.ok(b.wall.hp < b.wall.max, '寒冰也打城墙');
  assert.deepStrictEqual(events.map((e) => [e.kind, e.duration]), [['freeze', 3]]);
  ({ b, m } = mk());
  m.ai.skill = 'bolt';
  b.castDragonSkill(m);
  assert.ok(Math.abs(b.heroStunUntil - b.time - 2) < 1e-9 && b.heroStunKind === 'shock', '电麻 2 秒');
  // 避雷针：免疫
  ({ b, m } = mk());
  b.mods.stunImmune = 1;
  m.ai.skill = 'ice';
  b.castDragonSkill(m);
  assert.strictEqual(b.heroStunUntil, 0, '免疫眩晕时冻不住');
  // 英雄被控制时不能射击
  ({ b, m } = mk());
  m.ai.skill = 'ice';
  b.castDragonSkill(m);
  assert.ok(b.time < b.heroStunUntil);
});

// ---------- v1.21：战斗 HUD 每帧刷新的文字不能每帧都改 DOM（设计书 122） ----------
test('战斗 HUD：updateHud 里的文字都走 setText（内容没变不碰 DOM），否则 60 帧下多语言观察器会误判并停止翻译', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', 'ui.js'), 'utf8');
  const a = src.indexOf('UI.updateHud = function');
  const body = src.slice(a, src.indexOf('\n  };\n', a));
  assert.ok(a > 0 && body.length > 500);
  assert.ok(!/\.textContent\s*=/.test(body), 'updateHud 里不要直接写 textContent');
  assert.ok((body.match(/setText\(/g) || []).length >= 10);
  // setText 本身：内容一样就不动
  const h = src.slice(src.indexOf('function setText'), src.indexOf('UI.updateHud = function'));
  assert.ok(/_raw === text\) return/.test(h));
  // 嵌在网页里不显示「退出游戏」
  assert.ok(/UI\.embedded\(\) \? null : h\('button', \{ class: 'btn quit'/.test(src));
});
