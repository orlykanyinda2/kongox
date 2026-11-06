// Service worker de KongoX.
// Pour l'instant : installation de la PWA et réception des notifications push.
// Pas de cache hors ligne (pour éviter d'afficher des pourcentages périmés).

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Notification push reçue : { titre, texte, url }
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let donnees = {};
  try {
    donnees = event.data.json();
  } catch {
    donnees = { texte: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(donnees.titre || "KongoX", {
      body: donnees.texte || "",
      icon: "/icones/icone-192.png",
      badge: "/icones/badge-96.png",
      data: { url: donnees.url || "/" },
    })
  );
});

// Clic sur la notification : ouvre la page liée (même site uniquement)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const cible = new URL(event.notification.data?.url || "/", self.location.origin);
  if (cible.origin !== self.location.origin) return;
  event.waitUntil(self.clients.openWindow(cible.href));
});
