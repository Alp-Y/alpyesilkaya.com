// Offline support. The build fills in VERSION and FILES.
const VERSION = "4d2e6b49e1";
const FILES = ["./","index.html","config.js","cloud.js","manifest.webmanifest","world.js","land.js","country.js","facts.js","cities.js","stickers.js","more-scenes.js","home-countries.js","spots.js","boost.js","vendor/d3.min.js","vendor/supabase.js","icons/icon-180.png","icons/icon-192.png","icons/icon-512.png"];
const CACHE = `planner-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (url.origin !== location.origin && !isFont) return;   // Supabase always goes to the network

  /* pages: newest when online, saved copy when not */
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("./index.html")));
    return;
  }
  /* everything else: saved copy first, and keep what we fetch (province files, fonts) */
  event.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).then((res) => {
      if (res.ok || res.type === "opaque") {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
      }
      return res;
    }))
  );
});
