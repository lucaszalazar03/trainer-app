import CoachShell from "@/components/CoachShell";
import { Crumbs } from "@/components/Crumbs";
import { TextField, TextAreaField, ErrorBanner } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { createClient } from "@/lib/supabase/server";
import { createExercise } from "../actions";

export default async function NuevoEjercicioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: categories } = await supabase.from("categories").select("id, nombre").order("nombre");

  return (
    <CoachShell active="/biblioteca">
      <div style={{ maxWidth: 480 }}>
        <Crumbs items={[{ label: "Biblioteca", href: "/biblioteca" }, { label: "Nuevo ejercicio" }]} />
        <h1 style={{ fontSize: 20, margin: "0 0 20px" }}>Nuevo ejercicio</h1>

        <ErrorBanner message={error} />

        <form action={createExercise}>
          <TextField label="Nombre" name="nombre" required placeholder="Ej: Sentadilla trasera" />

          <div className="field">
            <span className="field-label">Categoría</span>
            <select name="categoria_id" defaultValue="">
              <option value="">Sin categoría</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          <TextField label="Grupo muscular" name="grupo" placeholder="Ej: Piernas" />
          <TextField label="Equipamiento" name="equipamiento" placeholder="Ej: Barra, discos" />
          <TextField label="Video (opcional)" name="video_url" placeholder="https://..." />
          <TextAreaField label="Observaciones técnicas" name="obs" placeholder="Puntos clave de ejecución..." />

          <SubmitButton className="btn primary" style={{ marginTop: 6, width: "100%", padding: "11px 0" }}>
            Crear ejercicio
          </SubmitButton>
        </form>
      </div>
    </CoachShell>
  );
}
