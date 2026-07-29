// ELWORK Service Worker — offline cache
const APP_VERSION = '1.0';
const CACHE_NAME = 'elwork-' + APP_VERSION.replace('.', '') + '-2026072800';

// Odpovedaj na žiadosť o verziu
self.addEventListener('message', event => {
  if (event.data?.type === 'GET_VERSION') {
    event.source.postMessage({type: 'VERSION', version: APP_VERSION});
  }
});

// Súbory ktoré sa uložia do cache pri prvom načítaní
const CACHE_FILES = [
  '/klimaservis/',
  '/klimaservis/index.html',
  '/klimaservis/logo.jpg',
  '/klimaservis/peciatka.jpg',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Syne:wght@700;800&display=swap'
];

// Inštalácia — stiahni a cachuj všetky súbory
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CACHE_FILES).catch(err => {
        console.warn('Cache addAll partial fail:', err);
      });
    })
  );
  self.skipWaiting();
});

// Aktivácia — vymaž staré cache
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — najprv cache, potom sieť (offline-first pre app súbory)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // GAS API volania — vždy cez sieť, nikdy cacheovať
  if (url.hostname === 'script.google.com') {
    event.respondWith(fetch(event.request).catch(() =>
      new Response(JSON.stringify({ok: false, error: 'Bez internetu — protokol bude uložený lokálne'}),
        {headers: {'Content-Type': 'application/json'}})
    ));
    return;
  }

  // Fonty a externé CDN — cache first
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return res;
      }).catch(() => new Response('', {status: 503})))
    );
    return;
  }

  // Aplikačné súbory — cache first, sieť ako záloha
  if (url.hostname === 'janlestinsky.github.io') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        // Vráť z cache hneď, zároveň aktualizuj na pozadí
        const fetchPromise = fetch(event.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return res;
        }).catch(() => null);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // Ostatné — štandardné správanie
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
