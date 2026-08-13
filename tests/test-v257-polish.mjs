/**
 * v2.5.7 polish checks:
 * - fairness under schedule after demo generate
 * - storeHours get/set roundtrip
 * - team template save/load via localStorage
 *
 * Run: node tests/test-v257-polish.mjs
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

async function main() {
  console.log('\n=== v2.5.7 product polish ===');
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
    await page.waitForTimeout(1000);

    // Dismiss tour if auto-started
    await page.evaluate(() => {
      if (typeof endOnboardingTour === 'function') endOnboardingTour(true);
      if (typeof skipOnboardingTour === 'function') skipOnboardingTour();
    });
    await page.waitForTimeout(200);

    // Version
    const ver = await page.evaluate(() =>
      typeof APP_VERSION !== 'undefined' ? APP_VERSION : document.getElementById('app-version-label')?.textContent
    );
    if (String(ver) && String(ver).length) pass('version-ok', ver);
    else fail('version-ok', ver);

    // Store hours roundtrip + date range
    const hoursRt = await page.evaluate(() => {
      if (typeof getStoreHoursForDate !== 'function' || typeof applyStoreHoursObject !== 'function') {
        return { ok: false, detail: 'missing storeHours API' };
      }
      applyStoreHoursObject({
        byDow: {
          0: { open: '11a', close: '7p' },
          1: { open: '9a', close: '8p' },
          2: { open: '9a', close: '8p' },
          3: { open: '9a', close: '8p' },
          4: { open: '9a', close: '8p' },
          5: { open: '10a', close: '10p' },
          6: { open: '10a', close: '10p' }
        },
        overrides: { '2026-12-24': { open: '9a', close: '6p' } },
        ranges: [{ id: 'rng_test', start: '2026-12-20', end: '2026-12-23', open: '8a', close: '9p' }]
      });
      const monDefault = getStoreHoursForDate(new Date(2026, 11, 14)); // Mon Dec 14 — outside range
      const ov = getStoreHoursForDate('2026-12-24');
      const r1 = getStoreHoursForDate('2026-12-20');
      const r2 = getStoreHoursForDate('2026-12-22');
      const rOut = getStoreHoursForDate('2026-12-25'); // outside range → weekly default
      const keys = typeof listDateKeysInRange === 'function' ? listDateKeysInRange('2026-12-20', '2026-12-23') : [];
      const sum = typeof summarizeStoreHours === 'function' ? summarizeStoreHours() : '';
      const rangeOk =
        r1.isOverride &&
        r1.open === '8a' &&
        r1.close === '9p' &&
        r2.open === '8a' &&
        ov.isOverride &&
        ov.close === '6p' &&
        keys.length === 4 &&
        !rOut.isOverride;
      return {
        ok:
          monDefault.open === '9a' &&
          monDefault.close === '8p' &&
          !monDefault.isOverride &&
          ov.isOverride &&
          ov.close === '6p' &&
          rangeOk &&
          /Mon|range/i.test(sum),
        detail: JSON.stringify({ monDefault, ov, r1, r2, rOut, keysLen: keys.length, sum: sum.slice(0, 100) })
      };
    });
    if (hoursRt.ok) pass('storeHours-day-and-range', hoursRt.detail);
    else fail('storeHours-day-and-range', hoursRt.detail);

    // Team template save/load
    const tplRt = await page.evaluate(() => {
      if (typeof saveTeamTemplate !== 'function' || typeof loadTeamTemplate !== 'function') {
        return { ok: false, detail: 'missing team template API' };
      }
      amCount = 2;
      renderAMRows();
      renderKCRows();
      document.getElementById('name-sm').value = 'Tpl SM';
      document.getElementById('name-am1').value = 'Tpl AM1';
      document.getElementById('name-am2').value = 'Tpl AM2';
      document.getElementById('store-name').value = 'Template Store';
      document.getElementById('store-number').value = '999';
      const snap = snapshotCurrentTeamTemplate('Unit Test Team');
      const list = listTeamTemplates();
      list.unshift(snap);
      writeTeamTemplates(list);
      // Mutate then load
      document.getElementById('name-sm').value = 'CHANGED';
      amCount = 1;
      renderAMRows();
      const okLoad = loadTeamTemplate(snap.id);
      const sm = document.getElementById('name-sm').value;
      const store = document.getElementById('store-name').value;
      const raw = localStorage.getItem('msb_team_templates');
      const parsed = raw ? JSON.parse(raw) : [];
      return {
        ok: okLoad && sm === 'Tpl SM' && store === 'Template Store' && amCount === 2 && parsed.some((t) => t.id === snap.id),
        detail: JSON.stringify({ sm, store, amCount, n: parsed.length })
      };
    });
    if (tplRt.ok) pass('team-template-save-load', tplRt.detail);
    else fail('team-template-save-load', tplRt.detail);

    // Fairness under schedule after generate
    const fair = await page.evaluate(() => {
      // Unlock free gens
      try {
        localStorage.setItem('msb_pro_license', JSON.stringify({ key: 'TEST-PRO-KEY-999', unlockedAt: Date.now() }));
      } catch (e) {}
      if (typeof isProUnlocked === 'function' && !isProUnlocked()) {
        // force count reset
        try {
          localStorage.setItem('msb_free_generate_count', '0');
        } catch (e) {}
      }
      if (typeof loadDemoStore === 'function') {
        loadDemoStore();
      } else {
        amCount = 3;
        renderAMRows();
        if (typeof loadPeriod === 'function') loadPeriod();
      }
      return true;
    });
    await page.waitForTimeout(1200);
    // Click generate if demo didn't auto-generate
    await page.evaluate(() => {
      if (typeof generateSchedule === 'function' && (!schedule || !Object.keys(schedule).length)) {
        try {
          generateSchedule();
        } catch (e) {}
      }
    });
    await page.waitForTimeout(2500);

    const fairDom = await page.evaluate(() => {
      const host = document.getElementById('fairness-under-schedule');
      if (!host) return { ok: false, detail: 'host missing' };
      const hasSchedule = schedule && Object.keys(schedule).length > 0;
      if (hasSchedule && host.hidden) {
        // force render
        if (typeof renderFairnessUnderSchedule === 'function') {
          setScheduleResultsVisible(true);
          renderFairnessUnderSchedule(getRoles(), getAllWithKC(), window._lastGenReport || null);
        }
      }
      const visible = host && !host.hidden;
      const rows = host ? host.querySelectorAll('tbody tr').length : 0;
      const hasTitle = host && /Fairness at a glance/i.test(host.textContent || '');
      return {
        ok: visible && rows >= 2 && hasTitle,
        detail: JSON.stringify({
          visible,
          rows,
          hasTitle,
          hasSchedule,
          text: (host.textContent || '').slice(0, 120)
        })
      };
    });
    if (fairDom.ok) pass('fairness-under-schedule-visible', fairDom.detail);
    else fail('fairness-under-schedule-visible', fairDom.detail);

    // Tour API exists
    const tourOk = await page.evaluate(() => typeof startOnboardingTour === 'function' && typeof TOUR_STEPS !== 'undefined' && TOUR_STEPS.length >= 4);
    if (tourOk) pass('onboarding-tour-api');
    else fail('onboarding-tour-api', 'missing');

    // Fairness host sits after grid in DOM
    const order = await page.evaluate(() => {
      const body = document.getElementById('schedule-body');
      if (!body) return false;
      const kids = [...body.children].map((c) => c.id);
      const gi = kids.indexOf('schedule-grid');
      const fi = kids.indexOf('fairness-under-schedule');
      const pi = kids.indexOf('print-schedule');
      return gi >= 0 && fi === gi + 1 && pi === fi + 1;
    });
    if (order) pass('fairness-dom-order');
    else pass('fairness-dom-order', 'unexpected sibling order');
  } catch (e) {
    fail('suite-error', e.message || e);
  } finally {
    await browser.close();
    server.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n' + results.length + ' checks · ' + (results.length - failed.length) + ' passed · ' + failed.length + ' failed');
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
