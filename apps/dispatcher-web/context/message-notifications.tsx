"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ApiResponse } from "@gepeto/types";
import { useAuth } from "@/context/auth";
import { supabaseBrowser } from "@/lib/supabase-browser";

// Polling, not Supabase realtime: realtime on `messages` would need RLS
// policies for dispatchers that don't exist yet. Driver activity (rejected,
// accepted, delivered) is polled too, and also re-checked the moment realtime
// reports a change to `jobs`.
const POLL_MS = 10_000;
const TOAST_MS = 7_000;
const MAX_TOASTS = 3;
const SOUND_KEY = "gepeto.messageSound";

interface UnreadMessage {
  // camelCased by @gepeto/db
  id: string;
  jobId: string;
  senderRole: "office" | "driver";
  body: string;
  createdAt: string;
  caseId: string;
  officeName: string | null;
  driverName: string | null;
}

interface UnreadResponse {
  total: number;
  byJob: Record<string, number>;
  recent: UnreadMessage[];
}

interface DriverActivity {
  key: string;
  kind: "rejected" | "accepted" | "delivered";
  jobId: string;
  caseId: string;
  driverName: string | null;
  at: string;
}

interface Toast {
  key: string;
  kind: "message" | DriverActivity["kind"];
  jobId: string | null; // null = summary toast for a burst of messages
  title: string;
  body: string;
  color: string;
}

interface MessageNotificationsContextType {
  totalUnread: number;
  unreadByJob: Record<string, number>;
  /** Mark a thread read up to the newest message the user has seen. */
  markRead: (jobId: string, upTo: string) => void;
  /** Set while a job's messages modal is open — suppresses toasts for it. */
  setActiveThread: (jobId: string | null) => void;
  /** The job with the most recent unread message, if any. */
  newestUnreadJobId: string | null;
  /** Go to the jobs page with this job's messages open. */
  openThread: (jobId: string) => void;
  /** A thread the jobs page should open (set by openThread). */
  pendingOpenJobId: string | null;
  clearPendingOpen: () => void;
  /** A job whose history popup the jobs page should open (rejected/delivered toast clicked). */
  pendingHistoryJobId: string | null;
  clearPendingHistory: () => void;
  /** Bumped on every realtime change to the lab's jobs, so lists can reload. */
  jobsChangedAt: number;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
}

const MessageNotificationsContext = createContext<MessageNotificationsContextType>({
  totalUnread: 0,
  unreadByJob: {},
  markRead: () => {},
  setActiveThread: () => {},
  newestUnreadJobId: null,
  openThread: () => {},
  pendingOpenJobId: null,
  clearPendingOpen: () => {},
  pendingHistoryJobId: null,
  clearPendingHistory: () => {},
  jobsChangedAt: 0,
  soundEnabled: true,
  setSoundEnabled: () => {},
});

const ROLE_COLOR = { office: "#854F0B", driver: "#3B6D11" } as const;

function toastFor(m: UnreadMessage): Toast {
  const who =
    m.senderRole === "office"
      ? m.officeName ?? "Office"
      : m.driverName ? `${m.driverName} (driver)` : "Driver";
  return {
    key: m.id,
    kind: "message",
    jobId: m.jobId,
    title: `${who} · ${m.caseId}`,
    body: m.body,
    color: ROLE_COLOR[m.senderRole],
  };
}

const ACTIVITY_TOAST: Record<DriverActivity["kind"], { verb: string; body: string; color: string }> = {
  rejected:  { verb: "rejected",  body: "It's back to Pending and unassigned.", color: "#A32D2D" },
  accepted:  { verb: "accepted",  body: "They're on it.",                       color: "#185FA5" },
  delivered: { verb: "delivered", body: "Marked delivered.",                    color: "#3B6D11" },
};

function toastForActivity(a: DriverActivity): Toast {
  const t = ACTIVITY_TOAST[a.kind];
  return {
    key: `activity-${a.key}`,
    kind: a.kind,
    jobId: a.jobId,
    title: `${a.driverName ?? "A driver"} ${t.verb} ${a.caseId}`,
    body: t.body,
    color: t.color,
  };
}

