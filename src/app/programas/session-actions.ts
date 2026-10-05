"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/actions/require-user";
import { COLORS } from "@/lib/constants";
import { getDirectSql } from "@/lib/db/direct";
import { friendlyDbError } from "@/lib/db/friendly-error";
import { revalidateExerciseLists } from "@/lib/db/exercises";

// Para acciones que se disparan DESDE la misma página que muestran los
// datos (agregar/guardar/borrar un bloque, borrar un ejercicio): hace
// falta que Next vuelva a traer los datos, no navegar a ningún lado —
// redirect() a la URL en la que ya estás fuerza una transición de ruta
// completa (spinner de navegación, reseteo de scroll) para lo que en el
// fondo es sólo "traé de nuevo los datos". revalidatePath solo alcanza y
// se siente mucho más liviano, sobre todo armando una sesión con varios
// cambios seguidos.
function refresh(path: string) {
  revalidatePath(path);
}

// Para acciones que se disparan desde OTRA página (el selector de
// ejercicios de la biblioteca) y necesitan volver a la sesión — acá sí
// hace falta navegar.
function backTo(path: string) {
  revalidatePath(path);
  redirect(path);
}

// ---------- Bloques ----------

export async function addBlock(sessionId: string, back: string) {
  const { supabase } = await requireUser();

  const { count } = await supabase
    .from("blocks")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId);

  const n = count ?? 0;

  await supabase.from("blocks").insert({
    session_id: sessionId,
    nombre: `Bloque ${n + 1}`,
    color: COLORS[n % COLORS.length],
    descanso: "",
    descripcion: "",
    orden: n,
  });

  refresh(back);
}

export async function updateBlock(blockId: string, back: string, formData: FormData) {
  const { supabase } = await requireUser();

  await supabase
    .from("blocks")
    .update({
      nombre: String(formData.get("nombre") || "Bloque").trim(),
      color: String(formData.get("color") || COLORS[0]),
      descanso: String(formData.get("descanso") || "").trim(),
      descripcion: String(formData.get("descripcion") || "").trim(),
    })
    .eq("id", blockId);

  refresh(back);
}

export async function deleteBlock(blockId: string, back: string) {
  const { supabase } = await requireUser();
  await supabase.from("blocks").delete().eq("id", blockId);
  refresh(back);
}

// ---------- Ejercicios de bloque ----------

function parseSeries(value: FormDataEntryValue | null): number | null {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) && String(value ?? "").trim() !== "" ? n : null;
}

// Esta se llama desde un componente cliente al perder el foco del campo
// (auto-guardado, ver ExerciseRowEditor) — no desde el submit de un
// <form>. A propósito NO revalida ni navega: el input ya está mostrando
// en pantalla el valor que se acaba de guardar (es un campo no
// controlado por el servidor), así que pedirle a Next que vuelva a
// traer y renderizar toda la página en cada blur no cambiaba nada visible
// y era exactamente lo que hacía sentir pesado tipear series/reps fila
// por fila. Si el coach recarga o vuelve a esta pantalla más tarde, el
// valor ya está guardado en la base y se lee fresco igual.
// updateBlockExercise/deleteBlockExercise/updateWarmupExercise/
// deleteWarmupExercise usan conexión DIRECTA a Postgres (src/lib/db/direct.ts)
// en vez de supabase-js: son justo las que se veían colgadas en "Guardando…"
// durante el incidente de Supabase de esta semana (API Gateway degradado —
// ver status.supabase.com), porque supabase-js pasa por esa API REST y
// conexión directa no. Como esto no pasa por RLS, cada consulta repite a
// mano, en el WHERE, el mismo chequeo que hacían las políticas "coach
// gestiona ejercicios de sus bloques" / "coach gestiona calor de sus
// sesiones" (bloque → sesión → semana → programa .coach_id).
//
// Devuelve {ok:false, error} en vez de tragarse el error silenciosamente —
// si esta consulta fallaba (por ej. la base cancelándola por timeout, algo
// que pasa de verdad durante ese incidente), la fila se quedaba en
// "Guardando…" para siempre porque nada le avisaba al cliente que había
// fallado. Ver ExerciseRowEditor.
export async function updateBlockExercise(id: string, formData: FormData) {
  const { user } = await requireUser();
  const sql = getDirectSql();
  const series = parseSeries(formData.get("series"));
  const reps = String(formData.get("reps") || "").trim();

  try {
    const rows = await sql`
      update block_exercises be
      set series = ${series}, reps = ${reps}
      where be.id = ${id}
        and exists (
          select 1 from blocks b
          join sessions se on se.id = b.session_id
          join weeks w on w.id = se.week_id
          join programs p on p.id = w.program_id
          where b.id = be.block_id and p.coach_id = ${user.id}
        )
      returning be.id
    `;
    if (rows.length === 0) return { ok: false, error: "No se encontró el ejercicio (o no te pertenece)." };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyDbError(err) };
  }
}

