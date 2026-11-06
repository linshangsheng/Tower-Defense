// 手机 / 触屏体验审计：用 Playwright 的真机预设（iPhone 13 / iPhone SE / Pixel 5 / iPad Mini，竖屏 + 横屏）
// 把主要界面逐个打开、截图，并量出每个可点击元素"在屏幕上的真实尺寸"（getBoundingClientRect 已含舞台缩放和 90° 旋转）。
// 检查项：①可点元素 ≥44×44 CSS 像素 ②文字实际字号 ≥11px ③元素是否超出屏幕 ④战斗里雇佣兵栏与技能栏 / 顶栏是否互相遮挡
//        ⑤旋转下真手指点击：光球拾取、集火、修补、集结令是否生效
// 用法：node tools/mobile-audit.js [--out 截图目录] [--json 结果.json] [--quick] [--list]
//   --baseline 屏蔽适配文件，量修复前；--quick 只测 iPhone 13 + iPhone SE 的竖屏；--list 把每个不达标元素都列出来
const path = require('path');
const fs = require('fs');
let pw;
try {
  pw = require('playwright');
} catch (e) {
  pw = require(path.join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright'));
}
const { chromium, devices } = pw;

const args = process.argv.slice(2);
const opt = (k) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : null;
};
const OUT = opt('--out');
const JSON_OUT = opt('--json');
const QUICK = args.includes('--quick');
const LIST = args.includes('--list');
const BASELINE = args.includes('--baseline'); // 屏蔽 css/mobileui.css 和 src/ui/mobileui.js，量"修复前"
if (OUT) fs.mkdirSync(OUT, { recursive: true });

const DEVICES = ['iPhone 13', 'iPhone SE', 'Pixel 5', 'iPad Mini'];
const TABS = ['loadout', 'attrs', 'skills', 'equip', 'wall', 'items', 'barracks', 'exchange'];

