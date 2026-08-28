/**
 * v2.6.17: on-device request phrase bar on Requests.
 * Types floor phrases against a named roster and paints the same locks
 * as the existing request calendar. Bad input does not invent a person.
 * Keeps 2.6.12–2.6.18 behavior; version lock follows 2.6.24.
 * Run: node tests/test-v2617-ux.mjs
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

const ROSTER = {
  sm: 'Pat Nguyen',
  amCount: 2,
  ams: { am1: 'Casey Brooks', am2: 'Sam Rivera' },
  kcList: [{ id: 'kc1', name: 'Jordan Lee', asManager: false, midDows: [1, 3] }],
};

async function seedNamedRoster(page) {
  await page.evaluate((roster) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('msb_tour_done', '1');
    localStorage.setItem('msb_welcome_dismissed', '1');
    localStorage.setItem('msb_pro_license', JSON.stringify({ key: 'TEST-PRO-KEY-999', unlockedAt: Date.now() }));
    localStorage.setItem('schedule_manager_names', JSON.stringify(roster));
    localStorage.setItem('msb_store_meta', JSON.stringify({ storeName: 'Riverside', storeNumber: '214' }));
    if (typeof restoreManagerNames === 'function') restoreManagerNames();
    if (typeof restoreStoreMeta === 'function') restoreStoreMeta();
    if (typeof dismissWelcome === 'function') dismissWelcome();
    const welcome = document.getElementById('welcome-card');
    if (welcome) {
      welcome.style.display = 'none';
      welcome.setAttribute('hidden', '');
    }
    if (typeof buildPeriodDropdown === 'function') buildPeriodDropdown();
    if (typeof loadThisNrfPeriod === 'function' && (!periodDates || !periodDates.length)) {
      loadThisNrfPeriod({ quiet: true });
    }
    if (typeof loadPeriod === 'function' && (!periodDates || !periodDates.length)) loadPeriod();
    if (typeof switchTab === 'function') switchTab('requests');
  }, ROSTER);
}

async function main() {
  console.log('\n=== v2.6.17 on-device request phrase bar ===');

  const version = JSON.parse(read('version.json'));
  if (version.version === '2.6.24') pass('version.json', version.version);
  else fail('version.json', JSON.stringify(version));

  const sw = read('sw.js');
  if (sw.includes("const CACHE = 'msb-pro-v2.6.24'")) pass('sw-cache');
  else fail('sw-cache', sw.slice(0, 120));

  const index = read('index.html');
  if (index.includes("const APP_VERSION = '2.6.24'") && index.includes('id="app-version-label">v2.6.24')) {
    pass('index-version');
  } else fail('index-version', 'APP_VERSION / label mismatch');

  if (/id="request-phrase-bar"/.test(index)
    && /id="request-phrase-input"/.test(index)
    && /id="setup-request-phrase-bar"/.test(index)
    && /setup-more-item/.test(index)
    && /function parseRequestPhrase\(/.test(index)
    && /function applyRequestPhraseFromBar\(/.test(index)
    && /function undoRequestPhraseApply\(/.test(index)
    && /id="btn-undo-request-phrase"/.test(index)
    && /Casey off Thu–Fri/.test(index)
    && /Runs on this device/.test(index)) {
    pass('phrase-bar-markup');
  } else fail('phrase-bar-markup', 'request phrase bar or local parser missing');

  if (/id="request-paint-toolbar"/.test(index)
    && /function setRequestPaintMode\(/.test(index)
    && /function paintRequestCell\(/.test(index)
    && /function openCellMenu\(/.test(index)) {
    pass('paint-fallback-kept');
  } else fail('paint-fallback-kept', 'paint / cell menu path missing');

  const phraseChunk = (index.match(/v2\.6\.17 — on-device request phrase bar[\s\S]*?function requestPaintModeLabel/) || [''])[0];
  if (phraseChunk
    && !/\bfetch\s*\(/.test(phraseChunk)
    && !/XMLHttpRequest/.test(phraseChunk)
    && !/openai|anthropic|translate\.googleapis|cloud.?translate/i.test(phraseChunk)) {
    pass('parser-stays-on-device');
  } else fail('parser-stays-on-device', 'parser talks to a network or invented AI backend');

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
    && /id="btn-load-this-nrf"/.test(index)
    && /function toggleMoreSetup\(/.test(index)
    && /kc-row-placeholder/.test(index)) {
    pass('v2615-v2616-kept');
  } else fail('v2615-v2616-kept', '2.6.15/2.6.16 markers missing');

  if (!/TJX|Marshalls|HomeGoods|Winners/i.test(index)) pass('no-employer-names');
  else fail('no-employer-names', 'employer name leaked into copy');

  if (!/idioma|español|spanish|language picker|lang-picker/i.test(index)) {
    pass('no-language-picker');
  } else fail('no-language-picker', 'language picker added');

  const chromium = await loadChromium();
  const { server, base } = await startStaticServer();
  const browser = await chromium.launch({
    executablePath: existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await seedNamedRoster(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    await seedNamedRoster(page);
    await page.waitForTimeout(400);

    const ready = await page.evaluate(() => {
      const bar = document.getElementById('request-phrase-bar');
      const paint = document.getElementById('request-paint-toolbar');
      const names = typeof getManagerNames === 'function' ? getManagerNames() : {};
      return {
        tab: typeof currentAppTab !== 'undefined' ? currentAppTab : '',
        hasPeriod: !!(typeof periodDates !== 'undefined' && periodDates && periodDates.length),
        bar: !!(bar && bar.getBoundingClientRect().height > 2),
        paint: !!(paint && paint.getBoundingClientRect().height > 2),
        casey: names.am1 || '',
        sam: names.am2 || '',
        ids: typeof getAllPersonIds === 'function' ? getAllPersonIds() : [],
      };
    });
    if (ready.tab === 'requests' && ready.hasPeriod && ready.bar && ready.paint
      && /Casey/i.test(ready.casey) && /Sam/i.test(ready.sam)) {
      pass('requests-bar-ready', ready.casey + ' / ' + ready.sam);
    } else fail('requests-bar-ready', JSON.stringify(ready));

    await page.fill('#request-phrase-input', 'Casey off Thu–Fri');
    await page.click('#btn-apply-request-phrase');
    await page.waitForTimeout(250);

    const casey = await page.evaluate(() => {
      const locks = inputs.am1 || {};
      const dks = Object.keys(locks);
      const byDow = {};
      dks.forEach((dk) => {
        const d = new Date(dk + 'T12:00:00');
        byDow[d.getDay()] = locks[dk];
      });
      const tags = [...document.querySelectorAll('#input-calendars .cal-cell .cell-tag')]
        .map((el) => (el.textContent || '').trim());
      const confirm = ((document.getElementById('request-phrase-confirm-text') || {}).textContent || '').trim();
      const confirmBox = document.getElementById('request-phrase-confirm');
      const undo = document.getElementById('btn-undo-request-phrase');
      return {
        role: typeof activeTab !== 'undefined' ? activeTab : '',
        count: dks.length,
        byDow,
        allOff: dks.every((dk) => locks[dk] === 'off'),
        thuFriOnly: dks.every((dk) => {
          const dow = new Date(dk + 'T12:00:00').getDay();
          return dow === 4 || dow === 5;
        }),
        confirm,
        confirmVisible: !!(confirmBox && !confirmBox.hidden),
        undoVisible: !!(undo && !undo.hidden),
        tagged: tags.some((t) => /off/i.test(t)),
        personIds: typeof getAllPersonIds === 'function' ? getAllPersonIds().slice() : [],
      };
    });
    if (casey.role === 'am1' && casey.count >= 2 && casey.allOff && casey.thuFriOnly
      && casey.byDow[4] === 'off' && casey.byDow[5] === 'off'
      && casey.confirmVisible && casey.undoVisible && /Casey/i.test(casey.confirm)
      && casey.tagged) {
      pass('casey-off-thu-fri', casey.confirm);
    } else fail('casey-off-thu-fri', JSON.stringify(casey));

    const beforeSamIds = casey.personIds;
    await page.fill('#request-phrase-input', 'Sam no close Saturday');
    await page.click('#btn-apply-request-phrase');
    await page.waitForTimeout(250);

    const sam = await page.evaluate(() => {
      const locks = inputs.am2 || {};
      const dks = Object.keys(locks);
      const sats = dks.filter((dk) => new Date(dk + 'T12:00:00').getDay() === 6);
      const confirm = ((document.getElementById('request-phrase-confirm-text') || {}).textContent || '').trim();
      return {
        role: typeof activeTab !== 'undefined' ? activeTab : '',
        count: dks.length,
        sats: sats.length,
        satLock: sats.length ? locks[sats[0]] : '',
        allSatOff: sats.length > 0 && sats.every((dk) => locks[dk] === 'off'),
        onlySat: dks.every((dk) => new Date(dk + 'T12:00:00').getDay() === 6),
        caseyStill: Object.keys(inputs.am1 || {}).length,
        confirm,
        personIds: typeof getAllPersonIds === 'function' ? getAllPersonIds().slice() : [],
      };
    });
    if (sam.role === 'am2' && sam.sats >= 1 && sam.allSatOff && sam.onlySat
      && sam.satLock === 'off' && sam.caseyStill >= 2 && /Sam/i.test(sam.confirm)) {
      pass('sam-no-close-saturday', sam.confirm);
    } else fail('sam-no-close-saturday', JSON.stringify(sam));

    await page.click('#btn-undo-request-phrase');
    await page.waitForTimeout(200);
    const undid = await page.evaluate(() => {
      const confirm = ((document.getElementById('request-phrase-confirm-text') || {}).textContent || '').trim();
      return {
        confirm,
        casey: Object.keys(inputs.am1 || {}).length,
        sam: Object.keys(inputs.am2 || {}).length,
      };
    });
    if (/Undid/i.test(undid.confirm) && undid.casey >= 2 && undid.sam === 0) {
      pass('undo-last-apply', undid.confirm);
    } else fail('undo-last-apply', JSON.stringify(undid));

    const snapshotBeforeBad = await page.evaluate(() => JSON.parse(JSON.stringify({
      inputs,
      ids: typeof getAllPersonIds === 'function' ? getAllPersonIds().slice() : [],
      names: typeof getManagerNames === 'function' ? getManagerNames() : {},
    })));

    await page.fill('#request-phrase-input', 'Riley off Friday');
    await page.click('#btn-apply-request-phrase');
    await page.waitForTimeout(200);

    const badName = await page.evaluate((before) => {
      const confirm = ((document.getElementById('request-phrase-confirm-text') || {}).textContent || '').trim();
      const confirmBox = document.getElementById('request-phrase-confirm');
      const undo = document.getElementById('btn-undo-request-phrase');
      const ids = typeof getAllPersonIds === 'function' ? getAllPersonIds().slice() : [];
      const names = typeof getManagerNames === 'function' ? getManagerNames() : {};
      const inventedId = ids.some((id) => !before.ids.includes(id));
      const inventedName = Object.values(names).some((n) => /Riley/i.test(String(n || '')));
      const newLockOwner = Object.keys(inputs || {}).some((role) => {
        const now = inputs[role] || {};
        const was = (before.inputs && before.inputs[role]) || {};
        return Object.keys(now).some((dk) => was[dk] !== now[dk]);
      });
      return {
        confirm,
        isError: !!(confirmBox && confirmBox.classList.contains('is-error')),
        undoHidden: !!(undo && undo.hidden),
        inventedId,
        inventedName,
        newLockOwner,
        ids,
      };
    }, snapshotBeforeBad);
    if (badName.isError && /Riley/i.test(badName.confirm) && !badName.inventedId
      && !badName.inventedName && !badName.newLockOwner) {
      pass('bad-name-does-not-invent', badName.confirm);
    } else fail('bad-name-does-not-invent', JSON.stringify(badName));

    await page.fill('#request-phrase-input', 'asdf qwerty');
    await page.click('#btn-apply-request-phrase');
    await page.waitForTimeout(200);

    const junk = await page.evaluate((before) => {
      const confirm = ((document.getElementById('request-phrase-confirm-text') || {}).textContent || '').trim();
      const paint = document.getElementById('request-paint-toolbar');
      const sameCasey = JSON.stringify(inputs.am1 || {}) === JSON.stringify((before.inputs && before.inputs.am1) || {});
      const sameSam = JSON.stringify(inputs.am2 || {}) === JSON.stringify((before.inputs && before.inputs.am2) || {});
      return {
        confirm,
        paint: !!(paint && paint.getBoundingClientRect().height > 2),
        sameCasey,
        sameSam,
      };
    }, snapshotBeforeBad);
    if (/Couldn’t read|Couldn.t read|paint/i.test(junk.confirm) && junk.paint && junk.sameCasey && junk.sameSam) {
      pass('junk-leaves-paint-path', junk.confirm);
    } else fail('junk-leaves-paint-path', JSON.stringify(junk));

    const parsed = await page.evaluate(() => {
      const a = parseRequestPhrase('Casey off Thu–Fri');
      const b = parseRequestPhrase('Sam no close Saturday');
      const c = parseRequestPhrase('Riley off Friday');
      const d = parseRequestPhrase('Sam prefer close Saturday');
      return { a, b, c, d };
    });
    if (parsed.a.ok && parsed.a.role === 'am1' && parsed.a.lock === 'off'
      && parsed.b.ok && parsed.b.role === 'am2' && parsed.b.lock === 'off'
      && !parsed.c.ok && parsed.c.reason === 'unknown-person'
      && parsed.d.ok && parsed.d.lock === 'close') {
      pass('parser-direct', parsed.a.confirm);
    } else fail('parser-direct', JSON.stringify({
      a: { ok: parsed.a.ok, role: parsed.a.role, lock: parsed.a.lock, reason: parsed.a.reason },
      b: { ok: parsed.b.ok, role: parsed.b.role, lock: parsed.b.lock, reason: parsed.b.reason },
      c: { ok: parsed.c.ok, reason: parsed.c.reason },
      d: { ok: parsed.d.ok, lock: parsed.d.lock, reason: parsed.d.reason },
    }));

    if (beforeSamIds && sam.personIds && beforeSamIds.join(',') === sam.personIds.join(',')) {
      pass('roster-ids-unchanged');
    } else fail('roster-ids-unchanged', JSON.stringify({ beforeSamIds, after: sam.personIds }));
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
