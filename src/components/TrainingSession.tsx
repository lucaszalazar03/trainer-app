"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { SubmitButton } from "./SubmitButton";
import { toVideoEmbed } from "@/lib/video";

type ExerciseRow = {
  id: string;
  exerciseId: string;
  nombre: string;
  videoUrl?: string | null;
  series: number | null;
  reps: string | null;
  pesoUltimo?: number | null;
};
type BlockData = { id: string; nombre: string; color: string | null; descripcion?: string | null; ejercicios: ExerciseRow[] };

// Id sintético para tratar la entrada en calor como un bloque más (mismo
// toggle "Marcar completo", mismo agrupado al cerrarse) — nunca choca con
// un id real de bloque porque esos son uuids.
const WARMUP_ID = "__warmup__";

type Item = {
  id: string;
  nombre: string;
  ejercicios: ExerciseRow[];
  isWarmup: boolean;
  index?: number; // posición entre los bloques reales (la entrada en calor no cuenta)
  color?: string | null;
  descripcion?: string | null;
};

// Botón redondo "ver video". Si es un link que no sabemos embeber (Drive,
// Instagram, etc.) lo abre directo en pestaña nueva; si es YouTube/Vimeo/
// un archivo, despliega el reproductor debajo de la fila.
//
// IMPORTANTE: este componente (y VideoFrame y ExerciseList, más abajo)
// están declarados FUERA de TrainingSession a propósito. Definir un
// componente adentro del cuerpo de otro hace que React vea una función
// distinta en cada render — y al cambiar de "tipo" desmonta y vuelve a
// montar todo ese subárbol del DOM en cada render. Eso era invisible en
// botones, pero en el input de peso significaba perder el foco (y por lo
// tanto el teclado del celular) cada vez que el alumno tipeaba un dígito,
// porque cada tecla dispara un setPesos → re-render → ExerciseList "nuevo"
// → el <input> viejo se destruye y se crea uno nuevo sin foco.
function VideoButton({ id, url, setOpenVideo }: { id: string; url?: string | null; setOpenVideo: (v: string | ((prev: string | null) => string | null) | null) => void }) {
  if (!url) return null;
  const embed = toVideoEmbed(url);

  if (embed.kind === "link") {
    return (
      <a href={embed.src} target="_blank" rel="noopener noreferrer" className="video-btn" title="Ver video">
        <Icon name="play" size={13} />
      </a>
    );
  }

  return (
    <button
      type="button"
      className="video-btn"
      title="Ver video"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOpenVideo((prev) => (prev === id ? null : id));
      }}
    >
      <Icon name="play" size={13} />
    </button>
  );
}

function VideoFrame({ id, url, openVideo }: { id: string; url?: string | null; openVideo: string | null }) {
  if (!url || openVideo !== id) return null;
  const embed = toVideoEmbed(url);
  if (embed.kind === "link") return null;
  return (
    <div className="ex-video-frame" style={{ margin: "0 14px 10px" }}>
      {embed.kind === "iframe" ? (
        <iframe src={embed.src} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen loading="lazy" />
      ) : (
        <video src={embed.src} controls />
      )}
    </div>
  );
}

function ExerciseList({
  ejercicios,
  pesos,
  setPesos,
  openVideo,
  setOpenVideo,
}: {
  ejercicios: ExerciseRow[];
  pesos: Record<string, string>;
  setPesos: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  openVideo: string | null;
  setOpenVideo: (v: string | ((prev: string | null) => string | null) | null) => void;
}) {
  return (
    <>
      {ejercicios.map((e) => (
        <div key={e.id} className="a-ex">
          <div className="a-ex-head">
            <div className="nm">
              <div className="t">{e.nombre}</div>
            </div>
            <VideoButton id={e.id} url={e.videoUrl} setOpenVideo={setOpenVideo} />
            <span className="ex-scheme">
              {e.series}x {e.reps}
            </span>
          </div>
          <VideoFrame id={e.id} url={e.videoUrl} openVideo={openVideo} />
          <div className="a-ex-peso">
            <label htmlFor={`peso-${e.id}`}>Peso</label>
            <input
              id={`peso-${e.id}`}
              type="number"
              inputMode="decimal"
              step="0.5"
              min="0"
              maxLength={3}
              value={pesos[e.id] ?? ""}
              onChange={(ev) => setPesos((prev) => ({ ...prev, [e.id]: ev.target.value }))}
            />
            <span className="kg-suffix">KG</span>
            {e.pesoUltimo != null && <span className="last">Última vez: {e.pesoUltimo}kg</span>}
          </div>
        </div>
      ))}
    </>
  );
}

