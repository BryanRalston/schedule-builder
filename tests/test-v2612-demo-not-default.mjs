/**
 * v2.6.12: Harbor East demo must never auto-load on / or ?source=pwa.
 * Tour / ?demo=1 still load the sample. Real saved rosters stay put.
 *
 * Regression: Play TWA (startUrl ?source=pwa) and empty storage must show a
 * blank team — not Alex Morgan / Harbor East Demo Store. Leftover tour
 * persist is not a real roster. Save-team / typed names are kept.
 *
 * Run: node tests/test-v2612-demo-not-default.mjs
 */
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

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
    const mod = await import(spec);
    if (mod.chromium) return mod.chromium;
  }
  throw new Error('Playwright not installed');
}

const DEMO_LEFTOVER = {
  names: {
    sm: 'Alex Morgan',
    amCount: 3,
    ams: { am1: 'Casey Brooks', am2: 'Riley Quinn', am3: 'Taylor Hayes' },
    kcList: [
      { id: 'kc1', name: 'Jordan Lee', asManager: false, midDows: [0, 2, 4, 5] },
      { id: 'kc2', name: 'Sam Rivera', asManager: false, midDows: [3, 6] },
    ],
  },
  meta: { storeName: 'Harbor East Demo Store', storeNumber: '851' },
};

const REAL_ROSTER = {
  names: {
    sm: 'Pat Nguyen',
    amCount: 2,
    ams: { am1: 'Chris Ortiz', am2: 'Jamie Cole' },
    kcList: [{ id: 'kc1', name: 'Morgan Blake', asManager: false, midDows: [] }],
  },
  meta: { storeName: 'Westfield #12', storeNumber: '412' },
};

function readSetup(page) {
  return page.evaluate(() => ({
    sm: (document.getElementById('name-sm') || {}).value || '',
    am1: (document.getElementById('name-am1') || {}).value || '',
    am2: (document.getElementById('name-am2') || {}).value || '',
    am3: (document.getElementById('name-am3') || {}).value || '',
    store: (document.getElementById('store-name') || {}).value || '',
    num: (document.getElementById('store-number') || {}).value || '',
    origin: (() => { try { return localStorage.getItem('msb_roster_origin') || ''; } catch (e) { return ''; } })(),
  }));
}

function looksLikeDemo(s) {
  const blob = [s.sm, s.am1, s.am2, s.am3, s.store].join(' ');
  return /Harbor East Demo Store|Alex Morgan|Casey Brooks|Riley Quinn|Taylor Hayes|Jordan Lee|Sam Rivera/.test(blob);
}

function looksBlank(s) {
  return !s.sm.trim() && !s.am1.trim() && !s.store.trim() && !looksLikeDemo(s);
}

async function openFresh(page, base, path) {
  await page.goto(base + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('msb_tour_done', '1');
    localStorage.setItem('msb_welcome_dismissed', '1');
  });
  await page.goto(base + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(500);
}

