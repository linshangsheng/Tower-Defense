// itch.io 上架素材生成器：HTML5 压缩包 + 截图 + GIF + 封面（输出到 itch/）
// 用法：node tools/itch.js [zip|shots|gif|cover|verify|all]   默认 all
//   demo   试玩版（第 100 关以后和绿色以外的装备 / 武器都锁住，设计书 127）：打成 itch/archer-on-the-wall-demo-html5.zip，并检查锁得对不对
//   zip    把游戏需要的文件打成 itch/archer-on-the-wall-html5.zip（index.html 在压缩包根目录）
//   shots  用一个"展示用存档"（英文界面、顶级装备）拍 6 张 1280×720 截图
//   gif    按固定帧率推进战斗，导出 itch/gameplay.gif
//   cover  把战斗截图合成 630×500 封面（另有 2 倍图）
//   verify 把压缩包解开，放在另一个端口的子路径里、用 960×540 的 iframe 打开（模拟 itch 的嵌入方式），检查能进游戏、没有报错
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { execFileSync } = require('child_process');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  ({ chromium } = require(path.join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright')));
}

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'itch');
const SHOTS = path.join(OUT, 'screenshots');
const ZIP = path.join(OUT, 'archer-on-the-wall-html5.zip');
const DEMO_ZIP = path.join(OUT, 'archer-on-the-wall-demo-html5.zip');
const GAME_FILES = ['index.html', 'manifest.webmanifest', 'sw.js', 'CREDITS.md', 'css', 'i18n', 'icons', 'src'];
const what = process.argv[2] || 'all';
const BATTLE_LEVEL = +process.env.BATTLE_LEVEL || 45;
const want = (k) => what === 'all' || what === k;

// ---------- 压缩包 ----------
function buildZip() {
  fs.mkdirSync(OUT, { recursive: true });
  if (fs.existsSync(ZIP)) fs.unlinkSync(ZIP);
  execFileSync('zip', ['-q', '-r', '-X', ZIP, ...GAME_FILES], { cwd: ROOT });
  // 正式版是当下载版卖的：压缩包里放一份怎么运行的说明
  const readme = path.join(os.tmpdir(), 'README.txt');
  fs.writeFileSync(
    readme,
    [
      'Archer on the Wall — full version / 城头射手 正式版',
      '',
      'How to play / 怎么玩',
      '1. Unzip the whole folder. / 把整个压缩包解压到一个文件夹。',
      '2. Double-click index.html (Chrome, Edge or Firefox). / 用 Chrome、Edge 或 Firefox 双击打开 index.html。',
      '3. No installation, no internet needed. / 不用安装，也不需要联网。',
      '',
      'Your save lives in the browser. Use Settings > Export save to back it up. / 存档保存在浏览器里，建议在「设置」里定期「导出存档」备份。',
      '',
      'Feedback / 反馈: https://linshangsheng.itch.io/archer-on-the-wall',
      'Credits / 致谢: see CREDITS.md',
      '',
    ].join('\r\n')
  );
  execFileSync('zip', ['-q', '-j', ZIP, readme]);
  const list = execFileSync('unzip', ['-Z1', ZIP]).toString().split('\n').filter((f) => f && !f.endsWith('/'));
  const mb = fs.statSync(ZIP).size / 1048576;
  console.log(`zip：${list.length} 个文件，${mb.toFixed(1)} MB`);
  if (!list.includes('index.html')) throw new Error('index.html 不在压缩包根目录');
  if (list.length > 1000) throw new Error('itch.io 的 HTML5 压缩包最多 1000 个文件');
  if (mb > 500) throw new Error('压缩包超过 500 MB');
}

