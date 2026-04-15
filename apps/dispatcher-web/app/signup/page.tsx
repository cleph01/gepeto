"use client";

import { useState } from "react";
import Link from "next/link";

export default function SignupPage() {
  const [labName, setLabName]   = useState("");
  const [email, setEmail]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labName: labName.trim(), email: email.trim() }),
    });

    const data = await res.json();

    if (!res.ok || !data.url) {
      setError(data.error?.message ?? "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    // Redirect to Stripe Checkout (hosted page)
    window.location.href = data.url;
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 11px",
    fontSize: 13.5,
    border: "1px solid rgba(0,0,0,0.14)",
    borderRadius: 8,
    outline: "none",
    color: "#1a1a1a",
    background: "#fff",
    boxSizing: "border-box",
  };

  const focusInput = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "#185FA5";
    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(24,95,165,0.10)";
  };
  const blurInput = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "rgba(0,0,0,0.14)";
    e.currentTarget.style.boxShadow = "none";
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F8F9FB", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", width: "100%", maxWidth: 420, overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "28px 28px 22px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, background: "#185FA5", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
              <path d="M9 2C7.2 2 5.5 2.9 4.5 4.3c-.7 1-1 2.1-.8 3.3l1 5.8c.2 1 1 1.6 1.9 1.6.8 0 1.5-.5 1.8-1.2L9 11.5l1.6 2.3c.3.7 1 1.2 1.8 1.2.9 0 1.7-.6 1.9-1.6l1-5.8c.2-1.2-.1-2.3-.8-3.3C13.5 2.9 11.8 2 10 2H9z" fill="white" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em" }}>Gepeto</div>
            <div style={{ fontSize: 11.5, color: "#5F5E5A" }}>Start your free trial</div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "24px 28px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ margin: "0 0 4px", fontSize: 13, color: "#5F5E5A", lineHeight: 1.5 }}>
            Set up your lab in 2 minutes. No credit card required during your 14-day trial.
          </p>

          {error && (
            <div style={{ background: "rgba(163,45,45,0.07)", border: "1px solid rgba(163,45,45,0.2)", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#A32D2D" }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#3a3a3a", display: "block", marginBottom: 5 }}>
              Lab Name
            </label>
            <input
              type="text"
              value={labName}
              onChange={(e) => setLabName(e.target.value)}
              placeholder="Acme Dental Lab"
              required
              style={inputStyle}
              onFocus={focusInput}
              onBlur={blurInput}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#3a3a3a", display: "block", marginBottom: 5 }}>
              Work Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourlabname.com"
              required
              style={inputStyle}
              onFocus={focusInput}
              onBlur={blurInput}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ marginTop: 4, background: loading ? "#5F8FBF" : "#185FA5", color: "white", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", letterSpacing: "-0.01em" }}
          >
            {loading ? "Redirecting to payment…" : "Start Free Trial →"}
          </button>

          <p style={{ margin: 0, textAlign: "center", fontSize: 12.5, color: "#9a9a9a" }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "#185FA5", textDecoration: "none", fontWeight: 500 }}>
              Log in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
