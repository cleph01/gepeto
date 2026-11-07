"use client";

import { useConfirm } from "./confirm-dialog";
import { useEffect, useState } from "react";

// Pickup requests: the office tells the lab it has cases ready to go back.
// Dispatch assigns a driver; the driver's pickup fulfills the request.

export interface Pickup {
  id: string;
  number: number;
  status: "requested" | "with_driver" | "at_lab" | "checked_in";
  caseCount: number;
  caseNumbers: string[];
  note: string | null;
  requestedAt: string | null;
  readyAt: string | null;
  pickedUpAt: string | null;
  checkedInAt: string | null;
  hasDriver: boolean;
  driverName: string | null;
}

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString()
    ? time
    : `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}, ${time}`;
};

function progress(p: Pickup): { label: string; detail: string | null; color: string; bg: string; border: string } {
  switch (p.status) {
    case "requested":
      if (p.driverName) {
        return { label: `${p.driverName} will pick it up`, detail: null, color: "#185FA5", bg: "#EBF2FA", border: "#C0D9F0" };
      }
      return {
        label: "Waiting for a driver",
        detail: p.readyAt && new Date(p.readyAt) > new Date() ? `Ready after ${fmtTime(p.readyAt)}` : "Ready now",
        color: "#854F0B", bg: "#FFF8F0", border: "#F5D9B5",
      };
    case "with_driver":
      return { label: `Picked up${p.driverName ? ` by ${p.driverName}` : ""}`, detail: p.pickedUpAt ? fmtTime(p.pickedUpAt) : null, color: "#185FA5", bg: "#EBF2FA", border: "#C0D9F0" };
    case "at_lab":
      return { label: "At the lab", detail: "Being checked in", color: "#3a3a3a", bg: "#F5F5F3", border: "#E2E2DE" };
    default:
      return { label: "Checked in at the lab", detail: p.checkedInAt ? fmtTime(p.checkedInAt) : null, color: "#3B6D11", bg: "#F0FAF0", border: "#C0E0C0" };
  }
}

