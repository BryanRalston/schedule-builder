/**
 * v2.6.46: light-mode contrast — welcome title and setup panel must be
 * dark ink on light paper. Dark theme keeps the ops-console look.
 * Run: node tests/test-v2646-contrast.mjs
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
  '.ico': 'application/octet-stream',
  '.webmanifest': 'application/manifest+json',
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

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
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

function staticChecks() {
  console.log('\n=== static ===');
  const app = read('app/index.html');
  const sw = read('sw.js');
  const ver = JSON.parse(read('version.json'));
  const twa = JSON.parse(read('android-twa/twa-manifest.json'));

  if (ver.version === '2.6.46') pass('version.json', ver.version);
  else fail('version.json', JSON.stringify(ver));

  if (app.includes("APP_VERSION = '2.6.46'") && sw.includes('msb-pro-v2.6.46')
    && app.includes('id="app-version-label">v2.6.46')) {
    pass('app-sw-version');
  } else fail('app-sw-version', 'expected 2.6.46');

  if (twa.appVersion === '2.6.46' && twa.appVersionName === '2.6.46') pass('twa-version');
  else fail('twa-version', JSON.stringify({ v: twa.appVersion, n: twa.appVersionName }));

  if (app.includes('--headline-color:') && app.includes('--headline-fill:')
    && app.includes('--panel-inset:') && app.includes('--well-bg:')) {
    pass('contrast-tokens');
  } else fail('contrast-tokens', 'missing --headline-* / --panel-inset / --well-bg');

  if (!/welcome-card h2[\s\S]{0,280}#fff,\s*var\(--accent-ink\)/.test(app)
    && !/welcome-card h2[\s\S]{0,280}#c4b5fd/.test(app)) {
    pass('welcome-h2-not-pale-gold');
  } else fail('welcome-h2-not-pale-gold', 'welcome h2 still uses white/gold/lavender clip');

  if (/\.tab-panel\s*\{[^}]*background:\s*var\(--panel-inset\)/.test(app)
    && !/\.tab-panel\s*\{[^}]*background:\s*rgba\(12,\s*18,\s*32/.test(app)) {
    pass('tab-panel-tokenized');
  } else fail('tab-panel-tokenized', 'setup panel still hardcodes dark slate');

  const rootBlock = app.match(/:root\s*\{[\s\S]*?^html\[data-theme="dark"\]/m);
  const root = rootBlock ? rootBlock[0] : app.slice(0, 4500);
  if (/--headline-fill:\s*none/.test(root) && /--panel-inset:\s*var\(--surface-2\)/.test(root)
    && /--headline-color:\s*var\(--ink\)/.test(root)) {
    pass('light-tokens-solid-ink');
  } else fail('light-tokens-solid-ink', 'light :root must use solid ink headlines + light panel inset');

  if (/html\[data-theme="dark"\][\s\S]*--headline-fill:\s*var\(--title-grad\)/.test(app)
    && /html\[data-theme="dark"\][\s\S]*--panel-inset:\s*rgba\(12,\s*18,\s*32/.test(app)) {
    pass('dark-tokens-keep-ops');
  } else fail('dark-tokens-keep-ops', 'dark theme must keep title gradient + ops panel glass');
}

function srgbLin(c) {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function parseRgb(str) {
  if (!str) return null;
  const m = String(str).match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function relLum(rgb) {
  const [r, g, b] = rgb;
  return 0.2126 * srgbLin(r) + 0.7152 * srgbLin(g) + 0.0722 * srgbLin(b);
}

function contrastRatio(a, b) {
  const L1 = relLum(a);
  const L2 = relLum(b);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

function isLight(rgb) {
  return relLum(rgb) >= 0.72;
}

function isDarkInk(rgb) {
  return relLum(rgb) <= 0.32;
}

async function browserChecks(base, chromium) {
  console.log('\n=== browser ===');
  const browser = await chromium.launch({
    executablePath: existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript(() => {
      try { localStorage.removeItem('msb_appearance'); } catch (e) {}
    });
    await page.goto(base + '/app/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#welcome-title, #tab-setup', { timeout: 20000 });

    const light = await page.evaluate(() => {
      const welcome = document.getElementById('welcome-title');
      const panel = document.getElementById('tab-setup');
      const desc = document.getElementById('setup-panel-desc');
      const title = document.getElementById('setup-panel-title');
      const header = document.querySelector('.app-header h1');
      const requests = document.getElementById('tab-requests');
      const rules = document.getElementById('tab-rules');
      const schedule = document.getElementById('tab-schedule');
      const wcs = welcome ? getComputedStyle(welcome) : null;
      const pcs = panel ? getComputedStyle(panel) : null;
      const dcs = desc ? getComputedStyle(desc) : null;
      const tcs = title ? getComputedStyle(title) : null;
      const hcs = header ? getComputedStyle(header) : null;
      const tokens = getComputedStyle(document.documentElement);
      return {
        theme: document.documentElement.getAttribute('data-theme'),
        version: (document.getElementById('app-version-label') || {}).textContent || '',
        welcomeColor: wcs ? wcs.color : '',
        welcomeFill: wcs ? wcs.webkitTextFillColor : '',
        welcomeBg: wcs ? wcs.backgroundImage : '',
        welcomeClip: wcs ? wcs.webkitBackgroundClip : '',
        panelBg: pcs ? pcs.backgroundColor : '',
        descColor: dcs ? dcs.color : '',
        titleColor: tcs ? tcs.color : '',
        headerColor: hcs ? hcs.color : '',
        headerFill: hcs ? hcs.webkitTextFillColor : '',
        requestsBg: requests ? getComputedStyle(requests).backgroundColor : '',
        rulesBg: rules ? getComputedStyle(rules).backgroundColor : '',
        scheduleBg: schedule ? getComputedStyle(schedule).backgroundColor : '',
        headlineColor: tokens.getPropertyValue('--headline-color').trim(),
        headlineFill: tokens.getPropertyValue('--headline-fill').trim(),
        panelInset: tokens.getPropertyValue('--panel-inset').trim(),
        ink: tokens.getPropertyValue('--ink').trim(),
      };
    });

    if (light.theme === 'light' && /v2\.6\.46/.test(light.version)) {
      pass('default-light-version', light.version);
    } else fail('default-light-version', JSON.stringify({ theme: light.theme, version: light.version }));

    const welcomeRgb = parseRgb(light.welcomeFill !== 'rgba(0, 0, 0, 0)' && light.welcomeFill !== 'transparent'
      ? light.welcomeFill
      : light.welcomeColor);
    const panelRgb = parseRgb(light.panelBg);
    const descRgb = parseRgb(light.descColor);
    const titleRgb = parseRgb(light.titleColor);
    const headerRgb = parseRgb(light.headerFill !== 'rgba(0, 0, 0, 0)' && light.headerFill !== 'transparent'
      ? light.headerFill
      : light.headerColor);

    if (welcomeRgb && isDarkInk(welcomeRgb) && !/gradient/i.test(light.welcomeBg)) {
      pass('light-welcome-title-ink', light.welcomeColor);
    } else fail('light-welcome-title-ink', JSON.stringify({
      color: light.welcomeColor, fill: light.welcomeFill, bg: light.welcomeBg, clip: light.welcomeClip
    }));

    if (panelRgb && isLight(panelRgb)) {
      pass('light-setup-panel-paper', light.panelBg);
    } else fail('light-setup-panel-paper', light.panelBg);

    if (titleRgb && panelRgb && contrastRatio(titleRgb, panelRgb) >= 4.5
      && descRgb && contrastRatio(descRgb, panelRgb) >= 4.5) {
      pass('light-setup-text-contrast', JSON.stringify({
        title: contrastRatio(titleRgb, panelRgb).toFixed(2),
        desc: contrastRatio(descRgb, panelRgb).toFixed(2)
      }));
    } else fail('light-setup-text-contrast', JSON.stringify({
      title: light.titleColor, desc: light.descColor, panel: light.panelBg
    }));

    if (welcomeRgb && panelRgb && contrastRatio(welcomeRgb, [255, 255, 255]) >= 4.5) {
      pass('light-welcome-on-white', contrastRatio(welcomeRgb, [255, 255, 255]).toFixed(2));
    } else fail('light-welcome-on-white', JSON.stringify({ color: light.welcomeColor, rgb: welcomeRgb }));

    if (headerRgb && isDarkInk(headerRgb)) {
      pass('light-header-ink', light.headerColor);
    } else fail('light-header-ink', JSON.stringify({ color: light.headerColor, fill: light.headerFill }));

    const otherPanels = [light.requestsBg, light.rulesBg, light.scheduleBg].map(parseRgb);
    if (otherPanels.every((rgb) => rgb && isLight(rgb))) {
      pass('light-other-tab-panels');
    } else fail('light-other-tab-panels', JSON.stringify({
      requests: light.requestsBg, rules: light.rulesBg, schedule: light.scheduleBg
    }));

    if (light.headlineFill === 'none' && /#152033/i.test(light.ink)) {
      pass('light-headline-token', light.headlineColor + ' / ' + light.headlineFill);
    } else fail('light-headline-token', JSON.stringify({
      headlineColor: light.headlineColor, headlineFill: light.headlineFill, ink: light.ink
    }));

    await page.evaluate(() => {
      if (typeof setAppearance === 'function') setAppearance('dark');
    });
    const dark = await page.evaluate(() => {
      const welcome = document.getElementById('welcome-title');
      const panel = document.getElementById('tab-setup');
      const tokens = getComputedStyle(document.documentElement);
      const wcs = welcome ? getComputedStyle(welcome) : null;
      const pcs = panel ? getComputedStyle(panel) : null;
      return {
        theme: document.documentElement.getAttribute('data-theme'),
        paper: tokens.getPropertyValue('--paper').trim(),
        ink: tokens.getPropertyValue('--ink').trim(),
        headlineFill: tokens.getPropertyValue('--headline-fill').trim(),
        panelInset: tokens.getPropertyValue('--panel-inset').trim(),
        welcomeColor: wcs ? wcs.color : '',
        panelBg: pcs ? pcs.backgroundColor : '',
      };
    });

    const darkPanel = parseRgb(dark.panelBg);
    if (dark.theme === 'dark' && /#070b14/i.test(dark.paper) && /#e8eef9/i.test(dark.ink)
      && /title-grad|gradient/i.test(dark.headlineFill) && darkPanel && relLum(darkPanel) < 0.25) {
      pass('dark-still-ops-console', JSON.stringify({ paper: dark.paper, panel: dark.panelBg }));
    } else fail('dark-still-ops-console', JSON.stringify(dark));
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('\n=== v2.6.46 light contrast ===');
  staticChecks();

  let server;
  try {
    const chromium = await loadChromium();
    const started = await startStaticServer();
    server = started.server;
    await browserChecks(started.base, chromium);
  } catch (e) {
    fail('browser-harness', e && e.stack ? e.stack : e);
  } finally {
    if (server) server.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log('\n' + results.filter((r) => r.ok).length + ' passed,', failed.length, 'failed');
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
