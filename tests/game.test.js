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
