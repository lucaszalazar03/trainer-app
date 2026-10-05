"use client";

import { useEffect, useState } from "react";

const VISIBLE_MS = 1000;
const FADE_MS = 350;

/**
 * Pantalla de bienvenida al abrir la app — como la splash de apps nativas
 * (ej. BIGG). Vive en el layout raíz, así que sólo se monta una vez por
 * apertura real de la app (carga de página nueva): al navegar entre
 * pantallas adentro de la app (Next no recarga la página) este componente
 * no se vuelve a montar, así que no reaparece en cada click — igual que una
 * splash nativa, que se ve una vez por arranque y no en cada pantalla.
 *
 * Antes llevaba un cuadradito de acento al lado del nombre — se sacó (ver
 * comentario en globals.css) y quedó solo el wordmark con su subrayado
 * animado, más una bajada chica para que la pantalla no se sienta vacía.
 */
export function SplashScreen() {
  const [phase, setPhase] = useState<"visible" | "fading" | "hidden">("visible");

  useEffect(() => {
    if (phase !== "visible") return;
    const timer = setTimeout(() => setPhase("fading"), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "fading") return;
    const timer = setTimeout(() => setPhase("hidden"), FADE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === "hidden") return null;

  return (
    <div className={`splash-screen ${phase === "fading" ? "fading" : ""}`} aria-hidden="true">
      <div className="splash-word">
        <span className="z">Z</span>-PERFORMANCE
      </div>
      <div className="splash-tagline">Strength &amp; Conditioning</div>
    </div>
  );
}
