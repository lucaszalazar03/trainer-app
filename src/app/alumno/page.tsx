import Link from "next/link";
import { redirect } from "next/navigation";
import AlumnoShell from "@/components/AlumnoShell";
import { Icon } from "@/components/Icon";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { WeekBar } from "@/components/WeekBar";
import { requireStudent } from "@/lib/actions/require-student";
import { asUser } from "@/lib/db/as-user";
import { DIAS } from "@/lib/constants";
import { TIMEZONE, diaDelMesHoy, inicioDeHoyArgentina, inicioDeSemanaArgentina, nombreDiaHoy } from "@/lib/date";
import { undoTraining } from "./actions";

const DIA_CORTO: Record<(typeof DIAS)[number], string> = {
  Lunes: "Lun",
  Martes: "Mar",
  Miércoles: "Mié",
  Jueves: "Jue",
  Viernes: "Vie",
  Sábado: "Sáb",
  Domingo: "Dom",
};

// Lunes a domingo de la semana de "hoy" (en huso argentino, ver @/lib/date).
// Esto es sólo la franja de fechas de arriba (para ubicarse en qué día real
// está parado) — ya no dice qué sesión "toca" cada día: las sesiones de la
// semana del programa se pueden hacer en cualquier orden, ver más abajo.
function semanaActual(): { dia: (typeof DIAS)[number]; fecha: Date }[] {
  const lunes = inicioDeSemanaArgentina();
  return DIAS.map((dia, i) => ({ dia, fecha: new Date(lunes.getTime() + i * 86400000) }));
}

