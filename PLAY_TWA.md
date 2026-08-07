# Google Play TWA (Bubblewrap) — Manager Schedule Builder Pro

**Package id:** `com.managerschedulebuilder.pro`  
**Version name:** `2.1.0` · **versionCode:** `210`  
**App name:** Manager Schedule Builder Pro · **Launcher:** Schedule Pro

Trusted Web Activity shell around the live HTTPS PWA. Scheduler stays offline-first in the browser.

---

## Status (as of packaging session)

| Step | Status |
|------|--------|
| JDK 17 installed (Microsoft OpenJDK) | Done |
| Bubblewrap CLI `@bubblewrap/cli` | Done (global npm) |
| Android SDK + build-tools 36.1.0 | Done (existing SDK + install) |
| TWA project generated | Done → `android-twa/` |
| Upload keystore | Done (outside repo) |
| SHA-256 in live `assetlinks.json` | Done (upload cert) |
| Signed `.aab` + `.apk` | Done (local only, gitignored) |
| Play Console upload | **Bryan** |
| Play App Signing SHA added to assetlinks | **Bryan** (after first upload) |

### Live URLs

- App: https://bryanralston.github.io/schedule-builder/
- Manifest: https://bryanralston.github.io/schedule-builder/manifest.webmanifest
- Privacy: https://bryanralston.github.io/schedule-builder/legal/privacy.html
- Asset links: https://bryanralston.github.io/schedule-builder/.well-known/assetlinks.json

### Local artifacts (do not commit)

| Item | Path |
|------|------|
| Signed App Bundle (Play upload) | `android-twa/app-release-bundle.aab` |
| Signed APK (sideload test) | `android-twa/app-release-signed.apk` |
| Keystore + passwords | `C:\Users\bryma\schedule-builder-secrets\` (OUTSIDE git) |
| Bubblewrap config | `%USERPROFILE%\.bubblewrap\config.json` |
| JDK no-space junction | `C:\Java\jdk17` → Microsoft JDK 17 (Bubblewrap breaks on spaces in JAVA path) |

**Back up** `C:\Users\bryma\schedule-builder-secrets\` offline. Losing the keystore blocks updates signed with this upload key.

---

## Rebuild later

```powershell
$env:JAVA_HOME = "C:\Java\jdk17"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
$env:ANDROID_HOME = "C:\Users\bryma\AppData\Local\Android\Sdk"

# Load passwords from secrets file (do not echo)
$props = @{}
Get-Content "C:\Users\bryma\schedule-builder-secrets\keystore.properties" | ForEach-Object {
  if ($_ -match '^([^=]+)=(.*)$') { $props[$Matches[1]] = $Matches[2] }
}
$env:BUBBLEWRAP_KEYSTORE_PASSWORD = $props['storePassword']
$env:BUBBLEWRAP_KEY_PASSWORD = $props['keyPassword']

cd C:\Users\bryma\schedule-builder\android-twa
bubblewrap build --skipPwaValidation
```

Regenerate project from live manifest (non-interactive helper):

```powershell
cd C:\Users\bryma\schedule-builder
node .\scripts\noninteractive-twa-init.js
```

Interactive equivalent:

```powershell
bubblewrap init --manifest=https://bryanralston.github.io/schedule-builder/manifest.webmanifest --directory=android-twa
```

Use package id `com.managerschedulebuilder.pro`.

---

## Play Console remaining steps (Bryan)

1. Open [Google Play Console](https://play.google.com/console) → Create app (or open existing).
2. Package name must be **`com.managerschedulebuilder.pro`** (cannot change after create).
3. **Production / Testing** → Create release → Upload  
   `C:\Users\bryma\schedule-builder\android-twa\app-release-bundle.aab`
4. After upload, open **Setup → App integrity / App signing**:
   - Copy the **App signing key certificate** SHA-256 from Play.
   - Add it as a **second** fingerprint in `.well-known/assetlinks.json` (keep the upload key fingerprint too).
   - Commit + push so GitHub Pages serves the updated file.
5. Store listing — use copy from `store/listing.html`  
   - Feature graphic: `store/feature-graphic-1024x500.png`  
   - Screenshots: `store/screenshots/`  
   - High-res icon: `icons/icon-512.png`
6. Privacy policy URL:  
   `https://bryanralston.github.io/schedule-builder/legal/privacy.html`
7. Complete Data safety (local-only / no account server), content rating, target audience.
8. Verify Digital Asset Links (full-screen TWA, no Chrome custom-tab bar):  
   https://developers.google.com/digital-asset-links/tools/generator  
   Package: `com.managerschedulebuilder.pro`  
   Domain: `bryanralston.github.io`
9. Submit for review.

### Note on host / project Pages

TWA `host` is `bryanralston.github.io` with  
`startUrl` `/schedule-builder/?source=pwa` and  
`fullScopeUrl` `https://bryanralston.github.io/schedule-builder/`.  
That is correct for a GitHub **project** site. A custom domain later would need a new Bubblewrap init/update + Play release.

---

## assetlinks.json shape

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.managerschedulebuilder.pro",
      "sha256_cert_fingerprints": [
        "<UPLOAD_KEY_SHA256>",
        "<PLAY_APP_SIGNING_SHA256_WHEN_AVAILABLE>"
      ]
    }
  }
]
```

Upload cert fingerprint is already live. Add Play’s app-signing cert after first AAB upload.

---

## Secrets policy

- Keystore and passwords live only under `C:\Users\bryma\schedule-builder-secrets\`
- Repo `.gitignore` blocks `*.keystore`, `keystore.properties`, `*.aab`, `*.apk`, Gradle build dirs
- `twa-manifest.json` points signingKey.path at the secrets keystore (absolute path on this machine)
