"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import JobMap from "./job-map";
import { ChatIcon, ConversationModal, unreadForJobs, type Message } from "./messages";

// ── Types ─────────────────────────────────────────────────────────────────────

type JobStatus = "pending" | "assigned" | "picked_up" | "in_transit" | "arrived" | "delivered";

interface Item {
  description: string;
  quantity: number;
  flags: string[];
}

interface TrackingJob {
  id: string;
  caseId: string;
  status: JobStatus;
  priority: "stat" | "standard";
  deliveryAddress: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  items: Item[] | null;
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
  items: Item[] | null;
  updatedAt: string;
}

interface Office {
  id: string;
  name: string;
  address: string;
  phone: string;
  contactName: string;
  labName: string;
  labPhone: string | null;
}

interface TrackingData {
  office: Office;
  jobs: TrackingJob[];
  recentDelivered: RecentJob[];
}

// ── Status, in the office's terms ─────────────────────────────────────────────
// Three steps an office cares about: still at the lab, on the way, arrived.

const ON_THE_WAY: JobStatus[] = ["picked_up", "in_transit", "arrived"];

type Stage = { step: 1 | 2 | 3; label: string; bg: string; text: string; border: string };

function stageOf(job: TrackingJob): Stage {
  if (job.status === "arrived") return { step: 3, label: "Arrived", bg: "#F0FAF0", text: "#3B6D11", border: "#C0E0C0" };
  if (job.status === "picked_up" || job.status === "in_transit") return { step: 2, label: "On the way", bg: "#EBF2FA", text: "#185FA5", border: "#C0D9F0" };
  if (job.driverId) return { step: 1, label: "Driver assigned", bg: "#F5F5F3", text: "#3a3a3a", border: "#E2E2DE" };
  return { step: 1, label: "At the lab", bg: "#FFF8F0", text: "#854F0B", border: "#F5D9B5" };
}

const STEP_NAMES = ["At the lab", "On the way", "Arrived"];

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

/** Handling notes the person signing for the box should know about ("rush" is lab-internal). */
const HANDLING: Record<string, string> = {
  fragile: "Fragile",
  temperature_sensitive: "Keep cool",
  biohazard: "Biohazard",
};

function itemsLine(items: Item[] | null): { text: string; handling: string[] } {
  const list = items ?? [];
  const text = list
    .map((i) => (i.quantity > 1 ? `${i.description} ×${i.quantity}` : i.description))
    .filter(Boolean)
    .join(" · ");
  const handling = [...new Set(list.flatMap((i) => i.flags ?? []).map((f) => HANDLING[f]).filter(Boolean))];
  return { text, handling };
}

