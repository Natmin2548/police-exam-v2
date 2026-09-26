const CACHE_NAME = "police-exam-v5";
const STATIC_ASSETS = [
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) {
            console.log("[SW] Deleting old cache:", k);
            return caches.delete(k);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 1. API routes: Network only (with offline fallback)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(event.request).catch(() => new Response(JSON.stringify({ error: "offline" }), {
        headers: { "Content-Type": "application/json" }
      }))
    );
    return;
  }

  // 2. Navigation requests (HTML pages like /home, /vocab, /archive, /):
  // ALWAYS Network-first to guarantee latest updates and features
  if (event.request.mode === "navigate" || event.request.destination === "document") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          return caches.match("/home") || caches.match("/");
        })
    );
    return;
  }

  // 3. Static assets: Stale-while-revalidate or Network-first
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
