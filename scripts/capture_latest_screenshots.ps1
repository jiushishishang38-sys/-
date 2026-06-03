$ErrorActionPreference = "Stop"

$root = Resolve-Path "."
$out = Join-Path $root "screenshots\latest-report"
New-Item -ItemType Directory -Force -Path $out | Out-Null

$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
  $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
if (-not (Test-Path $edge)) {
  throw "Microsoft Edge executable not found."
}

$pages = @(
  @{ name = "01-index.png"; url = "http://127.0.0.1:4173/index.html"; width = 1600; height = 950 },
  @{ name = "02-guide.png"; url = "http://127.0.0.1:4173/guide.html"; width = 1600; height = 950 },
  @{ name = "03-eye.png"; url = "http://127.0.0.1:4173/eye.html"; width = 1600; height = 950 },
  @{ name = "04-experiment.png"; url = "http://127.0.0.1:4173/experiment.html"; width = 1600; height = 950 },
  @{ name = "05-report.png"; url = "http://127.0.0.1:4173/report.html"; width = 1600; height = 1200 }
)

foreach ($page in $pages) {
  $profile = Join-Path $out ("profile-" + [IO.Path]::GetFileNameWithoutExtension($page.name))
  New-Item -ItemType Directory -Force -Path $profile | Out-Null
  $shot = Join-Path $out $page.name
  & $edge `
    --headless=new `
    --disable-gpu `
    --no-sandbox `
    "--user-data-dir=$profile" `
    "--window-size=$($page.width),$($page.height)" `
    --virtual-time-budget=5000 `
    "--screenshot=$shot" `
    $page.url | Out-Null
}

Get-ChildItem $out -Filter "*.png" | Select-Object Name,Length,LastWriteTime
