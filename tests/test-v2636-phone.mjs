/**
 * v2.6.37 phone UI smoke (360px): native time, 12px floor, 44px taps,
 * welcome two actions, Works offline label, cmdk hidden.
 * Run: node tests/test-v2636-phone.mjs
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

async function loadChromium() {
  const spec = join(ROOT, 'scripts/browser-ops/node_modules/playwright/index.mjs');
  if (!existsSync(spec)) throw new Error('Playwright not installed');
  const mod = await import(pathToFileURL(spec).href);
  return mod.chromium;
}

async function main() {
  console.log('\n=== v2.6.37 phone UI smoke ===');
  const { server, base } = await startStaticServer();
  const chromium = await loadChromium();
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 360, height: 740 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(() => {
      try {
        localStorage.setItem('msb_tour_done', '1');
        localStorage.removeItem('msb_welcome_dismissed');
      } catch (e) {}
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    const boot = await page.evaluate(() => {
      const cmdk = document.getElementById('btn-cmd-palette');
      const cmdkCs = cmdk ? getComputedStyle(cmdk) : { display: 'none' };
      const pill = document.querySelector('.offline-pill .pill-text');
      const pillCs = pill ? getComputedStyle(pill) : { display: 'none' };
      const actions = document.querySelector('.welcome-actions');
      const btns = actions ? [...actions.querySelectorAll('button')].map((b) => (b.textContent || '').trim()) : [];
      const x = document.querySelector('.welcome-dismiss-x');
      const dismissInRow = btns.some((t) => /^dismiss$/i.test(t));
      const h1 = document.querySelector('.app-header h1');
      const more = document.getElementById('header-more-btn');
      const h1r = h1 ? h1.getBoundingClientRect() : { width: 0, height: 0, right: 0, bottom: 0 };
      const moreR = more ? more.getBoundingClientRect() : { width: 0, height: 0, left: 0, top: 0 };
      const overlap = h1 && more
        && h1r.right > moreR.left + 8
        && h1r.bottom > moreR.top + 8
        && moreR.right > h1r.left + 8
        && moreR.bottom > h1r.top + 8;
      return {
        version: (document.getElementById('app-version-label') || {}).textContent,
        cmdkDisplay: cmdkCs.display,
        cmdkW: cmdk ? cmdk.getBoundingClientRect().width : 0,
        pillText: (pill && pill.textContent || '').trim(),
        pillDisplay: pillCs.display,
        welcomeBtns: btns,
        hasX: !!x,
        dismissInRow,
        xH: x ? x.getBoundingClientRect().height : 0,
        wordmark: (h1 && h1.textContent || '').trim(),
        moreW: moreR.width,
        moreH: moreR.height,
        overlap,
      };
    });

    if (/v2\.6\.37/.test(boot.version || '')) pass('in-app-version', boot.version);
    else fail('in-app-version', boot.version);
    if (boot.cmdkDisplay === 'none' || boot.cmdkW === 0) pass('cmdk-hidden', boot.cmdkDisplay);
    else fail('cmdk-hidden', JSON.stringify(boot));
    if (/works offline/i.test(boot.pillText) && boot.pillDisplay !== 'none') pass('offline-label', boot.pillText);
    else fail('offline-label', JSON.stringify({ t: boot.pillText, d: boot.pillDisplay }));
    if (boot.welcomeBtns.length === 2
      && /start with my team/i.test(boot.welcomeBtns[0])
      && /see a sample/i.test(boot.welcomeBtns[1])
      && boot.hasX && !boot.dismissInRow) {
      pass('welcome-two-actions', boot.welcomeBtns.join(' | '));
    } else fail('welcome-two-actions', JSON.stringify(boot));
    if (boot.xH >= 44) pass('welcome-x-44', boot.xH + 'px');
    else fail('welcome-x-44', boot.xH + 'px');
    if (/Manager Schedule Builder/i.test(boot.wordmark || '') && !/^Schedule Pro$/i.test(boot.wordmark || '')) {
      pass('header-wordmark', boot.wordmark);
    } else fail('header-wordmark', boot.wordmark);
    if (boot.moreW >= 40 && boot.moreH >= 40 && !boot.overlap) pass('more-tappable', boot.moreW + 'x' + boot.moreH);
    else fail('more-tappable', JSON.stringify({ w: boot.moreW, h: boot.moreH, overlap: boot.overlap }));

    await page.evaluate(() => {
      try { if (typeof toggleShiftTimesPanel === 'function') toggleShiftTimesPanel(); } catch (e) {}
      try { if (typeof toggleStoreHoursPanel === 'function') toggleStoreHoursPanel(); } catch (e) {}
    });
    await page.waitForTimeout(200);
    const times = await page.evaluate(() => {
      const st = document.querySelector('#st-start-open-late, [id^="st-start-"]');
      const sh = document.querySelector('#sh-open-1, [id^="sh-open-"]');
      return {
        stType: st && st.type,
        stVal: st && st.value,
        shType: sh && sh.type,
        shVal: sh && sh.value,
      };
    });
    if (times.stType === 'time' && times.shType === 'time') pass('native-time-inputs', JSON.stringify(times));
    else fail('native-time-inputs', JSON.stringify(times));

    const taps = await page.evaluate(() => {
      const sample = document.querySelector('#btn-tour-sample');
      const edit = document.querySelector('.store-hours-chip button');
      const mh = (el) => (el ? parseFloat(getComputedStyle(el).minHeight) : 0);
      return {
        sampleH: sample ? Math.max(sample.getBoundingClientRect().height, mh(sample)) : 0,
        editMin: mh(edit),
      };
    });
    if (taps.sampleH >= 44) pass('sample-btn-44', taps.sampleH + 'px');
    else fail('sample-btn-44', taps.sampleH + 'px');
    if (taps.editMin >= 44) pass('store-hours-edit-44', taps.editMin + 'px min-height');
    else fail('store-hours-edit-44', JSON.stringify(taps));

    await page.evaluate(() => {
      try { loadDemoStore({ explicit: true }); } catch (e) {}
      try { if (typeof buildInputCalendar === 'function') buildInputCalendar(activeTab || 'sm'); } catch (e2) {}
    });
    await page.waitForTimeout(600);
    const paint = await page.evaluate(() => {
      const tag = document.querySelector('.cal-cell .cell-tag');
      const day = document.querySelector('.cal-cell .day-num');
      const head = document.querySelector('.cal-header');
      const px = (el) => (el ? parseFloat(getComputedStyle(el).fontSize) : null);
      return {
        tagPx: px(tag),
        dayPx: px(day),
        headPx: px(head),
        tagText: tag ? tag.textContent : '',
      };
    });
    const floorOk = [paint.tagPx, paint.dayPx, paint.headPx].every((n) => n == null || n >= 12);
    if (floorOk && (paint.tagPx != null || paint.dayPx != null)) pass('type-12px-floor', JSON.stringify(paint));
    else fail('type-12px-floor', JSON.stringify(paint));

    await page.goto(base + '/buy.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const buyBrand = await page.evaluate(() => {
      const el = document.querySelector('.brand');
      return {
        text: (el && el.textContent || '').replace(/\s+/g, ' ').trim(),
        title: document.title,
      };
    });
    if (/Manager Schedule Builder Pro/i.test(buyBrand.text) && /Manager Schedule Builder Pro/i.test(buyBrand.title)) {
      pass('buy-brand', buyBrand.text);
    } else fail('buy-brand', JSON.stringify(buyBrand));
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
