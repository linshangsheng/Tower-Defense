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

    // 英雄（设计书 42）：在 hero 基础值上乘以倍率；所有升级共用
    heroes: {
      dang: { name: '铛铛', atkMult: 1, aspdMult: 1, desc: '王国最小的守城卫兵，攻击稳定。' },
      ding: { name: '叮叮', atkMult: 0.82, aspdMult: 1.2, unlock: 20, bell: { every: 10, radius: 100, stun: 0.5 }, desc: '铛铛的妹妹。攻击力 ×0.82、攻速 ×1.2；每第 10 次攻击敲响铃铛，眩晕目标周围的小怪 0.5 秒。' },
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

    exchange: {
      copperPerSilver: 100,
      silverPerGold: 50,
    },
  };

  TD.config.fieldWidth = TD.config.width - TD.config.wallX; // 1110
})((globalThis.TD = globalThis.TD || {}));
