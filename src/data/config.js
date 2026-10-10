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
    // 每秒模拟步数
    tickRate: 60,

    // 关卡难度系数 D(n)
    difficulty(n) {
      const k = n - 1;
      return 1 + 0.15 * k + 0.0035 * k * k;
    },

    hero: {
      atk: 10,
      aspd: 1.0,
      crit: 0.05,
      critDmg: 1.5,
      rangeRatio: 0.6,
      luck: 0,
    },

    wall: {
      baseHp: 1000,
      hpGrowth: 1.1,
    },

    // 关卡奖励（设计书 5.3）
    rewards: {
      baseCopper: (n) => 40 + 10 * n,
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

    stars: [
      // [星级, 城墙剩余血量比例下限]
      [3, 0.8],
      [2, 0.5],
      [1, 0],
    ],

    exchange: {
      copperPerSilver: 100,
      silverPerGold: 50,
    },
  };

  TD.config.fieldWidth = TD.config.width - TD.config.wallX; // 1110
})((globalThis.TD = globalThis.TD || {}));
