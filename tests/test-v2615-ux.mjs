/**
 * v2.6.15: one-time backup nudge after first generate; clopen pairs on the board.
 * Keeps 2.6.12 leftover-demo guards and 2.6.13 role titles.
 * Run: node tests/test-v2615-ux.mjs
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

async function main() {
  console.log('\n=== v2.6.15 backup nudge + board clopens ===');

  const version = JSON.parse(read('version.json'));
  if (version.version === '2.6.15') pass('version.json', version.version);
  else fail('version.json', JSON.stringify(version));

  const sw = read('sw.js');
  if (sw.includes("const CACHE = 'msb-pro-v2.6.15'")) pass('sw-cache');
  else fail('sw-cache', sw.slice(0, 120));

  const index = read('index.html');
  if (index.includes("const APP_VERSION = '2.6.15'") && index.includes('id="app-version-label">v2.6.15')) {
    pass('index-version');
  } else fail('index-version', 'APP_VERSION / label mismatch');

  if (/id="backup-nudge"/.test(index)
    && /function maybeShowBackupNudge\(/.test(index)
    && /function dismissBackupNudge\(/.test(index)
    && /function saveBackupFromNudge\(/.test(index)
    && /msb_backup_nudge_done/.test(index)
    && /onclick="saveBackupFromNudge\(\)"/.test(index)
    && /onclick="dismissBackupNudge\(\)"/.test(index)
    && /More → Backup JSON/.test(index)
    && /no cloud copy/.test(index)
    && /function exportBackupJSON\(/.test(index)) {
    pass('backup-nudge-fns');
  } else fail('backup-nudge-fns', 'nudge markup / existing backup path missing');

  if (/aria-modal/.test((index.match(/id="backup-nudge"[\s\S]{0,800}/) || [''])[0])) {
    fail('backup-nudge-not-modal', 'nudge is a blocking modal');
  } else pass('backup-nudge-not-modal');

  if (/function applyClopenMarksOnBoard\(/.test(index)
    && /function findClopens\(/.test(index)
    && /applyClopenMarksOnBoard\(ROLES\)/.test(index)
    && /findClopens\(ROLES\)/.test(index)
    && /cell-clopen/.test(index)
    && /Clopen pair — preference to review before you post/.test(index)
    && !/zero clopen/i.test(index)
    && !/clopen-free/i.test(index)) {
    pass('clopen-board-reuses-radar');
  } else fail('clopen-board-reuses-radar', 'board marks missing or second scoring system');

  if (/id="post-gen-strip"/.test(index)
    && /id="pgs-cover"/.test(index)
    && /id="pgs-clopens"/.test(index)
    && /id="pgs-we"/.test(index)
    && /function renderFairnessUnderSchedule\(/.test(index)
    && /function renderWeekendFairnessBoard\(/.test(index)) {
    pass('post-gen-strip-kept');
  } else fail('post-gen-strip-kept', 'weekend / coverage review strip rebuilt or missing');

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

  if (!/TJX|Marshalls|HomeGoods|Winners/i.test(index)) pass('no-employer-names');
  else fail('no-employer-names', 'employer name leaked into copy');

  if (!/time clock|team messaging|payroll|cloud roster|SSO/i.test(
    (index.match(/id="backup-nudge"[\s\S]{0,600}/) || [''])[0]
  )) {
    pass('nudge-stays-offline');
  } else fail('nudge-stays-offline', 'nudge invented a cloud/account path');

  const licenseModal = (index.match(/id="license-modal"[\s\S]*?id="provider-modal"/) || [''])[0];
  if (/Enter your Gumroad license or an MSB-PRO- unlock code/.test(licenseModal)
    && /placeholder="Gumroad license or MSB-PRO-…/.test(licenseModal)
    && !/any key 6\+/.test(licenseModal)
    && !/6\+ characters/.test(licenseModal)
    && !/PLAY-REVIEW/.test(licenseModal)) {
    pass('license-modal-honest-copy');
  } else fail('license-modal-honest-copy', licenseModal.slice(0, 280));

  if (/s\.length >= 6\) return true/.test(index) || /if \(s\.length >= 6\) return true/.test(index)) {
    fail('license-rejects-six-char-junk', 'validLicenseKey still accepts any 6+ string');
  } else if (/MSB-PRO-\[A-Z0-9\]/.test(index) && /\[A-Z0-9\]\{6,8\}/.test(index)) {
    pass('license-rejects-six-char-junk');
  } else fail('license-rejects-six-char-junk', 'expected MSB-PRO- + Gumroad-shaped gate');

  if (!/MSB-PRO-PLAY-REVIEW/.test(index)) pass('play-review-key-not-in-app-copy');
  else fail('play-review-key-not-in-app-copy', 'reviewer key leaked into index.html');

  if (/function liveExportCell\(/.test(index)
    && /function exportPaintForCell\(/.test(index)
    && /function buildExcelExportHtml\(/.test(index)
    && /liveExportCell\(r, dateKey\(wd\)\)/.test(index)
    && /always read schedule now, never a generate-time snapshot/.test(index)
    && !/mso-shading: auto/.test(index)) {
    pass('export-paints-live-cells');
  } else fail('export-paints-live-cells', 'Word/Excel still snapshot or skip live paint');

  const buy = read('buy.html');
  if (/any key ≥ 6|at least 6 characters/.test(buy) || /s\.length >= 6\) return true/.test(buy)) {
    fail('buy-unlock-not-six-char-junk', 'buy.html still accepts any 6+ key');
  } else if (/Gumroad license or an MSB-PRO- unlock code/.test(buy)) {
    pass('buy-unlock-not-six-char-junk');
  } else fail('buy-unlock-not-six-char-junk', 'buy.html unlock copy/gate missing');

  const chromium = await loadChromium();
  const { server, base } = await startStaticServer();
  const browser = await chromium.launch({
    executablePath: existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const firstRun = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await firstRun.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await firstRun.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await firstRun.reload({ waitUntil: 'domcontentloaded' });
    await firstRun.waitForTimeout(700);
    const firstRunAuth = await firstRun.evaluate(() => {
      const visible = (el) => {
        if (!el) return false;
        if (el.hidden || el.hasAttribute('hidden')) return false;
        const cs = getComputedStyle(el);
        if (!cs || cs.display === 'none' || cs.visibility === 'hidden') return false;
        return el.getBoundingClientRect().height > 2;
      };
      const g = document.getElementById('auth-google-btn');
      const m = document.getElementById('auth-microsoft-btn');
      const actions = document.querySelector('#auth-shell .auth-actions');
      const shell = document.getElementById('auth-shell');
      const offline = [...document.querySelectorAll('button')].find((b) => /Continue offline/i.test(b.textContent || ''));
      return {
        shellVisible: visible(shell),
        actionsVisible: visible(actions),
        googleVisible: visible(g),
        microsoftVisible: visible(m),
        googleText: g ? (g.textContent || '').replace(/\s+/g, ' ').trim() : '',
        offlineVisible: visible(offline),
      };
    });
    if (!firstRunAuth.googleVisible && !firstRunAuth.microsoftVisible && !firstRunAuth.actionsVisible) {
      pass('first-run-no-sso-preview');
    } else fail('first-run-no-sso-preview', JSON.stringify(firstRunAuth));
    await firstRun.close();

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
    await page.waitForTimeout(600);

    const built = await page.evaluate(() => {
      document.querySelectorAll('#toast-host .toast').forEach((el) => el.remove());
      const sm = document.getElementById('name-sm');
      const am1 = document.getElementById('name-am1');
      if (sm) sm.value = 'Pat Nguyen';
      if (am1) am1.value = 'Chris Ortiz';
      persistManagerNames();
      persistStoreMeta();
      if (typeof loadPeriod === 'function' && (!periodDates || !periodDates.length)) loadPeriod();
      buildFromSetup();
      return new Promise((resolve) => {
        setTimeout(() => {
          const nudge = document.getElementById('backup-nudge');
          const cs = nudge ? getComputedStyle(nudge) : null;
          const strip = document.getElementById('post-gen-strip');
          const exportBtn = document.getElementById('toolbar-export-btn');
          const printBtn = [...document.querySelectorAll('#toolbar-export-panel button')]
            .find((b) => /Print posting sheet/i.test(b.textContent || ''));
          resolve({
            tab: typeof currentAppTab !== 'undefined' ? currentAppTab : '',
            cells: document.querySelectorAll('#schedule-grid td.shift-editable').length,
            toast: [...document.querySelectorAll('#toast-host .toast-msg')].map((el) => el.textContent).pop() || '',
            nudgeShown: !!(nudge && !nudge.hidden && nudge.classList.contains('show') && cs && cs.display !== 'none'),
            nudgeText: nudge ? (nudge.textContent || '').replace(/\s+/g, ' ').trim() : '',
            modal: !!(nudge && nudge.getAttribute('aria-modal') === 'true'),
            flag: (() => { try { return localStorage.getItem('msb_backup_nudge_done'); } catch (e) { return 'err'; } })(),
            stripPresent: !!strip,
            exportEnabled: !!(exportBtn && !exportBtn.disabled),
            printEnabled: !!(printBtn && !printBtn.disabled),
            pos: cs ? cs.position : '',
          });
        }, 2000);
      });
    });
    if (built.tab === 'schedule' && built.cells > 20 && /Schedule ready/.test(built.toast)) {
      pass('generate-still-builds', built.cells + ' cells');
    } else fail('generate-still-builds', JSON.stringify(built));

    if (built.nudgeShown && /Save a backup now/.test(built.nudgeText)
      && /More → Backup JSON/.test(built.nudgeText)
      && /no cloud/i.test(built.nudgeText)
      && !built.modal
      && built.flag !== '1') {
      pass('first-generate-backup-nudge');
    } else fail('first-generate-backup-nudge', JSON.stringify(built));

    if (built.exportEnabled && built.printEnabled && built.stripPresent && built.pos !== 'fixed') {
      pass('nudge-does-not-block-posting');
    } else fail('nudge-does-not-block-posting', JSON.stringify({
      exportEnabled: built.exportEnabled,
      printEnabled: built.printEnabled,
      stripPresent: built.stripPresent,
      pos: built.pos,
    }));

    const dismissed = await page.evaluate(() => {
      dismissBackupNudge();
      const nudge = document.getElementById('backup-nudge');
      const cs = nudge ? getComputedStyle(nudge) : null;
      return {
        hidden: !nudge || nudge.hidden || !nudge.classList.contains('show') || (cs && cs.display === 'none'),
        flag: (() => { try { return localStorage.getItem('msb_backup_nudge_done'); } catch (e) { return 'err'; } })(),
      };
    });
    if (dismissed.hidden && dismissed.flag === '1') pass('nudge-dismiss-sets-flag');
    else fail('nudge-dismiss-sets-flag', JSON.stringify(dismissed));

    const rebuilt = await page.evaluate(() => {
      document.querySelectorAll('#toast-host .toast').forEach((el) => el.remove());
      generateSchedule();
      return new Promise((resolve) => {
        setTimeout(() => {
          const nudge = document.getElementById('backup-nudge');
          const cs = nudge ? getComputedStyle(nudge) : null;
          resolve({
            cells: document.querySelectorAll('#schedule-grid td.shift-editable').length,
            toast: [...document.querySelectorAll('#toast-host .toast-msg')].map((el) => el.textContent).pop() || '',
            nudgeShown: !!(nudge && !nudge.hidden && nudge.classList.contains('show') && cs && cs.display !== 'none'),
            flag: (() => { try { return localStorage.getItem('msb_backup_nudge_done'); } catch (e) { return 'err'; } })(),
          });
        }, 2000);
      });
    });
    if (rebuilt.cells > 20 && /Schedule ready/.test(rebuilt.toast) && !rebuilt.nudgeShown && rebuilt.flag === '1') {
      pass('nudge-one-time-after-rebuild');
    } else fail('nudge-one-time-after-rebuild', JSON.stringify(rebuilt));

    const clopenLive = await page.evaluate(() => {
      const ROLES = getRoles();
      const ALL_KC = getAllWithKC();
      const allDks = periodDates.map((d) => dateKey(d));
      const role = 'sm';
      const closeDk = allDks[0];
      const openDk = allDks[1];
      schedule[role][closeDk] = 'close';
      schedule[role][openDk] = 'open-early';
      revalidateAfterManualEdit(ROLES, ALL_KC);
      const list = findClopens(ROLES);
      const pair = list.find((c) => c.role === role && c.closeDk === closeDk && c.openDk === openDk);
      const closeCell = document.querySelector('td.shift-editable[data-role="' + role + '"][data-dk="' + closeDk + '"]');
      const openCell = document.querySelector('td.shift-editable[data-role="' + role + '"][data-dk="' + openDk + '"]');
      const marked = [...document.querySelectorAll('#schedule-grid [data-clopen="1"]')].map((el) => ({
        role: el.getAttribute('data-role'),
        dk: el.getAttribute('data-dk'),
      }));
      const radarHasPair = pair && /close/.test(pair.label) && /open/.test(pair.label);
      schedule[role][openDk] = 'mid-late';
      revalidateAfterManualEdit(ROLES, ALL_KC);
      const after = findClopens(ROLES).find((c) => c.role === role && c.closeDk === closeDk && c.openDk === openDk);
      const closeAfter = document.querySelector('td.shift-editable[data-role="' + role + '"][data-dk="' + closeDk + '"]');
      const openAfter = document.querySelector('td.shift-editable[data-role="' + role + '"][data-dk="' + openDk + '"]');
      return {
        pairFound: !!pair,
        radarHasPair,
        closeMarked: !!(closeCell && closeCell.classList.contains('cell-clopen') && closeCell.querySelector('.cell-clopen-mark')),
        openMarked: !!(openCell && openCell.classList.contains('cell-clopen') && openCell.querySelector('.cell-clopen-mark')),
        closeTitle: closeCell ? (closeCell.getAttribute('title') || '') : '',
        markedCount: marked.length,
        pairGone: !after,
        closeCleared: !(closeAfter && closeAfter.classList.contains('cell-clopen')),
        openCleared: !(openAfter && openAfter.classList.contains('cell-clopen')),
        cellsAfter: document.querySelectorAll('#schedule-grid td.shift-editable').length,
      };
    });
    if (clopenLive.pairFound && clopenLive.radarHasPair && clopenLive.closeMarked && clopenLive.openMarked
      && /preference to review before you post/.test(clopenLive.closeTitle)) {
      pass('clopen-marks-on-board-after-edit', 'pair + ' + clopenLive.markedCount + ' cells');
    } else fail('clopen-marks-on-board-after-edit', JSON.stringify(clopenLive));

    if (clopenLive.pairGone && clopenLive.closeCleared && clopenLive.openCleared && clopenLive.cellsAfter > 20) {
      pass('clopen-marks-clear-when-pair-gone');
    } else fail('clopen-marks-clear-when-pair-gone', JSON.stringify(clopenLive));

    const lic = await page.evaluate(() => {
      const check = (k) => (typeof validLicenseKey === 'function' ? validLicenseKey(k) : null);
      const before = typeof isProUnlocked === 'function' ? isProUnlocked() : null;
      const input = document.getElementById('license-input');
      const err = document.getElementById('license-error');
      if (input) input.value = 'abcdef';
      if (typeof submitLicenseUnlock === 'function') submitLicenseUnlock();
      const junkBlocked = !!(err && /Gumroad license or an MSB-PRO-/.test(err.textContent || ''));
      const stillBefore = typeof isProUnlocked === 'function' ? isProUnlocked() : null;
      if (input) input.value = 'MSB-PRO-CLOSED-TEST';
      if (typeof submitLicenseUnlock === 'function') submitLicenseUnlock();
      let stored = null;
      try { stored = JSON.parse(localStorage.getItem('msb_pro_license') || 'null'); } catch (e) {}
      return {
        empty: check(''),
        junk: check('abcdef'),
        six: check('123456'),
        closed: check('MSB-PRO-CLOSED-TEST'),
        play: check('MSB-PRO-PLAY-REVIEW'),
        gumroad: check('A1B2C3D4-E5F6G7H8-I9J0K1L2-M3N4O5P6'),
        barePrefix: check('MSB-PRO-'),
        junkBlocked,
        unlockedBeforeJunk: before,
        unlockedAfterJunk: stillBefore,
        unlockedAfterClosed: typeof isProUnlocked === 'function' ? isProUnlocked() : null,
        storedKey: stored && stored.key,
      };
    });
    if (lic.empty === false && lic.junk === false && lic.six === false && lic.barePrefix === false
      && lic.closed === true && lic.play === true && lic.gumroad === true) {
      pass('license-gate-live');
    } else fail('license-gate-live', JSON.stringify(lic));
    if (lic.junkBlocked && lic.unlockedAfterJunk === lic.unlockedBeforeJunk
      && lic.unlockedAfterClosed === true && lic.storedKey === 'MSB-PRO-CLOSED-TEST') {
      pass('license-modal-rejects-junk-accepts-closed-test');
    } else fail('license-modal-rejects-junk-accepts-closed-test', JSON.stringify(lic));

    const exportPaint = await page.evaluate(() => {
      const ROLES = getRoles();
      const allDks = periodDates.map((d) => dateKey(d));
      let hit = null;
      ROLES.forEach((r) => {
        if (hit) return;
        allDks.forEach((dk) => {
          if (hit) return;
          const s = schedule[r] && schedule[r][dk];
          if (typeof isOpen === 'function' && isOpen(s)) hit = { role: r, dk, before: s };
        });
      });
      if (!hit) return { error: 'no-open-cell' };
      const before = exportPaintForCell(hit.role, hit.dk);
      const weekIdx = Math.floor(allDks.indexOf(hit.dk) / 7);
      applySchedEdit(hit.role, hit.dk, weekIdx, 'close');
      const after = exportPaintForCell(hit.role, hit.dk);
      const excel = typeof buildExcelExportHtml === 'function' ? buildExcelExportHtml() : '';
      const board = document.querySelector(
        'td.shift-editable[data-role="' + hit.role + '"][data-dk="' + hit.dk + '"]'
      );
      return {
        beforeShift: hit.before,
        beforeBg: before.bg,
        afterShift: after.shift,
        afterBg: after.bg,
        afterLabel: after.label,
        excelHasCloseFill: excel.indexOf('#fce7f3') !== -1,
        excelHasCloseLabel: excel.indexOf(after.label) !== -1,
        boardClose: !!(board && board.classList.contains('shift-close')),
      };
    });
    if (exportPaint.error) fail('export-colors-follow-cell-edit', exportPaint.error);
    else if (exportPaint.beforeBg === '#d1fae5'
      && exportPaint.afterBg === '#fce7f3'
      && exportPaint.afterShift === 'close'
      && exportPaint.excelHasCloseFill
      && exportPaint.excelHasCloseLabel
      && exportPaint.boardClose) {
      pass('export-colors-follow-cell-edit', exportPaint.afterLabel);
    } else fail('export-colors-follow-cell-edit', JSON.stringify(exportPaint));
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
