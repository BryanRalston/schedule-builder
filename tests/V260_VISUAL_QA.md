# v2.6.0 Visual QA (harsh)

Screenshots: `scripts/browser-ops/out/v260-visual/`

## What looks premium

- **Command palette** is the strongest new surface: centered modal, cyan focus ring, group labels (NAV / SCHEDULE / FILE), active row, Esc chip. Feels like Linear / Raycast.
- **Setup desktop** is still the product’s best frame: clean two-column team/store layout, consistent pills, federal holidays card integrates without fighting the chrome.
- **Schedule grid colors** remain the brand: neon open/mid/close on dark ops console. Coverage row is readable.
- **High-contrast mode** (shot 06) is postable: solid fills, black outlines — actually useful for wall TVs.
- **Density board** enlarges type enough for tablet wall view without breaking the table structure.

## What looks unfinished

1. **Header chip traffic jam** — Offline + Saved · local + FREE + account avatar compete for one row. On desktop it still works; on ~1100px it will wrap awkwardly. Not ship-blocking, but not “flagship” either.
2. **Post-gen strip under-signals** — When present, chips are small and easy to miss under the sticky header. Sticky `top: 58px` helps; still not a “review bar” you can’t ignore. Should eventually steal more vertical rhythm after Build.
3. **Schedule toolbar overcrowding** — Week/Month/Day + Print/Word/Excel/Copy/Backup + Undo/Redo + Compact/Comfort/Board is a button landfill. Density belongs in a single segmented control or More menu only.
4. **Ops-home card** collapses correctly after gen, but empty-state hierarchy (ops-home + ready checklist + Build) is still three layers saying the same thing.
5. **Mobile (390)** — Full-page schedule is a long scroll of panels (fairness, clopen, posting check, quality ring, labor hours…). The week table is usable; the post-gen strip + toolbar don’t reflow into a true mobile “review first” stack.
6. **Day-hours in headers** work technically but at compact density they can collide with federal holiday labels on the same th.
7. **Diff + smart suggestions** panels are functional but visually secondary — muted boxes without the polish of fairness card.

## Fixes applied after first pass

- Sticky post-gen strip offset under header (`top: 58px`, higher z-index).
- Slightly tighter local status pill so header breathes.

## Residual (not blocking 2.6.0)

- Segmented density control instead of three toolbar buttons.
- Collapse labor / weekly breakdown behind “More analytics” on mobile.
- Stronger strip: full-width bar with one primary CTA (“Review issues”).

## Verdict

**Shipable as a flagship UX release.** Palette, density, lock view, undo stack, and request paint are real product upgrades. The weak spots are density of chrome (header/toolbar) and mobile post-gen hierarchy — polish, not missing features.
