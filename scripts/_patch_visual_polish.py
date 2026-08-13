# -*- coding: utf-8 -*-
"""v2.6.1 visual polish: header, strip, toolbar, mobile analytics, day headers."""
from pathlib import Path
import re
import json

root = Path(__file__).resolve().parents[1]
path = root / "index.html"
text = path.read_text(encoding="utf-8")

# ── 1) CSS upgrades for visual polish ──
extra_css = """
/* ========== v2.6.1 VISUAL POLISH ========== */
.brand-status {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
  max-width: min(420px, 100%);
}
.brand-status .offline-pill,
.brand-status .local-status-pill,
.brand-status .pro-badge {
  font-size: 0.62rem;
  padding: 0.14rem 0.42rem;
  max-width: 120px;
}
/* Hide redundant Free badge when account chip already shows plan */
.brand-status .pro-badge.is-free { display: none !important; }
.brand-status .pro-badge.is-pro {
  display: inline-flex !important;
}
.offline-pill .pill-text { display: inline; }
.local-status-pill .pill-text { display: inline; }
@media (max-width: 900px) {
  .offline-pill .pill-text,
  .local-status-pill .pill-text { display: none; }
  .offline-pill, .local-status-pill {
    min-width: 1.65rem; min-height: 1.65rem; justify-content: center;
    padding: 0.2rem 0.35rem; max-width: none;
  }
  .pwa-mode-badge { display: none !important; }
}

/* Post-gen strip: can't-miss review bar */
#post-gen-strip {
  display: none;
  position: sticky;
  top: 56px;
  z-index: 96;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.65rem;
  padding: 0.55rem 1rem;
  background: linear-gradient(90deg, rgba(12, 22, 42, 0.98), rgba(18, 28, 52, 0.98));
  border-bottom: 1px solid rgba(61, 220, 255, 0.35);
  box-shadow: 0 10px 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(61,220,255,0.08);
  font-size: 0.8rem;
}
#post-gen-strip.show { display: flex; }
#post-gen-strip .pgs-title {
  font-family: var(--mono);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #9ae8ff;
  margin-right: 0.15rem;
}
#post-gen-strip .pgs-chip {
  padding: 0.28rem 0.6rem;
  font-size: 0.76rem;
}
#post-gen-strip .pgs-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-left: auto;
  align-items: center;
}
#post-gen-strip .pgs-primary {
  background: linear-gradient(135deg, rgba(61,220,255,0.95), rgba(124,92,255,0.9)) !important;
  color: #050810 !important;
  border: none !important;
  font-weight: 700 !important;
  font-size: 0.78rem !important;
  padding: 0.35rem 0.75rem !important;
  border-radius: 8px !important;
  min-height: auto !important;
  box-shadow: 0 0 16px rgba(61,220,255,0.25);
}
#post-gen-strip .pgs-primary:hover { filter: brightness(1.06); }
html.view-locked #post-gen-strip { top: 2.25rem; }
@media (max-width: 640px) {
  #post-gen-strip { top: 0; font-size: 0.72rem; padding: 0.45rem 0.6rem; }
  #post-gen-strip .pgs-title { width: 100%; }
  #post-gen-strip .pgs-actions { width: 100%; margin-left: 0; }
  #post-gen-strip .pgs-primary { flex: 1; text-align: center; }
}

/* Schedule toolbar: segmented density, export menu */
.schedule-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem 0.55rem;
  margin-bottom: 0.65rem;
  padding: 0.45rem 0;
}
.schedule-toolbar .toolbar-sep {
  width: 1px;
  height: 1.35rem;
  background: var(--line);
  margin: 0 0.1rem;
}
.density-seg {
  display: inline-flex;
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
}
.density-seg button {
  border: none !important;
  background: transparent !important;
  color: var(--ink-3) !important;
  font-size: 0.72rem !important;
  font-weight: 600 !important;
  padding: 0.3rem 0.55rem !important;
  min-height: auto !important;
  border-radius: 0 !important;
  cursor: pointer;
  font-family: inherit;
}
.density-seg button.active {
  background: rgba(61, 220, 255, 0.16) !important;
  color: #9ae8ff !important;
}
.toolbar-menu {
  position: relative;
  display: inline-flex;
}
.toolbar-menu-panel {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 11rem;
  z-index: 40;
  background: rgba(10, 16, 30, 0.98);
  border: 1px solid var(--line-strong);
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.45);
  padding: 0.3rem;
  display: none;
}
.toolbar-menu-panel.open { display: block; }
.toolbar-menu-panel button {
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  color: var(--ink-2);
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.45rem 0.65rem;
  border-radius: 7px;
  cursor: pointer;
  font-family: inherit;
}
.toolbar-menu-panel button:hover {
  background: rgba(61, 220, 255, 0.12);
  color: var(--ink);
}
.gen-timestamp {
  font-size: 0.7rem;
  color: var(--ink-4);
  font-family: var(--mono);
  margin-left: auto;
}
@media (max-width: 720px) {
  .schedule-toolbar .toolbar-label { display: none; }
  .gen-timestamp { width: 100%; margin-left: 0; }
}

/* Day header stack: day · date · hours · holiday */
.week-table thead th.day-head-cell {
  vertical-align: top;
  line-height: 1.2;
  padding: 0.35rem 0.2rem !important;
}
.week-table thead th .dh-day {
  display: block;
  font-weight: 700;
  font-size: 0.78rem;
  letter-spacing: 0.02em;
}
.week-table thead th .dh-date {
  display: block;
  font-size: 0.68rem;
  color: var(--ink-3);
  font-weight: 500;
  margin-top: 0.08rem;
}
.week-table thead th .day-hours {
  display: block;
  font-size: 0.58rem;
  font-family: var(--mono);
  color: var(--ink-4);
  margin-top: 0.15rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.week-table thead th .day-hours.is-override { color: #ffd78a; }
.week-table thead th .fh-day-label {
  display: block;
  font-size: 0.55rem;
  font-weight: 700;
  color: #ffd78a;
  margin-top: 0.12rem;
  line-height: 1.15;
  white-space: normal;
  max-width: none;
  overflow: visible;
  text-overflow: unset;
}
html[data-density="compact"] .week-table thead th .dh-day { font-size: 0.68rem; }
html[data-density="compact"] .week-table thead th .day-hours,
html[data-density="compact"] .week-table thead th .fh-day-label { font-size: 0.5rem; }
html[data-density="board"] .week-table thead th .dh-day { font-size: 0.9rem; }
html[data-density="board"] .week-table thead th .day-hours { font-size: 0.68rem; font-weight: 600; }

/* Mobile review-first: collapse deep analytics */
.mobile-analytics-toggle {
  display: none;
  width: 100%;
  margin: 0.65rem 0 0.35rem;
  padding: 0.55rem 0.75rem;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: rgba(8,14,28,0.75);
  color: var(--ink-2);
  font-weight: 700;
  font-size: 0.82rem;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}
.mobile-analytics-toggle .mat-hint {
  display: block;
  font-size: 0.68rem;
  font-weight: 500;
  color: var(--ink-4);
  margin-top: 0.15rem;
}
@media (max-width: 720px) {
  .mobile-analytics-toggle { display: block; }
  #summary-section.analytics-collapsed .section-body {
    display: none !important;
  }
  #summary-section.analytics-collapsed .section-header h2::after {
    content: " (collapsed)";
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--ink-4);
  }
  /* Fairness stays visible; strip is primary review */
  #fairness-under-schedule {
    margin-top: 0.5rem;
  }
}

/* Diff + suggestions a bit more premium */
#schedule-diff-panel,
#smart-suggestions {
  border: 1px solid rgba(61, 220, 255, 0.2);
  border-radius: 12px;
  background: rgba(8, 14, 28, 0.75);
  padding: 0.65rem 0.75rem;
  margin: 0.55rem 0;
}
#smart-suggestions .sug-chip {
  border-radius: 999px;
  border: 1px solid rgba(61, 220, 255, 0.35);
  background: rgba(61, 220, 255, 0.1);
  color: #9ae8ff;
  font-weight: 600;
  font-size: 0.78rem;
  padding: 0.35rem 0.7rem;
  cursor: pointer;
  font-family: inherit;
}
#smart-suggestions .sug-chip:hover {
  background: rgba(61, 220, 255, 0.18);
}
"""

