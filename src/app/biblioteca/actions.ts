"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidateExerciseLists } from "@/lib/db/exercises";
import { requireUser } from "@/lib/actions/require-user";
import { getDirectSql } from "@/lib/db/direct";
import { friendlyDbError } from "@/lib/db/friendly-error";
import { VIDEO_BUCKET } from "@/lib/video";

type SupabaseServerClient = Awaited<ReturnType<typeof requireUser>>["supabase"];

// Si el video actual de un ejercicio es un archivo que subimos nosotros a
// nuestro bucket (no un link externo de YouTube/etc), lo borramos del
// storage antes de reemplazarlo o quitarlo, para no dejar basura.
async function removeStoredVideoIfOwned(supabase: SupabaseServerClient, videoUrl: string | null) {
  if (!videoUrl) return;
  const marker = `/storage/v1/object/public/${VIDEO_BUCKET}/`;
  const idx = videoUrl.indexOf(marker);
  if (idx === -1) return;
  const path = videoUrl.slice(idx + marker.length);
  if (path) await supabase.storage.from(VIDEO_BUCKET).remove([path]);
}

// createExercise/updateExercise/deleteExercise usan conexión DIRECTA a
// Postgres (ver src/lib/db/direct.ts) en vez de supabase-js — es la parte de
// la biblioteca que más veníamos viendo fallar por el incidente de Supabase.
// Como esto no pasa por RLS, cada consulta repite a mano el mismo chequeo
// que hacía la política "coach gestiona sus ejercicios" (coach_id =
// auth.uid()): el WHERE/insert siempre lleva coach_id = ${user.id}.
//
// Ojo con el orden acá: redirect() de Next tira una excepción interna para
// cortar la ejecución — llamarlo DENTRO de un try/catch lo capturaría como
// si fuera un error nuestro. Por eso la consulta va en su propio try/catch
// que sólo guarda un mensaje de error, y el redirect() se llama siempre
// después, ya afuera.
export async function createExercise(formData: FormData) {
  const { user } = await requireUser();

  const nombre = String(formData.get("nombre") || "").trim();
  if (!nombre) redirect("/biblioteca/nuevo?error=El nombre es obligatorio");

  const categoriaId = String(formData.get("categoria_id") || "");
  const sql = getDirectSql();

  let newId: string | null = null;
  let errorMsg: string | null = null;
  try {
    const rows = await sql<{ id: string }[]>`
      insert into exercises (coach_id, nombre, grupo, equipamiento, categoria_id, obs, video_url)
      values (
        ${user.id}, ${nombre},
        ${String(formData.get("grupo") || "").trim() || null},
        ${String(formData.get("equipamiento") || "").trim() || null},
        ${categoriaId || null},
        ${String(formData.get("obs") || "").trim() || null},
        ${String(formData.get("video_url") || "").trim() || null}
      )
      returning id
    `;
    newId = rows[0]?.id ?? null;
  } catch (err) {
    errorMsg = friendlyDbError(err) ?? "No se pudo crear el ejercicio";
  }

  if (errorMsg || !newId) {
    redirect(`/biblioteca/nuevo?error=${encodeURIComponent(errorMsg || "No se pudo crear el ejercicio")}`);
  }

  revalidateExerciseLists();
  redirect(`/biblioteca/${newId}?saved=1`);
}

// Conserva el filtro (categoría/búsqueda) con el que se llegó a este
// ejercicio — viaja como campos ocultos en el form (_categoria/_q, ver
// [id]/page.tsx) — para que el redirect de vuelta pueda armar la misma URL
// con la que el coach venía navegando (Anterior/Siguiente, o "Biblioteca"
// en las migas de pan).
function filterQs(formData: FormData): string {
  const params = new URLSearchParams();
  const categoria = String(formData.get("_categoria") || "");
  const q = String(formData.get("_q") || "");
  if (categoria) params.set("categoria", categoria);
  if (q) params.set("q", q);
  const s = params.toString();
  return s ? `&${s}` : "";
}

export async function updateExercise(id: string, formData: FormData) {
  const { user } = await requireUser();
  const qs = filterQs(formData);

  const nombre = String(formData.get("nombre") || "").trim();
  if (!nombre) redirect(`/biblioteca/${id}?error=El nombre es obligatorio${qs}`);

  const categoriaId = String(formData.get("categoria_id") || "");
  const sql = getDirectSql();

  let errorMsg: string | null = null;
  try {
    const rows = await sql`
      update exercises set
        nombre = ${nombre},
        grupo = ${String(formData.get("grupo") || "").trim() || null},
        equipamiento = ${String(formData.get("equipamiento") || "").trim() || null},
        categoria_id = ${categoriaId || null},
        obs = ${String(formData.get("obs") || "").trim() || null},
        video_url = ${String(formData.get("video_url") || "").trim() || null}
      where id = ${id} and coach_id = ${user.id}
      returning id
    `;
    if (rows.length === 0) errorMsg = "No se encontró el ejercicio (o no te pertenece).";
  } catch (err) {
    errorMsg = friendlyDbError(err) ?? "No se pudo guardar el ejercicio";
  }

  if (errorMsg) redirect(`/biblioteca/${id}?error=${encodeURIComponent(errorMsg)}${qs}`);

  revalidateExerciseLists();
  // Antes esto mandaba de vuelta a /biblioteca (la lista completa, con sus
  // consultas de uso por ejercicio) — si el coach iba editando ejercicio
  // por ejercicio, cada guardado recargaba la página más pesada de toda la
  // app. Ahora se queda en esta misma página del ejercicio (mucho más
  // liviana) y el coach usa Anterior/Siguiente para seguir de largo.
  redirect(`/biblioteca/${id}?saved=1${qs}`);
}

