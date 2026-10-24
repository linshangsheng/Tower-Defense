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
    for (const kid of kids.flat(Infinity)) {
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

  // 给拆出去的界面文件（ui-story.js、ui-collection.js）共用的内部工具
  UI._ = {
    h,
    modal,
    sfx,
    clear,
    coinIcon,
    costEl,
    starsEl,
    currencyBar,
    get game() {
      return game;
    },
    get root() {
      return root;
    },
    setScreen(el) {
      screenEl = el;
    },
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
    // 战斗开场的关卡提示不要盖在弹窗上（设计书 50）
    for (const t of root.querySelectorAll('.toast.tip')) t.remove();
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
    for (const k of ['copper', 'silver', 'gold', 'diamond']) if (cost[k]) parts.push(h('span', { class: 'cost-part' }, coinIcon(k), cost[k]));
    return h('span', { class: 'cost' }, parts);
  }

  function currencyBar() {
    const s = game.save;
    return h(
      'div',
      { class: 'currency' },
      h('span', { title: '铜币' }, coinIcon('copper'), s.copper),
      h('span', { title: '银币' }, coinIcon('silver'), s.silver),
      h('span', { title: '金币' }, coinIcon('gold'), s.gold),
      h('span', { title: '钻石（只能在九层妖塔里获得）', class: 'dim-currency' }, coinIcon('diamond'), s.diamond || 0)
    );
  }

  function starsEl(n, max) {
    max = max || 3;
    const out = [];
    for (let i = 0; i < max; i++) out.push(h('span', { class: 'star' + (i < n ? ' on' : '') }, '★'));
    return h('span', { class: 'stars' }, out);
  }

  // 全屏（设计书 66.2）：浏览器要求在用户操作里调用；失败（不支持 / 被拒绝）就算了
  UI.setFullscreen = function (on) {
    try {
      const d = globalThis.document;
      if (!d || !d.documentElement) return;
      if (on && !d.fullscreenElement && d.documentElement.requestFullscreen) {
        const p = d.documentElement.requestFullscreen({ navigationUI: 'hide' });
        if (p && p.catch) p.catch(() => {});
      } else if (!on && d.fullscreenElement && d.exitFullscreen) {
        const p = d.exitFullscreen();
        if (p && p.catch) p.catch(() => {});
      }
    } catch (e) {
      /* 不支持就保持窗口模式 */
    }
  };

  // ================= 标题 =================
  UI.showTitle = function () {
    clear();
    TD.music.play(TD.music.titleTheme(), 'title');
    const bgm = TD.music.THEMES[TD.music.want && TD.music.want.theme];
    game.renderer.mood = 'idle';
    const has = P.highestCleared(game.save) > 0 || game.save.copper > 0;
    // 背景用玩家当前所在章节的战场（设计书 57.4）
    const nextLv = Math.min(P.highestCleared(game.save) + 1, Object.keys(D.levels).length);
    game.renderer.setChapter(D.chapterOf(nextLv));
    screenEl = h(
      'div',
      { class: 'screen title-screen' },
      h(
        'div',
        { class: 'title-logo' },
        TD.logo ? TD.logo.liveEmblem(220) : null,
        h('div', { class: 'title-main' }, '城头射手')
      ),
      h(
        'div',
        { class: 'title-buttons' },
        h('button', { class: 'btn big primary', onclick: () => (sfx('click'), has || game.save.settings.diffChosen ? UI.showMap() : UI.chooseDifficulty(() => UI.showMap())) }, has ? '继续游戏' : '开始游戏'),
        h('div', { class: 'btn-row' }, h('button', { class: 'btn', style: { flex: 1 }, onclick: () => (sfx('click'), UI.showBestiary()) }, '图鉴'), h('button', { class: 'btn', style: { flex: 1 }, onclick: () => (sfx('click'), UI.showAchievements()) }, '成就')),
        h('button', { class: 'btn', onclick: () => (sfx('click'), UI.showSettings()) }, '设置'),
        h('button', { class: 'btn', onclick: () => (sfx('click'), UI.showHelp()) }, '玩法说明'),
        h('button', { class: 'btn', onclick: () => (sfx('click'), UI.showLanguage()) }, `🌐 Language · ${TD.i18n.languages.find((l) => l.code === TD.i18n.lang).native}`),
        h('button', { class: 'btn quit', onclick: () => (sfx('click'), UI.quitGame()) }, '退出游戏')
      ),
      h('div', { class: 'title-foot' }, `网页原型 ${C.version} · ${D.chapters.length} 章 ${Object.keys(D.levels).length} 关`, bgm && TD.music.enabled ? h('div', { class: 'title-bgm' }, '♪ ', h('span', null, bgm.name)) : null)
    );
    root.appendChild(screenEl);
  };

  // 语言设置（设计书 83）：17 种语言，默认英语。点一个就切换，马上重画当前页面
  UI.showLanguage = function (onChanged) {
    const I = TD.i18n;
    const cur = I.lang;
    const btns = I.languages.map((l) =>
      h(
        'button',
        {
          class: 'btn lang-btn' + (l.code === cur ? ' primary' : ''),
          lang: l.code,
          onclick: () => {
            sfx('click');
            I.setLang(l.code, (ok) => {
              if (!ok) return UI.toast('Failed to load language');
              UI.closeModal();
              UI.showTitle();
              onChanged && onChanged();
            });
          },
        },
        h('b', null, l.native),
        l.native !== l.english ? h('span', null, l.english) : null
      )
    );
    modal(h('div', null, h('h2', null, '🌐 Language'), h('div', { class: 'lang-grid' }, btns), h('div', { class: 'modal-buttons' }, h('button', { class: 'btn', onclick: UI.closeModal }, 'OK'))), { closeOnBack: true });
  };

  // 退出游戏（v0.73）：存好档、停掉音乐、退出全屏，然后关闭窗口。
  // 用启动图标（独立窗口）打开的游戏能直接关掉；在普通浏览器标签页里网页没有权限关自己，只能提示玩家关标签页。
  UI.quitGame = function () {
    UI.confirm('退出游戏吗？进度已经自动保存。', () => {
      game.persist();
      try {
        TD.music.stop && TD.music.stop();
      } catch (e) {}
      const d = document;
      if (d.fullscreenElement && d.exitFullscreen) {
        try {
          d.exitFullscreen();
        } catch (e) {}
      }
      window.close();
      // 关得掉的话页面已经没了；还在，说明是普通标签页，网页不能关它
      setTimeout(() => {
        UI.closeModal();
        modal(
          h(
            'div',
            null,
            h('h2', null, '请手动关闭'),
            h('p', { class: 'hint' }, '进度已保存。浏览器不允许网页关闭自己所在的标签页，请直接关闭这个标签页或窗口。（用桌面上的「城头射手」图标打开游戏时，这个按钮可以直接关闭游戏。）'),
            h('div', { class: 'modal-buttons' }, h('button', { class: 'btn primary', onclick: UI.closeModal }, '好的'))
          ),
          { closeOnBack: true }
        );
      }, 400);
    });
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

  // 休息提醒（设计书 40）：战斗累计时间到了，回到地图时提醒
  UI.maybeRest = function () {
    const min = game.save.settings.restMinutes;
    if (!min || (game.playSeconds || 0) < min * 60) return;
    if (document.querySelector('.story-overlay')) return;
    modal(
      h(
        'div',
        { class: 'rest' },
        h('div', { class: 'rest-avatar' }, TD.sprites.heroPortrait(110, 'win', undefined, P.heroId(game.save))),
        h('h2', null, `已经守城 ${min} 分钟啦！`),
        h('p', null, '眨眨眼睛、看看远处，喝口水吧。城墙交给国王爷爷看一会儿。'),
        h(
          'div',
          { class: 'modal-buttons' },
          h('button', { class: 'btn', onclick: () => ((game.playSeconds = 0), UI.closeModal()) }, '再玩一会儿'),
          h('button', { class: 'btn primary', onclick: () => ((game.playSeconds = 0), UI.closeModal(), UI.showTitle()) }, '休息一下')
        )
      ),
      { cls: 'rest-modal' }
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
        h('input', {
          type: 'checkbox',
          checked: s.fullscreen !== false ? true : null,
          onchange: (e) => {
            s.fullscreen = e.target.checked;
            UI.setFullscreen(s.fullscreen);
            game.persist();
          },
        }),
        ' 全屏（打开游戏后第一次点击自动进入）'
      ),
      h(
        'label',
        { class: 'row' },
        h('input', {
          type: 'checkbox',
          checked: s.darkEyes ? true : null,
          onchange: (e) => {
            s.darkEyes = e.target.checked;
            game.persist();
          },
        }),
        ' 暗夜里显示怪物的眼睛（默认关，全黑）'
      ),
      // 音量（设计书 49）
      ...[
        ['sfxVolume', '音效音量', (v) => (TD.audio.setVolume(v / 100), sfx('click'))],
        ['musicVolume', '音乐音量', (v) => TD.music.setVolume(v / 100)],
      ].map(([key, label, apply]) =>
        h(
          'label',
          { class: 'row volume-row' },
          label + ' ',
          h('input', {
            type: 'range',
            min: 0,
            max: 100,
            step: 5,
            value: s[key] !== undefined && s[key] !== null ? s[key] : 100,
            oninput: (e) => (e.target.nextSibling.textContent = e.target.value + '%'),
            onchange: (e) => {
              s[key] = +e.target.value;
              apply(s[key]);
              game.persist();
            },
          }),
          h('span', { class: 'vol-val' }, `${s[key] !== undefined && s[key] !== null ? s[key] : 100}%`)
        )
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
        'label',
        { class: 'row' },
        '画质 ',
        h(
          'select',
          {
            onchange: (e) => {
              s.quality = e.target.value;
              if (TD.quality) TD.quality.setMode(s.quality);
              game.persist();
            },
          },
          [
            ['auto', '自动（卡顿时自动降低特效）'],
            ['high', '高'],
            ['medium', '中'],
            ['low', '低（最流畅）'],
          ].map(([v, t]) => h('option', { value: v, selected: (s.quality || 'auto') === v ? true : null }, t))
        )
      ),
      h(
        'label',
        { class: 'row' },
        '大字模式 ',
        h(
          'select',
          {
            onchange: (e) => {
              s.largeText = e.target.value;
              game.persist();
              game.refit && game.refit();
            },
          },
          [
            ['auto', '自动（手机上开启）'],
            ['on', '开启'],
            ['off', '关闭'],
          ].map(([v, t]) => h('option', { value: v, selected: (s.largeText || 'auto') === v ? true : null }, t))
        )
      ),
      h(
        'label',
        { class: 'row' },
        '休息提醒 ',
        h(
          'select',
          {
            onchange: (e) => {
              s.restMinutes = +e.target.value;
              game.persist();
            },
          },
          [0, 20, 30, 45].map((m) => h('option', { value: m, selected: (s.restMinutes === undefined ? 30 : s.restMinutes) === m ? true : null }, m ? `每玩 ${m} 分钟提醒休息` : '关闭'))
        )
      ),
      h('div', { class: 'hint credits' }, '音乐采样：FluidR3_GM 音色库（Frank Wen），CC BY 3.0，经 gleitz/midi-js-soundfonts 取得'),
      h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: () => UI.showTestLogin() }, P.testMode(game.save) ? '测试（已开启）' : '测试')),
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

  // 测试模式（v1.14）：输入密码后资源拉满、所有关卡随便选
  UI.showTestLogin = function () {
    const input = h('input', { type: 'password', class: 'test-pass', autocomplete: 'off', placeholder: '密码' });
    const msg = h('p', { class: 'hint' }, '输入密码开启测试模式：资源全部拉满，所有关卡都可以直接选。');
    const submit = () => {
      if (!P.enableTestMode(game.save, input.value)) {
        sfx('error');
        msg.textContent = '密码不对';
        input.value = '';
        return;
      }
      game.persist();
      sfx('click');
      UI.toast('测试模式已开启：资源已拉满，所有关卡都可以选');
      UI.closeModal();
      UI.showTitle();
    };
    input.onkeydown = (e) => e.key === 'Enter' && submit();
    modal(
      h(
        'div',
        null,
        h('h2', null, '测试'),
        msg,
        input,
        h('div', { class: 'modal-buttons' }, h('button', { class: 'btn primary', onclick: submit }, '确定'), h('button', { class: 'btn', onclick: () => (UI.closeModal(), UI.showSettings()) }, '返回'))
      ),
      { closeOnBack: true }
    );
    setTimeout(() => input.focus(), 50);
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
        h('li', null, 'Kael站在城墙上自动射击，怪物从右边沿车道走来。城墙血量归零就失败。'),
        h('li', null, '战斗中点击技能按钮（或按 1 / 2 / 3）释放主动技能，按 Q / W / E / R / Z / X / C 使用道具（每种最多带 3 个，用一个少一个，用完一次要等冷却；道具要先在商店买、再装备）。'),
        h('li', null, '冰冻领域、小炸弹、冰冻瓶需要选择车道：点技能后再点一条车道。'),
        h('li', null, '一波怪全部出场后，可以点「提前召唤」立刻叫出下一波，剩余的倒计时秒数会变成铜币奖励。'),
        h('li', null, '空格暂停，F 切换 2 倍速，N 提前召唤，T 切换目标优先级。'),
        h('li', null, '每关结束会获得铜币，银币只有首次通关小 Boss、大 Boss 和精英挑战关才有（也可以去汇兑所用铜币换）。去商店升级属性、解锁武器和技能，再来挑战！'),
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
    TD.music.play(ch.music || ch.id, 'calm');
    game.renderer.setChapter(ch);
    // 章节切换：上一章 / 第 N 章（点开列表）/ 下一章；十章的页签太占横向位置（v0.68）
    const CN = '一二三四五六七八九十';
    const prevCh = D.chapters.find((c) => c.id === ch.id - 1);
    const nextChap = D.chapters.find((c) => c.id === ch.id + 1);
    const nextOpen = !!nextChap && P.isUnlocked(s, nextChap.levels[0]);
    const chapterNav = h(
      'div',
      { class: 'chapter-nav' },
      h('button', { class: 'btn small icon-btn', title: prevCh ? prevCh.name : '', disabled: prevCh ? null : true, onclick: () => (sfx('click'), UI.showMap(prevCh.id)) }, '‹'),
      h('button', { class: 'btn small chapter-pick', title: '选择章节', onclick: () => (sfx('click'), UI.showChapterList(ch.id)) }, `第${D.chapterNo(ch.id)}章 ▾`),
      h('button', { class: 'btn small icon-btn', title: nextChap ? (nextOpen ? nextChap.name : `通关第 ${nextChap.levels[0] - 1} 关后开放`) : '', disabled: nextOpen ? null : true, onclick: () => (sfx('click'), UI.showMap(nextChap.id)) }, '›')
    );
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
        rec.crown ? h('span', { class: 'node-crown', title: '已在挑战难度通关' }, '👑') : null,
        rec.mission ? h('span', { class: 'node-mission', title: '关卡任务已完成' }, '🎯') : null,
        h('span', { class: 'node-name', title: lvl.name }, `${n}. ${lvl.shortName || lvl.name}`)
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
        : h('div', { class: 'map-note' }, `恭喜通关「${ch.name}」！全部 ${D.chapters.length} 章都守住了。可以回头挑战三星和王冠，或者去无尽模式刷新纪录。`);
    screenEl = h(
      'div',
      { class: 'screen map-screen' + (ch.abyss ? ' abyss' : '') + (ch.theme.desert ? ' desert' : ch.theme.swamp ? ' swamp' : ch.theme.snow ? ' snow' : ch.theme.lava ? ' lava' : ch.theme.sky6 ? ' sky6' : ch.theme.sea7 ? ' sea7' : ch.theme.moon8 ? ' moon8' : ch.theme.forge9 ? ' forge9' : ch.theme.void10 ? ' void10' : '') },
      path,
      h(
        'div',
        { class: 'topbar' },
        h('button', { class: 'btn small', onclick: () => (sfx('click'), UI.showTitle()) }, '‹ 标题'),
        chapterNav,
        h('div', { class: 'chapter-title', title: `第${D.chapterNo(ch.id)}章 · ${ch.name}` }, ch.name, h('span', { class: 'chapter-stars' }, ` ★ ${totalStars}/${ch.levels.length * 3}`), P.crowns(s, ch.levels) ? h('span', { class: 'chapter-crowns', title: '本章王冠（挑战难度通关）' }, `👑${P.crowns(s, ch.levels)}`) : null),
        h('div', { class: 'power' }, '战力 ', h('b', null, P.power(s))),
        currencyBar(),
        P.isCleared(s, 5) ? h('button', { class: 'btn small icon-btn', title: '王国小镇', onclick: () => (sfx('click'), UI.showTown()) }, '🏘') : null,
        h('button', { class: 'btn small icon-btn', title: '角色衣柜', onclick: () => (sfx('click'), UI.showWardrobe()) }, '👕'),
        h('button', { class: 'btn small icon-btn', title: '守城日记', onclick: () => (sfx('click'), UI.showDiary()) }, '📔'),
        h('button', { class: 'btn small icon-btn', title: '怪物图鉴', onclick: () => (sfx('click'), UI.showBestiary()) }, '📖'),
        h('button', { class: 'btn small icon-btn', title: '成就', onclick: () => (sfx('click'), UI.showAchievements()) }, '🏆'),
        h('button', { class: 'btn small primary', onclick: () => (sfx('click'), UI.showShop(null, 'loadout')) }, '商店 / 配装')
      ),
      nodes,
      note,
      h(
        'div',
        { class: 'mode-buttons' },
        TD.modes.dailyUnlocked(s) ? h('button', { class: 'btn small', onclick: () => (sfx('click'), UI.showDaily()) }, TD.modes.dailyInfo(s).done ? '📅 每日挑战 ✔' : '📅 每日挑战') : null,
        TD.modes.endlessUnlocked(s) ? h('button', { class: 'btn small', onclick: () => (sfx('click'), UI.showEndless()) }, `♾ 无尽模式${(s.endless || {}).best ? ' · 纪录 ' + s.endless.best : ''}`) : null,
        TD.modes.towerUnlocked(s) ? h('button', { class: 'btn small', onclick: () => (sfx('click'), UI.showTower()) }, `🏯 九层妖塔${(s.tower || {}).best ? ` · ${s.tower.best}/9` : ''}`) : null
      )
    );
    root.appendChild(screenEl);
    // 章节开场（设计书 28.3）：第一次打开、且该章第一关还没通关
    if (!P.isCleared(s, ch.levels[0])) UI.maybeStory('ch' + ch.id);
    UI.maybeRest();
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
        h('span', { class: power >= rp ? 'ok' : 'warn' }, `推荐战力 ${rp} · 你的战力 ${power}`),
        rec.crown ? h('span', { class: 'ok' }, '👑 已在挑战难度通关') : (s.settings.difficulty || 'normal') === 'hard' ? h('span', null, '👑 挑战难度通关可得王冠') : null
      ),
      h('div', { class: 'mon-list' }, mons),
      weaponAdvice(n),
      D.missionFor(n)
        ? h('div', { class: 'advice mission' + (rec.mission ? ' done' : '') }, h('span', null, h('b', null, `🎯 关卡任务：${D.missions[D.missionFor(n)].name}`), `（${D.missions[D.missionFor(n)].desc}）`), h('span', { class: 'equipped' }, rec.mission ? '✔ 已完成' : P.givesSilver(D.levels[n]) ? `首次完成 +${D.missionReward.silver} 银` : `首次完成 +${D.missionReward.copper} 铜`))
        : null,
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

  // 章节列表：十章一目了然，未开放的显示锁
  UI.showChapterList = function (current) {
    const s = game.save;
    const CN = '一二三四五六七八九十';
    const btns = D.chapters.map((c) => {
      const open = P.isUnlocked(s, c.levels[0]);
      const done = c.levels.filter((n) => P.isCleared(s, n)).length;
      return h(
        'button',
        {
          class: 'btn chapter-card' + (c.id === current ? ' primary' : ''),
          disabled: open ? null : true,
          title: open ? c.name : `通关第 ${c.levels[0] - 1} 关后开放`,
          onclick: () => (sfx('click'), UI.closeModal(), UI.showMap(c.id)),
        },
        h('b', null, open ? `第${D.chapterNo(c.id)}章` : '🔒'),
        h('span', null, c.name),
        h('span', { class: 'dim' }, `${done}/${c.levels.length}`)
      );
    });
    modal(h('div', null, h('h2', null, '选择章节'), h('div', { class: 'chapter-grid' }, btns), h('div', { class: 'modal-buttons' }, h('button', { class: 'btn', onclick: UI.closeModal }, '关闭'))), { closeOnBack: true });
  };

  // ================= 商店 / 配装 =================
  const TABS = [
    ['loadout', '配装'],
    ['attrs', '属性'],
    ['skills', '技能'],
    ['equip', '装备'],
    ['wall', '城墙'],
    ['items', '道具'],
    ['exchange', '汇兑所'],
  ];

  // 商店页签随进度解锁（设计书 6.5）：通关第 N 关后出现
  // 左边页签的小图标（设计书 102）
  function tabIcon(id) {
    const S = TD.sprites;
    if (id === 'loadout') return S.gearIconCanvas('armor', '#9ab8f0', 26);
    if (id === 'attrs') return S.iconCanvas('attr_atk', 26);
    if (id === 'skills') return S.iconCanvas('thunder', 26);
    if (id === 'equip') return S.gearIconCanvas('helm', '#b46cff', 26);
    if (id === 'wall') return S.iconCanvas('wall_level', 26);
    if (id === 'items') return S.iconCanvas('bomb', 26);
    return h('span', { class: 'coin-big gold mini' });
  }
  const TAB_UNLOCK = { loadout: 0, attrs: 0, wall: 1, items: 2, skills: 2, equip: 0, weapons: 0, exchange: 5 };
  UI.tabUnlocked = (save, id) => P.highestCleared(save) >= (TAB_UNLOCK[id] || 0);

  UI.showShop = function (levelNo, tab) {
    clear();
    if (tab && !UI.tabUnlocked(game.save, tab)) tab = 'attrs';
    // 武器放进了"装备"页的第一个分类（v0.68）
    const state = { levelNo, tab: tab === 'weapons' ? 'equip' : tab || 'loadout', equipCat: tab === 'weapons' ? 'weapon' : 'weapon', equipTier: 0 };
    UI.shopState = state;
    screenEl = h('div', { class: 'screen shop-screen' });
    root.appendChild(screenEl);
    renderShop();
  };

  function renderShop() {
    const st = UI.shopState;
    const s = game.save;
    // 同一个页签里买东西 / 升级后重画：保持滚动位置；换页签才回到顶部
    const prevContent = screenEl.querySelector('.shop-content');
    const keepScroll = prevContent && st.drawnTab === st.tab ? prevContent.scrollTop : 0;
    st.drawnTab = st.tab;
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
        h('span', { class: 'tab-ico' }, tabIcon(id)),
        h('span', { class: 'tab-name' }, name),
        s.seenTabs[id] ? null : h('span', { class: 'new-badge' }, '新')
      )
    );
    const content = h('div', { class: 'shop-content' });
    ({
      loadout: shopLoadout,
      attrs: shopAttrs,
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
    if (keepScroll) content.scrollTop = keepScroll;
  }
  UI.refreshShop = () => UI.shopState && screenEl && screenEl.classList.contains('shop-screen') && renderShop();

  function statPanel(st) {
    const S = TD.sprites;
    const hid = P.heroId(game.save);
    const ico = (id) => h('span', { class: 'sr-ico' }, S.iconCanvas(id, 20));
    const groups = [
      [
        null,
        [
          ['attr_atk', '攻击力', st.atk.toFixed(1)],
          ['bow', '武器伤害', Math.round(st.weaponMult * 100) + '%'],
          ['attr_aspd', '攻击速度', st.aspd.toFixed(2) + '/秒'],
          ['attr_crit', '暴击率', Math.round(st.crit * 100) + '%'],
          ['attr_critDmg', '暴击伤害', Math.round(st.critDmg * 100) + '%'],
          ['attr_range', '射程', Math.round((st.range / C.fieldWidth) * 100) + '%'],
          ['attr_luck', '幸运', '+' + Math.round(st.luck * 100) + '%'],
        ],
      ],
      [
        null,
        [
          ['wall_level', '城墙血量', st.wallMax],
          ['wall_fortify', '城墙减伤', Math.round(st.wallDr * 100) + '%'],
        ],
      ],
    ];
    return h(
      'div',
      { class: 'stat-panel' },
      h('div', { class: 'sp-head' }, h('div', { class: 'sp-face' }, S.heroPortrait(54, 'idle', undefined, hid)), h('h3', null, `${C.heroes[hid].name}的属性`)),
      groups.map(([, rows]) => h('div', { class: 'sp-group' }, rows.map(([icon, k, v]) => h('div', { class: 'stat-row' }, ico(icon), h('span', { class: 'sr-k' }, k), h('b', null, v))))),
      h('div', { class: 'sp-dps' }, h('span', null, '单体 DPS'), h('b', null, P.estimateDps(st).toFixed(1)))
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

  // 通用卡片（设计书 102）：左边图标徽章（extra.icon，颜色 extra.color），中间标题 / 说明 / 进度条 / 小标签，右边按钮
  //   extra.bar = 0~1 的进度；extra.barText = 进度条上的字；extra.over = 超过基础上限（进度条变金色）；extra.foot = 说明下面的一行小节点
  function pbar(frac, text, over) {
    return h('div', { class: 'pbar' + (over ? ' over' : '') }, h('i', { style: { width: Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%' } }), text ? h('span', null, text) : null);
  }
  function pips(n, max) {
    return h('span', { class: 'pips' }, Array.from({ length: max }, (_, i) => h('i', { class: i < n ? 'on' : '' })));
  }
  function card(title, sub, desc, right, extra) {
    const x = extra || {};
    return h(
      'div',
      { class: 'card ' + (x.cls || ''), style: x.color ? { '--acc': x.color } : null },
      h(
        'div',
        { class: 'card-top' },
        x.icon ? h('div', { class: 'card-ico' }, x.icon) : null,
        h('div', { class: 'card-main' }, h('div', { class: 'card-title' }, title, sub ? h('span', { class: 'card-sub' }, sub) : null), h('div', { class: 'card-desc' }, desc), x.bar != null ? pbar(x.bar, x.barText, x.over) : null, x.foot || null)
      ),
      right ? h('div', { class: 'card-right' }, right) : null
    );
  }

  // 批量升级按钮（设计书 76.2）：+10 / +100 / 最大；等级可以到 999999，一级一级点不现实
  function bulkRow(kind, key) {
    const s = game.save;
    const row = h('div', { class: 'bulk-row' });
    for (const n of [10, 100, Infinity]) {
      const r = P.bulkUpgrade(s, kind, key, n, { dry: true });
      const ok = n === Infinity ? r.count >= 2 : r.count === n;
      row.append(
        h(
          'button',
          {
            class: 'btn small bulk' + (ok ? ' primary' : ''),
            disabled: ok ? null : true,
            title: ok ? `升 ${r.count} 级，一共 ${P.costText(r.cost)}` : n === Infinity ? '钱不够连升 2 级' : `钱不够连升 ${n} 级`,
            onclick: () => {
              const got = P.bulkUpgrade(s, kind, key, n);
              if (got.count) {
                sfx('buy');
                UI.announce(P.checkAchievements(s));
                game.persist();
                renderShop();
              } else sfx('error');
            },
          },
          n === Infinity ? '最大' : `+${n}`
        )
      );
    }
    return row;
  }
  const lvText = (lv) => `Lv.${lv}`;

  function shopAttrs(el) {
    const s = game.save;
    const st = P.heroStats(s);
    const firstVisit = !s.stats.shopGuided;
    if (firstVisit) el.append(h('div', { class: 'guide' }, '👉 升级「攻击力」，Kael就能更快消灭怪物！'));
    el.append(h('div', { class: 'section-title' }, '属性升级（永久）'));
    const grid = h('div', { class: 'card-grid' });
    el.append(grid);
    for (const key of Object.keys(D.attributes)) {
      const a = D.attributes[key];
      const lv = s.attrs[key];
      const cur = { atk: st.atk, aspd: st.aspdBase, crit: st.crit, critDmg: st.critDmg, luck: st.luck }[key];
      const step = lv < a.soft ? a.per : a.beyond;
      const next = cur + step * (key === 'atk' ? 1 + P.equipStats(s).atkPct : 1);
      const capped = (key === 'aspd' && st.aspdBase >= 20) || (key === 'crit' && st.crit >= 1) || (key === 'luck' && st.luck >= 10);
      grid.append(
        card(
          a.name,
          lvText(lv),
          lv < D.levelCap && !capped ? h('span', { class: 'delta' }, h('b', { class: 'cur' }, a.fmt(cur)), ' → ', h('b', { class: 'up' }, a.fmt(next))) : h('span', { class: 'delta' }, h('b', { class: 'cur' }, a.fmt(cur)), capped ? '（已到上限）' : ''),
          h(
            'div',
            { class: 'btn-col' },
            buyBtn(capped ? null : P.attrCost(s, key), () => {
              const ok = P.buyAttr(s, key);
              if (ok) s.stats.shopGuided = true;
              return ok;
            }, '升级'),
            capped ? null : bulkRow('attr', key)
          ),
          { cls: 'v' + (key === 'atk' ? ' wide' : '') + (firstVisit && key === 'atk' ? ' glow' : ''), icon: TD.sprites.iconCanvas('attr_' + key, 56), bar: lv / a.max, barText: `${lv} / ${a.max}`, over: lv >= a.max }
        )
      );
    }
  }

  function shopWeapons(el) {
    const s = game.save;
    el.append(h('div', { class: 'section-title long' }, '武器（永久解锁，每级伤害 +8%，10 级以后每级 +4%；品质越高越强、越贵，升级也越贵）'));
    // 按品质分组：绿 → 蓝 → 紫 → 红 → 金（设计书 63.4）
    const order = Object.keys(D.weapons).sort((a, b) => (D.weapons[a].rarity || 1) - (D.weapons[b].rarity || 1));
    let lastR = 0;
    for (const id of order) {
      const w = D.weapons[id];
      const ws = s.weapons[id];
      const R = D.weaponRarity[w.rarity || 1];
      if ((w.rarity || 1) !== lastR) {
        lastR = w.rarity || 1;
        el.append(h('div', { class: 'section-title rar-title', style: { color: R.color } }, `${R.name}色品质`));
      }
      let right;
      if (!ws.owned) {
        right = buyBtn(w.cost, () => P.buyWeapon(s, id), '购买');
      } else
        right = h(
          'div',
          { class: 'btn-col' },
          buyBtn(P.weaponUpgradeCost(s, id), () => P.upgradeWeapon(s, id), '升级'),
          bulkRow('weapon', id),
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
      // 满级专精（设计书 53）
      const mastered = P.hasMastery(s, id);
      const masteryLine = w.mastery ? h('div', { class: 'asc mastery' + (mastered ? ' on' : '') }, `${mastered ? '★ 专精' : `Lv${D.weaponUpgrade.max} 解锁专精`}「${w.mastery.name}」：${w.mastery.desc}`) : null;
      const recTip = !ws.owned && P.recommended(s, w) ? h('div', { class: 'rec-tip' }, `推荐通关第 ${w.minLevel} 关后购买`) : null;
      el.append(
        card(
          h('span', { class: 'rar-name', style: { color: R.color } }, ws.asc ? w.ascend.name : w.name, h('span', { class: 'rar-tag', style: { background: R.color } }, R.name)),
          ws.owned ? lvText(ws.lv) : '可购买',
          h('span', null, w.desc, h('span', { class: 'good' }, ' 擅长：' + w.good)),
          right,
          { cls: 'wr-' + (w.rarity || 1) + (ws.owned ? '' : ' unowned'), color: R.color, icon: TD.sprites.iconCanvas(id, 56), foot: h('div', { class: 'card-notes' }, ascLine, masteryLine, recTip), bar: ws.owned ? Math.min(1, ws.lv / D.weaponUpgrade.max) : null, barText: ws.owned ? `${ws.lv} / ${D.weaponUpgrade.max}` : null, over: ws.owned && ws.lv >= D.weaponUpgrade.max }
        )
      );
    }
  }

  function shopSkills(el) {
    const s = game.save;
    el.append(h('div', { class: 'section-title' }, '主动技能（战斗中点击释放）'));
    const skillGrid = h('div', { class: 'card-grid' });
    el.append(skillGrid);
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
        desc = h('span', null, k.beyondDesc ? `${k.tierDesc[D.skillMaxLv - 1]}；${k.beyondDesc}` : `${k.tierDesc[D.skillMaxLv - 1]}；Lv3 以后每升一级，伤害 / 箭数 / 回复 / 持续时间再强一点，冷却再短一点`);
        right = h('div', { class: 'btn-col' }, buyBtn(P.skillUpgradeCost(s, id), () => P.upgradeSkill(s, id), '升级'), bulkRow('skill', id));
      }
      skillGrid.append(card(k.name, lv ? `Lv${lv} · 冷却 ${Math.round(P.skillDef(id, lv).cd * 10) / 10} 秒` : `冷却 ${k.cd} 秒`, desc, right, { cls: 'v' + (lv ? '' : ' unowned'), icon: TD.sprites.iconCanvas(id, 56), foot: pips(Math.min(lv, D.skillMaxLv), D.skillMaxLv) }));
    }
    el.append(h('div', { class: 'hint' }, '技能 Lv2 用银币升阶，Lv3 用金币升阶并带来质变效果。'));
    el.append(h('div', { class: 'section-title' }, '被动技能（自动生效）'));
    const passiveGrid = h('div', { class: 'card-grid' });
    el.append(passiveGrid);
    // 被动技能（设计书 90）：买下来是 1 级，效果很弱；升级才会变强
    const pct = (v) => Math.round(v * 1000) / 10;
    const passiveText = (id, lv) => {
      const v = P.passiveValue(id, lv);
      if (id === 'precision') return `暴击率 +${pct(v)}%`;
      if (id === 'combo') return `每攻击 ${Math.round((1 / v) * 10) / 10} 次追加 1 次攻击`;
      if (id === 'burn') return `命中后点燃目标，${D.passiveSkills.burn.duration} 秒内共造成攻击力 ×${Math.round(v * 100)}% 的魔法伤害`;
      if (id === 'pierceArmor') return `无视目标 ${pct(v)}% 护甲（含盾牌）`;
      // 外放型：按几率触发的额外效果（设计书 103）
      const k = D.passiveSkills[id];
      const m = Math.round(P.passiveMult(id, lv) * 100) / 100;
      if (id === 'lightning') return `攻击时有 ${pct(v)}% 的几率召下一道闪电，劈中目标并连锁 ${k.chain} 只怪，造成攻击力 ×${m} 的魔法伤害（连锁 60%）`;
      if (id === 'frostNova') return `攻击时有 ${pct(v)}% 的几率在目标处炸开一团寒霜，范围内的怪受到攻击力 ×${m} 的魔法伤害，并减速 ${Math.round(k.slow * 100)}% ${k.slowTime} 秒`;
      if (id === 'fireball') return `攻击时有 ${pct(v)}% 的几率掷出一颗火球，爆炸范围内的怪受到攻击力 ×${m} 的魔法伤害并被点燃`;
      if (id === 'spiritArrows') return `攻击时有 ${pct(v)}% 的几率放出 ${k.count} 支灵箭，各自追向一只怪，每支造成攻击力 ×${m} 的魔法伤害`;
      if (id === 'bladeWave') return `攻击时有 ${pct(v)}% 的几率挥出一道剑气，扫过目标所在的整条车道，每只怪受到攻击力 ×${m} 的伤害`;
      return `攻击时有 ${pct(v)}% 的几率为城墙回复 ${Math.round(m * 1000) / 10}% 的最大血量`;
    };
    for (const id of Object.keys(D.passiveSkills)) {
      const k = D.passiveSkills[id];
      const lv = P.passiveLevel(s, id);
      if (!lv) {
        passiveGrid.append(card(k.name, null, passiveText(id, 1), buyBtn(k.cost, () => P.buyPassive(s, id), '解锁'), { cls: 'v unowned', icon: TD.sprites.iconCanvas(id, 56) }));
        continue;
      }
      // 外放型被动的描述很长，升级预览只写变化的两个数：几率 和 倍数（回春是回血比例）
      const nxt = (l) => `${pct(P.passiveValue(id, l))}% · ${k.heal ? Math.round(P.passiveMult(id, l) * 1000) / 10 + '%' : '×' + Math.round(P.passiveMult(id, l) * 100) / 100}`;
      const desc = k.proc ? h('span', null, passiveText(id, lv), h('b', { class: 'up delta-line' }, `Lv${lv} ${nxt(lv)} → Lv${lv + 1} ${nxt(lv + 1)}`)) : h('span', null, `当前：${passiveText(id, lv)} → `, h('b', { class: 'up' }, `Lv${lv + 1}：${passiveText(id, lv + 1)}`));
      passiveGrid.append(card(k.name, lvText(lv), desc, h('div', { class: 'btn-col' }, buyBtn(P.passiveCost(s, id), () => P.upgradePassive(s, id), '升级'), bulkRow('passive', id)), { cls: 'v', icon: TD.sprites.iconCanvas(id, 56), bar: lv / 10, barText: `${lv} / 10`, over: lv >= 10 }));
    }
    el.append(h('div', { class: 'hint' }, '被动技能买下来是 1 级，效果很弱，升级以后才会变强；10 级以后每级的提升变小、费用涨得更快。'));
    el.append(h('div', { class: 'hint' }, '买到的技能要在「配装」页放进技能槽才会带进战斗。'));
  }

  // 套装说明（设计书 58.6）
  function setLine(s, setId) {
    const st = D.gearSets[setId];
    const on = P.activeSets(s).includes(setId);
    return h('div', { class: 'set-line' + (on ? ' on' : '') }, `${on ? '✨' : '◇'} 套装「${st.name}」：${st.parts.map((k) => D.equipment[k].name).join(' + ')} → ${st.desc}${on ? '（已凑齐）' : ''}`);
  }

  // 装备页（v0.68）：先选分类（武器 / 头盔 / 披风 / 盔甲 / 箭袋 / 饰品 / 鞋子），再按品质筛选；每类 30 件，不用一直往下拉
  function shopEquip(el) {
    const s = game.save;
    const st = UI.shopState;
    const worn = P.wornEquip(s);
    const countOf = (slot) => {
      const ids = Object.keys(D.equipment).filter((id) => D.equipment[id].slot === slot);
      return [ids.filter((id) => s.equipOwned[id]).length, ids.length];
    };
    el.append(
      h(
        'div',
        { class: 'equip-cats' },
        D.equipCats.map((c) => {
          const [have, total] = c.id === 'weapon' ? [Object.keys(D.weapons).filter((id) => s.weapons[id].owned).length, Object.keys(D.weapons).length] : countOf(c.id);
          return h(
            'button',
            {
              class: 'btn cat' + (st.equipCat === c.id ? ' primary' : ''),
              onclick: () => {
                sfx('click');
                st.equipCat = c.id;
                st.equipTier = 0;
                renderShop();
              },
            },
            h('span', { class: 'cat-icon' }, c.id === 'weapon' ? TD.sprites.iconCanvas(s.loadout.weapon || 'bow', 26) : TD.sprites.gearIconCanvas(c.id, '#c9d4ea', 26)),
            h('span', null, c.name),
            h('span', { class: 'cat-count' }, `${have}/${total}`)
          );
        })
      )
    );
    if (st.equipCat === 'weapon') return shopWeapons(el);

    const slot = st.equipCat;
    const [have, total] = countOf(slot);
    el.append(h('div', { class: 'section-title' }, `${D.equipSlots[slot]}（已拥有 ${have} / ${total}${slot === 'trinket' ? '，可同时戴 3 件' : ''}）`));
    // 品质筛选
    el.append(
      h(
        'div',
        { class: 'tier-filter' },
        [0, 1, 2, 3, 4, 5].map((t) => {
          const R = t ? D.weaponRarity[t] : null;
          const n = Object.keys(D.equipment).filter((id) => D.equipment[id].slot === slot && (!t || D.equipment[id].rarity === t)).length;
          return h(
            'button',
            {
              class: 'btn small tier' + (st.equipTier === t ? ' on' : ''),
              style: R ? { borderColor: R.color, color: st.equipTier === t ? '#fff' : R.color, background: st.equipTier === t ? R.color : null } : null,
              onclick: () => {
                sfx('click');
                st.equipTier = t;
                renderShop();
              },
            },
            R ? `${R.name} ${n}` : `全部 ${n}`
          );
        })
      )
    );
    // 按品质、再按价格从低到高排（买得起就能买）
    const ids = Object.keys(D.equipment)
      .filter((id) => D.equipment[id].slot === slot && (!st.equipTier || D.equipment[id].rarity === st.equipTier))
      .sort((a, b) => D.equipment[a].rarity - D.equipment[b].rarity || P.costValue(D.equipment[a].cost) - P.costValue(D.equipment[b].cost));
    const gearGrid = h('div', { class: 'card-grid' });
    el.append(gearGrid);
    for (const id of ids) {
      const e = D.equipment[id];
      const R = D.weaponRarity[e.rarity];
      const isWorn = worn.includes(id);
      const sellBtn = () =>
        h(
          'button',
          {
            class: 'btn small sell',
            title: '卖出价是买入价的一半',
            onclick: () =>
              UI.confirm(`把「${e.name}」卖掉吗？卖出价 ${P.costText(P.sellPrice(id))}（买入价的一半）。以后想要可以按原价买回。`, () => {
                P.sellEquip(s, id);
                sfx('coin');
                game.persist();
                renderShop();
              }),
          },
          '出售 ',
          costEl(P.sellPrice(id))
        );
      const wearBtn = () =>
        h(
          'button',
          {
            class: 'btn small' + (isWorn ? '' : ' primary'),
            onclick: () => {
              if (isWorn) P.unwearEquip(s, id);
              else if (!P.wearEquip(s, id)) return sfx('error');
              sfx('click');
              game.persist();
              renderShop();
            },
          },
          isWorn ? '卸下' : '穿戴'
        );
      const right = s.equipOwned[id]
        ? h('div', { class: 'btn-col' }, isWorn ? h('span', { class: 'equipped' }, '穿戴中') : null, wearBtn(), sellBtn())
        : buyBtn(e.cost, () => P.buyEquip(s, id));
      const recTip = !s.equipOwned[id] && P.recommended(s, e) ? h('div', { class: 'rec-tip' }, `推荐通关第 ${e.minLevel} 关后购买`) : null;
      const name = h('span', { class: 'rar-name', style: { color: R.color } }, e.name, h('span', { class: 'rar-tag', style: { background: R.color } }, R.name));
      gearGrid.append(card(name, null, h('span', null, e.desc, e.set ? setLine(s, e.set) : null, recTip), right, { cls: 'wr-' + e.rarity + (s.equipOwned[id] ? '' : ' unowned') + (isWorn ? ' worn' : ''), color: R.color, icon: TD.sprites.gearIconCanvas(e.slot, R.color, 56) }));
    }
  }

  function shopWall(el) {
    const s = game.save;
    const st = P.heroStats(s);
    // 顶部横幅：城墙现在的样子（大图标 + 血量 + 减伤 / 修缮 / 荆棘）
    const chip = (name, val) => h('span', { class: 'wall-chip' }, name, h('b', null, val));
    el.append(
      h(
        'div',
        { class: 'wall-banner' },
        h('div', { class: 'wall-art' }, TD.sprites.iconCanvas('wall_level', 84)),
        h('div', { class: 'wall-info' }, h('div', { class: 'wall-hp-label' }, '城墙血量'), h('div', { class: 'wall-hp' }, st.wallMax), h('div', { class: 'wall-chips' }, chip(D.wallUpgrades.fortify.name, Math.round(st.wallDr * 100) + '%'), chip(D.wallUpgrades.mend.name, Math.round(st.mend * 1000) / 10 + '%'), chip(D.wallUpgrades.thorns.name, Math.round(st.thorns * 100) + '%')))
      )
    );
    el.append(h('div', { class: 'section-title' }, `城墙升级（当前最大血量 ${st.wallMax}）`));
    const wallGrid = h('div', { class: 'card-grid' });
    el.append(wallGrid);
    for (const key of Object.keys(D.wallUpgrades)) {
      const u = D.wallUpgrades[key];
      const lv = s.wall[key];
      let detail = u.desc;
      if (key === 'level') detail = h('span', null, `${u.desc} 血量 ${st.wallMax} → `, h('b', { class: 'up' }, Math.round(P.wallHpAt(lv + 1) * (1 + P.equipStats(s).wallHpPct))), lv >= u.soft ? h('span', { class: 'hint' }, ` （30 级以后每级 +${Math.round(u.beyond * 100)}% 的 30 级血量）`) : null);
      const capped = (key === 'fortify' && st.wallDr >= 0.75) || (key === 'mend' && st.mend >= 0.5);
      wallGrid.append(card(u.name, lvText(lv), capped ? h('span', null, detail, '（已到上限）') : detail, capped ? h('span', { class: 'equipped' }, '已到上限') : h('div', { class: 'btn-col' }, buyBtn(P.wallCost(s, key), () => P.buyWall(s, key), '升级'), bulkRow('wall', key)), { cls: 'v', icon: TD.sprites.iconCanvas('wall_' + key, 56), bar: lv / u.max, barText: `${lv} / ${u.max}`, over: lv >= u.max }));
    }
  }

  // 道具商店（设计书 82）：买下来先进背包；要带进战斗得"装备"：最多 7 种，每种最多 3 个
  function shopItems(el) {
    const s = game.save;
    const nI = P.slotCount(s, 'item');
    const R = D.itemRules;
    const used = s.loadout.items.slice(0, nI).filter(Boolean).length;
    el.append(h('div', { class: 'section-title long' }, `消耗品（战斗中使用，用一个少一个；最多带 ${R.kinds} 种，每种最多 ${R.perKind} 个，每种用完要等冷却）`));
    el.append(h('div', { class: 'hint' }, `流程：买下来 → 放进背包 → 点「装备 +1」装备到战斗里（也可以在「配装」页选）。现在栏位 ${used} / ${nI}${nI < R.kinds ? `（通关第 ${D.slotUnlocks.item[nI]} 关再开一格）` : '（栏位已全部解锁）'}。`));
    if (nI === 0) el.append(h('div', { class: 'hint warn' }, `通关第 ${D.slotUnlocks.item[0]} 关后解锁消耗品栏位。现在可以先买好。`));
    // 按价格分三档：铜币 → 银币 → 金币，越强越贵（设计书 62.2）
    const tierOf = (it) => (it.cost.gold || it.cost.diamond ? 'gold' : it.cost.silver ? 'silver' : 'copper');
    const tiers = [['copper', '铜币档 · 常用'], ['silver', '银币档 · 针对性强'], ['gold', '金币档 · 扭转战局的底牌']];
    for (const [tier, title] of tiers) {
      el.append(h('div', { class: 'section-title tier-' + tier }, coinIcon(tier), title));
      const itemGrid = h('div', { class: 'card-grid' });
      el.append(itemGrid);
      for (const id of Object.keys(D.items).filter((k) => tierOf(D.items[k]) === tier)) {
        const it = D.items[id];
        const eq = P.itemEquipped(s, id);
        const stock = P.itemStock(s, id);
        const counts = h('span', { class: 'item-counts' }, h('span', null, '背包 ', h('b', null, stock)), h('span', null, '已装备 ', h('b', null, `${eq}/${R.perKind}`)));
        const adj = (delta, label) =>
          h(
            'button',
            {
              class: 'btn small',
              disabled: (delta > 0 ? eq >= R.perKind || stock < 1 || (P.itemSlotOf(s, id) < 0 && s.loadout.items.slice(0, nI).every(Boolean)) || nI === 0 : eq < 1) ? true : null,
              onclick: () => {
                if (P.adjustItem(s, id, delta)) {
                  sfx('click');
                  game.persist();
                  renderShop();
                } else sfx('error');
              },
            },
            label
          );
        itemGrid.append(
          card(
            it.name,
            it.passive ? '开战自动生效' : `冷却 ${it.cd} 秒`,
            it.desc,
            h('div', { class: 'btn-col' }, buyBtn(it.cost, () => P.buyItem(s, id)), h('div', { class: 'bulk-row' }, adj(1, '装备 +1'), adj(-1, '卸下 −1'))),
            { cls: 'v item-tier-' + tier + (stock || eq ? '' : ' unowned'), icon: TD.sprites.iconCanvas(id, 56), foot: counts }
          )
        );
      }
    }
  }

  function shopExchange(el) {
    const s = game.save;
    const E = C.exchange;
    el.append(h('div', { class: 'section-title' }, '汇兑所（单向兑换，不能换回来）'));
    const have = (k) => s[k] || 0;
    const mk = (from, to, rate, times) =>
      h(
        'button',
        {
          class: 'btn small' + (have(from) >= rate * times ? ' primary' : ''),
          disabled: have(from) >= rate * times ? null : true,
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
    // 一张兑换卡：左边大币 × 比率 → 右边大币，下面一排兑换按钮；两边都显示手里有多少
    const swap = (from, to, rate, desc) =>
      h(
        'div',
        { class: 'swap-card swap-' + to },
        h(
          'div',
          { class: 'swap-flow' },
          h('div', { class: 'swap-side' }, h('span', { class: 'coin-big ' + from }), h('b', null, '× ' + rate), h('i', null, have(from))),
          h('div', { class: 'swap-arrow' }, '➜'),
          h('div', { class: 'swap-side' }, h('span', { class: 'coin-big ' + to }), h('b', null, '× 1'), h('i', null, have(to)))
        ),
        h('div', { class: 'swap-desc' }, desc),
        h('div', { class: 'btn-row' }, ...E.amounts.map((n) => mk(from, to, rate, n)))
      );
    const row = h('div', { class: 'swap-grid' }, swap('copper', 'silver', E.copperPerSilver, '银币用来解锁技能和精良装备。'), swap('silver', 'gold', E.silverPerGold, '金币用来购买传说装备、高阶武器和技能 Lv3。'));
    el.append(row);
    el.append(
      h(
        'div',
        { class: 'gem-card' },
        h('div', { class: 'gem-art' }, h('span', { class: 'coin-big diamond' })),
        h('div', { class: 'gem-body' }, h('div', { class: 'gem-title' }, '钻石', h('b', null, have('diamond'))), h('div', { class: 'swap-desc' }, '最稀有的货币，只能在「九层妖塔」里获得，不能兑换。可以买「装备」页里的金色装备（每类除第 1 件外都只能用钻石买，最便宜 10 钻），以及等级特别高（几千级以后）的升级。'))
      )
    );
  }

  // ---- 配装页（v0.99 重新设计，设计书 101） ----
  // 思路：只放"现在能用的"，每类东西一张分组卡片，统一用图标方块；锁着的 / 没买的不再铺满页面。
  //   角色卡（头像 + 英雄 / 伙伴小头像）→ 武器（已拥有的图标，点击换）→ 技能（主动 | 被动）→ 装备（8 格）→ 消耗品 → 战斗设置
  function shopLoadout(el) {
    const s = game.save;
    const lo = s.loadout;
    const st = UI.shopState;
    const RC = (r) => D.weaponRarity[r || 1].color;
    // 图标方块：图标 + 名字 + 小字；空格子是虚线 + 加号，锁住的是灰色 + 锁
    const tile = (o) =>
      h(
        'button',
        { class: 'lo-tile' + (o.on ? ' on' : '') + (o.locked ? ' locked' : '') + (!o.icon && !o.locked ? ' empty' : ''), title: o.title || null, style: o.color ? { '--rar': o.color } : null, onclick: o.locked ? () => sfx('error') : o.onclick },
        h('div', { class: 'lo-ico' }, o.locked ? h('span', { class: 'lo-lock' }, '🔒') : o.icon || h('span', { class: 'lo-plus' }, '＋')),
        h('div', { class: 'lo-name', style: o.color && o.icon ? { color: o.color } : null }, o.name || o.label || ''),
        o.sub ? h('div', { class: 'lo-sub' }, o.sub) : null,
        o.badge ? h('i', { class: 'lo-badge' }, o.badge) : null,
        o.on ? h('i', { class: 'lo-check' }, '✔') : null
      );
    const card = (title, sub, ...kids) => h('div', { class: 'lo-card' }, h('div', { class: 'lo-head' }, h('b', null, title), sub ? h('span', { class: 'lo-hint' }, sub) : null), ...kids);
    const lockSub = (n) => `通关第 ${n} 关解锁`;

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

    // ---- 角色：大头像 + 英雄小头像 + 助战伙伴小头像 ----
    {
      const cur = C.heroes[P.heroId(s)];
      const heroChips = Object.keys(C.heroes).map((id) => {
        const hd = C.heroes[id];
        const open = P.heroUnlocked(s, id);
        const on = P.heroId(s) === id;
        return h('button', { class: 'lo-chip' + (on ? ' on' : '') + (open ? '' : ' locked'), title: open ? `${hd.name}：${hd.role}` : `${hd.name}：通关第 ${hd.unlock} 关解锁`, onclick: () => (open && P.setHero(s, id) ? (sfx('click'), game.persist(), renderShop()) : sfx('error')) }, TD.sprites.heroPortrait(42, on ? 'win' : 'idle', undefined, id), open ? null : h('i', { class: 'lo-chip-lock' }, '🔒'));
      });
      const buddies = D.town.filter((f) => P.buddyUnlocked(s, f.boss));
      const curBuddy = P.buddyId(s);
      const buddyChips = buddies.length
        ? [
            h('button', { class: 'lo-chip none' + (curBuddy ? '' : ' on'), title: '不带', onclick: () => (P.setBuddy(s, null), sfx('click'), game.persist(), renderShop()) }, h('span', null, '∅')),
            ...buddies.map((f) => h('button', { class: 'lo-chip' + (curBuddy === f.boss ? ' on' : ''), title: `${D.monsters[f.boss].name}：${f.perkDesc}`, onclick: () => (P.setBuddy(s, f.boss), sfx('click'), game.persist(), renderShop()) }, TD.sprites.portrait(f.boss, 38))),
          ]
        : null;
      el.append(
        h(
          'div',
          { class: 'lo-card lo-hero' },
          h('div', { class: 'lo-hero-pic' }, TD.sprites.heroPortrait(84, 'win', undefined, P.heroId(s))),
          h('div', { class: 'lo-hero-info' }, h('div', { class: 'lo-hero-name' }, cur.name, h('span', { class: 'lo-role' }, cur.role)), h('div', { class: 'lo-hero-desc' }, cur.desc)),
          h(
            'div',
            { class: 'lo-hero-pick' },
            Object.keys(C.heroes).some((id) => id !== 'dang' && P.heroUnlocked(s, id)) ? h('div', { class: 'lo-chip-row' }, h('span', { class: 'lo-chip-label' }, '英雄'), heroChips) : null,
            buddyChips ? h('div', { class: 'lo-chip-row' }, h('span', { class: 'lo-chip-label' }, '助战伙伴'), buddyChips) : null,
            curBuddy ? h('div', { class: 'lo-hint' }, `${D.monsters[curBuddy].name}：${D.town.find((f) => f.boss === curBuddy).perkDesc}`) : null
          )
        )
      );
    }

    // ---- 武器：当前这把 + 已拥有的图标；没买的不显示，只提示还有几把 ----
    {
      const weaponsOpen = UI.tabUnlocked(s, 'weapons');
      const ids = Object.keys(D.weapons);
      const owned = ids.filter((id) => s.weapons[id].owned);
      const cw = lo.weapon;
      const wd = P.weaponDef(s, cw);
      const rest = ids.length - owned.length;
      el.append(
        card(
          '武器',
          weaponsOpen ? (rest > 0 ? `还有 ${rest} 把武器可以在「装备」页的「武器」分类里购买` : null) : '更多武器：在「装备」页的「武器」分类里解锁',
          h('div', { class: 'lo-weapon-now', style: { '--rar': RC(D.weapons[cw].rarity) } }, TD.sprites.iconCanvas(cw, 52), h('div', null, h('div', { class: 'lo-weapon-name', style: { color: RC(D.weapons[cw].rarity) } }, wd.name, h('span', { class: 'lo-lv' }, `Lv.${s.weapons[cw].lv}`)), h('div', { class: 'lo-weapon-desc' }, wd.desc))),
          h(
            'div',
            { class: 'lo-tiles' },
            owned.map((id) =>
              tile({
                icon: TD.sprites.iconCanvas(id, 40),
                name: P.weaponDef(s, id).name,
                color: RC(D.weapons[id].rarity),
                sub: `Lv.${s.weapons[id].lv}`,
                on: cw === id,
                title: P.weaponDef(s, id).desc,
                onclick: () => {
                  if (P.setWeapon(s, id)) {
                    sfx('click');
                    game.persist();
                    renderShop();
                  }
                },
              })
            )
          )
        )
      );
    }

    // ---- 技能：主动 | 被动 并排，协同提示放在下面 ----
    {
      const skillTiles = (kind, defs, owned, lvOf) => {
        const n = P.slotCount(s, kind);
        const arr = lo[kind];
        return [0, 1, 2].map((i) => {
          const id = i < n ? arr[i] : null;
          return tile({
            icon: id ? TD.sprites.iconCanvas(id, 40) : null,
            name: id ? defs[id].name : null,
            label: `槽 ${i + 1}`,
            sub: i >= n ? lockSub(D.slotUnlocks[kind][i]) : id && lvOf ? lvOf(id) : null,
            title: id ? defs[id].desc || null : null,
            locked: i >= n,
            onclick: () => pickFor(kind, i, defs, owned),
          });
        });
      };
      const act = lo.active.slice(0, P.slotCount(s, 'active')).filter(Boolean);
      el.append(
        h(
          'div',
          { class: 'lo-card' },
          h(
            'div',
            { class: 'lo-two' },
            h('div', null, h('div', { class: 'lo-head' }, h('b', null, '主动技能')), h('div', { class: 'lo-tiles' }, skillTiles('active', D.activeSkills, s.activeOwned, (id) => `Lv${P.skillLevel(s, id)}`))),
            h('div', { class: 'lo-vline' }),
            h('div', null, h('div', { class: 'lo-head' }, h('b', null, '被动技能')), h('div', { class: 'lo-tiles' }, skillTiles('passive', D.passiveSkills, s.passiveOwned, (id) => `Lv${P.passiveLevel(s, id)}`)))
          ),
          h(
            'div',
            { class: 'synergy-row' },
            Object.keys(D.synergies).map((id) => {
              const sy = D.synergies[id];
              const on = sy.skills.every((k) => act.includes(k));
              return h('span', { class: 'synergy' + (on ? ' on' : ''), title: sy.desc }, `${on ? '✨' : '·'} 协同「${sy.name}」：${sy.skills.map((k) => D.activeSkills[k].name).join(' + ')}${on ? '（已带齐）' : ''}`);
            })
          )
        )
      );
    }

    // ---- 装备：8 个格子排成一排（两行）----
    {
      const eqNames = { helm: '头盔', cape: '披风', armor: '盔甲', quiver: '箭袋', trinket1: '饰品 1', trinket2: '饰品 2', trinket3: '饰品 3', boots: '鞋子' };
      const anyEquip = Object.keys(s.equipOwned || {}).some((k) => s.equipOwned[k]);
      if (!UI.tabUnlocked(s, 'equip') && !anyEquip) el.append(card('装备', null, h('div', { class: 'hint slot-note' }, `通关第 ${TAB_UNLOCK.equip} 关后开放「装备」：头盔、披风、盔甲、箭袋、饰品和鞋子`)));
      else {
        const sets = P.activeSets(s);
        el.append(
          card(
            '装备',
            null,
            h(
              'div',
              { class: 'lo-tiles lo-eq' },
              Object.keys(eqNames).map((k) => {
                if (k === 'quiver' && P.slotCount(s, 'quiver') < 1) return tile({ label: eqNames[k], locked: true, sub: lockSub(D.slotUnlocks.quiver[0]) });
                const id = lo.equip[k];
                const eq = id ? D.equipment[id] : null;
                return tile({ icon: eq ? TD.sprites.gearIconCanvas(eq.slot, RC(eq.rarity), 40) : null, name: eq ? eq.name : null, label: eqNames[k], color: eq ? RC(eq.rarity) : null, sub: eq ? null : null, title: eq ? `${eq.name}：${eq.desc}` : eqNames[k], onclick: () => pickEquip(k) });
              })
            ),
            sets.length ? h('div', { class: 'synergy-row' }, sets.map((k) => h('span', { class: 'synergy on' }, `✨ 套装「${D.gearSets[k].name}」：${D.gearSets[k].desc}`))) : null
          )
        );
      }
    }

    // ---- 消耗品 ----
    {
      const n = P.slotCount(s, 'item');
      const R = D.itemRules;
      el.append(
        card(
          `消耗品（最多带 ${R.kinds} 种，每种最多 ${R.perKind} 个；用一个少一个，每种有冷却）`,
          null,
          h(
            'div',
            { class: 'lo-tiles lo-grid7' },
            Array.from({ length: R.kinds }, (_, i) => {
              const id = lo.items[i];
              const locked = i >= n;
              return tile({
                icon: !locked && id ? TD.sprites.iconCanvas(id, 40) : null,
                name: !locked && id ? D.items[id].name : null,
                label: `槽 ${i + 1}`,
                badge: !locked && id ? `×${P.itemEquipped(s, id)}` : null,
                sub: locked ? lockSub(D.slotUnlocks.item[i]) : id ? `背包 ${P.itemStock(s, id)}` : null,
                locked,
                title: id && !locked ? D.items[id].desc || null : null,
                onclick: () => pickItem(i),
              });
            })
          )
        )
      );
    }

    // ---- 战斗设置 ----
    el.append(
      card(
        '战斗设置',
        null,
        h(
          'div',
          { class: 'lo-settings' },
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
      )
    );
  }

  // 选道具 + 选个数（设计书 82）：每种道具一行，点 1 / 2 / 3 装备这么多个（从背包里挪）
  function pickItem(index) {
    const s = game.save;
    const R = D.itemRules;
    const cur = s.loadout.items[index];
    const ids = Object.keys(D.items).filter((id) => P.itemEquipped(s, id) + P.itemStock(s, id) > 0);
    const list = h('div', { class: 'pick-list' });
    const done = () => {
      sfx('click');
      game.persist();
      UI.closeModal();
      renderShop();
    };
    if (cur) list.append(h('button', { class: 'pick', onclick: () => (P.unequipItem(s, index), done()) }, h('b', null, `（卸下 ${D.items[cur].name}，${P.itemEquipped(s, cur)} 个退回背包）`)));
    for (const id of ids) {
      const total = P.itemEquipped(s, id) + P.itemStock(s, id);
      const e = P.itemEquipped(s, id);
      const elsewhere = s.loadout.items.indexOf(id) >= 0 && s.loadout.items.indexOf(id) !== index;
      const nums = [1, 2, 3].map((q) =>
        h(
          'button',
          {
            class: 'btn small' + (cur === id && e === q ? ' primary' : ''),
            disabled: q > Math.min(R.perKind, total) ? true : null,
            onclick: () => (P.equipItem(s, index, id, q), done()),
          },
          `带 ${q} 个`
        )
      );
      list.append(
        h(
          'div',
          { class: 'pick item-pick' + (cur === id ? ' on' : '') },
          h('b', null, D.items[id].name, h('span', { class: 'item-counts' }, h('span', null, '背包 ', h('b', null, P.itemStock(s, id))), h('span', null, '已装备 ', h('b', null, e)), elsewhere ? h('span', null, '（在别的栏位，会换过来）') : null)),
          h('span', null, `${D.items[id].desc}${D.items[id].cd ? `　冷却 ${D.items[id].cd} 秒` : '　开战自动生效'}`),
          h('div', { class: 'item-qty-pick' }, nums)
        )
      );
    }
    if (!ids.length) list.append(h('div', { class: 'hint' }, '背包里还没有道具，去「道具」页购买。'));
    modal(h('div', null, h('h2', null, `槽 ${index + 1}：选道具和个数`), list, h('div', { class: 'modal-buttons' }, h('button', { class: 'btn', onclick: UI.closeModal }, '取消'))), { closeOnBack: true });
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
        UI.toast(kind === 'item' ? '背包里没有这个道具' : '无法放入');
      }
    };
    list.append(h('button', { class: 'pick', onclick: () => choose(null) }, h('b', null, '（清空）')));
    for (const id of opts) {
      const d = defs[id];
      list.append(h('button', { class: 'pick' + (arr[index] === id ? ' on' : '') + (arr.includes(id) && arr[index] !== id ? ' used' : ''), onclick: () => choose(id) }, h('b', null, d.name, kind === 'item' ? ` ×${s.inventory[id] || 0}` : ''), h('span', null, d.desc)));
    }
    if (!opts.length) list.append(h('div', { class: 'hint' }, kind === 'item' ? '背包是空的，去「道具」页购买。' : '还没有可用的技能，去「技能」页用银币解锁。'));
    modal(h('div', null, h('h2', null, '选择'), list, h('div', { class: 'modal-buttons' }, h('button', { class: 'btn', onclick: UI.closeModal }, '取消'))), { closeOnBack: true });
  }

  function pickEquip(slotKey) {
    const s = game.save;
    const kind = slotKey.startsWith('trinket') ? 'trinket' : slotKey;
    const opts = Object.keys(D.equipment)
      .filter((id) => s.equipOwned[id] && D.equipment[id].slot === kind)
      .sort((a, b) => D.equipment[b].rarity - D.equipment[a].rarity);
    const list = h('div', { class: 'pick-list' });
    const choose = (id) => {
      P.setEquip(s, slotKey, id);
      sfx('click');
      game.persist();
      UI.closeModal();
      renderShop();
    };
    list.append(h('button', { class: 'pick', onclick: () => choose(null) }, h('b', null, '（卸下）')));
    for (const id of opts) list.append(h('button', { class: 'pick' + (s.loadout.equip[slotKey] === id ? ' on' : ''), onclick: () => choose(id) }, h('b', { style: { color: D.weaponRarity[D.equipment[id].rarity].color } }, D.equipment[id].name), h('span', null, D.equipment[id].desc)));
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
    // 道具按钮：右上角是快捷键，下面是剩余个数；用过之后转圈冷却（设计书 82）
    const itemBtns = battle.items.map((it, i) =>
      h(
        'button',
        { class: 'item-btn', title: `${it.def.desc}\n冷却 ${it.def.cd || 0} 秒，带了 ${it.left} 个`, onclick: () => game.tryItem(i) },
        h('span', { class: 'key' }, 'QWERZXC'[i]),
        TD.sprites.iconCanvas(it.id, 34),
        h('span', { class: 'skill-name' }, it.def.name),
        h('span', { class: 'item-stock' }, '×' + it.left),
        h('span', { class: 'cd' })
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
    else if (b.level.tower) waveText = `第 ${b.level.floor} 层 · 第 ${b.waveIndex + 1} / ${b.totalWaves} 波 · 剩余 ${b.aliveCount()} 只`;
    else waveText = `第 ${b.waveIndex + 1} / ${b.totalWaves} 波`;
    if (b.pendingSupply) waveText += ' · 补给中';
    else if (b.waveState === 'waiting') waveText += ` · 下一波 ${Math.max(0, Math.ceil(b.countdown))} 秒`;
    hud.wave.textContent = waveText;
    const canCall = b.waveState === 'waiting' && b.waveIndex < b.totalWaves - 1 && !b.pendingSupply && b.countdown > 0;
    hud.callBtn.classList.toggle('hidden', !canCall);
    if (canCall) hud.callBtn.textContent = `提前召唤 +${Math.max(0, Math.floor(b.countdown))}铜 (N)`;
    hud.copper.textContent = Math.floor(b.killCopper + b.earlyCopper); // 多出来的小怪的铜币按强度折算，可能带小数
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
      btn.classList.toggle('used', it.left <= 0);
      btn.classList.toggle('cooling', it.left > 0 && it.cd > 0);
      const stock = btn.querySelector('.item-stock');
      if (stock) stock.textContent = '×' + it.left;
      const cd = btn.querySelector('.cd');
      if (cd) {
        if (it.cd > 0 && it.left > 0) {
          cd.style.background = `conic-gradient(rgba(30,20,10,0.65) ${(it.cd / ((it.def.cd || 1) * Math.max(0.3, 1 + b.mods.cdMult * 0.5))) * 360}deg, transparent 0)`;
          cd.textContent = Math.ceil(it.cd);
        } else {
          cd.style.background = 'none';
          cd.textContent = '';
        }
      }
      btn.classList.toggle('armed', game.pendingLane && game.pendingLane.kind === 'item' && game.pendingLane.index === i);
    });
    hud.targetBtn.textContent = '🎯 ' + D.targetModes[b.target];
    hud.speedBtn.textContent = game.speed === 3 ? '⏭ 3倍速' : game.speed === 2 ? '⏩ 2倍速' : '▶ 1倍速';
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
      const rar = D.supplyRarity[sup.rarity || 'blue'];
      return h(
        'button',
        { class: 'supply-card rar-' + (sup.rarity || 'blue'), style: { borderColor: rar.color }, onclick: () => game.pickSupply(id) },
        h('span', { class: 'key' }, i + 1),
        h('span', { class: 'supply-rar', style: { background: rar.color } }, rar.name),
        TD.sprites.iconCanvas(sup.icon, 64),
        h('div', { class: 'supply-name', style: { color: rar.color } }, sup.name),
        h('div', { class: 'supply-desc' }, sup.desc)
      );
    });
    modal(
      h(
        'div',
        { class: 'supply' },
        h('h2', null, '📦 补给箱到了！'),
        h('div', { class: 'hint' }, first ? '战斗暂停中。选一张补给卡，效果持续到本关结束（颜色从低到高：蓝、紫、红、金，越高越强）。按 1 / 2 / 3 也可以选。' : `选一张补给卡（本关有效） · 第 ${battle.supplyPicked.length + 1} 次补给`),
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
          b.level.tower ? null : h('button', { class: 'btn', onclick: () => (UI.closeModal(), game.restartBattle()) }, '重新开始'),
          h('button', { class: 'btn', onclick: () => UI.showHelp() }, '玩法说明'),
          h('button', { class: 'btn danger', onclick: () => (b.level.tower ? UI.confirm('放弃这趟挑战吗？门票不退，什么都得不到。', () => game.quitBattle()) : game.quitBattle()) }, b.level.tower ? '放弃挑战' : '放弃本关')
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
    const notes = reward.notes.filter((x) => !x.includes('失败')).map((x) => h('div', { class: 'note' + (x.startsWith('援军') ? ' rally' : '') }, (x.startsWith('援军') ? '🎺 ' : '✦ ') + x));
    if (res.supplies && res.supplies.length) notes.push(h('div', { class: 'note' }, '📦 本关补给：', ...res.supplies.flatMap((x, i) => (i ? [h('span', null, '、'), h('span', null, D.supplies[x].name)] : [h('span', null, D.supplies[x].name)]))));
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
      // 失败时左右两栏：左边奖励和推荐强化，右边战斗报告（设计书 32.2）
      win
        ? [h('div', { class: 'reward-box' }, rows), notes, unlocks, UI.reportEl(res, false)]
        : h('div', { class: 'result-cols' }, h('div', null, h('div', { class: 'reward-box' }, rows), notes, unlocks, tips), h('div', null, UI.reportEl(res, true))),
      h(
        'div',
        { class: 'modal-buttons' },
        h('button', { class: 'btn', onclick: () => (UI.closeModal(), UI.showMap(D.chapterOf(n).id)) }, '地图'),
        h('button', { class: 'btn' + (!win && game.save.stats.wins < 3 ? ' primary pulse' : ''), onclick: () => (UI.closeModal(), UI.showShop(win && hasNext ? n + 1 : n, win && game.save.stats.wins >= 3 ? 'loadout' : 'attrs')) }, '去商店'),
        !win || !hasNext ? h('button', { class: 'btn' + (win ? '' : ' primary'), onclick: () => (UI.closeModal(), game.startBattle(n)) }, '再来一次') : null,
        hasNext ? h('button', { class: 'btn primary', onclick: () => (UI.closeModal(), UI.showMap(D.chapterOf(n + 1).id), UI.showPreview(n + 1)) }, '下一关 ›') : null
      )
    );
    modal(body, { cls: 'result-modal' + (win ? '' : ' lose-wide') });
  };
})((globalThis.TD = globalThis.TD || {}));
