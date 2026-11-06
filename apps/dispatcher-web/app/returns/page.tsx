"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import HelpLink from "@/components/help-link";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useAuth } from "@/context/auth";
import { useMessageNotifications } from "@/context/message-notifications";
import { useSearch } from "@/context/search";
import type { ApiResponse } from "@gepeto/types";
import { GroupDivider, SortHeader, byRank, byText, groupRows, sortRows, useSort, type Comparators } from "@/lib/sorting";

// ── Types ─────────────────────────────────────────────────────────────────────

type ReturnStatus = "requested" | "with_driver" | "at_lab" | "checked_in" | "cancelled";

interface ReturnCase {
  id: string;
  number: number;
  status: ReturnStatus;
  officeId: string;
  officeName: string | null;
  driverId: string | null;
  driverName: string | null;
  driverResponse: "pending" | "accepted";
  caseCount: number;
  caseNumbers: string[];
  note: string | null;
  pickedUpAt: string | null;
  droppedAt: string | null;
  // Office pickup requests
  requestedAt: string | null;
  readyAt: string | null;
  pickedUpDuringCaseId: string | null;
  // Set at check-in
  receivedCount: number | null;
  caseId: string | null;
  sourceCaseId: string | null;
  checkedInAt: string | null;
}

type Filter = "open" | "requested" | "with_driver" | "at_lab" | "checked_in";

// Sortable headers. Status follows what the front desk does first: requests,
// then check-ins, then cases still with drivers. Cases: most first.
const SORT_KEYS = ["number", "office", "driver", "cases", "status"] as const;
type SortKey = (typeof SORT_KEYS)[number];
const RETURN_SORTS: Comparators<ReturnCase, SortKey> = {
  number: (a, b) => a.number - b.number,
  office: byText((r) => r.officeName),
  driver: byText((r) => r.driverName),
  cases:  (a, b) => b.caseCount - a.caseCount,
  status: byRank((r) => r.status, ["requested", "at_lab", "with_driver", "checked_in", "cancelled"]),
};
const HEADERS: [string, SortKey | undefined][] = [
  ["Return", "number"], ["Office", "office"], ["Driver", "driver"], ["Cases", "cases"], ["Status", "status"], ["", undefined],
];

interface DriverOption {
  id: string;
  name: string;
  status: string;
}

const CHECKED_IN_DAYS = 30;

// The table's six columns need this much room beside the sidebar. Below it,
// each return is a card, so nothing runs off the right edge.
const STACKED_QUERY = "(max-width: 1279px)";
const subscribeStacked = (onChange: () => void) => {
  const q = window.matchMedia(STACKED_QUERY);
  q.addEventListener("change", onChange);
  return () => q.removeEventListener("change", onChange);
};

