import CoachShell from "@/components/CoachShell";
import { Crumbs } from "@/components/Crumbs";
import { TextField, ErrorBanner } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { createTeam } from "../actions";

export default async function NuevoEquipoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <CoachShell active="/equipos">
      <div style={{ maxWidth: 480 }}>
        <Crumbs items={[{ label: "Equipos", href: "/equipos" }, { label: "Nuevo equipo" }]} />
        <h1 style={{ fontSize: 20, margin: "0 0 20px" }}>Nuevo equipo</h1>

        <ErrorBanner message={error} />

        <form action={createTeam}>
          <TextField label="Nombre" name="nombre" required placeholder="Ej: Plantel mayor" />

          <SubmitButton className="btn primary" style={{ marginTop: 6, width: "100%", padding: "11px 0" }}>
            Crear equipo
          </SubmitButton>
        </form>
      </div>
    </CoachShell>
  );
}
