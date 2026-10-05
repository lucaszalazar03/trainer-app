import Link from "next/link";
import { notFound } from "next/navigation";
import CoachShell from "@/components/CoachShell";
import { Crumbs } from "@/components/Crumbs";
import { Icon } from "@/components/Icon";
import { SubmitButton } from "@/components/SubmitButton";
import { SessionList } from "@/components/SessionList";
import { createClient } from "@/lib/supabase/server";
import { addWeek, addSession, deleteSession, duplicateSession, duplicateWeek, reorderSessions } from "../actions";

export default async function ProgramaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ semana?: string }>;
}) {
  const { id } = await params;
  const { semana } = await searchParams;

  const supabase = await createClient();

  // program y weeks sólo necesitan el id del programa — en paralelo.
  const [{ data: program }, { data: weeks }] = await Promise.all([
    supabase
      .from("programs")
      .select("id, nombre, objetivo, nivel, duracion_semanas, owner_student_id")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("weeks").select("id, numero").eq("program_id", id).order("numero"),
  ]);

  if (!program) notFound();

  const isPersonal = !!program.owner_student_id;
  const { data: owner } = isPersonal
    ? await supabase.from("students").select("id, nombre").eq("id", program.owner_student_id!).maybeSingle()
    : { data: null };

  const activeWeek = weeks?.find((w) => w.id === semana) ?? weeks?.[weeks.length - 1];

  // grupoSemana y sessions dependen de activeWeek pero no entre sí.
  const [{ data: grupoSemana }, { data: sessions }] = await Promise.all([
    activeWeek
      ? supabase.from("students").select("nombre").eq("programa_id", id).eq("semana_actual", activeWeek.numero)
      : Promise.resolve({ data: [] as { nombre: string }[] }),
    activeWeek
      ? supabase.from("sessions").select("id, nombre, objetivo").eq("week_id", activeWeek.id).order("orden")
      : Promise.resolve({ data: [] as { id: string; nombre: string; objetivo: string | null }[] }),
  ]);

  const sessionIds = sessions?.map((s) => s.id) ?? [];
  const counts: Record<string, { bloques: number; ejercicios: number }> = {};
  if (sessionIds.length) {
    const { data: blocks } = await supabase.from("blocks").select("id, session_id").in("session_id", sessionIds);

    for (const b of blocks ?? []) {
      counts[b.session_id] ??= { bloques: 0, ejercicios: 0 };
      counts[b.session_id].bloques += 1;
    }

    const blockIds = blocks?.map((b) => b.id) ?? [];
    if (blockIds.length) {
      const { data: exs } = await supabase.from("block_exercises").select("id, block_id").in("block_id", blockIds);
      const blockToSession = Object.fromEntries((blocks ?? []).map((b) => [b.id, b.session_id]));
      for (const e of exs ?? []) {
        const sid = blockToSession[e.block_id];
        if (sid) counts[sid].ejercicios += 1;
      }
    }
  }

  return (
    <CoachShell active={isPersonal ? "/alumnos" : "/programas"}>
      <Crumbs
        items={
          isPersonal && owner
            ? [{ label: "Alumnos", href: "/alumnos" }, { label: owner.nombre, href: `/alumnos/${owner.id}` }, { label: program.nombre }]
            : [{ label: "Programas", href: "/programas" }, { label: program.nombre }]
        }
      />

      <div className="content-head">
        <div>
          <h1>{program.nombre}</h1>
          <div className="sub">
            {program.objetivo} · Nivel {program.nivel} · {program.duracion_semanas} semanas
            {isPersonal && owner && <> · rutina personal de {owner.nombre}</>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/programas/${id}/editar`} className="btn">
            <Icon name="edit" size={15} />
            Editar datos
          </Link>
          <form action={addWeek.bind(null, id)}>
            <SubmitButton className="btn primary">
              <Icon name="plus" size={15} />
              Agregar semana
            </SubmitButton>
          </form>
        </div>
      </div>

      <div className="week-pills">
        {(weeks ?? []).map((w) => (
          <Link key={w.id} href={`/programas/${id}?semana=${w.id}`} className={`week-pill ${w.id === activeWeek?.id ? "active" : ""}`}>
            Semana {w.numero}
          </Link>
        ))}
      </div>

      {activeWeek && (
        <>
          <div className="section-h" style={{ marginTop: 0 }}>
            <h3 style={{ textTransform: "none", fontSize: 15, letterSpacing: 0, color: "var(--text)" }}>
              Sesiones — Semana {activeWeek.numero}
            </h3>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              {!isPersonal && (
                <Link href={`/programas/${id}/agrupar?semana=${activeWeek.id}`} className="link-btn">
                  <Icon name="users" size={13} />
                  Agrupar alumnos
                </Link>
              )}
              {sessions && sessions.length > 0 && (
                <>
                  <Link
                    href={`/programas/${id}/aplicar-plantilla?semana=${activeWeek.id}`}
                    className="link-btn"
                    title="Insertá una plantilla de bloques en varias sesiones de esta semana de una sola vez"
                  >
                    <Icon name="layers" size={13} />
                    Aplicar plantilla
                  </Link>
                  <form action={duplicateWeek.bind(null, id, activeWeek.id)}>
                    <SubmitButton
                      className="link-btn"
                      title="Clona todas las sesiones de esta semana (con su entrada en calor y bloques) en una semana nueva"
                    >
                      <Icon name="copy" size={13} />
                      Duplicar semana
                    </SubmitButton>
                  </form>
                </>
              )}
              <form action={addSession.bind(null, id, activeWeek.id)}>
                <SubmitButton className="link-btn">
                  <Icon name="plus" size={13} />
                  Agregar sesión
                </SubmitButton>
              </form>
            </div>
          </div>

          {!isPersonal && grupoSemana && grupoSemana.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>En esta semana:</span>
              {grupoSemana.map((s, i) => (
                <span key={i} className="badge neutral">
                  {s.nombre}
                </span>
              ))}
            </div>
          )}

          {!sessions || sessions.length === 0 ? (
            <div className="empty" style={{ maxWidth: 620 }}>Esta semana todavía no tiene sesiones.</div>
          ) : (
            <div style={{ maxWidth: 700 }}>
              <SessionList
                items={sessions.map((s) => ({
                  id: s.id,
                  nombre: s.nombre,
                  objetivo: s.objetivo,
                  bloques: counts[s.id]?.bloques ?? 0,
                  ejercicios: counts[s.id]?.ejercicios ?? 0,
                  editHref: `/programas/${id}/sesiones/${s.id}?semana=${activeWeek.id}`,
                  onDuplicate: duplicateSession.bind(null, id, activeWeek.id, s.id),
                  onDelete: deleteSession.bind(null, id, activeWeek.id, s.id),
                }))}
                onReorder={reorderSessions.bind(null, id, activeWeek.id)}
              />
            </div>
          )}
        </>
      )}
    </CoachShell>
  );
}
