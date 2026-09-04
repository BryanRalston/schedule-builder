/**
 * v2.6.35: backup import, full-week PTO, RTO on KC nights, period boot, license.
 * Run: node tests/test-v2613-batch.mjs
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
  const spec = join(ROOT, 'scripts/browser-ops/node_modules/playwright/index.mjs');
  if (!existsSync(spec)) throw new Error('Playwright not installed');
  const mod = await import(pathToFileURL(spec).href);
  return mod.chromium;
}

function staticChecks() {
  console.log('\n=== static ===');
  const index = read('index.html');
  const buy = read('buy.html');
  const sw = read('sw.js');
  const ver = JSON.parse(read('version.json'));

  if (ver.version === '2.6.41') pass('version.json', ver.version);
  else fail('version.json', JSON.stringify(ver));

  if (index.includes("APP_VERSION = '2.6.41'") && sw.includes("msb-pro-v2.6.41")) {
    pass('app-sw-version');
  } else fail('app-sw-version', 'expected 2.6.41');

  if (/s\.length >= 6/.test(index) || /any key 6/.test(index)) {
    fail('index-license-format', 'still accepts any 6+ chars');
  } else pass('index-license-format');

  if (/s\.length >= 6/.test(buy) || /\$12\/mo/.test(buy) || buy.includes('?pro=1')) {
    fail('buy-copy', 'stale $12/mo, ?pro=1, or any-6-char key');
  } else pass('buy-copy');

  if (index.includes('function importBackupJSONFile') && index.includes('id="backup-file-input"')) {
    pass('backup-import-wired');
  } else fail('backup-import-wired', 'missing file import');

  if (index.includes('ptos >= target && workDays === 0')) pass('pto-week-rule');
  else fail('pto-week-rule', 'Rule 1 missing vacation-week exception');

  if (index.includes("inputs[r][dk] === 'rto' || inputs[r][dk] === 'off'")) pass('rto-kc-step1');
  else fail('rto-kc-step1', 'Step 1 still scrubs requested RTO');

  if (index.includes('errorSigSeen') && index.includes('repairCycled')) pass('repair-cycle-guard');
  else fail('repair-cycle-guard', 'repair loop still only detects identical signatures');

  if (index.includes('nrfFiscalYearForDate') && index.includes('startOfLocalDay')) pass('period-boot-helpers');
  else fail('period-boot-helpers');

  if (sw.includes('caches.match(req)') && sw.includes("c.put(req, res.clone())")) pass('sw-nav-cache-own-url');
  else fail('sw-nav-cache-own-url', 'SW still poisons every nav as index.html');

  if (index.includes('Jg_UrKcrhutlsyEloisAgA==') && index.includes("product_permalink")) {
    pass('gumroad-product-id');
  } else fail('gumroad-product-id', 'missing live product_id verify');
}

async function engineChecks(page) {
  console.log('\n=== engine ===');
  const report = await page.evaluate(() => {
    const out = { scenarios: [] };
    function scenario(name, fn) {
      try {
        const r = fn();
        out.scenarios.push({ name, ok: !!r.ok, detail: r.detail || '' });
      } catch (e) {
        out.scenarios.push({ name, ok: false, detail: String(e.message || e) });
      }
    }

    function buildDays(startY, startM, startD, n) {
      const days = [];
      for (let i = 0; i < n; i++) days.push(new Date(startY, startM - 1, startD + i));
      return days;
    }

    function runGen(setup) {
      amCount = setup.amCount || 3;
      kcList = (setup.kcList || [{ id: 'kc1', name: 'Jordan Lee', asManager: false, midDows: [] }]).map((kc) =>
        Object.assign({}, kc, { name: kc.name && !/^key carrier/i.test(kc.name) ? kc.name : 'Jordan Lee' })
      );
      if (typeof renderAMRows === 'function') renderAMRows();
      if (typeof renderKCRows === 'function') renderKCRows();
      const smEl = document.getElementById('name-sm');
      if (smEl) smEl.value = 'Pat Nguyen';
      for (let i = 1; i <= amCount; i++) {
        const el = document.getElementById('name-am' + i);
        if (el) el.value = 'Assistant ' + i;
      }
      kcList.forEach((kc) => {
        const el = document.getElementById('name-' + kc.id);
        if (el) el.value = kc.name;
      });
      periodDates = buildDays(2026, 8, 30, 35);
      currentPeriod = {
        number: 8,
        approxMonth: 'Sep',
        start: periodDates[0],
        end: periodDates[periodDates.length - 1],
        numWeeks: 5,
        weeks: []
      };
      for (let w = 0; w < 5; w++) {
        currentPeriod.weeks.push({ start: periodDates[w * 7], end: periodDates[w * 7 + 6] });
      }
      fiscalYear = 2026;
      holidayWeeks = {};
      inputs = { sm: {}, am1: {}, am2: {}, am3: {}, kc1: {} };
      if (setup.inputs) {
        Object.keys(setup.inputs).forEach((r) => {
          inputs[r] = Object.assign({}, setup.inputs[r]);
        });
      }
      preferences = Object.assign({}, DEFAULT_PREFERENCES, setup.prefs || {});
      schedule = {};
      _generateScheduleInner();
      return { ROLES: getRoles(), allDks: periodDates.map(dateKey) };
    }

    scenario('license-reject-any-six', () => {
      const bad = validLicenseKey('abcdef');
      const msb = validLicenseKey('MSB-PRO-STORE-1');
      const gum = validLicenseKey('A1B2C3D4-E5F60718-9ABCDEF0-1234ABCD');
      const uuid = validLicenseKey('550e8400-e29b-41d4-a716-446655440000');
      return {
        ok: !bad && msb && gum && uuid,
        detail: `bad=${bad} msb=${msb} gum=${gum} uuid=${uuid}`
      };
    });

    scenario('january-nrf-year', () => {
      const jan = nrfFiscalYearForDate(new Date(2026, 0, 15));
      const mar = nrfFiscalYearForDate(new Date(2026, 2, 15));
      return { ok: jan === 2025 && mar === 2026, detail: `jan=${jan} mar=${mar}` };
    });

    scenario('backup-parse-guards', () => {
      const bad = parseBackupPayload('{not json');
      const empty = parseBackupPayload('{}');
      const ok = parseBackupPayload(JSON.stringify({ names: { sm: 'Pat' }, amCount: 2, inputs: {}, schedule: {} }));
      return {
        ok: !bad.ok && !empty.ok && ok.ok,
        detail: `bad=${!!bad.error} empty=${!!empty.error} ok=${ok.ok}`
      };
    });

    scenario('full-week-pto-valid', () => {
      const ins = { sm: {}, am1: {}, am2: {}, am3: {} };
      const week0 = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(2026, 7, 30 + i);
        const dk = dateKey(d);
        week0.push(dk);
        ins.am1[dk] = 'pto';
      }
      try {
        runGen({ amCount: 3, inputs: ins, prefs: { avoidClopening: true } });
      } catch (e) {
        return { ok: false, detail: 'gen: ' + String(e.message || e) };
      }
      const row = schedule.am1 || {};
      const work = week0.filter((dk) => isWork(row[dk])).length;
      const pto = week0.filter((dk) => row[dk] === 'pto').length;
      const unmet = (window._lastGenReport && window._lastGenReport.unmet) || [];
      const five = unmet.filter((u) => /Week 1 has .*scheduled/.test(String(u)) && /AM1|am1/i.test(String(u)));
      return {
        ok: work === 0 && pto === 7 && five.length === 0,
        detail: `work=${work} pto=${pto} five=${five.length}`
      };
    });

    scenario('rto-honored-on-kc-monday', () => {
      const ins = { sm: {}, am1: {}, am2: {}, am3: {} };
      ins.am1['2026-08-31'] = 'rto';
      runGen({
        amCount: 3,
        kcList: [{ id: 'kc1', name: 'KC1', asManager: false, midDows: [] }],
        inputs: ins,
        prefs: { kcCloseDays: [1], avoidClopening: true }
      });
      const cell = schedule.am1 && schedule.am1['2026-08-31'];
      return { ok: cell === 'rto', detail: `am1 Monday=${cell}` };
    });

    return out;
  });

  for (const s of report.scenarios) {
    if (s.ok) pass(s.name, s.detail);
    else fail(s.name, s.detail);
  }
}

async function main() {
  console.log('\n=== v2.6.37 customer-fix integrity ===');
  staticChecks();

  const { server, base } = await startStaticServer();
  const chromium = await loadChromium();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(() => {
      try {
        localStorage.setItem('msb_tour_done', '1');
        localStorage.setItem('msb_welcome_dismissed', '1');
      } catch (e) {}
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    await engineChecks(page);
  } finally {
    await browser.close();
    server.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
