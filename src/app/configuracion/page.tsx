import CoachShell from "@/components/CoachShell";
import { TextField, ErrorBanner, SuccessBanner } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUser } from "@/lib/actions/require-user";
import { updateProfile, changePassword } from "./actions";

const SAVED_MESSAGES: Record<string, string> = {
  perfil: "Perfil actualizado.",
  clave: "Contraseña actualizada.",
};

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const { supabase, user } = await requireUser();

  const { data: coach } = await supabase.from("coaches").select("nombre, email").eq("id", user.id).maybeSingle();

  return (
    <CoachShell active="/configuracion">
      <div className="content-head">
        <div>
          <h1>Configuración</h1>
          <div className="sub">Tu perfil y el acceso a tu cuenta</div>
        </div>
      </div>

      <div style={{ maxWidth: 420 }}>
        <ErrorBanner message={error} />
        {saved && <SuccessBanner show={saved} message={SAVED_MESSAGES[saved] ?? "Guardado."} />}

        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <div className="section-h" style={{ marginTop: 0 }}>
            <h3>Perfil</h3>
          </div>
          <form action={updateProfile}>
            <TextField label="Nombre" name="nombre" defaultValue={coach?.nombre} required />
            <div className="field">
              <span className="field-label">Email</span>
              <input value={coach?.email ?? user.email ?? ""} disabled />
              <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 4 }}>
                Es el email con el que iniciás sesión — escribinos si necesitás cambiarlo.
              </div>
            </div>
            <SubmitButton className="btn primary" style={{ marginTop: 6 }}>
              Guardar
            </SubmitButton>
          </form>
        </div>

        <div className="card card-pad">
          <div className="section-h" style={{ marginTop: 0 }}>
            <h3>Cambiar contraseña</h3>
          </div>
          <form action={changePassword}>
            <TextField label="Contraseña nueva" name="password" type="password" required />
            <TextField label="Repetí la contraseña" name="password2" type="password" required />
            <SubmitButton className="btn primary" style={{ marginTop: 6 }}>
              Actualizar contraseña
            </SubmitButton>
          </form>
        </div>
      </div>
    </CoachShell>
  );
}
