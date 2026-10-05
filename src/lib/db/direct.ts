import postgres from "postgres";

/**
 * Conexión DIRECTA a Postgres (protocolo de base de datos), en vez de pasar
 * por la API REST de Supabase (PostgREST detrás de su API Gateway).
 *
 * Por qué existe esto: durante el incidente externo de Supabase de esta
 * semana ("API Gateway: Degraded Performance", activo desde hace varios
 * días según status.supabase.com), las consultas que la app hace a través
 * de supabase-js — que van todas por esa API REST — se cancelan seguido con
 * error 57014 ("canceling statement due to statement timeout"), incluso
 * siendo consultas que tardan milisegundos en ejecutarse (lo confirmamos
 * con EXPLAIN ANALYZE). En cambio, TODO el trabajo de este proyecto hecho
 * por conexión directa a Postgres (el mismo mecanismo que usa este archivo)
 * nunca falló una sola vez durante el mismo incidente — buena evidencia de
 * que lo degradado es específicamente esa capa HTTP intermedia, no la base
 * en sí. Por eso las pantallas que más sufrieron cuelgues (guardar
 * series/reps, agregar ejercicio a un bloque/entrada en calor, la
 * biblioteca de ejercicios) se movieron a usar esto en vez de supabase-js.
 *
 * Esto NO es "dejar de usar Supabase" — sigue siendo la misma base de
 * datos, los mismos usuarios, el mismo login. Sólo cambia CÓMO le hablamos
 * a la base para las operaciones que veníamos viendo fallar.
 *
 * Importante: como esto NO pasa por PostgREST, tampoco pasa por Row Level
 * Security (RLS) de la misma manera (RLS depende de qué rol de Postgres es
 * dueño de la conexión — acá usamos un usuario con acceso completo). Cada
 * función que use este cliente tiene que replicar a mano, en el WHERE de su
 * propia consulta, el mismo chequeo de "esto es tuyo, coach" que antes hacía
 * la política de RLS — ver el comentario en cada función de
 * session-actions.ts / biblioteca/actions.ts que lo usa, con la política
 * exacta que replica.
 */
let sql: ReturnType<typeof postgres> | null = null;

export function getDirectSql() {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "Falta configurar DATABASE_URL (connection string directa a Postgres, ver Supabase → Project Settings → Database)."
      );
    }
    // prepare:false porque el pooler de Supabase en modo "Transaction" (el
    // recomendado para funciones serverless como las de Vercel) no soporta
    // prepared statements que crucen de una conexión física a otra.
    sql = postgres(url, { prepare: false, max: 3, idle_timeout: 20 });
  }
  return sql;
}
