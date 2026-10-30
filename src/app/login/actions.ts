"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { after } from "next/server";
import { notifyCoachNewStudent } from "@/lib/notify-coach";
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

// Registro abierto SÓLO para alumnos (el de coaches está cerrado: ver la
// función handle_new_user en la base). Al confirmar el mail, el alumno ya
// puede usar la app: la base crea su ficha automáticamente, asignada al
// coach, con los datos que cargó acá (o la vincula a la ficha que el coach
// ya había creado con ese mismo email).
export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const nombre = String(formData.get("nombre") || "").trim();
  const apellido = String(formData.get("apellido") || "").trim();
  const edad = String(formData.get("edad") || "").trim();
  const altura = String(formData.get("altura_cm") || "").trim();
  const peso = String(formData.get("peso_kg") || "").trim().replace(",", ".");

  const fail = (msg: string) => redirect(`/login?tab=up&error=${encodeURIComponent(msg)}`);
  if (!nombre || !apellido) fail("Completá tu nombre y apellido.");
  if (edad && !(Number(edad) > 0 && Number(edad) < 120)) fail("Revisá la edad.");
  if (altura && !(Number(altura) > 0 && Number(altura) < 250)) fail("Revisá la altura (en cm, ej. 175).");
  if (peso && !(Number(peso) > 0 && Number(peso) < 400)) fail("Revisá el peso (en kg, ej. 72,5).");

  const nombreCompleto = `${nombre} ${apellido}`;
  const h = await headers();
  const origin = h.get("origin") || (h.get("host") ? `https://${h.get("host")}` : "");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: origin ? `${origin}/auth/callback` : undefined,
      data: { role: "student", nombre: nombreCompleto, edad, altura_cm: altura, peso_kg: peso },
    },
  });

  if (error) {
    // Supabase limita cuántos mails de confirmación manda por hora. Mensaje
    // claro en vez del texto técnico en inglés.
    const msg = /rate limit/i.test(error.message)
      ? "Hay muchos registros en este momento. Esperá unos minutos y probá de nuevo."
      : error.message;
    fail(msg);
  }
  // Supabase no da error si el email ya estaba registrado (para no revelar
  // qué emails existen): lo detectamos porque el usuario vuelve sin identidades.
  if (data?.user && data.user.identities?.length === 0) {
    redirect(`/login?error=${encodeURIComponent("Ese email ya tiene una cuenta. Ingresá con tu contraseña.")}`);
  }

  after(() => notifyCoachNewStudent(nombreCompleto));
  // Si en Supabase no se pide confirmar el mail, la cuenta ya viene con la
  // sesión abierta: el alumno entra directo a la app, sin esperar ningún
  // mail (y sin depender del límite de mails por hora de Supabase).
  if (data?.session) redirect("/");
  redirect("/login?check_email=1");
}
