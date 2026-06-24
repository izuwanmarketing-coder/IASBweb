param(
  [string]$PdfPath = "C:\Users\User\Downloads\PRICELIST IASB 22.05.2026.xlsx - MAIN IASB (1).pdf",
  [string]$DocxPath = "$PSScriptRoot\..\pricelist-links.docx",
  [string]$InventoryPath = "$PSScriptRoot\..\inventory.js",
  [string]$OutputPath = "$PSScriptRoot\..\car-photos.js",
  [int]$PhotosPerCar = 5
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Normalize-Text([string]$Text) {
  return (($Text.ToUpperInvariant() -replace '\([^)]*\)', '') -replace '[^A-Z0-9]+', ' ').Trim()
}

function Get-ModelTokens([string]$Text) {
  $ignore = @("TOYOTA", "HONDA", "MERCEDES", "BENZ", "DAIHATSU", "LEXUS", "PACKAGE", "EDITION", "LINE", "STYLE", "SEATER")
  return @(Normalize-Text $Text).Split(" ", [StringSplitOptions]::RemoveEmptyEntries) |
    Where-Object { $_.Length -gt 1 -and $_ -notin $ignore }
}

# Extract page link annotations in visual top-to-bottom order.
$ascii = [Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes($PdfPath))
$pageTokens = [regex]::Matches($ascii, '/Type\s*/Page(?!s)')
$pageLinks = @()
for ($pageIndex = 0; $pageIndex -lt $pageTokens.Count; $pageIndex++) {
  $start = $pageTokens[$pageIndex].Index
  $end = if ($pageIndex + 1 -lt $pageTokens.Count) { $pageTokens[$pageIndex + 1].Index } else { $ascii.Length }
  $segment = $ascii.Substring($start, $end - $start)
  $rawLinks = @()
  foreach ($annotation in [regex]::Split($segment, '/Type\s*/Annot') | Select-Object -Skip 1) {
    $rect = [regex]::Match($annotation, '/Rect\s*\[\s*([\d.]+)\s+([\d.]+)\s+[\d.]+\s+[\d.]+\s*\]')
    $uri = [regex]::Match($annotation, '/URI\s*\((https://drive\.google\.com/(?:drive/(?:u/\d+/)?folders/)[^)]*)\)')
    if ($rect.Success -and $uri.Success) {
      $rawLinks += [pscustomobject]@{
        X = [double]$rect.Groups[1].Value
        Y = [double]$rect.Groups[2].Value
        Url = $uri.Groups[1].Value
      }
    }
  }
  $rawLinks = @($rawLinks | Sort-Object Y -Descending)
  $groups = @()
  foreach ($link in $rawLinks) {
    $group = $groups | Where-Object { [Math]::Abs($_.Y - $link.Y) -lt 12 } | Select-Object -First 1
    if ($group) {
      $group.Links += $link
    } else {
      $groups += [pscustomobject]@{ Y = $link.Y; Links = @($link) }
    }
  }
  $pageLinks += ,@($groups | ForEach-Object {
    $_.Links | Sort-Object @{ Expression = { if ($_.X -gt 430) { 0 } else { 1 } } }, @{ Expression = "X"; Descending = $true } | Select-Object -First 1
  })
}

# Extract linked chassis rows from the Word-converted PDF.
$zip = [IO.Compression.ZipFile]::OpenRead((Resolve-Path $DocxPath))
$entry = $zip.Entries | Where-Object FullName -eq "word/document.xml"
$reader = [IO.StreamReader]::new($entry.Open())
[xml]$xml = $reader.ReadToEnd()
$reader.Dispose()
$zip.Dispose()
$ns = [Xml.XmlNamespaceManager]::new($xml.NameTable)
$ns.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")
$tables = $xml.SelectNodes("//w:tbl", $ns)
$linkedRows = @()

for ($tableIndex = 0; $tableIndex -lt $tables.Count; $tableIndex++) {
  $allRows = @()
  $underlinedRows = @()
  foreach ($row in $tables[$tableIndex].SelectNodes("./w:tr", $ns)) {
    $cells = @($row.SelectNodes("./w:tc", $ns))
    if ($cells.Count -lt 12) { continue }
    $values = @($cells | ForEach-Object { (($_.SelectNodes(".//w:t", $ns) | ForEach-Object InnerText) -join "") })
    if ($values[0] -notmatch '^\d+$' -or [string]::IsNullOrWhiteSpace($values[7])) { continue }
    $record = [pscustomobject]@{
      Page = $tableIndex
      Model = ($values[6] -replace '\s+', ' ').Trim()
      Chassis = $values[7].Trim()
      Year = $values[3].Trim()
      Colour = ($values[9] -replace '\s+', ' ').Trim()
      Status = ($values[10] -replace '\s+', ' ').Trim()
      Price = [int](($values[11] -replace '[^0-9]', '') -replace '00$', '')
      Location = if ($values[1] -match "GOMBAK") { "Gombak" } elseif ($values[1] -match "WAHYU") { "Wahyu" } elseif ($values[1] -match "WV6") { "Wanmo" } else { "Incoming" }
    }
    $allRows += $record
    if ($cells[7].SelectSingleNode(".//w:u", $ns)) { $underlinedRows += $record }
  }
  $rows = if ($allRows.Count -eq $pageLinks[$tableIndex].Count) { $allRows } else { $underlinedRows }
  if ($rows.Count -ne $pageLinks[$tableIndex].Count) {
    throw "Page $($tableIndex + 1): $($allRows.Count) data rows, $($underlinedRows.Count) underlined rows, but $($pageLinks[$tableIndex].Count) Drive links."
  }
  for ($rowIndex = 0; $rowIndex -lt $rows.Count; $rowIndex++) {
    $rows[$rowIndex] | Add-Member NoteProperty FolderUrl $pageLinks[$tableIndex][$rowIndex].Url
    $linkedRows += $rows[$rowIndex]
  }
}

# Read the static inventory array as JSON.
$inventorySource = Get-Content -Raw -Encoding UTF8 $InventoryPath
$json = [regex]::Match($inventorySource, '(?s)window\.inventoryData\s*=\s*(\[.*\])\.map').Groups[1].Value
$inventory = ConvertFrom-Json $json

function Find-RowForInventory($item) {
  $brand, $model, $variant, $type, $price, $status, $location, $units = $item
  $year = [regex]::Match($variant, '\b(20\d{2})\b').Value
  $tokens = @(Get-ModelTokens $model)
  $candidates = @($linkedRows | Where-Object {
    $_.Price -eq [int]$price -and
    $_.Location -eq $location -and
    (!$year -or $_.Year -eq $year)
  })
  return $candidates | ForEach-Object {
    $sourceTokens = @(Get-ModelTokens $_.Model)
    $score = @($tokens | Where-Object { $_ -in $sourceTokens }).Count
    [pscustomobject]@{ Row = $_; Score = $score }
  } | Sort-Object Score -Descending | Where-Object Score -gt 0 | Select-Object -First 1
}

$result = [ordered]@{}
$folderCache = @{}
for ($index = 0; $index -lt $inventory.Count; $index++) {
  $match = Find-RowForInventory $inventory[$index]
  if (-not $match) { continue }
  $folderUrl = $match.Row.FolderUrl
  if (-not $folderCache.ContainsKey($folderUrl)) {
    $content = (Invoke-WebRequest -UseBasicParsing $folderUrl).Content
    $fileMatches = [regex]::Matches(
      $content,
      'data-id="([A-Za-z0-9_-]{20,})".{0,5000}?aria-label="([^"]+?) Image',
      [Text.RegularExpressions.RegexOptions]::Singleline
    )
    $seen = @{}
    $photos = @()
    foreach ($fileMatch in $fileMatches) {
      $fileId = $fileMatch.Groups[1].Value
      if ($seen[$fileId]) { continue }
      $seen[$fileId] = $true
      $photos += [ordered]@{
        id = $fileId
        name = [Net.WebUtility]::HtmlDecode($fileMatch.Groups[2].Value)
        src = "https://lh3.googleusercontent.com/d/$fileId=w1000"
      }
      if ($photos.Count -ge $PhotosPerCar) { break }
    }
    $folderCache[$folderUrl] = $photos
  }
  if ($folderCache[$folderUrl].Count) {
    $result["$index"] = [ordered]@{
      chassis = $match.Row.Chassis
      folder = $folderUrl
      photos = $folderCache[$folderUrl]
    }
  }
  Write-Progress -Activity "Syncing Drive galleries" -Status "$($index + 1) / $($inventory.Count)" -PercentComplete ((($index + 1) / $inventory.Count) * 100)
}

$payload = $result | ConvertTo-Json -Depth 5
$script = "window.carPhotoData = $payload;`r`n"
[IO.File]::WriteAllText((Resolve-Path (Split-Path $OutputPath)).Path + "\" + (Split-Path $OutputPath -Leaf), $script, [Text.UTF8Encoding]::new($false))
Write-Host "Mapped $($result.Count) inventory cards to Drive galleries."
