import Link from "next/link";
import { signOut } from "@/lib/actions/auth";
import { Icon } from "./Icon";
import { SubmitButton } from "./SubmitButton";
import { NotificationsOptIn } from "./NotificationsOptIn";

const NAV = [
  { href: "/alumno/checkin", label: "Check-in", icon: "flame" },
  { href: "/alumno", label: "Home", icon: "home" },
  { href: "/alumno/progreso", label: "Performance", icon: "layers" },
] as const;

export default function AlumnoShell({
  active,
  nombre,
  children,
}: {
  active: (typeof NAV)[number]["href"];
  nombre: string;
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell">
      <div className="topbar">
        <Link href="/alumno" className="wordmark">
          Z-PERFORMANCE
          <small>alumno</small>
        </Link>
        <div className="topbar-spacer" />
        {/* Mismo menú de cuenta que en la versión coach — ver CoachShell
            para el detalle del truco de checkbox oculto. Acá no hay link a
            Configuración porque el alumno todavía no tiene esa pantalla. */}
        <div className="topbar-user">
          <label htmlFor="account-toggle" className="account-trigger" aria-label="Cuenta">
            <span className="avatar-circle sm">{nombre.charAt(0).toUpperCase()}</span>
          </label>
          <input type="checkbox" id="account-toggle" className="account-toggle-checkbox" />
          <label htmlFor="account-toggle" className="account-backdrop" aria-hidden="true" />
          <div className="account-menu">
            <div className="account-menu-name">{nombre}</div>
            <form action={signOut}>
              <SubmitButton className="account-menu-item danger" title="Cerrar sesión">
                <Icon name="logout" size={14} />
                Cerrar sesión
              </SubmitButton>
            </form>
          </div>
        </div>
      </div>

      <NotificationsOptIn />

      <main>
        <div className="alumno-shell">{children}</div>
      </main>

      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={`bnav-item ${item.href === active ? "active" : ""}`}>
              <Icon name={item.icon} size={19} />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
