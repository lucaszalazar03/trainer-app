import { notFound } from "next/navigation";
import AlumnoShell from "@/components/AlumnoShell";
import { Crumbs } from "@/components/Crumbs";
import { TrainingSession } from "@/components/TrainingSession";
import { requireStudent } from "@/lib/actions/require-student";
import { logTraining } from "../../actions";

export default async function EntrenarPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { supabase, student } = await requireStudent();

  // La sesión, el warmup y los bloques sólo dependen de sessionId — no uno
  // del otro — así que van en paralelo en vez de tres round-trips en serie.
  const [{ data: session }, { data: warmupsRaw }, { data: blocksRaw }] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, nombre, objetivo, movilidad, week_id, weeks(numero, program_id, programs(nombre))")
      .eq("id", sessionId)
      .maybeSingle(),
    supabase
      .from("warmup_exercises")
      .select("id, exercise_id, series, reps, exercises(nombre, video_url)")
      .eq("session_id", sessionId)
      .order("orden"),
    supabase
      .from("blocks")
      .select("id, nombre, color, descripcion")
      .eq("session_id", sessionId)
      .order("orden"),
  ]);

  if (!session) notFound();

  const weekInfo = session.weeks as unknown as { numero: number; program_id: string; programs: { nombre: string } | null } | null;
  const programaNombre = weekInfo?.programs?.nombre ?? "";

  const warmups = (warmupsRaw ?? []).map((w) => {
    const ex = w.exercises as unknown as { nombre: string; video_url: string | null } | null;
    return {
      id: w.id,
      exerciseId: w.exercise_id,
      nombre: ex?.nombre ?? "Ejercicio",
      videoUrl: ex?.video_url ?? null,
      series: w.series,
      reps: w.reps,
    };
  });

  const blockIds = (blocksRaw ?? []).map((b) => b.id);
  const exercisesByBlock: Record<
    string,
    { id: string; exerciseId: string; nombre: string; videoUrl: string | null; series: number | null; reps: string | null }[]
  > = {};
  if (blockIds.length) {
    const { data: exs } = await supabase
      .from("block_exercises")
      .select("id, block_id, exercise_id, series, reps, exercises(nombre, video_url)")
      .in("block_id", blockIds)
      .order("orden");
    for (const e of exs ?? []) {
      const ex = e.exercises as unknown as { nombre: string; video_url: string | null } | null;
      exercisesByBlock[e.block_id] ??= [];
      exercisesByBlock[e.block_id].push({
        id: e.id,
        exerciseId: e.exercise_id,
        nombre: ex?.nombre ?? "Ejercicio",
        videoUrl: ex?.video_url ?? null,
        series: e.series,
        reps: e.reps,
      });
    }
  }

  const blocks = (blocksRaw ?? []).map((b) => ({
    id: b.id,
    nombre: b.nombre,
    color: b.color,
    descripcion: b.descripcion,
    ejercicios: exercisesByBlock[b.id] ?? [],
  }));

  // Último peso que el alumno cargó en cada uno de estos ejercicios (en
  // cualquier sesión anterior, no sólo ésta) — se lo mostramos como
  // referencia al lado de cada campo de peso, para que sepa con qué
  // arrancar hoy. Una sola consulta trayendo todo el historial reciente de
  // los ejercicios de esta sesión, ordenado por fecha; nos quedamos con la
  // primera fila (la más nueva) que aparece para cada exercise_id.
  const allExerciseIds = Array.from(
    new Set([...warmups.map((w) => w.exerciseId), ...Object.values(exercisesByBlock).flat().map((e) => e.exerciseId)])
  );
  const pesosUltimos = new Map<string, number>();
  if (allExerciseIds.length) {
    const { data: logs } = await supabase
      .from("exercise_logs")
      .select("exercise_id, peso_kg, fecha")
      .eq("student_id", student.id)
      .in("exercise_id", allExerciseIds)
      .order("fecha", { ascending: false })
      .limit(300);
    for (const log of logs ?? []) {
      if (!pesosUltimos.has(log.exercise_id)) pesosUltimos.set(log.exercise_id, log.peso_kg);
    }
  }

  const warmupsConPeso = warmups.map((w) => ({ ...w, pesoUltimo: pesosUltimos.get(w.exerciseId) ?? null }));
  const blocksConPeso = blocks.map((b) => ({
    ...b,
    ejercicios: b.ejercicios.map((e) => ({ ...e, pesoUltimo: pesosUltimos.get(e.exerciseId) ?? null })),
  }));

  const action = logTraining.bind(null, sessionId, session.nombre, programaNombre);

  return (
    <AlumnoShell active="/alumno" nombre={student.nombre}>
      <Crumbs items={[{ label: "Hoy", href: "/alumno" }, { label: session.nombre }]} />

      <div className="train-head">
        <div className="prog">
          {programaNombre} {weekInfo ? `· Sem ${weekInfo.numero}` : ""}
        </div>
        <h2>{session.nombre}</h2>
        {session.movilidad && (
          <p className="movilidad">
            <strong>Movilidad:</strong> {session.movilidad}
          </p>
        )}
      </div>

      <TrainingSession warmups={warmupsConPeso} blocks={blocksConPeso} action={action} />
    </AlumnoShell>
  );
}
