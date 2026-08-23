$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$appRoot = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $appRoot ".local-runtime"

function Stop-ProcessTree([int]$RootProcessId) {
  $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$RootProcessId" -ErrorAction SilentlyContinue
  foreach ($child in $children) {
    Stop-ProcessTree -RootProcessId $child.ProcessId
  }
  Stop-Process -Id $RootProcessId -Force -ErrorAction SilentlyContinue
}

foreach ($name in @("web", "worker")) {
  $pidFile = Join-Path $runtime "$name.pid"
  if (Test-Path $pidFile) {
    $processId = [int](Get-Content $pidFile)
    Stop-ProcessTree -RootProcessId $processId
    Remove-Item -LiteralPath $pidFile -Force
  }
}

Write-Host "橙子讲义工坊网页与后台任务已停止。"
