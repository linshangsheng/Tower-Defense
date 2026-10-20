// 战斗画面渲染：背景、城墙、英雄、怪物、弹道与特效（设计书 4.3、10.4）
(function (TD) {
  'use strict';

  const C = TD.config;
  const S = TD.sprites;
  const DRAW_SCALE = 1.25; // 怪物绘制放大倍数（不影响判定）
  const CHEAP_FX = { spark: 1, rock: 1, glow: 1, poof: 1, spirit: 1 };
  const OUTLINE_C = '#3b2a1e';

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.t = 0;
      this.fx = []; // 粒子、飘字等
      this.vfx = TD.Vfx ? new TD.Vfx() : null; // 技能特效（设计书 60.4）
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
      this.vfx = TD.Vfx ? new TD.Vfx() : null;
      this.setChapter(TD.data.chapterOf(battle.stage));
      this.sandUntil = 0;
      this.fogUntil = 0;
      this.blizzardUntil = 0;
      this.sealUntil = 0;
      this.collapse = null;
      this.wallStage = undefined;
      this.fx = [];
      this.flashes = [];
      this.shake = 0;
      this.mood = 'focus';
      this.bgCache = null;
      const on = (type, fn) => battle.on(type, fn.bind(this));
      on('hit', this.onHit);
      // 武器的特效颜色跟武器品质走：绿 / 蓝 / 紫 / 红 / 金（设计书 78.4）；开火时枪口一团光和几点火花
      on('shoot', () => {
        if (!this.scene || this.scene.none || this.fx.length > 200) return;
        const col = this.wcolor();
        const mx = C.heroX + 38;
        const my = battle.heroY - 26;
        this.fx.push({ kind: 'glow', x: mx, y: my, r: 26, color: col, life: 0.14, age: 0 });
        if (this.vfx) {
          this.vfx.spawn(3, () => {
            const a = -0.5 + Math.random();
            const v = 90 + Math.random() * 120;
            return { kind: 'spark', x: mx, y: my, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 60, life: 0.2, r: 1.8, color: col };
          });
        }
      });
      on('death', this.onDeath);
      on('wallHit', this.onWallHit);
      // 城墙血条归零：开始坍塌（设计书 61.6）
      on('end', (res) => {
        if (!res.win && battle.wall.hp <= 0) this.collapse = { t0: this.t };
      });
      on('wallHeal', (e) => {
        if (e.amount > 0) this.text(C.wallX - 70, C.fieldTop + 40, '+' + Math.round(e.amount), '#4fd36a', 26);
        this.burst(C.wallX - 60, (C.fieldTop + C.fieldBottom) / 2, '#7dff9a', 18, 220);
      });
      on('spore', (e) => this.fx.push({ kind: 'ring', x: e.x, y: e.y, r0: 10, r1: e.radius, color: 'rgba(196,90,210,', life: 0.6, age: 0 }));
      // 技能和道具特效（设计书 60.4）
      const V = this.vfx;
      const laneBox = (lane) => {
        const h = (C.fieldBottom - C.fieldTop) / battle.lanes;
        return { y0: C.fieldTop + lane * h, h };
      };
      const iceLane = (lane, n) => {
        const { y0, h } = laneBox(lane);
        V.laneFlash(C.wallX, C.width, y0, h);
        V.shards(C.wallX + 40, Math.min(C.width - 20, C.wallX + battle.range + 80), y0 + h * 0.7, n);
      };
      const wallHeal = (big) => V.heal(C.wallX - 30, C.fieldTop + 20, C.fieldBottom - 20, big);
      on('rainArrow', (e) => (V ? V.rainArrow(e.x, e.y) : this.fx.push({ kind: 'fallArrow', x: e.x, y: e.y, life: 0.18, age: 0 })));
      on('thunderChain', (e) => {
        // e.small = 武器自己的闪电（雷电法球、风暴法球……）：用武器品质的颜色；技能「雷霆一击」仍是紫白色
        this.fx.push({ kind: 'chain', x0: e.x0, y0: e.y0, x: e.x, y: e.y, life: 0.3, age: 0, color: e.small ? e.color : null });
        if (V) V.fx.push({ kind: 'flare', x: e.x, y: e.y, r: 50, color: e.small && e.color ? e.color : '#d8c0ff', life: 0.3, age: 0 });
      });
      on('laneFreeze', (e) => {
        this.shake = Math.max(this.shake, 3);
        if (V && e && e.lane !== undefined) iceLane(e.lane, 30);
      });
      // 雷鸣箭袋的小闪电（设计书 58.3）
      on('gearZap', (e) => (V ? V.zap(e.x, e.y) : this.fx.push({ kind: 'bolt', x: e.x, y: e.y, life: 0.22, age: 0, seed: Math.random(), small: true })));
      on('thunder', (e) => {
        if (V) {
          V.thunder(e.x, e.y, 1);
          this.fx.push({ kind: 'flash', color: '#b090ff', life: 0.25, age: 0 });
        } else this.fx.push({ kind: 'bolt', x: e.x, y: e.y, life: 0.35, age: 0, seed: Math.random() });
        this.shake = Math.max(this.shake, 9);
      });
      on('skill', (e) => {
        if (!V) {
          if (e.id === 'drum') this.burst(C.heroX, battle.heroY - 40, '#ffb347', 20, 200);
          return;
        }
        if (e.id === 'drum') V.shockwave(C.heroX + 10, battle.heroY - 10, '#ffcf6a', 3);
        else if (e.id === 'arrowRain') V.sigil(C.wallX + battle.range * 0.55, C.fieldTop + 4, Math.min(170, battle.range * 0.3), '#ffd27a', 2.4);
        else if (e.id === 'repair') wallHeal(true);
        else if (e.id === 'frost' && e.lane !== undefined) iceLane(e.lane, 22);
        if (e.id === 'frost') this.shake = Math.max(this.shake, 2);
      });
      on('item', (e) => {
        if (e.id === 'bomb') {
          const y = battle.laneY(e.lane);
          for (let i = 0; i < 6; i++) {
            const x = C.wallX + 120 + Math.random() * (battle.range - 120);
            const yy = y + (Math.random() - 0.5) * 40;
            if (V) setTimeout(() => V.boom(x, yy, 1), i * 50);
            else this.fx.push({ kind: 'boom', x, y: yy, life: 0.5, age: -i * 0.05 });
          }
          this.fx.push({ kind: 'flash', color: '#ffb060', life: 0.2, age: 0 });
          this.shake = Math.max(this.shake, 12);
        }
        if (!V) return;
        if (e.id === 'patch') wallHeal(false);
        else if (e.id === 'freeze') iceLane(e.lane, 34);
        else if (e.id === 'haste') V.shockwave(C.heroX + 10, battle.heroY - 10, '#8affd8', 2);
        else if (e.id === 'firebomb') {
          const { y0, h } = laneBox(e.lane);
          V.fireWall(C.wallX, C.width - 30, y0, h);
          this.shake = Math.max(this.shake, 5);
        } else if (e.id === 'bigBomb') {
          for (let l = Math.max(0, e.lane - 1); l <= Math.min(battle.lanes - 1, e.lane + 1); l++) {
            const y = battle.laneY(l);
            for (let i = 0; i < 5; i++) {
              const x = C.wallX + 140 + Math.random() * (battle.range - 140);
              setTimeout(() => V.boom(x, y + (Math.random() - 0.5) * 30, 1.35), i * 55 + (l - e.lane + 1) * 40);
            }
          }
          this.fx.push({ kind: 'flash', color: '#ffb060', life: 0.3, age: 0 });
          this.shake = Math.max(this.shake, 16);
        } else if (e.id === 'barrier') V.barrier(C.wallX - 20, C.fieldTop, C.fieldBottom);
        else if (e.id === 'warBanner') V.bannerRaise(C.heroX + 10, battle.heroY - 10);
        else if (e.id === 'quake') {
          V.quake(C.wallX + 40, C.width - 20, C.fieldTop, C.fieldBottom);
          this.shake = Math.max(this.shake, 22);
        } else if (e.id === 'blizzard') {
          V.frostSweep(C.width, C.height);
          for (let l = 0; l < battle.lanes; l++) iceLane(l, 14);
          this.fx.push({ kind: 'flash', color: '#dff4ff', life: 0.3, age: -0.5 });
        } else if (e.id === 'flood') {
          V.flood(C.wallX - 30, C.width, C.fieldTop - 10, C.fieldBottom + 10);
          this.shake = Math.max(this.shake, 12);
        } else if (e.id === 'holyLight') {
          V.holyBeam(C.wallX - 30, C.fieldTop, C.fieldBottom);
          wallHeal(true);
          this.fx.push({ kind: 'flash', color: '#fff2c4', life: 0.4, age: 0 });
        } else if (e.id === 'chrono') {
          V.chronoRings(C.heroX + 10, battle.heroY, C.width, C.height);
          for (let l = 0; l < battle.lanes; l++) iceLane(l, 10);
        }
      });
      on('scrollBolt', (e) => {
        if (!V) return;
        V.thunder(e.x, e.y, 0.75);
        this.fx.push({ kind: 'flash', color: '#b090ff', life: 0.2, age: 0 });
        this.shake = Math.max(this.shake, 8);
      });
      on('meteor', (e) => V && V.meteorFall(e.x, e.y, e.fall));
      on('meteorHit', (e) => {
        if (!V) return;
        V.meteorLand(e.x, e.y, e.radius);
        this.shake = Math.max(this.shake, 9);
      });
      on('barrierBreak', () => V && V.barrierBreak(C.wallX - 20, C.fieldTop, C.fieldBottom));
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
      on('splash', (e) => this.fx.push({ kind: 'splash', x: e.x, y: e.y, r: e.radius, magic: e.magic, color: e.color, life: 0.35, age: 0 }));
      // 满级专精（设计书 53）
      on('pierce', (e) => this.fx.push({ kind: 'chain', x0: e.x0, y0: e.y, x: e.x1 + 20, y: e.y, life: 0.15, age: 0, straight: true, color: e.color }));
      on('knock', (e) => {
        this.fx.push({ kind: 'ring', x: e.x, y: e.y, r0: 10, r1: e.r + 20, color: 'rgba(255,200,120,', life: 0.3, age: 0 });
        this.shake = Math.max(this.shake, 4);
      });
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
        if (V) V.boom(e.m.x, e.m.y, 0.8);
        else this.fx.push({ kind: 'boom', x: e.m.x, y: e.m.y, life: 0.5, age: 0 });
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
        for (let i = 0; i < 6; i++) {
          const x = e.m.x + (Math.random() - 0.5) * 80;
          const y = e.m.y - 20 + (Math.random() - 0.5) * 40;
          if (V) setTimeout(() => V.boom(x, y, 1.1), i * 60);
          else this.fx.push({ kind: 'boom', x, y, life: 0.6, age: -i * 0.06 });
        }
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
      // 助战伙伴（设计书 51）
      on('buddyShot', (e) => {
        const p = this.buddyPos(battle);
        this.fx.push({ kind: 'chain', x0: p.x, y0: p.y - 30, x: e.x, y: e.y, life: 0.35, age: 0 });
        this.text(p.x, p.y - 60, e.name + '！', '#ff8ab4', 18, 0.8);
        this.burst(e.x, e.y, e.buddy === 'inkBoss' ? '#2a2438' : '#fff36b', 14, 220);
      });
      // 技能协同（设计书 45）
      on('combo', (e) => {
        this.text(e.x, e.y, e.name, '#7ad0ff', 26, 1.1);
        this.burst(e.x, e.y + 20, '#bfe8ff', 18, 260);
      });
      // Lyra的铃声（设计书 42.2）
      on('bell', (e) => {
        this.fx.push({ kind: 'ring', x: e.x, y: e.y, r0: 10, r1: e.radius, color: 'rgba(255,210,63,', life: 0.45, age: 0 });
        this.text(e.x, e.y - 40, '叮！', '#ffd23f', 20, 0.6);
      });
      // 连击（设计书 38.2）
      on('streak', (e) => {
        this.text(C.heroX + 60, battle.heroY - 130, e.text, e.count >= 30 ? '#ff5a4f' : '#ffd23f', 22 + Math.min(14, e.count / 4), 1.1);
        this.burst(C.heroX + 40, battle.heroY - 100, '#ffd23f', 10 + Math.min(20, e.count / 2), 240);
      });
      // 第六章（设计书 33）
      on('dodge', (e) => this.text(e.x, e.y - 30, '闪避', '#9fb6cc', 16, 0.5));
      on('woolHit', (e) => {
        if (Math.random() < 0.35) this.burst(e.x, e.y - 10, '#ffffff', 3, 90);
      });
      on('shear', (e) => {
        this.burst(e.m.x, e.m.y - 14, '#ffffff', 14, 220);
        this.text(e.m.x, e.m.y - 46, '剃光啦！', '#ff8ab4', 18, 0.7);
      });
      on('staticShock', (e) => {
        this.fx.push({ kind: 'chain', x0: e.m.x, y0: e.m.y - 10, x: C.heroX, y: battle.heroY - 60, life: 0.3, age: 0 });
        this.text(C.heroX + 40, battle.heroY - 110, '被电麻了！', '#ffd23f', 22, 0.9);
      });
      on('stunBlocked', () => this.text(C.heroX + 40, battle.heroY - 110, '避雷针！', '#7ab8ff', 20, 0.7));
      on('gustWarn', (e) => this.text(e.m.x, e.m.y - 130, '要刮大风了！', '#7ab8ff', 26, 1.2));
      on('gust', () => {
        this.shake = Math.max(this.shake, 10);
        this.fx.push({ kind: 'flash', color: '#dff1ff', life: 0.4, age: 0 });
        this.banner('呼——大风把怪物吹向了城墙！');
      });
      on('thunderBolt', () => {
        this.shake = Math.max(this.shake, 22);
        if (V) V.thunder(C.wallX + 20, battle.heroY, 1.2);
        else this.fx.push({ kind: 'bolt', x: C.wallX + 20, y: battle.heroY, life: 0.4, age: 0, seed: Math.random() });
        this.fx.push({ kind: 'flash', color: '#fff6b0', life: 0.5, age: 0 });
      });
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
      // 第七章（设计书 52.6）
      on('shell', (e) => this.text(e.m.x, e.m.y - 46, '缩壳', '#f2d2a8', 15, 0.5));
      on('leap', (e) => this.burst(e.m.x, e.m.y + 2, '#bfe8ff', 6, 120));
      on('bubble', (e) => this.fx.push({ kind: 'spit', x0: e.from.x - 14, y0: e.from.y - 40, x1: e.m.x, y1: e.m.y + e.m.yOffset - 20, life: 0.4, age: 0, bubble: true }));
      on('bubblePop', (e) => {
        this.fx.push({ kind: 'ring', x: e.x, y: e.y - 18, r0: 14, r1: 30, color: 'rgba(122,208,255,', life: 0.25, age: 0 });
        this.text(e.x, e.y - 40, '啵', '#7ad0ff', 16, 0.45);
      });
      on('spikes', (e) => {
        this.fx.push({ kind: 'ring', x: e.x, y: e.y, r0: 8, r1: e.radius, color: 'rgba(138,90,200,', life: 0.35, age: 0 });
        this.burst(e.x, e.y - 10, '#8a5ac8', 10, 220);
      });
      on('slap', (e) => {
        this.fx.push({ kind: 'spit', x0: e.x - 10, y0: e.y - 50, x1: C.wallX - 10, y1: e.y - 30, life: 0.35, age: 0, ink: true });
        this.shake = Math.max(this.shake, 3);
      });
      on('clamOpen', (e) => this.text(e.m.x, e.m.y - 110, '张壳了！快打！', '#ff8ab4', 24, 0.9));
      on('clamClose', (e) => this.burst(e.m.x, e.m.y - 30, '#ffb3d1', 8, 140));
      on('pearl', (e) => this.fx.push({ kind: 'spit', x0: e.m.x - 20, y0: e.m.y - 50, x1: C.wallX - 10, y1: e.m.y - 30, life: 0.45, age: 0, pearl: true }));
      on('tentacleGrow', (e) => this.burst(e.m.x, e.m.y + 4, '#d9c08a', 10, 160));
      on('tentacleRetract', () => this.banner('触手都缩回海里去了！'));
      on('wallBubblePop', () => this.text(C.wallX + 10, C.fieldTop + 40, '泡泡护盾破了', '#7ad0ff', 18, 0.8));
    }

    // ---------- 特效工具 ----------
    text(x, y, str, color, size, life, crit) {
      if (this.fx.length > 300 && !crit) return;
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

    // 当前武器的特效颜色 = 武器品质色
    wcolor() {
      const b = this.battle;
      if (!b) return '#fff0c0';
      const w = b.stats.weaponDef || TD.data.weapons[b.stats.weapon];
      return TD.data.weaponRarity[(w && w.rarity) || 1].color;
    }

    onHit(e) {
      if (e.source === 'thorns') return;
      const big = e.crit;
      const color = e.source === 'burn' ? '#ff8a3d' : e.source === 'thunder' ? '#c58cff' : big ? '#ffd23f' : '#ffffff';
      const size = e.source === 'burn' ? 15 : big ? 30 : e.dmg >= 100 ? 24 : 19;
      this.text(e.x + (Math.random() - 0.5) * 16, e.y - e.m.def.size * 1.4, (big ? '暴击 ' : '') + Math.round(e.dmg), color, size, big ? 0.9 : 0.6, big);
      // 武器打出的命中光和火花用武器品质的颜色（技能、灼烧等仍用原来的颜色）
      const wsrc = e.source === 'weapon' || e.source === 'splash' || e.source === 'chain';
      const wcol = wsrc ? this.wcolor() : null;
      if (this.scene && !this.scene.none && e.source !== 'burn') this.fx.push({ kind: 'glow', x: e.x, y: e.y - e.m.def.size * 0.6, r: big ? 46 : 26, color: wcol || (big ? '#ffd970' : '#fff2cc'), life: big ? 0.28 : 0.16, age: 0 });
      if (wcol && this.vfx && !big && this.fx.length < 240) {
        const yy = e.y - e.m.def.size * 0.6;
        this.vfx.spawn(3, () => {
          const a = Math.random() * Math.PI * 2;
          const v = 70 + Math.random() * 120;
          return { kind: 'spark', x: e.x, y: yy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 160, life: 0.22, r: 1.5, color: wcol };
        });
      }
      if (e.blocked) this.fx.push({ kind: 'clang', x: e.x - e.m.def.size * 0.8, y: e.y - e.m.def.size * 0.7, life: 0.25, age: 0 });
      if (big) {
        this.critAge = 0;
        this.shake = Math.max(this.shake, 3);
        // 暴击：一圈金光 + 几道火花（设计书 60.4）
        if (this.vfx && e.source !== 'burn') {
          const y = e.y - e.m.def.size * 0.6;
          this.vfx.fx.push({ kind: 'ring', x: e.x, y, r0: 6, r1: 44, color: wcol || '#ffd970', w: 2.5, life: 0.28, age: 0 });
          this.vfx.spawn(5, () => {
            const a = Math.random() * Math.PI * 2;
            const v = 120 + Math.random() * 160;
            return { kind: 'spark', x: e.x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 200, life: 0.25, r: 1.6, color: wcol || '#ffe6a0' };
          });
        }
        if (TD.audio) TD.audio.play('crit');
      } else if (TD.audio && e.source === 'weapon') TD.audio.play('hit');
    }

    onDeath(e) {
      const m = e.m;
      if (this.scene && !this.scene.none) {
        // 化作一团光点慢慢升起（设计书 54.5）
        const n = m.def.boss ? 30 : 7;
        for (let i = 0; i < n; i++) {
          this.fx.push({ kind: 'spirit', x: m.x + (Math.random() - 0.5) * m.def.size, y: m.y + m.yOffset - m.def.size * 0.6, vx: (Math.random() - 0.5) * 50, vy: -40 - Math.random() * 70, r: 6 + Math.random() * 8, color: this.scene.palette.mote, life: 0.8 + Math.random() * 0.6, age: 0 });
        }
        this.fx.push({ kind: 'glow', x: m.x, y: m.y + m.yOffset - m.def.size * 0.6, r: m.def.size * 2.6, color: this.scene.palette.rim, life: 0.3, age: 0 });
      }
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
      // Boss 倒下：几圈冲击波和一大团光（设计书 60.4）
      if (m.def.boss && this.vfx) {
        this.vfx.shockwave(m.x, m.y + m.yOffset, '#fff2c4', 3);
        this.vfx.fx.push({ kind: 'flare', x: m.x, y: m.y + m.yOffset - m.def.size, r: 280, color: '#fff2c4', life: 0.7, age: 0 });
      }
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
      // 妖塔里几百只怪同时啃城墙：碎石特效超过上限就不再加（设计书 74.5）
      for (let i = 0; i < (this.fx.length > 160 ? 0 : e.big ? 16 : 3); i++) {
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
      // 体积渐变只用在进缓存的精灵上（设计书 55.3）；每帧直接画的东西保持纯色，省性能
      const vol = S.volume;
      S.volume = false;
      this.renderFrame(dt);
      S.volume = vol;
    }

    renderFrame(dt) {
      const ctx = this.ctx;
      const b = this.battle;
      this.t += dt;
      this.lastDt = dt;
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
        // 怪物很多时降低光影缓存的刷新率（设计书 55.3）
        // 怪物很多时降低光影缓存的刷新率、合并动画相位（妖塔里同屏几百只，设计书 74.5）
        const tower = !!b.level.tower;
        if (TD.art) TD.art.LIT_FPS = tower ? (alive.length > 150 ? 2 : 4) : alive.length > 60 ? 8 : 12;
        this.litGroups = tower ? 1 : alive.length > 100 ? 2 : 4;
        this.crowd = alive.length > 400 ? 0.62 : alive.length > 250 ? 0.72 : alive.length > 150 ? 0.82 : alive.length > 80 ? 1 : 0;
        this.crowdBars = alive.length <= 250; // 同屏很多时，小妖不画血条（妖王照画）
        if (TD.Vfx && TD.Vfx.setCap) TD.Vfx.setCap(alive.length > 40 ? 240 : 520);
        alive.sort((a, c) => (a.def.flying ? 1 : 0) - (c.def.flying ? 1 : 0) || a.y - c.y);
        this.darkEyes = [];
        for (const m of alive) this.drawMonster(m, b);
        this.drawProjectiles(b);
      }
      if (b) this.drawHeroAura(b, dt);
      this.drawHero(b);
      if (b && b.buddy) this.drawBuddy(b);
      if (this.vfx) this.vfx.draw(ctx, dt);
      // 漂浮光点、景深雾、前景剪影、暗角（设计书 54.3）
      const sc = this.sceneFor(lanes);
      if (sc) {
        if (TD.art.opts.motes) TD.art.drawMotes(ctx, this.motes, sc.palette.mote, dt, this.t);
        if (TD.art.opts.front) ctx.drawImage(sc.front, 0, 0);
      }
      if (b && b.time < this.sandUntil) this.drawSandstorm(b);
      if (b && b.time < this.fogUntil) this.drawFog(b);
      if (b && b.level.dark) this.drawDarkness(b);
      else if (this.theme.swamp || this.theme.moon8) this.drawMist();
      // 暗夜里不画雪和飘浮的火星（它们会在黑暗里发亮，破坏全黑，设计书 69.2）
      const night = !!(b && b.level.dark);
      if (this.theme.snow && !night) this.drawSnowfall(b && b.time < this.blizzardUntil);
      if ((this.theme.lava || this.theme.forge9) && !night) this.drawEmbers();
      if (b && b.storm) this.drawStormRain();
      if (b && b.whirl) this.drawWhirl();
      if (b && b.wallShield > 0) {
        // 贝贝的泡泡护盾（助战伙伴，设计书 52.7）
        ctx.save();
        ctx.globalAlpha = 0.22 + Math.sin(this.t * 3) * 0.05;
        S.ellipse(ctx, C.wallX - 20, (C.fieldTop + C.fieldBottom) / 2, 60, (C.fieldBottom - C.fieldTop) / 2 + 10, '#bfe8ff', '#7ad0ff', 3);
        ctx.restore();
      }
      if (b && b.itemShield > 0) this.drawBarrier(b);
      if (b && b.time < b.heroStunUntil) this.drawHeroStun(b);
      if (b) this.drawRiftTimer(b);
      if (b && b.time < this.sealUntil) this.drawWallSeal(b);
      if (b && b.chillStacks > 0) this.drawChill(b);
      this.drawFx(dt);
      if (b) this.drawBossBar(b);
      if (b) this.drawWallWarning(b);
      ctx.restore();
    }

    // 雷雷的暴风雨：斜着落下的雨丝 + 偶尔的闪光（设计书 33.3）
    drawStormRain() {
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = 'rgba(40,50,80,0.18)';
      ctx.fillRect(0, 0, C.width, C.height);
      ctx.strokeStyle = 'rgba(200,220,255,0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 90; i++) {
        const x = (i * 97 + this.t * 900) % (C.width + 200) - 100;
        const y = (i * 53 + this.t * 1300) % C.height;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 8, y + 22);
      }
      ctx.stroke();
      if (Math.sin(this.t * 1.7) > 0.985) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(0, 0, C.width, C.height);
      }
      ctx.restore();
    }

    // 波波的大漩涡：画面右侧旋转的水纹（设计书 52.3）
    drawWhirl() {
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = 'rgba(40,120,170,0.12)';
      ctx.fillRect(0, 0, C.width, C.height);
      ctx.strokeStyle = 'rgba(190,235,255,0.5)';
      ctx.lineWidth = 3;
      const cx = 1000;
      const cy = (C.fieldTop + C.fieldBottom) / 2;
      for (let i = 0; i < 5; i++) {
        const r = 60 + i * 55;
        const a0 = this.t * (1.6 - i * 0.2) + i;
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * 0.55, 0, a0, a0 + Math.PI * 1.2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 光影手绘场景（设计书 54）：有章节光影设定时用新的分层场景
    sceneFor(lanes) {
      if (!TD.art || typeof document === 'undefined') return null;
      const key = lanes + ':' + (this.theme.art || '');
      if (!this.scene || this.scene.key !== key) {
        const sc = this.paintScene(this.theme, lanes, key);
        this.scene = sc || { key, none: true };
        if (sc) this.motes = TD.art.makeMotes(28);
      }
      return this.scene.none ? null : this.scene;
    }

    // 画好的场景留几张在缓存里，来回切换章节时不用重画
    paintScene(theme, lanes, key) {
      this.sceneCache = this.sceneCache || new Map();
      if (this.sceneCache.has(key)) return this.sceneCache.get(key);
      const sc = TD.art.paintScene(theme, lanes);
      if (!sc) return null;
      Object.assign(sc, { key });
      this.sceneCache.set(key, sc);
      if (this.sceneCache.size > 3) this.sceneCache.delete(this.sceneCache.keys().next().value);
      return sc;
    }

    // 预先画好第 n 关的战场背景（设计书 57.4，启动动画期间调用）
    prewarm(n) {
      const D = TD.data;
      const lv = D.levels[n] || D.levels[1];
      if (!TD.art || typeof document === 'undefined' || !lv.lanes) return;
      const theme = D.chapterOf(D.levels[n] ? n : 1).theme;
      this.paintScene(theme, lv.lanes, lv.lanes + ':' + (theme.art || ''));
    }

    drawBackground(lanes) {
      const sc = this.sceneFor(lanes);
      if (sc) {
        const ctx = this.ctx;
        ctx.drawImage(sc.back, 0, 0);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.6 + Math.sin(this.t * 0.6) * 0.25;
        if (TD.art.opts.shafts) ctx.drawImage(sc.shafts, 0, 0);
        ctx.restore();
        return;
      }
      const key = lanes + (this.theme.desert ? 'd' : this.theme.swamp ? 's' : this.theme.snow ? 'w' : this.theme.lava ? 'l' : this.theme.sky6 ? 'c' : this.theme.sea7 ? 'o' : 'g');
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
      sky.addColorStop(0, th.desert ? '#ffd38a' : th.swamp ? '#8f87a8' : th.snow ? '#b9dcf5' : th.lava ? '#2a1420' : th.sky6 ? '#ffd6ea' : th.sea7 ? '#7fd0f0' : '#9fdcff');
      sky.addColorStop(1, th.sky);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, C.width, C.fieldTop);
      const desert = !!th.desert;
      const swamp = !!th.swamp;
      const snow = !!th.snow;
      const lava = !!th.lava;
      const cloud = !!th.sky6;
      const sea = !!th.sea7;
      if (sea) {
        // 海平面、灯塔和小帆船（设计书 52.6）
        ctx.fillStyle = '#4ab0d8';
        ctx.fillRect(0, C.fieldTop - 46, C.width, 46);
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 2;
        for (let k = 0; k < 18; k++) {
          const wx = (k * 173) % C.width;
          const wy = C.fieldTop - 40 + ((k * 37) % 26);
          ctx.beginPath();
          ctx.moveTo(wx, wy);
          ctx.quadraticCurveTo(wx + 9, wy - 4, wx + 18, wy);
          ctx.stroke();
        }
        // 灯塔
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(1040, C.fieldTop - 30);
        ctx.lineTo(1048, C.fieldTop - 96);
        ctx.lineTo(1064, C.fieldTop - 96);
        ctx.lineTo(1072, C.fieldTop - 30);
        ctx.fill();
        ctx.fillStyle = '#ff5a5a';
        ctx.fillRect(1045, C.fieldTop - 76, 22, 10);
        ctx.fillRect(1042, C.fieldTop - 52, 28, 10);
        ctx.fillStyle = '#ffe28a';
        ctx.fillRect(1049, C.fieldTop - 108, 14, 12);
        ctx.fillStyle = '#ff5a5a';
        ctx.beginPath();
        ctx.moveTo(1044, C.fieldTop - 108);
        ctx.lineTo(1056, C.fieldTop - 120);
        ctx.lineTo(1068, C.fieldTop - 108);
        ctx.fill();
        // 小帆船
        ctx.fillStyle = '#a07a52';
        ctx.beginPath();
        ctx.moveTo(560, C.fieldTop - 34);
        ctx.lineTo(620, C.fieldTop - 34);
        ctx.lineTo(608, C.fieldTop - 24);
        ctx.lineTo(572, C.fieldTop - 24);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(590, C.fieldTop - 36);
        ctx.lineTo(590, C.fieldTop - 76);
        ctx.lineTo(616, C.fieldTop - 38);
        ctx.fill();
      }
      if (cloud) {
        // 彩虹与浮空岛（设计书 33.6）
        const cols = ['#ff7a7a', '#ffb347', '#ffe066', '#7fd67a', '#7ab8ff', '#b48aff'];
        ctx.lineWidth = 7;
        cols.forEach((c, i) => {
          ctx.strokeStyle = c;
          ctx.globalAlpha = 0.55;
          ctx.beginPath();
          ctx.arc(860, C.fieldTop + 40, 150 - i * 7, Math.PI * 1.08, Math.PI * 1.92);
          ctx.stroke();
        });
        ctx.globalAlpha = 1;
        for (const [ix, iy, iw] of [
          [420, 46, 70],
          [1120, 36, 56],
        ]) {
          ctx.fillStyle = '#a07a52';
          ctx.beginPath();
          ctx.moveTo(ix - iw, iy);
          ctx.lineTo(ix + iw, iy);
          ctx.lineTo(ix + iw * 0.2, iy + 30);
          ctx.lineTo(ix - iw * 0.3, iy + 24);
          ctx.fill();
          ctx.fillStyle = '#8fd17a';
          S.roundRect(ctx, ix - iw - 4, iy - 8, iw * 2 + 8, 12, 6);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.fillRect(ix - 8, iy - 26, 16, 18);
          ctx.fillStyle = '#ff8ab4';
          ctx.beginPath();
          ctx.moveTo(ix - 12, iy - 24);
          ctx.lineTo(ix, iy - 36);
          ctx.lineTo(ix + 12, iy - 24);
          ctx.fill();
        }
      }
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
      ctx.fillStyle = desert ? '#f0c878' : swamp ? '#5f7a5d' : snow ? '#dbe9f6' : lava ? '#4a3438' : cloud ? '#ffffff' : sea ? '#f6e8c0' : '#8fd17a';
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
        ctx.fillStyle = desert ? '#e9c27a' : swamp ? '#8a7a5a' : snow ? '#cfdcea' : lava ? '#6a4a44' : cloud ? '#f7faff' : sea ? '#fbf1d4' : '#e3c992';
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
        } else if (i > 0 && sea) {
          // 车道之间是退潮留下的小水沟
          ctx.fillStyle = 'rgba(90,180,220,0.45)';
          ctx.fillRect(C.wallX, y0 - 3, C.width - C.wallX, 6);
        } else if (i > 0 && cloud) {
          // 云朵铺成的路之间是蓝天的缝隙
          ctx.fillStyle = 'rgba(150,200,250,0.55)';
          ctx.fillRect(C.wallX, y0 - 3, C.width - C.wallX, 6);
        } else if (i > 0) {
          ctx.fillStyle = 'rgba(70,140,60,0.35)';
          ctx.fillRect(C.wallX, y0 - 2, C.width - C.wallX, 4);
        }
        for (let k = 0; k < 9; k++) {
          const fx = C.wallX + 60 + ((k * 137 + i * 61) % (C.width - C.wallX - 80));
          const fy = y0 + 10 + ((k * 53 + i * 29) % 16);
          if (cloud) {
            // 小云朵 / 星星糖
            if (k % 3 === 0) {
              S.ellipse(ctx, fx, fy, 10, 5, 'rgba(255,255,255,0.95)');
              S.ellipse(ctx, fx + 7, fy - 3, 7, 5, 'rgba(255,255,255,0.95)');
            } else S.ellipse(ctx, fx, fy, 2.6, 2.6, ['#ff8ab4', '#ffd23f', '#7ab8ff'][(k + i) % 3]);
            continue;
          }
          if (sea) {
            if (k % 3 === 0) {
              // 小珊瑚
              ctx.strokeStyle = '#ff8a9a';
              ctx.lineWidth = 3;
              ctx.lineCap = 'round';
              ctx.beginPath();
              ctx.moveTo(fx, fy + 2);
              ctx.lineTo(fx, fy - 12);
              ctx.moveTo(fx, fy - 5);
              ctx.lineTo(fx - 6, fy - 11);
              ctx.moveTo(fx, fy - 8);
              ctx.lineTo(fx + 6, fy - 15);
              ctx.stroke();
            } else if (k % 3 === 1) {
              // 小海星
              ctx.fillStyle = '#ffb347';
              ctx.beginPath();
              for (let a = 0; a < 10; a++) {
                const r = a % 2 ? 2.5 : 6;
                const ang = -Math.PI / 2 + (a * Math.PI) / 5;
                ctx.lineTo(fx + Math.cos(ang) * r, fy + Math.sin(ang) * r);
              }
              ctx.fill();
            } else S.ellipse(ctx, fx, fy, 4, 3, '#fff3e6', 'rgba(200,150,120,0.6)', 1);
            continue;
          }
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
      ctx.fillStyle = desert ? 'rgba(170,120,60,0.35)' : swamp ? 'rgba(40,70,40,0.5)' : snow ? 'rgba(150,180,210,0.35)' : lava ? 'rgba(255,120,60,0.25)' : cloud ? 'rgba(170,200,240,0.3)' : sea ? 'rgba(190,160,100,0.3)' : 'rgba(60,130,50,0.5)';
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
      ctx.fillStyle = desert ? '#e0b766' : swamp ? '#566f52' : snow ? '#d6e4f2' : lava ? '#3a2a2e' : cloud ? '#dce9fb' : sea ? '#ecd7a6' : '#7cbf5e';
      ctx.fillRect(0, C.fieldBottom, C.width, C.height - C.fieldBottom);
      // 城墙后方的家园（沙漠里是帐篷，沼泽里是高脚屋）
      ctx.fillStyle = desert ? '#f5dc9c' : swamp ? '#7f9a74' : snow ? '#eef6fc' : lava ? '#5a4448' : cloud ? '#f0f6ff' : sea ? '#f3e3b8' : '#b6e3a0';
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
        if (sea) {
          // 渔村小屋：木头墙、蓝屋顶、晾着的渔网
          ctx.fillStyle = '#c99a6a';
          ctx.fillRect(18, y + 8, 46, 30);
          ctx.strokeStyle = '#8a6a4a';
          ctx.lineWidth = 2;
          ctx.strokeRect(18, y + 8, 46, 30);
          for (let r = 1; r < 3; r++) {
            ctx.beginPath();
            ctx.moveTo(18, y + 8 + r * 10);
            ctx.lineTo(64, y + 8 + r * 10);
            ctx.stroke();
          }
          ctx.fillStyle = ['#4a8ad8', '#2a5a9a', '#5ab8c8', '#4a8ad8'][i];
          ctx.beginPath();
          ctx.moveTo(12, y + 10);
          ctx.lineTo(41, y - 12);
          ctx.lineTo(70, y + 10);
          ctx.fill();
          ctx.fillStyle = '#ffe28a';
          ctx.fillRect(35, y + 16, 12, 10);
          ctx.strokeStyle = 'rgba(120,90,60,0.6)';
          ctx.lineWidth = 1;
          for (let r = 0; r < 4; r++) {
            ctx.beginPath();
            ctx.moveTo(70 + r * 4, y + 12);
            ctx.lineTo(70 + r * 4, y + 36);
            ctx.moveTo(70, y + 14 + r * 6);
            ctx.lineTo(84, y + 14 + r * 6);
            ctx.stroke();
          }
          continue;
        }
        if (cloud) {
          // 云上小屋：坐在一朵云上
          S.ellipse(ctx, 41, y + 42, 34, 10, '#ffffff');
          S.ellipse(ctx, 22, y + 38, 14, 9, '#ffffff');
          S.ellipse(ctx, 60, y + 38, 14, 9, '#ffffff');
          ctx.fillStyle = '#fff6e6';
          ctx.fillRect(20, y + 8, 42, 28);
          ctx.strokeStyle = '#c9b8a0';
          ctx.lineWidth = 2;
          ctx.strokeRect(20, y + 8, 42, 28);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(14, y + 10);
          ctx.lineTo(41, y - 14);
          ctx.lineTo(68, y + 10);
          ctx.fill();
          ctx.fillStyle = '#7ab8ff';
          ctx.fillRect(35, y + 16, 12, 10);
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
      if (this.scene && !this.scene.none) return this.drawWallArt(ratio);
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

    // 光影手绘的城墙（设计书 54.5）：一块块石头，右侧被夕阳照亮，墙头长着苔藓，挂一盏灯
    // ---------- 城墙（设计书 61.6）：七档破损 + 坍塌 ----------
    wallStageOf(ratio) {
      const cuts = [0.85, 0.7, 0.55, 0.4, 0.25, 0.1];
      let st = 0;
      for (const c of cuts) if (ratio <= c) st++;
      return st;
    }

    // 基础墙图（按场景缓存）：石块、垛口、苔藓，不含破损
    wallBase(h) {
      const key = this.scene.key;
      if (this.wallBaseArt && this.wallBaseArt.key === key) return this.wallBaseArt.canvas;
      const P = this.scene.palette;
      const c = document.createElement('canvas');
      c.width = 110;
      c.height = h + 40;
      const g = c.getContext('2d');
      g.translate(0, 30);
      const ox = 20;
      const body = g.createLinearGradient(ox, 0, ox + 64, 0);
      body.addColorStop(0, '#1c232c');
      body.addColorStop(1, '#3e4954');
      g.fillStyle = body;
      g.fillRect(ox, 0, 64, h);
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let y = 0; y < h; y += 22) {
        const off = (y / 22) % 2 ? 0 : 16;
        for (let x = ox - 16 + off; x < ox + 64; x += 32) {
          const bx = Math.max(ox, x) + 1.5;
          const bw = Math.min(ox + 64, x + 32) - bx - 1.5;
          if (bw <= 2) continue;
          const v = 40 + Math.floor(rnd() * 22) + (bx - ox) * 0.35;
          g.fillStyle = `rgb(${v - 6},${v + 2},${v + 12})`;
          TD.sprites.roundRect(g, bx, y + 1.5, bw, 19, 4);
          g.fill();
          g.strokeStyle = TD.art.rgba(P.rim, 0.28 + ((bx - ox) / 64) * 0.3);
          g.lineWidth = 1.5;
          g.beginPath();
          g.moveTo(bx + 3, y + 2.5);
          g.lineTo(bx + bw - 2, y + 2.5);
          g.lineTo(bx + bw - 1, y + 12);
          g.stroke();
        }
      }
      for (let y = -4; y < h; y += 44) {
        const gg = g.createLinearGradient(ox + 50, 0, ox + 72, 0);
        gg.addColorStop(0, '#3a444f');
        gg.addColorStop(1, '#5a6672');
        g.fillStyle = gg;
        TD.sprites.roundRect(g, ox + 50, y, 22, 26, 4);
        g.fill();
        g.strokeStyle = TD.art.rgba(P.rim, 0.55);
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(ox + 54, y + 1);
        g.lineTo(ox + 71, y + 1);
        g.lineTo(ox + 71, y + 20);
        g.stroke();
        g.fillStyle = '#2f5a2c';
        g.beginPath();
        g.ellipse(ox + 58, y + 1, 9, 4, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(170,220,110,0.6)';
        g.beginPath();
        g.ellipse(ox + 60, y - 1, 5, 2, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#244a26';
      for (let y = 30; y < h; y += 70 + rnd() * 50) {
        g.beginPath();
        g.ellipse(ox + 4 + rnd() * 50, y, 10 + rnd() * 8, 5, 0, 0, Math.PI * 2);
        g.fill();
      }
      this.wallBaseArt = { key, canvas: c };
      return c;
    }

    // 某一档的城墙：基础墙图 + 这一档累计的破损（按场景 + 档缓存）
    wallStageArt(stage, h) {
      this.wallStages = this.wallStages || new Map();
      const key = this.scene.key + ':' + stage;
      const hit = this.wallStages.get(key);
      if (hit) return hit;
      const base = this.wallBase(h);
      const c = document.createElement('canvas');
      c.width = base.width;
      c.height = base.height;
      const g = c.getContext('2d');
      g.drawImage(base, 0, 0);
      g.translate(0, 30);
      const ox = 20;
      let seed = 4242;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const holes = [];
      const crenels = [];
      for (let y = -4, k = 0; y < h; y += 44, k++) crenels.push(y);
      // 每档新增多少：裂纹 / 缺砖 / 缺角垛口 / 塌掉的垛口 / 大洞
      const CRACKS = [0, 3, 6, 9, 12, 15, 19][stage];
      const BRICKS = [0, 0, 3, 6, 10, 15, 22][stage];
      const CHIPS = [0, 2, 4, 5, 6, 6, 6][stage];
      const GONE = [0, 0, 0, 1, 3, 5, 7][stage];
      const BREACH = [0, 0, 0, 0, 2, 3, 5][stage];
      // 打乱垛口的损坏顺序（固定）
      const order = crenels.map((_, i) => i).sort((p, q) => ((p * 7919) % 31) - ((q * 7919) % 31));
      // 先挖缺砖，再画裂纹，最后是大洞和垛口
      const brickRects = [];
      for (let i = 0; i < 40; i++) brickRects.push([ox + 2 + Math.floor(rnd() * 3) * 20 + (rnd() < 0.5 ? 0 : 10), 8 + Math.floor(rnd() * (h / 22 - 1)) * 22]);
      for (let i = 0; i < BRICKS; i++) {
        const [bx, by] = brickRects[i];
        g.fillStyle = '#0b0f15';
        TD.sprites.roundRect(g, bx, by + 1.5, 24, 19, 3);
        g.fill();
        g.strokeStyle = 'rgba(120,130,150,0.35)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(bx + 2, by + 20);
        g.lineTo(bx + 22, by + 20);
        g.lineTo(bx + 22, by + 4);
        g.stroke();
      }
      // 墙皮剥落：露出更深的内墙
      if (stage >= 3) {
        for (let i = 0; i < stage * 2; i++) {
          const px = ox + 4 + rnd() * 40;
          const py = 30 + rnd() * (h - 80);
          g.fillStyle = 'rgba(14,18,26,0.9)';
          g.beginPath();
          g.moveTo(px, py);
          g.lineTo(px + 14 + rnd() * 10, py + rnd() * 6);
          g.lineTo(px + 10 + rnd() * 12, py + 16 + rnd() * 12);
          g.lineTo(px - 4, py + 12 + rnd() * 8);
          g.closePath();
          g.fill();
        }
      }
      // 裂纹：带分叉的折线，旁边一道浅色边
      for (let i = 0; i < CRACKS; i++) {
        let x = ox + 6 + rnd() * 52;
        let y = 20 + rnd() * (h - 60);
        const n = 3 + Math.floor(rnd() * 3);
        const pts = [[x, y]];
        for (let k = 0; k < n; k++) {
          x += (rnd() - 0.4) * 16;
          y += 8 + rnd() * 14;
          pts.push([x, y]);
        }
        for (const [col, w, dx] of [['rgba(150,165,190,0.3)', 1.2, 1.2], ['rgba(6,8,14,0.9)', stage >= 4 ? 2.4 : 1.8, 0]]) {
          g.strokeStyle = col;
          g.lineWidth = w;
          g.lineJoin = 'round';
          g.beginPath();
          pts.forEach(([px, py], j) => (j ? g.lineTo(px + dx, py) : g.moveTo(px + dx, py)));
          g.stroke();
        }
        if (rnd() < 0.6) {
          const [bx, by] = pts[1];
          g.strokeStyle = 'rgba(6,8,14,0.85)';
          g.lineWidth = 1.3;
          g.beginPath();
          g.moveTo(bx, by);
          g.lineTo(bx + (rnd() - 0.5) * 22, by + 8 + rnd() * 10);
          g.stroke();
        }
      }
      // 大洞：不规则的缺口，里面透出暗红的光
      for (let i = 0; i < BREACH; i++) {
        const hx = ox + 8 + rnd() * 36;
        const hy = 60 + ((i * 131 + 37) % Math.max(100, h - 160));
        const r = 14 + rnd() * 10 + stage * 1.5;
        const pts = [];
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * Math.PI * 2;
          const rr = r * (0.65 + rnd() * 0.5);
          pts.push([hx + Math.cos(a) * rr * 0.8, hy + Math.sin(a) * rr * 1.1]);
        }
        const path = () => {
          g.beginPath();
          pts.forEach(([px, py], j) => (j ? g.lineTo(px, py) : g.moveTo(px, py)));
          g.closePath();
        };
        path();
        const hg = g.createRadialGradient(hx, hy, 1, hx, hy, r);
        hg.addColorStop(0, '#5a1a14');
        hg.addColorStop(0.5, '#1c0c0e');
        hg.addColorStop(1, '#07080c');
        g.fillStyle = hg;
        g.fill();
        g.strokeStyle = 'rgba(150,160,185,0.45)';
        g.lineWidth = 2;
        g.stroke();
        // 洞口掉出来的碎砖
        for (let k = 0; k < 3; k++) {
          g.fillStyle = `rgb(${50 + Math.floor(rnd() * 20)},${58 + Math.floor(rnd() * 20)},${70 + Math.floor(rnd() * 20)})`;
          const sx = hx - r * 0.6 + rnd() * r * 1.2;
          const sy = hy + r * 0.7 + rnd() * 10;
          g.beginPath();
          g.moveTo(sx, sy);
          g.lineTo(sx + 7, sy + 1);
          g.lineTo(sx + 5, sy + 7);
          g.lineTo(sx - 2, sy + 5);
          g.fill();
        }
        holes.push([hx, hy, r]);
      }
      // 垛口：先缺角，再整个塌掉
      g.save();
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < CHIPS; i++) {
        const y = crenels[order[i % crenels.length]];
        g.beginPath();
        g.moveTo(ox + 72, y + 2);
        g.lineTo(ox + 72 - 9 - rnd() * 5, y + 2);
        g.lineTo(ox + 72, y + 12 + rnd() * 6);
        g.closePath();
        g.fill();
      }
      for (let i = 0; i < GONE; i++) {
        const y = crenels[order[i % crenels.length]];
        g.fillRect(ox + 56, y - 6, 20, 24);
      }
      g.restore();
      for (let i = 0; i < GONE; i++) {
        // 塌掉的垛口只剩一截断茬
        const y = crenels[order[i % crenels.length]];
        g.fillStyle = '#323c47';
        g.beginPath();
        g.moveTo(ox + 52, y + 26);
        g.lineTo(ox + 54, y + 16);
        g.lineTo(ox + 61, y + 19);
        g.lineTo(ox + 66, y + 14);
        g.lineTo(ox + 72, y + 22);
        g.lineTo(ox + 72, y + 26);
        g.closePath();
        g.fill();
      }
      // 烟熏：大洞上方的黑色烟痕
      for (const [hx, hy, r] of holes) {
        const sg = g.createLinearGradient(0, hy - r * 2.4, 0, hy - r * 0.5);
        sg.addColorStop(0, 'rgba(0,0,0,0)');
        sg.addColorStop(1, 'rgba(0,0,0,0.45)');
        g.fillStyle = sg;
        g.fillRect(hx - r * 0.7, hy - r * 2.4, r * 1.4, r * 1.9);
      }
      // 墙脚的碎石堆：越破越多
      const pile = [0, 0, 2, 5, 8, 12, 16][stage];
      for (let i = 0; i < pile; i++) {
        const px = ox - 10 + rnd() * 90;
        const pr = 3 + rnd() * 5;
        g.fillStyle = `rgb(${46 + Math.floor(rnd() * 26)},${54 + Math.floor(rnd() * 26)},${64 + Math.floor(rnd() * 26)})`;
        g.beginPath();
        g.ellipse(px, h + 4 - rnd() * 6, pr * 1.3, pr * 0.8, rnd(), 0, Math.PI * 2);
        g.fill();
      }
      const art = { canvas: c, holes };
      if (this.wallStages.size > 16) this.wallStages.clear();
      this.wallStages.set(key, art);
      return art;
    }

    drawWallArt(ratio) {
      const ctx = this.ctx;
      const x0 = C.wallX - 64;
      const top = C.fieldTop - 28;
      const bottom = C.fieldBottom + 10;
      const h = bottom - top;
      const stage = this.wallStageOf(ratio);
      // 升档：一块墙皮砸下来（设计书 61.6）
      if (this.wallStage !== undefined && stage > this.wallStage && !this.collapse) this.wallBreak(stage, h, top);
      this.wallStage = stage;
      if (this.collapse) return this.drawWallCollapse(stage, h, top, x0);
      const art = this.wallStageArt(stage, h);
      ctx.save();
      // 摇摇欲坠：最后两档墙体微微歪斜、颤抖
      if (stage >= 5) {
        const tilt = (stage === 5 ? 0.012 : 0.024) + Math.sin(this.t * 17) * 0.0016;
        ctx.translate(x0 + 30, bottom);
        ctx.rotate(tilt);
        ctx.translate(-(x0 + 30), -bottom);
      }
      ctx.drawImage(art.canvas, x0 - 20, top - 30);
      ctx.restore();
      // 大洞里的暗红光会闪，往外冒烟和火星
      const dt = this.lastDt || 0.016;
      art.holes.forEach(([hx, hy, r], i) => {
        const fl = 0.55 + Math.sin(this.t * 7 + i * 2.1) * 0.25 + Math.sin(this.t * 19 + i) * 0.1;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        TD.art.drawGlow(ctx, x0 - 20 + hx, top - 30 + 30 + hy, r * 1.6, '#ff5a2a', 0.38 * fl);
        ctx.restore();
        if (stage >= 5 && this.vfx && Math.random() < dt * 5) {
          const wx = x0 - 20 + hx + 20;
          const wy = top + hy;
          this.vfx.spawn(1, () => ({ kind: 'smoke', x: wx, y: wy, vx: -8 + Math.random() * 6, vy: -28 - Math.random() * 18, life: 1.4, r: 10 + Math.random() * 8, color: '#5a5a62' }));
          if (stage >= 6) this.vfx.spawn(1, () => ({ kind: 'ember', x: wx, y: wy, vx: Math.random() * 50, vy: -50 - Math.random() * 60, g: 120, life: 0.8, r: 1.6, color: '#ff9a4a' }));
        }
      });
      // 破损的墙一直在掉灰和小石子
      if (stage >= 2 && this.vfx && Math.random() < dt * (stage - 1) * 1.6) {
        const wx = x0 + 6 + Math.random() * 56;
        const wy = top + 20 + Math.random() * (h - 60);
        this.vfx.spawn(1, () => ({ kind: 'smoke', x: wx, y: wy, vx: (Math.random() - 0.5) * 6, vy: 18 + Math.random() * 20, life: 0.9, r: 3 + Math.random() * 3, color: '#8a8a92' }));
      }
      this.drawWallFace(ratio, x0, top, bottom);
    }

    // 升档的那一下：几块墙皮砸下来，扬起灰尘
    wallBreak(stage, h, top) {
      const x0 = C.wallX - 64;
      this.shake = Math.max(this.shake, 6 + stage);
      for (let i = 0; i < 6 + stage * 2; i++) {
        this.fx.push({ kind: 'rock', x: x0 + 40 + Math.random() * 30, y: top + 40 + Math.random() * (h - 100), vx: 20 + Math.random() * 90, vy: -80 - Math.random() * 100, life: 0.8, age: 0 });
      }
      if (this.vfx) {
        const y = top + 80 + Math.random() * (h - 200);
        this.vfx.spawn(8, () => ({ kind: 'smoke', x: x0 + 40 + Math.random() * 50, y: y + Math.random() * 40, vx: 10 + Math.random() * 30, vy: -20 - Math.random() * 30, life: 1.1, r: 12 + Math.random() * 12, color: '#8a8a92' }));
        this.vfx.fx.push({ kind: 'flare', x: x0 + 50, y, r: 90, color: '#ffb890', life: 0.3, age: 0 });
      }
      if (TD.audio) TD.audio.play('wallBreak');
    }

    // 城墙的脸（设计书 1.4）：暗处发光的一双小眼睛，越破越难过
    drawWallFace(ratio, x0, top, bottom) {
      const ctx = this.ctx;
      const ex = x0 + 30;
      const ey = (top + bottom) / 2 + 40;
      const eyeC = ratio > 0.4 ? '#ffe7a8' : '#ff9a7a';
      TD.art.drawGlow(ctx, ex, ey + 2, 26, eyeC, 0.35);
      S.ellipse(ctx, ex - 9, ey, 3, ratio > 0.7 ? 4 : 3, eyeC);
      S.ellipse(ctx, ex + 9, ey, 3, ratio > 0.7 ? 4 : 3, eyeC);
      ctx.strokeStyle = eyeC;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ratio > 0.7) ctx.arc(ex, ey + 8, 6, 0.2, Math.PI - 0.2);
      else if (ratio > 0.4) {
        ctx.moveTo(ex - 6, ey + 11);
        ctx.lineTo(ex + 6, ey + 11);
      } else ctx.arc(ex, ey + 15, 6, Math.PI + 0.3, -0.3);
      ctx.stroke();
    }

    // 坍塌（设计书 61.6）：从中间向两头，一段一段塌下去，扬起尘土，墙脚留下一堆碎石
    drawWallCollapse(stage, h, top, x0) {
      const ctx = this.ctx;
      const c = this.collapse;
      const t = this.t - c.t0;
      const art = this.wallStageArt(Math.max(stage, 5), h);
      const N = 12;
      const bandH = (h + 40) / N;
      const dt = this.lastDt || 0.016;
      // 几次大的震动
      for (const [at, amt] of [[0.45, 14], [0.9, 18], [1.4, 10]]) {
        if (t >= at && !c['s' + at]) {
          c['s' + at] = true;
          if (at === 0.45 && TD.audio) TD.audio.play('wallCollapse');
          this.shake = Math.max(this.shake, amt);
          if (this.vfx) this.vfx.fx.push({ kind: 'flare', x: x0 + 40, y: top + h * (at < 1 ? 0.5 : 0.8), r: 160, color: '#ffc8a0', life: 0.35, age: 0 });
        }
      }
      ctx.save();
      for (let i = 0; i < N; i++) {
        const d = Math.abs(i - (N - 1) / 2) / ((N - 1) / 2);
        const delay = d * 0.55 + ((i * 37) % 7) * 0.012;
        const tau = Math.max(0, t - delay);
        if (tau > 1.8) continue;
        const dir = i % 2 ? 1 : -1;
        const drop = 0.5 * 900 * tau * tau;
        const alpha = tau < 0.9 ? 1 : Math.max(0, 1 - (tau - 0.9) / 0.9);
        const sy = i * bandH;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x0 - 20 + 55, top - 30 + sy + bandH / 2 + drop);
        ctx.rotate(dir * Math.min(0.6, tau * 0.45) * (0.4 + d));
        ctx.translate(dir * tau * 22, 0);
        ctx.drawImage(art.canvas, 0, sy, art.canvas.width, bandH, -55, -bandH / 2, art.canvas.width, bandH);
        ctx.restore();
        // 每一段刚松动的时候喷一团灰
        if (this.vfx && tau > 0 && tau < 0.12 && Math.random() < 0.7) {
          const wx = x0 + 20 + Math.random() * 60;
          const wy = top + sy + bandH / 2;
          this.vfx.spawn(2, () => ({ kind: 'smoke', x: wx, y: wy, vx: 30 + Math.random() * 90, vy: -30 - Math.random() * 40, life: 1.5, r: 16 + Math.random() * 16, color: '#9a9aa2' }));
          this.fx.push({ kind: 'rock', x: wx, y: wy, vx: 30 + Math.random() * 160, vy: -80 - Math.random() * 140, life: 1.0, age: 0 });
        }
      }
      ctx.restore();
      // 墙脚的碎石堆：随着坍塌越堆越高
      const k = Math.min(1, t / 1.6);
      let seed = 99;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 46; i++) {
        const px = x0 - 14 + rnd() * 120;
        const lift = rnd() * 38 * Math.sin((Math.min(1, (px - x0 + 14) / 120)) * Math.PI);
        const pr = 4 + rnd() * 9;
        if (i / 46 > k) continue;
        ctx.fillStyle = `rgb(${40 + Math.floor(rnd() * 30)},${48 + Math.floor(rnd() * 30)},${58 + Math.floor(rnd() * 30)})`;
        ctx.beginPath();
        ctx.ellipse(px, C.fieldBottom + 12 - lift * k, pr * 1.3, pr * 0.85, rnd() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      // 持续的烟尘
      if (this.vfx && t < 2.4 && Math.random() < dt * 22) {
        const wx = x0 + Math.random() * 110;
        const wy = C.fieldBottom - Math.random() * 90;
        this.vfx.spawn(1, () => ({ kind: 'smoke', x: wx, y: wy, vx: 10 + Math.random() * 40, vy: -20 - Math.random() * 30, life: 1.8, r: 20 + Math.random() * 20, color: '#8a8a92' }));
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

    // 冰冻领域 / 冰冻瓶（设计书 60.4）：冷光车道 + 一排长出来的冰晶 + 流动的冷雾 + 飘雪
    drawIceLane(e, y0, h, fade, b) {
      const ctx = this.ctx;
      const freeze = e.type === 'freeze';
      const age = b.time - (e.start || 0);
      const x0 = C.wallX;
      const x1 = C.width;
      ctx.save();
      // 冷光
      const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
      g.addColorStop(0, `rgba(170,225,255,${0.1 * fade})`);
      g.addColorStop(1, `rgba(200,240,255,${(freeze ? 0.4 : 0.26) * fade})`);
      ctx.fillStyle = g;
      ctx.fillRect(x0, y0, x1 - x0, h);
      // 冰面上的裂纹高光
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(220,245,255,${0.35 * fade})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const cx = x0 + 60 + k * 105;
        const cy = y0 + h * (0.72 + ((k * 37) % 20) / 100);
        ctx.moveTo(cx - 30, cy);
        ctx.lineTo(cx, cy - 4);
        ctx.lineTo(cx + 26, cy + 3);
        ctx.moveTo(cx, cy - 4);
        ctx.lineTo(cx + 8, cy - 14);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      // 冰晶：从城墙往外一根根长出来（每根晚一点）
      const n = 14;
      for (let k = 0; k < n; k++) {
        const cx = x0 + 40 + k * ((x1 - x0 - 60) / n) + ((k * 53) % 23);
        const grow = Math.max(0, Math.min(1, (age - k * 0.025) / 0.3)) * fade;
        if (grow <= 0) continue;
        const ch = (freeze ? 34 : 22) * (0.7 + ((k * 29) % 10) / 22) * grow;
        const cw = ch * 0.3;
        const by = y0 + h - 6;
        for (const [dx, sc, lean] of [[0, 1, -0.08], [-cw * 0.9, 0.6, -0.4], [cw * 0.9, 0.55, 0.35]]) {
          ctx.save();
          ctx.translate(cx + dx, by);
          ctx.rotate(lean);
          const hh = ch * sc;
          const ww = cw * sc;
          ctx.fillStyle = `rgba(150,205,240,${0.75 * fade})`;
          ctx.beginPath();
          ctx.moveTo(-ww / 2, 0);
          ctx.lineTo(-ww / 2, -hh * 0.72);
          ctx.lineTo(0, -hh);
          ctx.lineTo(0, 0);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = `rgba(235,250,255,${0.85 * fade})`;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, -hh);
          ctx.lineTo(ww / 2, -hh * 0.72);
          ctx.lineTo(ww / 2, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        TD.art.drawGlow(ctx, cx, by - ch * 0.8, ch * 0.9, '#bfe8ff', 0.35 * fade, true);
      }
      // 冷雾
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 4; k++) {
        const mx = x0 + ((k * 290 + this.t * (18 + k * 6)) % (x1 - x0 + 200)) - 100;
        TD.art.drawGlow(ctx, mx, y0 + h * 0.6, h * 0.8, '#cfeaff', 0.16 * fade, true);
      }
      // 飘雪
      ctx.fillStyle = `rgba(255,255,255,${0.8 * fade})`;
      for (let k = 0; k < 18; k++) {
        const fx = x0 + ((k * 89 + this.t * (20 + (k % 5) * 6)) % (x1 - x0));
        const fy = y0 + ((k * 41 + this.t * (30 + (k % 3) * 10)) % h);
        ctx.beginPath();
        ctx.arc(fx, fy, 1 + (k % 3) * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
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
        if (e.type === 'frost' || e.type === 'freeze') {
          ctx.restore();
          this.drawIceLane(e, y0, h, fade, b);
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
      if (x > C.width + def.size * 3) return; // 还没走进画面
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
      // 暗夜（设计书 57.2）：火把照不到的怪照常画（被箭光、爆炸照亮时看得见），黑幕盖住后只露出眼睛
      const dark = b.level.dark && x > this.torchEdge(b) - 30;
      if (m.hidden) ctx.globalAlpha = 0.18;
      if (m.stealthed) ctx.globalAlpha = 0.22 + Math.sin(this.t * 6 + m.id) * 0.06;
      if (m.shade) {
        // 剪影：墨影（深紫色）
        const sil = S.silhouette(m.type, def.size, '#231a33');
        if (sil) {
          const sc = scale * DRAW_SCALE;
          const bob = Math.sin(this.t * 6 + m.id) * 1.5;
          ctx.drawImage(sil.canvas, x - sil.ox * sc, y - sil.oy * sc + bob, sil.canvas.width * sc, sil.canvas.height * sc);
          ctx.globalAlpha = 1;
        }
      } else {
        // 飞鱼跳跃：画一条弧线（设计书 52.6）
        let leap = 0;
        let ly = y;
        if (m.leapUntil > b.time) {
          leap = 1 - (m.leapUntil - b.time) / def.leap.time;
          ly = y - Math.sin(leap * Math.PI) * 46;
        }
        if (def.guard) {
          // 盾龟的护卫圈
          ctx.save();
          ctx.globalAlpha = 0.18 + Math.sin(this.t * 3 + m.id) * 0.05;
          S.ellipse(ctx, x, y - 6, def.guard.radius, def.guard.radius * 0.45, null, '#5aa86a', 3);
          ctx.restore();
        }
        const mo = { flash: m.hitFlash, attack: m.state === 'attack' || m.state === 'hold', seed: m.id, ai: m.ai, shield: m.shield, regen, wool: m.woolMax ? m.wool / m.woolMax : null, shellIn: m.shellUntil > b.time, leap, scale: scale * DRAW_SCALE };
        if (this.scene && !this.scene.none && TD.art.opts.lit && ctx.globalAlpha === 1) {
          // 光影缓存（设计书 54.5）：动画约 12 帧/秒。
          // 普通小怪按"类型 + 4 个动画相位 + 状态"共用缓存，几十只同种怪只需要重画几次；
          // 受击闪白的怪、Boss 用自己的缓存
          const flags = (mo.shellIn ? 's' : '') + (mo.wool !== null ? 'w' + Math.round(mo.wool * 8) : '') + (scale !== 1 ? 'k' + Math.round(scale * 10) : '') + (frozen ? 'z' : '') + (mo.attack ? 'a' : '');
          let holder = m;
          let tt = t;
          const flash = m.hitFlash;
          mo.flash = 0; // 受击闪白不进缓存，画完后再叠一层（省掉单独重画）
          if ((!def.boss || def.towerOf) && !m.ai) {
            const group = m.id % (this.litGroups || 4);
            tt = frozen ? 0 : this.t + group * 0.37;
            mo.seed = group + 1;
            const hk = m.type + '|' + group + '|' + flags;
            this.litShared = this.litShared || new Map();
            holder = this.litShared.get(hk);
            if (!holder) {
              if (this.litShared.size > 400) this.litShared.clear();
              this.litShared.set(hk, (holder = {}));
            }
          }
          const frame = frozen ? -1 : Math.floor(tt * TD.art.LIT_FPS);
          const key = frame + flags;
          const c = TD.art.litSprite(holder, key, def.size * DRAW_SCALE, this.scene.palette.rim, TD.art.opts.glow ? 0.32 : 0, (g) => ((S.volume = true), S.monster(g, m.type, 0, 0, def.size, tt, mo), (S.volume = false)));
          if (this.crowd && (!def.boss || def.towerOf)) {
            // 妖塔里同屏几百只：只贴精灵画布中间有内容的那一块（约一半面积），再按人数缩小一点（设计书 74.5）
            const sz = def.size * DRAW_SCALE;
            const cx = Math.max(0, Math.round(c.ox - sz * 1.5));
            const cy = Math.max(0, Math.round(c.oy - sz * 2.6));
            const cw = Math.min(c.canvas.width - cx, Math.round(sz * 3));
            const ch = Math.min(c.canvas.height - cy, Math.round(sz * 3));
            const k = this.crowd;
            ctx.drawImage(c.canvas, cx, cy, cw, ch, Math.round(x - (c.ox - cx) * k), Math.round(ly - (c.oy - cy) * k), Math.round(cw * k), Math.round(ch * k));
          } else ctx.drawImage(c.canvas, Math.round(x - c.ox), Math.round(ly - c.oy));
          if (flash > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = Math.min(1, flash * 7) * 0.55;
            ctx.drawImage(c.canvas, Math.round(x - c.ox), Math.round(ly - c.oy));
            ctx.restore();
          }
        } else S.monster(ctx, m.type, x, ly, def.size, t, mo);
        if (m.bubble) {
          // 海马的泡泡
          const r = def.size * DRAW_SCALE * 1.15;
          ctx.save();
          ctx.globalAlpha = 0.35;
          S.ellipse(ctx, x, ly - r * 0.9, r, r, '#bfe8ff');
          ctx.globalAlpha = 0.9;
          S.ellipse(ctx, x, ly - r * 0.9, r, r, null, '#7ad0ff', 2);
          S.ellipse(ctx, x - r * 0.4, ly - r * 1.3, r * 0.18, r * 0.12, '#fff');
          ctx.restore();
        }
        if (def.ai === 'octoKing' && m.ai.guarded) {
          // 触手护身：粉色的护罩
          ctx.save();
          ctx.globalAlpha = 0.25 + Math.sin(this.t * 4) * 0.08;
          S.ellipse(ctx, x, y - def.size * 1.3, def.size * 1.5, def.size * 1.6, null, '#ff8ac0', 5);
          ctx.restore();
        }
      }
      if (m.shade && !dark) {
        // 墨影：紫色的眼睛
        S.ellipse(ctx, x - def.size * 0.35, y - def.size * 1.05, 2.5, 2.5, '#c58cff');
        S.ellipse(ctx, x, y - def.size * 1.05, 2.5, 2.5, '#c58cff');
      }
      if (dark) {
        // 黑暗中只看得见一双发光的眼睛（在黑幕之后画）
        if (!m.hidden && !m.stealthed && this.showDarkEyes()) this.darkEyes.push({ x, y, size: def.size, id: m.id, flying: def.flying });
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
      if ((!def.boss || def.towerOf) && m.hp < m.maxHp && (def.boss || this.crowdBars !== false)) {
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
      // 光尾（设计书 54.5）：每支弹道身后一条加色的光
      if (this.scene && !this.scene.none) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const p of b.projectiles) {
          if (p.done || p.kind === 'boomerang' || p.kind === 'firefly') continue;
          const col = p.tint || (p.kind === 'zap' ? '#9fd0ff' : p.kind === 'orb' ? '#d9b8ff' : p.kind === 'shell' ? '#ffb070' : p.crit ? '#ffe680' : '#fff0c0');
          const tx = p.x - Math.cos(p.angle) * 46;
          const ty = p.y - Math.sin(p.angle) * 46;
          const lg = ctx.createLinearGradient(tx, ty, p.x, p.y);
          lg.addColorStop(0, TD.art.rgba(col, 0));
          lg.addColorStop(1, TD.art.rgba(col, 0.7));
          ctx.strokeStyle = lg;
          ctx.lineWidth = p.crit ? 5 : 3;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          TD.art.drawGlow(ctx, p.x, p.y, p.crit ? 16 : 11, col, 0.7);
        }
        ctx.restore();
      }
      for (const p of b.projectiles) {
        if (p.done) continue;
        if (p.kind === 'boomerang') {
          ctx.save();
          ctx.translate(p.x, p.y - 10);
          (TD.creatures ? TD.creatures.boomerang : S.boomerang)(ctx, 16, p.spin, p.tint);
          ctx.restore();
          continue;
        }
        if (p.kind === 'zap') {
          ctx.save();
          ctx.strokeStyle = p.tint ? S.lighten(p.tint, 0.55) : '#bfe3ff';
          ctx.lineWidth = 3;
          ctx.shadowColor = p.tint || '#5aa8ff';
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
        if (p.kind === 'firefly') {
          // Nova的萤火虫（设计书 59.2）：弯弯绕绕地飞，一闪一闪
          const wob = Math.sin(p.travel * 0.05 + p.wobble) * 14;
          const fx = p.x - Math.sin(p.angle) * wob;
          const fy = p.y + Math.cos(p.angle) * wob;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          TD.art.drawGlow(ctx, fx, fy, 16, '#c8ffb0', 0.75);
          ctx.restore();
          S.ellipse(ctx, fx, fy, 2.6, 2.6, '#f4ffe0');
          continue;
        }
        if (p.kind === 'orb') {
          ctx.save();
          ctx.globalAlpha = 0.35;
          S.ellipse(ctx, p.x - Math.cos(p.angle) * 10, p.y - Math.sin(p.angle) * 10, 9, 9, p.tint || '#c58cff');
          ctx.globalAlpha = 1;
          S.ellipse(ctx, p.x, p.y, 7, 7, p.tint ? S.lighten(p.tint, 0.45) : '#d9b8ff', p.tint ? S.darken(p.tint, 0.4) : '#7a3fc0', 2);
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
          if (p.tint) {
            // 炮弹外面裹一圈品质色的光
            ctx.globalAlpha = 0.55;
            S.ellipse(ctx, p.x, p.y - lift, 12, 12, null, p.tint, 3);
            ctx.globalAlpha = 1;
          }
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
          ctx.fillStyle = p.tint ? S.lighten(p.tint, 0.35) : '#cfd6de';
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
          ctx.fillStyle = p.tint ? S.lighten(p.tint, 0.35) : '#cfd6de';
          ctx.beginPath();
          ctx.moveTo(8, -4);
          ctx.lineTo(15, 0);
          ctx.lineTo(8, 4);
          ctx.fill();
          ctx.fillStyle = p.tint || '#e04848';
          ctx.fillRect(-20, -3, 6, 6);
        }
        ctx.restore();
      }
    }

    // 助战伙伴站在城墙后面、英雄下方（设计书 51）
    buddyPos(b) {
      return { x: C.wallX - 72, y: b.heroY + 120 };
    }

    drawBuddy(b) {
      const { x, y } = this.buddyPos(b);
      const def = TD.data.monsters[b.buddy.boss];
      S.monster(this.ctx, b.buddy.boss, x, y, def.size * 0.42, this.t, { seed: 7 });
    }

    // 守护符文的金色泡泡（设计书 62.4）：越被打越淡，快破的时候闪
    drawBarrier(b) {
      const ctx = this.ctx;
      const D_BARRIER = TD.data.items.barrier.shieldRatio;
      const ratio = Math.min(1, b.itemShield / (b.wall.max * D_BARRIER));
      const cy = (C.fieldTop + C.fieldBottom) / 2;
      const ry = (C.fieldBottom - C.fieldTop) / 2 + 14;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const blink = ratio < 0.25 ? 0.5 + Math.sin(this.t * 18) * 0.5 : 1;
      const g = ctx.createRadialGradient(C.wallX - 28, cy, ry * 0.2, C.wallX - 28, cy, ry);
      g.addColorStop(0, `rgba(255,226,150,0)`);
      g.addColorStop(0.8, `rgba(255,214,120,${0.1 * ratio * blink})`);
      g.addColorStop(1, `rgba(255,238,190,${0.45 * ratio * blink})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(C.wallX - 28, cy, 70, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,240,200,${(0.5 + Math.sin(this.t * 3) * 0.1) * ratio * blink})`;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // 泡泡表面的六边形光纹
      ctx.strokeStyle = `rgba(255,226,150,${0.2 * ratio * blink})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const yy = C.fieldTop + 20 + i * ((C.fieldBottom - C.fieldTop - 40) / 5);
        ctx.beginPath();
        ctx.ellipse(C.wallX - 28, yy, 62 * Math.sqrt(Math.max(0, 1 - Math.pow((yy - cy) / ry, 2))), 10, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 英雄脚下的光环：战鼓（金色）、加速药水（青绿色的上升光线）（设计书 60.4）
    drawHeroAura(b, dt) {
      const drum = b.buffs.some((x) => x.src === 'drum' && b.time < x.until);
      const haste = b.buffs.some((x) => x.src === 'haste' && b.time < x.until);
      const banner = b.buffs.some((x) => x.src === 'banner' && b.time < x.until);
      const chrono = b.buffs.some((x) => x.src === 'chrono' && b.time < x.until);
      if (banner) this.drawBannerAura(b);
      if (chrono) this.drawChronoAura(b, dt);
      if (!drum && !haste) return;
      const ctx = this.ctx;
      const x = C.heroX + 4;
      const y = b.heroY + 2;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (drum) {
        const col = '#ffcf6a';
        TD.art.drawGlow(ctx, x, y - 40, 90, col, 0.28 + Math.sin(this.t * 6) * 0.08, true);
        ctx.translate(x, y);
        ctx.scale(1, 0.32);
        ctx.strokeStyle = TD.art.rgba(col, 0.75);
        ctx.lineWidth = 3;
        ctx.setLineDash([14, 10]);
        ctx.lineDashOffset = -this.t * 60;
        ctx.beginPath();
        ctx.arc(0, 0, 54, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 42 + Math.sin(this.t * 8) * 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (this.vfx && Math.random() < dt * 14) this.vfx.spawn(1, () => ({ kind: 'mote', x: x + (Math.random() - 0.5) * 80, y: y - Math.random() * 20, vx: 0, vy: -60 - Math.random() * 50, life: 0.9, r: 2, color: '#ffe6a0' }));
      }
      if (haste) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.strokeStyle = 'rgba(140,255,216,0.5)';
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
          const ph = (this.t * 1.6 + i / 6) % 1;
          const lx = x - 30 + i * 12;
          const ly = y - ph * 110;
          ctx.globalAlpha = Math.sin(ph * Math.PI);
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx, ly - 22);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 战旗：英雄身后立着一面发光的红金旗（设计书 62.4）
    drawBannerAura(b) {
      const ctx = this.ctx;
      const x = C.heroX - 46;
      const y = b.heroY + 6;
      ctx.save();
      ctx.strokeStyle = '#3a2418';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - 128);
      ctx.stroke();
      const wave = Math.sin(this.t * 5) * 7;
      const grad = ctx.createLinearGradient(x, 0, x + 70, 0);
      grad.addColorStop(0, '#a82434');
      grad.addColorStop(1, '#e8553a');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x, y - 126);
      ctx.bezierCurveTo(x + 24, y - 126 + wave, x + 46, y - 112 - wave, x + 72, y - 118 + wave * 0.6);
      ctx.lineTo(x + 58, y - 98 + wave * 0.3);
      ctx.lineTo(x + 72, y - 80 + wave * 0.5);
      ctx.bezierCurveTo(x + 46, y - 90 - wave, x + 24, y - 72 + wave, x, y - 80);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,226,150,0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      TD.art.drawGlow(ctx, x + 36, y - 100, 70, '#ff8a3a', 0.4 + Math.sin(this.t * 6) * 0.1, true);
      TD.art.drawGlow(ctx, x, y - 130, 18, '#ffe6a0', 0.8, true);
      ctx.restore();
    }

    // 时间静止期间：英雄脚下一圈慢慢转的时钟刻度，空中悬浮的光尘
    drawChronoAura(b, dt) {
      const ctx = this.ctx;
      const x = C.heroX + 4;
      const y = b.heroY + 2;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(x, y);
      ctx.scale(1, 0.3);
      ctx.strokeStyle = 'rgba(200,184,255,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 58, 0, Math.PI * 2);
      ctx.stroke();
      ctx.rotate(this.t * 0.6);
      ctx.lineWidth = 2;
      for (let i = 0; i < 24; i++) {
        const q = (i / 24) * Math.PI * 2;
        const l = i % 6 === 0 ? 14 : 7;
        ctx.beginPath();
        ctx.moveTo(Math.cos(q) * 58, Math.sin(q) * 58);
        ctx.lineTo(Math.cos(q) * (58 - l), Math.sin(q) * (58 - l));
        ctx.stroke();
      }
      ctx.restore();
      if (this.vfx && Math.random() < dt * 20) {
        this.vfx.spawn(1, () => ({ kind: 'mote', x: 100 + Math.random() * (C.width - 140), y: C.fieldTop + Math.random() * (C.fieldBottom - C.fieldTop), vx: 0, vy: -4, life: 1.6, r: 1.6 + Math.random() * 1.6, color: '#d8ccff' }));
      }
    }

    drawHero(b) {
      const heroY = b ? b.heroY - 6 : (C.fieldTop + C.fieldBottom) / 2 - 6;
      let mood = this.mood;
      let aim = -0.15;
      let shotAge;
      let readyIn;
      let castId;
      let castAge;
      let castAim;
      let weapon = this.idleWeapon || 'bow';
      if (b) {
        weapon = b.stats.weapon;
        const ratio = b.wall.hp / b.wall.max;
        if (!b.over) mood = ratio < 0.3 ? 'worried' : 'focus';
        aim = Math.atan2(b.hero.aimY - (heroY - 18), b.hero.aimX - (C.heroX + 10));
        aim = TD.util.clamp(aim, -1.2, 1.2);
        shotAge = b.time - b.hero.shotAt;
        // 离下一次出手还有多久（用来做蓄力动作；被眩晕时不蓄力）
        if (b.time >= b.heroStunUntil) readyIn = b.hero.cooldown;
        // 技能施法动作（设计书 92）；冰冻领域朝选定的车道横扫
        if (b.hero.castId) {
          castId = b.hero.castId;
          castAge = b.time - b.hero.castAt;
          if (b.hero.castLane !== undefined) castAim = TD.util.clamp(Math.atan2(b.laneY(b.hero.castLane) - (heroY - 18), 380), -1.2, 1.2);
        }
      }
      // 英雄身边的暖光（城墙上挂着的灯，设计书 54.5）
      if (this.scene && !this.scene.none) TD.art.drawGlow(this.ctx, C.heroX + 6, heroY - 30, 110, '#ffc977', 0.42);
      // 英雄脚下的城墙平台
      const ascended = !!(b && b.stats.weaponDef && b.stats.weaponDef.ascended);
      const ho = { t: this.t, weapon, aimAngle: aim, shotAge, readyIn, castId, castAge, castAim, mood, critAge: this.critAge, ascended, outfit: TD.game && TD.game.save && TD.game.save.outfit, hero: b ? b.stats.heroId : TD.game && TD.game.save && TD.progression.heroId(TD.game.save) };
      const fx = TD.heroAnim && castId && castAge !== undefined && castAge < TD.heroAnim.CAST_DUR[castId];
      if (fx) TD.heroAnim.fx(this.ctx, C.heroX, heroY, castId, castAge, this.t, 'back');
      if (this.scene && !this.scene.none && TD.art.opts.lit) {
        // 英雄也加明暗和轮廓光（每帧重画，只有一个）
        this.heroArt = this.heroArt || {};
        const c = TD.art.litSprite(this.heroArt, Math.random(), 40, this.scene.palette.rim, 0, (g) => ((S.volume = true), S.hero(g, 0, 0, ho), (S.volume = false)));
        this.ctx.drawImage(c.canvas, Math.round(C.heroX - c.ox), Math.round(heroY - c.oy));
      } else S.hero(this.ctx, C.heroX, heroY, ho);
      if (fx) TD.heroAnim.fx(this.ctx, C.heroX, heroY, castId, castAge, this.t, 'front');
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
      const bosses = b.monsters.filter((m) => m.def.boss && !m.def.towerOf && !m.dead).slice(0, 2);
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
      // 深色玻璃底 + 发光的血条（设计书 54.5）
      const frame = ctx.createLinearGradient(0, y - 6, 0, y + 20);
      frame.addColorStop(0, 'rgba(30,40,56,0.8)');
      frame.addColorStop(1, 'rgba(10,14,24,0.85)');
      ctx.fillStyle = frame;
      S.roundRect(ctx, x - 6, y - 6, w + 12, 26, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,214,150,0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(70,14,22,0.9)';
      ctx.fillRect(x, y, w, 14);
      const hpG = ctx.createLinearGradient(0, y, 0, y + 14);
      hpG.addColorStop(0, '#ff9a8a');
      hpG.addColorStop(0.5, '#ff4a4a');
      hpG.addColorStop(1, '#b0202a');
      ctx.fillStyle = hpG;
      ctx.shadowColor = 'rgba(255,90,80,0.8)';
      ctx.shadowBlur = 10;
      ctx.fillRect(x, y, (w * boss.hp) / boss.maxHp, 14);
      ctx.shadowBlur = 0;
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
      if (boss.def.ai === 'thunderKing') {
        ctx.fillStyle = '#fff';
        for (const r of [TD.data.thunderKing.phase2Below, TD.data.thunderKing.phase3Below]) ctx.fillRect(x + w * r - 1, y - 2, 2, 18);
      }
      if (boss.def.ai === 'pharaoh') {
        ctx.fillStyle = '#fff';
        for (const r of [TD.data.pharaoh.phase2Below, TD.data.pharaoh.phase3Below]) ctx.fillRect(x + w * r - 1, y - 2, 2, 18);
      }
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${boss.def.name}  ${Math.ceil(boss.hp)} / ${boss.maxHp}${boss.shield > 0 ? '  🛡 ' + Math.ceil(boss.shield) : ''}`, cx, y + 12);
      if (boss.def.ai === 'octoKing') {
        ctx.fillStyle = '#fff';
        for (const r of [TD.data.octoKing.phase2Below, TD.data.octoKing.phase3Below]) ctx.fillRect(x + w * r - 1, y - 2, 2, 18);
      }
      // 贝贝的开合倒计时、波波的触手护身（设计书 52.3）
      const ai = boss.ai || {};
      let sub = null;
      if (boss.def.ai === 'pearlClam' && ai.mode === 'hold') sub = { text: ai.open ? `张壳中！快打 ${ai.cycleTimer.toFixed(1)} 秒` : `合壳中… ${ai.cycleTimer.toFixed(1)} 秒后张开`, color: ai.open ? '#ff8ab4' : '#c9b8d6', pr: ai.cycleMax ? ai.cycleTimer / ai.cycleMax : 0 };
      if (boss.def.ai === 'octoKing' && ai.slots) sub = { text: ai.guarded ? `触手护身：还剩 ${ai.alive} 条，先打触手！` : `触手只剩 ${ai.alive} 条，快打波波！`, color: ai.guarded ? '#c9b8d6' : '#ff8ab4', pr: ai.slots.length ? ai.alive / ai.slots.length : 0 };
      if (sub) {
        ctx.fillStyle = 'rgba(40,20,10,0.65)';
        S.roundRect(ctx, x + w / 2 - 130, y + 22, 260, 22, 8);
        ctx.fill();
        ctx.fillStyle = sub.color;
        ctx.fillRect(x + w / 2 - 124, y + 36, 248 * Math.max(0, Math.min(1, sub.pr)), 5);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(sub.text, cx, y + 34);
      }
      const INT = { boarKing: ['集中火力打断冲锋！'], inkBoss: ['集中火力打断重击！'], windGiant: ['集中火力打断大风！'], thunderKing: ['集中火力打断落雷！'] };
      if (boss.ai && (boss.ai.mode === 'warn' || boss.ai.mode === 'charge') && INT[boss.def.ai]) {
        const need = boss.maxHp * TD.data[boss.def.ai].interruptRatio;
        const pr = Math.min(1, boss.ai.chargeDmg / need);
        ctx.fillStyle = 'rgba(40,20,10,0.65)';
        S.roundRect(ctx, x + w / 2 - 130, y + 22, 260, 22, 8);
        ctx.fill();
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(x + w / 2 - 124, y + 36, 248 * pr, 5);
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(INT[boss.def.ai][0], cx, y + 34);
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

    // 火把照亮的范围：正好是英雄在暗夜里的射程
    torchEdge(b) {
      return C.wallX + b.range;
    }

    // 暗夜（设计书 57.2）：一块几乎全黑的幕布，只有火把、飞行中的箭、命中火花、爆炸和闪电能在上面"挖"出光
    // 暗夜里是否显示怪物的眼睛：默认不显示（真正的全黑，设计书 69），设置里可以打开
    showDarkEyes() {
      const g = TD.game;
      return !!(g && g.save && g.save.settings && g.save.settings.darkEyes);
    }

    drawDarkness(b) {
      const ctx = this.ctx;
      const K = 0.5; // 半分辨率画遮罩，放大后边缘本来就是柔的
      if (!this.darkCanvas) {
        this.darkCanvas = document.createElement('canvas');
        this.darkCanvas.width = C.width * K;
        this.darkCanvas.height = C.height * K;
      }
      const dc = this.darkCanvas.getContext('2d');
      dc.setTransform(1, 0, 0, 1, 0, 0);
      dc.globalCompositeOperation = 'source-over';
      dc.clearRect(0, 0, C.width * K, C.height * K);
      // 全屏闪光（雷霆等）会让黑幕整体变薄
      let flash = 0;
      for (const f of this.fx) if (f.kind === 'flash' && f.age >= 0) flash = Math.max(flash, (1 - f.age / f.life) * 0.55);
      dc.fillStyle = `rgba(0,0,0,${1 - flash})`;
      dc.fillRect(0, 0, C.width * K, C.height * K);
      dc.scale(K, K);
      dc.globalCompositeOperation = 'destination-out';
      const hole = (x, y, r, a) => {
        if (r <= 0 || a <= 0) return;
        const g = dc.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(0,0,0,${a})`);
        g.addColorStop(0.55, `rgba(0,0,0,${a * 0.7})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        dc.fillStyle = g;
        dc.fillRect(x - r, y - r, r * 2, r * 2);
      };
      // 城墙上的火把：照到射程边缘为止，会轻轻摇晃
      const midY = (C.fieldTop + C.fieldBottom) / 2;
      const flick = Math.sin(this.t * 9) * 6 + Math.sin(this.t * 23) * 3;
      const reach = b.range + 40 + flick;
      dc.save();
      dc.translate(C.wallX - 40, midY);
      dc.scale(1, 0.95);
      const tg = dc.createRadialGradient(0, 0, 0, 0, 0, reach);
      tg.addColorStop(0, 'rgba(0,0,0,1)');
      tg.addColorStop(0.72, 'rgba(0,0,0,0.92)');
      tg.addColorStop(0.9, 'rgba(0,0,0,0.45)');
      tg.addColorStop(1, 'rgba(0,0,0,0)');
      dc.fillStyle = tg;
      dc.fillRect(-reach, -reach, reach * 2, reach * 2);
      dc.restore();
      // 冰冻 / 毒雾等车道效果发着微光
      const lh = (C.fieldBottom - C.fieldTop) / b.lanes;
      for (const e of b.laneEffects) {
        const fade = Math.min(1, (e.until - b.time) * 2);
        dc.fillStyle = `rgba(0,0,0,${0.18 * fade})`;
        dc.fillRect(C.wallX, C.fieldTop + e.lane * lh, C.width - C.wallX, lh);
      }
      // 飞行中的箭和法球各带一团小光
      for (const p of b.projectiles) if (!p.done) hole(p.x, p.y, p.crit ? 80 : 60, 0.9);
      // 命中火花、爆炸、闪电
      for (const f of this.fx) {
        if (f.age < 0) continue;
        const k = 1 - f.age / f.life;
        if (f.kind === 'glow') hole(f.x, f.y, f.r * 2.6, k);
        else if (f.kind === 'boom') hole(f.x, f.y - 10, 150, k);
        else if (f.kind === 'bolt') hole(f.x, f.y, 190, k);
        else if (f.kind === 'fallArrow') hole(f.x, f.y, 50, k * 0.7);
        else if (f.kind === 'ring') hole(f.x, f.y, (f.r0 + (f.r1 - f.r0) * (1 - k)) * 1.4, k * 0.8);
      }
      if (this.vfx) for (const [x, y, r, a] of this.vfx.lights()) hole(x, y, r, a);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.darkCanvas, 0, 0, C.width, C.height);
      // 黑暗里的眼睛：偶尔眨一下
      const edge = this.torchEdge(b);
      ctx.globalCompositeOperation = 'lighter';
      for (const e of this.darkEyes || []) {
        const ph = (this.t * 0.7 + e.id * 0.61) % 4;
        if (ph < 0.12) continue;
        const a = Math.min(1, (e.x - edge + 30) / 60);
        const ey = e.y - e.size * (e.flying ? 0.75 : 1.0);
        const ex = e.x - e.size * 0.3;
        TD.art.drawGlow(ctx, ex + e.size * 0.17, ey, 10 + e.size * 0.25, '#ffd84a', 0.35 * a);
        S.ellipse(ctx, ex, ey, 2.6, 1.9, `rgba(255,236,120,${a})`);
        S.ellipse(ctx, ex + e.size * 0.35, ey, 2.6, 1.9, `rgba(255,236,120,${a})`);
      }
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
      // 怪物很多时特效太多会拖慢画面：每帧最多画 120 个小特效（火花、碎石、光晕、烟）和 24 个飘字，多出来的只计时不画（设计书 74.5）
      let cheap = 0;
      let texts = 0;
      for (const f of this.fx) {
        f.age += dt;
        if (f.age < 0) {
          keep.push(f);
          continue;
        }
        if (f.age > f.life) continue;
        keep.push(f);
        if (f.kind === 'text') {
          if (++texts > 24 && !f.crit) continue;
        } else if (CHEAP_FX[f.kind] && ++cheap > 120) continue;
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
          case 'glow':
            TD.art.drawGlow(ctx, f.x, f.y, f.r * (0.7 + k * 0.6), f.color, 1 - k, true);
            break;
          case 'spirit':
            f.x += f.vx * dt;
            f.y += f.vy * dt;
            f.vx *= Math.pow(0.3, dt);
            TD.art.drawGlow(ctx, f.x, f.y, f.r * (1 - k * 0.5), f.color, (1 - k) * 0.9, true);
            break;
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
            ctx.lineWidth = f.small ? 3 : 6;
            ctx.shadowColor = '#b07aff';
            ctx.shadowBlur = 20;
            ctx.beginPath();
            // 小闪电（雷鸣箭袋）只从目标头顶 200 像素处落下
            const top = f.small ? Math.max(0, f.y - 200) : 0;
            let x = f.x + 30;
            ctx.moveTo(x, top);
            for (let y = top; y < f.y; y += f.small ? 25 : 40) {
              x = f.x + (Math.sin(y * 0.3 + f.seed * 10) * (f.small ? 14 : 26) * (1 - (y - top) / (f.y - top)));
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
            else if (f.bubble) S.ellipse(ctx, x, y, 7, 7, 'rgba(190,235,255,0.5)', '#7ad0ff', 1.5);
            else if (f.pearl) S.ellipse(ctx, x, y, 8, 8, '#fff6fb', '#c9a0c0', 2);
            else if (f.ink) S.ellipse(ctx, x, y, 7, 7, '#e48ac0', '#9a3a78', 2);
            else S.ellipse(ctx, x, y, 6, 6, '#9df58a', '#3d7a2f', 1.5);
            if (k > 0.9 && !f.burst && !f.bubble) {
              f.burst = true;
              this.burst(f.x1, f.y1, f.fire ? '#ff8a3d' : f.pearl ? '#ffe6f2' : f.ink ? '#e48ac0' : '#7dff9a', 6, 100);
            }
            break;
          }
          case 'chain': {
            ctx.globalAlpha = 1 - k;
            if (f.straight) {
              // 穿云箭：一道白色的直线
              ctx.strokeStyle = f.color ? S.lighten(f.color, 0.5) : 'rgba(255,250,220,0.9)';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.moveTo(f.x0, f.y0);
              ctx.lineTo(f.x, f.y);
              ctx.stroke();
              break;
            }
            ctx.strokeStyle = f.color ? S.lighten(f.color, 0.45) : '#e2c8ff';
            ctx.lineWidth = 4;
            ctx.shadowColor = f.color || '#b07aff';
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
            if (f.color) {
              // 爆炸的颜色跟武器品质走（设计书 78.4）
              const rg = TD.art.rgba;
              if (f.magic) S.ellipse(ctx, f.x, f.y, f.r * (0.4 + k * 0.6), f.r * (0.3 + k * 0.45), rg(f.color, 0.45), f.color, 3);
              else {
                S.ellipse(ctx, f.x, f.y, f.r * (0.4 + k * 0.6), f.r * (0.3 + k * 0.45), rg(f.color, 0.55));
                S.ellipse(ctx, f.x, f.y, f.r * (0.2 + k * 0.4), f.r * (0.15 + k * 0.3), rg(S.lighten(f.color, 0.65), 0.85));
              }
            } else if (f.magic) {
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
            // 横幅：中间一条渐隐的暗带 + 发光的字（设计书 54.5）
            const bandG = ctx.createLinearGradient(C.width / 2 - 300, 0, C.width / 2 + 300, 0);
            bandG.addColorStop(0, 'rgba(8,12,24,0)');
            bandG.addColorStop(0.5, 'rgba(8,12,24,0.6)');
            bandG.addColorStop(1, 'rgba(8,12,24,0)');
            ctx.fillStyle = bandG;
            ctx.fillRect(C.width / 2 - 300, 188, 600, 68);
            ctx.font = 'bold 36px "Trebuchet MS", sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(255,200,110,0.9)';
            ctx.shadowBlur = 16;
            ctx.fillStyle = '#fff3d0';
            ctx.fillText(f.str, C.width / 2, 235);
            ctx.shadowBlur = 0;
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
