# Manager Schedule Builder Pro — Handoff to Grok Build CLI

## What this is
Offline-first PWA for retail store managers (NRF 4-5-4 schedules, preferences, role rules, quality score, Word/Excel export).

Package id (Play): `com.managerschedulebuilder.pro`
Version: 2.1.0

## Layout
- `index.html` — full app (tabs: Setup / Requests / Rules / Schedule)
- `sw.js`, `manifest.webmanifest`, `icons/` — PWA
- `install.html` — publish & Play setup guide
- `legal/privacy.html`, `legal/terms.html` — store policy pages
- `store/listing.html` — Play listing copy
- `store/feature-graphic-1024x500.png` + `store/screenshots/`
- `.well-known/assetlinks.json` — TWA placeholder (needs real SHA-256)
- `capacitor.config.json` — optional Capacitor path

## Goal for CLI session
Help Bryan finish **HTTPS deploy + Google Play TWA packaging** on his machine:
1. Deploy this folder to HTTPS (GitHub Pages preferred if repo is BryanRalston/schedule-builder, else Vercel/Cloudflare)
2. Verify PWA install works on the live URL
3. Run Bubblewrap TWA against the live manifest
4. Wire assetlinks.json with signing cert SHA-256
5. Prepare Play Console listing using store/listing.html copy

## Do not
- Don't rewrite the scheduler engine unless asked
- Don't add a backend / accounts unless asked
- Keep offline-first localStorage model

## Local serve
```bash
# from this folder
python3 -m http.server 8080
# or: npx serve -l 8080 .
```

## User
Bryan Ralston — wants to sell to store managers; Play path is secondary to web install + Lemon Squeezy/Gumroad.
