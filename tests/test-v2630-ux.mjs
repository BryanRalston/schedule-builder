/**
 * v2.6.30: default Build evens closing-shift counts among named SM+AMs
 * on a 4–5 person bench (1 SM + 3 AMs + named KC). No Rules retune.
 * Named KC may have KC-C only on reserved nights — never regular C,
 * never extra KC-C, never a spare closer for AM/SM balance.
 * Unnamed KC stays hidden.
 * Thin 2-person 2.6.22 scale and 2.6.29 first-visit still hold.
 * Clopen stays a preference — no zero-clopen guarantee.
 * Keeps 2.6.12–2.6.29 behavior; version lock 2.6.30.
 * Run: node tests/test-v2630-ux.mjs
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

function seedDirtyTesterChrome() {
  localStorage.setItem('msb_tour_done', '1');
  localStorage.setItem('msb_welcome_dismissed', '1');
  localStorage.setItem('msb_ui_lang', 'es');
  localStorage.setItem('msb_free_generate_count', '2');
  localStorage.setItem('msb_store_meta', JSON.stringify({
    storeName: 'Playtest Store',
    storeNumber: '999',
  }));
}

async function main() {
  console.log('\n=== v2.6.30 even SM+AM closes on a 4–5 person bench ===');

  const version = JSON.parse(read('version.json'));
  if (version.version === '2.6.30') pass('version.json', version.version);
  else fail('version.json', JSON.stringify(version));

  const sw = read('sw.js');
  if (sw.includes("const CACHE = 'msb-pro-v2.6.30'")) pass('sw-cache');
  else fail('sw-cache', sw.slice(0, 120));

  const index = read('index.html');
  if (index.includes("const APP_VERSION = '2.6.30'") && index.includes('id="app-version-label">v2.6.30')) {
    pass('index-version');
  } else fail('index-version', 'APP_VERSION / label mismatch');

  if (/function shouldEvenSmAmCloses\(/.test(index)
    && /function getEvenCloseShare\(/.test(index)
    && /function getCloseTargetForRole\(/.test(index)
    && /function confineNamedKcToReservedCloseNights\(/.test(index)
    && /evenSmAmCloses/.test(index)
    && /evenPeers/.test(index)
    && /SM\+AM close share is a preference/.test(index)
    && /3\+ AM team/.test(index)
    && /Reserved-night KC-C only/.test(index)) {
    pass('v2630-fns');
  } else fail('v2630-fns', '2.6.30 even-close helpers missing');

  if (/function getScaledCloseTargets\(/.test(index)
    && /CLOSE_TARGET_TEMPLATE_AM_BENCH/.test(index)
    && /function leftoverMustFixViolations\(/.test(index)
    && /function hasSavedUserPeople\(/.test(index)
    && /function isFirstVisitOpen\(/.test(index)
    && /function applyFirstVisitReset\(/.test(index)
    && /function generateScheduleFromButton\(/.test(index)
    && /no auto-fix on these pairs/.test(index)
    && /Preference — not a guarantee/.test(index)
    && /1 AM is not 3/.test(index)
    && /function isNamedAssistant\(/.test(index)
    && /function isNamedKeyCarrier\(/.test(index)
    && /const MSB_I18N_ES =/.test(index)) {
    pass('v2612-v2629-kept');
  } else fail('v2612-v2629-kept', '2.6.12–2.6.29 markers missing');

  if (!/TJX|Marshalls|HomeGoods|Winners/i.test(index)) pass('no-employer-names');
  else fail('no-employer-names', 'employer name leaked into copy');

  if (!/googleapis\.com\/language|translate\.googleapis|cloud.?translate api|openai|anthropic|copilot that uploads/i.test(index)) {
    pass('no-cloud-translate');
  } else fail('no-cloud-translate', 'cloud translate / AI roster upload leaked in');

  const genChunk = (index.match(/function _generateScheduleInner\([\s\S]*?\nfunction buildGenerationReport/) || [''])[0];
  if (genChunk
    && !/\bfetch\s*\(/.test(genChunk)
    && !/XMLHttpRequest/.test(genChunk)
    && !/openai|anthropic|copilot|cloud.?roster/i.test(genChunk)) {
    pass('generator-stays-on-device');
  } else fail('generator-stays-on-device', 'generator talks to a network or invented AI');

  if (/no auto-fix on these pairs/.test(index)
    && /Preference — not a guarantee/.test(index)
    && !/zero clopen/.test(index)
    && !/must-fix clopen/.test(index)) {
    pass('clopen-stays-preference');
  } else fail('clopen-stays-preference', 'clopen copy drifted toward a guarantee');

  const chromium = await loadChromium();
  const { server, base } = await startStaticServer();
  const browser = await chromium.launch({
    executablePath: existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const dirty = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
    });
    await dirty.addInitScript(seedDirtyTesterChrome);
    await dirty.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await dirty.waitForTimeout(900);
    const firstVisit = await dirty.evaluate(() => {
      const btn = document.getElementById('btn-generate');
      const setup = (document.getElementById('tabbtn-setup') || {}).textContent || '';
      return {
        lang: document.documentElement.lang,
        first: typeof isFirstVisitOpen === 'function' ? isFirstVisitOpen() : null,
        people: typeof hasSavedUserPeople === 'function' ? hasSavedUserPeople() : null,
        left: typeof remainingFreeGenerates === 'function' ? remainingFreeGenerates() : null,
        can: typeof canGenerateSchedule === 'function' ? canGenerateSchedule() : null,
        store: ((document.getElementById('store-name') || {}).value || ''),
        disabled: !!(btn && btn.disabled),
        setup: setup.trim(),
      };
    });
    if (firstVisit.lang === 'en' && firstVisit.first === true && firstVisit.people === false
      && firstVisit.left === 2 && firstVisit.can === true && !firstVisit.disabled
      && /Setup/.test(firstVisit.setup) && !/playtest/i.test(firstVisit.store)) {
      pass('v2629-first-visit-still-holds', firstVisit.setup + ' · left ' + firstVisit.left);
    } else fail('v2629-first-visit-still-holds', JSON.stringify(firstVisit));
    await dirty.close();

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

    const scaled = await page.evaluate(() => {
      const nights = typeof getManagerNightsPerWeek === 'function'
        ? getManagerNightsPerWeek(DEFAULT_PREFERENCES)
        : 6;
      const two = getScaledCloseTargets(DEFAULT_PREFERENCES, ['sm', 'am1'], nights);
      const full = getScaledCloseTargets(DEFAULT_PREFERENCES, ['sm', 'am1', 'am2', 'am3'], nights);
      const oneAm = getAmClosesPerWeekTarget(DEFAULT_PREFERENCES, nights - 1, 1, 0, 0);
      const threeAm = getAmClosesPerWeekTarget(DEFAULT_PREFERENCES, nights - 1, 3, 0, 0);
      const evenOn = typeof shouldEvenSmAmCloses === 'function'
        && shouldEvenSmAmCloses(DEFAULT_PREFERENCES, ['sm', 'am1', 'am2', 'am3']);
      const evenOff = typeof shouldEvenSmAmCloses === 'function'
        && shouldEvenSmAmCloses(DEFAULT_PREFERENCES, ['sm', 'am1']);
      const smShare = typeof getCloseTargetForRole === 'function'
        ? getCloseTargetForRole(DEFAULT_PREFERENCES, ['sm', 'am1', 'am2', 'am3'], nights, 'sm', 0)
        : null;
      const amShare = typeof getCloseTargetForRole === 'function'
        ? getCloseTargetForRole(DEFAULT_PREFERENCES, ['sm', 'am1', 'am2', 'am3'], nights, 'am1', 0)
        : null;
      return { nights, two, full, oneAm, threeAm, evenOn, evenOff, smShare, amShare };
    });
    if (scaled.two && scaled.two.thin && scaled.two.namedClosers === 1
      && !scaled.two.evenPeers && scaled.evenOff === false
      && scaled.oneAm <= 2 && scaled.oneAm < (scaled.nights - 1)) {
      pass('v2622-two-person-scale-holds',
        '1 AM auto=' + scaled.oneAm + ' nights=' + scaled.nights + ' smTarget=' + scaled.two.smTarget);
    } else fail('v2622-two-person-scale-holds', JSON.stringify(scaled));

    if (scaled.evenOn && scaled.full && scaled.full.evenPeers && scaled.full.namedClosers === 3
      && scaled.smShare != null && scaled.amShare != null
      && Math.abs(scaled.smShare - scaled.amShare) <= 1
      && scaled.threeAm >= 1) {
      pass('even-share-targets-on-3am-bench',
        'SM week0=' + scaled.smShare + ' AM week0=' + scaled.amShare + ' leftover3AM=' + scaled.threeAm);
    } else fail('even-share-targets-on-3am-bench', JSON.stringify(scaled));

    const built = await page.evaluate(() => {
      document.querySelectorAll('#toast-host .toast').forEach((el) => el.remove());
      if (typeof addAM === 'function' && amCount < 3) addAM();
      const sm = document.getElementById('name-sm');
      const am1 = document.getElementById('name-am1');
      const am2 = document.getElementById('name-am2');
      const am3 = document.getElementById('name-am3');
      const kc1 = document.getElementById('name-kc1');
      const storeNum = document.getElementById('store-number');
      const storeName = document.getElementById('store-name');
      if (sm) sm.value = 'Bryan Test';
      if (am1) am1.value = 'Dana Cruz';
      if (am2) am2.value = 'javier';
      if (am3) am3.value = 'jennifer';
      if (kc1) kc1.value = 'elizabeth';
      if (storeName) storeName.value = 'Pro';
      if (storeNum) storeNum.value = '0851';
      if (typeof persistManagerNames === 'function') persistManagerNames();
      if (typeof persistStoreMeta === 'function') persistStoreMeta();
      if (typeof loadThisNrfPeriod === 'function') loadThisNrfPeriod({ quiet: true });
      else if (typeof loadPeriod === 'function') loadPeriod();
      if (typeof generateSchedule === 'function') generateSchedule({ skipFreeCount: true });
      return new Promise((resolve) => {
        setTimeout(() => {
          if (typeof switchTab === 'function') switchTab('schedule');
          if (typeof syncAppShell === 'function') syncAppShell();
          if (typeof updatePostGenStrip === 'function') updatePostGenStrip();
          const roles = typeof getRoles === 'function' ? getRoles() : [];
          const allKc = typeof getAllWithKC === 'function' ? getAllWithKC() : [];
          const dks = (periodDates || []).map((d) => dateKey(d));
          const report = window._lastGenReport || {};
          const prefs = report.prefs || (typeof preferences !== 'undefined' ? preferences : {});
          const kcDows = typeof getEffectiveKcCloseDows === 'function'
            ? getEffectiveKcCloseDows(prefs)
            : [1];
          const isKcNight = (dk) => {
            const parts = String(dk).split('-');
            const dow = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)).getDay();
            return kcDows.indexOf(dow) >= 0;
          };
          const kindOf = (s) => {
            if (!s) return 'empty';
            if (s === 'off' || s === 'rto') return 'off';
            if (s === 'pto' || s === 'loa') return 'away';
            if (String(s).startsWith('open')) return 'open';
            if (String(s).startsWith('mid')) return 'mid';
            if (s === 'close' || s === 'close-ext' || s === 'kc-close') return 'close';
            return 'other';
          };
          const managers = ['sm', 'am1', 'am2', 'am3'];
          const people = {};
          const periodCloses = {};
          managers.forEach((r) => {
            const kinds = { open: 0, mid: 0, close: 0, off: 0, away: 0, other: 0, empty: 0, work: 0 };
            const weekCloses = [];
            const weekWork = [];
            dks.forEach((dk) => {
              const s = schedule[r] && schedule[r][dk];
              const k = kindOf(s);
              kinds[k] = (kinds[k] || 0) + 1;
              if (k === 'open' || k === 'mid' || k === 'close' || k === 'other') kinds.work++;
            });
            const weeks = currentPeriod && currentPeriod.numWeeks ? currentPeriod.numWeeks : Math.ceil(dks.length / 7);
            for (let w = 0; w < weeks; w++) {
              const slice = dks.slice(w * 7, w * 7 + 7);
              weekCloses.push(slice.filter((dk) => kindOf(schedule[r] && schedule[r][dk]) === 'close').length);
              weekWork.push(slice.filter((dk) => {
                const k = kindOf(schedule[r] && schedule[r][dk]);
                return k === 'open' || k === 'mid' || k === 'close' || k === 'other';
              }).length);
            }
            people[r] = { kinds, weekCloses, weekWork, name: (typeof getManagerNames === 'function' ? getManagerNames()[r] : r) };
            periodCloses[r] = kinds.close;
          });
          let kcCloses = 0;
          let kcCNights = 0;
          let amCloseOnKcNight = 0;
          let kcRegularClose = 0;
          let kcExtraKcC = 0;
          dks.forEach((dk) => {
            const ks = schedule.kc1 && schedule.kc1[dk];
            if (ks === 'close' || ks === 'close-ext') kcRegularClose++;
            if (isKcNight(dk)) {
              kcCNights++;
              if (ks === 'kc-close' || ks === 'close' || ks === 'close-ext') kcCloses++;
              managers.forEach((r) => {
                if (r === 'sm') return;
                const s = schedule[r] && schedule[r][dk];
                if (s === 'close' || s === 'close-ext' || s === 'kc-close') amCloseOnKcNight++;
              });
            } else if (ks === 'kc-close') {
              kcExtraKcC++;
            }
          });
          const weekPile = [];
          const weeks = currentPeriod && currentPeriod.numWeeks ? currentPeriod.numWeeks : Math.ceil(dks.length / 7);
          for (let w = 0; w < weeks; w++) {
            const working = managers.filter((r) => (people[r].weekWork[w] || 0) >= 3);
            const closes = working.map((r) => people[r].weekCloses[w] || 0);
            const maxC = closes.length ? Math.max.apply(null, closes) : 0;
            const minC = closes.length ? Math.min.apply(null, closes) : 0;
            weekPile.push({ w: w + 1, working: working.length, max: maxC, min: minC, closes: closes });
          }
          const vals = managers.map((r) => periodCloses[r]);
          const cMin = Math.min.apply(null, vals);
          const cMax = Math.max.apply(null, vals);
          const gridText = (document.getElementById('schedule-grid') || {}).textContent || '';
          const radar = document.querySelector('.clopen-radar .cr-sub');
          const hideCheck = (function () {
            const el = document.getElementById('name-kc1');
            const prev = el ? el.value : '';
            if (el) el.value = '';
            if (typeof persistManagerNames === 'function') persistManagerNames();
            const hiddenRoles = typeof getRoles === 'function' ? getRoles() : [];
            const hiddenAll = typeof getAllWithKC === 'function' ? getAllWithKC() : [];
            if (el) el.value = prev;
            if (typeof persistManagerNames === 'function') persistManagerNames();
            return { hiddenRoles, hiddenAll };
          })();
          resolve({
            days: dks.length,
            weeks,
            roles,
            allKc,
            periodCloses,
            cMin,
            cMax,
            spread: cMax - cMin,
            weekPile,
            kcCloses,
            kcCNights,
            amCloseOnKcNight,
            kcRegularClose,
            kcExtraKcC,
            people,
            phantomAm: roles.includes('am4') || allKc.includes('am4'),
            namedOnBoard: /elizabeth/i.test(gridText) && /Bryan Test/i.test(gridText),
            unnamedOnBoard: /AM2\b/.test(gridText) && !/javier/i.test(gridText),
            hideRoles: hideCheck.hiddenRoles,
            hideAll: hideCheck.hiddenAll,
            radar: radar ? (radar.textContent || '').trim() : '',
            evenPeers: !!(report.closeTargets && report.closeTargets.evenPeers),
            closeTargets: report.closeTargets,
            toast: [...document.querySelectorAll('#toast-host .toast-msg')].map((el) => el.textContent).pop() || '',
          });
        }, 2600);
      });
    });

    if (built.days >= 28 && built.roles && built.roles.join(',') === 'sm,am1,am2,am3') {
      pass('four-five-person-builds', built.days + ' days · ' + built.roles.join(','));
    } else fail('four-five-person-builds', JSON.stringify({
      days: built.days, roles: built.roles, toast: built.toast,
    }));

    if (built.allKc && built.allKc.indexOf('kc1') >= 0 && built.namedOnBoard && !built.phantomAm) {
      pass('named-kc-on-board', 'allKc=' + (built.allKc || []).join(','));
    } else fail('named-kc-on-board', JSON.stringify({
      allKc: built.allKc, namedOnBoard: built.namedOnBoard, phantom: built.phantomAm,
    }));

    if (built.evenPeers) pass('even-peers-flag', JSON.stringify(built.closeTargets));
    else fail('even-peers-flag', JSON.stringify(built.closeTargets));

    if (built.spread <= 2) {
      pass('period-close-spread', JSON.stringify(built.periodCloses) + ' spread=' + built.spread);
    } else if (built.spread <= 3 && built.cMin >= 4) {
      pass('period-close-spread',
        'coverage/offs forced one extra · ' + JSON.stringify(built.periodCloses) + ' spread=' + built.spread);
    } else {
      fail('period-close-spread', JSON.stringify(built.periodCloses) + ' spread=' + built.spread);
    }

    const piled = (built.weekPile || []).filter((w) => {
      if (w.working < 3) return false;
      if (w.max - w.min <= 2) return false;
      const total = (w.closes || []).reduce((a, b) => a + b, 0);
      return w.max >= 4 || (total > 0 && w.max > total / 2 + 0.5);
    });
    if (piled.length === 0) {
      pass('weekly-closes-not-piled', JSON.stringify(built.weekPile));
    } else {
      fail('weekly-closes-not-piled', JSON.stringify(built.weekPile));
    }

    if (built.kcCNights > 0 && built.kcCloses >= Math.ceil(built.kcCNights * 0.75)
      && built.amCloseOnKcNight <= Math.floor(built.kcCNights * 0.25)) {
      pass('kc-c-stays-on-named-kc',
        'KC-C ' + built.kcCloses + '/' + built.kcCNights + ' · AM stolen ' + built.amCloseOnKcNight);
    } else {
      fail('kc-c-stays-on-named-kc', JSON.stringify({
        kcCloses: built.kcCloses,
        kcCNights: built.kcCNights,
        amCloseOnKcNight: built.amCloseOnKcNight,
      }));
    }

    if (built.kcRegularClose === 0 && built.kcExtraKcC === 0) {
      pass('kc-no-regular-or-extra-close',
        'regular C=' + built.kcRegularClose + ' extra KC-C=' + built.kcExtraKcC);
    } else {
      fail('kc-no-regular-or-extra-close', JSON.stringify({
        kcRegularClose: built.kcRegularClose,
        kcExtraKcC: built.kcExtraKcC,
        kcCloses: built.kcCloses,
        kcCNights: built.kcCNights,
      }));
    }

    if (built.hideAll && built.hideAll.indexOf('kc1') < 0 && built.hideRoles.indexOf('kc1') < 0) {
      pass('unnamed-kc-still-hidden', 'roles=' + built.hideRoles.join(','));
    } else fail('unnamed-kc-still-hidden', JSON.stringify({
      hideRoles: built.hideRoles, hideAll: built.hideAll,
    }));

    if (built.radar) {
      const promisesFix = /apply a suggested fix/i.test(built.radar) && !/when one is offered/i.test(built.radar);
      const saysNoFix = /no auto-fix/i.test(built.radar);
      const zeroPromise = /zero clopen/i.test(built.radar);
      if ((promisesFix && saysNoFix) || zeroPromise) {
        fail('clopen-copy-still-preference', built.radar);
      } else {
        pass('clopen-copy-still-preference', built.radar.slice(0, 140));
      }
    } else {
      pass('clopen-copy-still-preference', 'radar empty — static copy still preference');
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
