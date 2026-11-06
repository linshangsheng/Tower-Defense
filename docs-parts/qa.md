## QA：雇佣兵 / 精英 / 光球 / 宝箱怪 / 集火 / 修补 / 集结令 的对抗测试

### 目标
对 v1.84–v1.94 的新机制做系统性随机测试，找崩溃、非有限数、越界、死锁，并修复。

### 方法（`tools/fuzz-mercs.js`）
- 每局：随机种子 × 随机关卡（1–200，含 Boss / 暗关 / 3–5 车道）× 随机存档进度（bot.shop 若干轮）× 随机带兵（含 0 个、强行带未解锁兵）× 随机难度 / 自动施法 / 自动道具 / 自动雇兵。
- 随机操作：雇兵（含越界车道和不存在的栏位）、集结令、点光球、集火、修补（含点在墙外）、技能、道具、终极技能、暂停；另外随机把兵一击秒杀、冻结 / 眩晕怪、眩晕英雄、重击城墙、把兵瞬移到边界。
- 随机卡顿：一半的局里有 2%–30% 的步长是 0.1 / 0.2 / 0.5 秒（再乘 1–3 倍速）。
- 每步检查：不抛异常；time / funds / wall.hp / 兵与怪的 x y hp / 光球坐标 / killCopper 等有限；funds ≥ 0；活兵 ≤ cap；mercs 数组不无限增长；兵 x ∈ [wallX, 1290]、车道合法、hp ≤ maxHp；900 秒内必须结束；`finish()` 结果所有数值字段有限、wallRatio ∈ [0,1]、阵亡 ≤ 雇佣。
- 坏存档 134 例（`mercLv` / `mercLoadout` / `stats` / `mercChosen` / `levels` / `loadout` 取 null、字符串、数字、NaN、Infinity、数组、对象、函数、5000 项超长列表……）喂给 `P.migrate`、`P.battleLoadout`、`P.recordStats`、`mercLoadoutIds`、`mercLevel`，并带着结果开一场战斗、雇兵。

### 结果
- 跑了 3200 局随机战斗（4 个种子 × 800 局）+ 134 例坏存档。累计：雇兵 7260 次、阵亡 5956、集结 3279、修补 4611、集火 52722 次、拾光球 9827、击杀精英 2425、击杀宝箱怪 804、大步长 137321 步。战斗层面 0 个不变量违反、0 次超时、0 次异常。
- 发现并修复的 bug（都在存档层，战斗层没发现）：
  1. 现象：`save.mercLoadout` 是数字 / 对象 / 布尔时，`P.mercLoadoutIds` 抛 “not iterable”。原因：`for (const id of save.mercLoadout || [])`，非数组的真值不会回落。`P.migrate` 会修正大多数入口，但读取函数自己没有防御。修法：`Array.isArray` 判断。
  2. 现象：`stats.mercDeployed / mercKills / treasures / elites / drops` 等是字符串 / 数组 / 对象时，`recordStats` 之后变成拼接字符串（如 `"x1"`）并一直污染统计。原因：`migrate` 只校验默认值里有的字段，这些后加字段不在 `newSave().stats` 里。修法：`recordStats` 累加前把非有限数的计数清成 0。
- 回归测试：`tests/feat-qa.test.js`。

### 没覆盖到
- 战斗是 headless（没有渲染 / UI / 点击事件 / `main.js` 的 pendingLane 流程）；真实游戏单步最大 1/60 秒，大步长是极端情况的对抗模拟。
- 随机操作的机器人很弱，胜率约 6%，大部分局很早城墙被破，晚期波次、Boss 战后半程覆盖较少；没跑无尽 / 每日 / 九层妖塔模式（塔里兵本来就关闭）。
- 兵的数值平衡、手感没有评估；真实浏览器 localStorage 的坏存档只用 JSON 往返模拟。
- 用法：`node tools/fuzz-mercs.js --games 3000 --seed 1`（约 15 分钟 / 800 局，可多进程用不同 `--seed`）；`--bad-only` 只跑坏存档。
