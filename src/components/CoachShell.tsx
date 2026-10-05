import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUser } from "@/lib/supabase/verified-user";
import { signOut } from "@/lib/actions/auth";
import { Icon } from "./Icon";
import { SubmitButton } from "./SubmitButton";
import { NotificationsOptIn } from "./NotificationsOptIn";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "home" },
  { href: "/alumnos", label: "Alumnos", icon: "users" },
  { href: "/equipos", label: "Equipos", icon: "team" },
  { href: "/programas", label: "Programas", icon: "layers" },
  { href: "/biblioteca", label: "Biblioteca", icon: "book" },
  { href: "/calendario", label: "Calendario", icon: "calendar" },
  { href: "/configuracion", label: "Configuración", icon: "settings" },
] as const;

export default async function CoachShell({
  active,
  children,
}: {
  active: (typeof NAV)[number]["href"];
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const user = await getVerifiedUser(supabase);

  let nombre = user?.email ?? "";
  if (user) {
    const { data: coach } = await supabase.from("coaches").select("nombre").eq("id", user.id).single();
    if (coach?.nombre) nombre = coach.nombre;
  }

  return (
    <div className="app-shell">
      {/*
        Checkbox oculto que controla el menú lateral en mobile, sin
        necesitar JS del lado del cliente: el botón de hamburguesa y el
        fondo oscuro son <label> que apuntan a este mismo id, y el CSS usa
        el selector de hermano general (~) para mostrar/ocultar el drawer.
        Como CoachShell se vuelve a renderizar en cada navegación, el
        checkbox arranca siempre destildado — el drawer se cierra solo al
        tocar un link.
      */}
      <input type="checkbox" id="nav-toggle" className="nav-toggle-checkbox" />
      <div className="topbar">
        <label htmlFor="nav-toggle" className="nav-toggle-btn" aria-label="Abrir menú">
          <Icon name="menu" size={20} />
        </label>
        <Link href="/dashboard" className="wordmark">
          Z-PERFORMANCE
          <small>coach</small>
        </Link>
        <div className="topbar-spacer" />
        {/*
          Menú de cuenta: antes acá había un botón "Salir" siempre visible
          — ocupaba lugar todo el tiempo por una acción que se usa una vez
          cada tanto. Ahora es un avatar que despliega nombre, acceso a
          Configuración y Cerrar sesión, con el mismo truco de checkbox
          oculto que el drawer del sidebar (id propio, "account-toggle",
          para no pisar el del menú lateral).
        */}
        <div className="topbar-user">
          <label htmlFor="account-toggle" className="account-trigger" aria-label="Cuenta">
            <span className="avatar-circle sm">{nombre.charAt(0).toUpperCase()}</span>
          </label>
          <input type="checkbox" id="account-toggle" className="account-toggle-checkbox" />
          <label htmlFor="account-toggle" className="account-backdrop" aria-hidden="true" />
          <div className="account-menu">
            <div className="account-menu-name">{nombre}</div>
            <Link href="/configuracion" className="account-menu-item">
              <Icon name="settings" size={15} />
              Configuración
            </Link>
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

      <label htmlFor="nav-toggle" className="nav-backdrop" aria-hidden="true" />

      <main>
        <div className="coach-shell">
          <nav className="sidebar">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className={`side-link ${item.href === active ? "active" : ""}`}>
                <Icon name={item.icon} size={17} />
                {item.label}
              </Link>
            ))}
            <div className="sidebar-foot">Preparador físico</div>
          </nav>
          <div className="content">{children}</div>
        </div>
      </main>
    </div>
  );
}
