"use server";

import webpush from "web-push";
import { requireUser } from "@/lib/actions/require-user";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const vapidReady = Boolean(
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
);

if (vapidReady) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:soporte@z-performance.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

// ---------- Suscripción del usuario actual (coach o alumno) ----------

export async function subscribeToPush(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) {
  const { supabase, user } = await requireUser();

  await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    { onConflict: "endpoint" }
  );
}

export async function unsubscribeFromPush(endpoint: string) {
  const { supabase } = await requireUser();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

// ---------- Enviar una notificación a otro usuario (coach → alumno o
// alumno → coach) ----------
//
// Se llama desde adentro de otras Server Actions ya autenticadas — usa la
// sesión de quien dispara la acción, y RLS en push_subscriptions permite
// que un coach lea las suscripciones de sus propios alumnos, y un alumno
// las de su propio coach (ver migración `add_push_subscriptions`).
//
// Nunca debe romper la acción que la llama: cualquier error de envío se
// ignora silenciosamente (a lo sumo se borra la suscripción si quedó
// vencida), la funcionalidad principal no depende de esto.

export async function sendPushToUser(
  supabase: SupabaseServerClient,
  userId: string,
  payload: { title: string; body: string; url?: string }
) {
  if (!vapidReady) return;

  try {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);

    if (!subs?.length) return;

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify(payload)
          );
        } catch (err) {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            // Suscripción vencida o revocada por el navegador — se borra.
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
      })
    );
  } catch {
    // No dejamos que un problema de notificaciones tumbe la acción real.
  }
}
