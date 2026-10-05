"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/actions/require-student";
import { sendPushToUser } from "@/lib/push-server";
import { inicioDeHoyArgentina } from "@/lib/date";

export async function logTraining(
  sessionId: string,
  sessionNombre: string,
  programaNombre: string,
  formData: FormData
) {
  const { supabase, student } = await requireStudent();

  const doneBlocks = JSON.parse(String(formData.get("done_blocks") || "{}"));
  const comentario = String(formData.get("comentario") || "").trim() || null;
  const tiempoMin = Number(formData.get("tiempo_min")) || null;

  const { data: trainingLog } = await supabase
    .from("training_logs")
    .insert({
      student_id: student.id,
      session_id: sessionId,
      session_nombre: sessionNombre,
      programa_nombre: programaNombre,
      done_blocks: doneBlocks,
      comentario,
      tiempo_min: tiempoMin,
    })
    .select("id")
    .single();

  // Pesos que el alumno cargó por ejercicio durante el entrenamiento (ver
  // TrainingSession) — un registro por ejercicio en exercise_logs, para
  // poder mostrar "última vez" la próxima vez y el historial al coach.
  // Quedan atados a este training_log: si el alumno lo deshace después
  // (undoTraining), el ON DELETE CASCADE de la tabla se lleva puesto
  // también estos pesos — no tendría sentido que sigan contando en el
  // historial un entrenamiento que ya no existe.
  type PesoInput = { exerciseId: string; peso: number };
  let pesos: PesoInput[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("pesos") || "[]"));
    if (Array.isArray(parsed)) pesos = parsed;
  } catch {
    // Si viene corrupto simplemente no guardamos pesos — no vale la pena
    // hacer fallar todo el registro del entrenamiento por esto.
  }
  if (trainingLog && pesos.length > 0) {
    const rows = pesos
      .filter((p) => p && typeof p.exerciseId === "string" && p.exerciseId && Number.isFinite(p.peso) && p.peso > 0)
      .map((p) => ({
        student_id: student.id,
        exercise_id: p.exerciseId,
        peso_kg: p.peso,
        training_log_id: trainingLog.id,
      }));
    if (rows.length > 0) await supabase.from("exercise_logs").insert(rows);
  }

  // Mismo criterio que el check-in: el coach se entera al toque de que el
  // alumno terminó, sin tener que entrar a revisar uno por uno.
  await sendPushToUser(supabase, student.coach_id, {
    title: "Entrenamiento completado",
    body: `${student.nombre} terminó "${sessionNombre}".`,
    url: `/alumnos/${student.id}`,
  });

  revalidatePath("/alumno");
  revalidatePath("/alumno/progreso");
  redirect("/alumno?entrenado=1");
}

export async function undoTraining(logId: string) {
  const { supabase } = await requireStudent();

  // is_own_student(student_id) en la policy de RLS ya evita que borres el
  // log de otro alumno aunque alguien manipule el id a mano.
  await supabase.from("training_logs").delete().eq("id", logId);

  revalidatePath("/alumno");
  revalidatePath("/alumno/progreso");
  redirect("/alumno?deshecho=1");
}

export async function submitCheckin(formData: FormData) {
  const { supabase, student } = await requireStudent();

  const energia = Number(formData.get("energia")) || 3;
  const dolor = Number(formData.get("dolor")) || 1;
  const sueno = Number(formData.get("sueno")) || 3;

  const startOfToday = inicioDeHoyArgentina();

  const { data: existing } = await supabase
    .from("checkins")
    .select("id")
    .eq("student_id", student.id)
    .gte("fecha", startOfToday.toISOString())
    .maybeSingle();

  if (existing) {
    await supabase.from("checkins").update({ energia, dolor, sueno, visto: false }).eq("id", existing.id);
  } else {
    await supabase.from("checkins").insert({ student_id: student.id, energia, dolor, sueno });
  }

  await sendPushToUser(supabase, student.coach_id, {
    title: "Nuevo check-in",
    body: `${student.nombre} completó su check-in de hoy.`,
    url: `/alumnos/${student.id}`,
  });

  revalidatePath("/alumno");
  revalidatePath("/alumno/checkin");
  revalidatePath("/alumno/progreso");
  // Antes volvía a /alumno/checkin?saved=1 (se quedaba en la misma
  // pantalla). Ahora que el check-in es lo primero que ve el alumno al
  // entrar a la app, al terminarlo lo lleva derecho al Home para que vea y
  // pueda arrancar su entrenamiento del día.
  redirect("/alumno?checkin=1");
}
