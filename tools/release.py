#!/usr/bin/env python3
"""发布一个版本：改版本号（config.js / sw.js / README）、设计书头部、目录、更新日志，并把章节正文插到附录之前。

用法：python3 tools/release.py <版本 如 1.97> <日期 如 2027-02-28> <章号> "<章标题>" "<更新日志一句话>" <章节正文.md>
章节正文里不用写章标题，脚本会加上 "## <章号>. <标题>（v<版本>）"。
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def sub1(text, pattern, repl, what):
    new, n = re.subn(pattern, repl, text, count=1)
    if n != 1:
        sys.exit(f'没找到：{what}')
    return new


def main():
    if len(sys.argv) != 7:
        sys.exit(__doc__)
    ver, date, ch, title, row, body_path = sys.argv[1:]
    body = Path(body_path).read_text(encoding='utf8').strip() + '\n'

    p = ROOT / 'src/data/config.js'
    prev = re.search(r"version: 'v([\d.]+)'", p.read_text(encoding='utf8')).group(1)
    p.write_text(sub1(p.read_text(encoding='utf8'), r"version: 'v[\d.]+'", f"version: 'v{ver}'", 'config 版本'), encoding='utf8')
    p = ROOT / 'sw.js'
    p.write_text(sub1(p.read_text(encoding='utf8'), r"scyx-v[\d.]+", f'scyx-v{ver}', 'sw 版本'), encoding='utf8')
    p = ROOT / 'README.md'
    p.write_text(sub1(p.read_text(encoding='utf8'), r'原型 v[\d.]+', f'原型 v{ver}', 'README 版本'), encoding='utf8')

    p = ROOT / 'tower-defense-design.md'
    s = p.read_text(encoding='utf8')
    s = sub1(s, r'> 版本：v[\d.]+　日期：[\d-]+', f'> 版本：v{ver}　日期：{date}', '设计书头部')
    # 目录：最后一行目录（以 "**内容扩展与打磨**" 开头）末尾接上新的一项
    i = s.find('**内容扩展与打磨**')
    if i < 0:
        sys.exit('没找到目录')
    j = s.index('\n', i)
    s = s[:j] + f' · {ch}. {title}（v{ver}）' + s[j:]
    # 更新日志：插在上一个版本那一行之前（表格里新版本在上）
    first_row = re.search(r'^\| v' + re.escape(prev) + r' \| [\d-]+ \|', s, re.M)
    if not first_row:
        sys.exit('没找到更新日志')
    s = s[: first_row.start()] + f'| v{ver} | {date} | 第 {ch} 章：{row} |\n' + s[first_row.start():]
    # 章节：插在附录之前
    chapter = f'## {ch}. {title}（v{ver}）\n\n{body}\n'
    if '## 附录：术语表' not in s:
        sys.exit('没找到附录')
    s = s.replace('## 附录：术语表', chapter + '## 附录：术语表', 1)
    p.write_text(s, encoding='utf8')
    print(f'released {ver} {ch}. {title}（v{ver}）')


if __name__ == '__main__':
    main()
