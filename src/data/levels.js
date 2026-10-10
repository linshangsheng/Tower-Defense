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
  ];

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
  };

  TD.data.levelTypeNames = {
    tutorial: '教学',
    normal: '普通',
    raid: '空袭',
    rush: '速攻',
    miniboss: '小 Boss',
    boss: '大 Boss',
  };
})((globalThis.TD = globalThis.TD || {}));
