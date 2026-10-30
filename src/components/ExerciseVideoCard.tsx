"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExerciseVideo } from "./ExerciseVideo";
import { createClient } from "@/lib/supabase/client";
import { VIDEO_BUCKET, VIDEO_MIME_EXT, MAX_VIDEO_BYTES, AUDIO_MODES, storagePathFromUrl, type AudioMode } from "@/lib/video";

type Result = { ok: boolean; error?: string };
type CleanResult = { ok: boolean; url?: string; error?: string };
const MAX_SECONDS = 15;

// Antes esto tardaba porque el archivo cruzaba la red dos veces (navegador
// -> nuestro servidor -> storage de Supabase) y, al terminar, un redirect()
// del lado del servidor hacía sentir que "salías y volvías a entrar" a la
// edición. Ahora el archivo sube DIRECTO del navegador al storage (mismo
// motivo que el comentario grande en biblioteca/actions.ts) y sólo se
// actualiza esta tarjeta — sin navegar a ningún lado — así que 45s de
// margen alcanza de sobra incluso con mala conexión.
const UPLOAD_TIMEOUT_MS = 45000;
// Limpiar el sonido pasa por el servidor (bajar, procesar, volver a subir).
const CLEAN_TIMEOUT_MS = 90000;

/**
 * Tarjeta de "Video demostrativo" del ejercicio: sube un clip propio
 * (directo a Supabase Storage) o lo quita, todo sin salir de esta página.
 * Reemplaza al viejo VideoUploadField + el bloque de preview/quitar que
 * antes vivían sueltos en [id]/page.tsx.
 */
