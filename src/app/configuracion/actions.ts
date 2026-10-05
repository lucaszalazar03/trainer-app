"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/actions/require-user";

export async function updateProfile(formData: FormData) {
  const { supabase, user } = await requireUser();

  const nombre = String(formData.get("nombre") || "").trim();
  if (!nombre) redirect("/configuracion?error=El nombre es obligatorio");

  const { error } = await supabase.from("coaches").update({ nombre }).eq("id", user.id);
  if (error) redirect(`/configuracion?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/configuracion");
  redirect("/configuracion?saved=perfil");
}

export async function changePassword(formData: FormData) {
  const { supabase } = await requireUser();

  const password = String(formData.get("password") || "");
  const password2 = String(formData.get("password2") || "");

  if (password.length < 6) {
    redirect("/configuracion?error=La contraseña tiene que tener al menos 6 caracteres");
  }
  if (password !== password2) {
    redirect("/configuracion?error=Las contraseñas no coinciden");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/configuracion?error=${encodeURIComponent(error.message)}`);

  redirect("/configuracion?saved=clave");
}
