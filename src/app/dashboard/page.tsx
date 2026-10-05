import Link from "next/link";
import CoachShell from "@/components/CoachShell";
import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();
  const inicioSemana = inicioDeSemanaArgentina();

  // Las cinco primeras consultas no dependen entre sí — en paralelo. La
  // sexta (última actividad por alumno activo) sí depende de los ids de la
  // primera, así que va aparte, después.
  const [
    { data: activeStudents },
    { count: programas },
    { count: equipos },
    { data: checkinsPendientes },
    { data: recentLogs },
    { count: entrenamientosSemana },
  ] = await Promise.all([
    supabase.from("students").select("id, nombre").eq("estado", "Activo"),
    // Sólo cuenta los programas de la biblioteca general, no las rutinas
    // personales armadas dentro del perfil de cada alumno.
    supabase.from("programs").select("*", { count: "exact", head: true }).is("owner_student_id", null),
    supabase.from("teams").select("*", { count: "exact", head: true }),
    supabase
      .from("checkins")
      .select("id, fecha, energia, dolor, sueno, students(nombre)")
      .eq("visto", false)
      .order("fecha", { ascending: false })
      .limit(5),
    // Feed de "quién entrenó últimamente" para tener el pulso de toda la
    // base de alumnos sin tener que entrar uno por uno.
    supabase
      .from("training_logs")
      .select("id, created_at, session_nombre, student_id, students(nombre)")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("training_logs").select("*", { count: "exact", head: true }).gte("created_at", inicioSemana.toISOString()),
  ]);

  const activeIds = (activeStudents ?? []).map((s) => s.id);
  // Última fecha de entrenamiento por alumno activo — una sola consulta
  // (student_id + created_at, liviana) en vez de una por alumno, reducida
  // acá abajo a "la más reciente por id" (ya viene ordenada desc).
  const { data: lastLogs } = activeIds.length
    ? await supabase
        .from("training_logs")
        .select("student_id, created_at")
        .in("student_id", activeIds)
        .order("created_at", { ascending: false })
    : { data: [] as { student_id: string; created_at: string }[] };

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

      <div className="grid g-stats" style={{ marginBottom: 22 }}>
        <div className="card stat">
          <div className="k">Alumnos activos</div>
          <div className="v">{activeStudents?.length ?? 0}</div>
        </div>
        <div className="card stat">
          <div className="k">Entrenamientos esta semana</div>
          <div className="v accent">{entrenamientosSemana ?? 0}</div>
        </div>
        <div className="card stat">
          <div className="k">Programas</div>
          <div className="v blue">{programas ?? 0}</div>
        </div>
        <div className="card stat">
          <div className="k">Equipos</div>
          <div className="v">{equipos ?? 0}</div>
        </div>
        <div className="card stat">
          <div className="k">Check-ins sin ver</div>
          <div className={`v ${pendientes > 0 ? "warn" : ""}`}>{pendientes}</div>
        </div>
      </div>

      <div className="grid g-2" style={{ marginBottom: 20 }}>
        <div className="card card-pad">
          <div className="section-h" style={{ marginTop: 0 }}>
            <h3>Check-ins recientes sin ver</h3>
          </div>
          {pendientes === 0 ? (
            <div className="empty">No hay check-ins pendientes por revisar.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {checkinsPendientes!.map((c) => {
                const atencion = (c.energia ?? 3) <= 2 || (c.dolor ?? 1) >= 4 || (c.sueno ?? 3) <= 2;
                return (
                  <div
                    key={c.id}
                    className="list-row"
                    style={{ justifyContent: "space-between", background: "var(--surface-2)", borderRadius: "var(--radius-s)" }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 600, fontSize: 13.5 }}>
                      {atencion && (
                        <span
                          title="Valores para prestar atención"
                          style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--warn)", flex: "0 0 auto" }}
                        />
                      )}
                      {(c.students as unknown as { nombre: string } | null)?.nombre ?? "Alumno"}
                    </span>
                    <span style={{ color: "var(--text-dim)", fontSize: 12.5 }}>
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
            <div style={{ display: "grid", gap: 8 }}>
              {sinActividad.slice(0, 8).map((s) => (
                <Link
                  key={s.id}
                  href={`/alumnos/${s.id}`}
                  className="list-row"
                  style={{ justifyContent: "space-between", background: "var(--surface-2)", borderRadius: "var(--radius-s)" }}
                >
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{s.nombre}</span>
                  <span style={{ color: "var(--warn)", fontSize: 12.5 }}>{s.ultima ? haceCuanto(s.ultima) : "nunca entrenó"}</span>
                </Link>
              ))}
              {sinActividad.length > 8 && (
                <div style={{ fontSize: 11.5, color: "var(--text-faint)", textAlign: "center", marginTop: 2 }}>
                  +{sinActividad.length - 8} más
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card card-pad" style={{ maxWidth: 620 }}>
        <div className="section-h" style={{ marginTop: 0 }}>
          <h3>Actividad reciente</h3>
        </div>
        {!recentLogs || recentLogs.length === 0 ? (
          <div className="empty">Todavía no hay entrenamientos registrados.</div>
        ) : (
          <div style={{ display: "grid", gap: 4 }}>
            {recentLogs.map((l) => (
              <Link key={l.id} href={`/alumnos/${l.student_id}`} className="list-row" style={{ justifyContent: "space-between" }}>
                <span style={{ fontSize: 13 }}>
                  <strong style={{ fontWeight: 600 }}>{(l.students as unknown as { nombre: string } | null)?.nombre ?? "Alumno"}</strong>
                  <span style={{ color: "var(--text-faint)" }}> completó &quot;{l.session_nombre ?? "una sesión"}&quot;</span>
                </span>
                <span style={{ color: "var(--text-faint)", fontSize: 12, flex: "0 0 auto" }}>{haceCuanto(l.created_at)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </CoachShell>
  );
}
