"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveHome } from "@/lib/actions/role";

export async function signIn(formData: FormData) {
  const supabase = await createClient();

  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect(data.user ? await resolveHome(supabase, data.user.id) : "/login");
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  const nombre = String(formData.get("nombre") || "");
  const role = String(formData.get("role") || "coach") === "student" ? "student" : "coach";

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: role === "student" ? { role: "student" } : { role: "coach", nombre } },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?check_email=1");
}
