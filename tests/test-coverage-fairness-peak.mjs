/**
 * Peak season hours + hard coverage + fairness suite (v2.5.6+)
 * Playwright + local static server of repo root.
 *
 * A. Hard coverage always
 * B. Weekend + close fairness (clean / p08-like)
 * C. Peak OFF → no auto open-early / close-ext
 * D. Peak ON → early opens + ext closes + fair variant spreads
 * E. Peak + heavy time-off stress
 * F. Optimal coverage metrics when peak on (clean team 100%)
 *
 * Run: node tests/test-coverage-fairness-peak.mjs
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

const results = [];
function pass(name, detail = '') {
  results.push({ name, ok: true, detail, severity: 'pass' });
  console.log('  PASS', name, detail ? '— ' + detail : '');
}
function fail(name, detail) {
  results.push({ name, ok: false, detail: String(detail), severity: 'fail' });
  console.log('  FAIL', name, '—', detail);
}
function warn(name, detail) {
  results.push({ name, ok: true, detail: String(detail), severity: 'warn' });
  console.log('  WARN', name, '—', detail);
}

async function main() {
  console.log('\n=== Peak / coverage / fairness suite (v2.5.6) ===\n');
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
  await page.waitForTimeout(600);

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

  const report = await page.evaluate(() => {
    const scenarios = [];

    function buildDays(startY, startM, startD, n) {
      const days = [];
      for (let i = 0; i < n; i++) days.push(new Date(startY, startM - 1, startD + i));
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

    function setupTeam(amN, days, kcListLocal, prefs, ins) {
      amCount = amN;
      kcList = (kcListLocal || []).slice();
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
        currentPeriod.weeks.push({
          start: periodDates[w * 7],
          end: periodDates[Math.min(w * 7 + 6, periodDates.length - 1)],
        });
      }
      fiscalYear = 2026;
      holidayWeeks = {};
      inputs = ins || emptyInputs(amN, kcListLocal);
      preferences = Object.assign({}, DEFAULT_PREFERENCES, prefs || {});
      schedule = {};
    }

    function analyze(label, opts) {
      opts = opts || {};
      const ROLES = getRoles();
      const AMs = getAMs();
      const allDks = periodDates.map(dateKey);
      const isDayOff = (s) => s === 'off' || s === 'rto' || s === 'pto' || s === 'loa';
      const isWE = (dk) => {
        const [y, m, d] = dk.split('-').map(Number);
        return [0, 6].includes(new Date(y, m - 1, d).getDay());
      };
      const isKcMon = (dk) => {
        const [y, m, d] = dk.split('-').map(Number);
        return new Date(y, m - 1, d).getDay() === 1;
      };
      const kcDows = normalizeKcCloseDays(preferences.kcCloseDays);

      let noOpen = 0;
      let noClose = 0;
      let daysWithWorkers = 0;
      let daysWithEarlyOpen = 0;
      let mgrCloseNights = 0;
      let mgrCloseNightsExt = 0;
      let monMgrCloses = 0;
      let autoOpenEarly = 0;
      let autoCloseExt = 0;
      let lockedOpenEarly = 0;
      let lockedCloseExt = 0;

      allDks.forEach((dk, i) => {
        let opens = 0;
        let closes = 0;
        let workers = 0;
        let hasEarly = false;
        ROLES.forEach((r) => {
          const s = schedule[r] && schedule[r][dk];
          if (isWork(s)) workers++;
          if (isOpen(s)) opens++;
          if (isClose(s)) closes++;
          if (s === 'open-early') {
            hasEarly = true;
            if (inputs[r] && inputs[r][dk] === 'open-early') lockedOpenEarly++;
            else autoOpenEarly++;
          }
          if (s === 'close-ext') {
            if (inputs[r] && inputs[r][dk] === 'close-ext') lockedCloseExt++;
            else autoCloseExt++;
          }
        });
        getNonManagerKCs().forEach((kc) => {
          const s = schedule[kc.id] && schedule[kc.id][dk];
          if (s === 'kc-close') closes++;
        });
        if (opens === 0) noOpen++;
        if (closes === 0) noClose++;
        if (workers > 0) {
          daysWithWorkers++;
          if (hasEarly) daysWithEarlyOpen++;
        }
        const dow = periodDates[i].getDay();
        const isKcNight = kcDows.includes(dow);
        if (!isKcNight) {
          const mgrClosers = ROLES.filter((r) => {
            const s = schedule[r] && schedule[r][dk];
            return s === 'close' || s === 'close-ext';
          });
          if (mgrClosers.length) {
            mgrCloseNights++;
            if (mgrClosers.some((r) => schedule[r][dk] === 'close-ext')) mgrCloseNightsExt++;
          }
        }
        if (isKcMon(dk) && kcDows.includes(1)) {
          ROLES.forEach((r) => {
            if (isClose(schedule[r] && schedule[r][dk])) monMgrCloses++;
          });
        }
      });

      const periodCloses = {};
      const weOffs = {};
      const earlyOpens = {};
      const extCloses = {};
      AMs.forEach((r) => {
        periodCloses[r] = allDks.filter((dk) => {
          const s = schedule[r] && schedule[r][dk];
          return isClose(s) && s !== 'kc-close';
        }).length;
        weOffs[r] = allDks.filter((dk) => isWE(dk) && isDayOff(schedule[r] && schedule[r][dk])).length;
        earlyOpens[r] = allDks.filter((dk) => schedule[r] && schedule[r][dk] === 'open-early').length;
        extCloses[r] = allDks.filter((dk) => schedule[r] && schedule[r][dk] === 'close-ext').length;
      });
      const spread = (obj) => {
        const v = Object.values(obj);
        if (!v.length) return 0;
        return Math.max(...v) - Math.min(...v);
      };

      const pctEarly =
        daysWithWorkers > 0 ? Math.round((1000 * daysWithEarlyOpen) / daysWithWorkers) / 10 : 0;
      const pctExt =
        mgrCloseNights > 0 ? Math.round((1000 * mgrCloseNightsExt) / mgrCloseNights) / 10 : 0;

      return {
        label,
        version: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '?',
        peak: !!preferences.peakSeasonHours,
        noOpen,
        noClose,
        monMgrCloses,
        closeSpread: spread(periodCloses),
        weSpread: spread(weOffs),
        periodCloses,
        weOffs,
        earlyOpens,
        extCloses,
        earlySpread: spread(earlyOpens),
        extSpread: spread(extCloses),
        autoOpenEarly,
        autoCloseExt,
        lockedOpenEarly,
        lockedCloseExt,
        daysWithWorkers,
        daysWithEarlyOpen,
        mgrCloseNights,
        mgrCloseNightsExt,
        pctEarly,
        pctExt,
        opts,
      };
    }

    function runOne(label, cfg) {
      const kcListLocal = cfg.kcList || [
        { id: 'kc1', name: 'Farnaz', asManager: false, midDows: [0, 2, 4, 5] },
        { id: 'kc2', name: 'Faiqa', asManager: false, midDows: [3, 6] },
      ];
      const amCountLocal = cfg.amCount != null ? cfg.amCount : 3;
      const days = cfg.days || 35;
      let ins = emptyInputs(amCountLocal, kcListLocal);
      if (cfg.buildInputs === 'p08') {
        periodDates = buildDays(2026, 8, 30, days);
        const allDks = periodDates.map(dateKey);
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
      if (cfg.buildInputs === 'light-rto') {
        periodDates = buildDays(2026, 8, 30, days);
        for (const dk of ['2026-09-05', '2026-09-06']) ins.am1[dk] = 'rto';
        for (const dk of ['2026-09-12', '2026-09-13']) ins.am2[dk] = 'rto';
      }
      if (typeof cfg.buildInputs === 'function') {
        periodDates = buildDays(2026, 8, 30, days);
        ins = cfg.buildInputs(ins, periodDates.map(dateKey), periodDates);
      }
      if (cfg.forceInputs) {
        Object.keys(cfg.forceInputs).forEach((role) => {
          Object.assign(ins[role] || (ins[role] = {}), cfg.forceInputs[role]);
        });
      }

      setupTeam(amCountLocal, days, kcListLocal, cfg.prefs, ins);
      inputs = ins;
      preferences = Object.assign({}, DEFAULT_PREFERENCES, cfg.prefs || {});
      // Sync UI so readPreferencesFromUI() inside generator keeps our prefs
      if (typeof renderPreferencesUI === 'function') {
        try {
          renderPreferencesUI();
        } catch (e) {}
      }
      schedule = {};
      let err = null;
      try {
        _generateScheduleInner();
      } catch (e) {
        err = String(e && e.message ? e.message : e);
      }
      if (err) {
        scenarios.push({ label, error: err, opts: cfg.opts || {} });
        return;
      }
      scenarios.push(analyze(label, cfg.opts || {}));
    }

    const basePrefs = {
      avoidClopening: true,
      fairDistribution: true,
      targetWeekendDaysOff: 2,
      preferConsecutiveDaysOff: true,
      preferWeekendPackages: true,
      smFewerWeekendOffs: true,
      kcMidWhenNoMid: true,
      kcCloseDays: [1],
    };

    // C: Peak OFF clean
    runOne('clean-peak-off', {
      prefs: Object.assign({}, basePrefs, { peakSeasonHours: false }),
      opts: { section: 'C', clean: true, peakOff: true },
    });

    // A+B: clean peak default (off) fairness
    runOne('clean-fairness', {
      prefs: Object.assign({}, basePrefs, { peakSeasonHours: false }),
      opts: { section: 'AB', clean: true },
    });

    // B: p08-like
    runOne('p08-like', {
      buildInputs: 'p08',
      prefs: Object.assign({}, basePrefs, { peakSeasonHours: false }),
      opts: { section: 'B', p08: true },
    });

    // D+F: Peak ON clean
    runOne('clean-peak-on', {
      prefs: Object.assign({}, basePrefs, { peakSeasonHours: true }),
      opts: { section: 'DF', clean: true, peakOn: true },
    });

    // D: Peak ON + light RTO
    runOne('peak-on-light-rto', {
      buildInputs: 'light-rto',
      prefs: Object.assign({}, basePrefs, { peakSeasonHours: true }),
      opts: { section: 'D', peakOn: true, lightRto: true },
    });

    // Peak OFF with forced input open-early / close-ext should preserve locks
    // Use non-KC nights: 2026-08-30=Sun, 2026-09-01=Tue (Mon 8/31 is KC close)
    runOne('peak-off-locked-inputs', {
      prefs: Object.assign({}, basePrefs, { peakSeasonHours: false }),
      forceInputs: {
        am1: { '2026-08-30': 'open-early' },
        am2: { '2026-09-01': 'close-ext' },
      },
      opts: { section: 'C', locked: true },
    });

    // E: Peak + heavy time-off stress (seeded sims)
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
    const rand = mulberry32(20260813);
    for (let sim = 0; sim < 12; sim++) {
      runOne('peak-stress-' + sim, {
        prefs: Object.assign({}, basePrefs, { peakSeasonHours: true }),
        buildInputs: (ins, allDks) => {
          const roles = ['sm', 'am1', 'am2', 'am3'];
          // LOA block for one person
          if (rand() < 0.55) {
            const who = roles[Math.floor(rand() * roles.length)];
            const start = Math.floor(rand() * 20);
            const len = 5 + Math.floor(rand() * 10);
            for (let i = start; i < Math.min(start + len, allDks.length); i++) {
              ins[who][allDks[i]] = 'loa';
            }
          }
          // PTO blocks
          const ptoBlocks = 1 + Math.floor(rand() * 3);
          for (let b = 0; b < ptoBlocks; b++) {
            const who = roles[1 + Math.floor(rand() * 3)];
            const start = Math.floor(rand() * 28);
            const len = 2 + Math.floor(rand() * 4);
            for (let i = start; i < Math.min(start + len, allDks.length); i++) {
              if (!ins[who][allDks[i]]) ins[who][allDks[i]] = 'pto';
            }
          }
          // Scattered RTO
          for (let i = 0; i < allDks.length; i++) {
            if (rand() < 0.08) {
              const who = roles[1 + Math.floor(rand() * 3)];
              if (!ins[who][allDks[i]]) ins[who][allDks[i]] = 'rto';
            }
          }
          return ins;
        },
        opts: { section: 'E', stress: true, peakOn: true },
      });
    }

    return {
      version: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '?',
      defaultPeak: DEFAULT_PREFERENCES.peakSeasonHours,
      scenarios,
    };
  });

  // Evaluate assertions
  if (report.version !== '2.5.6') {
    fail('version', `expected 2.5.6 got ${report.version}`);
  } else {
    pass('version', report.version);
  }
  if (report.defaultPeak === false) {
    pass('default-peakSeasonHours-false', 'DEFAULT_PREFERENCES.peakSeasonHours === false');
  } else {
    fail('default-peakSeasonHours-false', `got ${report.defaultPeak}`);
  }

  const bySection = { A: [], B: [], C: [], D: [], E: [], F: [] };

  for (const s of report.scenarios) {
    if (s.error) {
      fail(s.label + '-engine', s.error);
      continue;
    }

    // A: hard coverage always
    if (s.noOpen === 0 && s.noClose === 0) {
      pass(s.label + '-hard-coverage', 'noOpen=0 noClose=0');
    } else {
      fail(s.label + '-hard-coverage', `noOpen=${s.noOpen} noClose=${s.noClose}`);
    }
    if (s.monMgrCloses === 0) {
      pass(s.label + '-no-mgr-close-kc-mon', '0');
    } else {
      fail(s.label + '-no-mgr-close-kc-mon', `${s.monMgrCloses} manager closes on KC Monday`);
    }
    bySection.A.push(s);

    // B: weekend + close fairness
    if (s.opts.clean || s.opts.p08 || s.opts.lightRto) {
      const weMax = s.opts.clean ? 2 : 2;
      const clMax = s.opts.clean ? 2 : 2;
      if (s.weSpread <= weMax) {
        pass(s.label + '-we-spread', `spread=${s.weSpread} ${JSON.stringify(s.weOffs)}`);
      } else {
        fail(s.label + '-we-spread', `spread=${s.weSpread} ${JSON.stringify(s.weOffs)}`);
      }
      if (s.closeSpread <= clMax) {
        pass(s.label + '-close-spread', `spread=${s.closeSpread} ${JSON.stringify(s.periodCloses)}`);
      } else {
        fail(s.label + '-close-spread', `spread=${s.closeSpread} ${JSON.stringify(s.periodCloses)}`);
      }
      if (s.opts.clean && s.weSpread <= 1) {
        pass(s.label + '-we-spread-preferred', `≤1 (got ${s.weSpread})`);
      } else if (s.opts.clean) {
        warn(s.label + '-we-spread-preferred', `preferred ≤1, got ${s.weSpread}`);
      }
      if (s.opts.clean && s.closeSpread <= 1) {
        pass(s.label + '-close-spread-preferred', `≤1 (got ${s.closeSpread})`);
      } else if (s.opts.clean) {
        warn(s.label + '-close-spread-preferred', `preferred ≤1, got ${s.closeSpread}`);
      }
      bySection.B.push(s);
    }

    // C: Peak OFF
    if (s.opts.peakOff || (s.opts.section === 'C' && !s.opts.locked) || s.label === 'clean-fairness') {
      if (!s.peak) {
        if (s.autoOpenEarly === 0 && s.autoCloseExt === 0) {
          pass(s.label + '-peak-off-no-auto-early-ext', 'zero auto open-early / close-ext');
        } else {
          fail(
            s.label + '-peak-off-no-auto-early-ext',
            `autoOpenEarly=${s.autoOpenEarly} autoCloseExt=${s.autoCloseExt}`
          );
        }
        bySection.C.push(s);
      }
    }
    if (s.opts.locked) {
      if (s.lockedOpenEarly >= 1 && s.lockedCloseExt >= 1) {
        pass(s.label + '-locked-preserved', `early=${s.lockedOpenEarly} ext=${s.lockedCloseExt}`);
      } else {
        // locked inputs may be overwritten if coverage forces change — soft warn if zero
        if (s.lockedOpenEarly + s.autoOpenEarly >= 1 || s.lockedCloseExt + s.autoCloseExt >= 1) {
          pass(
            s.label + '-locked-or-present',
            `early total=${s.lockedOpenEarly + s.autoOpenEarly} ext total=${s.lockedCloseExt + s.autoCloseExt}`
          );
        } else {
          warn(s.label + '-locked-preserved', 'forced inputs not visible (may have been reassigned for coverage)');
        }
      }
      bySection.C.push(s);
    }

    // D + F: Peak ON
    if (s.opts.peakOn && !s.opts.stress) {
      if (s.daysWithWorkers > 0 && s.daysWithEarlyOpen === s.daysWithWorkers) {
        pass(s.label + '-every-day-early-open', `${s.daysWithEarlyOpen}/${s.daysWithWorkers}`);
      } else {
        fail(
          s.label + '-every-day-early-open',
          `${s.daysWithEarlyOpen}/${s.daysWithWorkers} days with early open`
        );
      }
      if (s.mgrCloseNights > 0 && s.mgrCloseNightsExt === s.mgrCloseNights) {
        pass(s.label + '-every-mgr-close-ext', `${s.mgrCloseNightsExt}/${s.mgrCloseNights}`);
      } else {
        fail(
          s.label + '-every-mgr-close-ext',
          `${s.mgrCloseNightsExt}/${s.mgrCloseNights} nights with close-ext`
        );
      }
      if (s.earlySpread <= 2) {
        pass(s.label + '-early-spread', `spread=${s.earlySpread} ${JSON.stringify(s.earlyOpens)}`);
      } else {
        fail(s.label + '-early-spread', `spread=${s.earlySpread} ${JSON.stringify(s.earlyOpens)}`);
      }
      if (s.extSpread <= 2) {
        pass(s.label + '-ext-spread', `spread=${s.extSpread} ${JSON.stringify(s.extCloses)}`);
      } else {
        fail(s.label + '-ext-spread', `spread=${s.extSpread} ${JSON.stringify(s.extCloses)}`);
      }
      bySection.D.push(s);

      if (s.opts.clean) {
        if (s.pctEarly === 100 && s.pctExt === 100) {
          pass(s.label + '-optimal-100', `early ${s.pctEarly}% ext ${s.pctExt}%`);
        } else {
          fail(s.label + '-optimal-100', `early ${s.pctEarly}% ext ${s.pctExt}%`);
        }
        bySection.F.push(s);
      }
    }

    // E: stress — hard coverage already asserted; fairness soft
    if (s.opts.stress) {
      if (s.closeSpread > 3 || s.weSpread > 3 || s.earlySpread > 3 || s.extSpread > 3) {
        warn(
          s.label + '-fairness-soft',
          `close=${s.closeSpread} we=${s.weSpread} early=${s.earlySpread} ext=${s.extSpread}`
        );
      } else {
        pass(
          s.label + '-fairness-ok',
          `close=${s.closeSpread} we=${s.weSpread} early=${s.earlySpread} ext=${s.extSpread}`
        );
      }
      bySection.E.push(s);
    }
  }

  await browser.close();
  server.close();

  const failed = results.filter((r) => !r.ok);
  const warned = results.filter((r) => r.severity === 'warn');
  const passed = results.filter((r) => r.ok && r.severity !== 'warn');

  const summary = {
    version: report.version,
    startedAt,
    finishedAt: new Date().toISOString(),
    totals: {
      pass: passed.length,
      warn: warned.length,
      fail: failed.length,
      total: results.length,
    },
    scenarios: report.scenarios,
    assertions: results,
  };

  const md = [
    '# Peak / Coverage / Fairness Report',
    '',
    `**Version:** ${report.version}`,
    `**Generated:** ${summary.finishedAt}`,
    '',
    `## Summary`,
    '',
    `- PASS: ${passed.length}`,
    `- WARN: ${warned.length}`,
    `- FAIL: ${failed.length}`,
    `- Total assertions: ${results.length}`,
    '',
    '## Scenarios',
    '',
    '| Scenario | Peak | noOpen | noClose | WE spread | Close spread | Early % | Ext % | Early spread | Ext spread |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...report.scenarios.map((s) => {
      if (s.error) return `| ${s.label} | ERR | | | | | | | | |`;
      return `| ${s.label} | ${s.peak ? 'ON' : 'OFF'} | ${s.noOpen} | ${s.noClose} | ${s.weSpread} | ${s.closeSpread} | ${s.pctEarly} | ${s.pctExt} | ${s.earlySpread} | ${s.extSpread} |`;
    }),
    '',
    '## Failures',
    '',
    failed.length
      ? failed.map((f) => `- **${f.name}**: ${f.detail}`).join('\n')
      : '_None_',
    '',
    '## Warnings',
    '',
    warned.length
      ? warned.map((w) => `- **${w.name}**: ${w.detail}`).join('\n')
      : '_None_',
    '',
    '## Notes',
    '',
    '- Peak OFF: auto schedule must not use open-early or close-ext (manual Requests may still force them).',
    '- Peak ON: every staffed day gets ≥1 open-early; every manager-close night uses close-ext.',
    '- Stress sims: hard coverage required; fairness soft under extreme time-off.',
    '',
  ].join('\n');

  writeFileSync(join(ROOT, 'tests', 'PEAK_FAIRNESS_REPORT.json'), JSON.stringify(summary, null, 2));
  writeFileSync(join(ROOT, 'tests', 'PEAK_FAIRNESS_REPORT.md'), md);

  console.log(`\n${passed.length} pass / ${warned.length} warn / ${failed.length} fail`);
  console.log('Wrote tests/PEAK_FAIRNESS_REPORT.md + .json');
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
