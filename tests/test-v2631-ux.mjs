/**
 * v2.6.31: split-day MSP Play / TWA / PWA icon + cache bump.
 * Does not touch generate, close, first-visit, or Spanish.
 * Keeps generate suites 2.6.12–2.6.30; version lock 2.6.31.
 * Run: node tests/test-v2631-ux.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { join, dirname } from 'path';
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

function read(rel) {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function readBin(rel) {
  return readFileSync(join(ROOT, rel));
}

const OLD_ICON_512_SHA256 =
  '036e40a2b4326d3e0748d690d0de632520cc53be829ae07464e9d9fe1e45f95a';

const MANIFEST_ICON_PATHS = [
  'icons/icon-48.png',
  'icons/icon-72.png',
  'icons/icon-96.png',
  'icons/icon-128.png',
  'icons/icon-144.png',
  'icons/icon-192.png',
  'icons/icon-256.png',
  'icons/icon-384.png',
  'icons/icon-512.png',
  'icons/icon-192-maskable.png',
  'icons/icon-512-maskable.png',
];

function pngSize(buf) {
  if (buf.length < 24 || buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
    return null;
  }
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function main() {
  console.log('\n=== v2.6.31 split-day MSP icon + cache bump ===');

  const version = JSON.parse(read('version.json'));
  if (version.version === '2.6.31') pass('version.json', version.version);
  else fail('version.json', JSON.stringify(version));

  const sw = read('sw.js');
  if (sw.includes("const CACHE = 'msb-pro-v2.6.31'")) pass('sw-cache');
  else fail('sw-cache', sw.slice(0, 120));

  const index = read('index.html');
  if (index.includes("const APP_VERSION = '2.6.31'") && index.includes('id="app-version-label">v2.6.31')) {
    pass('index-version');
  } else fail('index-version', 'APP_VERSION / label mismatch');

  const generateTouched =
    /function leftoverMustFixViolations\(/.test(index) === false ||
    /function generateScheduleFromButton\(/.test(index) === false;
  if (generateTouched) fail('generate-untouched', 'generate helpers missing — do not ship a generate rewrite');
  else pass('generate-untouched');

  const manifest = JSON.parse(read('manifest.webmanifest'));
  const srcs = (manifest.icons || []).map((i) => i.src);
  const missing = MANIFEST_ICON_PATHS.filter((p) => !srcs.includes(p));
  const extra = srcs.filter((p) => !MANIFEST_ICON_PATHS.includes(p));
  if (!missing.length && !extra.length) pass('manifest-icon-paths', srcs.length + ' slots');
  else fail('manifest-icon-paths', JSON.stringify({ missing, extra }));

  for (const rel of MANIFEST_ICON_PATHS) {
    const full = join(ROOT, rel);
    if (!existsSync(full)) {
      fail('icon-exists-' + rel, 'missing');
      continue;
    }
    const buf = readBin(rel);
    const dim = pngSize(buf);
    if (!dim) fail('icon-png-' + rel, 'not a PNG');
    else pass('icon-png-' + rel, dim.w + 'x' + dim.h);
  }

  const icon512 = readBin('icons/icon-512.png');
  const dim512 = pngSize(icon512);
  if (dim512 && dim512.w === 512 && dim512.h === 512) pass('icon-512-size', '512x512');
  else fail('icon-512-size', JSON.stringify(dim512));

  const hash = createHash('sha256').update(icon512).digest('hex');
  if (hash !== OLD_ICON_512_SHA256) pass('icon-512-not-old-calendar', hash.slice(0, 12) + '…');
  else fail('icon-512-not-old-calendar', 'still the old calendar hash');

  const fav32 = join(ROOT, 'icons/favicon-32.png');
  const play = join(ROOT, 'store/play-assets/hi-res-icon-512.png');
  const twa = join(ROOT, 'android-twa/store_icon.png');
  const launcher = join(ROOT, 'android-twa/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png');
  for (const [name, p] of [
    ['favicon-32', fav32],
    ['play-hi-res', play],
    ['twa-store-icon', twa],
    ['twa-launcher-xxxhdpi', launcher],
  ]) {
    if (!existsSync(p)) fail(name, 'missing');
    else {
      const dim = pngSize(readFileSync(p));
      if (dim) pass(name, dim.w + 'x' + dim.h);
      else fail(name, 'not a PNG');
    }
  }

  if (index.includes('rel="apple-touch-icon" href="icons/icon-192.png"')
    && index.includes('rel="apple-touch-icon" sizes="180x180" href="icons/icon-192.png"')) {
    pass('apple-touch-icon-192');
  } else fail('apple-touch-icon-192', 'apple-touch does not point at icons/icon-192.png');

  const icoRoot = join(ROOT, 'favicon.ico');
  if (!existsSync(icoRoot)) fail('favicon-ico', 'missing repo-root favicon.ico');
  else {
    const ico = readFileSync(icoRoot);
    if (ico[0] === 0 && ico[1] === 0 && ico[2] === 1 && ico[3] === 0) pass('favicon-ico', ico.length + ' bytes');
    else fail('favicon-ico', 'not an ICO');
  }
  if (index.includes('rel="icon" href="favicon.ico"') && sw.includes("'./favicon.ico'")) {
    pass('favicon-ico-wired');
  } else fail('favicon-ico-wired', 'index or sw.js missing favicon.ico');

  if (index.includes('id="install-banner"')
    && /class="ib-icon"[^>]*>\s*<img src="icons\/icon-192\.png"/.test(index)) {
    pass('install-banner-icon');
  } else fail('install-banner-icon', 'Install banner does not use icons/icon-192.png');

  if (/<header[\s\S]*class="brand-row"/.test(index)
    && !/class="brand-row"[\s\S]{0,400}<img[^>]+icon-/.test(index)) {
    pass('header-wordmark-only');
  } else fail('header-wordmark-only', 'header grew a graphical logo');

  // Live in-app mark is the Install banner (header / account / welcome / Pro are text-only).
  const liveMarkImgs = [...index.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const leftoverArt = liveMarkImgs.filter((tag) =>
    /src="(?!icons\/icon-(?:192|512)(?:-maskable)?\.png)[^"]+"/i.test(tag)
    && /icon|logo|mark|favicon/i.test(tag)
  );
  if (!leftoverArt.length) pass('live-mark-paths', liveMarkImgs.length + ' img tags');
  else fail('live-mark-paths', leftoverArt.join(' | '));

  function sliceBetween(src, startRe, endRe) {
    const s = src.search(startRe);
    if (s < 0) return '';
    const rest = src.slice(s);
    const e = rest.search(endRe);
    return e < 0 ? rest : rest.slice(0, e);
  }
  const accountHtml = sliceBetween(index, /id="account-modal"/, /id="license-modal"/);
  const welcomeHtml = sliceBetween(index, /id="welcome-card"/, /class="workspace /);
  const proHtml = sliceBetween(index, /id="pro-gate-modal"/, /id="account-modal"/);
  if (accountHtml && !/<img\b/i.test(accountHtml)) pass('account-text-only');
  else fail('account-text-only', 'account chrome has an img or is missing');
  if (welcomeHtml && !/<img\b/i.test(welcomeHtml)) pass('welcome-text-only');
  else fail('welcome-text-only', 'welcome chrome has an img or is missing');
  if (proHtml && !/<img\b/i.test(proHtml)) pass('pro-gate-text-only');
  else fail('pro-gate-text-only', 'Pro modal has an img or is missing');

  const buy = read('buy.html');
  if (/<img src="icons\/icon-192\.png" alt="" width="36" height="36">/.test(buy)) {
    pass('buy-brand-icon');
  } else fail('buy-brand-icon', 'buy.html brand img is not icons/icon-192.png');

  const playHi = createHash('sha256').update(readBin('store/play-assets/hi-res-icon-512.png')).digest('hex');
  const icon512Hash = createHash('sha256').update(icon512).digest('hex');
  if (playHi === icon512Hash) pass('play-hi-res-matches-icon-512');
  else fail('play-hi-res-matches-icon-512', 'Play 512 copy drifted from icons/icon-512.png');

  const failed = results.filter((r) => !r.ok);
  console.log('\n' + results.length + ' checks, ' + failed.length + ' failed');
  if (failed.length) process.exitCode = 1;
}

main();
