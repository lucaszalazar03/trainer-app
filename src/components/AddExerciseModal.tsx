"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { Icon } from "./Icon";

type ExerciseOption = { id: string; nombre: string; grupo: string | null; equipamiento: string | null };
type AddResult = { ok: boolean; error?: string } | void;

// Si Supabase se traba (pasó de verdad: ver ExerciseRowEditor), no tiene
// sentido esperar para siempre — a los 12s se da por perdido y muestra
// error en vez de dejar "Agregando…" colgado sin ninguna salida.
const ADD_TIMEOUT_MS = 12000;

/**
 * Antes "Agregar ejercicio" te sacaba de la sesión (o de la plantilla) a
 * otra página entera — con su propio CoachShell, su propia consulta a la
 * biblioteca, etc. — y después te devolvía con otra navegación completa:
 * dos viajes de página por cada ejercicio agregado. Armando una sesión con
 * varios ejercicios, eso es lo que se sentía como que la app se trababa.
 *
 * Este modal abre en el momento (sin navegar a ningún lado), busca en la
 * biblioteca que ya se trajo del servidor una sola vez al cargar la
 * página (búsqueda instantánea, sin red de por medio) y agrega llamando a
 * lo que le pase el que lo usa — así sirve tanto para el editor de
 * sesiones como para el de plantillas, cada uno con sus propias acciones
 * de servidor.
 *
 * Tildar varios y agregarlos juntos: antes cada fila agregaba apenas se
 * la tocaba, una por una — para un bloque de 5 ejercicios eran 5 idas y
 * vueltas al servidor (el modal se quedaba abierto, pero cada click
 * disparaba su propio guardado). Ahora tocar una fila sólo la tilda; el
 * agregado real pasa una sola vez, al apretar "Agregar" con todo lo
 * tildado, en una sola llamada al servidor (onAddMany).
 */
export function AddExerciseModal({
  triggerLabel,
  exercises,
  onAddMany,
  onCreate,
}: {
  triggerLabel: string;
  exercises: ExerciseOption[];
  onAddMany: (exerciseIds: string[]) => AddResult | Promise<AddResult>;
  onCreate: (nombre: string) => AddResult | Promise<AddResult>;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addError, setAddError] = useState(false);
  const [createError, setCreateError] = useState(false);
  // Cada intento tiene su número — si el que se dio por perdido por
  // timeout llega tarde después de que ya arrancó un reintento, se
  // ignora en vez de pisar el estado del intento actual.
  const attemptRef = useRef(0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return exercises;
    return exercises.filter(
      (ex) =>
        ex.nombre.toLowerCase().includes(needle) ||
        (ex.grupo?.toLowerCase().includes(needle) ?? false) ||
        (ex.equipamiento?.toLowerCase().includes(needle) ?? false)
    );
  }, [q, exercises]);

  const exactMatch = exercises.some((ex) => ex.nombre.trim().toLowerCase() === q.trim().toLowerCase());

  function close() {
    setOpen(false);
    setQ("");
    setSelected(new Set());
    setAddError(false);
    setCreateError(false);
  }

  function withTimeout(p: Promise<AddResult>) {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("timeout")), ADD_TIMEOUT_MS);
    });
    return Promise.race([p, timeout]);
  }

  function toggle(exerciseId: string) {
    setAddError(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseId)) next.delete(exerciseId);
      else next.add(exerciseId);
      return next;
    });
  }

  function handleAddSelected() {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    setAddError(false);
    const myAttempt = ++attemptRef.current;
    startTransition(() => {
      withTimeout(Promise.resolve(onAddMany(ids)))
        .then((result) => {
          if (attemptRef.current !== myAttempt) return;
          if (result && result.ok === false) {
            setAddError(true);
            return;
          }
          // Se agregaron todos — cerramos el modal, no hace falta seguir
          // mirando la lista tildada.
          close();
        })
        .catch(() => {
          if (attemptRef.current !== myAttempt) return;
          setAddError(true);
        });
    });
  }

  function handleCreate() {
    const nombre = q.trim();
    if (!nombre) return;
    setCreateError(false);
    const myAttempt = ++attemptRef.current;
    startTransition(() => {
      withTimeout(Promise.resolve(onCreate(nombre)))
        .then((result) => {
          if (attemptRef.current !== myAttempt) return;
          if (result && result.ok === false) {
            setCreateError(true);
            return;
          }
          setQ("");
        })
        .catch(() => {
          if (attemptRef.current !== myAttempt) return;
          setCreateError(true);
        });
    });
  }

  return (
    <>
      <button type="button" className="link-btn" onClick={() => setOpen(true)}>
        <Icon name="plus" size={13} />
        {triggerLabel}
      </button>

      {open && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Agregar ejercicio</h3>
              <button type="button" className="btn ghost icon sm" onClick={close} aria-label="Cerrar">
                <Icon name="x" size={16} />
              </button>
            </div>

            <div className="search-wrap" style={{ marginBottom: 10 }}>
              <Icon name="search" size={15} />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar en tu biblioteca…"
              />
            </div>

            <div className="modal-list">
              {filtered.length === 0 ? (
                <div className="empty" style={{ border: "none", textAlign: "left", padding: "8px 2px" }}>
                  Sin resultados para esa búsqueda.
                </div>
              ) : (
                filtered.map((ex) => {
                  const isChecked = selected.has(ex.id);
                  return (
                    <button
                      key={ex.id}
                      type="button"
                      className={`modal-ex-row ${isChecked ? "checked" : ""}`}
                      disabled={isPending}
                      onClick={() => toggle(ex.id)}
                    >
                      <span className={`modal-ex-check ${isChecked ? "on" : ""}`}>
                        {isChecked && <Icon name="check" size={12} />}
                      </span>
                      <span style={{ minWidth: 0 }}>
                        <span className="nm">{ex.nombre}</span>
                        {(ex.grupo || ex.equipamiento) && (
                          <span className="sub">{[ex.grupo, ex.equipamiento].filter(Boolean).join(" · ")}</span>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {q.trim() && !exactMatch && (
              <div className="modal-create">
                <span>
                  {createError ? (
                    <span style={{ color: "var(--danger)" }}>No se pudo crear — probá de nuevo.</span>
                  ) : (
                    <>
                      ¿No está? Creá <strong>“{q.trim()}”</strong> y agregalo directo.
                    </>
                  )}
                </span>
                <button type="button" className="btn sm" onClick={handleCreate} disabled={isPending}>
                  {createError ? "Reintentar" : "Crear y agregar"}
                </button>
              </div>
            )}

            {/* Tildás varios y los agregás todos juntos con un solo click acá
                abajo, en vez de que cada fila dispare su propio guardado. */}
            <div className="modal-add-bar">
              {addError && (
                <span style={{ color: "var(--danger)", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                  <Icon name="alert" size={13} />
                  No se pudo agregar — probá de nuevo.
                </span>
              )}
              <button
                type="button"
                className="btn primary sm"
                style={{ marginLeft: "auto" }}
                disabled={selected.size === 0 || isPending}
                onClick={handleAddSelected}
              >
                {isPending
                  ? "Agregando…"
                  : selected.size === 0
                    ? "Agregar"
                    : `Agregar (${selected.size})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
