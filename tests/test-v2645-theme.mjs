/**
 * v2.6.46: light appearance is the default; dark stays an on-device option.
 * Logo maroon + gold replace purple/cyan brand splashes in app + landing.
 * Run: node tests/test-v2645-theme.mjs
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
  const app = read('app/index.html');
  const landing = read('index.html');
  const sw = read('sw.js');
  const ver = JSON.parse(read('version.json'));
  const manifest = JSON.parse(read('manifest.webmanifest'));

  if (ver.version === '2.6.46') pass('version.json', ver.version);
  else fail('version.json', JSON.stringify(ver));

  if (app.includes("APP_VERSION = '2.6.46'") && sw.includes('msb-pro-v2.6.46')
    && app.includes('id="app-version-label">v2.6.46')) {
    pass('app-sw-version');
  } else fail('app-sw-version', 'expected 2.6.46');

  if (app.includes("msb_appearance") && app.includes("MSB_THEME_KEY")
    && app.includes('function setAppearance') && app.includes("return 'light'")) {
    pass('appearance-api');
  } else fail('appearance-api', 'missing light-default appearance helpers');

  if (app.includes('id="more-theme-select"') && app.includes('id="ap-theme-select"')
    && app.includes('data-i18n="Appearance"') && app.includes("'Appearance': 'Apariencia'")
    && app.includes("'Light': 'Claro'") && app.includes("'Dark': 'Oscuro'")) {
    pass('appearance-toggle-i18n');
  } else fail('appearance-toggle-i18n', 'Account/More Appearance chrome + Spanish missing');

  if (/--accent:\s*#701030/.test(app) && /--accent-2:\s*#e0b020/.test(app)
    && app.includes('html[data-theme="dark"]')
    && !/:root\s*\{[^}]*--accent:\s*#7c5cff/s.test(app)) {
    pass('app-logo-tokens');
  } else fail('app-logo-tokens', 'light :root must use maroon + gold, not purple/cyan');

  if (app.includes('content="#f4f6fa"') && app.includes('content="light"')
    && manifest.theme_color === '#f4f6fa' && manifest.background_color === '#f4f6fa') {
    pass('theme-color-light-default');
  } else fail('theme-color-light-default', JSON.stringify({
    theme: manifest.theme_color, bg: manifest.background_color
  }));

  if (app.includes('--ok:') && app.includes('--warn:') && app.includes('--bad:')
    && app.includes('--role-sm') && app.includes('--role-am') && app.includes('--role-kc')) {
    pass('semantic-and-role-tokens');
  } else fail('semantic-and-role-tokens', 'keep quality + role colors tokenized');

  if (/--accent:\s*#701030/.test(landing) && /--accent-2:\s*#e0b020/.test(landing)
    && landing.includes('content="light"')) {
    pass('landing-logo-accents');
  } else fail('landing-logo-accents', 'landing must keep light marketing + logo accents');
}

async function browserChecks(base, chromium) {
  console.log('\n=== browser ===');
  const browser = await chromium.launch({
    executablePath: existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(base + '/app/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#app-version-label, #tab-setup', { timeout: 20000 });
    const first = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const paper = cs.getPropertyValue('--paper').trim();
      const accent = cs.getPropertyValue('--accent').trim();
      const gold = cs.getPropertyValue('--accent-2').trim();
      const theme = document.documentElement.getAttribute('data-theme');
      const stored = localStorage.getItem('msb_appearance');
      const more = document.getElementById('more-theme-select');
      const ap = document.getElementById('ap-theme-select');
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      return {
        theme, stored, paper, accent, gold,
        moreVal: more ? more.value : null,
        apVal: ap ? ap.value : null,
        bodyBg,
        version: (document.getElementById('app-version-label') || {}).textContent || ''
      };
    });
    const paperLight = /#f4f6fa/i.test(first.paper);
    const brand = /#701030/i.test(first.accent) && /#e0b020/i.test(first.gold);
    if (first.theme === 'light' && (first.stored == null || first.stored === 'light')
      && paperLight && brand && first.moreVal === 'light' && /v2\.6\.46/.test(first.version)) {
      pass('default-light', JSON.stringify({ theme: first.theme, paper: first.paper, accent: first.accent }));
    } else fail('default-light', JSON.stringify(first));

    await page.evaluate(() => {
      if (typeof setAppearance === 'function') setAppearance('dark');
    });
    const dark = await page.evaluate(() => ({
      theme: document.documentElement.getAttribute('data-theme'),
      stored: localStorage.getItem('msb_appearance'),
      paper: getComputedStyle(document.documentElement).getPropertyValue('--paper').trim(),
      meta: (document.querySelector('meta[name="theme-color"]') || {}).content || '',
      moreVal: (document.getElementById('more-theme-select') || {}).value || ''
    }));
    if (dark.theme === 'dark' && dark.stored === 'dark' && /#070b14/i.test(dark.paper)
      && dark.meta === '#070b14' && dark.moreVal === 'dark') {
      pass('toggle-dark-persists', JSON.stringify(dark));
    } else fail('toggle-dark-persists', JSON.stringify(dark));

    const page2 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page2.addInitScript(() => {
      try { localStorage.setItem('msb_appearance', 'dark'); } catch (e) {}
    });
    await page2.goto(base + '/app/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page2.waitForSelector('#app-version-label, #tab-setup', { timeout: 20000 });
    const restored = await page2.evaluate(() => ({
      theme: document.documentElement.getAttribute('data-theme'),
      stored: localStorage.getItem('msb_appearance'),
      paper: getComputedStyle(document.documentElement).getPropertyValue('--paper').trim()
    }));
    if (restored.theme === 'dark' && restored.stored === 'dark' && /#070b14/i.test(restored.paper)) {
      pass('saved-dark-restores');
    } else fail('saved-dark-restores', JSON.stringify(restored));
    await page2.close();

    await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
    const home = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      return {
        accent: cs.getPropertyValue('--accent').trim(),
        gold: cs.getPropertyValue('--accent-2').trim(),
        setup: !!document.getElementById('tab-setup'),
        shots: Array.from(document.querySelectorAll('img[src*="assets/landing/feature-"]')).map((i) => i.getAttribute('src'))
      };
    });
    if (!home.setup && /#701030/i.test(home.accent) && /#e0b020/i.test(home.gold)
      && home.shots.length === 3) {
      pass('landing-light-logo-shots', home.shots.join(','));
    } else fail('landing-light-logo-shots', JSON.stringify(home));
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('\n=== v2.6.46 light default + logo accents ===');
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
