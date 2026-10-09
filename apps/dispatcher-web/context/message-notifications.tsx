"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ApiResponse } from "@gepeto/types";
import { useAuth } from "@/context/auth";

// Polling, not Supabase realtime: realtime on `messages` would need RLS
// policies for dispatchers that don't exist yet.
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

interface Toast {
  key: string;
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
  /** A thread the jobs page should open (set when a toast is clicked). */
  pendingOpenJobId: string | null;
  clearPendingOpen: () => void;
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
}

const MessageNotificationsContext = createContext<MessageNotificationsContextType>({
  totalUnread: 0,
  unreadByJob: {},
  markRead: () => {},
  setActiveThread: () => {},
  pendingOpenJobId: null,
  clearPendingOpen: () => {},
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
    jobId: m.jobId,
    title: `${who} · ${m.caseId}`,
    body: m.body,
    color: ROLE_COLOR[m.senderRole],
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
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pendingOpenJobId, setPendingOpenJobId] = useState<string | null>(null);
  // Safe to read localStorage on first render: AppShell's Guard only mounts this
  // provider client-side, after auth has loaded.
  const [soundEnabled, setSoundEnabledState] = useState(
    () => typeof window === "undefined" || localStorage.getItem(SOUND_KEY) !== "off"
  );

  const seenIds = useRef<Set<string>>(new Set());
  const primed = useRef(false); // first poll only records what's already unread — no toast storm on page load
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

  useEffect(() => {
    if (!session) return;
    // poll() only sets state after awaiting the fetch, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    poll();
    const id = setInterval(poll, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") poll(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session, poll]);

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

  const openFromToast = (t: Toast) => {
    dismissToast(t.key);
    if (t.jobId) setPendingOpenJobId(t.jobId);
    if (pathname !== "/jobs") router.push("/jobs");
  };

  return (
    <MessageNotificationsContext.Provider
      value={{
        totalUnread,
        unreadByJob,
        markRead,
        setActiveThread,
        pendingOpenJobId,
        clearPendingOpen,
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
            <path d="M1 2.5h10v6H4.5L1 11V2.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
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
