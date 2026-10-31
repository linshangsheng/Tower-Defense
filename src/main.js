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
    // 浏览器不让存（无痕模式、禁用了本地存储、空间满了）：只提醒一次，别每次都弹
    if (!TD.saveStore.write(game.save) && !game.saveWarned) {
      game.saveWarned = true;
      if (TD.ui && TD.ui.toast) TD.ui.toast('浏览器不允许保存存档（可能是无痕模式），关闭页面后进度会丢失。');
    }
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
    // 失败时先看城墙坍塌（约 2 秒，设计书 61.6），再出结算
    battle.on('end', (res) => setTimeout(() => game.onBattleEnd(battle), res.win || battle.wall.hp > 0 ? 1300 : 2400));
    // 每用一次，已装备的这种道具少一个，马上记进存档（中途退出、刷新也不会白白返还，设计书 82）
    battle.on('item', (e) => {
      P.consumeItem(s, e.id);
      game.persist();
    });
    battle.on('waveStart', () => TD.audio.play('wave'));
    battle.on('shoot', () => TD.audio.play('shoot'));
    battle.on('death', (e) => e.copper && TD.audio.play('coin'));
    battle.on('skill', (e) => TD.audio.play({ drum: 'drum', thunder: 'thunder', frost: 'frost', repair: 'heal' }[e.id] || 'skill'));
    // 雷霆一击的第 2 道雷起每道也响一声（第 1 道随技能一起响）
    battle.on('thunder', (e) => e.idx > 0 && TD.audio.play('thunder'));
    battle.on('item', (e) => TD.audio.play('item_' + e.id));
    battle.on('meteorHit', () => TD.audio.play('meteorHit'));
    battle.on('scrollBolt', () => TD.audio.play('scrollBolt'));
    battle.on('barrierBreak', () => TD.audio.play('barrierBreak'));
    battle.on('bossWarn', () => TD.audio.play('warn'));
    // 焚天巨龙（设计书 114）：用现成的音效凑——蓄力 = 警告音，龙息 = 陨石落地，龙吼 = 重击城墙，雷暴 = 落雷
    battle.on('dragonFire', () => TD.audio.play('meteorHit'));
    battle.on('dragonShock', () => TD.audio.play('bigWall'));
    battle.on('dragonBolt', () => TD.audio.play('bolt'));
    battle.on('dragonIce', () => TD.audio.play('frost'));
    battle.on('bossReturn', () => TD.audio.play('warn'));
    // 焚天巨龙第一条命倒下：暂停战斗，讲一段剧情；剧情结束（或战斗里等满 rebirthDelay 秒）后化作黑色巨龙（设计书 115）
    battle.on('dragonFall', () => {
      TD.audio.play('bigWall');
      game.introPaused = true;
      TD.ui.playStory('dragonFall', () => (game.introPaused = game.introQueue.length > 0), { replay: true });
    });
    battle.on('dragonRebirth', () => {
      TD.audio.play('warn');
      (s.seenMonsters = s.seenMonsters || {}).abyssDragon2 = true;
    });
    // Boss 登场：音乐给一记重击（设计书 64.5）
    battle.on('spawn', (m) => m.def && m.def.boss && TD.music.stinger('boss'));
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
    // 第七章（设计书 52.6）
    battle.on('bubblePop', () => TD.audio.play('bubblePop'));
    battle.on('shell', () => TD.audio.play('shell'));
    battle.on('spikes', () => TD.audio.play('spikes'));
    battle.on('leap', () => TD.audio.play('splash'));
    battle.on('clamOpen', () => TD.audio.play('clam'));
    battle.on('tentacleGrow', () => TD.audio.play('splash'));
    battle.on('win', () => {
      game.renderer.mood = 'win';
      TD.audio.play('win');
      TD.music.battleEnd(true);
    });
    battle.on('lose', () => {
      game.renderer.mood = 'lose';
      TD.audio.play('lose');
      TD.music.battleEnd(false);
    });
    game.persist();
    const lvType = TD.data.levels[battle.stage] && TD.data.levels[battle.stage].type;
    TD.music.play(TD.music.levelTheme(TD.data.chapterOf(battle.stage).music || TD.data.chapterOf(battle.stage).id, battle.stage, lvType), 'battle');
    battle.on('waveStart', (e) => {
      if (e.chapter) TD.music.play(TD.music.levelTheme(e.chapter, battle.stage, lvType), 'battle');
    });
    TD.ui.showBattle(battle);
  };

  game.onBattleEnd = function (battle) {
    if (game.battle !== battle) return;
    if (battle.mode) {
      const m = battle.mode;
      const reward =
        m.kind === 'endless'
          ? TD.modes.applyEndlessResult(game.save, battle.result)
          : m.kind === 'tower'
          ? TD.modes.applyTowerResult(game.save, battle.result)
          : TD.modes.applyDailyResult(game.save, m.info, battle.result);
      game.persist();
      if (m.kind === 'tower') {
        // 九层妖塔（设计书 74）：过了一层 → 选择领钻石还是继续；通关第 9 层或失败 → 结算
        if (reward.win && !reward.final) TD.ui.showTowerChoice(reward);
        else TD.ui.showTowerResult(reward);
        return;
      }
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
        (battle.levelNo === 200 ? TD.ui.showTrueEnding : TD.ui.showEnding)(() => {
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
    // 放弃妖塔挑战 = 失败，门票不退（设计书 74.2）
    if (game.battle && game.battle.mode && game.battle.mode.kind === 'tower') TD.modes.towerFail(game.save);
    TD.ui.closeModal();
    game.battle = null;
    game.renderer.battle = null;
    game.paused = false;
    game.persist();
    TD.ui.showMap(TD.data.chapterOf(n).id);
  };

  // 帧循环连续出错（设计书 111）：退回地图，别让界面卡死
  game.crash = function (err) {
    try {
      if (game.battle) {
        const n = game.battle.stage;
        TD.ui.closeModal();
        game.battle = null;
        game.renderer.battle = null;
        game.paused = false;
        game.introPaused = false;
        game.persist();
        TD.ui.showMap(TD.data.chapterOf(n).id);
      }
      TD.ui.toast('游戏出了点小问题，已回到地图。如果反复出现，请刷新页面。');
    } catch (e) {
      /* 实在恢复不了就等玩家刷新页面 */
    }
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

  game.refit = () => fit();

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
    if (!b.itemReady(i) || b.waveState === 'prepare') {
      TD.audio.play('error');
      if (!it) return;
      if (it.left <= 0) TD.ui.toast('这种道具用完了');
      else if (it.cd > 0) TD.ui.toast(`冷却中，还要 ${Math.ceil(it.cd)} 秒`);
      else TD.ui.toast('第一波怪物出来后才能用道具');
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
  // 手机竖着拿（或者锁了自动旋转、在 App 内置浏览器里网页转不过来）时，把整个舞台顺时针转 90° 铺满屏幕：
  // 玩家把手机侧过来看就是横屏，不转手机也能玩（设计书 123）。电脑上窗口再窄也不转（宽度 > 900 才算电脑）
  function fit() {
    const stage = document.getElementById('stage');
    const w = window.innerWidth;
    const h = window.innerHeight;
    const rotated = h > w && w <= 900;
    const s = rotated ? Math.min(h / C.width, w / C.height) : Math.min(w / C.width, h / C.height);
    stage.style.transform = `translate(-50%, -50%) ${rotated ? 'rotate(90deg) ' : ''}scale(${s})`;
    game.scale = s;
    game.rotated = rotated;
    // 大字模式（设计书 47）：自动 = 缩放小于 0.75（手机）时开启
    const lt = (game.save && game.save.settings.largeText) || 'auto';
    const large = lt === 'on' || (lt === 'auto' && s < 0.75);
    document.getElementById('ui').classList.toggle('large-text', large);
  }

  function canvasPoint(e) {
    const canvas = game.renderer.canvas;
    return TD.util.stagePoint(e.clientX, e.clientY, canvas.getBoundingClientRect(), C.width, C.height, game.rotated);
  }

  // ---------- 主循环 ----------
  // 防卡死（设计书 111）：①先排下一帧再干活，某一帧出错也不会让整个游戏停住；②一帧里模拟逻辑最多花 20 毫秒，
  // 电脑慢的时候宁可让游戏稍微变慢，也不让一帧越拖越长；③帧间隔交给自适应画质，持续太卡就自动降低画面负担；
  // ④连续出错太多次（战斗卡在坏状态）就退回主页，不让界面卡死
  let last = 0;
  let errStreak = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    try {
      frameBody(ts);
      errStreak = 0;
    } catch (e) {
      errStreak++;
      if (errStreak === 1 && typeof console !== 'undefined') console.error('frame loop error', e);
      if (errStreak >= 40) {
        errStreak = 0;
        TD.game.crash && TD.game.crash(e);
      }
    }
  }
  function frameBody(ts) {
    const raw = ts - last;
    const dt = Math.min(0.05, raw / 1000 || 0);
    last = ts;
    const b = game.battle;
    let renderDt = dt;
    if (b && !game.paused && !game.introPaused) {
      if (!b.over) game.playSeconds = (game.playSeconds || 0) + dt; // 休息提醒（设计书 40）
      const step = 1 / C.tickRate;
      game.acc += dt * game.speed;
      let n = 0;
      const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
      while (game.acc >= step && n < 12) {
        b.step(step);
        game.acc -= step;
        n++;
        if (t0 && performance.now() - t0 > 20) {
          game.acc = Math.min(game.acc, step); // 来不及就不补了：游戏稍微变慢，但不会越补越卡
          break;
        }
      }
      renderDt = dt * game.speed;
    } else if (game.paused || game.introPaused) renderDt = 0;
    // 暂停、切后台时的间隔不算
    if (TD.quality && !document.hidden && !game.paused && !game.introPaused) TD.quality.record(raw);
    game.renderer.render(renderDt);
    // 门户（设计书 128）：战斗进行中、没暂停、没在播开场 / 剧情 = 真正在玩
    TD.portal.setPlaying(!!b && !b.over && !game.paused && !game.introPaused && !document.hidden);
    if (b) {
      TD.ui.updateHud();
      if (!b.over) {
        const ratio = b.wall.hp / b.wall.max;
        const boss = b.monsters.some((m) => m.def.boss && !m.dead);
        const low = ratio < 0.4;
        TD.music.setTension(boss && low ? 3 : boss ? 2 : low ? 1 : 0);
      }
    }
  }

  function init() {
    TD.i18n.init(); // 多语言：翻译页面上的文字，并盯着之后出现的文字（设计书 83）
    game.save = TD.saveStore.load() || P.newSave();
    // 妖塔战斗中途刷新页面 = 失败（设计书 74.4）；已通过、等待选择的状态保留
    TD.modes.towerRunState(game.save, false);
    // 画质（设计书 111）：网址带 ?q=low / medium / high 时临时强制（页面卡得连设置都点不开时用），否则按设置里的来
    const urlQ = /[?&]q=(auto|high|medium|low)\b/.exec(location.search);
    if (TD.quality) TD.quality.setMode(urlQ ? urlQ[1] : game.save.settings.quality || 'auto');
    // 自动降画质时提醒一次，免得玩家以为画面坏了
    if (TD.quality)
      TD.quality.onChange = (level, why) => {
        if (why === 'slow' && !game.qualityToasted && TD.ui && TD.ui.toast) {
          game.qualityToasted = true;
          TD.ui.toast('电脑有点吃力，已自动降低画面特效以保持流畅（可在设置里调整画质）。');
        }
      };
    TD.audio.enabled = game.save.settings.sound !== false;
    TD.music.enabled = game.save.settings.music !== false;
    TD.audio.setVolume((game.save.settings.sfxVolume !== undefined ? game.save.settings.sfxVolume : 100) / 100);
    TD.music.setVolume((game.save.settings.musicVolume !== undefined ? game.save.settings.musicVolume : 100) / 100);
    TD.portal.init();
    TD.portal.loadingStart();
    const canvas = document.getElementById('game');
    game.renderer = new TD.Renderer(canvas);
    TD.ui.init(game);
    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);

    // 首次交互时解锁音频
    // 手机上触摸的 pointerdown 不算"用户操作"，手指抬起（pointerup / touchend / click）才算：这些事件都监听，
    // 直到音频真的 running 为止；之后不再监听，免得每次点击都白做一遍（设计书 125）
    // 浏览器只允许在用户操作里进全屏：第一次点击 / 按键就进（设计书 66.2），同样要等手指抬起
    let triedFull = false;
    let audioOk = false;
    const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
    const unlock = (e) => {
      if (!audioOk) {
        audioOk = TD.audio.unlock();
        setTimeout(() => TD.music.resume(), 50);
      }
      if (!triedFull && e.type !== 'pointerdown') {
        triedFull = true;
        if (game.save.settings.fullscreen !== false) TD.ui.setFullscreen(true);
      }
      if (audioOk && triedFull) for (const ev of UNLOCK_EVENTS) window.removeEventListener(ev, unlock, true);
    };
    for (const ev of UNLOCK_EVENTS) window.addEventListener(ev, unlock, true);
    // 切回来（接完电话、从别的 App 回来）时 iOS 会把音频打断，回来后再试着恢复
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && audioOk) TD.audio.unlock();
    });

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
      else if (k.length === 1 && 'qwerzxc'.includes(k)) game.tryItem('qwerzxc'.indexOf(k));
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
    // 启动动画（设计书 57.4）：自动化测试里跳过（网址带 ?splash 时强制播放）
    const boot = document.getElementById('boot');
    const wantSplash = TD.logo && (!navigator.webdriver || /splash/.test(location.search));
    if (wantSplash) TD.logo.playSplash(document.getElementById('stage'));
    TD.portal.loadingStop();
    if (boot) {
      boot.classList.add('gone');
      setTimeout(() => boot.remove(), 600);
    }
    // 趁动画播放时把下一关的战场背景先画好，第一次进战斗不卡
    setTimeout(() => game.renderer.prewarm(P.highestCleared(game.save) + 1), 120);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})((globalThis.TD = globalThis.TD || {}));
