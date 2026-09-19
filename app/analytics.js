/* Manager Schedule Pro — GA4 custom events (G-LJ8E69Z8Y0).
   Coarse labels only. Never send names, rosters, store numbers, cells,
   license keys, or Ask-bar text. No-ops when gtag is missing. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.msbTrack = api.msbTrack;
    root.MSB_ANALYTICS = api;
  }
  if (root && root.document) {
    var start = function () {
      try { api.boot(); } catch (e) {}
    };
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var ALLOWED_EVENTS = {
    landing_view: 1,
    cta_click: 1,
    outbound_click: 1,
    scroll_depth: 1,
    app_view: 1,
    feature_map_open: 1,
    build_click: 1,
    build_result: 1,
    review_open: 1,
    export_click: 1,
    pro_gate_shown: 1,
    license_activate_result: 1,
    theme_change: 1,
    lang_change: 1,
    app_hide: 1,
    page_leave: 1
  };

  var ALLOWED_KEYS = {
    cta_id: 1,
    format: 1,
    result: 1,
    theme: 1,
    lang: 1,
    last_surface: 1,
    percent: 1,
    surface: 1,
    reason: 1,
    destination: 1
  };

  var BLOCKED_KEY = /name|roster|store|license|key|ask|query|employee|cell|content|text|message|email|phone/i;
  var CTA_IDS = { open_app: 1, gumroad: 1, play: 1, feature_map: 1, can_do: 1, other: 1 };
  var viewSent = false;
  var hideSent = false;
  var scrollSeen = {};
  var landingBound = false;
  var hideBound = false;

  function resolveGtag() {
    try { if (typeof gtag === 'function') return gtag; } catch (e) {}
    try {
      if (typeof globalThis !== 'undefined' && typeof globalThis.gtag === 'function') {
        return globalThis.gtag;
      }
    } catch (e2) {}
    return null;
  }

  function sanitizeParams(params) {
    var out = {};
    if (!params || typeof params !== 'object') return out;
    for (var k in params) {
      if (!Object.prototype.hasOwnProperty.call(params, k)) continue;
      if (!ALLOWED_KEYS[k] || BLOCKED_KEY.test(k)) continue;
      var v = params[k];
      if (v == null || typeof v === 'object') continue;
      if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') continue;
      var s = String(v);
      if (!s || s.length > 40) continue;
      out[k] = s;
    }
    return out;
  }

  function msbTrack(event, params) {
    try {
      if (typeof event !== 'string' || !ALLOWED_EVENTS[event]) return;
      var send = resolveGtag();
      if (!send) return;
      var payload = sanitizeParams(params);
      if (event === 'app_hide' || event === 'page_leave') payload.transport_type = 'beacon';
      send('event', event, payload);
    } catch (e) {}
  }

  function pageKind() {
    try {
      var path = String(location.pathname || '');
      if (/\/app\/?$/.test(path) || /\/app\/index\.html$/.test(path)) return 'app';
      if (/\/(legal|store|app)\//.test(path)) return 'other';
      if (path === '' || /\/$/.test(path) || /\/index\.html$/.test(path)) return 'landing';
    } catch (e) {}
    return 'other';
  }

  function ctaIdFromAnchor(el) {
    if (!el) return 'other';
    var explicit = String(el.getAttribute('data-cta') || '').toLowerCase();
    if (CTA_IDS[explicit]) return explicit;
    return ctaIdFromHref(el.getAttribute('href') || '');
  }

  function ctaIdFromHref(href) {
    var raw = String(href || '');
    var low = raw.toLowerCase();
    if (low.indexOf('gumroad.com') >= 0) return 'gumroad';
    if (low.indexOf('play.google.com') >= 0) return 'play';
    if (/[?&]map=1|[?&]feature-map=/.test(low)) return 'feature_map';
    if (low === '#can-do' || /#can-do\b/.test(low)) return 'can_do';
    if (low === '#features' || /#features\b/.test(low)) return 'feature_map';
    if (/^https?:\/\//i.test(raw)) return 'other';
    if (/(^|\/)app\/?(\?|#|$)/.test(low) || low === 'app/' || low === './app/' || low === '/app/') {
      return 'open_app';
    }
    return 'other';
  }

  function outboundDestination(href) {
    var low = String(href || '').toLowerCase();
    if (low.indexOf('play.google.com') >= 0) return 'play';
    if (low.indexOf('gumroad.com') >= 0) return 'gumroad';
    return 'other';
  }

  function isExternalHref(href) {
    try {
      if (!/^https?:\/\//i.test(href || '')) return false;
      var u = new URL(href, location.href);
      return u.host !== location.host;
    } catch (e) {
      return /^https?:\/\//i.test(href || '');
    }
  }

  function closestAnchor(node) {
    var el = node;
    while (el && el !== document) {
      if (el.tagName === 'A' && el.getAttribute('href')) return el;
      el = el.parentNode;
    }
    return null;
  }

  function lastSurface() {
    try {
      var account = document.getElementById('account-modal');
      if (account && !account.hasAttribute('hidden')) return 'account';
      var review = document.getElementById('review-sheet');
      if (review && !review.hidden && review.classList.contains('open')) return 'review';
      var welcome = document.getElementById('welcome-card');
      if (welcome && welcome.style.display !== 'none' && !welcome.hasAttribute('hidden')
        && !welcome.classList.contains('welcome-after-board')) {
        var tab0 = typeof currentAppTab === 'string' ? currentAppTab : '';
        if (!tab0 || tab0 === 'setup') return 'welcome';
      }
      var tab = typeof currentAppTab === 'string' ? currentAppTab : '';
      if (tab === 'setup') return 'setup';
      if (tab === 'requests') return 'team';
      if (tab === 'schedule') return 'board';
    } catch (e) {}
    return 'other';
  }

  function bindLandingClicks() {
    if (landingBound || typeof document === 'undefined') return;
    landingBound = true;
    document.addEventListener('click', function (ev) {
      try {
        var a = closestAnchor(ev.target);
        if (!a) return;
        var href = a.getAttribute('href') || '';
        var cta = ctaIdFromAnchor(a);
        var external = isExternalHref(href);
        if (cta !== 'other' || a.hasAttribute('data-cta')) {
          msbTrack('cta_click', { cta_id: cta });
          return;
        }
        if (external) {
          msbTrack('outbound_click', { destination: outboundDestination(href) });
        }
      } catch (e) {}
    }, true);
  }

  function bindLandingScroll() {
    if (typeof window === 'undefined') return;
    var onScroll = function () {
      try {
        var el = document.documentElement;
        var max = (el.scrollHeight - el.clientHeight) || 1;
        var pct = Math.round((window.scrollY || window.pageYOffset || 0) / max * 100);
        if (pct >= 99) pct = 100;
        var marks = [25, 50, 75, 100];
        for (var i = 0; i < marks.length; i++) {
          var t = marks[i];
          if (pct >= t && !scrollSeen[t]) {
            scrollSeen[t] = 1;
            msbTrack('scroll_depth', { percent: String(t) });
          }
        }
      } catch (e) {}
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function bindAppHide() {
    if (hideBound || typeof document === 'undefined') return;
    hideBound = true;
    var onHide = function () {
      if (hideSent) return;
      hideSent = true;
      msbTrack('app_hide', { last_surface: lastSurface() });
    };
    var onShow = function () {
      hideSent = false;
    };
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') onHide();
      else onShow();
    });
    window.addEventListener('pagehide', onHide);
  }

  function boot() {
    var kind = pageKind();
    if (!viewSent) {
      viewSent = true;
      if (kind === 'landing') msbTrack('landing_view');
      else if (kind === 'app') msbTrack('app_view');
    }
    if (kind === 'landing') {
      bindLandingClicks();
      bindLandingScroll();
    } else if (kind === 'app') {
      bindAppHide();
    }
  }

  return {
    msbTrack: msbTrack,
    sanitizeParams: sanitizeParams,
    ctaIdFromHref: ctaIdFromHref,
    ctaIdFromAnchor: ctaIdFromAnchor,
    lastSurface: lastSurface,
    pageKind: pageKind,
    outboundDestination: outboundDestination,
    boot: boot,
    ALLOWED_EVENTS: ALLOWED_EVENTS,
    ALLOWED_KEYS: ALLOWED_KEYS
  };
});
