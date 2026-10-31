// 武器、技能、装备、消耗品、属性与城墙升级（设计书 18.1–18.3、18.6–18.8）
(function (TD) {
  'use strict';

  TD.data = TD.data || {};

  TD.data.weapons = {
    bow: {
      name: '木弓',
      rarity: 1,
      cost: null,
      dmgMult: 1.9,
      aspdMult: 1.0,
      projSpeed: 900,
      bonusCrit: 0.05,
      desc: '单发，稳定，自带额外暴击率。打 Boss 好用。',
      good: '通用、Boss',
      ascend: { name: '雕花长弓', desc: '射程 +10%，暴击伤害 +30%', stats: { rangePct: 0.1, critDmg: 0.3 } },
      mastery: { name: '穿云箭', desc: '箭命中后继续向后飞，再命中同一车道后方最多 2 只怪（40% 伤害）', weapon: () => ({ pierce: { count: 2, range: 160, mult: 0.4 } }) },
    },
    crossbow: {
      name: '连发弩',
      rarity: 1,
      cost: { copper: 300 },
      dmgMult: 0.95,
      aspdMult: 1.0,
      projSpeed: 950,
      bolts: 3,
      extraBoltMult: 0.4,
      flyingMult: 1.5,
      desc: '一次射 3 支弩箭，分别射向 3 个不同目标，对飞行怪伤害 +50%。目标少时威力下降。',
      good: '群怪、飞行怪',
      ascend: { name: '连环弩', desc: '每次射 4 支弩箭', weapon: { bolts: 4 } },
    },
    boomerang: {
      name: '回旋镖',
      rarity: 1,
      cost: { copper: 450 },
      dmgMult: 0.85,
      aspdMult: 0.6,
      projSpeed: 750,
      boomerang: true,
      desc: '沿车道飞出再飞回，往返各命中每只怪一次。返程从背后命中，无视盾牌。',
      good: '排成长队的车道、木盾哥布林',
      ascend: { name: '双刃回旋镖', desc: '同时扔出 2 支：目标车道和相邻车道各一支', weapon: { twin: true } },
    },
    staff: {
      name: '魔法杖',
      rarity: 2,
      cost: { silver: 8 },
      dmgMult: 2.9,
      aspdMult: 0.85,
      projSpeed: 700,
      dmgType: 'magic',
      splash: { radius: 60, mult: 0.6 },
      desc: '发射魔法弹，命中后小范围爆炸。魔法伤害无视物理护甲。',
      good: '绷带球、护盾、成堆的小怪',
      ascend: { name: '星辰法杖', desc: '爆炸半径 60 → 85，溅射伤害 60% → 75%', weapon: { splash: { radius: 85, mult: 0.75 } } },
      mastery: { name: '星爆', desc: '溅射半径 +20，溅射伤害不再衰减（100%）', weapon: (w) => ({ splash: { radius: w.splash.radius + 20, mult: 1 } }) },
    },
    cannon: {
      name: '火炮',
      rarity: 2,
      cost: { silver: 10 },
      dmgMult: 8.2, // v1.07：按品质重新标定
      aspdMult: 0.4,
      projSpeed: 600,
      arc: true,
      splash: { radius: 90, mult: 0.7 },
      armorIgnore: 0.4,
      desc: '慢速重炮，落地大范围爆炸，无视目标 40% 护甲。',
      good: '重甲怪、成团的怪、Boss',
      ascend: { name: '攻城火炮', desc: '无视护甲 40% → 70%，溅射伤害 70% → 85%', weapon: { armorIgnore: 0.7, splash: { radius: 80, mult: 0.85 } } },
      mastery: { name: '震地炮', desc: '爆炸把范围内的小怪向后震退 60 像素并减速 40%（1.5 秒）；对 Boss 和触手伤害 +50%', weapon: () => ({ knock: { dist: 60, slow: 0.4, duration: 1.5 }, bossMult: 1.5 }) },
    },
    orb: {
      name: '雷电法球',
      rarity: 3,
      cost: { gold: 4 },
      dmgMult: 4.4,
      aspdMult: 0.9,
      projSpeed: 1500,
      dmgType: 'magic',
      chain: { count: 3, range: 200, falloff: 0.75 },
      desc: '闪电命中后在附近的怪之间跳跃 3 次，每跳伤害为上一跳的 75%。魔法伤害。',
      good: '密集怪群、小幽灵、魔法抗性低的怪',
      ascend: { name: '雷神之球', desc: '跳跃 3 → 5 次', weapon: { chain: { count: 5, range: 200, falloff: 0.75 } } },
    },
  };

  // ---- v0.55 武器扩充（设计书 63）：五色品质，越高越强越贵；look = 基础形状 + 品质色 + 专属细节 ----
  Object.assign(TD.data.weapons, {
    frostBow: {
      name: '寒霜弓', rarity: 2, cost: { silver: 12 }, minLevel: 10, dmgMult: 1.19, aspdMult: 1.0, projSpeed: 950, bolts: 3, extraBoltMult: 0.5, slow: { amt: 0.3, dur: 2 },
      tiers: [{ lv: 6, bolts: 5, dmgMult: 0.83 }],
      desc: '一次射 3 支冰箭，命中使目标减速 30%（2 秒）；升到 6 级一次射 5 支。', good: '快怪：兔子、狼、战车', look: { base: 'bow', color: '#8fd8ff', accent: 'frost' },
    },
    flameCrossbow: {
      name: '烈焰弩', rarity: 3, cost: { gold: 4 }, minLevel: 20, dmgMult: 1.93, aspdMult: 1.0, projSpeed: 950, bolts: 3, extraBoltMult: 0.5, flyingMult: 1.5, ignite: true,
      desc: '一次射 3 支火焰弩箭，每支点燃目标，对飞行怪伤害 +50%。', good: '群怪、飞行怪', look: { base: 'crossbow', color: '#ff9a4a', accent: 'flame' },
    },
    piercer: {
      name: '穿心长弓', rarity: 3, cost: { gold: 5 }, minLevel: 20, dmgMult: 1.47, aspdMult: 0.9, projSpeed: 1100, bolts: 3, extraBoltMult: 0.5, pierce: { count: 3, range: 520, mult: 0.75 }, armorIgnore: 0.2,
      tiers: [{ lv: 8, bolts: 4, dmgMult: 1.29 }],
      desc: '一次射 3 支穿心箭，每支穿过同一车道最多 3 只怪（每只 75% 伤害），无视 20% 护甲；升到 8 级一次射 4 支。', good: '排成长队的车道', look: { base: 'bow', color: '#d9a0ff', accent: 'lance' },
    },
    meteorCannon: {
      name: '陨星炮', rarity: 4, cost: { gold: 8 }, minLevel: 40, dmgMult: 14.17, aspdMult: 0.45, projSpeed: 620, arc: true, splash: { radius: 100, mult: 0.8 }, armorIgnore: 0.6, bossMult: 1.3,
      desc: '超重炮弹，爆炸半径 100，无视 60% 护甲，对 Boss 伤害 +30%。', good: '重甲怪、Boss', look: { base: 'cannon', color: '#ff6a3a', accent: 'meteor' },
    },
    stormOrb: {
      name: '风暴法球', rarity: 4, cost: { gold: 9 }, minLevel: 40, dmgMult: 5.4, aspdMult: 1.0, projSpeed: 1600, dmgType: 'magic', chain: { count: 5, range: 240, falloff: 0.85 },
      desc: '魔法闪电跳跃 5 次，每跳只衰减 15%。', good: '密集怪群、灵体', look: { base: 'orb', color: '#7ad0ff', accent: 'storm' },
    },
    voidCrossbow: {
      name: '裂空弩', rarity: 4, cost: { gold: 10 }, minLevel: 40, dmgMult: 1.9, aspdMult: 1.0, projSpeed: 1000, bolts: 5, extraBoltMult: 0.42, flyingMult: 1.6, armorIgnore: 0.2,
      desc: '一次射 5 支箭，对飞行怪伤害 +60%，无视 20% 护甲。', good: '群怪、飞行怪', look: { base: 'crossbow', color: '#b060ff', accent: 'void' },
    },
    genesisBow: {
      name: '创世之弓', rarity: 5, cost: { gold: 20 }, minLevel: 60, dmgMult: 2.98, aspdMult: 1.15, projSpeed: 1200, bonusCrit: 0.12, bolts: 3, extraBoltMult: 0.55, pierce: { count: 3, range: 420, mult: 0.7 }, ignite: true,
      tiers: [{ lv: 5, bolts: 4, dmgMult: 2.52 }, { lv: 10, bolts: 5, dmgMult: 2.21 }],
      desc: '一次射 3 支创世之箭，暴击率 +12%，每支穿透 3 只怪并点燃目标；升到 5 级一次射 4 支，升到 10 级一次射 5 支。', good: '通用、Boss', look: { base: 'bow', color: '#ffd860', accent: 'genesis' },
    },
    judgementStaff: {
      name: '天罚之杖', rarity: 5, cost: { gold: 18 }, minLevel: 60, dmgMult: 5.53, aspdMult: 0.95, projSpeed: 760, dmgType: 'magic', splash: { radius: 125, mult: 0.9 }, chain: { count: 3, range: 220, falloff: 0.75 },
      desc: '魔法，超大范围爆炸（半径 125、溅射 90%），再加 3 次闪电跳跃。', good: '成堆的怪、灵体、魔抗低的怪', look: { base: 'staff', color: '#fff0a0', accent: 'judgement' },
    },
    chronoBoomerang: {
      name: '时之回旋', rarity: 5, cost: { gold: 16 }, minLevel: 60, dmgMult: 3.75, aspdMult: 0.8, projSpeed: 800, boomerang: true, boomerangs: 3, slow: { amt: 0.4, dur: 2 },
      desc: '一次扔出三支回旋镖（本车道 + 两侧相邻车道），命中使目标减速 40%。', good: '长队、木盾哥布林', look: { base: 'boomerang', color: '#c8a8ff', accent: 'chrono' },
    },
  });

  // ---- v0.80 武器扩充（设计书 91）：每个品质 5 把（原来每个品质 3 把，再各加 2 把） ----
  Object.assign(TD.data.weapons, {
    huntBow: {
      name: '猎弓', rarity: 1, cost: { copper: 350 }, dmgMult: 1.5, aspdMult: 1.4, projSpeed: 1000, bonusCrit: 0.15,
      desc: '出手很快（攻速 ×1.4），暴击率 +15%，每秒输出比木弓高。', good: '通用、速攻关', look: { base: 'bow', color: '#8fdc6a' },
    },
    mortar: {
      name: '土炮', rarity: 1, cost: { copper: 500 }, dmgMult: 5.04, aspdMult: 0.5, projSpeed: 560, arc: true, splash: { radius: 90, mult: 0.6 },
      desc: '小号火炮：慢速抛射，落地爆炸范围大，一发伤害高。', good: '成团的怪', look: { base: 'cannon', color: '#9bd860' },
    },
    twinCrossbow: {
      name: '双发弩', rarity: 2, cost: { silver: 9 }, dmgMult: 1.7, aspdMult: 1.0, projSpeed: 980, bolts: 2, extraBoltMult: 0.6, flyingMult: 1.3, armorIgnore: 0.2,
      desc: '一次射 2 支弩箭，对飞行怪伤害 +30%，无视 20% 护甲。', good: '飞行怪、轻甲怪', look: { base: 'crossbow', color: '#6fb0ff', accent: 'twin' },
    },
    galeBoomerang: {
      name: '疾风镖', rarity: 2, cost: { silver: 11 }, dmgMult: 0.93, aspdMult: 0.75, projSpeed: 900, boomerang: true, twin: true, slow: { amt: 0.25, dur: 1.5 },
      desc: '一次扔出两支飞得更快的回旋镖（本车道 + 相邻车道），往返命中，命中使目标减速 25%（1.5 秒）。', good: '长队、快怪', look: { base: 'boomerang', color: '#5ab8ff', accent: 'gale' },
    },
    thunderMortar: {
      name: '雷鸣炮', rarity: 3, cost: { gold: 5 }, dmgMult: 8.4, aspdMult: 0.48, projSpeed: 620, arc: true, splash: { radius: 105, mult: 0.7 }, armorIgnore: 0.3, knock: { dist: 40, slow: 0.3, duration: 1 },
      desc: '落地大范围爆炸，无视 30% 护甲，把范围内的小怪向后震退 40 像素并减速 30%（1 秒）。', good: '成团的怪、重甲怪', look: { base: 'cannon', color: '#b86cff', accent: 'thunder' },
    },
    arcaneStaff: {
      name: '奥术杖', rarity: 3, cost: { gold: 4 }, dmgMult: 3.33, aspdMult: 0.9, projSpeed: 760, dmgType: 'magic', splash: { radius: 75, mult: 0.75 }, bossMult: 1.2,
      desc: '魔法弹，爆炸范围更大（半径 75、溅射 75%），对 Boss 伤害 +20%。', good: '成堆的怪、Boss、灵体', look: { base: 'staff', color: '#c88cff', accent: 'arcane' },
    },
    dragonBow: {
      name: '屠龙弓', rarity: 4, cost: { gold: 9 }, dmgMult: 2.02, aspdMult: 0.9, projSpeed: 1200, bolts: 3, extraBoltMult: 0.5, pierce: { count: 3, range: 560, mult: 0.8 }, bossMult: 1.5, armorIgnore: 0.4,
      tiers: [{ lv: 8, bolts: 4, dmgMult: 1.77 }],
      desc: '一次射 3 支屠龙箭，每支穿透同一车道最多 3 只怪（每只 80% 伤害），对 Boss 伤害 +50%，无视 40% 护甲；升到 8 级一次射 4 支。', good: 'Boss、重甲怪', look: { base: 'bow', color: '#ff6a4a', accent: 'dragon' },
    },
    infernoStaff: {
      name: '炼狱杖', rarity: 4, cost: { gold: 9 }, dmgMult: 4.4, aspdMult: 0.95, projSpeed: 780, dmgType: 'magic', splash: { radius: 95, mult: 0.8 }, ignite: true,
      desc: '魔法弹大范围爆炸（半径 95、溅射 80%），并点燃目标。', good: '成团的怪、灵体', look: { base: 'staff', color: '#ff7a3a', accent: 'inferno' },
    },
    worldCannon: {
      name: '裂世炮', rarity: 5, cost: { gold: 19 }, dmgMult: 14.21, aspdMult: 0.5, projSpeed: 640, arc: true, splash: { radius: 140, mult: 1 }, armorIgnore: 0.8, bossMult: 1.5, knock: { dist: 70, slow: 0.4, duration: 1.5 },
      desc: '爆炸半径 140、溅射不衰减，无视 80% 护甲，对 Boss 伤害 +50%，并把范围内的小怪向后震退 70 像素。', good: 'Boss、成团的怪', look: { base: 'cannon', color: '#ffd35a', accent: 'world' },
    },
    starfallOrb: {
      name: '星陨球', rarity: 5, cost: { gold: 17 }, dmgMult: 4.57, aspdMult: 1.1, projSpeed: 1700, dmgType: 'magic', bonusCrit: 0.12, chain: { count: 8, range: 270, falloff: 0.92 },
      desc: '魔法闪电跳跃 8 次，每跳只衰减 8%，暴击率 +12%。', good: '密集怪群、灵体、魔抗低的怪', look: { base: 'orb', color: '#fff0a8', accent: 'starfall' },
    },
  });

  // 武器品质（设计书 63.2）
  TD.data.weaponRarity = {
    1: { name: '绿', color: '#5fd35f', upgradeMult: 1 },
    2: { name: '蓝', color: '#4a9aff', upgradeMult: 1.2 },
    3: { name: '紫', color: '#b46cff', upgradeMult: 1.5 },
    4: { name: '红', color: '#ff5a4f', upgradeMult: 3 },
    5: { name: '金', color: '#ffc83a', upgradeMult: 5 },
  };

  // 技能协同（设计书 45）：两个技能前后释放时的额外效果
  TD.data.synergies = {
    shatter: { name: '碎冰', skills: ['frost', 'thunder'], mult: 1.3, desc: '雷霆一击打在冰冻领域里（减速或冰冻）的怪物身上，伤害 ×1.3' },
    drumRain: { name: '鼓点箭雨', skills: ['drum', 'arrowRain'], mult: 1.3, desc: '战鼓生效期间释放箭雨，箭数 +30%' },
  };

  TD.data.weaponAscend = { minLv: 5, cost: { silver: 8 } };
  // 武器升级的货币按品质固定（v1.15）：绿 铜币；蓝、紫 银币；红 金币；金 钻石。
  // 第 lv 级 → lv+1 级要 ceil(base × growth^lv) 个该货币（v1.19：每级 ×1.3；满级见 weaponMaxLevel）
  // ⚠️ 1.3 的幂涨得很快：红色 80 级、金色 100 级的最后几级是天文数字（金色第 99 级约 2×10^11 钻），想让满级够得着就把 growth 调小
  TD.data.weaponUpgradeCurrency = {
    2: { cur: 'silver', base: 1, growth: 1.3 },
    3: { cur: 'silver', base: 2, growth: 1.3 },
    4: { cur: 'gold', base: 1, growth: 1.3 },
    5: { cur: 'diamond', base: 1, growth: 1.3 },
  };

  TD.data.weaponUpgrade = {
    perLevel: 0.08,
    beyond: 0.04, // 第 10 级以后每级只加 4%（设计书 76.2）
    max: 10, // 每级 +8% 的"基础段"：10 级以内每级 +8%，之后 +4%；也是专精的解锁等级、机器人只升到的级数。真正的满级见 weaponMaxLevel
    // 绿色武器：第 lv 级 → lv+1 级要 ceil(5 × 1.3^lv) 铜币；其他品质见 weaponUpgradeCurrency（v1.19：每级 ×1.3）
    cost: (lv) => Math.ceil(5 * Math.pow(1.3, lv)),
  };
  // 每种品质的满级不一样（v1.19）：满级后不能再升（旧存档里已经超过的保持原样，只是不能再升）
  TD.data.weaponMaxLevel = { 1: 20, 2: 40, 3: 60, 4: 80, 5: 100 };

  TD.data.activeSkills = {
    drum: {
      name: '战鼓',
      cost: null,
      cd: 25,
      duration: 8,
      aspdBonus: 0.5,
      key: 'drum',
      desc: '攻击速度 +50%，持续 8 秒。',
      tiers: [{}, { aspdBonus: 0.65, duration: 10 }, { aspdBonus: 0.8, duration: 10, critBonus: 0.1 }],
      tierDesc: ['攻速 +50%，8 秒', '攻速 +65%，10 秒', '攻速 +80%，10 秒，期间暴击率 +10%'],
    },
    repair: {
      name: '城墙修复',
      cost: { silver: 3 },
      cd: 40,
      healRatio: 0.2,
      desc: '回复城墙 20% 最大血量。',
      tiers: [{}, { healRatio: 0.25 }, { healRatio: 0.3, drBonus: 0.3, drDuration: 6 }],
      tierDesc: ['回复 20%', '回复 25%', '回复 30%，之后 6 秒城墙受到伤害 −30%'],
    },
    arrowRain: {
      name: '箭雨',
      cost: { silver: 4 },
      cd: 20,
      arrows: 16,
      duration: 2,
      atkMult: 1.6,
      desc: '2 秒内落下 16 支箭，每支随机命中射程内的一只怪，造成攻击力 ×1.6 的伤害，无视盾牌。',
      tiers: [{}, { arrows: 20, atkMult: 1.7 }, { arrows: 24, atkMult: 1.8, ignite: true }],
      tierDesc: ['16 支 × 攻击力 1.6', '20 支 × 1.7', '24 支 × 1.8，命中的怪被点燃'],
    },
    frost: {
      name: '冰冻领域',
      cost: { silver: 4 },
      cd: 18,
      duration: 6,
      slow: 0.6,
      targetLane: true,
      desc: '选定一条车道，车道上的怪减速 60%，持续 6 秒。',
      tiers: [{}, { slow: 0.7, duration: 7 }, { slow: 0.75, duration: 8, freezeEnd: 1.5 }],
      tierDesc: ['减速 60%，6 秒', '减速 70%，7 秒', '减速 75%，8 秒，结束时冻结整条车道 1.5 秒'],
    },
    thunder: {
      name: '雷霆一击',
      cost: { silver: 5 },
      cd: 15,
      atkMult: 2.5,
      strikes: 3,
      desc: '连续劈下 3 道雷霆，每道劈向当前血量最高的怪（尽量各劈不同的怪），造成攻击力 ×2.5 的魔法伤害。',
      beyondDesc: 'Lv3 以后每 5 级多劈 1 道雷（最多 15 道），每升一级伤害再强一点、冷却再短一点',
      tiers: [{}, { strikes: 4, atkMult: 3 }, { strikes: 5, atkMult: 3.5, chain: 3, chainMult: 0.5, chainRange: 240 }],
      tierDesc: ['3 道雷，每道攻击力 ×2.5', '4 道雷，每道攻击力 ×3', '5 道雷，每道攻击力 ×3.5，并连锁附近 3 只怪（每只 50%）'],
    },
    // ---- 新增 5 个主动技能（设计书 103） ----
    pierce: {
      name: '贯穿光矢',
      cost: { silver: 5 },
      cd: 16,
      atkMult: 5,
      targetLane: true,
      desc: '选定一条车道，射出一支贯穿整条车道的光矢，对车道上所有的怪造成攻击力 ×5 的伤害，无视盾牌。',
      tiers: [{}, { atkMult: 6.5 }, { atkMult: 8, sideMult: 0.5 }],
      tierDesc: ['整条车道的怪，每只攻击力 ×5', '整条车道的怪，每只攻击力 ×6.5', '整条车道的怪，每只攻击力 ×8，相邻两条车道的怪也受到 50%'],
    },
    vortex: {
      name: '引力漩涡',
      cost: { silver: 5 },
      cd: 20,
      duration: 3,
      atkMult: 3,
      radius: 170,
      pull: 170,
      desc: '在怪最密集的地方撕开一个漩涡，3 秒内把周围的怪不断拉向中心，并造成共计攻击力 ×3 的魔法伤害。',
      tiers: [{}, { duration: 4, atkMult: 3.6 }, { duration: 4, atkMult: 4.2, burst: 2.5 }],
      tierDesc: ['3 秒，共攻击力 ×3', '4 秒，共攻击力 ×3.6', '4 秒，共攻击力 ×4.2，结束时漩涡爆炸，再造成攻击力 ×2.5'],
    },
    firewall: {
      name: '烈焰之墙',
      cost: { silver: 5 },
      cd: 18,
      duration: 6,
      atkMult: 1.2,
      targetLane: true,
      desc: '在选定的车道上升起一道火墙，6 秒内车道上的怪每秒受到攻击力 ×1.2 的魔法伤害，并被点燃。',
      tiers: [{}, { duration: 7, atkMult: 1.5 }, { duration: 8, atkMult: 1.8, slow: 0.3 }],
      tierDesc: ['6 秒，每秒攻击力 ×1.2', '7 秒，每秒攻击力 ×1.5', '8 秒，每秒攻击力 ×1.8，火里的怪减速 30%'],
    },
    mark: {
      name: '猎杀标记',
      cost: { silver: 4 },
      cd: 22,
      duration: 8,
      count: 1,
      bonus: 0.4,
      desc: '标记 1 只血量最高的怪，8 秒内它受到的伤害 +40%，主角优先攻击它。',
      tiers: [{}, { duration: 10, bonus: 0.5, count: 2 }, { duration: 12, bonus: 0.6, count: 3 }],
      tierDesc: ['标记 1 只，8 秒，受到伤害 +40%', '标记 2 只，10 秒，受到伤害 +50%', '标记 3 只，12 秒，受到伤害 +60%'],
    },
    clones: {
      name: '幻影连射',
      cost: { silver: 5 },
      cd: 24,
      duration: 8,
      phantoms: 1,
      phantomMult: 0.6,
      desc: '召出幻影和 Kael 并肩射击：8 秒内每次攻击，幻影再补 1 箭，伤害为 60%。',
      tiers: [{}, { duration: 9, phantoms: 2 }, { duration: 10, phantoms: 3, phantomMult: 0.7 }],
      tierDesc: ['8 秒，每次攻击补 1 箭（60%）', '9 秒，每次攻击补 2 箭（60%）', '10 秒，每次攻击补 3 箭（70%）'],
    },
  };

  // 技能升阶费用（设计书 20.1）：下标为目标等级
  TD.data.skillUpgradeCost = [null, null, { silver: 6 }, { gold: 2 }];
  TD.data.skillMaxLv = 3;

  // 被动技能（设计书 90）：买下来是 1 级，效果很弱，升级才会变强。
  // 效果值 = base + per × (min(等级, max) − 1) + beyond × max(0, 等级 − max)，最多到 cap：
  //   precision 暴击率 · combo 每次攻击追加 1 次攻击的几率（累计到 1 就追加一次，所以平均每 1/几率 次攻击追加 1 次）·
  //   burn 灼烧伤害（攻击力的倍数，3 秒内造成）· pierceArmor 无视护甲的比例
  // 到 10 级（max）时效果和老版本（买下来就是满效果）差不多，之后每级的提升变小、费用越来越高。
  TD.data.passiveSkills = {
    precision: { name: '精准', cost: { silver: 3 }, eff: { base: 0.02, per: 0.01, max: 10, beyond: 0.002, cap: 0.6 } },
    combo: { name: '连珠', cost: { silver: 4 }, eff: { base: 0.05, per: 0.0167, max: 10, beyond: 0.003, cap: 1 } },
    burn: { name: '灼烧', cost: { silver: 4 }, duration: 3, eff: { base: 0.12, per: 0.06, max: 10, beyond: 0.012, cap: 5 } },
    pierceArmor: { name: '穿甲', cost: { silver: 3 }, eff: { base: 0.08, per: 0.05, max: 10, beyond: 0.005, cap: 0.95 } },
    // ---- 外放型被动技能（设计书 103）：每次攻击都有一定几率额外放出一个效果。
    //   eff 是触发几率；mult 是 1 级时的伤害倍数（攻击力 ×），每升一级再强 10%（10 级以后每级 +1%）
    lightning: { name: '雷鸣', cost: { silver: 5 }, proc: true, mult: 1.4, chain: 2, eff: { base: 0.06, per: 0.02, max: 10, beyond: 0.004, cap: 0.6 } },
    frostNova: { name: '霜爆', cost: { silver: 5 }, proc: true, mult: 1.0, radius: 130, slow: 0.5, slowTime: 2, eff: { base: 0.07, per: 0.02, max: 10, beyond: 0.004, cap: 0.6 } },
    fireball: { name: '火球', cost: { silver: 6 }, proc: true, mult: 1.8, radius: 115, eff: { base: 0.05, per: 0.018, max: 10, beyond: 0.004, cap: 0.55 } },
    spiritArrows: { name: '灵箭', cost: { silver: 5 }, proc: true, mult: 0.9, count: 3, eff: { base: 0.07, per: 0.02, max: 10, beyond: 0.004, cap: 0.6 } },
    bladeWave: { name: '剑气', cost: { silver: 6 }, proc: true, mult: 1.2, eff: { base: 0.05, per: 0.018, max: 10, beyond: 0.004, cap: 0.55 } },
    renewal: { name: '回春', cost: { silver: 4 }, proc: true, heal: 0.008, eff: { base: 0.08, per: 0.02, max: 10, beyond: 0.004, cap: 0.6 } },
  };
  // 被动技能升级费用：1→2 级 600 铜，之后每级 ×1.4（到 10 级约 6600 铜）；10 级以后按"超过基础上限"的规则越来越贵
  TD.data.passiveUpgrade = { base: 600, growth: 1.4 };

  // 属性升级（设计书 18.1）。max = 基础等级 1000（进度条的满格）；soft = 成长期的长度：
  // 前 soft 级每级加 per（费用走铜币公式），之后每级加 beyond，费用按 D.extraCost 一路上涨——1000 级时攻速、暴击、幸运也接近各自的效果上限
  TD.data.attributes = {
    atk: { name: '攻击力', per: 2, beyond: 1, soft: 30, max: 1000, base: 30, fmt: (v) => v.toFixed(0) },
    aspd: { name: '攻击速度', per: 0.08, beyond: 0.02, soft: 20, max: 1000, base: 40, fmt: (v) => v.toFixed(2) + '/秒' },
    crit: { name: '暴击率', per: 0.02, beyond: 0.004, soft: 15, max: 1000, base: 50, fmt: (v) => Math.round(v * 100) + '%' },
    critDmg: { name: '暴击伤害', per: 0.1, beyond: 0.03, soft: 15, max: 1000, base: 50, fmt: (v) => Math.round(v * 100) + '%' },
    luck: { name: '幸运', per: 0.05, beyond: 0.01, soft: 10, max: 1000, base: 60, fmt: (v) => '+' + Math.round(v * 100) + '%' },
  };
  TD.data.attributeGrowth = 1.2;
  TD.data.attributeCost = (key, lv) => TD.util.round5(TD.data.attributes[key].base * Math.pow(TD.data.attributeGrowth, lv));

  // 城墙升级（设计书 18.6）。level 字段：城墙等级从 1 开始，其余从 0 开始；max = 基础等级 1000，soft = 成长期（同属性，见设计书 108）
  TD.data.wallUpgrades = {
    level: {
      name: '城墙等级',
      soft: 30,
      max: 1000,
      beyond: 0.15, // 第 30 级以后每级血量 +15% × 第 30 级的血量（线性增长，不再 ×1.1）
      start: 1,
      cost: (lv) => TD.util.round5(60 * Math.pow(1.18, lv - 1)),
      desc: '提升城墙最大血量（每级 ×1.1）。',
    },
    fortify: {
      name: '加固',
      soft: 10,
      max: 1000,
      beyond: 0.004,
      start: 0,
      per: 0.03,
      cost: (lv) => TD.util.round5(80 * Math.pow(1.25, lv)),
      desc: '城墙受到的伤害 −3% / 级。',
    },
    mend: {
      name: '修缮',
      soft: 5,
      max: 1000,
      beyond: 0.002,
      start: 0,
      per: 0.02,
      cost: (lv) => TD.util.round5(100 * Math.pow(1.3, lv)),
      desc: '每波结束回复 2% 最大血量 / 级。',
    },
    thorns: {
      name: '荆棘',
      soft: 5,
      max: 1000,
      beyond: 0.02,
      start: 0,
      per: 0.2,
      cost: (lv) => TD.util.round5(120 * Math.pow(1.3, lv)),
      desc: '攻击城墙的怪受到英雄攻击力 ×20% / 级的反弹伤害。',
    },
  };

  // ---------- 等级上限 999999（设计书 76.2） ----------
  // 属性、武器、城墙、技能都可以一直升到 999999 级。原来的上限（各自的 max）保留下来，叫"基础上限"：
  // 到了基础上限，每级的收益变小（beyond），而费用按等级一路涨，并且越来越多地要用银币、金币，最后是钻石。
  TD.data.levelCap = 999999;
  // 超过基础上限 soft 之后，第 lv 级的费用（折成铜币）= 第 soft 级的费用 ×（1 + 超出的级数 / 25）^ 2.2
  TD.data.extraCost = (v0, lv, soft) => v0 * Math.pow(1 + (lv - soft) / 25, 2.2);
  // 把铜币价值折成货币：20 万铜币以内付铜币，2000 万以内付银币，20 亿以内付金币，再往上付钻石
  TD.data.tierCost = (v) => {
    if (v <= 2e5) return { copper: TD.util.round5(v) };
    if (v <= 2e7) return { silver: Math.ceil(v / 100) };
    if (v <= 2e9) return { gold: Math.ceil(v / 1e4) };
    return { diamond: Math.ceil(v / 1e6) };
  };

  // 终极技能（设计书 133）：钻石买断，通关第 100 关后开放；每场战斗只能放一次
  // 放出来时先播一段拉弓的 CG（怪物全部暂停），再向天空射出一支箭，之后 duration 秒（10 秒）里漫天箭雨落下，伤害很高：
  //   每 volleyEvery 秒一轮：全屏随机挑 hits 只小怪各挨一箭（攻击力 ×atkMult，再加这只怪最大血量的 minionPct——保证"伤害很高"，不会因为英雄攻击力低就打不动），被命中的小怪冰冻 freeze 秒；
  //   Boss（含小 Boss 和 Boss 部件）每一轮都吃一箭：按它最大血量的 bossPct 扣血（10 秒共约一半血），不会被冻住
  TD.data.ultimate = {
    id: 'skyfall',
    name: '万箭天降',
    cost: { diamond: 150 },
    unlock: 100,
    duration: 10,
    volleyEvery: 0.2,
    hits: 14,
    atkMult: 4,
    minionPct: 0.4,
    bossPct: 0.01,
    freeze: 3,
    desc: '终极技能，每场战斗一次：拉满弓向天空射出一箭，随后 10 秒里漫天箭雨覆盖整个战场——伤害很高，命中的怪被冰冻；Boss 不会被冻住，但会被打掉大约一半的血量。放箭时所有怪物暂停。',
  };

  TD.data.items = {
    bomb: { name: '小炸弹', cost: { copper: 30 }, atkMult: 5, targetLane: true, desc: '对选定车道上所有怪造成攻击力 ×5 的伤害。' },
    patch: { name: '修补包', cost: { copper: 40 }, healRatio: 0.15, desc: '城墙回复 15% 最大血量。' },
    haste: { name: '加速药水', cost: { copper: 35 }, aspdBonus: 0.35, duration: 9, desc: '攻击速度 +35%，持续 9 秒。' },
    freeze: { name: '冰冻瓶', cost: { copper: 35 }, duration: 3, targetLane: true, desc: '冻结选定车道上的所有怪 3 秒。' },
    charm: { name: '幸运符', cost: { silver: 1 }, copperBonus: 0.3, passive: true, desc: '战斗开始时自动生效：本关铜币收益 +30%。' },

    // ---- v0.54 消耗品扩充（设计书 62）：越强越贵，铜 → 银 → 金 ----
    firebomb: { name: '燃烧瓶', cost: { copper: 80 }, atkMult: 2.5, targetLane: true, desc: '对选定车道上所有怪造成攻击力 ×2.5 的魔法伤害，并点燃它们。' },
    thunderScroll: { name: '雷霆符', cost: { silver: 2 }, atkMult: 5, count: 4, desc: '全场血量最高的 4 只怪各被一道闪电劈中，每道攻击力 ×5 的魔法伤害。' },
    bigBomb: { name: '重磅炸弹', cost: { silver: 3 }, atkMult: 7, targetLane: true, desc: '选定车道和相邻车道上所有怪受到攻击力 ×7 的伤害。' },
    barrier: { name: '守护符文', cost: { silver: 3 }, shieldRatio: 0.35, desc: '城墙获得一层护盾，能吸收 35% 最大血量的伤害，持续到本关结束。' },
    warBanner: { name: '战旗', cost: { silver: 3 }, atkBonus: 0.25, duration: 8, desc: '英雄攻击力 +25%，持续 8 秒。' },
    quake: { name: '地震符', cost: { silver: 4 }, atkMult: 3.5, stun: 2.5, bossStun: 1, desc: '全场怪物眩晕 2.5 秒（Boss 1 秒），并受到攻击力 ×3.5 的伤害。' },
    blizzard: { name: '暴风雪卷轴', cost: { gold: 1 }, duration: 6, bossDuration: 3, slowAfter: 0.5, slowTime: 4, shatter: 0.6, desc: '冰冻全体怪物 6 秒（Boss 3 秒），冻住期间它们受到的伤害 +60%，解冻后再减速 50%，持续 4 秒。' },
    flood: { name: '洪水', cost: { gold: 1 }, push: 350, bossPush: 100, atkMult: 3, slow: 0.6, slowTime: 5, shatter: 0.4, desc: '洪水冲过战场：全体怪物向后倒退 350 像素（Boss 100 像素），受到攻击力 ×3 的伤害，被浸湿的怪物 5 秒内受到的伤害 +40%，并减速 60%。' },
    holyLight: { name: '圣光', cost: { gold: 2 }, healRatio: 0.7, drAmt: 0.6, drDuration: 8, desc: '城墙回复 70% 最大血量，之后 8 秒城墙受到的伤害 −60%。' },
    meteor: { name: '陨石雨', cost: { gold: 2 }, count: 12, duration: 3, atkMult: 8, radius: 110, splashMult: 0.6, desc: '12 颗陨石落在全场随机的怪身上，每颗攻击力 ×8 的伤害，周围 110 像素内的怪受到六成。' },
    chrono: { name: '时间静止', cost: { gold: 3 }, duration: 7, aspdBonus: 0.6, shatter: 1.2, desc: '冻结全体怪物 7 秒，连 Boss 也一起冻住，冻住期间它们受到的伤害 ×2.2；这期间英雄攻击速度 +60%。' },

    // ---- v1.05 消耗品扩充（设计书 107）：铜 / 银 / 金每档都补到 15 种（银档的幸运符是被动的，也算一种）----
    // 铜币档（10 种新增）
    spikeTrap: { name: '尖刺陷阱', cost: { copper: 45 }, atkMult: 3, slow: 0.4, slowTime: 4, targetLane: true, desc: '选定车道上的怪受到攻击力 ×3 的伤害，并减速 40%，持续 4 秒。' },
    smokeBomb: { name: '烟雾弹', cost: { copper: 40 }, slow: 0.35, duration: 6, desc: '全场怪物减速 35%，持续 6 秒。' },
    bandage: { name: '绷带', cost: { copper: 50 }, healRatio: 0.12, duration: 6, desc: '城墙在 6 秒内逐渐回复 12% 最大血量。' },
    whetstone: { name: '磨刀石', cost: { copper: 45 }, critBonus: 0.25, duration: 10, desc: '暴击率 +25%，持续 10 秒。' },
    luckyCoin: { name: '幸运铜币', cost: { copper: 60 }, copperMult: 2, duration: 15, desc: '15 秒内击败的怪物掉落 2 倍铜币。' },
    ropeNet: { name: '绳网', cost: { copper: 55 }, stun: 2, bossStun: 0.8, targetLane: true, desc: '选定车道上的怪被缠住 2 秒（Boss 0.8 秒）。' },
    firecracker: { name: '鞭炮', cost: { copper: 50 }, count: 8, atkMult: 1.2, stun: 0.8, desc: '随机 8 只怪被炸响，各受到攻击力 ×1.2 的伤害，并眩晕 0.8 秒。' },
    oilFlask: { name: '油罐', cost: { copper: 70 }, slow: 0.5, slowTime: 6, shatter: 0.3, targetLane: true, desc: '选定车道上的怪被油浸湿：减速 50%，受到的伤害 +30%，持续 6 秒。' },
    woodShield: { name: '木盾', cost: { copper: 65 }, shieldRatio: 0.12, desc: '城墙获得一层护盾，能吸收 12% 最大血量的伤害，持续到本关结束。' },
    farsightPotion: { name: '远望药水', cost: { copper: 40 }, rangeBonus: 0.25, duration: 15, desc: '射程 +25%，持续 15 秒。' },
    // 银币档（9 种新增）
    chainScroll: { name: '连锁闪电符', cost: { silver: 2 }, atkMult: 4, hops: 8, range: 280, falloff: 0.92, desc: '一道闪电劈中血量最高的怪，再连锁跳 8 次，每次造成攻击力 ×4 的魔法伤害（每跳衰减 8%）。' },
    poisonFlask: { name: '毒瓶', cost: { silver: 2 }, dotMult: 6, duration: 6, slow: 0.2, targetLane: true, desc: '选定车道上的怪中毒：6 秒内共受到攻击力 ×6 的魔法伤害，并减速 20%。' },
    mirrorShield: { name: '反射盾', cost: { silver: 3 }, thornsMult: 1.5, duration: 12, desc: '12 秒内怪物每次攻击城墙，都会受到攻击力 ×1.5 的反弹伤害。' },
    vampDraught: { name: '吸血药剂', cost: { silver: 3 }, killHeal: 0.012, duration: 12, desc: '12 秒内每击败一只怪，城墙回复 1.2% 最大血量。' },
    earthSpike: { name: '地刺符', cost: { silver: 3 }, atkMult: 4, stun: 1.5, bossStun: 0.6, near: 420, desc: '离城墙最近的怪（420 像素内）被地刺刺中：受到攻击力 ×4 的伤害并眩晕 1.5 秒（Boss 0.6 秒）。' },
    glueTrap: { name: '粘胶', cost: { silver: 2 }, slow: 0.6, duration: 8, desc: '全场怪物减速 60%，持续 8 秒（Boss 减速 30%）。' },
    rageDraught: { name: '狂暴药水', cost: { silver: 3 }, atkBonus: 0.4, aspdBonus: 0.3, duration: 8, desc: '英雄攻击力 +40%、攻击速度 +30%，持续 8 秒。' },
    thunderStorm: { name: '雷暴符', cost: { silver: 4 }, count: 8, duration: 4, atkMult: 2.5, desc: '4 秒内降下 8 道落雷，随机劈中全场的怪，每道攻击力 ×2.5 的魔法伤害。' },
    steelArrows: { name: '钢箭', cost: { silver: 2 }, armorIgnore: 0.4, duration: 12, desc: '无视目标 40% 护甲（含盾牌），持续 12 秒。' },
    // 金币档（10 种新增）
    dragonBreath: { name: '龙息', cost: { gold: 2 }, atkMult: 6, stun: 1, bossStun: 0.5, desc: '龙焰扫过全场：所有怪受到攻击力 ×6 的魔法伤害，被点燃并眩晕 1 秒（Boss 0.5 秒）。' },
    blackHole: { name: '黑洞', cost: { gold: 3 }, duration: 4, atkMult: 8, radius: 260, pull: 320, burst: 6, desc: '在怪最密集的地方张开黑洞，4 秒内把周围 260 像素的怪不断拉向中心，共造成攻击力 ×8 的魔法伤害，结束时爆炸再造成攻击力 ×6。' },
    sanctuary: { name: '圣域', cost: { gold: 3 }, duration: 6, desc: '6 秒内城墙受到的伤害 −95%。' },
    phoenixFeather: { name: '凤凰之羽', cost: { gold: 3 }, reviveHeal: 0.8, desc: '城墙本关第一次被打倒时，立刻复活并回复 80% 最大血量（只触发一次，用了就生效到本关结束）。' },
    stormCall: { name: '风暴召唤', cost: { gold: 2 }, count: 20, duration: 5, atkMult: 4, desc: '5 秒内降下 20 道落雷，随机劈中全场的怪，每道攻击力 ×4 的魔法伤害。' },
    timeLoop: { name: '时光回溯', cost: { gold: 2 }, healRatio: 0.3, desc: '立刻刷新全部主动技能的冷却，并让城墙回复 30% 最大血量。' },
    godWrath: { name: '天罚', cost: { gold: 3 }, executeBelow: 0.4, atkMult: 4, desc: '全场血量低于 40% 的怪被当场抹杀，其余怪（含 Boss）受到攻击力 ×4 的魔法伤害。' },
    goldenArrow: { name: '黄金箭', cost: { gold: 2 }, shots: 10, mult: 2.5, desc: '接下来的 10 次攻击必定暴击，并额外造成 2.5 倍伤害。' },
    plague: { name: '瘟疫', cost: { gold: 2 }, dotMult: 14, duration: 8, slow: 0.15, desc: '全场怪物中毒：8 秒内共受到攻击力 ×14 的魔法伤害，并减速 15%。' },
    shadowLegion: { name: '影分身军团', cost: { gold: 3 }, phantoms: 3, phantomMult: 1, duration: 12, desc: '12 秒内每次攻击，3 个影分身各补一箭，伤害与本体相同。' },
  };

  // 道具冷却（秒，设计书 82）：用过一次以后，这一种道具要等冷却好才能再用；越强冷却越长。幸运符是战斗开始时自动生效的，没有冷却
  TD.data.itemCd = {
    bomb: 12, patch: 18, haste: 20, freeze: 18, firebomb: 14, thunderScroll: 25, bigBomb: 22, barrier: 30, warBanner: 24, quake: 30, blizzard: 45, flood: 45, holyLight: 50, meteor: 45, chrono: 60,
    // v1.05 新增
    spikeTrap: 14, smokeBomb: 22, bandage: 20, whetstone: 22, luckyCoin: 30, ropeNet: 18, firecracker: 16, oilFlask: 20, woodShield: 25, farsightPotion: 25,
    chainScroll: 24, poisonFlask: 20, mirrorShield: 35, vampDraught: 40, earthSpike: 28, glueTrap: 30, rageDraught: 35, thunderStorm: 40, steelArrows: 26,
    dragonBreath: 50, blackHole: 55, sanctuary: 70, phoenixFeather: 90, stormCall: 50, timeLoop: 80, godWrath: 70, goldenArrow: 45, plague: 50, shadowLegion: 60,
  };
  for (const id of Object.keys(TD.data.items)) if (TD.data.itemCd[id]) TD.data.items[id].cd = TD.data.itemCd[id];
  // 道具携带规则：最多带 7 种，每种最多带 3 个
  TD.data.itemRules = { kinds: 7, perKind: 3 };

  TD.data.equipment = {
    ironHelm: { name: '铁皮盔', slot: 'helm', rarity: 'common', cost: { copper: 120 }, stats: { atkFlat: 3 }, desc: '攻击力 +3' },
    shineHelm: {
      name: '闪光盔',
      slot: 'helm',
      rarity: 'purple',
      cost: { silver: 6 },
      stats: { atkFlat: 5, crit: 0.05 },
      desc: '攻击力 +5，暴击率 +5%',
    },
    lionCrown: {
      name: '狮心王冠',
      slot: 'helm',
      rarity: 'legend',
      cost: { gold: 3 },
      stats: { atkPct: 0.15, crit: 0.1, critDmg: 0.25 },
      desc: '攻击力 +15%，暴击率 +10%，暴击伤害 +25%',
    },
    redCape: { name: '红披风', slot: 'cape', rarity: 'common', cost: { copper: 150 }, stats: { aspdPct: 0.1 }, desc: '攻击速度 +10%' },
    starCape: {
      name: '星光披风',
      slot: 'cape',
      rarity: 'purple',
      cost: { silver: 8 },
      stats: { aspdPct: 0.15, wallDr: 0.1 },
      desc: '攻击速度 +15%，城墙受到伤害 −10%',
    },
    clover: { name: '四叶草', slot: 'trinket', rarity: 'common', cost: { copper: 100 }, stats: { luck: 0.15 }, desc: '幸运 +15%' },
    fang: { name: '狼牙项链', slot: 'trinket', rarity: 'common', cost: { copper: 140 }, stats: { critDmg: 0.25 }, desc: '暴击伤害 +25%' },
    eagleEye: { name: '鹰眼坠', slot: 'trinket', rarity: 'purple', cost: { silver: 6 }, stats: { rangePct: 0.1 }, desc: '射程 +10%' },

    // ---- v0.50 装备扩充（设计书 58）：minLevel = 推荐关卡（只是提示，买得起就能买，设计书 66）；mods 进入战斗时并入战场修正 ----
    dragonHelm: { name: '屠龙盔', slot: 'helm', rarity: 'purple', cost: { silver: 7 }, minLevel: 10, stats: { atkFlat: 3 }, mods: { bossDmg: 0.2 }, desc: '攻击力 +3；对 Boss（含触手）伤害 +20%' },
    owlHelm: { name: '夜枭盔', slot: 'helm', rarity: 'purple', cost: { silver: 6 }, minLevel: 20, stats: { crit: 0.04 }, mods: { darkSight: 0.5 }, desc: '暴击率 +4%；暗夜关的射程惩罚减半' },
    frostHelm: { name: '寒铁盔', slot: 'helm', rarity: 'purple', cost: { silver: 7 }, minLevel: 30, stats: { atkFlat: 3 }, mods: { frostExt: 0.3 }, set: 'frost', desc: '攻击力 +3；冰冻领域、冰冻瓶持续时间 +30%' },
    windCape: { name: '疾风披风', slot: 'cape', rarity: 'common', cost: { copper: 260 }, minLevel: 4, stats: { aspdPct: 0.06 }, mods: { flyDmg: 0.15 }, desc: '攻击速度 +6%；对飞行怪伤害 +15%' },
    emberCape: { name: '余烬斗篷', slot: 'cape', rarity: 'purple', cost: { silver: 8 }, minLevel: 40, stats: { aspdPct: 0.08 }, mods: { igniteChance: 0.2 }, desc: '攻击速度 +8%；普通攻击 20% 几率点燃目标' },
    tideCape: { name: '潮汐斗篷', slot: 'cape', rarity: 'purple', cost: { silver: 8 }, minLevel: 60, stats: { aspdPct: 0.08, wallDr: 0.08 }, mods: { mendBonus: 0.02 }, set: 'tide', desc: '攻击速度 +8%，城墙受到伤害 −8%；每波结束城墙多回复 2%' },
    leatherQuiver: { name: '皮箭袋', slot: 'quiver', rarity: 'common', cost: { copper: 500 }, minLevel: 15, stats: { critDmg: 0.15 }, desc: '暴击伤害 +15%' },
    barbQuiver: { name: '倒钩箭袋', slot: 'quiver', rarity: 'common', cost: { copper: 700 }, minLevel: 15, stats: { atkPct: 0.05 }, desc: '攻击力 +5%' },
    pierceQuiver: { name: '破甲箭袋', slot: 'quiver', rarity: 'purple', cost: { silver: 6 }, minLevel: 15, stats: {}, mods: { armorIgnore: 0.2 }, desc: '无视目标 20% 护甲' },
    spiritQuiver: { name: '灵光箭袋', slot: 'quiver', rarity: 'purple', cost: { silver: 6 }, minLevel: 21, stats: { crit: 0.03 }, mods: { spiritPierce: 0.25 }, desc: '暴击率 +3%；物理伤害对灵体的效果 +25%' },
    frostQuiver: { name: '霜羽箭袋', slot: 'quiver', rarity: 'purple', cost: { silver: 6 }, minLevel: 30, stats: {}, mods: { slowOnHit: 0.15 }, set: 'frost', desc: '普通攻击使目标减速 15%（1.5 秒）' },
    thunderQuiver: { name: '雷鸣箭袋', slot: 'quiver', rarity: 'legend', cost: { gold: 3 }, minLevel: 25, stats: {}, zap: { every: 6, atkMult: 1.5 }, desc: '每第 6 次攻击，一道小闪电落在目标身上，额外造成攻击力 ×1.5 的魔法伤害' },
    coinCharm: { name: '招财坠', slot: 'trinket', rarity: 'common', cost: { copper: 180 }, minLevel: 6, stats: {}, mods: { copperBonus: 0.1 }, desc: '本关铜币收益 +10%' },
    rageBadge: { name: '背水徽章', slot: 'trinket', rarity: 'purple', cost: { silver: 6 }, minLevel: 15, stats: {}, mods: { lowWallAtk: 0.2 }, desc: '城墙血量低于 50% 时，攻击力 +20%' },
    hourglass: { name: '时之沙漏', slot: 'trinket', rarity: 'legend', cost: { gold: 3 }, minLevel: 35, stats: {}, mods: { cdMult: -0.15 }, desc: '主动技能冷却 −15%' },
    shellCharm: { name: '贝壳护符', slot: 'trinket', rarity: 'purple', cost: { silver: 6 }, minLevel: 61, stats: { wallDr: 0.06 }, mods: { healBonus: 0.25 }, set: 'tide', desc: '城墙受到伤害 −6%；城墙回血效果 +25%' },
  };

  TD.data.equipSlots = { helm: '头盔', cape: '披风', quiver: '箭袋', trinket: '饰品' };

  // 套装（设计书 58.4）：凑齐 parts 后，mods 并入战场修正
  TD.data.gearSets = {
    frost: { name: '寒霜', parts: ['frostHelm', 'frostQuiver'], mods: { slowedDmg: 0.15 }, desc: '对被减速或冰冻的怪物伤害 +15%' },
    tide: { name: '潮汐', parts: ['tideCape', 'shellCharm'], mods: { waveShield: 0.04 }, desc: '每波开始时，城墙获得 4% 最大血量的泡泡护盾' },
  };

  TD.data.rarityNames = { common: '普通', rare: '精良', legend: '传说' };

  // 配装栏位解锁：通关某关后解锁（0 表示初始）
  TD.data.slotUnlocks = {
    quiver: [0],
    active: [0, 5, 20],
    passive: [3, 10, 30],
    item: [2, 6, 8, 14, 22, 32, 45],
  };

  // 战场补给卡（设计书 2.7、18.12、71.5）：mods 中的字段由战斗逻辑读取
  // rarity：blue 蓝 / purple 紫 / red 红 / gold 金（从低到高，越高越强、越难遇到）；instant：选完立即生效的一次性效果；minLevel：到这一章才会出现的专用克制卡
  TD.data.supplyRarity = {
    blue: { name: '蓝', color: '#5aa8ff' },
    purple: { name: '紫', color: '#c07aff' },
    red: { name: '红', color: '#ff5a4f' },
    gold: { name: '金', color: '#ffc83a' },
  };
  // 第 1、2、3、4 次补给时，出蓝 / 紫 / 红 / 金的权重：品质越高概率越低；越往后高品质的比例略升，但永远是蓝 > 紫 > 红 > 金
  TD.data.supplyWeights = [
    [62, 27, 9, 2],
    [52, 29, 14, 5],
    [43, 30, 18, 9],
    [36, 30, 21, 13],
  ];
  TD.data.supplies = {
    // —— 蓝：稳定的小强化（没写 rarity 的都是蓝）——
    sharp: { name: '磨利箭头', desc: '攻击力 +12%', mods: { atkMult: 0.12 }, icon: 'arrowUp' },
    quick: { name: '灵巧手指', desc: '攻击速度 +12%', mods: { aspdMult: 0.12 }, icon: 'haste' },
    eagle: { name: '鹰之眼', desc: '暴击率 +8%', mods: { crit: 0.08 }, icon: 'eye' },
    fury: { name: '狂热', desc: '暴击伤害 +30%', mods: { critDmg: 0.3 }, icon: 'fury' },
    bricks: { name: '加固砖块', desc: '立即回复城墙 20%，城墙受到伤害 −8%', mods: { wallDr: 0.08 }, heal: 0.2, icon: 'repair' },
    master: { name: '技能大师', desc: '主动技能冷却 −20%，并立即刷新所有冷却', mods: { cdMult: -0.2 }, refresh: true, needSkills: true, icon: 'master' },
    purse: { name: '铜币袋', desc: '本关铜币收益 +30%', mods: { copperBonus: 0.3 }, icon: 'purse' },
    frostTip: { name: '寒霜箭头', desc: '普通攻击使目标减速 20%，持续 1.5 秒', mods: { slowOnHit: 0.2 }, icon: 'frost' },
    farsight: { name: '远望', desc: '射程 +12%', mods: { range: 0.12 }, icon: 'eye' },
    arcane: { name: '奥术涌动', desc: '魔法伤害 +25%', mods: { magicMult: 0.25 }, icon: 'staff', minLevel: 11 },
    breaker: { name: '破甲箭头', desc: '无视目标 25% 护甲', mods: { armorIgnore: 0.25 }, icon: 'cannon', minLevel: 11 },
    // —— 紫：效果明显的强化，或立刻生效的一次性好处 ——
    hospital: { name: '战地医院', desc: '立刻回复城墙 45%', mods: {}, heal: 0.45, rarity: 'purple', icon: 'patch' },
    airstrike: { name: '空袭', desc: '下一波开始 8 秒后，对全场所有怪造成攻击力 ×6 的魔法伤害', mods: {}, delayed: { kind: 'airstrike', after: 8, atkMult: 6 }, rarity: 'purple', icon: 'cannon' },
    coldSnap: { name: '冰封令', desc: '下一波开始 10 秒后，冻住全场怪物 4 秒（Boss 1.5 秒）', mods: {}, delayed: { kind: 'coldSnap', after: 10, dur: 4, bossDur: 1.5 }, rarity: 'purple', icon: 'freeze' },
    warDrum: { name: '战鼓雷鸣', desc: '立刻刷新全部技能冷却，攻击力 +35%，持续 30 秒', mods: {}, refresh: true, buff: { atk: 0.35, dur: 30 }, needSkills: true, rarity: 'purple', icon: 'master' },
    executioner: { name: '处决', desc: '对血量低于 30% 的怪，伤害 +60%', mods: { execute: 0.6 }, rarity: 'purple', icon: 'fury' },
    mender: { name: '回春箭', desc: '每击杀一只怪，城墙回复 0.3% 最大血量', mods: { killHeal: 0.003 }, rarity: 'purple', icon: 'repair' },
    hunter: { name: '猎手本能', desc: '对 Boss 和飞行怪伤害 +30%', mods: { bossDmg: 0.3, flyDmg: 0.3 }, rarity: 'purple', icon: 'eye' },
    ember: { name: '烈焰附魔', desc: '普通攻击 30% 几率点燃目标', mods: { igniteChance: 0.3 }, rarity: 'purple', icon: 'fury' },
    // —— 红：改变打法的强力卡 ——
    fortress: { name: '铜墙铁壁', desc: '每一波开始时，城墙获得相当于 12% 最大血量的护盾；城墙受到伤害 −10%', mods: { waveShield: 0.12, wallDr: 0.1 }, rarity: 'red', icon: 'repair' },
    chain: { name: '连锁闪电', desc: '普通攻击 25% 几率放出一道闪电，跳 3 个目标，各造成攻击力 ×0.6 的魔法伤害', mods: { chainChance: 0.25 }, rarity: 'red', icon: 'staff' },
    godslayer: { name: '弑神', desc: '对 Boss 伤害 +50%，无视 20% 护甲', mods: { bossDmg: 0.5, armorIgnore: 0.2 }, rarity: 'red', icon: 'cannon' },
    overdrive: { name: '全面强化', desc: '攻击力 +20%，攻击速度 +15%，暴击率 +8%', mods: { atkMult: 0.2, aspdMult: 0.15, crit: 0.08 }, rarity: 'red', icon: 'arrowUp' },
    midas: { name: '点石成金', desc: '本关铜币收益 +60%，并立刻获得一笔铜币', mods: { copperBonus: 0.6 }, copperNow: true, rarity: 'red', icon: 'purse' },
    // —— 金：传说级，一局里最多遇到一两张 ——
    aegis: { name: '神圣庇佑', desc: '本关城墙第一次被打倒时，立刻复活并回复 60% 最大血量（只有一次）', mods: { revive: 1 }, rarity: 'gold', icon: 'repair' },
    frenzy: { name: '狂暴', desc: '攻击力 +35%，攻击速度 +25%，暴击率 +15%，暴击伤害 +50%', mods: { atkMult: 0.35, aspdMult: 0.25, crit: 0.15, critDmg: 0.5 }, rarity: 'gold', icon: 'fury' },
    hourglass: { name: '时光沙漏', desc: '主动技能冷却 −40%，并立刻刷新全部冷却', mods: { cdMult: -0.4 }, refresh: true, needSkills: true, rarity: 'gold', icon: 'master' },
    skyfire: { name: '天火降临', desc: '之后每一波开始 6 秒后，天火落下，对全场所有怪造成攻击力 ×4 的魔法伤害', mods: { waveStrike: 1 }, rarity: 'gold', icon: 'cannon' },
    // —— 章节专用克制卡（蓝档，到对应章节才会出现，被抽到的机会减半） ——
    flare: { name: '照明弹', desc: '射程 +20%（暗夜关里正好抵消黑暗）', mods: { range: 0.2 }, icon: 'eye', minLevel: 21 },
    antidote: { name: '解毒剂', desc: '城墙受到的持续伤害（中毒、毒雾）−60%', mods: { dotReduce: 0.6 }, icon: 'patch', minLevel: 21 },
    exorcism: { name: '驱魔之箭', desc: '物理伤害对灵体的效果 30% → 70%', mods: { spiritPierce: 0.4 }, icon: 'arrowUp', minLevel: 21 },
    handWarmer: { name: '暖手炉', desc: '英雄受到的攻速降低效果 −60%', mods: { chillResist: 0.6 }, icon: 'haste', minLevel: 31 },
    fireTip: { name: '火焰箭头', desc: '普通攻击命中后点燃目标', mods: { igniteOnHit: 1 }, icon: 'fury', minLevel: 31 },
    extinguisher: { name: '灭火器', desc: '火焰地带和熔岩车道对怪物无效', mods: { fireproof: 1 }, icon: 'freeze', minLevel: 41 },
    lens: { name: '透视镜', desc: '暗影刺客在更远处（x < 800）就会现身', mods: { reveal: 1 }, icon: 'eye', minLevel: 41 },
    obsidian: { name: '黑曜石砖', desc: '城墙受到伤害 −12%', mods: { wallDr: 0.12 }, icon: 'repair', minLevel: 41 },
    shears: { name: '羊毛剪', desc: '云朵羊的羊毛 −60%', mods: { woolCut: 0.6 }, icon: 'fury', minLevel: 51 },
    lightningRod: { name: '避雷针', desc: '英雄不会被电麻或震晕', mods: { stunImmune: 1 }, icon: 'eye', minLevel: 51 },
    windFlag: { name: '顺风旗', desc: '风筝怪的闪避率 −25%', mods: { dodgeCut: 0.25 }, icon: 'arrowUp', minLevel: 51 },
    // 第七章（设计书 52.4）
    crowbar: { name: '小撬棍', desc: '寄居蟹缩壳的时间 −60%', mods: { shellCut: 0.6 }, icon: 'cannon', minLevel: 61 },
    pin: { name: '戳戳针', desc: '泡泡被戳破的那一下，仍有 50% 伤害生效', mods: { pinPop: 0.5 }, icon: 'arrowUp', minLevel: 61 },
    net: { name: '渔网', desc: '飞鱼的跳跃距离 −50%', mods: { leapCut: 0.5 }, icon: 'freeze', minLevel: 61 },
  };
  // 机器人选卡顺序：先挑立刻见效的强卡，再挑通用强化，最后是克制卡
  TD.data.supplyBotOrder = ['frenzy', 'aegis', 'skyfire', 'hourglass', 'overdrive', 'fortress', 'chain', 'godslayer', 'warDrum', 'executioner', 'hunter', 'ember', 'mender', 'sharp', 'quick', 'master', 'handWarmer', 'fireTip', 'obsidian', 'lens', 'extinguisher', 'lightningRod', 'windFlag', 'shears', 'pin', 'crowbar', 'net', 'arcane', 'breaker', 'exorcism', 'antidote', 'flare', 'eagle', 'fury', 'frostTip', 'farsight', 'hospital', 'airstrike', 'coldSnap', 'bricks', 'purse', 'midas'];

  TD.data.targetModes = {
    nearest: '最近优先',
    smart: '威胁优先',
    weakest: '最弱优先',
    strongest: '最强优先',
    flying: '飞行优先',
    boss: 'Boss 优先',
  };
})((globalThis.TD = globalThis.TD || {}));
