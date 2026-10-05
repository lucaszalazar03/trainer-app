import { notFound } from "next/navigation";
import CoachShell from "@/components/CoachShell";
import { Crumbs } from "@/components/Crumbs";
import { Icon } from "@/components/Icon";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { SubmitButton } from "@/components/SubmitButton";
import { ExerciseList } from "@/components/ExerciseList";
import { AddExerciseModal } from "@/components/AddExerciseModal";
import { requireUser } from "@/lib/actions/require-user";
import { getDirectSql } from "@/lib/db/direct";
import { friendlyDbError } from "@/lib/db/friendly-error";
import { COLORS } from "@/lib/constants";
import { updateSession } from "../../../actions";
import {
  addBlock,
  updateBlock,
  deleteBlock,
  updateBlockExercise,
  deleteBlockExercise,
  reorderBlockExercises,
  updateWarmupExercise,
  deleteWarmupExercise,
  reorderWarmupExercises,
  addManyExercisesToTargetInline,
  quickCreateExerciseAndAddInline,
} from "../../../session-actions";
import { applyTemplateToSession, applyWarmupTemplateToSession } from "@/app/biblioteca/templates-actions";

const COLOR_NAMES: Record<string, string> = {
  "#49dd8f": "Verde",
  "#5b9bf5": "Azul",
  "#f0ab3d": "Naranja",
  "#b98af5": "Violeta",
  "#f2575f": "Rojo",
  "#38c6c6": "Cian",
};

