import { createClient } from "@/lib/supabase/server";
import { asUser } from "@/lib/db/as-user";
import { createDirectClient } from "@/lib/db/direct-client";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Decide a dónde mandar a un usuario ya autenticado: coach → /dashboard,
 * alumno vinculado → /alumno, cualquier otro caso → login con aviso.
 */
export async function resolveHome(supabase: SupabaseServerClient, userId: string): Promise<string> {
  // Ambas consultas en paralelo — no dependen una de la otra, y en serie
  // duplican innecesariamente la latencia de red hacia la base.
  // Conexión directa (la API REST se cortaba por timeout y mandaba al
  // usuario al login con un error falso).
  const [[coach], [student]] = await asUser(userId, (sql) =>
    Promise.all([
      sql<{ id: string }[]>`select id from coaches where id = ${userId} limit 1`,
      sql<{ id: string }[]>`select id from students where user_id = ${userId} limit 1`,
    ])
  );

  if (coach) return "/dashboard";
  if (student) return "/alumno";

  // El alumno puede existir en la tabla "students" pero sin vincular todavía
  // (por ejemplo, si el coach lo cargó con el mail en mayúsculas, con
  // espacios, o recién después de que el alumno ya se había registrado).
  // Antes de mostrar el error, intentamos auto-vincularlo por email y
  // volvemos a chequear.
  await createDirectClient(userId).rpc("link_my_student_account");
  const [retried] = await asUser(userId, (sql) => sql<{ id: string }[]>`select id from students where user_id = ${userId} limit 1`);
  if (retried) return "/alumno";

  return `/login?error=${encodeURIComponent(
    "No pudimos encontrar tu ficha de alumno. Escribile a tu coach para que lo revise."
  )}`;
}
