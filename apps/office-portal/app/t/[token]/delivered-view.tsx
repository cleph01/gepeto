"use client";

import { useEffect, useState } from "react";
import { itemsLine, type Item } from "./format";

interface Delivery {
  id: string;
  caseId: string;
  priority: "stat" | "standard";
  items: Item[] | null;
  deliveredAt: string;
  driverName: string | null;
  receivedBy: string | null;
}

type Preset = "today" | "7" | "30" | "90" | "custom";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7", label: "Last 7 days" },
  { id: "30", label: "Last 30 days" },
  { id: "90", label: "Last 90 days" },
  { id: "custom", label: "Custom" },
];

const dayInput = (d: Date) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/** [from, to) in the office's local time. "Last 7 days" includes today. */
function rangeFor(preset: Preset, customFrom: string, customTo: string): [Date, Date] | null {
  const tomorrow = addDays(startOfDay(new Date()), 1);
  if (preset === "today") return [addDays(tomorrow, -1), tomorrow];
  if (preset !== "custom") return [addDays(tomorrow, -Number(preset)), tomorrow];
  if (!customFrom || !customTo) return null;
  const from = new Date(customFrom + "T00:00:00");
  const to = addDays(new Date(customTo + "T00:00:00"), 1);
  return to > from ? [from, to] : null;
}

export default function DeliveredView({ token, refreshKey = 0 }: { token: string; refreshKey?: number }) {
  const [preset, setPreset] = useState<Preset>("7");
  const [customFrom, setCustomFrom] = useState(() => dayInput(addDays(new Date(), -30)));
  const [customTo, setCustomTo] = useState(() => dayInput(new Date()));
  const [rows, setRows] = useState<Delivery[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState("");

  const range = rangeFor(preset, customFrom, customTo);
  const rangeKey = range ? `${range[0].toISOString()}|${range[1].toISOString()}` : "";

  useEffect(() => {
    if (!rangeKey) return;
    const [from, to] = rangeKey.split("|");
    let cancelled = false;
    fetch(`/api/track/${token}/delivered?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.data) {
          setRows(json.data.deliveries);
          setTruncated(json.data.truncated);
          setLoadedKey(rangeKey);
          setError(null);
        } else {
          setError(json.error?.message ?? "Couldn't load deliveries.");
        }
      })
      .catch(() => { if (!cancelled) setError("Couldn't load deliveries. Check your connection."); });
    return () => { cancelled = true; };
  }, [token, rangeKey, refreshKey]);

  // Group by the local day each case was delivered.
  const days: { label: string; rows: Delivery[] }[] = [];
  for (const d of rows ?? []) {
    const label = new Date(d.deliveredAt).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    const last = days[days.length - 1];
    if (last && last.label === label) last.rows.push(d);
    else days.push({ label, rows: [d] });
  }

  return (
    <div>
      {/* Date filter */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: preset === "custom" ? 10 : 16 }}>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
            aria-pressed={preset === p.id}
            style={{
              fontSize: 12.5, padding: "6px 12px", borderRadius: 20, cursor: "pointer",
              border: `1px solid ${preset === p.id ? "#185FA5" : "rgba(0,0,0,0.12)"}`,
              background: preset === p.id ? "#EBF2FA" : "#fff",
              color: preset === p.id ? "#185FA5" : "#3a3a3a", fontWeight: preset === p.id ? 600 : 400,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === "custom" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 16, fontSize: 12.5, color: "#5F5E5A" }}>
          <label htmlFor="delivered-from">From</label>
          <input id="delivered-from" type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} style={dateInput} />
          <label htmlFor="delivered-to">to</label>
          <input id="delivered-to" type="date" value={customTo} min={customFrom} max={dayInput(new Date())} onChange={(e) => setCustomTo(e.target.value)} style={dateInput} />
        </div>
      )}

      {/* Results (previous results stay visible, dimmed, while a new range loads) */}
      <div style={{ opacity: rows !== null && loadedKey !== rangeKey ? 0.5 : 1, transition: "opacity 0.15s" }}>
        {error ? (
          <Empty text={error} />
        ) : rows === null ? (
          <Empty text="Loading deliveries…" />
        ) : rows.length === 0 ? (
          <Empty text="No deliveries in this period." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 12.5, color: "#5F5E5A" }}>
              {rows.length} case{rows.length === 1 ? "" : "s"} delivered{truncated ? " (showing the most recent)" : ""}
            </div>
            {days.map((day) => (
              <section key={day.label}>
                <div style={{ fontSize: 11, fontWeight: 500, color: "#5F5E5A", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                  {day.label}
                </div>
                <div style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, overflow: "hidden" }}>
                  {day.rows.map((d, i) => {
                    const items = itemsLine(d.items);
                    return (
                      <div key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "11px 16px", borderTop: i ? "1px solid rgba(0,0,0,0.06)" : "none" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1a1a1a", fontFamily: "ui-monospace, monospace" }}>{d.caseId}</span>
                            {d.priority === "stat" && (
                              <span style={{ background: "#FFF0EB", color: "#C53B0A", fontSize: 10, fontWeight: 600, borderRadius: 4, padding: "1px 6px" }}>STAT</span>
                            )}
                          </div>
                          {items.text && <div style={{ fontSize: 12.5, color: "#3a3a3a", marginTop: 3 }}>{items.text}</div>}
                          <div style={{ fontSize: 12, color: "#5F5E5A", marginTop: 3 }}>
                            {d.receivedBy ? <>Received by <strong style={{ fontWeight: 600, color: "#3a3a3a" }}>{d.receivedBy}</strong></> : "Delivered"}
                            {d.driverName && <> · driver {d.driverName}</>}
                          </div>
                        </div>
                        <div style={{ flexShrink: 0, textAlign: "right", fontSize: 12, color: "#5F5E5A", whiteSpace: "nowrap" }}>
                          {new Date(d.deliveredAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const dateInput: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,0.15)", borderRadius: 8, padding: "5px 8px", fontSize: 13, color: "#1a1a1a", background: "#fff",
};

function Empty({ text }: { text: string }) {
  return (
    <div style={{ textAlign: "center", padding: "36px 20px", background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, fontSize: 13, color: "#5F5E5A" }}>
      {text}
    </div>
  );
}
