# Schedule Pro Time-Off Monte Carlo Stress Report

Generated: 2026-08-13T14:29:17.536Z
Engine version: **2.5.5**
Seed: `20260813`
Base: `http://127.0.0.1:53730`

## Summary

| Result | Count |
|--------|------:|
| PASS   | 106 |
| WARN   | 21 |
| FAIL   | 0 |
| Total  | 127 |
| Perfect open+close coverage | 127 (100%) |

Exit code is **1 only on hard FAIL**. Soft WARNs do not fail the suite.

## Categories

| Category | PASS | WARN | FAIL | Total |
|----------|-----:|-----:|-----:|------:|
| rto-weekend | 16 | 4 | 0 | 20 |
| rto-single | 15 | 0 | 0 | 15 |
| pto-blocks | 20 | 0 | 0 | 20 |
| loa-long | 13 | 2 | 0 | 15 |
| mixed-hell | 16 | 9 | 0 | 25 |
| team-size | 8 | 2 | 0 | 10 |
| kc-prefs | 9 | 1 | 0 | 10 |
| deterministic | 9 | 3 | 0 | 12 |

## Clopen histogram

- 0 clopens: **116**
- 1–2 clopens: **11**
- 3+ clopens: **0**

## Failures (hard)

None.

## Soft warnings (sample / all)

Total WARNs: **21**

- **rto-we-002** (rto-we-002-one-am-w4): AM weekend-off spread=6 {"am1":8,"am2":2,"am3":5} active=["am1","am2","am3"]
- **rto-we-003** (rto-we-003-one-am-w4): AM weekend-off spread=6 {"am1":8,"am2":2,"am3":5} active=["am1","am2","am3"]
- **rto-we-004** (rto-we-004-one-am-w4): AM weekend-off spread=6 {"am1":8,"am2":2,"am3":5} active=["am1","am2","am3"]
- **rto-we-012** (rto-we-012-two-ams-same-w4): AM weekend-off spread=4 {"am1":8,"am2":8,"am3":4} active=["am1","am2","am3"]
- **loa-058** (loa-058-long): clopens=1
- **loa-060** (loa-060-long): clopens=1
- **mix-076** (mix-076-hell): clopens=1; AM weekend-off spread=4 {"am1":5,"am2":7,"am3":3} active=["am1","am2","am3"]
- **mix-081** (mix-081-hell): clopens=1; AM close spread=5 {"am1":13,"am2":8,"am3":2} active=["am1","am2"]
- **mix-082** (mix-082-hell): clopens=1; AM weekend-off spread=5 {"am1":3,"am2":8,"am3":6} active=["am1","am2","am3"]
- **mix-083** (mix-083-hell): AM weekend-off spread=5 {"am1":3,"am2":5,"am3":8} active=["am1","am2","am3"]
- **mix-084** (mix-084-hell): AM weekend-off spread=5 {"am1":8,"am2":3,"am3":6} active=["am1","am2","am3"]
- **mix-085** (mix-085-hell): AM weekend-off spread=5 {"am1":3,"am2":5,"am3":8} active=["am1","am2","am3"]
- **mix-086** (mix-086-hell): AM weekend-off spread=5 {"am1":8,"am2":3,"am3":6} active=["am1","am2","am3"]
- **mix-089** (mix-089-hell): clopens=1
- **mix-095** (mix-095-hell): AM close spread=5 {"am1":5,"am2":9,"am3":10} active=["am1","am2","am3"]
- **team-096** (team-096-amCount-1): clopens=2
- **team-097** (team-097-amCount-1): clopens=2
- **pref-115** (pref-115-kc[0,6]-we3): clopens=1
- **det-sm-loa-entire** (sm-loa-entire-period): clopens=1
- **det-am1-loa-am2-rto-we** (am1-loa-entire+am2-rto-all-we): AM weekend-off spread=5 {"am1":10,"am2":8,"am3":3} active=["am2","am3"]
- **det-max-chaos** (max-chaos): clopens=1; AM weekend-off spread=4 {"am1":5,"am2":8,"am3":4} active=["am2","am3"]