async function main() {
  console.log('\n=== v2.6.12 demo is a tour, not default data ===');

  const version = JSON.parse(read('version.json'));
  if (version.version === '2.6.12') pass('version.json', version.version);
  else fail('version.json', JSON.stringify(version));

  const index = read('index.html');
  if (/const DEMO_STORE =/.test(index) && /function applyBlankTeam\(/.test(index) && /function isExplicitDemoLaunch\(/.test(index)) {
    pass('demo-honesty-fns');
  } else fail('demo-honesty-fns', 'missing DEMO_STORE / applyBlankTeam / isExplicitDemoLaunch');

  if (/params\.get\('demo'\) === '1'/.test(index) && /source=pwa/.test(index)) {
    pass('launch-query-demo-only');
  } else fail('launch-query-demo-only', 'handleLaunchQuery must gate demo=1 and mention source=pwa');

  const launchIdx = index.indexOf('function handleLaunchQuery');
  const launchFn = launchIdx >= 0 ? index.slice(launchIdx, launchIdx + 700) : '';
  if (launchFn.includes("params.get('demo') === '1'") && !/params\.get\('source'\).*loadDemoStore/.test(launchFn)) {
    pass('source-pwa-never-loads-demo');
  } else fail('source-pwa-never-loads-demo', launchFn.slice(0, 200));

  if (/id="btn-tour-sample-store"[^>]*onclick="loadDemoStore\(\)"/.test(index)) {
    pass('tour-button-explicit');
  } else fail('tour-button-explicit', 'Tour sample store not wired');

  const { chromium } = { chromium: await loadChromium() };
  const { server, base } = await startStaticServer();
  const browser = await chromium.launch({
    executablePath: existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

    await openFresh(page, base, '/index.html');
    const emptyRoot = await readSetup(page);
    if (looksBlank(emptyRoot)) pass('empty-root-blank-team');
    else fail('empty-root-blank-team', JSON.stringify(emptyRoot));

    await openFresh(page, base, '/index.html?source=pwa');
    const emptyPwa = await readSetup(page);
    if (looksBlank(emptyPwa)) pass('empty-source-pwa-blank-team');
    else fail('empty-source-pwa-blank-team', JSON.stringify(emptyPwa));

    await openFresh(page, base, '/index.html?demo=1');
    const demoLaunch = await readSetup(page);
    if (demoLaunch.sm === 'Alex Morgan' && demoLaunch.store === 'Harbor East Demo Store' && demoLaunch.am1 === 'Casey Brooks') {
      pass('explicit-demo-query-loads-sample');
    } else fail('explicit-demo-query-loads-sample', JSON.stringify(demoLaunch));

    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate((payload) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('msb_tour_done', '1');
      localStorage.setItem('msb_welcome_dismissed', '1');
      localStorage.setItem('schedule_manager_names', JSON.stringify(payload.names));
      localStorage.setItem('msb_store_meta', JSON.stringify(payload.meta));
      localStorage.setItem('msb_roster_origin', 'demo');
    }, DEMO_LEFTOVER);
    await page.goto(base + '/index.html?source=pwa', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(500);
    const leftover = await readSetup(page);
    if (looksBlank(leftover)) pass('leftover-demo-not-restored-on-pwa');
    else fail('leftover-demo-not-restored-on-pwa', JSON.stringify(leftover));

    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate((payload) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('msb_tour_done', '1');
      localStorage.setItem('msb_welcome_dismissed', '1');
      localStorage.setItem('schedule_manager_names', JSON.stringify(payload.names));
      localStorage.setItem('msb_store_meta', JSON.stringify(payload.meta));
    }, DEMO_LEFTOVER);
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(500);
    const leftoverNoFlag = await readSetup(page);
    if (looksBlank(leftoverNoFlag)) pass('leftover-demo-fingerprint-without-flag');
    else fail('leftover-demo-fingerprint-without-flag', JSON.stringify(leftoverNoFlag));

    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate((payload) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('msb_tour_done', '1');
      localStorage.setItem('msb_welcome_dismissed', '1');
      localStorage.setItem('schedule_manager_names', JSON.stringify(payload.names));
      localStorage.setItem('msb_store_meta', JSON.stringify(payload.meta));
      localStorage.setItem('msb_roster_origin', 'user');
    }, REAL_ROSTER);
    await page.goto(base + '/index.html?source=pwa', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(400);
    const kept = await readSetup(page);
    if (kept.sm === 'Pat Nguyen' && kept.am1 === 'Chris Ortiz' && kept.store === 'Westfield #12' && kept.num === '412') {
      pass('real-roster-preserved');
    } else fail('real-roster-preserved', JSON.stringify(kept));

    await openFresh(page, base, '/index.html');
    await page.evaluate(() => {
      const c = document.getElementById('welcome-card');
      if (c) c.style.display = '';
    });
    await page.locator('#btn-tour-sample-store').click();
    await page.waitForTimeout(400);
    const tour = await readSetup(page);
    if (tour.sm === 'Alex Morgan' && tour.store === 'Harbor East Demo Store') pass('tour-button-loads-sample');
    else fail('tour-button-loads-sample', JSON.stringify(tour));

    await page.locator('#btn-start-with-team').click();
    await page.waitForTimeout(300);
    const afterStart = await readSetup(page);
    if (looksBlank(afterStart)) pass('start-with-my-team-clears-demo');
    else fail('start-with-my-team-clears-demo', JSON.stringify(afterStart));
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
