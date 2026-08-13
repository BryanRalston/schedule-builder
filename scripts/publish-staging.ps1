# Publish an isolated staging copy of Manager Schedule Builder Pro.
# Production root files are never modified — only staging/ is rewritten.
# Usage (from repo root or anywhere):
#   powershell -File scripts/publish-staging.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Staging = Join-Path $Root 'staging'
$StagingUrl = 'https://bryanralston.github.io/schedule-builder/staging/'

Write-Host "Repo:     $Root"
Write-Host "Staging:  $Staging"

# --- version ---
$versionPath = Join-Path $Root 'version.json'
if (-not (Test-Path $versionPath)) { throw "Missing version.json at $versionPath" }
$versionObj = Get-Content $versionPath -Raw | ConvertFrom-Json
$version = [string]$versionObj.version
if ([string]::IsNullOrWhiteSpace($version)) { throw 'version.json has no version field' }

# --- clean + recreate staging ---
if (Test-Path $Staging) {
  Remove-Item -Recurse -Force $Staging
}
New-Item -ItemType Directory -Path $Staging | Out-Null

# --- copy root app files ---
$files = @(
  'index.html',
  'sw.js',
  'buy.html',
  'install.html',
  'monetization.json',
  'version.json',
  'manifest.webmanifest'
)
foreach ($f in $files) {
  $src = Join-Path $Root $f
  if (-not (Test-Path $src)) { throw "Missing required file: $f" }
  Copy-Item -Path $src -Destination (Join-Path $Staging $f) -Force
}

# folders
foreach ($dir in @('icons', 'legal')) {
  $srcDir = Join-Path $Root $dir
  if (-not (Test-Path $srcDir)) { throw "Missing required folder: $dir" }
  Copy-Item -Path $srcDir -Destination (Join-Path $Staging $dir) -Recurse -Force
}

# .nojekyll (GitHub Pages)
$nojekyllSrc = Join-Path $Root '.nojekyll'
$nojekyllDst = Join-Path $Staging '.nojekyll'
if (Test-Path $nojekyllSrc) {
  Copy-Item -Path $nojekyllSrc -Destination $nojekyllDst -Force
} else {
  New-Item -ItemType File -Path $nojekyllDst -Force | Out-Null
}

function Set-Utf8NoBom {
  param([string]$Path, [string]$Content)
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($Path, $Content, $utf8)
}

function Get-Utf8Text {
  param([string]$Path)
  return [System.IO.File]::ReadAllText($Path)
}

# --- isolation: service worker cache name ---
$swPath = Join-Path $Staging 'sw.js'
$sw = Get-Utf8Text $swPath
$stagingCache = "msb-pro-staging-v$version"
if ($sw -notmatch "const CACHE\s*=\s*'[^']+'") {
  throw 'Could not find CACHE constant in sw.js'
}
$sw = [regex]::Replace($sw, "const CACHE\s*=\s*'[^']+'", "const CACHE = '$stagingCache'")
# banner comment
$sw = $sw -replace 'Manager Schedule Builder Pro — service worker', 'Manager Schedule Builder Pro (Staging) — service worker'
Set-Utf8NoBom $swPath $sw
Write-Host "SW CACHE → $stagingCache"

