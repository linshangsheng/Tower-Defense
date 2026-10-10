// 成就（设计书 24.1）。check(save, ctx)：ctx 是刚结束的战斗（可能为空，表示购买后检查）
(function (TD) {
  'use strict';

  TD.data = TD.data || {};

  const cleared = (save, n) => (save.levels[n] || {}).clears > 0;
  const totalStars = (save) => Object.values(save.levels).reduce((a, r) => a + (r.stars || 0), 0);
  const bossTypes = () => Object.keys(TD.data.monsters).filter((k) => TD.data.monsters[k].boss);
  const introTypes = () => Object.keys(TD.data.monsters).filter((k) => !TD.data.noIntro[k]);

  TD.data.achievements = [
    { id: 'first', name: '初出茅庐', desc: '通关第 1 关', reward: { silver: 1 }, check: (s) => cleared(s, 1) },
    { id: 'ch1', name: '草原守护者', desc: '通关第一章', reward: { silver: 3 }, check: (s) => cleared(s, 10) },
    { id: 'ch2', name: '沙漠守护者', desc: '通关第二章', reward: { silver: 3 }, check: (s) => cleared(s, 20) },
    { id: 'ch3', name: '沼泽守护者', desc: '通关第三章', reward: { silver: 3 }, check: (s) => cleared(s, 30) },
    { id: 'ch4', name: '雪原守护者', desc: '通关第四章', reward: { silver: 3 }, check: (s) => cleared(s, 40) },
    { id: 'hero', name: '守城英雄', desc: '击败墨墨', reward: { gold: 1 }, check: (s) => cleared(s, 50) },
    { id: 'perfect', name: '毫发无损', desc: '第 3 关以后，城墙满血通关任意一关', reward: { silver: 2 }, check: (s, c) => !!(c && c.win && c.level >= 3 && c.wallRatio >= 0.9999) },
    { id: 'close', name: '惊险过关', desc: '城墙剩余不到 5% 时通关', reward: { silver: 2 }, check: (s, c) => !!(c && c.win && c.wallRatio < 0.05) },
    { id: 'noskill', name: '不靠技能', desc: '不带任何主动技能，通关第 10 关以后的任意一关', reward: { silver: 3 }, check: (s, c) => !!(c && c.win && c.level > 10 && c.skillsCarried === 0) },
    { id: 'interrupt', name: '打断大师', desc: '累计打断 Boss 蓄力 10 次', reward: { silver: 3 }, check: (s) => (s.stats.interrupts || 0) >= 10 },
    { id: 'early', name: '急性子', desc: '累计提前召唤 30 次', reward: { silver: 2 }, check: (s) => (s.stats.earlyCalls || 0) >= 30 },
    { id: 'supply', name: '补给专家', desc: '累计选择 50 张补给卡', reward: { silver: 2 }, check: (s) => (s.stats.supplies || 0) >= 50 },
    { id: 'stars50', name: '星光闪闪', desc: '累计获得 50 颗星', reward: { silver: 3 }, check: (s) => totalStars(s) >= 50 },
    { id: 'stars150', name: '繁星满天', desc: '获得全部 150 颗星', reward: { gold: 1 }, check: (s) => totalStars(s) >= 150 },
    { id: 'weapons', name: '武器收藏家', desc: '拥有全部 6 把武器', reward: { silver: 3 }, check: (s) => Object.keys(TD.data.weapons).every((w) => s.weapons[w] && s.weapons[w].owned) },
    {
      id: 'skills',
      name: '技能全开',
      desc: '解锁全部主动技能和被动技能',
      reward: { silver: 3 },
      check: (s) => Object.keys(TD.data.activeSkills).every((k) => s.activeOwned[k]) && Object.keys(TD.data.passiveSkills).every((k) => s.passiveOwned[k]),
    },
    { id: 'lv3', name: '登峰造极', desc: '任意主动技能升到 Lv3', reward: { silver: 2 }, check: (s) => Object.values(s.skillLv || {}).some((v) => v >= 3) },
    { id: 'ascend', name: '神兵出世', desc: '任意武器进阶', reward: { silver: 2 }, check: (s) => Object.values(s.weapons).some((w) => w.asc) },
    { id: 'dex30', name: '图鉴学者', desc: '遇见 30 种怪物', reward: { silver: 3 }, check: (s) => Object.keys(s.seenMonsters || {}).length >= 30 },
    { id: 'dexAll', name: '图鉴大师', desc: '遇见全部怪物', reward: { gold: 1 }, check: (s) => introTypes().every((k) => (s.seenMonsters || {})[k]) },
    { id: 'kill1k', name: '百怪斩', desc: '累计击败 1000 只怪物', reward: { silver: 2 }, check: (s) => s.stats.kills >= 1000 },
    { id: 'kill10k', name: '万怪敌', desc: '累计击败 10000 只怪物', reward: { gold: 1 }, check: (s) => s.stats.kills >= 10000 },
    { id: 'bosses', name: 'Boss 克星', desc: '击败全部 10 个 Boss（含小 Boss）', reward: { gold: 1 }, check: (s) => bossTypes().every((k) => (s.stats.killsByType || {})[k] > 0) },
    { id: 'rich', name: '小金库', desc: '同时持有 5000 铜币', reward: { silver: 2 }, check: (s) => s.copper >= 5000 },
    { id: 'endless30', name: '永不陷落', desc: '无尽模式到达第 30 波', reward: { gold: 1 }, check: (s) => ((s.endless || {}).best || 0) >= 30 },
  ];
})((globalThis.TD = globalThis.TD || {}));
