"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/actions/require-user";
import { sendPushToUser } from "@/lib/push-server";

export async function createProgram(formData: FormData) {
  const { supabase, user } = await requireUser();

  const nombre = String(formData.get("nombre") || "").trim();
  if (!nombre) redirect("/programas/nuevo?error=El nombre es obligatorio");

  const { data: program, error } = await supabase
    .from("programs")
    .insert({
      coach_id: user.id,
      nombre,
      descripcion: String(formData.get("descripcion") || "").trim() || null,
      objetivo: String(formData.get("objetivo") || "").trim() || "General",
      nivel: String(formData.get("nivel") || "Intermedio"),
      duracion_semanas: Number(formData.get("duracion_semanas")) || 8,
    })
    .select("id")
    .single();

  if (error || !program) {
    redirect(`/programas/nuevo?error=${encodeURIComponent(error?.message || "No se pudo crear el programa")}`);
  }

  await supabase.from("weeks").insert({ program_id: program.id, numero: 1 });

  revalidatePath("/programas");
  redirect(`/programas/${program.id}`);
}

export async function updateProgram(id: string, formData: FormData) {
  const { supabase } = await requireUser();

  const nombre = String(formData.get("nombre") || "").trim();
  if (!nombre) redirect(`/programas/${id}/editar?error=El nombre es obligatorio`);

  const { error } = await supabase
    .from("programs")
    .update({
      nombre,
      descripcion: String(formData.get("descripcion") || "").trim() || null,
      objetivo: String(formData.get("objetivo") || "").trim() || "General",
      nivel: String(formData.get("nivel") || "Intermedio"),
      duracion_semanas: Number(formData.get("duracion_semanas")) || 8,
    })
    .eq("id", id);

  if (error) redirect(`/programas/${id}/editar?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/programas");
  revalidatePath(`/programas/${id}`);
  redirect(`/programas/${id}`);
}

export async function deleteProgram(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("programs").delete().eq("id", id);
  revalidatePath("/programas");
  revalidatePath("/dashboard");
  redirect("/programas");
}

export async function addWeek(programId: string) {
  const { supabase } = await requireUser();

  const { data: weeks } = await supabase
    .from("weeks")
    .select("numero")
    .eq("program_id", programId)
    .order("numero", { ascending: false })
    .limit(1);

  const nextNumero = (weeks?.[0]?.numero ?? 0) + 1;

  const { data: week } = await supabase
    .from("weeks")
    .insert({ program_id: programId, numero: nextNumero })
    .select("id")
    .single();

  revalidatePath(`/programas/${programId}`);
  redirect(`/programas/${programId}?semana=${week?.id ?? ""}`);
}

export async function addSession(programId: string, weekId: string) {
  const { supabase } = await requireUser();

  // Ya no hay un "día de la semana" que sugerir: la sesión nueva se agrega
  // al final del orden de esta semana (se numera sola como "Día N" según
  // esa posición — ver reorderSessions para cambiar el orden después).
  const { count } = await supabase.from("sessions").select("id", { count: "exact", head: true }).eq("week_id", weekId);

  const { data: session } = await supabase
    .from("sessions")
    .insert({
      week_id: weekId,
      nombre: "Nueva sesión",
      objetivo: "",
      movilidad: "Movilidad articular",
      orden: count ?? 0,
    })
    .select("id")
    .single();

  redirect(`/programas/${programId}/sesiones/${session?.id}?semana=${weekId}`);
}

// Reordenar las sesiones de una semana (arrastrar y soltar — ver
// SessionList) — ya no tienen un día fijo, así que "Día 1", "Día 2", etc.
// es directamente su posición acá. orderedIds viene completo (todas las
// sesiones de la semana, en el nuevo orden).
export async function reorderSessions(programId: string, weekId: string, orderedIds: string[]) {
  const { supabase } = await requireUser();

  await Promise.all(
    orderedIds.map((id, orden) => supabase.from("sessions").update({ orden }).eq("id", id).eq("week_id", weekId))
  );

  revalidatePath(`/programas/${programId}?semana=${weekId}`);
}

// deleteSession/duplicateSession se disparan desde la misma página que
// muestran la semana (/programas/[id]?semana=...) — no hace falta
// redirect() a la URL en la que ya se está parado, revalidatePath solo
// refresca en el lugar (mismo criterio que en session-actions.ts).
export async function deleteSession(programId: string, weekId: string, sessionId: string) {
  const { supabase } = await requireUser();
  await supabase.from("sessions").delete().eq("id", sessionId);
  revalidatePath(`/programas/${programId}?semana=${weekId}`);
}

// Copia entrada en calor + bloques + ejercicios de una sesión a otra ya
// creada (misma estructura, cero contenido tocado — ni pesos ni nada, eso
// no existe a este nivel). Compartido por duplicateSession (una sesión) y
// duplicateWeek (todas las sesiones de una semana, una por una) para no
// mantener esta misma lógica de copiado en dos lugares.
async function copySessionContents(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  fromSessionId: string,
  toSessionId: string
) {
  const { data: warmups } = await supabase
    .from("warmup_exercises")
    .select("exercise_id, series, reps, orden")
    .eq("session_id", fromSessionId);

  if (warmups?.length) {
    await supabase.from("warmup_exercises").insert(warmups.map((w) => ({ ...w, session_id: toSessionId })));
  }

  const { data: blocks } = await supabase
    .from("blocks")
    .select("id, nombre, color, descanso, descripcion, orden")
    .eq("session_id", fromSessionId)
    .order("orden");

  for (const b of blocks ?? []) {
    const { data: newBlock } = await supabase
      .from("blocks")
      .insert({
        session_id: toSessionId,
        nombre: b.nombre,
        color: b.color,
        descanso: b.descanso,
        descripcion: b.descripcion,
        orden: b.orden,
      })
      .select("id")
      .single();

    if (!newBlock) continue;

    const { data: exs } = await supabase
      .from("block_exercises")
      .select("exercise_id, series, reps, orden")
      .eq("block_id", b.id);

    if (exs?.length) {
      await supabase.from("block_exercises").insert(exs.map((e) => ({ ...e, block_id: newBlock.id })));
    }
  }
}

export async function duplicateSession(programId: string, weekId: string, sessionId: string) {
  const { supabase } = await requireUser();

  const { data: original } = await supabase
    .from("sessions")
    .select("nombre, objetivo, movilidad")
    .eq("id", sessionId)
    .single();

  if (!original) return revalidatePath(`/programas/${programId}?semana=${weekId}`);

  // Va al final del orden de la semana (como una sesión nueva) en vez de
  // "justo después" de la original con orden+1 — eso podía empatar con el
  // orden de otra sesión ya existente. Si el coach la quiere en otro lugar,
  // la arrastra desde la lista.
  const { count } = await supabase.from("sessions").select("id", { count: "exact", head: true }).eq("week_id", weekId);

  const { data: copy } = await supabase
    .from("sessions")
    .insert({
      week_id: weekId,
      nombre: `${original.nombre} (copia)`,
      objetivo: original.objetivo,
      movilidad: original.movilidad,
      orden: count ?? 0,
    })
    .select("id")
    .single();

  if (copy) await copySessionContents(supabase, sessionId, copy.id);

  revalidatePath(`/programas/${programId}?semana=${weekId}`);
}

// Duplicar la semana entera: clona cada sesión (con su entrada en calor y
// sus bloques/ejercicios) en una semana nueva al final del programa. Pensado
// para periodización — armás la semana 1 con la estructura completa y de
// ahí en más sólo ajustás pesos/series semana a semana en vez de
// reconstruir todo de cero.
export async function duplicateWeek(programId: string, weekId: string) {
  const { supabase } = await requireUser();

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, nombre, objetivo, movilidad, orden")
    .eq("week_id", weekId)
    .order("orden");

  const { data: weeks } = await supabase
    .from("weeks")
    .select("numero")
    .eq("program_id", programId)
    .order("numero", { ascending: false })
    .limit(1);

  const nextNumero = (weeks?.[0]?.numero ?? 0) + 1;

  const { data: newWeek } = await supabase
    .from("weeks")
    .insert({ program_id: programId, numero: nextNumero })
    .select("id")
    .single();

  if (!newWeek) {
    revalidatePath(`/programas/${programId}`);
    return;
  }

  for (const s of sessions ?? []) {
    const { data: newSession } = await supabase
      .from("sessions")
      .insert({
        week_id: newWeek.id,
        nombre: s.nombre,
        objetivo: s.objetivo,
        movilidad: s.movilidad,
        orden: s.orden,
      })
      .select("id")
      .single();

    if (newSession) await copySessionContents(supabase, s.id, newSession.id);
  }

  revalidatePath(`/programas/${programId}`);
  redirect(`/programas/${programId}?semana=${newWeek.id}`);
}

export async function assignGroup(
  programId: string,
  weekId: string,
  weekNumero: number,
  formData: FormData
) {
  const { supabase } = await requireUser();

  const checkedIds = formData.getAll("student_id").map(String);

  // A los tildados: los mete en este programa + esta semana.
  if (checkedIds.length) {
    // Sólo les avisamos a los que recién entran a este grupo — no a los
    // que ya estaban, para no mandarles la misma notificación de nuevo
    // cada vez que el coach retoca la lista.
    const { data: yaEstaban } = await supabase
      .from("students")
      .select("id")
      .eq("programa_id", programId)
      .eq("semana_actual", weekNumero)
      .in("id", checkedIds);
    const yaEstabanIds = new Set((yaEstaban ?? []).map((s) => s.id));
    const nuevos = checkedIds.filter((id) => !yaEstabanIds.has(id));

    await supabase
      .from("students")
      .update({ programa_id: programId, semana_actual: weekNumero })
      .in("id", checkedIds);

    if (nuevos.length) {
      const { data: nuevosStudents } = await supabase.from("students").select("user_id").in("id", nuevos);
      await Promise.all(
        (nuevosStudents ?? [])
          .filter((s) => s.user_id)
          .map((s) =>
            sendPushToUser(supabase, s.user_id as string, {
              title: "Tenés una rutina nueva",
              body: "Tu coach te agregó a un programa de entrenamiento.",
              url: "/alumno",
            })
          )
      );
    }
  }

  // A los que estaban en este programa+semana y ahora se destildaron: los saca.
  const { data: currentlyIn } = await supabase
    .from("students")
    .select("id")
    .eq("programa_id", programId)
    .eq("semana_actual", weekNumero);

  const toRemove = (currentlyIn ?? []).map((s) => s.id).filter((sid) => !checkedIds.includes(sid));
  if (toRemove.length) {
    await supabase.from("students").update({ programa_id: null }).in("id", toRemove);
  }

  revalidatePath("/alumnos");
  revalidatePath(`/programas/${programId}`);
  redirect(`/programas/${programId}?semana=${weekId}`);
}

export async function updateSession(
  programId: string,
  weekId: string,
  sessionId: string,
  goBack: boolean,
  formData: FormData
) {
  const { supabase } = await requireUser();

  const nombre = String(formData.get("nombre") || "").trim() || "Sesión";
  const sessionUrl = `/programas/${programId}/sesiones/${sessionId}?semana=${weekId}`;

  const { error } = await supabase
    .from("sessions")
    .update({
      nombre,
      objetivo: String(formData.get("objetivo") || "").trim(),
      movilidad: String(formData.get("movilidad") || "").trim(),
    })
    .eq("id", sessionId);

  // Antes esto no chequeaba el resultado del update: si fallaba (RLS, red,
  // lo que sea) el botón "Listo — guardar sesión" igual te mandaba de
  // vuelta a la semana como si hubiese guardado, sin ningún aviso de que
  // en realidad no se guardó nada. Ahora si falla te deja en la misma
  // sesión con el error a la vista, en vez de sacarte de la edición.
  if (error) {
    redirect(`${sessionUrl}&error=${encodeURIComponent(error.message || "No se pudo guardar la sesión")}`);
  }

  revalidatePath(`/programas/${programId}/sesiones/${sessionId}`);

  if (goBack) {
    revalidatePath(`/programas/${programId}`);
    redirect(`/programas/${programId}?semana=${weekId}`);
  }

  redirect(`${sessionUrl}&saved=1`);
}
