/**
 * Schedule Pro engine stress suite (v2.5.3+)
 * Playwright + local static server of repo root.
 *
 * Hard FAIL: noOpen/noClose > 0, generator throw, manager close on KC-close nights.
 * Soft WARN (unless strictFairness): AM close/weekend spread, clopens under avoidClopening.
 *
 * Run: node tests/test-stress-engine.mjs
 */
import { chromium } from '../scripts/browser-ops/node_modules/playwright/index.mjs';
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

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

/** Scenario definitions (setup only — evaluation in page). */
const SCENARIOS = [
  {
    name: 'clean-3am',
    strictFairness: true,
    amCount: 3,
    days: 35,
    kcList: [
      { id: 'kc1', name: 'Farnaz', asManager: false, midDows: [0, 2, 4, 5] },
      { id: 'kc2', name: 'Faiqa', asManager: false, midDows: [3, 6] },
    ],
    prefs: {
      avoidClopening: true,
      fairDistribution: true,
      targetWeekendDaysOff: 2,
      preferWeekendPackages: true,
      smFewerWeekendOffs: true,
      kcCloseDays: [1],
    },
  },
  {
    name: 'p08-posted-shape',
    strictFairness: true,
    amCount: 3,
    days: 35,
    kcList: [
      { id: 'kc1', name: 'Farnaz', asManager: false, midDows: [0, 2, 4, 5] },
      { id: 'kc2', name: 'Faiqa', asManager: false, midDows: [3, 6] },
    ],
    prefs: {
      avoidClopening: true,
      fairDistribution: true,
      targetWeekendDaysOff: 2,
      preferConsecutiveDaysOff: true,
      preferWeekendPackages: true,
      smFewerWeekendOffs: true,
      kcMidWhenNoMid: true,
      kcCloseDays: [1],
    },
    buildInputs: 'p08',
  },
  {
    name: 'sole-manager',
    strictFairness: false,
    // One person cannot open AND close the same day; dual coverage is impossible without a KC.
    // Generator must not throw; residual noOpen/noClose are WARN (documented), not hard FAIL.
    impossibleDualCoverage: true,
    amCount: 0,
    days: 35,
    kcList: [],
    prefs: {
      avoidClopening: true,
      fairDistribution: true,
      targetWeekendDaysOff: 2,
      kcCloseDays: [],
      smClosesPerWeek: 7,
    },
  },
  {
    name: 'sm-plus-one-am',
    strictFairness: false,
    allowClopens: true,
    amCount: 1,
    days: 35,
    kcList: [{ id: 'kc1', name: 'KC1', asManager: false, midDows: [2, 4] }],
    prefs: {
      avoidClopening: true,
      fairDistribution: true,
      targetWeekendDaysOff: 2,
      kcCloseDays: [1],
    },
  },
  {
    name: 'five-ams',
    strictFairness: true,
    amCount: 5,
    days: 35,
    kcList: [
      { id: 'kc1', name: 'KC1', asManager: false, midDows: [0, 2, 4] },
      { id: 'kc2', name: 'KC2', asManager: false, midDows: [3, 5, 6] },
    ],
    prefs: {
      avoidClopening: true,
      fairDistribution: true,
      targetWeekendDaysOff: 2,
      kcCloseDays: [1],
    },
  },
  {
    name: 'no-kcs',
    strictFairness: true,
    amCount: 3,
    days: 35,
    kcList: [],
    prefs: {
      avoidClopening: true,
      fairDistribution: true,
      targetWeekendDaysOff: 2,
      kcCloseDays: [],
    },
  },
  {
    name: 'kc-close-all-week',
    strictFairness: false,
    amCount: 3,
    days: 35,
    kcList: [
      { id: 'kc1', name: 'KC1', asManager: false, midDows: [] },
      { id: 'kc2', name: 'KC2', asManager: false, midDows: [] },
    ],
    prefs: {
      avoidClopening: true,
      fairDistribution: true,
      targetWeekendDaysOff: 2,
      kcCloseDays: [0, 1, 2, 3, 4, 5, 6],
    },
  },
  {
    name: 'kc-close-none',
    strictFairness: true,
    amCount: 3,
    days: 35,
    kcList: [
      { id: 'kc1', name: 'KC1', asManager: false, midDows: [0, 2, 4] },
      { id: 'kc2', name: 'KC2', asManager: false, midDows: [3, 6] },
    ],
    prefs: {
      avoidClopening: true,
      fairDistribution: true,
      targetWeekendDaysOff: 2,
      kcCloseDays: [],
    },
  },
  {
    name: 'dual-loa',
    strictFairness: false,
    allowClopens: true,
    amCount: 3,
    days: 35,
    kcList: [
      { id: 'kc1', name: 'KC1', asManager: false, midDows: [0, 2, 4, 5] },
      { id: 'kc2', name: 'KC2', asManager: false, midDows: [3, 6] },
    ],
    prefs: {
      avoidClopening: true,
      fairDistribution: true,
      targetWeekendDaysOff: 2,
      kcCloseDays: [1],
    },
    buildInputs: 'dual-loa',
  },
  {
    name: 'triple-pto-same-week',
    strictFairness: false,
    allowClopens: true,
    amCount: 3,
    days: 35,
    kcList: [
      { id: 'kc1', name: 'KC1', asManager: false, midDows: [0, 2, 4] },
      { id: 'kc2', name: 'KC2', asManager: false, midDows: [3, 6] },
    ],
    prefs: {
      avoidClopening: true,
      fairDistribution: true,
      targetWeekendDaysOff: 2,
      kcCloseDays: [1],
    },
    buildInputs: 'triple-pto',
  },
  {
    name: 'all-want-weekends-4',
    strictFairness: false,
    amCount: 3,
    days: 35,
    kcList: [
      { id: 'kc1', name: 'KC1', asManager: false, midDows: [0, 2, 4, 5] },
      { id: 'kc2', name: 'KC2', asManager: false, midDows: [3, 6] },
    ],
    prefs: {
      avoidClopening: true,
      fairDistribution: true,
      targetWeekendDaysOff: 4,
      preferConsecutiveDaysOff: true,
      kcCloseDays: [1],
    },
  },
  {
    name: 'zero-weekend-target',
    strictFairness: true,
    amCount: 3,
    days: 35,
    kcList: [
      { id: 'kc1', name: 'KC1', asManager: false, midDows: [0, 2, 4] },
      { id: 'kc2', name: 'KC2', asManager: false, midDows: [3, 6] },
    ],
    prefs: {
      avoidClopening: true,
      fairDistribution: true,
      targetWeekendDaysOff: 0,
      kcCloseDays: [1],
    },
  },
  {
    name: 'rto-every-weekend-all-ams',
    strictFairness: false,
    allowClopens: true,
    amCount: 3,
    days: 35,
    kcList: [
      { id: 'kc1', name: 'KC1', asManager: false, midDows: [0, 2, 4] },
      { id: 'kc2', name: 'KC2', asManager: false, midDows: [3, 6] },
    ],
    prefs: {
      avoidClopening: true,
      fairDistribution: true,
      targetWeekendDaysOff: 2,
      kcCloseDays: [1],
    },
    buildInputs: 'rto-all-weekends',
  },
  {
    name: 'pto-checkerboard-am1',
    strictFairness: false,
    allowClopens: true,
    amCount: 3,
    days: 35,
    kcList: [
      { id: 'kc1', name: 'KC1', asManager: false, midDows: [0, 2, 4] },
      { id: 'kc2', name: 'KC2', asManager: false, midDows: [3, 6] },
    ],
    prefs: {
      avoidClopening: true,
      fairDistribution: true,
      targetWeekendDaysOff: 2,
      kcCloseDays: [1],
    },
    buildInputs: 'pto-checkerboard',
  },
  {
    name: 'manager-mode-kc',
    strictFairness: false,
    amCount: 2,
    days: 35,
    kcList: [
      { id: 'kc1', name: 'MgrKC', asManager: true, midDows: [] },
      { id: 'kc2', name: 'NonMgrKC', asManager: false, midDows: [2, 4] },
    ],
    prefs: {
      avoidClopening: true,
      fairDistribution: true,
      targetWeekendDaysOff: 2,
      kcCloseDays: [1],
    },
  },
  {
    name: 'kc-mid-all-dows-both',
    strictFairness: false,
    amCount: 3,
    days: 35,
    kcList: [
      { id: 'kc1', name: 'KC1', asManager: false, midDows: [0, 1, 2, 3, 4, 5, 6] },
      { id: 'kc2', name: 'KC2', asManager: false, midDows: [0, 1, 2, 3, 4, 5, 6] },
    ],
    prefs: {
      avoidClopening: true,
      fairDistribution: true,
      targetWeekendDaysOff: 2,
      kcMidWhenNoMid: true,
      kcCloseDays: [1],
    },
  },
  {
    name: 'avoid-clopen-off',
    strictFairness: false,
    allowClopens: true,
    amCount: 3,
    days: 35,
    kcList: [
      { id: 'kc1', name: 'KC1', asManager: false, midDows: [0, 2, 4] },
      { id: 'kc2', name: 'KC2', asManager: false, midDows: [3, 6] },
    ],
    prefs: {
      avoidClopening: false,
      fairDistribution: true,
      targetWeekendDaysOff: 2,
      kcCloseDays: [1],
    },
  },
  {
    name: 'packages-off-sm-equal',
    strictFairness: true,
    amCount: 3,
    days: 35,
    kcList: [
      { id: 'kc1', name: 'KC1', asManager: false, midDows: [0, 2, 4, 5] },
      { id: 'kc2', name: 'KC2', asManager: false, midDows: [3, 6] },
    ],
    prefs: {
      avoidClopening: true,
      fairDistribution: true,
      targetWeekendDaysOff: 2,
      preferWeekendPackages: false,
      smFewerWeekendOffs: false,
      kcCloseDays: [1],
    },
  },
  {
    name: 'sm-closes-3-per-week',
    strictFairness: false,
    amCount: 3,
    days: 35,
    kcList: [
      { id: 'kc1', name: 'KC1', asManager: false, midDows: [0, 2, 4] },
      { id: 'kc2', name: 'KC2', asManager: false, midDows: [3, 6] },
    ],
    prefs: {
      avoidClopening: true,
      fairDistribution: true,
      targetWeekendDaysOff: 2,
      smClosesPerWeek: 3,
      amClosesPerWeek: null,
      kcCloseDays: [1],
    },
  },
  {
    name: 'am-closes-fixed-2',
    strictFairness: true,
    amCount: 3,
    days: 35,
    kcList: [
      { id: 'kc1', name: 'KC1', asManager: false, midDows: [0, 2, 4] },
      { id: 'kc2', name: 'KC2', asManager: false, midDows: [3, 6] },
    ],
    prefs: {
      avoidClopening: true,
      fairDistribution: true,
      targetWeekendDaysOff: 2,
      amClosesPerWeek: 2,
      smClosesPerWeek: 1,
      kcCloseDays: [1],
    },
  },
  {
    name: 'four-week-period',
    strictFairness: true,
    amCount: 3,
    days: 28,
    kcList: [
      { id: 'kc1', name: 'KC1', asManager: false, midDows: [0, 2, 4, 5] },
      { id: 'kc2', name: 'KC2', asManager: false, midDows: [3, 6] },
    ],
    prefs: {
      avoidClopening: true,
      fairDistribution: true,
      targetWeekendDaysOff: 2,
      kcCloseDays: [1],
    },
  },
  {
    name: 'six-week-period',
    strictFairness: true,
    amCount: 3,
    days: 42,
    kcList: [
      { id: 'kc1', name: 'KC1', asManager: false, midDows: [0, 2, 4, 5] },
      { id: 'kc2', name: 'KC2', asManager: false, midDows: [3, 6] },
    ],
    prefs: {
      avoidClopening: true,
      fairDistribution: true,
      targetWeekendDaysOff: 2,
      kcCloseDays: [1],
    },
  },
  {
    name: 'stability-10x',
    strictFairness: false,
    stabilityRuns: 10,
    amCount: 3,
    days: 35,
    kcList: [
      { id: 'kc1', name: 'Farnaz', asManager: false, midDows: [0, 2, 4, 5] },
      { id: 'kc2', name: 'Faiqa', asManager: false, midDows: [3, 6] },
    ],
    prefs: {
      avoidClopening: true,
      fairDistribution: true,
      targetWeekendDaysOff: 2,
      preferConsecutiveDaysOff: true,
      preferWeekendPackages: true,
      smFewerWeekendOffs: true,
      kcMidWhenNoMid: true,
      kcCloseDays: [1],
    },
    buildInputs: 'p08',
  },
  {
    name: 'max-stacked-hell',
    strictFairness: false,
    allowClopens: true,
    amCount: 3,
    days: 35,
    kcList: [
      { id: 'kc1', name: 'Farnaz', asManager: false, midDows: [0, 2, 4, 5] },
      { id: 'kc2', name: 'Faiqa', asManager: false, midDows: [3, 6] },
    ],
    prefs: {
      avoidClopening: true,
      fairDistribution: true,
      targetWeekendDaysOff: 3,
      preferConsecutiveDaysOff: true,
      preferWeekendPackages: true,
      smFewerWeekendOffs: true,
      kcMidWhenNoMid: true,
      kcCloseDays: [1],
    },
    buildInputs: 'max-hell',
  },
  {
    name: 'only-two-working-many-days',
    strictFairness: false,
    allowClopens: true,
    amCount: 3,
    days: 35,
    kcList: [
      { id: 'kc1', name: 'KC1', asManager: false, midDows: [0, 2, 4] },
      { id: 'kc2', name: 'KC2', asManager: false, midDows: [3, 6] },
    ],
    prefs: {
      avoidClopening: true,
      fairDistribution: true,
      targetWeekendDaysOff: 2,
      kcCloseDays: [1],
    },
    buildInputs: 'only-two',
  },
];

