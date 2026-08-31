/**
 * v2.6.36 leftovers: holiday uncheck, custom 9-5 hours, 53-week P12,
 * SM extra-close strip, two-manager coverage message, chrome/SW pins.
 * Run: node tests/test-v2635-leftover.mjs
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
  const money = JSON.parse(read('monetization.json'));

  if (ver.version === '2.6.36') pass('version.json', ver.version);
  else fail('version.json', JSON.stringify(ver));

  if (index.includes("APP_VERSION = '2.6.36'") && sw.includes("msb-pro-v2.6.36")
    && index.includes('id="app-version-label">v2.6.36')) {
    pass('app-sw-version');
  } else fail('app-sw-version', 'expected 2.6.36');

  if (/--ink-4:\s*#7e8dab/.test(index)) pass('ink-4-contrast');
  else fail('ink-4-contrast', 'expected --ink-4: #7e8dab');

  if (index.includes('.btn-cmdk { display: none !important; }')
    && index.includes('@media (pointer: coarse)')) {
    pass('cmdk-hidden-phone');
  } else fail('cmdk-hidden-phone', '⌘K hide missing on 600px/coarse');

  if (index.includes('header-menu-sep') && /data-i18n="Export"/.test(index)
    && /data-i18n="View"/.test(index) && /data-i18n="Account"/.test(index)) {
    pass('more-menu-groups');
  } else fail('more-menu-groups', 'More menu missing Export/View/Help/Account seps');

  if (index.includes("className = 'toast-action'")
    && index.includes("reg.waiting.postMessage('SKIP_WAITING')")
    && index.includes("controllerchange")) {
    pass('sw-reload-toast');
  } else fail('sw-reload-toast', 'Reload toast / SKIP_WAITING missing');

  if (index.includes('function rebuildHolidayWeeks')
    && index.includes('companyHolidayWeeks')
    && index.includes('federalHolidayWeeks')) {
    pass('holiday-week-split');
  } else fail('holiday-week-split', 'federal vs company holiday maps missing');

  if (index.includes('function extraUnlockedClosesToStrip')
    && !/for \(let i = smTarget; i < closes\.length; i\+\+\)/.test(index)) {
    pass('sm-close-strip-helper');
  } else fail('sm-close-strip-helper', 'SM repair still indexes unlocked list as if locked were included');

  if (index.includes('function estimateCustomLabelHours')
    && index.includes('start<=7') === false
    && /aH >= 1 && aH <= 7 && bH >= 8/.test(index)) {
    pass('custom-hours-parser');
  } else fail('custom-hours-parser', '9-5 retail inference missing');

  if (index.includes('function fiscalYearLengthWeeks')
    && /p === 11 && fyWeeks >= 53/.test(index)) {
    pass('nrf-53-p12');
  } else fail('nrf-53-p12', 'P12 extra week missing');

  if (index.includes("rule: 'coverage-infeasible'")
    && index.includes('This team cannot cover Open and Close every day')) {
    pass('two-mgr-coverage-msg');
  } else fail('two-mgr-coverage-msg', 'coverage-infeasible message missing');

  const feats = (money.proFeatures || []).join('|').toLowerCase();
  if (buy.includes("proFeatures: ['unlimited schedule builds'")
    && feats.includes('unlimited schedule builds')
    && !buy.includes("proFeatures: ['unlimited managers'")) {
    pass('buy-profeatures');
  } else fail('buy-profeatures', 'buy DEFAULTS still says unlimited managers');

  if (!/android-twa\/twa-manifest\.json/.test(index)) {
    pass('no-play-apk-bump-in-index');
  }

  if (index.includes('function toHtmlTime') && index.includes('function fromHtmlTime')
    && /id="st-start-\$\{key\}"/.test(index) === false
    && index.includes('type="time"')
    && index.includes("id=\"st-start-${key}\"")) {
    pass('native-time-inputs');
  } else if (index.includes('type="time"') && index.includes('function toHtmlTime')) {
    pass('native-time-inputs');
  } else fail('native-time-inputs', 'type=time / toHtmlTime missing');

  if (index.includes('welcome-dismiss-x')
    && index.includes('id="btn-start-with-team"')
    && index.includes('id="btn-tour-sample"')
    && !/<button type="button" class="welcome-dismiss"/.test(index)) {
    pass('welcome-two-actions');
  } else fail('welcome-two-actions', 'welcome should be primary+sample, Dismiss as X');

  if (/offline-pill \.pill-text \{ display: inline; \}/.test(index)
    && !/\.offline-pill \.pill-text,\s*\n\s*\.local-status-pill \.pill-text \{ display: none; \}/.test(index)) {
    pass('offline-pill-keeps-text');
  } else fail('offline-pill-keeps-text', '900px still hides Works offline');
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

    scenario('hours-9-5', () => {
      const h = estimateShiftHours('custom:9-5');
      return { ok: h === 8, detail: String(h) };
    });
    scenario('hours-9a-5p', () => {
      const h = estimateShiftHours('custom:9a-5p');
      return { ok: h === 8, detail: String(h) };
    });
    scenario('hours-10-7', () => {
      const h = estimateShiftHours('custom:10-7');
      return { ok: h === 9, detail: String(h) };
    });
    scenario('hours-2-10', () => {
      const h = estimateShiftHours('custom:2-10');
      return { ok: h === 8, detail: String(h) };
    });
    scenario('hours-10a-6', () => {
      const h = estimateShiftHours('custom:10a-6');
      return { ok: h === 8, detail: String(h) };
    });
    scenario('hours-9-17', () => {
      const h = estimateShiftHours('custom:9:00-17:00');
      return { ok: h === 8, detail: String(h) };
    });
    scenario('hours-named-open-early', () => {
      const h = estimateShiftHours('open-early');
      return { ok: h === 10, detail: String(h) };
    });

    scenario('toHtmlTime-9a', () => {
      const v = toHtmlTime('9a');
      return { ok: v === '09:00', detail: String(v) };
    });
    scenario('fromHtmlTime-0900', () => {
      const v = fromHtmlTime('09:00');
      return { ok: v === '9a', detail: String(v) };
    });
    scenario('time-roundtrip-6p', () => {
      const html = toHtmlTime('6p');
      const back = fromHtmlTime(html);
      return { ok: html === '18:00' && back === '6p', detail: html + '→' + back };
    });
    scenario('time-roundtrip-1230p', () => {
      const html = toHtmlTime('12:30p');
      const back = fromHtmlTime(html);
      return { ok: html === '12:30' && back === '12:30p', detail: html + '→' + back };
    });
    scenario('time-roundtrip-12a', () => {
      const html = toHtmlTime('12a');
      const back = fromHtmlTime(html);
      return { ok: html === '00:00' && back === '12a', detail: html + '→' + back };
    });

    scenario('nrf-2028-53-p12', () => {
      const weeks = fiscalYearLengthWeeks(2028);
      const periods = getFiscalPeriods(2028);
      const p12 = periods[11];
      const sum = periods.reduce((n, p) => n + p.numWeeks, 0);
      return {
        ok: weeks === 53 && p12.numWeeks === 5 && sum === 53 && periods[0].numWeeks === 4,
        detail: `fyWeeks=${weeks} P12=${p12 && p12.numWeeks} sum=${sum}`
      };
    });
    scenario('nrf-2027-52-p12', () => {
      const weeks = fiscalYearLengthWeeks(2027);
      const periods = getFiscalPeriods(2027);
      const p12 = periods[11];
      const sum = periods.reduce((n, p) => n + p.numWeeks, 0);
      return {
        ok: weeks === 52 && p12.numWeeks === 4 && sum === 52,
        detail: `fyWeeks=${weeks} P12=${p12 && p12.numWeeks} sum=${sum}`
      };
    });

    scenario('holiday-uncheck-unshrinks', () => {
      const savedC = Object.assign({}, companyHolidayWeeks);
      const savedF = Object.assign({}, federalHolidayWeeks);
      const savedH = Object.assign({}, holidayWeeks);
      companyHolidayWeeks = { 0: true };
      federalHolidayWeeks = { 1: true };
      rebuildHolidayWeeks();
      const both = !!holidayWeeks[0] && !!holidayWeeks[1];
      delete federalHolidayWeeks[1];
      rebuildHolidayWeeks();
      const companyKept = !!holidayWeeks[0];
      const fedDropped = !holidayWeeks[1];
      toggleHolidayWeek(2, true);
      const companyOn = !!companyHolidayWeeks[2] && !!holidayWeeks[2];
      toggleHolidayWeek(2, false);
      const companyOff = !companyHolidayWeeks[2] && !holidayWeeks[2];
      companyHolidayWeeks = savedC;
      federalHolidayWeeks = savedF;
      holidayWeeks = savedH;
      return {
        ok: both && companyKept && fedDropped && companyOn && companyOff,
        detail: `both=${both} kept=${companyKept} dropped=${fedDropped} tick=${companyOn}/${companyOff}`
      };
    });

    scenario('sm-strip-1-locked-1-auto', () => {
      const stripped = extraUnlockedClosesToStrip(['auto'], 2, 1);
      return { ok: stripped.length === 1 && stripped[0] === 'auto', detail: JSON.stringify(stripped) };
    });
    scenario('sm-strip-never-locked', () => {
      const stripped = extraUnlockedClosesToStrip([], 2, 1);
      return { ok: stripped.length === 0, detail: JSON.stringify(stripped) };
    });
    scenario('sm-strip-from-end', () => {
      const stripped = extraUnlockedClosesToStrip(['a', 'b', 'c'], 4, 2);
      return { ok: stripped.join(',') === 'b,c', detail: JSON.stringify(stripped) };
    });

    scenario('two-mgr-one-message', () => {
      const prevKc = kcList;
      kcList = [{ id: 'kc1', name: 'Key Carrier 1', asManager: false, midDows: [] }];
      const roles = ['sm', 'am1'];
      const violations = [];
      for (let i = 0; i < 12; i++) {
        violations.push({ severity: 'error', rule: 'coverage-open', day: 'd' + i, detail: '1/1: No opener' });
        violations.push({ severity: 'error', rule: 'coverage-close', day: 'd' + i, detail: '1/1: No closer' });
      }
      const left = leftoverMustFixViolations(violations, roles);
      const infeas = left.filter((v) => v.rule === 'coverage-infeasible');
      const perDay = left.filter((v) => v.rule === 'coverage-open' || v.rule === 'coverage-close');
      kcList = prevKc;
      return {
        ok: infeas.length === 1 && perDay.length === 0 && /key carrier or a third manager/i.test(infeas[0].detail),
        detail: `infeas=${infeas.length} perDay=${perDay.length} leftover=${left.length}`
      };
    });

    scenario('three-plus-keeps-coverage-errors', () => {
      const roles = ['sm', 'am1', 'am2', 'am3'];
      const violations = [
        { severity: 'error', rule: 'coverage-open', day: 'd0', detail: '1/1: No opener' },
        { severity: 'error', rule: 'coverage-close', day: 'd0', detail: '1/1: No closer' }
      ];
      const left = leftoverMustFixViolations(violations, roles);
      const infeas = left.filter((v) => v.rule === 'coverage-infeasible');
      const perDay = left.filter((v) => v.rule === 'coverage-open' || v.rule === 'coverage-close');
      return {
        ok: infeas.length === 0 && perDay.length === 2,
        detail: `infeas=${infeas.length} perDay=${perDay.length}`
      };
    });

    return out;
  });

  for (const s of report.scenarios) {
    if (s.ok) pass(s.name, s.detail);
    else fail(s.name, s.detail);
  }
}

async function main() {
  console.log('\n=== v2.6.36 leftover integrity ===');
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
  if (failed.length) {
    failed.forEach((f) => console.log('  still failing:', f.name, f.detail));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
