// 游戏门户 SDK（设计书 128）：CrazyGames 版本用。门户的 SDK 脚本由打包工具塞进 index.html（globalThis.CrazyGames）；
// 没有 SDK（普通版、离线、被拦截）时所有调用都是空操作，游戏照常运行。
// 需要告诉门户的事：加载开始 / 结束、真正在玩（战斗进行中、没暂停）/ 没在玩（菜单、暂停、结算）。
(function (TD) {
  'use strict';

  const Portal = (TD.portal = { ready: false, failed: false, playing: false, loading: false, log: [] });
  const queue = [];

  const sdk = () => {
    try {
      return globalThis.CrazyGames && globalThis.CrazyGames.SDK;
    } catch (e) {
      return null;
    }
  };
  Portal.active = () => !!(TD.config && TD.config.portal === 'crazygames');

  function run(name, fn) {
    if (!Portal.active() || Portal.failed) return;
    if (!Portal.ready) {
      queue.push([name, fn]);
      return;
    }
    try {
      fn(sdk());
      Portal.log.push(name);
    } catch (e) {
      /* SDK 出错不能影响游戏 */
    }
  }

  // 初始化：SDK 脚本没加载上就放弃（之后的调用都不做）
  Portal.init = function () {
    if (!Portal.active()) return;
    const s = sdk();
    if (!s || !s.init) {
      Portal.failed = true;
      return;
    }
    let p;
    try {
      p = s.init();
    } catch (e) {
      Portal.failed = true;
      return;
    }
    Promise.resolve(p).then(
      () => {
        Portal.ready = true;
        while (queue.length) {
          const [name, fn] = queue.shift();
          run(name, fn);
        }
      },
      () => {
        Portal.failed = true;
        queue.length = 0;
      }
    );
  };

  Portal.loadingStart = function () {
    if (Portal.loading) return;
    Portal.loading = true;
    run('loadingStart', (s) => s.game.loadingStart());
  };
  Portal.loadingStop = function () {
    if (!Portal.loading) return;
    Portal.loading = false;
    run('loadingStop', (s) => s.game.loadingStop());
  };
  // 每帧调用一次也没关系：状态没变不会重复通知
  Portal.setPlaying = function (on) {
    on = !!on;
    if (on === Portal.playing) return;
    Portal.playing = on;
    run(on ? 'gameplayStart' : 'gameplayStop', (s) => (on ? s.game.gameplayStart() : s.game.gameplayStop()));
  };
})((globalThis.TD = globalThis.TD || {}));
