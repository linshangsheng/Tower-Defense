// 武器、技能、装备、消耗品、属性与城墙升级（设计书 18.1–18.3、18.6–18.8）
(function (TD) {
  'use strict';

  TD.data = TD.data || {};

  TD.data.weapons = {
    bow: {
      name: '木弓',
      rarity: 1,
      cost: null,
      dmgMult: 1.0,
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
      dmgMult: 0.45,
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
      dmgMult: 0.7,
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
      dmgMult: 1.15,
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
      dmgMult: 3.3,
      aspdMult: 0.35,
      projSpeed: 600,
      arc: true,
      splash: { radius: 80, mult: 0.7 },
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
      dmgMult: 0.8,
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
      name: '寒霜弓', rarity: 2, cost: { silver: 12 }, minLevel: 10, dmgMult: 1.8, aspdMult: 1.0, projSpeed: 950, slow: { amt: 0.3, dur: 2 },
      desc: '伤害 ×1.8；命中使目标减速 30%（2 秒）。', good: '快怪：兔子、狼、战车', look: { base: 'bow', color: '#8fd8ff', accent: 'frost' },
    },
    flameCrossbow: {
      name: '烈焰弩', rarity: 3, cost: { gold: 4 }, minLevel: 20, dmgMult: 0.6, aspdMult: 1.0, projSpeed: 950, bolts: 3, extraBoltMult: 0.45, flyingMult: 1.5, ignite: true,
      desc: '一次射 3 支火焰弩箭，每支点燃目标，对飞行怪伤害 +50%。', good: '群怪、飞行怪', look: { base: 'crossbow', color: '#ff9a4a', accent: 'flame' },
    },
    piercer: {
      name: '穿心长弓', rarity: 3, cost: { gold: 5 }, minLevel: 20, dmgMult: 1.3, aspdMult: 0.9, projSpeed: 1100, pierce: { count: 5, range: 520, mult: 0.8 }, armorIgnore: 0.2,
      desc: '箭穿过同一车道最多 5 只怪（每只 80% 伤害），无视 20% 护甲。', good: '排成长队的车道', look: { base: 'bow', color: '#d9a0ff', accent: 'lance' },
    },
    meteorCannon: {
      name: '陨星炮', rarity: 4, cost: { gold: 8 }, minLevel: 40, dmgMult: 3.8, aspdMult: 0.4, projSpeed: 620, arc: true, splash: { radius: 100, mult: 0.8 }, armorIgnore: 0.6, bossMult: 1.3,
      desc: '超重炮弹，爆炸半径 100，无视 60% 护甲，对 Boss 伤害 +30%。', good: '重甲怪、Boss', look: { base: 'cannon', color: '#ff6a3a', accent: 'meteor' },
    },
    stormOrb: {
      name: '风暴法球', rarity: 4, cost: { gold: 9 }, minLevel: 40, dmgMult: 1.2, aspdMult: 1.0, projSpeed: 1600, dmgType: 'magic', chain: { count: 5, range: 240, falloff: 0.85 },
      desc: '魔法闪电跳跃 5 次，每跳只衰减 15%。', good: '密集怪群、灵体', look: { base: 'orb', color: '#7ad0ff', accent: 'storm' },
    },
    voidCrossbow: {
      name: '裂空弩', rarity: 4, cost: { gold: 10 }, minLevel: 40, dmgMult: 0.62, aspdMult: 1.0, projSpeed: 1000, bolts: 5, extraBoltMult: 0.55, flyingMult: 1.6, armorIgnore: 0.2,
      desc: '一次射 5 支箭，对飞行怪伤害 +60%，无视 20% 护甲。', good: '群怪、飞行怪', look: { base: 'crossbow', color: '#b060ff', accent: 'void' },
    },
    genesisBow: {
      name: '创世之弓', rarity: 5, cost: { gold: 20 }, minLevel: 60, dmgMult: 2.0, aspdMult: 1.15, projSpeed: 1200, bonusCrit: 0.2, pierce: { count: 3, range: 420, mult: 0.7 }, ignite: true,
      desc: '高伤害、暴击率 +20%；箭穿透 3 只怪，并点燃目标。', good: '通用、Boss', look: { base: 'bow', color: '#ffd860', accent: 'genesis' },
    },
    judgementStaff: {
      name: '天罚之杖', rarity: 5, cost: { gold: 18 }, minLevel: 60, dmgMult: 1.7, aspdMult: 0.95, projSpeed: 760, dmgType: 'magic', splash: { radius: 110, mult: 0.9 }, chain: { count: 2, range: 200, falloff: 0.7 },
      desc: '魔法，大范围爆炸（半径 110、溅射 90%），再加 2 次闪电跳跃。', good: '成堆的怪、灵体、魔抗低的怪', look: { base: 'staff', color: '#fff0a0', accent: 'judgement' },
    },
    chronoBoomerang: {
      name: '时之回旋', rarity: 5, cost: { gold: 16 }, minLevel: 60, dmgMult: 1.7, aspdMult: 0.75, projSpeed: 800, boomerang: true, twin: true, slow: { amt: 0.4, dur: 2 },
      desc: '一次扔出两支回旋镖（本车道 + 相邻车道），命中使目标减速 40%。', good: '长队、木盾哥布林', look: { base: 'boomerang', color: '#c8a8ff', accent: 'chrono' },
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

  TD.data.weaponUpgrade = {
    perLevel: 0.08,
    max: 10,
    cost: (lv) => TD.util.round5(80 * Math.pow(1.3, lv)),
  };

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
      atkMult: 5,
      desc: '对当前血量最高的怪造成攻击力 ×5 的魔法伤害。',
      tiers: [{}, { atkMult: 6 }, { atkMult: 7, chain: 3, chainMult: 0.5, chainRange: 240 }],
      tierDesc: ['攻击力 ×5', '攻击力 ×6', '攻击力 ×7，并连锁附近 3 只怪（每只 50%）'],
    },
  };

  // 技能升阶费用（设计书 20.1）：下标为目标等级
  TD.data.skillUpgradeCost = [null, null, { silver: 6 }, { gold: 2 }];
  TD.data.skillMaxLv = 3;

  TD.data.passiveSkills = {
    precision: { name: '精准', cost: { silver: 3 }, crit: 0.1, desc: '暴击率 +10%。' },
    combo: { name: '连珠', cost: { silver: 4 }, every: 5, desc: '每攻击 5 次，立即追加 1 次攻击。' },
    burn: {
      name: '灼烧',
      cost: { silver: 4 },
      duration: 3,
      atkMult: 0.6,
      desc: '命中后点燃目标，3 秒内共造成攻击力 ×60% 的魔法伤害。',
    },
    pierceArmor: { name: '穿甲', cost: { silver: 3 }, ignore: 0.5, desc: '无视目标 50% 护甲（含盾牌）。' },
  };

  // 属性升级（设计书 18.1）
  TD.data.attributes = {
    atk: { name: '攻击力', per: 2, max: 30, base: 30, fmt: (v) => v.toFixed(0) },
    aspd: { name: '攻击速度', per: 0.08, max: 20, base: 40, fmt: (v) => v.toFixed(2) + '/秒' },
    crit: { name: '暴击率', per: 0.02, max: 15, base: 50, fmt: (v) => Math.round(v * 100) + '%' },
    critDmg: { name: '暴击伤害', per: 0.1, max: 15, base: 50, fmt: (v) => Math.round(v * 100) + '%' },
    luck: { name: '幸运', per: 0.05, max: 10, base: 60, fmt: (v) => '+' + Math.round(v * 100) + '%' },
  };
  TD.data.attributeGrowth = 1.2;
  TD.data.attributeCost = (key, lv) => TD.util.round5(TD.data.attributes[key].base * Math.pow(TD.data.attributeGrowth, lv));

  // 城墙升级（设计书 18.6）。level 字段：城墙等级从 1 开始，其余从 0 开始
  TD.data.wallUpgrades = {
    level: {
      name: '城墙等级',
      max: 30,
      start: 1,
      cost: (lv) => TD.util.round5(60 * Math.pow(1.18, lv - 1)),
      desc: '提升城墙最大血量（每级 ×1.1）。',
    },
    fortify: {
      name: '加固',
      max: 10,
      start: 0,
      per: 0.03,
      cost: (lv) => TD.util.round5(80 * Math.pow(1.25, lv)),
      desc: '城墙受到的伤害 −3% / 级。',
    },
    mend: {
      name: '修缮',
      max: 5,
      start: 0,
      per: 0.02,
      cost: (lv) => TD.util.round5(100 * Math.pow(1.3, lv)),
      desc: '每波结束回复 2% 最大血量 / 级。',
    },
    thorns: {
      name: '荆棘',
      max: 5,
      start: 0,
      per: 0.2,
      cost: (lv) => TD.util.round5(120 * Math.pow(1.3, lv)),
      desc: '攻击城墙的怪受到英雄攻击力 ×20% / 级的反弹伤害。',
    },
  };

  TD.data.items = {
    bomb: { name: '小炸弹', cost: { copper: 30 }, atkMult: 5, targetLane: true, desc: '对选定车道上所有怪造成攻击力 ×5 的伤害。' },
    patch: { name: '修补包', cost: { copper: 40 }, healRatio: 0.15, desc: '城墙回复 15% 最大血量。' },
    haste: { name: '加速药水', cost: { copper: 35 }, aspdBonus: 0.4, duration: 10, desc: '攻击速度 +40%，持续 10 秒。' },
    freeze: { name: '冰冻瓶', cost: { copper: 35 }, duration: 3, targetLane: true, desc: '冻结选定车道上的所有怪 3 秒。' },
    charm: { name: '幸运符', cost: { silver: 1 }, copperBonus: 0.3, passive: true, desc: '战斗开始时自动生效：本关铜币收益 +30%。' },

    // ---- v0.54 消耗品扩充（设计书 62）：越强越贵，铜 → 银 → 金 ----
    firebomb: { name: '燃烧瓶', cost: { copper: 80 }, atkMult: 3, targetLane: true, desc: '对选定车道上所有怪造成攻击力 ×3 的魔法伤害，并点燃它们。' },
    thunderScroll: { name: '雷霆符', cost: { silver: 2 }, atkMult: 6, count: 5, desc: '全场血量最高的 5 只怪各被一道闪电劈中，每道攻击力 ×6 的魔法伤害。' },
    bigBomb: { name: '重磅炸弹', cost: { silver: 3 }, atkMult: 10, targetLane: true, desc: '选定车道和相邻车道上所有怪受到攻击力 ×10 的伤害。' },
    barrier: { name: '守护符文', cost: { silver: 3 }, shieldRatio: 0.5, desc: '城墙获得一层护盾，能吸收 50% 最大血量的伤害，持续到本关结束。' },
    warBanner: { name: '战旗', cost: { silver: 3 }, atkBonus: 0.4, duration: 10, desc: '英雄攻击力 +40%，持续 10 秒。' },
    quake: { name: '地震符', cost: { silver: 4 }, atkMult: 5, stun: 3, bossStun: 1.5, desc: '全场怪物眩晕 3 秒（Boss 1.5 秒），并受到攻击力 ×5 的伤害。' },
    blizzard: { name: '暴风雪卷轴', cost: { gold: 1 }, duration: 8, bossDuration: 4, slowAfter: 0.6, slowTime: 5, shatter: 1, desc: '冰冻全体怪物 8 秒（Boss 4 秒），冻住期间它们受到的伤害翻倍，解冻后再减速 60%，持续 5 秒。' },
    flood: { name: '洪水', cost: { gold: 1 }, push: 500, bossPush: 150, atkMult: 4, slow: 0.7, slowTime: 6, shatter: 0.6, desc: '洪水冲过战场：全体怪物向后倒退 500 像素（Boss 150 像素），受到攻击力 ×4 的伤害，被浸湿的怪物 6 秒内受到的伤害 +60%，并减速 70%。' },
    holyLight: { name: '圣光', cost: { gold: 2 }, healRatio: 1, drAmt: 0.8, drDuration: 10, desc: '城墙回满血，之后 10 秒城墙受到的伤害 −80%。' },
    meteor: { name: '陨石雨', cost: { gold: 2 }, count: 18, duration: 3, atkMult: 12, radius: 110, splashMult: 0.6, desc: '18 颗陨石落在全场随机的怪身上，每颗攻击力 ×12 的伤害，周围 110 像素内的怪受到六成。' },
    chrono: { name: '时间静止', cost: { gold: 3 }, duration: 10, aspdBonus: 1, shatter: 2, desc: '冻结全体怪物 10 秒，连 Boss 也一起冻住，冻住期间它们受到的伤害 ×3；这期间英雄攻击速度 +100%。' },
  };

  TD.data.equipment = {
    ironHelm: { name: '铁皮盔', slot: 'helm', rarity: 'common', cost: { copper: 120 }, stats: { atkFlat: 3 }, desc: '攻击力 +3' },
    shineHelm: {
      name: '闪光盔',
      slot: 'helm',
      rarity: 'rare',
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
      rarity: 'rare',
      cost: { silver: 8 },
      stats: { aspdPct: 0.15, wallDr: 0.1 },
      desc: '攻击速度 +15%，城墙受到伤害 −10%',
    },
    clover: { name: '四叶草', slot: 'trinket', rarity: 'common', cost: { copper: 100 }, stats: { luck: 0.15 }, desc: '幸运 +15%' },
    fang: { name: '狼牙项链', slot: 'trinket', rarity: 'common', cost: { copper: 140 }, stats: { critDmg: 0.25 }, desc: '暴击伤害 +25%' },
    eagleEye: { name: '鹰眼坠', slot: 'trinket', rarity: 'rare', cost: { silver: 6 }, stats: { rangePct: 0.1 }, desc: '射程 +10%' },

    // ---- v0.50 装备扩充（设计书 58）：minLevel = 通关第几关后上架；mods 进入战斗时并入战场修正 ----
    dragonHelm: { name: '屠龙盔', slot: 'helm', rarity: 'rare', cost: { silver: 7 }, minLevel: 10, stats: { atkFlat: 3 }, mods: { bossDmg: 0.2 }, desc: '攻击力 +3；对 Boss（含触手）伤害 +20%' },
    owlHelm: { name: '夜枭盔', slot: 'helm', rarity: 'rare', cost: { silver: 6 }, minLevel: 20, stats: { crit: 0.04 }, mods: { darkSight: 0.5 }, desc: '暴击率 +4%；暗夜关的射程惩罚减半' },
    frostHelm: { name: '寒铁盔', slot: 'helm', rarity: 'rare', cost: { silver: 7 }, minLevel: 30, stats: { atkFlat: 3 }, mods: { frostExt: 0.3 }, set: 'frost', desc: '攻击力 +3；冰冻领域、冰冻瓶持续时间 +30%' },
    windCape: { name: '疾风披风', slot: 'cape', rarity: 'common', cost: { copper: 260 }, minLevel: 4, stats: { aspdPct: 0.06 }, mods: { flyDmg: 0.15 }, desc: '攻击速度 +6%；对飞行怪伤害 +15%' },
    emberCape: { name: '余烬斗篷', slot: 'cape', rarity: 'rare', cost: { silver: 8 }, minLevel: 40, stats: { aspdPct: 0.08 }, mods: { igniteChance: 0.2 }, desc: '攻击速度 +8%；普通攻击 20% 几率点燃目标' },
    tideCape: { name: '潮汐斗篷', slot: 'cape', rarity: 'rare', cost: { silver: 8 }, minLevel: 60, stats: { aspdPct: 0.08, wallDr: 0.08 }, mods: { mendBonus: 0.02 }, set: 'tide', desc: '攻击速度 +8%，城墙受到伤害 −8%；每波结束城墙多回复 2%' },
    leatherQuiver: { name: '皮箭袋', slot: 'quiver', rarity: 'common', cost: { copper: 500 }, minLevel: 15, stats: { critDmg: 0.15 }, desc: '暴击伤害 +15%' },
    barbQuiver: { name: '倒钩箭袋', slot: 'quiver', rarity: 'common', cost: { copper: 700 }, minLevel: 15, stats: { atkPct: 0.05 }, desc: '攻击力 +5%' },
    pierceQuiver: { name: '破甲箭袋', slot: 'quiver', rarity: 'rare', cost: { silver: 6 }, minLevel: 15, stats: {}, mods: { armorIgnore: 0.2 }, desc: '无视目标 20% 护甲' },
    spiritQuiver: { name: '灵光箭袋', slot: 'quiver', rarity: 'rare', cost: { silver: 6 }, minLevel: 21, stats: { crit: 0.03 }, mods: { spiritPierce: 0.25 }, desc: '暴击率 +3%；物理伤害对灵体的效果 +25%' },
    frostQuiver: { name: '霜羽箭袋', slot: 'quiver', rarity: 'rare', cost: { silver: 6 }, minLevel: 30, stats: {}, mods: { slowOnHit: 0.15 }, set: 'frost', desc: '普通攻击使目标减速 15%（1.5 秒）' },
    thunderQuiver: { name: '雷鸣箭袋', slot: 'quiver', rarity: 'legend', cost: { gold: 3 }, minLevel: 25, stats: {}, zap: { every: 6, atkMult: 1.5 }, desc: '每第 6 次攻击，一道小闪电落在目标身上，额外造成攻击力 ×1.5 的魔法伤害' },
    coinCharm: { name: '招财坠', slot: 'trinket', rarity: 'common', cost: { copper: 180 }, minLevel: 6, stats: {}, mods: { copperBonus: 0.1 }, desc: '本关铜币收益 +10%' },
    rageBadge: { name: '背水徽章', slot: 'trinket', rarity: 'rare', cost: { silver: 6 }, minLevel: 15, stats: {}, mods: { lowWallAtk: 0.2 }, desc: '城墙血量低于 50% 时，攻击力 +20%' },
    hourglass: { name: '时之沙漏', slot: 'trinket', rarity: 'legend', cost: { gold: 3 }, minLevel: 35, stats: {}, mods: { cdMult: -0.15 }, desc: '主动技能冷却 −15%' },
    shellCharm: { name: '贝壳护符', slot: 'trinket', rarity: 'rare', cost: { silver: 6 }, minLevel: 61, stats: { wallDr: 0.06 }, mods: { healBonus: 0.25 }, set: 'tide', desc: '城墙受到伤害 −6%；城墙回血效果 +25%' },
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
    quiver: [15],
    active: [0, 5, 20],
    passive: [3, 10, 30],
    item: [2, 6, 8],
  };

  // 战场补给卡（设计书 2.7、18.12）：mods 中的字段由战斗逻辑读取
  TD.data.supplies = {
    sharp: { name: '磨利箭头', desc: '攻击力 +10%', mods: { atkMult: 0.1 }, icon: 'arrowUp' },
    quick: { name: '灵巧手指', desc: '攻击速度 +10%', mods: { aspdMult: 0.1 }, icon: 'haste' },
    eagle: { name: '鹰之眼', desc: '暴击率 +8%', mods: { crit: 0.08 }, icon: 'eye' },
    fury: { name: '狂热', desc: '暴击伤害 +25%', mods: { critDmg: 0.25 }, icon: 'fury' },
    bricks: { name: '加固砖块', desc: '立即回复城墙 20%，城墙受到伤害 −8%', mods: { wallDr: 0.08 }, heal: 0.2, icon: 'repair' },
    master: { name: '技能大师', desc: '主动技能冷却 −20%，并立即刷新所有冷却', mods: { cdMult: -0.2 }, refresh: true, needSkills: true, icon: 'master' },
    purse: { name: '铜币袋', desc: '本关铜币收益 +25%', mods: { copperBonus: 0.25 }, icon: 'purse' },
    frostTip: { name: '寒霜箭头', desc: '普通攻击使目标减速 20%，持续 1.5 秒', mods: { slowOnHit: 0.2 }, icon: 'frost' },
    farsight: { name: '远望', desc: '射程 +12%', mods: { range: 0.12 }, icon: 'eye' },
    arcane: { name: '奥术涌动', desc: '魔法伤害 +20%', mods: { magicMult: 0.2 }, icon: 'staff', minLevel: 11 },
    breaker: { name: '破甲箭头', desc: '无视目标 25% 护甲', mods: { armorIgnore: 0.25 }, icon: 'cannon', minLevel: 11 },
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
  TD.data.supplyBotOrder = ['sharp', 'quick', 'master', 'handWarmer', 'fireTip', 'obsidian', 'lens', 'extinguisher', 'lightningRod', 'windFlag', 'shears', 'pin', 'crowbar', 'net', 'arcane', 'breaker', 'exorcism', 'antidote', 'flare', 'eagle', 'fury', 'frostTip', 'farsight', 'bricks', 'purse'];

  TD.data.targetModes = {
    nearest: '最近优先',
    smart: '威胁优先',
    weakest: '最弱优先',
    strongest: '最强优先',
    flying: '飞行优先',
    boss: 'Boss 优先',
  };
})((globalThis.TD = globalThis.TD || {}));
