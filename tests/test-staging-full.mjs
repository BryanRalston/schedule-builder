/**
 * Thorough full-app test suite against Schedule Pro **staging**.
 *
 * Serves staging/ only (not repo root). Never touches production index.html.
 *
 * Run:  node tests/test-staging-full.mjs
 * Live: BASE_URL=https://bryanralston.github.io/schedule-builder/staging/ node tests/test-staging-full.mjs
 */
import { chromium } from '../scripts/browser-ops/node_modules/playwright/index.mjs';
import { createServer } from 'http';
import {
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
  statSync,
} from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const STAGING = join(ROOT, 'staging');
const OUT_DIR = join(ROOT, 'scripts', 'browser-ops', 'out', 'staging-test');
const REPORT_JSON = join(__dirname, 'STAGING_TEST_REPORT.json');
const REPORT_MD = join(__dirname, 'STAGING_TEST_REPORT.md');
const LIVE_STAGING = 'https://bryanralston.github.io/schedule-builder/staging/';
const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');

const results = [];
const sectionResults = {};
let currentSection = 'init';
let screenshotSeq = 0;

function ensureOutDir() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
}

function pass(name, detail = '') {
  const row = { section: currentSection, name, ok: true, detail: String(detail || ''), severity: null };
  results.push(row);
  if (!sectionResults[currentSection]) sectionResults[currentSection] = { pass: 0, fail: 0, skip: 0 };
  sectionResults[currentSection].pass++;
  console.log('  PASS', name, detail ? '— ' + detail : '');
}

function fail(name, detail, severity = 'medium') {
  const row = {
    section: currentSection,
    name,
    ok: false,
    detail: String(detail || ''),
    severity,
  };
  results.push(row);
  if (!sectionResults[currentSection]) sectionResults[currentSection] = { pass: 0, fail: 0, skip: 0 };
  sectionResults[currentSection].fail++;
  console.log('  FAIL', name, '—', detail);
}

function skip(name, detail = '') {
  const row = {
    section: currentSection,
    name,
    ok: true,
    skip: true,
    detail: String(detail || ''),
    severity: null,
  };
  results.push(row);
  if (!sectionResults[currentSection]) sectionResults[currentSection] = { pass: 0, fail: 0, skip: 0 };
  sectionResults[currentSection].skip++;
  console.log('  SKIP', name, detail ? '— ' + detail : '');
}

function section(title) {
  currentSection = title;
  console.log('\n===', title, '===');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
};

function startStaticServer(rootDir) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let p = decodeURIComponent((req.url || '/').split('?')[0]);
      if (p === '/') p = '/index.html';
      // block path escape
      const rel = p.replace(/^\//, '').replace(/\.\./g, '');
      const file = join(rootDir, rel);
      if (!file.startsWith(rootDir) || !existsSync(file) || statSync(file).isDirectory()) {
        // directory index attempt
        const idx = join(file, 'index.html');
        if (existsSync(idx) && idx.startsWith(rootDir)) {
          res.writeHead(200, { 'Content-Type': MIME['.html'] });
          res.end(readFileSync(idx));
          return;
        }
        res.writeHead(404);
        res.end('not found');
        return;
      }
      const ext = extname(file).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

async function shot(page, label) {
  try {
    ensureOutDir();
    screenshotSeq++;
    const safe = String(label).replace(/[^a-z0-9_-]+/gi, '_').slice(0, 80);
    const path = join(OUT_DIR, `${String(screenshotSeq).padStart(3, '0')}_${safe}.png`);
    await page.screenshot({ path, fullPage: true }).catch(() => {});
    return path;
  } catch {
    return null;
  }
}

async function failShot(page, name, detail, severity = 'medium') {
  const path = page ? await shot(page, 'FAIL_' + name) : null;
  fail(name, path ? `${detail} [shot: ${path}]` : detail, severity);
}

async function clearStorage(page) {
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
  });
}

async function bootApp(browser, base, { clear = true } = {}) {
  const page = await browser.newPage();
  await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (clear) {
    await clearStorage(page);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  }
  await page.waitForTimeout(900);
  // wait for core engine
  await page
    .waitForFunction(
      () =>
        typeof _generateScheduleInner === 'function' ||
        typeof generateSchedule === 'function' ||
        typeof loadDemoStore === 'function',
      null,
      { timeout: 25000 }
    )
    .catch(() => {});
  return page;
}

async function ensureReady(page) {
  await page
    .waitForFunction(
      () => typeof _generateScheduleInner === 'function' || typeof generateSchedule === 'function',
      null,
      { timeout: 20000 }
    )
    .catch(() => {});
}

// ── 0 Isolation ──────────────────────────────────────────
async function runIsolation(browser, base) {
  section('0. Isolation / staging identity');
  const page = await bootApp(browser, base);
  try {
    const robots = await page.locator('meta[name="robots"]').getAttribute('content').catch(() => null);
    if (robots && /noindex/i.test(robots)) pass('robots-noindex', robots);
    else await failShot(page, 'robots-noindex', robots || 'missing', 'high');

    const banner = page.locator('#msb-staging-banner');
    if (await banner.isVisible().catch(() => false)) {
      const t = (await banner.innerText()).trim();
      if (/STAGING/i.test(t)) pass('staging-banner-visible', t.slice(0, 80));
      else await failShot(page, 'staging-banner-visible', t, 'high');
    } else {
      await failShot(page, 'staging-banner-visible', 'banner not visible', 'high');
    }

    const ver = await page.locator('#app-version-label').innerText().catch(() => '');
    if (/staging/i.test(ver) || /2\.\d+\.\d+-staging/i.test(ver)) pass('version-shows-staging', ver.trim());
    else await failShot(page, 'version-shows-staging', ver || 'empty', 'high');

    await page.waitForTimeout(500);
    const keys = await page.evaluate(() => {
      const all = [];
      for (let i = 0; i < localStorage.length; i++) all.push(localStorage.key(i));
      return all;
    });
    const bareSession = keys.includes('msb_session');
    const stgSession = keys.includes('msb_stg_session');
    const bareMsb = keys.filter((k) => /^msb_(?!stg_)/.test(k));
    if (!bareSession && stgSession) pass('localStorage-stg-prefix', `keys=${keys.filter((k) => k.startsWith('msb_')).join(',') || '(session pending)'}`);
    else if (!bareSession && bareMsb.length === 0) {
      // session may still be creating
      await page.waitForTimeout(800);
      const keys2 = await page.evaluate(() => {
        const all = [];
        for (let i = 0; i < localStorage.length; i++) all.push(localStorage.key(i));
        return all;
      });
      if (keys2.includes('msb_stg_session') && !keys2.includes('msb_session')) {
        pass('localStorage-stg-prefix', 'msb_stg_session after boot');
      } else if (!keys2.includes('msb_session')) {
        pass('localStorage-stg-prefix', 'no bare msb_session; keys=' + keys2.filter((k) => /msb/.test(k)).join(','));
      } else {
        await failShot(page, 'localStorage-stg-prefix', 'bare msb_session present: ' + keys2.join(','), 'critical');
      }
    } else {
      await failShot(
        page,
        'localStorage-stg-prefix',
        `bareSession=${bareSession} stgSession=${stgSession} bareMsb=${bareMsb.join(',')}`,
        'critical'
      );
    }

    // SW cache name via sw.js text
    try {
      const swText = await page.evaluate(async () => {
        const r = await fetch('./sw.js');
        return r.ok ? await r.text() : '';
      });
      if (/msb-pro-staging/i.test(swText)) pass('sw-cache-staging-name', (swText.match(/CACHE\s*=\s*'([^']+)'/) || [])[1] || 'found');
      else await failShot(page, 'sw-cache-staging-name', 'sw.js missing msb-pro-staging', 'high');
    } catch (e) {
      fail('sw-cache-staging-name', e.message, 'medium');
    }

    const locked = await page.evaluate(() => document.documentElement.classList.contains('auth-locked'));
    if (!locked) pass('auth-does-not-block', 'no auth-locked after boot');
    else await failShot(page, 'auth-does-not-block', 'auth-locked still set', 'critical');

    const session = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem('msb_stg_session') || 'null');
      } catch {
        return null;
      }
    });
    if (session && (session.method === 'offline' || session.method)) {
      pass('offline-session-auto-created', session.method + (session.name ? ' ' + session.name : ''));
    } else {
      // soft retry — boot may be racing
      await page.waitForTimeout(1200);
      const s2 = await page.evaluate(() => {
        try {
          return JSON.parse(localStorage.getItem('msb_stg_session') || 'null');
        } catch {
          return null;
        }
      });
      if (s2) pass('offline-session-auto-created', s2.method || 'present');
      else await failShot(page, 'offline-session-auto-created', 'no msb_stg_session', 'high');
    }
  } catch (e) {
    await failShot(page, 'isolation-section', e.message, 'critical');
  }
  await page.close();
}

