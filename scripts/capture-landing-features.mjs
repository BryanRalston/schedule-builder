/**
 * Desktop marketing shots for the thin landing feature strip.
 * Run: node scripts/capture-landing-features.mjs
 * Serves this branch locally and captures /app/?demo=1 at a laptop viewport
 * in the default light appearance (maroon + gold brand).
 */
import { createServer } from 'http';
import { readFileSync, existsSync, mkdirSync, writeFileSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'assets', 'landing');
const VIEW = { width: 1400, height: 900 };

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

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      if (p === '/app') p = '/app/index.html';
      const file = join(ROOT, p.replace(/^\//, ''));
      if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
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

async function loadChromium() {
  const candidates = [
    join(ROOT, 'scripts/browser-ops/node_modules/playwright/index.mjs'),
    '/tmp/msb-pw/node_modules/playwright-core/index.mjs',
    '/tmp/node_modules/playwright-core/index.mjs',
  ];
  for (const spec of candidates) {
    if (!existsSync(spec)) continue;
    const mod = await import(pathToFileURL(spec).href);
    if (mod.chromium) return mod.chromium;
  }
  throw new Error('Playwright not installed');
}

async function dismissChrome(page) {
  await page.evaluate(() => {
    try {
      localStorage.setItem('msb_tour_done', '1');
      localStorage.setItem('msb_welcome_dismissed', '1');
      localStorage.setItem('msb_install_dismissed', '1');
      localStorage.setItem('msb_appearance', 'light');
      if (typeof continueOffline === 'function') continueOffline();
      if (typeof hideAuthShell === 'function') hideAuthShell();
      document.documentElement.classList.remove('auth-locked');
      if (typeof endOnboardingTour === 'function') endOnboardingTour(true);
      if (typeof skipOnboardingTour === 'function') skipOnboardingTour();
      if (typeof dismissWelcome === 'function') dismissWelcome();
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
      hide('auth-shell');
      hide('backup-nudge');
      const ib = document.getElementById('install-banner');
      if (ib) ib.classList.remove('show');
      const host = document.getElementById('toast-host');
      if (host) host.innerHTML = '';
    } catch (e) {}
  });
}

function pngInfo(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), bytes: buf.length };
}

