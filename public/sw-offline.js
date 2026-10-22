// Service worker for the web app (GitHub Pages / "Add to Home Screen"): caches every file of the app on
// install so it opens and works with no connection. Your data never goes through here: it lives in this
// device's IndexedDB. A new deploy ships a new precache.json version, which replaces the old cache.
const scope = new URL(self.registration.scope).pathname.replace(/\/$/, "");

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const { version, urls } = await (await fetch(`${scope}/precache.json`, { cache: "no-store" })).json();
      const cache = await caches.open(`mune-splits-${version}`);
      await cache.addAll(urls);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const current = await fetch(`${scope}/precache.json`, { cache: "no-store" })
        .then((r) => r.json())
        .then((p) => `mune-splits-${p.version}`)
        .catch(() => null);
      if (current) for (const key of await caches.keys()) if (key !== current) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

// Cache first (the app is versioned as a whole); pages fall back to the cached app shell when offline.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const url = new URL(req.url);
      // Static files never vary by query string (?id=…, ?_rsc=…).
      const hit = (await caches.match(req, { ignoreSearch: true })) ?? (await caches.match(url.pathname));
      if (hit) return hit;
      try {
        return await fetch(req);
      } catch (err) {
        if (req.mode === "navigate") {
          const page = (await caches.match(url.pathname.replace(/\/$/, ""))) ?? (await caches.match(`${scope}/`));
          if (page) return page;
        }
        throw err;
      }
    })(),
  );
});
