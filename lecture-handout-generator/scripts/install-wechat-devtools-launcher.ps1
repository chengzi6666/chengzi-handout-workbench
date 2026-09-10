$ErrorActionPreference = "Stop"
$launcher = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "open-wechat-devtools.ps1")).Path
$protocolKey = "HKCU:\Software\Classes\chengzi-wechat"
$commandKey = Join-Path $protocolKey "shell\open\command"

New-Item -Path $commandKey -Force | Out-Null
& reg.exe add "HKCU\Software\Classes\chengzi-wechat" /ve /d "URL:Chengzi WeChat DevTools Launcher" /f | Out-Null
Set-ItemProperty -Path $protocolKey -Name "URL Protocol" -Value "" -Force
$command = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}" "%1"' -f $launcher
& reg.exe add "HKCU\Software\Classes\chengzi-wechat\shell\open\command" /ve /d $command /f | Out-Null

Write-Host "Installed: the handout platform can now open WeChat DevTools."
