#!/usr/bin/env node
// 猴子测试（设计书 159）：在浏览器里随机点界面上的按钮 / 选项 / 快捷键，偶尔让战斗往前跑一段，
// 看会不会抛异常（pageerror / console.error）或卡死。用法：node tools/monkey.js [动作数=400] [随机种子=1]
// 它撞出过：连珠被动的 combo 事件没带名字，被渲染层的技能协同监听拿去画字而抛异常。
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  ({ chromium } = require(require('path').join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright')));
}
const { openGame } = require('./itch.js');
const N = +process.argv[2] || 400;
const seed = +process.argv[3] || 1;
const lang = process.argv[4] || 'zh';
(async () => {
  const browser = await chromium.launch();
  const page = await openGame(browser);
  const errs = new Map();
  const add = (k) => errs.set(k, (errs.get(k) || 0) + 1);
  page.on('pageerror', (e) => add(e.message.slice(0, 140)));
  page.on('console', (m) => { if (m.type() === 'error') add('console: ' + m.text().slice(0, 140)); });
  await page.evaluate(([seed, lang]) => {
    window.__s = seed; window.__rnd = () => ((window.__s = (window.__s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const sv = TD.game.save; sv.settings.diffChosen = true; sv.stats.shopGuided = true;
    for (let k = 1; k <= 60; k++) sv.levels[k] = { stars: 2, clears: 1 };
    sv.copper = 99999; sv.silver = 999; sv.gold = 99; sv.diamond = 500;
    window.__log = [];
  }, [seed, lang]);
  const t0 = Date.now();
  for (let i = 0; i < N && Date.now() - t0 < 480000; i++) {
    const info = await page.evaluate(() => {
      const R = window.__rnd;
      const r = R();
      const vis = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
      if (r < 0.1) { const keys = ['Escape', 'p', 'n', 'v', 'r', '1', '2', '3', 'f', 't', 'q']; const k = keys[Math.floor(R() * keys.length)]; document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); return 'key ' + k; }
      const els = [...document.querySelectorAll('button, .map-node, .supply-card, select')].filter(vis).filter((e) => !/清空|Clear|退出|Quit|Exit|导入|Import|放弃|Abandon|Delete|删除/i.test(e.textContent || ''));
      if (!els.length) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return 'esc'; }
      const e = els[Math.floor(R() * els.length)];
      if (e.tagName === 'SELECT') { e.selectedIndex = Math.floor(R() * e.options.length); e.dispatchEvent(new Event('change', { bubbles: true })); return 'select'; }
      e.click();
      if (R() < 0.25) { const b = TD.game.battle; if (b && !b.over && !TD.game.paused) { for (let k = 0; k < 500 && !b.over; k++) { if (b.pendingSupply) TD.game.pickSupply(b.pendingSupply[0]); b.step(1 / 60); } } }
      return (e.textContent || e.className || '').trim().slice(0, 20);
    });
    if (i % 80 === 79) { const alive = await Promise.race([page.evaluate(() => 1), new Promise((r) => setTimeout(() => r(0), 5000))]); if (!alive) { add('页面无响应 @' + i); break; } }
  }
  console.log('done', 'distinct errors', errs.size);
  for (const [k, v] of errs) console.log(' ✗', k, 'x' + v);
  await browser.close();
})();
