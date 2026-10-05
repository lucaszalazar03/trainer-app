"use client";

import { useFormStatus } from "react-dom";

/**
 * Botón de submit que se deshabilita solo mientras el Server Action está
 * en vuelo. Sin esto, un click no muestra ningún cambio hasta que la
 * respuesta vuelve del servidor — en una red lenta eso hace que la gente
 * vuelva a tocar el botón (o lo toque varias veces) pensando que no pasó
 * nada, lo que puede terminar disparando la acción más de una vez.
 *
 * Tiene que renderizarse DENTRO del <form> cuya acción quiere reflejar —
 * useFormStatus lee el estado del form ancestro más cercano, no de un
 * atributo `form="algún-id"` apuntando a otro lado.
 */
export function SubmitButton({
  children,
  className = "",
  style,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={`${className}${pending ? " is-pending" : ""}`.trim()}
      style={style}
      disabled={Boolean(disabled) || pending}
      {...rest}
    >
      {children}
    </button>
  );
}
