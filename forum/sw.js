const CACHE_NAME = "najua-forum-v2";
const APP_SHELL = [
  "/forum/",
  "/forum/manifest.webmanifest",
  "/forum/icons/icon-192.png",
  "/forum/icons/icon-512.png",
  "/forum/icons/icon-512-maskable.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith("najua-forum-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith("/forum/")
  ) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          return (await caches.match(request)) ||
                 (await caches.match("/forum/"));
        })
    );
    return;
  }

  if (["style", "script", "image", "font"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        });
      })
    );
  }
});

self.addEventListener("push", event => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      body: event.data ? event.data.text() : "There is a new forum update."
    };
  }

  const title = typeof payload.title === "string"
    ? payload.title
    : "New reply on Najua Tech";

  const options = {
    body: typeof payload.body === "string"
      ? payload.body
      : "Someone replied to a discussion.",
    icon: "/forum/icons/icon-192.png",
    badge: "/forum/icons/icon-192.png",
    tag: "najua-forum-reply",
    data: {
      url: typeof payload.url === "string" ? payload.url : "/forum/"
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  const target = new URL(
    event.notification.data?.url || "/forum/",
    self.location.origin
  );

  if (
    target.origin !== self.location.origin ||
    !target.pathname.startsWith("/forum/")
  ) {
    target.href = new URL("/forum/", self.location.origin).href;
  }

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });

    for (const client of windows) {
      if ("focus" in client) {
        await client.focus();

        if ("navigate" in client && client.url !== target.href) {
          await client.navigate(target.href);
        }

        return;
      }
    }

    await self.clients.openWindow(target.href);
  })());
});
