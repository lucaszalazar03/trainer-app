import { Icon } from "./Icon";
import { toVideoEmbed } from "@/lib/video";

/**
 * Link/desplegable "Ver video" para el video demostrativo de un ejercicio.
 * No devuelve nada si el ejercicio no tiene video cargado.
 *
 * En modo "compact" se muestra como un botón redondo con sólo el ícono
 * (para meter al lado del nombre de un ejercicio sin ocupar espacio);
 * si no, es un link con texto ("Ver video").
 */
export function ExerciseVideo({
  url,
  label = "Ver video",
  compact = false,
}: {
  url: string | null | undefined;
  label?: string;
  compact?: boolean;
}) {
  if (!url) return null;

  const embed = toVideoEmbed(url);
  const triggerClassName = compact ? "video-btn" : "link-btn";

  if (embed.kind === "link") {
    return (
      <a href={embed.src} target="_blank" rel="noopener noreferrer" className={triggerClassName} title={label}>
        <Icon name="play" size={compact ? 13 : 12} />
        {!compact && label}
      </a>
    );
  }

  return (
    <details className={compact ? undefined : "ex-video"} style={compact ? { flex: "0 0 auto" } : undefined}>
      <summary className={triggerClassName} style={{ cursor: "pointer", listStyle: "none" }} title={label}>
        <Icon name="play" size={compact ? 13 : 12} />
        {!compact && label}
      </summary>
      <div className="ex-video-frame">
        {embed.kind === "iframe" ? (
          <iframe src={embed.src} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen loading="lazy" />
        ) : (
          <video src={embed.src} controls />
        )}
      </div>
    </details>
  );
}
