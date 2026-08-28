/**
 * v2.6.8 Play-launch polish: clopen copy, generate toasts, next-period tab,
 * feedback page, hide Publish setup, first-run offline, AM close-floor warn.
 * Run: node tests/test-v267-play-polish.mjs
 */
import { chromium } from '../scripts/browser-ops/node_modules/playwright/index.mjs';
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

function toastText() {
  const t = document.querySelector('#toast-host .toast-msg');
  return t ? t.textContent : '';
}

async function main() {
  console.log('\n=== v2.6.8 Play-launch polish ===');

  const version = JSON.parse(read('version.json'));
  if (version.version === '2.6.23') pass('version.json', version.version);
  else fail('version.json', JSON.stringify(version));

  const sw = read('sw.js');
  if (sw.includes("const CACHE = 'msb-pro-v2.6.23'")) pass('sw-cache');
  else fail('sw-cache', sw.slice(0, 120));
  if (sw.includes("'./feedback.html'") || sw.includes('"./feedback.html"')) pass('sw-precache-feedback');
  else fail('sw-precache-feedback', 'feedback.html missing from PRECACHE');

  const index = read('index.html');
  const buy = read('buy.html');
  const manifest = read('manifest.webmanifest');
  const feedback = read('feedback.html');
  const stagingPs1 = read('scripts/publish-staging.ps1');

  if (index.includes("const APP_VERSION = '2.6.23'") && index.includes('id="app-version-label">v2.6.23')) {
    pass('index-version');
  } else fail('index-version', 'APP_VERSION / label mismatch');

  if (index.includes('Manager shifts · NRF periods · Fair weekends · Review before you post')) {
    pass('subtitle');
  } else fail('subtitle', 'old No clopens subtitle still present?');

  const served = [
    ['index.html', index],
    ['buy.html', buy],
    ['manifest.webmanifest', manifest],
    ['feedback.html', feedback],
  ];
  for (const [name, text] of served) {
    const hits = [];
    if (/No clopens/i.test(text)) hits.push('No clopens');
    if (/clopen-free/i.test(text)) hits.push('clopen-free');
    if (/zero clopen/i.test(text)) hits.push('zero clopen');
    const userHits = hits.filter(() => true);
    if (userHits.length && name === 'index.html') {
      const engineOnly = !/subtitle">[^<]*No clopens/i.test(text)
        && !/tips\.push\('No clopens/i.test(text)
        && !/bar\('No clopens'/i.test(text)
        && !/og:description[^>]*no clopens/i.test(text);
      const remainingUi = [];
      if (/subtitle">[^<]*No clopens/i.test(text)) remainingUi.push('subtitle');
      if (/tips\.push\('No clopens/i.test(text)) remainingUi.push('tips');
      if (/bar\('No clopens'/i.test(text)) remainingUi.push('bar');
      if (/og:description[^>]*no clopens/i.test(text)) remainingUi.push('og');
      if (remainingUi.length) fail('copy-' + name, remainingUi.join(','));
      else pass('copy-' + name, 'engine comments only');
    } else if (userHits.length) {
      fail('copy-' + name, userHits.join(','));
    } else {
      pass('copy-' + name);
    }
  }

  if (/Load this NRF period on Setup first/.test(index)
    && /Name your managers on Setup before building/.test(index)
    && /function generateSchedule\(/.test(index)) {
    pass('generate-toasts-in-source');
  } else fail('generate-toasts-in-source', 'missing generateSchedule guards');

  if (/switchTab\('requests'\)/.test(index) && /Paint next period RTO\/PTO, then Build/.test(index)) {
    pass('next-period-source');
  } else fail('next-period-source', 'startNextPeriodSameTeam not updated');

  if (/Publish setup/.test(index) || /location\.href='install\.html'/.test(index)) {
    fail('no-publish-setup-chrome', 'install.html still linked from index.html');
  } else pass('no-publish-setup-chrome');

  const PLAY_LISTING = 'https://play.google.com/store/apps/details?id=com.managerschedulebuilder.pro';
  const listing = read('store/listing.html');
  if (index.includes(PLAY_LISTING) && /Get it on Google Play/.test(index) && /id="welcome-play-link"/.test(index)) {
    pass('homepage-play-store-url');
  } else fail('homepage-play-store-url', 'Play listing link missing from homepage hero');
  if (buy.includes(PLAY_LISTING) && /Get it on Google Play/.test(buy)) {
    pass('buy-play-store-url');
  } else fail('buy-play-store-url', 'Play listing link missing from buy.html');
  if (listing.includes('Retail schedule for manager shifts. NRF 4-5-4, PTO, offline. No login.')
    && listing.includes('Schedule Pro is an offline retail manager scheduler for store managers and key carriers.')) {
    pass('listing-short-and-lede');
  } else fail('listing-short-and-lede', 'store/listing.html copy not updated');

  if (/mailto:b\.ralston62989@gmail\.com/.test(index) || /mailto:b\.ralston62989@gmail\.com/.test(feedback)) {
    fail('no-mailto-in-app', 'raw support mailto in scheduler or feedback.html');
  } else pass('no-mailto-in-app');

  if (/id: 'feedback'/.test(index) && !/id: 'publish'/.test(index) && !/label: 'Sign in'/.test(index)) {
    pass('cmdk-feedback-no-sso-publish');
  } else fail('cmdk-feedback-no-sso-publish', 'palette entries unexpected');

  if (/html lang="en" class="auth-locked"/.test(index) || /<html[^>]*auth-locked/.test(index)) {
    fail('html-not-auth-locked-default', 'html starts auth-locked');
  } else pass('html-not-auth-locked-default');

  if (/#auth-shell \{\s*display: none;/m.test(index) && /html\.auth-locked #auth-shell \{ display: flex; \}/.test(index)) {
    pass('auth-shell-hidden-css');
  } else fail('auth-shell-hidden-css', 'default #auth-shell display');

  const floor = index.match(/if \(closes < minTarget\) \{\s*v\('(\w+)', 'am-close-2'/);
  if (floor && floor[1] === 'warning') pass('am-close-2-floor-warning');
  else fail('am-close-2-floor-warning', floor ? floor[1] : 'not found');

  const FORM_ID = '1FAIpQLSdTItic0S6Z0PPjZHqMrxCOuOTJ-kDpEeZPMssry-14DCqq4Q';
  if (!existsSync(join(ROOT, 'feedback.html'))) fail('feedback-file', 'missing');
  else if (!/Send feedback/.test(feedback) || !feedback.includes(FORM_ID) || /mailto:/i.test(feedback)) {
    fail('feedback-file', 'must be a thin Google Form redirect with no mailto');
  } else pass('feedback-file');

  if (/feedback\.html/.test(stagingPs1)) pass('publish-staging-lists-feedback');
  else fail('publish-staging-lists-feedback', 'scripts/publish-staging.ps1');

  const { server, base } = await startStaticServer();
  const browser = await chromium.launch({
    executablePath: existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  try {
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
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

    const boot = await page.evaluate(() => {
      const shell = document.getElementById('auth-shell');
      const cs = shell ? getComputedStyle(shell) : null;
      const footer = (document.querySelector('.app-footer') || {}).innerText || '';
      const more = [...document.querySelectorAll('#header-menu-panel button')].map((b) => (b.textContent || '').trim());
      return {
        ver: typeof APP_VERSION !== 'undefined' ? APP_VERSION : '',
        authLocked: document.documentElement.classList.contains('auth-locked'),
        shellDisplay: cs ? cs.display : 'missing',
        footerHasPublish: /Publish setup/i.test(footer),
        moreHasInstall: more.some((t) => /Install \/ Play|Publish setup/i.test(t)),
        moreHasFeedback: more.includes('Send feedback'),
        footerHasFeedback: /Send feedback/i.test(footer),
        subtitle: (document.querySelector('.subtitle') || {}).textContent || '',
      };
    });
    if (boot.ver === '2.6.23') pass('live-app-version', boot.ver);
    else fail('live-app-version', boot.ver);
    if (!boot.authLocked && boot.shellDisplay === 'none') pass('first-run-offline-no-auth-shell', boot.shellDisplay);
    else fail('first-run-offline-no-auth-shell', JSON.stringify(boot));
    if (!boot.footerHasPublish && !boot.moreHasInstall) pass('chrome-hides-publish-setup');
    else fail('chrome-hides-publish-setup', JSON.stringify(boot));
    if (boot.moreHasFeedback && boot.footerHasFeedback) pass('chrome-send-feedback');
    else fail('chrome-send-feedback', JSON.stringify(boot));
    if (/Review before you post/.test(boot.subtitle) && !/No clopens/i.test(boot.subtitle)) pass('live-subtitle');
    else fail('live-subtitle', boot.subtitle);

    const noPeriod = await page.evaluate(() => {
      document.querySelectorAll('#toast-host .toast').forEach((el) => el.remove());
      periodDates = [];
      currentPeriod = null;
      if (typeof generateSchedule === 'function') generateSchedule();
      const toasts = [...document.querySelectorAll('#toast-host .toast-msg')].map((el) => el.textContent || '');
      return {
        toast: toasts[toasts.length - 1] || '',
        tab: typeof currentAppTab !== 'undefined' ? currentAppTab : '',
      };
    });
    if (/Load this NRF period/.test(noPeriod.toast) && noPeriod.tab === 'setup') pass('generate-no-period', noPeriod.toast);
    else fail('generate-no-period', JSON.stringify(noPeriod));

    const noNames = await page.evaluate(() => {
      document.querySelectorAll('#toast-host .toast').forEach((el) => el.remove());
      if (typeof loadPeriod === 'function') loadPeriod();
      const sm = document.getElementById('name-sm');
      if (sm) sm.value = 'Store Manager';
      const am1 = document.getElementById('name-am1');
      const am2 = document.getElementById('name-am2');
      if (am1) am1.value = 'AM1';
      if (am2) am2.value = 'AM2';
      if (typeof persistManagerNames === 'function') persistManagerNames();
      if (typeof generateSchedule === 'function') generateSchedule();
      return {
        toast: (document.querySelector('#toast-host .toast-msg') || {}).textContent || '',
        tab: typeof currentAppTab !== 'undefined' ? currentAppTab : '',
        named: typeof managersAreNamed === 'function' ? managersAreNamed() : null,
      };
    });
    if (/Name your managers/.test(noNames.toast) && noNames.tab === 'setup' && noNames.named === false) {
      pass('generate-unnamed', noNames.toast);
    } else fail('generate-unnamed', JSON.stringify(noNames));

    const nextP = await page.evaluate(() => {
      document.querySelectorAll('#toast-host .toast').forEach((el) => el.remove());
      if (typeof loadPeriod === 'function') loadPeriod();
      if (typeof startNextPeriodSameTeam === 'function') startNextPeriodSameTeam();
      return {
        toast: (document.querySelector('#toast-host .toast-msg') || {}).textContent || '',
        tab: typeof currentAppTab !== 'undefined' ? currentAppTab : '',
        hasPeriod: !!(typeof periodDates !== 'undefined' && periodDates && periodDates.length && currentPeriod),
      };
    });
    if (nextP.hasPeriod && nextP.tab === 'requests' && /Paint next period RTO\/PTO/.test(nextP.toast)) {
      pass('next-period-requests', nextP.toast);
    } else fail('next-period-requests', JSON.stringify(nextP));

    const fbResp = await page.goto(base + '/feedback.html?v=2.6.8', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const fbUrl = page.url();
    const fbHtml = await page.content();
    const formHit = /1FAIpQLSdTItic0S6Z0PPjZHqMrxCOuOTJ-kDpEeZPMssry-14DCqq4Q/.test(fbUrl + fbHtml)
      || /docs\.google\.com\/forms/.test(fbUrl);
    const mailed = /mailto:b\.ralston62989@gmail\.com/i.test(fbHtml);
    if (formHit && !mailed) pass('feedback-page', fbUrl);
    else fail('feedback-page', JSON.stringify({ fbUrl, mailed, status: fbResp && fbResp.status() }));
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
