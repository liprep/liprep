const CACHE_NAME = "liprep-core-v1";

const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/pwa-192x192.png",
  "/pwa-512x512.png",
  "/apple-touch-icon.png",
  "/desmos.html",
  "/liprep-logo.svg",
  "/hero-star.svg",
  "/hero-turd-blob.svg",
  "/bg-blob-orange.svg",
  "/bg-blob-purple.svg",
  "/ebrw-icon-1.svg",
  "/ebrw-icon-2.svg",
  "/math-icon-1.svg",
  "/math-icon-2.svg",
  "/reference/1.svg",
  "/reference/2.svg",
  "/reference/3.svg",
  "/reference/4.svg",
  "/reference/5.svg",
  "/reference/6.svg",
  "/reference/7.svg",
  "/reference/8.svg",
  "/reference/9.svg",
  "/reference/10.svg",
  "/reference/11.svg",
  "/reference/special-triangles.png",
  "https://www.desmos.com/api/v1.9/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6"
];

// Install: Precache all offline assets
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          fetch(url, { mode: url.startsWith("http") ? "cors" : "same-origin" })
            .then((res) => {
              if (res.ok || res.type === "opaque") {
                return cache.put(url, res);
              }
            })
            .catch((err) => console.warn(`[SW] Precache failed for ${url}:`, err))
        )
      );
    })
  );
});

// Activate: Clean up stale caches & claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Serve cache-first with network fallback
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // SPA navigation handling
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match("/index.html").then((cachedIndex) => {
          return cachedIndex || caches.match("/");
        });
      })
    );
    return;
  }

  if (request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (
            !networkResponse ||
            (networkResponse.status !== 200 && networkResponse.type !== "opaque")
          ) {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          if (request.destination === "image") {
            return caches.match("/pwa-192x192.png");
          }
          return new Response("Offline", { status: 503, statusText: "Offline" });
        });
    })
  );
});
