import CoachShell from "@/components/CoachShell";
import { Crumbs } from "@/components/Crumbs";
import { Icon } from "@/components/Icon";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUser } from "@/lib/actions/require-user";
import { friendlyDbError } from "@/lib/db/friendly-error";
import { listExerciseOptions, type ExerciseOption } from "@/lib/db/exercises";
import { addExerciseToTarget, quickCreateExerciseAndAdd } from "../../session-actions";

export default async function AgregarEjercicioPage({
  searchParams,
}: {
  searchParams: Promise<{ target?: string; back?: string; q?: string; error?: string }>;
}) {
  const { target = "", back = "/programas", q = "", error } = await searchParams;

  // Conexión directa (ver src/lib/db/exercises.ts) en vez de la API REST,
  // que cortaba por timeout y devolvía la lista incompleta sin avisar.
  const { user } = await requireUser();
  let exercises: ExerciseOption[] = [];
  let loadError: string | null = null;
  try {
    const all = await listExerciseOptions(user.id);
    const needle = q.trim().toLowerCase();
    exercises = needle ? all.filter((ex) => ex.nombre.toLowerCase().includes(needle)) : all;
  } catch (err) {
    loadError = friendlyDbError(err) ?? "No se pudo cargar tu biblioteca de ejercicios.";
  }

  const isWarmup = target.startsWith("warmup:");
  const isTemplateBlock = target.startsWith("templateblock:");

  return (
    <CoachShell active="/programas">
      <div style={{ maxWidth: 560 }}>
        <Crumbs items={[{ label: isTemplateBlock ? "Volver a la plantilla" : "Volver a la sesión", href: back }]} />
        <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>
          Agregar ejercicio {isWarmup ? "a entrada en calor" : isTemplateBlock ? "a la plantilla" : "al bloque"}
        </h1>
        <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "0 0 20px" }}>
          Buscá en tu biblioteca o cargá uno nuevo al toque.
        </p>

        {error && <div className="banner danger">{decodeURIComponent(error)}</div>}
        {loadError && <div className="banner danger">{loadError}</div>}

        <form method="GET" className="search-wrap" style={{ marginBottom: 18 }}>
          <input type="hidden" name="target" value={target} />
          <input type="hidden" name="back" value={back} />
          <Icon name="search" size={15} />
          <input name="q" defaultValue={q} placeholder="Buscar en la biblioteca…" />
        </form>

        <div style={{ display: "grid", gap: 8, marginBottom: 24 }}>
          {!exercises || exercises.length === 0 ? (
            <p style={{ color: "var(--text-faint)", fontSize: 13 }}>
              {q ? "Sin resultados para esa búsqueda." : "Todavía no tenés ejercicios en tu biblioteca."}
            </p>
          ) : (
            exercises.map((ex) => (
              <div key={ex.id} className="list-row card" style={{ justifyContent: "space-between" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{ex.nombre}</div>
                  {(ex.grupo || ex.equipamiento) && (
                    <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
                      {[ex.grupo, ex.equipamiento].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
                <form action={addExerciseToTarget}>
                  <input type="hidden" name="target" value={target} />
                  <input type="hidden" name="back" value={back} />
                  <input type="hidden" name="exerciseId" value={ex.id} />
                  <SubmitButton className="btn primary sm">Agregar</SubmitButton>
                </form>
              </div>
            ))
          )}
        </div>

        <div className="card card-pad" style={{ borderStyle: "dashed", borderColor: "var(--border-strong)" }}>
          <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 10 }}>
            ¿No está en tu lista? Creá un ejercicio nuevo y lo agrega directo.
          </div>
          <form action={quickCreateExerciseAndAdd} style={{ display: "flex", gap: 8 }}>
            <input type="hidden" name="target" value={target} />
            <input type="hidden" name="back" value={back} />
            <input name="nombre" defaultValue={q} placeholder="Nombre del ejercicio nuevo" style={{ flex: 1 }} />
            <SubmitButton className="btn" style={{ whiteSpace: "nowrap" }}>
              Crear y agregar
            </SubmitButton>
          </form>
        </div>
      </div>
    </CoachShell>
  );
}
