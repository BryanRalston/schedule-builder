/**
 * v2.6.29: first visit is not leftover tester chrome.
 * No named team → device language (or ?lang=), FREE · 2, Build enabled,
 * no stale store name. Named team keeps language override + remaining count.
 * Demo still does not consume a free build.
 * Keeps 2.6.12–2.6.28 behavior; version lock 2.6.29.
 * Run: node tests/test-v2629-ux.mjs
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

function seedDirtyTesterChrome() {
  localStorage.setItem('msb_tour_done', '1');
  localStorage.setItem('msb_welcome_dismissed', '1');
  localStorage.setItem('msb_ui_lang', 'es');
  localStorage.setItem('msb_free_generate_count', '2');
  localStorage.setItem('msb_store_meta', JSON.stringify({
    storeName: 'Playtest Store',
    storeNumber: '999',
  }));
}

function seedHarborEastChrome() {
  localStorage.setItem('msb_tour_done', '1');
  localStorage.setItem('msb_welcome_dismissed', '1');
  localStorage.setItem('msb_ui_lang', 'es');
  localStorage.setItem('msb_free_generate_count', '2');
  localStorage.setItem('msb_store_meta', JSON.stringify({
    storeName: 'Harbor East Demo Store',
    storeNumber: '851',
  }));
}

function seedRealRoster() {
  localStorage.setItem('msb_tour_done', '1');
  localStorage.setItem('msb_welcome_dismissed', '1');
  localStorage.setItem('schedule_manager_names', JSON.stringify({
    sm: 'Alex Rivera',
    amCount: 2,
    ams: { am1: 'Sam Chen', am2: '' },
    kcList: [{ id: 'kc1', name: '', asManager: false, midDows: [] }],
  }));
  localStorage.setItem('msb_store_meta', JSON.stringify({
    storeName: 'Riverside',
    storeNumber: '',
  }));
  localStorage.setItem('msb_ui_lang', 'es');
  localStorage.setItem('msb_free_generate_count', '1');
}

async function main() {
  console.log('\n=== v2.6.29 first visit is not leftover tester chrome ===');

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

  if (/function hasSavedUserPeople\(/.test(index)
    && /function isFirstVisitOpen\(/.test(index)
    && /function applyFirstVisitReset\(/.test(index)
    && /function getUiLangQuery\(/.test(index)
    && /function generateScheduleFromButton\(/.test(index)
    && /params\.get\('lang'\)/.test(index)) {
    pass('v2629-fns');
  } else fail('v2629-fns', '2.6.29 first-visit helpers missing');

  if (/function formatFyPeriodLabel\(/.test(index)
    && /function localizeWarningMsg\(/.test(index)
    && /function leftoverMustFixViolations\(/.test(index)
    && /function shouldRecordFreeGenerate\(/.test(index)
    && /function setUiLang\(/.test(index)
    && /function hasSavedUserRoster\(/.test(index)
    && /Leftover Harbor East persist is not a real roster/.test(index)
    && /welcome-after-board/.test(index)
    && /id="btn-pro-gate-not-now"/.test(index)
    && /const MSB_I18N_ES =/.test(index)) {
    pass('v2612-v2628-kept');
  } else fail('v2612-v2628-kept', '2.6.12–2.6.28 markers missing');

  if (!/TJX|Marshalls|HomeGoods|Winners/i.test(index)) pass('no-employer-names');
  else fail('no-employer-names', 'employer name leaked into copy');

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
    const dirty = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
    });
    await dirty.addInitScript(seedDirtyTesterChrome);
    await dirty.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dirty.waitForTimeout(900);

    const dirtyState = await dirty.evaluate(() => {
      const btn = document.getElementById('btn-generate');
      const setup = (document.getElementById('tabbtn-setup') || {}).textContent || '';
      return {
        lang: document.documentElement.lang,
        resolved: typeof resolveUiLang === 'function' ? resolveUiLang() : '',
        override: typeof getUiLangOverride === 'function' ? getUiLangOverride() : 'x',
        first: typeof isFirstVisitOpen === 'function' ? isFirstVisitOpen() : null,
        people: typeof hasSavedUserPeople === 'function' ? hasSavedUserPeople() : null,
        roster: typeof hasSavedUserRoster === 'function' ? hasSavedUserRoster() : null,
        left: typeof remainingFreeGenerates === 'function' ? remainingFreeGenerates() : null,
        count: typeof getFreeGenerateCount === 'function' ? getFreeGenerateCount() : null,
        can: typeof canGenerateSchedule === 'function' ? canGenerateSchedule() : null,
        chip: (document.getElementById('account-chip-plan') || {}).textContent || '',
        name: (document.getElementById('account-chip-name') || {}).textContent || '',
        store: ((document.getElementById('store-name') || {}).value || ''),
        storedLang: localStorage.getItem('msb_ui_lang'),
        storedStore: (() => {
          try { return JSON.parse(localStorage.getItem('msb_store_meta') || 'null'); } catch (e) { return null; }
        })(),
        disabled: !!(btn && btn.disabled),
        title: btn ? (btn.title || '') : '',
        setup: setup.trim(),
      };
    });
    if (dirtyState.lang === 'en' && dirtyState.resolved === 'en' && dirtyState.override == null
      && dirtyState.first === true && dirtyState.people === false
      && /Setup/.test(dirtyState.setup) && !/Equipo/.test(dirtyState.setup)) {
      pass('dirty-origin-device-en', dirtyState.setup);
    } else fail('dirty-origin-device-en', JSON.stringify(dirtyState));

    if (dirtyState.left === 2 && dirtyState.count === 0 && dirtyState.can === true
      && /2/.test(dirtyState.chip) && !dirtyState.disabled) {
      pass('dirty-origin-free-2-build-on', dirtyState.chip + ' disabled=' + dirtyState.disabled);
    } else fail('dirty-origin-free-2-build-on', JSON.stringify(dirtyState));

    if (!/playtest/i.test(dirtyState.store + dirtyState.name)
      && !(dirtyState.storedStore && /playtest/i.test(dirtyState.storedStore.storeName || ''))) {
      pass('dirty-origin-no-stale-store', dirtyState.name);
    } else fail('dirty-origin-no-stale-store', JSON.stringify(dirtyState));

    await dirty.close();

    const harborPage = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
    });
    await harborPage.addInitScript(seedHarborEastChrome);
    await harborPage.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await harborPage.waitForTimeout(800);
    const harbor = await harborPage.evaluate(() => ({
      lang: document.documentElement.lang,
      store: ((document.getElementById('store-name') || {}).value || ''),
      name: (document.getElementById('account-chip-name') || {}).textContent || '',
      left: typeof remainingFreeGenerates === 'function' ? remainingFreeGenerates() : null,
      can: typeof canGenerateSchedule === 'function' ? canGenerateSchedule() : null,
      setup: ((document.getElementById('tabbtn-setup') || {}).textContent || '').trim(),
    }));
    if (harbor.lang === 'en' && harbor.left === 2 && harbor.can === true
      && !/harbor east/i.test(harbor.store + harbor.name) && /Setup/.test(harbor.setup)) {
      pass('leftover-harbor-east-is-first-visit', harbor.name);
    } else fail('leftover-harbor-east-is-first-visit', JSON.stringify(harbor));
    await harborPage.close();

    const qEn = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
    });
    await qEn.addInitScript(seedDirtyTesterChrome);
    await qEn.goto(base + '/index.html?lang=en', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await qEn.waitForTimeout(800);
    const qEnState = await qEn.evaluate(() => ({
      lang: document.documentElement.lang,
      resolved: typeof resolveUiLang === 'function' ? resolveUiLang() : '',
      query: typeof getUiLangQuery === 'function' ? getUiLangQuery() : '',
      stored: localStorage.getItem('msb_ui_lang'),
      setup: ((document.getElementById('tabbtn-setup') || {}).textContent || '').trim(),
      left: typeof remainingFreeGenerates === 'function' ? remainingFreeGenerates() : null,
    }));
    if (qEnState.lang === 'en' && qEnState.resolved === 'en' && qEnState.query === 'en'
      && qEnState.stored === 'en' && /Setup/.test(qEnState.setup) && qEnState.left === 2) {
      pass('query-lang-en-wins', qEnState.setup);
    } else fail('query-lang-en-wins', JSON.stringify(qEnState));
    await qEn.close();

    const real = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
    });
    await real.addInitScript(seedRealRoster);
    await real.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await real.waitForTimeout(900);
    const realState = await real.evaluate(() => ({
      lang: document.documentElement.lang,
      resolved: typeof resolveUiLang === 'function' ? resolveUiLang() : '',
      override: typeof getUiLangOverride === 'function' ? getUiLangOverride() : null,
      first: typeof isFirstVisitOpen === 'function' ? isFirstVisitOpen() : null,
      people: typeof hasSavedUserPeople === 'function' ? hasSavedUserPeople() : null,
      left: typeof remainingFreeGenerates === 'function' ? remainingFreeGenerates() : null,
      count: typeof getFreeGenerateCount === 'function' ? getFreeGenerateCount() : null,
      sm: ((document.getElementById('name-sm') || {}).value || ''),
      am: ((document.getElementById('name-am1') || {}).value || ''),
      store: ((document.getElementById('store-name') || {}).value || ''),
      setup: ((document.getElementById('tabbtn-setup') || {}).textContent || '').trim(),
      storedLang: localStorage.getItem('msb_ui_lang'),
      storedCount: localStorage.getItem('msb_free_generate_count'),
    }));
    if (realState.first === false && realState.people === true
      && realState.lang === 'es' && realState.resolved === 'es' && realState.override === 'es'
      && realState.left === 1 && realState.count === 1
      && realState.sm === 'Alex Rivera' && realState.am === 'Sam Chen'
      && realState.store === 'Riverside' && /Equipo/.test(realState.setup)) {
      pass('real-roster-keeps-lang-and-count', realState.setup + ' · left ' + realState.left);
    } else fail('real-roster-keeps-lang-and-count', JSON.stringify(realState));
    await real.close();

    const demoPage = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
    });
    await demoPage.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await demoPage.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('msb_tour_done', '1');
      localStorage.setItem('msb_welcome_dismissed', '1');
    });
    await demoPage.reload({ waitUntil: 'domcontentloaded' });
    await demoPage.waitForTimeout(700);
    const demo = await demoPage.evaluate(() => {
      const before = typeof getFreeGenerateCount === 'function' ? getFreeGenerateCount() : null;
      const beforeLeft = typeof remainingFreeGenerates === 'function' ? remainingFreeGenerates() : null;
      if (typeof loadDemoStore === 'function') loadDemoStore({ explicit: true, confirmed: true });
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            before,
            beforeLeft,
            after: typeof getFreeGenerateCount === 'function' ? getFreeGenerateCount() : null,
            left: typeof remainingFreeGenerates === 'function' ? remainingFreeGenerates() : null,
            store: ((document.getElementById('store-name') || {}).value || ''),
            cells: document.querySelectorAll('#schedule-grid td.shift-editable').length,
          });
        }, 2600);
      });
    });
    if (demo.after === demo.before && demo.left === 2 && /harbor east/i.test(demo.store) && demo.cells > 10) {
      pass('demo-does-not-consume', 'still ' + demo.left + ' left');
    } else fail('demo-does-not-consume', JSON.stringify(demo));

    const rebuild = await demoPage.evaluate(() => {
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
      const before = typeof getFreeGenerateCount === 'function' ? getFreeGenerateCount() : null;
      if (typeof generateScheduleFromButton === 'function') generateScheduleFromButton();
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            before,
            after: typeof getFreeGenerateCount === 'function' ? getFreeGenerateCount() : null,
            hasBoard: typeof hasLiveBuiltBoard === 'function' ? hasLiveBuiltBoard() : null,
          });
        }, 2400);
      });
    });
    if (rebuild.hasBoard && rebuild.after === rebuild.before) {
      pass('rebuild-to-apply-skips-free', 'count stayed ' + rebuild.after);
    } else fail('rebuild-to-apply-skips-free', JSON.stringify(rebuild));
    await demoPage.close();
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
