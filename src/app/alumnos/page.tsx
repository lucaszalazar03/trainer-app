import Link from "next/link";
import CoachShell from "@/components/CoachShell";
import { Icon } from "@/components/Icon";
import { createClient } from "@/lib/supabase/server";

export default async function AlumnosPage() {
  const supabase = await createClient();

  const { data: students } = await supabase
    .from("students")
    .select("id, nombre, estado, objetivo, programa_id, semana_actual, nuevo")
    .order("nuevo", { ascending: false })
    .order("nombre");

  return (
    <CoachShell active="/alumnos">
      <div className="content-head">
        <div>
          <h1>Alumnos</h1>
          <div className="sub">{students?.length ?? 0} en total</div>
        </div>
        <Link href="/alumnos/nuevo" className="btn primary">
          <Icon name="plus" size={15} />
          Nuevo alumno
        </Link>
      </div>

      {!students || students.length === 0 ? (
        <div className="empty" style={{ maxWidth: 480 }}>
          Todavía no tenés alumnos cargados. Empezá agregando el primero.
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 700, overflow: "hidden" }}>
          {students.map((s, i) => (
            <Link
              key={s.id}
              href={`/alumnos/${s.id}`}
              className="list-row"
              style={{ justifyContent: "space-between", borderTop: i === 0 ? "none" : "1px solid var(--border)", borderRadius: 0 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <div className="avatar">{initials(s.nombre)}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.nombre}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 2 }}>
                    {s.objetivo || "Sin objetivo definido"}
                    {s.programa_id ? ` · Semana ${s.semana_actual}` : " · Sin programa asignado"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                {s.nuevo && <span className="badge blue">Nuevo</span>}
                <span className={`badge ${s.estado === "Activo" ? "green" : "neutral"}`}>{s.estado}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </CoachShell>
  );
}

function initials(nombre: string) {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}
