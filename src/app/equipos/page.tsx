import Link from "next/link";
import CoachShell from "@/components/CoachShell";
import { Icon } from "@/components/Icon";
import { createClient } from "@/lib/supabase/server";

export default async function EquiposPage() {
  const supabase = await createClient();

  const { data: teams } = await supabase.from("teams").select("id, nombre, team_members(count)").order("nombre");

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
            const count = (t.team_members as unknown as { count: number }[])?.[0]?.count ?? 0;
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
