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

  // mode：{ kind: 'endless' | 'daily', levelDef, stage, info }（普通关卡不传）
  game.startBattle = function (n, mode) {
    const s = game.save;
    game.mode = mode || null;
    const lo = P.battleLoadout(s);
    const rules = (mode && mode.levelDef.rules) || {};
    if (rules.noSkills) lo.active = [];
    if (rules.noItems) lo.items = [];
    // 幸运符在战斗开始时生效并消耗
    if (lo.items.includes('charm')) P.consumeItem(s, 'charm');
    const stats = P.heroStats(s, rules.forceBow ? { weapon: 'bow' } : undefined);
    const seed = mode && mode.kind === 'daily' ? mode.info.seed : (Date.now() & 0xffffff) + (typeof n === 'number' ? n : 7);
    const battle = new TD.Battle({ level: n, levelDef: mode && mode.levelDef, stage: mode && mode.stage, stats, loadout: lo, seed, difficulty: s.settings.difficulty, rally: mode ? 0 : P.rally(s, n) });
    battle.mode = mode || null;
    game.battle = battle;
    game.paused = false;
    game.introPaused = false;
    game.pendingLane = null;
    game.acc = 0;
    game.speed = Math.min(s.settings.speed || 1, P.isCleared(s, 10) ? 3 : 2);
    game.renderer.attach(battle);
    battle.on('end', () => setTimeout(() => game.onBattleEnd(battle), 1300));
    battle.on('item', (e) => P.consumeItem(s, e.id));
    battle.on('waveStart', () => TD.audio.play('wave'));
    battle.on('shoot', () => TD.audio.play('shoot'));
    battle.on('death', (e) => e.copper && TD.audio.play('coin'));
    battle.on('skill', (e) => TD.audio.play({ drum: 'drum', thunder: 'thunder', frost: 'frost', repair: 'heal' }[e.id] || 'skill'));
    battle.on('item', (e) => TD.audio.play({ bomb: 'boom', patch: 'heal', freeze: 'frost' }[e.id] || 'skill'));
    battle.on('bossWarn', () => TD.audio.play('warn'));
    // 新敌人登场卡片：每种怪物只介绍一次
    game.introQueue = [];
    battle.on('spawn', (m) => {
      const seen = (s.seenMonsters = s.seenMonsters || {});
      if (seen[m.type] || m.shade || D.noIntro[m.type] || game.introQueue.includes(m.type)) return;
      seen[m.type] = true;
      game.introQueue.push(m.type);
      if (game.introQueue.length === 1) game.nextIntro();
    });
    battle.on('supply', (e) => {
      setPending(null);
      TD.audio.play('skill');
      TD.ui.showSupply(battle, e.choices);
    });
    battle.on('bossInterrupt', () => TD.audio.play('interrupt'));
    battle.on('streak', () => TD.audio.play('streak'));
    battle.on('bell', () => TD.audio.play('bell'));
    battle.on('combo', () => TD.audio.play('streak'));
    // 第六章（设计书 34.1）
    battle.on('dodge', () => TD.audio.play('dodge'));
    battle.on('shear', () => TD.audio.play('shear'));
    battle.on('staticShock', () => TD.audio.play('zap'));
    battle.on('gust', () => TD.audio.play('gust'));
    battle.on('thunderBolt', () => TD.audio.play('bolt'));
    battle.on('stunBlocked', () => TD.audio.play('ding'));
    battle.on('win', () => {
      game.renderer.mood = 'win';
      TD.audio.play('win');
    });
    battle.on('lose', () => {
      game.renderer.mood = 'lose';
      TD.audio.play('lose');
    });
    game.persist();
    TD.music.play(TD.data.chapterOf(battle.stage).id, 'battle');
    battle.on('waveStart', (e) => {
      if (e.chapter) TD.music.play(e.chapter, 'battle');
    });
    TD.ui.showBattle(battle);
  };

  game.onBattleEnd = function (battle) {
    if (game.battle !== battle) return;
    if (battle.mode) {
      const m = battle.mode;
      const reward = m.kind === 'endless' ? TD.modes.applyEndlessResult(game.save, battle.result) : TD.modes.applyDailyResult(game.save, m.info, battle.result);
      game.persist();
      TD.ui.showModeResult(battle, reward);
      return;
    }
    const reward = P.applyResult(game.save, battle.levelNo, battle.result);
    game.persist();
    const after = () => {
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
    // 首次打败 Boss：先播战后对话（设计书 28.3）
    if (battle.result.win && reward.firstClear) TD.ui.maybeStory('post' + battle.levelNo, after);
    else after();
  };

  game.restartBattle = function () {
    const b = game.battle;
    if (!b) return;
    if (b.mode && b.mode.kind === 'endless') TD.ui.startEndless();
    else game.startBattle(b.levelNo, b.mode || undefined);
  };

  game.quitBattle = function () {
    const n = game.battle ? game.battle.stage : 1;
    TD.ui.closeModal();
    game.battle = null;
    game.renderer.battle = null;
    game.paused = false;
    game.persist();
    TD.ui.showMap(TD.data.chapterOf(n).id);
  };

  game.nextIntro = function () {
    const type = game.introQueue[0];
    if (!type) return;
    game.introPaused = true;
    game.persist();
    TD.ui.showIntro(type, () => {
      game.introQueue.shift();
      if (game.introQueue.length) game.nextIntro();
      else game.introPaused = false;
    });
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
    if (!b || b.over || b.pendingSupply || game.introPaused) return;
    game.paused = !game.paused;
    if (game.paused) TD.ui.showPause();
    else TD.ui.closeModal();
  };

  game.toggleSpeed = function () {
    // 通关第 10 关后解锁 3 倍速（设计书 38.1）
    const max = P.isCleared(game.save, 10) ? 3 : 2;
    game.speed = game.speed >= max ? 1 : game.speed + 1;
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
    if (b && !game.paused && !game.introPaused) {
      if (!b.over) game.playSeconds = (game.playSeconds || 0) + dt; // 休息提醒（设计书 40）
      const step = 1 / C.tickRate;
      game.acc += dt * game.speed;
      let n = 0;
      while (game.acc >= step && n < 12) {
        b.step(step);
        game.acc -= step;
        n++;
      }
      renderDt = dt * game.speed;
    } else if (game.paused || game.introPaused) renderDt = 0;
    game.renderer.render(renderDt);
    if (b) {
      TD.ui.updateHud();
      if (!b.over) {
        const ratio = b.wall.hp / b.wall.max;
        TD.music.setTension(ratio < 0.35 ? 2 : b.monsters.some((m) => m.def.boss && !m.dead) ? 1 : 0);
      }
    }
    requestAnimationFrame(frame);
  }

  function init() {
    game.save = TD.saveStore.load() || P.newSave();
    TD.audio.enabled = game.save.settings.sound !== false;
    TD.music.enabled = game.save.settings.music !== false;
    const canvas = document.getElementById('game');
    game.renderer = new TD.Renderer(canvas);
    TD.ui.init(game);
    fit();
    window.addEventListener('resize', fit);

    // 首次交互时解锁音频
    const unlock = () => {
      TD.audio.unlock();
      setTimeout(() => TD.music.resume(), 50);
    };
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
      if (game.introPaused) {
        if (k === ' ' || k === 'enter' || k === 'escape') {
          e.preventDefault();
          if (TD.ui.introClose) TD.ui.introClose();
        }
        return;
      }
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
