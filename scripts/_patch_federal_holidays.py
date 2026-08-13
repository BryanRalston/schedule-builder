# -*- coding: utf-8 -*-
from pathlib import Path
import re

path = Path(__file__).resolve().parents[1] / "index.html"
text = path.read_text(encoding="utf-8")

css = """
/* Federal paid holidays */
.federal-holidays-block {
  margin-top: 0.75rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: rgba(255, 200, 87, 0.06);
}
.fh-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.35rem 0.65rem; margin-bottom: 0.45rem; }
.fh-title { font-weight: 700; font-size: 0.82rem; color: var(--ink); }
.fh-sub { font-size: 0.7rem; color: var(--ink-4); }
.fh-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.25rem 0.65rem;
  max-height: 11rem;
  overflow-y: auto;
}
@media (max-width: 520px) { .fh-list { grid-template-columns: 1fr; } }
.fh-item {
  display: flex; align-items: flex-start; gap: 0.4rem;
  font-size: 0.75rem; color: var(--ink-2); cursor: pointer; padding: 0.2rem 0;
}
.fh-item input { margin-top: 0.15rem; accent-color: #ffc857; }
.fh-item .fh-date { display: block; font-size: 0.65rem; color: var(--ink-4); font-family: var(--mono); }
.fh-item.in-period { color: #ffd78a; }
.fh-note { font-size: 0.68rem; color: var(--ink-4); margin-top: 0.45rem; line-height: 1.35; }
.cal-cell.federal-holiday {
  box-shadow: inset 0 0 0 1px rgba(255, 200, 87, 0.55);
  background: rgba(255, 200, 87, 0.1) !important;
}
.cal-cell .fh-badge {
  display: inline-block; margin-top: 0.15rem; font-size: 0.58rem; font-weight: 700;
  color: #ffd78a; background: rgba(255, 200, 87, 0.18);
  border: 1px solid rgba(255, 200, 87, 0.35); border-radius: 4px;
  padding: 0.05rem 0.28rem;
}
.week-table thead th.federal-holiday-col {
  background: rgba(255, 200, 87, 0.12) !important; color: #ffd78a;
}
.week-table thead th .fh-day-label {
  display: block; font-size: 0.58rem; font-weight: 600; color: #ffd78a;
  margin-top: 0.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 5.5rem;
}
.input-week-label.is-federal-holiday-week {
  background: linear-gradient(90deg, rgba(255,200,87,0.14), transparent);
}
"""

if "federal-holidays-block" not in text.split("<style")[1].split("</style>")[0] if "<style" in text else "":
    pass

if ".federal-holidays-block" not in text:
    anchor = ".input-week-label.is-holiday-week"
    i = text.find(anchor)
    if i < 0:
        raise SystemExit("css anchor missing")
    j = text.find("}", i)
    text = text[: j + 1] + "\n" + css + text[j + 1 :]
    print("CSS inserted")
else:
    print("CSS exists")

html_block = """
            <div class="federal-holidays-block no-print" id="federal-holidays-block">
              <div class="fh-head">
                <span class="fh-title">Federal paid holidays</span>
                <span class="fh-sub">4-day work week · saved on this device</span>
              </div>
              <div class="fh-list" id="federal-holidays-list"></div>
              <div class="fh-note" id="federal-holidays-note">Check holidays your store observes as paid. Matching weeks auto-mark as holiday (4-day) and show on the calendar.</div>
            </div>
"""

if 'id="federal-holidays-block"' not in text:
    needle = '<div class="period-info" id="period-info"></div>'
    if needle not in text:
        raise SystemExit("period-info missing")
    text = text.replace(needle, needle + "\n" + html_block, 1)
    print("HTML inserted")
else:
    print("HTML exists")

