// 雇佣兵大规模战斗的性能基准
// 用法：node tools/perf-merc.js [logic|render|all]   默认 all
//   logic  无头 Node：第 40 / 100 / 150 关各跑 60 秒游戏时间（6 个兵、弱英雄 + 不倒城墙让怪物堆起来），统计每步耗时
//   render Playwright（软件渲染）：同样的战斗，快进 40 秒后统计 renderer.render 的单帧耗时，以及单独的 drawMercs 耗时
// 注：tools/perf.js 是更早的（无兵）渲染帧间隔基准，这里不改它。
const path = require('path');
const { makeBattle, stepOnce } = require('./perfkit');

const LEVELS = [40, 100, 150];
const FRAMES = +process.env.FRAMES || 120;
const what = process.argv[2] || 'all';
const pct = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(arr.length * p))];

function logicBench() {
  const rows = [];
  for (const L of LEVELS) {
    // 预热一遍，再正式测（让 JIT 稳定）
    const w = makeBattle(L, 7);
    for (let i = 0; i < 600; i++) stepOnce(w, 1 / 60);
    const b = makeBattle(L, 1);
    const ts = [];
    let peak = 0;
    let mercPeak = 0;
    for (let i = 0; i < 3600 && !b.over; i++) {
      const t0 = process.hrtime.bigint();
      stepOnce(b, 1 / 60);
      ts.push(Number(process.hrtime.bigint() - t0) / 1e6);
      peak = Math.max(peak, b.monsters.length);
      mercPeak = Math.max(mercPeak, b.mercs.filter((u) => !u.dead).length);
    }
    const sorted = ts.slice().sort((a, c) => a - c);
    const avg = ts.reduce((a, c) => a + c, 0) / ts.length;
    rows.push({ L, peak, mercPeak, avg, p95: pct(sorted, 0.95), max: sorted[sorted.length - 1] });
  }
  console.log('逻辑步耗时（ms / 步，60 秒游戏时间 = 3600 步）');
  console.log('关卡  怪物峰值  兵峰值  平均     P95      最大');
  for (const r of rows) console.log(`${String(r.L).padStart(4)}  ${String(r.peak).padStart(8)}  ${String(r.mercPeak).padStart(6)}  ${r.avg.toFixed(3).padStart(6)}  ${r.p95.toFixed(3).padStart(6)}  ${r.max.toFixed(2).padStart(6)}`);
  return rows;
}

async function renderBench() {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (e) {
    ({ chromium } = require(path.join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright')));
  }
  const { openGame } = require('./itch');
  const browser = await chromium.launch();
  const page = await openGame(browser);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  console.log('\n渲染耗时（ms / 帧，软件渲染，高画质；FRAMES 帧（默认 120），每帧之间让出一次 rAF）');
  console.log('关卡  怪物  兵  render 平均  render P95  render 最大  drawMercs 平均');
  for (const L of LEVELS) {
    const r = await page.evaluate(async ([L, FRAMES]) => {
      TD.ui.closeModal();
      const s = TD.game.save;
      s.settings.diffChosen = true;
      for (let k = 1; k <= 200; k++) s.levels[k] = { stars: 1, clears: 1 };
      TD.progression.setMercLoadout(s, ['guard', 'knight', 'archer']);
      TD.game.startBattle(L);
      const b = TD.game.battle;
      b.wall.max = b.wall.hp = 1e13;
      b.stats.atk = 1;
      b.autoMerc = true;
      b.funds = 1e9;
      for (let i = 0; i < 40 * 60 && !b.over; i++) {
        if (b.pendingSupply) TD.game.pickSupply(b.pendingSupply[0]);
        b.step(1 / 60);
      }
      const R = TD.game.renderer;
      const orig = R.drawMercs;
      let dm = 0;
      R.drawMercs = function (bb) {
        const t = performance.now();
        orig.call(this, bb);
        dm += performance.now() - t;
      };
      const ts = [];
      for (let f = 0; f < FRAMES; f++) {
        if (b.pendingSupply) TD.game.pickSupply(b.pendingSupply[0]);
        b.step(1 / 60);
        const t = performance.now();
        R.render(1 / 60);
        ts.push(performance.now() - t);
        await new Promise((res) => requestAnimationFrame(res));
      }
      R.drawMercs = orig;
      ts.sort((a, c) => a - c);
      return { mon: b.monsters.length, mercs: b.mercs.filter((u) => !u.dead).length, avg: ts.reduce((a, c) => a + c, 0) / ts.length, p95: ts[Math.floor(ts.length * 0.95)], max: ts[ts.length - 1], dm: dm / FRAMES };
    }, [L, FRAMES]);
    console.log(`${String(L).padStart(4)}  ${String(r.mon).padStart(4)}  ${String(r.mercs).padStart(2)}  ${r.avg.toFixed(2).padStart(11)}  ${r.p95.toFixed(2).padStart(10)}  ${r.max.toFixed(2).padStart(10)}  ${r.dm.toFixed(3).padStart(14)}`);
  }
  if (errors.length) console.log('页面错误：\n' + errors.join('\n'));
  await browser.close();
}

(async () => {
  if (what === 'all' || what === 'logic') logicBench();
  if (what === 'all' || what === 'render') await renderBench();
})();
