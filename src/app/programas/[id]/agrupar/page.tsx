import { notFound } from "next/navigation";
import CoachShell from "@/components/CoachShell";
import { Crumbs } from "@/components/Crumbs";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUser } from "@/lib/actions/require-user";
import { asUser } from "@/lib/db/as-user";
import { assignGroup } from "../../actions";

export default async function AgruparAlumnosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ semana?: string }>;
}) {
  const { id: programId } = await params;
  const { semana } = await searchParams;

  if (!/^[0-9a-f-]{36}$/i.test(programId)) notFound();
  const { user } = await requireUser();

  // Conexión directa con las reglas de seguridad del usuario (ver as-user.ts).
  const [[program], weekRows, students, programsById] = await asUser(user.id, (sql) =>
    Promise.all([
      sql<{ id: string; nombre: string; owner_student_id: string | null }[]>`
        select id, nombre, owner_student_id from programs where id = ${programId}`,
      semana && /^[0-9a-f-]{36}$/i.test(semana)
        ? sql<{ id: string; numero: number }[]>`select id, numero from weeks where id = ${semana} and program_id = ${programId}`
        : Promise.resolve([] as { id: string; numero: number }[]),
      sql<{ id: string; nombre: string; programa_id: string | null; semana_actual: number }[]>`
        select id, nombre, programa_id, semana_actual from students order by nombre`,
      sql<{ id: string; nombre: string }[]>`select id, nombre from programs`,
    ])
  );
  if (!program) notFound();

  // Una rutina personal es de un solo alumno — no se agrupa con nadie más.
  if (program.owner_student_id) notFound();

  const week = weekRows[0];
  if (!week) notFound();

  const programNames = Object.fromEntries((programsById ?? []).map((p) => [p.id, p.nombre]));

  const assignAction = assignGroup.bind(null, programId, week.id, week.numero);

  return (
    <CoachShell active="/programas">
      <div style={{ maxWidth: 480 }}>
        <Crumbs
          items={[
            { label: "Programas", href: "/programas" },
            { label: `${program.nombre} · Sem ${week.numero}`, href: `/programas/${programId}?semana=${week.id}` },
            { label: "Agrupar alumnos" },
          ]}
        />
        <h1 style={{ margin: "0 0 6px" }}>Agrupar alumnos</h1>
        <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "0 0 20px" }}>
          Los alumnos que marques van a quedar en <strong>{program.nombre} · Semana {week.numero}</strong> y van a
          ver exactamente las mismas sesiones.
        </p>

        <form action={assignAction} style={{ display: "grid", gap: 14 }}>
          <div className="card" style={{ maxHeight: 420, overflowY: "auto", padding: 6 }}>
            {!students || students.length === 0 ? (
              <p style={{ color: "var(--text-faint)", fontSize: 13, padding: 12 }}>Todavía no tenés alumnos cargados.</p>
            ) : (
              students.map((s) => {
                const inThisGroup = s.programa_id === programId && s.semana_actual === week.numero;
                const otherProgram = !inThisGroup && s.programa_id ? programNames[s.programa_id] : null;
                return (
                  <label key={s.id} className="pick-row">
                    <input type="checkbox" name="student_id" value={s.id} defaultChecked={inThisGroup} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.nombre}</div>
                      {otherProgram && (
                        <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
                          Actualmente en {otherProgram} · Sem {s.semana_actual}
                        </div>
                      )}
                    </div>
                  </label>
                );
              })
            )}
          </div>

          <SubmitButton className="btn primary block-w">Guardar grupo</SubmitButton>
        </form>
      </div>
    </CoachShell>
  );
}
