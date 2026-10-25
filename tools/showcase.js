// 展示长图：把商店各页、各章战斗、10 个主动技能的施法画面，按从上到下的顺序各拼成一张长图
// 每一格是 iPhone 横屏的分辨率 2532×1170（iPhone 12–14 的屏幕）：游戏画面按 16:9 放大到 2080×1170 放在中间，
// 画面本身是按 2080×1170 的分辨率重新渲染的（不是把 1280×720 放大），两边用同一画面放大模糊压暗填满。
// 用法：node tools/showcase.js [输出目录]   默认 showcase/；用 SHOW=shop,battle,skills 只做其中几组
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  ({ chromium } = require(path.join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright')));
}
const { openGame, enterBattle, crowdShot, dragonScene } = require('./itch.js');

const OUT = path.resolve(process.argv[2] || path.join(__dirname, '..', 'showcase'));
const W = 2532;
const H = 1170;
const GW = 2080; // 游戏画面宽（16:9，高 1170）
const SHOW = (process.env.SHOW || 'shop,battle,skills').split(',');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-'));
let counter = 0;

// 让画布按 2080×1170 渲染（默认画布是 1280×720，放大会糊）
async function hiRes(page) {
  await page.evaluate((GW) => {
    const r = TD.game.renderer;
    r.canvas.width = GW;
    r.canvas.height = Math.round((GW * 720) / 1280);
    r.k = GW / 1280;
    r._ql = TD.quality.level;
    r.bgCache = null;
  }, GW);
}

async function snap(page, name) {
  await page.waitForTimeout(500);
  const raw = path.join(tmp, `${String(counter++).padStart(3, '0')}-${name}.png`);
  await page.screenshot({ path: raw });
  // 填满 2532 宽：背景 = 同一画面放大、模糊、压暗；中间放清晰的游戏画面
  const out = raw.replace('.png', '-tile.png');
  execFileSync('convert', [raw, '-resize', `${W}x${H}^`, '-gravity', 'center', '-extent', `${W}x${H}`, '-blur', '0x30', '-brightness-contrast', '-28x0', '(', raw, ')', '-gravity', 'center', '-composite', out]);
  return out;
}

async function newGame(browser) {
  const page = await openGame(browser, { width: GW, height: H });
  await hiRes(page);
  return page;
}

function strip(files, name) {
  const target = path.join(OUT, name);
  execFileSync('convert', [...files, '-append', target]);
  const mb = (fs.statSync(target).size / 1048576).toFixed(1);
  const dims = execFileSync('identify', ['-format', '%wx%h', target]).toString();
  console.log(`${name}：${files.length} 格，${dims}，${mb} MB`);
}

async function shop(browser) {
  const page = await newGame(browser);
  const tiles = [];
  const tabs = [['loadout', '配装'], ['attrs', '属性'], ['skills', '技能'], ['equip', '武器'], ['wall', '城墙'], ['items', '道具'], ['exchange', '汇兑所']];
  for (const [tab] of tabs) {
    await page.evaluate((tab) => TD.ui.showShop(45, tab), tab);
    await page.waitForTimeout(300);
    tiles.push(await snap(page, 'shop-' + tab));
  }
  // 装备页的头盔
  await page.evaluate(() => {
    TD.ui.showShop(45, 'equip');
    document.querySelectorAll('.equip-cats .cat')[1].click();
  });
  tiles.push(await snap(page, 'shop-helm'));
  await page.evaluate(() => TD.ui.showMap(5));
  tiles.push(await snap(page, 'map'));
  await page.close();
  strip(tiles, '1-商店与地图.png');
}

async function battle(browser) {
  const page = await newGame(browser);
  const tiles = [];
  for (const level of [8, 25, 45, 65, 85]) {
    await crowdShot(page, level, 14);
    await page.evaluate(() => (TD.game.paused = true));
    tiles.push(await snap(page, 'battle-' + level));
    await page.evaluate(() => (TD.game.paused = false));
  }
  await enterBattle(page, 200, 0, 'b.autoCast = false;');
  await dragonScene(page, 'fire');
  tiles.push(await snap(page, 'battle-dragon'));
  await page.close();
  strip(tiles, '2-战斗画面.png');
}

// 十个主动技能：每个都在一场有很多怪的战斗里放出来，等特效铺开再截图
async function skills(browser) {
  const page = await newGame(browser);
  const ids = await page.evaluate(() => Object.keys(TD.data.activeSkills));
  const tiles = [];
  for (const id of ids) {
    await page.evaluate((id) => {
      TD.ui.closeModal();
      const lo = TD.game.save.loadout;
      lo.active = [id, null, null];
      lo.autoCast = false;
    }, id);
    await enterBattle(page, 35, 0);
    await page.evaluate((id) => {
      const b = TD.game.battle;
      b.stats.atk *= 0.3;
      for (let i = 0; i < 60 * 120; i++) {
        if (b.pendingSupply) TD.game.pickSupply(b.pendingSupply[0]);
        b.step(1 / 60);
        if (b.time > 8 && b.monsters.filter((m) => !m.dead && m.x > 400 && m.x < 1150).length >= 14) break;
      }
      TD.game.paused = true;
      b.castSkill(0, 2);
      const r = TD.game.renderer;
      for (let i = 0; i < 18; i++) {
        b.step(1 / 60);
        b.wall.hp = b.wall.max;
        r.update && r.update(1 / 60);
        r.render(1 / 60);
      }
    }, id);
    tiles.push(await snap(page, 'skill-' + id));
  }
  await page.close();
  strip(tiles, '3-主动技能.png');
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    if (SHOW.includes('shop')) await shop(browser);
    if (SHOW.includes('battle')) await battle(browser);
    if (SHOW.includes('skills')) await skills(browser);
  } finally {
    await browser.close();
  }
})();
