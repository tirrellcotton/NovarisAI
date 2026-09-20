const cacheName = "novaris-shell-v1";
const appShell = [
    "/",
    "/offline.html",
    "/manifest.webmanifest",
    "/favicon.png",
    "/css/site.css",
    "/js/site.js",
    "/js/modules/dom.js",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/icons/icon-192-maskable.png",
    "/icons/icon-512-maskable.png"
];

self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(appShell)));
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => Promise.all(
            cacheNames
                .filter((name) => name.startsWith("novaris-") && name !== cacheName)
                .map((name) => caches.delete(name))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener("message", (event) => {
    if (event.data?.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

self.addEventListener("fetch", (event) => {
    const { request } = event;
    const requestUrl = new URL(request.url);

    if (request.method !== "GET" || requestUrl.origin !== self.location.origin) {
        return;
    }

    if (request.mode === "navigate") {
        event.respondWith(networkNavigation(request));
        return;
    }

    if (isStaticAsset(requestUrl.pathname)) {
        event.respondWith(cacheFirst(request));
    }
});

async function networkNavigation(request) {
    try {
        return await fetch(request);
    } catch {
        return (await caches.match("/offline.html")) ?? Response.error();
    }
}

async function cacheFirst(request) {
    const cachedResponse = await caches.match(request, { ignoreSearch: true });

    if (cachedResponse !== undefined) {
        return cachedResponse;
    }

    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
        const cache = await caches.open(cacheName);
        cache.put(request, networkResponse.clone());
    }

    return networkResponse;
}

function isStaticAsset(pathname) {
    return pathname.startsWith("/css/")
        || pathname.startsWith("/js/")
        || pathname.startsWith("/icons/")
        || pathname === "/favicon.png"
        || pathname === "/favicon.ico"
        || pathname === "/manifest.webmanifest";
}
