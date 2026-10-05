"use client";

import { useRef, useState } from "react";

/**
 * Input de archivo para subir un clip propio como video demostrativo.
 * Antes de dejar enviar el formulario, carga el archivo en un <video>
 * oculto para leer su duración real y rechazarlo si se pasa del límite —
 * así no hace falta subirlo (y gastar tiempo/datos) para darse cuenta.
 */
export function VideoUploadField({
  action,
  maxSeconds = 15,
}: {
  action: (formData: FormData) => void;
  maxSeconds?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
    if (file.size > 15 * 1024 * 1024) {
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
      if (!isFinite(duration) || duration > maxSeconds + 0.5) {
        const dur = isFinite(duration) ? `${Math.round(duration)}s` : "más de lo permitido";
        setError(`Ese video dura ${dur} — tiene que durar ${maxSeconds} segundos o menos.`);
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

  return (
    <div>
      <video ref={videoRef} style={{ display: "none" }} muted />
      <form
        action={action}
        onSubmit={() => setSubmitting(true)}
        style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
      >
        <input
          ref={inputRef}
          type="file"
          name="video_file"
          accept="video/mp4,video/webm,video/quicktime,video/ogg"
          onChange={handleFileChange}
          style={{ maxWidth: 260 }}
        />
        <button type="submit" className="btn sm" disabled={!ready || checking || submitting}>
          {submitting ? "Subiendo…" : checking ? "Revisando…" : "Subir video"}
        </button>
      </form>
      {error && <div style={{ color: "var(--danger)", fontSize: 11.5, marginTop: 6 }}>{error}</div>}
    </div>
  );
}
