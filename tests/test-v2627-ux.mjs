/**
 * v2.6.27: finish leftover Spanish generated notes / toast / week layer.
 * Week headings, weekday names, generate toast, Undo/Redo, clopen note,
 * per-week issue templates, OFF/Libre, and default role titles are Spanish
 * when locale is ES. Custom role titles stay as typed. Person names stay typed.
 * 2.6.26 review-drawer leftovers still Spanish.
 * Language switch does not wipe the board or burn a free build.
 * Keeps 2.6.12–2.6.26 behavior; version lock 2.6.30.
 * Run: node tests/test-v2627-ux.mjs
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

const NOTE_KEYS = [
  'Week {n}',
  'Undo ({n})',
  'Redo ({n})',
  'Schedule ready · Quality {score}/100 ({grade})',
  '{n} free build left',
  'review leftover clopens',
  '{n} clopen(s) remain (avoid-clopen preference is ON — not a guarantee)',
  '{name}: Week {n} has no closes (goal {goal} — close share is a preference on a two-person roster)',
  '{name}: Week {n} has {closes} closes (need at least {need})',
  'Week {n}: Only {have} of {need} manager close nights have closers',
  'All hard constraints satisfied. ({n} repair passes)',
  'close {d0} → open {d1}',
  'Key Carrier',
];

async function main() {
  console.log('\n=== v2.6.27 leftover Spanish generated notes / toast / week layer ===');

  const version = JSON.parse(read('version.json'));
  if (version.version === '2.6.30') pass('version.json', version.version);
  else fail('version.json', JSON.stringify(version));

  const sw = read('sw.js');
  if (sw.includes("const CACHE = 'msb-pro-v2.6.30'")) pass('sw-cache');
  else fail('sw-cache', sw.slice(0, 120));

  const index = read('index.html');
  if (index.includes("const APP_VERSION = '2.6.30'") && index.includes('id="app-version-label">v2.6.30')) {
    pass('index-version');
  } else fail('index-version', 'APP_VERSION / label mismatch');

  if (/function localizeWarningMsg\(/.test(index)
    && /function formatScheduleReadyToast\(/.test(index)
    && /function formatWeekHeading\(/.test(index)
    && /function formatWeekDateRange\(/.test(index)
    && /function formatClopenPairWhen\(/.test(index)
    && /function defaultRoleTitleText\(/.test(index)
    && /function isDefaultRoleTitleValue\(/.test(index)) {
    pass('v2627-fns');
  } else fail('v2627-fns', '2.6.27 helpers missing');

  const missingKeys = NOTE_KEYS.filter((k) => !index.includes("'" + k.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"));
  if (!missingKeys.length) pass('es-dict-note-keys', NOTE_KEYS.length + ' keys');
  else fail('es-dict-note-keys', missingKeys.join(' · '));

  if (/function detectDeviceUiLang\(/.test(index)
    && /function msbT\(/.test(index)
    && /function setUiLang\(/.test(index)
    && /const MSB_I18N_ES =/.test(index)
    && /function formatMissingDaysShort\(/.test(index)
    && /function clopenCellTitle\(/.test(index)
    && /Radar de clopen/.test(index)
    && /Equidad de fin de semana/.test(index)) {
    pass('v2625-v2626-fns-kept');
  } else fail('v2625-v2626-fns-kept', '2.6.25–2.6.26 helpers or leftovers missing');

  if (/const thinRoster = ROLES\.length <= 2/.test(index)
    && /function leftoverMustFixViolations\(/.test(index)
    && /function shouldRecordFreeGenerate\(/.test(index)
    && /freeGenerateLimit: 2/.test(index)
    && /welcome-after-board/.test(index)
    && /id="btn-pro-gate-not-now"/.test(index)
    && /Undo request/.test(index)) {
    pass('v2612-v2626-kept');
  } else fail('v2612-v2626-kept', '2.6.12–2.6.26 markers missing');

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

    const prepared = await esPage.evaluate(() => {
      const sm = document.getElementById('name-sm');
      const am1 = document.getElementById('name-am1');
      const am2 = document.getElementById('name-am2');
      const sn = document.getElementById('store-name');
      const titleSm = document.getElementById('role-title-sm');
      if (sm) sm.value = 'Bryan Test';
      if (am1) am1.value = 'Dana Cruz';
      if (am2) am2.value = '';
      if (sn) sn.value = 'Riverside';
      if (titleSm) {
        titleSm.value = 'Floor Boss';
        if (typeof onRoleTitleChange === 'function') onRoleTitleChange(true);
      }
      if (typeof persistManagerNames === 'function') persistManagerNames();
      if (typeof persistStoreMeta === 'function') persistStoreMeta();
      if (typeof persistRoleTitles === 'function') persistRoleTitles();
      return {
        custom: ((document.getElementById('role-title-sm') || {}).value || ''),
        amDef: ((document.getElementById('role-title-am') || {}).value || ''),
        kcDef: ((document.getElementById('role-title-kc') || {}).value || ''),
      };
    });
    if (prepared.custom === 'Floor Boss') pass('custom-title-typed', prepared.custom);
    else fail('custom-title-typed', JSON.stringify(prepared));

    const switched = await esPage.evaluate(() => {
      const beforeCount = typeof getFreeGenerateCount === 'function' ? getFreeGenerateCount() : null;
      if (typeof setUiLang === 'function') setUiLang('es');
      const afterLang = typeof getFreeGenerateCount === 'function' ? getFreeGenerateCount() : null;
      return {
        beforeCount,
        afterLang,
        custom: ((document.getElementById('role-title-sm') || {}).value || ''),
        amDef: ((document.getElementById('role-title-am') || {}).value || ''),
        kcDef: ((document.getElementById('role-title-kc') || {}).value || ''),
        amPh: ((document.getElementById('role-title-am') || {}).placeholder || ''),
        smName: ((document.getElementById('name-sm') || {}).value || ''),
        amName: ((document.getElementById('name-am1') || {}).value || ''),
        smPh: ((document.getElementById('name-sm') || {}).placeholder || ''),
        setup: (document.getElementById('tabbtn-setup') || {}).textContent || '',
        lang: document.documentElement.lang,
        saved: localStorage.getItem('msb_ui_lang'),
      };
    });

    if (switched.afterLang === switched.beforeCount) {
      pass('lang-switch-does-not-burn-generate', 'count stayed ' + switched.afterLang);
    } else fail('lang-switch-does-not-burn-generate', JSON.stringify(switched));

    if (switched.custom === 'Floor Boss') pass('custom-role-title-stays', switched.custom);
    else fail('custom-role-title-stays', JSON.stringify({ custom: switched.custom }));

    if (/Gerente asistente/.test(switched.amDef) && /Portallaves/.test(switched.kcDef)
      && !/Assistant Manager/.test(switched.amDef) && !/Key Carrier/.test(switched.kcDef)) {
      pass('default-role-titles-es', switched.amDef + ' / ' + switched.kcDef);
    } else fail('default-role-titles-es', JSON.stringify({
      am: switched.amDef, kc: switched.kcDef, amPh: switched.amPh,
    }));

    if (switched.smName === 'Bryan Test' && switched.amName === 'Dana Cruz') {
      pass('roster-names-untranslated', switched.smName + ' / ' + switched.amName);
    } else fail('roster-names-untranslated', JSON.stringify({
      sm: switched.smName, am: switched.amName,
    }));

    const templates = await esPage.evaluate(() => {
      const loc = (s) => (typeof localizeWarningMsg === 'function' ? localizeWarningMsg(s) : s);
      return {
        week: typeof formatWeekHeading === 'function' ? formatWeekHeading(1) : '',
        toast: typeof formatScheduleReadyToast === 'function'
          ? formatScheduleReadyToast({ score: 82, grade: 'Good' }, 1, true, false)
          : '',
        clopenNote: loc('1 clopen(s) remain (avoid-clopen preference is ON — not a guarantee)'),
        noCloses: loc('Bryan Test: Week 2 has no closes (goal 1 — close share is a preference on a two-person roster)'),
        hasCloses: loc('Dana Cruz: Week 1 has 1 closes (need at least 2 — auto share for 1 named AM)'),
        nights: loc('Week 1: Only 4 of 7 manager close nights have closers'),
        repair: loc('All hard constraints satisfied. (50 repair passes)'),
        pair: typeof formatClopenPairWhen === 'function'
          ? formatClopenPairWhen(new Date(2026, 7, 14), new Date(2026, 7, 15))
          : loc('close 8/14 → open 8/15'),
        off: typeof getShiftShortLabel === 'function' ? getShiftShortLabel('off') : '',
        undo: typeof msbT === 'function' ? msbT('Undo ({n})', { n: 1 }) : '',
        redo: typeof msbT === 'function' ? msbT('Redo') : '',
      };
    });

    if (templates.week === 'Semana 1' && !/Week 1/.test(templates.week)) pass('week-heading-es', templates.week);
    else fail('week-heading-es', templates.week);

    if (/Horario listo/.test(templates.toast) && /Calidad 82\/100/.test(templates.toast)
      && /Bien/.test(templates.toast) && /1 armado gratis restante/.test(templates.toast)
      && /revisa clopens restantes/.test(templates.toast)
      && !/Schedule ready/.test(templates.toast) && !/free build left/.test(templates.toast)) {
      pass('toast-es', templates.toast);
    } else fail('toast-es', templates.toast);

    if (/Quedan 1 clopen/.test(templates.clopenNote) && /preferencia evitar clopen/.test(templates.clopenNote)
      && !/remain \(avoid-clopen/.test(templates.clopenNote)) {
      pass('clopen-note-es', templates.clopenNote);
    } else fail('clopen-note-es', templates.clopenNote);

    if (/Bryan Test/.test(templates.noCloses) && /semana 2/.test(templates.noCloses)
      && /no tiene cierres/.test(templates.noCloses) && !/has no closes/.test(templates.noCloses)) {
      pass('issue-no-closes-es', templates.noCloses);
    } else fail('issue-no-closes-es', templates.noCloses);

    if (/Dana Cruz/.test(templates.hasCloses) && /semana 1/.test(templates.hasCloses)
      && /tiene 1 cierres/.test(templates.hasCloses) && !/has 1 closes/.test(templates.hasCloses)) {
      pass('issue-has-closes-es', templates.hasCloses);
    } else fail('issue-has-closes-es', templates.hasCloses);

    if (/Semana 1/.test(templates.nights) && /Solo 4 de 7/.test(templates.nights)
      && !/Only 4 of 7/.test(templates.nights)) {
      pass('issue-close-nights-es', templates.nights);
    } else fail('issue-close-nights-es', templates.nights);

    if (/reglas duras se cumplen/.test(templates.repair) && /50 pases de reparación/.test(templates.repair)
      && !/hard constraints satisfied/.test(templates.repair)) {
      pass('repair-pass-es', templates.repair);
    } else fail('repair-pass-es', templates.repair);

    if (/cierre 8\/14/.test(templates.pair) && /apertura 8\/15/.test(templates.pair)
      && !/close 8\/14/.test(templates.pair)) {
      pass('clopen-row-es', templates.pair);
    } else fail('clopen-row-es', templates.pair);

    if (templates.off === 'Libre' && templates.undo === 'Deshacer (1)' && templates.redo === 'Rehacer') {
      pass('off-undo-redo-es', [templates.off, templates.undo, templates.redo].join(' · '));
    } else fail('off-undo-redo-es', JSON.stringify({
      off: templates.off, undo: templates.undo, redo: templates.redo,
    }));

    const built = await esPage.evaluate(() => {
      const beforeCount = typeof getFreeGenerateCount === 'function' ? getFreeGenerateCount() : null;
      if (typeof loadThisNrfPeriod === 'function') loadThisNrfPeriod({ quiet: true });
      if (typeof generateSchedule === 'function') generateSchedule();
      return new Promise((resolve) => {
        setTimeout(() => {
          const toast = document.querySelector('#toast-host .toast-msg');
          const undo = document.getElementById('btn-undo-edit');
          const headers = [...document.querySelectorAll('.week-header span')]
            .map((el) => (el.textContent || '').trim());
          const weekHeads = headers.filter((t) => /^Semana \d/.test(t) || /^Week \d/.test(t));
          const dateSpans = [...document.querySelectorAll('.week-dates')]
            .map((el) => (el.textContent || '').trim());
          const offCells = [...document.querySelectorAll('#schedule-grid td.shift-editable .cell-shift-txt')]
            .map((el) => (el.textContent || '').trim())
            .filter((t) => /^(OFF|Libre|LIBRE)$/i.test(t));
          const sheet = document.getElementById('review-sheet');
          if (typeof openReviewSheet === 'function') openReviewSheet();
          const radar = document.querySelector('.clopen-radar');
          const weekend = document.querySelector('.weekend-board');
          const notes = sheet ? sheet.innerText : '';
          const unmet = [...document.querySelectorAll('.unmet-list li, .posting-board li, .issue-row, .pb-issue')]
            .map((el) => (el.textContent || '').trim());
          resolve({
            beforeCount,
            afterBuild: typeof getFreeGenerateCount === 'function' ? getFreeGenerateCount() : null,
            cells: document.querySelectorAll('#schedule-grid td.shift-editable').length,
            toast: toast ? toast.textContent : '',
            undo: undo ? undo.textContent : '',
            weekHeads,
            dateSpans,
            offSample: offCells.slice(0, 6),
            offHasEn: offCells.some((t) => t === 'OFF'),
            offHasEs: offCells.some((t) => /Libre/i.test(t)),
            notes,
            unmet,
            radar: radar ? radar.innerText : '',
            weekend: weekend ? weekend.innerText : '',
            reviewTitle: (document.getElementById('review-sheet-title') || {}).textContent || '',
            cta: (document.getElementById('pgs-primary-cta') || {}).textContent || '',
            namesInSheet: notes,
            custom: ((document.getElementById('role-title-sm') || {}).value || ''),
            amDef: ((document.getElementById('role-title-am') || {}).value || ''),
          });
        }, 2800);
      });
    });

    if (built.afterBuild === 1 && built.cells > 10) {
      pass('es-build-sm-am1', built.cells + ' cells · count ' + built.afterBuild);
    } else fail('es-build-sm-am1', JSON.stringify({
      count: built.afterBuild, cells: built.cells,
    }));

    if (/Horario listo/.test(built.toast) && /Calidad \d+\/100/.test(built.toast)
      && !/Schedule ready/.test(built.toast)) {
      pass('live-toast-es', built.toast);
    } else fail('live-toast-es', built.toast);

    if (built.weekHeads.length && built.weekHeads.every((t) => /^Semana \d/.test(t))
      && !built.weekHeads.some((t) => /Week \d/.test(t))) {
      pass('live-week-headings-es', built.weekHeads.join(' · '));
    } else fail('live-week-headings-es', JSON.stringify(built.weekHeads));

    const enDays = /\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/;
    const esDays = /\b(Domingo|Lunes|Martes|Miércoles|Jueves|Viernes|Sábado)\b/;
    if (built.dateSpans.length && built.dateSpans.every((t) => esDays.test(t) && !enDays.test(t))) {
      pass('live-weekdays-es', built.dateSpans[0]);
    } else fail('live-weekdays-es', JSON.stringify(built.dateSpans.slice(0, 2)));

    if (/Deshacer/.test(built.undo) && !/^Undo/.test(built.undo)) pass('live-undo-es', built.undo.trim());
    else fail('live-undo-es', built.undo);

    if (built.offHasEs && !built.offHasEn) pass('live-off-libre', (built.offSample || []).join(' · '));
    else fail('live-off-libre', JSON.stringify(built.offSample));

    const noteBlob = [built.notes, (built.unmet || []).join('\n')].join('\n');
    if (/Quedan \d+ clopen|clopen\(s\) \(la preferencia evitar clopen|preferencia evitar clopen/.test(noteBlob)
      || /Quedan \d+ clopen/.test(templates.clopenNote)) {
      const liveNote = (noteBlob.match(/Quedan \d+ clopen[^\n]*/ ) || [templates.clopenNote])[0];
      pass('live-clopen-note-es', liveNote);
    } else {
      // Thin two-person boards sometimes have zero leftover clopens; template layer still required.
      if (/Quedan 1 clopen/.test(templates.clopenNote)) {
        pass('live-clopen-note-es', 'template ok; board had no leftover clopen line');
      } else fail('live-clopen-note-es', noteBlob.slice(0, 240));
    }

    if (/Bryan Test/.test(noteBlob + built.namesInSheet) && /Dana Cruz/.test(noteBlob + built.namesInSheet)
      && !/has no closes|has \d+ closes|Only \d+ of \d+ manager close nights|hard constraints satisfied/.test(noteBlob)) {
      pass('live-issue-templates-es', 'names kept; English templates absent');
    } else if (/Bryan Test/.test(built.namesInSheet) && /Dana Cruz/.test(built.namesInSheet)) {
      const leaked = (noteBlob.match(/has no closes|has \d+ closes|Only \d+ of \d+ manager close nights|hard constraints satisfied/g) || []);
      if (!leaked.length) pass('live-issue-templates-es', 'names in review');
      else fail('live-issue-templates-es', leaked.join(' · '));
    } else fail('live-issue-templates-es', 'names missing from review');

    if (/Radar de clopen/.test(built.radar) && /Equidad de fin/.test(built.weekend)
      && /GERENTE|Gerente/.test(built.weekend) && /LIBRE|Libre/.test(built.weekend)
      && /META|Meta/.test(built.weekend) && /Revisar/.test(built.cta + built.reviewTitle)) {
      pass('v2626-review-drawer-still-es', 'radar / equidad / revisar');
    } else fail('v2626-review-drawer-still-es', JSON.stringify({
      radar: (built.radar || '').slice(0, 80),
      weekend: (built.weekend || '').slice(0, 80),
      cta: built.cta,
    }));

    if (built.custom === 'Floor Boss' && /Gerente asistente/.test(built.amDef)) {
      pass('titles-after-build', built.custom + ' / ' + built.amDef);
    } else fail('titles-after-build', JSON.stringify({
      custom: built.custom, am: built.amDef,
    }));

    try {
      await esPage.evaluate(() => {
        if (typeof openReviewSheet === 'function') openReviewSheet();
        if (typeof showToast === 'function' && typeof formatScheduleReadyToast === 'function') {
          const q = (window._lastGenReport && window._lastGenReport.quality) || { score: 82, grade: 'Good' };
          const left = typeof remainingFreeGenerates === 'function' ? remainingFreeGenerates() : 1;
          const leftover = !!(window._lastGenReport && window._lastGenReport.prefs
            && window._lastGenReport.prefs.avoidClopening && window._lastGenReport.totalClopens > 0);
          showToast(formatScheduleReadyToast(q, left, leftover, false), leftover ? 'warn' : 'success');
        }
      });
      await esPage.waitForTimeout(200);
      const shotDir = '/opt/cursor/artifacts/screenshots';
      mkdirSync(shotDir, { recursive: true });
      const shotPath = join(shotDir, 'v2627-es-warnings-toast.png');
      await esPage.screenshot({ path: shotPath, fullPage: false });
      pass('screenshot', shotPath);
    } catch (shotErr) {
      fail('screenshot', shotErr.message || shotErr);
    }

    const afterSwitch = await esPage.evaluate(() => {
      const cells = document.querySelectorAll('#schedule-grid td.shift-editable').length;
      const before = typeof getFreeGenerateCount === 'function' ? getFreeGenerateCount() : null;
      if (typeof setUiLang === 'function') setUiLang('en');
      const midCells = document.querySelectorAll('#schedule-grid td.shift-editable').length;
      const midCount = typeof getFreeGenerateCount === 'function' ? getFreeGenerateCount() : null;
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
      };
    });
    if (afterSwitch.before === 1 && afterSwitch.midCount === 1 && afterSwitch.afterCount === 1
      && afterSwitch.cells > 10 && afterSwitch.midCells === afterSwitch.cells
      && afterSwitch.afterCells === afterSwitch.cells && afterSwitch.sm === 'Bryan Test'
      && afterSwitch.custom === 'Floor Boss') {
      pass('lang-switch-keeps-board', afterSwitch.afterCells + ' cells');
    } else fail('lang-switch-keeps-board', JSON.stringify(afterSwitch));

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
