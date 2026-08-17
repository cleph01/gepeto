"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function AcceptInvitePage() {
  const { session, loading } = useAuth();
  const router = useRouter();

  const [password, setPassword]       = useState("");
  const [confirm, setConfirm]         = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [done, setDone]               = useState(false);
  const [isDriver, setIsDriver]       = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    const { data, error: updateError } = await supabaseBrowser.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    const role = data.user?.app_metadata?.role;
    if (role === "driver") {
      setIsDriver(true);
      setDone(true);
    } else {
      router.replace("/dashboard");
    }
  };

  const Card = ({ children }: { children: React.ReactNode }) => (
    <div style={{ minHeight: "100vh", background: "#F8F9FB", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", width: "100%", maxWidth: 420, overflow: "hidden" }}>
        <div style={{ padding: "28px 28px 22px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, background: "#185FA5", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
              <path d="M9 2C7.2 2 5.5 2.9 4.5 4.3c-.7 1-1 2.1-.8 3.3l1 5.8c.2 1 1 1.6 1.9 1.6.8 0 1.5-.5 1.8-1.2L9 11.5l1.6 2.3c.3.7 1 1.2 1.8 1.2.9 0 1.7-.6 1.9-1.6l1-5.8c.2-1.2-.1-2.3-.8-3.3C13.5 2.9 11.8 2 10 2H9z" fill="white" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em" }}>Gepeto</div>
            <div style={{ fontSize: 11.5, color: "#5F5E5A" }}>Accept invite</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );

  if (loading) {
    return (
      <Card>
        <div style={{ padding: "40px 28px", textAlign: "center", fontSize: 13, color: "#5F5E5A" }}>
          Verifying your invite…
        </div>
      </Card>
    );
  }

  if (!session) {
    return (
      <Card>
        <div style={{ padding: "24px 28px 28px" }}>
          <p style={{ margin: "0 0 4px", fontSize: 13.5, fontWeight: 500, color: "#A32D2D" }}>
            This invite link is invalid or has expired.
          </p>
          <p style={{ margin: "8px 0 20px", fontSize: 13, color: "#5F5E5A", lineHeight: 1.5 }}>
            Ask whoever invited you to send a new one, or log in below if you've already set a password.
          </p>
          <a
            href="/login"
            style={{ display: "block", textAlign: "center", background: "#185FA5", color: "white", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600, textDecoration: "none" }}
          >
            Go to Login
          </a>
        </div>
      </Card>
    );
  }

  if (done) {
    return (
      <Card>
        <div style={{ padding: "24px 28px 28px" }}>
          <p style={{ margin: "0 0 4px", fontSize: 13.5, fontWeight: 600, color: "#3B6D11" }}>
            Password set!
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#5F5E5A", lineHeight: 1.5 }}>
            {isDriver
              ? <>Open the Gepeto driver app and log in with <strong>{session.user.email}</strong> and your new password.</>
              : "You're all set."}
          </p>
        </div>
      </Card>
    );
  }

  const name = (session.user.user_metadata?.name as string | undefined) ?? session.user.email;

  return (
    <Card>
      <form onSubmit={handleSubmit} style={{ padding: "24px 28px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={{ margin: "0 0 4px", fontSize: 13, color: "#5F5E5A", lineHeight: 1.5 }}>
          Welcome, <strong style={{ color: "#1a1a1a" }}>{name}</strong>. Set a password to finish setting up your account.
        </p>

        {error && (
          <div style={{ background: "rgba(163,45,45,0.07)", border: "1px solid rgba(163,45,45,0.2)", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#A32D2D" }}>
            {error}
          </div>
        )}

        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: "#3a3a3a", display: "block", marginBottom: 5 }}>
            New Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
            style={inputStyle}
            onFocus={focusInput}
            onBlur={blurInput}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 500, color: "#3a3a3a", display: "block", marginBottom: 5 }}>
            Confirm Password
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter your password"
            required
            style={inputStyle}
            onFocus={focusInput}
            onBlur={blurInput}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{ marginTop: 4, background: submitting ? "#5F8FBF" : "#185FA5", color: "white", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer", letterSpacing: "-0.01em" }}
        >
          {submitting ? "Setting password…" : "Set Password & Continue"}
        </button>
      </form>
    </Card>
  );
}
