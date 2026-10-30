import type { TransactionSql } from "postgres";

// ---------- Copiar sesiones EXACTAMENTE iguales ----------
//
// Antes la copia se hacía paso a paso (una consulta por bloque, por la API
// REST) y si alguna se cortaba a la mitad la copia quedaba incompleta sin
// avisar — así a la semana 2 de Delfina le faltaron ejercicios y un bloque.
// Ahora se copia todo en UNA transacción por conexión directa: o se copia
// todo (sesión con día/orden/movilidad, entrada en calor, bloques con
// nombre/color/descanso/descripción/orden, y ejercicios con series/reps/
// orden), o no se copia nada y se muestra el error.
export async function copySessionsExact(
  tx: TransactionSql,
  sources: { sessionId: string; toWeekId: string; nombre?: string; orden?: number }[]
) {
  if (!sources.length) return;
  await tx`create temp table m_ses (old_id uuid, new_id uuid, to_week uuid, nombre text, orden int) on commit drop`;
  for (const src of sources) {
    await tx`insert into m_ses values (${src.sessionId}, gen_random_uuid(), ${src.toWeekId}, ${src.nombre ?? null}, ${src.orden ?? null})`;
  }
  await tx`
    insert into sessions (id, week_id, nombre, dia, objetivo, movilidad, orden)
    select m.new_id, m.to_week, coalesce(m.nombre, s.nombre), s.dia, s.objetivo, s.movilidad, coalesce(m.orden, s.orden)
    from sessions s join m_ses m on m.old_id = s.id`;
  await tx`
    insert into warmup_exercises (session_id, exercise_id, series, reps, orden)
    select m.new_id, w.exercise_id, w.series, w.reps, w.orden
    from warmup_exercises w join m_ses m on m.old_id = w.session_id`;
  await tx`
    create temp table m_bl on commit drop as
    select b.id as old_id, gen_random_uuid() as new_id, m.new_id as new_session
    from blocks b join m_ses m on m.old_id = b.session_id`;
  await tx`
    insert into blocks (id, session_id, nombre, color, descanso, orden, descripcion)
    select mb.new_id, mb.new_session, b.nombre, b.color, b.descanso, b.orden, b.descripcion
    from blocks b join m_bl mb on mb.old_id = b.id`;
  await tx`
    insert into block_exercises (block_id, exercise_id, series, reps, orden)
    select mb.new_id, e.exercise_id, e.series, e.reps, e.orden
    from block_exercises e join m_bl mb on mb.old_id = e.block_id`;
}