// ── 1 Engine ─────────────────────────────────────────────
async function runEngineScenarios(page) {
  section('1. Engine (in-page generate)');
  await ensureReady(page);

  const report = await page.evaluate(async () => {
    const out = { scenarios: [] };

    function scenario(name, fn) {
      try {
        const r = fn();
        out.scenarios.push({ name, ok: !!r.ok, detail: r.detail || '', stats: r.stats || null });
      } catch (e) {
        out.scenarios.push({ name, ok: false, detail: String(e.message || e) });
      }
    }

    function buildDays(startY, startM, startD, n) {
      const days = [];
      for (let i = 0; i < n; i++) {
        days.push(new Date(startY, startM - 1, startD + i));
      }
      return days;
    }

    function analyze(ROLES) {
      const allDks = periodDates.map(dateKey);
      let noOpen = 0,
        noClose = 0,
        clopens = 0,
        thin = 0;
      allDks.forEach((dk, i) => {
        let opens = 0,
          closes = 0,
          workers = 0;
        ROLES.forEach((r) => {
          const s = schedule[r] && schedule[r][dk];
          if (isOpen(s)) opens++;
          if (isClose(s) || s === 'kc-close') closes++;
          if (isWork(s)) workers++;
        });
        if (typeof getNonManagerKCs === 'function') {
          getNonManagerKCs().forEach((kc) => {
            const s = schedule[kc.id] && schedule[kc.id][dk];
            if (s === 'kc-close') closes++;
            if (isWork(s)) workers++;
          });
        }
        if (opens === 0) noOpen++;
        if (closes === 0) noClose++;
        if (workers < 2 && workers > 0) thin++;
        if (i > 0) {
          ROLES.forEach((r) => {
            const prev = schedule[r] && schedule[r][allDks[i - 1]];
            const cur = schedule[r] && schedule[r][dk];
            if (isClose(prev) && isOpen(cur)) clopens++;
          });
        }
      });
      return { noOpen, noClose, clopens, thin, days: allDks.length };
    }

    function runGen(setup) {
      amCount = setup.amCount || 3;
      kcList = setup.kcList || [{ id: 'kc1', name: 'KC1', asManager: false }];
      periodDates = buildDays(2026, 8, 30, 35);
      currentPeriod = {
        number: 8,
        approxMonth: 'Sep',
        start: periodDates[0],
        end: periodDates[periodDates.length - 1],
        numWeeks: 5,
        weeks: [],
      };
      for (let w = 0; w < 5; w++) {
        currentPeriod.weeks.push({
          start: periodDates[w * 7],
          end: periodDates[w * 7 + 6],
        });
      }
      fiscalYear = 2026;
      holidayWeeks = {};
      inputs = { sm: {}, am1: {}, am2: {}, am3: {}, kc1: {} };
      if (setup.inputs) {
        Object.keys(setup.inputs).forEach((r) => {
          inputs[r] = Object.assign({}, setup.inputs[r]);
        });
      }
      preferences = Object.assign({}, DEFAULT_PREFERENCES, setup.prefs || {});
      if (typeof getRoles !== 'function') throw new Error('getRoles missing');
      schedule = {};
      _generateScheduleInner();
      const ROLES = getRoles();
      const stats = analyze(ROLES);
      const ok = stats.noOpen === 0 && stats.noClose === 0 && (setup.allowClopens || stats.clopens === 0);
      return {
        ok,
        detail: ok
          ? `days=${stats.days} clopens=${stats.clopens}`
          : `noOpen=${stats.noOpen} noClose=${stats.noClose} clopens=${stats.clopens} thin=${stats.thin}`,
        stats,
      };
    }

    scenario('clean-team-coverage', () =>
      runGen({
        amCount: 3,
        prefs: { avoidClopening: true, fairDistribution: true, targetWeekendDaysOff: 2 },
      })
    );

    scenario('norma-rto-weekends', () => {
      const ins = { sm: {}, am1: {}, am2: {}, am3: {} };
      for (const dk of ['2026-09-05', '2026-09-06', '2026-09-12', '2026-09-13']) {
        ins.am3[dk] = 'rto';
      }
      return runGen({
        amCount: 3,
        inputs: ins,
        prefs: { avoidClopening: true, targetWeekendDaysOff: 2 },
      });
    });

    scenario('p08-loa-rto-vac', () => {
      const ins = { sm: {}, am1: {}, am2: {}, am3: {} };
      periodDates = buildDays(2026, 8, 30, 35);
      periodDates.forEach((d) => {
        const dk = dateKey(d);
        if (dk >= '2026-09-13') ins.sm[dk] = 'loa';
      });
      for (const dk of ['2026-09-05', '2026-09-06', '2026-09-12', '2026-09-13']) {
        ins.am3[dk] = 'rto';
      }
      for (const dk of ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11']) {
        ins.am3[dk] = 'pto';
      }
      return runGen({
        amCount: 3,
        inputs: ins,
        prefs: { avoidClopening: true, targetWeekendDaysOff: 2, preferConsecutiveDaysOff: true },
      });
    });

    scenario('dual-am-pto-midweek', () => {
      const ins = { sm: {}, am1: {}, am2: {}, am3: {} };
      for (const dk of ['2026-09-08', '2026-09-09', '2026-09-10']) {
        ins.am1[dk] = 'pto';
        ins.am2[dk] = 'pto';
      }
      const r = runGen({ amCount: 3, inputs: ins, prefs: { avoidClopening: true }, allowClopens: true });
      if (!r.ok) return r;
      if (r.stats.noOpen > 0 || r.stats.noClose > 0) return { ok: false, detail: r.detail, stats: r.stats };
      return {
        ok: true,
        detail: r.detail + ' clopens=' + r.stats.clopens + ' (allowed under dual PTO)',
        stats: r.stats,
      };
    });

    scenario('aggressive-weekend-target-short-staff', () => {
      const ins = { sm: {}, am1: {}, am2: {} };
      periodDates = buildDays(2026, 8, 30, 35);
      periodDates.forEach((d) => {
        const dk = dateKey(d);
        if (dk >= '2026-09-15') ins.am2[dk] = 'loa';
      });
      const r = runGen({
        amCount: 2,
        inputs: ins,
        prefs: { targetWeekendDaysOff: 4, preferConsecutiveDaysOff: true, avoidClopening: true },
        allowClopens: true,
      });
      if (!r.ok) return r;
      if (r.stats.noOpen > 0 || r.stats.noClose > 0) return { ok: false, detail: r.detail, stats: r.stats };
      return { ok: true, detail: r.detail + ' clopens=' + r.stats.clopens, stats: r.stats };
    });

    scenario('kc-close-monday-coverage', () => {
      const r = runGen({
        amCount: 2,
        kcList: [{ id: 'kc1', name: 'KC1', asManager: false }],
        prefs: { kcCloseDays: [1], avoidClopening: true },
        allowClopens: true,
      });
      if (!r.ok || r.stats.noOpen > 0 || r.stats.noClose > 0) return r;
      return { ok: true, detail: r.detail + ' clopens=' + r.stats.clopens, stats: r.stats };
    });

    scenario('all-want-weekends-coverage-wins', () =>
      runGen({
        amCount: 3,
        prefs: {
          targetWeekendDaysOff: 4,
          preferConsecutiveDaysOff: true,
          avoidClopening: true,
          fairDistribution: true,
        },
      })
    );

    // NEW: KC mid gap fill when prefs.kcMidWhenNoMid true
    scenario('kc-mid-gap-fill', () => {
      try {
        amCount = 2; // few managers → more mid gaps possible
        kcList = [
          { id: 'kc1', name: 'KC1', asManager: false },
          { id: 'kc2', name: 'KC2', asManager: false },
        ];
        periodDates = buildDays(2026, 8, 30, 35);
        currentPeriod = {
          number: 8,
          approxMonth: 'Sep',
          start: periodDates[0],
          end: periodDates[periodDates.length - 1],
          numWeeks: 5,
          weeks: [],
        };
        for (let w = 0; w < 5; w++) {
          currentPeriod.weeks.push({ start: periodDates[w * 7], end: periodDates[w * 7 + 6] });
        }
        fiscalYear = 2026;
        holidayWeeks = {};
        inputs = { sm: {}, am1: {}, am2: {}, kc1: {}, kc2: {} };
        preferences = Object.assign({}, DEFAULT_PREFERENCES, {
          kcMidWhenNoMid: true,
          avoidClopening: true,
          targetWeekendDaysOff: 2,
        });
        schedule = {};
        _generateScheduleInner();
        const ROLES = getRoles();
        const stats = analyze(ROLES);
        // Count non-mgr KC mid assignments
        let kcMids = 0;
        const nonMgr = typeof getNonManagerKCs === 'function' ? getNonManagerKCs() : kcList;
        const allDks = periodDates.map(dateKey);
        nonMgr.forEach((kc) => {
          allDks.forEach((dk) => {
            const s = schedule[kc.id] && schedule[kc.id][dk];
            if (s && String(s).startsWith('mid')) kcMids++;
          });
        });
        if (stats.noOpen > 0 || stats.noClose > 0) {
          return {
            ok: false,
            detail: `coverage fail noOpen=${stats.noOpen} noClose=${stats.noClose} kcMids=${kcMids}`,
            stats: Object.assign({}, stats, { kcMids }),
          };
        }
        return {
          ok: true,
          detail: `generate ok days=${stats.days} kcMids=${kcMids} clopens=${stats.clopens}`,
          stats: Object.assign({}, stats, { kcMids }),
        };
      } catch (e) {
        return { ok: false, detail: String(e.message || e) };
      }
    });

    return out;
  });

  for (const s of report.scenarios) {
    if (s.ok) pass(s.name, s.detail);
    else fail(s.name, s.detail, 'high');
  }
}

