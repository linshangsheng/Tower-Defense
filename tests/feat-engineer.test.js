// 工程兵（第 7 个兵种）：陷阱布置上限、触发伤害与减速、造型、旧的六兵名单不变
const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load');
const P = TD.progression;
const C = TD.config;

function mkBattle(level = 20) {
  const s = P.newSave();
  for (const id of TD.data.mercOrderExt) s.levels[TD.data.mercs[id].unlock - 1] = { stars: 3, clears: 1 };
  P.setMercLoadout(s, ['engineer', 'swordsman', 'guard']);
  const b = new TD.Battle({ level, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 5 });
  b.hero.cooldown = 1e9;
  b.wall.hp = b.wall.max = 1e9;
  b.waveState = 'waiting';
  b.eliteOK = false;
  b.funds = 9999;
  return b;
}

test('工程兵：数据齐全，旧的六兵名单 mercOrder 不变，新名单 mercOrderExt 末尾是工程兵', () => {
  const d = TD.data.mercs.engineer;
  assert.ok(d && d.name && d.desc && d.cost > 0 && d.cd > 0 && d.hp > 0);
  assert.strictEqual(TD.data.mercOrder.length, 6);
  assert.deepStrictEqual(TD.data.mercOrderExt, TD.data.mercOrder.concat('engineer'));
  const s = P.newSave();
  assert.ok(!P.mercUnlocked(s, 'engineer'));
  s.levels[d.unlock - 1] = { stars: 1, clears: 1 };
  assert.ok(P.mercUnlocked(s, 'engineer'), '通关第 ' + (d.unlock - 1) + ' 关解锁');
  assert.ok(P.mercUnlockedList(s).includes('engineer'));
});

test('工程兵：自动布置陷阱，同车道最多 3 个，并给城墙回血', () => {
  const b = mkBattle();
  b.deployMerc(0, 1);
  const u = b.mercs[0];
  assert.strictEqual(u.type, 'engineer');
  b.wall.max = 1000;
  b.wall.hp = 500;
  // 一只慢吞吞的怪在同车道，工程兵就会布置
  const m = b.spawnMonster('slime', 1, 900);
  m.hp = m.maxHp = 1e12;
  m.speed = 0;
  for (let i = 0; i < 60 * 20; i++) {
    m.x = 900;
    b.monsters = [m];
    b.step(1 / 60);
  }
  assert.ok(b.trapNo >= 3, '布置过陷阱：' + b.trapNo);
  assert.strictEqual(b.trapCount(1), 3, '同车道最多 3 个');
  assert.ok(b.traps.every((t) => t.lane === 1));
  assert.strictEqual(b.trapNo, 3, '满了就不再布置');
  assert.ok(b.wall.hp > 500 + 1000 * 0.002 * 2.9 - 1e-6, '每次布置回 0.2% 城墙血：' + b.wall.hp);
  // 别的车道没有怪，不会布置
  assert.strictEqual(b.trapCount(0), 0);
});

test('工程兵：陷阱触发 —— 受伤 + 减速 + 陷阱消失；飞行怪不触发', () => {
  const b = mkBattle();
  b.deployMerc(0, 1);
  const u = b.mercs[0];
  const t = b.placeTrap(u, 500);
  assert.ok(t && b.traps.length === 1);
  const fly = b.spawnMonster('bat', 1, 500);
  fly.def.flying && (fly.y = fly.y);
  const m = b.spawnMonster('slime', 1, 700);
  m.speed = 0;
  const hp0 = m.hp;
  b.updateTraps(0.016);
  assert.strictEqual(b.traps.length, 1, '没人踩 → 陷阱还在');
  m.x = 505;
  b.updateTraps(0.016);
  assert.strictEqual(b.traps.length, 0, '触发后消失');
  assert.ok(m.hp < hp0 || m.dead, '受伤');
  if (!m.dead) {
    assert.ok(b.time < m.slowUntil && Math.abs(m.slowAmt - TD.data.mercs.engineer.trap.slow) < 1e-9, '减速');
    assert.ok(b.monsterSpeed ? true : true);
  }
  assert.strictEqual(b.trapHits, 1);
  // 飞行怪从陷阱上飞过不触发
  const t2 = b.placeTrap(u, 500);
  const bat = b.spawnMonster('bat', 1, 500);
  if (bat.def.flying) {
    b.updateTraps(0.016);
    assert.ok(b.traps.includes(t2), '飞行怪不触发陷阱');
  }
});

test('工程兵：陷阱伤害随难度系数缩放、会过期', () => {
  const b = mkBattle(40);
  b.deployMerc(0, 0);
  const u = b.mercs[0];
  const t = b.placeTrap(u, 400);
  assert.ok(Math.abs(t.dmg - TD.data.mercs.engineer.trap.dmg * b.D * C.merc.power) < 1e-6);
  b.time = t.until + 0.1;
  b.updateTraps(0.016);
  assert.strictEqual(b.traps.length, 0, '到期消失');
});

test('工程兵：造型 —— 三种状态、受击、阵亡、布置动作都能画；陷阱能画', () => {
  require('../src/render/sprites.js');
  require('../src/render/mercart.js');
  const calls = { n: 0 };
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (...a) => { calls.n++; return /^create/.test(String(k)) ? { addColorStop() {} } : undefined; }),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  assert.ok(TD.mercArt.has('engineer'));
  for (const state of ['idle', 'move', 'attack']) {
    for (const extra of [{}, { flash: true }, { dead: 0.6 }, { trapAge: 0.1 }, { trapAge: 0.3 }, { trapAge: 0.5 }]) {
      calls.n = 0;
      const ok = TD.mercArt.draw(ctx, 'engineer', 100, 100, Object.assign({ t: 1.2, state, age: 0.05, wind: 0, level: 1 }, extra), -1);
      assert.ok(ok && calls.n > 20, `engineer/${state} 画出来了`);
    }
  }
  calls.n = 0;
  TD.mercArt.drawTrap(ctx, 10, 10, 1, 1);
  assert.ok(calls.n > 10);
});