## Top 10 worst by clopens

1. team-096 (team-096-amCount-1): clopens=2 [WARN]
2. team-097 (team-097-amCount-1): clopens=2 [WARN]
3. loa-058 (loa-058-long): clopens=1 [WARN]
4. loa-060 (loa-060-long): clopens=1 [WARN]
5. mix-076 (mix-076-hell): clopens=1 [WARN]
6. mix-081 (mix-081-hell): clopens=1 [WARN]
7. mix-082 (mix-082-hell): clopens=1 [WARN]
8. mix-089 (mix-089-hell): clopens=1 [WARN]
9. pref-115 (pref-115-kc[0,6]-we3): clopens=1 [WARN]
10. det-sm-loa-entire (sm-loa-entire-period): clopens=1 [WARN]

## Top 10 worst by AM close spread

1. mix-081 (mix-081-hell): spread=5 {"am1":13,"am2":8,"am3":2} [WARN]
2. mix-095 (mix-095-hell): spread=5 {"am1":5,"am2":9,"am3":10} [WARN]
3. team-104 (team-104-amCount-2): spread=3 {"am1":9,"am2":12} [PASS]
4. pto-044 (pto-044-block): spread=2 {"am1":6,"am2":7,"am3":8} [PASS]
5. loa-066 (loa-066-long): spread=2 {"am1":10,"am2":8,"am3":4} [PASS]
6. loa-069 (loa-069-long): spread=2 {"am1":2,"am2":9,"am3":11} [PASS]
7. mix-084 (mix-084-hell): spread=2 {"am1":8,"am2":7,"am3":9} [WARN]
8. mix-093 (mix-093-hell): spread=2 {"am1":8,"am2":6,"am3":6} [PASS]
9. mix-094 (mix-094-hell): spread=2 {"am1":8,"am2":9,"am3":10} [PASS]
10. rto-we-001 (rto-we-001-one-am-w2): spread=1 {"am1":9,"am2":8,"am3":8} [PASS]

## Top 10 worst by weekend-off spread

1. rto-we-002 (rto-we-002-one-am-w4): spread=6 {"am1":8,"am2":2,"am3":5} [WARN]
2. rto-we-003 (rto-we-003-one-am-w4): spread=6 {"am1":8,"am2":2,"am3":5} [WARN]
3. rto-we-004 (rto-we-004-one-am-w4): spread=6 {"am1":8,"am2":2,"am3":5} [WARN]
4. mix-082 (mix-082-hell): spread=5 {"am1":3,"am2":8,"am3":6} [WARN]
5. mix-083 (mix-083-hell): spread=5 {"am1":3,"am2":5,"am3":8} [WARN]
6. mix-084 (mix-084-hell): spread=5 {"am1":8,"am2":3,"am3":6} [WARN]
7. mix-085 (mix-085-hell): spread=5 {"am1":3,"am2":5,"am3":8} [WARN]
8. mix-086 (mix-086-hell): spread=5 {"am1":8,"am2":3,"am3":6} [WARN]
9. det-am1-loa-am2-rto-we (am1-loa-entire+am2-rto-all-we): spread=5 {"am1":10,"am2":8,"am3":3} [WARN]
10. rto-we-012 (rto-we-012-two-ams-same-w4): spread=4 {"am1":8,"am2":8,"am3":4} [WARN]

## Hard criteria

- noOpen === 0 every day
- noClose === 0 every day (manager open/close + non-mgr kc-close)
- generator does not throw
- mgrCloseOnKc === 0 when kcCloseDays set and non-mgr KCs exist

## Soft criteria

- clopens > 0 when avoidClopening → WARN
- AM close spread > 3 among AMs who worked ≥50% of period → WARN
- AM weekend-off spread > 3 among same → WARN

## How to re-run

```bash
node tests/test-stress-timeoff-sims.mjs
```
