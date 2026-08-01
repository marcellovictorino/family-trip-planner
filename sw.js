const CACHE = "trip-planner-v8";

const ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "src/app.js",
  "src/dom.js",
  "src/views/explore.js",
  "src/views/itinerary.js",
  "src/views/saved.js",
  "src/views/trip.js",
  "src/filter.js",
  "src/state.js",
  "data/copenhagen-2026.json",
  "design/tokens/colors.css",
  "design/tokens/fonts.css",
  "design/tokens/motion.css",
  "design/tokens/shape.css",
  "design/tokens/spacing.css",
  "design/tokens/typography.css",
  "assets/icons/app-icon-180.png",
  "assets/icons/app-icon-192.png",
  "assets/icons/app-icon-512.png",
  "assets/icons/app-icon-maskable-512.png",
  "assets/fonts/bricolage-grotesque-1.woff2",
  "assets/fonts/bricolage-grotesque-2.woff2",
  "assets/fonts/bricolage-grotesque-3.woff2",
  "assets/fonts/nunito-sans-1.woff2",
  "assets/fonts/nunito-sans-2.woff2",
  "assets/fonts/nunito-sans-3.woff2",
  "assets/fonts/nunito-sans-4.woff2",
  "assets/fonts/nunito-sans-5.woff2",
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
