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
          width: 48, height: 48, background: "#185FA5", borderRadius: 12,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px",
        }}>
          <svg width="26" height="26" viewBox="0 0 18 18" fill="none">
            <path d="M9 2C7.2 2 5.5 2.9 4.5 4.3c-.7 1-1 2.1-.8 3.3l1 5.8c.2 1 1 1.6 1.9 1.6.8 0 1.5-.5 1.8-1.2L9 11.5l1.6 2.3c.3.7 1 1.2 1.8 1.2.9 0 1.7-.6 1.9-1.6l1-5.8c.2-1.2-.1-2.3-.8-3.3C13.5 2.9 11.8 2 10 2H9z" fill="white" />
          </svg>
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