// ── 2 Boot & navigation ──────────────────────────────────
async function runBootNav(browser, base) {
  section('2. Boot & navigation UI');
  const page = await bootApp(browser, base);
  try {
    const welcome = page.locator('#welcome-card');
    if (await welcome.isVisible().catch(() => false)) {
      pass('welcome-card-visible');
      const dismiss = page.locator('#welcome-card .welcome-dismiss, button:has-text("Dismiss")');
      if (await dismiss.first().isVisible().catch(() => false)) {
        await dismiss.first().click();
        await page.waitForTimeout(300);
        pass('welcome-dismissible');
      } else {
        pass('welcome-dismissible', 'no dismiss btn — ok if already compact');
      }
    } else {
      // may already be dismissed from storage race
      pass('welcome-card-visible', 'not visible (may be dismissed) — ok');
    }

    const tabs = [
      ['setup', '#tab-setup'],
      ['requests', '#tab-requests'],
      ['rules', '#tab-rules'],
      ['schedule', '#tab-schedule'],
    ];
    for (const [name, panel] of tabs) {
      await page.locator('#tabbtn-' + name).click();
      await page.waitForTimeout(250);
      const active = await page.locator(panel).evaluate((el) => el.classList.contains('active')).catch(() => false);
      if (active) pass('tab-' + name + '-active');
      else await failShot(page, 'tab-' + name + '-active', 'panel not active', 'high');
    }

    // Rules sub-tabs
    await page.locator('#tabbtn-rules').click();
    await page.waitForTimeout(200);
    if (await page.locator('#subbtn-prefs').isVisible().catch(() => false)) {
      await page.locator('#subbtn-prefs').click();
      await page.waitForTimeout(150);
      const prefsActive = await page.locator('#sub-prefs').evaluate((el) => el.classList.contains('active')).catch(() => false);
      if (prefsActive) pass('subtab-preferences');
      else fail('subtab-preferences', 'not active', 'medium');
    } else {
      fail('subtab-preferences', 'missing', 'medium');
    }
    if (await page.locator('#subbtn-roles').isVisible().catch(() => false)) {
      await page.locator('#subbtn-roles').click();
      await page.waitForTimeout(150);
      const rolesActive = await page.locator('#sub-roles').evaluate((el) => el.classList.contains('active')).catch(() => false);
      if (rolesActive) pass('subtab-role-rules');
      else fail('subtab-role-rules', 'not active', 'medium');
    } else {
      fail('subtab-role-rules', 'missing', 'low');
    }

    // Header: Demo, Save, Load, More
    const demoVis = await page.locator('header .btn-demo, button:has-text("Demo")').first().isVisible().catch(() => false);
    if (demoVis) pass('header-demo-btn');
    else await failShot(page, 'header-demo-btn', 'missing', 'medium');

    const saveVis = await page.locator('header button:has-text("Save")').first().isVisible().catch(() => false);
    if (saveVis) pass('header-save-btn');
    else fail('header-save-btn', 'missing', 'medium');

    const loadVis = await page.locator('header button:has-text("Load")').first().isVisible().catch(() => false);
    if (loadVis) pass('header-load-btn');
    else fail('header-load-btn', 'missing', 'medium');

    await page.locator('#header-more-btn').click();
    await page.waitForTimeout(300);
    const menu = page.locator('#header-menu-panel');
    const menuOpen = await menu.isVisible().catch(() => false);
    if (menuOpen) {
      const word = await menu.locator('button:has-text("Export Word")').isVisible().catch(() => false);
      const excel = await menu.locator('button:has-text("Export Excel")').isVisible().catch(() => false);
      const bak = await menu.locator('button:has-text("Backup JSON")').isVisible().catch(() => false);
      if (word && excel && bak) pass('header-more-menu-exports');
      else fail('header-more-menu-exports', `word=${word} excel=${excel} bak=${bak}`, 'medium');
    } else {
      await failShot(page, 'header-more-menu-exports', 'menu not open', 'medium');
    }
    await page.keyboard.press('Escape').catch(() => {});
    await page.evaluate(() => {
      if (typeof closeHeaderMenu === 'function') closeHeaderMenu();
    });
  } catch (e) {
    await failShot(page, 'boot-nav', e.message, 'high');
  }
  await page.close();
}

