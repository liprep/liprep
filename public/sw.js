// LiPrep offline-first Service Worker.
//
// Cache layout (v7+):
// - SHELL_CACHE ("liprep-shell-vN"): versioned app shell listed in
//   PRECACHE_ASSETS. Evicted on activate when the version bumps.
// - RUNTIME_CACHE ("liprep-runtime-v1"): UNVERSIONED and never evicted on
//   activate. Holds hashed Vite bundles (/assets/*), runtime-fetched fonts,
//   remote question images, and the Desmos CDN fallback. This split fixes two
//   offline bugs: (1) an update no longer deletes bundles the running page
//   still needs, (2) runtime-cached images survive updates.
//
// Single source of truth: src/components/AppLoader.tsx discovers SHELL_CACHE
// by fetching this file and parsing the SHELL_CACHE constant, so bump the
// version here only.

const SHELL_CACHE = "liprep-shell-v7";
const RUNTIME_CACHE = "liprep-runtime-v1";
// Backwards compat: releases <= v4 used a single "liprep-core-vN" cache.
const LEGACY_CACHE_PREFIX = "liprep-core-";
const SHELL_CACHE_PREFIX = "liprep-shell-";

// Same-origin only. No remote URLs here: precaching a third-party URL makes
// first install (and every update) depend on the network + that third party.
// Remote fallbacks (e.g. Desmos CDN) are attempted at runtime, not install.
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.svg",
  "/icons.svg",
  "/liprep-logo.svg",
  "/pwa-192x192.png",
  "/pwa-512x512.png",
  "/apple-touch-icon.png",
  "/desmos.html",
  "/desmos-calculator.js",
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
  "/fonts/ibm-plex-sans-400.woff2",
  "/fonts/ibm-plex-sans-500.woff2",
  "/fonts/ibm-plex-sans-600.woff2",
  "/fonts/ibm-plex-sans-700.woff2",
  "/fonts/ibm-plex-sans-400-italic.woff2",
  "/fonts/ibm-plex-mono-600.woff2",
  "/fonts/ibm-plex-mono-700.woff2",
  "/fonts/stix-two-math-400.woff2",
];

// Never serve API responses from cache: testimonies must be fresh, and a
// cached error/empty response would poison offline UX.
function isApiRequest(url) {
  try {
    return new URL(url, self.location.origin).pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

function isCacheableRequest(request) {
  try {
    const url = new URL(request.url);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Cacheable responses: normal ok responses (same-origin AND cross-origin
// CORS, e.g. Desmos CDN fallback or remote question images) plus opaque
// no-cors responses (e.g. <img> tags). Opaque responses have status 0, so
// `ok` alone is not enough — check the type explicitly.
function isCacheableResponse(response, isSameOrigin) {
  if (!response) return false;
  if (response.type === "opaque") return true;
  if (response.ok) return true;
  // Defensive: some browsers report cross-origin CORS hits as basic with 200.
  void isSameOrigin;
  return false;
}

// Install: precache the offline shell into the versioned shell cache.
// Individual failures must not fail the whole install — a missing decorative
// asset is not a broken app.
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          fetch(url, { mode: "same-origin" })
            .then((res) => {
              if (res.ok) {
                return cache.put(url, res);
              }
              console.warn(`[SW] Precache skipped (status ${res.status}): ${url}`);
            })
            .catch((err) => console.warn(`[SW] Precache failed for ${url}:`, err))
        )
      );
    })
  );
});

// Allow pages to trigger activation explicitly if we ever drop skipWaiting.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Activate: evict stale SHELL caches (current + legacy liprep-core-*), but
// NEVER delete RUNTIME_CACHE — it holds hashed bundles and images the running
// page and future offline sessions still need. IndexedDB + localStorage are
// untouched by this worker.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key === SHELL_CACHE || key === RUNTIME_CACHE) return Promise.resolve(false);
            if (key.startsWith(SHELL_CACHE_PREFIX) || key.startsWith(LEGACY_CACHE_PREFIX)) {
              return caches.delete(key);
            }
            return Promise.resolve(false);
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

async function matchShellOrRuntime(request) {
  const shellMatch = await caches.match(request, { cacheName: SHELL_CACHE });
  if (shellMatch) return shellMatch;
  return caches.match(request, { cacheName: RUNTIME_CACHE });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  if (!isCacheableRequest(request)) {
    return;
  }

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  // Navigations the app doesn't own (external links) are left to the browser.
  if (request.mode === "navigate" && !isSameOrigin) {
    return;
  }

  // Real static documents loaded by navigation — the /desmos.html calculator
  // iframe is a nested navigation — must be served as themselves, never
  // routed through the SPA shell below (that would swap the calculator for
  // index.html) and never stored under the "/index.html" key.
  if (request.mode === "navigate" && /\.html$/.test(url.pathname) && url.pathname !== "/index.html") {
    event.respondWith(
      matchShellOrRuntime(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              const copy = networkResponse.clone();
              caches.open(SHELL_CACHE).then((cache) => {
                cache.put(request, copy).catch(() => {
                  // Quota failure: serve the network response anyway.
                });
              });
            }
            return networkResponse;
          })
          .catch(() => new Response("Offline", { status: 503, statusText: "Offline" }));
      })
    );
    return;
  }

  // SPA navigations: cache-first so the app opens instantly with zero
  // internet. Refresh the cached shell in the background when online.
  if (request.mode === "navigate") {
    event.respondWith(
      caches
        .match("/index.html", { cacheName: SHELL_CACHE })
        .then(async (cachedIndex) => {
          const networkUpdate = fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.ok && !isApiRequest(request.url)) {
                const copy = networkResponse.clone();
                caches.open(SHELL_CACHE).then((cache) => {
                  cache.put("/index.html", copy);
                });
              }
              return networkResponse;
            })
            .catch(() => cachedIndex);

          if (cachedIndex) return cachedIndex;
          // No cached shell yet (very first load): try runtime cache, then network.
          const runtimeIndex = await caches.match("/index.html", { cacheName: RUNTIME_CACHE });
          return runtimeIndex || networkUpdate;
        })
    );
    return;
  }

  // API reads always go to the network; offline they fail fast so the UI can
  // fall back to its localStorage cache (see WallOfLoveModal).
  if (isApiRequest(request.url)) {
    return;
  }

  // Everything else (hashed Vite bundles in /assets/*, images, fonts,
  // Desmos CDN fallback): cache-first with network fallback. The runtime
  // cache is what keeps the app working offline even though hashed filenames
  // can't be listed at precache time, and it now accepts cross-origin CORS
  // responses too (remote question images, CDN scripts).
  event.respondWith(
    matchShellOrRuntime(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (networkResponse && isCacheableResponse(networkResponse, isSameOrigin)) {
            const responseToCache = networkResponse.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseToCache).catch(() => {
                // Quota or opaque-put failure: serve the network response anyway.
              });
            });
          }
          return networkResponse;
        })
        .catch(() => {
          if (request.destination === "image") {
            return caches.match("/pwa-192x192.png", { cacheName: SHELL_CACHE });
          }
          return new Response("Offline", { status: 503, statusText: "Offline" });
        });
    })
  );
});
