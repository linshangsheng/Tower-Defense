#!/usr/bin/env node
// 渲染分析（设计书 226）：真浏览器里开指定关卡、逻辑快进 40 秒堆满怪，跑 5 秒真实游戏循环，
// 给渲染器每个 draw*/render* 方法计时，按每帧耗时排序；另外统计 sprites.monster（怪物矢量重画）的耗时和次数。
// 用法：node tools/render-profile.js [关卡,关卡,...]   默认 59,100,150,190
const { chromium } = require(require('path').join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright'));
const levels = (process.argv[2] || '59,100,150,190').split(',').map(Number);
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + require('path').resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(400);
  for (const n of levels) {
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
      for (let f = 0; f < 60 * 40; f++) { if (b.pendingSupply) TD.game.pickSupply(b.pendingSupply[0]); b.step(1 / 60); }
      TD.ui.closeModal && TD.ui.closeModal();
      const R = TD.game.renderer;
      const proto = Object.getPrototypeOf(R);
      const acc = {};
      const wrapped = [];
      for (const k of Object.getOwnPropertyNames(proto)) {
        if (!/^draw|^render/.test(k) || typeof proto[k] !== 'function') continue;
        const orig = proto[k];
        wrapped.push([k, orig]);
        proto[k] = function (...a) { const t0 = performance.now(); try { return orig.apply(this, a); } finally { const d = performance.now() - t0; (acc[k] = acc[k] || { t: 0, c: 0 }).t += d; acc[k].c++; } };
      }
      // sprites 模块的怪物绘制
      const S = TD.sprites; const so = S.monster; let monT = 0, monC = 0;
      S.monster = function (...a) { const t0 = performance.now(); try { return so.apply(this, a); } finally { monT += performance.now() - t0; monC++; } };
      const frames = [];
      let last = performance.now();
      await new Promise((res) => { const t0 = performance.now(); (function f() { const now = performance.now(); frames.push(now - last); last = now; if (now - t0 < 5000) requestAnimationFrame(f); else res(); })(); });
      for (const [k, o] of wrapped) proto[k] = o;
      S.monster = so;
      const nf = acc.renderFrame ? acc.renderFrame.c : 1;
      const top = Object.entries(acc).sort((a, b) => b[1].t - a[1].t).slice(0, 14).map(([k, v]) => `${k} ${(v.t / nf).toFixed(2)}ms`);
      frames.sort((a, b) => a - b);
      return { alive: b.aliveCount(), fx: R.fx.length, nf, frame: (acc.renderFrame.t / nf).toFixed(2), p95gap: frames[Math.floor(frames.length * 0.95)].toFixed(1), monster: (monT / nf).toFixed(2) + 'ms x' + Math.round(monC / nf), top };
    }, n);
    console.log(`L${n} alive ${r.alive} fx ${r.fx} frames ${r.nf} renderFrame ${r.frame}ms p95gap ${r.p95gap} sprites.monster ${r.monster}`);
    console.log('   ' + r.top.join(' | '));
  }
  console.log('errors', errors);
  await browser.close();
})();
