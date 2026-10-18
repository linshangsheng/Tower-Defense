// 截图工具：直接进入第 n 关，模拟 t 秒后截图（用于检查画面）
// 用法：node tools/shot.js <关卡> <秒数> <输出文件> [auto]
const path = require('path');
const { chromium } = require(path.join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright'));
(async () => {
  const [n, secs, outFile, auto] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.evaluate(
    ([n, auto]) => {
      const s = TD.game.save;
      for (let k = 1; k < n; k++) s.levels[k] = { stars: 3, clears: 1 };
      s.attrs.atk = n * 1.5;
      s.attrs.aspd = n;
      s.activeOwned = { drum: true, arrowRain: true, thunder: true, frost: true, repair: true };
      s.loadout.active = ['arrowRain', 'thunder', 'frost'];
      s.inventory = { bomb: 1, patch: 1, haste: 1 };
      s.loadout.items = ['bomb', 'patch', 'haste'];
      s.loadout.autoCast = !!auto;
      // 不弹"新敌人登场"，免得挡住画面
      s.seenMonsters = {};
      for (const k of Object.keys(TD.data.monsters)) s.seenMonsters[k] = true;
      s.wall.level = Math.min(30, Math.floor(n / 3));
      TD.game.startBattle(n);
    },
    [+n, auto]
  );
  await page.evaluate((secs) => {
    const b = TD.game.battle;
    while (!b.over && b.time < secs) {
      if (b.pendingSupply) TD.game.pickSupply(b.pendingSupply[0]);
      b.step(1 / 60);
    }
  }, +secs);
  await page.waitForTimeout(400);
  await page.screenshot({ path: outFile });
  await browser.close();
  if (errors.length) console.log('错误：', errors);
})();
