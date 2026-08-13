import { chromium } from '../scripts/browser-ops/node_modules/playwright/index.mjs';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';

const ROOT = 'C:/Users/bryma/schedule-builder';
const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};
const server = createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = join(ROOT, p.slice(1));
  if (!existsSync(f)) {
    res.writeHead(404);
    res.end('x');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'text/plain' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:' + port + '/index.html');
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
await page.click('button:has-text("Continue offline")');
await page.waitForTimeout(800);
const detail = await page.evaluate(() => {
  function buildDays(y, m, d, n) {
    const a = [];
    for (let i = 0; i < n; i++) a.push(new Date(y, m - 1, d + i));
    return a;
  }
  amCount = 3;
  kcList = [{ id: 'kc1', name: 'KC1', asManager: false }];
  periodDates = buildDays(2026, 8, 30, 35);
  currentPeriod = {
    number: 8,
    approxMonth: 'Sep',
    start: periodDates[0],
    end: periodDates[34],
    numWeeks: 5,
    weeks: [],
  };
  for (let w = 0; w < 5; w++) {
    currentPeriod.weeks.push({ start: periodDates[w * 7], end: periodDates[w * 7 + 6] });
  }
  fiscalYear = 2026;
  holidayWeeks = {};
  inputs = { sm: {}, am1: {}, am2: {}, am3: {}, kc1: {} };
  preferences = Object.assign({}, DEFAULT_PREFERENCES, {
    avoidClopening: true,
    fairDistribution: true,
    targetWeekendDaysOff: 2,
    kcCloseDays: [1],
  });
  schedule = {};
  _generateScheduleInner();
  const ROLES = getRoles();
  const allDks = periodDates.map(dateKey);
  const issues = [];
  allDks.forEach((dk) => {
    let opens = 0,
      closes = 0,
      workers = 0;
    const cells = [];
    ROLES.forEach((r) => {
      const s = schedule[r] && schedule[r][dk];
      cells.push(r + ':' + (s || '-'));
      if (isOpen(s)) opens++;
      if (isClose(s)) closes++;
      if (isWork(s)) workers++;
    });
    getNonManagerKCs().forEach((kc) => {
      const s = schedule[kc.id] && schedule[kc.id][dk];
      if (s) cells.push(kc.id + ':' + s);
      if (s === 'kc-close') closes++;
      if (isWork(s)) workers++;
    });
    if (opens === 0 || closes === 0) {
      issues.push({
        dk,
        opens,
        closes,
        workers,
        dow: new Date(dk + 'T12:00:00').getDay(),
        cells: cells.join(', '),
      });
    }
  });
  return { issues, roles: ROLES, kcClose: preferences.kcCloseDays };
});
console.log(JSON.stringify(detail, null, 2));
await browser.close();
server.close();
