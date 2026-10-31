/* Conventional Hymns — offline support.
   When you change app files, bump the ?v= numbers in index.html
   and here, and change CACHE, so phones pick up the new version. */
const CACHE = "ch-v5";
const CORE = [
  "./",
  "index.html",
  "styles.css?v=5",
  "songs.js?v=5",
  "pronounce.js?v=5",
  "app.js?v=5",
  "icon.svg",
  "manifest.webmanifest"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;

  // Pages: try the network first so updates show up, fall back to the saved copy offline.
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("index.html", copy));
          return res;
        })
        .catch(() => caches.match("index.html"))
    );
    return;
  }

  // Everything else (versioned files, fonts): saved copy first, refreshed in the background.
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request);
      const fresh = fetch(e.request)
        .then((res) => {
          if (res && (res.ok || res.type === "opaque")) cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});
