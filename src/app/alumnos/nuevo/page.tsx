import CoachShell from "@/components/CoachShell";
import { Crumbs } from "@/components/Crumbs";
import { TextField, TextAreaField, SelectField, ErrorBanner } from "@/components/FormField";
import { AthleteFields } from "@/components/AthleteFields";
import { SubmitButton } from "@/components/SubmitButton";
import { createStudent } from "../actions";

export default async function NuevoAlumnoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <CoachShell active="/alumnos">
      <div style={{ maxWidth: 480 }}>
        <Crumbs items={[{ label: "Alumnos", href: "/alumnos" }, { label: "Nuevo alumno" }]} />
        <h1 style={{ fontSize: 20, margin: "0 0 20px" }}>Nuevo alumno</h1>

        <ErrorBanner message={error} />

        <form action={createStudent}>
          <TextField label="Nombre" name="nombre" required />
          <TextField label="Email (opcional, para invitarlo más adelante)" name="email" placeholder="alumno@email.com" />
          <TextField label="Objetivo" name="objetivo" placeholder="Ej: Fuerza general" />
          <SelectField label="Estado" name="estado" defaultValue="Activo" options={["Activo", "Inactivo"]} />

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <TextField label="Edad" name="edad" type="number" placeholder="Ej: 24" />
            </div>
            <div style={{ flex: 1 }}>
              <TextField label="Altura (cm)" name="altura_cm" type="number" placeholder="Ej: 178" />
            </div>
            <div style={{ flex: 1 }}>
              <TextField label="Peso (kg)" name="peso_kg" type="number" step="0.1" placeholder="Ej: 75" />
            </div>
          </div>

          <AthleteFields />

          <TextAreaField label="Notas" name="notas" placeholder="Observaciones, lesiones, contexto..." />

          <SubmitButton className="btn primary" style={{ marginTop: 6, width: "100%", padding: "11px 0" }}>
            Crear alumno
          </SubmitButton>
        </form>
      </div>
    </CoachShell>
  );
}
