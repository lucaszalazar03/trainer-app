import CoachShell from "@/components/CoachShell";
import { Crumbs } from "@/components/Crumbs";
import { SubmitButton } from "@/components/SubmitButton";
import { createTemplate } from "../../templates-actions";

export default async function NuevaPlantillaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; tipo?: string }>;
}) {
  const { error, tipo } = await searchParams;
  const tipoInicial = tipo === "calentamiento" ? "calentamiento" : "bloque";

  return (
    <CoachShell active="/biblioteca">
      <div style={{ maxWidth: 420 }}>
        <Crumbs items={[{ label: "Biblioteca", href: "/biblioteca?tab=plantillas" }, { label: "Nueva plantilla" }]} />
        <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Nueva plantilla</h1>
        <p style={{ color: "var(--text-dim)", fontSize: 13, margin: "0 0 20px" }}>
          Después le agregás ejercicios, como en una sesión.
        </p>

        {error && <div className="banner danger">{decodeURIComponent(error)}</div>}

        <form action={createTemplate}>
          <div className="field">
            <span className="field-label">Tipo de plantilla</span>
            <div className="tipo-picker" role="radiogroup">
              <label className="tipo-picker-opt">
                <input type="radio" name="tipo" value="bloque" defaultChecked={tipoInicial === "bloque"} />
                <span>
                  <strong>Bloque de ejercicios</strong>
                  <small>Con sus propios sub-bloques, como en una sesión</small>
                </span>
              </label>
              <label className="tipo-picker-opt">
                <input type="radio" name="tipo" value="calentamiento" defaultChecked={tipoInicial === "calentamiento"} />
                <span>
                  <strong>Entrada en calor</strong>
                  <small>Lista de ejercicios sin bloques, para insertar de una</small>
                </span>
              </label>
            </div>
          </div>
          <div className="field">
            <span className="field-label">Nombre</span>
            <input name="nombre" placeholder="Ej: Tren superior — fuerza" required />
          </div>
          <SubmitButton className="btn primary block-w" style={{ marginTop: 6 }}>
            Crear plantilla
          </SubmitButton>
        </form>
      </div>
    </CoachShell>
  );
}
