import type { createClient } from "./server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Resuelve el usuario logueado.
 *
 * OJO: esto usaba getClaims() (verificación local del JWT, sin red) para
 * ganar velocidad, con el mismo criterio que el proxy (middleware.ts). En
 * la práctica, llamado desde una Server Action en el runtime de Vercel
 * (Node.js, no Edge), se quedaba colgado — los campos de series/reps
 * quedaban en "Guardando…" para siempre porque el await nunca resolvía.
 * En el middleware (Edge) nunca dio ese problema, pero acá sí, así que
 * se volvió a getUser(): siempre pega contra el servidor de Auth (un
 * viaje de red más), pero resuelve. Correcto y que funcione siempre gana
 * por sobre rápido y que se cuelgue.
 */
export async function getVerifiedUser(
  supabase: SupabaseServerClient
): Promise<{ id: string; email: string | null } | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}
