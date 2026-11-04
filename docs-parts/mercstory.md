## 195. 雇佣兵的故事与角色

### 目标
让兵不是冷冰冰的数值：每个兵种有性格（背景 + 三类台词），并有一位佣兵团长 Brann 在解锁兵营和每个新兵种时出场。风格沿用游戏的温暖幽默（Kael 的头盔、果冻王子），中英文各自写，不直译。

### 规则与数值
- 数据全在新文件 `src/data/mercstory.js`（在 `story.js` 之后加载）：`D.mercLore[兵种] = { bio, deploy[3], die[3], rank[3] }`，`D.speakers.captain`（头像用骑士造型，画在 `ui-story.js` 的 `mercFace`）。
- 台词：到场（`mercDeploy`）、阵亡（`mercDie`）、晋升（`mercRank`）时在兵头上飘一句，每句 ≤ 12 字，随机取 3 句之一。`renderer.js` 的 `mercSay()` 参考 `bark()`：**每个兵种每类每场战斗只说一次**，避免刷屏。
- 背景：兵营卡片（解锁后）里的"背景"折叠区（`<details>`，展开状态在重绘商店后保留），样式在 `css/mercstory.css`，沿用设计系统令牌，44pt 热区。
- 剧情：`merc5`（第一次解锁兵营，6 句）和 `merc11 / 17 / 29 / 44 / 59`（各 2 句：团长一句 + Kael 一句；因为现有测试要求每段至少 2 句）。键 = `merc` + 通关关卡号，也就是兵种 `unlock − 1`。
- 登记：`progression.js` 的 `storyUnlocked / storyPassed` 的正则加了 `merc`（解锁条件 = 通关该关）；`mercstory.js` 把键插进 `storyOrder`（放在时间上刚好过去的段落之后）；日记本的类别标签为"佣兵团"；背景用该关所在章节的场景。
- 触发：`main.js` 首次通关该关时，战后对话之后接着播（`maybeStory`），所以第 5 关是 `post5 → merc5 → 结算`。老存档迁移时已过去的 merc 段落记为"跳过"，但仍可在日记本里重看。
- 日记成就"日记写满了"要读完的段落多了 6 段（已拿到成就的玩家不受影响）。
- 不改任何战斗数值。

### 验证了什么
- `tests/feat-mercstory.test.js`：每个兵种有背景、三类各 3 句、每句 ≤ 12 字且不重复；英文译文 ≤ 32 字符；每句（含剧情、标题、日记）在 `i18n-add/mercstory.json` 里有整句翻译；6 段剧情登记进 `storyOrder`、说话人存在、有日记、在日记本里的相对位置对；兵种解锁与剧情解锁同一关；老存档迁移；读完全部日记仍能拿成就。

### 没验证什么
- 没有在真实浏览器里看过兵营卡片的折叠区、团长头像、飘字的位置和重叠（飘字复用 `text()` 的防叠逻辑，但三行同时出现时是否拥挤没有看过）。
- 英文译文长度只按字符数估计，没有在画面里量过。
- `sw.js` 的离线缓存清单需要主线加上 `src/data/mercstory.js` 和 `css/mercstory.css`（本任务不允许改 `sw.js`）。
- `i18n/keys.json` 需要主线重新提取（`node tools/i18n-extract.js`），并合并 `i18n-add/mercstory.json`。