if "v2.6.1 VISUAL POLISH" not in text:
    # Insert before closing </style> of main styles - find last </style> before body scripts
    # Prefer after FLAGSHIP UX block
    marker = "/* ========== v2.6.0 FLAGSHIP UX ========== */"
    if marker in text:
        # append after flagship section end - before next major section or insert after local-status-pill styles
        insert_at = text.find("#cmd-palette {")
        if insert_at > 0:
            text = text[:insert_at] + extra_css + "\n" + text[insert_at:]
            print("CSS inserted before cmd-palette")
        else:
            text = text.replace(marker, marker + "\n" + extra_css, 1)
            print("CSS after flagship marker")
    else:
        # fallback before </style>
        si = text.rfind("</style>")
        text = text[:si] + extra_css + "\n" + text[si:]
        print("CSS before last style close")
else:
    print("CSS already present")

# ── 2) Header: wrap chips in brand-status ──
old_brand = """      <span class="pro-badge is-free" id="license-badge" title="License status" hidden>Free</span>
      <span class="offline-pill" id="offline-pill" title="Works offline"><span class="dot"></span> Offline</span>
      <span class="local-status-pill" id="local-status-pill" title="Local save status">Saved · local</span>
      <span class="pwa-mode-badge">App</span>"""
new_brand = """      <span class="brand-status" id="brand-status">
        <span class="pro-badge is-free" id="license-badge" title="License status" hidden>Pro</span>
        <span class="offline-pill" id="offline-pill" title="Works offline — data on this device"><span class="dot"></span><span class="pill-text"> Offline</span></span>
        <span class="local-status-pill" id="local-status-pill" title="Last local save"><span class="pill-text">Saved</span></span>
      </span>"""
