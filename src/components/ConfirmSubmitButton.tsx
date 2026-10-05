"use client";

import { useFormStatus } from "react-dom";

export function ConfirmSubmitButton({
  children,
  confirmMessage,
  className,
  style,
}: {
  children: React.ReactNode;
  confirmMessage: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={`${className ?? ""}${pending ? " is-pending" : ""}`.trim()}
      disabled={pending}
      onClick={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault();
      }}
      style={style}
    >
      {children}
    </button>
  );
}
