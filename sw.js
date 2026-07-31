const CACHE = "trip-planner-v4";

const ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "src/app.js",
  "src/dom.js",
  "src/views/explore.js",
  "src/views/itinerary.js",
  "src/filter.js",
  "src/state.js",
  "data/copenhagen-2026.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network-first so a deployed change is picked up when online, falling back to
// the cache when offline. Every successful response refreshes the cache.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((hit) => hit ?? caches.match("index.html"))),
  );
});
