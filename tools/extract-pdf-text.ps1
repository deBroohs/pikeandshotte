param(
  [Parameter(Mandatory = $true)]
  [string]$PdfPath,

  [int]$StartPage = 1,

  [int]$MaxPages = 0
)

$ErrorActionPreference = "Stop"
$Latin1 = [System.Text.Encoding]::GetEncoding(28591)

function Decode-PdfLiteralString {
  param([string]$Value)

  $builder = New-Object System.Text.StringBuilder

  for ($index = 0; $index -lt $Value.Length; $index++) {
    $char = $Value[$index]

    if ($char -ne "\") {
      [void]$builder.Append($char)
      continue
    }

    $index++
    if ($index -ge $Value.Length) {
      break
    }

    $escaped = $Value[$index]

    switch ($escaped) {
      "n" { [void]$builder.Append("`n") }
      "r" { [void]$builder.Append("`r") }
      "t" { [void]$builder.Append("`t") }
      "b" { [void]$builder.Append([char]8) }
      "f" { [void]$builder.Append([char]12) }
      "(" { [void]$builder.Append("(") }
      ")" { [void]$builder.Append(")") }
      "\" { [void]$builder.Append("\") }
      default {
        if ($escaped -match "[0-7]") {
          $octal = [string]$escaped

          for ($octalIndex = 0; $octalIndex -lt 2; $octalIndex++) {
            if ($index + 1 -ge $Value.Length) {
              break
            }

            if ($Value[$index + 1] -notmatch "[0-7]") {
              break
            }

            $index++
            $octal += $Value[$index]
          }

          [void]$builder.Append([char][Convert]::ToInt32($octal, 8))
        } else {
          [void]$builder.Append($escaped)
        }
      }
    }
  }

  $builder.ToString()
}

function Expand-FlateStream {
  param([byte[]]$CompressedData)

  if ($CompressedData.Length -lt 6) {
    return ""
  }

  $rawDeflate = New-Object byte[] ($CompressedData.Length - 6)
  [Array]::Copy($CompressedData, 2, $rawDeflate, 0, $rawDeflate.Length)

  $memory = New-Object System.IO.MemoryStream(,$rawDeflate)
  $deflate = New-Object System.IO.Compression.DeflateStream($memory, [System.IO.Compression.CompressionMode]::Decompress)
  $reader = New-Object System.IO.StreamReader($deflate, [System.Text.Encoding]::ASCII)

  try {
    return $reader.ReadToEnd()
  }
  finally {
    $reader.Close()
    $deflate.Close()
    $memory.Close()
  }
}

function Get-ObjectMap {
  param([string]$PdfContent)

  $map = @{}
  # Some linearized PDFs store objects without line-start boundaries before `obj` / `endobj`.
  # Use a non-anchored match so we can still recover ordinary objects from those files.
  $objectMatches = [regex]::Matches($PdfContent, "(?s)(\d+)\s+0\s+obj\s*(.*?)\s*endobj")

  foreach ($match in $objectMatches) {
    $map[[int]$match.Groups[1].Value] = $match.Groups[2].Value
  }

  $map
}

function Get-ContentReferences {
  param([string]$PageObject)

  $refs = New-Object System.Collections.Generic.List[int]
  $contentMatch = [regex]::Match($PageObject, "/Contents\s+(\[(.*?)\]|\d+\s+0\s+R)", "Singleline")

  if (-not $contentMatch.Success) {
    return $refs
  }

  if ($contentMatch.Groups[2].Success) {
    $contentRefs = [regex]::Matches($contentMatch.Groups[2].Value, "(\d+)\s+0\s+R")
  } else {
    $contentRefs = [regex]::Matches($contentMatch.Groups[1].Value, "(\d+)\s+0\s+R")
  }

  foreach ($contentRef in $contentRefs) {
    $refs.Add([int]$contentRef.Groups[1].Value)
  }

  $refs
}