// ---------- 试玩版 ----------
// 复制一份游戏文件，把 config.js 里的 demo: false 改成 true、sw.js 的缓存名加 -demo，再打包。正式版的源码不动
function buildDemoDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'itch-demo-'));
  for (const f of GAME_FILES) fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true });
  const patch = (file, from, to) => {
    const p = path.join(dir, file);
    const src = fs.readFileSync(p, 'utf8');
    if (!src.includes(from)) throw new Error(`${file} 里找不到 ${from}`);
    fs.writeFileSync(p, src.replace(from, to));
  };
  patch('src/data/config.js', '    demo: false,', '    demo: true,');
  patch('sw.js', "const VERSION = 'scyx-", "const VERSION = 'scyx-demo-");
  return dir;
}
function buildDemoZip() {
  const dir = buildDemoDir();
  if (fs.existsSync(DEMO_ZIP)) fs.unlinkSync(DEMO_ZIP);
  execFileSync('zip', ['-q', '-r', '-X', DEMO_ZIP, ...GAME_FILES], { cwd: dir });
  const list = execFileSync('unzip', ['-Z1', DEMO_ZIP]).toString().split('\n').filter((f) => f && !f.endsWith('/'));
  console.log(`demo zip：${list.length} 个文件，${(fs.statSync(DEMO_ZIP).size / 1048576).toFixed(1)} MB`);
  if (!list.includes('index.html')) throw new Error('index.html 不在压缩包根目录');
  return dir;
}

