# 致谢与许可

## 背景音乐采样

游戏里的背景音乐用的乐器采样来自 **FluidR3_GM** 音色库（作者 Frank Wen），
通过 [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) 提供的预渲染版本取得，
许可：**Creative Commons Attribution 3.0**（<https://creativecommons.org/licenses/by/3.0/us/>）。

我们从中取了 17 种乐器的稀疏采样（大提琴、低音提琴、小提琴、弦乐群、颤音弦乐、拨弦、圆号、铜管组、合唱、定音鼓、太鼓、管钟、钢片琴、竖琴、马林巴、双簧管、长笛）和「Power」鼓组的 9 件鼓（经 surikov/webaudiofontdata 取得，同一音色库），
重新裁剪、调整音量并压缩为 MP3，写入 `src/render/samples.js`（生成脚本：`tools/build-samples.py`）。
曲子（旋律、和声、编排、鼓点）为本项目原创；军鼓、踩镲、镲、上升噪声和各种音效为程序合成。
