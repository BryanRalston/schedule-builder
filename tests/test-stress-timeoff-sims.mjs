/**
 * Monte Carlo / combinatorial RTO·PTO·LOA time-off stress suite.
 * Playwright + local static server of repo root; all sims run inside page.evaluate.
 *
 * Hard FAIL: noOpen/noClose > 0, generator throw, manager close on KC-close nights.
 * Soft WARN: clopens under avoidClopening; AM close/we spread > 3 among AMs who worked ≥50%.
 *
 * Run: node tests/test-stress-timeoff-sims.mjs
 */
import { chromium } from '../scripts/browser-ops/node_modules/playwright/index.mjs';
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SEED = 20260813;
const PERIOD_START = { y: 2026, m: 8, d: 30 };
const DEFAULT_DAYS = 35;

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p === '/') p = '/index.html';
      const file = join(ROOT, p.replace(/^\//, ''));
      if (!file.startsWith(ROOT) || !existsSync(file)) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      const ext = extname(file);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

/** Mulberry32 seeded PRNG — reproducible across runs. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function dateKeyFromDate(dt) {
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

function buildPeriodMeta(days = DEFAULT_DAYS) {
  const dates = [];
  const keys = [];
  for (let i = 0; i < days; i++) {
    const dt = new Date(PERIOD_START.y, PERIOD_START.m - 1, PERIOD_START.d + i);
    dates.push(dt);
    keys.push(dateKeyFromDate(dt));
  }
  // Weekend pairs: Sat index then Sun index for each full weekend in range
  const weekendPairs = [];
  for (let i = 0; i < days - 1; i++) {
    if (dates[i].getDay() === 6 && dates[i + 1].getDay() === 0) {
      weekendPairs.push([i, i + 1]);
    }
  }
  return { dates, keys, weekendPairs, days };
}

const BASE_KC = [
  { id: 'kc1', name: 'Farnaz', asManager: false, midDows: [0, 2, 4, 5] },
  { id: 'kc2', name: 'Faiqa', asManager: false, midDows: [3, 6] },
];

const BASE_PREFS = {
  avoidClopening: true,
  fairDistribution: true,
  targetWeekendDaysOff: 2,
  preferWeekendPackages: true,
  smFewerWeekendOffs: true,
  kcCloseDays: [1],
  kcMidWhenNoMid: true,
};

function emptyInputs(amCount, kcList) {
  const ins = { sm: {} };
  for (let i = 1; i <= Math.max(amCount, 5); i++) ins['am' + i] = {};
  (kcList || []).forEach((kc) => {
    ins[kc.id] = {};
  });
  return ins;
}

function clonePrefs(extra = {}) {
  return Object.assign({}, BASE_PREFS, extra);
}

function cloneKc(list = BASE_KC) {
  return list.map((k) => Object.assign({}, k, { midDows: (k.midDows || []).slice() }));
}

function setRange(ins, role, keys, startIdx, endIdxInclusive, code) {
  for (let i = startIdx; i <= endIdxInclusive && i < keys.length; i++) {
    ins[role][keys[i]] = code;
  }
}

function setKeys(ins, role, keyList, code) {
  for (const dk of keyList) ins[role][dk] = code;
}

function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function sampleUnique(rand, arr, n) {
  const copy = arr.slice();
  const out = [];
  const take = Math.min(n, copy.length);
  for (let i = 0; i < take; i++) {
    const j = Math.floor(rand() * copy.length);
    out.push(copy.splice(j, 1)[0]);
  }
  return out;
}

function amRoles(amCount) {
  const r = [];
  for (let i = 1; i <= amCount; i++) r.push('am' + i);
  return r;
}

function makeSim(id, name, category, opts = {}) {
  const amCount = opts.amCount != null ? opts.amCount : 3;
  const days = opts.days != null ? opts.days : DEFAULT_DAYS;
  const kcList = opts.kcList || cloneKc();
  const prefs = opts.prefs || clonePrefs();
  const inputs = opts.inputs || emptyInputs(amCount, kcList);
  return {
    id,
    name,
    category,
    amCount,
    days,
    prefs,
    kcList,
    inputs,
    expectImpossible: !!opts.expectImpossible,
  };
}

/** Generate ≥120 named sims with fixed seed. */
function generateSims() {
  const rand = mulberry32(SEED);
  const meta = buildPeriodMeta(DEFAULT_DAYS);
  const { keys, dates, weekendPairs, days } = meta;
  const sims = [];
  let n = 0;
  const nextId = (prefix) => {
    n += 1;
    return `${prefix}-${String(n).padStart(3, '0')}`;
  };

  // ── 1. RTO weekend packages (20) ──────────────────────────────────────────
  for (let i = 0; i < 20; i++) {
    const amCount = 3;
    const ins = emptyInputs(amCount, BASE_KC);
    const ams = amRoles(amCount);
    const numWeekends = 1 + Math.floor(rand() * 4); // 1–4
    const pairs = sampleUnique(rand, weekendPairs, numWeekends);
    let mode;
    if (i < 6) mode = 'one-am';
    else if (i < 12) mode = 'two-ams-same';
    else if (i < 16) mode = 'all-three-same';
    else mode = 'mixed';

    if (mode === 'one-am') {
      const am = pick(rand, ams);
      for (const [si, su] of pairs) {
        ins[am][keys[si]] = 'rto';
        ins[am][keys[su]] = 'rto';
      }
    } else if (mode === 'two-ams-same') {
      const two = sampleUnique(rand, ams, 2);
      for (const [si, su] of pairs) {
        for (const am of two) {
          ins[am][keys[si]] = 'rto';
          ins[am][keys[su]] = 'rto';
        }
      }
    } else if (mode === 'all-three-same') {
      for (const [si, su] of pairs) {
        for (const am of ams) {
          ins[am][keys[si]] = 'rto';
          ins[am][keys[su]] = 'rto';
        }
      }
    } else {
      // each weekend: random 1–3 AMs
      for (const [si, su] of pairs) {
        const who = sampleUnique(rand, ams, 1 + Math.floor(rand() * 3));
        for (const am of who) {
          ins[am][keys[si]] = 'rto';
          ins[am][keys[su]] = 'rto';
        }
      }
    }

    const id = nextId('rto-we');
    sims.push(
      makeSim(id, `${id}-${mode}-w${numWeekends}`, 'rto-weekend', { inputs: ins })
    );
  }

  // ── 2. RTO single days (15) — Sat or Sun only ─────────────────────────────
  for (let i = 0; i < 15; i++) {
    const amCount = 3;
    const ins = emptyInputs(amCount, BASE_KC);
    const ams = amRoles(amCount);
    const numDays = 2 + Math.floor(rand() * 5); // 2–6 single WE days
    const weIdx = [];
    for (let d = 0; d < days; d++) {
      const dow = dates[d].getDay();
      if (dow === 0 || dow === 6) weIdx.push(d);
    }
    const chosen = sampleUnique(rand, weIdx, numDays);
    for (const di of chosen) {
      const am = pick(rand, ams);
      // sometimes two AMs same single day
      ins[am][keys[di]] = 'rto';
      if (rand() < 0.35) {
        const other = pick(rand, ams.filter((a) => a !== am));
        if (other) ins[other][keys[di]] = 'rto';
      }
    }
    const id = nextId('rto-day');
    sims.push(makeSim(id, `${id}-single-we-x${numDays}`, 'rto-single', { inputs: ins }));
  }

  // ── 3. PTO blocks (20) ────────────────────────────────────────────────────
  for (let i = 0; i < 20; i++) {
    const amCount = 3;
    const ins = emptyInputs(amCount, BASE_KC);
    const ams = amRoles(amCount);

    if (i < 8) {
      // Single AM, length 1–5 weekdays starting random weekday
      const am = pick(rand, ams);
      const len = 1 + Math.floor(rand() * 5);
      // find weekday starts
      const starts = [];
      for (let d = 0; d < days; d++) {
        if (dates[d].getDay() >= 1 && dates[d].getDay() <= 5) starts.push(d);
      }
      const start = pick(rand, starts);
      let placed = 0;
      for (let d = start; d < days && placed < len; d++) {
        const dow = dates[d].getDay();
        if (dow >= 1 && dow <= 5) {
          ins[am][keys[d]] = 'pto';
          placed++;
        }
      }
    } else if (i < 14) {
      // Multiple AMs overlapping PTO same week-ish
      const weekStartCandidates = [];
      for (let d = 0; d < days; d++) if (dates[d].getDay() === 1) weekStartCandidates.push(d);
      const ws = pick(rand, weekStartCandidates.length ? weekStartCandidates : [0]);
      const who = sampleUnique(rand, ams, 2 + Math.floor(rand() * 2)); // 2–3
      const len = 2 + Math.floor(rand() * 4);
      for (const am of who) {
        let placed = 0;
        for (let d = ws; d < days && placed < len; d++) {
          const dow = dates[d].getDay();
          if (dow >= 1 && dow <= 5) {
            ins[am][keys[d]] = 'pto';
            placed++;
          }
        }
      }
    } else {
      // Full-week VAC Mon–Fri
      const weekStartCandidates = [];
      for (let d = 0; d < days - 4; d++) if (dates[d].getDay() === 1) weekStartCandidates.push(d);
      const ws = pick(rand, weekStartCandidates.length ? weekStartCandidates : [0]);
      const am = pick(rand, ams);
      for (let d = ws; d < ws + 5 && d < days; d++) {
        if (dates[d].getDay() >= 1 && dates[d].getDay() <= 5) ins[am][keys[d]] = 'pto';
      }
      // sometimes second AM different week
      if (rand() < 0.5 && weekStartCandidates.length > 1) {
        const ws2 = pick(
          rand,
          weekStartCandidates.filter((x) => x !== ws)
        );
        const am2 = pick(rand, ams.filter((a) => a !== am));
        if (am2 != null && ws2 != null) {
          for (let d = ws2; d < ws2 + 5 && d < days; d++) {
            if (dates[d].getDay() >= 1 && dates[d].getDay() <= 5) ins[am2][keys[d]] = 'pto';
          }
        }
      }
    }

    const id = nextId('pto');
    sims.push(makeSim(id, `${id}-block`, 'pto-blocks', { inputs: ins }));
  }

  // ── 4. LOA long (15) ──────────────────────────────────────────────────────
  for (let i = 0; i < 15; i++) {
    const amCount = 3;
    const ins = emptyInputs(amCount, BASE_KC);
    const ams = amRoles(amCount);

    if (i < 5) {
      // SM LOA from random day to end
      const start = Math.floor(rand() * Math.floor(days * 0.6));
      setRange(ins, 'sm', keys, start, days - 1, 'loa');
    } else if (i < 10) {
      // AM LOA half or full period
      const am = pick(rand, ams);
      if (rand() < 0.4) {
        setRange(ins, am, keys, 0, days - 1, 'loa');
      } else {
        const half = Math.floor(days / 2);
        if (rand() < 0.5) setRange(ins, am, keys, 0, half - 1, 'loa');
        else setRange(ins, am, keys, half, days - 1, 'loa');
      }
    } else {
      // Dual LOA SM + one AM overlapping or staggered
      const am = pick(rand, ams);
      const smStart = Math.floor(rand() * 10);
      const amStart = Math.floor(rand() * 15);
      const overlap = rand() < 0.5;
      if (overlap) {
        setRange(ins, 'sm', keys, smStart, Math.min(smStart + 14, days - 1), 'loa');
        setRange(ins, am, keys, smStart + 3, Math.min(smStart + 17, days - 1), 'loa');
      } else {
        setRange(ins, 'sm', keys, 0, Math.floor(days / 2) + 2, 'loa');
        setRange(ins, am, keys, Math.floor(days / 2) - 2, days - 1, 'loa');
      }
    }

    const id = nextId('loa');
    sims.push(makeSim(id, `${id}-long`, 'loa-long', { inputs: ins }));
  }

  // ── 5. Mixed hell (25) ────────────────────────────────────────────────────
  for (let i = 0; i < 25; i++) {
    const amCount = 3;
    const ins = emptyInputs(amCount, BASE_KC);
    const ams = amRoles(amCount);

    if (i < 6) {
      // LOA + PTO + RTO on different people
      setRange(ins, 'sm', keys, 10 + Math.floor(rand() * 5), days - 1, 'loa');
      const ptoStart = 3 + Math.floor(rand() * 8);
      setRange(ins, 'am1', keys, ptoStart, ptoStart + 2 + Math.floor(rand() * 3), 'pto');
      const pairs = sampleUnique(rand, weekendPairs, 1 + Math.floor(rand() * 3));
      for (const [si, su] of pairs) {
        ins.am2[keys[si]] = 'rto';
        ins.am2[keys[su]] = 'rto';
      }
    } else if (i < 11) {
      // Checkerboard PTO every other day for one AM
      const am = pick(rand, ams);
      for (let d = 0; d < days; d++) {
        if (d % 2 === (i % 2)) ins[am][keys[d]] = 'pto';
      }
      // light RTO on another
      const other = pick(rand, ams.filter((a) => a !== am));
      if (other && weekendPairs[0]) {
        ins[other][keys[weekendPairs[0][0]]] = 'rto';
        ins[other][keys[weekendPairs[0][1]]] = 'rto';
      }
    } else if (i < 16) {
      // RTO all weekends one AM + PTO midweek another
      const amR = pick(rand, ams);
      const amP = pick(rand, ams.filter((a) => a !== amR));
      for (const [si, su] of weekendPairs) {
        ins[amR][keys[si]] = 'rto';
        ins[amR][keys[su]] = 'rto';
      }
      const starts = [];
      for (let d = 0; d < days; d++) if (dates[d].getDay() === 1) starts.push(d);
      const ws = pick(rand, starts.length ? starts : [1]);
      for (let d = ws; d < ws + 5 && d < days; d++) {
        if (dates[d].getDay() >= 1 && dates[d].getDay() <= 5) ins[amP][keys[d]] = 'pto';
      }
    } else if (i < 20) {
      // SM LOA last 3 weeks + Norma-style RTO/VAC on am3
      setRange(ins, 'sm', keys, 14, days - 1, 'loa');
      // am3 RTO two weekends + midweek PTO
      if (weekendPairs[1]) {
        ins.am3[keys[weekendPairs[1][0]]] = 'rto';
        ins.am3[keys[weekendPairs[1][1]]] = 'rto';
      }
      if (weekendPairs[2]) {
        ins.am3[keys[weekendPairs[2][0]]] = 'rto';
        ins.am3[keys[weekendPairs[2][1]]] = 'rto';
      }
      // week between: PTO Mon–Fri around second weekend
      const ptoKeys = keys.filter((dk, idx) => {
        const dow = dates[idx].getDay();
        return dk >= '2026-09-07' && dk <= '2026-09-11' && dow >= 1 && dow <= 5;
      });
      setKeys(ins, 'am3', ptoKeys, 'pto');
      // light PTO on am1
      if (rand() < 0.7) {
        setRange(ins, 'am1', keys, 5, 7, 'pto');
      }
    } else {
      // Kitchen sink: staggered LOA, scattered PTO, partial RTO
      setRange(ins, 'sm', keys, 18, days - 1, 'loa');
      setRange(ins, 'am1', keys, 0, 6 + Math.floor(rand() * 5), 'loa');
      const ptoDays = sampleUnique(
        rand,
        keys.map((_, i) => i).filter((i) => dates[i].getDay() >= 1 && dates[i].getDay() <= 5),
        4 + Math.floor(rand() * 5)
      );
      for (const di of ptoDays) ins.am2[keys[di]] = 'pto';
      const rPairs = sampleUnique(rand, weekendPairs, 2 + Math.floor(rand() * 2));
      for (const [si, su] of rPairs) {
        ins.am3[keys[si]] = 'rto';
        ins.am3[keys[su]] = 'rto';
      }
    }

    const id = nextId('mix');
    sims.push(makeSim(id, `${id}-hell`, 'mixed-hell', { inputs: ins }));
  }

  // ── 6. Team size variants (10) ────────────────────────────────────────────
  const teamSizes = [1, 1, 2, 2, 4, 4, 5, 5, 2, 4];
  for (let i = 0; i < 10; i++) {
    const amCount = teamSizes[i];
    const ins = emptyInputs(amCount, BASE_KC);
    const ams = amRoles(amCount);
    // light random RTO/PTO
    if (ams.length && weekendPairs.length) {
      const am = pick(rand, ams);
      const pair = pick(rand, weekendPairs);
      ins[am][keys[pair[0]]] = 'rto';
      ins[am][keys[pair[1]]] = 'rto';
    }
    if (ams.length) {
      const am = pick(rand, ams);
      const start = 4 + Math.floor(rand() * 10);
      setRange(ins, am, keys, start, start + 1 + Math.floor(rand() * 2), 'pto');
    }
    const id = nextId('team');
    sims.push(
      makeSim(id, `${id}-amCount-${amCount}`, 'team-size', {
        amCount,
        inputs: ins,
      })
    );
  }

  // ── 7. KC / prefs variants (10) ───────────────────────────────────────────
  const prefVariants = [
    { kcCloseDays: [1], targetWeekendDaysOff: 2 },
    { kcCloseDays: [1, 4], targetWeekendDaysOff: 2 },
    { kcCloseDays: [], targetWeekendDaysOff: 2 },
    { kcCloseDays: [0, 6], targetWeekendDaysOff: 2 },
    { kcCloseDays: [1], targetWeekendDaysOff: 0 },
    { kcCloseDays: [1], targetWeekendDaysOff: 2 },
    { kcCloseDays: [1], targetWeekendDaysOff: 3 },
    { kcCloseDays: [1], targetWeekendDaysOff: 4 },
    { kcCloseDays: [1, 4], targetWeekendDaysOff: 0 },
    { kcCloseDays: [0, 6], targetWeekendDaysOff: 3 },
  ];
  for (let i = 0; i < 10; i++) {
    const amCount = 3;
    const ins = emptyInputs(amCount, BASE_KC);
    const ams = amRoles(amCount);
    // light time-off
    if (rand() < 0.8) {
      const am = pick(rand, ams);
      const pair = pick(rand, weekendPairs);
      ins[am][keys[pair[0]]] = 'rto';
      ins[am][keys[pair[1]]] = 'rto';
    }
    if (rand() < 0.6) {
      const am = pick(rand, ams);
      const start = 8 + Math.floor(rand() * 12);
      setRange(ins, am, keys, start, start + 2, 'pto');
    }
    const pv = prefVariants[i];
    const id = nextId('pref');
    sims.push(
      makeSim(id, `${id}-kc${JSON.stringify(pv.kcCloseDays)}-we${pv.targetWeekendDaysOff}`, 'kc-prefs', {
        inputs: ins,
        prefs: clonePrefs(pv),
      })
    );
  }

  // ── 8. Deterministic named (≥10) ──────────────────────────────────────────
  {
    // p08-replica
    const ins = emptyInputs(3, BASE_KC);
    keys.forEach((dk) => {
      if (dk >= '2026-09-13') ins.sm[dk] = 'loa';
    });
    for (const dk of ['2026-09-05', '2026-09-06', '2026-09-12', '2026-09-13']) ins.am3[dk] = 'rto';
    for (const dk of ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11']) {
      ins.am3[dk] = 'pto';
    }
    sims.push(
      makeSim('det-p08-replica', 'p08-replica', 'deterministic', {
        inputs: ins,
        prefs: clonePrefs({ preferConsecutiveDaysOff: true }),
      })
    );
  }
  {
    // all-ams-rto-same-weekend
    const ins = emptyInputs(3, BASE_KC);
    const pair = weekendPairs[1] || weekendPairs[0];
    for (const am of amRoles(3)) {
      ins[am][keys[pair[0]]] = 'rto';
      ins[am][keys[pair[1]]] = 'rto';
    }
    sims.push(
      makeSim('det-all-ams-rto-same-we', 'all-ams-rto-same-weekend', 'deterministic', { inputs: ins })
    );
  }
  {
    // two-ams-pto-same-week
    const ins = emptyInputs(3, BASE_KC);
    for (const dk of ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11']) {
      ins.am1[dk] = 'pto';
      ins.am2[dk] = 'pto';
    }
    sims.push(
      makeSim('det-two-ams-pto-same-week', 'two-ams-pto-same-week', 'deterministic', { inputs: ins })
    );
  }
  {
    // sm-loa-entire-period
    const ins = emptyInputs(3, BASE_KC);
    setRange(ins, 'sm', keys, 0, days - 1, 'loa');
    sims.push(
      makeSim('det-sm-loa-entire', 'sm-loa-entire-period', 'deterministic', { inputs: ins })
    );
  }
  {
    // am1-loa-entire + am2-rto-all-we
    const ins = emptyInputs(3, BASE_KC);
    setRange(ins, 'am1', keys, 0, days - 1, 'loa');
    for (const [si, su] of weekendPairs) {
      ins.am2[keys[si]] = 'rto';
      ins.am2[keys[su]] = 'rto';
    }
    sims.push(
      makeSim('det-am1-loa-am2-rto-we', 'am1-loa-entire+am2-rto-all-we', 'deterministic', {
        inputs: ins,
      })
    );
  }
  {
    // rotating-pto-each-am-one-week
    const ins = emptyInputs(3, BASE_KC);
    const monStarts = [];
    for (let d = 0; d < days; d++) if (dates[d].getDay() === 1) monStarts.push(d);
    for (let a = 0; a < 3 && a < monStarts.length; a++) {
      const ws = monStarts[a];
      for (let d = ws; d < ws + 5 && d < days; d++) {
        if (dates[d].getDay() >= 1 && dates[d].getDay() <= 5) ins['am' + (a + 1)][keys[d]] = 'pto';
      }
    }
    sims.push(
      makeSim('det-rotating-pto-weeks', 'rotating-pto-each-am-one-week', 'deterministic', {
        inputs: ins,
      })
    );
  }
  {
    // holiday-style: all AMs RTO one weekend + SM works
    const ins = emptyInputs(3, BASE_KC);
    const pair = weekendPairs[Math.min(3, weekendPairs.length - 1)] || weekendPairs[0];
    for (const am of amRoles(3)) {
      ins[am][keys[pair[0]]] = 'rto';
      ins[am][keys[pair[1]]] = 'rto';
    }
    // SM not on LOA — works the holiday weekend
    sims.push(
      makeSim('det-holiday-ams-rto', 'holiday-style-all-ams-rto-one-we', 'deterministic', {
        inputs: ins,
      })
    );
  }
  {
    // back-to-back PTO weeks am1 then am2
    const ins = emptyInputs(3, BASE_KC);
    const monStarts = [];
    for (let d = 0; d < days; d++) if (dates[d].getDay() === 1) monStarts.push(d);
    if (monStarts[1] != null) {
      for (let d = monStarts[1]; d < monStarts[1] + 5 && d < days; d++) {
        if (dates[d].getDay() >= 1 && dates[d].getDay() <= 5) ins.am1[keys[d]] = 'pto';
      }
    }
    if (monStarts[2] != null) {
      for (let d = monStarts[2]; d < monStarts[2] + 5 && d < days; d++) {
        if (dates[d].getDay() >= 1 && dates[d].getDay() <= 5) ins.am2[keys[d]] = 'pto';
      }
    }
    sims.push(
      makeSim('det-b2b-pto-weeks', 'back-to-back-pto-weeks-am1-am2', 'deterministic', {
        inputs: ins,
      })
    );
  }
  {
    // rto-fri-sat-sun packages → Sat+Sun only (weekend packages)
    const ins = emptyInputs(3, BASE_KC);
    for (const am of ['am1', 'am2']) {
      const pair = weekendPairs[am === 'am1' ? 0 : 2] || weekendPairs[0];
      ins[am][keys[pair[0]]] = 'rto';
      ins[am][keys[pair[1]]] = 'rto';
    }
    sims.push(
      makeSim('det-rto-sat-sun-packages', 'rto-sat-sun-packages', 'deterministic', { inputs: ins })
    );
  }
  {
    // max-chaos: sm loa 3w, am1 pto 8 days scattered, am2 rto 6 weekends, am3 loa 1 week mid
    const ins = emptyInputs(3, BASE_KC);
    setRange(ins, 'sm', keys, 14, days - 1, 'loa'); // ~3 weeks
    // am1 8 scattered weekday PTOs
    const weekdayIdx = [];
    for (let d = 0; d < days; d++) {
      const dow = dates[d].getDay();
      if (dow >= 1 && dow <= 5) weekdayIdx.push(d);
    }
    // deterministic scatter: every 3rd weekday up to 8
    let placed = 0;
    for (let j = 0; j < weekdayIdx.length && placed < 8; j += 2) {
      ins.am1[keys[weekdayIdx[j]]] = 'pto';
      placed++;
    }
    // am2 RTO all weekends in period (up to 6 pairs; we have ~5)
    for (const [si, su] of weekendPairs) {
      ins.am2[keys[si]] = 'rto';
      ins.am2[keys[su]] = 'rto';
    }
    // am3 LOA 1 week mid
    const midMon = [];
    for (let d = 0; d < days; d++) if (dates[d].getDay() === 1) midMon.push(d);
    const ws = midMon[Math.floor(midMon.length / 2)] || 14;
    setRange(ins, 'am3', keys, ws, ws + 6, 'loa');
    sims.push(makeSim('det-max-chaos', 'max-chaos', 'deterministic', { inputs: ins }));
  }

  // Extra deterministic for margin past 120
  {
    const ins = emptyInputs(3, BASE_KC);
    // triple PTO same 3 days
    for (const dk of ['2026-09-14', '2026-09-15', '2026-09-16']) {
      ins.am1[dk] = 'pto';
      ins.am2[dk] = 'pto';
      ins.am3[dk] = 'pto';
    }
    sims.push(
      makeSim('det-triple-pto-3days', 'triple-pto-same-3-days', 'deterministic', { inputs: ins })
    );
  }
  {
    const ins = emptyInputs(3, BASE_KC);
    setRange(ins, 'am2', keys, 0, days - 1, 'loa');
    setRange(ins, 'sm', keys, 20, days - 1, 'loa');
    sims.push(
      makeSim('det-am2-loa-sm-late', 'am2-loa-entire+sm-loa-late', 'deterministic', { inputs: ins })
    );
  }

  return sims;
}

async function main() {
  console.log('\n=== Time-off Monte Carlo stress suite ===\n');
  const startedAt = new Date().toISOString();
  const sims = generateSims();
  console.log(`Generated ${sims.length} simulations (seed=${SEED})`);

  const byCat = {};
  for (const s of sims) {
    byCat[s.category] = (byCat[s.category] || 0) + 1;
  }
  console.log('Categories:', JSON.stringify(byCat));

  const { server, base } = await startStaticServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  const offline = page.locator('button:has-text("Continue offline")');
  if (await offline.isVisible().catch(() => false)) {
    await offline.click();
    await page.waitForTimeout(400);
  }

  await page.waitForFunction(
    () => typeof _generateScheduleInner === 'function' && typeof DEFAULT_PREFERENCES !== 'undefined',
    null,
    { timeout: 30000 }
  );

  // Run in batches to keep evaluate payloads manageable
  const BATCH = 30;
  const allRaw = [];
  let version = '?';

  for (let off = 0; off < sims.length; off += BATCH) {
    const batch = sims.slice(off, off + BATCH);
    console.log(`  Running sims ${off + 1}–${Math.min(off + BATCH, sims.length)} of ${sims.length}…`);
    const raw = await page.evaluate((simList) => {
      function buildDays(startY, startM, startD, n) {
        const days = [];
        for (let i = 0; i < n; i++) days.push(new Date(startY, startM - 1, startD + i));
        return days;
      }

      function setupPeriod(days) {
        periodDates = buildDays(2026, 8, 30, days);
        const numWeeks = Math.ceil(days / 7);
        currentPeriod = {
          number: 8,
          approxMonth: 'Sep',
          start: periodDates[0],
          end: periodDates[periodDates.length - 1],
          numWeeks,
          weeks: [],
        };
        for (let w = 0; w < numWeeks; w++) {
          const s = periodDates[w * 7] || periodDates[0];
          const e = periodDates[Math.min(w * 7 + 6, periodDates.length - 1)];
          currentPeriod.weeks.push({ start: s, end: e });
        }
        fiscalYear = 2026;
        holidayWeeks = {};
      }

      function analyze(prefs) {
        const ROLES = getRoles();
        const AMS = typeof getAMs === 'function' ? getAMs() : ROLES.filter((r) => r.startsWith('am'));
        const nonMgr = typeof getNonManagerKCs === 'function' ? getNonManagerKCs() : [];
        const allDks = periodDates.map(dateKey);
        const isDayOff = (s) => s === 'off' || s === 'rto' || s === 'pto' || s === 'loa';
        const isWE = (dk) => {
          const [y, m, d] = dk.split('-').map(Number);
          return [0, 6].includes(new Date(y, m - 1, d).getDay());
        };
        const kcCloseDows = Array.isArray(prefs.kcCloseDays) ? prefs.kcCloseDays : [];

        let noOpen = 0;
        let noClose = 0;
        let clopens = 0;
        let thin = 0;
        let dualMgrCloses = 0;
        let mgrCloseOnKc = 0;

        allDks.forEach((dk, i) => {
          let opens = 0;
          let closes = 0;
          let workers = 0;
          let mgrCloses = 0;

          ROLES.forEach((r) => {
            const s = schedule[r] && schedule[r][dk];
            if (typeof isOpen === 'function' ? isOpen(s) : s && String(s).startsWith('open')) opens++;
            if (typeof isClose === 'function' ? isClose(s) : s === 'close' || s === 'close-ext' || s === 'kc-close') {
              if (s !== 'kc-close') {
                closes++;
                mgrCloses++;
              } else {
                closes++;
              }
            }
            if (typeof isWork === 'function' ? isWork(s) : s && !isDayOff(s)) workers++;
          });

          nonMgr.forEach((kc) => {
            const s = schedule[kc.id] && schedule[kc.id][dk];
            if (s === 'kc-close') {
              closes++;
              workers++;
            } else if (s && !isDayOff(s)) {
              workers++;
            }
          });

          if (opens === 0) noOpen++;
          if (closes === 0) noClose++;
          if (workers > 0 && workers < 2) thin++;
          if (mgrCloses >= 2) dualMgrCloses++;

          const dow = periodDates[i].getDay();
          if (kcCloseDows.includes(dow) && nonMgr.length > 0 && mgrCloses > 0) {
            mgrCloseOnKc += mgrCloses;
          }

          if (i > 0) {
            ROLES.forEach((r) => {
              const prev = schedule[r] && schedule[r][allDks[i - 1]];
              const cur = schedule[r] && schedule[r][dk];
              const prevClose =
                typeof isClose === 'function'
                  ? isClose(prev) && prev !== 'kc-close'
                  : prev === 'close' || prev === 'close-ext';
              const curOpen =
                typeof isOpen === 'function' ? isOpen(cur) : cur && String(cur).startsWith('open');
              if (prevClose && curOpen) clopens++;
            });
          }
        });

        const amCloses = {};
        const amWeOff = {};
        const amWorkDays = {};
        AMS.forEach((r) => {
          amCloses[r] = allDks.filter((dk) => {
            const s = schedule[r] && schedule[r][dk];
            return s === 'close' || s === 'close-ext';
          }).length;
          amWeOff[r] = allDks.filter((dk) => isWE(dk) && isDayOff(schedule[r] && schedule[r][dk])).length;
          amWorkDays[r] = allDks.filter((dk) => {
            const s = schedule[r] && schedule[r][dk];
            return s && !isDayOff(s);
          }).length;
        });

        // Fairness among AMs who worked ≥50% of period
        const threshold = allDks.length * 0.5;
        const activeAMs = AMS.filter((r) => (amWorkDays[r] || 0) >= threshold);
        const closeVals = activeAMs.map((r) => amCloses[r]);
        const weVals = activeAMs.map((r) => amWeOff[r]);
        const closeSpread = closeVals.length >= 2 ? Math.max(...closeVals) - Math.min(...closeVals) : 0;
        const weSpread = weVals.length >= 2 ? Math.max(...weVals) - Math.min(...weVals) : 0;

        return {
          noOpen,
          noClose,
          clopens,
          thin,
          dualMgrCloses,
          mgrCloseOnKc,
          amCloses,
          amWeOff,
          amWorkDays,
          activeAMs,
          closeSpread,
          weSpread,
          days: allDks.length,
        };
      }

      const out = [];
      for (const sc of simList) {
        const t0 = performance.now();
        let error = null;
        let stats = null;
        try {
          setupPeriod(sc.days || 35);
          amCount = sc.amCount != null ? sc.amCount : 3;
          kcList = (sc.kcList || []).map((k) => Object.assign({}, k, { midDows: (k.midDows || []).slice() }));

          // Deep-copy inputs
          const ins = { sm: Object.assign({}, (sc.inputs && sc.inputs.sm) || {}) };
          for (let i = 1; i <= Math.max(amCount, 5); i++) {
            const k = 'am' + i;
            ins[k] = Object.assign({}, (sc.inputs && sc.inputs[k]) || {});
          }
          (kcList || []).forEach((kc) => {
            ins[kc.id] = Object.assign({}, (sc.inputs && sc.inputs[kc.id]) || {});
          });
          inputs = ins;

          preferences = Object.assign({}, DEFAULT_PREFERENCES, sc.prefs || {});
          if (typeof renderPreferencesUI === 'function') {
            try {
              renderPreferencesUI();
            } catch (e) {}
          }

          schedule = {};
          _generateScheduleInner();
          stats = analyze(preferences);
        } catch (e) {
          error = String(e && e.message ? e.message : e);
        }
        const ms = Math.round(performance.now() - t0);
        out.push({
          id: sc.id,
          name: sc.name,
          category: sc.category,
          expectImpossible: !!sc.expectImpossible,
          avoidClopening: sc.prefs ? sc.prefs.avoidClopening !== false : true,
          ms,
          error,
          noOpen: stats ? stats.noOpen : -1,
          noClose: stats ? stats.noClose : -1,
          clopens: stats ? stats.clopens : -1,
          thin: stats ? stats.thin : -1,
          dualMgrCloses: stats ? stats.dualMgrCloses : -1,
          mgrCloseOnKc: stats ? stats.mgrCloseOnKc : -1,
          amCloses: stats ? stats.amCloses : {},
          amWeOff: stats ? stats.amWeOff : {},
          amWorkDays: stats ? stats.amWorkDays : {},
          activeAMs: stats ? stats.activeAMs : [],
          closeSpread: stats ? stats.closeSpread : -1,
          weSpread: stats ? stats.weSpread : -1,
          days: stats ? stats.days : sc.days || 35,
        });
      }
      return {
        version: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '?',
        results: out,
      };
    }, batch);

    version = raw.version || version;
    allRaw.push(...raw.results);
  }

  // Evaluate PASS / WARN / FAIL
  const evaluated = [];
  let passN = 0;
  let failN = 0;
  let warnN = 0;

  for (const r of allRaw) {
    const hard = [];
    const soft = [];

    if (r.error) hard.push(`throw: ${r.error}`);
    if (r.noOpen > 0) {
      if (r.expectImpossible) soft.push(`noOpen=${r.noOpen} (expectImpossible)`);
      else hard.push(`noOpen=${r.noOpen}`);
    }
    if (r.noClose > 0) {
      if (r.expectImpossible) soft.push(`noClose=${r.noClose} (expectImpossible)`);
      else hard.push(`noClose=${r.noClose}`);
    }
    if ((r.mgrCloseOnKc || 0) > 0) hard.push(`mgrCloseOnKc=${r.mgrCloseOnKc}`);

    // Soft: clopens when avoidClopening
    if ((r.clopens || 0) > 0 && r.avoidClopening) {
      soft.push(`clopens=${r.clopens}`);
    }
    // Soft: close/we spread > 3 among AMs who worked ≥50%
    if ((r.closeSpread || 0) > 3 && (r.activeAMs || []).length >= 2) {
      soft.push(`AM close spread=${r.closeSpread} ${JSON.stringify(r.amCloses)} active=${JSON.stringify(r.activeAMs)}`);
    }
    if ((r.weSpread || 0) > 3 && (r.activeAMs || []).length >= 2) {
      soft.push(`AM weekend-off spread=${r.weSpread} ${JSON.stringify(r.amWeOff)} active=${JSON.stringify(r.activeAMs)}`);
    }

    let status = 'PASS';
    if (hard.length) status = 'FAIL';
    else if (soft.length) status = 'WARN';

    if (status === 'PASS') passN++;
    else if (status === 'FAIL') failN++;
    else warnN++;

    const perfectCoverage = r.noOpen === 0 && r.noClose === 0 && !r.error;

    evaluated.push({
      id: r.id,
      name: r.name,
      category: r.category,
      status,
      hard,
      soft,
      perfectCoverage,
      stats: {
        noOpen: r.noOpen,
        noClose: r.noClose,
        clopens: r.clopens,
        thin: r.thin,
        dualMgrCloses: r.dualMgrCloses,
        mgrCloseOnKc: r.mgrCloseOnKc,
        amCloses: r.amCloses,
        amWeOff: r.amWeOff,
        amWorkDays: r.amWorkDays,
        activeAMs: r.activeAMs,
        closeSpread: r.closeSpread,
        weSpread: r.weSpread,
        ms: r.ms,
        error: r.error,
        days: r.days,
      },
    });

    const tag =
      status === 'FAIL' ? 'FAIL' : status === 'WARN' ? 'WARN' : 'PASS';
    if (status !== 'PASS') {
      console.log(
        `  ${tag} ${r.id} ${r.name} — ${[...hard, ...soft].join('; ') || 'ok'} | clopens=${r.clopens} closeSp=${r.closeSpread} weSp=${r.weSpread} ms=${r.ms}`
      );
    }
  }

  const perfectN = evaluated.filter((e) => e.perfectCoverage).length;
  const perfectRate = evaluated.length ? (100 * perfectN) / evaluated.length : 0;

  // Histograms
  const clopenHist = { '0': 0, '1-2': 0, '3+': 0 };
  for (const e of evaluated) {
    const c = e.stats.clopens;
    if (c <= 0) clopenHist['0']++;
    else if (c <= 2) clopenHist['1-2']++;
    else clopenHist['3+']++;
  }

  const byClopens = [...evaluated]
    .filter((e) => e.stats.clopens >= 0)
    .sort((a, b) => b.stats.clopens - a.stats.clopens);
  const byCloseSpread = [...evaluated]
    .filter((e) => e.stats.closeSpread >= 0)
    .sort((a, b) => b.stats.closeSpread - a.stats.closeSpread);
  const byWeSpread = [...evaluated]
    .filter((e) => e.stats.weSpread >= 0)
    .sort((a, b) => b.stats.weSpread - a.stats.weSpread);

  // Category breakdown
  const catSummary = {};
  for (const e of evaluated) {
    if (!catSummary[e.category]) catSummary[e.category] = { pass: 0, warn: 0, fail: 0, total: 0 };
    catSummary[e.category].total++;
    if (e.status === 'PASS') catSummary[e.category].pass++;
    else if (e.status === 'WARN') catSummary[e.category].warn++;
    else catSummary[e.category].fail++;
  }

  await browser.close();
  server.close();

  const finishedAt = new Date().toISOString();
  const fails = evaluated.filter((e) => e.status === 'FAIL');
  const warns = evaluated.filter((e) => e.status === 'WARN');

  const report = {
    title: 'Schedule Pro Time-Off Monte Carlo Stress',
    version,
    seed: SEED,
    startedAt,
    finishedAt,
    base,
    summary: {
      pass: passN,
      warn: warnN,
      fail: failN,
      total: evaluated.length,
      perfectCoverage: perfectN,
      perfectCoveragePct: Math.round(perfectRate * 10) / 10,
    },
    categories: catSummary,
    hardCriteria: [
      'noOpen === 0 every day',
      'noClose === 0 every day (manager open/close + non-mgr kc-close)',
      'generator does not throw',
      'mgrCloseOnKc === 0 when kcCloseDays set and non-mgr KCs exist',
    ],
    softCriteria: [
      'clopens > 0 when avoidClopening → WARN',
      'AM close spread > 3 among AMs who worked ≥50% of period → WARN',
      'AM weekend-off spread > 3 among same → WARN',
    ],
    clopenHistogram: clopenHist,
    worst: {
      highestClopens: byClopens.slice(0, 10).map((e) => ({
        id: e.id,
        name: e.name,
        clopens: e.stats.clopens,
        status: e.status,
      })),
      worstCloseSpread: byCloseSpread.slice(0, 10).map((e) => ({
        id: e.id,
        name: e.name,
        closeSpread: e.stats.closeSpread,
        amCloses: e.stats.amCloses,
        status: e.status,
      })),
      worstWeSpread: byWeSpread.slice(0, 10).map((e) => ({
        id: e.id,
        name: e.name,
        weSpread: e.stats.weSpread,
        amWeOff: e.stats.amWeOff,
        status: e.status,
      })),
    },
    failures: fails.map((e) => ({
      id: e.id,
      name: e.name,
      category: e.category,
      hard: e.hard,
      stats: e.stats,
    })),
    warnings: warns.map((e) => ({
      id: e.id,
      name: e.name,
      category: e.category,
      soft: e.soft,
      stats: {
        clopens: e.stats.clopens,
        closeSpread: e.stats.closeSpread,
        weSpread: e.stats.weSpread,
      },
    })),
    simulations: evaluated,
  };

  const jsonPath = join(__dirname, 'STRESS_TIMEOFF_REPORT.json');
  const mdPath = join(__dirname, 'STRESS_TIMEOFF_REPORT.md');
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const md = [];
  md.push('# Schedule Pro Time-Off Monte Carlo Stress Report');
  md.push('');
  md.push(`Generated: ${finishedAt}`);
  md.push(`Engine version: **${version}**`);
  md.push(`Seed: \`${SEED}\``);
  md.push(`Base: \`${base}\``);
  md.push('');
  md.push('## Summary');
  md.push('');
  md.push('| Result | Count |');
  md.push('|--------|------:|');
  md.push(`| PASS   | ${passN} |`);
  md.push(`| WARN   | ${warnN} |`);
  md.push(`| FAIL   | ${failN} |`);
  md.push(`| Total  | ${evaluated.length} |`);
  md.push(`| Perfect open+close coverage | ${perfectN} (${Math.round(perfectRate * 10) / 10}%) |`);
  md.push('');
  md.push('Exit code is **1 only on hard FAIL**. Soft WARNs do not fail the suite.');
  md.push('');
  md.push('## Categories');
  md.push('');
  md.push('| Category | PASS | WARN | FAIL | Total |');
  md.push('|----------|-----:|-----:|-----:|------:|');
  for (const [cat, c] of Object.entries(catSummary)) {
    md.push(`| ${cat} | ${c.pass} | ${c.warn} | ${c.fail} | ${c.total} |`);
  }
  md.push('');
  md.push('## Clopen histogram');
  md.push('');
  md.push(`- 0 clopens: **${clopenHist['0']}**`);
  md.push(`- 1–2 clopens: **${clopenHist['1-2']}**`);
  md.push(`- 3+ clopens: **${clopenHist['3+']}**`);
  md.push('');
  md.push('## Failures (hard)');
  md.push('');
  if (!fails.length) md.push('None.');
  else {
    fails.forEach((e) => {
      md.push(`### ${e.id} — ${e.name}`);
      md.push('');
      md.push(`- Category: ${e.category}`);
      md.push(`- Hard: ${e.hard.join('; ')}`);
      md.push(
        `- Metrics: noOpen=${e.stats.noOpen} noClose=${e.stats.noClose} clopens=${e.stats.clopens} mgrOnKc=${e.stats.mgrCloseOnKc} ms=${e.stats.ms}`
      );
      md.push('');
    });
  }
  md.push('');
  md.push('## Soft warnings (sample / all)');
  md.push('');
  md.push(`Total WARNs: **${warns.length}**`);
  md.push('');
  warns.slice(0, 40).forEach((e) => {
    md.push(`- **${e.id}** (${e.name}): ${e.soft.join('; ')}`);
  });
  if (warns.length > 40) md.push(`- …and ${warns.length - 40} more (see JSON)`);
  md.push('');
  md.push('## Top 10 worst by clopens');
  md.push('');
  report.worst.highestClopens.forEach((w, i) => {
    md.push(`${i + 1}. ${w.id} (${w.name}): clopens=${w.clopens} [${w.status}]`);
  });
  md.push('');
  md.push('## Top 10 worst by AM close spread');
  md.push('');
  report.worst.worstCloseSpread.forEach((w, i) => {
    md.push(
      `${i + 1}. ${w.id} (${w.name}): spread=${w.closeSpread} ${JSON.stringify(w.amCloses)} [${w.status}]`
    );
  });
  md.push('');
  md.push('## Top 10 worst by weekend-off spread');
  md.push('');
  report.worst.worstWeSpread.forEach((w, i) => {
    md.push(
      `${i + 1}. ${w.id} (${w.name}): spread=${w.weSpread} ${JSON.stringify(w.amWeOff)} [${w.status}]`
    );
  });
  md.push('');
  md.push('## Hard criteria');
  md.push('');
  report.hardCriteria.forEach((c) => md.push(`- ${c}`));
  md.push('');
  md.push('## Soft criteria');
  md.push('');
  report.softCriteria.forEach((c) => md.push(`- ${c}`));
  md.push('');
  md.push('## How to re-run');
  md.push('');
  md.push('```bash');
  md.push('node tests/test-stress-timeoff-sims.mjs');
  md.push('```');
  md.push('');

  writeFileSync(mdPath, md.join('\n'));

  console.log(`\n${passN} PASS / ${warnN} WARN / ${failN} FAIL  (of ${evaluated.length})`);
  console.log(`Perfect coverage: ${perfectN}/${evaluated.length} (${Math.round(perfectRate * 10) / 10}%)`);
  console.log(`Clopen hist: 0=${clopenHist['0']} 1-2=${clopenHist['1-2']} 3+=${clopenHist['3+']}`);
  if (fails.length) {
    console.log('\nFAILURES:');
    fails.forEach((e) => console.log(`  ${e.id} ${e.name}: ${e.hard.join('; ')}`));
  }
  console.log(`Report: ${mdPath}`);
  console.log(`JSON:   ${jsonPath}`);

  if (failN > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
