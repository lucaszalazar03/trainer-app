"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SubmitButton } from "@/components/SubmitButton";
import { signIn, signUp } from "./actions";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const [tab, setTab] = useState<"in" | "up">(params.get("tab") === "up" ? "up" : "in");
  const error = params.get("error");
  const checkEmail = params.get("check_email");
  const confirmed = params.get("confirmed");

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        padding: 24,
      }}
    >
      <div className="card" style={{ width: "100%", maxWidth: 380, padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div className="wordmark" style={{ justifyContent: "center", fontSize: 26 }}>
            Z-PERFORMANCE
          </div>
          <div
            style={{
              color: "var(--text-faint)",
              fontSize: 11,
              marginTop: 8,
              fontFamily: "var(--font-mono)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Strength and conditioning
          </div>
        </div>

        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
          <TabButton active={tab === "in"} onClick={() => setTab("in")}>
            Ingresar
          </TabButton>
          <TabButton active={tab === "up"} onClick={() => setTab("up")}>
            Crear cuenta
          </TabButton>
        </div>

        {error && <div className="banner danger">{decodeURIComponent(error)}</div>}
        {checkEmail && (
          <div className="banner success">
            ¡Listo! Te mandamos un mail. Abrilo y tocá el link para confirmar tu cuenta (si no lo ves, revisá Spam).
          </div>
        )}
        {confirmed && <div className="banner success">Mail confirmado. Ya podés ingresar con tu email y contraseña.</div>}

        {tab === "in" ? (
          <form action={signIn} style={{ display: "grid" }}>
            <Field label="Email" name="email" type="email" required />
            <Field label="Contraseña" name="password" type="password" required />
            <SubmitButton className="btn primary block-w" style={{ marginTop: 6 }}>
              Ingresar
            </SubmitButton>
          </form>
        ) : (
          <>
            <p style={{ color: "var(--text-faint)", fontSize: 12, margin: "0 0 14px" }}>
              Creá tu cuenta de alumno. Después de confirmar tu mail ya podés entrar a la app.
            </p>
            <form action={signUp} style={{ display: "grid" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Nombre" name="nombre" type="text" required />
                <Field label="Apellido" name="apellido" type="text" required />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <Field label="Edad" name="edad" type="number" min={1} max={119} inputMode="numeric" />
                <Field label="Altura (cm)" name="altura_cm" type="number" min={1} max={249} inputMode="numeric" />
                <Field label="Peso (kg)" name="peso_kg" type="text" inputMode="decimal" />
              </div>
              <Field label="Email" name="email" type="email" required />
              <Field label="Contraseña" name="password" type="password" required minLength={6} />
              <SubmitButton className="btn primary block-w" style={{ marginTop: 6 }}>
                Crear cuenta
              </SubmitButton>
            </form>
          </>
        )}
      </div>
      <div
        style={{
          color: "var(--text-faint)",
          fontSize: 10,
          fontFamily: "var(--font-mono)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          opacity: 0.6,
        }}
      >
        Lucas Zalazar
      </div>
    </main>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        padding: "9px 0",
        border: "none",
        borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
        marginBottom: -1,
        fontSize: 13,
        fontWeight: 600,
        background: "transparent",
        color: active ? "var(--text)" : "var(--text-faint)",
      }}
    >
      {children}
    </button>
  );
}

function Field(props: {
  label: string;
  name: string;
  type: string;
  required?: boolean;
  minLength?: number;
  min?: number;
  max?: number;
  inputMode?: "numeric" | "decimal";
}) {
  return (
    <div className="field">
      <span className="field-label">{props.label}</span>
      <input
        name={props.name}
        type={props.type}
        required={props.required}
        minLength={props.minLength}
        min={props.min}
        max={props.max}
        inputMode={props.inputMode}
        style={{ width: "100%", minWidth: 0 }}
      />
    </div>
  );
}
