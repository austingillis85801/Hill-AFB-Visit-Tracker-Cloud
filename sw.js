// sw.js — v16
// Adds offline caching for same-origin assets AND whitelisted CDNs (Firebase + jsDelivr).
// Provides SPA navigation fallback and cache-busting support (?v=16).

const VERSION = 'v16';
const CACHE_NAME = `visit-tracker-sync-${VERSION}`;
const CDN_CACHE = `visit-tracker-cdn-${VERSION}`;

// App shell (same-origin)
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './sw.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// Whitelisted CDNs (hostnames)
const CDN_HOSTS = new Set([
  'www.gstatic.com',   // Firebase SDK
  'cdn.jsdelivr.net',  // PapaParse
]);

// Optional: prime CDN entries (runtime fill still applies)
const APP_CDN = [
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js',
  'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js',
];

// ----- Install: pre-cache shell; try to warm CDN (ignore failures)
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const app = await caches.open(CACHE_NAME);
    await app.addAll(APP_SHELL);
    try {
      const cdn = await caches.open(CDN_CACHE);
      await cdn.addAll(APP_CDN.map(u => new Request(u, { mode: 'no-cors' })));
    } catch (_) {}
    await self.skipWaiting();
  })());
});

// ----- Activate: remove old caches; take control
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => {
      if (k !== CACHE_NAME && k !== CDN_CACHE) return caches.delete(k);
      return Promise.resolve();
    }));
    await self.clients.claim();
  })());
});

// Helpers
const isGET = (req) => req.method === 'GET';

// ----- Fetch: same-origin + CDN caching
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!isGET(req)) return;

  const url = new URL(req.url);

  // 1) SPA navigations: network-first, fallback to cached index
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(req);
      } catch {
        const cached = await caches.match('./index.html', { ignoreSearch: true });
        return cached || new Response('', { status: 504, statusText: 'Offline' });
      }
    })());
    return;
  }

  // 2) Same-origin static: SWR (ignore ?v=)
  if (url.origin === location.origin) {
    const isVersionBuster = url.search && url.search.startsWith('?v=');
    const cacheKey = isVersionBuster ? url.pathname : url.pathname + url.search;
    const cacheReq = new Request(cacheKey, { cache: 'no-store' });

    event.respondWith((async () => {
      const cached = await caches.match(cacheReq, { ignoreSearch: true });
      const fetchPromise = fetch(req).then((res) => {
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'opaque')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(cacheReq, clone));
        }
        return res;
      }).catch(() => undefined);
      return cached || fetchPromise || new Response('', { status: 504, statusText: 'Offline' });
    })());
    return;
  }

  // 3) Whitelisted CDNs: cache-first (so SDKs work offline)
  if (CDN_HOSTS.has(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CDN_CACHE);
      const cached = await cache.match(req, { ignoreSearch: false });
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && (res.type === 'basic' || res.type === 'opaque')) {
          cache.put(req, res.clone());
        }
        return res;
      } catch {
        return new Response('', { status: 504, statusText: 'Offline (CDN)' });
      }
    })());
    return;
  }

  // 4) Other cross-origins: passthrough
});

// Optional: allow page to force this SW to take control immediately
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
