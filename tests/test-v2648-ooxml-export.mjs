/**
 * v2.6.48: real Office Open XML Word (.docx) + Excel (.xlsx).
 * Assert ZIP/OOXML structure, not HTML-as-.doc / HTML-as-.xls.
 * Soft-confirm / NOT READY stay. Run: node tests/test-v2648-ooxml-export.mjs
 */
import { createRequire } from 'module';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, writeFileSync, mkdirSync } from 'fs';
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
  const ctypes = files['[Content_Types].xml'].text;
  if (kind === 'docx') {
    if (!/wordprocessingml\.document\.main\+xml/.test(ctypes)) throw new Error('docx Content_Types missing document part');
    const doc = files['word/document.xml'].text;
    if (/<!DOCTYPE html|<html xmlns/.test(doc)) throw new Error('docx document is HTML');
  } else {
    if (!/spreadsheetml\.sheet\.main\+xml/.test(ctypes)) throw new Error('xlsx Content_Types missing workbook');
    if (!/worksheets\/sheet1\.xml/.test(files['xl/_rels/workbook.xml.rels'].text)) {
      throw new Error('xlsx workbook rels missing sheet');
    }
    const sheet = files['xl/worksheets/sheet1.xml'].text;
    if (/<!DOCTYPE html|<html xmlns/.test(sheet)) throw new Error('xlsx sheet is HTML');
  }
  return { names: names, files: files };
}

function staticChecks() {
  console.log('\n=== static ===');
  const index = read('app/index.html');
  const sw = read('sw.js');
  const ver = JSON.parse(read('version.json'));
  const twa = JSON.parse(read('android-twa/twa-manifest.json'));
  const gradle = read('android-twa/app/build.gradle');
  const landing = read('index.html');

  if (ver.version === '2.6.48') pass('version.json', ver.version);
  else fail('version.json', JSON.stringify(ver));

  if (index.includes("APP_VERSION = '2.6.48'") && sw.includes('msb-pro-v2.6.48')
    && index.includes('id="app-version-label">v2.6.48')) {
    pass('app-sw-version');
  } else fail('app-sw-version', 'expected 2.6.48');

  if (twa.appVersion === '2.6.48' && twa.appVersionName === '2.6.48'
    && /versionCode 2648/.test(gradle) && /versionName "2.6.48"/.test(gradle)) {
    pass('twa-version');
  } else fail('twa-version', JSON.stringify({ v: twa.appVersion, n: twa.appVersionName }));

  if (existsSync(join(ROOT, 'app/ooxml-export.js'))
    && index.includes('src="ooxml-export.js"')
    && sw.includes("'./app/ooxml-export.js'")) {
    pass('ooxml-script-bundled');
  } else fail('ooxml-script-bundled', 'ooxml-export.js not wired for offline');

  const wordDl = sliceFn(index, 'downloadWordExport');
  const excelDl = sliceFn(index, 'downloadExcelExport');
  if (/buildDocx/.test(wordDl) && /officeExportFilename\('\.docx'\)/.test(wordDl)
    && /MIME_DOCX/.test(wordDl) && !/application\/msword/.test(wordDl)
    && !/\.doc'/.test(wordDl) && !/buildWordExportHtml/.test(wordDl)) {
    pass('word-download-is-docx');
  } else fail('word-download-is-docx', wordDl.slice(0, 400));

  if (/buildXlsx/.test(excelDl) && /officeExportFilename\('\.xlsx'\)/.test(excelDl)
    && /MIME_XLSX/.test(excelDl) && !/application\/vnd\.ms-excel/.test(excelDl)
    && !/buildExcelExportHtml/.test(excelDl)) {
    pass('excel-download-is-xlsx');
  } else fail('excel-download-is-xlsx', excelDl.slice(0, 400));

  if (index.includes("confirmMustFixExport('word'")
    && index.includes("confirmMustFixExport('excel'")
    && index.includes('function formatExportReadinessLine(')) {
    pass('soft-gate-kept');
  } else fail('soft-gate-kept', 'Word/Excel confirm or readiness helper missing');

  if (index.includes('Real Microsoft Word (.docx) and Excel (.xlsx) export on Pro.')
    && landing.includes('Real Word (.docx) / Excel (.xlsx) on Pro.')) {
    pass('feature-map-real-office');
  } else fail('feature-map-real-office', 'Feature Map / landing still omit real .docx/.xlsx');
}

