// CaseLog PWA Service Worker
// Network-first for HTML/JS/CSS to ensure updates appear quickly after deploy.
// Cache versioned + skipWaiting + clients.claim for immediate activation on iOS PWA.
// Clears old caches. Data still handled via Dexie + sync (offline first).

const CACHE_VERSION = 'caselog-v6';
const CACHE_NAME = CACHE_VERSION;

const APP_SHELL = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install: Precache shell and immediately activate new SW
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate: Claim clients immediately + clear old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
          return null;
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Message handler to allow client to trigger skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Helper: Network first, cache on success, fallback to cache
function networkFirst(request) {
  return fetch(request)
    .then((response) => {
      if (response && response.status === 200 && response.type === 'basic') {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, clone);
        });
      }
      return response;
    })
    .catch(() => {
      return caches.match(request).then((cached) => {
        if (cached) return cached;
        // Fallback for navigations
        if (request.mode === 'navigate') {
          return caches.match('/');
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      });
    });
}

// Fetch: Network-first for HTML, JS, CSS (to pick up deploys fast)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip Supabase / API - always go to network (Dexie is source of truth locally)
  if (url.hostname.includes('supabase.co') ||
      url.pathname.includes('/api/') ||
      url.pathname.includes('/auth/')) {
    return;
  }

  // Network-first for critical updateable assets: HTML/nav, JS, CSS
  if (request.mode === 'navigate' ||
      request.destination === 'document' ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.startsWith('/_next/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache-first for long-lived statics (icons, images, fonts)
  if (url.pathname.includes('/icons/') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.jpg') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.woff') ||
      url.pathname.endsWith('.woff2')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => caches.match(request));
      })
    );
    return;
  }

  // Default: network first + cache
  event.respondWith(networkFirst(request));
});
