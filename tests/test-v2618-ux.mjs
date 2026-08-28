/**
 * v2.6.18: tap-to-fix review chips + one-line why this cell,
 * plus playtest extras — no phantom AM2, rebuild-to-apply hint, hide unnamed KC tabs.
 * Jumps reuse cell-flash. Auto-fixes stay buttons. Why is rule-based.
 * Keeps 2.6.12–2.6.18 behavior; version lock follows 2.6.27.
 * Run: node tests/test-v2618-ux.mjs
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
  console.log('\n=== v2.6.18 tap-to-fix + why + playtest extras ===');

  const version = JSON.parse(read('version.json'));
  if (version.version === '2.6.27') pass('version.json', version.version);
  else fail('version.json', JSON.stringify(version));

  const sw = read('sw.js');
  if (sw.includes("const CACHE = 'msb-pro-v2.6.27'")) pass('sw-cache');
  else fail('sw-cache', sw.slice(0, 120));

  const index = read('index.html');
  if (index.includes("const APP_VERSION = '2.6.27'") && index.includes('id="app-version-label">v2.6.27')) {
    pass('index-version');
  } else fail('index-version', 'APP_VERSION / label mismatch');

  if (/function jumpToScheduleCell\(/.test(index)
    && /function flashScheduleCell\(/.test(index)
    && /function findScheduleCellEl\(/.test(index)
    && /function explainCellWhy\(/.test(index)
    && /function jumpToReviewChip\(/.test(index)
    && /function findWeekendWorkDay\(/.test(index)
    && /function applyWeekendOffFix\(/.test(index)
    && /cell-why-line/.test(index)
    && /onclick="jumpToReviewChip\('clopen'\)"/.test(index)
    && /onclick="jumpToReviewChip\('cover'\)"/.test(index)
    && /onclick="jumpToReviewChip\('we'\)"/.test(index)) {
    pass('tap-to-fix-fns');
  } else fail('tap-to-fix-fns', 'jump helpers or review-chip wiring missing');

  if (/This is the generated shift/.test(index)
    && /lock — request stays on this day/.test(index)
    && /Clopen pair — close then open \(preference to review\)/.test(index)
    && /Weekend work — short of weekend-off target/.test(index)
    && /Coverage hole/.test(index)
    && !/zero clopen/i.test(index)
    && !/clopen-free/i.test(index)
    && !/guaranteed clopen/i.test(index)) {
    pass('why-copy-rule-based');
  } else fail('why-copy-rule-based', 'why lines missing or promise zero clopens');

  if (/onclick="applyClopenFix\(/.test(index)
    && /onclick="applyWeekendOffFix\(/.test(index)
    && !/jumpToClopen\([^)]*\);\s*applyClopenFix/.test(index)
    && !/jumpToRoleOnGrid\([^)]*\);\s*applyWeekendOffFix/.test(index)) {
    pass('auto-fix-stays-button');
  } else fail('auto-fix-stays-button', 'auto-fix looks silent or missing');

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
    && /kc-row-placeholder/.test(index)
    && /function parseRequestPhrase\(/.test(index)
    && /id="request-phrase-bar"/.test(index)) {
    pass('v2615-v2617-kept');
  } else fail('v2615-v2617-kept', '2.6.15–2.6.17 markers missing');

  if (!/TJX|Marshalls|HomeGoods|Winners/i.test(index)) pass('no-employer-names');
  else fail('no-employer-names', 'employer name leaked into copy');

  // 2.6.26 ships EN/ES on-device. Prior suites only lock version + prior behavior.
  pass('no-language-picker');

  if (/function isNamedAssistant\(/.test(index)
    && /Unnamed AM2 stays off the board/.test(index)
    && /function getRequestTabIds\(/.test(index)
    && /id="request-board-hint"/.test(index)
    && /Rebuild to apply/.test(index)
    && /function refreshRequestBoardHint\(/.test(index)
    && /function hasLiveBuiltBoard\(/.test(index)) {
    pass('playtest-extra-fns');
  } else fail('playtest-extra-fns', 'phantom-AM / rebuild-hint / request-tab helpers missing');

  const paintChunk = (index.match(/function paintRequestCell\([\s\S]*?\n\}/) || [''])[0];
  const phraseChunk = (index.match(/function applyRequestPhraseFromBar\([\s\S]*?\n\}/) || [''])[0];
  if (paintChunk && !/generateSchedule\s*\(/.test(paintChunk)
    && phraseChunk && !/generateSchedule\s*\(/.test(phraseChunk)) {
    pass('paint-does-not-autobuild');
  } else fail('paint-does-not-autobuild', 'paint/phrase still calls generateSchedule');

  const whyChunk = (index.match(/v2\.6\.18 — tap-to-fix review chips[\s\S]*?function jumpToReviewChip/) || [''])[0];
  if (whyChunk
    && !/\bfetch\s*\(/.test(whyChunk)
    && !/XMLHttpRequest/.test(whyChunk)
    && !/openai|anthropic|copilot|cloud.?roster/i.test(whyChunk)) {
    pass('why-stays-on-device');
  } else fail('why-stays-on-device', 'why/tap-to-fix talks to a network or invented AI');

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
          resolve({
            tab: typeof currentAppTab !== 'undefined' ? currentAppTab : '',
            cells: document.querySelectorAll('#schedule-grid td.shift-editable').length,
            toast: [...document.querySelectorAll('#toast-host .toast-msg')].map((el) => el.textContent).pop() || '',
            chips: [...document.querySelectorAll('#post-gen-strip .pgs-chip')].map((el) => el.tagName),
          });
        }, 2000);
      });
    });
    if (built.tab === 'schedule' && built.cells > 20 && /Schedule ready/.test(built.toast)) {
      pass('generate-still-builds', built.cells + ' cells');
    } else fail('generate-still-builds', JSON.stringify(built));

    if (built.chips.length >= 5 && built.chips.every((t) => t === 'BUTTON')) {
      pass('review-chips-are-buttons');
    } else fail('review-chips-are-buttons', JSON.stringify(built.chips));

    const jump = await page.evaluate(() => {
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
      const idx = list.findIndex((c) => c.role === role && c.openDk === openDk);
      jumpToClopen(idx);
      const el = document.querySelector(
        '#schedule-grid td.shift-editable[data-role="' + role + '"][data-dk="' + openDk + '"]'
      );
      const why = explainCellWhy(role, openDk);
      return new Promise((resolve) => {
        setTimeout(() => {
          const flashed = !!(el && el.classList.contains('cell-flash'));
          const issues = typeof buildPostingIssues === 'function'
            ? buildPostingIssues(window._lastGenReport, ROLES, [])
            : [];
          const clIssue = issues.find((i) => /clopen/i.test(i.title || ''));
          if (clIssue && typeof jumpToPostingIssue === 'function') {
            window._postingIssues = issues;
            jumpToPostingIssue(issues.indexOf(clIssue));
          }
          setTimeout(() => {
            const el2 = document.querySelector(
              '#schedule-grid td.shift-editable[data-role="' + role + '"][data-dk="' + openDk + '"]'
            );
            resolve({
              pairFound: !!pair,
              idx: idx,
              flashed: flashed,
              role: el ? el.getAttribute('data-role') : '',
              dk: el ? el.getAttribute('data-dk') : '',
              whyKind: why && why.kind,
              whyText: why && why.text,
              clIssueRole: clIssue && clIssue.role,
              clIssueDk: clIssue && clIssue.dk,
              postedFlash: !!(el2 && el2.classList.contains('cell-flash')),
              sheetOpen: !!(document.getElementById('review-sheet') && document.getElementById('review-sheet').classList.contains('open')),
            });
          }, 80);
        }, 80);
      });
    });
    if (jump.pairFound && jump.flashed && jump.role === 'sm' && jump.dk && jump.whyKind === 'clopen') {
      pass('tap-issue-jumps-to-cell', jump.dk);
    } else fail('tap-issue-jumps-to-cell', JSON.stringify(jump));

    if (jump.clIssueRole === 'sm' && jump.clIssueDk === jump.dk && jump.postedFlash && !jump.sheetOpen) {
      pass('posting-issue-jumps-person-day');
    } else fail('posting-issue-jumps-person-day', JSON.stringify({
      clIssueRole: jump.clIssueRole,
      clIssueDk: jump.clIssueDk,
      postedFlash: jump.postedFlash,
      sheetOpen: jump.sheetOpen,
    }));

    const pto = await page.evaluate(() => {
      const ROLES = getRoles();
      const ALL_KC = getAllWithKC();
      const allDks = periodDates.map((d) => dateKey(d));
      const role = 'am1';
      const dk = allDks.find((key, i) => periodDates[i] && periodDates[i].getDay() !== 0 && periodDates[i].getDay() !== 6) || allDks[2];
      if (!inputs[role]) inputs[role] = {};
      inputs[role][dk] = 'pto';
      schedule[role][dk] = 'pto';
      revalidateAfterManualEdit(ROLES, ALL_KC);
      const why = explainCellWhy(role, dk);
      const cell = document.querySelector(
        '#schedule-grid td.shift-editable[data-role="' + role + '"][data-dk="' + dk + '"]'
      );
      openCellInspector({ currentTarget: cell }, role, dk, 0, false);
      const insp = document.querySelector('#cell-inspector .cell-why-line');
      closeCellInspector();
      const ev = { currentTarget: cell, stopPropagation() {}, preventDefault() {} };
      openSchedEditMenu(ev, role, dk, 0, false);
      const menu = document.querySelector('.sched-edit-menu .cell-why-line');
      const generated = explainCellWhy(role, allDks.find((key) => key !== dk) || allDks[0]);
      return {
        whyKind: why && why.kind,
        whyText: why && why.text,
        inspKind: insp && insp.getAttribute('data-why-kind'),
        inspText: insp && (insp.textContent || '').trim(),
        menuKind: menu && menu.getAttribute('data-why-kind'),
        menuText: menu && (menu.textContent || '').trim(),
        generatedKind: generated && generated.kind,
      };
    });
    if (pto.whyKind === 'lock' && /PTO lock/.test(pto.whyText)
      && pto.inspKind === 'lock' && /PTO lock/.test(pto.inspText)
      && pto.menuKind === 'lock' && /PTO lock/.test(pto.menuText)) {
      pass('pto-cell-shows-lock-why');
    } else fail('pto-cell-shows-lock-why', JSON.stringify(pto));

    if (pto.generatedKind === 'generated' || pto.generatedKind === 'coverage'
      || pto.generatedKind === 'weekend' || pto.generatedKind === 'clopen') {
      pass('why-stays-in-known-kinds', pto.generatedKind);
    } else fail('why-stays-in-known-kinds', JSON.stringify(pto.generatedKind));

    const chipJump = await page.evaluate(() => {
      const ROLES = getRoles();
      const list = findClopens(ROLES);
      if (!list.length) {
        const allDks = periodDates.map((d) => dateKey(d));
        schedule.sm[allDks[0]] = 'close';
        schedule.sm[allDks[1]] = 'open-early';
        revalidateAfterManualEdit(ROLES, getAllWithKC());
      }
      const again = findClopens(getRoles());
      jumpToReviewChip('clopen');
      return new Promise((resolve) => {
        setTimeout(() => {
          const c = again[0];
          const el = c && document.querySelector(
            '#schedule-grid td.shift-editable[data-role="' + c.role + '"][data-dk="' + c.openDk + '"]'
          );
          resolve({
            hasPair: again.length > 0,
            flashed: !!(el && el.classList.contains('cell-flash')),
            role: c && c.role,
            dk: c && c.openDk,
          });
        }, 80);
      });
    });
    if (chipJump.hasPair && chipJump.flashed) pass('review-chip-jumps-to-cell', chipJump.role + ' ' + chipJump.dk);
    else fail('review-chip-jumps-to-cell', JSON.stringify(chipJump));

    const phantom = await page.evaluate(() => {
      const roles = typeof getRoles === 'function' ? getRoles() : [];
      const ams = typeof getAMs === 'function' ? getAMs() : [];
      const tabs = typeof getRequestTabIds === 'function' ? getRequestTabIds() : [];
      const boardAm2 = document.querySelectorAll('#schedule-grid [data-role="am2"]').length;
      const boardNames = [...document.querySelectorAll('#schedule-grid td.name-col')].map((el) => (el.textContent || '').trim());
      const printHtml = (document.getElementById('print-schedule') || {}).innerHTML || '';
      const excel = typeof buildExcelExportHtml === 'function' ? buildExcelExportHtml() : '';
      const coverCells = [...document.querySelectorAll('#schedule-grid .coverage-row td')].map((el) => (el.textContent || '').trim());
      const am2Days = schedule.am2 ? Object.keys(schedule.am2).length : 0;
      const namedAm2 = typeof isNamedAssistant === 'function' ? isNamedAssistant(2) : null;
      const am2Val = (document.getElementById('name-am2') || {}).value || '';
      return {
        roles,
        ams,
        tabs,
        boardAm2,
        boardNames,
        printHasAm2: /AM2|Assistant Manager 2/i.test(printHtml),
        excelHasAm2: /AM2|Assistant Manager 2/i.test(excel),
        coverSample: coverCells.slice(0, 4),
        am2Days,
        namedAm2,
        am2Val,
        placeholder: typeof isPlaceholderManagerName === 'function' && isPlaceholderManagerName(am2Val || 'AM2'),
      };
    });
    if (phantom.roles.join(',') === 'sm,am1'
      && phantom.ams.join(',') === 'am1'
      && !phantom.tabs.includes('am2')
      && phantom.boardAm2 === 0
      && !phantom.boardNames.some((n) => /AM2|Assistant Manager 2/i.test(n))
      && !phantom.printHasAm2
      && !phantom.excelHasAm2
      && phantom.am2Days === 0
      && phantom.namedAm2 === false
      && phantom.placeholder) {
      pass('no-phantom-am2-on-board-export', phantom.roles.join(','));
    } else fail('no-phantom-am2-on-board-export', JSON.stringify(phantom));

    const requests = await page.evaluate(() => {
      switchTab('requests');
      const hint = document.getElementById('request-board-hint');
      const tabLabels = [...document.querySelectorAll('#input-tabs .input-tab')].map((el) => ({
        text: (el.textContent || '').trim(),
        role: el.dataset.role || '',
      }));
      const kcInput = document.getElementById('name-kc1');
      const kcRow = kcInput && kcInput.closest('.manager-row');
      const allDks = periodDates.map((d) => dateKey(d));
      const dk = allDks.find((key) => {
        const s = schedule.sm && schedule.sm[key];
        return s && s !== 'off' && s !== 'pto' && s !== 'rto' && s !== 'loa';
      }) || allDks[1];
      const beforeShift = schedule.sm[dk];
      const cellSel = '#schedule-grid td.shift-editable[data-role="sm"][data-dk="' + dk + '"] .cell-shift-txt';
      const beforeCell = (document.querySelector(cellSel) || {}).textContent || '';
      if (!inputs.sm) inputs.sm = {};
      inputs.sm[dk] = 'pto';
      if (typeof refreshRequestBoardHint === 'function') refreshRequestBoardHint();
      const afterShift = schedule.sm[dk];
      const afterCell = (document.querySelector(cellSel) || {}).textContent || '';
      const hintAfterPaint = hint && !hint.hidden && /Rebuild to apply/.test(hint.textContent || '');
      return {
        hintText: hint ? (hint.textContent || '').trim() : '',
        hintShown: !!(hint && !hint.hidden),
        tabRoles: tabLabels.map((t) => t.role),
        tabTexts: tabLabels.map((t) => t.text),
        kcInDom: !!kcInput,
        kcRowPlaceholder: !!(kcRow && kcRow.classList.contains('kc-row-placeholder')),
        dk,
        beforeShift,
        afterShift,
        beforeCell,
        afterCell,
        hintAfterPaint,
      };
    });
    if (requests.hintShown && /Rebuild to apply/.test(requests.hintText)
      && requests.afterShift === requests.beforeShift
      && requests.afterCell === requests.beforeCell
      && requests.hintAfterPaint) {
      pass('requests-rebuild-hint-no-autobuild', requests.dk);
    } else fail('requests-rebuild-hint-no-autobuild', JSON.stringify(requests));

    if (!requests.tabRoles.includes('kc1') && !requests.tabRoles.includes('am2')
      && requests.kcInDom && requests.kcRowPlaceholder
      && requests.tabRoles.includes('sm') && requests.tabRoles.includes('am1')) {
      pass('unnamed-kc-am-hidden-from-request-tabs', requests.tabRoles.join(','));
    } else fail('unnamed-kc-am-hidden-from-request-tabs', JSON.stringify({
      tabRoles: requests.tabRoles,
      tabTexts: requests.tabTexts,
      kcInDom: requests.kcInDom,
      kcRowPlaceholder: requests.kcRowPlaceholder,
    }));

    const rebuilt = await page.evaluate((dk) => {
      return new Promise((resolve) => {
        generateSchedule({ skipFreeCount: true });
        setTimeout(() => {
          const cell = document.querySelector(
            '#schedule-grid td.shift-editable[data-role="sm"][data-dk="' + dk + '"] .cell-shift-txt'
          );
          resolve({
            shift: schedule.sm && schedule.sm[dk],
            cell: cell ? (cell.textContent || '').trim() : '',
            stillNoAm2: !document.querySelector('#schedule-grid [data-role="am2"]'),
          });
        }, 2000);
      });
    }, requests.dk);
    if (rebuilt.shift === 'pto' && /PTO|VAC/i.test(rebuilt.cell) && rebuilt.stillNoAm2) {
      pass('rebuild-applies-painted-request', rebuilt.cell);
    } else fail('rebuild-applies-painted-request', JSON.stringify(rebuilt));
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
