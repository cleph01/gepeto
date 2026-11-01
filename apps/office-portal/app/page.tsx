export default function HomePage() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#F8F9FB",
      fontFamily: "system-ui, -apple-system, sans-serif",
      padding: 24,
    }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{
          width: 56, height: 56, background: "#fff", borderRadius: 13, padding: 5, boxSizing: "border-box",
          border: "1px solid rgba(0,0,0,0.08)", margin: "0 auto 20px",
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/gepeto-icon.png" alt="Gepeto" style={{ width: "100%", height: "100%" }} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "#1a1a1a", margin: "0 0 10px", letterSpacing: "-0.02em" }}>
          Gepeto Delivery Tracker
        </h1>
        <p style={{ fontSize: 14, color: "#5F5E5A", margin: "0 0 24px", lineHeight: 1.6 }}>
          To track your deliveries, use the personalized link provided by your dental lab.
        </p>
        <div style={{
          background: "#EBF2FA",
          border: "1px solid rgba(24,95,165,0.15)",
          borderRadius: 8,
          padding: "10px 16px",
          fontSize: 13,
          color: "#185FA5",
        }}>
          Your link looks like: <strong>track.gepeto.com/t/…</strong>
        </div>
      </div>
    </div>
  );
}