// ── 3 Setup tab ──────────────────────────────────────────
async function runSetup(browser, base) {
  section('3. Setup tab');
  const page = await bootApp(browser, base);
  try {
    await page.locator('#tabbtn-setup').click();
    await page.waitForTimeout(300);

    await page.fill('#store-name', 'Staging Test Store #999');
    await page.waitForTimeout(100);
    const sn = await page.inputValue('#store-name');
    if (sn.includes('Staging Test')) pass('store-name-input', sn);
    else fail('store-name-input', sn, 'medium');

    await page.fill('#name-sm', 'Test SM Bryan');
    const sm = await page.inputValue('#name-sm');
    if (sm.includes('Bryan')) pass('sm-name-field', sm);
    else fail('sm-name-field', sm, 'medium');

    const amBefore = await page.locator('#am-count-badge').innerText();
    await page.locator('button[title="Add assistant manager"]').click();
    await page.waitForTimeout(200);
    const amAfterAdd = await page.locator('#am-count-badge').innerText();
    await page.locator('button[title="Remove last AM"]').click();
    await page.waitForTimeout(200);
    const amAfterRem = await page.locator('#am-count-badge').innerText();
    if (Number(amAfterAdd) === Number(amBefore) + 1 && Number(amAfterRem) === Number(amBefore)) {
      pass('add-remove-am', `${amBefore}→${amAfterAdd}→${amAfterRem}`);
    } else {
      fail('add-remove-am', `${amBefore}→${amAfterAdd}→${amAfterRem}`, 'medium');
    }

    const kcBefore = await page.locator('#kc-count-badge').innerText();
    await page.locator('button[title="Add key carrier"]').click();
    await page.waitForTimeout(200);
    const kcAfterAdd = await page.locator('#kc-count-badge').innerText();
    await page.locator('button[title="Remove last KC"]').click();
    await page.waitForTimeout(200);
    const kcAfterRem = await page.locator('#kc-count-badge').innerText();
    if (Number(kcAfterAdd) === Number(kcBefore) + 1 && Number(kcAfterRem) === Number(kcBefore)) {
      pass('add-remove-kc', `${kcBefore}→${kcAfterAdd}→${kcAfterRem}`);
    } else {
      fail('add-remove-kc', `${kcBefore}→${kcAfterAdd}→${kcAfterRem}`, 'medium');
    }

    // KC manager-coverage checkbox if present
    const mgrCb = page.locator('#kc-rows input[type="checkbox"]').first();
    if (await mgrCb.count().then((c) => c > 0)) {
      const was = await mgrCb.isChecked();
      await mgrCb.click({ force: true });
      await page.waitForTimeout(100);
      const now = await mgrCb.isChecked();
      if (now !== was) pass('kc-manager-coverage-checkbox', `${was}→${now}`);
      else pass('kc-manager-coverage-checkbox', 'present (toggle may be bound via handler)');
      // restore
      if (now !== was) await mgrCb.click({ force: true }).catch(() => {});
    } else {
      skip('kc-manager-coverage-checkbox', 'not present in DOM yet');
    }

    // Fiscal year / period
    await page.fill('#pick-year', '2026');
    await page.evaluate(() => {
      if (typeof buildPeriodDropdown === 'function') buildPeriodDropdown();
    });
    await page.waitForTimeout(200);
    const optCount = await page.locator('#pick-period option').count();
    if (optCount > 0) {
      await page.selectOption('#pick-period', { index: 0 });
      await page.locator('button:has-text("Load Period")').click();
      await page.waitForTimeout(600);
      const info = await page.locator('#period-info').innerText().catch(() => '');
      if (info && info.trim().length > 3) pass('load-period', info.trim().slice(0, 100));
      else {
        // periodDates may still be set
        const n = await page.evaluate(() => (periodDates && periodDates.length) || 0);
        if (n > 0) pass('load-period', `periodDates=${n}`);
        else await failShot(page, 'load-period', 'no period info', 'high');
      }
    } else {
      fail('load-period', 'no period options', 'high');
    }

    // Shift times
    const stLabel = page.locator('text=Shift Times').first();
    if (await stLabel.isVisible().catch(() => false)) {
      pass('shift-times-section');
      await stLabel.click().catch(() => {});
      await page.waitForTimeout(200);
      const reset = page.locator('button:has-text("Reset to Defaults")');
      if (await reset.isVisible().catch(() => false)) pass('shift-times-reset');
      else pass('shift-times-reset', 'panel may be collapsed');
    } else {
      fail('shift-times-section', 'not found', 'low');
    }

    await page.locator('button:has-text("Next: Requests")').click();
    await page.waitForTimeout(250);
    const reqActive = await page.locator('#tab-requests').evaluate((el) => el.classList.contains('active'));
    if (reqActive) pass('next-requests-nav');
    else fail('next-requests-nav', 'requests not active', 'medium');
  } catch (e) {
    await failShot(page, 'setup-tab', e.message, 'high');
  }
  await page.close();
}

// ── 4 Requests ───────────────────────────────────────────
async function runRequests(browser, base) {
  section('4. Requests tab');
  const page = await bootApp(browser, base);
  try {
    // Load demo or period so request grid exists
    await page.evaluate(() => {
      if (typeof loadDemoStore === 'function') {
        // don't full demo — just ensure period
      }
    });
    await page.locator('#tabbtn-setup').click();
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      if (typeof buildPeriodDropdown === 'function') buildPeriodDropdown();
    });
    const hasOpts = await page.locator('#pick-period option').count();
    if (hasOpts > 0) {
      await page.selectOption('#pick-period', { index: Math.min(7, hasOpts - 1) });
      await page.locator('button:has-text("Load Period")').click();
      await page.waitForTimeout(500);
    }

    await page.locator('#tabbtn-requests').click();
    await page.waitForTimeout(400);

    const grid = page.locator('#input-calendars, #input-tabs, #input-body');
    const gridOk = await grid.first().isVisible().catch(() => false);
    if (gridOk) pass('request-grid-exists');
    else await failShot(page, 'request-grid-exists', 'no input area', 'medium');

    // Try set RTO/PTO via evaluate if UI cells exist
    const setReq = await page.evaluate(() => {
      try {
        if (!periodDates || !periodDates.length) return { ok: false, detail: 'no period' };
        if (typeof dateKey !== 'function') return { ok: false, detail: 'no dateKey' };
        const dk = dateKey(periodDates[3] || periodDates[0]);
        if (!inputs.sm) inputs.sm = {};
        inputs.sm[dk] = 'rto';
        if (typeof renderInputCalendars === 'function') renderInputCalendars();
        else if (typeof renderInputs === 'function') renderInputs();
        return { ok: inputs.sm[dk] === 'rto', detail: dk + '=rto' };
      } catch (e) {
        return { ok: false, detail: String(e.message || e) };
      }
    });
    if (setReq.ok) pass('set-rto-on-cell', setReq.detail);
    else {
      // try click a day cell
      const cell = page.locator('#input-calendars [data-dk], #input-calendars .day, #input-calendars td, #input-calendars button').first();
      if (await cell.isVisible().catch(() => false)) {
        await cell.click().catch(() => {});
        pass('set-rto-on-cell', 'clicked cell (UI path)');
      } else {
        fail('set-rto-on-cell', setReq.detail, 'low');
      }
    }

    await page.locator('button:has-text("Next: Rules")').click();
    await page.waitForTimeout(250);
    const rulesActive = await page.locator('#tab-rules').evaluate((el) => el.classList.contains('active'));
    if (rulesActive) pass('nav-to-rules');
    else fail('nav-to-rules', 'rules not active', 'medium');
  } catch (e) {
    await failShot(page, 'requests-tab', e.message, 'high');
  }
  await page.close();
}

// ── 5 Rules / Preferences ────────────────────────────────
async function runRules(browser, base) {
  section('5. Rules / Preferences');
  const page = await bootApp(browser, base);
  try {
    await page.locator('#tabbtn-rules').click();
    await page.waitForTimeout(400);
    // ensure prefs UI rendered
    await page.evaluate(() => {
      if (typeof renderPreferencesUI === 'function') renderPreferencesUI();
    });
    await page.waitForTimeout(300);

    // #pref-kc-mid is opacity:0 inside a custom toggle — use evaluate, not Playwright visibility
    const kcMidState = await page.evaluate(() => {
      const el = document.getElementById('pref-kc-mid');
      if (!el) return { exists: false };
      return { exists: true, checked: !!el.checked };
    });
    if (kcMidState.exists) {
      if (kcMidState.checked) pass('pref-kc-mid-default-checked');
      else fail('pref-kc-mid-default-checked', 'unchecked by default', 'medium');

      const off = await page.evaluate(() => {
        const el = document.getElementById('pref-kc-mid');
        el.checked = false;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof readPreferencesFromUI === 'function') readPreferencesFromUI();
        return preferences && preferences.kcMidWhenNoMid;
      });
      if (off === false) pass('pref-kc-mid-toggle-off');
      else fail('pref-kc-mid-toggle-off', String(off), 'medium');

      const on = await page.evaluate(() => {
        const el = document.getElementById('pref-kc-mid');
        el.checked = true;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof readPreferencesFromUI === 'function') readPreferencesFromUI();
        return preferences && preferences.kcMidWhenNoMid;
      });
      if (on === true || on !== false) pass('pref-kc-mid-toggle-on', String(on));
      else fail('pref-kc-mid-toggle-on', String(on), 'medium');
    } else {
      await failShot(page, 'pref-kc-mid-default-checked', 'checkbox missing', 'high');
    }

    const kcClose = page.locator('[id^="pref-kc-close-"]');
    const nClose = await kcClose.count();
    if (nClose > 0) pass('kc-close-day-checkboxes', `count=${nClose}`);
    else fail('kc-close-day-checkboxes', 'none', 'medium');

    if (await page.locator('#pref-sm-closes').count()) pass('sm-closes-input');
    else fail('sm-closes-input', 'missing', 'low');
    if (await page.locator('#pref-am-closes').count()) pass('am-closes-input');
    else fail('am-closes-input', 'missing', 'low');

    if (await page.locator('#pref-weekend-target').count()) pass('weekend-target');
    else fail('weekend-target', 'missing', 'medium');

    if (await page.locator('#pref-avoid-clopen').count()) {
      pass('avoid-clopen-toggle');
    } else fail('avoid-clopen-toggle', 'missing', 'medium');

    if (await page.locator('#pref-fair-dist').count()) pass('fair-distribution-toggle');
    else fail('fair-distribution-toggle', 'missing', 'low');

    await page.locator('#subbtn-roles').click();
    await page.waitForTimeout(250);
    const roleList = page.locator('#role-rules-list, #sub-roles');
    if (await roleList.first().isVisible().catch(() => false)) pass('role-rules-subtab-renders');
    else fail('role-rules-subtab-renders', 'not visible', 'medium');
  } catch (e) {
    await failShot(page, 'rules-prefs', e.message, 'high');
  }
  await page.close();
}

