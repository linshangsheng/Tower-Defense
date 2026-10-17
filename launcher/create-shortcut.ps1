$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
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
