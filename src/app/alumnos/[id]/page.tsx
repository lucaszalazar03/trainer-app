import Link from "next/link";
import { notFound } from "next/navigation";
import CoachShell from "@/components/CoachShell";
import { Crumbs } from "@/components/Crumbs";
import { Icon } from "@/components/Icon";
import { TextField, TextAreaField, SelectField, ErrorBanner, SuccessBanner } from "@/components/FormField";
import { AthleteFields } from "@/components/AthleteFields";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUser } from "@/lib/actions/require-user";
import { getDirectSql } from "@/lib/db/direct";
import { friendlyDbError } from "@/lib/db/friendly-error";
import { TIMEZONE } from "@/lib/date";
import { updateStudent, deleteStudent, assignProgram } from "../actions";
import { createPersonalProgram, importProgramAsPersonal, saveProgramAsTemplate, shareRoutineFromStudent } from "../rutina-actions";

export default async function AlumnoDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { error, saved } = await searchParams;

  const { user } = await requireUser();
  const sql = getDirectSql();

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) notFound();

  // Antes todo esto iba por supabase-js (API REST), que en el plan chico de
  // Supabase se corta por timeout: la ficha cargaba a medias y los botones
  // parecían no responder. Ahora va por conexión directa; como no pasa por
  // RLS, todo filtra a mano por coach_id = user.id.
  type Student = {
    id: string; nombre: string; email: string | null; objetivo: string | null; estado: string;
    notas: string | null; semana_actual: number | null; programa_id: string | null; edad: number | null;
    altura_cm: number | null; peso_kg: number | null; deporte: string | null; posicion: string | null; nuevo: boolean;
  };
  type Prog = { id: string; nombre: string; duracion_semanas: number | null; owner_student_id: string | null; owner_nombre: string | null };
  let student = null as Student | null;
  let programs: Prog[] = [];
  let ultimoCheckin = null as { fecha: string; energia: number; dolor: number; sueno: number } | null;
  let pesosRaw: { exercise_id: string; peso_kg: number; fecha: string; nombre: string | null }[] = [];
  // Otros alumnos con rutina asignada: para "usar la misma rutina que…" y
  // para mostrar con quién comparte la rutina actual.
  let otherStudents: { id: string; nombre: string; programa_id: string; programa_nombre: string }[] = [];
  let loadError: string | null = null;

  try {
    const [stRows, progRows, ciRows, pesoRows, otherRows] = await Promise.all([
      sql<Student[]>`
        select id, nombre, email, objetivo, estado, notas, semana_actual, programa_id, edad, altura_cm, peso_kg, deporte, posicion, nuevo
        from students where id = ${id} and coach_id = ${user.id}
      `,
      // Generales (biblioteca) + personales de este alumno + la que tenga
      // asignada ahora aunque sea la rutina personal de OTRO alumno (compartida).
      sql<Prog[]>`
        select p.id, p.nombre, p.duracion_semanas, p.owner_student_id, o.nombre as owner_nombre
        from programs p left join students o on o.id = p.owner_student_id
        where p.coach_id = ${user.id}
          and (p.owner_student_id is null or p.owner_student_id = ${id}
               or p.id = (select programa_id from students where id = ${id} and coach_id = ${user.id}))
        order by p.nombre
      `,
      sql<{ fecha: string; energia: number; dolor: number; sueno: number }[]>`
        select to_json(c.fecha)#>>'{}' as fecha, c.energia, c.dolor, c.sueno from checkins c
        join students s on s.id = c.student_id
        where c.student_id = ${id} and s.coach_id = ${user.id}
        order by c.fecha desc limit 1
      `,
      sql<{ exercise_id: string; peso_kg: number; fecha: string; nombre: string | null }[]>`
        select l.exercise_id, l.peso_kg::float8 as peso_kg, to_json(l.fecha)#>>'{}' as fecha, e.nombre from exercise_logs l
        join students s on s.id = l.student_id
        left join exercises e on e.id = l.exercise_id
        where l.student_id = ${id} and s.coach_id = ${user.id}
        order by l.fecha desc limit 150
      `,
      sql<{ id: string; nombre: string; programa_id: string; programa_nombre: string }[]>`
        select s.id, s.nombre, s.programa_id, p.nombre as programa_nombre
        from students s join programs p on p.id = s.programa_id
        where s.coach_id = ${user.id} and s.id <> ${id}
        order by s.nombre
      `,
    ]);
    student = stRows[0] ?? null;
    programs = progRows;
    ultimoCheckin = ciRows[0] ?? null;
    pesosRaw = pesoRows;
    otherStudents = otherRows;
  } catch (err) {
    loadError = friendlyDbError(err) ?? "No se pudo cargar el alumno.";
  }

  if (loadError) {
    return (
      <CoachShell active="/alumnos">
        <div style={{ maxWidth: 480 }}>
          <Crumbs items={[{ label: "Alumnos", href: "/alumnos" }, { label: "Alumno" }]} />
          <div className="banner danger">{loadError}</div>
          <Link href={`/alumnos/${id}`} className="btn primary">
            Reintentar
          </Link>
        </div>
      </CoachShell>
    );
  }

  if (!student) notFound();

  // Alumno que se registró solo: al abrir su ficha deja de figurar como "Nuevo".
  if (student.nuevo) {
    await sql`update students set nuevo = false where id = ${id} and coach_id = ${user.id}`.catch(() => {});
  }

  // Agrupa por ejercicio conservando el orden (ya viene fecha desc), y se
  // queda con los últimos 5 valores de cada uno para no saturar la tarjeta.
  const pesosPorEjercicio = new Map<string, { nombre: string; entradas: { peso: number; fecha: string }[] }>();
  for (const row of pesosRaw) {
    const nombre = row.nombre ?? "Ejercicio";
    if (!pesosPorEjercicio.has(row.exercise_id)) pesosPorEjercicio.set(row.exercise_id, { nombre, entradas: [] });
    const grupo = pesosPorEjercicio.get(row.exercise_id)!;
    if (grupo.entradas.length < 5) grupo.entradas.push({ peso: Number(row.peso_kg), fecha: String(row.fecha) });
  }

  const currentProgram = programs.find((p) => p.id === student.programa_id);
  const isPersonalRoutine = currentProgram?.owner_student_id === id;
  // Rutina personal de otro alumno que este alumno usa compartida.
  const sharedFromOwner = currentProgram && currentProgram.owner_student_id && !isPersonalRoutine ? currentProgram.owner_nombre : null;
  const companions = otherStudents.filter((o) => o.programa_id === student.programa_id);
  const shareable = otherStudents.filter((o) => o.programa_id !== student.programa_id);
  const generalPrograms = programs.filter((p) => p.owner_student_id === null);

  // Formulario "usar la misma rutina que otro alumno" (va en los dos casos:
  // con o sin rutina asignada).
  const shareForm =
    shareable.length > 0 ? (
      <form
        action={shareRoutineFromStudent.bind(null, id)}
        style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
      >
        <select name="source_student_id" defaultValue="" style={{ flex: 1, minWidth: 180 }}>
          <option value="" disabled>
            Usar la misma rutina que…
          </option>
          {shareable.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nombre} ({o.programa_nombre})
            </option>
          ))}
        </select>
        <ConfirmSubmitButton
          className="btn"
          confirmMessage={`¿Que ${student.nombre} use la MISMA rutina que el alumno elegido? Desde ahora, lo que cambies en esa rutina lo van a ver los dos.`}
        >
          <Icon name="users" size={14} />
          Compartir rutina
        </ConfirmSubmitButton>
      </form>
    ) : null;

  const updateWithId = updateStudent.bind(null, id);
  const deleteWithId = deleteStudent.bind(null, id);

  return (
    <CoachShell active="/alumnos">
      <div style={{ maxWidth: 480 }}>
        <Crumbs items={[{ label: "Alumnos", href: "/alumnos" }, { label: student.nombre }]} />
        <h1 style={{ margin: "0 0 6px" }}>{student.nombre}</h1>

        {(student.edad || student.altura_cm || student.peso_kg || student.deporte) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
            {student.edad && <span className="badge neutral">{student.edad} años</span>}
            {student.altura_cm && <span className="badge neutral">{student.altura_cm} cm</span>}
            {student.peso_kg && <span className="badge neutral">{student.peso_kg} kg</span>}
            {student.deporte && (
              <span className="badge neutral">
                {student.deporte}
                {student.posicion ? ` · ${student.posicion}` : ""}
              </span>
            )}
          </div>
        )}

        <ErrorBanner message={error} />
        <SuccessBanner show={saved} message="Cambios guardados." />

        <div className="card card-pad" style={{ marginBottom: 20, fontSize: 13 }}>
          <div style={{ color: "var(--text-dim)", marginBottom: 6 }}>Último check-in</div>
          {ultimoCheckin ? (
            <div>
              Energía {ultimoCheckin.energia} · Dolor {ultimoCheckin.dolor} · Sueño {ultimoCheckin.sueno}
              <span style={{ color: "var(--text-faint)" }}> — {new Date(ultimoCheckin.fecha).toLocaleDateString("es-AR", { timeZone: TIMEZONE })}</span>
            </div>
          ) : (
            <div style={{ color: "var(--text-faint)" }}>Todavía no hizo ningún check-in.</div>
          )}
        </div>

        {pesosPorEjercicio.size > 0 && (
          <div className="card card-pad" style={{ marginBottom: 20, fontSize: 13 }}>
            <div style={{ color: "var(--text-dim)", marginBottom: 10 }}>Cargas registradas</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Array.from(pesosPorEjercicio.entries()).map(([exId, { nombre, entradas }]) => (
                <div key={exId}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{nombre}</div>
                  <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
                    {[...entradas]
                      .reverse()
                      .map((e) => `${e.peso}kg`)
                      .join(" → ")}
                    <span style={{ marginLeft: 6 }}>
                      (última: {new Date(entradas[0].fecha).toLocaleDateString("es-AR", { timeZone: TIMEZONE })})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <div style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 10 }}>
            Rutina
            {currentProgram && (
              <span style={{ color: "var(--text-faint)" }}>
                {" "}
                — actualmente en <strong style={{ color: "var(--text)" }}>{currentProgram.nombre}</strong>, semana{" "}
                {student.semana_actual}
                {isPersonalRoutine
                  ? " · rutina personal"
                  : sharedFromOwner
                    ? ` · rutina compartida con ${sharedFromOwner}`
                    : " · programa general"}
              </span>
            )}
          </div>

          {currentProgram && companions.length > 0 && (
            <div className="banner" style={{ fontSize: 12.5, marginBottom: 12, color: "var(--text-dim)" }}>
              <Icon name="users" size={13} /> También usa esta rutina: <strong style={{ color: "var(--text)" }}>{companions.map((c) => c.nombre).join(", ")}</strong>.
              Lo que cambies se actualiza para todos.
            </div>
          )}

          {currentProgram && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <Link href={`/programas/${currentProgram.id}`} className="btn primary">
                <Icon name="edit" size={14} />
                Editar rutina
              </Link>
              {isPersonalRoutine && (
                <form action={saveProgramAsTemplate.bind(null, id, currentProgram.id)}>
                  <SubmitButton className="btn">
                    <Icon name="book" size={14} />
                    Guardar como plantilla en mi biblioteca
                  </SubmitButton>
                </form>
              )}
            </div>
          )}

          {currentProgram ? (
            // Antes esto sólo se ofrecía cuando el alumno todavía no tenía
            // ninguna rutina asignada — para asignarle un programa ya hecho
            // (de cero, de la biblioteca, o uno general) a alguien que ya
            // venía con una rutina había que primero desasignarlo a mano.
            // Ahora queda siempre disponible acá abajo, colapsado para no
            // ensuciar el caso común (alumno que ya tiene su rutina andando),
            // y con confirmación porque reemplaza lo que ya tenía.
            <details>
              <summary style={{ cursor: "pointer", fontSize: 12.5, color: "var(--text-faint)" }}>
                Cambiar por otra rutina
              </summary>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                <p style={{ color: "var(--text-faint)", fontSize: 11.5, margin: 0 }}>
                  No borra la rutina actual, sólo deja de estar asignada a {student.nombre}.
                </p>

                {shareForm}

                <form
                  action={createPersonalProgram.bind(null, id)}
                  style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
                >
                  <input name="nombre" placeholder={`Rutina de ${student.nombre}`} style={{ flex: 1, minWidth: 180 }} />
                  <ConfirmSubmitButton
                    className="btn"
                    confirmMessage={`¿Armar una rutina nueva desde cero para ${student.nombre}? Reemplaza la que tiene ahora.`}
                  >
                    <Icon name="plus" size={14} />
                    Armar desde cero
                  </ConfirmSubmitButton>
                </form>

                {generalPrograms.length > 0 && (
                  <form
                    action={importProgramAsPersonal.bind(null, id)}
                    style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
                  >
                    <select name="source_program_id" defaultValue="" style={{ flex: 1, minWidth: 180 }}>
                      <option value="" disabled>
                        Importar de mi biblioteca…
                      </option>
                      {generalPrograms.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                    <ConfirmSubmitButton
                      className="btn"
                      confirmMessage={`¿Reemplazar la rutina de ${student.nombre} por el programa que elegiste de tu biblioteca?`}
                    >
                      <Icon name="copy" size={14} />
                      Importar
                    </ConfirmSubmitButton>
                  </form>
                )}

                <details>
                  <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--text-faint)" }}>
                    Asignar un programa general (equipo/grupo)
                  </summary>
                  <form
                    action={assignProgram.bind(null, id)}
                    style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginTop: 10 }}
                  >
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <span className="field-label">Programa</span>
                      <select name="programa_id" defaultValue="">
                        <option value="">Sin programa</option>
                        {generalPrograms.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ width: 100 }}>
                      <span className="field-label">Semana</span>
                      <input type="number" name="semana_actual" min={1} defaultValue={student.semana_actual ?? 1} />
                    </div>
                    <ConfirmSubmitButton className="btn" confirmMessage={`¿Cambiar la rutina de ${student.nombre}?`}>
                      Guardar
                    </ConfirmSubmitButton>
                  </form>
                </details>
              </div>
            </details>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {shareForm}

              <form
                action={createPersonalProgram.bind(null, id)}
                style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
              >
                <input name="nombre" placeholder={`Rutina de ${student.nombre}`} style={{ flex: 1, minWidth: 180 }} />
                <SubmitButton className="btn primary">
                  <Icon name="plus" size={14} />
                  Armar desde cero
                </SubmitButton>
              </form>

              {generalPrograms.length > 0 && (
                <form
                  action={importProgramAsPersonal.bind(null, id)}
                  style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
                >
                  <select name="source_program_id" defaultValue="" style={{ flex: 1, minWidth: 180 }}>
                    <option value="" disabled>
                      Importar de mi biblioteca…
                    </option>
                    {generalPrograms.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                  <SubmitButton className="btn">
                    <Icon name="copy" size={14} />
                    Importar
                  </SubmitButton>
                </form>
              )}

              {generalPrograms.length === 0 && (
                <p style={{ color: "var(--text-faint)", fontSize: 12, margin: 0 }}>
                  Todavía no tenés programas en tu biblioteca para importar — armá esta rutina desde cero.
                </p>
              )}

              <details>
                <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--text-faint)" }}>
                  Asignar un programa general (equipo/grupo)
                </summary>
                <form
                  action={assignProgram.bind(null, id)}
                  style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginTop: 10 }}
                >
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <span className="field-label">Programa</span>
                    <select name="programa_id" defaultValue="">
                      <option value="">Sin programa</option>
                      {generalPrograms.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ width: 100 }}>
                    <span className="field-label">Semana</span>
                    <input type="number" name="semana_actual" min={1} defaultValue={student.semana_actual ?? 1} />
                  </div>
                  <SubmitButton className="btn">Guardar</SubmitButton>
                </form>
              </details>
            </div>
          )}
        </div>

        <form action={updateWithId}>
          <TextField label="Nombre" name="nombre" defaultValue={student.nombre} required />
          <TextField label="Email" name="email" defaultValue={student.email} />
          <TextField label="Objetivo" name="objetivo" defaultValue={student.objetivo} />
          <SelectField label="Estado" name="estado" defaultValue={student.estado} options={["Activo", "Inactivo"]} />

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <TextField label="Edad" name="edad" type="number" defaultValue={student.edad?.toString()} placeholder="Ej: 24" />
            </div>
            <div style={{ flex: 1 }}>
              <TextField
                label="Altura (cm)"
                name="altura_cm"
                type="number"
                defaultValue={student.altura_cm?.toString()}
                placeholder="Ej: 178"
              />
            </div>
            <div style={{ flex: 1 }}>
              <TextField
                label="Peso (kg)"
                name="peso_kg"
                type="number"
                step="0.1"
                defaultValue={student.peso_kg?.toString()}
                placeholder="Ej: 75"
              />
            </div>
          </div>

          <AthleteFields deporte={student.deporte} posicion={student.posicion} />

          <TextAreaField label="Notas" name="notas" defaultValue={student.notas} />

          <SubmitButton className="btn primary" style={{ marginTop: 6, width: "100%", padding: "11px 0" }}>
            Guardar cambios
          </SubmitButton>
        </form>

        <form action={deleteWithId} style={{ marginTop: 28 }}>
          <ConfirmSubmitButton
            confirmMessage={`¿Eliminar a ${student.nombre}? Esta acción no se puede deshacer.`}
            className="btn danger"
          >
            Eliminar alumno
          </ConfirmSubmitButton>
        </form>
      </div>
    </CoachShell>
  );
}
