"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { setFaviconBadge } from "@/lib/favicon-badge";
import type { Message } from "./messages";

// Alerts for the tracking page (new messages, a driver arriving, a delivery): a
// chime, a notice on the page and browser notifications, each chosen per browser
// from the gear. The lab decides
// whether offices get them at all. Unread counts always show.
//
// Page notifications only work while the page is open in some tab. The text stays
// generic because these can pop up on a front desk screen patients can see.

const SOUND_KEY = "gepeto.track.sound";
const NOTIFY_KEY = "gepeto.track.notify";
const LAST_ALERT_KEY = "gepeto.track.lastAlert";
const TOAST_MS = 7_000;
const MAX_TOASTS = 3;
const AWAY_TAB_DELAY_MS = 1_500;

function readSetting(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSetting(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

// ── Sound (the dispatcher app's chime) ────────────────────────────────────────
// Browsers refuse to start audio until the person has clicked or typed on the page.

let audioCtx: AudioContext | null = null;

function unlockAudio() {
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

// ── Browser notifications ─────────────────────────────────────────────────────

type NotifyStatus = "unsupported" | NotificationPermission;

function readNotifyStatus(): NotifyStatus {
  // Android only allows them through a service worker, and every browser refuses
  // them on a page that isn't https.
  if (!("Notification" in window) || !window.isSecureContext || /Android/i.test(navigator.userAgent)) {
    return "unsupported";
  }
  return Notification.permission;
}

const isAway = () => document.hidden || !document.hasFocus();

// Holds a reference to open notifications: a browser can drop the click handler
// of one that has been garbage collected.
const openNotifications = new Set<Notification>();

function showNotification(title: string, tag: string, onClick?: () => void) {
  try {
    const n = new Notification(title, { tag, icon: "/gepeto-icon.png", silent: true }); // the page plays its own chime
    openNotifications.add(n);
    n.onclose = () => openNotifications.delete(n);
    n.onclick = () => {
      window.focus();
      n.close();
      onClick?.();
    };
  } catch {
    // Some browsers refuse page notifications. The notice and chime still happen.
  }
}

// With the page open in two tabs, one chime and one notification is enough. The
// tab being looked at claims the alert right away and others wait a moment, so a
// background tab doesn't pop a notification about what's already on screen.
function claimAlert(id: string) {
  if (readSetting(LAST_ALERT_KEY) === id) return false;
  writeSetting(LAST_ALERT_KEY, id);
  return true;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface AlertToast {
  id: string;
  kind: "message" | "arrived" | "delivered";
  /** The message's case. Null for status alerts, which can cover several cases. */
  jobId: string | null;
  body: string;
}

// A batch of cases updates one at a time, so wait a moment and alert about them together.
const STATUS_BATCH_MS = 1_500;

/** Cases that just reached the driver's door or were delivered, since the last load. */
export function statusChanges(
  known: Map<string, string>,
  jobs: { id: string; caseId: string; status: string }[],
  recentlyDelivered: { id: string; caseId: string }[]
) {
  return {
    // Only cases already on this page: one that shows up already arrived isn't news.
    arrived: jobs.filter((j) => j.status === "arrived" && known.has(j.id) && known.get(j.id) !== "arrived"),
    delivered: recentlyDelivered.filter((j) => known.has(j.id)),
  };
}

const caseCount = (cases: { caseId: string }[]) => (cases.length === 1 ? `Case ${cases[0].caseId}` : `${cases.length} cases`);

export function useOfficeAlerts({
  allowed,
  labName,
  messages,
  openJobIds,
  onOpenJob,
  jobs,
  recentlyDelivered,
  onOpenStatus,
}: {
  allowed: boolean;
  labName: string;
  messages: Record<string, Message[]>;
  /** Cases in the conversation on screen. Their messages need no alert. */
  openJobIds: string[];
  onOpenJob: (jobId: string) => void;
  jobs: { id: string; caseId: string; status: string }[];
  recentlyDelivered: { id: string; caseId: string }[];
  onOpenStatus: (kind: "arrived" | "delivered") => void;
}) {
  const [soundOn, setSoundOn] = useState(true);
  const [notifyOn, setNotifyOn] = useState(false);
  const [notifyStatus, setNotifyStatus] = useState<NotifyStatus>("unsupported");
  const [toasts, setToasts] = useState<AlertToast[]>([]);

  // Browser-only values, so the first render matches the server's.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setSoundOn(readSetting(SOUND_KEY) !== "off");
    setNotifyOn(readSetting(NOTIFY_KEY) === "on");
    setNotifyStatus(readNotifyStatus());
    /* eslint-enable react-hooks/set-state-in-effect */
    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  const latest = useRef({ allowed, labName, soundOn, notifyOn, notifyStatus, openJobIds, onOpenJob, onOpenStatus });
  useEffect(() => {
    latest.current = { allowed, labName, soundOn, notifyOn, notifyStatus, openJobIds, onOpenJob, onOpenStatus };
  });

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // The chime and browser notification for an alert.
  const ring = useCallback((id: string, title: string, tag: string, onClick: () => void) => {
    const fire = () => {
      if (!claimAlert(id)) return;
      const { soundOn, notifyOn, notifyStatus } = latest.current;
      if (soundOn) playChime();
      if (notifyOn && notifyStatus === "granted" && isAway()) showNotification(title, tag, onClick);
    };
    if (isAway()) setTimeout(fire, AWAY_TAB_DELAY_MS);
    else fire();
  }, []);

  // Each case's first load only records what's already there, so opening the
  // page doesn't set off an alert for every old message.
  const seenIds = useRef(new Set<string>());
  const loadedJobs = useRef(new Set<string>());
  useEffect(() => {
    const incoming: (Message & { jobId: string })[] = [];
    for (const [jobId, list] of Object.entries(messages)) {
      const firstLoad = !loadedJobs.current.has(jobId);
      loadedJobs.current.add(jobId);
      for (const m of list) {
        if (seenIds.current.has(m.id)) continue;
        seenIds.current.add(m.id);
        if (!firstLoad && m.senderRole !== "office") incoming.push({ ...m, jobId });
      }
    }

    const now = latest.current;
    if (!now.allowed) return;
    const alerts = incoming.filter((m) => isAway() || !now.openJobIds.includes(m.jobId));
    if (alerts.length === 0) return;

    setToasts((prev) => [...alerts.map((m) => ({ id: m.id, kind: "message" as const, jobId: m.jobId, body: m.body })), ...prev].slice(0, MAX_TOASTS));
    for (const m of alerts) setTimeout(() => dismissToast(m.id), TOAST_MS);

    const newest = alerts[alerts.length - 1];
    ring(newest.id, `New message from ${now.labName}`, `gepeto-message-${newest.id}`, () => latest.current.onOpenJob(newest.jobId));
  }, [messages, dismissToast, ring]);

  // A driver reaching the door or finishing a delivery. The first load only
  // records where things stand, so opening the page doesn't set anything off.
  const knownStatus = useRef<Map<string, string> | null>(null);
  const statusBatch = useRef<{ arrived: Map<string, string>; delivered: Map<string, string>; timer: ReturnType<typeof setTimeout> | null }>({
    arrived: new Map(),
    delivered: new Map(),
    timer: null,
  });
  useEffect(() => {
    const known = knownStatus.current;
    knownStatus.current = new Map(jobs.map((j) => [j.id, j.status]));
    if (!known || !latest.current.allowed) return;
    const { arrived, delivered } = statusChanges(known, jobs, recentlyDelivered);
    if (arrived.length === 0 && delivered.length === 0) return;

    const batch = statusBatch.current;
    for (const j of arrived) batch.arrived.set(j.id, j.caseId);
    for (const j of delivered) batch.delivered.set(j.id, j.caseId);
    if (batch.timer) return;
    batch.timer = setTimeout(() => {
      batch.timer = null;
      for (const kind of ["arrived", "delivered"] as const) {
        const cases = [...batch[kind]].map(([id, caseId]) => ({ id, caseId }));
        batch[kind].clear();
        if (cases.length === 0) continue;
        const id = `${kind}:${cases.map((c) => c.id).sort().join(",")}`;
        setToasts((prev) => [{ id, kind, jobId: null, body: caseCount(cases) }, ...prev].slice(0, MAX_TOASTS));
        setTimeout(() => dismissToast(id), TOAST_MS);
        const { labName } = latest.current;
        ring(
          id,
          kind === "arrived" ? `A driver from ${labName} has arrived` : `Delivery from ${labName} completed`,
          `gepeto-${id}`.slice(0, 64),
          () => latest.current.onOpenStatus(kind)
        );
      }
    }, STATUS_BATCH_MS);
  }, [jobs, recentlyDelivered, dismissToast, ring]);
  useEffect(() => {
    const batch = statusBatch.current;
    return () => {
      if (batch.timer) clearTimeout(batch.timer);
    };
  }, []);

  const changeSound = useCallback((on: boolean) => {
    setSoundOn(on);
    writeSetting(SOUND_KEY, on ? "on" : "off");
    if (on) {
      unlockAudio();
      playChime(); // preview
    }
  }, []);

  const changeNotify = useCallback(async (on: boolean) => {
    if (readNotifyStatus() === "unsupported") return;
    if (on && Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      setNotifyStatus(permission);
      if (permission !== "granted") return;
    }
    setNotifyOn(on);
    writeSetting(NOTIFY_KEY, on ? "on" : "off");
    // A preview, so anyone whose computer is blocking them finds out now.
    if (on) showNotification("Browser notifications are on", "gepeto-notifications-on");
  }, []);

  return { soundOn, notifyOn, notifyStatus, changeSound, changeNotify, toasts, dismissToast };
}

/** The unread count on the browser tab: its title and its icon. */
export function useTabUnread(unread: number) {
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\) /, "");
    document.title = unread > 0 ? `(${unread > 9 ? "9+" : unread}) ${base}` : base;
    setFaviconBadge(unread);
  }, [unread]);
}

