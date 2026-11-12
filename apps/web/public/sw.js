const CACHE_NAME = 'maliscope-shell-v1';
const HANDOUT_CACHE = 'maliscope-handouts-v1';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/icon-512.png'];
self.addEventListener('install', (event) => { event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))); self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('maliscope-') && ![CACHE_NAME, HANDOUT_CACHE].includes(key)).map((key) => caches.delete(key))))); self.clients.claim(); });
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/handouts/')) {
    event.respondWith(caches.open(HANDOUT_CACHE).then(async (cache) => (await cache.match(request)) || fetch(request).then((response) => { if (response.ok) cache.put(request, response.clone()); return response; })));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => { const copy = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)); return response; }).catch(async () => (await caches.match(request)) || (await caches.match('/'))));
  }
});
