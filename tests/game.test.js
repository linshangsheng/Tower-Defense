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
  assert.strictEqual(P.skillUpgradeCost(s, 'thunder'), null, '满级');
  assert.strictEqual(P.skillDef('thunder', 3).atkMult, 7);
  assert.strictEqual(P.skillDef('thunder', 1).atkMult, 5);
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
  const b = new TD.Battle({ level: 40, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  b.startWave(2);
  assert.strictEqual(b.spawnQueue.filter((x) => x === 'frostQueen').length, 1);
  assert.strictEqual(b.spawnQueue.filter((x) => x === 'wolf').length, 12);
  lvl.countMult = old;
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
  assert.ok(Math.abs(b2.monsterSpeed(m) - D.monsters.slime.speed * 1.3) < 1e-9);
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
    if (t === 'boss' || t === 'miniboss') assert.ok(D.story['pre' + n] && D.story['post' + n], `第 ${n} 关缺对话`);
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

test('衣柜：按进度解锁，未解锁不能穿，新外观只提示一次', () => {
  const s = P.newSave();
  assert.strictEqual(s.outfit, 'classic');
  assert.ok(!P.setOutfit(s, 'meadow'));
  assert.strictEqual(P.newOutfits(s).length, 0);
  clearUpTo(s, 10);
  assert.ok(P.setOutfit(s, 'meadow'));
  assert.strictEqual(s.outfit, 'meadow');
  assert.deepStrictEqual(P.newOutfits(s).map((o) => o.id), ['meadow']);
  assert.strictEqual(P.newOutfits(s).length, 0);
  for (let k = 1; k <= 50; k++) s.levels[k] = { stars: 3, clears: 1 };
  assert.ok(!P.outfitUnlocked(s, 'gold'), '金甲勇士要全部王冠');
  for (let k = 1; k <= 50; k++) s.levels[k].crown = true;
  assert.ok(D.outfits.every((o) => P.outfitUnlocked(s, o.id)));
  // 外观只是颜色：每套都有完整的颜色表
  for (const o of D.outfits) for (const k of ['cape', 'body', 'helmTop', 'helmBottom', 'brim', 'plume', 'plumeHi', 'shield', 'shieldHi']) assert.ok(o.colors[k], `${o.id}.${k}`);
});

test('衣柜：通关结算提示新外观', () => {
  const s = P.newSave();
  clearUpTo(s, 9);
  s.levels[10] = { stars: 0, clears: 0 };
  const r = P.applyResult(s, 10, { win: true, wallRatio: 0.5, killCopper: 0 });
  assert.ok(r.unlocks.some((x) => x.includes('草原游侠')));
});

test('挑战王冠：挑战难度通关得王冠和 1 银，只给一次；标准难度不给', () => {
  const s = P.newSave();
  const win = { win: true, wallRatio: 1, killCopper: 0 };
  P.applyResult(s, 1, win);
  assert.ok(!s.levels[1].crown);
  s.settings.difficulty = 'hard';
  const silver0 = s.silver;
  const r = P.applyResult(s, 1, win);
  assert.ok(s.levels[1].crown);
  assert.ok(r.notes.some((x) => x.includes('王冠')));
  assert.ok(s.silver >= silver0 + 1);
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
  const bosses = Object.keys(D.monsters).filter((t) => D.monsters[t].boss);
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

test('Boss 连战：通关第 60 关解锁，12 波各一个 Boss，打败当前 Boss 才来下一波；结算记录打败数', () => {
  const s = P.newSave();
  assert.ok(!TD.modes.bossRushUnlocked(s));
  clearUpTo(s, 60);
  assert.ok(TD.modes.bossRushUnlocked(s));
  const def = TD.modes.buildBossRush();
  assert.strictEqual(def.waves.length, 12);
  for (const w of def.waves) assert.strictEqual(w.groups.filter(([t]) => D.monsters[t].boss).length, 1);
  const b = new TD.Battle({ level: 'bossrush', levelDef: def, stage: def.stage, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  for (let i = 0; i < 60 * 60 && !b.over; i++) {
    if (b.pendingSupply) b.chooseSupply(b.pendingSupply[0]);
    b.step(1 / 60);
  }
  assert.strictEqual(b.waveIndex, 0, '第一个 Boss 没打败时不会来第二波');
  const r = TD.modes.applyBossRushResult(s, { killsByType: { jellyPrince: 1, boarKing: 1, slime: 9 }, killCopper: 10, time: 300 });
  assert.strictEqual(r.beaten, 2);
  assert.strictEqual(r.silver, 2);
  assert.strictEqual(s.bossRush.best, 2);
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

test('统计：普通关卡、无尽、每日、Boss 连战都用同一套累计（含提前召唤）', () => {
  const s = P.newSave();
  clearUpTo(s, 60);
  const r = { kills: 5, earlyCalls: 2, interrupts: 1, supplies: ['sharp'], killsByType: { slime: 5 }, bestStreak: 7, combos: { shatter: 1 }, time: 100 };
  TD.modes.applyBossRushResult(s, r);
  TD.modes.applyEndlessResult(s, Object.assign({ wavesCleared: 3 }, r));
  assert.strictEqual(s.stats.battles, 2);
  assert.strictEqual(s.stats.earlyCalls, 4);
  assert.strictEqual(s.stats.kills, 10);
  assert.strictEqual(s.stats.combos, 2);
  assert.strictEqual(s.stats.killsByType.slime, 10);
  assert.strictEqual(s.stats.wins, 0);
});
