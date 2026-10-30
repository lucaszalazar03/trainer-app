import AlumnoShell from "@/components/AlumnoShell";
import { RangeField } from "@/components/RangeField";
import { SubmitButton } from "@/components/SubmitButton";
import { requireStudent } from "@/lib/actions/require-student";
import { asUser } from "@/lib/db/as-user";
import { inicioDeHoyArgentina } from "@/lib/date";
import { submitCheckin } from "../actions";

export default async function CheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const { user, student } = await requireStudent();

  const startOfToday = inicioDeHoyArgentina();

  // Conexión directa con las reglas de seguridad del alumno (ver as-user.ts).
  const [checkinHoy] = await asUser(user.id, (sql) => sql<{ energia: number; dolor: number; sueno: number }[]>`
    select energia, dolor, sueno from checkins
    where student_id = ${student.id} and fecha >= ${startOfToday.toISOString()} limit 1`);

  return (
    <AlumnoShell active="/alumno/checkin" nombre={student.nombre}>
      <div className="content-head" style={{ marginBottom: 16 }}>
        <div>
          <h1>Check-in de hoy</h1>
          <div className="sub">Contale a tu coach cómo llegás a entrenar.</div>
        </div>
      </div>

      {saved && <div className="banner success">Check-in guardado. ¡Gracias!</div>}

      <form action={submitCheckin} className="card card-pad" style={{ display: "grid", gap: 22 }}>
        <RangeField name="energia" label="Energía" defaultValue={checkinHoy?.energia ?? 3} lo="Baja" hi="Alta" />
        <RangeField name="dolor" label="Dolor muscular" defaultValue={checkinHoy?.dolor ?? 1} lo="Sin dolor" hi="Mucho dolor" />
        <RangeField name="sueno" label="Calidad de sueño" defaultValue={checkinHoy?.sueno ?? 3} lo="Mal" hi="Excelente" />

        <SubmitButton className="btn primary block-w">
          {checkinHoy ? "Actualizar check-in" : "Enviar check-in"}
        </SubmitButton>
      </form>
    </AlumnoShell>
  );
}
