import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // manifest.webmanifest y sw.js son assets públicos que el navegador
    // pide para instalar la PWA y registrar el service worker — tienen que
    // responder siempre, esté o no logueado quien los pide.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
