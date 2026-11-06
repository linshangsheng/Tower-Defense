// 在 Node 中按浏览器相同的顺序加载游戏逻辑脚本（不含画面和界面）
const path = require('path');

const FILES = [
  'src/core/ns.js',
  'src/data/config.js',
  'src/data/monsters.js',
  'src/data/mercs.js',
  'src/data/mercTalents.js',
  'src/data/gear.js',
  'src/data/equipment.js',
  'src/data/levels.js',
  'src/data/story.js',
  'src/data/mercstory.js',
  'src/data/outfits.js',
  'src/data/missions.js',
  'src/data/town.js',
  'src/data/achievements.js',
  'src/game/progression.js',
  'src/game/titleinfo.js',
  'src/game/battle.js',
  'src/game/bosses.js',
  'src/game/traits.js',
  'src/game/mercs.js',
  'src/game/bot.js',
  'src/game/save.js',
  'src/game/modes.js',
  'src/game/codex.js',
  'src/ui/toastq.js',
  'src/ui/shopui-core.js',
  'src/ui/result-helpers.js',
];

for (const f of FILES) require(path.join(__dirname, '..', f));

module.exports = globalThis.TD;
