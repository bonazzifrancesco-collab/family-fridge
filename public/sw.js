/* Family Fridge service worker */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "Family Fridge", body: "Hai una novità", url: "/dashboard" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    try {
      data.body = event.data.text();
    } catch (_) {}
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Family Fridge", {
      body: data.body || "",
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: data.url || "/dashboard" },
      vibrate: [120, 60, 120],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
