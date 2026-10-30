import type { TransactionSql } from "postgres";
import { getDirectSql } from "./direct";

/**
 * Corre consultas por la conexión DIRECTA (rápida, sin los cortes por
 * timeout de la API REST de Supabase) pero COMO el usuario logueado, con
 * las mismas reglas de seguridad (RLS) que usaba supabase-js: cada coach ve
 * sólo lo suyo y cada alumno sólo lo suyo, sin tener que filtrar a mano.
 *
 * Es exactamente lo que hace PostgREST por dentro: dentro de una
 * transacción fija el rol "authenticated" y los datos del usuario
 * (request.jwt.claims), que es de donde auth.uid() lee el id.
 *
 * userId tiene que venir de una sesión ya verificada (requireUser /
 * requireStudent), nunca de algo que mande el navegador.
 */
// Errores pasajeros (corte de conexión, base reiniciándose, timeout): vale
// la pena reintentar una vez antes de mostrarle un error al usuario.
const TRANSIENT = new Set(["57014", "57P01", "57P02", "57P03", "08000", "08001", "08003", "08006", "53300", "CONNECT_TIMEOUT", "CONNECTION_CLOSED", "CONNECTION_ENDED", "CONNECTION_DESTROYED", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT"]);
function isTransient(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return !!code && TRANSIENT.has(code);
}

export async function asUser<T>(userId: string, fn: (sql: TransactionSql) => Promise<T>): Promise<T> {
  const sql = getDirectSql();
  const claims = JSON.stringify({ sub: userId, role: "authenticated" });
  const run = async () =>
    (await sql.begin(async (tx) => {
      // statement_timeout local a esta transacción: ninguna consulta de la app
      // tarda más de unos milisegundos; si tarda 12s el servidor está
      // trabado y es mejor mostrar "Reintentar" que dejar la pantalla en
      // blanco esperando los 2 minutos por defecto.
      await tx`select set_config('request.jwt.claims', ${claims}, true), set_config('role', 'authenticated', true),
        set_config('statement_timeout', '12s', true)`;
      return fn(tx);
    })) as T;
  try {
    return await run();
  } catch (err) {
    if (!isTransient(err)) throw err;
    console.error("[db] error pasajero, reintento", (err as { code?: string }).code);
    await new Promise((r) => setTimeout(r, 400));
    return run();
  }
}
