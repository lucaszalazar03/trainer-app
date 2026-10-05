"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { ensurePushSubscription } from "./NotificationsOptIn";
import { sendTestPush } from "@/lib/actions/push";

/**
 * Tarjeta en Configuración para probar las notificaciones en ESTE
 * dispositivo: pide permiso si hace falta, guarda la suscripción y manda
 * una notificación de prueba, explicando en criollo qué falló si no llega.
 */
export function PushTestCard() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function probar() {
    setBusy(true);
    setMsg(null);
    try {
      const ua = navigator.userAgent;
      const isIOS = /iphone|ipad|ipod/i.test(ua);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true;

      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setMsg({
          ok: false,
          text: isIOS && !standalone
            ? "En iPhone las notificaciones sólo funcionan con la app instalada. Agregala a inicio (Compartir → Agregar a inicio) y abrila desde el ícono."
            : "Este navegador no permite notificaciones. Probá desde la app instalada en tu celular.",
        });
        return;
      }

      const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      if (permission !== "granted") {
        setMsg({
          ok: false,
          text: isIOS
            ? "Las notificaciones están bloqueadas. Activalas en Ajustes del iPhone → Notificaciones → Z-Performance."
            : "Las notificaciones están bloqueadas. Activalas en los ajustes del celular → Apps → Chrome/Z-Performance → Notificaciones.",
        });
        return;
      }

      const saved = await ensurePushSubscription();
      if (!saved) {
        setMsg({ ok: false, text: "No se pudo registrar este dispositivo. Cerrá la app del todo, volvé a abrirla y probá de nuevo." });
        return;
      }

      const r = await sendTestPush();
      if (!r.configured) {
        setMsg({ ok: false, text: "Falta configurar las claves de notificaciones en el servidor (VAPID). Avisale a soporte." });
      } else if (r.sent > 0) {
        setMsg({ ok: true, text: `Notificación enviada. Te tendría que llegar en unos segundos. (${r.sent} de ${r.subscriptions} dispositivos)` });
      } else {
        setMsg({ ok: false, text: `No se pudo enviar. Detalle técnico: ${r.errors.join(" | ") || "sin dispositivos registrados"}` });
      }
    } catch (e) {
      setMsg({ ok: false, text: `Error: ${(e as Error)?.message ?? "desconocido"}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card card-pad" style={{ marginBottom: 20 }}>
      <div className="section-h" style={{ marginTop: 0 }}>
        <h3>Notificaciones</h3>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--text-dim)", margin: "0 0 12px" }}>
        Activá y probá los avisos en este dispositivo (check-ins, entrenamientos terminados y alumnos nuevos).
      </p>
      {msg && <div className={`banner ${msg.ok ? "success" : "danger"}`}>{msg.text}</div>}
      <button type="button" className="btn primary" onClick={probar} disabled={busy}>
        <Icon name="bell" size={14} />
        {busy ? "Probando…" : "Activar y enviar prueba"}
      </button>
    </div>
  );
}
