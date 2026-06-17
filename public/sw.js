self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("tender-tracker-static-v3").then((cache) =>
      cache.addAll(["/offline", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/icon"])
    )
  );
  self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          event.waitUntil(caches.open("tender-tracker-static-v3").then((cache) => cache.put(event.request, copy)));
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(event.request);
          return cachedPage || caches.match("/offline");
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => caches.match("/offline"));
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== "tender-tracker-static-v3").map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Tender Tracker";
  const options = {
    body: data.body || "Tender reminder due.",
    icon: "/icon-192.png",
    badge: "/icon",
    tag: data.title,
    renotify: true,
    data: { url: data.url || "/" }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
