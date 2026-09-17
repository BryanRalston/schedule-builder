/**
 * v2.6.50: GA4 gtag on landing + /app/ uses MSP measurement ID only.
 * Run: node tests/test-v2650-ga4-gtag.mjs
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MSP_ID = 'G-LJ8E69Z8Y0';
const COSMIC_ID = 'G-D272MF8NQP';
const GTAG_SRC = 'https://www.googletagmanager.com/gtag/js?id=' + MSP_ID;
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

function walkFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules' || name === 'tests') continue;
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) walkFiles(abs, acc);
    else acc.push(abs);
  }
  return acc;
}

function hasStandardSnippet(html) {
  return (
    html.includes(GTAG_SRC) &&
    html.includes("gtag('config', '" + MSP_ID + "')") &&
    html.includes('www.googletagmanager.com/gtag/js?id=' + MSP_ID)
  );
}

console.log('\n=== v2.6.50 GA4 gtag (MSP) ===');

const landing = read('index.html');
const app = read('app/index.html');
const sw = read('sw.js');
const privacy = read('legal/privacy.html');
const ver = JSON.parse(read('version.json'));

if (hasStandardSnippet(landing)) pass('landing-gtag', MSP_ID);
else fail('landing-gtag', 'root index.html missing standard gtag snippet');

if (hasStandardSnippet(app)) pass('app-gtag', MSP_ID);
else fail('app-gtag', 'app/index.html missing standard gtag snippet');

if (!landing.includes(COSMIC_ID) && !app.includes(COSMIC_ID)) {
  pass('no-cosmic-id-in-html');
} else fail('no-cosmic-id-in-html', 'Cosmic measurement ID must not appear on MSP');

const textExt = new Set(['.html', '.js', '.json', '.md', '.mjs', '.txt', '.xml', '.webmanifest']);
const cosmicHits = [];
for (const abs of walkFiles(ROOT)) {
  if (!textExt.has(extname(abs))) continue;
  const body = readFileSync(abs, 'utf8');
  if (body.includes(COSMIC_ID)) cosmicHits.push(abs.slice(ROOT.length + 1));
}
if (!cosmicHits.length) pass('no-cosmic-id-in-repo');
else fail('no-cosmic-id-in-repo', cosmicHits.join(', '));

if (
  landing.includes('canonical" href="https://managerschedulepro.com/"') &&
  app.includes('canonical" href="https://managerschedulepro.com/app/"') &&
  !/canonical" href="https:\/\/www\.managerschedulepro\.com/.test(landing) &&
  !/canonical" href="https:\/\/www\.managerschedulepro\.com/.test(app)
) {
  pass('canonical-apex');
} else fail('canonical-apex', 'canonicals must stay on apex, not www');

if (
  /Google Analytics/i.test(privacy) &&
  /understand traffic/i.test(privacy)
) {
  pass('privacy-mentions-analytics');
} else fail('privacy-mentions-analytics', 'legal/privacy.html should mention Google Analytics for traffic');

if (
  !sw.includes('googletagmanager.com/') &&
  !PRECACHE_HAS_ANALYTICS(sw)
) {
  pass('sw-no-precache-gtag');
} else fail('sw-no-precache-gtag', 'do not precache googletagmanager.com');

if (
  sw.includes("host === 'www.googletagmanager.com'") &&
  sw.includes("host === 'www.google-analytics.com'") &&
  sw.includes('return;')
) {
  pass('sw-analytics-network-only');
} else fail('sw-analytics-network-only', 'SW must leave analytics hosts on the network');

if (
  ver.version === '2.6.50' &&
  app.includes("APP_VERSION = '2.6.50'") &&
  sw.includes('msb-pro-v2.6.50') &&
  app.includes('id="app-version-label">v2.6.50')
) {
  pass('version-2.6.50');
} else fail('version-2.6.50', ver.version);

const failed = results.filter((r) => !r.ok);
console.log('\n' + results.filter((r) => r.ok).length + ' passed,', failed.length, 'failed');
if (failed.length) process.exit(1);

function PRECACHE_HAS_ANALYTICS(src) {
  const start = src.indexOf('const PRECACHE');
  if (start < 0) return false;
  const end = src.indexOf('];', start);
  const block = src.slice(start, end + 2);
  return /googletagmanager|google-analytics/.test(block);
}
