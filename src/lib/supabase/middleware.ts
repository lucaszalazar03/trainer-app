import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresca la sesión de Supabase en cada request y protege las rutas privadas.
 * Sin esto, los tokens de sesión expiran y el usuario queda "colgado" logueado
 * en el cliente pero deslogueado en el servidor.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims() verifica el JWT localmente (WebCrypto) contra las claves
  // públicas del proyecto en vez de pedirle al servidor de Supabase que lo
  // valide en cada request como hace getUser() — evita un viaje de red de
  // más en el Proxy de Next, que corre en TODA navegación (incluidas las
  // prefetcheadas). Sigue refrescando la sesión sola si el token está por
  // vencer. Requiere que el proyecto firme sus JWT con clave asimétrica
  // (el default actual de Supabase) — confirmado para este proyecto.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const path = request.nextUrl.pathname;

  // Link de confirmación de mail: si Supabase devuelve al alumno a cualquier
  // URL del sitio (por ej. la raíz) con ?code= o ?token_hash=, lo pasamos
  // por /auth/callback para abrirle la sesión.
  const sp = request.nextUrl.searchParams;
  if (!path.startsWith("/auth/") && (sp.has("code") || sp.has("token_hash"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }
  // /bienvenida es la pantalla pública de "bajate la app" — se comparte
  // como link, así que tiene que quedar accesible sin login igual que
  // /login y /auth.
  const isPublicRoute = path.startsWith("/login") || path.startsWith("/auth") || path.startsWith("/bienvenida");

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    // La raíz del sitio (el link que se comparte para descargar la app) va a
    // la bienvenida; cualquier otro link protegido (por ejemplo uno viejo a
    // una sesión puntual) sigue yendo directo a /login como antes.
    url.pathname = path === "/" ? "/bienvenida" : "/login";
    return NextResponse.redirect(url);
  }

  // Si venimos con "?error=" es que "/" ya intentó resolver el rol de este
  // usuario y no encontró cuenta (coach ni alumno) — mandarlo de nuevo a "/"
  // dispara el mismo error otra vez y entra en loop infinito de redirects.
  // Dejamos que el login se muestre con el mensaje en vez de rebotarlo.
  if (user && path === "/login" && !request.nextUrl.searchParams.has("error")) {
    // "/" resuelve a /dashboard (coach) o /alumno (alumno) según corresponda.
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
