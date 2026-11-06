"use client";

import { useEffect } from "react";

// Enregistre le service worker (public/sw.js) pour la PWA et les notifications push.
// Seulement en production, pour ne pas garder de vieilles versions pendant le développement.
export function EnregistrementServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Pas grave : l'application marche aussi sans service worker
      });
  }, []);

  return null;
}
