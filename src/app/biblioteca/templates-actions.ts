"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/actions/require-user";
import { COLORS } from "@/lib/constants";
import { revalidateExerciseLists } from "@/lib/db/exercises";

// Mismo criterio que en programas/session-actions.ts: todas las acciones
// de este archivo que tocan bloques/ejercicios se disparan desde la misma
// página que ya se está mostrando, así que alcanza con revalidar —
// redirect() a la URL en la que ya se está parado fuerza una transición
// de ruta completa (spinner, reseteo de scroll) de más.
function refresh(path: string) {
  revalidatePath(path);
}

type Supa = Awaited<ReturnType<typeof requireUser>>["supabase"];

// ---------- Plantillas ----------

export async function createTemplate(formData: FormData) {
  const { supabase, user } = await requireUser();

  const nombre = String(formData.get("nombre") || "").trim();
  if (!nombre) redirect("/biblioteca/plantillas/nueva?error=Ponele un nombre a la plantilla");

  // "calentamiento" = lista plana de ejercicios (sin bloques), pensada para
  // entradas en calor reutilizables. Cualquier otra cosa cae en "bloque",
  // el tipo de plantilla que ya existía.
  const tipo = String(formData.get("tipo") || "bloque") === "calentamiento" ? "calentamiento" : "bloque";

  const { data, error } = await supabase
    .from("templates")
    .insert({ coach_id: user.id, nombre, tipo })
    .select("id")
    .single();

  if (error || !data) {
    redirect(`/biblioteca/plantillas/nueva?error=${encodeURIComponent(error?.message || "No se pudo crear la plantilla")}`);
  }

  revalidatePath("/biblioteca");
  redirect(`/biblioteca/plantillas/${data.id}`);
}

