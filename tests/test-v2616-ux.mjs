/**
 * v2.6.16: first-run is three fields then Build.
 * Keeps 2.6.12 leftover-demo, 2.6.13 role titles, 2.6.14 reopen-on-board,
 * and 2.6.15 backup nudge / clopen marks.
 * Run: node tests/test-v2616-ux.mjs
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

async function hitCloseOnPaintedLabel(page) {
  return page.evaluate(async () => {
    window._msbSuppressCellClick = false;
    const cells = [...document.querySelectorAll('#schedule-grid td.shift-editable')];
    const work = cells.find((c) => {
      const s = schedule[c.getAttribute('data-role')] && schedule[c.getAttribute('data-role')][c.getAttribute('data-dk')];
      return typeof isOpen === 'function' && isOpen(s);
    });
    if (!work) return { error: 'no-open-cell' };
    work.scrollIntoView({ block: 'center' });
    work.click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const menu = document.querySelector('.sched-edit-menu');
    const closeBtn = menu && [...menu.querySelectorAll('button')].find((b) => /^Close$/i.test((b.textContent || '').trim()));
    if (!closeBtn) return { error: 'no-close-btn', portalOpen: !!menu };
    const label = closeBtn.querySelector('.sched-edit-label') || closeBtn;
    const r = label.getBoundingClientRect();
    const x = r.left + Math.min(10, Math.max(3, r.width * 0.2));
    const y = r.top + r.height / 2;
    const el = document.elementFromPoint(x, y);
    const hitBtn = !!(el && (el === closeBtn || (el.closest && el.closest('button') === closeBtn)));
    const role = work.getAttribute('data-role');
    const dk = work.getAttribute('data-dk');
    if (el) {
      el.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true, clientX: x, clientY: y,
      }));
    }
    await new Promise((res) => setTimeout(res, 220));
    return {
      hitBtn,
      hitTag: el ? el.tagName : '',
      stored: schedule[role] && schedule[role][dk],
    };
  });
}

function snapshotSetup(page) {
  return page.evaluate(() => {
    const vis = (el) => {
      if (!el) return false;
      if (el.hidden || el.hasAttribute('hidden')) return false;
      const cs = getComputedStyle(el);
      if (!cs || cs.display === 'none' || cs.visibility === 'hidden') return false;
      return el.getBoundingClientRect().height > 2;
    };
    const tab = document.getElementById('tab-setup');
    const am2 = document.getElementById('name-am2');
    return {
      ease: !!(tab && tab.classList.contains('first-run-ease')),
      title: (document.getElementById('setup-panel-title') || {}).textContent || '',
      sm: vis(document.getElementById('name-sm')),
      smLabel: (document.getElementById('label-role-sm') || {}).textContent || '',
      am1: vis(document.getElementById('name-am1')),
      am2: vis(am2),
      amEaseLabel: vis(document.getElementById('label-role-am-ease')),
      loadNrf: vis(document.getElementById('btn-load-this-nrf')),
      loadText: ((document.getElementById('btn-load-this-nrf') || {}).textContent || '').trim(),
      build: vis(document.getElementById('btn-build-from-setup')),
      more: vis(document.getElementById('btn-more-setup')),
      moreText: ((document.getElementById('btn-more-setup') || {}).textContent || '').trim(),
      requestsTab: vis(document.getElementById('tabbtn-requests')),
      rulesTab: vis(document.getElementById('tabbtn-rules')),
      templates: vis(document.getElementById('team-templates-bar')),
      roleTitles: vis(document.getElementById('role-names-bar')),
      storeHours: vis(document.getElementById('store-hours-block')),
      holidays: vis(document.getElementById('federal-holidays-block')),
      shiftTimes: vis(document.getElementById('shift-times-block')),
      fyPicker: vis(document.getElementById('pick-year')),
      kc: vis(document.getElementById('kc-section')),
      tab: typeof currentAppTab !== 'undefined' ? currentAppTab : '',
      hasPeriod: !!(typeof periodDates !== 'undefined' && periodDates && periodDates.length),
    };
  });
}

async function main() {
  console.log('\n=== v2.6.16 first-run three fields then Build ===');

  const version = JSON.parse(read('version.json'));
  if (version.version === '2.6.16') pass('version.json', version.version);
  else fail('version.json', JSON.stringify(version));

  const sw = read('sw.js');
  if (sw.includes("const CACHE = 'msb-pro-v2.6.16'")) pass('sw-cache');
  else fail('sw-cache', sw.slice(0, 120));

  const index = read('index.html');
  if (index.includes("const APP_VERSION = '2.6.16'") && index.includes('id="app-version-label">v2.6.16')) {
    pass('index-version');
  } else fail('index-version', 'APP_VERSION / label mismatch');

  if (/id="btn-load-this-nrf"/.test(index)
    && /function loadThisNrfPeriod\(/.test(index)
    && /function findNrfPeriodForDate\(/.test(index)
    && /function shouldUseFirstRunEase\(/.test(index)
    && /function toggleMoreSetup\(/.test(index)
    && /id="btn-more-setup"/.test(index)
    && /first-run-ease/.test(index)
    && /id="btn-build-from-setup"[^>]*onclick="buildFromSetup\(\)"/.test(index)) {
    pass('ease-path-fns');
  } else fail('ease-path-fns', 'three-field path markup or helpers missing');

  if (/loadDemoStore\(\{explicit:true\}\)/.test(index)
    && /function hasSavedUserRoster\(/.test(index)
    && /Leftover Harbor East persist is not a real roster/.test(index)
    && /function applyBlankTeam\(/.test(index)) {
    pass('demo-guards-kept');
  } else fail('demo-guards-kept', '2.6.12 leftover-demo guards missing');

  if (/id="role-title-sm"/.test(index)
    && /function getRoleTitle\(/.test(index)
    && /msb_role_titles/.test(index)
    && /placeholder="e.g. your store name"/.test(index)) {
    pass('role-titles-kept');
  } else fail('role-titles-kept', '2.6.13 role titles / placeholders missing');

  if (/function shouldOpenOnSchedule\(/.test(index)
    && /function hasPersistedBuiltSchedule\(/.test(index)
    && /restoreAppTab\(\)/.test(index)) {
    pass('reopen-on-board-kept');
  } else fail('reopen-on-board-kept', '2.6.14 launch-tab helpers missing');

  if (/id="backup-nudge"/.test(index)
    && /function applyClopenMarksOnBoard\(/.test(index)
    && /cell-clopen/.test(index)
    && /function liveExportCell\(/.test(index)
    && /onpointerdown="schedEditStop\(event\); applySchedEdit/.test(index)
    && /\.header-menu-panel \{[\s\S]*?overflow-y: auto/.test(index)) {
    pass('v2615-kept');
  } else fail('v2615-kept', '2.6.15 backup / clopen / export / cell-edit / More scroll missing');

  if (!/TJX|Marshalls|HomeGoods|Winners/i.test(index)) pass('no-employer-names');
  else fail('no-employer-names', 'employer name leaked into copy');

  if (!/idioma|español|spanish|language picker|lang-picker/i.test(index)) {
    pass('no-language-picker');
  } else fail('no-language-picker', 'language picker added');

  if (!/id="tabbtn-rules"/.test(index) || !/id="tabbtn-requests"/.test(index)
    || !/id="shift-times-block"/.test(index) || !/id="team-templates-bar"/.test(index)) {
    fail('extras-not-deleted', 'Requests, Rules, or setup extras were removed');
  } else pass('extras-not-deleted');

  if (/sched-edit-label/.test(index)
    && /\.sched-edit-menu button > \* \{\s*pointer-events: none/.test(index)
    && /Do not subtract/.test(index)
    && /kc-row-placeholder/.test(index)
    && /kcRowsUnlocked/.test(index)) {
    pass('playtest-extras-markup');
  } else fail('playtest-extras-markup', 'label hit-target or KC hide markup missing');

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

    const firstOpen = await snapshotSetup(page);
    if (firstOpen.tab === 'setup' && firstOpen.ease && firstOpen.sm && firstOpen.am1
      && firstOpen.loadNrf && firstOpen.build && firstOpen.more
      && !firstOpen.templates && !firstOpen.roleTitles && !firstOpen.storeHours
      && !firstOpen.holidays && !firstOpen.shiftTimes && !firstOpen.fyPicker
      && !firstOpen.kc && !firstOpen.am2
      && firstOpen.requestsTab && firstOpen.rulesTab
      && /Load this NRF period/.test(firstOpen.loadText)) {
      pass('first-run-three-fields', firstOpen.smLabel);
    } else fail('first-run-three-fields', JSON.stringify(firstOpen));

    await page.locator('#btn-start-with-team').click();
    await page.waitForTimeout(400);
    const started = await snapshotSetup(page);
    if (started.ease && started.sm && started.am1 && started.loadNrf && started.build
      && started.hasPeriod && !started.shiftTimes && started.amEaseLabel
      && started.smLabel === 'Store Manager') {
      pass('start-with-team-ease-path');
    } else fail('start-with-team-ease-path', JSON.stringify(started));

    const unnamed = await page.evaluate(() => {
      document.querySelectorAll('#toast-host .toast').forEach((el) => el.remove());
      buildFromSetup();
      return {
        toast: [...document.querySelectorAll('#toast-host .toast-msg')].map((el) => el.textContent).pop() || '',
        tab: currentAppTab,
      };
    });
    if (/Name your managers/.test(unnamed.toast) && unnamed.tab === 'setup') {
      pass('build-blocks-unnamed');
    } else fail('build-blocks-unnamed', JSON.stringify(unnamed));

    await page.evaluate(() => {
      const sm = document.getElementById('name-sm');
      const am1 = document.getElementById('name-am1');
      if (sm) sm.value = 'Pat Nguyen';
      if (am1) am1.value = 'Chris Ortiz';
      persistManagerNames();
    });
    await page.locator('#btn-load-this-nrf').click();
    await page.waitForTimeout(300);
    const loaded = await page.evaluate(() => ({
      hasPeriod: !!(periodDates && periodDates.length && currentPeriod),
      status: ((document.getElementById('ease-period-status') || {}).textContent || '').trim(),
      pressed: (document.getElementById('btn-load-this-nrf') || {}).getAttribute('aria-pressed'),
    }));
    if (loaded.hasPeriod && loaded.status === 'Loaded' && loaded.pressed === 'true') {
      pass('load-this-nrf-marks-loaded');
    } else fail('load-this-nrf-marks-loaded', JSON.stringify(loaded));

    await page.locator('#btn-build-from-setup').click();
    await page.waitForTimeout(1800);
    const built = await page.evaluate(() => ({
      tab: typeof currentAppTab !== 'undefined' ? currentAppTab : '',
      named: typeof managersAreNamed === 'function' ? managersAreNamed() : false,
      cells: document.querySelectorAll('#schedule-grid td.shift-editable').length,
      toast: [...document.querySelectorAll('#toast-host .toast-msg')].map((el) => el.textContent).pop() || '',
    }));
    if (built.tab === 'schedule' && built.named && built.cells > 20 && /Schedule ready/.test(built.toast)) {
      pass('build-after-two-names-and-period', built.cells + ' cells');
    } else fail('build-after-two-names-and-period', JSON.stringify(built));

    const phoneClose = await hitCloseOnPaintedLabel(page);
    if (!phoneClose.error && phoneClose.hitBtn && phoneClose.stored === 'close') {
      pass('phone-close-label-applies');
    } else fail('phone-close-label-applies', JSON.stringify(phoneClose));

    const desk = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await desk.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await desk.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('msb_tour_done', '1');
      localStorage.setItem('msb_welcome_dismissed', '1');
    });
    await desk.reload({ waitUntil: 'domcontentloaded' });
    await desk.waitForTimeout(500);
    await desk.evaluate(() => {
      const sm = document.getElementById('name-sm');
      const am1 = document.getElementById('name-am1');
      if (sm) sm.value = 'Pat Nguyen';
      if (am1) am1.value = 'Chris Ortiz';
      persistManagerNames();
      if (typeof loadThisNrfPeriod === 'function') loadThisNrfPeriod({ quiet: true });
      buildFromSetup();
    });
    await desk.waitForTimeout(1800);
    const deskClose = await hitCloseOnPaintedLabel(desk);
    if (!deskClose.error && deskClose.hitBtn && deskClose.stored === 'close') {
      pass('desktop-close-label-applies');
    } else fail('desktop-close-label-applies', JSON.stringify(deskClose));
    await desk.close();

    const fresh = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await fresh.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await fresh.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await fresh.reload({ waitUntil: 'domcontentloaded' });
    await fresh.waitForTimeout(600);
    await fresh.locator('#btn-start-with-team').click();
    await fresh.waitForTimeout(300);
    await fresh.locator('#btn-more-setup').click();
    await fresh.waitForTimeout(200);
    const moreOpen = await snapshotSetup(fresh);
    if (!moreOpen.ease && moreOpen.shiftTimes && moreOpen.templates && moreOpen.roleTitles
      && moreOpen.storeHours && moreOpen.holidays && moreOpen.fyPicker && moreOpen.kc
      && moreOpen.moreText === 'Hide extra setup') {
      pass('more-setup-one-tap-shift-times');
    } else fail('more-setup-one-tap-shift-times', JSON.stringify(moreOpen));

    const kcHidden = await fresh.evaluate(() => {
      const vis = (el) => {
        if (!el) return false;
        if (el.hidden || el.hasAttribute('hidden')) return false;
        const cs = getComputedStyle(el);
        if (!cs || cs.display === 'none' || cs.visibility === 'hidden') return false;
        return el.getBoundingClientRect().height > 2;
      };
      const input = document.getElementById('name-kc1');
      const row = input && input.closest('.manager-row');
      return {
        inputInDom: !!input,
        rowHidden: !vis(row),
        placeholderClass: !!(row && row.classList.contains('kc-row-placeholder')),
        named: typeof isNamedKeyCarrier === 'function' && kcList[0] ? isNamedKeyCarrier(kcList[0]) : null,
      };
    });
    if (kcHidden.inputInDom && kcHidden.rowHidden && kcHidden.placeholderClass && kcHidden.named === false) {
      pass('unnamed-kc-hidden-on-setup');
    } else fail('unnamed-kc-hidden-on-setup', JSON.stringify(kcHidden));

    await fresh.locator('#btn-add-kc').click();
    await fresh.waitForTimeout(150);
    const kcRevealed = await fresh.evaluate(() => {
      const vis = (el) => {
        if (!el) return false;
        const cs = getComputedStyle(el);
        if (!cs || cs.display === 'none') return false;
        return el.getBoundingClientRect().height > 2;
      };
      const input = document.getElementById('name-kc1');
      const row = input && input.closest('.manager-row');
      return { visible: vis(row), focused: document.activeElement && document.activeElement.id };
    });
    if (kcRevealed.visible) pass('add-kc-reveals-row', kcRevealed.focused);
    else fail('add-kc-reveals-row', JSON.stringify(kcRevealed));

    await fresh.locator('#tabbtn-rules').click();
    await fresh.waitForTimeout(200);
    const rules = await fresh.evaluate(() => ({
      tab: typeof currentAppTab !== 'undefined' ? currentAppTab : '',
      rulesActive: !!(document.getElementById('tab-rules') || {}).classList?.contains('active'),
      requestsBtn: !!(document.getElementById('tabbtn-requests')),
    }));
    if (rules.tab === 'rules' && rules.rulesActive && rules.requestsBtn) {
      pass('rules-one-tap');
    } else fail('rules-one-tap', JSON.stringify(rules));
    await fresh.locator('#tabbtn-requests').click();
    await fresh.waitForTimeout(150);
    const req = await fresh.evaluate(() => ({
      tab: typeof currentAppTab !== 'undefined' ? currentAppTab : '',
      active: !!(document.getElementById('tab-requests') || {}).classList?.contains('active'),
    }));
    if (req.tab === 'requests' && req.active) pass('requests-one-tap');
    else fail('requests-one-tap', JSON.stringify(req));
    await fresh.close();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    const returning = await page.evaluate(() => ({
      tab: typeof currentAppTab !== 'undefined' ? currentAppTab : '',
      scheduleActive: !!(document.getElementById('tab-schedule') || {}).classList?.contains('active'),
      should: typeof shouldOpenOnSchedule === 'function' ? shouldOpenOnSchedule() : null,
      hasRoster: typeof hasSavedUserRoster === 'function' ? hasSavedUserRoster() : null,
    }));
    if (returning.tab === 'schedule' && returning.scheduleActive && returning.should && returning.hasRoster) {
      pass('returning-built-opens-schedule');
    } else fail('returning-built-opens-schedule', JSON.stringify(returning));

    await page.evaluate(() => { if (typeof switchTab === 'function') switchTab('setup'); });
    await page.waitForTimeout(200);
    const returningSetup = await snapshotSetup(page);
    if (!returningSetup.ease && returningSetup.shiftTimes && returningSetup.templates
      && returningSetup.roleTitles && returningSetup.storeHours && !returningSetup.more) {
      pass('returning-setup-is-full');
    } else fail('returning-setup-is-full', JSON.stringify(returningSetup));

    const leftoverPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await leftoverPage.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await leftoverPage.evaluate((payload) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('msb_tour_done', '1');
      localStorage.setItem('msb_welcome_dismissed', '1');
      localStorage.setItem('msb_active_tab', 'schedule');
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
    await leftoverPage.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await leftoverPage.waitForTimeout(800);
    const leftover = await leftoverPage.evaluate(() => ({
      tab: typeof currentAppTab !== 'undefined' ? currentAppTab : '',
      setupActive: !!(document.getElementById('tab-setup') || {}).classList?.contains('active'),
      store: (document.getElementById('store-name') || {}).value || '',
      sm: (document.getElementById('name-sm') || {}).value || '',
      hasRoster: typeof hasSavedUserRoster === 'function' ? hasSavedUserRoster() : null,
      should: typeof shouldOpenOnSchedule === 'function' ? shouldOpenOnSchedule() : null,
      ease: !!(document.getElementById('tab-setup') || {}).classList?.contains('first-run-ease'),
    }));
    if (leftover.tab === 'setup' && leftover.setupActive && leftover.hasRoster === false
      && leftover.should === false && leftover.ease
      && !/harbor east/i.test(leftover.store) && !/alex morgan/i.test(leftover.sm)) {
      pass('leftover-demo-stays-setup-ease');
    } else fail('leftover-demo-stays-setup-ease', JSON.stringify(leftover));
    await leftoverPage.close();
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