async function verifyDemo(browser, dir) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('shouchengyingxiong.lang', 'en'));
  await page.goto('file://' + path.join(dir, 'index.html'));
  await page.waitForTimeout(1200);
  let fail = 0;
  const check = (ok, msg) => {
    console.log(`${ok ? '✓' : '✗'} 试玩版：${msg}`);
    if (!ok) fail++;
  };
  check(await page.evaluate(() => TD.config.demo === true), 'config.demo 是 true');
  check((await page.evaluate(() => document.querySelector('.title-foot').textContent)).startsWith('Demo '), '标题底部写着 Demo');
  await page.evaluate(() => {
    TD.quality.setMode('high');
    const s = TD.game.save;
    s.settings.diffChosen = true;
    s.stats.shopGuided = true;
    s.copper = 1e9;
    s.silver = 1e9;
    s.gold = 1e9;
    s.diamond = 1e6;
    for (let k = 1; k <= 100; k++) s.levels[k] = { stars: 3, clears: 1 };
    s.settings.testMode = true; // 试玩版里测试模式不该生效
  });
  check(await page.evaluate(() => !TD.progression.testMode(TD.game.save) && !TD.progression.isUnlocked(TD.game.save, 101) && TD.progression.isUnlocked(TD.game.save, 100)), '通关到第 100 关：第 101 关锁着，测试模式不生效');
  // 商店：武器
  await page.evaluate(() => {
    TD.ui.showShop(45, 'equip');
    document.querySelectorAll('.equip-cats .cat')[0].click();
  });
  await page.waitForTimeout(300);
  const wcards = await page.evaluate(() => [...document.querySelectorAll('.shop-content .card')].map((c) => ({ locked: c.classList.contains('demo-locked'), green: c.classList.contains('wr-1') })));
  check(wcards.filter((c) => c.green).every((c) => !c.locked) && wcards.filter((c) => !c.green).length > 0 && wcards.filter((c) => !c.green).every((c) => c.locked), '武器页：绿色的正常，其余颜色都是灰的');
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('.shop-content .card.demo-locked .buy')][0];
    el.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(os.tmpdir(), 'demo-shop.png') });
  await page.click('.shop-content .card.demo-locked .buy >> nth=0');
  await page.waitForTimeout(300);
  check(await page.evaluate(() => !!document.querySelector('.demo-notice')), '点灰色武器的购买：弹出试玩版提示');
  await page.screenshot({ path: path.join(os.tmpdir(), 'demo-notice.png') });
  await page.evaluate(() => TD.ui.closeModal());
  const owned0 = await page.evaluate(() => Object.keys(TD.data.weapons).filter((id) => TD.game.save.weapons[id].owned && TD.data.weapons[id].rarity > 1).length);
  check(owned0 === 0, '灰色武器没有被买下来（钱再多也不行）');
  check(await page.evaluate(() => { const P = TD.progression; const id = Object.keys(TD.data.weapons).find((k) => TD.data.weapons[k].rarity === 1 && !TD.game.save.weapons[k].owned); return P.buyWeapon(TD.game.save, id) && TD.game.save.weapons[id].owned; }), '绿色武器可以买');
  check(await page.evaluate(() => { const P = TD.progression; const s = TD.game.save; const id = Object.keys(TD.data.equipment).find((k) => TD.data.equipment[k].rarity === 2); const g = Object.keys(TD.data.equipment).find((k) => TD.data.equipment[k].rarity === 1); return !P.buyEquip(s, id) && !s.equipOwned[id] && P.buyEquip(s, g); }), '装备：蓝色买不了、绿色能买');
  // 装备页：点灰色装备的购买
  await page.evaluate(() => {
    TD.ui.showShop(45, 'equip');
    document.querySelectorAll('.equip-cats .cat')[1].click();
  });
  await page.waitForTimeout(300);
  const gcards = await page.evaluate(() => [...document.querySelectorAll('.shop-content .card')].map((c) => ({ locked: c.classList.contains('demo-locked'), green: c.classList.contains('wr-1') })));
  check(gcards.length > 0 && gcards.every((c) => (c.green ? !c.locked : c.locked)), '装备页：绿色正常，其余颜色都是灰的');
  await page.click('.shop-content .card.demo-locked .buy >> nth=0');
  await page.waitForTimeout(300);
  check(await page.evaluate(() => !!document.querySelector('.demo-notice')), '点灰色装备的购买：弹出试玩版提示');
  await page.evaluate(() => TD.ui.closeModal());
  // 地图
  await page.evaluate(() => TD.ui.showMap(10));
  await page.waitForTimeout(300);
  check(await page.evaluate(() => document.querySelector('.map-note') && /demo|Demo/.test(document.querySelector('.map-note').textContent)), '第 10 章通关后的提示是试玩版结束');
  await page.screenshot({ path: path.join(os.tmpdir(), 'demo-map10.png') });
  await page.evaluate(() => TD.ui.showMap(11));
  await page.waitForTimeout(300);
  check(await page.evaluate(() => [...document.querySelectorAll('.map-node')].length === 10 && [...document.querySelectorAll('.map-node')].every((n) => n.classList.contains('demo-locked'))), '第 11 章的 10 个关卡全是灰的');
  await page.screenshot({ path: path.join(os.tmpdir(), 'demo-map11-grey.png') });
  await page.click('.map-node >> nth=0');
  await page.waitForTimeout(300);
  check(await page.evaluate(() => !!document.querySelector('.demo-notice')), '点第 101 关：弹出试玩版提示');
  await page.screenshot({ path: path.join(os.tmpdir(), 'demo-map11.png') });
  await page.evaluate(() => TD.ui.closeModal());
  check(await page.evaluate(() => { TD.ui.showPreview(150); return !!document.querySelector('.demo-notice'); }), '直接打开第 150 关的预览也被拦住');
  await page.evaluate(() => TD.ui.closeModal());
  // 章节列表
  await page.evaluate(() => TD.ui.showChapterList(10));
  await page.waitForTimeout(200);
  check(await page.evaluate(() => document.querySelectorAll('.chapter-card.demo-locked').length === 10), '章节列表：后 10 章是灰的');
  await page.evaluate(() => (TD.ui.closeModal(), TD.ui.showSettings()));
  check(await page.evaluate(() => ![...document.querySelectorAll('.modal button')].some((b) => /^(Test|测试)/.test(b.textContent))), '设置里没有「测试」按钮');
  check(errors.length === 0, errors.length ? errors.join('; ') : '没有报错');
  await page.close();
  if (fail) process.exitCode = 1;
}

