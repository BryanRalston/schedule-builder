/**
 * v2.6.26: finish leftover Spanish review / board / export / backup chrome.
 * Review drawer + board chrome + export leftover strings are Spanish when locale is ES.
 * Tour does not revert the Setup heading to English "Store & team".
 * Mixed "8 missing" / "17 faltan" is one language, one story.
 * detectDeviceUiLang() accepts injected es / es-MX / es-US (lab check).
 * Playwright locale and init-script injection are lab checks only —
 * a real Spanish-locale phone is still required to confirm the device-default path.
 * 2.6.25 picker / persist / roster-untranslated still hold.
 * Keeps 2.6.12–2.6.25 behavior; version lock 2.6.31.
 * Run: node tests/test-v2626-ux.mjs
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

const LEFTOVER_KEYS = [
  'Clopen radar',
  'close→open pair',
  'Weekend fairness',
  'Everyone met their weekend-off target for this period.',
  'Met',
  'Goal',
  '{n} days missing open or close',
  '{n} missing',
  'Two people with days off cannot cover Open+Close every day.',
  'Review issues',
  'New phone? Export a JSON backup, then Load on the new device.',
  'Coverage',
  'Store hours',
  'Generated {when}',
  'Your team',
  'Store & team',
];

/** English chrome that must not appear on review / board / export surfaces in ES. */
const FORBIDDEN_EN = [
  'Clopen radar',
  'Weekend fairness',
  'Everyone met their weekend-off target',
  'Review issues',
  'New phone? Export a JSON backup',
  'days missing open or close',
  'day missing open or close',
  'Two people with days off cannot cover',
  'Store & team',
  'close→open pair',
  'close→open pairs',
];

/** Intentionally left in English on review/board/export. Ideally none. */
const INTENTIONAL_EN_LEFTOVERS = [];

