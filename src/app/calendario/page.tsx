import Link from "next/link";
import CoachShell from "@/components/CoachShell";
import { Icon } from "@/components/Icon";
import { createClient } from "@/lib/supabase/server";
import { inicioDeSemanaArgentina } from "@/lib/date";

type DiaSesion = {
  sessionId: string;
  numero: number;
  nombre: string;
  hecha: boolean;
};

type PlanAlumno = {
  studentId: string;
  studentNombre: string;
  programId: string;
  programNombre: string;
  weekId: string;
  weekNumero: number;
  dias: DiaSesion[];
};

export default async function CalendarioPage() {
  const supabase = await createClient();

  const { data: students } = await supabase
    .from("students")
    .select("id, nombre, programa_id, semana_actual")
    .eq("estado", "Activo")
    .not("programa_id", "is", null);

  // Las sesiones ya no tienen un día fijo — cada alumno puede hacer "Día 1",
  // "Día 2", etc. de su semana actual cuando quiera (martes, jueves, el
  // mismo día dos veces...). Acá se muestra, por alumno, qué tan avanzado
  // va con esa semana: cuáles ya completó y cuáles le faltan. "Completada"
  // se cuenta desde el lunes de la semana REAL (huso argentino) — si un
  // alumno se queda más de 7 días en la misma semana del programa, el
  // lunes siguiente vuelve a ver todo pendiente y puede repetirla.
  const inicioSemana = inicioDeSemanaArgentina();

  const planes = await Promise.all(
    (students ?? []).map(async (s): Promise<PlanAlumno | null> => {
      const { data: program } = await supabase
        .from("programs")
        .select("id, nombre")
        .eq("id", s.programa_id as string)
        .maybeSingle();
      if (!program) return null;

      const { data: week } = await supabase
        .from("weeks")
        .select("id, numero")
        .eq("program_id", program.id)
        .eq("numero", s.semana_actual)
        .maybeSingle();
      if (!week) return null;

      const { data: sessions } = await supabase
        .from("sessions")
        .select("id, nombre")
        .eq("week_id", week.id)
        .order("orden");
      if (!sessions || sessions.length === 0) return null;

      const { data: logs } = await supabase
        .from("training_logs")
        .select("session_id")
        .in(
          "session_id",
          sessions.map((sess) => sess.id)
        )
        .gte("created_at", inicioSemana.toISOString());
      const hechas = new Set((logs ?? []).map((l) => l.session_id));

      return {
        studentId: s.id,
        studentNombre: s.nombre,
        programId: program.id,
        programNombre: program.nombre,
        weekId: week.id,
        weekNumero: week.numero,
        dias: sessions.map((sess, i) => ({
          sessionId: sess.id,
          numero: i + 1,
          nombre: sess.nombre,
          hecha: hechas.has(sess.id),
        })),
      };
    })
  );

  const items = planes.filter((p): p is PlanAlumno => p !== null);

  return (
    <CoachShell active="/calendario">
      <div className="content-head">
        <div>
          <h1>Calendario</h1>
          <div className="sub">
            Plan de la semana de cada alumno activo — ya no está atado a un día fijo, así que se muestra el avance
            dentro de su semana actual (qué hizo y qué le falta).
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty">
          Todavía no hay sesiones programadas esta semana. Asignales un programa a tus alumnos activos en la sección
          Alumnos para verlas acá.
        </div>
      ) : (
        <div className="plan-list">
          {items.map((p) => (
            <div key={p.studentId} className="plan-card">
              <div className="plan-head">
                <span className="student">{p.studentNombre}</span>
                <span className="meta">
                  {p.programNombre} · Semana {p.weekNumero} · {p.dias.filter((d) => d.hecha).length}/{p.dias.length} hechas
                </span>
              </div>
              <div className="plan-days">
                {p.dias.map((d) => (
                  <Link
                    key={d.sessionId}
                    href={`/programas/${p.programId}/sesiones/${d.sessionId}?semana=${p.weekId}`}
                    className={`plan-day ${d.hecha ? "done" : ""}`}
                    title={d.nombre}
                  >
                    {d.hecha && <Icon name="check" size={11} />}
                    Día {d.numero}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </CoachShell>
  );
}
