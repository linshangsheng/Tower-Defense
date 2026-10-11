// 生成 PWA 图标（设计书 43.1、57.4）：用游戏里的绘制代码画徽章 Logo，输出 icons/icon-192.png、icon-512.png
const fs = require('fs');
const path = require('path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  ({ chromium } = require(path.join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright')));
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.waitForTimeout(300);
  for (const size of [192, 512]) {
    const data = await page.evaluate((size) => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      // 深色圆角方形底 + 徽章 Logo（设计书 57.4）
      const g = ctx.createRadialGradient(size / 2, size * 0.45, 0, size / 2, size * 0.45, size * 0.75);
      g.addColorStop(0, '#1b2a4a');
      g.addColorStop(1, '#060a14');
      ctx.fillStyle = g;
      TD.sprites.roundRect(ctx, 0, 0, size, size, size * 0.18);
      ctx.fill();
      TD.logo.drawEmblem(ctx, size / 2, size * 0.53, size * 0.34, { t: 0 });
      return c.toDataURL('image/png').split(',')[1];
    }, size);
    fs.writeFileSync(path.join(__dirname, '..', 'icons', `icon-${size}.png`), Buffer.from(data, 'base64'));
    console.log(`icons/icon-${size}.png`);
  }
  await browser.close();
})();
