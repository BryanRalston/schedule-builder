/**
 * v2.6.14: first-minute door, reopen on the board, store identity.
 * Run: node tests/test-v2614-ux.mjs
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
  store: 'Riverside',
  num: '214',
};

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

async function seedRealRoster(page) {
  await page.evaluate((roster) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('msb_tour_done', '1');
    localStorage.setItem('msb_welcome_dismissed', '1');
    localStorage.setItem('msb_pro_license', JSON.stringify({ key: 'TEST-PRO-KEY-999', unlockedAt: Date.now() }));
    localStorage.setItem('schedule_manager_names', JSON.stringify({
      sm: roster.sm,
      amCount: 2,
      ams: { am1: roster.am1, am2: 'Jamie Cole' },
      kcList: [{ id: 'kc1', name: 'Morgan Blake', asManager: false, midDows: [1, 3] }],
    }));
    localStorage.setItem(
      'msb_store_meta',
      JSON.stringify({ storeName: roster.store, storeNumber: roster.num })
    );
    if (typeof restoreManagerNames === 'function') restoreManagerNames();
    if (typeof restoreStoreMeta === 'function') restoreStoreMeta();
  }, REAL);
}

async function main() {
  console.log('\n=== v2.6.14 first-minute identity ===');

  const version = JSON.parse(read('version.json'));
  if (version.version === '2.6.14') pass('version.json', version.version);
  else fail('version.json', JSON.stringify(version));

  const sw = read('sw.js');
  if (sw.includes("const CACHE = 'msb-pro-v2.6.14'")) pass('sw-cache');
  else fail('sw-cache', sw.slice(0, 120));

  const index = read('index.html');
  if (index.includes("const APP_VERSION = '2.6.14'") && index.includes('id="app-version-label">v2.6.14')) {
    pass('index-version');
  } else fail('index-version', 'APP_VERSION / label mismatch');

  if (/id="btn-start-with-team"[^>]*class="btn-demo welcome-primary"[^>]*onclick="startWithMyTeam\(\)"/.test(index)
    && /id="btn-tour-sample"[^>]*class="btn-outline welcome-secondary-btn"[^>]*onclick="loadDemoStore\(\{explicit:true\}\)"/.test(index)
    && /welcome-secondary-btn/.test(index)
    && /Take tour/.test(index)
    && !/<button class="btn-primary" onclick="loadDemoStore/.test(index)
    && (index.match(/id="welcome-card"[\s\S]*?id="welcome-play"/) || [''])[0].split('btn-demo').length === 2) {
    pass('welcome-one-primary-door');
  } else fail('welcome-one-primary-door', 'Start is not the only welcome primary');

  if (/function shouldOpenOnSchedule\(/.test(index)
    && /function hasPersistedBuiltSchedule\(/.test(index)
    && /function getStoreIdentity\(/.test(index)
    && /function restoreAppTab\(/.test(index)
    && /restoreAppTab\(\)/.test(index)
    && /params\.get\('tab'\)/.test(index)) {
    pass('launch-tab-fns');
  } else fail('launch-tab-fns', 'missing launch-tab helpers or boot call');

  if (/id="ap-store"/.test(index)
    && /Roster and schedules stay on this device/.test(index)
    && /function formatSignInRow\(/.test(index)
    && /never seed it from Google/.test(index)
    && !/Workspace session on this device/.test(index)) {
    pass('account-store-identity-markup');
  } else fail('account-store-identity-markup', 'Account still leads with workspace/Google');

  if (/loadDemoStore\(\{explicit:true\}\)/.test(index)
    && /function hasSavedUserRoster\(/.test(index)
    && /Leftover Harbor East persist is not a real roster/.test(index)
    && /function applyBlankTeam\(/.test(index)) {
    pass('demo-guards-kept');
  } else fail('demo-guards-kept', '2.6.12 leftover-demo guards missing');

  if (/id="role-title-sm"/.test(index)
    && /function getRoleTitle\(/.test(index)
    && /msb_role_titles/.test(index)
    && /id="header-menu-panel"/.test(index)
    && /placeholder="e.g. your store name"/.test(index)) {
    pass('role-titles-kept');
  } else fail('role-titles-kept', '2.6.13 role titles / placeholders missing');

  if (!/TJX|Marshalls|HomeGoods|Winners/i.test(index)) pass('no-employer-names');
  else fail('no-employer-names', 'employer name leaked into copy');

  const chromium = await loadChromium();
  const { server, base } = await startStaticServer();
  const browser = await chromium.launch({
    executablePath: existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);

    const firstOpen = await page.evaluate(() => {
      const welcome = document.getElementById('welcome-card');
      const start = document.getElementById('btn-start-with-team');
      const sample = document.getElementById('btn-tour-sample');
      const cs = welcome ? getComputedStyle(welcome) : null;
      const startCs = start ? getComputedStyle(start) : null;
      const sampleCs = sample ? getComputedStyle(sample) : null;
      const startFs = startCs ? parseFloat(startCs.fontSize) : 0;
      const sampleFs = sampleCs ? parseFloat(sampleCs.fontSize) : 0;
      return {
        welcome: !!(welcome && cs && cs.display !== 'none' && welcome.offsetHeight > 2),
        tab: typeof currentAppTab !== 'undefined' ? currentAppTab : '',
        startH: start ? start.offsetHeight : 0,
        sampleH: sample ? sample.offsetHeight : 0,
        startFs,
        sampleFs,
        startPrimary: !!(start && start.classList.contains('welcome-primary')),
        sampleSecondary: !!(sample && sample.classList.contains('welcome-secondary-btn')),
        sampleOnclick: sample ? sample.getAttribute('onclick') : '',
        setupActive: !!(document.getElementById('tab-setup') || {}).classList?.contains('active'),
      };
    });
    if (firstOpen.welcome && firstOpen.tab === 'setup' && firstOpen.setupActive) {
      pass('first-run-lands-setup');
    } else fail('first-run-lands-setup', JSON.stringify(firstOpen));
    if (firstOpen.startPrimary && firstOpen.sampleSecondary
      && firstOpen.startH > firstOpen.sampleH
      && firstOpen.startFs > firstOpen.sampleFs
      && /loadDemoStore\(\{explicit:true\}\)/.test(firstOpen.sampleOnclick)) {
      pass('welcome-primary-vs-sample', firstOpen.startH + '>' + firstOpen.sampleH);
    } else fail('welcome-primary-vs-sample', JSON.stringify(firstOpen));

    await seedRealRoster(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    const returning = await page.evaluate(() => {
      const welcome = document.getElementById('welcome-card');
      const cs = welcome ? getComputedStyle(welcome) : null;
      return {
        tab: typeof currentAppTab !== 'undefined' ? currentAppTab : '',
        scheduleActive: !!(document.getElementById('tab-schedule') || {}).classList?.contains('active'),
        welcomeHidden: !welcome || !cs || cs.display === 'none' || welcome.offsetHeight < 2,
        store: (document.getElementById('store-name') || {}).value || '',
        should: typeof shouldOpenOnSchedule === 'function' ? shouldOpenOnSchedule() : null,
        hasRoster: typeof hasSavedUserRoster === 'function' ? hasSavedUserRoster() : null,
      };
    });
    if (returning.tab === 'schedule' && returning.scheduleActive && returning.should && returning.hasRoster) {
      pass('returning-roster-opens-schedule', returning.store);
    } else fail('returning-roster-opens-schedule', JSON.stringify(returning));

    await page.evaluate((payload) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('msb_tour_done', '1');
      localStorage.setItem('msb_welcome_dismissed', '1');
      localStorage.setItem('msb_active_tab', 'schedule');
      localStorage.setItem('schedule_manager_names', JSON.stringify(payload.names));
      localStorage.setItem('msb_store_meta', JSON.stringify(payload.meta));
    }, DEMO_LEFTOVER);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    const leftover = await page.evaluate(() => ({
      tab: typeof currentAppTab !== 'undefined' ? currentAppTab : '',
      setupActive: !!(document.getElementById('tab-setup') || {}).classList?.contains('active'),
      store: (document.getElementById('store-name') || {}).value || '',
      sm: (document.getElementById('name-sm') || {}).value || '',
      hasRoster: typeof hasSavedUserRoster === 'function' ? hasSavedUserRoster() : null,
      should: typeof shouldOpenOnSchedule === 'function' ? shouldOpenOnSchedule() : null,
    }));
    if (leftover.tab === 'setup' && leftover.setupActive && leftover.hasRoster === false
      && leftover.should === false && !/harbor east/i.test(leftover.store) && !/alex morgan/i.test(leftover.sm)) {
      pass('leftover-demo-stays-setup');
    } else fail('leftover-demo-stays-setup', JSON.stringify(leftover));

    await seedRealRoster(page);
    await page.evaluate(() => {
      const session = {
        id: 'sess-test',
        method: 'google',
        email: 'alex.work@example.com',
        name: 'Alex Work',
        orgName: 'Work Google Org',
        role: 'admin',
        signedInAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        authVersion: 2,
        emailVerified: true,
        plan: 'free',
        providerSub: 'google-sub-test',
      };
      localStorage.setItem('msb_session', JSON.stringify(session));
      if (typeof restoreManagerNames === 'function') restoreManagerNames();
      if (typeof restoreStoreMeta === 'function') restoreStoreMeta();
      if (typeof updateAccountChip === 'function') updateAccountChip();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      if (typeof updateAccountChip === 'function') updateAccountChip();
    });
    const identity = await page.evaluate(() => {
      if (typeof openAccountPanel === 'function') openAccountPanel();
      const modal = document.getElementById('account-modal');
      const title = (document.getElementById('account-panel-title') || {}).textContent || '';
      const store = (document.getElementById('ap-store') || {}).textContent || '';
      const method = (document.getElementById('ap-method') || {}).textContent || '';
      const chip = (document.getElementById('account-chip-name') || {}).textContent || '';
      const id = typeof getStoreIdentity === 'function' ? getStoreIdentity() : null;
      const visibleRows = [...document.querySelectorAll('#account-modal .ap-row')].map((row) => ({
        label: (row.querySelector('span:first-child') || {}).textContent || '',
        value: (row.querySelector('span:last-child') || {}).textContent || '',
      }));
      return {
        title,
        store,
        method,
        chip,
        id,
        modalOpen: !!(modal && !modal.hasAttribute('hidden')),
        visibleRows,
        wipeLabel: ((document.querySelector('.ap-signout-opts') || {}).innerText || ''),
      };
    });
    const googleAsOwner = /Alex Work|Work Google Org/i.test(identity.title + identity.store + identity.chip);
    if (identity.modalOpen && /Riverside/.test(identity.title) && /214/.test(identity.store)
      && /Riverside/.test(identity.chip) && !googleAsOwner
      && /Google/i.test(identity.method) && /alex\.work@example\.com/i.test(identity.method)) {
      pass('account-leads-with-store', identity.title);
    } else fail('account-leads-with-store', JSON.stringify(identity));
    if (identity.visibleRows.some((r) => /Store/i.test(r.label))
      && !identity.visibleRows.some((r) => /Organization|Name|Email/i.test(r.label) && /Alex Work|Work Google/i.test(r.value))) {
      pass('account-google-is-signin-row');
    } else fail('account-google-is-signin-row', JSON.stringify(identity.visibleRows));
    if (/clear schedules/i.test(identity.wipeLabel) && /signing out/i.test(identity.wipeLabel)) {
      pass('signout-clear-stays-optional');
    } else fail('signout-clear-stays-optional', identity.wipeLabel);

    await page.evaluate(() => {
      const sn = document.getElementById('store-name');
      const num = document.getElementById('store-number');
      if (sn) sn.value = '';
      if (num) num.value = '';
      localStorage.setItem('msb_store_meta', JSON.stringify({ storeName: '', storeNumber: '' }));
      if (typeof updateAccountChip === 'function') updateAccountChip();
      if (typeof openAccountPanel === 'function') openAccountPanel();
    });
    const unnamed = await page.evaluate(() => ({
      title: (document.getElementById('account-panel-title') || {}).textContent || '',
      store: (document.getElementById('ap-store') || {}).textContent || '',
      chip: (document.getElementById('account-chip-name') || {}).textContent || '',
    }));
    if (unnamed.title === 'This device' && unnamed.store === 'This device' && unnamed.chip === 'This device') {
      pass('unnamed-store-this-device');
    } else fail('unnamed-store-this-device', JSON.stringify(unnamed));

    await page.evaluate(() => {
      const sm = document.getElementById('name-sm');
      if (sm) sm.value = '';
      document.querySelectorAll('input[id^="name-am"], input[id^="name-kc"]').forEach((el) => { el.value = ''; });
      localStorage.removeItem('schedule_manager_names');
      localStorage.removeItem('msb_store_meta');
      localStorage.removeItem('msb_welcome_dismissed');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    const emptyAgain = await page.evaluate(() => ({
      tab: typeof currentAppTab !== 'undefined' ? currentAppTab : '',
      welcome: (() => {
        const c = document.getElementById('welcome-card');
        const cs = c ? getComputedStyle(c) : null;
        return !!(c && cs && cs.display !== 'none' && c.offsetHeight > 2);
      })(),
    }));
    if (emptyAgain.tab === 'setup' && emptyAgain.welcome) pass('empty-after-clear-setup');
    else fail('empty-after-clear-setup', JSON.stringify(emptyAgain));
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
