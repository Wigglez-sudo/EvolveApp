/* Evolve service worker — v3.31 (network-first with offline fallback + in-app update flow).
   Bump CACHE whenever you change ANY of the shell files so old caches are cleared. */
const CACHE = "evolve-v3-48";
const SHELL = ["./", "./index.html", "./styles.css", "./data.js", "./app.js", "./manifest.json", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./favicon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})
    /* NOTE: no skipWaiting() here — the new worker waits until the user taps
       "Update" in the app, which posts SKIP_WAITING. This drives the banner. */
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* let the app trigger an immediate activation when the user taps "Update" */
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING" || (e.data && e.data.type === "SKIP_WAITING")) {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Same-origin app files: NETWORK-FIRST so a deployed update is picked up,
  // falling back to cache when offline (and to cached index for navigations).
  if (req.mode === "navigate" || url.origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match("./index.html"))
        )
    );
    return;
  }

  // Cross-origin (e.g. Google Fonts): network-first, fall back to cache.
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req))
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) { if ("focus" in w) return w.focus(); }
      if (clients.openWindow) return clients.openWindow("./");
    })
  );
});