js = r"""
// Federal paid holidays (observed dates; 4-day week when in period)
const MSB_FED_HOLIDAYS_KEY = 'msb_federal_holidays';
const FEDERAL_HOLIDAY_DEFS = [
  { id: 'new-year', name: "New Year's Day", kind: 'fixed', month: 1, day: 1 },
  { id: 'mlk', name: 'Martin Luther King Jr. Day', kind: 'nth-monday', month: 1, nth: 3 },
  { id: 'presidents', name: "Presidents' Day", kind: 'nth-monday', month: 2, nth: 3 },
  { id: 'memorial', name: 'Memorial Day', kind: 'last-monday', month: 5 },
  { id: 'juneteenth', name: 'Juneteenth', kind: 'fixed', month: 6, day: 19 },
  { id: 'independence', name: 'Independence Day', kind: 'fixed', month: 7, day: 4 },
  { id: 'labor', name: 'Labor Day', kind: 'nth-monday', month: 9, nth: 1 },
  { id: 'columbus', name: 'Columbus / Indigenous Peoples Day', kind: 'nth-monday', month: 10, nth: 2 },
  { id: 'veterans', name: 'Veterans Day', kind: 'fixed', month: 11, day: 11 },
  { id: 'thanksgiving', name: 'Thanksgiving Day', kind: 'nth-thursday', month: 11, nth: 4 },
  { id: 'christmas', name: 'Christmas Day', kind: 'fixed', month: 12, day: 25 }
];
let selectedFederalHolidayIds = [];
let federalHolidayByDate = {};

function observeFederalDate(y, month1to12, day) {
  const d = new Date(y, month1to12 - 1, day, 12, 0, 0);
  const dow = d.getDay();
  if (dow === 6) d.setDate(d.getDate() - 1);
  else if (dow === 0) d.setDate(d.getDate() + 1);
  return d;
}
function nthWeekdayOfMonth(y, month1to12, weekday, nth) {
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const d = new Date(y, month1to12 - 1, day, 12, 0, 0);
    if (d.getMonth() !== month1to12 - 1) break;
    if (d.getDay() === weekday) {
      count++;
      if (count === nth) return d;
    }
  }
  return null;
}
function lastWeekdayOfMonth(y, month1to12, weekday) {
  const last = new Date(y, month1to12, 0, 12, 0, 0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(last.getFullYear(), last.getMonth(), last.getDate() - i, 12, 0, 0);
    if (d.getDay() === weekday) return d;
  }
  return last;
}
function federalHolidayDateForYear(def, year) {
  if (!def) return null;
  if (def.kind === 'fixed') return observeFederalDate(year, def.month, def.day);
  if (def.kind === 'nth-monday') return nthWeekdayOfMonth(year, def.month, 1, def.nth);
  if (def.kind === 'nth-thursday') return nthWeekdayOfMonth(year, def.month, 4, def.nth);
  if (def.kind === 'last-monday') return lastWeekdayOfMonth(year, def.month, 1);
  return null;
}
function loadSelectedFederalHolidays() {
  try {
    const raw = localStorage.getItem(MSB_FED_HOLIDAYS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    selectedFederalHolidayIds = Array.isArray(arr)
      ? arr.filter((id) => FEDERAL_HOLIDAY_DEFS.some((d) => d.id === id))
      : [];
  } catch (e) {
    selectedFederalHolidayIds = [];
  }
}
function persistSelectedFederalHolidays() {
  try { localStorage.setItem(MSB_FED_HOLIDAYS_KEY, JSON.stringify(selectedFederalHolidayIds)); } catch (e) {}
}
function isFederalHolidaySelected(id) {
  return selectedFederalHolidayIds.indexOf(id) >= 0;
}
function getFederalHolidayForDate(dateOrDk) {
  let dk = null;
  if (typeof dateOrDk === 'string') dk = dateOrDk;
  else if (dateOrDk instanceof Date) dk = dateKey(dateOrDk);
  return (dk && federalHolidayByDate[dk]) || null;
}
function syncFederalHolidaysToPeriod() {
  federalHolidayByDate = {};
  if (!currentPeriod || !periodDates || !periodDates.length) {
    renderFederalHolidaysUI();
    return;
  }
  const years = new Set();
  periodDates.forEach((d) => years.add(d.getFullYear()));
  years.add(Math.min(...years) - 1);
  years.add(Math.max(...years) + 1);
  const periodStart = periodDates[0];
  const periodEnd = periodDates[periodDates.length - 1];
  selectedFederalHolidayIds.forEach((id) => {
    const def = FEDERAL_HOLIDAY_DEFS.find((d) => d.id === id);
    if (!def) return;
    years.forEach((y) => {
      const d = federalHolidayDateForYear(def, y);
      if (!d || isNaN(d.getTime())) return;
      if (d >= periodStart && d <= periodEnd) {
        federalHolidayByDate[dateKey(d)] = { id: def.id, name: def.name };
      }
    });
  });
  if (currentPeriod.weeks) {
    currentPeriod.weeks.forEach((week, wIdx) => {
      for (let i = 0; i < 7; i++) {
        const d = new Date(week.start);
        d.setDate(d.getDate() + i);
        if (federalHolidayByDate[dateKey(d)]) {
          holidayWeeks[wIdx] = true;
          break;
        }
      }
    });
  }
  renderFederalHolidaysUI();
}
function toggleFederalHoliday(id, checked) {
  const on = !!checked;
  const i = selectedFederalHolidayIds.indexOf(id);
  if (on && i < 0) selectedFederalHolidayIds.push(id);
  if (!on && i >= 0) selectedFederalHolidayIds.splice(i, 1);
  persistSelectedFederalHolidays();
  syncFederalHolidaysToPeriod();
  if (typeof buildInputCalendar === 'function' && typeof activeTab !== 'undefined') {
    try { buildInputCalendar(activeTab); } catch (e) {}
  }
  if (typeof lastScheduleRenderArgs !== 'undefined' && lastScheduleRenderArgs && schedule && Object.keys(schedule).length) {
    try {
      renderSchedule(lastScheduleRenderArgs.warnings, lastScheduleRenderArgs.ROLES, lastScheduleRenderArgs.ALL_KC);
    } catch (e) {}
  }
  if (typeof showToast === 'function') {
    showToast(on ? 'Paid holiday on — 4-day week when it lands in this period.' : 'Federal holiday off.', 'info');
  }
}
function renderFederalHolidaysUI() {
  const host = document.getElementById('federal-holidays-list');
  if (!host) return;
  let refYear = typeof fiscalYear !== 'undefined' ? fiscalYear : new Date().getFullYear();
  if (periodDates && periodDates.length) {
    refYear = periodDates[Math.floor(periodDates.length / 2)].getFullYear();
  }
  let html = '';
  FEDERAL_HOLIDAY_DEFS.forEach((def) => {
    const d = federalHolidayDateForYear(def, refYear);
    const dk = d ? dateKey(d) : '';
    const inPeriod = !!(dk && federalHolidayByDate[dk]);
    const checked = isFederalHolidaySelected(def.id);
    const dateLabel = d
      ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : '';
    html +=
      '<label class="fh-item' +
      (inPeriod ? ' in-period' : '') +
      '"><input type="checkbox" ' +
      (checked ? 'checked ' : '') +
      'onchange="toggleFederalHoliday(\'' +
      def.id +
      '\', this.checked)"><span><strong>' +
      esc(def.name) +
      '</strong><span class="fh-date">' +
      esc(dateLabel) +
      (inPeriod ? ' · in this period' : '') +
      '</span></span></label>';
  });
  host.innerHTML = html;
  const note = document.getElementById('federal-holidays-note');
  if (note) {
    const n = Object.keys(federalHolidayByDate).length;
    const sel = selectedFederalHolidayIds.length;
    note.textContent =
      sel === 0
        ? 'Check holidays your store observes as paid. Matching weeks become 4-day and days highlight on the calendar.'
        : sel + ' selected · ' + n + ' in loaded period' + (n ? ' (auto 4-day weeks)' : ' (load a period to match dates)');
  }
}

"""