function unitChecks() {
  console.log('\n=== ooxml unit ===');
  const stamp = new Date(Date.UTC(2026, 8, 16, 12, 0, 0));
  const docx = OOXML.buildDocx(FIXTURE, stamp);
  const xlsx = OOXML.buildXlsx(FIXTURE, stamp);
  try {
    const pack = assertOfficePackage(docx, 'docx');
    const doc = pack.files['word/document.xml'].text;
    if (!/MANAGEMENT SCHEDULE/.test(doc) || !/Store # 0851/.test(doc)
      || !/NOT READY/.test(doc) || !/Dana/.test(doc) || !/OPEN 9-5/.test(doc)) {
      throw new Error('docx fixture content incomplete');
    }
    pass('docx-ooxml', pack.names.length + ' parts');
  } catch (e) {
    fail('docx-ooxml', e.message || e);
  }
  try {
    const pack = assertOfficePackage(xlsx, 'xlsx');
    const sheet = pack.files['xl/worksheets/sheet1.xml'].text;
    if (!/MANAGEMENT SCHEDULE/.test(sheet) || !/Store: 0851/.test(sheet)
      || !/NOT READY/.test(sheet) || !/Dana/.test(sheet) || !/OPEN 9-5/.test(sheet)) {
      throw new Error('xlsx fixture content incomplete');
    }
    pass('xlsx-ooxml', pack.names.length + ' parts');
  } catch (e) {
    fail('xlsx-ooxml', e.message || e);
  }
  if (OOXML.MIME_DOCX.indexOf('wordprocessingml') !== -1
    && OOXML.MIME_XLSX.indexOf('spreadsheetml') !== -1) {
    pass('office-mime');
  } else fail('office-mime', OOXML.MIME_DOCX + ' ' + OOXML.MIME_XLSX);

  const outDir = '/tmp/msb-ooxml-fixtures';
  try {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'fixture.docx'), Buffer.from(docx));
    writeFileSync(join(outDir, 'fixture.xlsx'), Buffer.from(xlsx));
    pass('wrote-fixture-files', outDir);
  } catch (e) {
    fail('wrote-fixture-files', e.message || e);
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
      acceptDownloads: true,
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
    if (/v2\.6\.48/.test(boot.version || '') && boot.hasOoxml) pass('in-app-ooxml', boot.version);
    else fail('in-app-ooxml', JSON.stringify(boot));

    const setup = await setupHuntBoard(page);
    await page.evaluate(() => {
      if (typeof generateSchedule === 'function') generateSchedule({ skipFreeCount: true });
    });
    await page.waitForTimeout(2200);

    const built = await page.evaluate(() => {
      const model = typeof buildExportModel === 'function' ? buildExportModel() : null;
      const docx = model && MSB_OOXML.buildDocx(model);
      const xlsx = model && MSB_OOXML.buildXlsx(model);
      const toArr = (u8) => (u8 ? Array.from(u8) : []);
      return {
        period: currentPeriod ? currentPeriod.number : null,
        must: typeof currentMustFixCount === 'function' ? currentMustFixCount() : null,
        title: model && model.title,
        readiness: model && model.readiness,
        weeks: model && model.weeks ? model.weeks.length : 0,
        firstName: model && model.weeks && model.weeks[0] && model.weeks[0].rows[0]
          ? model.weeks[0].rows[0].name : '',
        wordName: typeof officeExportFilename === 'function' ? officeExportFilename('.docx') : '',
        excelName: typeof officeExportFilename === 'function' ? officeExportFilename('.xlsx') : '',
        docx: toArr(docx),
        xlsx: toArr(xlsx),
        mimeDocx: MSB_OOXML.MIME_DOCX,
        mimeXlsx: MSB_OOXML.MIME_XLSX
      };
    });

    if (setup.periodNumber === 8 && built.must > 0 && built.weeks > 0 && built.firstName === 'Dana') {
      pass('live-model', 'mustFix=' + built.must + ' weeks=' + built.weeks);
    } else fail('live-model', JSON.stringify({ setup, period: built.period, must: built.must, weeks: built.weeks, name: built.firstName }));

    if (/Store0851/.test(built.wordName) && /\.docx$/.test(built.wordName)
      && /\.xlsx$/.test(built.excelName) && /wordprocessingml/.test(built.mimeDocx)
      && /spreadsheetml/.test(built.mimeXlsx)) {
      pass('live-filenames', built.wordName + ' + ' + built.excelName);
    } else fail('live-filenames', JSON.stringify({ w: built.wordName, x: built.excelName }));

    try {
      const docxBytes = Uint8Array.from(built.docx);
      const xlsxBytes = Uint8Array.from(built.xlsx);
      const docPack = assertOfficePackage(docxBytes, 'docx');
      const xPack = assertOfficePackage(xlsxBytes, 'xlsx');
      const doc = docPack.files['word/document.xml'].text;
      const sheet = xPack.files['xl/worksheets/sheet1.xml'].text;
      if (!/NOT READY/.test(doc) || !/NOT READY/.test(sheet)) {
        throw new Error('live files dropped readiness line');
      }
      if (!/Dana/.test(doc) || !/Alex/.test(sheet)) {
        throw new Error('live files dropped names');
      }
      if (!/0851/.test(doc) || !/0851/.test(sheet)) {
        throw new Error('live files dropped store number');
      }
      pass('live-ooxml-bytes', 'docx=' + docxBytes.length + ' xlsx=' + xlsxBytes.length);
    } catch (e) {
      fail('live-ooxml-bytes', e.message || e);
    }

    await page.evaluate(() => {
      if (typeof setUiLang === 'function') setUiLang('es');
    });
    const es = await page.evaluate(() => {
      const model = buildExportModel();
      const doc = MSB_OOXML.unzipStore(MSB_OOXML.buildDocx(model));
      const sheet = MSB_OOXML.unzipStore(MSB_OOXML.buildXlsx(model));
      return {
        ready: model.readiness || '',
        word: doc['word/document.xml'].text,
        excel: sheet['xl/worksheets/sheet1.xml'].text
      };
    });
    if (/NO LISTO/.test(es.ready) && /NO LISTO/.test(es.word) && /NO LISTO/.test(es.excel)
      && !/NOT READY/.test(es.word)) {
      pass('spanish-readiness-ooxml', es.ready);
    } else fail('spanish-readiness-ooxml', es.ready);
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('\n=== v2.6.48 real Word + Excel OOXML ===');
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