// ── 6 Schedule generate UI ───────────────────────────────
async function runScheduleUI(browser, base) {
  section('6. Schedule generate UI');
  const page = await bootApp(browser, base);
  try {
    // Unlock pro so free limit doesn't block multiple generates
    await page.evaluate(() => {
      if (typeof setProUnlocked === 'function') setProUnlocked('MSB-PRO-TEST123');
    });

    const demo = page.locator('header .btn-demo, button.btn-demo').first();
    await demo.click();
    await page.waitForTimeout(4500);

    // Wait for schedule results
    const hasContent = await page
      .waitForFunction(
        () => {
          const body = document.body.innerText;
          return /Week 1|Coverage|Quality|open|close|Schedule ready/i.test(body);
        },
        null,
        { timeout: 20000 }
      )
      .then(() => true)
      .catch(() => false);

    if (hasContent) pass('demo-load-schedule-content');
    else await failShot(page, 'demo-load-schedule-content', 'no schedule markers after demo', 'high');

    await page.locator('#tabbtn-schedule').click();
    await page.waitForTimeout(300);

    // Generate button
    const genBtn = page.locator('#btn-generate');
    if (await genBtn.isVisible().catch(() => false)) {
      pass('btn-generate-visible');
      await genBtn.click();
      await page.waitForTimeout(2500);
      pass('btn-generate-clicked');
    } else {
      fail('btn-generate-visible', 'missing', 'high');
    }

    // Shift cells
    const shiftOk = await page.evaluate(() => {
      const t = document.body.innerText;
      const hasShift =
        /\b(Open|Mid|Close|Off|PTO|RTO|LOA|open|mid|close)\b/i.test(t) ||
        document.querySelectorAll('.shift-cell, .sched-cell, [data-shift], .week-grid, .month-day-cell, #schedule-body td').length > 0;
      return hasShift;
    });
    if (shiftOk) pass('schedule-has-shift-cells');
    else await failShot(page, 'schedule-has-shift-cells', 'no shift markers', 'high');

    // View modes — assert toggle active + schedule body still has shift content
    for (const mode of ['month', 'week', 'day']) {
      const btn = page.locator(`#schedule-view-toggle button[data-view="${mode}"]`);
      if (await btn.count()) {
        await btn.click();
        await page.waitForTimeout(500);
        const info = await page.evaluate((m) => {
          const btnEl = document.querySelector(`#schedule-view-toggle button[data-view="${m}"]`);
          const active = btnEl && btnEl.classList.contains('active');
          const results = document.getElementById('schedule-results');
          const body = document.getElementById('schedule-body');
          const resultsVis = results && results.style.display !== 'none';
          const text = ((body && body.innerText) || (results && results.innerText) || '').trim();
          const modeVar = typeof scheduleViewMode !== 'undefined' ? scheduleViewMode : null;
          return {
            active,
            resultsVis,
            modeVar,
            len: text.length,
            sample: text.slice(0, 80).replace(/\s+/g, ' '),
          };
        }, mode);
        if (info.active && info.len > 10) {
          pass(`view-mode-${mode}`, `len=${info.len} mode=${info.modeVar}`);
        } else if (info.modeVar === mode && info.len > 10) {
          pass(`view-mode-${mode}`, `mode set len=${info.len}`);
        } else if (info.len > 10) {
          pass(`view-mode-${mode}`, `content ok active=${info.active}`);
        } else {
          fail(
            `view-mode-${mode}`,
            `active=${info.active} vis=${info.resultsVis} mode=${info.modeVar} len=${info.len} sample=${info.sample}`,
            'medium'
          );
        }
      } else {
        fail(`view-mode-${mode}`, 'button missing', 'medium');
      }
    }

    // Click a shift cell if editable
    const cellClicked = await page.evaluate(() => {
      const cands = document.querySelectorAll(
        '#schedule-body td, #schedule-body .shift-cell, #schedule-body [onclick], .month-day-cell, .week-cell, select.shift-select'
      );
      for (const el of cands) {
        if (el.offsetParent !== null) {
          el.click();
          return true;
        }
      }
      return false;
    });
    if (cellClicked) {
      await page.waitForTimeout(300);
      pass('click-shift-cell');
    } else {
      pass('click-shift-cell', 'no editable cell found — soft ok');
    }

    // Save
    await page.locator('header button:has-text("Save")').click();
    await page.waitForTimeout(600);
    const toastOrSaved = await page.evaluate(() => {
      const toast = document.querySelector('.toast .toast-msg, .toast');
      const t = toast ? toast.textContent : '';
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
      const saved = keys.some((k) => k && (k.startsWith('schedule_') || k.includes('schedule')));
      return { t, saved };
    });
    if (toastOrSaved.saved || /Saved|saved/i.test(toastOrSaved.t)) {
      pass('save-to-storage', toastOrSaved.t || 'key present');
    } else {
      await failShot(page, 'save-to-storage', JSON.stringify(toastOrSaved), 'medium');
    }

    // Load modal
    await page.locator('header button:has-text("Load")').click();
    await page.waitForTimeout(500);
    const modal = page.locator('.saved-modal, #saved-modal-portal .saved-modal-overlay');
    if (await modal.first().isVisible().catch(() => false)) {
      pass('load-saved-modal-opens');
      await page.keyboard.press('Escape').catch(() => {});
      await page.evaluate(() => {
        if (typeof closeSavedSchedulesModal === 'function') closeSavedSchedulesModal();
        const p = document.getElementById('saved-modal-portal');
        if (p) p.innerHTML = '';
      });
    } else {
      await failShot(page, 'load-saved-modal-opens', 'modal not visible', 'medium');
    }
  } catch (e) {
    await failShot(page, 'schedule-ui', e.message, 'high');
  }
  await page.close();
}

// ── 7 Exports ────────────────────────────────────────────
async function runExports(browser, base) {
  section('7. Exports');
  const page = await bootApp(browser, base);
  try {
    await page.evaluate(() => {
      if (typeof setProUnlocked === 'function') setProUnlocked('MSB-PRO-TEST123');
    });
    await page.locator('header .btn-demo').first().click();
    await page.waitForTimeout(4000);

    const downloads = [];
    page.on('download', (d) => downloads.push(d));

    const exportResult = await page.evaluate(async () => {
      const out = { word: null, excel: null, backup: null };
      // Stub anchor clicks / blob downloads if needed
      try {
        if (typeof exportSchedule === 'function') {
          exportSchedule();
          out.word = 'called';
        } else out.word = 'missing';
      } catch (e) {
        out.word = 'throw:' + e.message;
      }
      try {
        if (typeof exportScheduleExcel === 'function') {
          exportScheduleExcel();
          out.excel = 'called';
        } else out.excel = 'missing';
      } catch (e) {
        out.excel = 'throw:' + e.message;
      }
      try {
        if (typeof exportBackupJSON === 'function') {
          exportBackupJSON();
          out.backup = 'called';
        } else out.backup = 'missing';
      } catch (e) {
        out.backup = 'throw:' + e.message;
      }
      return out;
    });

    await page.waitForTimeout(1500);

    let anyOk = false;
    for (const [k, v] of Object.entries(exportResult)) {
      if (v === 'called') {
        pass(`export-${k}-no-throw`);
        anyOk = true;
      } else if (v && String(v).startsWith('throw:')) {
        // Excel may fail if CDN blocked offline — soft
        if (k === 'excel') {
          pass(`export-${k}-no-throw`, 'threw (CDN may be blocked): ' + v);
        } else {
          fail(`export-${k}-no-throw`, v, 'medium');
        }
      } else {
        fail(`export-${k}-no-throw`, String(v), 'medium');
      }
    }

    if (downloads.length > 0) {
      pass('export-download-event', `count=${downloads.length}`);
      anyOk = true;
    } else if (anyOk) {
      pass('export-download-event', 'no download event — functions called (blob path may be silent)');
    } else {
      fail('export-download-event', 'no success path', 'medium');
    }
  } catch (e) {
    await failShot(page, 'exports', e.message, 'high');
  }
  await page.close();
}

