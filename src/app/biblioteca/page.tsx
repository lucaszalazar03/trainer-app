import Link from "next/link";
import CoachShell from "@/components/CoachShell";
import { Icon } from "@/components/Icon";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { SubmitButton } from "@/components/SubmitButton";
import { ExerciseLibrary, type LibraryExercise } from "@/components/ExerciseLibrary";
import { requireUser } from "@/lib/actions/require-user";
import { getDirectSql } from "@/lib/db/direct";
import { friendlyDbError } from "@/lib/db/friendly-error";
import { createCategory, deleteCategory } from "./actions";
import { deleteTemplate } from "./templates-actions";

export default async function BibliotecaPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; q?: string; tab?: string; saved?: string; error?: string }>;
}) {
  const { categoria = "", q = "", tab = "ejercicios", saved, error } = await searchParams;

  const { supabase, user } = await requireUser();
  const sql = getDirectSql();

  // Ejercicios + categorías por conexión directa, en UNA tanda. Antes iban
  // por la API REST de Supabase ignorando el error: si esa API cortaba por
  // timeout, la lista llegaba vacía/incompleta y parecía que faltaban
  // ejercicios. Ahora, si falla, se muestra el error y un "Reintentar".
  // "usos" (en cuántas sesiones/plantillas está cada ejercicio, para avisar
  // antes de borrar) sale en la misma consulta en vez de 3 consultas más.
  // Se trae la biblioteca COMPLETA: el filtro por texto/categoría se hace en
  // el navegador (ExerciseLibrary), sin volver al servidor.
  let categories: { id: string; nombre: string }[] = [];
  let exercises: LibraryExercise[] = [];
  let loadError: string | null = null;
  try {
    [categories, exercises] = await Promise.all([
      sql<{ id: string; nombre: string }[]>`select id, nombre from categories where coach_id = ${user.id} order by nombre`,
      tab === "ejercicios"
        ? sql<LibraryExercise[]>`
            select e.id, e.nombre, e.grupo, e.equipamiento, e.categoria_id, e.video_url,
              ( (select count(*) from block_exercises x where x.exercise_id = e.id)
              + (select count(*) from warmup_exercises x where x.exercise_id = e.id)
              + (select count(*) from template_block_exercises x where x.exercise_id = e.id)
              + (select count(*) from template_warmup_exercises x where x.exercise_id = e.id) )::int as usos
            from exercises e
            where e.coach_id = ${user.id}
            order by e.nombre
          `
        : Promise.resolve([] as LibraryExercise[]),
    ]);
  } catch (err) {
    loadError = friendlyDbError(err) ?? "No se pudo cargar la biblioteca.";
  }

  const { data: templates } =
    tab === "plantillas"
      ? await supabase
          .from("templates")
          .select("id, nombre, tipo, template_blocks(count), template_warmup_exercises(count)")
          .order("nombre")
      : { data: [] as never[] };

  const backParams = new URLSearchParams({ tab: "ejercicios" });
  if (categoria) backParams.set("categoria", categoria);
  const backUrl = `/biblioteca?${backParams.toString()}`;
  const deleteCategoryAction = async (id: string) => {
    "use server";
    await deleteCategory(id, "/biblioteca?tab=ejercicios");
  };

  return (
    <CoachShell active="/biblioteca">
      <div className="content-head">
        <div>
          <h1>Biblioteca</h1>
          <div className="sub">Ejercicios con video y plantillas de sesión reutilizables</div>
        </div>
        {tab === "ejercicios" && (
          <Link href="/biblioteca/nuevo" className="btn primary">
            <Icon name="plus" size={15} />
            Nuevo ejercicio
          </Link>
        )}
        {tab === "plantillas" && (
          <Link href="/biblioteca/plantillas/nueva" className="btn primary">
            <Icon name="plus" size={15} />
            Nueva plantilla
          </Link>
        )}
      </div>

      {saved && <div className="banner success">{tab === "plantillas" ? "Plantilla guardada." : "Ejercicio guardado."}</div>}
      {error && <div className="banner danger">{decodeURIComponent(error)}</div>}

      <div className="tabs">
        <Link href="/biblioteca?tab=ejercicios" className={`tab ${tab === "ejercicios" ? "active" : ""}`}>
          Ejercicios
        </Link>
        <Link href="/biblioteca?tab=plantillas" className={`tab ${tab === "plantillas" ? "active" : ""}`}>
          Plantillas
        </Link>
      </div>

      {tab === "plantillas" ? (
        !templates || templates.length === 0 ? (
          <div className="empty" style={{ maxWidth: 480 }}>
            Todavía no armaste ninguna plantilla. Creá bloques reutilizables — con sus ejercicios, series y reps — para
            insertarlos en cualquier sesión con un clic.
          </div>
        ) : (
          <div className="grid g-cards">
            {templates.map((t) => {
              const esCalentamiento = (t as unknown as { tipo: string }).tipo === "calentamiento";
              const nBloques = (t.template_blocks as unknown as { count: number }[] | null)?.[0]?.count ?? 0;
              const nEjercicios = (t as unknown as { template_warmup_exercises: { count: number }[] | null }).template_warmup_exercises?.[0]?.count ?? 0;
              const meta = esCalentamiento
                ? nEjercicios === 0
                  ? "Sin ejercicios todavía"
                  : `${nEjercicios} ejercicio${nEjercicios === 1 ? "" : "s"}`
                : nBloques === 0
                  ? "Sin bloques todavía"
                  : `${nBloques} bloque${nBloques === 1 ? "" : "s"}`;
              return (
                <div key={t.id} className="ex-lib-card">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 700 }}>{t.nombre}</div>
                    <span className={`badge ${esCalentamiento ? "blue" : "neutral"}`}>
                      {esCalentamiento ? "Entrada en calor" : "Bloque"}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{meta}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                    <Link href={`/biblioteca/plantillas/${t.id}`} className="btn sm" style={{ flex: 1 }}>
                      <Icon name="edit" size={13} />
                      Editar
                    </Link>
                    <form action={deleteTemplate.bind(null, t.id)}>
                      <ConfirmSubmitButton confirmMessage={`¿Eliminar la plantilla "${t.nombre}"?`} className="btn sm icon ghost">
                        <Icon name="trash" size={13} />
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        <>
          {loadError ? (
            <div className="banner danger" style={{ maxWidth: 640 }}>
              {loadError}{" "}
              <a href={`/biblioteca?tab=ejercicios`} className="btn sm" style={{ marginLeft: 8 }}>
                Reintentar
              </a>
            </div>
          ) : (
            <ExerciseLibrary
              exercises={exercises}
              categories={categories}
              initialQ={q}
              initialCategoria={categoria}
              onDeleteCategory={deleteCategoryAction}
              categoryForm={
                <details style={{ display: "inline-block" }}>
                  <summary className="chip dashed" style={{ listStyle: "none", cursor: "pointer" }}>
                    <Icon name="plus" size={12} />
                    Categoría
                  </summary>
                  <form action={createCategory} style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <input type="hidden" name="back" value={backUrl} />
                    <input name="categoria_nueva" placeholder="Nombre de la categoría" style={{ width: 180 }} />
                    <SubmitButton className="btn sm">Agregar</SubmitButton>
                  </form>
                </details>
              }
            />
          )}
        </>
      )}
    </CoachShell>
  );
}
