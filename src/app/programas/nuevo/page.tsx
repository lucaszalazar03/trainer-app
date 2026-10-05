import CoachShell from "@/components/CoachShell";
import { Crumbs } from "@/components/Crumbs";
import { TextField, TextAreaField, SelectField, ErrorBanner } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { createProgram } from "../actions";

export default async function NuevoProgramaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <CoachShell active="/programas">
      <div style={{ maxWidth: 480 }}>
        <Crumbs items={[{ label: "Programas", href: "/programas" }, { label: "Nuevo programa" }]} />
        <h1 style={{ fontSize: 20, margin: "0 0 20px" }}>Nuevo programa</h1>

        <ErrorBanner message={error} />

        <form action={createProgram}>
          <TextField label="Nombre del programa" name="nombre" placeholder="Ej: Pretemporada Fuerza" required />
          <TextAreaField label="Descripción (opcional)" name="descripcion" placeholder="Objetivo general del programa…" />
          <div className="row3">
            <TextField label="Objetivo" name="objetivo" placeholder="Fuerza, Hipertrofia…" />
            <SelectField label="Nivel" name="nivel" defaultValue="Intermedio" options={["Principiante", "Intermedio", "Avanzado"]} />
            <TextField label="Duración (semanas)" name="duracion_semanas" defaultValue="8" />
          </div>

          <SubmitButton className="btn primary" style={{ marginTop: 6, width: "100%", padding: "11px 0" }}>
            Crear programa
          </SubmitButton>
        </form>
      </div>
    </CoachShell>
  );
}