const STATUS: Record<ReturnStatus, { label: string; color: string; bg: string }> = {
  requested:   { label: "Pickup requested",         color: "#854F0B", bg: "rgba(133,79,11,0.12)" },
  cancelled:   { label: "Cancelled",                color: "#5F5E5A", bg: "rgba(0,0,0,0.06)" },
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
  const stacked = useSyncExternalStore(subscribeStacked, () => window.matchMedia(STACKED_QUERY).matches, () => false);
  const { apiFetch, session } = useAuth();
  const { returnsSummary, returnsChangedAt } = useMessageNotifications();

  const [returns, setReturns] = useState<ReturnCase[]>([]);
  const [checkedIn, setCheckedIn] = useState<ReturnCase[] | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>("open");
  const { sort, toggle: toggleSort } = useSort<SortKey>("gepeto.sort.returns", SORT_KEYS);
  const { target: searchTarget } = useSearch();
  // Picked from global search: switch to a filter that shows that return.
  useEffect(() => {
    if (searchTarget?.kind !== "return") return;
    setFilter(searchTarget.status === "checked_in" ? "checked_in" : "open");
  }, [searchTarget]);
  const [checkInFor, setCheckInFor] = useState<ReturnCase | null>(null);
  const [historyFor, setHistoryFor] = useState<ReturnCase | null>(null);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [requesting, setRequesting] = useState(false);

  // Drivers for the Assign dropdown on pickup requests.
  useEffect(() => {
    if (!session) return;
    apiFetch<ApiResponse<DriverOption[]>>("/api/drivers")
      .then((res) => { if (res.data) setDrivers(res.data); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const assignPickup = async (r: ReturnCase, driverId: string | null) => {
    setRowError(null);
    const res = await apiFetch<ApiResponse<ReturnCase>>(`/api/returns/${r.id}/assign`, {
      method: "POST",
      body: JSON.stringify({ driverId }),
    }).catch(() => null);
    if (res?.data) setReturns((prev) => prev.map((x) => (x.id === r.id ? res.data! : x)));
    else setRowError({ id: r.id, message: res?.error?.message ?? "Couldn't assign. Try again." });
  };

  const cancelPickup = async (r: ReturnCase) => {
    if (!window.confirm(`Cancel the pickup request from ${r.officeName ?? "this office"}?`)) return;
    setRowError(null);
    const res = await apiFetch<ApiResponse<{ ok: boolean }>>(`/api/returns/${r.id}/cancel`, { method: "POST" }).catch(() => null);
    if (res?.data) setReturns((prev) => prev.filter((x) => x.id !== r.id));
    else setRowError({ id: r.id, message: res?.error?.message ?? "Couldn't cancel. Try again." });
  };

  // Fixes after pickup: a different driver, or undoing a drop-off or check-in.
  const correctReturn = async (r: ReturnCase, fix: { driverId: string } | { undo: "drop_off" | "check_in" }) => {
    setRowError(null);
    const res = await apiFetch<ApiResponse<ReturnCase>>(`/api/returns/${r.id}/correct`, {
      method: "POST",
      body: JSON.stringify(fix),
    }).catch(() => null);
    if (!res?.data) {
      setRowError({ id: r.id, message: res?.error?.message ?? "Couldn't make that change. Try again." });
      return;
    }
    const updated = res.data;
    setReturns((prev) => {
      const others = prev.filter((x) => x.id !== updated.id);
      return prev.length === others.length ? [updated, ...others] : prev.map((x) => (x.id === updated.id ? updated : x));
    });
    setCheckedIn((prev) => (prev ? prev.filter((x) => x.id !== updated.id) : prev));
  };

  const changeDriver = (r: ReturnCase, driverId: string) => {
    const name = drivers.find((d) => d.id === driverId)?.name ?? "this driver";
    if (!window.confirm(`Change the driver on RET-${r.number} to ${name}? This is recorded in the return's history.`)) return;
    correctReturn(r, { driverId });
  };

  const undoDropOff = (r: ReturnCase) => {
    if (!window.confirm(`Undo the drop-off for RET-${r.number}? It goes back to With driver.`)) return;
    correctReturn(r, { undo: "drop_off" });
  };

  const undoCheckIn = (r: ReturnCase) => {
    if (!window.confirm(`Undo the check-in for RET-${r.number}? It goes back to needing check-in, and you'll enter its details again. The old details stay in its history.`)) return;
    correctReturn(r, { undo: "check_in" });
  };

  const onRequested = (created: ReturnCase) => {
    setReturns((prev) => [created, ...prev.filter((x) => x.id !== created.id)]);
    setFilter("open");
    setRequesting(false);
  };

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
  // What the front desk acts on first: pickups with no driver, then check-ins.
  const priority = (r: ReturnCase) =>
    r.status === "requested" && !r.driverId ? 0 : r.status === "at_lab" ? 1 : r.status === "requested" ? 2 : 3;
  const ordered = sort ? sortRows(shown, sort, RETURN_SORTS, (a, b) => priority(a) - priority(b))
    : [...shown].sort((a, b) => priority(a) - priority(b));
  // Sorted by office or driver: thin dividers between the groups.
  const groupBy = sort?.key === "office" ? (r: ReturnCase) => r.officeName || "Unknown office"
    : sort?.key === "driver" ? (r: ReturnCase) => r.driverName || "No driver yet"
    : null;
  const groups = groupBy ? groupRows(ordered, groupBy) : [{ label: "", rows: ordered }];

  const { requested, unassigned, withDriver, withDriverCases, atLab, atLabCases } = returnsSummary;

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
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <h1 style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", margin: 0, letterSpacing: "-0.01em" }}>
              Returning Cases
            </h1>
            <HelpLink slug="returning-cases" topic="pickups and check-in" />
          </div>
          <p style={{ fontSize: 11.5, color: "#5F5E5A", margin: 0 }}>
            {loaded
              ? [
                  unassigned > 0 && (unassigned === 1 ? "1 pickup needs a driver" : `${unassigned} pickups need a driver`),
                  `${atLabCases} case${atLabCases === 1 ? "" : "s"} waiting for check-in`,
                  `${withDriverCases} with drivers`,
                ].filter(Boolean).join(" · ")
              : "Loading returns…"}
          </p>
        </div>
        <button onClick={() => setRequesting(true)} style={{ ...primaryBtn(true), padding: "7px 14px" }}>Request pickup</button>
      </header>

      <div style={{ padding: isMobile ? 12 : "20px 28px", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Filters */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Chip active={filter === "open"} onClick={() => setFilter("open")}>All open · {requested + withDriver + atLab}</Chip>
          <Chip active={filter === "requested"} onClick={() => setFilter("requested")}>Pickups requested · {requested}</Chip>
          <Chip active={filter === "at_lab"} onClick={() => setFilter("at_lab")}>At lab · {atLab}</Chip>
          <Chip active={filter === "with_driver"} onClick={() => setFilter("with_driver")}>With drivers · {withDriver}</Chip>
          <Chip active={filter === "checked_in"} onClick={() => setFilter("checked_in")}>Checked in · last {CHECKED_IN_DAYS} days</Chip>
        </div>

        <div style={{
          background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12,
          boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden",
        }}>
          {!stacked && (
            <div style={{ ...rowGrid, padding: "8px 16px", background: "#FAFAFA", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              {HEADERS.map(([label, key], i) => (
                <SortHeader key={i} label={label} sortKey={key} sort={sort} onToggle={toggleSort} />
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
            groups.map((g) => (
              <div key={g.label || "all"}>
              {groupBy && <GroupDivider label={g.label} count={g.rows.length} noun="return" />}
              {g.rows.map((r) => (
              <div key={r.id} id={`search-return-${r.id}`}>
              <ReturnRow
                r={r}
                isMobile={isMobile}
                stacked={stacked}
                isLast={r === ordered[ordered.length - 1]}
                onCheckIn={() => setCheckInFor(r)}
                onHistory={() => setHistoryFor(r)}
                drivers={drivers}
                onAssign={(driverId) => assignPickup(r, driverId)}
                onCancel={() => cancelPickup(r)}
                onChangeDriver={(driverId) => changeDriver(r, driverId)}
                onUndoDropOff={() => undoDropOff(r)}
                onUndoCheckIn={() => undoCheckIn(r)}
                error={rowError?.id === r.id ? rowError.message : null}
              />
              </div>
              ))}
              </div>
            ))
          )}
        </div>
      </div>

      {checkInFor && (
        <CheckInModal r={checkInFor} onClose={() => setCheckInFor(null)} onDone={onCheckedIn} />
      )}
      {historyFor && <ReturnHistoryModal r={historyFor} onClose={() => setHistoryFor(null)} />}
      {requesting && <RequestPickupModal onClose={() => setRequesting(false)} onDone={onRequested} />}
    </div>
  );
}

// ── Pieces ────────────────────────────────────────────────────────────────────

const rowGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "110px minmax(130px, 1.1fr) minmax(140px, 190px) minmax(130px, 1.2fr) 190px 170px",
  gap: 12,
  alignItems: "start",
};

function ReturnRow({
  r, isMobile, stacked, isLast, onCheckIn, onHistory, drivers, onAssign, onCancel, onChangeDriver, onUndoDropOff, onUndoCheckIn, error,
}: {
  r: ReturnCase; isMobile: boolean; stacked: boolean; isLast: boolean; onCheckIn: () => void; onHistory: () => void;
  drivers: DriverOption[]; onAssign: (driverId: string | null) => void; onCancel: () => void;
  onChangeDriver: (driverId: string) => void; onUndoDropOff: () => void; onUndoCheckIn: () => void; error: string | null;
}) {
  const isRequest = r.status === "requested";
  const canChangeDriver = r.status === "with_driver" || r.status === "at_lab";
  const st = isRequest && r.driverId
    ? r.driverResponse === "accepted"
      ? { label: "Driver accepted", color: "#185FA5", bg: "rgba(24,95,165,0.10)" }
      : { label: "Waiting for driver to accept", color: "#854F0B", bg: "rgba(133,79,11,0.10)" }
    : STATUS[r.status];
  // The driver is edited where it's read, in the Driver column.
  const driverCell = isRequest || canChangeDriver ? (
    <select
      value={r.driverId ?? ""}
      onChange={(e) => {
        if (isRequest) onAssign(e.target.value || null);
        else if (e.target.value) onChangeDriver(e.target.value);
      }}
      aria-label={`Driver for RET-${r.number}`}
      style={{
        width: "100%", maxWidth: isMobile ? "none" : stacked ? 320 : 190, boxSizing: "border-box", cursor: "pointer", color: "#1a1a1a",
        fontSize: isMobile ? 16 : 12.5, padding: isMobile ? "8px 10px" : "6px 8px", borderRadius: 7,
        border: `1px solid ${r.driverId ? "rgba(0,0,0,0.15)" : "#854F0B"}`,
        background: r.driverId ? "#fff" : "rgba(133,79,11,0.06)",
      }}
    >
      {(isRequest || !r.driverId) && <option value="">{isRequest ? "Assign driver…" : "Choose driver…"}</option>}
      {drivers.map((d) => (
        <option key={d.id} value={d.id}>{d.name}{d.status === "off_duty" ? " (off duty)" : ""}</option>
      ))}
    </select>
  ) : (
    <div style={{ fontSize: 13, color: r.driverName ? "#3a3a3a" : "#9a9a9a" }}>{r.driverName ?? "—"}</div>
  );
  // One main action at most. Everything else stays quiet underneath it.
  const canCheckIn = r.status === "with_driver" || r.status === "at_lab";
  const actions = (
    <div style={{
      display: "flex", gap: stacked ? 8 : 4,
      flexDirection: stacked ? "row" : "column",
      alignItems: stacked ? "center" : "flex-end",
      justifyContent: stacked ? "space-between" : "flex-start",
      flexWrap: "wrap",
    }}>
      {canCheckIn && <button onClick={onCheckIn} style={primaryBtn(r.status === "at_lab")}>Check in</button>}
      <div style={{ display: "flex", gap: isMobile ? 4 : 2, marginLeft: stacked ? "auto" : 0, marginRight: -6 }}>
        {isRequest && <button onClick={onCancel} style={linkBtn(isMobile)}>Cancel</button>}
        {r.status === "at_lab" && <button onClick={onUndoDropOff} style={linkBtn(isMobile)}>Undo drop-off</button>}
        {r.status === "checked_in" && <button onClick={onUndoCheckIn} style={linkBtn(isMobile)}>Undo check-in</button>}
        <button onClick={onHistory} style={linkBtn(isMobile)}>History</button>
      </div>
      {error && <span style={{ fontSize: 11.5, color: "#A32D2D", flexBasis: "100%", textAlign: stacked ? "left" : "right" }}>{error}</span>}
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
  const readyLater = r.readyAt && new Date(r.readyAt) > new Date();
  const when = (
    <div style={{ fontSize: 11.5, color: "#9a9a9a", marginTop: 2 }}>
      {r.pickedUpAt
        ? <>Picked up {timeLabel(r.pickedUpAt)}</>
        : r.requestedAt && <>Requested {timeLabel(r.requestedAt)}</>}
      {r.droppedAt && <> · dropped {timeLabel(r.droppedAt)}</>}
      {isRequest && (
        <div style={{ color: readyLater ? "#5F5E5A" : "#3B6D11", fontWeight: 500 }}>
          {readyLater ? `Ready after ${timeLabel(r.readyAt!)}` : "Ready now"}
        </div>
      )}
    </div>
  );

  if (stacked) {
    return (
      <div style={{ padding: "12px 14px", borderBottom: isLast ? "none" : "1px solid rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "#185FA5", fontFamily: "monospace" }}>RET-{r.number}</span>
          {status}
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1a1a1a" }}>{r.officeName ?? "Office"}</div>
        {driverCell}
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
      <div style={{ minWidth: 0 }}>{driverCell}</div>
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

const linkBtn = (isMobile: boolean): React.CSSProperties => ({
  fontSize: 12, padding: isMobile ? "8px 6px" : "4px 6px", border: "none", background: "none", cursor: "pointer",
  color: "#5F5E5A", textDecoration: "underline", textDecorationColor: "rgba(0,0,0,0.25)", textUnderlineOffset: 2, whiteSpace: "nowrap",
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

interface OfficeOption {
  id: string;
  name: string;
}

function timeInputValue(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// For an office that asked outside the app, usually by phone. The result is the
// same pickup request an office makes from its tracking page.
function RequestPickupModal({ onClose, onDone }: {
  onClose: () => void; onDone: (created: ReturnCase) => void;
}) {
  const { apiFetch } = useAuth();
  const [offices, setOffices] = useState<OfficeOption[] | null>(null);
  const [officeId, setOfficeId] = useState("");
  const [count, setCount] = useState(1);
  const [caseText, setCaseText] = useState("");
  const [note, setNote] = useState("");
  const [when, setWhen] = useState<"now" | "later">("now");
  const [laterTime, setLaterTime] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
    return timeInputValue(d);
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ApiResponse<OfficeOption[]>>("/api/offices")
      .then((res) => setOffices(res.data ?? []))
      .catch(() => setOffices([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!officeId) { setError("Choose the office these cases are coming from."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch<ApiResponse<ReturnCase>>("/api/returns/request", {
        method: "POST",
        body: JSON.stringify({
          officeId,
          caseCount: Math.max(count, caseNumbers.length),
          caseNumbers,
          note,
          readyAt: readyAt ? readyAt.toISOString() : null,
        }),
      });
      if (res.data) onDone(res.data);
      else setError(res.error?.message ?? "Couldn't create the pickup.");
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalFrame title="Request a pickup" subtitle="For an office that called or emailed. Assign a driver once it's added." onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label htmlFor="request-office" style={fieldLabel}>Office</label>
          <select
            id="request-office"
            value={officeId}
            onChange={(e) => setOfficeId(e.target.value)}
            disabled={offices === null}
            style={{ ...textInput, appearance: "auto" }}
          >
            <option value="">{offices === null ? "Loading offices…" : offices.length === 0 ? "No offices yet" : "Choose an office…"}</option>
            {(offices ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>

        <div>
          <span style={fieldLabel}>Number of cases</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button aria-label="One fewer" onClick={() => setCount((n) => Math.max(1, n - 1))} style={stepBtn}>−</button>
            <span aria-live="polite" style={{ fontSize: 18, fontWeight: 600, minWidth: 28, textAlign: "center", color: "#1a1a1a" }}>{Math.max(count, caseNumbers.length)}</span>
            <button aria-label="One more" onClick={() => setCount((n) => Math.min(99, n + 1))} style={stepBtn}>+</button>
          </div>
        </div>

        <div>
          <label htmlFor="request-cases" style={fieldLabel}>
            Case numbers <span style={{ fontWeight: 400, color: "#9a9a9a" }}>(optional)</span>
          </label>
          <input
            id="request-cases"
            value={caseText}
            onChange={(e) => setCaseText(e.target.value)}
            placeholder="e.g. LAB-2042, LAB-2043"
            style={textInput}
          />
          <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "#9a9a9a" }}>Use case numbers, not patient names.</p>
        </div>

        <div>
          <span style={fieldLabel}>When are they ready?</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <Chip active={when === "now"} onClick={() => setWhen("now")}>Ready now</Chip>
            <Chip active={when === "later"} onClick={() => setWhen("later")}>Ready after…</Chip>
            {when === "later" && (
              <input type="time" value={laterTime} onChange={(e) => setLaterTime(e.target.value)} aria-label="Ready after" style={{ ...textInput, width: "auto" }} />
            )}
          </div>
          {readyAt && (
            <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "#9a9a9a" }}>
              Ready {readyAt.toDateString() === new Date().toDateString() ? "today" : "tomorrow"} after {readyAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="request-note" style={fieldLabel}>
            Note <span style={{ fontWeight: 400, color: "#9a9a9a" }}>(optional)</span>
          </label>
          <input
            id="request-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="e.g. Leave at the front desk"
            style={textInput}
          />
        </div>

        {error && <p style={{ margin: 0, fontSize: 12.5, color: "#A32D2D" }}>{error}</p>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ ...primaryBtn(true), opacity: saving ? 0.6 : 1, padding: "7px 16px" }}>
            {saving ? "Adding…" : "Request pickup"}
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
  event: "requested" | "assigned" | "driver_accepted" | "driver_rejected" | "cancelled" | "logged" | "dropped_at_lab" | "checked_in" | "linked" | "redelivery_created" | "edited";
  detail: {
    caseCount?: number; receivedCount?: number; caseId?: string; caseNumbers?: string[]; fromStatus?: string;
    requestedCount?: number; fulfilledRequest?: boolean; readyAt?: string | null; driverId?: string | null;
    correction?: "driver" | "undo_drop_off" | "undo_check_in"; previousDriverName?: string | null;
  } | null;
  actorRole: "driver" | "dispatcher" | "office";
  assignedDriverName: string | null;
  actorName: string | null;
  linkedCaseId: string | null;
  createdAt: string;
}

function describeEvent(e: ReturnEvent): React.ReactNode {
  const d = e.detail ?? {};
  switch (e.event) {
    case "requested":
      return (
        <>
          <strong>Pickup requested</strong>: {d.caseCount} case{d.caseCount === 1 ? "" : "s"}
          {d.caseNumbers?.length ? <> ({d.caseNumbers.join(", ")})</> : null}
          {d.readyAt ? <>, ready after {timeLabel(d.readyAt)}</> : <>, ready now</>}
        </>
      );
    case "assigned":
      return d.driverId ? <>Assigned to <strong>{e.assignedDriverName ?? "a driver"}</strong></> : <>Driver unassigned</>;
    case "driver_accepted":
      return <>Driver accepted the pickup</>;
    case "driver_rejected":
      return <><strong>Driver rejected the pickup</strong></>;
    case "cancelled":
      return <><strong>Pickup cancelled</strong></>;
    case "logged":
      return (
        <>
          {d.fulfilledRequest ? "Picked up" : "Logged"} <strong>{d.caseCount} case{d.caseCount === 1 ? "" : "s"}</strong> at the office
          {d.caseNumbers?.length ? <> ({d.caseNumbers.join(", ")})</> : null}
          {d.fulfilledRequest && d.requestedCount !== undefined && d.requestedCount !== d.caseCount && (
            <span style={{ color: "#854F0B" }}> (office said {d.requestedCount})</span>
          )}
        </>
      );
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
      if (d.correction === "driver") {
        return <><strong>Driver corrected</strong>{d.previousDriverName ? <> from {d.previousDriverName}</> : null} to <strong>{e.assignedDriverName ?? "another driver"}</strong></>;
      }
      if (d.correction === "undo_drop_off") return <><strong>Drop-off undone</strong>: back with the driver</>;
      if (d.correction === "undo_check_in") {
        return (
          <>
            <strong>Check-in undone</strong>
            {d.caseId && <>: it was <span style={{ fontFamily: "monospace" }}>{d.caseId}</span>, received {d.receivedCount}</>}
          </>
        );
      }
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
                <span style={{ color: "#5F5E5A" }}>
                  {e.actorRole === "office"
                    ? " by the office"
                    : ` by ${e.actorName ?? "Unknown"} (${e.actorRole === "driver" ? "Driver" : "Dispatcher"})`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </ModalFrame>
  );
}