// ---------- 展示用存档 ----------
async function openGame(browser, viewport) {
  const page = await browser.newPage({ viewport: viewport || { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('页面错误：', e.message));
  await page.addInitScript(() => localStorage.setItem('shouchengyingxiong.lang', 'en'));
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForTimeout(1500);
  // 软件渲染下自适应画质会自己降档、还弹提示：截图一律按最高画质，提示收掉
  await page.evaluate(() => TD.quality.setMode('high'));
  await page.evaluate(() => {
    const s = TD.game.save;
    const D = TD.data;
    s.settings.diffChosen = true;
    s.settings.fullscreen = false;
    s.stats.shopGuided = true;
    TD.progression.enableTestMode(s, TD.progression.TEST_PASSWORD);
    for (const k of D.storyOrder) s.story[k] = 'read';
    for (const t of Object.keys(D.monsters)) s.seenMonsters[t] = true;
    for (let k = 1; k <= 120; k++) s.levels[k] = { stars: 3, clears: 1, crown: k % 3 === 0, mission: true };
    // 最好的装备：每个部位挑品质最高的一件
    const best = {};
    for (const [id, e] of Object.entries(D.equipment)) if (!best[e.slot] || e.rarity > D.equipment[best[e.slot]].rarity) best[e.slot] = id;
    for (const k of Object.keys(D.activeSkills)) s.activeOwned[k] = true;
    for (const k of Object.keys(D.passiveSkills)) s.passiveOwned[k] = true;
    for (const w of Object.keys(s.weapons)) s.weapons[w].owned = true;
    const lo = s.loadout;
    lo.weapon = 'genesisBow';
    lo.active = ['arrowRain', 'thunder', 'frost'];
    lo.passive = ['lightning', 'fireball', 'frostNova'];
    for (const [slot, id] of Object.entries(best)) if (slot in lo.equip) lo.equip[slot] = id;
    s.loadout.autoCast = true;
  });
  return page;
}
// 进入第 n 关，快进 secs 秒；城墙调成不倒，补给自动选第一张
async function enterBattle(page, level, secs, hook) {
  await page.evaluate(
    ([level, secs, hook]) => {
      TD.ui.closeModal();
      TD.game.startBattle(level);
      const b = TD.game.battle;
      b.wall.max = b.wall.hp = 1e13;
      window.__b = b;
      if (hook) eval(hook);
      for (let i = 0; i < secs * 60 && !b.over; i++) {
        if (b.pendingSupply) TD.game.pickSupply(b.pendingSupply[0]);
        b.step(1 / 60);
      }
    },
    [level, secs, hook || '']
  );
}

// 一张"热闹"的战斗截图：快进到屏幕上怪物够多（≥ n 只在 x>450 处），放三个技能，再往前走半秒让特效铺开
async function crowdShot(page, level, n) {
  await enterBattle(page, level, 0);
  await page.evaluate((n) => {
    const b = TD.game.battle;
    b.stats.atk *= 0.4; // 别一下子杀光
    let t = 0;
    for (let i = 0; i < 60 * 150 && !b.over; i++) {
      if (b.pendingSupply) TD.game.pickSupply(b.pendingSupply[0]);
      b.step(1 / 60);
      t += 1 / 60;
      if (b.monsters.filter((m) => !m.dead && m.x > 450 && m.x < 1150).length >= n && t > 8) break;
    }
    for (let k = 0; k < 3; k++) b.castSkill(k, 2);
    TD.game.paused = true;
    const r = TD.game.renderer;
    for (let i = 0; i < 40; i++) {
      b.step(1 / 60);
      b.wall.hp = b.wall.max;
      r.update && r.update(1 / 60);
      r.render(1 / 60);
    }
  }, n);
}

async function peek(browser, levels) {
  const dir = path.join(os.tmpdir(), 'itch-peek');
  fs.mkdirSync(dir, { recursive: true });
  const page = await openGame(browser);
  for (const lv of levels) {
    await crowdShot(page, lv, 14);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(dir, `lv${lv}.png`) });
    console.log('peek', lv);
    await page.evaluate(() => (TD.game.paused = false));
  }
  await page.close();
  console.log(dir);
}

