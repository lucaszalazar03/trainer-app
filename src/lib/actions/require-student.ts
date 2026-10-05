import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUser } from "@/lib/supabase/verified-user";

/**
 * Toda pantalla/acción del área del alumno arranca llamando esto.
 * RLS es la barrera real (user_id = auth.uid()), esto además resuelve
 * el registro de alumno vinculado a la sesión actual.
 */
export async function requireStudent() {
  const supabase = await createClient();
  const user = await getVerifiedUser(supabase);

  if (!user) redirect("/login");

  const { data: student } = await supabase
    .from("students")
    .select("id, nombre, coach_id, programa_id, semana_actual")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!student) {
    redirect(
      `/login?error=${encodeURIComponent(
        "No pudimos encontrar tu ficha de alumno. Escribile a tu coach para que lo revise."
      )}`
    );
  }

  return { supabase, user, student };
}
