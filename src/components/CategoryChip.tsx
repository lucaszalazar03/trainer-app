"use client";

import Link from "next/link";

export function CategoryChip({
  nombre,
  href,
  active,
  onDelete,
}: {
  nombre: string;
  href: string;
  active: boolean;
  onDelete: () => void | Promise<void>;
}) {
  return (
    <Link
      href={href}
      className={`chip ${active ? "active" : ""}`}
      onContextMenu={(e) => {
        e.preventDefault();
        if (confirm(`¿Eliminar la categoría "${nombre}"? Los ejercicios que la usan quedan sin categoría.`)) {
          onDelete();
        }
      }}
    >
      {nombre}
    </Link>
  );
}
