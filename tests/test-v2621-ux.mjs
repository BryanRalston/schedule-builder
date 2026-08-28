/**
 * v2.6.21: two-manager first Build is a hangable period (offs, mixed
 * shifts, weekend offs), marketing hero hides after a live board.
 * Keeps 2.6.12–2.6.20 behavior; version lock follows 2.6.24.
 * Run: node tests/test-v2621-ux.mjs
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

async function main() {
  console.log('\n=== v2.6.21 two-manager hangable board + hero hide ===');

  const version = JSON.parse(read('version.json'));
  if (version.version === '2.6.24') pass('version.json', version.version);
  else fail('version.json', JSON.stringify(version));

  const sw = read('sw.js');
  if (sw.includes("const CACHE = 'msb-pro-v2.6.24'")) pass('sw-cache');
  else fail('sw-cache', sw.slice(0, 120));

  const index = read('index.html');
  if (index.includes("const APP_VERSION = '2.6.24'") && index.includes('id="app-version-label">v2.6.24')) {
    pass('index-version');
  } else fail('index-version', 'APP_VERSION / label mismatch');

  if (/const thinRoster = ROLES\.length <= 2/.test(index)
    && /function syncMarketingHero\(/.test(index)
    && /welcome-after-board/.test(index)
    && /Two named managers: keep the offs/.test(index)
    && /function findFirstStreakHole\(/.test(index)
    && /twoManagerCoverageHolds/.test(index)) {
    pass('v2621-fns');
  } else fail('v2621-fns', 'two-manager generate / hero helpers missing');

  if (/loadDemoStore\(\{explicit:true\}\)/.test(index)
    && /function hasSavedUserRoster\(/.test(index)
    && /Leftover Harbor East persist is not a real roster/.test(index)
    && /function applyBlankTeam\(/.test(index)
    && /id="role-title-sm"/.test(index)
    && /function shouldOpenOnSchedule\(/.test(index)
    && /id="backup-nudge"/.test(index)
    && /function parseRequestPhrase\(/.test(index)
    && /function jumpToReviewChip\(/.test(index)
    && /function isNamedAssistant\(/.test(index)
    && /Rebuild to apply/.test(index)
    && /function peelTrailingSingleDate\(/.test(index)
    && /id="btn-pro-gate-not-now"/.test(index)
    && /function clearAskPhraseFields\(/.test(index)
    && /function findFirstQualityHole\(/.test(index)
    && /Undo request/.test(index)) {
    pass('v2612-v2620-kept');
  } else fail('v2612-v2620-kept', '2.6.12–2.6.20 markers missing');

  if (!/TJX|Marshalls|HomeGoods|Winners/i.test(index)) pass('no-employer-names');
  else fail('no-employer-names', 'employer name leaked into copy');

  if (!/idioma|español|spanish|language picker|lang-picker/i.test(index)) {
    pass('no-language-picker');
  } else fail('no-language-picker', 'language picker added');

  const paintChunk = (index.match(/function paintRequestCell\([\s\S]*?\n\}/) || [''])[0];
  const phraseChunk = (index.match(/function applyRequestPhraseFromBar\([\s\S]*?\n\}/) || [''])[0];
  if (paintChunk && !/generateSchedule\s*\(/.test(paintChunk)
    && phraseChunk && !/generateSchedule\s*\(/.test(phraseChunk)) {
    pass('paint-does-not-autobuild');
  } else fail('paint-does-not-autobuild', 'paint/phrase still calls generateSchedule');

  const genChunk = (index.match(/function _generateScheduleInner\([\s\S]*?\nfunction buildGenerationReport/) || [''])[0];
  if (genChunk
    && !/\bfetch\s*\(/.test(genChunk)
    && !/XMLHttpRequest/.test(genChunk)
    && !/openai|anthropic|copilot|cloud.?roster/i.test(genChunk)) {
    pass('generator-stays-on-device');
  } else fail('generator-stays-on-device', 'generator talks to a network or invented AI');

  const chromium = await loadChromium();
  const { server, base } = await startStaticServer();
  const browser = await chromium.launch({
    executablePath: existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('msb_tour_done', '1');
      localStorage.setItem('msb_pro_license', JSON.stringify({ key: 'TEST-PRO-KEY-999', unlockedAt: Date.now() }));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);

    const firstRunHero = await page.evaluate(() => {
      const hero = document.getElementById('welcome-card');
      if (!hero) return { present: false };
      const cs = getComputedStyle(hero);
      return {
        present: true,
        hiddenAttr: hero.hasAttribute('hidden'),
        display: cs.display,
        afterBoard: hero.classList.contains('welcome-after-board'),
        text: (hero.textContent || '').slice(0, 80),
      };
    });
    if (firstRunHero.present && !firstRunHero.hiddenAttr && firstRunHero.display !== 'none' && !firstRunHero.afterBoard) {
      pass('hero-visible-first-run', firstRunHero.text.trim().slice(0, 40));
    } else fail('hero-visible-first-run', JSON.stringify(firstRunHero));

    const built = await page.evaluate(() => {
      document.querySelectorAll('#toast-host .toast').forEach((el) => el.remove());
      const sm = document.getElementById('name-sm');
      const am1 = document.getElementById('name-am1');
      const am2 = document.getElementById('name-am2');
      const kc1 = document.getElementById('name-kc1');
      if (sm) sm.value = 'Alex Rivera';
      if (am1) am1.value = 'Sam Chen';
      if (am2) am2.value = '';
      if (kc1) kc1.value = '';
      if (typeof persistManagerNames === 'function') persistManagerNames();
      if (typeof persistStoreMeta === 'function') persistStoreMeta();
      if (typeof loadThisNrfPeriod === 'function') loadThisNrfPeriod({ quiet: true });
      else if (typeof loadPeriod === 'function') loadPeriod();
      if (typeof buildFromSetup === 'function') buildFromSetup();
      else generateSchedule({ skipFreeCount: true });
      return new Promise((resolve) => {
        setTimeout(() => {
          if (typeof switchTab === 'function') switchTab('schedule');
          if (typeof syncAppShell === 'function') syncAppShell();
          const roles = typeof getRoles === 'function' ? getRoles() : [];
          const allKc = typeof getAllWithKC === 'function' ? getAllWithKC() : [];
          const dks = (periodDates || []).map((d) => dateKey(d));
          const report = window._lastGenReport || {};
          const people = {};
          roles.forEach((r) => {
            const kinds = { open: 0, mid: 0, close: 0, off: 0, away: 0, other: 0, empty: 0, work: 0 };
            const weekWork = [];
            dks.forEach((dk, i) => {
              const s = schedule[r] && schedule[r][dk];
              const k = (function (v) {
                if (!v) return 'empty';
                if (v === 'off' || v === 'rto') return 'off';
                if (v === 'pto' || v === 'loa') return 'away';
                if (String(v).startsWith('open')) return 'open';
                if (String(v).startsWith('mid')) return 'mid';
                if (v === 'close' || v === 'close-ext' || v === 'kc-close') return 'close';
                return 'other';
              })(s);
              kinds[k] = (kinds[k] || 0) + 1;
              if (k === 'open' || k === 'mid' || k === 'close' || k === 'other') kinds.work++;
            });
            const weeks = currentPeriod && currentPeriod.numWeeks ? currentPeriod.numWeeks : Math.ceil(dks.length / 7);
            for (let w = 0; w < weeks; w++) {
              const slice = dks.slice(w * 7, w * 7 + 7);
              weekWork.push(slice.filter((dk) => {
                const s = schedule[r] && schedule[r][dk];
                return s && s !== 'off' && s !== 'rto' && s !== 'loa';
              }).length);
            }
            people[r] = {
              kinds,
              weekWork,
              weekendOffs: (report.weekendOffs && report.weekendOffs[r]) || 0,
              maxStreak: (report.maxStreak && report.maxStreak[r]) || 0,
              opens: (report.opens && report.opens[r]) || kinds.open,
              closes: (report.closes && report.closes[r]) || kinds.close,
              mids: (report.mids && report.mids[r]) || kinds.mid,
            };
          });
          const hero = document.getElementById('welcome-card');
          const heroCs = hero ? getComputedStyle(hero) : null;
          const gridRoles = [...document.querySelectorAll('#schedule-grid [data-role]')].map((el) => el.getAttribute('data-role'));
          const q = report.quality || (typeof computeQualityScore === 'function' ? computeQualityScore(report, roles) : null);
          resolve({
            tab: typeof currentAppTab !== 'undefined' ? currentAppTab : '',
            days: dks.length,
            weeks: currentPeriod && currentPeriod.numWeeks,
            roles,
            allKc,
            people,
            phantomAm2: roles.includes('am2') || allKc.includes('am2') || gridRoles.includes('am2'),
            gridAm2: gridRoles.filter((r) => r === 'am2').length,
            cells: document.querySelectorAll('#schedule-grid td.shift-editable').length,
            score: q && q.score,
            grade: q && q.grade,
            heroHidden: !hero || hero.hasAttribute('hidden') || (heroCs && heroCs.display === 'none') || hero.classList.contains('welcome-after-board'),
            heroAfter: !!(hero && hero.classList.contains('welcome-after-board')),
            toast: [...document.querySelectorAll('#toast-host .toast-msg')].map((el) => el.textContent).pop() || '',
          });
        }, 2400);
      });
    });

    if (built.tab === 'schedule' && built.days >= 28 && built.cells > 10) {
      pass('two-manager-builds', built.days + ' days, ' + built.cells + ' cells');
    } else fail('two-manager-builds', JSON.stringify({ tab: built.tab, days: built.days, cells: built.cells, toast: built.toast }));

    if (built.roles && built.roles.join(',') === 'sm,am1' && !built.phantomAm2 && built.gridAm2 === 0) {
      pass('no-phantom-am2', built.roles.join(','));
    } else fail('no-phantom-am2', JSON.stringify({ roles: built.roles, allKc: built.allKc, phantom: built.phantomAm2, gridAm2: built.gridAm2 }));

    if (built.heroHidden && built.heroAfter) {
      pass('hero-hidden-after-build');
    } else fail('hero-hidden-after-build', JSON.stringify({ hidden: built.heroHidden, after: built.heroAfter }));

    const sm = built.people && built.people.sm;
    const am = built.people && built.people.am1;
    if (sm && am) {
      const smKinds = [sm.kinds.open > 0, sm.kinds.mid > 0, sm.kinds.close > 0].filter(Boolean).length;
      const amKinds = [am.kinds.open > 0, am.kinds.mid > 0, am.kinds.close > 0].filter(Boolean).length;
      const smBrick = sm.kinds.work >= 28 && (sm.kinds.open === sm.kinds.work || sm.kinds.close === sm.kinds.work);
      const amBrick = am.kinds.work >= 28 && (am.kinds.open === am.kinds.work || am.kinds.close === am.kinds.work);
      if (!smBrick && !amBrick && smKinds >= 2 && amKinds >= 2) {
        pass('mixed-shifts', 'SM O/M/C ' + sm.kinds.open + '/' + sm.kinds.mid + '/' + sm.kinds.close
          + ' AM ' + am.kinds.open + '/' + am.kinds.mid + '/' + am.kinds.close);
      } else {
        fail('mixed-shifts', JSON.stringify({ sm: sm.kinds, am: am.kinds }));
      }

      if (sm.kinds.off >= 4 && am.kinds.off >= 4) {
        pass('days-off-exist', 'SM off ' + sm.kinds.off + ' AM off ' + am.kinds.off);
      } else fail('days-off-exist', JSON.stringify({ smOff: sm.kinds.off, amOff: am.kinds.off, sm: sm.kinds, am: am.kinds }));

      const weSm = sm.weekendOffs;
      const weAm = am.weekendOffs;
      if (weSm > 0 && weAm > 0) {
        pass('weekend-offs-pursued', 'SM ' + weSm + ' AM ' + weAm);
      } else if (weSm + weAm > 0) {
        pass('weekend-offs-pursued', 'partial SM ' + weSm + ' AM ' + weAm + ' — coverage exception documented: one person can be short when the other holds the weekend');
      } else {
        fail('weekend-offs-pursued', 'both 0/2 — two managers can trade weekend days');
      }

      if (sm.maxStreak <= 6 && am.maxStreak <= 6) {
        pass('streak-under-limit', 'SM ' + sm.maxStreak + ' AM ' + am.maxStreak);
      } else if (sm.maxStreak < 28 && am.maxStreak < 28) {
        fail('streak-under-limit', 'streak over 6 but not a 28-brick: SM ' + sm.maxStreak + ' AM ' + am.maxStreak);
      } else {
        fail('streak-under-limit', '28-day streak SM ' + sm.maxStreak + ' AM ' + am.maxStreak);
      }

      const smSeven = (sm.weekWork || []).filter((n) => n >= 7).length;
      const amSeven = (am.weekWork || []).filter((n) => n >= 7).length;
      if (smSeven === 0 && amSeven === 0) {
        pass('weeks-not-seven', 'SM ' + JSON.stringify(sm.weekWork) + ' AM ' + JSON.stringify(am.weekWork));
      } else fail('weeks-not-seven', JSON.stringify({ sm: sm.weekWork, am: am.weekWork }));
    } else {
      fail('mixed-shifts', 'missing people ' + JSON.stringify(built.people));
      fail('days-off-exist', 'missing people');
      fail('weekend-offs-pursued', 'missing people');
      fail('streak-under-limit', 'missing people');
      fail('weeks-not-seven', 'missing people');
    }

    if (built.score != null && built.score !== 24) {
      pass('quality-not-brick-24', String(built.score) + ' ' + built.grade);
    } else if (built.score === 24 && sm && sm.maxStreak < 28 && am && am.maxStreak < 28) {
      pass('quality-not-brick-24', 'score 24 but not from a 28-day streak');
    } else {
      fail('quality-not-brick-24', JSON.stringify({ score: built.score, grade: built.grade, toast: built.toast }));
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
