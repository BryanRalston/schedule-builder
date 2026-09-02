/**
 * v2.6.38 first-minute: phone Free · N + install banner after first Build.
 * Run: node tests/test-v2638-first-minute.mjs
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
  const sw = read('sw.js');
  const ver = JSON.parse(read('version.json'));

  if (ver.version === '2.6.38') pass('version.json', ver.version);
  else fail('version.json', JSON.stringify(ver));

  if (index.includes("APP_VERSION = '2.6.38'") && sw.includes("msb-pro-v2.6.38")
    && index.includes('id="app-version-label">v2.6.38')) {
    pass('app-sw-version');
  } else fail('app-sw-version', 'expected 2.6.38');

  if (index.includes("function formatFreePlanDetail(")
    && index.includes("msbT('Free · {n} of {total} builds left'")
    && index.includes("'Gratis · {n} de {total} armados restantes'")) {
    pass('plan-row-i18n');
  } else fail('plan-row-i18n', 'missing Free · N of total PLAN strings');

  const hideMeta = /@media \(max-width: 520px\)[\s\S]{0,280}?\.account-chip-meta \{\s*display:\s*none/;
  if (hideMeta.test(index)) fail('phone-chip-meta-not-hidden', 'account-chip-meta still display:none on phone');
  else pass('phone-chip-meta-not-hidden');

  if (index.includes('id="setup-gen-free-left"') && index.includes('function updateGenFreeLeft(')) {
    pass('setup-builds-left-pill');
  } else fail('setup-builds-left-pill', 'missing setup-gen-free-left');

  if (index.includes('function maybeOfferInstall(')
    && index.includes('function hasBuiltOnceForInstall(')
    && index.includes('function persistInstallBannerDismissed(')
    && index.includes('MSB_HAS_BUILT_ONCE_KEY')
    && /showInstallBanner\(\);\s*\}\);/.test(index) === false) {
    pass('install-gated-and-persisted');
  } else fail('install-gated-and-persisted', 'install still shown from beforeinstallprompt immediately');
}

async function main() {
  console.log('\n=== v2.6.38 first-minute phone ===');
  staticChecks();

  const { server, base } = await startStaticServer();
  const chromium = await loadChromium();
  const browser = await chromium.launch({
    executablePath: existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 360, height: 740 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('msb_tour_done', '1');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    const boot = await page.evaluate(() => {
      const plan = document.getElementById('account-chip-plan');
      const meta = document.querySelector('.account-chip-meta');
      const setupLeft = document.getElementById('setup-gen-free-left');
      const genLeft = document.getElementById('gen-free-left');
      const banner = document.getElementById('install-banner');
      if (typeof showInstallBanner === 'function') showInstallBanner();
      const bannerAfterForce = document.getElementById('install-banner');
      return {
        version: (document.getElementById('app-version-label') || {}).textContent,
        planText: (plan && plan.textContent || '').trim(),
        planDisplay: plan ? getComputedStyle(plan).display : 'missing',
        metaDisplay: meta ? getComputedStyle(meta).display : 'missing',
        setupLeft: (setupLeft && setupLeft.textContent || '').trim(),
        setupLeftHidden: !!(setupLeft && setupLeft.hidden),
        genLeft: (genLeft && genLeft.textContent || '').trim(),
        bannerShow: !!(banner && banner.classList.contains('show')),
        bannerShowAfterForce: !!(bannerAfterForce && bannerAfterForce.classList.contains('show')),
        hasBuilt: typeof hasBuiltOnceForInstall === 'function' ? hasBuiltOnceForInstall() : null,
        remaining: typeof remainingFreeGenerates === 'function' ? remainingFreeGenerates() : null,
      };
    });

    if (/v2\.6\.38/.test(boot.version || '')) pass('in-app-version', boot.version);
    else fail('in-app-version', boot.version);
    if (/Free · 2/i.test(boot.planText) && boot.planDisplay !== 'none' && boot.metaDisplay !== 'none') {
      pass('phone-chip-free-n', boot.planText + ' display=' + boot.planDisplay);
    } else fail('phone-chip-free-n', JSON.stringify(boot));
    if (!boot.setupLeftHidden && /2/.test(boot.setupLeft) && /left/i.test(boot.setupLeft)) {
      pass('setup-pill-before-build', boot.setupLeft);
    } else fail('setup-pill-before-build', JSON.stringify({ t: boot.setupLeft, h: boot.setupLeftHidden }));
    if (!boot.bannerShow && !boot.bannerShowAfterForce && boot.hasBuilt === false) {
      pass('install-hidden-before-build');
    } else fail('install-hidden-before-build', JSON.stringify(boot));

    await page.evaluate(() => {
      if (typeof startWithMyTeam === 'function') startWithMyTeam();
    });
    await page.waitForTimeout(200);

    const planModal = await page.evaluate(() => {
      if (typeof openAccountPanel === 'function') openAccountPanel();
      const plan = (document.getElementById('ap-plan') || {}).textContent || '';
      if (typeof closeAccountPanel === 'function') closeAccountPanel();
      return plan.trim();
    });
    if (/Free · 2 of 2 builds left/i.test(planModal)) pass('account-plan-row', planModal);
    else fail('account-plan-row', planModal);

    const built = await page.evaluate(() => {
      document.querySelectorAll('#toast-host .toast').forEach((el) => el.remove());
      const sm = document.getElementById('name-sm');
      const am1 = document.getElementById('name-am1');
      if (sm) sm.value = 'Pat Nguyen';
      if (am1) am1.value = 'Chris Ortiz';
      if (typeof persistManagerNames === 'function') persistManagerNames();
      if (typeof buildFromSetup === 'function') buildFromSetup();
      return new Promise((resolve) => {
        setTimeout(() => {
          const banner = document.getElementById('install-banner');
          const plan = document.getElementById('account-chip-plan');
          resolve({
            cells: document.querySelectorAll('#schedule-grid td.shift-editable').length,
            bannerShow: !!(banner && banner.classList.contains('show')),
            planText: (plan && plan.textContent || '').trim(),
            remaining: typeof remainingFreeGenerates === 'function' ? remainingFreeGenerates() : null,
            hasBuilt: typeof hasBuiltOnceForInstall === 'function' ? hasBuiltOnceForInstall() : null,
            lsBuilt: localStorage.getItem('msb_has_built_once'),
          });
        }, 1800);
      });
    });
    if (built.cells > 20 && built.hasBuilt && built.lsBuilt === '1') pass('first-build-marks-once', built.cells + ' cells');
    else fail('first-build-marks-once', JSON.stringify(built));
    if (built.bannerShow) pass('install-after-first-build');
    else fail('install-after-first-build', JSON.stringify(built));
    if (/Free · 1/i.test(built.planText) && built.remaining === 1) pass('chip-after-spend', built.planText);
    else fail('chip-after-spend', JSON.stringify(built));

    const dismissed = await page.evaluate(() => {
      if (typeof dismissInstallBanner === 'function') dismissInstallBanner();
      const banner = document.getElementById('install-banner');
      return {
        show: !!(banner && banner.classList.contains('show')),
        ls: localStorage.getItem('msb_install_dismissed'),
        ss: sessionStorage.getItem('msb_install_dismissed'),
      };
    });
    if (!dismissed.show && dismissed.ls === '1' && dismissed.ss === '1') pass('not-now-persists', 'ls+ss');
    else fail('not-now-persists', JSON.stringify(dismissed));

    const rebuilt = await page.evaluate(() => {
      if (typeof generateScheduleFromButton === 'function') generateScheduleFromButton();
      return new Promise((resolve) => {
        setTimeout(() => {
          const banner = document.getElementById('install-banner');
          if (typeof showInstallBanner === 'function') showInstallBanner();
          resolve({
            show: !!(banner && banner.classList.contains('show')),
            remaining: typeof remainingFreeGenerates === 'function' ? remainingFreeGenerates() : null,
          });
        }, 1600);
      });
    });
    if (!rebuilt.show && rebuilt.remaining === 1) pass('not-now-survives-rebuild');
    else fail('not-now-survives-rebuild', JSON.stringify(rebuilt));

    const nextP = await page.evaluate(() => {
      if (typeof startNextPeriodSameTeam === 'function') startNextPeriodSameTeam();
      if (typeof showInstallBanner === 'function') showInstallBanner();
      if (typeof maybeOfferInstall === 'function') maybeOfferInstall();
      const banner = document.getElementById('install-banner');
      return {
        show: !!(banner && banner.classList.contains('show')),
        ls: localStorage.getItem('msb_install_dismissed'),
      };
    });
    if (!nextP.show && nextP.ls === '1') pass('not-now-survives-next-period');
    else fail('not-now-survives-next-period', JSON.stringify(nextP));

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const afterReload = await page.evaluate(() => {
      if (typeof showInstallBanner === 'function') showInstallBanner();
      if (typeof maybeOfferInstall === 'function') maybeOfferInstall();
      const banner = document.getElementById('install-banner');
      const plan = document.getElementById('account-chip-plan');
      if (typeof openAccountPanel === 'function') openAccountPanel();
      const ap = (document.getElementById('ap-plan') || {}).textContent || '';
      if (typeof closeAccountPanel === 'function') closeAccountPanel();
      return {
        show: !!(banner && banner.classList.contains('show')),
        planText: (plan && plan.textContent || '').trim(),
        ap,
        remaining: typeof remainingFreeGenerates === 'function' ? remainingFreeGenerates() : null,
      };
    });
    if (!afterReload.show) pass('not-now-survives-reload');
    else fail('not-now-survives-reload', JSON.stringify(afterReload));
    if (/Free · 1/i.test(afterReload.planText) && /Free · 1 of 2 builds left/i.test(afterReload.ap)) {
      pass('plan-honest-after-reload', afterReload.ap);
    } else fail('plan-honest-after-reload', JSON.stringify(afterReload));

    const es = await page.evaluate(() => {
      if (typeof setUiLang === 'function') setUiLang('es');
      else if (typeof currentUiLang !== 'undefined') {
        currentUiLang = 'es';
        if (typeof refreshUiLangChrome === 'function') refreshUiLangChrome();
      }
      if (typeof updateAccountChip === 'function') updateAccountChip();
      if (typeof openAccountPanel === 'function') openAccountPanel();
      const chip = (document.getElementById('account-chip-plan') || {}).textContent || '';
      const ap = (document.getElementById('ap-plan') || {}).textContent || '';
      const setup = (document.getElementById('setup-gen-free-left') || {}).textContent || '';
      if (typeof closeAccountPanel === 'function') closeAccountPanel();
      return { chip: chip.trim(), ap: ap.trim(), setup: setup.trim() };
    });
    if (/Gratis · 1/i.test(es.chip) && /Gratis · 1 de 2 armados restantes/i.test(es.ap)) {
      pass('spanish-plan', es.ap);
    } else fail('spanish-plan', JSON.stringify(es));
  } catch (e) {
    fail('suite-error', e.stack || e.message || e);
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
