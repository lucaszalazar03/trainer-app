import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUser } from "@/lib/supabase/verified-user";
import { resolveHome } from "@/lib/actions/role";
import { Bienvenida } from "./Bienvenida";

// Pantalla pública pensada para compartir como "link de descarga" (por
// WhatsApp, en un cartel del gimnasio, etc.) — antes de pedir que
// ingrese/cree cuenta, ofrece instalar la app a pantalla de inicio. Si quien
// entra ya tiene sesión iniciada (por ejemplo, volvió a tocar un link viejo)
// lo mandamos derecho a lo suyo en vez de mostrarle esto de nuevo.
export default async function BienvenidaPage() {
  const supabase = await createClient();
  const user = await getVerifiedUser(supabase);
  if (user) redirect(await resolveHome(supabase, user.id));

  return <Bienvenida />;
}
