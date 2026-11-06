// 结算页的纯数据整理（不碰 DOM，Node 里也能加载和测试）：通知折叠、四张数据卡、奖励滚动计数、星星
(function (TD) {
  const R = (TD.resultView = {});

  // 通知的显示优先级：成就 > 解锁 > 援军 > 其他 > 补给（数字越小越靠前；同级保持原顺序）
  const PRIORITY = { achieve: 0, unlock: 1, rally: 2, note: 3, supply: 4 };
  R.MAX_NOTES = 3;
  const prio = (n) => (PRIORITY[n.kind] === undefined ? 3 : PRIORITY[n.kind]);

  // 把通知按优先级排好，最多展开 max 条，其余折叠；全部信息都还在 hidden 里
  R.foldNotes = function (notes, max) {
    max = max === undefined ? R.MAX_NOTES : max;
    const list = (notes || [])
      .map((n, i) => ({ n, i }))
      .sort((a, b) => prio(a.n) - prio(b.n) || a.i - b.i)
      .map((x) => x.n);
    // 只剩 1 条要折叠时，直接展开它（"还有 1 条"比那条本身还占地方）
    const cut = list.length - max === 1 ? list.length : Math.min(max, list.length);
    return { shown: list.slice(0, cut), hidden: list.slice(cut) };
  };

  R.fmtTime = function (sec) {
    const s = Math.max(0, Math.round(sec || 0));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };

  // "本场数据"四张等宽卡：用时 / 击杀 / 连击 / 城墙剩余。失败时城墙一定是 0，换成"守到波数"，信息量更大
  R.statCards = function (res, totalWaves) {
    const last = res.win
      ? { id: 'wall', label: '城墙剩余', value: Math.round((res.wallRatio || 0) * 100) + '%' }
      : { id: 'wave', label: '守到波数', value: (res.wave || 1) + '/' + (totalWaves || res.wave || 1) };
    return [{ id: 'time', label: '用时', value: R.fmtTime(res.time) }, { id: 'kills', label: '击杀', value: String(res.kills || 0) }, { id: 'streak', label: '连击', value: String(res.bestStreak || 0) }, last];
  };

  // 滚动计数：p 是 0..1 的进度，先快后慢；到 1 一定等于目标值
  R.countValue = function (target, p) {
    if (!(p < 1)) return target;
    if (!(p > 0)) return 0;
    return Math.floor(target * (1 - Math.pow(1 - p, 3)));
  };

  // 三颗星：每颗是否点亮
  R.starFlags = function (stars) {
    return [1, 2, 3].map((i) => i <= (stars || 0));
  };

  // 奖励明细（合计之外的行）
  R.rewardRows = function (reward, res, win) {
    const rows = [
      { label: win ? '通关奖励' : '安慰奖励', value: reward.baseCopper, coin: 'copper' },
      { label: `击杀掉落（${res.kills} 只）`, value: reward.killCopper, coin: 'copper' },
    ];
    if (reward.earlyCopper) rows.push({ label: '提前召唤', value: reward.earlyCopper, coin: 'copper' });
    if (reward.copperMult > 1) rows.push({ label: '幸运加成', value: '×' + reward.copperMult.toFixed(2) });
    return rows;
  };
})((globalThis.TD = globalThis.TD || {}));
