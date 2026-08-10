# PITTO を任意のフォルダに展開して、起動できる状態にする。
#
#   .\install-windows.ps1
#   .\install-windows.ps1 -Dest "C:\path\to\PITTO"
#
# Git がなくても動く。PowerShell から実行すること(cmd.exe では日本語パスが化けることがある)。

param(
  [string]$Dest = (Join-Path (Get-Location) "PITTO"),
  [string]$Branch = "claude/pitto-project-github-z0furk"
)

$ErrorActionPreference = "Stop"

$url = "https://github.com/Jin07701/jin07701.github.io/archive/refs/heads/$Branch.zip"
$zip = Join-Path $env:TEMP "pitto-source.zip"
$tmp = Join-Path $env:TEMP "pitto-source"

Write-Host "ダウンロードしています..."
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
Invoke-WebRequest -Uri $url -OutFile $zip

Write-Host "展開しています..."
Expand-Archive -Path $zip -DestinationPath $tmp -Force

# zip のトップ階層は "<repo>-<branch をハイフンにしたもの>" になる。名前を決め打ちせず探す。
$root = Get-ChildItem $tmp -Directory | Select-Object -First 1
$src = Join-Path $root.FullName "pitto"
if (-not (Test-Path $src)) {
  throw "zip の中に pitto フォルダが見つかりませんでした: $($root.FullName)"
}

Copy-Item -Path (Join-Path $src "*") -Destination $Dest -Recurse -Force

Remove-Item $zip -Force
Remove-Item $tmp -Recurse -Force

Set-Location $Dest
Write-Host "配置しました: $Dest"

Write-Host "依存関係をインストールしています..."
npm install

# Docker が動いていないと npm run init は DB 起動のところで止まる。先に確かめる。
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Docker Desktop が起動していません。"
  Write-Host "起動してから、このフォルダで次を実行してください:"
  Write-Host "  npm run init"
  Write-Host "  npm run dev"
  exit 0
}

npm run init

Write-Host ""
Write-Host "準備できました。次を実行すると http://localhost:3000 で開きます:"
Write-Host "  npm run dev"