// ── Gear ──────────────────────────────────────────────────────────────────────

function Switch({ label, description, checked, disabled, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, padding: "10px 0" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: disabled ? "#9a9a9a" : "#1a1a1a" }}>{label}</div>
        <div style={{ fontSize: 12, color: "#5F5E5A", lineHeight: 1.4, marginTop: 2 }}>{description}</div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          position: "relative", flexShrink: 0, width: 38, height: 22, borderRadius: 11, border: "none", padding: 0,
          background: checked ? "#185FA5" : "#CFCFCA", opacity: disabled ? 0.5 : 1, cursor: disabled ? "default" : "pointer",
        }}
      >
        <span style={{ position: "absolute", top: 2, left: checked ? 18 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
      </button>
    </div>
  );
}

export function AlertsGear({ soundOn, notifyOn, notifyStatus, changeSound, changeNotify }: {
  soundOn: boolean;
  notifyOn: boolean;
  notifyStatus: NotifyStatus;
  changeSound: (on: boolean) => void;
  changeNotify: (on: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const notifyHelp =
    notifyStatus === "unsupported" ? "Not available in this browser or on this device."
    : notifyStatus === "denied" ? "Blocked for this site. Allow notifications in your browser's site settings, then reload this page."
    : "Alerts you when this page is open but you're in another tab or window.";

  return (
    <div ref={root} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Alert settings"
        aria-expanded={open}
        title="Alert settings"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38,
          border: "1px solid #C0D9F0", borderRadius: 8, background: open ? "#EBF2FA" : "#fff", color: "#185FA5", cursor: "pointer",
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-2.82-1.17l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.26 14H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 2.82 1.17l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.2.6.76 1 1.51 1H21a2 2 0 1 1 0 4h-.09c-.75 0-1.31.4-1.51 1z" />
        </svg>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Alert settings"
          style={{
            // Above Leaflet, whose map controls sit at z-index 1000.
            position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 2000, boxSizing: "border-box",
            width: "min(300px, calc(100vw - 32px))", background: "#fff", border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: 10, boxShadow: "0 8px 28px rgba(0,0,0,0.14)", padding: "8px 14px",
          }}
        >
          <Switch
            label="Browser notifications"
            description={notifyHelp}
            checked={notifyOn && notifyStatus === "granted"}
            disabled={notifyStatus === "unsupported" || notifyStatus === "denied"}
            onChange={changeNotify}
          />
          <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }} />
          <Switch
            label="Chime"
            description="Plays a sound on this computer for new messages, and when a driver arrives or delivers."
            checked={soundOn}
            onChange={changeSound}
          />
        </div>
      )}
    </div>
  );
}

