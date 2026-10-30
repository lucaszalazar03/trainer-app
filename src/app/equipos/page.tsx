import Link from "next/link";
import CoachShell from "@/components/CoachShell";
import { Icon } from "@/components/Icon";
import { requireUser } from "@/lib/actions/require-user";
import { asUser } from "@/lib/db/as-user";

export default async function EquiposPage() {
  const { user } = await requireUser();
  // Conexión directa con las reglas de seguridad del usuario (ver as-user.ts).
  const teams = await asUser(user.id, (sql) => sql<{ id: string; nombre: string; miembros: number }[]>`
    select t.id, t.nombre, (select count(*)::int from team_members m where m.team_id = t.id) as miembros
    from teams t order by t.nombre`);

  return (
    <CoachShell active="/equipos">
      <div className="content-head">
        <div>
          <h1>Equipos</h1>
          <div className="sub">{teams?.length ?? 0} en total</div>
        </div>
        <Link href="/equipos/nuevo" className="btn primary">
          <Icon name="plus" size={15} />
          Nuevo equipo
        </Link>
      </div>

      {!teams || teams.length === 0 ? (
        <div className="empty" style={{ maxWidth: 480 }}>
          Todavía no armaste ningún equipo. Agrupá alumnos para asignarles un programa a todos juntos.
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 700 }}>
          {teams.map((t, i) => {
            const count = t.miembros;
            return (
              <Link
                key={t.id}
                href={`/equipos/${t.id}`}
                className="list-row"
                style={{ justifyContent: "space-between", borderTop: i === 0 ? "none" : "1px solid var(--border)", borderRadius: 0 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="avatar">
                    <Icon name="team" size={16} />
                  </div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{t.nombre}</span>
                </div>
                <span className="badge neutral">
                  {count} alumno{count === 1 ? "" : "s"}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </CoachShell>
  );
}
