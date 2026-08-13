# Staging build (generated)

**Do not edit files in this folder by hand.**
Regenerate from the production app sources:

```powershell
powershell -File scripts/publish-staging.ps1
```

## URLs
- **Staging (safe sandbox):** https://bryanralston.github.io/schedule-builder/staging/
- **Production (closed testers):** https://bryanralston.github.io/schedule-builder/

## Isolation
- localStorage keys use `msb_stg_*` (production uses `msb_*`)
- Service worker cache: `msb-pro-staging-v2.5.9`
- Separate PWA identity / branding: Schedule Pro (Staging)
- `noindex,nofollow` - not for public discovery

## Local serve
```powershell
powershell -File scripts/serve-staging.ps1
```
Then open http://localhost:5174/

Generated from app version **2.5.9** on 2026-08-13 13:16:48.