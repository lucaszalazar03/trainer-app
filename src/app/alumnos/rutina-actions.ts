"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/actions/require-user";
import { sendPushToUser } from "@/lib/push-server";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Centrado en el alumno: estas acciones se llaman desde el perfil de un
 * alumno puntual, nunca desde una sección general de "armar programas".
 *
 * - createPersonalProgram / importProgramAsPersonal crean un programa con
 *   owner_student_id = ese alumno → es una rutina que le pertenece
 *   únicamente a él y NO aparece en la biblioteca general de /programas.
 * - saveProgramAsTemplate clona esa rutina personal a un programa nuevo con
 *   owner_student_id = null → recién ahí pasa a la biblioteca general.
 *   La rutina original del alumno no se toca.
 */

// ---------- Armar una rutina nueva, propia de un alumno ----------

export async function createPersonalProgram(studentId: string, formData: FormData) {
  const { supabase, user } = await requireUser();

  const { data: student } = await supabase
    .from("students")
    .select("nombre, user_id")
    .eq("id", studentId)
    .maybeSingle();

  const nombre = String(formData.get("nombre") || "").trim() || `Rutina de ${student?.nombre ?? "alumno"}`;

  const { data: program, error } = await supabase
    .from("programs")
    .insert({
      coach_id: user.id,
      owner_student_id: studentId,
      nombre,
      objetivo: "General",
      nivel: "Intermedio",
      duracion_semanas: 8,
    })
    .select("id")
    .single();

  if (error || !program) {
    redirect(`/alumnos/${studentId}?error=${encodeURIComponent(error?.message || "No se pudo crear la rutina")}`);
  }

  const { data: week } = await supabase
    .from("weeks")
    .insert({ program_id: program.id, numero: 1 })
    .select("id")
    .single();

  await supabase.from("students").update({ programa_id: program.id, semana_actual: 1 }).eq("id", studentId);

  if (student?.user_id) {
    await sendPushToUser(supabase, student.user_id, {
      title: "Tenés una rutina nueva",
      body: "Tu coach armó una rutina para vos.",
      url: "/alumno",
    });
  }

  revalidatePath(`/alumnos/${studentId}`);
  revalidatePath("/alumnos");
  redirect(`/programas/${program.id}?semana=${week?.id ?? ""}`);
}

// ---------- Clonar un programa entero (semanas → sesiones → entrada en
// calor y bloques → ejercicios) hacia uno nuevo ----------

async function cloneProgram(
  supabase: SupabaseServerClient,
  sourceProgramId: string,
  opts: { coachId: string; ownerStudentId: string | null; nombre: string }
): Promise<string | null> {
  const { data: source } = await supabase
    .from("programs")
    .select("descripcion, objetivo, nivel, duracion_semanas")
    .eq("id", sourceProgramId)
    .single();

  const { data: copy, error } = await supabase
    .from("programs")
    .insert({
      coach_id: opts.coachId,
      owner_student_id: opts.ownerStudentId,
      nombre: opts.nombre,
      descripcion: source?.descripcion ?? null,
      objetivo: source?.objetivo ?? "General",
      nivel: source?.nivel ?? "Intermedio",
      duracion_semanas: source?.duracion_semanas ?? 8,
    })
    .select("id")
    .single();

  if (error || !copy) return null;

  // Antes esto hacía un viaje al server por cada semana, por cada sesión de
  // cada semana, y por cada bloque de cada sesión (más el select de sus
  // ejercicios) — con un programa como el de rugby de Lucas (3 semanas, 9
  // sesiones, 36 bloques) eran más de 100 ida-y-vuelta secuenciales, lo que
  // es justo lo que hacía sentir "importar de mi biblioteca" lentísimo.
  // Ahora se trae y se inserta cada nivel entero de una sola vez (todas las
  // semanas juntas, todas las sesiones juntas, etc.), así son un puñado de
  // consultas en vez de cientos. Para mapear el id viejo de cada fila a su
  // copia nueva nos apoyamos en que un INSERT ... RETURNING de Postgres
  // devuelve las filas en el mismo orden en que se mandaron — no hace falta
  // pedirlas de nuevo una por una para saber qué id le tocó a cada una.
  const { data: weeks } = await supabase
    .from("weeks")
    .select("id, numero")
    .eq("program_id", sourceProgramId)
    .order("numero");
  if (!weeks?.length) return copy.id;

  const { data: newWeeks } = await supabase
    .from("weeks")
    .insert(weeks.map((w) => ({ program_id: copy.id, numero: w.numero })))
    .select("id");
  if (!newWeeks?.length) return copy.id;

  const weekIdMap = new Map(weeks.map((w, i) => [w.id, newWeeks[i].id]));

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, week_id, nombre, objetivo, movilidad, orden")
    .in("week_id", weeks.map((w) => w.id))
    .order("orden");
  if (!sessions?.length) return copy.id;

  const { data: newSessions } = await supabase
    .from("sessions")
    .insert(
      sessions.map((s) => ({
        week_id: weekIdMap.get(s.week_id)!,
        nombre: s.nombre,
        objetivo: s.objetivo,
        movilidad: s.movilidad,
        orden: s.orden,
      }))
    )
    .select("id");
  if (!newSessions?.length) return copy.id;

  const sessionIdMap = new Map(sessions.map((s, i) => [s.id, newSessions[i].id]));
  const sessionIds = sessions.map((s) => s.id);

  // Entrada en calor y bloques no dependen entre sí — en paralelo en vez de
  // uno atrás del otro.
  await Promise.all([
    (async () => {
      const { data: warmups } = await supabase
        .from("warmup_exercises")
        .select("session_id, exercise_id, series, reps, orden")
        .in("session_id", sessionIds);
      if (!warmups?.length) return;

      await supabase.from("warmup_exercises").insert(
        warmups.map((w) => ({
          session_id: sessionIdMap.get(w.session_id)!,
          exercise_id: w.exercise_id,
          series: w.series,
          reps: w.reps,
          orden: w.orden,
        }))
      );
    })(),
    (async () => {
      const { data: blocks } = await supabase
        .from("blocks")
        .select("id, session_id, nombre, color, descanso, descripcion, orden")
        .in("session_id", sessionIds)
        .order("orden");
      if (!blocks?.length) return;

      const { data: newBlocks } = await supabase
        .from("blocks")
        .insert(
          blocks.map((b) => ({
            session_id: sessionIdMap.get(b.session_id)!,
            nombre: b.nombre,
            color: b.color,
            descanso: b.descanso,
            descripcion: b.descripcion,
            orden: b.orden,
          }))
        )
        .select("id");
      if (!newBlocks?.length) return;

      const blockIdMap = new Map(blocks.map((b, i) => [b.id, newBlocks[i].id]));

      const { data: exs } = await supabase
        .from("block_exercises")
        .select("block_id, exercise_id, series, reps, orden")
        .in("block_id", blocks.map((b) => b.id));
      if (!exs?.length) return;

      await supabase.from("block_exercises").insert(
        exs.map((e) => ({
          block_id: blockIdMap.get(e.block_id)!,
          exercise_id: e.exercise_id,
          series: e.series,
          reps: e.reps,
          orden: e.orden,
        }))
      );
    })(),
  ]);

  return copy.id;
}

