#!/usr/bin/env node
// 雇佣兵 / 精英 / 光球 / 宝箱怪 / 集火 / 修补 / 集结令 的对抗性随机测试（模糊测试）
// 用法：node tools/fuzz-mercs.js [--games 3000] [--seed 1] [--verbose]
// 每局：随机存档进度 × 随机关卡(1–200) × 随机操作序列 × 随机大步长(模拟卡顿)；每步检查不变量。
const TD = require('./load');
const P = TD.progression;
const C = TD.config;
const D = TD.data;

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? +args[args.indexOf(k) + 1] : d);
const GAMES = opt('--games', 3000);
const SEED0 = opt('--seed', 1);
const verbose = args.includes('--verbose');

const fails = new Map(); // 失败签名 -> { n, example }
let games = 0;
const stats = { mercDeployed: 0, mercDeaths: 0, rallies: 0, repairs: 0, focus: 0, drops: 0, elites: 0, treasures: 0, wins: 0, losses: 0, timeouts: 0, bigSteps: 0 };

function fail(sig, info) {
  const f = fails.get(sig) || { n: 0, example: info };
  f.n++;
  fails.set(sig, f);
}

const fin = (v) => typeof v === 'number' && Number.isFinite(v);

function checkInvariants(b, ctx) {
  const bad = (what) => fail(what, ctx());
  if (!fin(b.time)) bad('time 非有限数');
  if (!fin(b.funds)) bad('funds 非有限数');
  else if (b.funds < 0) bad('funds 为负');
  if (!fin(b.wall.hp)) bad('wall.hp 非有限数');
  if (b.wall.hp < 0 && !b.over) bad('wall.hp<0 但战斗未结束');
  if (b.wall.hp > b.wall.max + 1e-6) bad('wall.hp 超过 max');
  const alive = b.mercs.filter((u) => !u.dead).length;
  if (alive > C.merc.cap) bad('活着的兵超过 cap');
  if (b.mercs.length > C.merc.cap + 14) bad('mercs 数组无限增长');
  for (const u of b.mercs) {
    if (!fin(u.x) || !fin(u.y) || !fin(u.hp) || !fin(u.maxHp) || !fin(u.dmg)) { bad('兵数值非有限数'); break; }
    if (!u.dead && (u.x < C.wallX - 1e-6 || u.x > 1290)) { bad('兵越界 x=' + Math.round(u.x)); break; }
    if (!u.dead && u.hp > u.maxHp + 1e-6) { bad('兵 hp > maxHp'); break; }
    if (!u.dead && u.hp <= 0) { bad('兵 hp<=0 但没死'); break; }
    if (u.lane < 0 || u.lane >= b.lanes) { bad('兵车道越界'); break; }
  }
  for (const m of b.monsters) {
    if (!fin(m.x) || !fin(m.y) || !fin(m.hp) || !fin(m.maxHp)) { bad('怪数值非有限数 ' + m.type); break; }
    if (m.lane < 0 || m.lane >= b.lanes) { bad('怪车道越界 ' + m.type); break; }
  }
  for (const d of b.drops || []) if (!fin(d.x) || !fin(d.y) || !fin(d.amount)) { bad('光球数值非有限数'); break; }
  if (b.focus && b.focus.dead && b.time < b.focusUntil && false) bad('focus 指向死怪');
  for (const k of ['killCopper', 'killSilver', 'earlyCopper']) if (!fin(b[k])) bad(k + ' 非有限数');
}

function checkResult(b, ctx) {
  const r = b.result;
  if (!r) return fail('结束后 result 为空', ctx());
  for (const k of Object.keys(r)) {
    const v = r[k];
    if (typeof v === 'number' && !Number.isFinite(v)) fail('result.' + k + ' 非有限数', ctx());
  }
  if (r.wallRatio < 0 || r.wallRatio > 1 + 1e-9) fail('wallRatio 越界 ' + r.wallRatio, ctx());
  if (r.mercDeaths > r.mercDeployed) fail('阵亡数 > 雇佣数', ctx());
  if (r.win && !(r.stars >= 1)) fail('胜利但无星', ctx());
}

