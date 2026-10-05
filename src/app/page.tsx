import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUser } from "@/lib/supabase/verified-user";
import { resolveHome } from "@/lib/actions/role";

export default async function Home() {
  const supabase = await createClient();
  const user = await getVerifiedUser(supabase);

  // Sin sesión: a la pantalla pública de bienvenida (la que se comparte como
  // "link de descarga"), no directo al formulario de ingresar/crear cuenta.
  if (!user) redirect("/bienvenida");
  redirect(await resolveHome(supabase, user.id));
}
