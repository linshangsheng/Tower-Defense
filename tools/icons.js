// 生成 PWA 图标（设计书 43.1）：用游戏里的绘制代码画铛铛头像，输出 icons/icon-192.png、icon-512.png
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
      // 圆角方形底：天空蓝 → 草地绿
      const g = ctx.createLinearGradient(0, 0, 0, size);
      g.addColorStop(0, '#9fdcff');
      g.addColorStop(0.62, '#bfe8ff');
      g.addColorStop(0.62, '#8fd17a');
      g.addColorStop(1, '#6fbf5a');
      ctx.fillStyle = g;
      TD.sprites.roundRect(ctx, 0, 0, size, size, size * 0.18);
      ctx.fill();
      const p = TD.sprites.heroPortrait(Math.round(size * 0.8), 'win', 'classic', 'dang');
      ctx.drawImage(p, size * 0.1, size * 0.15);
      return c.toDataURL('image/png').split(',')[1];
    }, size);
    fs.writeFileSync(path.join(__dirname, '..', 'icons', `icon-${size}.png`), Buffer.from(data, 'base64'));
    console.log(`icons/icon-${size}.png`);
  }
  await browser.close();
})();
