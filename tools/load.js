// 在 Node 中按浏览器相同的顺序加载游戏逻辑脚本（不含画面和界面）
const path = require('path');

const FILES = [
  'src/core/ns.js',
  'src/data/config.js',
  'src/data/monsters.js',
  'src/data/gear.js',
  'src/data/levels.js',
  'src/data/achievements.js',
  'src/game/progression.js',
  'src/game/battle.js',
  'src/game/bot.js',
  'src/game/save.js',
  'src/game/modes.js',
];

for (const f of FILES) require(path.join(__dirname, '..', f));

module.exports = globalThis.TD;