# --- isolation: localStorage keys + branding in HTML ---
$htmlFiles = @('index.html', 'buy.html', 'install.html')
foreach ($name in $htmlFiles) {
  $path = Join-Path $Staging $name
  if (-not (Test-Path $path)) { continue }
  $html = Get-Utf8Text $path

  # localStorage key isolation (staging only — never touch production root)
  # 'msb_foo' / "msb_foo" → 'msb_stg_foo' / "msb_stg_foo"
  # also covers indexOf('msb_') → indexOf('msb_stg_')
  $html = $html.Replace("'msb_", "'msb_stg_")
  $html = $html.Replace('"msb_', '"msb_stg_')

  if ($name -eq 'index.html') {
    # robots: first real head charset only (case-sensitive; do not touch Word-export strings)
    $charsetNeedle = '<meta charset="UTF-8">'
    $charsetIdx = $html.IndexOf($charsetNeedle)
    if ($charsetIdx -ge 0 -and $html.IndexOf('name="robots"') -lt 0) {
      $robotsTag = $charsetNeedle + "`n<meta name=`"robots`" content=`"noindex,nofollow`">"
      $html = $html.Substring(0, $charsetIdx) + $robotsTag + $html.Substring($charsetIdx + $charsetNeedle.Length)
    }

    # document / brand titles (regex for unicode middots / dashes)
    $html = [regex]::Replace($html, '<title>Schedule Pro.*?Manager Shifts</title>', '<title>Schedule Pro (Staging) · Manager Shifts</title>', 1)
    $html = $html.Replace('content="Schedule Pro"', 'content="Schedule Pro Staging"')
    $html = $html.Replace(
      'content="Manager Schedule Builder Pro"',
      'content="Manager Schedule Builder Pro (Staging)"'
    )
    $html = [regex]::Replace(
      $html,
      'content="Manager Schedule Builder Pro\s*[—\-]',
      'content="Manager Schedule Builder Pro (Staging) —',
      1
    )
    $html = $html.Replace(
      '<h1 id="auth-title">Schedule Pro</h1>',
      '<h1 id="auth-title">Schedule Pro (Staging)</h1>'
    )
    $html = $html.Replace(
      '<h1>Schedule Pro</h1>',
      '<h1>Schedule Pro (Staging)</h1>'
    )
    $html = $html.Replace(
      '<strong>Install Schedule Pro</strong>',
      '<strong>Install Schedule Pro (Staging)</strong>'
    )
    $html = [regex]::Replace(
      $html,
      '<div><strong>Schedule Pro</strong>',
      '<div><strong>Schedule Pro (Staging)</strong>',
      1
    )
    $html = [regex]::Replace(
      $html,
      'id="app-version-label">v' + [regex]::Escape($version) + '</span>',
      ('id="app-version-label">v' + $version + '-staging</span>'),
      1
    )
    # APP_VERSION const
    $html = $html.Replace(
      "const APP_VERSION = '$version';",
      "const APP_VERSION = '$version-staging';"
    )
    $html = $html.Replace(
      'Open Schedule Pro from your home screen.',
      'Open Schedule Pro (Staging) from your home screen.'
    )

    # visible staging banner: inject only after the document <body> that follows </head>
    $banner = @"
<style id="msb-staging-banner-style">
  #msb-staging-banner {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100000;
    background: #ff5c00; color: #111;
    font: 600 13px/1.35 system-ui, -apple-system, sans-serif;
    text-align: center; padding: 8px 12px;
    box-shadow: 0 2px 10px rgba(0,0,0,.4);
    letter-spacing: 0.01em;
  }
  body.msb-staging { padding-top: 38px; }
  @media print { #msb-staging-banner { display: none !important; } body.msb-staging { padding-top: 0; } }
</style>
<div id="msb-staging-banner" role="status" aria-live="polite">STAGING - not the tester build - data separate from production</div>
<script>document.body.classList.add('msb-staging');</script>
"@
    if ($html.IndexOf('id="msb-staging-banner"') -lt 0) {
      $headEnd = $html.IndexOf('</head>')
      if ($headEnd -lt 0) { throw 'staging index.html missing </head>' }
      $bodyTag = '<body>'
      $bodyIdx = $html.IndexOf($bodyTag, $headEnd)
      if ($bodyIdx -lt 0) { throw 'staging index.html missing <body> after </head>' }
      $insertAt = $bodyIdx + $bodyTag.Length
      $html = $html.Substring(0, $insertAt) + "`n" + $banner + $html.Substring($insertAt)
    }
  }

  Set-Utf8NoBom $path $html
  Write-Host "Isolated keys + branding: $name"
}

# --- manifest ---
$manifestPath = Join-Path $Staging 'manifest.webmanifest'
$manifestText = Get-Utf8Text $manifestPath
$manifestText = $manifestText.Replace(
  '"name": "Manager Schedule Builder Pro"',
  '"name": "Manager Schedule Builder Pro (Staging)"'
)
$manifestText = $manifestText.Replace(
  '"short_name": "Schedule Pro"',
  '"short_name": "Schedule Pro Staging"'
)
$manifestText = $manifestText.Replace(
  '"id": "./"',
  '"id": "./staging"'
)
Set-Utf8NoBom $manifestPath $manifestText
Write-Host "manifest.webmanifest updated for staging"

# --- version.json in staging ---
$stgVersionPath = Join-Path $Staging 'version.json'
$stgVersionJson = @"
{
  "name": "Manager Schedule Builder Pro (Staging)",
  "version": "$version-staging",
  "platform": "pwa",
  "playPackage": "$($versionObj.playPackage)",
  "staging": true,
  "sourceVersion": "$version"
}
"@
Set-Utf8NoBom $stgVersionPath ($stgVersionJson.Trim() + "`n")

# --- STAGING.md inside folder ---
$generatedAt = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$stagingMd = @"
# Staging build (generated)

**Do not edit files in this folder by hand.**
Regenerate from the production app sources:

``````powershell
powershell -File scripts/publish-staging.ps1
``````

## URLs
- **Staging (safe sandbox):** $StagingUrl
- **Production (closed testers):** https://bryanralston.github.io/schedule-builder/

## Isolation
- localStorage keys use ``msb_stg_*`` (production uses ``msb_*``)
- Service worker cache: ``$stagingCache``
- Separate PWA identity / branding: Schedule Pro (Staging)
- ``noindex,nofollow`` - not for public discovery

## Local serve
``````powershell
powershell -File scripts/serve-staging.ps1
``````
Then open http://localhost:5174/

Generated from app version **$version** on $generatedAt.
"@
Set-Utf8NoBom (Join-Path $Staging 'STAGING.md') $stagingMd

Write-Host ''
Write-Host '=== Staging ready ===' -ForegroundColor Green
Write-Host "URL:   $StagingUrl"
Write-Host 'Local: powershell -File scripts/serve-staging.ps1'
Write-Host '       -> http://localhost:5174/'
Write-Host "Cache: $stagingCache"
Write-Host 'Keys:  msb_stg_*'
Write-Host ''
Write-Host 'Commit staging/ (do not gitignore) and push to origin main for phone testing on GitHub Pages.'
