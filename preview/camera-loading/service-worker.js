const CACHE_NAME = "dew-camera-loading-preview-v164";
const APP_FILES = [
  "./",
  "index.html",
  "styles.css?v=164",
  "app.js?v=164",
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
  "src/ui/camera-loader.js",
  "src/ui/readings.js",
  "src/ui/ruler.js",
  "src/ui/timer.js",
  "docs/timer-shortcut.html",
  "src/ui/dialogs.js",
  "src/ui/location.js",
  "src/ui/events.js",
  "src/ui/pull-refresh.js",
  "src/voice/parser.js",
  "src/voice/controller.js",
  "src/camera/controller.js",
  "src/camera/capture.js",
  "src/camera/device-session.js",
  "src/camera/still-photo.js",
  "src/camera/zoom-presets.js",
  "src/camera/labels.js",
  "src/camera/regions.js",
  "src/camera/help.js",
  "src/camera/readings.js",
  "src/camera/recognition.js",
  "src/camera/segments.js",
  "src/camera/detection.js",
  "src/camera/crop-editor.js",
  "src/camera/analysis.js",
  "src/camera/budget.js",
  "src/camera/cell-validator.js",
  "src/camera/orientation.js",
  "src/camera/current-row.js",
  "src/camera/row-context.js",
  "src/camera/evidence.js",
  "src/camera/geometry.js",
  "src/camera/image.js",
  "src/camera/units.js",
  "src/camera/worker.js",
  "manifest.webmanifest",
  "favicon.png",
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
      .then((keys) => Promise.all(keys.filter((key) =>
        (key.startsWith("dew-camera-loading-preview-v") && key !== CACHE_NAME)
      ).map((key) => caches.delete(key))))
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
