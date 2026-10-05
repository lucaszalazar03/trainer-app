import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Decide a dónde mandar a un usuario ya autenticado: coach → /dashboard,
 * alumno vinculado → /alumno, cualquier otro caso → login con aviso.
 */
export async function resolveHome(supabase: SupabaseServerClient, userId: string): Promise<string> {
  // Ambas consultas en paralelo — no dependen una de la otra, y en serie
  // duplican innecesariamente la latencia de red hacia la base.
  const [{ data: coach }, { data: student }] = await Promise.all([
    supabase.from("coaches").select("id").eq("id", userId).maybeSingle(),
    supabase.from("students").select("id").eq("user_id", userId).maybeSingle(),
  ]);

  if (coach) return "/dashboard";
  if (student) return "/alumno";

  // El alumno puede existir en la tabla "students" pero sin vincular todavía
  // (por ejemplo, si el coach lo cargó con el mail en mayúsculas, con
  // espacios, o recién después de que el alumno ya se había registrado).
  // Antes de mostrar el error, intentamos auto-vincularlo por email y
  // volvemos a chequear.
  await supabase.rpc("link_my_student_account");
  const { data: retried } = await supabase.from("students").select("id").eq("user_id", userId).maybeSingle();
  if (retried) return "/alumno";

  return `/login?error=${encodeURIComponent(
    "No encontramos tu cuenta todavía. Si sos alumno, pedile a tu coach que te cargue con este mismo email."
  )}`;
}
