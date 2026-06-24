$root = $PSScriptRoot
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:4173/")
$listener.Start()

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png"  = "image/png"
  ".svg"  = "image/svg+xml"
}

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $path = $context.Request.Url.AbsolutePath.TrimStart("/")
  if ([string]::IsNullOrWhiteSpace($path)) { $path = "index.html" }
  $file = [IO.Path]::GetFullPath((Join-Path $root $path))

  if ($file.StartsWith($root) -and (Test-Path -LiteralPath $file -PathType Leaf)) {
    $bytes = [IO.File]::ReadAllBytes($file)
    $extension = [IO.Path]::GetExtension($file).ToLowerInvariant()
    $context.Response.ContentType = if ($mime[$extension]) { $mime[$extension] } else { "application/octet-stream" }
    $context.Response.StatusCode = 200
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $context.Response.StatusCode = 404
  }

  $context.Response.OutputStream.Close()
}
