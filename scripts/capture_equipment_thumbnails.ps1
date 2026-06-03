$ErrorActionPreference = "Stop"

$root = Resolve-Path "."
$out = Join-Path $root "screenshots\latest-report\equipment"
New-Item -ItemType Directory -Force -Path $out | Out-Null

$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) {
  $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}
if (-not (Test-Path $edge)) {
  throw "Microsoft Edge executable not found."
}

$models = @(
  "bench",
  "source",
  "object",
  "convex",
  "concave",
  "cylinder",
  "support",
  "eyeD",
  "eyeG",
  "screen"
)

foreach ($model in $models) {
  $profile = Join-Path $out ("profile-" + $model)
  New-Item -ItemType Directory -Force -Path $profile | Out-Null
  $shot = Join-Path $out ($model + ".png")
  $url = "http://127.0.0.1:4173/model-thumbnail.html?model=$model"
  & $edge `
    --headless=new `
    --disable-gpu `
    --no-sandbox `
    "--user-data-dir=$profile" `
    --window-size=480,320 `
    --virtual-time-budget=5000 `
    "--screenshot=$shot" `
    $url | Out-Null
}

Get-ChildItem $out -Filter "*.png" | Select-Object Name,Length,LastWriteTime
