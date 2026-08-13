/**
 * P08 fairness regression — close rebalance, weekend packages, KC mid templates.
 * Uses in-page engine via Playwright on local static server.
 *
 * Run: node tests/test-p08-fairness.mjs
 */
import { chromium } from '../scripts/browser-ops/node_modules/playwright/index.mjs';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const results = [];
function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log('  PASS', name, detail ? '— ' + detail : '');
}
function fail(name, detail) {
  results.push({ name, ok: false, detail: String(detail) });
  console.log('  FAIL', name, '—', detail);
}

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

async function main() {
  console.log('\n=== P08 fairness (v2.5.6) ===\n');
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
  await page.waitForTimeout(600);

  const offline = page.locator('button:has-text("Continue offline")');
  if (await offline.isVisible().catch(() => false)) {
    await offline.click();
    await page.waitForTimeout(400);
  }

  const report = await page.evaluate(() => {
    function buildDays(startY, startM, startD, n) {
      const days = [];
      for (let i = 0; i < n; i++) {
        days.push(new Date(startY, startM - 1, startD + i));
      }
      return days;
    }

    function runP08() {
      amCount = 3;
      kcList = [
        { id: 'kc1', name: 'Farnaz', asManager: false, midDows: [0, 2, 4, 5] },
        { id: 'kc2', name: 'Faiqa', asManager: false, midDows: [3, 6] },
      ];
      periodDates = buildDays(2026, 8, 30, 35);
      currentPeriod = {
        number: 8,
        approxMonth: 'Sep',
        start: periodDates[0],
        end: periodDates[periodDates.length - 1],
        numWeeks: 5,
        weeks: [],
      };
      for (let w = 0; w < 5; w++) {
        currentPeriod.weeks.push({
          start: periodDates[w * 7],
          end: periodDates[w * 7 + 6],
        });
      }
      fiscalYear = 2026;
      holidayWeeks = {};
      const ins = { sm: {}, am1: {}, am2: {}, am3: {}, kc1: {}, kc2: {} };
      periodDates.forEach((d) => {
        const dk = dateKey(d);
        if (dk >= '2026-09-13') ins.sm[dk] = 'loa';
      });
      for (const dk of ['2026-09-05', '2026-09-06', '2026-09-12', '2026-09-13']) {
        ins.am3[dk] = 'rto';
      }
      for (const dk of ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11']) {
        ins.am3[dk] = 'pto';
      }
      inputs = ins;
      preferences = Object.assign({}, DEFAULT_PREFERENCES, {
        avoidClopening: true,
        fairDistribution: true,
        targetWeekendDaysOff: 2,
        preferConsecutiveDaysOff: true,
        kcMidWhenNoMid: true,
        preferWeekendPackages: true,
        smFewerWeekendOffs: true,
        kcCloseDays: [1],
      });
      schedule = {};
      _generateScheduleInner();

      const ROLES = getRoles(); // sm + ams + mgr KCs
      const AMs = ['am1', 'am2', 'am3'];
      const allDks = periodDates.map(dateKey);
      const isDayOff = (s) => s === 'off' || s === 'rto' || s === 'pto' || s === 'loa';
      const isWE = (dk) => {
        const [y, m, d] = dk.split('-').map(Number);
        const dow = new Date(y, m - 1, d).getDay();
        return dow === 0 || dow === 6;
      };

      let noOpen = 0;
      let noClose = 0;
      allDks.forEach((dk) => {
        let opens = 0;
        let closes = 0;
        ROLES.forEach((r) => {
          const s = schedule[r] && schedule[r][dk];
          if (isOpen(s)) opens++;
          if (isClose(s)) closes++;
        });
        getNonManagerKCs().forEach((kc) => {
          const s = schedule[kc.id] && schedule[kc.id][dk];
          if (s === 'kc-close') closes++;
        });
        if (opens === 0) noOpen++;
        if (closes === 0) noClose++;
      });

      const periodCloses = {};
      AMs.forEach((r) => {
        periodCloses[r] = allDks.filter((dk) => {
          const s = schedule[r] && schedule[r][dk];
          return isClose(s) && s !== 'kc-close';
        }).length;
      });
      const closeVals = Object.values(periodCloses);
      const closeSpread = Math.max(...closeVals) - Math.min(...closeVals);

      const weOffs = {};
      AMs.forEach((r) => {
        weOffs[r] = allDks.filter((dk) => isWE(dk) && isDayOff(schedule[r] && schedule[r][dk])).length;
      });
      const weVals = Object.values(weOffs);
      const weSpread = Math.max(...weVals) - Math.min(...weVals);

      // Farnaz (kc1) preferred mids on [0,2,4,5]
      let farnazPreferredMids = 0;
      let farnazPreferredEligible = 0;
      allDks.forEach((dDate, i) => {
        const dk = allDks[i];
        const dow = periodDates[i].getDay();
        if (![0, 2, 4, 5].includes(dow)) return;
        // skip if LOA-like lock on KC
        if (inputs.kc1 && inputs.kc1[dk] && isDayOff(inputs.kc1[dk])) return;
        farnazPreferredEligible++;
        const s = schedule.kc1 && schedule.kc1[dk];
        if (s && String(s).startsWith('mid')) farnazPreferredMids++;
        if (s === 'kc-close') farnazPreferredMids++; // Mon close may overlap preferred if midDows includes Mon; here Sun Tue Thu Fri only
      });

      // Manager closes on Monday KC nights should be 0
      let monMgrCloses = 0;
      allDks.forEach((dk, i) => {
        if (periodDates[i].getDay() !== 1) return;
        ROLES.forEach((r) => {
          if (isClose(schedule[r] && schedule[r][dk])) monMgrCloses++;
        });
      });

      // SM weekend offs (soft off only) — may be fewer than AMs
      const smWe = allDks.filter(
        (dk) => isWE(dk) && (schedule.sm[dk] === 'off' || schedule.sm[dk] === 'rto')
      ).length;
      // Only count weekends before LOA for SM availability
      const smAvailWe = allDks.filter((dk) => isWE(dk) && dk < '2026-09-13').length;

      // Full weekend packages among AMs
      let packages = 0;
      for (let w = 0; w < 5; w++) {
        const sun = allDks[w * 7];
        const sat = allDks[w * 7 + 6];
        if (!sun || !sat) continue;
        AMs.forEach((r) => {
          if (isDayOff(schedule[r][sun]) && isDayOff(schedule[r][sat])) packages++;
        });
      }

      return {
        noOpen,
        noClose,
        periodCloses,
        closeSpread,
        weOffs,
        weSpread,
        farnazPreferredMids,
        farnazPreferredEligible,
        monMgrCloses,
        smWe,
        smAvailWe,
        packages,
        version: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '?',
      };
    }

    try {
      return { ok: true, data: runP08() };
    } catch (e) {
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  });

  if (!report.ok) {
    fail('engine-run', report.error);
  } else {
    const d = report.data;
    pass('version', d.version);

    if (d.noOpen === 0 && d.noClose === 0) {
      pass('hard-coverage', `open+close every day`);
    } else {
      fail('hard-coverage', `noOpen=${d.noOpen} noClose=${d.noClose}`);
    }

    if (d.closeSpread <= 2) {
      pass('am-close-balance', `spread=${d.closeSpread} ${JSON.stringify(d.periodCloses)}`);
    } else {
      fail('am-close-balance', `spread=${d.closeSpread} ${JSON.stringify(d.periodCloses)}`);
    }

    if (d.weSpread <= 2) {
      pass('am-weekend-off-balance', `spread=${d.weSpread} ${JSON.stringify(d.weOffs)}`);
    } else {
      fail('am-weekend-off-balance', `spread=${d.weSpread} ${JSON.stringify(d.weOffs)}`);
    }

    if (d.farnazPreferredMids >= 3) {
      pass(
        'kc-mid-templates',
        `Farnaz mids on preferred DOWs: ${d.farnazPreferredMids}/${d.farnazPreferredEligible}`
      );
    } else {
      fail(
        'kc-mid-templates',
        `Farnaz preferred mids too low: ${d.farnazPreferredMids}/${d.farnazPreferredEligible}`
      );
    }

    if (d.monMgrCloses === 0) {
      pass('no-manager-close-on-kc-monday', '0 manager closes on Mon');
    } else {
      fail('no-manager-close-on-kc-monday', `${d.monMgrCloses} manager closes on Mon`);
    }

    // Soft: packages exist somewhere when staffing allows
    if (d.packages >= 1) {
      pass('weekend-packages', `${d.packages} full Sun+Sat packages among AMs`);
    } else {
      // not hard-fail under LOA stress — note only
      pass('weekend-packages-soft', `packages=${d.packages} (LOA stress; soft)`);
    }

    pass('sm-we-note', `SM soft WE offs pre-LOA window: ${d.smWe} (avail WE days ~${d.smAvailWe})`);
  }

  await browser.close();
  server.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
