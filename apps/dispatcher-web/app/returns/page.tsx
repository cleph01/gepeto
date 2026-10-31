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
  officeId: string;
  officeName: string | null;
  driverName: string | null;
  caseCount: number;
  caseNumbers: string[];
  note: string | null;
  pickedUpAt: string;
  droppedAt: string | null;
  pickedUpDuringCaseId: string | null;
  // Set at check-in
  receivedCount: number | null;
  caseId: string | null;
  sourceCaseId: string | null;
  checkedInAt: string | null;
}

type Filter = "open" | "with_driver" | "at_lab" | "checked_in";

const CHECKED_IN_DAYS = 30;

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
  const [checkedIn, setCheckedIn] = useState<ReturnCase[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>("open");
  const [checkInFor, setCheckInFor] = useState<ReturnCase | null>(null);
  const [historyFor, setHistoryFor] = useState<ReturnCase | null>(null);

  // Load on open, and again whenever a return is logged, dropped off or checked in.
  useEffect(() => {
    if (!session) return;
    apiFetch<ApiResponse<ReturnCase[]>>("/api/returns?status=open")
      .then((res) => { if (res.data) setReturns(res.data); })
      .catch(() => {})
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, returnsChangedAt]);

  // Checked-in returns (last CHECKED_IN_DAYS days), only fetched once that filter is opened.
  useEffect(() => {
    if (!session || filter !== "checked_in") return;
    const from = new Date(Date.now() - CHECKED_IN_DAYS * 24 * 60 * 60 * 1000).toISOString();
    apiFetch<ApiResponse<ReturnCase[]>>(`/api/returns?status=checked_in&from=${encodeURIComponent(from)}`)
      .then((res) => { if (res.data) setCheckedIn(res.data); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, filter, returnsChangedAt]);

  const onCheckedIn = (updated: ReturnCase) => {
    setReturns((prev) => prev.filter((r) => r.id !== updated.id));
    setCheckedIn((prev) => (prev ? [updated, ...prev] : prev));
    setCheckInFor(null);
  };

  const shown =
    filter === "checked_in" ? checkedIn ?? []
    : filter === "open" ? returns
    : returns.filter((r) => r.status === filter);
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
          <Chip active={filter === "checked_in"} onClick={() => setFilter("checked_in")}>Checked in · last {CHECKED_IN_DAYS} days</Chip>
        </div>

        <div style={{
          background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12,
          boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden",
        }}>
          {!isMobile && (
            <div style={{ ...rowGrid, padding: "8px 16px", background: "#FAFAFA", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              {["Return", "Office", "Driver", "Cases", "Status", ""].map((c) => (
                <span key={c} style={{ fontSize: 11, fontWeight: 500, color: "#5F5E5A", textTransform: "uppercase", letterSpacing: "0.04em" }}>{c}</span>
              ))}
            </div>
          )}

          {ordered.length === 0 ? (
            <div style={{ padding: "40px 16px", textAlign: "center", color: "#9a9a9a", fontSize: 13 }}>
              {!loaded || (filter === "checked_in" && checkedIn === null)
                ? "Loading returns…"
                : filter === "checked_in"
                  ? `Nothing checked in during the last ${CHECKED_IN_DAYS} days.`
                : filter === "open"
                  ? "No cases on their way back. When a driver picks up cases at an office, they'll show up here."
                  : "Nothing here right now."}
            </div>
          ) : (
            ordered.map((r, i) => (
              <ReturnRow
                key={r.id}
                r={r}
                isMobile={isMobile}
                isLast={i === ordered.length - 1}
                onCheckIn={() => setCheckInFor(r)}
                onHistory={() => setHistoryFor(r)}
              />
            ))
          )}
        </div>
      </div>

      {checkInFor && (
        <CheckInModal r={checkInFor} onClose={() => setCheckInFor(null)} onDone={onCheckedIn} />
      )}
      {historyFor && <ReturnHistoryModal r={historyFor} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────────────

const rowGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "120px minmax(140px, 1.2fr) minmax(110px, 1fr) minmax(140px, 1.3fr) 170px 150px",
  gap: 12,
  alignItems: "start",
};

function ReturnRow({
  r, isMobile, isLast, onCheckIn, onHistory,
}: {
  r: ReturnCase; isMobile: boolean; isLast: boolean; onCheckIn: () => void; onHistory: () => void;
}) {
  const st = STATUS[r.status];
  const actions = (
    <div style={{ display: "flex", gap: 6, justifyContent: isMobile ? "flex-start" : "flex-end", flexWrap: "wrap" }}>
      {r.status !== "checked_in" && (
        <button onClick={onCheckIn} style={primaryBtn(r.status === "at_lab")}>Check in</button>
      )}
      <button onClick={onHistory} style={ghostBtn}>History</button>
    </div>
  );
  const checkInDetail = r.status === "checked_in" && (
    <div style={{ fontSize: 11.5, color: "#3B6D11", marginTop: 4, lineHeight: 1.4 }}>
      {r.caseId && <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{r.caseId}</span>}
      {r.receivedCount !== null && r.receivedCount !== r.caseCount && (
        <span style={{ color: "#854F0B" }}> · received {r.receivedCount} of {r.caseCount}</span>
      )}
      {r.sourceCaseId && <span style={{ color: "#5F5E5A" }}> · came back from {r.sourceCaseId}</span>}
      {r.checkedInAt && <div style={{ color: "#9a9a9a" }}>Checked in {timeLabel(r.checkedInAt)}</div>}
    </div>
  );
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
      {checkInDetail}
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
        {actions}
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
      {actions}
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

const primaryBtn = (emphasis: boolean): React.CSSProperties => ({
  fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 7, cursor: "pointer",
  border: emphasis ? "none" : "1px solid #185FA5",
  background: emphasis ? "#185FA5" : "#FFFFFF",
  color: emphasis ? "#FFFFFF" : "#185FA5",
  whiteSpace: "nowrap",
});

const ghostBtn: React.CSSProperties = {
  fontSize: 12, padding: "5px 10px", borderRadius: 7, cursor: "pointer",
  border: "1px solid rgba(0,0,0,0.12)", background: "#FFFFFF", color: "#3a3a3a",
};

// ── Modals ────────────────────────────────────────────────────────────────────

function ModalFrame({ title, subtitle, onClose, children }: {
  title: string; subtitle: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(2px)",
      }}
    >
      <div style={{
        background: "#fff", borderRadius: 14, width: "100%", maxWidth: 460, margin: "0 16px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.18)", overflow: "hidden", maxHeight: "85vh",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{
          padding: "18px 20px 14px", borderBottom: "1px solid rgba(0,0,0,0.07)",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em" }}>{title}</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#5F5E5A" }}>{subtitle}</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "#9a9a9a", padding: 4, borderRadius: 6, display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div style={{ padding: "16px 20px 20px", overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
}

const fieldLabel: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#3a3a3a", marginBottom: 6 };
const textInput: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", fontSize: 13.5, padding: "8px 10px", borderRadius: 8,
  border: "1px solid rgba(0,0,0,0.15)", color: "#1a1a1a", background: "#fff", outline: "none",
};

interface JobOption {
  id: string;
  caseId: string;
  officeId: string;
  status: string;
  createdAt: string;
  deliveredAt: string | null;
}

const SOURCE_JOB_DAYS = 120;

function CheckInModal({ r, onClose, onDone }: {
  r: ReturnCase; onClose: () => void; onDone: (updated: ReturnCase) => void;
}) {
  const { apiFetch } = useAuth();
  const [received, setReceived] = useState(r.caseCount);
  // A single driver-typed case number is almost certainly the one to use.
  const [caseId, setCaseId] = useState(r.caseNumbers.length === 1 ? r.caseNumbers[0] : "");
  const [sourceJobId, setSourceJobId] = useState("");
  const [jobs, setJobs] = useState<JobOption[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Candidate "came back from" jobs: this office's jobs from the last few
  // months, with any whose case number the driver typed (or that matches the
  // case number entered here) listed first.
  useEffect(() => {
    apiFetch<ApiResponse<JobOption[]>>("/api/jobs")
      .then((res) => {
        const cutoff = Date.now() - SOURCE_JOB_DAYS * 24 * 60 * 60 * 1000;
        setJobs((res.data ?? []).filter((j) => j.officeId === r.officeId && new Date(j.createdAt).getTime() >= cutoff));
      })
      .catch(() => setJobs([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.id]);

  const typed = new Set([...r.caseNumbers, caseId.trim().toUpperCase()].filter(Boolean));
  const isMatch = (j: JobOption) => typed.has(j.caseId.toUpperCase());
  const options = [...(jobs ?? [])].sort((a, b) =>
    Number(isMatch(b)) - Number(isMatch(a)) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const mismatch = received !== r.caseCount;

  const submit = async () => {
    if (!caseId.trim()) { setError("Enter the lab case number for this return."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch<ApiResponse<ReturnCase>>(`/api/returns/${r.id}/check-in`, {
        method: "POST",
        body: JSON.stringify({ receivedCount: received, caseId: caseId.trim(), sourceJobId: sourceJobId || null }),
      });
      if (res.data) onDone(res.data);
      else setError(res.error?.message ?? "Couldn't check in this return.");
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalFrame title={`Check in RET-${r.number}`} subtitle={`${r.officeName ?? "Office"} · picked up by ${r.driverName ?? "driver"}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* What the driver logged */}
        <div style={{ background: "#F8F9FB", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: "#3a3a3a", lineHeight: 1.5 }}>
          <div>
            Driver logged <strong>{r.caseCount} case{r.caseCount === 1 ? "" : "s"}</strong>
            {r.status === "with_driver" && <span style={{ color: "#854F0B" }}> · not marked dropped off yet</span>}
          </div>
          {r.caseNumbers.length > 0 && <div style={{ fontFamily: "monospace" }}>{r.caseNumbers.join(", ")}</div>}
          {r.note && <div style={{ fontStyle: "italic", color: "#5F5E5A" }}>&ldquo;{r.note}&rdquo;</div>}
        </div>

        {/* Received count */}
        <div>
          <span style={fieldLabel}>Cases received</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button aria-label="One fewer" onClick={() => setReceived((n) => Math.max(0, n - 1))} style={stepBtn}>−</button>
            <span aria-live="polite" style={{ fontSize: 18, fontWeight: 600, minWidth: 28, textAlign: "center", color: "#1a1a1a" }}>{received}</span>
            <button aria-label="One more" onClick={() => setReceived((n) => Math.min(99, n + 1))} style={stepBtn}>+</button>
          </div>
          {mismatch && (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#854F0B" }}>
              {received === 0
                ? "Nothing received. This return will be recorded as checked in with 0 cases."
                : `Driver logged ${r.caseCount}, you received ${received}. The difference is recorded in the return's history.`}
            </p>
          )}
        </div>

        {/* Case number */}
        <div>
          <label htmlFor="checkin-case" style={fieldLabel}>Lab case number</label>
          <input
            id="checkin-case"
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            placeholder="e.g. LAB-2042"
            style={textInput}
            autoFocus
          />
          {r.caseNumbers.length > 1 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {r.caseNumbers.map((n) => (
                <button key={n} onClick={() => setCaseId(n)} style={{ ...ghostBtn, fontFamily: "monospace", padding: "3px 8px" }}>{n}</button>
              ))}
            </div>
          )}
          <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "#9a9a9a" }}>Use your lab&apos;s case number, not patient names.</p>
        </div>

        {/* Came back from */}
        <div>
          <label htmlFor="checkin-source" style={fieldLabel}>
            Came back from <span style={{ fontWeight: 400, color: "#9a9a9a" }}>(optional)</span>
          </label>
          <select
            id="checkin-source"
            value={sourceJobId}
            onChange={(e) => setSourceJobId(e.target.value)}
            style={{ ...textInput, appearance: "auto" }}
            disabled={jobs === null}
          >
            <option value="">{jobs === null ? "Loading jobs…" : options.length === 0 ? "No recent jobs for this office" : "Not linked"}</option>
            {options.map((j) => (
              <option key={j.id} value={j.id}>
                {isMatch(j) ? "★ " : ""}{j.caseId} · {new Date(j.deliveredAt ?? j.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {j.status === "delivered" ? "" : ` · ${j.status.replace("_", " ")}`}
              </option>
            ))}
          </select>
          <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "#9a9a9a" }}>
            The original delivery for this case, if it&apos;s a remake or adjustment. ★ matches a case number above.
          </p>
        </div>

        {error && <p style={{ margin: 0, fontSize: 12.5, color: "#A32D2D" }}>{error}</p>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ ...primaryBtn(true), opacity: saving ? 0.6 : 1, padding: "7px 16px" }}>
            {saving ? "Checking in…" : `Check in ${received} case${received === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}

const stepBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)", background: "#fff",
  fontSize: 18, lineHeight: "18px", cursor: "pointer", color: "#1a1a1a",
};

interface ReturnEvent {
  id: string;
  event: "logged" | "dropped_at_lab" | "checked_in" | "linked" | "redelivery_created" | "edited";
  detail: { caseCount?: number; receivedCount?: number; caseId?: string; caseNumbers?: string[]; fromStatus?: string } | null;
  actorRole: "driver" | "dispatcher";
  actorName: string | null;
  linkedCaseId: string | null;
  createdAt: string;
}

function describeEvent(e: ReturnEvent): React.ReactNode {
  const d = e.detail ?? {};
  switch (e.event) {
    case "logged":
      return <>Logged <strong>{d.caseCount} case{d.caseCount === 1 ? "" : "s"}</strong> at the office{d.caseNumbers?.length ? <> ({d.caseNumbers.join(", ")})</> : null}</>;
    case "dropped_at_lab":
      return <>Dropped off at the lab</>;
    case "checked_in":
      return (
        <>
          <strong>Checked in</strong> as <span style={{ fontFamily: "monospace" }}>{d.caseId}</span>, received {d.receivedCount}
          {d.caseCount !== undefined && d.receivedCount !== d.caseCount && (
            <span style={{ color: "#854F0B" }}> (driver logged {d.caseCount})</span>
          )}
          {d.fromStatus === "with_driver" && <span style={{ color: "#5F5E5A" }}> · driver hadn&apos;t marked it dropped off</span>}
        </>
      );
    case "linked":
      return <>Linked to job <span style={{ fontFamily: "monospace" }}>{e.linkedCaseId ?? "(removed)"}</span></>;
    case "redelivery_created":
      return <>Redelivery job created</>;
    default:
      return <>Edited</>;
  }
}

function ReturnHistoryModal({ r, onClose }: { r: ReturnCase; onClose: () => void }) {
  const { apiFetch } = useAuth();
  const [events, setEvents] = useState<ReturnEvent[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiFetch<ApiResponse<ReturnEvent[]>>(`/api/returns/${r.id}/history`)
      .then((res) => { if (res.data) setEvents(res.data); else setFailed(true); })
      .catch(() => setFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.id]);

  return (
    <ModalFrame title="Return History" subtitle={`RET-${r.number} · ${r.officeName ?? "Office"}`} onClose={onClose}>
      {failed ? (
        <span style={{ fontSize: 12.5, color: "#A32D2D" }}>Couldn&apos;t load history.</span>
      ) : events === null ? (
        <span style={{ fontSize: 12.5, color: "#9a9a9a" }}>Loading…</span>
      ) : events.length === 0 ? (
        <span style={{ fontSize: 12.5, color: "#9a9a9a" }}>No history recorded yet.</span>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {events.map((e) => (
            <div key={e.id} style={{ fontSize: 12.5, color: "#3a3a3a", lineHeight: 1.4 }}>
              <div style={{ fontSize: 11.5, color: "#9a9a9a", marginBottom: 1 }}>
                {new Date(e.createdAt).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </div>
              <div>
                {describeEvent(e)}
                <span style={{ color: "#5F5E5A" }}> by {e.actorName ?? "Unknown"} ({e.actorRole === "driver" ? "Driver" : "Dispatcher"})</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </ModalFrame>
  );
}
