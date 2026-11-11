// Day 20 service worker: offline shell + reminder notifications.
const SHELL = ["/", "/styles.css", "/app.js", "/i18n.js", "/icon.svg"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open("d20-v1").then((c) => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.pathname.startsWith("/api/") || u.pathname.startsWith("/auth/")) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request).then((r) => r || caches.match("/"))));
});
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data.json(); } catch { d = { title: "Day 20", body: e.data?.text() || "" }; }
  // Silent by default: no vibration, no sound beyond the system default.
  e.waitUntil(self.registration.showNotification(d.title || "Day 20", { body: d.body || "", icon: "/icon-192.png", badge: "/icon-192.png", silent: true, tag: "day20" }));
});
self.addEventListener("notificationclick", (e) => { e.notification.close(); e.waitUntil(self.clients.openWindow("/")); });
