# Staging Full Test Report

Generated: 2026-08-13T13:49:54.716Z
Base: `http://127.0.0.1:60096` (local-staging-static)
Staging path: `C:\Users\bryma\schedule-builder\staging`

## Summary

| Result | Count |
|--------|------:|
| PASS   | 91 |
| FAIL   | 0 |
| SKIP   | 0 |
| Total  | 91 |

## By section

- **P08 unit**: 1 pass, 0 fail, 0 skip
- **0. Isolation / staging identity**: 7 pass, 0 fail, 0 skip
- **1. Engine (in-page generate)**: 8 pass, 0 fail, 0 skip
- **2. Boot & navigation UI**: 12 pass, 0 fail, 0 skip
- **3. Setup tab**: 9 pass, 0 fail, 0 skip
- **4. Requests tab**: 3 pass, 0 fail, 0 skip
- **5. Rules / Preferences**: 10 pass, 0 fail, 0 skip
- **6. Schedule generate UI**: 10 pass, 0 fail, 0 skip
- **7. Exports**: 4 pass, 0 fail, 0 skip
- **8. Auth full path (staging keys)**: 11 pass, 0 fail, 0 skip
- **9. Monetization / Free limits**: 3 pass, 0 fail, 0 skip
- **10. Secondary pages**: 4 pass, 0 fail, 0 skip
- **11. Mobile viewport**: 2 pass, 0 fail, 0 skip
- **12. Regression: prod isolation**: 4 pass, 0 fail, 0 skip
- **13. Live staging URL smoke**: 3 pass, 0 fail, 0 skip

## Failures

None.

## P08 unit test

```
=== Effective weekend targets ===
Bryan target 2 weOffs 6
Brian target 2 weOffs 2
Thuy target 2 weOffs 2
Norma target 2 weOffs 4

=== Weekend staffing ===
2026-08-30 n=2 o=1 c=1 Bryan=open-early | Brian=off | Thuy=off | Norma=close
2026-09-05 n=2 o=1 c=1 Bryan=open-early | Brian=off | Thuy=close | Norma=rto
2026-09-06 n=2 o=1 c=1 Bryan=open-early | Brian=close | Thuy=off | Norma=rto
2026-09-12 n=3 o=1 c=1 Bryan=open-early | Brian=close | Thuy=mid-early | Norma=rto
2026-09-13 n=2 o=1 c=1 Bryan=loa | Brian=open-early | Thuy=close | Norma=rto
2026-09-19 n=3 o=1 c=1 Bryan=loa | Brian=open-early | Thuy=close | Norma=mid-early
2026-09-20 n=3 o=1 c=1 Bryan=loa | Brian=open-early | Thuy=close | Norma=mid-early
2026-09-26 n=3 o=1 c=1 Bryan=loa | Brian=open-early | Thuy=close | Norma=mid-early
2026-09-27 n=3 o=1 c=1 Bryan=loa | Brian=open-early | Thuy=close | Norma=mid-early
2026-10-03 n=3 o=1 c=1 Bryan=loa | Brian=open-early | Thuy=close | Norma=mid-early

=== RESULT ===
coverage failures: NONE
thin days: NONE
PASS — all days have opener+closer; no thin soft-off days
```

**PASS**

## Live staging

PASS live-staging-reachable: HTTP 200; PASS live-staging-banner: ; PASS live-staging-no-auth-lock: 

## Screenshots

Failure screenshots (if any): `C:\Users\bryma\schedule-builder\scripts\browser-ops\out\staging-test`
- `C:\Users\bryma\schedule-builder\scripts\browser-ops\out\staging-test\001_FAIL_rules-prefs.png`

## Notes

- Production `index.html` was not modified or served by this suite.
- App data keys must use `msb_stg_*` only.
