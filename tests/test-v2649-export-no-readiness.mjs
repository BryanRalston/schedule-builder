/**
 * v2.6.50: readiness / NOT READY hang banner is UI-only.
 * Exported .docx / .xlsx and the print sheet must not include it.
 * Soft-confirm and in-app Review / Posting stay. Real OOXML stays.
 * Run: node tests/test-v2649-export-no-readiness.mjs
 */
import { createRequire } from 'module';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const require = createRequire(import.meta.url);
const OOXML = require('../app/ooxml-export.js');

const results = [];
function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log('  PASS', name, detail ? '— ' + detail : '');
}
function fail(name, detail) {
  results.push({ name, ok: false, detail: String(detail) });
  console.log('  FAIL', name, '—', detail);
}

const HANG = /NOT READY|NO LISTO|must-fix|do not hang|no lo cuelgues/i;

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

function sliceFn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) return '';
  let i = src.indexOf('{', start);
  if (i < 0) return '';
  let depth = 0;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return src.slice(start);
}

function pkZip(bytes) {
  return bytes && bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

const FIXTURE = {
  title: 'MANAGEMENT SCHEDULE',
  subtitle: 'Store # 0851 | Period 8 | FY2026 | October | 9/27 – 10/31',
  excelSubtitle: 'Store: 0851     Period 8  FY2026  October',
  readiness: 'NOT READY · 3 must-fix — do not hang until fixed',
  nameHeader: 'Name',
  legend: [
    { bg: '#d1fae5', label: 'Open' },
    { bg: '#e0e7ff', label: 'Mid' },
    { bg: '#fce7f3', label: 'Close' }
  ],
  dayHeaders: ['SUN', 'MON', 'TUES', 'WED', 'THURS', 'FRI', 'SAT'],
  weeks: [{
    wordBanner: 'Week Ending Saturday 10/3/2026',
    excelBanner: 'W/E 10/3',
    dates: [27, 28, 29, 30, 1, 2, 3],
    rows: [{
      name: 'Dana',
      cells: [
        { label: 'OPEN 9-5', bg: '#d1fae5', color: '#065f46' },
        { label: 'MID', bg: '#e0e7ff', color: '#3730a3' },
        { label: 'CLOSE', bg: '#fce7f3', color: '#9d174d' },
        { label: 'OFF', bg: '#f3f4f6', color: '#6b7280' },
        { label: 'RTO', bg: '#ffedd5', color: '#9a3412' },
        { label: 'VAC', bg: '#dbeafe', color: '#1e40af' },
        { label: 'LOA', bg: '#ccfbf1', color: '#0f766e' }
      ]
    }]
  }]
};

function assertOfficePackage(bytes, kind) {
  if (!pkZip(bytes)) throw new Error(kind + ' missing PK zip magic');
  const files = OOXML.unzipStore(bytes);
  const names = Object.keys(files);
  const need = kind === 'docx'
    ? ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/_rels/document.xml.rels']
    : ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/_rels/workbook.xml.rels'];
  const missing = need.filter((n) => !files[n]);
  if (missing.length) throw new Error(kind + ' missing ' + missing.join(', '));
  return { names: names, files: files };
}

function staticChecks() {
  console.log('\n=== static ===');
  const index = read('app/index.html');
  const sw = read('sw.js');
  const ver = JSON.parse(read('version.json'));
  const twa = JSON.parse(read('android-twa/twa-manifest.json'));
  const gradle = read('android-twa/app/build.gradle');

  if (ver.version === '2.6.50') pass('version.json', ver.version);
  else fail('version.json', JSON.stringify(ver));

  if (index.includes("APP_VERSION = '2.6.50'") && sw.includes('msb-pro-v2.6.50')
    && index.includes('id="app-version-label">v2.6.50')) {
    pass('app-sw-version');
  } else fail('app-sw-version', 'expected 2.6.50');

  if (twa.appVersion === '2.6.50' && twa.appVersionName === '2.6.50'
    && /versionCode 2650/.test(gradle) && /versionName "2.6.50"/.test(gradle)) {
    pass('twa-version');
  } else fail('twa-version', JSON.stringify({ v: twa.appVersion, n: twa.appVersionName }));

  const printFn = sliceFn(index, 'renderPrintSchedule');
  const wordFn = sliceFn(index, 'buildWordExportHtml');
  const excelFn = sliceFn(index, 'buildExcelExportHtml');
  const modelFn = sliceFn(index, 'buildExportModel');
  if (printFn && !/print-readiness|formatExportReadinessLine|exportReadinessBannerHtml/.test(printFn)
    && wordFn && !/exportReadinessBannerHtml|export-readiness|formatExportReadinessLine/.test(wordFn)
    && excelFn && !/export-readiness|formatExportReadinessLine/.test(excelFn)
    && modelFn && !/formatExportReadinessLine|\breadiness\s*:/.test(modelFn)) {
    pass('builders-omit-readiness');
  } else fail('builders-omit-readiness', 'print/word/excel/model still inject readiness');

  const ooxml = read('app/ooxml-export.js');
  if (!/m\.readiness/.test(ooxml) && /UI-only/.test(ooxml)) {
    pass('ooxml-ignores-readiness');
  } else fail('ooxml-ignores-readiness', 'ooxml-export still writes m.readiness');

  if (index.includes("confirmMustFixExport('word'")
    && index.includes("confirmMustFixExport('excel'")
    && index.includes('function confirmMustFixExport(')
    && index.includes('id="mustfix-export-modal"')
    && index.includes('function formatExportReadinessLine(')
    && index.includes("requirePro('Word export')")
    && index.includes("requirePro('Excel export')")) {
    pass('soft-confirm-and-pro-gate-kept');
  } else fail('soft-confirm-and-pro-gate-kept', 'in-app gate or Pro gate missing');

  if (index.includes('If must-fix items remain, Print / Word / Excel ask you to confirm first.')
    && !/export includes a NOT READY|NOT READY line on the (print|sheet|export)/i.test(index)) {
    pass('feature-map-unchanged');
  } else fail('feature-map-unchanged', 'Feature Map copy drifted');
}

function unitChecks() {
  console.log('\n=== ooxml unit ===');
  const stamp = new Date(Date.UTC(2026, 8, 16, 12, 0, 0));
  const docx = OOXML.buildDocx(FIXTURE, stamp);
  const xlsx = OOXML.buildXlsx(FIXTURE, stamp);
  try {
    const pack = assertOfficePackage(docx, 'docx');
    const doc = pack.files['word/document.xml'].text;
    if (!/MANAGEMENT SCHEDULE/.test(doc) || !/Dana/.test(doc) || !/OPEN 9-5/.test(doc)) {
      throw new Error('docx fixture missing schedule content');
    }
    if (HANG.test(doc)) throw new Error('docx still contains readiness hang language');
    pass('docx-omits-readiness', pack.names.length + ' parts');
  } catch (e) {
    fail('docx-omits-readiness', e.message || e);
  }
  try {
    const pack = assertOfficePackage(xlsx, 'xlsx');
    const sheet = pack.files['xl/worksheets/sheet1.xml'].text;
    if (!/MANAGEMENT SCHEDULE/.test(sheet) || !/Dana/.test(sheet) || !/OPEN 9-5/.test(sheet)) {
      throw new Error('xlsx fixture missing schedule content');
    }
    if (HANG.test(sheet)) throw new Error('xlsx still contains readiness hang language');
    pass('xlsx-omits-readiness', pack.names.length + ' parts');
  } catch (e) {
    fail('xlsx-omits-readiness', e.message || e);
  }
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
    const store = document.getElementById('store-number');
    if (sm) sm.value = 'Dana';
    if (am) am.value = 'Alex';
    if (store) store.value = '0851';
    if (typeof persistManagerNames === 'function') persistManagerNames();
    if (typeof toggleFederalHoliday === 'function') {
      FEDERAL_HOLIDAY_DEFS.forEach((d) => toggleFederalHoliday(d.id, d.id === 'labor'));
    }
    if (typeof syncFederalHolidaysToPeriod === 'function') syncFederalHolidaysToPeriod();
    localStorage.setItem('msb_pro_license', JSON.stringify({ key: 'TEST-PRO-KEY-999', unlockedAt: Date.now() }));
    return { periodNumber };
  });
}

