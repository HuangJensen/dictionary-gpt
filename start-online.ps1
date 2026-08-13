# 一键启动：本地词典服务 + Cloudflare 免费隧道，自动输出公网地址
# 使用前提：根目录存在 .env.cloud（已配置好 TiDB 云端连接）
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Start-Detached([string]$file, [string]$arguments, [hashtable]$envVars = @{}) {
  $psi = [System.Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = $file
  $psi.Arguments = $arguments
  $psi.WorkingDirectory = $root
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  foreach ($k in $envVars.Keys) { $psi.Environment[$k] = $envVars[$k] }
  return [System.Diagnostics.Process]::Start($psi)
}

# 1) 词典服务（读 .env.cloud 连接 TiDB）
$p1 = Start-Detached 'node' '-r dotenv/config server.js' @{ DOTENV_CONFIG_PATH = '.env.cloud' }
Write-Host "词典服务已启动 (PID $($p1.Id))，端口 3000"

# 2) Cloudflare 免费隧道
$cf = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
if (-not (Test-Path $cf)) { $cf = 'cloudflared' }
Remove-Item "$root\tunnel.log" -ErrorAction SilentlyContinue
Remove-Item "$root\tunnel.err" -ErrorAction SilentlyContinue
$psi2 = [System.Diagnostics.ProcessStartInfo]::new()
$psi2.FileName = 'cmd.exe'
$psi2.Arguments = '/c "' + $cf + ' tunnel --url http://localhost:3000 --no-autoupdate > "' + $root + '\tunnel.log" 2>&1"'
$psi2.WorkingDirectory = $root
$psi2.UseShellExecute = $false
$psi2.CreateNoWindow = $true
$p2 = [System.Diagnostics.Process]::Start($psi2)
Write-Host "隧道已启动，等待公网地址..."

for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Seconds 2
  if (Test-Path "$root\tunnel.log") {
    $u = Select-String -Path "$root\tunnel.log" -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches | ForEach-Object { $_.Matches.Value } | Select-Object -Last 1
    if ($u) {
      Write-Host ""
      Write-Host "========================================" -ForegroundColor Cyan
      Write-Host " 在线词典公网地址：" -ForegroundColor Green
      Write-Host " $u" -ForegroundColor Cyan
      Write-Host "========================================" -ForegroundColor Cyan
      exit 0
    }
  }
}
Write-Host "警告：未获取到公网地址，请查看 tunnel.log" -ForegroundColor Yellow
