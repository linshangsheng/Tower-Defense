// 界面层（DOM）：标题、关卡地图、关卡预览、商店与配装、战斗 HUD、结算（设计书 6、12 章）
(function (TD) {
  'use strict';

  const D = TD.data;
  const P = TD.progression;
  const C = TD.config;

  // 小型 DOM 构造器
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const k of Object.keys(props)) {
        const v = props[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (k === 'html') el.innerHTML = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
    }
    return el;
  }

  const UI = (TD.ui = { h });

  let game;
  let root;
  let screenEl;
  let modalEl;

  UI.init = function (g) {
    game = g;
    root = document.getElementById('ui');
  };

  function sfx(name) {
    if (TD.audio) TD.audio.play(name);
  }

  function clear() {
    root.innerHTML = '';
    screenEl = null;
    modalEl = null;
  }

  UI.closeModal = function () {
    if (modalEl) {
      modalEl.remove();
      modalEl = null;
    }
  };

  function modal(content, opts) {
    UI.closeModal();
    opts = opts || {};
    modalEl = h('div', { class: 'modal-back' + (opts.dim === false ? ' clear' : '') }, h('div', { class: 'modal ' + (opts.cls || '') }, content));
    if (opts.closeOnBack)
      modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) UI.closeModal();
      });
    root.appendChild(modalEl);
    return modalEl;
  }

  UI.toast = function (msg, kind, ms) {
    ms = ms || (kind === 'tip' ? 5000 : 1800);
    const el = h('div', { class: 'toast ' + (kind || '') }, msg);
    root.appendChild(el);
    setTimeout(() => el.classList.add('out'), ms);
    setTimeout(() => el.remove(), ms + 500);
  };

  function coinIcon(kind) {
    return h('span', { class: 'coin ' + kind });
  }

  function costEl(cost) {
    if (!cost) return h('span', { class: 'cost' }, '免费');
    const parts = [];
    for (const k of ['copper', 'silver', 'gold']) if (cost[k]) parts.push(h('span', { class: 'cost-part' }, coinIcon(k), cost[k]));
    return h('span', { class: 'cost' }, parts);
  }

  function currencyBar() {
    const s = game.save;
    return h(
      'div',
      { class: 'currency' },
      h('span', { title: '铜币' }, coinIcon('copper'), s.copper),
      h('span', { title: '银币' }, coinIcon('silver'), s.silver),
      h('span', { title: '金币' }, coinIcon('gold'), s.gold)
    );
  }

  function starsEl(n, max) {
    max = max || 3;
    const out = [];
    for (let i = 0; i < max; i++) out.push(h('span', { class: 'star' + (i < n ? ' on' : '') }, '★'));
    return h('span', { class: 'stars' }, out);
  }

  // ================= 标题 =================
  UI.showTitle = function () {
    clear();
    game.renderer.mood = 'idle';
    const has = P.highestCleared(game.save) > 0 || game.save.copper > 0;
    screenEl = h(
      'div',
      { class: 'screen title-screen' },
      h('div', { class: 'title-logo' }, h('div', { class: 'title-main' }, '守城英雄'), h('div', { class: 'title-sub' }, '小卫兵铛铛的守城日记')),
      h(
        'div',
        { class: 'title-buttons' },
        h('button', { class: 'btn big primary', onclick: () => (sfx('click'), UI.showMap()) }, has ? '继续游戏' : '开始游戏'),
        h('button', { class: 'btn', onclick: () => (sfx('click'), UI.showSettings()) }, '设置'),
        h('button', { class: 'btn', onclick: () => (sfx('click'), UI.showHelp()) }, '玩法说明')
      ),
      h('div', { class: 'title-foot' }, '网页原型 v0.1 · 第一章 翠绿草原')
    );
    root.appendChild(screenEl);
  };

  UI.showSettings = function () {
    const s = game.save.settings;
    const body = h(
      'div',
      { class: 'settings' },
      h('h2', null, '设置'),
      h(
        'label',
        { class: 'row' },
        h('input', {
          type: 'checkbox',
          checked: s.sound ? true : null,
          onchange: (e) => {
            s.sound = e.target.checked;
            TD.audio.enabled = s.sound;
            game.persist();
          },
        }),
        ' 音效'
      ),
      h(
        'div',
        { class: 'row' },
        h(
          'button',
          {
            class: 'btn danger small',
            onclick: () =>
              UI.confirm('确定要清空存档、从头开始吗？这一步无法撤销。', () => {
                game.resetSave();
                UI.toast('存档已清空');
                UI.showTitle();
              }),
          },
          '清空存档'
        )
      ),
      h('div', { class: 'modal-buttons' }, h('button', { class: 'btn', onclick: UI.closeModal }, '关闭'))
    );
    modal(body, { closeOnBack: true });
  };

  UI.showHelp = function () {
    const body = h(
      'div',
      { class: 'help' },
      h('h2', null, '玩法说明'),
      h(
        'ul',
        null,
        h('li', null, '铛铛站在城墙上自动射击，怪物从右边沿车道走来。城墙血量归零就失败。'),
        h('li', null, '战斗中点击技能按钮（或按 1 / 2 / 3）释放主动技能，按 Q / W / E 使用道具。'),
        h('li', null, '冰冻领域、小炸弹、冰冻瓶需要选择车道：点技能后再点一条车道。'),
        h('li', null, '一波怪全部出场后，可以点「提前召唤」立刻叫出下一波，剩余的倒计时秒数会变成铜币奖励。'),
        h('li', null, '空格暂停，F 切换 2 倍速，N 提前召唤，T 切换目标优先级。'),
        h('li', null, '每关结束会获得铜币，首次通关还有银币。去商店升级属性、解锁武器和技能，再来挑战！'),
        h('li', null, '城墙剩余 ≥50% 得 2 星，≥80% 得 3 星。')
      ),
      h('div', { class: 'modal-buttons' }, h('button', { class: 'btn primary', onclick: UI.closeModal }, '知道了'))
    );
    modal(body, { closeOnBack: true, cls: 'wide' });
  };

  UI.confirm = function (text, onYes) {
    modal(
      h(
        'div',
        null,
        h('p', { class: 'confirm-text' }, text),
        h(
          'div',
          { class: 'modal-buttons' },
          h('button', { class: 'btn', onclick: UI.closeModal }, '取消'),
          h(
            'button',
            {
              class: 'btn danger',
              onclick: () => {
                UI.closeModal();
                onYes();
              },
            },
            '确定'
          )
        )
      )
    );
  };

  // ================= 关卡地图 =================
  // 节点坐标（逻辑分辨率 1280×720 内）
  const NODE_POS = [
    [170, 560],
    [300, 470],
    [440, 540],
    [570, 430],
    [700, 330],
    [840, 420],
    [960, 520],
    [1080, 420],
    [1010, 290],
    [1120, 175],
  ];

  UI.showMap = function () {
    clear();
    game.renderer.mood = 'idle';
    const s = game.save;
    const ch = D.chapters[0];
    const nodes = ch.levels.map((n, i) => {
      const lvl = D.levels[n];
      const rec = P.levelRecord(s, n);
      const unlocked = P.isUnlocked(s, n);
      const cls = ['map-node', lvl.type, unlocked ? '' : 'locked', rec.clears ? 'cleared' : '', unlocked && !rec.clears ? 'current' : ''].join(' ');
      return h(
        'button',
        {
          class: cls,
          style: { left: NODE_POS[i][0] + 'px', top: NODE_POS[i][1] + 'px' },
          onclick: () => {
            if (!unlocked) {
              sfx('error');
              UI.toast(`先通关第 ${n - 1} 关`);
              return;
            }
            sfx('click');
            UI.showPreview(n);
          },
        },
        h('span', { class: 'node-num' }, lvl.type === 'boss' ? '👑' : lvl.type === 'miniboss' ? '♛' : n),
        rec.clears ? starsEl(rec.stars) : null,
        h('span', { class: 'node-name' }, `${n}. ${lvl.name}`)
      );
    });
    // 路径
    const path = h('canvas', { class: 'map-path', width: C.width, height: C.height });
    const pctx = path.getContext('2d');
    pctx.strokeStyle = 'rgba(255,248,220,0.9)';
    pctx.lineWidth = 14;
    pctx.setLineDash([2, 22]);
    pctx.lineCap = 'round';
    pctx.beginPath();
    NODE_POS.forEach(([x, y], i) => (i ? pctx.lineTo(x, y) : pctx.moveTo(x, y)));
    pctx.stroke();

    const totalStars = ch.levels.reduce((a, n) => a + P.levelRecord(s, n).stars, 0);
    screenEl = h(
      'div',
      { class: 'screen map-screen' },
      path,
      h(
        'div',
        { class: 'topbar' },
        h('button', { class: 'btn small', onclick: () => (sfx('click'), UI.showTitle()) }, '‹ 标题'),
        h('div', { class: 'chapter-title' }, `第一章 · ${ch.name}`, h('span', { class: 'chapter-stars' }, ` ★ ${totalStars}/30`)),
        h('div', { class: 'power' }, '战力 ', h('b', null, P.power(s))),
        currencyBar(),
        h('button', { class: 'btn small primary', onclick: () => (sfx('click'), UI.showShop(null, 'loadout')) }, '商店 / 配装')
      ),
      nodes,
      P.highestCleared(s) >= 10
        ? h('div', { class: 'map-note' }, '恭喜通关第一章！第二章「黄金沙漠」正在建设中……可以回头挑战三星，或者收集金币购买传说装备。')
        : null
    );
    root.appendChild(screenEl);
  };

  // ================= 关卡预览 =================
  function levelMonsters(n) {
    const lvl = D.levels[n];
    const seen = [];
    for (const w of lvl.waves) for (const [type] of w.groups) if (!seen.includes(type)) seen.push(type);
    if (seen.includes('jellyPrince')) seen.push('minijelly');
    if (seen.includes('boarKing') && !seen.includes('gobling')) seen.push('gobling');
    return seen;
  }

  UI.showPreview = function (n) {
    const s = game.save;
    const lvl = D.levels[n];
    const rec = P.levelRecord(s, n);
    const power = P.power(s);
    const rp = P.recommendedPower(n);
    const mons = levelMonsters(n).map((type) => {
      const def = D.monsters[type];
      const img = TD.sprites.portrait(type, 64);
      img.className = 'portrait';
      return h('div', { class: 'mon-card' + (def.boss ? ' boss' : ''), title: def.desc }, img, h('div', { class: 'mon-name' }, def.name), h('div', { class: 'mon-desc' }, def.desc));
    });
    const body = h(
      'div',
      { class: 'preview' },
      h(
        'div',
        { class: 'preview-head' },
        h('h2', null, `第 ${n} 关 · ${lvl.name}`),
        h('span', { class: 'tag ' + lvl.type }, D.levelTypeNames[lvl.type]),
        rec.clears ? starsEl(rec.stars) : null
      ),
      h(
        'div',
        { class: 'preview-info' },
        h('span', null, `车道 ${lvl.lanes} 条`),
        h('span', null, lvl.type === 'boss' ? `${lvl.waves.length} 波（含 Boss）` : `${lvl.waves.length} 波`),
        h('span', { class: power >= rp ? 'ok' : 'warn' }, `推荐战力 ${rp} · 你的战力 ${power}`)
      ),
      h('div', { class: 'mon-list' }, mons),
      h('div', { class: 'tip' }, '💡 ', lvl.tip),
      h(
        'div',
        { class: 'modal-buttons' },
        h('button', { class: 'btn', onclick: UI.closeModal }, '返回'),
        h('button', { class: 'btn', onclick: () => (sfx('click'), UI.showShop(n, 'loadout')) }, '商店 / 配装'),
        h('button', { class: 'btn primary big', onclick: () => (sfx('click'), game.startBattle(n)) }, '开始战斗')
      )
    );
    modal(body, { closeOnBack: true, cls: 'wide' });
  };

  // ================= 商店 / 配装 =================
  const TABS = [
    ['loadout', '配装'],
    ['attrs', '属性'],
    ['weapons', '武器'],
    ['skills', '技能'],
    ['equip', '装备'],
    ['wall', '城墙'],
    ['items', '道具'],
    ['exchange', '汇兑所'],
  ];

  UI.showShop = function (levelNo, tab) {
    clear();
    const state = { levelNo, tab: tab || 'loadout' };
    UI.shopState = state;
    screenEl = h('div', { class: 'screen shop-screen' });
    root.appendChild(screenEl);
    renderShop();
  };

  function renderShop() {
    const st = UI.shopState;
    const s = game.save;
    screenEl.innerHTML = '';
    const tabs = TABS.map(([id, name]) =>
      h(
        'button',
        {
          class: 'tab' + (st.tab === id ? ' on' : ''),
          onclick: () => {
            sfx('click');
            st.tab = id;
            renderShop();
          },
        },
        name
      )
    );
    const content = h('div', { class: 'shop-content' });
    ({
      loadout: shopLoadout,
      attrs: shopAttrs,
      weapons: shopWeapons,
      skills: shopSkills,
      equip: shopEquip,
      wall: shopWall,
      items: shopItems,
      exchange: shopExchange,
    })[st.tab](content);

    const stats = P.heroStats(s);
    screenEl.append(
      h(
        'div',
        { class: 'topbar' },
        h('button', { class: 'btn small', onclick: () => (sfx('click'), UI.showMap(), st.levelNo && UI.showPreview(st.levelNo)) }, '‹ 返回'),
        h('div', { class: 'chapter-title' }, st.levelNo ? `战前准备 · 第 ${st.levelNo} 关` : '商店'),
        h('div', { class: 'power' }, '战力 ', h('b', null, P.power(s))),
        currencyBar(),
        st.levelNo ? h('button', { class: 'btn small primary', onclick: () => (sfx('click'), game.startBattle(st.levelNo)) }, '开始战斗 ›') : null
      ),
      h('div', { class: 'shop-body' }, h('div', { class: 'tabs' }, tabs), content, statPanel(stats))
    );
  }
  UI.refreshShop = () => UI.shopState && screenEl && screenEl.classList.contains('shop-screen') && renderShop();

  function statPanel(st) {
    const rows = [
      ['攻击力', st.atk.toFixed(1)],
      ['武器伤害', Math.round(st.weaponMult * 100) + '%'],
      ['攻击速度', st.aspd.toFixed(2) + '/秒'],
      ['暴击率', Math.round(st.crit * 100) + '%'],
      ['暴击伤害', Math.round(st.critDmg * 100) + '%'],
      ['射程', Math.round((st.range / C.fieldWidth) * 100) + '%'],
      ['幸运', '+' + Math.round(st.luck * 100) + '%'],
      ['城墙血量', st.wallMax],
      ['城墙减伤', Math.round(st.wallDr * 100) + '%'],
      ['单体 DPS', P.estimateDps(st).toFixed(1)],
    ];
    return h(
      'div',
      { class: 'stat-panel' },
      h('h3', null, '铛铛的属性'),
      rows.map(([k, v]) => h('div', { class: 'stat-row' }, h('span', null, k), h('b', null, v)))
    );
  }

  function buyBtn(cost, onBuy, label) {
    const s = game.save;
    if (!cost) return h('button', { class: 'btn small', disabled: true }, label || '已满级');
    const can = P.canAfford(s, cost);
    return h(
      'button',
      {
        class: 'btn small buy' + (can ? ' primary' : ''),
        disabled: can ? null : true,
        onclick: () => {
          if (onBuy()) {
            sfx('buy');
            game.persist();
            renderShop();
          } else sfx('error');
        },
      },
      label || '购买',
      ' ',
      costEl(cost)
    );
  }

  function card(title, sub, desc, right, extra) {
    return h('div', { class: 'card ' + ((extra && extra.cls) || '') }, h('div', { class: 'card-main' }, h('div', { class: 'card-title' }, title, sub ? h('span', { class: 'card-sub' }, sub) : null), h('div', { class: 'card-desc' }, desc)), h('div', { class: 'card-right' }, right));
  }

  function shopAttrs(el) {
    const s = game.save;
    const st = P.heroStats(s);
    el.append(h('div', { class: 'section-title' }, '属性升级（永久）'));
    for (const key of Object.keys(D.attributes)) {
      const a = D.attributes[key];
      const lv = s.attrs[key];
      const cur = { atk: st.atk, aspd: st.aspdBase, crit: st.crit, critDmg: st.critDmg, luck: st.luck }[key];
      const next = cur + a.per * (key === 'atk' ? 1 + P.equipStats(s).atkPct : 1);
      el.append(
        card(
          a.name,
          `Lv.${lv}/${a.max}`,
          lv < a.max ? h('span', null, `${a.fmt(cur)} → `, h('b', { class: 'up' }, a.fmt(next))) : a.fmt(cur),
          buyBtn(P.attrCost(s, key), () => P.buyAttr(s, key), '升级')
        )
      );
    }
  }

  function shopWeapons(el) {
    const s = game.save;
    el.append(h('div', { class: 'section-title' }, '武器（永久解锁，每级伤害 +8%）'));
    for (const id of Object.keys(D.weapons)) {
      const w = D.weapons[id];
      const ws = s.weapons[id];
      let right;
      if (!ws.owned) right = buyBtn(w.cost, () => P.buyWeapon(s, id), '解锁');
      else
        right = h(
          'div',
          { class: 'btn-col' },
          buyBtn(P.weaponUpgradeCost(s, id), () => P.upgradeWeapon(s, id), '升级'),
          s.loadout.weapon === id
            ? h('span', { class: 'equipped' }, '使用中')
            : h(
                'button',
                {
                  class: 'btn small',
                  onclick: () => {
                    P.setWeapon(s, id);
                    sfx('click');
                    game.persist();
                    renderShop();
                  },
                },
                '装备'
              )
        );
      el.append(card(h('span', { class: 'with-icon' }, TD.sprites.iconCanvas(id, 30), w.name), ws.owned ? `Lv.${ws.lv}/${D.weaponUpgrade.max}` : '未解锁', h('span', null, w.desc, h('span', { class: 'good' }, ' 擅长：' + w.good)), right));
    }
  }

  function shopSkills(el) {
    const s = game.save;
    el.append(h('div', { class: 'section-title' }, '主动技能（战斗中点击释放）'));
    for (const id of Object.keys(D.activeSkills)) {
      const k = D.activeSkills[id];
      el.append(card(h('span', { class: 'with-icon' }, TD.sprites.iconCanvas(id, 30), k.name), `冷却 ${k.cd} 秒`, k.desc, s.activeOwned[id] ? h('span', { class: 'equipped' }, '已拥有') : buyBtn(k.cost, () => P.buyActive(s, id), '解锁')));
    }
    el.append(h('div', { class: 'section-title' }, '被动技能（自动生效）'));
    for (const id of Object.keys(D.passiveSkills)) {
      const k = D.passiveSkills[id];
      el.append(card(k.name, null, k.desc, s.passiveOwned[id] ? h('span', { class: 'equipped' }, '已拥有') : buyBtn(k.cost, () => P.buyPassive(s, id), '解锁')));
    }
    el.append(h('div', { class: 'hint' }, '买到的技能要在「配装」页放进技能槽才会带进战斗。'));
  }

  function shopEquip(el) {
    const s = game.save;
    const slotNames = { helm: '头盔', cape: '披风', trinket: '饰品' };
    for (const slot of ['helm', 'cape', 'trinket']) {
      el.append(h('div', { class: 'section-title' }, slotNames[slot]));
      for (const id of Object.keys(D.equipment)) {
        const e = D.equipment[id];
        if (e.slot !== slot) continue;
        el.append(
          card(
            e.name,
            D.rarityNames[e.rarity],
            e.desc,
            s.equipOwned[id] ? h('span', { class: 'equipped' }, Object.values(s.loadout.equip).includes(id) ? '穿戴中' : '已拥有') : buyBtn(e.cost, () => P.buyEquip(s, id)),
            { cls: 'rarity-' + e.rarity }
          )
        );
      }
    }
  }

  function shopWall(el) {
    const s = game.save;
    const st = P.heroStats(s);
    el.append(h('div', { class: 'section-title' }, `城墙升级（当前最大血量 ${st.wallMax}）`));
    for (const key of Object.keys(D.wallUpgrades)) {
      const u = D.wallUpgrades[key];
      const lv = s.wall[key];
      let detail = u.desc;
      if (key === 'level') detail = h('span', null, `${u.desc} 血量 ${st.wallMax} → `, h('b', { class: 'up' }, Math.round(C.wall.baseHp * Math.pow(C.wall.hpGrowth, lv))));
      el.append(card(u.name, `Lv.${lv}/${u.max}`, detail, buyBtn(P.wallCost(s, key), () => P.buyWall(s, key), '升级')));
    }
  }

  function shopItems(el) {
    const s = game.save;
    const nI = P.slotCount(s, 'item');
    el.append(h('div', { class: 'section-title' }, '消耗品（一次性，战斗中使用）'));
    if (nI === 0) el.append(h('div', { class: 'hint warn' }, `通关第 ${D.slotUnlocks.item[0]} 关后解锁消耗品槽。现在可以先买好。`));
    for (const id of Object.keys(D.items)) {
      const it = D.items[id];
      el.append(card(h('span', { class: 'with-icon' }, TD.sprites.iconCanvas(id, 30), it.name), `背包 ${s.inventory[id] || 0}`, it.desc, buyBtn(it.cost, () => P.buyItem(s, id))));
    }
  }

  function shopExchange(el) {
    const s = game.save;
    const E = C.exchange;
    el.append(h('div', { class: 'section-title' }, '汇兑所（单向兑换，不能换回来）'));
    const mk = (from, to, rate, times) =>
      h(
        'button',
        {
          class: 'btn small' + ((from === 'copper' ? s.copper : s.silver) >= rate * times ? ' primary' : ''),
          disabled: (from === 'copper' ? s.copper : s.silver) >= rate * times ? null : true,
          onclick: () => {
            if (P.exchange(s, from, times)) {
              sfx('coin');
              game.persist();
              renderShop();
            }
          },
        },
        `兑换 ${times} `,
        coinIcon(to)
      );
    el.append(card(h('span', null, coinIcon('copper'), ` ${E.copperPerSilver} 铜 → 1 `, coinIcon('silver'), ' 银'), null, '银币用来解锁技能和精良装备。', h('div', { class: 'btn-row' }, mk('copper', 'silver', E.copperPerSilver, 1), mk('copper', 'silver', E.copperPerSilver, 5))));
    el.append(card(h('span', null, coinIcon('silver'), ` ${E.silverPerGold} 银 → 1 `, coinIcon('gold'), ' 金'), null, '金币用来购买传说装备。', h('div', { class: 'btn-row' }, mk('silver', 'gold', E.silverPerGold, 1))));
  }

  // ---- 配装页 ----
  function shopLoadout(el) {
    const s = game.save;
    const lo = s.loadout;
    const st = UI.shopState;
    const slotBox = (label, content, onclick, locked, sub) =>
      h('button', { class: 'slot' + (locked ? ' locked' : '') + (content ? '' : ' empty'), onclick: locked ? () => sfx('error') : onclick }, h('div', { class: 'slot-label' }, label), h('div', { class: 'slot-content' }, locked ? '🔒' : content || '空'), sub ? h('div', { class: 'slot-sub' }, sub) : null);

    if (st.levelNo)
      el.append(
        h(
          'div',
          { class: 'recommend' },
          h(
            'button',
            {
              class: 'btn small primary',
              onclick: () => {
                const notes = P.recommend(s, st.levelNo);
                sfx('buy');
                game.persist();
                renderShop();
                UI.toast('已按本关推荐配装：' + notes.join('，'));
              },
            },
            '一键推荐配装'
          ),
          h('span', { class: 'hint' }, '根据本关的怪物自动选择武器、技能和道具。')
        )
      );

    // 武器
    el.append(h('div', { class: 'section-title' }, '武器'));
    el.append(
      h(
        'div',
        { class: 'slot-row' },
        Object.keys(D.weapons).map((id) =>
          slotBox(
            D.weapons[id].name,
            s.weapons[id].owned ? (lo.weapon === id ? '✔ 使用中' : '点击装备') : null,
            () => {
              if (P.setWeapon(s, id)) {
                sfx('click');
                game.persist();
                renderShop();
              }
            },
            !s.weapons[id].owned,
            s.weapons[id].owned ? `Lv.${s.weapons[id].lv}` : '去武器页解锁'
          )
        )
      )
    );

    const slotGroup = (kind, title, defs, owned) => {
      const n = P.slotCount(s, kind);
      const arr = lo[kind === 'item' ? 'items' : kind];
      el.append(h('div', { class: 'section-title' }, title));
      el.append(
        h(
          'div',
          { class: 'slot-row' },
          [0, 1, 2].map((i) =>
            slotBox(
              `槽 ${i + 1}`,
              i < n && arr[i] ? defs[arr[i]].name : null,
              () => pickFor(kind, i, defs, owned),
              i >= n,
              i >= n ? `通关第 ${D.slotUnlocks[kind][i]} 关解锁` : kind === 'item' && arr[i] ? `背包 ${s.inventory[arr[i]] || 0}` : null
            )
          )
        )
      );
    };
    slotGroup('active', '主动技能', D.activeSkills, s.activeOwned);
    slotGroup('passive', '被动技能', D.passiveSkills, s.passiveOwned);

    // 装备
    el.append(h('div', { class: 'section-title' }, '装备'));
    const eqNames = { helm: '头盔', cape: '披风', trinket1: '饰品 1', trinket2: '饰品 2' };
    el.append(
      h(
        'div',
        { class: 'slot-row' },
        Object.keys(eqNames).map((k) => slotBox(eqNames[k], lo.equip[k] ? D.equipment[lo.equip[k]].name : null, () => pickEquip(k), false, lo.equip[k] ? D.equipment[lo.equip[k]].desc : null))
      )
    );

    const invOwned = {};
    for (const id of Object.keys(s.inventory)) if (s.inventory[id] > 0) invOwned[id] = true;
    slotGroup('item', '消耗品', D.items, invOwned);

    // 目标优先级与自动释放
    el.append(h('div', { class: 'section-title' }, '战斗设置'));
    el.append(
      h(
        'div',
        { class: 'slot-row' },
        h(
          'label',
          { class: 'select-box' },
          '目标优先级 ',
          h(
            'select',
            {
              onchange: (e) => {
                lo.target = e.target.value;
                game.persist();
              },
            },
            Object.keys(D.targetModes).map((k) => h('option', { value: k, selected: lo.target === k ? true : null }, D.targetModes[k]))
          )
        ),
        h(
          'label',
          { class: 'select-box' },
          h('input', {
            type: 'checkbox',
            checked: lo.autoCast ? true : null,
            onchange: (e) => {
              lo.autoCast = e.target.checked;
              game.persist();
            },
          }),
          ' 技能自动释放'
        )
      )
    );
  }

  function pickFor(kind, index, defs, owned) {
    const s = game.save;
    const arr = s.loadout[kind === 'item' ? 'items' : kind];
    const opts = Object.keys(defs).filter((id) => owned[id] && !defs[id].passiveOnly);
    const list = h('div', { class: 'pick-list' });
    const choose = (id) => {
      if (P.setSlot(s, kind, index, id)) {
        sfx('click');
        game.persist();
        UI.closeModal();
        renderShop();
      } else {
        sfx('error');
        UI.toast(kind === 'item' ? '背包里没有更多这个道具了' : '无法放入');
      }
    };
    list.append(h('button', { class: 'pick', onclick: () => choose(null) }, h('b', null, '（清空）')));
    for (const id of opts) {
      const d = defs[id];
      list.append(h('button', { class: 'pick' + (arr[index] === id ? ' on' : '') + (arr.includes(id) && arr[index] !== id && kind !== 'item' ? ' used' : ''), onclick: () => choose(id) }, h('b', null, d.name, kind === 'item' ? ` ×${s.inventory[id] || 0}` : ''), h('span', null, d.desc)));
    }
    if (!opts.length) list.append(h('div', { class: 'hint' }, kind === 'item' ? '背包是空的，去「道具」页购买。' : '还没有可用的技能，去「技能」页用银币解锁。'));
    modal(h('div', null, h('h2', null, '选择'), list, h('div', { class: 'modal-buttons' }, h('button', { class: 'btn', onclick: UI.closeModal }, '取消'))), { closeOnBack: true });
  }

  function pickEquip(slotKey) {
    const s = game.save;
    const kind = slotKey.startsWith('trinket') ? 'trinket' : slotKey;
    const opts = Object.keys(D.equipment).filter((id) => s.equipOwned[id] && D.equipment[id].slot === kind);
    const list = h('div', { class: 'pick-list' });
    const choose = (id) => {
      P.setEquip(s, slotKey, id);
      sfx('click');
      game.persist();
      UI.closeModal();
      renderShop();
    };
    list.append(h('button', { class: 'pick', onclick: () => choose(null) }, h('b', null, '（卸下）')));
    for (const id of opts) list.append(h('button', { class: 'pick' + (s.loadout.equip[slotKey] === id ? ' on' : ''), onclick: () => choose(id) }, h('b', null, D.equipment[id].name), h('span', null, D.equipment[id].desc)));
    if (!opts.length) list.append(h('div', { class: 'hint' }, '还没有这个栏位的装备，去「装备」页购买。'));
    modal(h('div', null, h('h2', null, '选择装备'), list, h('div', { class: 'modal-buttons' }, h('button', { class: 'btn', onclick: UI.closeModal }, '取消'))), { closeOnBack: true });
  }

  // ================= 战斗 HUD =================
  const hud = {};
  UI.showBattle = function (battle) {
    clear();
    hud.battle = battle;
    const skillBtns = battle.skills.map((sk, i) =>
      h(
        'button',
        { class: 'skill-btn', title: sk.def.desc, onclick: () => game.trySkill(i) },
        h('span', { class: 'key' }, i + 1),
        TD.sprites.iconCanvas(sk.id, 40),
        h('span', { class: 'skill-name' }, sk.def.name),
        h('span', { class: 'cd' })
      )
    );
    const itemBtns = battle.items.map((it, i) =>
      h(
        'button',
        { class: 'item-btn', title: it.def.desc, onclick: () => game.tryItem(i) },
        h('span', { class: 'key' }, 'QWE'[i]),
        TD.sprites.iconCanvas(it.id, 36),
        h('span', { class: 'skill-name' }, it.def.name)
      )
    );
    hud.nudge = h('div', { class: 'nudge-bubble hidden' }, '点我释放技能！');
    hud.skillBtns = skillBtns;
    hud.itemBtns = itemBtns;
    hud.wallFill = h('div', { class: 'wall-fill' });
    hud.wallText = h('span', { class: 'wall-text' });
    hud.wave = h('div', { class: 'wave-info' });
    hud.callBtn = h('button', { class: 'btn small call-btn', onclick: () => game.callWave() }, '提前召唤 (N)');
    hud.copper = h('span', null, '0');
    hud.targetBtn = h('button', { class: 'btn small', onclick: () => game.cycleTarget(), title: '切换目标优先级 (T)' });
    hud.speedBtn = h('button', { class: 'btn small', onclick: () => game.toggleSpeed(), title: '切换速度 (F)' });
    hud.autoBtn = h('button', { class: 'btn small', onclick: () => game.toggleAuto(), title: '技能自动释放' });
    hud.laneHint = h('div', { class: 'lane-hint hidden' }, '点击一条车道释放（右键或 Esc 取消）');

    screenEl = h(
      'div',
      { class: 'screen battle-hud' },
      h(
        'div',
        { class: 'hud-top' },
        h('div', { class: 'wall-bar' }, h('span', { class: 'wall-label' }, '城墙'), h('div', { class: 'wall-track' }, hud.wallFill), hud.wallText),
        h('div', { class: 'wave-box' }, hud.wave, hud.callBtn),
        h('div', { class: 'hud-copper' }, coinIcon('copper'), hud.copper),
        h('button', { class: 'btn small', onclick: () => game.togglePause() }, '❚❚')
      ),
      hud.laneHint,
      hud.nudge,
      h('div', { class: 'hud-bottom' }, h('div', { class: 'skill-bar' }, skillBtns, battle.skills.length ? null : h('span', { class: 'hint' }, '没有携带主动技能')), h('div', { class: 'item-bar' }, itemBtns), h('div', { class: 'ctrl-bar' }, hud.targetBtn, hud.autoBtn, hud.speedBtn))
    );
    root.appendChild(screenEl);
    UI.updateHud();
    if (battle.level.tip) UI.toast('💡 ' + battle.level.tip, 'tip');
  };

  UI.updateHud = function () {
    const b = hud.battle;
    if (!b || !screenEl || !screenEl.classList.contains('battle-hud')) return;
    const ratio = b.wall.hp / b.wall.max;
    hud.wallFill.style.width = ratio * 100 + '%';
    hud.wallFill.className = 'wall-fill' + (ratio < 0.3 ? ' low' : ratio < 0.6 ? ' mid' : '');
    hud.wallText.textContent = `${Math.ceil(b.wall.hp)} / ${b.wall.max}`;
    let waveText;
    if (b.waveState === 'prepare') waveText = `准备… ${Math.ceil(b.countdown)}`;
    else waveText = `第 ${b.waveIndex + 1} / ${b.totalWaves} 波`;
    if (b.pendingSupply) waveText += ' · 补给中';
    else if (b.waveState === 'waiting') waveText += ` · 下一波 ${Math.max(0, Math.ceil(b.countdown))} 秒`;
    hud.wave.textContent = waveText;
    const canCall = b.waveState === 'waiting' && b.waveIndex < b.totalWaves - 1 && !b.pendingSupply && b.countdown > 0;
    hud.callBtn.classList.toggle('hidden', !canCall);
    if (canCall) hud.callBtn.textContent = `提前召唤 +${Math.max(0, Math.floor(b.countdown))}铜 (N)`;
    hud.copper.textContent = b.killCopper + b.earlyCopper;
    b.skills.forEach((sk, i) => {
      const btn = hud.skillBtns[i];
      const cd = btn.querySelector('.cd');
      const ready = b.skillReady(i);
      btn.classList.toggle('ready', ready);
      btn.classList.toggle('armed', game.pendingLane && game.pendingLane.kind === 'skill' && game.pendingLane.index === i);
      if (sk.cd > 0) {
        cd.style.background = `conic-gradient(rgba(30,20,10,0.65) ${(sk.cd / sk.def.cd) * 360}deg, transparent 0)`;
        cd.textContent = Math.ceil(sk.cd);
      } else {
        cd.style.background = 'none';
        cd.textContent = '';
      }
    });
    b.items.forEach((it, i) => {
      const btn = hud.itemBtns[i];
      btn.classList.toggle('used', it.used);
      btn.classList.toggle('armed', game.pendingLane && game.pendingLane.kind === 'item' && game.pendingLane.index === i);
    });
    hud.targetBtn.textContent = '🎯 ' + D.targetModes[b.target];
    hud.speedBtn.textContent = game.speed === 2 ? '⏩ 2倍速' : '▶ 1倍速';
    hud.autoBtn.textContent = b.autoCast ? '自动释放：开' : '自动释放：关';
    hud.laneHint.classList.toggle('hidden', !game.pendingLane);
    // 新手引导（设计书 12.6）：前 4 关第一次可以放技能时提示
    let nudgeIdx = -1;
    if (b.levelNo <= 4 && b.castCount === 0 && !b.over) {
      const near = b.monsters.filter((m) => !m.dead && b.inRange(m)).length;
      if (near >= 2) nudgeIdx = b.skills.findIndex((sk, i) => b.skillReady(i));
    }
    hud.skillBtns.forEach((btn, i) => btn.classList.toggle('nudge', i === nudgeIdx));
    hud.nudge.classList.toggle('hidden', nudgeIdx < 0);
    if (nudgeIdx >= 0) hud.nudge.style.left = 10 + nudgeIdx * 102 + 'px';
  };

  // ================= 战场补给（设计书 2.7） =================
  UI.showSupply = function (battle, choices) {
    const first = !game.save.stats.seenSupply;
    const cards = choices.map((id, i) => {
      const sup = D.supplies[id];
      return h(
        'button',
        { class: 'supply-card', onclick: () => game.pickSupply(id) },
        h('span', { class: 'key' }, i + 1),
        TD.sprites.iconCanvas(sup.icon, 64),
        h('div', { class: 'supply-name' }, sup.name),
        h('div', { class: 'supply-desc' }, sup.desc)
      );
    });
    modal(
      h(
        'div',
        { class: 'supply' },
        h('h2', null, '📦 补给箱到了！'),
        h('div', { class: 'hint' }, first ? '战斗暂停中。选一张补给卡，效果持续到本关结束。按 1 / 2 / 3 也可以选。' : '选一张补给卡（本关有效）'),
        h('div', { class: 'supply-row' }, cards),
        battle.supplyPicked.length ? h('div', { class: 'hint' }, '已选：' + battle.supplyPicked.map((x) => D.supplies[x].name).join('、')) : null
      ),
      { cls: 'supply-modal' }
    );
  };

  UI.showPause = function () {
    const b = hud.battle;
    modal(
      h(
        'div',
        { class: 'pause' },
        h('h2', null, '暂停'),
        h('p', null, `第 ${b.levelNo} 关 · ${b.level.name}`),
        h(
          'div',
          { class: 'modal-buttons col' },
          h('button', { class: 'btn primary', onclick: () => game.togglePause() }, '继续战斗'),
          h('button', { class: 'btn', onclick: () => (UI.closeModal(), game.startBattle(b.levelNo)) }, '重新开始'),
          h('button', { class: 'btn', onclick: () => UI.showHelp() }, '玩法说明'),
          h('button', { class: 'btn danger', onclick: () => game.quitBattle() }, '放弃本关')
        )
      )
    );
  };

  // ================= 结算 =================
  UI.showResult = function (battle, reward) {
    const res = battle.result;
    const n = battle.levelNo;
    const win = res.win;
    const rows = [];
    rows.push(h('div', { class: 'reward-row' }, h('span', null, win ? '通关奖励' : '安慰奖励'), h('b', null, reward.baseCopper, ' ', coinIcon('copper'))));
    rows.push(h('div', { class: 'reward-row' }, h('span', null, `击杀掉落（${res.kills} 只）`), h('b', null, reward.killCopper, ' ', coinIcon('copper'))));
    if (reward.earlyCopper) rows.push(h('div', { class: 'reward-row' }, h('span', null, '提前召唤'), h('b', null, reward.earlyCopper, ' ', coinIcon('copper'))));
    if (reward.copperMult > 1) rows.push(h('div', { class: 'reward-row' }, h('span', null, '幸运加成'), h('b', null, `×${reward.copperMult.toFixed(2)}`)));
    rows.push(h('div', { class: 'reward-row total' }, h('span', null, '合计'), h('b', null, reward.copper, ' ', coinIcon('copper'), reward.silver ? [' ', reward.silver, ' ', coinIcon('silver')] : null, reward.gold ? [' ', reward.gold, ' ', coinIcon('gold')] : null)));
    const notes = reward.notes.filter((x) => !x.includes('失败')).map((x) => h('div', { class: 'note' }, '✦ ' + x));
    if (res.supplies && res.supplies.length) notes.push(h('div', { class: 'note' }, '📦 本关补给：' + res.supplies.map((x) => D.supplies[x].name).join('、')));
    const unlocks = reward.unlocks.map((x) => h('div', { class: 'note unlock' }, '🔓 ' + x));
    let tips = null;
    if (!win) {
      const sug = P.suggestions(game.save);
      tips = h('div', { class: 'suggest' }, h('h3', null, '推荐强化'), sug.map((x) => h('div', { class: 'note' + (x.afford ? ' afford' : '') }, (x.afford ? '✔ ' : '· ') + x.text)), h('div', { class: 'hint' }, `城墙守到了第 ${res.wave} / ${battle.totalWaves} 波。`));
    }
    const hasNext = win && D.levels[n + 1];
    const body = h(
      'div',
      { class: 'result ' + (win ? 'win' : 'lose') },
      h('h2', { class: 'result-title' }, win ? '守城成功！' : '城墙被攻破了…'),
      win ? h('div', { class: 'result-stars' }, [1, 2, 3].map((i) => h('span', { class: 'big-star' + (i <= res.stars ? ' on' : ''), style: { animationDelay: i * 0.25 + 's' } }, '★'))) : null,
      win ? h('div', { class: 'hint' }, `城墙剩余 ${Math.round(res.wallRatio * 100)}%`) : null,
      h('div', { class: 'reward-box' }, rows),
      notes,
      unlocks,
      tips,
      h(
        'div',
        { class: 'modal-buttons' },
        h('button', { class: 'btn', onclick: () => (UI.closeModal(), UI.showMap()) }, '地图'),
        h('button', { class: 'btn', onclick: () => (UI.closeModal(), UI.showShop(win && hasNext ? n + 1 : n, win ? 'loadout' : 'attrs')) }, '去商店'),
        !win || !hasNext ? h('button', { class: 'btn' + (win ? '' : ' primary'), onclick: () => (UI.closeModal(), game.startBattle(n)) }, '再来一次') : null,
        hasNext ? h('button', { class: 'btn primary', onclick: () => (UI.closeModal(), UI.showMap(), UI.showPreview(n + 1)) }, '下一关 ›') : null
      )
    );
    modal(body, { cls: 'result-modal' });
  };
})((globalThis.TD = globalThis.TD || {}));
