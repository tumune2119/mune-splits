// Minimal service worker for the installable PWA. It deliberately has no fetch handler and no cache:
// everything comes from the local server, so there is never stale data to serve.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