// ── Notices on the page ───────────────────────────────────────────────────────

export function AlertToasts({ toasts, caseIdFor, onOpen, onDismiss }: {
  toasts: AlertToast[];
  caseIdFor: (jobId: string) => string | undefined;
  onOpen: (toast: AlertToast) => void;
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div aria-live="polite" style={{ position: "fixed", top: 70, right: 16, left: 16, zIndex: 4000, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, pointerEvents: "none" }}>
      {toasts.map((t) => {
        const heading =
          t.kind === "arrived" ? "Your driver has arrived"
          : t.kind === "delivered" ? "Delivered"
          : `New message${t.jobId && caseIdFor(t.jobId) ? ` · ${caseIdFor(t.jobId)}` : ""}`;
        return (
        <div key={t.id} style={{
          pointerEvents: "auto", width: "min(340px, 100%)", boxSizing: "border-box", display: "flex", alignItems: "flex-start", gap: 8,
          background: "#fff", border: `1px solid ${t.kind === "message" ? "#C0D9F0" : "#C0E0C0"}`, borderRadius: 10, boxShadow: "0 6px 22px rgba(0,0,0,0.14)", padding: "10px 10px 10px 13px",
        }}>
          <button
            onClick={() => { onDismiss(t.id); onOpen(t); }}
            style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 600, color: t.kind === "message" ? "#185FA5" : "#3B6D11" }}>{heading}</div>
            <div style={{ fontSize: 13, color: "#3a3a3a", lineHeight: 1.4, marginTop: 2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{t.body}</div>
          </button>
          <button onClick={() => onDismiss(t.id)} aria-label="Dismiss" style={{ flexShrink: 0, background: "none", border: "none", color: "#5F5E5A", fontSize: 16, lineHeight: 1, padding: "0 3px", cursor: "pointer" }}>×</button>
        </div>
        );
      })}
    </div>
  );
}
