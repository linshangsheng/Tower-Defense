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
  function speakerInfo(id) {
    const sp = D.speakers[id];
    if (sp) return { name: sp.name, img: () => (sp.emoji ? h('div', { class: 'story-emoji' }, sp.emoji) : TD.sprites.heroPortrait(96, undefined, undefined, sp.hero || 'dang')) };
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
      if (!opts.replay || read) UI.announce(P.markStory(G().save, key, read));
      G().persist();
      onDone && onDone();
    };
    const show = () => {
      const [who, text] = sc.lines[i];
      const sp = speakerInfo(who);
      avatar.innerHTML = '';
      avatar.appendChild(sp.img());
      avatar.className = 'story-avatar' + (who === 'dang' || (D.speakers[who] && D.speakers[who].hero) ? ' hero' : '');
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
      h('div', { class: 'story-title' }, key.startsWith('ch') ? `第${'一二三四五六七八九十'[+key.slice(2) - 1]}章 · ${sc.title}` : sc.title),
      h('div', { class: 'story-box' }, avatar, h('div', { class: 'story-main' }, nameEl, textEl), nextEl),
      h('button', { class: 'btn small story-skip', onclick: (e) => (e.stopPropagation(), sfx('click'), end(false)) }, '跳过 ›')
    );
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
      h('div', { class: 'diary' }, h('div', { class: 'preview-head' }, h('h2', null, '📔 Kael的守城日记'), h('span', { class: 'tag' }, `已读 ${read} / ${order.length}`)), h('div', { class: 'diary-list' }, items), h('div', { class: 'modal-buttons' }, h('button', { class: 'btn primary', onclick: UI.closeModal }, '合上日记'))),
      { closeOnBack: true, cls: 'wide' }
    );
  };

  // ================= Kael的衣柜（设计书 30） =================
  UI.showWardrobe = function () {
    const s = G().save;
    const cards = D.outfits.map((o) => {
      const open = P.outfitUnlocked(s, o.id);
      const on = (s.outfit || 'classic') === o.id;
      const img = TD.sprites.heroPortrait(110, on ? 'win' : 'idle', o.id, P.heroId(s));
      return h(
        'button',
        {
          class: 'outfit-card' + (open ? '' : ' locked') + (on ? ' on' : ''),
          onclick: () => {
            if (!open) return sfx('error'), UI.toast(`解锁条件：${o.unlock}`);
            sfx('click');
            P.setOutfit(s, o.id);
            G().persist();
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
      h('div', { class: 'wardrobe' }, h('div', { class: 'preview-head' }, h('h2', null, '👕 Kael的衣柜'), h('span', { class: 'tag' }, `${n} / ${D.outfits.length}`)), h('div', { class: 'outfit-grid' }, cards), h('div', { class: 'modal-buttons' }, h('button', { class: 'btn primary', onclick: UI.closeModal }, '好了'))),
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
      h('h2', null, '最后的堡垒'),
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
      raf = requestAnimationFrame(draw);
    };
    cv.addEventListener('click', (e) => {
      const r = cv.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      const py = ((e.clientY - r.top) / r.height) * H;
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
