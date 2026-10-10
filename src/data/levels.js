// 第一章关卡与波次（设计书 8.6、18.9）
// 每波：groups = [[怪物, 数量], ...]，同一波内多组交替入场；gap = 出怪间隔（秒）
(function (TD) {
  'use strict';

  TD.data = TD.data || {};

  const W = (gap, ...groups) => ({ gap, groups });

  TD.data.chapters = [
    {
      id: 1,
      name: '翠绿草原',
      theme: { sky: '#bfe8ff', ground: '#9fdc7c', ground2: '#8ccf6a', lane: '#b8e69a', accent: '#5aa845' },
      levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    },
    {
      id: 2,
      name: '黄金沙漠',
      theme: { sky: '#ffe2a8', ground: '#f2d38b', ground2: '#e9c677', lane: '#f5dc9c', accent: '#d9822b', desert: true },
      levels: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    },
  ];

  TD.data.chapterOf = function (n) {
    return TD.data.chapters.find((c) => c.levels.includes(n)) || TD.data.chapters[0];
  };

  TD.data.levels = {
    1: {
      name: '草原初战',
      type: 'tutorial',
      lanes: 1,
      waves: [W(2.4, ['slime', 5]), W(2.0, ['slime', 7]), W(1.6, ['slime', 10])],
      tip: '铛铛会自动攻击。绿团团走到城墙前就会开始啃城墙！',
    },
    2: {
      name: '兔子来了',
      type: 'tutorial',
      lanes: 2,
      waves: [
        W(2.0, ['slime', 6]),
        W(1.8, ['slime', 5], ['bunny', 3]),
        W(1.6, ['slime', 7], ['bunny', 4]),
        W(1.4, ['slime', 9], ['bunny', 6]),
      ],
      tip: '兔冲冲跑得很快。怪物会分散在不同车道上。',
    },
    3: {
      name: '三条小路',
      type: 'normal',
      lanes: 3,
      waves: [
        W(1.6, ['slime', 8]),
        W(1.5, ['slime', 6], ['bunny', 5]),
        W(1.4, ['slime', 9], ['bunny', 6]),
        W(1.2, ['bunny', 10]),
        W(1.1, ['slime', 12], ['bunny', 8]),
      ],
      tip: '通关后记得去商店升级攻击力！',
    },
    4: {
      name: '蘑菇林',
      type: 'normal',
      lanes: 3,
      waves: [
        W(1.6, ['slime', 6], ['mushroom', 3]),
        W(1.5, ['mushroom', 6], ['bunny', 4]),
        W(1.4, ['slime', 8], ['mushroom', 5]),
        W(1.3, ['mushroom', 7], ['bunny', 7]),
        W(1.1, ['slime', 10], ['mushroom', 8], ['bunny', 6]),
      ],
      tip: '蘑菇兵死亡时会让附近的怪加速。试试点击下方的「战鼓」技能！',
    },
    5: {
      name: '果冻王子',
      type: 'miniboss',
      lanes: 3,
      waves: [
        W(1.5, ['slime', 10]),
        W(1.4, ['slime', 6], ['mushroom', 5]),
        W(1.3, ['bunny', 10], ['mushroom', 4]),
        W(1.2, ['slime', 10], ['bunny', 6]),
        W(1.2, ['mushroom', 8], ['slime', 8]),
        W(1.5, ['jellyPrince', 1], ['slime', 8]),
      ],
      tip: '果冻王子挨打会分裂。范围伤害（箭雨、回旋镖）能快速清理小果冻。',
    },
    6: {
      name: '嗡嗡嗡',
      type: 'normal',
      lanes: 3,
      waves: [
        W(1.12, ['slime', 11], ['bee', 5]),
        W(0.96, ['bee', 14]),
        W(1.04, ['mushroom', 8], ['bee', 8]),
        W(0.96, ['bunny', 11], ['bee', 11]),
        W(0.88, ['slime', 14], ['bee', 14]),
        W(0.8, ['mushroom', 11], ['bee', 16]),
      ],
      tip: '嗡嗡蜂会飞，越过其他怪直扑城墙。连发弩对飞行怪伤害更高。',
    },
    7: {
      name: '蜂群空袭',
      type: 'raid',
      lanes: 3,
      waves: [
        W(0.72, ['bee', 16]),
        W(0.64, ['bee', 19], ['bunny', 5]),
        W(0.64, ['bee', 22]),
        W(0.56, ['bee', 24], ['slime', 8]),
        W(0.56, ['bee', 27]),
        W(0.48, ['bee', 32], ['mushroom', 8]),
      ],
      tip: '空袭关！试试把目标优先级切换为「飞行优先」，或者换上连发弩。',
    },
    8: {
      name: '哥布林前哨',
      type: 'normal',
      lanes: 3,
      waves: [
        W(1.28, ['slime', 11], ['goblin', 3]),
        W(1.2, ['goblin', 5], ['bunny', 8]),
        W(1.12, ['goblin', 5], ['mushroom', 8]),
        W(1.04, ['goblin', 7], ['bee', 14]),
        W(1.04, ['goblin', 8], ['slime', 14]),
        W(0.96, ['goblin', 8], ['bunny', 11], ['bee', 11]),
        W(0.88, ['goblin', 11], ['mushroom', 11], ['slime', 11]),
      ],
      tip: '木盾哥布林正面很硬。回旋镖返程、箭雨和「穿甲」都能对付它。',
    },
    9: {
      name: '兔子大迁徙',
      type: 'rush',
      lanes: 3,
      rushInterval: 14,
      waves: [
        W(0.63, ['bunny', 14]),
        W(0.54, ['bunny', 16], ['slime', 5]),
        W(0.54, ['bunny', 18]),
        W(0.45, ['bunny', 18], ['bee', 7]),
        W(0.45, ['bunny', 21], ['mushroom', 5]),
        W(0.36, ['bunny', 28]),
      ],
      tip: '速攻关：每 14 秒就来一波，不等你清场！冰冻领域能拖住兔子潮。',
    },
    10: {
      name: '咕噜大王',
      type: 'boss',
      lanes: 3,
      waves: [
        W(1.3, ['gobling', 10], ['goblin', 3]),
        W(1.2, ['slime', 10], ['goblin', 4], ['bee', 6]),
        W(2.0, ['boarKing', 1], ['gobling', 6]),
      ],
      tip: '咕噜大王血量低于 60% 后会冲锋。车道变红时集中火力打它，就能打断冲锋！',
    },

    // ---------- 第二章 · 黄金沙漠（设计书 19.5） ----------
    11: {
      name: '沙丘下的影子',
      type: 'normal',
      lanes: 3,
      waves: [
        W(0.9, ['slime', 11], ['scorpion', 4]),
        W(0.83, ['scorpion', 9], ['bunny', 9]),
        W(0.75, ['mushroom', 9], ['scorpion', 9]),
        W(0.75, ['goblin', 6], ['scorpion', 11]),
        W(0.68, ['scorpion', 13], ['bee', 11]),
        W(0.6, ['scorpion', 16], ['slime', 13], ['goblin', 4]),
      ],
      tip: '沙沙蝎会钻进地下躲避攻击，钻出来时已经离城墙很近了。箭雨和冰冻领域能帮你应对。',
    },
    12: {
      name: '绷带木乃伊',
      type: 'normal',
      lanes: 3,
      waves: [
        W(0.98, ['slime', 11], ['mummy', 2]),
        W(0.9, ['mummy', 6], ['bunny', 11]),
        W(0.83, ['scorpion', 8], ['mummy', 6]),
        W(0.83, ['mummy', 7], ['mushroom', 8]),
        W(0.75, ['mummy', 8], ['bee', 13]),
        W(0.75, ['scorpion', 11], ['mummy', 8]),
        W(0.68, ['mummy', 11], ['slime', 13], ['scorpion', 8]),
      ],
      tip: '绷带球不怕物理攻击。去商店用银币解锁「魔法杖」，或者带上雷霆一击、灼烧！',
    },
    13: {
      name: '第四条路',
      type: 'normal',
      lanes: 4,
      waves: [
        W(0.83, ['scorpion', 11], ['slime', 11]),
        W(0.75, ['bunny', 13], ['mummy', 6]),
        W(0.75, ['scorpion', 13], ['goblin', 6]),
        W(0.68, ['mummy', 8], ['bee', 15]),
        W(0.68, ['scorpion', 13], ['mushroom', 11]),
        W(0.6, ['mummy', 11], ['bunny', 15]),
        W(0.6, ['scorpion', 15], ['mummy', 11], ['bee', 11]),
      ],
      tip: '战场变成 4 条车道了。范围攻击和全场技能越来越重要。',
    },
    14: {
      name: '滚滚仙人掌',
      type: 'normal',
      lanes: 4,
      waves: [
        W(1.1, ['slime', 8], ['cactus', 4]),
        W(1.0, ['cactus', 8], ['scorpion', 6]),
        W(1.0, ['mummy', 5], ['cactus', 6]),
        W(0.9, ['cactus', 10], ['bunny', 10]),
        W(0.9, ['scorpion', 10], ['cactus', 8]),
        W(0.8, ['mummy', 8], ['cactus', 10]),
        W(0.7, ['cactus', 14], ['scorpion', 10], ['mummy', 4]),
      ],
      tip: '仙人掌球滚到城墙就会爆炸！一定要在远处把它们打掉。',
    },
    15: {
      name: '钳钳',
      type: 'miniboss',
      lanes: 4,
      waves: [
        W(1.0, ['scorpion', 10], ['slime', 8]),
        W(1.0, ['cactus', 8], ['mummy', 4]),
        W(0.9, ['scorpion', 12], ['bunny', 8]),
        W(0.9, ['mummy', 6], ['cactus', 8]),
        W(0.8, ['scorpion', 14], ['bee', 10]),
        W(0.8, ['mummy', 8], ['cactus', 10]),
        W(1.4, ['kingScorpion', 1], ['scorpion', 10]),
      ],
      tip: '钳钳会钻地换道突袭。看到沙尘预警时，准备好技能！',
    },
    16: {
      name: '秃鹫盘旋',
      type: 'raid',
      lanes: 4,
      waves: [
        W(0.64, ['vulture', 14]),
        W(0.56, ['vulture', 17], ['bee', 12]),
        W(0.56, ['vulture', 21], ['scorpion', 9]),
        W(0.48, ['vulture', 23], ['bee', 14]),
        W(0.48, ['vulture', 25], ['cactus', 9]),
        W(0.44, ['vulture', 29], ['bee', 21]),
        W(0.4, ['vulture', 37], ['mummy', 6]),
      ],
      tip: '空袭关！秃鹫飞得很快。连发弩和「飞行优先」是好选择。',
    },
    17: {
      name: '猫咪祭司',
      type: 'normal',
      lanes: 4,
      waves: [
        W(1.1, ['slime', 10], ['priest', 1]),
        W(1.0, ['mummy', 4], ['priest', 2], ['bunny', 8]),
        W(1.0, ['scorpion', 10], ['priest', 2]),
        W(0.9, ['mummy', 6], ['priest', 2], ['cactus', 6]),
        W(0.9, ['vulture', 10], ['priest', 2], ['slime', 8]),
        W(0.8, ['mummy', 6], ['priest', 3], ['scorpion', 10]),
        W(0.8, ['cactus', 12], ['priest', 3], ['bunny', 10]),
        W(0.7, ['mummy', 8], ['priest', 4], ['scorpion', 12]),
      ],
      tip: '小祭司会躲在后排给怪物回血。试试「最弱优先」或雷霆一击先解决它！',
    },
    18: {
      name: '木乃伊大军',
      type: 'armored',
      lanes: 4,
      waves: [
        W(1.2, ['mummy', 4], ['priest', 1]),
        W(1.1, ['mummy', 6], ['goblin', 3]),
        W(1.0, ['mummy', 6], ['priest', 2]),
        W(1.0, ['mummy', 7], ['goblin', 5]),
        W(0.9, ['mummy', 7], ['priest', 3]),
        W(0.9, ['mummy', 9], ['goblin', 5], ['priest', 2]),
        W(0.8, ['mummy', 9], ['cactus', 7], ['priest', 3]),
        W(0.8, ['mummy', 13], ['priest', 4]),
      ],
      tip: '重甲突击！魔法杖、火炮和「穿甲」是这一关的关键。',
    },
    19: {
      name: '沙暴前夜',
      type: 'normal',
      lanes: 4,
      waves: [
        W(1.0, ['scorpion', 8], ['vulture', 7]),
        W(0.9, ['mummy', 7], ['cactus', 7]),
        W(0.9, ['priest', 2], ['mummy', 5], ['bunny', 10]),
        W(0.8, ['vulture', 12], ['scorpion', 8]),
        W(0.8, ['mummy', 8], ['priest', 3], ['cactus', 7]),
        W(0.7, ['scorpion', 12], ['vulture', 10]),
        W(0.7, ['mummy', 10], ['priest', 3], ['cactus', 8]),
        W(0.6, ['scorpion', 12], ['vulture', 12], ['mummy', 8], ['priest', 2]),
      ],
      tip: '沙漠里所有的敌人都来了。先清掉小祭司和仙人掌球！',
    },
    20: {
      name: '胖法老',
      type: 'boss',
      lanes: 4,
      waves: [
        W(1.1, ['mummy', 6], ['scorpion', 8]),
        W(1.0, ['cactus', 10], ['vulture', 10], ['priest', 2]),
        W(2.0, ['pharaoh', 1], ['mummy', 4]),
      ],
      tip: '胖法老残血时会展开金字塔护盾——物理攻击几乎打不动，一定要带魔法输出！',
    },
  };

  TD.data.levelTypeNames = {
    tutorial: '教学',
    normal: '普通',
    raid: '空袭',
    rush: '速攻',
    miniboss: '小 Boss',
    boss: '大 Boss',
    armored: '重甲突击',
  };
})((globalThis.TD = globalThis.TD || {}));
