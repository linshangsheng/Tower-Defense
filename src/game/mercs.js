// 雇佣兵引擎（设计书 184）：雇佣、出击、近战拦截、远程输出、治疗。挂到 Battle 原型上。
// 战斗里的"军饷"（this.funds）：开场有一笔，击败怪物按铜币比例增加；雇兵时扣。
(function (TD) {
  'use strict';

  const C = TD.config;
  const D = TD.data;

  const lvMult = (lv) => 1 + C.merc.perLevel * (Math.max(1, lv) - 1);

  Object.assign(TD.Battle.prototype, {
    initMercs(list) {
      this.mercs = []; // 场上的兵
      this.mercSlots = []; // 携带的兵种（最多 3 个）：{ id, def, level, cd }
      this.mercNo = 0;
      this.mercDeaths = 0;
      this.mercKills = 0;
      this.mercDeployed = 0;
      this.funds = 0;
      this.mercsOn = !this.level.tower && !!(list && list.length);
      if (!this.mercsOn) return;
      this.funds = C.merc.startFunds;
      for (const it of list.slice(0, 3)) {
        const def = D.mercs[it.id];
        if (def) this.mercSlots.push({ id: it.id, def, level: it.level || 1, cd: 0 });
      }
      if (!this.mercSlots.length) this.mercsOn = false;
    },

    // 一个兵的实际数值
    mercStats(def, level) {
      const k = this.D * C.merc.power * lvMult(level);
      return { hp: def.hp * k, dmg: (def.dmg || 0) * k };
    },

    // 实际雇佣费用（每日规则可以打折）
    mercCost(i) {
      const s = this.mercSlots[i];
      return s ? Math.max(1, Math.ceil(s.def.cost * (1 + ((this.rules && this.rules.mercCost) || 0)))) : 0;
    },

    mercReady(i) {
      const s = this.mercSlots[i];
      return !!s && this.mercsOn && !this.over && this.waveState !== 'prepare' && s.cd <= 0 && this.funds >= this.mercCost(i) && this.mercs.filter((u) => !u.dead).length < C.merc.cap;
    },

    // 雇佣：lane 为出场车道。返回 true / false
    deployMerc(i, lane) {
      const s = this.mercSlots[i];
      if (!s || !this.mercReady(i)) return false;
      lane = TD.util.clamp(lane === undefined ? 0 : lane, 0, this.lanes - 1);
      const st = this.mercStats(s.def, s.level);
      const u = {
        id: ++this.mercNo,
        type: s.id,
        def: s.def,
        level: s.level,
        lane,
        x: C.merc.deployX,
        y: this.laneY(lane),
        hp: st.hp,
        maxHp: st.hp,
        dmg: st.dmg,
        cool: 0.3,
        state: 'idle',
        dead: false,
        bornAt: this.time,
        charging: !!s.def.charge,
        hitFlash: 0,
        face: 1,
      };
      this.funds -= this.mercCost(i);
      s.cd = s.def.cd;
      this.mercs.push(u);
      this.mercDeployed++;
      this.emit('mercDeploy', { u });
      return true;
    },

    mercTargets(u) {
      const out = [];
      for (const m of this.monsters) {
        if (m.dead || !this.isTargetable(m)) continue;
        if (m.def.flying && !u.def.ranged) continue;
        out.push(m);
      }
      return out;
    },

    // 集结令（设计书 192）：让场上所有的兵转移到指定车道，冷却 15 秒；返回转移了几个兵
    rallyReady() {
      return this.mercsOn && !this.over && this.waveState !== 'prepare' && this.time >= (this.rallyAt || 0) && this.mercs.some((u) => !u.dead);
    },

    rallyMercs(lane) {
      if (!this.rallyReady()) return 0;
      lane = TD.util.clamp(lane, 0, this.lanes - 1);
      let n = 0;
      for (const u of this.mercs) {
        if (u.dead) continue;
        if (u.lane !== lane) n++;
        u.lane = lane;
      }
      if (!n) return 0;
      this.rallyAt = this.time + C.merc.rallyCd;
      this.rallies = (this.rallies || 0) + 1;
      this.emit('mercRally', { lane, y: this.laneY(lane), n });
      return n;
    },

    // 找离兵最近的目标：优先同车道；远程兵和大范围兵可以跨车道
    mercPickTarget(u) {
      let best = null;
      let bd = Infinity;
      for (const m of this.mercTargets(u)) {
        if (m.x < u.x - 12) continue;
        if (!u.def.ranged && Math.abs(m.lane - u.lane) > 0) continue;
        if (m.x > C.merc.leashX + (u.def.ranged ? 160 : 0)) continue;
        const d = Math.abs(m.x - u.x) + Math.abs(m.lane - u.lane) * 140;
        if (d < bd) { bd = d; best = m; }
      }
      return best;
    },

    // 怪物被兵拦住：同车道、在兵右边、贴得足够近。盾卫（嘲讽）优先。
    mercBlockerFor(m) {
      const dive = m.def.trait && m.def.trait.id === 'dive'; // 蝙蝠：飞行，但会俯冲撕咬后排
      if (!this.mercs.length || (m.def.flying && !dive) || m.def.boss || m.def.bossPart || m.def.stealth) return null;
      let best = null;
      const flank = m.def.trait && m.def.trait.id === 'flank'; // 狼：绕过前排，只缠上后排（远程 / 治疗）
      for (const u of this.mercs) {
        if (u.dead || u.lane !== m.lane) continue;
        if ((flank || dive) && !(u.def.ranged || u.def.support)) continue;
        const gap = m.x - u.x;
        if (gap < -4 || gap > C.merc.contactPad + m.def.size * 0.5) continue;
        if (!best || (u.def.taunt && !best.def.taunt) || (u.def.taunt === best.def.taunt && u.x > best.x)) best = u;
      }
      return best;
    },

    // 射程内最近的兵（远程怪打兵用）：兵在怪左边、同车道或相邻车道
    mercInRange(m, range) {
      let best = null;
      for (const u of this.mercs) {
        if (u.dead || Math.abs(u.lane - m.lane) > 1 || u.x > m.x) continue;
        const d = m.x - u.x;
        if (d <= range && (!best || d < m.x - best.x)) best = u;
      }
      return best;
    },

    mercHurt(u, amount, by) {
      if (u.dead) return;
      if (u.def.reduce) amount *= 1 - u.def.reduce;
      u.covered = this.mercCovered(u);
      if (u.covered) amount *= 1 - C.merc.shieldWall;
      u.hp -= amount;
      u.hitFlash = 0.1;
      // 受击音效事件：每个兵至少隔 0.25 秒才发一次（Boss 横扫是每帧调用）
      if (u.hp > 0 && (u.hurtSfxAt === undefined || this.time - u.hurtSfxAt >= 0.25)) {
        u.hurtSfxAt = this.time;
        this.emit('mercHurt', { u });
      }
      if (u.hp <= 0) {
        u.dead = true;
        u.hp = 0;
        u.diedAt = this.time;
        this.mercDeaths++;
        this.emit('mercDie', { u, by });
      }
    },

    mercAttack(u, m) {
      const def = u.def;
      u.atkAt = this.time;
      let dmg = u.dmg;
      if (u.charging) {
        // 骑士冲锋：撞上第一个怪的冲击
        dmg *= def.charge;
        u.charging = false;
        this.emit('mercCharge', { u, x: m.x, y: m.y + m.yOffset });
      }
      const opts = { type: def.type || 'phys', fromFront: true, source: 'merc' };
      if (def.ranged) this.emit('mercShot', { u, x: m.x, y: m.y + m.yOffset, magic: def.type === 'magic' });
      else this.emit('mercSwing', { u, x: m.x, y: m.y + m.yOffset });
      if (def.aoe) {
        for (const o of this.monsters) {
          if (o.dead || !this.isTargetable(o)) continue;
          const dx = o.x - m.x;
          const dy = o.y + o.yOffset - (m.y + m.yOffset);
          if (dx * dx + dy * dy <= def.aoe * def.aoe) this.mercDamage(u, o, dmg, opts);
        }
        this.emit('mercBlast', { x: m.x, y: m.y + m.yOffset, r: def.aoe });
      } else this.mercDamage(u, m, dmg, opts);
    },

    mercDamage(u, m, dmg, opts) {
      const was = m.dead;
      this.damage(m, dmg, opts);
      if (!was && m.dead) {
        this.mercKills++;
        u.kills = (u.kills || 0) + 1;
        // 老兵晋升：每击败 vetEvery 只怪升一级，血量和伤害更高，并回一口血
        const rank = Math.min(C.merc.vetMax, Math.floor(u.kills / C.merc.vetEvery));
        if (rank > (u.rank || 0) && !u.dead) {
          const k = (1 + C.merc.vetBoost * rank) / (1 + C.merc.vetBoost * (u.rank || 0));
          u.rank = rank;
          u.maxHp *= k;
          u.hp = Math.min(u.maxHp, u.hp * k + u.maxHp * 0.3);
          u.dmg *= k;
          this.mercPromotions = (this.mercPromotions || 0) + 1;
          this.emit('mercRank', { u, rank });
        }
      }
    },

    // 盾墙：后排兵（远程 / 治疗）前面 200 以内、同车道有活着的盾卫，就受到更少的伤害
    mercCovered(u) {
      if (!u.def.ranged && !u.def.support) return false;
      for (const g of this.mercs) {
        if (g.dead || !g.def.taunt || g.lane !== u.lane) continue;
        const d = g.x - u.x;
        if (d > 0 && d <= C.merc.shieldWallRange) return true;
      }
      return false;
    },

    // 机器人 / 自动战斗：有钱有冷却就雇，派到最靠近城墙的怪所在的车道；先雇前排（盾卫 / 剑士 / 骑士），再雇后排
    autoMercs() {
      if (this.waveState === 'prepare') return;
      const frontline = (id) => (D.mercs[id].taunt ? 0 : D.mercs[id].ranged || D.mercs[id].support ? 2 : 1);
      const order = this.mercSlots.map((s, i) => i).sort((a, b) => frontline(this.mercSlots[a].id) - frontline(this.mercSlots[b].id));
      for (const i of order) {
        if (!this.mercReady(i)) continue;
        let lane = 0;
        let bx = Infinity;
        for (const m of this.monsters) if (!m.dead && m.x < bx && m.x < C.width) { bx = m.x; lane = m.lane; }
        if (bx === Infinity) continue;
        // 后排兵：前排没有人就先不雇（站出去送死）
        if (frontline(this.mercSlots[i].id) === 2 && !this.mercs.some((u) => !u.dead && !u.def.ranged && !u.def.support)) continue;
        this.deployMerc(i, lane);
        break;
      }
    },

    updateMercs(dt) {
      if (!this.mercsOn) return;
      if (this.autoMerc && this.time >= (this.autoMercAt || 0)) {
        this.autoMercAt = this.time + 0.5;
        this.autoMercs();
      }
      for (const s of this.mercSlots) if (s.cd > 0) s.cd = Math.max(0, s.cd - dt);
      if (!this.mercs.length) return;
      const wallFloor = C.wallX + 40;
      // Boss 横扫：贴在 Boss 身边的兵持续掉血（Boss 不会被兵拦住）
      for (const m of this.monsters) {
        if (m.dead || !(m.def.boss || m.def.bossPart) || m.x > C.width) continue;
        for (const u of this.mercs) {
          if (u.dead || u.lane !== m.lane) continue;
          if (Math.abs(u.x - m.x) <= 36 + m.def.size * 0.5) this.mercHurt(u, m.dps * C.merc.bossCleave * dt, m);
        }
      }
      for (const u of this.mercs) {
        if (u.dead) continue;
        if (u.hitFlash > 0) u.hitFlash -= dt;
        // 换车道时平滑地走过去（集结令）
        const ty = this.laneY(u.lane);
        if (u.y !== ty) u.y += Math.sign(ty - u.y) * Math.min(Math.abs(ty - u.y), 220 * dt);
        const def = u.def;
        // 被大怪撞飞后眩晕：不能走、不能打、牧师也不能治疗（冲阵）
        if (this.time < (u.stunUntil || 0)) {
          u.state = 'stun';
          continue;
        }
        // 牧师：给最伤的友军（或城墙）回血
        if (def.support) {
          u.cool -= dt;
          let hurt = null;
          for (const o of this.mercs) {
            if (o.dead || o === u || o.hp >= o.maxHp || Math.abs(o.x - u.x) > def.range) continue;
            if (!hurt || o.hp / o.maxHp < hurt.hp / hurt.maxHp) hurt = o;
          }
          if (u.cool <= 0 && (hurt || this.wall.hp < this.wall.max)) {
            u.cool = def.every;
            if (hurt) hurt.hp = Math.min(hurt.maxHp, hurt.hp + hurt.maxHp * def.heal);
            else this.wall.hp = Math.min(this.wall.max, this.wall.hp + this.wall.max * def.wallHeal);
            u.healAt = this.time;
            this.emit('mercHeal', { u, to: hurt });
          }
          // 跟在队伍后面：站在最靠前的友军身后
          let front = C.merc.postX;
          for (const o of this.mercs) if (!o.dead && o !== u && !o.def.support && o.x > front) front = o.x;
          const want = Math.max(wallFloor, front - def.keep);
          this.mercMove(u, want, dt);
          continue;
        }
        const tgt = this.mercPickTarget(u);
        if (!tgt) {
          u.state = 'idle';
          u.charging = !!def.charge && u.charging;
          // 没目标：回待命位置（盾卫站最前，其他稍靠后）
          this.mercMove(u, C.merc.postX + (def.taunt ? 60 : def.ranged ? -40 : 0), dt);
          continue;
        }
        const dist = tgt.x - u.x;
        if (def.ranged) {
          // 远程：保持距离，进射程就打，太近就后撤
          if (dist < def.keep && u.x > wallFloor) this.mercMove(u, Math.max(wallFloor, u.x - 80), dt);
          else if (dist > def.range) this.mercMove(u, u.x + 60, dt);
          if (dist <= def.range) {
            u.state = 'attack';
            u.cool -= dt;
            if (u.cool <= 0) {
              u.cool = def.every;
              this.mercAttack(u, tgt);
            }
          }
        } else {
          const reach = def.range + tgt.def.size * 0.5;
          if (dist > reach) {
            const sp = u.charging ? def.chargeSpeed : def.speed;
            u.state = 'move';
            u.face = 1;
            u.x = Math.min(u.x + sp * dt, tgt.x - reach * 0.8);
            if (u.x >= C.merc.leashX) u.x = C.merc.leashX;
          } else {
            u.state = 'attack';
            u.cool -= dt;
            if (u.cool <= 0) {
              u.cool = def.every;
              this.mercAttack(u, tgt);
            }
          }
        }
      }
      if (this.mercs.length > 12 && this.mercs.some((u) => u.dead && this.time - u.diedAt > 1)) {
        this.mercs = this.mercs.filter((u) => !u.dead || this.time - u.diedAt <= 1);
      }
    },

    mercMove(u, x, dt) {
      const d = x - u.x;
      if (Math.abs(d) < 2) { if (u.state !== 'attack') u.state = 'idle'; return; }
      u.x += Math.sign(d) * Math.min(Math.abs(d), (u.charging ? u.def.chargeSpeed : u.def.speed) * dt);
      if (u.state !== 'attack') u.state = 'move';
      u.face = d >= 0 ? 1 : -1;
    },
  });
})((globalThis.TD = globalThis.TD || {}));
