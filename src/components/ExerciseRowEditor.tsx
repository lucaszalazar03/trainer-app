"use client";

import { useRef, useState, useTransition } from "react";
import { Icon } from "./Icon";
import { ExerciseVideo } from "./ExerciseVideo";
import { SubmitButton } from "./SubmitButton";

type SaveResult = { ok: boolean; error?: string } | void;

// Si Supabase se queda pinchado (pasó de verdad: la base canceló la
// consulta por "statement timeout" y ni siquiera eso volvía a tiempo acá),
// no tiene sentido esperar para siempre — a los 12s se da por perdido y
// muestra error, en vez de dejar "Guardando…" colgado sin ninguna salida.
const SAVE_TIMEOUT_MS = 12000;

/**
 * Fila de ejercicio (dentro de un bloque o de la entrada en calor) con
 * series/reps que se guardan solas al salir del campo — sin un botón
 * "Guardar" aparte que sea fácil de pasar por alto. Antes cada fila tenía
 * su propio formulario con su propio submit, separado del botón grande de
 * "Guardar sesión" de más abajo (que en realidad sólo guarda nombre/día/
 * objetivo) — eso hacía que los cambios de series/reps se perdieran si el
 * coach dejaba de tocar el botón chico pensando que el de abajo alcanzaba.
 *
 * Antes, si el guardado fallaba o tardaba de más, esto se quedaba en
 * "Guardando…" para siempre — sin error, sin forma de reintentar. Ahora
 * cualquier falla (de red, de la base, o simplemente que tarde más de
 * SAVE_TIMEOUT_MS) se muestra como error con un botón para reintentar.
 */
export function ExerciseRowEditor({
  nombre,
  videoUrl,
  series,
  reps,
  onUpdate,
  onDelete,
  dragHandle,
  rootRef,
  rootStyle,
}: {
  nombre: string;
  videoUrl?: string | null;
  series: number | null;
  reps: string | null;
  onUpdate: (formData: FormData) => SaveResult | Promise<SaveResult>;
  onDelete: () => void | Promise<void>;
  // Opcionales: sin esto la fila se ve y se comporta igual que antes (por
  // ej. si algún día se usa esta misma fila en una lista que no reordena).
  // Cuando vienen, los pone <ExerciseList> — ella es la que sabe de dnd-kit,
  // esta fila sólo le hace lugar al handle y aplica el ref/style que el
  // drag necesita en la raíz de la fila (no puede ir en un wrapper aparte
  // sin romper el CSS de ".block", que espera que ".ex-row" sea hijo
  // directo — ver comentario en ExerciseList).
  dragHandle?: React.ReactNode;
  rootRef?: (node: HTMLElement | null) => void;
  rootStyle?: React.CSSProperties;
}) {
  const [seriesVal, setSeriesVal] = useState(series != null ? String(series) : "");
  const [repsVal, setRepsVal] = useState(reps ?? "");
  const [isPending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef({ series: seriesVal, reps: repsVal });
  // Cada intento de guardado tiene su propio número — si llega tarde una
  // respuesta de un intento viejo (por ej. el que se dio por perdido por
  // timeout) después de que ya arrancó uno nuevo, la ignoramos en vez de
  // pisar el estado del intento actual.
  const attemptRef = useRef(0);

  function attempt(seriesToSave: string, repsToSave: string) {
    lastSaved.current = { series: seriesToSave, reps: repsToSave };
    const myAttempt = ++attemptRef.current;
    setSaveError(false);

    const fd = new FormData();
    fd.set("series", seriesToSave);
    fd.set("reps", repsToSave);

    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("timeout")), SAVE_TIMEOUT_MS);
    });

    startTransition(() => {
      Promise.race([Promise.resolve(onUpdate(fd)), timeout])
        .then((result) => {
          if (attemptRef.current !== myAttempt) return; // ya hay un intento más nuevo en curso
          if (result && result.ok === false) {
            setSaveError(true);
            return;
          }
          setJustSaved(true);
          if (savedTimer.current) clearTimeout(savedTimer.current);
          savedTimer.current = setTimeout(() => setJustSaved(false), 1500);
        })
        .catch(() => {
          if (attemptRef.current !== myAttempt) return;
          setSaveError(true);
        });
    });
  }

  function save() {
    if (seriesVal === lastSaved.current.series && repsVal === lastSaved.current.reps) return;
    attempt(seriesVal, repsVal);
  }

  function retry() {
    attempt(seriesVal, repsVal);
  }

  return (
    <div className="ex-row" ref={rootRef} style={rootStyle}>
      {dragHandle}
      <span className="ex-name">{nombre}</span>
      {videoUrl !== undefined && <ExerciseVideo url={videoUrl} compact />}
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <input
          value={seriesVal}
          onChange={(e) => setSeriesVal(e.target.value)}
          onBlur={save}
          style={{ width: 36, padding: "6px 6px", fontSize: 12.5, textAlign: "center" }}
        />
        <span style={{ color: "var(--text-faint)", fontSize: 12 }}>x</span>
        <input
          value={repsVal}
          onChange={(e) => setRepsVal(e.target.value)}
          onBlur={save}
          placeholder="10-8-8-6"
          title="Reps por serie. Si varían, separalas con guiones: 10-8-8-6"
          style={{ width: 74, padding: "6px 6px", fontSize: 12.5, textAlign: "center" }}
        />
        {saveError ? (
          <button
            type="button"
            onClick={retry}
            className="link-btn"
            style={{ fontSize: 11, color: "var(--danger)", display: "inline-flex", alignItems: "center", gap: 3 }}
          >
            <Icon name="alert" size={11} />
            Error — reintentar
          </button>
        ) : (
          <span
            style={{
              fontSize: 11,
              color: isPending ? "var(--text-faint)" : "var(--accent)",
              minWidth: 62,
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            {isPending ? "Guardando…" : justSaved ? (
              <>
                <Icon name="check" size={11} />
                Guardado
              </>
            ) : (
              ""
            )}
          </span>
        )}
      </div>
      <form action={onDelete}>
        <SubmitButton className="btn sm ghost" style={{ color: "var(--danger)" }}>
          Quitar
        </SubmitButton>
      </form>
    </div>
  );
}
