// 装备扩充（设计书第 76 章）：头盔、披风、盔甲、箭袋、饰品、鞋子，每类 30 件，按品质分绿 / 蓝 / 紫 / 红 / 金五档（和武器一样）。
// gear.js 里手写的 24 件老装备保留（只是补上品质档位），其余按"品质 × 六种属性取向"生成。
(function (TD) {
  'use strict';

  const D = TD.data;

  D.equipSlots = { helm: '头盔', cape: '披风', armor: '盔甲', quiver: '箭袋', trinket: '饰品', boots: '鞋子' };
  // 商店里"装备"页的分类：武器也放在这里（设计书 76.3）
  D.equipCats = [
    { id: 'weapon', name: '武器', icon: '⚔' },
    { id: 'helm', name: '头盔', icon: '⛑' },
    { id: 'cape', name: '披风', icon: '🧣' },
    { id: 'armor', name: '盔甲', icon: '🛡' },
    { id: 'quiver', name: '箭袋', icon: '🏹' },
    { id: 'trinket', name: '饰品', icon: '📿' },
    { id: 'boots', name: '鞋子', icon: '👢' },
  ];
  // 品质：1 绿 2 蓝 3 紫 4 红 5 金（颜色和武器相同）
  D.gearTiers = D.weaponRarity;
  D.rarityNames = { 1: '绿', 2: '蓝', 3: '紫', 4: '红', 5: '金' };

  // 同一种效果叠加后的上限（装备越来越多，防止冷却、无视护甲等超过 100%）
  D.modCaps = { armorIgnore: 0.8, cdMult: -0.6, igniteChance: 1, slowOnHit: 0.6, spiritPierce: 1, copperBonus: 1.5, waveShield: 0.5, mendBonus: 0.3 };

  // 老装备按价格补上品质：铜币 → 绿，银币 → 蓝，3–4 金 → 紫，5–9 金 → 红，10 金以上或钻石 → 金
  const tierOfCost = (c) => (c.diamond ? 5 : c.gold ? (c.gold >= 10 ? 5 : c.gold >= 5 ? 4 : 3) : c.silver ? 2 : 1);
  for (const id of Object.keys(D.equipment)) D.equipment[id].rarity = tierOfCost(D.equipment[id].cost);

  // ---------- 生成规则 ----------
  const TIER_MULT = [0, 1, 1.8, 3, 4.6, 6.8]; // 各档品质的属性倍率
  const STAT_UNIT = { atkFlat: 1.5, atkPct: 0.025, aspdPct: 0.025, crit: 0.012, critDmg: 0.07, luck: 0.03, rangePct: 0.025, wallDr: 0.012, wallHpPct: 0.06 };
  const MOD_UNIT = { bossDmg: 0.04, flyDmg: 0.04, mendBonus: 0.006, healBonus: 0.05, waveShield: 0.01, armorIgnore: 0.04, spiritPierce: 0.05, slowOnHit: 0.03, copperBonus: 0.025, lowWallAtk: 0.04, cdMult: -0.025, igniteChance: 0.04 };
  const PCT = (v) => Math.round(Math.abs(v) * 1000) / 10;
  const DESC = {
    atkFlat: (v) => `攻击力 +${Math.round(v)}`,
    atkPct: (v) => `攻击力 +${PCT(v)}%`,
    aspdPct: (v) => `攻击速度 +${PCT(v)}%`,
    crit: (v) => `暴击率 +${PCT(v)}%`,
    critDmg: (v) => `暴击伤害 +${PCT(v)}%`,
    luck: (v) => `幸运 +${PCT(v)}%`,
    rangePct: (v) => `射程 +${PCT(v)}%`,
    wallDr: (v) => `城墙受到伤害 −${PCT(v)}%`,
    wallHpPct: (v) => `城墙最大血量 +${PCT(v)}%`,
    bossDmg: (v) => `对 Boss 伤害 +${PCT(v)}%`,
    flyDmg: (v) => `对飞行怪伤害 +${PCT(v)}%`,
    mendBonus: (v) => `每波结束城墙多回复 ${PCT(v)}%`,
    healBonus: (v) => `城墙回血效果 +${PCT(v)}%`,
    waveShield: (v) => `每波开始城墙获得 ${PCT(v)}% 最大血量的护盾`,
    armorIgnore: (v) => `无视目标 ${PCT(v)}% 护甲`,
    spiritPierce: (v) => `物理伤害对灵体的效果 +${PCT(v)}%`,
    slowOnHit: (v) => `普通攻击使目标减速 ${PCT(v)}%`,
    copperBonus: (v) => `本关铜币收益 +${PCT(v)}%`,
    lowWallAtk: (v) => `城墙血量低于 50% 时攻击力 +${PCT(v)}%`,
    cdMult: (v) => `主动技能冷却 −${PCT(v)}%`,
    igniteChance: (v) => `普通攻击 ${PCT(v)}% 几率点燃目标`,
  };

  // 六种属性取向：[属性系数, 效果系数]（乘上基础单位和品质倍率）
  const PROFILES = {
    helm: [{ s: { atkPct: 1 } }, { s: { crit: 1 } }, { s: { critDmg: 1 } }, { s: { atkFlat: 1 }, m: { bossDmg: 1 } }, { s: { rangePct: 1 } }, { s: { atkPct: 0.6, crit: 0.6 } }],
    cape: [{ s: { aspdPct: 1 } }, { s: { wallDr: 1 } }, { s: { aspdPct: 0.6 }, m: { flyDmg: 1 } }, { s: { wallDr: 0.6 }, m: { mendBonus: 1 } }, { s: { aspdPct: 0.6 }, m: { cdMult: 0.8 } }, { m: { igniteChance: 1.2 } }],
    armor: [{ s: { wallHpPct: 1 } }, { s: { wallDr: 1 } }, { s: { wallHpPct: 0.6, wallDr: 0.6 } }, { s: { wallHpPct: 0.6 }, m: { mendBonus: 1 } }, { s: { wallDr: 0.6 }, m: { healBonus: 1 } }, { s: { wallHpPct: 0.6 }, m: { waveShield: 1 } }],
    quiver: [{ s: { atkPct: 1 } }, { s: { critDmg: 1 } }, { m: { armorIgnore: 1 } }, { s: { crit: 0.7 }, m: { spiritPierce: 1 } }, { m: { slowOnHit: 1 } }, { s: { atkPct: 0.6, critDmg: 0.6 } }],
    trinket: [{ s: { luck: 1 } }, { s: { critDmg: 1 } }, { s: { rangePct: 1 } }, { m: { copperBonus: 1 } }, { m: { lowWallAtk: 1 } }, { m: { cdMult: 1 } }],
    boots: [{ s: { aspdPct: 1 } }, { s: { luck: 1 } }, { s: { rangePct: 1 } }, { s: { aspdPct: 0.6, crit: 0.6 } }, { s: { luck: 0.6 }, m: { copperBonus: 0.8 } }, { m: { cdMult: 1 } }],
  };

  // 名字：每类 5 档 × 6 种取向（取向顺序同上）
  const NAMES = {
    helm: [
      ['布头巾', '皮帽', '铁环冠', '猎人头巾', '瞭望帽', '学徒发带'],
      ['钢盔', '银冠', '战士头盔', '驱兽盔', '鹰羽帽', '哨兵盔'],
      ['秘银盔', '符文冠', '影刃面罩', '斩龙盔', '远视盔', '均衡之冠'],
      ['炼狱角盔', '血瞳面具', '暴君王冠', '屠神盔', '天眼冠', '烈阳盔'],
      ['星辰王冠', '终焉之瞳', '创世冠冕', '弑神之冠', '万里观星冠', '黎明皇冠'],
    ],
    cape: [
      ['粗布斗篷', '守卫披风', '麻雀披风', '草药披风', '学徒披风', '火鼠披风'],
      ['迅捷披风', '钢丝披风', '鹰翼披风', '愈合披风', '秒针披风', '炽焰披风'],
      ['疾影斗篷', '秘银披风', '云雀斗篷', '生命披风', '时光斗篷', '熔岩斗篷'],
      ['风暴斗篷', '龙鳞披风', '凤翎斗篷', '圣泉披风', '时空斗篷', '炼狱斗篷'],
      ['流星斗篷', '不朽披风', '天翼斗篷', '世界树披风', '永恒斗篷', '太阳披风'],
    ],
    armor: [
      ['皮甲', '铁片甲', '锁子甲', '草编甲', '厚布甲', '木盾甲'],
      ['钢甲', '板甲', '骑士甲', '修道甲', '医师甲', '壁垒甲'],
      ['秘银甲', '符文板甲', '圣骑士甲', '生命甲', '治愈甲', '守护甲'],
      ['龙鳞甲', '黑曜甲', '炼狱重甲', '血族甲', '圣光甲', '堡垒甲'],
      ['星辰铠', '不灭之铠', '创世战甲', '世界树之铠', '神恩铠', '永恒壁垒'],
    ],
    quiver: [
      ['木制箭袋', '猎户箭袋', '钻头箭袋', '灵草箭袋', '薄冰箭袋', '双层箭袋'],
      ['精钢箭袋', '暴击箭袋', '破甲重袋', '月光箭袋', '寒霜箭袋', '双羽箭袋'],
      ['秘银箭袋', '嗜血箭袋', '贯穿箭袋', '幽魂箭袋', '冰魄箭袋', '连珠箭袋'],
      ['烈焰箭袋', '屠龙箭袋', '灭甲箭袋', '引魂箭袋', '极寒箭袋', '星轨箭袋'],
      ['流星箭袋', '弑神箭袋', '破天箭袋', '轮回箭袋', '永冻箭袋', '创世箭袋'],
    ],
    trinket: [
      ['兔脚', '虎牙坠', '望远镜片', '铜钱串', '红布条', '沙粒瓶'],
      ['幸运硬币', '狮牙坠', '鹰羽挂坠', '聚宝盆', '血誓指环', '小沙漏'],
      ['四叶银章', '龙牙项链', '千里镜', '金元宝', '背水勋章', '时之齿轮'],
      ['命运骰子', '魔王獠牙', '天穹之眼', '财神像', '不屈战旗', '时空罗盘'],
      ['命运女神吊坠', '终焉獠牙', '全知之眼', '龙脉聚宝', '涅槃徽记', '永恒沙漏'],
    ],
    boots: [
      ['草鞋', '皮靴', '猎靴', '轻便鞋', '行商靴', '短跑鞋'],
      ['疾行靴', '幸运靴', '斥候靴', '迅捷战靴', '商队靴', '敏捷靴'],
      ['风行靴', '福运靴', '游侠靴', '烈风战靴', '财运靴', '灵动靴'],
      ['雷霆靴', '星运靴', '追星靴', '疾电战靴', '黄金靴', '时序靴'],
      ['流光靴', '天命靴', '踏云靴', '极速战靴', '龙脉靴', '刹那靴'],
    ],
  };
  const FLAVOR = {
    helm: '戴在头上的防具。',
    cape: '披在肩上的斗篷。',
    armor: '穿在身上的甲胄，让城墙更稳。',
    quiver: '背在身后的箭袋。',
    trinket: '随身带的小物件。',
    boots: '一双好鞋，跑得快、站得稳。',
  };
  // 价格：绿用铜币，蓝、紫用银币 / 金币，红用金币，金色除了每类第 1 件以外全部用钻石
  const SLOT_COST = { helm: 1, cape: 1.1, armor: 1.4, quiver: 1.2, trinket: 1, boots: 1.1 };
  const DIAMOND_LADDER = [10, 16, 25, 40, 64];
  const COST_LADDER = {
    1: (i, k) => ({ copper: Math.round((90 + i * 70 + i * i * 6) * k / 5) * 5 }),
    2: (i, k) => ({ silver: Math.round((3 + i * 1.2) * k) }),
    3: (i, k) => ({ gold: Math.max(2, Math.round((2 + i * 0.6) * k)) }),
    4: (i, k) => ({ gold: Math.round((6 + i * 1.6) * k) }),
    // 金色装备：每类第 1 件还能用金币买，其余 5 件只能用钻石，最便宜的也要 10 钻（设计书 79）
    5: (i, k) => (i === 0 ? { gold: Math.round(20 * k) } : { diamond: Math.round(DIAMOND_LADDER[i - 1] * k) }),
  };
  // 推荐关卡（只是提示，买得起就能买）
  const MIN_LEVEL = { 1: [1, 3, 5, 8, 10, 12], 2: [12, 16, 20, 24, 28, 32], 3: [30, 35, 40, 45, 50, 55], 4: [50, 56, 62, 68, 74, 80], 5: [70, 76, 82, 88, 94, 100] };

  for (const slot of Object.keys(PROFILES)) {
    const have = Object.values(D.equipment).filter((e) => e.slot === slot);
    for (let tier = 1; tier <= 5; tier++) {
      const owned = have.filter((e) => e.rarity === tier).length;
      for (let i = owned; i < 6; i++) {
        const prof = PROFILES[slot][i];
        const m = TIER_MULT[tier];
        const stats = {};
        const mods = {};
        const lines = [];
        for (const k of Object.keys(prof.s || {})) {
          stats[k] = k === 'atkFlat' ? Math.round(STAT_UNIT[k] * prof.s[k] * m) : Math.round(STAT_UNIT[k] * prof.s[k] * m * 1000) / 1000;
          lines.push(DESC[k](stats[k]));
        }
        for (const k of Object.keys(prof.m || {})) {
          mods[k] = Math.round(MOD_UNIT[k] * prof.m[k] * m * 1000) / 1000;
          lines.push(DESC[k](mods[k]));
        }
        const id = `g_${slot}_${tier}_${i}`;
        D.equipment[id] = {
          name: NAMES[slot][tier - 1][i],
          slot,
          rarity: tier,
          cost: COST_LADDER[tier](i, SLOT_COST[slot]),
          minLevel: MIN_LEVEL[tier][i],
          stats,
          mods,
          desc: lines.join('，'),
          gen: true,
        };
      }
    }
  }

  // ---------- 价格调整（设计书 89） ----------
  // 装备（头盔、披风、盔甲、箭袋、饰品、鞋子）和武器的价格按品质乘一个倍数；被动技能另算。
  // 倍数写在这里，想再贵 / 便宜一点只改这一处。
  D.priceMult = { gear: { 1: 6, 2: 6, 3: 4, 4: 3, 5: 2 }, passive: 8 };
  const scaleCost = (cost, m) => {
    const out = {};
    for (const k of Object.keys(cost || {})) out[k] = Math.round(cost[k] * m);
    return out;
  };
  for (const e of Object.values(D.equipment)) e.cost = scaleCost(e.cost, D.priceMult.gear[e.rarity] || 1);
  for (const w of Object.values(D.weapons)) if (w.cost) w.cost = scaleCost(w.cost, D.priceMult.gear[w.rarity] || 1);
  for (const p of Object.values(D.passiveSkills)) p.cost = scaleCost(p.cost, D.priceMult.passive);
})((globalThis.TD = globalThis.TD || {}));