if 'id="brand-status"' not in text:
    if old_brand in text:
        text = text.replace(old_brand, new_brand, 1)
        print("header chips wrapped")
    else:
        # looser
        if 'id="local-status-pill"' in text and 'brand-status' not in text:
            text = text.replace(
                '<span class="pro-badge is-free" id="license-badge"',
                '<span class="brand-status" id="brand-status"><span class="pro-badge is-free" id="license-badge"',
                1,
            )
            text = text.replace(
                '<span class="pwa-mode-badge">App</span>',
                '</span><!-- /brand-status -->',
                1,
            )
            print("header chips wrapped (loose)")
        else:
            print("header chips pattern missing")
else:
    print("header already polished")

# ── 3) Post-gen strip HTML ──
old_strip = """<div id="post-gen-strip" class="no-print" role="region" aria-label="Post-generate review" hidden>
  <span class="pgs-chip" id="pgs-cover">Coverage</span>
  <span class="pgs-chip" id="pgs-clopens">Clopens</span>
  <span class="pgs-chip" id="pgs-am-close">AM closes</span>
  <span class="pgs-chip" id="pgs-we">WE offs</span>
  <span class="pgs-chip" id="pgs-fair">Fairness</span>
  <div class="pgs-actions">
    <button type="button" class="btn-secondary" onclick="jumpToFairnessStrip()">Fairness</button>
    <button type="button" class="btn-secondary" onclick="jumpToIssuesPanel()">Issues</button>
    <button type="button" class="btn-secondary" onclick="jumpToSmartSuggestions()">Suggestions</button>
    <button type="button" class="btn-secondary no-lock-hide" onclick="startNextPeriodSameTeam()">Next period</button>
  </div>
</div>"""
new_strip = """<div id="post-gen-strip" class="no-print" role="region" aria-label="Post-generate review" hidden>
  <span class="pgs-title">Review</span>
  <span class="pgs-chip" id="pgs-cover">Coverage</span>
  <span class="pgs-chip" id="pgs-clopens">Clopens</span>
  <span class="pgs-chip" id="pgs-am-close">AM closes</span>
  <span class="pgs-chip" id="pgs-we">WE offs</span>
  <span class="pgs-chip" id="pgs-fair">Fairness</span>
  <div class="pgs-actions">
    <button type="button" class="pgs-primary" id="pgs-primary-cta" onclick="jumpToIssuesPanel()">Review issues</button>
    <button type="button" class="btn-secondary" onclick="jumpToFairnessStrip()">Fairness</button>
    <button type="button" class="btn-secondary" onclick="jumpToSmartSuggestions()">Suggestions</button>
    <button type="button" class="btn-secondary no-lock-hide" onclick="startNextPeriodSameTeam()">Next period</button>
  </div>
</div>"""
if "pgs-title" not in text:
    if old_strip in text:
        text = text.replace(old_strip, new_strip, 1)
        print("strip HTML updated")
    else:
        # try partial
        if 'id="post-gen-strip"' in text and "pgs-title" not in text:
            text = text.replace(
                '<div id="post-gen-strip" class="no-print" role="region" aria-label="Post-generate review" hidden>\n  <span class="pgs-chip"',
                '<div id="post-gen-strip" class="no-print" role="region" aria-label="Post-generate review" hidden>\n  <span class="pgs-title">Review</span>\n  <span class="pgs-chip"',
                1,
            )
            text = text.replace(
                '<button type="button" class="btn-secondary" onclick="jumpToIssuesPanel()">Issues</button>',
                '<button type="button" class="pgs-primary" id="pgs-primary-cta" onclick="jumpToIssuesPanel()">Review issues</button>',
                1,
            )
            print("strip HTML partial update")
        else:
            print("strip HTML missing")
else:
    print("strip already has title")

