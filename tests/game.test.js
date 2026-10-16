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
  for (let k = 1; k <= 70; k++) s.levels[k] = { stars: 3, clears: 1 };
  assert.ok(!P.outfitUnlocked(s, 'gold'), '金甲勇士要全部王冠');
  for (let k = 1; k <= 70; k++) s.levels[k].crown = true;
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
  const def = TD.modes.buildBossRush(s);
  assert.strictEqual(def.waves.length, 12, '通关第七章前只有 12 个 Boss');
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

test('Boss 连战：通关第七章后贝贝和波波加入，共 14 个', () => {
  const s = P.newSave();
  clearUpTo(s, 70);
  assert.strictEqual(TD.modes.buildBossRush(s).waves.length, 14);
  const r = TD.modes.applyBossRushResult(s, { killsByType: { jellyPrince: 1 }, killCopper: 0, time: 100 });
  assert.strictEqual(r.total, 14);
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
test('装备扩充：24 件装备，每件栏位合法；套装部件存在且属于该套装', () => {
  assert.strictEqual(Object.keys(D.equipment).length, 24);
  for (const id of Object.keys(D.equipment)) assert.ok(D.equipSlots[D.equipment[id].slot], id);
  for (const k of Object.keys(D.gearSets)) for (const id of D.gearSets[k].parts) assert.strictEqual(D.equipment[id].set, k, id);
});

test('装备上架：没到关卡买不了；箭袋栏位通关第 15 关才生效', () => {
  const s = P.newSave();
  s.copper = 10000;
  clearUpTo(s, 14);
  assert.ok(!P.buyEquip(s, 'leatherQuiver'), '第 15 关前没上架');
  clearUpTo(s, 15);
  assert.ok(P.buyEquip(s, 'leatherQuiver'));
  assert.strictEqual(s.loadout.equip.quiver, 'leatherQuiver', '自动穿上');
  const base = P.heroStats(P.newSave()).critDmg;
  assert.ok(Math.abs(P.heroStats(s).critDmg - base - 0.15) < 1e-9);
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
  b.items = [{ id: 'freeze', def: D.items.freeze, used: false }];
  b.useItem(0, 0);
  assert.ok(Math.abs(m.frozenUntil - b.time - 3.9) < 1e-9);
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
  assert.strictEqual(TD.config.exchange.diamondObtainable, false);
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
  s.copper = 1000;
  assert.ok(P.buyEquip(s, 'ironHelm'));
  assert.strictEqual(s.loadout.equip.helm, 'ironHelm');
  assert.strictEqual(s.copper, 880);
  assert.deepStrictEqual(P.sellEquip(s, 'ironHelm'), { copper: 60 });
  assert.strictEqual(s.copper, 940);
  assert.strictEqual(s.loadout.equip.helm, null);
  assert.ok(!s.equipOwned.ironHelm);
  assert.strictEqual(P.sellEquip(s, 'ironHelm'), null);
  assert.ok(P.buyEquip(s, 'ironHelm'), '可以买回');
  assert.strictEqual(s.copper, 820);
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
  s.loadout.items = [id, null, null];
  const b = new TD.Battle({ level: level || 41, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 3 });
  b.waveState = 'spawning';
  return b;
}
const bigHp = (m) => ((m.hp = m.maxHp = 1e9), m);

test('消耗品：共 16 种（含被动幸运符），价格按铜 → 银 → 金分档', () => {
  const ids = Object.keys(D.items);
  assert.strictEqual(ids.length, 16);
  const tier = (it) => (it.cost.gold ? 3 : it.cost.silver ? 2 : 1);
  for (const id of ['firebomb', 'bomb', 'patch', 'haste', 'freeze']) assert.strictEqual(tier(D.items[id]), 1, id);
  for (const id of ['thunderScroll', 'bigBomb', 'barrier', 'warBanner', 'quake']) assert.strictEqual(tier(D.items[id]), 2, id);
  for (const id of ['blizzard', 'flood', 'holyLight', 'meteor', 'chrono']) assert.strictEqual(tier(D.items[id]), 3, id);
  assert.ok(D.items.chrono.cost.gold > D.items.blizzard.cost.gold, '时间静止比暴风雪更贵');
  assert.ok(D.items.quake.cost.silver > D.items.thunderScroll.cost.silver);
});

test('暴风雪卷轴：冻结全体 8 秒，Boss 4 秒，解冻后减速', () => {
  const b = itemBattle('blizzard');
  const a = bigHp(b.spawnMonster('slime', 0, 600));
  const c = bigHp(b.spawnMonster('slime', 3, 900));
  const boss = bigHp(b.spawnMonster('boarKing', 1, 700));
  assert.ok(b.useItem(0, 0));
  assert.ok(Math.abs(a.frozenUntil - b.time - 8) < 1e-9 && Math.abs(c.frozenUntil - b.time - 8) < 1e-9, '所有车道的怪都冻住');
  assert.ok(Math.abs(boss.frozenUntil - b.time - 4) < 1e-9, 'Boss 只冻一半时间');
  assert.ok(boss.stunUntil >= b.time + 4 - 1e-9, 'Boss 的行动也停下');
  assert.ok(a.slowUntil > a.frozenUntil && Math.abs(a.slowAmt - 0.6) < 1e-9, '解冻后还有减速');
  const x0 = a.x;
  for (let i = 0; i < 60; i++) b.step(1 / 60);
  assert.strictEqual(a.x, x0, '冻住的怪不会走');
  const fresh = bigHp(b.spawnMonster('slime', 2, 800));
  assert.ok(Math.abs(b.damageMult(a, { source: 'weapon' }) / b.damageMult(fresh, { source: 'weapon' }) - 2) < 1e-9, '冻住期间伤害翻倍');
});

test('洪水：全体后退 500（Boss 150），受伤并减速，不会退出出怪点之外', () => {
  const b = itemBattle('flood');
  const a = bigHp(b.spawnMonster('slime', 0, 600));
  const edge = bigHp(b.spawnMonster('slime', 1, 1250));
  const boss = bigHp(b.spawnMonster('boarKing', 2, 700));
  const hp0 = a.hp;
  b.useItem(0, 0);
  assert.strictEqual(a.x, 1100);
  assert.strictEqual(boss.x, 850);
  assert.ok(edge.x <= TD.config.spawnX + 60);
  assert.ok(a.hp < hp0, '洪水有伤害');
  assert.ok(Math.abs(a.slowAmt - 0.7) < 1e-9 && a.slowUntil > b.time);
  assert.ok(Math.abs(b.damageMult(a, { source: 'weapon' }) - 1.6) < 1e-9, '被浸湿的怪伤害 +60%');
});

test('时间静止：连 Boss 也冻住 10 秒，英雄攻速 +100%', () => {
  const b = itemBattle('chrono');
  const boss = bigHp(b.spawnMonster('boarKing', 0, 700));
  const m = bigHp(b.spawnMonster('slime', 1, 700));
  const asp0 = b.currentAspd();
  b.useItem(0, 0);
  assert.ok(Math.abs(boss.frozenUntil - b.time - 10) < 1e-9 && boss.stunUntil >= b.time + 10 - 1e-9);
  assert.ok(Math.abs(m.frozenUntil - b.time - 10) < 1e-9);
  assert.ok(b.currentAspd() / asp0 > 1.99 && b.currentAspd() / asp0 < 2.01);
  assert.strictEqual(b.monsterSpeed(boss), 0);
  assert.ok(Math.abs(b.damageMult(m, { source: 'weapon' }) - 3) < 1e-9, '冻住期间伤害 ×3');
});

test('地震符：全体眩晕 3 秒（Boss 1.5 秒）并受伤', () => {
  const b = itemBattle('quake');
  const m = bigHp(b.spawnMonster('slime', 0, 900));
  const boss = bigHp(b.spawnMonster('boarKing', 1, 900));
  const h0 = m.hp;
  b.useItem(0, 0);
  assert.ok(Math.abs(m.stunUntil - b.time - 3) < 1e-9);
  assert.ok(Math.abs(boss.stunUntil - b.time - 1.5) < 1e-9);
  assert.ok(m.hp < h0, '有伤害（射程外也算全场）');
});

test('守护符文：护盾先吸收 50% 最大血量，打完才扣城墙', () => {
  const b = itemBattle('barrier');
  b.useItem(0, 0);
  const shield = b.wall.max * 0.5;
  assert.ok(Math.abs(b.itemShield - shield) < 1e-9);
  b.hitWall(shield / 2);
  assert.strictEqual(b.wall.hp, b.wall.max, '护盾没破，城墙不掉血');
  b.hitWall(shield);
  assert.ok(b.itemShield === 0 && b.wall.hp < b.wall.max);
});

test('战旗：攻击力 +40%，10 秒后恢复', () => {
  const b = itemBattle('warBanner');
  const a0 = b.atk;
  b.useItem(0, 0);
  assert.ok(Math.abs(b.atk / a0 - 1.4) < 1e-9);
  b.time += 10.5;
  assert.ok(Math.abs(b.atk / a0 - 1) < 1e-9);
});

test('圣光：回满城墙并让之后 10 秒的城墙伤害 −80%', () => {
  const b = itemBattle('holyLight');
  b.wall.hp = b.wall.max * 0.2;
  b.useItem(0, 0);
  assert.ok(Math.abs(b.wall.hp - b.wall.max) < 1e-6);
  const before = b.wall.hp;
  b.hitWall(100);
  const lost = before - b.wall.hp;
  assert.ok(lost < 100 * 0.25, '减伤约 80%：' + lost);
  b.time += 11;
  const before2 = b.wall.hp;
  b.hitWall(100);
  assert.ok(before2 - b.wall.hp > 80, '10 秒后恢复正常');
});

test('雷霆符：劈血量最高的 5 只；燃烧瓶打一条车道并点燃；重磅炸弹打三条车道', () => {
  const b = itemBattle('thunderScroll');
  const ms = [1, 2, 3, 4, 5, 6, 7].map((i) => {
    const m = b.spawnMonster('slime', i % 3, 500 + i * 20);
    m.hp = m.maxHp = 1e8 + i;
    return m;
  });
  const hp0 = ms.map((m) => m.hp);
  b.useItem(0, 0);
  const hit = ms.filter((m, i) => m.hp < hp0[i]);
  assert.strictEqual(hit.length, 5);
  assert.ok(ms.slice(2).every((m) => hit.includes(m)), '打中的是血量最高的 5 只');

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

test('陨石雨：18 颗陆续砸下，周围吃六成', () => {
  const b = itemBattle('meteor');
  const m = bigHp(b.spawnMonster('slime', 0, 500));
  const near = bigHp(b.spawnMonster('slime', 0, 550));
  let lands = 0;
  b.on('meteorHit', () => lands++);
  b.useItem(0, 0);
  for (let i = 0; i < 60 * 5; i++) b.step(1 / 60);
  assert.strictEqual(lands, 18);
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
test('武器：15 把，每个品质 3 把，价格逐档上涨，升级费用逐档上涨', () => {
  const ids = Object.keys(D.weapons);
  assert.strictEqual(ids.length, 15);
  const byR = {};
  for (const id of ids) (byR[D.weapons[id].rarity] = byR[D.weapons[id].rarity] || []).push(id);
  assert.deepStrictEqual(Object.keys(byR), ['1', '2', '3', '4', '5']);
  for (const r of Object.keys(byR)) assert.strictEqual(byR[r].length, 3, '品质 ' + r);
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
  for (const id of ['bow', 'frostBow', 'genesisBow']) s.weapons[id] = { owned: true, lv: 3, asc: false };
  const c = (id) => P.weaponUpgradeCost(s, id).copper;
  assert.ok(c('bow') < c('frostBow') && c('frostBow') < c('genesisBow'), '品质越高升级越贵');
  for (const id of ids) if (D.weapons[id].look) assert.ok(['bow', 'crossbow', 'staff', 'orb', 'cannon', 'boomerang'].includes(D.weapons[id].look.base), id);
});

test('武器解锁关卡：没通关到不能买；老存档自动补上新武器', () => {
  const s = P.newSave();
  s.silver = 100;
  s.gold = 100;
  clearUpTo(s, 9);
  assert.ok(!P.buyWeapon(s, 'frostBow'), '第 10 关前不能买蓝色');
  clearUpTo(s, 10);
  assert.ok(P.buyWeapon(s, 'frostBow'));
  clearUpTo(s, 39);
  assert.ok(!P.buyWeapon(s, 'meteorCannon'));
  clearUpTo(s, 40);
  assert.ok(P.buyWeapon(s, 'meteorCannon'));
  assert.ok(!P.buyWeapon(s, 'genesisBow'));
  clearUpTo(s, 60);
  assert.ok(P.buyWeapon(s, 'genesisBow'));
  assert.strictEqual(s.gold, 100 - 8 - 20);
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

test('穿心长弓穿透 5 只；陨星炮对 Boss ×1.3 且无视 60% 护甲；风暴法球跳 5 次；时之回旋扔两支', () => {
  const b = weaponBattle('piercer');
  assert.strictEqual(b.weaponDef().pierce.count, 5);
  const ms = [500, 540, 580, 620, 660, 700].map((x) => {
    const m = b.spawnMonster('slime', 0, x);
    m.hp = m.maxHp = 1e9;
    return m;
  });
  b.pierceFrom(ms[0], { dmg: 100, crit: false, pierce: b.weaponDef().pierce, dmgType: 'phys' });
  assert.strictEqual(ms.filter((m) => m.hp < m.maxHp).length, 5, '后面最多 5 只被穿透（不含第一只）');
  const mc = weaponBattle('meteorCannon');
  assert.strictEqual(mc.weaponDef().bossMult, 1.3);
  assert.ok(Math.abs(mc.armorIgnore({ armorIgnore: mc.weaponDef().armorIgnore }) - 0.6) < 1e-9);
  assert.strictEqual(weaponBattle('stormOrb').weaponDef().chain.count, 5);
  const cb = weaponBattle('chronoBoomerang');
  const t = cb.spawnMonster('slime', 1, 500);
  t.hp = t.maxHp = 1e9;
  cb.fire([t]);
  assert.strictEqual(cb.projectiles.filter((p) => p.kind === 'boomerang').length, 2);
});

test('新武器的弹道带品质色；射出的弹道种类跟基础形状一致', () => {
  const b = weaponBattle('flameCrossbow');
  const m = b.spawnMonster('slime', 0, 500);
  m.hp = m.maxHp = 1e9;
  b.fire([m]);
  assert.ok(b.projectiles.every((p) => p.kind === 'bolt' && p.tint === '#ff9a4a'));
  assert.ok(weaponBattle('stormOrb').weaponDef().look.base === 'orb');
});

// ---------- 音乐与音效（设计书 64） ----------
function mockAudioCtx() {
  const calls = { osc: 0, noise: 0 };
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
  const node = () => ({ connect() {}, disconnect() {}, start() {}, stop() {}, gain: param(), frequency: param(), detune: param(), Q: param(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() });
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
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
  };
}

test('音乐：标题 + 七章共 8 首，每首 8 小节和弦、64 个八分音符位置，音高在合理范围', () => {
  globalThis.window = globalThis.window || undefined;
  delete require.cache[require.resolve('../src/render/music.js')];
  require('../src/render/music.js');
  const M = TD.music;
  for (let id = 0; id <= 7; id++) {
    const th = M.THEMES[id];
    assert.ok(th, `缺少第 ${id} 首`);
    assert.strictEqual(th.chords.length, 8);
    assert.strictEqual(th.notes.length, 64);
    const played = th.notes.filter(Boolean);
    assert.ok(played.length >= 14, `第 ${id} 首旋律音符太少`);
    for (const n of played) assert.ok(Number.isFinite(n.midi) && n.midi >= 60 && n.midi <= 96, `第 ${id} 首有越界音高 ${n.midi}`);
    assert.ok(th.bpm >= 70 && th.bpm <= 130);
  }
  assert.strictEqual(M.THEMES[5].lead, 'horn');
});

test('音乐：每首曲子在每种模式 / 紧张度下都能排完整个循环，且越紧张声音事件越多', () => {
  const M = TD.music;
  const events = {};
  for (let id = 0; id <= 7; id++) {
    for (const [mode, tension] of [['title', 0], ['calm', 0], ['battle', 0], ['battle', 1], ['battle', 2], ['battle', 3]]) {
      if (id === 0 && mode !== 'title') continue;
      if (id > 0 && mode === 'title') continue;
      const ctx = mockAudioCtx();
      const eng = new M.Engine(ctx, ctx.destination);
      eng.tension = tension;
      eng.setTheme(id, mode);
      eng.schedule(40); // 足够跑完 8 小节循环
      const n = ctx.calls.osc + ctx.calls.noise;
      assert.ok(n > 20, `第 ${id} 首 ${mode}/${tension} 几乎没有声音`);
      if (id === 1) events[mode + tension] = n / Math.min(40, eng.nextTime);
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
