import { notFound } from "next/navigation";
import CoachShell from "@/components/CoachShell";
import { Crumbs } from "@/components/Crumbs";
import { SubmitButton } from "@/components/SubmitButton";
import { createClient } from "@/lib/supabase/server";
import { applyTemplateToSessions } from "@/app/biblioteca/templates-actions";

export default async function AplicarPlantillaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ semana?: string }>;
}) {
  const { id: programId } = await params;
  const { semana } = await searchParams;

  const supabase = await createClient();

  const { data: program } = await supabase.from("programs").select("id, nombre").eq("id", programId).maybeSingle();
  if (!program) notFound();

  const { data: week } = semana
    ? await supabase.from("weeks").select("id, numero").eq("id", semana).maybeSingle()
    : { data: null };
  if (!week) notFound();

  const [{ data: sessions }, { data: templates }] = await Promise.all([
    supabase.from("sessions").select("id, nombre").eq("week_id", week.id).order("orden"),
    supabase.from("templates").select("id, nombre").neq("tipo", "calentamiento").order("nombre"),
  ]);

  const applyAction = applyTemplateToSessions.bind(null, programId, week.id);

  return (
    <CoachShell active="/programas">
      <div style={{ maxWidth: 480 }}>
        <Crumbs
          items={[
            { label: "Programas", href: "/programas" },
            { label: `${program.nombre} · Sem ${week.numero}`, href: `/programas/${programId}?semana=${week.id}` },
            { label: "Aplicar plantilla" },
          ]}
        />
        <h1 style={{ fontSize: 20, margin: "0 0 6px" }}>Aplicar plantilla a varias sesiones</h1>
        <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "0 0 20px" }}>
          Elegí una plantilla de bloques y las sesiones de <strong>Semana {week.numero}</strong> donde insertarla. Se
          agrega a cada sesión elegida sin borrar lo que ya tenga.
        </p>

        {!templates || templates.length === 0 ? (
          <div className="empty">
            Todavía no tenés plantillas de bloques. Creá una desde Biblioteca → Plantillas.
          </div>
        ) : !sessions || sessions.length === 0 ? (
          <div className="empty">Esta semana todavía no tiene sesiones.</div>
        ) : (
          <form action={applyAction} style={{ display: "grid", gap: 14 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <span className="field-label">Plantilla</span>
              <select name="template_id" required defaultValue="">
                <option value="" disabled>
                  Elegí una plantilla…
                </option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="field-label">Sesiones</span>
              <div className="card" style={{ maxHeight: 360, overflowY: "auto", padding: 6 }}>
                {sessions.map((s, i) => (
                  <label key={s.id} className="pick-row">
                    <input type="checkbox" name="session_id" value={s.id} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.nombre}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>Día {i + 1}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <SubmitButton className="btn primary block-w">Aplicar a las sesiones elegidas</SubmitButton>
          </form>
        )}
      </div>
    </CoachShell>
  );
}
