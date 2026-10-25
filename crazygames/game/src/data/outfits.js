// 角色衣柜（设计书第 72 章）：Kael 可以换成 9 位不同的人物，每位有自己的造型、介绍、额外属性，用金币购买
// style：造型（身形 / 头饰 / 服装 / 背饰，画法见 creatures.js 的 outfitHead / outfitBack / outfitFront）
// colors：cape 披风、body 衣服、helmTop / helmBottom 盔甲（或帽子）渐变、brim 帽檐、plume 点缀色、plumeHi 点缀高光、shield / shieldHi 金属色
// stats：并入属性（atkPct、aspdPct、crit、critDmg、luck、rangePct、wallDr）；mods：并入战场修正（见 battle.mods）
// 额外属性只在 Kael 出战时生效（设计书 72.3）
(function (TD) {
  'use strict';

  const BASE = { cape: '#e04848', body: '#5b7bd5', helmTop: '#eef2f7', helmBottom: '#a9b4c2', brim: '#8c97a6', plume: '#ff5a4f', plumeHi: '#ffb3ad', shield: '#c9a24a', shieldHi: '#ffe08a' };
  const O = (id, name, desc, cost, style, colors, bonus, bonusText) =>
    Object.assign({ id, name, desc, cost, style, colors: Object.assign({}, BASE, colors), bonusText: bonusText || '', stats: {}, mods: {} }, bonus || {});

  TD.data.outfits = [
    O('classic', '守城卫兵', '王国卫兵的标准装束。头盔有点大。', null, 'knight', {}, null, '没有额外属性'),
    O(
      'ranger',
      '林地游侠',
      '尖尖的兜帽上插着一根红羽毛，箭袋斜挎在身后。',
      { gold: 3 },
      'ranger',
      { cape: '#3f8a3a', body: '#6a4a2c', helmTop: '#5aa84a', helmBottom: '#2f6a2c', brim: '#244e22', plume: '#ff5a4f', plumeHi: '#ffb3ad', shield: '#8a6a3a', shieldHi: '#e0c070' },
      { stats: { rangePct: 0.06, crit: 0.03 } },
      '射程 +6%，暴击率 +3%'
    ),
    O(
      'pirate',
      '海盗船长',
      '三角帽上的骷髅会笑，只有一只眼睛看得见。',
      { gold: 4 },
      'pirate',
      { cape: '#a02830', body: '#2a2a3a', helmTop: '#3a3a4a', helmBottom: '#16161e', brim: '#d4aa44', plume: '#ff4a3a', plumeHi: '#ffb0a0', shield: '#d4aa44', shieldHi: '#fff0a0' },
      { stats: { luck: 0.04 }, mods: { copperBonus: 0.12 } },
      '铜币收益 +12%，幸运 +4%'
    ),
    O(
      'mage',
      '星辰法师',
      '长袍上的星星会自己闪，帽子比人还高一截。',
      { gold: 5 },
      'mage',
      { cape: '#3a4aa8', body: '#4a3a9a', helmTop: '#6a5ad8', helmBottom: '#2a2070', brim: '#ffd23f', plume: '#9ad0ff', plumeHi: '#e0f4ff', shield: '#ffd23f', shieldHi: '#fff4b0' },
      { mods: { magicMult: 0.12, cdMult: -0.05 } },
      '魔法伤害 +12%，技能冷却 −5%'
    ),
    O(
      'samurai',
      '战国武士',
      '朱红的铠甲，头盔上的新月在发光，背上插着一面小旗。',
      { gold: 6 },
      'samurai',
      { cape: '#7a1a20', body: '#8a2a2a', helmTop: '#c03a3a', helmBottom: '#5a1418', brim: '#e0b030', plume: '#e0b030', plumeHi: '#fff0a0', shield: '#e0b030', shieldHi: '#fff0a0' },
      { stats: { atkPct: 0.06, critDmg: 0.2 } },
      '攻击力 +6%，暴击伤害 +20%'
    ),
    O(
      'ninja',
      '暗影忍者',
      '全身黑色，只露出一条眼缝；走路没有声音。',
      { gold: 6 },
      'ninja',
      { cape: '#14121e', body: '#1e1a2c', helmTop: '#2a2638', helmBottom: '#0e0c16', brim: '#8a8a9a', plume: '#d03030', plumeHi: '#ff8a8a', shield: '#8a8a9a', shieldHi: '#e0e0f0' },
      { stats: { aspdPct: 0.08, rangePct: 0.03 } },
      '攻击速度 +8%，射程 +3%'
    ),
    O(
      'viking',
      '北境维京',
      '铁盔上两只弯角，橘色的胡子编成了辫子。',
      { gold: 7 },
      'viking',
      { cape: '#5a4a3a', body: '#4a5a6a', helmTop: '#a8b0b8', helmBottom: '#5a626a', brim: '#e8dcc0', plume: '#e08a30', plumeHi: '#ffc880', shield: '#8a6a3a', shieldHi: '#e0b070' },
      { stats: { wallDr: 0.04 }, mods: { bossDmg: 0.12 } },
      '对 Boss 伤害 +12%，城墙受到伤害 −4%'
    ),
    O(
      'paladin',
      '神殿圣骑士',
      '头盔两侧长着翅膀，头上有一圈暖暖的光。',
      { gold: 8 },
      'paladin',
      { cape: '#f4f0e0', body: '#e8e0c8', helmTop: '#fffbe8', helmBottom: '#d8c890', brim: '#e0b030', plume: '#fff0a0', plumeHi: '#ffffff', shield: '#e0b030', shieldHi: '#fff8c0' },
      { stats: { wallDr: 0.05 }, mods: { healBonus: 0.25 } },
      '城墙回复效果 +25%，城墙受到伤害 −5%'
    ),
    O(
      'engineer',
      '蒸汽工匠',
      '额头上的铜护目镜会发光，背包里的蒸汽噗噗地冒。',
      { gold: 9 },
      'engineer',
      { cape: '#c8742c', body: '#5a4a3a', helmTop: '#a8764a', helmBottom: '#5a3a22', brim: '#d4aa44', plume: '#ff8a2e', plumeHi: '#ffd0a0', shield: '#c88a44', shieldHi: '#ffe0a0' },
      { mods: { cdMult: -0.08, armorIgnore: 0.1 } },
      '主动技能冷却 −8%，无视护甲 +10%'
    ),
    O(
      'dragon',
      '龙骑士',
      '深红的角盔，背后一对小小的龙翼，据说会喷火星。',
      { gold: 15 },
      'dragon',
      { cape: '#6a1018', body: '#3a1a22', helmTop: '#b83030', helmBottom: '#4a0e14', brim: '#ff8a2e', plume: '#ff8a2e', plumeHi: '#ffd070', shield: '#c8782c', shieldHi: '#ffd890' },
      { stats: { atkPct: 0.08 }, mods: { igniteChance: 0.15 } },
      '攻击力 +8%，普通攻击 15% 几率点燃目标'
    ),
  ];

  TD.data.outfitById = (id) => TD.data.outfits.find((o) => o.id === id) || TD.data.outfits[0];
})((globalThis.TD = globalThis.TD || {}));
