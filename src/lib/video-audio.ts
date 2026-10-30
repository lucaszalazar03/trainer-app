import { spawn } from "node:child_process";
import { promises as fs, constants as fsc } from "node:fs";
import os from "node:os";
import path from "node:path";
import ffmpegStatic from "ffmpeg-static";
import type { AudioMode } from "./video";

/**
 * Limpia el sonido de un video corto con ffmpeg (paquete ffmpeg-static, que
 * trae el programa ya compilado para el servidor de Vercel).
 *
 * El video NO se vuelve a codificar (-c:v copy): sólo se toca el audio, así
 * que tarda menos de un segundo y la imagen queda idéntica.
 *
 * Filtro de "ruido" (probado con ruido real + tono): highpass/lowpass sacan
 * zumbidos graves y siseo agudo; afftdn (reducción de ruido por FFT, con
 * seguimiento del ruido a lo largo del clip) baja ~20 dB el ruido de fondo y
 * deja la señal principal casi igual (~1 dB).
 */
const DENOISE = "highpass=f=80,lowpass=f=12000,afftdn=nr=40:nf=-28:tn=1";

const AUDIO_CODEC: Record<string, string[]> = {
  webm: ["-c:a", "libopus", "-b:a", "96k"],
  ogv: ["-c:a", "libvorbis", "-q:a", "5"],
};

async function ffmpegPath(): Promise<string> {
  const bin = ffmpegStatic as unknown as string | null;
  if (!bin) throw new Error("ffmpeg no está disponible en este servidor.");
  try {
    await fs.access(bin, fsc.X_OK);
    return bin;
  } catch {
    // En algunos despliegues el archivo llega sin permiso de ejecución:
    // lo copiamos a /tmp y se lo damos.
    const tmpBin = path.join(os.tmpdir(), "ffmpeg-bin");
    try {
      await fs.access(tmpBin, fsc.X_OK);
    } catch {
      await fs.copyFile(bin, tmpBin);
      await fs.chmod(tmpBin, 0o755);
    }
    return tmpBin;
  }
}

function run(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    p.stderr.on("data", (d) => {
      stderr = (stderr + d.toString()).slice(-2000);
    });
    const timer = setTimeout(() => p.kill("SIGKILL"), 50_000);
    p.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    p.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg terminó con código ${code}: ${stderr.trim().split("\n").pop() ?? ""}`));
    });
  });
}

export async function cleanVideoAudio(input: Buffer, ext: string, mode: Exclude<AudioMode, "original">): Promise<Buffer> {
  const safeExt = /^[a-z0-9]{2,4}$/i.test(ext) ? ext.toLowerCase() : "mp4";
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "video-audio-"));
  const inFile = path.join(dir, `in.${safeExt}`);
  const outFile = path.join(dir, `out.${safeExt}`);
  try {
    await fs.writeFile(inFile, input);
    const bin = await ffmpegPath();
    const mp4Like = safeExt === "mp4" || safeExt === "mov";
    const args = ["-y", "-hide_banner", "-loglevel", "error", "-i", inFile, "-map", "0:v:0", "-c:v", "copy"];
    if (mode === "mudo") {
      args.push("-an");
    } else {
      args.push("-map", "0:a:0?", "-af", DENOISE, ...(AUDIO_CODEC[safeExt] ?? ["-c:a", "aac", "-b:a", "128k"]));
    }
    if (mp4Like) args.push("-movflags", "+faststart");
    args.push(outFile);
    await run(bin, args);
    return await fs.readFile(outFile);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
