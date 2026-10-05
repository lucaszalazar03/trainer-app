"use client";

import { useState } from "react";
import { TextField } from "./FormField";

/**
 * Checkbox "¿Es deportista?" que muestra/oculta Deporte y Posición. No hay
 * columna separada en la base para "es_deportista": el criterio es que
 * deporte tenga algo cargado. Por eso, cuando el checkbox está destildado,
 * los inputs ni se renderizan — al no viajar en el FormData, las acciones
 * (createStudent/updateStudent) los guardan como null, igual que si el
 * campo se hubiese vaciado a mano.
 */
export function AthleteFields({
  deporte,
  posicion,
}: {
  deporte?: string | null;
  posicion?: string | null;
}) {
  const [esDeportista, setEsDeportista] = useState(!!deporte);

  return (
    <div className="field">
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
        <input type="checkbox" checked={esDeportista} onChange={(e) => setEsDeportista(e.target.checked)} />
        ¿Es deportista?
      </label>
      {esDeportista && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
          <TextField label="Deporte" name="deporte" defaultValue={deporte} placeholder="Ej: Fútbol" />
          <TextField label="Posición" name="posicion" defaultValue={posicion} placeholder="Ej: Delantero" />
        </div>
      )}
    </div>
  );
}
