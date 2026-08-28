/**
 * v2.6.12: sample store must never overwrite a saved roster.
 * Leftover Harbor East persist is not a real roster — / and ?source=pwa go blank.
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

async function clearSession(page) {
  await page.evaluate(() => {
    const sm = document.getElementById('name-sm');
    if (sm) sm.value = 'Store Manager';
    const store = document.getElementById('store-name');
    if (store) store.value = '';
    const num = document.getElementById('store-number');
    if (num) num.value = '';
    if (typeof amCount !== 'undefined') {
      /* keep current AM/KC rows but blank real names */
    }
    document.querySelectorAll('input[id^="name-am"], input[id^="name-kc"]').forEach((el) => {
      if (/^name-am\d+$/.test(el.id)) el.value = el.id.replace('name-', '').toUpperCase();
      if (/^name-kc/.test(el.id)) el.value = 'Key Carrier 1';
    });
    localStorage.clear();
    sessionStorage.clear();
  });
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
    // Apply to the live form so pagehide persist cannot write a stale demo over the seed.
    if (typeof restoreManagerNames === 'function') restoreManagerNames();
    if (typeof restoreStoreMeta === 'function') restoreStoreMeta();
  }, seedRealRosterScript());
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

async function seedLeftoverDemo(page) {
  await page.evaluate((payload) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('msb_tour_done', '1');
    localStorage.setItem('msb_welcome_dismissed', '1');
    localStorage.setItem('schedule_manager_names', JSON.stringify(payload.names));
    localStorage.setItem('msb_store_meta', JSON.stringify(payload.meta));
    const n = payload.names;
    amCount = n.amCount;
    kcList = (n.kcList || []).map((kc) => ({
      id: kc.id,
      name: kc.name,
      asManager: !!kc.asManager,
      midDows: kc.midDows || [],
    }));
    if (typeof renderAMRows === 'function') renderAMRows();
    if (typeof renderKCRows === 'function') renderKCRows();
    const sm = document.getElementById('name-sm');
    if (sm) sm.value = n.sm;
    Object.keys(n.ams || {}).forEach((id) => {
      const el = document.getElementById('name-' + id);
      if (el) el.value = n.ams[id];
    });
    (n.kcList || []).forEach((kc) => {
      const el = document.getElementById('name-' + kc.id);
      if (el) el.value = kc.name;
    });
    const store = document.getElementById('store-name');
    const num = document.getElementById('store-number');
    if (store) store.value = payload.meta.storeName;
    if (num) num.value = payload.meta.storeNumber;
  }, DEMO_LEFTOVER);
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
  if (version.version === '2.6.15') pass('version.json', version.version);
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

  if (/function confirmReplaceRosterWithDemo\(/.test(index) && /window\.confirm\(/.test(index)) {
    pass('confirm-before-overwrite');
  } else fail('confirm-before-overwrite', 'missing confirmReplaceRosterWithDemo');

  if (/id="store-name"[^>]*oninput="persistStoreMeta\(\)"/.test(index) && /id="name-sm"[^>]*oninput="persistManagerNames\(\)"/.test(index)) {
    pass('persist-on-input');
  } else fail('persist-on-input', 'store/SM must persist on input, not only blur');

  if (/const fromUrl = opts\.fromUrl === true/.test(index) && /opts\.confirmed === true/.test(index) && /if \(hasRoster\)/.test(index)) {
    pass('loadDemo-refuses-overwrite');
  } else fail('loadDemo-refuses-overwrite', 'loadDemoStore missing roster confirm guard');

  if (/function applyBlankTeam\(/.test(index) && /function storedNamesLookLikeDemo\(/.test(index) && /Leftover Harbor East persist/.test(index)) {
    pass('leftover-demo-clear-fns');
  } else fail('leftover-demo-clear-fns', 'missing applyBlankTeam / leftover-demo restore skip');

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
    await clearSession(page);
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

    // Leftover Harbor East persist (Bryan's phone after Demo overwrite) → blank on ?source=pwa
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await seedLeftoverDemo(page);
    await page.goto(base + '/index.html?source=pwa', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(700);
    const leftoverPwa = await readRoster(page);
    if (!isHarborEast(leftoverPwa) && !/alex morgan/i.test(leftoverPwa.storedSm || '')) {
      pass('leftover-demo-cleared-on-pwa', leftoverPwa.sm || '(blank)');
    } else fail('leftover-demo-cleared-on-pwa', JSON.stringify(leftoverPwa));

    // Same leftover persist on / must also go blank (not treat demo as his roster)
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await seedLeftoverDemo(page);
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(700);
    const leftoverRoot = await readRoster(page);
    if (!isHarborEast(leftoverRoot) && !/alex morgan/i.test(leftoverRoot.storedSm || '')) {
      pass('leftover-demo-cleared-on-root', leftoverRoot.sm || '(blank)');
    } else fail('leftover-demo-cleared-on-root', JSON.stringify(leftoverRoot));

    // Empty session + ?demo=1 → Harbor East sample
    await clearSession(page);
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

    // More → Demo / explicit click: Cancel keeps roster (no persist of Harbor East)
    page.once('dialog', (d) => d.dismiss());
    const denied = await page.evaluate(() => {
      const ok = loadDemoStore({ explicit: true });
      return {
        ok,
        sm: (document.getElementById('name-sm') || {}).value || '',
        store: (document.getElementById('store-name') || {}).value || '',
        storedSm: JSON.parse(localStorage.getItem('schedule_manager_names') || 'null')?.sm,
        storedStore: JSON.parse(localStorage.getItem('msb_store_meta') || 'null')?.storeName,
      };
    });
    if (denied.ok === false && denied.sm === REAL.sm && denied.store === REAL.store && denied.storedSm === REAL.sm) {
      pass('explicit-demo-cancel-keeps-roster', denied.store);
    } else fail('explicit-demo-cancel-keeps-roster', JSON.stringify(denied));

    // Explicit Demo + Confirm still loads sample
    page.once('dialog', (d) => d.accept());
    const accepted = await page.evaluate(() => {
      const ok = loadDemoStore({ explicit: true });
      return {
        ok,
        sm: (document.getElementById('name-sm') || {}).value || '',
        store: (document.getElementById('store-name') || {}).value || '',
      };
    });
    if (accepted.ok !== false && /harbor east/i.test(accepted.store) && /alex morgan/i.test(accepted.sm)) {
      pass('explicit-demo-confirm-loads', accepted.store);
    } else fail('explicit-demo-confirm-loads', JSON.stringify(accepted));

    // Typed SM without blur: persist on input; More → Demo cancel keeps "Bryan Test"
    await clearSession(page);
    await page.evaluate(() => {
      localStorage.setItem('msb_tour_done', '1');
      localStorage.setItem('msb_welcome_dismissed', '1');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      if (typeof dismissWelcome === 'function') dismissWelcome();
      const sm = document.getElementById('name-sm');
      sm.focus();
      sm.value = '';
      sm.dispatchEvent(new Event('input', { bubbles: true }));
      sm.value = 'Bryan Test';
      sm.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const typed = await page.evaluate(() => {
      const stored = JSON.parse(localStorage.getItem('schedule_manager_names') || 'null');
      return { live: (document.getElementById('name-sm') || {}).value, storedSm: stored && stored.sm };
    });
    if (typed.live === 'Bryan Test' && typed.storedSm === 'Bryan Test') {
      pass('typed-sm-persists-on-input', typed.storedSm);
    } else fail('typed-sm-persists-on-input', JSON.stringify(typed));

    page.once('dialog', (d) => d.dismiss());
    const typedKeep = await page.evaluate(() => {
      document.getElementById('header-menu-demo')?.click();
      return {
        sm: (document.getElementById('name-sm') || {}).value || '',
        storedSm: JSON.parse(localStorage.getItem('schedule_manager_names') || 'null')?.sm,
        store: (document.getElementById('store-name') || {}).value || '',
      };
    });
    if (typedKeep.sm === 'Bryan Test' && typedKeep.storedSm === 'Bryan Test' && !/harbor east/i.test(typedKeep.store)) {
      pass('header-demo-cancel-keeps-typed-sm', typedKeep.sm);
    } else fail('header-demo-cancel-keeps-typed-sm', JSON.stringify(typedKeep));

    // Store name persists on input (no blur)
    const storeIn = await page.evaluate(() => {
      const el = document.getElementById('store-name');
      el.value = 'Riverside #214';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      const meta = JSON.parse(localStorage.getItem('msb_store_meta') || 'null');
      return { stored: meta && meta.storeName };
    });
    if (storeIn.stored === 'Riverside #214') pass('store-name-persists-on-input', storeIn.stored);
    else fail('store-name-persists-on-input', JSON.stringify(storeIn));

    // Empty session + explicit Demo: no confirm, sample loads
    await clearSession(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    let emptyDialog = false;
    page.once('dialog', (d) => {
      emptyDialog = true;
      d.dismiss();
    });
    const emptyExplicit = await page.evaluate(() => {
      const ok = loadDemoStore({ explicit: true });
      return { ok, sm: (document.getElementById('name-sm') || {}).value || '', store: (document.getElementById('store-name') || {}).value || '' };
    });
    if (!emptyDialog && /harbor east/i.test(emptyExplicit.store) && /alex morgan/i.test(emptyExplicit.sm)) {
      pass('empty-explicit-demo-no-confirm', emptyExplicit.store);
    } else fail('empty-explicit-demo-no-confirm', JSON.stringify({ emptyDialog, ...emptyExplicit }));
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
