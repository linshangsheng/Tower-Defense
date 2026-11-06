// 合并 20 个并行任务时发现的跨任务问题的回归测试（主线）
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const TD = require('../tools/load.js');

test('每个兵种在天赋数据缺失时，兵营页的天赋区有防御（工程兵没有天赋数据，曾导致兵营页崩溃）', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src/ui/ui.js'), 'utf8');
  assert.ok(/function mercTalentBlock\(id\) \{\s*\n\s*if \(!D\.mercTalents \|\| !D\.mercTalents\[id\]\) return null;/.test(src), '没有天赋数据时返回 null');
  assert.ok(/if \(tb\) mc\.append\(tb\)/.test(src), '返回 null 时不追加（否则会把 "null" 当文字加进卡片）');
  // 已知：工程兵目前没有天赋数据，兵营页必须能处理
  assert.ok(TD.data.mercOrderExt.includes('engineer'));
  assert.ok(!(TD.data.mercTalents && TD.data.mercTalents.engineer), '工程兵暂无天赋（如果以后加了，可以删掉这条断言）');
});

test('每个兵种都有专属音效（工程兵的音效是合并时补的）', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src/render/audio.js'), 'utf8');
  for (const id of TD.data.mercOrderExt) for (const k of ['atk', 'hurt', 'die', 'deploy']) assert.ok(src.includes(`merc_${id}_${k}`), `${id} ${k}`);
});
