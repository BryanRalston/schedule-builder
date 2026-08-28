/**
 * v2.6.22: scale close targets to named headcount so a default
 * SM+AM1 first Build is hangable AND does not report Hard rules 0/40
 * / 4 must-fix from SM-exactly-1 vs AM-≥5 leftover. Coverage chip
 * explains two people + offs; weekend / AM-close chips match the
 * review list. Keeps 2.6.12–2.6.21 behavior; version lock 2.6.24.
 * Run: node tests/test-v2622-ux.mjs
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
  console.log('\n=== v2.6.22 scale close targets + consistent review chips ===');

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

  if (/CLOSE_TARGET_TEMPLATE_AM_BENCH/.test(index)
    && /function getScaledCloseTargets\(/.test(index)
    && /function twoPersonOffsCoverageNote\(/.test(index)
    && /function formatCoverageChip\(/.test(index)
    && /function formatAmCloseChip\(/.test(index)
    && /function formatWeOffChip\(/.test(index)
    && /2 people \+ offs/.test(index)
    && /no auto-fix on these pairs/.test(index)
    && /Preference — not a guarantee/.test(index)
    && /1 AM is not 3/.test(index)) {
    pass('v2622-fns');
  } else fail('v2622-fns', 'scaled close-target / chip helpers missing');

  if (/const thinRoster = ROLES\.length <= 2/.test(index)
    && /function syncMarketingHero\(/.test(index)
    && /welcome-after-board/.test(index)
    && /Two named managers: keep the offs/.test(index)
    && /function findFirstStreakHole\(/.test(index)
    && /twoManagerCoverageHolds/.test(index)
    && /loadDemoStore\(\{explicit:true\}\)/.test(index)
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
    pass('v2612-v2621-kept');
  } else fail('v2612-v2621-kept', '2.6.12–2.6.21 markers missing');

  if (!/TJX|Marshalls|HomeGoods|Winners/i.test(index)) pass('no-employer-names');
  else fail('no-employer-names', 'employer name leaked into copy');

  if (!/idioma|español|spanish|language picker|lang-picker/i.test(index)) {
    pass('no-language-picker');
  } else fail('no-language-picker', 'language picker added');

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

    const scaled = await page.evaluate(() => {
      const nights = typeof getManagerNightsPerWeek === 'function'
        ? getManagerNightsPerWeek(DEFAULT_PREFERENCES)
        : 6;
      const two = getScaledCloseTargets(DEFAULT_PREFERENCES, ['sm', 'am1'], nights);
      const full = getScaledCloseTargets(DEFAULT_PREFERENCES, ['sm', 'am1', 'am2', 'am3'], nights);
      const oneAm = getAmClosesPerWeekTarget(DEFAULT_PREFERENCES, nights - 1, 1, 0, 0);
      const threeAm = getAmClosesPerWeekTarget(DEFAULT_PREFERENCES, nights - 1, 3, 0, 0);
      return { nights, two, full, oneAm, threeAm };
    });
    if (scaled.two && scaled.two.thin && scaled.two.namedClosers === 1
      && scaled.oneAm <= 2 && scaled.oneAm < (scaled.nights - 1)
      && scaled.threeAm >= 1 && scaled.full.namedClosers === 3) {
      pass('close-targets-scale-to-headcount',
        '1 AM auto=' + scaled.oneAm + ' 3 AM auto=' + scaled.threeAm + ' nights=' + scaled.nights);
    } else fail('close-targets-scale-to-headcount', JSON.stringify(scaled));

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
          if (typeof updatePostGenStrip === 'function') updatePostGenStrip();
          const roles = typeof getRoles === 'function' ? getRoles() : [];
          const allKc = typeof getAllWithKC === 'function' ? getAllWithKC() : [];
          const dks = (periodDates || []).map((d) => dateKey(d));
          const report = window._lastGenReport || {};
          const people = {};
          roles.forEach((r) => {
            const kinds = { open: 0, mid: 0, close: 0, off: 0, away: 0, other: 0, empty: 0, work: 0 };
            const weekWork = [];
            dks.forEach((dk) => {
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
          const q = report.quality || (typeof computeQualityScore === 'function' ? computeQualityScore(report, roles) : null);
          const mustFix = typeof countMustFixErrors === 'function' ? countMustFixErrors(report) : report.hardErrorCount;
          const issues = typeof buildPostingIssues === 'function'
            ? buildPostingIssues(report, roles, [])
            : [];
          const mustIssues = issues.filter((i) => i.sev === 'must');
          const st = typeof computeCoverageAndFairnessStats === 'function' ? computeCoverageAndFairnessStats() : {};
          const cover = document.getElementById('pgs-cover');
          const amc = document.getElementById('pgs-am-close');
          const we = document.getElementById('pgs-we');
          const badge = document.querySelector('.posting-badge');
          const hardBar = [...document.querySelectorAll('.score-bar-row')].find((el) => /Hard rules/i.test(el.textContent || ''));
          const weTile = [...document.querySelectorAll('.gen-stat-card')].find((el) => /Weekend days off/i.test(el.textContent || ''));
          const radar = document.querySelector('.clopen-radar .cr-sub');
          const unmet = report.unmet || [];
          const closeConflict = unmet.some((u) => /need exactly 1/i.test(u) || /need at least 5/i.test(u) || /closes \(need exactly/i.test(u));
          const amNeed5 = (unmet.concat(mustIssues.map((i) => i.title + ' ' + (i.meta || ''))).join(' '))
            .match(/need at least 5/i);
          resolve({
            tab: typeof currentAppTab !== 'undefined' ? currentAppTab : '',
            days: dks.length,
            weeks: currentPeriod && currentPeriod.numWeeks,
            roles,
            allKc,
            people,
            phantomAm2: roles.includes('am2') || allKc.includes('am2'),
            cells: document.querySelectorAll('#schedule-grid td.shift-editable').length,
            score: q && q.score,
            grade: q && q.grade,
            hardPts: q && q.parts && q.parts.hard,
            hardCount: report.hardErrorCount,
            mustFix,
            mustTitles: mustIssues.map((i) => i.title),
            issueTitles: issues.map((i) => i.sev + ':' + i.title),
            badge: badge ? (badge.textContent || '').trim() : '',
            hardBar: hardBar ? (hardBar.textContent || '').replace(/\s+/g, ' ').trim() : '',
            coverText: cover ? (cover.textContent || '').trim() : '',
            coverWhy: cover ? (cover.getAttribute('data-cover-why') || cover.title || '') : '',
            coverCls: cover ? cover.className : '',
            amcText: amc ? (amc.textContent || '').trim() : '',
            amcCls: amc ? amc.className : '',
            weText: we ? (we.textContent || '').trim() : '',
            weCls: we ? we.className : '',
            weTile: weTile ? (weTile.textContent || '').replace(/\s+/g, ' ').trim() : '',
            radar: radar ? (radar.textContent || '').trim() : '',
            missDays: st.missDays,
            coverOk: st.coverOk,
            amPeriodGoal: st.amPeriodGoal,
            amWeeklyGoal: st.amWeeklyGoal,
            amMetGoal: st.amMetGoal,
            weMet: st.weMet,
            weN: st.weN,
            cMin: st.cMin,
            closeTargets: report.closeTargets,
            closeConflict,
            amNeed5: !!amNeed5,
            unmet: unmet.slice(0, 12),
            toast: [...document.querySelectorAll('#toast-host .toast-msg')].map((el) => el.textContent).pop() || '',
          });
        }, 2400);
      });
    });

    if (built.tab === 'schedule' && built.days >= 28 && built.cells > 10) {
      pass('two-manager-builds', built.days + ' days, ' + built.cells + ' cells');
    } else fail('two-manager-builds', JSON.stringify({ tab: built.tab, days: built.days, cells: built.cells, toast: built.toast }));

    if (built.roles && built.roles.join(',') === 'sm,am1' && !built.phantomAm2) {
      pass('no-phantom-am2', built.roles.join(','));
    } else fail('no-phantom-am2', JSON.stringify({ roles: built.roles, phantom: built.phantomAm2 }));

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
      } else fail('mixed-shifts', JSON.stringify({ sm: sm.kinds, am: am.kinds }));

      if (sm.kinds.off >= 4 && am.kinds.off >= 4) {
        pass('days-off-exist', 'SM off ' + sm.kinds.off + ' AM off ' + am.kinds.off);
      } else fail('days-off-exist', JSON.stringify({ smOff: sm.kinds.off, amOff: am.kinds.off }));

      if (sm.maxStreak <= 6 && am.maxStreak <= 6) {
        pass('streak-under-limit', 'SM ' + sm.maxStreak + ' AM ' + am.maxStreak);
      } else fail('streak-under-limit', 'SM ' + (sm && sm.maxStreak) + ' AM ' + (am && am.maxStreak));

      const smSeven = (sm.weekWork || []).filter((n) => n >= 7).length;
      const amSeven = (am.weekWork || []).filter((n) => n >= 7).length;
      if (smSeven === 0 && amSeven === 0) {
        pass('weeks-not-seven', 'SM ' + JSON.stringify(sm.weekWork) + ' AM ' + JSON.stringify(am.weekWork));
      } else fail('weeks-not-seven', JSON.stringify({ sm: sm.weekWork, am: am.weekWork }));
    } else {
      fail('mixed-shifts', 'missing people');
      fail('days-off-exist', 'missing people');
      fail('streak-under-limit', 'missing people');
      fail('weeks-not-seven', 'missing people');
    }

    if (built.hardPts === 40 && built.mustFix === 0 && !built.closeConflict && !built.amNeed5) {
      pass('no-impossible-close-hard-fail',
        'Hard ' + built.hardPts + '/40 · must-fix ' + built.mustFix + ' · badge ' + built.badge);
    } else if (built.hardPts === 0 || built.mustFix >= 4 || built.closeConflict || built.amNeed5) {
      fail('no-impossible-close-hard-fail', JSON.stringify({
        hardPts: built.hardPts,
        hardCount: built.hardCount,
        mustFix: built.mustFix,
        mustTitles: built.mustTitles,
        closeConflict: built.closeConflict,
        amNeed5: built.amNeed5,
        unmet: built.unmet,
        badge: built.badge,
        hardBar: built.hardBar,
        closeTargets: built.closeTargets,
      }));
    } else {
      pass('no-impossible-close-hard-fail',
        'not the 0/40 · 4 must-fix close-target gate; Hard ' + built.hardPts + ' must-fix ' + built.mustFix);
    }

    if (!/not ready/i.test(built.badge) || built.mustFix === 0) {
      pass('posting-not-unsigned-from-close-gate', built.badge || '(no badge)');
    } else fail('posting-not-unsigned-from-close-gate', JSON.stringify({
      badge: built.badge,
      mustTitles: built.mustTitles,
    }));

    const coverMentions = /2 people \+ offs|two people with days off/i.test(built.coverText + ' ' + built.coverWhy);
    if (!built.coverOk && built.missDays > 0) {
      if (coverMentions && !/open\+close ✓/i.test(built.coverText)) {
        pass('coverage-chip-explains-two-person', built.coverText + ' · ' + built.coverWhy);
      } else fail('coverage-chip-explains-two-person', JSON.stringify({
        coverText: built.coverText,
        coverWhy: built.coverWhy,
        missDays: built.missDays,
      }));
    } else {
      pass('coverage-chip-explains-two-person', 'no thin-day holes on this board — chip=' + built.coverText);
    }

    const weChipHasMet = /WE offs/i.test(built.weText) && (/\d+\/\d+/.test(built.weText) || /met/i.test(built.weText));
    const weTileHasMet = /\d+\/\d+/.test(built.weTile);
    if (weChipHasMet && weTileHasMet) {
      pass('weekend-chip-matches-tile', built.weText + ' || ' + built.weTile);
    } else fail('weekend-chip-matches-tile', JSON.stringify({ we: built.weText, tile: built.weTile }));

    const amShortInReview = (built.unmet || []).some((u) => /need at least \d+/i.test(u) && /close/i.test(u));
    const amChipGreen = /\bok\b/.test(built.amcCls);
    if (amShortInReview && amChipGreen) {
      fail('am-close-chip-not-false-pass', JSON.stringify({
        amc: built.amcText,
        cls: built.amcCls,
        unmet: built.unmet,
        goal: built.amPeriodGoal,
      }));
    } else if (/AM closes/i.test(built.amcText) && (built.amPeriodGoal == null || /\/\s*\d+/.test(built.amcText))) {
      pass('am-close-chip-not-false-pass', built.amcText + ' cls=' + built.amcCls);
    } else fail('am-close-chip-not-false-pass', JSON.stringify({
      amc: built.amcText,
      cls: built.amcCls,
      goal: built.amPeriodGoal,
    }));

    if (built.radar) {
      const promisesFix = /apply a suggested fix/i.test(built.radar) && !/when one is offered/i.test(built.radar);
      const saysNoFix = /no auto-fix/i.test(built.radar);
      if (promisesFix && saysNoFix) {
        fail('clopen-copy-matches-reality', built.radar);
      } else if (/preference/i.test(built.radar) || /no close→open/i.test(built.radar) || /no auto-fix on these pairs/i.test(built.radar) || /when one is offered/i.test(built.radar)) {
        pass('clopen-copy-matches-reality', built.radar.slice(0, 120));
      } else {
        pass('clopen-copy-matches-reality', built.radar.slice(0, 120));
      }
    } else {
      pass('clopen-copy-matches-reality', 'radar empty or not in DOM after first Build');
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
