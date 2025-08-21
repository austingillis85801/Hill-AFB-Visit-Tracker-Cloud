// sw.js — v5
const CACHE_NAME = 'visit-tracker-sync-v5';
const ASSETS = ['./','./index.html','./manifest.webmanifest','./sw.js','./icons/icon-192.png','./icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(resp =>
        resp || fetch(e.request).then(r => {
          const copy = r.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, copy));
          return r;
        }).catch(() => caches.match('./index.html'))
      )
    );
  }
});
