import type { createClient } from "@/lib/supabase/server";
import { createDirectClient } from "./direct-client";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Cliente "híbrido" que devuelven requireUser/requireStudent:
 * - .from(...) y .rpc(...) (la base de datos) → conexión DIRECTA rápida, como
 *   el usuario logueado y con sus reglas de seguridad (ver direct-client.ts).
 * - .auth y .storage (login y videos) → siguen por Supabase como siempre.
 *
 * Mantiene el mismo tipo que el cliente de supabase-js, así el código de
 * todas las acciones sigue igual.
 */
export function makeHybridClient(real: SupabaseServerClient, userId: string): SupabaseServerClient {
  const direct = createDirectClient(userId);
  return new Proxy(real, {
    get(target, prop, receiver) {
      if (prop === "from") return direct.from;
      if (prop === "rpc") return direct.rpc;
      return Reflect.get(target, prop, receiver);
    },
  }) as SupabaseServerClient;
}