export function PickupsSection({
  token,
  pickups,
  onChanged,
  unreadFor,
  onOpenMessages,
}: {
  token: string;
  pickups: Pickup[];
  onChanged: () => void;
  unreadFor: (id: string) => number;
  onOpenMessages: (id: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const { confirm, confirmDialog } = useConfirm();
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

  if (pickups.length === 0) return null;

  const cancel = async (p: Pickup) => {
    const ok = await confirm({
      title: "Cancel this pickup?",
      body: `The lab won't send a driver for ${p.caseCount === 1 ? "this case" : `these ${p.caseCount} cases`}. You can request another pickup anytime.`,
      confirmLabel: "Cancel pickup",
      cancelLabel: "Keep pickup",
      danger: true,
    });
    if (!ok) return;
    setBusy(p.id);
    setError(null);
    try {
      const res = await fetch(`/api/track/${token}/pickups/${p.id}/cancel`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) setError({ id: p.id, message: json?.error?.message ?? "Couldn't cancel. Try again." });
      onChanged();
    } catch {
      setError({ id: p.id, message: "Couldn't cancel. Check your connection." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#FFF8F0", color: "#854F0B", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <BoxIcon />
        </div>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: "#1a1a1a" }}>Pickups for the lab</div>
          <div style={{ fontSize: 12.5, color: "#5F5E5A", marginTop: 1 }}>Cases going back to the lab</div>
        </div>
      </div>
      {pickups.map((p) => {
        const st = progress(p);
        const canCancel = p.status === "requested" && !p.hasDriver;
        return (
          <div key={p.id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)", padding: "11px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1a1a1a" }}>
                {p.caseCount} case{p.caseCount === 1 ? "" : "s"}
                <span style={{ fontSize: 11.5, fontWeight: 400, color: "#9a9a9a", fontFamily: "ui-monospace, monospace" }}> · RET-{p.number}</span>
              </div>
              {p.caseNumbers.length > 0 && (
                <div style={{ fontSize: 12.5, color: "#3a3a3a", marginTop: 2, fontFamily: "ui-monospace, monospace", wordBreak: "break-word" }}>{p.caseNumbers.join(", ")}</div>
              )}
              {p.note && <div style={{ fontSize: 12, color: "#5F5E5A", fontStyle: "italic", marginTop: 2 }}>{p.note}</div>}
              {p.requestedAt && <div style={{ fontSize: 11, color: "#9a9a9a", marginTop: 3 }}>Requested {fmtTime(p.requestedAt)}</div>}
              {error?.id === p.id && <div style={{ fontSize: 12, color: "#A32D2D", marginTop: 4 }}>{error.message}</div>}
            </div>
            <div style={{ flexShrink: 0, textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <span style={{ display: "inline-block", background: st.bg, color: st.color, border: `1px solid ${st.border}`, fontSize: 11, fontWeight: 500, borderRadius: 20, padding: "2px 9px", whiteSpace: "nowrap" }}>
                {st.label}
              </span>
              {st.detail && <span style={{ fontSize: 11, color: "#5F5E5A" }}>{st.detail}</span>}
              <button
                onClick={() => onOpenMessages(p.id)}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500, color: "#185FA5", background: "#EBF2FA", border: "1px solid #C0D9F0", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}
              >
                Messages
                {unreadFor(p.id) > 0 && (
                  <span aria-label={`${unreadFor(p.id)} unread`} style={{ background: "#D93025", color: "white", fontSize: 10, fontWeight: 700, minWidth: 16, height: 16, lineHeight: "16px", borderRadius: 8, textAlign: "center", padding: "0 4px", boxSizing: "border-box" }}>
                    {unreadFor(p.id)}
                  </span>
                )}
              </button>
              {canCancel && (
                <button
                  onClick={() => cancel(p)}
                  disabled={busy === p.id}
                  style={{ fontSize: 11.5, color: "#5F5E5A", background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}
                >
                  {busy === p.id ? "Cancelling…" : "Cancel"}
                </button>
              )}
            </div>
          </div>
        );
      })}
      {confirmDialog}
    </div>
  );
}

export function BoxIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M2 5l6 3 6-3M8 8v6" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

// ── Request form ──────────────────────────────────────────────────────────────

const timeInput = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

export function RequestPickupModal({
  token,
  onClose,
  onSent,
}: {
  token: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [count, setCount] = useState(1);
  const [caseText, setCaseText] = useState("");
  const [note, setNote] = useState("");
  const [when, setWhen] = useState<"now" | "later">("now");
  // Default "later" to the next half hour after an hour from now.
  const [laterTime, setLaterTime] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
    return timeInput(d);
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const check = () => setPhone(window.innerWidth < 600);
    check();
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", check);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const caseNumbers = caseText.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);

  // "Later" means later today; a time already past rolls to tomorrow.
  const readyAt = (() => {
    if (when === "now") return null;
    const [h, m] = laterTime.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    if (d <= new Date()) d.setDate(d.getDate() + 1);
    return d;
  })();

  const submit = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/track/${token}/pickups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseCount: Math.max(count, caseNumbers.length),
          caseNumbers,
          note,
          readyAt: readyAt ? readyAt.toISOString() : null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.data) {
        onSent();
        onClose();
      } else {
        setError(json?.error?.message ?? "Couldn't send the request. Try again.");
      }
    } catch {
      setError("Couldn't send the request. Check your connection.");
    } finally {
      setSending(false);
    }
  };

  const step = (d: number) => setCount((n) => Math.min(99, Math.max(1, n + d)));

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 5000, background: "rgba(0,0,0,0.35)",
        display: "flex", alignItems: phone ? "stretch" : "center", justifyContent: "center",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Request a pickup"
        style={{
          background: "#fff", width: "100%", maxWidth: phone ? "none" : 440, height: phone ? "100%" : "auto",
          maxHeight: phone ? "none" : "88vh", margin: phone ? 0 : "0 16px", borderRadius: phone ? 0 : 14,
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid rgba(0,0,0,0.07)", display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>Request a pickup</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#5F5E5A" }}>Cases ready to go back to the lab: remakes, adjustments, new work.</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "#9a9a9a", padding: 4, display: "flex", alignSelf: "flex-start" }}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div style={{ padding: "16px 18px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <span style={label}>How many cases?</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => step(-1)} aria-label="One fewer" style={stepBtn}>−</button>
              <span aria-live="polite" style={{ fontSize: 20, fontWeight: 600, minWidth: 28, textAlign: "center", color: "#1a1a1a" }}>{Math.max(count, caseNumbers.length)}</span>
              <button onClick={() => step(1)} aria-label="One more" style={stepBtn}>+</button>
            </div>
          </div>

          <div>
            <label htmlFor="pickup-cases" style={label}>Case numbers <span style={optional}>(optional)</span></label>
            <input
              id="pickup-cases"
              value={caseText}
              onChange={(e) => setCaseText(e.target.value)}
              placeholder="e.g. LAB-2042, LAB-2043"
              style={input}
            />
            <p style={hint}>Separate with commas. Case numbers only, please, no patient names.</p>
          </div>

          <div>
            <span style={label}>When are they ready?</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {(["now", "later"] as const).map((w) => (
                <button
                  key={w}
                  onClick={() => setWhen(w)}
                  aria-pressed={when === w}
                  style={{
                    fontSize: 13, padding: "7px 14px", borderRadius: 20, cursor: "pointer",
                    border: `1px solid ${when === w ? "#185FA5" : "rgba(0,0,0,0.12)"}`,
                    background: when === w ? "#EBF2FA" : "#fff", color: when === w ? "#185FA5" : "#3a3a3a",
                    fontWeight: when === w ? 600 : 400,
                  }}
                >
                  {w === "now" ? "Ready now" : "Ready after…"}
                </button>
              ))}
              {when === "later" && (
                <input type="time" value={laterTime} onChange={(e) => setLaterTime(e.target.value)} aria-label="Ready after" style={{ ...input, width: "auto" }} />
              )}
            </div>
            {readyAt && (
              <p style={hint}>
                Ready {readyAt.toDateString() === new Date().toDateString() ? "today" : "tomorrow"} after{" "}
                {readyAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="pickup-note" style={label}>Note for the lab <span style={optional}>(optional)</span></label>
            <textarea
              id="pickup-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. At the front desk, ask for Beth"
              style={{ ...input, resize: "vertical", fontFamily: "inherit" }}
            />
          </div>

          {error && <div style={{ fontSize: 12.5, color: "#A32D2D" }}>{error}</div>}
        </div>

        <div style={{ padding: "12px 18px 16px", borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ fontSize: 13.5, padding: "9px 14px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.12)", background: "#fff", color: "#3a3a3a", cursor: "pointer" }}>
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={sending}
            style={{ fontSize: 13.5, fontWeight: 600, padding: "9px 16px", borderRadius: 8, border: "none", color: "#fff", background: sending ? "#9ab6d6" : "#185FA5", cursor: sending ? "default" : "pointer" }}
          >
            {sending ? "Sending…" : "Request pickup"}
          </button>
        </div>
      </div>
    </div>
  );
}

const label: React.CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 600, color: "#3a3a3a", marginBottom: 7 };
const optional: React.CSSProperties = { fontWeight: 400, color: "#9a9a9a" };
const hint: React.CSSProperties = { margin: "6px 0 0", fontSize: 11.5, color: "#9a9a9a" };
const input: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 8,
  padding: "9px 11px", fontSize: 14, color: "#1a1a1a", outline: "none", background: "#fff",
};
const stepBtn: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 9, border: "1px solid rgba(0,0,0,0.15)", background: "#fff",
  fontSize: 20, lineHeight: "20px", cursor: "pointer", color: "#1a1a1a",
};
