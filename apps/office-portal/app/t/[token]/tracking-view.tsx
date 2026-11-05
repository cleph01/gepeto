"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import JobMap from "./job-map";
import { ChatIcon, ConversationModal, unreadForJobs, type Message } from "./messages";
import { AlertToasts, AlertsGear, useOfficeAlerts, useTabUnread } from "./alerts";
import DeliveredView from "./delivered-view";
import { BoxIcon, PickupsSection, RequestPickupModal, type Pickup } from "./pickups";
import { itemsLine, locationFreshness, timeAgo, type Item } from "./format";

// ── Types ─────────────────────────────────────────────────────────────────────

type JobStatus = "pending" | "assigned" | "picked_up" | "in_transit" | "arrived" | "delivered";

interface TrackingJob {
  id: string;
  caseId: string;
  status: JobStatus;
  driverResponse: "pending" | "accepted" | "rejected";
  priority: "stat" | "standard";
  deliveryAddress: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  items: Item[] | null;
  createdAt: string;
  updatedAt: string;
  /** Groups cases by driver; not the driver's real id (lib/tracking.ts). */
  driverKey: string | null;
  driverName: string | null;
  /** Only sent once this driver is carrying one of the office's cases (lib/tracking.ts). */
  driverLocation: DriverLocation | null;
  /** The driver is carrying this office's cases but location sharing is paused. */
  locationPaused: boolean;
}

/** updatedAt: when the driver's phone last sent it (absent on very old rows). */
type DriverLocation = { lat: number; lng: number; updatedAt?: string };

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
  recentlyDelivered: { id: string; caseId: string }[];
  pickups: Pickup[];
  liveTopic: string;
  alertsAllowed: boolean;
}

// ── Status, in the office's terms ─────────────────────────────────────────────
// The label names every step the driver takes; the bar stays at the three an
// office cares about: still at the lab, on the way, arrived.

const ON_THE_WAY: JobStatus[] = ["picked_up", "in_transit", "arrived"];

type Stage = { step: 1 | 2 | 3; label: string; bg: string; text: string; border: string };

function stageOf(job: TrackingJob): Stage {
  if (job.status === "arrived") return { step: 3, label: "Arrived", bg: "#F0FAF0", text: "#3B6D11", border: "#C0E0C0" };
  if (job.status === "in_transit") return { step: 2, label: "On the way", bg: "#EBF2FA", text: "#185FA5", border: "#C0D9F0" };
  if (job.status === "picked_up") return { step: 2, label: "Picked up", bg: "#EBF2FA", text: "#185FA5", border: "#C0D9F0" };
  if (job.driverKey && job.driverResponse === "accepted") return { step: 1, label: "Driver accepted", bg: "#EBF2FA", text: "#185FA5", border: "#C0D9F0" };
  if (job.driverKey) return { step: 1, label: "Driver assigned", bg: "#F5F5F3", text: "#3a3a3a", border: "#E2E2DE" };
  // The driver turned it down. The office hears what happens next, not who said no.
  if (job.driverResponse === "rejected") return { step: 1, label: "Finding a new driver", bg: "#FFF8F0", text: "#854F0B", border: "#F5D9B5" };
  return { step: 1, label: "At the lab", bg: "#FFF8F0", text: "#854F0B", border: "#F5D9B5" };
}

const STEP_NAMES = ["At the lab", "On the way", "Arrived"];

// ── Helpers ───────────────────────────────────────────────────────────────────

const sameAddress = (a: string, b: string) =>
  a.replace(/[^a-z0-9]/gi, "").toLowerCase() === b.replace(/[^a-z0-9]/gi, "").toLowerCase();

interface DriverGroup {
  key: string;
  driverName: string | null; // null = no driver yet
  driverLocation: DriverLocation | null;
  locationPaused: boolean;
  jobs: TrackingJob[];
}

