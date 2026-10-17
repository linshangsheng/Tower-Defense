# 生成启动器：Windows 图标 / 桌面快捷方式脚本、macOS 应用包（设计书 65）
# 用法：python3 tools/make-launcher.py   （需要 Pillow）
import os, stat
from PIL import Image

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
L = os.path.join(root, 'launcher')
os.makedirs(L, exist_ok=True)
src = Image.open(os.path.join(root, 'icons', 'icon-512.png')).convert('RGBA')

# Windows 图标：多尺寸 .ico
src.save(os.path.join(L, 'game.ico'), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

# 以应用窗口方式打开：优先 Edge / Chrome 的 --app 模式（没有地址栏、没有标签页，像一个独立程序）；脚本里只用 ASCII，避免 WSH 按系统编码读坏
vbs = r'''' Last Bastion launcher: double-click, no console window
Dim fso, sh, dir, game, browsers, b, p
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
game = "file:///" & Replace(dir, "\", "/") & "/index.html"
browsers = Array( _
  sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Microsoft\Edge\Application\msedge.exe", _
  sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\Microsoft\Edge\Application\msedge.exe", _
  sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\Google\Chrome\Application\chrome.exe", _
  sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Google\Chrome\Application\chrome.exe", _
  sh.ExpandEnvironmentStrings("%LocalAppData%") & "\Google\Chrome\Application\chrome.exe")
For Each b In browsers
  If fso.FileExists(b) Then
    sh.Run """" & b & """ --app=""" & game & """ --start-fullscreen", 1, False
    WScript.Quit
  End If
Next
' No Edge/Chrome found: open with the default browser
sh.Run """" & dir & "\index.html""", 1, False
'''
open(os.path.join(L, 'start-game.vbs'), 'w', encoding='utf-8').write(vbs.replace('\n', '\r\n'))

bat = '@echo off\r\npowershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create-shortcut.ps1"\r\npause\r\n'
open(os.path.join(L, 'create-desktop-shortcut.bat'), 'w', encoding='ascii').write(bat)

ps1 = '''$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktop = [Environment]::GetFolderPath('Desktop')
$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut((Join-Path $desktop '最后的堡垒.lnk'))
$lnk.TargetPath = 'wscript.exe'
$lnk.Arguments = '"' + (Join-Path $dir 'start-game.vbs') + '"'
$lnk.IconLocation = (Join-Path $dir 'game.ico')
$lnk.WorkingDirectory = $dir
$lnk.Description = '最后的堡垒'
$lnk.Save()
Write-Host ('已在桌面创建图标：' + (Join-Path $desktop '最后的堡垒.lnk'))
'''
open(os.path.join(L, 'create-shortcut.ps1'), 'w', encoding='utf-8-sig').write(ps1.replace('\n', '\r\n'))

# macOS 应用包：双击打开；放在游戏文件夹里（和 index.html 同级的 launcher/ 下）
app = os.path.join(L, '最后的堡垒.app', 'Contents')
os.makedirs(os.path.join(app, 'MacOS'), exist_ok=True)
os.makedirs(os.path.join(app, 'Resources'), exist_ok=True)
src.save(os.path.join(app, 'Resources', 'icon.icns'), format='ICNS')
open(os.path.join(app, 'Info.plist'), 'w', encoding='utf-8').write('''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>最后的堡垒</string>
<key>CFBundleDisplayName</key><string>最后的堡垒</string>
<key>CFBundleIdentifier</key><string>game.lastbastion.launcher</string>
<key>CFBundleExecutable</key><string>launch</string>
<key>CFBundleIconFile</key><string>icon</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleVersion</key><string>1</string>
<key>LSUIElement</key><true/>
</dict></plist>
''')
sh = '''#!/bin/bash
# 最后的堡垒 - macOS 启动器：用 Chrome / Edge 的应用窗口模式打开，找不到就用默认浏览器
DIR="$(cd "$(dirname "$0")/../../../.." && pwd)"
URL="file://$DIR/index.html"
for APP in "Google Chrome" "Microsoft Edge" "Brave Browser" "Chromium"; do
  if [ -d "/Applications/$APP.app" ]; then
    exec open -na "$APP" --args --app="$URL" --start-fullscreen
  fi
done
exec open "$URL"
'''
p = os.path.join(app, 'MacOS', 'launch')
open(p, 'w', encoding='utf-8').write(sh)
os.chmod(p, os.stat(p).st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
readme = '''《最后的堡垒》启动器

【Windows】
1. 双击 create-desktop-shortcut.bat，桌面上会出现带堡垒图标的「最后的堡垒」。
2. 以后双击桌面图标即可：游戏会在一个独立窗口里打开（没有地址栏和标签页）。
   - 需要电脑装有 Edge（Windows 10/11 自带）或 Chrome；都没有则用默认浏览器打开。
   - 不要移动或删除游戏文件夹；移动之后重新双击一次 create-desktop-shortcut.bat。
   - 也可以直接双击 start-game.vbs 启动（没有图标）。

【Mac】
1. 双击「最后的堡垒.app」。第一次可能提示"无法验证开发者"：右键 → 打开 → 打开。
2. 想放到程序坞：把它拖到程序坞即可（不要把 .app 挪出游戏文件夹，它靠相对位置找游戏）。
   - 需要 Chrome / Edge / Brave；都没有则用默认浏览器打开。

存档：存在浏览器里。用启动器和直接打开 index.html 看到的可能是两份存档；
想换着用，先在游戏「设置」里导出存档，再导入。
'''
open(os.path.join(L, '使用说明.txt'), 'w', encoding='utf-8-sig').write(readme.replace('\n', '\r\n'))
print('ok')
