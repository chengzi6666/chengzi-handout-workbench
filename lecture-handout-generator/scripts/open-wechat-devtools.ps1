param([string]$RequestUri = "chengzi-wechat://debug")

$ErrorActionPreference = "Stop"
$projectPath = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\wechat-miniapp")).Path
$cliCandidates = @(
  "C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat",
  "C:\Program Files\Tencent\微信web开发者工具\cli.bat"
)
$cliPath = $cliCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if (-not $cliPath) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show("没有找到微信开发者工具。请先安装后再从讲义平台点击发布。", "橙子讲义工坊") | Out-Null
  exit 1
}

# 数据和分享封面已由平台同步到云端；打开项目后开发者工具会自动重新编译，
# 可直接检查电子书、翻页、预加载缓存及分享卡片。
Start-Process -FilePath $cliPath -ArgumentList @("open", "--project", $projectPath) -WindowStyle Hidden
