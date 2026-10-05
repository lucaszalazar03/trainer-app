import { revalidatePath } from "next/cache";
import { getDirectSql } from "@/lib/db/direct";

/**
 * Única forma de leer la biblioteca de ejercicios del coach.
 *
 * Por qué existe: la Biblioteca, el editor de plantillas y la página de
 * "agregar ejercicio" leían la lista por supabase-js (API REST de Supabase)
 * y se quedaban sólo con `data`, ignorando `error`. Cuando esa API corta la
 * consulta por timeout (57014 / "Thread killed by timeout manager" en los
 * logs de PostgREST), la lista llegaba vacía o incompleta SIN avisar: así
 * "desaparecían" ejercicios que sí estaban guardados (ej. "Chin Ups").
 *
 * Ahora todo pasa por la conexión directa (igual que el editor de sesiones,
 * que nunca tuvo el problema) y si falla, TIRA el error — nunca devuelve una
 * lista vacía disfrazada de "no tenés ejercicios". Como no pasa por RLS,
 * filtra a mano por coach_id (misma regla que la política
 * "coach gestiona sus ejercicios").
 */
export type ExerciseOption = { id: string; nombre: string; grupo: string | null; equipamiento: string | null };

export async function listExerciseOptions(coachId: string): Promise<ExerciseOption[]> {
  const sql = getDirectSql();
  return sql<ExerciseOption[]>`
    select id, nombre, grupo, equipamiento
    from exercises
    where coach_id = ${coachId}
    order by nombre
  `;
}

/**
 * Después de crear/borrar/renombrar un ejercicio hay que refrescar TODAS las
 * pantallas que muestran la lista (Biblioteca, editor de sesiones, editor de
 * plantillas, agregar ejercicio). Antes sólo se revalidaba /biblioteca, y
 * las otras pantallas seguían mostrando su copia vieja — así "volvían"
 * ejercicios ya borrados (ej. "Dominadas"). Revalidar el layout raíz vacía
 * el caché de rutas del cliente entero; la app es chica, el costo es nulo.
 */
export function revalidateExerciseLists() {
  revalidatePath("/", "layout");
}
