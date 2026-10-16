// 王国小镇（设计书第 39 章）：打败的 Boss 搬进小镇，每人 3 句"现在的生活"
// perk：当助战伙伴时的小加成（设计书 51）
(function (TD) {
  'use strict';

  TD.data.town = [
    { boss: 'jellyPrince', level: 5, perk: { waveHeal: 0.03 }, perkDesc: '每波结束时城墙回复 3%', lines: ['本王子在广场上开了一家蹦床店，第一次免费！', '今天蹦得太高，撞到了鸽子。', 'Kael，你的头盔借我当蹦床好不好？'] },
    { boss: 'boarKing', level: 10, perk: { mods: { copperBonus: 0.05 } }, perkDesc: '铜币收益 +5%', lines: ['今天草原上的落叶，我一片一片都扫干净了！', '咕噜……小的们说我扫地的样子很帅。', '冲锋？我现在只冲向垃圾。'] },
    { boss: 'kingScorpion', level: 15, perk: { mods: { crit: 0.03 } }, perkDesc: '暴击率 +3%', lines: ['我在镇上开了一家理发店。别怕，我很小心。', '咔嚓咔嚓，今天剪了二十个刘海。', '还是没人帮我剪指甲。'] },
    { boss: 'pharaoh', level: 20, perk: { mods: { wallDr: 0.03 } }, perkDesc: '城墙受到伤害 −3%', lines: ['本法老在研究新口味的饼干。这次只放了三百年。', '绷带洗干净了，香香的。', '金字塔租出去当图书馆了，很受欢迎。'] },
    { boss: 'boneMage', level: 25, perk: { mods: { critDmg: 0.1 } }, perkDesc: '暴击伤害 +10%', lines: ['咔哒咔哒，骨头音乐会每周六晚上开演！', '左边第三根骨头又装反了，不过没关系。', '你知道吗？木琴就是我的肋骨做的。开玩笑的。'] },
    { boss: 'witch', level: 30, perk: { mods: { atkMult: 0.03 } }, perkDesc: '攻击力 +3%', lines: ['南瓜汤熬好啦！今天一点墨水都没放。', '嘻嘻，我在汤里加了一点点蜂蜜。', '镇上的小朋友都叫我汤婆婆，我很喜欢。'] },
    { boss: 'iceGiant', level: 35, perk: { mods: { cdMult: -0.05 } }, perkDesc: '主动技能冷却 −5%', lines: ['草莓味冰棍，一根一枚铜币！', '夏天到了，我是镇上最受欢迎的人。', '呼——帮你把汤吹凉。'] },
    { boss: 'frostQueen', level: 40, perk: { mods: { range: 0.05 } }, perkDesc: '射程 +5%', lines: ['……今天也很安静。很好。', 'Kael的头盔还是会响。……我已经习惯了。', '我在镜子里看到了大家。原来热闹也不错。'] },
    { boss: 'rockGolem', level: 45, perk: { mods: { aspdMult: 0.03 } }, perkDesc: '攻击速度 +3%', lines: ['咚……我……在……看门……', '咚……墨墨……今天……很开心……', '咚……谢谢……你……'] },
    { boss: 'inkBoss', level: 50, perk: { shot: { every: 25, mult: 3, pick: 'nearest', name: '墨团' } }, perkDesc: '每 25 秒向最近的怪物吐一个墨团（攻击力 ×3）', lines: ['我搬到了城墙边上，每天都能看Kael站岗。', '我学会了用墨水画画！这是你，这是我。', '……有朋友的感觉，真好。'] },
    { boss: 'windGiant', level: 55, perk: { mods: { slowAll: 0.03 } }, perkDesc: '所有怪物速度 −3%', lines: ['呼——风车磨的面粉，做成了全镇的面包。', '我把风筝都放到了天上，晚上像星星一样。', '下次刮大风之前，我会先打招呼的。'] },
    { boss: 'thunderKing', level: 60, perk: { shot: { every: 20, mult: 4, pick: 'strongest', name: '小闪电' } }, perkDesc: '每 20 秒劈一道小闪电，打血量最多的怪物（攻击力 ×4）', lines: ['轰……今天下了一场小雨，彩虹挂得高高的。', '我在练习小声打雷。轰。（很小声）', '谢谢你们，没有讨厌生气的我。'] },
    { boss: 'pearlClam', level: 65, perk: { wallBubble: 0.03 }, perkDesc: '每波开始时给城墙一个泡泡护盾，吸收 3% 最大血量的伤害', lines: ['欢迎光临贝贝珍珠店！每一颗珍珠都登记过了。', '啪嗒——不好意思，一紧张就会合上壳。', '城墙的壳……我是说城墙，今天也很结实。'] },
    { boss: 'octoKing', level: 70, perk: { shot: { every: 18, mult: 3, pick: 'nearest', name: '触手拍' } }, perkDesc: '每 18 秒用触手拍一下最靠近城墙的怪物（攻击力 ×3）', lines: ['咕嘟！今天用八条腿同时帮八户人家修了屋顶。', '我的新家超——大，欢迎来玩！', '有家的感觉，原来是这样暖暖的。'] },
  ];
})((globalThis.TD = globalThis.TD || {}));
