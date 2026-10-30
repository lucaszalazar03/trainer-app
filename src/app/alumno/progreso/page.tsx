import AlumnoShell from "@/components/AlumnoShell";
import { requireStudent } from "@/lib/actions/require-student";
import { asUser } from "@/lib/db/as-user";
import { TIMEZONE, inicioDeSemanaArgentina } from "@/lib/date";

export default async function ProgresoPage() {
  const { user, student } = await requireStudent();

  // Por conexión directa con las reglas de seguridad del alumno (ver
  // as-user.ts). Las fechas salen en formato ISO (igual que antes con la API).
  const [logs, [{ total: totalSesiones }], checkins, pesosRaw] = await asUser(user.id, (sql) =>
    Promise.all([
      sql<{ id: string; fecha: string; session_nombre: string | null; programa_nombre: string | null; comentario: string | null; done_blocks: unknown }[]>`
        select id, to_json(fecha)#>>'{}' as fecha, session_nombre, programa_nombre, comentario, done_blocks
        from training_logs where student_id = ${student.id} order by fecha desc limit 20`,
      sql<{ total: number }[]>`select count(*)::int as total from training_logs where student_id = ${student.id}`,
      sql<{ id: string; fecha: string; energia: number; dolor: number; sueno: number }[]>`
        select id, to_json(fecha)#>>'{}' as fecha, energia, dolor, sueno
        from checkins where student_id = ${student.id} order by fecha desc limit 5`,
      // Últimos 150 registros de peso, agrupados abajo por ejercicio.
      sql<{ exercise_id: string; peso_kg: number; fecha: string; nombre: string | null }[]>`
        select l.exercise_id, l.peso_kg::float8 as peso_kg, to_json(l.fecha)#>>'{}' as fecha, e.nombre
        from exercise_logs l left join exercises e on e.id = l.exercise_id
        where l.student_id = ${student.id} order by l.fecha desc limit 150`,
    ])
  );

  const treintaDiasAtras = new Date();
  treintaDiasAtras.setDate(treintaDiasAtras.getDate() - 30);
  const ultimoMes = (logs ?? []).filter((l) => new Date(l.fecha) >= treintaDiasAtras).length;

  const inicioSemana = inicioDeSemanaArgentina();
  const estaSemana = (logs ?? []).filter((l) => new Date(l.fecha) >= inicioSemana).length;

  // Racha en semanas consecutivas con al menos un entrenamiento (no en días
  // seguidos — nadie entrena todos los días, así que un streak diario
  // siempre daría 1 o 2). Si esta semana todavía no entrenó, no la cuenta
  // como corte: arranca a mirar desde la semana pasada para no resetear el
  // número a mitad de semana.
  const semanasConLog = new Set((logs ?? []).map((l) => inicioDeSemanaArgentina(new Date(l.fecha)).getTime()));
  let racha = 0;
  let semanaCursor = semanasConLog.has(inicioSemana.getTime()) ? inicioSemana : new Date(inicioSemana.getTime() - 7 * 86400000);
  while (semanasConLog.has(semanaCursor.getTime())) {
    racha++;
    semanaCursor = new Date(semanaCursor.getTime() - 7 * 86400000);
  }

  const promedio = (arr: number[]) => (arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : "—");

  // Mismo agrupado que en la ficha del coach: por ejercicio, últimos 5
  // valores conservando el orden (ya viene desc).
  const pesosPorEjercicio = new Map<string, { nombre: string; entradas: { peso: number; fecha: string }[] }>();
  for (const row of pesosRaw ?? []) {
    const nombre = row.nombre ?? "Ejercicio";
    if (!pesosPorEjercicio.has(row.exercise_id)) pesosPorEjercicio.set(row.exercise_id, { nombre, entradas: [] });
    const grupo = pesosPorEjercicio.get(row.exercise_id)!;
    if (grupo.entradas.length < 5) grupo.entradas.push({ peso: row.peso_kg, fecha: row.fecha });
  }

  return (
    <AlumnoShell active="/alumno/progreso" nombre={student.nombre}>
      <div className="p-header">
        <div>
          <h2>Tu progreso</h2>
          <div className="obj">Entrenamientos, cargas y check-ins registrados</div>
        </div>
      </div>

      <div className="p-stats">
        <div className="p-stat">
          <div className="v">{totalSesiones ?? 0}</div>
          <div className="k">Sesiones totales</div>
        </div>
        <div className="p-stat">
          <div className="v">{estaSemana}</div>
          <div className="k">Esta semana</div>
        </div>
        <div className="p-stat">
          <div className="v">{ultimoMes}</div>
          <div className="k">Últimos 30 días</div>
        </div>
        <div className="p-stat">
          <div className="v" style={{ color: racha > 0 ? "var(--plate-yellow)" : undefined }}>
            {racha}
          </div>
          <div className="k">Semanas seguidas</div>
        </div>
        <div className="p-stat">
          <div className="v">{promedio((checkins ?? []).map((c) => c.energia ?? 0))}</div>
          <div className="k">Energía prom.</div>
        </div>
      </div>

      <div className="section-h" style={{ marginTop: 0 }}>
        <h3>Cargas registradas</h3>
      </div>
      {pesosPorEjercicio.size === 0 ? (
        <div className="empty" style={{ marginBottom: 24 }}>
          Todavía no registraste ningún peso. Cargalo durante el entrenamiento, en cada ejercicio, para ver acá tu evolución.
        </div>
      ) : (
        <div className="card card-pad" style={{ marginBottom: 24, fontSize: 13 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Array.from(pesosPorEjercicio.entries()).map(([exId, { nombre, entradas }]) => (
              <div key={exId}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{nombre}</div>
                <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
                  {[...entradas]
                    .reverse()
                    .map((e) => `${e.peso}kg`)
                    .join(" → ")}
                  <span style={{ marginLeft: 6 }}>(última: {new Date(entradas[0].fecha).toLocaleDateString("es-AR", { timeZone: TIMEZONE })})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="section-h" style={{ marginTop: 0 }}>
        <h3>Historial de entrenamientos</h3>
      </div>
      {!logs || logs.length === 0 ? (
        <div className="empty" style={{ marginBottom: 24 }}>Todavía no registraste ningún entrenamiento.</div>
      ) : (
        <div style={{ marginBottom: 24 }}>
          {logs.map((l) => {
            const done = (l.done_blocks as { blocks?: string[] } | null)?.blocks?.length ?? 0;
            return (
              <div key={l.id} className="hist-row">
                <div>
                  <div className="d">{l.session_nombre ?? "Sesión"}</div>
                  <div className="m">
                    {l.programa_nombre ?? ""} {l.comentario ? `· "${l.comentario}"` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{new Date(l.fecha).toLocaleDateString("es-AR", { timeZone: TIMEZONE })}</div>
                  {done > 0 && <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{done} bloques</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="section-h">
        <h3>Últimos check-ins</h3>
      </div>
      {!checkins || checkins.length === 0 ? (
        <div className="empty">Todavía no hiciste ningún check-in.</div>
      ) : (
        <div>
          {checkins.map((c) => (
            <div key={c.id} className="hist-row">
              <div className="d">{new Date(c.fecha).toLocaleDateString("es-AR", { timeZone: TIMEZONE })}</div>
              <div className="m">
                Energía {c.energia} · Dolor {c.dolor} · Sueño {c.sueno}
              </div>
            </div>
          ))}
        </div>
      )}
    </AlumnoShell>
  );
}
