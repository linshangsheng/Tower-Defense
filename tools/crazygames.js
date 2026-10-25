// CrazyGames 版本（设计书 128）：打出 crazygames/archer-on-the-wall-crazygames.zip，并模拟门户的嵌入方式检查
// 用法：node tools/crazygames.js [build|verify|all]   默认 all
// 这个版本和普通网页版是同一份源码，打包时只改：
//   · config.js 的 portal: null → 'crazygames'（接入 SDK、不放外链、不自己请求全屏、隐藏测试按钮）
//   · index.html：加上门户 SDK 的 <script>、去掉 Service Worker 的注册
//   · 不放 sw.js（不做离线缓存）、i18n/（语言词典的 json 源文件，游戏运行时不用，真正用的是 src/i18n/*.js）
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
const OUT = path.join(ROOT, 'crazygames');
const ZIP = path.join(OUT, 'archer-on-the-wall-crazygames.zip');
const GAME_FILES = ['index.html', 'manifest.webmanifest', 'CREDITS.md', 'css', 'icons', 'src'];
const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
const what = process.argv[2] || 'all';

function buildDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-build-'));
  for (const f of GAME_FILES) fs.cpSync(path.join(ROOT, f), path.join(dir, f), { recursive: true });
  const patch = (file, from, to) => {
    const p = path.join(dir, file);
    const src = fs.readFileSync(p, 'utf8');
    if (!src.includes(from)) throw new Error(`${file} 里找不到：${from.slice(0, 50)}`);
    fs.writeFileSync(p, src.replace(from, to));
  };
  patch('src/data/config.js', '    portal: null,', "    portal: 'crazygames',");
  patch('index.html', '    <script src="src/core/ns.js"></script>', `    <script src="${SDK_URL}"></script>\n    <script src="src/core/ns.js"></script>`);
  // 去掉 Service Worker 的注册（门户不需要离线缓存，也不想有额外的缓存层）
  const p = path.join(dir, 'index.html');
  const html = fs.readFileSync(p, 'utf8');
  const a = html.indexOf('    <script>\n      // 可安装 / 离线（设计书 43）');
  const b = html.indexOf('</script>', a) + '</script>\n'.length;
  if (a < 0 || b <= a) throw new Error('index.html 里找不到 Service Worker 注册那段');
  fs.writeFileSync(p, html.slice(0, a) + html.slice(b));
  // 词典里提到 itch.io 的条目（只给 itch 版的弹窗和「关于」用）门户版用不到，去掉；ui.js 里的网址也清空
  for (const f of fs.readdirSync(path.join(dir, 'src', 'i18n'))) {
    const q = path.join(dir, 'src', 'i18n', f);
    fs.writeFileSync(q, fs.readFileSync(q, 'utf8').split('\n').filter((l) => !/itch\.io/i.test(l)).join('\n'));
  }
  patch('src/ui/ui.js', "UI.ITCH_URL = 'https://linshangsheng.itch.io/archer-on-the-wall';", "UI.ITCH_URL = '';");
  return dir;
}

function build() {
  fs.mkdirSync(OUT, { recursive: true });
  const dir = buildDir();
  if (fs.existsSync(ZIP)) fs.unlinkSync(ZIP);
  execFileSync('zip', ['-q', '-r', '-X', ZIP, ...GAME_FILES], { cwd: dir });
  const list = execFileSync('unzip', ['-Z1', ZIP]).toString().split('\n').filter((f) => f && !f.endsWith('/'));
  const raw = execFileSync('unzip', ['-l', ZIP]).toString().trim().split('\n').pop().trim().split(/\s+/)[0];
  console.log(`zip：${list.length} 个文件，压缩后 ${(fs.statSync(ZIP).size / 1048576).toFixed(1)} MB，解压后 ${(+raw / 1048576).toFixed(1)} MB`);
  if (!list.includes('index.html')) throw new Error('index.html 不在压缩包根目录');
  return dir;
}

