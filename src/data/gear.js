// 武器、技能、装备、消耗品、属性与城墙升级（设计书 18.1–18.3、18.6–18.8）
(function (TD) {
  'use strict';

  TD.data = TD.data || {};

  TD.data.weapons = {
    bow: {
      name: '木弓',
      cost: null,
      dmgMult: 1.0,
      aspdMult: 1.0,
      projSpeed: 900,
      bonusCrit: 0.05,
      desc: '单发，稳定，自带额外暴击率。打 Boss 好用。',
      good: '通用、Boss',
      ascend: { name: '雕花长弓', desc: '射程 +10%，暴击伤害 +30%', stats: { rangePct: 0.1, critDmg: 0.3 } },
    },
    crossbow: {
      name: '连发弩',
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
      cost: { copper: 450 },
      dmgMult: 0.8,
      aspdMult: 0.6,
      projSpeed: 750,
      boomerang: true,
      desc: '沿车道飞出再飞回，往返各命中每只怪一次。返程从背后命中，无视盾牌。',
      good: '排成长队的车道、木盾哥布林',
      ascend: { name: '双刃回旋镖', desc: '同时扔出 2 支：目标车道和相邻车道各一支', weapon: { twin: true } },
    },
    staff: {
      name: '魔法杖',
      cost: { silver: 8 },
      dmgMult: 0.9,
      aspdMult: 0.85,
      projSpeed: 700,
      dmgType: 'magic',
      splash: { radius: 60, mult: 0.6 },
      desc: '发射魔法弹，命中后小范围爆炸。魔法伤害无视物理护甲。',
      good: '绷带球、护盾、成堆的小怪',
      ascend: { name: '星辰法杖', desc: '爆炸半径 60 → 85，溅射伤害 60% → 75%', weapon: { splash: { radius: 85, mult: 0.75 } } },
    },
    cannon: {
      name: '火炮',
      cost: { silver: 10 },
      dmgMult: 2.6,
      aspdMult: 0.35,
      projSpeed: 600,
      arc: true,
      splash: { radius: 80, mult: 0.7 },
      armorIgnore: 0.4,
      desc: '慢速重炮，落地大范围爆炸，无视目标 40% 护甲。',
      good: '重甲怪、成团的怪、Boss',
      ascend: { name: '攻城火炮', desc: '无视护甲 40% → 70%，溅射伤害 70% → 85%', weapon: { armorIgnore: 0.7, splash: { radius: 80, mult: 0.85 } } },
    },
    orb: {
      name: '雷电法球',
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
  };

  TD.data.rarityNames = { common: '普通', rare: '精良', legend: '传说' };

  // 配装栏位解锁：通关某关后解锁（0 表示初始）
  TD.data.slotUnlocks = {
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
  };
  TD.data.supplyBotOrder = ['sharp', 'quick', 'master', 'handWarmer', 'fireTip', 'obsidian', 'lens', 'extinguisher', 'lightningRod', 'windFlag', 'shears', 'arcane', 'breaker', 'exorcism', 'antidote', 'flare', 'eagle', 'fury', 'frostTip', 'farsight', 'bricks', 'purse'];

  TD.data.targetModes = {
    nearest: '最近优先',
    smart: '威胁优先',
    weakest: '最弱优先',
    strongest: '最强优先',
    flying: '飞行优先',
    boss: 'Boss 优先',
  };
})((globalThis.TD = globalThis.TD || {}));
