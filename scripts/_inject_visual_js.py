from pathlib import Path

p = Path(__file__).resolve().parents[1] / "index.html"
t = p.read_text(encoding="utf-8")

js = r"""
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
(function wrapDensityMode() {
  const orig = window.setDensityMode;
  if (typeof orig !== 'function' || orig._densitySegWrapped) return;
  function wrapped(mode) {
    orig(mode);
    try {
      syncDensitySegUI();
    } catch (e) {}
  }
  wrapped._densitySegWrapped = true;
  window.setDensityMode = wrapped;
})();
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
function initMobileAnalyticsDefault() {
  const sec = document.getElementById('summary-section');
  if (!sec) return;
  if (window.innerWidth <= 720) sec.classList.add('analytics-collapsed');
  else sec.classList.remove('analytics-collapsed');
}
(function wrapPostGenStripCta() {
  const orig = window.updatePostGenStrip;
  if (typeof orig !== 'function' || orig._ctaWrapped) return;
  function wrapped() {
    orig();
    try {
      const cta = document.getElementById('pgs-primary-cta');
      const fair = document.getElementById('pgs-fair');
      const cover = document.getElementById('pgs-cover');
      if (!cta) return;
      const bad =
        (fair && fair.classList.contains('warn')) ||
        (cover && (cover.classList.contains('warn') || cover.classList.contains('bad')));
      cta.textContent = bad ? 'Review issues' : 'Looks good · Fairness';
      cta.onclick = bad ? jumpToIssuesPanel : jumpToFairnessStrip;
    } catch (e) {}
  }
  wrapped._ctaWrapped = true;
  window.updatePostGenStrip = wrapped;
})();
(function wrapLocalStatusShort() {
  const orig = window.updateLocalStatusPill;
  if (typeof orig !== 'function' || orig._shortWrapped) return;
  function wrapped() {
    orig();
    try {
      const el = document.getElementById('local-status-pill');
      if (!el) return;
      const title = el.getAttribute('title') || el.textContent || '';
      if (el.textContent && el.textContent.length > 14) {
        el.innerHTML = '<span class="pill-text">Saved</span>';
        if (title) el.title = title;
      }
    } catch (e) {}
  }
  wrapped._shortWrapped = true;
  window.updateLocalStatusPill = wrapped;
})();

"""

if "function toggleToolbarExportMenu" not in t:
    if "function handleLaunchQuery()" in t:
        t = t.replace("function handleLaunchQuery()", js + "function handleLaunchQuery()", 1)
        print("inserted helpers before handleLaunchQuery")
    else:
        t = t.replace("function bootUi()", js + "function bootUi()", 1)
        print("inserted helpers before bootUi")
else:
    print("helpers already present")

# Ensure primary CTA exists in strip
if "pgs-primary-cta" not in t:
    a = '<button type="button" class="btn-secondary" onclick="jumpToIssuesPanel()">Issues</button>'
    b = '<button type="button" class="pgs-primary" id="pgs-primary-cta" onclick="jumpToIssuesPanel()">Review issues</button>'
    if a in t:
        t = t.replace(a, b, 1)
        print("cta replaced")
    else:
        print("cta pattern missing")

if "pgs-title" not in t:
    t = t.replace(
        'aria-label="Post-generate review" hidden>\n  <span class="pgs-chip"',
        'aria-label="Post-generate review" hidden>\n  <span class="pgs-title">Review</span>\n  <span class="pgs-chip"',
        1,
    )
    print("title added", "pgs-title" in t)

p.write_text(t, encoding="utf-8")
print(
    "ok",
    "toggleToolbarExportMenu" in t,
    "toggleMobileAnalytics" in t,
    "pgs-primary-cta" in t,
    "pgs-title" in t,
)