export async function deleteBlockExercise(id: string, back: string) {
  const { user } = await requireUser();
  const sql = getDirectSql();
  try {
    await sql`
      delete from block_exercises be
      using blocks b, sessions se, weeks w, programs p
      where be.id = ${id}
        and b.id = be.block_id and se.id = b.session_id and w.id = se.week_id and p.id = w.program_id
        and p.coach_id = ${user.id}
    `;
  } catch {
    // Sin UI para mostrar un error acá (este botón sólo revalida, ver
    // refresh() abajo) — igual que antes de esta migración, un fallo
    // simplemente no borra nada y el coach puede reintentar.
  }
  refresh(back);
}

// Reordena TODOS los ejercicios de un bloque de una — se lo dispara desde
// <ExerciseList> al soltar un drag, mandando la lista completa de ids en su
// nuevo orden (arrayMove ya la calculó del lado del cliente). Antes esto
// eran botones ↑/↓ que intercambiaban de a pares (moveBlockExercise) — se
// sacaron porque además de que arrastrar es más natural, esa versión no
// terminaba de andar bien. Este enfoque es además más robusto: no importa
// cuántos lugares se movió el ejercicio, es una sola consulta.
//
// json_to_recordset vuelve un array JSON en filas para poder cruzarlas con
// un UPDATE ... FROM — evita tener que armar a mano un CASE/WHEN con un
// WHEN por ejercicio (lo que sería un lío con listas largas).
export async function reorderBlockExercises(blockId: string, back: string, orderedIds: string[]) {
  const { user } = await requireUser();
  const sql = getDirectSql();

  const payload = JSON.stringify(orderedIds.map((id, orden) => ({ id, orden })));

  try {
    await sql`
      update block_exercises be
      set orden = t.orden
      from json_to_recordset(${payload}::json) as t(id uuid, orden int)
      where be.id = t.id
        and be.block_id = ${blockId}
        and exists (
          select 1 from blocks b
          join sessions se on se.id = b.session_id
          join weeks w on w.id = se.week_id
          join programs p on p.id = w.program_id
          where b.id = ${blockId} and p.coach_id = ${user.id}
        )
    `;
  } catch {
    // ver comentario en deleteBlockExercise — sin UI de error para esto,
    // si falla el reorden simplemente no se guarda y <ExerciseList> ya
    // había mostrado el nuevo orden de forma optimista; al volver a esta
    // pantalla se ve el orden real (el que quedó guardado).
  }
  refresh(back);
}

// ---------- Entrada en calor ----------

export async function updateWarmupExercise(id: string, formData: FormData) {
  const { user } = await requireUser();
  const sql = getDirectSql();
  const series = parseSeries(formData.get("series"));
  const reps = String(formData.get("reps") || "").trim();

  try {
    const rows = await sql`
      update warmup_exercises we
      set series = ${series}, reps = ${reps}
      where we.id = ${id}
        and exists (
          select 1 from sessions se
          join weeks w on w.id = se.week_id
          join programs p on p.id = w.program_id
          where se.id = we.session_id and p.coach_id = ${user.id}
        )
      returning we.id
    `;
    if (rows.length === 0) return { ok: false, error: "No se encontró el ejercicio (o no te pertenece)." };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyDbError(err) };
  }
}

export async function deleteWarmupExercise(id: string, back: string) {
  const { user } = await requireUser();
  const sql = getDirectSql();
  try {
    await sql`
      delete from warmup_exercises we
      using sessions se, weeks w, programs p
      where we.id = ${id}
        and se.id = we.session_id and w.id = se.week_id and p.id = w.program_id
        and p.coach_id = ${user.id}
    `;
  } catch {
    // ver comentario en deleteBlockExercise
  }
  refresh(back);
}