async function shots(browser) {
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const f of fs.readdirSync(SHOTS)) if (f.endsWith('.png')) fs.unlinkSync(path.join(SHOTS, f)); // 只清自己的截图，避免改名后留下旧图
  const page = await openGame(browser);
  const snap = async (name) => {
    await page.evaluate(() => TD.quality.level && TD.quality.set(0, 'manual'));
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(SHOTS, name + '.png') });
    console.log('截图', name);
  };
  // 先拍界面（战场画面会留在背景里，所以放在战斗之前）
  await page.evaluate(() => TD.ui.showMap(5));
  await snap('04-map');
  await page.evaluate(() => {
    TD.ui.showShop(45, 'equip');
    document.querySelectorAll('.equip-cats .cat')[0].click();
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    // 滚到金色品质的武器
    const el = [...document.querySelectorAll('.shop-content *')].find((e) => e.children.length === 0 && /Gold quality/i.test(e.textContent));
    if (el) el.scrollIntoView({ block: 'start' });
  });
  await snap('05-weapons');
  await page.evaluate(() => TD.ui.showWardrobe());
  await snap('06-wardrobe');
  await page.evaluate(() => TD.ui.showTitle());
  await snap('07-title');
  // 战斗：第 200 关巨龙正在喷火
  await enterBattle(page, 200, 0, 'b.autoCast = false;');
  await dragonScene(page, 'fire');
  await snap('01-dragon-boss');
  // 熔岩裂隙（第 45 关）和冰霜雪原（第 35 关），技能全开
  await crowdShot(page, BATTLE_LEVEL, 14);
  await snap('02-battle');
  await crowdShot(page, 35, 14);
  await snap('03-battle-frost');
  await page.close();
}

// 把第 200 关的巨龙推到出场位置，并让它处于某个技能的释放姿势
async function dragonScene(page, anim) {
  await page.evaluate((anim) => {
    const b = TD.game.battle;
    b.stats.atk = 0.001;
    for (let i = 0; i < 6000 && !b.monsters.some((m) => m.type === 'abyssDragon' && m.x <= 810); i++) {
      b.step(0.05);
      if (b.pendingSupply) TD.game.pickSupply(b.pendingSupply[0]);
      b.monsters.forEach((m) => m.type !== 'abyssDragon' && (m.dead = true));
    }
    TD.game.paused = true;
    const m = b.monsters.find((x) => x.type === 'abyssDragon');
    m.ai.anim = anim;
    m.ai.animTimer = anim === 'fire' ? 1.0 : 1.2;
    b.monsters.forEach((x) => (x.hitFlash = 0)); // 刚被箭打中时身上会有一层白闪，截图里不要
    const r = TD.game.renderer;
    r.fx.length = 0;
    r.vfx.fx.length = 0;
    b.wall.hp = b.wall.max;
    r.render(0.016);
    for (let i = 0; i < 4; i++) {
      b.wall.hp = b.wall.max;
      m.hitFlash = 0;
      r.update && r.update(0.05);
      r.render(0.016);
    }
  }, anim);
}

// ---------- GIF ----------
async function gif(browser) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'itch-gif-'));
  const page = await openGame(browser);
  await enterBattle(page, 45, 30);
  await page.evaluate(() => {
    TD.game.paused = true;
    const b = TD.game.battle;
    b.wall.max = b.wall.hp = 1e13;
  });
  const FPS = 10;
  const FRAMES = 70; // 7 秒
  for (let f = 0; f < FRAMES; f++) {
    await page.evaluate(
      ([f, FPS]) => {
        const b = TD.game.battle;
        if (b.pendingSupply) TD.game.pickSupply(b.pendingSupply[0]);
        // 第 6、24、44 帧手动放三个技能，让画面里有技能特效
        if (f === 6) b.castSkill(0, 2);
        if (f === 24) b.castSkill(1, 2);
        if (f === 44) b.castSkill(2, 2);
        const n = 5;
        for (let i = 0; i < n; i++) b.step(1 / (FPS * n));
        TD.game.renderer.update && TD.game.renderer.update(1 / FPS);
        TD.game.renderer.render(1 / FPS);
      },
      [f, FPS]
    );
    await page.screenshot({ path: path.join(dir, `f${String(f).padStart(3, '0')}.png`) });
  }
  await page.close();
  const palette = path.join(dir, 'palette.png');
  const vf = `fps=${FPS},scale=576:-1:flags=lanczos`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%03d.png'), '-vf', `${vf},palettegen=max_colors=64:stats_mode=diff`, palette]);
  const gifPath = path.join(OUT, 'gameplay.gif');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%03d.png'), '-i', palette, '-lavfi', `${vf}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`, '-loop', '0', gifPath]);
  console.log('gif', (fs.statSync(gifPath).size / 1048576).toFixed(2), 'MB');
}