async function main() {
  console.log('\n=== Engine stress suite ===\n');
  const startedAt = new Date().toISOString();
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

  const raw = await page.evaluate((scenarioList) => {
    const results = [];

    function buildDays(startY, startM, startD, n) {
      const days = [];
      for (let i = 0; i < n; i++) {
        days.push(new Date(startY, startM - 1, startD + i));
      }
      return days;
    }

    function emptyInputs(amCount, kcList) {
      const ins = { sm: {} };
      for (let i = 1; i <= Math.max(amCount, 5); i++) ins['am' + i] = {};
      (kcList || []).forEach((kc) => {
        ins[kc.id] = {};
      });
      return ins;
    }

    function buildNamedInputs(kind, periodDates, amCount, kcList) {
      const ins = emptyInputs(amCount, kcList);
      const allDks = periodDates.map(dateKey);

      if (kind === 'p08') {
        allDks.forEach((dk) => {
          if (dk >= '2026-09-13') ins.sm[dk] = 'loa';
        });
        for (const dk of ['2026-09-05', '2026-09-06', '2026-09-12', '2026-09-13']) {
          ins.am3[dk] = 'rto';
        }
        for (const dk of ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11']) {
          ins.am3[dk] = 'pto';
        }
      }

      if (kind === 'dual-loa') {
        // SM LOA first half, am1 LOA second half, slight mid overlap
        const mid = allDks[Math.floor(allDks.length / 2)];
        allDks.forEach((dk, i) => {
          if (i < Math.floor(allDks.length / 2) + 3) ins.sm[dk] = 'loa';
          if (i >= Math.floor(allDks.length / 2) - 3) ins.am1[dk] = 'loa';
        });
      }

      if (kind === 'triple-pto') {
        // Mon-Wed same week (week of 2026-09-07)
        for (const dk of ['2026-09-07', '2026-09-08', '2026-09-09']) {
          ins.am1[dk] = 'pto';
          ins.am2[dk] = 'pto';
          ins.am3[dk] = 'pto';
        }
      }

      if (kind === 'rto-all-weekends') {
        allDks.forEach((dk, i) => {
          const dow = periodDates[i].getDay();
          if (dow === 0 || dow === 6) {
            for (let a = 1; a <= amCount; a++) ins['am' + a][dk] = 'rto';
          }
        });
      }

      if (kind === 'pto-checkerboard') {
        allDks.forEach((dk, i) => {
          if (i % 2 === 0) ins.am1[dk] = 'pto';
        });
      }

      if (kind === 'max-hell') {
        // SM LOA ~3 weeks from 9/13
        allDks.forEach((dk) => {
          if (dk >= '2026-09-13' && dk <= '2026-10-03') ins.sm[dk] = 'loa';
        });
        // am1 LOA 2 weeks
        allDks.forEach((dk) => {
          if (dk >= '2026-09-06' && dk <= '2026-09-19') ins.am1[dk] = 'loa';
        });
        // am2 PTO 5 days
        for (const dk of ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25']) {
          ins.am2[dk] = 'pto';
        }
        // am3 RTO all weekends
        allDks.forEach((dk, i) => {
          const dow = periodDates[i].getDay();
          if (dow === 0 || dow === 6) ins.am3[dk] = 'rto';
        });
      }

      if (kind === 'only-two') {
        // Heavy LOA so often only SM+1 AM available
        allDks.forEach((dk, i) => {
          // am3 LOA entire period
          ins.am3[dk] = 'loa';
          // am2 LOA alternating weeks-ish
          if (i % 14 >= 7) ins.am2[dk] = 'loa';
          // SM LOA last 10 days
          if (i >= allDks.length - 10) ins.sm[dk] = 'loa';
        });
      }

      return ins;
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
      let thinDays = 0;
      let dualManagerCloses = 0;
      let mgrCloseOnKcNight = 0;

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
        if (workers > 0 && workers < 2) thinDays++;
        if (mgrCloses >= 2) dualManagerCloses++;

        const dow = periodDates[i].getDay();
        if (kcCloseDows.includes(dow) && nonMgr.length > 0 && mgrCloses > 0) {
          mgrCloseOnKcNight += mgrCloses;
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

      const amCloseCounts = {};
      const amWeOffs = {};
      AMS.forEach((r) => {
        amCloseCounts[r] = allDks.filter((dk) => {
          const s = schedule[r] && schedule[r][dk];
          return s === 'close' || s === 'close-ext';
        }).length;
        amWeOffs[r] = allDks.filter((dk) => isWE(dk) && isDayOff(schedule[r] && schedule[r][dk])).length;
      });

      // Also SM close count for info
      const smCloses = allDks.filter((dk) => {
        const s = schedule.sm && schedule.sm[dk];
        return s === 'close' || s === 'close-ext';
      }).length;

      const closeVals = Object.values(amCloseCounts);
      const weVals = Object.values(amWeOffs);
      const closeSpread = closeVals.length ? Math.max(...closeVals) - Math.min(...closeVals) : 0;
      const weSpread = weVals.length ? Math.max(...weVals) - Math.min(...weVals) : 0;

      // AMs available most days (for fairness gating)
      let amsAvailableMostDays = true;
      if (AMS.length >= 2) {
        let daysWith2Plus = 0;
        allDks.forEach((dk) => {
          const avail = AMS.filter((r) => {
            const locked = inputs[r] && inputs[r][dk];
            return !(locked === 'loa' || locked === 'pto' || locked === 'rto');
          }).length;
          if (avail >= 2) daysWith2Plus++;
        });
        amsAvailableMostDays = daysWith2Plus >= allDks.length * 0.6;
      }

      return {
        noOpen,
        noClose,
        clopens,
        thinDays,
        dualManagerCloses,
        mgrCloseOnKcNight,
        amCloseCounts,
        amWeOffs,
        smCloses,
        closeSpread,
        weSpread,
        amsAvailableMostDays,
        days: allDks.length,
        roles: ROLES.slice(),
        ams: AMS.slice(),
      };
    }

    function runOnce(sc) {
      const t0 = performance.now();
      setupPeriod(sc.days || 35);
      amCount = sc.amCount != null ? sc.amCount : 3;
      kcList = (sc.kcList || []).map((k) => Object.assign({}, k));

      const ins = sc.buildInputs
        ? buildNamedInputs(sc.buildInputs, periodDates, amCount, kcList)
        : emptyInputs(amCount, kcList);
      inputs = ins;

      preferences = Object.assign({}, DEFAULT_PREFERENCES, sc.prefs || {});
      // Sync UI so readPreferencesFromUI() inside generator keeps our prefs
      if (typeof renderPreferencesUI === 'function') {
        try {
          renderPreferencesUI();
        } catch (e) {}
      }

      schedule = {};
      let error = null;
      try {
        _generateScheduleInner();
      } catch (e) {
        error = String(e && e.message ? e.message : e);
      }
      const ms = Math.round(performance.now() - t0);
      if (error) {
        return {
          error,
          ms,
          noOpen: -1,
          noClose: -1,
          clopens: -1,
          thinDays: -1,
          dualManagerCloses: -1,
          mgrCloseOnKcNight: -1,
          amCloseCounts: {},
          amWeOffs: {},
          smCloses: -1,
          closeSpread: -1,
          weSpread: -1,
          amsAvailableMostDays: false,
          days: sc.days || 35,
        };
      }
      const stats = analyze(preferences);
      stats.ms = ms;
      stats.error = null;
      return stats;
    }

    for (const sc of scenarioList) {
      const entry = {
        name: sc.name,
        strictFairness: !!sc.strictFairness,
        allowClopens: !!sc.allowClopens,
        stabilityRuns: sc.stabilityRuns || 0,
      };

      try {
        if (sc.stabilityRuns && sc.stabilityRuns > 1) {
          const runs = [];
          for (let i = 0; i < sc.stabilityRuns; i++) {
            runs.push(runOnce(sc));
          }
          const first = runs[0];
          // Aggregate: any hard fail across runs
          entry.error = runs.map((r) => r.error).find(Boolean) || null;
          entry.noOpen = Math.max(...runs.map((r) => r.noOpen));
          entry.noClose = Math.max(...runs.map((r) => r.noClose));
          entry.clopens = Math.max(...runs.map((r) => r.clopens));
          entry.thinDays = Math.max(...runs.map((r) => r.thinDays));
          entry.dualManagerCloses = Math.max(...runs.map((r) => r.dualManagerCloses));
          entry.mgrCloseOnKcNight = Math.max(...runs.map((r) => r.mgrCloseOnKcNight));
          entry.amCloseCounts = first.amCloseCounts;
          entry.amWeOffs = first.amWeOffs;
          entry.smCloses = first.smCloses;
          entry.closeSpread = Math.max(...runs.map((r) => r.closeSpread));
          entry.weSpread = Math.max(...runs.map((r) => r.weSpread));
          entry.amsAvailableMostDays = first.amsAvailableMostDays;
          entry.days = first.days;
          entry.ms = runs.reduce((s, r) => s + r.ms, 0);
          entry.msAvg = Math.round(entry.ms / runs.length);

          // Stability of close totals: each AM within ±1 of median across runs
          const ams = Object.keys(first.amCloseCounts || {});
          const closeSeries = {};
          ams.forEach((a) => {
            closeSeries[a] = runs.map((r) => (r.amCloseCounts && r.amCloseCounts[a]) || 0);
          });
          entry.stabilityCloseSeries = closeSeries;
          let stabilityOk = true;
          const stabilityNotes = [];
          ams.forEach((a) => {
            const sorted = [...closeSeries[a]].sort((x, y) => x - y);
            const med = sorted[Math.floor(sorted.length / 2)];
            const maxDev = Math.max(...closeSeries[a].map((v) => Math.abs(v - med)));
            if (maxDev > 1) {
              // Soft: check totals don't explode (max-min of period totals across runs <= 3)
              const span = Math.max(...closeSeries[a]) - Math.min(...closeSeries[a]);
              if (span > 3) {
                stabilityOk = false;
                stabilityNotes.push(`${a} close span=${span} (med=${med})`);
              } else {
                stabilityNotes.push(`${a} close maxDev=${maxDev} span=${span} (soft ok)`);
              }
            }
          });
          entry.stabilityOk = stabilityOk;
          entry.stabilityNotes = stabilityNotes.join('; ') || 'closes stable ±1 of median';
          entry.runs = runs.length;
        } else {
          const stats = runOnce(sc);
          Object.assign(entry, stats);
        }
      } catch (e) {
        entry.error = String(e && e.message ? e.message : e);
        entry.noOpen = -1;
        entry.noClose = -1;
        entry.clopens = -1;
        entry.thinDays = -1;
        entry.dualManagerCloses = -1;
        entry.mgrCloseOnKcNight = -1;
        entry.amCloseCounts = {};
        entry.amWeOffs = {};
        entry.ms = 0;
      }

      results.push(entry);
    }

    return {
      version: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '?',
      results,
    };
  }, SCENARIOS);

  // Evaluate PASS/FAIL/WARN outside the page
  const evaluated = [];
  let passN = 0;
  let failN = 0;
  let warnN = 0;

  for (const r of raw.results) {
    const hard = [];
    const soft = [];
    const info = [];

    const scDef = SCENARIOS.find((s) => s.name === r.name);
    if (r.error) hard.push(`throw: ${r.error}`);
    if (r.noOpen !== 0) {
      if (scDef && scDef.impossibleDualCoverage) soft.push(`noOpen=${r.noOpen} (impossible dual coverage: sole manager, no KC)`);
      else hard.push(`noOpen=${r.noOpen}`);
    }
    if (r.noClose !== 0) {
      if (scDef && scDef.impossibleDualCoverage) soft.push(`noClose=${r.noClose} (impossible dual coverage: sole manager, no KC)`);
      else hard.push(`noClose=${r.noClose}`);
    }
    if ((r.mgrCloseOnKcNight || 0) > 0) hard.push(`mgrCloseOnKcNight=${r.mgrCloseOnKcNight}`);

    // Soft fairness
    const amCount = Object.keys(r.amCloseCounts || {}).length;
    if (amCount >= 2 && r.amsAvailableMostDays !== false) {
      if ((r.closeSpread || 0) > 2) {
        const msg = `AM close spread=${r.closeSpread} ${JSON.stringify(r.amCloseCounts)}`;
        if (r.strictFairness) soft.push(msg);
        else info.push(msg);
      }
      // weekend spread only under non-extreme targets — scenarios with target 4 / RTO hell skip
      const extremeWe =
        /all-want-weekends|rto-every|max-stacked|only-two|triple-pto|dual-loa|pto-checkerboard|sm-plus-one|sole-manager/.test(
          r.name
        );
      if (!extremeWe && (r.weSpread || 0) > 2) {
        const msg = `AM weekend-off spread=${r.weSpread} ${JSON.stringify(r.amWeOffs)}`;
        if (r.strictFairness) soft.push(msg);
        else info.push(msg);
      }
    }

    // Clopens
    if ((r.clopens || 0) > 0) {
      const sc = SCENARIOS.find((s) => s.name === r.name);
      const avoidOn = sc && sc.prefs && sc.prefs.avoidClopening !== false;
      if (avoidOn && !r.allowClopens) {
        const msg = `clopens=${r.clopens} (avoidClopening)`;
        if (r.strictFairness) soft.push(msg);
        else info.push(msg);
      } else {
        info.push(`clopens=${r.clopens}`);
      }
    }

    if (r.stabilityRuns && r.stabilityOk === false) {
      soft.push(`stability: ${r.stabilityNotes}`);
    } else if (r.stabilityNotes) {
      info.push(`stability: ${r.stabilityNotes}`);
    }

    let status = 'PASS';
    if (hard.length) status = 'FAIL';
    else if (soft.length) status = 'WARN';

    if (status === 'PASS') passN++;
    else if (status === 'FAIL') failN++;
    else warnN++;

    const detailParts = [];
    if (hard.length) detailParts.push('HARD: ' + hard.join('; '));
    if (soft.length) detailParts.push('SOFT: ' + soft.join('; '));
    detailParts.push(
      `noOpen=${r.noOpen} noClose=${r.noClose} clopens=${r.clopens} thin=${r.thinDays} dualMgrCloseDays=${r.dualManagerCloses} mgrOnKc=${r.mgrCloseOnKcNight} ms=${r.msAvg != null ? r.msAvg + 'avg' : r.ms}`
    );
    if (Object.keys(r.amCloseCounts || {}).length) {
      detailParts.push(`closes=${JSON.stringify(r.amCloseCounts)}`);
    }
    if (Object.keys(r.amWeOffs || {}).length) {
      detailParts.push(`weOff=${JSON.stringify(r.amWeOffs)}`);
    }
    if (info.length) detailParts.push('info: ' + info.join('; '));

    const line = `${status} ${r.name} — ${detailParts.join(' | ')}`;
    console.log('  ' + line);

    evaluated.push({
      name: r.name,
      status,
      hard,
      soft,
      info,
      stats: {
        noOpen: r.noOpen,
        noClose: r.noClose,
        clopens: r.clopens,
        thinDays: r.thinDays,
        dualManagerCloses: r.dualManagerCloses,
        mgrCloseOnKcNight: r.mgrCloseOnKcNight,
        amCloseCounts: r.amCloseCounts,
        amWeOffs: r.amWeOffs,
        smCloses: r.smCloses,
        closeSpread: r.closeSpread,
        weSpread: r.weSpread,
        days: r.days,
        ms: r.ms,
        msAvg: r.msAvg,
        error: r.error,
        stabilityOk: r.stabilityOk,
        stabilityNotes: r.stabilityNotes,
        stabilityCloseSeries: r.stabilityCloseSeries,
      },
    });
  }

  await browser.close();
  server.close();

  // Worst scenarios (info)
  const byClopens = [...evaluated]
    .filter((e) => e.stats.clopens >= 0)
    .sort((a, b) => b.stats.clopens - a.stats.clopens);
  const byCloseSpread = [...evaluated]
    .filter((e) => e.stats.closeSpread >= 0)
    .sort((a, b) => b.stats.closeSpread - a.stats.closeSpread);

  const finishedAt = new Date().toISOString();
  const report = {
    title: 'Schedule Pro Engine Stress Test',
    version: raw.version,
    startedAt,
    finishedAt,
    base,
    summary: {
      pass: passN,
      fail: failN,
      warn: warnN,
      total: evaluated.length,
    },
    hardCriteria: [
      'noOpen === 0 every day',
      'noClose === 0 every day (manager open/close + non-mgr kc-close)',
      'generator does not throw',
      'mgrCloseOnKcNight === 0 when kcCloseDays set and non-mgr KCs exist',
    ],
    softCriteria: [
      'AM close period max-min <= 2 when >=2 AMs available most days (strictFairness scenarios assert)',
      'AM weekend off max-min <= 2 under non-extreme weekend targets (strictFairness)',
      'Clopens: 0 when avoidClopening and not allowClopens (strictFairness WARN)',
    ],
    scenarios: evaluated,
    worst: {
      highestClopens: byClopens.slice(0, 5).map((e) => ({
        name: e.name,
        clopens: e.stats.clopens,
        status: e.status,
      })),
      worstCloseSpread: byCloseSpread.slice(0, 5).map((e) => ({
        name: e.name,
        closeSpread: e.stats.closeSpread,
        amCloseCounts: e.stats.amCloseCounts,
        status: e.status,
      })),
    },
    engineFixes: [
      'v2.5.4 ensureHardDailyCoverage: sole closer → open when emergency non-mgr KC can take kc-close (or prefer open if truly sole).',
      'v2.5.4 Emergency kc-close on understaffed non-template nights (not only configured kcCloseDays).',
      'v2.5.4 repairViolations coverage-open/close: same sole-closer + emergency KC logic; never steal sole opener for close.',
      'sole-manager (amCount 0, no KC): dual open+close is mathematically impossible; residual noClose documented as WARN via impossibleDualCoverage.',
    ],
  };

  // Write JSON + MD
  const jsonPath = join(__dirname, 'STRESS_TEST_REPORT.json');
  const mdPath = join(__dirname, 'STRESS_TEST_REPORT.md');
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const md = [];
  md.push('# Schedule Pro Engine Stress Test Report');
  md.push('');
  md.push(`Generated: ${finishedAt}`);
  md.push(`Engine version: **${raw.version}**`);
  md.push(`Base: \`${base}\` (local repo-root static server)`);
  md.push('');
  md.push('## Summary');
  md.push('');
  md.push('| Result | Count |');
  md.push('|--------|------:|');
  md.push(`| PASS   | ${passN} |`);
  md.push(`| WARN   | ${warnN} |`);
  md.push(`| FAIL   | ${failN} |`);
  md.push(`| Total  | ${evaluated.length} |`);
  md.push('');
  md.push('Exit code is **1 only on FAIL** (hard coverage / throw / manager close on KC night). WARNs do not fail.');
  md.push('');
  md.push('## Hard criteria');
  md.push('');
  report.hardCriteria.forEach((c) => md.push(`- ${c}`));
  md.push('');
  md.push('## Soft criteria');
  md.push('');
  report.softCriteria.forEach((c) => md.push(`- ${c}`));
  md.push('');
  md.push('## Scenarios');
  md.push('');
  md.push('| Scenario | Status | noOpen | noClose | clopens | thin | closeSpread | weSpread | ms |');
  md.push('|----------|--------|-------:|--------:|--------:|-----:|------------:|---------:|---:|');
  for (const e of evaluated) {
    const s = e.stats;
    md.push(
      `| ${e.name} | ${e.status} | ${s.noOpen} | ${s.noClose} | ${s.clopens} | ${s.thinDays} | ${s.closeSpread} | ${s.weSpread} | ${s.msAvg != null ? s.msAvg : s.ms} |`
    );
  }
  md.push('');
  md.push('## Failures');
  md.push('');
  const fails = evaluated.filter((e) => e.status === 'FAIL');
  if (!fails.length) md.push('None.');
  else {
    fails.forEach((e) => {
      md.push(`### ${e.name}`);
      md.push('');
      md.push(`- Hard: ${e.hard.join('; ') || '—'}`);
      md.push(`- Stats: \`${JSON.stringify(e.stats)}\``);
      md.push('');
    });
  }
  md.push('');
  md.push('## Warnings');
  md.push('');
  const warns = evaluated.filter((e) => e.status === 'WARN');
  if (!warns.length) md.push('None.');
  else {
    warns.forEach((e) => {
      md.push(`- **${e.name}**: ${e.soft.join('; ')}`);
    });
  }
  md.push('');
  md.push('## Worst scenarios (info)');
  md.push('');
  md.push('### Highest clopens');
  md.push('');
  report.worst.highestClopens.forEach((w) => {
    md.push(`- ${w.name}: clopens=${w.clopens} (${w.status})`);
  });
  md.push('');
  md.push('### Worst AM close spread');
  md.push('');
  report.worst.worstCloseSpread.forEach((w) => {
    md.push(
      `- ${w.name}: spread=${w.closeSpread} ${JSON.stringify(w.amCloseCounts)} (${w.status})`
    );
  });
  md.push('');
  md.push('## Engine fixes from this run');
  md.push('');
  md.push(report.engineFixes.length ? report.engineFixes.join('\n') : 'None (no hard coverage failures requiring engine changes).');
  md.push('');
  md.push('## How to re-run');
  md.push('');
  md.push('```bash');
  md.push('node tests/test-stress-engine.mjs');
  md.push('```');
  md.push('');

  writeFileSync(mdPath, md.join('\n'));

  console.log(`\n${passN} PASS / ${warnN} WARN / ${failN} FAIL  (of ${evaluated.length})`);
  console.log(`Report: ${mdPath}`);
  console.log(`JSON:   ${jsonPath}`);

  if (failN > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
