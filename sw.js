const CACHE = "trip-planner-v10";

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

// cache.addAll() is atomic: one bad path (a 404, a momentary network blip) fails the
// whole call and leaves the cache empty, with no offline support at all and no error
// anyone would see. Cache each asset individually instead, so one bad path can't sink
// the rest, and log which ones failed so it's at least visible in devtools.
function cacheAssetsIndividually(cache) {
  return Promise.all(
    ASSETS.map((asset) =>
      cache.add(asset).catch((error) => console.error(`SW install: failed to cache "${asset}"`, error)),
    ),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then(cacheAssetsIndividually).then(() => self.skipWaiting()));
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
        // Guaranteed with waitUntil — without it, the browser is free to kill this
        // worker the instant respondWith's promise settles, before the write lands.
        event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)));
        return response;
      })
      .catch(() => caches.match(event.request).then((hit) => hit ?? caches.match("index.html"))),
  );
});
