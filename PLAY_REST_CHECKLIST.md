# Play Console — rest of setup (app already created)

**Developer:** Cortex Developments · `5551273558633431482`  
**Package (from AAB):** `com.managerschedulebuilder.pro`  
**Type:** Paid app  

## Upload file
```
C:\Users\bryma\schedule-builder\android-twa\app-release-bundle.aab
```
(Path is on clipboard if you just ran setup.)

## 1) Internal testing release (do this first)
1. Open your app on the app list  
2. Left nav: **Test and release** → **Testing** → **Internal testing**  
3. **Create new release**  
4. If asked about **Play App Signing** → Continue / use Google’s default signing  
5. **Upload** the `.aab` above  
6. Release name: `2.1.0 (210)`  
7. Release notes (optional): `Initial Play release — Manager Schedule Builder Pro.`  
8. **Next** → **Save** → **Start rollout to Internal testing**  
9. Add your Gmail as a tester under **Testers** tab  

## 2) Privacy policy (required for production)
1. **Policy** → **App content** → **Privacy policy**  
2. URL:
```
https://bryanralston.github.io/schedule-builder/legal/privacy.html
```
3. **Save**

## 3) Main store listing
1. **Grow** → **Store presence** → **Main store listing** (or **Store settings**)  
2. Copy fields from: https://bryanralston.github.io/schedule-builder/store/listing.html  

| Field | Value |
|--------|--------|
| App name | Schedule Pro: Manager Shifts |
| Short description | Fair retail schedules in minutes. NRF calendar, no clopens, offline. |
| Full description | From listing pack page |
| App icon | `icons\icon-512.png` |
| Feature graphic | `store\feature-graphic-1024x500.png` |
| Phone screenshots | `store\screenshots\` (at least 2) |
| Category | Business |

## 4) Paid app price
1. **Monetize** / **Paid app** / **Pricing** (wording varies)  
2. Set a price (e.g. **$19.99** to match Gumroad)  
3. Countries: start with US or all available  

## 5) Data safety
1. **Policy** → **App content** → **Data safety**  
2. Prefer: **No data collected** / data only on device, not shared  
3. No account required  

## 6) Content rating
1. **App content** → **Content rating**  
2. Questionnaire: business utility, no ads, no UGC, not for kids  

## 7) After first AAB upload — asset links
1. **Setup** → **App integrity** / **App signing**  
2. Copy **App signing key certificate** SHA-256  
3. Send to Cortex to add to live `assetlinks.json`  

## Done when
- Internal release shows the uploaded bundle  
- Privacy URL saved  
- Listing has icon + screenshots + text  
- Price set (paid app)  
- Data safety + content rating started  

Gumroad remains live: https://ralstonia5.gumroad.com/l/pwplbc?wanted=true  
