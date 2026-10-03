/**
 * v2.6.53 Second minute — acceptance checks 1–11 plus the item-12 file updates.
 * Run: node tests/test-v2653-second-minute.mjs
 * GA hosts are aborted. Each browser case uses a fresh context.
 * Do not launch this during a GPU measurement on the same PC.
 */
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
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
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const PHONE = { width: 390, height: 844 };
const DESK = { width: 1280, height: 800 };
const TINY = { width: 320, height: 568 };

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      if (p === '/app') p = '/app/index.html';
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
    const cells = document.querySelectorAll('#schedule-grid td, #schedule-grid .mw-person').length;
    const strip = document.getElementById('sample-strip');
    return document.body.classList.contains('sample-board') && cells > 20 && strip && !strip.hidden;
  }, { timeout });
}

async function waitReady(page, timeout = 25000) {
  await page.waitForFunction(() => {
    const title = document.getElementById('first-build-ready-title');
    const box = document.getElementById('first-build-ready');
    const cells = document.querySelectorAll('#schedule-grid td, #schedule-grid .mw-person').length;
    return title && box && !box.hidden && (title.textContent || '').trim() && cells > 20;
  }, { timeout });
}

function hitVisible(id) {
  const el = document.getElementById(id);
  if (!el || el.hidden) return { ok: false, why: 'missing' };
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return { ok: false, why: 'zero', top: r.top, bottom: r.bottom };
  if (r.top < 0 || r.bottom > window.innerHeight) return { ok: false, why: 'offscreen', top: Math.round(r.top), bottom: Math.round(r.bottom), ih: window.innerHeight };
  const x = Math.min(window.innerWidth - 2, Math.max(2, r.left + Math.min(24, r.width / 2)));
  const y = Math.min(window.innerHeight - 2, Math.max(2, r.top + Math.min(12, r.height / 2)));
  const top = document.elementFromPoint(x, y);
  const ok = !!(top && (top === el || el.contains(top)));
  return { ok, why: ok ? 'hit' : ((top && top.id) || (top && top.className) || 'none'), top: Math.round(r.top) };
}

function inPage(body) {
  return new Function(hitVisible.toString() + '\n' + qualitySnap.toString() + '\n' + body);
}

function qualitySnap() {
  const q = window._lastGenReport && window._lastGenReport.quality;
  const st = typeof computeCoverageAndFairnessStats === 'function' ? computeCoverageAndFairnessStats() : null;
  const chip = typeof formatAmCloseChip === 'function' ? formatAmCloseChip(st) : null;
  const title = ((document.getElementById('first-build-ready-title') || {}).textContent || '').trim();
  return {
    weeks: currentPeriod && currentPeriod.numWeeks,
    n: currentPeriod && currentPeriod.number,
    fy: typeof fiscalYear !== 'undefined' ? fiscalYear : null,
    score: q ? q.score : null,
    grade: q ? q.grade : '',
    mustFix: q ? q.mustFixCount : null,
    miss: st ? st.missDays : null,
    title,
    collapsed: document.body.classList.contains('chips-collapsed'),
    count: typeof getFreeGenerateCount === 'function' ? getFreeGenerateCount() : null,
    remaining: typeof remainingFreeGenerates === 'function' ? remainingFreeGenerates() : null,
    chip: ((document.getElementById('account-chip-plan') || {}).textContent || '').trim(),
    amText: chip ? chip.text : '',
    amCls: chip ? chip.cls : '',
    amTitle: chip ? chip.title : '',
    needs: /Needs attention/i.test(document.body.innerText || ''),
    slashGoal: /AM closes[^\\n]{0,40}\/\s*\d+/.test(document.body.innerText || ''),
    badChip: !!document.querySelector('#pgs-am-close.bad, .pgs-chip.bad'),
    windowOpen: typeof firstRunWindowOpen === 'function' ? firstRunWindowOpen() : null,
    roles: typeof getRoles === 'function' ? getRoles().length : 0,
    unmet: (window._lastGenReport && window._lastGenReport.unmet) ? window._lastGenReport.unmet.slice(0, 12) : [],
    hard: window._lastGenReport ? window._lastGenReport.hardErrorCount : null,
  };
}

async function useMyTeam(page) {
  await page.locator('#btn-use-my-team').click();
  await page.locator('#name-sm').waitFor({ state: 'visible', timeout: 8000 });
}

