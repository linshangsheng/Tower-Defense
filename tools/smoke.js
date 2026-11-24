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
  await page.locator('button.primary').first().click(); // 标题页的主按钮：新存档「开始冒险」/ 老存档「继续游戏」
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

  // Boss 战（设计书 221）：上面的第 1 关没有 Boss，Boss 血条、弱点、蓄力、补给羁绊标签、契约卡这些画面都走不到。
  // 这里直接开第 26 关（普通关，有补给）再塞一只 Boss 进去，让它触发蓄力，并弹一次带契约卡的补给，画几秒看有没有报错
  await page.evaluate(() => {
    const s = TD.game.save;
    for (let n = 1; n < 26; n++) s.levels[n] = { stars: 3, clears: 1 };
    for (const k of TD.data.storyOrder) s.story[k] = 'read';
    s.seenMonsters = s.seenMonsters || {};
    for (const k of Object.keys(TD.data.monsters)) s.seenMonsters[k] = true;
    s.stats.seenSupply = true;
    TD.ui.closeModal();
    TD.ui.beginLevel(26);
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const b = TD.game.battle;
    const boss = b.spawnMonster('boarKing', 1, 760);
    boss.hp = boss.maxHp * 0.6; // 马上触发蓄力
    b.supplyPicked.push('sharp');
    b.pendingSupply = ['eagle', 'quick', 'arcane'];
    b.pendingPact = { curse: 'speed', card: 'frenzy' };
    TD.game.paused = true;
    TD.ui.showSupply(b, b.pendingSupply);
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/6-supply-pact.png` });
  await page.evaluate(() => TD.game.pickPact());
  await page.evaluate(() => (TD.game.paused = false));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/7-boss.png` });
  const bossState = await page.evaluate(() => {
    const b = TD.game.battle;
    return b ? { rage: b.monsters.some((m) => m.rage || m.rushUntil), picked: b.supplyPicked.slice(), pacts: b.pactsTaken || [] } : null;
  });
  if (!bossState) errors.push('Boss 战里战斗对象没了（多半是渲染报错后退回了地图）');
  else {
    if (!bossState.rage) errors.push('Boss 没有触发蓄力');
    if (!bossState.picked.includes('frenzy')) errors.push('契约换来的补给卡没有生效');
    if (!bossState.pacts.includes('speed')) errors.push('契约没有生效');
  }
  await browser.close();
  if (errors.length) {
    console.log('发现错误：\n' + errors.join('\n'));
    process.exit(1);
  }
  console.log('冒烟测试通过，截图在 ' + out);
})();
