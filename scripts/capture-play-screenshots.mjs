/**
 * Play listing phone shots from LIVE GitHub Pages root (TWA startUrl).
 * Matches https://bryanralston.github.io/schedule-builder/?source=pwa
 * Demo seed: ?demo=1&source=pwa
 * Run: node scripts/capture-play-screenshots.mjs
 * Override: set MSB_CAPTURE_URL (default live root). MSB_CAPTURE_LOCAL=1 uses local index.html.
 */
import { chromium } from './browser-ops/node_modules/playwright/index.mjs';
import { createServer } from 'http';
import { readFileSync, existsSync, copyFileSync, writeFileSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SHOT_DIR = join(ROOT, 'store', 'screenshots');
const PLAY_DIR = join(ROOT, 'store', 'play-assets');
const LIVE_ROOT = 'https://bryanralston.github.io/schedule-builder/';
const USE_LOCAL = process.env.MSB_CAPTURE_LOCAL === '1';
const CAPTURE_QUERY = '?demo=1&source=pwa';

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
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

async function dismissChrome(page) {
  await page.evaluate(() => {
    try {
      localStorage.setItem('msb_tour_done', '1');
      localStorage.setItem('msb_welcome_dismissed', '1');
      localStorage.setItem('msb_install_dismissed', '1');
      if (typeof endOnboardingTour === 'function') endOnboardingTour(true);
      if (typeof skipOnboardingTour === 'function') skipOnboardingTour();
      if (typeof dismissWelcome === 'function') dismissWelcome();
      if (typeof hideAuthShell === 'function') hideAuthShell();
      document.documentElement.classList.remove('auth-locked');
      const hide = (id) => {
        const el = document.getElementById(id);
        if (el) {
          el.style.display = 'none';
          el.hidden = true;
          el.classList.remove('show', 'open');
        }
      };
      hide('welcome-card');
      hide('install-banner');
      hide('onboarding-tour');
      hide('ready-checklist');
      hide('view-lock-banner');
      const ib = document.getElementById('install-banner');
      if (ib) ib.classList.remove('show');
      const host = document.getElementById('toast-host');
      if (host) host.innerHTML = '';
    } catch (e) {}
  });
}

function pngSize(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

async function clearServiceWorker(page) {
  await page.evaluate(async () => {
    try {
      if (navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) {}
  });
}

async function openLiveApp(page, base) {
  const url = base.replace(/\/?$/, '/') + CAPTURE_QUERY.replace(/^\?/, '?');
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(400);
  await clearServiceWorker(page);
  await page.evaluate(() => {
    try {
      localStorage.setItem('msb_tour_done', '1');
      localStorage.setItem('msb_welcome_dismissed', '1');
      localStorage.setItem('msb_install_dismissed', '1');
    } catch (e) {}
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(700);
  await dismissChrome(page);
  return url;
}

async function unlockPro(page) {
  await page.evaluate(() => {
    if (typeof setProUnlocked === 'function') setProUnlocked('MSB-PRO-PLAY-REVIEW');
  });
}

async function waitForDemoGrid(page) {
  await page.waitForFunction(() => {
    const grid = document.getElementById('schedule-grid');
    const results = document.getElementById('schedule-results');
    const hasCells = !!(grid && grid.children.length > 0);
    const shown = !!(results && getComputedStyle(results).display !== 'none');
    const store = document.getElementById('store-name');
    const demoName = store && /Harbor East/i.test(store.value || '');
    return (hasCells && shown) || demoName;
  }, { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    if (typeof generateSchedule === 'function') {
      const grid = document.getElementById('schedule-grid');
      if (!grid || !grid.children.length) {
        try { generateSchedule(); } catch (e) {}
      }
    }
    if (typeof switchTab === 'function') switchTab('schedule');
    if (typeof syncAppShell === 'function') syncAppShell();
  });
  await page.waitForFunction(() => {
    const grid = document.getElementById('schedule-grid');
    return !!(grid && grid.children.length > 0);
  }, { timeout: 15000 });
}

async function shot(page, name) {
  await dismissChrome(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  const dests = [
    join(SHOT_DIR, name),
    join(PLAY_DIR, name),
  ];
  for (const dest of dests) {
    await page.screenshot({
      path: dest,
      fullPage: false,
      type: 'png',
      animations: 'disabled',
    });
  }
  const img = readFileSync(dests[0]);
  const size = pngSize(img);
  if (size.w !== 1080 || size.h !== 1920) {
    throw new Error(name + ' is ' + size.w + 'x' + size.h + ', expected 1080x1920');
  }
  return { name, bytes: img.length, dests, size };
}

async function main() {
  const checks = [];
  let server = null;
  let base = (process.env.MSB_CAPTURE_URL || LIVE_ROOT).replace(/\/?$/, '/');
  if (USE_LOCAL) {
    const local = await startStaticServer();
    server = local.server;
    base = local.base + '/';
  }
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'dark',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();

  try {
    // 1) ?demo=1&source=pwa on LIVE root (TWA URL) unless MSB_CAPTURE_LOCAL=1
    const captureUrl = await openLiveApp(page, base);
    await unlockPro(page);
    await waitForDemoGrid(page);
    const demo = await page.evaluate(() => {
      const grid = document.getElementById('schedule-grid');
      const banner = document.getElementById('msb-staging-banner');
      const store = document.getElementById('store-name');
      const sub = document.querySelector('.app-header .subtitle');
      const ver = typeof APP_VERSION !== 'undefined' ? APP_VERSION : (document.getElementById('app-version-label') || {}).textContent || '';
      return {
        cells: grid ? grid.children.length : 0,
        store: store ? store.value : '',
        staging: !!(banner && getComputedStyle(banner).display !== 'none'),
        subtitle: sub ? (sub.textContent || '').trim() : '',
        ver,
        href: location.href,
        path: location.pathname,
        host: location.host,
      };
    });
    const liveHostOk = USE_LOCAL || /bryanralston\.github\.io/i.test(demo.host);
    const verOk = String(demo.ver).replace(/^v/, '') === '2.6.8';
    const noClopenChrome = !/no clopens/i.test(demo.subtitle || '');
    const demoOk = demo.cells > 0 && /Harbor East/i.test(demo.store) && !demo.staging && !/staging/i.test(demo.path) && liveHostOk && verOk && noClopenChrome;
    checks.push({ name: 'demo=1-generates', ok: demoOk, detail: JSON.stringify(demo) });
    checks.push({ name: 'live-2.6.8', ok: verOk && liveHostOk, detail: JSON.stringify({ ver: demo.ver, href: demo.href }) });
    checks.push({ name: 'no-clopens-chrome', ok: noClopenChrome, detail: demo.subtitle });
    checks.push({ name: 'no-staging-banner', ok: !demo.staging, detail: String(demo.staging) });
    console.log(demoOk ? '  PASS demo=1-generates' : '  FAIL demo=1-generates', demo);
    console.log('  capture url', captureUrl);

    // 2) Reviewer license via the same validator the Account modal uses
    const lic = await page.evaluate(() => {
      const key = 'MSB-PRO-PLAY-REVIEW';
      const valid = typeof validLicenseKey === 'function' ? validLicenseKey(key) : false;
      const prefix = /^MSB-PRO-/i.test(key);
      if (typeof setProUnlocked === 'function') setProUnlocked(key);
      const unlocked = typeof isProUnlocked === 'function' ? isProUnlocked() : false;
      let stored = null;
      try { stored = JSON.parse(localStorage.getItem('msb_pro_license') || 'null'); } catch (e) {}
      return { valid, prefix, unlocked, storedKey: stored && stored.key, storedUnlocked: !!(stored && stored.unlocked) };
    });
    const licOk = !!(lic.valid && lic.prefix && lic.unlocked && lic.storedUnlocked && lic.storedKey === 'MSB-PRO-PLAY-REVIEW');
    checks.push({ name: 'reviewer-license-unlocks', ok: licOk, detail: JSON.stringify(lic) });
    console.log(licOk ? '  PASS reviewer-license-unlocks' : '  FAIL reviewer-license-unlocks', lic);

    // Modal path (Account → Activate → Unlock)
    await page.evaluate(() => {
      try { localStorage.removeItem('msb_pro_license'); } catch (e) {}
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await dismissChrome(page);
    await page.evaluate(() => {
      if (typeof openLicenseModal === 'function') openLicenseModal();
    });
    await page.waitForSelector('#license-input', { timeout: 8000 });
    await page.fill('#license-input', 'MSB-PRO-PLAY-REVIEW');
    await page.evaluate(() => {
      if (typeof submitLicenseUnlock === 'function') submitLicenseUnlock();
    });
    await page.waitForTimeout(300);
    const modalLic = await page.evaluate(() => {
      const unlocked = typeof isProUnlocked === 'function' ? isProUnlocked() : false;
      let stored = null;
      try { stored = JSON.parse(localStorage.getItem('msb_pro_license') || 'null'); } catch (e) {}
      return { unlocked, key: stored && stored.key };
    });
    const modalOk = !!(modalLic.unlocked && modalLic.key === 'MSB-PRO-PLAY-REVIEW');
    checks.push({ name: 'reviewer-license-modal', ok: modalOk, detail: JSON.stringify(modalLic) });
    console.log(modalOk ? '  PASS reviewer-license-modal' : '  FAIL reviewer-license-modal', modalLic);

    // Reload with Pro + demo data for shots
    await openLiveApp(page, base);
    await unlockPro(page);
    await waitForDemoGrid(page);
    await dismissChrome(page);
    try { await page.evaluate(() => document.fonts && document.fonts.ready); } catch (e) {}
    await page.waitForTimeout(400);

    // 01 Setup
    await page.evaluate(() => {
      if (typeof switchTab === 'function') switchTab('setup');
      if (typeof closeReviewSheet === 'function') closeReviewSheet();
    });
    await page.waitForTimeout(350);
    await shot(page, '01-setup.png');
    console.log('  shot 01-setup');

    // 02 Requests
    await page.evaluate(() => {
      if (typeof switchTab === 'function') switchTab('requests');
      if (typeof setRequestPaintMode === 'function') setRequestPaintMode('pto');
    });
    await page.waitForTimeout(400);
    await shot(page, '02-requests.png');
    console.log('  shot 02-requests');

    // 03 Rules
    await page.evaluate(() => {
      if (typeof switchTab === 'function') switchTab('rules');
      if (typeof switchSubTab === 'function') switchSubTab('prefs');
    });
    await page.waitForTimeout(400);
    await shot(page, '03-rules.png');
    console.log('  shot 03-rules');

    // 04 Schedule board after generate
    await page.evaluate(() => {
      if (typeof switchTab === 'function') switchTab('schedule');
      if (typeof setScheduleViewMode === 'function') setScheduleViewMode('week');
      if (typeof setDensityMode === 'function') setDensityMode('board');
      if (typeof syncAppShell === 'function') syncAppShell();
      const results = document.getElementById('schedule-results');
      if (results) results.scrollIntoView({ block: 'start' });
      const grid = document.getElementById('schedule-grid');
      if (grid) grid.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(450);
    await shot(page, '04-schedule-score.png');
    console.log('  shot 04-schedule-score');

    // 05 Review sheet
    await page.evaluate(() => {
      if (typeof openReviewSheet === 'function') openReviewSheet();
    });
    await page.waitForTimeout(400);
    const sheet = await page.evaluate(() => {
      const sh = document.getElementById('review-sheet');
      return !!(sh && sh.classList.contains('open') && !sh.hidden);
    });
    checks.push({ name: 'review-sheet-open', ok: sheet, detail: sheet ? 'open' : 'closed' });
    await shot(page, '05-review-sheet.png');
    // Keep prior Console filename so Bryan can replace in place
    copyFileSync(join(SHOT_DIR, '05-review-sheet.png'), join(SHOT_DIR, '05-publish-setup.png'));
    copyFileSync(join(PLAY_DIR, '05-review-sheet.png'), join(PLAY_DIR, '05-publish-setup.png'));
    console.log('  shot 05-review-sheet (+ 05-publish-setup alias)');

    const report = {
      viewport: '360x640 @3x = 1080x1920',
      source: USE_LOCAL ? 'local ROOT index.html' : 'LIVE GitHub Pages root TWA URL',
      captureUrl,
      appVersion: demo.ver,
      subtitle: demo.subtitle,
      checks,
      files: [
        'store/screenshots/01-setup.png',
        'store/screenshots/02-requests.png',
        'store/screenshots/03-rules.png',
        'store/screenshots/04-schedule-score.png',
        'store/screenshots/05-review-sheet.png',
        'store/screenshots/05-publish-setup.png',
        'store/play-assets/ (same names)',
      ],
    };
    writeFileSync(join(ROOT, 'scripts/browser-ops/out/play-shots-report.json'), JSON.stringify(report, null, 2));
    const failed = checks.filter((c) => !c.ok);
    console.log('\nChecks:', checks.map((c) => (c.ok ? 'PASS' : 'FAIL') + ' ' + c.name).join(' | '));
    if (failed.length) {
      console.error('FAILED', failed.length);
      process.exitCode = 1;
    } else {
      console.log('All Play-shot checks passed.');
    }
  } finally {
    await browser.close();
    if (server) server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