// Igual que reorderBlockExercises pero para la entrada en calor — cruza por
// session_id en vez de block_id.
export async function reorderWarmupExercises(sessionId: string, back: string, orderedIds: string[]) {
  const { user } = await requireUser();
  const sql = getDirectSql();

  const payload = JSON.stringify(orderedIds.map((id, orden) => ({ id, orden })));

  try {
    await sql`
      update warmup_exercises we
      set orden = t.orden
      from json_to_recordset(${payload}::json) as t(id uuid, orden int)
      where we.id = t.id
        and we.session_id = ${sessionId}
        and exists (
          select 1 from sessions se
          join weeks w on w.id = se.week_id
          join programs p on p.id = w.program_id
          where se.id = ${sessionId} and p.coach_id = ${user.id}
        )
    `;
  } catch {
    // ver comentario en reorderBlockExercises
  }
  refresh(back);
}

// ---------- Selector de ejercicios (compartido entre bloques y entrada en calor) ----------
// target tiene forma "block:<id>" o "warmup:<sessionId>"

// Devuelve {ok:false, error} en vez de tragarse el error silenciosamente —
// mismo motivo que en updateBlockExercise: si el insert fallaba (por ej.
// la base/gateway de Supabase cortando la consulta), el modal de
// "Agregar ejercicio" se quedaba en "Agregando…" para siempre sin ningún
// aviso de que en realidad no se había agregado nada.
//
// Conexión DIRECTA a Postgres (ver comentario grande sobre updateBlockExercise
// más arriba) — recibe coachId en vez del cliente de supabase-js, y cada
// rama repite a mano el chequeo de la política de RLS correspondiente
// (block_exercises / warmup_exercises / template_block_exercises). De paso,
// calcular "orden" con un subquery en la misma consulta del insert (en vez
// de un SELECT count(*) aparte, como antes) saca una ida y vuelta a la base
// y una condición de carrera: dos "agregar ejercicio" simultáneos ya no
// pueden pisarse el mismo número de orden.
async function insertIntoTarget(coachId: string, target: string, exerciseId: string): Promise<{ ok: boolean; error?: string }> {
  const [kind, id] = target.split(":");
  const sql = getDirectSql();

  try {
    let rows: { id: string }[] = [];

    if (kind === "block") {
      rows = await sql`
        insert into block_exercises (block_id, exercise_id, series, reps, orden)
        select b.id, ${exerciseId}, 3, '10', coalesce((select max(orden) + 1 from block_exercises where block_id = b.id), 0)
        from blocks b
        join sessions se on se.id = b.session_id
        join weeks w on w.id = se.week_id
        join programs p on p.id = w.program_id
        where b.id = ${id} and p.coach_id = ${coachId}
        returning id
      `;
    } else if (kind === "warmup") {
      rows = await sql`
        insert into warmup_exercises (session_id, exercise_id, series, reps, orden)
        select se.id, ${exerciseId}, 2, '10', coalesce((select max(orden) + 1 from warmup_exercises where session_id = se.id), 0)
        from sessions se
        join weeks w on w.id = se.week_id
        join programs p on p.id = w.program_id
        where se.id = ${id} and p.coach_id = ${coachId}
        returning id
      `;
    } else if (kind === "templateblock") {
      rows = await sql`
        insert into template_block_exercises (template_block_id, exercise_id, series, reps, orden)
        select tb.id, ${exerciseId}, 3, '10', coalesce((select max(orden) + 1 from template_block_exercises where template_block_id = tb.id), 0)
        from template_blocks tb
        join templates t on t.id = tb.template_id
        where tb.id = ${id} and t.coach_id = ${coachId}
        returning id
      `;
    } else {
      return { ok: false, error: "Destino inválido." };
    }

    if (rows.length === 0) return { ok: false, error: "No se encontró el destino (o no te pertenece)." };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyDbError(err) };
  }
}

