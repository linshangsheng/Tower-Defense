// 战斗画面渲染：背景、城墙、英雄、怪物、弹道与特效（设计书 4.3、10.4）
(function (TD) {
  'use strict';

  const C = TD.config;
  const S = TD.sprites;
  const DRAW_SCALE = 1.25; // 怪物绘制放大倍数（不影响判定）
  const OUTLINE_C = '#3b2a1e';

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.t = 0;
      this.fx = []; // 粒子、飘字等
      this.shake = 0;
      this.battle = null;
      this.flashes = []; // 车道预警等
      this.critAge = 9;
      this.theme = TD.data.chapters[0].theme;
      this.highlightLanes = false;
      this.hoverLane = -1;
      this.mood = 'idle';
      this.bgCache = null;
    }

    setChapter(ch) {
      if (this.theme !== ch.theme) {
        this.theme = ch.theme;
        this.bgCache = null;
      }
    }

    attach(battle) {
      this.battle = battle;
      this.setChapter(TD.data.chapterOf(battle.stage));
      this.sandUntil = 0;
      this.fogUntil = 0;
      this.blizzardUntil = 0;
      this.sealUntil = 0;
      this.fx = [];
      this.flashes = [];
      this.shake = 0;
      this.mood = 'focus';
      this.bgCache = null;
      const on = (type, fn) => battle.on(type, fn.bind(this));
      on('hit', this.onHit);
      on('death', this.onDeath);
      on('wallHit', this.onWallHit);
      on('wallHeal', (e) => {
        if (e.amount > 0) this.text(C.wallX - 70, C.fieldTop + 40, '+' + Math.round(e.amount), '#4fd36a', 26);
        this.burst(C.wallX - 60, (C.fieldTop + C.fieldBottom) / 2, '#7dff9a', 18, 220);
      });
      on('spore', (e) => this.fx.push({ kind: 'ring', x: e.x, y: e.y, r0: 10, r1: e.radius, color: 'rgba(196,90,210,', life: 0.6, age: 0 }));
      on('rainArrow', (e) => this.fx.push({ kind: 'fallArrow', x: e.x, y: e.y, life: 0.18, age: 0 }));
      on('thunderChain', (e) => this.fx.push({ kind: 'chain', x0: e.x0, y0: e.y0, x: e.x, y: e.y, life: 0.3, age: 0 }));
      on('laneFreeze', () => (this.shake = Math.max(this.shake, 3)));
      on('thunder', (e) => {
        this.fx.push({ kind: 'bolt', x: e.x, y: e.y, life: 0.35, age: 0, seed: Math.random() });
        this.shake = Math.max(this.shake, 8);
      });
      on('skill', (e) => {
        if (e.id === 'drum') this.burst(C.heroX, battle.heroY - 40, '#ffb347', 20, 200);
        if (e.id === 'frost' || e.id === 'freeze') this.shake = Math.max(this.shake, 2);
      });
      on('item', (e) => {
        if (e.id === 'bomb') {
          const y = battle.laneY(e.lane);
          for (let i = 0; i < 6; i++) {
            const x = C.wallX + 120 + Math.random() * (battle.range - 120);
            this.fx.push({ kind: 'boom', x, y: y + (Math.random() - 0.5) * 40, life: 0.5, age: -i * 0.05 });
          }
          this.shake = Math.max(this.shake, 10);
        }
      });
      on('bossWarn', (e) => this.flashes.push({ lane: e.lane, until: battle.time + e.duration, color: '255,60,60', m: e.m }));
      on('bossInterrupt', (e) => {
        this.text(e.m.x, e.m.y - 90, '打断！', '#ffd23f', 34, 1.2);
        this.burst(e.m.x, e.m.y - 30, '#ffd23f', 24, 300);
        this.shake = Math.max(this.shake, 8);
      });
      on('chargeHit', () => (this.shake = Math.max(this.shake, 18)));
      on('bossPhase', (e) => this.banner(e.text));
      on('split', (e) => this.burst(e.m.x, e.m.y - 20, '#7fd0ff', 14, 200));
      on('waveStart', (e) => {
        if (e.chapter) this.setChapter(TD.data.chapters.find((c) => c.id === e.chapter));
        this.banner(battle.level.endless ? `第 ${e.index + 1} 波` : e.index === battle.totalWaves - 1 ? '最后一波！' : `第 ${e.index + 1} 波`);
      });
      on('earlyCall', (e) => {
        if (e.bonus > 0) this.text(C.width - 160, 90, `提前召唤 +${e.bonus} 铜`, '#ffb347', 24, 1.4);
      });
      on('combo', () => this.text(C.heroX + 30, battle.heroY - 100, '连珠!', '#ffd23f', 18, 0.6));
      // 第二章
      on('splash', (e) => this.fx.push({ kind: 'splash', x: e.x, y: e.y, r: e.radius, magic: e.magic, life: 0.35, age: 0 }));
      on('burrow', (e) => this.burst(e.m.x, e.m.y + 4, '#d9b26a', e.boss ? 20 : 8, 140));
      on('surface', (e) => {
        this.burst(e.m.x, e.m.y, '#d9b26a', e.boss ? 30 : 10, e.boss ? 260 : 160);
        if (e.boss) this.shake = Math.max(this.shake, 10);
      });
      on('surfaceWarn', (e) => this.fx.push({ kind: 'dustWarn', x: e.x, y: e.y, life: e.duration, age: 0 }));
      on('sandstorm', (e) => {
        this.sandUntil = battle.time + e.duration;
        this.banner('沙暴来袭！攻速降低');
      });
      on('shieldHit', (e) => {
        if (Math.random() < 0.5) this.text(e.x + (Math.random() - 0.5) * 30, e.y - 120, Math.round(e.dmg), e.magic ? '#c58cff' : '#bbb08a', e.magic ? 22 : 15, 0.6);
      });
      on('shieldUp', (e) => this.burst(e.m.x, e.m.y - 60, '#ffe58a', 30, 260));
      on('shieldBreak', (e) => {
        this.burst(e.m.x, e.m.y - 60, '#ffe58a', 50, 380);
        this.text(e.m.x, e.m.y - 150, '护盾破碎！', '#ffd23f', 34, 1.3);
        this.shake = Math.max(this.shake, 12);
      });
      on('healPulse', (e) => {
        if (e.any) this.fx.push({ kind: 'ring', x: e.m.x, y: e.m.y - 10, r0: 10, r1: e.radius, color: 'rgba(110,230,130,', life: 0.6, age: 0 });
      });
      on('explode', (e) => {
        this.fx.push({ kind: 'boom', x: e.m.x, y: e.m.y, life: 0.5, age: 0 });
        this.text(e.m.x + 20, e.m.y - 50, '轰！', '#ff8a3d', 30, 0.8);
      });
      on('claw', (e) => this.text(e.m.x + 10, e.m.y - 80, '钳击！', '#ff5050', 30, 0.9));
      on('miss', (e) => this.text(e.x, e.y - 30, '落空', '#d9c9a8', 15, 0.5));
      // 第四章
      on('slam', (e) => {
        this.text(e.m.x + 20, e.m.y - 50, '砰！', '#5aa8e0', 28, 0.8);
        this.shake = Math.max(this.shake, 6);
      });
      on('blizzard', (e) => {
        this.blizzardUntil = battle.time + e.duration;
        this.banner('暴风雪！攻速降低');
      });
      on('wallSeal', (e) => {
        this.sealUntil = battle.time + e.duration;
        this.banner('城墙被冰封了！暂时无法修复');
      });
      on('healBlocked', () => this.text(C.wallX - 60, C.fieldTop + 60, '冰封中，无法修复', '#9fe3ff', 20, 1));
      on('skillFrozen', (e) => {
        this.text(C.heroX + 40, battle.heroY - 110, '技能被冻住了！', '#9fe3ff', 22, 1.2);
        this.burst(e.m.x, e.m.y - 60, '#bfe9ff', 16, 200);
      });
      // 第五章
      on('stompWarn', (e) => this.text(e.m.x, e.m.y - 120, '要跺脚了！', '#ff8a3d', 24, 0.9));
      on('stomp', () => {
        this.shake = Math.max(this.shake, 14);
        this.text(C.heroX + 40, battle.heroY - 110, '被震晕了！', '#ffd23f', 24, 1);
      });
      on('golemBoom', (e) => {
        for (let i = 0; i < 6; i++) this.fx.push({ kind: 'boom', x: e.m.x + (Math.random() - 0.5) * 80, y: e.m.y - 20 + (Math.random() - 0.5) * 40, life: 0.6, age: -i * 0.06 });
        this.shake = Math.max(this.shake, 18);
        this.banner(e.near ? '岩岩在城墙边爆炸了！' : '岩岩爆炸了！车道变成熔岩');
      });
      on('fireZone', (e) => this.burst(e.x, e.y - 10, '#ff8a3d', 10, 140));
      on('reveal', (e) => this.fx.push({ kind: 'poof', x: e.m.x, y: e.m.y - 20, r: 20, life: 0.3, age: 0 }));
      on('inkSplit', (e) => {
        this.burst(e.m.x, e.m.y - 40, '#7a5aa8', 40, 300);
        this.shake = Math.max(this.shake, 10);
      });
      on('inkReform', (e) => {
        this.burst(e.m.x, e.m.y - 40, '#c58cff', 40, 300);
        this.text(e.m.x, e.m.y - 140, '本体现身！伤害 +50%', '#ffd23f', 28, 1.5);
      });
      on('inkSlam', () => (this.shake = Math.max(this.shake, 20)));
      on('riftStrike', () => {
        this.shake = Math.max(this.shake, 26);
        this.fx.push({ kind: 'flash', color: '#7a5aa8', life: 0.6, age: 0 });
        this.banner('裂隙打击！');
      });
      // 第三章
      on('spit', (e) =>
        this.fx.push({ kind: 'spit', x0: e.x - 10, y0: e.y - 20 + (e.m.def.flying ? e.m.yOffset : 0), x1: C.wallX - 10, y1: e.y - 30, life: 0.5, age: 0, fire: e.m.type === 'imp' }));
      on('poisonFog', (e) => {
        this.fogUntil = battle.time + e.duration;
        this.banner('毒雾！城墙持续受损');
      });
      on('cook', (e) => {
        this.banner(`煮汤！${e.count} 只怪物被强化`);
        for (const m of battle.monsters) if (m.cooked && !m.dead) this.burst(m.x, m.y - 20, '#9df58a', 6, 120);
      });
      on('pour', () => (this.shake = Math.max(this.shake, 6)));
      on('boneDown', (e) => {
        this.burst(e.m.x, e.m.y - 30, '#f2efe6', 30, 260);
        this.text(e.m.x, e.m.y - 110, '还没完呢…', '#c58cff', 26, 1.5);
      });
    }

    // ---------- 特效工具 ----------
    text(x, y, str, color, size, life, crit) {
      this.fx.push({ kind: 'text', x, y, str, color, size: size || 20, life: life || 0.8, age: 0, vy: -50, crit });
    }
    burst(x, y, color, n, speed) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = (0.3 + Math.random() * 0.7) * (speed || 150);
        this.fx.push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, color, life: 0.4 + Math.random() * 0.3, age: 0, r: 2 + Math.random() * 3 });
      }
    }
    // 横幅排队显示，避免互相重叠
    banner(text) {
      // 只保留正在显示的一条，排队中的旧横幅直接丢弃
      this.fx = this.fx.filter((f) => !(f.kind === 'banner' && f.age < 0));
      const showing = this.fx.find((f) => f.kind === 'banner' && f.age < f.life);
      const delay = showing ? Math.min(0.8, showing.life - showing.age) : 0;
      this.fx.push({ kind: 'banner', str: text, life: 1.6, age: -delay });
    }

    onHit(e) {
      if (e.source === 'thorns') return;
      const big = e.crit;
      const color = e.source === 'burn' ? '#ff8a3d' : e.source === 'thunder' ? '#c58cff' : big ? '#ffd23f' : '#ffffff';
      const size = e.source === 'burn' ? 15 : big ? 30 : e.dmg >= 100 ? 24 : 19;
      this.text(e.x + (Math.random() - 0.5) * 16, e.y - e.m.def.size * 1.4, (big ? '暴击 ' : '') + Math.round(e.dmg), color, size, big ? 0.9 : 0.6, big);
      if (e.blocked) this.fx.push({ kind: 'clang', x: e.x - e.m.def.size * 0.8, y: e.y - e.m.def.size * 0.7, life: 0.25, age: 0 });
      if (big) {
        this.critAge = 0;
        this.shake = Math.max(this.shake, 3);
        if (TD.audio) TD.audio.play('crit');
      } else if (TD.audio && e.source === 'weapon') TD.audio.play('hit');
    }

    onDeath(e) {
      const m = e.m;
      this.burst(m.x, m.y + m.yOffset - m.def.size * 0.5, '#ffe28a', m.def.boss ? 40 : 10, m.def.boss ? 320 : 160);
      this.fx.push({ kind: 'poof', x: m.x, y: m.y + m.yOffset - m.def.size * 0.5, r: m.def.size, life: 0.35, age: 0 });
      if (e.copper > 0) {
        for (let i = 0; i < Math.min(6, e.copper); i++) {
          this.fx.push({
            kind: 'coin',
            x: m.x,
            y: m.y + m.yOffset - 10,
            vx: (Math.random() - 0.5) * 120,
            vy: -160 - Math.random() * 80,
            life: 0.9,
            age: -i * 0.04,
          });
        }
      }
      if (m.def.boss) this.shake = Math.max(this.shake, 14);
      if (TD.audio) TD.audio.play(m.def.boss ? 'bossDie' : 'pop');
    }

    onWallHit(e) {
      if (e.kind === 'dot') {
        // 中毒：城墙上冒绿泡
        for (let i = 0; i < 2; i++) {
          this.fx.push({ kind: 'spark', x: C.wallX - 30 - Math.random() * 30, y: C.fieldTop + Math.random() * (C.fieldBottom - C.fieldTop), vx: 0, vy: -40, color: '#7dff9a', life: 0.6, age: 0, r: 3 + Math.random() * 3 });
        }
        return;
      }
      const y = e.m ? e.m.y + e.m.yOffset - 10 : (C.fieldTop + C.fieldBottom) / 2;
      for (let i = 0; i < (e.big ? 16 : 3); i++) {
        this.fx.push({
          kind: 'rock',
          x: C.wallX - 6,
          y: y + (Math.random() - 0.5) * 20,
          vx: -40 - Math.random() * 120,
          vy: -120 - Math.random() * 120,
          life: 0.7,
          age: 0,
          r: 2 + Math.random() * 3,
        });
      }
      if (e.big) {
        this.shake = Math.max(this.shake, 16);
        this.text(C.wallX + 20, y - 40, '-' + Math.round(e.amount), '#ff5050', 32, 1);
      }
      if (TD.audio) TD.audio.play(e.big ? 'bigWall' : 'wall');
    }

    // ---------- 主渲染 ----------
    render(dt) {
      const ctx = this.ctx;
      const b = this.battle;
      this.t += dt;
      this.critAge += dt;
      ctx.save();
      if (this.shake > 0.2) {
        ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
        this.shake *= Math.pow(0.001, dt);
      } else this.shake = 0;

      const lanes = b ? b.lanes : 3;
      this.drawBackground(lanes);
      if (b) this.drawLaneEffects(b);
      this.drawWall(b ? b.wall.hp / b.wall.max : 1);
      if (b) {
        this.drawRangeMarker(b);
        // 先画地面怪，再画飞行怪；同层按 y 排序
        const alive = b.monsters.filter((m) => !m.dead);
        alive.sort((a, c) => (a.def.flying ? 1 : 0) - (c.def.flying ? 1 : 0) || a.y - c.y);
        for (const m of alive) this.drawMonster(m, b);
        this.drawProjectiles(b);
      }
      this.drawHero(b);
      if (b && b.time < this.sandUntil) this.drawSandstorm(b);
      if (b && b.time < this.fogUntil) this.drawFog(b);
      if (b && b.level.dark) this.drawDarkness();
      else if (this.theme.swamp) this.drawMist();
      if (this.theme.snow) this.drawSnowfall(b && b.time < this.blizzardUntil);
      if (this.theme.lava) this.drawEmbers();
      if (b && b.time < b.heroStunUntil) this.drawHeroStun(b);
      if (b) this.drawRiftTimer(b);
      if (b && b.time < this.sealUntil) this.drawWallSeal(b);
      if (b && b.chillStacks > 0) this.drawChill(b);
      this.drawFx(dt);
      if (b) this.drawBossBar(b);
      if (b) this.drawWallWarning(b);
      ctx.restore();
    }

    drawBackground(lanes) {
      const key = lanes + (this.theme.desert ? 'd' : this.theme.swamp ? 's' : this.theme.snow ? 'w' : this.theme.lava ? 'l' : 'g');
      if (!this.bgCache || this.bgCache.key !== key) {
        const c = document.createElement('canvas');
        c.width = C.width;
        c.height = C.height;
        this.paintBackground(c.getContext('2d'), lanes);
        this.bgCache = { key, canvas: c };
      }
      this.ctx.drawImage(this.bgCache.canvas, 0, 0);
      // 飘动的云
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = 0.85;
      for (let i = 0; i < 4; i++) {
        const x = ((this.t * (8 + i * 3) + i * 380) % (C.width + 300)) - 150;
        const y = 22 + (i % 2) * 26;
        S.ellipse(ctx, x, y, 46, 16, '#fff');
        S.ellipse(ctx, x + 30, y - 8, 30, 16, '#fff');
        S.ellipse(ctx, x - 28, y - 4, 26, 12, '#fff');
      }
      ctx.restore();
    }

    paintBackground(ctx, lanes) {
      const th = this.theme;
      const sky = ctx.createLinearGradient(0, 0, 0, C.fieldTop);
      sky.addColorStop(0, th.desert ? '#ffd38a' : th.swamp ? '#8f87a8' : th.snow ? '#b9dcf5' : th.lava ? '#2a1420' : '#9fdcff');
      sky.addColorStop(1, th.sky);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, C.width, C.fieldTop);
      const desert = !!th.desert;
      const swamp = !!th.swamp;
      const snow = !!th.snow;
      const lava = !!th.lava;
      if (desert) {
        // 远处的金字塔
        for (const [px, ph] of [
          [520, 70],
          [640, 50],
          [1010, 60],
        ]) {
          ctx.fillStyle = '#e8b866';
          ctx.beginPath();
          ctx.moveTo(px - ph, C.fieldTop);
          ctx.lineTo(px, C.fieldTop - ph);
          ctx.lineTo(px + ph, C.fieldTop);
          ctx.fill();
          ctx.fillStyle = '#d29a4a';
          ctx.beginPath();
          ctx.moveTo(px, C.fieldTop - ph);
          ctx.lineTo(px + ph, C.fieldTop);
          ctx.lineTo(px + ph * 0.25, C.fieldTop);
          ctx.fill();
        }
      }
      // 远山 / 沙丘
      if (lava) {
        // 冒烟的火山
        ctx.fillStyle = '#3a2a30';
        ctx.beginPath();
        ctx.moveTo(620, C.fieldTop);
        ctx.lineTo(780, C.fieldTop - 85);
        ctx.lineTo(860, C.fieldTop - 85);
        ctx.lineTo(1020, C.fieldTop);
        ctx.fill();
        ctx.fillStyle = '#ff7a3d';
        ctx.fillRect(785, C.fieldTop - 88, 70, 6);
        ctx.fillStyle = 'rgba(80,60,70,0.6)';
        for (let i = 0; i < 4; i++) S.ellipse(ctx, 820 + i * 18, C.fieldTop - 100 - i * 14, 22 + i * 6, 12 + i * 3, 'rgba(90,70,80,0.55)');
      }
      if (snow) {
        // 远处的雪山
        for (const [px, ph] of [
          [380, 90],
          [600, 120],
          [900, 100],
          [1180, 80],
        ]) {
          ctx.fillStyle = '#a8c4e0';
          ctx.beginPath();
          ctx.moveTo(px - ph * 1.3, C.fieldTop);
          ctx.lineTo(px, C.fieldTop - ph);
          ctx.lineTo(px + ph * 1.3, C.fieldTop);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(px - ph * 0.35, C.fieldTop - ph * 0.72);
          ctx.lineTo(px, C.fieldTop - ph);
          ctx.lineTo(px + ph * 0.35, C.fieldTop - ph * 0.72);
          ctx.lineTo(px + ph * 0.15, C.fieldTop - ph * 0.62);
          ctx.lineTo(px - ph * 0.1, C.fieldTop - ph * 0.7);
          ctx.fill();
        }
      }
      if (swamp) {
        // 远处的枯树
        ctx.strokeStyle = '#4a4458';
        ctx.lineWidth = 5;
        for (const tx of [430, 610, 880, 1150]) {
          ctx.beginPath();
          ctx.moveTo(tx, C.fieldTop);
          ctx.lineTo(tx + 4, C.fieldTop - 60);
          ctx.lineTo(tx - 14, C.fieldTop - 80);
          ctx.moveTo(tx + 4, C.fieldTop - 60);
          ctx.lineTo(tx + 22, C.fieldTop - 76);
          ctx.moveTo(tx + 2, C.fieldTop - 35);
          ctx.lineTo(tx + 18, C.fieldTop - 42);
          ctx.stroke();
        }
      }
      ctx.fillStyle = desert ? '#f0c878' : swamp ? '#5f7a5d' : snow ? '#dbe9f6' : lava ? '#4a3438' : '#8fd17a';
      ctx.beginPath();
      ctx.moveTo(0, C.fieldTop);
      for (let x = 0; x <= C.width; x += 80) ctx.lineTo(x, C.fieldTop - 18 - Math.sin(x * 0.012) * 14 - Math.sin(x * 0.031) * 8);
      ctx.lineTo(C.width, C.fieldTop);
      ctx.fill();
      ctx.fillStyle = th.ground;
      ctx.fillRect(0, C.fieldTop, C.width, C.height - C.fieldTop);
      const h = (C.fieldBottom - C.fieldTop) / lanes;
      for (let i = 0; i < lanes; i++) {
        const y0 = C.fieldTop + i * h;
        ctx.fillStyle = i % 2 ? th.ground2 : th.ground;
        ctx.fillRect(C.wallX, y0, C.width - C.wallX, h);
        // 小路
        const cy = y0 + h * 0.5 + 8;
        const ph = Math.min(52, h * 0.38);
        ctx.fillStyle = desert ? '#e9c27a' : swamp ? '#8a7a5a' : snow ? '#cfdcea' : lava ? '#6a4a44' : '#e3c992';
        S.roundRect(ctx, C.wallX - 10, cy - ph / 2, C.width - C.wallX + 20, ph, ph / 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(160,120,70,0.18)';
        for (let x = C.wallX + 30; x < C.width; x += 57) {
          S.ellipse(ctx, x + ((i * 37) % 20), cy + ((x * 7) % 9) - 4, 4, 2.5, 'rgba(150,110,60,0.35)');
        }
        // 车道分隔：小花丛（熔岩裂隙是岩浆河）
        if (i > 0 && lava) {
          ctx.fillStyle = '#ff7a3d';
          ctx.fillRect(C.wallX, y0 - 4, C.width - C.wallX, 8);
          ctx.fillStyle = '#ffd23f';
          for (let x = C.wallX; x < C.width; x += 40) ctx.fillRect(x + ((i * 13) % 20), y0 - 1, 14, 2);
        } else if (i > 0) {
          ctx.fillStyle = 'rgba(70,140,60,0.35)';
          ctx.fillRect(C.wallX, y0 - 2, C.width - C.wallX, 4);
        }
        for (let k = 0; k < 9; k++) {
          const fx = C.wallX + 60 + ((k * 137 + i * 61) % (C.width - C.wallX - 80));
          const fy = y0 + 10 + ((k * 53 + i * 29) % 16);
          if (lava) {
            // 黑曜石
            ctx.fillStyle = '#2a2026';
            ctx.beginPath();
            ctx.moveTo(fx - 6, fy + 2);
            ctx.lineTo(fx - 2, fy - 9);
            ctx.lineTo(fx + 5, fy - 4);
            ctx.lineTo(fx + 6, fy + 2);
            ctx.fill();
            continue;
          }
          if (snow) {
            if (k % 3 === 0) {
              // 小松树
              ctx.fillStyle = '#4f8a6a';
              ctx.beginPath();
              ctx.moveTo(fx, fy - 18);
              ctx.lineTo(fx - 8, fy);
              ctx.lineTo(fx + 8, fy);
              ctx.fill();
              ctx.fillStyle = '#fff';
              ctx.beginPath();
              ctx.moveTo(fx, fy - 18);
              ctx.lineTo(fx - 4, fy - 9);
              ctx.lineTo(fx + 4, fy - 9);
              ctx.fill();
            } else S.ellipse(ctx, fx, fy, 6, 2, 'rgba(160,200,235,0.6)');
            continue;
          }
          if (swamp) {
            if (k % 2 === 0) {
              // 浅水与睡莲叶
              S.ellipse(ctx, fx, fy + 4, 16, 5, 'rgba(90,130,150,0.45)');
              S.ellipse(ctx, fx + 2, fy + 2, 6, 3, '#4f9a4a');
            } else S.ellipse(ctx, fx, fy, 3, 3, '#c9b0f0');
            continue;
          }
          if (desert) {
            if (k % 3 === 0) {
              // 小仙人掌
              ctx.fillStyle = '#5fb85a';
              S.roundRect(ctx, fx - 3, fy - 14, 6, 16, 3);
              ctx.fill();
              S.roundRect(ctx, fx - 9, fy - 9, 5, 8, 2.5);
              ctx.fill();
            } else S.ellipse(ctx, fx, fy, 4, 2, 'rgba(160,110,50,0.35)');
            continue;
          }
          const colors = ['#ffffff', '#ffd23f', '#ff9ec4'];
          S.ellipse(ctx, fx, fy, 3.2, 3.2, colors[(k + i) % 3]);
          S.ellipse(ctx, fx, fy, 1.3, 1.3, '#f08a24');
        }
      }
      // 草丛点缀
      ctx.fillStyle = desert ? 'rgba(170,120,60,0.35)' : swamp ? 'rgba(40,70,40,0.5)' : snow ? 'rgba(150,180,210,0.35)' : lava ? 'rgba(255,120,60,0.25)' : 'rgba(60,130,50,0.5)';
      for (let k = 0; k < 40; k++) {
        const x = C.wallX + ((k * 211) % (C.width - C.wallX));
        const y = C.fieldTop + ((k * 97) % (C.fieldBottom - C.fieldTop));
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 3, y - 8);
        ctx.lineTo(x + 6, y);
        ctx.fill();
      }
      // 底部地面
      ctx.fillStyle = desert ? '#e0b766' : swamp ? '#566f52' : snow ? '#d6e4f2' : lava ? '#3a2a2e' : '#7cbf5e';
      ctx.fillRect(0, C.fieldBottom, C.width, C.height - C.fieldBottom);
      // 城墙后方的家园（沙漠里是帐篷，沼泽里是高脚屋）
      ctx.fillStyle = desert ? '#f5dc9c' : swamp ? '#7f9a74' : snow ? '#eef6fc' : lava ? '#5a4448' : '#b6e3a0';
      ctx.fillRect(0, C.fieldTop, C.wallX - 60, C.fieldBottom - C.fieldTop);
      for (let i = 0; i < 4; i++) {
        const y = C.fieldTop + 70 + i * 130;
        const color = ['#e46a5a', '#5b8fd5', '#e6a34a', '#9a6bd5'][i];
        if (lava) {
          // 石屋
          ctx.fillStyle = '#7a6a66';
          ctx.fillRect(14, y + 4, 54, 36);
          ctx.strokeStyle = '#4a3a38';
          ctx.lineWidth = 2;
          ctx.strokeRect(14, y + 4, 54, 36);
          ctx.fillStyle = color;
          ctx.fillRect(10, y - 4, 62, 10);
          ctx.fillStyle = '#ffd23f';
          ctx.fillRect(34, y + 16, 12, 12);
          continue;
        }
        if (snow) {
          // 冰屋
          ctx.fillStyle = '#f7fbff';
          ctx.beginPath();
          ctx.ellipse(41, y + 36, 32, 30, 0, Math.PI, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#9fb6cc';
          ctx.lineWidth = 2;
          ctx.stroke();
          for (let r = 0; r < 3; r++) {
            ctx.beginPath();
            ctx.moveTo(14 + r * 4, y + 26 - r * 9);
            ctx.lineTo(68 - r * 4, y + 26 - r * 9);
            ctx.stroke();
          }
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.ellipse(41, y + 36, 9, 12, 0, Math.PI, Math.PI * 2);
          ctx.fill();
          continue;
        }
        if (swamp) {
          ctx.strokeStyle = '#5b3c2a';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(20, y + 30);
          ctx.lineTo(20, y + 48);
          ctx.moveTo(62, y + 30);
          ctx.lineTo(62, y + 48);
          ctx.stroke();
          ctx.fillStyle = '#a07a52';
          ctx.fillRect(14, y + 4, 54, 28);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(8, y + 6);
          ctx.lineTo(41, y - 18);
          ctx.lineTo(74, y + 6);
          ctx.fill();
          ctx.fillStyle = '#ffe28a';
          ctx.fillRect(34, y + 12, 12, 10);
          continue;
        }
        if (desert) {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(8, y + 40);
          ctx.lineTo(41, y - 18);
          ctx.lineTo(74, y + 40);
          ctx.fill();
          ctx.fillStyle = '#fff2dc';
          ctx.beginPath();
          ctx.moveTo(34, y + 40);
          ctx.lineTo(41, y + 12);
          ctx.lineTo(48, y + 40);
          ctx.fill();
          continue;
        }
        ctx.fillStyle = '#f6e7c8';
        ctx.fillRect(14, y, 54, 40);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(8, y);
        ctx.lineTo(41, y - 26);
        ctx.lineTo(74, y);
        ctx.fill();
        ctx.fillStyle = '#8a5a3c';
        ctx.fillRect(34, y + 18, 12, 22);
      }
    }

    drawWall(ratio) {
      const ctx = this.ctx;
      const x0 = C.wallX - 64;
      const top = C.fieldTop - 28;
      const bottom = C.fieldBottom + 10;
      const stone = ratio > 0.4 ? '#c9c2b5' : '#b9b0a2';
      // 墙体
      ctx.fillStyle = stone;
      ctx.fillRect(x0, top, 64, bottom - top);
      ctx.strokeStyle = '#8f8676';
      ctx.lineWidth = 2;
      for (let y = top; y < bottom; y += 22) {
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + 64, y);
        ctx.stroke();
        const off = ((y - top) / 22) % 2 ? 0 : 16;
        for (let x = x0 + off; x < x0 + 64; x += 32) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 22);
          ctx.stroke();
        }
      }
      // 垛口
      for (let y = top - 4; y < bottom; y += 44) {
        ctx.fillStyle = stone;
        ctx.fillRect(x0 + 50, y, 22, 26);
        ctx.strokeRect(x0 + 50, y, 22, 26);
      }
      ctx.strokeStyle = '#4d463c';
      ctx.lineWidth = 3;
      ctx.strokeRect(x0, top, 64, bottom - top);
      // 裂纹与缺口（设计书 4.3）
      ctx.strokeStyle = '#4d463c';
      ctx.lineWidth = 2;
      const cracks = ratio < 0.7 ? (ratio < 0.4 ? 9 : 5) : 0;
      for (let i = 0; i < cracks; i++) {
        const cx = x0 + 10 + ((i * 23) % 44);
        const cy = top + 40 + ((i * 97) % (bottom - top - 80));
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + 8, cy + 10);
        ctx.lineTo(cx + 2, cy + 20);
        ctx.lineTo(cx + 10, cy + 30);
        ctx.stroke();
      }
      if (ratio < 0.4) {
        ctx.fillStyle = '#7cbf5e';
        for (let i = 0; i < 3; i++) {
          const cy = top + 100 + i * 170;
          ctx.beginPath();
          ctx.moveTo(x0 + 64, cy);
          ctx.lineTo(x0 + 44, cy + 10);
          ctx.lineTo(x0 + 50, cy + 26);
          ctx.lineTo(x0 + 64, cy + 34);
          ctx.fill();
        }
      }
      // 旗帜
      const fx = x0 + 12;
      const fy = top - 50;
      ctx.strokeStyle = '#5b3c2a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(fx, top);
      ctx.lineTo(fx, fy);
      ctx.stroke();
      const wave = Math.sin(this.t * 4) * 4;
      ctx.fillStyle = ratio < 0.4 ? '#a33' : '#e04848';
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.quadraticCurveTo(fx + 20, fy + wave, fx + 38, fy + 6);
      if (ratio < 0.4) ctx.lineTo(fx + 26, fy + 14);
      ctx.quadraticCurveTo(fx + 20, fy + 20 + wave, fx, fy + 22);
      ctx.fill();
      // 城墙的表情（设计书 1.4：城墙会"说话"）
      const ex = x0 + 30;
      const ey = (top + bottom) / 2 + 40;
      ctx.fillStyle = '#4d463c';
      if (ratio > 0.7) {
        S.ellipse(ctx, ex - 9, ey, 3, 4, '#4d463c');
        S.ellipse(ctx, ex + 9, ey, 3, 4, '#4d463c');
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.arc(ex, ey + 8, 6, 0.2, Math.PI - 0.2);
        ctx.stroke();
      } else if (ratio > 0.4) {
        S.ellipse(ctx, ex - 9, ey, 3, 3, '#4d463c');
        S.ellipse(ctx, ex + 9, ey, 3, 3, '#4d463c');
        ctx.fillRect(ex - 6, ey + 10, 12, 2.5);
      } else {
        ctx.lineWidth = 2;
        for (const dx of [-9, 9]) {
          ctx.beginPath();
          ctx.moveTo(ex + dx - 3, ey - 3);
          ctx.lineTo(ex + dx + 3, ey + 3);
          ctx.moveTo(ex + dx + 3, ey - 3);
          ctx.lineTo(ex + dx - 3, ey + 3);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(ex, ey + 15, 6, Math.PI + 0.3, -0.3);
        ctx.stroke();
        S.ellipse(ctx, ex + 16, ey - 6, 2.5, 4, '#7fd0ff');
      }
    }

    drawRangeMarker(b) {
      const ctx = this.ctx;
      const x = C.wallX + b.range;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.setLineDash([8, 10]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, C.fieldTop + 4);
      ctx.lineTo(x, C.fieldBottom - 4);
      ctx.stroke();
      ctx.restore();
    }

    drawLaneEffects(b) {
      const ctx = this.ctx;
      const h = (C.fieldBottom - C.fieldTop) / b.lanes;
      for (const e of b.laneEffects) {
        const y0 = C.fieldTop + e.lane * h;
        const fade = Math.min(1, (e.until - b.time) * 2);
        ctx.save();
        ctx.globalAlpha = 0.4 * fade;
        ctx.fillStyle = e.type === 'freeze' ? '#cdeeff' : e.type === 'poison' ? '#6fd36a' : e.type === 'lava' ? '#ff7a3d' : '#8fd8ff';
        ctx.fillRect(C.wallX, y0, C.width - C.wallX, h);
        if (e.type === 'poison') {
          ctx.globalAlpha = 0.6 * fade;
          for (let k = 0; k < 10; k++) {
            const bx = C.wallX + ((k * 113 + this.t * 15) % (C.width - C.wallX));
            const by = y0 + h * 0.3 + ((k * 37) % (h * 0.5));
            S.ellipse(ctx, bx, by, 4 + (k % 3), 4 + (k % 3), '#9df58a', '#3d7a2f', 1);
          }
          ctx.restore();
          continue;
        }
        ctx.globalAlpha = 0.7 * fade;
        ctx.fillStyle = '#ffffff';
        for (let k = 0; k < 14; k++) {
          const x = C.wallX + ((k * 89 + this.t * 30) % (C.width - C.wallX));
          const y = y0 + ((k * 41 + this.t * 20) % h);
          S.star(ctx, x, y, 4);
        }
        ctx.restore();
      }
      // 火焰地带
      for (const z of b.zones) {
        if (b.time > z.until) continue;
        const fade = Math.min(1, (z.until - b.time) * 2);
        ctx.save();
        ctx.globalAlpha = 0.45 * fade;
        S.ellipse(ctx, z.x, z.y + 8, z.r, z.r * 0.45, '#ff7a3d');
        ctx.globalAlpha = 0.8 * fade;
        for (let i = 0; i < 4; i++) {
          const fx = z.x - z.r * 0.6 + i * z.r * 0.4;
          const fh = 10 + Math.sin(this.t * 12 + i * 2) * 5;
          ctx.fillStyle = i % 2 ? '#ffd23f' : '#ff8a3d';
          ctx.beginPath();
          ctx.moveTo(fx - 5, z.y + 8);
          ctx.lineTo(fx, z.y + 8 - fh);
          ctx.lineTo(fx + 5, z.y + 8);
          ctx.fill();
        }
        ctx.restore();
      }
      // Boss 冲锋预警
      for (const f of this.flashes) {
        if (b.time > f.until && !(f.m && f.m.ai && f.m.ai.mode === 'charge')) continue;
        const y0 = C.fieldTop + f.m.lane * h;
        const pulse = 0.25 + Math.abs(Math.sin(this.t * 10)) * 0.25;
        ctx.save();
        ctx.fillStyle = `rgba(${f.color},${pulse})`;
        ctx.fillRect(C.wallX, y0, C.width - C.wallX, h);
        ctx.fillStyle = `rgba(${f.color},0.9)`;
        // 箭头形状提示（色弱友好：形状 + 颜色）
        for (let x = C.wallX + 40; x < f.m.x - 60; x += 70) {
          const cy = y0 + h / 2;
          ctx.beginPath();
          ctx.moveTo(x, cy);
          ctx.lineTo(x + 26, cy - 16);
          ctx.lineTo(x + 26, cy + 16);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
      this.flashes = this.flashes.filter((f) => b.time <= f.until || (f.m.ai && f.m.ai.mode === 'charge'));
      // 选择车道时的高亮
      if (this.highlightLanes) {
        for (let i = 0; i < b.lanes; i++) {
          const y0 = C.fieldTop + i * h;
          ctx.save();
          ctx.fillStyle = i === this.hoverLane ? 'rgba(255,230,120,0.38)' : 'rgba(255,255,255,0.16)';
          ctx.fillRect(C.wallX, y0 + 3, C.width - C.wallX, h - 6);
          ctx.strokeStyle = i === this.hoverLane ? '#ffd23f' : 'rgba(255,255,255,0.7)';
          ctx.lineWidth = 3;
          ctx.setLineDash([12, 8]);
          ctx.strokeRect(C.wallX + 2, y0 + 4, C.width - C.wallX - 4, h - 8);
          ctx.restore();
        }
      }
    }

    drawMonster(m, b) {
      const ctx = this.ctx;
      const def = m.def;
      const x = m.x;
      const y = m.y + m.yOffset + (def.flying ? 0 : 6);
      const frozen = b.time < m.frozenUntil;
      const t = frozen ? 0 : this.t + m.id * 0.37;
      ctx.save();
      // 刚分裂出来的小果冻有个弹出动画
      let scale = 1;
      const age = b.time - m.bornAt;
      if (m.splitFrom && age < 0.3) scale = 0.4 + age * 2;
      if (m.burrowed) {
        // 地下移动：只露出一个移动的沙包
        const bump = Math.sin(this.t * 20 + m.id) * 2;
        S.ellipse(ctx, x, y - 4 + bump, def.size * 0.9, def.size * 0.4, '#d9b26a', '#a8844a', 2);
        if (Math.random() < 0.3) this.fx.push({ kind: 'spark', x: x + def.size, y: y - 4, vx: 40 + Math.random() * 40, vy: -60 - Math.random() * 40, color: '#e3c992', life: 0.4, age: 0, r: 2 });
        ctx.restore();
        return;
      }
      if (m.cooked) {
        ctx.save();
        ctx.globalAlpha = 0.35 + Math.sin(this.t * 8 + m.id) * 0.15;
        S.ellipse(ctx, x, y - def.size * 0.8, def.size * 1.5, def.size * 1.3, '#7dff9a');
        ctx.restore();
      }
      const regen = def.regen && b.time - m.lastHit >= def.regen.delay && m.hp < m.maxHp;
      const dark = b.level.dark && x > C.wallX + 450;
      if (m.hidden) ctx.globalAlpha = 0.18;
      if (m.stealthed) ctx.globalAlpha = 0.22 + Math.sin(this.t * 6 + m.id) * 0.06;
      if (dark || m.shade) {
        // 剪影：暗夜远处的怪（黑色）和墨影（深紫色）
        const sil = S.silhouette(m.type, def.size, dark ? '#0c0a1a' : '#231a33');
        if (sil) {
          const sc = scale * DRAW_SCALE;
          const bob = Math.sin(this.t * 6 + m.id) * 1.5;
          if (dark) ctx.globalAlpha *= 0.6;
          ctx.drawImage(sil.canvas, x - sil.ox * sc, y - sil.oy * sc + bob, sil.canvas.width * sc, sil.canvas.height * sc);
          ctx.globalAlpha = 1;
        }
      } else {
        S.monster(ctx, m.type, x, y, def.size, t, { flash: m.hitFlash, attack: m.state === 'attack' || m.state === 'hold', seed: m.id, ai: m.ai, shield: m.shield, regen, scale: scale * DRAW_SCALE });
      }
      if (m.shade && !dark) {
        // 墨影：紫色的眼睛
        S.ellipse(ctx, x - def.size * 0.35, y - def.size * 1.05, 2.5, 2.5, '#c58cff');
        S.ellipse(ctx, x, y - def.size * 1.05, 2.5, 2.5, '#c58cff');
      }
      if (dark) {
        // 黑暗中只看得见一双发光的眼睛
        S.ellipse(ctx, x - def.size * 0.3, y - def.size * 1.0, 2.5, 2.5, '#ffeb6b');
        S.ellipse(ctx, x + def.size * 0.05, y - def.size * 1.0, 2.5, 2.5, '#ffeb6b');
        ctx.restore();
        return;
      }
      // 状态图标
      if (frozen) {
        ctx.globalAlpha = 0.55;
        S.roundRect(ctx, x - def.size * 1.1, y - def.size * 2, def.size * 2.2, def.size * 2.1, 8);
        ctx.fillStyle = '#bfe9ff';
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (b.time < m.burnUntil) {
        for (let i = 0; i < 3; i++) {
          const fy = y - def.size * 1.2 - ((this.t * 40 + i * 9) % 22);
          S.ellipse(ctx, x - 8 + i * 8, fy, 3, 5, i % 2 ? '#ff8a3d' : '#ffd23f');
        }
      }
      if (b.time < m.hasteUntil) {
        ctx.strokeStyle = 'rgba(196,90,210,0.8)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(x + def.size + 4, y - 8 - i * 8);
          ctx.lineTo(x + def.size + 16, y - 8 - i * 8);
          ctx.stroke();
        }
      }
      // 血条（满血不显示，Boss 用顶部大血条）
      if (!def.boss && m.hp < m.maxHp) {
        const w = Math.max(26, def.size * 1.8);
        const by = y - def.size * DRAW_SCALE * (def.flying ? 1.7 : 2.0) - 8;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(x - w / 2 - 1, by - 1, w + 2, 6);
        ctx.fillStyle = m.hp / m.maxHp > 0.5 ? '#6be06b' : m.hp / m.maxHp > 0.25 ? '#ffd23f' : '#ff5a4f';
        ctx.fillRect(x - w / 2, by, (w * m.hp) / m.maxHp, 4);
      }
      ctx.restore();
    }

    drawProjectiles(b) {
      const ctx = this.ctx;
      for (const p of b.projectiles) {
        if (p.done) continue;
        if (p.kind === 'boomerang') {
          ctx.save();
          ctx.translate(p.x, p.y - 10);
          S.boomerang(ctx, 16, p.spin);
          ctx.restore();
          continue;
        }
        if (p.kind === 'zap') {
          ctx.save();
          ctx.strokeStyle = '#bfe3ff';
          ctx.lineWidth = 3;
          ctx.shadowColor = '#5aa8ff';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          const bx = p.x - Math.cos(p.angle) * 60;
          const by = p.y - Math.sin(p.angle) * 60;
          ctx.moveTo(bx, by);
          for (let i = 1; i < 4; i++) ctx.lineTo(bx + (p.x - bx) * (i / 4) + (Math.random() - 0.5) * 12, by + (p.y - by) * (i / 4) + (Math.random() - 0.5) * 12);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          ctx.restore();
          continue;
        }
        if (p.kind === 'orb') {
          ctx.save();
          ctx.globalAlpha = 0.35;
          S.ellipse(ctx, p.x - Math.cos(p.angle) * 10, p.y - Math.sin(p.angle) * 10, 9, 9, '#c58cff');
          ctx.globalAlpha = 1;
          S.ellipse(ctx, p.x, p.y, 7, 7, '#d9b8ff', '#7a3fc0', 2);
          S.ellipse(ctx, p.x - 2, p.y - 2, 2.5, 2.5, '#fff');
          ctx.restore();
          continue;
        }
        if (p.kind === 'shell') {
          const prog = TD.util.clamp(p.travel / Math.max(1, p.dist0), 0, 1);
          const lift = Math.sin(prog * Math.PI) * Math.min(160, p.dist0 * 0.35);
          ctx.save();
          ctx.globalAlpha = 0.2;
          S.ellipse(ctx, p.x, p.y + 4, 8, 3, '#000');
          ctx.globalAlpha = 1;
          S.ellipse(ctx, p.x, p.y - lift, 8, 8, '#3b3b48', OUTLINE_C, 2);
          S.ellipse(ctx, p.x - 2.5, p.y - lift - 2.5, 2.5, 2, 'rgba(255,255,255,0.5)');
          ctx.restore();
          continue;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        if (p.kind === 'bolt') {
          ctx.fillStyle = '#5b3c2a';
          ctx.fillRect(-12, -1.5, 18, 3);
          ctx.fillStyle = '#cfd6de';
          ctx.beginPath();
          ctx.moveTo(6, -4);
          ctx.lineTo(12, 0);
          ctx.lineTo(6, 4);
          ctx.fill();
        } else {
          ctx.strokeStyle = p.crit ? '#ffd23f' : '#8a5a3c';
          ctx.lineWidth = p.crit ? 3.5 : 2.5;
          ctx.beginPath();
          ctx.moveTo(-18, 0);
          ctx.lineTo(8, 0);
          ctx.stroke();
          ctx.fillStyle = '#cfd6de';
          ctx.beginPath();
          ctx.moveTo(8, -4);
          ctx.lineTo(15, 0);
          ctx.lineTo(8, 4);
          ctx.fill();
          ctx.fillStyle = '#e04848';
          ctx.fillRect(-20, -3, 6, 6);
        }
        ctx.restore();
      }
    }

    drawHero(b) {
      const heroY = b ? b.heroY - 6 : (C.fieldTop + C.fieldBottom) / 2 - 6;
      let mood = this.mood;
      let aim = -0.15;
      let shotAge;
      let weapon = this.idleWeapon || 'bow';
      if (b) {
        weapon = b.stats.weapon;
        const ratio = b.wall.hp / b.wall.max;
        if (!b.over) mood = ratio < 0.3 ? 'worried' : 'focus';
        aim = Math.atan2(b.hero.aimY - (heroY - 18), b.hero.aimX - (C.heroX + 10));
        aim = TD.util.clamp(aim, -1.2, 1.2);
        shotAge = b.time - b.hero.shotAt;
      }
      // 英雄脚下的城墙平台
      const ascended = !!(b && b.stats.weaponDef && b.stats.weaponDef.ascended);
      S.hero(this.ctx, C.heroX, heroY, { t: this.t, weapon, aimAngle: aim, shotAge, mood, critAge: this.critAge, ascended });
      // 战鼓等增益光环
      if (b && b.buffs.some((x) => b.time < x.until)) {
        const ctx = this.ctx;
        ctx.save();
        ctx.globalAlpha = 0.5 + Math.sin(this.t * 10) * 0.2;
        ctx.strokeStyle = '#ffb347';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(C.heroX, heroY - 2, 34, 10, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    drawBossBar(b) {
      // 精英挑战会同时出现两个 Boss（设计书 29.2）：并排画两条短血条
      const bosses = b.monsters.filter((m) => m.def.boss && !m.dead).slice(0, 2);
      if (bosses.length === 2) {
        this.drawOneBossBar(bosses[0], C.width / 2 - 170, 300);
        this.drawOneBossBar(bosses[1], C.width / 2 + 170, 300);
      } else if (bosses.length) this.drawOneBossBar(bosses[0], C.width / 2, 460);
    }

    drawOneBossBar(boss, cx, w) {
      const ctx = this.ctx;
      const x = cx - w / 2;
      const y = C.fieldTop - 26;
      ctx.save();
      ctx.fillStyle = 'rgba(40,20,10,0.65)';
      S.roundRect(ctx, x - 6, y - 6, w + 12, 26, 10);
      ctx.fill();
      ctx.fillStyle = '#5a2020';
      ctx.fillRect(x, y, w, 14);
      ctx.fillStyle = '#ff5a4f';
      ctx.fillRect(x, y, (w * boss.hp) / boss.maxHp, 14);
      // 阶段刻度
      if (boss.def.ai === 'boarKing') {
        ctx.fillStyle = '#fff';
        for (const r of [TD.data.boarKing.chargeBelow, TD.data.boarKing.enrageBelow]) ctx.fillRect(x + w * r - 1, y - 2, 2, 18);
      }
      if (boss.shieldMax > 0 && boss.shield > 0) {
        ctx.fillStyle = 'rgba(255,229,138,0.9)';
        ctx.fillRect(x, y - 6, (w * boss.shield) / boss.shieldMax, 5);
      }
      if (boss.def.ai === 'inkBoss') {
        ctx.fillStyle = '#fff';
        for (const r of [TD.data.inkBoss.phase2Below, TD.data.inkBoss.phase3Below, TD.data.inkBoss.phase4Below]) ctx.fillRect(x + w * r - 1, y - 2, 2, 18);
      }
      if (boss.def.ai === 'pharaoh') {
        ctx.fillStyle = '#fff';
        for (const r of [TD.data.pharaoh.phase2Below, TD.data.pharaoh.phase3Below]) ctx.fillRect(x + w * r - 1, y - 2, 2, 18);
      }
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${boss.def.name}  ${Math.ceil(boss.hp)} / ${boss.maxHp}${boss.shield > 0 ? '  🛡 ' + Math.ceil(boss.shield) : ''}`, cx, y + 12);
      if (boss.ai && (boss.ai.mode === 'warn' || boss.ai.mode === 'charge') && (boss.def.ai === 'boarKing' || boss.def.ai === 'inkBoss')) {
        const need = boss.maxHp * (boss.def.ai === 'inkBoss' ? TD.data.inkBoss.interruptRatio : TD.data.boarKing.interruptRatio);
        const pr = Math.min(1, boss.ai.chargeDmg / need);
        ctx.fillStyle = 'rgba(40,20,10,0.65)';
        S.roundRect(ctx, x + w / 2 - 130, y + 22, 260, 22, 8);
        ctx.fill();
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(x + w / 2 - 124, y + 36, 248 * pr, 5);
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(boss.def.ai === 'inkBoss' ? '集中火力打断重击！' : '集中火力打断冲锋！', cx, y + 34);
      }
      ctx.restore();
    }

    drawSandstorm(b) {
      const ctx = this.ctx;
      const left = this.sandUntil - b.time;
      const a = Math.min(1, left, 6 - left) * 0.28;
      ctx.save();
      ctx.fillStyle = `rgba(230,190,110,${a})`;
      ctx.fillRect(0, 0, C.width, C.height);
      ctx.strokeStyle = `rgba(255,240,200,${a * 2})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 40; i++) {
        const x = (i * 97 + this.t * 600) % (C.width + 100) - 50;
        const y = (i * 53) % C.height;
        ctx.beginPath();
        ctx.moveTo(C.width - x, y);
        ctx.lineTo(C.width - x - 40, y + 4);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawSnowfall(blizzard) {
      const ctx = this.ctx;
      ctx.save();
      const n = blizzard ? 120 : 40;
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < n; i++) {
        const sp = blizzard ? 320 : 40;
        const x = (i * 131 + this.t * (blizzard ? -420 : 12) + Math.sin(this.t + i) * 10) % C.width;
        const y = (i * 71 + this.t * sp) % C.height;
        ctx.globalAlpha = blizzard ? 0.8 : 0.7;
        S.ellipse(ctx, x < 0 ? x + C.width : x, y, blizzard ? 2.5 : 2, blizzard ? 2.5 : 2, '#fff');
      }
      if (blizzard) {
        ctx.globalAlpha = 0.18;
        ctx.fillRect(0, 0, C.width, C.height);
      }
      ctx.restore();
    }

    drawWallSeal(b) {
      const ctx = this.ctx;
      const left = this.sealUntil - b.time;
      ctx.save();
      ctx.globalAlpha = Math.min(1, left) * 0.65;
      ctx.fillStyle = '#bfe9ff';
      ctx.fillRect(C.wallX - 68, C.fieldTop - 30, 72, C.fieldBottom - C.fieldTop + 42);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const y = C.fieldTop + i * 70;
        ctx.beginPath();
        ctx.moveTo(C.wallX - 60, y);
        ctx.lineTo(C.wallX - 20, y + 30);
        ctx.lineTo(C.wallX - 40, y + 55);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#e8f8ff';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`冰封 ${Math.ceil(left)}`, C.wallX - 32, C.fieldTop - 36);
      ctx.restore();
    }

    // 冰晶精灵的光环：英雄头上显示减速层数
    drawChill(b) {
      const ctx = this.ctx;
      const n = Math.min(3, b.chillStacks);
      ctx.save();
      for (let i = 0; i < n; i++) {
        ctx.globalAlpha = 0.85;
        S.icon(ctx, 'frost', C.heroX - 24 + i * 24, b.heroY - 118, 10);
      }
      ctx.fillStyle = '#e8f8ff';
      ctx.strokeStyle = 'rgba(30,40,70,0.8)';
      ctx.lineWidth = 3;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      const pct = Math.round(b.aspdMalus() * 100);
      ctx.strokeText(`攻速 −${pct}%`, C.heroX, b.heroY - 136);
      ctx.fillText(`攻速 −${pct}%`, C.heroX, b.heroY - 136);
      ctx.restore();
    }

    drawEmbers() {
      const ctx = this.ctx;
      ctx.save();
      for (let i = 0; i < 30; i++) {
        const x = (i * 157 + Math.sin(this.t * 0.8 + i) * 30) % C.width;
        const y = C.height - ((i * 89 + this.t * (30 + (i % 5) * 10)) % C.height);
        ctx.globalAlpha = 0.5 + Math.sin(this.t * 4 + i) * 0.3;
        S.ellipse(ctx, x, y, 2, 2, i % 3 ? '#ff8a3d' : '#ffd23f');
      }
      ctx.restore();
    }

    drawHeroStun(b) {
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = '#ffd23f';
      for (let i = 0; i < 3; i++) {
        const a = this.t * 6 + (i * Math.PI * 2) / 3;
        S.star(ctx, C.heroX + Math.cos(a) * 26, b.heroY - 100 + Math.sin(a) * 8, 6);
      }
      ctx.restore();
    }

    drawRiftTimer(b) {
      const boss = b.monsters.find((m) => m.def.ai === 'inkBoss' && !m.dead);
      if (!boss || boss.ai.phase !== 4) return;
      const ctx = this.ctx;
      const tLeft = Math.max(0, boss.ai.rageTimer);
      ctx.save();
      ctx.font = 'bold 44px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(30,10,40,0.85)';
      const urgent = tLeft < 5;
      ctx.fillStyle = urgent && Math.sin(this.t * 12) > 0 ? '#ff5050' : '#e2c8ff';
      const txt = `裂隙打击 ${tLeft.toFixed(1)}`;
      ctx.strokeText(txt, C.width / 2, C.fieldTop + 70);
      ctx.fillText(txt, C.width / 2, C.fieldTop + 70);
      ctx.restore();
    }

    drawFog(b) {
      const ctx = this.ctx;
      const left = this.fogUntil - b.time;
      const a = Math.min(1, left, 5 - left) * 0.35;
      ctx.save();
      const g = ctx.createLinearGradient(0, 0, 520, 0);
      g.addColorStop(0, `rgba(110,210,100,${a})`);
      g.addColorStop(1, 'rgba(110,210,100,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 520, C.height);
      ctx.restore();
    }

    drawMist() {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = 0.18;
      for (let i = 0; i < 6; i++) {
        const x = ((this.t * (10 + i * 4) + i * 260) % (C.width + 400)) - 200;
        const y = C.fieldTop + 40 + ((i * 97) % (C.fieldBottom - C.fieldTop - 60));
        S.ellipse(ctx, x, y, 180, 30, '#ffffff');
      }
      ctx.restore();
    }

    drawDarkness() {
      const ctx = this.ctx;
      ctx.save();
      const flick = Math.sin(this.t * 9) * 8;
      const g = ctx.createRadialGradient(C.wallX, (C.fieldTop + C.fieldBottom) / 2, 120, C.wallX, (C.fieldTop + C.fieldBottom) / 2, 560 + flick);
      g.addColorStop(0, 'rgba(10,8,30,0)');
      g.addColorStop(0.75, 'rgba(10,8,30,0.55)');
      g.addColorStop(1, 'rgba(10,8,30,0.78)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, C.width, C.height);
      ctx.restore();
    }

    drawWallWarning(b) {
      const ratio = b.wall.hp / b.wall.max;
      if (ratio >= 0.1 || b.over) return;
      const ctx = this.ctx;
      const a = 0.25 + Math.abs(Math.sin(this.t * 5)) * 0.25;
      const g = ctx.createRadialGradient(C.width / 2, C.height / 2, C.height * 0.35, C.width / 2, C.height / 2, C.width * 0.7);
      g.addColorStop(0, 'rgba(255,0,0,0)');
      g.addColorStop(1, `rgba(255,0,0,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, C.width, C.height);
    }

    drawFx(dt) {
      const ctx = this.ctx;
      const keep = [];
      for (const f of this.fx) {
        f.age += dt;
        if (f.age < 0) {
          keep.push(f);
          continue;
        }
        if (f.age > f.life) continue;
        keep.push(f);
        const k = f.age / f.life;
        ctx.save();
        switch (f.kind) {
          case 'text': {
            f.y += f.vy * dt;
            f.vy *= Math.pow(0.1, dt);
            const pop = f.crit ? 1 + Math.max(0, 0.4 - f.age * 2) : 1;
            ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
            ctx.font = `bold ${Math.round(f.size * pop)}px "Trebuchet MS", sans-serif`;
            ctx.textAlign = 'center';
            ctx.lineWidth = 4;
            ctx.strokeStyle = 'rgba(40,25,15,0.85)';
            ctx.strokeText(f.str, f.x, f.y);
            ctx.fillStyle = f.color;
            ctx.fillText(f.str, f.x, f.y);
            break;
          }
          case 'spark':
            f.x += f.vx * dt;
            f.y += f.vy * dt;
            f.vy += 400 * dt;
            ctx.globalAlpha = 1 - k;
            S.ellipse(ctx, f.x, f.y, f.r, f.r, f.color);
            break;
          case 'rock':
            f.x += f.vx * dt;
            f.y += f.vy * dt;
            f.vy += 600 * dt;
            ctx.globalAlpha = 1 - k;
            ctx.fillStyle = '#8f8676';
            ctx.fillRect(f.x, f.y, f.r * 2, f.r * 2);
            break;
          case 'coin':
            f.x += f.vx * dt;
            f.y += f.vy * dt;
            f.vy += 500 * dt;
            ctx.globalAlpha = 1 - Math.max(0, k - 0.7) / 0.3;
            S.coin(ctx, f.x, f.y, 6, 'copper');
            break;
          case 'poof':
            ctx.globalAlpha = 1 - k;
            S.ellipse(ctx, f.x, f.y, f.r * (0.6 + k), f.r * (0.6 + k), 'rgba(255,255,255,0.8)');
            ctx.fillStyle = '#ffe28a';
            S.star(ctx, f.x, f.y - k * 30, 8 * (1 - k) + 2);
            break;
          case 'ring':
            ctx.globalAlpha = 1 - k;
            ctx.fillStyle = f.color + (0.35 * (1 - k)).toFixed(2) + ')';
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.r0 + (f.r1 - f.r0) * k, 0, Math.PI * 2);
            ctx.fill();
            break;
          case 'fallArrow': {
            const yy = f.y - 140 * (1 - k);
            ctx.strokeStyle = '#8a5a3c';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(f.x + 10 * (1 - k), yy - 26);
            ctx.lineTo(f.x, yy);
            ctx.stroke();
            if (k > 0.8 && !f.burst) {
              f.burst = true;
              this.burst(f.x, f.y, '#fff3c4', 3, 80);
            }
            break;
          }
          case 'bolt': {
            ctx.globalAlpha = 1 - k;
            ctx.strokeStyle = '#d9b8ff';
            ctx.lineWidth = 6;
            ctx.shadowColor = '#b07aff';
            ctx.shadowBlur = 20;
            ctx.beginPath();
            let x = f.x + 30;
            ctx.moveTo(x, 0);
            for (let y = 0; y < f.y; y += 40) {
              x = f.x + (Math.sin(y * 0.3 + f.seed * 10) * 26 * (1 - y / f.y));
              ctx.lineTo(x, y);
            }
            ctx.lineTo(f.x, f.y);
            ctx.stroke();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            S.ellipse(ctx, f.x, f.y, 40 * (1 - k) + 10, 18 * (1 - k) + 4, 'rgba(220,190,255,0.6)');
            break;
          }
          case 'boom':
            ctx.globalAlpha = 1 - k;
            S.ellipse(ctx, f.x, f.y - 10, 20 + k * 40, 16 + k * 30, '#ffb347');
            S.ellipse(ctx, f.x, f.y - 10, 10 + k * 26, 8 + k * 20, '#fff3c4');
            break;
          case 'spit': {
            const x = f.x0 + (f.x1 - f.x0) * k;
            const y = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * 60;
            if (f.fire) S.ellipse(ctx, x, y, 8, 8, '#ffb347', '#e04848', 2);
            else S.ellipse(ctx, x, y, 6, 6, '#9df58a', '#3d7a2f', 1.5);
            if (k > 0.9 && !f.burst) {
              f.burst = true;
              this.burst(f.x1, f.y1, f.fire ? '#ff8a3d' : '#7dff9a', 6, 100);
            }
            break;
          }
          case 'chain': {
            ctx.globalAlpha = 1 - k;
            ctx.strokeStyle = '#e2c8ff';
            ctx.lineWidth = 4;
            ctx.shadowColor = '#b07aff';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(f.x0, f.y0);
            const segs = 5;
            for (let i = 1; i < segs; i++) {
              const tt = i / segs;
              ctx.lineTo(f.x0 + (f.x - f.x0) * tt + (Math.random() - 0.5) * 18, f.y0 + (f.y - f.y0) * tt + (Math.random() - 0.5) * 18);
            }
            ctx.lineTo(f.x, f.y);
            ctx.stroke();
            break;
          }
          case 'splash':
            ctx.globalAlpha = 1 - k;
            if (f.magic) {
              S.ellipse(ctx, f.x, f.y, f.r * (0.4 + k * 0.6), f.r * (0.3 + k * 0.45), 'rgba(197,140,255,0.45)', '#b07aff', 3);
            } else {
              S.ellipse(ctx, f.x, f.y, f.r * (0.4 + k * 0.6), f.r * (0.3 + k * 0.45), 'rgba(255,179,71,0.55)');
              S.ellipse(ctx, f.x, f.y, f.r * (0.2 + k * 0.4), f.r * (0.15 + k * 0.3), 'rgba(255,243,196,0.8)');
            }
            break;
          case 'dustWarn': {
            const pulse = 0.5 + Math.abs(Math.sin(f.age * 12)) * 0.5;
            ctx.globalAlpha = pulse;
            S.ellipse(ctx, f.x, f.y + 6, 46, 16, 'rgba(217,130,43,0.35)', '#d9822b', 3);
            ctx.fillStyle = '#d9822b';
            ctx.font = 'bold 26px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('!', f.x, f.y - 14);
            break;
          }
          case 'flash':
            ctx.globalAlpha = (1 - k) * 0.5;
            ctx.fillStyle = f.color;
            ctx.fillRect(0, 0, C.width, C.height);
            break;
          case 'clang':
            ctx.globalAlpha = 1 - k;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            for (let i = 0; i < 4; i++) {
              const a = (i * Math.PI) / 2 + 0.6;
              ctx.beginPath();
              ctx.moveTo(f.x + Math.cos(a) * 4, f.y + Math.sin(a) * 4);
              ctx.lineTo(f.x + Math.cos(a) * (8 + k * 10), f.y + Math.sin(a) * (8 + k * 10));
              ctx.stroke();
            }
            break;
          case 'banner': {
            const inK = Math.min(1, f.age * 5);
            const outK = 1 - Math.max(0, (f.age - f.life + 0.4) / 0.4);
            ctx.globalAlpha = Math.min(inK, outK);
            ctx.fillStyle = 'rgba(40,25,15,0.55)';
            S.roundRect(ctx, C.width / 2 - 220, 190, 440, 64, 20);
            ctx.fill();
            ctx.font = 'bold 36px "Trebuchet MS", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#fff6d6';
            ctx.fillText(f.str, C.width / 2, 235);
            break;
          }
        }
        ctx.restore();
      }
      this.fx = keep.length > 600 ? keep.slice(-600) : keep;
    }

    laneAt(y) {
      if (!this.battle) return -1;
      if (y < C.fieldTop || y > C.fieldBottom) return -1;
      const h = (C.fieldBottom - C.fieldTop) / this.battle.lanes;
      return Math.floor((y - C.fieldTop) / h);
    }
  }

  TD.Renderer = Renderer;
})((globalThis.TD = globalThis.TD || {}));
