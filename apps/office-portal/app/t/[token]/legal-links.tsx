const linkStyle = { color: "inherit", textDecoration: "underline", textUnderlineOffset: 2 };

export function LegalLinks() {
  return (
    <div style={{ marginTop: 10, fontSize: 12, color: "#9a9a9a", textAlign: "center" }}>
      <a href="https://gepeto.delivery/privacy" target="_blank" rel="noreferrer" style={linkStyle}>Privacy</a>
      {" · "}
      <a href="https://gepeto.delivery/terms" target="_blank" rel="noreferrer" style={linkStyle}>Terms</a>
    </div>
  );
}