# ── 4) Schedule toolbar collapse ──
old_tb = """      <div class="schedule-toolbar no-print" id="schedule-toolbar">
        <div class="view-mode-seg" id="schedule-view-toggle" role="group" aria-label="Schedule view mode">
          <span class="view-mode-label">View</span>
          <button type="button" data-view="month" onclick="setScheduleViewMode('month')">Month</button>
          <button type="button" data-view="week" onclick="setScheduleViewMode('week')" class="active">Week</button>
          <button type="button" data-view="day" onclick="setScheduleViewMode('day')">Day</button>
        </div>
        <span class="toolbar-label">Actions</span>
        <button class="btn-secondary" style="font-size:0.75rem;padding:0.35rem 0.65rem" onclick="window.print()">Print posting sheet</button>
        <button class="btn-secondary" style="font-size:0.75rem;padding:0.35rem 0.65rem" onclick="exportSchedule()">Word</button>
        <button class="btn-secondary" style="font-size:0.75rem;padding:0.35rem 0.65rem" onclick="exportScheduleExcel()">Excel</button>
        <button class="btn-secondary" style="font-size:0.75rem;padding:0.35rem 0.65rem" onclick="copySummaryText()">Copy summary</button>
        <button class="btn-secondary" style="font-size:0.75rem;padding:0.35rem 0.65rem" onclick="exportBackupJSON()">Backup JSON</button>
        <button type="button" class="btn-secondary no-lock-hide" id="btn-undo-edit" style="font-size:0.75rem;padding:0.35rem 0.65rem" onclick="undoSchedEdit()" disabled title="Undo">Undo</button>
        <button type="button" class="btn-secondary no-lock-hide" id="btn-redo-edit" style="font-size:0.75rem;padding:0.35rem 0.65rem" onclick="redoSchedEdit()" disabled title="Redo">Redo</button>
        <button type="button" class="btn-secondary" style="font-size:0.75rem;padding:0.35rem 0.65rem" onclick="setDensityMode('compact')" title="Compact density">Compact</button>
        <button type="button" class="btn-secondary" style="font-size:0.75rem;padding:0.35rem 0.65rem" onclick="setDensityMode('comfortable')" title="Comfortable density">Comfort</button>
        <button type="button" class="btn-secondary" style="font-size:0.75rem;padding:0.35rem 0.65rem" onclick="setDensityMode('board')" title="Board density">Board</button>
        <span class="gen-timestamp" id="gen-timestamp"></span>
      </div>"""
new_tb = """      <div class="schedule-toolbar no-print" id="schedule-toolbar">
        <div class="view-mode-seg" id="schedule-view-toggle" role="group" aria-label="Schedule view mode">
          <span class="view-mode-label">View</span>
          <button type="button" data-view="month" onclick="setScheduleViewMode('month')">Month</button>
          <button type="button" data-view="week" onclick="setScheduleViewMode('week')" class="active">Week</button>
          <button type="button" data-view="day" onclick="setScheduleViewMode('day')">Day</button>
        </div>
        <span class="toolbar-sep" aria-hidden="true"></span>
        <div class="density-seg" id="density-seg" role="group" aria-label="Density">
          <button type="button" data-density="compact" onclick="setDensityMode('compact')" title="Compact">Compact</button>
          <button type="button" data-density="comfortable" class="active" onclick="setDensityMode('comfortable')" title="Comfortable">Comfort</button>
          <button type="button" data-density="board" onclick="setDensityMode('board')" title="Board / wall">Board</button>
        </div>
        <span class="toolbar-sep" aria-hidden="true"></span>
        <button type="button" class="btn-secondary no-lock-hide" id="btn-undo-edit" style="font-size:0.75rem;padding:0.35rem 0.65rem" onclick="undoSchedEdit()" disabled title="Undo (Ctrl+Z)">Undo</button>
        <button type="button" class="btn-secondary no-lock-hide" id="btn-redo-edit" style="font-size:0.75rem;padding:0.35rem 0.65rem" onclick="redoSchedEdit()" disabled title="Redo">Redo</button>
        <div class="toolbar-menu">
          <button type="button" class="btn-secondary" id="toolbar-export-btn" style="font-size:0.75rem;padding:0.35rem 0.65rem" onclick="toggleToolbarExportMenu(event)" aria-haspopup="true" aria-expanded="false">Export ▾</button>
          <div class="toolbar-menu-panel" id="toolbar-export-panel" hidden>
            <button type="button" onclick="window.print(); closeToolbarExportMenu()">Print posting sheet</button>
            <button type="button" onclick="exportSchedule(); closeToolbarExportMenu()">Word</button>
            <button type="button" onclick="exportScheduleExcel(); closeToolbarExportMenu()">Excel</button>
            <button type="button" onclick="copySummaryText(); closeToolbarExportMenu()">Copy summary</button>
            <button type="button" onclick="exportBackupJSON(); closeToolbarExportMenu()">Backup JSON</button>
          </div>
        </div>
        <span class="gen-timestamp" id="gen-timestamp"></span>
      </div>"""
