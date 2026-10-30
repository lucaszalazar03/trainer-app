"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/actions/require-user";
import { sendPushToUser } from "@/lib/push-server";
import { getDirectSql } from "@/lib/db/direct";
import { copySessionsExact } from "@/lib/db/copy-sessions";

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

export async function duplicateSession(programId: string, weekId: string, sessionId: string) {
  const { user } = await requireUser();
  let errorMsg: string | null = null;
  try {
    await getDirectSql().begin(async (tx) => {
      const [original] = await tx<{ nombre: string }[]>`
        select se.nombre from sessions se join weeks w on w.id = se.week_id join programs p on p.id = w.program_id
        where se.id = ${sessionId} and se.week_id = ${weekId} and p.coach_id = ${user.id}`;
      if (!original) throw new Error("No se encontró la sesión (o no te pertenece).");
      // Va al final del orden de la semana; si el coach la quiere en otro
      // lugar, la arrastra desde la lista.
      const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from sessions where week_id = ${weekId}`;
      await copySessionsExact(tx, [{ sessionId, toWeekId: weekId, nombre: `${original.nombre} (copia)`, orden: n }]);
    });
  } catch (err) {
    errorMsg = (err as Error).message || "No se pudo duplicar la sesión.";
  }
  revalidatePath("/", "layout");
  if (errorMsg) redirect(`/programas/${programId}?semana=${weekId}&error=${encodeURIComponent(errorMsg)}`);
}

// Duplicar la semana entera en una semana nueva al final del programa, con
// TODO idéntico (ver copySessionsExact). Pensado para periodización: armás
// la semana 1 completa y de ahí en más sólo ajustás pesos/series.
export async function duplicateWeek(programId: string, weekId: string) {
  const { user } = await requireUser();
  let newWeekId: string | null = null;
  let errorMsg: string | null = null;
  try {
    await getDirectSql().begin(async (tx) => {
      const [ok] = await tx<{ id: string }[]>`
        select w.id from weeks w join programs p on p.id = w.program_id
        where w.id = ${weekId} and w.program_id = ${programId} and p.coach_id = ${user.id}`;
      if (!ok) throw new Error("No se encontró la semana (o no te pertenece).");
      const [nw] = await tx<{ id: string }[]>`
        insert into weeks (program_id, numero)
        select ${programId}, coalesce(max(numero), 0) + 1 from weeks where program_id = ${programId}
        returning id`;
      newWeekId = nw.id;
      const sessions = await tx<{ id: string }[]>`select id from sessions where week_id = ${weekId} order by orden`;
      await copySessionsExact(tx, sessions.map((s) => ({ sessionId: s.id, toWeekId: nw.id })));
    });
  } catch (err) {
    errorMsg = (err as Error).message || "No se pudo duplicar la semana.";
  }
  revalidatePath("/", "layout");
  if (errorMsg || !newWeekId) {
    redirect(`/programas/${programId}?semana=${weekId}&error=${encodeURIComponent(errorMsg || "No se pudo duplicar la semana.")}`);
  }
  redirect(`/programas/${programId}?semana=${newWeekId}`);
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
      // Día de la semana en que el alumno la ve ("Lunes", "Miércoles"…).
      // Es sólo una guía: si no la hace ese día, la puede hacer otro.
      ...(formData.has("dia") ? { dia: String(formData.get("dia") || "") || null } : {}),
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

// Eliminar una semana entera (con sus sesiones, entrada en calor, bloques y
// ejercicios). Las semanas siguientes se renumeran para que no queden
// huecos (si borrás la 2, la 3 pasa a ser la 2), y los alumnos que estaban
// en una semana posterior se corren uno para atrás, así siguen viendo la
// misma semana que antes. El historial de entrenamientos ya hechos no se
// borra (queda guardado con el nombre de la sesión).
// Conexión directa, todo en una transacción; se chequea que el programa
// sea del coach.
export async function deleteWeek(programId: string, weekId: string) {
  const { user } = await requireUser();
  const sql = getDirectSql();

  let errorMsg: string | null = null;
  try {
    await sql.begin(async (tx) => {
      const [week] = await tx<{ numero: number }[]>`
        select w.numero from weeks w join programs p on p.id = w.program_id
        where w.id = ${weekId} and w.program_id = ${programId} and p.coach_id = ${user.id}
        for update of w`;
      if (!week) throw new Error("No se encontró la semana (o no te pertenece).");

      await tx`delete from block_exercises where block_id in (
        select b.id from blocks b join sessions se on se.id = b.session_id where se.week_id = ${weekId})`;
      await tx`delete from warmup_exercises where session_id in (select id from sessions where week_id = ${weekId})`;
      await tx`delete from blocks where session_id in (select id from sessions where week_id = ${weekId})`;
      await tx`delete from sessions where week_id = ${weekId}`;
      await tx`delete from weeks where id = ${weekId}`;

      await tx`update weeks set numero = numero - 1 where program_id = ${programId} and numero > ${week.numero}`;
      await tx`update students set semana_actual = semana_actual - 1
        where programa_id = ${programId} and coach_id = ${user.id} and semana_actual > ${week.numero}`;
      // Si alguien estaba justo en la última semana y se borró, que quede en
      // la nueva última (o en la 1 si no queda ninguna).
      await tx`update students set semana_actual = greatest(1, coalesce((select max(numero) from weeks where program_id = ${programId}), 1))
        where programa_id = ${programId} and coach_id = ${user.id}
          and semana_actual > coalesce((select max(numero) from weeks where program_id = ${programId}), 1)`;
    });
  } catch (err) {
    errorMsg = (err as Error).message || "No se pudo eliminar la semana.";
  }

  revalidatePath("/", "layout");
  if (errorMsg) redirect(`/programas/${programId}?error=${encodeURIComponent(errorMsg)}`);
  redirect(`/programas/${programId}`);
}
