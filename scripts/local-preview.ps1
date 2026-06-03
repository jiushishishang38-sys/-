param(
  [string]$Root = (Join-Path $PSScriptRoot "..\dist"),
  [int]$Port = 4173
)

$ErrorActionPreference = "Stop"
$resolvedRoot = (Resolve-Path -LiteralPath $Root).Path
$listener = $null
$prefix = $null
$selectedPort = $Port

for ($candidate = $Port; $candidate -lt ($Port + 20); $candidate++) {
  $candidateListener = [System.Net.HttpListener]::new()
  $candidatePrefix = "http://127.0.0.1:$candidate/"
  try {
    $candidateListener.Prefixes.Add($candidatePrefix)
    $candidateListener.Start()
    $listener = $candidateListener
    $prefix = $candidatePrefix
    $selectedPort = $candidate
    break
  } catch {
    $candidateListener.Close()
  }
}

if (-not $listener) {
  Write-Host ""
  Write-Host "Could not find an available preview port from $Port to $($Port + 19)."
  Write-Host "Close old preview windows and try again."
  Write-Host ""
  pause
  exit 1
}

$types = @{
  ".html" = "text/html; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".mp4" = "video/mp4"
  ".glb" = "model/gltf-binary"
  ".gltf" = "model/gltf+json"
  ".svg" = "image/svg+xml"
}

Start-Process $prefix
Write-Host ""
Write-Host "Local preview is running:"
Write-Host "  $prefix"
if ($selectedPort -ne $Port) {
  Write-Host ""
  Write-Host "Port $Port was already in use, so this preview is using port $selectedPort."
}
Write-Host ""
Write-Host "Entry pages:"
Write-Host "  Home:       ${prefix}index.html"
Write-Host "  Experiment: ${prefix}experiment.html"
Write-Host ""
Write-Host "Close this window to stop the preview."
Write-Host ""

while ($listener.IsListening) {
  try {
    $context = $listener.GetContext()
    $requestPath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath)
    if ($requestPath -eq "/") {
      $requestPath = "/index.html"
    }

    $relativePath = $requestPath.TrimStart("/") -replace "/", [IO.Path]::DirectorySeparatorChar
    $filePath = [IO.Path]::GetFullPath((Join-Path $resolvedRoot $relativePath))

    if (-not $filePath.StartsWith($resolvedRoot, [StringComparison]::OrdinalIgnoreCase) -or
        -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
      $context.Response.StatusCode = 404
      $bytes = [Text.Encoding]::UTF8.GetBytes("Not found")
      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      $context.Response.Close()
      continue
    }

    $extension = [IO.Path]::GetExtension($filePath).ToLowerInvariant()
    $contentType = $types[$extension]
    if (-not $contentType) {
      $contentType = "application/octet-stream"
    }

    $bytes = [IO.File]::ReadAllBytes($filePath)
    $context.Response.ContentType = $contentType
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $context.Response.Close()
  } catch {
    if ($context -and $context.Response) {
      $context.Response.StatusCode = 500
      $context.Response.Close()
    }
  }
}
