"use client";

import { LegalLinks } from "@/components/legal-links";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]     = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    const { error } = await res.json();
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "#F8F9FB",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          width: "100%",
          maxWidth: 380,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "28px 28px 22px",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              background: "#fff",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 11,
              padding: 5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/gepeto-icon.png" alt="Gepeto" style={{ width: "100%", height: "100%" }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em" }}>
              Gepeto
            </div>
            <div style={{ fontSize: 11.5, color: "#5F5E5A" }}>Reset password</div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "24px 28px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
          {sent ? (
            <>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 500, color: "#3B6D11" }}>
                Check your email
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "#5F5E5A", lineHeight: 1.5 }}>
                We sent a password reset link to <strong style={{ color: "#1a1a1a" }}>{email}</strong>.
                Click the link in the email to set a new password.
              </p>
              <a
                href="/login"
                style={{
                  marginTop: 4,
                  display: "block",
                  textAlign: "center",
                  background: "#185FA5",
                  color: "white",
                  borderRadius: 8,
                  padding: "10px",
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                  letterSpacing: "-0.01em",
                }}
              >
                Back to Login
              </a>
            </>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ margin: "0 0 4px", fontSize: 13, color: "#5F5E5A" }}>
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>

              {error && (
                <div
                  style={{
                    background: "rgba(163,45,45,0.07)",
                    border: "1px solid rgba(163,45,45,0.2)",
                    borderRadius: 8,
                    padding: "9px 12px",
                    fontSize: 13,
                    color: "#A32D2D",
                  }}
                >
                  {error}
                </div>
              )}

              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#3a3a3a", display: "block", marginBottom: 5 }}>
                  Email
                </label>
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  style={{
                    width: "100%", padding: "8px 11px", fontSize: 13.5,
                    border: "1px solid rgba(0,0,0,0.14)", borderRadius: 8,
                    outline: "none", color: "#1a1a1a", background: "#fff",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#185FA5"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(24,95,165,0.10)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.14)"; e.currentTarget.style.boxShadow = "none"; }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 4,
                  background: loading ? "#5F8FBF" : "#185FA5",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  letterSpacing: "-0.01em",
                }}
              >
                {loading ? "Sending…" : "Send Reset Link"}
              </button>

              <a
                href="/login"
                style={{ textAlign: "center", fontSize: 12.5, color: "#185FA5", textDecoration: "none" }}
              >
                Back to Login
              </a>
            </form>
          )}
        </div>
        <LegalLinks style={{ padding: "0 28px 20px", textAlign: "center" }} />
      </div>
    </div>
  );
}
