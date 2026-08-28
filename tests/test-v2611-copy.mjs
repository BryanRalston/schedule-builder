/**
 * v2.6.11 leftover copy: clopen preference language, Form feedback, phone Export.
 * Run: node tests/test-v2611-copy.mjs
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
  const candidates = [
    join(ROOT, 'scripts/browser-ops/node_modules/playwright/index.mjs'),
    '/tmp/node_modules/playwright-core/index.mjs',
  ];
  for (const spec of candidates) {
    if (!existsSync(spec)) continue;
    const mod = await import(pathToFileURL(spec).href);
    if (mod.chromium) return mod.chromium;
  }
  throw new Error('Playwright not installed');
}

function userFacingBanHits(text) {
  const hits = [];
  if (/clopening ban/i.test(text) && !/\/\/ MUST be mid/.test(text)) hits.push('clopening ban');
  if (/On by default \(hard constraint\)/i.test(text)) hits.push('default hard constraint');
  if (/clopen-free/i.test(text)) hits.push('clopen-free');
  if (/zero clopen/i.test(text)) hits.push('zero clopen');
  if (/Hard constraints \(PTO\/RTO\/LOA, coverage, clopening ban/i.test(text)) hits.push('rules footer ban');
  return hits;
}

async function main() {
  console.log('\n=== v2.6.11 clopen preference + feedback copy ===');

  const version = JSON.parse(read('version.json'));
  if (version.version === '2.6.16') pass('version.json', version.version);
  else fail('version.json', JSON.stringify(version));

  const sw = read('sw.js');
  if (sw.includes("const CACHE = 'msb-pro-v2.6.16'")) pass('sw-cache');
  else fail('sw-cache', sw.slice(0, 120));

  const index = read('index.html');
  const feedback = read('feedback.html');
  const terms = read('legal/terms.html');
  const privacy = read('legal/privacy.html');
  const mon = read('monetization.json');

  if (index.includes("const APP_VERSION = '2.6.16'") && index.includes('id="app-version-label">v2.6.16')) {
    pass('index-version');
  } else fail('index-version', 'APP_VERSION / label mismatch');

  const banHits = userFacingBanHits(index);
  if (!banHits.length) pass('no-user-facing-clopen-ban');
  else fail('no-user-facing-clopen-ban', banHits.join(','));

  if (/Clopen-avoidance is a preference — not a guarantee/.test(index)
    && /a preference, not a guarantee/.test(index)
    && /sev: 'review'/.test(index)
    && /Preference: close followed by open the next morning/.test(index)) {
    pass('rules-and-review-preference-copy');
  } else fail('rules-and-review-preference-copy', 'expected preference sentences missing');

  if (/#schedule-toolbar \.toolbar-menu \{ display: none; \}/.test(index)
    && /Export Word/.test(index)
    && /id="toolbar-export-btn"/.test(index)) {
    pass('phone-export-hidden-toolbar-kept-in-more');
  } else fail('phone-export-hidden-toolbar-kept-in-more', 'toolbar/More export wiring');

  if (/mailto:b\.ralston62989@gmail\.com/.test(index) || /mailto:b\.ralston62989@gmail\.com/.test(feedback)) {
    fail('no-feedback-mailto', 'scheduler or feedback.html still mailto Gmail');
  } else pass('no-feedback-mailto');

  if (/mailto:b\.ralston62989@gmail\.com/.test(terms) || /mailto:b\.ralston62989@gmail\.com/.test(privacy)) {
    fail('legal-no-gmail-mailto', 'legal pages still mailto Gmail');
  } else pass('legal-no-gmail-mailto');

  if (/feedback\.html/.test(terms) && /Send feedback/.test(terms) && /feedback\.html/.test(privacy)) {
    pass('legal-points-to-form');
  } else fail('legal-points-to-form', 'legal pages missing Form path');

  if (/"feedbackPath": "feedback.html"/.test(mon)) pass('monetization-feedback-path');
  else fail('monetization-feedback-path', 'monetization.json');

  if (/New phone\? More → Backup JSON, then Load/.test(index)
    && /New phone\? Export a JSON backup, then Load/.test(index)
    && /Backup JSON — new phone/.test(index)
    && !/Credential Manager|cloud sync/i.test(index)) {
    pass('new-phone-backup-hint');
  } else fail('new-phone-backup-hint', 'Setup/More/review backup copy');

  const FORM_ID = '1FAIpQLSdTItic0S6Z0PPjZHqMrxCOuOTJ-kDpEeZPMssry-14DCqq4Q';
  const chromium = await loadChromium();
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

    await page.locator('#btn-start-with-team').click();
    await page.waitForTimeout(400);
    const started = await page.evaluate(() => ({
      welcomeHidden: !document.getElementById('welcome-card') || getComputedStyle(document.getElementById('welcome-card')).display === 'none',
      tab: currentAppTab,
    }));
    if (started.welcomeHidden && started.tab === 'setup') pass('playtest-start-with-team');
    else fail('playtest-start-with-team', JSON.stringify(started));

    const built = await page.evaluate(() => {
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
            cells: document.querySelectorAll('#schedule-grid td.shift-editable').length,
            toast: [...document.querySelectorAll('#toast-host .toast-msg')].map((el) => el.textContent).pop() || '',
          });
        }, 1600);
      });
    });
    if (built.tab === 'schedule' && built.cells > 20 && /Schedule ready/.test(built.toast)) {
      pass('playtest-build', built.cells + ' cells');
    } else fail('playtest-build', JSON.stringify(built));

    await page.evaluate(() => switchTab('rules'));
    await page.waitForTimeout(200);
    const rules = await page.evaluate(() => {
      const footer = document.querySelector('#tab-rules .text-muted')?.textContent || '';
      const desc = document.querySelector('#pref-avoid-clopen')?.closest('.pref-card')?.querySelector('.pref-desc')?.textContent || '';
      const body = document.getElementById('tab-rules')?.innerText || '';
      return { footer, desc, body };
    });
    if (/preference — not a guarantee/i.test(rules.footer) && /preference, not a guarantee/i.test(rules.desc)
      && !/clopening ban/i.test(rules.body) && !/hard constraint/i.test(rules.desc)) {
      pass('playtest-rules-copy');
    } else fail('playtest-rules-copy', JSON.stringify(rules));

    const review = await page.evaluate(() => {
      if (typeof openReviewSheet === 'function') openReviewSheet();
      const sheet = document.getElementById('review-sheet');
      const text = (sheet && sheet.innerText) || '';
      const mustClopen = /must[\s-]clopen|must avoid clopen|clopen(?:ing)? (?:is )?(?:a )?must|must have (?:zero |no )?clopen/i.test(text);
      const ban = /clopening ban|clopen-free|zero clopen/i.test(text)
        || /clopen[\s\S]{0,40}hard constraint|hard constraint[\s\S]{0,40}clopen/i.test(text);
      return {
        open: !!(sheet && !sheet.hidden),
        mustClopen,
        ban,
        hasPreference: /preference/i.test(text) || /Review before you post/i.test(text) || /review leftover/i.test(text) || /Clopen/i.test(text),
        backupHint: /New phone\? Export a JSON backup/i.test(text) && /Backup JSON — new phone/.test(text),
      };
    });
    if (review.open && !review.mustClopen && !review.ban && review.backupHint) pass('playtest-review-sheet');
    else fail('playtest-review-sheet', JSON.stringify(review));

    const exportUi = await page.evaluate(() => {
      const toolbarMenu = document.querySelector('#schedule-toolbar .toolbar-menu');
      const more = [...document.querySelectorAll('#header-menu-panel button')].map((b) => (b.textContent || '').trim());
      const hint = (document.querySelector('#header-menu-panel .header-menu-hint') || {}).textContent || '';
      const setup = (document.querySelector('#tab-setup .tab-panel-desc') || {}).textContent || '';
      const cs = toolbarMenu ? getComputedStyle(toolbarMenu) : null;
      return {
        toolbarHidden: !toolbarMenu || cs.display === 'none',
        moreHasExport: more.some((t) => /Export Word|Export Excel/i.test(t)),
        moreBackup: more.some((t) => /Backup JSON — new phone/.test(t)),
        moreHint: /New phone\? Export a JSON backup/.test(hint),
        setupNote: /New phone\? More → Backup JSON/.test(setup),
      };
    });
    if (exportUi.toolbarHidden && exportUi.moreHasExport && exportUi.moreBackup && exportUi.moreHint && exportUi.setupNote) {
      pass('playtest-phone-export');
    } else fail('playtest-phone-export', JSON.stringify(exportUi));

    const fb = await page.evaluate(() => {
      const href = typeof openFeedbackPage === 'function' ? null : 'missing';
      return { hasFn: typeof openFeedbackPage === 'function', href };
    });
    if (!fb.hasFn) fail('playtest-feedback-fn', 'openFeedbackPage missing');
    else {
      const fbPage = await browser.newPage();
      await fbPage.goto(base + '/feedback.html?v=2.6.16', { waitUntil: 'domcontentloaded', timeout: 30000 });
      const html = await fbPage.content();
      const url = fbPage.url();
      const formHit = html.includes(FORM_ID) || /docs\.google\.com\/forms/.test(url + html);
      const mailed = /mailto:b\.ralston62989@gmail\.com/i.test(html);
      if (formHit && !mailed) pass('playtest-feedback-form');
      else fail('playtest-feedback-form', JSON.stringify({ url, mailed, formHit }));
      await fbPage.close();
    }
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