async function main() {
  console.log('\n=== v2.6.26 finish leftover Spanish review / board chrome ===');
  console.log('  NOTE: detectDeviceUiLang injection is a lab check. A real Spanish-locale phone is still required.');

  const version = JSON.parse(read('version.json'));
  if (version.version === '2.6.31') pass('version.json', version.version);
  else fail('version.json', JSON.stringify(version));

  const sw = read('sw.js');
  if (sw.includes("const CACHE = 'msb-pro-v2.6.31'")) pass('sw-cache');
  else fail('sw-cache', sw.slice(0, 120));

  const index = read('index.html');
  if (index.includes("const APP_VERSION = '2.6.31'") && index.includes('id="app-version-label">v2.6.31')) {
    pass('index-version');
  } else fail('index-version', 'APP_VERSION / label mismatch');

  if (/function detectDeviceUiLang\(/.test(index)
    && /function formatMissingDaysShort\(/.test(index)
    && /function formatMissingDaysLong\(/.test(index)
    && /function localizeQualityGrade\(/.test(index)
    && /real Spanish-locale phone is still required/.test(index)
    && /function clopenCellTitle\(/.test(index)) {
    pass('v2626-fns');
  } else fail('v2626-fns', '2.6.26 helpers or phone-check note missing');

  const missingKeys = LEFTOVER_KEYS.filter((k) => !index.includes("'" + k.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"));
  if (!missingKeys.length) pass('es-dict-leftover-keys', LEFTOVER_KEYS.length + ' keys');
  else fail('es-dict-leftover-keys', missingKeys.join(' · '));

  if (/function detectDeviceUiLang\(/.test(index)
    && /function getUiLangOverride\(/.test(index)
    && /function resolveUiLang\(/.test(index)
    && /function msbT\(/.test(index)
    && /function setUiLang\(/.test(index)
    && /function applyStaticI18n\(/.test(index)
    && /const MSB_I18N_ES =/.test(index)
    && /id="ap-lang-select"/.test(index)
    && /id="more-lang-select"/.test(index)
    && /MSB_LANG_KEY/.test(index)) {
    pass('v2625-fns-kept');
  } else fail('v2625-fns-kept', '2.6.25 language helpers or picker missing');

  if (/const thinRoster = ROLES\.length <= 2/.test(index)
    && /function leftoverMustFixViolations\(/.test(index)
    && /function shouldRecordFreeGenerate\(/.test(index)
    && /freeGenerateLimit: 2/.test(index)
    && /welcome-after-board/.test(index)
    && /id="btn-pro-gate-not-now"/.test(index)
    && /Undo request/.test(index)) {
    pass('v2612-v2625-kept');
  } else fail('v2612-v2625-kept', '2.6.12–2.6.25 markers missing');

  if (!/TJX|Marshalls|HomeGoods|Winners/i.test(index)) pass('no-employer-names');
  else fail('no-employer-names', 'employer name leaked into copy');

  if (/NRF 4-5-4 is the U\.S\. retail fiscal calendar/.test(index)
    && /does not apply Spain or Mexico labor rules/.test(index)
    && /No aplica reglas laborales de España ni México/.test(index)) {
    pass('nrf-stays-us-retail');
  } else fail('nrf-stays-us-retail', 'US NRF disclaimer missing');

  if (!/googleapis\.com\/language|translate\.googleapis|cloud.?translate api|openai|anthropic|copilot that uploads/i.test(index)) {
    pass('no-cloud-translate');
  } else fail('no-cloud-translate', 'cloud translate / AI roster upload leaked in');

  const chromium = await loadChromium();
  const { server, base } = await startStaticServer();
  const browser = await chromium.launch({
    executablePath: existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
    });
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('msb_tour_done', '1');
      localStorage.setItem('msb_welcome_dismissed', '1');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);

    const injected = await page.evaluate(() => {
      return {
        es: typeof detectDeviceUiLang === 'function' ? detectDeviceUiLang('es') : '',
        esMX: typeof detectDeviceUiLang === 'function' ? detectDeviceUiLang('es-MX') : '',
        esUS: typeof detectDeviceUiLang === 'function' ? detectDeviceUiLang('es-US') : '',
        esObj: typeof detectDeviceUiLang === 'function'
          ? detectDeviceUiLang({ language: 'es-MX', languages: ['es-MX', 'es'] })
          : '',
        en: typeof detectDeviceUiLang === 'function' ? detectDeviceUiLang('en-US') : '',
        override: typeof getUiLangOverride === 'function' ? getUiLangOverride() : 'x',
      };
    });
    if (injected.es === 'es' && injected.esMX === 'es' && injected.esUS === 'es'
      && injected.esObj === 'es' && injected.en === 'en' && injected.override == null) {
      pass('detect-inject-es-tags', 'es / es-MX / es-US → es; en-US → en; no persist');
    } else fail('detect-inject-es-tags', JSON.stringify(injected));

    await page.close();

    const injectPage = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
    });
    await injectPage.addInitScript(() => {
      Object.defineProperty(navigator, 'language', { get: () => 'es-US' });
      Object.defineProperty(navigator, 'languages', { get: () => ['es-US', 'es'] });
    });
    await injectPage.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await injectPage.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('msb_tour_done', '1');
      localStorage.setItem('msb_welcome_dismissed', '1');
    });
    await injectPage.reload({ waitUntil: 'domcontentloaded' });
    await injectPage.waitForTimeout(700);
    const injectChrome = await injectPage.evaluate(() => ({
      saved: localStorage.getItem('msb_ui_lang'),
      detected: typeof detectDeviceUiLang === 'function' ? detectDeviceUiLang() : '',
      resolved: typeof resolveUiLang === 'function' ? resolveUiLang() : '',
      lang: document.documentElement.lang,
      setup: (document.getElementById('tabbtn-setup') || {}).textContent || '',
      heading: (document.getElementById('setup-panel-title') || {}).textContent || '',
      nav: navigator.language,
    }));
    if (injectChrome.saved == null && injectChrome.detected === 'es' && injectChrome.resolved === 'es'
      && injectChrome.lang === 'es' && /Equipo/.test(injectChrome.setup)
      && /Tienda y equipo|Tu equipo/.test(injectChrome.heading)
      && !/Store & team/.test(injectChrome.heading)) {
      pass('inject-navigator-es-us-chrome', injectChrome.nav + ' → ' + injectChrome.heading.trim());
    } else fail('inject-navigator-es-us-chrome', JSON.stringify(injectChrome));
    await injectPage.close();

    const esPage = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
    });
    await esPage.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await esPage.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('msb_tour_done', '1');
      localStorage.setItem('msb_welcome_dismissed', '1');
    });
    await esPage.reload({ waitUntil: 'domcontentloaded' });
    await esPage.waitForTimeout(700);

    const switched = await esPage.evaluate(() => {
      const beforeCount = typeof getFreeGenerateCount === 'function' ? getFreeGenerateCount() : null;
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
      if (typeof loadThisNrfPeriod === 'function') loadThisNrfPeriod({ quiet: true });
      if (typeof generateSchedule === 'function') generateSchedule();
      return new Promise((resolve) => {
        setTimeout(() => {
          const afterBuild = typeof getFreeGenerateCount === 'function' ? getFreeGenerateCount() : null;
          const cells = document.querySelectorAll('#schedule-grid td.shift-editable').length;
          if (typeof setUiLang === 'function') setUiLang('es');
          const afterLang = typeof getFreeGenerateCount === 'function' ? getFreeGenerateCount() : null;
          resolve({
            beforeCount,
            afterBuild,
            afterLang,
            cells,
            cellsAfter: document.querySelectorAll('#schedule-grid td.shift-editable').length,
            storeVal: ((document.getElementById('store-name') || {}).value || ''),
            smVal: ((document.getElementById('name-sm') || {}).value || ''),
            amVal: ((document.getElementById('name-am1') || {}).value || ''),
            setup: (document.getElementById('tabbtn-setup') || {}).textContent || '',
            heading: (document.getElementById('setup-panel-title') || {}).textContent || '',
            req: (document.getElementById('tabbtn-requests') || {}).textContent || '',
            more: (document.getElementById('header-more-btn') || {}).textContent || '',
            saved: localStorage.getItem('msb_ui_lang'),
            picker: (document.getElementById('ap-lang-select') || {}).value
              || (document.getElementById('more-lang-select') || {}).value,
            lang: document.documentElement.lang,
          });
        }, 2800);
      });
    });

    if (switched.afterBuild === 1 && switched.afterLang === 1) {
      pass('lang-switch-does-not-burn-generate', 'count stayed ' + switched.afterLang);
    } else fail('lang-switch-does-not-burn-generate', JSON.stringify({
      before: switched.beforeCount,
      afterBuild: switched.afterBuild,
      afterLang: switched.afterLang,
    }));

    if (switched.cells > 10 && switched.cellsAfter === switched.cells) {
      pass('lang-switch-keeps-board', switched.cellsAfter + ' cells');
    } else fail('lang-switch-keeps-board', JSON.stringify({
      cells: switched.cells,
      cellsAfter: switched.cellsAfter,
    }));

    if (/Equipo/.test(switched.setup) && /Solicitudes/.test(switched.req)
      && /Más/.test(switched.more) && switched.lang === 'es') {
      pass('chrome-translates', [switched.setup, switched.req, switched.more].join(' · '));
    } else fail('chrome-translates', JSON.stringify({
      setup: switched.setup,
      req: switched.req,
      more: switched.more,
    }));

    if (switched.smVal === 'Alex Rivera' && switched.amVal === 'Sam Chen' && switched.storeVal === 'Riverside') {
      pass('roster-names-untranslated', switched.smVal + ' / ' + switched.storeVal);
    } else fail('roster-names-untranslated', JSON.stringify({
      sm: switched.smVal,
      am: switched.amVal,
      store: switched.storeVal,
    }));

    if (switched.saved === 'es' && switched.picker === 'es') {
      pass('override-written', 'msb_ui_lang=es');
    } else fail('override-written', JSON.stringify({ saved: switched.saved, picker: switched.picker }));

    const tourHeading = await esPage.evaluate(() => {
      const before = (document.getElementById('setup-panel-title') || {}).textContent || '';
      if (typeof startOnboardingTour === 'function') startOnboardingTour(true);
      const during = (document.getElementById('setup-panel-title') || {}).textContent || '';
      if (typeof endOnboardingTour === 'function') endOnboardingTour(true);
      const after = (document.getElementById('setup-panel-title') || {}).textContent || '';
      return { before, during, after };
    });
    const headingOk = [tourHeading.before, tourHeading.during, tourHeading.after].every((t) => {
      return /Tienda y equipo|Tu equipo/.test(t) && !/Store & team|Your team/.test(t);
    });
    if (headingOk) pass('tour-keeps-spanish-setup-heading', tourHeading.after.trim());
    else fail('tour-keeps-spanish-setup-heading', JSON.stringify(tourHeading));

    const surfaces = await esPage.evaluate(() => {
      if (typeof switchTab === 'function') switchTab('schedule');
      if (typeof openReviewSheet === 'function') openReviewSheet();
      const sheet = document.getElementById('review-sheet');
      const radar = document.querySelector('.clopen-radar');
      const weekend = document.querySelector('.weekend-board');
      const fair = document.getElementById('fairness-under-schedule');
      const cover = document.getElementById('pgs-cover');
      const cta = document.getElementById('pgs-primary-cta');
      const ts = document.getElementById('gen-timestamp');
      const hours = document.getElementById('schedule-hours-line');
      const nudge = document.getElementById('backup-nudge');
      const moreHint = document.querySelector('.header-menu-hint');
      const covRow = document.querySelector('.coverage-row .name-col');
      const why = (typeof explainCellWhy === 'function' && typeof getRoles === 'function' && periodDates && periodDates[0])
        ? explainCellWhy(getRoles()[0], dateKey(periodDates[0]))
        : { text: '' };
      const st = typeof computeCoverageAndFairnessStats === 'function'
        ? computeCoverageAndFairnessStats()
        : null;
      const chip = typeof formatCoverageChip === 'function' ? formatCoverageChip(st) : { text: '', title: '' };
      const short = typeof formatMissingDaysShort === 'function' ? formatMissingDaysShort(8) : '';
      const long = typeof formatMissingDaysLong === 'function' ? formatMissingDaysLong(17) : '';
      const two = typeof twoPersonOffsCoverageNote === 'function'
        ? twoPersonOffsCoverageNote(typeof getRoles === 'function' ? getRoles() : ['sm', 'am1'])
        : '';
      const exportHtml = typeof buildExcelExportHtml === 'function' ? buildExcelExportHtml() : '';
      const blob = [
        sheet ? sheet.innerText : '',
        radar ? radar.innerText : '',
        weekend ? weekend.innerText : '',
        fair ? fair.innerText : '',
        cover ? cover.textContent : '',
        cover ? cover.title : '',
        cta ? cta.textContent : '',
        ts ? ts.textContent : '',
        hours ? hours.textContent : '',
        nudge ? nudge.innerText : '',
        moreHint ? moreHint.textContent : '',
        covRow ? covRow.textContent : '',
        why && why.text ? why.text : '',
        chip.text,
        chip.title,
      ].join('\n');
      return {
        blob,
        cta: cta ? cta.textContent : '',
        cover: cover ? cover.textContent : '',
        coverTitle: cover ? cover.title : '',
        ts: ts ? ts.textContent : '',
        hours: hours ? hours.textContent : '',
        radar: radar ? radar.innerText : '',
        weekend: weekend ? weekend.innerText : '',
        sheetHead: sheet ? ((sheet.querySelector('.posting-board h3') || {}).textContent || '') : '',
        backupHint: sheet ? ((sheet.querySelector('.score-backup-hint') || {}).textContent || '') : '',
        reviewTitle: sheet ? ((document.getElementById('review-sheet-title') || {}).textContent || '') : '',
        short,
        long,
        two,
        exportHtml: exportHtml.slice(0, 800),
        namesInSheet: sheet ? sheet.innerText : '',
      };
    });

    if (/Radar de clopen/.test(surfaces.radar) && !/Clopen radar/.test(surfaces.radar)) {
      pass('clopen-radar-es', surfaces.radar.split('\n')[0]);
    } else fail('clopen-radar-es', surfaces.radar.slice(0, 160));

    if (/Equidad de fin/.test(surfaces.weekend)
      && /GERENTE|Gerente/.test(surfaces.weekend)
      && /LIBRE|Libre/.test(surfaces.weekend)
      && /META|Meta/.test(surfaces.weekend)
      && !/Weekend fairness/.test(surfaces.weekend)
      && !/\bMet\b/.test(surfaces.weekend.replace(/Cumplió/g, ''))) {
      pass('weekend-fairness-es', surfaces.weekend.split('\n').slice(0, 3).join(' · '));
    } else fail('weekend-fairness-es', surfaces.weekend.slice(0, 240));

    if (/Revisión para publicar|Revisar/.test(surfaces.sheetHead + surfaces.reviewTitle)
      && !/Review issues/.test(surfaces.cta)
      && /Revisar problemas|Revisar/.test(surfaces.cta)) {
      pass('review-cta-es', surfaces.cta.trim() + ' / ' + surfaces.sheetHead.trim());
    } else fail('review-cta-es', JSON.stringify({
      cta: surfaces.cta,
      head: surfaces.sheetHead,
      title: surfaces.reviewTitle,
    }));

    if (/Teléfono nuevo/.test(surfaces.backupHint) && !/New phone\?/.test(surfaces.backupHint)) {
      pass('backup-hint-es', surfaces.backupHint.trim());
    } else fail('backup-hint-es', surfaces.backupHint);

    if (/Horario de tienda/.test(surfaces.hours) && !/Store hours/.test(surfaces.hours)) {
      pass('store-hours-es', surfaces.hours.slice(0, 80));
    } else fail('store-hours-es', surfaces.hours.slice(0, 120));

    if (/^Armado /.test((surfaces.ts || '').trim()) && !/^Generated /.test(surfaces.ts || '')) {
      pass('generated-es', surfaces.ts.trim());
    } else fail('generated-es', surfaces.ts);

    if (/Faltan 8/.test(surfaces.short) && !/8 missing/.test(surfaces.short)
      && /17 días sin apertura o cierre/.test(surfaces.long)
      && !/17 days missing/.test(surfaces.long)
      && /Dos personas con días libres/.test(surfaces.two)
      && !/Two people with days off/.test(surfaces.two)) {
      pass('one-language-missing-story', surfaces.short + ' · ' + surfaces.long);
    } else fail('one-language-missing-story', JSON.stringify({
      short: surfaces.short,
      long: surfaces.long,
      two: surfaces.two,
      cover: surfaces.cover,
      coverTitle: surfaces.coverTitle,
    }));

    if (!/\bmissing\b/.test(surfaces.cover + ' ' + surfaces.coverTitle)
      && !/days missing open or close/.test(surfaces.coverTitle)) {
      pass('cover-chip-one-language', surfaces.cover + ' · ' + surfaces.coverTitle);
    } else fail('cover-chip-one-language', surfaces.cover + ' · ' + surfaces.coverTitle);

    if (/HORARIO DE GERENCIA|Horario de gerencia/.test(surfaces.exportHtml)
      && !/>MANAGEMENT SCHEDULE</.test(surfaces.exportHtml)) {
      pass('export-header-es');
    } else fail('export-header-es', surfaces.exportHtml.slice(0, 200));

    if (/Alex Rivera/.test(surfaces.namesInSheet) && /Sam Chen/.test(surfaces.namesInSheet)
      && /Riverside/.test((document => document) && surfaces.namesInSheet + switched.storeVal)) {
      pass('roster-still-untranslated-in-review', 'Alex Rivera / Sam Chen');
    } else {
      const inReview = /Alex Rivera/.test(surfaces.namesInSheet) && /Sam Chen/.test(surfaces.namesInSheet);
      if (inReview) pass('roster-still-untranslated-in-review', 'names in review');
      else fail('roster-still-untranslated-in-review', 'names missing from review text');
    }

    const foundEn = FORBIDDEN_EN.filter((s) => surfaces.blob.indexOf(s) !== -1)
      .filter((s) => INTENTIONAL_EN_LEFTOVERS.indexOf(s) === -1);
    if (!foundEn.length) {
      pass('no-english-leftovers-on-review-board-export', 'intentional=' + INTENTIONAL_EN_LEFTOVERS.length);
    } else fail('no-english-leftovers-on-review-board-export', foundEn.join(' · '));

    await esPage.reload({ waitUntil: 'domcontentloaded' });
    await esPage.waitForTimeout(700);
    const persisted = await esPage.evaluate(() => ({
      saved: localStorage.getItem('msb_ui_lang'),
      lang: document.documentElement.lang,
      setup: (document.getElementById('tabbtn-setup') || {}).textContent || '',
      heading: (document.getElementById('setup-panel-title') || {}).textContent || '',
      sm: ((document.getElementById('name-sm') || {}).value || ''),
      store: ((document.getElementById('store-name') || {}).value || ''),
    }));
    if (persisted.saved === 'es' && persisted.lang === 'es' && /Equipo/.test(persisted.setup)
      && /Tienda y equipo|Tu equipo/.test(persisted.heading)
      && persisted.sm === 'Alex Rivera' && persisted.store === 'Riverside') {
      pass('override-persist', 'reload kept Spanish; names stayed typed');
    } else fail('override-persist', JSON.stringify(persisted));

    await esPage.close();
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
