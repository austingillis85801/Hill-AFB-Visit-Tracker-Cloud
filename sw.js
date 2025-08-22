// sw.js — v13
// PWA app shell + robust caching for same-origin assets, SPA navigation fallback,
// and cache-busting query support (e.g., ?v=13)

const VERSION = 'v13';
const CACHE_NAME = `visit-tracker-sync-${VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './sw.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ----- Install: pre-cache the app shell and become active immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ----- Activate: clean old caches and take control of clients
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())));
    await self.clients.claim();
  })());
});

// ----- Fetch: handle only same-origin GETs
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // ignore cross-origin (e.g., Firebase)

  // 1) SPA navigations: always serve index.html (offline-friendly)
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        // Try network first; fall back to cached index
        try {
          const net = await fetch(req);
          return net;
        } catch (_) {
          const cached = await caches.match('./index.html', { ignoreSearch: true });
          return cached || new Response('', { status: 504, statusText: 'Offline' });
        }
      })()
    );
    return;
  }

  // 2) Static asset requests: stale-while-revalidate, ignoring ?v= cache-busters
  const isVersionBuster = url.search && url.search.startsWith('?v=');
  const cacheKey = isVersionBuster ? url.pathname : url.pathname + url.search;

  const cacheReq = new Request(cacheKey, {
    headers: req.headers,
    mode: req.mode,
    credentials: req.credentials,
    redirect: req.redirect,
    referrer: req.referrer,
    referrerPolicy: req.referrerPolicy,
    integrity: req.integrity,
    cache: 'no-store',
  });

  event.respondWith(
    (async () => {
      const cached = await caches.match(cacheReq, { ignoreSearch: true });
      const fetchPromise = fetch(req)
        .then((res) => {
          // Cache only successful, same-origin (basic) responses
          if (res && res.status === 200 && res.type === 'basic') {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(cacheReq, clone));
          }
          return res;
        })
        .catch(() => undefined);

      // Return cached first (fast), then update in background
      return cached || fetchPromise || (url.pathname.endsWith('.html')
        ? caches.match('./index.html', { ignoreSearch: true })
        : new Response('', { status: 504, statusText: 'Offline' }));
    })()
  );
});

// Optional: allow page to force this SW to take control immediately
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