async function main() {
  console.log('\n=== v2.6.53 Second minute ===');

  const version = JSON.parse(read('version.json'));
  const appHtml = read('app/index.html');
  const landing = read('index.html');
  const sw = read('sw.js');
  const twa = JSON.parse(read('android-twa/twa-manifest.json'));
  const gradle = read('android-twa/app/build.gradle');

  if (version.version === '2.6.53') pass('11-version-json', version.version);
  else fail('11-version-json', version.version);
  if (/APP_VERSION\s*=\s*'2\.6\.53'/.test(appHtml) && /id="app-version-label"[^>]*>\s*v2\.6\.53/.test(appHtml)) {
    pass('11-app-version');
  } else fail('11-app-version', 'APP_VERSION or label');
  if (sw.includes("const CACHE = 'msb-pro-v2.6.53'")) pass('11-sw-cache');
  else fail('11-sw-cache', 'cache name');
  if (twa.appVersion === '2.6.51' && twa.appVersionName === '2.6.51' && gradle.includes('versionCode 2651') && gradle.includes('versionName "2.6.51"')) {
    pass('11-twa-stays');
  } else fail('11-twa-stays', twa.appVersion + ' / ' + twa.appVersionName);

  const dash = '\u2014';
  const mid = '\u00b7';
  const enDash = '\u2013';
  const welcomeKey = 'Build your schedule ' + dash + ' free, no signup';
  const chipKey = 'AM closes {range} ' + mid + ' goal {goal}';
  const esChip = 'Cierres AM {range} ' + mid + ' meta {goal}';
  if (appHtml.includes(welcomeKey) && appHtml.includes(chipKey) && appHtml.includes(esChip) && appHtml.includes("\\u00b7 goal {goal}") && appHtml.includes("'\\u2013'")) {
    pass('11-dashes', 'em dash, middle dot, en dash');
  } else fail('11-dashes', 'welcome or chip punctuation mismatch');
  const esKeys = [
    'Huecos cubiertos: ya hay apertura y cierre todos los días',
    'Aún faltan {n} días sin apertura o cierre. Agrega una persona más o toca un turno.',
    'Cada asistente cierra {range} veces en este período; lo justo es unas {goal}.',
    'Lista por día',
    'Cuadrícula',
    "'W{n}': 'S{n}'",
    'Arma tu horario ' + dash + ' gratis, sin registro',
  ];
  const missingEs = esKeys.filter((k) => !appHtml.includes(k));
  if (!missingEs.length && appHtml.includes("'How it works': 'Cómo funciona'")) pass('11-es-keys');
  else fail('11-es-keys', missingEs.join(' | ') || 'How it works');

  const testFiles = readdirSync(join(ROOT, 'tests')).filter((f) => f.endsWith('.mjs'));
  const oldPlain = '2.6.5' + '2';
  const oldEsc = '2\\' + '.6\\' + '.52';
  const stale = [];
  for (const f of testFiles) {
    const text = readFileSync(join(ROOT, 'tests', f), 'utf8');
    if (text.includes(oldPlain) || text.includes(oldEsc)) stale.push(f);
  }
  const v52 = read('tests/test-v2652-first-minute.mjs');
  const v36 = read('tests/test-v2636-phone.mjs');
  const v35 = read('tests/test-v2635-leftover.mjs');
  const v27 = read('tests/test-v2627-ux.mjs');
  const item12 = !stale.length
    && v52.includes('4-window-hides-counter')
    && v52.includes("#schedule-grid td, #schedule-grid .mw-person")
    && v52.includes("#schedule-grid .mw-day")
    && v36.includes('welcome-compact')
    && v36.includes('how it works')
    && v35.includes("schedule.sm[dk] = 'open-late'")
    && v35.includes('new Date(2026, 9, 4 + i)')
    && v27.includes('toastNodes[toastNodes.length - 1]');
  if (item12) pass('12-test-updates', testFiles.length + ' files');
  else fail('12-test-updates', stale.join(', ') || 'marker missing');

  if (landing.includes('NRF 4-5-4') && appHtml.includes('id="nrf-us-law-note"') && appHtml.includes('NRF 4-5-4')) {
    pass('8-nrf-named-in-source');
  } else fail('8-nrf-named-in-source');

  const { chromium } = { chromium: await loadChromium() };
  const { server, base } = await startStaticServer();
  const browser = await chromium.launch(launchOpts());
  const browserHuman = await chromium.launch(launchOpts(['--disable-blink-features=AutomationControlled']));

  try {
    // --- 1 sample, desk keeps the grid, phone defaults to the day list ---
    for (const spec of [
      { name: 'desk', viewport: DESK, userAgent: DESKTOP_UA, touch: false },
      { name: 'phone', viewport: PHONE, userAgent: IPHONE_UA, touch: true },
    ]) {
      const { context, page } = await newCase(browser, spec);
      const t0 = Date.now();
      await page.goto(base + '/app/?no_ga=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitSample(page);
      const ms = Date.now() - t0;
      const probe = await page.evaluate(() => {
        const grid = document.getElementById('schedule-grid');
        const vw = window.innerWidth;
        let wide = 0;
        if (grid) {
          grid.querySelectorAll('*').forEach((el) => {
            const w = el.getBoundingClientRect().width;
            if (w > vw + 1) wide++;
          });
        }
        const sw = document.getElementById('phone-week-switcher');
        const swCs = sw ? getComputedStyle(sw) : null;
        const head = document.querySelector('#schedule-grid .mw-day-head');
        return {
          mode: typeof scheduleViewMode === 'string' ? scheduleViewMode : '',
          days: document.querySelectorAll('#schedule-grid .mw-day').length,
          tds: document.querySelectorAll('#schedule-grid td').length,
          people: document.querySelectorAll('#schedule-grid .mw-person').length,
          scrollW: document.documentElement.scrollWidth,
          innerW: window.innerWidth,
          wide,
          sample: document.body.classList.contains('sample-board'),
          strip: !!(document.getElementById('sample-strip') && !document.getElementById('sample-strip').hidden),
          backup: !!(document.getElementById('backup-nudge') && !document.getElementById('backup-nudge').hidden && getComputedStyle(document.getElementById('backup-nudge')).display !== 'none'),
          switcher: !!(sw && !sw.hidden && swCs && swCs.display !== 'none'),
          sticky: swCs ? swCs.position : '',
          weeks: sw ? sw.querySelectorAll('.pws-week').length : 0,
          head: head ? (head.textContent || '').replace(/\s+/g, ' ').trim() : '',
          userFlag: localStorage.getItem('msb_schedule_view_user'),
        };
      });
      if (ms <= 3000 && probe.sample && probe.strip) pass('1-sample-3s-' + spec.name, ms + 'ms');
      else fail('1-sample-3s-' + spec.name, JSON.stringify(probe));
      if (spec.name === 'desk' && probe.mode === 'week' && probe.tds > 20) pass('1-desk-grid', probe.tds + ' cells');
      else if (spec.name === 'desk') fail('1-desk-grid', JSON.stringify(probe));
      if (spec.name === 'phone') {
        const headOk = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s*\d{1,2}\/\d{1,2}/.test(probe.head);
        if (probe.mode === 'day' && probe.days > 0 && probe.people > 20 && probe.scrollW === probe.innerW && probe.wide === 0 && headOk && !probe.userFlag) {
          pass('1-phone-day-list', probe.days + ' days ' + probe.head);
        } else fail('1-phone-day-list', JSON.stringify(probe));
        if (probe.switcher && probe.sticky === 'sticky' && probe.weeks >= 2) pass('1-phone-switcher', probe.weeks + ' weeks');
        else fail('1-phone-switcher', JSON.stringify(probe));
        await page.locator('#phone-week-switcher .pws-week').nth(1).click();
        await page.waitForFunction(() => {
          const el = document.getElementById('week-wrap-1');
          if (!el) return false;
          const t = el.getBoundingClientRect().top;
          return t < 220 && t > -40;
        }, { timeout: 4000 }).then(() => pass('1-w2-scrolls')).catch(() => fail('1-w2-scrolls', 'week 2 did not reach the top'));
        await page.locator('#phone-week-switcher .pws-toggle').click();
        await page.waitForFunction(() => scheduleViewMode === 'week' && document.querySelectorAll('#schedule-grid td').length > 20, { timeout: 8000 });
        const gridLabel = await page.locator('#phone-week-switcher .pws-toggle').innerText();
        await page.locator('#phone-week-switcher .pws-toggle').click();
        await page.waitForFunction(() => scheduleViewMode === 'day' && document.querySelectorAll('#schedule-grid .mw-day').length > 0, { timeout: 8000 });
        const flag = await page.evaluate(() => localStorage.getItem('msb_schedule_view_user'));
        if (/Day list/i.test(gridLabel) && flag === '1') pass('1-grid-day-toggle', gridLabel);
        else fail('1-grid-day-toggle', gridLabel + ' flag=' + flag);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitSample(page);
        const kept = await page.evaluate(() => ({
          mode: scheduleViewMode,
          flag: localStorage.getItem('msb_schedule_view_user'),
          days: document.querySelectorAll('#schedule-grid .mw-day').length,
        }));
        if (kept.mode === 'day' && kept.flag === '1' && kept.days > 0) pass('1-view-persists', kept.mode);
        else fail('1-view-persists', JSON.stringify(kept));
      }
      if (!probe.backup) pass('6-no-nudge-on-sample-' + spec.name);
      else fail('6-no-nudge-on-sample-' + spec.name);
      await context.close();
    }

    // --- 4 unit targets + typed lock, on a loaded sample ---
    {
      const { context, page } = await newCase(browser, { viewport: DESK, userAgent: DESKTOP_UA });
      await page.goto(base + '/app/?no_ga=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitSample(page);
      const math = await page.evaluate(() => {
        const nights = 7;
        const sm = getSmClosesPerWeekTarget({}, nights, false);
        const rem = nights - sm;
        const weeks = [];
        let sumOk = true;
        for (let w = 0; w < 4; w++) {
          const a = getAmClosesPerWeekTarget({}, rem, 2, 0, w);
          const b = getAmClosesPerWeekTarget({}, rem, 2, 1, w);
          const capA = scheduledWorkDayCap(closerRoleAt(0), w);
          const capB = scheduledWorkDayCap(closerRoleAt(1), w);
          const expectA = Math.min(3, capA);
          const expectB = Math.min(3, capB);
          if (a !== expectA || b !== expectB) sumOk = false;
          if (capA >= 3 && capB >= 3 && (sm + a + b) < nights) sumOk = false;
          weeks.push({ w, a, b, capA, capB, sum: sm + a + b });
        }
        const thinCap = scheduledWorkDayCap(closerRoleAt(0), 0);
        const thinAm = getAmClosesPerWeekTarget({}, 6, 1, 0, 0);
        const even = getEvenCloseShare(7, 4, 0, 0);
        const evenSm2 = shouldEvenSmAmCloses({}, ['sm', 'am1', 'am2']);
        const evenSm3 = shouldEvenSmAmCloses({}, ['sm', 'am1', 'am2', 'am3']);
        const before = window._lastGenReport ? window._lastGenReport.mustFixCount : null;
        const prevPref = preferences.amClosesPerWeek;
        const snap = JSON.parse(JSON.stringify(schedule));
        const roles = getRoles();
        const am = roles.filter((r) => r !== 'sm')[0];
        const dks = periodDates.slice(0, 7).map((d) => dateKey(d));
        dks.forEach((dk, i) => {
          if (!schedule[am]) schedule[am] = {};
          if (i < 4) schedule[am][dk] = 'close';
        });
        preferences.amClosesPerWeek = 0;
        revalidateAfterManualEdit(getRoles(), getAllWithKC());
        const locked = window._lastGenReport || {};
        const lockedHit = (locked.unmet || []).some((u) => /target 0/.test(String(u)));
        schedule = snap;
        if (prevPref == null || prevPref === '') delete preferences.amClosesPerWeek;
        else preferences.amClosesPerWeek = prevPref;
        revalidateAfterManualEdit(getRoles(), getAllWithKC());
        const restored = window._lastGenReport ? window._lastGenReport.mustFixCount : null;
        return {
          sm, rem, weeks, sumOk, thinAm, thinCap,
          even, evenSm2, evenSm3, before,
          lockedMust: locked.mustFixCount,
          lockedHard: locked.hardErrorCount,
          lockedHit,
          restored,
        };
      });
      const targetsOk = math.sm === 1 && math.rem === 6 && math.sumOk && math.weeks.every((w) => w.capA >= 3 && w.capB >= 3 ? (w.a === 3 && w.b === 3 && w.sum >= 7) : true);
      if (targetsOk) pass('4-sm-two-am-targets', JSON.stringify(math.weeks[0]));
      else fail('4-sm-two-am-targets', JSON.stringify(math));
      if (math.thinAm === Math.min(2, math.thinCap) && math.thinCap >= 2) pass('4-thin-one-am', 'AM ' + math.thinAm);
      else fail('4-thin-one-am', JSON.stringify({ thinAm: math.thinAm, thinCap: math.thinCap }));
      if (math.even === 2 && math.evenSm2 === false && math.evenSm3 === true) pass('4-even-share-unchanged', 'share ' + math.even);
      else fail('4-even-share-unchanged', JSON.stringify({ even: math.even, evenSm2: math.evenSm2, evenSm3: math.evenSm3 }));
      if (math.lockedMust > 0 && math.lockedHit && math.restored === math.before) pass('4-typed-lock-still-error', 'must ' + math.lockedMust);
      else fail('4-typed-lock-still-error', JSON.stringify(math));
      await context.close();
    }

    // --- 2, 3 (4-week), 5, 6 on one real team ---
    {
      const { context, page } = await newCase(browser, { viewport: PHONE, userAgent: IPHONE_UA, touch: true });
      await page.goto(base + '/app/?no_ga=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitSample(page);
      await useMyTeam(page);
      await page.fill('#name-sm', 'Pat Nguyen');
      await page.fill('#name-am1', 'Chris Ortiz');
      await page.locator('#btn-build-from-setup').click();
      await waitReady(page);
      const first = await page.evaluate(inPage(`
        const title = document.getElementById('first-build-ready-title');
        const nudge = document.getElementById('backup-nudge');
        const nCs = nudge ? getComputedStyle(nudge) : null;
        const nudgeOn = !!(nudge && !nudge.hidden && nCs && nCs.display !== 'none' && nCs.visibility !== 'hidden');
        return Object.assign(qualitySnap(), {
          title: (title.textContent || '').trim(),
          hits: {
            title: hitVisible('first-build-ready-title'),
            gap: hitVisible('first-build-gap'),
            add: hitVisible('btn-add-person'),
          },
          nudgeOn,
          label: ((document.getElementById('btn-build-from-setup') || {}).textContent || '').trim(),
        });
      `));
      const readyTitle = first.weeks ? ('Your ' + first.weeks + '-week schedule is ready') : '';
      if (first.title === readyTitle && first.hits.title.ok && first.hits.gap.ok && first.hits.add.ok && !first.nudgeOn && first.count === 0 && first.remaining === 2 && first.chip === 'Free' && !/Free\s*·\s*\d/.test(first.chip)) {
        pass('2-first-build-window', first.title);
      } else fail('2-first-build-window', JSON.stringify(first));

      await page.locator('#btn-add-person').click();
      await page.locator('#name-am3').waitFor({ state: 'visible', timeout: 8000 });
      const labelWhile = await page.locator('#btn-build-from-setup').innerText();
      await page.fill('#name-am3', 'Luis Vega');
      await page.locator('#btn-build-from-setup').click();
      await page.waitForFunction(() => {
        const el = document.getElementById('first-build-ready-title');
        const t = ((el || {}).textContent || '');
        if (!/Filled the gaps|Still \d+ days without/.test(t)) return false;
        const r = el.getBoundingClientRect();
        if (r.top < 0 || r.bottom > window.innerHeight || r.height < 2) return false;
        const x = Math.min(window.innerWidth - 2, Math.max(2, r.left + Math.min(24, r.width / 2)));
        const y = Math.min(window.innerHeight - 2, Math.max(2, r.top + Math.min(12, r.height / 2)));
        const top = document.elementFromPoint(x, y);
        return !!(top && (top === el || el.contains(top)));
      }, { timeout: 25000 });
      const rebuilt = await page.evaluate(inPage(`
        return Object.assign(qualitySnap(), {
          hits: {
            title: hitVisible('first-build-ready-title'),
            gap: hitVisible('first-build-gap'),
          },
          goal: amPeriodCloseGoal(preferences, getRoles(), currentPeriod.numWeeks),
        });
      `));
      const fourOk = rebuilt.weeks === 4 && rebuilt.count === 0 && rebuilt.collapsed && rebuilt.windowOpen
        && rebuilt.hits.title.ok && !rebuilt.needs && !rebuilt.slashGoal && rebuilt.amCls !== 'bad'
        && rebuilt.score >= 85 && rebuilt.mustFix === 0
        && /Build my schedule/.test(labelWhile)
        && (rebuilt.miss === 0 ? /Filled the gaps/.test(rebuilt.title) : new RegExp('Still ' + rebuilt.miss + ' days').test(rebuilt.title));
      if (fourOk) pass('3-four-week-rebuild', rebuilt.grade + ' ' + rebuilt.score + ' goal ' + rebuilt.goal);
      else fail('3-four-week-rebuild', JSON.stringify(rebuilt));
      if (rebuilt.goal === 12) pass('3-period-goal', String(rebuilt.goal));
      else fail('3-period-goal', String(rebuilt.goal));

      const beforeDock = await page.evaluate(() => (window._lastGeneratedAt ? window._lastGeneratedAt.getTime() : 0));
      await page.locator('#btn-generate').click();
      await page.waitForFunction((prev) => {
        const t = window._lastGeneratedAt ? window._lastGeneratedAt.getTime() : 0;
        return t !== prev
          && getFreeGenerateCount() === 0
          && document.body.classList.contains('chips-collapsed');
      }, beforeDock, { timeout: 25000 });
      const docked = await page.evaluate(inPage('return qualitySnap();'));
      if (docked.count === 0 && docked.collapsed && docked.mustFix === 0 && docked.score >= 85 && !docked.needs) {
        pass('3-docked-rebuild-free', docked.grade + ' ' + docked.score);
      } else fail('3-docked-rebuild-free', JSON.stringify(docked));

      const state = await context.storageState();

      const edited = await page.evaluate(() => {
        const role = 'sm';
        const dk = dateKey(periodDates[0]);
        const cur = schedule[role] && schedule[role][dk];
        const next = cur === 'close' ? 'open-late' : 'close';
        applySchedEdit(role, dk, 0, next);
        const nudge = document.getElementById('backup-nudge');
        const grid = document.getElementById('schedule-grid');
        const fair = document.getElementById('fairness-under-schedule');
        const nr = nudge ? nudge.getBoundingClientRect() : null;
        const gr = grid ? grid.getBoundingClientRect() : null;
        const fr = fair ? fair.getBoundingClientRect() : null;
        const cs = nudge ? getComputedStyle(nudge) : null;
        const on = !!(nudge && !nudge.hidden && cs && cs.display !== 'none');
        const below = !!(nr && gr && nr.top >= gr.bottom - 2);
        const belowFair = !fr || fr.height < 2 || nr.top >= fr.top - 2;
        return {
          on, below, belowFair,
          nudgeTop: nr ? Math.round(nr.top) : null,
          gridBottom: gr ? Math.round(gr.bottom) : null,
          fairTop: fr ? Math.round(fr.top) : null,
          count: getFreeGenerateCount(),
          windowOpen: firstRunWindowOpen(),
        };
      });
      if (edited.on && edited.below && edited.belowFair && edited.count === 0 && edited.windowOpen) {
        pass('6-nudge-after-edit', 'top ' + edited.nudgeTop);
      } else fail('6-nudge-after-edit', JSON.stringify(edited));

      const fresh = await browser.newContext({
        storageState: state,
        viewport: PHONE,
        userAgent: IPHONE_UA,
        hasTouch: true,
        isMobile: true,
        serviceWorkers: 'block',
      });
      await trackGtm(fresh);
      const page2 = await fresh.newPage();
      await page2.goto(base + '/app/?no_ga=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page2.waitForFunction(() => {
        const sm = (document.getElementById('name-sm') || {}).value || '';
        return /Pat Nguyen/.test(sm) && document.querySelectorAll('#schedule-grid td, #schedule-grid .mw-person').length > 20;
      }, { timeout: 20000 });
      const session = await page2.evaluate(() => ({
        open: firstRunWindowOpen(),
        key: sessionStorage.getItem('msb_first_run_window'),
        count: getFreeGenerateCount(),
        chip: ((document.getElementById('account-chip-plan') || {}).textContent || '').trim(),
        remaining: remainingFreeGenerates(),
      }));
      if (session.open === false && !session.key && session.count === 0 && session.remaining === 2 && /Free\s*·\s*2/.test(session.chip)) {
        pass('5-new-session-outside-window', session.chip);
      } else fail('5-new-session-outside-window', JSON.stringify(session));
      await fresh.close();

      await page.evaluate(() => {
        window.print = () => { window.__printed = (window.__printed || 0) + 1; };
      });
      await page.evaluate(() => printPostingSheet());
      const mustPrint = await page.evaluate(() => {
        const m = document.getElementById('mustfix-export-modal');
        return !!(m && !m.hasAttribute('hidden'));
      });
      if (mustPrint) await page.click('#mustfix-export-proceed');
      await page.waitForTimeout(200);
      const printed = await page.evaluate(() => ({
        open: firstRunWindowOpen(),
        printed: sessionStorage.getItem('msb_first_run_printed'),
        used: localStorage.getItem('msb_free_export_used'),
        count: getFreeGenerateCount(),
        chip: ((document.getElementById('account-chip-plan') || {}).textContent || '').trim(),
      }));
      if (printed.open === false && printed.printed === '1' && printed.used !== '1' && printed.count === 0 && /Free\s*·\s*2/.test(printed.chip)) {
        pass('5-print-closes-window', printed.chip);
      } else fail('5-print-closes-window', JSON.stringify(printed));

      await page.evaluate(() => { generateSchedule({}); });
      await page.waitForFunction(() => getFreeGenerateCount() === 1, { timeout: 25000 });
      const spent = await page.evaluate(() => ({
        count: getFreeGenerateCount(),
        chip: ((document.getElementById('account-chip-plan') || {}).textContent || '').trim(),
        remaining: remainingFreeGenerates(),
      }));
      if (spent.count === 1 && spent.remaining === 1 && /Free\s*·\s*1/.test(spent.chip)) pass('5-next-build-spends', spent.chip);
      else fail('5-next-build-spends', JSON.stringify(spent));

      const beforeSkip = await page.evaluate(() => (window._lastGeneratedAt ? window._lastGeneratedAt.getTime() : 0));
      await page.locator('#btn-generate').click();
      await page.waitForFunction((prev) => {
        const t = window._lastGeneratedAt ? window._lastGeneratedAt.getTime() : 0;
        return t !== prev && getFreeGenerateCount() === 1;
      }, beforeSkip, { timeout: 25000 });
      const skipped = await page.evaluate(() => getFreeGenerateCount());
      if (skipped === 1) pass('5-docked-rebuild-skips');
      else fail('5-docked-rebuild-skips', String(skipped));
      await context.close();
    }

    // --- 3 five-week period (the period that contains today) ---
    {
      const { context, page } = await newCase(browser, { viewport: DESK, userAgent: DESKTOP_UA });
      await page.goto(base + '/app/?no_ga=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitSample(page);
      await useMyTeam(page);
      await page.fill('#name-sm', 'Pat Nguyen');
      await page.fill('#name-am1', 'Chris Ortiz');
      await page.evaluate(() => { addPersonFromReady(); });
      await page.locator('#name-am3').waitFor({ state: 'visible', timeout: 8000 });
      await page.fill('#name-am3', 'Luis Vega');
      await page.evaluate(() => { loadThisNrfPeriod({ quiet: true }); });
      const period = await page.evaluate(() => ({
        weeks: currentPeriod && currentPeriod.numWeeks,
        n: currentPeriod && currentPeriod.number,
        today: new Date().toDateString(),
      }));
      await page.locator('#btn-build-from-setup').click();
      await waitReady(page);
      const five = await page.evaluate(inPage('return qualitySnap();'));
      const fiveGoal = await page.evaluate(() => amPeriodCloseGoal(preferences, getRoles(), currentPeriod.numWeeks));
      if (period.weeks === 5 && five.weeks === 5 && five.score >= 85 && five.mustFix === 0 && five.roles >= 3 && fiveGoal === 15 && !/Needs attention/.test(five.grade || '')) {
        pass('3-five-week', 'P' + five.n + ' ' + five.grade + ' ' + five.score + ' goal ' + fiveGoal);
      } else fail('3-five-week', JSON.stringify({ period, five, fiveGoal }));
      await context.close();
    }

    // --- 7 welcome ---
    {
      const { context, page } = await newCase(browser, {
        viewport: PHONE,
        userAgent: IPHONE_UA,
        touch: true,
        init: () => {
          localStorage.setItem('msb_own_team_started', '1');
          localStorage.setItem('msb_tour_done', '1');
          localStorage.removeItem('msb_welcome_dismissed');
          localStorage.removeItem('msb_sample_active');
        },
      });
      await page.goto(base + '/app/?no_ga=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => {
        const card = document.getElementById('welcome-card');
        const btn = document.getElementById('btn-start-with-team');
        if (!card || !btn) return false;
        const cs = getComputedStyle(card);
        return cs.display !== 'none' && !card.hidden;
      }, { timeout: 8000 });
      const card = await page.evaluate(() => {
        const el = document.getElementById('welcome-card');
        const btn = document.getElementById('btn-start-with-team');
        const more = document.getElementById('welcome-more');
        const r = el.getBoundingClientRect();
        const b = btn.getBoundingClientRect();
        return {
          h: Math.round(r.height),
          title: (document.getElementById('welcome-title').textContent || '').trim(),
          btnTop: b.top,
          btnBottom: b.bottom,
          ih: window.innerHeight,
          moreHidden: !!(more && more.hidden),
          body: ((document.getElementById('welcome-body') || {}).textContent || '').slice(0, 40),
        };
      });
      if (card.h <= 160 && card.h > 40 && /Build your schedule/.test(card.title) && card.moreHidden && card.btnTop >= 0 && card.btnBottom <= card.ih) {
        pass('7-welcome-compact-390', card.h + 'px');
      } else fail('7-welcome-compact-390', JSON.stringify(card));
      await page.locator('#btn-how-it-works').click();
      const more = await page.evaluate(() => {
        const el = document.getElementById('welcome-more');
        const body = document.getElementById('welcome-body');
        const cs = el ? getComputedStyle(el) : null;
        return {
          hidden: !!(el && el.hidden),
          display: cs ? cs.display : '',
          body: body ? body.textContent : '',
        };
      });
      if (!more.hidden && more.display !== 'none' && /weekend days off/i.test(more.body)) pass('7-how-it-works');
      else fail('7-how-it-works', JSON.stringify(more));
      await context.close();
    }
    {
      const { context, page } = await newCase(browser, {
        viewport: TINY,
        userAgent: IPHONE_UA,
        touch: true,
        init: () => {
          localStorage.setItem('msb_own_team_started', '1');
          localStorage.setItem('msb_tour_done', '1');
          localStorage.removeItem('msb_welcome_dismissed');
          localStorage.removeItem('msb_sample_active');
        },
      });
      await page.goto(base + '/app/?no_ga=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('#btn-start-with-team', { timeout: 8000 });
      const fit = await page.evaluate(() => {
        const btn = document.getElementById('btn-start-with-team');
        const b = btn.getBoundingClientRect();
        return { top: b.top, bottom: b.bottom, ih: window.innerHeight, iw: window.innerWidth };
      });
      if (fit.top >= 0 && fit.bottom <= fit.ih && fit.iw === 320) pass('7-button-320', Math.round(fit.bottom) + '/' + fit.ih);
      else fail('7-button-320', JSON.stringify(fit));
      await page.locator('#btn-tour-sample').click();
      await waitSample(page);
      const sampled = await page.evaluate(() => document.body.classList.contains('sample-board'));
      if (sampled) pass('7-see-a-sample');
      else fail('7-see-a-sample');
      await context.close();
    }

    // --- 8 Spanish surfaces + NRF still named ---
    {
      const { context, page } = await newCase(browser, {
        viewport: PHONE,
        userAgent: IPHONE_UA,
        touch: true,
        init: () => { localStorage.setItem('msb_ui_lang', 'es'); },
      });
      await page.goto(base + '/?no_ga=1', { waitUntil: 'domcontentloaded' });
      const land = await page.evaluate(() => document.body.innerText || '');
      if (/NRF 4-5-4/.test(land)) pass('8-landing-nrf');
      else fail('8-landing-nrf');
      await page.goto(base + '/app/?no_ga=1&lang=es', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitSample(page);
      const headerNrf = await page.evaluate(() => ({
        note: ((document.getElementById('nrf-us-law-note') || {}).textContent || ''),
        sub: ((document.querySelector('.nrf-secondary') || {}).textContent || ''),
      }));
      if (/NRF 4-5-4/.test(headerNrf.note) && /NRF 4-5-4/.test(headerNrf.sub)) pass('8-app-nrf', headerNrf.sub);
      else fail('8-app-nrf', JSON.stringify(headerNrf));
      const labels = await page.evaluate(() => {
        const sw = document.getElementById('phone-week-switcher');
        return {
          weeks: sw ? [...sw.querySelectorAll('.pws-week')].map((b) => (b.textContent || '').trim()) : [],
          toggle: sw ? ((sw.querySelector('.pws-toggle') || {}).textContent || '').trim() : '',
          mode: scheduleViewMode,
        };
      });
      if (labels.mode === 'day' && labels.weeks[0] === 'S1' && labels.weeks[1] === 'S2' && labels.toggle === 'Cuadrícula' && !/^W\d/.test(labels.weeks.join(' '))) {
        pass('8-es-switcher', labels.weeks.slice(0, 2).join(' ') + ' ' + labels.toggle);
      } else fail('8-es-switcher', JSON.stringify(labels));
      await useMyTeam(page);
      await page.fill('#name-sm', 'Pat Nguyen');
      await page.fill('#name-am1', 'Chris Ortiz');
      await page.locator('#btn-build-from-setup').click();
      await waitReady(page);
      await page.locator('#btn-add-person').click();
      await page.locator('#name-am3').waitFor({ state: 'visible', timeout: 8000 });
      await page.fill('#name-am3', 'Luis Vega');
      await page.evaluate(() => { if (typeof setUiLang === 'function') setUiLang('es'); });
      await page.locator('#btn-build-from-setup').click();
      await page.waitForFunction(() => {
        const t = ((document.getElementById('first-build-ready-title') || {}).textContent || '');
        return /Huecos cubiertos|Aún faltan/.test(t);
      }, { timeout: 25000 });
      const es = await page.evaluate(() => {
        const st = computeCoverageAndFairnessStats();
        const chip = formatAmCloseChip(st);
        const meta = ((document.querySelector('#fairness-under-schedule .fu-meta') || {}).textContent || '');
        const title = ((document.getElementById('first-build-ready-title') || {}).textContent || '').trim();
        const sw = document.getElementById('phone-week-switcher');
        const toggle = sw ? ((sw.querySelector('.pws-toggle') || {}).textContent || '').trim() : '';
        return { title, chip: chip.text, chipTitle: chip.title, meta, toggle, cls: chip.cls };
      });
      const titleEs = /Huecos cubiertos/.test(es.title) || /Aún faltan \d+ días/.test(es.title);
      const noEn = !/Filled the gaps|Still \d+ days|AM closes|Day list|^Grid$|Each assistant closes|Build your schedule/.test(es.title + '\n' + es.chip + '\n' + es.chipTitle + '\n' + es.meta);
      if (titleEs && /Cierres AM/.test(es.chip) && /meta/.test(es.chip) && es.cls !== 'bad' && /Cada asistente cierra/.test(es.chipTitle) && /Cada asistente cierra/.test(es.meta) && noEn) {
        pass('8-es-rebuild-copy', es.title);
      } else fail('8-es-rebuild-copy', JSON.stringify(es));
      await context.close();
    }
    {
      const { context, page } = await newCase(browser, {
        viewport: PHONE,
        userAgent: IPHONE_UA,
        touch: true,
        init: () => {
          localStorage.setItem('msb_ui_lang', 'es');
          localStorage.setItem('msb_own_team_started', '1');
          localStorage.setItem('msb_tour_done', '1');
          localStorage.removeItem('msb_welcome_dismissed');
          localStorage.removeItem('msb_sample_active');
        },
      });
      await page.goto(base + '/app/?no_ga=1&lang=es', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('#welcome-title', { timeout: 8000 });
      const welcome = await page.evaluate(() => ({
        title: ((document.getElementById('welcome-title') || {}).textContent || '').trim(),
        how: ((document.getElementById('btn-how-it-works') || {}).textContent || '').trim(),
      }));
      const esWelcome = 'Arma tu horario ' + dash + ' gratis, sin registro';
      if (welcome.title === esWelcome && welcome.how === 'Cómo funciona' && !/Build your schedule|How it works/.test(welcome.title + welcome.how)) {
        pass('8-es-welcome', welcome.title);
      } else fail('8-es-welcome', JSON.stringify(welcome));
      await context.close();
    }

    // --- 9 analytics ---
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
      const events = (rows) => (rows || []).filter((r) => r[0] === 'event').map((r) => ({ name: r[1], p: r[2] || {} }));
      const allowedSurface = new Set(['sample', 'first_build', 'setup', 'team', 'board', 'other']);
      await page.evaluate(() => {
        try {
          let state = 'visible';
          Object.defineProperty(Document.prototype, 'visibilityState', { configurable: true, get: () => state });
          window.__setVis = (s) => { state = s; document.dispatchEvent(new Event('visibilitychange')); };
        } catch (e) { window.__setVis = null; }
      });
      if (await page.evaluate(() => typeof window.__setVis === 'function')) {
        await page.evaluate(() => window.__setVis('hidden'));
        await page.waitForTimeout(200);
        await page.evaluate(() => window.__setVis('visible'));
      }
      await useMyTeam(page);
      await page.fill('#name-sm', 'Pat Nguyen');
      await page.fill('#name-am1', 'Chris Ortiz');
      await page.locator('#btn-build-from-setup').click();
      await page.waitForFunction(() => (window.__ga || []).some((r) => r[0] === 'event' && r[1] === 'first_build'), { timeout: 25000 });
      await page.locator('#btn-add-person').click();
      await page.locator('#name-am3').waitFor({ state: 'visible', timeout: 8000 });
      await page.fill('#name-am3', 'Luis Vega');
      await page.locator('#btn-build-from-setup').click();
      await page.waitForFunction(() => {
        const rows = (window.__ga || []).filter((r) => r[0] === 'event');
        const clicks = rows.filter((r) => r[1] === 'build_click');
        const results = rows.filter((r) => r[1] === 'build_result');
        return clicks.some((r) => r[2] && r[2].surface === 'add_person') && results.length >= 2;
      }, { timeout: 25000 });
      const ev = events(await page.evaluate(() => window.__ga || []));
      const firsts = ev.filter((e) => e.name === 'first_build');
      const clicks = ev.filter((e) => e.name === 'build_click');
      const results = ev.filter((e) => e.name === 'build_result');
      const hides = ev.filter((e) => e.name === 'app_hide');
      const blob = JSON.stringify(ev);
      const leaked = /Pat Nguyen|Chris Ortiz|Luis Vega/.test(blob);
      const hideOk = !hides.length || hides.every((h) => allowedSurface.has(h.p.last_surface));
      const rebuildOnly = clicks.some((c) => c.p.surface === 'add_person') && results.length >= 2 && firsts.length === 1;
      if (rebuildOnly && !leaked && hideOk) pass('9-events', 'first_build ' + firsts.length + ' clicks ' + clicks.length);
      else fail('9-events', JSON.stringify({ firsts: firsts.length, clicks, results: results.length, hides, leaked }));
      await context.close();
    }

    // --- 10 offline day list ---
    {
      const { context, page } = await newCase(browser, { viewport: PHONE, userAgent: IPHONE_UA, touch: true, allowSw: true });
      await page.goto(base + '/app/?no_ga=1', { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, { timeout: 20000 });
      await page.waitForTimeout(800);
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
        const person = document.querySelector('#schedule-grid .mw-person');
        if (person) person.click();
        const menu = document.querySelector('.sched-edit-menu');
        return {
          net,
          mode: scheduleViewMode,
          days: document.querySelectorAll('#schedule-grid .mw-day').length,
          people: document.querySelectorAll('#schedule-grid .mw-person').length,
          sample: document.body.classList.contains('sample-board'),
          menu: !!(menu && menu.getBoundingClientRect().height > 0),
        };
      });
      if (!reloadErr && off.net === 'blocked' && off.sample && off.mode === 'day' && off.days > 0 && off.people > 20 && off.menu) {
        pass('10-offline-day-list', off.people + ' people');
      } else fail('10-offline-day-list', JSON.stringify(off));
      await context.close();
    }
  } finally {
    await browser.close();
    await browserHuman.close();
    try { server.close(); } catch (e) {}
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed');
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