function Get-StreamBody {
  param(
    [string]$ObjectBody,
    [string]$ObjectRaw
  )

  $streamMatch = [regex]::Match($ObjectRaw, "(?s)^(.*?)stream\r?\n(.*?)\r?\nendstream\s*$")

  if (-not $streamMatch.Success) {
    return ""
  }

  $streamBytes = $Latin1.GetBytes($streamMatch.Groups[2].Value)

  if ($ObjectBody -match "/FlateDecode") {
    try {
      return Expand-FlateStream $streamBytes
    }
    catch {
      return ""
    }
  }

  $streamMatch.Groups[2].Value
}

function Extract-TextOperations {
  param([string]$StreamText)

  $textPieces = New-Object System.Collections.Generic.List[string]
  $operationMatches = [regex]::Matches($StreamText, '(?s)\[(.*?)\]\s*TJ|\((?:\\.|[^\\)])*\)\s*Tj')

  foreach ($operation in $operationMatches) {
    if ($operation.Groups[1].Success) {
      $arrayStrings = [regex]::Matches($operation.Groups[1].Value, '\((?:\\.|[^\\)])*\)')
      $segment = New-Object System.Text.StringBuilder

      foreach ($arrayString in $arrayStrings) {
        $literal = $arrayString.Value.Substring(1, $arrayString.Value.Length - 2)
        [void]$segment.Append((Decode-PdfLiteralString $literal))
      }

      $candidate = $segment.ToString().Trim()
      if ($candidate) {
        $textPieces.Add($candidate)
      }

      continue
    }

    $literalMatch = [regex]::Match($operation.Value, '\((.*)\)\s*Tj', "Singleline")
    if ($literalMatch.Success) {
      $candidate = (Decode-PdfLiteralString $literalMatch.Groups[1].Value).Trim()
      if ($candidate) {
        $textPieces.Add($candidate)
      }
    }
  }

  $textPieces
}

function Get-PageText {
  param(
    [int]$PageNumber,
    [System.Collections.IDictionary]$ObjectMap
  )

  $pageObjects = @(
    $ObjectMap.Keys |
      Sort-Object |
      ForEach-Object { [PSCustomObject]@{ Number = $_; Body = $ObjectMap[$_] } } |
      Where-Object { $_.Body -match "/Type\s*/Page\b" }
  )

  if ($PageNumber -lt 1 -or $PageNumber -gt $pageObjects.Count) {
    return ""
  }

  $pageObject = $pageObjects[$PageNumber - 1]
  $contentRefs = Get-ContentReferences $pageObject.Body
  $pageLines = New-Object System.Collections.Generic.List[string]

  foreach ($contentRef in $contentRefs) {
    if (-not $ObjectMap.Contains($contentRef)) {
      continue
    }

    $objectRaw = $ObjectMap[$contentRef]
    $objectBody = $objectRaw
    $streamText = Get-StreamBody -ObjectBody $objectBody -ObjectRaw $objectRaw

    if (-not $streamText) {
      continue
    }

    foreach ($line in (Extract-TextOperations $streamText)) {
      $pageLines.Add($line)
    }
  }

  $pageLines -join "`n"
}

$pdfBytes = [System.IO.File]::ReadAllBytes($PdfPath)
$pdfContent = $Latin1.GetString($pdfBytes)
$objectMap = Get-ObjectMap $pdfContent

$pageObjects = @(
  $objectMap.Keys |
    Sort-Object |
    ForEach-Object { [PSCustomObject]@{ Number = $_; Body = $objectMap[$_] } } |
    Where-Object { $_.Body -match "/Type\s*/Page\b" }
)

$firstPage = [Math]::Max(1, $StartPage)
$limit = $pageObjects.Count
if ($MaxPages -gt 0) {
  $limit = [Math]::Min($limit, $firstPage + $MaxPages - 1)
}

for ($page = $firstPage; $page -le $limit; $page++) {
  Write-Output ("===== PAGE $page =====")
  Write-Output (Get-PageText -PageNumber $page -ObjectMap $objectMap)
  Write-Output ""
}
