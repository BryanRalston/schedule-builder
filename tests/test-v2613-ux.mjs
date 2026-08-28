/**
 * v2.6.13: More menu order, generic store placeholders, editable role titles.
 * Sample path stays; leftover-demo detector is unchanged.
 * Version lock follows current ship (2.6.30).
 * Run: node tests/test-v2613-ux.mjs
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

function menuButtonOrder(html) {
  const panel = html.match(/id="header-menu-panel"[^>]*>([\s\S]*?)<\/div>/);
  if (!panel) return [];
  return [...panel[1].matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, '').trim()
  );
}

async function main() {
  console.log('\n=== v2.6.17 menu, placeholders, role titles ===');

  const version = JSON.parse(read('version.json'));
  if (version.version === '2.6.30') pass('version.json', version.version);
  else fail('version.json', JSON.stringify(version));

  const sw = read('sw.js');
  if (sw.includes("const CACHE = 'msb-pro-v2.6.30'")) pass('sw-cache');
  else fail('sw-cache', sw.slice(0, 120));

  const index = read('index.html');
  if (index.includes("const APP_VERSION = '2.6.30'") && index.includes('id="app-version-label">v2.6.30')) {
    pass('index-version');
  } else fail('index-version', 'APP_VERSION / label mismatch');

  const more = menuButtonOrder(index);
  const saveIdx = more.indexOf('Save');
  const loadIdx = more.indexOf('Load');
  const sampleIdx = more.findIndex((t) => /load sample store/i.test(t));
  const demoIdx = more.findIndex((t) => t === 'Demo');
  if (saveIdx === 0 && loadIdx === 1 && sampleIdx > loadIdx && demoIdx < 0) {
    pass('menu-order-static', more.slice(0, 4).join(' → '));
  } else fail('menu-order-static', JSON.stringify(more.slice(0, 6)));

  if (/id="header-menu-demo"[^>]*>Load sample store</.test(index)
    && /loadDemoStore\(\{explicit:true\}\)/.test(index)
    && /function confirmReplaceRosterWithDemo\(/.test(index)
    && /function hasSavedUserRoster\(/.test(index)) {
    pass('sample-keeps-overwrite-guard');
  } else fail('sample-keeps-overwrite-guard', 'menu sample or guard missing');

  if (/id="store-name"[^>]*placeholder="e.g. your store name"/.test(index)
    && /id="store-number"[^>]*placeholder="e.g. 100"/.test(index)
    && !/placeholder="e.g. Harbor East #851"/.test(index)
    && !/placeholder="e.g. 851"/.test(index)) {
    pass('placeholders-not-harbor');
  } else fail('placeholders-not-harbor', 'store placeholders still look like Harbor East / 851');

  if (/const DEMO_STORE_NAME = 'Harbor East Demo Store'/.test(index)
    && /function isDemoStoreName\(/.test(index)
    && /\/harbor east\/i/.test(index)) {
    pass('demo-fingerprint-unchanged');
  } else fail('demo-fingerprint-unchanged', 'isDemoStoreName / Harbor East sample changed');

  if (/id="role-names-bar"/.test(index)
    && /id="role-title-sm"/.test(index)
    && /id="role-title-am"/.test(index)
    && /id="role-title-kc"/.test(index)
    && /function getRoleTitle\(/.test(index)
    && /msb_role_titles/.test(index)) {
    pass('role-title-fns');
  } else fail('role-title-fns', 'role title control / persist missing');

  if (/Load sample store/.test(index) && /Take tour/.test(index)
    && !/Tour sample store/.test(index)
    && !/>Try Demo</.test(index) && !/>Demo</.test(index)) {
    pass('no-leading-demo-label');
  } else fail('no-leading-demo-label', 'sample/tour labels should be Load sample store + Take tour');

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

    const liveMenu = await page.evaluate(() => {
      const moreBtns = [...document.querySelectorAll('#header-menu-panel button')].map((b) => (b.textContent || '').trim());
      const store = document.getElementById('store-name');
      const num = document.getElementById('store-number');
      return {
        more: moreBtns,
        storePh: store ? store.getAttribute('placeholder') : '',
        numPh: num ? num.getAttribute('placeholder') : '',
        smTitle: (document.getElementById('role-title-sm') || {}).value || '',
        amTitle: (document.getElementById('role-title-am') || {}).value || '',
        kcTitle: (document.getElementById('role-title-kc') || {}).value || '',
        smLabel: (document.getElementById('label-role-sm') || {}).textContent || '',
        amLabel: (document.getElementById('label-role-am') || {}).textContent || '',
        kcLabel: (document.getElementById('label-role-kc') || {}).textContent || '',
        smPh: (document.getElementById('name-sm') || {}).placeholder || '',
      };
    });
    if (liveMenu.more[0] === 'Save' && liveMenu.more[1] === 'Load' && liveMenu.more[2] === 'Load sample store') {
      pass('live-menu-order', liveMenu.more.slice(0, 3).join(' → '));
    } else fail('live-menu-order', JSON.stringify(liveMenu.more.slice(0, 6)));
    if (liveMenu.storePh === 'e.g. your store name' && liveMenu.numPh === 'e.g. 100'
      && !/harbor east/i.test(liveMenu.storePh) && liveMenu.numPh !== 'e.g. 851') {
      pass('live-placeholders', liveMenu.storePh + ' / ' + liveMenu.numPh);
    } else fail('live-placeholders', JSON.stringify({ store: liveMenu.storePh, num: liveMenu.numPh }));
    if (liveMenu.smTitle === 'Store Manager' && liveMenu.amTitle === 'Assistant Manager'
      && liveMenu.kcTitle === 'Key Carrier' && liveMenu.smLabel === 'Store Manager'
      && liveMenu.amLabel === 'Assistant Managers' && liveMenu.kcLabel === 'Key Carriers'
      && liveMenu.smPh === 'Store Manager name') {
      pass('live-default-role-titles');
    } else fail('live-default-role-titles', JSON.stringify(liveMenu));

    await page.evaluate(() => {
      if (typeof dismissWelcome === 'function') dismissWelcome();
      const sm = document.getElementById('role-title-sm');
      const am = document.getElementById('role-title-am');
      const kc = document.getElementById('role-title-kc');
      sm.value = 'General Manager';
      sm.dispatchEvent(new Event('input', { bubbles: true }));
      sm.dispatchEvent(new Event('change', { bubbles: true }));
      sm.dispatchEvent(new Event('blur', { bubbles: true }));
      am.value = 'Assistant Store Manager';
      am.dispatchEvent(new Event('input', { bubbles: true }));
      am.dispatchEvent(new Event('change', { bubbles: true }));
      am.dispatchEvent(new Event('blur', { bubbles: true }));
      kc.value = 'Key Holder';
      kc.dispatchEvent(new Event('input', { bubbles: true }));
      kc.dispatchEvent(new Event('change', { bubbles: true }));
      kc.dispatchEvent(new Event('blur', { bubbles: true }));
    });
    const afterEdit = await page.evaluate(() => {
      let stored = null;
      try { stored = JSON.parse(localStorage.getItem('msb_role_titles') || 'null'); } catch (e) {}
      return {
        stored,
        smLabel: (document.getElementById('label-role-sm') || {}).textContent || '',
        amLabel: (document.getElementById('label-role-am') || {}).textContent || '',
        kcLabel: (document.getElementById('label-role-kc') || {}).textContent || '',
        smPh: (document.getElementById('name-sm') || {}).placeholder || '',
        amPh: (document.getElementById('name-am1') || {}).placeholder || '',
        kcPh: (document.getElementById('name-kc1') || {}).placeholder || '',
        titleFn: typeof getRoleTitle === 'function' ? {
          sm: getRoleTitle('sm'), am: getRoleTitle('am'), kc: getRoleTitle('kc')
        } : null,
        placeholderGm: typeof isPlaceholderManagerName === 'function' && isPlaceholderManagerName('General Manager'),
        placeholderKh: typeof isPlaceholderManagerName === 'function' && isPlaceholderManagerName('Key Holder 1'),
        hasSaved: typeof hasSavedUserRoster === 'function' ? hasSavedUserRoster() : null,
      };
    });
    if (afterEdit.stored && afterEdit.stored.sm === 'General Manager'
      && afterEdit.stored.am === 'Assistant Store Manager'
      && afterEdit.stored.kc === 'Key Holder'
      && afterEdit.smLabel === 'General Manager'
      && afterEdit.amLabel === 'Assistant Store Managers'
      && afterEdit.kcLabel === 'Key Holders'
      && afterEdit.smPh === 'General Manager name'
      && afterEdit.titleFn && afterEdit.titleFn.kc === 'Key Holder'
      && afterEdit.placeholderGm && afterEdit.placeholderKh
      && afterEdit.hasSaved === false) {
      pass('role-titles-persist-live', afterEdit.stored.sm);
    } else fail('role-titles-persist-live', JSON.stringify(afterEdit));

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    const afterReload = await page.evaluate(() => {
      let stored = null;
      try { stored = JSON.parse(localStorage.getItem('msb_role_titles') || 'null'); } catch (e) {}
      return {
        stored,
        smIn: (document.getElementById('role-title-sm') || {}).value || '',
        amIn: (document.getElementById('role-title-am') || {}).value || '',
        kcIn: (document.getElementById('role-title-kc') || {}).value || '',
        smLabel: (document.getElementById('label-role-sm') || {}).textContent || '',
        kcLabel: (document.getElementById('label-role-kc') || {}).textContent || '',
        smPh: (document.getElementById('name-sm') || {}).placeholder || '',
        titleFn: typeof getRoleTitle === 'function' ? getRoleTitle('sm') : null,
        hasSaved: typeof hasSavedUserRoster === 'function' ? hasSavedUserRoster() : null,
        looksDemo: typeof liveRosterLooksLikeDemo === 'function' ? liveRosterLooksLikeDemo() : null,
      };
    });
    if (afterReload.smIn === 'General Manager' && afterReload.amIn === 'Assistant Store Manager'
      && afterReload.kcIn === 'Key Holder' && afterReload.smLabel === 'General Manager'
      && afterReload.kcLabel === 'Key Holders' && afterReload.smPh === 'General Manager name'
      && afterReload.titleFn === 'General Manager' && afterReload.hasSaved === false
      && afterReload.looksDemo === false) {
      pass('role-titles-survive-reload');
    } else fail('role-titles-survive-reload', JSON.stringify(afterReload));

    const fallback = await page.evaluate(() => {
      const sm = document.getElementById('role-title-sm');
      sm.value = '   ';
      sm.dispatchEvent(new Event('input', { bubbles: true }));
      sm.dispatchEvent(new Event('blur', { bubbles: true }));
      return {
        title: typeof getRoleTitle === 'function' ? getRoleTitle('sm') : null,
        label: (document.getElementById('label-role-sm') || {}).textContent || '',
        ph: (document.getElementById('name-sm') || {}).placeholder || '',
        stored: JSON.parse(localStorage.getItem('msb_role_titles') || 'null'),
      };
    });
    if (fallback.title === 'Store Manager' && fallback.label === 'Store Manager'
      && fallback.ph === 'Store Manager name' && fallback.stored && fallback.stored.sm === '') {
      pass('empty-role-title-falls-back');
    } else fail('empty-role-title-falls-back', JSON.stringify(fallback));

    // Restore custom titles, name two people, generate a period
    const built = await page.evaluate(() => {
      const smT = document.getElementById('role-title-sm');
      smT.value = 'General Manager';
      smT.dispatchEvent(new Event('input', { bubbles: true }));
      smT.dispatchEvent(new Event('blur', { bubbles: true }));
      const sm = document.getElementById('name-sm');
      const am1 = document.getElementById('name-am1');
      if (sm) sm.value = 'Pat Nguyen';
      if (am1) am1.value = 'Chris Ortiz';
      persistManagerNames();
      if (typeof loadPeriod === 'function') loadPeriod();
      document.querySelectorAll('#toast-host .toast').forEach((el) => el.remove());
      if (typeof generateSchedule === 'function') generateSchedule();
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            cells: document.querySelectorAll('#schedule-grid td.shift-editable').length,
            toast: [...document.querySelectorAll('#toast-host .toast-msg')].map((el) => el.textContent).pop() || '',
            title: typeof getRoleTitle === 'function' ? getRoleTitle('sm') : '',
            sm: (document.getElementById('name-sm') || {}).value || '',
          });
        }, 1800);
      });
    });
    if (built.cells > 20 && /Schedule ready/.test(built.toast) && built.title === 'General Manager' && built.sm === 'Pat Nguyen') {
      pass('generate-with-custom-titles', built.cells + ' cells');
    } else fail('generate-with-custom-titles', JSON.stringify(built));

    // Custom role titles must not be treated as a leftover demo roster.
    // Apply to the live form too so pagehide persist cannot write Pat Nguyen over the seed.
    await page.evaluate(() => {
      const titles = {
        sm: 'General Manager',
        am: 'Assistant Store Manager',
        kc: 'Key Holder'
      };
      const names = {
        sm: 'Alex Morgan',
        amCount: 3,
        ams: { am1: 'Casey Brooks', am2: 'Riley Quinn', am3: 'Taylor Hayes' },
        kcList: [{ id: 'kc1', name: 'Jordan Lee', asManager: false, midDows: [] }]
      };
      const meta = { storeName: 'Harbor East Demo Store', storeNumber: '851' };
      const keep = {
        msb_tour_done: localStorage.getItem('msb_tour_done'),
        msb_welcome_dismissed: localStorage.getItem('msb_welcome_dismissed'),
        msb_pro_license: localStorage.getItem('msb_pro_license')
      };
      localStorage.clear();
      sessionStorage.clear();
      Object.keys(keep).forEach((k) => {
        if (keep[k]) localStorage.setItem(k, keep[k]);
      });
      localStorage.setItem('msb_role_titles', JSON.stringify(titles));
      localStorage.setItem('schedule_manager_names', JSON.stringify(names));
      localStorage.setItem('msb_store_meta', JSON.stringify(meta));
      roleTitles = titles;
      if (typeof applyRoleTitleUI === 'function') applyRoleTitleUI();
      amCount = names.amCount;
      kcList = names.kcList.map((kc) => ({
        id: kc.id, name: kc.name, asManager: !!kc.asManager, midDows: kc.midDows || []
      }));
      if (typeof renderAMRows === 'function') renderAMRows();
      if (typeof renderKCRows === 'function') renderKCRows();
      const sm = document.getElementById('name-sm');
      if (sm) sm.value = names.sm;
      Object.keys(names.ams).forEach((id) => {
        const el = document.getElementById('name-' + id);
        if (el) el.value = names.ams[id];
      });
      const store = document.getElementById('store-name');
      const num = document.getElementById('store-number');
      if (store) store.value = meta.storeName;
      if (num) num.value = meta.storeNumber;
    });
    await page.goto(base + '/index.html?source=pwa', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(800);
    const leftoverState = await page.evaluate(() => {
      let titles = null;
      try { titles = JSON.parse(localStorage.getItem('msb_role_titles') || 'null'); } catch (e) {}
      return {
        titles,
        sm: (document.getElementById('name-sm') || {}).value || '',
        store: (document.getElementById('store-name') || {}).value || '',
        smTitle: (document.getElementById('role-title-sm') || {}).value || '',
        kcTitle: (document.getElementById('role-title-kc') || {}).value || '',
        hasSaved: typeof hasSavedUserRoster === 'function' ? hasSavedUserRoster() : null,
        looksDemo: typeof liveRosterLooksLikeDemo === 'function' ? liveRosterLooksLikeDemo() : null,
      };
    });
    if (!/harbor east/i.test(leftoverState.store) && !/alex morgan/i.test(leftoverState.sm)
      && leftoverState.smTitle === 'General Manager' && leftoverState.kcTitle === 'Key Holder'
      && leftoverState.hasSaved === false) {
      pass('custom-titles-not-demo-roster', leftoverState.smTitle);
    } else fail('custom-titles-not-demo-roster', JSON.stringify(leftoverState));
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
