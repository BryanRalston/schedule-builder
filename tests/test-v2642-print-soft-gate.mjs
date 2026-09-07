/**
 * v2.6.43: soft-gate Print / Word / Excel when must-fix remains.
 * Must-fix board: confirm + readiness line. Zero must-fix: unchanged.
 * Extends 2.6.38 / 2.6.39 / 2.6.40 / 2.6.41 (keep those green).
 * Run: node tests/test-v2642-print-soft-gate.mjs
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

function staticChecks() {
  console.log('\n=== static ===');
  const index = read('index.html');
  const sw = read('sw.js');
  const ver = JSON.parse(read('version.json'));
  const twa = JSON.parse(read('android-twa/twa-manifest.json'));

  if (ver.version === '2.6.43') pass('version.json', ver.version);
  else fail('version.json', JSON.stringify(ver));

  if (index.includes("APP_VERSION = '2.6.43'") && sw.includes('msb-pro-v2.6.43')
    && index.includes('id="app-version-label">v2.6.43')) {
    pass('app-sw-version');
  } else fail('app-sw-version', 'expected 2.6.43');

  if (twa.appVersion === '2.6.43' && twa.appVersionName === '2.6.43') pass('twa-manifest-version');
  else fail('twa-manifest-version', JSON.stringify({ v: twa.appVersion, n: twa.appVersionName }));

  if (index.includes('function currentMustFixCount(')
    && index.includes('function formatExportReadinessLine(')
    && index.includes('function confirmMustFixExport(')
    && index.includes('function printPostingSheet(')
    && index.includes('function buildWordExportHtml(')
    && index.includes('id="mustfix-export-modal"')) {
    pass('soft-gate-hooks');
  } else fail('soft-gate-hooks', 'print/export confirm helpers missing');

  if (index.includes('onclick="printPostingSheet(); closeHeaderMenu()"')
    && index.includes('onclick="printPostingSheet(); closeToolbarExportMenu()"')
    && index.includes("run: () => printPostingSheet()")
    && !index.includes('onclick="window.print();')) {
    pass('print-buttons-gated');
  } else fail('print-buttons-gated', 'bare window.print() still on Print buttons');

  if (index.includes("confirmMustFixExport('word'")
    && index.includes("confirmMustFixExport('excel'")) {
    pass('word-excel-gated');
  } else fail('word-excel-gated', 'Word/Excel never call confirmMustFixExport');

  if (index.includes('class="print-readiness"')
    && index.includes('class="export-readiness"')
    && index.includes("msbT('NOT READY · {n} must-fix — do not hang until fixed'")) {
    pass('readiness-line-hooks');
  } else fail('readiness-line-hooks', 'print/export readiness line missing');

  if (index.includes("'NOT READY · {n} must-fix — do not hang until fixed': 'NO LISTO · {n} a corregir — no lo cuelgues hasta arreglarlo'")
    && index.includes("'Print anyway': 'Imprimir igual'")
    && index.includes("'Open Review': 'Abrir Revisión'")
    && index.includes("'{n} must-fix still open. You can still print after you see this.': 'Quedan {n} a corregir. Aún puedes imprimir después de ver esto.'")
    && index.includes("'1 must-fix still open. You can still print after you see this.': 'Queda 1 a corregir. Aún puedes imprimir después de ver esto.'")) {
    pass('spanish-print-gate');
  } else fail('spanish-print-gate', 'missing ES confirm / readiness strings');
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
    localStorage.setItem('msb_pro_license', JSON.stringify({ key: 'TEST-PRO-KEY-999', unlockedAt: Date.now() }));
    return { periodNumber };
  });
}

function inPage(body) {
  return `(() => {
    function installPrintSpy() {
      window._printCalls = 0;
      window.print = function () { window._printCalls += 1; };
    }
    function modalState() {
      const modal = document.getElementById('mustfix-export-modal');
      const open = !!(modal && !modal.hasAttribute('hidden'));
      return {
        open: open,
        count: modal ? modal.getAttribute('data-mustfix-count') : null,
        kind: modal ? modal.getAttribute('data-export-kind') : null,
        title: ((document.getElementById('mustfix-export-title') || {}).textContent || '').trim(),
        body: ((document.getElementById('mustfix-export-body') || {}).textContent || '').trim(),
        proceed: ((document.getElementById('mustfix-export-proceed') || {}).textContent || '').trim(),
        review: ((document.getElementById('mustfix-export-review') || {}).textContent || '').trim(),
        printCalls: window._printCalls || 0
      };
    }
    ${body}
  })()`;
}

async function main() {
  console.log('\n=== v2.6.43 soft-gate Print / Word / Excel ===');
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
      localStorage.setItem('msb_welcome_dismissed', '1');
      localStorage.setItem('msb_ui_lang', 'en');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    const boot = await page.evaluate(() => ({
      version: (document.getElementById('app-version-label') || {}).textContent,
    }));
    if (/v2\.6\.42/.test(boot.version || '')) pass('in-app-version', boot.version);
    else fail('in-app-version', boot.version);

    const helpers = await page.evaluate(() => {
      return {
        zero: typeof formatExportReadinessLine === 'function' ? formatExportReadinessLine(0) : null,
        one: typeof formatExportReadinessLine === 'function' ? formatExportReadinessLine(1) : null,
        many: typeof formatExportReadinessLine === 'function' ? formatExportReadinessLine(23) : null,
      };
    });
    if (helpers.zero === '') pass('readiness-empty-when-zero');
    else fail('readiness-empty-when-zero', JSON.stringify(helpers));
    if (/NOT READY/.test(helpers.one || '') && /1/.test(helpers.one || '')
      && /23/.test(helpers.many || '') && /do not hang/i.test(helpers.many || '')) {
      pass('readiness-names-count', helpers.many);
    } else fail('readiness-names-count', JSON.stringify(helpers));

    const setup = await setupHuntBoard(page);
    await page.evaluate(() => {
      if (typeof generateSchedule === 'function') generateSchedule({ skipFreeCount: true });
    });
    await page.waitForTimeout(2200);

    const built = await page.evaluate(() => {
      const must = typeof currentMustFixCount === 'function' ? currentMustFixCount() : null;
      const print = document.getElementById('print-schedule');
      const printText = print ? (print.innerText || print.textContent || '') : '';
      const ready = print ? print.querySelector('.print-readiness') : null;
      const word = typeof buildWordExportHtml === 'function' ? buildWordExportHtml() : '';
      const excel = typeof buildExcelExportHtml === 'function' ? buildExcelExportHtml() : '';
      return {
        must,
        printHasReady: !!(ready && /NOT READY/.test(ready.textContent || '') && String(must).length && ready.textContent.indexOf(String(must)) !== -1),
        printLine: ready ? ready.textContent.trim() : '',
        printHasHang: /do not hang/i.test(printText),
        wordHasReady: /export-readiness/.test(word) && /NOT READY/.test(word) && word.indexOf(String(must)) !== -1,
        excelHasReady: /export-readiness/.test(excel) && /NOT READY/.test(excel) && excel.indexOf(String(must)) !== -1,
      };
    });
    if (setup.periodNumber === 8 && built.must > 0) pass('two-person-has-mustfix', 'mustFix=' + built.must);
    else fail('two-person-has-mustfix', JSON.stringify({ setup, built }));

    if (built.printHasReady && built.printHasHang) pass('print-readiness-on-mustfix', built.printLine);
    else fail('print-readiness-on-mustfix', JSON.stringify(built));
    if (built.wordHasReady) pass('word-readiness-on-mustfix');
    else fail('word-readiness-on-mustfix', 'Word HTML missing readiness line');
    if (built.excelHasReady) pass('excel-readiness-on-mustfix');
    else fail('excel-readiness-on-mustfix', 'Excel HTML missing readiness line');

    const printGate = await page.evaluate(inPage(`
      installPrintSpy();
      const immediate = printPostingSheet();
      return Object.assign({ immediate: immediate }, modalState());
    `));
    if (printGate.immediate === false && printGate.open && printGate.printCalls === 0
      && String(printGate.count) === String(built.must) && /NOT READY/.test(printGate.title)
      && printGate.body.indexOf(String(built.must)) !== -1) {
      pass('print-confirm-on-mustfix', printGate.body);
    } else fail('print-confirm-on-mustfix', JSON.stringify(printGate));

    const afterReview = await page.evaluate(inPage(`
      reviewMustFixExportConfirm();
      const sheet = document.getElementById('review-sheet');
      return {
        printCalls: window._printCalls || 0,
        reviewOpen: !!(sheet && sheet.classList.contains('open') && !sheet.hidden),
        modalOpen: modalState().open
      };
    `));
    if (afterReview.printCalls === 0 && afterReview.reviewOpen && !afterReview.modalOpen) {
      pass('confirm-can-jump-review');
    } else fail('confirm-can-jump-review', JSON.stringify(afterReview));

    await page.evaluate(() => {
      if (typeof closeReviewSheet === 'function') closeReviewSheet();
    });

    const afterPrint = await page.evaluate(inPage(`
      installPrintSpy();
      printPostingSheet();
      proceedMustFixExportConfirm();
      return { printCalls: window._printCalls || 0, modalOpen: modalState().open };
    `));
    if (afterPrint.printCalls === 1 && !afterPrint.modalOpen) pass('print-anyway-proceeds');
    else fail('print-anyway-proceeds', JSON.stringify(afterPrint));

    const wordGate = await page.evaluate(inPage(`
      const shown = confirmMustFixExport('word', function () { window._wordProceeded = true; });
      window._wordProceeded = window._wordProceeded || false;
      const mid = modalState();
      proceedMustFixExportConfirm();
      return { shown: shown, mid: mid, proceeded: window._wordProceeded === true };
    `));
    if (wordGate.shown === false && wordGate.mid.open && wordGate.mid.kind === 'word'
      && wordGate.proceeded && /Word/i.test(wordGate.mid.proceed)) {
      pass('word-confirm-then-proceed', wordGate.mid.body);
    } else fail('word-confirm-then-proceed', JSON.stringify(wordGate));

    const excelGate = await page.evaluate(inPage(`
      const shown = confirmMustFixExport('excel', function () { window._excelProceeded = true; });
      window._excelProceeded = window._excelProceeded || false;
      const mid = modalState();
      proceedMustFixExportConfirm();
      return { shown: shown, mid: mid, proceeded: window._excelProceeded === true };
    `));
    if (excelGate.shown === false && excelGate.mid.open && excelGate.mid.kind === 'excel'
      && excelGate.proceeded) {
      pass('excel-confirm-then-proceed', excelGate.mid.body);
    } else fail('excel-confirm-then-proceed', JSON.stringify(excelGate));

    await page.evaluate(() => {
      if (typeof setUiLang === 'function') setUiLang('es');
      if (typeof renderPrintSchedule === 'function' && lastScheduleRenderArgs) {
        renderPrintSchedule(lastScheduleRenderArgs.ROLES, lastScheduleRenderArgs.ALL_KC);
      }
    });
    await page.waitForTimeout(300);

    const es = await page.evaluate(inPage(`
      const ready = ((document.querySelector('#print-schedule .print-readiness') || {}).textContent || '').trim();
      const word = typeof buildWordExportHtml === 'function' ? buildWordExportHtml() : '';
      const excel = typeof buildExcelExportHtml === 'function' ? buildExcelExportHtml() : '';
      installPrintSpy();
      printPostingSheet();
      const mid = modalState();
      closeMustFixExportConfirm();
      return { ready: ready, wordEs: /NO LISTO/.test(word), excelEs: /NO LISTO/.test(excel), mid: mid };
    `));
    if (/NO LISTO/.test(es.ready) && /a corregir/.test(es.ready) && !/NOT READY/.test(es.ready)) {
      pass('spanish-print-readiness', es.ready);
    } else fail('spanish-print-readiness', es.ready);
    if (es.wordEs && es.excelEs) pass('spanish-export-readiness');
    else fail('spanish-export-readiness', JSON.stringify({ word: es.wordEs, excel: es.excelEs }));
    if (es.mid.open && /NO LISTO/.test(es.mid.title) && /Imprimir igual/.test(es.mid.proceed)
      && /Abrir Revisión/.test(es.mid.review) && es.mid.printCalls === 0) {
      pass('spanish-print-confirm', es.mid.body);
    } else fail('spanish-print-confirm', JSON.stringify(es.mid));

    await page.evaluate(() => {
      if (typeof setUiLang === 'function') setUiLang('en');
      const r = window._lastGenReport || {};
      r.mustFixCount = 0;
      r.hardErrorCount = 0;
      if (!r.quality) r.quality = {};
      r.quality.mustFixCount = 0;
      window._lastGenReport = r;
      if (typeof renderPrintSchedule === 'function' && lastScheduleRenderArgs) {
        renderPrintSchedule(lastScheduleRenderArgs.ROLES, lastScheduleRenderArgs.ALL_KC);
      }
    });

    const clean = await page.evaluate(inPage(`
      const must = currentMustFixCount();
      const print = document.getElementById('print-schedule');
      const ready = print ? print.querySelector('.print-readiness') : null;
      const printText = print ? (print.innerText || print.textContent || '') : '';
      const word = buildWordExportHtml();
      const excel = buildExcelExportHtml();
      installPrintSpy();
      const immediate = printPostingSheet();
      const mid = modalState();
      const wordImmediate = confirmMustFixExport('word', function () { window._cleanWord = true; });
      const excelImmediate = confirmMustFixExport('excel', function () { window._cleanExcel = true; });
      return {
        must: must,
        hasReadyEl: !!ready,
        printHasNotReady: /NOT READY|NO LISTO/.test(printText),
        wordHasReady: /export-readiness|NOT READY|NO LISTO/.test(word),
        excelHasReady: /export-readiness|NOT READY|NO LISTO/.test(excel),
        immediate: immediate,
        mid: mid,
        wordImmediate: wordImmediate,
        excelImmediate: excelImmediate,
        cleanWord: window._cleanWord === true,
        cleanExcel: window._cleanExcel === true,
        printCalls: window._printCalls || 0
      };
    `));
    if (clean.must === 0 && !clean.hasReadyEl && !clean.printHasNotReady
      && !clean.wordHasReady && !clean.excelHasReady) {
      pass('zero-mustfix-sheets-unchanged');
    } else fail('zero-mustfix-sheets-unchanged', JSON.stringify(clean));
    if (clean.immediate === true && !clean.mid.open && clean.printCalls === 1
      && clean.wordImmediate === true && clean.excelImmediate === true
      && clean.cleanWord && clean.cleanExcel) {
      pass('zero-mustfix-no-confirm');
    } else fail('zero-mustfix-no-confirm', JSON.stringify(clean));
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
