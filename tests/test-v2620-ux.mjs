/**
 * v2.6.20: Ask-bar undo clears the field + already-applied Enter is a
 * no-op; one undo story (Ask apply on the board stack, Ask button labeled
 * Undo request); Quality / Needs work taps the first person+day hole.
 * Keeps 2.6.12–2.6.19 behavior; version lock follows 2.6.23.
 * Run: node tests/test-v2620-ux.mjs
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

async function main() {
  console.log('\n=== v2.6.20 ask undo, one undo story, quality jump ===');

  const version = JSON.parse(read('version.json'));
  if (version.version === '2.6.23') pass('version.json', version.version);
  else fail('version.json', JSON.stringify(version));

  const sw = read('sw.js');
  if (sw.includes("const CACHE = 'msb-pro-v2.6.23'")) pass('sw-cache');
  else fail('sw-cache', sw.slice(0, 120));

  const index = read('index.html');
  if (index.includes("const APP_VERSION = '2.6.23'") && index.includes('id="app-version-label">v2.6.23')) {
    pass('index-version');
  } else fail('index-version', 'APP_VERSION / label mismatch');

  if (/function clearAskPhraseFields\(/.test(index)
    && /function requestPhraseAlreadyApplied\(/.test(index)
    && /function lastUndoIsRequestPhrase\(/.test(index)
    && /Already applied:/.test(index)
    && /clearAskPhraseFields\(\)/.test(index)
    && /Undo request/.test(index)
    && /id="btn-undo-request-phrase"[^>]*>Undo request</.test(index)) {
    pass('ask-undo-clear-and-noop-fns');
  } else fail('ask-undo-clear-and-noop-fns', 'clear/no-op helpers or Undo request label missing');

  if (/function findFirstQualityHole\(/.test(index)
    && /id="pgs-quality"/.test(index)
    && /onclick="jumpToReviewChip\('quality'\)"/.test(index)
    && /id="quality-score-hero"/.test(index)
    && /id="quality-banner"/.test(index)
    && /kind === 'quality'/.test(index)) {
    pass('quality-tap-fns');
  } else fail('quality-tap-fns', 'quality chip / jump helpers missing');

  if (!/requestPhraseUndoStack|askUndoStack|_askUndoStack/.test(index)) {
    pass('no-third-undo-stack');
  } else fail('no-third-undo-stack', 'invented a third undo stack');

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
    && /Rebuild to apply/.test(index)
    && /function peelTrailingSingleDate\(/.test(index)
    && /id="btn-pro-gate-not-now"/.test(index)) {
    pass('v2612-v2619-kept');
  } else fail('v2612-v2619-kept', '2.6.12–2.6.19 markers missing');

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

  const applyChunk = (index.match(/function applyRequestPhraseFromBar\([\s\S]*?\n\}/) || [''])[0];
  if (applyChunk
    && /requestPhraseAlreadyApplied/.test(applyChunk)
    && !/generateSchedule\s*\(/.test(applyChunk)
    && !/recordFreeGenerate\s*\(/.test(applyChunk)) {
    pass('noop-does-not-generate');
  } else fail('noop-does-not-generate', 'apply still generates or missing already-applied guard');

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

    await page.fill('#request-phrase-input', 'Alex off Thu 8/6');
    await page.click('#btn-apply-request-phrase');
    await page.waitForTimeout(250);

    const firstApply = await page.evaluate(() => {
      const locks = inputs.am1 || {};
      const undoAsk = document.getElementById('btn-undo-request-phrase');
      const undoBoard = document.getElementById('btn-undo-edit');
      const field = document.getElementById('request-phrase-input');
      const confirm = ((document.getElementById('request-phrase-confirm-text') || {}).textContent || '').trim();
      return {
        lock: locks['2026-08-06'],
        dks: Object.keys(locks),
        stack: typeof undoStack !== 'undefined' ? undoStack.length : -1,
        lastLabel: (typeof undoStack !== 'undefined' && undoStack.length) ? undoStack[undoStack.length - 1].label : '',
        askLabel: undoAsk ? (undoAsk.textContent || '').trim() : '',
        askHidden: !!(undoAsk && undoAsk.hidden),
        boardLabel: undoBoard ? (undoBoard.textContent || '').trim() : '',
        field: field ? field.value : '',
        confirm,
        freeLeft: typeof remainingFreeGenerates === 'function' ? remainingFreeGenerates() : null,
      };
    });
    if (firstApply.lock === 'off' && firstApply.dks.length === 1 && firstApply.dks[0] === '2026-08-06'
      && /Alex/i.test(firstApply.confirm) && firstApply.field === 'Alex off Thu 8/6') {
      pass('apply-alex-off-thu-8-6', firstApply.confirm);
    } else fail('apply-alex-off-thu-8-6', JSON.stringify(firstApply));

    if (/Undo request/i.test(firstApply.askLabel) && !firstApply.askHidden
      && /^Undo \(/.test(firstApply.boardLabel)
      && firstApply.stack === 1
      && /request phrase/i.test(firstApply.lastLabel)) {
      pass('one-undo-story-labeled', firstApply.askLabel + ' / ' + firstApply.boardLabel);
    } else fail('one-undo-story-labeled', JSON.stringify({
      askLabel: firstApply.askLabel,
      askHidden: firstApply.askHidden,
      boardLabel: firstApply.boardLabel,
      stack: firstApply.stack,
      lastLabel: firstApply.lastLabel,
    }));

    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);

    const noopEnter = await page.evaluate(() => {
      const locks = inputs.am1 || {};
      const confirm = ((document.getElementById('request-phrase-confirm-text') || {}).textContent || '').trim();
      return {
        lock: locks['2026-08-06'],
        dks: Object.keys(locks),
        stack: typeof undoStack !== 'undefined' ? undoStack.length : -1,
        confirm,
        generated: !!(schedule && Object.keys(schedule).some((r) => schedule[r] && Object.keys(schedule[r]).length)),
        freeLeft: typeof remainingFreeGenerates === 'function' ? remainingFreeGenerates() : null,
      };
    });
    if (noopEnter.lock === 'off' && noopEnter.dks.length === 1 && noopEnter.stack === firstApply.stack
      && /Already applied/i.test(noopEnter.confirm) && !noopEnter.generated
      && noopEnter.freeLeft === firstApply.freeLeft) {
      pass('second-enter-is-noop', noopEnter.confirm);
    } else fail('second-enter-is-noop', JSON.stringify(noopEnter));

    await page.click('#btn-undo-request-phrase');
    await page.waitForTimeout(200);

    const afterUndo = await page.evaluate(() => {
      const field = document.getElementById('request-phrase-input');
      const setup = document.getElementById('setup-request-phrase-input');
      const confirm = ((document.getElementById('request-phrase-confirm-text') || {}).textContent || '').trim();
      const undoAsk = document.getElementById('btn-undo-request-phrase');
      return {
        field: field ? field.value : 'missing',
        setup: setup ? setup.value : '',
        lock: (inputs.am1 || {})['2026-08-06'],
        dks: Object.keys(inputs.am1 || {}),
        confirm,
        askHidden: !!(undoAsk && undoAsk.hidden),
        stack: typeof undoStack !== 'undefined' ? undoStack.length : -1,
      };
    });
    if (afterUndo.field === '' && afterUndo.setup === '' && afterUndo.lock == null
      && afterUndo.dks.length === 0 && /Undid/i.test(afterUndo.confirm)) {
      pass('undo-clears-ask-field', afterUndo.confirm);
    } else fail('undo-clears-ask-field', JSON.stringify(afterUndo));

    await page.waitForTimeout(80);
    const stillEmpty = await page.evaluate(() => ((document.getElementById('request-phrase-input') || {}).value || ''));
    if (stillEmpty === '') pass('undo-field-stays-cleared');
    else fail('undo-field-stays-cleared', stillEmpty);

    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const emptyEnter = await page.evaluate(() => {
      return {
        field: ((document.getElementById('request-phrase-input') || {}).value || ''),
        dks: Object.keys(inputs.am1 || {}),
        generated: !!(schedule && Object.keys(schedule).some((r) => schedule[r] && Object.keys(schedule[r]).length)),
      };
    });
    if (emptyEnter.field === '' && emptyEnter.dks.length === 0 && !emptyEnter.generated) {
      pass('enter-after-undo-does-not-repaint');
    } else fail('enter-after-undo-does-not-repaint', JSON.stringify(emptyEnter));

    await page.fill('#request-phrase-input', 'Alex off Thu 8/6');
    await page.click('#btn-apply-request-phrase');
    await page.waitForTimeout(200);
    const boardUndo = await page.evaluate(() => {
      if (typeof undoSchedEdit === 'function') undoSchedEdit();
      const field = document.getElementById('request-phrase-input');
      return {
        field: field ? field.value : 'missing',
        lock: (inputs.am1 || {})['2026-08-06'],
        stack: typeof undoStack !== 'undefined' ? undoStack.length : -1,
      };
    });
    if (boardUndo.field === '' && boardUndo.lock == null) {
      pass('board-undo-also-clears-ask', 'stack=' + boardUndo.stack);
    } else fail('board-undo-also-clears-ask', JSON.stringify(boardUndo));

    const built = await page.evaluate(() => {
      document.querySelectorAll('#toast-host .toast').forEach((el) => el.remove());
      const sm = document.getElementById('name-sm');
      const am1 = document.getElementById('name-am1');
      const am2 = document.getElementById('name-am2');
      if (sm) sm.value = 'Pat Nguyen';
      if (am1) am1.value = 'Alex Chen';
      if (am2) am2.value = '';
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
          const qChip = document.getElementById('pgs-quality');
          const q = window._lastGenReport && (window._lastGenReport.quality || (typeof computeQualityScore === 'function' ? computeQualityScore(window._lastGenReport, getRoles()) : null));
          const toast = [...document.querySelectorAll('#toast-host .toast-msg')].map((el) => el.textContent).pop() || '';
          resolve({
            tab: typeof currentAppTab !== 'undefined' ? currentAppTab : '',
            cells: document.querySelectorAll('#schedule-grid td.shift-editable').length,
            chipTag: qChip ? qChip.tagName : '',
            chipText: qChip ? (qChip.textContent || '').trim() : '',
            chipOnclick: qChip ? (qChip.getAttribute('onclick') || '') : '',
            score: q && q.score,
            grade: q && q.grade,
            toast,
            hero: !!document.getElementById('quality-score-hero'),
          });
        }, 2200);
      });
    });
    if (built.tab === 'schedule' && built.cells > 10 && built.chipTag === 'BUTTON'
      && /Quality/i.test(built.chipText) && /jumpToReviewChip\('quality'\)/.test(built.chipOnclick)
      && built.score != null) {
      pass('quality-chip-visible', built.chipText + ' toast=' + built.toast.slice(0, 60));
    } else fail('quality-chip-visible', JSON.stringify(built));

    const jump = await page.evaluate(() => {
      let hole = typeof findFirstQualityHole === 'function' ? findFirstQualityHole() : null;
      if (!hole || !hole.role) {
        const ROLES = typeof getRoles === 'function' ? getRoles() : [];
        const allDks = (periodDates || []).map((d) => dateKey(d));
        const dk = allDks[0];
        const role = ROLES[0] || 'sm';
        if (dk && schedule[role]) {
          ROLES.forEach((r) => {
            const v = schedule[r] && schedule[r][dk];
            if (typeof isOpen === 'function' && isOpen(v)) schedule[r][dk] = 'mid-early';
            if ((typeof isClose === 'function' && isClose(v)) || v === 'kc-close') schedule[r][dk] = 'mid-early';
          });
          if (typeof revalidateAfterManualEdit === 'function') {
            revalidateAfterManualEdit(ROLES, typeof getAllWithKC === 'function' ? getAllWithKC() : []);
          }
        }
        hole = typeof findFirstQualityHole === 'function' ? findFirstQualityHole() : null;
      }
      const jumped = typeof jumpToReviewChip === 'function' ? jumpToReviewChip('quality') : null;
      return new Promise((resolve) => {
        setTimeout(() => {
          const target = hole || jumped;
          const el = target && document.querySelector(
            '#schedule-grid td.shift-editable[data-role="' + target.role + '"][data-dk="' + target.dk + '"]'
          );
          resolve({
            holeRole: hole && hole.role,
            holeDk: hole && hole.dk,
            jumpedRole: jumped && jumped.role,
            flashed: !!(el && el.classList.contains('cell-flash')),
          });
        }, 120);
      });
    });
    if (jump.holeRole && jump.holeDk && jump.flashed) {
      pass('quality-tap-jumps-and-flashes', jump.holeRole + ' ' + jump.holeDk);
    } else fail('quality-tap-jumps-and-flashes', JSON.stringify(jump));

    const heroJump = await page.evaluate(() => {
      const hero = document.getElementById('quality-score-hero');
      if (hero && typeof hero.click === 'function') hero.click();
      const hole = typeof findFirstQualityHole === 'function' ? findFirstQualityHole() : null;
      return new Promise((resolve) => {
        setTimeout(() => {
          const el = hole && document.querySelector(
            '#schedule-grid td.shift-editable[data-role="' + hole.role + '"][data-dk="' + hole.dk + '"]'
          );
          resolve({
            hero: !!hero,
            heroJump: !!(hero && /jumpToReviewChip\('quality'\)/.test(hero.getAttribute('onclick') || '')),
            flashed: !!(el && el.classList.contains('cell-flash')),
          });
        }, 120);
      });
    });
    if (heroJump.hero && heroJump.heroJump && heroJump.flashed) {
      pass('quality-hero-taps-hole');
    } else fail('quality-hero-taps-hole', JSON.stringify(heroJump));
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