export async function addExerciseToTarget(formData: FormData) {
  const { user } = await requireUser();

  const target = String(formData.get("target") || "");
  const exerciseId = String(formData.get("exerciseId") || "");
  const back = String(formData.get("back") || "/programas");

  if (target && exerciseId) {
    await insertIntoTarget(user.id, target, exerciseId);
  }

  backTo(back);
}

export async function quickCreateExerciseAndAdd(formData: FormData) {
  const { user } = await requireUser();

  const target = String(formData.get("target") || "");
  const back = String(formData.get("back") || "/programas");
  const nombre = String(formData.get("nombre") || "").trim();

  if (!nombre) {
    redirect(
      `/programas/ejercicios/agregar?target=${encodeURIComponent(target)}&back=${encodeURIComponent(back)}&error=${encodeURIComponent("Ponele un nombre al ejercicio")}`
    );
  }

  const sql = getDirectSql();
  let exerciseId: string | null = null;
  try {
    const rows = await sql<{ id: string }[]>`insert into exercises (coach_id, nombre) values (${user.id}, ${nombre}) returning id`;
    exerciseId = rows[0]?.id ?? null;
  } catch {
    // Este flujo viene del submit de un <form> en otra página (no tiene
    // forma de mostrar un error acá) — si falla la creación, seguimos igual
    // al backTo sin agregar nada, mismo comportamiento que antes de esta
    // migración.
  }

  if (exerciseId && target) {
    await insertIntoTarget(user.id, target, exerciseId);
  }

  // Ejercicio nuevo en la biblioteca → que lo vean todas las pantallas.
  if (exerciseId) revalidateExerciseLists();
  backTo(back);
}

// ---------- Variantes para el modal "Agregar ejercicio" ----------
// Mismo trabajo que addExerciseToTarget/quickCreateExerciseAndAdd de
// arriba, pero llamadas directo desde un componente cliente (no desde el
// submit de un <form> en OTRA página) — así que reciben argumentos
// comunes en vez de FormData, y sólo revalidan la página actual en vez de
// navegar. Ver AddExerciseModal.
//
// target/back van PRIMERO a propósito: la página que renderiza el modal
// los conoce de antemano y los deja pre-cargados con
// .bind(null, target, back), de forma que lo que le llega al modal ya es
// la forma exacta que espera (exerciseId) => Promise<void> — mismo truco
// que ya se usa en toda la app para pasarle server actions a un <form
// action={...}>, sólo que acá el componente que recibe la función
// pre-cargada es un cliente en vez de un form.
// Variante para el modal de "Agregar ejercicio" con selección múltiple: en
// vez de tildar uno y guardar, tildar uno y guardar, se tildan varios y
// se insertan todos en una sola llamada al servidor. Van uno por uno
// (await en secuencia, no Promise.all) a propósito: cada insert calcula
// el próximo "orden" con un MAX(orden)+1 sobre la misma fila — en paralelo
// dos inserts podrían leer el mismo MAX antes de que el otro confirme el
// suyo y terminar con el mismo orden pisado.
export async function addManyExercisesToTargetInline(target: string, back: string, exerciseIds: string[]) {
  const { user } = await requireUser();

  if (!target || exerciseIds.length === 0) return { ok: true };

  for (const exerciseId of exerciseIds) {
    const result = await insertIntoTarget(user.id, target, exerciseId);
    if (!result.ok) return result;
  }

  refresh(back);
  return { ok: true };
}

export async function quickCreateExerciseAndAddInline(target: string, back: string, nombre: string) {
  const { user } = await requireUser();

  const trimmed = nombre.trim();
  if (!trimmed) return { ok: true };

  const sql = getDirectSql();
  let exerciseId: string | null = null;
  try {
    const rows = await sql<{ id: string }[]>`insert into exercises (coach_id, nombre) values (${user.id}, ${trimmed}) returning id`;
    exerciseId = rows[0]?.id ?? null;
  } catch (err) {
    return { ok: false, error: friendlyDbError(err) ?? "No se pudo crear el ejercicio" };
  }
  if (!exerciseId) return { ok: false, error: "No se pudo crear el ejercicio" };
  // Ejercicio nuevo en la biblioteca → que lo vean todas las pantallas.
  revalidateExerciseLists();

  if (target) {
    const result = await insertIntoTarget(user.id, target, exerciseId);
    if (!result.ok) return result;
  }

  refresh(back);
  return { ok: true };
}