if 'id="density-seg"' not in text:
    if old_tb in text:
        text = text.replace(old_tb, new_tb, 1)
        print("toolbar collapsed")
    else:
        print("toolbar exact match failed — trying remove density buttons only")
        # Remove three density buttons if still separate
        for b in [
            """        <button type="button" class="btn-secondary" style="font-size:0.75rem;padding:0.35rem 0.65rem" onclick="setDensityMode('compact')" title="Compact density">Compact</button>\n""",
            """        <button type="button" class="btn-secondary" style="font-size:0.75rem;padding:0.35rem 0.65rem" onclick="setDensityMode('comfortable')" title="Comfortable density">Comfort</button>\n""",
            """        <button type="button" class="btn-secondary" style="font-size:0.75rem;padding:0.35rem 0.65rem" onclick="setDensityMode('board')" title="Board density">Board</button>\n""",
        ]:
            text = text.replace(b, "")
else:
    print("toolbar already has density-seg")

# ── 5) Mobile analytics toggle before summary ──
if 'id="mobile-analytics-toggle"' not in text:
    needle = """<!-- SUMMARY -->
  <div class="section" id="summary-section">
    <div class="section-header">
      <h2>Posting &amp; quality</h2>
    </div>"""
    repl = """<!-- SUMMARY -->
  <button type="button" class="mobile-analytics-toggle no-print" id="mobile-analytics-toggle" onclick="toggleMobileAnalytics()">
    Posting &amp; quality analytics
    <span class="mat-hint" id="mobile-analytics-hint">Tap to expand labor, weekly breakdown, and score details</span>
  </button>
  <div class="section analytics-collapsed" id="summary-section">
    <div class="section-header">
      <h2>Posting &amp; quality</h2>
    </div>"""
    if needle in text:
        text = text.replace(needle, repl, 1)
        print("mobile analytics toggle added")
    else:
        print("summary section pattern missing")
else:
    print("mobile analytics exists")

# ── 6) Fix renderWeekTableHtml headers into stacked day-head cells ──
fi = text.find("function renderWeekTableHtml")
if fi > 0:
    # Replace the first forEach that builds day name headers (with possible inline hours IIFE)
    # Find from "html += '<thead><tr><th class=\"name-col\"></th>';" through first "html += '</tr>';"
    start = text.find("html += '<thead><tr><th class=\"name-col\"></th>';", fi)
    if start < 0:
        start = text.find('html += `<thead>', fi)
    end_marker = "html += '</tr>';\n  html += '<tr><th class=\"name-col\"></th>';"
    end = text.find(end_marker, fi)
    if start > 0 and end > start:
        new_head = r"""html += '<thead><tr><th class="name-col"></th>';
  weekDates.forEach(wd => {
    const dow = wd.getDay();
    const dkH = dateKey(wd);
    const fhH = typeof getFederalHolidayForDate === 'function' ? getFederalHolidayForDate(dkH) : null;
    let cls = 'day-head-cell';
    if (dow === 0 || dow === 6) cls += ' weekend-col';
    else if (dow === 1) cls += ' monday-col';
    if (fhH) cls += ' federal-holiday-col';
    let hoursHtml = '';
    try {
      if (typeof getStoreHoursForDate === 'function') {
        const h = getStoreHoursForDate(dkH);
        if (h && h.open && h.close) {
          hoursHtml = '<span class="day-hours' + (h.isOverride ? ' is-override' : '') + '" title="' +
            (h.isOverride ? 'Hours override' : 'Store hours') + '">' +
            esc(h.open) + '–' + esc(h.close) + (h.isOverride ? '*' : '') + '</span>';
        }
      }
    } catch (e) {}
    const fedLab = fhH ? '<span class="fh-day-label" title="' + esc(fhH.name) + '">' + esc(fhH.name) + '</span>' : '';
    html += '<th class="' + cls + '"><span class="dh-day">' + DAY_NAMES[dow] + '</span>' +
      '<span class="dh-date">' + formatDate(wd) + '</span>' + hoursHtml + fedLab + '</th>';
  });
  html += '</tr>';
  /* single header row: date merged into day-head-cell */
  html += '<tr class="day-head-spacer" style="display:none"><th class="name-col"></th>';
"""
        # Keep second row for compatibility but hide it - actually better merge into one row only
        # Find second forEach and make it empty/hidden
        text = text[:start] + new_head + text[end + len("html += '</tr>';\n  html += '<tr><th class=\"name-col\"></th>';") :]
        # Now second forEach still builds date-only row - find and neutralize it
        # After our insert, second forEach still exists
        print("week header first row replaced")
    else:
        print("week header markers not found", start, end)