// 在页面里量一个界面：返回 { clickables, fonts, overflow }
function measureInPage([minTarget, minFont]) {
  const scale = TD.game.scale;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const ui = document.getElementById('ui');
  const vis = (el) => {
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05;
  };
  const desc = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const cls = [...el.classList].filter((c) => !/^(on|hidden|ready|disabled)$/.test(c)).slice(0, 2);
    if (cls.length) s += '.' + cls.join('.');
    return s;
  };
  const label = (el) => (el.getAttribute('aria-label') || el.title || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 18);
  // 祖先里有裁剪（overflow 非 visible）的，元素要和裁剪框求交集
  const clipRect = (el, r) => {
    let x1 = r.left,
      y1 = r.top,
      x2 = r.right,
      y2 = r.bottom;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const pr = p.getBoundingClientRect();
        x1 = Math.max(x1, pr.left);
        y1 = Math.max(y1, pr.top);
        x2 = Math.min(x2, pr.right);
        y2 = Math.min(y2, pr.bottom);
      }
    }
    return { x1, y1, x2, y2 };
  };
  const zoomOf = (el) => {
    let z = 1;
    for (let p = el; p && p !== document.documentElement; p = p.parentElement) z *= parseFloat(getComputedStyle(p).zoom) || 1;
    return z;
  };
  const clickables = [];
  const tagClick = (el) => /^(BUTTON|A|SELECT|TEXTAREA|SUMMARY)$/.test(el.tagName) || (el.tagName === 'INPUT' && el.type !== 'hidden') || el.getAttribute('role') === 'button';
  for (const el of ui.querySelectorAll('*')) {
    if (!vis(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.pointerEvents === 'none') continue;
    const byTag = tagClick(el);
    const byCursor = !byTag && cs.cursor === 'pointer' && !(el.parentElement && getComputedStyle(el.parentElement).cursor === 'pointer');
    if (!byTag && !byCursor) continue;
    if (el.closest('.hidden')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const c = clipRect(el, r);
    const vw2 = Math.min(c.x2, vw) - Math.max(c.x1, 0);
    const vh2 = Math.min(c.y2, vh) - Math.max(c.y1, 0);
    if (vw2 <= 2 || vh2 <= 2) continue; // 滚出去了 / 在屏幕外
    // 被别的元素盖住的（弹窗后面的按钮）不算
    const cx = (Math.max(c.x1, 0) + Math.min(c.x2, vw)) / 2;
    const cy = (Math.max(c.y1, 0) + Math.min(c.y2, vh)) / 2;
    const top = document.elementFromPoint(cx, cy);
    if (!top || !(el === top || el.contains(top) || top.contains(el))) continue;
    clickables.push({ d: desc(el), t: label(el), w: +r.width.toFixed(1), h: +r.height.toFixed(1), ok: r.width >= minTarget - 0.5 && r.height >= minTarget - 0.5 });
  }
  // 字号：有直接文字的元素，实际字号 = 计算字号 × 舞台缩放 × 沿途 zoom
  const fonts = [];
  const fseen = new Set();
  for (const el of ui.querySelectorAll('*')) {
    if (!vis(el) || el.closest('.hidden')) continue;
    let has = false;
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) has = true;
    if (!has) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const c = clipRect(el, r);
    if (Math.min(c.x2, vw) - Math.max(c.x1, 0) <= 2 || Math.min(c.y2, vh) - Math.max(c.y1, 0) <= 2) continue;
    const px = parseFloat(getComputedStyle(el).fontSize) * scale * zoomOf(el);
    if (px >= minFont - 0.05 || px < 0.5) continue; // 字号 0 的是刻意隐藏文字的小红点
    const key = desc(el) + '|' + px.toFixed(1);
    if (fseen.has(key)) continue;
    fseen.add(key);
    fonts.push({ d: desc(el), t: (el.textContent || '').trim().slice(0, 14), px: +px.toFixed(1) });
  }
  // 超出屏幕：没被祖先裁剪、却伸出视口的可见元素（只看弹窗和 HUD 的子元素）
  const overflow = [];
  const oseen = new Set();
  for (const el of ui.querySelectorAll('*')) {
    if (!vis(el) || el.closest('.hidden')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const c = clipRect(el, r);
    // 被祖先裁掉的部分不算；用裁剪后的框和原框比较，只有"裁剪后仍然伸出视口"才算
    const out = Math.max(0 - c.x1, c.x2 - vw, 0 - c.y1, c.y2 - vh);
    if (out > 2 && c.x2 > c.x1 && c.y2 > c.y1) {
      const key = desc(el);
      if (oseen.has(key)) continue;
      oseen.add(key);
      overflow.push({ d: key, out: Math.round(out) });
    }
  }
  return { scale, rotated: TD.game.rotated, compact: ui.classList.contains('compact'), vw, vh, clickables, fonts, overflow };
}

(async () => {
  const browser = await chromium.launch();
  const results = [];
  const clickChecks = [];
  const devs = QUICK ? ['iPhone 13', 'iPhone SE'] : DEVICES;
  for (const name of devs) {
    for (const orient of QUICK ? ['portrait'] : ['portrait', 'landscape']) {
      const d = devices[name];
      let { width, height } = d.viewport;
      if (orient === 'landscape') [width, height] = [Math.max(width, height), Math.min(width, height)];
      else [width, height] = [Math.min(width, height), Math.max(width, height)];
      const ctx = await browser.newContext({ ...d, deviceScaleFactor: 1, viewport: { width, height }, screen: { width, height } });
      const page = await ctx.newPage();
      const errors = [];
      if (BASELINE) await page.route(/mobileui\.(css|js)$/, (r) => r.abort());
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      await page.addInitScript(() => localStorage.setItem('shouchengyingxiong.lang', 'en'));
      await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
      await page.waitForTimeout(1500);
      await page.evaluate(() => {
        TD.quality.setMode('low');
        const s = TD.game.save;
        const D = TD.data;
        s.settings.diffChosen = true;
        s.settings.fullscreen = false;
        s.stats.shopGuided = true;
        TD.progression.enableTestMode(s, TD.progression.TEST_PASSWORD);
        for (const k of D.storyOrder) s.story[k] = 'read';
        for (const t of Object.keys(D.monsters)) s.seenMonsters[t] = true;
        for (let k = 1; k <= 120; k++) s.levels[k] = { stars: 3, clears: 1, crown: k % 3 === 0, mission: true };
        s.copper = 5e6;
        s.diamonds = 999;
      });
      const tag = `${name.replace(/\s+/g, '')}-${orient}`;
      const shot = async (id) => {
        if (!OUT) return;
        try {
          await page.screenshot({ path: path.join(OUT, `${tag}-${id}.png`), timeout: 8000 });
        } catch (e) {
          console.log(`  截图失败 ${tag}-${id}: ${e.message.split('\n')[0]}`);
        }
      };
      const record = async (id) => {
        await page.waitForTimeout(350);
        const m = await page.evaluate(measureInPage, [44, 11]);
        results.push({ device: name, orient, screen: id, ...m });
        if (process.env.VERBOSE) console.log('  ' + tag + ' ' + id);
        await shot(id);
      };

      await page.evaluate(() => TD.ui.showTitle());
      await record('title');
      await page.evaluate(() => (TD.ui.closeModal(), TD.ui.showMap(3)));
      await record('map');
      for (const t of TABS) {
        await page.evaluate((t) => (TD.ui.closeModal(), TD.ui.showShop(45, t)), t);
        await record('shop-' + t);
      }
      await page.evaluate(() => (TD.ui.closeModal(), TD.ui.showSettings(() => {})));
      await record('settings');

      // 战斗 HUD（带雇佣兵、技能、道具）
      await page.evaluate(() => {
        TD.ui.closeModal();
        const s = TD.game.save;
        TD.progression.setMercLoadout(s, ['swordsman', 'guard', 'archer']);
        TD.game.startBattle(45);
        const b = TD.game.battle;
        window.__b = b;
        b.wall.max = b.wall.hp = 1e12;
        for (let i = 0; i < 60 * 25 && !b.over; i++) {
          if (b.pendingSupply) TD.game.pickSupply(b.pendingSupply[0]);
          b.step(1 / 60);
        }
        b.wall.max = b.wall.hp = 12000; // 截图用接近真实的城墙血量
        b.funds = 999;
        for (let l = 0; l < b.lanes; l++) b.deployMerc(l % b.mercSlots.length, l);
        TD.game.paused = true;
        TD.ui.updateHud();
      });
      await record('battle');
      // 雇佣兵栏 / 技能栏 / 顶栏是否互相遮挡
      const overlaps = await page.evaluate(() => {
        const sel = { merc: '.merc-bar', skill: '.skill-bar', item: '.item-bar', ctrl: '.ctrl-bar', top: '.hud-top', ult: '.ult-bar' };
        const rs = {};
        for (const [k, q] of Object.entries(sel)) {
          const el = document.querySelector('.battle-hud ' + q) || document.querySelector(q);
          if (el && getComputedStyle(el).display !== 'none') {
            // 只取直接子元素的并集，避免 flex 容器本身比内容宽
            const kids = [...el.children].filter((c) => getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().width > 0);
            const list = kids.length ? kids : [el];
            rs[k] = list.map((c) => c.getBoundingClientRect());
          }
        }
        const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
        const out = [];
        const keys = Object.keys(rs);
        for (let i = 0; i < keys.length; i++)
          for (let j = i + 1; j < keys.length; j++) {
            let n = 0;
            for (const a of rs[keys[i]]) for (const b of rs[keys[j]]) if (hit(a, b)) n++;
            if (n) out.push(keys[i] + '×' + keys[j]);
          }
        return out;
      });
      results[results.length - 1].overlaps = overlaps;

      // 真手指点击：舞台坐标 → 屏幕坐标（随旋转），再 tap；看战斗状态有没有响应
      const toScreen = (x, y) =>
        page.evaluate(
          ([x, y]) => {
            const rect = TD.game.renderer.canvas.getBoundingClientRect();
            const s = TD.game.scale;
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            return TD.game.rotated ? { x: cx - (y - 360) * s, y: cy + (x - 640) * s } : { x: cx + (x - 640) * s, y: cy + (y - 360) * s };
          },
          [x, y]
        );
      const tapStage = async (x, y) => {
        const p = await toScreen(x, y);
        await page.touchscreen.tap(p.x, p.y);
        await page.waitForTimeout(120);
      };
      const chk = (id, ok) => clickChecks.push({ device: name, orient, check: id, ok: !!ok });
      await page.evaluate(() => {
        TD.game.paused = false;
        TD.game.speed = 1;
      });
      // 光球
      let before = await page.evaluate(() => window.__b.dropsTaken || 0);
      await page.evaluate(() => {
        const b = window.__b;
        b.drops = b.drops || [];
        b.drops.push({ kind: 'purse', x: 520, y: b.laneY(1), copper: 5, amount: 50, until: b.time + 60, born: b.time });
      });
      await tapStage(520, await page.evaluate(() => window.__b.laneY(1)));
      chk('光球拾取', (await page.evaluate(() => window.__b.dropsTaken || 0)) === before + 1);
      // 集火：造一只不动的怪
      await page.evaluate(() => {
        const b = window.__b;
        b.monsters.length = 0;
        const m = b.spawnMonster('goblin', 1);
        m.x = 700;
        m.speedMult = 0;
        m.hp = m.maxHp = 1e12;
        window.__m = m;
      });
      const my = await page.evaluate(() => window.__m.y + window.__m.yOffset);
      await tapStage(700, my);
      chk('点怪集火', await page.evaluate(() => window.__b.focus === window.__m));
      // 修补城墙
      await page.evaluate(() => {
        const b = window.__b;
        b.wall.hp = b.wall.max * 0.5;
        b.repairReadyAt = 0;
      });
      const rc0 = await page.evaluate(() => window.__b.repairCount || 0);
      const wallX = await page.evaluate(() => TD.config.wallX);
      await tapStage(wallX, 360);
      chk('点城墙修补', (await page.evaluate(() => window.__b.repairCount || 0)) === rc0 + 1);
      // 集结令：点集结按钮（真点按钮），再点第 0 车道
      await page.evaluate(() => {
        const b = window.__b;
        b.rallyAt = 0;
        b.funds = 999;
        b.waveState !== 'prepare' || (b.waveState = 'waiting');
        for (const u of b.mercs) u.lane = Math.max(1, b.lanes - 1);
      });
      const rb = await page.$('.rally-btn');
      if (rb) {
        const box = await rb.boundingBox();
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(150);
        const ly = await page.evaluate(() => window.__b.laneY(0));
        await tapStage(640, ly);
        chk('集结令点车道', await page.evaluate(() => window.__b.mercs.filter((u) => !u.dead).length > 0 && window.__b.mercs.filter((u) => !u.dead).every((u) => u.lane === 0)));
      } else chk('集结令点车道', false);

      // 结算
      await page.evaluate(() => {
        window.__b.monsters.length = 0;
        window.__b.finish(true);
      });
      await page.waitForTimeout(2200);
      await record('result');
      results[results.length - 1].errors = errors.slice();
      if (errors.length) console.log(`  页面报错 ${tag}: ${errors.slice(0, 3).join(' | ')}`);
      await ctx.close();
    }
  }
  await browser.close();

  // ---------- 汇总 ----------
  const rows = [];
  let tot = { click: 0, bad: 0, font: 0, over: 0, ovl: 0 };
  for (const r of results) {
    const bad = r.clickables.filter((c) => !c.ok);
    const row = { dev: `${r.device} ${r.orient}`, scr: r.screen, sc: r.scale.toFixed(2), cpt: r.compact ? 'Y' : '-', click: r.clickables.length, bad: bad.length, font: r.fonts.length, over: r.overflow.length, ovl: (r.overlaps || []).join(',') };
    rows.push(row);
    tot.click += row.click;
    tot.bad += row.bad;
    tot.font += row.font;
    tot.over += row.over;
    tot.ovl += (r.overlaps || []).length;
    if (LIST) {
      for (const c of bad) console.log(`  [小热区] ${row.dev} ${r.screen} ${c.d} "${c.t}" ${c.w}×${c.h}`);
      for (const f of r.fonts) console.log(`  [小字] ${row.dev} ${r.screen} ${f.d} "${f.t}" ${f.px}px`);
      for (const o of r.overflow) console.log(`  [溢出] ${row.dev} ${r.screen} ${o.d} 超出 ${o.out}px`);
    }
  }
  console.table(rows);
  console.log('点击检查：');
  for (const c of clickChecks) console.log(`  ${c.ok ? '✓' : '✗'} ${c.device} ${c.orient} ${c.check}`);
  const clickFail = clickChecks.filter((c) => !c.ok).length;
  const summary = { totalClickables: tot.click, smallTargets: tot.bad, smallFonts: tot.font, overflows: tot.over, overlaps: tot.ovl, clickChecks: clickChecks.length, clickFail };
  console.log('合计：', JSON.stringify(summary));
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ summary, rows, clickChecks, results }, null, 1));
})();
