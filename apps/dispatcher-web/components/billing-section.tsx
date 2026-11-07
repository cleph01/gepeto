"use client";

import { useEffect, useState } from "react";
import type { ApiResponse } from "@gepeto/types";
import { useAuth } from "@/context/auth";

interface Billing {
  plan: string | null;
  planName: string | null;
  interval: "month" | "year" | null;
  includedDrivers: number | null;
  extraDrivers: number;
  driverLimit: number | null;
  activeDrivers: number;
  status: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  dataDeletedOn: string | null;
  isOwner: boolean;
  hasSubscription: boolean;
  canManage: boolean;
  billingConfigured: boolean;
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  trialing: { label: "Free trial", color: "#185FA5", bg: "#EBF2FA" },
  active: { label: "Active", color: "#3B6D11", bg: "rgba(59,109,17,0.10)" },
  past_due: { label: "Payment failed", color: "#A32D2D", bg: "rgba(163,45,45,0.08)" },
  unpaid: { label: "Unpaid", color: "#A32D2D", bg: "rgba(163,45,45,0.08)" },
  canceled: { label: "Cancelled", color: "#5F5E5A", bg: "rgba(0,0,0,0.06)" },
  paused: { label: "Paused", color: "#854F0B", bg: "rgba(133,79,11,0.10)" },
  incomplete: { label: "Incomplete", color: "#854F0B", bg: "rgba(133,79,11,0.10)" },
};

const day = (iso: string) => new Date(iso).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });

// Settings → Plan & billing: what the lab is on, driver spots in use, and a
// button into Stripe's Customer Portal (change plan, add a card or drivers,
// cancel). The portal's changes come back through the webhook.
export default function BillingSection({ isMobile }: { isMobile: boolean }) {
  const { apiFetch } = useAuth();
  const [b, setB] = useState<Billing | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ApiResponse<Billing>>("/api/billing")
      .then((res) => { if (res.data) setB(res.data); else setError(res.error?.message ?? "Couldn't load billing."); })
      .catch(() => setError("Couldn't load billing."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openPortal = async () => {
    setOpening(true);
    setError(null);
    const res = await apiFetch<ApiResponse<{ url: string }>>("/api/billing/portal", { method: "POST" }).catch(() => null);
    if (res?.data?.url) window.location.href = res.data.url;
    else {
      setError(res?.error?.message ?? "Couldn't open billing. Try again.");
      setOpening(false);
    }
  };

  const card: React.CSSProperties = {
    background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden",
  };
  const pad = isMobile ? 16 : 24;

  return (
    <div style={card}>
      <div style={{ padding: `${isMobile ? 14 : 18}px ${pad}px`, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: "#1a1a1a" }}>Plan &amp; billing</div>
        <div style={{ fontSize: 12.5, color: "#5F5E5A", marginTop: 2 }}>Your Gepeto plan and driver spots</div>
      </div>
      <div style={{ padding: pad, display: "flex", flexDirection: "column", gap: 18 }}>
        {!b ? (
          <span style={{ fontSize: 13, color: error ? "#A32D2D" : "#9a9a9a" }}>{error ?? "Loading…"}</span>
        ) : !b.plan ? (
          <div style={{ fontSize: 13.5, color: "#3a3a3a", lineHeight: 1.6 }}>
            <strong>No plan, no limits.</strong> This lab was set up before plans existed, so it has unlimited drivers.
            <div style={{ marginTop: 6, color: "#5F5E5A" }}>
              Active drivers right now: <strong style={{ color: "#1a1a1a" }}>{b.activeDrivers}</strong>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.01em" }}>{b.planName}</span>
              <span style={{ fontSize: 12.5, color: "#5F5E5A" }}>· billed {b.interval === "year" ? "yearly" : "monthly"}</span>
              {b.status && STATUS[b.status] && (
                <span style={{ fontSize: 11.5, fontWeight: 500, color: STATUS[b.status].color, background: STATUS[b.status].bg, borderRadius: 20, padding: "2px 9px" }}>
                  {STATUS[b.status].label}
                </span>
              )}
            </div>

            {b.status === "trialing" && b.trialEndsAt && (
              <Note tone="info">
                Your free trial ends <strong>{day(b.trialEndsAt)}</strong>. Add a card before then to keep Gepeto running; without one, the
                subscription ends on that date.
              </Note>
            )}
            {(b.status === "past_due" || b.status === "unpaid") && (
              <Note tone="danger">Your last payment didn&apos;t go through. Update your card to keep Gepeto running.</Note>
            )}
            {b.status === "canceled" && (
              <Note tone="info">
                This subscription has ended. Choose a plan to start again.
                {b.dataDeletedOn && (
                  <> Your lab&apos;s data will be deleted after <strong>{day(b.dataDeletedOn)}</strong>, unless you start a plan before then. To get a copy, email hello@gepeto.delivery.</>
                )}
              </Note>
            )}

            {b.driverLimit !== null && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#3a3a3a", marginBottom: 6 }}>
                  <span>Active drivers</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    <strong>{b.activeDrivers}</strong> of {b.driverLimit}
                    {b.extraDrivers > 0 && <span style={{ color: "#9a9a9a" }}> ({b.includedDrivers} included + {b.extraDrivers} extra)</span>}
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "rgba(0,0,0,0.07)", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%", borderRadius: 3,
                      width: `${Math.min(100, (b.activeDrivers / Math.max(1, b.driverLimit)) * 100)}%`,
                      background: b.activeDrivers >= b.driverLimit ? "#854F0B" : "#185FA5",
                    }}
                  />
                </div>
                <div style={{ fontSize: 11.5, color: "#9a9a9a", marginTop: 6 }}>
                  Off Duty drivers don&apos;t use a spot. Need more? Add drivers or upgrade below.
                </div>
              </div>
            )}

            {b.currentPeriodEnd && b.status === "active" && (
              <div style={{ fontSize: 12.5, color: "#5F5E5A" }}>Next bill on {day(b.currentPeriodEnd)}.</div>
            )}
          </>
        )}

        {b?.plan && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={openPortal}
              disabled={!b.canManage || opening}
              style={{
                fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 8, border: "none",
                color: "#fff", background: !b.canManage || opening ? "#9ab6d6" : "#185FA5",
                cursor: !b.canManage || opening ? "default" : "pointer",
              }}
            >
              {opening ? "Opening…" : "Manage billing"}
            </button>
            <span style={{ fontSize: 12, color: "#9a9a9a" }}>
              {b.canManage
                ? "Change plan, add drivers or a card, see invoices, or cancel."
                : !b.isOwner
                  ? "Only the lab owner can manage billing."
                  : !b.billingConfigured
                    ? "Billing opens once payments are switched on."
                    : "Billing opens once your subscription is set up."}
            </span>
          </div>
        )}
        {b && error && <span style={{ fontSize: 12.5, color: "#A32D2D" }}>{error}</span>}
      </div>
    </div>
  );
}

function Note({ tone, children }: { tone: "info" | "danger"; children: React.ReactNode }) {
  const c = tone === "danger"
    ? { color: "#A32D2D", bg: "rgba(163,45,45,0.06)", border: "rgba(163,45,45,0.2)" }
    : { color: "#124B87", bg: "#EBF2FA", border: "rgba(24,95,165,0.15)" };
  return (
    <div style={{ fontSize: 12.5, lineHeight: 1.5, color: c.color, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, padding: "10px 14px" }}>
      {children}
    </div>
  );
}
