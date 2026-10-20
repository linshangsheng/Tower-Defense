// 主角动作（设计书 92）：攻击姿势随武器变化，5 个主动技能各有一套华丽的施法动作
// pose(st, aim) 只算数字（躯干倾斜、身体前后、手臂角度、另一只手放哪里……），K.hero 按它画；
// fx(...) 画施法时脚下和身边的光效，渲染器在主角前后各调用一次
(function (TD) {
  'use strict';

  const A = (TD.heroAnim = {});
  const TAU = Math.PI * 2;

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const ease = (x) => {
    x = clamp(x, 0, 1);
    return x * x * (3 - 2 * x);
  };
  const mix = (a, b, k) => a + (b - a) * k;

  // 施法动作的时长（秒）
  A.CAST_DUR = { arrowRain: 1.8, thunder: 1.1, drum: 1.1, repair: 1.3, frost: 1.2 };
  // 出手前的蓄力时间 / 出手后的收势时间（秒），按武器造型
  const WIND = { bow: 0.3, crossbow: 0.12, staff: 0.3, orb: 0.25, cannon: 0.25, boomerang: 0.32 };
  const REL = { bow: 0.22, crossbow: 0.2, staff: 0.28, orb: 0.24, cannon: 0.38, boomerang: 0.3 };
  // 弓弦最多拉开多少像素（K.weapon 里同样用这个数）
  A.DRAW_PX = 10;

  A.weaponBase = function (weapon) {
    const w = TD.data && TD.data.weapons[weapon];
    return (w && w.look && w.look.base) || weapon || 'bow';
  };

  // 姿势。st: { weapon, shotAge, readyIn（离下一次出手还有多久）, castId, castAge, castAim, mood, t }
  // 返回值里的角度都是弧度，位移是像素；rear / rearAbs 是另一只手的位置：
  //   rear = 手臂坐标系里的 (u, v)（单位 s），rearAbs = 躯干坐标系里的 (x, y)（单位 s）
  A.pose = function (st, aim) {
    const base = A.weaponBase(st.weapon);
    const P = { base, torso: 0, dx: 0, dy: 0, jump: 0, arm: aim, rear: null, rearAbs: null, wind: 0, rel: 0, charge: 0, draw: 0, cape: 0, kick: 0, cast: null, castAge: 0, castP: 0, castBlend: 0 };
    if (st.mood === 'lose' || st.mood === 'win') return P;
    const t = st.t || 0;
    // 站着不动时的呼吸：躯干和手臂轻轻起伏
    P.torso += Math.sin(t * 1.7) * 0.012;
    P.arm += Math.sin(t * 1.3) * 0.025;

    // ----- 攻击：蓄力（出手前）→ 出手 → 收势 -----
    const W = WIND[base] || 0.3;
    const R = REL[base] || 0.25;
    const rel = st.shotAge !== undefined && st.shotAge >= 0 && st.shotAge < R ? 1 - st.shotAge / R : 0;
    let wind = st.readyIn > 0 && st.readyIn < W ? 1 - st.readyIn / W : 0;
    wind *= 1 - rel;
    const e = ease(wind);
    const rr = ease(rel);
    P.wind = e;
    P.rel = rr;
    switch (base) {
      case 'crossbow':
        // 端平，扣扳机的一下往后顶；另一只手托着弩身
        P.torso += 0.02 * e - 0.04 * rr;
        P.dy += 0.6 * e;
        P.dx -= 2.5 * rr;
        P.kick = 3 * rr;
        P.rear = { u: 0.6, v: 0.1 };
        P.cape += 3 * rr;
        break;
      case 'staff':
        // 法杖往上举着蓄力，出手时向前一指
        P.arm += -0.3 * e + 0.12 * rr;
        P.torso += -0.04 * e + 0.07 * rr;
        P.dx += 1.5 * rr;
        P.charge = e;
        P.rear = { u: 0.34, v: 0.07 };
        break;
      case 'orb':
        // 手托法球抬起，出手时推掌；另一只手在球下聚气
        P.arm += -0.5 * e + 0.2 * rr;
        P.torso += -0.03 * e + 0.06 * rr;
        P.dx += 1.2 * rr;
        P.charge = e;
        P.rear = { u: 0.55, v: 0.42 - 0.1 * e };
        break;
      case 'cannon':
        // 稳住身子，开炮时整个人被后坐力顶得往后仰
        P.dy += 1.5 * e;
        P.torso += 0.03 * e - 0.1 * rr;
        P.dx -= 5 * rr;
        P.cape += 6 * rr;
        P.rear = { u: 0.5, v: 0.22 };
        break;
      case 'boomerang': {
        // 手臂向后高高扬起，再大幅甩出去
        const age = st.shotAge;
        if (rel > 0) {
          const k = age < 0.06 ? age / 0.06 : 1;
          P.arm += age < 0.06 ? mix(-1.2, 0.5, ease(k)) : 0.5 * rr;
        } else P.arm += -1.2 * e;
        P.torso += -0.1 * e + 0.14 * rr;
        P.dx += -2 * e + 3 * rr;
        P.rearAbs = { x: 0.1 + 0.3 * e - 0.4 * rr, y: -1.15 + 0.1 * rr };
        P.cape += 4 * rr;
        break;
      }
      default: {
        // 弓：向后拉满，松手时身体向前一送、另一只手顺势甩开
        P.draw = e;
        P.torso += -0.05 * e + 0.035 * rr;
        P.dx += -1.8 * e + 1.5 * rr;
        P.rear = { u: 0.24 - (A.DRAW_PX / 32) * e - 0.35 * rr, v: 0.02 };
        P.cape += 3 * rr;
      }
    }

    // ----- 施法：盖过攻击姿势 -----
    const dur = A.CAST_DUR[st.castId];
    if (dur && st.castAge !== undefined && st.castAge >= 0 && st.castAge < dur) {
      const a = st.castAge;
      const b = ease(a / 0.1) * ease((dur - a) / 0.25);
      const C = castPose(st.castId, a, aim, st.castAim, P);
      P.cast = st.castId;
      P.castAge = a;
      P.castP = a / dur;
      P.castBlend = b;
      P.arm = mix(P.arm, C.arm, b);
      P.torso = mix(P.torso, C.torso, b);
      P.dx = mix(P.dx, C.dx, b);
      P.dy = mix(P.dy, C.dy, b);
      P.jump = C.jump * b;
      P.cape = mix(P.cape, C.cape, b);
      P.charge = mix(P.charge, C.charge, b);
      P.draw = P.draw * (1 - b);
      P.kick = P.kick * (1 - b);
      if (b > 0.25) {
        P.rear = C.rear || null;
        P.rearAbs = C.rearAbs || null;
      }
    }
    return P;
  };

  // 5 个技能的施法动作（a = 施法后经过的秒数）
  function castPose(id, a, aim, castAim, P) {
    const C = { arm: aim, torso: 0, dx: 0, dy: 0, jump: 0, cape: 0, charge: 1, rear: null, rearAbs: null };
    switch (id) {
      case 'arrowRain':
        // 双手把武器高举过头，向天空射出一束金光；身体后仰，缓缓摇晃
        C.arm = -1.45 + Math.sin(a * 5) * 0.1;
        C.torso = -0.13;
        C.dx = -1.5;
        C.cape = 6;
        C.rear = { u: 0.34, v: 0.07 };
        break;
      case 'thunder': {
        // 举起武器唤来雷电（雷落下的一瞬间在最高点停住），接着猛地劈下
        const up = ease(a / 0.14);
        const slam = ease((a - 0.55) / 0.14);
        C.arm = mix(mix(aim, -1.5, up), aim + 0.25, slam);
        C.torso = mix(-0.14 * up, 0.16, slam);
        C.dx = mix(-1 * up, 4, slam);
        C.cape = mix(7, -2, slam);
        C.rear = { u: 0.34, v: 0.07 };
        break;
      }
      case 'drum': {
        // 先蹲一下蓄力，再高高跳起、双拳上举，仰头怒吼
        const crouch = ease(a / 0.15) * (1 - ease((a - 0.15) / 0.1));
        const air = a > 0.15 && a < 0.55 ? Math.sin(((a - 0.15) / 0.4) * Math.PI) : 0;
        const up = ease((a - 0.12) / 0.15);
        C.dy = 4 * crouch;
        C.jump = -14 * air;
        C.arm = mix(aim, -1.15 + Math.sin(a * 24) * 0.05, up);
        C.torso = 0.1 * crouch - 0.12 * up;
        C.cape = 8 * air + 3;
        C.rearAbs = { x: -0.12 + Math.sin(a * 24 + 1) * 0.02, y: -2.2 };
        C.charge = 0.7;
        break;
      }
      case 'repair': {
        // 单膝跪下，双手按向城墙，绿光从掌心渗进砖缝
        const kneel = ease(a / 0.2);
        C.arm = mix(aim, 1.05, kneel);
        C.torso = 0.2 * kneel;
        C.dy = 5 * kneel;
        C.dx = 3 * kneel;
        C.cape = 1;
        C.rear = { u: 0.3, v: 0.12 };
        break;
      }
      case 'frost': {
        // 手臂先向后蓄势，再朝选定的车道横扫出去，指尖凝出冰晶
        const back = ease(a / 0.25);
        const sweep = ease((a - 0.25) / 0.2);
        const target = castAim === undefined ? aim : castAim;
        C.arm = mix(mix(aim, -0.9, back), target + 0.1, sweep);
        C.torso = mix(-0.1 * back, 0.15, sweep);
        C.dx = 3 * sweep;
        C.cape = mix(2, 6, sweep);
        C.rearAbs = { x: -0.5 + 0.1 * Math.sin(a * 8), y: -1.0 };
        break;
      }
    }
    return C;
  }

  // ---------- 武器尖端的光效（在武器坐标系里画，原点在握把，向前为 +x；K.hero 调用） ----------
  A.tipFx = function (ctx, P, s, t) {
    if (!P.cast || P.castBlend < 0.05) return;
    const K = TD.creatures;
    const a = P.castAge;
    const k = P.castBlend;
    const tx = s * 0.9;
    ctx.save();
    switch (P.cast) {
      case 'arrowRain': {
        K.glow(ctx, tx, 0, s * 0.7, '#ffd23f', 0.75 * k, true);
        // 一道道金色光束从武器尖端射向天空
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (let i = 0; i < 7; i++) {
          const u = (a * 2.6 + i / 7) % 1;
          ctx.strokeStyle = `rgba(255,214,90,${(1 - u) * 0.85 * k})`;
          ctx.lineWidth = 2.2 - u;
          ctx.beginPath();
          ctx.moveTo(tx + u * s * 2.6, ((i % 3) - 1) * s * 0.07);
          ctx.lineTo(tx + u * s * 2.6 + s * 0.45, ((i % 3) - 1) * s * 0.07);
          ctx.stroke();
        }
        K.sparkles(ctx, tx + s * 0.3, 0, s * 0.8, s * 0.35, 8, t, '#fff0b0', 11, 1.5);
        break;
      }
      case 'thunder': {
        const slam = ease((a - 0.55) / 0.14) * (1 - ease((a - 0.7) / 0.3));
        K.glow(ctx, tx, 0, s * (0.7 + slam * 0.7), '#d8b8ff', (0.7 + slam * 0.3) * k, true);
        const seed = Math.floor(t * 22);
        for (let i = 0; i < 4; i++) K.veins(ctx, tx, 0, s * (0.5 + slam * 0.4), (i / 4) * TAU + seed, 2, i % 2 ? '#ffffff' : '#b98cff', 0.9 * k, seed * 5 + i, 1.6);
        break;
      }
      case 'drum':
        K.glow(ctx, tx, 0, s * 0.55, '#ffb347', 0.6 * k);
        break;
      case 'repair':
        K.glow(ctx, tx, 0, s * 0.7, '#7dffa0', 0.7 * k, true);
        K.sparkles(ctx, tx, 0, s * 0.5, s * 0.3, 6, t, '#c8ffd0', 7, 1.4);
        break;
      case 'frost': {
        K.glow(ctx, tx, 0, s * 0.8, '#8fe0ff', 0.75 * k, true);
        // 绕着尖端转的一圈冰晶
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 6; i++) {
          const q = t * 3 + (i / 6) * TAU;
          const r = s * (0.38 + 0.08 * Math.sin(t * 5 + i));
          const x = tx + Math.cos(q) * r;
          const y = Math.sin(q) * r * 0.8;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(q);
          ctx.fillStyle = `rgba(200,240,255,${0.85 * k})`;
          ctx.beginPath();
          ctx.moveTo(0, -s * 0.09);
          ctx.lineTo(s * 0.04, 0);
          ctx.lineTo(0, s * 0.09);
          ctx.lineTo(-s * 0.04, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        break;
      }
    }
    ctx.restore();
  };

  // ---------- 脚下和身边的大光效（渲染器在主角后面画 'back'、前面画 'front'） ----------
  // x, y 是主角脚下的位置；age 是施法后经过的秒数
  A.fx = function (ctx, x, y, id, age, t, layer) {
    const dur = A.CAST_DUR[id];
    if (!dur || age === undefined || age < 0 || age >= dur) return;
    const K = TD.creatures;
    const p = age / dur;
    const env = ease(age / 0.12) * ease((dur - age) / 0.4);
    const front = layer === 'front';
    ctx.save();
    ctx.translate(x, y);
    ctx.lineCap = 'round';
    switch (id) {
      case 'arrowRain':
        if (!front) {
          groundCircle(ctx, 54, 15, t * 0.9, '#ffd23f', env, 12);
          groundCircle(ctx, 36, 10, -t * 1.3, '#fff0b0', env * 0.8, 8);
          pillar(ctx, 0, 0, 70, 190, '#ffd23f', env * 0.55);
        } else {
          // 金色的光点从脚下升起
          for (let i = 0; i < 14; i++) {
            const u = (age * 0.9 + i * 0.137) % 1;
            const px = Math.sin(i * 12.9 + t) * 30;
            K.dot(ctx, px, -u * 150, 1.6 + (i % 3) * 0.5, i % 2 ? '#fff0b0' : '#ffd23f', (1 - u) * env);
          }
        }
        break;
      case 'thunder':
        if (!front) {
          groundCircle(ctx, 52, 14, t * 2, '#b98cff', env, 10);
          // 脚下四处乱窜的电弧
          const seed = Math.floor(t * 18);
          for (let i = 0; i < 5; i++) K.veins(ctx, 0, -2, 46, -0.1 + ((i - 2) * Math.PI) / 7 + (i % 2 ? Math.PI : 0) * 0.0, 1, i % 2 ? '#ffffff' : '#c8a0ff', 0.8 * env, seed * 7 + i, 1.4);
          pillar(ctx, 0, 0, 60, 200, '#c8a0ff', env * 0.4);
        } else if (age < 0.18) {
          // 雷落下的一瞬间，整个人被白光照亮
          K.glow(ctx, 6, -52, 110, '#e8d8ff', (1 - age / 0.18) * 0.5);
        } else if (age > 0.55 && age < 0.85) {
          // 劈下时的冲击环
          ring(ctx, 14, -30, (age - 0.55) / 0.3, 90, '#d8b8ff', 0.9);
        }
        break;
      case 'drum':
        if (!front) {
          // 三圈金橙色的冲击波从脚下扩散开
          for (let i = 0; i < 3; i++) {
            const u = clamp((age - 0.15 - i * 0.14) / 0.7, 0, 1);
            if (u <= 0 || u >= 1) continue;
            ctx.strokeStyle = `rgba(255,${170 + i * 25},70,${(1 - u) * 0.85})`;
            ctx.lineWidth = 4 * (1 - u) + 1;
            ctx.beginPath();
            ctx.ellipse(0, -2, 14 + u * 150, 5 + u * 36, 0, 0, TAU);
            ctx.stroke();
          }
          K.glow(ctx, 0, -4, 70, '#ff9a3c', 0.4 * env);
        } else {
          // 怒吼：从头部向前扩散的几道声波弧线
          for (let i = 0; i < 3; i++) {
            const u = clamp((age - 0.2 - i * 0.12) / 0.5, 0, 1);
            if (u <= 0 || u >= 1) continue;
            ctx.strokeStyle = `rgba(255,214,120,${(1 - u) * 0.8})`;
            ctx.lineWidth = 2.4 - u;
            ctx.beginPath();
            ctx.arc(14, -66, 14 + u * 52, -0.7, 0.7);
            ctx.stroke();
          }
        }
        break;
      case 'repair':
        if (!front) {
          groundCircle(ctx, 50, 14, -t * 1.1, '#7dffa0', env, 6);
          pillar(ctx, 0, 0, 70, 130, '#7dffa0', env * 0.4);
        } else {
          // 一个个绿色的十字从城墙上飘起来
          for (let i = 0; i < 9; i++) {
            const u = (age * 0.8 + i * 0.113) % 1;
            const px = -34 + ((i * 37) % 68) + Math.sin(t * 2 + i) * 4;
            plus(ctx, px, -6 - u * 100, 4 + (i % 3), '#b8ffc8', (1 - u) * env);
          }
        }
        break;
      case 'frost':
        if (!front) {
          groundCircle(ctx, 56, 16, t * 0.7, '#8fe0ff', env, 12);
          // 脚下一圈向外冒出的冰刺
          for (let i = 0; i < 9; i++) {
            const q = (i / 9) * TAU + 0.3;
            const g = ease((age - 0.08 - (i % 3) * 0.06) / 0.2) * env;
            if (g <= 0) continue;
            const bx = Math.cos(q) * 40;
            const by = Math.sin(q) * 11;
            ctx.fillStyle = `rgba(190,235,255,${0.85 * g})`;
            ctx.beginPath();
            ctx.moveTo(bx - 3.5, by);
            ctx.lineTo(bx, by - (14 + (i % 3) * 7) * g);
            ctx.lineTo(bx + 3.5, by);
            ctx.closePath();
            ctx.fill();
          }
          K.glow(ctx, 0, -2, 70, '#8fe0ff', 0.35 * env);
        } else {
          // 飘散的雪花
          for (let i = 0; i < 12; i++) {
            const u = (age * 0.8 + i * 0.09) % 1;
            const px = 20 + u * 90 + Math.sin(t * 3 + i) * 6;
            const py = -50 + Math.sin(i * 7.1) * 26 + u * 14;
            K.dot(ctx, px, py, 1.4 + (i % 3) * 0.6, '#ffffff', (1 - u) * env);
          }
        }
        break;
    }
    ctx.restore();
  };

  // 脚下旋转的魔法阵：椭圆环 + 一圈刻度
  function groundCircle(ctx, rx, ry, rot, color, a, ticks) {
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(0, -2);
    ctx.scale(1, ry / rx);
    ctx.strokeStyle = TD.creatures.rgba(color, 0.85 * a);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, rx * 0.78, 0, TAU);
    ctx.stroke();
    ctx.rotate(rot);
    for (let i = 0; i < ticks; i++) {
      const q = (i / ticks) * TAU;
      const l = i % 2 ? rx * 0.1 : rx * 0.2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(q) * rx * 0.78, Math.sin(q) * rx * 0.78);
      ctx.lineTo(Math.cos(q) * (rx * 0.78 - l), Math.sin(q) * (rx * 0.78 - l));
      ctx.stroke();
    }
    ctx.restore();
  }

  // 一道向上的光柱：用拉长的径向渐变，两侧和顶端都是柔和渐隐的
  function pillar(ctx, x, y, w, h, color, a) {
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y - h * 0.4);
    ctx.scale(w / h, 1);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, h * 0.62);
    g.addColorStop(0, TD.creatures.rgba(color, a));
    g.addColorStop(1, TD.creatures.rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, h * 0.62, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function ring(ctx, x, y, u, r, color, a) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = TD.creatures.rgba(color, (1 - u) * a);
    ctx.lineWidth = 3 * (1 - u) + 1;
    ctx.beginPath();
    ctx.ellipse(x, y, 10 + u * r, (10 + u * r) * 0.5, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function plus(ctx, x, y, r, color, a) {
    if (a <= 0.02) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = TD.creatures.rgba(color, a);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x + r, y);
    ctx.moveTo(x, y - r);
    ctx.lineTo(x, y + r);
    ctx.stroke();
    ctx.restore();
  }
})((globalThis.TD = globalThis.TD || {}));
