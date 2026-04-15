import Link from "next/link";

export default function SignupSuccessPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#F8F9FB", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", width: "100%", maxWidth: 420, padding: "44px 32px 40px", textAlign: "center" }}>

        {/* Check icon */}
        <div style={{ width: 60, height: 60, background: "#EDFAF2", border: "1px solid #B2DFCA", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 22px" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="11" stroke="#22C55E" strokeWidth="1.5" />
            <path d="M7.5 12l3 3 6-6" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", margin: "0 0 10px", letterSpacing: "-0.02em" }}>
          You&apos;re almost in!
        </h1>

        <p style={{ fontSize: 14, color: "#5F5E5A", lineHeight: 1.65, margin: "0 0 10px" }}>
          Your lab is being set up. Check your email for an invite link to set your password and access your dashboard.
        </p>

        <p style={{ fontSize: 12.5, color: "#9a9a9a", margin: "0 0 30px", lineHeight: 1.5 }}>
          Didn&apos;t receive an email? Check your spam folder or{" "}
          <a href="mailto:hello@gepeto.com" style={{ color: "#185FA5", textDecoration: "none" }}>
            contact support
          </a>
          .
        </p>

        <Link
          href="/login"
          style={{ display: "inline-block", background: "#185FA5", color: "white", borderRadius: 8, padding: "10px 28px", fontSize: 14, fontWeight: 600, textDecoration: "none", letterSpacing: "-0.01em" }}
        >
          Go to Login
        </Link>
      </div>
    </div>
  );
}
