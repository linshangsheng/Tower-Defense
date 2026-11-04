// 标题页的纯函数：最近进度、首次启动判断（不碰 DOM，方便测试）
(function (TD) {
  'use strict';
  const D = TD.data;
  const T = (TD.titleinfo = {});

  // 没有任何通关记录 = 首次启动
  T.isFirstRun = (save) => {
    for (const k of Object.keys(save.levels || {})) if ((save.levels[k] || {}).clears > 0) return false;
    return true;
  };

  // 最近进度：{ level, chapter, stars }；没通关过任何一关返回 null。level 是打通的最高关
  T.progress = (save) => {
    if (T.isFirstRun(save)) return null;
    let level = 0;
    let stars = 0;
    for (const k of Object.keys(save.levels)) {
      const r = save.levels[k] || {};
      stars += r.stars | 0;
      if (r.clears > 0) level = Math.max(level, +k);
    }
    const ch = D.chapterOf(level);
    return { level, chapter: ch ? ch.name : '', stars };
  };

  // 一行小字的中文版（界面里分成三段各自翻译，见 UI.showTitle）
  T.progressText = (save) => {
    const p = T.progress(save);
    return p ? `第 ${p.level} 关 · ${p.chapter} · ${p.stars} 星` : '';
  };
})(globalThis.TD);
