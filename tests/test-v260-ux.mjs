/**
 * v2.6.0 flagship UX checks
 * Run: node tests/test-v260-ux.mjs
 */
import { chromium } from '../scripts/browser-ops/node_modules/playwright/index.mjs';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

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
      const ext = extname(file);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

async function dismissChrome(page) {
  await page.evaluate(() => {
    try {
      if (typeof endOnboardingTour === 'function') endOnboardingTour(true);
      if (typeof skipOnboardingTour === 'function') skipOnboardingTour();
      if (typeof dismissWelcome === 'function') dismissWelcome();
      localStorage.setItem('msb_pro_license', JSON.stringify({ key: 'TEST-PRO-KEY-999', unlockedAt: Date.now() }));
      localStorage.setItem('msb_free_generate_count', '0');
      localStorage.setItem('msb_tour_done', '1');
      localStorage.setItem('msb_welcome_dismissed', '1');
    } catch (e) {}
  });
}

async function main() {
  console.log('\n=== v2.6.0 flagship UX ===');
  const { server, base } = await startStaticServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {}
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    await dismissChrome(page);
    await page.waitForTimeout(200);

    // Version
    const ver = await page.evaluate(() =>
      typeof APP_VERSION !== 'undefined' ? APP_VERSION : document.getElementById('app-version-label')?.textContent
    );
    if (/^2\.6/.test(String(ver))) pass('version-2.6.0', ver);
    else fail('version-2.6.0', ver);

    // Command palette via API + Ctrl+K
    const paletteApi = await page.evaluate(() => {
      if (typeof openCommandPalette !== 'function') return { ok: false, detail: 'missing openCommandPalette' };
      openCommandPalette();
      const el = document.getElementById('cmd-palette');
      const open = el && el.classList.contains('open');
      closeCommandPalette();
      return { ok: !!open, detail: open ? 'opened' : 'not open' };
    });
    if (paletteApi.ok) pass('cmd-palette-api', paletteApi.detail);
    else fail('cmd-palette-api', paletteApi.detail);

    await page.keyboard.down('Control');
    await page.keyboard.press('k');
    await page.keyboard.up('Control');
    await page.waitForTimeout(150);
    const paletteKey = await page.evaluate(() => {
      const el = document.getElementById('cmd-palette');
      return !!(el && el.classList.contains('open'));
    });
    if (paletteKey) pass('cmd-palette-ctrl-k');
    else fail('cmd-palette-ctrl-k', 'palette not open after Ctrl+K');
    await page.keyboard.press('Escape');

    // Density
    const dens = await page.evaluate(() => {
      setDensityMode('compact', true);
      const a = document.documentElement.getAttribute('data-density');
      setDensityMode('board', true);
      const b = document.documentElement.getAttribute('data-density');
      setDensityMode('comfortable', true);
      const c = document.documentElement.getAttribute('data-density');
      return { a, b, c, stored: localStorage.getItem('msb_density') };
    });
    if (dens.a === 'compact' && dens.b === 'board' && dens.c === 'comfortable') {
      pass('density-attribute', JSON.stringify(dens));
    } else fail('density-attribute', JSON.stringify(dens));

    // High contrast
    const hc = await page.evaluate(() => {
      document.documentElement.classList.remove('hc-posting');
      toggleHighContrast();
      const on = document.documentElement.classList.contains('hc-posting');
      const attr = document.documentElement.getAttribute('data-contrast');
      toggleHighContrast();
      return { on, attr, off: !document.documentElement.classList.contains('hc-posting') };
    });
    if (hc.on && hc.attr === 'high' && hc.off) pass('high-contrast', JSON.stringify(hc));
    else fail('high-contrast', JSON.stringify(hc));

    // Next period function
    const nextP = await page.evaluate(() => {
      if (typeof startNextPeriodSameTeam !== 'function') return { ok: false, detail: 'missing fn' };
      if (typeof loadPeriod === 'function') loadPeriod();
      const before = currentPeriodIndex;
      const beforeYear = fiscalYear;
      startNextPeriodSameTeam();
      const after = currentPeriodIndex;
      const advanced =
        after === before + 1 ||
        (before + 1 >= (allPeriods || []).length && after === 0 && fiscalYear === beforeYear + 1) ||
        after !== before;
      return {
        ok: advanced && Object.keys(schedule || {}).length === 0,
        detail: JSON.stringify({ before, after, year: fiscalYear, schedKeys: Object.keys(schedule || {}).length })
      };
    });
    if (nextP.ok) pass('next-period-advances', nextP.detail);
    else fail('next-period-advances', nextP.detail);

    // Undo stack push/pop
    const undoRt = await page.evaluate(() => {
      if (typeof pushUndoSnapshot !== 'function' || typeof undoSchedEdit !== 'function') {
        return { ok: false, detail: 'missing undo API' };
      }
      schedule = { sm: { '2099-01-01': 'close' } };
      pushUndoSnapshot('test');
      schedule = { sm: { '2099-01-01': 'open-late' } };
      const n = undoStack.length;
      undoSchedEdit();
      const restored = schedule && schedule.sm && schedule.sm['2099-01-01'] === 'close';
      return { ok: n >= 1 && restored, detail: JSON.stringify({ n, restored, val: schedule?.sm?.['2099-01-01'] }) };
    });
    if (undoRt.ok) pass('undo-stack', undoRt.detail);
    else fail('undo-stack', undoRt.detail);

    // Diff compute
    const diffRt = await page.evaluate(() => {
      if (typeof computeScheduleDiff !== 'function') return { ok: false, detail: 'missing computeScheduleDiff' };
      const prev = { sm: { '2026-01-01': 'open-late', '2026-01-02': 'close' }, am1: { '2026-01-01': 'mid-early' } };
      const next = { sm: { '2026-01-01': 'close', '2026-01-02': 'close' }, am1: { '2026-01-01': 'open-late' } };
      const d = computeScheduleDiff(prev, next);
      return { ok: d.length >= 2, detail: JSON.stringify(d.slice(0, 5)) };
    });
    if (diffRt.ok) pass('schedule-diff', diffRt.detail);
    else fail('schedule-diff', diffRt.detail);

    // view=lock
    await page.goto(base + '/index.html?lock=1', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    await dismissChrome(page);
    const lockRt = await page.evaluate(() => {
      if (typeof applyLaunchMode === 'function') applyLaunchMode(new URLSearchParams('lock=1'));
      const locked = !!window._viewLocked;
      const htmlLocked = document.documentElement.classList.contains('view-locked');
      return { ok: locked && htmlLocked, detail: JSON.stringify({ locked, htmlLocked }) };
    });
    if (lockRt.ok) pass('view-lock', lockRt.detail);
    else fail('view-lock', lockRt.detail);

    // Hours in header after demo gen
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      try {
        localStorage.clear();
        localStorage.setItem('msb_pro_license', JSON.stringify({ key: 'TEST-PRO-KEY-999', unlockedAt: Date.now() }));
        localStorage.setItem('msb_tour_done', '1');
        localStorage.setItem('msb_welcome_dismissed', '1');
      } catch (e) {}
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    await dismissChrome(page);
    await page.evaluate(() => {
      if (typeof loadDemoStore === 'function') loadDemoStore();
    });
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
      if (typeof generateSchedule === 'function' && (!schedule || !Object.keys(schedule).some((r) => Object.keys(schedule[r] || {}).length))) {
        try { generateSchedule(); } catch (e) {}
      }
    });
    await page.waitForTimeout(2500);
    const hoursRt = await page.evaluate(() => {
      const grid = document.getElementById('schedule-grid');
      const html = grid ? grid.innerHTML : '';
      const hasHoursClass = /day-hours/.test(html);
      const hasTime = /\d{1,2}[ap]–\d{1,2}[ap]|\d{1,2}a–\d{1,2}p/i.test(html);
      const strip = document.getElementById('post-gen-strip');
      const stripShow = strip && strip.classList.contains('show');
      return {
        ok: hasHoursClass || hasTime,
        detail: JSON.stringify({
          hasHoursClass,
          hasTime,
          stripShow,
          len: html.length,
          sample: html.slice(0, 200)
        })
      };
    });
    if (hoursRt.ok) pass('hours-in-header', hoursRt.detail);
    else fail('hours-in-header', hoursRt.detail);

    // Strip after generate
    const stripOk = await page.evaluate(() => {
      const strip = document.getElementById('post-gen-strip');
      return !!(strip && (strip.classList.contains('show') || !strip.hidden));
    });
    if (stripOk) pass('post-gen-strip-visible');
    else fail('post-gen-strip-visible', 'strip not shown after generate');

    // Palette commands include expected
    const cmds = await page.evaluate(() => {
      if (typeof getCommandPaletteCommands !== 'function') return [];
      return getCommandPaletteCommands().map((c) => c.id);
    });
    const need = ['tab-setup', 'generate', 'demo', 'save', 'next-p', 'dens-c', 'hc', 'export-w'];
    const missing = need.filter((id) => !cmds.includes(id));
    if (!missing.length) pass('cmd-palette-commands', cmds.length + ' cmds');
    else fail('cmd-palette-commands', 'missing ' + missing.join(','));
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
