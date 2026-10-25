// 深渊回响（第 11–20 章）的终章 Boss：焚天巨龙 / 灭世黑龙（设计书 114、115、121）
// 西方神话里的巨龙，侧面像，朝左（城墙方向），悬在半空。纯矢量绘制，动作和技能特效都是程序生成的：
//   · 身体：脖子 + 躯干 + 尾巴是同一条脊柱曲线（Catmull-Rom）按粗细剖面生成的连续轮廓；背甲、腹甲、鳞片、岩浆裂纹、脊刺、颈蹼；
//   · 翅膀：臂骨三节 + 四根指骨 + 扇贝形翼膜，扇动时指骨比臂骨慢半拍；技能时可以高举 / 收拢到背后 / 垂下；
//   · 头：眉骨、獠牙、舌头、双角、颊刺、鼻孔喷烟、会眨的竖瞳眼，下颌随技能张开；
//   · 四个技能各有"蓄力 → 释放"两段专属动作和特效：喷火（后仰 → 前扑喷出火焰）、冲撞（蹲伏 → 收翅冲刺）、
//     雷击（举翅聚雷球 → 放出闪电）、寒冰（吸气结霜 → 喷出冰晶）；
//   · 红 / 黑两种形态（ai.form），倒下 → 重生的过渡，狂暴的火星和红光。
// 坐标约定同 creatures.js：s 是 def.size，原点 = 身体中心（不是脚下），向上为负；整条龙宽约 2.5 s，翼尖高约 0.75 s。
// 状态（o.ai）：mode === 'warn' 时按 skill 和蓄力进度 warnTimer / warnMax 做预备动作；anim / animTimer 是技能释放期间；
// phase 2 发怒、phase 3 狂暴；fallen / rebirthTimer 是倒下和重生。
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
    return { fire: (G.fire || {}).anim || 1.6, ram: (G.shock || {}).anim || 1.3, bolt: (G.bolt || {}).anim || 1.8, ice: (G.ice || {}).anim || 1.6 };
  }
  function poseOf(ai, t) {
    const dur = durations();
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
    // 默认（待机）
    Object.assign(q, { hdx: 0, hdy: 0, hang: -0.12 + Math.sin(t * 1.1) * 0.03, jaw: 0.04 + 0.03 * Math.sin(t * 2.1), bodyY: 0, pitch: 0, dash: 0, raise: 0, fold: 0, droop: 0, hold: 0, chest: 0, tail: 0, frost: 0, jet: 0, orb: 0, beam: 0, legs: 0, speed: 0 });
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
      const warnEnd = ice ? { hdx: 0.04, hdy: 0.03, hang: -0.22, jaw: 0.38, raise: 0.1, hold: 0.35, chest: 1, bodyY: 0.01, frost: 1 } : { hdx: 0.1, hdy: -0.1, hang: 0.28, jaw: 0.42, raise: 0.3, hold: 0.7, chest: 1, bodyY: -0.02, frost: 0 };
      const idle = { hdx: 0, hdy: 0, hang: q.hang, jaw: q.jaw, raise: 0, hold: 0, chest: 0, bodyY: 0, frost: 0 };
      if (q.stage === 'warn') {
        apply(mix(idle, warnEnd, r));
        if (ice) q.jet = r * 0.5; // 寒气先在嘴边聚成雾
      } else {
        const lungePose = { hdx: -0.17, hdy: 0.03, hang: -0.22, jaw: 0.62, raise: 0.2, hold: 0.5, chest: 0.6, bodyY: 0, frost: ice ? 1 : 0 };
        const lunge = smooth(p / 0.14);
        const relax = smooth((p - 0.72) / 0.28);
        apply(mix(mix(warnEnd, lungePose, lunge), idle, relax));
        q.pitch = -0.03 * lunge * (1 - relax);
        q.jet = smooth(p / 0.1) * (1 - smooth((p - 0.8) / 0.2));
        if (ice) q.frost = lerp(1, 0.25, smooth((p - 0.6) / 0.4));
      }
    } else if (q.kind === 'ram') {
      const r = smooth(k);
      if (q.stage === 'warn') {
        apply({ bodyY: 0.05 * r, pitch: -0.04 * r, hang: -0.12 - 0.25 * r, fold: 0.7 * r, hold: r, jaw: 0.05, hdy: 0.03 * r, hdx: 0, tail: 0.5 * r, legs: 0.6 * r });
      } else {
        const e = Math.sin(Math.PI * p);
        apply({ bodyY: 0.03, pitch: -0.07, hang: -0.32, fold: 1, hold: 1, jaw: 0.3, hdx: -0.1, hdy: 0.04, tail: 0.8, legs: 1 });
        q.dash = -e * 0.8; // 单位 s：整条龙扑向城墙再退回来
        q.speed = e;
      }
    } else if (q.kind === 'bolt') {
      const r = smooth(k);
      if (q.stage === 'warn') {
        apply({ raise: 0.65 * r, hold: 0.8 * r, hang: -0.12 + 0.42 * r, hdy: -0.07 * r, jaw: 0.12 + 0.28 * r, chest: r });
        q.orb = r;
      } else {
        apply({ raise: 0.65, hold: 0.8, hang: -0.02, hdy: -0.03, jaw: 0.55, chest: 1 });
        q.orb = 1 - smooth(p / 0.25);
        q.beam = smooth(p / 0.08) * (1 - smooth((p - 0.82) / 0.18));
      }
    } else if (q.fallen) {
      const rb = q.rebirth * q.rebirth;
      apply({ bodyY: 0.09 * (1 - rb), droop: 1 - rb, hold: 1 - rb, hang: -0.5 * (1 - rb), jaw: 0.02 + 0.3 * rb, legs: -0.45 * (1 - rb) });
    }
    // 翅膀的拍动：技能里翅膀被"举着 / 收着"（hold），拍动幅度跟着变小；狂暴时拍得更快
    const rate = q.rage ? 3.2 : 2.2;
    q.rate = rate;
    q.flap = Math.sin(t * rate) * (1 - 0.85 * q.hold);
    q.flap2 = Math.sin(t * rate + 0.8) * (1 - 0.85 * q.hold);
    q.lag = Math.sin(t * rate - 0.7) * (1 - 0.85 * q.hold); // 指骨比臂骨慢半拍，翼尖才有"甩"的感觉
    q.lag2 = Math.sin(t * rate + 0.1) * (1 - 0.85 * q.hold);
    if (q.droop > 0) {
      q.flap = lerp(q.flap, 0.9, q.droop);
      q.flap2 = lerp(q.flap2, 0.8, q.droop);
      q.lag = lerp(q.lag, 1, q.droop);
      q.lag2 = lerp(q.lag2, 1, q.droop);
    }
    // 悬停：翅膀往下拍时身体往上抬一点
    q.bob = q.fallen ? 0 : -Math.cos(t * rate) * 0.016;
    return q;
  }

  // 头的位置和嘴尖的位置（单位 s，原点 = 身体中心，含整体下移 0.12 s）
  function headGeometry(q) {
    const hx = -0.93 + q.hdx + 0.02;
    const hy = -0.55 + q.hdy + 0.01;
    const sc = 1.14;
    const ca = Math.cos(q.hang);
    const sa = Math.sin(q.hang);
    const lx = -0.44 * sc;
    const ly = (0.03 + Math.sin(q.jaw) * 0.22) * sc;
    return { hx, hy, sc, mouthX: hx + lx * ca - ly * sa, mouthY: hy + lx * sa + ly * ca + 0.12 };
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

  // ================= 主画法 =================
  D.abyssDragon = function (ctx, s, t, o) {
    const ai = o.ai || {};
    const q = poseOf(ai, t);
    const { dark, rage, angry, fallen, rebirth } = q;
    const kind = q.kind;
    const cast = q.stage === 'cast';
    const lw = (v) => Math.max(1, s * v);
    // 画质降档（TD.quality，设计书 55）时省掉最费的几层：鳞片透光、翼膜细脉、远侧翅膀的指爪
    const lowQ = !!(TD.quality && TD.quality.params().lit <= 0.5);

    // ---------- 配色：红龙是炭黑带暗红的鳞甲 + 岩浆裂纹 + 深红翼膜；黑龙几乎全黑，裂纹和眼睛是血红色 ----------
    const BODY = mixc(rage ? '#2a1114' : '#1d1013', '#0b0810', dark);
    const BODY_LIT = mixc(rage ? '#8a3426' : '#6a2a24', '#2e1428', dark);
    const BELLY = mixc('#8a4c30', '#34202c', dark);
    const MEMB = mixc('#a21626', '#2c0a2a', dark);
    const SPIKE = mixc('#8a6a5c', '#6a4a6c', dark);
    const CLAW = mixc('#e2d0b2', '#b8a0b8', dark);
    const RIM = mixc('#ff9a60', '#ff3a6a', dark);
    const LAVA = dark > 0.5 ? '#ff2a5a' : rage ? '#ffd060' : '#ff8a2a';
    // 技能给全身打的色光：火 = 橙，冰 = 冰蓝，雷 = 电蓝
    const tone = kind === 'ice' ? '#7fd0ff' : kind === 'bolt' ? '#8fb4ff' : kind === 'fire' ? '#ffb040' : null;
    const toneA = q.stage ? (cast ? 1 : q.k) : 0;
    const EYE = kind === 'ice' ? '#bfeaff' : kind === 'bolt' ? '#dfeaff' : mixc(rage ? '#fff0c0' : '#ffb830', '#ff4a50', dark);
    const heat = (fallen ? 0.1 + 0.9 * rebirth * rebirth : 0.42 + (angry ? 0.2 : 0) + (rage ? 0.25 : 0) + (kind === 'fire' ? 0.5 * toneA : 0)) + (dark > 0.5 ? 0.2 : 0);
    const eyeGlow = fallen ? 0.15 + 0.85 * rebirth * rebirth : 1;

    ctx.save();
    ctx.scale(ART, ART);
    ctx.translate(0, (q.bob + 0.12 + q.bodyY) * s);

    // 背光：身体是炭黑的，要靠光把轮廓从深紫的背景里托出来
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0.05 * s, -0.12 * s, s * 1.25, tone && toneA > 0.3 ? tone : dark > 0.5 ? '#ff1a4a' : '#ff4a1a', 0.1 + 0.12 * Math.min(1, heat) + 0.1 * toneA);
    ctx.restore();
    // 地面上的影子（龙悬在半空，影子落得很远很淡）：冲撞时跟着龙一起滑
    ctx.save();
    ctx.globalAlpha = 0.4;
    shadow(ctx, s * (0.1 + q.dash), s * 0.5 - (q.bob + q.bodyY) * s, s * 0.95);
    ctx.restore();

    // 冲撞的速度线：龙身后拖出一串水平亮线
    if (q.speed > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const rr = seeded(3);
      for (let i = 0; i < 16; i++) {
        const y = (-0.55 + rr() * 1.15) * s;
        const x0 = (0.1 + rr() * 0.6) * s;
        const L = (0.35 + rr() * 0.9) * s * q.speed;
        ctx.strokeStyle = linear(ctx, x0, y, x0 + L, y, [[0, 'rgba(255,200,140,0.7)'], [1, 'rgba(255,120,60,0)']]);
        ctx.lineWidth = lw(0.008 + rr() * 0.012);
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + L, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.translate(q.dash * s, 0);
    ctx.rotate(q.pitch);

    // ---------- 脊柱：头 → 脖子 → 胸 → 腹 → 尾（x, y, 背侧半宽, 腹侧半宽），单位 s ----------
    const sw = (a, ph) => Math.sin(t * 1.7 + ph) * a;
    const tailLift = q.tail * 0.12;
    const ctl = [
      [-0.93 + q.hdx, -0.55 + q.hdy, 0.075, 0.075],
      [-0.83 + q.hdx * 0.85, -0.59 + q.hdy * 0.85, 0.085, 0.09],
      [-0.7 + q.hdx * 0.5, -0.5 + q.hdy * 0.5, 0.1, 0.105],
      [-0.64 + q.hdx * 0.2, -0.35 + q.hdy * 0.25, 0.115, 0.125],
      [-0.54, -0.22, 0.14, 0.16],
      [-0.36, -0.12, 0.225, 0.26],
      [-0.08, -0.09, 0.235, 0.3],
      [0.22, -0.08, 0.215, 0.25],
      [0.46, -0.03 + sw(0.01, 0) - tailLift * 0.4, 0.155, 0.17],
      [0.68, 0.06 + sw(0.04, 0.6) - tailLift, 0.11, 0.115],
      [0.88, 0.13 + sw(0.07, 1.2) - tailLift * 1.8, 0.075, 0.075],
      [1.03, 0.1 + sw(0.09, 1.8) - tailLift * 2.4, 0.045, 0.045],
      [1.14, 0.0 + sw(0.1, 2.4) - tailLift * 3, 0.02, 0.02],
    ].map(([x, y, a, b]) => [x * s, y * s, a * s, b * s]);
    const S = spline(ctl, 96);
    const NECK = 38; // 采样点 0..NECK 是脖子，之后是躯干和尾巴
    const TAIL0 = 62;

    // ---------- 翅膀 ----------
    // 肩 → 肘 → 腕三节臂骨；腕上长出四根指骨，翼膜撑在指骨之间，后缘是下凹的扇贝，末端连到腰上
    const wing = (sx, sy, rx, ry, f, fl, near) => {
      const { raise, fold, droop } = q;
      let a1 = -0.7 + 0.45 * f - 0.35 * raise;
      a1 = lerp(a1, -0.12, fold);
      a1 = lerp(a1, 0.55, droop);
      const E = [sx + Math.cos(a1) * 0.27 * s, sy + Math.sin(a1) * 0.27 * s];
      let a2 = -1.4 + 0.5 * f - 0.35 * raise;
      a2 = lerp(a2, 0.15, fold);
      a2 = lerp(a2, 1.1, droop);
      const W = [E[0] + Math.cos(a2) * 0.31 * s, E[1] + Math.sin(a2) * 0.31 * s];
      const lens = [0.92, 0.98, 0.88, 0.66].map((l) => l * (1 - 0.25 * fold) * (1 - 0.1 * droop));
      const tips = lens.map((l, i) => {
        let th = 0.1 + 0.44 * i + 0.24 * fl + 0.1 * i * raise;
        th = lerp(th, 0.25 + 0.12 * i, fold);
        th = lerp(th, 1.25 + 0.15 * i, droop);
        return [W[0] + Math.cos(th) * l * s, W[1] + Math.sin(th) * l * s];
      });
      const R = [rx * s, ry * s];
      const dk = near ? 0 : 0.3; // 远侧的翅膀整体暗一档
      const hotC = tone && toneA > 0.2 ? tone : '#ff7a44';
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // 翼膜后缘：连着前面的路径画时用 lineTo（moveTo 会断开成两个子路径，指骨根部到手腕那一块就不上色了）；单独描边时用 moveTo
      const edge = (join) => {
        join ? ctx.lineTo(tips[0][0], tips[0][1]) : ctx.moveTo(tips[0][0], tips[0][1]);
        for (let i = 1; i < 4; i++) {
          const [px, py] = tips[i - 1];
          const [tx, ty] = tips[i];
          ctx.quadraticCurveTo((px + tx) / 2 + (W[0] - (px + tx) / 2) * 0.3, (py + ty) / 2 + (W[1] - (py + ty) / 2) * 0.3, tx, ty);
        }
      };
      // 翼膜
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(E[0], E[1]);
      ctx.lineTo(W[0], W[1]);
      edge(true);
      ctx.quadraticCurveTo((tips[3][0] + R[0]) / 2 + (W[0] - (tips[3][0] + R[0]) / 2) * 0.2, (tips[3][1] + R[1]) / 2 + (W[1] - (tips[3][1] + R[1]) / 2) * 0.2 + 0.02 * s, R[0], R[1]);
      ctx.closePath();
      ctx.fillStyle = linear(ctx, W[0], W[1], tips[3][0] * 0.7 + R[0] * 0.3, tips[3][1] + 0.1 * s, [
        [0, deep(MEMB, 0.12 + dk * 0.6)],
        [0.55, light(MEMB, 0.02 - dk * 0.1)],
        [1, rgba(hotC, near ? 0.8 : 0.5)],
      ]);
      ctx.fill();
      ctx.save();
      ctx.clip();
      // 指骨之间的褶皱和细脉
      for (let i = 0; i < 3; i++) {
        const mx = (tips[i][0] + tips[i + 1][0]) / 2;
        const my = (tips[i][1] + tips[i + 1][1]) / 2;
        ctx.strokeStyle = rgba('#1a0610', 0.35);
        ctx.lineWidth = lw(0.006);
        ctx.beginPath();
        ctx.moveTo(W[0], W[1]);
        ctx.quadraticCurveTo((W[0] + mx) / 2 + 0.02 * s, (W[1] + my) / 2 + 0.03 * s, mx, my);
        ctx.stroke();
        ctx.strokeStyle = rgba(LAVA, (near ? 0.18 : 0.1) + heat * 0.1);
        ctx.lineWidth = lw(0.004);
        for (let b = 1; b <= 3; b++) {
          const u = b / 4;
          const bx = lerp(W[0], mx, u);
          const by = lerp(W[1], my, u) + 0.03 * s * Math.sin(u * 3);
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + (tips[i + 1][0] - mx) * 0.3, by + (tips[i + 1][1] - my) * 0.3);
          ctx.stroke();
        }
      }
      if (!lowQ) for (let i = 0; i < 4; i++) veins(ctx, W[0], W[1], 0.34 * s, Math.atan2(tips[i][1] - W[1], tips[i][0] - W[0]), 1, LAVA, (near ? 0.5 : 0.28) + heat * 0.22, 31 + i * 7 + (near ? 0 : 50), s * 0.011);
      // 靠近身体的一片暗影（肩膀的阴影落在翼膜上）+ 翼膜后缘透光
      glow(ctx, sx + 0.1 * s, sy, s * 0.3, '#18040a', 0.35);
      ctx.strokeStyle = rgba('#ffd0a0', near ? 0.22 : 0.1);
      ctx.lineWidth = s * 0.03;
      ctx.beginPath();
      edge();
      ctx.stroke();
      ctx.restore();
      // 后缘一圈细亮边
      ctx.strokeStyle = rgba(hotC, near ? 0.45 : 0.2);
      ctx.lineWidth = lw(0.006);
      ctx.beginPath();
      edge();
      ctx.stroke();
      // 指骨：根粗梢细，带关节小刺和钩爪
      for (let i = 0; i < 4; i++) {
        const [tx, ty] = tips[i];
        const fa = Math.atan2(ty - W[1], tx - W[0]);
        const fa2 = fa + Math.PI / 2;
        ctx.fillStyle = deep(SPIKE, 0.35 + dk);
        ctx.beginPath();
        ctx.moveTo(W[0] + Math.cos(fa2) * 0.014 * s, W[1] + Math.sin(fa2) * 0.014 * s);
        ctx.lineTo(tx + Math.cos(fa2) * 0.003 * s, ty + Math.sin(fa2) * 0.003 * s);
        ctx.lineTo(tx - Math.cos(fa2) * 0.003 * s, ty - Math.sin(fa2) * 0.003 * s);
        ctx.lineTo(W[0] - Math.cos(fa2) * 0.014 * s, W[1] - Math.sin(fa2) * 0.014 * s);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = rgba(RIM, near ? 0.45 : 0.18);
        ctx.lineWidth = lw(0.003);
        ctx.stroke();
        ctx.fillStyle = deep(CLAW, 0.2 + dk);
        for (let b = 1; b <= 2; b++) {
          const u = b / 3.2;
          const bx = lerp(W[0], tx, u);
          const by = lerp(W[1], ty, u);
          ctx.beginPath();
          ctx.moveTo(bx - Math.cos(fa) * 0.012 * s, by - Math.sin(fa) * 0.012 * s);
          ctx.lineTo(bx + Math.cos(fa2) * (0.034 - b * 0.008) * s + Math.cos(fa) * 0.015 * s, by + Math.sin(fa2) * (0.034 - b * 0.008) * s + Math.sin(fa) * 0.015 * s);
          ctx.lineTo(bx + Math.cos(fa) * 0.012 * s, by + Math.sin(fa) * 0.012 * s);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = deep(CLAW, dk);
        ctx.beginPath();
        ctx.moveTo(tx - Math.cos(fa) * 0.01 * s + Math.sin(fa) * 0.014 * s, ty - Math.sin(fa) * 0.01 * s - Math.cos(fa) * 0.014 * s);
        ctx.quadraticCurveTo(tx + Math.cos(fa) * 0.05 * s, ty + Math.sin(fa) * 0.05 * s + 0.01 * s, tx + Math.cos(fa) * 0.1 * s, ty + Math.sin(fa) * 0.1 * s + 0.045 * s);
        ctx.quadraticCurveTo(tx + Math.cos(fa) * 0.05 * s, ty + Math.sin(fa) * 0.05 * s - 0.005 * s, tx - Math.cos(fa) * 0.01 * s - Math.sin(fa) * 0.014 * s, ty - Math.sin(fa) * 0.01 * s + Math.cos(fa) * 0.014 * s);
        ctx.fill();
      }
      // 臂骨：带肌肉的粗臂（肩粗腕细），边光 + 肘上的骨刺
      const arm = spline([[sx, sy, 0.04 * s, 0.04 * s], [E[0], E[1], 0.028 * s, 0.028 * s], [W[0], W[1], 0.018 * s, 0.018 * s]], 14);
      ribbonPath(ctx, arm);
      ctx.fillStyle = linear(ctx, sx, sy - 0.1 * s, sx, sy + 0.1 * s, [[0, deep(BODY_LIT, 0.1 + dk)], [1, deep(BODY, 0.5 + dk)]]);
      ctx.fill();
      ctx.strokeStyle = rgba(RIM, near ? 0.5 : 0.2);
      ctx.lineWidth = lw(0.005);
      ctx.stroke();
      ctx.fillStyle = deep(CLAW, 0.15 + dk);
      for (const [px, py, sz] of [[E[0], E[1], 1], [(sx + E[0]) / 2, (sy + E[1]) / 2, 0.6], [(E[0] + W[0]) / 2, (E[1] + W[1]) / 2, 0.7]]) {
        ctx.beginPath();
        ctx.moveTo(px - 0.012 * s, py);
        ctx.lineTo(px - 0.012 * s * 0.4 - 0.03 * s * sz, py - 0.07 * s * sz);
        ctx.lineTo(px + 0.014 * s, py);
        ctx.closePath();
        ctx.fill();
      }
      // 腕上的钩爪（翼拇指）
      ctx.fillStyle = deep(CLAW, dk);
      ctx.beginPath();
      ctx.moveTo(W[0] - 0.02 * s, W[1] - 0.01 * s);
      ctx.quadraticCurveTo(W[0] - 0.06 * s, W[1] - 0.06 * s, W[0] - 0.13 * s, W[1] - 0.08 * s);
      ctx.quadraticCurveTo(W[0] - 0.07 * s, W[1] - 0.03 * s, W[0] + 0.02 * s, W[1] + 0.02 * s);
      ctx.fill();
      ctx.restore();
      return { W, E, tips };
    };
    const farWing = wing(-0.02 * s, -0.27 * s, 0.38, -0.08, q.flap2, q.lag2, false);

    // ---------- 肢体：大腿 / 小腿 / 脚三段的肌肉轮廓 + 趾爪 ----------
    const sway = Math.sin(t * 1.5) * 0.015;
    const limb = (pts, darkAmt, claw) => {
      const L = spline(pts.map(([x, y, w]) => [x * s, y * s, w * s, w * s]), 18);
      ribbonPath(ctx, L);
      ctx.fillStyle = linear(ctx, pts[0][0] * s, pts[0][1] * s - 0.1 * s, pts[0][0] * s, pts[0][1] * s + 0.3 * s, [[0, deep(BODY_LIT, darkAmt + 0.3)], [0.5, deep(BODY, darkAmt)], [1, deep(BODY, 0.7 + darkAmt * 0.3)]]);
      ctx.fill();
      ctx.save();
      ctx.clip();
      if (!lowQ) scaleFill(ctx, (pts[0][0] - 0.3) * s, (pts[0][1] - 0.1) * s, (pts[0][0] + 0.3) * s, (pts[pts.length - 1][1] + 0.1) * s, s * 0.04, '#140404', 0.45);
      veins(ctx, pts[0][0] * s, pts[0][1] * s, 0.25 * s, 1.6, 1, LAVA, 0.3 + heat * 0.4, 61 + Math.round(pts[0][0] * 10), s * 0.011);
      glow(ctx, pts[1][0] * s, pts[1][1] * s, s * 0.07, LAVA, 0.25 + heat * 0.3);
      ctx.restore();
      ctx.strokeStyle = rgba(RIM, 0.2 + 0.3 * (1 - dark));
      ctx.lineWidth = lw(0.006);
      ctx.stroke();
      // 膝盖 / 肘上的骨刺
      ctx.fillStyle = deep(CLAW, 0.3 + darkAmt * 0.5);
      ctx.beginPath();
      ctx.moveTo((pts[1][0] - 0.015) * s, (pts[1][1] - 0.02) * s);
      ctx.lineTo((pts[1][0] - 0.06) * s, (pts[1][1] - 0.06) * s);
      ctx.lineTo((pts[1][0] + 0.02) * s, (pts[1][1] - 0.04) * s);
      ctx.closePath();
      ctx.fill();
      // 趾爪：向前（左）下方弯的三根
      const [fx, fy] = [pts[pts.length - 1][0] * s, pts[pts.length - 1][1] * s];
      ctx.fillStyle = deep(CLAW, darkAmt * 0.5);
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(fx + i * 0.022 * s - 0.01 * s, fy - 0.01 * s);
        ctx.quadraticCurveTo(fx + (i * 0.04 - 0.06 * claw) * s, fy + 0.05 * s, fx + (i * 0.05 - 0.11 * claw) * s, fy + 0.1 * s);
        ctx.quadraticCurveTo(fx + (i * 0.03 - 0.02) * s, fy + 0.03 * s, fx + i * 0.022 * s + 0.02 * s, fy - 0.01 * s);
        ctx.fill();
      }
    };
    // 腿的姿势：待机时自然垂着轻晃；冲撞时向后收（流线型）；倒下时摊开
    const lg = q.legs; // −1 摊开 … 0 垂着 … 1 收到身后
    const legPts = (base) => base.map(([x, y, w], i) => [x + (i ? 0.34 * lg * i * 0.28 : 0) + (lg < 0 ? 0.04 * lg * i : 0), y + (i ? -0.32 * lg * 0.3 * i : 0) - (lg > 0 ? 0.04 * lg * i : 0), w]);
    limb(legPts([[0.4, -0.02, 0.12], [0.34, 0.18, 0.075], [0.5, 0.28 + sway, 0.04], [0.4, 0.44 + sway, 0.03]]), 0.5, 1);
    limb(legPts([[-0.22, 0.04, 0.09], [-0.2, 0.22, 0.055], [-0.3, 0.3 - sway, 0.034], [-0.38, 0.38 - sway, 0.026]]), 0.5, 1);

    // ---------- 尾尖的刃 ----------
    {
      const e = S[S.length - 1];
      ctx.save();
      ctx.translate(e[0], e[1]);
      ctx.rotate(Math.atan2(e.ty, e.tx));
      ctx.beginPath();
      ctx.moveTo(-0.02 * s, 0);
      ctx.quadraticCurveTo(0.03 * s, -0.09 * s, 0.17 * s, 0);
      ctx.quadraticCurveTo(0.03 * s, 0.09 * s, -0.02 * s, 0);
      ctx.fillStyle = linear(ctx, 0, -0.07 * s, 0.17 * s, 0, [[0, deep(BODY_LIT, 0.1)], [1, deep(SPIKE, 0.1)]]);
      ctx.fill();
      ctx.strokeStyle = rgba(RIM, 0.55);
      ctx.lineWidth = lw(0.005);
      ctx.stroke();
      glow(ctx, 0.08 * s, 0, s * 0.07, LAVA, 0.25 + heat * 0.25);
      ctx.restore();
    }

    // ---------- 躯干 + 脖子 + 尾巴：一个连续的轮廓 ----------
    const bodyPath = () => ribbonPath(ctx, S);
    const { top, bot } = bodyPath();
    ctx.fillStyle = linear(ctx, 0, -0.62 * s, 0, 0.3 * s, [[0, deep(BODY_LIT, 0.0)], [0.38, BODY], [1, deep(BODY, 0.82)]]);
    ctx.fill();
    ctx.save();
    bodyPath();
    ctx.clip();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // 受光：从右上来，背脊上一条亮带；腹下一条暗带
    ctx.strokeStyle = rgba(RIM, 0.22);
    ctx.lineWidth = s * 0.1;
    polyline(ctx, top);
    ctx.stroke();
    ctx.strokeStyle = rgba(RIM, 0.55);
    ctx.lineWidth = s * 0.03;
    polyline(ctx, top);
    ctx.stroke();
    ctx.strokeStyle = rgba('#0a0204', 0.4);
    ctx.lineWidth = s * 0.17;
    polyline(ctx, bot);
    ctx.stroke();
    // 背甲：沿背脊一片片叠起来的盾形甲片，每片有一条高光
    for (let i = 4; i < 82; i += 2) {
      const p = S[i];
      const bx = top[i][0];
      const by = top[i][1];
      const nx = p.ty;
      const ny = -p.tx;
      const th = p[2] * 0.5;
      const wd = Math.max(0.012 * s, p[2] * 0.42);
      ctx.beginPath();
      ctx.moveTo(bx - p.tx * wd, by - p.ty * wd);
      ctx.quadraticCurveTo(bx - p.tx * wd * 0.2 - nx * th * 1.1, by - p.ty * wd * 0.2 - ny * th * 1.1, bx + p.tx * wd * 0.9 - nx * th * 0.2, by + p.ty * wd * 0.9 - ny * th * 0.2);
      ctx.lineTo(bx + p.tx * wd * 1.2, by + p.ty * wd * 1.2);
      ctx.closePath();
      ctx.fillStyle = rgba(deep(BODY, 0.1), 0.55);
      ctx.fill();
      ctx.strokeStyle = rgba(RIM, 0.28);
      ctx.lineWidth = lw(0.0035);
      ctx.stroke();
    }
    // 腹甲：脖子下缘到尾根的宽带，横向分成一块块甲片，片与片之间透出光
    {
      const inner = S.map((p) => [p[0] - p.ty * p[3] * 0.42, p[1] + p.tx * p[3] * 0.42]);
      const a = 4;
      const b = 80;
      ctx.beginPath();
      for (let i = a; i <= b; i++) (i === a ? ctx.moveTo : ctx.lineTo).call(ctx, bot[i][0], bot[i][1]);
      for (let i = b; i >= a; i--) ctx.lineTo(inner[i][0], inner[i][1]);
      ctx.closePath();
      ctx.fillStyle = linear(ctx, 0, -0.1 * s, 0, 0.3 * s, [[0, rgba(BELLY, 0.55)], [1, deep(BELLY, 0.25)]]);
      ctx.fill();
      for (let i = a + 1; i <= b; i += 3) {
        ctx.strokeStyle = rgba('#3a1a0a', 0.6);
        ctx.lineWidth = lw(0.0055);
        ctx.beginPath();
        ctx.moveTo(bot[i][0], bot[i][1]);
        ctx.lineTo(inner[i][0] + S[i].tx * 0.012 * s, inner[i][1] + S[i].ty * 0.012 * s);
        ctx.stroke();
        ctx.strokeStyle = rgba(LAVA, 0.12 + heat * 0.18);
        ctx.lineWidth = lw(0.0025);
        ctx.beginPath();
        ctx.moveTo(bot[i][0] + S[i].tx * 0.006 * s, bot[i][1] + S[i].ty * 0.006 * s);
        ctx.lineTo(inner[i][0] + S[i].tx * 0.018 * s, inner[i][1] + S[i].ty * 0.018 * s);
        ctx.stroke();
      }
    }
    // 鳞片（平铺图案，一遍）+ 鳞片之间透出的岩浆光（加亮叠加）
    scaleFill(ctx, -0.95 * s, -0.7 * s, 1.15 * s, 0.35 * s, s * 0.055, '#140404', 0.6);
    if (!lowQ) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(0.4, 0.1 + heat * 0.2);
      scaleFill(ctx, -0.95 * s, -0.7 * s, 1.15 * s, 0.35 * s, s * 0.055, LAVA, 0.5);
      ctx.restore();
    }
    // 岩浆裂纹：沿背脊、肩、胸、腹、尾根一路裂开，加亮叠加
    veins(ctx, -0.02 * s, -0.12 * s, 0.4 * s, -0.35, 3, LAVA, 0.45 + heat * 0.6, 3, s * 0.02);
    veins(ctx, 0.3 * s, -0.14 * s, 0.34 * s, -0.7, 3, LAVA, 0.4 + heat * 0.55, 9, s * 0.018);
    veins(ctx, -0.22 * s, -0.16 * s, 0.26 * s, -2.6, 2, LAVA, 0.4 + heat * 0.5, 15, s * 0.016);
    veins(ctx, 0.1 * s, 0.05 * s, 0.3 * s, 0.3, 2, LAVA, 0.35 + heat * 0.5, 21, s * 0.015);
    veins(ctx, -0.5 * s, -0.2 * s, 0.22 * s, -1.5, 2, LAVA, 0.35 + heat * 0.45, 27, s * 0.013);
    veins(ctx, 0.62 * s, 0.0, 0.3 * s, 0.1, 2, LAVA, 0.3 + heat * 0.4, 33, s * 0.012);
    // 胸口的火核：技能蓄力时变成对应的颜色，越来越亮
    const core = tone && q.chest > 0 ? tone : LAVA;
    glow(ctx, -0.36 * s, -0.06 * s, s * (0.18 + 0.12 * q.chest), core, 0.3 + heat * 0.4 + 0.3 * q.chest);
    glow(ctx, 0.0, -0.12 * s, s * 0.22, LAVA, 0.12 + heat * 0.25);
    // 寒冰：全身蒙上一层冰蓝的霜
    if (q.frost > 0.02) {
      ctx.fillStyle = rgba('#8fd0ff', 0.22 * q.frost);
      ctx.fillRect(-1.2 * s, -1 * s, 2.6 * s, 1.6 * s);
      ctx.strokeStyle = rgba('#e8f8ff', 0.5 * q.frost);
      ctx.lineWidth = s * 0.02;
      polyline(ctx, top);
      ctx.stroke();
    }
    ctx.restore();
    // 轮廓线 + 受光边
    bodyPath();
    ctx.strokeStyle = rgba('#120304', 0.85);
    ctx.lineWidth = lw(0.007);
    ctx.stroke();
    K.rimEdge(ctx, bodyPath, '#ffb890', 0.3, s * 0.012, s * 0.012, s * 0.012);

    // 肩和腰的肌肉：两块鼓出来的肌肉团，把腿和翅膀的根部盖住
    const mass = (cx, cy, rx, ry, rot) => {
      ctx.save();
      ctx.translate(cx * s, cy * s);
      ctx.rotate(rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * s, ry * s, 0, 0, TAU);
      ctx.fillStyle = linear(ctx, 0, -ry * s, 0, ry * s, [[0, deep(BODY_LIT, 0.15)], [0.55, BODY], [1, deep(BODY, 0.8)]]);
      ctx.fill();
      ctx.save();
      ctx.clip();
      scaleFill(ctx, -rx * s, -ry * s, rx * s, ry * s, s * 0.05, '#140404', 0.5);
      veins(ctx, -rx * s * 0.2, 0, rx * s * 0.9, 0.2, 1, LAVA, 0.3 + heat * 0.4, 71 + Math.round(cx * 10), s * 0.012);
      ctx.restore();
      ctx.strokeStyle = rgba(RIM, 0.35);
      ctx.lineWidth = lw(0.006);
      ctx.stroke();
      ctx.restore();
    };
    mass(-0.3, -0.05, 0.12, 0.15, -0.3); // 肩
    mass(0.3, -0.03, 0.15, 0.17, 0.2); // 髋 / 大腿根

    // ---------- 脊背上的骨刺 + 颈蹼：脖子上密而小，肩背最大，尾巴渐小；刺与刺之间撑一层暗红的蹼 ----------
    const spikes = [];
    for (let i = 3; i < S.length - 2; i += 3) {
      const p = S[i];
      const base = p[2];
      const h = Math.max(0.012 * s, (i < NECK ? 0.05 : i < TAIL0 ? 0.115 : 0.07) * s * (1 - Math.max(0, (i - TAIL0) / (S.length - TAIL0)) * 0.8));
      const [bx, by] = top[i];
      const nx = p.ty;
      const ny = -p.tx;
      const back = 0.5;
      const hw = Math.max(0.01 * s, base * 0.24);
      spikes.push({ i, bx, by, hw, tipX: bx + (nx + p.tx * back) * h, tipY: by + (ny + p.ty * back) * h, p, h });
    }
    ctx.fillStyle = rgba(MEMB, 0.45);
    for (let k = 0; k < spikes.length - 1; k++) {
      const a = spikes[k];
      const b = spikes[k + 1];
      if (a.i > TAIL0) break;
      ctx.beginPath();
      ctx.moveTo(a.tipX, a.tipY);
      ctx.quadraticCurveTo((a.tipX + b.tipX) / 2 + a.p.ty * 0.01 * s, (a.tipY + b.tipY) / 2 - a.p.tx * 0.01 * s + 0.012 * s, b.tipX, b.tipY);
      ctx.lineTo(b.bx, b.by);
      ctx.lineTo(a.bx, a.by);
      ctx.closePath();
      ctx.fill();
    }
    const spikeCol = deep(SPIKE, 0.15);
    for (const sp of spikes) {
      const p = sp.p;
      ctx.beginPath();
      ctx.moveTo(sp.bx - p.tx * sp.hw, sp.by - p.ty * sp.hw);
      ctx.lineTo(sp.tipX, sp.tipY);
      ctx.lineTo(sp.bx + p.tx * sp.hw, sp.by + p.ty * sp.hw);
      ctx.closePath();
      ctx.fillStyle = spikeCol;
      ctx.fill();
      ctx.strokeStyle = rgba(RIM, 0.5);
      ctx.lineWidth = lw(0.004);
      ctx.stroke();
      // 寒冰：每根刺上长出一片冰晶
      if (q.frost > 0.05) {
        const fl = sp.h * (0.5 + 0.9 * q.frost);
        ctx.beginPath();
        ctx.moveTo(sp.tipX, sp.tipY);
        ctx.lineTo(sp.tipX + (sp.tipX - sp.bx) * 0.4 - p.ty * fl * 0.2, sp.tipY + (sp.tipY - sp.by) * 0.4 + p.tx * fl * 0.2);
        ctx.lineTo(sp.tipX + p.ty * fl * 0.15, sp.tipY - p.tx * fl * 0.15);
        ctx.closePath();
        ctx.fillStyle = rgba('#d8f4ff', 0.8 * q.frost);
        ctx.fill();
      }
    }

    // ---------- 头 ----------
    const G = headGeometry(q);
    const Hp = S[0];
    const hx = Hp[0] + 0.02 * s;
    const hy = Hp[1] + 0.01 * s;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(q.hang);
    ctx.scale(G.sc, G.sc);
    // 头的坐标：原点 = 颅骨后部，朝左；上唇线 lipY、下颌铰链 (HX, HY)；嘴张开 = 下颌绕铰链向下转 q.jaw
    const skull = [
      [0.11, -0.095], [0.04, -0.14], [-0.04, -0.168], [-0.1, -0.16], [-0.15, -0.135], [-0.24, -0.118], [-0.33, -0.122], [-0.405, -0.1], [-0.448, -0.062], [-0.458, -0.02],
      [-0.44, 0.014], [-0.4, 0.026], [-0.3, 0.036], [-0.18, 0.046], [-0.08, 0.062], [0.0, 0.08], [0.075, 0.1], [0.135, 0.03],
    ].map(([x, y]) => [x * s, y * s]);
    const lipY = (x) => 0.028 + (x + 0.4) * 0.1;
    const HX = 0.045;
    const HY = 0.078;
    const jawTop = [[-0.405, 0.074], [-0.34, 0.062], [-0.26, 0.062], [-0.12, 0.066], [0.01, 0.062]];
    const jawPts = [[0.01, 0.062], [-0.12, 0.066], [-0.26, 0.062], [-0.34, 0.062], [-0.405, 0.074], [-0.418, 0.098], [-0.34, 0.122], [-0.22, 0.146], [-0.1, 0.162], [0.0, 0.164], [0.07, 0.148], [0.085, 0.1]].map(([x, y]) => [x * s, y * s]);
    const jr = q.jaw;
    const rotJaw = ([x, y]) => {
      const dx = x - HX;
      const dy = y - HY;
      return [HX + dx * Math.cos(jr) + dy * Math.sin(jr), HY - dx * Math.sin(jr) + dy * Math.cos(jr)];
    };

    // 脑后的颈蹼：五根向后散开的骨刺，中间撑一层带扇贝边的蹼（先画，躲在头后面）
    {
      const B = [0.1, -0.02];
      const angs = [-1.05, -0.62, -0.2, 0.26, 0.7];
      const lens = [0.2, 0.27, 0.3, 0.26, 0.2];
      const tips = angs.map((an, i) => [B[0] + Math.cos(an) * lens[i], B[1] + Math.sin(an) * lens[i]]);
      ctx.beginPath();
      ctx.moveTo(B[0] * s, B[1] * s);
      ctx.lineTo(tips[0][0] * s, tips[0][1] * s);
      for (let i = 1; i < tips.length; i++) {
        const mx = (tips[i - 1][0] + tips[i][0]) / 2;
        const my = (tips[i - 1][1] + tips[i][1]) / 2;
        ctx.quadraticCurveTo(lerp(mx, B[0], 0.32) * s, lerp(my, B[1], 0.32) * s, tips[i][0] * s, tips[i][1] * s);
      }
      ctx.closePath();
      ctx.fillStyle = linear(ctx, B[0] * s, B[1] * s, 0.4 * s, B[1] * s, [[0, deep(MEMB, 0.35)], [1, rgba(light(MEMB, 0.1), 0.85)]]);
      ctx.fill();
      ctx.strokeStyle = rgba(RIM, 0.4);
      ctx.lineWidth = lw(0.004);
      ctx.stroke();
      ctx.fillStyle = deep(SPIKE, 0.3);
      for (const t2 of tips) {
        const ang = Math.atan2(t2[1] - B[1], t2[0] - B[0]);
        const nx2 = -Math.sin(ang) * 0.012;
        const ny2 = Math.cos(ang) * 0.012;
        ctx.beginPath();
        ctx.moveTo((B[0] + nx2) * s, (B[1] + ny2) * s);
        ctx.lineTo(t2[0] * s, t2[1] * s);
        ctx.lineTo((B[0] - nx2) * s, (B[1] - ny2) * s);
        ctx.closePath();
        ctx.fill();
      }
    }
    // 双角：一对向后弯的粗角，近的亮、远的暗，角上有一圈圈的环纹
    for (const [x0, y0, d, rot] of [[0.1, -0.1, 0.55, 0.12], [0.08, -0.11, 0.0, -0.1]]) {
      const hn = spline([[x0 * s, y0 * s, 0.034 * s, 0.034 * s], [(x0 + 0.13) * s, (y0 - 0.07 + rot * 0.2) * s, 0.034 * s, 0.034 * s], [(x0 + 0.27) * s, (y0 - 0.06 + rot * 0.2) * s, 0.02 * s, 0.02 * s], [(x0 + 0.42) * s, (y0 + 0.07 + rot * 0.2) * s, 0.003 * s, 0.003 * s]], 14);
      ribbonPath(ctx, hn);
      ctx.fillStyle = linear(ctx, x0 * s, y0 * s, (x0 + 0.42) * s, y0 * s, [[0, deep(SPIKE, 0.45 - d * 0.5)], [1, light(SPIKE, 0.05)]]);
      ctx.fill();
      ctx.strokeStyle = rgba(RIM, 0.45 + 0.3 * d);
      ctx.lineWidth = lw(0.004);
      ctx.stroke();
      ctx.strokeStyle = rgba('#140404', 0.4);
      ctx.lineWidth = lw(0.003);
      for (let r = 2; r < 11; r += 3) {
        const pt = hn[r];
        ctx.beginPath();
        ctx.moveTo(pt[0] + pt.ty * pt[2], pt[1] - pt.tx * pt[2]);
        ctx.lineTo(pt[0] - pt.ty * pt[3], pt[1] + pt.tx * pt[3]);
        ctx.stroke();
      }
    }
    // 颧骨刺：下颌铰链后上方三根向后下方的尖刺
    ctx.fillStyle = deep(SPIKE, 0.2);
    ctx.strokeStyle = rgba(RIM, 0.4);
    ctx.lineWidth = lw(0.003);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo((0.02 + i * 0.05) * s, (0.0 + i * 0.05) * s);
      ctx.lineTo((0.2 + i * 0.03) * s, (0.07 + i * 0.075) * s);
      ctx.lineTo((0.05 + i * 0.05) * s, (0.07 + i * 0.05) * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 嘴里：上唇线和下颌之间的口腔——暗红的肉、舌头，喷火 / 寒冰 / 雷击蓄力时嘴里发光
    {
      const up = [[-0.442, 0.014], [-0.4, 0.026], [-0.3, 0.036], [-0.18, 0.046], [-0.08, 0.062], [0.0, 0.08]];
      const lo = jawTop.map(rotJaw);
      ctx.beginPath();
      up.forEach(([x, y], i) => (i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)));
      for (let i = lo.length - 1; i >= 0; i--) ctx.lineTo(lo[i][0] * s, lo[i][1] * s);
      ctx.closePath();
      ctx.fillStyle = linear(ctx, -0.2 * s, 0.03 * s, 0.0, 0.14 * s, [[0, '#7a1a22'], [1, '#2a060c']]);
      ctx.fill();
      if (jr > 0.18) {
        // 舌头：从喉咙伸出来的一条，随时间轻晃
        const w = Math.sin(t * 9) * 0.008;
        const t0 = rotJaw([-0.02, 0.07]);
        const t1 = rotJaw([-0.3, 0.066]);
        ctx.beginPath();
        ctx.moveTo(t0[0] * s, t0[1] * s);
        ctx.quadraticCurveTo(((t0[0] + t1[0]) / 2) * s, (((t0[1] + t1[1]) / 2) - 0.02 + w) * s, t1[0] * s, t1[1] * s);
        ctx.quadraticCurveTo(((t0[0] + t1[0]) / 2) * s, (((t0[1] + t1[1]) / 2) + 0.02) * s, t0[0] * s, t0[1] * s);
        ctx.fillStyle = rgba('#c42a3a', 0.9);
        ctx.fill();
      }
      const mouthC = kind === 'ice' ? '#9fdcff' : kind === 'bolt' ? '#9fc0ff' : '#ff9a3a';
      const mouthA = kind ? 0.3 + 0.55 * (cast ? 1 : q.k) : 0.1 + (angry ? 0.12 : 0);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, -0.24 * s, (0.045 + Math.sin(jr) * 0.1) * s, s * (0.1 + (kind ? 0.2 * (cast ? 1 : q.k) : 0.03)), mouthC, mouthA, true);
      ctx.restore();
    }

    // 下颌（绕铰链向下转开：头朝左，往下转要用负角度）
    ctx.save();
    ctx.translate(HX * s, HY * s);
    ctx.rotate(-jr);
    ctx.translate(-HX * s, -HY * s);
    closedPath(ctx, jawPts);
    ctx.fillStyle = linear(ctx, 0, 0.06 * s, 0, 0.17 * s, [[0, deep(BODY, 0.45)], [0.5, deep(BODY, 0.7)], [1, deep(BODY, 0.9)]]);
    ctx.fill();
    ctx.save();
    closedPath(ctx, jawPts);
    ctx.clip();
    scaleFill(ctx, -0.45 * s, 0.05 * s, 0.1 * s, 0.17 * s, s * 0.03, '#140404', 0.4);
    // 下颌下缘的受光边
    ctx.strokeStyle = rgba(RIM, 0.3);
    ctx.lineWidth = s * 0.012;
    ctx.beginPath();
    ctx.moveTo(-0.41 * s, 0.1 * s);
    ctx.quadraticCurveTo(-0.2 * s, 0.158 * s, 0.05 * s, 0.158 * s);
    ctx.stroke();
    if (q.frost > 0.05) {
      ctx.fillStyle = rgba('#a8ddff', 0.28 * q.frost);
      ctx.fillRect(-0.5 * s, 0.04 * s, 0.7 * s, 0.15 * s);
    }
    ctx.restore();
    ctx.strokeStyle = rgba('#120304', 0.9);
    ctx.lineWidth = lw(0.005);
    closedPath(ctx, jawPts);
    ctx.stroke();
    // 下颌的牙：沿下颌上缘朝上，和上颌的牙错开；最前面一对是长獠牙
    ctx.fillStyle = '#f4ecd0';
    ctx.strokeStyle = rgba('#5a4a30', 0.6);
    ctx.lineWidth = lw(0.002);
    for (let i = 0; i < 7; i++) {
      const x = -0.385 + i * 0.05;
      const y0 = 0.066 - (x < -0.3 ? 0.002 : 0);
      const hgt = i === 0 ? 0.062 : i === 1 ? 0.04 : 0.032 - i * 0.002;
      ctx.beginPath();
      ctx.moveTo(x * s, (y0 + 0.004) * s);
      ctx.lineTo((x + 0.011) * s, (y0 - hgt) * s);
      ctx.lineTo((x + 0.024) * s, (y0 + 0.004) * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // 下巴上的几根尖刺
    ctx.fillStyle = deep(SPIKE, 0.3);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo((-0.3 + i * 0.07) * s, (0.13 + i * 0.008) * s);
      ctx.lineTo((-0.27 + i * 0.07) * s, (0.2 + i * 0.006) * s);
      ctx.lineTo((-0.22 + i * 0.07) * s, (0.146 + i * 0.008) * s);
      ctx.fill();
    }
    ctx.restore();

    // 颅骨 + 上颌
    closedPath(ctx, skull);
    ctx.fillStyle = linear(ctx, 0.1 * s, -0.17 * s, -0.3 * s, 0.07 * s, [[0, deep(BODY_LIT, 0.0)], [0.55, BODY], [1, deep(BODY, 0.55)]]);
    ctx.fill();
    ctx.save();
    closedPath(ctx, skull);
    ctx.clip();
    scaleFill(ctx, -0.47 * s, -0.18 * s, 0.14 * s, 0.1 * s, s * 0.035, '#140404', 0.45);
    // 眉骨上缘的高光、鼻梁上的高光、上唇下的暗影
    ctx.strokeStyle = rgba('#ffa880', 0.4);
    ctx.lineWidth = s * 0.016;
    ctx.beginPath();
    ctx.moveTo(-0.15 * s, -0.138 * s);
    ctx.quadraticCurveTo(-0.07 * s, -0.176 * s, 0.03 * s, -0.145 * s);
    ctx.stroke();
    ctx.strokeStyle = rgba('#ffa880', 0.25);
    ctx.lineWidth = s * 0.01;
    ctx.beginPath();
    ctx.moveTo(-0.4 * s, -0.098 * s);
    ctx.quadraticCurveTo(-0.3 * s, -0.126 * s, -0.2 * s, -0.12 * s);
    ctx.stroke();
    ctx.strokeStyle = rgba('#0a0204', 0.45);
    ctx.lineWidth = s * 0.026;
    ctx.beginPath();
    ctx.moveTo(-0.44 * s, 0.018 * s);
    ctx.lineTo(0.0 * s, 0.078 * s);
    ctx.stroke();
    // 眼眶下的暗影，让眼睛陷进去
    glow(ctx, -0.12 * s, -0.07 * s, s * 0.09, '#0a0204', 0.35);
    veins(ctx, 0.02 * s, -0.03 * s, 0.16 * s, 3.3, 1, LAVA, 0.3 + heat * 0.4, 41, s * 0.007);
    if (q.frost > 0.05) {
      ctx.fillStyle = rgba('#a8ddff', 0.28 * q.frost);
      ctx.fillRect(-0.5 * s, -0.2 * s, 0.7 * s, 0.4 * s);
    }
    ctx.restore();
    ctx.strokeStyle = rgba('#120304', 0.9);
    ctx.lineWidth = lw(0.006);
    closedPath(ctx, skull);
    ctx.stroke();
    K.rimEdge(ctx, () => closedPath(ctx, skull), '#ffb890', 0.3, s * 0.01, s * 0.008, s * 0.008);
    // 上颌的牙：从上唇线垂下来，前面一对獠牙最长
    ctx.fillStyle = '#f4ecd0';
    ctx.strokeStyle = rgba('#5a4a30', 0.6);
    ctx.lineWidth = lw(0.002);
    for (let i = 0; i < 8; i++) {
      const x = -0.4 + i * 0.045;
      const hgt = i === 0 ? 0.078 : i === 1 ? 0.05 : 0.036 - i * 0.002;
      const y0 = lipY(x);
      ctx.beginPath();
      ctx.moveTo(x * s, (y0 - 0.004) * s);
      ctx.lineTo((x + 0.012) * s, (y0 + hgt) * s);
      ctx.lineTo((x + 0.026) * s, (y0 + 0.002 - 0.004) * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // 鼻梁上的小角 + 眉骨后面一排向后倾的尖刺
    ctx.fillStyle = deep(SPIKE, 0.1);
    ctx.strokeStyle = rgba(RIM, 0.55);
    ctx.lineWidth = lw(0.004);
    for (const [x, y, hh] of [[-0.32, -0.12, 0.05], [-0.12, -0.15, 0.08], [-0.05, -0.165, 0.11], [0.02, -0.15, 0.105], [0.08, -0.115, 0.08]]) {
      ctx.beginPath();
      ctx.moveTo((x - 0.025) * s, (y + 0.012) * s);
      ctx.lineTo((x + hh * 0.9) * s, (y - hh * 0.8) * s);
      ctx.lineTo((x + 0.03) * s, (y + 0.02) * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // 鼻孔 + 喷烟：生气或蓄力时一缕缕烟 / 火星
    const nx = -0.42 * s;
    const ny = -0.04 * s;
    ctx.fillStyle = '#100303';
    ctx.beginPath();
    ctx.ellipse(nx, ny, s * 0.014, s * 0.008, -0.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba('#ffa880', 0.3);
    ctx.lineWidth = lw(0.003);
    ctx.beginPath();
    ctx.ellipse(nx, ny, s * 0.02, s * 0.013, -0.5, Math.PI * 0.9, Math.PI * 1.9);
    ctx.stroke();
    if (angry || kind) {
      const rr = seeded(9);
      for (let i = 0; i < 7; i++) {
        const u = (t * 1.2 + rr()) % 1;
        const px = nx - u * 0.14 * s - rr() * 0.02 * s;
        const py = ny - u * 0.14 * s - Math.sin(u * 6 + i) * 0.01 * s;
        ctx.globalAlpha = (1 - u) * 0.8;
        glow(ctx, px, py, s * (0.012 + u * 0.016), kind === 'ice' ? '#bfe8ff' : kind === 'bolt' ? '#bfd4ff' : i % 2 ? '#ffd070' : '#ff6a2a', 0.9);
      }
      ctx.globalAlpha = 1;
    }
    // 眼睛：杏仁形竖瞳，压在眉骨下；偶尔眨一下；倒下时暗下去，重生时亮起来
    {
      const ex = -0.125 * s;
      const ey = -0.082 * s;
      const blink = t % 4.3 > 4.17 || (fallen && rebirth < 0.5);
      glow(ctx, ex, ey, s * 0.085, EYE, 0.7 * eyeGlow);
      ctx.beginPath();
      ctx.moveTo(ex + 0.055 * s, ey - 0.034 * s);
      ctx.quadraticCurveTo(ex - 0.0 * s, ey - 0.04 * s, ex - 0.062 * s, ey + 0.014 * s);
      ctx.quadraticCurveTo(ex - 0.0 * s, ey + 0.03 * s, ex + 0.055 * s, ey - 0.034 * s);
      ctx.fillStyle = blink ? deep(BODY, 0.3) : EYE;
      ctx.fill();
      if (!blink) {
        ctx.fillStyle = '#2a0404';
        ctx.beginPath();
        ctx.ellipse(ex - 0.006 * s, ey - 0.003 * s, s * 0.008, s * 0.021, -0.5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = rgba('#ffffff', 0.8 * eyeGlow);
        ctx.beginPath();
        ctx.arc(ex + 0.012 * s, ey - 0.014 * s, s * 0.005, 0, TAU);
        ctx.fill();
      }
      // 眉骨：压在眼睛上面的一道深色的粗眉，外端向下压（生气的样子）
      ctx.strokeStyle = deep(BODY, 0.85);
      ctx.lineWidth = s * 0.02;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex + s * 0.07, ey - s * 0.062);
      ctx.lineTo(ex - s * 0.075, ey - s * 0.004);
      ctx.stroke();
      ctx.strokeStyle = rgba(RIM, 0.35);
      ctx.lineWidth = s * 0.005;
      ctx.beginPath();
      ctx.moveTo(ex + s * 0.07, ey - s * 0.07);
      ctx.lineTo(ex - s * 0.07, ey - s * 0.012);
      ctx.stroke();
    }
    ctx.restore(); // 头

    // ---------- 近侧的腿（盖在身体前面） ----------
    limb(legPts([[0.3, -0.05, 0.12], [0.22, 0.16, 0.074], [0.4, 0.28 - sway, 0.045], [0.3, 0.46 - sway, 0.032]]), 0.0, 1);
    limb(legPts([[-0.3, 0.0, 0.09], [-0.26, 0.21, 0.058], [-0.38, 0.3 + sway, 0.036], [-0.47, 0.39 + sway, 0.028]]), 0.0, 1);

    // ---------- 近侧的翅膀（在最前面） ----------
    const nearWing = wing(-0.12 * s, -0.27 * s, 0.32, -0.13, q.flap, q.lag, true);

    // ---------- 技能特效 ----------
    const ca = Math.cos(q.hang);
    const sa = Math.sin(q.hang);
    const ly = (0.03 + Math.sin(q.jaw) * 0.22) * G.sc * s;
    const mouth = [G.hx * s - 0.44 * G.sc * s * ca - ly * sa, G.hy * s - 0.44 * G.sc * s * sa + ly * ca];
    const jetAng = Math.PI - 0.1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (kind === 'fire') {
      if (q.stage === 'warn') glow(ctx, mouth[0] + 0.02 * s, mouth[1], s * (0.1 + 0.3 * q.k), '#ffd070', 0.3 + 0.5 * q.k, true);
      else flameJet(ctx, mouth[0], mouth[1], jetAng, 1.45 * s, 0.34 * s, t, q.jet);
    } else if (kind === 'ice') {
      if (q.stage === 'warn') {
        // 冷雾在嘴边聚起来，向下沉
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
        // 雷球：头顶聚起来的一团电光，外面转着几圈电弧
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
      // 沿翼骨窜动的电弧
      const fr = Math.floor(t * 14);
      const n = 2 + Math.round((cast ? 1 : q.k) * 5);
      const tipList = [...nearWing.tips, ...farWing.tips];
      for (let i = 0; i < n; i++) {
        const [tx, ty] = tipList[i % tipList.length];
        veins(ctx, tx, ty, 0.24 * s, -1.6 + (i % 3) * 0.5, 2, '#bfe4ff', 0.5 + 0.4 * (cast ? 1 : q.k), fr * 5 + i * 11, s * 0.014);
      }
      // 释放：从嘴里射出一道主闪电（带分叉），三层描边做出光晕
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
      const rr = seeded(17);
      for (let i = 0; i < (rage ? 12 : 6); i++) {
        const u = (t * 0.7 + rr()) % 1;
        const px = (rr() - 0.5) * 1.8 * s;
        const py = -0.1 * s - u * 0.6 * s;
        ctx.globalAlpha = (1 - u) * 0.8 * (fallen ? 0.4 + 0.6 * rebirth : 1);
        glow(ctx, px, py, s * 0.015 * (1 + rr()), i % 2 ? '#ffb040' : '#ff5a2a', 0.9);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (dark > 0.5 || fallen) {
      // 黑龙 / 倒下的龙身上不断升起的黑烟（普通叠加，不发光）
      const rr = seeded(23);
      for (let i = 0; i < 8; i++) {
        const u = (t * 0.35 + rr()) % 1;
        const px = (-0.5 + rr() * 1.3) * s;
        const py = (-0.1 - u * 0.7) * s;
        glow(ctx, px, py, s * (0.06 + u * 0.1), '#12081a', (1 - u) * 0.3 * (fallen ? 0.5 + 0.5 * (1 - rebirth) : 1));
      }
    }

    ctx.restore();
  };
})((globalThis.TD = globalThis.TD || {}));
