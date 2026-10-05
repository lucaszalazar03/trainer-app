// Códigos de error de Postgres que ya vimos ocurrir de verdad durante el
// incidente de Supabase de esta semana (timeouts/cortes de conexión, no
// errores de nuestros datos) — se traducen a un mensaje que un coach puede
// entender en vez del código crudo de Postgres. Compartido entre las
// acciones que usan supabase-js (error.code) y las que usan conexión
// directa por el paquete "postgres" (PostgresError.code) — misma forma en
// ambos casos.
const TRANSIENT_PG_CODES = new Set(["57014", "08006", "08003", "08000", "57P01", "53300"]);

export function friendlyDbError(error: unknown): string | undefined {
  if (!error) return undefined;
  const code = (error as { code?: string })?.code;
  if (code && TRANSIENT_PG_CODES.has(code)) {
    return "Supabase está teniendo problemas de conexión en este momento (no es un error tuyo). Esperá unos segundos y probá guardar de nuevo.";
  }
  const message = (error as { message?: string })?.message;
  if (message) return message;
  return "No se pudo completar la operación.";
}