function downscaleAndCompress(path) {
  const before = statSync(path).size;
  const py = `
from PIL import Image
im = Image.open(${JSON.stringify(path)})
target = (${VIEW.width}, ${VIEW.height})
if im.size[0] > target[0] or im.size[1] > target[1]:
    im = im.resize(target, Image.Resampling.LANCZOS)
im.save(${JSON.stringify(path)}, 'PNG', optimize=True)
print('%dx%d' % im.size)
`;
  const resized = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
  const pngq = spawnSync('pngquant', ['--force', '--quality=68-90', '--speed', '1', '--output', path, path], {
    encoding: 'utf8',
  });
  const info = pngInfo(readFileSync(path));
  return {
    tool: pngq.status === 0 ? 'pillow+pngquant' : (resized.status === 0 ? 'pillow' : 'none'),
    before,
    after: info.bytes,
    w: info.w,
    h: info.h,
    resizeErr: resized.status === 0 ? '' : String(resized.stderr || resized.stdout || ''),
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const chromium = await loadChromium();
  const { server, base } = await startStaticServer();
  const browser = await chromium.launch({
    executablePath: existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars'],
  });
  const context = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: false,
    colorScheme: 'light',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const shots = [];

  try {
    await page.goto(base + '/app/?demo=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      try {
        localStorage.setItem('msb_tour_done', '1');
        localStorage.setItem('msb_welcome_dismissed', '1');
        localStorage.setItem('msb_install_dismissed', '1');
        localStorage.setItem('msb_appearance', 'light');
        if (typeof applyAppearance === 'function') applyAppearance('light', true);
      } catch (e) {}
    });
    await dismissChrome(page);
    await page.waitForFunction(() => {
      const store = document.getElementById('store-name');
      const grid = document.getElementById('schedule-grid');
      const demo = store && /Harbor East/i.test(store.value || '');
      const cells = !!(grid && grid.children.length > 0);
      return demo || cells;
    }, { timeout: 25000 });
    await page.evaluate(() => {
      // Match Bryan's marketing shots: Free demo, not unlocked Pro.
      if (typeof generateSchedule === 'function') {
        const grid = document.getElementById('schedule-grid');
        if (!grid || !grid.children.length) {
          try { generateSchedule({ skipFreeCount: true }); } catch (e) {}
        }
      }
    });
    await page.waitForTimeout(900);
    await dismissChrome(page);

    const state = await page.evaluate(() => ({
      store: (document.getElementById('store-name') || {}).value || '',
      cells: (document.getElementById('schedule-grid') || {}).children
        ? document.getElementById('schedule-grid').children.length
        : 0,
      sm: (document.getElementById('name-sm') || {}).value || '',
    }));
    if (!/Harbor East/i.test(state.store)) {
      throw new Error('Demo roster did not load: ' + JSON.stringify(state));
    }

    // 1) Setup / team / period — AM + KC names and the loaded NRF period
    await page.evaluate(() => {
      if (typeof closeHeaderMenu === 'function') closeHeaderMenu();
      if (typeof closeReviewSheet === 'function') closeReviewSheet();
      if (typeof switchTab === 'function') switchTab('setup');
      const setup = document.getElementById('tab-setup');
      if (setup) setup.classList.remove('first-run-ease');
      if (typeof toggleMoreSetup === 'function') {
        const btn = document.getElementById('btn-more-setup');
        if (btn && btn.getAttribute('aria-expanded') !== 'true') toggleMoreSetup();
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(350);
    const teamPath = join(OUT, 'feature-team.png');
    await page.screenshot({ path: teamPath, fullPage: false, type: 'png', animations: 'disabled' });
    shots.push({ name: 'feature-team.png', ...pngInfo(readFileSync(teamPath)), compress: downscaleAndCompress(teamPath) });

    // 2) Review board with quality chips
    await page.evaluate(() => {
      if (typeof switchTab === 'function') switchTab('schedule');
      if (typeof setScheduleViewMode === 'function') setScheduleViewMode('week');
      if (typeof setDensityMode === 'function') setDensityMode('board', true);
      if (typeof syncAppShell === 'function') syncAppShell();
      if (typeof updatePostGenStrip === 'function') updatePostGenStrip();
      const strip = document.getElementById('post-gen-strip');
      if (strip) strip.hidden = false;
      window.scrollTo(0, 0);
    });
    await page.waitForFunction(() => {
      const grid = document.getElementById('schedule-grid');
      const strip = document.getElementById('post-gen-strip');
      return !!(grid && grid.children.length > 0 && strip && !strip.hidden);
    }, { timeout: 15000 });
    await page.waitForTimeout(400);
    const reviewPath = join(OUT, 'feature-review.png');
    await page.screenshot({ path: reviewPath, fullPage: false, type: 'png', animations: 'disabled' });
    shots.push({ name: 'feature-review.png', ...pngInfo(readFileSync(reviewPath)), compress: downscaleAndCompress(reviewPath) });

    // 3) More menu: Print / Word / Excel over the board
    await page.evaluate(() => {
      if (typeof closeReviewSheet === 'function') closeReviewSheet();
      if (typeof switchTab === 'function') switchTab('schedule');
      if (typeof setScheduleViewMode === 'function') setScheduleViewMode('week');
      if (typeof setDensityMode === 'function') setDensityMode('board', true);
      const btn = document.getElementById('header-more-btn');
      const panel = document.getElementById('header-menu-panel');
      if (panel) {
        panel.removeAttribute('hidden');
        if (btn) btn.setAttribute('aria-expanded', 'true');
        panel.scrollTop = 0;
      }
      window.scrollTo(0, 0);
    });
    await page.waitForFunction(() => {
      const panel = document.getElementById('header-menu-panel');
      return !!(panel && !panel.hidden && !panel.hasAttribute('hidden'));
    }, { timeout: 8000 });
    await page.waitForTimeout(250);
    const exportPath = join(OUT, 'feature-export.png');
    await page.screenshot({ path: exportPath, fullPage: false, type: 'png', animations: 'disabled' });
    shots.push({ name: 'feature-export.png', ...pngInfo(readFileSync(exportPath)), compress: downscaleAndCompress(exportPath) });

    const report = { viewport: VIEW, dpr: 2, shots };
    writeFileSync('/tmp/landing-capture-report.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    for (const s of shots) {
      const final = pngInfo(readFileSync(join(OUT, s.name)));
      if (final.w < 1200 || final.h < 700) {
        throw new Error(s.name + ' is too small: ' + final.w + 'x' + final.h);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
