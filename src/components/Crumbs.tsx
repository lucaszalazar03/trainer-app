import Link from "next/link";
import { Icon } from "./Icon";

export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <div className="crumbs">
      {items.map((it, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {it.href ? <Link href={it.href}>{it.label}</Link> : <span className="cur">{it.label}</span>}
          {i < items.length - 1 && <Icon name="chevronRight" size={13} />}
        </span>
      ))}
    </div>
  );
}
