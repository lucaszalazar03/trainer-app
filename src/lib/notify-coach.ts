import webpush from "web-push";
import { getDirectSql } from "@/lib/db/direct";

/**
 * Notificación push al coach cuando un alumno nuevo se registra solo.
 *
 * NO es una Server Action (no lleva "use server"): sólo se llama desde
 * adentro de signUp en el servidor, así nadie puede dispararla desde el
 * navegador. Usa la conexión directa porque quien se está registrando
 * todavía no tiene sesión (no confirmó el mail), y por RLS no podría leer
 * las suscripciones del coach.
 *
 * Nunca rompe el registro: cualquier error se ignora.
 */
export async function notifyCoachNewStudent(nombre: string) {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return;

  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:soporte@z-performance.app", pub, priv);
    const sql = getDirectSql();
    const subs = await sql<{ id: string; endpoint: string; p256dh: string; auth: string }[]>`
      select ps.id, ps.endpoint, ps.p256dh, ps.auth
      from push_subscriptions ps
      where ps.user_id = (select id from coaches order by created_at limit 1)
    `;
    const payload = JSON.stringify({
      title: "Nuevo alumno registrado",
      body: `${nombre} creó su cuenta en Z-Performance.`,
      url: "/alumnos",
    });
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        } catch (err) {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await sql`delete from push_subscriptions where id = ${sub.id}`;
          }
        }
      })
    );
  } catch {
    // no crítico
  }
}
