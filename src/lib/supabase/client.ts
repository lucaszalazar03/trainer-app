import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

/**
 * Cliente de Supabase para usar en Client Components (navegador).
 * Usa la clave pública (publishable/anon) — nunca la service_role acá.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
