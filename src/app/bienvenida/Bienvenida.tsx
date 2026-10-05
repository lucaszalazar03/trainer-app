"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { useInstallPrompt } from "@/lib/use-install-prompt";

type Platform = "ios" | "android" | "desktop" | "installed" | null;

/**
 * Link único para compartir con alumnos nuevos (la raíz del sitio lleva
 * acá): en una sola pantalla
 *   1) cómo instalar la app en el celular (botón directo en Android si el
 *      navegador lo permite; pasos manuales en iPhone o si no), y
 *   2) crear cuenta / ingresar.
 * Si se abrió desde WhatsApp/Instagram (navegador interno, donde no se puede
 * instalar), avisa que lo abra en Chrome o Safari.
 */
export function Bienvenida() {
  const { kind, ready, installing, install } = useInstallPrompt();
  const [platform, setPlatform] = useState<Platform>(null);
  const [inApp, setInApp] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlatform(standalone ? "installed" : /iphone|ipad|ipod/i.test(ua) ? "ios" : /android/i.test(ua) ? "android" : "desktop");
    setInApp(/Instagram|FBAN|FBAV|WhatsApp|; wv\)/i.test(ua));
  }, []);

  async function handleInstall() {
    const outcome = await install();
    if (outcome === "accepted") setInstalled(true);
  }

  const showInstallStep = platform !== null && platform !== "installed" && !installed;

  return (
    <main className="welcome">
      <div className="welcome-card">
        <Image src="/icons/icon-192.png" alt="" width={80} height={80} className="welcome-icon" priority />
        <div className="wordmark welcome-wordmark">Z-PERFORMANCE</div>
        <p className="welcome-tagline">Tu plan de entrenamiento, siempre a mano.</p>

        {showInstallStep && (
          <section className="welcome-section">
            <div className="welcome-step-title">
              <span className="welcome-step-num">1</span> Instalá la app en tu celular
            </div>

            {inApp && (
              <p className="welcome-note">
                <Icon name="alert" size={14} />
                <span>
                  Si abriste este link desde WhatsApp o Instagram, primero abrilo en{" "}
                  <strong>{platform === "ios" ? "Safari" : "Chrome"}</strong> (menú <strong>⋮</strong> o{" "}
                  <strong>···</strong> → &quot;Abrir en el navegador&quot;).
                </span>
              </p>
            )}

            {platform === "ios" && (
              <ol className="welcome-steps">
                <li>
                  <Icon name="share" size={15} />
                  <span>
                    En Safari, tocá <strong>Compartir</strong> (el cuadrado con la flecha)
                  </span>
                </li>
                <li>
                  <Icon name="plus" size={15} />
                  <span>
                    Elegí <strong>&quot;Agregar a inicio&quot;</strong> y después <strong>Agregar</strong>
                  </span>
                </li>
                <li>
                  <Icon name="check" size={15} />
                  <span>Abrí Z-Performance desde el ícono en tu pantalla</span>
                </li>
              </ol>
            )}

            {platform === "android" &&
              (kind === "android" ? (
                <button type="button" className="btn block-w" onClick={handleInstall} disabled={installing}>
                  <Icon name="download" size={16} />
                  {installing ? "Instalando…" : "Instalar app"}
                </button>
              ) : (
                <ol className="welcome-steps">
                  <li>
                    <Icon name="menu" size={15} />
                    <span>
                      En Chrome, tocá el menú <strong>⋮</strong> (arriba a la derecha)
                    </span>
                  </li>
                  <li>
                    <Icon name="download" size={15} />
                    <span>
                      Elegí <strong>&quot;Instalar app&quot;</strong> o <strong>&quot;Agregar a pantalla principal&quot;</strong>
                    </span>
                  </li>
                  <li>
                    <Icon name="check" size={15} />
                    <span>Abrí Z-Performance desde el ícono en tu pantalla</span>
                  </li>
                </ol>
              ))}

            {platform === "desktop" && (
              <p className="welcome-note">
                <Icon name="alert" size={14} />
                <span>Para instalarla, abrí este mismo link desde tu celular. También podés usarla desde acá.</span>
              </p>
            )}
          </section>
        )}

        {installed && (
          <p className="welcome-note ok">
            <Icon name="check" size={14} />
            <span>¡Listo! Ya tenés la app en tu pantalla de inicio. Abrila desde ahí para seguir.</span>
          </p>
        )}

        <section className="welcome-section">
          <div className="welcome-step-title">
            {showInstallStep && <span className="welcome-step-num">2</span>} Creá tu cuenta
          </div>
          <Link href="/login?tab=up" className="btn primary block-w welcome-cta">
            {ready || platform ? "Crear cuenta" : "Cargando…"}
          </Link>
          <Link href="/login" className="welcome-skip">
            Ya tengo cuenta, ingresar
          </Link>
        </section>
      </div>

      <div className="welcome-footer">Lucas Zalazar</div>
    </main>
  );
}
