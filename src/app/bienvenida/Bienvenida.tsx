"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useInstallPrompt } from "@/lib/use-install-prompt";

export function Bienvenida() {
  const router = useRouter();
  const { kind, ready, installing, install } = useInstallPrompt();

  // Aceptado, rechazado o ni siquiera se pudo ofrecer (navegador sin
  // soporte) — en cualquier caso seguimos a la pantalla de ingresar/crear
  // cuenta, así el botón nunca deja a alguien sin adónde ir.
  async function handleInstall() {
    await install();
    router.push("/login");
  }

  return (
    <main className="welcome">
      <div className="welcome-card">
        <Image src="/icons/icon-192.png" alt="" width={88} height={88} className="welcome-icon" priority />

        <div className="wordmark welcome-wordmark">Z-PERFORMANCE</div>
        <p className="welcome-tagline">Tu plan de entrenamiento, siempre a mano.</p>

        {kind === "ios" ? (
          <>
            <ol className="welcome-steps">
              <li>
                <Icon name="share" size={15} />
                Tocá <strong>Compartir</strong> en Safari
              </li>
              <li>
                <Icon name="plus" size={15} />
                Elegí <strong>&quot;Agregar a inicio&quot;</strong>
              </li>
              <li>
                <Icon name="check" size={15} />
                Abrí Z-Performance desde tu pantalla de inicio
              </li>
            </ol>
            <Link href="/login" className="btn primary block-w welcome-cta">
              Ya la agregué, continuar
            </Link>
          </>
        ) : kind === "android" ? (
          <>
            <button type="button" className="btn primary block-w welcome-cta" onClick={handleInstall} disabled={installing}>
              <Icon name="download" size={16} />
              {installing ? "Instalando…" : "Instalar app"}
            </button>
            <Link href="/login" className="welcome-skip">
              Continuar sin instalar
            </Link>
          </>
        ) : (
          <Link href="/login" className="btn primary block-w welcome-cta">
            {ready ? "Ingresar" : "Cargando…"}
          </Link>
        )}
      </div>

      <div className="welcome-footer">Lucas Zalazar</div>
    </main>
  );
}
