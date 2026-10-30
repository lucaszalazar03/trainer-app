/**
 * La semana del alumno dibujada como una barra olímpica: cada sesión es un
 * disco en cada lado, cargado si ya se hizo y sólo marcado si falta. Los
 * discos van del más pesado al más liviano, como se carga una barra real.
 *
 * `decorative` la usa la pantalla de ingreso, donde es sólo la marca de la
 * app y no representa datos de nadie.
 */
export function WeekBar({ done, total, decorative = false }: { done: number; total: number; decorative?: boolean }) {
  const plates = Array.from({ length: total }, (_, i) => {
    const cargado = i < done;
    return `wb-plate s${i % 5}${cargado ? "" : " free"}${!decorative && cargado && i === done - 1 ? " last" : ""}`;
  });

  const lado = (side: "left" | "right") => (
    <div className={`wb-side ${side}`}>
      <span className="wb-collar" />
      {plates.map((clase, i) => (
        <span key={i} className={clase} />
      ))}
    </div>
  );

  return (
    <div
      className="week-bar"
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": `${done} de ${total} sesiones hechas esta semana` })}
    >
      {lado("left")}
      <span />
      {lado("right")}
    </div>
  );
}
