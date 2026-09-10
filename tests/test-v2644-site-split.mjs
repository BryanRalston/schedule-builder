/**
 * v2.6.46: thin landing at / ; builder at /app/ ; PWA/TWA still launch the builder.
 * Run: node tests/test-v2644-site-split.mjs
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
  '.ico': 'image/x-icon',
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

function staticChecks() {
  console.log('\n=== static ===');
  const landing = read('index.html');
  const app = read('app/index.html');
  const sw = read('sw.js');
  const manifest = JSON.parse(read('manifest.webmanifest'));
  const ver = JSON.parse(read('version.json'));
  const twa = JSON.parse(read('android-twa/twa-manifest.json'));
  const cname = read('CNAME').trim();
  const gradle = read('android-twa/app/build.gradle');

  if (cname === 'managerschedulepro.com') pass('cname', cname);
  else fail('cname', cname);

  if (ver.version === '2.6.46') pass('version.json', ver.version);
  else fail('version.json', JSON.stringify(ver));

  if (app.includes("APP_VERSION = '2.6.46'") && sw.includes('msb-pro-v2.6.46')
    && app.includes('id="app-version-label">v2.6.46')) {
    pass('app-sw-version');
  } else fail('app-sw-version', 'expected 2.6.46 in app + sw');

  if (twa.startUrl === '/schedule-builder/app/?source=pwa'
    && twa.appVersion === '2.6.46'
    && /launchUrl: '\/schedule-builder\/app\/\?source=pwa'/.test(gradle)) {
    pass('twa-start-url', twa.startUrl);
  } else fail('twa-start-url', twa.startUrl);

  if (manifest.start_url === './app/?source=pwa' && manifest.id === './app/'
    && manifest.shortcuts.every((s) => String(s.url || '').startsWith('./app/'))) {
    pass('manifest-start', manifest.start_url);
  } else fail('manifest-start', JSON.stringify({ id: manifest.id, start: manifest.start_url }));

  if (sw.includes("const APP_SHELL = './app/index.html'") && sw.includes("'./app/index.html'")
    && !sw.includes("caches.match('./index.html')")) {
    pass('sw-app-shell');
  } else fail('sw-app-shell', 'SW must precache / fall back to ./app/index.html');

  if (landing.includes('Open app') && landing.includes('href="app/"')
    && landing.includes('Manager Schedule Pro')
    && landing.includes('$19.99')
    && landing.includes('Cortex Developments')
    && landing.includes('mailto:b.ralston62989@gmail.com')
    && landing.includes('legal/privacy.html')
    && landing.includes('play.google.com/store/apps/details?id=com.managerschedulebuilder.pro')
    && landing.includes('ralstonia5.gumroad.com/l/pwplbc')
    && !landing.includes('id="tab-setup"')
    && !landing.includes('generateSchedule')) {
    pass('landing-is-brief');
  } else fail('landing-is-brief', 'root index.html is not a thin product brief');

  if (landing.includes('assets/landing/feature-team.png')
    && landing.includes('assets/landing/feature-review.png')
    && landing.includes('assets/landing/feature-export.png')
    && (landing.match(/href="app\/"/g) || []).length >= 2) {
    pass('landing-feature-shots');
  } else fail('landing-feature-shots', 'expected three desktop feature PNGs and a second Open app');

  if (landing.includes('href="https://managerschedulepro.com/"')
    && landing.includes('content="https://managerschedulepro.com/"')
    && landing.includes('https://managerschedulepro.com/icons/icon-512.png')
    && !/content="icons\//.test(landing)) {
    pass('landing-absolute-og');
  } else fail('landing-absolute-og', 'OG/canonical must be absolute managerschedulepro.com URLs');

  if (app.includes('id="tab-setup"') && app.includes('id="store-name"')
    && app.includes("register('../sw.js')")
    && app.includes('href="../manifest.webmanifest"')
    && app.includes('href="../buy.html"')
    && app.includes('href="../legal/privacy.html"')
    && app.includes("fetch('../monetization.json'")) {
    pass('app-relative-paths');
  } else fail('app-relative-paths', 'builder paths were not rewritten for /app/');

  if (landing.includes("source === 'pwa'") && landing.includes("location.replace('app/'")) {
    pass('pwa-query-redirect');
  } else fail('pwa-query-redirect', 'landing must send ?source=pwa to /app/');
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

    await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const home = await page.evaluate(() => ({
      title: document.title,
      h1: (document.querySelector('h1') || {}).textContent || '',
      openApp: !!(document.querySelector('a[href="app/"]')),
      setup: !!document.getElementById('tab-setup'),
      path: location.pathname
    }));
    if (home.title.includes('Manager Schedule Pro') && home.openApp && !home.setup
      && /\/$/.test(home.path)) {
      pass('home-is-landing', home.h1.slice(0, 60));
    } else fail('home-is-landing', JSON.stringify(home));

    await page.click('a[href="app/"]');
    await page.waitForSelector('#tab-setup, #store-name', { timeout: 20000 });
    const opened = await page.evaluate(() => ({
      path: location.pathname,
      setup: !!document.getElementById('tab-setup'),
      store: !!document.getElementById('store-name'),
      version: (document.getElementById('app-version-label') || {}).textContent || ''
    }));
    if (/\/app\/?/.test(opened.path) && opened.setup && opened.store && /v2\.6\.45/.test(opened.version)) {
      pass('open-app-builder', opened.path + ' ' + opened.version);
    } else fail('open-app-builder', JSON.stringify(opened));

    const built = await page.evaluate(() => {
      if (typeof endOnboardingTour === 'function') endOnboardingTour(true);
      const welcome = document.getElementById('welcome-card');
      if (welcome) {
        welcome.setAttribute('hidden', '');
        welcome.style.display = 'none';
      }
      if (typeof switchTab === 'function') switchTab('setup');
      const store = document.getElementById('store-name');
      if (store) store.value = 'Harbor Test';
      if (typeof persistStoreMeta === 'function') persistStoreMeta();
      const sm = document.getElementById('name-sm');
      const am = document.getElementById('name-am1');
      if (sm) sm.value = 'Dana';
      if (am) am.value = 'Alex';
      if (typeof persistManagerNames === 'function') persistManagerNames();
      if (typeof generateSchedule === 'function') generateSchedule({ skipFreeCount: true });
      return {
        store: store ? store.value : '',
        setup: !!(document.getElementById('tab-setup')),
        hasGenerate: typeof generateSchedule === 'function'
      };
    });
    if (built.store === 'Harbor Test' && built.setup && built.hasGenerate) pass('setup-field-works');
    else fail('setup-field-works', JSON.stringify(built));
    await page.waitForTimeout(1500);
    const afterGen = await page.evaluate(() => ({
      tab: typeof currentTab !== 'undefined' ? currentTab : (document.querySelector('.app-tab.active') || {}).id,
      cells: document.querySelectorAll('#schedule-grid td, .sched-cell, [data-shift]').length,
      summary: !!(document.getElementById('summary-grid') || document.getElementById('schedule-table'))
    }));
    if (afterGen.cells > 0 || afterGen.summary) pass('setup-then-generate', JSON.stringify(afterGen));
    else fail('setup-then-generate', JSON.stringify(afterGen));

    const privacy = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
    const privHref = await page.getAttribute('footer a[href="legal/privacy.html"]', 'href');
    await privacy.goto(base + '/' + privHref, { waitUntil: 'domcontentloaded' });
    const priv = await privacy.evaluate(() => ({
      title: document.title,
      backApp: !!(document.querySelector('a[href="../app/"]')),
      hasPhone: /tel:|\(\d{3}\)/.test(document.body.innerText)
    }));
    if (/Privacy/i.test(priv.title) && priv.backApp && !priv.hasPhone) pass('privacy-from-landing');
    else fail('privacy-from-landing', JSON.stringify(priv));
    await privacy.close();

    await page.goto(base + '/?source=pwa', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#app-root, #app-version-label', { timeout: 20000 });
    const pwa = await page.evaluate(() => ({
      href: location.href,
      path: location.pathname,
      builder: !!(document.getElementById('tab-setup') || document.getElementById('app-root'))
    }));
    if (/\/app\//.test(pwa.path) && pwa.href.includes('source=pwa') && pwa.builder) pass('source-pwa-redirect', pwa.href);
    else fail('source-pwa-redirect', JSON.stringify(pwa));

    await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
    const stayed = await page.evaluate(() => ({
      path: location.pathname,
      setup: !!document.getElementById('tab-setup')
    }));
    if (!stayed.setup && /\/$/.test(stayed.path)) pass('bare-root-stays-landing');
    else fail('bare-root-stays-landing', JSON.stringify(stayed));

    const buy = await page.getAttribute('a[href*="gumroad.com"]', 'href');
    const play = await page.getAttribute('a[href*="play.google.com"]', 'href');
    if (buy && buy.includes('pwplbc') && play && play.includes('com.managerschedulebuilder.pro')) {
      pass('secondary-ctas');
    } else fail('secondary-ctas', JSON.stringify({ buy, play }));
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('\n=== v2.6.46 site split: landing / + builder /app/ ===');
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

  const failed = results.filter((r) => !r.ok);
  console.log('\n' + results.filter((r) => r.ok).length + ' passed,', failed.length, 'failed');
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
