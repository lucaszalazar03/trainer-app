"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/actions/require-user";
import { sendPushToUser } from "@/lib/push-server";

// edad/altura/peso viajan como texto en el FormData (son inputs type="number"
// pero eso no cambia el tipo en el cliente) — se parsean acá y, si vienen
// vacíos, se guardan como null en vez de 0 (0 años/cm/kg no es un dato real).
function parseNumberField(formData: FormData, name: string): number | null {
  const raw = String(formData.get(name) || "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function createStudent(formData: FormData) {
  const { supabase, user } = await requireUser();

  const nombre = String(formData.get("nombre") || "").trim();
  if (!nombre) redirect("/alumnos/nuevo?error=El nombre es obligatorio");

  // Si ya existe un alumno con este email (por ejemplo, porque se registró
  // solo desde la app), no se crea un duplicado: se abre su ficha para
  // completarla.
  const emailNuevo = String(formData.get("email") || "").trim().toLowerCase();
  if (emailNuevo) {
    const { data: existente } = await supabase
      .from("students")
      .select("id")
      .eq("coach_id", user.id)
      .ilike("email", emailNuevo.replace(/[\\%_]/g, (c) => `\\${c}`))
      .maybeSingle();
    if (existente) {
      redirect(
        `/alumnos/${existente.id}?error=${encodeURIComponent(
          "Ya tenés un alumno con ese email (puede que se haya registrado solo). Completá sus datos acá."
        )}`
      );
    }
  }

  const { data, error } = await supabase
    .from("students")
    .insert({
      coach_id: user.id,
      nombre,
      email: String(formData.get("email") || "").trim() || null,
      objetivo: String(formData.get("objetivo") || "").trim() || null,
      estado: String(formData.get("estado") || "Activo"),
      notas: String(formData.get("notas") || "").trim() || null,
      edad: parseNumberField(formData, "edad"),
      altura_cm: parseNumberField(formData, "altura_cm"),
      peso_kg: parseNumberField(formData, "peso_kg"),
      deporte: String(formData.get("deporte") || "").trim() || null,
      posicion: String(formData.get("posicion") || "").trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(`/alumnos/nuevo?error=${encodeURIComponent(error?.message || "No se pudo crear el alumno")}`);
  }

  revalidatePath("/alumnos");
  revalidatePath("/dashboard");
  redirect(`/alumnos/${data.id}`);
}

export async function updateStudent(id: string, formData: FormData) {
  const { supabase } = await requireUser();

  const nombre = String(formData.get("nombre") || "").trim();
  if (!nombre) redirect(`/alumnos/${id}?error=El nombre es obligatorio`);

  const { error } = await supabase
    .from("students")
    .update({
      nombre,
      email: String(formData.get("email") || "").trim() || null,
      objetivo: String(formData.get("objetivo") || "").trim() || null,
      estado: String(formData.get("estado") || "Activo"),
      notas: String(formData.get("notas") || "").trim() || null,
      edad: parseNumberField(formData, "edad"),
      altura_cm: parseNumberField(formData, "altura_cm"),
      peso_kg: parseNumberField(formData, "peso_kg"),
      deporte: String(formData.get("deporte") || "").trim() || null,
      posicion: String(formData.get("posicion") || "").trim() || null,
    })
    .eq("id", id);

  if (error) {
    redirect(`/alumnos/${id}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/alumnos");
  revalidatePath(`/alumnos/${id}`);
  redirect(`/alumnos/${id}?saved=1`);
}

export async function assignProgram(studentId: string, formData: FormData) {
  const { supabase } = await requireUser();

  const programaId = String(formData.get("programa_id") || "");
  const semana = Number(formData.get("semana_actual")) || 1;

  const { error } = await supabase
    .from("students")
    .update({
      programa_id: programaId || null,
      semana_actual: programaId ? semana : 1,
    })
    .eq("id", studentId);

  if (error) {
    redirect(`/alumnos/${studentId}?error=${encodeURIComponent(error.message)}`);
  }

  if (programaId) {
    const { data: st } = await supabase.from("students").select("user_id").eq("id", studentId).maybeSingle();
    if (st?.user_id) {
      await sendPushToUser(supabase, st.user_id, {
        title: "Tenés una rutina nueva",
        body: "Tu coach te asignó un programa de entrenamiento.",
        url: "/alumno",
      });
    }
  }

  revalidatePath("/alumnos");
  revalidatePath(`/alumnos/${studentId}`);
  revalidatePath("/programas");
  redirect(`/alumnos/${studentId}?saved=1`);
}

export async function deleteStudent(id: string) {
  const { supabase } = await requireUser();

  await supabase.from("students").delete().eq("id", id);

  revalidatePath("/alumnos");
  revalidatePath("/dashboard");
  redirect("/alumnos");
}
