// 完美防守（设计书 199）：一波怪从出现到全部倒下，城墙一滴血都没掉——这一波算"完美防守"，
// 奖励一小笔铜币；连续完美越多奖励越高（最多 ×2），一旦城墙被打到连击就断。
// 让前期"城墙满血也能通关"的关卡也有追求：不只是赢，还要守得漂亮。突袭关（波次重叠）和九层妖塔不算。
(function (TD) {
  'use strict';

  const C = TD.config;
  C.perfectWave = { pct: 0.03, stepMult: 0.25, maxMult: 2 };

  Object.assign(TD.Battle.prototype, {
    // 本关能不能打完美防守
    perfectWaveOn() {
      return this.level.type !== 'rush' && !this.level.tower;
    },

    // 一波开始时记下城墙累计伤害
    markPerfectWave() {
      this.waveDmgMark = this.wallDamageTaken;
    },

    // 场上清空（这一波打完）时结算；返回是否完美
    checkPerfectWave() {
      if (!this.perfectWaveOn() || this.waveIndex < 0 || this.waveDmgMark === undefined) return false;
      if (this.perfectChecked === this.waveIndex) return false;
      this.perfectChecked = this.waveIndex;
      if (this.wallDamageTaken > this.waveDmgMark + 1e-6) {
        if (this.perfectStreak > 0) this.emit('perfectBreak', { streak: this.perfectStreak });
        this.perfectStreak = 0;
        return false;
      }
      const W = C.perfectWave;
      this.perfectStreak = (this.perfectStreak || 0) + 1;
      this.perfectWaves = (this.perfectWaves || 0) + 1;
      this.bestPerfectStreak = Math.max(this.bestPerfectStreak || 0, this.perfectStreak);
      const mult = Math.min(W.maxMult, 1 + W.stepMult * (this.perfectStreak - 1));
      const n = typeof this.levelNo === 'number' && this.levelNo > 0 ? this.levelNo : 1;
      const base = C.rewards.baseCopper(n);
      const bonus = this.level.endless ? 0 : Math.max(1, Math.round(base * W.pct * mult * (1 + (this.mods.perfectCopper || 0))));
      // 完美主义者（补给卡，设计书 211）：每次完美防守攻击力 +4%，最多 5 层
      if (this.mods.perfectAtk && (this.perfectStacks || 0) < 5) {
        this.perfectStacks = (this.perfectStacks || 0) + 1;
        this.mods.atkMult += this.mods.perfectAtk;
        this.emit('perfectStack', { stacks: this.perfectStacks });
      }
      this.perfectCopper = (this.perfectCopper || 0) + bonus;
      // 无懈可击（羁绊，设计书 216）：完美防守时回复城墙
      if (this.mods.perfectHeal) this.healWall(this.wall.max * this.mods.perfectHeal, 'supply');
      this.emit('perfectWave', { streak: this.perfectStreak, bonus, mult });
      return true;
    },
  });
})((globalThis.TD = globalThis.TD || {}));