export function ExerciseVideoCard({
  exerciseId,
  initialVideoUrl,
  onSetVideoUrl,
  onRemoveVideo,
  onCleanAudio,
}: {
  exerciseId: string;
  initialVideoUrl: string | null;
  onSetVideoUrl: (url: string) => Result | Promise<Result>;
  onRemoveVideo: () => Result | Promise<Result>;
  onCleanAudio: (sourcePath: string | null, mode: AudioMode, removeSource: boolean) => CleanResult | Promise<CleanResult>;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl);
  const [checking, setChecking] = useState(false);
  const [ready, setReady] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Por defecto se saca el ruido: el coach pidió que ningún video quede
  // subido con ruido salvo que elija lo contrario.
  const [audioMode, setAudioMode] = useState<AudioMode>("ruido");
  const [step, setStep] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function reset() {
    setReady(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleFileChange() {
    const file = inputRef.current?.files?.[0];
    setError(null);
    setReady(false);
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setError("Elegí un archivo de video.");
      reset();
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setError("El archivo pesa demasiado (máximo 15MB).");
      reset();
      return;
    }

    const videoEl = videoRef.current;
    if (!videoEl) return;

    setChecking(true);
    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      videoEl.removeEventListener("loadedmetadata", onLoaded);
      videoEl.removeEventListener("error", onError);
    };

    const onLoaded = () => {
      const duration = videoEl.duration;
      cleanup();
      setChecking(false);
      if (!isFinite(duration) || duration > MAX_SECONDS + 0.5) {
        const dur = isFinite(duration) ? `${Math.round(duration)}s` : "más de lo permitido";
        setError(`Ese video dura ${dur} — tiene que durar ${MAX_SECONDS} segundos o menos.`);
        reset();
      } else {
        setReady(true);
      }
    };

    const onError = () => {
      cleanup();
      setChecking(false);
      setError("No pudimos leer ese archivo de video.");
      reset();
    };

    videoEl.addEventListener("loadedmetadata", onLoaded);
    videoEl.addEventListener("error", onError);
    videoEl.src = objectUrl;
  }

  function withTimeout<T>(p: Promise<T>, ms: number = UPLOAD_TIMEOUT_MS): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("timeout")), ms);
    });
    return Promise.race([p, timeout]);
  }

  function upload() {
    const file = inputRef.current?.files?.[0];
    if (!file || !ready) return;
    setError(null);
    setNotice(null);
    const mode = audioMode;

    startTransition(async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) {
          setError("Tu sesión expiró — recargá la página e iniciá sesión de nuevo.");
          return;
        }

        const ext = VIDEO_MIME_EXT[file.type] ?? file.name.split(".").pop() ?? "mp4";
        const path = `${userId}/${exerciseId}-${Date.now()}.${ext}`;

        setStep("Subiendo…");
        const { error: uploadError } = await withTimeout(
          supabase.storage.from(VIDEO_BUCKET).upload(path, file, { contentType: file.type || "video/mp4", upsert: true })
        );
        if (uploadError) {
          setError(`No se pudo subir el video: ${uploadError.message}`);
          return;
        }

        let finalUrl = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(path).data.publicUrl;

        if (mode !== "original") {
          // El servidor limpia el sonido, guarda la copia limpia y borra el
          // original — así nunca queda guardado el video con ruido.
          setStep(mode === "mudo" ? "Quitando el sonido…" : "Quitando el ruido…");
          const cleaned = await withTimeout(Promise.resolve(onCleanAudio(path, mode, true)), CLEAN_TIMEOUT_MS);
          if (!cleaned.ok || !cleaned.url) {
            await supabase.storage.from(VIDEO_BUCKET).remove([path]).catch(() => {});
            setError(cleaned.error || "No se pudo limpiar el sonido del video. Probá de nuevo.");
            return;
          }
          finalUrl = cleaned.url;
        }

        // Al servidor ya sólo va el link (unos bytes) — no el archivo.
        setStep("Guardando…");
        const result = await withTimeout(Promise.resolve(onSetVideoUrl(finalUrl)));
        if (!result.ok) {
          setError(result.error || "No se pudo guardar el video");
          return;
        }

        setVideoUrl(finalUrl);
        setNotice(
          mode === "ruido" ? "Video subido sin ruido de fondo." : mode === "mudo" ? "Video subido sin sonido." : "Video subido."
        );
        reset();
        // Sincroniza el resto de la página (el campo para pegar un link
        // externo también muestra video_url) sin la navegación completa
        // que hacía antes el redirect() — misma pantalla, sin salir.
        router.refresh();
      } catch {
        setError("No se pudo subir el video — probá de nuevo.");
      } finally {
        setStep(null);
      }
    });
  }

  // Para videos que ya estaban subidos antes de esta opción.
  function cleanCurrent(mode: Exclude<AudioMode, "original">) {
    const msg =
      mode === "mudo"
        ? "¿Quitarle todo el sonido al video actual? No se puede deshacer."
        : "¿Quitarle el ruido de fondo al video actual? No se puede deshacer.";
    if (!confirm(msg)) return;
    setError(null);
    setNotice(null);

    startTransition(async () => {
      try {
        setStep(mode === "mudo" ? "Quitando el sonido…" : "Quitando el ruido…");
        const cleaned = await withTimeout(Promise.resolve(onCleanAudio(null, mode, false)), CLEAN_TIMEOUT_MS);
        if (!cleaned.ok || !cleaned.url) {
          setError(cleaned.error || "No se pudo limpiar el sonido del video. Probá de nuevo.");
          return;
        }
        setStep("Guardando…");
        const result = await withTimeout(Promise.resolve(onSetVideoUrl(cleaned.url)));
        if (!result.ok) {
          setError(result.error || "No se pudo guardar el video");
          return;
        }
        setVideoUrl(cleaned.url);
        setNotice(mode === "mudo" ? "Listo: el video quedó sin sonido." : "Listo: el video quedó sin ruido de fondo.");
        router.refresh();
      } catch {
        setError("No se pudo limpiar el sonido — probá de nuevo.");
      } finally {
        setStep(null);
      }
    });
  }

  const isOwnVideo = storagePathFromUrl(videoUrl) !== null;

  function remove() {
    if (!confirm("¿Quitar el video de este ejercicio?")) return;
    setError(null);

    startTransition(async () => {
      try {
        const result = await withTimeout(Promise.resolve(onRemoveVideo()));
        if (!result.ok) {
          setError(result.error || "No se pudo quitar el video");
          return;
        }
        setVideoUrl(null);
        router.refresh();
      } catch {
        setError("No se pudo quitar el video — probá de nuevo.");
      }
    });
  }

  return (
    <div className="card card-pad" style={{ marginBottom: 20 }}>
      <div className="section-h" style={{ marginTop: 0 }}>
        <h3>Video demostrativo</h3>
      </div>

      {videoUrl && (
        <div style={{ marginBottom: 14 }}>
          <ExerciseVideo url={videoUrl} label="Vista previa" />
        </div>
      )}

      <video ref={videoRef} style={{ display: "none" }} muted />

      <p style={{ fontSize: 12, color: "var(--text-faint)", margin: "0 0 10px" }}>
        Subí un clip corto tuyo haciendo el ejercicio (máximo 15 segundos) — se guarda en la app, no hace falta
        subirlo a YouTube.
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/ogg"
          onChange={handleFileChange}
          style={{ maxWidth: 260 }}
        />
        <button type="button" className="btn sm" disabled={!ready || checking || isPending} onClick={upload}>
          {isPending ? (step ?? "Subiendo…") : checking ? "Revisando…" : "Subir video"}
        </button>
      </div>

      <fieldset style={{ border: "none", padding: 0, margin: "12px 0 0" }} disabled={isPending}>
        <legend className="field-label" style={{ marginBottom: 6 }}>
          Sonido del video
        </legend>
        {AUDIO_MODES.map((m) => (
          <label key={m.value} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, padding: "4px 0", cursor: "pointer" }}>
            <input
              type="radio"
              name="audio-mode"
              value={m.value}
              checked={audioMode === m.value}
              onChange={() => setAudioMode(m.value)}
              style={{ marginTop: 3 }}
            />
            <span>
              {m.label}
              <span style={{ display: "block", fontSize: 11.5, color: "var(--text-faint)" }}>{m.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {isPending && step && <div style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 8 }}>{step} Esto puede tardar unos segundos.</div>}
      {error && <div style={{ color: "var(--danger)", fontSize: 11.5, marginTop: 6 }}>{error}</div>}
      {notice && !error && <div style={{ color: "var(--ok)", fontSize: 13.5, marginTop: 6 }}>{notice}</div>}

      {videoUrl && isOwnVideo && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
          <div className="field-label" style={{ marginBottom: 6 }}>
            Limpiar el video que ya está subido
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn sm" disabled={isPending} onClick={() => cleanCurrent("ruido")}>
              Quitar ruido de fondo
            </button>
            <button type="button" className="btn sm" disabled={isPending} onClick={() => cleanCurrent("mudo")}>
              Quitar todo el sonido
            </button>
          </div>
        </div>
      )}

      {videoUrl && (
        <button
          type="button"
          className="btn ghost sm"
          style={{ color: "var(--danger)", marginTop: 12 }}
          onClick={remove}
          disabled={isPending}
        >
          Quitar video
        </button>
      )}
    </div>
  );
}