else:
    print("renderWeekTableHtml missing")

# Neutralize second thead row (date-only) if still present after first row has dates
# Find pattern of second forEach that only does formatDate(wd)
pattern_second = re.compile(
    r"html \+= '<tr class=\"day-head-spacer\"[^>]*>.*?</tr>';\s*"
    r"weekDates\.forEach\(wd => \{[^}]*const dow = wd\.getDay\(\);[^}]*let cls = '';[^}]*if \(dow === 0 \|\| dow === 6\) cls = 'weekend-col';[^}]*else if \(dow === 1\) cls = 'monday-col';[^}]*html \+= `<th class=\"\$\{cls\}\">\$\{formatDate\(wd\)\}</th>`;[^}]*\}\);\s*"
    r"html \+= '</tr></thead><tbody>';",
    re.S,
)
# Simpler approach after first replace: remove second forEach block if day-head-spacer exists
if "day-head-spacer" in text:
    # remove from day-head-spacer through </thead><tbody>
    m = re.search(
        r"html \+= '<tr class=\"day-head-spacer\".*?html \+= '</tr></thead><tbody>';",
        text,
        re.S,
    )
    if m:
        # Also need to remove the forEach between spacer open and thead close
        chunk = m.group(0)
        # Just replace whole thing with thead close
        text = text[: m.start()] + "html += '</thead><tbody>';" + text[m.end() :]
        print("second header row removed")
    else:
        # try looser: after day-head-spacer line, find weekDates.forEach until </thead>
        i = text.find("day-head-spacer")
        if i > 0:
            j = text.find("</thead><tbody>", i)
            if j > 0:
                # back up to html += '</tr>' of first row - we already have incomplete structure
                # Replace from day-head-spacer insertion through forEach of dates
                k = text.find("weekDates.forEach", i)
                if k > 0 and k < j:
                    end_fe = text.find("});", k) + 3
                    # also remove spacer line and final html += '</tr>'
                    spacer_start = text.rfind("html += '<tr class=\"day-head-spacer\"", 0, k)
                    if spacer_start < 0:
                        spacer_start = text.rfind("/* single header", 0, k)
                    close_tr = text.find("html += '</tr>';", end_fe)
                    if close_tr > 0 and close_tr < j:
                        text = text[:spacer_start] + "html += '</thead><tbody>';" + text[j + len("</thead><tbody>") :]
                        # fix - we already consumed thead tbody
                        print("second row surgically removed")
                    else:
                        text = text[: i - 20]  # too messy
                        print("could not clean second row cleanly")
else:
    # Maybe first replace failed - try direct single-row rewrite of both forEach
    fi = text.find("function renderWeekTableHtml")
    if fi > 0 and "dh-day" not in text[fi : fi + 3000]:
        # replace entire function start through tbody
        m = re.search(
            r"function renderWeekTableHtml\(weekDates, wIdx, names, ALL_KC\) \{\s*"
            r"let html = '<table class=\"week-table\">';\s*"
            r"html \+= '<thead><tr><th class=\"name-col\"></th>';\s*"
            r"weekDates\.forEach\(wd => \{.*?\}\);\s*"
            r"html \+= '</tr>';\s*"
            r"html \+= '<tr><th class=\"name-col\"></th>';\s*"
            r"weekDates\.forEach\(wd => \{.*?\}\);\s*"
            r"html \+= '</tr></thead><tbody>';",
            text[fi : fi + 4000],
            re.S,
        )
        if m:
            new_fn_head = """function renderWeekTableHtml(weekDates, wIdx, names, ALL_KC) {
  let html = '<table class="week-table">';
  html += '<thead><tr><th class="name-col"></th>';
  weekDates.forEach(wd => {
    const dow = wd.getDay();
    const dkH = dateKey(wd);
    const fhH = typeof getFederalHolidayForDate === 'function' ? getFederalHolidayForDate(dkH) : null;
    let cls = 'day-head-cell';
    if (dow === 0 || dow === 6) cls += ' weekend-col';
    else if (dow === 1) cls += ' monday-col';
    if (fhH) cls += ' federal-holiday-col';
    let hoursHtml = '';
    try {
      if (typeof getStoreHoursForDate === 'function') {
        const h = getStoreHoursForDate(dkH);
        if (h && h.open && h.close) {
          hoursHtml = '<span class="day-hours' + (h.isOverride ? ' is-override' : '') + '" title="' +
            (h.isOverride ? 'Hours override' : 'Store hours') + '">' +
            esc(h.open) + '–' + esc(h.close) + (h.isOverride ? '*' : '') + '</span>';
        }
      }
    } catch (e) {}
    const fedLab = fhH ? '<span class="fh-day-label" title="' + esc(fhH.name) + '">' + esc(fhH.name) + '</span>' : '';
    html += '<th class="' + cls + '"><span class="dh-day">' + DAY_NAMES[dow] + '</span>' +
      '<span class="dh-date">' + formatDate(wd) + '</span>' + hoursHtml + fedLab + '</th>';
  });
  html += '</tr></thead><tbody>';"""
            text = text[:fi] + new_fn_head + text[fi + m.end() :]
            print("full week header rewrite")
        else:
            print("full week header regex failed")