// ---------- 封面 ----------
async function cover(browser) {
  // 封面用的底图：巨龙喷火，界面（血条、按钮）全藏起来；不让英雄放箭，免得龙身上有命中火花
  const gp = await openGame(browser);
  await enterBattle(gp, 200, 0, 'b.autoCast = false; b.stats.atk = 0;');
  await dragonScene(gp, 'fire');
  await gp.addStyleTag({ content: '.hud-top,.hud-bottom,.boss-bar,.hud-boss,.toast,.lane-hint{display:none!important}' });
  await gp.evaluate(() => {
    TD.game.renderer.drawBossBar = () => {}; // 血条是画在画布上的
    TD.game.battle.projectiles.length = 0;
  });
  await gp.waitForTimeout(600);
  const src = (await gp.screenshot()).toString('base64');
  await gp.close();
  const logo = fs.readFileSync(path.join(ROOT, 'icons', 'icon-512.png')).toString('base64');
  const html = `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;width:630px;height:500px;overflow:hidden;background:#0a0716}
    .bg{position:absolute;inset:0;background:url(data:image/png;base64,${src}) no-repeat,linear-gradient(180deg,#1a0d33 0%,#2a1450 40%,#120a22 100%);background-size:768px 432px,100% 100%;background-position:-129px 44px,0 0}
    .shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,5,20,.35) 0%,rgba(8,5,20,0) 30%,rgba(8,5,20,.15) 52%,rgba(8,5,20,.92) 100%),radial-gradient(ellipse at 50% 0%,rgba(0,0,0,.35),transparent 60%)}
    .logo{position:absolute;left:50%;top:292px;width:96px;height:96px;margin-left:-48px;filter:drop-shadow(0 0 16px rgba(255,200,100,.65))}
    .t1{position:absolute;left:0;right:0;top:386px;text-align:center;font:900 52px/1 Inter,'Noto Sans CJK SC',system-ui,sans-serif;letter-spacing:1px;color:#f6c657;text-shadow:0 3px 0 #6b3b0c,0 0 24px rgba(255,170,60,.6),0 6px 14px rgba(0,0,0,.8)}
    .t2{position:absolute;left:0;right:0;top:448px;text-align:center;font:700 16px/1 Inter,system-ui,sans-serif;letter-spacing:4px;color:#ffe9bd;text-shadow:0 2px 6px #000}
    .badge{position:absolute;right:12px;top:12px;padding:6px 12px;border-radius:14px;background:rgba(15,10,30,.72);border:1px solid rgba(246,198,87,.6);font:700 13px/1 Inter,system-ui,sans-serif;color:#ffe9bd;letter-spacing:.5px}
  </style><div class="bg"></div><div class="shade"></div>
  <div class="badge">200 LEVELS · FREE · BROWSER</div>
  <img class="logo" src="data:image/png;base64,${logo}"><div class="t1">Archer on the Wall</div><div class="t2">TOWER DEFENSE · BOSS BATTLES · 17 LANGUAGES</div>`;
  for (const [scale, name] of [[1, 'cover-630x500.png'], [2, 'cover-1260x1000.png']]) {
    const page = await browser.newPage({ viewport: { width: 630, height: 500 }, deviceScaleFactor: scale });
    await page.setContent(html);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, name) });
    await page.close();
    console.log('封面', name);
  }
}

