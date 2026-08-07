# Play Console — do this now (10 minutes of clicks)

You **cannot** finish Play from the CLI. Everything below is Bryan-only in the browser.

**Package name (exact):** `com.managerschedulebuilder.pro`  
**Upload file (exact):**  
`C:\Users\bryma\schedule-builder\android-twa\app-release-bundle.aab`

Also open offline helper: `store/play-upload.html`

---

## 1. Create / open the app
1. https://play.google.com/console  
2. **Create app** (or open existing)  
3. App name: **Schedule Pro: Manager Shifts** (or Manager Schedule Builder Pro)  
4. Default language: English (US)  
5. App or game: **App** · Free or paid: your choice  
6. Declarations: accept and create  

> Package name is set by the AAB: **`com.managerschedulebuilder.pro`**. You cannot change it later.

---

## 2. Internal testing first (fastest path)
1. **Testing → Internal testing → Create new release**  
2. Upload: `app-release-bundle.aab` from path above  
3. Release name: `2.1.0 (210)`  
4. Save → Review → **Start rollout to Internal testing**  
5. Add your Gmail as a tester → open the opt-in link on your phone  

Production can wait until listing + data safety are green.

---

## 3. Store listing (copy-paste)
Open live pack: https://bryanralston.github.io/schedule-builder/store/listing.html  

| Field | Value |
|--------|--------|
| App name | `Schedule Pro: Manager Shifts` |
| Short description | `Fair retail schedules in minutes. NRF calendar, no clopens, offline.` |
| Full description | Copy from listing pack |
| Privacy policy | `https://bryanralston.github.io/schedule-builder/legal/privacy.html` |
| App icon | `icons/icon-512.png` |
| Feature graphic | `store/feature-graphic-1024x500.png` |
| Screenshots | `store/screenshots/*.png` |
| Category | Business |

Support email: set in Play Console (leave blank in repo).

---

## 4. Data safety (cheat sheet)
This app stores schedules **only on device** (browser/localStorage). No account server.

| Question | Answer |
|----------|--------|
| Does your app collect or share user data? | **No** (if you only ship the offline PWA/TWA as built) |
| Data encrypted in transit? | Yes (HTTPS) when online |
| Users can request deletion? | Yes — clear site data / uninstall (data is local) |
| Account creation required? | **No** |
| Independent security review? | No |

If Play’s form forces “data collected,” declare only **App activity / App info** as **not collected**, or minimal **App interactions** stored **on device only**, **not shared**. Prefer **No data collected** when the form allows it for fully local apps.

---

## 5. Content rating
- Questionnaire: **Business / utility** tool  
- No UGC feed, no ads, no violence, no gambling  
- Not targeted at children  
- No account required  

---

## 6. After AAB upload — App Signing SHA-256
1. Play Console → your app → **Setup → App integrity** (or **App signing**)  
2. Copy **App signing key certificate** SHA-256  
3. Paste that fingerprint back to Cortex (or into `.well-known/assetlinks.json` as a **second** entry next to the upload key)  
4. Redeploy so Digital Asset Links stay valid for full-screen TWA  

Upload cert is already live in assetlinks. **Play’s app-signing cert is still needed after first upload.**

---

## 7. Production
When internal test looks good:  
**Production → Create release** → same AAB (or newer) → countries → submit for review.

---

## Do not
- Force-push git  
- Commit the AAB or keystore  
- Change package name  
