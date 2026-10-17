self.addEventListener("install", (event) => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => Promise.all(
            cacheNames
                .filter((name) => name.startsWith("novaris-"))
                .map((name) => caches.delete(name))
        )).then(() => self.registration.unregister())
    );
});
