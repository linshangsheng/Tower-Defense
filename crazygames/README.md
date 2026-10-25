# CrazyGames 版本《Archer on the Wall》

**CrazyGames 的上传区不接受压缩包**（会提示 “Archive files are not supported, please drag and drop the files directly in the upload zone”），要把**解压后的文件**直接拖进去。所以这里有两份一样的东西：
- `game/`：已经解开的文件夹，**上传用这个**：打开它，把里面的全部内容（`index.html`、`css`、`icons`、`src`、`manifest.webmanifest`、`CREDITS.md`）全选，拖进上传区；`index.html` 必须在最外层，不能多套一层文件夹。
- `archer-on-the-wall-crazygames.zip`：同样内容的压缩包，留着备份。

68 个文件，压缩后 5.8 MB，解压后 10.7 MB。
重新生成：`node tools/crazygames.js`（先 `git pull`）。

## 封面图（`covers/`）
后台要三张封面：`landscape-1920x1080.png`（横 16:9）、`portrait-800x1200.png`（竖 2:3）、`square-800x800.png`（方 1:1），尺寸和后台要求一致，直接上传到对应的框。重新生成：`node tools/itch.js covers`。

## 预览视频（`videos/`）
后台要横版、竖版两个预览视频（玩家鼠标移到封面上时播放；后台写的要求是 **MP4 或 MOV，最长 20 秒**）：
- `preview-landscape-1920x1080.mp4`：横版，14 秒，24 帧/秒，H.264，无声，7.7 MB；
- `preview-portrait-800x1200.mp4`：竖版（2:3），14 秒，无声，2.7 MB：把横版画面缩小放在中间，上下用同一画面放大、模糊、压暗做背景。
内容：前 6 秒第 45 关技能全开打怪，后 8 秒巨龙依次喷火、雷击、寒冰（冻住主角）；界面隐藏，没有文字。重新生成：`node tools/preview-video.js`（要 10 分钟左右）。
后台页面没写分辨率、文件大小的限制，我按常见规格做的；如果上传时提示不符合，把提示发给我。

## 和 itch 版有什么不一样
| | itch 版 | CrazyGames 版 |
|---|---|---|
| 关卡 / 装备 | 试玩版 100 关，正式版 200 关 | **完整 200 关、全部装备**（门户要完整的免费游戏） |
| 外链 | 「关于」里有 itch 页面链接、试玩弹窗里有下载按钮 | **全部去掉** |
| 门户 SDK | 没有 | 加载 `https://sdk.crazygames.com/crazygames-sdk-v3.js`；加载时通知 `loadingStart / loadingStop`，战斗进行中 `gameplayStart`，暂停 / 结算 / 菜单 `gameplayStop` |
| 全屏 | 游戏自己请求 | 不请求，设置里也不显示（门户页面自带全屏按钮） |
| 「退出游戏」「测试」按钮 | 有 / 有 | 嵌在 iframe 里不显示 / 不显示 |
| Service Worker（离线缓存） | 有 | **没有** |
| 其他 | | 没带 `i18n/` 里的 json 词典源文件（游戏运行时不用） |

没有 SDK（被拦截、离线）时，所有门户调用都是空操作，游戏照常运行。

## 上传步骤（自己照着做）
1. 注册并登录 CrazyGames 开发者后台，新建一个游戏。
2. 填游戏名（`Archer on the Wall`）、简介、分类和标签。简介可以用 `itch/description-en.md` 里的文字，**但要去掉里面的 itch 链接、“demo / 下载正式版”之类的说法**，这个版本是完整免费版。
3. 先点垃圾桶 / “Delete all files” 删掉已上传的 zip，再把 `game/` 里的全部内容拖进上传区（不要拖 zip，也不要把 `game` 文件夹本身拖进去）。
4. 缩略图、截图的尺寸后台会写明，按要求准备。可以从 `itch/screenshots/` 和 `itch/cover-1260x1000.png` 里裁。
5. 先在后台的**预览环境**里把游戏完整玩一遍：标题 → 打一关 → 暂停 → 结算 → 刷新后存档还在。
6. 先提交 **Basic Launch**（文档说是 7–21 天的有限测试，只要基础要求，SDK 可选，这个阶段不能赚钱）。要全球发布和开广告分成，要走 **Full Launch**，需要完整接入 SDK 并通过完整 QA。
7. 要收款：后台 **Account → Billing** 开通收款（Tipalti）。

## 提交之前请你自己确认
- **条款和排他性**：读最新的 [Developer Terms](https://files.crazygames.com/documents/developer_terms_20250818.pdf)，看有没有要求不能同时在别的平台发布这款游戏、有没有对"完整版免费"的限制。你还打算在 itch 上卖完整版，免费版放这里会不会冲突，是你的决定。
- **AI 披露**：后台如果问，按实际情况选（代码和译文是 AI 协助 / 生成的）。
- **手机端**：没有在真机上测过，后台如果让你勾“支持手机”，请先自己用手机玩一遍（竖屏会自动转 90°，声音要先点一下才有）。

## 没验证的（我没法替你验证）
- **SDK 的调用方式是我按 CrazyGames SDK v3 的写法（`init()`、`game.loadingStart/Stop`、`game.gameplayStart/Stop`）写的，没能打开他们的文档核对**（我的运行环境访问不了 docs.crazygames.com），也没在他们的预览环境里测过。打包检查用的是我写的 SDK 替身。上传后请在预览环境里看有没有报错；如果后台提示 SDK 用法不对，把提示发给我。
- **广告**：游戏里没有任何广告，也没接 SDK 的广告调用。后台如果要求 Full Launch 必须接广告位，到时再说，我来加。
- **云存档**：用的是浏览器本地存档（`localStorage`），没接 SDK 的账号 / 云存档。
- 是否通过 QA、是否被选中，我没法保证。
