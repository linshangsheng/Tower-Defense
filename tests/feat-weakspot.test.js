// Boss 弱点（设计书 198）
const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load.js');
const P = TD.progression;
const W = TD.config.weakSpot;

const mk = (lv) => {
  const s = P.newSave();
  const b = new TD.Battle({ level: lv, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 4 });
  b.hero.cooldown = 1e9; b.wall.hp = b.wall.max = 1e12; b.waveState = 'waiting';
  return b;
};

test('Boss 身上定时亮起弱点，过期消失；小怪没有', () => {
  const b = mk(10);
  const boss = b.spawnMonster('boarKing', 1, 700);
  const mob = b.spawnMonster('goblin', 1, 700);
  b.time = 1; b.updateWeakSpots();
  assert.ok(!boss.weak, '开场不立刻出现');
  b.time = 1 + W.first + 0.01; b.updateWeakSpots();
  assert.ok(boss.weak && !mob.weak, 'Boss 亮起弱点，小怪没有');
  b.time += W.life + 0.01; b.updateWeakSpots();
  assert.ok(!boss.weak, '过期消失');
});

test('点中弱点：造成最大血量约 2.5% 的伤害并踉跄；点偏不算；点完就没了', () => {
  const b = mk(10);
  const boss = b.spawnMonster('boarKing', 1, 700);
  boss.weakNext = 0; b.time = 5; b.updateWeakSpots();
  const p = b.weakPos(boss);
  assert.strictEqual(b.hitWeakAt(p.x + W.radius + 10, p.y), false, '点偏了');
  const hp0 = boss.hp;
  assert.strictEqual(b.hitWeakAt(p.x + 5, p.y - 5), true);
  const lost = hp0 - boss.hp;
  assert.ok(lost > boss.maxHp * W.dmgPct * 0.6 && lost <= boss.maxHp * W.dmgPct * 1.6, '伤害约为 2.5%：' + (lost / boss.maxHp).toFixed(4));
  assert.ok(boss.stunUntil > b.time, '踉跄');
  assert.ok(!boss.weak && b.weakHits === 1);
  assert.strictEqual(b.hitWeakAt(p.x, p.y), false, '同一个弱点只能点一次');
});

test('弱点次数计入战斗结果，今日任务池里有对应任务；妖塔妖王没有弱点', () => {
  const b = mk(10);
  b.weakHits = 2;
  b.finish(true);
  assert.strictEqual(b.result.weakHits, 2);
  assert.ok(TD.quests.POOL.weak);
  const tw = Object.keys(TD.data.monsters).find((k) => TD.data.monsters[k].towerOf);
  const b2 = mk(10);
  const m = b2.spawnMonster(tw, 1, 700);
  m.weakNext = 0; b2.time = 9; b2.updateWeakSpots();
  assert.ok(!m.weak);
});

test('Boss 蓄力（设计书 219）：66% / 33% 血量蓄力，点中打断，不点就狂暴；机器人对局没有', () => {
  const TD = require('../tools/load');
  const P = TD.progression;
  const D = TD.data;
  const s = P.newSave();
  const mk = (auto) => new TD.Battle({ level: 10, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1, autoSupply: auto });
  const bossType = Object.keys(D.monsters).find((k) => D.monsters[k].boss && !D.monsters[k].towerOf && !D.monsters[k].flying);
  const b = mk(false);
  const m = b.spawnMonster(bossType, 0, 700);
  m.hp = m.maxHp * 0.6;
  let ev = [];
  for (const k of ['bossRage', 'rageBroken', 'rageLand']) b.on(k, () => ev.push(k));
  b.updateWeakSpots();
  assert.ok(m.rage && m.weak && m.weak.rage);
  const p = b.weakPos(m);
  const hp0 = m.hp;
  assert.ok(b.hitWeakAt(p.x + 45, p.y), '大号弱点，偏 45 像素也算');
  assert.ok(m.hp < hp0 - m.maxHp * 0.04);
  assert.ok(m.stunUntil >= b.time + 1.9);
  assert.strictEqual(b.rageBreaks, 1);
  // 第二档：不点，时间到了狂暴
  m.hp = m.maxHp * 0.3;
  b.updateWeakSpots();
  assert.ok(m.rage);
  b.time += TD.config.bossRage.windup + 0.01;
  b.updateWeakSpots();
  assert.ok(!m.rage && m.rushUntil > b.time);
  assert.deepStrictEqual(ev, ['bossRage', 'rageBroken', 'bossRage', 'rageLand']);
  // 机器人对局：没有蓄力
  const bot = mk(true);
  const mb = bot.spawnMonster(bossType, 0, 700);
  mb.hp = mb.maxHp * 0.3;
  bot.updateWeakSpots();
  assert.ok(!mb.rage);
});

test('打断蓄力计入统计和成就 Boss 克星（设计书 220）', () => {
  const TD = require('../tools/load');
  const P = TD.progression;
  const s = P.newSave();
  P.recordStats(s, { kills: 1, rageBreaks: 10 }, true);
  assert.strictEqual(s.stats.rageBreaks, 10);
  assert.ok(P.checkAchievements(s).some((a) => a.id === 'rage10'));
});
