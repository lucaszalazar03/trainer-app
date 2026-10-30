import Link from "next/link";
import CoachShell from "@/components/CoachShell";
import { requireUser } from "@/lib/actions/require-user";
import { asUser } from "@/lib/db/as-user";
import { TIMEZONE, inicioDeSemanaArgentina } from "@/lib/date";

function haceCuanto(fechaIso: string): string {
  const dias = Math.floor((Date.now() - new Date(fechaIso).getTime()) / 86400000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} días`;
  const semanas = Math.floor(dias / 7);
  if (semanas < 5) return `hace ${semanas} semana${semanas === 1 ? "" : "s"}`;
  return `hace ${Math.floor(dias / 30)} mes${Math.floor(dias / 30) === 1 ? "" : "es"}`;
}

export default async function DashboardPage() {
  const { user } = await requireUser();
  const inicioSemana = inicioDeSemanaArgentina();

  // Todo por conexión directa con las reglas de seguridad del usuario (ver
  // as-user.ts), en una sola transacción.
  type Nombre = { nombre: string } | null;
  const [activeStudents, [{ programas, equipos, entrenamientosSemana }], checkinsPendientes, recentLogs, lastLogs] = await asUser(
    user.id,
    (sql) =>
      Promise.all([
        sql<{ id: string; nombre: string }[]>`select id, nombre from students where estado = 'Activo'`,
        sql<{ programas: number; equipos: number; entrenamientosSemana: number }[]>`
          select (select count(*)::int from programs where owner_student_id is null) as programas,
                 (select count(*)::int from teams) as equipos,
                 (select count(*)::int from training_logs where created_at >= ${inicioSemana.toISOString()}) as "entrenamientosSemana"`,
        sql<{ id: string; fecha: string; energia: number | null; dolor: number | null; sueno: number | null; students: Nombre }[]>`
          select c.id, to_json(c.fecha)#>>'{}' as fecha, c.energia, c.dolor, c.sueno, json_build_object('nombre', s.nombre) as students
          from checkins c left join students s on s.id = c.student_id
          where c.visto = false order by c.fecha desc limit 5`,
        sql<{ id: string; created_at: string; session_nombre: string | null; student_id: string; students: Nombre }[]>`
          select t.id, to_json(t.created_at)#>>'{}' as created_at, t.session_nombre, t.student_id, json_build_object('nombre', s.nombre) as students
          from training_logs t left join students s on s.id = t.student_id
          order by t.created_at desc limit 8`,
        // Última actividad de cada alumno activo (una fila por alumno).
        sql<{ student_id: string; created_at: string }[]>`
          select distinct on (t.student_id) t.student_id, to_json(t.created_at)#>>'{}' as created_at
          from training_logs t join students s on s.id = t.student_id
          where s.estado = 'Activo' order by t.student_id, t.created_at desc`,
      ])
  );

  const ultimaActividad = new Map<string, string>();
  for (const row of lastLogs ?? []) {
    if (!ultimaActividad.has(row.student_id)) ultimaActividad.set(row.student_id, row.created_at);
  }

  const sieteDiasAtras = new Date();
  sieteDiasAtras.setDate(sieteDiasAtras.getDate() - 7);

  const sinActividad = (activeStudents ?? [])
    .map((s) => ({ ...s, ultima: ultimaActividad.get(s.id) ?? null }))
    .filter((s) => !s.ultima || new Date(s.ultima) < sieteDiasAtras)
    .sort((a, b) => {
      if (!a.ultima && !b.ultima) return 0;
      if (!a.ultima) return -1;
      if (!b.ultima) return 1;
      return new Date(a.ultima).getTime() - new Date(b.ultima).getTime();
    });

  const pendientes = checkinsPendientes?.length ?? 0;

  return (
    <CoachShell active="/dashboard">
      <div className="content-head">
        <div>
          <h1>Hola, Coach</h1>
          <div className="sub">
            Resumen de hoy ·{" "}
            {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: TIMEZONE })}
          </div>
        </div>
      </div>

      <div className="grid g-2" style={{ marginBottom: 24 }}>
        <div className="card card-pad">
          <div className="section-h" style={{ marginTop: 0 }}>
            <h3>Check-ins recientes sin ver</h3>
          </div>
          {pendientes === 0 ? (
            <div className="empty">No hay check-ins pendientes por revisar.</div>
          ) : (
            <div className="row-list">
              {checkinsPendientes!.map((c) => {
                const atencion = (c.energia ?? 3) <= 2 || (c.dolor ?? 1) >= 4 || (c.sueno ?? 3) <= 2;
                return (
                  <div key={c.id} className="list-row" style={{ justifyContent: "space-between" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 600, fontSize: 15 }}>
                      {atencion && (
                        <span
                          title="Valores para prestar atención"
                          style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--plate-yellow)", flex: "0 0 auto" }}
                        />
                      )}
                      {(c.students as unknown as { nombre: string } | null)?.nombre ?? "Alumno"}
                    </span>
                    <span style={{ color: "var(--text-dim)", fontSize: 14 }}>
                      Energía {c.energia} · Dolor {c.dolor} · Sueño {c.sueno}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card card-pad">
          <div className="section-h" style={{ marginTop: 0 }}>
            <h3>Sin entrenar hace 7+ días</h3>
          </div>
          {sinActividad.length === 0 ? (
            <div className="empty">Todos tus alumnos activos entrenaron esta última semana.</div>
          ) : (
            <div className="row-list">
              {sinActividad.slice(0, 8).map((s) => (
                <Link key={s.id} href={`/alumnos/${s.id}`} className="list-row" style={{ justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{s.nombre}</span>
                  <span style={{ color: "var(--warn)", fontSize: 14, fontWeight: 600 }}>{s.ultima ? haceCuanto(s.ultima) : "nunca entrenó"}</span>
                </Link>
              ))}
              {sinActividad.length > 8 && (
                <div style={{ fontSize: 13, color: "var(--text-faint)", marginTop: 6 }}>
                  +{sinActividad.length - 8} más
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="stat-strip">
        <div className="stat">
          <div className="v">{activeStudents?.length ?? 0}</div>
          <div className="k">Alumnos activos</div>
        </div>
        <div className="stat">
          <div className="v">{entrenamientosSemana ?? 0}</div>
          <div className="k">Entrenamientos esta semana</div>
        </div>
        <div className="stat">
          <div className="v">{programas ?? 0}</div>
          <div className="k">Programas</div>
        </div>
        <div className="stat">
          <div className="v">{equipos ?? 0}</div>
          <div className="k">Equipos</div>
        </div>
        <div className="stat">
          <div className={`v ${pendientes > 0 ? "warn" : ""}`}>{pendientes}</div>
          <div className="k">Check-ins sin ver</div>
        </div>
      </div>

      <div style={{ maxWidth: 700 }}>
        <div className="section-h" style={{ marginTop: 0 }}>
          <h3>Actividad reciente</h3>
        </div>
        {!recentLogs || recentLogs.length === 0 ? (
          <div className="empty">Todavía no hay entrenamientos registrados.</div>
        ) : (
          <div className="row-list">
            {recentLogs.map((l) => (
              <Link key={l.id} href={`/alumnos/${l.student_id}`} className="list-row" style={{ justifyContent: "space-between" }}>
                <span style={{ fontSize: 15 }}>
                  <strong style={{ fontWeight: 700 }}>{(l.students as unknown as { nombre: string } | null)?.nombre ?? "Alumno"}</strong>
                  <span style={{ color: "var(--text-dim)" }}> completó &quot;{l.session_nombre ?? "una sesión"}&quot;</span>
                </span>
                <span style={{ color: "var(--text-dim)", fontSize: 13.5, flex: "0 0 auto" }}>{haceCuanto(l.created_at)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </CoachShell>
  );
}
