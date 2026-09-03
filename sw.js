/* Manager Schedule Builder Pro — service worker
   Paths are relative to this script so GitHub project pages (/schedule-builder/) work. */
const CACHE = 'msb-pro-v2.6.40';
const PRECACHE = [
  './',
  './index.html',
  './buy.html',
  './feedback.html',
  './monetization.json',
  './manifest.webmanifest',
  './sw.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/favicon-32.png',
  './icons/favicon-16.png',
  './favicon.ico',
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        PRECACHE.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[sw] precache skip', url, err);
          })
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Network-first for navigations (HTML) with offline fallback.
  // Cache each navigation under its own URL. Only alias './index.html' for the app root.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            caches.open(CACHE).then((c) => {
              c.put(req, res.clone()).catch(() => {});
              try {
                const path = new URL(req.url).pathname;
                const file = path.substring(path.lastIndexOf('/') + 1);
                if (!file || file === 'index.html') {
                  c.put('./index.html', res.clone()).catch(() => {});
                }
              } catch (e) {}
            }).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((r) =>
            r || caches.match('./index.html').then((r2) => r2 || caches.match('./'))
          )
        )
    );
    return;
  }

  // Cache-first for same-origin assets + CDN sheetjs
  const isAsset =
    url.origin === self.location.origin ||
    url.hostname === 'cdn.sheetjs.com';

  if (!isAsset) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
