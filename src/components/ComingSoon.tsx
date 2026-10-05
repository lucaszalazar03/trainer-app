export default function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <div className="content-head">
        <div>
          <h1>{title}</h1>
        </div>
      </div>
      <div className="empty" style={{ maxWidth: 480, textAlign: "center" }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--accent)",
            marginBottom: 10,
          }}
        >
          Próximamente
        </div>
        <p style={{ color: "var(--text-dim)", lineHeight: 1.6 }}>{description}</p>
      </div>
    </div>
  );
}
