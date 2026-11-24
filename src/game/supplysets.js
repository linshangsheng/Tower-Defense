// 补给羁绊（设计书 206）：同一场战斗里凑齐两张搭配的补给卡，额外触发一个羁绊效果。
// 拿了其中一张之后，后面的补给有一定概率把它的搭档放进三选一里（C.supplySetBias），让羁绊凑得出来；
// 补给卡上会标出"组成羁绊"/"羁绊：还差谁"，选卡多了一层取舍。
(function (TD) {
  'use strict';

  const C = TD.config;
  const D = TD.data;
  C.supplySetBias = 0.4;

  D.supplySets = [
    { id: 'marksman', name: '神射手', cards: ['sharp', 'eagle'], mods: { crit: 0.06, critDmg: 0.2 }, desc: '暴击率 +6%，暴击伤害 +20%' },
    { id: 'rapid', name: '连珠快箭', cards: ['quick', 'farsight'], mods: { aspdMult: 0.08, range: 0.06 }, desc: '攻击速度 +8%，射程 +6%' },
    { id: 'wildfire', name: '燎原', cards: ['ember', 'arcane'], mods: { igniteChance: 0.15, magicMult: 0.1 }, desc: '点燃几率 +15%，魔法伤害 +10%' },
    { id: 'tempest', name: '雷霆万钧', cards: ['chain', 'arcane'], mods: { chainChance: 0.1, magicMult: 0.1 }, desc: '连锁闪电几率 +10%，魔法伤害 +10%' },
    { id: 'permafrost', name: '冰封千里', cards: ['frostTip', 'coldSnap'], mods: { slowedDmg: 0.2 }, desc: '对减速 / 冰冻中的怪伤害 +20%' },
    { id: 'dragonslayer', name: '屠龙者', cards: ['hunter', 'godslayer'], mods: { bossDmg: 0.2 }, desc: '对 Boss 伤害再 +20%' },
    { id: 'treasury', name: '聚宝盆', cards: ['purse', 'midas'], mods: { copperBonus: 0.25 }, desc: '本关铜币收益再 +25%' },
    { id: 'bulwark', name: '金城汤池', cards: ['bricks', 'fortress'], mods: { wallDr: 0.06, waveShield: 0.06 }, desc: '城墙受到伤害再 −6%，每波护盾再 +6%' },
    { id: 'headsman', name: '断头台', cards: ['executioner', 'breaker'], mods: { execute: 0.25, armorIgnore: 0.1 }, desc: '处决伤害再 +25%，再无视 10% 护甲' },
    { id: 'lifespring', name: '生生不息', cards: ['mender', 'hospital'], mods: { killHeal: 0.002, mendBonus: 0.02 }, desc: '击杀回复城墙再 +0.2%，每波结束回复 2%' },
  ].filter((s) => s.cards.every((id) => D.supplies[id]));

  D.supplySetsOf = (id) => D.supplySets.filter((s) => s.cards.includes(id));

  Object.assign(TD.Battle.prototype, {
    // 选完一张补给后：凑齐了的羁绊生效（每个只生效一次）
    checkSupplySets() {
      this.activeSets = this.activeSets || [];
      const got = [];
      for (const s of D.supplySets) {
        if (this.activeSets.includes(s.id)) continue;
        if (!s.cards.every((id) => this.supplyPicked.includes(id))) continue;
        for (const k of Object.keys(s.mods)) this.mods[k] = (this.mods[k] || 0) + s.mods[k];
        this.activeSets.push(s.id);
        got.push(s);
        this.emit('supplySet', { set: s });
      }
      return got;
    },

    // 已经拿了羁绊的一半：这次三选一有概率把另一半换进来（替换最后一张）
    biasSupplyChoices(choices, ok) {
      if (!this.supplyPicked.length || choices.length < 3) return choices;
      const want = [];
      for (const s of D.supplySets) {
        if ((this.activeSets || []).includes(s.id)) continue;
        const have = s.cards.filter((id) => this.supplyPicked.includes(id));
        if (!have.length) continue;
        for (const id of s.cards) if (!this.supplyPicked.includes(id) && ok(id) && !choices.includes(id) && !want.includes(id)) want.push(id);
      }
      if (!want.length || this.rng() >= C.supplySetBias) return choices;
      const pick = want[Math.floor(this.rng() * want.length) % want.length];
      const out = choices.slice();
      out[out.length - 1] = pick;
      return out;
    },

    // 补给界面用：这张卡和已选的卡能组成什么 / 属于哪个还没凑齐的羁绊
    supplySetHint(id) {
      const sets = D.supplySetsOf(id).filter((s) => !(this.activeSets || []).includes(s.id));
      const complete = sets.find((s) => s.cards.every((c) => c === id || this.supplyPicked.includes(c)));
      if (complete) return { kind: 'complete', set: complete };
      if (sets.length) {
        const s = sets[0];
        const partner = s.cards.find((c) => c !== id);
        return { kind: 'part', set: s, partner };
      }
      return null;
    },
  });
})((globalThis.TD = globalThis.TD || {}));
