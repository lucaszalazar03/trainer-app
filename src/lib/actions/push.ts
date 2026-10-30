"use server";

import { requireUser } from "@/lib/actions/require-user";
import { getDirectSql } from "@/lib/db/direct";
import { sendPush } from "@/lib/push-server";

// ---------- Suscripción del usuario actual (coach o alumno) ----------

export async function subscribeToPush(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) {
  const { user } = await requireUser();
  // Conexión directa (la API REST se cortaba por timeout y la suscripción
  // podía no guardarse sin que nadie se entere).
  // Único por (usuario, celular): un mismo celular puede recibir avisos de
  // varias cuentas (por ejemplo, el coach que también entra como alumno).
  // Antes era único por celular y activar en una cuenta se lo sacaba a la otra.
  const sql = getDirectSql();
  await sql`
    insert into push_subscriptions (user_id, endpoint, p256dh, auth)
    values (${user.id}, ${subscription.endpoint}, ${subscription.keys.p256dh}, ${subscription.keys.auth})
    on conflict (user_id, endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth
  `;
  return { ok: true };
}

export async function unsubscribeFromPush(endpoint: string) {
  const { user } = await requireUser();
  const sql = getDirectSql();
  await sql`delete from push_subscriptions where endpoint = ${endpoint} and user_id = ${user.id}`;
}

// ---------- Prueba de notificaciones (botón en Configuración) ----------
// Manda una notificación de prueba SÓLO al propio usuario logueado y
// devuelve qué pasó, para poder diagnosticar sin adivinar.
export async function sendTestPush() {
  const { user } = await requireUser();
  return sendPush(user.id, {
    title: "Notificación de prueba",
    body: "Si ves esto, las notificaciones de Z-Performance funcionan.",
    url: "/configuracion",
  });
}
