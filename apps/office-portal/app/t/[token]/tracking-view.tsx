"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import JobMap from "./job-map";
import { ChatIcon, MessageModal, unreadCount, type Message } from "./messages";

// ── Types ─────────────────────────────────────────────────────────────────────

type JobStatus = "pending" | "assigned" | "picked_up" | "in_transit" | "arrived" | "delivered";

interface TrackingJob {
  id: string;
  caseId: string;
  status: JobStatus;
  priority: "stat" | "standard";
  deliveryAddress: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  createdAt: string;
  updatedAt: string;
  driverId: string | null;
  driverName: string | null;
  /** Only sent once this driver is carrying one of the office's cases (lib/tracking.ts). */
  driverLocation: { lat: number; lng: number } | null;
}

interface RecentJob {
  id: string;
  caseId: string;
  status: "delivered";
  priority: "stat" | "standard";
  deliveryAddress: string;
  updatedAt: string;
}

interface Office {
  id: string;
  name: string;
  address: string;
  phone: string;
  contactName: string;
  labName: string;
}

interface TrackingData {
  office: Office;
  jobs: TrackingJob[];
  recentDelivered: RecentJob[];
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_STEPS: JobStatus[] = ["pending", "assigned", "picked_up", "in_transit", "arrived", "delivered"];

const STATUS_LABEL: Record<JobStatus, string> = {
  pending:    "Awaiting Pickup",
  assigned:   "Driver Assigned",
  picked_up:  "Package Picked Up",
  in_transit: "In Transit",
  arrived:    "Arrived",
  delivered:  "Delivered",
};

const STATUS_COLOR: Record<JobStatus, { bg: string; text: string; border: string }> = {
  pending:    { bg: "#FFF8F0", text: "#854F0B", border: "#F5D9B5" },
  assigned:   { bg: "#EBF2FA", text: "#185FA5", border: "#C0D9F0" },
  picked_up:  { bg: "#EBF2FA", text: "#185FA5", border: "#C0D9F0" },
  in_transit: { bg: "#EBF2FA", text: "#185FA5", border: "#C0D9F0" },
  arrived:    { bg: "#F0FAF0", text: "#3B6D11", border: "#C0E0C0" },
  delivered:  { bg: "#F0FAF0", text: "#3B6D11", border: "#C0E0C0" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function stepIndex(status: JobStatus): number {
  return STATUS_STEPS.indexOf(status);
}

const ON_THE_WAY: JobStatus[] = ["picked_up", "in_transit", "arrived"];

interface DriverGroup {
  key: string;
  driverName: string | null; // null = no driver yet
  driverLocation: { lat: number; lng: number } | null;
  jobs: TrackingJob[];
}

/** Cases grouped by driver: arrived/on-the-way first, then assigned, then unassigned. */
function groupByDriver(jobs: TrackingJob[]): DriverGroup[] {
  const groups = new Map<string, DriverGroup>();
  for (const job of jobs) {
    const key = job.driverId ?? "unassigned";
    if (!groups.has(key)) {
      groups.set(key, { key, driverName: job.driverId ? job.driverName : null, driverLocation: null, jobs: [] });
    }
    const g = groups.get(key)!;
    g.jobs.push(job);
    if (job.driverLocation) g.driverLocation = job.driverLocation;
  }
  const rank = (g: DriverGroup) => {
    if (!g.driverName) return 3;
    if (g.jobs.some((j) => j.status === "arrived")) return 0;
    if (g.jobs.some((j) => ON_THE_WAY.includes(j.status))) return 1;
    return 2;
  };
  return [...groups.values()].sort((a, b) => rank(a) - rank(b));
}

function groupSummary(g: DriverGroup): string {
  const n = g.jobs.length;
  const cases = `${n} case${n === 1 ? "" : "s"} for you`;
  if (!g.driverName) return `${cases}. The lab will assign one soon.`;
  const arrived = g.jobs.filter((j) => j.status === "arrived").length;
  const moving = g.jobs.filter((j) => ON_THE_WAY.includes(j.status)).length;
  if (arrived > 0) return `${cases} · arrived`;
  if (moving === 0) return `${cases} · assigned, not on the way yet`;
  if (moving === n) return `${cases} · on the way`;
  return `${cases} · ${moving} of ${n} on the way`;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TrackingView({
  token,
  initial,
}: {
  token: string;
  initial: TrackingData;
}) {
  const [data, setData] = useState<TrackingData>(initial);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [openThread, setOpenThread] = useState<string | null>(null);
  // Bumped when a thread is read, so unread badges (kept in localStorage) re-render.
  const [, setSeenTick] = useState(0);

  // Every active case's messages, so badges can show what's new without opening
  // anything. Small: an office rarely has more than a handful of cases in flight.
  const loadMessages = useCallback(async (jobIds: string[]) => {
    const entries = await Promise.all(
      jobIds.map(async (id) => {
        try {
          const res = await fetch(`/api/track/${token}/jobs/${id}/messages`);
          const json = res.ok ? await res.json() : null;
          return [id, (json?.data ?? null) as Message[] | null] as const;
        } catch {
          return [id, null] as const;
        }
      })
    );
    setMessages((prev) => {
      const next = { ...prev };
      for (const [id, list] of entries) if (list) next[id] = list;
      return next;
    });
  }, [token]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/track/${token}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.data) {
        setData(json.data);
        setLastUpdated(new Date());
      }
    } catch {
      // silent — stale data is fine
    }
  }, [token]);

  // Poll every 30 seconds
  useEffect(() => {
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const jobIds = data.jobs.map((j) => j.id).join(",");
  useEffect(() => {
    const ids = jobIds ? jobIds.split(",") : [];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMessages(ids);
    const id = setInterval(() => loadMessages(ids), 30_000);
    return () => clearInterval(id);
  }, [jobIds, loadMessages]);

  const { office, jobs, recentDelivered } = data;
  const groups = useMemo(() => groupByDriver(jobs), [jobs]);
  const threadJob = openThread ? jobs.find((j) => j.id === openThread) ?? null : null;
  const setThreadMessages = useCallback((list: Message[]) => {
    if (!openThread) return;
    setMessages((prev) => ({ ...prev, [openThread]: list }));
    setSeenTick((t) => t + 1);
  }, [openThread]);
  const closeThread = useCallback(() => {
    setOpenThread(null);
    setSeenTick((t) => t + 1);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#F8F9FB", fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* Header */}
      <header style={{
        background: "#FFFFFF",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        padding: "0 24px",
        height: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, background: "#185FA5", borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 2C7.2 2 5.5 2.9 4.5 4.3c-.7 1-1 2.1-.8 3.3l1 5.8c.2 1 1 1.6 1.9 1.6.8 0 1.5-.5 1.8-1.2L9 11.5l1.6 2.3c.3.7 1 1.2 1.8 1.2.9 0 1.7-.6 1.9-1.6l1-5.8c.2-1.2-.1-2.3-.8-3.3C13.5 2.9 11.8 2 10 2H9z" fill="white" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#185FA5", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
              {office.labName}
            </div>
            <div style={{ fontSize: 10.5, color: "#5F5E5A", letterSpacing: "0.03em" }}>
              Delivery Tracker
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: "#9a9a9a" }}>
          Updated {timeAgo(lastUpdated.toISOString())}
        </div>
      </header>

      {/* Body */}
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "28px 20px 48px" }}>

        {/* Office greeting */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#1a1a1a", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
            {office.name}
          </h1>
          <p style={{ fontSize: 13.5, color: "#5F5E5A", margin: 0 }}>
            {jobs.length === 0
              ? "No active deliveries right now."
              : `${jobs.length} active deliver${jobs.length === 1 ? "y" : "ies"} on the way.`}
          </p>
        </div>

        {/* Active jobs */}
        {jobs.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: "#5F5E5A", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
              Active Deliveries
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {groups.map((g) => (
                <DriverCard key={g.key} group={g} messages={messages} onOpenMessages={setOpenThread} />
              ))}
            </div>
          </section>
        )}

        {/* Recent delivered */}
        {recentDelivered.length > 0 && (
          <section>
            <div style={{ fontSize: 11, fontWeight: 500, color: "#5F5E5A", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
              Recent Deliveries
            </div>
            <div style={{
              background: "#FFFFFF",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 12,
              overflow: "hidden",
            }}>
              {recentDelivered.map((job, i) => (
                <div
                  key={job.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderBottom: i < recentDelivered.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1a1a" }}>{job.caseId}</div>
                    <div style={{ fontSize: 12, color: "#5F5E5A", marginTop: 2 }}>{job.deliveryAddress}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                    <div style={{
                      display: "inline-block",
                      background: "#F0FAF0",
                      color: "#3B6D11",
                      fontSize: 11,
                      fontWeight: 500,
                      borderRadius: 20,
                      padding: "2px 10px",
                      border: "1px solid #C0E0C0",
                      marginBottom: 4,
                    }}>
                      Delivered
                    </div>
                    <div style={{ fontSize: 11, color: "#9a9a9a" }}>{timeAgo(job.updatedAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {jobs.length === 0 && recentDelivered.length === 0 && (
          <div style={{
            textAlign: "center",
            padding: "48px 24px",
            background: "#FFFFFF",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 12,
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "#1a1a1a", marginBottom: 6 }}>No deliveries yet</div>
            <div style={{ fontSize: 13, color: "#5F5E5A" }}>
              Your deliveries will appear here once your lab dispatches them.
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: "center",
        padding: "20px",
        fontSize: 12,
        color: "#9a9a9a",
        borderTop: "1px solid rgba(0,0,0,0.06)",
      }}>
        Powered by <span style={{ color: "#185FA5", fontWeight: 500 }}>Gepeto</span> · Updates automatically every 30 seconds
      </footer>

      {threadJob && (
        <MessageModal
          token={token}
          jobId={threadJob.id}
          caseId={threadJob.caseId}
          driverName={threadJob.driverName}
          messages={messages[threadJob.id] ?? []}
          onMessages={setThreadMessages}
          onClose={closeThread}
        />
      )}
    </div>
  );
}

// ── Driver card ───────────────────────────────────────────────────────────────

function DriverCard({
  group,
  messages,
  onOpenMessages,
}: {
  group: DriverGroup;
  messages: Record<string, Message[]>;
  onOpenMessages: (jobId: string) => void;
}) {
  const unread = group.jobs.reduce((n, j) => n + unreadCount(messages[j.id], j.id), 0);
  // Map points: where this driver's cases are headed (normally just the office).
  const destinations = [
    ...new Map(
      group.jobs
        .filter((j) => j.deliveryLat != null && j.deliveryLng != null)
        .map((j) => [`${j.deliveryLat},${j.deliveryLng}`, { lat: j.deliveryLat!, lng: j.deliveryLng! }])
    ).values(),
  ];

  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    }}>
      {/* Driver header */}
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
          background: group.driverName ? "#185FA5" : "#E8E8E6",
          color: group.driverName ? "white" : "#5F5E5A",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600,
        }}>
          {group.driverName ? initials(group.driverName) : "?"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: "#1a1a1a" }}>
            {group.driverName ?? "Waiting for a driver"}
            {group.driverName && <span style={{ fontSize: 12, fontWeight: 400, color: "#9a9a9a" }}> · your driver</span>}
          </div>
          <div style={{ fontSize: 12.5, color: "#5F5E5A", marginTop: 1 }}>{groupSummary(group)}</div>
        </div>
        {unread > 0 && (
          <span title={`${unread} new message${unread === 1 ? "" : "s"}`} style={{
            background: "#D93025", color: "white", fontSize: 11, fontWeight: 700, borderRadius: 10,
            padding: "2px 8px", flexShrink: 0,
          }}>
            {unread} new
          </span>
        )}
      </div>

      {/* One map per driver, only once they're on the way (location is withheld before that) */}
      {group.driverName && group.driverLocation && (
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          <div style={{ padding: "6px 16px", fontSize: 11, color: "#5F5E5A", display: "flex", alignItems: "center", gap: 5, background: "#FAFAFA" }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="4" stroke="#3B6D11" strokeWidth="1.5" />
              <circle cx="5" cy="5" r="1.5" fill="#3B6D11" />
            </svg>
            Live location
          </div>
          <JobMap driverName={group.driverName} driverLocation={group.driverLocation} destinations={destinations} />
        </div>
      )}

      {/* Cases */}
      <div>
        {group.jobs.map((job) => (
          <CaseRow
            key={job.id}
            job={job}
            unread={unreadCount(messages[job.id], job.id)}
            onOpenMessages={() => onOpenMessages(job.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Case row (collapsed by default) ───────────────────────────────────────────

function CaseRow({ job, unread, onOpenMessages }: { job: TrackingJob; unread: number; onOpenMessages: () => void }) {
  const [open, setOpen] = useState(false);
  const colors = STATUS_COLOR[job.status];
  const currentStep = stepIndex(job.status);

  return (
    <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px 10px 16px" }}>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          style={{
            flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
            background: "none", border: "none", padding: "4px 0", cursor: "pointer", textAlign: "left",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, color: "#9a9a9a", transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>
            <path d="M4.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1a1a1a", fontFamily: "ui-monospace, monospace" }}>{job.caseId}</span>
          {job.priority === "stat" && (
            <span style={{ background: "#FFF0EB", color: "#C53B0A", fontSize: 10, fontWeight: 600, borderRadius: 4, padding: "1px 6px", letterSpacing: "0.03em" }}>
              STAT
            </span>
          )}
          <span style={{
            background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`,
            fontSize: 11, fontWeight: 500, borderRadius: 20, padding: "2px 9px", whiteSpace: "nowrap",
          }}>
            {STATUS_LABEL[job.status]}
          </span>
        </button>
        <button
          onClick={onOpenMessages}
          aria-label={unread > 0 ? `Messages for ${job.caseId}, ${unread} new` : `Messages for ${job.caseId}`}
          style={{
            position: "relative", flexShrink: 0, display: "flex", alignItems: "center", gap: 6,
            border: "1px solid #C0D9F0", background: unread > 0 ? "#EBF2FA" : "#FFFFFF", color: "#185FA5",
            borderRadius: 8, padding: "6px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
          }}
        >
          <ChatIcon size={14} />
          Message
          {unread > 0 && (
            <span style={{
              position: "absolute", top: -7, right: -7, background: "#D93025", color: "white",
              fontSize: 10, fontWeight: 700, minWidth: 17, height: 17, lineHeight: "17px", borderRadius: 9,
              textAlign: "center", padding: "0 4px", boxShadow: "0 0 0 2px #fff",
            }}>
              {unread}
            </span>
          )}
        </button>
      </div>

      {open && (
        <div style={{ padding: "0 16px 14px 36px" }}>
          <div style={{ display: "flex", gap: 3, margin: "2px 0 6px" }}>
            {STATUS_STEPS.slice(0, 5).map((step, i) => (
              <div key={step} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= currentStep ? "#185FA5" : "rgba(0,0,0,0.08)" }} />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 10, color: "#9a9a9a" }}>Pending</span>
            <span style={{ fontSize: 10, color: "#9a9a9a" }}>In Transit</span>
            <span style={{ fontSize: 10, color: "#9a9a9a" }}>Arrived</span>
          </div>
          <div style={{ fontSize: 12.5, color: "#3a3a3a" }}>{job.deliveryAddress}</div>
          <div style={{ fontSize: 11, color: "#9a9a9a", marginTop: 4 }}>
            Created {timeAgo(job.createdAt)} · Updated {timeAgo(job.updatedAt)}
          </div>
        </div>
      )}
    </div>
  );
}
