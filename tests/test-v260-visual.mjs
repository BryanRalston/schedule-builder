/**
 * v2.6.0 visual capture — screenshots for QA
 * Run: node tests/test-v260-visual.mjs
 */
import { chromium } from '../scripts/browser-ops/node_modules/playwright/index.mjs';
import { createServer } from 'http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'scripts/browser-ops/out/v260-visual');

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

async function prep(page) {
  await page.evaluate(() => {
    try {
      localStorage.clear();
      localStorage.setItem('msb_pro_license', JSON.stringify({ key: 'TEST-PRO-KEY-999', unlockedAt: Date.now() }));
      localStorage.setItem('msb_tour_done', '1');
      localStorage.setItem('msb_welcome_dismissed', '1');
      localStorage.setItem('msb_install_dismissed', '1');
    } catch (e) {}
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    try {
      if (typeof endOnboardingTour === 'function') endOnboardingTour(true);
      if (typeof skipOnboardingTour === 'function') skipOnboardingTour();
      if (typeof dismissWelcome === 'function') dismissWelcome();
      const w = document.getElementById('welcome-card');
      if (w) w.style.display = 'none';
      const ib = document.getElementById('install-banner');
      if (ib) ib.classList.remove('show');
    } catch (e) {}
  });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const { server, base } = await startStaticServer();
  const browser = await chromium.launch({ headless: true });
  const shots = [];

  try {
    // 1 setup desktop
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
    await prep(page);
    await page.evaluate(() => {
      if (typeof switchTab === 'function') switchTab('setup');
    });
    await page.waitForTimeout(300);
    const p1 = join(OUT, '01-setup-desktop.png');
    await page.screenshot({ path: p1, fullPage: true });
    shots.push(p1);
    console.log('shot 01 setup');

    // 2 requests paint toolbar
    await page.evaluate(() => {
      if (typeof switchTab === 'function') switchTab('requests');
      if (typeof setRequestPaintMode === 'function') setRequestPaintMode('pto');
    });
    await page.waitForTimeout(300);
    const p2 = join(OUT, '02-requests-paint.png');
    await page.screenshot({ path: p2, fullPage: true });
    shots.push(p2);
    console.log('shot 02 requests');

    // 3 after demo generate
    await page.evaluate(() => {
      if (typeof loadDemoStore === 'function') loadDemoStore();
    });
    await page.waitForTimeout(2800);
    await page.evaluate(() => {
      if (typeof generateSchedule === 'function') {
        try { generateSchedule(); } catch (e) {}
      }
    });
    await page.waitForTimeout(2800);
    await page.evaluate(() => {
      if (typeof switchTab === 'function') switchTab('schedule');
    });
    await page.waitForTimeout(400);
    const p3 = join(OUT, '03-schedule-after-gen.png');
    await page.screenshot({ path: p3, fullPage: true });
    shots.push(p3);
    console.log('shot 03 schedule gen');

    // 4 density compact
    await page.evaluate(() => setDensityMode('compact', true));
    await page.waitForTimeout(200);
    const p4 = join(OUT, '04-density-compact.png');
    await page.screenshot({ path: p4, fullPage: false });
    shots.push(p4);
    console.log('shot 04 compact');

    // 5 density board
    await page.evaluate(() => setDensityMode('board', true));
    await page.waitForTimeout(200);
    const p5 = join(OUT, '05-density-board.png');
    await page.screenshot({ path: p5, fullPage: false });
    shots.push(p5);
    console.log('shot 05 board');

    // 6 high contrast
    await page.evaluate(() => {
      setDensityMode('comfortable', true);
      if (!document.documentElement.classList.contains('hc-posting')) toggleHighContrast();
    });
    await page.waitForTimeout(200);
    const p6 = join(OUT, '06-high-contrast.png');
    await page.screenshot({ path: p6, fullPage: false });
    shots.push(p6);
    console.log('shot 06 hc');

    // 7 command palette
    await page.evaluate(() => {
      if (document.documentElement.classList.contains('hc-posting')) toggleHighContrast();
      openCommandPalette();
    });
    await page.waitForTimeout(200);
    const p7 = join(OUT, '07-command-palette.png');
    await page.screenshot({ path: p7, fullPage: false });
    shots.push(p7);
    console.log('shot 07 palette');
    await page.evaluate(() => closeCommandPalette());

    // 8 mobile schedule
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      if (typeof switchTab === 'function') switchTab('schedule');
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(300);
    const p8 = join(OUT, '08-mobile-schedule.png');
    await page.screenshot({ path: p8, fullPage: true });
    shots.push(p8);
    console.log('shot 08 mobile');

    // 9 lock mode
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(base + '/index.html?view=board&lock=1', { waitUntil: 'domcontentloaded' });
    await prep(page);
    await page.evaluate(() => {
      if (typeof loadDemoStore === 'function') loadDemoStore();
    });
    await page.waitForTimeout(2500);
    const p9 = join(OUT, '09-lock-mode.png');
    await page.screenshot({ path: p9, fullPage: true });
    shots.push(p9);
    console.log('shot 09 lock');

    writeFileSync(
      join(OUT, 'index.json'),
      JSON.stringify({ at: new Date().toISOString(), shots: shots.map((s) => s.replace(ROOT, '')) }, null, 2)
    );
    console.log('\nWrote', shots.length, 'screenshots to', OUT);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
