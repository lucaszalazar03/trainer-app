"use client";

import { useEffect } from "react";

/**
 * Pantalla para cuando una página no puede cargar (por ejemplo, un corte
 * momentáneo de la base de datos). En vez de la pantalla rota de Next, un
 * aviso claro y un botón para reintentar. Los datos ya guardados no se
 * pierden: esto sólo afecta a la lectura de esta pantalla.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[pantalla] error al cargar", error);
  }, [error]);

  return (
    <div style={{ maxWidth: 420, margin: "80px auto", padding: "0 20px", textAlign: "center" }}>
      <h1 style={{ marginBottom: 10 }}>No se pudo cargar esta pantalla</h1>
      <p style={{ color: "var(--text-dim)", fontSize: 14, marginBottom: 20 }}>
        Hubo un problema momentáneo de conexión. Tus datos guardados no se perdieron.
      </p>
      <button type="button" className="btn primary" onClick={() => reset()}>
        Reintentar
      </button>
    </div>
  );
}
