import { notFound } from "next/navigation";
import CoachShell from "@/components/CoachShell";
import { Crumbs } from "@/components/Crumbs";
import { SubmitButton } from "@/components/SubmitButton";
import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();

  const { data: program } = await supabase
    .from("programs")
    .select("id, nombre, owner_student_id")
    .eq("id", programId)
    .maybeSingle();
  if (!program) notFound();

  // Una rutina personal es de un solo alumno — no se agrupa con nadie más.
  if (program.owner_student_id) notFound();

  const { data: week } = semana
    ? await supabase.from("weeks").select("id, numero").eq("id", semana).maybeSingle()
    : { data: null };

  if (!week) notFound();

  const { data: students } = await supabase
    .from("students")
    .select("id, nombre, programa_id, semana_actual")
    .order("nombre");

  const { data: programsById } = await supabase.from("programs").select("id, nombre");
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
        <h1 style={{ fontSize: 20, margin: "0 0 6px" }}>Agrupar alumnos</h1>
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
