"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { useInstallPrompt } from "@/lib/use-install-prompt";

const DISMISS_KEY = "zp-install-dismissed";

/**
 * Banner chico para instalar la app a pantalla de inicio. Vive en el layout
 * raíz (no en AlumnoShell/CoachShell) para que aparezca en toda la app,
 * incluso antes de iniciar sesión.
 *
 * No se muestra en /bienvenida — esa pantalla ya tiene su propio botón de
 * instalar, grande, así que este cartel ahí sería una segunda copia del
 * mismo pedido apenas más abajo.
 *
 * Si el usuario lo cierra con la X, no lo volvemos a mostrar en este
 * dispositivo (localStorage).
 */
export function InstallPrompt() {
  const pathname = usePathname();
  const { kind, installing, install } = useInstallPrompt();
  // Arranca en true (oculto) porque localStorage no existe durante el
  // render en el servidor — recién en el efecto de abajo, ya en el
  // cliente, corregimos al valor real.
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let wasDismissed = false;
    try {
      wasDismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // Si localStorage no está disponible (modo privado, etc.) simplemente
      // no persistimos el cierre — no rompe nada, sólo vuelve a aparecer.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(wasDismissed);
  }, []);

  function cerrar() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Ver comentario arriba — no pasa nada si no se puede persistir.
    }
  }

  if (pathname === "/bienvenida" || dismissed || !kind) return null;

  if (kind === "ios") {
    return (
      <div className="install-banner">
        <Icon name="share" size={14} />
        <span>
          Instalá la app: tocá <strong>Compartir</strong> y después <strong>&quot;Agregar a inicio&quot;</strong>.
        </span>
        <button type="button" className="install-banner-close" onClick={cerrar} aria-label="Cerrar">
          <Icon name="x" size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="install-banner">
      <Icon name="download" size={14} />
      <span>Instalá la app en tu celular para acceder más rápido.</span>
      <button type="button" className="install-banner-btn" onClick={install} disabled={installing}>
        {installing ? "Instalando…" : "Instalar"}
      </button>
      <button type="button" className="install-banner-close" onClick={cerrar} aria-label="Cerrar">
        <Icon name="x" size={13} />
      </button>
    </div>
  );
}
