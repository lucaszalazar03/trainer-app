import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

/**
 * Cliente de Supabase para usar en Server Components, Server Actions y Route Handlers.
 * Lee/escribe la sesión desde las cookies de la request. Usa la clave pública —
 * la seguridad real la da Row Level Security en la base, no esta clave.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll fue llamado desde un Server Component sin permiso de escritura.
            // Se puede ignorar si hay middleware refrescando la sesión.
          }
        },
      },
    }
  );
}