// ---------- Importar un programa de la biblioteca general como rutina
// personal de este alumno (lo clona: el original de la biblioteca queda
// intacto para seguir usándolo con otros alumnos) ----------

export async function importProgramAsPersonal(studentId: string, formData: FormData) {
  const { supabase, user } = await requireUser();

  const sourceProgramId = String(formData.get("source_program_id") || "");
  if (!sourceProgramId) {
    redirect(`/alumnos/${studentId}?error=${encodeURIComponent("Elegí un programa para importar")}`);
  }

  const { data: student } = await supabase
    .from("students")
    .select("nombre, user_id")
    .eq("id", studentId)
    .maybeSingle();
  const { data: source } = await supabase.from("programs").select("nombre").eq("id", sourceProgramId).single();

  const nombre = source?.nombre
    ? `${source.nombre} — ${student?.nombre ?? "alumno"}`
    : `Rutina de ${student?.nombre ?? "alumno"}`;

  const newProgramId = await cloneProgram(supabase, sourceProgramId, {
    coachId: user.id,
    ownerStudentId: studentId,
    nombre,
  });

  if (!newProgramId) {
    redirect(`/alumnos/${studentId}?error=${encodeURIComponent("No se pudo importar el programa")}`);
  }

  await supabase.from("students").update({ programa_id: newProgramId, semana_actual: 1 }).eq("id", studentId);

  if (student?.user_id) {
    await sendPushToUser(supabase, student.user_id, {
      title: "Tenés una rutina nueva",
      body: "Tu coach te asignó una rutina.",
      url: "/alumno",
    });
  }

  revalidatePath(`/alumnos/${studentId}`);
  revalidatePath("/alumnos");
  revalidatePath("/programas");
  redirect(`/alumnos/${studentId}?saved=1`);
}

// ---------- Guardar la rutina personal actual del alumno como plantilla
// en la biblioteca general (clona hacia owner_student_id = null; la rutina
// del alumno sigue siendo su rutina privada, sin tocarse) ----------

export async function saveProgramAsTemplate(studentId: string, programId: string) {
  const { supabase, user } = await requireUser();

  const { data: source } = await supabase.from("programs").select("nombre").eq("id", programId).single();

  const newProgramId = await cloneProgram(supabase, programId, {
    coachId: user.id,
    ownerStudentId: null,
    nombre: source?.nombre ?? "Programa",
  });

  if (!newProgramId) {
    redirect(`/alumnos/${studentId}?error=${encodeURIComponent("No se pudo guardar como plantilla")}`);
  }

  revalidatePath("/programas");
  revalidatePath(`/alumnos/${studentId}`);
  redirect(`/alumnos/${studentId}?saved=1`);
}
