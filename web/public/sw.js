/* Service Worker - WiFi Network Management System
 * ------------------------------------------------
 * استراتيجية:
 * - App shell + assets: Cache First
 * - API: Network First (مع fallback إلى الكاش عند انقطاع الشبكة)
 * - لا نكاشي أبداً: /api/auth (أمان)
 */
const CACHE_NAME = 'wifi-dashboard-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/logo.svg'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // نفس المصدر فقط
    if (url.origin !== self.location.origin) return;

    // API: Network First (ما عدا auth)
    if (url.pathname.startsWith('/api/')) {
        if (url.pathname.startsWith('/api/auth')) return;
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // Assets: Cache First
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((response) => {
                if (response.ok && (request.destination === 'style' || request.destination === 'script' || request.destination === 'image' || request.destination === 'font')) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                }
                return response;
            });
        })
    );
});
