// CaseLog PWA Service Worker
// Enhanced for Next.js App Router + full offline on iOS
// Caches app shell and static assets for instant offline load.
// Data handled by Dexie (local IndexedDB) + sync queue.

const CACHE_NAME = 'caselog-v2';
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install: Cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate: Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch handler: Smart caching for offline
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Skip Supabase API calls - let Dexie handle data, sync when online
  if (url.hostname.includes('supabase.co') || url.pathname.includes('/auth/')) {
    return; // Let network handle, app falls back to local Dexie
  }

  // For Next.js static assets (_next/static) - cache first
  if (url.pathname.startsWith('/_next/static/') || 
      url.pathname.endsWith('.js') || 
      url.pathname.endsWith('.css') || 
      url.pathname.endsWith('.png') || 
      url.pathname.endsWith('.jpg') ||
      url.pathname.includes('/icons/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        });
      })
    );
    return;
  }

  // For navigation / app shell - network first, fallback to cache for offline
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname.startsWith('/cases') || url.pathname.startsWith('/billing')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('/');
          });
        })
    );
    return;
  }

  // Default: network first, cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          if (response.ok) cache.put(request, responseClone);
        });
        return response;
      })
      .catch(() => caches.match(request))
  );
});