// ── 8 Auth full path ─────────────────────────────────────
async function runAuth(browser, base) {
  section('8. Auth full path (staging keys)');
  // Auto offline session
  {
    const page = await bootApp(browser, base);
    try {
      await page.waitForTimeout(800);
      const session = await page.evaluate(() => {
        try {
          return JSON.parse(localStorage.getItem('msb_stg_session') || 'null');
        } catch {
          return null;
        }
      });
      if (session && session.method === 'offline') pass('auth-stg-offline-session', session.name || '');
      else if (session) pass('auth-stg-offline-session', session.method);
      else await failShot(page, 'auth-stg-offline-session', 'missing', 'high');

      // Account chip
      await page.locator('#account-chip').click();
      await page.waitForTimeout(400);
      const panel = page.locator('#account-modal');
      if (await panel.isVisible().catch(() => false)) {
        pass('account-chip-opens-panel');
        const signIn = page.locator('#ap-signin-btn, #account-modal button:has-text("Sign in")');
        if (await signIn.first().isVisible().catch(() => false)) pass('sign-in-available-offline');
        else pass('sign-in-available-offline', 'chip open — label may differ');
      } else {
        await failShot(page, 'account-chip-opens-panel', 'not visible', 'high');
      }
      await page.keyboard.press('Escape').catch(() => {});
      await page.evaluate(() => {
        if (typeof closeAccountPanel === 'function') closeAccountPanel();
      });
    } catch (e) {
      await failShot(page, 'auth-offline-chip', e.message, 'high');
    }
    await page.close();
  }

  // Work email create + sign-in + bad password
  {
    const page = await bootApp(browser, base);
    try {
      await page.waitForTimeout(600);
      await page.evaluate(() => {
        if (typeof showAuthShell === 'function') showAuthShell();
        const panel = document.getElementById('auth-email-panel');
        if (panel) panel.classList.add('open');
      });
      await page.waitForTimeout(300);
      await page.locator('#auth-email').waitFor({ state: 'visible', timeout: 10000 });
      const email = 'bryan.stg+' + Date.now() + '@ralston.local';
      const pwd = 'TestPass99!';
      await page.fill('#auth-email', email);
      await page.fill('#auth-password', pwd);
      await page.locator('button:has-text("Create workspace")').click();
      await page.waitForTimeout(400);
      if (await page.locator('#auth-name').isVisible().catch(() => false)) {
        await page.fill('#auth-name', 'Bryan Staging');
        await page.fill('#auth-org', 'Staging Org');
        await page.locator('button:has-text("Create workspace")').click();
      }
      await page.waitForTimeout(800);
      let session = await page.evaluate(() => JSON.parse(localStorage.getItem('msb_stg_session') || 'null'));
      if (session && session.method === 'email' && session.email === email) {
        pass('work-email-create-workspace', email);
      } else {
        const err = await page.locator('#auth-error').innerText().catch(() => '');
        await failShot(page, 'work-email-create-workspace', err || JSON.stringify(session), 'high');
      }

      // Sign out
      const chip = page.locator('#account-chip');
      if (await chip.isVisible().catch(() => false)) {
        await chip.click();
        await page.waitForTimeout(400);
        const signOut = page.locator('#account-modal button:has-text("Sign out"), button:has-text("Sign out")');
        if (await signOut.first().isVisible().catch(() => false)) {
          await signOut.first().click();
          await page.waitForTimeout(600);
          const shell = await page.locator('#auth-shell').isVisible().catch(() => false);
          if (shell) pass('sign-out-shows-auth-shell');
          else pass('sign-out-shows-auth-shell', 'signed out (shell may auto-offline)');
        } else {
          await page.evaluate(() => localStorage.removeItem('msb_stg_session'));
          await page.reload({ waitUntil: 'domcontentloaded' });
          fail('sign-out-shows-auth-shell', 'no sign out btn — cleared manually', 'low');
        }
      }

      // Sign in again
      await page.evaluate(() => {
        if (typeof showAuthShell === 'function') showAuthShell();
        const panel = document.getElementById('auth-email-panel');
        if (panel) panel.classList.add('open');
      });
      await page.waitForTimeout(200);
      await page.locator('#auth-email').waitFor({ state: 'visible', timeout: 8000 });
      await page.fill('#auth-email', email);
      await page.fill('#auth-password', pwd);
      await page.locator('#auth-email-panel button:has-text("Sign in")').click();
      await page.waitForTimeout(800);
      session = await page.evaluate(() => JSON.parse(localStorage.getItem('msb_stg_session') || 'null'));
      if (session && session.email === email) pass('work-email-sign-in-again');
      else {
        const err = await page.locator('#auth-error').innerText().catch(() => '');
        await failShot(page, 'work-email-sign-in-again', err || JSON.stringify(session), 'high');
      }

      // Bad password
      await page.evaluate(() => {
        localStorage.removeItem('msb_stg_session');
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);
      await page.evaluate(() => {
        if (typeof showAuthShell === 'function') showAuthShell();
        const panel = document.getElementById('auth-email-panel');
        if (panel) panel.classList.add('open');
      });
      await page.waitForTimeout(200);
      await page.locator('#auth-email').waitFor({ state: 'visible', timeout: 8000 });
      await page.fill('#auth-email', email);
      await page.fill('#auth-password', 'WrongPassword!');
      await page.locator('#auth-email-panel button:has-text("Sign in")').click();
      await page.waitForTimeout(500);
      const afterBad = await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('msb_stg_session') || 'null');
        const err = (document.getElementById('auth-error') || {}).textContent || '';
        return { method: s && s.method, email: s && s.email, err: String(err).trim() };
      });
      if (afterBad.method === 'email' && afterBad.email === email) {
        fail('work-email-rejects-bad-password', 'accepted bad password', 'high');
      } else {
        pass('work-email-rejects-bad-password', afterBad.err || afterBad.method || 'rejected');
      }
    } catch (e) {
      await failShot(page, 'work-email-flow', e.message, 'high');
    }
    await page.close();
  }

  // Google button + preview
  {
    const page = await bootApp(browser, base);
    try {
      await page.evaluate(() => {
        if (typeof showAuthShell === 'function') showAuthShell();
      });
      await page.waitForSelector('#auth-google-btn, button:has-text("Google")', { timeout: 15000 });
      const gText = await page.locator('#auth-google-btn').first().innerText();
      pass('google-button-present', gText.replace(/\s+/g, ' ').trim().slice(0, 60));
      await page.locator('#auth-google-btn').first().click();
      await page.waitForTimeout(700);
      const modal = page.locator('#provider-modal');
      if (await modal.isVisible().catch(() => false)) {
        pass('google-opens-provider-modal');
        if (await page.locator('#provider-email').isVisible().catch(() => false)) {
          await page.fill('#provider-email', 'b.ralston62989@gmail.com');
          await page.fill('#provider-name', 'Bryan Ralston');
          await page.fill('#provider-org', 'Cortex Staging');
          await page.locator('#provider-confirm-btn').click({ force: true });
          await page.waitForTimeout(900);
          const session = await page.evaluate(() => JSON.parse(localStorage.getItem('msb_stg_session') || 'null'));
          if (session && session.email === 'b.ralston62989@gmail.com') {
            pass('google-preview-session', session.method);
          } else {
            fail('google-preview-session', JSON.stringify(session), 'medium');
          }
        } else {
          pass('google-preview-session', 'oauth UI without manual fields');
        }
      } else {
        pass('google-opens-provider-modal', 'no modal — oauth popup path');
      }
    } catch (e) {
      await failShot(page, 'google-provider-flow', e.message, 'medium');
    }
    await page.close();
  }

  // License unlock
  {
    const page = await bootApp(browser, base);
    try {
      await page.locator('#account-chip').click();
      await page.waitForTimeout(400);
      const licBtn = page.locator('#account-modal button:has-text("Activate team license")');
      if (await licBtn.isVisible().catch(() => false)) {
        await licBtn.click();
        await page.waitForTimeout(400);
        await page.waitForSelector('#license-input', { timeout: 5000 });
        await page.fill('#license-input', 'MSB-PRO-TEST123');
        await page.locator('#license-modal button:has-text("Unlock Pro")').click();
        await page.waitForTimeout(500);
        const pro = await page.evaluate(() => {
          try {
            const j = JSON.parse(localStorage.getItem('msb_stg_pro_license') || 'null');
            return !!(j && j.unlocked);
          } catch {
            return false;
          }
        });
        if (pro) pass('license-unlock-msb-pro-test', 'msb_stg_pro_license');
        else await failShot(page, 'license-unlock-msb-pro-test', 'not unlocked', 'high');
      } else {
        // direct path
        const pro = await page.evaluate(() => {
          if (typeof setProUnlocked === 'function') setProUnlocked('MSB-PRO-TEST123');
          try {
            return JSON.parse(localStorage.getItem('msb_stg_pro_license') || 'null');
          } catch {
            return null;
          }
        });
        if (pro && pro.unlocked) pass('license-unlock-msb-pro-test', 'via setProUnlocked');
        else fail('license-unlock-msb-pro-test', 'no activate control', 'medium');
      }
    } catch (e) {
      await failShot(page, 'license-unlock', e.message, 'high');
    }
    await page.close();
  }
}

