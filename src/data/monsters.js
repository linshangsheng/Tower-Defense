// 怪物数据（设计书 7.2、18.4、18.5）
// hp、dps 为基础值，实际值乘以 D(n)；speed 单位：像素 / 秒；dps：到达城墙后每秒伤害
(function (TD) {
  'use strict';

  TD.data = TD.data || {};

  TD.data.monsters = {
    slime: {
      name: '绿团团',
      hp: 26,
      speed: 38,
      dps: 6,
      armor: 0,
      copper: 1,
      size: 22,
      color: '#6fd36a',
      desc: '最基础的小怪，慢吞吞的。',
    },
    bunny: {
      name: '兔冲冲',
      hp: 15,
      speed: 105,
      dps: 4,
      armor: 0,
      copper: 1,
      size: 18,
      color: '#f4b6c9',
      desc: '跑得飞快，血很少。',
    },
    mushroom: {
      name: '蘑菇兵',
      hp: 40,
      speed: 52,
      dps: 7,
      armor: 0,
      copper: 2,
      size: 22,
      color: '#e8524a',
      onDeath: { type: 'spore', radius: 90, speedBonus: 0.4, duration: 3 },
      desc: '死亡时喷出孢子云，让附近的怪加速。尽量在远处打掉它。',
    },
    bee: {
      name: '嗡嗡蜂',
      hp: 18,
      speed: 75,
      dps: 3,
      armor: 0,
      copper: 1,
      size: 16,
      color: '#ffd23f',
      flying: true,
      desc: '成群飞行，越过其他怪直扑城墙。',
    },
    goblin: {
      name: '木盾哥布林',
      hp: 76,
      speed: 34,
      dps: 10,
      armor: 0,
      frontArmor: 80,
      copper: 3,
      size: 24,
      color: '#7cae5b',
      desc: '举着木盾，正面很硬。回旋镖返程和箭雨能绕过盾牌。',
    },
    gobling: {
      name: '哥布林小兵',
      hp: 22,
      speed: 55,
      dps: 5,
      armor: 0,
      copper: 1,
      size: 18,
      color: '#8cc06b',
      desc: '咕噜大王的跟班。',
    },
    minijelly: {
      name: '小果冻',
      hp: 15,
      speed: 50,
      dps: 4,
      armor: 0,
      copper: 0,
      size: 14,
      color: '#7fd0ff',
      desc: '果冻王子分裂出来的小果冻。',
    },
    jellyPrince: {
      name: '果冻王子',
      hp: 660,
      speed: 24,
      dps: 25,
      armor: 0,
      copper: 30,
      size: 46,
      color: '#5bbcf5',
      boss: 'mini',
      split: { every: 0.15, count: 2, deathCount: 4, child: 'minijelly' },
      desc: '小 Boss。血量每降低 15% 就分裂出小果冻，死亡时再分裂一次。',
    },
    boarKing: {
      name: '咕噜大王',
      hp: 2000,
      speed: 30,
      dps: 30,
      armor: 30,
      copper: 80,
      size: 54,
      color: '#9a6b4f',
      boss: 'major',
      ai: 'boarKing',
      desc: '大 Boss。会召唤小兵；血量低于 60% 后发动野猪冲锋，预警时集中火力可以打断。',
    },
    // ---------- 第二章 · 黄金沙漠（设计书 19.2、19.3） ----------
    scorpion: {
      name: '沙沙蝎',
      hp: 32,
      speed: 48,
      dps: 7,
      armor: 0,
      copper: 2,
      size: 20,
      color: '#e0a050',
      burrow: { at: 1050, until: 450, speedMult: 1.8 },
      desc: '走到半路会钻进地下（无法被攻击），快到城墙时才钻出来。',
    },
    mummy: {
      name: '绷带球',
      hp: 95,
      speed: 26,
      dps: 12,
      armor: 120,
      copper: 3,
      size: 24,
      color: '#efe4c8',
      desc: '缠满绷带，物理伤害减免 55%。用魔法打它！',
    },
    cactus: {
      name: '仙人掌球',
      hp: 30,
      speed: 62,
      dps: 0,
      armor: 0,
      copper: 2,
      size: 20,
      color: '#5fb85a',
      explode: { damage: 60 },
      desc: '滚到城墙就会爆炸，一次造成大量伤害。一定要在远处打掉。',
    },
    vulture: {
      name: '沙漠秃鹫',
      hp: 28,
      speed: 110,
      dps: 5,
      armor: 0,
      copper: 2,
      size: 20,
      color: '#8a6a50',
      flying: true,
      desc: '低空飞行，速度很快。',
    },
    priest: {
      name: '小祭司',
      hp: 42,
      speed: 36,
      dps: 4,
      armor: 0,
      copper: 3,
      size: 20,
      color: '#9a6bd5',
      healer: { radius: 130, pct: 0.04, holdX: 560 },
      desc: '躲在后排，不停给周围的怪回血。优先打掉它！',
    },
    kingScorpion: {
      name: '钳钳',
      hp: 850,
      speed: 26,
      dps: 22,
      armor: 40,
      copper: 40,
      size: 44,
      color: '#d9822b',
      boss: 'mini',
      ai: 'kingScorpion',
      desc: '小 Boss。会钻地换道突袭，贴到城墙后还会用大钳子猛夹。',
    },
    pharaoh: {
      name: '胖法老',
      hp: 2600,
      speed: 22,
      dps: 30,
      armor: 60,
      copper: 120,
      size: 52,
      color: '#ffd23f',
      boss: 'major',
      ai: 'pharaoh',
      desc: '大 Boss。会刮沙暴、召唤木乃伊并给它们回血，残血时展开金字塔护盾——护盾只怕魔法。',
    },
    // ---------- 第三章 · 迷雾沼泽（设计书 21.2、21.3） ----------
    ghost: {
      name: '小幽灵',
      hp: 34,
      speed: 50,
      dps: 8,
      armor: 0,
      physResist: 0.7,
      copper: 2,
      size: 20,
      color: '#e8f0ff',
      desc: '灵体：物理伤害只有 30% 效果。用魔法对付它！',
    },
    frog: {
      name: '毒蛙',
      hp: 40,
      speed: 45,
      dps: 0,
      armor: 0,
      copper: 3,
      size: 20,
      color: '#9a6bd5',
      ranged: { holdX: 480, every: 2, damage: 10, poison: { dps: 3, duration: 4 } },
      desc: '远程：停在远处向城墙吐毒液，让城墙持续中毒。',
    },
    stump: {
      name: '树桩怪',
      hp: 140,
      speed: 22,
      dps: 14,
      armor: 40,
      copper: 4,
      size: 26,
      color: '#8a6a4a',
      regen: { delay: 2, pct: 0.03 },
      desc: '又厚又硬，2 秒没挨打就会慢慢回血。集中火力一口气打掉。',
    },
    bat: {
      name: '蝙蝠',
      hp: 22,
      speed: 85,
      dps: 4,
      armor: 0,
      copper: 2,
      size: 16,
      color: '#7a5aa8',
      flying: true,
      laneHop: { every: 2.5 },
      desc: '飞行，并且每隔一会儿就换到相邻车道。',
    },
    pumpkin: {
      name: '南瓜头',
      hp: 50,
      speed: 40,
      dps: 9,
      armor: 0,
      copper: 2,
      size: 22,
      color: '#f08a24',
      deathSpawn: { type: 'minipumpkin', count: 3 },
      desc: '死亡时裂成 3 只跑得很快的小南瓜。',
    },
    minipumpkin: {
      name: '小南瓜',
      hp: 14,
      speed: 70,
      dps: 3,
      armor: 0,
      copper: 0,
      size: 13,
      color: '#f5a04a',
      desc: '南瓜头裂开后的小南瓜。',
    },
    boneMage: {
      name: '骨头先生',
      hp: 1300,
      speed: 24,
      dps: 25,
      armor: 0,
      copper: 50,
      size: 40,
      color: '#f2efe6',
      boss: 'mini',
      ai: 'boneMage',
      desc: '小 Boss。不停召唤小幽灵，第一次被击倒后还会复活！',
    },
    witch: {
      name: '毒汤婆婆',
      hp: 2800,
      speed: 20,
      dps: 30,
      armor: 0,
      copper: 150,
      size: 46,
      color: '#6fbf5f',
      boss: 'major',
      ai: 'witch',
      desc: '大 Boss。毒雾腐蚀城墙，把小怪煮成强化版，残血时倒翻大锅制造毒池。',
    },
    // ---------- 第四章 · 冰霜雪原（设计书 22.1、22.2） ----------
    snowman: {
      name: '雪团团',
      hp: 60,
      speed: 34,
      dps: 10,
      armor: 0,
      copper: 2,
      size: 22,
      color: '#f4f8ff',
      deathSpawn: { type: 'snowball', count: 2 },
      desc: '两个雪球叠成的小雪人，死后变成 2 个小雪团。',
    },
    snowball: {
      name: '小雪团',
      hp: 18,
      speed: 60,
      dps: 4,
      armor: 0,
      copper: 0,
      size: 14,
      color: '#f4f8ff',
      desc: '雪团团碎开后的小雪球。',
    },
    penguin: {
      name: '企鹅滑冲',
      hp: 40,
      speed: 120,
      dps: 6,
      armor: 0,
      copper: 2,
      size: 20,
      color: '#3b4a6b',
      slam: 25,
      desc: '肚皮着地高速滑行，撞上城墙时造成大量伤害。',
    },
    iceSprite: {
      name: '冰晶精灵',
      hp: 36,
      speed: 40,
      dps: 4,
      armor: 0,
      copper: 3,
      size: 18,
      color: '#9fe3ff',
      flying: true,
      chill: { aspd: 0.2, holdX: 640, maxStacks: 3 },
      desc: '光环：只要它还活着，英雄攻速就会降低。优先打掉！',
    },
    wolf: {
      name: '北极狼',
      hp: 34,
      speed: 95,
      dps: 8,
      armor: 0,
      copper: 2,
      size: 20,
      color: '#dfe9f5',
      pack: 3,
      desc: '三只一群，从同一条车道高速冲来。',
    },
    yeti: {
      name: '雪怪',
      hp: 180,
      speed: 24,
      dps: 18,
      armor: 100,
      copper: 5,
      size: 28,
      color: '#f2f6fb',
      desc: '大个子白毛怪，物理护甲很高。',
    },
    iceDragon: {
      name: '小冰龙',
      hp: 70,
      speed: 60,
      dps: 12,
      armor: 0,
      copper: 0,
      size: 22,
      color: '#7fc8f8',
      flying: true,
      desc: '霜霜女王召唤的小冰龙。',
    },
    iceGiant: {
      name: '冰棍大叔',
      hp: 1400,
      speed: 22,
      dps: 28,
      armor: 30,
      copper: 60,
      size: 44,
      color: '#bfe3ff',
      boss: 'mini',
      ai: 'iceGiant',
      desc: '小 Boss。每隔一会儿就冻住英雄的一个技能槽。',
    },
    frostQueen: {
      name: '霜霜女王',
      hp: 3200,
      speed: 20,
      dps: 30,
      armor: 0,
      copper: 180,
      size: 46,
      color: '#cfeaff',
      boss: 'major',
      ai: 'frostQueen',
      desc: '大 Boss。暴风雪降低攻速，冰封城墙让它无法修复，残血时召唤小冰龙。',
    },
    // ---------- 第五章 · 熔岩裂隙（设计书 23.1、23.2） ----------
    magma: {
      name: '岩浆团',
      hp: 50,
      speed: 40,
      dps: 9,
      armor: 0,
      copper: 2,
      size: 22,
      color: '#ff7a3d',
      fireZone: { radius: 70, duration: 5, haste: 0.5 },
      desc: '死后留下一片火焰，经过的怪物会加速。',
    },
    lavaGolem: {
      name: '熔岩傀儡',
      hp: 200,
      speed: 22,
      dps: 20,
      armor: 0,
      mres: 300,
      copper: 6,
      size: 28,
      color: '#7a5a50',
      desc: '石头拼成的小巨人，魔法伤害减免 75%。用物理武器打它！',
    },
    imp: {
      name: '火焰小恶魔',
      hp: 34,
      speed: 70,
      dps: 0,
      armor: 0,
      copper: 3,
      size: 18,
      color: '#e04848',
      flying: true,
      ranged: { holdX: 560, every: 1.8, damage: 12 },
      desc: '飞在空中，停在远处向城墙扔火球。',
    },
    assassin: {
      name: '暗影刺客',
      hp: 40,
      speed: 60,
      dps: 12,
      armor: 0,
      copper: 3,
      size: 20,
      color: '#2f2f3a',
      stealth: { revealX: 520, hopEvery: 3 },
      desc: '远处时隐身无法被攻击，还会偷偷换道，靠近城墙才现身。',
    },
    chariot: {
      name: '骷髅战车',
      hp: 45,
      speed: 130,
      dps: 10,
      armor: 30,
      copper: 3,
      size: 24,
      color: '#8a6a4a',
      slam: 25,
      desc: '骷髅驾驶的小推车，高速冲撞，撞墙伤害很高。',
    },
    inkClone: {
      name: '墨墨分身',
      hp: 1,
      speed: 26,
      dps: 20,
      armor: 0,
      copper: 0,
      size: 26,
      color: '#2a2438',
      desc: '墨墨的分身。三个分身都打掉，本体才会现身。',
    },
    rockGolem: {
      name: '岩岩',
      hp: 900,
      speed: 20,
      dps: 30,
      armor: 0,
      mres: 100,
      copper: 70,
      size: 46,
      color: '#8a5a4a',
      boss: 'mini',
      ai: 'rockGolem',
      desc: '小 Boss。会跺脚震晕英雄，被打败时会爆炸——别让它走近城墙！',
    },
    inkBoss: {
      name: '墨墨',
      hp: 3200,
      speed: 18,
      dps: 30,
      armor: 0,
      copper: 300,
      size: 48,
      color: '#2a2438',
      boss: 'major',
      ai: 'inkBoss',
      desc: '最终 Boss。一团会变大的墨色小团子：召唤墨影、分身、魔王形态、裂隙狂暴。',
    },

    // ---------- 第六章 · 云端王国（设计书 33） ----------
    cloudSheep: {
      name: '云朵羊',
      hp: 60,
      speed: 30,
      dps: 10,
      armor: 0,
      copper: 3,
      size: 24,
      color: '#f4f6fb',
      wool: { ratio: 0.6, speedMult: 2.2 },
      desc: '身上裹着厚厚的羊毛，要先把羊毛打掉。剃光毛以后跑得飞快！',
    },
    kite: {
      name: '风筝怪',
      hp: 32,
      speed: 66,
      dps: 6,
      armor: 0,
      copper: 2,
      size: 20,
      color: '#ff7a9a',
      flying: true,
      dodge: 0.35,
      desc: '飞行，随风飘来飘去：武器的物理普通攻击有 35% 会被躲开。魔法和范围伤害躲不开。',
    },
    thunderBall: {
      name: '雷团子',
      hp: 46,
      speed: 44,
      dps: 10,
      armor: 0,
      copper: 3,
      size: 20,
      color: '#ffd23f',
      staticShock: { range: 320, stun: 0.8 },
      desc: '浑身是电。在城墙附近被打死会放电，把英雄电麻一小会儿——尽量在远处解决它。',
    },
    rainbowBird: {
      name: '彩虹鸟',
      hp: 44,
      speed: 48,
      dps: 4,
      armor: 0,
      copper: 3,
      size: 20,
      color: '#7ad0ff',
      flying: true,
      healer: { radius: 140, pct: 0.04, holdX: 600 },
      desc: '会飞的治疗者，停在远处给周围的怪回血。用"威胁优先"或飞行优先先打它。',
    },
    balloon: {
      name: '热气球',
      hp: 90,
      speed: 26,
      dps: 8,
      armor: 20,
      copper: 4,
      size: 28,
      color: '#ff9f2e',
      flying: true,
      deathSpawn: { type: 'gobling', count: 3 },
      desc: '慢悠悠地飘过来，被打爆时会放下 3 只哥布林小兵。',
    },
    windGiant: {
      name: '呼呼',
      hp: 1700,
      speed: 18,
      dps: 30,
      armor: 0,
      copper: 80,
      size: 46,
      color: '#9aa8b8',
      boss: 'mini',
      ai: 'windGiant',
      desc: '小 Boss。风车脑袋的石头巨人：放风筝，还会刮大风把怪物吹向城墙——预警时集中火力打断！',
    },
    thunderKing: {
      name: '雷雷',
      hp: 5000,
      speed: 16,
      dps: 35,
      armor: 0,
      copper: 350,
      size: 50,
      color: '#5a6478',
      boss: 'major',
      ai: 'thunderKing',
      desc: '第六章 Boss。爱生气的大雷云：召唤雷团子和彩虹鸟、蓄力落雷、最后掀起暴风雨。',
    },
    // ---------- 第七章 · 珊瑚海湾（设计书 52.2） ----------
    hermitCrab: {
      name: '寄居蟹',
      hp: 64,
      speed: 34,
      dps: 10,
      armor: 20,
      copper: 3,
      size: 24,
      color: '#ff7a5a',
      shell: { hits: 4, duration: 1.2, mult: 0.1 },
      desc: '每挨 4 下打就缩进壳里一小会儿，壳里几乎打不动。别盯着一只打——连发弩、雷电法球分散火力更有效。',
    },
    turtle: {
      name: '盾龟',
      hp: 140,
      speed: 24,
      dps: 12,
      armor: 40,
      copper: 5,
      size: 30,
      color: '#5aa86a',
      guard: { radius: 110, mult: 0.6 },
      desc: '护卫：周围的怪物受到英雄攻击的伤害 −40%。先打掉它，或者用技能。',
    },
    flyingFish: {
      name: '飞鱼',
      hp: 26,
      speed: 46,
      dps: 6,
      armor: 0,
      copper: 2,
      size: 18,
      color: '#4aa8e8',
      leap: { every: 2.4, dist: 130, time: 0.45 },
      desc: '每隔一会儿向前跳一大步，跳在空中时打不到。跑得比看起来快！',
    },
    urchin: {
      name: '海胆',
      hp: 70,
      speed: 40,
      dps: 12,
      armor: 0,
      copper: 2,
      size: 20,
      color: '#8a5ac8',
      slam: 60,
      spikes: { radius: 100, damage: 20 },
      desc: '被打死时射出尖刺，扎伤周围的怪物。等它挤进怪堆里再打！走到城墙时会先扎一下。',
    },
    seahorse: {
      name: '海马',
      hp: 50,
      speed: 40,
      dps: 4,
      armor: 0,
      copper: 3,
      size: 23,
      color: '#ffc83f',
      bubbler: { holdX: 640, every: 3, radius: 180 },
      desc: '停在远处给怪物套泡泡，泡泡能挡住一次攻击。连发弩、雷电法球能很快戳破泡泡。',
    },
    tentacle: {
      name: '触手',
      hp: 150,
      speed: 0,
      dps: 0,
      armor: 0,
      copper: 0,
      size: 22,
      color: '#c0508a',
      bossPart: true,
      ranged: { holdX: 9999, every: 4, damage: 8 },
      desc: '波波的触手。只要还有 3 条以上，波波就很难打动。',
    },
    pearlClam: {
      name: '贝贝',
      hp: 1500,
      speed: 18,
      dps: 30,
      armor: 0,
      copper: 90,
      size: 46,
      color: '#ff9ac0',
      boss: 'mini',
      ai: 'pearlClam',
      desc: '小 Boss。巨大的珍珠贝：合壳时几乎打不动，张壳时露出珍珠——抓住张壳的时候放技能！',
    },
    octoKing: {
      name: '波波',
      hp: 3200,
      speed: 14,
      dps: 40,
      armor: 0,
      copper: 400,
      size: 52,
      color: '#b04a8a',
      boss: 'major',
      ai: 'octoKing',
      desc: '第七章 Boss。章鱼大王：触手护身、吸盘回血、最后卷起大漩涡。先打触手！',
    },
  };

  // 怪物类型标签（用于新敌人登场卡片、关卡预览）
  TD.data.monsterTags = function (def) {
    const t = [];
    if (def.boss) t.push(def.boss === 'major' ? '大 Boss' : '小 Boss');
    if (def.flying) t.push('飞行');
    if (def.speed >= 95) t.push('高速');
    if ((def.armor || 0) >= 60) t.push('重甲');
    if (def.frontArmor) t.push('盾牌');
    if (def.mres) t.push('魔抗');
    if (def.physResist) t.push('灵体');
    if (def.ranged) t.push('远程');
    if (def.healer) t.push('治疗');
    if (def.chill) t.push('光环');
    if (def.burrow) t.push('钻地');
    if (def.stealth) t.push('隐身');
    if (def.explode) t.push('自爆');
    if (def.split || def.deathSpawn) t.push('分裂');
    if (def.regen) t.push('再生');
    if (def.laneHop) t.push('换道');
    if (def.slam) t.push('冲撞');
    if (def.pack) t.push('狼群');
    if (def.fireZone) t.push('火焰');
    if (def.wool) t.push('羊毛');
    if (def.dodge) t.push('闪避');
    if (def.staticShock) t.push('静电');
    if (def.onDeath) t.push('孢子');
    if (def.shell) t.push('缩壳');
    if (def.guard) t.push('护卫');
    if (def.leap) t.push('跳跃');
    if (def.spikes) t.push('尖刺');
    if (def.bubbler) t.push('泡泡');
    return t;
  };
  // 不单独介绍的怪物：分裂产物和 Boss 召唤物
  TD.data.noIntro = { minijelly: true, minipumpkin: true, snowball: true, inkClone: true, iceDragon: true, tentacle: true };

  // 呼呼的参数（设计书 33.3）
  TD.data.windGiant = { holdX: 760, kiteFirst: 3, kiteEvery: 8, kiteCount: 2, gustFirst: 6, gustEvery: 10, gustEveryLow: 7, lowBelow: 0.3, gustWarn: 2, gustPush: 140, interruptRatio: 0.04 };
  // 贝贝的参数（设计书 52.3）
  TD.data.pearlClam = { holdX: 760, closedTime: 4.5, openTime: 3, closedTime2: 4, openTime2: 2.5, lowBelow: 0.4, closedMult: 0.1, openMult: 1.3, pearlEvery: 1, pearlDamage: 15, crabCount: 2 };
  // 波波的参数（设计书 52.3）
  TD.data.octoKing = {
    holdX: 800,
    tentacleX: 560,
    tentacles: 4,
    guardMin: 3,
    guardMult: 0.4,
    regrow: 25,
    regrow2: 18,
    phase2Below: 0.6,
    phase3Below: 0.25,
    suckPct: 0.0012,
    regrowAllP3: false,
    summonFirst: 4,
    summonEvery: 7,
    whirlSpeed: 0.2,
  };
  // 雷雷的参数（设计书 33.3）
  TD.data.thunderKing = {
    holdX: 780,
    phase2Below: 0.65,
    phase3Below: 0.3,
    summonFirst: 2,
    summonEvery: 6,
    summonEvery2: 8,
    ballCount: 2,
    chargeFirst: 3,
    chargeEvery: 9,
    chargeEvery3: 7,
    chargeWarn: 2.5,
    interruptRatio: 0.025,
    boltDamage: 110,
    stunDuration: 1.2,
    stormSpeed: 0.3,
  };

  TD.data.rockGolem = { stompEvery: 12, stompFirst: 6, stompWarn: 1, stunDuration: 1, boomRange: 300, boomDamage: 200, lavaDuration: 8, lavaHaste: 0.5 };

  TD.data.inkBoss = {
    holdX: 760,
    phase2Below: 0.75,
    phase3Below: 0.5,
    phase4Below: 0.2,
    summonEvery: 7,
    summonCount: 3,
    shadePool: ['slime', 'bunny', 'mushroom', 'goblin', 'scorpion', 'mummy', 'ghost', 'pumpkin', 'snowman', 'wolf'],
    cloneCount: 3,
    cloneHp: 0.06,
    stunAfterClones: 3,
    vulnDuration: 6,
    vulnMult: 1.5,
    slamEvery: 9,
    slamWarn: 2.5,
    slamDamage: 100,
    interruptRatio: 0.02,
    rageFirst: 30,
    rageEvery: 20,
    rageRatio: 0.4,
  };

  TD.data.iceGiant = { holdX: 760, walkBelow: 0.5, freezeEvery: 10, freezeFirst: 4, freezeDuration: 6 };

  TD.data.frostQueen = {
    holdX: 760,
    phase2Below: 0.66,
    phase3Below: 0.33,
    blizzardEvery: 14,
    blizzardFirst: 5,
    blizzardDuration: 6,
    blizzardAspd: -0.35,
    sealEvery: 16,
    sealDuration: 8,
    wolfEvery: 12,
    wolfCount: 3,
    dragonEvery: 10,
    dragonCount: 2,
  };

  TD.data.boneMage = {
    holdX: 760,
    summonEvery: 8,
    summonFirst: 3,
    summonLanes: 3,
    summonType: 'ghost',
    reviveTime: 3,
    reviveHp: 0.5,
  };

  TD.data.witch = {
    holdX: 760, // 必须在英雄基础射程（x≈836）以内
    fogFirst: 4,
    fogEvery: 12,
    fogEveryP3: 8,
    fogDuration: 5,
    fogDps: 8,
    phase2Below: 0.66,
    phase3Below: 0.33,
    cookEvery: 10,
    cookHp: 0.5,
    cookSpeed: 0.3,
    summonType: 'frog',
    summonCount: 2,
    pourEvery: 15,
    pourLanes: 2,
    poolDuration: 8,
    poolSpeed: 0.4,
  };

  TD.data.kingScorpion = {
    burrowEvery: 12,
    firstBurrow: 6,
    underTime: 1.5,
    jump: 160,
    clawEvery: 5,
    clawDamage: 50,
  };

  TD.data.pharaoh = {
    holdX: 820,
    stormEvery: 15,
    stormFirst: 5,
    stormDuration: 6,
    stormAspd: -0.3,
    phase2Below: 0.66,
    phase3Below: 0.33,
    summonEvery: 12,
    summonCount: 2,
    summonType: 'mummy',
    healRadius: 160,
    healPct: 0.03,
    shieldRatio: 0.12,
    shieldPhysMult: 0.25,
    shieldMagicMult: 1.5,
    shieldRegen: 25,
    phase3SpeedMult: 0.5,
  };

  // 咕噜大王的阶段参数（设计书 18.5）
  TD.data.boarKing = {
    summonEvery: 6,
    summonEveryEnraged: 4,
    summonCount: 2,
    summonType: 'gobling',
    holdX: 780, // 第一、二阶段停在战场中段指挥（在英雄射程内）
    chargeBelow: 0.6,
    chargeEvery: 8,
    chargeWarn: 2.5,
    chargeSpeed: 380,
    chargeDamage: 120,
    returnSpeed: 320,
    interruptRatio: 0.06,
    knockback: 150,
    enrageBelow: 0.3,
    enrageSpeedMult: 1.5,
    laneSwitchEvery: 5,
  };

  // ---------- 混沌回声（设计书 75）：第八至十章的怪物 ----------
  // 每一种 = 原来的怪物（base）+ 加强的数值 / 改过的机制参数（over）+ 换色（tint）；画法沿用原来的（art），染色在 sprites.js
  const TINT_MOON = '#7a5cff'; // 月影古堡：蓝紫
  const TINT_FORGE = '#ff4a4a'; // 赤铁熔炉：暗红
  const TINT_VOID = '#b04aff'; // 虚空天域：紫
  // ---------- 远程怪（设计书 95）：停在远处，各用不同的弹道向城墙开火 ----------
  // ranged.shot 决定弹道的样子：arrow 快箭 · rock 抛物线石块 · ice 冰锥（冻伤城墙）· lightning 瞬发闪电 · bomb 会爆炸的炸弹
  Object.assign(TD.data.monsters, {
    goblinArcher: { name: '哥布林弓手', hp: 36, speed: 55, dps: 0, armor: 0, copper: 4, size: 20, color: '#d8a040', art: 'goblin', tint: '#d8a040', ranged: { holdX: 520, every: 1.4, damage: 8, shot: 'arrow' }, desc: '躲在远处的哥布林，一支接一支地朝城墙射箭，箭又快又准。' },
    rockThrower: { name: '投石怪', hp: 110, speed: 30, dps: 0, armor: 25, copper: 5, size: 26, color: '#8a6a4a', art: 'stump', ranged: { holdX: 460, every: 2.6, damage: 20, shot: 'rock' }, desc: '力气很大的怪，停在远处抛出大石头，一块砸下去很疼，但出手慢。' },
    iceMage: { name: '冰晶法师', hp: 55, speed: 40, dps: 0, armor: 0, copper: 5, size: 22, color: '#8fe0ff', art: 'snowman', tint: '#8fe0ff', ranged: { holdX: 500, every: 2.2, damage: 8, shot: 'ice', poison: { dps: 3, duration: 4 } }, desc: '从远处射出冰锥，被冰锥打中的城墙会冻伤，持续受到伤害。' },
    stormCaster: { name: '雷电法师', hp: 70, speed: 38, dps: 0, armor: 0, copper: 6, size: 22, color: '#b090ff', art: 'priest', tint: '#b090ff', ranged: { holdX: 620, every: 2.8, damage: 17, shot: 'lightning' }, desc: '站在最远处召来闪电劈向城墙，闪电没有弹道、躲不开，但出手慢。' },
    bomber: { name: '投弹手', hp: 90, speed: 36, dps: 0, armor: 0, copper: 6, size: 24, color: '#ff9a3c', art: 'pumpkin', tint: '#ff9a3c', ranged: { holdX: 440, every: 3.4, damage: 30, shot: 'bomb' }, desc: '丢出会爆炸的炸弹，一颗炸弹伤城墙很重，但很久才丢一颗。' },
  });

  const echo = (id, base, name, tint, over, desc) => {
    const b = TD.data.monsters[base];
    const def = Object.assign({}, b, over, { name, art: base, tint, desc, echo: true });
    if (def.size) def.size = Math.round(def.size * 1.08);
    TD.data.monsters[id] = def;
  };
  const M = TD.data.monsters;
  // 第八章 · 月影古堡（第一至三章怪物的回声）
  echo('moonSlime', 'slime', '月影团团', TINT_MOON, { hp: 70, speed: 46, dps: 12, copper: 3, regen: { delay: 2, pct: 0.05 } }, '被月光侵蚀的绿团团：血量高，不被打的时候会自己回血。');
  echo('moonBunny', 'bunny', '月影兔', TINT_MOON, { hp: 40, speed: 135, dps: 8, copper: 3, dodge: 0.25, laneHop: { every: 2 } }, '快得看不清的兔子，会换车道，物理攻击有四分之一的几率打空。');
  echo('digger', 'scorpion', '掘墓蝎', TINT_MOON, { hp: 90, dps: 14, armor: 60, copper: 4 }, '会钻进地里的蝎子，披着一层骨甲。');
  echo('wraith', 'ghost', '怨灵', TINT_MOON, { hp: 90, speed: 56, dps: 14, physResist: 0.85, copper: 4 }, '几乎不怕物理攻击的灵体：只有 15% 的物理伤害有效，用魔法打它。');
  echo('skelGuard', 'goblin', '骷髅卫兵', TINT_MOON, { hp: 200, speed: 38, dps: 18, frontArmor: 160, copper: 5 }, '举着厚重的骨盾，正面几乎打不动：回旋镖从背后打。');
  echo('gargoyle', 'vulture', '石像鬼', TINT_MOON, { hp: 110, speed: 105, dps: 10, armor: 100, copper: 4 }, '披着石甲的飞行怪：物理攻击大半被挡住。');
  echo('lanternGhost', 'priest', '提灯鬼', TINT_MOON, { hp: 120, dps: 8, copper: 5, healer: Object.assign({}, M.priest.healer, { radius: 150, pct: 0.06 }) }, '提着灯的治疗者：范围更大、治疗更多，先打它。');
  echo('bloodBat', 'bat', '吸血蝠', TINT_MOON, { hp: 70, dps: 9, copper: 3, laneHop: { every: 1.8 } }, '频繁换车道的蝙蝠，很难集火。');
  // 第九章 · 赤铁熔炉（第四、五章怪物的回声）
  echo('ironSnowman', 'snowman', '铁雪人', TINT_FORGE, { hp: 110, dps: 16, armor: 60, copper: 4, deathSpawn: Object.assign({}, M.snowman.deathSpawn, { count: 3 }) }, '披着铁甲的雪人，死后裂成三个小雪团。');
  echo('ironWolf', 'wolf', '铁狼', TINT_FORGE, { hp: 65, speed: 100, dps: 11, armor: 20, copper: 4, pack: 4 }, '四只一组冲过来的铁甲狼。');
  echo('forgeImp', 'imp', '炉火小鬼', TINT_FORGE, { hp: 60, copper: 5, ranged: Object.assign({}, M.imp.ranged, { damage: Math.round(M.imp.ranged.damage * 1.4) }) }, '会飞的火球手，一发火球比原来疼得多。');
  echo('steelYeti', 'yeti', '钢雪怪', TINT_FORGE, { hp: 280, dps: 24, armor: 140, copper: 7 }, '浑身钢板的雪怪：物理几乎打不动，魔法才有效。');
  echo('moltenGolem', 'lavaGolem', '熔铁傀儡', TINT_FORGE, { hp: 300, dps: 24, mres: 300, copper: 8 }, '熔化的铁做的傀儡：魔法几乎打不动，用物理武器。');
  echo('slagMagma', 'magma', '炉渣团', TINT_FORGE, { hp: 70, dps: 12, copper: 4, fireZone: Object.assign({}, M.magma.fireZone, { radius: 90, duration: 6 }) }, '死后留下更大、更久的火焰地带。');
  echo('ironChariot', 'chariot', '铁战车', TINT_FORGE, { hp: 100, speed: 130, dps: 12, armor: 50, copper: 5, slam: 22 }, '披着铁板的战车，冲得很快。');
  echo('frostWyrm', 'iceDragon', '霜龙', TINT_FORGE, { hp: 85, speed: 62, dps: 12, copper: 4 }, '会飞的小龙，被混沌染成了红色。');
  // 第十章 · 虚空天域（第六、七章怪物的回声）
  echo('voidSheep', 'cloudSheep', '虚空羊', TINT_VOID, { hp: 110, dps: 14, copper: 5, wool: Object.assign({}, M.cloudSheep.wool, { ratio: 0.7 }) }, '羊毛更厚：先扣掉 70% 血量的羊毛才开始掉血。');
  echo('voidKite', 'kite', '虚空风筝', TINT_VOID, { hp: 56, dps: 9, copper: 4, dodge: 0.5 }, '一半的物理攻击都会被它飘走躲开。');
  echo('voidShock', 'thunderBall', '虚空雷团', TINT_VOID, { hp: 85, dps: 14, copper: 5, staticShock: Object.assign({}, M.thunderBall.staticShock, { range: 380, stun: 1.0 }) }, '电击的范围更大、麻痹更久。');
  echo('voidCrab', 'hermitCrab', '虚空蟹', TINT_VOID, { hp: 115, dps: 14, armor: 30, copper: 5, shell: Object.assign({}, M.hermitCrab.shell, { hits: 5, duration: 1.6 }) }, '缩壳的时间更长。');
  echo('voidTurtle', 'turtle', '虚空盾龟', TINT_VOID, { hp: 230, dps: 18, armor: 50, copper: 7, guard: Object.assign({}, M.turtle.guard, { radius: 150, mult: 0.5 }) }, '保护圈更大、减伤更多，先把它拆掉。');
  echo('voidFish', 'flyingFish', '虚空飞鱼', TINT_VOID, { hp: 48, dps: 9, copper: 4, leap: Object.assign({}, M.flyingFish.leap, { dist: 170 }) }, '一跳跳得更远。');
  echo('voidUrchin', 'urchin', '虚空海胆', TINT_VOID, { hp: 120, dps: 17, copper: 4, spikes: Object.assign({}, M.urchin.spikes, { damage: 40 }) }, '死后的尖刺扎得更疼。');
  echo('voidBalloon', 'balloon', '虚空气球', TINT_VOID, { hp: 140, dps: 12, armor: 25, copper: 6, deathSpawn: Object.assign({}, M.balloon.deathSpawn, { count: 4 }) }, '落地时放出四个哥布林小兵。');
  echo('voidBird', 'rainbowBird', '虚空鸟', TINT_VOID, { hp: 80, dps: 6, copper: 5, healer: Object.assign({}, M.rainbowBird.healer, { pct: 0.06 }) }, '治疗更多的飞鸟。');
  // 旧 Boss 的回声：行动方式不变（ai 沿用），血量更高
  const echoBoss = (id, base, name, tint, hp, desc) => {
    const b = M[base];
    M[id] = Object.assign({}, b, { name, hp, art: base, tint, desc, echo: true, size: Math.round(b.size * 1.1) });
  };
  echoBoss('chaosBoneMage', 'boneMage', '骨头先生的回声', TINT_MOON, 2300, '小 Boss。行动和骨头先生一样：召唤骷髅、拿魔法护盾，但是更硬。');
  echoBoss('chaosPharaoh', 'pharaoh', '胖法老的回声', TINT_MOON, 4300, '大 Boss。沙暴、召唤、治疗、护盾，三个阶段，比原来难缠得多。');
  echoBoss('chaosGolem', 'rockGolem', '岩岩的回声', TINT_FORGE, 1500, '小 Boss。行动和岩岩一样，血量高了一倍。');
  echoBoss('chaosQueen', 'frostQueen', '霜霜女王的回声', TINT_FORGE, 4200, '大 Boss。冰冻、暴风雪、冰墙，比原来更冷。');
  echoBoss('chaosGiant', 'windGiant', '呼呼的回声', TINT_VOID, 2500, '小 Boss。龙卷风和推挤，比原来更猛。');
  echoBoss('chaosInk', 'inkBoss', '墨墨的回声', TINT_VOID, 5200, '最终 Boss。墨水、分身、遮蔽视线——这是混沌裂隙的源头。');

  // ---------- 九层妖塔（设计书 74）----------
  // 妖塔里的 Boss 是小镇朋友们的"妖塔版"：去掉各自的指挥 / 召唤 / 冲锋 / 分裂（几十个同时行动会乱套），
  // 只保留血量、护甲、魔抗等基础属性；画法沿用原来的（art）。
  TD.data.towerBossIds = [];
  for (const id of Object.keys(TD.data.monsters)) {
    const def = TD.data.monsters[id];
    if (!def.boss || def.bossPart) continue;
    const tw = Object.assign({}, def, { art: id, towerOf: id, desc: '九层妖塔里的妖王：没有特殊行动，只管冲向城墙。' });
    delete tw.ai;
    delete tw.split;
    delete tw.onDeath;
    TD.data.monsters['tw_' + id] = tw;
    TD.data.noIntro['tw_' + id] = true;
    TD.data.towerBossIds.push(id);
  }
  // 妖塔的数值：第 k 层怪物血量与攻城伤害 = D(关卡) × base × grow^(k−1)；每层 ×grow（v0.69 起每上一层怪物属性都会增加），base 由 tools/tower.js 标定
  TD.data.tower = { floors: 9, bossPerFloor: 20, minionPerFloor: 180, bossShareLast: 0.5, base: 0.02, grow: 1.2, waves: 3, fee: { gold: 1 } };
})((globalThis.TD = globalThis.TD || {}));
