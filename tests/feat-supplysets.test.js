const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load');
const P = TD.progression;
const D = TD.data;

function battle(n) {
  const s = P.newSave();
  for (let k = 1; k < n; k++) s.levels[k] = { stars: 1, clears: 1 };
  return new TD.Battle({ level: n, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 3 });
}

test('补给羁绊：数据有效，两张卡都存在', () => {
  assert.ok(D.supplySets.length >= 8);
  for (const s of D.supplySets) {
    assert.strictEqual(s.cards.length, 2);
    for (const id of s.cards) assert.ok(D.supplies[id], id);
    for (const k of Object.keys(s.mods)) assert.ok(k in battle(5).mods, `mod ${k}`);
  }
});

test('补给羁绊：凑齐两张后生效一次，加成叠到 mods 上', () => {
  const b = battle(12);
  let ev = null;
  b.on('supplySet', (e) => (ev = e));
  b.startWave(0);
  b.pendingSupply = ['sharp', 'quick', 'purse'];
  const crit0 = b.mods.crit;
  b.chooseSupply('sharp');
  assert.strictEqual(ev, null);
  assert.deepStrictEqual(b.supplySetHint('eagle'), { kind: 'complete', set: D.supplySets.find((s) => s.id === 'marksman') });
  assert.strictEqual(b.supplySetHint('quick').kind, 'part');
  b.pendingSupply = ['eagle', 'quick', 'purse'];
  b.chooseSupply('eagle');
  assert.ok(ev && ev.set.id === 'marksman');
  assert.ok(Math.abs(b.mods.crit - (crit0 + 0.08 + 0.06)) < 1e-9);
  assert.deepStrictEqual(b.activeSets, ['marksman']);
  assert.strictEqual(b.checkSupplySets().length, 0, '不会重复生效');
  assert.strictEqual(b.supplySetHint('sharp'), null);
});

test('补给羁绊：拿了一半后，三选一里出现另一半的机会明显变高', () => {
  let seen = 0;
  const N = 300;
  for (let i = 0; i < N; i++) {
    const b = battle(12);
    b.rng = TD.util.rng ? TD.util.rng(1000 + i) : b.rng;
    b.supplyPicked = ['sharp'];
    if (b.rollSupply().includes('eagle')) seen++;
  }
  assert.ok(seen / N > 0.3, `partner shows ${seen}/${N}`);
});

test('补给羁绊：结果里的羁绊记进档案，成就按发现数量达成（设计书 207）', () => {
  const s = P.newSave();
  const five = D.supplySets.slice(0, 5).map((x) => x.id);
  P.recordStats(s, { kills: 1, supplySets: five }, true);
  for (const id of five) assert.ok(s.stats.setsFound[id]);
  let got = P.checkAchievements(s).map((a) => a.id);
  assert.ok(got.includes('sets5') && !got.includes('setsAll'));
  P.recordStats(s, { kills: 1, supplySets: D.supplySets.map((x) => x.id) }, true);
  got = P.checkAchievements(s).map((a) => a.id);
  assert.ok(got.includes('setsAll'));
  s.stats.setsFound = 'bad';
  P.recordStats(s, { kills: 1, supplySets: ['marksman'] }, true);
  assert.deepStrictEqual(s.stats.setsFound, { marksman: true });
});

test('新玩法补给卡（设计书 211）：只给真人，要 Boss 的卡只在有 Boss 的关卡；效果正确', () => {
  const s = P.newSave();
  const bot = new TD.Battle({ level: 30, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 2, autoSupply: true });
  for (let i = 0; i < 80; i++) for (const id of bot.rollSupply()) assert.ok(!D.supplies[id].humanOnly, '机器人抽到了 ' + id);
  const human = battle(12);
  let weak = 0;
  for (let i = 0; i < 200; i++) if (human.rollSupply().includes('weakExpert')) weak++;
  assert.strictEqual(weak, 0, '第 12 关没有 Boss，不出弱点专家');
  // 完美主义者：每次完美防守攻击 +4%，最多 5 层；铜币 ×2
  const b = battle(12);
  b.mods.perfectAtk = 0.04;
  b.mods.perfectCopper = 1;
  const atk0 = b.mods.atkMult;
  for (let i = 0; i < 7; i++) {
    b.waveIndex = i;
    b.markPerfectWave();
    b.checkPerfectWave();
  }
  assert.ok(Math.abs(b.mods.atkMult - atk0 - 0.2) < 1e-9);
  assert.strictEqual(b.perfectStacks, 5);
});

test('新玩法卡的羁绊（设计书 216）：满载而归让铜钱袋翻倍，无懈可击完美时回血', () => {
  const b = battle(12);
  b.startWave(0);
  b.pendingSupply = ['scavengerBag', 'quick', 'eagle'];
  b.chooseSupply('scavengerBag');
  b.pendingSupply = ['purse', 'quick', 'eagle'];
  b.chooseSupply('purse');
  assert.ok(b.activeSets.includes('bountiful'));
  const cu = b.killCopper;
  b.collectDrop({ kind: 'purse', amount: 50, x: 0, y: 0 });
  assert.strictEqual(b.killCopper - cu, 100);
  const c = battle(12);
  c.mods.perfectHeal = 0.03;
  c.wall.hp = c.wall.max * 0.5;
  c.waveIndex = 0;
  c.markPerfectWave();
  c.checkPerfectWave();
  assert.ok(c.wall.hp > c.wall.max * 0.52);
});
