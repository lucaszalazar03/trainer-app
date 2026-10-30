import Link from "next/link";
import { notFound } from "next/navigation";
import CoachShell from "@/components/CoachShell";
import { Crumbs } from "@/components/Crumbs";
import { TextField, ErrorBanner, SuccessBanner } from "@/components/FormField";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUser } from "@/lib/actions/require-user";
import { asUser } from "@/lib/db/as-user";
import { updateTeam, deleteTeam, updateMembers, assignTeamProgram } from "../actions";

export default async function EquipoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { error, saved } = await searchParams;

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { user } = await requireUser();

  // Conexión directa con las reglas de seguridad del usuario (ver as-user.ts).
  const [[team], members, students, programs] = await asUser(user.id, (sql) =>
    Promise.all([
      sql<{ id: string; nombre: string }[]>`select id, nombre from teams where id = ${id}`,
      sql<{ student_id: string }[]>`select student_id from team_members where team_id = ${id}`,
      sql<{ id: string; nombre: string; programa_id: string | null; semana_actual: number }[]>`
        select id, nombre, programa_id, semana_actual from students order by nombre`,
      // Sólo programas generales — una rutina personal de un alumno puntual no
      // debe poder asignarse a todo un equipo.
      sql<{ id: string; nombre: string }[]>`select id, nombre from programs where owner_student_id is null order by nombre`,
    ])
  );
  if (!team) notFound();

  const memberIds = new Set(members.map((m) => m.student_id));
  const programNames = Object.fromEntries((programs ?? []).map((p) => [p.id, p.nombre]));

  const currentMembers = (students ?? []).filter((s) => memberIds.has(s.id));

  return (
    <CoachShell active="/equipos">
      <div style={{ maxWidth: 520 }}>
        <Crumbs items={[{ label: "Equipos", href: "/equipos" }, { label: team.nombre }]} />
        <h1 style={{ margin: "0 0 20px" }}>{team.nombre}</h1>

        <ErrorBanner message={error} />
        <SuccessBanner show={saved} message="Cambios guardados." />

        <form action={updateTeam.bind(null, id)} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            <TextField label="Nombre del equipo" name="nombre" defaultValue={team.nombre} required />
          </div>
          <SubmitButton className="btn">Renombrar</SubmitButton>
        </form>

        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <div style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 10 }}>
            Asignar programa a todo el equipo
            {currentMembers.length === 0 && <span style={{ color: "var(--text-faint)" }}> — agregá alumnos al equipo primero</span>}
          </div>
          <form action={assignTeamProgram.bind(null, id)} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <span className="field-label">Programa</span>
              <select name="programa_id" defaultValue="">
                <option value="">Sin programa</option>
                {(programs ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ width: 100 }}>
              <span className="field-label">Semana</span>
              <input type="number" name="semana_actual" min={1} defaultValue={1} />
            </div>
            <SubmitButton disabled={currentMembers.length === 0} className="btn primary">
              Aplicar a los {currentMembers.length || ""} alumno{currentMembers.length === 1 ? "" : "s"}
            </SubmitButton>
          </form>
        </div>

        <div className="card card-pad" style={{ marginBottom: 24 }}>
          <div style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 10 }}>Integrantes</div>
          <form action={updateMembers.bind(null, id)} style={{ display: "grid", gap: 14 }}>
            <div style={{ maxHeight: 340, overflowY: "auto" }}>
              {!students || students.length === 0 ? (
                <p style={{ color: "var(--text-faint)", fontSize: 13 }}>Todavía no tenés alumnos cargados.</p>
              ) : (
                students.map((s) => (
                  <label key={s.id} className="pick-row">
                    <input type="checkbox" name="student_id" value={s.id} defaultChecked={memberIds.has(s.id)} />
                    {s.nombre}
                  </label>
                ))
              )}
            </div>
            <SubmitButton className="btn" style={{ justifySelf: "start" }}>
              Guardar integrantes
            </SubmitButton>
          </form>
        </div>

        {currentMembers.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 10 }}>Estado actual</div>
            <div style={{ display: "grid", gap: 6 }}>
              {currentMembers.map((s) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <Link href={`/alumnos/${s.id}`} style={{ color: "var(--text)", textDecoration: "none" }}>
                    {s.nombre}
                  </Link>
                  <span style={{ color: "var(--text-faint)" }}>
                    {s.programa_id ? `${programNames[s.programa_id] ?? "Programa"} · Sem ${s.semana_actual}` : "Sin programa"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <form action={deleteTeam.bind(null, id)}>
          <ConfirmSubmitButton
            confirmMessage={`¿Eliminar el equipo "${team.nombre}"? Los alumnos no se borran, solo se desarma el grupo.`}
            className="btn danger"
          >
            Eliminar equipo
          </ConfirmSubmitButton>
        </form>
      </div>
    </CoachShell>
  );
}
