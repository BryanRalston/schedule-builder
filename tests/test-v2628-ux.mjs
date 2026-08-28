/**
 * v2.6.28: cheap leftover Spanish on Setup hours, FY/Period/month,
 * empty teams, and aria/tooltips. US holiday names stay English.
 * Custom role titles stay typed. Roster names stay typed.
 * Language switch does not wipe the board or burn a free build.
 * Keeps 2.6.12–2.6.27 behavior; version lock 2.6.28.
 * Run: node tests/test-v2628-ux.mjs
 */
import { createServer } from 'http';
import { readFileSync, existsSync, mkdirSync } from 'fs';
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
  'FY{year} Period {n}',
  'FY{year} Period {n} - {month}',
  'FY:',
  'Period:',
  'No saved teams yet',
  'Remove last AM',
  'Add assistant manager',
  'Remove last KC',
  'Add key carrier',
  'Build optimized schedule for this period',
  'Privacy',
  'e.g. 100',
];

async function main() {
  console.log('\n=== v2.6.28 leftover Spanish hours / FY-Period / teams / aria ===');

  const version = JSON.parse(read('version.json'));
  if (version.version === '2.6.28') pass('version.json', version.version);
  else fail('version.json', JSON.stringify(version));

  const sw = read('sw.js');
  if (sw.includes("const CACHE = 'msb-pro-v2.6.28'")) pass('sw-cache');
  else fail('sw-cache', sw.slice(0, 120));

  const index = read('index.html');
  if (index.includes("const APP_VERSION = '2.6.28'") && index.includes('id="app-version-label">v2.6.28')) {
    pass('index-version');
  } else fail('index-version', 'APP_VERSION / label mismatch');

  if (/function formatFyPeriodLabel\(/.test(index)
    && /function formatFyPeriodShort\(/.test(index)
    && /function localizeMonthName\(/.test(index)
    && /function refreshPeriodPickerI18n\(/.test(index)) {
    pass('v2628-fns');
  } else fail('v2628-fns', '2.6.28 helpers missing');

  const missingKeys = LEFTOVER_KEYS.filter((k) => !index.includes("'" + k.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"));
  if (!missingKeys.length) pass('es-dict-leftover-keys', LEFTOVER_KEYS.length + ' keys');
  else fail('es-dict-leftover-keys', missingKeys.join(' · '));

  if (/function localizeWarningMsg\(/.test(index)
    && /function formatScheduleReadyToast\(/.test(index)
    && /function formatWeekHeading\(/.test(index)
    && /function defaultRoleTitleText\(/.test(index)
    && /Horario listo/.test(index)
    && /Radar de clopen/.test(index)) {
    pass('v2626-v2627-fns-kept');
  } else fail('v2626-v2627-fns-kept', '2.6.26–2.6.27 helpers or leftovers missing');

  if (/const thinRoster = ROLES\.length <= 2/.test(index)
    && /function leftoverMustFixViolations\(/.test(index)
    && /function shouldRecordFreeGenerate\(/.test(index)
    && /freeGenerateLimit: 2/.test(index)
    && /welcome-after-board/.test(index)
    && /id="btn-pro-gate-not-now"/.test(index)
    && /Undo request/.test(index)
    && /function setUiLang\(/.test(index)
    && /const MSB_I18N_ES =/.test(index)) {
    pass('v2612-v2627-kept');
  } else fail('v2612-v2627-kept', '2.6.12–2.6.27 markers missing');

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
    const esPage = await browser.newPage({
      viewport: { width: 1280, height: 900 },
      locale: 'en-US',
    });
    await esPage.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await esPage.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('msb_tour_done', '1');
      localStorage.setItem('msb_welcome_dismissed', '1');
      localStorage.setItem('msb_setup_more_open', '1');
    });
    await esPage.reload({ waitUntil: 'domcontentloaded' });
    await esPage.waitForTimeout(700);

    const prepared = await esPage.evaluate(() => {
      const sm = document.getElementById('name-sm');
      const am1 = document.getElementById('name-am1');
      const am2 = document.getElementById('name-am2');
      const sn = document.getElementById('store-name');
      const titleSm = document.getElementById('role-title-sm');
      if (sm) sm.value = 'Alex Rivera';
      if (am1) am1.value = 'Sam Chen';
      if (am2) am2.value = '';
      if (sn) sn.value = 'Riverside';
      if (titleSm) {
        titleSm.value = 'Floor Boss';
        if (typeof onRoleTitleChange === 'function') onRoleTitleChange(true);
      }
      if (typeof persistManagerNames === 'function') persistManagerNames();
      if (typeof persistStoreMeta === 'function') persistStoreMeta();
      if (typeof persistRoleTitles === 'function') persistRoleTitles();
      if (typeof setMoreSetupOpen === 'function') setMoreSetupOpen(true);
      return {
        custom: ((document.getElementById('role-title-sm') || {}).value || ''),
        hoursEn: ((document.getElementById('store-hours-summary') || {}).textContent || ''),
      };
    });
    if (prepared.custom === 'Floor Boss') pass('custom-title-typed', prepared.custom);
    else fail('custom-title-typed', JSON.stringify(prepared));

    const templates = await esPage.evaluate(() => {
      if (typeof setUiLang === 'function') setUiLang('es');
      return {
        hours: typeof summarizeStoreHours === 'function' ? summarizeStoreHours() : '',
        fy: typeof formatFyPeriodLabel === 'function'
          ? formatFyPeriodLabel(2026, { number: 7, approxMonth: 'August' })
          : '',
        fyShort: typeof formatFyPeriodShort === 'function' ? formatFyPeriodShort(2026, 7) : '',
        month: typeof localizeMonthName === 'function' ? localizeMonthName('August') : '',
        empty: typeof msbT === 'function' ? msbT('No saved teams yet') : '',
        removeAm: typeof msbT === 'function' ? msbT('Remove last AM') : '',
        build: typeof msbT === 'function' ? msbT('Build optimized schedule for this period') : '',
        privacy: typeof msbT === 'function' ? msbT('Privacy') : '',
        eg: typeof msbT === 'function' ? msbT('e.g. 100') : '',
      };
    });

    if (/Lun–Jue|Lun–Jue/.test(templates.hours) && /Vie–Sáb|Vie–Sab/.test(templates.hours)
      && /Dom /.test(templates.hours) && !/\bMon–Thu\b/.test(templates.hours)
      && !/\bFri–Sat\b/.test(templates.hours) && !/\bSun\b/.test(templates.hours)) {
      pass('hours-day-abbrevs-es', templates.hours);
    } else fail('hours-day-abbrevs-es', templates.hours);

    if (templates.fy === 'AF2026 Período 7 - agosto' && templates.fyShort === 'AF2026 Período 7'
      && templates.month === 'agosto' && !/FY2026 Period/.test(templates.fy)
      && !/August/.test(templates.fy)) {
      pass('fy-period-month-es', templates.fy);
    } else fail('fy-period-month-es', JSON.stringify(templates));

    if (templates.empty === 'Aún no hay equipos guardados' && !/No saved teams/.test(templates.empty)) {
      pass('empty-teams-es', templates.empty);
    } else fail('empty-teams-es', templates.empty);

    if (templates.removeAm === 'Quitar último AM' && /Armar horario optimizado/.test(templates.build)
      && templates.privacy === 'Privacidad' && templates.eg === 'ej. 100'
      && !/Remove last AM/.test(templates.removeAm) && !/Build optimized/.test(templates.build)
      && !/^Privacy$/.test(templates.privacy) && !/e\.g\. 100/.test(templates.eg)) {
      pass('aria-tooltip-keys-es', [templates.removeAm, templates.build, templates.privacy, templates.eg].join(' · '));
    } else fail('aria-tooltip-keys-es', JSON.stringify(templates));

    const live = await esPage.evaluate(() => {
      const yEl = document.getElementById('pick-year');
      if (yEl) yEl.value = '2026';
      if (typeof buildPeriodDropdown === 'function') buildPeriodDropdown();
      const sel = document.getElementById('pick-period');
      let augustIdx = -1;
      if (sel) {
        for (let i = 0; i < sel.options.length; i++) {
          if (/agosto|August/i.test(sel.options[i].textContent || '')) {
            augustIdx = i;
            break;
          }
        }
        if (augustIdx < 0 && sel.options.length > 6) augustIdx = 6;
        if (augustIdx >= 0) sel.value = String(augustIdx);
      }
      if (typeof updatePeriodInfo === 'function') updatePeriodInfo();
      if (typeof updateStoreHoursSummary === 'function') updateStoreHoursSummary();
      if (typeof renderTeamTemplateUI === 'function') renderTeamTemplateUI();
      if (typeof updateReadyChecklist === 'function') updateReadyChecklist();
      const removeAm = document.querySelector('button[onclick="removeAM()"]');
      const addAm = document.getElementById('btn-add-am');
      const privacy = document.querySelector('.footer-links [data-i18n="Privacy"]');
      const storeNum = document.getElementById('store-number');
      const fyLabel = [...document.querySelectorAll('.period-picker label')]
        .map((el) => (el.textContent || '').trim());
      const holidays = (document.getElementById('federal-holidays-list') || {}).innerText || '';
      const pickerOpts = sel ? [...sel.options].map((o) => o.textContent || '') : [];
      return {
        hours: ((document.getElementById('store-hours-summary') || {}).textContent || ''),
        teams: ((document.getElementById('team-template-select') || {}).options[0] || {}).textContent || '',
        fyLabels: fyLabel,
        periodInfo: ((document.getElementById('period-info') || {}).innerText || ''),
        pickerSample: pickerOpts.filter((t) => /agosto|August|Period|Período/.test(t)).slice(0, 3),
        pickerHasAugust: pickerOpts.some((t) => /August/.test(t)),
        pickerHasAgosto: pickerOpts.some((t) => /agosto/.test(t)),
        removeTitle: removeAm ? removeAm.getAttribute('title') : '',
        removeAria: removeAm ? removeAm.getAttribute('aria-label') : '',
        addTitle: addAm ? addAm.getAttribute('title') : '',
        buildTitle: ((document.getElementById('btn-generate') || {}).title || ''),
        privacy: privacy ? privacy.textContent : '',
        eg: storeNum ? storeNum.getAttribute('placeholder') : '',
        holidays,
        holidayIndependence: /Independence Day/.test(holidays),
        holidayThanks: /Thanksgiving/.test(holidays),
        holidayXmas: /Christmas Day/.test(holidays),
        holidayEsLeak: /Día de la Independencia|Acción de gracias|Navidad/.test(holidays),
        custom: ((document.getElementById('role-title-sm') || {}).value || ''),
        sm: ((document.getElementById('name-sm') || {}).value || ''),
        am: ((document.getElementById('name-am1') || {}).value || ''),
        lang: document.documentElement.lang,
        setup: (document.getElementById('tabbtn-setup') || {}).textContent || '',
      };
    });

    if (/Lun–Jue|Lun–Jue/.test(live.hours) && !/\bMon–Thu\b/.test(live.hours)
      && !/\bFri–Sat\b/.test(live.hours)) {
      pass('live-hours-es', live.hours);
    } else fail('live-hours-es', live.hours);

    if (live.fyLabels.some((t) => t === 'AF:') && live.fyLabels.some((t) => /Período/.test(t))
      && !live.fyLabels.includes('FY:') && !live.fyLabels.includes('Period:')
      && /AF2026 Período/.test(live.periodInfo) && !/FY2026 Period/.test(live.periodInfo)
      && /agosto/.test(live.periodInfo + ' ' + live.pickerSample.join(' '))
      && live.pickerHasAgosto && !live.pickerHasAugust) {
      pass('live-fy-period-es', live.periodInfo.slice(0, 120));
    } else fail('live-fy-period-es', JSON.stringify({
      fyLabels: live.fyLabels,
      periodInfo: live.periodInfo,
      picker: live.pickerSample,
    }));

    if (/Aún no hay equipos/.test(live.teams) && !/No saved teams/.test(live.teams)) {
      pass('live-empty-teams-es', live.teams);
    } else fail('live-empty-teams-es', live.teams);

    if (/Quitar último AM/.test(live.removeTitle + ' ' + live.removeAria)
      && /Agregar (gerente|Gerente) asistente/.test(live.addTitle)
      && /Armar horario optimizado/.test(live.buildTitle)
      && live.privacy === 'Privacidad'
      && live.eg === 'ej. 100') {
      pass('live-aria-tooltips-es', [live.removeTitle, live.buildTitle, live.privacy, live.eg].join(' · '));
    } else fail('live-aria-tooltips-es', JSON.stringify({
      removeTitle: live.removeTitle,
      removeAria: live.removeAria,
      addTitle: live.addTitle,
      buildTitle: live.buildTitle,
      privacy: live.privacy,
      eg: live.eg,
    }));

    if (live.holidayIndependence && live.holidayThanks && live.holidayXmas && !live.holidayEsLeak) {
      pass('us-holiday-names-stay-english', 'Independence Day / Thanksgiving / Christmas Day');
    } else fail('us-holiday-names-stay-english', live.holidays.slice(0, 240));

    if (live.custom === 'Floor Boss' && live.sm === 'Alex Rivera' && live.am === 'Sam Chen') {
      pass('custom-title-and-roster-stay', live.custom + ' / ' + live.sm);
    } else fail('custom-title-and-roster-stay', JSON.stringify({
      custom: live.custom, sm: live.sm, am: live.am,
    }));

    await esPage.evaluate(() => {
      if (typeof switchTab === 'function') switchTab('setup');
      if (typeof setMoreSetupOpen === 'function') setMoreSetupOpen(true);
      const hours = document.getElementById('store-hours-block');
      if (hours && hours.scrollIntoView) hours.scrollIntoView({ block: 'center' });
    });
    await esPage.waitForTimeout(200);
    try {
      const shotDir = '/opt/cursor/artifacts/screenshots';
      mkdirSync(shotDir, { recursive: true });
      const shotPath = join(shotDir, 'v2628_spanish_setup.png');
      await esPage.screenshot({ path: shotPath, fullPage: false });
      pass('screenshot', shotPath);
    } catch (shotErr) {
      fail('screenshot', shotErr.message || shotErr);
    }

    const built = await esPage.evaluate(() => {
      const beforeCount = typeof getFreeGenerateCount === 'function' ? getFreeGenerateCount() : null;
      if (typeof loadThisNrfPeriod === 'function') loadThisNrfPeriod({ quiet: true });
      if (typeof generateSchedule === 'function') generateSchedule();
      return new Promise((resolve) => {
        setTimeout(() => {
          const title = (document.getElementById('schedule-title') || {}).textContent || '';
          resolve({
            beforeCount,
            afterBuild: typeof getFreeGenerateCount === 'function' ? getFreeGenerateCount() : null,
            cells: document.querySelectorAll('#schedule-grid td.shift-editable').length,
            title,
            custom: ((document.getElementById('role-title-sm') || {}).value || ''),
            sm: ((document.getElementById('name-sm') || {}).value || ''),
          });
        }, 2800);
      });
    });

    if (built.afterBuild === 1 && built.cells > 10) {
      pass('es-build-keeps-count', built.cells + ' cells · count ' + built.afterBuild);
    } else fail('es-build-keeps-count', JSON.stringify(built));

    if (/AF\d{4} Período/.test(built.title) && !/FY\d{4} Period/.test(built.title)
      && !/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/.test(built.title)) {
      pass('live-schedule-header-es', built.title);
    } else fail('live-schedule-header-es', built.title);

    const afterSwitch = await esPage.evaluate(() => {
      const cells = document.querySelectorAll('#schedule-grid td.shift-editable').length;
      const before = typeof getFreeGenerateCount === 'function' ? getFreeGenerateCount() : null;
      if (typeof setUiLang === 'function') setUiLang('en');
      const midCells = document.querySelectorAll('#schedule-grid td.shift-editable').length;
      const midCount = typeof getFreeGenerateCount === 'function' ? getFreeGenerateCount() : null;
      const hoursEn = ((document.getElementById('store-hours-summary') || {}).textContent || '');
      const headerEn = (document.getElementById('schedule-title') || {}).textContent || '';
      if (typeof setUiLang === 'function') setUiLang('es');
      return {
        before,
        midCount,
        afterCount: typeof getFreeGenerateCount === 'function' ? getFreeGenerateCount() : null,
        cells,
        midCells,
        afterCells: document.querySelectorAll('#schedule-grid td.shift-editable').length,
        sm: ((document.getElementById('name-sm') || {}).value || ''),
        custom: ((document.getElementById('role-title-sm') || {}).value || ''),
        hoursEn,
        headerEn,
      };
    });
    if (afterSwitch.before === 1 && afterSwitch.midCount === 1 && afterSwitch.afterCount === 1
      && afterSwitch.cells > 10 && afterSwitch.midCells === afterSwitch.cells
      && afterSwitch.afterCells === afterSwitch.cells && afterSwitch.sm === 'Alex Rivera'
      && afterSwitch.custom === 'Floor Boss') {
      pass('lang-switch-keeps-board', afterSwitch.afterCells + ' cells');
    } else fail('lang-switch-keeps-board', JSON.stringify(afterSwitch));

    if (/\bMon–Thu\b/.test(afterSwitch.hoursEn) && /FY\d{4} Period/.test(afterSwitch.headerEn)
      && !/Lun–Jue/.test(afterSwitch.hoursEn)) {
      pass('lang-switch-restores-english', afterSwitch.hoursEn + ' · ' + afterSwitch.headerEn.slice(0, 60));
    } else fail('lang-switch-restores-english', JSON.stringify({
      hoursEn: afterSwitch.hoursEn, headerEn: afterSwitch.headerEn,
    }));

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
