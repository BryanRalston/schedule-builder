/**
 * Thin landing feature strip: desktop screenshots + Open app still points at /app/.
 * Run: node tests/test-landing-features.mjs
 */
import { readFileSync, existsSync, statSync } from 'fs';
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

function pngSize(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const SHOTS = [
  'assets/landing/feature-team.png',
  'assets/landing/feature-review.png',
  'assets/landing/feature-export.png',
];

console.log('\n=== landing feature strip (desktop shots) ===');
const landing = read('index.html');

if (landing.includes('href="app/"') && (landing.match(/href="app\/"/g) || []).length >= 2) {
  pass('open-app-points-at-app', 'two Open app CTAs → app/');
} else fail('open-app-points-at-app', 'expected at least two href="app/" Open app links');

if (landing.includes('>Open app<') && !landing.includes('id="tab-setup"') && !landing.includes('generateSchedule')) {
  pass('landing-stays-thin');
} else fail('landing-stays-thin', 'root index.html picked up builder markup');

if (
  landing.includes('Name the team, load the NRF period') &&
  landing.includes('Review before you post') &&
  landing.includes('Print or export the board') &&
  landing.includes('id="features"')
) {
  pass('feature-headlines');
} else fail('feature-headlines', 'missing Features headlines');

if (
  landing.includes('href="https://managerschedulepro.com/"') &&
  landing.includes('content="https://managerschedulepro.com/"') &&
  landing.includes('mailto:b.ralston62989@gmail.com') &&
  landing.includes('Cortex Developments') &&
  landing.includes('$19.99')
) {
  pass('og-support-price-kept');
} else fail('og-support-price-kept', 'OG / support / price drifted');

if (!/phone-bezel|device-frame|390×844|390x844/i.test(landing)) {
  pass('no-phone-frame-chrome');
} else fail('no-phone-frame-chrome', 'landing still frames shots as phones');

for (const rel of SHOTS) {
  if (!landing.includes(rel) && !landing.includes('/' + rel)) {
    fail('landing-refs-' + rel, 'index.html missing ' + rel);
    continue;
  }
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) {
    fail('file-' + rel, 'missing on disk');
    continue;
  }
  const buf = readFileSync(abs);
  const { w, h } = pngSize(buf);
  const kb = Math.round(statSync(abs).size / 1024);
  const desktop = w >= 1200 && h >= 700 && w > h;
  if (desktop && kb <= 300) pass('shot-' + rel, w + 'x' + h + ' ' + kb + 'KB');
  else fail('shot-' + rel, w + 'x' + h + ' ' + kb + 'KB (need landscape ≥1200×700, ≤300KB)');
}

const failed = results.filter((r) => !r.ok);
console.log('\n' + results.filter((r) => r.ok).length + ' passed,', failed.length, 'failed');
if (failed.length) process.exit(1);
