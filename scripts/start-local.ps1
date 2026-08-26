$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$appRoot = Split-Path -Parent $PSScriptRoot
$pgBin = "C:\Program Files\PostgreSQL\17\bin"
$pgData = Join-Path $appRoot ".local-postgres\data"
$runtime = Join-Path $appRoot ".local-runtime"
$postgresLog = Join-Path $runtime "postgres.log"

New-Item -ItemType Directory -Force -Path $runtime | Out-Null

$pgReady = & (Join-Path $pgBin "pg_isready.exe") -h 127.0.0.1 -p 55432 2>$null
if ($LASTEXITCODE -ne 0) {
  & (Join-Path $pgBin "pg_ctl.exe") -D $pgData -l $postgresLog -o "-p 55432 -h 127.0.0.1" start
}

Push-Location $appRoot
try {
  pnpm db:migrate
  pnpm db:seed

  $existing = Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue
  if (-not $existing) {
    $web = Start-Process -FilePath "pnpm.cmd" -ArgumentList "exec", "next", "dev", "-p", "3100" -WorkingDirectory $appRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtime "web.log") -RedirectStandardError (Join-Path $runtime "web-error.log") -PassThru
    Set-Content -LiteralPath (Join-Path $runtime "web.pid") -Value $web.Id
  }

  $workerPidFile = Join-Path $runtime "worker.pid"
  $workerRunning = $false
  if (Test-Path $workerPidFile) {
    $workerPid = [int](Get-Content $workerPidFile)
    $workerRunning = $null -ne (Get-Process -Id $workerPid -ErrorAction SilentlyContinue)
  }
  if (-not $workerRunning) {
    $worker = Start-Process -FilePath "pnpm.cmd" -ArgumentList "worker" -WorkingDirectory $appRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtime "worker.log") -RedirectStandardError (Join-Path $runtime "worker-error.log") -PassThru
    Set-Content -LiteralPath $workerPidFile -Value $worker.Id
  }
} finally {
  Pop-Location
}

Write-Host "Handout workbench started: http://localhost:3100/"
Write-Host "Web and worker logs: $runtime"
