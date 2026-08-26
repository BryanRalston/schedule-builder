/**
 * v2.6.9 first-run: Start with my team dismisses chrome, Setup can Build.
 * Run: node tests/test-v269-first-run.mjs
 */
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
  const candidates = [
    join(ROOT, 'scripts/browser-ops/node_modules/playwright/index.mjs'),
    '/tmp/node_modules/playwright-core/index.mjs',
  ];
  for (const spec of candidates) {
    if (!existsSync(spec)) continue;
    const mod = await import(spec);
    if (mod.chromium) return mod.chromium;
  }
  throw new Error('Playwright not installed');
}

async function main() {
  console.log('\n=== v2.6.9 first-run Start with my team ===');

  const version = JSON.parse(read('version.json'));
  if (version.version === '2.6.9') pass('version.json', version.version);
  else fail('version.json', JSON.stringify(version));

  const index = read('index.html');
  if (/function startWithMyTeam\(/.test(index) && /function buildFromSetup\(/.test(index)) {
    pass('first-run-fns');
  } else fail('first-run-fns', 'missing startWithMyTeam / buildFromSetup');

  if (/id="btn-start-with-team"[^>]*onclick="startWithMyTeam\(\)"/.test(index)) {
    pass('welcome-cta-wired');
  } else fail('welcome-cta-wired', 'Start with my team not wired');

  if (/id="btn-build-from-setup"[^>]*onclick="buildFromSetup\(\)"/.test(index)) {
    pass('setup-build-btn');
  } else fail('setup-build-btn', 'Setup footer Build missing');

  if (/Next: Requests/.test(index)) {
    fail('setup-footer-not-gauntlet', 'old Next: Requests still present');
  } else pass('setup-footer-not-gauntlet');

  const { chromium } = { chromium: await loadChromium() };
  const { server, base } = await startStaticServer();
  const browser = await chromium.launch({
    executablePath: existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);

    const bootToasts = await page.evaluate(() =>
      [...document.querySelectorAll('#toast-host .toast-msg')].map((el) => el.textContent || '')
    );
    if (bootToasts.some((t) => /Density:/i.test(t))) fail('no-boot-density-toast', bootToasts.join(' | '));
    else pass('no-boot-density-toast');

    await page.locator('#btn-start-with-team').click();
    await page.waitForTimeout(400);

    const started = await page.evaluate(() => {
      const welcome = document.getElementById('welcome-card');
      const cs = welcome ? getComputedStyle(welcome) : null;
      const tour = document.getElementById('onboarding-tour');
      return {
        welcomeVisible: !!(welcome && cs && cs.display !== 'none' && welcome.offsetHeight > 2),
        tourHidden: !tour || tour.hasAttribute('hidden'),
        tab: typeof currentAppTab !== 'undefined' ? currentAppTab : '',
        focused: document.activeElement && document.activeElement.id,
        toast: [...document.querySelectorAll('#toast-host .toast-msg')].map((el) => el.textContent).pop() || '',
        hasPeriod: !!(typeof periodDates !== 'undefined' && periodDates && periodDates.length),
      };
    });
    if (!started.welcomeVisible && started.tourHidden && started.tab === 'setup' && started.hasPeriod) {
      pass('start-with-team-clears-chrome', started.focused || 'no-focus');
    } else fail('start-with-team-clears-chrome', JSON.stringify(started));
    if (/Name two managers/.test(started.toast)) pass('start-with-team-toast', started.toast);
    else fail('start-with-team-toast', started.toast);

    const unnamed = await page.evaluate(() => {
      document.querySelectorAll('#toast-host .toast').forEach((el) => el.remove());
      buildFromSetup();
      return {
        toast: [...document.querySelectorAll('#toast-host .toast-msg')].map((el) => el.textContent).pop() || '',
        tab: currentAppTab,
        hasGrid: document.querySelectorAll('#schedule-grid td.shift-editable').length,
      };
    });
    if (/Name your managers/.test(unnamed.toast) && unnamed.tab === 'setup' && unnamed.hasGrid === 0) {
      pass('build-from-setup-unnamed', unnamed.toast);
    } else fail('build-from-setup-unnamed', JSON.stringify(unnamed));

    const built = await page.evaluate(() => {
      document.querySelectorAll('#toast-host .toast').forEach((el) => el.remove());
      const sm = document.getElementById('name-sm');
      const am1 = document.getElementById('name-am1');
      if (sm) sm.value = 'Pat Nguyen';
      if (am1) am1.value = 'Chris Ortiz';
      persistManagerNames();
      buildFromSetup();
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            tab: currentAppTab,
            named: managersAreNamed(),
            cells: document.querySelectorAll('#schedule-grid td.shift-editable').length,
            toast: [...document.querySelectorAll('#toast-host .toast-msg')].map((el) => el.textContent).pop() || '',
            boardLive: document.getElementById('tab-schedule')?.classList.contains('board-live') || false,
          });
        }, 1600);
      });
    });
    if (built.tab === 'schedule' && built.named && built.cells > 20 && /Schedule ready/.test(built.toast)) {
      pass('build-from-setup-named', built.cells + ' cells');
    } else fail('build-from-setup-named', JSON.stringify(built));
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
