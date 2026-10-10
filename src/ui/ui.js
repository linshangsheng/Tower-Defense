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
    TD.music.play(1, 'calm');
    game.renderer.mood = 'idle';
    const has = P.highestCleared(game.save) > 0 || game.save.copper > 0;
    screenEl = h(
      'div',
      { class: 'screen title-screen' },
      h('div', { class: 'title-logo' }, h('div', { class: 'title-main' }, '守城英雄'), h('div', { class: 'title-sub' }, '小卫兵铛铛的守城日记')),
      h(
        'div',
        { class: 'title-buttons' },
        h('button', { class: 'btn big primary', onclick: () => (sfx('click'), has || game.save.settings.diffChosen ? UI.showMap() : UI.chooseDifficulty(() => UI.showMap())) }, has ? '继续游戏' : '开始游戏'),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn', style: { flex: 1 }, onclick: () => (sfx('click'), UI.showBestiary()) }, '图鉴'), h('button', { class: 'btn', style: { flex: 1 }, onclick: () => (sfx('click'), UI.showAchievements()) }, '成就')),
        h('button', { class: 'btn', onclick: () => (sfx('click'), UI.showSettings()) }, '设置'),
        h('button', { class: 'btn', onclick: () => (sfx('click'), UI.showHelp()) }, '玩法说明')
      ),
      h('div', { class: 'title-foot' }, '网页原型 v0.5 · 五章 50 关')
    );
    root.appendChild(screenEl);
  };

  UI.chooseDifficulty = function (onDone) {
    const s = game.save.settings;
    const pick = (id) => {
      s.difficulty = id;
      s.diffChosen = true;
      game.persist();
      UI.closeModal();
      onDone && onDone();
    };
    modal(
      h(
        'div',
        null,
        h('h2', null, '选择难度'),
        h('p', { class: 'hint' }, '之后可以在「设置」里随时更改。'),
        h(
          'div',
          { class: 'diff-row' },
          Object.keys(C.difficulties).map((id) =>
            h('button', { class: 'diff-card' + (id === 'normal' ? ' rec' : ''), onclick: () => (sfx('click'), pick(id)) }, h('b', null, C.difficulties[id].name), h('span', null, C.difficulties[id].desc), id === 'normal' ? h('em', null, '推荐') : null)
          )
        )
      ),
      { cls: 'wide' }
    );
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
        'label',
        { class: 'row' },
        h('input', {
          type: 'checkbox',
          checked: s.music !== false ? true : null,
          onchange: (e) => {
            s.music = e.target.checked;
            TD.music.setEnabled(s.music);
            game.persist();
          },
        }),
        ' 背景音乐'
      ),
      h(
        'label',
        { class: 'row' },
        '难度 ',
        h(
          'select',
          {
            onchange: (e) => {
              s.difficulty = e.target.value;
              s.diffChosen = true;
              game.persist();
            },
          },
          Object.keys(C.difficulties).map((id) => h('option', { value: id, selected: (s.difficulty || 'normal') === id ? true : null }, `${C.difficulties[id].name}：${C.difficulties[id].desc}`))
        )
      ),
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'btn small', onclick: () => UI.showExport() }, '导出存档'),
        h('button', { class: 'btn small', onclick: () => UI.showImport() }, '导入存档')
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

  // 存档导出 / 导入（设计书 13.3）
  UI.showExport = function () {
    const code = TD.saveStore.exportCode(game.save);
    const ta = h('textarea', { class: 'save-code', readonly: true }, code);
    modal(
      h(
        'div',
        null,
        h('h2', null, '导出存档'),
        h('p', { class: 'hint' }, '把下面这段文字复制保存好。换电脑或清除浏览器数据后，用「导入存档」粘贴回来即可恢复进度。'),
        ta,
        h(
          'div',
          { class: 'modal-buttons' },
          h(
            'button',
            {
              class: 'btn primary',
              onclick: () => {
                ta.select();
                let ok = false;
                try {
                  ok = document.execCommand('copy');
                } catch (e) {
                  ok = false;
                }
                if (navigator.clipboard) navigator.clipboard.writeText(code).then(() => UI.toast('已复制到剪贴板'), () => {});
                else if (ok) UI.toast('已复制到剪贴板');
              },
            },
            '复制'
          ),
          h('button', { class: 'btn', onclick: UI.closeModal }, '关闭')
        )
      ),
      { cls: 'wide' }
    );
    setTimeout(() => ta.select(), 50);
  };

  UI.showImport = function () {
    const ta = h('textarea', { class: 'save-code', placeholder: '把导出的存档文字粘贴到这里' });
    modal(
      h(
        'div',
        null,
        h('h2', null, '导入存档'),
        h('p', { class: 'hint warn' }, '导入会覆盖当前的进度。'),
        ta,
        h(
          'div',
          { class: 'modal-buttons' },
          h('button', { class: 'btn', onclick: UI.closeModal }, '取消'),
          h(
            'button',
            {
              class: 'btn primary',
              onclick: () => {
                const save = TD.saveStore.importCode(ta.value);
                if (!save) {
                  sfx('error');
                  UI.toast('存档文字不正确，请检查是否完整复制');
                  return;
                }
                game.save = save;
                game.persist();
                UI.closeModal();
                UI.toast('存档已导入');
                UI.showTitle();
              },
            },
            '导入'
          )
        )
      ),
      { cls: 'wide' }
    );
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

  UI.showMap = function (chapterId) {
    clear();
    game.renderer.mood = 'idle';
    const s = game.save;
    // 默认显示最新解锁关卡所在的章节
    if (!chapterId) {
      const all = Object.keys(D.levels).map(Number).sort((a, b) => a - b);
      const latest = all.filter((n) => P.isUnlocked(s, n)).pop() || 1;
      chapterId = D.chapterOf(latest).id;
    }
    const ch = D.chapters.find((c) => c.id === chapterId) || D.chapters[0];
    UI.mapChapter = ch.id;
    TD.music.play(ch.id, 'calm');
    game.renderer.setChapter(ch);
    const chapterTabs = D.chapters.map((c) => {
      const open = P.isUnlocked(s, c.levels[0]);
      return h(
        'button',
        {
          class: 'btn small chapter-tab' + (c.id === ch.id ? ' primary' : ''),
          disabled: open ? null : true,
          title: open ? c.name : `通关第 ${c.levels[0] - 1} 关后开放`,
          onclick: () => (sfx('click'), UI.showMap(c.id)),
        },
        open ? '一二三四五'[c.id - 1] : '🔒'
      );
    });
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
        h('span', { class: 'node-index' }, n),
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
    const lastLevel = ch.levels[ch.levels.length - 1];
    const nextCh = D.chapters.find((c) => c.id === ch.id + 1);
    let note = null;
    if (P.isCleared(s, lastLevel))
      note = nextCh
        ? h('div', { class: 'map-note' }, `恭喜通关「${ch.name}」！新的章节「${nextCh.name}」已经开放。`, h('button', { class: 'btn small primary', onclick: () => UI.showMap(nextCh.id) }, '前往 ›'))
        : h('div', { class: 'map-note' }, `恭喜通关「${ch.name}」！下一章正在建设中……可以回头挑战三星，或者收集金币购买传说装备。`);
    screenEl = h(
      'div',
      { class: 'screen map-screen' + (ch.theme.desert ? ' desert' : ch.theme.swamp ? ' swamp' : ch.theme.snow ? ' snow' : ch.theme.lava ? ' lava' : '') },
      path,
      h(
        'div',
        { class: 'topbar' },
        h('button', { class: 'btn small', onclick: () => (sfx('click'), UI.showTitle()) }, '‹ 标题'),
        h('div', { class: 'chapter-tabs' }, chapterTabs),
        h('div', { class: 'chapter-title' }, `第${'一二三四五'[ch.id - 1]}章 · ${ch.name}`, h('span', { class: 'chapter-stars' }, ` ★ ${totalStars}/${ch.levels.length * 3}`)),
        h('div', { class: 'power' }, '战力 ', h('b', null, P.power(s))),
        currencyBar(),
        h('button', { class: 'btn small', title: '铛铛的衣柜', onclick: () => (sfx('click'), UI.showWardrobe()) }, '👕'),
        h('button', { class: 'btn small', title: '守城日记', onclick: () => (sfx('click'), UI.showDiary()) }, '📔'),
        h('button', { class: 'btn small', title: '怪物图鉴', onclick: () => (sfx('click'), UI.showBestiary()) }, '📖'),
        h('button', { class: 'btn small', title: '成就', onclick: () => (sfx('click'), UI.showAchievements()) }, '🏆'),
        h('button', { class: 'btn small primary', onclick: () => (sfx('click'), UI.showShop(null, 'loadout')) }, '商店 / 配装')
      ),
      nodes,
      note,
      h(
        'div',
        { class: 'mode-buttons' },
        TD.modes.dailyUnlocked(s) ? h('button', { class: 'btn small', onclick: () => (sfx('click'), UI.showDaily()) }, TD.modes.dailyInfo(s).done ? '📅 每日挑战 ✔' : '📅 每日挑战') : null,
        TD.modes.endlessUnlocked(s) ? h('button', { class: 'btn small', onclick: () => (sfx('click'), UI.showEndless()) }, `♾ 无尽模式${(s.endless || {}).best ? ' · 纪录 ' + s.endless.best : ''}`) : null
      )
    );
    root.appendChild(screenEl);
    // 章节开场（设计书 28.3）：第一次打开、且该章第一关还没通关
    if (!P.isCleared(s, ch.levels[0])) UI.maybeStory('ch' + ch.id);
  };

  // ================= 守城日记（设计书 28） =================
  function speakerInfo(id) {
    const sp = D.speakers[id];
    if (sp) return { name: sp.name, img: () => (sp.emoji ? h('div', { class: 'story-emoji' }, sp.emoji) : TD.sprites.heroPortrait(96)) };
    const def = D.monsters[id];
    return { name: def ? def.name : id, img: () => TD.sprites.portrait(id, 96) };
  }

  // 播放一段对话：点击推进（打字中点击 = 显示整句），"跳过"直接结束
  UI.playStory = function (key, onDone, opts) {
    opts = opts || {};
    const sc = D.story[key];
    if (!sc) return onDone && onDone();
    let i = 0;
    let shown = 0;
    let timer = null;
    let finished = false;
    const avatar = h('div', { class: 'story-avatar' });
    const nameEl = h('div', { class: 'story-name' });
    const textEl = h('div', { class: 'story-text' });
    const nextEl = h('div', { class: 'story-next' }, '▼');
    const end = (read) => {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      el.remove();
      if (!opts.replay || read) UI.announce(P.markStory(game.save, key, read));
      game.persist();
      onDone && onDone();
    };
    const show = () => {
      const [who, text] = sc.lines[i];
      const sp = speakerInfo(who);
      avatar.innerHTML = '';
      avatar.appendChild(sp.img());
      avatar.className = 'story-avatar' + (who === 'dang' ? ' hero' : '');
      nameEl.textContent = sp.name;
      shown = 0;
      textEl.textContent = '';
      nextEl.classList.add('hidden');
      clearInterval(timer);
      timer = setInterval(() => {
        shown++;
        textEl.textContent = text.slice(0, shown);
        if (shown >= text.length) {
          clearInterval(timer);
          nextEl.classList.remove('hidden');
        }
      }, 38);
      sfx('click');
    };
    const advance = () => {
      const text = sc.lines[i][1];
      if (shown < text.length) {
        shown = text.length;
        clearInterval(timer);
        textEl.textContent = text;
        nextEl.classList.remove('hidden');
        return;
      }
      i++;
      if (i >= sc.lines.length) end(true);
      else show();
    };
    const el = h(
      'div',
      { class: 'story-overlay', onclick: advance },
      h('div', { class: 'story-title' }, key.startsWith('ch') ? `第${'一二三四五'[+key.slice(2) - 1]}章 · ${sc.title}` : sc.title),
      h('div', { class: 'story-box' }, avatar, h('div', { class: 'story-main' }, nameEl, textEl), nextEl),
      h('button', { class: 'btn small story-skip', onclick: (e) => (e.stopPropagation(), sfx('click'), end(false)) }, '跳过 ›')
    );
    root.appendChild(el);
    show();
  };

  // 没播过的段落才播；否则直接继续
  UI.maybeStory = function (key, onDone) {
    if (P.storyDue(game.save, key)) UI.playStory(key, onDone);
    else onDone && onDone();
  };

  // 日记本：按顺序列出所有段落，已解锁的可以重看
  UI.showDiary = function () {
    const s = game.save;
    const order = D.storyOrder;
    const read = order.filter((k) => (s.story || {})[k] === 'read').length;
    const items = order.map((key) => {
      const sc = D.story[key];
      const open = P.storyUnlocked(s, key);
      const kind = key.startsWith('ch') ? '章节' : key.startsWith('pre') ? '战前' : '战后';
      const state = (s.story || {})[key];
      return h(
        'div',
        { class: 'diary-item' + (open ? '' : ' locked') + (key.startsWith('ch') ? ' chapter' : '') },
        h('span', { class: 'diary-kind' }, kind),
        h('div', { class: 'diary-main' }, h('b', null, open ? sc.title : '？？？'), open && sc.diary ? h('p', null, '✎ ' + sc.diary) : null),
        open
          ? h(
              'button',
              { class: 'btn small' + (state === 'read' ? '' : ' primary'), onclick: () => (sfx('click'), UI.closeModal(), UI.playStory(key, () => UI.showDiary(), { replay: true })) },
              state === 'read' ? '重看' : '阅读'
            )
          : null
      );
    });
    modal(
      h('div', { class: 'diary' }, h('div', { class: 'preview-head' }, h('h2', null, '📔 铛铛的守城日记'), h('span', { class: 'tag' }, `已读 ${read} / ${order.length}`)), h('div', { class: 'diary-list' }, items), h('div', { class: 'modal-buttons' }, h('button', { class: 'btn primary', onclick: UI.closeModal }, '合上日记'))),
      { closeOnBack: true, cls: 'wide' }
    );
  };

  // ================= 铛铛的衣柜（设计书 30） =================
  UI.showWardrobe = function () {
    const s = game.save;
    const cards = D.outfits.map((o) => {
      const open = P.outfitUnlocked(s, o.id);
      const on = (s.outfit || 'classic') === o.id;
      const img = TD.sprites.heroPortrait(110, on ? 'win' : 'idle', o.id);
      return h(
        'button',
        {
          class: 'outfit-card' + (open ? '' : ' locked') + (on ? ' on' : ''),
          onclick: () => {
            if (!open) return sfx('error'), UI.toast(`解锁条件：${o.unlock}`);
            sfx('click');
            P.setOutfit(s, o.id);
            game.persist();
            UI.showWardrobe();
          },
        },
        h('div', { class: 'outfit-img' }, img),
        h('b', null, o.name),
        h('span', null, open ? o.desc : '🔒 ' + o.unlock),
        on ? h('em', null, '穿着') : null
      );
    });
    const n = D.outfits.filter((o) => P.outfitUnlocked(s, o.id)).length;
    modal(
      h('div', { class: 'wardrobe' }, h('div', { class: 'preview-head' }, h('h2', null, '👕 铛铛的衣柜'), h('span', { class: 'tag' }, `${n} / ${D.outfits.length}`)), h('div', { class: 'outfit-grid' }, cards), h('div', { class: 'modal-buttons' }, h('button', { class: 'btn primary', onclick: UI.closeModal }, '好了'))),
      { closeOnBack: true, cls: 'wide' }
    );
  };

  // 进入关卡：Boss 关第一次挑战前先播战前对话
  UI.beginLevel = function (n) {
    UI.closeModal();
    UI.maybeStory('pre' + n, () => game.startBattle(n));
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

  // 关卡预览里的"推荐武器"（设计书 6.4）：没解锁时给出入口
  function weaponAdvice(n) {
    const s = game.save;
    const adv = P.idealWeapon(n);
    if (!adv) return null;
    const w = D.weapons[adv.id];
    const owned = s.weapons[adv.id] && s.weapons[adv.id].owned;
    // 已拥有但等级太低：提示去升级
    let weak = false;
    if (owned) {
      let best = 0;
      for (const id of Object.keys(D.weapons)) if (s.weapons[id].owned) best = Math.max(best, P.weaponScore(s, id, n));
      weak = P.weaponScore(s, adv.id, n) < best * 0.75;
    }
    return h(
      'div',
      { class: 'advice' + (owned && !weak ? '' : ' missing') },
      TD.sprites.iconCanvas(adv.id, 28),
      h('span', null, h('b', null, `推荐武器：${w.name}`), `（${adv.reason}）`),
      owned && weak
        ? h('button', { class: 'btn small', onclick: () => (sfx('click'), UI.showShop(n, 'weapons')) }, `等级偏低，去升级`)
        : owned
        ? h('span', { class: 'equipped' }, '✔ 已拥有')
        : UI.tabUnlocked(s, 'weapons')
          ? h('button', { class: 'btn small primary', onclick: () => (sfx('click'), UI.showShop(n, 'weapons')) }, `去解锁（${P.costText(w.cost)}）`)
          : null
    );
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
      weaponAdvice(n),
      P.rally(s, n) > 0 ? h('div', { class: 'advice rally' }, h('span', null, h('b', null, `🎺 援军鼓舞 +${Math.round(P.rally(s, n) * 100)}%`), `：已连续失败 ${rec.streak} 次，本次攻击和城墙血量提高，通关后清零`)) : null,
      h('div', { class: 'tip' }, '💡 ', lvl.tip),
      h(
        'div',
        { class: 'modal-buttons' },
        h('button', { class: 'btn', onclick: UI.closeModal }, '返回'),
        h('button', { class: 'btn', onclick: () => (sfx('click'), UI.showShop(n, 'loadout')) }, '商店 / 配装'),
        h('button', { class: 'btn primary big', onclick: () => (sfx('click'), UI.beginLevel(n)) }, '开始战斗')
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

  // 商店页签随进度解锁（设计书 6.5）：通关第 N 关后出现
  const TAB_UNLOCK = { loadout: 0, attrs: 0, wall: 1, items: 2, skills: 2, equip: 3, weapons: 4, exchange: 5 };
  UI.tabUnlocked = (save, id) => P.highestCleared(save) >= (TAB_UNLOCK[id] || 0);

  UI.showShop = function (levelNo, tab) {
    clear();
    if (tab && !UI.tabUnlocked(game.save, tab)) tab = 'attrs';
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
    s.seenTabs = s.seenTabs || {};
    s.seenTabs[st.tab] = true;
    const tabs = TABS.filter(([id]) => UI.tabUnlocked(s, id)).map(([id, name]) =>
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
        name,
        s.seenTabs[id] ? null : h('span', { class: 'new-badge' }, '新')
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
        h('button', { class: 'btn small', onclick: () => (sfx('click'), UI.showMap(st.levelNo ? D.chapterOf(st.levelNo).id : UI.mapChapter), st.levelNo && UI.showPreview(st.levelNo)) }, '‹ 返回'),
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
            UI.announce(P.checkAchievements(s));
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
    const firstVisit = !s.stats.shopGuided;
    if (firstVisit) el.append(h('div', { class: 'guide' }, '👉 升级「攻击力」，铛铛就能更快消灭怪物！'));
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
          buyBtn(P.attrCost(s, key), () => {
            const ok = P.buyAttr(s, key);
            if (ok) s.stats.shopGuided = true;
            return ok;
          }, '升级'),
          { cls: firstVisit && key === 'atk' ? 'glow' : '' }
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
          w.ascend && !ws.asc
            ? P.canAscend(s, id)
              ? buyBtn(D.weaponAscend.cost, () => P.ascendWeapon(s, id), '进阶')
              : h('span', { class: 'hint' }, `Lv${D.weaponAscend.minLv} 可进阶`)
            : null,
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
      const ascLine = w.ascend ? h('div', { class: ws.asc ? 'asc on' : 'asc' }, `${ws.asc ? '✦ 已进阶' : '进阶后'}「${w.ascend.name}」：${w.ascend.desc}`) : null;
      el.append(card(h('span', { class: 'with-icon' }, TD.sprites.iconCanvas(id, 30), ws.asc ? w.ascend.name : w.name), ws.owned ? `Lv.${ws.lv}/${D.weaponUpgrade.max}` : '未解锁', h('span', null, w.desc, h('span', { class: 'good' }, ' 擅长：' + w.good), ascLine), right));
    }
  }

  function shopSkills(el) {
    const s = game.save;
    el.append(h('div', { class: 'section-title' }, '主动技能（战斗中点击释放）'));
    for (const id of Object.keys(D.activeSkills)) {
      const k = D.activeSkills[id];
      const lv = P.skillLevel(s, id);
      let desc = k.desc;
      let right;
      if (!lv) right = buyBtn(k.cost, () => P.buyActive(s, id), '解锁');
      else if (lv < D.skillMaxLv) {
        desc = h('span', null, `当前：${k.tierDesc[lv - 1]} → `, h('b', { class: 'up' }, `Lv${lv + 1}：${k.tierDesc[lv]}`));
        right = buyBtn(P.skillUpgradeCost(s, id), () => P.upgradeSkill(s, id), '升阶');
      } else {
        desc = `满级：${k.tierDesc[lv - 1]}`;
        right = h('span', { class: 'equipped' }, '★ 满级');
      }
      el.append(card(h('span', { class: 'with-icon' }, TD.sprites.iconCanvas(id, 30), k.name), lv ? `Lv${lv} · 冷却 ${k.cd} 秒` : `冷却 ${k.cd} 秒`, desc, right));
    }
    el.append(h('div', { class: 'hint' }, '技能 Lv2 用银币升阶，Lv3 用金币升阶并带来质变效果。'));
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
            P.weaponDef(s, id).name,
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
        sk.lv > 1 ? h('span', { class: 'lv-badge' }, 'Lv' + sk.lv) : null,
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
    else if (b.level.endless) waveText = `第 ${b.waveIndex + 1} 波 · 纪录 ${(game.save.endless || {}).best || 0}`;
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
      const frozen = b.time < (sk.frozenUntil || 0);
      btn.classList.toggle('frozen', frozen);
      if (frozen) {
        cd.style.background = 'rgba(160,220,255,0.75)';
        cd.textContent = '❄' + Math.ceil(sk.frozenUntil - b.time);
      } else if (sk.cd > 0) {
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

  // ================= 无尽模式与每日挑战（设计书 25 章） =================
  UI.startEndless = function () {
    const s = game.save;
    const levelDef = TD.modes.buildEndless(s, (Date.now() & 0xffffff) + 99);
    game.startBattle('endless', { kind: 'endless', levelDef, stage: levelDef.stage });
  };

  UI.showEndless = function () {
    const s = game.save;
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

  UI.showDaily = function () {
    const s = game.save;
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
          h('button', { class: 'btn primary big', onclick: () => (UI.closeModal(), game.startBattle(info.level, { kind: 'daily', levelDef: TD.modes.buildDaily(info), stage: info.level, info })) }, '开始挑战')
        )
      ),
      { closeOnBack: true, cls: 'wide' }
    );
  };

  UI.showModeResult = function (battle, reward) {
    const res = battle.result;
    const endless = battle.mode.kind === 'endless';
    const title = endless ? (reward.waves > 0 ? `坚持了 ${reward.waves} 波！` : '城墙被攻破了…') : res.win ? '挑战成功！' : '挑战失败…';
    const rows = [h('div', { class: 'reward-row total' }, h('span', null, '获得'), h('b', null, reward.copper, ' ', coinIcon('copper'), reward.silver ? [' ', reward.silver, ' ', coinIcon('silver')] : null))];
    const notes = reward.notes.map((x) => h('div', { class: 'note' }, '✦ ' + x));
    for (const a of reward.achievements || []) notes.push(h('div', { class: 'note achieve' }, `🏆 达成成就「${a.name}」：${a.desc}（+${P.costText(a.reward)}）`));
    modal(
      h(
        'div',
        { class: 'result ' + (endless || res.win ? 'win' : 'lose') },
        h('h2', { class: 'result-title' }, title),
        endless ? h('div', { class: 'hint' }, `个人纪录：${(game.save.endless || {}).best} 波 · 击败 ${res.kills} 只`) : h('div', { class: 'hint' }, `击败 ${res.kills} 只`),
        h('div', { class: 'reward-box' }, rows),
        notes,
        h(
          'div',
          { class: 'modal-buttons' },
          h('button', { class: 'btn', onclick: () => (UI.closeModal(), game.battle = null, game.renderer.battle = null, UI.showMap()) }, '地图'),
          h('button', { class: 'btn', onclick: () => (UI.closeModal(), game.battle = null, game.renderer.battle = null, UI.showShop(null, 'attrs')) }, '去商店'),
          h('button', { class: 'btn primary', onclick: () => (UI.closeModal(), endless ? UI.startEndless() : game.startBattle(battle.levelNo, battle.mode)) }, '再来一次')
        )
      ),
      { cls: 'result-modal' }
    );
  };

  // ================= 成就与图鉴（设计书 24 章） =================
  UI.announce = function (list) {
    (list || []).forEach((a, i) => setTimeout(() => UI.toast(`🏆 达成成就「${a.name}」+${P.costText(a.reward)}`, 'achieve', 2600), i * 900));
  };

  UI.showAchievements = function () {
    const s = game.save;
    const all = D.achievements;
    const done = all.filter((a) => (s.achievements || {})[a.id]).length;
    const cards = all.map((a) => {
      const ok = (s.achievements || {})[a.id];
      return h('div', { class: 'ach' + (ok ? ' done' : '') }, h('div', { class: 'ach-icon' }, ok ? '🏆' : '🔒'), h('div', { class: 'ach-main' }, h('b', null, a.name), h('span', null, a.desc)), h('div', { class: 'ach-reward' }, P.costText(a.reward)));
    });
    modal(
      h(
        'div',
        null,
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
    const s = game.save;
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

  // ================= 新敌人登场（设计书 12.6） =================
  UI.showIntro = function (type, onClose) {
    const def = D.monsters[type];
    const img = TD.sprites.portrait(type, 120);
    img.className = 'intro-portrait';
    const tags = D.monsterTags(def).map((x) => h('span', { class: 'tag' + (def.boss ? ' boss' : '') }, x));
    const close = () => {
      UI.closeModal();
      onClose();
    };
    modal(
      h(
        'div',
        { class: 'intro' },
        h('div', { class: 'intro-head' }, def.boss ? '⚠ Boss 登场！' : '新敌人登场！'),
        h('div', { class: 'intro-body' }, img, h('div', null, h('h2', null, def.name), h('div', { class: 'intro-tags' }, tags), h('p', null, def.desc))),
        h('div', { class: 'modal-buttons' }, h('button', { class: 'btn primary', onclick: close, id: 'intro-ok' }, '知道了（空格）'))
      ),
      { cls: 'intro-modal' }
    );
    UI.introClose = close;
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
        h('p', null, b.mode ? b.level.name : `第 ${b.levelNo} 关 · ${b.level.name}`),
        h(
          'div',
          { class: 'modal-buttons col' },
          h('button', { class: 'btn primary', onclick: () => game.togglePause() }, '继续战斗'),
          h('button', { class: 'btn', onclick: () => (UI.closeModal(), game.restartBattle()) }, '重新开始'),
          h('button', { class: 'btn', onclick: () => UI.showHelp() }, '玩法说明'),
          h('button', { class: 'btn danger', onclick: () => game.quitBattle() }, '放弃本关')
        )
      )
    );
  };

  // ================= 结局演出（设计书 23.6） =================
  UI.showEnding = function (onDone) {
    clear();
    const W = C.width;
    const H = C.height;
    const cv = h('canvas', { class: 'ending-canvas', width: W, height: H });
    const ctx = cv.getContext('2d');
    const textBox = h('div', { class: 'ending-text' });
    const credits = h(
      'div',
      { class: 'ending-credits hidden' },
      h('h2', null, '守城英雄'),
      h('p', null, '小卫兵铛铛的守城日记'),
      h('h3', null, '游戏设计 · 程序 · 美术 · 音效'),
      h('p', null, 'Claude（与你一起）'),
      h('h3', null, '出品'),
      h('p', null, 'linshangsheng'),
      h('h3', null, '你的守城记录'),
      h('p', null, `战斗 ${game.save.stats.battles} 次 · 胜利 ${game.save.stats.wins} 次 · 击败怪物 ${game.save.stats.kills} 只`),
      h('p', null, `获得星星 ${Object.values(game.save.levels).reduce((a, r) => a + (r.stars || 0), 0)} / 150`),
      h('p', { class: 'thanks' }, '谢谢你守住了王国！'),
      h('button', { class: 'btn primary big', onclick: () => (stop(), onDone && onDone()) }, '回到地图')
    );
    screenEl = h('div', { class: 'screen ending' }, cv, textBox, credits, h('button', { class: 'btn small ending-skip', onclick: () => (stop(), onDone && onDone()) }, '跳过 ›'));
    root.appendChild(screenEl);
    const lines = [
      [1.0, '墨墨"噗"的一声，缩回了一个小团子……'],
      [4.5, '铛铛跑过去，把它抱了起来。头盔"当"地响了一声。'],
      [8.0, '裂隙慢慢合上了，天空重新变得湛蓝。'],
      [11.5, '王国最小的守城卫兵，守住了最大的危机。'],
    ];
    let t0 = null;
    let raf = 0;
    let shown = 0;
    function stop() {
      cancelAnimationFrame(raf);
    }
    function frame(ts) {
      if (t0 === null) t0 = ts;
      const t = (ts - t0) / 1000;
      // 天空：暗红 → 天蓝
      const k = TD.util.clamp((t - 7) / 3, 0, 1);
      const mix = (a, b) => Math.round(a + (b - a) * k);
      ctx.fillStyle = `rgb(${mix(60, 159)},${mix(24, 220)},${mix(40, 255)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = `rgb(${mix(70, 124)},${mix(52, 191)},${mix(56, 94)})`;
      ctx.fillRect(0, H * 0.68, W, H * 0.32);
      // 裂隙
      const rift = Math.max(0, 1 - Math.max(0, t - 7) / 3);
      if (rift > 0) {
        ctx.save();
        ctx.globalAlpha = rift;
        ctx.strokeStyle = '#c58cff';
        ctx.lineWidth = 8 * rift + 2;
        ctx.beginPath();
        ctx.moveTo(W * 0.72, 60);
        for (let i = 1; i <= 8; i++) ctx.lineTo(W * 0.72 + (i % 2 ? 30 : -20) * rift, 60 + i * 45);
        ctx.stroke();
        ctx.restore();
      }
      if (k > 0.5) {
        ctx.save();
        ctx.globalAlpha = (k - 0.5) * 2;
        for (let i = 0; i < 3; i++) {
          const x = ((t * 15 + i * 420) % (W + 200)) - 100;
          TD.sprites.ellipse(ctx, x, 80 + i * 40, 60, 20, '#fff');
        }
        ctx.restore();
      }
      // 墨墨：先是大团子缩小，然后被抱起
      const momoX = W * 0.62;
      const groundY = H * 0.72;
      const shrink = TD.util.clamp(t / 2, 0, 1);
      const momoSize = 48 * (1 - shrink * 0.65);
      // 铛铛跑过去
      const run = TD.util.clamp((t - 3.5) / 2, 0, 1);
      const heroX = W * 0.25 + (momoX - 60 - W * 0.25) * run;
      const hugging = t > 5.6;
      if (!hugging) TD.sprites.monster(ctx, 'inkBoss', momoX, groundY, momoSize, t, { ai: {} });
      TD.sprites.hero(ctx, heroX, groundY, { t, weapon: 'bow', aimAngle: 0, mood: t > 6 ? 'win' : 'focus', critAge: hugging && t < 6 ? t - 5.6 : 9 });
      if (hugging) TD.sprites.monster(ctx, 'inkBoss', heroX + 26, groundY - 40 + Math.sin(t * 3) * 2, 17, t, { ai: {} });
      if (hugging) {
        ctx.fillStyle = '#ff7b9c';
        for (let i = 0; i < 3; i++) {
          const hy = groundY - 120 - ((t * 30 + i * 25) % 80);
          ctx.globalAlpha = 0.8;
          ctx.font = '22px sans-serif';
          ctx.fillText('♥', heroX + 10 + i * 18, hy);
        }
        ctx.globalAlpha = 1;
      }
      // 文字
      while (shown < lines.length && t >= lines[shown][0]) {
        textBox.appendChild(h('p', { class: 'ending-line' }, lines[shown][1]));
        shown++;
      }
      if (t > 15) credits.classList.remove('hidden');
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    TD.audio.play('win');
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
    const notes = reward.notes.filter((x) => !x.includes('失败')).map((x) => h('div', { class: 'note' + (x.startsWith('援军') ? ' rally' : '') }, (x.startsWith('援军') ? '🎺 ' : '✦ ') + x));
    if (res.supplies && res.supplies.length) notes.push(h('div', { class: 'note' }, '📦 本关补给：' + res.supplies.map((x) => D.supplies[x].name).join('、')));
    const unlocks = reward.unlocks.map((x) => h('div', { class: 'note unlock' }, '🔓 ' + x));
    for (const a of reward.achievements || []) unlocks.push(h('div', { class: 'note achieve' }, `🏆 达成成就「${a.name}」：${a.desc}（+${P.costText(a.reward)}）`));
    let tips = null;
    if (!win) {
      const sug = P.suggestions(game.save, n);
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
        h('button', { class: 'btn', onclick: () => (UI.closeModal(), UI.showMap(D.chapterOf(n).id)) }, '地图'),
        h('button', { class: 'btn' + (!win && game.save.stats.wins < 3 ? ' primary pulse' : ''), onclick: () => (UI.closeModal(), UI.showShop(win && hasNext ? n + 1 : n, win ? 'loadout' : 'attrs')) }, '去商店'),
        !win || !hasNext ? h('button', { class: 'btn' + (win ? '' : ' primary'), onclick: () => (UI.closeModal(), game.startBattle(n)) }, '再来一次') : null,
        hasNext ? h('button', { class: 'btn primary', onclick: () => (UI.closeModal(), UI.showMap(D.chapterOf(n + 1).id), UI.showPreview(n + 1)) }, '下一关 ›') : null
      )
    );
    modal(body, { cls: 'result-modal' });
  };
})((globalThis.TD = globalThis.TD || {}));
