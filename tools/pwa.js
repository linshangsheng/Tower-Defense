// 离线功能检查（设计书 43.2）：起一个本地静态服务器，确认 Service Worker 注册、缓存全部文件、断网刷新仍能进入游戏
const path = require('path');
const http = require('http');
const fs = require('fs');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  ({ chromium } = require(path.join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright')));
}

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(ROOT) || !fs.existsSync(p)) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});

server.listen(0, '127.0.0.1', async () => {
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let ok = true;
  try {
    await page.goto(url);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForTimeout(1000);
    const info = await page.evaluate(async () => {
      const keys = await caches.keys();
      const reqs = await (await caches.open(keys[0])).keys();
      return { keys, cached: reqs.length, scripts: document.querySelectorAll('script[src]').length };
    });
    console.log(`缓存 ${info.keys.join(',')}：${info.cached} 个文件（页面脚本 ${info.scripts} 个）`);
    if (info.cached < info.scripts + 3) ok = false;
    await context.setOffline(true);
    await page.reload();
    await page.waitForTimeout(1000);
    const offline = await page.evaluate(() => !!(window.TD && TD.game && document.querySelector('.title-foot')));
    console.log('断网刷新：' + (offline ? '正常进入游戏' : '失败'));
    if (!offline) ok = false;
    // 断网也能切换语言（词典文件由 sw.js 单独缓存，设计书 83）
    const lang = await page.evaluate(() => new Promise((res) => TD.i18n.setLang('de', (okLoad) => res(okLoad && TD.i18n.t('开始游戏') === 'Spiel starten'))));
    console.log('断网切换语言：' + (lang ? '正常' : '失败'));
    if (!lang) ok = false;
  } catch (e) {
    ok = false;
    console.log('出错：' + e.message);
  }
  if (errors.length) {
    ok = false;
    console.log(errors.join('\n'));
  }
  await browser.close();
  server.close();
  console.log(ok ? '离线检查通过' : '离线检查失败');
  process.exit(ok ? 0 : 1);
});
