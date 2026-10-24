// 手机检查（设计书 123）：用手机尺寸 + 触摸模拟打开游戏，竖屏、横屏各走一遍 标题 → 地图 → 战斗 → 点技能 → 商店
// 竖屏时舞台应该转 90° 铺满屏幕、点击坐标要还原；横屏时不转。用法：node tools/mobile.js [截图目录]
const path = require('path');
const fs = require('fs');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  ({ chromium } = require(path.join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright')));
}
(async () => {
  const out = process.argv[2];
  if (out) fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  let fail = 0;
  for (const [name, vw, vh, rotated] of [['portrait', 390, 844, true], ['landscape', 844, 390, false]]) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('shouchengyingxiong.lang', 'en'));
    await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
    await page.waitForTimeout(1200);
    const state = await page.evaluate(() => ({ rot: TD.game.rotated, s: TD.game.scale }));
    const check = (ok, msg) => {
      console.log(`${ok ? '✓' : '✗'} ${name}：${msg}`);
      if (!ok) fail++;
    };
    check(state.rot === rotated, `舞台${rotated ? '转了 90°' : '没转'}（缩放 ${state.s.toFixed(2)}）`);
    await page.evaluate(() => {
      const s = TD.game.save;
      s.settings.diffChosen = true;
      s.stats.shopGuided = true;
      for (const t of Object.keys(TD.data.monsters)) s.seenMonsters[t] = true;
    });
    if (out) await page.screenshot({ path: path.join(out, `${name}-title.png`) });
    await page.tap('.title-buttons .btn.primary');
    await page.waitForTimeout(700);
    check((await page.evaluate(() => document.querySelectorAll('.map-node').length)) === 10, '触摸点「开始」能进地图');
    await page.evaluate(() => {
      TD.ui.closeModal();
      TD.game.startBattle(3);
      const b = TD.game.battle;
      b.wall.max = b.wall.hp = 1e9;
      for (let i = 0; i < 600; i++) {
        if (b.pendingSupply) TD.game.pickSupply(b.pendingSupply[0]);
        b.step(1 / 60);
      }
    });
    await page.waitForTimeout(400);
    if (out) await page.screenshot({ path: path.join(out, `${name}-battle.png`) });
    const n0 = await page.evaluate(() => TD.game.battle.castCount);
    await page.tap('.skill-bar button >> nth=0');
    await page.waitForTimeout(300);
    check((await page.evaluate(() => TD.game.battle.castCount)) === n0 + 1, '触摸点技能按钮能放技能');
    // 点击坐标：画布上四个点反算回舞台坐标
    const pts = await page.evaluate(() => {
      const rect = TD.game.renderer.canvas.getBoundingClientRect();
      const s = TD.game.scale;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      return [[100, 100], [640, 360], [1200, 650]].map(([x, y]) => {
        const [sx, sy] = TD.game.rotated ? [cx - (y - 360) * s, cy + (x - 640) * s] : [cx + (x - 640) * s, cy + (y - 360) * s];
        const p = TD.util.stagePoint(sx, sy, rect, 1280, 720, TD.game.rotated);
        return Math.abs(p.x - x) < 1 && Math.abs(p.y - y) < 1;
      });
    });
    check(pts.every(Boolean), '点击坐标能还原成舞台坐标');
    await page.evaluate(() => {
      TD.game.paused = true;
      TD.ui.showShop(45, 'equip');
    });
    await page.waitForTimeout(400);
    const sc = await page.evaluate(() => {
      const el = document.querySelector('.shop-content');
      return { can: el.scrollHeight > el.clientHeight, ok: !!el };
    });
    check(sc.ok && sc.can, '商店有可滚动的列表');
    if (out) await page.screenshot({ path: path.join(out, `${name}-shop.png`) });
    check(errors.length === 0, errors.length ? errors.join('; ') : '没有报错');
    await ctx.close();
  }
  await browser.close();
  if (fail) process.exit(1);
  console.log('手机检查通过');
})();