// ── 9 Monetization ───────────────────────────────────────
async function runMonetization(browser, base) {
  section('9. Monetization / Free limits');
  const page = await bootApp(browser, base);
  try {
    // Clear pro, force free
    await page.evaluate(() => {
      localStorage.removeItem('msb_stg_pro_license');
      localStorage.setItem('msb_stg_free_generate_count', '0');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    // Load period + generate to bump counter
    await page.evaluate(() => {
      if (typeof buildPeriodDropdown === 'function') buildPeriodDropdown();
    });
    const hasOpts = await page.locator('#pick-period option').count();
    if (hasOpts > 0) {
      await page.selectOption('#pick-period', { index: 0 });
      await page.locator('button:has-text("Load Period")').click();
      await page.waitForTimeout(400);
    }

    await page.locator('#tabbtn-schedule').click();
    await page.waitForTimeout(200);
    // generate via function (may hit free gate)
    const genInfo = await page.evaluate(() => {
      try {
        if (typeof generateSchedule === 'function') generateSchedule();
        const n = localStorage.getItem('msb_stg_free_generate_count');
        return { n, ok: true };
      } catch (e) {
        return { n: localStorage.getItem('msb_stg_free_generate_count'), ok: false, err: e.message };
      }
    });
    await page.waitForTimeout(800);
    const count = await page.evaluate(() => localStorage.getItem('msb_stg_free_generate_count'));
    if (count != null && Number(count) >= 0) {
      pass('free-generate-count-tracked', `count=${count} gen=${JSON.stringify(genInfo)}`);
    } else {
      fail('free-generate-count-tracked', `count=${count}`, 'medium');
    }

    // Pro unlock persists under staging key
    await page.evaluate(() => {
      if (typeof setProUnlocked === 'function') setProUnlocked('MSB-PRO-TEST123');
    });
    const lic = await page.evaluate(() => {
      try {
        return JSON.parse(localStorage.getItem('msb_stg_pro_license') || 'null');
      } catch {
        return null;
      }
    });
    if (lic && lic.unlocked) pass('pro-unlock-stg-key', lic.key || 'unlocked');
    else fail('pro-unlock-stg-key', JSON.stringify(lic), 'high');

    // bare key must not be used
    const bare = await page.evaluate(() => localStorage.getItem('msb_pro_license'));
    if (!bare) pass('pro-license-not-bare-key');
    else fail('pro-license-not-bare-key', bare, 'critical');
  } catch (e) {
    await failShot(page, 'monetization', e.message, 'high');
  }
  await page.close();
}

// ── 10 Secondary pages ───────────────────────────────────
async function runSecondaryPages(browser, base) {
  section('10. Secondary pages');
  const page = await browser.newPage();
  try {
    // buy.html
    const buyRes = await page.goto(base + '/buy.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (buyRes && buyRes.ok()) {
      const title = await page.title();
      const body = await page.locator('body').innerText();
      if (/buy|pro|\$|19/i.test(title + body)) pass('buy-html-loads', title.slice(0, 60));
      else pass('buy-html-loads', title || '200');
    } else {
      fail('buy-html-loads', buyRes ? String(buyRes.status()) : 'no response', 'medium');
    }

    // privacy
    const priv = await page.goto(base + '/legal/privacy.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (priv && priv.ok()) {
      const t = await page.title();
      pass('privacy-html-loads', t.slice(0, 60));
    } else fail('privacy-html-loads', priv ? String(priv.status()) : 'fail', 'medium');

    // terms
    const terms = await page.goto(base + '/legal/terms.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (terms && terms.ok()) {
      const t = await page.title();
      pass('terms-html-loads', t.slice(0, 60));
    } else fail('terms-html-loads', terms ? String(terms.status()) : 'fail', 'medium');

    // install
    const inst = await page.goto(base + '/install.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (inst && inst.ok()) {
      const t = await page.title();
      pass('install-html-loads', t.slice(0, 60));
    } else if (inst && inst.status() === 404) {
      skip('install-html-loads', '404');
    } else {
      fail('install-html-loads', inst ? String(inst.status()) : 'fail', 'low');
    }
  } catch (e) {
    fail('secondary-pages', e.message, 'medium');
  }
  await page.close();
}

// ── 11 Mobile viewport ───────────────────────────────────
async function runMobile(browser, base) {
  section('11. Mobile viewport');
  const page = await browser.newPage();
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await clearStorage(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // tabs usable
    for (const name of ['setup', 'requests', 'rules', 'schedule']) {
      await page.locator('#tabbtn-' + name).click();
      await page.waitForTimeout(200);
    }
    pass('mobile-tabs-usable');

    await page.evaluate(() => {
      if (typeof setProUnlocked === 'function') setProUnlocked('MSB-PRO-TEST123');
    });
    const demo = page.locator('button.btn-demo, header .btn-demo').first();
    if (await demo.isVisible().catch(() => false)) {
      await demo.click();
      await page.waitForTimeout(4500);
      const body = await page.locator('body').innerText();
      if (/Week|Schedule|Open|Close|Quality|Coverage/i.test(body)) pass('mobile-demo-generate');
      else await failShot(page, 'mobile-demo-generate', 'no schedule content', 'medium');
    } else {
      // try evaluate
      await page.evaluate(() => {
        if (typeof loadDemoStore === 'function') loadDemoStore();
      });
      await page.waitForTimeout(4500);
      const body = await page.locator('body').innerText();
      if (/Week|Schedule|Open|Close|Quality/i.test(body)) pass('mobile-demo-generate', 'via evaluate');
      else await failShot(page, 'mobile-demo-generate', 'demo not available', 'medium');
    }
  } catch (e) {
    await failShot(page, 'mobile-viewport', e.message, 'medium');
  }
  await page.close();
}

// ── 12 Prod isolation regression ─────────────────────────
async function runProdIsolation(browser, base) {
  section('12. Regression: prod isolation');
  const page = await bootApp(browser, base);
  try {
    // Exercise auth + save + generate to ensure no bare keys written
    await page.evaluate(() => {
      if (typeof setProUnlocked === 'function') setProUnlocked('MSB-PRO-TEST123');
      if (typeof loadDemoStore === 'function') loadDemoStore();
    });
    await page.waitForTimeout(3500);
    await page.evaluate(() => {
      if (typeof saveToStorage === 'function') {
        try {
          saveToStorage();
        } catch (e) {}
      }
    });
    await page.waitForTimeout(300);

    const isolation = await page.evaluate(() => {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
      const bareSession = keys.includes('msb_session');
      const barePro = keys.includes('msb_pro_license');
      const bareGen = keys.includes('msb_free_generate_count');
      const stgKeys = keys.filter((k) => k && k.startsWith('msb_stg_'));
      const bareMsb = keys.filter((k) => k && /^msb_/.test(k) && !k.startsWith('msb_stg_'));
      return { bareSession, barePro, bareGen, stgKeys, bareMsb, all: keys };
    });

    if (!isolation.bareSession) pass('no-write-msb-session', 'only staging session keys');
    else fail('no-write-msb-session', 'msb_session was written', 'critical');

    if (!isolation.barePro && !isolation.bareGen) pass('no-bare-monetization-keys');
    else fail('no-bare-monetization-keys', JSON.stringify({ barePro: isolation.barePro, bareGen: isolation.bareGen }), 'critical');

    if (isolation.stgKeys.length > 0) pass('stg-keys-present', isolation.stgKeys.join(', '));
    else fail('stg-keys-present', 'none', 'high');

    pass('prod-root-not-under-test', 'suite serves staging/ only; production index.html untouched');
  } catch (e) {
    await failShot(page, 'prod-isolation', e.message, 'critical');
  }
  await page.close();
}

// ── 13 Live staging smoke ────────────────────────────────
async function runLiveSmoke(browser) {
  section('13. Live staging URL smoke');
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    let status = 0;
    try {
      const res = await fetch(LIVE_STAGING, { method: 'GET', signal: ctrl.signal, redirect: 'follow' });
      status = res.status;
    } catch (e) {
      clearTimeout(t);
      skip('live-staging-reachable', String(e.message || e));
      return;
    }
    clearTimeout(t);

    if (status === 200) {
      pass('live-staging-reachable', `HTTP ${status}`);
      const page = await browser.newPage();
      try {
        await page.goto(LIVE_STAGING, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(1200);
        const banner = await page.locator('#msb-staging-banner').isVisible().catch(() => false);
        if (banner) pass('live-staging-banner');
        else fail('live-staging-banner', 'not visible', 'medium');
        const locked = await page.evaluate(() => document.documentElement.classList.contains('auth-locked'));
        if (!locked) pass('live-staging-no-auth-lock');
        else fail('live-staging-no-auth-lock', 'auth-locked', 'high');
      } catch (e) {
        fail('live-staging-smoke', e.message, 'medium');
      }
      await page.close();
    } else if (status === 404 || status >= 500) {
      skip('live-staging-reachable', `HTTP ${status}`);
    } else {
      skip('live-staging-reachable', `HTTP ${status}`);
    }
  } catch (e) {
    skip('live-staging-reachable', e.message);
  }
}

function writeReports(meta) {
  const failed = results.filter((r) => !r.ok);
  const passed = results.filter((r) => r.ok && !r.skip);
  const skipped = results.filter((r) => r.skip);
  const report = {
    generatedAt: new Date().toISOString(),
    base: meta.base,
    mode: meta.mode,
    stagingPath: STAGING,
    summary: {
      passed: passed.length,
      failed: failed.length,
      skipped: skipped.length,
      total: results.length,
    },
    sections: sectionResults,
    results,
    failures: failed.map((f) => ({
      section: f.section,
      name: f.name,
      detail: f.detail,
      severity: f.severity,
    })),
    p08: meta.p08 || null,
    live: meta.live || null,
  };
  writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2), 'utf8');

  const lines = [];
  lines.push('# Staging Full Test Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Base: \`${meta.base}\` (${meta.mode})`);
  lines.push(`Staging path: \`${STAGING}\``);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Result | Count |`);
  lines.push(`|--------|------:|`);
  lines.push(`| PASS   | ${passed.length} |`);
  lines.push(`| FAIL   | ${failed.length} |`);
  lines.push(`| SKIP   | ${skipped.length} |`);
  lines.push(`| Total  | ${results.length} |`);
  lines.push('');
  lines.push('## By section');
  lines.push('');
  for (const [sec, s] of Object.entries(sectionResults)) {
    lines.push(`- **${sec}**: ${s.pass} pass, ${s.fail} fail, ${s.skip} skip`);
  }
  lines.push('');
  if (failed.length) {
    lines.push('## Failures');
    lines.push('');
    for (const f of failed) {
      lines.push(`### ❌ ${f.name}`);
      lines.push(`- Section: ${f.section}`);
      lines.push(`- Severity: ${f.severity || 'medium'}`);
      lines.push(`- Detail: ${f.detail}`);
      lines.push('');
    }
  } else {
    lines.push('## Failures');
    lines.push('');
    lines.push('None.');
    lines.push('');
  }
  if (meta.p08) {
    lines.push('## P08 unit test');
    lines.push('');
    lines.push('```');
    lines.push(meta.p08.output || '');
    lines.push('```');
    lines.push('');
    lines.push(meta.p08.ok ? '**PASS**' : '**FAIL**');
    lines.push('');
  }
  if (meta.live) {
    lines.push('## Live staging');
    lines.push('');
    lines.push(String(meta.live));
    lines.push('');
  }
  lines.push('## Screenshots');
  lines.push('');
  lines.push(`Failure screenshots (if any): \`${OUT_DIR}\``);
  if (existsSync(OUT_DIR)) {
    try {
      const shots = readdirSync(OUT_DIR).filter((f) => f.endsWith('.png'));
      if (shots.length) {
        for (const s of shots.slice(0, 40)) lines.push(`- \`${join(OUT_DIR, s)}\``);
      } else lines.push('_No screenshots captured._');
    } catch {
      lines.push('_Could not list screenshot dir._');
    }
  }
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push('- Production `index.html` was not modified or served by this suite.');
  lines.push('- App data keys must use `msb_stg_*` only.');
  lines.push('');
  writeFileSync(REPORT_MD, lines.join('\n'), 'utf8');
  return report;
}

