"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/actions/require-user";

export async function createTeam(formData: FormData) {
  const { supabase, user } = await requireUser();

  const nombre = String(formData.get("nombre") || "").trim();
  if (!nombre) redirect("/equipos/nuevo?error=El nombre es obligatorio");

  const { data, error } = await supabase
    .from("teams")
    .insert({ coach_id: user.id, nombre })
    .select("id")
    .single();

  if (error || !data) {
    redirect(`/equipos/nuevo?error=${encodeURIComponent(error?.message || "No se pudo crear el equipo")}`);
  }

  revalidatePath("/equipos");
  redirect(`/equipos/${data.id}`);
}

export async function updateTeam(id: string, formData: FormData) {
  const { supabase } = await requireUser();

  const nombre = String(formData.get("nombre") || "").trim();
  if (!nombre) redirect(`/equipos/${id}?error=El nombre es obligatorio`);

  const { error } = await supabase.from("teams").update({ nombre }).eq("id", id);
  if (error) redirect(`/equipos/${id}?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/equipos");
  revalidatePath(`/equipos/${id}`);
  redirect(`/equipos/${id}?saved=1`);
}

export async function deleteTeam(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("teams").delete().eq("id", id);
  revalidatePath("/equipos");
  redirect("/equipos");
}

export async function updateMembers(teamId: string, formData: FormData) {
  const { supabase } = await requireUser();

  const checkedIds = formData.getAll("student_id").map(String);

  await supabase.from("team_members").delete().eq("team_id", teamId);

  if (checkedIds.length) {
    await supabase
      .from("team_members")
      .insert(checkedIds.map((student_id) => ({ team_id: teamId, student_id })));
  }

  revalidatePath(`/equipos/${teamId}`);
  redirect(`/equipos/${teamId}?saved=1`);
}

export async function assignTeamProgram(teamId: string, formData: FormData) {
  const { supabase } = await requireUser();

  const programaId = String(formData.get("programa_id") || "");
  const semana = Number(formData.get("semana_actual")) || 1;

  const { data: members } = await supabase
    .from("team_members")
    .select("student_id")
    .eq("team_id", teamId);

  const studentIds = (members ?? []).map((m) => m.student_id);

  if (studentIds.length) {
    await supabase
      .from("students")
      .update({
        programa_id: programaId || null,
        semana_actual: programaId ? semana : 1,
      })
      .in("id", studentIds);
  }

  revalidatePath("/alumnos");
  revalidatePath("/programas");
  revalidatePath(`/equipos/${teamId}`);
  redirect(`/equipos/${teamId}?saved=1`);
}
