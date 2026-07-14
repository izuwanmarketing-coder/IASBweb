$ErrorActionPreference = "Stop"
$tools = Join-Path $PSScriptRoot "tools"
$binary = Join-Path $tools "yt-dlp.exe"
New-Item -ItemType Directory -Force -Path $tools | Out-Null
Write-Host "Downloading the local media engine..." -ForegroundColor Cyan
Invoke-WebRequest -Uri "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" -OutFile $binary
Write-Host "Droply is ready. Start it with: npm run dev -- -H 0.0.0.0" -ForegroundColor Green
