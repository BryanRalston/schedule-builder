/**
 * v2.6.50: in-app Feature Map of CURRENT capabilities.
 * Discoverable from More / Help / Account. Spanish chrome for the entry.
 * Not a roadmap. No coming-soon / App Expert / future-ship copy.
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

const REQUIRED_SECTIONS = [
  'On this device',
  'Team & store',
  'Requests',
  'Preferences & role rules',
  'Build & review',
  'Board & posting',
  'Language & look',
  'New phone',
  'Pro unlock',
];

const REQUIRED_FACTS = [
  'No account',
  'NRF 4-5-4',
  'PTO',
  'RTO',
  'LOA',
  'ask bar',
  'preference',
  '2 builds',
  'Review chips',
  'Print',
  'Word',
  'Excel',
  'Spanish',
  'Light (default)',
  'Backup JSON',
  'Gumroad',
  'MSB-PRO-',
];

function staticChecks() {
  console.log('\n=== static ===');
  const app = read('app/index.html');
  const landing = read('index.html');
  const sw = read('sw.js');
  const ver = JSON.parse(read('version.json'));
  const twa = JSON.parse(read('android-twa/twa-manifest.json'));

  if (ver.version === '2.6.50') pass('version.json', ver.version);
  else fail('version.json', JSON.stringify(ver));

  if (app.includes("APP_VERSION = '2.6.50'") && sw.includes('msb-pro-v2.6.50')
    && app.includes('id="app-version-label">v2.6.50')) {
    pass('app-sw-version');
  } else fail('app-sw-version', 'expected 2.6.50');

  if (twa.appVersion === '2.6.50' && twa.appVersionName === '2.6.50') pass('twa-version');
  else fail('twa-version', JSON.stringify({ v: twa.appVersion, n: twa.appVersionName }));

  if (app.includes('id="feature-map-modal"') && app.includes('function openFeatureMap')
    && app.includes('function closeFeatureMap')) {
    pass('feature-map-panel');
  } else fail('feature-map-panel', 'missing modal or open/close');

  if (app.includes('onclick="openFeatureMap(); closeHeaderMenu()"')
    && app.includes('data-i18n="Feature Map"')) {
    pass('more-help-entry');
  } else fail('more-help-entry', 'More → Help must open Feature Map');

  if (app.includes('closeAccountPanel(); openFeatureMap();')) {
    pass('account-entry');
  } else fail('account-entry', 'Account panel must open Feature Map');

  if (/footer[\s\S]*openFeatureMap\(\)/.test(app) || app.includes('onclick="openFeatureMap()" data-i18n="Feature Map"')) {
    pass('footer-help-entry');
  } else fail('footer-help-entry', 'footer Help row must include Feature Map');

  if (app.includes("'Feature Map': 'Mapa de funciones'")
    && app.includes("'What this app can do': 'Qué puede hacer esta app'")
    && app.includes("'What ships today — not a roadmap.': 'Lo que hay hoy — no es una hoja de ruta.'")) {
    pass('spanish-chrome');
  } else fail('spanish-chrome', 'MSB_I18N_ES missing Feature Map chrome');

  const bodyStart = app.indexOf('id="feature-map-body"');
  const body = bodyStart >= 0 ? app.slice(bodyStart, bodyStart + 4500) : '';
  const missingSec = REQUIRED_SECTIONS.filter((s) => {
    const html = s.replace(/&/g, '&amp;');
    return !body.includes(s) && !body.includes(html);
  });
  if (!missingSec.length) pass('sections', REQUIRED_SECTIONS.length + ' headings');
  else fail('sections', 'missing ' + missingSec.join(', '));

  const missingFact = REQUIRED_FACTS.filter((s) => !body.includes(s));
  if (!missingFact.length) pass('current-facts');
  else fail('current-facts', 'missing ' + missingFact.join(', '));

  const modalStart = app.indexOf('id="feature-map-modal"');
  const modal = modalStart >= 0 ? app.slice(modalStart, modalStart + 7000) : '';
  if (/coming soon|app expert|paused ship|future ship/i.test(modal)) {
    fail('no-future-copy', 'Feature Map lists future / paused / App Expert copy');
  } else if (!/not a roadmap/i.test(modal)) {
    fail('no-future-copy', 'expected “not a roadmap” chrome');
  } else {
    pass('no-future-copy');
  }

  if (app.includes("params.get('map')") && app.includes('openFeatureMap()')) {
    pass('launch-query');
  } else fail('launch-query', 'expected ?map=1 launch');

  if (app.includes("id: 'feature-map'") && app.includes("label: 'Feature Map'")) {
    pass('command-palette');
  } else fail('command-palette', '⌘K Help command missing');

  if (landing.includes('id="can-do"') && landing.includes('href="app/?map=1"')
    && landing.includes('What this app can do')
    && !landing.includes('id="tab-setup"')
    && !landing.includes('generateSchedule')) {
    pass('landing-compact-mirror');
  } else fail('landing-compact-mirror', 'landing should stay thin and link app/?map=1');
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
    await page.waitForSelector('#header-more-btn, #welcome-title', { timeout: 20000 });

    const boot = await page.evaluate(() => {
      const modal = document.getElementById('feature-map-modal');
      const more = document.getElementById('header-more-btn');
      return {
        version: (document.getElementById('app-version-label') || {}).textContent || '',
        theme: document.documentElement.getAttribute('data-theme'),
        hidden: !modal || modal.hasAttribute('hidden'),
        more: !!(more && /More/i.test(more.textContent || '')),
        hasOpen: typeof openFeatureMap === 'function',
      };
    });
    if (/v2\.6\.49/.test(boot.version) && boot.theme === 'light' && boot.hidden && boot.hasOpen) {
      pass('boot-closed', boot.version);
    } else fail('boot-closed', JSON.stringify(boot));

    await page.click('#header-more-btn');
    await page.waitForSelector('#header-menu-panel:not([hidden])', { timeout: 5000 });
    const moreItem = await page.evaluate(() => {
      const panel = document.getElementById('header-menu-panel');
      const btn = panel && [...panel.querySelectorAll('button')].find((b) => /Feature Map/i.test(b.textContent || ''));
      return btn ? btn.getAttribute('data-i18n') : '';
    });
    if (moreItem === 'Feature Map') pass('more-menu-item');
    else fail('more-menu-item', moreItem);

    await page.evaluate(() => {
      const panel = document.getElementById('header-menu-panel');
      const btn = panel && [...panel.querySelectorAll('button')].find((b) => /Feature Map/i.test(b.textContent || ''));
      if (btn) btn.click();
    });
    await page.waitForFunction(() => {
      const m = document.getElementById('feature-map-modal');
      return m && !m.hasAttribute('hidden');
    }, { timeout: 5000 });

    const open = await page.evaluate(() => {
      const modal = document.getElementById('feature-map-modal');
      const body = document.getElementById('feature-map-body');
      const heads = body ? [...body.querySelectorAll('h4')].map((h) => h.textContent.trim()) : [];
      const text = body ? body.textContent : '';
      const title = (document.getElementById('feature-map-title') || {}).textContent || '';
      const cs = modal ? getComputedStyle(modal.querySelector('.feature-map-card')) : null;
      return {
        title,
        heads,
        text,
        bg: cs ? cs.backgroundColor : '',
        color: cs ? cs.color : '',
      };
    });
    const missing = REQUIRED_SECTIONS.filter((s) => !open.heads.includes(s));
    if (!missing.length && /NRF 4-5-4/.test(open.text) && /MSB-PRO-/.test(open.text)) {
      pass('panel-open-sections', open.heads.join(' · '));
    } else fail('panel-open-sections', JSON.stringify({ missing, title: open.title }));

    await page.evaluate(() => { if (typeof setUiLang === 'function') setUiLang('es'); });
    const es = await page.evaluate(() => {
      const more = document.getElementById('header-more-btn');
      const kicker = document.querySelector('#feature-map-title .fm-kicker');
      const title = document.querySelector('#feature-map-title .fm-title');
      const sub = document.querySelector('.fm-sub');
      return {
        more: more ? more.textContent.trim() : '',
        kicker: kicker ? kicker.textContent.trim() : '',
        title: title ? title.textContent.trim() : '',
        sub: sub ? sub.textContent.trim() : '',
      };
    });
    if (es.kicker === 'Mapa de funciones' && es.title === 'Qué puede hacer esta app'
      && /hoja de ruta/.test(es.sub)) {
      pass('spanish-entry', es.kicker);
    } else fail('spanish-entry', JSON.stringify(es));

    await page.evaluate(() => { if (typeof closeFeatureMap === 'function') closeFeatureMap(); });
    await page.goto(base + '/app/?map=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => {
      const m = document.getElementById('feature-map-modal');
      return m && !m.hasAttribute('hidden');
    }, { timeout: 8000 });
    pass('launch-map-query');

    await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const land = await page.evaluate(() => {
      const el = document.getElementById('can-do');
      const a = el && el.querySelector('a[href="app/?map=1"]');
      return { has: !!el, href: a ? a.getAttribute('href') : '', text: el ? el.textContent : '' };
    });
    if (land.has && land.href === 'app/?map=1' && /What this app can do/.test(land.text)) {
      pass('landing-can-do');
    } else fail('landing-can-do', JSON.stringify(land));
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('\n=== v2.6.50 Feature Map ===');
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
