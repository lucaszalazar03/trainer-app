import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg-static trae el programa ffmpeg (para limpiar el sonido de los
  // videos, ver src/lib/video-audio.ts). No se empaqueta: se usa desde
  // node_modules, y hay que incluir el binario a mano en la función de la
  // página del ejercicio para que llegue a Vercel.
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/biblioteca/[id]": ["./node_modules/ffmpeg-static/ffmpeg"],
  },
  experimental: {
    serverActions: {
      // Por default los Server Actions sólo aceptan 1MB — subir un video
      // corto (aunque sea de pocos segundos) necesita más margen.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
