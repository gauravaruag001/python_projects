const CACHE_NAME = 'linuk-cache-v5';
const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './db/local_questions.json'
];

// Install: cache assets and immediately take over
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// Activate: delete all old caches and claim clients immediately
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch: network-first strategy so latest code is always served
self.addEventListener('fetch', event => {
    // Bypass cache completely for master JSON
    if (event.request.url.includes('master_questions.json')) {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Cache a copy of the fresh response
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