// ---------- 验证：模拟 itch 的嵌入方式 ----------
async function verify(browser) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'itch-zip-'));
  execFileSync('unzip', ['-q', ZIP, '-d', path.join(dir, 'game')]);
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
  const mk = (handler) => new Promise((res) => { const s = http.createServer(handler); s.listen(0, '127.0.0.1', () => res(s)); });
  const gameSrv = await mk((req, res) => {
    const p = path.join(dir, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
    if (!p.startsWith(dir) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  const gameUrl = `http://127.0.0.1:${gameSrv.address().port}/game/12345/index.html`;
  fs.mkdirSync(path.join(dir, 'game', '12345'), { recursive: true });
  for (const f of GAME_FILES) fs.renameSync(path.join(dir, 'game', f), path.join(dir, 'game', '12345', f));
  const hostSrv = await mk((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<body style="margin:0;background:#222"><iframe id="g" src="${gameUrl}" width="960" height="540" style="border:0" allow="fullscreen; autoplay"></iframe>`);
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
  const errors = [];
  const logs = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => (m.type() === 'error' ? errors.push(m.text()) : logs.push(m.text())));
  await page.goto(`http://127.0.0.1:${hostSrv.address().port}/`);
  const frame = page.frameLocator('#g');
  await frame.locator('.title-foot').waitFor({ timeout: 15000 });
  const frameObj = page.frames().find((f) => f.url().includes('/game/'));
  const info = await frameObj.evaluate(() => ({ w: innerWidth, h: innerHeight, lang: TD.i18n.lang || TD.i18n.current, title: document.title, ls: (() => { try { localStorage.setItem('t', '1'); return localStorage.getItem('t') === '1'; } catch (e) { return false; } })() }));
  console.log('iframe 里进入标题：', JSON.stringify(info));
  // 点“开始/继续”进到难度选择，再进地图，确认不依赖 file:// 也不依赖根路径
  await frameObj.evaluate(() => { TD.game.save.settings.diffChosen = true; TD.ui.showMap(1); });
  await page.waitForTimeout(500);
  const nodes = await frameObj.evaluate(() => document.querySelectorAll('.map-node').length);
  console.log('地图关卡节点：', nodes);
  await page.screenshot({ path: path.join(os.tmpdir(), 'itch-verify.png') });
  // 真实时间里打 4 秒（60 帧 / 秒）：英文界面的战斗 HUD 不能变回中文（v1.21 修过：HUD 每帧改文字会让多语言观察器误以为有翻译插件在打架而停止翻译）
  await frameObj.evaluate(() => { TD.ui.closeModal(); TD.game.startBattle(5); });
  await page.waitForTimeout(4500);
  const cjk = await frameObj.evaluate(() => [...document.querySelectorAll('.hud-top *, .hud-bottom *')].filter((e) => e.children.length === 0 && /[\u4e00-\u9fff]/.test(e.textContent)).map((e) => e.textContent));
  console.log('战斗 HUD 里剩下的中文：', cjk.length ? cjk : '无');
  if (cjk.length) process.exitCode = 1;
  errors.push(...logs.filter((l) => /i18n/.test(l)));
  const bad = errors.filter((e) => !/serviceWorker|Service ?Worker|sw\.js|离线缓存/.test(e));
  console.log('错误：', bad.length ? bad : '无', errors.length - bad.length ? `（另有 ${errors.length - bad.length} 条 Service Worker 相关，itch 域名下可能不允许，游戏已捕获）` : '');
  await page.close();
  gameSrv.close();
  hostSrv.close();
  if (!info.title || nodes !== 10 || bad.length) process.exitCode = 1;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  if (want('zip')) buildZip();
  let demoDir = null;
  if (want('demo')) demoDir = buildDemoZip();
  if (['all', 'shots', 'gif', 'cover', 'verify', 'peek', 'demo'].includes(what)) {
    const browser = await chromium.launch();
    try {
      if (what === 'peek') await peek(browser, (process.argv[3] || '5,15,25,35,45,55,65,95').split(',').map(Number));
      if (want('shots')) await shots(browser);
      if (want('gif')) await gif(browser);
      if (want('cover')) await cover(browser);
      if (want('verify')) await verify(browser);
      if (demoDir) await verifyDemo(browser, demoDir);
    } finally {
      await browser.close();
    }
  }
})();
