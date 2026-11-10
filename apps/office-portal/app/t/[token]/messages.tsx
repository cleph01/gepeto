"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SenderRole = "dispatcher" | "driver" | "office";

export interface Message {
  id: string;
  // @gepeto/db auto-camelCases every query result (see packages/db/db.js
  // postProcessResponse) — these fields are senderRole/createdAt over the
  // wire even though the DB column is sender_role/created_at.
  senderRole: SenderRole;
  body: string;
  createdAt: string;
  /** Private thread with the lab only: the case a message is about, if any. */
  aboutCaseId?: string | null;
}

/** Where this page keeps the office's private thread with the lab, alongside case threads. */
export const DISPATCH_THREAD = "dispatch";

const PRIVATE_COLOR = "#6B4FA0";

export function LockIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <rect x="2.25" y="5.25" width="7.5" height="5.25" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 5.25V4a2 2 0 014 0v1.25" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

const SENDER_LABEL: Record<SenderRole, string> = {
  dispatcher: "Dispatch",
  driver: "Driver",
  office: "You",
};

// Reuses the app's existing status-color palette (STATUS_COLOR in
// tracking-view.tsx) so a role's color here matches what it already means
// elsewhere on the page — blue = dispatch, green = driver/delivered, amber = office/pending.
const ROLE_COLOR: Record<SenderRole, string> = {
  dispatcher: "#185FA5",
  driver: "#3B6D11",
  office: "#854F0B",
};

const ROLE_BG: Record<SenderRole, string> = {
  dispatcher: "rgba(24,95,165,0.10)",
  driver: "rgba(59,109,17,0.10)",
  office: "rgba(133,79,11,0.10)",
};

function RoleIcon({ role, color, size = 10 }: { role: SenderRole; color: string; size?: number }) {
  if (role === "dispatcher") {
    // Headset
    return (
      <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
        <path d="M2.5 7V6a3.5 3.5 0 017 0v1" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
        <rect x="1.5" y="6.5" width="2" height="3" rx="1" fill={color} />
        <rect x="8.5" y="6.5" width="2" height="3" rx="1" fill={color} />
      </svg>
    );
  }
  if (role === "driver") {
    // Delivery van
    return (
      <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
        <rect x="1" y="4" width="7.5" height="4" rx="0.75" fill={color} />
        <path d="M8.5 5.5H10.5L11 7V8H8.5V5.5Z" fill={color} />
        <circle cx="3.25" cy="8.5" r="1" fill="white" stroke={color} strokeWidth="1" />
        <circle cx="9" cy="8.5" r="1" fill="white" stroke={color} strokeWidth="1" />
      </svg>
    );
  }
  // Office building
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <rect x="2" y="1.5" width="8" height="9" rx="0.5" stroke={color} strokeWidth="1.2" />
      <rect x="3.5" y="3" width="1.4" height="1.4" fill={color} />
      <rect x="7" y="3" width="1.4" height="1.4" fill={color} />
      <rect x="3.5" y="5.6" width="1.4" height="1.4" fill={color} />
      <rect x="7" y="5.6" width="1.4" height="1.4" fill={color} />
      <rect x="5" y="8.2" width="2" height="2.3" fill={color} />
    </svg>
  );
}

