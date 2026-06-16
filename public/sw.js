self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("tender-tracker-static-v1").then((cache) => cache.addAll(["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Tender Tracker";
  const options = {
    body: data.body || "Tender reminder due.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
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
