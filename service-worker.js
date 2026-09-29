const CACHE_NAME = "is-it-dryer-out-v137";
const APP_FILES = [
  "./",
  "index.html",
  "styles.css?v=137",
  "app.js?v=137",
  "src/config.js",
  "src/domain/humidity.js",
  "src/domain/forecast.js",
  "src/domain/ventilation.js",
  "src/services/storage.js",
  "src/services/geocoding.js",
  "src/services/weather.js",
  "src/ui/format.js",
  "src/ui/recommendation.js",
  "src/ui/dashboard.js",
  "src/ui/chart.js",
  "src/ui/readings.js",
  "src/ui/dialogs.js",
  "src/ui/location.js",
  "src/ui/events.js",
  "src/ui/pull-refresh.js",
  "src/voice/parser.js",
  "src/voice/controller.js",
  "manifest.webmanifest",
  "favicon-v4.png",
];

self.addEventListener("install", (event) => {
  // Refresh stable module URLs from the server when installing a new shell.
  const requests = APP_FILES.map((file) => new Request(new URL(file, self.location).href, { cache: "reload" }));
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(requests)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("is-it-dryer-out-v") && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      if (cached) return cached;
      // Only navigations may receive HTML; missing modules must fail as resources.
      if (event.request.mode === "navigate") return (await cache.match("./")) || Response.error();
      return Response.error();
    }),
  );
});
