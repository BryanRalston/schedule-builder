# Schedule Pro Engine Stress Test Report

Generated: 2026-08-13T16:03:10.746Z
Engine version: **2.5.7**
Base: `http://127.0.0.1:53601` (local repo-root static server)

## Summary

| Result | Count |
|--------|------:|
| PASS   | 24 |
| WARN   | 1 |
| FAIL   | 0 |
| Total  | 25 |

Exit code is **1 only on FAIL** (hard coverage / throw / manager close on KC night). WARNs do not fail.

## Hard criteria

- noOpen === 0 every day
- noClose === 0 every day (manager open/close + non-mgr kc-close)
- generator does not throw
- mgrCloseOnKcNight === 0 when kcCloseDays set and non-mgr KCs exist

## Soft criteria

- AM close period max-min <= 2 when >=2 AMs available most days (strictFairness scenarios assert)
- AM weekend off max-min <= 2 under non-extreme weekend targets (strictFairness)
- Clopens: 0 when avoidClopening and not allowClopens (strictFairness WARN)

## Scenarios

| Scenario | Status | noOpen | noClose | clopens | thin | closeSpread | weSpread | ms |
|----------|--------|-------:|--------:|--------:|-----:|------------:|---------:|---:|
| clean-3am | PASS | 0 | 0 | 0 | 0 | 0 | 1 | 27 |
| p08-posted-shape | PASS | 0 | 0 | 0 | 0 | 1 | 0 | 10 |
| sole-manager | WARN | 0 | 35 | 0 | 35 | 0 | 0 | 11 |
| sm-plus-one-am | PASS | 0 | 0 | 1 | 0 | 0 | 0 | 10 |
| five-ams | PASS | 0 | 0 | 0 | 0 | 0 | 0 | 10 |
| no-kcs | PASS | 0 | 0 | 0 | 0 | 1 | 1 | 10 |
| kc-close-all-week | PASS | 0 | 0 | 0 | 0 | 0 | 0 | 15 |
| kc-close-none | PASS | 0 | 0 | 0 | 0 | 1 | 1 | 10 |
| dual-loa | PASS | 0 | 0 | 0 | 0 | 9 | 5 | 11 |
| triple-pto-same-week | PASS | 0 | 0 | 0 | 0 | 1 | 1 | 10 |
| all-want-weekends-4 | PASS | 0 | 0 | 0 | 0 | 0 | 1 | 7 |
| zero-weekend-target | PASS | 0 | 0 | 0 | 0 | 0 | 1 | 7 |
| rto-every-weekend-all-ams | PASS | 0 | 0 | 0 | 0 | 1 | 0 | 10 |
| pto-checkerboard-am1 | PASS | 0 | 0 | 0 | 0 | 8 | 5 | 10 |
| manager-mode-kc | PASS | 0 | 0 | 0 | 0 | 1 | 0 | 10 |
| kc-mid-all-dows-both | PASS | 0 | 0 | 0 | 0 | 0 | 1 | 8 |
| avoid-clopen-off | PASS | 0 | 0 | 19 | 0 | 1 | 1 | 8 |
| packages-off-sm-equal | PASS | 0 | 0 | 0 | 0 | 0 | 1 | 8 |
| sm-closes-3-per-week | PASS | 0 | 0 | 0 | 0 | 1 | 0 | 8 |
| am-closes-fixed-2 | PASS | 0 | 0 | 0 | 0 | 1 | 0 | 8 |
| four-week-period | PASS | 0 | 0 | 0 | 0 | 1 | 1 | 6 |
| six-week-period | PASS | 0 | 0 | 0 | 0 | 1 | 0 | 9 |
| stability-10x | PASS | 0 | 0 | 0 | 0 | 1 | 0 | 8 |
| max-stacked-hell | PASS | 0 | 0 | 1 | 0 | 2 | 6 | 12 |
| only-two-working-many-days | PASS | 0 | 0 | 2 | 0 | 5 | 5 | 13 |

## Failures

None.

## Warnings

- **sole-manager**: noClose=35 (impossible dual coverage: sole manager, no KC)

## Worst scenarios (info)

### Highest clopens

- avoid-clopen-off: clopens=19 (PASS)
- only-two-working-many-days: clopens=2 (PASS)
- sm-plus-one-am: clopens=1 (PASS)
- max-stacked-hell: clopens=1 (PASS)
- clean-3am: clopens=0 (PASS)

### Worst AM close spread

- dual-loa: spread=9 {"am1":2,"am2":11,"am3":10} (PASS)
- pto-checkerboard-am1: spread=8 {"am1":2,"am2":9,"am3":10} (PASS)
- only-two-working-many-days: spread=5 {"am1":5,"am2":5,"am3":0} (PASS)
- max-stacked-hell: spread=2 {"am1":7,"am2":6,"am3":8} (PASS)
- p08-posted-shape: spread=1 {"am1":8,"am2":9,"am3":8} (PASS)

## Engine fixes from this run

v2.5.4 ensureHardDailyCoverage: sole closer → open when emergency non-mgr KC can take kc-close (or prefer open if truly sole).
v2.5.4 Emergency kc-close on understaffed non-template nights (not only configured kcCloseDays).
v2.5.4 repairViolations coverage-open/close: same sole-closer + emergency KC logic; never steal sole opener for close.
sole-manager (amCount 0, no KC): dual open+close is mathematically impossible; residual noClose documented as WARN via impossibleDualCoverage.

## How to re-run

```bash
node tests/test-stress-engine.mjs
```
