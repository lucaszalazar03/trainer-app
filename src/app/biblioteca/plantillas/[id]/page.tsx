import { notFound } from "next/navigation";
import CoachShell from "@/components/CoachShell";
import { Crumbs } from "@/components/Crumbs";
import { Icon } from "@/components/Icon";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { SubmitButton } from "@/components/SubmitButton";
import { ExerciseRowEditor } from "@/components/ExerciseRowEditor";
import { AddExerciseModal } from "@/components/AddExerciseModal";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/actions/require-user";
import { friendlyDbError } from "@/lib/db/friendly-error";
import { listExerciseOptions, type ExerciseOption } from "@/lib/db/exercises";
import { COLORS } from "@/lib/constants";
import {
  updateTemplate,
  deleteTemplate,
  addTemplateBlock,
  updateTemplateBlock,
  deleteTemplateBlock,
  updateTemplateBlockExercise,
  deleteTemplateBlockExercise,
  addManyExercisesToTemplateBlockInline,
  quickCreateExerciseAndAddToTemplateBlockInline,
  updateTemplateWarmupExercise,
  deleteTemplateWarmupExercise,
  addManyExercisesToTemplateWarmupInline,
  quickCreateExerciseAndAddToTemplateWarmupInline,
} from "../../templates-actions";

const COLOR_NAMES: Record<string, string> = {
  "#49dd8f": "Verde",
  "#5b9bf5": "Azul",
  "#f0ab3d": "Naranja",
  "#b98af5": "Violeta",
  "#f2575f": "Rojo",
  "#38c6c6": "Cian",
};

export default async function PlantillaEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id: templateId } = await params;
  const { saved, error } = await searchParams;

  const supabase = await createClient();

  const { data: template } = await supabase.from("templates").select("id, nombre, tipo").eq("id", templateId).maybeSingle();
  if (!template) notFound();

  const esCalentamiento = template.tipo === "calentamiento";
  const backUrl = `/biblioteca/plantillas/${templateId}`;

  const updateTemplateAction = updateTemplate.bind(null, templateId);
  const deleteTemplateAction = deleteTemplate.bind(null, templateId);

  // Toda la biblioteca del coach, para que el modal de "Agregar ejercicio"
  // busque al toque en el cliente — ver AddExerciseModal.
  // Por conexión directa (ver src/lib/db/exercises.ts): antes iba por la API
  // REST ignorando el error, y si cortaba por timeout el modal mostraba la
  // biblioteca incompleta. Si falla, mejor mostrar el error.
  const { user } = await requireUser();
  let exercises: ExerciseOption[] = [];
  let exercisesError: string | null = null;
  try {
    exercises = await listExerciseOptions(user.id);
  } catch (err) {
    exercisesError = friendlyDbError(err) ?? "No se pudo cargar tu biblioteca de ejercicios.";
  }

  return (
    <CoachShell active="/biblioteca">
      <Crumbs items={[{ label: "Biblioteca", href: "/biblioteca?tab=plantillas" }, { label: template.nombre }]} />

      {saved && <div className="banner success" style={{ maxWidth: 700 }}>Plantilla guardada.</div>}
      {error && <div className="banner danger" style={{ maxWidth: 700 }}>{decodeURIComponent(error)}</div>}
      {exercisesError && (
        <div className="banner danger" style={{ maxWidth: 700 }}>
          {exercisesError} <a href={backUrl}>Reintentar</a>
        </div>
      )}

      <div style={{ maxWidth: 700 }}>
        <form action={updateTemplateAction} style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 12 }}>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <span className="field-label">Nombre de la plantilla</span>
            <input name="nombre" defaultValue={template.nombre} />
          </div>
          <SubmitButton className="btn primary">
            <Icon name="check" size={15} />
            Guardar
          </SubmitButton>
        </form>

        <span className={`badge ${esCalentamiento ? "blue" : "neutral"}`} style={{ marginBottom: 24, display: "inline-flex" }}>
          {esCalentamiento ? "Entrada en calor" : "Bloque de ejercicios"}
        </span>

        {esCalentamiento ? (
          <>
            <div className="section-h" style={{ marginTop: 24 }}>
              <h3>Ejercicios</h3>
              <AddExerciseModal
                triggerLabel="Agregar ejercicio"
                exercises={exercises}
                onAddMany={addManyExercisesToTemplateWarmupInline.bind(null, templateId, backUrl)}
                onCreate={quickCreateExerciseAndAddToTemplateWarmupInline.bind(null, templateId, backUrl)}
              />
            </div>
            <TemplateWarmupList templateId={templateId} backUrl={backUrl} supabase={supabase} />
          </>
        ) : (
          <TemplateBlocks templateId={templateId} backUrl={backUrl} exercises={exercises} supabase={supabase} />
        )}

        <div style={{ marginTop: 40 }}>
          <form action={deleteTemplateAction}>
            <ConfirmSubmitButton
              confirmMessage={`¿Eliminar la plantilla "${template.nombre}"? Esta acción no se puede deshacer.`}
              className="btn danger"
            >
              Eliminar plantilla
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>
    </CoachShell>
  );
}