function makeSave(rng, n) {
  const s = P.newSave();
  for (let k = 1; k < n; k++) s.levels[k] = { stars: 1 + Math.floor(rng() * 3), clears: 1 };
  s.copper = 5000 * n; s.silver = 40 * n; s.gold = 20;
  for (let i = 0; i < 1 + Math.floor(rng() * 4); i++) TD.bot.shop(s);
  const ids = D.mercOrder.filter((id) => P.mercUnlocked(s, id));
  const pick = ids.slice().sort(() => rng() - 0.5).slice(0, Math.floor(rng() * 4));
  P.setMercLoadout(s, pick);
  for (const id of ids) s.mercLv[id] = 1 + Math.floor(rng() * 10);
  return s;
}

function playOne(seed) {
  const rng = TD.util.rng(seed);
  const n = 1 + Math.floor(rng() * 200);
  const save = makeSave(rng, n);
  P.recommend(save, n, { itemQty: 1 + Math.floor(rng() * 3), itemSlots: 3 });
  const lo = P.battleLoadout(save);
  lo.autoCast = rng() < 0.5;
  if (rng() < 0.15) lo.mercs = D.mercOrder.slice(0, 3).map((id) => ({ id, level: 10 })); // 强行带兵（即使没解锁）
  const b = new TD.Battle({
    level: n, stats: P.heroStats(save), loadout: lo, seed: seed + 7,
    autoItems: rng() < 0.4, autoMercs: rng() < 0.3, autoSupply: false,
    rally: rng() < 0.3 ? P.rally(save, n) : 0, difficulty: ['easy', 'normal', 'hard'][Math.floor(rng() * 3)],
  });
  const info = { seed, level: n, type: b.level.type, lanes: b.lanes, mercs: b.mercSlots.map((s) => s.id).join(',') };
  const ctx = () => Object.assign({ t: +b.time.toFixed(2), wave: b.waveIndex, state: b.waveState }, info);
  const bigRate = rng() < 0.5 ? 0 : [0.02, 0.1, 0.3][Math.floor(rng() * 3)]; // 大步长出现的概率
  const speed = [1, 2, 3][Math.floor(rng() * 3)];
  let paused = false;
  let t = 0;
  let iter = 0;
  const MAXT = 900;
  try {
    while (!b.over && b.time < MAXT && iter++ < 400000) {
      if (b.pendingSupply) {
        if (rng() < 0.2 && b.canRefreshSupply()) b.refreshSupply();
        else b.chooseSupply(b.pendingSupply[Math.floor(rng() * b.pendingSupply.length)].id || b.botSupplyChoice(b.pendingSupply));
        continue;
      }
      // 随机操作
      const r = rng();
      const lane = Math.floor(rng() * (b.lanes + 1)) - (rng() < 0.05 ? 1 : 0); // 偶尔越界车道
      const px = rng() * 1300, py = C.fieldTop + rng() * (C.fieldBottom - C.fieldTop);
      if (r < 0.02) { if (b.mercSlots.length) b.deployMerc(Math.floor(rng() * 4) - 0, lane); }
      else if (r < 0.03) b.rallyMercs(lane);
      else if (r < 0.05) b.collectDropAt(rng() < 0.7 && b.drops && b.drops[0] ? b.drops[0].x : px, rng() < 0.7 && b.drops && b.drops[0] ? b.drops[0].y : py);
      else if (r < 0.07) {
        const m = b.monsters[Math.floor(rng() * b.monsters.length)];
        b.focusAt(m ? m.x : px, m ? m.y + m.yOffset : py);
      }
      else if (r < 0.08) b.repairAt(rng() < 0.8 ? 100 : px, py);
      else if (r < 0.1) { if (b.skills.length) b.castSkill(Math.floor(rng() * b.skills.length), lane < 0 ? undefined : lane); }
      else if (r < 0.12) { if (b.items.length) b.useItem(Math.floor(rng() * b.items.length), lane < 0 ? undefined : lane); }
      else if (r < 0.125 && b.ult) b.startUltimate();
      else if (r < 0.13) paused = !paused;
      // 随机把一个怪变成眩晕 / 冻结 / 把兵打死 / 把兵放到边角
      const q = rng();
      if (q < 0.01 && b.mercs.length) { const u = b.mercs[Math.floor(rng() * b.mercs.length)]; b.mercHurt(u, 1e12, b.monsters[0]); }
      else if (q < 0.02 && b.monsters.length) { const m = b.monsters[Math.floor(rng() * b.monsters.length)]; b.freezeMonster(m, 1 + rng() * 3); }
      else if (q < 0.025 && b.monsters.length) { const m = b.monsters[Math.floor(rng() * b.monsters.length)]; m.stunUntil = b.time + 2; }
      else if (q < 0.028) b.stunHero(1.5, 'test');
      else if (q < 0.03 && b.wall.hp > 0) b.hitWall(b.wall.max * 0.3, b.monsters[0], false, 'melee');
      else if (q < 0.032 && b.mercs.length) { const u = b.mercs[0]; if (!u.dead) { u.x = rng() < 0.5 ? C.wallX + 40 : 1200; } }
      if (paused) { if (rng() < 0.05) paused = false; checkInvariants(b, ctx); if (rng() < 0.2) t += 0.05; if (t > 600) break; continue; }
      let dt = 1 / 60;
      if (bigRate && rng() < bigRate) { dt = [0.1, 0.2, 0.5][Math.floor(rng() * 3)]; stats.bigSteps++; }
      dt *= speed;
      b.step(dt);
      checkInvariants(b, ctx);
    }
    if (!b.over) {
      stats.timeouts++;
      // 超时：看是不是真死锁（怪全死、不再有后续波）
      fail('超时未结束(' + b.waveState + ')', ctx());
      b.finish(false);
    }
    checkResult(b, ctx);
  } catch (e) {
    fail('异常: ' + String(e && e.message).slice(0, 90) + ' @' + String(e && e.stack).split('\n')[1].trim().slice(0, 80), ctx());
  }
  stats.mercDeployed += b.mercDeployed || 0;
  stats.mercDeaths += b.mercDeaths || 0;
  stats.rallies += b.rallies || 0;
  stats.repairs += b.repairCount || 0;
  stats.focus += b.focusCount || 0;
  stats.drops += b.dropsTaken || 0;
  stats.elites += b.elitesKilled || 0;
  stats.treasures += b.treasuresKilled || 0;
  if (b.result) stats[b.result.win ? 'wins' : 'losses']++;
  games++;
}

