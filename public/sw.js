// Kill-switch service worker.
// Replaces the previous app-shell SW so returning visitors evict the old
// registration + its caches exactly once, then run fully network-based.
function isAppCache(name) {
  return (
    /(^|-)precache-v\d+-/.test(name) ||
    /(^|-)runtime-/.test(name) ||
    name === "html-cache" ||
    name.startsWith("workbox-")
  );
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        await Promise.allSettled(
          names.filter(isAppCache).map((n) => caches.delete(n))
        );
        await self.clients.claim();
        const wins = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(wins.map((c) => c.navigate(c.url)));
      } finally {
        await self.registration.unregister();
      }
    })()
  )
);