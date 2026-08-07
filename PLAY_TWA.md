# Google Play TWA (Bubblewrap) — Manager Schedule Builder Pro

**Package id:** `com.managerschedulebuilder.pro`  
**Version:** 2.1.0  
**App name:** Schedule Pro / Manager Schedule Builder Pro

This is a **Trusted Web Activity** shell around the live HTTPS PWA. The scheduler stays offline-first in the browser; Play ships a thin Android wrapper.

## Live URL (GitHub Pages project site)

Expected:

```
https://bryanralston.github.io/schedule-builder/
```

Manifest (for Bubblewrap):

```
https://bryanralston.github.io/schedule-builder/manifest.webmanifest
```

Privacy policy (Play Console):

```
https://bryanralston.github.io/schedule-builder/legal/privacy.html
```

Digital Asset Links (must be served at site root under `.well-known`):

```
https://bryanralston.github.io/schedule-builder/.well-known/assetlinks.json
```

> **Note:** Paths in the PWA use **relative** URLs so the app works under `/schedule-builder/`. If you later move to a custom domain at the site root, relative paths still work.

---

## Prerequisites (Windows)

Java is **not** currently available on this machine. Install before Bubblewrap:

1. **JDK 17+** (Temurin recommended)  
   - https://adoptium.net/  
   - Confirm: `java -version`
2. **Android command-line tools / SDK** (Bubblewrap can prompt to install)  
   - Or Android Studio if you prefer a full IDE
3. **Node.js + npm** (already available)
4. Bubblewrap CLI:

```powershell
npm install -g @bubblewrap/cli
bubblewrap --version
```

---

## 1. Bubblewrap init (against LIVE HTTPS)

From a **new empty folder** (do not init inside the static web repo):

```powershell
mkdir C:\Users\bryma\projects\schedule-pro-twa
cd C:\Users\bryma\projects\schedule-pro-twa

bubblewrap init --manifest https://bryanralston.github.io/schedule-builder/manifest.webmanifest
```

When prompted, use:

| Prompt | Value |
|--------|--------|
| Package ID | `com.managerschedulebuilder.pro` |
| App name | `Schedule Pro` |
| Launcher name | `Schedule Pro` |
| Theme color | `#1a1a2e` |
| Background color | `#1a1a2e` |
| Start URL | leave as detected from manifest (under `/schedule-builder/`) |
| Display mode | `standalone` |
| Icon | accept generated from maskable 512 if offered |

Bubblewrap creates an Android project + signing config.

---

## 2. Signing keystore

If Bubblewrap does not create one for you:

```powershell
keytool -genkey -v -keystore schedule-pro-upload.keystore -alias schedule-pro -keyalg RSA -keysize 2048 -validity 10000
```

**Store the keystore + passwords offline.** Losing them blocks Play updates.

Get the **SHA-256** fingerprint of the **upload** key (and later the Play App Signing cert if enrolled):

```powershell
keytool -list -v -keystore schedule-pro-upload.keystore -alias schedule-pro
```

Copy the `SHA256:` line (colon-separated hex).

---

## 3. assetlinks.json

Repo file (placeholder until you have a real cert):

```
.well-known/assetlinks.json
```

Replace `REPLACE_WITH_YOUR_UPLOAD_KEY_SHA256` with your fingerprint **without** spaces, e.g.:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.managerschedulebuilder.pro",
      "sha256_cert_fingerprints": [
        "AB:CD:EF:..."
      ]
    }
  }
]
```

If you use **Play App Signing**, also add the **App signing key certificate** SHA-256 from Play Console → Setup → App integrity (in addition to the upload key).

Commit + push, then verify:

```
https://bryanralston.github.io/schedule-builder/.well-known/assetlinks.json
```

Google’s tester:

```
https://developers.google.com/digital-asset-links/tools/generator
```

---

## 4. Build the Android App Bundle

```powershell
cd C:\Users\bryma\projects\schedule-pro-twa
bubblewrap build
```

Output is typically an `.aab` (App Bundle) for Play Console upload.

Update version for later releases:

```powershell
bubblewrap update
# or edit twa-manifest.json versionCode / versionName
```

---

## 5. Play Console listing

Use copy from:

```
store/listing.html
```

(once live: `https://bryanralston.github.io/schedule-builder/store/listing.html`)

Assets already in repo:

- Feature graphic: `store/feature-graphic-1024x500.png`
- Phone screenshots: `store/screenshots/*.png`
- High-res icon: use `icons/icon-512.png` / maskable 512

Checklist:

1. Create app with package `com.managerschedulebuilder.pro` (must match Bubblewrap)
2. Default language, free or paid as you choose
3. Store listing: title, short + full description from listing pack
4. Privacy policy URL → hosted `legal/privacy.html`
5. App category: Business / Productivity
6. Content rating questionnaire
7. Target audience, news app, data safety (local-only storage — declare accordingly)
8. Upload signed `.aab`
9. Confirm Digital Asset Links so the TWA opens full-screen without Chrome custom-tab bar
10. Submit for review

---

## 6. Optional: Capacitor path

`capacitor.config.json` is present with the same package id for a fuller native shell if you abandon TWA later. Prefer Bubblewrap TWA for “wrap the live PWA” simplicity.

---

## Quick command cheat sheet

```powershell
# After JDK installed
npm install -g @bubblewrap/cli

# Init + build
mkdir C:\Users\bryma\projects\schedule-pro-twa
cd C:\Users\bryma\projects\schedule-pro-twa
bubblewrap init --manifest https://bryanralston.github.io/schedule-builder/manifest.webmanifest
bubblewrap build

# Fingerprint for assetlinks
keytool -list -v -keystore schedule-pro-upload.keystore -alias schedule-pro
```

---

## What Bryan still needs to do

1. Confirm GitHub Pages is live at the URL above (or enable Pages if push succeeded without `gh`).
2. Install **JDK 17+**, then Bubblewrap.
3. Run `bubblewrap init` / `build`, create keystore, fill real SHA-256 into `.well-known/assetlinks.json`, redeploy.
4. Create/pay Google Play developer account if not already.
5. Submit listing + AAB using `store/listing.html` copy.

No app logic rewrite required for any of the above.
