import Link from "next/link";
import { notFound } from "next/navigation";
import CoachShell from "@/components/CoachShell";
import { Crumbs } from "@/components/Crumbs";
import { Icon } from "@/components/Icon";
import { SubmitButton } from "@/components/SubmitButton";
import { SessionList } from "@/components/SessionList";
import { requireUser } from "@/lib/actions/require-user";
import { getDirectSql } from "@/lib/db/direct";
import { friendlyDbError } from "@/lib/db/friendly-error";
import { addWeek, addSession, deleteSession, duplicateSession, duplicateWeek, reorderSessions, deleteWeek } from "../actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";

export default async function ProgramaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ semana?: string; error?: string }>;
}) {
  const { id } = await params;
  const { semana, error: errorParam } = await searchParams;

  const { user } = await requireUser();
  const sql = getDirectSql();

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) notFound();

  // Antes esta pantalla leía todo por supabase-js (API REST de Supabase),
  // que en el plan chico se corta por timeout: la rutina "no abría" (404 o
  // pantalla rota) aunque los datos estuvieran bien. Ahora va por conexión
  // directa en UNA sola tanda de consultas; como no pasa por RLS, todo se
  // filtra a mano por programs.coach_id = user.id. Si algo falla, se muestra
  // un aviso con "Reintentar" en vez de romper la página.
  type Program = { id: string; nombre: string; objetivo: string | null; nivel: string | null; duracion_semanas: number | null; owner_student_id: string | null };
  type Sess = { id: string; nombre: string; objetivo: string | null; dia: string | null; bloques: number; ejercicios: number };
  let program = null as Program | null;
  let weeks: { id: string; numero: number }[] = [];
  let owner = null as { id: string; nombre: string } | null;
  let alumnos: { nombre: string; semana_actual: number | null }[] = [];
  let sessions: Sess[] = [];
  let activeWeek = undefined as { id: string; numero: number } | undefined;
  let loadError: string | null = null;

  try {
    const [progRows, weekRows, ownerRows, alumnoRows] = await Promise.all([
      sql<Program[]>`
        select id, nombre, objetivo, nivel, duracion_semanas, owner_student_id
        from programs where id = ${id} and coach_id = ${user.id}
      `,
      sql<{ id: string; numero: number }[]>`
        select w.id, w.numero from weeks w join programs p on p.id = w.program_id
        where w.program_id = ${id} and p.coach_id = ${user.id} order by w.numero
      `,
      sql<{ id: string; nombre: string }[]>`
        select s.id, s.nombre from programs p join students s on s.id = p.owner_student_id
        where p.id = ${id} and p.coach_id = ${user.id}
      `,
      sql<{ nombre: string; semana_actual: number | null }[]>`
        select nombre, semana_actual from students where programa_id = ${id} and coach_id = ${user.id} order by nombre
      `,
    ]);
    program = progRows[0] ?? null;
    weeks = weekRows;
    owner = ownerRows[0] ?? null;
    alumnos = alumnoRows;
    activeWeek = weeks.find((w) => w.id === semana) ?? weeks[weeks.length - 1];

    if (program && activeWeek) {
      // Sesiones de la semana con sus cantidades de bloques y ejercicios,
      // todo en una sola consulta.
      sessions = await sql<Sess[]>`
        select se.id, se.nombre, se.objetivo, se.dia,
          (select count(*)::int from blocks b where b.session_id = se.id) as bloques,
          (select count(*)::int from block_exercises be join blocks b on b.id = be.block_id where b.session_id = se.id) as ejercicios
        from sessions se where se.week_id = ${activeWeek.id}
        order by se.orden
      `;
    }
  } catch (err) {
    loadError = friendlyDbError(err) ?? "No se pudo cargar la rutina.";
  }

  if (loadError) {
    return (
      <CoachShell active="/programas">
        <Crumbs items={[{ label: "Programas", href: "/programas" }, { label: "Rutina" }]} />
        <div className="banner danger" style={{ maxWidth: 600 }}>
          {loadError} Tus cambios guardados no se perdieron.
        </div>
        <Link href={`/programas/${id}${semana ? `?semana=${semana}` : ""}`} className="btn primary">
          Reintentar
        </Link>
      </CoachShell>
    );
  }

  if (!program) notFound();

  const isPersonal = !!program.owner_student_id;
  const usuarios = alumnos;
  const grupoSemana = activeWeek ? alumnos.filter((a) => a.semana_actual === activeWeek!.numero) : [];
  const counts: Record<string, { bloques: number; ejercicios: number }> = Object.fromEntries(
    sessions.map((s) => [s.id, { bloques: s.bloques, ejercicios: s.ejercicios }])
  );

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

      {usuarios.length > 1 && (
        <div className="banner" style={{ fontSize: 12.5, marginBottom: 14, color: "var(--text-dim)" }}>
          <Icon name="users" size={13} /> Esta rutina la usan {usuarios.length} alumnos:{" "}
          <strong style={{ color: "var(--text)" }}>{usuarios.map((u) => u.nombre).join(", ")}</strong>. Lo que cambies acá se
          actualiza para todos.
        </div>
      )}

      {errorParam && (
        <div className="banner danger" style={{ maxWidth: 600 }}>
          {errorParam}
        </div>
      )}

      <div className="week-pills">
        {weeks.map((w) => (
          <Link key={w.id} href={`/programas/${id}?semana=${w.id}`} className={`week-pill ${w.id === activeWeek?.id ? "active" : ""}`}>
            Semana {w.numero}
          </Link>
        ))}
      </div>

      {activeWeek && (
        <>
          <div className="section-h" style={{ marginTop: 0 }}>
            <h3>Sesiones — Semana {activeWeek.numero}</h3>
            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
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
              <form action={deleteWeek.bind(null, id, activeWeek.id)}>
                <ConfirmSubmitButton
                  className="link-btn"
                  style={{ color: "var(--danger)" }}
                  confirmMessage={`¿Eliminar la Semana ${activeWeek.numero} con todas sus sesiones? No se puede deshacer. (El historial de entrenamientos ya hechos se conserva.)`}
                >
                  <Icon name="trash" size={13} />
                  Eliminar semana
                </ConfirmSubmitButton>
              </form>
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
                  dia: s.dia,
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
