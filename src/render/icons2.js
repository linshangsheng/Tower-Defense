// 新消耗品的图标（设计书 62）：坐标系和 sprites.js 的 ICONS 一样，以图标中心为原点、范围约 ±20
(function (TD) {
  'use strict';

  const S = TD.sprites;
  const OUT = 'rgba(26,22,52,0.62)';
  const TAU = Math.PI * 2;
  const ell = (ctx, x, y, rx, ry, fill, stroke, w) => S.ellipse(ctx, x, y, rx, ry, fill, stroke, w);

  function flame(ctx, x, y, s, c1, c2) {
    ctx.fillStyle = c1;
    ctx.beginPath();
    ctx.moveTo(x, y - 16 * s);
    ctx.bezierCurveTo(x + 10 * s, y - 6 * s, x + 11 * s, y + 8 * s, x, y + 9 * s);
    ctx.bezierCurveTo(x - 11 * s, y + 8 * s, x - 10 * s, y - 6 * s, x, y - 16 * s);
    ctx.fill();
    ctx.fillStyle = c2;
    ctx.beginPath();
    ctx.moveTo(x, y - 6 * s);
    ctx.bezierCurveTo(x + 5 * s, y, x + 5 * s, y + 6 * s, x, y + 7 * s);
    ctx.bezierCurveTo(x - 5 * s, y + 6 * s, x - 5 * s, y, x, y - 6 * s);
    ctx.fill();
  }

  S.moreIcons = {
    firebomb(ctx) {
      // 燃烧瓶：圆肚玻璃瓶 + 瓶口的火苗
      ell(ctx, 0, 6, 12, 12, '#e8762a', OUT, 2);
      ell(ctx, -4, 2, 4, 6, 'rgba(255,255,255,0.45)');
      ctx.fillStyle = '#f2b36a';
      ctx.fillRect(-4, -9, 8, 9);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.strokeRect(-4, -9, 8, 9);
      ctx.fillStyle = '#7a4a28';
      ctx.fillRect(-5, -12, 10, 4);
      flame(ctx, 0, -16, 0.75, '#ff8a2a', '#ffe28a');
    },
    thunderScroll(ctx) {
      // 雷霆符：卷轴 + 紫色闪电
      ctx.fillStyle = '#f2e2b8';
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      S.roundRect(ctx, -12, -14, 24, 28, 3);
      ctx.fill();
      ctx.stroke();
      ell(ctx, 0, -14, 12, 3.5, '#d9b878', OUT, 2);
      ell(ctx, 0, 14, 12, 3.5, '#d9b878', OUT, 2);
      ctx.fillStyle = '#b07aff';
      ctx.beginPath();
      ctx.moveTo(3, -10);
      ctx.lineTo(-6, 2);
      ctx.lineTo(-1, 2);
      ctx.lineTo(-4, 11);
      ctx.lineTo(7, -2);
      ctx.lineTo(2, -2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    },
    bigBomb(ctx) {
      // 重磅炸弹：更大的黑色炸弹，红色的箍，引信冒火花
      ell(ctx, 0, 4, 15, 15, '#2c2a36', OUT, 2.2);
      ell(ctx, -5, -1, 5, 6, 'rgba(255,255,255,0.35)');
      ctx.fillStyle = '#c23a3a';
      ctx.fillRect(-15, 2, 30, 5);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 1.6;
      ctx.strokeRect(-15, 2, 30, 5);
      ctx.fillStyle = '#6b6b78';
      ctx.fillRect(-4, -14, 8, 6);
      ctx.strokeStyle = '#8a5a3c';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.quadraticCurveTo(6, -19, 11, -16);
      ctx.stroke();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        const r = i % 2 ? 2.4 : 5.5;
        ctx.lineTo(11 + Math.cos(a) * r, -16 + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    },
    barrier(ctx) {
      // 守护符文：金色泡泡里一枚盾
      ell(ctx, 0, 0, 17, 17, 'rgba(255,226,150,0.25)', '#f3c867', 2.4);
      ctx.fillStyle = '#26355e';
      ctx.strokeStyle = '#f3c867';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.quadraticCurveTo(7, -13, 11, -9);
      ctx.lineTo(11, 0);
      ctx.bezierCurveTo(11, 7, 5, 11, 0, 14);
      ctx.bezierCurveTo(-5, 11, -11, 7, -11, 0);
      ctx.lineTo(-11, -9);
      ctx.quadraticCurveTo(-7, -13, 0, -11);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#ffe6a0';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(0, 8);
      ctx.moveTo(-6, -1);
      ctx.lineTo(6, -1);
      ctx.stroke();
      ell(ctx, -9, -10, 3, 2, 'rgba(255,255,255,0.7)');
    },
    warBanner(ctx) {
      // 战旗：旗杆 + 红金旗面
      ctx.strokeStyle = '#5b3c2a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-10, 18);
      ctx.lineTo(-10, -17);
      ctx.stroke();
      ctx.fillStyle = '#d6403a';
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-9, -16);
      ctx.quadraticCurveTo(2, -20, 14, -14);
      ctx.lineTo(9, -7);
      ctx.lineTo(14, 0);
      ctx.quadraticCurveTo(2, -5, -9, -1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU - Math.PI / 2;
        const r = i % 2 ? 2.6 : 5.6;
        ctx.lineTo(1 + Math.cos(a) * r, -9 + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ell(ctx, -10, -18, 2.6, 2.6, '#ffd23f', OUT, 1.4);
    },
    quake(ctx) {
      // 地震符：裂开的地面，缝里透出橙光
      ctx.fillStyle = '#7a6448';
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      S.roundRect(ctx, -17, -6, 34, 20, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ff9a3a';
      ctx.beginPath();
      ctx.moveTo(-3, -6);
      ctx.lineTo(3, -1);
      ctx.lineTo(-2, 4);
      ctx.lineTo(4, 9);
      ctx.lineTo(0, 14);
      ctx.lineTo(-6, 9);
      ctx.lineTo(-1, 4);
      ctx.lineTo(-7, -1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#2a1a10';
      ctx.stroke();
      ctx.fillStyle = '#9a8460';
      for (const [x, y, r] of [[-12, -12, 3], [11, -14, 2.5], [4, -18, 2]]) ell(ctx, x, y, r, r, '#9a8460', OUT, 1.4);
    },
    blizzard(ctx) {
      // 暴风雪卷轴：冰蓝色的圆里一朵雪花
      ell(ctx, 0, 0, 17, 17, '#4a8ad8', OUT, 2);
      ell(ctx, -5, -6, 8, 5, 'rgba(255,255,255,0.35)');
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
        ctx.lineTo(-Math.cos(a) * 12, -Math.sin(a) * 12);
        ctx.stroke();
        for (const s of [-1, 1]) {
          const bx = Math.cos(a) * 7 * s;
          const by = Math.sin(a) * 7 * s;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(a + 0.9) * 4 * s, by + Math.sin(a + 0.9) * 4 * s);
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(a - 0.9) * 4 * s, by + Math.sin(a - 0.9) * 4 * s);
          ctx.stroke();
        }
      }
    },
    flood(ctx) {
      // 洪水：三道叠起来的大浪
      for (const [y, c] of [[-6, '#7ad0ff'], [2, '#3a9ae8'], [10, '#2a6ac0']]) {
        ctx.fillStyle = c;
        ctx.strokeStyle = OUT;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(-18, y + 10);
        ctx.lineTo(-18, y);
        ctx.bezierCurveTo(-13, y - 9, -7, y - 9, -3, y - 1);
        ctx.bezierCurveTo(2, y - 9, 9, y - 9, 12, y - 3);
        ctx.quadraticCurveTo(15, y - 6, 18, y - 2);
        ctx.lineTo(18, y + 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = '#ffffff';
      for (const [x, y] of [[-8, -10], [4, -12], [13, -8]]) ell(ctx, x, y, 2.2, 2.2, '#ffffff');
    },
    holyLight(ctx) {
      // 圣光：放射的金色光芒
      ctx.strokeStyle = '#ffd27a';
      ctx.lineWidth = 2.6;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        const r0 = 9;
        const r1 = i % 2 ? 15 : 19;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
        ctx.stroke();
      }
      ell(ctx, 0, 0, 9, 9, '#fff6d8', '#e0a83a', 2);
      ell(ctx, -2.5, -2.5, 3, 3, '#ffffff');
    },
    meteor(ctx) {
      // 陨石：带火尾的石头
      const g = ctx.createLinearGradient(16, -16, -4, 4);
      g.addColorStop(0, 'rgba(255,90,40,0)');
      g.addColorStop(1, 'rgba(255,170,70,0.9)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(17, -16);
      ctx.lineTo(-8, -2);
      ctx.lineTo(-2, 6);
      ctx.closePath();
      ctx.fill();
      ell(ctx, -4, 5, 10, 9, '#6a5a52', OUT, 2);
      ell(ctx, -7, 2, 3, 2.4, '#4a3e38');
      ell(ctx, -1, 9, 2.4, 2, '#4a3e38');
      ell(ctx, -7, 1, 4, 3, 'rgba(255,200,120,0.5)');
      flame(ctx, 9, -10, 0.45, '#ff8a2a', '#ffe28a');
    },
    chrono(ctx) {
      // 时间静止：紫色表盘，指针停在整点，周围一圈刻度
      ell(ctx, 0, 0, 17, 17, '#3a2a7a', '#c8b8ff', 2.4);
      ell(ctx, 0, 0, 13, 13, '#5a44b0');
      ctx.strokeStyle = '#e8e0ff';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10);
        ctx.lineTo(Math.cos(a) * (i % 3 ? 12 : 13), Math.sin(a) * (i % 3 ? 12 : 13));
        ctx.stroke();
      }
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -9);
      ctx.moveTo(0, 0);
      ctx.lineTo(6, 3);
      ctx.stroke();
      ell(ctx, 0, 0, 2.2, 2.2, '#ffd23f');
    },
  };

  // 新武器的图标（设计书 63.4）：直接画武器本身，并按品质加一圈底色
  for (const id of ['frostBow', 'flameCrossbow', 'piercer', 'meteorCannon', 'stormOrb', 'voidCrossbow', 'genesisBow', 'judgementStaff', 'chronoBoomerang', 'huntBow', 'mortar', 'twinCrossbow', 'galeBoomerang', 'thunderMortar', 'arcaneStaff', 'dragonBow', 'infernoStaff', 'worldCannon', 'starfallOrb']) {
    S.moreIcons[id] = (ctx) => {
      const K = TD.creatures;
      const w = TD.data.weapons[id];
      const rc = TD.data.weaponRarity[w.rarity].color;
      if (TD.art && TD.art.drawGlow) TD.art.drawGlow(ctx, 0, 0, 22, rc, 0.45);
      if (!K) return;
      ctx.save();
      ctx.translate(-9, 0);
      K.weapon(ctx, id, 22, undefined, { shieldHi: '#ffe08a' }, 0.6);
      ctx.restore();
    };
  }
})((globalThis.TD = globalThis.TD || {}));
