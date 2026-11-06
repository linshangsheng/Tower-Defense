// 雇佣兵（设计书 184）：花"军饷"在战场上雇佣兵，雇来的兵会主动出击、和怪物对砍
// 所有数值是"基础值"，实际值 = 基础值 × 本关难度系数 D × C.merc.power × 兵种等级加成
(function (TD) {
  'use strict';

  TD.data = TD.data || {};

  // 全局参数
  TD.config.merc = {
    power: 1.4, // 兵的强度相对怪物同关强度的比例
    startFunds: 60, // 开场军饷
    fundsRate: 1, // 击败怪物时，军饷按铜币的这个比例增加
    cap: 6, // 同屏最多几个兵
    perLevel: 0.12, // 每升一级，血量和伤害增加的比例
    maxLevel: 10,
    leashX: 780, // 兵最远追到这里（再远就退回来，免得冲进怪堆送死）
    postX: 250, // 没目标时的待命位置（城墙前）
    contactPad: 22, // 怪物贴住兵的距离
    deployX: 215, // 刚雇来的兵出现的位置
    monsterHp: 0.55, // 开了雇佣兵的战斗里，怪物血量 +55%（兵来帮忙，怪就更多更硬）
    monsterDps: 0.3, // 怪物攻击 +30%
    bossCleave: 0.8, // Boss 对身边的兵每秒造成 自身攻击 × 这个值 的伤害
    rangedAtMercs: 420, // 远程怪优先打射程内的兵
    rallyCd: 15, // 集结令冷却（秒）
    vetEvery: 3, // 每击败这么多只怪晋升一级（老兵）
    vetMax: 3,
    vetBoost: 0.15, // 每级老兵：血量和伤害 +15%，晋升时回复 30% 血
    shieldWall: 0.3, // 盾墙：盾卫在前面时，后排兵受到的伤害 −30%
    shieldWallRange: 200, // 盾卫在后排兵前方多远以内算"挡在前面"
    upgradeBase: 120, // 升级铜币：base × 1.7^(level-1)
    upgradeGrow: 1.7,
    // 英雄与兵的联动（羁绊）：on=false 时全部关闭（A/B 对比用）
    link: {
      on: true,
      aspdPer: 0.03, // 场上每有 1 个活着的兵，英雄攻速 +3%
      aspdCap: 0.15, // 上限 +15%
      drumShare: 0.5, // 战鼓：兵获得英雄战鼓加成的这个比例（攻击间隔缩短）
      repairShare: 0.5, // 城墙修复：兵回复 城墙回复比例 × 这个值 的最大血量
      coverMult: 1.15, // 掩护射击：箭雨命中兵身边的怪，伤害 ×1.15
      coverRange: 110, // 兵身边多远算"掩护"（同车道，横向距离）
      ultInvuln: 2, // 万箭天降：兵无敌秒数
    },
  };

  // type：'phys' / 'magic'；ranged 远程；aoe 溅射半径；taunt 嘲讽（怪物优先打它）；reduce 减伤
  TD.data.mercs = {
    swordsman: {
      name: '剑士', icon: '⚔️', color: '#e6e6f2', unlock: 6, cost: 30, cd: 6,
      hp: 60, dmg: 14, every: 0.9, range: 26, speed: 78, type: 'phys',
      desc: '冲在前面的近战兵：血厚度适中，砍得快。便宜、好用、随时补。',
    },
    guard: {
      name: '盾卫', icon: '🛡️', color: '#8fb4e8', unlock: 12, cost: 45, cd: 10,
      hp: 170, dmg: 6, every: 1.2, range: 26, speed: 48, type: 'phys', taunt: true, reduce: 0.35,
      desc: '举着大盾的肉盾：受到的伤害减少 35%，怪物最先打它。站在它身后的弓手、法师、牧师受到的伤害 −30%（盾墙）。',
    },
    archer: {
      name: '弓手', icon: '🏹', color: '#9be08a', unlock: 18, cost: 40, cd: 8,
      hp: 36, dmg: 12, every: 1.1, range: 340, speed: 55, type: 'phys', ranged: true, keep: 150,
      desc: '远程输出：站在后面射箭，也能打到飞行怪；怪物靠近会往回退。血很脆，要有人挡在前面。',
    },
    mage: {
      name: '法师', icon: '🔮', color: '#c49bff', unlock: 30, cost: 70, cd: 14,
      hp: 30, dmg: 22, every: 2.2, range: 300, speed: 50, type: 'magic', ranged: true, keep: 170, aoe: 75,
      desc: '范围魔法：每一发炸一片，是清小怪的利器，魔法对付物理护甲高的怪也有效。非常脆。',
    },
    cleric: {
      name: '牧师', icon: '✨', color: '#ffe08a', unlock: 45, cost: 60, cd: 16,
      hp: 42, every: 1.6, range: 230, speed: 55, heal: 0.12, wallHeal: 0.004, support: true, keep: 130,
      desc: '跟在队伍后面治疗：每 1.6 秒给最伤的友军回 12% 血，还会顺手给城墙回一点。自己不打架。',
    },
    knight: {
      name: '骑士', icon: '🐎', color: '#ffb36b', unlock: 60, cost: 80, cd: 20,
      hp: 120, dmg: 20, every: 1.0, range: 30, speed: 78, type: 'phys', chargeSpeed: 240, charge: 3.5,
      desc: '重骑兵：出场先冲锋，撞上第一个怪时造成 3.5 倍的冲击伤害，然后留下来近战。',
    },
  };
  TD.data.mercOrder = ['swordsman', 'guard', 'archer', 'mage', 'cleric', 'knight'];
})((globalThis.TD = globalThis.TD || {}));