export function ChatIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path
        d="M2 3.5C2 2.67 2.67 2 3.5 2h9c.83 0 1.5.67 1.5 1.5v6c0 .83-.67 1.5-1.5 1.5H7l-3 3v-3H3.5C2.67 11 2 10.33 2 9.5v-6Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RoleLegend() {
  const roles: SenderRole[] = ["office", "dispatcher", "driver"];
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "0 0 8px" }}>
      {roles.map((r) => (
        <div key={r} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <RoleIcon role={r} color={ROLE_COLOR[r]} size={10} />
          <span style={{ fontSize: 10.5, color: "#5F5E5A" }}>
            {r === "office" ? "Office (you)" : SENDER_LABEL[r]}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Unread tracking ───────────────────────────────────────────────────────────
// Offices don't log in, so "read" lives in this browser: the createdAt of the
// newest message they've seen in each thread. Unread = dispatch/driver
// messages newer than that.

const seenKey = (jobId: string) => `gepeto.track.seen.${jobId}`;

export function unreadCount(messages: Message[] | undefined, jobId: string): number {
  if (!messages?.length) return 0;
  let seen = "";
  try {
    seen = localStorage.getItem(seenKey(jobId)) ?? "";
  } catch {}
  return messages.filter((m) => m.senderRole !== "office" && m.createdAt > seen).length;
}

function markSeen(messages: Message[], jobId: string) {
  const newest = messages[messages.length - 1]?.createdAt;
  if (!newest) return;
  try {
    localStorage.setItem(seenKey(jobId), newest);
  } catch {}
}

/** Unread across several cases (a driver's card). */
export function unreadForJobs(messages: Record<string, Message[]>, jobIds: string[]): number {
  return jobIds.reduce((n, id) => n + unreadCount(messages[id], id), 0);
}

// ── Conversation modal (one per driver) ───────────────────────────────────────
// Conversations are stored per case, which is how dispatch and the driver see
// them. The office sees one combined conversation per driver: every message
// is tagged with its case, and a new message goes to the case picked above
// the composer.

export interface ConversationCase {
  jobId: string;
  caseId: string;
}

export function ConversationModal({
  token,
  title,
  subtitle,
  cases,
  messages,
  onMessages,
  onClose,
  threadPath = (id) => `jobs/${id}/messages`,
}: {
  token: string;
  title: string;
  subtitle: string;
  cases: ConversationCase[];
  messages: Record<string, Message[]>;
  onMessages: (jobId: string, list: Message[]) => void;
  onClose: () => void;
  /** Where a conversation lives under this page's API. Jobs by default; pickups pass their own. */
  threadPath?: (id: string) => string;
}) {
  const multi = cases.length > 1;
  // Default to the case with the most recent message, else the first one.
  const [target, setTarget] = useState<string>(() => {
    let best = cases[0]?.jobId ?? "";
    let bestAt = "";
    for (const c of cases) {
      const last = messages[c.jobId]?.at(-1)?.createdAt ?? "";
      if (last > bestAt) { bestAt = last; best = c.jobId; }
    }
    return best;
  });
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [phone, setPhone] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const caseIdFor = (jobId: string) => cases.find((c) => c.jobId === jobId)?.caseId ?? "";
  const jobKey = cases.map((c) => c.jobId).join(",");

  const load = useCallback(async () => {
    await Promise.all(
      jobKey.split(",").filter(Boolean).map(async (jobId) => {
        try {
          const res = await fetch(`/api/track/${token}/${threadPath(jobId)}`);
          if (!res.ok) return;
          const json = await res.json();
          if (json.data) onMessages(jobId, json.data);
        } catch {
          // silent — next poll catches up
        }
      })
    );
    // threadPath only ever depends on the id, so it doesn't need to reload this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, jobKey, onMessages]);

  // Live while open: refresh every 10s, close on Escape, no page scroll behind.
  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const check = () => setPhone(window.innerWidth < 600);
    check();
    window.addEventListener("resize", check);
    return () => {
      clearInterval(id);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", check);
      document.body.style.overflow = overflow;
    };
  }, [load, onClose]);

  const timeline = cases
    .flatMap((c) => (messages[c.jobId] ?? []).map((m) => ({ ...m, jobId: c.jobId })))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const newest = timeline.at(-1)?.id;

  // Everything shown is read; always open on the newest message.
  useEffect(() => {
    for (const c of cases) markSeen(messages[c.jobId] ?? [], c.jobId);
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newest, jobKey]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || sending || !target) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/track/${token}/${threadPath(target)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.data) {
        // The live update can load this message before the send finishes.
        const current = messages[target] ?? [];
        onMessages(target, current.some((m) => m.id === json.data.id) ? current : [...current, json.data]);
        setDraft("");
      } else {
        setSendError(json?.error?.code === "READ_ONLY" ? json.error.message : "Couldn't send. Check your connection and try again.");
      }
    } catch {
      setSendError("Couldn't send. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        // Above Leaflet, whose map controls sit at z-index 1000.
        position: "fixed", inset: 0, zIndex: 5000, background: "rgba(0,0,0,0.35)",
        display: "flex", alignItems: phone ? "stretch" : "center", justifyContent: "center",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          background: "#fff", width: "100%", maxWidth: phone ? "none" : 480,
          height: phone ? "100%" : "auto", maxHeight: phone ? "none" : "82vh",
          margin: phone ? 0 : "0 16px", borderRadius: phone ? 0 : 14,
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>{title}</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#5F5E5A" }}>{subtitle}</p>
          </div>
          <button onClick={onClose} aria-label="Close messages" style={{ background: "none", border: "none", cursor: "pointer", color: "#9a9a9a", padding: 4, display: "flex" }}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div style={{ padding: "10px 18px 0" }}>
          <RoleLegend />
        </div>

        <div ref={listRef} style={{ flex: 1, minHeight: 160, overflowY: "auto", padding: "6px 18px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          {timeline.length === 0 && (
            <div style={{ fontSize: 12.5, color: "#9a9a9a", textAlign: "center", padding: "24px 0" }}>
              No messages yet.
            </div>
          )}
          {timeline.map((m) => (
            <div key={m.id} style={{ alignSelf: m.senderRole === "office" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", justifyContent: m.senderRole === "office" ? "flex-end" : "flex-start", marginBottom: 2 }}>
                <RoleIcon role={m.senderRole} color={ROLE_COLOR[m.senderRole]} />
                <span style={{ fontSize: 10.5, fontWeight: 600, color: ROLE_COLOR[m.senderRole] }}>{SENDER_LABEL[m.senderRole]}</span>
                <span style={{ fontSize: 10.5, color: "#9a9a9a" }}>
                  · {new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
                {multi && (
                  <span style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", color: "#5F5E5A", background: "#F1F1EF", borderRadius: 4, padding: "0 5px" }}>
                    {caseIdFor(m.jobId)}
                  </span>
                )}
              </div>
              <div style={{ background: ROLE_BG[m.senderRole], color: "#1a1a1a", borderRadius: 10, padding: "7px 11px", fontSize: 13.5, lineHeight: 1.4, wordBreak: "break-word" }}>
                {m.body}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: "10px 18px 16px", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          {multi && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              <span style={{ fontSize: 11.5, color: "#5F5E5A" }}>About:</span>
              {cases.map((c) => (
                <button
                  key={c.jobId}
                  onClick={() => setTarget(c.jobId)}
                  aria-pressed={target === c.jobId}
                  style={{
                    fontSize: 11.5, fontFamily: "ui-monospace, monospace", padding: "3px 9px", borderRadius: 20, cursor: "pointer",
                    border: `1px solid ${target === c.jobId ? "#185FA5" : "rgba(0,0,0,0.12)"}`,
                    background: target === c.jobId ? "#EBF2FA" : "#fff", color: target === c.jobId ? "#185FA5" : "#3a3a3a",
                    fontWeight: target === c.jobId ? 600 : 400,
                  }}
                >
                  {c.caseId}
                </button>
              ))}
            </div>
          )}
          {sendError && <div style={{ fontSize: 12, color: "#A32D2D", marginBottom: 6 }}>{sendError}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
              placeholder={multi ? `Message about ${caseIdFor(target)}…` : "Message the lab and driver…"}
              aria-label="Message"
              autoFocus={!phone}
              style={{ flex: 1, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, padding: "9px 11px", fontSize: 14, color: "#1a1a1a", outline: "none" }}
            />
            <button
              onClick={handleSend}
              disabled={sending || !draft.trim()}
              style={{
                border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, color: "white",
                background: sending || !draft.trim() ? "#9ab6d6" : "#185FA5", cursor: sending || !draft.trim() ? "default" : "pointer",
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Private thread with the lab ───────────────────────────────────────────────
// Just this office and the lab's dispatch: drivers never see it. Anything the
// driver should know goes in the driver's conversation instead.

export function DispatchThreadModal({
  token,
  labName,
  cases,
  messages,
  onMessages,
  onClose,
}: {
  token: string;
  labName: string;
  /** Cases in progress, for the optional About picker. */
  cases: ConversationCase[];
  messages: Message[] | undefined;
  onMessages: (list: Message[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [about, setAbout] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [phone, setPhone] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const path = `/api/track/${token}/dispatch/messages`;
  const list = messages ?? [];
  const aboutCase = cases.find((c) => c.jobId === about) ?? null;

  const load = useCallback(async () => {
    try {
      const res = await fetch(path);
      if (!res.ok) return;
      const json = await res.json();
      if (json.data) onMessages(json.data);
    } catch {
      // silent — next poll catches up
    }
  }, [path, onMessages]);

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const check = () => setPhone(window.innerWidth < 600);
    check();
    window.addEventListener("resize", check);
    return () => {
      clearInterval(id);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", check);
      document.body.style.overflow = overflow;
    };
  }, [load, onClose]);

  const newest = list.at(-1)?.id;
  useEffect(() => {
    markSeen(list, DISPATCH_THREAD);
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newest]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, aboutJobId: aboutCase?.jobId ?? null }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.data) {
        onMessages(list.some((m) => m.id === json.data.id) ? list : [...list, json.data]);
        setDraft("");
      } else {
        setSendError(json?.error?.code === "READ_ONLY" ? json.error.message : "Couldn't send. Check your connection and try again.");
      }
    } catch {
      setSendError("Couldn't send. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 5000, background: "rgba(0,0,0,0.35)",
        display: "flex", alignItems: phone ? "stretch" : "center", justifyContent: "center",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Private messages with ${labName}`}
        style={{
          background: "#fff", width: "100%", maxWidth: phone ? "none" : 480,
          height: phone ? "100%" : "auto", maxHeight: phone ? "none" : "82vh",
          margin: phone ? 0 : "0 16px", borderRadius: phone ? 0 : 14,
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>Message {labName}</h2>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: PRIVATE_COLOR, display: "flex", alignItems: "center", gap: 5 }}>
              <LockIcon /> Private: only you and the lab see this. Drivers don&apos;t.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close messages" style={{ background: "none", border: "none", cursor: "pointer", color: "#9a9a9a", padding: 4, display: "flex" }}>
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div ref={listRef} style={{ flex: 1, minHeight: 160, overflowY: "auto", padding: "12px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
          {list.length === 0 && (
            <div style={{ fontSize: 12.5, color: "#9a9a9a", textAlign: "center", padding: "24px 8px", lineHeight: 1.5 }}>
              No messages yet. Use this for anything just between you and the lab.
              {" "}To include your driver, use <strong style={{ fontWeight: 600 }}>Message</strong> on the driver&apos;s card.
            </div>
          )}
          {list.map((m) => {
            const mine = m.senderRole === "office";
            return (
              <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 2 }}>
                  <RoleIcon role={m.senderRole} color={ROLE_COLOR[m.senderRole]} />
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: ROLE_COLOR[m.senderRole] }}>{mine ? "You" : labName}</span>
                  <span style={{ fontSize: 10.5, color: "#9a9a9a" }}>
                    · {new Date(m.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </span>
                  {m.aboutCaseId && (
                    <span style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", color: "#5F5E5A", background: "#F1F1EF", borderRadius: 4, padding: "0 5px" }}>
                      {m.aboutCaseId}
                    </span>
                  )}
                </div>
                <div style={{ background: ROLE_BG[m.senderRole], color: "#1a1a1a", borderRadius: 10, padding: "7px 11px", fontSize: 13.5, lineHeight: 1.4, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                  {m.body}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: "10px 18px 16px", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          {cases.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              <span style={{ fontSize: 11.5, color: "#5F5E5A" }}>About:</span>
              {[{ jobId: null as string | null, caseId: "General" }, ...cases].map((c) => {
                const on = (aboutCase?.jobId ?? null) === c.jobId;
                return (
                  <button
                    key={c.jobId ?? "general"}
                    onClick={() => setAbout(c.jobId)}
                    aria-pressed={on}
                    style={{
                      fontSize: 11.5, fontFamily: c.jobId ? "ui-monospace, monospace" : "inherit", padding: "3px 9px", borderRadius: 20, cursor: "pointer",
                      border: `1px solid ${on ? "#185FA5" : "rgba(0,0,0,0.12)"}`,
                      background: on ? "#EBF2FA" : "#fff", color: on ? "#185FA5" : "#3a3a3a", fontWeight: on ? 600 : 400,
                    }}
                  >
                    {c.caseId}
                  </button>
                );
              })}
            </div>
          )}
          {sendError && <div style={{ fontSize: 12, color: "#A32D2D", marginBottom: 6 }}>{sendError}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
              placeholder="Private message to the lab…"
              aria-label="Private message to the lab"
              autoFocus={!phone}
              style={{ flex: 1, minWidth: 0, border: `1px solid ${PRIVATE_COLOR}66`, borderRadius: 8, padding: "9px 11px", fontSize: 14, color: "#1a1a1a", outline: "none" }}
            />
            <button
              onClick={handleSend}
              disabled={sending || !draft.trim()}
              style={{
                border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13.5, fontWeight: 600, color: "white",
                background: sending || !draft.trim() ? "#9ab6d6" : "#185FA5", cursor: sending || !draft.trim() ? "default" : "pointer",
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
