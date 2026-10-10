// 铛铛的衣柜（设计书第 30 章）：纯外观，不影响数值
// colors：cape 披风、body 衣服、helmTop / helmBottom 头盔渐变、brim 帽檐、plume 红缨、plumeHi 红缨高光、shield 小圆盾
// extra：头盔上的小装饰（'leaf' 叶子、'sun' 太阳徽章、'mushroom' 小蘑菇、'scarf' 围巾、'ink' 墨墨、'stars' 星星、'crown' 小王冠）
// 解锁条件见设计书 30.2、31.2
(function (TD) {
  'use strict';

  const cleared = (save, n) => (save.levels[n] || {}).clears > 0;
  const totalStars = (save) => Object.values(save.levels).reduce((a, r) => a + (r.stars || 0), 0);

  const BASE = { cape: '#e04848', body: '#5b7bd5', helmTop: '#eef2f7', helmBottom: '#a9b4c2', brim: '#8c97a6', plume: '#ff5a4f', plumeHi: '#ffb3ad', shield: '#c9a24a', shieldHi: '#ffe08a' };
  const O = (id, name, desc, unlock, check, colors, extra) => ({ id, name, desc, unlock, check, colors: Object.assign({}, BASE, colors), extra: extra || null });

  TD.data.outfits = [
    O('classic', '守城卫兵', '王国卫兵的标准装束。头盔有点大。', '初始', () => true, {}),
    O('meadow', '草原游侠', '绿披风上别着一片四叶草。', '通关第一章', (s) => cleared(s, 10), { cape: '#4f9a3c', body: '#7a5a3c', plume: '#7ccf5a', plumeHi: '#c8f2a8' }, 'leaf'),
    O('desert', '沙漠旅人', '沙色斗篷，头盔被太阳晒成了金色。', '通关第二章', (s) => cleared(s, 20), { cape: '#e0b060', body: '#c0703c', helmTop: '#fff2c0', helmBottom: '#d9a640', brim: '#b8862e', plume: '#ff9f2e', plumeHi: '#ffd8a0' }, 'sun'),
    O('swamp', '沼泽巡林人', '防雾的紫斗篷，头盔上长了一朵小蘑菇。', '通关第三章', (s) => cleared(s, 30), { cape: '#7a5aa8', body: '#4f6f5a', helmTop: '#dfe8dc', helmBottom: '#8fa58a', brim: '#6f8a6a', plume: '#b07ad8', plumeHi: '#e2c8f5' }, 'mushroom'),
    O('snow', '雪原斥候', '暖和的蓝白斗篷，还有一条长长的红围巾。', '通关第四章', (s) => cleared(s, 40), { cape: '#5aa8e0', body: '#eef6fc', helmTop: '#ffffff', helmBottom: '#b8d6ee', brim: '#8ab4d6', plume: '#ffffff', plumeHi: '#dff1ff' }, 'scarf'),
    O('ink', '墨墨的好朋友', '黑斗篷上溅满了墨点，墨墨就趴在头盔上。', '击败墨墨', (s) => cleared(s, 50), { cape: '#2a2438', body: '#4a3a5e', helmTop: '#e8e4f0', helmBottom: '#8f86a6', brim: '#6a6080', plume: '#2a2438', plumeHi: '#6a5a8a' }, 'ink'),
    O('star', '星光铛铛', '用 100 颗星星缝成的披风，晚上会发光。', '累计获得 100 颗星', (s) => totalStars(s) >= 100, { cape: '#3a4a9a', body: '#2a3a7a', plume: '#ffd23f', plumeHi: '#fff2b0', shield: '#ffd23f', shieldHi: '#fff8d0' }, 'stars'),
    O('royal', '国王的近卫', '国王爷爷亲手给的小王冠。只给拿到 150 颗星的卫兵。', '累计获得 150 颗星', (s) => totalStars(s) >= 150, { cape: '#b0283c', body: '#f2f2f2', helmTop: '#fff6c8', helmBottom: '#e0b030', brim: '#c09020', plume: '#b0283c', plumeHi: '#ff8a9a', shield: '#e0b030', shieldHi: '#fff2a0' }, 'crown'),
    O('gold', '金甲勇士', '在挑战难度守住了每一关。金色盔甲，金色羽毛。', '获得 50 顶王冠', (s) => Object.values(s.levels).filter((r) => r.crown).length >= 50, { cape: '#d9a640', body: '#e8c060', helmTop: '#fff6c8', helmBottom: '#d9a640', brim: '#b8862e', plume: '#ffd23f', plumeHi: '#fff8d0', shield: '#ffd23f', shieldHi: '#fff8d0' }, 'crown'),
  ];

  TD.data.outfitById = (id) => TD.data.outfits.find((o) => o.id === id) || TD.data.outfits[0];
})((globalThis.TD = globalThis.TD || {}));
