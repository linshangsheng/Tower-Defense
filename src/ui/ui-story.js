// 界面：守城日记、衣柜、结局演出（从 ui.js 拆出，设计书 23.6、28、30）
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
  let screenEl;

  // ================= 守城日记（设计书 28） =================
  function speakerInfo(id, dark) {
    const sp = D.speakers[id];
    if (sp) return { name: sp.name, img: () => (sp.emoji ? h('div', { class: 'story-emoji' }, sp.emoji) : TD.sprites.heroPortrait(96, undefined, undefined, sp.hero || 'dang')) };
    const def = D.monsters[id];
    return { name: def ? def.name : id, img: () => TD.sprites.portrait(id, 96, { head: true, dark }) };
  }

  // 对话场景属于哪一章（背景用这一章的场景画）
  function storyChapter(key) {
    const m = /^(ch|pre|post)(\d+)$/.exec(key);
    if (!m) return key === 'dragonFall' ? D.chapters[D.chapters.length - 1] : null;
    return m[1] === 'ch' ? D.chapters.find((c) => c.id === +m[2]) : D.chapterOf(+m[2]);
  }
  // 站在左边的是主角和国王，其余（怪物）站右边
  const LEFT_CAST = ['dang', 'ding', 'yan', 'ying', 'mu', 'king'];

  // 对话背景：章节场景（虚化压暗）+ 缓缓上升的萤火 / 深渊紫焰。返回 { el, stop }
  function storyBackdrop(chapter, mood) {
    const wrap = h('div', { class: 'story-bg' });
    const theme = chapter && chapter.theme;
    const back = h('canvas', { class: 'story-bg-scene' });
    // 画在很小的画布上再拉大 = 免费的虚化（不用 CSS filter：带动画的 filter 在软件渲染的手机上很卡）
    back.width = 128;
    back.height = 72;
    try {
      const r = G().renderer;
      const sc = theme && r && r.paintScene && r.paintScene(theme, 5, '5:' + (theme.art || ''));
      if (sc) back.getContext('2d').drawImage(sc.back, 0, 0, 128, 72);
    } catch (e) {
      /* 没有场景就只剩渐变 */
    }
    wrap.appendChild(back);
    const fx = h('canvas', { class: 'story-bg-fx' });
    fx.width = 640;
    fx.height = 360;
    wrap.appendChild(fx);
    let raf = 0;
    let alive = true;
    const lit = !TD.quality || TD.quality.lit === undefined || TD.quality.lit > 0.5;
    if (lit && fx.getContext) {
      const g = fx.getContext('2d');
      const abyss = !!(theme && theme.abyss);
      const color = mood === 'dragon' ? '255,120,70' : abyss ? '196,140,255' : '255,225,150';
      const motes = [];
      for (let i = 0; i < 46; i++) motes.push({ x: Math.random() * 640, y: Math.random() * 360, r: 0.8 + Math.random() * 2.2, v: 6 + Math.random() * 16, ph: Math.random() * 6.28 });
      let last = 0;
      const tick = (now) => {
        if (!alive) return;
        raf = requestAnimationFrame(tick);
        if (now - last < 40) return;
        const dt = Math.min(0.1, (now - last) / 1000 || 0.04);
        last = now;
        g.clearRect(0, 0, 640, 360);
        for (const m of motes) {
          m.y -= m.v * dt;
          m.x += Math.sin(now / 900 + m.ph) * 8 * dt;
          if (m.y < -6) {
            m.y = 366;
            m.x = Math.random() * 640;
          }
          const a = 0.25 + 0.35 * Math.sin(now / 500 + m.ph);
          g.fillStyle = `rgba(${color},${Math.max(0.05, a)})`;
          g.beginPath();
          g.arc(m.x, m.y, m.r, 0, 6.283);
          g.fill();
        }
      };
      raf = requestAnimationFrame(tick);
    }
    return {
      el: wrap,
      stop() {
        alive = false;
        cancelAnimationFrame(raf);
      },
    };
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
    const chapter = storyChapter(key);
    const dragon = key === 'pre200' || key === 'dragonFall' || key === 'post200';
    const bigTitle = key.startsWith('ch') || key === 'pre200';
    const avatar = h('div', { class: 'story-avatar' });
    const nameEl = h('div', { class: 'story-name' });
    const textEl = h('div', { class: 'story-text' });
    const nextEl = h('div', { class: 'story-next' }, '▼');
    const backdrop = storyBackdrop(chapter, dragon ? 'dragon' : '');
    // 舞台上的人物：左边主角 / 国王，右边怪物；说话的亮起来，没说话的暗下去
    const slotL = h('div', { class: 'story-actor left' });
    const slotR = h('div', { class: 'story-actor right' });
    const actors = { left: { el: slotL, who: null }, right: { el: slotR, who: null } };
    const end = (read) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      backdrop.stop();
      el.remove();
      if (!opts.replay || read) UI.announce(P.markStory(G().save, key, read));
      G().persist();
      onDone && onDone();
    };
    const castOn = (who, shout) => {
      const side = LEFT_CAST.includes(who) ? 'left' : 'right';
      const a = actors[side];
      if (a.who !== who) {
        a.who = who;
        a.el.innerHTML = '';
        const big = (D.speakers[who] && D.speakers[who].emoji) ? h('div', { class: 'story-emoji big' }, D.speakers[who].emoji) : (D.speakers[who] && D.speakers[who].hero) || who === 'dang' ? TD.sprites.heroPortrait(240, undefined, undefined, (D.speakers[who] && D.speakers[who].hero) || 'dang') : TD.sprites.portrait(who, who === 'abyssDragon' ? 380 : 300, { dark: key === 'dragonFall' });
        a.el.appendChild(big);
        a.el.classList.toggle('big-boss', who === 'abyssDragon');
        a.el.classList.remove('enter');
        void a.el.offsetWidth;
        a.el.classList.add('enter');
      }
      for (const k of ['left', 'right']) actors[k].el.classList.toggle('active', k === side && actors[k].who !== null);
      a.el.classList.toggle('shout', !!shout);
      if (shout) {
        a.el.classList.remove('shout');
        void a.el.offsetWidth;
        a.el.classList.add('shout');
      }
    };
    const PAUSE = { '，': 4, ',': 4, '、': 3, '。': 8, '！': 8, '？': 8, '…': 6, '—': 4, '.': 6, '!': 6, '?': 6 };
    const show = () => {
      const who = sc.lines[i][0];
      const text = TD.i18n.t(sc.lines[i][1]); // 逐字显示的要先译整句，不然显示到一半的半句话译不了
      const sp = speakerInfo(who, key === 'dragonFall');
      const isHero = who === 'dang' || (D.speakers[who] && D.speakers[who].hero);
      avatar.innerHTML = '';
      avatar.appendChild(sp.img());
      avatar.className = 'story-avatar' + (isHero ? ' hero' : '');
      nameEl.textContent = sp.name;
      nameEl.className = 'story-name' + (isHero ? ' hero' : who === 'king' ? ' king' : ' foe');
      castOn(who, !LEFT_CAST.includes(who) && /[！!]/.test(text.slice(-2)));
      el.classList.toggle('rumble', who === 'abyssDragon');
      el.dataset.line = `${i + 1}/${sc.lines.length}`;
      dots.innerHTML = '';
      for (let d = 0; d < sc.lines.length; d++) dots.appendChild(h('i', { class: d < i ? 'done' : d === i ? 'now' : '' }));
      shown = 0;
      textEl.textContent = '';
      nextEl.classList.add('hidden');
      clearTimeout(timer);
      const step = () => {
        shown++;
        textEl.textContent = text.slice(0, shown);
        if (shown >= text.length) {
          nextEl.classList.remove('hidden');
          return;
        }
        timer = setTimeout(step, 34 + (PAUSE[text[shown - 1]] || 0) * 9);
      };
      timer = setTimeout(step, 38);
      sfx('click');
    };
    const advance = () => {
      const text = TD.i18n.t(sc.lines[i][1]);
      if (shown < text.length) {
        shown = text.length;
        clearTimeout(timer);
        textEl.textContent = text;
        nextEl.classList.remove('hidden');
        return;
      }
      i++;
      if (i >= sc.lines.length) end(true);
      else show();
    };
    const dots = h('div', { class: 'story-dots' });
    const el = h(
      'div',
      { class: 'story-overlay' + (chapter && chapter.abyss ? ' abyss' : '') + (dragon ? ' dragon' : '') },
      backdrop.el,
      h('div', { class: 'story-bar top' }),
      h('div', { class: 'story-bar bottom' }),
      h('div', { class: 'story-stage' }, slotL, slotR),
      h('div', { class: 'story-title' + (bigTitle ? ' big' : '') }, key.startsWith('ch') ? `第${TD.data.chapterNo(+key.slice(2))}章 · ${sc.title}` : sc.title),
      h('div', { class: 'story-box' }, avatar, h('div', { class: 'story-main' }, nameEl, textEl), dots, nextEl),
      h('button', { class: 'btn small story-skip', onclick: (e) => (e.stopPropagation(), sfx('click'), end(false)) }, '跳过 ›')
    );
    el.addEventListener('click', advance);
    R().appendChild(el);
    show();
  };

  // 没播过的段落才播；否则直接继续
  UI.maybeStory = function (key, onDone) {
    if (P.storyDue(G().save, key)) UI.playStory(key, onDone);
    else onDone && onDone();
  };

  // 日记本：按顺序列出所有段落，已解锁的可以重看
  UI.showDiary = function () {
    const s = G().save;
    const order = D.storyOrder;
    const read = order.filter((k) => (s.story || {})[k] === 'read').length;
    const items = order.map((key) => {
      const sc = D.story[key];
      const open = P.storyUnlocked(s, key);
      const side = P.SIDE_STORIES[key];
      const kind = side ? '番外' : key.startsWith('ch') ? '章节' : key.startsWith('pre') ? '战前' : '战后';
      const state = (s.story || {})[key];
      return h(
        'div',
        { class: 'diary-item' + (open ? '' : ' locked') + (key.startsWith('ch') ? ' chapter' : '') },
        h('span', { class: 'diary-kind' }, kind),
        h('div', { class: 'diary-main' }, h('b', null, open ? sc.title : '？？？'), open && sc.diary ? h('p', null, '✎ ' + sc.diary) : null, !open && side ? h('p', null, `用${D.speakers[side.hero].name}通关 ${side.need} 场后解锁（${P.sideWins(s, key)}/${side.need}）`) : null),
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
      h('div', { class: 'diary' }, h('div', { class: 'preview-head' }, h('h2', null, '📔 Kael的守城日记'), h('span', { class: 'tag' }, `已读 ${read} / ${order.length}`)), h('div', { class: 'diary-list' }, items), h('div', { class: 'modal-buttons' }, h('button', { class: 'btn primary', onclick: UI.closeModal }, '合上日记'))),
      { closeOnBack: true, cls: 'wide' }
    );
  };

  // ================= 角色衣柜（设计书 72） =================
  UI.showWardrobe = function () {
    const s = G().save;
    const cards = D.outfits.map((o) => {
      const owned = P.outfitOwned(s, o.id);
      const on = (s.outfit || 'classic') === o.id;
      const img = TD.sprites.heroPortrait(110, on ? 'win' : 'idle', o.id, 'dang');
      return h(
        'button',
        {
          class: 'outfit-card' + (owned ? '' : ' locked') + (on ? ' on' : ''),
          onclick: () => {
            if (owned) {
              sfx('click');
              const wasOther = P.heroId(s) !== 'dang';
              P.setOutfit(s, o.id);
              if (wasOther) UI.toast(`已换成「${o.name}」，由 Kael 出战`);
              G().persist();
              UI.showWardrobe();
              return;
            }
            if (!P.canAfford(s, o.cost)) return sfx('error'), UI.toast(`需要 ${P.costText(o.cost)}（先去商店的汇兑所把银币换成金币）`);
            UI.confirm(`花 ${P.costText(o.cost)} 买下「${o.name}」吗？\n额外属性：${o.bonusText}`, () => {
              const wasOther = P.heroId(s) !== 'dang';
              P.buyOutfit(s, o.id);
              if (wasOther) UI.toast(`已换成「${o.name}」，由 Kael 出战`);
              sfx('buy');
              G().persist();
              UI.showWardrobe();
            });
          },
        },
        h('div', { class: 'outfit-img' }, img),
        h('b', null, o.name),
        h('span', null, o.desc),
        h('span', { class: 'outfit-bonus' }, '✨ ' + o.bonusText),
        owned ? null : h('span', { class: 'outfit-price' }, costEl(o.cost)),
        on ? h('em', null, '穿着') : owned ? h('em', { class: 'own' }, '已拥有') : null
      );
    });
    const n = D.outfits.filter((o) => P.outfitOwned(s, o.id)).length;
    modal(
      h(
        'div',
        { class: 'wardrobe' },
        h('div', { class: 'preview-head' }, h('h2', null, '👕 角色衣柜'), h('span', { class: 'tag' }, `${n} / ${D.outfits.length}`)),
        h('div', { class: 'hint' }, '每位角色都有自己的造型和额外属性，用金币购买，一次穿一位；选中谁，城墙上站的就是谁（额外属性由 Kael 出战时生效，所以会自动换回 Kael）。'),
        h('div', { class: 'outfit-grid' }, cards),
        h('div', { class: 'modal-buttons' }, h('button', { class: 'btn primary', onclick: UI.closeModal }, '好了'))
      ),
      { closeOnBack: true, cls: 'wide' }
    );
  };

  // 进入关卡：Boss 关第一次挑战前先播战前对话
  UI.beginLevel = function (n) {
    UI.closeModal();
    UI.maybeStory('pre' + n, () => G().startBattle(n));
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
      h('h2', null, '城头射手'),
      h('h3', null, '游戏设计 · 程序 · 美术 · 音效'),
      h('p', null, 'Claude（与你一起）'),
      h('h3', null, '出品'),
      h('p', null, 'linshangsheng'),
      h('h3', null, '你的守城记录'),
      h('p', null, `战斗 ${G().save.stats.battles} 次 · 胜利 ${G().save.stats.wins} 次 · 击败怪物 ${G().save.stats.kills} 只`),
      h('p', null, `获得星星 ${Object.values(G().save.levels).reduce((a, r) => a + (r.stars || 0), 0)} / ${Object.keys(D.levels).length * 3}`),
      h('p', { class: 'thanks' }, '谢谢你守住了王国！'),
      h('button', { class: 'btn primary big', onclick: () => (stop(), onDone && onDone()) }, '回到地图')
    );
    _.setScreen(screenEl = h('div', { class: 'screen ending' }, cv, textBox, credits, h('button', { class: 'btn small ending-skip', onclick: () => (stop(), onDone && onDone()) }, '跳过 ›')));
    R().appendChild(screenEl);
    const lines = [
      [1.0, '墨墨"噗"的一声，缩回了一个小团子……'],
      [4.5, 'Kael跑过去，把它抱了起来。头盔"当"地响了一声。'],
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
      // Kael跑过去
      const run = TD.util.clamp((t - 3.5) / 2, 0, 1);
      const heroX = W * 0.25 + (momoX - 60 - W * 0.25) * run;
      const hugging = t > 5.6;
      if (!hugging) TD.sprites.monster(ctx, 'inkBoss', momoX, groundY, momoSize, t, { ai: {} });
      TD.sprites.hero(ctx, heroX, groundY, { t, weapon: 'bow', aimAngle: 0, mood: t > 6 ? 'win' : 'focus', critAge: hugging && t < 6 ? t - 5.6 : 9, outfit: G().save.outfit });
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


  // ================= 真结局演出：打败深渊尽头的焚天巨龙（设计书 130） =================
  // 巨龙伏在深渊底，Kael 他们带着一路收集的光走到它面前，旧弓放在脚边，龙的火化成满天光点，飞回城墙变成一盏不会熄灭的灯
  UI.showTrueEnding = function (onDone) {
    clear();
    const W = C.width;
    const H = C.height;
    const cv = h('canvas', { class: 'ending-canvas', width: W, height: H });
    const ctx = cv.getContext('2d');
    const textBox = h('div', { class: 'ending-text' });
    const st = G().save.stats;
    const credits = h(
      'div',
      { class: 'ending-credits hidden' },
      h('h2', null, '城头射手'),
      h('h3', null, '真正的结局'),
      h('p', null, `战斗 ${st.battles} 次 · 胜利 ${st.wins} 次 · 击败怪物 ${st.kills} 只`),
      h('p', null, `获得星星 ${Object.values(G().save.levels).reduce((a, r) => a + (r.stars || 0), 0)} / ${Object.keys(D.levels).length * 3}`),
      h('h3', null, '出品'),
      h('p', null, 'linshangsheng'),
      h('p', { class: 'thanks' }, '深渊安静了，灯火再也不会熄灭。谢谢你！'),
      h('button', { class: 'btn primary big', onclick: () => (stop(), onDone && onDone()) }, '回到地图')
    );
    _.setScreen(screenEl = h('div', { class: 'screen ending true' }, cv, textBox, credits, h('button', { class: 'btn small ending-skip', onclick: () => (stop(), onDone && onDone()) }, '跳过 ›')));
    R().appendChild(screenEl);
    const lines = [
      [1.0, '深渊的最底下，焚天巨龙静静地伏着，火只剩下最后一点点。'],
      [4.5, 'Nova 的灯、墨墨的歉意、每一个回声交出来的光——Kael 把它们都带来了。'],
      [8.0, '"我们替你站岗。你可以睡了。"旧弓轻轻放在了它的脚边。'],
      [11.5, '龙闭上眼睛，笑了。它守了一千年的火，化成满天的光点，飞向了城墙。'],
      [15.5, '那天夜里，王国城墙上的每一盏灯，都同时亮了。'],
      [19.0, '从此，城墙上多了一盏不会熄灭的灯。'],
    ];
    const clamp = TD.util.clamp;
    const lerp = (a, b, k) => a + (b - a) * k;
    const mixc = (a, b, k) => `rgb(${Math.round(lerp(a[0], b[0], k))},${Math.round(lerp(a[1], b[1], k))},${Math.round(lerp(a[2], b[2], k))})`;
    const stars = [];
    for (let i = 0; i < 70; i++) stars.push([((i * 977) % 1000) / 1000 * W, ((i * 631) % 1000) / 1000 * H * 0.55, 0.6 + ((i * 37) % 10) / 8]);
    const windows = [];
    for (let i = 0; i < 26; i++) windows.push([60 + i * 47 + ((i * 13) % 9), H * 0.5 + ((i * 17) % 5) * 9 + (i % 3) * 3]);
    const motes = [];
    const groundY = H * 0.78;
    const dragonX = W * 0.62;
    const dragonS = 190;
    let t0 = null;
    let raf = 0;
    let shown = 0;
    let last = 0;
    function stop() {
      cancelAnimationFrame(raf);
    }
    const glow = (x, y, r, color, a) => TD.art.drawGlow(ctx, x, y, r, color, a, true);
    function frame(ts) {
      if (t0 === null) t0 = ts;
      const t = (ts - t0) / 1000;
      const dt = Math.min(0.05, t - last);
      last = t;
      // 天空：深渊的暗紫 → 黎明的暖橙
      const k = clamp((t - 12) / 6, 0, 1);
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, mixc([12, 6, 30], [70, 96, 170], k));
      sky.addColorStop(0.6, mixc([34, 14, 52], [255, 176, 120], k));
      sky.addColorStop(1, mixc([20, 8, 30], [255, 214, 150], k));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      for (const [x, y, r] of stars) {
        ctx.globalAlpha = (1 - k) * (0.5 + 0.5 * Math.sin(t * 1.3 + x));
        ctx.fillStyle = '#e8d8ff';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 6.283);
        ctx.fill();
      }
      ctx.restore();
      // 远处的王国城墙剪影：窗子一扇一扇亮起来
      const kd = clamp((t - 13) / 2, 0, 1);
      if (kd > 0) {
        ctx.save();
        ctx.globalAlpha = kd;
        ctx.fillStyle = mixc([24, 14, 40], [60, 40, 70], k);
        ctx.fillRect(0, H * 0.58, W, H * 0.2);
        for (let i = 0; i < 12; i++) {
          const x = 30 + i * 108;
          const hh = 70 + ((i * 29) % 4) * 22;
          ctx.fillRect(x, H * 0.58 - hh, 58, hh + 4);
          ctx.beginPath();
          ctx.moveTo(x - 4, H * 0.58 - hh);
          ctx.lineTo(x + 29, H * 0.58 - hh - 34);
          ctx.lineTo(x + 62, H * 0.58 - hh);
          ctx.fill();
        }
        ctx.restore();
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        windows.forEach(([x, y], i) => {
          const on = clamp((t - 15 - i * 0.1) / 0.4, 0, 1);
          if (on <= 0) return;
          glow(x, y, 26, '#ffd27a', 0.7 * on);
          ctx.fillStyle = `rgba(255,236,170,${0.95 * on})`;
          ctx.fillRect(x - 4, y - 6, 8, 12);
        });
        ctx.restore();
      }
      // 脚下的岩台
      ctx.fillStyle = mixc([14, 8, 22], [70, 52, 60], k);
      ctx.fillRect(0, groundY, W, H - groundY);
      // 巨龙：先是倒伏着、眼睛慢慢亮起来；第 11 秒起身，然后化成光点
      const dragonAlpha = 1 - clamp((t - 12.5) / 3.5, 0, 1);
      const cy = groundY - dragonS * 0.58;
      if (dragonAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = dragonAlpha;
        const ai = t < 11 ? { form: 1, fallen: true, rebirthMax: 1, rebirthTimer: 1 - 0.5 * clamp((t - 2) / 7, 0, 1) } : { form: 1 };
        TD.sprites.monster(ctx, 'abyssDragon', dragonX, t < 11 ? cy : cy - 18 * clamp((t - 11) / 1.5, 0, 1), dragonS, t, { ai });
        ctx.restore();
      }
      // 化成光点
      if (t > 11.5 && t < 16) {
        for (let i = 0; i < 9; i++) motes.push({ x: dragonX + (Math.random() - 0.5) * 460, y: cy + (Math.random() - 0.7) * 170, vx: (Math.random() - 0.7) * 30, vy: -40 - Math.random() * 90, life: 1.8 + Math.random(), age: 0, r: 2 + Math.random() * 3 });
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = motes.length - 1; i >= 0; i--) {
        const m = motes[i];
        m.age += dt;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.vy -= 14 * dt;
        if (m.age > m.life) {
          motes.splice(i, 1);
          continue;
        }
        glow(m.x, m.y, m.r * 5, Math.random() < 0.5 ? '#ffd27a' : '#ffb060', (1 - m.age / m.life) * 0.9);
      }
      ctx.restore();
      // 旧弓：放下以后，微微发光
      const bowK = clamp((t - 8.2) / 1.2, 0, 1);
      if (bowK > 0) {
        const bx = dragonX - 250;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(bx, groundY - 14, 54, '#ffe9a8', 0.5 * bowK * (0.8 + 0.2 * Math.sin(t * 3)));
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = bowK;
        ctx.translate(bx, groundY - 4);
        ctx.rotate(-0.12);
        ctx.strokeStyle = '#7a4a22';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(-8, 0, 30, -1.25, 1.25);
        ctx.stroke();
        ctx.strokeStyle = '#e8d8b0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-8 + Math.cos(-1.25) * 30, Math.sin(-1.25) * 30);
        ctx.lineTo(-8 + Math.cos(1.25) * 30, Math.sin(1.25) * 30);
        ctx.stroke();
        ctx.restore();
      }
      // 变成灯的光：从龙的位置慢慢飞到城墙上空，然后一直亮着
      const lamp = clamp((t - 15) / 3.5, 0, 1);
      if (lamp > 0) {
        const e = 1 - Math.pow(1 - lamp, 3);
        const lx = lerp(dragonX, W * 0.5, e);
        const ly = lerp(cy, H * 0.3, e);
        const pulse = 0.85 + 0.15 * Math.sin(t * 2.2);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(lx, ly, 150 * pulse, '#ff9a4a', 0.5 * lamp);
        glow(lx, ly, 70 * pulse, '#ffd27a', 0.85 * lamp);
        glow(lx, ly, 26, '#fffbe8', lamp);
        for (let i = 0; i < 8; i++) {
          const a = t * 0.4 + (i * 6.283) / 8;
          ctx.strokeStyle = `rgba(255,220,150,${0.22 * lamp})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(lx + Math.cos(a) * 34, ly + Math.sin(a) * 34);
          ctx.lineTo(lx + Math.cos(a) * (90 + 30 * Math.sin(t + i)), ly + Math.sin(a) * (90 + 30 * Math.sin(t + i)));
          ctx.stroke();
        }
        ctx.restore();
      }
      // 人物：从左边走进画面，看着龙；龙化成光以后抬头看
      const walk = clamp(t / 4, 0, 1);
      const kx = lerp(-120, W * 0.3, walk);
      const mood = t > 12 ? 'win' : 'focus';
      // 人物放大一些，站在龙的面前才不显得太小
      ctx.save();
      ctx.translate(0, groundY);
      ctx.scale(1.8, 1.8);
      const gy = 6 / 1.8;
      TD.sprites.hero(ctx, kx / 1.8, gy, { t: walk < 1 ? t * 1.4 : t, weapon: 'bow', aimAngle: 0, mood, critAge: 9, outfit: G().save.outfit });
      TD.sprites.hero(ctx, (kx - 80) / 1.8, gy + 2, { t: walk < 1 ? t * 1.4 : t, weapon: 'bow', aimAngle: 0, mood, critAge: 9, hero: 'ding', outfit: 0 });
      TD.sprites.monster(ctx, 'inkBoss', (kx - 150) / 1.8, gy - 4, 18, t, { ai: {} });
      ctx.restore();
      // 文字
      while (shown < lines.length && t >= lines[shown][0]) {
        textBox.appendChild(h('p', { class: 'ending-line' }, lines[shown][1]));
        shown++;
      }
      if (t > 22) credits.classList.remove('hidden');
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    TD.audio.play('win');
  };


  // ================= 王国小镇（设计书 39） =================
  UI.showTown = function () {
    const s = G().save;
    const W = 960;
    const H = 420;
    const cv = h('canvas', { class: 'town-canvas', width: W, height: H });
    const ctx = cv.getContext('2d');
    const T = D.town;
    // 每排 7 栋房子（设计书 52.7：第七章后 14 位邻居）
    const slot = (i) => ({ x: 75 + (i % 7) * 135, y: i < 7 ? 175 : 360 });
    const friends = T.map((f) => P.isCleared(s, f.level));
    const lamp = !!(D.townLamp && P.isCleared(s, D.townLamp.level));
    let lampSaid = -1;
    const LX = 548; // 灯挂在城堡上方，两栋房子的屋顶之间
    const LY = 26;
    const bubbles = {}; // 序号 → { text, until }
    const said = {};
    const chapterColor = (lv) => D.chapterOf(lv).theme.accent;
    let t0 = null;
    let raf = 0;
    const draw = (ts) => {
      if (!cv.isConnected) return cancelAnimationFrame(raf);
      if (t0 === null) t0 = ts;
      const t = (ts - t0) / 1000;
      // 街道背景
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#bfe8ff');
      sky.addColorStop(1, '#fff3dc');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#c9b8e6';
      TD.sprites.roundRect(ctx, 420, 20, 120, 60, 8);
      ctx.fill();
      for (const tx of [420, 470, 520]) {
        ctx.fillStyle = '#9a86c6';
        ctx.beginPath();
        ctx.moveTo(tx - 6, 22);
        ctx.lineTo(tx + 10, -2);
        ctx.lineTo(tx + 26, 22);
        ctx.fill();
      }
      ctx.fillStyle = '#e8d6b0';
      ctx.fillRect(0, 190, W, 26);
      ctx.fillRect(0, 375, W, 26);
      T.forEach((f, i) => {
        const { x, y } = slot(i);
        // 房子
        ctx.fillStyle = friends[i] ? '#fff8e8' : '#e6e0d6';
        TD.sprites.roundRect(ctx, x - 50, y - 120, 100, 80, 6);
        ctx.fill();
        ctx.strokeStyle = '#8a6a4a';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = friends[i] ? chapterColor(f.level) : '#bdb5a8';
        ctx.beginPath();
        ctx.moveTo(x - 60, y - 118);
        ctx.lineTo(x, y - 160);
        ctx.lineTo(x + 60, y - 118);
        ctx.fill();
        ctx.fillStyle = friends[i] ? '#ffe28a' : '#cfc8bc';
        ctx.fillRect(x - 12, y - 100, 24, 20);
        if (friends[i]) {
          const def = D.monsters[f.boss];
          TD.sprites.monster(ctx, f.boss, x, y - 6, def.size * 0.55, t + i, { seed: i });
        } else {
          // 告示牌
          ctx.fillStyle = '#a07a52';
          ctx.fillRect(x - 3, y - 36, 6, 34);
          ctx.fillStyle = '#d9b47a';
          TD.sprites.roundRect(ctx, x - 38, y - 58, 76, 26, 4);
          ctx.fill();
          ctx.fillStyle = '#5b3c2a';
          ctx.font = 'bold 13px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('？？？', x, y - 40);
        }
        ctx.fillStyle = '#5b3c2a';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(friends[i] ? D.monsters[f.boss].name : `第 ${f.level} 关`, x, y + 14);
      });
      // 打败巨龙以后：城堡上空的那盏灯，缓缓脉动，带几道光
      if (lamp) {
        const p = 0.85 + 0.15 * Math.sin(t * 2);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        TD.art.drawGlow(ctx, LX, LY, 90 * p, '#ff9a4a', 0.5, true);
        TD.art.drawGlow(ctx, LX, LY, 40 * p, '#ffd27a', 0.9, true);
        TD.art.drawGlow(ctx, LX, LY, 14, '#fffbe8', 1, true);
        ctx.restore();
      }
      // 对话气泡最后画，盖在房子上面
      T.forEach((f, i) => {
        const b = bubbles[i];
        if (!b || t >= b.until) return;
        const { x, y } = slot(i);
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        const w = Math.min(420, ctx.measureText(b.text).width + 24);
        const bx = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, x));
        ctx.fillStyle = 'rgba(255,255,255,0.97)';
        TD.sprites.roundRect(ctx, bx - w / 2, y - 150, w, 34, 10);
        ctx.fill();
        ctx.strokeStyle = '#5b3c2a';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#3b2a1e';
        ctx.fillText(b.text, bx, y - 128, w - 16);
      });
      // 灯说的话：画在灯下面
      const lb = bubbles.lamp;
      if (lb && t < lb.until) {
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        const w = Math.min(440, ctx.measureText(lb.text).width + 24);
        ctx.fillStyle = 'rgba(255,248,230,0.97)';
        TD.sprites.roundRect(ctx, Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, LX)) - w / 2, 56, w, 34, 10);
        ctx.fill();
        ctx.strokeStyle = '#b86a1a';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#3b2a1e';
        ctx.fillText(lb.text, Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, LX)), 78, w - 16);
      }
      raf = requestAnimationFrame(draw);
    };
    cv.addEventListener('click', (e) => {
      const { x: px, y: py } = TD.util.stagePoint(e.clientX, e.clientY, cv.getBoundingClientRect(), W, H, G().rotated);
      if (lamp && Math.hypot(px - LX, py - LY) < 44) {
        sfx('click');
        lampSaid = (lampSaid + 1) % D.townLamp.lines.length;
        bubbles.lamp = { text: D.townLamp.lines[lampSaid], until: (performance.now() - t0) / 1000 + 5 };
        return;
      }
      T.forEach((f, i) => {
        const { x, y } = slot(i);
        if (Math.abs(px - x) < 70 && py > y - 170 && py < y + 20) {
          if (!friends[i]) {
            sfx('error');
            UI.toast(`通关第 ${f.level} 关后，这里会搬来一位新邻居`);
            return;
          }
          sfx('click');
          said[i] = ((said[i] === undefined ? -1 : said[i]) + 1) % f.lines.length;
          bubbles[i] = { text: f.lines[said[i]], until: (performance.now() - t0) / 1000 + 4 };
        }
      });
    });
    const n = friends.filter(Boolean).length;
    modal(
      h('div', { class: 'town' }, h('div', { class: 'preview-head' }, h('h2', null, '🏘 王国小镇'), h('span', { class: 'tag' }, `邻居 ${n} / ${T.length}`)), h('p', { class: 'hint' }, '打败的 Boss 都搬到了小镇上。点一点，听听它们现在过得怎么样。'), cv, h('div', { class: 'modal-buttons' }, h('button', { class: 'btn primary', onclick: UI.closeModal }, '回地图'))),
      { closeOnBack: true, cls: 'wide town-modal' }
    );
    raf = requestAnimationFrame(draw);
  };

})((globalThis.TD = globalThis.TD || {}));
