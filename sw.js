// Service Worker（设计书 43）：首次打开时缓存全部文件，之后缓存优先，断网也能玩
// 更新游戏时改 VERSION，旧缓存会在新版本启动时删除
const VERSION = 'scyx-v0.89';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      await cache.addAll(CORE);
      // 从 index.html 里找出所有脚本和样式，一起缓存（不用手动维护文件清单）
      const html = await (await fetch('./index.html', { cache: 'no-store' })).text();
      const files = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => './' + m[1]);
      await cache.addAll(files);
      // 语言词典是 index.html 里的小脚本按需加载的，上面认不出来：逐个缓存（缺哪个都不影响安装）
      const langs = ['en', 'es', 'pt-BR', 'pt-PT', 'ru', 'ja', 'ko', 'de', 'fr', 'zh-Hant', 'tr', 'pl', 'it', 'id', 'vi', 'th'];
      await Promise.all(langs.map((l) => cache.add(`./src/i18n/${l}.js`).catch(() => {})));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    (async () => {
      const hit = await caches.match(event.request, { ignoreSearch: true });
      if (hit) return hit;
      try {
        return await fetch(event.request);
      } catch (e) {
        // 断网时打开首页
        if (event.request.mode === 'navigate') return caches.match('./index.html');
        throw e;
      }
    })()
  );
});
