// 浏览器冒烟测试：打开游戏，走一遍 标题 → 地图 → 预览 → 战斗，截图并收集报错
// 用法：node tools/smoke.js [输出目录]
const path = require('path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  ({ chromium } = require(path.join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright')));
}

(async () => {
  const out = process.argv[2] || 'screenshots';
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
  // 脚本里的点击都按中文文字找，所以用简体中文跑（默认语言是英语，设计书 83）；换语言用 SMOKE_LANG=en 并自己改选择器
  await page.addInitScript((l) => localStorage.setItem('shouchengyingxiong.lang', l), process.env.SMOKE_LANG || 'zh');
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/1-title.png` });
  await page.click('text=开始游戏');
  // 新存档先选难度（设计书 27.3）
  await page.waitForSelector('.diff-card.rec', { timeout: 3000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/2-difficulty.png` });
  await page.click('.diff-card.rec');
  // 第一章开场对话（设计书 28.3）
  await page.waitForSelector('.story-overlay', { timeout: 3000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/2-story.png` });
  await page.click('.story-skip');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/2-map.png` });
  await page.click('.map-node.current');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/3-preview.png` });
  await page.click('text=开始战斗');
  await page.evaluate(() => (TD.game.speed = 2));
  // 第一只怪出场时会弹出"新敌人登场"卡片
  await page.waitForSelector('#intro-ok', { timeout: 8000 });
  await page.screenshot({ path: `${out}/4-intro.png` });
  await page.click('#intro-ok');
  await page.waitForTimeout(8000);
  await page.screenshot({ path: `${out}/4-battle.png` });
  // 战场中间必须点得到画布（HUD 层挡住画布时，选车道的道具和技能点不出来）
  const hit = await page.evaluate(() => document.elementFromPoint(640, 360).id);
  if (hit !== 'game') errors.push('战场被界面层挡住，点到的是：' + hit);
  // 快进到结束
  await page.evaluate(() => {
    const b = TD.game.battle;
    while (!b.over && b.time < 600) {
      if (b.pendingSupply) TD.game.pickSupply(b.pendingSupply[0]);
      b.step(1 / 60);
    }
  });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${out}/5-result.png` });
  await browser.close();
  if (errors.length) {
    console.log('发现错误：\n' + errors.join('\n'));
    process.exit(1);
  }
  console.log('冒烟测试通过，截图在 ' + out);
})();
