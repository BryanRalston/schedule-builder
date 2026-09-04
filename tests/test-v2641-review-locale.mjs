/**
 * v2.6.41: Review must not flip locale or start the tour; missDays is one
 * locale-invariant integer. Extends 2.6.38 / 2.6.39 / 2.6.40 (keep those green).
 * Run: node tests/test-v2641-review-locale.mjs
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

function sliceFn(src, name) {
  const re = new RegExp('function ' + name + '\\s*\\(');
  const start = src.search(re);
  if (start < 0) return '';
  const next = src.slice(start + 1).search(/\nfunction [\w$]+\s*\(/);
  return next < 0 ? src.slice(start) : src.slice(start, start + 1 + next);
}

function staticChecks() {
  console.log('\n=== static ===');
  const index = read('index.html');
  const sw = read('sw.js');
  const ver = JSON.parse(read('version.json'));
  const twa = JSON.parse(read('android-twa/twa-manifest.json'));

  if (ver.version === '2.6.41') pass('version.json', ver.version);
  else fail('version.json', JSON.stringify(ver));

  if (index.includes("APP_VERSION = '2.6.41'") && sw.includes('msb-pro-v2.6.41')
    && index.includes('id="app-version-label">v2.6.41')) {
    pass('app-sw-version');
  } else fail('app-sw-version', 'expected 2.6.41');

  if (twa.appVersion === '2.6.41' && twa.appVersionName === '2.6.41') pass('twa-manifest-version');
  else fail('twa-manifest-version', JSON.stringify({ v: twa.appVersion, n: twa.appVersionName }));

  if (index.includes('function countBoardMissDays(')
    && index.includes('function localBoardDate(')
    && index.includes('window._lastBoardMissDays')
    && /countBoardMissDays\(schedule, periodDates/.test(index)) {
    pass('single-missdays-helper');
  } else fail('single-missdays-helper', 'countBoardMissDays not wired');

  const openBody = sliceFn(index, 'openReviewSheet');
  if (openBody && !/startOnboardingTour\s*\(/.test(openBody) && !/setUiLang\s*\(/.test(openBody)
    && openBody.includes('_msbOpeningReview') && openBody.includes('langAtOpen')) {
    pass('review-open-no-tour-or-lang');
  } else fail('review-open-no-tour-or-lang', openBody.slice(0, 240));

  const tourBody = sliceFn(index, 'startOnboardingTour');
  if (tourBody.includes('review-sheet-open') && tourBody.includes('_msbOpeningReview')) {
    pass('tour-ignores-review-entry');
  } else fail('tour-ignores-review-entry', tourBody.slice(0, 200));

  if (index.includes('_msbHoldMissDays') && /formatMissingDaysShort\(n\)/.test(index)
    && index.includes("msbT('{n} missing'")) {
    pass('formatters-words-only');
  } else fail('formatters-words-only', 'lang hold / formatMissingDaysShort missing');
}

async function setupHuntBoard(page) {
  return page.evaluate(() => {
    if (typeof endOnboardingTour === 'function') endOnboardingTour(true);
    if (typeof skipOnboardingTour === 'function') skipOnboardingTour();
    const welcome = document.getElementById('welcome-card');
    if (welcome) {
      welcome.setAttribute('hidden', '');
      welcome.style.display = 'none';
    }
    if (typeof setUiLang === 'function') setUiLang('en');
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
    return { periodNumber };
  });
}

function snapshotReviewSurface() {
  const tour = document.getElementById('onboarding-tour');
  const sheet = document.getElementById('review-sheet');
  const cover = document.getElementById('pgs-cover');
  const quality = document.getElementById('pgs-quality');
  const saved = document.getElementById('local-status-pill');
  const st = typeof computeCoverageAndFairnessStats === 'function'
    ? computeCoverageAndFairnessStats()
    : null;
  const counted = typeof countBoardMissDays === 'function'
    ? countBoardMissDays(
      schedule,
      periodDates,
      typeof getRoles === 'function' ? getRoles() : [],
      typeof getAllWithKC === 'function' ? getAllWithKC() : []
    )
    : null;
  const reviewText = sheet ? (sheet.innerText || '') : '';
  const missMatch = reviewText.match(/(\d+)\s+(?:days? missing|días? sin apertura)/i)
    || reviewText.match(/(?:Faltan|missing)\s+(\d+)/i);
  return {
    lang: typeof currentUiLang !== 'undefined' ? currentUiLang : null,
    htmlLang: document.documentElement.lang || '',
    tab: typeof currentAppTab !== 'undefined' ? currentAppTab : null,
    tourOpen: !!(tour && !tour.hasAttribute('hidden')),
    tourText: tour ? (tour.innerText || '').slice(0, 160) : '',
    reviewOpen: !!(sheet && sheet.classList.contains('open') && !sheet.hidden),
    cover: cover ? cover.textContent : '',
    quality: quality ? quality.textContent : '',
    saved: saved ? saved.textContent : '',
    missDays: st && st.missDays,
    counted,
    reviewMiss: missMatch ? Number(missMatch[1]) : null,
    reviewBits: reviewText.slice(0, 400),
    setupTab: !!(document.getElementById('tab-setup') && document.getElementById('tab-setup').classList.contains('active')),
  };
}

async function main() {
  console.log('\n=== v2.6.41 Review locale + stable missDays ===');
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
      locale: 'en-US',
    });
    const page = await context.newPage();
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('msb_tour_done', '1');
      localStorage.setItem('msb_welcome_dismissed', '1');
      localStorage.setItem('msb_ui_lang', 'en');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    const boot = await page.evaluate(() => ({
      version: (document.getElementById('app-version-label') || {}).textContent,
    }));
    if (/v2\.6\.41/.test(boot.version || '')) pass('in-app-version', boot.version);
    else fail('in-app-version', boot.version);

    const setup = await setupHuntBoard(page);
    await page.evaluate(() => {
      if (typeof generateSchedule === 'function') generateSchedule({ skipFreeCount: true });
    });
    await page.waitForTimeout(2200);
    const phrase = await page.evaluate(() => {
      const ask = document.getElementById('request-phrase-input')
        || document.getElementById('setup-request-phrase-input');
      if (ask) ask.value = 'Alex off Mon Sep 7';
      const applied = typeof applyRequestPhraseFromBar === 'function'
        ? applyRequestPhraseFromBar(ask ? ask.id : 'request-phrase-input')
        : null;
      if (typeof generateSchedule === 'function') generateSchedule({ skipFreeCount: true });
      return {
        ok: !!(applied && applied.ok),
        days: applied && applied.dateKeys ? applied.dateKeys.slice() : [],
        lang: typeof currentUiLang !== 'undefined' ? currentUiLang : null,
      };
    });
    await page.waitForTimeout(2200);
    await page.evaluate(() => {
      if (typeof switchTab === 'function') switchTab('schedule');
      if (typeof updatePostGenStrip === 'function') updatePostGenStrip();
    });
    if (setup.periodNumber === 8 && phrase.ok && phrase.lang === 'en') {
      pass('fy2026-p8-alex-off-labor', (phrase.days || []).join(','));
    } else fail('fy2026-p8-alex-off-labor', JSON.stringify({ setup, phrase }));

    const enBefore = await page.evaluate(snapshotReviewSurface);
    if (typeof enBefore.missDays === 'number' && enBefore.missDays === enBefore.counted && enBefore.lang === 'en') {
      pass('en-missdays-from-board', String(enBefore.missDays));
    } else fail('en-missdays-from-board', JSON.stringify(enBefore));

    await page.evaluate(() => {
      try { localStorage.removeItem('msb_tour_done'); } catch (e) {}
    });

    const afterReviewEn = await page.evaluate(() => {
      if (typeof openReviewSheet === 'function') openReviewSheet();
      if (typeof jumpToIssuesPanel === 'function') jumpToIssuesPanel();
      return (function snapshotReviewSurface() {
        const tour = document.getElementById('onboarding-tour');
        const sheet = document.getElementById('review-sheet');
        const cover = document.getElementById('pgs-cover');
        const quality = document.getElementById('pgs-quality');
        const saved = document.getElementById('local-status-pill');
        const st = typeof computeCoverageAndFairnessStats === 'function'
          ? computeCoverageAndFairnessStats()
          : null;
        const reviewText = sheet ? (sheet.innerText || '') : '';
        const missMatch = reviewText.match(/(\d+)\s+(?:days? missing|días? sin apertura)/i)
          || reviewText.match(/(?:Faltan|missing)\s+(\d+)/i);
        return {
          lang: typeof currentUiLang !== 'undefined' ? currentUiLang : null,
          htmlLang: document.documentElement.lang || '',
          tab: typeof currentAppTab !== 'undefined' ? currentAppTab : null,
          tourOpen: !!(tour && !tour.hasAttribute('hidden')),
          tourText: tour ? (tour.innerText || '').slice(0, 200) : '',
          reviewOpen: !!(sheet && sheet.classList.contains('open') && !sheet.hidden),
          cover: cover ? cover.textContent : '',
          quality: quality ? quality.textContent : '',
          saved: saved ? saved.textContent : '',
          missDays: st && st.missDays,
          reviewMiss: missMatch ? Number(missMatch[1]) : null,
          setupTab: !!(document.getElementById('tab-setup') && document.getElementById('tab-setup').classList.contains('active')),
          guardado: /Guardado/i.test((saved && saved.textContent) || ''),
          paso: /Paso \d|Bienvenido/i.test((tour && tour.innerText) || ''),
        };
      })();
    });

    if (afterReviewEn.lang === 'en' && afterReviewEn.htmlLang !== 'es' && !afterReviewEn.guardado) {
      pass('review-keeps-english', afterReviewEn.quality + ' · ' + afterReviewEn.saved);
    } else fail('review-keeps-english', JSON.stringify(afterReviewEn));

    if (!afterReviewEn.tourOpen && !afterReviewEn.paso && !afterReviewEn.setupTab
      && afterReviewEn.tab === 'schedule' && afterReviewEn.reviewOpen) {
      pass('review-does-not-start-tour', afterReviewEn.tab);
    } else fail('review-does-not-start-tour', JSON.stringify(afterReviewEn));

    await page.evaluate(() => {
      if (typeof closeReviewSheet === 'function') closeReviewSheet();
    });

    const es = await page.evaluate(() => {
      if (typeof setUiLang === 'function') setUiLang('es');
      if (typeof updatePostGenStrip === 'function') updatePostGenStrip();
      if (typeof renderSummary === 'function' && lastScheduleRenderArgs) {
        renderSummary(
          lastScheduleRenderArgs.warnings,
          lastScheduleRenderArgs.ROLES,
          lastScheduleRenderArgs.ALL_KC,
          window._lastGenReport
        );
      }
      const st = typeof computeCoverageAndFairnessStats === 'function'
        ? computeCoverageAndFairnessStats()
        : null;
      const counted = typeof countBoardMissDays === 'function'
        ? countBoardMissDays(
          schedule,
          periodDates,
          typeof getRoles === 'function' ? getRoles() : [],
          typeof getAllWithKC === 'function' ? getAllWithKC() : []
        )
        : null;
      const cover = document.getElementById('pgs-cover');
      const toastShort = typeof formatMissingDaysShort === 'function' && st
        ? formatMissingDaysShort(st.missDays)
        : '';
      return {
        lang: currentUiLang,
        missDays: st && st.missDays,
        counted,
        cover: cover ? cover.textContent : '',
        toastShort,
        hold: window._lastBoardMissDays,
      };
    });

    if (es.lang === 'es' && es.missDays === enBefore.missDays && es.counted === enBefore.missDays
      && es.hold === enBefore.missDays) {
      pass('missdays-stable-across-lang', 'n=' + es.missDays);
    } else fail('missdays-stable-across-lang', JSON.stringify({ en: enBefore.missDays, es }));

    const enNum = String(enBefore.missDays);
    if (es.cover && es.cover.indexOf(enNum) !== -1 && /Faltan/i.test(es.cover)
      && !new RegExp('\\b' + (enBefore.missDays + 2) + '\\b').test(es.cover)) {
      pass('es-chip-same-integer', es.cover);
    } else fail('es-chip-same-integer', JSON.stringify({ cover: es.cover, n: enBefore.missDays }));

    if (es.toastShort && es.toastShort.indexOf(enNum) !== -1 && /Faltan/i.test(es.toastShort)) {
      pass('es-formatter-same-integer', es.toastShort);
    } else fail('es-formatter-same-integer', es.toastShort);

    const afterReviewEs = await page.evaluate(() => {
      if (typeof openReviewSheet === 'function') openReviewSheet();
      const tour = document.getElementById('onboarding-tour');
      const sheet = document.getElementById('review-sheet');
      const reviewText = sheet ? (sheet.innerText || '') : '';
      const missMatch = reviewText.match(/(\d+)\s+(?:days? missing|días? sin apertura)/i)
        || reviewText.match(/(?:Faltan|missing)\s+(\d+)/i);
      return {
        lang: currentUiLang,
        tab: currentAppTab,
        tourOpen: !!(tour && !tour.hasAttribute('hidden')),
        reviewOpen: !!(sheet && sheet.classList.contains('open') && !sheet.hidden),
        setupTab: !!(document.getElementById('tab-setup') && document.getElementById('tab-setup').classList.contains('active')),
        reviewMiss: missMatch ? Number(missMatch[1]) : null,
        cover: (document.getElementById('pgs-cover') || {}).textContent || '',
      };
    });

    if (afterReviewEs.lang === 'es' && !afterReviewEs.tourOpen && afterReviewEs.tab === 'schedule'
      && afterReviewEs.reviewOpen && !afterReviewEs.setupTab) {
      pass('review-keeps-spanish-no-tour', afterReviewEs.cover);
    } else fail('review-keeps-spanish-no-tour', JSON.stringify(afterReviewEs));

    if (afterReviewEs.reviewMiss == null || afterReviewEs.reviewMiss === enBefore.missDays) {
      pass('review-sheet-same-missdays', String(afterReviewEs.reviewMiss));
    } else fail('review-sheet-same-missdays', JSON.stringify({
      en: enBefore.missDays,
      review: afterReviewEs.reviewMiss,
    }));

    const explicitTour = await page.evaluate(() => {
      if (typeof closeReviewSheet === 'function') closeReviewSheet();
      if (typeof startOnboardingTour === 'function') startOnboardingTour(true);
      const tour = document.getElementById('onboarding-tour');
      const open = !!(tour && !tour.hasAttribute('hidden'));
      if (typeof endOnboardingTour === 'function') endOnboardingTour(true);
      return { open, lang: currentUiLang };
    });
    if (explicitTour.open && explicitTour.lang === 'es') pass('explicit-tour-still-works');
    else fail('explicit-tour-still-works', JSON.stringify(explicitTour));
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
