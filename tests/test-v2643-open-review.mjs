/**
 * v2.6.45: Open Review stays on schedule-builder; Word/Excel soft-confirm
 * runs before the Pro unlock gate when must-fix remains.
 * Extends 2.6.38–2.6.42 (keep those green).
 * Run: node tests/test-v2643-open-review.mjs
 */
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
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
      if (p.endsWith('/')) p += 'index.html';
      if (p === '/app') p = '/app/index.html';
      const file = join(ROOT, p.replace(/^\//, ''));
      if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
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
  const index = read('app/index.html');
  const sw = read('sw.js');
  const ver = JSON.parse(read('version.json'));
  const twa = JSON.parse(read('android-twa/twa-manifest.json'));

  if (ver.version === '2.6.45') pass('version.json', ver.version);
  else fail('version.json', JSON.stringify(ver));

  if (index.includes("APP_VERSION = '2.6.45'") && sw.includes('msb-pro-v2.6.45')
    && index.includes('id="app-version-label">v2.6.45')) {
    pass('app-sw-version');
  } else fail('app-sw-version', 'expected 2.6.45');

  if (twa.appVersion === '2.6.45' && twa.appVersionName === '2.6.45') pass('twa-manifest-version');
  else fail('twa-manifest-version', JSON.stringify({ v: twa.appVersion, n: twa.appVersionName }));

  const reviewTag = (index.match(/<button[^>]*id="mustfix-export-review"[^>]*>/) || [])[0] || '';
  if (reviewTag.includes('type="button"')
    && reviewTag.includes('reviewMustFixExportConfirm')
    && !/<a\b[^>]*id="mustfix-export-review"/.test(index)
    && !/id="mustfix-export-review"[^>]*href=/.test(index)) {
    pass('open-review-is-button');
  } else fail('open-review-is-button', reviewTag || 'missing #mustfix-export-review button');

  if (!/times-tables|#\/play\/welcome|squishee/i.test(index)) {
    pass('no-foreign-review-url');
  } else fail('no-foreign-review-url', 'index.html mentions a foreign review URL');

  const reviewFn = sliceFn(index, 'reviewMustFixExportConfirm');
  if (/jumpToIssuesPanel\(/.test(reviewFn) && /openReviewSheet\(/.test(reviewFn)
    && !/location\.(href|assign|replace)/.test(reviewFn)) {
    pass('review-calls-in-app-sheet');
  } else fail('review-calls-in-app-sheet', reviewFn.slice(0, 400));

  const closedFn = sliceFn(index, 'msbUiClosed');
  if (/history\.state/.test(closedFn) && /msbUi/.test(closedFn) && /history\.back\(/.test(closedFn)) {
    pass('history-back-own-state-only');
  } else fail('history-back-own-state-only', closedFn.slice(0, 400));

  const wordFn = sliceFn(index, 'exportSchedule');
  const excelFn = sliceFn(index, 'exportScheduleExcel');
  const wordConfirm = wordFn.indexOf('confirmMustFixExport');
  const wordPro = wordFn.indexOf('requirePro');
  const excelConfirm = excelFn.indexOf('confirmMustFixExport');
  const excelPro = excelFn.indexOf('requirePro');
  if (wordConfirm >= 0 && wordPro > wordConfirm && excelConfirm >= 0 && excelPro > excelConfirm) {
    pass('word-excel-confirm-before-pro');
  } else fail('word-excel-confirm-before-pro', JSON.stringify({
    wordConfirm, wordPro, excelConfirm, excelPro
  }));
}

async function setupHuntBoard(page, opts) {
  const unlockPro = !!(opts && opts.unlockPro);
  return page.evaluate((pro) => {
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
    if (pro) {
      localStorage.setItem('msb_pro_license', JSON.stringify({
        key: 'TEST-PRO-KEY-999',
        unlocked: true,
        unlockedAt: Date.now()
      }));
    } else {
      localStorage.removeItem('msb_pro_license');
    }
    return { periodNumber, pro: typeof isProUnlocked === 'function' ? isProUnlocked() : null };
  }, unlockPro);
}

function uiState() {
  return `(() => {
    const modal = document.getElementById('mustfix-export-modal');
    const pro = document.getElementById('pro-gate-modal');
    const sheet = document.getElementById('review-sheet');
    const tour = document.getElementById('onboarding-tour');
    return {
      confirmOpen: !!(modal && !modal.hasAttribute('hidden')),
      confirmKind: modal ? modal.getAttribute('data-export-kind') : null,
      confirmReview: ((document.getElementById('mustfix-export-review') || {}).textContent || '').trim(),
      proOpen: !!(pro && !pro.hasAttribute('hidden')),
      proBody: ((document.getElementById('pro-gate-body') || {}).textContent || '').trim(),
      reviewOpen: !!(sheet && sheet.classList.contains('open') && !sheet.hidden),
      tourOpen: !!(tour && !tour.hasAttribute('hidden')),
      lang: document.documentElement.lang || '',
      uiLang: typeof currentUiLang !== 'undefined' ? currentUiLang : '',
      href: location.href
    };
  })()`;
}

function foreignUrl(href) {
  const s = String(href || '');
  return /times-tables|#\/play\/welcome|squishee|buy\.html/i.test(s);
}

async function main() {
  console.log('\n=== v2.6.45 Open Review stays in MSP + Word/Excel confirm-before-Pro ===');
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
    const startUrl = base + '/app/index.html';
    await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
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
    if (/v2\.6\.44/.test(boot.version || '')) pass('in-app-version', boot.version);
    else fail('in-app-version', boot.version);

    const setup = await setupHuntBoard(page, { unlockPro: true });
    await page.evaluate(() => {
      if (typeof generateSchedule === 'function') generateSchedule({ skipFreeCount: true });
    });
    await page.waitForTimeout(2200);

    const built = await page.evaluate(() => ({
      must: typeof currentMustFixCount === 'function' ? currentMustFixCount() : null,
      pro: typeof isProUnlocked === 'function' ? isProUnlocked() : null
    }));
    if (setup.periodNumber === 8 && built.must > 0 && built.pro) {
      pass('two-person-has-mustfix', 'mustFix=' + built.must);
    } else fail('two-person-has-mustfix', JSON.stringify({ setup, built }));

    await page.evaluate(() => {
      const here = location.href;
      history.replaceState({ decoy: 'times-tables' }, '', new URL('./times-tables/#/play/welcome', here).href);
      history.pushState({ msp: 1 }, '', here);
    });

    await page.evaluate(() => { printPostingSheet(); });
    const confirmShown = await page.evaluate(uiState());
    if (confirmShown.confirmOpen && !confirmShown.proOpen && !foreignUrl(confirmShown.href)) {
      pass('print-confirm-on-mustfix', confirmShown.confirmReview);
    } else fail('print-confirm-on-mustfix', JSON.stringify(confirmShown));

    const langBefore = confirmShown.lang;
    await page.click('#mustfix-export-review');
    await page.waitForTimeout(250);
    const afterClick = await page.evaluate(uiState());
    const stillHere = page.url().startsWith(base) && !foreignUrl(page.url()) && !foreignUrl(afterClick.href);
    if (stillHere && afterClick.reviewOpen && !afterClick.confirmOpen && !afterClick.tourOpen
      && afterClick.lang === langBefore && afterClick.uiLang === 'en') {
      pass('open-review-click-stays-in-app', page.url());
    } else fail('open-review-click-stays-in-app', JSON.stringify({
      url: page.url(), afterClick, langBefore
    }));

    await page.evaluate(() => {
      if (typeof closeReviewSheet === 'function') closeReviewSheet();
    });

    await page.click('#header-more-btn');
    await page.waitForTimeout(80);
    await page.locator('#header-menu-panel button').filter({ hasText: /^Print$/ }).click();
    await page.waitForTimeout(150);
    const fromMenu = await page.evaluate(uiState());
    if (fromMenu.confirmOpen) pass('header-print-opens-confirm');
    else fail('header-print-opens-confirm', JSON.stringify(fromMenu));

    await page.click('#mustfix-export-review');
    await page.waitForTimeout(250);
    const afterMenuReview = await page.evaluate(uiState());
    if (page.url().startsWith(base) && !foreignUrl(page.url())
      && afterMenuReview.reviewOpen && !afterMenuReview.confirmOpen && !afterMenuReview.tourOpen) {
      pass('header-open-review-stays-in-app', page.url());
    } else fail('header-open-review-stays-in-app', JSON.stringify({
      url: page.url(), afterMenuReview
    }));

    await page.evaluate(() => {
      if (typeof closeReviewSheet === 'function') closeReviewSheet();
      if (typeof setUiLang === 'function') setUiLang('es');
    });
    await page.evaluate(() => { printPostingSheet(); });
    await page.waitForTimeout(120);
    const esMid = await page.evaluate(uiState());
    if (esMid.confirmOpen && /Abrir Revisión/.test(esMid.confirmReview)) {
      pass('spanish-open-review-label', esMid.confirmReview);
    } else fail('spanish-open-review-label', JSON.stringify(esMid));

    await page.click('#mustfix-export-review');
    await page.waitForTimeout(250);
    const esAfter = await page.evaluate(uiState());
    if (page.url().startsWith(base) && !foreignUrl(page.url())
      && esAfter.reviewOpen && !esAfter.confirmOpen && esAfter.uiLang === 'es'
      && !esAfter.tourOpen) {
      pass('spanish-open-review-stays-in-app');
    } else fail('spanish-open-review-stays-in-app', JSON.stringify({ url: page.url(), esAfter }));

    await page.evaluate(() => {
      if (typeof closeReviewSheet === 'function') closeReviewSheet();
      if (typeof setUiLang === 'function') setUiLang('en');
      localStorage.removeItem('msb_pro_license');
    });
    const freeFlag = await page.evaluate(() => typeof isProUnlocked === 'function' && isProUnlocked());
    if (!freeFlag) pass('dropped-to-free');
    else fail('dropped-to-free', 'still Pro after removing license');

    const wordFree = await page.evaluate(() => {
      window._wordDownloads = 0;
      if (typeof downloadWordExport === 'function') {
        downloadWordExport = function () { window._wordDownloads += 1; };
      }
      const shown = exportSchedule();
      return shown;
    });
    const wordMid = await page.evaluate(uiState());
    if (wordFree === false && wordMid.confirmOpen && wordMid.confirmKind === 'word'
      && !wordMid.proOpen && !/Word export is included with Pro/i.test(wordMid.proBody)) {
      pass('free-word-confirm-before-pro', wordMid.confirmReview);
    } else fail('free-word-confirm-before-pro', JSON.stringify({ wordFree, wordMid }));

    await page.click('#mustfix-export-review');
    await page.waitForTimeout(250);
    const wordReview = await page.evaluate(uiState());
    if (page.url().startsWith(base) && !foreignUrl(page.url())
      && wordReview.reviewOpen && !wordReview.confirmOpen && !wordReview.proOpen) {
      pass('free-word-open-review-in-app');
    } else fail('free-word-open-review-in-app', JSON.stringify({ url: page.url(), wordReview }));

    await page.evaluate(() => {
      if (typeof closeReviewSheet === 'function') closeReviewSheet();
    });

    const excelFree = await page.evaluate(() => {
      window._excelDownloads = 0;
      if (typeof downloadExcelExport === 'function') {
        downloadExcelExport = function () { window._excelDownloads += 1; };
      }
      return exportScheduleExcel();
    });
    const excelMid = await page.evaluate(uiState());
    if (excelFree === false && excelMid.confirmOpen && excelMid.confirmKind === 'excel' && !excelMid.proOpen) {
      pass('free-excel-confirm-before-pro');
    } else fail('free-excel-confirm-before-pro', JSON.stringify({ excelFree, excelMid }));

    await page.click('#mustfix-export-proceed');
    await page.waitForTimeout(200);
    const excelAnyway = await page.evaluate(() => {
      const pro = document.getElementById('pro-gate-modal');
      const modal = document.getElementById('mustfix-export-modal');
      return {
        confirmOpen: !!(modal && !modal.hasAttribute('hidden')),
        proOpen: !!(pro && !pro.hasAttribute('hidden')),
        proBody: ((document.getElementById('pro-gate-body') || {}).textContent || '').trim(),
        downloads: window._excelDownloads || 0,
        href: location.href
      };
    });
    if (!excelAnyway.confirmOpen && excelAnyway.proOpen && excelAnyway.downloads === 0
      && /Excel export is included with Pro/i.test(excelAnyway.proBody)
      && !foreignUrl(excelAnyway.href)) {
      pass('free-excel-anyway-then-pro');
    } else fail('free-excel-anyway-then-pro', JSON.stringify(excelAnyway));

    await page.evaluate(() => {
      if (typeof closeProGate === 'function') closeProGate();
      const r = window._lastGenReport || {};
      r.mustFixCount = 0;
      r.hardErrorCount = 0;
      if (!r.quality) r.quality = {};
      r.quality.mustFixCount = 0;
      window._lastGenReport = r;
    });

    const cleanWord = await page.evaluate(() => {
      const shown = exportSchedule();
      const modal = document.getElementById('mustfix-export-modal');
      const pro = document.getElementById('pro-gate-modal');
      return {
        shown: shown,
        confirmOpen: !!(modal && !modal.hasAttribute('hidden')),
        proOpen: !!(pro && !pro.hasAttribute('hidden')),
        downloads: window._wordDownloads || 0
      };
    });
    if (cleanWord.shown === true && !cleanWord.confirmOpen && cleanWord.proOpen && cleanWord.downloads === 0) {
      pass('free-zero-mustfix-pro-gate');
    } else fail('free-zero-mustfix-pro-gate', JSON.stringify(cleanWord));
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