async function TemplateWarmupList({
  templateId,
  backUrl,
  supabase,
}: {
  templateId: string;
  backUrl: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
}) {
  const { data: warmups } = await supabase
    .from("template_warmup_exercises")
    .select("id, series, reps, exercises(nombre)")
    .eq("template_id", templateId)
    .order("orden");

  if (!warmups || warmups.length === 0) {
    return <div className="empty" style={{ marginBottom: 16 }}>Todavía no hay ejercicios. Agregá el primero.</div>;
  }

  return (
    <div className="block" style={{ marginBottom: 16 }}>
      {warmups.map((w) => (
        <ExerciseRowEditor
          key={w.id}
          nombre={(w.exercises as unknown as { nombre: string } | null)?.nombre ?? "(ejercicio eliminado)"}
          series={w.series}
          reps={w.reps}
          onUpdate={updateTemplateWarmupExercise.bind(null, w.id)}
          onDelete={deleteTemplateWarmupExercise.bind(null, w.id, backUrl)}
        />
      ))}
    </div>
  );
}

async function TemplateBlocks({
  templateId,
  backUrl,
  exercises,
  supabase,
}: {
  templateId: string;
  backUrl: string;
  exercises: { id: string; nombre: string; grupo: string | null; equipamiento: string | null }[];
  supabase: Awaited<ReturnType<typeof createClient>>;
}) {
  const { data: blocks } = await supabase
    .from("template_blocks")
    .select("id, nombre, color, descanso, descripcion")
    .eq("template_id", templateId)
    .order("orden");

  const blockIds = blocks?.map((b) => b.id) ?? [];
  const exercisesByBlock: Record<
    string,
    { id: string; series: number | null; reps: string | null; exercises: { nombre: string } | null }[]
  > = {};
  if (blockIds.length) {
    const { data: exs } = await supabase
      .from("template_block_exercises")
      .select("id, template_block_id, series, reps, exercises(nombre)")
      .in("template_block_id", blockIds)
      .order("orden");
    for (const e of exs ?? []) {
      exercisesByBlock[e.template_block_id] ??= [];
      exercisesByBlock[e.template_block_id].push(e as never);
    }
  }

  const addBlockAction = addTemplateBlock.bind(null, templateId, backUrl);

  return (
    <>
      <div className="section-h" style={{ marginTop: 0 }}>
        <h3>Bloques</h3>
      </div>

      {!blocks || blocks.length === 0 ? (
        <div className="empty" style={{ marginBottom: 16 }}>Todavía no hay bloques. Agregá el primero.</div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          {blocks.map((b, i) => (
            <div key={b.id} className="c-block">
              <form action={updateTemplateBlock.bind(null, b.id, backUrl)} className="c-block-head">
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
                exercisesByBlock[b.id].map((e) => (
                  <ExerciseRowEditor
                    key={e.id}
                    nombre={e.exercises?.nombre ?? "(ejercicio eliminado)"}
                    series={e.series}
                    reps={e.reps}
                    onUpdate={updateTemplateBlockExercise.bind(null, e.id)}
                    onDelete={deleteTemplateBlockExercise.bind(null, e.id, backUrl)}
                  />
                ))
              )}

              <div className="a-block-footer c-block-footer">
                <AddExerciseModal
                  triggerLabel="Agregar ejercicio de la biblioteca"
                  exercises={exercises}
                  onAddMany={addManyExercisesToTemplateBlockInline.bind(null, b.id, backUrl)}
                  onCreate={quickCreateExerciseAndAddToTemplateBlockInline.bind(null, b.id, backUrl)}
                />
                <form action={deleteTemplateBlock.bind(null, b.id, backUrl)}>
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

      <form action={addBlockAction} style={{ marginBottom: 40 }}>
        <SubmitButton className="btn">
          <Icon name="plus" size={15} />
          Agregar bloque
        </SubmitButton>
      </form>
    </>
  );
}
