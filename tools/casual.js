#!/usr/bin/env node
// "休闲玩家"模拟：技能反应慢、购物随意、补给随便选，用来估计真人玩家的难度
// 用法：node tools/casual.js [--seeds 4] [--to 50]
const TD = require('./load');
const P = TD.progression;
const D = TD.data;

const args = process.argv.slice(2);
const seeds = +(args[args.indexOf('--seeds') + 1] || 0) || 4;
const to = +(args[args.indexOf('--to') + 1] || 0) || 50;
const difficulty = args.includes('--easy') ? 'easy' : args.includes('--hard') ? 'hard' : 'normal';

// 随意购物：每次随机挑一个买得起的属性 / 城墙 / 武器升级，直到钱花到只剩一点
function casualShop(save, rng) {
  TD.bot.shop(save, { silverOnly: true });
  let guard = 0;
  while (guard++ < 60) {
    const opts = TD.bot.copperOptions(save).filter((o) => P.canAfford(save, o.cost));
    if (!opts.length || save.copper < 60) break;
    const o = opts[rng.int(opts.length)];
    const [kind, key] = o.label.split(':');
    if (kind === 'attr') P.buyAttr(save, key);
    else if (kind === 'weapon') P.upgradeWeapon(save, key);
    else if (kind === 'wall') P.buyWall(save, key);
  }
}

function playCasual(save, n, seed, rng, autoCast) {
  P.recommend(save, n);
  const lo = P.battleLoadout(save);
  lo.autoCast = !!autoCast;
  const b = new TD.Battle({ level: n, stats: P.heroStats(s0(save)), loadout: lo, seed, autoItems: false, difficulty, rally: noRally ? 0 : P.rally(save, n) });
  // 技能：冷却好了以后 2–4 秒才放，30% 的时候干脆忘了（等下一次机会）
  const delay = b.skills.map(() => 0);
  const dt = 1 / 60;
  while (!b.over && b.time < 1200) {
    if (b.pendingSupply) b.chooseSupply(b.pendingSupply[rng.int(b.pendingSupply.length)]);
    b.step(dt);
    if (!lo.autoCast)
      b.skills.forEach((sk, i) => {
      if (!b.skillReady(i)) {
        delay[i] = 0;
        return;
      }
      if (delay[i] === 0) delay[i] = rng() < 0.3 ? 8 : 2 + rng() * 2;
      delay[i] -= dt;
      if (delay[i] <= 0) {
        b.castSkill(i);
        delay[i] = 0;
      }
    });
    // 道具：城墙低于 30% 才想起来用
    if (b.wall.hp / b.wall.max < 0.3) b.items.forEach((it, i) => !it.used && b.useItem(i));
  }
  if (!b.over) b.finish(false);
  for (const id of b.result.itemsUsed) P.consumeItem(save, id);
  return b.result;
}
const s0 = (save) => save;

const stuck = {};
const autoOn = {};
const noviceAuto = args.includes('--auto');
const noRally = args.includes('--no-rally');
const tries = {};
for (let s = 1; s <= seeds; s++) {
  const rng = TD.util.rng(s * 991);
  const save = P.newSave();
  save.settings.difficulty = difficulty;
  for (let n = 1; n <= to; n++) {
    let r;
    let a = 0;
    do {
      a++;
      // 看了关卡预览的"推荐武器"：先买它（买得起的话），再随手花剩下的钱
      const adv = P.idealWeapon(n);
      if (adv && !save.weapons[adv.id].owned && P.canAfford(save, D.weapons[adv.id].cost)) P.buyWeapon(save, adv.id);
      // 失败过的话，照着失败界面的提示把"推荐武器"练上来（设计书 27.4）
      if (a > 1 && adv && save.weapons[adv.id].owned) {
        let g = 0;
        while (g++ < 6 && P.weaponLagging(save, adv.id)) {
          const c = P.weaponUpgradeCost(save, adv.id);
          if (!c || !P.canAfford(save, c)) break;
          P.upgradeWeapon(save, adv.id);
        }
      }
      casualShop(save, rng);
      // 连输两次后，有一半的人会照失败提示打开「技能自动释放」，之后一直开着
      if (a > 2 && !autoOn[s] && rng() < 0.5) autoOn[s] = true;
      r = playCasual(save, n, s * 1000 + n * 10 + a, rng, autoOn[s] || noviceAuto);
      P.applyResult(save, n, r);
    } while (!r.win && a < 15);
    tries[n] = (tries[n] || 0) + a;
    if (!r.win) {
      stuck[n] = (stuck[n] || 0) + 1;
      console.log(`  种子 ${s} 卡在第 ${n} 关`);
      break;
    }
  }
}
const rows = [];
for (let n = 1; n <= to; n++) if (tries[n]) rows.push(`${n}:${(tries[n] / seeds).toFixed(1)}`);
console.log('平均尝试次数（关:次）', rows.join('  '));
console.log('卡关', JSON.stringify(stuck));
