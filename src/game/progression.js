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
      attrs: { atk: 0, aspd: 0, crit: 0, critDmg: 0, luck: 0 },
      wall: { level: 1, fortify: 0, mend: 0, thorns: 0 },
      weapons: Object.fromEntries(Object.keys(D.weapons).map((id) => [id, { owned: id === 'bow', lv: 0 }])),
      activeOwned: { drum: true },
      skillLv: {},
      passiveOwned: {},
      equipOwned: {},
      inventory: {},
      loadout: {
        weapon: 'bow',
        active: ['drum', null, null],
        passive: [null, null, null],
        equip: { helm: null, cape: null, trinket1: null, trinket2: null },
        items: [null, null, null],
        target: 'nearest',
        autoCast: false,
      },
      levels: {},
      chapterStarGold: {},
      stats: { battles: 0, wins: 0, kills: 0, interrupts: 0, earlyCalls: 0, supplies: 0, killsByType: {} },
      seenMonsters: {},
      seenTabs: { loadout: true, attrs: true },
      achievements: {},
      settings: { sound: true, speed: 1, difficulty: 'normal' },
      outfit: 'classic', // 铛铛的衣柜（设计书 30）
      outfitsSeen: { classic: true },
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
    save.version = SAVE_VERSION;
    return save;
  };

  P.levelRecord = (save, n) => save.levels[n] || { stars: 0, clears: 0 };

  // ---------- 铛铛的衣柜（设计书 30） ----------
  P.outfitUnlocked = (save, id) => {
    const o = D.outfits && D.outfits.find((x) => x.id === id);
    return !!o && !!o.check(save);
  };
  P.setOutfit = function (save, id) {
    if (!P.outfitUnlocked(save, id)) return false;
    save.outfit = id;
    return true;
  };
  // 新解锁、还没提示过的外观（结算界面提示一次）
  P.newOutfits = function (save) {
    save.outfitsSeen = save.outfitsSeen || {};
    const out = [];
    for (const o of D.outfits || []) {
      if (!save.outfitsSeen[o.id] && o.check(save)) {
        save.outfitsSeen[o.id] = true;
        out.push(o);
      }
    }
    return out;
  };

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
    return Object.assign({}, base, (base.tiers || [])[Math.max(0, (lv || 1) - 1)] || {}, { lv: lv || 1 });
  };
  P.skillUpgradeCost = function (save, id) {
    const lv = P.skillLevel(save, id);
    if (!lv || lv >= D.skillMaxLv) return null;
    return D.skillUpgradeCost[lv + 1];
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
    if (!w || !w.asc || !base.ascend) return base;
    return Object.assign({}, base, base.ascend.weapon || {}, { name: base.ascend.name, ascended: true });
  };
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
  P.equipStats = function (save) {
    const s = { atkFlat: 0, atkPct: 0, aspdPct: 0, crit: 0, critDmg: 0, luck: 0, rangePct: 0, wallDr: 0 };
    for (const slot of Object.keys(save.loadout.equip)) {
      const id = save.loadout.equip[slot];
      if (!id || !save.equipOwned[id]) continue;
      const st = D.equipment[id].stats;
      for (const k of Object.keys(st)) s[k] += st[k];
    }
    return s;
  };

  P.passiveSet = function (save) {
    const set = {};
    const n = P.slotCount(save, 'passive');
    save.loadout.passive.slice(0, n).forEach((id) => {
      if (id && save.passiveOwned[id]) set[id] = true;
    });
    return set;
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

    const atk = (h.atk + a.atk * A.atk.per + eq.atkFlat) * (1 + eq.atkPct);
    const aspdBase = (h.aspd + a.aspd * A.aspd.per) * (1 + eq.aspdPct);
    let crit = h.crit + a.crit * A.crit.per + eq.crit + (w.bonusCrit || 0);
    if (passives.precision) crit += D.passiveSkills.precision.crit;
    const critDmg = h.critDmg + a.critDmg * A.critDmg.per + eq.critDmg;
    const luck = a.luck * A.luck.per + eq.luck;
    const range = C.fieldWidth * h.rangeRatio * (1 + eq.rangePct);

    const wl = save.wall;
    const WU = D.wallUpgrades;
    const wallMax = Math.round(C.wall.baseHp * Math.pow(C.wall.hpGrowth, wl.level - 1));
    const wallDr = Math.min(0.6, wl.fortify * WU.fortify.per + eq.wallDr);

    return {
      weapon: weaponId,
      weaponDef: w,
      atk,
      weaponMult: w.dmgMult * (1 + wlv * D.weaponUpgrade.perLevel),
      aspd: aspdBase * w.aspdMult,
      aspdBase,
      crit: Math.min(1, crit),
      critDmg,
      luck,
      range,
      wallMax,
      wallDr,
      mend: wl.mend * WU.mend.per,
      thorns: wl.thorns * WU.thorns.per,
      passives,
    };
  };

  // 估算单体 DPS（用于界面"战力"显示和推荐）
  P.estimateDps = function (st) {
    const w = st.weaponDef || D.weapons[st.weapon];
    let perHit = st.atk * st.weaponMult * (1 + st.crit * (st.critDmg - 1));
    let hits = st.aspd;
    if (st.passives.combo) hits *= 1.2;
    if (w.bolts) perHit *= 1 + (w.bolts - 1) * w.extraBoltMult;
    if (w.boomerang) perHit *= 2;
    let dps = perHit * hits;
    if (st.passives.burn) dps += (st.atk * D.passiveSkills.burn.atkMult) / D.passiveSkills.burn.duration;
    return dps;
  };

  // 战力：一个综合指标，DPS 为主，城墙血量为辅
  P.power = function (save) {
    const st = P.heroStats(save);
    return Math.round(P.estimateDps(st) * 10 + st.wallMax / (1 - st.wallDr) / 20);
  };

  P.recommendedPower = function (n) {
    // 推荐 DPS ≈ 12 × D(n)（设计书 8.2），换算成战力
    return Math.round(12 * C.difficulty(n) * 10 * 0.85 + (1000 * Math.pow(1.1, Math.floor(n / 2))) / 20);
  };

  // ---------- 货币 ----------
  P.canAfford = function (save, cost) {
    if (!cost) return true;
    return (
      (cost.copper || 0) <= save.copper && (cost.silver || 0) <= save.silver && (cost.gold || 0) <= save.gold
    );
  };
  P.pay = function (save, cost) {
    if (!P.canAfford(save, cost)) return false;
    save.copper -= cost.copper || 0;
    save.silver -= cost.silver || 0;
    save.gold -= cost.gold || 0;
    return true;
  };
  P.costText = function (cost) {
    if (!cost) return '免费';
    const parts = [];
    if (cost.copper) parts.push(cost.copper + ' 铜');
    if (cost.silver) parts.push(cost.silver + ' 银');
    if (cost.gold) parts.push(cost.gold + ' 金');
    return parts.join(' ');
  };

  // ---------- 商店 ----------
  P.attrCost = (save, key) => {
    const lv = save.attrs[key];
    if (lv >= D.attributes[key].max) return null;
    return { copper: D.attributeCost(key, lv) };
  };
  P.buyAttr = function (save, key) {
    const cost = P.attrCost(save, key);
    if (!cost || !P.pay(save, cost)) return false;
    save.attrs[key]++;
    return true;
  };

  P.wallCost = (save, key) => {
    const u = D.wallUpgrades[key];
    const lv = save.wall[key];
    if (lv >= u.max) return null;
    return { copper: u.cost(lv) };
  };
  P.buyWall = function (save, key) {
    const cost = P.wallCost(save, key);
    if (!cost || !P.pay(save, cost)) return false;
    save.wall[key]++;
    return true;
  };

  P.buyWeapon = function (save, id) {
    const w = save.weapons[id];
    if (w.owned) return false;
    if (!P.pay(save, D.weapons[id].cost)) return false;
    w.owned = true;
    return true;
  };
  P.weaponUpgradeCost = (save, id) => {
    const w = save.weapons[id];
    if (!w.owned || w.lv >= D.weaponUpgrade.max) return null;
    return { copper: D.weaponUpgrade.cost(w.lv) };
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
    const n = P.slotCount(save, 'passive');
    const i = save.loadout.passive.slice(0, n).indexOf(null);
    if (i >= 0) save.loadout.passive[i] = id;
    return true;
  };

  P.equipSlotsFor = (slot) => (slot === 'trinket' ? ['trinket1', 'trinket2'] : [slot]);

  P.buyEquip = function (save, id) {
    if (save.equipOwned[id]) return false;
    if (!P.pay(save, D.equipment[id].cost)) return false;
    save.equipOwned[id] = true;
    const slots = P.equipSlotsFor(D.equipment[id].slot);
    const empty = slots.find((s) => !save.loadout.equip[s]);
    if (empty) save.loadout.equip[empty] = id;
    return true;
  };

  P.buyItem = function (save, id) {
    if (!P.pay(save, D.items[id].cost)) return false;
    save.inventory[id] = (save.inventory[id] || 0) + 1;
    // 有空的消耗品槽就自动放进去
    const n = P.slotCount(save, 'item');
    const lo = save.loadout.items;
    const used = lo.slice(0, n).filter((x) => x === id).length;
    const i = lo.slice(0, n).indexOf(null);
    if (i >= 0 && used < save.inventory[id]) lo[i] = id;
    return true;
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
    const arr = save.loadout[kind === 'item' ? 'items' : kind];
    if (id) {
      const owned = kind === 'active' ? save.activeOwned : kind === 'passive' ? save.passiveOwned : null;
      if (owned && !owned[id]) return false;
      if (kind === 'item') {
        const have = save.inventory[id] || 0;
        const usedElsewhere = arr.filter((x, j) => x === id && j !== index && j < n).length;
        if (usedElsewhere >= have) return false;
      } else {
        // 同一技能不能放两个槽：换位
        const j = arr.indexOf(id);
        if (j >= 0 && j !== index) arr[j] = arr[index];
      }
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
    const counts = {};
    const items = [];
    lo.items.slice(0, nI).forEach((id) => {
      if (!id) return;
      counts[id] = (counts[id] || 0) + 1;
      if (counts[id] <= (save.inventory[id] || 0)) items.push(id);
    });
    return { active, activeLv, items, target: lo.target, autoCast: lo.autoCast };
  };

  // 消耗品使用后从背包扣除
  P.consumeItem = function (save, id) {
    if ((save.inventory[id] || 0) <= 0) return;
    save.inventory[id]--;
    const n = P.slotCount(save, 'item');
    const lo = save.loadout.items;
    // 背包不够时清掉多出来的槽
    let count = 0;
    for (let i = 0; i < n; i++) {
      if (lo[i] === id) {
        count++;
        if (count > save.inventory[id]) lo[i] = null;
      }
    }
  };

  // ---------- 结算 ----------
  P.starsFor = function (wallRatio) {
    for (const [stars, min] of C.stars) if (wallRatio >= min) return stars;
    return 1;
  };

  // result: { win, wallRatio, killCopper, earlyCopper, charm }
  P.applyResult = function (save, n, result) {
    const R = C.rewards;
    const lvl = D.levels[n];
    const rec = Object.assign({ stars: 0, clears: 0 }, save.levels[n]);
    const firstClear = result.win && rec.clears === 0;
    const out = { copper: 0, silver: 0, gold: 0, stars: 0, firstClear, notes: [], unlocks: [] };
    const st = P.heroStats(save);
    const diff = C.difficulties[(save.settings && save.settings.difficulty) || 'normal'] || C.difficulties.normal;
    const copperMult = 1 + st.luck + (result.charm ? D.items.charm.copperBonus : 0) + (result.copperBonus || 0) + diff.copper;
    const before = {
      active: P.slotCount(save, 'active'),
      passive: P.slotCount(save, 'passive'),
      item: P.slotCount(save, 'item'),
    };

    let base;
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
      if (firstClear) {
        if (lvl.type === 'miniboss') out.silver += R.miniBossSilver;
        else if (lvl.type === 'boss') {
          out.silver += R.bossSilver;
          out.gold += R.bossGold;
        } else out.silver += R.firstClearSilver;
        out.notes.push('首次通关奖励');
      }
      if (stars === 3 && rec.stars < 3) {
        out.silver += R.firstThreeStarSilver;
        out.notes.push('首次三星奖励');
      }
      rec.clears++;
      rec.streak = 0;
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
    out.killCopper = result.killCopper || 0;
    out.earlyCopper = result.earlyCopper || 0;
    out.copper = Math.round((base + out.killCopper + out.earlyCopper) * copperMult);
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
    save.stats.battles++;
    if (result.win) save.stats.wins++;
    save.stats.kills += result.kills || 0;
    save.stats.interrupts += result.interrupts || 0;
    save.stats.earlyCalls += result.earlyCalls || 0;
    save.stats.supplies += (result.supplies || []).length;
    for (const k of Object.keys(result.killsByType || {})) save.stats.killsByType[k] = (save.stats.killsByType[k] || 0) + result.killsByType[k];

    out.achievements = P.checkAchievements(save, Object.assign({ level: n }, result));
    for (const o of P.newOutfits(save)) out.unlocks.push(`衣柜里多了一套新衣服：「${o.name}」（地图上的 👕）`);
    const names = { active: '主动技能槽', passive: '被动技能槽', item: '消耗品槽' };
    for (const k of Object.keys(before)) {
      const now = P.slotCount(save, k);
      if (now > before[k]) out.unlocks.push(`解锁第 ${now} 个${names[k]}`);
    }
    return out;
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
