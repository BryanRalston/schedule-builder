/**
 * v2.6.32: auto-save the built period on this device after Generate
 * and cell edits. Quality does not ding SM for fewer weekend offs
 * when that default pref is on. First visit with no named team stays
 * clean (2.6.29). Close-even 2.6.30 and icon 2.6.31 stay.
 * Keeps 2.6.12–2.6.31 suites; version lock 2.6.32.
 * Run: node tests/test-v2632-ux.mjs
 */
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
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

function seedDirtyTesterChrome() {
  localStorage.setItem('msb_tour_done', '1');
  localStorage.setItem('msb_welcome_dismissed', '1');
  localStorage.setItem('msb_ui_lang', 'es');
  localStorage.setItem('msb_free_generate_count', '2');
  localStorage.setItem('msb_store_meta', JSON.stringify({
    storeName: 'Playtest Store',
    storeNumber: '999',
  }));
  localStorage.setItem('schedule_last', 'schedule_FY2026-P1');
  localStorage.setItem('schedule_FY2026-P1', JSON.stringify({
    storeName: '',
    names: { sm: 'Store Manager', am1: 'AM1' },
    schedule: {
      sm: { '2026-02-01': 'open-late', '2026-02-02': 'close' },
      am1: { '2026-02-01': 'close', '2026-02-02': 'open-late' },
    },
  }));
}

const OLD_ICON_512_SHA256 =
  '036e40a2b4326d3e0748d690d0de632520cc53be829ae07464e9d9fe1e45f95a';

