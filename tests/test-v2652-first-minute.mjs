/**
 * v2.6.52 First minute — acceptance checks 1–11 plus App Expert addendum.
 * Run: node tests/test-v2652-first-minute.mjs
 * GA hosts are aborted. Each browser case uses a fresh context.
 */
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
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
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
};

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const PHONE = { width: 390, height: 844 };
const DESK = { width: 1280, height: 800 };

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      if (p === '/app') p = '/app/index.html';
      const file = join(ROOT, p.replace(/^\//, '').replace(/\//g, '\\').replace(/\\/g, '/'));
      const normalized = join(ROOT, p.replace(/^\//, ''));
      if (!normalized.startsWith(ROOT) || !existsSync(normalized) || !statSync(normalized).isFile()) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[extname(normalized)] || 'application/octet-stream' });
      res.end(readFileSync(normalized));
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
    join(ROOT, 'scripts/browser-ops/node_modules/playwright-core/index.mjs'),
    '/tmp/node_modules/playwright-core/index.mjs',
  ];
  for (const spec of candidates) {
    if (!existsSync(spec)) continue;
    const mod = await import(pathToFileURL(spec).href);
    if (mod.chromium) return mod.chromium;
  }
  throw new Error('Playwright not installed');
}

function launchOpts(extraArgs) {
  return {
    executablePath: existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'].concat(extraArgs || []),
  };
}

async function trackGtm(context) {
  const hits = [];
  context.on('request', (req) => {
    const u = req.url();
    if (/googletagmanager\.com|google-analytics\.com/i.test(u)) hits.push(u);
  });
  await context.route(/googletagmanager\.com|google-analytics\.com/i, (route) => route.abort());
  return hits;
}

async function newCase(browser, { viewport, userAgent, touch, init, screen, allowSw } = {}) {
  const context = await browser.newContext({
    viewport: viewport || DESK,
    userAgent: userAgent || DESKTOP_UA,
    hasTouch: !!touch,
    isMobile: !!touch,
    serviceWorkers: allowSw ? 'allow' : 'block',
  });
  const gtm = await trackGtm(context);
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const dialogs = [];
  page.on('dialog', async (d) => {
    dialogs.push(d.message());
    await d.dismiss();
  });
  if (screen) {
    const client = await context.newCDPSession(page);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: (viewport || DESK).width,
      height: (viewport || DESK).height,
      deviceScaleFactor: 1,
      mobile: !!touch,
      screenWidth: screen.w,
      screenHeight: screen.h,
    });
  }
  return { context, page, dialogs, gtm };
}

async function waitSample(page, timeout = 20000) {
  await page.waitForFunction(() => {
    const cells = document.querySelectorAll('#schedule-grid td.shift-editable, #schedule-grid td').length;
    const strip = document.getElementById('sample-strip');
    return document.body.classList.contains('sample-board') && cells > 20 && strip && !strip.hidden;
  }, { timeout });
}

