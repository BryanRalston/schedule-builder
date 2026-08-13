# Serve the staging/ folder locally (default port 5174).
# Prefers npx serve; falls back to Python http.server.
# Usage:
#   powershell -File scripts/serve-staging.ps1
#   powershell -File scripts/serve-staging.ps1 -Port 5180

param(
  [int]$Port = 5174
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Staging = Join-Path $Root 'staging'

if (-not (Test-Path (Join-Path $Staging 'index.html'))) {
  Write-Host 'staging/ missing — running publish-staging.ps1 first...'
  & (Join-Path $PSScriptRoot 'publish-staging.ps1')
}

Write-Host "Serving $Staging on http://localhost:$Port/"
Write-Host 'Ctrl+C to stop.'
Write-Host ''

# Prefer npx serve (nice SPA/static defaults)
$npx = Get-Command npx -ErrorAction SilentlyContinue
if ($npx) {
  Set-Location $Root
  & npx --yes serve $Staging -l $Port
  exit $LASTEXITCODE
}

$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { $py = Get-Command py -ErrorAction SilentlyContinue }
if ($py) {
  Set-Location $Staging
  & $py.Source -m http.server $Port
  exit $LASTEXITCODE
}

throw 'Need either Node (npx) or Python to serve staging locally.'
