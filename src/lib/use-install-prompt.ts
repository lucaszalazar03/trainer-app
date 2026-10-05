"use client";

import { useEffect, useState } from "react";

// Evento que dispara Chrome/Android cuando la app cumple los requisitos de
// instalación (manifest + service worker + https). No está tipado en el DOM
// estándar de TypeScript, así que lo declaramos acá.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallKind = "android" | "ios" | null;

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Lógica compartida para ofrecer instalar la app a pantalla de inicio —
 * usada tanto por el cartel chico (InstallPrompt, visible en toda la app)
 * como por la pantalla grande de bienvenida (/bienvenida, pensada para
 * compartir como "link de descarga").
 *
 * - Android/Chrome: agarra el evento "beforeinstallprompt" — install()
 *   dispara el prompt nativo del navegador.
 * - iPhone/Safari: no existe un evento equivalente — kind="ios" avisa para
 *   que quien llama muestre el camino manual (Compartir → Agregar a inicio).
 * - Si la app ya está instalada (display-mode: standalone), o el navegador
 *   no ofrece ninguna de las dos vías (desktop, navegadores sin soporte),
 *   kind queda en null.
 * - `ready` pasa a true en cuanto terminamos de resolver cuál es el caso —
 *   antes de eso no sabemos todavía si Android va a ofrecer el evento, así
 *   que quien llama puede mostrar un estado de carga breve en vez de asumir
 *   de entrada que no hay instalación posible.
 */
export function useInstallPrompt() {
  const [kind, setKind] = useState<InstallKind>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [ready, setReady] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Lee capacidades del navegador (standalone / user-agent) que no existen
    // durante el render en el servidor, así que sólo pueden resolverse acá.
    if (isStandalone()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReady(true);
      return;
    }

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (isIOS) {
      setKind("ios");
      setReady(true);
      return;
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setKind("android");
      setReady(true);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    // Si el evento nunca llega (la app ya está instalada, o el navegador no
    // lo soporta — Firefox, desktop, etc.) no nos quedamos esperando para
    // siempre: después de un rato asumimos que no hay instalación posible.
    const timer = setTimeout(() => setReady(true), 1200);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      clearTimeout(timer);
    };
  }, []);

  async function install() {
    if (!deferredPrompt) return null;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      return choice.outcome;
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
      setKind(null);
    }
  }

  return { kind, ready, installing, install };
}
