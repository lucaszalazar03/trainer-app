"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/actions/require-user";
import { sendPushToUser } from "@/lib/push-server";
import { getDirectSql } from "@/lib/db/direct";
import { friendlyDbError } from "@/lib/db/friendly-error";
import { copySessionsExact } from "@/lib/db/copy-sessions";
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

// ---------- Clonar un programa entero, EXACTAMENTE igual ----------
// Antes se copiaba nivel por nivel por la API REST, ignorando errores: si
// algo se cortaba, la copia quedaba incompleta sin avisar. Ahora va todo en
// UNA transacción por conexión directa (semanas, sesiones con día/orden,
// entrada en calor, bloques con descanso/color/descripción y ejercicios con
// series/reps): o se copia todo, o nada. Ver copySessionsExact.
async function cloneProgram(
  _supabase: SupabaseServerClient,
  sourceProgramId: string,
  opts: { coachId: string; ownerStudentId: string | null; nombre: string }
): Promise<string | null> {
  try {
    return await getDirectSql().begin(async (tx) => {
      const [copy] = await tx<{ id: string }[]>`
        insert into programs (coach_id, owner_student_id, nombre, descripcion, objetivo, nivel, duracion_semanas)
        select ${opts.coachId}, ${opts.ownerStudentId}, ${opts.nombre}, descripcion, coalesce(objetivo, 'General'),
               coalesce(nivel, 'Intermedio'), coalesce(duracion_semanas, 8)
        from programs where id = ${sourceProgramId} and coach_id = ${opts.coachId}
        returning id`;
      if (!copy) throw new Error("No se encontró el programa de origen.");
      const weeks = await tx<{ id: string; numero: number }[]>`
        select id, numero from weeks where program_id = ${sourceProgramId} order by numero`;
      const sources: { sessionId: string; toWeekId: string }[] = [];
      for (const w of weeks) {
        const [nw] = await tx<{ id: string }[]>`insert into weeks (program_id, numero) values (${copy.id}, ${w.numero}) returning id`;
        const ses = await tx<{ id: string }[]>`select id from sessions where week_id = ${w.id} order by orden`;
        for (const s of ses) sources.push({ sessionId: s.id, toWeekId: nw.id });
      }
      await copySessionsExact(tx, sources);
      return copy.id;
    });
  } catch (err) {
    console.error("[cloneProgram]", err);
    return null;
  }
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

// ---------- Usar la MISMA rutina que otro alumno (compartida, no copia) ----------
//
// A diferencia de importProgramAsPersonal (que clona y deja dos rutinas
// separadas que después no se actualizan entre sí), esto apunta al alumno
// al mismo programa que ya usa el otro. Cualquier cambio que el coach haga
// en esa rutina (agregar una sesión, cambiar series…) lo ven los dos.
// Conexión directa (rápida y sin los timeouts de la API REST); como no pasa
// por RLS, se chequea a mano que ambos alumnos sean del coach.
export async function shareRoutineFromStudent(studentId: string, formData: FormData) {
  const { supabase, user } = await requireUser();
  const sourceStudentId = String(formData.get("source_student_id") || "");
  if (!sourceStudentId) {
    redirect(`/alumnos/${studentId}?error=${encodeURIComponent("Elegí de qué alumno copiar la rutina")}`);
  }

  let targetUserId: string | null = null;
  let errorMsg: string | null = null;
  try {
    const rows = await getDirectSql()<{ user_id: string | null }[]>`
      update students t
      set programa_id = s.programa_id, semana_actual = coalesce(s.semana_actual, 1)
      from students s
      where t.id = ${studentId} and t.coach_id = ${user.id}
        and s.id = ${sourceStudentId} and s.coach_id = ${user.id}
        and s.programa_id is not null and t.id <> s.id
      returning t.user_id
    `;
    if (rows.length === 0) errorMsg = "No se pudo: ese alumno no tiene una rutina asignada.";
    else targetUserId = rows[0].user_id;
  } catch (err) {
    errorMsg = friendlyDbError(err) ?? "No se pudo asignar la rutina.";
  }

  if (errorMsg) redirect(`/alumnos/${studentId}?error=${encodeURIComponent(errorMsg)}`);

  if (targetUserId) {
    await sendPushToUser(supabase, targetUserId, {
      title: "Tenés una rutina nueva",
      body: "Tu coach te asignó una rutina.",
      url: "/alumno",
    });
  }

  revalidatePath("/alumnos", "layout");
  revalidatePath("/programas", "layout");
  redirect(`/alumnos/${studentId}?saved=1`);
}
