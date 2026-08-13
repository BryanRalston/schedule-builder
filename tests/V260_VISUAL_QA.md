# Visual QA — v2.6.1 polish pass

Screenshots: `scripts/browser-ops/out/v260-visual/`

## Fixes in 2.6.1 (this pass)

| Issue | Fix |
|--------|-----|
| Header chip traffic jam | Chips grouped in `.brand-status`; Free badge hidden when account chip already shows Free; Offline/Saved shorten on narrow screens; App badge removed |
| Post-gen strip under-signals | Stronger sticky bar, **Review** label, primary CTA **Review issues** / **Looks good · Fairness** |
| Toolbar landfill | Density is one **segmented control**; Print/Word/Excel/Copy/Backup under **Export ▾** |
| Mobile long analytics scroll | **Posting & quality analytics** toggle; summary starts **collapsed** under 720px |
| Day-hours vs federal labels | Single stacked header cell: day · date · hours · holiday (no dual-row collision) |

## Harsh re-check

**Premium now**
- Setup: clean; federal holidays card still fits
- Schedule toolbar: View | Density | Undo/Redo | Export — readable, not a button dump
- Day headers: stacked mono hours under date
- Command palette still the best surface

**Still imperfect (not blocking)**
- Mobile can still feel dense above the fold (Build + checklist); analytics collapse helps below the grid
- Sticky review bar competes with sticky header on short phones — acceptable
- Suggestions/diff panels secondary (by design)

## Verdict

**Ship 2.6.1** as the visual cleanup of 2.6.0. Chrome density is under control; review path is clearer after Build.
