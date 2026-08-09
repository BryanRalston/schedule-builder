# Schedule Pro — polish roadmap

**Shipped in 2.1.2 (this pass)**
- Price consistency: UI defaults **$19.99** (was stale $29 in app shell)
- Generate: loading state, no double-click, toast if period not loaded
- Mobile: horizontal scroll + swipe hint on schedule grid
- Safe-area insets on header (notched phones)
- Escape closes Pro gate / header menu
- Service worker cache bump `msb-pro-v2.1.2`

---

## Recommended next (priority)

### P0 — Trust & store readiness
| Item | Why |
|------|-----|
| Bump Play AAB after web polish (2.1.2 → 211) | Closed testers get same UX as web |
| Confirm Gumroad unlock codes still redeem in-app | Revenue path |
| First-run checklist on Schedule tab (period loaded? managers named?) | Fewer empty generates |

### P1 — Manager-facing polish
| Item | Why |
|------|-----|
| **Undo last cell edit** | Managers experiment on grid constantly |
| **Named presets** (e.g. “Holiday week rules”) | Power users reuse setups |
| **Week-at-a-glance print density** toggle | Compact vs readable printouts |
| **Conflict callouts** in plain English** under quality score | “Why is this 72?” |
| **Dark mode** optional | Night office / Play feel |

### P2 — Differentiation
| Item | Why |
|------|-----|
| Import last period’s names + prefs | Returning stores |
| SMS/share week image (canvas snapshot) | Managers text the team |
| Multi-store switcher (Pro) | District managers |
| Labor hours vs budget target bar | Retail ops language |

### P3 — Tech health
| Item | Why |
|------|-----|
| Split `index.html` engine into modules (later) | Maintainability — not urgent |
| Offline unit tests for constraint rules | Prevent regressions |
| Accessibility pass (focus order, contrast) | Store devices + ADA |

---

## Don’t do yet
- Full rewrite / React migration  
- Backend accounts (offline is the product)  
- Feature bloat before 12×14 + first sales  

---

## Tester feedback loop
While closed testing runs, collect:
1. Generate time feel  
2. Mobile schedule readability  
3. Export (Word/Excel) usefulness  
4. Anything confusing in Setup → Schedule path  
