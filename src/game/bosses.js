// Boss AI（设计书 18.5、19、20、21、22、23、33、52）：从 battle.js 拆出，挂到 Battle 原型上
// 每个 Boss 的 update 由 Battle.updateMonsters 按 def.ai 调用（见 BOSS_UPDATE）
(function (TD) {
  'use strict';

  const C = TD.config;
  const D = TD.data;

  Object.assign(TD.Battle.prototype, {
    // 出生时的 AI 状态（spawnMonster 调用）
    initBossAI(m) {
      const ai = m.def.ai;
      if (ai === 'boarKing') m.ai = { phase: 1, summonTimer: 3, chargeTimer: 2, mode: 'walk', chargeDmg: 0, warnTimer: 0, laneTimer: D.boarKing.laneSwitchEvery };
      else if (ai === 'kingScorpion') m.ai = { phase: 1, mode: 'walk', burrowTimer: D.kingScorpion.firstBurrow, clawTimer: D.kingScorpion.clawEvery };
      else if (ai === 'pharaoh') {
        m.ai = { phase: 1, mode: 'walk', stormTimer: D.pharaoh.stormFirst, summonTimer: 4, healTimer: 1, shieldTimer: -1 };
        m.shield = 0;
        m.shieldMax = 0;
      } else if (ai === 'boneMage') m.ai = { phase: 1, mode: 'walk', summonTimer: D.boneMage.summonFirst, revived: false };
      else if (ai === 'witch') m.ai = { phase: 1, mode: 'walk', fogTimer: D.witch.fogFirst, cookTimer: 3, pourTimer: 2 };
      else if (ai === 'iceGiant') m.ai = { phase: 1, mode: 'walk', freezeTimer: D.iceGiant.freezeFirst };
      else if (ai === 'frostQueen') {
        const Q = D.frostQueen;
        m.ai = { phase: 1, mode: 'walk', blizzardTimer: Q.blizzardFirst, sealTimer: 3, wolfTimer: 2, dragonTimer: 1 };
      } else if (ai === 'rockGolem') m.ai = { phase: 1, mode: 'walk', stompTimer: D.rockGolem.stompFirst, warn: 0 };
      else if (ai === 'inkBoss') m.ai = { phase: 1, mode: 'walk', summonTimer: 2, slamTimer: 4, chargeDmg: 0, rageTimer: -1 };
      else if (ai === 'windGiant') {
        const G = D.windGiant;
        m.ai = { phase: 1, mode: 'walk', kiteTimer: G.kiteFirst, gustTimer: G.gustFirst, warnTimer: 0, chargeDmg: 0 };
      } else if (ai === 'thunderKing') {
        const T = D.thunderKing;
        m.ai = { phase: 1, mode: 'walk', summonTimer: T.summonFirst, summons: 0, chargeTimer: T.chargeFirst, warnTimer: 0, chargeDmg: 0 };
      } else if (ai === 'pearlClam') m.ai = { phase: 1, mode: 'walk', open: false, cycleTimer: 0, pearlTimer: 0 };
      else if (ai === 'abyssDragon') m.ai = { form: 1, phase: 1, mode: 'walk', holdX: D.abyssDragon.holdX, skillTimer: D.abyssDragon.skillFirst, skill: null, last: null, idx: 0, warnTimer: 0, warnMax: 0, chargeDmg: 0, summonTimer: 7, boltsLeft: 0, boltTimer: 0 };
      else if (ai === 'octoKing') m.ai = { phase: 1, mode: 'walk', summonTimer: D.octoKing.summonFirst, slots: null, guarded: false, alive: 0 };
    },

    updateBoarKing(m, dt) {
      const B = D.boarKing;
      const ai = m.ai;
      const ratio = m.hp / m.maxHp;
      if (ai.phase === 1 && ratio < B.chargeBelow) {
        ai.phase = 2;
        ai.chargeTimer = 1.5;
        this.emit('bossPhase', { m, phase: 2, text: '咕噜大王愤怒了：野猪冲锋！' });
      }
      if (ai.phase === 2 && ratio < B.enrageBelow) {
        ai.phase = 3;
        this.emit('bossPhase', { m, phase: 3, text: '咕噜大王狂暴了！' });
      }
      // 召唤
      ai.summonTimer -= dt;
      if (ai.summonTimer <= 0) {
        ai.summonTimer += ai.phase === 3 ? B.summonEveryEnraged : B.summonEvery;
        for (let i = 0; i < B.summonCount; i++) {
          const lane = this.rng.int(this.lanes);
          this.spawnMonster(B.summonType, lane, Math.min(C.spawnX, m.x + 30 + this.rng() * 40));
        }
        this.emit('bossSummon', { m });
      }
      // 换道
      if (ai.phase === 3 && ai.mode === 'walk' && this.lanes > 1) {
        ai.laneTimer -= dt;
        if (ai.laneTimer <= 0) {
          ai.laneTimer += B.laneSwitchEvery;
          let lane = this.rng.int(this.lanes - 1);
          if (lane >= m.lane) lane++;
          m.lane = lane;
          m.y = this.laneY(lane);
          this.emit('laneSwitch', { m });
        }
      }
      // 第一、二阶段：走到中段停下指挥；第三阶段：压向城墙
      if (ai.mode === 'walk' && ai.phase < 3 && m.x <= B.holdX) {
        m.x = B.holdX;
        ai.mode = 'hold';
      }
      if (ai.mode === 'hold' && ai.phase === 3) ai.mode = 'walk';
      if (ai.phase < 2) return;
      // 冲锋
      if (ai.mode === 'hold') {
        ai.chargeTimer -= dt;
        if (ai.chargeTimer <= 0 && ai.phase === 2) {
          ai.mode = 'warn';
          ai.warnTimer = B.chargeWarn;
          ai.chargeDmg = 0;
          this.emit('bossWarn', { m, lane: m.lane, duration: B.chargeWarn });
        }
      } else if (ai.mode === 'return') {
        m.x = Math.min(B.holdX, m.x + B.returnSpeed * dt);
        if (m.x >= B.holdX) {
          ai.mode = ai.phase === 3 ? 'walk' : 'hold';
        }
      } else if (ai.mode === 'warn') {
        ai.warnTimer -= dt;
        if (ai.warnTimer <= 0) {
          ai.mode = 'charge';
          this.emit('bossCharge', { m });
        }
      } else if (ai.mode === 'charge') {
        if (this.time >= m.frozenUntil) {
          let sp = B.chargeSpeed;
          for (const e of this.laneEffects) if (e.lane === m.lane && this.time < e.until && e.type === 'frost') sp *= 1 - e.slow;
          m.x -= sp * dt;
        }
        if (m.x <= this.wallStopX(m)) {
          m.x = this.wallStopX(m);
          this.hitWall(B.chargeDamage * this.D, m, true);
          this.emit('chargeHit', { m });
          ai.mode = 'return';
          ai.chargeTimer = B.chargeEvery;
        }
      }
    },

    // 钳钳：钻地换道突袭，贴墙后钳击（设计书 19.3）
    updateKingScorpion(m, dt) {
      const K = D.kingScorpion;
      const ai = m.ai;
      const atWall = m.x <= this.wallStopX(m) + 1;
      if (ai.mode === 'walk') {
        if (atWall) {
          ai.clawTimer -= dt;
          if (ai.clawTimer <= 0 && this.time >= m.frozenUntil && this.time >= m.stunUntil) {
            ai.clawTimer = K.clawEvery;
            this.hitWall(K.clawDamage * this.D, m, true);
            this.emit('claw', { m });
          }
          return;
        }
        ai.burrowTimer -= dt;
        if (ai.burrowTimer <= 0 && m.x < C.width - 40) {
          ai.mode = 'under';
          ai.underTimer = K.underTime;
          m.burrowed = true;
          let lane = this.lanes > 1 ? this.rng.int(this.lanes - 1) : m.lane;
          if (this.lanes > 1 && lane >= m.lane) lane++;
          ai.toLane = lane;
          ai.toX = Math.max(this.wallStopX(m), m.x - K.jump);
          ai.warned = false;
          this.emit('burrow', { m, boss: true });
        }
      } else if (ai.mode === 'under') {
        ai.underTimer -= dt;
        if (!ai.warned && ai.underTimer <= 1) {
          ai.warned = true;
          this.emit('surfaceWarn', { lane: ai.toLane, x: ai.toX, y: this.laneY(ai.toLane), duration: 1 });
        }
        if (ai.underTimer <= 0) {
          m.lane = ai.toLane;
          m.y = this.laneY(m.lane);
          m.x = ai.toX;
          m.burrowed = false;
          ai.mode = 'walk';
          ai.burrowTimer = K.burrowEvery;
          this.emit('surface', { m, boss: true });
        }
      }
    },

    // 胖法老：沙暴、召唤与治疗、金字塔护盾（设计书 19.3）
    updatePharaoh(m, dt) {
      const F = D.pharaoh;
      const ai = m.ai;
      const ratio = m.hp / m.maxHp;
      if (ai.phase === 1 && ratio < F.phase2Below) {
        ai.phase = 2;
        this.emit('bossPhase', { m, phase: 2, text: '胖法老召唤了木乃伊！' });
      }
      if (ai.phase === 2 && ratio < F.phase3Below) {
        ai.phase = 3;
        this.raiseShield(m);
        this.emit('bossPhase', { m, phase: 3, text: '金字塔护盾！用魔法击破它！' });
      }
      // 沙暴
      ai.stormTimer -= dt;
      if (ai.stormTimer <= 0) {
        ai.stormTimer = F.stormEvery;
        this.buffs.push({ aspd: F.stormAspd, until: this.time + F.stormDuration, src: 'sandstorm' });
        this.emit('sandstorm', { duration: F.stormDuration });
      }
      if (ai.phase >= 2) {
        ai.summonTimer -= dt;
        if (ai.summonTimer <= 0) {
          ai.summonTimer = F.summonEvery;
          for (let i = 0; i < F.summonCount; i++) this.spawnMonster(F.summonType, this.rng.int(this.lanes), Math.min(C.spawnX, m.x + 40 + this.rng() * 40));
          this.emit('bossSummon', { m });
        }
        ai.healTimer -= dt;
        if (ai.healTimer <= 0) {
          ai.healTimer = 1;
          this.healAround(m, F.healRadius, F.healPct);
        }
      }
      if (ai.phase === 3 && m.shield <= 0 && ai.shieldTimer > 0) {
        ai.shieldTimer -= dt;
        if (ai.shieldTimer <= 0) this.raiseShield(m);
      }
      // 第一、二阶段停在中段
      if (ai.mode === 'walk' && ai.phase < 3 && m.x <= F.holdX) {
        m.x = F.holdX;
        ai.mode = 'hold';
      }
      if (ai.mode === 'hold' && ai.phase === 3) ai.mode = 'walk';
    },

    // 骨头先生：中段召唤小幽灵，第一次倒下后复活（设计书 21.3）
    updateBoneMage(m, dt) {
      const B = D.boneMage;
      const ai = m.ai;
      if (ai.mode === 'bones') {
        ai.reviveTimer -= dt;
        if (ai.reviveTimer <= 0) {
          m.bones = false;
          m.hp = m.maxHp * B.reviveHp;
          ai.mode = 'walk';
          ai.summonTimer = 0;
          this.emit('bossPhase', { m, phase: 2, text: '骨头先生复活了！' });
        }
        return;
      }
      ai.summonTimer -= dt;
      if (ai.summonTimer <= 0 && m.x < C.width - 30) {
        ai.summonTimer = B.summonEvery;
        const lanes = [];
        for (let i = 0; i < this.lanes; i++) lanes.push(i);
        for (let k = 0; k < Math.min(B.summonLanes, this.lanes); k++) {
          const lane = lanes.splice(this.rng.int(lanes.length), 1)[0];
          const g = this.spawnMonster(B.summonType, lane, Math.min(C.spawnX, m.x + 30));
          g.splitFrom = { x: m.x, y: m.y };
        }
        this.emit('bossSummon', { m });
      }
      if (ai.mode === 'walk' && !ai.revived && m.x <= B.holdX) {
        m.x = B.holdX;
        ai.mode = 'hold';
      }
    },

    boneDown(m) {
      m.hp = 1;
      m.bones = true;
      m.ai.revived = true;
      m.ai.mode = 'bones';
      m.ai.reviveTimer = D.boneMage.reviveTime;
      m.burnUntil = 0;
      this.emit('boneDown', { m });
    },

    // 毒汤婆婆：毒雾、煮汤、大锅倾倒（设计书 21.3）
    updateWitch(m, dt) {
      const W2 = D.witch;
      const ai = m.ai;
      const ratio = m.hp / m.maxHp;
      if (ai.phase === 1 && ratio < W2.phase2Below) {
        ai.phase = 2;
        this.emit('bossPhase', { m, phase: 2, text: '毒汤婆婆开始煮汤了！' });
      }
      if (ai.phase === 2 && ratio < W2.phase3Below) {
        ai.phase = 3;
        ai.pourTimer = 0.5;
        this.emit('bossPhase', { m, phase: 3, text: '大锅倾倒！毒池让怪物加速！' });
      }
      ai.fogTimer -= dt;
      if (ai.fogTimer <= 0) {
        ai.fogTimer = ai.phase === 3 ? W2.fogEveryP3 : W2.fogEvery;
        this.addWallDot(W2.fogDps * this.D, W2.fogDuration, 'fog', false, m.type);
        this.emit('poisonFog', { duration: W2.fogDuration });
      }
      if (ai.phase >= 2) {
        ai.cookTimer -= dt;
        if (ai.cookTimer <= 0) {
          ai.cookTimer = W2.cookEvery;
          let n = 0;
          for (const o of this.monsters) {
            if (o.dead || o.def.boss || o.cooked) continue;
            o.cooked = true;
            o.maxHp *= 1 + W2.cookHp;
            o.hp *= 1 + W2.cookHp;
            n++;
          }
          for (let i = 0; i < W2.summonCount; i++) this.spawnMonster(W2.summonType, this.rng.int(this.lanes), Math.min(C.spawnX, m.x + 40 + this.rng() * 40));
          this.emit('cook', { m, count: n });
        }
      }
      if (ai.phase === 3) {
        ai.pourTimer -= dt;
        if (ai.pourTimer <= 0) {
          ai.pourTimer = W2.pourEvery;
          const lanes = [];
          for (let i = 0; i < this.lanes; i++) lanes.push(i);
          for (let k = 0; k < Math.min(W2.pourLanes, this.lanes); k++) {
            const lane = lanes.splice(this.rng.int(lanes.length), 1)[0];
            this.laneEffects.push({ lane, type: 'poison', haste: W2.poolSpeed, until: this.time + W2.poolDuration, start: this.time });
          }
          this.emit('pour', { m });
        }
      }
      if (ai.mode === 'walk' && ai.phase < 3 && m.x <= W2.holdX) {
        m.x = W2.holdX;
        ai.mode = 'hold';
      }
      if (ai.mode === 'hold' && ai.phase === 3) ai.mode = 'walk';
    },

    // 冰棍大叔：周期性冻结一个技能槽（设计书 22.2）
    updateIceGiant(m, dt) {
      const G = D.iceGiant;
      const ai = m.ai;
      if (ai.phase === 1 && m.hp / m.maxHp < G.walkBelow) {
        ai.phase = 2;
        if (ai.mode === 'hold') ai.mode = 'walk';
        this.emit('bossPhase', { m, phase: 2, text: '冰棍大叔向城墙走来了！' });
      }
      ai.freezeTimer -= dt;
      if (ai.freezeTimer <= 0 && this.skills.length) {
        ai.freezeTimer = G.freezeEvery;
        const free = this.skills.map((sk, i) => i).filter((i) => !(this.time < (this.skills[i].frozenUntil || 0)));
        if (free.length) {
          const ready = free.filter((i) => this.skills[i].cd <= 0);
          const pick = (ready.length ? ready : free)[this.rng.int((ready.length ? ready : free).length)];
          this.skills[pick].frozenUntil = this.time + G.freezeDuration;
          this.emit('skillFrozen', { index: pick, id: this.skills[pick].id, m });
        }
      }
      if (ai.mode === 'walk' && ai.phase === 1 && m.x <= G.holdX) {
        m.x = G.holdX;
        ai.mode = 'hold';
      }
    },

    // 霜霜女王：暴风雪、冰封城墙、召唤狼群和小冰龙（设计书 22.2）
    updateFrostQueen(m, dt) {
      const Q = D.frostQueen;
      const ai = m.ai;
      const ratio = m.hp / m.maxHp;
      if (ai.phase === 1 && ratio < Q.phase2Below) {
        ai.phase = 2;
        this.emit('bossPhase', { m, phase: 2, text: '霜霜女王冰封了城墙！' });
      }
      if (ai.phase === 2 && ratio < Q.phase3Below) {
        ai.phase = 3;
        this.emit('bossPhase', { m, phase: 3, text: '小冰龙来了！空中地面一起压上！' });
      }
      ai.blizzardTimer -= dt;
      if (ai.blizzardTimer <= 0) {
        ai.blizzardTimer = Q.blizzardEvery;
        this.buffs.push({ aspd: Q.blizzardAspd, until: this.time + Q.blizzardDuration, src: 'blizzard' });
        this.emit('blizzard', { duration: Q.blizzardDuration });
      }
      if (ai.phase >= 2) {
        ai.sealTimer -= dt;
        if (ai.sealTimer <= 0) {
          ai.sealTimer = Q.sealEvery;
          this.wallSealedUntil = this.time + Q.sealDuration;
          this.emit('wallSeal', { duration: Q.sealDuration });
        }
        ai.wolfTimer -= dt;
        if (ai.wolfTimer <= 0) {
          ai.wolfTimer = Q.wolfEvery;
          const lane = this.rng.int(this.lanes);
          for (let i = 0; i < Q.wolfCount; i++) this.spawnMonster('wolf', lane, C.spawnX + i * 24);
          this.emit('bossSummon', { m });
        }
      }
      if (ai.phase === 3) {
        ai.dragonTimer -= dt;
        if (ai.dragonTimer <= 0) {
          ai.dragonTimer = Q.dragonEvery;
          for (let i = 0; i < Q.dragonCount; i++) this.spawnMonster('iceDragon', this.rng.int(this.lanes), Math.min(C.spawnX, m.x + 60));
          this.emit('bossSummon', { m });
        }
      }
      if (ai.mode === 'walk' && ai.phase < 3 && m.x <= Q.holdX) {
        m.x = Q.holdX;
        ai.mode = 'hold';
      }
      if (ai.mode === 'hold' && ai.phase === 3) ai.mode = 'walk';
    },

    // 岩岩：跺脚震晕英雄；死亡爆炸（设计书 23.2）
    updateRockGolem(m, dt) {
      const R = D.rockGolem;
      const ai = m.ai;
      if (ai.warn > 0) {
        ai.warn -= dt;
        if (ai.warn <= 0) {
          this.stunHero(R.stunDuration);
          this.emit('stomp', { m, duration: R.stunDuration });
        }
        return;
      }
      ai.stompTimer -= dt;
      if (ai.stompTimer <= 0) {
        ai.stompTimer = R.stompEvery;
        ai.warn = R.stompWarn;
        this.emit('stompWarn', { m });
      }
    },

    // 墨墨：召唤墨影 → 分身 → 魔王重击 → 裂隙狂暴（设计书 23.2）
    updateInkBoss(m, dt) {
      const K = D.inkBoss;
      const ai = m.ai;
      const ratio = m.hp / m.maxHp;
      if (ai.phase === 1 && ratio < K.phase2Below) {
        ai.phase = 2;
        this.splitInk(m);
        this.emit('bossPhase', { m, phase: 2, text: '墨墨分身了！打掉三个分身！' });
      }
      if (ai.phase === 2 && !m.hidden && ratio < K.phase3Below) {
        ai.phase = 3;
        ai.big = true;
        ai.slamTimer = 3;
        this.emit('bossPhase', { m, phase: 3, text: '魔王形态！蓄力时集中火力打断！' });
      }
      if (ai.phase === 3 && ratio < K.phase4Below) {
        ai.phase = 4;
        ai.rageTimer = K.rageFirst;
        this.emit('bossPhase', { m, phase: 4, text: '裂隙狂暴！30 秒内击败墨墨！' });
      }
      if (m.hidden) return;
      // 召唤墨影（复刻前四章的小怪）
      if (ai.phase < 3 || ai.phase === 4) {
        ai.summonTimer -= dt;
        if (ai.summonTimer <= 0) {
          ai.summonTimer = K.summonEvery;
          for (let i = 0; i < K.summonCount; i++) {
            const sh = this.spawnMonster(this.rng.pick(K.shadePool), this.rng.int(this.lanes), Math.min(C.spawnX, m.x + 40 + this.rng() * 40));
            sh.shade = true;
          }
          this.emit('bossSummon', { m });
        }
      }
      // 魔王重击
      if (ai.phase >= 3) {
        if (ai.mode === 'warn') {
          ai.warnTimer -= dt;
          if (ai.warnTimer <= 0) {
            ai.mode = 'hold';
            ai.slamTimer = K.slamEvery;
            this.hitWall(K.slamDamage * this.D, m, true);
            this.emit('inkSlam', { m });
          }
        } else if (this.time >= m.stunUntil) {
          ai.slamTimer -= dt;
          if (ai.slamTimer <= 0) {
            ai.mode = 'warn';
            ai.warnTimer = K.slamWarn;
            ai.chargeDmg = 0;
            this.emit('bossWarn', { m, lane: m.lane, duration: K.slamWarn, ink: true });
          }
        }
      }
      // 裂隙狂暴倒计时
      if (ai.phase === 4) {
        ai.rageTimer -= dt;
        if (ai.rageTimer <= 0) {
          ai.rageTimer = K.rageEvery;
          this.hitWall(this.wall.max * K.rageRatio, m, true);
          this.emit('riftStrike', { m });
        }
      }
      if (ai.mode === 'walk' && m.x <= K.holdX) {
        m.x = K.holdX;
        ai.mode = 'hold';
      }
    },

    // 呼呼：放风筝 + 大风（设计书 33.3）
    updateWindGiant(m, dt) {
      const G = D.windGiant;
      const ai = m.ai;
      if (ai.phase === 1 && m.hp / m.maxHp < G.lowBelow) {
        ai.phase = 2;
        this.emit('bossPhase', { m, phase: 2, text: '呼呼转得更快了！' });
      }
      if (ai.mode === 'walk') {
        if (m.x <= G.holdX) {
          m.x = G.holdX;
          ai.mode = 'hold';
        }
        return;
      }
      if (this.time < m.stunUntil) return;
      ai.kiteTimer -= dt;
      if (ai.kiteTimer <= 0) {
        ai.kiteTimer = G.kiteEvery;
        for (let i = 0; i < G.kiteCount; i++) this.spawnMonster('kite', this.rng.int(this.lanes), Math.min(C.spawnX, m.x + 30 + this.rng() * 40));
        this.emit('bossSummon', { m });
      }
      if (ai.mode === 'warn') {
        ai.warnTimer -= dt;
        if (ai.warnTimer <= 0) {
          ai.mode = 'hold';
          ai.gustTimer = ai.phase === 2 ? G.gustEveryLow : G.gustEvery;
          for (const o of this.monsters) {
            if (o.dead || o.def.boss) continue;
            o.x = Math.max(this.wallStopX(o), o.x - G.gustPush);
          }
          this.emit('gust', { m });
        }
        return;
      }
      ai.gustTimer -= dt;
      if (ai.gustTimer <= 0) {
        ai.mode = 'warn';
        ai.warnTimer = G.gustWarn;
        ai.chargeDmg = 0;
        this.emit('bossWarn', { m, lane: m.lane, duration: G.gustWarn });
        this.emit('gustWarn', { m });
      }
    },

    // 雷雷：召唤 → 雷暴蓄力 → 暴风雨（设计书 33.3）
    updateThunderKing(m, dt) {
      const T = D.thunderKing;
      const ai = m.ai;
      const ratio = m.hp / m.maxHp;
      if (ai.phase === 1 && ratio < T.phase2Below) {
        ai.phase = 2;
        ai.chargeTimer = 2;
        this.emit('bossPhase', { m, phase: 2, text: '雷雷开始蓄电了！蓄力时集中火力打断！' });
      }
      if (ai.phase === 2 && ratio < T.phase3Below) {
        ai.phase = 3;
        this.storm = true;
        if (ai.mode === 'hold') ai.mode = 'walk';
        this.emit('bossPhase', { m, phase: 3, text: '暴风雨来了！所有怪物都变快了！' });
      }
      if (ai.mode === 'walk' && ai.phase < 3 && m.x <= T.holdX) {
        m.x = T.holdX;
        ai.mode = 'hold';
      }
      if (this.time < m.stunUntil) return;
      // 召唤雷团子（每隔一次再加一只彩虹鸟）
      if (m.x <= C.spawnX) {
        ai.summonTimer -= dt;
        if (ai.summonTimer <= 0) {
          ai.summonTimer = ai.phase === 1 ? T.summonEvery : T.summonEvery2;
          ai.summons++;
          for (let i = 0; i < T.ballCount; i++) this.spawnMonster('thunderBall', this.rng.int(this.lanes), Math.min(C.spawnX, m.x + 30 + this.rng() * 40));
          if (ai.summons % 2 === 0) this.spawnMonster('rainbowBird', this.rng.int(this.lanes), Math.min(C.spawnX, m.x + 50));
          this.emit('bossSummon', { m });
        }
      }
      if (ai.phase < 2) return;
      if (ai.mode === 'warn') {
        ai.warnTimer -= dt;
        if (ai.warnTimer <= 0) {
          ai.mode = ai.phase === 3 ? 'walk' : 'hold';
          ai.chargeTimer = ai.phase === 3 ? T.chargeEvery3 : T.chargeEvery;
          this.hitWall(T.boltDamage * this.D, m, true);
          this.stunHero(T.stunDuration);
          this.emit('thunderBolt', { m });
        }
        return;
      }
      ai.chargeTimer -= dt;
      if (ai.chargeTimer <= 0) {
        ai.mode = 'warn';
        ai.warnTimer = T.chargeWarn;
        ai.chargeDmg = 0;
        this.emit('bossWarn', { m, lane: m.lane, duration: T.chargeWarn });
      }
    },

    // 焚天巨龙（设计书 114）：悬在战场右侧，三个阶段；技能 = 龙息 / 龙吼冲击 / 雷暴，都有蓄力预警，蓄力时累计伤害够了就打断；
    // 定期招来飞行的小龙；血量 33% 以下狂暴：技能更频繁、龙息更痛、向前压到城墙前
    // 巨龙的一次技能打掉多少城墙血量：按最大血量的比例，第二条命 ×3，单次不超过 hitCap
    dragonHit(m, ratio) {
      const G = D.abyssDragon;
      return Math.min(ratio * (m.ai.form === 2 ? G.rebirthMult : 1), G.hitCap) * this.wall.max;
    },
    // 第一条命倒下：趴在地上，剧情讲完（或 rebirthDelay 秒）后化作黑色巨龙
    dragonFall(m) {
      const ai = m.ai;
      m.hp = 1;
      m.fallen = true;
      m.burnUntil = 0;
      ai.fallen = true;
      ai.mode = 'fallen';
      ai.skill = null;
      ai.boltsLeft = 0;
      ai.animTimer = 0;
      ai.rebirthTimer = D.abyssDragon.rebirthDelay;
      ai.rebirthMax = D.abyssDragon.rebirthDelay;
      this.emit('dragonFall', { m });
    },
    dragonRebirth(m) {
      const G = D.abyssDragon;
      const ai = m.ai;
      m.fallen = false;
      m.def = D.monsters.abyssDragon2;
      m.type = 'abyssDragon2';
      m.maxHp = Math.round(m.maxHp * G.rebirthMult);
      m.hp = m.maxHp;
      m.dps *= G.rebirthMult;
      m.armorMult = (m.armorMult || 1) * G.rebirthMult; // 护甲实际封顶 120，和别的怪一样
      Object.assign(ai, { form: 2, fallen: false, animTimer: 0, phase: 1, mode: 'walk', holdX: G.holdX, skill: null, last: null, idx: 0, skillTimer: G.skillFirst, summonTimer: 6, chargeDmg: 0, boltsLeft: 0 });
      this.emit('dragonRebirth', { m });
      this.emit('bossPhase', { m, phase: 1, text: '焚天巨龙倒下了……黑色的巨龙从灰烬里站了起来！' });
    },
    updateAbyssDragon(m, dt) {
      const G = D.abyssDragon;
      const ai = m.ai;
      if (ai.animTimer > 0) ai.animTimer -= dt; // 技能释放时画面里的姿势（喷火 / 冲撞 / 雷击 / 寒冰）持续多久
      if (ai.fallen) {
        ai.ramHit = 0;
        ai.rebirthTimer -= dt;
        if (ai.rebirthTimer <= 0) this.dragonRebirth(m);
        return;
      }
      // 冲撞撞上城墙的那一刻：结算伤害、英雄眩晕（不受 Boss 自己被眩晕影响，动画已经在播了）
      if (ai.ramHit > 0) {
        ai.ramHit -= dt;
        if (ai.ramHit <= 0) {
          ai.ramHit = 0;
          this.emit('dragonShock', { m });
          this.hitWall(this.dragonHit(m, D.abyssDragon.shock.damage), m, true, 'shock', m.type);
          this.stunHero(D.abyssDragon.shock.stun);
        }
      }
      const ratio = m.hp / m.maxHp;
      const ph = () => ai.phase - 1;
      if (ai.phase === 1 && ratio < G.phase2Below) {
        ai.phase = 2;
        ai.skillTimer = Math.min(ai.skillTimer, 2);
        this.emit('bossPhase', { m, phase: 2, text: '巨龙怒了：技能越来越频繁！' });
      }
      if (ai.phase === 2 && ratio < G.phase3Below) {
        ai.phase = 3;
        ai.holdX = G.holdX3;
        if (ai.mode === 'hold') ai.mode = 'walk';
        this.emit('bossPhase', { m, phase: 3, text: '巨龙狂暴了！它压向城墙！' });
      }
      if (ai.mode === 'walk' && m.x <= ai.holdX) {
        m.x = ai.holdX;
        ai.mode = 'hold';
      }
      if (this.time < m.stunUntil) return;
      // 雷暴：一串落雷，一道一道劈向城墙
      if (ai.boltsLeft > 0) {
        ai.boltTimer -= dt;
        if (ai.boltTimer <= 0) {
          ai.boltTimer += G.bolt.spread / G.bolt.count[ph()];
          ai.boltsLeft--;
          const lane = this.rng.int(this.lanes);
          this.emit('dragonBolt', { m, x: C.wallX + 10 + this.rng() * 90, y: this.laneY(lane), lane });
          this.hitWall(this.dragonHit(m, G.bolt.damage), m, false, 'bolt', m.type);
        }
      }
      // 招来飞行的小龙（和熔岩傀儡）
      if (m.x <= C.spawnX) {
        ai.summonTimer -= dt;
        if (ai.summonTimer <= 0) {
          ai.summonTimer += G.summon.every[ph()];
          for (let i = 0; i < G.summon.count[ph()]; i++) this.spawnMonster(G.summon.type, this.rng.int(this.lanes), Math.min(C.spawnX, m.x + 60 + this.rng() * 80));
          if (ai.phase >= 2) this.spawnMonster(G.summon.golem, this.rng.int(this.lanes), Math.min(C.spawnX, m.x + 40));
          this.emit('bossSummon', { m });
        }
      }
      if (ai.mode === 'warn') {
        ai.warnTimer -= dt;
        if (ai.warnTimer > 0) return;
        this.castDragonSkill(m);
        return;
      }
      if (ai.mode !== 'hold' && ai.mode !== 'walk') return;
      ai.skillTimer -= dt;
      if (ai.skillTimer > 0) return;
      // 选技能：第一阶段按龙息 → 冲撞 → 雷击 → 寒冰的顺序，之后随机（不连着用同一个）
      const list = ['fire', 'shock', 'bolt', 'ice'];
      let skill = list[ai.idx % list.length];
      if (ai.phase > 1) {
        const pool = list.filter((k) => k !== ai.last);
        skill = pool[this.rng.int(pool.length)];
      }
      ai.idx++;
      ai.skill = skill;
      ai.mode = 'warn';
      ai.warnMax = ai.warnTimer = G[skill].warn;
      ai.chargeDmg = 0;
      ai.lane = skill === 'fire' ? this.rng.int(this.lanes) : Math.floor(this.lanes / 2);
      this.emit('bossWarn', { m, lane: ai.lane, duration: ai.warnTimer });
      this.emit('dragonCast', { m, kind: skill, duration: ai.warnTimer, lane: ai.lane });
    },

    // 蓄力结束，放出技能
    castDragonSkill(m) {
      const G = D.abyssDragon;
      const ai = m.ai;
      const skill = ai.skill;
      const enraged = ai.phase === 3;
      if (skill === 'fire') {
        const k = enraged ? G.fire.enrage : 1;
        ai.anim = 'fire';
        ai.animTimer = G.fire.anim;
        this.emit('dragonFire', { m, lane: ai.lane, twin: enraged });
        this.hitWall(this.dragonHit(m, G.fire.damage * k), m, true, 'fire', m.type);
        this.addWallDot(G.fire.dot * k * this.wall.max * (m.ai.form === 2 ? G.rebirthMult : 1), G.fire.dotTime, 'dragonFire', true, m.type);
        this.stunHero(0.4);
      } else if (skill === 'shock') {
        // 冲撞：蓄力时（warn）巨龙已经飞到高处；现在俯冲撞向城墙，撞上的那一刻（hitAt）才结算伤害（设计书 134）
        ai.anim = 'ram';
        ai.animTimer = G.shock.anim;
        ai.ramHit = G.shock.anim * G.shock.hitAt;
        // 画面里要冲多远：龙头从当前位置一直撞到城墙（龙头在身体中心左边约 1.4 个体长 × 0.92）
        ai.ramDx = Math.max(80, m.x - 1.4 * m.def.size * 0.92 - (C.wallX + 30));
        this.emit('dragonRamStart', { m });
      } else if (skill === 'bolt') {
        // 雷击：一串落雷劈向城墙，主角被电麻 G.bolt.heroStun 秒
        ai.anim = 'bolt';
        ai.animTimer = G.bolt.anim;
        ai.boltsLeft = G.bolt.count[ai.phase - 1];
        ai.boltTimer = 0;
        this.emit('dragonBoltStart', { m });
        this.stunHero(G.bolt.heroStun, 'shock');
      } else {
        // 寒冰：寒气喷向城墙，主角被冻住 G.ice.freeze 秒
        ai.anim = 'ice';
        ai.animTimer = G.ice.anim;
        this.emit('dragonIce', { m });
        this.hitWall(this.dragonHit(m, G.ice.damage), m, true, 'ice', m.type);
        this.stunHero(G.ice.freeze, 'freeze');
      }
      ai.last = skill;
      ai.skill = null;
      ai.skillTimer = G.skillEvery[ai.phase - 1];
      ai.mode = m.x > ai.holdX + 1 ? 'walk' : 'hold';
    },

    // 贝贝：合壳（几乎打不动 + 召唤寄居蟹）↔ 张壳（易伤 + 吐珍珠）（设计书 52.3）
    updatePearlClam(m, dt) {
      const B = D.pearlClam;
      const ai = m.ai;
      if (ai.phase === 1 && m.hp / m.maxHp < B.lowBelow) {
        ai.phase = 2;
        this.emit('bossPhase', { m, phase: 2, text: '贝贝着急了：开合得更快了！' });
      }
      if (ai.mode === 'walk') {
        if (m.x > B.holdX) return;
        m.x = B.holdX;
        ai.mode = 'hold';
        this.clamClose(m);
        return;
      }
      if (this.time < m.stunUntil) return;
      ai.cycleTimer -= dt;
      if (ai.cycleTimer <= 0) {
        if (ai.open) this.clamClose(m);
        else {
          ai.open = true;
          ai.cycleTimer = ai.phase === 2 ? B.openTime2 : B.openTime;
          ai.cycleMax = ai.cycleTimer;
          ai.pearlTimer = B.pearlEvery * 0.5;
          this.emit('clamOpen', { m });
        }
      }
      if (ai.open) {
        ai.pearlTimer -= dt;
        if (ai.pearlTimer <= 0) {
          ai.pearlTimer += B.pearlEvery;
          this.hitWall(B.pearlDamage * this.D, m);
          this.emit('pearl', { m });
        }
      }
    },

    clamClose(m) {
      const B = D.pearlClam;
      const ai = m.ai;
      ai.open = false;
      ai.cycleTimer = ai.phase === 2 ? B.closedTime2 : B.closedTime;
      ai.cycleMax = ai.cycleTimer;
      for (let i = 0; i < B.crabCount; i++) this.spawnMonster('hermitCrab', this.rng.int(this.lanes), Math.min(C.spawnX, m.x + 30 + this.rng() * 40));
      if (ai.phase === 2) this.spawnMonster('seahorse', this.rng.int(this.lanes), Math.min(C.spawnX, m.x + 60));
      this.emit('clamClose', { m });
      this.emit('bossSummon', { m });
    },

    // 波波：触手护身 → 吸盘回血 → 大漩涡（设计书 52.3）
    updateOctoKing(m, dt) {
      const O = D.octoKing;
      const ai = m.ai;
      const ratio = m.hp / m.maxHp;
      if (ai.phase === 1 && ratio < O.phase2Below) {
        ai.phase = 2;
        this.emit('bossPhase', { m, phase: 2, text: '波波的吸盘在吸收力量！快打掉触手！' });
      }
      if (ai.phase === 2 && ratio < O.phase3Below) {
        ai.phase = 3;
        this.whirl = true;
        ai.mode = 'walk';
        if (ai.slots && D.octoKing.regrowAllP3) for (const sl of ai.slots) if (!sl.m) this.growTentacle(m, sl);
        this.emit('bossPhase', { m, phase: 3, text: '大漩涡！触手全部长回来了，所有怪物都变快了！' });
      }
      if (ai.mode === 'walk' && ai.phase < 3 && m.x <= O.holdX) {
        m.x = O.holdX;
        ai.mode = 'hold';
      }
      // 第一次停下时，在其余车道伸出触手
      if (!ai.slots && m.x <= O.holdX) {
        ai.slots = [];
        for (let l = 0; l < this.lanes && ai.slots.length < O.tentacles; l++) if (l !== m.lane) ai.slots.push({ lane: l, m: null, regrowAt: 0 });
        for (const sl of ai.slots) this.growTentacle(m, sl);
      }
      let alive = 0;
      if (ai.slots) {
        for (const sl of ai.slots) {
          if (sl.m && sl.m.dead) {
            sl.m = null;
            sl.regrowAt = this.time + (ai.phase >= 2 ? O.regrow2 : O.regrow);
          }
          if (!sl.m && this.time >= sl.regrowAt) this.growTentacle(m, sl);
          if (sl.m) alive++;
        }
      }
      ai.alive = alive;
      ai.guarded = alive >= O.guardMin;
      // 吸盘：每条活着的触手给波波回血
      if (ai.phase >= 2 && alive > 0 && m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * O.suckPct * alive * dt);
      if (this.time < m.stunUntil) return;
      if (m.x <= C.spawnX) {
        ai.summonTimer -= dt;
        if (ai.summonTimer <= 0) {
          ai.summonTimer = O.summonEvery;
          const types = ai.phase === 1 ? ['flyingFish', 'flyingFish'] : ['urchin', 'seahorse'];
          for (const t of types) this.spawnMonster(t, this.rng.int(this.lanes), Math.min(C.spawnX, m.x + 30 + this.rng() * 40));
          this.emit('bossSummon', { m });
        }
      }
    },

    growTentacle(m, sl) {
      const t = this.spawnMonster('tentacle', sl.lane, D.octoKing.tentacleX);
      t.owner = m;
      t.rangedTimer = 1.5 + this.rng();
      sl.m = t;
      this.emit('tentacleGrow', { m: t });
    },

    splitInk(m) {
      const K = D.inkBoss;
      m.hidden = true;
      m.ai.mode = 'hold';
      const lanes = [];
      for (let i = 0; i < this.lanes; i++) lanes.push(i);
      for (let k = 0; k < Math.min(K.cloneCount, this.lanes); k++) {
        const lane = lanes.splice(this.rng.int(lanes.length), 1)[0];
        const c = this.spawnMonster('inkClone', lane, m.x);
        c.hp = c.maxHp = m.maxHp * K.cloneHp;
        c.cloneOf = m;
        c.splitFrom = { x: m.x, y: m.y };
      }
      this.emit('inkSplit', { m });
    },

    clonesDown(m) {
      const K = D.inkBoss;
      m.hidden = false;
      m.stunUntil = this.time + K.stunAfterClones;
      m.vulnUntil = this.time + K.vulnDuration;
      this.emit('inkReform', { m });
    },

    raiseShield(m) {
      m.shieldMax = m.maxHp * D.pharaoh.shieldRatio;
      m.shield = m.shieldMax;
      m.ai.shieldTimer = -1;
      this.emit('shieldUp', { m });
    },

    // 冲锋期间累计伤害，达到阈值就打断
    onBossDamaged(m, dmg) {
      const ai = m.ai;
      if (m.def.ai === 'abyssDragon') {
        if (ai.mode !== 'warn') return;
        ai.chargeDmg += dmg;
        if (ai.chargeDmg >= m.maxHp * D.abyssDragon.interruptRatio) {
          ai.last = ai.skill;
          ai.skill = null;
          ai.skillTimer = D.abyssDragon.skillEvery[ai.phase - 1] * 0.6;
          ai.mode = m.x > ai.holdX + 1 ? 'walk' : 'hold';
          m.stunUntil = this.time + D.abyssDragon.stunOnInterrupt;
          this.emit('bossInterrupt', { m });
        }
        return;
      }
      if (m.def.ai === 'windGiant' || m.def.ai === 'thunderKing') {
        if (ai.mode !== 'warn') return;
        ai.chargeDmg += dmg;
        const def = m.def.ai === 'windGiant' ? D.windGiant : D.thunderKing;
        if (ai.chargeDmg >= m.maxHp * def.interruptRatio) {
          ai.mode = m.def.ai === 'thunderKing' && ai.phase === 3 ? 'walk' : 'hold';
          if (m.def.ai === 'windGiant') ai.gustTimer = ai.phase === 2 ? def.gustEveryLow : def.gustEvery;
          else ai.chargeTimer = ai.phase === 3 ? def.chargeEvery3 : def.chargeEvery;
          m.stunUntil = this.time + 1.2;
          this.emit('bossInterrupt', { m });
        }
        return;
      }
      if (m.def.ai === 'inkBoss') {
        if (ai.mode !== 'warn') return;
        ai.chargeDmg += dmg;
        if (ai.chargeDmg >= m.maxHp * D.inkBoss.interruptRatio) {
          ai.mode = ai.phase >= 3 ? 'hold' : 'hold';
          ai.slamTimer = D.inkBoss.slamEvery;
          m.stunUntil = this.time + 1.2;
          this.emit('bossInterrupt', { m });
        }
        return;
      }
      if (m.def.ai !== 'boarKing') return;
      if (!ai || (ai.mode !== 'warn' && ai.mode !== 'charge')) return;
      ai.chargeDmg += dmg;
      if (ai.chargeDmg >= m.maxHp * D.boarKing.interruptRatio) {
        ai.mode = 'return';
        ai.chargeTimer = D.boarKing.chargeEvery;
        m.x = Math.min(D.boarKing.holdX, m.x + D.boarKing.knockback);
        m.stunUntil = this.time + 1.2;
        this.emit('bossInterrupt', { m });
      }
    },
  });
})((globalThis.TD = globalThis.TD || {}));
