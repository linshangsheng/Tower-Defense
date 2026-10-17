' Last Bastion launcher: double-click, no console window
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
    sh.Run """" & b & """ --app=""" & game & """ --window-size=1280,760", 1, False
    WScript.Quit
  End If
Next
' No Edge/Chrome found: open with the default browser
sh.Run """" & dir & "\index.html""", 1, False
