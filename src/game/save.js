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

  // 估算某把武器在某关的有效输出：考虑武器等级、怪物护甲 / 魔抗 / 灵体、飞行、范围伤害
  TD.progression.weaponScore = function (save, weaponId, n) {
    const P = TD.progression;
    const D = TD.data;
    const lvl = D.levels[n];
    const st = P.heroStats(save, { weapon: weaponId });
    const w = st.weaponDef;
    const counts = {};
    let total = 0;
    for (const wave of lvl.waves)
      for (const [type, c] of wave.groups) {
        const def = D.monsters[type];
        // Boss 按血量折算权重
        const weight = def.boss ? (def.boss === 'major' ? 25 : 10) : c;
        counts[type] = (counts[type] || 0) + weight;
        total += weight;
      }
    const dpsBase = P.estimateDps(st);
    const ig = Math.min(0.8, (w.armorIgnore || 0) + (st.passives.pierceArmor ? D.passiveSkills.pierceArmor.ignore : 0));
    let eff = 0;
    for (const type of Object.keys(counts)) {
      const def = D.monsters[type];
      let e;
      if (w.dmgType === 'magic') {
        const mr = def.mres || 0;
        e = 1 - mr / (mr + 100);
      } else {
        const ar = ((def.armor || 0) + (def.frontArmor || 0) * (w.boomerang ? 0.5 : 1)) * (1 - ig);
        e = (1 - ar / (ar + 100)) * (def.physResist ? 1 - def.physResist : 1);
      }
      if (def.flying && w.flyingMult) e *= w.flyingMult;
      // 闪避（风筝怪）只躲物理普通攻击（设计书 33.2）
      if (def.dodge && w.dmgType !== 'magic') e *= 1 - def.dodge;
      eff += (counts[type] / total) * e;
    }
    // 范围伤害对成群的小怪更有价值
    let aoe = 1;
    if (w.chain) aoe += w.chain.count * 0.3;
    if (w.splash) aoe += w.splash.mult * 0.9;
    if (w.bolts) aoe += w.bolts > 3 ? 0.55 : 0.35;
    if (w.boomerang) aoe += 0.25;
    if (w.pierce) aoe += w.pierce.count * w.pierce.mult * 0.2;
    if (w.slow || w.ignite) aoe += 0.08;
    if (lvl.type === 'union') aoe = 1 + (aoe - 1) * 1.4;
    return dpsBase * eff * aoe;
  };

  // 特长装备在第 n 关大约值多少输出（比例）：用于自动配装（设计书 58.5）
  TD.progression.gearLevelValue = function (id, n, st) {
    const D = TD.data;
    const e = D.equipment[id];
    const lvl = D.levels[n];
    if (!lvl || (!e.mods && !e.zap)) return 0;
    const m = e.mods || {};
    let total = 0;
    const w = { boss: 0, fly: 0, spirit: 0, armored: 0 };
    for (const wave of lvl.waves)
      for (const [type, c] of wave.groups) {
        const def = D.monsters[type];
        const weight = def.boss ? (def.boss === 'major' ? 25 : 10) : c;
        total += weight;
        if (def.boss || def.bossPart) w.boss += weight;
        if (def.flying) w.fly += weight;
        if (def.physResist) w.spirit += weight;
        if ((def.armor || 0) + (def.frontArmor || 0) >= 30) w.armored += weight;
      }
    const share = (k) => (total ? w[k] / total : 0);
    const magic = st && st.weaponDef && st.weaponDef.dmgType === 'magic';
    let v = 0;
    v += (m.bossDmg || 0) * share('boss');
    v += (m.flyDmg || 0) * share('fly');
    if (!magic) v += (m.spiritPierce || 0) * 2.5 * share('spirit');
    if (!magic) v += (m.armorIgnore || 0) * 1.2 * share('armored');
    if (m.darkSight && lvl.dark) v += 0.25;
    v += (m.slowOnHit || 0) * 0.35 + (m.igniteChance || 0) * 0.3 + (m.lowWallAtk || 0) * 0.25;
    v += -(m.cdMult || 0) * 0.5 + (m.frostExt || 0) * 0.1;
    v += (m.mendBonus || 0) * 2 + (m.healBonus || 0) * 0.15;
    if (e.zap) v += (e.zap.atkMult / e.zap.every) * 0.7;
    return v;
  };

  // 关卡的怪物构成（设计书 75.3）：旧怪物按名字，"回声"怪物（echo）按它们自己的属性，推荐武器 / 技能共用
  TD.progression.levelTraits = function (counts, total) {
    const D = TD.data;
    const share = (t) => (counts[t] || 0) / total;
    // 回声怪物里满足条件的占比
    const echo = (pred) => {
      let c = 0;
      for (const t of Object.keys(counts)) {
        const d = D.monsters[t];
        if (d && d.echo && !d.boss && pred(d)) c += counts[t];
      }
      return c / total;
    };
    const has = (...ids) => ids.some((id) => counts[id]);
    return {
      magicProof: share('lavaGolem') * 2 + (has('rockGolem', 'chaosGolem') ? 0.3 : 0) + echo((d) => d.mres >= 250) * 2,
      armored: share('mummy') + share('yeti') * 2 + (has('pharaoh', 'chaosPharaoh') ? 0.3 : 0) + echo((d) => d.armor >= 100) * 2,
      spirit: share('ghost') + (has('boneMage', 'chaosBoneMage') ? 0.3 : 0) + echo((d) => d.physResist >= 0.7),
      flying: share('bee') + share('vulture') + share('bat') + share('iceSprite') + echo((d) => d.flying),
      dodgy: share('kite') + echo((d) => d.dodge >= 0.3),
      goblin: share('goblin') + echo((d) => d.frontArmor > 0),
      hermit: share('hermitCrab') + echo((d) => !!d.shell),
      supports: echo((d) => !!d.healer || !!d.guard || !!d.ranged),
    };
  };

  // 本关的理想武器（不考虑是否拥有）：用于关卡预览的"推荐武器"提示
  TD.progression.idealWeapon = function (n) {
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
    const { magicProof, armored, spirit, flying, dodgy, goblin, hermit } = TD.progression.levelTraits(counts, total);
    if (counts.octoKing) return { id: 'crossbow', reason: '3 支箭能同时打好几条触手；练满的木弓、火炮也很适合打波波' };
    if (magicProof > 0.25) return { id: 'cannon', reason: '熔岩怪物不怕魔法，用物理重炮' };
    if (dodgy > 0.3) return { id: 'orb', reason: '风筝怪躲不开闪电，跳跃还能连着打好几只' };
    if (hermit > 0.25) return { id: 'orb', reason: '闪电在好几只寄居蟹之间跳，不容易把一只打得缩壳' };
    if (spirit > 0.2) return { id: 'staff', reason: '小幽灵几乎不怕物理攻击' };
    if (armored > 0.25) return { id: 'staff', reason: '魔法伤害无视物理护甲' };
    if (flying > 0.35) return { id: 'crossbow', reason: '一次射 3 支，对飞行怪伤害 +50%' };
    if (goblin > 0.15) return { id: 'boomerang', reason: '返程从背后命中，无视木盾' };
    return null;
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
    const { magicProof, armored, spirit, flying, dodgy, goblin, hermit } = P.levelTraits(counts, total);
    const magicPick = owned('orb') ? 'orb' : owned('staff') ? 'staff' : null;
    if (magicProof > 0.25) {
      // 魔抗关：按有效输出在已拥有的武器里挑（物理武器等级太低时，魔法武器可能仍然更好）
      let best = -1;
      for (const id of Object.keys(D.weapons)) {
        if (!owned(id)) continue;
        const sc = P.weaponScore(save, id, n);
        if (sc > best) {
          best = sc;
          weapon = id;
        }
      }
    } else if ((spirit > 0.2 || dodgy > 0.3 || lvl.type === 'union') && magicPick) weapon = magicPick;
    // 寄居蟹多的关：分散火力（设计书 52.2）
    else if (hermit > 0.25 && (magicPick === 'orb' || owned('crossbow'))) weapon = magicPick === 'orb' ? 'orb' : 'crossbow';
    else if (armored > 0.25 && owned('staff')) weapon = 'staff';
    else if (armored > 0.25 && owned('cannon')) weapon = 'cannon';
    else if (flying > 0.35 && owned('crossbow')) weapon = 'crossbow';
    else if (goblin > 0.15 && owned('boomerang')) weapon = 'boomerang';
    else if (lvl.type === 'rush' && owned('crossbow')) weapon = 'crossbow';
    else if (n > 20 && magicPick) weapon = magicPick;
    else if (n > 10 && owned('staff')) weapon = 'staff';
    // 克制武器等级太低（有效输出不到最强武器的 75%）时，不硬切，继续用最强的（设计书 27.2）
    // 联合关、灵体关的法球 / 法杖例外：估分低估了法球的弹幕（模拟：第 39 关改用估分最高武器后 12 次全负）
    if (magicProof <= 0.25 && lvl.type !== 'union' && !((spirit > 0.2 || dodgy > 0.3) && magicPick)) {
      let bestId = weapon;
      let bestScore = -1;
      for (const id of Object.keys(D.weapons)) {
        if (!owned(id)) continue;
        const sc = P.weaponScore(save, id, n);
        if (sc > bestScore) {
          bestScore = sc;
          bestId = id;
        }
      }
      // 只在克制武器明显没练（比最强武器低 3 级以上）时才换：强机器人各武器都练过，换了反而更差
      const lvGap = (save.weapons[bestId].lv || 0) - (save.weapons[weapon].lv || 0);
      // 雷电法球例外：估分低估了闪电跳跃（模拟：第 32 关法球比练满的法杖低 7 级，仍然一次过；换成法杖要 2–5 次）
      if (lvGap >= 3 && weapon !== 'orb' && P.weaponScore(save, weapon, n) < bestScore * 0.75) weapon = bestId;
    }
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
    if (magicProof > 0.25 && D.weapons[weapon].dmgType !== 'magic') prefP = ['precision', 'combo', 'pierceArmor', 'burn'];
    if (goblin > 0.15 || (armored > 0.25 && weapon !== 'staff')) prefP = ['pierceArmor', 'precision', 'burn', 'combo'];
    else if (armored > 0.25 || spirit > 0.2) prefP = ['burn', 'precision', 'combo', 'pierceArmor'];
    const nP = P.slotCount(save, 'passive');
    const pas = prefP.filter((id) => save.passiveOwned[id]).slice(0, nP);
    for (let i = 0; i < 3; i++) lo.passive[i] = pas[i] || null;

    // 消耗品
    const nI = P.slotCount(save, 'item');
    const prefI = ['charm', 'patch', 'bomb', 'haste', 'freeze'];
    const items = [];
    for (const id of prefI) if ((save.inventory[id] || 0) > 0 && items.length < nI) items.push(id);
    for (let i = 0; i < 3; i++) lo.items[i] = items[i] || null;

    // 装备：每个栏位挑战力提升最大的；特长装备按本关怪物构成折算（设计书 58.5）
    const slots = { helm: ['helm'], cape: ['cape'], trinket: ['trinket1', 'trinket2', 'trinket3'] };
    if (P.slotCount(save, 'quiver') > 0) slots.quiver = ['quiver'];
    for (const kind of Object.keys(slots)) {
      const cands = Object.keys(D.equipment).filter((id) => save.equipOwned[id] && D.equipment[id].slot === kind);
      const scored = cands
        .map((id) => {
          const clone = TD.util.deepClone(save);
          for (const k of slots[kind]) clone.loadout.equip[k] = null;
          clone.loadout.equip[slots[kind][0]] = id;
          const st = P.heroStats(clone);
          return { id, score: P.estimateDps(st) * (1 + P.gearLevelValue(id, n, st)) + (D.equipment[id].stats.wallDr || 0) * 50 + (D.equipment[id].stats.luck || 0) * 5 };
        })
        .sort((a, b) => b.score - a.score);
      slots[kind].forEach((k, i) => (lo.equip[k] = scored[i] ? scored[i].id : null));
    }

    // 有治疗、光环、远程等辅助型怪物时用"威胁优先"（模拟验证：第 22 关城墙剩余 76% → 95%）
    // 只有毒蛙这种远程持续伤害的怪，"威胁优先"才明显更好（设计书 22.7）
    // 第七章：海马、盾龟也算辅助型；波波的触手算远程（设计书 52.3）
    const supports = share('frog') + share('imp') + share('rainbowBird') + share('seahorse') + share('turtle') + P.levelTraits(counts, total).supports;
    lo.target = lvl.type === 'raid' ? 'flying' : supports > 0.03 ? 'smart' : 'nearest';
    if (lo.target !== 'nearest') notes.push('目标：' + D.targetModes[lo.target]);
    return notes;
  };
})((globalThis.TD = globalThis.TD || {}));
