import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUser } from "@/lib/supabase/verified-user";
import { asUser } from "@/lib/db/as-user";
import { makeHybridClient } from "@/lib/db/hybrid-client";

/**
 * Toda pantalla/acción del área del alumno arranca llamando esto.
 * RLS es la barrera real (user_id = auth.uid()), esto además resuelve
 * el registro de alumno vinculado a la sesión actual.
 */
export async function requireStudent() {
  const supabase = await createClient();
  const user = await getVerifiedUser(supabase);

  if (!user) redirect("/login");

  // Conexión directa: antes iba por la API REST de Supabase y, si se
  // cortaba por timeout, el alumno terminaba en el login con "No pudimos
  // encontrar tu ficha" aunque su ficha existiera. Si la base falla de
  // verdad, se tira el error (pantalla de error con reintento) en vez de
  // mandarlo al login.
  const [student] = await asUser(user.id, (sql) => sql<
    { id: string; nombre: string; coach_id: string; programa_id: string | null; semana_actual: number }[]
  >`select id, nombre, coach_id, programa_id, semana_actual from students where user_id = ${user.id} limit 1`);

  if (!student) {
    redirect(
      `/login?error=${encodeURIComponent(
        "No pudimos encontrar tu ficha de alumno. Escribile a tu coach para que lo revise."
      )}`
    );
  }

  return { supabase: makeHybridClient(supabase, user.id), user, student };
}
