// v1.96：雇佣兵（出兵）玩法已移除（设计书 196）。总开关是 TD.config.merc.enabled（默认关）。
// 关闭时，把雇佣兵在游戏里留下的痕迹一起清掉：成就、成就分组、关卡任务说明、每日规则、援军光球、
// 团长剧情、怪物 / 技能说明里提到兵的句子、第 6 关的新功能提示。代码本身保留，打开开关即可恢复。
(function (TD) {
  'use strict';

  const C = TD.config;
  const D = TD.data;
  if (!C.merc || C.merc.enabled) return;

  // 成就：去掉三个雇佣兵成就，以及成就页的"雇佣兵类"分组
  const MERC_ACH = ['merc30', 'mercKill200', 'mercLv5'];
  if (Array.isArray(D.achievements)) {
    for (let i = D.achievements.length - 1; i >= 0; i--) if (MERC_ACH.includes(D.achievements[i].id)) D.achievements.splice(i, 1);
  }
  if (TD.codex && Array.isArray(TD.codex.GROUPS)) {
    for (let i = TD.codex.GROUPS.length - 1; i >= 0; i--) if (TD.codex.GROUPS[i].key === 'merc') TD.codex.GROUPS.splice(i, 1);
  }

  // 每日挑战：去掉「佣兵集市」
  if (TD.modes && TD.modes.dailyRules) delete TD.modes.dailyRules.mercfair;

  // 战利品光球：不再掉「援军」
  if (D.drops && D.drops.reinforce) D.drops.reinforce.w = 0;

  // 剧情：团长 Brann 的几段不再进守城日记 / 剧情顺序
  if (Array.isArray(D.storyOrder) && Array.isArray(D.mercStoryKeys)) {
    for (let i = D.storyOrder.length - 1; i >= 0; i--) if (D.mercStoryKeys.includes(D.storyOrder[i])) D.storyOrder.splice(i, 1);
  }

  // 技能 / 终极技能卡片上的"和兵联动"说明
  for (const k of Object.keys(D.activeSkills || {})) delete D.activeSkills[k].link;
  if (D.ultimate) delete D.ultimate.link;

  // 怪物说明：恢复成没有雇佣兵之前的原文（这些怪针对兵的技能只在有兵时才生效）
  const DESC = {
    assassin: '远处时隐身无法被攻击，还会偷偷换道，靠近城墙才现身。',
    bat: '飞行，并且每隔一会儿就换到相邻车道。',
    wolf: '三只一群，从同一条车道高速冲来。',
    ironWolf: '四只一组冲过来的铁甲狼。',
    ironChariot: '披着铁板的战车，冲得很快；撞墙的震动会让英雄晃一下（0.8 秒）。',
    lavaGolem: '石头拼成的小巨人，魔法伤害减免 75%。用物理武器打它！',
    moltenGolem: '熔化的铁做的傀儡：魔法几乎打不动，用物理武器。',
    steelYeti: '浑身钢板的雪怪：物理几乎打不动，魔法才有效；走到半场会咆哮，让周围的怪加速。',
    stump: '又厚又硬，2 秒没挨打就会慢慢回血。集中火力一口气打掉。',
    yeti: '皮糙肉厚的大个子。走到半场时会仰天咆哮，周围的怪物 4 秒内跑得更快。',
  };
  for (const [k, v] of Object.entries(DESC)) if (D.monsters[k]) D.monsters[k].desc = v;

  // 第 6 关（以及深渊里对应的第 106 关）的提示：不再介绍雇佣兵
  const TIP6 = '嗡嗡蜂会飞，越过其他怪直扑城墙。连发弩对飞行怪伤害更高。';
  for (const n of [6, 106]) if (D.levels[n] && /雇佣兵/.test(D.levels[n].tip || '')) D.levels[n].tip = TIP6;
})((globalThis.TD = globalThis.TD || {}));
