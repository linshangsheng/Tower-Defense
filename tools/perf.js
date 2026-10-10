// 渲染性能测量（设计书 13.2）：在怪物最多的关卡里，测量每帧绘制耗时
// 用法：node tools/perf.js [关卡号,关卡号,...]   默认测几个怪物最密集的关卡
const path = require('path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  ({ chromium } = require(path.join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright')));
}

const levels = (process.argv[2] || '29,39,48,54,57,59,60').split(',').map(Number);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(400);
  console.log('关卡   怪物数  平均帧间隔 ms  p95 ms  最慢 ms  平均 FPS');
  for (const n of levels) {
    // 先在逻辑层快进 40 秒把怪物堆满，再让真实的游戏循环跑 6 秒，记录 requestAnimationFrame 的帧间隔
    // （直接在循环里连续调用 render 不让出主线程，软件渲染会一次性刷新命令缓冲，测出来的尖峰不真实）
    const r = await page.evaluate(async (n) => {
      const s = TD.game.save;
      s.settings.diffChosen = true;
      for (let k = 1; k < n; k++) s.levels[k] = { stars: 3, clears: 1 };
      for (const k of TD.data.storyOrder || []) s.story[k] = 'read';
      for (const t of Object.keys(TD.data.monsters)) s.seenMonsters[t] = true;
      TD.ui.closeModal && TD.ui.closeModal();
      TD.game.startBattle(n);
      const b = TD.game.battle;
      b.wall.max = b.wall.hp = 1e9;
      b.stats.atk = 1;
      for (let f = 0; f < 60 * 40; f++) {
        if (b.pendingSupply) TD.game.pickSupply(b.pendingSupply[0]);
        b.step(1 / 60);
      }
      const gaps = [];
      let peak = 0;
      await new Promise((resolve) => {
        let last = performance.now();
        const t0 = last;
        const tick = (now) => {
          gaps.push(now - last);
          last = now;
          if (b.pendingSupply) TD.game.pickSupply(b.pendingSupply[0]);
          peak = Math.max(peak, b.monsters.filter((m) => !m.dead).length);
          if (now - t0 < 6000 && !b.over) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      gaps.shift();
      gaps.sort((a, c) => a - c);
      const avg = gaps.reduce((a, c) => a + c, 0) / gaps.length;
      return { peak, avg, p95: gaps[Math.floor(gaps.length * 0.95)], max: gaps[gaps.length - 1] };
    }, n);
    console.log(`第${n}关  ${String(r.peak).padStart(5)}  ${r.avg.toFixed(1).padStart(11)}  ${r.p95.toFixed(1).padStart(6)}  ${r.max.toFixed(1).padStart(7)}  ${(1000 / r.avg).toFixed(0).padStart(7)}`);
  }
  if (errors.length) console.log('错误：\n' + errors.join('\n'));
  await browser.close();
})();
