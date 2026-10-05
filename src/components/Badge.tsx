export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "green" | "blue" | "warn" | "neutral" | "danger";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