if "const FEDERAL_HOLIDAY_DEFS" not in text:
    needle = "let holidayWeeks = {};"
    i = text.find(needle)
    if i < 0:
        raise SystemExit("holidayWeeks not found")
    eol = text.find("\n", i)
    text = text[: eol + 1] + js + text[eol + 1 :]
    print("JS inserted")
else:
    print("JS exists")

old_load = """  getAllPersonIds().forEach(r => { if (!inputs[r]) inputs[r] = {}; });

  buildInputTabs();
  buildInputCalendar(activeTab);
  updatePeriodInfo();
"""
new_load = """  getAllPersonIds().forEach(r => { if (!inputs[r]) inputs[r] = {}; });

  try { if (typeof syncFederalHolidaysToPeriod === 'function') syncFederalHolidaysToPeriod(); } catch (e) {}

  buildInputTabs();
  buildInputCalendar(activeTab);
  updatePeriodInfo();
"""
if "syncFederalHolidaysToPeriod()" not in text[text.find("function loadPeriod") : text.find("function loadPeriod") + 900]:
    if old_load in text:
        text = text.replace(old_load, new_load, 1)
        print("loadPeriod hooked")
    else:
        print("loadPeriod pattern missing")
else:
    print("loadPeriod already hooked")

# buildInputCalendar visuals
cal_start = text.find("function buildInputCalendar")
cal_end = text.find("function openCellMenu", cal_start)
cal = text[cal_start:cal_end]
if "federal-holiday" not in cal:
    cal2 = cal
    # week label
    cal2 = re.sub(
        r"const isHoliday = !!holidayWeeks\[wIdx\];\s*html \+= `<div class=\"input-week-label\$\{isHoliday \? ' is-holiday-week' : ''\}\">`;",
        """const isHoliday = !!holidayWeeks[wIdx];
    let fedName = '';
    for (let fi = 0; fi < 7; fi++) {
      const fd = new Date(week.start);
      fd.setDate(fd.getDate() + fi);
      const fh0 = typeof getFederalHolidayForDate === 'function' ? getFederalHolidayForDate(fd) : null;
      if (fh0) { fedName = fh0.name; break; }
    }
    const fedWeek = !!fedName;
    html += `<div class="input-week-label${isHoliday ? ' is-holiday-week' : ''}${fedWeek ? ' is-federal-holiday-week' : ''}">`;""",
        cal2,
        count=1,
    )
    # holiday span - add fed name
    cal2 = re.sub(
        r"\$\{isHoliday \? '[^']*Holiday \(4-day\)' : ''\}</span>",
        "${isHoliday ? ' · Holiday (4-day)' : ''}${fedName ? ' · ' + esc(fedName) : ''}</span>",
        cal2,
        count=1,
    )
    old_cell = """      let cls = 'cal-cell';
      if (isWeekend) cls += ' weekend';
      if (isMonday) cls += ' monday';

      const val = inputs[role] && inputs[role][dk];
      let tagHtml = '';
      if (val) {
        const tagCls = getTagCssClass(val);
        tagHtml = `<span class="cell-tag ${tagCls}">${getShiftDisplayLabel(val)}</span>`;
      }

      html += `<div class="${cls}" data-dk="${dk}" data-role="${role}" onclick="openCellMenu(event, '${role}', '${dk}')">`;
"""
    new_cell = """      const fh = typeof getFederalHolidayForDate === 'function' ? getFederalHolidayForDate(dk) : null;
      let cls = 'cal-cell';
      if (isWeekend) cls += ' weekend';
      if (isMonday) cls += ' monday';
      if (fh) cls += ' federal-holiday';

      const val = inputs[role] && inputs[role][dk];
      let tagHtml = '';
      if (val) {
        const tagCls = getTagCssClass(val);
        tagHtml = `<span class="cell-tag ${tagCls}">${getShiftDisplayLabel(val)}</span>`;
      }
      if (fh) {
        tagHtml += `<span class="fh-badge" title="${esc(fh.name)}">Paid holiday</span>`;
      }

      html += `<div class="${cls}" data-dk="${dk}" data-role="${role}" onclick="openCellMenu(event, '${role}', '${dk}')">`;
"""
    if old_cell in cal2:
        cal2 = cal2.replace(old_cell, new_cell, 1)
        print("cells patched")
    else:
        print("cells missing")
    text = text[:cal_start] + cal2 + text[cal_end:]
    print("calendar section updated")