export default async function AlumnoHoyPage({
  searchParams,
}: {
  searchParams: Promise<{ entrenado?: string; deshecho?: string; checkin?: string }>;
}) {
  const { entrenado, deshecho, checkin } = await searchParams;
  const { user, student } = await requireStudent();

  const startOfToday = inicioDeHoyArgentina();
  const inicioSemana = inicioDeSemanaArgentina();

  // Todo por conexión directa con las reglas de seguridad del alumno (ver
  // as-user.ts), en una sola tanda. Antes eran 5 consultas REST en cadena y,
  // si alguna se cortaba, la pantalla salía vacía o el alumno no podía entrar.
  const [checkinRows, programRows, sessions, logsSemana] = await asUser(user.id, (sql) =>
    Promise.all([
      sql<{ id: string }[]>`
        select id from checkins where student_id = ${student.id} and fecha >= ${startOfToday.toISOString()} limit 1`,
      student.programa_id
        ? sql<{ id: string; nombre: string; objetivo: string | null; duracion_semanas: number | null }[]>`
            select id, nombre, objetivo, duracion_semanas from programs where id = ${student.programa_id}`
        : Promise.resolve([] as { id: string; nombre: string; objetivo: string | null; duracion_semanas: number | null }[]),
      student.programa_id
        ? sql<{ id: string; nombre: string; objetivo: string | null; dia: string | null }[]>`
            select se.id, se.nombre, se.objetivo, se.dia
            from sessions se join weeks w on w.id = se.week_id
            where w.program_id = ${student.programa_id} and w.numero = ${student.semana_actual}
            order by se.orden`
        : Promise.resolve([] as { id: string; nombre: string; objetivo: string | null; dia: string | null }[]),
      // "Completada" se define por semana REAL (lunes a domingo, huso
      // argentino): si el alumno sigue en la misma semana del programa más
      // de 7 días, el lunes siguiente vuelve a poder hacer todo.
      sql<{ id: string; session_id: string | null }[]>`
        select id, session_id from training_logs
        where student_id = ${student.id} and created_at >= ${inicioSemana.toISOString()}`,
    ])
  );

  // El check-in de hoy tiene que ser lo primero que ve al entrar a la app.
  if (checkinRows.length === 0) redirect("/alumno/checkin");

  const program = programRows[0] ?? null;
  const total = sessions.length;

  const logIdPorSesion = new Map((logsSemana ?? []).map((l) => [l.session_id, l.id]));

  // Cada sesión se muestra con el día que le puso el coach ("Lunes",
  // "Miércoles"…). Es una guía, no una obligación: si el alumno no hizo la
  // del miércoles, el jueves le aparece como pendiente y la puede hacer
  // igual (cualquier sesión se puede empezar cualquier día). Las que no
  // tienen día cargado se muestran como "Día N" según su orden, al final.
  const hoyIdx = DIAS.indexOf(nombreDiaHoy());
  const sesiones = sessions
    .map((s, i) => {
      const diaIdx = DIAS.indexOf(s.dia as (typeof DIAS)[number]);
      const logId = logIdPorSesion.get(s.id) ?? null;
      const estado: "hecha" | "hoy" | "pendiente" | "proxima" =
        logId ? "hecha" : diaIdx === -1 ? "proxima" : diaIdx === hoyIdx ? "hoy" : diaIdx < hoyIdx ? "pendiente" : "proxima";
      return {
        ...s,
        numero: i + 1,
        diaIdx,
        etiqueta: diaIdx === -1 ? `Día ${i + 1}` : DIAS[diaIdx],
        logId,
        estado,
      };
    })
    .sort((a, b) => (a.diaIdx === -1 ? 7 : a.diaIdx) - (b.diaIdx === -1 ? 7 : b.diaIdx) || a.numero - b.numero);

  const completadas = sesiones.filter((s) => s.logId).length;
  // La destacada arriba: la de hoy si todavía no la hizo; si no, la que le
  // quedó pendiente de un día anterior; si no, la próxima sin hacer.
  const sugerida =
    sesiones.find((s) => s.estado === "hoy") ??
    sesiones.find((s) => s.estado === "pendiente") ??
    sesiones.find((s) => !s.logId) ??
    null;
  const resto = sesiones.filter((s) => s.id !== sugerida?.id);
  const tagSugerida = !sugerida
    ? ""
    : sugerida.estado === "hoy"
      ? `Hoy · ${sugerida.etiqueta}`
      : sugerida.estado === "pendiente"
        ? `Te quedó pendiente del ${sugerida.etiqueta.toLowerCase()} · la podés hacer hoy`
        : sugerida.diaIdx === -1
          ? `${completadas > 0 ? "Seguí con" : "Arrancá con"} · ${sugerida.etiqueta}`
          : `Próxima · ${sugerida.etiqueta}`;

  const semana = semanaActual();
  const hoyNum = diaDelMesHoy();

  return (
    <AlumnoShell active="/alumno" nombre={student.nombre}>
      <div className="greet-row">
        <div className="avatar-circle">{student.nombre.charAt(0).toUpperCase()}</div>
        <div>
          <div className="greet">Hola, {student.nombre.split(" ")[0]}!</div>
          <div className="greet-sub">
            {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: TIMEZONE })}
          </div>
        </div>
      </div>

      <div className="week-strip">
        {semana.map(({ dia: d, fecha }) => (
          <div key={d} className={`week-day ${fecha.getUTCDate() === hoyNum ? "today" : ""}`}>
            <span className="wd-label">{DIA_CORTO[d]}</span>
            <span className="wd-num">{fecha.getUTCDate()}</span>
          </div>
        ))}
      </div>

      {checkin && <div className="banner success">Check-in guardado. ¡A entrenar!</div>}
      {entrenado && <div className="banner success">¡Entrenamiento registrado! Gran trabajo.</div>}
      {deshecho && <div className="banner success">Entrenamiento deshecho. Cuando quieras, lo volvés a empezar.</div>}

      {!program ? (
        <div className="empty">Todavía no tenés un programa asignado. Cuando tu coach te asigne uno, vas a ver tu entrenamiento acá.</div>
      ) : total === 0 ? (
        <>
          <div className="today-card">
            <div className="today-card-photo">
              <div className="tag">Semana {student.semana_actual}</div>
              <h2>Sin sesiones cargadas</h2>
              <div className="meta">{program.nombre} · Tu coach todavía no armó las sesiones de esta semana.</div>
            </div>
          </div>
        </>
      ) : (
        <>
          {sugerida ? (
            <div className="today-card">
              <div className="today-card-photo">
                <div className="today-card-head">
                  <div className="tag">
                    {tagSugerida}
                  </div>
                  <Icon name="chevronRight" size={16} className="today-card-chevron" />
                </div>
                <h2>{sugerida.nombre}</h2>
                <div className="meta">
                  {program.nombre} · Semana {student.semana_actual} · {sugerida.objetivo || "Sin objetivo"}
                </div>
              </div>
              <div className="today-card-body">
                <Link href={`/alumno/entrenar/${sugerida.id}`} className="btn primary block-w" style={{ position: "relative" }}>
                  <Icon name="play" size={15} />
                  Empezar entrenamiento
                </Link>
              </div>
            </div>
          ) : (
            <div className="today-card">
              <div className="today-card-photo">
                <div className="tag">Semana {student.semana_actual}</div>
                <h2>¡Completaste la semana!</h2>
                <div className="meta">
                  {program.nombre} · Ya hiciste las {total} sesiones de esta semana.
                </div>
              </div>
            </div>
          )}

          <div className="week-load">
            <div className="week-load-head">
              <span className="section-pill">Tu semana</span>
              <span className="week-load-count">
                {completadas} de {total} {total === 1 ? "sesión" : "sesiones"}
              </span>
            </div>
            <WeekBar done={completadas} total={total} />
          </div>

          {resto.length > 0 && (
            <>
              <div className="section-h" style={{ marginTop: 0 }}>
                <h3>Resto de la semana</h3>
              </div>
              <div className="mini-list">
                {resto.map((s) => (
                  <div key={s.id} className="mini-row">
                    <span className="mini-day">{s.etiqueta}</span>
                    <span className="mini-name">
                      {s.nombre}
                      {s.estado === "pendiente" && (
                        <span className="badge warn" style={{ marginLeft: 6 }}>
                          Pendiente
                        </span>
                      )}
                    </span>
                    {s.logId ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "0 0 auto" }}>
                        <span className="badge green">
                          <Icon name="check" size={10} />
                          Hecho
                        </span>
                        <form action={undoTraining.bind(null, s.logId)}>
                          <ConfirmSubmitButton
                            confirmMessage="¿Deshacer este entrenamiento? Vas a poder volver a marcarlo desde cero."
                            className="btn ghost sm"
                            style={{ color: "var(--text-dim)", padding: "4px 8px" }}
                          >
                            Deshacer
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    ) : (
                      <Link href={`/alumno/entrenar/${s.id}`} className="btn sm" style={{ flex: "0 0 auto" }}>
                        Empezar
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </AlumnoShell>
  );
}