// El borrado tiene ON DELETE CASCADE hacia block_exercises/warmup_exercises/
// template_block_exercises/template_warmup_exercises — si el ejercicio ya
// está cargado en una sesión o plantilla, borrarlo de la biblioteca también
// lo saca de ahí (la Biblioteca avisa esto ANTES de confirmar).
//
// Antes eran 4 pasos en fila (leer video → borrar video del storage →
// borrar ejercicio → recargar la Biblioteca entera). Ahora: UN solo
// DELETE ... RETURNING video_url, y la limpieza del video corre con after()
// (después de responder), así que no frena al coach.
async function deleteExerciseCore(id: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await requireUser();
  const sql = getDirectSql();

  let videoUrl: string | null = null;
  try {
    const rows = await sql<{ video_url: string | null }[]>`
      delete from exercises where id = ${id} and coach_id = ${user.id} returning video_url
    `;
    if (rows.length === 0) return { ok: false, error: "No se encontró el ejercicio (o ya estaba eliminado)." };
    videoUrl = rows[0].video_url;
  } catch (err) {
    return { ok: false, error: friendlyDbError(err) ?? "No se pudo eliminar el ejercicio" };
  }

  // Si falla no es grave: en el peor caso queda un video huérfano en el storage.
  if (videoUrl) after(() => removeStoredVideoIfOwned(supabase, videoUrl).catch(() => {}));

  revalidateExerciseLists();
  return { ok: true };
}

// Desde la lista de la Biblioteca: la fila ya desapareció en pantalla
// (actualización optimista); esto sólo confirma o devuelve el error para
// que la fila vuelva a aparecer. No navega.
export async function deleteExerciseInline(id: string) {
  return deleteExerciseCore(id);
}

// Desde la página de detalle del ejercicio (form): vuelve a la Biblioteca.
export async function deleteExercise(id: string) {
  const result = await deleteExerciseCore(id);
  if (!result.ok) redirect(`/biblioteca?error=${encodeURIComponent(result.error ?? "No se pudo eliminar el ejercicio")}`);
  redirect("/biblioteca");
}

// ---------- Video demostrativo (clip corto grabado por el coach) ----------
//
// Antes el archivo viajaba navegador -> este servidor (como <form action>
// con el archivo adentro) -> storage de Supabase: el video entero cruzaba
// la red DOS veces, y en el medio nuestro propio servidor tenía que
// recibirlo entero antes de poder reenviarlo — con eso, entrar a subir un
// video y volver a salir se sentía lento aunque el clip durara 10 segundos.
//
// Ahora el archivo lo sube el navegador DIRECTO al storage de Supabase
// (ver ExerciseVideoCard, componente cliente) — las políticas de storage.
// objects ya dejan que un coach autenticado escriba en su propia carpeta
// (bucket exercise-videos, carpeta = su user id), así que no hace falta
// pasar por acá para eso. Esta función ya sólo recibe el link resultante
// (unos bytes de texto) y lo guarda — de ahí que ya no reciba un FormData
// con el archivo, sino el string de la URL.
export async function setExerciseVideoUrl(exerciseId: string, url: string) {
  const { supabase, user } = await requireUser();

  const trimmed = url.trim();
  if (!trimmed) return { ok: false, error: "Falta la URL del video" };

  const { data: exercise } = await supabase
    .from("exercises")
    .select("video_url")
    .eq("id", exerciseId)
    .eq("coach_id", user.id)
    .maybeSingle();

  if (!exercise) return { ok: false, error: "No se encontró el ejercicio (o no te pertenece)." };

  if (exercise.video_url && exercise.video_url !== trimmed) {
    await removeStoredVideoIfOwned(supabase, exercise.video_url);
  }

  const { error } = await supabase.from("exercises").update({ video_url: trimmed }).eq("id", exerciseId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/biblioteca/${exerciseId}`);
  revalidatePath("/biblioteca");
  return { ok: true };
}

// Ya no redirige (antes volvía a /biblioteca/[id]?saved=video, una
// navegación completa) — ExerciseVideoCard actualiza la vista al toque y
// sólo pide de fondo un router.refresh() para que el resto de la página
// (por ej. el campo para pegar un link externo) quede sincronizado, mismo
// criterio que el resto de los guardados "en el momento" de la app (ver
// ExerciseRowEditor).
export async function removeExerciseVideo(exerciseId: string) {
  const { supabase, user } = await requireUser();

  const { data: exercise } = await supabase
    .from("exercises")
    .select("video_url")
    .eq("id", exerciseId)
    .eq("coach_id", user.id)
    .maybeSingle();

  if (!exercise) return { ok: false, error: "No se encontró el ejercicio (o no te pertenece)." };

  await removeStoredVideoIfOwned(supabase, exercise.video_url);

  const { error } = await supabase.from("exercises").update({ video_url: null }).eq("id", exerciseId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/biblioteca/${exerciseId}`);
  revalidatePath("/biblioteca");
  return { ok: true };
}

export async function createCategory(formData: FormData) {
  const { supabase, user } = await requireUser();

  const nombre = String(formData.get("categoria_nueva") || "").trim();
  const back = String(formData.get("back") || "/biblioteca");

  if (nombre) {
    await supabase.from("categories").insert({ coach_id: user.id, nombre });
  }

  revalidatePath("/biblioteca");
  redirect(back);
}

export async function deleteCategory(id: string, back: string) {
  const { supabase } = await requireUser();
  await supabase.from("categories").delete().eq("id", id);
  revalidatePath("/biblioteca");
  redirect(back);
}
