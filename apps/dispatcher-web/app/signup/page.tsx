"use client";

import { useState } from "react";
import Link from "next/link";
import { LegalLink } from "@/components/legal-links";
import { PRIVACY_URL, TERMS_URL } from "@/lib/legal";
import { PLANS, PLAN_PRICE, TRIAL_DAYS, isInterval, isPlanId, type BillingInterval, type PlanId } from "@/lib/plans";

const PRICE = PLAN_PRICE;

// Coming from the pricing page: /signup?plan=growth&interval=year
function initialChoice(): { plan: PlanId; interval: BillingInterval } {
  if (typeof window === "undefined") return { plan: "growth", interval: "month" };
  const q = new URLSearchParams(window.location.search);
  const plan = q.get("plan");
  const interval = q.get("interval");
  return { plan: isPlanId(plan) ? plan : "growth", interval: isInterval(interval) ? interval : "month" };
}

export default function SignupPage() {
  const [labName, setLabName]   = useState("");
  const [email, setEmail]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [plan, setPlan]         = useState<PlanId>(() => initialChoice().plan);
  const [interval, setInterval] = useState<BillingInterval>(() => initialChoice().interval);
  const [accepted, setAccepted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accepted) {
      setError("Please agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setError(null);
    setLoading(true);

    let res: Response;
    try {
      res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labName: labName.trim(), email: email.trim(), plan, interval, acceptedTerms: accepted }),
      });
    } catch {
      // Network failure (offline, DNS, etc.) — fetch itself threw, no response at all.
      setError("Couldn't reach the server. Check your connection and try again.");
      setLoading(false);
      return;
    }

    let data: { url?: string; error?: { message?: string } };
    try {
      data = await res.json();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

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
    <div style={{ minHeight: "100vh", width: "100%", background: "#F8F9FB", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", width: "100%", maxWidth: 420, overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "28px 28px 22px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 48, height: 48, background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 11, padding: 5, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/gepeto-icon.png" alt="Gepeto" style={{ width: "100%", height: "100%" }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em" }}>Gepeto</div>
            <div style={{ fontSize: 11.5, color: "#5F5E5A" }}>Start your free trial</div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "24px 28px 28px", display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ margin: "0 0 4px", fontSize: 13, color: "#5F5E5A", lineHeight: 1.5 }}>
            Set up your lab in 2 minutes. {TRIAL_DAYS}-day free trial: you add a card, but you aren&apos;t charged until the trial ends. Have a founding-lab code? Enter it on the next page.
          </p>

          {/* Plan */}
          <div>
            <span style={{ fontSize: 12, fontWeight: 500, color: "#3a3a3a", display: "block", marginBottom: 6 }}>Plan</span>
            <div role="radiogroup" aria-label="Plan" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {(Object.keys(PLANS) as PlanId[]).map((id) => {
                const on = plan === id;
                const price = interval === "year" ? Math.round(PRICE[id].year / 12) : PRICE[id].month;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setPlan(id)}
                    style={{
                      textAlign: "left", padding: "8px 9px", borderRadius: 8, cursor: "pointer",
                      border: `1.5px solid ${on ? "#185FA5" : "rgba(0,0,0,0.12)"}`, background: on ? "#EBF2FA" : "#fff",
                    }}
                  >
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: on ? "#185FA5" : "#1a1a1a" }}>{PLANS[id].name}</div>
                    <div style={{ fontSize: 12, color: "#3a3a3a" }}>${price}<span style={{ color: "#9a9a9a" }}>/mo</span></div>
                    <div style={{ fontSize: 10.5, color: "#9a9a9a" }}>{PLANS[id].drivers} drivers</div>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 12, color: "#3a3a3a" }}>
              {(["month", "year"] as BillingInterval[]).map((iv) => (
                <label key={iv} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                  <input type="radio" name="interval" checked={interval === iv} onChange={() => setInterval(iv)} />
                  {iv === "month" ? "Monthly" : <>Annual <span style={{ color: "#3B6D11", fontWeight: 600 }}>2 months free</span></>}
                </label>
              ))}
            </div>
          </div>

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

          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: "#3a3a3a", lineHeight: 1.45, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => { setAccepted(e.target.checked); setError(null); }}
              style={{ marginTop: 2, flexShrink: 0 }}
            />
            <span>
              I agree to the <LegalLink href={TERMS_URL}>Terms of Service</LegalLink> and{" "}
              <LegalLink href={PRIVACY_URL}>Privacy Policy</LegalLink> on behalf of my lab.
            </span>
          </label>

          <p style={{ margin: 0, fontSize: 12, color: "#5F5E5A", lineHeight: 1.5 }}>
            After your {TRIAL_DAYS}-day trial, {PLANS[plan].name} renews automatically at ${PRICE[plan][interval].toLocaleString("en-US")} per {interval} plus any tax, until you cancel in Settings.
          </p>

          <button
            type="submit"
            disabled={loading}
            style={{ marginTop: 4, background: loading ? "#5F8FBF" : "#185FA5", color: "white", border: "none", borderRadius: 8, padding: "10px", fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", letterSpacing: "-0.01em" }}
          >
            {loading ? "Setting up your trial…" : `Start ${TRIAL_DAYS}-day free trial →`}
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
