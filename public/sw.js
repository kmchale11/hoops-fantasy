// Hoops Fantasy service worker. Deliberately small:
//  - Game pages and API calls always go to the network, never a cache, so nothing stale shows.
//  - A page that can't load because there's no connection gets the cached offline screen.
//  - Push notifications and taps on them (see the push and notificationclick handlers).

const CACHE = "hoops-offline-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  // Only page loads are handled, and only when the network fails. Everything else, including
  // every API and data request, is left to the browser as if there were no service worker.
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()),
  );
});

// A notification from the server: { title, body, url, tag } (see src/notifications/web-push-sender.ts).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Not JSON: show nothing rather than a broken notification.
    return;
  }
  if (!data.title) return;
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url },
    }),
  );
});

// Tapping a notification opens its screen: the squad builder or round results. An open window
// of the app is reused; only paths on this site are opened.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data && event.notification.data.url;
  const url = new URL(typeof path === "string" && path.startsWith("/") && !path.startsWith("//") ? path : "/", self.location.origin);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === url.origin);
      // Navigate first: focusing can be refused, and the page should change either way.
      if (open) return open.navigate(url.href).then((w) => (w || open).focus()).catch(() => {});
      return self.clients.openWindow(url.href);
    }),
  );
});
