// 雇佣兵兵种天赋：每个兵种在 3 / 6 / 9 级各有一次"二选一"。选了就生效；改选要花铜币（洗点）。
// 每条天赋的 fx 是一组数值开关，由 src/game/mercs.js 的 deployMerc 折算到兵身上。数值都是估计值，已用机器人 A/B 校准过。
// fx 字段：aspd 攻速 / dmg 伤害 / hp 血量（都是比例）；reduce 额外减伤；armorDmg 对高护甲怪的额外伤害；reflect 反伤比例；
// pierce 额外穿透个数；burn 灼烧（每秒 = 伤害 × 此值，3 秒）；slow 减速（2 秒）；aoe 爆炸半径加成；killHeal 击杀回血；
// nth {n,mult} 每 n 次攻击一次放大；cleave 顺劈比例；flyDmg 对飞行怪额外伤害；crit 暴击率（2 倍）；regen 每秒回血；
// cover 盾墙额外减伤；lowReduce 半血以下额外减伤；surviveOnce 致命伤害时保留的血量比例（仅一次）；
// healMult 治疗量加成；healRate 治疗间隔缩短；healShare 同时给第二个伤员的比例；protect {dur,dr} 治疗附带的减伤；
// wallHeal 城墙治疗倍率；lowHeal 目标血量低于 35% 时的治疗倍率；chargeSplash 冲锋溅射比例；chargeHeal 冲锋后回血；recharge 冲锋再次可用的间隔（秒）。
(function (TD) {
  'use strict';

  TD.config.merc.talentLevels = [3, 6, 9];
  TD.config.merc.respecBase = 60; // 改选天赋的铜币：respecBase × 档位（第 1 / 2 / 3 档）

  const T = (id, name, icon, desc, fx) => ({ id, name, icon, desc, fx });

  TD.data.mercTalents = {
    swordsman: [
      [
        T('flurry', '连斩', 'bolt', '攻速 +20%。', { aspd: 0.2 }),
        T('breaker', '破甲', 'target', '对高护甲的怪伤害 +30%。', { armorDmg: 0.3 }),
      ],
      [
        T('bloodlust', '嗜血', 'heart', '每击败一只怪，回复 15% 最大血量。', { killHeal: 0.15 }),
        T('smash', '重击', 'swords', '每第 4 次攻击造成 1.8 倍伤害。', { nth: { n: 4, mult: 1.8 } }),
      ],
      [
        T('whirl', '剑旋', 'wind', '攻击同时劈中身边的怪，造成 50% 伤害。', { cleave: 0.5 }),
        T('undying', '不死', 'shield', '每场第一次受到致命伤害时，保留 30% 血量。', { surviveOnce: 0.3 }),
      ],
    ],
    guard: [
      [
        T('bulwark', '铁壁', 'wall', '减伤从 35% 提高到 45%。', { reduce: 0.1 }),
        T('vengeance', '复仇', 'flame', '被打时，把受到伤害的 20% 反弹给攻击者。', { reflect: 0.2 }),
      ],
      [
        T('plate', '厚甲', 'helm', '最大血量 +20%。', { hp: 0.2 }),
        T('fortify', '加固盾墙', 'shield', '盾墙让后排兵的减伤从 30% 提高到 45%。', { cover: 0.15 }),
      ],
      [
        T('immovable', '不动如山', 'wall', '血量低于一半时，额外减伤 15%。', { lowReduce: 0.15 }),
        T('recover', '战地自愈', 'heart', '每秒回复 2% 最大血量。', { regen: 0.02 }),
      ],
    ],
    archer: [
      [
        T('pierce', '穿云', 'arrow', '箭矢可以射穿 2 个目标。', { pierce: 1 }),
        T('rapid', '速射', 'bolt', '攻速 +25%。', { aspd: 0.25 }),
      ],
      [
        T('precise', '精准', 'target', '25% 几率暴击，造成 2 倍伤害。', { crit: 0.25 }),
        T('hunter', '空中猎手', 'wind', '对飞行怪伤害 +50%。', { flyDmg: 0.5 }),
      ],
      [
        T('venom', '毒箭', 'flame', '命中后让怪中毒 3 秒。', { burn: 0.2 }),
        T('tough', '坚韧', 'helm', '最大血量 +40%。', { hp: 0.4 }),
      ],
    ],
    mage: [
      [
        T('blaze', '烈焰', 'flame', '爆炸附带灼烧，持续 3 秒。', { burn: 0.15 }),
        T('frost', '寒霜', 'snowflake', '爆炸让怪减速 40%，持续 2 秒。', { slow: 0.4 }),
      ],
      [
        T('wide', '扩爆', 'sparkles', '爆炸范围 +25%。', { aoe: 0.25 }),
        T('focus', '聚能', 'spark', '伤害 +20%。', { dmg: 0.2 }),
      ],
      [
        T('quick', '速咏', 'bolt', '攻速 +25%。', { aspd: 0.25 }),
        T('meteor', '陨星', 'star', '每第 3 发造成 1.9 倍伤害。', { nth: { n: 3, mult: 1.9 } }),
      ],
    ],
    cleric: [
      [
        T('aegis', '庇护', 'shield', '治疗时，让目标 3 秒内减伤 20%。', { protect: { dur: 3, dr: 0.2 } }),
        T('revive', '复苏', 'heart', '治疗量 +30%。', { healMult: 0.3 }),
      ],
      [
        T('group', '群疗', 'sparkles', '同时治疗第二个受伤的友军，回复量 50%。', { healShare: 0.5 }),
        T('prayer', '速祷', 'bolt', '治疗间隔缩短 20%。', { healRate: 0.2 }),
      ],
      [
        T('wallbless', '城墙祝福', 'wall', '给城墙的治疗提高到 3 倍。', { wallHeal: 3 }),
        T('triage', '战地急救', 'heart', '目标血量低于 35% 时，治疗量变为 1.8 倍。', { lowHeal: 1.8 }),
      ],
    ],
    knight: [
      [
        T('trample', '践踏', 'horn', '冲锋撞击会波及周围的怪，造成 60% 冲击伤害。', { chargeSplash: 0.6 }),
        T('resolve', '不屈', 'heart', '冲锋之后回复 20% 最大血量。', { chargeHeal: 0.2 }),
      ],
      [
        T('barding', '铁甲', 'helm', '减伤 15%。', { reduce: 0.15 }),
        T('lance', '长枪', 'arrow', '伤害 +15%。', { dmg: 0.15 }),
      ],
      [
        T('recharge', '复冲', 'horn', '每 10 秒可以再冲锋一次。', { recharge: 10 }),
        T('elite', '精锐', 'crown', '最大血量 +25%，伤害 +10%。', { hp: 0.25, dmg: 0.1 }),
      ],
    ],
  };

  // 某个兵种在某个等级、某组选择下生效的天赋（返回合并后的 fx；没有就是 {}）
  TD.data.mercTalentFx = function (id, level, picks) {
    const tiers = TD.data.mercTalents[id] || [];
    const fx = {};
    (picks || []).forEach((c, i) => {
      if (c !== 0 && c !== 1) return;
      if (level < TD.config.merc.talentLevels[i]) return;
      const t = tiers[i] && tiers[i][c];
      if (!t) return;
      for (const k of Object.keys(t.fx)) {
        const v = t.fx[k];
        fx[k] = typeof v === 'number' && typeof fx[k] === 'number' ? fx[k] + v : v;
      }
    });
    return fx;
  };
})((globalThis.TD = globalThis.TD || {}));
