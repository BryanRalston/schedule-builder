# Build and sign Schedule Pro TWA AAB for Play (version from android-twa/app/build.gradle)
$ErrorActionPreference = "Stop"
$env:JAVA_HOME = "C:\Java\jdk17"
if (-not (Test-Path $env:JAVA_HOME)) {
  $env:JAVA_HOME = (Get-ChildItem "C:\Program Files\Microsoft\jdk*" -Directory | Select-Object -First 1).FullName
}
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
$env:ANDROID_HOME = "C:\Users\bryma\AppData\Local\Android\Sdk"

$props = @{}
Get-Content "C:\Users\bryma\schedule-builder-secrets\keystore.properties" | ForEach-Object {
  if ($_ -match '^([^=]+)=(.*)$') { $props[$Matches[1].Trim()] = $Matches[2].Trim() }
}
$storeFile = $props['storeFile']
$storePass = $props['storePassword']
$keyAlias = $props['keyAlias']
$keyPass = $props['keyPassword']

$twa = "C:\Users\bryma\schedule-builder\android-twa"
Set-Location $twa

Write-Host "=== Gradle bundleRelease ==="
& .\gradlew.bat bundleRelease --no-daemon
if ($LASTEXITCODE -ne 0) { throw "gradlew bundleRelease failed: $LASTEXITCODE" }

$unsigned = Join-Path $twa "app\build\outputs\bundle\release\app-release.aab"
if (-not (Test-Path $unsigned)) { throw "Missing $unsigned" }

# Prefer jarsigner (JDK) then rename; Play accepts jarsigner-signed AABs
$signed = Join-Path $twa "app-release-bundle.aab"
Copy-Item $unsigned "$unsigned.unsigned.aab" -Force
Copy-Item $unsigned $signed -Force

Write-Host "=== Signing AAB ==="
& jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 `
  -keystore $storeFile `
  -storepass $storePass `
  -keypass $keyPass `
  $signed $keyAlias
if ($LASTEXITCODE -ne 0) { throw "jarsigner failed: $LASTEXITCODE" }

Write-Host "=== Verify ==="
& jarsigner -verify -verbose -certs $signed 2>&1 | Select-Object -First 20

$len = (Get-Item $signed).Length
Write-Host "OK: $signed ($len bytes)"
Write-Host "Upload this file to Play Console closed testing as 2.3.1 (231)."