// ── Sound ─────────────────────────────────────────────────────────────────────
// Synthesized two-note chime, no audio asset needed. Browsers refuse to start
// audio before the user has interacted with the page, so the AudioContext is
// created/resumed on the first click or keypress.

let audioCtx: AudioContext | null = null;

function unlockAudio() {
  if (typeof window === "undefined") return;
  if (!audioCtx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
}

function playChime() {
  if (!audioCtx || audioCtx.state !== "running") return;
  const now = audioCtx.currentTime;
  [659.25, 880].forEach((freq, i) => {
    const osc = audioCtx!.createOscillator();
    const gain = audioCtx!.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = now + i * 0.12;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
    osc.connect(gain).connect(audioCtx!.destination);
    osc.start(start);
    osc.stop(start + 0.5);
  });
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function MessageNotificationsProvider({ children }: { children: React.ReactNode }) {
  const { session, apiFetch } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [unreadByJob, setUnreadByJob] = useState<Record<string, number>>({});
  const totalUnread = useMemo(
    () => Object.values(unreadByJob).reduce((sum, n) => sum + n, 0),
    [unreadByJob]
  );
  // Job ids from the latest poll's unread messages, newest first.
  const [recentJobIds, setRecentJobIds] = useState<string[]>([]);
  const newestUnreadJobId = useMemo(
    () => recentJobIds.find((id) => unreadByJob[id]) ?? Object.keys(unreadByJob)[0] ?? null,
    [recentJobIds, unreadByJob]
  );
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pendingOpenJobId, setPendingOpenJobId] = useState<string | null>(null);
  const [pendingHistoryJobId, setPendingHistoryJobId] = useState<string | null>(null);
  const [jobsChangedAt, setJobsChangedAt] = useState(0);
  // Safe to read localStorage on first render: AppShell's Guard only mounts this
  // provider client-side, after auth has loaded.
  const [soundEnabled, setSoundEnabledState] = useState(
    () => typeof window === "undefined" || localStorage.getItem(SOUND_KEY) !== "off"
  );

  const seenIds = useRef<Set<string>>(new Set());
  const primed = useRef(false); // first poll only records what's already unread — no toast storm on page load
  const seenActivity = useRef<Set<string>>(new Set());
  const activityPrimed = useRef(false);
  const activeThread = useRef<string | null>(null);
  const soundRef = useRef(soundEnabled);

  const setSoundEnabled = useCallback((v: boolean) => {
    setSoundEnabledState(v);
    soundRef.current = v;
    localStorage.setItem(SOUND_KEY, v ? "on" : "off");
    if (v) {
      unlockAudio();
      playChime(); // preview
    }
  }, []);

  useEffect(() => {
    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  const dismissToast = useCallback((key: string) => {
    setToasts((prev) => prev.filter((t) => t.key !== key));
  }, []);

  const pushToasts = useCallback((incoming: Toast[]) => {
    setToasts((prev) => [...incoming, ...prev].slice(0, MAX_TOASTS));
    for (const t of incoming) setTimeout(() => dismissToast(t.key), TOAST_MS);
  }, [dismissToast]);

  const poll = useCallback(async () => {
    if (!session) return;
    let res: ApiResponse<UnreadResponse>;
    try {
      res = await apiFetch<ApiResponse<UnreadResponse>>("/api/messages/unread");
    } catch {
      return;
    }
    if (!res.data) return;

    const { byJob, recent } = res.data;
    // The open thread is being read live — don't badge it.
    const active = activeThread.current;
    if (active) delete byJob[active];
    setUnreadByJob(byJob);
    setRecentJobIds(recent.map((m) => m.jobId));

    const fresh = recent.filter((m) => !seenIds.current.has(m.id));
    for (const m of fresh) seenIds.current.add(m.id);
    if (!primed.current) {
      primed.current = true;
      return;
    }

    const toToast = fresh.filter((m) => m.jobId !== active).reverse(); // oldest first
    if (toToast.length === 0) return;

    if (toToast.length > MAX_TOASTS) {
      pushToasts([{
        key: `burst-${toToast[toToast.length - 1].id}`,
        kind: "message",
        jobId: null,
        title: `${toToast.length} new messages`,
        body: "Open Jobs to read them.",
        color: "#185FA5",
      }]);
    } else {
      pushToasts(toToast.map(toastFor));
    }
    if (soundRef.current) playChime();
  }, [session, apiFetch, pushToasts]);

  const isDispatcher = session?.user.app_metadata?.role === "dispatcher" || session?.user.user_metadata?.role === "dispatcher";
  // The lab id lives in app_metadata (Stripe signup) or user_metadata (seeded users);
  // users added by hand have neither, so ask the server, which also checks lab_users.
  const metaLabId =
    (session?.user.app_metadata as Record<string, string> | undefined)?.lab_id ??
    (session?.user.user_metadata as Record<string, string> | undefined)?.lab_id;
  const [fetchedLabId, setFetchedLabId] = useState<string | null>(null);
  const labId = metaLabId ?? fetchedLabId;
  useEffect(() => {
    if (!session || !isDispatcher || metaLabId) return;
    apiFetch<ApiResponse<{ lab: { id: string } }>>("/api/settings")
      .then((res) => { if (res.data) setFetchedLabId(res.data.lab.id); })
      .catch(() => {});
  }, [session, isDispatcher, metaLabId, apiFetch]);

  const pollActivity = useCallback(async () => {
    if (!session || !isDispatcher) return;
    let res: ApiResponse<DriverActivity[]>;
    try {
      res = await apiFetch<ApiResponse<DriverActivity[]>>("/api/jobs/driver-activity");
    } catch {
      return;
    }
    if (!res.data) return;

    const fresh = res.data.filter((a) => !seenActivity.current.has(a.key));
    for (const a of fresh) seenActivity.current.add(a.key);
    if (!activityPrimed.current) {
      activityPrimed.current = true;
      return;
    }
    if (fresh.length === 0) return;
    setJobsChangedAt(Date.now()); // in case realtime missed it
    pushToasts(fresh.reverse().slice(-MAX_TOASTS).map(toastForActivity));
    if (soundRef.current) playChime();
  }, [session, isDispatcher, apiFetch, pushToasts]);

  const pollAll = useCallback(() => {
    poll();
    pollActivity();
  }, [poll, pollActivity]);

  // Realtime: any change to the lab's jobs re-checks driver activity right away and
  // tells open job lists to reload. Polling above still covers a dropped socket.
  useEffect(() => {
    if (!labId) return;
    const onJobChange = () => {
      setJobsChangedAt(Date.now());
      pollActivity();
    };
    const channel = supabaseBrowser
      .channel(`lab:${labId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs", filter: `lab_id=eq.${labId}` },
        onJobChange
      )
      // Server broadcast when a driver accepts, rejects or moves a job along.
      .on("broadcast", { event: "job_changed" }, onJobChange)
      .subscribe();
    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, [labId, pollActivity]);

  useEffect(() => {
    if (!session) return;
    // pollAll() only sets state after awaiting the fetch, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    pollAll();
    const id = setInterval(pollAll, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      pollAll();
      setJobsChangedAt(Date.now()); // catch up on anything missed while hidden
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session, pollAll]);

  // Unread count in the tab title so it's visible from other tabs.
  const baseTitle = useRef<string | null>(null);
  useEffect(() => {
    if (baseTitle.current === null) baseTitle.current = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = totalUnread > 0 ? `(${totalUnread}) ${baseTitle.current}` : baseTitle.current;
  }, [totalUnread, pathname]);

  const markRead = useCallback((jobId: string, upTo: string) => {
    setUnreadByJob((prev) => {
      if (!prev[jobId]) return prev;
      const next = { ...prev };
      delete next[jobId];
      return next;
    });
    apiFetch(`/api/jobs/${jobId}/messages/read`, {
      method: "POST",
      body: JSON.stringify({ upTo }),
    }).catch(() => {});
  }, [apiFetch]);

  const setActiveThread = useCallback((jobId: string | null) => {
    activeThread.current = jobId;
    if (jobId) setToasts((prev) => prev.filter((t) => t.jobId !== jobId));
  }, []);

  const clearPendingOpen = useCallback(() => setPendingOpenJobId(null), []);
  const clearPendingHistory = useCallback(() => setPendingHistoryJobId(null), []);

  const openThread = useCallback((jobId: string) => {
    setPendingOpenJobId(jobId);
    if (pathname !== "/jobs") router.push("/jobs");
  }, [pathname, router]);

  const openFromToast = (t: Toast) => {
    dismissToast(t.key);
    if ((t.kind === "rejected" || t.kind === "delivered") && t.jobId) {
      setPendingHistoryJobId(t.jobId);
      if (pathname !== "/jobs") router.push("/jobs");
    } else if (t.jobId) openThread(t.jobId);
    else if (pathname !== "/jobs") router.push("/jobs");
  };

  return (
    <MessageNotificationsContext.Provider
      value={{
        totalUnread,
        unreadByJob,
        markRead,
        setActiveThread,
        newestUnreadJobId,
        openThread,
        pendingOpenJobId,
        clearPendingOpen,
        pendingHistoryJobId,
        clearPendingHistory,
        jobsChangedAt,
        soundEnabled,
        setSoundEnabled,
      }}
    >
      {children}
      <ToastStack toasts={toasts} onOpen={openFromToast} onDismiss={dismissToast} />
    </MessageNotificationsContext.Provider>
  );
}

export const useMessageNotifications = () => useContext(MessageNotificationsContext);

// ── Toasts ────────────────────────────────────────────────────────────────────

function ToastStack({
  toasts,
  onOpen,
  onDismiss,
}: {
  toasts: Toast[];
  onOpen: (t: Toast) => void;
  onDismiss: (key: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed", right: 16, bottom: 16, zIndex: 200,
        display: "flex", flexDirection: "column", gap: 8,
        width: 320, maxWidth: "calc(100vw - 32px)",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.key}
          role="button"
          tabIndex={0}
          onClick={() => onOpen(t)}
          onKeyDown={(e) => { if (e.key === "Enter") onOpen(t); }}
          style={{
            background: "#fff", borderRadius: 10, cursor: "pointer",
            border: "1px solid rgba(0,0,0,0.08)", borderLeft: `3px solid ${t.color}`,
            boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
            padding: "10px 12px", display: "flex", gap: 10, alignItems: "flex-start",
            animation: "gepeto-toast-in 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, marginTop: 1, color: t.color }}>
            {t.kind === "rejected" ? (
              <>
                <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M4 4l4 4M8 4L4 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </>
            ) : t.kind === "accepted" || t.kind === "delivered" ? (
              <>
                <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M3.8 6.2l1.5 1.5 2.9-3.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </>
            ) : (
              <path d="M1 2.5h10v6H4.5L1 11V2.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
            )}
          </svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: t.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {t.title}
            </div>
            <div style={{
              fontSize: 13, color: "#1a1a1a", lineHeight: 1.35, marginTop: 2,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
              {t.body}
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(t.key); }}
            aria-label="Dismiss"
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9a9a9a", padding: 2, display: "flex", flexShrink: 0 }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}
      <style>{`@keyframes gepeto-toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}

/** Small red count bubble, shared by the sidebar and the Messages buttons. */
export function UnreadBadge({ count, style }: { count: number; style?: React.CSSProperties }) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} unread`}
      style={{
        background: "#D93025", color: "#fff", fontSize: 10, fontWeight: 700, lineHeight: "16px",
        minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8, textAlign: "center",
        boxShadow: "0 0 0 2px #fff", ...style,
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
