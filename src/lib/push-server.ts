import webpush from "web-push";
import { getDirectSql } from "@/lib/db/direct";

/**
 * Envío de notificaciones push, SÓLO del lado del servidor.
 *
 * Importante: este archivo NO lleva "use server" a propósito. Una función
 * exportada desde un archivo "use server" queda expuesta como endpoint
 * público (cualquiera podría llamarla desde el navegador y mandarle
 * notificaciones a quien quiera). Esto sólo se importa desde otras
 * acciones que ya verificaron quién es el usuario.
 *
 * Usa la conexión directa a Postgres (no la API REST de Supabase, que se
 * cortaba por timeout y hacía que el aviso no saliera nunca, sin dejar
 * rastro) y registra en los logs de Vercel cualquier falla.
 */
export type PushResult = {
  configured: boolean;
  subscriptions: number;
  sent: number;
  errors: string[];
};

type Payload = { title: string; body: string; url?: string };

let vapidSet = false;
function ensureVapid(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!vapidSet) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:soporte@z-performance.app", pub, priv);
    vapidSet = true;
  }
  return true;
}

export async function sendPush(userId: string, payload: Payload): Promise<PushResult> {
  const result: PushResult = { configured: false, subscriptions: 0, sent: 0, errors: [] };
  try {
    if (!ensureVapid()) {
      console.error("[push] Faltan NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY en el servidor");
      return result;
    }
    result.configured = true;

    const sql = getDirectSql();
    const subs = await sql<{ id: string; endpoint: string; p256dh: string; auth: string }[]>`
      select id, endpoint, p256dh, auth from push_subscriptions where user_id = ${userId}
    `;
    result.subscriptions = subs.length;

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify(payload),
            { TTL: 60 * 60 * 24 }
          );
          result.sent++;
        } catch (err) {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          const body = String((err as { body?: string })?.body ?? (err as Error)?.message ?? "").slice(0, 200);
          result.errors.push(`${statusCode ?? "?"} ${body}`.trim());
          console.error("[push] fallo al enviar", { userId, statusCode, body, host: new URL(sub.endpoint).host });
          // 404/410: la suscripción venció. 403: se generó con otras claves
          // VAPID — tampoco va a volver a funcionar. En los tres casos se
          // borra; el celular se vuelve a suscribir solo al abrir la app.
          if (statusCode === 404 || statusCode === 410 || statusCode === 403) {
            await sql`delete from push_subscriptions where id = ${sub.id}`;
          }
        }
      })
    );
  } catch (err) {
    result.errors.push((err as Error)?.message ?? "error");
    console.error("[push] error general", err);
  }
  return result;
}

/** Compatibilidad con las llamadas existentes (el primer parámetro ya no se usa). */
export async function sendPushToUser(_supabase: unknown, userId: string, payload: Payload) {
  await sendPush(userId, payload);
}
