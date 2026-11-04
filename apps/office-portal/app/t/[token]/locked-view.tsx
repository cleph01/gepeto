"use client";

import { useEffect, useState } from "react";

// The tracking link on its own is only a code screen. The server sends no case
// or driver activity until the access code passes.

export interface LockedData {
  locked: true;
  office: { name: string; labName: string; labPhone: string | null };
}

export default function LockedView({ token, initial }: { token: string; initial: LockedData }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The link was replaced: reload onto the "link isn't working" screen.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/track/${token}`);
        if (res.status === 404) window.location.reload();
      } catch {
        // silent: the next check will catch it
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [token]);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/track/${token}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) return window.location.reload();
      const json = await res.json().catch(() => null);
      setError(json?.error?.message ?? "Something went wrong. Please try again.");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    }
    setBusy(false);
  }

  const { office } = initial;

  return (
    <div style={{ minHeight: "100vh", background: "#F8F9FB", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <main style={{ maxWidth: 560, margin: "0 auto", padding: "28px 16px 48px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#185FA5", marginBottom: 2 }}>{office.labName}</div>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "#1a1a1a", margin: "0 0 18px", letterSpacing: "-0.02em" }}>{office.name}</h1>

        <form onSubmit={unlock} style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: 16 }}>
          <label htmlFor="access-code" style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: "#1a1a1a" }}>
            Enter your office&apos;s access code
          </label>
          <p style={{ fontSize: 13, color: "#5F5E5A", margin: "3px 0 11px", lineHeight: 1.45 }}>
            Unlocks your cases, driver locations, messages, delivery history and photos, and pickup requests on this device for 30 days.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              id="access-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="XXXX-XXXX"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
              style={{
                flex: 1, minWidth: 0, border: "1px solid rgba(0,0,0,0.15)", borderRadius: 8, padding: "9px 11px",
                fontSize: 16, fontFamily: "ui-monospace, monospace", letterSpacing: "0.06em", color: "#1a1a1a", background: "#fff",
              }}
            />
            <button
              type="submit"
              disabled={busy}
              style={{ flexShrink: 0, background: "#185FA5", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 }}
            >
              {busy ? "Checking…" : "Unlock"}
            </button>
          </div>
          {error && <div role="alert" style={{ fontSize: 13, color: "#C53B0A", marginTop: 9, lineHeight: 1.45 }}>{error}</div>}
          <p style={{ fontSize: 12.5, color: "#5F5E5A", margin: "11px 0 0", lineHeight: 1.45 }}>
            Don&apos;t have it? {office.labPhone
              ? <>Call the lab at <a href={`tel:${office.labPhone.replace(/[^\d+]/g, "")}`} style={{ color: "#185FA5", fontWeight: 600, whiteSpace: "nowrap" }}>{office.labPhone}</a>.</>
              : "Ask your dental lab."}
          </p>
        </form>

      </main>
    </div>
  );
}
