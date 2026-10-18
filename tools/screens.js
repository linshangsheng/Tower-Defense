// 全界面检查（设计书 50）：用一个"中后期存档"逐一打开游戏里的每个界面，检查有没有报错、关键元素在不在
// 用法：node tools/screens.js [截图目录]   不给目录就只检查不截图
const path = require('path');
const fs = require('fs');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  ({ chromium } = require(path.join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright')));
}

const outDir = process.argv[2];
if (outDir) fs.mkdirSync(outDir, { recursive: true });

// [名字, 在页面里执行的步骤（返回 true 表示关键元素存在）, 传给步骤的参数]
// 步骤函数会被序列化到浏览器里执行，不能引用外层变量，参数要通过第三项传进去
const STEPS = [
  ['title', () => (TD.ui.showTitle(), !!document.querySelector('.title-foot'))],
  ['difficulty', () => (TD.ui.chooseDifficulty(() => {}), !!document.querySelector('.diff-card'))],
  ['settings', () => (TD.ui.showSettings(), document.querySelectorAll('.volume-row').length === 2)],
  ['help', () => (TD.ui.showHelp(), !!document.querySelector('.modal'))],
  ['export', () => (TD.ui.showExport(), !!document.querySelector('textarea'))],
  ['import', () => (TD.ui.showImport(), !!document.querySelector('textarea'))],
  ...[1, 2, 3, 4, 5, 6, 7].map((c) => [`map-${c}`, (c) => (TD.ui.closeModal(), TD.ui.showMap(c), document.querySelectorAll('.map-node').length === 10), c]),
  ['preview', () => (TD.ui.showPreview(45), !!document.querySelector('.preview .mon-card'))],
  ...['loadout', 'attrs', 'weapons', 'skills', 'equip', 'wall', 'items', 'exchange'].map((t) => [`shop-${t}`, (t) => (TD.ui.showShop(45, t), !!document.querySelector('.shop, .screen')), t]),
  ['diary', () => (TD.ui.showMap(5), TD.ui.showDiary(), document.querySelectorAll('.diary-item').length === TD.data.storyOrder.length)],
  ['wardrobe', () => (TD.ui.showWardrobe(), document.querySelectorAll('.outfit-card').length === TD.data.outfits.length)],
  ['town', () => (TD.ui.showTown(), !!document.querySelector('.town-canvas'))],
  ['achievements', () => (TD.ui.showAchievements(), document.querySelectorAll('.ach').length === TD.data.achievements.length)],
  ['records', () => (TD.ui.showAchievements('records'), !!document.querySelector('.rec-tile'))],
  ...[1, 7].map((c) => [`bestiary-${c}`, (c) => (TD.ui.showBestiary(c), !!document.querySelector('.modal')), c]),
  ['endless', () => (TD.ui.showEndless(), !!document.querySelector('.mode-rules'))],
  ['daily', () => (TD.ui.showDaily(), !!document.querySelector('.preview'))],
  ['tower', () => (TD.ui.showTower(), document.querySelectorAll('.tower-table tbody tr').length === 9)],
  ['story', () => (TD.ui.closeModal(), TD.ui.playStory('pre60', () => {}, { replay: true }), !!document.querySelector('.story-overlay'))],
  ['story-skip', () => (document.querySelector('.story-skip').click(), !document.querySelector('.story-overlay'))],
  ['rest', () => ((TD.game.playSeconds = 99999), TD.ui.showMap(5), !!document.querySelector('.rest'))],
  [
    'battle',
    () => {
      TD.game.playSeconds = 0;
      TD.ui.closeModal();
      TD.game.startBattle(45);
      const b = TD.game.battle;
      b.wall.max = b.wall.hp = 1e9; // 城墙不倒，后面还要测暂停、补给、结算
      for (let i = 0; i < 60 * 20; i++) {
        if (b.pendingSupply) TD.game.pickSupply(b.pendingSupply[0]);
        b.step(1 / 60);
      }
      return !!document.querySelector('.hud-bottom');
    },
  ],
  ['pause', () => (TD.game.togglePause(), !!document.querySelector('.modal'))],
  ['supply', () => (TD.game.togglePause(), TD.ui.showSupply(TD.game.battle, ['sharp', 'quick', 'eagle']), !!document.querySelector('.modal'))],
  ['intro', () => (TD.ui.closeModal(), TD.ui.showIntro('thunderKing', () => {}), !!document.querySelector('#intro-ok'))],
  [
    'result-lose',
    () => {
      TD.ui.closeModal();
      const b = TD.game.battle;
      b.finish(false);
      TD.ui.showResult(b, TD.progression.applyResult(TD.game.save, 45, b.result));
      return !!document.querySelector('.result.lose .report');
    },
  ],
  [
    'result-win',
    () => {
      TD.ui.closeModal();
      const b = TD.game.battle;
      b.result.win = true;
      b.result.stars = 3;
      TD.ui.showResult(b, TD.progression.applyResult(TD.game.save, 45, b.result));
      return !!document.querySelector('.result.win');
    },
  ],
  [
    'mode-result',
    () => {
      TD.ui.closeModal();
      TD.game.save.gold = 5;
      TD.modes.towerStart(TD.game.save);
      TD.ui.startTowerFloor();
      const b = TD.game.battle;
      for (let i = 0; i < 60 * 5; i++) b.step(1 / 60);
      b.finish(false);
      TD.ui.showTowerResult(TD.modes.applyTowerResult(TD.game.save, b.result));
      return !!document.querySelector('.result');
    },
  ],
  ['ending', () => (TD.ui.closeModal(), (TD.game.battle = null), TD.ui.showEnding(() => {}), !!document.querySelector('.ending'))],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(400);
  // 中后期存档：通关全部 60 关，部分三星、王冠、任务，读过故事，见过所有怪
  await page.evaluate(() => {
    const s = TD.game.save;
    s.settings.diffChosen = true;
    for (let k = 1; k <= 70; k++) s.levels[k] = { stars: (k % 3) + 1, clears: 1, crown: k % 4 === 0, mission: k % 2 === 0 };
    for (const k of TD.data.storyOrder) s.story[k] = 'read';
    for (const t of Object.keys(TD.data.monsters)) s.seenMonsters[t] = true;
    for (const w of Object.keys(s.weapons)) s.weapons[w].owned = true;
    for (const k of Object.keys(TD.data.activeSkills)) s.activeOwned[k] = true;
    for (const k of Object.keys(TD.data.passiveSkills)) s.passiveOwned[k] = true;
    s.copper = 5000;
    s.silver = 50;
    s.gold = 5;
  });
  let fail = 0;
  for (const [name, fn, arg] of STEPS) {
    const before = errors.length;
    let ok = false;
    try {
      ok = await page.evaluate(fn, arg);
    } catch (e) {
      errors.push(`${name}: ${e.message}`);
    }
    await page.waitForTimeout(150);
    if (outDir) await page.screenshot({ path: path.join(outDir, `${name}.png`) });
    const bad = !ok || errors.length > before;
    if (bad) fail++;
    console.log(`${bad ? '✗' : '✓'} ${name}${errors.length > before ? '  ' + errors.slice(before).join(' | ') : ''}`);
  }
  await browser.close();
  console.log(fail ? `${fail} 个界面有问题` : `全部 ${STEPS.length} 个界面正常`);
  process.exit(fail ? 1 : 0);
})();
