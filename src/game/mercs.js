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
      this.traps = []; // 工程兵布置的陷阱：{ id, lane, x, y, dmg, aoe, slow, slowDur, until, owner, born }
      this.trapNo = 0;
      this.trapHits = 0;
      this.funds = 0;
      this.mercsOn = !this.level.tower && !!(list && list.length);
      if (!this.mercsOn) return;
      this.funds = C.merc.startFunds;
      for (const it of list.slice(0, 3)) {
        const def = D.mercs[it.id];
        if (def) this.mercSlots.push({ id: it.id, def, level: it.level || 1, talents: it.talents || [], cd: 0 });
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
      this.funds -= this.mercCost(i);
      s.cd = s.def.cd;
      return this.spawnMerc(i, lane);
    },

    mercAlive() {
      return this.mercs.filter((u) => !u.dead).length;
    },

    // 把第 i 个携带兵种放上场（不检查也不扣军饷 / 冷却；deployMerc 和"援军"光球共用）
    spawnMerc(i, lane) {
      const s = this.mercSlots[i];
      lane = TD.util.clamp(lane === undefined ? 0 : lane, 0, this.lanes - 1);
      const st = this.mercStats(s.def, s.level);
      // 兵种天赋（src/data/mercTalents.js）：折算到血量 / 伤害 / 攻速 / 爆炸范围上，其余效果在出手和受伤时读 u.fx
      const fx = D.mercTalentFx(s.id, s.level, s.talents);
      st.hp *= 1 + (fx.hp || 0);
      st.dmg *= 1 + (fx.dmg || 0);
      const u = {
        fx,
        every: s.def.every ? (s.def.every / (1 + (fx.aspd || 0))) * (1 - (fx.healRate || 0)) : 0,
        aoe: s.def.aoe ? s.def.aoe * (1 + (fx.aoe || 0)) : 0,
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
        hits: 0,
        state: 'idle',
        dead: false,
        bornAt: this.time,
        charging: !!s.def.charge,
        hitFlash: 0,
        face: 1,
      };
      this.mercs.push(u);
      this.mercDeployed++;
      this.mercPeak = Math.max(this.mercPeak || 0, this.mercs.filter((o) => !o.dead).length);
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
      if (!this.mercs.length || (m.def.flying && !dive) || m.def.boss || m.def.bossPart) return null;
      if (m.def.stealth) {
        // 刺客（设计书 195）：隐身时无视兵；现身后只缠上自己锁定的后排目标
        if (m.stealthed || !C.merc.assassinHunt) return null;
        const t = this.assassinTarget(m);
        if (!t || t.lane !== m.lane) return null;
        const g = m.x - t.x;
        return g < -4 || g > C.merc.contactPad + m.def.size * 0.5 ? null : t;
      }
      let best = null;
      const flank = m.def.trait && m.def.trait.id === 'flank'; // 狼：绕过前排，只缠上后排（远程 / 治疗）
      for (const u of this.mercs) {
        if (u.dead || u.lane !== m.lane) continue;
        if ((flank || dive) && !(u.def.ranged || u.def.support || u.def.trap)) continue;
        const gap = m.x - u.x;
        if (gap < -4 || gap > C.merc.contactPad + m.def.size * 0.5) continue;
        if (!best || (u.def.taunt && !best.def.taunt) || (u.def.taunt === best.def.taunt && u.x > best.x)) best = u;
      }
      return best;
    },

    // 刺客的斩首目标（设计书 195）：牧师 / 法师 > 弓手 > 没有（直奔城墙）；同一档里取最近的
    assassinTarget(m) {
      let best = null;
      let bk = 9;
      let bd = Infinity;
      for (const u of this.mercs) {
        if (u.dead || u.x > m.x + 4) continue;
        const k = u.def.support || u.def.aoe ? 0 : u.def.ranged ? 1 : 9;
        if (k > 1) continue;
        const d = m.x - u.x + Math.abs(u.lane - m.lane) * 140;
        if (k < bk || (k === bk && d < bd)) { best = u; bk = k; bd = d; }
      }
      return best;
    },

    // 刺客每帧：现身后锁定目标、换到目标的车道；被近战兵碰到就当场毙命
    updateAssassin(m, dt) {
      m.lockId = 0;
      if (m.stealthed || !C.merc.assassinHunt || !this.mercs.length) return;
      const reach = C.merc.contactPad + m.def.size * 0.5 + 12;
      for (const u of this.mercs) {
        if (u.dead || u.lane !== m.lane || u.def.ranged || u.def.support) continue;
        if (Math.abs(m.x - u.x) <= reach) {
          this.mercKills++;
          u.kills = (u.kills || 0) + 1;
          this.emit('assassinSlain', { m, u });
          this.kill(m);
          return;
        }
      }
      const t = this.assassinTarget(m);
      if (!t) return;
      if (m.lockId !== t.id && m.lockedOn !== t.id) { m.lockedOn = t.id; this.emit('assassinLock', { m, u: t }); }
      m.lockId = t.id;
      t.markT = this.time;
      if (t.lane !== m.lane) {
        m.laneTimer = (m.laneTimer === undefined ? 0.3 : m.laneTimer) - dt;
        if (m.laneTimer <= 0) { m.laneTimer = 0.3; m.lane += Math.sign(t.lane - m.lane); }
      }
    },

    // 斩首：一击带走目标（2 倍最大血量，盾墙的 30% 减伤也挡不住）
    mercAssassinate(m, u) {
      this.assassinKills = (this.assassinKills || 0) + 1;
      this.emit('assassinStrike', { m, u });
      this.mercHurt(u, u.maxHp * 2, m);
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

    // ---------- 英雄与兵的联动（设计书 195）----------
    linkOn() {
      return this.mercsOn && C.merc.link.on;
    },

    // 羁绊：活着的兵每个 +aspdPer 攻速，封顶 aspdCap；用一条持续刷新的 buff（src 'bond'）接进攻速计算
    mercAlive() {
      let n = 0;
      for (const u of this.mercs) if (!u.dead) n++;
      return n;
    },

    bondBonus() {
      const L = C.merc.link;
      return this.linkOn() ? Math.min(L.aspdCap, this.mercAlive() * L.aspdPer) : 0;
    },

    updateBond() {
      const bonus = this.bondBonus();
      const cur = this.buffs.find((b) => b.src === 'bond');
      if (cur && cur.aspd === bonus && cur.until > this.time + 0.2) return;
      if (cur) this.buffs = this.buffs.filter((b) => b !== cur);
      if (bonus > 0) this.buffs.push({ aspd: bonus, until: this.time + 0.5, src: 'bond' });
      this.bond = bonus;
    },

    // 战鼓：兵的攻击间隔按"1 + 战鼓攻速加成 × drumShare"缩短
    mercHaste() {
      if (!this.linkOn()) return 1;
      let h = 0;
      for (const b of this.buffs) if (b.src === 'drum' && this.time < b.until) h += b.aspd * C.merc.link.drumShare;
      return 1 + h;
    },

    // 城墙修复：顺带给场上的兵回血
    healMercs(ratio) {
      if (!this.linkOn() || !this.mercs.length) return;
      const amt = ratio * C.merc.link.repairShare;
      let n = 0;
      for (const u of this.mercs) {
        if (u.dead) continue;
        u.hp = Math.min(u.maxHp, u.hp + u.maxHp * amt);
        n++;
      }
      if (n) this.emit('mercLink', { kind: 'repair' });
    },

    // 掩护射击：同车道、横向距离在 coverRange 以内有活着的兵
    mercCovers(m) {
      if (!this.linkOn()) return false;
      const R = C.merc.link.coverRange;
      for (const u of this.mercs) if (!u.dead && u.lane === m.lane && Math.abs(u.x - m.x) <= R) return true;
      return false;
    },

    mercHurt(u, amount, by) {
      if (u.dead) return;
      if (this.time < (this.mercInvulUntil || 0)) return; // 万箭天降：兵短暂无敌
      const fx = u.fx || {};
      let red = (u.def.reduce || 0) + (fx.reduce || 0);
      if (fx.lowReduce && u.hp < u.maxHp * 0.5) red += fx.lowReduce;
      if (u.protectUntil > this.time) red += u.protectDr || 0;
      if (red) amount *= 1 - Math.min(0.8, red);
      u.covered = this.mercCovered(u);
      if (u.covered) amount *= 1 - C.merc.shieldWall - (u.coverBonus || 0);
      if (fx.reflect && by && !by.dead) this.mercDamage(u, by, amount * fx.reflect, { type: 'phys', fromFront: true, source: 'merc' });
      u.hp -= amount;
      u.hitFlash = 0.1;
      if (u.hp <= 0 && fx.surviveOnce && !u.usedUndying) {
        u.usedUndying = true; // 不死：每场一次
        u.hp = Math.max(1, u.maxHp * fx.surviveOnce);
      }
      // 受击音效事件：每个兵至少隔 0.25 秒才发一次（Boss 横扫是每帧调用）
      if (u.hp > 0 && (u.hurtSfxAt === undefined || this.time - u.hurtSfxAt >= 0.25)) {
        u.hurtSfxAt = this.time;
        this.emit('mercHurt', { u });
      }
      if (u.def.taunt && by && !by.def.boss && !by.def.bossPart && amount > 0) this.mercBlocks = (this.mercBlocks || 0) + 1; // 盾卫挡下一次攻击
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
      const fx = u.fx || {};
      u.atkAt = this.time;
      let dmg = u.dmg;
      let charged = false;
      if (u.charging) {
        // 骑士冲锋：撞上第一个怪的冲击
        dmg *= def.charge;
        u.charging = false;
        charged = true;
        if (fx.recharge) u.rechargeAt = this.time + fx.recharge;
        if (fx.chargeHeal) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * fx.chargeHeal);
        this.emit('mercCharge', { u, x: m.x, y: m.y + m.yOffset });
      }
      // 天赋：每 n 次攻击放大一次 / 暴击
      if (fx.nth && ++u.hits % fx.nth.n === 0) dmg *= fx.nth.mult;
      if (fx.crit && this.rng() < fx.crit) dmg *= 2;
      const opts = { type: def.type || 'phys', fromFront: true, source: 'merc' };
      if (def.ranged) this.emit('mercShot', { u, x: m.x, y: m.y + m.yOffset, magic: def.type === 'magic' });
      else this.emit('mercSwing', { u, x: m.x, y: m.y + m.yOffset });
      if (u.aoe) {
        for (const o of this.monsters) {
          if (o.dead || !this.isTargetable(o)) continue;
          const dx = o.x - m.x;
          const dy = o.y + o.yOffset - (m.y + m.yOffset);
          if (dx * dx + dy * dy <= u.aoe * u.aoe) this.mercHit(u, o, dmg, opts);
        }
        this.emit('mercBlast', { x: m.x, y: m.y + m.yOffset, r: u.aoe });
      } else {
        this.mercHit(u, m, dmg, opts);
        // 穿云：箭矢继续射向同车道后面的怪
        if (fx.pierce) {
          const behind = this.monsters.filter((o) => o !== m && !o.dead && this.isTargetable(o) && o.lane === m.lane && o.x > m.x && o.x - m.x < 170).sort((a, b) => a.x - b.x);
          for (const o of behind.slice(0, fx.pierce)) this.mercHit(u, o, dmg, opts);
        }
        // 剑旋 / 践踏：波及目标身边同车道的怪
        const splash = (charged && fx.chargeSplash ? fx.chargeSplash : 0) || fx.cleave || 0;
        if (splash) {
          const r = charged && fx.chargeSplash ? 90 : 60;
          for (const o of this.monsters) if (o !== m && !o.dead && this.isTargetable(o) && o.lane === m.lane && Math.abs(o.x - m.x) <= r && !(o.def.flying && !def.ranged)) this.mercHit(u, o, dmg * splash, opts);
        }
      }
    },

    // 一次命中：按目标折算天赋加成（对高护甲 / 飞行怪），再附带灼烧和减速
    mercHit(u, m, dmg, opts) {
      const fx = u.fx || {};
      if (fx.armorDmg && m.def.armor >= 30) dmg *= 1 + fx.armorDmg;
      if (fx.flyDmg && m.def.flying) dmg *= 1 + fx.flyDmg;
      this.mercDamage(u, m, dmg, opts);
      if (m.dead) return;
      if (fx.burn) {
        if (this.time >= m.burnUntil) m.burnTick = 0.5;
        m.burnUntil = this.time + 3;
        m.burnDps = Math.max(m.burnDps || 0, dmg * fx.burn);
      }
      if (fx.slow) {
        m.slowAmt = Math.max(this.time < m.slowUntil ? m.slowAmt : 0, fx.slow);
        m.slowUntil = Math.max(m.slowUntil, this.time + 2);
      }
    },

    mercDamage(u, m, dmg, opts) {
      const was = m.dead;
      this.damage(m, dmg, opts);
      if (!was && m.dead) {
        this.mercKills++;
        u.kills = (u.kills || 0) + 1;
        if (u.fx && u.fx.killHeal && !u.dead) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * u.fx.killHeal);
        // 老兵晋升：每击败 vetEvery 只怪升一级，血量和伤害更高，并回一口血
        const rank = Math.min(C.merc.vetMax, Math.floor(u.kills / C.merc.vetEvery));
        if (rank > (u.rank || 0) && !u.dead) {
          const k = (1 + C.merc.vetBoost * rank) / (1 + C.merc.vetBoost * (u.rank || 0));
          u.rank = rank;
          u.maxHp *= k;
          u.hp = Math.min(u.maxHp, u.hp * k + u.maxHp * 0.3);
          u.dmg *= k;
          this.mercPromotions = (this.mercPromotions || 0) + 1;
          if (rank >= C.merc.vetMax) this.mercMaxRanks = (this.mercMaxRanks || 0) + 1;
          this.emit('mercRank', { u, rank });
        }
      }
    },

    // 雇佣兵任务用的统计（并入战斗结果）
    mercSummary() {
      return { mercBlocks: this.mercBlocks || 0, mercPeak: this.mercPeak || 0, mercMaxRanks: this.mercMaxRanks || 0, mercRallies: this.rallies || 0, mercCarried: this.mercSlots ? this.mercSlots.length : 0 };
    },

    // 盾墙：后排兵（远程 / 治疗）前面 200 以内、同车道有活着的盾卫，就受到更少的伤害
    mercCovered(u) {
      u.coverBonus = 0;
      if (!u.def.ranged && !u.def.support) return false;
      let hit = false;
      for (const g of this.mercs) {
        if (g.dead || !g.def.taunt || g.lane !== u.lane) continue;
        const d = g.x - u.x;
        if (d > 0 && d <= C.merc.shieldWallRange) {
          hit = true;
          u.coverBonus = Math.max(u.coverBonus, (g.fx && g.fx.cover) || 0);
        }
      }
      return hit;
    },

    // 机器人 / 自动战斗：mercPolicy 'simple'（旧策略）或 'smart'（默认，更像真人）
    autoMercs() {
      if (this.waveState === 'prepare') return;
      if (this.mercPolicy === 'simple') this.autoMercsSimple();
      else this.autoMercsSmart();
    },

    // 旧策略：有钱有冷却就雇，派到最靠近城墙的怪所在的车道；先雇前排（盾卫 / 剑士 / 骑士），再雇后排
    autoMercsSimple() {
      const frontline = (id) => (D.mercs[id].taunt ? 0 : D.mercs[id].ranged || D.mercs[id].support || D.mercs[id].trap ? 2 : 1);
      const order = this.mercSlots.map((s, i) => i).sort((a, b) => frontline(this.mercSlots[a].id) - frontline(this.mercSlots[b].id));
      for (const i of order) {
        if (!this.mercReady(i)) continue;
        let lane = 0;
        let bx = Infinity;
        for (const m of this.monsters) if (!m.dead && m.x < bx && m.x < C.width) { bx = m.x; lane = m.lane; }
        if (bx === Infinity) continue;
        // 后排兵：前排没有人就先不雇（站出去送死）
        if (frontline(this.mercSlots[i].id) === 2 && !this.mercs.some((u) => !u.dead && !u.def.ranged && !u.def.support && !u.def.trap)) continue;
        this.deployMerc(i, lane);
        break;
      }
    },

    // 每条车道的压力：场上的怪越靠近城墙、越多，分越高；Boss 额外加分。flank / dive 记录哪些车道有绕后 / 俯冲怪
    mercLaneThreat() {
      const threat = new Array(this.lanes).fill(0);
      const flank = new Array(this.lanes).fill(0);
      const dive = new Array(this.lanes).fill(0);
      const span = C.width - C.wallX;
      for (const m of this.monsters) {
        if (m.dead || m.x >= C.width || m.lane < 0 || m.lane >= this.lanes) continue;
        threat[m.lane] += 1 + 2 * Math.max(0, 1 - (m.x - C.wallX) / span) + (m.def.boss ? 3 : 0);
        const id = m.def.trait && m.def.trait.id;
        if (id === 'flank') flank[m.lane]++;
        else if (id === 'dive') dive[m.lane]++;
      }
      return { threat, flank, dive };
    },

    // 智能策略（设计书 194 补充）：配队站位 + 补位 + 集结令 + 预留盾卫资金
    autoMercsSmart() {
      const alive = this.mercs.filter((u) => !u.dead);
      const { threat, flank, dive } = this.mercLaneThreat();
      const total = threat.reduce((a, b) => a + b, 0);
      if (total <= 0) return;
      let hot = 0;
      for (let l = 1; l < this.lanes; l++) if (threat[l] > threat[hot]) hot = l;
      // (3) 集结令：压力集中在别的车道、而兵大多不在那里时，整队转移
      if (alive.length >= 2 && this.rallyReady()) {
        const inHot = alive.filter((u) => u.lane === hot).length;
        const here = alive.reduce((a, u) => a + threat[u.lane], 0) / alive.length;
        if (inHot * 2 < alive.length && threat[hot] >= 2.5 && threat[hot] > here * 2) {
          this.rallyMercs(hot);
          return;
        }
      }
      const slots = this.mercSlots.map((s, i) => ({ i, id: s.id, d: s.def }));
      const isFront = (d) => !d.ranged && !d.support;
      const guardSlot = slots.find((x) => x.d.taunt);
      const guards = alive.filter((u) => u.def.taunt);
      const guardIn = (l) => guards.some((u) => u.lane === l);
      // (4) 资金：盾卫快要能雇、场上又没有盾卫时，给它留一笔钱
      const reserve = guardSlot && !guards.length && this.mercSlots[guardSlot.i].cd <= 8 ? this.mercCost(guardSlot.i) : 0;
      const ok = (x) => this.mercReady(x.i) && (x === guardSlot || this.funds - this.mercCost(x.i) >= reserve);
      const go = (x, lane) => ok(x) && this.deployMerc(x.i, lane);
      const dps = (l, f) => alive.filter((u) => u.lane === l && !u.def.taunt && !u.def.support && f(u.def)).length;
      // 盾卫优先：压力最大的车道没有盾卫就补
      if (guardSlot && !guardIn(hot) && go(guardSlot, hot)) return;
      // (2) 绕后 / 俯冲：后排旁边补一个近战兵（狼）或远程兵（蝙蝠）
      for (let l = 0; l < this.lanes; l++) {
        if (!(flank[l] || dive[l])) continue;
        if (!alive.some((u) => u.lane === l && (u.def.ranged || u.def.support))) continue;
        const wantRanged = dive[l] > 0 && dps(l, (d) => d.ranged) === 0;
        const wantMelee = flank[l] > 0 && dps(l, isFront) === 0;
        const cand = slots.filter((x) => (wantRanged && x.d.ranged) || (wantMelee && isFront(x.d) && !x.d.taunt));
        if (wantMelee && !cand.length) cand.push(...slots.filter((x) => x.d.ranged));
        for (const x of cand) if (go(x, l)) return;
      }
      // 常规：前排（剑士 / 骑士）去压力最大的车道；后排去有盾卫的车道；牧师最后、队里有人才雇
      const guardLane = (() => {
        let best = -1;
        for (const u of guards) if (best < 0 || threat[u.lane] > threat[best]) best = u.lane;
        return best;
      })();
      const frontLane = guardLane >= 0 && threat[guardLane] >= threat[hot] * 0.5 ? guardLane : hot;
      for (const x of slots) if (isFront(x.d) && !x.d.taunt && go(x, frontLane)) return;
      const backLane = guardLane >= 0 ? guardLane : hot;
      const backOk = guardLane >= 0 || (!guardSlot && alive.some((u) => u.lane === hot && isFront(u.def)));
      if (!backOk) return;
      for (const x of slots) if (x.d.ranged && go(x, backLane)) return;
      const team = alive.filter((u) => u.lane === backLane && !u.def.support).length;
      const vets = alive.some((u) => (u.rank || 0) >= 1);
      for (const x of slots) if (x.d.support && (team >= 2 || vets) && go(x, backLane)) return;
      // 盾卫：已经有了也可以再补一个（压力大、钱多、有空位）
      if (guardSlot && guards.length < 2 && threat[hot] >= 6 && this.funds >= this.mercCost(guardSlot.i) * 2) go(guardSlot, hot);
    },

    updateMercs(dt) {
      if (!this.mercsOn) return;
      if (this.time >= (this.bondAt || 0)) {
        this.bondAt = this.time + 0.2;
        this.updateBond();
      }
      if (this.autoMerc && this.time >= (this.autoMercAt || 0)) {
        this.autoMercAt = this.time + 0.5;
        this.autoMercs();
      }
      for (const s of this.mercSlots) if (s.cd > 0) s.cd = Math.max(0, s.cd - dt);
      this.updateTraps(dt);
      if (!this.mercs.length) return;
      const wallFloor = C.wallX + 40;
      const haste = this.mercHaste();
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
        if (u.fx) {
          if (u.fx.regen && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * u.fx.regen * dt);
          if (u.rechargeAt && this.time >= u.rechargeAt && !u.charging) { u.charging = true; u.rechargeAt = 0; } // 复冲
        }
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
          u.cool -= dt * haste;
          let hurt = null;
          for (const o of this.mercs) {
            if (o.dead || o === u || o.hp >= o.maxHp || Math.abs(o.x - u.x) > def.range) continue;
            if (!hurt || o.hp / o.maxHp < hurt.hp / hurt.maxHp) hurt = o;
          }
          if (u.cool <= 0 && (hurt || this.wall.hp < this.wall.max)) {
            u.cool = u.every;
            const fx = u.fx || {};
            if (hurt) {
              const amt = (h) => h.maxHp * def.heal * (1 + (fx.healMult || 0)) * (fx.lowHeal && h.hp < h.maxHp * 0.35 ? fx.lowHeal : 1);
              if (fx.healShare) {
                let second = null;
                for (const o of this.mercs) {
                  if (o.dead || o === u || o === hurt || o.hp >= o.maxHp || Math.abs(o.x - u.x) > def.range) continue;
                  if (!second || o.hp / o.maxHp < second.hp / second.maxHp) second = o;
                }
                if (second) second.hp = Math.min(second.maxHp, second.hp + amt(second) * fx.healShare);
              }
              hurt.hp = Math.min(hurt.maxHp, hurt.hp + amt(hurt));
              if (fx.protect) {
                hurt.protectUntil = this.time + fx.protect.dur;
                hurt.protectDr = fx.protect.dr;
              }
            } else this.wall.hp = Math.min(this.wall.max, this.wall.hp + this.wall.max * def.wallHeal * (fx.wallHeal || 1));
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
        // 工程兵：站在最靠前的友军身后，周期性在身前布置陷阱；怪物贴脸时才用扳手敲两下
        if (def.trap) {
          this.engineerAct(u, dt);
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
            u.cool -= dt * haste;
            if (u.cool <= 0) {
              u.cool = u.every;
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
            u.cool -= dt * haste;
            if (u.cool <= 0) {
              u.cool = u.every;
              this.mercAttack(u, tgt);
            }
          }
        }
      }
      if (this.mercs.length > 12 && this.mercs.some((u) => u.dead && this.time - u.diedAt > 1)) {
        this.mercs = this.mercs.filter((u) => !u.dead || this.time - u.diedAt <= 1);
      }
    },

    // ---------- 工程兵与陷阱 ----------
    trapCount(lane) {
      let n = 0;
      for (const t of this.traps) if (t.lane === lane) n++;
      return n;
    },

    // 在 lane 车道 x 处放一个陷阱（太近的已有陷阱、车道已满则不放）。返回陷阱或 null
    placeTrap(u, x) {
      const tr = u.def.trap;
      if (this.trapCount(u.lane) >= tr.max) return null;
      x = TD.util.clamp(x, C.wallX + 60, C.merc.leashX + 60);
      for (const t of this.traps) if (t.lane === u.lane && Math.abs(t.x - x) < 36) x = t.x + (x >= t.x ? 36 : -36);
      x = TD.util.clamp(x, C.wallX + 60, C.merc.leashX + 120);
      const k = this.D * C.merc.power * lvMult(u.level);
      const t = { id: ++this.trapNo, lane: u.lane, x, y: this.laneY(u.lane), dmg: tr.dmg * k, aoe: tr.aoe, slow: tr.slow, slowDur: tr.slowDur, born: this.time, until: this.time + tr.life, owner: u };
      this.traps.push(t);
      if (tr.wallHeal && this.wall.hp < this.wall.max) this.wall.hp = Math.min(this.wall.max, this.wall.hp + this.wall.max * tr.wallHeal);
      this.emit('trapPlace', { u, trap: t });
      return t;
    },

    engineerAct(u, dt) {
      const def = u.def;
      const tr = def.trap;
      const wallFloor = C.wallX + 40;
      // 位置：站在最靠前的非工程友军身后 keep 处（没人就在待命位置）
      let front = C.merc.postX;
      for (const o of this.mercs) if (!o.dead && o !== u && !o.def.trap && o.x > front) front = o.x;
      this.mercMove(u, Math.max(wallFloor, front - def.keep), dt);
      // 贴脸的怪：敲一下
      u.cool -= dt;
      let adj = null;
      for (const m of this.mercTargets(u)) if (m.lane === u.lane && Math.abs(m.x - u.x) <= def.range + m.def.size * 0.5 && (!adj || m.x < adj.x)) adj = m;
      if (adj) u.state = 'attack';
      if (adj && u.cool <= 0) {
        u.cool = def.every;
        this.mercAttack(u, adj);
      }
      // 布置陷阱：本车道有怪、陷阱没满、冷却到了
      u.trapCd = (u.trapCd === undefined ? tr.every * 0.5 : u.trapCd) - dt;
      if (u.trapCd > 0) return;
      let near = null;
      for (const m of this.monsters) if (!m.dead && m.lane === u.lane && m.x < C.width && m.x > u.x && !m.def.flying && (!near || m.x < near.x)) near = m;
      if (!near || this.trapCount(u.lane) >= tr.max) return;
      // 放在自己身前、怪物前进路线上：离自己 70，但不会放到怪物身后
      const x = Math.min(u.x + 70, near.x - 30);
      if (x <= u.x + 20) return;
      if (this.placeTrap(u, x)) {
        u.trapCd = tr.every;
        u.trapAt = this.time;
        u.atkAt = this.time;
      }
    },

    updateTraps(dt) {
      if (!this.traps || !this.traps.length) return;
      for (let i = this.traps.length - 1; i >= 0; i--) {
        const t = this.traps[i];
        let hit = null;
        for (const m of this.monsters) {
          if (m.dead || m.lane !== t.lane || m.def.flying || m.burrowed || !this.isTargetable(m)) continue;
          if (Math.abs(m.x - t.x) <= 16 + m.def.size * 0.3) { hit = m; break; }
        }
        if (hit) {
          this.triggerTrap(t, hit);
          this.traps.splice(i, 1);
        } else if (this.time >= t.until) this.traps.splice(i, 1);
      }
    },

    triggerTrap(t, m) {
      const opts = { type: 'phys', fromFront: true, source: 'merc' };
      for (const o of this.monsters) {
        if (o.dead || o.lane !== t.lane || o.def.flying || !this.isTargetable(o)) continue;
        if (o !== m && Math.abs(o.x - t.x) > t.aoe) continue;
        this.mercDamage(t.owner, o, t.dmg, opts);
        if (!o.dead && !o.def.boss) {
          o.slowAmt = Math.max(this.time < o.slowUntil ? o.slowAmt : 0, t.slow);
          o.slowUntil = Math.max(o.slowUntil, this.time + t.slowDur);
        }
      }
      this.trapHits++;
      this.emit('trapTrigger', { trap: t, x: t.x, y: t.y, r: t.aoe });
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
