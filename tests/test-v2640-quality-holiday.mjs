/**
 * v2.6.41: severity-gate Quality + name the selected paid holiday on the board
 * and posting sheet. Extends 2.6.38 / 2.6.39 first-minute suites (keep those green).
 * Run: node tests/test-v2640-quality-holiday.mjs
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
    '/tmp/msb-pw/node_modules/playwright-core/index.mjs',
    '/tmp/node_modules/playwright-core/index.mjs',
  ];
  for (const spec of candidates) {
    if (!existsSync(spec)) continue;
    const mod = await import(pathToFileURL(spec).href);
    if (mod.chromium) return mod.chromium;
  }
  throw new Error('Playwright not installed');
}

const POSITIVE_EN = /\b(Good|Strong|Excellent)\b/;
const POSITIVE_ES = /\b(Bien|Fuerte|Excelente)\b/;

function staticChecks() {
  console.log('\n=== static ===');
  const index = read('index.html');
  const sw = read('sw.js');
  const ver = JSON.parse(read('version.json'));

  if (ver.version === '2.6.41') pass('version.json', ver.version);
  else fail('version.json', JSON.stringify(ver));

  if (index.includes("APP_VERSION = '2.6.41'") && sw.includes("msb-pro-v2.6.41")
    && index.includes('id="app-version-label">v2.6.41')) {
    pass('app-sw-version');
  } else fail('app-sw-version', 'expected 2.6.41');

  if (index.includes("QUALITY_BLOCKED_GRADE = 'Needs attention'")
    && index.includes('function qualityHasMustFix(')
    && index.includes('function qualityVerdictGrade(')
    && /mustFixCount > 0\) grade = QUALITY_BLOCKED_GRADE/.test(index)) {
    pass('quality-mustfix-gate');
  } else fail('quality-mustfix-gate', 'Needs attention gate missing');

  if (index.includes("'Needs attention': 'Requiere atención'")
    && index.includes("'{name} · 4-day week': '{name} · semana de 4 días'")) {
    pass('spanish-quality-holiday');
  } else fail('spanish-quality-holiday', 'missing ES Needs attention / 4-day week');

  if (index.includes('function listSelectedPaidHolidaysForDates(')
    && index.includes('function formatPaidHolidayWeekLabel(')
    && index.includes('function weekPaidHolidayTagHtml(')
    && index.includes('function formatPaidHolidayPrintCaption(')
    && index.includes('weekPaidHolidayTagHtml(weekDates)')
    && index.includes('print-week-holiday')
    && index.includes('print-holiday-day')) {
    pass('holiday-board-and-print-hooks');
  } else fail('holiday-board-and-print-hooks', 'board/print holiday helpers missing');

  if (index.includes("'{name} · 4-day week'") && !index.includes('Labor Day · 4-day week')) {
    pass('holiday-not-hardcoded-labor-day');
  } else fail('holiday-not-hardcoded-labor-day', 'expected {name} template, not a hardcoded Labor Day label');
}

async function main() {
  console.log('\n=== v2.6.41 quality gate + named paid holiday ===');
  staticChecks();

  const { server, base } = await startStaticServer();
  const chromium = await loadChromium();
  const browser = await chromium.launch({
    executablePath: existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 412, height: 915 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('msb_tour_done', '1');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    const boot = await page.evaluate(() => {
      return {
        version: (document.getElementById('app-version-label') || {}).textContent,
      };
    });
    if (/v2\.6\.40/.test(boot.version || '')) pass('in-app-version', boot.version);
    else fail('in-app-version', boot.version);

    const scoreGate = await page.evaluate(() => {
      const blocked = computeQualityScore({
        mustFixCount: 1,
        hardErrorCount: 0,
        totalClopens: 0,
        weekendOffs: { sm: 4, am1: 4 },
        maxStreak: { sm: 3, am1: 3 },
        unmet: [],
        prefs: {}
      }, ['sm', 'am1']);
      const clean = computeQualityScore({
        mustFixCount: 0,
        hardErrorCount: 0,
        totalClopens: 0,
        weekendOffs: { sm: 8, am1: 8 },
        maxStreak: { sm: 3, am1: 3 },
        unmet: [],
        prefs: {}
      }, ['sm', 'am1']);
      return {
        blockedGrade: blocked.grade,
        blockedScore: blocked.score,
        cleanGrade: clean.grade,
        cleanScore: clean.score,
        verdict: typeof qualityVerdictGrade === 'function' ? qualityVerdictGrade(blocked) : null,
      };
    });
    if (scoreGate.blockedGrade === 'Needs attention' && scoreGate.verdict === 'Needs attention'
      && !POSITIVE_EN.test(scoreGate.blockedGrade)) {
      pass('compute-gate-mustfix', 'score=' + scoreGate.blockedScore);
    } else fail('compute-gate-mustfix', JSON.stringify(scoreGate));
    if (scoreGate.cleanGrade !== 'Needs attention' && scoreGate.cleanScore >= 70) {
      pass('compute-clean-can-be-positive', scoreGate.cleanGrade + ' ' + scoreGate.cleanScore);
    } else fail('compute-clean-can-be-positive', JSON.stringify(scoreGate));

    await page.evaluate(() => {
      if (typeof endOnboardingTour === 'function') endOnboardingTour(true);
      if (typeof skipOnboardingTour === 'function') skipOnboardingTour();
      const welcome = document.getElementById('welcome-card');
      if (welcome) welcome.setAttribute('hidden', '');
    });

    const setup = await page.evaluate(() => {
      const yEl = document.getElementById('pick-year');
      if (yEl) yEl.value = '2026';
      if (typeof buildPeriodDropdown === 'function') buildPeriodDropdown();
      const labor = new Date(2026, 8, 7, 12, 0, 0);
      const sel = document.getElementById('pick-period');
      let periodNumber = null;
      if (sel && typeof getFiscalPeriods === 'function') {
        const periods = getFiscalPeriods(2026);
        for (let i = 0; i < periods.length; i++) {
          const p = periods[i];
          if (p.start <= labor && p.end >= labor) {
            sel.value = String(i);
            periodNumber = p.number;
            break;
          }
        }
      }
      if (typeof loadPeriod === 'function') loadPeriod();
      amCount = 1;
      if (typeof renderAMRows === 'function') renderAMRows();
      const sm = document.getElementById('name-sm');
      const am = document.getElementById('name-am1');
      if (sm) sm.value = 'Dana';
      if (am) am.value = 'Alex';
      if (typeof persistManagerNames === 'function') persistManagerNames();
      if (typeof toggleFederalHoliday === 'function') {
        FEDERAL_HOLIDAY_DEFS.forEach((d) => toggleFederalHoliday(d.id, d.id === 'labor'));
      }
      if (typeof syncFederalHolidaysToPeriod === 'function') syncFederalHolidaysToPeriod();
      const fh = typeof getFederalHolidayForDate === 'function' ? getFederalHolidayForDate('2026-09-07') : null;
      return {
        periodNumber,
        periodStart: currentPeriod && currentPeriod.start && currentPeriod.start.toISOString(),
        periodEnd: currentPeriod && currentPeriod.end && currentPeriod.end.toISOString(),
        laborName: fh && fh.name,
        selected: typeof selectedFederalHolidayIds !== 'undefined' ? selectedFederalHolidayIds.slice() : [],
        holidayWeeks: typeof holidayWeeks !== 'undefined' ? { ...holidayWeeks } : {},
      };
    });
    if (setup.periodNumber === 8 && setup.laborName === 'Labor Day' && setup.selected.length === 1 && setup.selected[0] === 'labor') {
      pass('fy2026-p8-labor-selected', 'P' + setup.periodNumber);
    } else fail('fy2026-p8-labor-selected', JSON.stringify(setup));

    await page.evaluate(() => {
      if (typeof generateSchedule === 'function') generateSchedule({ skipFreeCount: true });
    });
    await page.waitForTimeout(2000);

    const built = await page.evaluate(() => {
      const q = window._lastGenReport && (window._lastGenReport.quality || null);
      const must = typeof countMustFixErrors === 'function' ? countMustFixErrors(window._lastGenReport) : null;
      const chip = (document.getElementById('pgs-quality') || {}).textContent || '';
      const hero = document.getElementById('quality-score-hero');
      const heroGrade = hero ? ((hero.querySelector('.score-label') || {}).textContent || '') : '';
      const posting = document.getElementById('posting-board');
      const postingText = posting ? posting.innerText || '' : '';
      const reviewBits = [
        chip,
        heroGrade,
        postingText,
        hero ? hero.innerText || '' : '',
        (document.getElementById('quality-banner') || {}).innerText || '',
      ].join('\n');
      const board = (document.getElementById('schedule-grid') || {}).innerText || '';
      const weekTag = ((document.querySelector('.week-holiday-tag') || {}).textContent || '').trim();
      const dayLab = ((document.querySelector('.fh-day-label') || {}).textContent || '').trim();
      const print = (document.getElementById('print-schedule') || {}).innerText || '';
      const printCaption = ((document.querySelector('.print-week-holiday') || {}).textContent || '').trim();
      const printDay = ((document.querySelector('.print-holiday-day') || {}).textContent || '').trim();
      const weekHeaderH = document.querySelector('.week-header')
        ? document.querySelector('.week-header').getBoundingClientRect().height
        : 0;
      return {
        must,
        grade: q && q.grade,
        score: q && q.score,
        chip,
        heroGrade,
        reviewBits,
        boardHasLabor: /Labor Day/.test(board),
        boardHasFourDay: /4-day week/.test(board),
        weekTag,
        dayLab,
        printHasLabor: /Labor Day/.test(print),
        printHasFourDay: /4-day week/.test(print),
        printHasSep7: /9\/7|Labor Day/.test(print) && /7/.test(printDay || print),
        printCaption,
        printDay,
        weekHeaderH,
        postingHasMust: /must-fix/i.test(postingText),
        independenceOnBoard: /Independence Day/.test(board + print),
      };
    });

    if (built.must > 0) pass('two-person-has-mustfix', 'mustFix=' + built.must);
    else fail('two-person-has-mustfix', JSON.stringify(built));

    const surfaces = [built.chip, built.heroGrade, built.reviewBits].join('\n');
    if (built.must > 0 && POSITIVE_EN.test(surfaces)) {
      fail('no-positive-grade-with-mustfix', surfaces.slice(0, 400));
    } else if (built.must > 0) {
      pass('no-positive-grade-with-mustfix', built.chip);
    } else {
      fail('no-positive-grade-with-mustfix', 'mustFix was 0 — gate not exercised');
    }

    if (built.must > 0 && /Needs attention/i.test(built.chip) && /Needs attention/i.test(built.heroGrade)) {
      pass('needs-attention-on-chip-and-review', built.chip + ' / ' + built.heroGrade);
    } else fail('needs-attention-on-chip-and-review', JSON.stringify({ chip: built.chip, hero: built.heroGrade, must: built.must }));

    if (built.boardHasLabor && built.boardHasFourDay && /Labor Day/.test(built.weekTag)) {
      pass('board-names-labor-day', built.weekTag + ' · col=' + built.dayLab);
    } else fail('board-names-labor-day', JSON.stringify({ weekTag: built.weekTag, dayLab: built.dayLab, board: built.boardHasLabor }));

    if (built.dayLab === 'Labor Day' || /Labor Day/.test(built.weekTag)) {
      pass('board-identifies-sep-7', built.dayLab || built.weekTag);
    } else fail('board-identifies-sep-7', JSON.stringify({ dayLab: built.dayLab, weekTag: built.weekTag }));

    if (built.printHasLabor && built.printHasFourDay && /9\/7|Labor Day/.test(built.printCaption + built.printDay)) {
      pass('print-names-labor-day', built.printCaption + ' · ' + built.printDay);
    } else fail('print-names-labor-day', JSON.stringify({ cap: built.printCaption, day: built.printDay }));

    if (built.weekHeaderH > 0 && built.weekHeaderH < 90) {
      pass('phone-holiday-tag-compact', 'week-header h=' + Math.round(built.weekHeaderH));
    } else fail('phone-holiday-tag-compact', 'week-header h=' + built.weekHeaderH);

    if (!built.independenceOnBoard) pass('unchecked-holiday-not-named');
    else fail('unchecked-holiday-not-named', 'Independence Day leaked onto board/print');

    const afterUncheck = await page.evaluate(() => {
      if (typeof toggleFederalHoliday === 'function') toggleFederalHoliday('labor', false);
      if (typeof renderSchedule === 'function' && lastScheduleRenderArgs) {
        renderSchedule(lastScheduleRenderArgs.warnings, lastScheduleRenderArgs.ROLES, lastScheduleRenderArgs.ALL_KC);
      }
      const board = (document.getElementById('schedule-grid') || {}).innerText || '';
      const print = (document.getElementById('print-schedule') || {}).innerText || '';
      const tag = document.querySelector('.week-holiday-tag');
      return {
        boardHasLabor: /Labor Day/.test(board),
        printHasLabor: /Labor Day/.test(print),
        tag: !!(tag && tag.textContent && /Labor Day/.test(tag.textContent)),
      };
    });
    if (!afterUncheck.boardHasLabor && !afterUncheck.printHasLabor && !afterUncheck.tag) {
      pass('unselected-holiday-clears');
    } else fail('unselected-holiday-clears', JSON.stringify(afterUncheck));

    await page.evaluate(() => {
      if (typeof toggleFederalHoliday === 'function') toggleFederalHoliday('labor', true);
      if (typeof renderSchedule === 'function' && lastScheduleRenderArgs) {
        renderSchedule(lastScheduleRenderArgs.warnings, lastScheduleRenderArgs.ROLES, lastScheduleRenderArgs.ALL_KC);
      }
      if (typeof setUiLang === 'function') setUiLang('es');
      else {
        currentUiLang = 'es';
        if (typeof refreshUiLangChrome === 'function') refreshUiLangChrome();
      }
      if (typeof updatePostGenStrip === 'function') updatePostGenStrip();
      if (typeof renderSummary === 'function' && lastScheduleRenderArgs) {
        renderSummary(lastScheduleRenderArgs.warnings, lastScheduleRenderArgs.ROLES, lastScheduleRenderArgs.ALL_KC, window._lastGenReport);
      }
      if (typeof renderSchedule === 'function' && lastScheduleRenderArgs) {
        renderSchedule(lastScheduleRenderArgs.warnings, lastScheduleRenderArgs.ROLES, lastScheduleRenderArgs.ALL_KC);
      }
    });
    await page.waitForTimeout(400);

    const es = await page.evaluate(() => {
      const chip = (document.getElementById('pgs-quality') || {}).textContent || '';
      const hero = ((document.querySelector('#quality-score-hero .score-label') || {}).textContent || '');
      const weekTag = ((document.querySelector('.week-holiday-tag') || {}).textContent || '').trim();
      const printCap = ((document.querySelector('.print-week-holiday') || {}).textContent || '').trim();
      const bundle = [chip, hero, weekTag, printCap].join('\n');
      return { chip, hero, weekTag, printCap, bundle };
    });
    if (/Requiere atención/i.test(es.chip) && /Requiere atención/i.test(es.hero) && !POSITIVE_ES.test(es.bundle) && !POSITIVE_EN.test(es.chip + es.hero)) {
      pass('spanish-needs-attention', es.chip + ' / ' + es.hero);
    } else fail('spanish-needs-attention', JSON.stringify(es));
    if (/Labor Day/.test(es.weekTag) && /semana de 4 días/i.test(es.weekTag)
      && /Labor Day/.test(es.printCap) && /semana de 4 días/i.test(es.printCap)) {
      pass('spanish-holiday-label', es.weekTag + ' · ' + es.printCap);
    } else fail('spanish-holiday-label', JSON.stringify(es));
  } catch (e) {
    fail('suite-error', e.stack || e.message || e);
  } finally {
    await browser.close();
    server.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    failed.forEach((f) => console.log('  still failing:', f.name, f.detail));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