export async function updateTemplate(id: string, formData: FormData) {
  const { supabase } = await requireUser();

  const nombre = String(formData.get("nombre") || "").trim();
  if (!nombre) redirect(`/biblioteca/plantillas/${id}?error=El nombre es obligatorio`);

  const { error } = await supabase.from("templates").update({ nombre }).eq("id", id);
  if (error) redirect(`/biblioteca/plantillas/${id}?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/biblioteca");
  revalidatePath(`/biblioteca/plantillas/${id}`);
  redirect(`/biblioteca/plantillas/${id}?saved=1`);
}

export async function deleteTemplate(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("templates").delete().eq("id", id);
  revalidatePath("/biblioteca");
  redirect("/biblioteca?tab=plantillas");
}

// ---------- Bloques de plantilla ----------

export async function addTemplateBlock(templateId: string, back: string) {
  const { supabase } = await requireUser();

  const { count } = await supabase
    .from("template_blocks")
    .select("*", { count: "exact", head: true })
    .eq("template_id", templateId);

  const n = count ?? 0;

  await supabase.from("template_blocks").insert({
    template_id: templateId,
    nombre: `Bloque ${n + 1}`,
    color: COLORS[n % COLORS.length],
    descanso: "",
    descripcion: "",
    orden: n,
  });

  refresh(back);
}

export async function updateTemplateBlock(blockId: string, back: string, formData: FormData) {
  const { supabase } = await requireUser();

  await supabase
    .from("template_blocks")
    .update({
      nombre: String(formData.get("nombre") || "Bloque").trim(),
      color: String(formData.get("color") || COLORS[0]),
      descanso: String(formData.get("descanso") || "").trim(),
      descripcion: String(formData.get("descripcion") || "").trim(),
    })
    .eq("id", blockId);

  refresh(back);
}

export async function deleteTemplateBlock(blockId: string, back: string) {
  const { supabase } = await requireUser();
  await supabase.from("template_blocks").delete().eq("id", blockId);
  refresh(back);
}

// ---------- Ejercicios de bloque de plantilla ----------

function parseSeries(value: FormDataEntryValue | null): number | null {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) && String(value ?? "").trim() !== "" ? n : null;
}

// Se llama desde un componente cliente al perder el foco del campo
// (auto-guardado). A propósito NO revalida — el input ya muestra en
// pantalla el valor recién guardado, así que no hay nada que traer de
// nuevo del servidor (ver el mismo criterio, más detallado, en
// programas/session-actions.ts).
export async function updateTemplateBlockExercise(id: string, formData: FormData) {
  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("template_block_exercises")
    .update({
      series: parseSeries(formData.get("series")),
      reps: String(formData.get("reps") || "").trim(),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteTemplateBlockExercise(id: string, back: string) {
  const { supabase } = await requireUser();
  await supabase.from("template_block_exercises").delete().eq("id", id);
  refresh(back);
}

// ---------- Insertar una plantilla dentro de una sesión ----------

// Body compartido entre applyTemplateToSession (una sesión) y
// applyTemplateToSessions (varias a la vez, ver más abajo) — arma los
// bloques + ejercicios de la plantilla dentro de una sesión puntual.
async function insertBlockTemplateIntoSession(
  supabase: Supa,
  templateBlocks: { id: string; nombre: string; color: string | null; descanso: string | null; descripcion: string | null }[],
  templateExercises: { template_block_id: string; exercise_id: string; series: number | null; reps: string | null }[],
  sessionId: string
) {
  const { count } = await supabase
    .from("blocks")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId);

  let orden = count ?? 0;

  for (const tb of templateBlocks) {
    const { data: newBlock } = await supabase
      .from("blocks")
      .insert({
        session_id: sessionId,
        nombre: tb.nombre,
        color: tb.color,
        descanso: tb.descanso,
        descripcion: tb.descripcion,
        orden: orden++,
      })
      .select("id")
      .single();

    if (!newBlock) continue;

    const exercisesForBlock = templateExercises.filter((e) => e.template_block_id === tb.id);
    if (exercisesForBlock.length > 0) {
      await supabase.from("block_exercises").insert(
        exercisesForBlock.map((e, i) => ({
          block_id: newBlock.id,
          exercise_id: e.exercise_id,
          series: e.series,
          reps: e.reps,
          orden: i,
        }))
      );
    }
  }
}

export async function applyTemplateToSession(sessionId: string, back: string, formData: FormData) {
  const { supabase } = await requireUser();

  const templateId = String(formData.get("template_id") || "");
  // Estas dos salidas tempranas necesitan el "return" explícito: a
  // diferencia de backTo() (que cortaba la ejecución al llamar a
  // redirect(), que internamente tira una excepción), refresh() sólo
  // revalida y devuelve normalmente — sin el return, el resto de la
  // función seguiría de largo con templateId vacío.
  if (!templateId) return refresh(back);

  const { data: templateBlocks } = await supabase
    .from("template_blocks")
    .select("id, nombre, color, descanso, descripcion")
    .eq("template_id", templateId)
    .order("orden");

  if (!templateBlocks || templateBlocks.length === 0) return refresh(back);

  const blockIds = (templateBlocks ?? []).map((b) => b.id);
  const { data: templateExercises } = await supabase
    .from("template_block_exercises")
    .select("id, template_block_id, exercise_id, series, reps")
    .in("template_block_id", blockIds)
    .order("orden");

  await insertBlockTemplateIntoSession(supabase, templateBlocks, templateExercises ?? [], sessionId);

  refresh(back);
}

// ---------- Insertar una plantilla de bloques en varias sesiones a la vez ----------
// Arma un programa entero era la parte más lenta de armar un plan: insertar
// la misma plantilla sesión por sesión, entrando y saliendo de cada una.
// Esta variante recibe todas las sesiones elegidas de una semana y aplica
// la plantilla en todas de una — ver la página
// programas/[id]/aplicar-plantilla.

export async function applyTemplateToSessions(programId: string, weekId: string, formData: FormData) {
  const { supabase } = await requireUser();
  const back = `/programas/${programId}?semana=${weekId}`;

  const templateId = String(formData.get("template_id") || "");
  const sessionIds = formData.getAll("session_id").map((v) => String(v));
  if (!templateId || sessionIds.length === 0) redirect(back);

  const { data: templateBlocks } = await supabase
    .from("template_blocks")
    .select("id, nombre, color, descanso, descripcion")
    .eq("template_id", templateId)
    .order("orden");

  if (!templateBlocks || templateBlocks.length === 0) redirect(back);

  const blockIds = templateBlocks.map((b) => b.id);
  const { data: templateExercises } = await supabase
    .from("template_block_exercises")
    .select("template_block_id, exercise_id, series, reps")
    .in("template_block_id", blockIds)
    .order("orden");

  // A diferencia de las inserciones dentro de UNA sesión (esas sí van
  // secuenciales — dos bloques de la misma sesión calculando "orden" en
  // paralelo podrían chocar), acá cada sesión de la lista es independiente:
  // cada una cuenta sus propios bloques existentes, así que aplicar todas
  // al mismo tiempo es seguro y evita esperar sesión por sesión.
  await Promise.all(sessionIds.map((sessionId) => insertBlockTemplateIntoSession(supabase, templateBlocks, templateExercises ?? [], sessionId)));

  revalidatePath(`/programas/${programId}`);
  redirect(back);
}

// ---------- Variante para el modal "Agregar ejercicio" (ver
// AddExerciseModal y programas/session-actions.ts) ----------
// templateBlockId/back van primero para poder pre-cargarlos con
// .bind(null, templateBlockId, back) y que quede (exerciseId) =>
// Promise<void>, la forma que espera el modal.

// Ambas devuelven {ok:false, error} en vez de tragarse el error
// silenciosamente — mismo motivo que en updateTemplateBlockExercise: si el
// insert fallaba, el modal de "Agregar ejercicio" se quedaba en
// "Agregando…" para siempre sin ningún aviso de que no se había agregado
// nada.
// Variante para el modal de "Agregar ejercicio" con selección múltiple —
// ver el mismo criterio (secuencial, no en paralelo) en
// addManyExercisesToTargetInline de session-actions.ts.
export async function addManyExercisesToTemplateBlockInline(templateBlockId: string, back: string, exerciseIds: string[]) {
  const { supabase } = await requireUser();

  if (exerciseIds.length === 0) return { ok: true };

  for (const exerciseId of exerciseIds) {
    const { count } = await supabase
      .from("template_block_exercises")
      .select("*", { count: "exact", head: true })
      .eq("template_block_id", templateBlockId);

    const { error } = await supabase
      .from("template_block_exercises")
      .insert({ template_block_id: templateBlockId, exercise_id: exerciseId, series: 3, reps: "10", orden: count ?? 0 });

    if (error) return { ok: false, error: error.message };
  }

  refresh(back);
  return { ok: true };
}

export async function quickCreateExerciseAndAddToTemplateBlockInline(
  templateBlockId: string,
  back: string,
  nombre: string
) {
  const { supabase, user } = await requireUser();

  const trimmed = nombre.trim();
  if (!trimmed) return { ok: true };

  const { data: exercise, error } = await supabase
    .from("exercises")
    .insert({ coach_id: user.id, nombre: trimmed })
    .select("id")
    .single();

  if (error || !exercise) return { ok: false, error: error?.message || "No se pudo crear el ejercicio" };
  // Ejercicio nuevo en la biblioteca → que lo vean todas las pantallas.
  revalidateExerciseLists();

  const { count } = await supabase
    .from("template_block_exercises")
    .select("*", { count: "exact", head: true })
    .eq("template_block_id", templateBlockId);

  const { error: insertError } = await supabase.from("template_block_exercises").insert({
    template_block_id: templateBlockId,
    exercise_id: exercise.id,
    series: 3,
    reps: "10",
    orden: count ?? 0,
  });

  if (insertError) return { ok: false, error: insertError.message };

  refresh(back);
  return { ok: true };
}

// ---------- Ejercicios de plantilla de entrada en calor ----------
// Las plantillas tipo "calentamiento" son una lista plana de ejercicios
// (sin sub-bloques) — mismo criterio que la entrada en calor de una sesión
// real, ver session-actions.ts.

export async function updateTemplateWarmupExercise(id: string, formData: FormData) {
  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("template_warmup_exercises")
    .update({
      series: parseSeries(formData.get("series")),
      reps: String(formData.get("reps") || "").trim(),
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteTemplateWarmupExercise(id: string, back: string) {
  const { supabase } = await requireUser();
  await supabase.from("template_warmup_exercises").delete().eq("id", id);
  refresh(back);
}

export async function addManyExercisesToTemplateWarmupInline(templateId: string, back: string, exerciseIds: string[]) {
  const { supabase } = await requireUser();

  if (exerciseIds.length === 0) return { ok: true };

  for (const exerciseId of exerciseIds) {
    const { count } = await supabase
      .from("template_warmup_exercises")
      .select("*", { count: "exact", head: true })
      .eq("template_id", templateId);

    const { error } = await supabase
      .from("template_warmup_exercises")
      .insert({ template_id: templateId, exercise_id: exerciseId, series: 3, reps: "10", orden: count ?? 0 });

    if (error) return { ok: false, error: error.message };
  }

  refresh(back);
  return { ok: true };
}

export async function quickCreateExerciseAndAddToTemplateWarmupInline(templateId: string, back: string, nombre: string) {
  const { supabase, user } = await requireUser();

  const trimmed = nombre.trim();
  if (!trimmed) return { ok: true };

  const { data: exercise, error } = await supabase
    .from("exercises")
    .insert({ coach_id: user.id, nombre: trimmed })
    .select("id")
    .single();

  if (error || !exercise) return { ok: false, error: error?.message || "No se pudo crear el ejercicio" };
  // Ejercicio nuevo en la biblioteca → que lo vean todas las pantallas.
  revalidateExerciseLists();

  const { count } = await supabase
    .from("template_warmup_exercises")
    .select("*", { count: "exact", head: true })
    .eq("template_id", templateId);

  const { error: insertError } = await supabase.from("template_warmup_exercises").insert({
    template_id: templateId,
    exercise_id: exercise.id,
    series: 3,
    reps: "10",
    orden: count ?? 0,
  });

  if (insertError) return { ok: false, error: insertError.message };

  refresh(back);
  return { ok: true };
}

// ---------- Insertar una plantilla de entrada en calor dentro de una sesión ----------

export async function applyWarmupTemplateToSession(sessionId: string, back: string, formData: FormData) {
  const { supabase } = await requireUser();

  const templateId = String(formData.get("template_id") || "");
  if (!templateId) return refresh(back);

  const { data: templateWarmups } = await supabase
    .from("template_warmup_exercises")
    .select("exercise_id, series, reps")
    .eq("template_id", templateId)
    .order("orden");

  if (!templateWarmups || templateWarmups.length === 0) return refresh(back);

  const { count } = await supabase
    .from("warmup_exercises")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId);

  let orden = count ?? 0;

  await supabase.from("warmup_exercises").insert(
    templateWarmups.map((w) => ({
      session_id: sessionId,
      exercise_id: w.exercise_id,
      series: w.series,
      reps: w.reps,
      orden: orden++,
    }))
  );

  refresh(back);
}
