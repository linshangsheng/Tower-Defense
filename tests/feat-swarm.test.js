const test = require('node:test');
const assert = require('node:assert');
const TD = require('../tools/load');
const P = TD.progression;
const D = TD.data;

function mk(n) {
  const s = P.newSave();
  return new TD.Battle({ level: n, stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 9 });
}

test('前期蜂群：前几关小怪更多、每只更薄，总血量和铜币不变；Boss 和第 10 关起不受影响', () => {
  const sw = TD.config.swarm;
  const b = mk(3);
  assert.strictEqual(b.swarm, sw[3]);
  const m = b.spawnMonster('bunny', 0);
  assert.strictEqual(m.maxHp, Math.max(1, Math.round((D.monsters.bunny.hp * b.D) / sw[3])));
  // 数量：和关闭蜂群时相比 ×swarm（四舍五入）
  TD.config.swarm = {};
  const off = mk(3);
  TD.config.swarm = sw;
  let qOn = 0;
  let qOff = 0;
  for (let i = 0; i < b.totalWaves; i++) {
    b.startWave(i);
    off.startWave(i);
    qOn += b.spawnQueue.length;
    qOff += off.spawnQueue.length;
  }
  assert.ok(qOn > qOff * 1.3 && qOn < qOff * 1.7, `${qOn} vs ${qOff}`);
  // 铜币按比例摊薄
  b.kill(m);
  assert.ok(Math.abs(b.killCopper - D.monsters.bunny.copper / sw[3]) < 1e-9);
  assert.strictEqual(mk(10).swarm, 1);
  assert.strictEqual(mk(40).swarm, 1);
  const boss = mk(5).spawnMonster(Object.keys(D.monsters).find((k) => D.monsters[k].boss && !D.monsters[k].towerOf), 0);
  assert.ok(boss.maxHp > 0);
});

test('前期蜂群：自定义关卡（每日挑战 / 无尽）不受影响', () => {
  const s = P.newSave();
  const b = new TD.Battle({ level: 3, levelDef: D.levels[3], stats: P.heroStats(s), loadout: P.battleLoadout(s), seed: 1 });
  assert.strictEqual(b.swarm, 1);
});
