/**
 * PWA Service Worker — Phase D: Early warning on mobile.
 * Caches app shell, offline page, and static assets (JS/CSS/images) for installable/offline use.
 */
const CACHE_NAME = 'pfrp-alerts-v3';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll([OFFLINE_URL, '/', '/manifest.json', '/logo.svg']);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

// Cache static assets (same-origin JS, CSS, images) on successful fetch; serve from cache when offline.
function isStaticAsset(request) {
  var u = new URL(request.url);
  if (u.origin !== self.location.origin) return false;
  var dest = request.destination;
  if (dest === 'script' || dest === 'style' || dest === 'image' || dest === 'font') return true;
  if (u.pathname.startsWith('/assets/') || u.pathname.match(/\.(js|css|woff2?|png|svg|ico)(\?|$)/)) return true;
  return false;
}

self.addEventListener('fetch', function (event) {
  // Navigate: try network, fallback to offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(function () {
        return caches.match(OFFLINE_URL).then(function (cached) {
          return cached || caches.match('/').then(function (index) {
            return index || new Response(
              '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Offline</title></head><body style="background:#0a0e17;color:#e4e4e7;font-family:system-ui;padding:1rem;text-align:center"><h1>Offline</h1><p>Early warning alerts when back online.</p><a href="/" style="color:#60a5fa">Retry</a></body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          });
        });
      })
    );
    return;
  }
  // Static assets: cache-first when cached, else fetch and cache
  if (isStaticAsset(event.request)) {
    event.respondWith(
      caches.match(event.request).then(function (cached) {
        if (cached) return cached;
        return fetch(event.request).then(function (response) {
          if (response && response.status === 200 && response.type === 'basic') {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, clone); });
          }
          return response;
        });
      })
    );
  }
});