# ── 7) JS helpers for toolbar menu + density active + mobile analytics + strip CTA ──
js_helpers = r"""
// ── v2.6.1 visual polish helpers ──
function toggleToolbarExportMenu(e) {
  if (e) e.stopPropagation();
  const panel = document.getElementById('toolbar-export-panel');
  const btn = document.getElementById('toolbar-export-btn');
  if (!panel) return;
  const open = panel.hasAttribute('hidden');
  if (open) {
    panel.removeAttribute('hidden');
    panel.classList.add('open');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  } else {
    closeToolbarExportMenu();
  }
}
function closeToolbarExportMenu() {
  const panel = document.getElementById('toolbar-export-panel');
  const btn = document.getElementById('toolbar-export-btn');
  if (panel) {
    panel.setAttribute('hidden', '');
    panel.classList.remove('open');
  }
  if (btn) btn.setAttribute('aria-expanded', 'false');
}
document.addEventListener('click', (e) => {
  const menu = document.querySelector('.toolbar-menu');
  if (menu && !menu.contains(e.target)) closeToolbarExportMenu();
});

function syncDensitySegUI() {
  const mode = document.documentElement.getAttribute('data-density') || 'comfortable';
  document.querySelectorAll('#density-seg button').forEach((b) => {
    b.classList.toggle('active', b.getAttribute('data-density') === mode);
  });
}
const _setDensityModeOrig = typeof setDensityMode === 'function' ? setDensityMode : null;
if (_setDensityModeOrig) {
  window.setDensityMode = function (mode) {
    _setDensityModeOrig(mode);
    try { syncDensitySegUI(); } catch (e) {}
  };
}

function toggleMobileAnalytics() {
  const sec = document.getElementById('summary-section');
  const hint = document.getElementById('mobile-analytics-hint');
  if (!sec) return;
  const collapsed = sec.classList.toggle('analytics-collapsed');
  if (hint) {
    hint.textContent = collapsed
      ? 'Tap to expand labor, weekly breakdown, and score details'
      : 'Tap to collapse analytics';
  }
}
// Default mobile: start collapsed when width small
function initMobileAnalyticsDefault() {
  const sec = document.getElementById('summary-section');
  if (!sec) return;
  if (window.innerWidth <= 720) sec.classList.add('analytics-collapsed');
  else sec.classList.remove('analytics-collapsed');
}

// Enhance updatePostGenStrip primary CTA label when present
const _updatePostGenStripOrig = typeof updatePostGenStrip === 'function' ? updatePostGenStrip : null;
if (_updatePostGenStripOrig) {
  window.updatePostGenStrip = function () {
    _updatePostGenStripOrig();
    try {
      const cta = document.getElementById('pgs-primary-cta');
      const fair = document.getElementById('pgs-fair');
      const cover = document.getElementById('pgs-cover');
      if (!cta) return;
      const bad =
        (fair && fair.classList.contains('warn')) ||
        (cover && cover.classList.contains('warn')) ||
        (cover && cover.classList.contains('bad'));
      cta.textContent = bad ? 'Review issues' : 'Looks good · Fairness';
      cta.onclick = bad ? jumpToIssuesPanel : jumpToFairnessStrip;
    } catch (e) {}
  };
}

// Shorter local status text
const _updateLocalStatusPillOrig = typeof updateLocalStatusPill === 'function' ? updateLocalStatusPill : null;
if (_updateLocalStatusPillOrig) {
  window.updateLocalStatusPill = function () {
    _updateLocalStatusPillOrig();
    try {
      const el = document.getElementById('local-status-pill');
      if (!el) return;
      // Keep short: "Saved" or time only in title
      const t = el.getAttribute('title') || '';
      if (el.textContent && el.textContent.length > 18) {
        el.innerHTML = '<span class="pill-text">Saved</span>';
        if (t) el.title = t;
      }
    } catch (e) {}
  };
}

"""

if "toggleToolbarExportMenu" not in text:
    # insert before handleLaunchQuery or at end of script before bootUi
    anchor = "function handleLaunchQuery()"
    if anchor in text:
        text = text.replace(anchor, js_helpers + "\n" + anchor, 1)
        print("JS helpers inserted")
    else:
        boot = "function bootUi()"
        text = text.replace(boot, js_helpers + "\n" + boot, 1)
        print("JS helpers before bootUi")