const sameAddress = (a: string, b: string) =>
  a.replace(/[^a-z0-9]/gi, "").toLowerCase() === b.replace(/[^a-z0-9]/gi, "").toLowerCase();

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
  for (const g of groups.values()) g.jobs.sort((a, b) => stageOf(b).step - stageOf(a).step);
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
  if (!g.driverName) return `${cases}. The lab will assign a driver soon.`;
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
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  // Bumped when a conversation is read, so unread badges (kept in localStorage) re-render.
  const [, setSeenTick] = useState(0);

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
  const onTheWay = jobs.filter((j) => ON_THE_WAY.includes(j.status)).length;
  const conversation = openGroup ? groups.find((g) => g.key === openGroup) ?? null : null;

  const setJobMessages = useCallback((jobId: string, list: Message[]) => {
    setMessages((prev) => ({ ...prev, [jobId]: list }));
    setSeenTick((t) => t + 1);
  }, []);
  const closeConversation = useCallback(() => {
    setOpenGroup(null);
    setSeenTick((t) => t + 1);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#F8F9FB", fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* Header */}
      <header style={{
        background: "#FFFFFF",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        padding: "0 20px",
        height: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0, overflow: "hidden",
            border: "1px solid rgba(0,0,0,0.08)", background: "#fff",
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/gepeto-icon.png" alt="Gepeto" style={{ width: "100%", height: "100%" }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#185FA5", letterSpacing: "-0.01em", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {office.labName}
            </div>
            <div style={{ fontSize: 10.5, color: "#5F5E5A", letterSpacing: "0.03em" }}>
              Delivery Tracker · updated {timeAgo(lastUpdated.toISOString())}
            </div>
          </div>
        </div>
        {office.labPhone && (
          <a
            href={`tel:${office.labPhone.replace(/[^\d+]/g, "")}`}
            style={{
              flexShrink: 0, display: "flex", alignItems: "center", gap: 6, textDecoration: "none",
              fontSize: 12.5, fontWeight: 600, color: "#185FA5", border: "1px solid #C0D9F0",
              borderRadius: 8, padding: "6px 10px", background: "#fff",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M5.5 2.5L4 2 2.5 3.5c-.5 4 5 9.5 9 9l1.5-1.5-.5-1.5-2.5-1-1.25 1.25c-1.25-.5-2.75-2-3.25-3.25L6.75 5.25 5.5 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
            Call the lab
          </a>
        )}
      </header>

      {/* Body */}
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "28px 16px 48px" }}>

        {/* Office greeting */}
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#1a1a1a", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
            {office.name}
          </h1>
          <p style={{ fontSize: 13.5, color: "#5F5E5A", margin: 0 }}>
            {jobs.length === 0
              ? "No cases in progress right now."
              : `${jobs.length} case${jobs.length === 1 ? "" : "s"} in progress · ${onTheWay} on the way`}
          </p>
        </div>

        {/* Active cases, by driver */}
        {jobs.length > 0 && (
          <section style={{ marginBottom: 32, display: "flex", flexDirection: "column", gap: 14 }}>
            {groups.map((g) => (
              <DriverCard
                key={g.key}
                group={g}
                officeAddress={office.address}
                unread={unreadForJobs(messages, g.jobs.map((j) => j.id))}
                onOpenMessages={() => setOpenGroup(g.key)}
              />
            ))}
          </section>
        )}

        {/* Recent delivered */}
        {recentDelivered.length > 0 && (
          <section>
            <div style={{ fontSize: 11, fontWeight: 500, color: "#5F5E5A", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
              Recently delivered
            </div>
            <div style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, overflow: "hidden" }}>
              {recentDelivered.map((job, i) => {
                const items = itemsLine(job.items);
                return (
                  <div
                    key={job.id}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 16px",
                      borderBottom: i < recentDelivered.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", fontFamily: "ui-monospace, monospace" }}>{job.caseId}</div>
                      {items.text && <div style={{ fontSize: 12, color: "#5F5E5A", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{items.text}</div>}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ display: "inline-block", background: "#F0FAF0", color: "#3B6D11", fontSize: 11, fontWeight: 500, borderRadius: 20, padding: "2px 10px", border: "1px solid #C0E0C0", marginBottom: 3 }}>
                        Delivered
                      </div>
                      <div style={{ fontSize: 11, color: "#9a9a9a" }}>{timeAgo(job.updatedAt)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Empty state */}
        {jobs.length === 0 && recentDelivered.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 24px", background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "#1a1a1a", marginBottom: 6 }}>No deliveries yet</div>
            <div style={{ fontSize: 13, color: "#5F5E5A" }}>
              Your deliveries will appear here once your lab dispatches them.
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: "20px", fontSize: 12, color: "#9a9a9a", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        Powered by <span style={{ color: "#185FA5", fontWeight: 500 }}>Gepeto</span> · Updates automatically every 30 seconds
      </footer>

      {conversation && (
        <ConversationModal
          token={token}
          title={conversation.driverName ? `Messages · ${conversation.driverName}` : "Messages · Waiting for a driver"}
          subtitle={conversation.driverName ? `With the lab and ${conversation.driverName}, your driver` : "With the lab"}
          cases={conversation.jobs.map((j) => ({ jobId: j.id, caseId: j.caseId }))}
          messages={messages}
          onMessages={setJobMessages}
          onClose={closeConversation}
        />
      )}
    </div>
  );
}

// ── Driver card ───────────────────────────────────────────────────────────────

function DriverCard({
  group,
  officeAddress,
  unread,
  onOpenMessages,
}: {
  group: DriverGroup;
  officeAddress: string;
  unread: number;
  onOpenMessages: () => void;
}) {
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
      <div style={{ padding: "14px 14px 14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
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
        <button
          onClick={onOpenMessages}
          aria-label={unread > 0 ? `Messages, ${unread} new` : "Messages"}
          style={{
            position: "relative", flexShrink: 0, display: "flex", alignItems: "center", gap: 6,
            border: "1px solid #C0D9F0", background: unread > 0 ? "#EBF2FA" : "#FFFFFF", color: "#185FA5",
            borderRadius: 8, padding: "7px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
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

      {/* One map per driver, only once they're on the way (location is withheld before that) */}
      {group.driverName && group.driverLocation && (
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          <JobMap driverName={group.driverName} driverLocation={group.driverLocation} destinations={destinations} />
        </div>
      )}

      {/* Cases */}
      {group.jobs.map((job) => (
        <CaseRow key={job.id} job={job} officeAddress={officeAddress} />
      ))}
    </div>
  );
}

// ── Case row ──────────────────────────────────────────────────────────────────

function CaseRow({ job, officeAddress }: { job: TrackingJob; officeAddress: string }) {
  const stage = stageOf(job);
  const items = itemsLine(job.items);
  const otherAddress = job.deliveryAddress && !sameAddress(job.deliveryAddress, officeAddress);

  return (
    <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", padding: "11px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1a1a1a", fontFamily: "ui-monospace, monospace" }}>{job.caseId}</span>
          {job.priority === "stat" && (
            <span style={{ background: "#FFF0EB", color: "#C53B0A", fontSize: 10, fontWeight: 600, borderRadius: 4, padding: "1px 6px", letterSpacing: "0.03em" }}>
              STAT
            </span>
          )}
        </div>
        {items.text && (
          <div style={{ fontSize: 12.5, color: "#3a3a3a", marginTop: 3, lineHeight: 1.4 }}>
            {items.text}
            {items.handling.length > 0 && (
              <span style={{ color: "#854F0B", fontWeight: 500 }}> · {items.handling.join(" · ")}</span>
            )}
          </div>
        )}
        {otherAddress && <div style={{ fontSize: 12, color: "#5F5E5A", marginTop: 2 }}>To {job.deliveryAddress}</div>}
      </div>

      <div style={{ flexShrink: 0, textAlign: "right" }}>
        <span style={{
          display: "inline-block", background: stage.bg, color: stage.text, border: `1px solid ${stage.border}`,
          fontSize: 11, fontWeight: 500, borderRadius: 20, padding: "2px 9px", whiteSpace: "nowrap",
        }}>
          {stage.label}
        </span>
        <div
          role="img"
          aria-label={`Step ${stage.step} of 3: ${STEP_NAMES[stage.step - 1]}`}
          title={STEP_NAMES.join(" → ")}
          style={{ display: "flex", gap: 3, justifyContent: "flex-end", marginTop: 6 }}
        >
          {[1, 2, 3].map((n) => (
            <span key={n} style={{ width: 14, height: 4, borderRadius: 2, background: n <= stage.step ? "#185FA5" : "rgba(0,0,0,0.1)" }} />
          ))}
        </div>
        <div style={{ fontSize: 11, color: "#9a9a9a", marginTop: 4 }}>{timeAgo(job.updatedAt)}</div>
      </div>
    </div>
  );
}
