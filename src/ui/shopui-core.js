// 商店各页的纯函数（不碰 DOM，可在 Node 里测）：缺口计算、折叠提示的开合状态、分段控件的数据
(function (TD) {
  'use strict';
  const S = (TD.shopui = {});
  const KINDS = ['copper', 'silver', 'gold', 'diamond'];

  // 还差多少：cost 与 have 都是 { copper, silver, gold, diamond }；够了返回 null，不够返回只含缺口的对象
  S.shortage = function (cost, have) {
    if (!cost) return null;
    const out = {};
    let any = false;
    for (const k of KINDS) {
      const need = cost[k] || 0;
      const gap = need - ((have && have[k]) || 0);
      if (need > 0 && gap > 0) {
        out[k] = gap;
        any = true;
      }
    }
    return any ? out : null;
  };
  // 缺口转成有序的 [币种, 数量] 列表（界面按固定顺序画）
  S.shortageParts = function (gap) {
    return gap ? KINDS.filter((k) => gap[k] > 0).map((k) => [k, gap[k]]) : [];
  };

  // 折叠提示：状态是个普通对象 { [id]: true }，默认全部折叠
  S.tipOpen = (state, id) => !!(state && state[id]);
  S.tipToggle = function (state, id) {
    state[id] = !state[id];
    return state[id];
  };

  // 分段控件：给出选项 id 列表和当前值；当前值不在列表里就退回第一项
  S.segments = function (ids, current) {
    const cur = ids.includes(current) ? current : ids[0];
    return ids.map((id) => ({ id, on: id === cur }));
  };
})(globalThis.TD || (globalThis.TD = {}));
