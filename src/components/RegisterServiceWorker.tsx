"use client";

import { useEffect } from "react";

/**
 * Registra el service worker en cuanto carga la app — hace falta para que
 * el navegador la considere instalable (PWA) y para poder recibir Web Push.
 * No hace nada visible; se monta una sola vez desde el layout raíz.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Si falla (navegador viejo, contexto no seguro, etc.) la app
        // sigue funcionando normal como sitio web común.
      });
    }
  }, []);

  return null;
}
