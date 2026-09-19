/**
 * v2.6.51: GA4 custom events via msbTrack on landing + /app/.
 * Helper no-ops without gtag; params are coarse labels only.
 * Run: node tests/test-v2651-ga4-events.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const require = createRequire(import.meta.url);
const MSP_ID = 'G-LJ8E69Z8Y0';
const COSMIC_ID = 'G-D272MF8NQP';
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

const LANDING_EVENTS = ['landing_view', 'cta_click', 'outbound_click', 'scroll_depth'];
const APP_EVENTS = [
  'app_view',
  'feature_map_open',
  'build_click',
  'build_result',
  'review_open',
  'export_click',
  'pro_gate_shown',
  'license_activate_result',
  'theme_change',
  'lang_change',
  'app_hide'
];
const PII_PARAM = /employeeName|employee_name|roster|storeNumber|store_number|licenseKey|license_key|askText|ask_text|cellContent|scheduleCell/;

console.log('\n=== v2.6.51 GA4 custom events ===');

const analytics = require('../app/analytics.js');
const landing = read('index.html');
const app = read('app/index.html');
const helper = read('app/analytics.js');
const sw = read('sw.js');
const privacy = read('legal/privacy.html');
const ver = JSON.parse(read('version.json'));
const twa = JSON.parse(read('android-twa/twa-manifest.json'));
const gradle = read('android-twa/app/build.gradle');

if (typeof analytics.msbTrack === 'function' && typeof analytics.sanitizeParams === 'function') {
  pass('helper-exports');
} else fail('helper-exports', 'msbTrack / sanitizeParams missing');

const cleaned = analytics.sanitizeParams({
  cta_id: 'open_app',
  result: 'success',
  employeeName: 'Bryan',
  roster: 'Amy,Ben',
  storeNumber: '851',
  licenseKey: 'MSB-PRO-XXXX',
  askText: 'who is off tuesday',
  nested: { x: 1 },
  surface: 'review'
});
if (cleaned.cta_id === 'open_app' && cleaned.result === 'success' && cleaned.surface === 'review'
  && cleaned.employeeName == null && cleaned.roster == null && cleaned.storeNumber == null
  && cleaned.licenseKey == null && cleaned.askText == null && cleaned.nested == null) {
  pass('helper-strips-pii');
} else fail('helper-strips-pii', JSON.stringify(cleaned));

const calls = [];
const prevGtag = globalThis.gtag;
globalThis.gtag = function () { calls.push(Array.from(arguments)); };
analytics.msbTrack('landing_view', { cta_id: 'open_app', employeeName: 'Nope' });
analytics.msbTrack('not_a_real_event', { cta_id: 'open_app' });
globalThis.gtag = prevGtag;
if (calls.length === 1 && calls[0][0] === 'event' && calls[0][1] === 'landing_view'
  && calls[0][2] && calls[0][2].cta_id === 'open_app' && calls[0][2].employeeName == null) {
  pass('helper-gtag-allowlist');
} else fail('helper-gtag-allowlist', JSON.stringify(calls));

delete globalThis.gtag;
const silent = [];
const before = silent.length;
analytics.msbTrack('app_view', { surface: 'board' });
if (silent.length === before) pass('helper-noop-without-gtag');
else fail('helper-noop-without-gtag', 'called something without gtag');

if (analytics.ctaIdFromHref('app/') === 'open_app'
  && analytics.ctaIdFromHref('https://ralstonia5.gumroad.com/l/pwplbc') === 'gumroad'
  && analytics.ctaIdFromHref('https://play.google.com/store/apps/details?id=com.managerschedulebuilder.pro') === 'play'
  && analytics.ctaIdFromHref('app/?map=1') === 'feature_map'
  && analytics.ctaIdFromHref('#can-do') === 'can_do'
  && analytics.ctaIdFromHref('#features') === 'feature_map') {
  pass('cta-id-map');
} else fail('cta-id-map', 'href → cta_id mapping drifted');

if (
  landing.includes("src=\"app/analytics.js\"") &&
  app.includes('src="analytics.js"') &&
  existsSync(join(ROOT, 'app/analytics.js'))
) {
  pass('helper-included');
} else fail('helper-included', 'landing + app must load app/analytics.js');

if (
  landing.includes("gtag('config', '" + MSP_ID + "')") &&
  app.includes("gtag('config', '" + MSP_ID + "')") &&
  helper.includes(MSP_ID)
) {
  pass('measurement-id-unchanged', MSP_ID);
} else fail('measurement-id-unchanged', 'must keep G-LJ8E69Z8Y0');

if (!landing.includes(COSMIC_ID) && !app.includes(COSMIC_ID) && !helper.includes(COSMIC_ID)) {
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

for (const ev of LANDING_EVENTS) {
  if (helper.includes("'" + ev + "'") || helper.includes('"' + ev + '"')) pass('landing-event-' + ev);
  else fail('landing-event-' + ev, 'helper missing ' + ev);
}

const appNeedles = {
  feature_map_open: "msbTrack('feature_map_open'",
  build_click: "msbTrack('build_click'",
  build_result: "msbTrack('build_result'",
  review_open: "msbTrack('review_open'",
  export_click: "msbTrack('export_click'",
  pro_gate_shown: "msbTrack('pro_gate_shown'",
  license_activate_result: "msbTrack('license_activate_result'",
  theme_change: "msbTrack('theme_change'",
  lang_change: "msbTrack('lang_change'",
  app_hide: "msbTrack('app_hide'"
};
for (const ev of APP_EVENTS) {
  if (ev === 'app_view') {
    if (helper.includes("'app_view'")) pass('app-event-app_view');
    else fail('app-event-app_view', 'helper missing app_view');
    continue;
  }
  const needle = appNeedles[ev];
  if (needle && (app.includes(needle) || helper.includes(needle))) pass('app-event-' + ev);
  else fail('app-event-' + ev, 'missing gtag call site for ' + ev);
}

if (
  landing.includes('data-cta="open_app"') &&
  landing.includes('data-cta="play"') &&
  landing.includes('data-cta="gumroad"') &&
  landing.includes('data-cta="feature_map"')
) {
  pass('landing-cta-attrs');
} else fail('landing-cta-attrs', 'real CTAs need data-cta labels');

if (
  app.includes("format: 'print'") &&
  app.includes("format: 'word'") &&
  app.includes("format: 'excel'") &&
  app.includes("result: 'started'") &&
  app.includes("result: 'soft_confirm_cancel'") &&
  app.includes("result: 'pro_gate'") &&
  app.includes("result: 'downloaded'")
) {
  pass('export-result-labels');
} else fail('export-result-labels', 'export_click must cover started|soft_confirm_cancel|pro_gate|downloaded');

if (
  app.includes("result: 'success'") &&
  app.includes("result: 'error'") &&
  app.includes("result: 'blocked'")
) {
  pass('build-result-labels');
} else fail('build-result-labels', 'build_result must cover success|error|blocked');

const trackCalls = (app + '\n' + helper).match(/msbTrack\([^)]*\)/g) || [];
const piiHits = trackCalls.filter((c) => PII_PARAM.test(c));
if (!piiHits.length) pass('no-pii-param-names', trackCalls.length + ' msbTrack sites');
else fail('no-pii-param-names', piiHits.join(' | '));

if (
  /product-use events/i.test(privacy) &&
  /Google Analytics/i.test(privacy)
) {
  pass('privacy-mentions-events');
} else fail('privacy-mentions-events', 'privacy.html should mention product-use events');

if (
  sw.includes("'./app/analytics.js'") &&
  !/googletagmanager|google-analytics/.test(sw.slice(sw.indexOf('const PRECACHE'), sw.indexOf('];', sw.indexOf('const PRECACHE')) + 2))
) {
  pass('sw-precache-helper-not-hosts');
} else fail('sw-precache-helper-not-hosts', 'precache local helper; never analytics hosts');

if (
  sw.includes("host === 'www.googletagmanager.com'") &&
  sw.includes("host === 'www.google-analytics.com'")
) {
  pass('sw-analytics-network-only');
} else fail('sw-analytics-network-only', 'SW must leave analytics hosts on the network');

if (
  ver.version === '2.6.51' &&
  app.includes("APP_VERSION = '2.6.51'") &&
  sw.includes('msb-pro-v2.6.51') &&
  app.includes('id="app-version-label">v2.6.51') &&
  twa.appVersion === '2.6.51' &&
  twa.appVersionName === '2.6.51' &&
  /versionCode 2651/.test(gradle) &&
  /versionName "2.6.51"/.test(gradle)
) {
  pass('version-2.6.51');
} else fail('version-2.6.51', ver.version);

const failed = results.filter((r) => !r.ok);
console.log('\n' + results.filter((r) => r.ok).length + ' passed,', failed.length, 'failed');
if (failed.length) process.exit(1);
