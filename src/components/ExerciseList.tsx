"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Icon } from "./Icon";
import { ExerciseRowEditor } from "./ExerciseRowEditor";

type SaveResult = { ok: boolean; error?: string } | void;

export type ExerciseListItem = {
  id: string;
  nombre: string;
  videoUrl?: string | null;
  series: number | null;
  reps: string | null;
  onUpdate: (formData: FormData) => SaveResult | Promise<SaveResult>;
  onDelete: () => void | Promise<void>;
};

/**
 * Lista de ejercicios (de un bloque, o de la entrada en calor) que se
 * reordena arrastrando — reemplaza a las flechitas ↑/↓ que había antes
 * (no andaban bien y, aunque hubiesen andado, arrastrar es más natural acá).
 *
 * Por qué esto vive en un componente de cliente aparte en vez de adentro de
 * ExerciseRowEditor directamente: dnd-kit necesita un solo DndContext que
 * envuelva TODA la lista (para saber sobre qué fila se soltó el drag), no
 * uno por fila — así que alguien tiene que ser el dueño de esa lista, y de
 * paso mantener el orden en pantalla mientras se arrastra (antes de que la
 * respuesta del server vuelva).
 *
 * ExerciseRowEditor sigue siendo la fila en sí (nombre, series/reps con
 * autoguardado, borrar) — acá sólo se le agrega el handle de arrastre y el
 * ref/style que dnd-kit necesita en la raíz de la fila. Tiene que ir en la
 * raíz (".ex-row") y no en un wrapper por fuera porque el CSS de ".block"
 * asume que ".ex-row" es hijo directo (el borde entre filas sale de
 * ".ex-row:first-of-type" + el orden de los hermanos).
 */
export function ExerciseList({
  items,
  onReorder,
}: {
  items: ExerciseListItem[];
  onReorder: (orderedIds: string[]) => void | Promise<void>;
}) {
  const [ordered, setOrdered] = useState(items);
  const [, startTransition] = useTransition();

  // El server es la verdad: cuando esta pantalla vuelve a renderizar (por
  // ej. después de agregar o borrar un ejercicio, o de que termine de
  // confirmarse un reorden), sincronizamos con lo que vino de ahí. No pasa
  // en medio de un drag porque durante el drag no hay ningún re-render del
  // server en curso todavía.
  //
  // Esto se resuelve ajustando el estado durante el render (patrón que
  // recomienda React para "derivar estado de props") en vez de con un
  // useEffect: `items` es un array nuevo en cada render del padre (sale de
  // un .map()), así que comparamos por una firma de contenido (los ids en
  // orden) en vez de por identidad de referencia — si no, "cambiaría" en
  // cada render y nunca se estabilizaría.
  const itemsSignature = items.map((it) => it.id).join("|");
  const [orderedSignature, setOrderedSignature] = useState(itemsSignature);
  if (itemsSignature !== orderedSignature) {
    setOrderedSignature(itemsSignature);
    setOrdered(items);
  }

  const sensors = useSensors(
    // distance:5 para que un click normal (por ej. en el input de reps) no
    // dispare por error el inicio de un drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ordered.findIndex((it) => it.id === active.id);
    const newIndex = ordered.findIndex((it) => it.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(ordered, oldIndex, newIndex);
    setOrdered(next); // optimista: se ve reordenado ya mismo, sin esperar al server
    startTransition(() => {
      onReorder(next.map((it) => it.id));
    });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ordered.map((it) => it.id)} strategy={verticalListSortingStrategy}>
        {ordered.map((it) => (
          <SortableExerciseRow key={it.id} item={it} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableExerciseRow({ item }: { item: ExerciseListItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: "relative",
    zIndex: isDragging ? 1 : undefined,
    opacity: isDragging ? 0.6 : 1,
    background: isDragging ? "var(--surface-2)" : undefined,
  };

  return (
    <ExerciseRowEditor
      nombre={item.nombre}
      videoUrl={item.videoUrl}
      series={item.series}
      reps={item.reps}
      onUpdate={item.onUpdate}
      onDelete={item.onDelete}
      rootRef={setNodeRef}
      rootStyle={style}
      dragHandle={
        <button
          type="button"
          className="ex-drag-handle"
          {...attributes}
          {...listeners}
          title="Arrastrar para reordenar"
          aria-label="Arrastrar para reordenar"
        >
          <Icon name="grip" size={14} />
        </button>
      }
    />
  );
}
