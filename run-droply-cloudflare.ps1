$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$cloudflared = Join-Path $root "tools\cloudflared.exe"

if (-not (Test-Path $cloudflared)) {
  throw "cloudflared.exe is missing. Run the Droply setup first."
}

$backend = Start-Process -FilePath "npm.cmd" `
  -ArgumentList @("start", "--", "-H", "127.0.0.1", "-p", "3002") `
  -WorkingDirectory $root `
  -WindowStyle Hidden `
  -PassThru

try {
  & $cloudflared tunnel --url http://127.0.0.1:3002 run droply-engine
} finally {
  if (-not $backend.HasExited) {
    Stop-Process -Id $backend.Id
  }
}
