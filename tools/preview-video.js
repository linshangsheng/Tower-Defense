// CrazyGames 的预览视频（鼠标移到封面上时播放）：横版 1920×1080、竖版 800×1200（2:3），MP4，无声，约 14 秒（后台上限 20 秒）
// 画面：前 6 秒第 45 关熔岩裂隙里技能全开打怪，后 8 秒第 200 关焚天巨龙依次喷火、雷击、寒冰（冻住 / 电麻主角）；界面全部隐藏，不带文字。
// 用法：node tools/preview-video.js   输出到 crazygames/videos/
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

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'crazygames', 'videos');
const FPS = 24;
const HIDE = '.hud-top,.hud-bottom,.boss-bar,.hud-boss,.toast,.lane-hint{display:none!important}';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-video-'));
  const browser = await chromium.launch();
  const page = await openGame(browser, { width: 1920, height: 1080 });
  let n = 0;
  const frame = async (stepper) => {
    await page.evaluate(stepper, FPS);
    await page.screenshot({ path: path.join(dir, `f${String(n++).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 92 });
  };
  const advance = (fps) => {
    const b = TD.game.battle;
    for (let i = 0; i < 4; i++) {
      b.step(1 / (fps * 4));
      b.wall.hp = b.wall.max;
    }
    const r = TD.game.renderer;
    r.update && r.update(1 / fps);
    r.render(1 / fps);
  };
  // 第一段：第 45 关，技能全开（自动释放）
  await crowdShot(page, 45, 14);
  await page.addStyleTag({ content: HIDE });
  for (let i = 0; i < 6 * FPS; i++) await frame(advance);
  // 第二段：第 200 关，巨龙依次喷火、雷击、寒冰
  await enterBattle(page, 200, 0, 'b.autoCast = false;');
  await dragonScene(page, 'fire');
  await page.evaluate(() => {
    TD.game.renderer.drawBossBar = () => {};
    const b = TD.game.battle;
    const m = b.monsters.find((x) => x.type === 'abyssDragon');
    m.ai.anim = null;
    m.ai.animTimer = 0;
    window.__cast = (skill) => {
      m.ai.skill = skill;
      b.castDragonSkill(m);
    };
  });
  const script = { 0: 'fire', 80: 'bolt', 140: 'ice' };
  for (let i = 0; i < 8 * FPS; i++) {
    if (script[i]) await page.evaluate((k) => window.__cast(k), script[i]);
    await frame(advance);
  }
  await browser.close();
  const input = ['-framerate', String(FPS), '-i', path.join(dir, 'f%04d.jpg')];
  const enc = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', '-preset', 'slow', '-movflags', '+faststart', '-an'];
  const land = path.join(OUT, 'preview-landscape-1920x1080.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...input, '-vf', 'scale=1920:1080', ...enc, land]);
  // 竖版：把横版画面缩成 800 宽放在中间，上下用同一画面放大、模糊、压暗做背景
  const port = path.join(OUT, 'preview-portrait-800x1200.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...input, '-filter_complex', '[0:v]split[a][b];[a]scale=800:1200:force_original_aspect_ratio=increase,crop=800:1200,boxblur=28:6,eq=brightness=-0.18[bg];[b]scale=800:450[fg];[bg][fg]overlay=0:375', ...enc, port]);
  for (const f of [land, port]) console.log(path.basename(f), (fs.statSync(f).size / 1048576).toFixed(1), 'MB');
  console.log(`${n} 帧，${(n / FPS).toFixed(1)} 秒`);
})();
