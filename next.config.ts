import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Por default los Server Actions sólo aceptan 1MB — subir un video
      // corto (aunque sea de pocos segundos) necesita más margen.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
