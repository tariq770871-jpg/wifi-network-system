/* Service Worker - WiFi Network Management System
 * ------------------------------------------------
 * استراتيجية (محدثة):
 * - التنقل (HTML): Network First — يضمن حصول المستخدم على آخر نسخة دائماً
 * - /assets/* (ملفات مُ hashes): Cache First — محتواها غير متغير
 * - بقية الأصول: Network First مع fallback للكاش عند الانقطاع
 * - API: Network First (مع fallback عند انقطاع الشبكة)
 * - لا نكاشي أبداً: /api/auth (أمان)
 */
const CACHE_NAME = 'wifi-dashboard-v3';
const APP_SHELL = ['/manifest.webmanifest', '/logo.svg'];

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

    // ملفات الـ assets المُ hashes: Cache First (اسم الملف يتغير مع كل بناء)
    if (url.pathname.startsWith('/assets/')) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return response;
                });
            })
        );
        return;
    }

    // التنقل والبقية: Network First — يمنع تشغيل نسخة قديمة بعد النشر
    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                }
                return response;
            })
            .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
    );
});
