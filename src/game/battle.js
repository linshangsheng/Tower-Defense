// 战斗逻辑（与画面完全分离，可在 Node 中无头运行，设计书 2 章、9 章、13.2）
(function (TD) {
  'use strict';

  const C = TD.config;
  const D = TD.data;

  let nextId = 1;

  // 技能协同（设计书 45）
  // 雷霆一击两道雷之间的间隔：次数多时压紧，整套雷不超过约 1.2 秒
  const thunderEvery = (n) => Math.min(0.22, 1.2 / n);
  const SYNERGY = { shatter: D.synergies.shatter.mult, drumRain: D.synergies.drumRain.mult };
  const AUTO_ORDER = { drum: 1, clones: 1.5, frost: 2, mark: 2.5, repair: 3, arrowRain: 4, thunder: 5, firewall: 5.5, vortex: 6, pierce: 7 };
  // 外放型被动技能（设计书 103）：每次攻击按几率额外放出一个效果
  const PROC_IDS = ['lightning', 'frostNova', 'fireball', 'spiritArrows', 'bladeWave', 'renewal'];
  // 英雄自己的攻击（受盾龟护卫影响）：武器、溅射、连锁闪电
  const HERO_SOURCES = { weapon: true, splash: true, chain: true, zap: true, firefly: true };

  // 连击提示（设计书 38.2）
  const STREAK_CALLS = { 10: '10 连击！', 20: '横扫千军！', 30: '势不可挡！', 50: '无人能挡！' };

  // Boss AI 的 update 方法名（实现在 src/game/bosses.js）
  const BOSS_UPDATE = {
    boarKing: 'updateBoarKing',
    kingScorpion: 'updateKingScorpion',
    pharaoh: 'updatePharaoh',
    boneMage: 'updateBoneMage',
    witch: 'updateWitch',
    iceGiant: 'updateIceGiant',
    frostQueen: 'updateFrostQueen',
    rockGolem: 'updateRockGolem',
    inkBoss: 'updateInkBoss',
    windGiant: 'updateWindGiant',
    thunderKing: 'updateThunderKing',
    pearlClam: 'updatePearlClam',
    octoKing: 'updateOctoKing',
  };

  // 不当"多出来的小怪"的怪（设计书 84）：Boss、妖塔分身，要停在远处的（成百上千只一起远程攻击没法玩），会影响别的怪或英雄的
  const FODDER_DENY = ['boss', 'towerOf', 'bossPart', 'ai', 'healer', 'ranged', 'chill', 'bubbler', 'fireZone', 'onDeath', 'staticShock', 'stealth'];

  class Battle extends TD.Emitter {
    // opts: { level, stats, loadout: {active, items, target, autoCast}, seed, autoItems }
    constructor(opts) {
      super();
      // opts.levelDef：自定义关卡（无尽模式、每日挑战）；stage：用于补给卡池、场景的"等效关卡号"
      this.levelNo = opts.level;
      this.level = opts.levelDef || D.levels[opts.level];
      this.stage = opts.stage || (typeof opts.level === 'number' ? opts.level : 1);
      this.D = C.difficulty(this.stage);
      this.rules = this.level.rules || {};
      const diff = C.difficulties[opts.difficulty || 'normal'] || C.difficulties.normal;
      this.diffHp = 1 + diff.hp;
      this.diffDmg = 1 + diff.dmg;
      this.stats = opts.stats;
      this.rng = TD.util.rng(opts.seed || Date.now());
      this.lanes = this.level.lanes;
      this.time = 0;
      this.over = false;
      this.result = null;

      this.rally = opts.rally || 0; // 援军鼓舞（设计书 27.5）
      const wallMult = (1 + (this.rules.wallHp || 0)) * (this.rules.wallHalf ? 0.5 : 1) * (1 + this.rally);
      this.wall = { hp: Math.round(this.stats.wallMax * wallMult), max: Math.round(this.stats.wallMax * wallMult) };
      // 九层妖塔：上一层打完剩多少血，这一层就从多少血开始，不会恢复（设计书 78.2）
      if (this.level.startWallRatio > 0 && this.level.startWallRatio < 1) this.wall.hp = Math.max(1, Math.round(this.wall.max * this.level.startWallRatio));
      this.monsters = [];
      this.projectiles = [];
      this.laneEffects = []; // {lane, type:'frost'|'freeze', until}
      this.buffs = []; // {aspd, until, src}
      this.target = opts.loadout.target || 'nearest';
      this.autoCast = !!opts.loadout.autoCast;
      this.autoItems = !!opts.autoItems;

      const lvs = opts.loadout.activeLv || {};
      this.skills = (opts.loadout.active || []).map((id) => {
        const lv = lvs[id] || 1;
        // 第 3 级以后继续按等级加强（设计书 76.2）
        const def = TD.progression.skillDef(id, lv);
        return { id, lv, def, cd: 0 };
      });
      this.tempDr = { amt: 0, until: 0 };
      // 道具（设计书 82）：每种带 1–3 个（itemQty），用一次少一个；用完一次要等这一种的冷却；left = 剩余个数，cd = 冷却剩余秒数
      const qty = opts.loadout.itemQty || {};
      this.items = (opts.loadout.items || [])
        .filter((id) => !D.items[id].passive)
        .map((id) => ({ id, def: D.items[id], left: Math.max(1, Math.min(D.itemRules.perKind, qty[id] || 1)), cd: 0 }));
      this.charm = (opts.loadout.items || []).includes('charm');
      this.itemsUsed = [];
      if (this.charm) this.itemsUsed.push('charm');

      this.hero = { cooldown: 0.6, attacks: 0, aimX: C.width / 2, aimY: C.height / 2, shotAt: -1, castId: null, castAt: -99, castLane: undefined, castStrikes: 0, castEvery: 0 };
      this.heroY = (C.fieldTop + C.fieldBottom) / 2;

      // 波次
      this.waveIndex = -1;
      this.waveState = 'prepare'; // prepare | spawning | waiting | final
      this.countdown = 3;
      this.spawnQueue = [];
      this.spawnTimer = 0;
      this.waveStartTime = 0;

      // 战场补给（设计书 2.7）
      this.mods = { atkMult: 0, aspdMult: 0, crit: 0, critDmg: 0, cdMult: 0, copperBonus: 0, wallDr: 0, range: 0, slowOnHit: 0, magicMult: 0, armorIgnore: 0, dotReduce: 0, spiritPierce: 0, chillResist: 0, igniteOnHit: 0, fireproof: 0, reveal: 0, woolCut: 0, stunImmune: 0, dodgeCut: 0, slowAll: 0, shellCut: 0, pinPop: 0, leapCut: 0, bossDmg: 0, flyDmg: 0, slowedDmg: 0, igniteChance: 0, darkSight: 0, frostExt: 0, mendBonus: 0, lowWallAtk: 0, healBonus: 0, waveShield: 0, execute: 0, killHeal: 0, chainChance: 0, revive: 0, waveStrike: 0 };
      // 装备和套装的特殊效果（设计书 58）
      const gm = this.stats.gearMods || {};
      for (const k of Object.keys(gm)) this.mods[k] = (this.mods[k] || 0) + gm[k];
      // 英雄的专属能力（设计书 59）
      const hm = this.stats.heroMods || {};
      for (const k of Object.keys(hm)) this.mods[k] = (this.mods[k] || 0) + hm[k];
      this.zapCount = 0;
      this.fireflyCount = 0;
      this.itemShield = 0;
      this.meteors = [];
      this.copperMult = 1; // 幸运铜币：这段时间内击败的怪掉落倍数
      this.copperMultUntil = 0;
      this.tempThorns = 0; // 反射盾
      this.tempThornsUntil = 0;
      this.goldenShots = 0; // 黄金箭：接下来几次攻击必定暴击
      this.goldenMult = 1;
      this.reviveHeal = 0.6; // 复活时回复的比例（凤凰之羽更高）
      this.timers = []; // 稍后执行的小动作（飞行中的火球、灵箭、剑气），{at, fn}
      this.procCd = {};
      this.vortexes = [];
      this.fireWalls = [];
      this.phantomScale = 1;
      this.inPhantom = false;
      // 助战伙伴（设计书 51）
      this.buddy = (opts.loadout && opts.loadout.buddy && D.town.find((f) => f.boss === opts.loadout.buddy)) || null;
      if (this.buddy) {
        const pk = this.buddy.perk;
        for (const k of Object.keys(pk.mods || {})) this.mods[k] += pk.mods[k];
        if (pk.shot) this.buddyTimer = pk.shot.every;
      }
      this.storm = false; // 雷雷第三阶段的暴风雨：全场怪物加速（设计书 33.3）
      this.whirl = false; // 波波第三阶段的大漩涡（设计书 52.3）
      this.guards = []; // 活着的盾龟（设计书 52.2）
      this.bubblesPopped = 0;
      this.zones = []; // 地面区域：{ x, y, r, until, haste }
      this.heroStunUntil = 0;
      this.chillStacks = 0;
      this.wallSealedUntil = 0;
      this.pack = null;
      this.wallDots = []; // 城墙持续伤害：{ dps, until, src }
      this.dotTick = 0.5;
      this.extraPlan = this.planExtraMonsters(opts);
      this.returnBosses = this.planReturnBosses(opts);
      this.killSilver = 0;
      this.supplyWaves = this.computeSupplyWaves();
      this.supplyOffered = {};
      this.supplyPicked = [];
      this.delayed = []; // 下一波开始后才触发的补给效果（空袭、冰封令）
      this.pendingSupply = null;
      this.autoSupply = !!opts.autoSupply;
      this.castCount = 0;

      this.killsByType = {};
      this.interrupts = 0;
      this.earlyCalls = 0;
      this.skillsCast = 0; // 关卡任务（设计书 36）
      this.combos = {}; // 技能协同触发次数（设计书 45）
      this.streak = 0; // 连击（设计书 38.2）
      this.bestStreak = 0;
      this.lastKillAt = -99;
      this.minWallRatio = 1;
      this.on('bossInterrupt', () => this.interrupts++);

      this.killCopper = 0;
      this.earlyCopper = 0;
      this.kills = 0;
      this.damageDealt = 0;
      this.wallDamageTaken = 0;
      // 战斗报告（设计书 32）
      this.report = { bySource: {}, raw: { phys: 0, magic: 0 }, real: { phys: 0, magic: 0 }, wallBy: {} };
    }

    // 回归的小 Boss（设计书 110）：第 51 关起，普通小关卡（不是小 Boss / 大 Boss / 精英挑战关）常常混进一个之前关卡里见过的小 Boss，
    // 击败得 1 银币。是否出现、出现几个、是谁，用关卡号和种子单独算，不动战斗本身的随机数。返回 [{ wave, type }]
    planReturnBosses(opts) {
      if (opts.levelDef || typeof opts.level !== 'number' || !D.levels[opts.level] || this.level.tower || this.level.endless) return [];
      const n = opts.level;
      if (n < C.returnBossFromLevel || ['miniboss', 'boss', 'elite'].includes(this.level.type)) return [];
      const rng = TD.util.rng((Math.floor(opts.seed || 1) % 100003) * 7919 + n * 131 + 17);
      if (rng() >= C.returnBossChance) return [];
      const pool = [];
      for (let k = 1; k < n; k++) {
        const lv = D.levels[k];
        if (!lv || lv.type !== 'miniboss') continue;
        for (const w of lv.waves) for (const [type] of w.groups) if (D.monsters[type].boss && !D.monsters[type].towerOf && !pool.includes(type)) pool.push(type);
      }
      if (!pool.length) return [];
      const count = Math.min(pool.length, 1 + (n >= C.returnBossLateFrom && rng() < C.returnBossSecondChance ? 1 : 0));
      const waves = this.level.waves.length;
      const out = [];
      for (let i = 0; i < count; i++) {
        const type = pool.splice(Math.floor(rng() * pool.length), 1)[0];
        out.push({ wave: i === 0 ? Math.min(waves - 1, Math.floor(waves * 0.6)) : waves - 1, type });
      }
      return out;
    }

    // 主线第 N 关（N ≥ C.extraFromLevel）多出的小怪（设计书 84）：总数 = N × C.extraMonstersPerLevel。先按各波原有小怪数量的比例
    // 分给各波（最大余数法，保证加起来正好），再在波内按本关能当小怪的各组数量的比例分给各组。和原有的同类怪一模一样，Boss 不加。
    // 返回每一波的 [[怪物, 数量], …]。无尽模式、每日挑战、九层妖塔（自带关卡定义）不加。
    planExtraMonsters(opts) {
      const none = this.level.waves.map(() => null);
      if (opts.levelDef || typeof opts.level !== 'number' || !D.levels[opts.level] || this.level.tower || this.level.endless) return none;
      if (opts.level < (C.extraFromLevel || 1)) return none;
      const total = Math.round(opts.level * (C.extraMonstersPerLevel || 0));
      const cm = (this.level.countMult || 1) * (1 + (this.rules.countBonus || 0));
      const count = (count) => Math.max(1, Math.round(count * cm));
      const fodder = (type) => !FODDER_DENY.some((k) => D.monsters[type][k]);
      // 本关一只能当小怪的都没有（比如全是远程怪）时，用本章别的关卡里最弱的候选，再没有就用史莱姆
      const levelHas = this.level.waves.some((w) => w.groups.some(([type]) => fodder(type)));
      // 各波的权重：这一波里能当小怪的各组数量之和（没有候选时按这一波所有非 Boss 的怪）
      const waveSums = this.level.waves.map((w) => w.groups.reduce((a, [type, c]) => a + ((levelHas ? fodder(type) : !D.monsters[type].boss) ? count(c) : 0), 0));
      if (!total || !waveSums.some((x) => x > 0)) return none;
      const share = (weights, amount) => {
        const sum = weights.reduce((a, b) => a + b, 0);
        const raw = weights.map((w) => (sum ? (amount * w) / sum : 0));
        const out = raw.map(Math.floor);
        let rest = amount - out.reduce((a, b) => a + b, 0);
        const order = raw.map((r, k) => [r - Math.floor(r), k]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
        for (let k = 0; rest > 0 && k < order.length; k++, rest--) out[order[k][1]]++;
        return out;
      };
      let fallback = null;
      if (!levelHas) {
        const types = [];
        for (const n of D.chapterOf(opts.level).levels) for (const w of D.levels[n].waves) for (const [type] of w.groups) if (fodder(type) && !types.includes(type)) types.push(type);
        fallback = types.reduce((a, b) => (a === null || D.monsters[b].hp < D.monsters[a].hp ? b : a), null) || 'slime';
      }
      const perWave = share(waveSums, total);
      return this.level.waves.map((w, wi) => {
        if (!perWave[wi]) return null;
        if (fallback) return [[fallback, perWave[wi]]];
        const groups = w.groups.filter(([type]) => fodder(type));
        if (!groups.length) return null;
        return share(groups.map(([, c]) => count(c)), perWave[wi]).map((n, k) => [groups[k][0], n]).filter(([, n]) => n > 0);
      });
    }

    // 补给出现在哪几波之后（波序号从 0 开始）
    computeSupplyWaves() {
      const n = this.level.waves.length;
      if (this.level.supplyEvery) {
        const out = [];
        for (let i = this.level.supplyEvery - 1; i < n - 1; i += this.level.supplyEvery) out.push(i);
        return out;
      }
      if (this.level.noSupply || n < 3) return [];
      if (this.level.type === 'boss' || n < 5) return [1];
      // 第 2 波后起每 3 波一次，最后一波之前不再给，最多 4 次（设计书 71.5）
      const out = [];
      for (let i = 1; i <= n - 2 && out.length < 4; i += 3) out.push(i);
      return out;
    }

    get atk() {
      // 背水徽章：城墙血量低于 50% 时攻击力提高（设计书 58.3）
      const low = this.mods.lowWallAtk && this.wall.hp < this.wall.max * 0.5 ? this.mods.lowWallAtk : 0;
      let buff = 0;
      for (const b of this.buffs) if (b.atk && this.time < b.until) buff += b.atk;
      return this.stats.atk * (1 + this.mods.atkMult + low + buff) * (1 + this.rally);
    }

    get range() {
      // 暗夜射程 −30%；夜枭盔把惩罚减半
      const dark = this.level.dark ? 1 - 0.3 * (1 - Math.min(1, this.mods.darkSight || 0)) : 1;
      return this.stats.range * (1 + this.mods.range) * dark;
    }

    offerSupply() {
      const all = Object.keys(D.supplies).filter((id) => {
        if (this.supplyPicked.includes(id)) return false;
        if (D.supplies[id].needSkills && !this.skills.length) return false;
        if (D.supplies[id].minLevel && this.stage < D.supplies[id].minLevel) return false;
        return true;
      });
      // 按档抽卡（设计书 73）：蓝 / 紫 / 红 / 金，品质越高概率越低；抽不到的档位回退到别的档
      const W = D.supplyWeights[Math.min(D.supplyWeights.length - 1, this.supplyPicked.length)];
      const tiers = ['blue', 'purple', 'red', 'gold'];
      const choices = [];
      while (choices.length < 3 && all.length) {
        let r = this.rng() * W.reduce((a, b) => a + b, 0);
        let tier = 0;
        while (tier < tiers.length - 1 && r >= W[tier]) r -= W[tier++];
        let pool = all.filter((id) => (D.supplies[id].rarity || 'blue') === tiers[tier]);
        if (!pool.length) pool = all;
        // 章节专用克制卡被抽到的机会减半，免得蓝档里全是它们
        const wts = pool.map((id) => (D.supplies[id].minLevel ? 0.5 : 1));
        let x = this.rng() * wts.reduce((a, b) => a + b, 0);
        let k = 0;
        while (k < pool.length - 1 && x >= wts[k]) x -= wts[k++];
        const id = pool[k];
        all.splice(all.indexOf(id), 1);
        choices.push(id);
      }
      this.supplyOffered[this.waveIndex] = true;
      this.pendingSupply = choices;
      this.emit('supply', { choices });
      if (this.autoSupply) this.chooseSupply(this.botSupplyChoice(choices));
    }

    botSupplyChoice(choices) {
      if (this.wall.hp / this.wall.max < 0.6) for (const id of ['hospital', 'bricks']) if (choices.includes(id)) return id;
      for (const id of D.supplyBotOrder) if (choices.includes(id)) return id;
      return choices[0];
    }

    chooseSupply(id) {
      if (!this.pendingSupply || !this.pendingSupply.includes(id)) return false;
      const sup = D.supplies[id];
      for (const k of Object.keys(sup.mods)) this.mods[k] += sup.mods[k];
      if (sup.heal) this.healWall(this.wall.max * sup.heal, 'supply');
      if (sup.refresh) for (const sk of this.skills) sk.cd = 0;
      if (sup.buff) this.buffs.push({ atk: sup.buff.atk, until: this.time + sup.buff.dur, src: 'supply' });
      if (sup.copperNow) this.killCopper += 30 + this.stage * 4;
      if (sup.delayed) this.delayed.push({ kind: sup.delayed.kind, def: sup.delayed, at: null });
      this.supplyPicked.push(id);
      this.pendingSupply = null;
      this.emit('supplyPicked', { id });
      this.endWaveHeal();
      this.startWave(this.waveIndex + 1);
      return true;
    }

    // 补给卡里"下一波开始后才触发"的效果（设计书 71.5）
    updateDelayed() {
      const keep = [];
      for (const d of this.delayed) {
        if (d.at === null || this.time < d.at) {
          keep.push(d);
          continue;
        }
        const pool = this.monsters.filter((m) => !m.dead && this.isTargetable(m));
        if (d.kind === 'airstrike') {
          pool.slice(0, 12).forEach((m) => this.emit('scrollBolt', { x: m.x, y: m.y + m.yOffset }));
          for (const m of pool) this.damage(m, this.atk * d.def.atkMult, { type: 'magic', fromFront: false, source: 'airstrike' });
        } else if (d.kind === 'coldSnap') {
          for (const m of this.monsters) {
            if (m.dead) continue;
            const boss = m.def.boss || m.def.bossPart;
            this.freezeMonster(m, boss ? d.def.bossDur : d.def.dur);
          }
          for (let l = 0; l < this.lanes; l++) this.laneEffects.push({ lane: l, type: 'freeze', until: this.time + d.def.dur, start: this.time });
        }
      }
      this.delayed = keep;
    }

    laneY(lane) {
      const h = (C.fieldBottom - C.fieldTop) / this.lanes;
      return C.fieldTop + h * (lane + 0.5);
    }

    get totalWaves() {
      return this.level.waves.length;
    }

    // ---------- 波次 ----------
    startWave(i) {
      this.waveIndex = i;
      for (const d of this.delayed) if (d.at === null) d.at = this.time + d.def.after;
      // 天火降临：之后每一波开始 6 秒后落下
      if (this.mods.waveStrike) this.delayed.push({ kind: 'airstrike', def: { after: 6, atkMult: 4 }, at: this.time + 6 });
      const wave = this.level.waves[i];
      if (wave.D) this.D = wave.D; // 无尽模式：每波有自己的难度
      // countMult：自动平衡工具（tools/tune.js）写入的每关数量倍率，Boss 不受影响
      const cm = (this.level.countMult || 1) * (1 + (this.rules.countBonus || 0));
      // 主线关卡越靠后小怪越多（设计书 84）：整关总共多出 关卡号 × C.extraMonstersPerLevel 只小怪，和原有的怪一模一样，Boss 还是一只
      const extra = this.extraPlan[i] || [];
      const groups = wave.groups.map(([type, count]) => ({ type, left: D.monsters[type].boss ? count : Math.max(1, Math.round(count * cm)) }));
      for (const [type, count] of extra) {
        const g = groups.find((o) => o.type === type);
        if (g) g.left += count;
        else groups.push({ type, left: count });
      }
      const baseMinions = wave.groups.reduce((a, [type, count]) => a + (D.monsters[type].boss ? 0 : Math.max(1, Math.round(count * cm))), 0);
      const extraNow = extra.reduce((a, [, c]) => a + c, 0);
      const queue = [];
      let any = true;
      while (any) {
        any = false;
        for (const g of groups) {
          if (g.left > 0) {
            queue.push(g.type);
            g.left--;
            any = true;
          }
        }
      }
      for (const r of this.returnBosses) if (r.wave === i) queue.push('@' + r.type); // 回归的小 Boss 排在这一波最后
      this.spawnQueue = queue;
      // 数量倍率提高时出怪更密集，避免关卡时间被拉长
      const crowd = (cm > 1 ? cm : 1) * (baseMinions > 0 ? (baseMinions + extraNow) / baseMinions : 1);
      this.spawnGap = crowd > 1 ? wave.gap / Math.pow(crowd, 0.75) : wave.gap;
      this.spawnTimer = 0;
      this.waveState = 'spawning';
      this.waveStartTime = this.time;
      this.clearedOnce = false;
      // 贝贝的泡泡护盾（设计书 52.7）：每波开始时刷新
      if (this.buddy && this.buddy.perk.wallBubble) this.wallShield = this.wall.max * this.buddy.perk.wallBubble;
      // 潮汐套装（设计书 58.4）：和贝贝的护盾不叠加，取大的
      if (this.mods.waveShield) this.wallShield = Math.max(this.wallShield || 0, this.wall.max * this.mods.waveShield);
      this.emit('waveStart', { index: i, total: this.totalWaves, chapter: wave.chapter });
    }

    endWaveHeal() {
      const mend = this.stats.mend + (this.mods.mendBonus || 0);
      if (mend > 0 && this.waveIndex >= 0) this.healWall(this.wall.max * mend, 'mend');
      if (this.buddy && this.buddy.perk.waveHeal && this.waveIndex >= 0) this.healWall(this.wall.max * this.buddy.perk.waveHeal, 'buddy');
    }

    callNextWave() {
      if (this.waveState !== 'waiting' || this.waveIndex >= this.totalWaves - 1) return -1;
      // 妖塔里打怪没有任何收益，提前召唤也不给铜币（设计书 74.2）
      const bonus = this.level.tower ? 0 : Math.floor(this.countdown) * C.earlyCallCopperPerSec * (1 + (this.rules.earlyMult || 0));
      this.earlyCopper += bonus;
      this.earlyCalls++;
      this.countdown = 0;
      this.emit('earlyCall', { bonus });
      return bonus;
    }

    updateWaves(dt) {
      if (this.waveState === 'prepare') {
        this.countdown -= dt;
        if (this.countdown <= 0) this.startWave(0);
        return;
      }
      if (this.waveState === 'spawning') {
        this.spawnTimer -= dt;
        while (this.spawnTimer <= 0 && this.spawnQueue.length) {
          if (this.level.waves[this.waveIndex].burst) {
            // 联合关：所有车道同时各出一只
            for (let lane = 0; lane < this.lanes && this.spawnQueue.length; lane++) this.spawnFromQueue(this.spawnQueue.shift(), lane);
          } else this.spawnFromQueue(this.spawnQueue.shift());
          this.spawnTimer += this.spawnGap;
        }
        if (!this.spawnQueue.length) {
          if (this.waveIndex >= this.totalWaves - 1) {
            this.waveState = 'final';
          } else {
            this.waveState = 'waiting';
            if (this.level.type === 'rush') {
              this.countdown = Math.max(1, this.level.rushInterval - (this.time - this.waveStartTime));
            } else this.countdown = C.waveMaxDelay;
          }
        }
        return;
      }
      if (this.waveState === 'waiting') {
        if (this.level.type !== 'rush' && !this.clearedOnce && this.aliveCount() === 0) {
          this.clearedOnce = true;
          this.countdown = Math.min(this.countdown, C.waveClearDelay);
        }
        // 无尽模式：Boss 还活着时下一波不来（普通关卡的 Boss 都在最后一波）
        const bossHold = this.level.endless && this.monsters.some((m) => m.def.boss && !m.dead);
        if (!bossHold) this.countdown -= dt;
        if (this.countdown <= 0) {
          if (this.supplyWaves.includes(this.waveIndex) && !this.supplyOffered[this.waveIndex]) {
            this.offerSupply();
            return;
          }
          this.endWaveHeal();
          this.startWave(this.waveIndex + 1);
        }
        return;
      }
      if (this.waveState === 'final') {
        if (this.aliveCount() === 0) this.finish(true);
      }
    }

    aliveCount() {
      let n = 0;
      for (const m of this.monsters) if (!m.dead) n++;
      return n;
    }

    // ---------- 怪物 ----------
    // 出怪队列里的一项：'@类型' 是回归的小 Boss（血量打折，击败得银币），其余就是普通怪物
    spawnFromQueue(entry, lane) {
      if (entry[0] !== '@') return this.spawnMonster(entry, lane);
      const m = this.spawnMonster(entry.slice(1), lane);
      m.returning = true;
      m.hp = m.maxHp = Math.max(1, Math.round(m.maxHp * C.returnBossHpMult));
      this.emit('bossReturn', { m, type: m.type });
      return m;
    }

    spawnMonster(type, lane, x) {
      const def = D.monsters[type];
      if (lane === undefined && def.pack) {
        // 狼群：同一组从同一条车道出来
        if (!this.pack || this.pack.type !== type || this.pack.left <= 0) this.pack = { type, lane: this.rng.int(this.lanes), left: def.pack };
        lane = this.pack.lane;
        this.pack.left--;
      }
      if (lane === undefined && def.boss && !def.towerOf) {
        // Boss 走中间车道；已经有 Boss 在中间时（精英挑战两两出场）换到旁边的车道
        const mid = Math.floor(this.lanes / 2);
        const taken = (l) => this.monsters.some((o) => !o.dead && o.def.boss && o.lane === l);
        lane = [mid, mid - 1, mid + 1, mid - 2, mid + 2].find((l) => l >= 0 && l < this.lanes && !taken(l));
        if (lane === undefined) lane = mid;
      }
      if (lane === undefined) lane = this.rng.int(this.lanes);
      // bossHp：精英挑战里回归的小 Boss 是强化版（设计书 29.2）
      const bossMult = def.boss ? (1 + (this.level.bossHp || 0)) * (def.towerOf ? C.towerBossHpMult : C.bossHpMult) : 1;
      const hp = Math.round(def.hp * this.D * (1 + (this.rules.monsterHp || 0)) * this.diffHp * bossMult);
      const m = {
        id: nextId++,
        type,
        def,
        lane,
        x: x !== undefined ? x : C.spawnX + this.rng() * 20,
        y: this.laneY(lane),
        yOffset: def.flying ? -34 : (this.rng() - 0.5) * 26,
        hp,
        maxHp: hp,
        pending: 0,
        dps: def.dps * this.D,
        state: 'walk',
        attackTimer: 0.3 + this.rng() * 0.5,
        hasteUntil: 0,
        hasteAmt: 0,
        slowUntil: 0,
        slowAmt: 0,
        frozenUntil: 0,
        burnUntil: 0,
        burnDps: 0,
        burnTick: 0,
        stunUntil: 0,
        hitFlash: 0,
        dead: false,
        bornAt: this.time,
      };
      if (def.split) m.nextSplit = 1 - def.split.every;
      if (def.ai) this.initBossAI(m);
      if (def.healer) m.healTimer = 1;
      // 云朵羊：先扣羊毛（设计书 33.2）
      if (def.wool) m.wool = m.woolMax = hp * def.wool.ratio * (1 - Math.min(1, this.mods.woolCut));
      if (def.ranged) m.rangedTimer = 0.8;
      if (def.laneHop) m.hopTimer = def.laneHop.every * (0.6 + this.rng() * 0.6);
      if (def.regen) m.lastHit = -99;
      // 第七章（设计书 52.2）
      if (def.shell) {
        m.shellHits = 0;
        m.shellUntil = 0;
      }
      if (def.leap) {
        m.leapTimer = def.leap.every * (0.5 + this.rng() * 0.5);
        m.leapUntil = 0;
      }
      if (def.bubbler) m.bubbleTimer = 1;
      if (def.stealth) {
        m.stealthed = true;
        m.hopTimer = def.stealth.hopEvery;
      }
      this.monsters.push(m);
      this.emit('spawn', m);
      return m;
    }

    isTargetable(m) {
      return !m.dead && !m.burrowed && !m.bones && !m.hidden && !m.stealthed && !(m.leapUntil > this.time) && m.x <= C.width + 5;
    }

    monsterSpeed(m) {
      if (this.time < m.frozenUntil || this.time < m.stunUntil || this.time < m.shellUntil) return 0;
      let s = m.def.speed * (1 + (this.rules.monsterSpeed || 0));
      if (m.def.ai === 'boarKing' && m.ai.phase === 3) s *= D.boarKing.enrageSpeedMult;
      if (m.burrowed && m.def.burrow) s *= m.def.burrow.speedMult;
      if (m.def.ai === 'pharaoh' && m.ai.phase === 3) s *= D.pharaoh.phase3SpeedMult;
      if (m.cooked) s *= 1 + D.witch.cookSpeed;
      if (m.sheared) s *= m.def.wool.speedMult;
      if (this.storm && !m.def.boss) s *= 1 + D.thunderKing.stormSpeed;
      if (this.whirl && !m.def.boss) s *= 1 + D.octoKing.whirlSpeed;
      if (this.mods.slowAll) s *= 1 - this.mods.slowAll;
      if (this.zones.length && !this.mods.fireproof) {
        for (const z of this.zones) {
          if (this.time < z.until && Math.abs(m.x - z.x) <= z.r && Math.abs(m.y - z.y) <= z.r) {
            s *= 1 + z.haste;
            break;
          }
        }
      }
      if (this.time < m.hasteUntil) s *= 1 + m.hasteAmt;
      let slow = this.time < m.slowUntil ? m.slowAmt : 0;
      for (const e of this.laneEffects) {
        if (e.lane === m.lane && this.time < e.until) {
          if (e.type === 'freeze') return 0;
          if (e.type === 'frost') slow = Math.max(slow, e.slow);
          if (e.type === 'poison') s *= 1 + e.haste;
          if (e.type === 'lava' && !this.mods.fireproof) s *= 1 + e.haste;
        }
      }
      return s * (1 - slow);
    }

    wallStopX(m) {
      return C.wallX + m.def.size * 0.6 + (m.def.flying ? 4 : 0);
    }

    updateMonsters(dt) {
      let chill = 0;
      for (const m of this.monsters) if (!m.dead && m.def.chill && m.x <= C.width) chill++;
      this.chillStacks = chill;
      this.guards.length = 0;
      for (const m of this.monsters) if (!m.dead && m.def.guard && m.x <= C.width) this.guards.push(m);
      for (const m of this.monsters) {
        if (m.dead) continue;
        if (m.hitFlash > 0) m.hitFlash -= dt;
        // 中毒（毒瓶 / 瘟疫）：每 0.5 秒一跳，不受护盾以外的减免
        if (this.time < (m.poisonUntil || 0)) {
          m.poisonTick -= dt;
          if (m.poisonTick <= 0) {
            m.poisonTick += 0.5;
            this.damage(m, m.poisonDps * 0.5, { type: 'magic', fromFront: false, source: 'poison' });
            if (m.dead) continue;
          }
        }
        // 灼烧
        if (this.time < m.burnUntil) {
          m.burnTick -= dt;
          if (m.burnTick <= 0) {
            m.burnTick += 0.5;
            this.damage(m, m.burnDps * 0.5, { type: 'magic', fromFront: false, source: 'burn' });
            if (m.dead) continue;
          }
        }
        if (m.ai) {
          const upd = BOSS_UPDATE[m.def.ai];
          if (upd) this[upd](m, dt);
          if (m.dead) continue;
          if (m.ai.mode !== 'walk') continue;
        }
        // 隐身（暗影刺客）：远处隐身并换道，靠近后现身
        const st = m.def.stealth;
        if (st) {
          const revealX = this.mods.reveal ? 800 : st.revealX;
          const was = m.stealthed;
          m.stealthed = m.x > revealX;
          if (was && !m.stealthed) this.emit('reveal', { m });
          if (m.stealthed && this.lanes > 1) {
            m.hopTimer -= dt;
            if (m.hopTimer <= 0) {
              m.hopTimer = st.hopEvery;
              m.lane = m.lane === 0 ? 1 : m.lane === this.lanes - 1 ? m.lane - 1 : m.lane + (this.rng() < 0.5 ? -1 : 1);
            }
          }
          const ty = this.laneY(m.lane);
          if (m.y !== ty) m.y += Math.sign(ty - m.y) * Math.min(Math.abs(ty - m.y), 140 * dt);
        }
        // 跳跃（飞鱼）：空中无法被攻击，落地前不做别的事
        const lp = m.def.leap;
        if (lp) {
          if (this.time < m.leapUntil) {
            m.x = Math.max(this.wallStopX(m), m.x - (m.leapDist / lp.time) * dt);
            m.state = 'leap';
            continue;
          }
          if (this.time >= m.frozenUntil && this.time >= m.stunUntil) m.leapTimer -= dt;
          const dist = lp.dist * (1 - Math.min(1, this.mods.leapCut));
          if (m.leapTimer <= 0 && m.x <= C.width && m.x - dist > this.wallStopX(m) + 20) {
            m.leapTimer = lp.every;
            m.leapUntil = this.time + lp.time;
            m.leapDist = dist;
            m.leapFrom = m.x;
            this.emit('leap', { m });
          }
        }
        // 吹泡泡（海马）：给最靠近城墙、还没有泡泡的一只怪套上泡泡
        const bub = m.def.bubbler;
        if (bub && m.x <= bub.holdX && this.time >= m.frozenUntil && this.time >= m.stunUntil) {
          m.bubbleTimer -= dt;
          if (m.bubbleTimer <= 0) {
            m.bubbleTimer = bub.every;
            let best = null;
            for (const o of this.monsters) {
              if (o.dead || o === m || o.bubble || o.def.boss || o.def.bossPart || o.x > C.width) continue;
              const dx = o.x - m.x;
              const dy = o.y - m.y;
              if (dx * dx + dy * dy > bub.radius * bub.radius) continue;
              if (!best || o.x < best.x) best = o;
            }
            if (best) {
              best.bubble = true;
              this.emit('bubble', { from: m, m: best });
            }
          }
        }
        // 再生（树桩怪）
        if (m.def.regen && this.time - m.lastHit >= m.def.regen.delay && m.hp < m.maxHp) {
          m.hp = Math.min(m.maxHp, m.hp + m.maxHp * m.def.regen.pct * dt);
        }
        // 换道（蝙蝠）
        if (m.def.laneHop && this.lanes > 1) {
          m.hopTimer -= dt;
          if (m.hopTimer <= 0) {
            m.hopTimer = m.def.laneHop.every;
            const dir = m.lane === 0 ? 1 : m.lane === this.lanes - 1 ? -1 : this.rng() < 0.5 ? -1 : 1;
            m.lane += dir;
          }
          const ty = this.laneY(m.lane);
          if (m.y !== ty) m.y += Math.sign(ty - m.y) * Math.min(Math.abs(ty - m.y), 160 * dt);
        }
        // 钻地（设计书 19.2）
        const bur = m.def.burrow;
        if (bur && !m.burrowDone) {
          if (!m.burrowed && m.x <= bur.at) {
            m.burrowed = true;
            this.emit('burrow', { m });
          } else if (m.burrowed && m.x <= bur.until) {
            m.burrowed = false;
            m.burrowDone = true;
            this.emit('surface', { m });
          }
        }
        // 治疗型：停在后排，给周围的怪回血
        const heal = m.def.healer;
        if (heal) {
          m.healTimer -= dt;
          if (m.healTimer <= 0) {
            m.healTimer += 1;
            this.healAround(m, heal.radius, heal.pct);
          }
        }
        const ranged = m.def.ranged;
        const chillDef = m.def.chill;
        const stopX = heal ? heal.holdX : ranged ? ranged.holdX : chillDef ? chillDef.holdX : bub ? bub.holdX : this.wallStopX(m);
        if (m.x > stopX) {
          m.state = 'walk';
          m.x = Math.max(stopX, m.x - this.monsterSpeed(m) * dt);
        } else if (heal || chillDef || bub) {
          m.state = 'hold';
        } else if (ranged) {
          // 远程型：停在远处向城墙吐毒液
          m.state = 'hold';
          if (this.time >= m.frozenUntil && this.time >= m.stunUntil) {
            m.rangedTimer -= dt;
            if (m.rangedTimer <= 0) {
              m.rangedTimer = ranged.every;
              this.emit(m.def.bossPart ? 'slap' : 'spit', { m, x: m.x, y: m.y });
              this.hitWall(ranged.damage * this.D, m);
              if (ranged.poison) this.addWallDot(ranged.poison.dps * this.D, ranged.poison.duration, 'poison', true, m.type);
            }
          }
        } else if (m.def.explode) {
          // 自爆型：到达城墙立即爆炸，不掉铜币
          this.hitWall(m.def.explode.damage * this.D, m, true);
          this.emit('explode', { m });
          this.kill(m, true);
        } else {
          m.state = 'attack';
          if (m.def.slam && !m.slammed) {
            m.slammed = true;
            this.hitWall(m.def.slam * this.D, m, true);
            this.emit('slam', { m });
          }
          if (this.time >= m.frozenUntil && this.time >= m.stunUntil) {
            m.attackTimer -= dt;
            if (m.attackTimer <= 0) {
              m.attackTimer += 1;
              this.hitWall(m.dps, m);
              const thorns = this.stats.thorns + (this.time < this.tempThornsUntil ? this.tempThorns : 0);
              if (thorns > 0 && !m.dead) {
                this.damage(m, this.atk * thorns, { type: 'magic', fromFront: false, source: 'thorns' });
              }
            }
          }
        }
      }
      // 清理死亡怪物
      if (this.monsters.length > 60 && this.monsters.some((m) => m.dead)) {
        this.monsters = this.monsters.filter((m) => !m.dead || this.time - m.diedAt < 0.05);
      }
    }

    healAround(src, radius, pct) {
      let any = false;
      for (const o of this.monsters) {
        if (o.dead || o === src || o.hp >= o.maxHp) continue;
        const dx = o.x - src.x;
        const dy = o.y - src.y;
        if (dx * dx + dy * dy > radius * radius) continue;
        o.hp = Math.min(o.maxHp, o.hp + o.maxHp * pct);
        any = true;
      }
      this.emit('healPulse', { m: src, radius, any });
    }

    // 英雄被震晕 / 电麻；"避雷针"补给免疫（设计书 33.4）
    stunHero(duration) {
      if (this.mods.stunImmune) {
        this.emit('stunBlocked', {});
        return;
      }
      this.heroStunUntil = Math.max(this.heroStunUntil, this.time + duration);
    }

    // 城墙持续伤害（毒液、毒雾）。refresh=true 时同来源只刷新时间不叠加
    // who：施加持续伤害的怪物种类（战斗报告用）
    addWallDot(dps, duration, src, refresh, who) {
      if (refresh) {
        const e = this.wallDots.find((d) => d.src === src && d.until > this.time);
        if (e) {
          e.until = this.time + duration;
          e.dps = Math.max(e.dps, dps);
          return;
        }
      }
      this.wallDots.push({ dps, until: this.time + duration, src, who });
    }

    updateWallDots(dt) {
      if (!this.wallDots.length) return;
      this.dotTick -= dt;
      if (this.dotTick > 0) return;
      this.dotTick += 0.5;
      const byWho = {};
      for (const d of this.wallDots) if (this.time < d.until) byWho[d.who || 'boss'] = (byWho[d.who || 'boss'] || 0) + d.dps * 0.5;
      this.wallDots = this.wallDots.filter((d) => this.time < d.until);
      for (const who of Object.keys(byWho)) {
        if (this.over) break;
        this.hitWall(byWho[who] * (1 - Math.min(0.9, this.mods.dotReduce)), null, false, 'dot', who);
      }
    }

    hitWall(amount, m, big, kind, who) {
      amount *= this.diffDmg;
      const temp = this.time < this.tempDr.until ? this.tempDr.amt : 0;
      let dmg = amount * (1 - Math.min(temp > 0.5 ? 0.95 : 0.8, this.stats.wallDr + this.mods.wallDr + temp));
      // 守护符文（设计书 62.3）：整场有效的护盾，先于泡泡护盾被打
      if (this.itemShield > 0) {
        const take = Math.min(this.itemShield, dmg);
        this.itemShield -= take;
        dmg -= take;
        if (this.itemShield <= 0) this.emit('barrierBreak', {});
        if (dmg <= 0) return;
      }
      if (this.wallShield > 0) {
        const take = Math.min(this.wallShield, dmg);
        this.wallShield -= take;
        dmg -= take;
        if (this.wallShield <= 0) this.emit('wallBubblePop', {});
        if (dmg <= 0) return;
      }
      this.wall.hp = Math.max(0, this.wall.hp - dmg);
      this.minWallRatio = Math.min(this.minWallRatio, this.wall.hp / this.wall.max);
      this.wallDamageTaken += dmg;
      const by = who || (m && m.type) || 'boss';
      this.report.wallBy[by] = (this.report.wallBy[by] || 0) + dmg;
      this.emit('wallHit', { amount: dmg, m, big: !!big, kind });
      if (this.wall.hp <= 0) {
        // 神圣庇佑：第一次被打倒时复活（只有一次）
        if (this.mods.revive && !this.revived) {
          this.revived = true;
          this.wall.hp = this.wall.max * this.reviveHeal;
          this.emit('wallHeal', { amount: this.wall.hp, src: 'aegis' });
        } else this.finish(false);
      }
    }

    healWall(amount, src) {
      if (this.time < this.wallSealedUntil) {
        this.emit('healBlocked', { src });
        return;
      }
      const before = this.wall.hp;
      amount *= 1 + (this.mods.healBonus || 0);
      this.wall.hp = Math.min(this.wall.max, this.wall.hp + amount);
      this.emit('wallHeal', { amount: this.wall.hp - before, src });
    }

    // ---------- 伤害 ----------
    // 无视护甲比例：穿甲被动 + 补给 + 武器自带，最多 80%
    armorIgnore(opts) {
      if (opts && opts.source === 'thorns') return 0;
      let ig = this.mods.armorIgnore || 0;
      if (this.stats.passives.pierceArmor) ig += this.stats.passiveVals.pierceArmor;
      if (opts && opts.armorIgnore) ig += opts.armorIgnore;
      return Math.min(0.8, ig);
    }

    armorFactor(m, fromFront, type, weaponIgnore) {
      if (m.shield > 0) return type === 'magic' ? 0.5 : 0.1;
      if (type === 'magic') return 1;
      let armor = (m.def.armor || 0) + (fromFront ? m.def.frontArmor || 0 : 0);
      armor *= 1 - this.armorIgnore({ armorIgnore: weaponIgnore });
      return 1 - armor / (armor + 100);
    }

    // opts: { type: 'phys'|'magic', fromFront, crit, source }
    damage(m, amount, opts) {
      if (m.dead) return 0;
      // 闪避（风筝怪）：只躲武器的物理普通攻击（设计书 33.2）
      if (m.def.dodge && opts.source === 'weapon' && opts.type !== 'magic' && this.rng() < Math.max(0, m.def.dodge - this.mods.dodgeCut)) {
        this.emit('dodge', { m, x: m.x, y: m.y + m.yOffset });
        return 0;
      }
      // 泡泡（海马）：挡住下一次伤害（设计书 52.2）
      if (m.bubble) {
        m.bubble = false;
        this.bubblesPopped++;
        this.emit('bubblePop', { m, x: m.x, y: m.y + m.yOffset });
        if (!this.mods.pinPop) return 0;
        amount *= 1 - Math.min(1, this.mods.pinPop);
      }
      if (opts.type === 'magic' && opts.source !== 'thorns') amount *= 1 + this.mods.magicMult;
      if (m.vulnUntil && this.time < m.vulnUntil) amount *= D.inkBoss.vulnMult;
      if (m.markUntil && this.time < m.markUntil) amount *= 1 + (m.markBonus || 0); // 猎杀标记
      amount *= this.damageMult(m, opts);
      // 护盾：先吸收伤害，魔法效果更好（设计书 19.3）
      if (m.shield > 0) {
        const P2 = D.pharaoh;
        const eff = amount * (opts.type === 'magic' ? P2.shieldMagicMult : P2.shieldPhysMult);
        m.shield -= eff;
        m.hitFlash = 0.08;
        this.emit('shieldHit', { m, x: m.x, y: m.y + m.yOffset, dmg: eff, magic: opts.type === 'magic' });
        if (m.shield <= 0) {
          m.shield = 0;
          m.ai.shieldTimer = P2.shieldRegen;
          this.emit('shieldBreak', { m });
        }
        return 0;
      }
      // 羊毛（云朵羊）：先扣羊毛，剃光后加速
      if (m.wool > 0) {
        const take = Math.min(m.wool, amount);
        m.wool -= take;
        amount -= take;
        m.hitFlash = 0.08;
        this.report.bySource[opts.source || 'weapon'] = (this.report.bySource[opts.source || 'weapon'] || 0) + take;
        this.emit('woolHit', { m, x: m.x, y: m.y + m.yOffset, dmg: take });
        if (m.wool <= 0) {
          m.sheared = true;
          this.emit('shear', { m });
        }
        if (amount <= 0) return 0;
      }
      const raw = amount;
      let armor = 0;
      if (opts.type !== 'magic') {
        armor = (m.def.armor || 0) + (opts.fromFront ? m.def.frontArmor || 0 : 0);
        armor *= 1 - this.armorIgnore(opts);
        // 灵体：物理伤害大打折扣（设计书 21.2）
        if (m.def.physResist) amount *= Math.min(1, 1 - m.def.physResist + this.mods.spiritPierce);
      } else {
        armor = m.def.mres || 0;
      }
      const dmg = Math.max(1, amount * (1 - armor / (armor + 100)));
      const rp = this.report;
      const kind = opts.type === 'magic' ? 'magic' : 'phys';
      rp.bySource[opts.source || 'weapon'] = (rp.bySource[opts.source || 'weapon'] || 0) + dmg;
      rp.raw[kind] += Math.max(raw, dmg);
      rp.real[kind] += dmg;
      m.hp -= dmg;
      m.hitFlash = 0.12;
      m.lastHit = this.time;
      this.damageDealt += dmg;
      this.emit('hit', {
        m,
        x: m.x,
        y: m.y + m.yOffset,
        dmg,
        crit: !!opts.crit,
        source: opts.source,
        blocked: opts.type !== 'magic' && opts.fromFront && m.def.frontArmor > 0,
      });
      if (m.ai) this.onBossDamaged(m, dmg);
      if (m.def.split && m.hp > 0) {
        while (m.hp / m.maxHp <= m.nextSplit && m.nextSplit > 0) {
          m.nextSplit -= m.def.split.every;
          this.split(m, m.def.split.count);
        }
      }
      if (m.hp <= 0) {
        if (m.def.ai === 'boneMage' && !m.ai.revived) this.boneDown(m);
        else this.kill(m);
      }
      return dmg;
    }

    // 第七章的减伤 / 增伤（设计书 52.2、52.3）
    damageMult(m, opts) {
      let k = 1;
      const def = m.def;
      // 护卫（盾龟）：周围的其他怪物受到英雄攻击的伤害降低，多只不叠加
      if (this.guards.length && !def.boss && !def.guard && HERO_SOURCES[opts.source || 'weapon']) {
        for (const g of this.guards) {
          if (g.dead) continue;
          const r = g.def.guard.radius;
          const dx = g.x - m.x;
          const dy = g.y - m.y;
          if (dx * dx + dy * dy <= r * r) {
            k *= g.def.guard.mult;
            break;
          }
        }
      }
      // 缩壳（寄居蟹）：每挨几下就缩进壳里；灼烧不计数
      if (def.shell) {
        if (this.time < m.shellUntil) k *= def.shell.mult;
        else if (opts.source !== 'burn' && !opts.peek && ++m.shellHits >= def.shell.hits) {
          m.shellHits = 0;
          m.shellUntil = this.time + def.shell.duration * (1 - Math.min(1, this.mods.shellCut));
          this.emit('shell', { m });
        }
      }
      if (def.ai === 'pearlClam' && m.ai.mode !== 'walk') k *= m.ai.open ? D.pearlClam.openMult : D.pearlClam.closedMult;
      if (def.ai === 'octoKing' && m.ai.guarded) k *= D.octoKing.guardMult;
      // 装备特长（设计书 58.3）：荆棘反伤不算
      if (opts.source !== 'thorns') {
        if (this.mods.bossDmg && (def.boss || def.bossPart)) k *= 1 + this.mods.bossDmg;
        if (this.mods.flyDmg && def.flying) k *= 1 + this.mods.flyDmg;
        if (this.mods.slowedDmg && (this.time < m.slowUntil || this.inFrost(m))) k *= 1 + this.mods.slowedDmg;
        // 处决：残血的怪受到英雄攻击时伤害更高（设计书 71.5）
        if (this.mods.execute && HERO_SOURCES[opts.source || 'weapon'] && m.hp < m.maxHp * 0.3) k *= 1 + this.mods.execute;
        // 暴风雪 / 时间静止：冻住期间的怪物更脆（设计书 62.3）
        if (m.shatterUntil && this.time < m.shatterUntil) k *= 1 + m.shatterAmt;
      }
      return k;
    }

    split(m, count) {
      const sp = m.def.split;
      for (let i = 0; i < count; i++) {
        let lane = m.lane;
        if (this.lanes > 1) {
          const dir = i % 2 === 0 ? -1 : 1;
          lane = TD.util.clamp(m.lane + dir, 0, this.lanes - 1);
          if (lane === m.lane) lane = TD.util.clamp(m.lane - dir, 0, this.lanes - 1);
        }
        const c = this.spawnMonster(sp.child, lane, m.x + 20 + this.rng() * 30);
        c.splitFrom = { x: m.x, y: m.y };
      }
      this.emit('split', { m, count });
    }

    kill(m, noReward) {
      m.dead = true;
      m.hp = 0;
      m.diedAt = this.time;
      const copper = noReward ? 0 : m.def.copper * (this.time < this.copperMultUntil ? this.copperMult : 1);
      if (!noReward) {
        // 连击：1.2 秒内连续击败
        this.streak = this.time - this.lastKillAt <= 1.2 ? this.streak + 1 : 1;
        this.lastKillAt = this.time;
        if (this.streak > this.bestStreak) this.bestStreak = this.streak;
        if (STREAK_CALLS[this.streak]) this.emit('streak', { count: this.streak, text: STREAK_CALLS[this.streak] });
        this.kills++;
        this.killsByType[m.type] = (this.killsByType[m.type] || 0) + 1;
      }
      this.killCopper += copper;
      if (m.returning && !noReward) {
        this.killSilver += C.returnBossSilver;
        this.emit('silver', { x: m.x, y: m.y + m.yOffset, amount: C.returnBossSilver });
      }
      // 回春箭：击杀回复城墙（静默回复，不弹字，免得刷屏）
      if (this.mods.killHeal && !noReward) this.wall.hp = Math.min(this.wall.max, this.wall.hp + this.wall.max * this.mods.killHeal);
      this.emit('death', { m, copper, noReward: !!noReward });
      const od = m.def.onDeath;
      if (od && od.type === 'spore') {
        for (const o of this.monsters) {
          if (o.dead || o === m) continue;
          const dx = o.x - m.x;
          const dy = o.y + o.yOffset - (m.y + m.yOffset);
          if (dx * dx + dy * dy <= od.radius * od.radius) {
            o.hasteUntil = this.time + od.duration;
            o.hasteAmt = od.speedBonus;
          }
        }
        this.emit('spore', { x: m.x, y: m.y + m.yOffset, radius: od.radius });
      }
      if (m.def.split) this.split(m, m.def.split.deathCount);
      if (m.def.ai === 'thunderKing') this.storm = false; // 雷雷被打败，雨停了
      // 尖刺（海胆）：扎伤周围的怪物，可能连锁（设计书 52.2）
      const sp = m.def.spikes;
      if (sp && !noReward) {
        this.emit('spikes', { x: m.x, y: m.y + m.yOffset, radius: sp.radius });
        for (const o of this.monsters.slice()) {
          if (o.dead || o === m || o.def.bossPart) continue;
          const dx = o.x - m.x;
          const dy = o.y - m.y;
          if (dx * dx + dy * dy <= sp.radius * sp.radius) this.damage(o, sp.damage * this.D, { type: 'magic', fromFront: false, source: 'spikes' });
        }
      }
      if (m.def.ai === 'octoKing') {
        this.whirl = false;
        for (const o of this.monsters) if (!o.dead && o.owner === m) this.kill(o, true);
        this.emit('tentacleRetract', { m });
      }
      // 静电：电麻后 1.5 秒内不会再被电麻，避免一群雷团子把英雄电到动不了
      const ss = m.def.staticShock;
      if (ss && m.x < C.wallX + ss.range && this.time >= (this.staticImmuneUntil || 0)) {
        this.stunHero(ss.stun);
        this.staticImmuneUntil = this.time + ss.stun + 1.5;
        this.emit('staticShock', { m, duration: ss.stun });
      }
      if (m.def.fireZone) {
        const fz = m.def.fireZone;
        this.zones.push({ x: m.x, y: m.y, r: fz.radius, until: this.time + fz.duration, haste: fz.haste });
        this.emit('fireZone', { x: m.x, y: m.y, r: fz.radius, duration: fz.duration });
      }
      if (m.def.ai === 'rockGolem') {
        const R = D.rockGolem;
        if (m.x < C.wallX + R.boomRange) this.hitWall(R.boomDamage * this.D, m, true);
        this.laneEffects.push({ lane: m.lane, type: 'lava', haste: R.lavaHaste, until: this.time + R.lavaDuration, start: this.time });
        this.emit('golemBoom', { m, near: m.x < C.wallX + R.boomRange });
      }
      if (m.cloneOf) {
        const boss = m.cloneOf;
        if (boss.ai && !boss.dead && this.monsters.every((o) => o.dead || o.cloneOf !== boss)) this.clonesDown(boss);
      }
      const ds = m.def.deathSpawn;
      if (ds) {
        for (let i = 0; i < ds.count; i++) {
          const c = this.spawnMonster(ds.type, m.lane, m.x + (i - 1) * 22);
          c.splitFrom = { x: m.x, y: m.y };
        }
        this.emit('split', { m, count: ds.count });
      }
    }

    // ---------- 英雄 ----------
    // 攻速：增益相加；减益（沙暴、暴风雪、冰晶精灵光环）相加后受"暖手炉"减免
    aspdMalus() {
      let malus = 0;
      for (const b of this.buffs) if (this.time < b.until && b.aspd < 0) malus -= b.aspd;
      const sprite = D.monsters.iceSprite.chill;
      malus += Math.min(sprite.maxStacks, this.chillStacks) * sprite.aspd;
      return malus * (1 - Math.min(0.9, this.mods.chillResist));
    }

    currentAspd() {
      let bonus = 0;
      for (const b of this.buffs) if (this.time < b.until && b.aspd > 0) bonus += b.aspd;
      return this.stats.aspd * (1 + this.mods.aspdMult) * Math.max(0.3, 1 + bonus - this.aspdMalus());
    }

    inRange(m) {
      return m.x <= C.wallX + this.range;
    }

    // 按目标优先级排序可攻击目标
    rankTargets() {
      const list = [];
      for (const m of this.monsters) {
        if (!this.isTargetable(m) || !this.inRange(m)) continue;
        if (m.hp - m.pending <= 0) continue; // 已经有足够的弹道在路上
        list.push(m);
      }
      const mode = this.target;
      const byX = (a, b) => a.x - b.x;
      if (mode === 'weakest') list.sort((a, b) => a.hp - b.hp || byX(a, b));
      else if (mode === 'strongest') list.sort((a, b) => b.hp - a.hp || byX(a, b));
      else if (mode === 'flying') list.sort((a, b) => (b.def.flying ? 1 : 0) - (a.def.flying ? 1 : 0) || byX(a, b));
      else if (mode === 'boss') {
        // 波波有触手护身时先打触手（设计书 52.3）
        const pri = (m) => (m.def.boss ? (m.ai && m.ai.guarded ? 1 : 3) : m.def.bossPart ? 2 : 0);
        list.sort((a, b) => pri(b) - pri(a) || byX(a, b));
      }
      else if (mode === 'smart') {
        // 威胁优先：逼近城墙的先打；城墙安全时优先打辅助型怪物（治疗、光环、远程）
        const danger = (m) => m.x < C.wallX + C.smartDanger;
        const support = (m) => !!(m.def.healer || m.def.chill || m.def.ranged || m.def.guard || m.def.bubbler);
        list.sort((a, b) => (danger(b) ? 1 : 0) - (danger(a) ? 1 : 0) || (support(b) ? 1 : 0) - (support(a) ? 1 : 0) || byX(a, b));
      } else list.sort(byX);
      // 猎杀标记：被标记的怪排在最前面（其余保持原来的顺序）
      if (list.some((m) => m.markUntil && this.time < m.markUntil)) {
        const mk = (m) => (m.markUntil && this.time < m.markUntil ? 1 : 0);
        const idx = new Map(list.map((m, i) => [m, i]));
        list.sort((a, b) => mk(b) - mk(a) || idx.get(a) - idx.get(b));
      }
      return list;
    }

    rollHit(mult) {
      let dmg = this.atk * this.stats.weaponMult * mult * this.phantomScale;
      let buffCrit = 0;
      for (const b of this.buffs) if (b.crit && this.time < b.until) buffCrit += b.crit;
      let crit = this.rng() < this.stats.crit + this.mods.crit + buffCrit;
      // 黄金箭：必定暴击，并额外放大
      if (this.goldenShots > 0) {
        this.goldenShots--;
        crit = true;
        dmg *= this.goldenMult;
      }
      if (crit) dmg *= this.stats.critDmg + this.mods.critDmg;
      return { dmg, crit };
    }

    updateHero(dt) {
      if (this.time < this.heroStunUntil) return;
      this.hero.cooldown -= dt;
      if (this.hero.cooldown > 0) return;
      const targets = this.rankTargets();
      if (!targets.length) {
        this.hero.cooldown = 0;
        return;
      }
      this.fire(targets);
      this.hero.attacks++;
      this.rollProcs(targets);
      this.firePhantoms(targets);
      if (this.stats.passives.combo) {
        // 连珠（设计书 90）：每次攻击攒一点几率，攒够 1 就立即追加 1 次攻击
        this.hero.comboAcc = (this.hero.comboAcc || 0) + this.stats.passiveVals.combo;
        while (this.hero.comboAcc >= 1) {
          this.hero.comboAcc -= 1;
          const again = this.rankTargets();
          if (!again.length) break;
          this.fire(again);
          this.rollProcs(again);
          this.emit('combo', {});
        }
      }
      this.hero.cooldown += 1 / this.currentAspd();
    }

    weaponDef() {
      return this.stats.weaponDef || D.weapons[this.stats.weapon];
    }

    fire(targets) {
      const w = this.weaponDef();
      const sx = C.heroX + 26;
      const sy = this.heroY - 46;
      const t0 = targets[0];
      // Lyra的铃声（设计书 42.2）：每第 N 次攻击眩晕目标周围的普通怪物
      const bell = this.inPhantom ? null : this.stats.bell;
      if (bell) {
        this.attackCount = (this.attackCount || 0) + 1;
        if (this.attackCount % bell.every === 0) {
          for (const o of this.monsters) {
            if (o.dead || o.def.boss) continue;
            const dx = o.x - t0.x;
            const dy = o.y + o.yOffset - (t0.y + t0.yOffset);
            if (dx * dx + dy * dy <= bell.radius * bell.radius) o.stunUntil = Math.max(o.stunUntil, this.time + bell.stun);
          }
          this.emit('bell', { x: t0.x, y: t0.y + t0.yOffset, radius: bell.radius });
        }
      }
      this.hero.aimX = t0.x;
      this.hero.aimY = t0.y + t0.yOffset;
      this.hero.shotAt = this.time;
      // Nova的萤火虫（设计书 59.2）：每第 N 次攻击放出几只，各自飞向射程内的怪
      const ff = this.inPhantom ? null : this.stats.fireflies;
      if (ff && ++this.fireflyCount % ff.every === 0) {
        for (let i = 0; i < ff.count; i++) {
          const m = targets[i % targets.length];
          this.projectiles.push({ kind: 'firefly', x: sx, y: sy - 10, sx, sy, target: m, tx: m.x, ty: m.y + m.yOffset, speed: 520 + i * 60, dmg: this.atk * ff.atkMult, crit: false, angle: 0, dmgType: 'magic', armorIgnore: 0, travel: 0, dist0: 1, source: 'firefly', wobble: i * 2.1 });
        }
        this.emit('fireflies', { x: sx, y: sy });
      }
      // 雷鸣箭袋（设计书 58.3）：每第 N 次攻击落下一道小闪电
      const zap = this.inPhantom ? null : this.stats.zap;
      if (zap && ++this.zapCount % zap.every === 0) {
        this.emit('gearZap', { x: t0.x, y: t0.y + t0.yOffset });
        // 目标被闪电打死时，箭照常射出（飞到原位置落空），不影响后面的攻击节奏
        this.damage(t0, this.atk * zap.atkMult, { type: 'magic', fromFront: false, source: 'zap' });
      }
      if (w.boomerang) {
        const lanes = [t0.lane];
        // 一次扔几支：目标车道最先，再往两侧相邻车道依次排（twin = 2 支，boomerangs = N 支）
        const count = w.boomerangs || (w.twin ? 2 : 1);
        for (let d = 1; lanes.length < count && d < this.lanes; d++)
          for (const l of [t0.lane + d, t0.lane - d]) if (l >= 0 && l < this.lanes && lanes.length < count) lanes.push(l);
        for (const lane of lanes) {
          this.projectiles.push({
            kind: 'boomerang',
            lane,
            x: C.wallX,
            y: this.laneY(lane),
            dir: 1,
            speed: w.projSpeed,
            maxX: C.wallX + this.range,
            hitOut: new Set(),
            hitBack: new Set(),
            spin: 0,
            tint: D.weaponRarity[w.rarity || 1].color, // 特效颜色跟武器品质走（设计书 78）
          });
        }
        this.emit('shoot', { weapon: 'boomerang' });
        return;
      }
      const shots = [];
      if (w.bolts) {
        for (let i = 0; i < w.bolts; i++) {
          if (i < targets.length) shots.push({ m: targets[i], mult: 1 });
          else shots.push({ m: t0, mult: w.extraBoltMult });
        }
      } else shots.push({ m: t0, mult: 1 });
      for (const s of shots) {
        let mult = s.mult;
        if (w.flyingMult && s.m.def.flying) mult *= w.flyingMult;
        const roll = this.rollHit(mult);
        if (!w.splash) s.m.pending += roll.dmg * this.armorFactor(s.m, true, w.dmgType, w.armorIgnore);
        const kind = { crossbow: 'bolt', staff: 'orb', cannon: 'shell', orb: 'zap' }[(w.look && w.look.base) || this.stats.weapon] || 'arrow';
        this.projectiles.push({
          kind,
          x: sx,
          y: sy,
          sx,
          sy,
          target: s.m,
          tx: s.m.x,
          ty: s.m.y + s.m.yOffset,
          speed: w.projSpeed,
          dmg: roll.dmg,
          crit: roll.crit,
          angle: 0,
          dmgType: w.dmgType || 'phys',
          splash: w.splash,
          armorIgnore: w.armorIgnore || 0,
          arc: !!w.arc,
          travel: 0,
          dist0: Math.hypot(s.m.x - sx, s.m.y + s.m.yOffset - sy),
          chain: w.chain,
          pierce: w.pierce,
          knock: w.knock,
          bossMult: w.bossMult,
          tint: D.weaponRarity[w.rarity || 1].color, // 特效颜色跟武器品质走（设计书 78）
        });
      }
      this.emit('shoot', { weapon: this.stats.weapon });
    }

    ignite(m) {
      const b = D.passiveSkills.burn;
      if (this.time >= m.burnUntil) m.burnTick = 0.5;
      m.burnUntil = this.time + b.duration;
      m.burnDps = Math.max(m.burnDps || 0, (this.atk * (this.stats.passiveVals && this.stats.passiveVals.burn ? this.stats.passiveVals.burn : D.passiveSkills.burn.eff.base)) / b.duration);
    }

    applyWeaponHit(m, dmg, crit, fromFront, p) {
      const type = p && p.dmgType === 'magic' ? 'magic' : 'phys';
      if (p && p.bossMult && (m.def.boss || m.def.bossPart)) dmg *= p.bossMult;
      this.damage(m, dmg, { type, fromFront, crit, source: (p && p.source) || 'weapon', armorIgnore: p ? p.armorIgnore : 0 });
      // Rowan的重箭（设计书 59.2）：把普通怪物往后推
      if (p && p.source === 'firefly') return; // 萤火虫不触发灼烧、减速等命中效果
      if (this.stats.knockOnHit && !m.dead && !m.def.boss && !m.def.bossPart) m.x = Math.min(C.spawnX, m.x + this.stats.knockOnHit);
      if (this.stats.passives.burn && !m.dead) {
        const b = D.passiveSkills.burn;
        if (this.time >= m.burnUntil) m.burnTick = 0.5;
        m.burnUntil = this.time + b.duration;
        m.burnDps = (this.atk * this.stats.passiveVals.burn) / b.duration;
      }
      // 武器自带的点燃 / 减速（设计书 63.5）：寒霜弓、烈焰弩、创世之弓、时之回旋
      if (!(p && p.source)) {
        const wd = this.weaponDef();
        if (wd.ignite && !m.dead) this.ignite(m);
        if (wd.slow && !m.dead) {
          const prev = this.time < m.slowUntil ? m.slowAmt : 0;
          m.slowAmt = Math.max(prev, wd.slow.amt);
          m.slowUntil = Math.max(m.slowUntil, this.time + wd.slow.dur);
        }
      }
      if (this.mods.igniteOnHit && !m.dead) this.ignite(m);
      else if (this.mods.igniteChance && !m.dead && this.rng() < this.mods.igniteChance) this.ignite(m);
      // 连锁闪电：普通攻击有几率放出一道闪电（设计书 71.5）
      if (this.mods.chainChance && !(p && p.source) && this.rng() < this.mods.chainChance) {
        this.chainFrom(m, { dmg: this.atk * 0.6, chain: { count: 3, range: 220, falloff: 1 } });
      }
      if (this.mods.slowOnHit > 0 && !m.dead) {
        const prev = this.time < m.slowUntil ? m.slowAmt : 0;
        m.slowAmt = Math.max(prev, this.mods.slowOnHit);
        m.slowUntil = Math.max(m.slowUntil, this.time + 1.5);
      }
    }

    // 链式闪电：从命中的目标跳向附近没被打过的怪
    chainFrom(first, p) {
      const hit = new Set([first.id]);
      let cur = first;
      let dmg = p.dmg;
      for (let i = 0; i < p.chain.count; i++) {
        let best = null;
        let bd = p.chain.range;
        for (const o of this.monsters) {
          if (hit.has(o.id) || !this.isTargetable(o)) continue;
          const d = Math.hypot(o.x - cur.x, o.y + o.yOffset - (cur.y + cur.yOffset));
          if (d <= bd) {
            bd = d;
            best = o;
          }
        }
        if (!best) break;
        dmg *= p.chain.falloff;
        hit.add(best.id);
        this.emit('thunderChain', { x0: cur.x, y0: cur.y + cur.yOffset, x: best.x, y: best.y + best.yOffset, small: true, color: p.tint });
        this.damage(best, dmg, { type: 'magic', fromFront: false, source: 'chain' });
        cur = best;
      }
    }

    // 穿云箭（木弓专精，设计书 53）：继续命中同一车道后方的怪
    pierceFrom(first, p) {
      const pc = p.pierce;
      const behind = this.monsters
        .filter((o) => o.id !== first.id && o.lane === first.lane && this.isTargetable(o) && o.x > first.x && o.x - first.x <= pc.range)
        .sort((a, b) => a.x - b.x)
        .slice(0, pc.count);
      if (!behind.length) return;
      this.emit('pierce', { x0: first.x, x1: behind[behind.length - 1].x, y: this.laneY(first.lane) - 20, color: p.tint });
      for (const o of behind) this.applyWeaponHit(o, p.dmg * pc.mult, p.crit, true, p);
    }

    // 震地炮（火炮专精，设计书 53）：把爆炸范围内的小怪向后震退并减速
    knockAt(x, y, p, primary) {
      const k = p.knock;
      const r = p.splash ? p.splash.radius : 60;
      for (const o of this.monsters) {
        if (o.dead || o.def.boss || o.def.bossPart) continue;
        const dx = o.x - x;
        const dy = o.y + o.yOffset - y;
        if (dx * dx + dy * dy > r * r && o !== primary) continue;
        o.x = Math.min(C.spawnX, o.x + k.dist);
        const prev = this.time < o.slowUntil ? o.slowAmt : 0;
        o.slowAmt = Math.max(prev, k.slow);
        o.slowUntil = Math.max(o.slowUntil, this.time + k.duration);
      }
      this.emit('knock', { x, y, r });
    }

    // 范围爆炸：主目标以外的怪受到部分伤害
    splashAt(x, y, p, primary) {
      const r = p.splash.radius;
      for (const o of this.monsters.slice()) {
        if (o === primary || !this.isTargetable(o)) continue;
        const dx = o.x - x;
        const dy = o.y + o.yOffset - y;
        if (dx * dx + dy * dy > r * r) continue;
        this.damage(o, p.dmg * p.splash.mult, { type: p.dmgType === 'magic' ? 'magic' : 'phys', fromFront: false, source: 'splash', armorIgnore: p.armorIgnore });
      }
      this.emit('splash', { x, y, radius: r, magic: p.dmgType === 'magic', color: p.tint });
    }

    updateProjectiles(dt) {
      for (const p of this.projectiles) {
        if (p.done) continue;
        if (p.kind === 'boomerang') {
          p.spin += dt * 20;
          p.x += p.dir * p.speed * dt;
          if (p.dir === 1 && p.x >= p.maxX) p.dir = -1;
          const hitSet = p.dir === 1 ? p.hitOut : p.hitBack;
          for (const m of this.monsters) {
            if (m.dead || m.lane !== p.lane || hitSet.has(m.id) || !this.isTargetable(m)) continue;
            if (Math.abs(m.x - p.x) <= m.def.size + 8) {
              hitSet.add(m.id);
              const roll = this.rollHit(1);
              this.applyWeaponHit(m, roll.dmg, roll.crit, p.dir === 1);
            }
          }
          if (p.dir === -1 && p.x <= C.wallX) p.done = true;
          continue;
        }
        const m = p.target;
        if (!m.dead && !m.burrowed) {
          p.tx = m.x;
          p.ty = m.y + m.yOffset;
        }
        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        const dist = Math.hypot(dx, dy);
        const step = p.speed * dt;
        p.angle = Math.atan2(dy, dx);
        p.travel += step;
        if (dist <= step + 4) {
          p.done = true;
          if (!p.splash) m.pending = Math.max(0, m.pending - p.dmg * this.armorFactor(m, true, p.dmgType, p.armorIgnore));
          if (this.isTargetable(m)) this.applyWeaponHit(m, p.dmg, p.crit, true, p);
          else if (!m.dead) this.emit('miss', { x: p.tx, y: p.ty });
          if (p.pierce && !m.dead) this.pierceFrom(m, p);
          else if (p.pierce) this.pierceFrom({ x: p.tx, lane: m.lane, id: m.id }, p);
          if (p.splash) this.splashAt(p.tx, p.ty, p, m);
          if (p.knock) this.knockAt(p.tx, p.ty, p, m);
          if (p.chain && this.isTargetable(m)) this.chainFrom(m, p);
        } else {
          p.x += (dx / dist) * step;
          p.y += (dy / dist) * step;
        }
      }
      if (this.projectiles.length > 40) this.projectiles = this.projectiles.filter((p) => !p.done);
    }

    // ---------- 技能与道具 ----------
    skillReady(i) {
      const s = this.skills[i];
      return s && s.cd <= 0 && !this.over && this.waveState !== 'prepare' && !(this.time < (s.frozenUntil || 0));
    }

    // 车道类技能未指定车道时自动选怪最多的车道
    bestLane() {
      const score = new Array(this.lanes).fill(0);
      for (const m of this.monsters) {
        if (m.dead || !this.isTargetable(m)) continue;
        score[m.lane] += m.hp * (1.5 - (m.x - C.wallX) / C.fieldWidth);
      }
      let best = 0;
      for (let i = 1; i < this.lanes; i++) if (score[i] > score[best]) best = i;
      return best;
    }

    castSkill(i, lane) {
      if (!this.skillReady(i)) return false;
      const s = this.skills[i];
      const def = s.def;
      if (def.targetLane && lane === undefined) lane = this.bestLane();
      const atk = this.atk;
      switch (s.id) {
        case 'drum':
          this.buffs.push({ aspd: def.aspdBonus, crit: def.critBonus || 0, until: this.time + def.duration, src: 'drum' });
          break;
        case 'repair':
          this.healWall(this.wall.max * def.healRatio, 'repair');
          if (def.drBonus) this.tempDr = { amt: def.drBonus, until: this.time + def.drDuration };
          break;
        case 'arrowRain': {
          // 协同"鼓点箭雨"（设计书 45）：战鼓生效期间箭数 +50%
          const drum = this.buffs.some((b) => b.src === 'drum' && this.time < b.until);
          const arrows = drum ? Math.round(def.arrows * SYNERGY.drumRain) : def.arrows;
          this.rain = { left: arrows, every: def.duration / arrows, timer: 0, dmg: atk * def.atkMult, ignite: !!def.ignite };
          if (drum) this.emitCombo('drumRain', C.heroX + 60, this.heroY - 120);
          break;
        }
        case 'frost':
          this.laneEffects.push({ lane, type: 'frost', slow: def.slow, until: this.time + def.duration * (1 + this.mods.frostExt), start: this.time, freezeEnd: def.freezeEnd || 0 });
          break;
        case 'pierce': {
          // 贯穿光矢（设计书 103）：一支光矢扫过整条车道，每只怪按到达的先后挨一下
          const inLane = this.monsters.filter((m) => this.isTargetable(m) && m.lane === lane);
          const side = def.sideMult ? this.monsters.filter((m) => this.isTargetable(m) && Math.abs(m.lane - lane) === 1) : [];
          if (!inLane.length && !side.length) return false;
          const sx = C.heroX + 30;
          const hitAt = (m, mult) =>
            this.later(Math.max(0, (m.x - sx) / 2200), () => {
              if (m.dead) return;
              this.emit('pierceHit', { x: m.x, y: m.y + m.yOffset });
              this.damage(m, atk * def.atkMult * mult, { type: 'phys', fromFront: false, source: 'pierce' });
            });
          for (const m of inLane) hitAt(m, 1);
          for (const m of side) hitAt(m, def.sideMult);
          this.emit('pierceBeam', { lane, sides: def.sideMult ? [lane - 1, lane + 1].filter((l) => l >= 0 && l < this.lanes) : [] });
          break;
        }
        case 'vortex': {
          // 引力漩涡：撕开在怪最密集的地方
          const spot = this.densestSpot(def.radius);
          if (!spot) return false;
          this.vortexes.push({ x: spot.x, y: spot.y, start: this.time, until: this.time + def.duration, tick: 0.25, def });
          this.emit('vortexOpen', { x: spot.x, y: spot.y, r: def.radius, dur: def.duration });
          break;
        }
        case 'firewall':
          this.fireWalls.push({ lane, start: this.time, until: this.time + def.duration, tick: 0.3, def });
          this.emit('firewall', { lane, dur: def.duration });
          break;
        case 'mark': {
          const pool = this.monsters
            .filter((m) => this.isTargetable(m))
            .sort((a, b) => (b.def.boss ? 1e12 : 0) + b.hp - ((a.def.boss ? 1e12 : 0) + a.hp))
            .slice(0, def.count || 1);
          if (!pool.length) return false;
          for (const m of pool) {
            m.markUntil = this.time + def.duration;
            m.markBonus = def.bonus;
            this.emit('mark', { m, x: m.x, y: m.y + m.yOffset });
          }
          break;
        }
        case 'clones':
          this.buffs.push({ phantoms: def.phantoms, phantomMult: def.phantomMult, until: this.time + def.duration, src: 'clones' });
          this.emit('clonesOn', { n: def.phantoms, dur: def.duration });
          break;
        case 'thunder': {
          // 连续劈下 def.strikes 道雷：第一道马上落下，其余隔一小会儿一道（尽量各劈不同的怪）
          const struck = new Set();
          const first = this.thunderStrike(def, struck);
          if (!first) return false;
          const n = def.strikes || 1;
          if (n > 1) this.thunderQ = { left: n - 1, every: thunderEvery(n), timer: thunderEvery(n), def, struck, idx: 1 };
          break;
        }
      }
      s.cd = def.cd * Math.max(0.3, 1 + this.mods.cdMult);
      // 主角的施法动作（设计书 92）：记下是哪个技能、什么时候放的、冰冻领域放在哪条车道
      this.hero.castId = s.id;
      this.hero.castAt = this.time;
      this.hero.castLane = lane;
      this.hero.castStrikes = s.id === 'thunder' ? def.strikes || 1 : 0;
      this.hero.castEvery = s.id === 'thunder' ? thunderEvery(def.strikes || 1) : 0;
      this.castCount++;
      this.skillsCast++;
      this.emit('skill', { id: s.id, lane });
      return true;
    }

    // 助战伙伴的主动能力：墨墨的墨团、雷雷的小闪电（设计书 51）
    updateBuddy(dt) {
      const shot = this.buddy.perk.shot;
      this.buddyTimer -= dt;
      if (this.buddyTimer > 0) return;
      const pool = this.monsters.filter((m) => this.isTargetable(m) && this.inRange(m));
      if (!pool.length) {
        this.buddyTimer = 0.5;
        return;
      }
      this.buddyTimer = shot.every;
      const target = shot.pick === 'strongest' ? pool.reduce((a, b) => (b.hp > a.hp ? b : a)) : pool.reduce((a, b) => (b.x < a.x ? b : a));
      this.emit('buddyShot', { buddy: this.buddy.boss, name: shot.name, x: target.x, y: target.y + target.yOffset });
      this.damage(target, this.atk * shot.mult, { type: 'magic', fromFront: false, source: 'buddy' });
    }

    // 怪物是否处在冰冻领域（减速或冰冻）中
    inFrost(m) {
      if (this.time < m.frozenUntil) return true;
      return this.laneEffects.some((e) => e.lane === m.lane && this.time < e.until && (e.type === 'frost' || e.type === 'freeze'));
    }

    emitCombo(id, x, y) {
      this.combos[id] = (this.combos[id] || 0) + 1;
      this.emit('combo', { id, name: D.synergies[id].name + '！', x, y });
    }

    useItem(i, lane) {
      const it = this.items[i];
      if (!this.itemReady(i) || this.over || this.waveState === 'prepare') return false;
      const def = it.def;
      if (def.targetLane && lane === undefined) lane = this.bestLane();
      const atk = this.atk;
      switch (it.id) {
        case 'bomb':
          for (const m of this.monsters.slice()) {
            if (m.lane === lane && this.isTargetable(m)) this.damage(m, atk * def.atkMult, { type: 'phys', fromFront: false, source: 'bomb' });
          }
          break;
        case 'patch':
          this.healWall(this.wall.max * def.healRatio, 'patch');
          break;
        case 'haste':
          this.buffs.push({ aspd: def.aspdBonus, until: this.time + def.duration, src: 'haste' });
          break;
        case 'freeze': {
          const dur = def.duration * (1 + this.mods.frostExt);
          this.laneEffects.push({ lane, type: 'freeze', until: this.time + dur, start: this.time });
          for (const m of this.monsters) if (m.lane === lane && !m.dead) m.frozenUntil = this.time + dur;
          break;
        }
        case 'firebomb':
          for (const m of this.monsters.slice()) {
            if (m.lane !== lane || !this.isTargetable(m)) continue;
            this.damage(m, atk * def.atkMult, { type: 'magic', fromFront: false, source: 'firebomb' });
            if (!m.dead) this.ignite(m);
          }
          break;
        case 'thunderScroll': {
          const pool = this.monsters.filter((m) => this.isTargetable(m)).sort((a, b) => b.hp - a.hp).slice(0, def.count);
          for (const m of pool) {
            this.emit('scrollBolt', { x: m.x, y: m.y + m.yOffset });
            this.damage(m, atk * def.atkMult, { type: 'magic', fromFront: false, source: 'thunderScroll' });
          }
          break;
        }
        case 'bigBomb':
          for (const m of this.monsters.slice()) {
            if (Math.abs(m.lane - lane) <= 1 && this.isTargetable(m)) this.damage(m, atk * def.atkMult, { type: 'phys', fromFront: false, source: 'bigBomb' });
          }
          break;
        case 'barrier':
          this.itemShield += this.wall.max * def.shieldRatio;
          break;
        case 'warBanner':
          this.buffs.push({ atk: def.atkBonus, until: this.time + def.duration, src: 'banner' });
          break;
        case 'quake':
          for (const m of this.monsters.slice()) {
            if (m.dead || m.hidden) continue;
            const boss = m.def.boss || m.def.bossPart;
            m.stunUntil = Math.max(m.stunUntil, this.time + (boss ? def.bossStun : def.stun));
            if (this.isTargetable(m)) this.damage(m, atk * def.atkMult, { type: 'phys', fromFront: false, source: 'quake' });
          }
          break;
        case 'blizzard': {
          for (let l = 0; l < this.lanes; l++) this.laneEffects.push({ lane: l, type: 'freeze', until: this.time + def.duration, start: this.time });
          for (const m of this.monsters) {
            if (m.dead) continue;
            const boss = m.def.boss || m.def.bossPart;
            const dur = boss ? def.bossDuration : def.duration;
            this.freezeMonster(m, dur);
            m.shatterUntil = this.time + dur;
            m.shatterAmt = def.shatter;
            m.slowAmt = Math.max(this.time < m.slowUntil ? m.slowAmt : 0, def.slowAfter);
            m.slowUntil = Math.max(m.slowUntil, this.time + dur + def.slowTime);
          }
          break;
        }
        case 'flood':
          for (const m of this.monsters.slice()) {
            if (m.dead) continue;
            const boss = m.def.boss || m.def.bossPart;
            m.x = Math.min(C.spawnX + 60, m.x + (boss ? def.bossPush : def.push));
            m.slowAmt = Math.max(this.time < m.slowUntil ? m.slowAmt : 0, def.slow);
            m.slowUntil = Math.max(m.slowUntil, this.time + def.slowTime);
            m.shatterUntil = this.time + def.slowTime;
            m.shatterAmt = def.shatter;
            if (this.isTargetable(m)) this.damage(m, atk * def.atkMult, { type: 'magic', fromFront: false, source: 'flood' });
          }
          break;
        // ---- v1.05 新增道具（设计书 107） ----
        case 'spikeTrap':
          for (const m of this.monsters.slice()) {
            if (m.lane !== lane || !this.isTargetable(m)) continue;
            this.damage(m, atk * def.atkMult, { type: 'phys', fromFront: false, source: 'spikeTrap' });
            if (!m.dead) this.slowMonster(m, def.slow, def.slowTime, 0.5);
          }
          break;
        case 'smokeBomb':
          for (const m of this.monsters) if (!m.dead) this.slowMonster(m, def.slow, def.duration, 0.5);
          break;
        case 'bandage':
          for (let k = 1; k <= 6; k++) this.later(k * (def.duration / 6), () => this.healWall((this.wall.max * def.healRatio) / 6, 'bandage'));
          break;
        case 'whetstone':
          this.buffs.push({ crit: def.critBonus, until: this.time + def.duration, src: 'whetstone' });
          break;
        case 'luckyCoin':
          this.copperMult = def.copperMult;
          this.copperMultUntil = this.time + def.duration;
          break;
        case 'ropeNet':
          for (const m of this.monsters) {
            if (m.lane !== lane || m.dead) continue;
            const boss = m.def.boss || m.def.bossPart;
            m.stunUntil = Math.max(m.stunUntil, this.time + (boss ? def.bossStun : def.stun));
          }
          break;
        case 'firecracker': {
          const pool = this.monsters.filter((m) => this.isTargetable(m));
          const picks = [];
          while (picks.length < def.count && pool.length) picks.push(pool.splice(Math.floor(this.rng() * pool.length), 1)[0]);
          for (const m of picks) {
            this.emit('popHit', { x: m.x, y: m.y + m.yOffset, color: '#ffb060' });
            this.damage(m, atk * def.atkMult, { type: 'phys', fromFront: false, source: 'firecracker' });
            if (!m.dead && !(m.def.boss || m.def.bossPart)) m.stunUntil = Math.max(m.stunUntil, this.time + def.stun);
          }
          break;
        }
        case 'oilFlask':
          for (const m of this.monsters) {
            if (m.lane !== lane || m.dead) continue;
            this.slowMonster(m, def.slow, def.slowTime, 0.5);
            m.shatterUntil = Math.max(m.shatterUntil || 0, this.time + def.slowTime);
            m.shatterAmt = Math.max(this.time < (m.shatterUntil || 0) ? m.shatterAmt || 0 : 0, def.shatter);
          }
          break;
        case 'woodShield':
          this.itemShield += this.wall.max * def.shieldRatio;
          break;
        case 'farsightPotion':
          this.mods.range += def.rangeBonus;
          this.later(def.duration, () => (this.mods.range -= def.rangeBonus));
          break;
        case 'chainScroll': {
          const top = this.monsters.filter((m) => this.isTargetable(m)).sort((a, b) => b.hp - a.hp)[0];
          if (!top) return false;
          this.emit('scrollBolt', { x: top.x, y: top.y + top.yOffset });
          this.damage(top, atk * def.atkMult, { type: 'magic', fromFront: false, source: 'chainScroll' });
          this.chainFrom(top, { dmg: atk * def.atkMult, chain: { count: def.hops, range: def.range, falloff: def.falloff }, tint: '#bfe6ff' });
          break;
        }
        case 'poisonFlask':
          for (const m of this.monsters) {
            if (m.lane !== lane || !this.isTargetable(m)) continue;
            this.poison(m, atk * def.dotMult, def.duration);
            this.slowMonster(m, def.slow, def.duration, 0.5);
          }
          break;
        case 'mirrorShield':
          this.tempThorns = def.thornsMult;
          this.tempThornsUntil = this.time + def.duration;
          break;
        case 'vampDraught':
          this.mods.killHeal += def.killHeal;
          this.later(def.duration, () => (this.mods.killHeal -= def.killHeal));
          break;
        case 'earthSpike': {
          const near = this.monsters.filter((m) => this.isTargetable(m) && m.x < C.wallX + def.near);
          if (!near.length) return false;
          for (const m of near) {
            this.emit('spikeHit', { x: m.x, y: m.y + m.yOffset });
            this.damage(m, atk * def.atkMult, { type: 'phys', fromFront: false, source: 'earthSpike' });
            if (!m.dead) {
              const boss = m.def.boss || m.def.bossPart;
              m.stunUntil = Math.max(m.stunUntil, this.time + (boss ? def.bossStun : def.stun));
            }
          }
          break;
        }
        case 'glueTrap':
          for (const m of this.monsters) if (!m.dead) this.slowMonster(m, def.slow, def.duration, 0.5);
          break;
        case 'rageDraught':
          this.buffs.push({ atk: def.atkBonus, aspd: def.aspdBonus, until: this.time + def.duration, src: 'rage' });
          break;
        case 'thunderStorm':
        case 'stormCall':
          for (let k = 0; k < def.count; k++) {
            this.later((k * def.duration) / def.count, () => {
              const m = this.randomTarget();
              if (!m) return;
              this.emit('stormBolt', { x: m.x, y: m.y + m.yOffset });
              this.damage(m, this.atk * def.atkMult, { type: 'magic', fromFront: false, source: it.id });
            });
          }
          break;
        case 'steelArrows':
          this.mods.armorIgnore += def.armorIgnore;
          this.later(def.duration, () => (this.mods.armorIgnore -= def.armorIgnore));
          break;
        case 'dragonBreath':
          for (const m of this.monsters.slice()) {
            if (!this.isTargetable(m)) continue;
            this.damage(m, atk * def.atkMult, { type: 'magic', fromFront: false, source: 'dragonBreath' });
            if (m.dead) continue;
            this.ignite(m);
            const boss = m.def.boss || m.def.bossPart;
            m.stunUntil = Math.max(m.stunUntil, this.time + (boss ? def.bossStun : def.stun));
          }
          break;
        case 'blackHole': {
          const spot = this.densestSpot(def.radius);
          if (!spot) return false;
          this.vortexes.push({ x: spot.x, y: spot.y, start: this.time, until: this.time + def.duration, tick: 0.25, def });
          this.emit('vortexOpen', { x: spot.x, y: spot.y, r: def.radius, dur: def.duration });
          break;
        }
        case 'sanctuary':
          this.tempDr = { amt: 1, until: this.time + def.duration };
          break;
        case 'phoenixFeather':
          if (this.mods.revive || this.revived) return false;
          this.mods.revive = 1;
          this.reviveHeal = def.reviveHeal;
          break;
        case 'timeLoop':
          for (const sk of this.skills) sk.cd = 0;
          this.healWall(this.wall.max * def.healRatio, 'timeLoop');
          break;
        case 'godWrath':
          for (const m of this.monsters.slice()) {
            if (!this.isTargetable(m)) continue;
            this.emit('scrollBolt', { x: m.x, y: m.y + m.yOffset });
            const boss = m.def.boss || m.def.bossPart;
            if (!boss && m.hp < m.maxHp * def.executeBelow) this.damage(m, 1e12, { type: 'magic', fromFront: false, source: 'godWrath' });
            else this.damage(m, atk * def.atkMult, { type: 'magic', fromFront: false, source: 'godWrath' });
          }
          break;
        case 'goldenArrow':
          this.goldenShots += def.shots;
          this.goldenMult = def.mult;
          break;
        case 'plague':
          for (const m of this.monsters) {
            if (!this.isTargetable(m)) continue;
            this.poison(m, atk * def.dotMult, def.duration);
            this.slowMonster(m, def.slow, def.duration, 0.5);
          }
          break;
        case 'shadowLegion':
          this.buffs.push({ phantoms: def.phantoms, phantomMult: def.phantomMult, until: this.time + def.duration, src: 'legion' });
          this.emit('clonesOn', { n: def.phantoms, dur: def.duration });
          break;
        case 'holyLight':
          this.healWall(this.wall.max * def.healRatio, 'holyLight');
          if (def.drAmt >= this.tempDr.amt || this.time >= this.tempDr.until) this.tempDr = { amt: def.drAmt, until: this.time + def.drDuration };
          break;
        case 'meteor': {
          const gap = def.duration / def.count;
          for (let k = 0; k < def.count; k++) this.meteors.push({ at: this.time + k * gap, landAt: null, x: 0, y: 0 });
          break;
        }
        case 'chrono': {
          for (let l = 0; l < this.lanes; l++) this.laneEffects.push({ lane: l, type: 'freeze', until: this.time + def.duration, start: this.time });
          for (const m of this.monsters) {
            if (m.dead) continue;
            this.freezeMonster(m, def.duration);
            m.shatterUntil = this.time + def.duration;
            m.shatterAmt = def.shatter;
          }
          this.buffs.push({ aspd: def.aspdBonus, until: this.time + def.duration, src: 'chrono' });
          break;
        }
      }
      it.left--;
      it.cd = (def.cd || 0) * Math.max(0.3, 1 + this.mods.cdMult * 0.5); // 冷却缩减装备对道具只有一半效果
      this.itemsUsed.push(it.id);
      this.emit('item', { id: it.id, lane, left: it.left, cd: it.cd });
      return true;
    }

    // 道具能不能用：还有剩余，并且冷却好了
    itemReady(i) {
      const it = this.items[i];
      return !!it && it.left > 0 && it.cd <= 0;
    }

    // 冻住一只怪；Boss 的行动只看眩晕，所以同时记一次眩晕，保证 Boss 也真的停下
    freezeMonster(m, dur) {
      m.frozenUntil = Math.max(m.frozenUntil, this.time + dur);
      if (m.def.boss || m.def.bossPart) m.stunUntil = Math.max(m.stunUntil, this.time + dur);
    }

    // 陨石雨（设计书 62.3）：逐颗落下，每颗砸在落地那一刻随机的一只怪身上，周围的怪吃一半
    updateMeteors() {
      if (!this.meteors.length) return;
      const def = D.items.meteor;
      for (const mt of this.meteors) {
        if (mt.at !== null && this.time >= mt.at && mt.landAt === null) {
          const pool = this.monsters.filter((m) => this.isTargetable(m));
          if (!pool.length) {
            mt.done = true;
            continue;
          }
          const m = this.rng.pick(pool);
          mt.x = m.x;
          mt.y = m.y + m.yOffset;
          mt.landAt = this.time + 0.35;
          this.emit('meteor', { x: mt.x, y: mt.y, fall: 0.35 });
        }
        if (mt.landAt !== null && !mt.done && this.time >= mt.landAt) {
          mt.done = true;
          this.emit('meteorHit', { x: mt.x, y: mt.y, radius: def.radius });
          for (const o of this.monsters.slice()) {
            if (!this.isTargetable(o)) continue;
            const d = Math.hypot(o.x - mt.x, o.y + o.yOffset - mt.y);
            if (d <= 30) this.damage(o, this.atk * def.atkMult, { type: 'magic', fromFront: false, source: 'meteor' });
            else if (d <= def.radius) this.damage(o, this.atk * def.atkMult * def.splashMult, { type: 'magic', fromFront: false, source: 'meteor' });
          }
        }
      }
      this.meteors = this.meteors.filter((mt) => !mt.done);
    }

    // 雷霆一击的一道雷：劈向（还没被这次劈过的）血量最高的怪；返回被劈的怪，没有目标返回 null
    thunderStrike(def, struck, idx) {
      const all = this.monsters.filter((m) => this.isTargetable(m));
      const fresh = all.filter((m) => !struck.has(m));
      const pool = fresh.length ? fresh : all;
      let best = null;
      for (const m of pool) if (!best || m.hp > best.hp) best = m;
      if (!best) return null;
      struck.add(best);
      this.emit('thunder', { x: best.x, y: best.y + best.yOffset, idx: idx || 0 });
      const bx = best.x;
      const by = best.y;
      const atk = this.atk;
      // 协同"碎冰"（设计书 45）：打在被冰冻领域减速 / 冰冻的怪身上伤害 ×1.5
      const shatter = (m) => (this.inFrost(m) ? SYNERGY.shatter : 1);
      if (this.inFrost(best)) this.emitCombo('shatter', best.x, best.y + best.yOffset - 40);
      this.damage(best, atk * def.atkMult * shatter(best), { type: 'magic', fromFront: false, source: 'thunder' });
      if (def.chain) {
        const near = this.monsters
          .filter((m) => m !== best && this.isTargetable(m) && Math.hypot(m.x - bx, m.y - by) <= def.chainRange)
          .sort((a, b) => Math.hypot(a.x - bx, a.y - by) - Math.hypot(b.x - bx, b.y - by))
          .slice(0, def.chain);
        for (const m of near) {
          this.emit('thunderChain', { x0: bx, y0: by + best.yOffset, x: m.x, y: m.y + m.yOffset });
          this.damage(m, atk * def.atkMult * def.chainMult * shatter(m), { type: 'magic', fromFront: false, source: 'thunder' });
        }
      }
      return best;
    }

    // 雷霆一击后面的几道雷
    updateThunder(dt) {
      const q = this.thunderQ;
      if (!q) return;
      q.timer -= dt;
      while (q.timer <= 0 && q.left > 0) {
        q.timer += q.every;
        q.left--;
        this.thunderStrike(q.def, q.struck, q.idx++);
      }
      if (q.left <= 0) this.thunderQ = null;
    }

    // 箭雨：逐支落下，每支随机命中射程内的一只怪
    updateRain(dt) {
      const r = this.rain;
      if (!r) return;
      r.timer -= dt;
      while (r.timer <= 0 && r.left > 0) {
        r.timer += r.every;
        r.left--;
        const pool = this.monsters.filter((m) => this.isTargetable(m) && this.inRange(m));
        if (!pool.length) continue;
        const m = this.rng.pick(pool);
        this.emit('rainArrow', { x: m.x, y: m.y + m.yOffset });
        this.damage(m, r.dmg, { type: 'phys', fromFront: false, source: 'arrowRain' });
        if (r.ignite && !m.dead) this.ignite(m);
      }
      if (r.left <= 0) this.rain = null;
    }

    // ---------- 新技能与外放型被动（设计书 103） ----------
    // 给一只怪上减速（Boss 只吃 bossFactor 倍）
    slowMonster(m, amt, dur, bossFactor) {
      const boss = m.def.boss || m.def.bossPart;
      const a = amt * (boss ? bossFactor : 1);
      const prev = this.time < m.slowUntil ? m.slowAmt : 0;
      m.slowAmt = Math.max(prev, a);
      m.slowUntil = Math.max(m.slowUntil, this.time + dur);
    }

    // 中毒：dur 秒内共造成 total 点魔法伤害
    poison(m, total, dur) {
      const active = this.time < (m.poisonUntil || 0);
      if (!active) m.poisonTick = 0.5;
      m.poisonDps = Math.max(active ? m.poisonDps || 0 : 0, total / dur);
      m.poisonUntil = this.time + dur;
    }

    // 怪最密集的地方（半径 radius 内的怪最多，Boss 算 4 只）；没有目标返回 null
    densestSpot(radius) {
      const pool = this.monsters.filter((m) => this.isTargetable(m));
      if (!pool.length) return null;
      let best = null;
      let bn = -1;
      for (const m of pool) {
        let n = 0;
        for (const o of pool) if (Math.hypot(o.x - m.x, o.y + o.yOffset - (m.y + m.yOffset)) <= radius) n += 1 + (o.def.boss ? 3 : 0);
        if (n > bn) {
          bn = n;
          best = m;
        }
      }
      return { x: best.x, y: best.y + best.yOffset };
    }

    // 随机挑一只能被打的怪（落雷用）
    randomTarget() {
      const pool = this.monsters.filter((m) => this.isTargetable(m));
      return pool.length ? pool[Math.floor(this.rng() * pool.length)] : null;
    }

    later(delay, fn) {
      this.timers.push({ at: this.time + delay, fn });
    }

    updateTimers() {
      if (!this.timers.length) return;
      const due = this.timers.filter((t) => t.at <= this.time);
      if (!due.length) return;
      this.timers = this.timers.filter((t) => t.at > this.time);
      for (const t of due) t.fn();
    }

    // 幻影连射：战斗里还有效的幻影，每次攻击补射
    firePhantoms(targets) {
      let n = 0;
      let mult = 0;
      for (const b of this.buffs) {
        if (b.phantoms && this.time < b.until) {
          n += b.phantoms;
          mult = Math.max(mult, b.phantomMult);
        }
      }
      if (!n) return;
      n = Math.min(n, 6);
      for (let i = 0; i < n; i++) {
        const alive = this.rankTargets();
        if (!alive.length) break;
        const rot = (i + 1) % alive.length;
        const list = alive.slice(rot).concat(alive.slice(0, rot));
        this.inPhantom = true;
        this.phantomScale = mult;
        this.fire(list);
        this.phantomScale = 1;
        this.inPhantom = false;
        this.emit('phantomShot', { i });
      }
    }

    // 每次攻击：外放型被动按几率各掷一次
    rollProcs(targets) {
      const ps = this.stats.passives;
      for (const id of PROC_IDS) {
        if (!ps[id]) continue;
        if (this.time < (this.procCd[id] || 0)) continue;
        if (this.rng() >= this.stats.passiveVals[id]) continue;
        this.procCd[id] = this.time + 0.18;
        this.runProc(id, targets);
      }
    }

    runProc(id, targets) {
      const d = D.passiveSkills[id];
      const mult = this.stats.passiveMult[id];
      const atk = this.atk;
      const t0 = targets.find((m) => !m.dead && this.isTargetable(m));
      const sx = C.heroX + 26;
      const sy = this.heroY - 46;
      const dist = (m, x, y) => Math.hypot(m.x - x, m.y + m.yOffset - y);
      switch (id) {
        case 'lightning': {
          if (!t0) return;
          this.emit('procLightning', { x: t0.x, y: t0.y + t0.yOffset });
          this.damage(t0, atk * mult, { type: 'magic', fromFront: false, source: 'procLightning' });
          const hit = new Set([t0]);
          let cur = t0;
          for (let i = 0; i < d.chain; i++) {
            let nx = null;
            let nd = 260;
            for (const o of this.monsters) {
              if (hit.has(o) || !this.isTargetable(o)) continue;
              const dd = dist(o, cur.x, cur.y + cur.yOffset);
              if (dd < nd) {
                nd = dd;
                nx = o;
              }
            }
            if (!nx) break;
            hit.add(nx);
            this.emit('thunderChain', { x0: cur.x, y0: cur.y + cur.yOffset, x: nx.x, y: nx.y + nx.yOffset, small: true, color: '#bfe6ff' });
            this.damage(nx, atk * mult * 0.6, { type: 'magic', fromFront: false, source: 'procLightning' });
            cur = nx;
          }
          break;
        }
        case 'frostNova': {
          if (!t0) return;
          const cx = t0.x;
          const cy = t0.y + t0.yOffset;
          this.emit('procFrost', { x: cx, y: cy, r: d.radius });
          for (const m of this.monsters.slice()) {
            if (!this.isTargetable(m) || dist(m, cx, cy) > d.radius) continue;
            this.damage(m, atk * mult, { type: 'magic', fromFront: false, source: 'procFrost' });
            if (m.dead) continue;
            const prev = this.time < m.slowUntil ? m.slowAmt : 0;
            m.slowAmt = Math.max(prev, d.slow);
            m.slowUntil = Math.max(m.slowUntil, this.time + d.slowTime);
          }
          break;
        }
        case 'fireball': {
          if (!t0) return;
          const tx = t0.x;
          const ty = t0.y + t0.yOffset;
          const fly = 0.3;
          this.emit('procFireball', { x0: sx, y0: sy, x: tx, y: ty, r: d.radius, fly });
          this.later(fly, () => {
            this.emit('procFireballHit', { x: tx, y: ty, r: d.radius });
            for (const m of this.monsters.slice()) {
              if (!this.isTargetable(m)) continue;
              const dd = dist(m, tx, ty);
              if (dd > d.radius) continue;
              this.damage(m, atk * mult * (dd <= 40 ? 1 : 0.6), { type: 'magic', fromFront: false, source: 'procFireball' });
              if (!m.dead) this.ignite(m);
            }
          });
          break;
        }
        case 'spiritArrows': {
          const pool = this.monsters.filter((m) => this.isTargetable(m) && this.inRange(m));
          if (!pool.length) return;
          const picks = [];
          const bag = pool.slice();
          while (picks.length < d.count && bag.length) picks.push(bag.splice(Math.floor(this.rng() * bag.length), 1)[0]);
          picks.forEach((m, i) => {
            const fly = 0.28 + i * 0.05;
            this.emit('procSpirit', { x0: sx, y0: sy, x: m.x, y: m.y + m.yOffset, i, fly });
            this.later(fly, () => {
              if (m.dead) return;
              this.emit('procSpiritHit', { x: m.x, y: m.y + m.yOffset });
              this.damage(m, atk * mult, { type: 'magic', fromFront: false, source: 'procSpirit' });
            });
          });
          break;
        }
        case 'bladeWave': {
          if (!t0) return;
          const lane = t0.lane;
          const speed = 950;
          const x0 = C.heroX + 20;
          this.emit('procWave', { lane, dur: (C.wallX + this.range + 160 - x0) / speed });
          for (const m of this.monsters) {
            if (m.lane !== lane || !this.isTargetable(m)) continue;
            this.later(Math.max(0, (m.x - x0) / speed), () => {
              if (m.dead) return;
              this.emit('procWaveHit', { x: m.x, y: m.y + m.yOffset });
              this.damage(m, atk * mult, { type: 'phys', fromFront: false, source: 'procWave' });
            });
          }
          break;
        }
        case 'renewal':
          this.healWall(this.wall.max * mult, 'renewal');
          this.emit('procHeal', {});
          break;
      }
    }

    // 引力漩涡：每 0.25 秒把周围的怪往中心拽一把，并造成一份伤害；结束时（Lv3）爆炸
    updateVortex() {
      if (!this.vortexes.length) return;
      const keep = [];
      for (const v of this.vortexes) {
        const d = v.def;
        v.tick -= this.dtNow;
        while (v.tick <= 0 && this.time < v.until + 0.001) {
          v.tick += 0.25;
          const steps = d.duration / 0.25;
          for (const m of this.monsters.slice()) {
            if (!this.isTargetable(m) || Math.abs(m.y + m.yOffset - v.y) > d.radius || Math.abs(m.x - v.x) > d.radius * 1.6) continue;
            const boss = m.def.boss || m.def.bossPart;
            const dx = v.x - m.x;
            const pull = Math.min(Math.abs(dx), d.pull * 0.25 * (boss ? 0.25 : 1));
            m.x = Math.min(C.spawnX + 60, m.x + Math.sign(dx) * pull);
            this.damage(m, (this.atk * d.atkMult) / steps, { type: 'magic', fromFront: false, source: 'vortex' });
          }
        }
        if (this.time < v.until) keep.push(v);
        else if (d.burst) {
          this.emit('vortexBurst', { x: v.x, y: v.y, r: d.radius });
          for (const m of this.monsters.slice()) {
            if (!this.isTargetable(m) || Math.hypot(m.x - v.x, m.y + m.yOffset - v.y) > d.radius * 1.15) continue;
            this.damage(m, this.atk * d.burst, { type: 'magic', fromFront: false, source: 'vortex' });
          }
        } else this.emit('vortexBurst', { x: v.x, y: v.y, r: d.radius * 0.6, soft: true });
      }
      this.vortexes = keep;
    }

    // 烈焰之墙：车道上的怪每 0.3 秒挨一下火，被点燃
    updateFireWalls() {
      if (!this.fireWalls.length) return;
      const keep = [];
      for (const f of this.fireWalls) {
        f.tick -= this.dtNow;
        while (f.tick <= 0) {
          f.tick += 0.3;
          this.emit('firewallPulse', { lane: f.lane });
          for (const m of this.monsters.slice()) {
            if (m.lane !== f.lane || !this.isTargetable(m) || m.x < C.wallX - 10) continue;
            this.damage(m, this.atk * f.def.atkMult * 0.3, { type: 'magic', fromFront: false, source: 'firewall' });
            if (m.dead) continue;
            this.ignite(m);
            if (f.def.slow) {
              const prev = this.time < m.slowUntil ? m.slowAmt : 0;
              m.slowAmt = Math.max(prev, f.def.slow);
              m.slowUntil = Math.max(m.slowUntil, this.time + 0.8);
            }
          }
        }
        if (this.time < f.until) keep.push(f);
      }
      this.fireWalls = keep;
    }

    // 自动释放（玩家开启自动释放，或模拟机器人）
    updateAuto() {
      const inRange = this.monsters.filter((m) => this.isTargetable(m) && this.inRange(m));
      const all = this.monsters.filter((m) => this.isTargetable(m));
      const hasBoss = all.some((m) => m.def.boss);
      const wallRatio = this.wall.hp / this.wall.max;
      if (this.autoCast) {
        // 先放战鼓和冰冻领域，再放箭雨和雷霆，这样同一时刻都能放时会触发协同（设计书 45）
        const order = this.skills.map((s, i) => i).sort((a, b) => (AUTO_ORDER[this.skills[a].id] || 9) - (AUTO_ORDER[this.skills[b].id] || 9));
        order.forEach((i) => {
          const s = this.skills[i];
          if (!this.skillReady(i)) return;
          let go = false;
          switch (s.id) {
            case 'drum':
              go = inRange.length >= 3 || (hasBoss && inRange.length > 0);
              break;
            case 'repair':
              go = wallRatio < 0.6 && this.time >= this.wallSealedUntil;
              break;
            case 'arrowRain':
              go = inRange.length >= 6 || (hasBoss && inRange.length >= 2);
              break;
            case 'frost': {
              const near = all.filter((m) => m.x < C.wallX + 400).length;
              go = near >= 4 || this.monsters.some((m) => m.ai && m.ai.mode === 'warn');
              break;
            }
            case 'pierce':
              go = inRange.length >= 4 || (hasBoss && inRange.length > 0);
              break;
            case 'vortex':
              go = all.filter((m) => m.x < C.wallX + 520).length >= 5;
              break;
            case 'firewall': {
              const l = this.bestLane();
              go = all.filter((m) => m.lane === l && m.x < C.wallX + this.range).length >= 3;
              break;
            }
            case 'mark':
              go = hasBoss || all.some((m) => m.hp >= this.atk * 8);
              break;
            case 'clones':
              go = inRange.length >= 3 || (hasBoss && inRange.length > 0);
              break;
            case 'thunder': {
              go = all.some((m) => m.hp >= this.atk * 4) || this.monsters.some((m) => m.ai && m.ai.mode === 'warn');
              // 贝贝合壳、波波有触手护身时先等一等（设计书 52.3）
              const top = all.reduce((a, m) => (!a || m.hp > a.hp ? m : a), null);
              if (top && this.damageMult(top, { source: 'thunder', peek: true }) < 0.5) go = false;
              break;
            }
          }
          if (go) {
            const warnBoss = this.monsters.find((m) => m.ai && m.ai.mode === 'warn');
            this.castSkill(i, s.id === 'frost' && warnBoss ? warnBoss.lane : undefined);
          }
        });
      }
      if (this.autoItems) {
        this.items.forEach((it, i) => {
          if (!this.itemReady(i)) return;
          let go = false;
          switch (it.id) {
            case 'bomb': {
              const lane = this.bestLane();
              go = all.filter((m) => m.lane === lane).length >= 5;
              break;
            }
            case 'patch':
              go = wallRatio < 0.45 && this.time >= this.wallSealedUntil;
              break;
            case 'haste':
              go = inRange.length >= 6 || (hasBoss && inRange.length > 0 && wallRatio < 0.8);
              break;
            case 'freeze':
              go = wallRatio < 0.7 && all.filter((m) => m.x < C.wallX + 200).length >= 4;
              break;
            // 新道具的自动使用规则（设计书 62.5）
            case 'firebomb':
            case 'bigBomb': {
              const lane = this.bestLane();
              go = all.filter((m) => m.lane === lane).length >= (it.id === 'bigBomb' ? 6 : 4);
              break;
            }
            case 'thunderScroll':
              go = hasBoss || inRange.filter((m) => m.hp > this.atk * 6).length >= 4;
              break;
            case 'barrier':
              go = wallRatio < 0.7;
              break;
            case 'warBanner':
              go = inRange.length >= 6 || (hasBoss && inRange.length > 0);
              break;
            case 'quake':
            case 'blizzard':
            case 'flood':
              go = all.filter((m) => m.x < C.wallX + 300).length >= 5 || all.some((m) => m.def.boss && m.x < C.wallX + 220);
              break;
            case 'holyLight':
              go = wallRatio < 0.5 && this.time >= this.wallSealedUntil;
              break;
            case 'meteor':
              go = inRange.length >= 8;
              break;
            case 'chrono':
              go = all.filter((m) => m.x < C.wallX + 350).length >= 6 || all.some((m) => m.def.boss && m.x < C.wallX + 250);
              break;
            // v1.05 新增道具的自动使用规则
            case 'spikeTrap':
            case 'ropeNet':
            case 'oilFlask':
            case 'poisonFlask': {
              const lane = this.bestLane();
              go = all.filter((m) => m.lane === lane && m.x < C.wallX + 700).length >= 3;
              break;
            }
            case 'smokeBomb':
            case 'glueTrap':
              go = all.filter((m) => m.x < C.wallX + 500).length >= 6;
              break;
            case 'bandage':
              go = wallRatio < 0.75 && this.time >= this.wallSealedUntil;
              break;
            case 'whetstone':
            case 'goldenArrow':
            case 'steelArrows':
              go = inRange.length >= 4 || (hasBoss && inRange.length > 0);
              break;
            case 'luckyCoin':
              go = all.length >= 6;
              break;
            case 'firecracker':
            case 'earthSpike':
              go = all.filter((m) => m.x < C.wallX + 400).length >= 4;
              break;
            case 'woodShield':
            case 'mirrorShield':
              go = wallRatio < 0.8 && all.some((m) => m.x < C.wallX + 300);
              break;
            case 'farsightPotion':
              go = all.length >= 5 && !inRange.length;
              break;
            case 'chainScroll':
              go = inRange.length >= 4;
              break;
            case 'vampDraught':
              go = wallRatio < 0.8 && inRange.length >= 5;
              break;
            case 'rageDraught':
            case 'shadowLegion':
              go = inRange.length >= 6 || (hasBoss && inRange.length > 0);
              break;
            case 'thunderStorm':
            case 'stormCall':
            case 'plague':
            case 'dragonBreath':
            case 'godWrath':
              go = all.filter((m) => m.x < C.wallX + 450).length >= 6 || all.some((m) => m.def.boss && m.x < C.wallX + 300);
              break;
            case 'blackHole':
              go = all.filter((m) => m.x < C.wallX + 600).length >= 7;
              break;
            case 'sanctuary':
              go = wallRatio < 0.45 && this.time >= this.wallSealedUntil;
              break;
            case 'phoenixFeather':
              go = !this.mods.revive && !this.revived && this.waveIndex >= 1;
              break;
            case 'timeLoop':
              go = wallRatio < 0.4 && this.skills.some((sk) => sk.cd > 8);
              break;
          }
          if (go) this.useItem(i);
        });
      }
    }

    // ---------- 主循环 ----------
    step(dt) {
      if (this.over || this.pendingSupply) return;
      this.time += dt;
      this.dtNow = dt;
      for (const s of this.skills) if (s.cd > 0) s.cd = Math.max(0, s.cd - dt);
      for (const it of this.items) if (it.cd > 0) it.cd = Math.max(0, it.cd - dt);
      if (this.buffs.length && this.buffs[0].until < this.time) this.buffs = this.buffs.filter((b) => b.until >= this.time);
      if (this.laneEffects.length) {
        const keep = [];
        for (const e of this.laneEffects) {
          if (e.until >= this.time) keep.push(e);
          else if (e.freezeEnd) {
            // 冰冻领域 Lv3：结束时冻结整条车道
            keep.push({ lane: e.lane, type: 'freeze', until: this.time + e.freezeEnd, start: this.time });
            for (const m of this.monsters) if (m.lane === e.lane && !m.dead) m.frozenUntil = this.time + e.freezeEnd;
            this.emit('laneFreeze', { lane: e.lane });
          }
        }
        this.laneEffects = keep;
      }
      if (this.delayed.length) this.updateDelayed();
      this.updateWaves(dt);
      if (this.over) return;
      if (this.buddyTimer !== undefined) this.updateBuddy(dt);
      this.updateMonsters(dt);
      if (this.over) return;
      this.updateWallDots(dt);
      if (this.over) return;
      if (this.zones.length && this.zones[0].until < this.time) this.zones = this.zones.filter((z) => z.until >= this.time);
      this.updateTimers();
      this.updateVortex();
      this.updateFireWalls();
      this.updateHero(dt);
      this.updateRain(dt);
      this.updateThunder(dt);
      this.updateMeteors();
      this.updateProjectiles(dt);
      if (this.autoCast || this.autoItems) this.updateAuto();
    }

    finish(win) {
      if (this.over) return;
      this.over = true;
      const wallRatio = this.wall.hp / this.wall.max;
      this.result = {
        win,
        wallRatio,
        stars: win ? TD.progression.starsFor(wallRatio) : 0,
        killCopper: this.killCopper,
        killSilver: this.killSilver,
        earlyCopper: this.earlyCopper,
        kills: this.kills,
        time: this.time,
        charm: this.charm,
        copperBonus: this.mods.copperBonus,
        supplies: this.supplyPicked.slice(),
        killsByType: Object.assign({}, this.killsByType),
        report: TD.util.deepClone(this.report),
        interrupts: this.interrupts,
        earlyCalls: this.earlyCalls,
        skillsCast: this.skillsCast,
        bestStreak: this.bestStreak,
        bubbles: this.bubblesPopped,
        combos: Object.assign({}, this.combos),
        minWallRatio: this.minWallRatio,
        skillsCarried: this.skills.length,
        itemsUsed: this.itemsUsed.slice(),
        wave: this.waveIndex + 1,
        // 无尽模式：清完的波数（最后一波没打完不算）
        wavesCleared: win ? this.waveIndex + 1 : Math.max(0, this.waveIndex + (this.waveState === 'waiting' && this.aliveCount() === 0 ? 1 : 0)),
      };
      this.emit(win ? 'win' : 'lose', this.result);
      this.emit('end', this.result);
    }

    // 无头运行到结束（用于模拟）
    runToEnd(maxTime) {
      const dt = 1 / C.tickRate;
      maxTime = maxTime || 1200;
      while (!this.over && this.time < maxTime) {
        if (this.pendingSupply) this.chooseSupply(this.botSupplyChoice(this.pendingSupply));
        this.step(dt);
      }
      if (!this.over) this.finish(false);
      return this.result;
    }
  }

  TD.Battle = Battle;
})((globalThis.TD = globalThis.TD || {}));