// 门户 SDK 的替身：记录每次调用，用来检查我们按顺序、在对的时候通知了门户
const MOCK_SDK = `window.__cg = [];
window.CrazyGames = { SDK: {
  init() { window.__cg.push('init'); return Promise.resolve(); },
  game: {
    loadingStart() { window.__cg.push('loadingStart'); },
    loadingStop() { window.__cg.push('loadingStop'); },
    gameplayStart() { window.__cg.push('gameplayStart'); },
    gameplayStop() { window.__cg.push('gameplayStop'); },
  },
} };`;

async function verify(dir) {
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.md': 'text/plain' };
  const server = await new Promise((res) => {
    const s = http.createServer((req, rs) => {
      const p = path.join(dir, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
      if (!p.startsWith(dir) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
        rs.writeHead(404);
        return rs.end();
      }
      rs.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rs);
    });
    s.listen(0, '127.0.0.1', () => res(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  let fail = 0;
  const check = (ok, msg) => {
    console.log(`${ok ? '✓' : '✗'} CrazyGames 版：${msg}`);
    if (!ok) fail++;
  };
  // 文件里不能有别的平台的名字和外链
  const bad = [];
  const walk = (d) => {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (/\.(js|html|css|md|webmanifest)$/.test(f) && f !== 'CREDITS.md') {
        const t = fs.readFileSync(p, 'utf8');
        if (/itch\.io/i.test(t.replace(/CC BY[^\n]*/g, ''))) bad.push(path.relative(dir, p));
      }
    }
  };
  walk(dir);
  // ui.js 里还留着 UI.ITCH_URL 的定义（门户版不会显示），其余文件不应出现 itch.io
  check(bad.every((f) => f === 'src/ui/ui.js'), `除 ui.js 里一句从不显示的中文提示外，没有 itch.io 字样（${bad.join(', ') || '无'}）`);
  check(!fs.existsSync(path.join(dir, 'sw.js')) && !/serviceWorker/.test(fs.readFileSync(path.join(dir, 'index.html'), 'utf8')), '没有 Service Worker');
  // 1) 有 SDK：嵌在 iframe 里，SDK 用替身
  const host = http.createServer((req, rs) => {
    rs.writeHead(200, { 'Content-Type': 'text/html' });
    rs.end(`<body style="margin:0"><iframe id="g" src="${base}/index.html" width="960" height="540" style="border:0" allow="autoplay; fullscreen"></iframe>`);
  });
  await new Promise((r) => host.listen(0, '127.0.0.1', r));
  const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
  const errors = [];
  const external = new Set();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['127.0.0.1', 'sdk.crazygames.com'].includes(u.hostname) && !/^(data|blob):/.test(r.url())) external.add(u.hostname);
  });
  await page.route(SDK_URL, (route) => route.fulfill({ contentType: 'text/javascript', body: MOCK_SDK }));
  await page.addInitScript(() => localStorage.setItem('shouchengyingxiong.lang', 'en'));
  await page.goto(`http://127.0.0.1:${host.address().port}/`);
  const fr = () => page.frames().find((f) => f.url().startsWith(base));
  await page.frameLocator('#g').locator('.title-foot').waitFor({ timeout: 15000 });
  const f = fr();
  await page.waitForTimeout(600);
  let calls = await f.evaluate(() => window.__cg.slice());
  check(calls[0] === 'init' && calls.indexOf('loadingStart') > 0 && calls.indexOf('loadingStop') > calls.indexOf('loadingStart'), `加载时：init → loadingStart → loadingStop（${calls.join(' → ')}）`);
  check(!calls.includes('gameplayStart'), '在标题画面时没有通知「开始玩」');
  await f.evaluate(() => {
    const s = TD.game.save;
    s.settings.diffChosen = true;
    s.stats.shopGuided = true;
    for (const t of Object.keys(TD.data.monsters)) s.seenMonsters[t] = true;
    TD.ui.closeModal();
    TD.game.startBattle(1);
  });
  await page.waitForTimeout(800);
  calls = await f.evaluate(() => window.__cg.slice());
  check(calls[calls.length - 1] === 'gameplayStart', '开始战斗：gameplayStart');
  await f.evaluate(() => (TD.game.paused = true));
  await page.waitForTimeout(400);
  calls = await f.evaluate(() => window.__cg.slice());
  check(calls[calls.length - 1] === 'gameplayStop', '暂停：gameplayStop');
  await f.evaluate(() => (TD.game.paused = false));
  await page.waitForTimeout(400);
  calls = await f.evaluate(() => window.__cg.slice());
  check(calls[calls.length - 1] === 'gameplayStart', '继续：gameplayStart');
  await f.evaluate(() => TD.game.battle.step(1e-9) && 0);
  await f.evaluate(() => {
    const b = TD.game.battle;
    b.wall.hp = 0;
    b.over = true;
  });
  await page.waitForTimeout(500);
  calls = await f.evaluate(() => window.__cg.slice());
  check(calls[calls.length - 1] === 'gameplayStop', '战斗结束：gameplayStop');
  check(calls.filter((c) => c === 'gameplayStart').length === calls.filter((c) => c === 'gameplayStop').length, 'gameplayStart / gameplayStop 成对');
  // 界面：没有退出、测试、全屏、外链
  const ui = await f.evaluate(() => {
    TD.game.battle = null;
    TD.ui.showTitle();
    const title = [...document.querySelectorAll('.title-buttons .btn')].map((b) => b.textContent);
    TD.ui.showSettings();
    const settings = document.querySelector('.modal').textContent;
    TD.ui.showAbout();
    const about = document.querySelector('.about');
    return { title, settings, aboutText: about.textContent, links: about.querySelectorAll('a').length };
  });
  check(!ui.title.some((t) => /Quit/.test(t)), '标题画面没有「退出游戏」');
  check(!/Test|Fullscreen/.test(ui.settings), '设置里没有「测试」和「全屏」');
  check(ui.links === 0 && !/itch/i.test(ui.aboutText), '「关于」里没有外链');
  check(await f.evaluate(() => TD.config.demo === false && TD.progression.isUnlocked(TD.game.save, 1) && Object.keys(TD.data.levels).length === 200), '是完整的 200 关（不是试玩版）');
  check(external.size === 0, `只访问了本地文件和门户 SDK（${[...external].join(', ') || '无其他域名'}）`);
  check(errors.length === 0, errors.length ? errors.join('; ') : '没有报错');
  await page.close();
  // 2) 没有 SDK（被拦截）：游戏照常运行
  const p2 = await browser.newPage({ viewport: { width: 1000, height: 600 } });
  const err2 = [];
  p2.on('pageerror', (e) => err2.push(e.message));
  await p2.route(SDK_URL, (route) => route.abort());
  await p2.addInitScript(() => localStorage.setItem('shouchengyingxiong.lang', 'en'));
  await p2.goto(`${base}/index.html`);
  await p2.locator('.title-foot').waitFor({ timeout: 15000 });
  await p2.evaluate(() => {
    const s = TD.game.save;
    s.settings.diffChosen = true;
    TD.ui.closeModal();
    TD.game.startBattle(1);
    const b = TD.game.battle;
    for (let i = 0; i < 300; i++) b.step(1 / 60);
  });
  await p2.waitForTimeout(500);
  check(err2.length === 0 && (await p2.evaluate(() => TD.portal.failed === true)), '拿不到 SDK 时：游戏照常运行、不报错');
  await p2.close();
  await browser.close();
  server.close();
  host.close();
  if (fail) process.exitCode = 1;
}

(async () => {
  let dir = null;
  if (what === 'build' || what === 'all') dir = build();
  if (what === 'verify' || what === 'all') await verify(dir || buildDir());
})();
