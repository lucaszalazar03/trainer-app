// Constantes del video demostrativo que sube el coach (no las de YouTube/
// Vimeo/etc, que sólo pasan por toVideoEmbed). Compartidas entre el
// componente cliente que sube el archivo directo a Supabase Storage
// (ExerciseVideoCard) y la Server Action que después guarda el link
// (biblioteca/actions.ts) — ver el comentario grande ahí sobre por qué el
// archivo ya no pasa por el servidor.
export const VIDEO_BUCKET = "exercise-videos";
export const VIDEO_MIME_EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/ogg": "ogv",
};
export const MAX_VIDEO_BYTES = 15 * 1024 * 1024; // 15MB — de sobra para un clip de ~10s

export type VideoEmbed =
  | { kind: "iframe"; src: string }
  | { kind: "file"; src: string }
  | { kind: "link"; src: string };

/**
 * Convierte una URL de video "cualquiera" (YouTube, Vimeo, o un archivo
 * directo) en algo que se pueda insertar en la página. Si no reconoce el
 * formato, cae en un simple link que abre en pestaña nueva — sirve por
 * ejemplo para links de Google Drive o Instagram.
 */
export function toVideoEmbed(url: string): VideoEmbed {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname === "/watch" && u.searchParams.get("v")) {
        return { kind: "iframe", src: `https://www.youtube.com/embed/${u.searchParams.get("v")}` };
      }
      const shorts = u.pathname.match(/^\/shorts\/([^/]+)/);
      if (shorts) return { kind: "iframe", src: `https://www.youtube.com/embed/${shorts[1]}` };
      const embed = u.pathname.match(/^\/embed\/([^/]+)/);
      if (embed) return { kind: "iframe", src: url };
    }

    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "");
      if (id) return { kind: "iframe", src: `https://www.youtube.com/embed/${id}` };
    }

    if (host === "vimeo.com") {
      const id = u.pathname.match(/^\/(\d+)/)?.[1];
      if (id) return { kind: "iframe", src: `https://player.vimeo.com/video/${id}` };
    }

    if (host === "player.vimeo.com") {
      return { kind: "iframe", src: url };
    }

    if (/\.(mp4|webm|ogg|mov)$/i.test(u.pathname)) {
      return { kind: "file", src: url };
    }
  } catch {
    // URL inválida — la tratamos como link crudo abajo.
  }

  return { kind: "link", src: url };
}
