// 浏览器本地存档（设计书 13.3）：JSON + 版本号
(function (TD) {
  'use strict';

  const KEY = 'shouchengyingxiong.save.v1';

  TD.saveStore = {
    load() {
      try {
        const raw = globalThis.localStorage && localStorage.getItem(KEY);
        if (!raw) return null;
        return TD.progression.migrate(JSON.parse(raw));
      } catch (e) {
        console.warn('读取存档失败', e);
        return null;
      }
    },
    write(save) {
      try {
        if (globalThis.localStorage) localStorage.setItem(KEY, JSON.stringify(save));
        return true;
      } catch (e) {
        console.warn('写入存档失败', e);
        return false;
      }
    },
    // 导出为一段文字：前缀 + base64(UTF-8 JSON)
    exportCode(save) {
      const json = JSON.stringify(save);
      const b64 = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json, 'utf8').toString('base64');
      return 'SCYX1:' + b64;
    },
    importCode(code) {
      try {
        code = String(code || '').trim();
        if (!code.startsWith('SCYX1:')) return null;
        const b64 = code.slice(6).replace(/\s+/g, '');
        const json = typeof atob === 'function' ? decodeURIComponent(escape(atob(b64))) : Buffer.from(b64, 'base64').toString('utf8');
        const save = JSON.parse(json);
        if (!save || typeof save !== 'object' || !save.levels || !save.loadout) return null;
        return TD.progression.migrate(save);
      } catch (e) {
        return null;
      }
    },
    clear() {
      try {
        if (globalThis.localStorage) localStorage.removeItem(KEY);
      } catch (e) {
        /* 忽略 */
      }
    },
  };

  // 一键推荐配装（设计书 6.4）：根据关卡里的怪物构成推荐武器、技能、道具
  TD.progression.recommend = function (save, n) {
    const P = TD.progression;
    const D = TD.data;
    const lvl = D.levels[n];
    const counts = {};
    let total = 0;
    for (const w of lvl.waves)
      for (const [type, c] of w.groups) {
        counts[type] = (counts[type] || 0) + c;
        total += c;
      }
    const share = (t) => (counts[t] || 0) / total;
    const owned = (id) => save.weapons[id] && save.weapons[id].owned;
    const lo = save.loadout;
    const notes = [];

    // 武器
    let weapon = 'bow';
    const armored = share('mummy') + share('yeti') * 2 + (counts.pharaoh ? 0.3 : 0);
    const flying = share('bee') + share('vulture') + share('bat') + share('iceSprite');
    const spirit = share('ghost') + (counts.boneMage ? 0.3 : 0);
    const magicPick = owned('orb') ? 'orb' : owned('staff') ? 'staff' : null;
    if ((spirit > 0.2 || lvl.type === 'union') && magicPick) weapon = magicPick;
    else if (armored > 0.25 && owned('staff')) weapon = 'staff';
    else if (armored > 0.25 && owned('cannon')) weapon = 'cannon';
    else if (flying > 0.35 && owned('crossbow')) weapon = 'crossbow';
    else if (share('goblin') > 0.15 && owned('boomerang')) weapon = 'boomerang';
    else if (lvl.type === 'rush' && owned('crossbow')) weapon = 'crossbow';
    else if (n > 20 && magicPick) weapon = magicPick;
    else if (n > 10 && owned('staff')) weapon = 'staff';
    lo.weapon = weapon;
    notes.push(`武器：${D.weapons[weapon].name}`);

    // 主动技能
    let pref;
    if (counts.witch) pref = ['repair', 'arrowRain', 'thunder', 'drum', 'frost'];
    else if (lvl.type === 'boss' || lvl.type === 'miniboss') pref = ['thunder', 'arrowRain', 'drum', 'repair', 'frost'];
    else if (lvl.type === 'raid') pref = ['arrowRain', 'drum', 'frost', 'thunder', 'repair'];
    else if (lvl.type === 'rush') pref = ['frost', 'arrowRain', 'drum', 'repair', 'thunder'];
    else pref = ['arrowRain', 'drum', 'thunder', 'frost', 'repair'];
    const nA = P.slotCount(save, 'active');
    const act = pref.filter((id) => save.activeOwned[id]).slice(0, nA);
    for (let i = 0; i < 3; i++) lo.active[i] = act[i] || null;

    // 被动技能
    let prefP = ['precision', 'burn', 'combo', 'pierceArmor'];
    if (share('goblin') > 0.15 || (armored > 0.25 && weapon !== 'staff')) prefP = ['pierceArmor', 'precision', 'burn', 'combo'];
    else if (armored > 0.25 || spirit > 0.2) prefP = ['burn', 'precision', 'combo', 'pierceArmor'];
    const nP = P.slotCount(save, 'passive');
    const pas = prefP.filter((id) => save.passiveOwned[id]).slice(0, nP);
    for (let i = 0; i < 3; i++) lo.passive[i] = pas[i] || null;

    // 消耗品
    const nI = P.slotCount(save, 'item');
    const prefI = ['charm', 'patch', 'bomb', 'haste', 'freeze'];
    const items = [];
    const left = Object.assign({}, save.inventory);
    for (const id of prefI) {
      while ((left[id] || 0) > 0 && items.length < nI) {
        items.push(id);
        left[id]--;
        if (id === 'charm') break;
      }
    }
    for (let i = 0; i < 3; i++) lo.items[i] = items[i] || null;

    // 装备：每个栏位挑战力提升最大的
    const slots = { helm: ['helm'], cape: ['cape'], trinket: ['trinket1', 'trinket2'] };
    for (const kind of Object.keys(slots)) {
      const cands = Object.keys(D.equipment).filter((id) => save.equipOwned[id] && D.equipment[id].slot === kind);
      const scored = cands
        .map((id) => {
          const clone = TD.util.deepClone(save);
          for (const k of slots[kind]) clone.loadout.equip[k] = null;
          clone.loadout.equip[slots[kind][0]] = id;
          return { id, score: P.estimateDps(P.heroStats(clone)) + (D.equipment[id].stats.wallDr || 0) * 50 + (D.equipment[id].stats.luck || 0) * 5 };
        })
        .sort((a, b) => b.score - a.score);
      slots[kind].forEach((k, i) => (lo.equip[k] = scored[i] ? scored[i].id : null));
    }

    // 有治疗、光环、远程等辅助型怪物时用"威胁优先"（模拟验证：第 22 关城墙剩余 76% → 95%）
    // 只有毒蛙这种远程持续伤害的怪，"威胁优先"才明显更好（设计书 22.7）
    const supports = share('frog');
    lo.target = lvl.type === 'raid' ? 'flying' : supports > 0.03 ? 'smart' : 'nearest';
    if (lo.target !== 'nearest') notes.push('目标：' + D.targetModes[lo.target]);
    return notes;
  };
})((globalThis.TD = globalThis.TD || {}));