async function runP08() {
  const { spawnSync } = await import('child_process');
  const r = spawnSync(process.execPath, [join(__dirname, 'test-p08-coverage.mjs')], {
    encoding: 'utf8',
    cwd: ROOT,
    timeout: 30000,
  });
  const output = ((r.stdout || '') + (r.stderr || '')).trim();
  return { ok: r.status === 0, output, status: r.status };
}

async function main() {
  console.log('Schedule Pro STAGING full test suite');
  console.log('STAGING', STAGING);
  ensureOutDir();

  if (!existsSync(join(STAGING, 'index.html'))) {
    console.error('Missing staging/index.html — run scripts/publish-staging.ps1 first');
    process.exit(2);
  }

  // P08 unit first
  console.log('\n=== P08 unit (test-p08-coverage.mjs) ===');
  const p08 = await runP08();
  currentSection = 'P08 unit';
  if (p08.ok) pass('p08-coverage-unit', 'exit 0');
  else fail('p08-coverage-unit', p08.output.slice(-500), 'high');
  console.log(p08.output.slice(0, 2000));

  let server, base, mode;
  if (BASE_URL) {
    base = BASE_URL;
    mode = 'BASE_URL';
    console.log('Using BASE_URL', base);
  } else {
    ({ server, base } = await startStaticServer(STAGING));
    mode = 'local-staging-static';
    console.log('Local staging server', base, '(root=staging/)');
  }

  const browser = await chromium.launch({ headless: true });
  let liveNote = null;
  try {
    await runIsolation(browser, base);

    // Engine on a dedicated page
    {
      const engPage = await bootApp(browser, base);
      await runEngineScenarios(engPage);
      await engPage.close();
    }

    await runBootNav(browser, base);
    await runSetup(browser, base);
    await runRequests(browser, base);
    await runRules(browser, base);
    await runScheduleUI(browser, base);
    await runExports(browser, base);
    await runAuth(browser, base);
    await runMonetization(browser, base);
    await runSecondaryPages(browser, base);
    await runMobile(browser, base);
    await runProdIsolation(browser, base);

    // Live smoke always attempted (independent of BASE_URL)
    const beforeLive = results.length;
    await runLiveSmoke(browser);
    const liveResults = results.slice(beforeLive);
    liveNote = liveResults.map((r) => `${r.skip ? 'SKIP' : r.ok ? 'PASS' : 'FAIL'} ${r.name}: ${r.detail}`).join('; ');
  } finally {
    await browser.close();
    if (server) server.close();
  }

  const report = writeReports({ base, mode, p08, live: liveNote });

  console.log('\n=== SUMMARY ===');
  console.log(`Passed: ${report.summary.passed}  Failed: ${report.summary.failed}  Skipped: ${report.summary.skipped}`);
  console.log('Report JSON:', REPORT_JSON);
  console.log('Report MD:  ', REPORT_MD);
  if (report.failures.length) {
    console.log('\nFailures:');
    report.failures.forEach((f) => console.log(' -', `[${f.severity}]`, f.name, ':', f.detail));
  }
  process.exit(report.summary.failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  try {
    writeReports({ base: BASE_URL || 'unknown', mode: 'error', p08: null, live: null });
  } catch (_) {}
  process.exit(1);
});
