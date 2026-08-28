/**
 * v2.6.25: English + Spanish chrome on this device.
 * Device language default (es* → Spanish, else English).
 * Account/More picker override persists in localStorage.
 * Chrome translates; roster names / store / typed titles stay as typed.
 * NRF 4-5-4 stays U.S. retail — no Spain/Mexico labor-law claim.
 * Language switch does not burn a free build or wipe the board.
 * 2.6.24 one-story must-fix vs leftover still holds.
 * Keeps 2.6.12–2.6.24 behavior; version lock 2.6.29.
 * Run: node tests/test-v2625-ux.mjs
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
  console.log('\n=== v2.6.25 English + Spanish chrome on this device ===');

  const version = JSON.parse(read('version.json'));
  if (version.version === '2.6.29') pass('version.json', version.version);
  else fail('version.json', JSON.stringify(version));

  const sw = read('sw.js');
  if (sw.includes("const CACHE = 'msb-pro-v2.6.29'")) pass('sw-cache');
  else fail('sw-cache', sw.slice(0, 120));

  const index = read('index.html');
  if (index.includes("const APP_VERSION = '2.6.29'") && index.includes('id="app-version-label">v2.6.29')) {
    pass('index-version');
  } else fail('index-version', 'APP_VERSION / label mismatch');

  if (/function detectDeviceUiLang\(/.test(index)
    && /function getUiLangOverride\(/.test(index)
    && /function resolveUiLang\(/.test(index)
    && /function msbT\(/.test(index)
    && /function setUiLang\(/.test(index)
    && /function applyStaticI18n\(/.test(index)
    && /const MSB_I18N_ES =/.test(index)
    && /id="ap-lang-select"/.test(index)
    && /id="more-lang-select"/.test(index)
    && /function parseTwoPersonRequestPhrase\(/.test(index)
    && /MSB_LANG_KEY/.test(index)) {
    pass('v2625-fns');
  } else fail('v2625-fns', 'language helpers or picker missing');

  if (/const thinRoster = ROLES\.length <= 2/.test(index)
    && /function getScaledCloseTargets\(/.test(index)
    && /function leftoverMustFixViolations\(/.test(index)
    && /function isExpectedThinCoverageRemainder\(/.test(index)
    && /function summarizeWarningsForDisplay\(/.test(index)
    && /function shouldRecordFreeGenerate\(/.test(index)
    && /function rosterIsDemoForFreeCount\(/.test(index)
    && /freeGenerateLimit: 2/.test(index)
    && /function parseRequestPhrase\(/.test(index)
    && /function peelTrailingSingleDate\(/.test(index)
    && /See the coverage chip/.test(index)
    && /welcome-after-board/.test(index)
    && /id="btn-pro-gate-not-now"/.test(index)
    && /Undo request/.test(index)) {
    pass('v2612-v2624-kept');
  } else fail('v2612-v2624-kept', '2.6.12–2.6.24 markers missing');

  if (!/TJX|Marshalls|HomeGoods|Winners/i.test(index)) pass('no-employer-names');
  else fail('no-employer-names', 'employer name leaked into copy');

  if (/NRF 4-5-4 is the U\.S\. retail fiscal calendar/.test(index)
    && /does not apply Spain or Mexico labor rules/.test(index)
    && /No aplica reglas laborales de España ni México/.test(index)
    && /calendario fiscal minorista de EE\. UU\./.test(index)) {
    pass('nrf-stays-us-retail');
  } else fail('nrf-stays-us-retail', 'US NRF disclaimer missing in EN source or ES dict');

  if (!/googleapis\.com\/language|translate\.googleapis|cloud.?translate api|openai|anthropic|copilot that uploads/i.test(index)) {
    pass('no-cloud-translate');
  } else fail('no-cloud-translate', 'cloud translate / AI roster upload leaked in');

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
    const esPage = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      locale: 'es-MX',
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

    const deviceEs = await esPage.evaluate(() => {
      const setup = (document.getElementById('tabbtn-setup') || {}).textContent || '';
      const more = (document.getElementById('header-more-btn') || {}).textContent || '';
      const ask = [...document.querySelectorAll('.rpb-label')].map((el) => el.textContent).join(' ');
      const nrf = (document.getElementById('nrf-us-law-note') || {}).textContent || '';
      const picker = document.getElementById('ap-lang-select') || document.getElementById('more-lang-select');
      return {
        lang: document.documentElement.lang,
        resolved: typeof resolveUiLang === 'function' ? resolveUiLang() : '',
        detected: typeof detectDeviceUiLang === 'function' ? detectDeviceUiLang() : '',
        override: typeof getUiLangOverride === 'function' ? getUiLangOverride() : 'x',
        setup,
        more,
        ask,
        nrf,
        picker: picker ? picker.value : '',
        nav: navigator.language,
      };
    });
    if (deviceEs.detected === 'es' && deviceEs.resolved === 'es' && deviceEs.override == null
      && deviceEs.lang === 'es' && /Equipo/.test(deviceEs.setup) && /Más/.test(deviceEs.more)) {
      pass('device-es-default', deviceEs.nav + ' → ' + deviceEs.setup.trim());
    } else fail('device-es-default', JSON.stringify(deviceEs));

    if (/EE\.\s*UU/.test(deviceEs.nrf)
      && /No aplica reglas laborales de España ni México/.test(deviceEs.nrf)
      && !/ley laboral de España|reglas laborales mexicanas aplican/i.test(deviceEs.nrf)) {
      pass('nrf-not-non-us-law', 'Spanish chrome keeps US NRF');
    } else fail('nrf-not-non-us-law', deviceEs.nrf);

    await esPage.close();

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

    const enBoot = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      setup: (document.getElementById('tabbtn-setup') || {}).textContent || '',
      detected: typeof detectDeviceUiLang === 'function' ? detectDeviceUiLang() : '',
    }));
    if (enBoot.lang === 'en' && /Setup/.test(enBoot.setup)) pass('device-en-default', enBoot.setup.trim());
    else fail('device-en-default', JSON.stringify(enBoot));

    const switched = await page.evaluate(() => {
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
          const storeVal = ((document.getElementById('store-name') || {}).value || '');
          const smVal = ((document.getElementById('name-sm') || {}).value || '');
          const amVal = ((document.getElementById('name-am1') || {}).value || '');
          const setup = (document.getElementById('tabbtn-setup') || {}).textContent || '';
          const req = (document.getElementById('tabbtn-requests') || {}).textContent || '';
          const more = (document.getElementById('header-more-btn') || {}).textContent || '';
          const ask = (document.querySelector('.rpb-label') || {}).textContent || '';
          const welcome = (document.getElementById('welcome-body') || {}).textContent || '';
          const nrf = (document.getElementById('nrf-us-law-note') || {}).textContent || '';
          const posting = (document.querySelector('.posting-board h3') || {}).textContent || '';
          const saved = localStorage.getItem('msb_ui_lang');
          const picker = (document.getElementById('ap-lang-select') || {}).value
            || (document.getElementById('more-lang-select') || {}).value;
          resolve({
            beforeCount,
            afterBuild,
            afterLang,
            cells,
            cellsAfter: document.querySelectorAll('#schedule-grid td.shift-editable').length,
            storeVal,
            smVal,
            amVal,
            setup,
            req,
            more,
            ask,
            welcome,
            nrf,
            posting,
            saved,
            picker,
            lang: document.documentElement.lang,
          });
        }, 2600);
      });
    });

    if (switched.afterBuild === 1 && switched.afterLang === 1 && switched.afterBuild === switched.afterLang) {
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
      && /Más/.test(switched.more) && /Pedir/.test(switched.ask)
      && /Revisión para publicar|Publicación/.test(switched.posting + switched.welcome)
      && switched.lang === 'es') {
      pass('chrome-translates', [switched.setup, switched.req, switched.more, switched.ask].join(' · '));
    } else fail('chrome-translates', JSON.stringify({
      setup: switched.setup,
      req: switched.req,
      more: switched.more,
      ask: switched.ask,
      posting: switched.posting,
      welcome: switched.welcome.slice(0, 120),
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

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    const persisted = await page.evaluate(() => ({
      saved: localStorage.getItem('msb_ui_lang'),
      lang: document.documentElement.lang,
      setup: (document.getElementById('tabbtn-setup') || {}).textContent || '',
      sm: ((document.getElementById('name-sm') || {}).value || ''),
      store: ((document.getElementById('store-name') || {}).value || ''),
    }));
    if (persisted.saved === 'es' && persisted.lang === 'es' && /Equipo/.test(persisted.setup)
      && persisted.sm === 'Alex Rivera' && persisted.store === 'Riverside') {
      pass('override-persist', 'reload kept Spanish; names stayed typed');
    } else fail('override-persist', JSON.stringify(persisted));

    const story = await page.evaluate(() => {
      if (typeof leftoverMustFixViolations !== 'function') return { leftoverKeep: null };
      const roles = typeof getRoles === 'function' ? getRoles() : ['sm', 'am1'];
      const dks = (periodDates || []).map((d) => dateKey(d));
      if (!schedule.sm) schedule.sm = {};
      if (!schedule.am1) schedule.am1 = {};
      const workDk = dks.find((dk) => {
        const workers = roles.filter((r) => typeof isWork === 'function' && isWork(schedule[r] && schedule[r][dk])).length;
        return workers > 0;
      }) || dks[0];
      if (workDk) {
        if (!isWork(schedule.sm[workDk]) && !isWork(schedule.am1[workDk])) {
          schedule.sm[workDk] = 'open-late';
        }
      }
      const fakeDk = '1999-01-01';
      const prevSm = schedule.sm[fakeDk];
      const prevAm = schedule.am1[fakeDk];
      schedule.sm[fakeDk] = 'off';
      schedule.am1[fakeDk] = 'off';
      const leftoverKeep = leftoverMustFixViolations([
        { severity: 'error', rule: 'coverage-close', detail: '8/10: No closer', day: workDk },
        { severity: 'error', rule: 'five-day-week', detail: 'Alex Rivera: Week 1 has 4 scheduled days (target 5)' },
        { severity: 'error', rule: 'coverage-close', detail: '1/1: No closer', day: fakeDk },
        { severity: 'error', rule: 'no-clopen', detail: 'Sam Chen: Clopen on 8/15' },
      ], roles).map((v) => v.rule);
      if (prevSm == null) delete schedule.sm[fakeDk];
      else schedule.sm[fakeDk] = prevSm;
      if (prevAm == null) delete schedule.am1[fakeDk];
      else schedule.am1[fakeDk] = prevAm;
      const warn = typeof summarizeWarningsForDisplay === 'function'
        ? summarizeWarningsForDisplay([
          { type: 'error', msg: '8/12: No opener', day: workDk },
          { type: 'warn', msg: '8/13: No closer', day: workDk },
        ], roles)
        : [];
      const thinAsMust = warn.filter((w) => w.type === 'error' && /No opener|No closer/i.test(w.msg || ''));
      return { leftoverKeep, thinAsMust: thinAsMust.length, warnTypes: warn.map((w) => w.type), workDk };
    });
    if (Array.isArray(story.leftoverKeep)
      && story.leftoverKeep.includes('five-day-week')
      && story.leftoverKeep.includes('coverage-close')
      && !story.leftoverKeep.includes('no-clopen')
      && story.leftoverKeep.filter((r) => r === 'coverage-close').length === 1) {
      pass('v2624-one-story-holds', story.leftoverKeep.join(','));
    } else fail('v2624-one-story-holds', JSON.stringify(story.leftoverKeep));

    if (story.thinAsMust === 0) pass('p1-thin-not-mustfix-in-warnings', 'types=' + (story.warnTypes || []).join(','));
    else fail('p1-thin-not-mustfix-in-warnings', JSON.stringify(story));

    const askTwo = await page.evaluate(() => {
      if (typeof parseRequestPhrase !== 'function') return { ok: false, reason: 'missing' };
      const d = (periodDates && periodDates[10]) || new Date(2026, 7, 12);
      const md = (d.getMonth() + 1) + '/' + d.getDate();
      const parsed = parseRequestPhrase('Alex off ' + md + ' and Sam off ' + md);
      const bad = parseRequestPhrase('Alex off ' + md + ' and the intern off ' + md);
      return {
        ok: !!parsed.ok,
        multi: !!parsed.multi,
        n: parsed.items ? parsed.items.length : (parsed.ok ? 1 : 0),
        roles: parsed.items ? parsed.items.map((i) => i.role) : [parsed.role],
        names: parsed.items ? parsed.items.map((i) => i.name) : [parsed.name],
        badOk: !!(bad && bad.ok),
        badInvented: !!(bad && bad.ok && /intern/i.test(JSON.stringify(bad))),
        badMsg: (bad && bad.message) || '',
      };
    });
    if (askTwo.ok && askTwo.multi && askTwo.n === 2
      && askTwo.roles.indexOf('sm') !== -1 && askTwo.roles.indexOf('am1') !== -1) {
      pass('p2-two-named-one-date', askTwo.names.join(' · '));
    } else fail('p2-two-named-one-date', JSON.stringify(askTwo));
    if (!askTwo.badOk && !askTwo.badInvented && /read|leer|pinta/i.test(askTwo.badMsg)) {
      pass('p2-no-invented-person', askTwo.badMsg.slice(0, 80));
    } else fail('p2-no-invented-person', JSON.stringify({
      badOk: askTwo.badOk,
      badInvented: askTwo.badInvented,
      badMsg: askTwo.badMsg,
    }));

    await page.close();
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
