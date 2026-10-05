"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { Icon } from "./Icon";
import { deleteExerciseInline } from "@/app/biblioteca/actions";

export type LibraryExercise = {
  id: string;
  nombre: string;
  grupo: string | null;
  equipamiento: string | null;
  categoria_id: string | null;
  video_url: string | null;
  usos: number;
};

/**
 * Lista de ejercicios de la Biblioteca.
 *
 * Antes cada búsqueda o cambio de categoría recargaba la página entera en el
 * servidor (5 consultas a la API REST de Supabase, en dos tandas) y cada
 * borrado esperaba 4 pasos en fila + otra recarga completa. Ahora:
 *  - la lista completa llega UNA vez y se filtra acá, mientras escribís
 *    (useDeferredValue mantiene el tipeo fluido aunque la lista crezca);
 *  - borrar saca la fila al instante (optimista) y, si el servidor falla,
 *    la vuelve a mostrar con el error.
 * La URL se mantiene sincronizada (?q=&categoria=) sin pedirle nada al
 * servidor, para que Anterior/Siguiente del detalle sigan respetando el filtro.
 */
export function ExerciseLibrary({
  exercises,
  categories,
  initialQ,
  initialCategoria,
  onDeleteCategory,
  categoryForm,
}: {
  exercises: LibraryExercise[];
  categories: { id: string; nombre: string }[];
  initialQ: string;
  initialCategoria: string;
  onDeleteCategory: (id: string) => void | Promise<void>;
  categoryForm: React.ReactNode;
}) {
  const [q, setQ] = useState(initialQ);
  const [categoria, setCategoria] = useState(initialCategoria);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const deferredQ = useDeferredValue(q);

  const categoryNames = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.nombre])), [categories]);

  const visible = useMemo(() => {
    const needle = deferredQ.trim().toLowerCase();
    return exercises.filter(
      (ex) =>
        !removed.has(ex.id) &&
        (!categoria || ex.categoria_id === categoria) &&
        (!needle ||
          ex.nombre.toLowerCase().includes(needle) ||
          (ex.grupo?.toLowerCase().includes(needle) ?? false) ||
          (ex.equipamiento?.toLowerCase().includes(needle) ?? false))
    );
  }, [exercises, removed, categoria, deferredQ]);

  function syncUrl(nextQ: string, nextCategoria: string) {
    const params = new URLSearchParams();
    params.set("tab", "ejercicios");
    if (nextCategoria) params.set("categoria", nextCategoria);
    if (nextQ.trim()) params.set("q", nextQ.trim());
    try {
      window.history.replaceState(null, "", `/biblioteca?${params.toString()}`);
    } catch {
      // no crítico
    }
  }

  const detailParams = new URLSearchParams();
  if (categoria) detailParams.set("categoria", categoria);
  if (q.trim()) detailParams.set("q", q.trim());
  const detailQs = detailParams.toString();

  function handleDelete(ex: LibraryExercise) {
    const msg =
      ex.usos > 0
        ? `"${ex.nombre}" ya está cargado en ${ex.usos} lugar${ex.usos === 1 ? "" : "es"} (sesiones, entradas en calor o plantillas). Si lo eliminás de la biblioteca, también se va a quitar de ahí. ¿Eliminar igual?`
        : `¿Eliminar "${ex.nombre}" de la biblioteca?`;
    if (!confirm(msg)) return;

    setError(null);
    setRemoved((prev) => new Set(prev).add(ex.id));
    startTransition(async () => {
      let result: { ok: boolean; error?: string };
      try {
        result = await deleteExerciseInline(ex.id);
      } catch {
        result = { ok: false, error: "No se pudo conectar con el servidor." };
      }
      if (!result.ok) {
        setRemoved((prev) => {
          const next = new Set(prev);
          next.delete(ex.id);
          return next;
        });
        setError(`No se pudo eliminar "${ex.nombre}": ${result.error ?? "error desconocido"}`);
      }
    });
  }

  return (
    <>
      {error && <div className="banner danger">{error}</div>}

      <div className="search-wrap" style={{ marginBottom: 12, maxWidth: 340 }}>
        <Icon name="search" size={15} />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            syncUrl(e.target.value, categoria);
          }}
          placeholder="Buscar ejercicio…"
        />
      </div>

      <div className="chip-row">
        <button
          type="button"
          className={`chip ${!categoria ? "active" : ""}`}
          onClick={() => {
            setCategoria("");
            syncUrl(q, "");
          }}
        >
          Todas
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`chip ${categoria === c.id ? "active" : ""}`}
            onClick={() => {
              setCategoria(c.id);
              syncUrl(q, c.id);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              if (confirm(`¿Eliminar la categoría "${c.nombre}"? Los ejercicios que la usan quedan sin categoría.`)) {
                onDeleteCategory(c.id);
              }
            }}
          >
            {c.nombre}
          </button>
        ))}
        {categoryForm}
      </div>
      <div className="chip-hint">Clic derecho sobre una categoría para eliminarla.</div>

      {visible.length === 0 ? (
        <div className="empty">
          {q.trim() || categoria
            ? "Ningún ejercicio coincide con ese filtro."
            : "Todavía no tenés ejercicios cargados. Empezá agregando el primero."}
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 640 }}>
          {visible.map((ex) => (
            <div key={ex.id} className="ex-lib-row">
              {ex.video_url ? (
                <a href={ex.video_url} target="_blank" rel="noopener noreferrer" className="ex-lib-thumb" title="Ver video demostrativo">
                  <span className="play-tri" />
                </a>
              ) : (
                <div className="ex-lib-thumb" style={{ opacity: 0.5 }} title="Sin video cargado">
                  <span className="play-tri" />
                </div>
              )}
              <div className="ex-lib-info">
                <div className="ex-lib-name">{ex.nombre}</div>
                <div className="ex-lib-sub">
                  {[ex.categoria_id && categoryNames[ex.categoria_id], ex.grupo].filter(Boolean).join(" · ") || "Sin detalles"}
                  {" · "}
                  {ex.video_url ? "con video" : "sin video"}
                </div>
              </div>
              <div className="ex-lib-actions">
                <Link href={`/biblioteca/${ex.id}${detailQs ? `?${detailQs}` : ""}`} className="btn sm icon ghost" title="Editar">
                  <Icon name="edit" size={13} />
                </Link>
                <button type="button" className="btn sm icon ghost" title="Eliminar" onClick={() => handleDelete(ex)}>
                  <Icon name="trash" size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
