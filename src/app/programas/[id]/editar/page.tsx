import { notFound } from "next/navigation";
import CoachShell from "@/components/CoachShell";
import { Crumbs } from "@/components/Crumbs";
import { TextField, TextAreaField, SelectField, ErrorBanner } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { createClient } from "@/lib/supabase/server";
import { updateProgram } from "../../actions";

export default async function EditarProgramaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: program } = await supabase
    .from("programs")
    .select("id, nombre, descripcion, objetivo, nivel, duracion_semanas")
    .eq("id", id)
    .maybeSingle();

  if (!program) notFound();

  const updateWithId = updateProgram.bind(null, id);

  return (
    <CoachShell active="/programas">
      <div style={{ maxWidth: 480 }}>
        <Crumbs items={[{ label: "Programas", href: "/programas" }, { label: program.nombre, href: `/programas/${id}` }, { label: "Editar" }]} />
        <h1 style={{ fontSize: 20, margin: "0 0 20px" }}>Editar programa</h1>

        <ErrorBanner message={error} />

        <form action={updateWithId}>
          <TextField label="Nombre" name="nombre" defaultValue={program.nombre} required />
          <TextAreaField label="Descripción" name="descripcion" defaultValue={program.descripcion} />
          <div className="row3">
            <TextField label="Objetivo" name="objetivo" defaultValue={program.objetivo} />
            <SelectField label="Nivel" name="nivel" defaultValue={program.nivel ?? "Intermedio"} options={["Principiante", "Intermedio", "Avanzado"]} />
            <TextField label="Duración (semanas)" name="duracion_semanas" defaultValue={String(program.duracion_semanas ?? 8)} />
          </div>

          <SubmitButton className="btn primary" style={{ marginTop: 6, width: "100%", padding: "11px 0" }}>
            Guardar cambios
          </SubmitButton>
        </form>
      </div>
    </CoachShell>
  );
}
