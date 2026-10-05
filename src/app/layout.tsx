import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Work_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";
import { SplashScreen } from "@/components/SplashScreen";
import { InstallPrompt } from "@/components/InstallPrompt";

// next/font descarga y self-hostea las fuentes en build time (en vez de
// pedirlas a Google Fonts en cada visita) y las sirve desde el mismo
// dominio, precargadas y sin bloquear el render — más rápido que el
// <link rel="stylesheet"> anterior, sobre todo en 4G/celular.
//
// Identidad nueva (aprobada): Big Shoulders Display en títulos en vez de
// Oswald, Work Sans en vez de IBM Plex Sans para el texto — se mantiene
// IBM Plex Mono para los datos (pesos, series, horarios).
const bigShouldersDisplay = Big_Shoulders({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-display-nf",
  display: "swap",
});
const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body-nf",
  display: "swap",
});
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-mono-nf",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Z-Performance",
  description: "Strength and conditioning.",
  // El manifest es lo que le falta a Android/Chrome para considerar la app
  // instalable (junto con el service worker, que ya se registra en
  // RegisterServiceWorker) — sin esto, Chrome nunca dispara el evento
  // "beforeinstallprompt" que usa InstallPrompt más abajo. iOS no usa el
  // manifest para esto — Safari se guía por las etiquetas apple-* de acá
  // abajo, que ya estaban.
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    // Este es el nombre que Safari pone debajo del ícono al hacer
    // "Agregar a inicio" — Android usa manifest.json (short_name) para lo
    // mismo. "Z-Performance" no entraba entero debajo del ícono y Android
    // lo cortaba a "Z-Perfor…"; con "ZP" queda corto y legible en ambos.
    title: "ZP",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d0d0d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${bigShouldersDisplay.variable} ${workSans.variable} ${ibmPlexMono.variable}`}>
      <head>
        {/*
          El campo appleWebApp.capable de Next sólo emite la etiqueta
          estándar "mobile-web-app-capable" — Safari en iPhone todavía
          exige específicamente la variante con prefijo "apple-" para
          abrir en modo standalone (pantalla completa) en vez de abrir
          Safari. Sin esta línea, "Agregar a inicio" crea un simple
          acceso directo que abre el navegador.
        */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <SplashScreen />
        <RegisterServiceWorker />
        {/*
          En el layout raíz (no en AlumnoShell/CoachShell) para que aparezca
          también en /login, antes de iniciar sesión — ahí es donde más
          sentido tiene ofrecerle al alumno instalar la app.
        */}
        <InstallPrompt />
        {children}
      </body>
    </html>
  );
}
