// 局外成长：存档结构、属性计算、商店购买、配装、关卡奖励（设计书 3、4、5、6 章）
(function (TD) {
  'use strict';

  const D = TD.data;
  const C = TD.config;
  const SAVE_VERSION = 1;

  const P = (TD.progression = {});

  P.SAVE_VERSION = SAVE_VERSION;

  P.newSave = function () {
    return {
      version: SAVE_VERSION,
      copper: 0,
      silver: 0,
      gold: 0,
      diamond: 0, // 只能在九层妖塔里获得（设计书 74）
      attrs: { atk: 0, aspd: 0, crit: 0, critDmg: 0, luck: 0 },
      wall: { level: 1, fortify: 0, mend: 0, thorns: 0 },
      weapons: Object.fromEntries(Object.keys(D.weapons).map((id) => [id, { owned: id === 'bow', lv: 0 }])),
      activeOwned: { drum: true },
      skillLv: {},
      passiveOwned: {},
      passiveLv: {}, // 被动技能等级（设计书 90）；买下来是 1 级
      equipOwned: {},
      inventory: {},
      loadout: {
        weapon: 'bow',
        active: ['drum', null, null],
        passive: [null, null, null],
        equip: { helm: null, cape: null, armor: null, quiver: null, trinket1: null, trinket2: null, trinket3: null, boots: null },
        items: [null, null, null, null, null, null, null], // 7 种道具栏位（设计书 82）
        itemQty: {}, // 每种已装备的个数（1–3）；背包里的在 inventory
        target: 'nearest',
        autoCast: false,
      },
      levels: {},
      chapterStarGold: {},
      stats: { battles: 0, wins: 0, kills: 0, interrupts: 0, earlyCalls: 0, supplies: 0, killsByType: {} },
      seenMonsters: {},
      seenTabs: { loadout: true, attrs: true },
      achievements: {},
      settings: { sound: true, speed: 1, difficulty: 'normal', restMinutes: 30 },
      hero: 'dang', // 当前英雄（设计书 42）
      buddy: null, // 助战伙伴（设计书 51）
      outfit: 'classic', // 当前穿的角色（设计书 72）
      outfitsOwned: { classic: true },
      story: {}, // 守城日记（设计书 28）：段落 id → 'read' 读完 / 'skipped' 跳过
    };
  };

  // 旧版本存档迁移：补齐缺失字段
  P.migrate = function (save) {
    const fresh = P.newSave();
    // v0.17 之前的老存档：已经解锁的商店页签视为看过，不显示"新"角标
    if (!save.seenTabs) {
      save.seenTabs = { loadout: true, attrs: true };
      const h = Object.keys(save.levels || {}).filter((k) => save.levels[k].clears > 0).reduce((a, k) => Math.max(a, +k), 0);
      if (h >= 1) for (const id of ['wall', 'items', 'skills', 'equip', 'weapons', 'exchange']) save.seenTabs[id] = true;
      if (h >= 1) save.stats = Object.assign({ shopGuided: true }, save.stats || {});
    }
    // v0.19 之前的老存档：已经过去的剧情段落不补播（记为跳过），但会出现在日记本里
    if (!save.story) {
      save.story = {};
      for (const key of D.storyOrder || []) if (P.storyPassed(save, key)) save.story[key] = 'skipped';
    }
    const merge = (target, src) => {
      for (const k of Object.keys(src)) {
        if (target[k] === undefined) target[k] = TD.util.deepClone(src[k]);
        else if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && typeof target[k] === 'object')
          merge(target[k], src[k]);
      }
    };
    merge(save, fresh);
    // 旧版的 10 套颜色外观取消，穿着旧外观的存档改回默认的 Kael（设计书 72.3）
    if (!D.outfits.some((o) => o.id === save.outfit) || !P.outfitOwned(save, save.outfit)) save.outfit = 'classic';
    // 旧存档里同一种道具可能占了好几个栏位：只保留第一个（设计书 71.2）
    const seenItem = new Set();
    save.loadout.items = save.loadout.items.map((id) => {
      if (!id || seenItem.has(id) || !D.items[id]) return null;
      seenItem.add(id);
      return id;
    });
    while (save.loadout.items.length < D.itemRules.kinds) save.loadout.items.push(null);
    // v0.74 之前：栏位里的道具直接用背包里的个数。现在装备和背包分开：把栏位里的道具最多 3 个从背包挪到"已装备"
    if (!save.loadout.itemQtyMigrated) {
      save.loadout.itemQty = {};
      save.loadout.items.forEach((id, i) => {
        if (!id) return;
        const q = Math.min(D.itemRules.perKind, save.inventory[id] || 0);
        if (q <= 0) {
          save.loadout.items[i] = null;
          return;
        }
        save.inventory[id] -= q;
        save.loadout.itemQty[id] = q;
      });
      save.loadout.itemQtyMigrated = true;
    }
    // v0.79 之前：被动技能买下来就是满效果。老存档里已经拥有的，补成 10 级（效果和以前差不多），不吃亏
    for (const id of Object.keys(save.passiveOwned)) if (save.passiveOwned[id] && save.passiveLv[id] === undefined) save.passiveLv[id] = D.passiveSkills[id] ? D.passiveSkills[id].eff.max : 1;
    save.version = SAVE_VERSION;
    return save;
  };

  P.levelRecord = (save, n) => save.levels[n] || { stars: 0, clears: 0 };

  P.crowns = (save, levels) => (levels || Object.keys(save.levels)).filter((n) => (save.levels[n] || {}).crown).length;

  // ---------- 助战伙伴（设计书 51） ----------
  P.buddyUnlocked = (save, id) => {
    const f = D.town && D.town.find((x) => x.boss === id);
    return !!f && P.isCleared(save, f.level);
  };
  P.buddyId = (save) => (save.buddy && P.buddyUnlocked(save, save.buddy) ? save.buddy : null);
  P.setBuddy = function (save, id) {
    if (id && !P.buddyUnlocked(save, id)) return false;
    save.buddy = id || null;
    return true;
  };

  // ---------- 英雄（设计书 42） ----------
  P.heroUnlocked = (save, id) => !!C.heroes[id] && (!C.heroes[id].unlock || P.isCleared(save, C.heroes[id].unlock));
  P.heroId = (save) => (save.hero && P.heroUnlocked(save, save.hero) ? save.hero : 'dang');
  P.setHero = function (save, id) {
    if (!P.heroUnlocked(save, id)) return false;
    save.hero = id;
    return true;
  };

  // ---------- 角色衣柜（设计书 72）：9 位不同的人物，用金币购买，各带额外属性 ----------
  P.outfitOwned = (save, id) => id === 'classic' || !!(save.outfitsOwned && save.outfitsOwned[id]);
  P.buyOutfit = function (save, id) {
    const o = D.outfits.find((x) => x.id === id);
    if (!o || !o.cost || P.outfitOwned(save, id)) return false;
    if (!P.pay(save, o.cost)) return false;
    save.outfitsOwned = save.outfitsOwned || { classic: true };
    save.outfitsOwned[id] = true;
    save.outfit = id; // 买下来直接穿上
    save.hero = 'dang'; // 站上城墙的就是这个角色：别的英雄在场时，换回 Kael（设计书 78.3）
    return true;
  };
  P.setOutfit = function (save, id) {
    if (!D.outfits.some((x) => x.id === id) || !P.outfitOwned(save, id)) return false;
    save.outfit = id;
    save.hero = 'dang'; // 同上：衣柜里选了角色，城墙上就换成这个角色（Kael 出战）
    return true;
  };
  // 当前生效的角色（额外属性只在 Kael 出战时算）
  P.activeOutfit = (save) => (P.heroId(save) === 'dang' && P.outfitOwned(save, save.outfit) ? D.outfitById(save.outfit) : null);

  // ---------- 守城日记（设计书 28） ----------
  // 段落是否已解锁（日记本里可以看）：章节开场 = 章节开放；战前 = Boss 关开放；战后 = Boss 关已通关
  P.storyUnlocked = function (save, key) {
    const m = /^(ch|pre|post)(\d+)$/.exec(key);
    if (!m) return false;
    const k = +m[2];
    if (m[1] === 'ch') {
      const ch = D.chapters.find((c) => c.id === k);
      return !!ch && P.isUnlocked(save, ch.levels[0]);
    }
    return m[1] === 'pre' ? P.isUnlocked(save, k) : P.isCleared(save, k);
  };
  // 段落的时机是否已经过去（老存档迁移用）：章节开场 = 该章第一关已通关；战前 / 战后 = 该关已通关
  P.storyPassed = function (save, key) {
    const m = /^(ch|pre|post)(\d+)$/.exec(key);
    if (!m) return false;
    const k = +m[2];
    if (m[1] === 'ch') {
      const ch = D.chapters.find((c) => c.id === k);
      return !!ch && P.isCleared(save, ch.levels[0]);
    }
    return P.isCleared(save, k);
  };
  // 现在该自动播放的段落（没播过才播）
  P.storyDue = function (save, key) {
    return !!(D.story && D.story[key]) && !(save.story || {})[key] && P.storyUnlocked(save, key);
  };
  P.markStory = function (save, key, read) {
    save.story = save.story || {};
    if (read) save.story[key] = 'read';
    else if (!save.story[key]) save.story[key] = 'skipped';
    return P.checkAchievements(save);
  };
  P.isCleared = (save, n) => P.levelRecord(save, n).clears > 0;
  P.isUnlocked = (save, n) => n === 1 || P.isCleared(save, n - 1);
  P.highestCleared = function (save) {
    let h = 0;
    for (const k of Object.keys(save.levels)) if (save.levels[k].clears > 0) h = Math.max(h, +k);
    return h;
  };

  P.slotCount = function (save, kind) {
    const h = P.highestCleared(save);
    return D.slotUnlocks[kind].filter((req) => h >= req).length;
  };

  P.nextSlotUnlock = function (save, kind) {
    const h = P.highestCleared(save);
    const req = D.slotUnlocks[kind].find((r) => h < r);
    return req === undefined ? null : req;
  };

  // ---------- 技能升阶与武器进阶（设计书 20 章） ----------
  P.skillLevel = (save, id) => (save.activeOwned[id] ? save.skillLv[id] || 1 : 0);
  P.skillDef = function (id, lv) {
    const base = D.activeSkills[id];
    const def = Object.assign({}, base, (base.tiers || [])[Math.max(0, Math.min(lv || 1, D.skillMaxLv) - 1)] || {}, { lv: lv || 1 });
    // 第 3 级以后每升一级，效果再强一点（设计书 76.2）
    const f = Math.max(0, (lv || 1) - D.skillMaxLv);
    if (f > 0) {
      if (def.atkMult) def.atkMult *= 1 + 0.08 * f;
      if (def.arrows) def.arrows = Math.round(def.arrows * (1 + 0.05 * f));
      if (def.healRatio) def.healRatio = Math.min(1, def.healRatio + 0.01 * f);
      if (def.aspdBonus) def.aspdBonus = Math.min(3, def.aspdBonus + 0.02 * f);
      if (def.duration) def.duration += Math.min(10, 0.05 * f);
      if (def.slow) def.slow = Math.min(0.95, def.slow + 0.002 * f);
      if (def.cd) def.cd = Math.max(base.cd * 0.5, def.cd * (1 - 0.004 * f));
      // 雷霆一击：每 5 级多劈 1 道，最多 15 道
      if (def.strikes) def.strikes = Math.min(15, def.strikes + Math.floor(f / 5));
      // 新技能（设计书 103）：标记数、幻影数每 5 级 +1；标记增伤、爆炸、幻影伤害缓慢增长
      if (def.burst) def.burst *= 1 + 0.08 * f;
      if (def.bonus) def.bonus = Math.min(1.5, def.bonus + 0.01 * f);
      if (def.count) def.count = Math.min(6, def.count + Math.floor(f / 5));
      if (def.phantoms) def.phantoms = Math.min(6, def.phantoms + Math.floor(f / 5));
      if (def.phantomMult) def.phantomMult = Math.min(1.2, def.phantomMult + 0.004 * f);
    }
    return def;
  };
  P.skillUpgradeCostAt = (lv) => {
    // lv：升级前的等级
    if (lv >= D.levelCap) return null;
    if (lv < D.skillMaxLv) return D.skillUpgradeCost[lv + 1];
    return beyondCost(P.costValue(D.skillUpgradeCost[D.skillMaxLv]), lv, D.skillMaxLv);
  };
  P.skillUpgradeCost = function (save, id) {
    const lv = P.skillLevel(save, id);
    if (!lv) return null;
    return P.skillUpgradeCostAt(lv);
  };
  P.upgradeSkill = function (save, id) {
    const cost = P.skillUpgradeCost(save, id);
    if (!cost || !P.pay(save, cost)) return false;
    save.skillLv[id] = P.skillLevel(save, id) + 1;
    return true;
  };
  P.weaponDef = function (save, id) {
    const base = D.weapons[id];
    const w = save.weapons[id];
    let def = base;
    if (w && w.asc && base.ascend) def = Object.assign({}, base, base.ascend.weapon || {}, { name: base.ascend.name, ascended: true });
    // 升级档（设计书 109）：武器升到某一级后多射几箭，并换上这一档的单发伤害
    if (base.tiers && w) {
      let tier = null;
      for (const t of base.tiers) if (w.lv >= t.lv && (!tier || t.lv > tier.lv)) tier = t;
      if (tier) def = Object.assign({}, def, { bolts: Math.max(def.bolts || 0, tier.bolts), dmgMult: tier.dmgMult });
    }
    // 满级专精（设计书 53）
    if (P.hasMastery(save, id)) def = Object.assign({}, def, base.mastery.weapon(def), { mastered: true });
    return def;
  };
  P.hasMastery = (save, id) => !!(D.weapons[id].mastery && save.weapons[id] && save.weapons[id].owned && save.weapons[id].lv >= D.weaponUpgrade.max);
  P.canAscend = (save, id) => {
    const w = save.weapons[id];
    return !!(w && w.owned && !w.asc && D.weapons[id].ascend && w.lv >= D.weaponAscend.minLv);
  };
  P.ascendWeapon = function (save, id) {
    if (!P.canAscend(save, id) || !P.pay(save, D.weaponAscend.cost)) return false;
    save.weapons[id].asc = true;
    return true;
  };

  // ---------- 属性计算 ----------
  // 当前生效的装备：箭袋栏位要通关第 8 关才开放（设计书 58.2）
  P.wornEquip = function (save) {
    const out = [];
    for (const slot of Object.keys(save.loadout.equip)) {
      const id = save.loadout.equip[slot];
      if (!id || !save.equipOwned[id] || !D.equipment[id]) continue;
      if (slot === 'quiver' && P.slotCount(save, 'quiver') < 1) continue;
      out.push(id);
    }
    return out;
  };
  // 凑齐的套装（设计书 58.4）
  P.activeSets = function (save) {
    const worn = P.wornEquip(save);
    return Object.keys(D.gearSets || {}).filter((k) => D.gearSets[k].parts.every((id) => worn.includes(id)));
  };
  P.equipStats = function (save) {
    const s = { atkFlat: 0, atkPct: 0, aspdPct: 0, crit: 0, critDmg: 0, luck: 0, rangePct: 0, wallDr: 0, wallHpPct: 0 };
    for (const id of P.wornEquip(save)) {
      const st = D.equipment[id].stats;
      for (const k of Object.keys(st)) s[k] += st[k];
    }
    const ot = P.activeOutfit(save);
    if (ot) for (const k of Object.keys(ot.stats)) s[k] += ot.stats[k];
    return s;
  };
  // 装备和套装的特殊效果：进入战斗时并入战场修正（battle.mods）
  P.equipMods = function (save) {
    const mods = {};
    const add = (m) => {
      for (const k of Object.keys(m || {})) mods[k] = (mods[k] || 0) + m[k];
    };
    for (const id of P.wornEquip(save)) add(D.equipment[id].mods);
    for (const k of P.activeSets(save)) add(D.gearSets[k].mods);
    const ot = P.activeOutfit(save);
    if (ot) add(ot.mods);
    // 装备多了以后，同一种效果不能叠到离谱（冷却、无视护甲……，设计书 76.4）
    for (const k of Object.keys(D.modCaps || {})) {
      const cap = D.modCaps[k];
      if (mods[k] !== undefined) mods[k] = cap < 0 ? Math.max(cap, mods[k]) : Math.min(cap, mods[k]);
    }
    return mods;
  };
  // 装备是否已经上架
  // 装备随时可买，只看钱（设计书 66.3）；minLevel 只是商店里的“推荐关卡”提示
  P.equipAvailable = () => true;
  P.recommended = (save, d) => !!d.minLevel && P.highestCleared(save) < d.minLevel;

  // ---------- 被动技能等级（设计书 90） ----------
  P.passiveLevel = (save, id) => (save.passiveOwned[id] ? save.passiveLv[id] || 1 : 0);
  P.passiveValue = (id, lv) => {
    const e = D.passiveSkills[id].eff;
    const v = e.base + e.per * (Math.min(lv, e.max) - 1) + e.beyond * Math.max(0, lv - e.max);
    return Math.min(e.cap, v);
  };
  // 外放型被动的伤害倍数：1 级是 mult，之后每级 +10%（10 级以后每级 +1%）
  P.passiveMult = (id, lv) => {
    const d = D.passiveSkills[id];
    const base = d.mult || d.heal || 0;
    return base * (1 + 0.1 * (Math.min(lv, d.eff.max) - 1) + 0.01 * Math.max(0, lv - d.eff.max));
  };
  // 升级费用（升级前的等级 lv）
  P.passiveCostAt = (id, lv) => {
    if (lv >= D.levelCap) return null;
    const U = D.passiveUpgrade;
    const soft = D.passiveSkills[id].eff.max;
    const at = (l) => U.base * Math.pow(U.growth, l - 1);
    return lv < soft ? { copper: TD.util.round5(at(lv)) } : beyondCost(at(soft), lv, soft);
  };
  P.passiveCost = (save, id) => (save.passiveOwned[id] ? P.passiveCostAt(id, P.passiveLevel(save, id)) : null);
  P.upgradePassive = function (save, id) {
    const cost = P.passiveCost(save, id);
    if (!cost || !P.pay(save, cost)) return false;
    save.passiveLv[id] = P.passiveLevel(save, id) + 1;
    return true;
  };

  P.passiveSet = function (save) {
    const set = {};
    const n = P.slotCount(save, 'passive');
    save.loadout.passive.slice(0, n).forEach((id) => {
      if (id && save.passiveOwned[id]) set[id] = true;
    });
    return set;
  };

  // 等级换算（设计书 76.2）：基础上限（max）以内每级加 per，超出以后每级加 beyond
  const MAX_ASPD = 20; // 攻击速度上限（次 / 秒）：战斗一帧最多出手一次
  const MAX_LUCK = 10; // 幸运上限：铜币收益 +1000%
  const MAX_WALL_DR = 0.75; // 城墙减伤上限
  P.levelTotal = (def, lv, per) => {
    const soft = def.soft || def.max;
    return per * Math.min(lv, soft) + (def.beyond || 0) * Math.max(0, lv - soft);
  };
  P.attrTotal = (key, lv) => P.levelTotal(D.attributes[key], lv, D.attributes[key].per);
  // 城墙等级对应的最大血量：30 级以内每级 ×1.1，之后线性增长
  P.wallHpAt = (level) => {
    const u = D.wallUpgrades.level;
    const base = C.wall.baseHp * Math.pow(C.wall.hpGrowth, Math.min(level, u.soft) - 1);
    return level <= u.soft ? base : base * (1 + u.beyond * (level - u.soft));
  };

  // 计算出战属性（不含战斗内临时增益）
  P.heroStats = function (save, override) {
    const lo = Object.assign({}, save.loadout, override || {});
    const a = save.attrs;
    const A = D.attributes;
    const eq = P.equipStats(save);
    const weaponId = save.weapons[lo.weapon] && save.weapons[lo.weapon].owned ? lo.weapon : 'bow';
    const w = P.weaponDef(save, weaponId);
    const wlv = save.weapons[weaponId].lv;
    // 进阶带来的属性加成
    if (w.ascended && D.weapons[weaponId].ascend.stats) {
      const as = D.weapons[weaponId].ascend.stats;
      for (const k of Object.keys(as)) eq[k] = (eq[k] || 0) + as[k];
    }
    const passives = P.passiveSet(save);
    const h = C.hero;
    const hd = C.heroes[P.heroId(save)];

    const atk = (h.atk + P.attrTotal('atk', a.atk) + eq.atkFlat) * (1 + eq.atkPct) * hd.atkMult;
    const aspdBase = Math.min(MAX_ASPD, (h.aspd + P.attrTotal('aspd', a.aspd)) * (1 + eq.aspdPct) * hd.aspdMult);
    let crit = h.crit + P.attrTotal('crit', a.crit) + eq.crit + (w.bonusCrit || 0);
    // 被动技能按等级算效果（设计书 90）
    const passiveVals = {};
    const passiveMult = {};
    for (const id of Object.keys(passives)) {
      passiveVals[id] = P.passiveValue(id, P.passiveLevel(save, id));
      if (D.passiveSkills[id].proc) passiveMult[id] = P.passiveMult(id, P.passiveLevel(save, id));
    }
    if (passives.precision) crit += passiveVals.precision;
    const critDmg = h.critDmg + P.attrTotal('critDmg', a.critDmg) + eq.critDmg;
    const luck = Math.min(MAX_LUCK, P.attrTotal('luck', a.luck) + eq.luck);
    const range = C.fieldWidth * h.rangeRatio * (1 + eq.rangePct);

    const wl = save.wall;
    const WU = D.wallUpgrades;
    const wallMax = Math.round(P.wallHpAt(wl.level) * (1 + eq.wallHpPct));
    const wallDr = Math.min(MAX_WALL_DR, P.levelTotal(WU.fortify, wl.fortify, WU.fortify.per) + eq.wallDr);

    return {
      heroId: P.heroId(save),
      bell: hd.bell || null,
      heroMods: hd.mods || null,
      fireflies: hd.fireflies || null,
      knockOnHit: hd.knockOnHit || 0,
      weapon: weaponId,
      weaponDef: w,
      atk,
      weaponMult: w.dmgMult * (1 + P.levelTotal(D.weaponUpgrade, wlv, D.weaponUpgrade.perLevel)),
      aspd: Math.min(MAX_ASPD, aspdBase * w.aspdMult),
      aspdBase,
      crit: Math.min(1, crit),
      critDmg,
      luck,
      range,
      wallMax,
      wallDr,
      mend: Math.min(0.5, P.levelTotal(WU.mend, wl.mend, WU.mend.per)),
      thorns: P.levelTotal(WU.thorns, wl.thorns, WU.thorns.per),
      passives,
      passiveVals,
      passiveMult,
      gearMods: P.equipMods(save),
      zap: (P.wornEquip(save).map((id) => D.equipment[id].zap).find(Boolean)) || null,
    };
  };

  // 估算单体 DPS（用于界面"战力"显示和推荐）
  P.estimateDps = function (st) {
    const w = st.weaponDef || D.weapons[st.weapon];
    let perHit = st.atk * st.weaponMult * (1 + st.crit * (st.critDmg - 1));
    let hits = st.aspd;
    if (st.passives.combo) hits *= 1 + st.passiveVals.combo;
    if (w.bolts) perHit *= 1 + (w.bolts - 1) * w.extraBoltMult;
    if (w.boomerang) perHit *= 2;
    let dps = perHit * hits;
    if (st.passives.burn) dps += (st.atk * st.passiveVals.burn) / D.passiveSkills.burn.duration;
    // 外放型被动：几率 × 伤害倍数 × 攻击频率（灵箭三支、雷鸣连锁都按单体估算）
    for (const id of Object.keys(st.passiveMult || {})) {
      const d = D.passiveSkills[id];
      if (d.heal) continue;
      dps += st.atk * st.passiveVals[id] * st.passiveMult[id] * (d.count || 1) * st.aspd;
    }
    return dps;
  };

  // 战力：一个综合指标，DPS 为主，城墙血量为辅
  P.power = function (save) {
    const st = P.heroStats(save);
    return Math.round(P.estimateDps(st) * 10 + st.wallMax / (1 - st.wallDr) / 20);
  };

  P.recommendedPower = function (n) {
    // 推荐 DPS ≈ 12 × D(n)（设计书 8.2），换算成战力
    return Math.round(12 * C.difficulty(n) * 10 * 0.85 + (1000 * Math.pow(1.1, Math.floor(Math.min(n, 100) / 2))) / 20) // 第 100 关以后城墙血量项不再指数增长（深渊回响，设计书 112）;
  };

  // ---------- 货币 ----------
  P.canAfford = function (save, cost) {
    if (!cost) return true;
    return (
      (cost.copper || 0) <= save.copper && (cost.silver || 0) <= save.silver && (cost.gold || 0) <= save.gold && (cost.diamond || 0) <= (save.diamond || 0)
    );
  };
  P.pay = function (save, cost) {
    if (!P.canAfford(save, cost)) return false;
    save.copper -= cost.copper || 0;
    save.silver -= cost.silver || 0;
    save.gold -= cost.gold || 0;
    save.diamond = (save.diamond || 0) - (cost.diamond || 0);
    return true;
  };
  P.costText = function (cost) {
    if (!cost) return '免费';
    const parts = [];
    if (cost.copper) parts.push(cost.copper + ' 铜');
    if (cost.silver) parts.push(cost.silver + ' 银');
    if (cost.gold) parts.push(cost.gold + ' 金');
    if (cost.diamond) parts.push(cost.diamond + ' 钻');
    return parts.join(' ');
  };

  // ---------- 商店 ----------
  // 每一类升级的"第 lv 级 → lv+1 级"费用：基础上限以内沿用原来的铜币公式，超出以后按 D.extraCost 折算再换成货币（设计书 76.2）
  const beyondCost = (v0, lv, soft) => D.tierCost(D.extraCost(v0, lv, soft));
  P.attrCostAt = (key, lv) => {
    if (lv >= D.levelCap) return null;
    const soft = D.attributes[key].soft;
    return lv < soft ? { copper: D.attributeCost(key, lv) } : beyondCost(D.attributeCost(key, soft), lv, soft);
  };
  P.attrCost = (save, key) => P.attrCostAt(key, save.attrs[key]);
  P.buyAttr = function (save, key) {
    const cost = P.attrCost(save, key);
    if (!cost || !P.pay(save, cost)) return false;
    save.attrs[key]++;
    return true;
  };

  P.wallCostAt = (key, lv) => {
    const u = D.wallUpgrades[key];
    if (lv >= D.levelCap) return null;
    return lv < u.soft ? { copper: u.cost(lv) } : beyondCost(u.cost(u.soft), lv, u.soft);
  };
  P.wallCost = (save, key) => P.wallCostAt(key, save.wall[key]);
  P.buyWall = function (save, key) {
    const cost = P.wallCost(save, key);
    if (!cost || !P.pay(save, cost)) return false;
    save.wall[key]++;
    return true;
  };

  // ---------- 批量升级（设计书 76.2）：等级可以到 999999，一级一级点不现实 ----------
  const UPGRADES = {
    attr: { get: (s, k) => s.attrs[k], set: (s, k, v) => (s.attrs[k] = v), costAt: (s, k, lv) => P.attrCostAt(k, lv) },
    wall: { get: (s, k) => s.wall[k], set: (s, k, v) => (s.wall[k] = v), costAt: (s, k, lv) => P.wallCostAt(k, lv) },
    weapon: { get: (s, k) => s.weapons[k].lv, set: (s, k, v) => (s.weapons[k].lv = v), costAt: (s, k, lv) => (s.weapons[k].owned ? P.weaponUpgradeCostAt(k, lv) : null) },
    passive: { get: (s, k) => P.passiveLevel(s, k), set: (s, k, v) => (s.passiveLv[k] = v), costAt: (s, k, lv) => (lv ? P.passiveCostAt(k, lv) : null) },
    skill: { get: (s, k) => P.skillLevel(s, k), set: (s, k, v) => (s.skillLv[k] = v), costAt: (s, k, lv) => (lv ? P.skillUpgradeCostAt(lv) : null) },
  };
  // 一次最多升 n 级（n 可以是 Infinity = 能升多少升多少）；dry 只算不买；ignoreWallet 配合 dry 用来看"接下来 n 级一共多少钱"
  // 返回 { count, cost }：升了几级、花了多少
  P.bulkUpgrade = function (save, kind, key, n, opts) {
    opts = opts || {};
    const U = UPGRADES[kind];
    const wallet = { copper: save.copper, silver: save.silver, gold: save.gold, diamond: save.diamond || 0 };
    const total = {};
    let lv = U.get(save, key);
    let count = 0;
    while (count < n) {
      const c = U.costAt(save, key, lv);
      if (!c) break;
      let ok = true;
      for (const k of Object.keys(c)) if (!opts.ignoreWallet && (c[k] || 0) > wallet[k]) ok = false;
      if (!ok) break;
      for (const k of Object.keys(c)) {
        wallet[k] -= c[k];
        total[k] = (total[k] || 0) + c[k];
      }
      lv++;
      count++;
    }
    if (!opts.dry && count) {
      P.pay(save, total);
      U.set(save, key, lv);
    }
    return { count, cost: total };
  };

  P.buyWeapon = function (save, id) {
    const w = save.weapons[id];
    if (w.owned || !P.weaponUnlocked(save, id)) return false;
    if (!P.pay(save, D.weapons[id].cost)) return false;
    w.owned = true;
    return true;
  };
  // 武器随时可买，只看钱（设计书 66.3）；minLevel 只是商店里的“推荐关卡”提示
  P.weaponUnlocked = () => true;
  P.weaponUpgradeMult = (id) => D.weaponRarity[D.weapons[id].rarity || 1].upgradeMult;
  P.weaponUpgradeCostAt = (id, lv) => {
    if (lv >= D.levelCap) return null;
    const k = P.weaponUpgradeMult(id);
    const soft = D.weaponUpgrade.max;
    return lv < soft ? { copper: TD.util.round5(D.weaponUpgrade.cost(lv) * k) } : beyondCost(D.weaponUpgrade.cost(soft) * k, lv, soft);
  };
  P.weaponUpgradeCost = (save, id) => {
    const w = save.weapons[id];
    if (!w.owned) return null;
    return P.weaponUpgradeCostAt(id, w.lv);
  };
  P.upgradeWeapon = function (save, id) {
    const cost = P.weaponUpgradeCost(save, id);
    if (!cost || !P.pay(save, cost)) return false;
    save.weapons[id].lv++;
    return true;
  };

  P.buyActive = function (save, id) {
    if (save.activeOwned[id]) return false;
    if (!P.pay(save, D.activeSkills[id].cost)) return false;
    save.activeOwned[id] = true;
    // 有空槽就自动装上
    const n = P.slotCount(save, 'active');
    const i = save.loadout.active.slice(0, n).indexOf(null);
    if (i >= 0) save.loadout.active[i] = id;
    return true;
  };
  P.buyPassive = function (save, id) {
    if (save.passiveOwned[id]) return false;
    if (!P.pay(save, D.passiveSkills[id].cost)) return false;
    save.passiveOwned[id] = true;
    save.passiveLv[id] = 1;
    const n = P.slotCount(save, 'passive');
    const i = save.loadout.passive.slice(0, n).indexOf(null);
    if (i >= 0) save.loadout.passive[i] = id;
    return true;
  };

  P.equipSlotsFor = (slot) => (slot === 'trinket' ? ['trinket1', 'trinket2', 'trinket3'] : [slot]);

  // 卖出价是买入价的一半（设计书 61.5）；一半不是整数时，零头折成下一级货币
  P.halfCost = function (cost) {
    const E = C.exchange;
    const g = (cost && cost.gold) || 0;
    const s = (cost && cost.silver) || 0;
    const c = (cost && cost.copper) || 0;
    const d = (cost && cost.diamond) || 0;
    const out = {};
    const gold = Math.floor(g / 2);
    const silver = Math.floor(s / 2) + (g % 2) * (E.silverPerGold / 2);
    const copper = Math.floor(c / 2) + (s % 2) * (E.copperPerSilver / 2);
    const diamond = Math.floor(d / 2);
    if (copper) out.copper = copper;
    if (silver) out.silver = silver;
    if (gold) out.gold = gold;
    if (diamond) out.diamond = diamond;
    return out;
  };
  P.sellPrice = (id) => P.halfCost(D.equipment[id].cost);
  // 把价格折成铜币，用来比较贵贱（设计书 63.2）
  // 测试工具（设计书 68.4）：货币都设成最大值
  P.MAX_CURRENCY = 9999999;
  P.MAX_DIAMOND = 9999;
  P.maxResources = function (save) {
    save.copper = save.silver = save.gold = P.MAX_CURRENCY;
    save.diamond = P.MAX_DIAMOND;
  };
  P.costValue = (cost) => {
    const E = C.exchange;
    if (!cost) return 0;
    return (cost.copper || 0) + (cost.silver || 0) * E.copperPerSilver + (cost.gold || 0) * E.copperPerSilver * E.silverPerGold + (cost.diamond || 0) * E.copperPerSilver * E.silverPerGold * 100;
  };
  P.sellEquip = function (save, id) {
    if (!save.equipOwned[id] || !D.equipment[id]) return null;
    for (const k of Object.keys(save.loadout.equip)) if (save.loadout.equip[k] === id) save.loadout.equip[k] = null;
    delete save.equipOwned[id];
    const price = P.sellPrice(id);
    save.copper += price.copper || 0;
    save.silver += price.silver || 0;
    save.gold += price.gold || 0;
    save.diamond = (save.diamond || 0) + (price.diamond || 0);
    return price;
  };

  // 穿上一件已经拥有的装备：对应栏位里原来的那件被换下；饰品有 3 个栏位，先放空位，满了就换掉第 1 个
  P.wearEquip = function (save, id) {
    if (!save.equipOwned[id] || !D.equipment[id]) return false;
    const slots = P.equipSlotsFor(D.equipment[id].slot);
    if (slots.some((k) => save.loadout.equip[k] === id)) return true;
    const target = slots.find((k) => !save.loadout.equip[k]) || slots[0];
    return P.setEquip(save, target, id);
  };
  P.unwearEquip = function (save, id) {
    for (const k of Object.keys(save.loadout.equip)) if (save.loadout.equip[k] === id) save.loadout.equip[k] = null;
    return true;
  };

  P.buyEquip = function (save, id) {
    if (save.equipOwned[id] || !P.equipAvailable(save, id)) return false;
    if (!P.pay(save, D.equipment[id].cost)) return false;
    save.equipOwned[id] = true;
    const slots = P.equipSlotsFor(D.equipment[id].slot);
    const empty = slots.find((s) => save.loadout.equip[s] === null || save.loadout.equip[s] === undefined);
    if (empty) save.loadout.equip[empty] = id;
    return true;
  };

  // 买道具：先进背包；要带进战斗得"装备"（每种最多 3 个，最多 7 种，设计书 82）
  P.buyItem = function (save, id) {
    if (!P.pay(save, D.items[id].cost)) return false;
    save.inventory[id] = (save.inventory[id] || 0) + 1;
    return true;
  };

  // 已装备 / 背包里有多少个
  P.itemEquipped = (save, id) => (id && save.loadout.itemQty && save.loadout.itemQty[id]) || 0;
  P.itemStock = (save, id) => save.inventory[id] || 0;
  P.itemSlotOf = (save, id) => save.loadout.items.indexOf(id);
  // 把某种道具装备到第 slot 个栏位，装备 qty 个（缺省 = 装满 3 个；0 = 卸下）：个数在背包和装备之间挪，栏位里原来的别的道具退回背包
  P.equipItem = function (save, slot, id, qty) {
    const n = P.slotCount(save, 'item');
    if (slot < 0 || slot >= n) return false;
    const lo = save.loadout;
    const old = lo.items[slot];
    if (old && old !== id) P.unequipItem(save, slot);
    if (!id || !D.items[id]) return true;
    // 同一种道具只占一个栏位：在别的栏位里的，换到这里来
    const other = lo.items.indexOf(id);
    if (other >= 0 && other !== slot) lo.items[other] = null;
    const have = P.itemEquipped(save, id);
    const want = Math.max(0, Math.min(D.itemRules.perKind, qty === undefined ? D.itemRules.perKind : qty, have + (save.inventory[id] || 0)));
    save.inventory[id] = (save.inventory[id] || 0) + have - want;
    if (want <= 0) {
      delete lo.itemQty[id];
      lo.items[slot] = null;
      return true;
    }
    lo.items[slot] = id;
    lo.itemQty[id] = want;
    return true;
  };
  // 卸下一个栏位：已装备的全部退回背包
  P.unequipItem = function (save, slot) {
    const lo = save.loadout;
    const id = lo.items[slot];
    if (!id) return false;
    save.inventory[id] = (save.inventory[id] || 0) + P.itemEquipped(save, id);
    delete lo.itemQty[id];
    lo.items[slot] = null;
    return true;
  };
  // 商店里的快捷操作：装备 +1 / −1（没装备过就放进第一个空栏位）
  P.adjustItem = function (save, id, delta) {
    const n = P.slotCount(save, 'item');
    let slot = P.itemSlotOf(save, id);
    const cur = P.itemEquipped(save, id);
    if (delta > 0) {
      if (cur >= D.itemRules.perKind || (save.inventory[id] || 0) < 1) return false;
      if (slot < 0 || slot >= n) {
        slot = save.loadout.items.slice(0, n).findIndex((x) => !x);
        if (slot < 0) return false;
      }
      return P.equipItem(save, slot, id, cur + 1);
    }
    if (slot < 0 || cur < 1) return false;
    return P.equipItem(save, slot, id, cur - 1);
  };

  P.exchange = function (save, from, times) {
    times = times || 1;
    const E = C.exchange;
    if (from === 'copper') {
      if (save.copper < E.copperPerSilver * times) return false;
      save.copper -= E.copperPerSilver * times;
      save.silver += times;
      return true;
    }
    if (from === 'silver') {
      if (save.silver < E.silverPerGold * times) return false;
      save.silver -= E.silverPerGold * times;
      save.gold += times;
      return true;
    }
    return false;
  };

  // ---------- 配装 ----------
  P.setWeapon = function (save, id) {
    if (!save.weapons[id] || !save.weapons[id].owned) return false;
    save.loadout.weapon = id;
    return true;
  };
  P.setSlot = function (save, kind, index, id) {
    const n = P.slotCount(save, kind);
    if (index >= n) return false;
    // 道具：装备到栏位，默认装满 3 个（背包里不够就有多少装多少）；一个都没有就装不上
    if (kind === 'item') {
      if (id && P.itemEquipped(save, id) + P.itemStock(save, id) < 1) return false;
      return P.equipItem(save, index, id || null, undefined);
    }
    const arr = save.loadout[kind];
    if (id) {
      const owned = kind === 'active' ? save.activeOwned : save.passiveOwned;
      if (owned && !owned[id]) return false;
      // 同一技能不能放两个槽：换位（设计书 71.2）
      const j = arr.indexOf(id);
      if (j >= 0 && j !== index) arr[j] = arr[index];
    }
    arr[index] = id || null;
    return true;
  };
  P.setEquip = function (save, slotKey, id) {
    if (id) {
      if (!save.equipOwned[id]) return false;
      const eqSlot = D.equipment[id].slot;
      if (!P.equipSlotsFor(eqSlot).includes(slotKey)) return false;
      // 饰品不能重复佩戴同一件
      for (const k of Object.keys(save.loadout.equip)) if (save.loadout.equip[k] === id && k !== slotKey) save.loadout.equip[k] = null;
    }
    save.loadout.equip[slotKey] = id || null;
    return true;
  };

  // 出战配置：只保留已解锁槽位、已拥有的物品
  P.battleLoadout = function (save) {
    const lo = save.loadout;
    const nA = P.slotCount(save, 'active');
    const nI = P.slotCount(save, 'item');
    const active = lo.active.slice(0, nA).filter((id) => id && save.activeOwned[id]);
    const activeLv = {};
    for (const id of active) activeLv[id] = P.skillLevel(save, id);
    const items = [];
    const itemQty = {};
    lo.items.slice(0, nI).forEach((id) => {
      const q = P.itemEquipped(save, id);
      if (id && !items.includes(id) && q >= 1) {
        items.push(id);
        itemQty[id] = Math.min(D.itemRules.perKind, q);
      }
    });
    return { active, activeLv, items, itemQty, target: lo.target, autoCast: lo.autoCast, buddy: P.buddyId(save) };
  };

  // 战斗里用掉一个道具：已装备的个数减 1；用完了栏位清空（背包里还有的话，要重新装备才会带进下一场）
  P.consumeItem = function (save, id) {
    if (P.itemEquipped(save, id) <= 0) return;
    save.loadout.itemQty[id]--;
    if (save.loadout.itemQty[id] <= 0) {
      delete save.loadout.itemQty[id];
      const lo = save.loadout.items;
      for (let i = 0; i < lo.length; i++) if (lo[i] === id) lo[i] = null;
    }
  };

  // ---------- 结算 ----------
  P.starsFor = function (wallRatio) {
    for (const [stars, min] of C.stars) if (wallRatio >= min) return stars;
    return 1;
  };

  // 哪些关卡会给银币：小 Boss、大 Boss、精英挑战（设计书 88）
  P.givesSilver = (lvl) => !!lvl && ['miniboss', 'boss', 'elite'].includes(lvl.type);

  // result: { win, wallRatio, killCopper, earlyCopper, charm }
  P.applyResult = function (save, n, result) {
    const R = C.rewards;
    const lvl = D.levels[n];
    const rec = Object.assign({ stars: 0, clears: 0 }, save.levels[n]);
    const firstClear = result.win && rec.clears === 0;
    const out = { copper: 0, silver: 0, gold: 0, stars: 0, firstClear, notes: [], unlocks: [] };
    const st = P.heroStats(save);
    const diffId = (save.settings && save.settings.difficulty) || 'normal';
    const diff = C.difficulties[diffId] || C.difficulties.normal;
    const copperMult = 1 + st.luck + (result.charm ? D.items.charm.copperBonus : 0) + (result.copperBonus || 0) + diff.copper;
    const before = {
      active: P.slotCount(save, 'active'),
      passive: P.slotCount(save, 'passive'),
      item: P.slotCount(save, 'item'),
    };

    let base;
    let bonusCopper = 0; // 普通关卡的关卡任务奖励（铜币）
    if (result.win) {
      const stars = P.starsFor(result.wallRatio);
      out.stars = stars;
      base = R.baseCopper(n) * R.starMult[stars];
      if (lvl.type === 'miniboss') base *= R.miniBossCopperMult;
      if (lvl.type === 'boss') base *= R.bossCopperMult;
      if (!firstClear) {
        base *= R.repeatMult;
        out.notes.push('重复通关：通关铜币减半');
      }
      // 普通关卡不给银币（设计书 88）：银币只在首次通关小 Boss、大 Boss、精英挑战关时给；平时用铜币去汇兑所换
      const silverLevel = P.givesSilver(lvl);
      if (firstClear && silverLevel) {
        if (lvl.type === 'miniboss') out.silver += R.miniBossSilver;
        else if (lvl.type === 'boss') {
          out.silver += R.bossSilver;
          out.gold += R.bossGold;
        } else out.silver += R.firstClearSilver;
        out.notes.push('首次通关奖励');
      }
      if (stars === 3 && rec.stars < 3 && silverLevel) {
        out.silver += R.firstThreeStarSilver;
        out.notes.push('首次三星奖励');
      }
      rec.clears++;
      rec.streak = 0;
      // 关卡任务（设计书 36）：特殊关卡奖励银币，普通关卡奖励铜币
      const mid = D.missionFor && D.missionFor(n);
      if (mid && !rec.mission && D.missions[mid].check(result)) {
        rec.mission = true;
        if (silverLevel) {
          out.silver += D.missionReward.silver;
          out.notes.push(`🎯 完成关卡任务「${D.missions[mid].name}」：+${D.missionReward.silver} 银`);
        } else {
          bonusCopper += D.missionReward.copper;
          out.notes.push(`🎯 完成关卡任务「${D.missions[mid].name}」：+${D.missionReward.copper} 铜`);
        }
      }
      // 挑战王冠（设计书 31）
      if (diffId === 'hard' && !rec.crown) {
        rec.crown = true;
        if (silverLevel) out.silver += 1;
        out.notes.push('👑 首次在挑战难度通关：获得王冠');
      }
      rec.stars = Math.max(rec.stars, stars);
    } else {
      base = R.baseCopper(n) * R.failMult;
      out.notes.push('失败安慰奖励');
      rec.fails = (rec.fails || 0) + 1;
      rec.streak = (rec.streak || 0) + 1;
      const r = P.rally(save, n);
      if (r > 0) out.notes.push(`援军鼓舞：下次挑战本关攻击和城墙 +${Math.round(r * 100)}%`);
    }
    out.baseCopper = Math.round(base);
    // 回归的小 Boss 被击败：每个 1 银币（设计书 110），胜负都算
    if (result.killSilver) {
      out.silver += result.killSilver;
      out.notes.push(`回归的小 Boss 被击败：+${result.killSilver} 银币`);
    }
    const killCopper = result.killCopper || 0;
    out.killCopper = Math.round(killCopper);
    out.earlyCopper = result.earlyCopper || 0;
    out.copper = Math.round((base + killCopper + out.earlyCopper + bonusCopper) * copperMult);
    out.copperMult = copperMult;
    save.levels[n] = rec;

    // 章节全三星
    for (const ch of D.chapters) {
      if (save.chapterStarGold[ch.id]) continue;
      if (ch.levels.every((k) => (save.levels[k] || {}).stars === 3)) {
        save.chapterStarGold[ch.id] = true;
        out.gold += R.chapterAllStarsGold;
        out.notes.push(`第${ch.id}章全三星奖励`);
      }
    }

    save.copper += out.copper;
    save.silver += out.silver;
    save.gold += out.gold;
    P.recordStats(save, result, result.win);

    out.achievements = P.checkAchievements(save, Object.assign({ level: n }, result));
    const names = { active: '主动技能槽', passive: '被动技能槽', item: '消耗品槽' };
    for (const k of Object.keys(before)) {
      const now = P.slotCount(save, k);
      if (now > before[k]) out.unlocks.push(`解锁第 ${now} 个${names[k]}`);
    }
    // 首次通关时的功能解锁提示（设计书 38、39）
    if (firstClear) {
      const FEATURE = { 5: '解锁「王国小镇」（地图上的 🏘）和「每日挑战」（地图右下角）', 10: '解锁 3 倍速：战斗右下角的速度按钮', 20: '解锁「无尽模式」（地图右下角）', 50: '解锁第六章「云端王国」', 60: '解锁第七章「珊瑚海湾」和「九层妖塔」（地图右下角）', 70: '解锁第八章「月影古堡」——混沌裂缝里掉出了回声怪物', 80: '解锁第九章「赤铁熔炉」', 90: '解锁第十章「虚空天域」——最后一章', 100: '通关第 100 关！深渊回响开启：第十一至二十章（第 101–200 关）', 200: '通关全部 200 关！' };
      if (FEATURE[n]) out.unlocks.push(FEATURE[n]);
    }
    return out;
  };

  // 一场战斗结束后累计统计（普通关卡、无尽、每日、九层妖塔共用）
  P.recordStats = function (save, result, win) {
    const st = save.stats;
    st.battles++;
    if (win) st.wins++;
    st.kills += result.kills || 0;
    st.bestStreak = Math.max(st.bestStreak || 0, result.bestStreak || 0);
    for (const v of Object.values(result.combos || {})) st.combos = (st.combos || 0) + v;
    st.interrupts += result.interrupts || 0;
    st.earlyCalls += result.earlyCalls || 0;
    st.supplies += (result.supplies || []).length;
    st.bubbles = (st.bubbles || 0) + (result.bubbles || 0);
    for (const k of Object.keys(result.killsByType || {})) st.killsByType[k] = (st.killsByType[k] || 0) + result.killsByType[k];
  };

  // 成就（设计书 24.1）：检查并发放奖励，返回新达成的成就
  P.checkAchievements = function (save, ctx) {
    const got = [];
    save.achievements = save.achievements || {};
    for (const a of D.achievements || []) {
      if (save.achievements[a.id]) continue;
      let ok = false;
      try {
        ok = a.check(save, ctx || null);
      } catch (e) {
        ok = false;
      }
      if (!ok) continue;
      save.achievements[a.id] = true;
      save.copper += a.reward.copper || 0;
      save.silver += a.reward.silver || 0;
      save.gold += a.reward.gold || 0;
      got.push(a);
    }
    return got;
  };

  // 援军鼓舞（设计书 27.5）：同一关连续失败的次数换算成攻击 / 城墙加成
  P.rally = function (save, n) {
    if (typeof n !== 'number' || !save.levels[n]) return 0;
    const R = C.rally;
    return Math.min(R.cap, (save.levels[n].streak || 0) * R.per);
  };

  // 某把武器比练得最高的武器低 3 级以上（推荐配装此时不会硬切过去，设计书 27.2）
  P.weaponLagging = function (save, id) {
    let top = 0;
    for (const k of Object.keys(save.weapons)) if (save.weapons[k].owned) top = Math.max(top, save.weapons[k].lv || 0);
    return save.weapons[id].owned && top - (save.weapons[id].lv || 0) >= 3;
  };

  // 失败后的强化建议：挑出当前买得起（或最接近）的高性价比升级
  P.suggestions = function (save, n) {
    const list = [];
    const tips = [];
    if (n) {
      const lo = save.loadout;
      if (!lo.autoCast && P.battleLoadout(save).active.length) tips.push({ text: '试试开启「技能自动释放」（战斗右下角），技能冷却好就会自动放', afford: true });
      const adv = P.idealWeapon && P.idealWeapon(n);
      if (adv && !save.weapons[adv.id].owned) tips.push({ text: `解锁推荐武器「${D.weapons[adv.id].name}」：${adv.reason}（${P.costText(D.weapons[adv.id].cost)}）`, afford: P.canAfford(save, D.weapons[adv.id].cost) });
      else if (adv && P.weaponLagging(save, adv.id)) {
        const c = P.weaponUpgradeCost(save, adv.id);
        if (c) tips.push({ label: 'advWeapon', text: `推荐武器「${D.weapons[adv.id].name}」等级偏低，先升级它：${adv.reason}（${P.costText(c)}）`, afford: P.canAfford(save, c) });
      }
      const rec = P.levelRecord(save, n);
      if ((rec.fails || 0) >= 3 && (save.settings.difficulty || 'normal') === 'normal') tips.push({ text: '也可以在「设置」里切换到轻松难度', afford: true });
    }
    const st = P.heroStats(save);
    const dps0 = P.estimateDps(st);
    const tryGain = (label, mutate, cost) => {
      if (!cost) return;
      const clone = TD.util.deepClone(save);
      mutate(clone);
      const gain = P.estimateDps(P.heroStats(clone)) / dps0 - 1;
      list.push({ label, cost, gain, afford: P.canAfford(save, cost) });
    };
    for (const k of Object.keys(D.attributes)) {
      if (k === 'luck') continue;
      tryGain(`升级${D.attributes[k].name}`, (s) => s.attrs[k]++, P.attrCost(save, k));
    }
    const wid = save.loadout.weapon;
    tryGain(`升级${D.weapons[wid].name}`, (s) => s.weapons[wid].lv++, P.weaponUpgradeCost(save, wid));
    list.forEach((x) => (x.value = x.gain / (x.cost.copper || 1)));
    // 提升不到 1% 的不推荐
    for (let i = list.length - 1; i >= 0; i--) if (list[i].gain < 0.01) list.splice(i, 1);
    list.sort((a, b) => b.value - a.value);
    const out = tips.concat(list.slice(0, 3).map((x) => ({ label: x.label, text: `${x.label}：战力 +${Math.round(x.gain * 100)}%（${P.costText(x.cost)}）`, afford: x.afford })));
    const wallCost = P.wallCost(save, 'level');
    if (wallCost) out.push({ label: '城墙等级', text: `升级城墙等级：城墙血量 +10%（${P.costText(wallCost)}）`, afford: P.canAfford(save, wallCost) });
    return out;
  };
})((globalThis.TD = globalThis.TD || {}));