/** Cases grouped by driver: arrived/on-the-way first, then assigned, then unassigned. */
function groupByDriver(jobs: TrackingJob[]): DriverGroup[] {
  const groups = new Map<string, DriverGroup>();
  for (const job of jobs) {
    const key = job.driverKey ?? "unassigned";
    if (!groups.has(key)) {
      groups.set(key, { key, driverName: job.driverKey ? job.driverName : null, driverLocation: null, locationPaused: false, jobs: [] });
    }
    const g = groups.get(key)!;
    g.jobs.push(job);
    if (job.driverLocation) g.driverLocation = job.driverLocation;
    if (job.locationPaused) g.locationPaused = true;
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
  if (!g.driverName) {
    return g.jobs.some((j) => j.driverResponse === "rejected")
      ? `${cases}. The lab is finding a new driver.`
      : `${cases}. The lab will assign a driver soon.`;
  }
  const arrived = g.jobs.filter((j) => j.status === "arrived").length;
  const moving = g.jobs.filter((j) => ON_THE_WAY.includes(j.status)).length;
  if (arrived > 0) return `${cases} · arrived`;
  if (moving === 0) {
    return g.jobs.every((j) => j.driverResponse === "accepted")
      ? `${cases} · driver accepted, not picked up yet`
      : `${cases} · assigned, not on the way yet`;
  }
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
  const [tab, setTab] = useState<"active" | "delivered">("active");
  const [requesting, setRequesting] = useState(false);
  // Bumped on live job changes so the Delivered tab refetches too.
  const [deliveredVersion, setDeliveredVersion] = useState(0);
  // The live connection has been down long enough to mention.
  const [reconnecting, setReconnecting] = useState(false);
  // Bumped when a conversation is read, so unread badges (kept in localStorage) re-render.
  const [, setSeenTick] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/track/${token}`);
      // The link was replaced: reload onto the "link isn't working" screen.
      if (res.status === 404) return window.location.reload();
      if (!res.ok) return;
      const json = await res.json();
      // The code was reset: reload onto the code screen.
      if (json.data?.locked) return window.location.reload();
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

  // Backstop for the live updates below: reload every 30 seconds regardless.
  useEffect(() => {
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const jobIds = data.jobs.map((j) => j.id).join(",");

  // Live updates: the lab's server signals this page's channel whenever something
  // on this page changes (driver assigned or reassigned, status steps, new or
  // edited cases, messages, pickups, driver location). The signal only says
  // what kind of thing changed; we reload it through the usual endpoints.
  // Bursts (a status step plus a location ping) collapse into one reload.
  const jobIdsRef = useRef(jobIds);
  useEffect(() => {
    jobIdsRef.current = jobIds;
  }, [jobIds]);
  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      timer = null;
      const what = new Set(pending);
      pending.clear();
      if (what.has("jobs") || what.has("pickups") || what.has("location")) refresh();
      if (what.has("jobs")) setDeliveredVersion((v) => v + 1);
      if (what.has("messages")) loadMessages(jobIdsRef.current ? jobIdsRef.current.split(",") : []);
    };
    const topic = data.liveTopic;
    for (const c of sb.getChannels()) {
      if (c.topic === `realtime:${topic}`) sb.removeChannel(c);
    }
    // A blip shouldn't flash a notice. A real drop gets one, and coming back
    // reloads, because anything sent while disconnected was missed.
    let dropTimer: ReturnType<typeof setTimeout> | null = null;
    let wasDown = false;
    let closing = false;
    const channel = sb
      .channel(topic)
      .on("broadcast", { event: "changed" }, ({ payload }) => {
        pending.add(String((payload as { what?: string })?.what ?? "jobs"));
        if (!timer) timer = setTimeout(flush, 400);
      })
      .subscribe((status) => {
        if (closing) return;
        if (status === "SUBSCRIBED") {
          if (dropTimer) clearTimeout(dropTimer);
          dropTimer = null;
          setReconnecting(false);
          if (wasDown) {
            wasDown = false;
            refresh();
            loadMessages(jobIdsRef.current ? jobIdsRef.current.split(",") : []);
          }
        } else {
          wasDown = true;
          if (!dropTimer) dropTimer = setTimeout(() => setReconnecting(true), 10_000);
        }
      });
    // Coming back to a tab that sat in the background: catch up right away.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      refresh();
      loadMessages(jobIdsRef.current ? jobIdsRef.current.split(",") : []);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      closing = true;
      if (timer) clearTimeout(timer);
      if (dropTimer) clearTimeout(dropTimer);
      document.removeEventListener("visibilitychange", onVisible);
      sb.removeChannel(channel);
    };
  }, [data.liveTopic, refresh, loadMessages]);
  useEffect(() => {
    const ids = jobIds ? jobIds.split(",") : [];
    // loadMessages only sets state after its fetches resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMessages(ids);
    const id = setInterval(() => loadMessages(ids), 30_000);
    return () => clearInterval(id);
  }, [jobIds, loadMessages]);

  const { office, jobs, pickups } = data;
  const groups = useMemo(() => groupByDriver(jobs), [jobs]);
  const onTheWay = jobs.filter((j) => ON_THE_WAY.includes(j.status)).length;
  const conversation = openGroup ? groups.find((g) => g.key === openGroup) ?? null : null;
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const setJobMessages = useCallback((jobId: string, list: Message[]) => {
    setMessages((prev) => ({ ...prev, [jobId]: list }));
    setSeenTick((t) => t + 1);
  }, []);
  const openConversationFor = useCallback((jobId: string) => {
    const group = groupByDriver(dataRef.current.jobs).find((g) => g.jobs.some((j) => j.id === jobId));
    if (!group) return;
    setTab("active");
    setOpenGroup(group.key);
  }, []);
  const openStatus = useCallback((kind: "arrived" | "delivered") => {
    setTab(kind === "delivered" ? "delivered" : "active");
  }, []);
  const alerts = useOfficeAlerts({
    allowed: data.alertsAllowed,
    labName: office.labName,
    messages,
    openJobIds: conversation ? conversation.jobs.map((j) => j.id) : [],
    onOpenJob: openConversationFor,
    jobs,
    recentlyDelivered: data.recentlyDelivered,
    onOpenStatus: openStatus,
  });
  // A conversation on screen is being read, so it doesn't count.
  const totalUnread = unreadForJobs(messages, jobs.filter((j) => !conversation?.jobs.some((c) => c.id === j.id)).map((j) => j.id));
  useTabUnread(totalUnread);
  const closeRequest = useCallback(() => setRequesting(false), []);
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
            <div style={{ fontSize: 10.5, color: "#5F5E5A", letterSpacing: "0.03em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Updated {timeAgo(lastUpdated.toISOString())}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexShrink: 0 }}>
        {office.labPhone && (
          // The number is shown, not just linked: on a desktop the office will
          // usually dial it from a desk phone, and tel: links only help on mobile.
          <a
            href={`tel:${office.labPhone.replace(/[^\d+]/g, "")}`}
            aria-label={`Call the lab at ${office.labPhone}`}
            style={{
              flexShrink: 0, display: "flex", alignItems: "center", gap: 8, textDecoration: "none",
              color: "#185FA5", border: "1px solid #C0D9F0", borderRadius: 8, padding: "5px 11px 5px 9px", background: "#fff",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M5.5 2.5L4 2 2.5 3.5c-.5 4 5 9.5 9 9l1.5-1.5-.5-1.5-2.5-1-1.25 1.25c-1.25-.5-2.75-2-3.25-3.25L6.75 5.25 5.5 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
              <span style={{ fontSize: 10.5, fontWeight: 500, color: "#5F5E5A" }}>Call the lab</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", userSelect: "all" }}>{office.labPhone}</span>
            </span>
          </a>
        )}
        {data.alertsAllowed && (
          <AlertsGear
            soundOn={alerts.soundOn}
            notifyOn={alerts.notifyOn}
            notifyStatus={alerts.notifyStatus}
            changeSound={alerts.changeSound}
            changeNotify={alerts.changeNotify}
          />
        )}
        </div>
      </header>

      <AlertToasts
        toasts={alerts.toasts}
        caseIdFor={(jobId) => jobs.find((j) => j.id === jobId)?.caseId}
        onOpen={(t) => (t.kind === "message" ? openConversationFor(t.jobId!) : openStatus(t.kind))}
        onDismiss={alerts.dismissToast}
      />

      {/* Body */}
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "28px 16px 48px" }}>

        {/* Office greeting + pickup request */}
        <div style={{ marginBottom: 16, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: "#1a1a1a", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
              {office.name}
            </h1>
            <p style={{ fontSize: 13.5, color: "#5F5E5A", margin: 0 }}>
              {jobs.length === 0
                ? "No cases in progress right now."
                : `${jobs.length} case${jobs.length === 1 ? "" : "s"} in progress · ${onTheWay} on the way`}
            </p>
          </div>
          <button
            onClick={() => setRequesting(true)}
            style={{
              display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "#fff",
              background: "#185FA5", border: "none", borderRadius: 8, padding: "8px 13px", cursor: "pointer",
            }}
          >
            <BoxIcon size={15} />
            Request a pickup
          </button>
        </div>

        {reconnecting && (
          <div role="status" style={{ marginBottom: 14, padding: "8px 12px", fontSize: 12.5, lineHeight: 1.45, color: "#854F0B", background: "#FFF8EC", border: "1px solid #F5D9B5", borderRadius: 8 }}>
            Reconnecting… Live updates are paused, so this page may be up to 30 seconds behind.
          </div>
        )}

        {/* Tabs */}
        <div role="tablist" aria-label="Deliveries" style={{ display: "flex", gap: 4, borderBottom: "1px solid rgba(0,0,0,0.08)", marginBottom: 18 }}>
          {([["active", `In progress (${jobs.length})`], ["delivered", "Delivered"]] as const).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: "9px 12px", marginBottom: -1,
                fontSize: 13.5, fontWeight: tab === id ? 600 : 500, color: tab === id ? "#185FA5" : "#5F5E5A",
                borderBottom: `2px solid ${tab === id ? "#185FA5" : "transparent"}`,
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {label}
              {id === "active" && totalUnread > 0 && (
                <span aria-label={`${totalUnread} unread`} style={{
                  background: "#D93025", color: "white", fontSize: 10, fontWeight: 700, minWidth: 17, height: 17,
                  lineHeight: "17px", borderRadius: 9, textAlign: "center", padding: "0 4px", boxSizing: "border-box",
                }}>
                  {totalUnread}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "active" ? (
          jobs.length > 0 || pickups.length > 0 ? (
            <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <PickupsSection token={token} pickups={pickups} onChanged={refresh} />
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
          ) : (
            <div style={{ textAlign: "center", padding: "44px 24px", background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#1a1a1a", marginBottom: 6 }}>Nothing on the way right now</div>
              <div style={{ fontSize: 13, color: "#5F5E5A", marginBottom: 14 }}>
                {`New cases from ${office.labName} will show up here as soon as they're dispatched.`}
              </div>
              <button onClick={() => setTab("delivered")} style={{ fontSize: 13, fontWeight: 600, color: "#185FA5", background: "#EBF2FA", border: "1px solid #C0D9F0", borderRadius: 8, padding: "7px 14px", cursor: "pointer" }}>
                See delivered cases
              </button>
            </div>
          )
        ) : (
          <DeliveredView token={token} refreshKey={deliveredVersion} />
        )}
      </main>

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: "20px", fontSize: 12, color: "#9a9a9a", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        Powered by <span style={{ color: "#185FA5", fontWeight: 500 }}>Gepeto</span> · Updates automatically
      </footer>

      {requesting && (
        <RequestPickupModal token={token} onClose={closeRequest} onSent={refresh} />
      )}

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
  // Re-check every 30s so "last seen 3 min ago" counts up without new data.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const loc = group.driverLocation;
  const freshness = loc ? locationFreshness(loc.updatedAt, now) : "gone";
  const seen = loc?.updatedAt ? timeAgo(loc.updatedAt) : "";

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

      {/* One map per driver, only once they're on the way (location is withheld
          before that), and only while the location is recent enough to trust. */}
      {group.driverName && loc && freshness !== "gone" && (
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          <JobMap driverName={group.driverName} driverLocation={loc} destinations={destinations} freshness={freshness} />
          <div style={{
            padding: "7px 16px", fontSize: 12, lineHeight: 1.45,
            color: freshness === "stale" ? "#854F0B" : "#5F5E5A",
            background: freshness === "stale" ? "#FFF8EC" : "#FAFBFD",
            borderTop: "1px solid rgba(0,0,0,0.05)",
          }}>
            {freshness === "live" && <><span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#3B6D11", marginRight: 6, verticalAlign: 1 }} />Live · updated {seen}</>}
            {freshness === "recent" && <>Last seen {seen}</>}
            {freshness === "stale" && <>Last known location, {seen}. Their phone may be off signal. Call the lab for an update.</>}
          </div>
        </div>
      )}
      {group.driverName && group.locationPaused && (
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", padding: "9px 16px", fontSize: 12.5, color: "#5F5E5A", background: "#FAFBFD" }}>
          Location paused. Your cases are still on the way; call the lab if you need an update.
        </div>
      )}
      {group.driverName && loc && freshness === "gone" && group.jobs.some((j) => ON_THE_WAY.includes(j.status)) && (
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", padding: "9px 16px", fontSize: 12.5, color: "#5F5E5A", background: "#FAFBFD" }}>
          Live location isn&apos;t available right now. Your cases are still on the way; call the lab if you need an update.
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
