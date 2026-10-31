"use client";

import { useEffect, useState } from "react";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useAuth } from "@/context/auth";
import { useMessageNotifications } from "@/context/message-notifications";
import type { ApiResponse } from "@gepeto/types";

// ── Types ─────────────────────────────────────────────────────────────────────

type ReturnStatus = "with_driver" | "at_lab" | "checked_in";

interface ReturnCase {
  id: string;
  number: number;
  status: ReturnStatus;
  officeName: string | null;
  driverName: string | null;
  caseCount: number;
  caseNumbers: string[];
  note: string | null;
  pickedUpAt: string;
  droppedAt: string | null;
  pickedUpDuringCaseId: string | null;
}

type Filter = "open" | "with_driver" | "at_lab";

const STATUS: Record<ReturnStatus, { label: string; color: string; bg: string }> = {
  with_driver: { label: "With driver",              color: "#185FA5", bg: "rgba(24,95,165,0.10)" },
  at_lab:      { label: "At lab · needs check-in",  color: "#854F0B", bg: "rgba(133,79,11,0.12)" },
  checked_in:  { label: "Checked in",               color: "#3B6D11", bg: "rgba(59,109,17,0.10)" },
};

const timeLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return today ? time : `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`;
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReturnsPage() {
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";
  const { apiFetch, session } = useAuth();
  const { returnsSummary, returnsChangedAt } = useMessageNotifications();

  const [returns, setReturns] = useState<ReturnCase[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>("open");

  // Load on open, and again whenever a driver logs or drops off a return.
  useEffect(() => {
    if (!session) return;
    apiFetch<ApiResponse<ReturnCase[]>>("/api/returns?status=open")
      .then((res) => { if (res.data) setReturns(res.data); })
      .catch(() => {})
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, returnsChangedAt]);

  const shown = filter === "open" ? returns : returns.filter((r) => r.status === filter);
  // Waiting for check-in first: that's what the front desk acts on.
  const ordered = [...shown].sort((a, b) =>
    a.status === b.status ? 0 : a.status === "at_lab" ? -1 : b.status === "at_lab" ? 1 : 0
  );

  const { withDriver, withDriverCases, atLab, atLabCases } = returnsSummary;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#F8F9FB" }}>
      {/* Header */}
      <header style={{
        padding: isMobile ? "0 16px" : "0 28px",
        height: 56,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "#FFFFFF", borderBottom: "1px solid rgba(0,0,0,0.07)",
      }}>
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", margin: 0, letterSpacing: "-0.01em" }}>
            Returning Cases
          </h1>
          <p style={{ fontSize: 11.5, color: "#5F5E5A", margin: 0 }}>
            {loaded
              ? `${atLabCases} case${atLabCases === 1 ? "" : "s"} waiting for check-in · ${withDriverCases} with drivers`
              : "Loading returns…"}
          </p>
        </div>
      </header>

      <div style={{ padding: isMobile ? 12 : "20px 28px", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Filters */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Chip active={filter === "open"} onClick={() => setFilter("open")}>All open · {withDriver + atLab}</Chip>
          <Chip active={filter === "at_lab"} onClick={() => setFilter("at_lab")}>At lab · {atLab}</Chip>
          <Chip active={filter === "with_driver"} onClick={() => setFilter("with_driver")}>With drivers · {withDriver}</Chip>
        </div>

        <div style={{
          background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12,
          boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden",
        }}>
          {!isMobile && (
            <div style={{ ...rowGrid, padding: "8px 16px", background: "#FAFAFA", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              {["Return", "Office", "Driver", "Cases", "Status"].map((c) => (
                <span key={c} style={{ fontSize: 11, fontWeight: 500, color: "#5F5E5A", textTransform: "uppercase", letterSpacing: "0.04em" }}>{c}</span>
              ))}
            </div>
          )}

          {ordered.length === 0 ? (
            <div style={{ padding: "40px 16px", textAlign: "center", color: "#9a9a9a", fontSize: 13 }}>
              {!loaded
                ? "Loading returns…"
                : filter === "open"
                  ? "No cases on their way back. When a driver picks up cases at an office, they'll show up here."
                  : "Nothing here right now."}
            </div>
          ) : (
            ordered.map((r, i) => (
              <ReturnRow key={r.id} r={r} isMobile={isMobile} isLast={i === ordered.length - 1} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────────────

const rowGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "120px minmax(140px, 1.2fr) minmax(110px, 1fr) minmax(140px, 1.3fr) 170px",
  gap: 12,
  alignItems: "start",
};

function ReturnRow({ r, isMobile, isLast }: { r: ReturnCase; isMobile: boolean; isLast: boolean }) {
  const st = STATUS[r.status];
  const status = (
    <span style={{ display: "inline-block", fontSize: 11.5, fontWeight: 500, color: st.color, background: st.bg, borderRadius: 20, padding: "3px 9px", whiteSpace: "nowrap" }}>
      {st.label}
    </span>
  );
  const cases = (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{r.caseCount} case{r.caseCount === 1 ? "" : "s"}</div>
      {r.caseNumbers.length > 0 && (
        <div style={{ fontSize: 12, color: "#3a3a3a", fontFamily: "monospace", marginTop: 2, wordBreak: "break-word" }}>{r.caseNumbers.join(", ")}</div>
      )}
      {r.note && <div style={{ fontSize: 12, color: "#5F5E5A", fontStyle: "italic", marginTop: 2 }}>{r.note}</div>}
    </div>
  );
  const when = (
    <div style={{ fontSize: 11.5, color: "#9a9a9a", marginTop: 2 }}>
      Picked up {timeLabel(r.pickedUpAt)}
      {r.droppedAt && <> · dropped {timeLabel(r.droppedAt)}</>}
    </div>
  );

  if (isMobile) {
    return (
      <div style={{ padding: "12px 14px", borderBottom: isLast ? "none" : "1px solid rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "#185FA5", fontFamily: "monospace" }}>RET-{r.number}</span>
          {status}
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1a1a1a" }}>{r.officeName ?? "Office"}</div>
        <div style={{ fontSize: 12.5, color: "#3a3a3a" }}>{r.driverName ?? "Driver"}</div>
        {cases}
        {when}
      </div>
    );
  }

  return (
    <div style={{ ...rowGrid, padding: "12px 16px", borderBottom: isLast ? "none" : "1px solid rgba(0,0,0,0.06)" }}>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "#185FA5", fontFamily: "monospace" }}>RET-{r.number}</div>
        {when}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "#1a1a1a", fontWeight: 500 }}>{r.officeName ?? "Office"}</div>
        {r.pickedUpDuringCaseId && (
          <div style={{ fontSize: 11.5, color: "#9a9a9a", marginTop: 2 }}>During delivery of {r.pickedUpDuringCaseId}</div>
        )}
      </div>
      <div style={{ fontSize: 13, color: "#3a3a3a" }}>{r.driverName ?? "—"}</div>
      {cases}
      <div>{status}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 12, fontWeight: active ? 600 : 400, padding: "5px 12px", borderRadius: 20, cursor: "pointer",
        border: `1px solid ${active ? "#185FA5" : "rgba(0,0,0,0.12)"}`,
        background: active ? "#EBF2FA" : "#FFFFFF",
        color: active ? "#185FA5" : "#3a3a3a",
      }}
    >
      {children}
    </button>
  );
}
