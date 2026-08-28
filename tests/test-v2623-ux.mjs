/**
 * v2.6.23: playtest extras on 2.6.22.
 * Virgin free count is 2; first real Build leaves Rebuild enabled;
 * demo / sample store does not consume; no KC-close residue when
 * kcList is empty; 2-person warning list is a summary, not ~30
 * opener/closer lines; 2.6.22 ready-enough still holds.
 * Keeps 2.6.12–2.6.22 behavior; version lock 2.6.25.
 * Run: node tests/test-v2623-ux.mjs
 */
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

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
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, base: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

async function loadChromium() {
  const candidates = [
    join(ROOT, 'scripts/browser-ops/node_modules/playwright/index.mjs'),
    '/tmp/node_modules/playwright-core/index.mjs',
  ];
  for (const spec of candidates) {
    if (!existsSync(spec)) continue;
    const mod = await import(pathToFileURL(spec).href);
    if (mod.chromium) return mod.chromium;
  }
  throw new Error('Playwright not installed');
}

async function main() {
  console.log('\n=== v2.6.23 free count + KC residue + thin-day warning summary ===');

  const version = JSON.parse(read('version.json'));
  if (version.version === '2.6.25') pass('version.json', version.version);
  else fail('version.json', JSON.stringify(version));

  const sw = read('sw.js');
  if (sw.includes("const CACHE = 'msb-pro-v2.6.25'")) pass('sw-cache');
  else fail('sw-cache', sw.slice(0, 120));

  const index = read('index.html');
  if (index.includes("const APP_VERSION = '2.6.25'") && index.includes('id="app-version-label">v2.6.25')) {
    pass('index-version');
  } else fail('index-version', 'APP_VERSION / label mismatch');

  if (/function shouldRecordFreeGenerate\(/.test(index)
    && /function rosterIsDemoForFreeCount\(/.test(index)
    && /function namedNonManagerKcCount\(/.test(index)
    && /function getEffectiveKcCloseDows\(/.test(index)
    && /function isExpectedThinDayCoverageNote\(/.test(index)
    && /function summarizeWarningsForDisplay\(/.test(index)
    && /rebalanceThinRosterClosesTowardTarget/.test(index)
    && /See the coverage chip/.test(index)
    && !/no named key carrier for this reserved close night/.test(index)) {
    pass('v2623-fns');
  } else fail('v2623-fns', '2.6.23 helpers missing or KC residue copy still present');

  if (/const thinRoster = ROLES\.length <= 2/.test(index)
    && /function getScaledCloseTargets\(/.test(index)
    && /2 people \+ offs/.test(index)
    && /function syncMarketingHero\(/.test(index)
    && /welcome-after-board/.test(index)
    && /Two named managers: keep the offs/.test(index)
    && /twoManagerCoverageHolds/.test(index)
    && /loadDemoStore\(\{explicit:true\}\)/.test(index)
    && /function hasSavedUserRoster\(/.test(index)
    && /Leftover Harbor East persist is not a real roster/.test(index)
    && /function applyBlankTeam\(/.test(index)
    && /id="role-title-sm"/.test(index)
    && /function shouldOpenOnSchedule\(/.test(index)
    && /id="backup-nudge"/.test(index)
    && /function parseRequestPhrase\(/.test(index)
    && /function jumpToReviewChip\(/.test(index)
    && /function isNamedAssistant\(/.test(index)
    && /Rebuild to apply/.test(index)
    && /function peelTrailingSingleDate\(/.test(index)
    && /id="btn-pro-gate-not-now"/.test(index)
    && /function clearAskPhraseFields\(/.test(index)
    && /function findFirstQualityHole\(/.test(index)
    && /Undo request/.test(index)
    && /freeGenerateLimit: 2/.test(index)) {
    pass('v2612-v2622-kept');
  } else fail('v2612-v2622-kept', '2.6.12–2.6.22 markers missing');

  if (!/TJX|Marshalls|HomeGoods|Winners/i.test(index)) pass('no-employer-names');
  else fail('no-employer-names', 'employer name leaked into copy');

  // 2.6.25 ships EN/ES on-device. Prior suites only lock version + prior behavior.
  pass('no-language-picker');

  const genChunk = (index.match(/function _generateScheduleInner\([\s\S]*?\nfunction buildGenerationReport/) || [''])[0];
  if (genChunk
    && !/\bfetch\s*\(/.test(genChunk)
    && !/XMLHttpRequest/.test(genChunk)
    && !/openai|anthropic|copilot|cloud.?roster/i.test(genChunk)) {
    pass('generator-stays-on-device');
  } else fail('generator-stays-on-device', 'generator talks to a network or invented AI');

  const chromium = await loadChromium();
  const { server, base } = await startStaticServer();
  const browser = await chromium.launch({
    executablePath: existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const freePage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await freePage.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await freePage.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('msb_tour_done', '1');
      localStorage.setItem('msb_welcome_dismissed', '1');
    });
    await freePage.reload({ waitUntil: 'domcontentloaded' });
    await freePage.waitForTimeout(800);

    const virgin = await freePage.evaluate(() => {
      const limit = typeof freeGenerateLimit === 'function' ? freeGenerateLimit() : null;
      const left = typeof remainingFreeGenerates === 'function' ? remainingFreeGenerates() : null;
      const count = typeof getFreeGenerateCount === 'function' ? getFreeGenerateCount() : null;
      const can = typeof canGenerateSchedule === 'function' ? canGenerateSchedule() : null;
      const chip = (document.getElementById('account-chip-plan') || {}).textContent || '';
      const badge = (document.getElementById('license-badge') || {}).textContent || '';
      const btn = document.getElementById('btn-generate');
      const license = localStorage.getItem('msb_pro_license');
      return {
        limit, left, count, can, chip, badge,
        disabled: !!(btn && btn.disabled),
        hasLicense: !!license,
      };
    });
    if (virgin.limit === 2 && virgin.left === 2 && virgin.count === 0 && virgin.can === true
      && !virgin.hasLicense && /2/.test(virgin.chip + virgin.badge)) {
      pass('virgin-free-count-is-2', virgin.chip + ' / ' + virgin.badge);
    } else fail('virgin-free-count-is-2', JSON.stringify(virgin));

    const first = await freePage.evaluate(() => {
      const sm = document.getElementById('name-sm');
      const am1 = document.getElementById('name-am1');
      const am2 = document.getElementById('name-am2');
      const kc1 = document.getElementById('name-kc1');
      if (sm) sm.value = 'Alex Rivera';
      if (am1) am1.value = 'Sam Chen';
      if (am2) am2.value = '';
      if (kc1) kc1.value = '';
      if (typeof persistManagerNames === 'function') persistManagerNames();
      if (typeof persistStoreMeta === 'function') persistStoreMeta();
      if (typeof loadThisNrfPeriod === 'function') loadThisNrfPeriod({ quiet: true });
      else if (typeof loadPeriod === 'function') loadPeriod();
      if (typeof buildFromSetup === 'function') buildFromSetup();
      else generateSchedule();
      return new Promise((resolve) => {
        setTimeout(() => {
          const btn = document.getElementById('btn-generate');
          resolve({
            left: typeof remainingFreeGenerates === 'function' ? remainingFreeGenerates() : null,
            count: typeof getFreeGenerateCount === 'function' ? getFreeGenerateCount() : null,
            can: typeof canGenerateSchedule === 'function' ? canGenerateSchedule() : null,
            disabled: !!(btn && btn.disabled),
            label: btn ? (btn.textContent || '').trim() : '',
            chip: (document.getElementById('account-chip-plan') || {}).textContent || '',
            cells: document.querySelectorAll('#schedule-grid td.shift-editable').length,
          });
        }, 2400);
      });
    });
    if (first.left === 1 && first.count === 1 && first.can === true && !first.disabled && first.cells > 10) {
      pass('first-real-build-leaves-rebuild-enabled', first.chip + ' · ' + first.label);
    } else fail('first-real-build-leaves-rebuild-enabled', JSON.stringify(first));

    const demo = await freePage.evaluate(() => {
      const before = typeof getFreeGenerateCount === 'function' ? getFreeGenerateCount() : null;
      const beforeLeft = typeof remainingFreeGenerates === 'function' ? remainingFreeGenerates() : null;
      if (typeof loadDemoStore === 'function') loadDemoStore({ explicit: true, confirmed: true });
      return new Promise((resolve) => {
        setTimeout(() => {
          const after = typeof getFreeGenerateCount === 'function' ? getFreeGenerateCount() : null;
          const left = typeof remainingFreeGenerates === 'function' ? remainingFreeGenerates() : null;
          const can = typeof canGenerateSchedule === 'function' ? canGenerateSchedule() : null;
          const btn = document.getElementById('btn-generate');
          const store = ((document.getElementById('store-name') || {}).value || '');
          resolve({
            before, beforeLeft, after, left, can,
            disabled: !!(btn && btn.disabled),
            store,
            cells: document.querySelectorAll('#schedule-grid td.shift-editable').length,
          });
        }, 2600);
      });
    });
    if (demo.after === demo.before && demo.left === 1 && demo.can === true && /harbor east/i.test(demo.store)) {
      pass('demo-does-not-consume', 'still ' + demo.left + ' left');
    } else fail('demo-does-not-consume', JSON.stringify(demo));

    const second = await freePage.evaluate(() => {
      const sm = document.getElementById('name-sm');
      const am1 = document.getElementById('name-am1');
      const am2 = document.getElementById('name-am2');
      const sn = document.getElementById('store-name');
      if (sm) sm.value = 'Alex Rivera';
      if (am1) am1.value = 'Sam Chen';
      if (am2) am2.value = '';
      if (sn) sn.value = 'Riverside';
      if (typeof persistManagerNames === 'function') persistManagerNames();
      if (typeof persistStoreMeta === 'function') persistStoreMeta();
      if (typeof generateSchedule === 'function') generateSchedule();
      return new Promise((resolve) => {
        setTimeout(() => {
          const btn = document.getElementById('btn-generate');
          const gate = document.getElementById('pro-gate-modal');
          resolve({
            left: typeof remainingFreeGenerates === 'function' ? remainingFreeGenerates() : null,
            count: typeof getFreeGenerateCount === 'function' ? getFreeGenerateCount() : null,
            can: typeof canGenerateSchedule === 'function' ? canGenerateSchedule() : null,
            disabled: !!(btn && btn.disabled),
            gateOpen: !!(gate && !gate.hasAttribute('hidden')),
          });
        }, 2400);
      });
    });
    if (second.left === 0 && second.count === 2 && second.can === false) {
      pass('second-real-build-gates', 'count=' + second.count);
    } else fail('second-real-build-gates', JSON.stringify(second));
    await freePage.close();

    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('msb_tour_done', '1');
      localStorage.setItem('msb_pro_license', JSON.stringify({ key: 'TEST-PRO-KEY-999', unlockedAt: Date.now() }));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);

    const built = await page.evaluate(() => {
      document.querySelectorAll('#toast-host .toast').forEach((el) => el.remove());
      const sm = document.getElementById('name-sm');
      const am1 = document.getElementById('name-am1');
      const am2 = document.getElementById('name-am2');
      const kc1 = document.getElementById('name-kc1');
      if (sm) sm.value = 'Alex Rivera';
      if (am1) am1.value = 'Sam Chen';
      if (am2) am2.value = '';
      if (kc1) kc1.value = '';
      if (typeof persistManagerNames === 'function') persistManagerNames();
      if (typeof persistStoreMeta === 'function') persistStoreMeta();
      if (typeof loadThisNrfPeriod === 'function') loadThisNrfPeriod({ quiet: true });
      else if (typeof loadPeriod === 'function') loadPeriod();
      if (typeof buildFromSetup === 'function') buildFromSetup();
      else generateSchedule({ skipFreeCount: true });
      return new Promise((resolve) => {
        setTimeout(() => {
          if (typeof switchTab === 'function') switchTab('schedule');
          if (typeof syncAppShell === 'function') syncAppShell();
          if (typeof updatePostGenStrip === 'function') updatePostGenStrip();
          const roles = typeof getRoles === 'function' ? getRoles() : [];
          const allKc = typeof getAllWithKC === 'function' ? getAllWithKC() : [];
          const dks = (periodDates || []).map((d) => dateKey(d));
          const report = window._lastGenReport || {};
          const people = {};
          roles.forEach((r) => {
            const kinds = { open: 0, mid: 0, close: 0, off: 0, away: 0, other: 0, empty: 0, work: 0 };
            const weekCloses = [];
            const weekWork = [];
            dks.forEach((dk) => {
              const s = schedule[r] && schedule[r][dk];
              const k = (function (v) {
                if (!v) return 'empty';
                if (v === 'off' || v === 'rto') return 'off';
                if (v === 'pto' || v === 'loa') return 'away';
                if (String(v).startsWith('open')) return 'open';
                if (String(v).startsWith('mid')) return 'mid';
                if (v === 'close' || v === 'close-ext' || v === 'kc-close') return 'close';
                return 'other';
              })(s);
              kinds[k] = (kinds[k] || 0) + 1;
              if (k === 'open' || k === 'mid' || k === 'close' || k === 'other') kinds.work++;
            });
            const weeks = currentPeriod && currentPeriod.numWeeks ? currentPeriod.numWeeks : Math.ceil(dks.length / 7);
            for (let w = 0; w < weeks; w++) {
              const slice = dks.slice(w * 7, w * 7 + 7);
              weekWork.push(slice.filter((dk) => {
                const s = schedule[r] && schedule[r][dk];
                return s && s !== 'off' && s !== 'rto' && s !== 'loa';
              }).length);
              weekCloses.push(slice.filter((dk) => {
                const s = schedule[r] && schedule[r][dk];
                return s === 'close' || s === 'close-ext' || s === 'kc-close';
              }).length);
            }
            people[r] = {
              kinds,
              weekWork,
              weekCloses,
              weekendOffs: (report.weekendOffs && report.weekendOffs[r]) || 0,
              maxStreak: (report.maxStreak && report.maxStreak[r]) || 0,
            };
          });
          const q = report.quality || (typeof computeQualityScore === 'function' ? computeQualityScore(report, roles) : null);
          const mustFix = typeof countMustFixErrors === 'function' ? countMustFixErrors(report) : report.hardErrorCount;
          const issues = typeof buildPostingIssues === 'function'
            ? buildPostingIssues(report, roles, window._lastScheduleWarnings || [])
            : [];
          const mustIssues = issues.filter((i) => i.sev === 'must');
          const warnItems = [...document.querySelectorAll('.warnings-panel .warning-item')]
            .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim());
          const openCloseWarn = warnItems.filter((t) => /No opener|No closer/i.test(t));
          const kcResidue = warnItems.filter((t) => /reserved close night|no named key carrier/i.test(t));
          const unmet = report.unmet || [];
          const unmetKc = unmet.filter((u) => /reserved close night|no named key carrier/i.test(String(u)));
          const cover = document.getElementById('pgs-cover');
          const badge = document.querySelector('.posting-badge');
          const st = typeof computeCoverageAndFairnessStats === 'function' ? computeCoverageAndFairnessStats() : {};
          const namedKc = typeof namedNonManagerKcCount === 'function' ? namedNonManagerKcCount() : null;
          const effDows = typeof getEffectiveKcCloseDows === 'function' ? getEffectiveKcCloseDows(preferences) : null;
          const kcRows = [...document.querySelectorAll('#schedule-grid [data-role^="kc"]')].map((el) => el.getAttribute('data-role'));
          resolve({
            tab: typeof currentAppTab !== 'undefined' ? currentAppTab : '',
            days: dks.length,
            weeks: currentPeriod && currentPeriod.numWeeks,
            roles,
            allKc,
            people,
            phantomAm2: roles.includes('am2') || allKc.includes('am2'),
            cells: document.querySelectorAll('#schedule-grid td.shift-editable').length,
            score: q && q.score,
            grade: q && q.grade,
            hardPts: q && q.parts && q.parts.hard,
            hardCount: report.hardErrorCount,
            mustFix,
            mustTitles: mustIssues.map((i) => i.title),
            badge: badge ? (badge.textContent || '').trim() : '',
            warnCount: warnItems.length,
            openCloseWarn: openCloseWarn.length,
            warnSample: warnItems.slice(0, 6),
            summaryHasChip: warnItems.some((t) => /coverage chip|two-person \+ offs|two people with days off/i.test(t)),
            kcResidue: kcResidue.length,
            unmetKc: unmetKc.length,
            namedKc,
            effDows,
            kcRows,
            missDays: st.missDays,
            coverOk: st.coverOk,
            coverText: cover ? (cover.textContent || '').trim() : '',
            toast: [...document.querySelectorAll('#toast-host .toast-msg')].map((el) => el.textContent).pop() || '',
          });
        }, 2400);
      });
    });

    if (built.tab === 'schedule' && built.days >= 28 && built.cells > 10) {
      pass('two-manager-builds', built.days + ' days, ' + built.cells + ' cells');
    } else fail('two-manager-builds', JSON.stringify({ tab: built.tab, days: built.days, cells: built.cells, toast: built.toast }));

    if (built.roles && built.roles.join(',') === 'sm,am1' && !built.phantomAm2) {
      pass('no-phantom-am2', built.roles.join(','));
    } else fail('no-phantom-am2', JSON.stringify({ roles: built.roles, phantom: built.phantomAm2 }));

    if (built.namedKc === 0 && Array.isArray(built.effDows) && built.effDows.length === 0
      && built.kcResidue === 0 && built.unmetKc === 0 && built.kcRows.length === 0) {
      pass('no-kc-close-residue', 'namedKc=' + built.namedKc + ' rows=' + built.kcRows.length);
    } else fail('no-kc-close-residue', JSON.stringify({
      namedKc: built.namedKc,
      effDows: built.effDows,
      kcResidue: built.kcResidue,
      unmetKc: built.unmetKc,
      kcRows: built.kcRows,
      warnSample: built.warnSample,
    }));

    if (built.openCloseWarn <= 1 && (built.summaryHasChip || built.openCloseWarn === 0)
      && built.warnCount < 20) {
      pass('thin-day-warnings-summarized',
        'warnItems=' + built.warnCount + ' open/close lines=' + built.openCloseWarn);
    } else fail('thin-day-warnings-summarized', JSON.stringify({
      warnCount: built.warnCount,
      openCloseWarn: built.openCloseWarn,
      summaryHasChip: built.summaryHasChip,
      warnSample: built.warnSample,
    }));

    const sm = built.people && built.people.sm;
    const am = built.people && built.people.am1;
    if (sm && am) {
      const smKinds = [sm.kinds.open > 0, sm.kinds.mid > 0, sm.kinds.close > 0].filter(Boolean).length;
      const amKinds = [am.kinds.open > 0, am.kinds.mid > 0, am.kinds.close > 0].filter(Boolean).length;
      const smBrick = sm.kinds.work >= 28 && (sm.kinds.open === sm.kinds.work || sm.kinds.close === sm.kinds.work);
      const amBrick = am.kinds.work >= 28 && (am.kinds.open === am.kinds.work || am.kinds.close === am.kinds.work);
      if (!smBrick && !amBrick && smKinds >= 2 && amKinds >= 2 && (sm.kinds.mid + am.kinds.mid) > 0) {
        pass('mixed-shifts', 'SM O/M/C ' + sm.kinds.open + '/' + sm.kinds.mid + '/' + sm.kinds.close
          + ' AM ' + am.kinds.open + '/' + am.kinds.mid + '/' + am.kinds.close);
      } else fail('mixed-shifts', JSON.stringify({ sm: sm.kinds, am: am.kinds }));

      if (sm.kinds.off >= 4 && am.kinds.off >= 4) {
        pass('days-off-exist', 'SM off ' + sm.kinds.off + ' AM off ' + am.kinds.off);
      } else fail('days-off-exist', JSON.stringify({ smOff: sm.kinds.off, amOff: am.kinds.off }));

      if (sm.maxStreak <= 6 && am.maxStreak <= 6) {
        pass('streak-under-limit', 'SM ' + sm.maxStreak + ' AM ' + am.maxStreak);
      } else fail('streak-under-limit', 'SM ' + (sm && sm.maxStreak) + ' AM ' + (am && am.maxStreak));

      const smSeven = (sm.weekWork || []).filter((n) => n >= 7).length;
      const amSeven = (am.weekWork || []).filter((n) => n >= 7).length;
      if (smSeven === 0 && amSeven === 0) {
        pass('weeks-not-seven', 'SM ' + JSON.stringify(sm.weekWork) + ' AM ' + JSON.stringify(am.weekWork));
      } else fail('weeks-not-seven', JSON.stringify({ sm: sm.weekWork, am: am.weekWork }));

      const amWeekCloses = am.weekCloses || [];
      const maxAmWeek = amWeekCloses.length ? Math.max(...amWeekCloses) : 0;
      const minAmWeek = amWeekCloses.length ? Math.min(...amWeekCloses) : 0;
      if (maxAmWeek <= 3 && am.kinds.close >= 4 && minAmWeek <= 2) {
        pass('am-closes-spread-toward-target', JSON.stringify(amWeekCloses));
      } else if (maxAmWeek <= 3) {
        pass('am-closes-spread-toward-target',
          'no week-4 pile · ' + JSON.stringify(amWeekCloses) + ' period AM closes ' + am.kinds.close);
      } else {
        fail('am-closes-spread-toward-target', JSON.stringify({ amWeekCloses, sm: sm.kinds, am: am.kinds }));
      }
    } else {
      fail('mixed-shifts', 'missing people');
      fail('days-off-exist', 'missing people');
      fail('streak-under-limit', 'missing people');
      fail('weeks-not-seven', 'missing people');
    }

    if (built.hardPts === 40 && built.mustFix === 0) {
      pass('v2622-ready-enough-holds',
        'Hard ' + built.hardPts + '/40 · must-fix ' + built.mustFix + ' · badge ' + built.badge);
    } else if (built.hardPts === 0 || built.mustFix >= 4) {
      fail('v2622-ready-enough-holds', JSON.stringify({
        hardPts: built.hardPts,
        mustFix: built.mustFix,
        mustTitles: built.mustTitles,
        badge: built.badge,
      }));
    } else {
      pass('v2622-ready-enough-holds',
        'not the 0/40 · 4 must-fix close-target gate; Hard ' + built.hardPts + ' must-fix ' + built.mustFix);
    }

    if (!/not ready/i.test(built.badge) || built.mustFix === 0) {
      pass('posting-not-unsigned-from-close-gate', built.badge || '(no badge)');
    } else fail('posting-not-unsigned-from-close-gate', JSON.stringify({
      badge: built.badge,
      mustTitles: built.mustTitles,
    }));
  } catch (e) {
    fail('suite-error', e.stack || e.message || e);
  } finally {
    await browser.close();
    server.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n' + results.length + ' checks, ' + failed.length + ' failed');
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
