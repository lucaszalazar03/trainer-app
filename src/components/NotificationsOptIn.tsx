"use client";

import { useEffect, useState } from "react";
import { subscribeToPush } from "@/lib/actions/push";
import { Icon } from "./Icon";

type Status = "loading" | "unsupported" | "ios-not-installed" | "default" | "granted" | "denied";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/**
 * Banner chico para activar Web Push. Se auto-oculta apenas ya está
 * activado, no soportado, o el usuario lo bloqueó — sólo aparece cuando
 * hay algo que el usuario puede hacer.
 */
// Detecta soporte del navegador de una sola vez al montar — no es estado
// que dependa de props/estado de React, así que se calcula acá afuera en
// vez de derivarlo en el cuerpo del componente.
function detectStatus(): Status {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return "unsupported";
  }

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;

  if (isIOS && !isStandalone) return "ios-not-installed";

  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return "default";
}

export function NotificationsOptIn() {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Sólo corre una vez al montar, en el cliente: lee capacidades del
    // navegador (Notification/PushManager/standalone) que no existen
    // durante el render en el servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus(detectStatus());
  }, []);

  async function activar() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      setStatus("unsupported");
      return;
    }

    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "default");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
        await subscribeToPush({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        });
      }

      setStatus("granted");
    } catch {
      // Si algo falla (permiso denegado a mitad de camino, red, etc.) la
      // app sigue funcionando igual, sólo no queda activada la notificación.
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading" || status === "unsupported" || status === "granted" || status === "denied") {
    return null;
  }

  // El cartel de "agregá esta app a tu pantalla de inicio" ahora lo muestra
  // InstallPrompt (en el layout raíz, visible incluso antes de loguearse) —
  // evitamos duplicarlo acá.
  if (status === "ios-not-installed") {
    return null;
  }

  return (
    <button type="button" className="notif-banner notif-banner-btn" onClick={activar} disabled={busy}>
      <Icon name="bell" size={14} />
      {busy ? "Activando…" : "Activar notificaciones"}
    </button>
  );
}
