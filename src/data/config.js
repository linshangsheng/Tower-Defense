// 全局常量与公式（设计书 2.1、5.3、8.2、18.1）
(function (TD) {
  'use strict';

  TD.config = {
    // 战斗画面逻辑分辨率
    width: 1280,
    height: 720,
    wallX: 170, // 城墙右边缘
    spawnX: 1290, // 怪物入场位置
    fieldTop: 96, // 车道区域上边界
    fieldBottom: 628, // 车道区域下边界
    heroX: 110,
    heroY: 0, // 运行时根据车道计算
    // 波次节奏（设计书 2.3）
    waveClearDelay: 4,
    waveMaxDelay: 18,
    earlyCallCopperPerSec: 1,
    // "威胁优先"的危险区：怪物离城墙这么近时优先打它
    smartDanger: 220,
    // 每秒模拟步数
    tickRate: 60,

    // 关卡难度系数 D(n)
    // 第 70 关以后（设计书 75.4）：英雄的属性上限已到，系数改为缓慢增长，每关 +1%（第 100 关是第 70 关的 1.3 倍）
    difficulty(n) {
      const f = (m) => 1 + 0.15 * (m - 1) + 0.0035 * (m - 1) * (m - 1);
      if (n <= 70) return f(n);
      return f(70) * (1 + 0.01 * (n - 70));
    },

    // 怪物的其他属性随关卡增强（v1.15）：生命和攻击早就乘难度 D；护甲 / 魔抗 和移动速度原来是固定值，现在也跟着关卡涨。
    // 护甲 / 魔抗：第 10 关 ×1.2、第 50 关 ×1.7、第 100 关 ×2.1、第 200 关 ×2.4；移动速度：第 50 关 ×1.14、第 100 关 ×1.22、第 200 关 ×1.30。
    // 护甲涨到 armorCap（120）为止——本来就比 120 高的不再涨（否则魔抗 250 的熔岩傀儡会打不动）
    monsterScale(n) {
      return { armor: 1 + 1.5 * (1 - Math.exp(-n / 80)), speed: 1 + 0.35 * (1 - Math.exp(-n / 100)) };
    },
    armorCap: 120,
    scaledArmor(base, mult) {
      if (!base || mult <= 1) return base || 0;
      return Math.max(base, Math.min(base * mult, this.armorCap));
    },

    hero: {
      atk: 10,
      aspd: 1.0,
      crit: 0.05,
      critDmg: 1.5,
      rangeRatio: 0.6,
      luck: 0,
    },

    // 游戏版本：与设计书版本号、sw.js 的缓存名保持一致（测试会检查）
    version: 'v1.23',

    // 英雄（设计书 42）：在 hero 基础值上乘以倍率；所有升级共用
    heroes: {
      dang: { name: 'Kael', role: '均衡', atkMult: 1, aspdMult: 1, desc: '王国最小的守城卫兵，攻击稳定。' },
      ding: { name: 'Lyra', role: '快攻 · 控制', atkMult: 0.82, aspdMult: 1.2, unlock: 20, bell: { every: 10, radius: 100, stun: 0.5 }, desc: 'Kael的妹妹。攻击力 ×0.82、攻速 ×1.2；每第 10 次攻击敲响铃铛，眩晕目标周围的小怪 0.5 秒。' },
      // v0.51 新英雄（设计书 59）：mods 进入战斗时并入战场修正
      yan: { name: 'Atlas', role: '守护城墙', atkMult: 0.97, aspdMult: 1.0, unlock: 10, mods: { wallDr: 0.12, mendBonus: 0.03 }, desc: '石匠的儿子，背着一面大石盾。攻击力 ×0.97；城墙受到伤害 −12%，每波结束多修 3% 城墙。' },
      ying: { name: 'Nova', role: '暗夜 · 灵体', atkMult: 0.92, aspdMult: 1.05, unlock: 30, mods: { darkSight: 1, spiritPierce: 0.2 }, fireflies: { every: 12, count: 3, atkMult: 0.6 }, desc: '沼泽里提着萤火灯的女孩。攻击力 ×0.92、攻速 ×1.05；暗夜里射程不减，物理伤害对灵体 +20%；每第 12 次攻击放出 3 只萤火虫（各造成攻击力 ×0.6 的魔法伤害）。' },
      mu: { name: 'Rowan', role: '重箭 · 破甲', atkMult: 1.5, aspdMult: 0.73, unlock: 40, mods: { armorIgnore: 0.25 }, knockOnHit: 12, desc: '森林的守林人，背着一张比他还高的长弓。攻击力 ×1.5、攻速 ×0.73；重箭无视 25% 护甲，并把普通怪物向后推 12 像素。' },
    },

    wall: {
      baseHp: 1000,
      hpGrowth: 1.1,
    },

    // Boss 血量倍率（v0.97）：Boss 太好打了，主线 / 精英 / 回声关的 Boss 血量 ×3；v1.13 起九层妖塔的妖王血量和关卡 Boss 一样厚（也是 ×3，难度按通关进度折算，逐层 ×1.2）
    bossHpMult: 3,
    towerBossHpMult: 3,

    // 关卡奖励（设计书 5.3）
    rewards: {
      // 通关奖励随关卡越来越丰厚（v0.95）：原来 40 + 10n（第 100 关才 1040），现在 50 + 15n + 0.9n²（第 100 关 10550）
      baseCopper: (n) => Math.round(50 + 15 * n + 0.9 * n * n),
      starMult: [0, 1, 1.25, 1.5],
      repeatMult: 0.5,
      failMult: 0.15,
      firstClearSilver: 1,
      firstThreeStarSilver: 1,
      miniBossCopperMult: 2,
      miniBossSilver: 3,
      bossCopperMult: 3,
      bossSilver: 10,
      bossGold: 3,
      chapterAllStarsGold: 2,
    },

    // 援军鼓舞（设计书 27.5）：同一关每连续失败一次，英雄攻击和城墙血量 +per，最多 cap；通关后清零
    rally: { per: 0.05, cap: 0.25 },

    // 难度（设计书 27.3）
    difficulties: {
      easy: { name: '轻松', hp: -0.25, dmg: -0.25, copper: 0, desc: '怪物血量和攻城伤害 −25%，适合想轻松看剧情的玩家' },
      normal: { name: '标准', hp: 0, dmg: 0, copper: 0, desc: '设计的标准体验' },
      hard: { name: '挑战', hp: 0.3, dmg: 0.15, copper: 0.2, desc: '怪物血量 +30%、攻城伤害 +15%，铜币收益 +20%' },
    },

    stars: [
      // [星级, 城墙剩余血量比例下限]
      [3, 0.8],
      [2, 0.5],
      [1, 0],
    ],

    // 主线第 N 关（N ≥ extraFromLevel）整关总共多出 N × extraMonstersPerLevel 只小怪（设计书 84）
    extraFromLevel: 5,
    extraMonstersPerLevel: 5,
    extraMaxLevel: 100, // 第 100 关以后（深渊回响）多出的小怪不再增加，保持 500 只（设计书 112）

    // 回归的小 Boss（设计书 110）：第 returnBossFromLevel 关起，普通小关卡有 returnBossChance 的几率混进一个之前见过的小 Boss
    // （第 returnBossLateFrom 关起有 returnBossSecondChance 的几率再来第二个）；血量 × returnBossHpMult；击败后奖励 returnBossSilver 银币
    returnBossFromLevel: 51,
    returnBossChance: 0.6,
    returnBossLateFrom: 80,
    returnBossSecondChance: 0.3,
    returnBossHpMult: 0.6,
    returnBossSilver: 1,

    exchange: {
      copperPerSilver: 100,
      silverPerGold: 100,
      // 汇兑所一次可以换的数量（设计书 85）：铜币不够的档位按钮置灰
      amounts: [1, 10, 100, 1000],
      // 钻石只能在九层妖塔里获得（设计书 74）
      diamondObtainable: true,
    },
  };

  TD.config.fieldWidth = TD.config.width - TD.config.wallX; // 1110
})((globalThis.TD = globalThis.TD || {}));
