import Link from "next/link";
import { redirect } from "next/navigation";
import AlumnoShell from "@/components/AlumnoShell";
import { Icon } from "@/components/Icon";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { requireStudent } from "@/lib/actions/require-student";
import { DIAS } from "@/lib/constants";
import { TIMEZONE, diaDelMesHoy, inicioDeHoyArgentina, inicioDeSemanaArgentina } from "@/lib/date";
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
  const { supabase, student } = await requireStudent();

  const startOfToday = inicioDeHoyArgentina();

  // El check-in de hoy se resuelve primero y aparte de todo lo demás —
  // no depende del programa ni de las sesiones. Si todavía no lo hizo, lo
  // mandamos derecho para allá: tiene que ser lo primero que ve al entrar
  // a la app, antes de llegar a su entrenamiento del día. Una vez que lo
  // completa, submitCheckin lo trae de vuelta acá (ver actions.ts).
  const { data: checkinHoy } = await supabase
    .from("checkins")
    .select("id")
    .eq("student_id", student.id)
    .gte("fecha", startOfToday.toISOString())
    .maybeSingle();

  if (!checkinHoy) redirect("/alumno/checkin");

  // programa → semana → sesiones son dependientes entre sí (necesitan el id
  // del anterior), así que van en cadena.
  async function cargarProgramaDeHoy() {
    const { data: program } = student.programa_id
      ? await supabase
          .from("programs")
          .select("id, nombre, objetivo, duracion_semanas")
          .eq("id", student.programa_id)
          .maybeSingle()
      : { data: null };

    const { data: week } = program
      ? await supabase
          .from("weeks")
          .select("id, numero")
          .eq("program_id", program.id)
          .eq("numero", student.semana_actual)
          .maybeSingle()
      : { data: null };

    const { data: sessions } = week
      ? await supabase
          .from("sessions")
          .select("id, nombre, objetivo")
          .eq("week_id", week.id)
          .order("orden")
      : { data: [] as { id: string; nombre: string; objetivo: string | null }[] };

    return { program, sessions: sessions ?? [] };
  }

  const { program, sessions } = await cargarProgramaDeHoy();
  const total = sessions.length;

  // Las sesiones de la semana ya no están atadas a un día fijo: el alumno
  // puede hacer "Día 1", "Día 2", etc. en el orden que quiera (martes,
  // jueves, el mismo día dos veces, como le convenga). Lo único que se
  // numera es el ORDEN dentro de la semana del programa (el mismo que usa
  // el coach al armarla) — no un día del calendario real.
  //
  // "Completada" se define por semana REAL (lunes a domingo, huso
  // argentino), no por sesión-del-día como antes: así, si el alumno se
  // queda en la misma semana del programa más de 7 días (el coach todavía
  // no le avanzó de semana), el lunes siguiente vuelve a poder hacer todas
  // las sesiones desde cero, en vez de quedar "hechas" para siempre.
  const inicioSemana = inicioDeSemanaArgentina();

  const { data: logsSemana } = total
    ? await supabase
        .from("training_logs")
        .select("id, session_id")
        .in(
          "session_id",
          sessions.map((s) => s.id)
        )
        .gte("created_at", inicioSemana.toISOString())
    : { data: [] as { id: string; session_id: string | null }[] };

  const logIdPorSesion = new Map((logsSemana ?? []).map((l) => [l.session_id, l.id]));

  const sesiones = sessions.map((s, i) => ({
    ...s,
    numero: i + 1,
    logId: logIdPorSesion.get(s.id) ?? null,
  }));

  const completadas = sesiones.filter((s) => s.logId).length;
  // La "sugerida" es la primera sin hacer, en el orden de la semana — no
  // obliga a nada, es sólo para no dejarlo mirando una lista sin saber por
  // dónde arrancar. Si ya hizo todas, no hay sugerida.
  const sugerida = sesiones.find((s) => !s.logId) ?? null;
  const resto = sesiones.filter((s) => s.id !== sugerida?.id);

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
          <div className="section-pill">Tu semana</div>
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
          <div className="section-pill">Tu semana</div>

          {sugerida ? (
            <div className="today-card">
              <div className="today-card-photo">
                <div className="today-card-head">
                  <div className="tag">
                    {completadas > 0 ? "Seguí con" : "Arrancá con"} · Día {sugerida.numero} de {total}
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

          {resto.length > 0 && (
            <>
              <div className="section-h" style={{ marginTop: 0 }}>
                <h3>Resto de la semana</h3>
              </div>
              <div className="mini-list">
                {resto.map((s) => (
                  <div key={s.id} className="mini-row">
                    <span
                      style={{
                        minWidth: 46,
                        fontSize: 10.5,
                        fontFamily: "var(--font-display)",
                        textTransform: "uppercase",
                        color: "var(--text-faint)",
                      }}
                    >
                      Día {s.numero}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{s.nombre}</span>
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
                            style={{ color: "var(--text-faint)", padding: "4px 8px", fontSize: 11 }}
                          >
                            Deshacer
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    ) : (
                      <Link href={`/alumno/entrenar/${s.id}`} className="btn sm" style={{ flex: "0 0 auto", fontSize: 11.5, padding: "5px 10px" }}>
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
