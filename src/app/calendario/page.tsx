import Link from "next/link";
import CoachShell from "@/components/CoachShell";
import { Icon } from "@/components/Icon";
import { requireUser } from "@/lib/actions/require-user";
import { asUser } from "@/lib/db/as-user";
import { inicioDeSemanaArgentina } from "@/lib/date";

type DiaSesion = {
  sessionId: string;
  numero: number;
  nombre: string;
  dia: string | null;
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
  const { user } = await requireUser();
  const inicioSemana = inicioDeSemanaArgentina();

  // Antes: 4 consultas REST POR ALUMNO (programa, semana, sesiones, logs).
  // Ahora una sola consulta por conexión directa, con las reglas de
  // seguridad del usuario (ver as-user.ts).
  const rows = await asUser(user.id, (sql) => sql<
    {
      student_id: string; student_nombre: string; program_id: string; program_nombre: string;
      week_id: string; week_numero: number; session_id: string; session_nombre: string; dia: string | null; hecha: boolean;
    }[]
  >`
    select s.id as student_id, s.nombre as student_nombre, p.id as program_id, p.nombre as program_nombre,
           w.id as week_id, w.numero as week_numero, se.id as session_id, se.nombre as session_nombre, se.dia,
           exists (select 1 from training_logs t where t.session_id = se.id and t.student_id = s.id
                   and t.created_at >= ${inicioSemana.toISOString()}) as hecha
    from students s
    join programs p on p.id = s.programa_id
    join weeks w on w.program_id = p.id and w.numero = s.semana_actual
    join sessions se on se.week_id = w.id
    where s.estado = 'Activo'
    order by s.nombre, se.orden
  `);

  const porAlumno = new Map<string, PlanAlumno>();
  for (const r of rows) {
    let plan = porAlumno.get(r.student_id);
    if (!plan) {
      plan = {
        studentId: r.student_id, studentNombre: r.student_nombre, programId: r.program_id, programNombre: r.program_nombre,
        weekId: r.week_id, weekNumero: r.week_numero, dias: [],
      };
      porAlumno.set(r.student_id, plan);
    }
    plan.dias.push({ sessionId: r.session_id, numero: plan.dias.length + 1, nombre: r.session_nombre, dia: r.dia, hecha: r.hecha });
  }
  const planes = [...porAlumno.values()];

  const items = planes;

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
                    {d.dia || `Día ${d.numero}`}
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
