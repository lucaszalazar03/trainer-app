import { notFound } from "next/navigation";
import AlumnoShell from "@/components/AlumnoShell";
import { Crumbs } from "@/components/Crumbs";
import { TrainingSession } from "@/components/TrainingSession";
import { requireStudent } from "@/lib/actions/require-student";
import { asUser } from "@/lib/db/as-user";
import { logTraining } from "../../actions";

export default async function EntrenarPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { user, student } = await requireStudent();
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) notFound();

  // Todo por conexión directa con las reglas de seguridad del alumno (ver
  // as-user.ts), en una sola tanda: antes eran 5 consultas REST en cadena y
  // si alguna se cortaba la sesión no abría.
  type ExRow = { id: string; exercise_id: string; series: number | null; reps: string | null; nombre: string | null; video_url: string | null };
  const [[session], warmupRows, blocksRaw, blockExRows, logs] = await asUser(user.id, (sql) =>
    Promise.all([
      sql<{ id: string; nombre: string; objetivo: string | null; movilidad: string | null; programa_nombre: string | null; week_numero: number | null }[]>`
        select se.id, se.nombre, se.objetivo, se.movilidad, p.nombre as programa_nombre, w.numero as week_numero
        from sessions se left join weeks w on w.id = se.week_id left join programs p on p.id = w.program_id
        where se.id = ${sessionId}`,
      sql<ExRow[]>`
        select x.id, x.exercise_id, x.series, x.reps, e.nombre, e.video_url
        from warmup_exercises x left join exercises e on e.id = x.exercise_id
        where x.session_id = ${sessionId} order by x.orden`,
      sql<{ id: string; nombre: string; color: string | null; descanso: string | null; descripcion: string | null }[]>`
        select id, nombre, color, descanso, descripcion from blocks where session_id = ${sessionId} order by orden`,
      sql<(ExRow & { block_id: string })[]>`
        select x.id, x.block_id, x.exercise_id, x.series, x.reps, e.nombre, e.video_url
        from block_exercises x join blocks b on b.id = x.block_id left join exercises e on e.id = x.exercise_id
        where b.session_id = ${sessionId} order by x.orden`,
      // Último peso que el alumno cargó en cada ejercicio de esta sesión (en
      // cualquier sesión anterior), para mostrárselo como referencia.
      sql<{ exercise_id: string; peso_kg: string | number }[]>`
        select distinct on (l.exercise_id) l.exercise_id, l.peso_kg
        from exercise_logs l
        where l.student_id = ${student.id}
          and l.exercise_id in (
            select exercise_id from warmup_exercises where session_id = ${sessionId}
            union select x.exercise_id from block_exercises x join blocks b on b.id = x.block_id where b.session_id = ${sessionId})
        order by l.exercise_id, l.fecha desc`,
    ])
  );

  if (!session) notFound();
  const programaNombre = session.programa_nombre ?? "";

  const toEx = (r: ExRow) => ({
    id: r.id,
    exerciseId: r.exercise_id,
    nombre: r.nombre ?? "Ejercicio",
    videoUrl: r.video_url ?? null,
    series: r.series,
    reps: r.reps,
  });
  const warmups = warmupRows.map(toEx);
  const exercisesByBlock: Record<string, ReturnType<typeof toEx>[]> = {};
  for (const r of blockExRows) (exercisesByBlock[r.block_id] ??= []).push(toEx(r));

  const blocks = blocksRaw.map((b) => ({
    id: b.id,
    nombre: b.nombre,
    color: b.color,
    descanso: b.descanso,
    descripcion: b.descripcion,
    ejercicios: exercisesByBlock[b.id] ?? [],
  }));

  const pesosUltimos = new Map<string, number>(logs.map((l) => [l.exercise_id, Number(l.peso_kg)]));

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
          {programaNombre} {session.week_numero != null ? `· Sem ${session.week_numero}` : ""}
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
