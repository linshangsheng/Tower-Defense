// 契约（设计书 208）：第 15 关起，补给三选一旁边有时会多出第 4 张"契约卡"——
// 接受一个诅咒（之后的怪更硬 / 更快 / 更多，或者城墙变薄），换一张红 / 金品质的补给卡，外加本关铜币 +20%。
// 不想冒险就当它不存在。契约用自己的随机数，机器人从不接受契约，所有已标定的数值和回放都不变。
(function (TD) {
  'use strict';

  const C = TD.config;
  const D = TD.data;
  C.pact = { from: 15, chance: 0.35, copperBonus: 0.2 };

  D.pactCurses = {
    hp: { name: '血肉契约', desc: '之后出场的怪物血量 +25%', apply: (b) => (b.curseHp = (b.curseHp || 0) + 0.25) },
    speed: { name: '疾风契约', desc: '所有怪物移动速度 +15%', apply: (b) => (b.curseSpeed = (b.curseSpeed || 0) + 0.15) },
    count: { name: '群魔契约', desc: '之后每波的怪物数量 +25%', apply: (b) => (b.curseCount = (b.curseCount || 0) + 0.25) },
    wall: {
      name: '断垣契约',
      desc: '城墙最大血量 −15%',
      apply: (b) => {
        b.wall.max = Math.max(1, Math.round(b.wall.max * 0.85));
        b.wall.hp = Math.min(b.wall.hp, b.wall.max);
      },
    },
  };

  Object.assign(TD.Battle.prototype, {
    pactOn() {
      return typeof this.levelNo === 'number' && this.levelNo >= C.pact.from && !this.level.tower && !this.level.endless && !this.mode && !this.autoSupply;
    },

    // 补给到了时调用：有概率准备一张契约卡（只在这次补给有效）
    rollPact() {
      this.pendingPact = null;
      if (!this.pactOn()) return null;
      if (!this.pactRng) this.pactRng = TD.util.rng(((this.seedVal || 1) * 7919 + 17) >>> 0);
      const r = this.pactRng;
      if (r() >= C.pact.chance) return null;
      const pool = Object.keys(D.supplies).filter((id) => {
        const s = D.supplies[id];
        if (!['red', 'gold'].includes(s.rarity) || this.supplyPicked.includes(id) || (this.pendingSupply || []).includes(id)) return false;
        if (s.needSkills && !this.skills.length) return false;
        if (s.minLevel && this.stage < s.minLevel) return false;
        return true;
      });
      if (!pool.length) return null;
      const taken = this.pactsTaken || [];
      const curses = Object.keys(D.pactCurses).filter((k) => !taken.includes(k));
      if (!curses.length) return null;
      this.pendingPact = { curse: curses[Math.floor(r() * curses.length) % curses.length], card: pool[Math.floor(r() * pool.length) % pool.length] };
      return this.pendingPact;
    },

    // 接受契约：诅咒生效 + 拿到那张补给卡（走正常的选卡流程）+ 铜币加成
    choosePact() {
      const p = this.pendingPact;
      if (!p || !this.pendingSupply) return false;
      D.pactCurses[p.curse].apply(this);
      this.mods.copperBonus += C.pact.copperBonus;
      this.pactsTaken = (this.pactsTaken || []).concat(p.curse);
      this.pendingPact = null;
      this.emit('pact', { curse: p.curse, card: p.card });
      this.pendingSupply = this.pendingSupply.concat(p.card);
      return this.chooseSupply(p.card);
    },
  });
})((globalThis.TD = globalThis.TD || {}));
