import Link from "next/link";
import { notFound } from "next/navigation";
import CoachShell from "@/components/CoachShell";
import { Crumbs } from "@/components/Crumbs";
import { Icon } from "@/components/Icon";
import { TextField, TextAreaField, ErrorBanner, SuccessBanner } from "@/components/FormField";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { SubmitButton } from "@/components/SubmitButton";
import { ExerciseVideoCard } from "@/components/ExerciseVideoCard";
import { requireUser } from "@/lib/actions/require-user";
import { getDirectSql } from "@/lib/db/direct";
import { friendlyDbError } from "@/lib/db/friendly-error";
import { updateExercise, deleteExercise, setExerciseVideoUrl, removeExerciseVideo } from "../actions";

export default async function EjercicioDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; categoria?: string; q?: string }>;
}) {
  const { id } = await params;
  const { error, saved, categoria = "", q = "" } = await searchParams;

  const { user } = await requireUser();
  const sql = getDirectSql();

  // Un id que no es uuid haría fallar la consulta con un error de Postgres:
  // eso es simplemente "no existe".
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) notFound();
  const categoriaFilter = UUID_RE.test(categoria) ? categoria : null;

  // Antes estas lecturas iban por supabase-js (la API REST de Supabase). Cuando
  // esa capa se cuelga (statement timeout, visto en los logs), alguna de las
  // cinco consultas volvía vacía: si era la del ejercicio, la página tiraba
  // un 404 justo después de "Guardar cambios" — el bug de "se buguea al
  // editar". Ahora leen por conexión directa (igual que updateExercise), y si
  // algo falla se muestra un error con opción de reintentar en vez de un 404.
  // Al no pasar por RLS, cada consulta filtra a mano por coach_id = user.id.
  type Ex = { id: string; nombre: string; grupo: string | null; equipamiento: string | null; categoria_id: string | null; obs: string | null; video_url: string | null };
  let exercise: Ex | null = null;
  let categories: { id: string; nombre: string }[] = [];
  let ids: { id: string; nombre: string }[] = [];
  let usos = 0;
  let loadError: string | null = null;

  try {
    const qLike = q.trim() ? `%${q.trim()}%` : null;
    const [exRows, catRows, usoRows, idRows] = await Promise.all([
      sql<Ex[]>`
        select id, nombre, grupo, equipamiento, categoria_id, obs, video_url
        from exercises where id = ${id} and coach_id = ${user.id}
      `,
      sql<{ id: string; nombre: string }[]>`
        select id, nombre from categories where coach_id = ${user.id} order by nombre
      `,
      sql<{ n: number }[]>`
        select ((select count(*) from block_exercises where exercise_id = ${id})
              + (select count(*) from warmup_exercises where exercise_id = ${id}))::int as n
      `,
      sql<{ id: string; nombre: string }[]>`
        select id, nombre from exercises
        where coach_id = ${user.id}
          and (${categoriaFilter}::uuid is null or categoria_id = ${categoriaFilter}::uuid)
          and (${qLike}::text is null or nombre ilike ${qLike}::text)
        order by nombre
      `,
    ]);
    exercise = exRows[0] ?? null;
    categories = catRows;
    usos = usoRows[0]?.n ?? 0;
    ids = idRows;
  } catch (err) {
    loadError = friendlyDbError(err) ?? "No se pudo cargar el ejercicio.";
  }

  if (loadError) {
    return (
      <CoachShell active="/biblioteca">
        <div style={{ maxWidth: 480 }}>
          <Crumbs items={[{ label: "Biblioteca", href: "/biblioteca" }, { label: "Ejercicio" }]} />
          <div className="banner danger">{loadError} Tus cambios guardados no se perdieron.</div>
          <Link href={`/biblioteca/${id}`} className="btn primary">
            Reintentar
          </Link>
        </div>
      </CoachShell>
    );
  }

  if (!exercise) notFound();

  const filterParams = new URLSearchParams();
  if (categoria) filterParams.set("categoria", categoria);
  if (q) filterParams.set("q", q);
  const filterQs = filterParams.toString();
  const withFilter = (path: string) => `${path}${filterQs ? `?${filterQs}` : ""}`;

  const idx = ids.findIndex((e) => e.id === id);
  const prev = idx > 0 ? ids[idx - 1] : null;
  const next = idx !== -1 && idx < ids.length - 1 ? ids[idx + 1] : null;

  const updateWithId = updateExercise.bind(null, id);
  const deleteWithId = deleteExercise.bind(null, id);
  const setVideoUrlWithId = setExerciseVideoUrl.bind(null, id);
  const removeVideoWithId = removeExerciseVideo.bind(null, id);

  return (
    <CoachShell active="/biblioteca">
      <div style={{ maxWidth: 480 }}>
        <Crumbs items={[{ label: "Biblioteca", href: withFilter("/biblioteca") }, { label: exercise.nombre }]} />
        <h1 style={{ fontSize: 20, margin: "0 0 14px" }}>{exercise.nombre}</h1>

        {idx !== -1 && ids.length > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            {prev ? (
              <Link href={withFilter(`/biblioteca/${prev.id}`)} className="btn sm ghost">
                <Icon name="arrowLeft" size={13} />
                Anterior
              </Link>
            ) : (
              <span />
            )}
            <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
              {idx + 1} de {ids.length}
            </span>
            {next ? (
              <Link href={withFilter(`/biblioteca/${next.id}`)} className="btn sm ghost">
                Siguiente
                <Icon name="chevronRight" size={13} />
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}

        <ErrorBanner message={error} />
        <SuccessBanner show={saved} message="Cambios guardados." />

        {usos > 0 && (
          <div className="card card-pad" style={{ marginBottom: 20, fontSize: 12.5, color: "var(--text-dim)" }}>
            Usado en {usos} lugar{usos === 1 ? "" : "es"} dentro de tus programas.
          </div>
        )}

        <ExerciseVideoCard
          exerciseId={id}
          initialVideoUrl={exercise.video_url}
          onSetVideoUrl={setVideoUrlWithId}
          onRemoveVideo={removeVideoWithId}
        />

        <form action={updateWithId}>
          {/* Para que updateExercise pueda redirigir de vuelta a esta misma
              página (en vez de a la lista) conservando el filtro con el que
              se llegó — ver comentario grande más arriba y en actions.ts. */}
          <input type="hidden" name="_categoria" value={categoria} />
          <input type="hidden" name="_q" value={q} />
          <TextField label="Nombre" name="nombre" defaultValue={exercise.nombre} required />

          <div className="field">
            <span className="field-label">Categoría</span>
            <select name="categoria_id" defaultValue={exercise.categoria_id ?? ""}>
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          <TextField label="Grupo muscular" name="grupo" defaultValue={exercise.grupo} placeholder="Ej: Piernas" />
          <TextField label="Equipamiento" name="equipamiento" defaultValue={exercise.equipamiento} placeholder="Ej: Barra, discos" />
          <TextField
            // key: fuerza que React remonte este campo (y relea
            // defaultValue) cuando video_url cambia por fuera de este
            // form — por ej. al subir/quitar un video desde
            // ExerciseVideoCard, que ya no hace una navegación completa
            // sino sólo un router.refresh(). Sin esto, este campo sin
            // controlar se quedaría mostrando el valor viejo y, si
            // después tocás "Guardar cambios" sin tocarlo, borraría el
            // video recién subido.
            key={exercise.video_url ?? "sin-video"}
            label="…o pegá un link de video (YouTube, Vimeo, etc.)"
            name="video_url"
            defaultValue={exercise.video_url}
            placeholder="https://..."
          />
          <TextAreaField label="Observaciones técnicas" name="obs" defaultValue={exercise.obs} />

          <SubmitButton className="btn primary" style={{ marginTop: 6, width: "100%", padding: "11px 0" }}>
            Guardar cambios
          </SubmitButton>
        </form>

        <form action={deleteWithId} style={{ marginTop: 28 }}>
          <ConfirmSubmitButton
            confirmMessage={
              usos > 0
                ? `"${exercise.nombre}" está usado en ${usos} lugar${usos === 1 ? "" : "es"} dentro de tus programas. Si lo eliminás, se va a quitar de todas esas sesiones también. ¿Continuar?`
                : `¿Eliminar "${exercise.nombre}"? Esta acción no se puede deshacer.`
            }
            className="btn danger"
          >
            Eliminar ejercicio
          </ConfirmSubmitButton>
        </form>
      </div>
    </CoachShell>
  );
}
