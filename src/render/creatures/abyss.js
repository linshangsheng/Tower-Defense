// 深渊回响（第 11–20 章）的终章 Boss：焚天巨龙 / 灭世黑龙（设计书 114、115、121、134）
// 西方神话里的巨龙，侧面像，朝左（城墙方向），悬在半空。纯矢量绘制，动作和技能特效都是程序生成的。v1.34 起按"更写实"重画：
//   · 身体：脖子 + 躯干 + 尾巴是同一条脊柱曲线（Catmull-Rom）按粗细剖面生成的连续轮廓；上有渐变底色、三种大小的鳞片纹理、
//     腹甲的横纹、肩 / 臀 / 背的肌肉隆起、颈部的筋、沿脊背的骨刺、岩浆裂纹、下缘的暗部和上缘的受光边；
//   · 翅膀：有肩、肘、腕三个关节的骨架（肱骨 + 前臂 + 四根带关节的指骨 + 腕上的拇指爪），扇贝形翼膜带放射状血管和旧伤口，
//     扇动时指骨比臂骨慢半拍，技能时可以高举 / 收拢到背后 / 垂下；远侧的翅膀更暗；
//   · 四肢：大腿 / 小腿 / 脚三段带关节鼓包的肢体，趾和弯钩爪，俯冲时前伸、倒下时蜷起；
//   · 头：长颅骨、眉骨板、颧骨刺、鼻梁小角、双角（带环纹）、鼻孔冒烟、会眨的竖瞳眼、上下两排牙（獠牙长）、口腔 / 舌头 / 喉咙里随技能变色的光、
//     下颌随技能张开、颈蹼；
//   · 四个技能各有"蓄力 → 释放"两段专属动作和特效：喷火（后仰 → 前扑喷出火焰）、冲撞（先猛扇翅膀飞到高处 → 收翅俯冲撞城墙 → 弹回）、
//     雷击（举翅聚雷球 → 放出闪电）、寒冰（吸气结霜 → 喷出冰晶）；
//   · 红 / 黑两种形态（ai.form），倒下 → 重生的过渡，狂暴的火星和红光。
// 坐标约定同 creatures.js：s 是 def.size，原点 = 身体中心（不是脚下），向上为负；整条龙宽约 2.5 s，翼尖高约 0.8 s。
// 状态（o.ai）：mode === 'warn' 时按 skill 和蓄力进度 warnTimer / warnMax 做预备动作；anim / animTimer 是技能释放期间；
// ramDx 是冲撞时龙头要冲多远（px）；phase 2 发怒、phase 3 狂暴；fallen / rebirthTimer 是倒下和重生。
(function (TD) {
  'use strict';

  const K = TD.creatures;
  const D = K.drawers;
  const TAU = Math.PI * 2;
  const { deep, light, rgba, glow, shadow, veins, scales, seeded, linear } = K;
  const clamp = (x, a, b) => Math.max(a === undefined ? 0 : a, Math.min(b === undefined ? 1 : b, x));
  const lerp = (a, b, u) => a + (b - a) * u;
  const smooth = (x) => {
    x = clamp(x);
    return x * x * (3 - 2 * x);
  };

  // ---------- 曲线工具 ----------
  // 均匀 Catmull-Rom：点列 P（每点 [x, y, ...附加量]）→ n 个采样点，附加量同样平滑插值；每个采样点带单位切线 (tx, ty)
  function spline(P, n) {
    const m = P.length;
    const g = (i) => P[Math.max(0, Math.min(m - 1, i))];
    const out = [];
    for (let k = 0; k < n; k++) {
      const f = (k / (n - 1)) * (m - 1);
      const i = Math.min(m - 2, Math.floor(f));
      const u = f - i;
      const a = g(i - 1), b = g(i), c = g(i + 1), d = g(i + 2);
      const u2 = u * u, u3 = u2 * u;
      out.push(b.map((_, j) => 0.5 * (2 * b[j] + (-a[j] + c[j]) * u + (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * u2 + (-a[j] + 3 * b[j] - 3 * c[j] + d[j]) * u3)));
    }
    for (let k = 0; k < n; k++) {
      const p = out[Math.max(0, k - 1)];
      const q = out[Math.min(n - 1, k + 1)];
      const dx = q[0] - p[0], dy = q[1] - p[1];
      const l = Math.hypot(dx, dy) || 1;
      out[k].tx = dx / l;
      out[k].ty = dy / l;
    }
    return out;
  }
  // 肉管轮廓：沿采样点，向"上"（切线左手边，(ty, −tx)）偏 p[2]，向"下"偏 p[3]
  function edges(S, q) {
    return {
      top: S.map((p) => [p[0] + p.ty * p[2] * q, p[1] - p.tx * p[2] * q]),
      bot: S.map((p) => [p[0] - p.ty * p[3] * q, p[1] + p.tx * p[3] * q]),
    };
  }
  function ribbonPath(ctx, S, q) {
    const e = edges(S, q || 1);
    ctx.beginPath();
    e.top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    for (let i = e.bot.length - 1; i >= 0; i--) ctx.lineTo(e.bot[i][0], e.bot[i][1]);
    ctx.closePath();
    return e;
  }
  function polyline(ctx, pts, from, to) {
    ctx.beginPath();
    const a = from === undefined ? 0 : from;
    for (let i = a; i <= (to === undefined ? pts.length - 1 : to); i++) (i === a ? ctx.moveTo : ctx.lineTo).call(ctx, pts[i][0], pts[i][1]);
  }
  // 封闭的光滑曲线（头、下颌）
  function closedPath(ctx, P) {
    const m = P.length;
    ctx.beginPath();
    ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 0; i < m; i++) {
      const p0 = P[(i + m - 1) % m], p1 = P[i], p2 = P[(i + 1) % m], p3 = P[(i + 2) % m];
      ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
    }
    ctx.closePath();
  }
  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const mixc = (a, b, t) => {
    const A = hex(a);
    const B = hex(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  };

  // 鳞片：K.scales 每次要描上千条小弧线，改成先画一块可平铺的小图，再用图案铺满
  const tiles = {};
  function scaleFill(ctx, x0, y0, x1, y1, size, color, a) {
    if (typeof document === 'undefined') return scales(ctx, x0, y0, x1, y1, size, color, a);
    const key = color + a;
    let tile = tiles[key];
    if (!tile) {
      const W = 32;
      const RH = 22.4;
      const c = document.createElement('canvas');
      c.width = W;
      c.height = RH * 2;
      const g = c.getContext('2d');
      g.strokeStyle = rgba(color, a);
      g.lineWidth = 3.8;
      for (let row = 0; row < 2; row++) {
        const y = row * RH;
        g.beginPath();
        for (let x = (row ? W / 2 : 0) - W; x <= W * 2; x += W) {
          g.moveTo(x - W / 2, y);
          g.quadraticCurveTo(x, y + W * 0.65, x + W / 2, y);
        }
        g.stroke();
      }
      tile = tiles[key] = { c, pat: ctx.createPattern(c, 'repeat') };
    }
    const k = size / 32;
    ctx.save();
    ctx.scale(k, k);
    ctx.fillStyle = tile.pat;
    ctx.fillRect(x0 / k, y0 / k, (x1 - x0) / k, (y1 - y0) / k);
    ctx.restore();
  }

  // 写实的鳞皮：先画一块可平铺的小图——一排排上缘被压住、下缘露出的圆角鳞片，每片有"顶亮底暗"的渐变、
  // 缝隙里的暗线和左上的一道高光——再用图案铺满。一张图一份，按（亮色 + 暗色）缓存；size 是一片鳞的宽（px）
  const skinTiles = {};
  function skinFill(ctx, x0, y0, x1, y1, size, hi, lo, a) {
    if (typeof document === 'undefined') return;
    const key = hi + lo;
    let tile = skinTiles[key];
    if (!tile) {
      const W = 48;
      const H = 36;
      const R = 2; // 按 2 倍分辨率画，放大使用时不糊
      const c = document.createElement('canvas');
      c.width = W * R;
      c.height = H * R;
      const g = c.getContext('2d');
      g.scale(R, R);
      for (let row = 2; row >= -1; row--) {
        for (let col = -1; col < 3; col++) {
          const cx = col * W / 2 + (row & 1 ? W / 4 : 0) + W / 4;
          const cy = row * H / 2 + H / 4;
          const sw = W / 2;
          const sh = H / 2 + 5;
          g.beginPath();
          g.moveTo(cx - sw / 2, cy - sh * 0.5);
          g.bezierCurveTo(cx - sw * 0.62, cy + sh * 0.25, cx - sw * 0.2, cy + sh * 0.62, cx, cy + sh * 0.62);
          g.bezierCurveTo(cx + sw * 0.2, cy + sh * 0.62, cx + sw * 0.62, cy + sh * 0.25, cx + sw / 2, cy - sh * 0.5);
          const gr = g.createLinearGradient(cx - sw * 0.2, cy - sh * 0.5, cx + sw * 0.1, cy + sh * 0.62);
          gr.addColorStop(0, rgba(hi, 0.55));
          gr.addColorStop(0.5, rgba(hi, 0.12));
          gr.addColorStop(1, rgba(lo, 0.6));
          g.fillStyle = gr;
          g.fill();
          g.strokeStyle = rgba(lo, 0.8);
          g.lineWidth = 0.9;
          g.stroke(); // 只描下面的弧：上缘被上一排的鳞片盖住
          // 左上的小高光
          g.strokeStyle = rgba(hi, 0.5);
          g.lineWidth = 0.7;
          g.beginPath();
          g.moveTo(cx - sw * 0.36, cy - sh * 0.1);
          g.quadraticCurveTo(cx - sw * 0.28, cy + sh * 0.3, cx - sw * 0.08, cy + sh * 0.45);
          g.stroke();
        }
      }
      tile = skinTiles[key] = { c, W, H, pat: ctx.createPattern(c, 'repeat') };
    }
    const k = size / (tile.W / 2);
    ctx.save();
    ctx.globalAlpha *= a === undefined ? 1 : a;
    ctx.scale(k / 2, k / 2); // 图是 2 倍分辨率
    ctx.fillStyle = tile.pat;
    ctx.fillRect(x0 / (k / 2), y0 / (k / 2), (x1 - x0) / (k / 2), (y1 - y0) / (k / 2));
    ctx.restore();
  }

  // 闪电折线：从 (x0, y0) 到 (x1, y1)，中点位移法，seed 变了形状就变（每秒变十几次就是"闪烁"）
  function jag(x0, y0, x1, y1, seed, amp, depthN) {
    const r = seeded(seed);
    let pts = [[x0, y0], [x1, y1]];
    for (let d = 0; d < depthN; d++) {
      const out = [pts[0]];
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[i + 1];
        const nx = -(by - ay);
        const ny = bx - ax;
        const l = Math.hypot(nx, ny) || 1;
        const o = (r() - 0.5) * amp * Math.pow(0.55, d);
        out.push([(ax + bx) / 2 + (nx / l) * o, (ay + by) / 2 + (ny / l) * o], pts[i + 1]);
      }
      pts = out;
    }
    return pts;
  }


  // ================= 姿态：由 ai 状态和时间算出所有动作参数（画法和特效定位都用它） =================
  const ART = 0.92; // 整条龙画得比 def.size 略小一点，给翅膀留出空间（嘴的位置 K.dragonMouthAt 同步缩放）
  const KIND = { fire: 'fire', shock: 'ram', bolt: 'bolt', ice: 'ice' }; // 技能 → 动作
  function durations() {
    const G = TD.data.abyssDragon || {};
    return { fire: (G.fire || {}).anim || 1.6, ram: (G.shock || {}).anim || 1.8, bolt: (G.bolt || {}).anim || 1.8, ice: (G.ice || {}).anim || 1.6 };
  }
  const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 2);
  const easeIn = (x) => clamp(x) * clamp(x);

  // 动作参数一览（单位：s = def.size；角度：弧度）：
  //   hdx / hdy / hang / jaw：头的位置、俯仰、下颌张开；bodyY：身体整体上下；lift：升空高度（负 = 往上）；dashX：水平冲出去多远（负 = 往城墙）；pitch：整条龙的俯仰（负 = 低头）
  //   raise：翅膀高举；hold：翅膀不扇、撑开；fold：翅膀收到背后；droop：翅膀垂下；chest：吸气鼓胸；tail：尾巴甩动幅度；legs：腿的姿势（-1 蜷起、0 自然垂着、1 向前伸出利爪）
  //   frost / jet / orb / beam / speed：寒气、喷口、雷球、闪电、速度线
  //   flapRate：扇翅频率倍数
  function poseOf(ai, t) {
    const dur = durations();
    const G = TD.data.abyssDragon || {};
    const q = {};
    q.fallen = !!ai.fallen;
    q.rebirth = q.fallen && ai.rebirthMax ? clamp(1 - ai.rebirthTimer / ai.rebirthMax) : 0;
    q.dark = ai.form === 2 ? 1 : q.rebirth;
    q.phase = ai.phase || 1;
    q.rage = q.phase >= 3;
    q.angry = q.phase >= 2;
    const warn = ai.mode === 'warn' && !q.fallen;
    const warnKind = warn ? KIND[ai.skill] : null;
    const k = warn && ai.warnMax ? clamp(1 - ai.warnTimer / ai.warnMax) : 0;
    const act = ai.animTimer > 0 && dur[ai.anim] && !q.fallen ? ai.anim : null;
    const p = act ? clamp(1 - ai.animTimer / dur[act]) : 0;
    q.kind = act || warnKind;
    q.stage = act ? 'cast' : warnKind ? 'warn' : null;
    q.k = k;
    q.p = p;
    // 默认（待机）：悬停，头微微晃动，翅膀慢扇
    Object.assign(q, { hdx: 0, hdy: 0, hang: -0.1 + Math.sin(t * 1.1) * 0.035, jaw: 0.05 + 0.03 * Math.sin(t * 2.1), bodyY: 0, lift: 0, dashX: 0, pitch: 0, raise: 0, fold: 0, droop: 0, hold: 0, chest: 0, tail: 0, frost: 0, jet: 0, orb: 0, beam: 0, legs: 0, speed: 0, flapRate: 1, impact: 0 });
    const mix = (a, b, u) => {
      const o = {};
      for (const key of Object.keys(a)) o[key] = lerp(a[key], b[key], u);
      return o;
    };
    const apply = (o) => Object.assign(q, o);
    // 喷火 / 寒冰共用"后仰 → 前扑"：warnEnd 是蓄力满时的姿势，lunge 是前扑喷出时的姿势
    if (q.kind === 'fire' || q.kind === 'ice') {
      const ice = q.kind === 'ice';
      const r = smooth(k);
      const warnEnd = ice ? { hdx: 0.05, hdy: 0.04, hang: -0.2, jaw: 0.4, raise: 0.1, hold: 0.35, chest: 1, bodyY: 0.01, frost: 1, pitch: 0.04 } : { hdx: 0.11, hdy: -0.1, hang: 0.3, jaw: 0.46, raise: 0.3, hold: 0.7, chest: 1, bodyY: -0.02, frost: 0, pitch: 0.08 };
      const idle = { hdx: 0, hdy: 0, hang: q.hang, jaw: q.jaw, raise: 0, hold: 0, chest: 0, bodyY: 0, frost: 0, pitch: 0 };
      if (q.stage === 'warn') {
        apply(mix(idle, warnEnd, r));
        if (ice) q.jet = r * 0.5; // 寒气先在嘴边聚成雾
      } else {
        const lungePose = { hdx: -0.19, hdy: 0.04, hang: -0.22, jaw: 0.66, raise: 0.2, hold: 0.5, chest: 0.6, bodyY: 0, frost: ice ? 1 : 0, pitch: -0.05 };
        const lunge = smooth(p / 0.14);
        const relax = smooth((p - 0.72) / 0.28);
        apply(mix(mix(warnEnd, lungePose, lunge), idle, relax));
        q.jet = smooth(p / 0.1) * (1 - smooth((p - 0.8) / 0.2));
        if (ice) q.frost = lerp(1, 0.25, smooth((p - 0.6) / 0.4));
      }
    } else if (q.kind === 'ram') {
      // 冲撞（设计书 134）：蓄力时（warn）先猛扇翅膀、飞到高处；放出时（cast）俯冲撞向城墙，撞上后弹回，重新悬停
      const LIFT = 0.4;
      const hit = G.shock && G.shock.hitAt ? G.shock.hitAt : 0.4;
      const dx = (ai.ramDx !== undefined ? ai.ramDx : 640) / (ART * 290); // 龙头撞到城墙要冲多远（px → s 单位）
      if (q.stage === 'warn') {
        const r = easeOut(k);
        apply({ lift: -LIFT * r, bodyY: -0.02 * r, pitch: 0.16 * r, hang: -0.1 + 0.2 * r, hdy: -0.04 * r, jaw: 0.12 + 0.22 * r, tail: 0.5 * r, legs: -0.3 * r, chest: r });
        q.flapRate = 1 + 1.2 * r; // 越扇越猛
        q.flapAmp = 1;
      } else {
        const dive0 = 0.1;
        let u;
        if (p < dive0) {
          // 收翅、低头，准备俯冲
          u = smooth(p / dive0);
          apply({ lift: -LIFT, pitch: lerp(0.16, -0.25, u), fold: u * 0.8, hdy: 0.02 * u, hang: lerp(0.1, -0.35, u), jaw: 0.3, legs: lerp(-0.3, 0.9, u), tail: 0.6 });
          q.flapRate = 1.4;
        } else if (p < hit) {
          // 俯冲：越来越快，机头朝着城墙压下去
          u = (p - dive0) / (hit - dive0);
          const a = easeIn(u);
          apply({ lift: lerp(-LIFT, 0.12, Math.pow(u, 1.6)), dashX: -dx * a, pitch: -0.55 * Math.min(1, u * 2.2) - 0.05, fold: 1, hang: -0.42, hdy: 0.05, jaw: 0.34, legs: 1, tail: 0.9 });
          q.speed = a;
        } else if (p < hit + 0.06) {
          // 撞上的一瞬间：定格、身体挤压
          u = (p - hit) / 0.06;
          apply({ lift: 0.12, dashX: -dx, pitch: -0.5, fold: 1, hang: -0.4, hdy: 0.06, jaw: 0.5, legs: 1, tail: 1 });
          q.impact = 1 - u * 0.4;
          q.speed = 0.3;
        } else {
          // 弹回：向后退，机头抬起，翅膀重新张开
          const v = (p - hit - 0.06) / (1 - hit - 0.06);
          const e = easeOut(Math.min(1, v * 1.5));
          const e2 = smooth(v);
          apply({ lift: lerp(0.12, -0.3, e) * (1 - smooth((v - 0.55) / 0.45)), dashX: -dx * (1 - e), pitch: lerp(-0.5, 0.14, e) * (1 - smooth((v - 0.6) / 0.4)), fold: 1 - e2, hang: lerp(-0.4, 0, e2), hdy: lerp(0.06, 0, e2), jaw: lerp(0.5, 0.06, e2), legs: 1 - e2, tail: 1 - e2 * 0.6 });
          q.flapRate = 1.2;
          q.impact = Math.max(0, 0.6 - v * 2);
        }
      }
    } else if (q.kind === 'bolt') {
      const r = smooth(k);
      if (q.stage === 'warn') {
        apply({ raise: 0.65 * r, hold: 0.8 * r, hang: -0.1 + 0.42 * r, hdy: -0.07 * r, jaw: 0.12 + 0.28 * r, chest: r });
        q.orb = r;
      } else {
        apply({ raise: 0.65, hold: 0.8, hang: -0.02, hdy: -0.03, jaw: 0.55, chest: 1 });
        q.orb = 1 - smooth(p / 0.25);
        q.beam = smooth(p / 0.08) * (1 - smooth((p - 0.82) / 0.18));
      }
    } else if (q.fallen) {
      const rb = q.rebirth * q.rebirth;
      apply({ bodyY: 0.09 * (1 - rb), droop: 1 - rb, hold: 1 - rb, hang: -0.5 * (1 - rb), jaw: 0.02 + 0.3 * rb, legs: -0.6 * (1 - rb), pitch: 0.06 * (1 - rb) });
    }
    // 翅膀的拍动：技能里翅膀被"举着 / 收着"（hold），拍动幅度跟着变小；狂暴时拍得更快
    const rate = (q.rage ? 3.2 : 2.2) * q.flapRate;
    q.rate = rate;
    // 相位：用累计相位会有跳变，这里按 t 直接乘频率；冲撞升空时频率在变，所以乘到 t 上有点"拉伸"，视觉上就是越扇越猛
    q.ph = t * rate;
    const amp = q.flapAmp || 1;
    q.flap = Math.sin(q.ph) * (1 - 0.85 * q.hold) * amp;
    q.flap2 = Math.sin(q.ph + 0.8) * (1 - 0.85 * q.hold) * amp;
    q.lag = Math.sin(q.ph - 0.7) * (1 - 0.85 * q.hold); // 指骨比臂骨慢半拍，翼尖才有"甩"的感觉
    q.lag2 = Math.sin(q.ph + 0.1) * (1 - 0.85 * q.hold);
    if (q.droop > 0) {
      q.flap = lerp(q.flap, 0.9, q.droop);
      q.flap2 = lerp(q.flap2, 0.8, q.droop);
      q.lag = lerp(q.lag, 1, q.droop);
      q.lag2 = lerp(q.lag2, 1, q.droop);
    }
    // 悬停：翅膀往下拍时身体往上抬一点；呼吸
    q.bob = q.fallen ? 0 : -Math.cos(q.ph) * 0.016 * (1 + 0.8 * (q.flapRate - 1));
    q.breath = Math.sin(t * 1.9) * 0.5 + 0.5;
    return q;
  }

  // 头的位置和嘴尖的位置（单位 s，原点 = 身体中心，含整体下移 0.12 s）；和 D.abyssDragon 里算头的方式一致
  const HEAD = { sc: 1.34, nose: -0.53, noseY: 0.02, hinge: [0.04, 0.056] };
  function headAnchor(q) {
    return [-1.0 + q.hdx, -0.6 + q.hdy];
  }
  function headGeometry(q) {
    const [hx, hy] = headAnchor(q);
    const ca = Math.cos(q.hang);
    const sa = Math.sin(q.hang);
    const lx = HEAD.nose * HEAD.sc;
    const ly = (0.045 + Math.sin(q.jaw) * 0.2) * HEAD.sc; // 嘴尖：张开时在上下颌前端之间
    return { hx, hy, sc: HEAD.sc, mouthX: hx + lx * ca - ly * sa, mouthY: hy + lx * sa + ly * ca + 0.12 };
  }
  // renderer 放技能特效时用：kind = 'walk' / 'fire' / 'bolt' / 'ice' / 'ram'（释放进行到 30% 时嘴的位置）
  K.dragonMouthAt = function (kind) {
    const k = kind === true ? 'fire' : kind;
    const dur = durations();
    const ai = dur[k] ? { anim: k, animTimer: dur[k] * 0.7, form: 1 } : { mode: 'idle' };
    const g = headGeometry(poseOf(ai, 0));
    return { x: g.mouthX * ART, y: g.mouthY * ART };
  };


  // ================= 火焰、冰晶（程序生成的技能特效，画在龙的坐标系里） =================
  // 火焰：沿喷口方向铺一串叠加的径向渐变（外层红、中层橙、芯是白黄），再加几条火舌和飞散的火星
  function flameJet(ctx, x0, y0, ang, len, wid, t, a) {
    if (a <= 0.02) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const N = 15;
    for (let j = 0; j < N; j++) {
      const u = j / (N - 1);
      const dist = u * len;
      const lat = Math.sin(t * 13 + j * 1.9) * wid * 0.22 * u + Math.sin(t * 7.3 + j) * wid * 0.1 * u;
      const x = x0 + ca * dist - sa * lat;
      const y = y0 + sa * dist + ca * lat - u * u * wid * 0.25; // 火焰尾部往上飘
      const r = wid * (0.22 + 0.78 * Math.pow(u, 0.75)) * (0.9 + 0.1 * Math.sin(t * 17 + j * 2.3));
      const fade = a * (1 - Math.pow(u, 1.6) * 0.85);
      glow(ctx, x, y, r * 1.5, '#ff3a10', 0.38 * fade);
      glow(ctx, x, y, r * 1.0, '#ff8a22', 0.55 * fade);
      if (u < 0.75) glow(ctx, x, y, r * 0.55, '#ffe08a', 0.7 * fade * (1 - u));
    }
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const off = (i - 2.5) * wid * 0.18;
      const L = len * (0.55 + 0.4 * (((i * 7) % 5) / 5));
      ctx.strokeStyle = rgba(i % 2 ? '#ffd070' : '#ff9a30', 0.55 * a);
      ctx.lineWidth = wid * (0.07 - i * 0.004);
      ctx.beginPath();
      for (let k = 0; k <= 8; k++) {
        const u = (k / 8) * (L / len);
        const dist = u * len;
        const lat = off * (0.2 + u * 1.5) + Math.sin(t * 11 + i * 2 + u * 7) * wid * 0.12 * u;
        const x = x0 + ca * dist - sa * lat;
        const y = y0 + sa * dist + ca * lat;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    const rr = seeded(5);
    for (let i = 0; i < 16; i++) {
      const u = (t * 1.1 + rr()) % 1;
      const dist = u * len * 1.15;
      const lat = (rr() - 0.5) * wid * (0.5 + u * 1.6);
      ctx.fillStyle = rgba(i % 3 ? '#ffb040' : '#fff0b0', (1 - u) * 0.9 * a);
      ctx.beginPath();
      ctx.arc(x0 + ca * dist - sa * lat, y0 + sa * dist + ca * lat - u * wid * 0.4, wid * 0.025 * (1 - u * 0.5), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  // 冰晶：喷出的一串冰雾 + 向前飞散的菱形冰碴
  function iceJet(ctx, x0, y0, ang, len, wid, t, a) {
    if (a <= 0.02) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    for (let j = 0; j < 11; j++) {
      const u = j / 10;
      const dist = u * len;
      const lat = Math.sin(t * 9 + j * 2.1) * wid * 0.2 * u;
      const x = x0 + ca * dist - sa * lat;
      const y = y0 + sa * dist + ca * lat;
      const r = wid * (0.2 + 0.8 * Math.pow(u, 0.8));
      const fade = a * (1 - Math.pow(u, 1.5) * 0.7);
      glow(ctx, x, y, r * 1.4, '#5ab4ff', 0.3 * fade);
      glow(ctx, x, y, r * 0.9, '#bfe8ff', 0.4 * fade);
      if (u < 0.6) glow(ctx, x, y, r * 0.45, '#ffffff', 0.55 * fade);
    }
    ctx.globalCompositeOperation = 'source-over';
    const rr = seeded(11);
    for (let i = 0; i < 22; i++) {
      const u = clamp(((t * 0.9 + rr()) % 1) * 1.05);
      const dist = u * len * 1.1;
      const lat = (rr() - 0.5) * wid * (0.6 + u * 2.2);
      const x = x0 + ca * dist - sa * lat;
      const y = y0 + sa * dist + ca * lat;
      const L = wid * (0.12 + rr() * 0.2) * (0.6 + u * 0.6);
      const w = L * 0.34;
      const rot = ang + (rr() - 0.5) * 1.2 + t * (rr() - 0.5) * 2;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = a * (1 - u * 0.5);
      ctx.beginPath();
      ctx.moveTo(-L, 0);
      ctx.lineTo(0, -w);
      ctx.lineTo(L, 0);
      ctx.lineTo(0, w);
      ctx.closePath();
      ctx.fillStyle = linear(ctx, -L, 0, L, 0, [[0, '#7fd0ff'], [0.5, '#e8f8ff'], [1, '#4aa0ff']]);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(1, wid * 0.012);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
  // ================= 绘制：骨架、翅膀、肢体、头 =================
  // 画一根渐细的骨头 / 肢体段：p0 → p1，宽度 w0 → w1（px），两侧各留一条受光的细线
  function taper(ctx, p0, p1, w0, w1, fill, hi) {
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(p0[0] + nx * w0, p0[1] + ny * w0);
    ctx.lineTo(p1[0] + nx * w1, p1[1] + ny * w1);
    ctx.lineTo(p1[0] - nx * w1, p1[1] - ny * w1);
    ctx.lineTo(p0[0] - nx * w0, p0[1] - ny * w0);
    ctx.closePath();
    ctx.fill();
    if (hi) {
      ctx.strokeStyle = hi;
      ctx.lineWidth = w0 * 0.35;
      ctx.beginPath();
      ctx.moveTo(p0[0] + nx * w0 * 0.55, p0[1] + ny * w0 * 0.55);
      ctx.lineTo(p1[0] + nx * w1 * 0.55, p1[1] + ny * w1 * 0.55);
      ctx.stroke();
    }
  }
  // 一枚弯钩的爪：根在 (x, y)，朝 ang 方向伸 len，向 curl 的一侧弯
  function claw(ctx, x, y, ang, len, w, fill, edge) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, -w);
    ctx.quadraticCurveTo(len * 0.62, -w * 0.75, len, w * 0.5);
    ctx.quadraticCurveTo(len * 0.55, w * 0.15, 0, w);
    ctx.closePath();
    ctx.fill();
    if (edge) {
      ctx.strokeStyle = edge;
      ctx.lineWidth = w * 0.28;
      ctx.beginPath();
      ctx.moveTo(w * 0.4, -w * 0.62);
      ctx.quadraticCurveTo(len * 0.6, -w * 0.7, len * 0.97, w * 0.42);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 翅膀的四种关键姿势（角度：弧度，0 = 朝身后，−π/2 = 朝上，π/2 = 朝下；龙头朝左）
  //   D 下拍到底、U 上举到顶、F 收拢伏在背上
  const WING_D = { a1: -0.25, a2: 0.2, f: [-0.25, 0.15, 0.55, 0.95], c: 0.1 };
  const WING_U = { a1: -0.95, a2: -1.3, f: [-2.35, -1.85, -1.3, -0.75], c: -0.14 };
  const WING_F = { a1: -0.1, a2: 2.95, f: [-0.04, 0.05, 0.14, 0.22], c: 0.03 };
  const WING_LEN = [0.6, 0.72, 0.66, 0.5];
  // 算一只翅膀的骨架（单位 s）；u = 0（下拍）…1（上举），fold = 收拢程度，lag = 指骨的延迟
  function wingRig(sx, sy, u, lagU, fold, s) {
    const mixA = (a, b, k) => a + (b - a) * k;
    const pose = (k, key) => mixA(WING_D[key], WING_U[key], k);
    const a1 = mixA(pose(u, 'a1'), WING_F.a1, fold);
    const a2 = mixA(pose(u, 'a2'), WING_F.a2, fold);
    const L1 = 0.22;
    const L2 = 0.34;
    const E = [sx + Math.cos(a1) * L1, sy + Math.sin(a1) * L1];
    const W = [E[0] + Math.cos(a2) * L2, E[1] + Math.sin(a2) * L2];
    const fingers = [];
    for (let i = 0; i < 4; i++) {
      // 指骨比臂骨慢半拍：用 lagU 算指的角度
      const af = mixA(mixA(WING_D.f[i], WING_U.f[i], lagU), WING_F.f[i], fold);
      const curl = mixA(mixA(WING_D.c, WING_U.c, lagU), WING_F.c, fold);
      const L = WING_LEN[i] * (1 - 0.18 * fold);
      const J = [W[0] + Math.cos(af) * L * 0.52, W[1] + Math.sin(af) * L * 0.52];
      const T = [J[0] + Math.cos(af + curl) * L * 0.48, J[1] + Math.sin(af + curl) * L * 0.48];
      fingers.push({ J, T, ang: af });
    }
    return { S: [sx, sy], E, W, fingers };
  }

  // ================= 头 =================
  // 在头的局部坐标里画：1 个单位 = s × HEAD.sc；龙头朝左，鼻尖在 x ≈ −0.53，颅骨后缘在 x ≈ +0.1，下颌铰链在 (0.04, 0.056)
  function drawDragonHead(ctx, s, t, q, g, c) {
    const { SKIN, SKIN2, SKIN_HI, BONE, BONE_DK, RIM, EYE, eyeGlow, dark, rage, heat, lowQ, OUT, kind, toneA, cast, fallen, rebirth } = c;
    const hs = g.sc * s;
    const u = (px) => px / hs; // px → 局部单位（线宽用）
    const jr = q.jaw;
    ctx.save();
    ctx.translate(g.hx * s, g.hy * s);
    ctx.rotate(q.hang);
    ctx.scale(hs, hs);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const lwL = (v) => v; // 局部单位的线宽
    // 头的局部坐标已经放大了 hs 倍，这里不能用 K.glow（它按像素缓存光斑），自己画径向渐变
    const glow = (x, y, r, color, a) => {
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, rgba(color, a));
      gr.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    };

    // ---- 颈后的颈蹼 / 骨刺（在头后面）：从颅骨后缘向后下方撑开，中间连一层暗红的蹼 ----
    const frillBase = [[0.08, -0.06], [0.1, -0.02], [0.12, 0.03], [0.1, 0.08]];
    const frillTip = [[0.34, -0.15], [0.38, -0.02], [0.37, 0.1], [0.3, 0.21]];
    ctx.fillStyle = rgba(mixc('#7a1022', '#260a2a', dark), 0.9);
    ctx.beginPath();
    ctx.moveTo(frillBase[0][0], frillBase[0][1]);
    for (let i = 0; i < 4; i++) ctx.lineTo(frillTip[i][0], frillTip[i][1]);
    ctx.lineTo(frillBase[3][0], frillBase[3][1]);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      const gr = ctx.createLinearGradient(frillBase[i][0], frillBase[i][1], frillTip[i][0], frillTip[i][1]);
      gr.addColorStop(0, BONE_DK);
      gr.addColorStop(1, BONE);
      ctx.strokeStyle = gr;
      ctx.lineWidth = lwL(0.016 - i * 0.0015);
      ctx.beginPath();
      ctx.moveTo(frillBase[i][0], frillBase[i][1]);
      ctx.lineTo(frillTip[i][0], frillTip[i][1]);
      ctx.stroke();
    }

    // ---- 主角（双角）：粗大的后掠弯角，带环纹，一只断了尖 ----
    const horn = (pts, w0, broken) => {
      const Sp = spline(pts.map((p) => [p[0], p[1], w0 * (1 - 0.0), w0]), 24);
      ctx.save();
      const Sw = Sp.map((p, i) => {
        const a = [p[0], p[1], p[2] * (1 - i / 26), p[3] * (1 - i / 26)];
        a.tx = p.tx;
        a.ty = p.ty;
        return a;
      });
      ribbonPath(ctx, Sw, 1);
      ctx.fillStyle = linear(ctx, pts[0][0], pts[0][1], pts[pts.length - 1][0], pts[pts.length - 1][1], [[0, BONE_DK], [0.55, BONE], [1, '#f2e6cc']]);
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = lwL(0.004);
      ctx.stroke();
      // 环纹
      ctx.strokeStyle = rgba('#000000', 0.28);
      ctx.lineWidth = lwL(0.003);
      for (let i = 3; i < 21; i += 3) {
        const p = Sp[i];
        const wd = p[2] * (1 - i / 26);
        ctx.beginPath();
        ctx.moveTo(p[0] + p.ty * wd, p[1] - p.tx * wd);
        ctx.lineTo(p[0] - p.ty * wd, p[1] + p.tx * wd);
        ctx.stroke();
      }
      // 受光的一边
      ctx.strokeStyle = rgba('#ffffff', 0.35);
      ctx.lineWidth = lwL(0.004);
      ctx.beginPath();
      edges(Sw, 1).top.forEach(([x, y], i) => (i < 22 ? (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)) : null));
      ctx.stroke();
      ctx.restore();
      void broken;
    };
    horn([[0.04, -0.09], [0.16, -0.17], [0.3, -0.2], [0.42, -0.14], [0.47, -0.04]], 0.04, false);
    horn([[0.08, -0.04], [0.19, -0.07], [0.31, -0.06], [0.39, 0.0]], 0.026, false);

    // ---- 嘴里：口腔（暗红）、舌头、喉咙里的光 ----
    const hinge = HEAD.hinge;
    const upperLip = [[-0.52, 0.04], [-0.42, 0.052], [-0.3, 0.058], [-0.16, 0.062], [-0.04, 0.062], [0.04, 0.058]];
    const jawLip = [[-0.5, 0.046], [-0.4, 0.056], [-0.28, 0.062], [-0.14, 0.064], [-0.02, 0.062], [0.04, 0.058]];
    // 下颌的局部点 → 绕铰链转 −jr（龙头朝左：负角度把下颌尖转到下面）
    const jawT = (p) => {
      const ca = Math.cos(-jr);
      const sa = Math.sin(-jr);
      const x = p[0] - hinge[0];
      const y = p[1] - hinge[1];
      return [hinge[0] + x * ca - y * sa, hinge[1] + x * sa + y * ca];
    };
    const jawLipT = jawLip.map(jawT);
    if (jr > 0.03) {
      ctx.beginPath();
      ctx.moveTo(upperLip[0][0], upperLip[0][1]);
      for (const p of upperLip) ctx.lineTo(p[0], p[1]);
      ctx.lineTo(hinge[0] + 0.01, hinge[1] + 0.02);
      for (let i = jawLipT.length - 1; i >= 0; i--) ctx.lineTo(jawLipT[i][0], jawLipT[i][1]);
      ctx.closePath();
      const mg = ctx.createRadialGradient(hinge[0] - 0.06, hinge[1] + 0.04, 0.01, hinge[0] - 0.06, hinge[1] + 0.04, 0.5);
      mg.addColorStop(0, mixc('#ff8a3a', '#ff2a5a', dark));
      mg.addColorStop(0.18, '#7a1020');
      mg.addColorStop(0.6, '#2a0710');
      mg.addColorStop(1, '#10020a');
      ctx.fillStyle = mg;
      ctx.fill();
      // 喉咙深处的光：喷火 / 寒冰 / 雷击蓄力时按各自的颜色亮起来
      const glowC = kind === 'ice' ? '#9fdcff' : kind === 'bolt' ? '#bfd4ff' : '#ffb050';
      const ga = Math.min(1, jr * 1.8) * (0.3 + 0.7 * Math.max(toneA, q.chest) + 0.2 * heat);
      ctx.save();
      ctx.clip();
      ctx.globalCompositeOperation = 'lighter';
      glow(hinge[0] - 0.08, hinge[1] + 0.03, 0.34, glowC, 0.7 * ga);
      glow(hinge[0] - 0.08, hinge[1] + 0.03, 0.14, '#fff0c0', 0.8 * ga * Math.max(toneA, q.chest));
      ctx.restore();
      // 舌头：贴着下颌上面，张得越大越露出来，微微晃动
      const tl = jawLipT;
      ctx.fillStyle = mixc('#a02840', '#4a1038', dark);
      ctx.beginPath();
      ctx.moveTo(hinge[0] - 0.02, hinge[1] + 0.03);
      for (let i = tl.length - 2; i >= 1; i--) ctx.lineTo(tl[i][0] + 0.01, tl[i][1] - 0.012 - 0.012 * Math.sin(t * 5 + i));
      ctx.lineTo(tl[0][0] + 0.06, tl[0][1] - 0.004);
      ctx.lineTo(tl[1][0], tl[1][1] + 0.012);
      ctx.closePath();
      ctx.fill();
    }

    // ---- 下颌：下缘带肉垂和下巴上的骨刺，上缘是下排牙 ----
    ctx.save();
    ctx.translate(hinge[0], hinge[1]);
    ctx.rotate(-jr);
    ctx.translate(-hinge[0], -hinge[1]);
    const jaw = [[0.06, 0.05], [0.11, 0.11], [0.09, 0.17], [-0.02, 0.19], [-0.16, 0.178], [-0.32, 0.15], [-0.45, 0.11], [-0.52, 0.07], [-0.535, 0.05]];
    closedPath(ctx, jaw);
    const jg = ctx.createLinearGradient(0, 0.04, 0, 0.17);
    jg.addColorStop(0, SKIN2);
    jg.addColorStop(1, SKIN);
    ctx.fillStyle = jg;
    ctx.fill();
    ctx.save();
    ctx.clip();
    if (!lowQ) scaleFill(ctx, -0.6, 0, 0.2, 0.3, 0.026, '#000000', 0.32);
    // 下缘受光
    ctx.strokeStyle = rgba(RIM, 0.55);
    ctx.lineWidth = lwL(0.007);
    ctx.beginPath();
    ctx.moveTo(-0.5, 0.1);
    ctx.lineTo(-0.2, 0.172);
    ctx.lineTo(0.06, 0.188);
    ctx.stroke();
    // 下颌的明暗：靠喉咙那边更暗
    ctx.fillStyle = linear(ctx, -0.5, 0, 0.1, 0, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.4)']]);
    ctx.fillRect(-0.6, 0, 0.8, 0.3);
    ctx.restore();
    closedPath(ctx, jaw);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = lwL(0.0045);
    ctx.stroke();
    // 下巴的骨刺
    for (const [x, y, h2] of [[-0.42, 0.125, 0.05], [-0.3, 0.158, 0.06], [-0.18, 0.177, 0.055], [-0.06, 0.188, 0.045]]) {
      ctx.fillStyle = BONE;
      ctx.beginPath();
      ctx.moveTo(x - 0.016, y);
      ctx.lineTo(x + 0.03, y + h2);
      ctx.lineTo(x + 0.016, y - 0.003);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = lwL(0.0025);
      ctx.stroke();
    }
    // 下排牙：沿下颌上缘，向上，前面几颗长
    const lowerTeeth = [[-0.5, 0.058, 0.034], [-0.455, 0.058, 0.05], [-0.41, 0.057, 0.07], [-0.37, 0.058, 0.03], [-0.33, 0.059, 0.034], [-0.29, 0.061, 0.03], [-0.25, 0.062, 0.034], [-0.21, 0.064, 0.03], [-0.17, 0.065, 0.032], [-0.13, 0.065, 0.028], [-0.09, 0.066, 0.026], [-0.05, 0.066, 0.024]];
    for (const [x, y, h2] of lowerTeeth) {
      const gr = ctx.createLinearGradient(x, y, x, y - h2);
      gr.addColorStop(0, '#b8a888');
      gr.addColorStop(1, '#f6eedc');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(x - 0.011, y);
      ctx.quadraticCurveTo(x + 0.002, y - h2 * 0.6, x + 0.001, y - h2);
      ctx.lineTo(x + 0.014, y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(40,20,20,0.5)';
      ctx.lineWidth = lwL(0.0015);
      ctx.stroke();
    }
    ctx.restore();

    // ---- 上半个头：吻部 + 颅骨 ----
    const skull = [[0.12, -0.1], [0.05, -0.15], [-0.06, -0.168], [-0.17, -0.162], [-0.27, -0.12], [-0.36, -0.095], [-0.45, -0.07], [-0.53, -0.035], [-0.56, 0.012], [-0.535, 0.04], [-0.4, 0.052], [-0.26, 0.058], [-0.12, 0.062], [0.0, 0.062], [0.09, 0.052], [0.14, 0.0]];
    closedPath(ctx, skull);
    const sg = ctx.createLinearGradient(0, -0.15, 0, 0.07);
    sg.addColorStop(0, mixc(SKIN2, SKIN_HI, 0.35));
    sg.addColorStop(0.45, SKIN2);
    sg.addColorStop(1, SKIN);
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.save();
    ctx.clip();
    if (!lowQ) {
      scaleFill(ctx, -0.7, -0.3, 0.3, 0.2, 0.024, '#000000', 0.34);
      ctx.save();
      ctx.translate(-0.002, -0.003);
      scaleFill(ctx, -0.7, -0.3, 0.3, 0.2, 0.024, SKIN_HI, 0.14);
      ctx.restore();
    }
    // 吻部上缘的受光 + 脸颊的肌肉
    ctx.strokeStyle = rgba(RIM, 0.6);
    ctx.lineWidth = lwL(0.008);
    ctx.beginPath();
    ctx.moveTo(0.06, -0.125);
    ctx.quadraticCurveTo(-0.2, -0.16, -0.36, -0.092);
    ctx.lineTo(-0.5, -0.04);
    ctx.stroke();
    const cg = ctx.createRadialGradient(-0.02, 0.0, 0.01, -0.02, 0.0, 0.14);
    cg.addColorStop(0, rgba(SKIN_HI, 0.3));
    cg.addColorStop(1, rgba(SKIN_HI, 0));
    ctx.fillStyle = cg;
    ctx.fillRect(-0.2, -0.1, 0.4, 0.25);
    // 下缘的阴影（上唇下面一条暗线）
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = lwL(0.012);
    ctx.beginPath();
    ctx.moveTo(-0.52, 0.036);
    ctx.lineTo(0.05, 0.056);
    ctx.stroke();
    // 眼眶后面的暗角、脸颊上的旧伤疤
    ctx.strokeStyle = 'rgba(0,0,0,0.38)';
    ctx.lineWidth = lwL(0.004);
    ctx.beginPath();
    ctx.moveTo(-0.07, -0.03);
    ctx.lineTo(-0.02, 0.03);
    ctx.moveTo(-0.045, -0.04);
    ctx.lineTo(0.0, 0.02);
    ctx.stroke();
    ctx.restore();
    closedPath(ctx, skull);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = lwL(0.0048);
    ctx.stroke();

    // 眉骨：压在眼睛上方的一块凸起的骨板，向后延伸成小角
    ctx.fillStyle = linear(ctx, -0.25, -0.15, 0.0, -0.08, [[0, mixc(SKIN2, BONE_DK, 0.55)], [0.5, mixc(SKIN_HI, BONE_DK, 0.45)], [1, mixc(SKIN2, BONE_DK, 0.6)]]);
    ctx.beginPath();
    ctx.moveTo(-0.27, -0.1);
    ctx.quadraticCurveTo(-0.17, -0.142, -0.05, -0.13);
    ctx.lineTo(0.04, -0.13);
    ctx.quadraticCurveTo(-0.02, -0.095, -0.1, -0.082);
    ctx.quadraticCurveTo(-0.18, -0.078, -0.27, -0.1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = lwL(0.0035);
    ctx.stroke();
    ctx.strokeStyle = rgba('#ffffff', 0.35);
    ctx.lineWidth = lwL(0.0035);
    ctx.beginPath();
    ctx.moveTo(-0.25, -0.115);
    ctx.quadraticCurveTo(-0.16, -0.14, -0.06, -0.128);
    ctx.stroke();
    // 脸颊上的骨刺（颧骨）+ 下颌角的刺
    for (const [x, y, ang, L, w] of [[0.02, 0.0, 0.5, 0.15, 0.022], [0.07, 0.03, 0.9, 0.13, 0.02], [0.0, 0.055, 1.25, 0.1, 0.016]]) {
      claw(ctx, x, y, ang, L, w, BONE, rgba('#ffffff', 0.25));
    }
    // 鼻梁上的小角 + 鼻孔
    claw(ctx, -0.4, -0.065, -1.0, 0.07, 0.014, BONE, null);
    claw(ctx, -0.3, -0.09, -1.15, 0.085, 0.016, BONE, null);
    const nx = -0.475;
    const ny = -0.003;
    ctx.fillStyle = '#0a0306';
    ctx.beginPath();
    ctx.ellipse(nx, ny, 0.016, 0.009, -0.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(RIM, 0.45);
    ctx.lineWidth = lwL(0.003);
    ctx.beginPath();
    ctx.ellipse(nx, ny, 0.02, 0.012, -0.4, 3.4, 5.6);
    ctx.stroke();
    // 鼻孔里的暗红光 + 冒烟
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(nx, ny, 0.035, '#ff6a2a', 0.35 + 0.2 * heat);
    for (let i = 0; i < 4; i++) {
      const w = (t * 0.5 + i / 4) % 1;
      glow(nx - 0.04 - w * 0.12, ny - 0.02 - w * 0.12, 0.02 + w * 0.045, i % 2 ? '#7a6a6a' : '#ffb070', (1 - w) * 0.26);
    }
    ctx.restore();

    // ---- 上排牙：沿上唇，向下，獠牙特别长 ----
    const upperTeeth = [[-0.52, 0.042, 0.03], [-0.48, 0.046, 0.04], [-0.44, 0.05, 0.085], [-0.4, 0.053, 0.032], [-0.36, 0.055, 0.034], [-0.32, 0.057, 0.03], [-0.28, 0.059, 0.034], [-0.24, 0.06, 0.03], [-0.2, 0.062, 0.032], [-0.16, 0.063, 0.028], [-0.12, 0.063, 0.028], [-0.08, 0.063, 0.024], [-0.04, 0.062, 0.022]];
    for (const [x, y, h2] of upperTeeth) {
      const gr = ctx.createLinearGradient(x, y, x, y + h2);
      gr.addColorStop(0, '#b8a888');
      gr.addColorStop(1, '#f8f0de');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(x - 0.012, y);
      ctx.quadraticCurveTo(x - 0.003, y + h2 * 0.65, x - 0.001, y + h2);
      ctx.lineTo(x + 0.014, y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(40,20,20,0.5)';
      ctx.lineWidth = lwL(0.0015);
      ctx.stroke();
    }

    // ---- 眼睛：深深的眼窝里一只带竖瞳的杏仁眼，眼白发黄，虹膜是橙色，带反光 ----
    const ex = -0.15;
    const ey = -0.066;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(ex + 0.005, ey + 0.004, 0.058, 0.032, -0.26, 0, TAU);
    ctx.fill();
    const blink = t % 4.3 > 4.17 || (fallen && rebirth < 0.5);
    const eyePath = () => {
      ctx.beginPath();
      ctx.moveTo(ex - 0.052, ey + 0.012);
      ctx.quadraticCurveTo(ex - 0.01, ey - (blink ? 0.002 : 0.034), ex + 0.054, ey - 0.012);
      ctx.quadraticCurveTo(ex + 0.005, ey + (blink ? 0.004 : 0.026), ex - 0.052, ey + 0.012);
      ctx.closePath();
    };
    eyePath();
    ctx.fillStyle = mixc('#c8a050', '#401020', dark);
    ctx.fill();
    if (!blink) {
      ctx.save();
      eyePath();
      ctx.clip();
      const ig = ctx.createRadialGradient(ex - 0.005, ey, 0.002, ex - 0.005, ey, 0.032);
      ig.addColorStop(0, '#ffffff');
      ig.addColorStop(0.25, EYE);
      ig.addColorStop(1, mixc(EYE, '#401000', 0.7));
      ctx.fillStyle = ig;
      ctx.fillRect(ex - 0.06, ey - 0.04, 0.12, 0.08);
      // 竖瞳
      ctx.fillStyle = '#080204';
      ctx.beginPath();
      ctx.ellipse(ex - 0.003, ey, 0.0055, 0.026, 0.2, 0, TAU);
      ctx.fill();
      // 反光 + 上眼睑的阴影
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(ex - 0.018, ey - 0.012, 0.0045, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(ex - 0.06, ey - 0.04, 0.12, 0.022);
      ctx.restore();
      // 眼睛发光
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ex, ey, 0.075, EYE, 0.38 * eyeGlow);
      ctx.restore();
    }
    eyePath();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = lwL(0.0035);
    ctx.stroke();
    // 鼻吻的高光点
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.ellipse(-0.4, -0.07, 0.03, 0.008, 0.28, 0, TAU);
    ctx.fill();
    ctx.restore();
    void u;
    void rage;
    void SKIN;
  }



  // ================= 主画法 =================
  D.abyssDragon = function (ctx, s, t, o) {
    const ai = o.ai || {};
    const q = poseOf(ai, t);
    const { dark, rage, angry, fallen, rebirth } = q;
    const kind = q.kind;
    const cast = q.stage === 'cast';
    const lw = (v) => Math.max(1, s * v);
    // 画质降档（TD.quality，设计书 55）时省掉最费的几层：鳞片纹理、肌肉高光、翼膜细脉
    const lowQ = !!(TD.quality && TD.quality.params().lit <= 0.5);

    // ---------- 配色：红龙是黑褐的鳞甲 + 铜红的受光面 + 浅黄褐的腹甲 + 深红翼膜 + 岩浆裂纹；黑龙几乎全黑，裂纹和眼睛是血红色 ----------
    const SKIN = mixc(rage ? '#2c1316' : '#251518', '#0b0810', dark);
    const SKIN2 = mixc(rage ? '#552428' : '#52302a', '#1a0f20', dark);
    const SKIN_HI = mixc(rage ? '#c05838' : '#b0693c', '#5a2c6a', dark);
    const BELLY = mixc('#a07048', '#33203a', dark);
    const BELLY_HI = mixc('#d8a878', '#5a3a64', dark);
    const MEMB = mixc('#7a1022', '#3a1240', dark);
    const MEMB_HI = mixc('#e8643a', '#a040a8', dark);
    const BONE = mixc('#d6c2a0', '#a88cae', dark);
    const BONE_DK = mixc('#7a6248', '#4a3858', dark);
    const RIM = mixc('#ffa868', '#ff5a8a', dark);
    const LAVA = dark > 0.5 ? '#ff2a5a' : rage ? '#ffd060' : '#ff8a2a';
    const tone = kind === 'ice' ? '#7fd0ff' : kind === 'bolt' ? '#8fb4ff' : kind === 'fire' ? '#ffb040' : null;
    const toneA = q.stage ? (cast ? 1 : q.k) : 0;
    const EYE = kind === 'ice' ? '#bfeaff' : kind === 'bolt' ? '#dfeaff' : mixc(rage ? '#fff0c0' : '#ffb830', '#ff4a50', dark);
    const heat = (fallen ? 0.1 + 0.9 * rebirth * rebirth : 0.42 + (angry ? 0.2 : 0) + (rage ? 0.25 : 0) + (kind === 'fire' ? 0.5 * toneA : 0)) + (dark > 0.5 ? 0.2 : 0);
    const eyeGlow = fallen ? 0.15 + 0.85 * rebirth * rebirth : 1;
    const OUT = 'rgba(8,4,10,0.85)';

    ctx.save();
    ctx.scale(ART, ART);
    ctx.translate(q.dashX * s, (q.bob + 0.12 + q.bodyY + q.lift) * s);

    // 背光：身体是深色的，要靠光把轮廓从紫黑的背景里托出来
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0.05 * s, -0.12 * s, s * 1.25, tone && toneA > 0.3 ? tone : dark > 0.5 ? '#ff1a4a' : '#ff4a1a', 0.1 + 0.12 * Math.min(1, heat) + 0.1 * toneA);
    ctx.restore();
    // 地面上的影子：龙悬在半空，影子落在地上，升空时影子变小变淡；冲撞时跟着龙一起滑
    ctx.save();
    ctx.globalAlpha = Math.max(0.12, 0.4 + q.lift * 0.5);
    shadow(ctx, s * (0.1 + q.dashX), s * 0.55 - (q.bob + q.bodyY + q.lift) * s, s * (0.95 + q.lift * 0.3));
    ctx.restore();

    // 冲撞的速度线：龙身后拖出一串斜着的亮线（俯冲的方向）
    if (q.speed > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const rr = seeded(3);
      for (let i = 0; i < 20; i++) {
        const y = (-0.6 + rr() * 1.25) * s;
        const x0 = (0.1 + rr() * 0.8) * s;
        const L = (0.4 + rr() * 1.0) * s * q.speed;
        const slope = 0.35; // 往右上方拖：龙是向左下俯冲的
        ctx.strokeStyle = linear(ctx, x0, y, x0 + L, y - L * slope, [[0, 'rgba(255,210,150,0.75)'], [1, 'rgba(255,120,60,0)']]);
        ctx.lineWidth = lw(0.006 + rr() * 0.012);
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + L, y - L * slope);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (q.impact > 0.02) {
      // 撞上的一瞬间：龙头前面一团炸开的光
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, -1.55 * s, 0.1 * s, s * 0.7 * q.impact, '#fff0d0', 0.9 * q.impact, true);
      glow(ctx, -1.45 * s, 0.1 * s, s * 1.2 * q.impact, '#ff9a50', 0.5 * q.impact);
      ctx.restore();
    }

    ctx.rotate(q.pitch);

    // ================= 骨架 =================
    const g = headGeometry(q);
    const sw1 = Math.sin(t * 0.9) * 0.012;
    const sw2 = Math.sin(t * 0.9 - 0.7) * 0.02;
    const breathe = 0.04 * q.breath + 0.07 * q.chest;
    const tw = (k) => Math.sin(q.ph * 0.6 - k * 1.3) * 0.032 * k * (1 + q.tail * 0.9) - q.tail * 0.05 * k;
    const spinePts = [
      [g.hx + 0.06, g.hy + 0.02, 0.085, 0.08],
      [-0.88 + q.hdx * 0.8 + sw2, -0.57 + q.hdy * 0.85, 0.125, 0.13],
      [-0.76 + q.hdx * 0.5 + sw1 * 1.4, -0.49 + q.hdy * 0.55, 0.15, 0.165],
      [-0.635 + q.hdx * 0.22 + sw1, -0.35 + q.hdy * 0.22, 0.18, 0.2],
      [-0.5, -0.19, 0.21, 0.24],
      [-0.34, -0.05, 0.23, 0.3 + breathe],
      [-0.14, -0.03, 0.225, 0.3 + breathe],
      [0.08, -0.04, 0.17, 0.2],
      [0.31, -0.05, 0.185, 0.2],
      [0.55, -0.01 + tw(0.2), 0.15, 0.145],
      [0.82, 0.05 + tw(0.5), 0.095, 0.09],
      [1.12, 0.1 + tw(0.8), 0.055, 0.05],
      [1.52, 0.07 + tw(1.1), 0.016, 0.015],
    ].map((p) => [p[0] * s, p[1] * s, p[2] * s, p[3] * s]);
    const S = spline(spinePts, 120);
    const E = edges(S, 1);

    // ================= 翅膀 =================
    const wingU = (f, hold) => clamp(lerp(0.5 + 0.5 * f, 0.92, clamp(hold + q.raise * 0.4)));
    const drawWing = (near) => {
      const f = near ? q.flap : q.flap2;
      const lg = near ? q.lag : q.lag2;
      const u = wingU(f, q.hold);
      const lagU = wingU(lg, q.hold);
      const sx = (near ? -0.2 : -0.12) * s;
      const sy = (near ? -0.25 : -0.28) * s;
      const R = wingRig(sx / s, sy / s, u, lagU, q.fold, s);
      const m = (a) => [a[0] * s, a[1] * s];
      const Sp = m(R.S);
      const Ep = m(R.E);
      const Wp = m(R.W);
      const F = R.fingers.map((f2) => ({ J: m(f2.J), T: m(f2.T), ang: f2.ang }));
      const shade = near ? 1 : 0.62;
      const mc = (c) => (near ? c : mixc(c, '#06030a', 0.45));
      // 翼膜：前缘沿臂骨到腕，再沿四根指骨的末端连成扇贝形的后缘，最后回到腰侧
      const body = [0.34 * s, -0.2 * s];
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(Sp[0], Sp[1]);
      ctx.lineTo(Ep[0], Ep[1]);
      ctx.lineTo(Wp[0], Wp[1]);
      ctx.lineTo(F[0].T[0], F[0].T[1]);
      const scallop = (a, b, pull) => {
        const mx = (a[0] + b[0]) / 2;
        const my = (a[1] + b[1]) / 2;
        ctx.quadraticCurveTo(mx + (Wp[0] - mx) * pull, my + (Wp[1] - my) * pull, b[0], b[1]);
      };
      scallop(F[0].T, F[1].T, 0.26);
      scallop(F[1].T, F[2].T, 0.26);
      scallop(F[2].T, F[3].T, 0.26);
      scallop(F[3].T, body, 0.18);
      ctx.lineTo(Sp[0] + 0.02 * s, Sp[1] + 0.04 * s);
      ctx.closePath();
      const mg = ctx.createRadialGradient(Wp[0], Wp[1], s * 0.04, Wp[0], Wp[1], s * 1.1);
      mg.addColorStop(0, rgba(mc(MEMB), 0.98));
      mg.addColorStop(0.55, rgba(mc(mixc(MEMB, MEMB_HI, 0.35)), 0.93));
      mg.addColorStop(1, rgba(mc(mixc(MEMB, MEMB_HI, 0.7)), 0.82));
      ctx.fillStyle = mg;
      ctx.fill();
      ctx.save();
      ctx.clip();
      // 每两根指骨之间是一格：靠骨头的两边深、中间浅，像绷紧的皮膜；再沿格子中线画一道淡淡的褶皱
      for (let i = 0; i < 3; i++) {
        const a = F[i].T;
        const b = F[i + 1].T;
        const mx = (a[0] + b[0]) / 2;
        const my = (a[1] + b[1]) / 2;
        const cx = mx + (Wp[0] - mx) * 0.26;
        const cy = my + (Wp[1] - my) * 0.26;
        ctx.beginPath();
        ctx.moveTo(Wp[0], Wp[1]);
        ctx.lineTo(a[0], a[1]);
        ctx.quadraticCurveTo(cx, cy, b[0], b[1]);
        ctx.closePath();
        const cg = ctx.createLinearGradient(Wp[0], Wp[1], mx, my);
        cg.addColorStop(0, rgba(mc(mixc(MEMB, '#000000', 0.35)), 0.55));
        cg.addColorStop(0.55, rgba(mc(mixc(MEMB, MEMB_HI, 0.25)), 0.18));
        cg.addColorStop(1, rgba(mc(mixc(MEMB, MEMB_HI, 0.6)), 0.4));
        ctx.fillStyle = cg;
        ctx.fill();
        if (!lowQ) {
          ctx.strokeStyle = rgba(mc(MEMB_HI), 0.18 * shade);
          ctx.lineWidth = lw(0.008);
          ctx.beginPath();
          ctx.moveTo(Wp[0], Wp[1]);
          ctx.quadraticCurveTo((Wp[0] + mx) / 2 + (b[1] - a[1]) * 0.05, (Wp[1] + my) / 2 - (b[0] - a[0]) * 0.05, mx, my);
          ctx.stroke();
        }
      }
      // 透光：膜被背后的光照亮，靠近指骨处更亮
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, (Wp[0] + F[2].T[0]) / 2, (Wp[1] + F[2].T[1]) / 2, s * 0.55, MEMB_HI, 0.09 * shade * (0.6 + 0.4 * heat));
      ctx.globalCompositeOperation = 'source-over';
      if (!lowQ) {
        // 膜上的细脉：指骨之间一根根分叉的血管
        ctx.strokeStyle = rgba(mc(mixc(MEMB, '#000000', 0.5)), 0.5);
        ctx.lineWidth = lw(0.0035);
        const rr = seeded(near ? 31 : 37);
        for (let i = 0; i < 3; i++) {
          for (const fr of [0.35, 0.55, 0.75, 0.92]) {
            const a = [lerp(Wp[0], F[i].T[0], fr), lerp(Wp[1], F[i].T[1], fr)];
            const b = [lerp(Wp[0], F[i + 1].T[0], fr), lerp(Wp[1], F[i + 1].T[1], fr)];
            const mid = [(a[0] + b[0]) / 2 + (rr() - 0.5) * 0.03 * s + (Wp[0] - (a[0] + b[0]) / 2) * 0.1, (a[1] + b[1]) / 2 + (rr() - 0.5) * 0.03 * s + (Wp[1] - (a[1] + b[1]) / 2) * 0.1];
            ctx.beginPath();
            ctx.moveTo(a[0], a[1]);
            ctx.quadraticCurveTo(mid[0], mid[1], b[0], b[1]);
            ctx.stroke();
          }
        }
        // 前缘到身体的几条放射脉
        for (let i = 0; i < 4; i++) {
          const b = [lerp(Sp[0], body[0], i / 3), lerp(Sp[1], body[1], i / 3)];
          ctx.beginPath();
          ctx.moveTo(Wp[0], Wp[1]);
          ctx.quadraticCurveTo((Wp[0] + b[0]) / 2, (Wp[1] + b[1]) / 2 - 0.04 * s, b[0], b[1]);
          ctx.stroke();
        }
        // 撕裂的小口子和补过的旧伤
        ctx.strokeStyle = rgba(mc('#1a0408'), 0.7);
        ctx.lineWidth = lw(0.006);
        for (const [fi, fr, len] of [[1, 0.9, 0.07], [2, 0.88, 0.05]]) {
          const a = [lerp(Wp[0], F[fi].T[0], fr), lerp(Wp[1], F[fi].T[1], fr)];
          const b = [lerp(Wp[0], F[fi + 1].T[0], fr), lerp(Wp[1], F[fi + 1].T[1], fr)];
          const c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          ctx.beginPath();
          ctx.moveTo(c[0], c[1]);
          ctx.lineTo(c[0] + (Wp[0] - c[0]) * len * 3, c[1] + (Wp[1] - c[1]) * len * 3);
          ctx.stroke();
        }
      }
      ctx.restore();
      // 后缘一圈被光照亮的薄边
      ctx.strokeStyle = rgba(mc(MEMB_HI), 0.55 * shade);
      ctx.lineWidth = lw(0.005);
      ctx.beginPath();
      ctx.moveTo(F[0].T[0], F[0].T[1]);
      scallop(F[0].T, F[1].T, 0.26);
      scallop(F[1].T, F[2].T, 0.26);
      scallop(F[2].T, F[3].T, 0.26);
      scallop(F[3].T, body, 0.18);
      ctx.stroke();
      ctx.restore();

      // 骨：肱骨 → 前臂（粗）→ 腕 → 四根指骨（细，各有一个关节）
      const BN = mc(BONE_DK);
      const BH = mc(mixc(BONE, BONE_DK, 0.35));
      ctx.save();
      ctx.lineJoin = 'round';
      taper(ctx, Sp, Ep, lw(0.036), lw(0.03), mc(mixc(SKIN2, '#000000', 0.2)), rgba(mc(SKIN_HI), 0.6));
      taper(ctx, Ep, Wp, lw(0.03), lw(0.02), mc(mixc(SKIN2, '#000000', 0.2)), rgba(mc(SKIN_HI), 0.6));
      for (let i = 0; i < 4; i++) {
        const fw = lw(0.014 - i * 0.0016);
        taper(ctx, Wp, F[i].J, fw * 1.15, fw * 0.8, BN, rgba(BH, 0.7));
        taper(ctx, F[i].J, F[i].T, fw * 0.8, fw * 0.3, BN, rgba(BH, 0.6));
        ctx.fillStyle = BH;
        ctx.beginPath();
        ctx.arc(F[i].J[0], F[i].J[1], fw * 0.8, 0, TAU);
        ctx.fill();
        // 指尖的小钩爪
        claw(ctx, F[i].T[0], F[i].T[1], F[i].ang + 0.4, lw(0.04), lw(0.007), mc(BONE), null);
      }
      // 关节处的突起
      for (const jp of [Ep, Wp]) {
        ctx.fillStyle = mc(mixc(SKIN2, SKIN_HI, 0.3));
        ctx.beginPath();
        ctx.arc(jp[0], jp[1], lw(0.026), 0, TAU);
        ctx.fill();
        ctx.strokeStyle = OUT;
        ctx.lineWidth = lw(0.004);
        ctx.stroke();
      }
      // 腕上的拇指爪（朝前）
      claw(ctx, Wp[0], Wp[1], F[0].ang - 0.9, lw(0.13), lw(0.016), mc(BONE), rgba(mc(BONE_DK), 0.7));
      ctx.restore();
      return { tips: F.map((f2) => f2.T), W: Wp };
    };

    // 远侧翅膀（在身体后面，更暗）
    const farWing = drawWing(false);

    // ================= 肢体 =================
    // 一条腿：关节点列表（单位 s），每点 [x, y, 半宽]；legs: -1 蜷起 … 0 自然 … 1 前伸
    const hindBase = [[0.3, -0.03, 0.15], [0.21, 0.17, 0.095], [0.34, 0.34, 0.052], [0.27, 0.47, 0.04], [0.18, 0.54, 0.036]];
    const hindTuck = [[0.3, -0.03, 0.15], [0.12, 0.1, 0.1], [0.36, 0.13, 0.05], [0.26, 0.22, 0.04], [0.12, 0.23, 0.035]];
    const hindFwd = [[0.3, -0.03, 0.15], [0.06, 0.13, 0.095], [-0.12, 0.22, 0.052], [-0.3, 0.3, 0.04], [-0.42, 0.34, 0.036]];
    const foreBase = [[-0.24, -0.02, 0.115], [-0.3, 0.15, 0.072], [-0.2, 0.29, 0.045], [-0.3, 0.41, 0.04], [-0.37, 0.47, 0.036]];
    const foreTuck = [[-0.24, -0.02, 0.115], [-0.18, 0.12, 0.07], [-0.34, 0.14, 0.045], [-0.26, 0.22, 0.04], [-0.38, 0.24, 0.036]];
    const foreFwd = [[-0.24, -0.02, 0.115], [-0.4, 0.1, 0.07], [-0.6, 0.16, 0.045], [-0.76, 0.22, 0.04], [-0.88, 0.26, 0.036]];
    const poseLeg = (base, tuck, fwd) => {
      const a = q.legs < 0 ? tuck : fwd;
      const w = Math.abs(q.legs);
      return base.map((p, i) => [lerp(p[0], a[i][0], w), lerp(p[1], a[i][1], w), p[2]]);
    };
    const limb = (pts, near, toes, sway) => {
      const P = pts.map((p, i) => [p[0] * s + (i >= 2 ? sway * s : 0), p[1] * s, p[2] * s, p[2] * s]);
      const Sl = spline(P, 36);
      const dim = near ? 0 : 0.5;
      const fill = linear(ctx, 0, P[0][1] - 0.1 * s, 0, P[P.length - 1][1], [[0, mixc(SKIN2, '#000000', dim)], [1, mixc(SKIN, '#000000', dim)]]);
      ctx.save();
      ribbonPath(ctx, Sl, 1);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.save();
      ctx.clip();
      if (!lowQ) scaleFill(ctx, -1.5 * s, -0.2 * s, 1.5 * s, 0.9 * s, s * 0.04, mixc(SKIN_HI, '#000000', dim), 0.28);
      // 受光的一面（上 / 前缘）：一条亮边 + 大腿肌肉的高光
      ctx.strokeStyle = rgba(mixc(SKIN_HI, '#000000', dim), near ? 0.5 : 0.25);
      ctx.lineWidth = lw(0.012);
      polyline(ctx, E2(Sl).top);
      ctx.stroke();
      glow(ctx, P[0][0] + 0.02 * s, P[0][1] + 0.08 * s, s * 0.12, SKIN_HI, near ? 0.22 : 0.08);
      ctx.restore();
      ribbonPath(ctx, Sl, 1);
      ctx.strokeStyle = OUT;
      ctx.lineWidth = lw(0.005);
      ctx.stroke();
      // 膝 / 腕的关节鼓包
      ctx.fillStyle = mixc(SKIN2, '#000000', dim);
      for (const idx of [1, 2]) {
        ctx.beginPath();
        ctx.ellipse(P[idx][0], P[idx][1], lw(0.03), lw(0.03), 0, 0, TAU);
        ctx.fill();
      }
      // 脚趾 + 爪
      const foot = P[P.length - 1];
      const dir = Math.atan2(foot[1] - P[P.length - 2][1], foot[0] - P[P.length - 2][0]);
      for (let i = 0; i < toes; i++) {
        const a = dir + (i - (toes - 1) / 2) * 0.42 + 0.18;
        const L = s * (0.085 - Math.abs(i - (toes - 1) / 2) * 0.012);
        const tip = [foot[0] + Math.cos(a) * L, foot[1] + Math.sin(a) * L];
        taper(ctx, foot, tip, lw(0.026), lw(0.016), mixc(SKIN, '#000000', dim), null);
        claw(ctx, tip[0], tip[1], a + 0.5, lw(0.07), lw(0.012), mixc(BONE, '#000000', dim), rgba(mixc(BONE_DK, '#000000', dim), 0.7));
      }
      // 后爪
      claw(ctx, foot[0] - 0.01 * s, foot[1] - 0.01 * s, dir + 2.5, lw(0.05), lw(0.01), mixc(BONE, '#000000', dim), null);
      ctx.restore();
    };
    const E2 = (S2) => edges(S2, 1);
    const swing = Math.sin(q.ph * 0.5) * 0.012;

    // 远侧的腿（身体后面、更暗）
    limb(poseLeg(hindBase, hindTuck, hindFwd).map((p) => [p[0] + 0.1, p[1] - 0.02, p[2] * 0.9]), false, 3, -swing);
    limb(poseLeg(foreBase, foreTuck, foreFwd).map((p) => [p[0] + 0.07, p[1] - 0.03, p[2] * 0.9]), false, 3, swing);

    // ================= 躯干 + 脖子 + 尾巴：一个连续的轮廓 =================
    ctx.save();
    ribbonPath(ctx, S, 1);
    const bodyG = ctx.createLinearGradient(0, -0.62 * s, 0, 0.36 * s);
    bodyG.addColorStop(0, mixc(SKIN2, SKIN_HI, 0.25));
    bodyG.addColorStop(0.3, SKIN2);
    bodyG.addColorStop(0.62, SKIN);
    bodyG.addColorStop(1, mixc(SKIN, BELLY, 0.45));
    ctx.fillStyle = bodyG;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // 腹甲：沿下缘的一带浅色的宽鳞，一块一块的
    ctx.fillStyle = linear(ctx, 0, -0.1 * s, 0, 0.3 * s, [[0, rgba(BELLY, 0)], [1, rgba(BELLY, 0.85)]]);
    ctx.beginPath();
    E.bot.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    for (let i = E.bot.length - 1; i >= 0; i--) {
      const sp = S[i];
      const depth = (i < 8 ? 0.035 : i < 46 ? 0.075 : 0.07) * s * (1 - i / 140);
      ctx.lineTo(E.bot[i][0] - sp.ty * -depth * 0 + sp.ty * 0, E.bot[i][1] - depth);
    }
    ctx.closePath();
    ctx.fill();
    if (!lowQ) {
      // 鳞：三个区域（脖子细、躯干大、尾巴渐小），暗纹 + 错开一点的亮边
      const sizeOf = [[-1.3, -0.45, 0.034], [-0.45, 0.45, 0.056], [0.45, 1.7, 0.04]];
      for (const [x0, x1, sz] of sizeOf) skinFill(ctx, x0 * s, -0.8 * s, x1 * s, 0.5 * s, s * sz, SKIN_HI, '#000000', 0.9);
    }
    // 腹甲的横纹
    ctx.strokeStyle = rgba(BELLY_HI, 0.35);
    ctx.lineWidth = lw(0.0035);
    for (let i = 14; i < 100; i += 3) {
      const sp = S[i];
      const bx = E.bot[i][0];
      const by = E.bot[i][1];
      const dlen = (i < 80 ? 0.075 : 0.04) * s;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - sp.ty * dlen * 0.2 + 0, by - dlen);
      ctx.stroke();
    }
    // 肌肉：肩、大腿根、脖子上的两条筋
    if (!lowQ) {
      const bulge = (cx, cy, rx, ry, rot, a) => {
        const gr = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.4, 1, cx, cy, Math.max(rx, ry));
        gr.addColorStop(0, rgba(SKIN_HI, a));
        gr.addColorStop(1, rgba(SKIN_HI, 0));
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, rot, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = rgba('#000000', a * 0.7);
        ctx.lineWidth = lw(0.005);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx * 0.95, ry * 0.95, rot, 0.5, 2.6);
        ctx.stroke();
      };
      bulge(-0.26 * s, -0.05 * s, 0.15 * s, 0.17 * s, 0.3, 0.42); // 肩
      bulge(0.3 * s, -0.01 * s, 0.17 * s, 0.17 * s, -0.2, 0.4); // 臀腿
      bulge(-0.1 * s, -0.09 * s, 0.14 * s, 0.11 * s, 0, 0.18); // 背肌
      ctx.strokeStyle = rgba('#000000', 0.32);
      ctx.lineWidth = lw(0.006);
      for (const off of [-0.35, 0.3]) {
        ctx.beginPath();
        for (let i = 6; i < 40; i++) {
          const sp = S[i];
          const cx = sp[0] + sp.ty * sp[2] * off;
          const cy = sp[1] - sp.tx * sp[2] * off;
          i === 6 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      }
    }
    // 岩浆裂纹：沿着身体的几条发光细缝
    ctx.globalCompositeOperation = 'lighter';
    const rr = seeded(7);
    const crackCol = LAVA;
    for (let i = 0; i < 9; i++) {
      const sp = S[18 + Math.floor(rr() * 78)];
      const side = rr() * 2 - 1;
      const x0 = sp[0] + sp.ty * sp[2] * side * 0.8;
      const y0 = sp[1] - sp.tx * sp[2] * side * 0.8;
      const ang = rr() * TAU;
      const len = (0.05 + rr() * 0.11) * s;
      const pts = jag(x0, y0, x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len, 40 + i, 0.04 * s, 3);
      ctx.strokeStyle = rgba(crackCol, (0.4 + 0.35 * heat) * (0.7 + 0.3 * Math.sin(t * 2.2 + i)));
      ctx.lineWidth = lw(0.005);
      polyline(ctx, pts);
      ctx.stroke();
      ctx.strokeStyle = rgba('#fff0b0', 0.35 * heat);
      ctx.lineWidth = lw(0.002);
      polyline(ctx, pts);
      ctx.stroke();
    }
    // 胸口的光：蓄力、喷火时胸腔里透出来
    if (q.chest > 0.02 || kind === 'fire') {
      const cc = kind === 'ice' ? '#7fd0ff' : kind === 'bolt' ? '#8fb4ff' : '#ff7a2a';
      glow(ctx, -0.3 * s, -0.02 * s, s * (0.22 + 0.1 * q.chest), cc, 0.35 * Math.max(q.chest, toneA));
    }
    ctx.globalCompositeOperation = 'source-over';
    // 立体感：下缘一圈暗，上缘一道受光的亮边
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = lw(0.085);
    ctx.lineJoin = 'round';
    polyline(ctx, E.bot);
    ctx.stroke();
    ctx.strokeStyle = rgba(RIM, 0.62);
    ctx.lineWidth = lw(0.012);
    polyline(ctx, E.top);
    ctx.stroke();
    ctx.restore();
    ribbonPath(ctx, S, 1);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = lw(0.0065);
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();

    // ---------- 背上的骨刺：肩背最大，脖子上密而小，尾巴渐小 ----------
    {
      const sizeAt = (i) => {
        const x = S[i][0] / s;
        if (x < -0.55) return 0.04 + 0.01 * Math.sin(i);
        if (x < 0.05) return 0.07 + 0.045 * (1 - Math.abs(x + 0.25) / 0.35);
        return Math.max(0.018, 0.06 * (1 - (x - 0.05) / 1.2));
      };
      let lastX = -1e9;
      let lastY = -1e9;
      for (let i = 6; i < 118; i++) {
        const sp = S[i];
        const h = sizeAt(i) * s;
        const bx = E.top[i][0];
        const by = E.top[i][1];
        // 沿轮廓走过一定长度才画下一根（弯得厉害的脖子上不会挤成一团）
        if (Math.hypot(bx - lastX, by - lastY) < h * 0.78) continue;
        lastX = bx;
        lastY = by;
        const nx = sp.ty; // 向上的法线（切线左手边）
        const ny = -sp.tx;
        const lean = 0.35; // 向后（朝尾巴）倒
        const tx = bx + nx * h + sp.tx * h * lean;
        const ty = by + ny * h + sp.ty * h * lean;
        const bw = h * 0.4;
        const gr = ctx.createLinearGradient(bx, by, tx, ty);
        gr.addColorStop(0, BONE_DK);
        gr.addColorStop(1, BONE);
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.moveTo(bx - sp.tx * bw, by - sp.ty * bw);
        ctx.lineTo(tx, ty);
        ctx.lineTo(bx + sp.tx * bw, by + sp.ty * bw);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = OUT;
        ctx.lineWidth = lw(0.003);
        ctx.stroke();
      }
    }
    // 尾尖的刃
    {
      const tip = S[119];
      const base = S[112];
      const ang = Math.atan2(tip.ty, tip.tx);
      ctx.save();
      ctx.translate(tip[0], tip[1]);
      ctx.rotate(ang);
      const L = 0.2 * s;
      const W2 = 0.07 * s;
      ctx.fillStyle = linear(ctx, 0, 0, L, 0, [[0, BONE_DK], [0.6, BONE], [1, '#f4ead0']]);
      ctx.beginPath();
      ctx.moveTo(-0.01 * s, 0);
      ctx.quadraticCurveTo(L * 0.3, -W2 * 1.1, L, 0);
      ctx.quadraticCurveTo(L * 0.3, W2 * 1.1, -0.01 * s, 0);
      ctx.fill();
      ctx.strokeStyle = OUT;
      ctx.lineWidth = lw(0.004);
      ctx.stroke();
      ctx.strokeStyle = rgba('#ffffff', 0.35);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(L * 0.9, 0);
      ctx.stroke();
      ctx.restore();
      void base;
    }

    // 大腿 / 肩的肌肉块：压在躯干上，让腿看起来是从一团肌肉里长出来的
    if (!lowQ) {
      const mass = (cx, cy, rx, ry, rot) => {
        // 先在躯干上落一圈暗影（接触阴影），再画受光的肌肉块
        ctx.save();
        ctx.translate(cx * s, cy * s);
        ctx.rotate(rot);
        const ao = ctx.createRadialGradient(0, 0, rx * s * 0.6, 0, 0, rx * s * 1.35);
        ao.addColorStop(0, 'rgba(0,0,0,0.45)');
        ao.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = ao;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx * s * 1.35, ry * s * 1.3, 0, 0, TAU);
        ctx.fill();
        const gr = ctx.createRadialGradient(-rx * s * 0.35, -ry * s * 0.45, 2, 0, 0, Math.max(rx, ry) * s);
        gr.addColorStop(0, mixc(SKIN2, SKIN_HI, 0.55));
        gr.addColorStop(0.6, SKIN2);
        gr.addColorStop(1, SKIN);
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.ellipse(0, 0, rx * s, ry * s, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(8,4,10,0.7)';
        ctx.lineWidth = lw(0.006);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx * s, ry * s, 0, 0.3, 3.0);
        ctx.stroke();
        ctx.strokeStyle = rgba(RIM, 0.35);
        ctx.lineWidth = lw(0.006);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx * s, ry * s, 0, 3.5, 5.6);
        ctx.stroke();
        scaleFill(ctx, -rx * s, -ry * s, rx * s, ry * s, s * 0.05, '#000000', 0.22);
        ctx.restore();
      };
      mass(0.29, 0.05, 0.16, 0.2, -0.3);
      mass(-0.27, 0.04, 0.12, 0.17, 0.25);
    }
    // 近侧的腿（盖在身体前面）
    limb(poseLeg(hindBase, hindTuck, hindFwd), true, 3, swing);
    limb(poseLeg(foreBase, foreTuck, foreFwd), true, 3, -swing);

    // 近侧的翅膀
    const nearWing = drawWing(true);

    // ================= 头 =================
    drawDragonHead(ctx, s, t, q, g, { SKIN, SKIN2, SKIN_HI, BELLY, BONE, BONE_DK, RIM, EYE, eyeGlow, dark, rage, heat, lowQ, OUT, kind, toneA, cast, fallen, rebirth });

    // ================= 技能特效 =================
    const mouth = [g.mouthX * s, (g.mouthY - 0.12) * s];
    const jetAng = Math.PI - 0.1 + q.hang * 0.6;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (kind === 'fire') {
      if (q.stage === 'warn') glow(ctx, mouth[0] + 0.02 * s, mouth[1], s * (0.1 + 0.3 * q.k), '#ffd070', 0.3 + 0.5 * q.k, true);
      else flameJet(ctx, mouth[0], mouth[1], jetAng, 1.45 * s, 0.34 * s, t, q.jet);
    } else if (kind === 'ice') {
      if (q.stage === 'warn') {
        for (let i = 0; i < 7; i++) {
          const u = (t * 0.6 + i / 7) % 1;
          glow(ctx, mouth[0] - u * 0.25 * s, mouth[1] + u * 0.12 * s, s * (0.05 + u * 0.1), '#bfe8ff', (1 - u) * 0.35 * q.k);
        }
        glow(ctx, mouth[0], mouth[1], s * (0.08 + 0.2 * q.k), '#9fdcff', 0.25 + 0.5 * q.k, true);
      } else iceJet(ctx, mouth[0], mouth[1], jetAng, 1.45 * s, 0.34 * s, t, q.jet);
    } else if (kind === 'bolt') {
      const orbX = mouth[0] + 0.05 * s;
      const orbY = mouth[1] - 0.5 * s;
      if (q.orb > 0.02) {
        const R = s * (0.05 + 0.07 * q.orb);
        glow(ctx, orbX, orbY, R * 3.2, '#6a90ff', 0.28 * q.orb);
        glow(ctx, orbX, orbY, R * 1.8, '#bfd4ff', 0.5 * q.orb);
        glow(ctx, orbX, orbY, R * 0.9, '#ffffff', 0.85 * q.orb);
        ctx.strokeStyle = rgba('#dfeaff', 0.8 * q.orb);
        ctx.lineWidth = lw(0.006);
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(orbX, orbY, R * (1.3 + i * 0.45), t * (3 + i) + i * 2, t * (3 + i) + i * 2 + 1.6);
          ctx.stroke();
        }
      }
      const fr = Math.floor(t * 14);
      const n = 2 + Math.round((cast ? 1 : q.k) * 5);
      const tipList = [...nearWing.tips, ...farWing.tips];
      for (let i = 0; i < n; i++) {
        const [tx, ty] = tipList[i % tipList.length];
        veins(ctx, tx, ty, 0.24 * s, -1.6 + (i % 3) * 0.5, 2, '#bfe4ff', 0.5 + 0.4 * (cast ? 1 : q.k), fr * 5 + i * 11, s * 0.014);
      }
      if (q.beam > 0.02) {
        const fr2 = Math.floor(t * 18);
        const x1 = mouth[0] - 1.7 * s;
        const y1 = mouth[1] + 0.16 * s;
        const main = jag(mouth[0], mouth[1], x1, y1, fr2 * 3 + 1, 0.28 * s, 5);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        for (const [wd, col, al] of [[0.05, '#5a7aff', 0.22], [0.022, '#9fc0ff', 0.55], [0.008, '#ffffff', 0.95]]) {
          ctx.strokeStyle = rgba(col, al * q.beam);
          ctx.lineWidth = wd * s;
          polyline(ctx, main);
          ctx.stroke();
        }
        for (let b = 0; b < 3; b++) {
          const at = main[Math.floor(main.length * (0.25 + b * 0.22))];
          const br = jag(at[0], at[1], at[0] - (0.25 + b * 0.05) * s, at[1] + (b % 2 ? 0.3 : -0.25) * s, fr2 * 5 + b, 0.14 * s, 4);
          ctx.strokeStyle = rgba('#cfe0ff', 0.7 * q.beam);
          ctx.lineWidth = lw(0.006);
          polyline(ctx, br);
          ctx.stroke();
        }
        glow(ctx, mouth[0], mouth[1], s * 0.2, '#bfd4ff', 0.7 * q.beam);
        glow(ctx, x1, y1, s * 0.3, '#8fb4ff', 0.5 * q.beam);
      }
    }
    // 狂暴 / 黑龙 / 重生：身上裹着一层光，冒火星
    if (rage || dark > 0.5 || fallen) {
      const rc = dark > 0.5 ? '#ff1a4a' : '#ff3a1a';
      glow(ctx, 0, -0.1 * s, s * 1.1, rc, fallen ? 0.04 + 0.2 * rebirth : 0.1 + 0.05 * Math.sin(t * 6) + (rage ? 0.05 : 0));
      const r2 = seeded(17);
      for (let i = 0; i < (rage ? 12 : 6); i++) {
        const u = (t * 0.7 + r2()) % 1;
        const px = (r2() - 0.5) * 1.8 * s;
        const py = -0.1 * s - u * 0.6 * s;
        ctx.globalAlpha = (1 - u) * 0.8 * (fallen ? 0.4 + 0.6 * rebirth : 1);
        glow(ctx, px, py, s * 0.015 * (1 + r2()), i % 2 ? '#ffb040' : '#ff5a2a', 0.9);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (dark > 0.5 || fallen) {
      // 黑龙 / 倒下的龙身上不断升起的黑烟（普通叠加，不发光）
      const r3 = seeded(23);
      for (let i = 0; i < 8; i++) {
        const u = (t * 0.35 + r3()) % 1;
        const px = (-0.5 + r3() * 1.3) * s;
        const py = (-0.1 - u * 0.7) * s;
        glow(ctx, px, py, s * (0.06 + u * 0.1), '#12081a', (1 - u) * 0.3 * (fallen ? 0.5 + 0.5 * (1 - rebirth) : 1));
      }
    }

    ctx.restore();
  };
})((globalThis.TD = globalThis.TD || {}));
