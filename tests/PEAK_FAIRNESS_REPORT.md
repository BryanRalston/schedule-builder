# Peak / Coverage / Fairness Report

**Version:** 2.6.0
**Generated:** 2026-08-13T17:21:45.130Z

## Summary

- PASS: 76
- WARN: 2
- FAIL: 0
- Total assertions: 78

## Scenarios

| Scenario | Peak | noOpen | noClose | WE spread | Close spread | Early % | Ext % | Early spread | Ext spread |
|---|---|---|---|---|---|---|---|---|---|
| clean-peak-off | OFF | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| clean-fairness | OFF | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| p08-like | OFF | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| clean-peak-on | ON | 0 | 0 | 1 | 0 | 100 | 100 | 2 | 0 |
| peak-on-light-rto | ON | 0 | 0 | 1 | 1 | 100 | 100 | 1 | 1 |
| peak-off-locked-inputs | OFF | 0 | 0 | 1 | 0 | 2.9 | 3.4 | 1 | 1 |
| peak-stress-0 | ON | 0 | 0 | 2 | 1 | 100 | 100 | 1 | 1 |
| peak-stress-1 | ON | 0 | 0 | 1 | 0 | 100 | 100 | 0 | 0 |
| peak-stress-2 | ON | 0 | 0 | 2 | 1 | 100 | 100 | 0 | 1 |
| peak-stress-3 | ON | 0 | 0 | 0 | 1 | 100 | 100 | 1 | 1 |
| peak-stress-4 | ON | 0 | 0 | 0 | 0 | 100 | 100 | 1 | 0 |
| peak-stress-5 | ON | 0 | 0 | 2 | 0 | 100 | 100 | 0 | 0 |
| peak-stress-6 | ON | 0 | 0 | 3 | 1 | 100 | 100 | 2 | 1 |
| peak-stress-7 | ON | 0 | 0 | 3 | 1 | 100 | 100 | 2 | 1 |
| peak-stress-8 | ON | 0 | 0 | 2 | 1 | 100 | 100 | 0 | 1 |
| peak-stress-9 | ON | 0 | 0 | 4 | 4 | 100 | 100 | 1 | 4 |
| peak-stress-10 | ON | 0 | 0 | 2 | 1 | 100 | 100 | 2 | 1 |
| peak-stress-11 | ON | 0 | 0 | 1 | 1 | 100 | 100 | 4 | 1 |

## Failures

_None_

## Warnings

- **peak-stress-9-fairness-soft**: close=4 we=4 early=1 ext=4
- **peak-stress-11-fairness-soft**: close=1 we=1 early=4 ext=1

## Notes

- Peak OFF: auto schedule must not use open-early or close-ext (manual Requests may still force them).
- Peak ON: every staffed day gets ≥1 open-early; every manager-close night uses close-ext.
- Stress sims: hard coverage required; fairness soft under extreme time-off.
