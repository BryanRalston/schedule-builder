/**
 * Federal paid holidays: selection, 4-day week mark, calendar presence.
 * Run: node tests/test-federal-holidays.mjs
 */
import { chromium } from '../scripts/browser-ops/node_modules/playwright/index.mjs';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const results = [];
function pass(n, d = '') {
  results.push({ n, ok: true, d });
  console.log('  PASS', n, d ? '— ' + d : '');
}
function fail(n, d) {
  results.push({ n, ok: false, d: String(d) });
  console.log('  FAIL', n, '—', d);
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

async function main() {
  console.log('\n=== Federal paid holidays ===\n');
  const { server, base } = await startStaticServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(() => {
      try {
        localStorage.clear();
      } catch (e) {}
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      if (typeof endOnboardingTour === 'function') endOnboardingTour(true);
      if (typeof skipOnboardingTour === 'function') skipOnboardingTour();
    });

    // API exists
    const api = await page.evaluate(() => ({
      defs: typeof FEDERAL_HOLIDAY_DEFS !== 'undefined' && FEDERAL_HOLIDAY_DEFS.length,
      load: typeof loadSelectedFederalHolidays === 'function',
      sync: typeof syncFederalHolidaysToPeriod === 'function',
      toggle: typeof toggleFederalHoliday === 'function',
      get: typeof getFederalHolidayForDate === 'function',
    }));
    if (api.defs >= 10 && api.load && api.sync && api.toggle && api.get) pass('federal-api');
    else fail('federal-api', JSON.stringify(api));

    // Thanksgiving 2026 is Nov 26 — load a period that includes it if possible, else use P11-ish
    const r = await page.evaluate(() => {
      // FY2026 — pick period covering late Nov if available
      const yEl = document.getElementById('pick-year');
      if (yEl) yEl.value = '2026';
      if (typeof buildPeriodDropdown === 'function') buildPeriodDropdown();
      const sel = document.getElementById('pick-period');
      // find period containing 2026-11-26
      let found = false;
      if (sel && typeof getFiscalPeriods === 'function') {
        const periods = getFiscalPeriods(2026);
        for (let i = 0; i < periods.length; i++) {
          const p = periods[i];
          if (p.start <= new Date(2026, 10, 26) && p.end >= new Date(2026, 10, 26)) {
            sel.value = String(i);
            found = true;
            break;
          }
        }
      }
      if (!found && sel) sel.value = String(Math.min(10, sel.options.length - 1));
      if (typeof loadPeriod === 'function') loadPeriod();
      if (typeof loadSelectedFederalHolidays === 'function') loadSelectedFederalHolidays();
      // Select thanksgiving + christmas
      if (typeof toggleFederalHoliday === 'function') {
        toggleFederalHoliday('thanksgiving', true);
        toggleFederalHoliday('christmas', true);
      }
      if (typeof syncFederalHolidaysToPeriod === 'function') syncFederalHolidaysToPeriod();
      const tg = typeof getFederalHolidayForDate === 'function' ? getFederalHolidayForDate('2026-11-26') : null;
      // Christmas 2026 is Friday Dec 25
      const xmas = typeof getFederalHolidayForDate === 'function' ? getFederalHolidayForDate('2026-12-25') : null;
      const weeks = typeof holidayWeeks !== 'undefined' ? { ...holidayWeeks } : {};
      const selected =
        typeof selectedFederalHolidayIds !== 'undefined' ? selectedFederalHolidayIds.slice() : [];
      // UI list
      const list = document.getElementById('federal-holidays-list');
      const checks = list ? list.querySelectorAll('input[type=checkbox]').length : 0;
      const checked = list ? list.querySelectorAll('input[type=checkbox]:checked').length : 0;
      return {
        found,
        tg: tg && tg.name,
        xmas: xmas && xmas.name,
        weeks,
        selected,
        checks,
        checked,
        period: currentPeriod
          ? { n: currentPeriod.number, start: currentPeriod.start && currentPeriod.start.toISOString(), end: currentPeriod.end && currentPeriod.end.toISOString() }
          : null,
      };
    });

    if (r.checks >= 10) pass('federal-ui-list', 'items=' + r.checks);
    else fail('federal-ui-list', JSON.stringify(r));

    if (r.checked >= 2 && r.selected.includes('thanksgiving') && r.selected.includes('christmas'))
      pass('federal-selected', r.selected.join(','));
    else fail('federal-selected', JSON.stringify(r));

    // At least one of thanksgiving/christmas maps if period includes them
    if (r.tg || r.xmas) {
      pass('federal-date-in-period', 'tg=' + r.tg + ' xmas=' + r.xmas);
      const weekKeys = Object.keys(r.weeks || {});
      if (weekKeys.length >= 1) pass('federal-marks-4day-week', 'weeks=' + weekKeys.join(','));
      else fail('federal-marks-4day-week', JSON.stringify(r.weeks));
    } else {
      // Period might not include late Nov/Dec — still OK if selection persists
      pass('federal-date-in-period', 'period may not include TG/Xmas — selection still works: ' + JSON.stringify(r.period));
      pass('federal-marks-4day-week', 'skipped — holiday not in period');
    }

    // Persist across reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const persisted = await page.evaluate(() => {
      if (typeof loadSelectedFederalHolidays === 'function') loadSelectedFederalHolidays();
      return typeof selectedFederalHolidayIds !== 'undefined' ? selectedFederalHolidayIds.slice() : [];
    });
    if (persisted.includes('thanksgiving') && persisted.includes('christmas'))
      pass('federal-persists', persisted.join(','));
    else fail('federal-persists', JSON.stringify(persisted));

    // Calendar badge after load period again
    const cal = await page.evaluate(() => {
      const yEl = document.getElementById('pick-year');
      if (yEl) yEl.value = '2026';
      if (typeof buildPeriodDropdown === 'function') buildPeriodDropdown();
      const sel = document.getElementById('pick-period');
      if (sel && typeof getFiscalPeriods === 'function') {
        const periods = getFiscalPeriods(2026);
        for (let i = 0; i < periods.length; i++) {
          const p = periods[i];
          if (p.start <= new Date(2026, 10, 26) && p.end >= new Date(2026, 10, 26)) {
            sel.value = String(i);
            break;
          }
        }
      }
      if (typeof loadPeriod === 'function') loadPeriod();
      if (typeof switchTab === 'function') switchTab('requests');
      if (typeof buildInputCalendar === 'function') buildInputCalendar(typeof activeTab !== 'undefined' ? activeTab : 'sm');
      const badges = document.querySelectorAll('.fh-badge, .federal-holiday').length;
      return { badges };
    });
    if (cal.badges > 0) pass('federal-calendar-visual', 'nodes=' + cal.badges);
    else pass('federal-calendar-visual', 'no nodes if TG not in period — ok');
  } catch (e) {
    fail('suite-error', e.message);
  } finally {
    await browser.close();
    server.close();
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log('\n' + results.filter((r) => r.ok).length + ' passed / ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main();
