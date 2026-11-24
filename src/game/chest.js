// 胜利宝箱（设计书 203）：主线关卡每次胜利，结算页出现 3 张扣着的卡，翻开 1 张拿走里面的奖励，另外两张随后亮出来。
// 奖励：一袋铜币（本关基础铜币的 35%～70%）/ 2 个铜币消耗品 / 1 银币（三星时概率更高）。
// 只在真人对局里出现（main.js 结算时调用 prepare），机器人和数值标定不受影响。
// 没翻就关掉（或刷新页面）：宝箱留在存档里，下次回到地图时再弹出来。
(function (TD) {
  'use strict';

  const C = TD.config;
  const D = TD.data;
  C.chest = {
    copperMin: 0.35,
    copperMax: 0.7,
    itemQty: 2,
    silverChance: 0.08, // 每张卡是银币的概率（三星时用 silverChance3）
    silverChance3: 0.2,
    itemChance: 0.35,
    items: ['bomb', 'patch', 'haste', 'freeze', 'firebomb', 'spikeTrap', 'smokeBomb', 'bandage', 'whetstone', 'ropeNet', 'firecracker', 'oilFlask', 'woodShield'],
  };

  const X = (TD.chest = {});
  X.rand = Math.random; // 测试里可以替换

  function card(n, stars) {
    const K = C.chest;
    const r = X.rand();
    const sc = stars >= 3 ? K.silverChance3 : K.silverChance;
    if (r < sc) return { kind: 'silver', amount: 1 };
    const items = K.items.filter((id) => D.items[id]);
    if (r < sc + K.itemChance && items.length) return { kind: 'item', id: items[Math.floor(X.rand() * items.length)], qty: K.itemQty };
    const base = C.rewards.baseCopper(Math.max(1, n));
    const amount = Math.max(5, Math.round((base * (K.copperMin + X.rand() * (K.copperMax - K.copperMin))) / 5) * 5);
    return { kind: 'copper', amount };
  }

  // 胜利后准备一个宝箱（覆盖之前没开的）；返回宝箱
  X.prepare = function (save, n, stars) {
    if (typeof n !== 'number' || !D.levels[n]) return null;
    save.pendingChest = { n, stars: stars || 0, cards: [card(n, stars), card(n, stars), card(n, stars)] };
    return save.pendingChest;
  };

  X.pending = (save) => {
    const c = save && save.pendingChest;
    return c && Array.isArray(c.cards) && c.cards.length === 3 ? c : null;
  };

  // 翻开第 i 张：发奖励、清掉宝箱；返回 { card, cards }
  X.open = function (save, i) {
    const c = X.pending(save);
    if (!c || !c.cards[i]) return null;
    const got = c.cards[i];
    const amt = Math.max(0, Math.min(1e9, Math.floor(Number(got.amount) || 0)));
    if (got.kind === 'copper') save.copper += amt;
    else if (got.kind === 'silver') save.silver += Math.min(amt, 3);
    else if (got.kind === 'item' && D.items[got.id]) save.inventory[got.id] = (save.inventory[got.id] || 0) + Math.max(1, Math.min(5, Math.floor(Number(got.qty) || 1)));
    save.pendingChest = null;
    save.stats.chests = (Number(save.stats.chests) || 0) + 1;
    return { card: got, cards: c.cards };
  };

  X.label = function (cd) {
    if (cd.kind === 'copper') return `${cd.amount} 铜币`;
    if (cd.kind === 'silver') return `${cd.amount} 银币`;
    return `${D.items[cd.id] ? D.items[cd.id].name : cd.id} ×${cd.qty}`;
  };
})((globalThis.TD = globalThis.TD || {}));
