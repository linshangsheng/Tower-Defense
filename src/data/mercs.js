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
    trampleReach: 24, // 冲阵：贴身前排的判定范围（在接触距离之外再加这么多）
    trampleGuard: 0.5, // 冲阵：盾卫（嘲讽 + 减伤）的眩晕时间倍率
    trampleGrace: 1.5, // 冲阵：眩晕结束后这么久不会被再次眩晕（免得几只大怪把兵锁死）
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
      desc: '举着大盾的肉盾：受到的伤害减少 35%，怪物最先打它。站在它身后的弓手、法师、牧师受到的伤害 −30%（盾墙）。被大块头怪物撞晕时，眩晕时间减半。',
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
    // 工程兵（第 7 个兵种）：自己几乎不打架，职责是布置陷阱。
    // trap：every 布置间隔（秒）、max 同车道最多几个、dmg 陷阱伤害（× 兵的强度系数）、aoe 溅射半径、slow / slowDur 踩中后的减速、wallHeal 每次布置给城墙回的血量比例、life 陷阱存在秒数
    engineer: {
      name: '工程兵', icon: '🔧', color: '#ffc857', unlock: 75, cost: 50, cd: 12,
      hp: 32, dmg: 4, every: 1.4, range: 26, speed: 52, type: 'phys', keep: 90,
      trap: { every: 4.5, max: 3, dmg: 40, aoe: 34, slow: 0.45, slowDur: 2.5, wallHeal: 0.002, life: 30 },
      desc: '自己几乎不打架：每隔几秒在身前的地面布置一个尖刺陷阱（同车道最多 3 个），怪物踩上去受伤并短暂减速，触发后消失。每次布置还会给城墙修补 0.2% 的血。',
    },
  };
  TD.data.mercOrder = ['swordsman', 'guard', 'archer', 'mage', 'cleric', 'knight'];
  // 完整兵种表（兵营和解锁用）：mercOrder 保持原来的六个，新兵种从这里接入
  TD.data.mercOrderExt = TD.data.mercOrder.concat(['engineer']);
})((globalThis.TD = globalThis.TD || {}));