else:
    print("calendar already federal")

# week table headers
fi = text.find("function renderWeekTableHtml")
if fi > 0 and "federal-holiday-col" not in text[fi : fi + 2000]:
    pos = text.find("${DAY_NAMES[dow]}</th>", fi)
    if pos > 0:
        start = text.rfind("weekDates.forEach", fi, pos)
        end = text.find("});", pos) + 3
        new_th = """weekDates.forEach(wd => {
    const dow = wd.getDay();
    const dkH = dateKey(wd);
    const fhH = typeof getFederalHolidayForDate === 'function' ? getFederalHolidayForDate(dkH) : null;
    let cls = '';
    if (dow === 0 || dow === 6) cls = 'weekend-col';
    else if (dow === 1) cls = 'monday-col';
    if (fhH) cls = (cls ? cls + ' ' : '') + 'federal-holiday-col';
    const fedLab = fhH ? `<span class="fh-day-label">${esc(fhH.name)}</span>` : '';
    html += `<th class="${cls}">${DAY_NAMES[dow]}${fedLab}</th>`;
  });"""
        text = text[:start] + new_th + text[end:]
        print("week headers patched")
    else:
        print("day name th not found")
else:
    print("week headers skip")

old_boot = """function bootUi() {
  handleLaunchQuery();
  ensureAuthOnBoot();
  updateAccountChip();
  personalizeWelcome();
}"""
new_boot = """function bootUi() {
  handleLaunchQuery();
  ensureAuthOnBoot();
  updateAccountChip();
  personalizeWelcome();
  try {
    if (typeof loadSelectedFederalHolidays === 'function') loadSelectedFederalHolidays();
    if (typeof renderFederalHolidaysUI === 'function') renderFederalHolidaysUI();
    if (typeof syncFederalHolidaysToPeriod === 'function') syncFederalHolidaysToPeriod();
  } catch (e) {}
}"""
if old_boot in text:
    text = text.replace(old_boot, new_boot, 1)
    print("bootUi patched")
else:
    print("bootUi pattern missing")

text = text.replace("const APP_VERSION = '2.5.8';", "const APP_VERSION = '2.5.9';")
text = text.replace('id="app-version-label">v2.5.8</span>', 'id="app-version-label">v2.5.9</span>')

path.write_text(text, encoding="utf-8")
print("Wrote", path, "len", len(text))
print("FEDERAL", "FEDERAL_HOLIDAY_DEFS" in text)
print("UI", 'federal-holidays-block' in text)
print("getFederal", "function getFederalHolidayForDate" in text)
