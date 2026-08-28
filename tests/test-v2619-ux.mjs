/**
 * v2.6.19: Ask-bar trailing date parse, Rebuild hit area above the
 * sticky review bar, Word/Excel Pro modal Not now on pointerdown,
 * and drop the 404 Play badge image.
 * Keeps 2.6.12–2.6.18 behavior; version lock follows 2.6.21.
 * Run: node tests/test-v2619-ux.mjs
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
  ams: { am1: 'Alex Chen', am2: 'Sam Rivera' },
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
    periodDates = [];
    for (let d = 2; d <= 15; d++) {
      periodDates.push(new Date(2026, 7, d, 12, 0, 0));
    }
    currentPeriod = { number: 6, approxMonth: 'August', start: periodDates[0], end: periodDates[periodDates.length - 1] };
    if (typeof switchTab === 'function') switchTab('requests');
  }, ROSTER);
}

function assertRebuildHit(hit, name) {
  if (hit.hitBtn && hit.stripVisible && /Rebuild/i.test(hit.btnText) && hit.pillShown) {
    pass(name, hit.btnText + ' z=' + hit.z);
  } else {
    fail(name, JSON.stringify(hit));
  }
}

async function main() {
  console.log('\n=== v2.6.19 ask-bar date, rebuild hit, pro dismiss ===');

  const version = JSON.parse(read('version.json'));
  if (version.version === '2.6.21') pass('version.json', version.version);
  else fail('version.json', JSON.stringify(version));

  const sw = read('sw.js');
  if (sw.includes("const CACHE = 'msb-pro-v2.6.21'")) pass('sw-cache');
  else fail('sw-cache', sw.slice(0, 120));

  const index = read('index.html');
  if (index.includes("const APP_VERSION = '2.6.21'") && index.includes('id="app-version-label">v2.6.21')) {
    pass('index-version');
  } else fail('index-version', 'APP_VERSION / label mismatch');

  if (/function peelTrailingSingleDate\(/.test(index)
    && /function dateKeysForCalendarDate\(/.test(index)
    && /Couldn.t read the date/.test(index)
    && /8\/6, 8-6, Aug 6, August 6/.test(index)
    && /Alex off Thu 8\/6/.test(index)) {
    pass('date-peel-fns');
  } else fail('date-peel-fns', 'trailing-date peel helpers or copy missing');

  if (/body\.msb-board-live \.container/.test(index)
    && /z-index: auto/.test(index)
    && /#tab-schedule\.board-live #generate-section/.test(index)
    && /z-index: 97/.test(index)
    && /id="built-rebuild-row"/.test(index)
    && /function syncStickyOffsets\(/.test(index)
    && /function dockBuiltRebuildRow\(/.test(index)
    && /#built-rebuild-row\.is-docked/.test(index)
    && /--msb-sticky-top/.test(index)
    && /--msb-pgs-h/.test(index)
    && /scroll-margin-top: 8\.5rem/.test(index)) {
    pass('rebuild-hit-css');
  } else fail('rebuild-hit-css', 'rebuild z-index / hit-area CSS missing');

  if (/id="btn-pro-gate-not-now"/.test(index)
    && /onpointerdown="event\.preventDefault\(\); event\.stopPropagation\(\); closeProGate\(\);"/.test(index)
    && /id="btn-pro-gate-license"/.test(index)
    && /onpointerdown="if \(event\.target === this\) \{ event\.preventDefault\(\); event\.stopPropagation\(\); closeProGate\(\); \}"/.test(index)) {
    pass('pro-not-now-pointerdown');
  } else fail('pro-not-now-pointerdown', 'Pro Not now still click-only');

  if (!/en_badge_web_generic\.png/.test(index)
    && /id="welcome-play-link"[^>]*>Get it on Google Play</.test(index)
    && /Get it on Google Play/.test(index)) {
    pass('play-badge-no-404');
  } else fail('play-badge-no-404', 'broken Play badge image still referenced');

  const buy = read('buy.html');
  if (!/en_badge_web_generic\.png/.test(buy) && /Get it on Google Play/.test(buy)) {
    pass('buy-play-badge-no-404');
  } else fail('buy-play-badge-no-404', 'buy.html still 404s the Play badge');

  if (/loadDemoStore\(\{explicit:true\}\)/.test(index)
    && /function hasSavedUserRoster\(/.test(index)
    && /Leftover Harbor East persist is not a real roster/.test(index)
    && /function applyBlankTeam\(/.test(index)
    && /id="role-title-sm"/.test(index)
    && /function shouldOpenOnSchedule\(/.test(index)
    && /id="backup-nudge"/.test(index)
    && /function parseRequestPhrase\(/.test(index)
    && /function jumpToReviewChip\(/.test(index)
    && /function isNamedAssistant\(/.test(index)
    && /Rebuild to apply/.test(index)) {
    pass('v2612-v2618-kept');
  } else fail('v2612-v2618-kept', '2.6.12–2.6.18 markers missing');

  if (!/TJX|Marshalls|HomeGoods|Winners/i.test(index)) pass('no-employer-names');
  else fail('no-employer-names', 'employer name leaked into copy');

  if (!/idioma|español|spanish|language picker|lang-picker/i.test(index)) {
    pass('no-language-picker');
  } else fail('no-language-picker', 'language picker added');

  const phraseChunk = (index.match(/v2\.6\.17 — on-device request phrase bar[\s\S]*?function requestPaintModeLabel/) || [''])[0];
  if (phraseChunk
    && !/\bfetch\s*\(/.test(phraseChunk)
    && !/XMLHttpRequest/.test(phraseChunk)
    && !/openai|anthropic|copilot|cloud.?roster|translate\.googleapis/i.test(phraseChunk)) {
    pass('parser-stays-on-device');
  } else fail('parser-stays-on-device', 'parser talks to a network or invented AI backend');

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
    await page.waitForTimeout(300);

    const parsed = await page.evaluate(() => {
      const people = rosterPeopleForPhrase();
      const dates = periodDates.slice();
      const thu86 = parseRequestPhrase('Alex off Thu 8/6', { people: people, dates: dates });
      const thuDash = parseRequestPhrase('Alex off Thu 8-6', { people: people, dates: dates });
      const aug6 = parseRequestPhrase('Alex off Aug 6', { people: people, dates: dates });
      const august6 = parseRequestPhrase('Alex off August 6', { people: people, dates: dates });
      const thuOnly = parseRequestPhrase('Alex off Thu', { people: people, dates: dates });
      const dateOnly = parseRequestPhrase('Alex off 8/6', { people: people, dates: dates });
      const badDate = parseRequestPhrase('Alex off Thu 8/99', { people: people, dates: dates });
      const junkDate = parseRequestPhrase('Alex off Thu 99/6', { people: people, dates: dates });
      const unknown = parseRequestPhrase('Riley off Friday', { people: people, dates: dates });
      const alexRange = parseRequestPhrase('Alex off Thu–Fri', { people: people, dates: dates });
      return { thu86, thuDash, aug6, august6, thuOnly, dateOnly, badDate, junkDate, unknown, alexRange, ids: getAllPersonIds() };
    });

    const expectOne = (label, p) => p.ok && p.role === 'am1' && p.lock === 'off' && p.dateKeys && p.dateKeys.length === 1 && p.dateKeys[0] === '2026-08-06';
    if (expectOne('thu86', parsed.thu86) && !/No one named/i.test(parsed.thu86.confirm || '')) {
      pass('parse-alex-off-thu-8-6', parsed.thu86.confirm);
    } else fail('parse-alex-off-thu-8-6', JSON.stringify(parsed.thu86));

    if (expectOne('dash', parsed.thuDash) && expectOne('aug', parsed.aug6) && expectOne('august', parsed.august6) && expectOne('dateOnly', parsed.dateOnly)) {
      pass('parse-date-aliases', [parsed.thuDash.dayLabel, parsed.aug6.dayLabel, parsed.august6.dayLabel].join(' | '));
    } else fail('parse-date-aliases', JSON.stringify({
      thuDash: parsed.thuDash, aug6: parsed.aug6, august6: parsed.august6, dateOnly: parsed.dateOnly,
    }));

    if (parsed.thuOnly.ok && parsed.thuOnly.role === 'am1' && parsed.thuOnly.dateKeys
      && parsed.thuOnly.dateKeys.length >= 2
      && parsed.thuOnly.dateKeys.includes('2026-08-06')
      && parsed.thuOnly.dateKeys.includes('2026-08-13')
      && parsed.thuOnly.dateKeys.every((dk) => new Date(dk + 'T12:00:00').getDay() === 4)) {
      pass('parse-alex-off-thu-all-thursdays', parsed.thuOnly.dateKeys.join(','));
    } else fail('parse-alex-off-thu-all-thursdays', JSON.stringify(parsed.thuOnly));

    if (!parsed.badDate.ok && parsed.badDate.reason === 'bad-date'
      && /read the date/i.test(parsed.badDate.message)
      && !/No one named/i.test(parsed.badDate.message)
      && !parsed.junkDate.ok && parsed.junkDate.reason === 'bad-date') {
      pass('unread-date-does-not-invent-person', parsed.badDate.message);
    } else fail('unread-date-does-not-invent-person', JSON.stringify({ badDate: parsed.badDate, junkDate: parsed.junkDate }));

    if (!parsed.unknown.ok && parsed.unknown.reason === 'unknown-person' && /Riley/i.test(parsed.unknown.message)) {
      pass('unknown-person-still-refused');
    } else fail('unknown-person-still-refused', JSON.stringify(parsed.unknown));

    if (parsed.alexRange.ok && parsed.alexRange.role === 'am1' && parsed.alexRange.lock === 'off'
      && parsed.alexRange.dateKeys && parsed.alexRange.dateKeys.length >= 4
      && parsed.alexRange.dateKeys.every((dk) => {
        const dow = new Date(dk + 'T12:00:00').getDay();
        return dow === 4 || dow === 5;
      })) {
      pass('weekday-range-still-works', parsed.alexRange.confirm);
    } else fail('weekday-range-still-works', JSON.stringify(parsed.alexRange));

    await page.fill('#request-phrase-input', 'Alex off Thu 8/6');
    await page.click('#btn-apply-request-phrase');
    await page.waitForTimeout(250);

    const painted = await page.evaluate(() => {
      const locks = inputs.am1 || {};
      const dks = Object.keys(locks);
      const confirm = ((document.getElementById('request-phrase-confirm-text') || {}).textContent || '').trim();
      return {
        dks,
        lock: locks['2026-08-06'],
        onlyThat: dks.length === 1 && dks[0] === '2026-08-06' && locks['2026-08-06'] === 'off',
        confirm,
        invented: /No one named/i.test(confirm),
        ids: typeof getAllPersonIds === 'function' ? getAllPersonIds().slice() : [],
      };
    });
    if (painted.onlyThat && !painted.invented && /Alex/i.test(painted.confirm)) {
      pass('apply-alex-off-thu-8-6', painted.confirm);
    } else fail('apply-alex-off-thu-8-6', JSON.stringify(painted));

    await page.click('#btn-undo-request-phrase');
    await page.waitForTimeout(150);

    await page.fill('#request-phrase-input', 'Alex off Thu');
    await page.click('#btn-apply-request-phrase');
    await page.waitForTimeout(250);

    const thuAll = await page.evaluate(() => {
      const locks = inputs.am1 || {};
      const dks = Object.keys(locks).sort();
      const confirm = ((document.getElementById('request-phrase-confirm-text') || {}).textContent || '').trim();
      return {
        dks,
        allThuOff: dks.length >= 2 && dks.every((dk) => locks[dk] === 'off' && new Date(dk + 'T12:00:00').getDay() === 4),
        confirm,
      };
    });
    if (thuAll.allThuOff && /Alex/i.test(thuAll.confirm)) {
      pass('apply-alex-off-thu-all', thuAll.dks.join(','));
    } else fail('apply-alex-off-thu-all', JSON.stringify(thuAll));

    const badge404 = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll('img')].filter((img) => /en_badge_web_generic/i.test(img.getAttribute('src') || ''));
      const hero = document.getElementById('welcome-play-link');
      return {
        broken: imgs.map((img) => img.getAttribute('src')),
        heroText: hero ? (hero.textContent || '').trim() : '',
      };
    });
    if (!badge404.broken.length && /Get it on Google Play/i.test(badge404.heroText)) {
      pass('hero-play-badge-is-text', badge404.heroText);
    } else fail('hero-play-badge-is-text', JSON.stringify(badge404));

    const built = await page.evaluate(() => {
      document.querySelectorAll('#toast-host .toast').forEach((el) => el.remove());
      const sm = document.getElementById('name-sm');
      const am1 = document.getElementById('name-am1');
      if (sm) sm.value = 'Pat Nguyen';
      if (am1) am1.value = 'Alex Chen';
      if (typeof persistManagerNames === 'function') persistManagerNames();
      if (typeof persistStoreMeta === 'function') persistStoreMeta();
      if (typeof loadThisNrfPeriod === 'function') loadThisNrfPeriod({ quiet: true });
      else if (typeof loadPeriod === 'function') loadPeriod();
      if (typeof buildFromSetup === 'function') buildFromSetup();
      else generateSchedule({ skipFreeCount: true });
      return new Promise((resolve) => {
        setTimeout(() => {
          if (typeof switchTab === 'function') switchTab('schedule');
          if (typeof syncAppShell === 'function') syncAppShell();
          if (typeof updatePostGenStrip === 'function') updatePostGenStrip();
          if (typeof dockBuiltRebuildRow === 'function') dockBuiltRebuildRow(true);
          if (typeof syncStickyOffsets === 'function') syncStickyOffsets();
          const btn = document.getElementById('btn-generate');
          const strip = document.getElementById('post-gen-strip');
          const pill = document.getElementById('built-pill');
          resolve({
            tab: typeof currentAppTab !== 'undefined' ? currentAppTab : '',
            cells: document.querySelectorAll('#schedule-grid td.shift-editable').length,
            btn: btn ? (btn.textContent || '').trim() : '',
            stripShow: !!(strip && !strip.hidden && strip.classList.contains('show')),
            pillShown: !!(pill && !pill.hidden),
            hasPeriod: !!(typeof periodDates !== 'undefined' && periodDates && periodDates.length),
          });
        }, 2200);
      });
    });
    if (built.tab === 'schedule' && built.cells > 10 && /Rebuild/i.test(built.btn) && built.stripShow && built.pillShown) {
      pass('board-built-with-review-bar', built.btn + ' cells=' + built.cells);
    } else fail('board-built-with-review-bar', JSON.stringify(built));

    const desktopHit = await page.evaluate(() => {
      if (typeof switchTab === 'function') switchTab('schedule');
      if (typeof syncAppShell === 'function') syncAppShell();
      if (typeof dockBuiltRebuildRow === 'function') dockBuiltRebuildRow(true);
      if (typeof syncStickyOffsets === 'function') syncStickyOffsets();
      const grid = document.getElementById('schedule-grid');
      if (grid) grid.scrollIntoView({ block: 'start' });
      const btn = document.getElementById('btn-generate');
      const strip = document.getElementById('post-gen-strip');
      const pill = document.getElementById('built-pill');
      if (!btn || !strip) return { hitBtn: false, why: 'missing' };
      const br = btn.getBoundingClientRect();
      const sr = strip.getBoundingClientRect();
      const x = br.left + Math.min(24, Math.max(8, br.width / 2));
      const y = br.top + br.height / 2;
      const top = document.elementFromPoint(x, y);
      const genZ = getComputedStyle(document.getElementById('generate-section')).zIndex;
      const actions = btn.closest('.generate-actions');
      return {
        hitBtn: !!(top && (top.id === 'btn-generate' || (top.closest && top.closest('#btn-generate')))),
        stripVisible: !strip.hidden && strip.classList.contains('show') && sr.height > 8 && sr.bottom > 0,
        btnText: (btn.textContent || '').trim(),
        pillShown: !!(pill && !pill.hidden),
        z: genZ,
        topTag: top ? (top.id || top.className || top.tagName) : null,
        docked: !!(actions && actions.classList.contains('is-docked')),
      };
    });
    assertRebuildHit(desktopHit, 'rebuild-tappable-desktop');

    const proDismiss = await page.evaluate(() => {
      if (typeof showProGate === 'function') {
        showProGate('Word/Excel export is included with Pro.');
      }
      const modal = document.getElementById('pro-gate-modal');
      const btn = document.getElementById('btn-pro-gate-not-now');
      const opened = !!(modal && !modal.hidden && btn);
      if (btn) {
        btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
      }
      return {
        opened,
        hiddenAfter: !!(modal && modal.hidden),
        hasPointerdown: !!(btn && /closeProGate/.test(btn.getAttribute('onpointerdown') || '')),
      };
    });
    if (proDismiss.opened && proDismiss.hiddenAfter && proDismiss.hasPointerdown) {
      pass('pro-not-now-pointerdown-live');
    } else fail('pro-not-now-pointerdown-live', JSON.stringify(proDismiss));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    const phoneHit = await page.evaluate(() => {
      if (typeof switchTab === 'function') switchTab('schedule');
      if (typeof syncAppShell === 'function') syncAppShell();
      if (typeof updatePostGenStrip === 'function') updatePostGenStrip();
      if (typeof dockBuiltRebuildRow === 'function') dockBuiltRebuildRow(true);
      if (typeof syncStickyOffsets === 'function') syncStickyOffsets();
      const grid = document.getElementById('schedule-grid');
      if (grid) grid.scrollIntoView({ block: 'start' });
      const btn = document.getElementById('btn-generate');
      const strip = document.getElementById('post-gen-strip');
      const pill = document.getElementById('built-pill');
      if (!btn || !strip) return { hitBtn: false, why: 'missing' };
      const br = btn.getBoundingClientRect();
      const sr = strip.getBoundingClientRect();
      const x = Math.min(window.innerWidth - 8, br.left + Math.min(20, Math.max(8, br.width / 2)));
      const y = br.top + br.height / 2;
      const top = document.elementFromPoint(x, y);
      const genZ = getComputedStyle(document.getElementById('generate-section')).zIndex;
      return {
        hitBtn: !!(top && (top.id === 'btn-generate' || (top.closest && top.closest('#btn-generate')))),
        stripVisible: !strip.hidden && strip.classList.contains('show') && sr.height > 8 && sr.bottom > 0,
        btnText: (btn.textContent || '').trim(),
        pillShown: !!(pill && !pill.hidden),
        z: genZ,
        topTag: top ? (top.id || top.className || top.tagName) : null,
        belowStrip: br.top >= sr.bottom - 2,
      };
    });
    assertRebuildHit(phoneHit, 'rebuild-tappable-phone');
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