else:
    print("JS helpers exist")

# Patch bootUi to init mobile analytics + density seg
if "initMobileAnalyticsDefault" not in text[text.find("function bootUi()") : text.find("function bootUi()") + 800]:
    old_b = """function bootUi() {
  try { if (typeof initDensityAndContrast === 'function') initDensityAndContrast(); } catch (e) {}
  handleLaunchQuery();
  ensureAuthOnBoot();
  updateAccountChip();
  personalizeWelcome();
  try { if (typeof updateLocalStatusPill === 'function') updateLocalStatusPill(); } catch (e) {}
  try { if (typeof updateOpsHome === 'function') updateOpsHome(); } catch (e) {}
  try { if (typeof updateUndoRedoButtons === 'function') updateUndoRedoButtons(); } catch (e) {}
  try { if (typeof setupRequestPaintHandlers === 'function') setupRequestPaintHandlers(); } catch (e) {}
  try {
    if (typeof loadSelectedFederalHolidays === 'function') loadSelectedFederalHolidays();
    if (typeof renderFederalHolidaysUI === 'function') renderFederalHolidaysUI();
    if (typeof syncFederalHolidaysToPeriod === 'function') syncFederalHolidaysToPeriod();
  } catch (eFed) {}
}"""
    new_b = """function bootUi() {
  try { if (typeof initDensityAndContrast === 'function') initDensityAndContrast(); } catch (e) {}
  handleLaunchQuery();
  ensureAuthOnBoot();
  updateAccountChip();
  personalizeWelcome();
  try { if (typeof updateLocalStatusPill === 'function') updateLocalStatusPill(); } catch (e) {}
  try { if (typeof updateOpsHome === 'function') updateOpsHome(); } catch (e) {}
  try { if (typeof updateUndoRedoButtons === 'function') updateUndoRedoButtons(); } catch (e) {}
  try { if (typeof setupRequestPaintHandlers === 'function') setupRequestPaintHandlers(); } catch (e) {}
  try {
    if (typeof loadSelectedFederalHolidays === 'function') loadSelectedFederalHolidays();
    if (typeof renderFederalHolidaysUI === 'function') renderFederalHolidaysUI();
    if (typeof syncFederalHolidaysToPeriod === 'function') syncFederalHolidaysToPeriod();
  } catch (eFed) {}
  try { if (typeof syncDensitySegUI === 'function') syncDensitySegUI(); } catch (e) {}
  try { if (typeof initMobileAnalyticsDefault === 'function') initMobileAnalyticsDefault(); } catch (e) {}
}"""
    if old_b in text:
        text = text.replace(old_b, new_b, 1)
        print("bootUi extended")
    else:
        # append calls before closing of bootUi
        bi = text.find("function bootUi()")
        if bi > 0:
            close = text.find("\n}", bi)
            # find matching end of function - simple first brace close is wrong
            # insert before last try block end in bootUi
            marker = "setupRequestPaintHandlers(); } catch (e) {}"
            if marker in text[bi : bi + 1200]:
                text = text.replace(
                    marker,
                    marker
                    + "\n  try { if (typeof syncDensitySegUI === 'function') syncDensitySegUI(); } catch (e) {}\n  try { if (typeof initMobileAnalyticsDefault === 'function') initMobileAnalyticsDefault(); } catch (e) {}",
                    1,
                )
                print("bootUi calls appended")
            else:
                print("bootUi append failed")
else:
    print("bootUi already has mobile analytics")

# Version 2.6.1
text = re.sub(r"const APP_VERSION = '[^']+'", "const APP_VERSION = '2.6.1'", text)
text = re.sub(
    r'id="app-version-label">v[^<]+</span>',
    'id="app-version-label">v2.6.1</span>',
    text,
)

path.write_text(text, encoding="utf-8")
print("Wrote index.html", len(text))

# version.json + sw
v = json.loads((root / "version.json").read_text(encoding="utf-8"))
v["version"] = "2.6.1"
(root / "version.json").write_text(json.dumps(v, indent=2) + "\n", encoding="utf-8")
sw = (root / "sw.js").read_text(encoding="utf-8")
sw = re.sub(r"msb-pro-v[\d.]+", "msb-pro-v2.6.1", sw)
(root / "sw.js").write_text(sw, encoding="utf-8")
print("version 2.6.1")

# Verify critical strings
checks = [
    "pgs-title",
    "density-seg",
    "toolbar-export-panel",
    "mobile-analytics-toggle",
    "dh-day",
    "toggleToolbarExportMenu",
    "brand-status",
]
for c in checks:
    print(c, c in text)
