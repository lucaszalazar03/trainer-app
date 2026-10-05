import { DIAS } from "./constants";

/**
 * Todo "qué día es hoy" / "qué semana es esta" tiene que calcularse en
 * huso horario argentino, no en el huso del servidor. La app corre en
 * Vercel, que ejecuta los Server Components/Actions en UTC — un simple
 * `new Date()` + `getDay()`/`getDate()`/`setHours(0,0,0,0)` piensa que el
 * día ya cambió hasta 3 horas antes de que en Argentina sea medianoche.
 * Esa ventana (21hs a 00hs en Argentina) es exactamente cuando la app
 * mostraba el día siguiente (por eso podía marcar "sábado" siendo todavía
 * viernes a la noche acá). Todo lo que necesite saber "hoy" en el
 * calendario del coach/alumno tiene que pasar por acá, nunca por
 * new Date().getDay()/getDate() directo.
 */
export const TIMEZONE = "America/Argentina/Buenos_Aires";

const WEEKDAY_SHORT_TO_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

type FechaArgentina = { year: number; month: number; day: number; diaIndex: number };

// Año/mes/día (y el índice de día 0=lunes…6=domingo, mismo orden que
// DIAS) de un instante dado, tal como se ven en Argentina — sin importar
// en qué huso corre el proceso que llama a esto.
function fechaEnArgentina(instante: Date): FechaArgentina {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    })
      .formatToParts(instante)
      .map((p) => [p.type, p.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    diaIndex: WEEKDAY_SHORT_TO_INDEX[parts.weekday],
  };
}

// Año/mes/día en Argentina → instante real (Date/UTC) que representa la
// medianoche de ese día ahí. Argentina es UTC-3 fijo (sin horario de
// verano desde 2009), así que medianoche ART = 03:00 UTC del mismo día
// calendario — por eso .getUTCFullYear()/.getUTCMonth()/.getUTCDate() de
// lo que devuelve esta función (o de cualquier instante derivado sumando
// días completos) siempre coinciden con el año/mes/día argentino.
function medianocheArgentina(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
}

/** Nombre del día de hoy en Argentina — "Lunes".."Domingo", tal como en DIAS. */
export function nombreDiaHoy(): (typeof DIAS)[number] {
  return DIAS[fechaEnArgentina(new Date()).diaIndex];
}

/** Día del mes de hoy en Argentina (1-31). */
export function diaDelMesHoy(): number {
  return fechaEnArgentina(new Date()).day;
}

/** Medianoche de hoy en Argentina, como instante real — para comparar
 * contra timestamps de la base con `.gte(...)` en vez de armar la
 * comparación a mano con el huso del servidor. */
export function inicioDeHoyArgentina(): Date {
  const { year, month, day } = fechaEnArgentina(new Date());
  return medianocheArgentina(year, month, day);
}

/** Lunes (medianoche) de la semana argentina que contiene `instante` —
 * por defecto, la semana de hoy. Sirve tanto para "el lunes de esta
 * semana" como para agrupar fechas pasadas (por ej. entrenamientos) por
 * semana, sin depender del huso del servidor. */
export function inicioDeSemanaArgentina(instante: Date = new Date()): Date {
  const { year, month, day, diaIndex } = fechaEnArgentina(instante);
  const medianoche = medianocheArgentina(year, month, day);
  // Restar exactamente diaIndex días en milisegundos: como Argentina no
  // tiene horario de verano, 24hs siempre es un día calendario ahí
  // también, así que esto no se corre nunca de la medianoche real.
  return new Date(medianoche.getTime() - diaIndex * 86400000);
}