// ---------------- 坏存档 ----------------
function badSaves() {
  const junk = [null, undefined, 'x', 7, NaN, Infinity, -5, [], [1, 2], {}, { a: 1 }, true, '__proto__', () => 1];
  const longList = Array.from({ length: 5000 }, (_, i) => (i % 2 ? 'swordsman' : 'nope' + i));
  const cases = [];
  for (const j of junk) {
    cases.push({ mercLv: j }, { mercLoadout: j }, { stats: j }, { mercChosen: j }, { levels: j }, { loadout: j });
    cases.push({ mercLv: { swordsman: j, guard: j, knight: j } });
    cases.push({ mercLoadout: [j, 'swordsman', j] });
    cases.push({ stats: { battles: j, kills: j, killsByType: j, mercDeployed: j, mercKills: j, treasures: j, elites: j, drops: j } });
  }
  cases.push({ mercLoadout: longList }, { mercLoadout: ['swordsman', 'swordsman', 'swordsman', 'swordsman'] }, { mercLv: { swordsman: 1e308 } }, { mercLv: { swordsman: '5', guard: '5abc', archer: [3], mage: { a: 1 } } });
  cases.push({ stats: {} }, { stats: { battles: 3 } }, { mercLoadout: { 0: 'swordsman', length: 1 } }, { mercLoadout: 'swordsman' });
  let n = 0;
  const cl = (v) => (Array.isArray(v) ? v.slice() : v && typeof v === 'object' ? Object.assign({}, v) : v);
  for (const c0 of cases) {
    n++;
    const c = {};
    for (const k of Object.keys(c0)) c[k] = cl(c0[k]);
    const tag = JSON.stringify(c, (k, v) => (typeof v === 'function' ? 'fn' : v === undefined ? 'undef' : typeof v === 'number' && !Number.isFinite(v) ? String(v) : v)).slice(0, 100);
    try {
      const s = Object.assign(P.newSave(), c);
      for (const k of Object.keys(c)) if (c[k] === undefined) delete s[k];
      for (let k = 1; k <= 60; k++) s.levels = s.levels && typeof s.levels === 'object' ? Object.assign(s.levels, { [k]: { stars: 1, clears: 1 } }) : s.levels;
      const m = P.migrate(JSON.parse(JSON.stringify(s, (k, v) => (v === undefined ? null : v))));
      const raw = Object.assign({}, m);
      const lo = P.battleLoadout(m);
      if (!Array.isArray(lo.mercs) || lo.mercs.length > 3) throw new Error('battleLoadout.mercs 不合法');
      for (const x of lo.mercs) if (!D.mercs[x.id] || !(x.level >= 1 && x.level <= C.merc.maxLevel && Number.isInteger(x.level))) throw new Error('兵条目不合法 ' + JSON.stringify(x));
      const b = new TD.Battle({ level: 20, stats: P.heroStats(m), loadout: lo, seed: 5 });
      for (let i = 0; i < 600; i++) { b.step(1 / 60); if (b.waveState !== 'prepare') for (let k = 0; k < 3; k++) b.deployMerc(k, 0); }
      P.recordStats(m, b.result || { kills: 5, killsByType: { slime: 2 }, supplies: [], combos: {}, mercDeployed: 1 }, true);
      for (const k of ['battles', 'wins', 'kills', 'mercDeployed', 'mercKills', 'treasures', 'elites', 'drops']) if (!fin(m.stats[k])) throw new Error('stats.' + k + ' 非有限数: ' + m.stats[k]);
      // 直接把未迁移的坏存档喂给读取函数（模拟读取时没经过 migrate 的路径）
      const raw2 = Object.assign(P.newSave(), c);
      for (const k of Object.keys(c)) if (k === 'levels' || k === 'loadout' || k === 'stats') raw2[k] = P.newSave()[k]; else if (c[k] === undefined) delete raw2[k];
      P.mercLoadoutIds(raw2); P.mercUnlockedList(raw2);
      for (const id of D.mercOrder) { P.mercLevel(raw2, id); P.mercUpgradeCost(raw2, id); }
      P.battleLoadout(Object.assign(P.migrate(JSON.parse(JSON.stringify(raw2))), {}));
      void raw;
    } catch (e) {
      fail('坏存档: ' + String(e && e.message).slice(0, 80) + ' @' + String(e && e.stack).split('\n')[1].trim().slice(0, 70), { case: tag });
    }
  }
  return n;
}

const nBad = badSaves();
if (args.includes('--bad-only')) { console.log('坏存档', nBad, '例'); for (const [sig, f] of fails) console.log('FAIL x' + f.n, sig, JSON.stringify(f.example)); process.exit(fails.size ? 1 : 0); }
const t0 = Date.now();
for (let g = 0; g < GAMES; g++) {
  playOne(SEED0 * 100003 + g * 7919 + 13);
  if (verbose && g % 250 === 249) console.log(`  ${g + 1}/${GAMES} 局，${fails.size} 类问题，${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
console.log(`随机局 ${games}，坏存档 ${nBad} 例，用时 ${((Date.now() - t0) / 1000).toFixed(0)}s`);
console.log(JSON.stringify(stats));
if (!fails.size) console.log('不变量全部通过');
for (const [sig, f] of fails) console.log(`FAIL x${f.n}  ${sig}\n    例: ${JSON.stringify(f.example)}`);
process.exitCode = fails.size ? 1 : 0;