async function browserChecks(base, chromium) {
  console.log('\n=== browser ===');
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
    await page.goto(base + '/app/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
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
      hasOoxml: typeof MSB_OOXML !== 'undefined' && typeof MSB_OOXML.buildDocx === 'function',
    }));
    if (/v2\.6\.49/.test(boot.version || '') && boot.hasOoxml) pass('in-app-ooxml', boot.version);
    else fail('in-app-ooxml', JSON.stringify(boot));

    const setup = await setupHuntBoard(page);
    await page.evaluate(() => {
      if (typeof generateSchedule === 'function') generateSchedule({ skipFreeCount: true });
    });
    await page.waitForTimeout(2200);

    const live = await page.evaluate(() => {
      const must = typeof currentMustFixCount === 'function' ? currentMustFixCount() : null;
      const model = typeof buildExportModel === 'function' ? buildExportModel() : null;
      const print = document.getElementById('print-schedule');
      const printText = print ? (print.innerText || print.textContent || '') : '';
      const printReady = print ? print.querySelector('.print-readiness') : null;
      const wordHtml = typeof buildWordExportHtml === 'function' ? buildWordExportHtml() : '';
      const excelHtml = typeof buildExcelExportHtml === 'function' ? buildExcelExportHtml() : '';
      const docx = model && MSB_OOXML.buildDocx(model);
      const xlsx = model && MSB_OOXML.buildXlsx(model);
      const toArr = (u8) => (u8 ? Array.from(u8) : []);
      const posting = document.querySelector('.posting-badge');
      return {
        must,
        modelReady: model && model.readiness,
        printHasReadyEl: !!printReady,
        printText: printText,
        wordHtml: wordHtml,
        excelHtml: excelHtml,
        docx: toArr(docx),
        xlsx: toArr(xlsx),
        posting: posting ? posting.textContent.trim() : '',
        firstName: model && model.weeks && model.weeks[0] && model.weeks[0].rows[0]
          ? model.weeks[0].rows[0].name : ''
      };
    });

    if (setup.periodNumber === 8 && live.must > 0 && live.firstName === 'Dana') {
      pass('live-mustfix-board', 'mustFix=' + live.must);
    } else fail('live-mustfix-board', JSON.stringify({ setup, must: live.must, name: live.firstName }));

    if (!live.modelReady && !live.printHasReadyEl && !HANG.test(live.printText)) {
      pass('print-html-omits-readiness');
    } else fail('print-html-omits-readiness', JSON.stringify({
      modelReady: live.modelReady,
      el: live.printHasReadyEl
    }));

    if (!HANG.test(live.wordHtml || '') && !HANG.test(live.excelHtml || '')) {
      pass('legacy-html-builders-omit-readiness');
    } else fail('legacy-html-builders-omit-readiness', 'Word/Excel HTML leaked hang language');

    try {
      const docxBytes = Uint8Array.from(live.docx);
      const xlsxBytes = Uint8Array.from(live.xlsx);
      const doc = assertOfficePackage(docxBytes, 'docx').files['word/document.xml'].text;
      const sheet = assertOfficePackage(xlsxBytes, 'xlsx').files['xl/worksheets/sheet1.xml'].text;
      if (HANG.test(doc) || HANG.test(sheet)) throw new Error('live OOXML leaked hang language');
      if (!/Dana/.test(doc) || !/Alex/.test(sheet) || !/0851/.test(doc)) {
        throw new Error('live OOXML dropped schedule content');
      }
      pass('live-ooxml-omits-readiness', 'docx=' + docxBytes.length + ' xlsx=' + xlsxBytes.length);
    } catch (e) {
      fail('live-ooxml-omits-readiness', e.message || e);
    }

    if (/Not ready/i.test(live.posting || '')) pass('in-app-posting-still-shows-readiness', live.posting);
    else fail('in-app-posting-still-shows-readiness', live.posting);

    const gate = await page.evaluate(() => {
      const shown = confirmMustFixExport('word', function () { window._wordGo = true; });
      const modal = document.getElementById('mustfix-export-modal');
      const title = ((document.getElementById('mustfix-export-title') || {}).textContent || '').trim();
      const body = ((document.getElementById('mustfix-export-body') || {}).textContent || '').trim();
      const open = !!(modal && !modal.hasAttribute('hidden'));
      const kind = modal ? modal.getAttribute('data-export-kind') : null;
      proceedMustFixExportConfirm();
      return { shown, open, title, body, kind, proceeded: window._wordGo === true };
    });
    if (gate.shown === false && gate.open && gate.kind === 'word'
      && /NOT READY/.test(gate.title) && /must-fix/.test(gate.body) && gate.proceeded) {
      pass('soft-confirm-still-in-app', gate.body);
    } else fail('soft-confirm-still-in-app', JSON.stringify(gate));

    const review = await page.evaluate(() => {
      if (typeof openReviewSheet === 'function') openReviewSheet();
      const sheet = document.getElementById('review-sheet');
      const open = !!(sheet && sheet.classList.contains('open') && !sheet.hidden);
      const text = sheet ? (sheet.innerText || sheet.textContent || '') : '';
      return { open: open, hasMust: /must-fix|Not ready|not ready/i.test(text) };
    });
    if (review.open && review.hasMust) pass('in-app-review-still-shows-readiness');
    else fail('in-app-review-still-shows-readiness', JSON.stringify(review));
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('\n=== v2.6.50 export readiness is UI-only ===');
  staticChecks();
  unitChecks();

  let server;
  try {
    const chromium = await loadChromium();
    const started = await startStaticServer();
    server = started.server;
    await browserChecks(started.base, chromium);
  } catch (e) {
    fail('browser-harness', e && e.stack ? e.stack : e);
  } finally {
    if (server) server.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n' + results.filter((r) => r.ok).length + ' passed,', failed.length, 'failed');
  if (failed.length) {
    failed.forEach((f) => console.log('  still failing:', f.name, f.detail));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
