# Staging (safe sandbox)

- URL: https://bryanralston.github.io/schedule-builder/staging/
- Refresh: `powershell -File scripts/publish-staging.ps1`
- Local: `powershell -File scripts/serve-staging.ps1` → http://localhost:5174/
- Testers stay on: https://bryanralston.github.io/schedule-builder/
- Staging uses `msb_stg_*` localStorage + separate SW cache — will not wipe tester data

The `staging/` folder is generated. After code changes, re-run publish and commit/push `staging/` so GitHub Pages updates.
