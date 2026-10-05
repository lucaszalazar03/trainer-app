import Link from "next/link";
import CoachShell from "@/components/CoachShell";
import { Icon } from "@/components/Icon";
import { Badge } from "@/components/Badge";
import { createClient } from "@/lib/supabase/server";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { deleteProgram } from "./actions";

export default async function ProgramasPage() {
  const supabase = await createClient();

  // Sólo los programas generales/compartidos — las rutinas personales de un
  // alumno puntual (owner_student_id) viven en su perfil, no acá.
  const { data: programs } = await supabase
    .from("programs")
    .select("id, nombre, descripcion, nivel, duracion_semanas")
    .is("owner_student_id", null)
    .order("created_at", { ascending: false });

  const { data: asignaciones } = await supabase
    .from("students")
    .select("programa_id")
    .not("programa_id", "is", null);

  const countByProgram: Record<string, number> = {};
  for (const s of asignaciones ?? []) {
    if (s.programa_id) countByProgram[s.programa_id] = (countByProgram[s.programa_id] ?? 0) + 1;
  }

  return (
    <CoachShell active="/programas">
      <div className="content-head">
        <div>
          <h1>Programas</h1>
          <div className="sub">Constructor de programas, semanas, sesiones y bloques</div>
        </div>
        <Link href="/programas/nuevo" className="btn primary">
          <Icon name="plus" size={15} />
          Nuevo programa
        </Link>
      </div>

      {!programs || programs.length === 0 ? (
        <div className="empty" style={{ maxWidth: 480 }}>
          Todavía no armaste ningún programa. Creá el primero para empezar a planificar sesiones.
        </div>
      ) : (
        <div className="grid g-cards" style={{ maxWidth: 900 }}>
          {programs.map((p) => (
            <div key={p.id} className="card program-card" style={{ display: "flex", flexDirection: "column" }}>
              <div className="program-card-photo">
                <Link href={`/programas/${p.id}`} className="nm">
                  {p.nombre}
                </Link>
              </div>
              <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ fontSize: 12.5, color: "var(--text-faint)", minHeight: 32 }}>
                    {p.descripcion || "Sin descripción"}
                  </div>
                  <form action={deleteProgram.bind(null, p.id)}>
                    <ConfirmSubmitButton
                      confirmMessage={`¿Eliminar "${p.nombre}"? Los alumnos asignados quedarán sin programa.`}
                      className="btn ghost sm"
                    >
                      Eliminar
                    </ConfirmSubmitButton>
                  </form>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Badge tone="blue">{p.duracion_semanas} semanas</Badge>
                  <Badge tone="neutral">{p.nivel}</Badge>
                  <Badge tone="green">
                    {countByProgram[p.id] ?? 0} asignado{(countByProgram[p.id] ?? 0) === 1 ? "" : "s"}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </CoachShell>
  );
}
