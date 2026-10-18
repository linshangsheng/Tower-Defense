// 界面：无尽 / 每日、战斗报告、成就、图鉴（从 ui.js 拆出，设计书 24、25、32）
(function (TD) {
  'use strict';

  const D = TD.data;
  const P = TD.progression;
  const C = TD.config;
  const UI = TD.ui;
  const _ = UI._;
  const { h, modal, sfx, clear, coinIcon, costEl, starsEl, currencyBar } = _;
  const G = () => _.game;
  const R = () => _.root;

  // ================= 无尽模式与每日挑战（设计书 25 章） =================
  UI.startEndless = function () {
    const s = G().save;
    const levelDef = TD.modes.buildEndless(s, (Date.now() & 0xffffff) + 99);
    G().startBattle('endless', { kind: 'endless', levelDef, stage: levelDef.stage });
  };

  UI.showEndless = function () {
    const s = G().save;
    const e = s.endless || { best: 0, runs: 0 };
    modal(
      h(
        'div',
        { class: 'preview' },
        h('div', { class: 'preview-head' }, h('h2', null, '♾ 无尽模式'), h('span', { class: 'tag' }, `纪录 ${e.best} 波`)),
        h(
          'ul',
          { class: 'mode-rules' },
          h('li', null, '怪物从已解锁的章节里随机出现，一波比一波强。'),
          h('li', null, '每 5 波一个小 Boss，每 10 波一个大 Boss；每 3 波一次战场补给。'),
          h('li', null, '城墙被攻破时结束。每清完一波 15 铜；刷新纪录时，每多 5 波奖励 1 银。'),
          h('li', null, '到达第 30 波可以解锁成就「永不陷落」（1 金）。')
        ),
        h('div', { class: 'modal-buttons' }, h('button', { class: 'btn', onclick: UI.closeModal }, '返回'), h('button', { class: 'btn', onclick: () => UI.showShop(null, 'loadout') }, '配装'), h('button', { class: 'btn primary big', onclick: () => (UI.closeModal(), UI.startEndless()) }, '开始'))
      ),
      { closeOnBack: true, cls: 'wide' }
    );
  };

  // ================= Boss 连战（设计书 48） =================
  UI.startBossRush = function () {
    const levelDef = TD.modes.buildBossRush(G().save);
    G().startBattle('bossrush', { kind: 'bossrush', levelDef, stage: levelDef.stage });
  };

  UI.showBossRush = function () {
    const s = G().save;
    const r = s.bossRush || { best: 0, bestTime: 0 };
    const list = TD.modes.bossRushList(s);
    const faces = list.map((f) => {
      const img = TD.sprites.portrait(f.boss, 44);
      img.title = D.monsters[f.boss].name;
      return img;
    });
    modal(
      h(
        'div',
        { class: 'preview' },
        h('div', { class: 'preview-head' }, h('h2', null, '👑 Boss 连战'), h('span', { class: 'tag' }, `最多 ${r.best} / ${list.length}${r.bestTime ? ' · 最快 ' + TD.modes.fmtTime(r.bestTime) : ''}`)),
        h('div', { class: 'rush-faces' }, faces),
        h(
          'ul',
          { class: 'mode-rules' },
          h('li', null, `${list.length} 个 Boss 按故事顺序出场，每个带 6 只它那一章的小怪；打败当前 Boss 才会来下一个。${list.length < D.town.length ? '通关第七章后，贝贝和波波也会加入。' : ''}`),
          h('li', null, '想刷最快纪录？"提前召唤"可以让下一个 Boss 马上出场——两个 Boss 同时在场，很冒险！'),
          h('li', null, '全部按第 60 关的难度计算；每 3 波一次战场补给；城墙被攻破时结束。'),
          h('li', null, '刷新"打败 Boss 数"纪录时，每多 1 个奖励 1 银；全部打败解锁成就「Boss 克星」（1 金）。')
        ),
        h('div', { class: 'modal-buttons' }, h('button', { class: 'btn', onclick: UI.closeModal }, '返回'), h('button', { class: 'btn', onclick: () => UI.showShop(null, 'loadout') }, '配装'), h('button', { class: 'btn primary big', onclick: () => (UI.closeModal(), UI.startBossRush()) }, '开始'))
      ),
      { closeOnBack: true, cls: 'wide' }
    );
  };

  UI.showDaily = function () {
    const s = G().save;
    const info = TD.modes.dailyInfo(s);
    const r = TD.modes.dailyRules[info.rule];
    const lvl = D.levels[info.level];
    modal(
      h(
        'div',
        { class: 'preview' },
        h('div', { class: 'preview-head' }, h('h2', null, `📅 每日挑战 · ${info.key}`), info.done ? h('span', { class: 'tag' }, '今日已完成') : null),
        h('p', { class: 'daily-level' }, `第 ${info.level} 关 · ${lvl.name}（${D.levelTypeNames[lvl.type]}）`),
        h('div', { class: 'daily-rule' }, h('b', null, `今日规则「${r.name}」`), h('span', null, r.desc)),
        h('p', { class: 'hint' }, '每天第一次通过奖励 3 银，可以反复挑战。不影响关卡的星级记录。'),
        h(
          'div',
          { class: 'modal-buttons' },
          h('button', { class: 'btn', onclick: UI.closeModal }, '返回'),
          h('button', { class: 'btn', onclick: () => UI.showShop(null, 'loadout') }, '配装'),
          h('button', { class: 'btn primary big', onclick: () => (UI.closeModal(), G().startBattle(info.level, { kind: 'daily', levelDef: TD.modes.buildDaily(info), stage: info.level, info })) }, '开始挑战')
        )
      ),
      { closeOnBack: true, cls: 'wide' }
    );
  };

  // ================= 战斗报告（设计书 32） =================
  const SOURCE_NAMES = { buddy: '助战伙伴', weapon: '武器', splash: '溅射', chain: '闪电跳跃', arrowRain: '箭雨', thunder: '雷霆一击', burn: '灼烧', thorns: '荆棘', bomb: '小炸弹', zap: '雷鸣箭袋', firefly: '萤火虫' };
  UI.reportEl = function (res, open) {
    const rp = res && res.report;
    if (!rp) return null;
    const pct = (x) => Math.round(x * 100) + '%';
    const bar = (label, v, total, cls) =>
      h('div', { class: 'rep-row' }, h('span', { class: 'rep-label' }, label), h('div', { class: 'rep-bar' }, h('div', { class: 'rep-fill ' + (cls || ''), style: { width: (total ? (v / total) * 100 : 0).toFixed(1) + '%' } })), h('span', { class: 'rep-val' }, total ? pct(v / total) : '—'));
    const parts = [];
    // 1. 伤害来源
    const src = Object.entries(rp.bySource).sort((a, b) => b[1] - a[1]);
    const dealt = src.reduce((a, [, v]) => a + v, 0);
    if (dealt > 0) parts.push(h('h4', null, `伤害来源（共 ${Math.round(dealt)}）`), src.map(([k, v]) => bar(SOURCE_NAMES[k] || k, v, dealt)));
    // 2. 被挡掉的伤害
    const tips = [];
    const blocked = (kind) => (rp.raw[kind] > 0 ? 1 - rp.real[kind] / rp.raw[kind] : 0);
    const bp = blocked('phys');
    const bm = blocked('magic');
    const rows = [];
    if (rp.raw.phys > 0) rows.push(bar('物理被挡', bp, 1, 'block'));
    if (rp.raw.magic > 0) rows.push(bar('魔法被挡', bm, 1, 'block'));
    if (rows.length) parts.push(h('h4', null, '被护甲 / 魔抗挡掉的伤害'), rows);
    if (rp.raw.phys > rp.raw.magic * 0.3 && bp > 0.3) tips.push(`物理伤害有 ${pct(bp)} 被护甲、木盾或灵体挡掉了：试试魔法杖、回旋镖或「穿甲」。`);
    if (rp.raw.magic > rp.raw.phys * 0.3 && bm > 0.3) tips.push(`魔法伤害有 ${pct(bm)} 被魔抗挡掉了：熔岩怪物不怕魔法，换物理武器（火炮、连发弩）。`);
    // 3. 城墙伤害来源
    const wall = Object.entries(rp.wallBy).sort((a, b) => b[1] - a[1]);
    const wt = wall.reduce((a, [, v]) => a + v, 0);
    if (wt > 0) {
      const name = (k) => (k === 'boss' ? 'Boss 技能' : D.monsters[k] ? D.monsters[k].name : k);
      parts.push(h('h4', null, `城墙伤害来源（共 ${Math.round(wt)}）`), wall.slice(0, 3).map(([k, v]) => bar(name(k), v, wt, 'wall')));
      const [topK, topV] = wall[0];
      // 只对有特殊机制的怪给提示（普通小怪的说明没有参考价值）
      if (topK !== 'boss' && D.monsters[topK] && topV / wt >= 0.3 && D.monsterTags(D.monsters[topK]).length) tips.push(`城墙伤害最多来自「${name(topK)}」：${D.monsters[topK].desc}`);
    }
    if (!parts.length) return null;
    return h('details', { class: 'report', open: open ? true : null }, h('summary', null, '📊 战斗报告', res.bestStreak >= 5 ? h('span', { class: 'rep-streak' }, `  最高连击 ${res.bestStreak}`) : null), parts, tips.map((t) => h('div', { class: 'note rep-tip' }, '💡 ' + t)));
  };

  UI.showModeResult = function (battle, reward) {
    const res = battle.result;
    const endless = battle.mode.kind === 'endless';
    const rush = battle.mode.kind === 'bossrush';
    const title = endless
      ? reward.waves > 0
        ? `坚持了 ${reward.waves} 波！`
        : '城墙被攻破了…'
      : rush
      ? reward.beaten >= reward.total
        ? `全部打败！用时 ${TD.modes.fmtTime(res.time)}`
        : `打败了 ${reward.beaten} / ${reward.total} 个 Boss`
      : res.win
      ? '挑战成功！'
      : '挑战失败…';
    const rows = [h('div', { class: 'reward-row total' }, h('span', null, '获得'), h('b', null, reward.copper, ' ', coinIcon('copper'), reward.silver ? [' ', reward.silver, ' ', coinIcon('silver')] : null))];
    const notes = reward.notes.map((x) => h('div', { class: 'note' }, '✦ ' + x));
    for (const a of reward.achievements || []) notes.push(h('div', { class: 'note achieve' }, `🏆 达成成就「${a.name}」：${a.desc}（+${P.costText(a.reward)}）`));
    modal(
      h(
        'div',
        { class: 'result ' + (endless || res.win ? 'win' : 'lose') },
        h('h2', { class: 'result-title' }, title),
        endless ? h('div', { class: 'hint' }, `个人纪录：${(G().save.endless || {}).best} 波 · 击败 ${res.kills} 只`) : h('div', { class: 'hint' }, `击败 ${res.kills} 只`),
        h('div', { class: 'reward-box' }, rows),
        notes,
        UI.reportEl(res, false),
        h(
          'div',
          { class: 'modal-buttons' },
          h('button', { class: 'btn', onclick: () => (UI.closeModal(), G().battle = null, G().renderer.battle = null, UI.showMap()) }, '地图'),
          h('button', { class: 'btn', onclick: () => (UI.closeModal(), G().battle = null, G().renderer.battle = null, UI.showShop(null, 'attrs')) }, '去商店'),
          h('button', { class: 'btn primary', onclick: () => (UI.closeModal(), endless ? UI.startEndless() : G().startBattle(battle.levelNo, battle.mode)) }, '再来一次')
        )
      ),
      { cls: 'result-modal' }
    );
  };

  // ================= 成就与图鉴（设计书 24 章） =================
  UI.announce = function (list) {
    (list || []).forEach((a, i) => setTimeout(() => UI.toast(`🏆 达成成就「${a.name}」+${P.costText(a.reward)}`, 'achieve', 2600), i * 900));
  };

  // 守城档案（设计书 46）
  function recordsEl(s) {
    const st = s.stats;
    const lv = Object.keys(D.levels);
    const kt = st.killsByType || {};
    const fav = Object.keys(kt).sort((a, b) => kt[b] - kt[a])[0];
    const tile = (label, value, extra) => h('div', { class: 'rec-tile' }, extra || null, h('b', null, value), h('span', null, label));
    const count = (fn) => lv.filter((n) => fn(s.levels[n] || {})).length;
    const groups = [
      ['战斗', [tile('战斗次数', st.battles), tile('胜利次数', st.wins), tile('胜率', st.battles ? Math.round((st.wins / st.battles) * 100) + '%' : '—'), tile('最高连击', st.bestStreak || 0)]],
      [
        '怪物',
        [
          tile('累计击败', st.kills),
          fav ? tile(`击败最多：${D.monsters[fav].name}`, kt[fav], TD.sprites.portrait(fav, 40)) : tile('击败最多', '—'),
          tile('遇见的怪物', `${Object.keys(s.seenMonsters || {}).length} 种`),
        ],
      ],
      ['操作', [tile('打断 Boss', st.interrupts || 0), tile('提前召唤', st.earlyCalls || 0), tile('选择补给', st.supplies || 0), tile('技能协同', st.combos || 0)]],
      [
        '收集',
        [
          tile('星星', `${lv.reduce((a, n) => a + ((s.levels[n] || {}).stars || 0), 0)} / ${lv.length * 3}`),
          tile('王冠', `${count((r) => r.crown)} / ${lv.length}`),
          tile('关卡任务', `${count((r) => r.mission)} / ${lv.filter((n) => D.missionFor(+n)).length}`),
          tile('成就', `${D.achievements.filter((a) => (s.achievements || {})[a.id]).length} / ${D.achievements.length}`),
          tile('日记', `${D.storyOrder.filter((k) => (s.story || {})[k] === 'read').length} / ${D.storyOrder.length}`),
          tile('角色', `${D.outfits.filter((o) => P.outfitOwned(s, o.id)).length} / ${D.outfits.length}`),
          tile('小镇邻居', `${D.town.filter((f) => P.isCleared(s, f.level)).length} / ${D.town.length}`),
        ],
      ],
      ['挑战', [tile('无尽最高', `${(s.endless || {}).best || 0} 波`), tile('每日挑战', `${Object.keys(s.daily || {}).length} 天`)]],
    ];
    return h('div', { class: 'records' }, groups.map(([title, tiles]) => [h('h4', null, title), h('div', { class: 'rec-row' }, tiles)]));
  }

  UI.showAchievements = function (tab) {
    const s = G().save;
    const all = D.achievements;
    const tabs = h(
      'div',
      { class: 'ach-tabs' },
      h('button', { class: 'btn small' + (tab === 'records' ? '' : ' primary'), onclick: () => UI.showAchievements() }, '🏆 成就'),
      h('button', { class: 'btn small' + (tab === 'records' ? ' primary' : ''), onclick: () => UI.showAchievements('records') }, '📜 守城档案')
    );
    if (tab === 'records') {
      modal(h('div', null, tabs, h('h2', null, '守城档案'), recordsEl(s), h('div', { class: 'modal-buttons' }, h('button', { class: 'btn', onclick: UI.closeModal }, '关闭'))), { cls: 'wide', closeOnBack: true });
      return;
    }
    const done = all.filter((a) => (s.achievements || {})[a.id]).length;
    const cards = all.map((a) => {
      const ok = (s.achievements || {})[a.id];
      return h('div', { class: 'ach' + (ok ? ' done' : '') }, h('div', { class: 'ach-icon' }, ok ? '🏆' : '🔒'), h('div', { class: 'ach-main' }, h('b', null, a.name), h('span', null, a.desc)), h('div', { class: 'ach-reward' }, P.costText(a.reward)));
    });
    modal(
      h(
        'div',
        null,
        tabs,
        h('h2', null, `成就 ${done} / ${all.length}`),
        h('div', { class: 'ach-stats' }, `战斗 ${s.stats.battles} 次 · 胜利 ${s.stats.wins} 次 · 击败 ${s.stats.kills} 只 · 打断 ${s.stats.interrupts || 0} 次 · 提前召唤 ${s.stats.earlyCalls || 0} 次`),
        h('div', { class: 'ach-grid' }, cards),
        h('div', { class: 'modal-buttons' }, h('button', { class: 'btn', onclick: UI.closeModal }, '关闭'))
      ),
      { cls: 'wide', closeOnBack: true }
    );
  };

  // 怪物首次出现的章节（召唤物、分裂产物跟随母体）
  function monsterChapter(type) {
    const extra = { minijelly: 1, gobling: 1, minipumpkin: 3, snowball: 4, iceDragon: 4, inkClone: 5 };
    if (extra[type]) return extra[type];
    const nums = Object.keys(D.levels).map(Number).sort((a, b) => a - b);
    for (const n of nums) for (const w of D.levels[n].waves) for (const [t] of w.groups) if (t === type) return D.chapterOf(n).id;
    return 1;
  }

  UI.showBestiary = function (chapterId) {
    const s = G().save;
    chapterId = chapterId || 1;
    const seen = s.seenMonsters || {};
    const kills = s.stats.killsByType || {};
    const types = Object.keys(D.monsters).filter((t) => monsterChapter(t) === chapterId);
    const total = Object.keys(D.monsters).length;
    const seenCount = Object.keys(D.monsters).filter((t) => seen[t] || kills[t]).length;
    const tabs = D.chapters.map((c) => h('button', { class: 'btn small' + (c.id === chapterId ? ' primary' : ''), onclick: () => (sfx('click'), UI.showBestiary(c.id)) }, c.name));
    const cards = types.map((t) => {
      const def = D.monsters[t];
      const known = seen[t] || kills[t];
      let img;
      if (known) img = TD.sprites.portrait(t, 64);
      else {
        img = document.createElement('canvas');
        img.width = img.height = 64;
        const sil = TD.sprites.silhouette(t, def.boss ? 17 : 19, '#5e4a3a');
        const cx = img.getContext('2d');
        if (sil) cx.drawImage(sil.canvas, 32 - sil.ox, (def.flying ? 48 : 56) - sil.oy);
      }
      img.className = 'portrait';
      return h(
        'div',
        { class: 'mon-card' + (def.boss ? ' boss' : '') + (known ? '' : ' unknown') },
        img,
        h('div', { class: 'mon-name' }, known ? def.name : '？？？', known ? h('span', { class: 'mon-kills' }, ` 击败 ${kills[t] || 0}`) : null),
        h('div', { class: 'mon-desc' }, known ? [h('div', { class: 'intro-tags' }, D.monsterTags(def).map((x) => h('span', { class: 'tag small' }, x))), def.desc] : '还没有遇见过。')
      );
    });
    modal(
      h(
        'div',
        null,
        h('h2', null, `怪物图鉴 ${seenCount} / ${total}`),
        h('div', { class: 'btn-row bestiary-tabs' }, tabs),
        h('div', { class: 'mon-list bestiary' }, cards),
        h('div', { class: 'modal-buttons' }, h('button', { class: 'btn', onclick: UI.closeModal }, '关闭'))
      ),
      { cls: 'wide', closeOnBack: true }
    );
  };

})((globalThis.TD = globalThis.TD || {}));
