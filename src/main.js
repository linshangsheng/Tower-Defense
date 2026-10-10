// 入口：主循环、输入、在界面和战斗之间切换
(function (TD) {
  'use strict';

  const C = TD.config;
  const P = TD.progression;
  const D = TD.data;

  const game = (TD.game = {
    save: null,
    battle: null,
    renderer: null,
    speed: 1,
    paused: false,
    pendingLane: null, // { kind: 'skill'|'item', index }
    acc: 0,
  });

  game.persist = function () {
    TD.saveStore.write(game.save);
  };

  game.resetSave = function () {
    TD.saveStore.clear();
    game.save = P.newSave();
    game.persist();
  };

  game.startBattle = function (n) {
    const s = game.save;
    const lo = P.battleLoadout(s);
    // 幸运符在战斗开始时生效并消耗
    if (lo.items.includes('charm')) P.consumeItem(s, 'charm');
    const battle = new TD.Battle({ level: n, stats: P.heroStats(s), loadout: lo, seed: (Date.now() & 0xffffff) + n });
    game.battle = battle;
    game.paused = false;
    game.pendingLane = null;
    game.acc = 0;
    game.speed = s.settings.speed || 1;
    game.renderer.attach(battle);
    battle.on('end', () => setTimeout(() => game.onBattleEnd(battle), 1300));
    battle.on('item', (e) => P.consumeItem(s, e.id));
    battle.on('waveStart', () => TD.audio.play('wave'));
    battle.on('shoot', () => TD.audio.play('shoot'));
    battle.on('death', (e) => e.copper && TD.audio.play('coin'));
    battle.on('skill', (e) => TD.audio.play({ drum: 'drum', thunder: 'thunder', frost: 'frost', repair: 'heal' }[e.id] || 'skill'));
    battle.on('item', (e) => TD.audio.play({ bomb: 'boom', patch: 'heal', freeze: 'frost' }[e.id] || 'skill'));
    battle.on('bossWarn', () => TD.audio.play('warn'));
    battle.on('supply', (e) => {
      setPending(null);
      TD.audio.play('skill');
      TD.ui.showSupply(battle, e.choices);
    });
    battle.on('bossInterrupt', () => TD.audio.play('interrupt'));
    battle.on('win', () => {
      game.renderer.mood = 'win';
      TD.audio.play('win');
    });
    battle.on('lose', () => {
      game.renderer.mood = 'lose';
      TD.audio.play('lose');
    });
    game.persist();
    TD.ui.showBattle(battle);
  };

  game.onBattleEnd = function (battle) {
    if (game.battle !== battle) return;
    const reward = P.applyResult(game.save, battle.levelNo, battle.result);
    game.persist();
    // 第一次打败最终 Boss：先播结局演出
    if (battle.level.final && battle.result.win && reward.firstClear) {
      game.battle = null;
      game.renderer.battle = null;
      TD.ui.showEnding(() => {
        TD.ui.showMap(TD.data.chapterOf(battle.levelNo).id);
        TD.ui.showResult(battle, reward);
      });
      return;
    }
    TD.ui.showResult(battle, reward);
  };

  game.quitBattle = function () {
    const n = game.battle ? game.battle.levelNo : 1;
    TD.ui.closeModal();
    game.battle = null;
    game.renderer.battle = null;
    game.paused = false;
    game.persist();
    TD.ui.showMap(TD.data.chapterOf(n).id);
  };

  game.pickSupply = function (id) {
    const b = game.battle;
    if (!b || !b.pendingSupply) return;
    if (b.chooseSupply(id)) {
      game.save.stats.seenSupply = true;
      game.persist();
      TD.audio.play('buy');
      TD.ui.closeModal();
    }
  };

  game.togglePause = function () {
    const b = game.battle;
    if (!b || b.over || b.pendingSupply) return;
    game.paused = !game.paused;
    if (game.paused) TD.ui.showPause();
    else TD.ui.closeModal();
  };

  game.toggleSpeed = function () {
    game.speed = game.speed === 2 ? 1 : 2;
    game.save.settings.speed = game.speed;
    game.persist();
    TD.ui.updateHud();
  };

  game.toggleAuto = function () {
    const b = game.battle;
    if (!b) return;
    b.autoCast = !b.autoCast;
    game.save.loadout.autoCast = b.autoCast;
    game.persist();
    TD.ui.updateHud();
  };

  game.cycleTarget = function () {
    const b = game.battle;
    if (!b) return;
    const keys = Object.keys(D.targetModes);
    b.target = keys[(keys.indexOf(b.target) + 1) % keys.length];
    game.save.loadout.target = b.target;
    game.persist();
    TD.ui.updateHud();
  };

  game.callWave = function () {
    const b = game.battle;
    if (!b || game.paused) return;
    const bonus = b.callNextWave();
    if (bonus >= 0) TD.audio.play('coin');
  };

  function setPending(p) {
    game.pendingLane = p;
    game.renderer.highlightLanes = !!p;
    TD.ui.updateHud();
  }

  game.trySkill = function (i) {
    const b = game.battle;
    if (!b || game.paused || b.over) return;
    const sk = b.skills[i];
    if (!sk) return;
    if (!b.skillReady(i)) {
      TD.audio.play('error');
      return;
    }
    if (sk.def.targetLane && b.lanes > 1) {
      if (game.pendingLane && game.pendingLane.kind === 'skill' && game.pendingLane.index === i) setPending(null);
      else setPending({ kind: 'skill', index: i });
      return;
    }
    b.castSkill(i, 0);
  };

  game.tryItem = function (i) {
    const b = game.battle;
    if (!b || game.paused || b.over) return;
    const it = b.items[i];
    if (!it || it.used || b.waveState === 'prepare') {
      TD.audio.play('error');
      return;
    }
    if (it.def.targetLane && b.lanes > 1) {
      if (game.pendingLane && game.pendingLane.kind === 'item' && game.pendingLane.index === i) setPending(null);
      else setPending({ kind: 'item', index: i });
      return;
    }
    b.useItem(i, 0);
  };

  function laneClick(lane) {
    const p = game.pendingLane;
    const b = game.battle;
    if (!p || !b || lane < 0) return;
    if (p.kind === 'skill') b.castSkill(p.index, lane);
    else b.useItem(p.index, lane);
    setPending(null);
  }

  // ---------- 缩放适配 ----------
  function fit() {
    const stage = document.getElementById('stage');
    const s = Math.min(window.innerWidth / C.width, window.innerHeight / C.height);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
    game.scale = s;
  }

  function canvasPoint(e) {
    const canvas = game.renderer.canvas;
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * C.width, y: ((e.clientY - r.top) / r.height) * C.height };
  }

  // ---------- 主循环 ----------
  let last = 0;
  function frame(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0);
    last = ts;
    const b = game.battle;
    let renderDt = dt;
    if (b && !game.paused) {
      const step = 1 / C.tickRate;
      game.acc += dt * game.speed;
      let n = 0;
      while (game.acc >= step && n < 12) {
        b.step(step);
        game.acc -= step;
        n++;
      }
      renderDt = dt * game.speed;
    } else if (game.paused) renderDt = 0;
    game.renderer.render(renderDt);
    if (b) TD.ui.updateHud();
    requestAnimationFrame(frame);
  }

  function init() {
    game.save = TD.saveStore.load() || P.newSave();
    TD.audio.enabled = game.save.settings.sound !== false;
    const canvas = document.getElementById('game');
    game.renderer = new TD.Renderer(canvas);
    TD.ui.init(game);
    fit();
    window.addEventListener('resize', fit);

    // 首次交互时解锁音频
    const unlock = () => TD.audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    canvas.addEventListener('pointermove', (e) => {
      if (!game.pendingLane) return;
      game.renderer.hoverLane = game.renderer.laneAt(canvasPoint(e).y);
    });
    canvas.addEventListener('click', (e) => {
      if (game.pendingLane) laneClick(game.renderer.laneAt(canvasPoint(e).y));
    });
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      setPending(null);
    });
    window.addEventListener('keydown', (e) => {
      const b = game.battle;
      if (!b || b.over) return;
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      const k = e.key.toLowerCase();
      if (b.pendingSupply) {
        if (k >= '1' && k <= '3' && b.pendingSupply[+k - 1]) game.pickSupply(b.pendingSupply[+k - 1]);
        return;
      }
      if (k === ' ' || k === 'escape') {
        e.preventDefault();
        if (k === 'escape' && game.pendingLane) setPending(null);
        else game.togglePause();
        return;
      }
      if (game.paused) return;
      if (k >= '1' && k <= '3') game.trySkill(+k - 1);
      else if (k === 'q' || k === 'w' || k === 'e') game.tryItem('qwe'.indexOf(k));
      else if (k === 'f') game.toggleSpeed();
      else if (k === 'n') game.callWave();
      else if (k === 't') game.cycleTarget();
    });
    // 页面切到后台时自动暂停
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && game.battle && !game.battle.over && !game.paused) game.togglePause();
    });

    TD.ui.showTitle();
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})((globalThis.TD = globalThis.TD || {}));
