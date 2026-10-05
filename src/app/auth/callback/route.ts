import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Adonde llega el alumno al tocar el link de confirmación del mail.
 *
 * - Si el link trae `code` (flujo PKCE) o `token_hash`, intentamos abrirle
 *   la sesión directamente y lo mandamos a "/" (que resuelve /alumno).
 * - Si no se puede abrir la sesión (por ejemplo, abrió el mail en otro
 *   dispositivo que el que usó para registrarse), el mail YA quedó
 *   confirmado igual: lo mandamos a ingresar con un aviso de "mail confirmado".
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const errorDescription = url.searchParams.get("error_description");

  const to = (path: string) => {
    const dest = url.clone();
    dest.search = "";
    const [pathname, query] = path.split("?");
    dest.pathname = pathname;
    if (query) dest.search = `?${query}`;
    return NextResponse.redirect(dest);
  };

  if (errorDescription) {
    return to(`/login?error=${encodeURIComponent(
      "El link de confirmación no es válido o ya venció. Probá ingresar; si no podés, registrate de nuevo."
    )}`);
  }

  const supabase = await createClient();
  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return to("/");
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (!error) return to("/");
    }
  } catch {
    // seguimos al login con el aviso
  }

  return to("/login?confirmed=1");
}