export function TrainingSession({
  warmups,
  blocks,
  action,
}: {
  warmups: ExerciseRow[];
  blocks: BlockData[];
  action: (formData: FormData) => void;
}) {
  const [closedIds, setClosedIds] = useState<Set<string>>(new Set());
  // Peso (kg) que el alumno cargó para cada ejercicio, guardado por el id
  // de la fila (block_exercises/warmup_exercises), no por exerciseId — dos
  // bloques distintos pueden tener el mismo ejercicio con pesos distintos.
  // No lo prellenamos con pesoUltimo a propósito: es sólo una referencia
  // visible al lado del campo, así el alumno siempre carga a mano lo que
  // usó HOY en vez de reenviar sin querer el número de la vez pasada.
  const [pesos, setPesos] = useState<Record<string, string>>({});
  // Un bloque (o la entrada en calor) marcado como completo se cierra solo
  // y se agrupa arriba, como en la app de referencia — esto guarda cuáles
  // de esos cerrados el alumno volvió a abrir a mano para repasar los
  // ejercicios sin desmarcarlo como hecho.
  const [expandedDone, setExpandedDone] = useState<Set<string>>(new Set());
  const [openVideo, setOpenVideo] = useState<string | null>(null);

  const toggleClosed = (id: string) =>
    setClosedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        setExpandedDone((prevExp) => {
          const nextExp = new Set(prevExp);
          nextExp.delete(id);
          return nextExp;
        });
      }
      return next;
    });

  const toggleExpandDone = (id: string) =>
    setExpandedDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // La entrada en calor entra en la misma lista que los bloques reales —
  // mismo comportamiento de "Marcar completo" y mismo agrupado al
  // cerrarse — pero no suma a la numeración de bloques (1, 2, 3...) y
  // lleva su propio color/ícono (llama) para que se note que no es un
  // bloque de la rutina.
  const items: Item[] = [
    ...(warmups.length > 0 ? [{ id: WARMUP_ID, nombre: "Entrada en calor", ejercicios: warmups, isWarmup: true }] : []),
    ...blocks.map((b, i) => ({ id: b.id, nombre: b.nombre, ejercicios: b.ejercicios, isWarmup: false, index: i + 1, color: b.color, descripcion: b.descripcion })),
  ];

  const doneBlocksJson = JSON.stringify({
    warmup: closedIds.has(WARMUP_ID),
    blocks: blocks.filter((b) => closedIds.has(b.id)).map((b) => b.id),
  });

  // Junta el peso cargado en cada fila con el exerciseId real (que es lo
  // que logTraining necesita para guardar en exercise_logs) — sólo los que
  // el alumno realmente completó, ignorando vacíos y valores inválidos.
  const allEjercicios = items.flatMap((it) => it.ejercicios);
  const pesosJson = JSON.stringify(
    allEjercicios
      .map((e) => ({ exerciseId: e.exerciseId, peso: Number(pesos[e.id]) }))
      .filter((p) => p.exerciseId && Number.isFinite(p.peso) && p.peso > 0)
  );

  const totalBlocks = blocks.length;
  const doneCount = blocks.filter((b) => closedIds.has(b.id)).length;

  // Los ítems cerrados se agrupan arriba, en una fila compacta cada uno
  // (como en la app de referencia) — los que todavía están abiertos siguen
  // mostrando todos sus ejercicios más abajo.
  const closedItems = items.filter((it) => closedIds.has(it.id));
  const openItems = items.filter((it) => !closedIds.has(it.id));

  return (
    <form action={action}>
      <input type="hidden" name="done_blocks" value={doneBlocksJson} />
      <input type="hidden" name="pesos" value={pesosJson} />

      {closedItems.length > 0 && (
        <div className="a-done-group">
          {closedItems.map((it) => {
            const expanded = expandedDone.has(it.id);
            return (
              <div key={it.id} className="a-done-row-wrap">
                <div className="a-done-row">
                  <button
                    type="button"
                    className={`check-circle on a-done-check ${it.isWarmup ? "warmup" : ""}`}
                    onClick={() => toggleClosed(it.id)}
                    title="Desmarcar"
                  >
                    <Icon name="check" size={12} />
                  </button>
                  {it.isWarmup && <Icon name="flame" size={14} className="a-done-flame" />}
                  <span className="a-done-nombre">{it.nombre}</span>
                  <span className="a-done-count">{it.ejercicios.length} ej.</span>
                  <button
                    type="button"
                    className={`a-done-chevron ${expanded ? "open" : ""}`}
                    onClick={() => toggleExpandDone(it.id)}
                    title={expanded ? "Ocultar ejercicios" : "Ver ejercicios"}
                  >
                    <Icon name="chevronDown" size={16} />
                  </button>
                </div>
                {expanded && (
                  <div className="a-block-body done" style={{ paddingTop: 8 }}>
                    <ExerciseList ejercicios={it.ejercicios} pesos={pesos} setPesos={setPesos} openVideo={openVideo} setOpenVideo={setOpenVideo} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {openItems.map((it) => (
        <div key={it.id}>
          <div className="a-block-title">
            {it.isWarmup && <Icon name="flame" size={15} className="a-warmup-flame" />}
            <h3>{it.nombre}</h3>
          </div>
          {it.descripcion && <p className="a-block-desc">{it.descripcion}</p>}
          <div className="a-block-body">
            <ExerciseList ejercicios={it.ejercicios} pesos={pesos} setPesos={setPesos} openVideo={openVideo} setOpenVideo={setOpenVideo} />
            <div className="a-block-footer">
              <button type="button" onClick={() => toggleClosed(it.id)} className="block-finish-btn">
                <Icon name="check" size={13} />
                Finalizado
              </button>
            </div>
          </div>
        </div>
      ))}

      <div className="field" style={{ marginTop: 20 }}>
        <span className="field-label">¿Cómo te sentiste? (opcional)</span>
        <textarea name="comentario" placeholder="Comentario para tu coach..." rows={2} />
      </div>

      <div className="finish-bar">
        <SubmitButton className="btn primary block-w">
          <Icon name="check" size={16} />
          Terminar entrenamiento {totalBlocks > 0 ? `(${doneCount}/${totalBlocks} bloques)` : ""}
        </SubmitButton>
      </div>
    </form>
  );
}
