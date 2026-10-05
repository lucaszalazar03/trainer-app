import { getDirectSql } from "@/lib/db/direct";
import { sendPush } from "@/lib/push-server";

/**
 * Aviso push al coach cuando un alumno nuevo se registra solo. Sólo se
 * llama desde signUp en el servidor (no es Server Action). Quien se
 * registra todavía no tiene sesión, por eso el coach se busca con la
 * conexión directa. Nunca rompe el registro.
 */
export async function notifyCoachNewStudent(nombre: string) {
  try {
    const sql = getDirectSql();
    const [coach] = await sql<{ id: string }[]>`select id from coaches order by created_at limit 1`;
    if (!coach) return;
    await sendPush(coach.id, {
      title: "Nuevo alumno registrado",
      body: `${nombre} creó su cuenta en Z-Performance.`,
      url: "/alumnos",
    });
  } catch {
    // no crítico
  }
}