async function main() {
  console.log('\n=== v2.6.32 auto-save board + SM fewer-WE Quality ===');

  const version = JSON.parse(read('version.json'));
  if (version.version === '2.6.32') pass('version.json', version.version);
  else fail('version.json', JSON.stringify(version));

  const sw = read('sw.js');
  if (sw.includes("const CACHE = 'msb-pro-v2.6.32'")) pass('sw-cache');
  else fail('sw-cache', sw.slice(0, 120));

  const index = read('index.html');
  if (index.includes("const APP_VERSION = '2.6.32'") && index.includes('id="app-version-label">v2.6.32')) {
    pass('index-version');
  } else fail('index-version', 'APP_VERSION / label mismatch');

  if (/function persistLiveSchedule\(/.test(index)
    && /function weekendFairnessRoles\(/.test(index)
    && /function smFewerWeekendOffsPrefOn\(/.test(index)
    && /saveToStorage\(\{ quiet: true \}\)/.test(index)
    && /maybeShowBackupNudge/.test(index)
    && /function exportBackupJSON\(/.test(index)) {
    pass('v2632-fns');
  } else fail('v2632-fns', 'auto-save / weekend-fairness helpers missing');

  if (/function shouldEvenSmAmCloses\(/.test(index)
    && /function getEvenCloseShare\(/.test(index)
    && /function confineNamedKcToReservedCloseNights\(/.test(index)
    && /function leftoverMustFixViolations\(/.test(index)
    && /function hasSavedUserPeople\(/.test(index)
    && /function isFirstVisitOpen\(/.test(index)
    && /function applyFirstVisitReset\(/.test(index)
    && /function generateScheduleFromButton\(/.test(index)) {
    pass('v2612-v2631-kept');
  } else fail('v2612-v2631-kept', '2.6.12–2.6.31 markers missing');

  if (!/TJX|Marshalls|HomeGoods|Winners/i.test(index)) pass('no-employer-names');
  else fail('no-employer-names', 'employer name leaked into copy');

  const icon512 = readFileSync(join(ROOT, 'icons/icon-512.png'));
  const hash = createHash('sha256').update(icon512).digest('hex');
  if (hash !== OLD_ICON_512_SHA256) pass('icon-512-not-old-calendar', hash.slice(0, 12) + '…');
  else fail('icon-512-not-old-calendar', 'icon reverted to old calendar');

  const play = join(ROOT, 'store/play-assets/hi-res-icon-512.png');
  const twa = join(ROOT, 'android-twa/store_icon.png');
  if (existsSync(play) && existsSync(twa)) pass('play-twa-icons-stay');
  else fail('play-twa-icons-stay', 'Play / TWA icon missing');

  const chromium = await loadChromium();
  const { server, base } = await startStaticServer();
  const browser = await chromium.launch({
    executablePath: existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const dirty = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
    });
    await dirty.addInitScript(seedDirtyTesterChrome);
    await dirty.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dirty.waitForTimeout(900);
    const firstVisit = await dirty.evaluate(() => {
      const resultsEl = document.getElementById('schedule-results');
      const grid = document.getElementById('schedule-grid');
      return {
        first: typeof isFirstVisitOpen === 'function' ? isFirstVisitOpen() : null,
        people: typeof hasSavedUserPeople === 'function' ? hasSavedUserPeople() : null,
        built: typeof hasPersistedBuiltSchedule === 'function' ? hasPersistedBuiltSchedule() : null,
        live: typeof hasLiveBuiltBoard === 'function' ? hasLiveBuiltBoard() : null,
        cells: grid ? grid.querySelectorAll('td.shift-editable').length : 0,
        resultsShown: !!(resultsEl && resultsEl.style.display !== 'none' && resultsEl.offsetParent),
        sm: ((document.getElementById('name-sm') || {}).value || ''),
        store: ((document.getElementById('store-name') || {}).value || ''),
      };
    });
    if (firstVisit.first === true && firstVisit.people === false && firstVisit.built === false
      && firstVisit.live === false && firstVisit.cells === 0
      && !/playtest/i.test(firstVisit.store)) {
      pass('first-visit-no-leftover-board', firstVisit.sm || '(blank SM)');
    } else fail('first-visit-no-leftover-board', JSON.stringify(firstVisit));
    await dirty.close();

    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('msb_tour_done', '1');
      localStorage.setItem('msb_welcome_dismissed', '1');
      localStorage.setItem('msb_pro_license', JSON.stringify({ key: 'TEST-PRO-KEY-999', unlockedAt: Date.now() }));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);

    const quality = await page.evaluate(() => {
      const sm = document.getElementById('name-sm');
      const am1 = document.getElementById('name-am1');
      const am2 = document.getElementById('name-am2');
      if (sm) sm.value = 'Bryan Test';
      if (am1) am1.value = 'Dana Cruz';
      if (am2) am2.value = 'javier';
      if (typeof persistManagerNames === 'function') persistManagerNames();
      const roles = ['sm', 'am1', 'am2'];
      const prefsOn = Object.assign({}, DEFAULT_PREFERENCES, { smFewerWeekendOffs: true, targetWeekendDaysOff: 2 });
      const prefsOff = Object.assign({}, DEFAULT_PREFERENCES, { smFewerWeekendOffs: false, targetWeekendDaysOff: 2 });
      const baseReport = {
        weekendOffs: { sm: 1, am1: 4, am2: 4 },
        opens: { sm: 8, am1: 8, am2: 8 },
        closes: { sm: 6, am1: 6, am2: 6 },
        mids: { sm: 4, am1: 4, am2: 4 },
        clopens: { sm: 0, am1: 0, am2: 0 },
        maxStreak: { sm: 5, am1: 5, am2: 5 },
        totalClopens: 0,
        unmet: [],
        hardErrorCount: 0,
        mustFixCount: 0,
      };
      const onReport = Object.assign({}, baseReport, { prefs: prefsOn });
      const offReport = Object.assign({}, baseReport, { prefs: prefsOff });
      const amShort = Object.assign({}, baseReport, {
        prefs: prefsOn,
        weekendOffs: { sm: 1, am1: 0, am2: 4 },
      });
      const qOn = computeQualityScore(onReport, roles);
      const qOff = computeQualityScore(offReport, roles);
      const qAm = computeQualityScore(amShort, roles);
      const issuesOn = buildPostingIssues(onReport, roles, []);
      const issuesAm = buildPostingIssues(amShort, roles, []);
      const wePool = typeof weekendFairnessRoles === 'function'
        ? weekendFairnessRoles(roles, prefsOn)
        : [];
      return {
        qOnWeekend: qOn.parts && qOn.parts.weekend,
        qOffWeekend: qOff.parts && qOff.parts.weekend,
        qAmWeekend: qAm.parts && qAm.parts.weekend,
        smShortOn: issuesOn.some((i) => /Bryan Test/i.test(i.title || '') && /weekend/i.test(i.title || '')),
        smLowOn: issuesOn.some((i) => /low WE offs/i.test((i.title || '') + ' ' + (i.meta || '')) && /Bryan Test/i.test((i.title || '') + ' ' + (i.meta || ''))),
        amShort: issuesAm.some((i) => /Dana Cruz/i.test(i.title || '') && /weekend/i.test(i.title || '')),
        wePool,
        prefOn: typeof smFewerWeekendOffsPrefOn === 'function' ? smFewerWeekendOffsPrefOn(prefsOn) : null,
      };
    });
    if (quality.prefOn === true && quality.wePool && quality.wePool.join(',') === 'am1,am2'
      && quality.qOnWeekend === 20 && quality.smShortOn === false && quality.smLowOn === false) {
      pass('sm-fewer-we-not-quality-fail', 'weekend=' + quality.qOnWeekend);
    } else fail('sm-fewer-we-not-quality-fail', JSON.stringify(quality));

    if (quality.qAmWeekend < 20 && quality.amShort === true) {
      pass('ams-still-scored-for-we', 'AM weekend=' + quality.qAmWeekend);
    } else fail('ams-still-scored-for-we', JSON.stringify(quality));

    if (quality.qOffWeekend < 20) {
      pass('sm-scored-when-pref-off', 'weekend=' + quality.qOffWeekend);
    } else fail('sm-scored-when-pref-off', JSON.stringify(quality));

    const built = await page.evaluate(() => {
      document.querySelectorAll('#toast-host .toast').forEach((el) => el.remove());
      if (typeof addAM === 'function' && amCount < 3) addAM();
      const sm = document.getElementById('name-sm');
      const am1 = document.getElementById('name-am1');
      const am2 = document.getElementById('name-am2');
      const am3 = document.getElementById('name-am3');
      const kc1 = document.getElementById('name-kc1');
      const storeName = document.getElementById('store-name');
      const storeNum = document.getElementById('store-number');
      if (sm) sm.value = 'Bryan Test';
      if (am1) am1.value = 'Dana Cruz';
      if (am2) am2.value = 'javier';
      if (am3) am3.value = 'jennifer';
      if (kc1) kc1.value = 'elizabeth';
      if (storeName) storeName.value = 'Pro';
      if (storeNum) storeNum.value = '0851';
      if (typeof persistManagerNames === 'function') persistManagerNames();
      if (typeof persistStoreMeta === 'function') persistStoreMeta();
      if (typeof loadThisNrfPeriod === 'function') loadThisNrfPeriod({ quiet: true });
      else if (typeof loadPeriod === 'function') loadPeriod();
      if (typeof generateSchedule === 'function') generateSchedule({ skipFreeCount: true });
      return new Promise((resolve) => {
        setTimeout(() => {
          const dks = (periodDates || []).map((d) => dateKey(d));
          const report = window._lastGenReport || {};
          const snap = JSON.parse(JSON.stringify(schedule || {}));
          let edit = null;
          dks.some((dk) => {
            const s = schedule.sm && schedule.sm[dk];
            if (s && s !== 'off' && s !== 'pto' && s !== 'rto' && s !== 'loa') {
              edit = { role: 'sm', dk, from: s, to: 'off' };
              return true;
            }
            return false;
          });
          const lastKey = localStorage.getItem('schedule_last');
          let saved = null;
          try { saved = lastKey ? JSON.parse(localStorage.getItem(lastKey) || 'null') : null; } catch (e) {}
          const issues = typeof buildPostingIssues === 'function'
            ? buildPostingIssues(report, getRoles(), [])
            : [];
          const fu = document.getElementById('fairness-under-schedule');
          const smRow = fu
            ? [...fu.querySelectorAll('tbody tr')].find((tr) => /Bryan Test/i.test(tr.textContent || ''))
            : null;
          const glanceSmLow = !!(smRow && /low WE offs/i.test(smRow.textContent || ''));
          const smWe = (report.weekendOffs && report.weekendOffs.sm) || 0;
          const amWes = ['am1', 'am2', 'am3'].map((r) => (report.weekendOffs && report.weekendOffs[r]) || 0);
          resolve({
            days: dks.length,
            cells: document.querySelectorAll('#schedule-grid td.shift-editable').length,
            live: typeof hasLiveBuiltBoard === 'function' ? hasLiveBuiltBoard() : null,
            lastKey,
            savedHasBoard: !!(saved && saved.schedule && saved.schedule.sm && Object.keys(saved.schedule.sm).length),
            savedSm: saved && saved.names ? saved.names.sm : '',
            savedAm: saved && saved.names ? saved.names.am1 : '',
            smWe,
            amWes,
            smShortIssue: issues.some((i) => /Bryan Test/i.test(i.title || '') && /weekend/i.test(i.title || '')),
            glanceSmLow,
            evenPeers: !!(report.closeTargets && report.closeTargets.evenPeers),
            edit,
            snapCells: Object.keys(snap.sm || {}).length,
          });
        }, 2800);
      });
    });

    if (built.days >= 28 && built.live && built.cells > 10 && built.savedHasBoard
      && built.lastKey && built.savedSm === 'Bryan Test' && built.savedAm === 'Dana Cruz') {
      pass('generate-autosaves-board', built.lastKey + ' · ' + built.cells + ' cells');
    } else fail('generate-autosaves-board', JSON.stringify({
      days: built.days, live: built.live, cells: built.cells,
      lastKey: built.lastKey, savedHasBoard: built.savedHasBoard,
      savedSm: built.savedSm, savedAm: built.savedAm,
    }));

    if (built.evenPeers) pass('close-even-2630-stays', 'evenPeers');
    else fail('close-even-2630-stays', 'evenPeers missing after generate');

    if (built.smShortIssue === false && built.glanceSmLow === false) {
      pass('live-sm-not-shamed-for-fewer-we', 'SM WE=' + built.smWe + ' AMs=' + (built.amWes || []).join(','));
    } else fail('live-sm-not-shamed-for-fewer-we', JSON.stringify({
      smWe: built.smWe, amWes: built.amWes,
      smShortIssue: built.smShortIssue, glanceSmLow: built.glanceSmLow,
    }));

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1100);
    const afterReload = await page.evaluate(() => {
      const resultsEl = document.getElementById('schedule-results');
      return {
        live: typeof hasLiveBuiltBoard === 'function' ? hasLiveBuiltBoard() : null,
        cells: document.querySelectorAll('#schedule-grid td.shift-editable').length,
        sm: ((document.getElementById('name-sm') || {}).value || ''),
        am: ((document.getElementById('name-am1') || {}).value || ''),
        resultsShown: !!(resultsEl && resultsEl.style.display !== 'none'),
        smDays: schedule && schedule.sm ? Object.keys(schedule.sm).length : 0,
      };
    });
    if (afterReload.live && afterReload.cells > 10 && afterReload.smDays > 10
      && afterReload.sm === 'Bryan Test' && afterReload.am === 'Dana Cruz') {
      pass('reload-restores-board-and-roster', afterReload.cells + ' cells · ' + afterReload.sm);
    } else fail('reload-restores-board-and-roster', JSON.stringify(afterReload));

    const edited = await page.evaluate(() => {
      const dks = (periodDates || []).map((d) => dateKey(d));
      let edit = null;
      dks.some((dk) => {
        const s = schedule.sm && schedule.sm[dk];
        if (s && s !== 'off' && s !== 'pto' && s !== 'rto' && s !== 'loa') {
          edit = { role: 'sm', dk, from: s, to: 'off' };
          return true;
        }
        return false;
      });
      if (!edit || typeof applySchedEdit !== 'function') return { ok: false, edit };
      applySchedEdit(edit.role, edit.dk, 0, edit.to);
      const lastKey = localStorage.getItem('schedule_last');
      let saved = null;
      try { saved = lastKey ? JSON.parse(localStorage.getItem(lastKey) || 'null') : null; } catch (e) {}
      return {
        ok: true,
        edit,
        live: schedule.sm && schedule.sm[edit.dk],
        saved: saved && saved.schedule && saved.schedule.sm ? saved.schedule.sm[edit.dk] : null,
      };
    });
    if (edited.ok && edited.live === 'off' && edited.saved === 'off') {
      pass('cell-edit-autosaves', edited.edit.dk);
    } else fail('cell-edit-autosaves', JSON.stringify(edited));

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1100);
    const afterEditReload = await page.evaluate((dk) => {
      return {
        live: schedule && schedule.sm ? schedule.sm[dk] : null,
        sm: ((document.getElementById('name-sm') || {}).value || ''),
        cells: document.querySelectorAll('#schedule-grid td.shift-editable').length,
      };
    }, edited.edit && edited.edit.dk);
    if (afterEditReload.live === 'off' && afterEditReload.sm === 'Bryan Test' && afterEditReload.cells > 10) {
      pass('reload-keeps-cell-edit', edited.edit.dk);
    } else fail('reload-keeps-cell-edit', JSON.stringify(afterEditReload));

    await page.close();
  } catch (e) {
    fail('suite-error', e.stack || e.message || e);
  } finally {
    await browser.close();
    server.close();
  }

  const failed = results.filter((r) => r.ok === false);
  console.log('\n' + results.length + ' checks, ' + failed.length + ' failed');
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
