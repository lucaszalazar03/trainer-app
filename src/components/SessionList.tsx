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
import Link from "next/link";
import { Icon } from "./Icon";
import { SubmitButton } from "./SubmitButton";
import { ConfirmSubmitButton } from "./ConfirmSubmitButton";

export type SessionListItem = {
  id: string;
  nombre: string;
  objetivo: string | null;
  bloques: number;
  ejercicios: number;
  editHref: string;
  onDuplicate: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
};

/**
 * Lista de sesiones de una semana, reordenable arrastrando — desde que las
 * sesiones dejaron de tener un día fijo (el alumno las hace en el orden que
 * quiera), "Día 1", "Día 2", etc. pasó a ser directamente la POSICIÓN acá,
 * así que el coach necesita poder cambiar esa posición a mano.
 *
 * Mismo patrón que ExerciseList (mismo motivo: dnd-kit necesita un único
 * DndContext dueño de toda la lista, no uno por tarjeta) — ver los
 * comentarios ahí para el porqué de cada parte.
 */
export function SessionList({
  items,
  onReorder,
}: {
  items: SessionListItem[];
  onReorder: (orderedIds: string[]) => void | Promise<void>;
}) {
  const [ordered, setOrdered] = useState(items);
  const [, startTransition] = useTransition();

  const itemsSignature = items.map((it) => it.id).join("|");
  const [orderedSignature, setOrderedSignature] = useState(itemsSignature);
  if (itemsSignature !== orderedSignature) {
    setOrderedSignature(itemsSignature);
    setOrdered(items);
  }

  const sensors = useSensors(
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
    setOrdered(next);
    startTransition(() => {
      onReorder(next.map((it) => it.id));
    });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ordered.map((it) => it.id)} strategy={verticalListSortingStrategy}>
        {ordered.map((it, i) => (
          <SortableSessionCard key={it.id} item={it} numero={i + 1} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableSessionCard({ item, numero }: { item: SessionListItem; numero: number }) {
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
    <div className="session-card" ref={setNodeRef} style={style}>
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
      <div className="session-day">Día {numero}</div>
      <div className="session-info">
        <div className="name">{item.nombre}</div>
        <div className="meta">
          {item.objetivo || "Sin objetivo"} · {item.bloques} bloques · {item.ejercicios} ejercicios
        </div>
      </div>
      <form action={item.onDuplicate}>
        <SubmitButton title="Duplicar" className="btn sm">
          <Icon name="copy" size={13} />
        </SubmitButton>
      </form>
      <form action={item.onDelete}>
        <ConfirmSubmitButton confirmMessage={`¿Eliminar la sesión "${item.nombre}"?`} className="btn sm icon ghost">
          <Icon name="trash" size={13} />
        </ConfirmSubmitButton>
      </form>
      <Link href={item.editHref} className="btn sm primary">
        Editar
        <Icon name="chevronRight" size={14} />
      </Link>
    </div>
  );
}
