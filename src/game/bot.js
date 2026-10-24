// 模拟玩家：用于自动数值验证（tools/sim.js），也为"一键推荐配装"提供购买建议
(function (TD) {
  'use strict';

  const D = TD.data;
  const P = TD.progression;

  const Bot = (TD.bot = {});

  // 列出当前可以购买的铜币升级，并估算性价比
  Bot.copperOptions = function (save) {
    const opts = [];
    const st0 = P.heroStats(save);
    const dps0 = P.estimateDps(st0);
    const ehp0 = st0.wallMax / (1 - st0.wallDr);
    const add = (label, cost, mutate, weight) => {
      if (!cost || !cost.copper) return;
      const clone = TD.util.deepClone(save);
      mutate(clone);
      const st = P.heroStats(clone);
      const dGain = P.estimateDps(st) / dps0 - 1;
      const hGain = st.wallMax / (1 - st.wallDr) / ehp0 - 1;
      const gain = dGain + hGain * 0.55 * (weight || 1);
      opts.push({ label, cost, value: gain / cost.copper, apply: mutate });
    };
    // 机器人只买到各项的基础上限（设计书 76.2）：战役关卡的数值是按这个强度标定的
    for (const k of Object.keys(D.attributes)) {
      if (k === 'luck' || save.attrs[k] >= D.attributes[k].soft) continue;
      add('attr:' + k, P.attrCost(save, k), (s) => P.buyAttr(s, k) || s.attrs[k]++);
    }
    const wid = save.loadout.weapon;
    if (save.weapons[wid].lv < D.weaponUpgrade.max) add('weapon:' + wid, P.weaponUpgradeCost(save, wid), (s) => s.weapons[wid].lv++);
    if (save.wall.level < D.wallUpgrades.level.max) add('wall:level', P.wallCost(save, 'level'), (s) => s.wall.level++);
    if (save.wall.fortify < D.wallUpgrades.fortify.max) add('wall:fortify', P.wallCost(save, 'fortify'), (s) => s.wall.fortify++);
    // 带在身上的被动技能升到基础上限（10 级）：和属性、武器升级按性价比一起比较（设计书 90）
    for (const id of save.loadout.passive) {
      if (!id || !save.passiveOwned[id]) continue;
      if (P.passiveLevel(save, id) >= D.passiveSkills[id].eff.max) continue;
      add('passive:' + id, P.passiveCost(save, id), (s) => P.upgradePassive(s, id) || (s.passiveLv[id] = P.passiveLevel(s, id) + 1));
    }
    // 铜币箭袋（设计书 58）：和属性、武器升级按性价比一起比较
    for (const id of ['leatherQuiver', 'barbQuiver']) {
      if (save.equipOwned[id] || !P.equipAvailable(save, id) || P.slotCount(save, 'quiver') < 1) continue;
      add('equip:' + id, D.equipment[id].cost, (s) => {
        s.equipOwned[id] = true;
        const cur = s.loadout.equip.quiver;
        const keep = cur && P.estimateDps(P.heroStats(s)) > P.estimateDps(P.heroStats(Object.assign({}, s, { loadout: Object.assign({}, s.loadout, { equip: Object.assign({}, s.loadout.equip, { quiver: id }) }) })));
        if (!keep) s.loadout.equip.quiver = id;
      });
    }
    opts.sort((a, b) => b.value - a.value);
    return opts;
  };

  // 机器人花钱：先买银币物品，再按性价比花铜币
  Bot.shop = function (save, opts) {
    opts = opts || {};
    const bought = [];
    // 银币：技能优先；第一章打完后先攒钱买魔法杖
    const silverOrder = opts.silverOrder || ['arrowRain', 'precision', 'thunder', 'burn', 'repair', 'frost', 'combo', 'pierceArmor'];
    const saveForStaff = P.highestCleared(save) >= 10 && !save.weapons.staff.owned;
    for (const id of silverOrder) {
      if (saveForStaff && save.silver - 8 < 3) break;
      if (D.activeSkills[id] && !save.activeOwned[id] && P.canAfford(save, D.activeSkills[id].cost)) {
        P.buyActive(save, id);
        bought.push(id);
      } else if (D.passiveSkills[id] && !save.passiveOwned[id] && P.canAfford(save, D.passiveSkills[id].cost)) {
        P.buyPassive(save, id);
        bought.push(id);
      }
    }
    // 剩余银币：武器进阶、技能 Lv2；金币：技能 Lv3（传说头盔优先）
    if (!saveForStaff) {
      for (const id of ['staff', 'orb', 'bow', 'cannon', 'crossbow']) {
        if (P.canAscend(save, id) && P.canAfford(save, D.weaponAscend.cost)) {
          P.ascendWeapon(save, id);
          bought.push('ascend:' + id);
        }
      }
      for (const id of ['arrowRain', 'thunder', 'drum', 'repair', 'frost']) {
        if (P.skillLevel(save, id) === 1 && P.canAfford(save, D.skillUpgradeCost[2])) {
          P.upgradeSkill(save, id);
          bought.push('skill2:' + id);
        }
      }
    }
    // 第三章：攒金币买雷电法球
    if (P.highestCleared(save) >= 20 && !save.weapons.orb.owned && P.canAfford(save, D.weapons.orb.cost)) {
      P.buyWeapon(save, 'orb');
      bought.push('orb');
    }
    const saveForOrb = P.highestCleared(save) >= 20 && !save.weapons.orb.owned;
    if (save.equipOwned.lionCrown && !saveForOrb)
      for (const id of ['thunder', 'arrowRain', 'drum', 'repair', 'frost']) {
        if (P.skillLevel(save, id) === 2 && P.canAfford(save, D.skillUpgradeCost[3])) {
          P.upgradeSkill(save, id);
          bought.push('skill3:' + id);
        }
      }
    // 银币富余时：精良装备，再用汇兑所换金币升 Lv3 技能
    if (!saveForStaff && P.highestCleared(save) >= 12) {
      for (const id of ['starCape', 'eagleEye']) {
        if (!save.equipOwned[id] && save.silver >= D.equipment[id].cost.silver + 6) {
          P.buyEquip(save, id);
          bought.push(id);
        }
      }
      while (save.silver >= TD.config.exchange.silverPerGold + 20 && Object.keys(D.activeSkills).some((k) => P.skillLevel(save, k) === 2)) P.exchange(save, 'silver', 1);
    }
    // 武器：随进度解锁
    const h = P.highestCleared(save);
    const wantWeapon = (id, minCleared) => {
      if (h >= minCleared && !save.weapons[id].owned && P.canAfford(save, D.weapons[id].cost)) {
        P.buyWeapon(save, id);
        bought.push(id);
      }
    };
    wantWeapon('staff', 10);
    wantWeapon('cannon', 14);
    // 金币
    if (!save.equipOwned.lionCrown && P.canAfford(save, D.equipment.lionCrown.cost)) {
      P.buyEquip(save, 'lionCrown');
      P.setEquip(save, 'helm', 'lionCrown');
    }
    if (h >= 5 && !save.weapons.crossbow.owned && save.copper >= 600) {
      P.buyWeapon(save, 'crossbow');
      bought.push('crossbow');
    }
    if (h >= 7 && !save.weapons.boomerang.owned && save.copper >= 900) {
      P.buyWeapon(save, 'boomerang');
      bought.push('boomerang');
    }
    // 铜币装备（性价比高，优先）
    for (const id of ['ironHelm', 'redCape', 'fang']) {
      if (!save.equipOwned[id] && P.canAfford(save, D.equipment[id].cost) && save.copper - D.equipment[id].cost.copper >= 0) {
        P.buyEquip(save, id);
        bought.push(id);
      }
    }
    // 消耗品：每种带 1 个、最多 3 种，和 v0.74 之前"每关每种最多用一次"完全一样，战役标定不变（设计书 82）
    const nItem = Math.min(3, P.slotCount(save, 'item'));
    const wantItems = ['patch', 'bomb', 'haste'];
    for (let i = 0; i < nItem; i++) {
      const id = wantItems[i];
      if (P.itemEquipped(save, id) + P.itemStock(save, id) < 1 && P.canAfford(save, D.items[id].cost)) P.buyItem(save, id);
      if (P.itemEquipped(save, id) + P.itemStock(save, id) > 0) P.equipItem(save, i, id, 1);
    }
    if (opts.silverOnly) return bought;
    // 铜币升级
    let guard = 0;
    while (guard++ < 200) {
      const list = Bot.copperOptions(save);
      const best = list.find((o) => P.canAfford(save, o.cost));
      if (!best || !list.length) break;
      // 最优项买不起时，存钱而不是去买次优项（仅当差距不大）
      if (best !== list[0] && list[0].cost.copper <= save.copper * 1.6 && best.value < list[0].value * 0.6) break;
      const [kind, key] = best.label.split(':');
      if (kind === 'attr') P.buyAttr(save, key);
      else if (kind === 'weapon') P.upgradeWeapon(save, key);
      else if (kind === 'wall') P.buyWall(save, key);
      else if (kind === 'equip') P.buyEquip(save, key);
      bought.push(best.label);
    }
    // 自动装满技能槽
    const nA = P.slotCount(save, 'active');
    const pref = ['arrowRain', 'thunder', 'drum', 'repair', 'frost'];
    const ownedActive = pref.filter((id) => save.activeOwned[id]);
    for (let i = 0; i < nA; i++) save.loadout.active[i] = ownedActive[i] || null;
    const nP = P.slotCount(save, 'passive');
    const prefP = ['precision', 'burn', 'combo', 'pierceArmor'];
    const ownedP = prefP.filter((id) => save.passiveOwned[id]);
    for (let i = 0; i < nP; i++) save.loadout.passive[i] = ownedP[i] || null;
    return bought;
  };

  // 跑一局
  Bot.playLevel = function (save, n, opts) {
    opts = opts || {};
    if (!opts.keepLoadout) P.recommend(save, n, { itemQty: 1, itemSlots: 3 });
    if (opts.forceWeapon) save.loadout.weapon = opts.forceWeapon;
    const lo = P.battleLoadout(save);
    if (opts.noSkills) lo.active = [];
    lo.autoCast = !opts.noSkills;
    const battle = new TD.Battle({
      level: n,
      stats: P.heroStats(save),
      loadout: lo,
      seed: opts.seed || 1,
      autoItems: !opts.noItems,
      autoSupply: true,
      rally: opts.noRally ? 0 : P.rally(save, n),
      difficulty: (save.settings && save.settings.difficulty) || 'normal',
    });
    const res = battle.runToEnd();
    for (const id of res.itemsUsed) P.consumeItem(save, id);
    return { res, battle };
  };
})((globalThis.TD = globalThis.TD || {}));