function sampleProbe() {
  const vis = (id) => {
    const el = document.getElementById(id);
    if (!el) return false;
    if (el.hidden) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const row = document.querySelector('#schedule-grid tbody tr');
  const rr = row ? row.getBoundingClientRect() : null;
  const q = window._lastGenReport && window._lastGenReport.quality;
  const chip = document.getElementById('pgs-quality');
  return {
    cells: document.querySelectorAll('#schedule-grid td').length,
    strip: vis('sample-strip'),
    stripText: (document.getElementById('sample-strip-text') || {}).textContent || '',
    useMyTeam: vis('btn-use-my-team'),
    welcome: vis('welcome-card'),
    tour: vis('onboarding-tour'),
    install: !!(document.getElementById('install-banner') && document.getElementById('install-banner').classList.contains('show')),
    backup: vis('backup-nudge'),
    pro: vis('pro-gate-modal'),
    tab: typeof currentAppTab === 'string' ? currentAppTab : '',
    chipVisible: vis('post-gen-strip'),
    chipText: chip ? chip.textContent : '',
    score: q ? q.score : null,
    grade: q ? q.grade : '',
    mustFix: q ? q.mustFixCount : null,
    rowTop: rr ? rr.top : null,
    rowBottom: rr ? rr.bottom : null,
    ih: window.innerHeight,
    bodyTextHasNeeds: /Needs attention/i.test(document.body.innerText || ''),
    freeChip: ((document.getElementById('account-chip-plan') || {}).textContent || '').trim(),
    badge: ((document.getElementById('license-badge') || {}).textContent || '').trim(),
    sampleActive: localStorage.getItem('msb_sample_active'),
    genCount: localStorage.getItem('msb_free_generate_count') || '0',
  };
}

async function main() {
  console.log('\n=== v2.6.52 First minute ===');

  const version = JSON.parse(read('version.json'));
  const appHtml = read('app/index.html');
  const landing = read('index.html');
  const sw = read('sw.js');
  const twa = JSON.parse(read('android-twa/twa-manifest.json'));
  const gradle = read('android-twa/app/build.gradle');

  if (version.version === '2.6.52') pass('11-version-json', version.version);
  else fail('11-version-json', version.version);
  if (/APP_VERSION\s*=\s*'2\.6\.52'/.test(appHtml) && /id="app-version-label"[^>]*>\s*v2\.6\.52/.test(appHtml)) {
    pass('11-app-version');
  } else fail('11-app-version', 'APP_VERSION or label');
  if (sw.includes("const CACHE = 'msb-pro-v2.6.52'")) pass('11-sw-cache');
  else fail('11-sw-cache', 'cache name');
  if (twa.appVersion === '2.6.51' && twa.appVersionName === '2.6.51' && gradle.includes('versionCode 2651') && gradle.includes('versionName "2.6.51"')) {
    pass('11-twa-stays-2.6.51');
  } else fail('11-twa-stays-2.6.51', twa.appVersion + ' / ' + twa.appVersionName);

  if (landing.includes('>Build a free schedule — no signup<') && landing.includes('Works in Safari, no download') && landing.includes('$19.99') && landing.includes('Free to try · $19.99 one-time to unlock')) {
    pass('7-landing-copy');
  } else fail('7-landing-copy', 'hero, safari line, or price');
  if ((landing.match(/href="app\/"/g) || []).length >= 2 && !landing.includes('id="tab-setup"') && !landing.includes('generateSchedule')) {
    pass('7-landing-stays-marketing');
  } else fail('7-landing-stays-marketing');
  if (landing.includes('Name the team, load the NRF period') && landing.includes('Review before you post') && landing.includes('Print or export the board') && landing.includes('Free: 2 builds and 1 Word/Excel export')) {
    pass('7-feature-lines');
  } else fail('7-feature-lines');
  if (appHtml.includes('Free includes 2 builds and 1 Word/Excel export') && appHtml.includes('2 builds')) {
    pass('pro-gate-copy');
  } else fail('pro-gate-copy');

  const { chromium } = { chromium: await loadChromium() };
  const { server, base } = await startStaticServer();
  const browser = await chromium.launch(launchOpts());
  const browserHuman = await chromium.launch(launchOpts(['--disable-blink-features=AutomationControlled']));

  try {
    const warm = await newCase(browser, { viewport: DESK, userAgent: DESKTOP_UA });
    await warm.page.goto(base + '/app/?no_ga=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitSample(warm.page).catch(() => {});
    await warm.context.close();

    // --- 1 & 2 desktop + phone sample ---
    for (const spec of [
      { name: 'desk', viewport: DESK, userAgent: DESKTOP_UA, touch: false },
      { name: 'phone', viewport: PHONE, userAgent: IPHONE_UA, touch: true },
    ]) {
      const { context, page } = await newCase(browser, spec);
      const t0 = Date.now();
      await page.goto(base + '/app/?no_ga=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitSample(page);
      const ms = Date.now() - t0;
      const probe = await page.evaluate(sampleProbe);
      const fast = ms <= 3000;
      const clean = probe.strip && /Use my team/.test(await page.locator('#btn-use-my-team').innerText())
        && /Sample week/.test(probe.stripText)
        && !probe.welcome && !probe.tour && !probe.install && !probe.backup && !probe.pro
        && probe.tab === 'schedule' && probe.cells > 20;
      if (clean) pass('1-sample-board-' + spec.name, probe.cells + ' cells');
      else fail('1-sample-board-' + spec.name, JSON.stringify(probe));
      if (fast) pass('1-sample-within-3s-' + spec.name, ms + 'ms');
      else fail('1-sample-within-3s-' + spec.name, ms + 'ms');
      const gradeOk = !probe.chipVisible && !probe.bodyTextHasNeeds && probe.score != null && probe.score >= 70 && !(probe.mustFix > 0);
      if (gradeOk) pass('2-sample-not-red-' + spec.name, 'score ' + probe.score + ' ' + probe.grade);
      else fail('2-sample-not-red-' + spec.name, JSON.stringify({ score: probe.score, grade: probe.grade, mustFix: probe.mustFix, chip: probe.chipVisible, chipText: probe.chipText, needs: probe.bodyTextHasNeeds }));
      if (spec.name === 'phone') {
        const fold = probe.rowTop != null && probe.rowTop <= probe.ih * 0.45 && probe.rowBottom > 0 && probe.rowTop < probe.ih;
        if (fold) pass('1-phone-row-above-fold', 'top ' + Math.round(probe.rowTop) + ' / ' + probe.ih);
        else fail('1-phone-row-above-fold', JSON.stringify({ rowTop: probe.rowTop, rowBottom: probe.rowBottom, ih: probe.ih }));
      }
      if (!/Free\s*·\s*\d/.test(probe.freeChip) && probe.genCount === '0') pass('add-no-free-counter-on-sample-' + spec.name, probe.freeChip || '(empty)');
      else fail('add-no-free-counter-on-sample-' + spec.name, probe.freeChip + ' count=' + probe.genCount);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitSample(page);
      const again = await page.evaluate(sampleProbe);
      if (again.strip && again.cells > 20 && again.sampleActive === '1' && again.tab === 'schedule') {
        pass('3-reload-keeps-sample-' + spec.name, again.cells + ' cells');
      } else fail('3-reload-keeps-sample-' + spec.name, JSON.stringify(again));
      await context.close();
    }

    // --- 4 names step + first own build (phone) ---
    {
      const { context, page, dialogs } = await newCase(browser, { viewport: PHONE, userAgent: IPHONE_UA, touch: true });
      const t0 = Date.now();
      await page.goto(base + '/app/?no_ga=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitSample(page);
      await page.locator('#btn-use-my-team').click();
      await page.locator('#btn-build-from-setup').waitFor({ state: 'visible', timeout: 8000 });
      const namesStep = await page.evaluate(() => {
        const btn = document.getElementById('btn-build-from-setup');
        const sm = document.getElementById('name-sm');
        const am = document.getElementById('name-am1');
        const br = btn.getBoundingClientRect();
        const sr = sm.getBoundingClientRect();
        const ar = am.getBoundingClientRect();
        const chip = ((document.getElementById('account-chip-plan') || {}).textContent || '').trim();
        const period = ((document.getElementById('first-build-period') || {}).textContent || '').trim();
        return {
          label: (btn.textContent || '').trim(),
          btnBottom: br.bottom,
          btnTop: br.top,
          smTop: sr.top,
          amTop: ar.top,
          ih: window.innerHeight,
          tab: currentAppTab,
          chip,
          period,
          shift: ((document.getElementById('first-build-shift-line') || {}).textContent || ''),
          expected: (function () {
            const today = new Date();
            const found = findNrfPeriodForDate(today);
            if (!found || !found.period) return { error: 'no-period', today: today.toDateString() };
            let fy = found.fiscalYear;
            let idx = found.index;
            const startOf = startOfLocalDay;
            const left = Math.round((startOf(found.period.end) - startOf(today)) / 86400000) + 1;
            if (left < 7) {
              const periods = getFiscalPeriods(fy);
              if (idx + 1 < periods.length) idx += 1;
              else { fy += 1; idx = 0; }
            }
            const p = getFiscalPeriods(fy)[idx];
            return { fy, number: p.number, numWeeks: p.numWeeks, daysLeft: left };
          })(),
          liveFy: fiscalYear,
          liveN: currentPeriod && currentPeriod.number,
          liveWeeks: currentPeriod && currentPeriod.numWeeks,
        };
      });
      const above = namesStep.btnBottom <= namesStep.ih && namesStep.btnTop >= 0 && namesStep.smTop >= 0 && namesStep.smTop < namesStep.ih && namesStep.amTop < namesStep.ih;
      if (namesStep.tab === 'setup' && /Build my schedule/.test(namesStep.label) && above) {
        pass('4-names-step-above-fold', namesStep.label);
      } else fail('4-names-step-above-fold', JSON.stringify(namesStep));
      if (!/Free\s*·\s*\d/.test(namesStep.chip)) pass('4-no-free-n-before-build', namesStep.chip || '(empty)');
      else fail('4-no-free-n-before-build', namesStep.chip);
      if (namesStep.liveFy === namesStep.expected.fy && namesStep.liveN === namesStep.expected.number) {
        pass('4-smart-period', 'FY' + namesStep.liveFy + ' P' + namesStep.liveN + ' daysLeft=' + namesStep.expected.daysLeft);
      } else fail('4-smart-period', JSON.stringify(namesStep));

      await page.fill('#name-sm', 'Pat Nguyen');
      await page.fill('#name-am1', 'Chris Ortiz');
      await page.locator('#btn-build-from-setup').click();
      await page.waitForFunction(() => {
        const title = document.getElementById('first-build-ready-title');
        const cells = document.querySelectorAll('#schedule-grid td').length;
        return title && !document.getElementById('first-build-ready').hidden && /schedule is ready/i.test(title.textContent || '') && cells > 20;
      }, { timeout: 25000 });
      const elapsed = Date.now() - t0;
      const built = await page.evaluate(() => {
        const title = document.getElementById('first-build-ready-title');
        const line = document.getElementById('first-build-review-line');
        const ready = document.getElementById('first-build-ready');
        const rr = ready.getBoundingClientRect();
        const row = document.querySelector('#schedule-grid tbody tr');
        const rowR = row ? row.getBoundingClientRect() : null;
        const q = window._lastGenReport && window._lastGenReport.quality;
        return {
          title: title.textContent,
          weeks: currentPeriod && currentPeriod.numWeeks,
          line: line ? line.textContent : '',
          lineBad: line ? line.classList.contains('bad') : true,
          readyTop: rr.top,
          readyBottom: rr.bottom,
          rowTop: rowR ? rowR.top : null,
          ih: window.innerHeight,
          chip: ((document.getElementById('account-chip-plan') || {}).textContent || '').trim(),
          remaining: remainingFreeGenerates(),
          count: getFreeGenerateCount(),
          needs: /Needs attention/i.test((document.body.innerText || '')),
          score: q ? q.score : null,
          grade: q ? q.grade : '',
          mustFix: q ? q.mustFixCount : null,
          fy: fiscalYear,
          n: currentPeriod.number,
          sample: document.body.classList.contains('sample-board'),
          gap: (document.getElementById('first-build-gap') || {}).textContent || '',
          add: !document.getElementById('btn-add-person').hidden && document.getElementById('btn-add-person').getBoundingClientRect().height > 0,
        };
      });
      if (elapsed < 60000) pass('4-under-60s', elapsed + 'ms');
      else fail('4-under-60s', elapsed + 'ms');
      if (built.title === 'Your ' + built.weeks + '-week schedule is ready' && !built.lineBad && !built.needs && !built.sample && built.gap && built.add) {
        pass('4-ready-headline', built.title + ' | ' + built.line);
      } else fail('4-ready-headline', JSON.stringify(built));
      if (built.remaining === 2 && built.count === 0 && /Free · 2/.test(built.chip)) {
        pass('4-counter-reads-2', built.chip + ' remaining=' + built.remaining);
      } else fail('4-counter-reads-2', JSON.stringify({ chip: built.chip, remaining: built.remaining, count: built.count }));
      if (built.fy === namesStep.expected.fy && built.n === namesStep.expected.number) pass('4-built-period');
      else fail('4-built-period', JSON.stringify({ fy: built.fy, n: built.n, expected: namesStep.expected }));
      const scrolled = (built.readyTop >= 0 && built.readyTop < built.ih) || (built.rowTop != null && built.rowTop < built.ih && built.rowTop > -40);
      if (scrolled) pass('add-first-board-scrolled', 'readyTop ' + Math.round(built.readyTop));
      else fail('add-first-board-scrolled', JSON.stringify({ readyTop: built.readyTop, rowTop: built.rowTop, ih: built.ih }));

      // Print stays free, then first Word export, then second gates.
      await page.evaluate(() => {
        window.__printed = 0;
        window.print = () => { window.__printed += 1; };
      });
      await page.evaluate(() => printPostingSheet());
      const mustPrint = await page.evaluate(() => {
        const m = document.getElementById('mustfix-export-modal');
        return !!(m && !m.hasAttribute('hidden'));
      });
      if (mustPrint) await page.click('#mustfix-export-proceed');
      await page.waitForTimeout(250);
      const printed = await page.evaluate(() => ({
        n: window.__printed,
        pro: !document.getElementById('pro-gate-modal').hasAttribute('hidden'),
      }));
      if (printed.n >= 1 && !printed.pro) pass('6-print-free', 'printed ' + printed.n);
      else fail('6-print-free', JSON.stringify(printed));

      const dlWait = page.waitForEvent('download', { timeout: 20000 });
      await page.evaluate(() => exportSchedule());
      const mustWord = await page.evaluate(() => {
        const m = document.getElementById('mustfix-export-modal');
        return !!(m && !m.hasAttribute('hidden'));
      });
      if (mustWord) await page.click('#mustfix-export-proceed');
      let download = null;
      try { download = await dlWait; } catch (e) { download = null; }
      const afterFirst = await page.evaluate(() => ({
        used: localStorage.getItem('msb_free_export_used'),
        pro: !document.getElementById('pro-gate-modal').hasAttribute('hidden'),
      }));
      if (download && afterFirst.used === '1' && !afterFirst.pro) pass('6-first-word-free', download.suggestedFilename());
      else fail('6-first-word-free', JSON.stringify({ file: download && download.suggestedFilename(), afterFirst }));

      let secondFile = false;
      page.once('download', () => { secondFile = true; });
      await page.evaluate(() => exportSchedule());
      const must2 = await page.evaluate(() => {
        const m = document.getElementById('mustfix-export-modal');
        return !!(m && !m.hasAttribute('hidden'));
      });
      if (must2) await page.click('#mustfix-export-proceed');
      await page.waitForTimeout(400);
      const gated = await page.evaluate(() => {
        const g = document.getElementById('pro-gate-modal');
        const body = (document.getElementById('pro-gate-body') || {}).textContent || '';
        return { open: g && !g.hasAttribute('hidden'), body };
      });
      if (gated.open && /2 builds/.test(gated.body) && !secondFile) pass('6-second-word-gated');
      else fail('6-second-word-gated', JSON.stringify({ gated, secondFile }));

      // 5 — same profile reloads onto the user board; ?demo=1 does not replace it
      await page.goto(base + '/app/?no_ga=1', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => {
        const sm = (document.getElementById('name-sm') || {}).value || '';
        return /Pat Nguyen/.test(sm) && document.querySelectorAll('#schedule-grid td').length > 20;
      }, { timeout: 15000 });
      const returned = await page.evaluate(() => ({
        sm: document.getElementById('name-sm').value,
        sample: document.body.classList.contains('sample-board'),
        strip: !document.getElementById('sample-strip').hidden,
        active: localStorage.getItem('msb_sample_active'),
        store: (document.getElementById('store-name') || {}).value || '',
      }));
      if (/Pat Nguyen/.test(returned.sm) && !returned.sample && !returned.strip && returned.active !== '1' && !/harbor east/i.test(returned.store)) {
        pass('5-returning-user-board', returned.sm);
      } else fail('5-returning-user-board', JSON.stringify(returned));

      dialogs.length = 0;
      await page.goto(base + '/app/?demo=1&no_ga=1', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);
      const demo = await page.evaluate(() => ({
        sm: (document.getElementById('name-sm') || {}).value || '',
        stored: localStorage.getItem('schedule_manager_names') || '',
        sample: document.body.classList.contains('sample-board'),
        href: location.href,
      }));
      if (!dialogs.length && /Pat Nguyen/.test(demo.sm) && /Pat Nguyen/.test(demo.stored) && !demo.sample && !/[?&]demo=1/.test(demo.href)) {
        pass('5-demo-param-keeps-roster');
      } else fail('5-demo-param-keeps-roster', JSON.stringify({ demo, dialogs }));
      await context.close();
    }

    // --- addendum: sample preview after typing names does not overwrite ---
    {
      const { context, page, dialogs } = await newCase(browser, { viewport: PHONE, userAgent: IPHONE_UA, touch: true });
      await page.goto(base + '/app/?no_ga=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitSample(page);
      await page.locator('#btn-use-my-team').click();
      await page.locator('#name-sm').waitFor({ state: 'visible', timeout: 8000 });
      await page.fill('#name-sm', 'Pat Nguyen');
      await page.fill('#name-am1', 'Chris Ortiz');
      await page.locator('#name-sm').blur();
      dialogs.length = 0;
      await page.locator('#header-more-btn').click();
      await page.locator('#header-menu-demo').click();
      await page.waitForFunction(() => {
        const btn = document.getElementById('btn-use-my-team');
        return document.body.classList.contains('sample-board') && btn && /Back to my names/.test(btn.textContent || '');
      }, { timeout: 20000 });
      const preview = await page.evaluate(() => ({
        store: document.getElementById('store-name').value,
        liveSm: document.getElementById('name-sm').value,
        stored: localStorage.getItem('schedule_manager_names') || '',
        btn: (document.getElementById('btn-use-my-team') || {}).textContent || '',
        active: localStorage.getItem('msb_sample_active'),
      }));
      if (!dialogs.length && /harbor/i.test(preview.store) && /Pat Nguyen/.test(preview.stored) && /Back to my names/.test(preview.btn)) {
        pass('add-sample-preview-no-overwrite', preview.btn);
      } else fail('add-sample-preview-no-overwrite', JSON.stringify({ preview, dialogs }));
      await page.locator('#btn-use-my-team').click();
      await page.waitForFunction(() => /Pat Nguyen/.test((document.getElementById('name-sm') || {}).value || ''), { timeout: 8000 });
      const back = await page.evaluate(() => ({
        sm: document.getElementById('name-sm').value,
        am: document.getElementById('name-am1').value,
        stored: localStorage.getItem('schedule_manager_names') || '',
      }));
      if (/Pat Nguyen/.test(back.sm) && /Chris Ortiz/.test(back.am) && /Pat Nguyen/.test(back.stored)) {
        pass('add-back-to-my-names', back.sm);
      } else fail('add-back-to-my-names', JSON.stringify(back));
      await context.close();
    }

    // --- 7 landing fold ---
    for (const spec of [
      { name: 'iphone', viewport: PHONE, userAgent: IPHONE_UA, touch: true, ios: true },
      { name: 'android', viewport: PHONE, userAgent: ANDROID_UA, touch: true, ios: false },
      { name: 'desk', viewport: DESK, userAgent: DESKTOP_UA, touch: false, ios: false },
    ]) {
      const { context, page } = await newCase(browser, spec);
      await page.goto(base + '/?no_ga=1', { waitUntil: 'domcontentloaded' });
      const hero = await page.evaluate(() => {
        const a = document.querySelector('a.hero-cta');
        const price = document.querySelector('.price-row');
        const note = document.getElementById('ios-safari-note');
        const play = document.querySelector('[data-cta="play"]');
        const ar = a.getBoundingClientRect();
        const pr = price.getBoundingClientRect();
        const pcs = play ? getComputedStyle(play) : null;
        const ncs = note ? getComputedStyle(note) : null;
        return {
          text: (a.textContent || '').trim(),
          href: a.getAttribute('href'),
          btnBottom: ar.bottom,
          btnTop: ar.top,
          priceTop: pr.top,
          ih: window.innerHeight,
          noteHidden: !note || note.hidden || (ncs && ncs.display === 'none'),
          noteText: note ? note.textContent.trim() : '',
          playHidden: !play || play.hidden || (pcs && (pcs.display === 'none' || pcs.visibility === 'hidden')),
        };
      });
      const fold = hero.text === 'Build a free schedule — no signup' && hero.href === 'app/' && hero.btnTop >= 0 && hero.btnBottom <= hero.ih && hero.priceTop > hero.btnBottom;
      if (fold) pass('7-hero-above-fold-' + spec.name);
      else fail('7-hero-above-fold-' + spec.name, JSON.stringify(hero));
      if (spec.ios) {
        if (hero.playHidden && !hero.noteHidden && hero.noteText === 'Works in Safari, no download') pass('7-ios-safari-line');
        else fail('7-ios-safari-line', JSON.stringify(hero));
      } else if (!hero.playHidden && hero.noteHidden) pass('7-play-secondary-' + spec.name);
      else fail('7-play-secondary-' + spec.name, JSON.stringify(hero));
      await context.close();
    }

    // --- 8 GA guard ---
    {
      const off = await newCase(browser, { viewport: DESK, userAgent: DESKTOP_UA });
      await off.page.goto(base + '/app/', { waitUntil: 'domcontentloaded' });
      await off.page.waitForTimeout(400);
      const webdriverOff = await off.page.evaluate(() => ({
        webdriver: navigator.webdriver,
        gtag: typeof gtag,
        ua: navigator.userAgent,
      }));
      if (webdriverOff.webdriver === true && webdriverOff.gtag === 'undefined' && off.gtm.length === 0) {
        pass('8-webdriver-skips-gtag');
      } else fail('8-webdriver-skips-gtag', JSON.stringify({ webdriverOff, gtm: off.gtm.length }));
      await off.context.close();

      const headless = await newCase(browserHuman, {
        viewport: DESK,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/122.0.0.0 Safari/537.36',
        init: () => { Object.defineProperty(navigator, 'webdriver', { configurable: true, get: () => false }); },
      });
      await headless.page.goto(base + '/', { waitUntil: 'domcontentloaded' });
      await headless.page.waitForTimeout(300);
      const h = await headless.page.evaluate(() => ({ webdriver: navigator.webdriver, gtag: typeof gtag }));
      if (h.gtag === 'undefined' && headless.gtm.length === 0) pass('8-headless-ua-skips-gtag', 'webdriver=' + h.webdriver);
      else fail('8-headless-ua-skips-gtag', JSON.stringify({ h, gtm: headless.gtm.length }));
      await headless.context.close();

      const opted = await newCase(browserHuman, {
        viewport: DESK,
        userAgent: DESKTOP_UA,
        init: () => { Object.defineProperty(navigator, 'webdriver', { configurable: true, get: () => false }); },
        screen: { w: 1600, h: 1200 },
      });
      await opted.page.goto(base + '/?no_ga=1', { waitUntil: 'domcontentloaded' });
      const o1 = await opted.page.evaluate(() => ({ gtag: typeof gtag, flag: localStorage.getItem('msp_no_ga') }));
      await opted.page.goto(base + '/', { waitUntil: 'domcontentloaded' });
      const o2 = await opted.page.evaluate(() => ({ gtag: typeof gtag, flag: localStorage.getItem('msp_no_ga') }));
      if (o1.gtag === 'undefined' && o1.flag === '1' && o2.gtag === 'undefined' && o2.flag === '1' && opted.gtm.length === 0) {
        pass('8-no-ga-persists');
      } else fail('8-no-ga-persists', JSON.stringify({ o1, o2, gtm: opted.gtm.length }));
      await opted.context.close();

      const onSmall = await newCase(browserHuman, {
        viewport: DESK,
        userAgent: DESKTOP_UA,
        init: () => {
          Object.defineProperty(navigator, 'webdriver', { configurable: true, get: () => false });
          window.dataLayer = window.dataLayer || [];
          window.__ga = [];
          const raw = window.dataLayer.push.bind(window.dataLayer);
          window.dataLayer.push = function (item) {
            try { window.__ga.push(Array.from(item || [])); } catch (e) {}
            return raw(item);
          };
        },
        screen: { w: 800, h: 600 },
      });
      await onSmall.page.goto(base + '/', { waitUntil: 'domcontentloaded' });
      await onSmall.page.waitForTimeout(400);
      const small = await onSmall.page.evaluate(() => ({
        gtag: typeof gtag,
        screen: { w: screen.width, h: screen.height },
        webdriver: navigator.webdriver,
        ga: window.__ga || [],
      }));
      const suspect = (small.ga || []).some((row) => row[0] === 'set' && row[1] && row[1].traffic_type === 'bot_suspect');
      const landingView = (small.ga || []).some((row) => row[0] === 'event' && row[1] === 'landing_view');
      if (small.gtag === 'function' && small.screen.w === 800 && small.screen.h === 600 && suspect && landingView) {
        pass('8-bot-suspect-800x600');
      } else fail('8-bot-suspect-800x600', JSON.stringify(small));
      await onSmall.context.close();

      const onBig = await newCase(browserHuman, {
        viewport: DESK,
        userAgent: DESKTOP_UA,
        init: () => {
          Object.defineProperty(navigator, 'webdriver', { configurable: true, get: () => false });
          window.dataLayer = window.dataLayer || [];
          window.__ga = [];
          const raw = window.dataLayer.push.bind(window.dataLayer);
          window.dataLayer.push = function (item) {
            try { window.__ga.push(Array.from(item || [])); } catch (e) {}
            return raw(item);
          };
        },
        screen: { w: 1600, h: 1200 },
      });
      await onBig.page.goto(base + '/app/', { waitUntil: 'domcontentloaded' });
      await onBig.page.waitForTimeout(500);
      const big = await onBig.page.evaluate(() => ({
        gtag: typeof gtag,
        screen: { w: screen.width, h: screen.height },
        ga: window.__ga || [],
      }));
      const bigSuspect = (big.ga || []).some((row) => row[0] === 'set' && row[1] && row[1].traffic_type === 'bot_suspect');
      const appView = (big.ga || []).some((row) => row[0] === 'event' && row[1] === 'app_view');
      if (big.gtag === 'function' && big.screen.w === 1600 && !bigSuspect && appView) pass('8-1600-no-suspect');
      else fail('8-1600-no-suspect', JSON.stringify(big));
      await onBig.context.close();
    }

    // --- 9 events ---
    {
      const { context, page } = await newCase(browserHuman, {
        viewport: PHONE,
        userAgent: DESKTOP_UA,
        touch: true,
        screen: { w: 1600, h: 1200 },
        init: () => {
          Object.defineProperty(navigator, 'webdriver', { configurable: true, get: () => false });
          window.dataLayer = window.dataLayer || [];
          window.__ga = [];
          const raw = window.dataLayer.push.bind(window.dataLayer);
          window.dataLayer.push = function (item) {
            try { window.__ga.push(Array.from(item || [])); } catch (e) {}
            return raw(item);
          };
        },
      });
      await page.goto(base + '/app/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitSample(page);
      await page.waitForTimeout(300);
      const afterSample = await page.evaluate(() => window.__ga || []);
      const events = (rows) => rows.filter((r) => r[0] === 'event').map((r) => ({ name: r[1], p: r[2] || {} }));
      const ev1 = events(afterSample);
      const sampleEv = ev1.find((e) => e.name === 'sample_loaded');
      const buildBeforeTeam = ev1.some((e) => e.name === 'build_click');
      if (ev1.some((e) => e.name === 'app_view') && sampleEv && sampleEv.p.surface === 'auto' && sampleEv.p.result === 'success' && !buildBeforeTeam) {
        pass('9-sample-loaded-no-build-click', JSON.stringify(sampleEv.p));
      } else fail('9-sample-loaded-no-build-click', JSON.stringify(ev1));

      await page.evaluate(() => {
        try {
          let state = 'visible';
          Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get: () => state });
          window.__setVis = (s) => { state = s; document.dispatchEvent(new Event('visibilitychange')); };
        } catch (e) { window.__setVis = null; }
      });
      const canVis = await page.evaluate(() => typeof window.__setVis === 'function');
      if (canVis) await page.evaluate(() => window.__setVis('hidden'));
      else {
        const page2 = await context.newPage();
        await page2.goto('about:blank');
      }
      await page.waitForTimeout(200);
      const hide1 = events(await page.evaluate(() => window.__ga || [])).filter((e) => e.name === 'app_hide');
      if (hide1.length && hide1[hide1.length - 1].p.last_surface === 'sample') pass('9-hide-sample', hide1[hide1.length - 1].p.last_surface);
      else fail('9-hide-sample', JSON.stringify(hide1));
      if (canVis) await page.evaluate(() => window.__setVis('visible'));
      else await page.bringToFront();

      await page.locator('#btn-use-my-team').click();
      await page.locator('#name-sm').waitFor({ state: 'visible' });
      await page.fill('#name-sm', 'Pat Nguyen');
      await page.fill('#name-am1', 'Chris Ortiz');
      await page.locator('#btn-build-from-setup').click();
      await page.waitForFunction(() => (window.__ga || []).some((r) => r[0] === 'event' && r[1] === 'first_build'), { timeout: 25000 });
      const ev2 = events(await page.evaluate(() => window.__ga || []));
      const iTeam = ev2.findIndex((e) => e.name === 'team_start');
      const iClick = ev2.findIndex((e) => e.name === 'build_click');
      const iResult = ev2.findIndex((e) => e.name === 'build_result');
      const iFirst = ev2.findIndex((e) => e.name === 'first_build');
      const orderOk = iTeam >= 0 && iClick > iTeam && iResult > iClick && iFirst > iResult
        && ev2[iTeam].p.surface === 'sample_strip'
        && ev2[iClick].p.surface === 'setup'
        && ev2[iResult].p.result === 'success'
        && ev2[iFirst].p.result === 'success';
      const blob = JSON.stringify(ev2);
      const leaked = /Pat Nguyen|Chris Ortiz/.test(blob);
      if (orderOk && !leaked) pass('9-build-events');
      else fail('9-build-events', JSON.stringify({ orderOk, leaked, ev2 }));

      await page.evaluate(() => { if (typeof switchTab === 'function') switchTab('rules'); });
      if (canVis) await page.evaluate(() => window.__setVis('hidden'));
      else {
        const pages = context.pages();
        const other = pages.find((p) => p !== page) || await context.newPage();
        await other.goto('about:blank');
      }
      await page.waitForTimeout(250);
      const hide2 = events(await page.evaluate(() => window.__ga || [])).filter((e) => e.name === 'app_hide');
      const lastHide = hide2[hide2.length - 1];
      if (lastHide && lastHide.p.last_surface === 'rules') pass('9-hide-rules');
      else fail('9-hide-rules', JSON.stringify(hide2));
      await context.close();
    }

    // --- 10 offline ---
    {
      const { context, page } = await newCase(browser, { viewport: DESK, userAgent: DESKTOP_UA, allowSw: true });
      await page.goto(base + '/app/?no_ga=1', { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, { timeout: 20000 });
      await page.waitForTimeout(1200);
      await waitSample(page);
      await context.setOffline(true);
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
      await new Promise((resolve) => server.close(() => resolve()));
      let reloadErr = '';
      try {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
        await waitSample(page);
      } catch (e) {
        reloadErr = String(e && e.message || e);
      }
      const off = reloadErr ? { reloadErr } : await page.evaluate(async () => {
        let net = 'blocked';
        try {
          const res = await fetch('/offline-probe-' + Date.now(), { cache: 'no-store' });
          net = 'status ' + res.status;
        } catch (e) { net = 'blocked'; }
        return {
          online: navigator.onLine,
          net,
          cells: document.querySelectorAll('#schedule-grid td').length,
          sample: document.body.classList.contains('sample-board'),
          strip: !document.getElementById('sample-strip').hidden,
        };
      });
      if (!reloadErr && off.net === 'blocked' && off.sample && off.strip && off.cells > 20) {
        pass('10-offline-sample', off.cells + ' cells');
      } else fail('10-offline-sample', JSON.stringify(off));
      await context.close();
    }
  } finally {
    await browser.close();
    await browserHuman.close();
    server.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed');
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