export default async function SessionEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; sessionId: string }>;
  searchParams: Promise<{ semana?: string; saved?: string; error?: string }>;
}) {
  const { id: programId, sessionId } = await params;
  const { semana, saved, error } = await searchParams;

  const { user } = await requireUser();
  const sql = getDirectSql();

  // Antes estas lecturas iban por supabase-js (la API REST de Supabase), que
  // en el plan chico se cuelga seguido (statement timeout en los logs): la
  // sesión volvía vacía y la pantalla tiraba "no encontrado" o se rompía al
  // editar. Ahora van por conexión directa, igual que los guardados. Como no
  // pasan por RLS, todas filtran a mano por programas del coach (p.coach_id).
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(programId) || !UUID_RE.test(sessionId)) notFound();

  type ExRef = { nombre: string; video_url: string | null } | null;
  type Row = { id: string; series: number | null; reps: string | null; exercises: ExRef };
  type Ses = { id: string; nombre: string; objetivo: string | null; movilidad: string | null; week_id: string; week_numero: number | null };
  let session = null as Ses | null;
  let program = null as { nombre: string } | null;
  let warmups: Row[] = [];
  let blocks: { id: string; nombre: string; color: string | null; descanso: string | null; descripcion: string | null }[] = [];
  let templates: { id: string; nombre: string; tipo: string | null }[] = [];
  let exercises: { id: string; nombre: string; grupo: string | null; equipamiento: string | null }[] = [];
  let hermanas: { id: string }[] = [];
  const exercisesByBlock: Record<string, Row[]> = {};
  let loadError: string | null = null;

  try {
    const [sesRows, progRows, warmRows, blockRows, tplRows, exRows, beRows] = await Promise.all([
      sql<Ses[]>`
        select se.id, se.nombre, se.objetivo, se.movilidad, se.week_id, w.numero as week_numero
        from sessions se join weeks w on w.id = se.week_id join programs p on p.id = w.program_id
        where se.id = ${sessionId} and p.coach_id = ${user.id}
      `,
      sql<{ nombre: string }[]>`select nombre from programs where id = ${programId} and coach_id = ${user.id}`,
      sql<{ id: string; series: number | null; reps: string | null; ex_nombre: string | null; ex_video: string | null }[]>`
        select we.id, we.series, we.reps, e.nombre as ex_nombre, e.video_url as ex_video
        from warmup_exercises we
        join sessions se on se.id = we.session_id join weeks w on w.id = se.week_id join programs p on p.id = w.program_id
        left join exercises e on e.id = we.exercise_id
        where we.session_id = ${sessionId} and p.coach_id = ${user.id}
        order by we.orden
      `,
      sql<{ id: string; nombre: string; color: string | null; descanso: string | null; descripcion: string | null }[]>`
        select b.id, b.nombre, b.color, b.descanso, b.descripcion
        from blocks b join sessions se on se.id = b.session_id join weeks w on w.id = se.week_id join programs p on p.id = w.program_id
        where b.session_id = ${sessionId} and p.coach_id = ${user.id}
        order by b.orden
      `,
      sql<{ id: string; nombre: string; tipo: string | null }[]>`
        select id, nombre, tipo from templates where coach_id = ${user.id} order by nombre
      `,
      sql<{ id: string; nombre: string; grupo: string | null; equipamiento: string | null }[]>`
        select id, nombre, grupo, equipamiento from exercises where coach_id = ${user.id} order by nombre
      `,
      sql<{ id: string; block_id: string; series: number | null; reps: string | null; ex_nombre: string | null; ex_video: string | null }[]>`
        select be.id, be.block_id, be.series, be.reps, e.nombre as ex_nombre, e.video_url as ex_video
        from block_exercises be
        join blocks b on b.id = be.block_id join sessions se on se.id = b.session_id join weeks w on w.id = se.week_id join programs p on p.id = w.program_id
        left join exercises e on e.id = be.exercise_id
        where b.session_id = ${sessionId} and p.coach_id = ${user.id}
        order by be.orden
      `,
    ]);
    session = sesRows[0] ?? null;
    program = progRows[0] ?? null;
    warmups = warmRows.map((r) => ({ id: r.id, series: r.series, reps: r.reps, exercises: r.ex_nombre != null ? { nombre: r.ex_nombre, video_url: r.ex_video } : null }));
    blocks = blockRows;
    templates = tplRows;
    exercises = exRows;
    for (const r of beRows) {
      exercisesByBlock[r.block_id] ??= [];
      exercisesByBlock[r.block_id].push({ id: r.id, series: r.series, reps: r.reps, exercises: r.ex_nombre != null ? { nombre: r.ex_nombre, video_url: r.ex_video } : null });
    }
    if (session) {
      hermanas = await sql<{ id: string }[]>`select id from sessions where week_id = ${session.week_id} order by orden`;
    }
  } catch (err) {
    loadError = friendlyDbError(err) ?? "No se pudo cargar la sesión.";
  }

  if (loadError) {
    return (
      <CoachShell active="/programas">
        <div style={{ maxWidth: 700 }}>
          <Crumbs items={[{ label: "Programas", href: "/programas" }, { label: "Sesión" }]} />
          <div className="banner danger">{loadError} Tus cambios guardados no se perdieron.</div>
          <a href={`/programas/${programId}/sesiones/${sessionId}${semana ? `?semana=${semana}` : ""}`} className="btn primary">
            Reintentar
          </a>
        </div>
      </CoachShell>
    );
  }

  if (!session) notFound();

  const weekId = semana || session.week_id;
  const weekNumero = session.week_numero;
  const backUrl = `/programas/${programId}/sesiones/${sessionId}?semana=${weekId}`;
  const backToWeekUrl = `/programas/${programId}?semana=${weekId}`;

  // Las sesiones ya no tienen un día de la semana fijo (el alumno las hace
  // en el orden que quiera) — lo que se muestra acá es "Día N de M", que
  // es simplemente la posición de esta sesión dentro del orden de la
  // semana.
  const posicion = hermanas.findIndex((s) => s.id === sessionId);
  const numeroDia = posicion >= 0 ? posicion + 1 : null;
  const totalDias = hermanas.length;

  const updateSessionAction = updateSession.bind(null, programId, weekId, sessionId, true);
  const addBlockAction = addBlock.bind(null, sessionId, backUrl);
  const applyTemplateAction = applyTemplateToSession.bind(null, sessionId, backUrl);
  const applyWarmupTemplateAction = applyWarmupTemplateToSession.bind(null, sessionId, backUrl);
  const blockTemplates = templates.filter((t) => t.tipo !== "calentamiento");
  const warmupTemplates = templates.filter((t) => t.tipo === "calentamiento");

  return (
    <CoachShell active="/programas">
      <Crumbs
        items={[
          { label: "Programas", href: "/programas" },
          { label: `${program?.nombre ?? ""}${weekNumero ? ` · Sem ${weekNumero}` : ""}`, href: backToWeekUrl },
          { label: session.nombre },
        ]}
      />

      {saved && <div className="banner success" style={{ maxWidth: 700 }}>Sesión guardada.</div>}
      {error && <div className="banner danger" style={{ maxWidth: 700 }}>{error}</div>}

      <div style={{ maxWidth: 700 }}>
        <form id="session-form" action={updateSessionAction} style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ flex: 2, minWidth: 180 }} className="field">
            <span className="field-label">Nombre</span>
            <input name="nombre" defaultValue={session.nombre} />
          </div>
          <div style={{ flex: 1, minWidth: 130 }} className="field">
            <span className="field-label">Orden en la semana</span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                height: 38,
                fontSize: 13.5,
                fontWeight: 600,
                color: "var(--text-dim)",
              }}
              title="El alumno la puede hacer cualquier día — esto es sólo su lugar en el orden de la semana. Para cambiarlo, reordená las sesiones desde la semana."
            >
              {numeroDia ? `Día ${numeroDia} de ${totalDias}` : "—"}
            </div>
          </div>
          <div style={{ flex: 2, minWidth: 160 }} className="field">
            <span className="field-label">Objetivo</span>
            <input name="objetivo" defaultValue={session.objetivo ?? ""} />
          </div>
          <button type="submit" form="session-form" className="btn primary">
            <Icon name="check" size={15} />
            Guardar y volver
          </button>
        </form>

        <div className="field" style={{ marginBottom: 24 }}>
          <span className="field-label">Movilidad</span>
          <input name="movilidad" form="session-form" defaultValue={session.movilidad ?? ""} placeholder="Movilidad articular" />
        </div>

        <div className="section-h" style={{ marginTop: 0 }}>
          <h3>Entrada en calor</h3>
          <AddExerciseModal
            triggerLabel="Agregar ejercicio"
            exercises={exercises}
            onAddMany={addManyExercisesToTargetInline.bind(null, `warmup:${sessionId}`, backUrl)}
            onCreate={quickCreateExerciseAndAddInline.bind(null, `warmup:${sessionId}`, backUrl)}
          />
        </div>

        {warmupTemplates.length > 0 && (
          <form
            action={applyWarmupTemplateAction}
            style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}
          >
            <select name="template_id" defaultValue="" style={{ maxWidth: 240 }}>
              <option value="" disabled>
                Insertar plantilla de entrada en calor…
              </option>
              {warmupTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
            <SubmitButton className="btn sm">
              <Icon name="plus" size={13} />
              Insertar
            </SubmitButton>
          </form>
        )}

        <div style={{ marginBottom: 28 }}>
          {warmups.length === 0 ? (
            <div className="empty" style={{ textAlign: "left", border: "none", padding: "6px 2px" }}>
              Sin ejercicios de entrada en calor todavía.
            </div>
          ) : (
            <div className="block">
              <ExerciseList
                items={warmups.map((w) => ({
                  id: w.id,
                  nombre: w.exercises?.nombre ?? "(ejercicio eliminado)",
                  videoUrl: w.exercises?.video_url,
                  series: w.series,
                  reps: w.reps,
                  onUpdate: updateWarmupExercise.bind(null, w.id),
                  onDelete: deleteWarmupExercise.bind(null, w.id, backUrl),
                }))}
                onReorder={reorderWarmupExercises.bind(null, sessionId, backUrl)}
              />
            </div>
          )}
        </div>

        <div className="section-h" style={{ marginTop: 0 }}>
          <h3>Bloques</h3>
        </div>

        {blockTemplates.length > 0 && (
          <form
            action={applyTemplateAction}
            style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}
          >
            <select name="template_id" defaultValue="" style={{ maxWidth: 240 }}>
              <option value="" disabled>
                Insertar plantilla…
              </option>
              {blockTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
            <SubmitButton className="btn sm">
              <Icon name="plus" size={13} />
              Insertar
            </SubmitButton>
          </form>
        )}

        {blocks.length === 0 ? (
          <div className="empty" style={{ marginBottom: 16 }}>Todavía no hay bloques. Agregá el primero.</div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            {blocks.map((b, i) => (
              <div key={b.id} className="c-block">
                <form action={updateBlock.bind(null, b.id, backUrl)} className="c-block-head">
                  <div className="a-block-title c-block-title">
                    <span className="c-block-num">B{i + 1}</span>
                    <input name="nombre" defaultValue={b.nombre} className="c-block-name" aria-label="Nombre del bloque" />
                    <div className="c-block-meta">
                      <select name="color" defaultValue={b.color ?? COLORS[0]} title="Color">
                        {COLORS.map((c) => (
                          <option key={c} value={c}>
                            {COLOR_NAMES[c]}
                          </option>
                        ))}
                      </select>
                      <input name="descanso" defaultValue={b.descanso ?? ""} placeholder="Descanso" title="Descanso, ej: 90s" />
                      <SubmitButton className="btn sm c-block-save">Guardar</SubmitButton>
                    </div>
                  </div>
                  <textarea
                    name="descripcion"
                    defaultValue={b.descripcion ?? ""}
                    placeholder="Agregá una descripción del bloque (opcional)…"
                    rows={2}
                    className="c-block-desc"
                  />
                  {b.descanso && (
                    <div className="c-block-rest">
                      <Icon name="clock" size={12} />
                      Descanso {b.descanso}
                    </div>
                  )}
                </form>

                <div className="a-block-body">

                {(exercisesByBlock[b.id] ?? []).length === 0 ? (
                  <div className="ex-row" style={{ color: "var(--text-faint)", fontSize: 12.5 }}>
                    Sin ejercicios en este bloque.
                  </div>
                ) : (
                  <ExerciseList
                    items={exercisesByBlock[b.id].map((e) => ({
                      id: e.id,
                      nombre: e.exercises?.nombre ?? "(ejercicio eliminado)",
                      videoUrl: e.exercises?.video_url,
                      series: e.series,
                      reps: e.reps,
                      onUpdate: updateBlockExercise.bind(null, e.id),
                      onDelete: deleteBlockExercise.bind(null, e.id, backUrl),
                    }))}
                    onReorder={reorderBlockExercises.bind(null, b.id, backUrl)}
                  />
                )}

                <div className="a-block-footer c-block-footer">
                  <AddExerciseModal
                    triggerLabel="Agregar ejercicio de la biblioteca"
                    exercises={exercises}
                    onAddMany={addManyExercisesToTargetInline.bind(null, `block:${b.id}`, backUrl)}
                    onCreate={quickCreateExerciseAndAddInline.bind(null, `block:${b.id}`, backUrl)}
                  />
                  <form action={deleteBlock.bind(null, b.id, backUrl)}>
                    <ConfirmSubmitButton confirmMessage="¿Eliminar este bloque y todos sus ejercicios?" className="btn ghost sm" style={{ color: "var(--danger)" }}>
                      Eliminar bloque
                    </ConfirmSubmitButton>
                  </form>
                </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <form action={addBlockAction} style={{ marginBottom: 80 }}>
          <SubmitButton className="btn">
            <Icon name="plus" size={15} />
            Agregar bloque
          </SubmitButton>
        </form>
      </div>

      <div className="session-save-bar">
        <button type="submit" form="session-form" className="btn primary block-w" style={{ maxWidth: 700 }}>
          <Icon name="check" size={16} />
          Listo — guardar sesión
        </button>
      </div>
    </CoachShell>
  );
}
