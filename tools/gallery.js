// 角色画廊（设计书 56）：把主角和怪物放大画在一张图上，检查造型
// 用法：node tools/gallery.js 输出.png [怪物id,怪物id,...] [章节光影，默认 meadow]
const path = require('path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  ({ chromium } = require(path.join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright')));
}
const out = process.argv[2] || 'gallery.png';
const ids = (process.argv[3] || 'hero,heroDing,slime,minijelly,jellyPrince,bunny,mushroom,bee,goblin,gobling,boarKing').split(',');
const pal = process.argv[4] || 'meadow';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.evaluate(
    ([ids, pal]) => {
      const W = 1280;
      const H = 720;
      const c = document.createElement('canvas');
      c.width = W;
      c.height = H;
      c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999';
      document.body.appendChild(c);
      const ctx = c.getContext('2d');
      const P = TD.art.palettes[pal];
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, P.ground[0]);
      bg.addColorStop(1, P.ground[2]);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      const cols = Math.min(4, ids.length);
      const rows = Math.ceil(ids.length / cols);
      const cw = W / cols;
      const ch = H / rows;
      ids.forEach((id, i) => {
        const cx = (i % cols) * cw + cw / 2;
        const cy = Math.floor(i / cols) * ch + ch * 0.82;
        // 小路一样的亮带
        const lg = ctx.createLinearGradient(0, cy - 30, 0, cy + 30);
        lg.addColorStop(0, TD.art.rgba(P.lane, 0));
        lg.addColorStop(0.5, TD.art.rgba(P.lane, 0.6));
        lg.addColorStop(1, TD.art.rgba(P.lane, 0));
        ctx.fillStyle = lg;
        ctx.fillRect(cx - cw / 2, cy - 30, cw, 60);
        const isHero = id.startsWith('hero');
        const size = isHero ? 40 : TD.data.monsters[id].size;
        const k = Math.min((ch * 0.78) / (isHero ? 2.9 * 32 : (TD.data.monsters[id].boss ? 2.6 : 2.2) * size), 3.2);
        const holder = {};
        const s = size * k;
        const c2 = TD.art.litSprite(holder, 1, s, P.rim, 0.32, (g) => {
          TD.sprites.volume = true;
          if (isHero) {
            g.scale(k, k);
            TD.sprites.hero(g, 0, 0, { t: 0.6, weapon: 'bow', aimAngle: -0.1, shotAge: 9, mood: 'focus', critAge: 9, hero: id === 'hero' ? 'dang' : id.slice(4).toLowerCase() });
          } else TD.sprites.monster(g, id, 0, 0, size, 0.6, { seed: 1, scale: k });
        });
        ctx.drawImage(c2.canvas, cx - c2.ox, cy - c2.oy);
        ctx.fillStyle = 'rgba(255,240,210,0.7)';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(id, cx, cy + 40);
      });
    },
    [ids, pal]
  );
  await page.waitForTimeout(200);
  await page.screenshot({ path: out });
  await browser.close();
  if (errors.length) console.log('错误：', errors);
})();
