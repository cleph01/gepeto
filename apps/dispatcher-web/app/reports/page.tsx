"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import HelpLink from "@/components/help-link";
import { useAuth } from "@/context/auth";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import type { ApiResponse } from "@gepeto/types";

type Preset = "7" | "30" | "90" | "all" | "custom";

interface Counts { name: string; deliveries: number; scheduled: number; onTime: number }
interface Report {
  deliveries: number;
  scheduled: number;
  onTime: number;
  stat: number;
  returnsCheckedIn: number;
  casesReturned: number;
  returnsMismatched: number;
  byDriver: Counts[];
  byOffice: (Counts & { casesReturned: number })[];
}

const PRESETS: [Preset, string][] = [["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["all", "All time"], ["custom", "Custom"]];

const EXPORTS: { type: string; label: string; detail: string; dated: boolean }[] = [
  { type: "jobs", label: "Jobs", detail: "Cases, drivers, times and who received them", dated: true },
  { type: "returns", label: "Returns", detail: "Pickups, counts and check-in details", dated: true },
  { type: "messages", label: "Messages", detail: "Every message on jobs and returns", dated: true },
  { type: "drivers", label: "Drivers", detail: "Your full driver list", dated: false },
  { type: "offices", label: "Offices", detail: "Your full office list", dated: false },
];

const onTimeLabel = (c: { scheduled: number; onTime: number }) =>
  c.scheduled === 0 ? "—" : `${Math.round((c.onTime / c.scheduled) * 100)}%`;

const dayStart = (daysAgo: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
};

export default function ReportsPage() {
  const { apiFetch, session } = useAuth();
  const isMobile = useBreakpoint() === "mobile";
  const [preset, setPreset] = useState<Preset>("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [planLocked, setPlanLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  // from includes that day; to is the start of the day after, so it's included too.
  const range = ((): Record<string, string> | null => {
    if (preset === "all") return {};
    if (preset === "custom") {
      if (!customFrom || !customTo) return null;
      const to = new Date(`${customTo}T00:00:00`);
      to.setDate(to.getDate() + 1);
      const from = new Date(`${customFrom}T00:00:00`);
      return from < to ? { from: from.toISOString(), to: to.toISOString() } : null;
    }
    return { from: dayStart(Number(preset) - 1).toISOString() };
  })();
  const query = range ? new URLSearchParams(range).toString() : null;

  useEffect(() => {
    if (!session || query === null) return;
    let stale = false;
    apiFetch<ApiResponse<Report>>(`/api/reports?${query}`)
      .then((res) => {
        if (stale) return;
        if (res.data) { setReport(res.data); setError(null); }
        else if (res.error?.code === "PLAN_REQUIRED") setPlanLocked(true);
        else setError(res.error?.message ?? "Couldn't load reports.");
      })
      .catch(() => { if (!stale) setError("Couldn't reach the server. Try again."); });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, query]);

  const download = async (type: string, dated: boolean) => {
    if (!session) return;
    setExporting(type);
    setError(null);
    try {
      const params = new URLSearchParams({ type, tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
      if (dated && range) for (const [k, v] of Object.entries(range)) params.set(k, v);
      const res = await fetch(`/api/reports/export?${params}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error?.message ?? "Couldn't export. Try again.");
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `gepeto-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#F8F9FB" }}>
      <header style={{ padding: isMobile ? "0 16px" : "0 28px", height: 56, display: "flex", alignItems: "center", background: "#fff", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <h1 style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", margin: 0, letterSpacing: "-0.01em" }}>Reports</h1>
            <HelpLink slug="reports" topic="reports and data export" />
          </div>
          <p style={{ fontSize: 11.5, color: "#5F5E5A", margin: 0 }}>How deliveries went, and your data to download</p>
        </div>
      </header>

      <div style={{ padding: isMobile ? 12 : "20px 28px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 1100 }}>
        {planLocked ? (
          <section style={card}>
            <h2 style={heading}>Reports are on the Growth and Pro plans</h2>
            <p style={{ margin: "6px 0 14px", fontSize: 13, color: "#5F5E5A", lineHeight: 1.5 }}>
              Upgrade to see how your deliveries are going and download your data. To get a copy of your data on your current plan, email{" "}
              <a href="mailto:hello@gepeto.delivery" style={{ color: "#185FA5" }}>hello@gepeto.delivery</a>.
            </p>
            <Link href="/settings?section=billing" style={{ display: "inline-block", fontSize: 13, fontWeight: 600, padding: "8px 14px", borderRadius: 8, background: "#185FA5", color: "#fff", textDecoration: "none" }}>
              See plans
            </Link>
          </section>
        ) : (
          <>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {PRESETS.map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setPreset(id)}
                  aria-pressed={preset === id}
                  style={{
                    fontSize: 12, fontWeight: preset === id ? 600 : 400, padding: "5px 12px", borderRadius: 20, cursor: "pointer",
                    border: `1px solid ${preset === id ? "#185FA5" : "rgba(0,0,0,0.12)"}`,
                    background: preset === id ? "#EBF2FA" : "#fff", color: preset === id ? "#185FA5" : "#3a3a3a",
                  }}
                >
                  {label}
                </button>
              ))}
              {preset === "custom" && (
                <span style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12, color: "#5F5E5A" }}>
                  <input type="date" aria-label="From" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={dateInput} />
                  to
                  <input type="date" aria-label="To" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={dateInput} />
                </span>
              )}
            </div>

            {error && <div role="alert" style={{ fontSize: 12.5, color: "#A32D2D" }}>{error}</div>}
            {preset === "custom" && range === null && <div style={{ fontSize: 12.5, color: "#5F5E5A" }}>Choose a start date and an end date on or after it.</div>}

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10 }}>
              <Tile value={report ? String(report.deliveries) : "–"} label="Deliveries" note={report ? `${report.stat} STAT` : ""} />
              <Tile value={report ? onTimeLabel(report) : "–"} label="On time" note={report ? `${report.onTime} of ${report.scheduled} with a due time` : ""} />
              <Tile value={report ? String(report.casesReturned) : "–"} label="Cases returned" note={report ? `${report.returnsCheckedIn} return${report.returnsCheckedIn === 1 ? "" : "s"} checked in` : ""} />
              <Tile value={report ? String(report.returnsMismatched) : "–"} label="Count differences" note="Returns where the count didn't match" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, alignItems: "start" }}>
              <ReportTable title="By driver" columns={["Driver", "Deliveries", "On time"]} empty="No deliveries in this period." rows={(report?.byDriver ?? []).map((d) => [d.name, String(d.deliveries), onTimeLabel(d)])} />
              <ReportTable title="By office" columns={["Office", "Deliveries", "On time", "Cases back"]} empty="No activity in this period." rows={(report?.byOffice ?? []).map((o) => [o.name, String(o.deliveries), onTimeLabel(o), String(o.casesReturned)])} />
            </div>

            <section style={card}>
              <h2 style={heading}>Export your data</h2>
              <p style={{ margin: "4px 0 12px", fontSize: 12.5, color: "#5F5E5A", lineHeight: 1.5 }}>
                Downloads a CSV file that opens in Excel, Numbers or Google Sheets. Jobs, returns and messages use the dates above. Times are in your computer&apos;s time zone.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
                {EXPORTS.map((x) => (
                  <div key={x.type} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, border: "1px solid rgba(0,0,0,0.08)", borderRadius: 9, padding: "9px 11px" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{x.label}</div>
                      <div style={{ fontSize: 11.5, color: "#5F5E5A" }}>{x.detail}</div>
                    </div>
                    <button
                      onClick={() => download(x.type, x.dated)}
                      disabled={exporting !== null || (x.dated && range === null)}
                      style={{ flexShrink: 0, fontSize: 12, fontWeight: 500, padding: "5px 11px", borderRadius: 7, cursor: "pointer", border: "1px solid #185FA5", background: "#fff", color: "#185FA5", opacity: exporting !== null && exporting !== x.type ? 0.5 : 1 }}
                    >
                      {exporting === x.type ? "Preparing…" : "Download"}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" };
const heading: React.CSSProperties = { margin: 0, fontSize: 14, fontWeight: 600, color: "#1a1a1a" };
const dateInput: React.CSSProperties = { fontSize: 12, padding: "4px 8px", borderRadius: 7, border: "1px solid rgba(0,0,0,0.15)", color: "#1a1a1a", background: "#fff" };

function Tile({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <div style={{ ...card, padding: "12px 14px" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a" }}>{value}</div>
      <div style={{ fontSize: 12.5, fontWeight: 500, color: "#3a3a3a" }}>{label}</div>
      <div style={{ fontSize: 11, color: "#9a9a9a", marginTop: 2 }}>{note}</div>
    </div>
  );
}

function ReportTable({ title, columns, rows, empty }: { title: string; columns: string[]; rows: string[][]; empty: string }) {
  return (
    <section style={{ ...card, padding: 0, overflow: "hidden" }}>
      <h2 style={{ ...heading, padding: "12px 14px" }}>{title}</h2>
      {rows.length === 0 ? (
        <div style={{ padding: "0 14px 14px", fontSize: 12.5, color: "#9a9a9a" }}>{empty}</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#FAFAFA" }}>
                {columns.map((c, i) => (
                  <th key={c} scope="col" style={{ padding: "6px 14px", fontSize: 11, fontWeight: 600, color: "#5F5E5A", textAlign: i === 0 ? "left" : "right", whiteSpace: "nowrap" }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                  {row.map((cell, i) => (
                    <td key={i} style={{ padding: "7px 14px", color: i === 0 ? "#1a1a1a" : "#3a3a3a", textAlign: i === 0 ? "left" : "right" }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
