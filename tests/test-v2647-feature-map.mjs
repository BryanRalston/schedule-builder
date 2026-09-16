/**
 * v2.6.47: in-app Feature Map — current capabilities only.
 * Entry from More / footer / Account; hash #feature-map; Spanish chrome.
 * Run: node tests/test-v2647-feature-map.mjs
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
  '.ico': 'application/octet-stream',
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

const GROUPS = ['build', 'requests', 'review', 'local', 'look', 'plans'];

function sliceFeatureMap(app) {
  const start = app.indexOf('id="feature-map-modal"');
  if (start < 0) return '';
  const from = app.lastIndexOf('<div', start);
  const end = app.indexOf('<!-- Account panel -->', start);
  return end > from ? app.slice(from, end) : app.slice(from, from + 6000);
}

function staticChecks() {
  console.log('\n=== static ===');
  const app = read('app/index.html');
  const landing = read('index.html');
  const sw = read('sw.js');
  const ver = JSON.parse(read('version.json'));
  const twa = JSON.parse(read('android-twa/twa-manifest.json'));
  const map = sliceFeatureMap(app);

  if (ver.version === '2.6.47') pass('version.json', ver.version);
  else fail('version.json', JSON.stringify(ver));

  if (app.includes("APP_VERSION = '2.6.47'") && sw.includes('msb-pro-v2.6.47')
    && app.includes('id="app-version-label">v2.6.47')) {
    pass('app-sw-version');
  } else fail('app-sw-version', 'expected 2.6.47');

  if (twa.appVersion === '2.6.47' && twa.appVersionName === '2.6.47'
    && twa.appVersionCode === 2647) {
    pass('twa-version');
  } else fail('twa-version', JSON.stringify({
    v: twa.appVersion, n: twa.appVersionName, c: twa.appVersionCode
  }));

  if (app.includes('id="feature-map-modal"') && app.includes('function openFeatureMap')
    && app.includes('function closeFeatureMap') && app.includes('maybeOpenFeatureMapFromHash')
    && app.includes("addEventListener('hashchange'")) {
    pass('feature-map-present');
  } else fail('feature-map-present', 'modal or open/close helpers missing');

  if (app.includes('id="header-menu-feature-map"') && app.includes('id="footer-feature-map"')
    && app.includes('id="ap-feature-map-btn"')
    && app.includes("id: 'feature-map'")
    && /data-i18n="Feature Map"/.test(app)
    && /data-i18n="What's included"/.test(app)) {
    pass('feature-map-entries');
  } else fail('feature-map-entries', 'More / footer / Account / palette entry missing');

  const missingGroups = GROUPS.filter((g) => !map.includes('data-fm-group="' + g + '"'));
  if (!missingGroups.length && /Build the period/.test(map)
    && /Requests/.test(map) && /Review before you post/.test(map)
    && /Stay local/.test(map) && /Language/.test(map) && /Free vs Pro/.test(map)) {
    pass('capability-groups', GROUPS.join(','));
  } else fail('capability-groups', missingGroups.join(',') || 'headings missing');

  if (/NRF 4-5-4/.test(map) && /U\.S\. retail calendar only/.test(map)
    && /Store Manager/.test(map) && /Ask bar/.test(map)
    && /clopen-avoidance is a preference/.test(map)
    && /Quality chips/.test(map) && /Backup JSON/.test(map)
    && /Light is the first-visit default/.test(map)
    && /2 schedule builds/.test(map) && /\$19\.99 one-time/.test(map)
    && /Word\/Excel/.test(map)) {
    pass('shipped-copy');
  } else fail('shipped-copy', 'expected current-capability phrases missing');

  const banned = [];
  if (/coming soon/i.test(map)) banned.push('coming soon');
  if (/wishlist/i.test(map)) banned.push('wishlist');
  if (/roadmap/i.test(map)) banned.push('roadmap');
  if (/labor law/i.test(map)) banned.push('labor law');
  if (/Spain or Mexico labor/.test(map) === false && /labor holidays/.test(map)) banned.push('labor holidays');
  if (banned.length) fail('no-future-promises', banned.join(','));
  else pass('no-future-promises');

  if (app.includes("'Feature Map': 'Mapa de funciones'")
    && app.includes("'What\\'s included': 'Qué incluye'") === false
    && (app.includes("\"What's included\": 'Qué incluye'") || app.includes("'What\\'s included'"))
    && app.includes("'Build the period': 'Armar el período'")
    && app.includes("'Stay local': 'Se queda en este teléfono'")) {
    pass('spanish-chrome');
  } else if (app.includes("'Feature Map': 'Mapa de funciones'")
    && app.includes('Qué incluye')
    && app.includes("'Build the period': 'Armar el período'")) {
    pass('spanish-chrome');
  } else fail('spanish-chrome', 'Feature Map chrome keys missing from MSB_I18N_ES');

  if (landing.includes('href="app/#feature-map"') && landing.includes("What's included")
    && !landing.includes('id="tab-setup"') && landing.includes('id="features"')) {
    pass('landing-thin-link');
  } else fail('landing-thin-link', 'landing should keep #features and add app/#feature-map');

  if (!app.includes('id="features"')) pass('app-not-marketing-features-id');
  else fail('app-not-marketing-features-id', 'builder must not reuse landing id="features"');
}

async function browserChecks(base, chromium) {
  console.log('\n=== browser ===');
  const browser = await chromium.launch({
    executablePath: existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(base + '/app/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#header-more-btn, #feature-map-modal', { timeout: 20000 });

    const closedFirst = await page.evaluate(() => {
      const m = document.getElementById('feature-map-modal');
      return !m || m.hasAttribute('hidden');
    });
    if (closedFirst) pass('modal-starts-hidden');
    else fail('modal-starts-hidden', 'Feature Map open on default /app/');

    await page.click('#header-more-btn');
    await page.waitForSelector('#header-menu-feature-map', { timeout: 8000 });
    await page.click('#header-menu-feature-map');
    const fromMore = await page.evaluate(() => {
      const m = document.getElementById('feature-map-modal');
      const groups = Array.from(document.querySelectorAll('#feature-map-sections [data-fm-group]'))
        .map((el) => el.getAttribute('data-fm-group'));
      const title = (document.getElementById('feature-map-title') || {}).textContent || '';
      return {
        open: m && !m.hasAttribute('hidden'),
        groups,
        title: title.trim(),
        text: (document.getElementById('feature-map-sections') || {}).innerText || ''
      };
    });
    if (fromMore.open && fromMore.title === 'Feature Map') pass('open-from-more', fromMore.groups.join(','));
    else fail('open-from-more', JSON.stringify(fromMore));

    const haveAll = GROUPS.every((g) => fromMore.groups.includes(g));
    if (haveAll && /NRF/.test(fromMore.text) && /Free/.test(fromMore.text)
      && /Pro/.test(fromMore.text) && !/coming soon/i.test(fromMore.text)) {
      pass('groups-visible', fromMore.groups.join(','));
    } else fail('groups-visible', JSON.stringify(fromMore));

    await page.click('#feature-map-close');
    const closed = await page.evaluate(() => {
      const m = document.getElementById('feature-map-modal');
      return !m || m.hasAttribute('hidden');
    });
    if (closed) pass('close-hides-modal');
    else fail('close-hides-modal', 'still open');

    await page.click('#account-chip');
    await page.waitForSelector('#ap-feature-map-btn', { timeout: 8000 });
    await page.click('#ap-feature-map-btn');
    const fromAccount = await page.evaluate(() => {
      const map = document.getElementById('feature-map-modal');
      const acct = document.getElementById('account-modal');
      return {
        mapOpen: map && !map.hasAttribute('hidden'),
        acctClosed: !acct || acct.hasAttribute('hidden')
      };
    });
    if (fromAccount.mapOpen && fromAccount.acctClosed) pass('open-from-account');
    else fail('open-from-account', JSON.stringify(fromAccount));

    await page.click('#feature-map-close');

    await page.evaluate(() => {
      if (typeof setUiLang === 'function') setUiLang('es');
    });
    await page.click('#footer-feature-map');
    const esChrome = await page.evaluate(() => {
      const title = (document.getElementById('feature-map-title') || {}).textContent || '';
      const kicker = (document.querySelector('.feature-map-kicker') || {}).textContent || '';
      const headings = Array.from(document.querySelectorAll('#feature-map-sections h4'))
        .map((el) => el.textContent.trim());
      return { title: title.trim(), kicker: kicker.trim(), headings };
    });
    if (esChrome.title === 'Mapa de funciones' && /incluye/i.test(esChrome.kicker)
      && esChrome.headings.includes('Armar el período')
      && esChrome.headings.includes('Se queda en este teléfono')) {
      pass('spanish-chrome-live', esChrome.headings.join(' | '));
    } else fail('spanish-chrome-live', JSON.stringify(esChrome));

    await page.click('#feature-map-close');
    await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.goto(base + '/app/#feature-map', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => {
      const m = document.getElementById('feature-map-modal');
      return m && !m.hasAttribute('hidden');
    }, { timeout: 20000 });
    const fromHash = await page.evaluate(() => {
      const m = document.getElementById('feature-map-modal');
      return m && !m.hasAttribute('hidden');
    });
    if (fromHash) pass('open-from-hash');
    else fail('open-from-hash', 'hash #feature-map did not open Feature Map');

    await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const landingHref = await page.evaluate(() => {
      const a = document.querySelector('a[href="app/#feature-map"]');
      return a ? a.getAttribute('href') : '';
    });
    if (landingHref === 'app/#feature-map') pass('landing-link-live');
    else fail('landing-link-live', landingHref || 'missing');
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('\n=== v2.6.47 Feature Map ===');
  staticChecks();

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

  const failed = results.filter((r) => r.ok === false);
  console.log('\n' + results.filter((r) => r.ok).length + ' passed,', failed.length, 'failed');
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
