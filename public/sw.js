// Service worker de Z-Performance.
//
// Objetivo mínimo y a propósito: sólo lo necesario para que la app sea
// instalable como PWA y pueda recibir Web Push — no cachea datos de la app
// (no hay requisito de uso offline), así que nunca sirve contenido viejo
// por accidente.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = { title: "Z-Performance", body: "" };
  try {
    payload = event.data.json();
  } catch {
    payload.body = event.data.text();
  }

  const { title, body, url } = payload;

  event.waitUntil(
    self.registration.showNotification(title || "Z-Performance", {
      body: body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(targetUrl) && "focus" in client) return client.focus();
      }
      if (clients.length > 0 && "focus" in clients[0]) {
        clients[0].navigate(targetUrl);
        return clients[0].focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
