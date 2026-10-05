import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUser } from "@/lib/supabase/verified-user";

/**
 * Toda Server Action de datos del coach arranca llamando esto.
 * RLS en la base es la barrera real (coach_id = auth.uid()), pero
 * Next.js recomienda además verificar sesión explícitamente acá.
 */
export async function requireUser() {
  const supabase = await createClient();
  const user = await getVerifiedUser(supabase);

  if (!user) redirect("/login");

  return { supabase, user };
}
