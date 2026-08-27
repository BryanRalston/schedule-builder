/**
 * v2.6.12: sample store must never overwrite a saved roster.
 * ?source=pwa does not inject Harbor East. ?demo=1 still loads sample on empty.
 * Run: node tests/test-v2612-demo-roster.mjs
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

const REAL = {
  sm: 'Pat Nguyen',
  am1: 'Chris Ortiz',
  store: 'Riverside #214',
  num: '214',
};

function seedRealRosterScript() {
  return {
    sm: REAL.sm,
    amCount: 2,
    ams: { am1: REAL.am1, am2: 'Jamie Cole' },
    kcList: [{ id: 'kc1', name: 'Morgan Blake', asManager: false, midDows: [1, 3] }],
  };
}

async function seedRealRoster(page) {
  await page.evaluate((roster) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('msb_tour_done', '1');
    localStorage.setItem('msb_welcome_dismissed', '1');
    localStorage.setItem('msb_pro_license', JSON.stringify({ key: 'TEST-PRO-KEY-999', unlockedAt: Date.now() }));
    localStorage.setItem('schedule_manager_names', JSON.stringify(roster));
    localStorage.setItem(
      'msb_store_meta',
      JSON.stringify({ storeName: 'Riverside #214', storeNumber: '214' })
    );
  }, seedRealRosterScript());
}

async function readRoster(page) {
  return page.evaluate(() => {
    let stored = null;
    let meta = null;
    try {
      stored = JSON.parse(localStorage.getItem('schedule_manager_names') || 'null');
    } catch (e) {}
    try {
      meta = JSON.parse(localStorage.getItem('msb_store_meta') || 'null');
    } catch (e2) {}
    return {
      sm: (document.getElementById('name-sm') || {}).value || '',
      am1: (document.getElementById('name-am1') || {}).value || '',
      store: (document.getElementById('store-name') || {}).value || '',
      num: (document.getElementById('store-number') || {}).value || '',
      storedSm: stored && stored.sm,
      storedStore: meta && meta.storeName,
      href: location.href,
      search: location.search,
      hasSaved: typeof hasSavedUserRoster === 'function' ? hasSavedUserRoster() : null,
    };
  });
}

function isHarborEast(r) {
  return /harbor east/i.test(r.store || '') || /alex morgan/i.test(r.sm || '');
}

function isRealRoster(r) {
  return r.sm === REAL.sm && r.store === REAL.store && r.storedSm === REAL.sm && r.storedStore === REAL.store;
}

async function main() {
  console.log('\n=== v2.6.12 demo must not overwrite a saved roster ===');

  const version = JSON.parse(read('version.json'));
  if (version.version === '2.6.12') pass('version.json', version.version);
  else fail('version.json', JSON.stringify(version));

  const index = read('index.html');
  if (/function hasSavedUserRoster\(/.test(index) && /function wantsDemoLaunch\(/.test(index)) {
    pass('guard-fns');
  } else fail('guard-fns', 'missing hasSavedUserRoster / wantsDemoLaunch');

  if (/loadDemoStore\(\{\s*fromUrl:\s*true\s*\}\)/.test(index) && /stripDemoQueryParam/.test(index)) {
    pass('url-demo-fromUrl');
  } else fail('url-demo-fromUrl', 'handleLaunchQuery must call loadDemoStore({fromUrl:true})');

  if (/Never treat \?source=pwa/.test(index) && /return params.get\('demo'\) === '1'/.test(index)) {
    pass('source-pwa-not-demo');
  } else fail('source-pwa-not-demo', 'wantsDemoLaunch must be demo=1 only');

  if (/loadDemoStore\(\{explicit:true\}\)/.test(index) && /loadDemoStore\(\{\s*explicit:\s*true\s*\}\)/.test(index)) {
    pass('explicit-demo-clicks');
  } else fail('explicit-demo-clicks', 'Demo / Tour sample must pass explicit:true');

  if (/if \(!explicit && typeof hasSavedUserRoster/.test(index) && /const fromUrl = opts\.fromUrl === true/.test(index)) {
    pass('loadDemo-refuses-overwrite');
  } else fail('loadDemo-refuses-overwrite', 'loadDemoStore missing roster guard');

  if (/const saved = typeof hasSavedUserRoster/.test(index) && /stripDemoQueryParam/.test(index)) {
    pass('saved-roster-strips-demo-url');
  } else fail('saved-roster-strips-demo-url', 'leftover ?demo=1 must strip without loading sample');

  const { chromium } = { chromium: await loadChromium() };
  const { server, base } = await startStaticServer();
  const browser = await chromium.launch({
    executablePath: existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

    // Empty session + ?source=pwa → blank team, no Harbor East
    await page.goto(base + '/index.html?source=pwa', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const emptyPwa = await readRoster(page);
    if (!isHarborEast(emptyPwa) && !/alex morgan/i.test(emptyPwa.storedSm || '')) {
      pass('empty-source-pwa-no-harbor', emptyPwa.sm || '(blank/placeholder)');
    } else fail('empty-source-pwa-no-harbor', JSON.stringify(emptyPwa));
    const welcome = await page.evaluate(() => {
      const c = document.getElementById('welcome-card');
      const btn = document.getElementById('btn-start-with-team');
      const cs = c ? getComputedStyle(c) : null;
      return {
        welcome: !!(c && cs && cs.display !== 'none' && c.offsetHeight > 2),
        startCta: !!(btn && btn.offsetHeight > 2),
      };
    });
    if (welcome.welcome && welcome.startCta) pass('empty-start-with-my-team');
    else fail('empty-start-with-my-team', JSON.stringify(welcome));

    // Empty session + ?demo=1 → Harbor East sample
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(base + '/index.html?demo=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1400);
    const emptyDemo = await readRoster(page);
    if (/harbor east/i.test(emptyDemo.store) && /alex morgan/i.test(emptyDemo.sm)) {
      pass('empty-demo-1-loads-sample', emptyDemo.store);
    } else fail('empty-demo-1-loads-sample', JSON.stringify(emptyDemo));
    if (!/[?&]demo=1/.test(emptyDemo.search)) pass('demo-1-stripped-after-apply', emptyDemo.search || '(none)');
    else fail('demo-1-stripped-after-apply', emptyDemo.search);

    // Existing roster + ?source=pwa → keep real team
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await seedRealRoster(page);
    await page.goto(base + '/index.html?source=pwa', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(900);
    const keptPwa = await readRoster(page);
    if (isRealRoster(keptPwa) && !isHarborEast(keptPwa)) pass('source-pwa-keeps-roster', keptPwa.store);
    else fail('source-pwa-keeps-roster', JSON.stringify(keptPwa));

    // Existing roster + reload → keep real team
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const keptReload = await readRoster(page);
    if (isRealRoster(keptReload) && !isHarborEast(keptReload)) pass('reload-keeps-roster', keptReload.store);
    else fail('reload-keeps-roster', JSON.stringify(keptReload));

    // Existing roster + leftover ?demo=1 (TWA last-URL) → do NOT overwrite
    await seedRealRoster(page);
    await page.goto(base + '/index.html?demo=1&source=pwa', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(900);
    const keptDemo = await readRoster(page);
    if (isRealRoster(keptDemo) && !isHarborEast(keptDemo)) pass('demo-1-does-not-overwrite', keptDemo.store);
    else fail('demo-1-does-not-overwrite', JSON.stringify(keptDemo));
    if (keptDemo.hasSaved === true) pass('hasSavedUserRoster-true', 'true');
    else fail('hasSavedUserRoster-true', String(keptDemo.hasSaved));
    if (!/[?&]demo=1/.test(keptDemo.search)) pass('leftover-demo-1-stripped', keptDemo.search || '(none)');
    else fail('leftover-demo-1-stripped', keptDemo.search);

    // Unguarded loadDemoStore() (no explicit flag) must still refuse
    const refused = await page.evaluate(() => {
      const ok = loadDemoStore();
      return {
        ok,
        sm: (document.getElementById('name-sm') || {}).value || '',
        store: (document.getElementById('store-name') || {}).value || '',
      };
    });
    if (refused.ok === false && refused.sm === REAL.sm && refused.store === REAL.store) {
      pass('unguarded-loadDemo-refuses', refused.store);
    } else fail('unguarded-loadDemo-refuses', JSON.stringify(refused));

    // Explicit Demo click still loads sample over a roster
    const explicit = await page.evaluate(() => {
      const ok = loadDemoStore({ explicit: true });
      return {
        ok,
        sm: (document.getElementById('name-sm') || {}).value || '',
        store: (document.getElementById('store-name') || {}).value || '',
      };
    });
    if (explicit.ok !== false && /harbor east/i.test(explicit.store) && /alex morgan/i.test(explicit.sm)) {
      pass('explicit-demo-still-loads', explicit.store);
    } else fail('explicit-demo-still-loads', JSON.stringify(explicit));
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
