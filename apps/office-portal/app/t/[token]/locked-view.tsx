"use client";

import { useCallback, useEffect, useState } from "react";
import { timeAgo } from "./format";

// What the tracking link shows on its own: case numbers and where they are.
// The access code unlocks everything else.

export interface LockedJob {
  caseId: string;
  status: string;
  priority: "stat" | "standard";
  hasDriver: boolean;
  scheduledAt: string | null;
  updatedAt: string;
}

export interface LockedData {
  locked: true;
  office: { name: string; labName: string; labPhone: string | null };
  jobs: LockedJob[];
}

function stage(job: LockedJob) {
  if (job.status === "arrived") return { label: "Arrived", bg: "#F0FAF0", text: "#3B6D11", border: "#C0E0C0" };
  if (job.status === "picked_up" || job.status === "in_transit") return { label: "On the way", bg: "#EBF2FA", text: "#185FA5", border: "#C0D9F0" };
  if (job.hasDriver) return { label: "Driver assigned", bg: "#F5F5F3", text: "#3a3a3a", border: "#E2E2DE" };
  return { label: "At the lab", bg: "#FFF8F0", text: "#854F0B", border: "#F5D9B5" };
}

function expected(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString()
    ? `Expected ${time}`
    : `Expected ${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}

export default function LockedView({ token, initial }: { token: string; initial: LockedData }) {
  const [data, setData] = useState(initial);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/track/${token}`);
      // The link was replaced: reload onto the "link isn't working" screen.
      if (res.status === 404) return window.location.reload();
      const json = res.ok ? await res.json() : null;
      if (json?.data?.locked) setData(json.data);
    } catch {
      // silent: stale status is fine
    }
  }, [token]);

  useEffect(() => {
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

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

  const { office, jobs } = data;

  return (
    <div style={{ minHeight: "100vh", background: "#F8F9FB", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <main style={{ maxWidth: 560, margin: "0 auto", padding: "28px 16px 48px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#185FA5", marginBottom: 2 }}>{office.labName}</div>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "#1a1a1a", margin: "0 0 18px", letterSpacing: "-0.02em" }}>{office.name}</h1>

        <form onSubmit={unlock} style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: 16, marginBottom: 18 }}>
          <label htmlFor="access-code" style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: "#1a1a1a" }}>
            Enter your office&apos;s access code
          </label>
          <p style={{ fontSize: 13, color: "#5F5E5A", margin: "3px 0 11px", lineHeight: 1.45 }}>
            Unlocks driver locations, messages, delivery history and photos, and pickup requests on this device for 30 days.
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

        <h2 style={{ fontSize: 13.5, fontWeight: 600, color: "#1a1a1a", margin: "0 0 8px" }}>
          {jobs.length === 0 ? "No cases in progress right now" : `${jobs.length} case${jobs.length === 1 ? "" : "s"} in progress`}
        </h2>
        {jobs.length > 0 && (
          <div style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, overflow: "hidden" }}>
            {jobs.map((job, i) => {
              const s = stage(job);
              return (
                <div key={`${job.caseId}-${i}`} style={{ borderTop: i ? "1px solid rgba(0,0,0,0.06)" : "none", padding: "11px 16px", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1a1a1a", fontFamily: "ui-monospace, monospace" }}>{job.caseId}</span>
                    {job.priority === "stat" && (
                      <span style={{ marginLeft: 8, background: "#FFF0EB", color: "#C53B0A", fontSize: 10, fontWeight: 600, borderRadius: 4, padding: "1px 6px" }}>STAT</span>
                    )}
                    {job.scheduledAt && <div style={{ fontSize: 12, color: "#5F5E5A", marginTop: 3 }}>{expected(job.scheduledAt)}</div>}
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    <span style={{ display: "inline-block", background: s.bg, color: s.text, border: `1px solid ${s.border}`, fontSize: 11, fontWeight: 500, borderRadius: 20, padding: "2px 9px", whiteSpace: "nowrap" }}>{s.label}</span>
                    <div style={{ fontSize: 11, color: "#9a9a9a", marginTop: 4 }}>{timeAgo(job.updatedAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
