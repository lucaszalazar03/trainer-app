import Link from "next/link";
import CoachShell from "@/components/CoachShell";
import { Icon } from "@/components/Icon";
import { Badge } from "@/components/Badge";
import { requireUser } from "@/lib/actions/require-user";
import { asUser } from "@/lib/db/as-user";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { deleteProgram } from "./actions";

export default async function ProgramasPage() {
  const { user } = await requireUser();

  // Sólo los programas generales/compartidos — las rutinas personales de un
  // alumno puntual (owner_student_id) viven en su perfil, no acá.
  // Conexión directa con las reglas de seguridad del usuario (ver as-user.ts).
  const [programs, asignaciones] = await asUser(user.id, (sql) =>
    Promise.all([
      sql<{ id: string; nombre: string; descripcion: string | null; nivel: string | null; duracion_semanas: number | null }[]>`
        select id, nombre, descripcion, nivel, duracion_semanas from programs
        where owner_student_id is null order by created_at desc`,
      sql<{ programa_id: string | null }[]>`select programa_id from students where programa_id is not null`,
    ])
  );

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
        <div className="program-list">
          {programs.map((p) => (
            <div key={p.id} className="program-row">
              <div className="program-info">
                <Link href={`/programas/${p.id}`} className="program-name">
                  {p.nombre}
                </Link>
                <div className="program-desc">{p.descripcion || "Sin descripción"}</div>
                <div className="program-tags">
                  <Badge tone="blue">{p.duracion_semanas} semanas</Badge>
                  <Badge tone="neutral">{p.nivel}</Badge>
                  <Badge tone="green">
                    {countByProgram[p.id] ?? 0} asignado{(countByProgram[p.id] ?? 0) === 1 ? "" : "s"}
                  </Badge>
                </div>
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
          ))}
        </div>
      )}
    </CoachShell>
  );
}
