/**
 * Period 8 FY2026 regression test — coverage-first weekend placement.
 * Mirrors the fixed guards in generateSchedule (soft offs never thin a day below 2 workers
 * when 3+ managers could work; never assign mid when opens===0).
 */
const ROLES = ['sm', 'am1', 'am2', 'am3']; // Bryan, Brian, Thuy, Norma
const NAMES = { sm: 'Bryan', am1: 'Brian', am2: 'Thuy', am3: 'Norma' };

// Build all days for period: Sun 8/30 through Sat 10/3 (5 weeks)
function dateKey(y, m, d) {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function addDays(y, m, d, n) {
  const dt = new Date(y, m - 1, d + n);
  return [dt.getFullYear(), dt.getMonth() + 1, dt.getDate()];
}
const allDks = [];
for (let i = 0; i < 35; i++) {
  const [y, m, d] = addDays(2026, 8, 30, i);
  allDks.push(dateKey(y, m, d));
}
const isWeekend = (dk) => {
  const [y, m, d] = dk.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6;
};
const isDayOff = (s) => s === 'off' || s === 'rto' || s === 'pto' || s === 'loa';
const isOpen = (s) => s && String(s).startsWith('open');
const isClose = (s) => s === 'close' || s === 'close-ext' || s === 'kc-close';
const isWork = (s) => s && !isDayOff(s);

// Inputs matching exported schedule
const inputs = {
  sm: {}, am1: {}, am2: {}, am3: {}
};
// Bryan LOA from 9/13 through 10/3
for (const dk of allDks) {
  if (dk >= '2026-09-13') inputs.sm[dk] = 'loa';
}
// Norma RTO weekends: 9/5-6, 9/12-13
for (const dk of ['2026-09-05','2026-09-06','2026-09-12','2026-09-13']) {
  inputs.am3[dk] = 'rto';
}
// Norma VAC Mon-Fri week of 9/7
for (const dk of ['2026-09-07','2026-09-08','2026-09-09','2026-09-10','2026-09-11']) {
  inputs.am3[dk] = 'pto'; // VAC as PTO lock
}

// Init schedule from inputs
const schedule = {};
ROLES.forEach(r => {
  schedule[r] = {};
  Object.assign(schedule[r], inputs[r] || {});
});

const managersWorkingOrUnset = (dk) => ROLES.filter(r => !isDayOff(schedule[r][dk])).length;
const managersNotInputLockedOff = (dk) => ROLES.filter(r => {
  if (inputs[r] && inputs[r][dk] && isDayOff(inputs[r][dk])) return false;
  return true;
}).length;
const minWorkersAfterSoftOff = (dk) => {
  const pool = managersNotInputLockedOff(dk);
  if (pool >= 3) return 2;
  if (pool === 2) return 2;
  return Math.max(1, pool);
};
const softOffBreaksCoverage = (r, dk) => {
  if (isDayOff(schedule[r][dk])) return false;
  return managersWorkingOrUnset(dk) - 1 < minWorkersAfterSoftOff(dk);
};
const canPlaceWeekendDay = (r, dk) => {
  if (inputs[r] && inputs[r][dk] && isWork(inputs[r][dk])) return false;
  const s = schedule[r][dk];
  if (s && s !== 'off' && s !== 'rto') return false;
  if (softOffBreaksCoverage(r, dk)) return false;
  return true;
};

const getEffectiveWeekendTarget = (r) => {
  let t = 2;
  const availWeDays = allDks.filter(dk =>
    isWeekend(dk) && schedule[r][dk] !== 'loa' && schedule[r][dk] !== 'pto'
  ).length;
  t = Math.min(t, availWeDays);
  const weDays = allDks.filter(isWeekend);
  const avgAvail = weDays.reduce((s, dk) => s + managersNotInputLockedOff(dk), 0) / weDays.length;
  if (avgAvail <= 2.2) t = Math.min(t, 1);
  if (avgAvail <= 1.5) t = 0;
  const hardWeOff = allDks.filter(dk =>
    isWeekend(dk) && (schedule[r][dk] === 'rto' || schedule[r][dk] === 'pto' || schedule[r][dk] === 'loa')
  ).length;
  if (hardWeOff >= 2) t = Math.min(t, hardWeOff);
  return Math.max(0, t);
};

// Weekend pairs Sat+Sun
const pairs = [];
for (let i = 0; i < allDks.length - 1; i++) {
  const [y,m,d] = allDks[i].split('-').map(Number);
  if (new Date(y,m-1,d).getDay() === 6) pairs.push({ sat: allDks[i], sun: allDks[i+1] });
}

const countWeOff = (r) => allDks.filter(dk => isWeekend(dk) && isDayOff(schedule[r][dk])).length;
const wpOffCount = (wp) => ROLES.filter(r => isDayOff(schedule[r][wp.sat]) && isDayOff(schedule[r][wp.sun])).length;

// Pass A
ROLES.forEach(r => {
  const target = getEffectiveWeekendTarget(r);
  if (target <= 0) return;
  const maxFull = Math.max(target >= 2 ? 1 : 0, Math.floor(target / 2));
  let fullPlaced = 0;
  pairs.forEach(wp => {
    if (isDayOff(schedule[r][wp.sat]) && isDayOff(schedule[r][wp.sun])) fullPlaced++;
  });
  const sorted = [...pairs].sort((a,b) => wpOffCount(a) - wpOffCount(b));
  for (const wp of sorted) {
    if (fullPlaced >= maxFull) break;
    if (countWeOff(r) >= target) break;
    const s1 = schedule[r][wp.sat], s2 = schedule[r][wp.sun];
    if (isDayOff(s1) && isDayOff(s2)) continue;
    if (!canPlaceWeekendDay(r, wp.sat) && !isDayOff(s1)) continue;
    if (!canPlaceWeekendDay(r, wp.sun) && !isDayOff(s2)) continue;
    const free = Math.min(managersNotInputLockedOff(wp.sat), managersNotInputLockedOff(wp.sun));
    const localMax = free <= 3 ? 1 : 2;
    if (wpOffCount(wp) >= localMax) continue;
    if (!isDayOff(s1) && canPlaceWeekendDay(r, wp.sat)) schedule[r][wp.sat] = 'off';
    if (!isDayOff(s2) && canPlaceWeekendDay(r, wp.sun)) schedule[r][wp.sun] = 'off';
    if (isDayOff(schedule[r][wp.sat]) && isDayOff(schedule[r][wp.sun])) fullPlaced++;
  }
});

// Pass B
ROLES.forEach(r => {
  const target = getEffectiveWeekendTarget(r);
  let need = target - countWeOff(r);
  if (need <= 0) return;
  const days = allDks.filter(isWeekend).filter(dk => canPlaceWeekendDay(r, dk) && !isDayOff(schedule[r][dk]));
  days.sort((a, b) => managersWorkingOrUnset(a) - managersWorkingOrUnset(b)); // prefer emptier? actually prefer fuller
  days.sort((a, b) => managersWorkingOrUnset(b) - managersWorkingOrUnset(a));
  for (const dk of days) {
    if (need <= 0) break;
    if (softOffBreaksCoverage(r, dk)) continue;
    if (managersWorkingOrUnset(dk) <= minWorkersAfterSoftOff(dk)) continue;
    schedule[r][dk] = 'off';
    need--;
  }
});

// Fill remaining: assign open/close (simplified)
for (const dk of allDks) {
  const workers = ROLES.filter(r => !isDayOff(schedule[r][dk]));
  // If no one working and soft offs exist, pull one
  if (workers.length === 0) {
    const soft = ROLES.find(r => schedule[r][dk] === 'off' && !(inputs[r] && inputs[r][dk]));
    if (soft) schedule[soft][dk] = 'open-early';
  }
  let opens = ROLES.filter(r => isOpen(schedule[r][dk])).length;
  let closes = ROLES.filter(r => isClose(schedule[r][dk])).length;
  const unassigned = ROLES.filter(r => !schedule[r][dk]);
  for (const r of unassigned) {
    if (opens === 0) {
      schedule[r][dk] = 'open-early';
      opens++;
    } else if (closes === 0) {
      schedule[r][dk] = 'close';
      closes++;
    } else {
      schedule[r][dk] = 'mid-early';
    }
  }
  // Repair
  opens = ROLES.filter(r => isOpen(schedule[r][dk])).length;
  closes = ROLES.filter(r => isClose(schedule[r][dk])).length;
  if (opens === 0) {
    const mid = ROLES.find(r => schedule[r][dk] && String(schedule[r][dk]).startsWith('mid'));
    if (mid) schedule[mid][dk] = 'open-early';
    else {
      const soft = ROLES.find(r => schedule[r][dk] === 'off' && !(inputs[r] && inputs[r][dk]));
      if (soft) schedule[soft][dk] = 'open-early';
    }
  }
  if (closes === 0) {
    const mid = ROLES.find(r => schedule[r][dk] && String(schedule[r][dk]).startsWith('mid'));
    if (mid) schedule[mid][dk] = 'close';
    else {
      const soft = ROLES.find(r => schedule[r][dk] === 'off' && !(inputs[r] && inputs[r][dk]));
      if (soft) schedule[soft][dk] = 'close';
    }
  }
}

// Validate
let failures = [];
let thin = [];
for (const dk of allDks) {
  const opens = ROLES.filter(r => isOpen(schedule[r][dk])).length;
  const closes = ROLES.filter(r => isClose(schedule[r][dk])).length;
  const workers = ROLES.filter(r => isWork(schedule[r][dk])).length;
  const pool = managersNotInputLockedOff(dk);
  if (opens === 0) failures.push(`${dk}: NO OPENER`);
  if (closes === 0) failures.push(`${dk}: NO CLOSER`);
  if (pool >= 3 && workers < 2) thin.push(`${dk}: thin ${workers} workers (pool ${pool})`);
}

console.log('=== Effective weekend targets ===');
ROLES.forEach(r => console.log(NAMES[r], 'target', getEffectiveWeekendTarget(r), 'weOffs', countWeOff(r)));

console.log('\n=== Weekend staffing ===');
for (const dk of allDks.filter(isWeekend)) {
  const row = ROLES.map(r => `${NAMES[r]}=${schedule[r][dk] || 'unset'}`).join(' | ');
  const opens = ROLES.filter(r => isOpen(schedule[r][dk])).length;
  const closes = ROLES.filter(r => isClose(schedule[r][dk])).length;
  const workers = ROLES.filter(r => isWork(schedule[r][dk])).length;
  console.log(dk, `n=${workers} o=${opens} c=${closes}`, row);
}

console.log('\n=== RESULT ===');
console.log('coverage failures:', failures.length ? failures : 'NONE');
console.log('thin days:', thin.length ? thin : 'NONE');
if (failures.length || thin.length) {
  console.log('FAIL');
  process.exit(1);
}
console.log('PASS — all days have opener+closer; no thin soft-off days');
