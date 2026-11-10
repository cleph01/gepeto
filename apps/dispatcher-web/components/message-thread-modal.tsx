"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth";
import { privateThreadPath, useMessageNotifications } from "@/context/message-notifications";
import { LockIcon, PRIVATE_BG, PRIVATE_COLOR } from "@/components/private-thread";
import type { ApiResponse } from "@gepeto/types";

// One conversation between dispatch, the office and the driver, used for both
// jobs and returns. The caller says where the messages live and what to do
// when they've been seen.

type MessageSenderRole = "dispatcher" | "driver" | "office";

type PrivateKind = "office" | "driver";
type PrivateTarget = { id: string; name: string };

interface ThreadMessage {
  id: string;
  // @gepeto/db auto-camelCases every query result (see packages/db/db.js
  // postProcessResponse) — these fields are senderRole/createdAt over the
  // wire even though the DB column is sender_role/created_at.
  senderRole: MessageSenderRole;
  body: string;
  createdAt: string;
  /** From the lab's private thread with the office (the driver can't see it) or with the driver (the office can't). */
  isPrivate?: PrivateKind;
}

const SENDER_LABEL: Record<MessageSenderRole, string> = {
  dispatcher: "You (Dispatch)",
  driver: "Driver",
  office: "Office",
};

const SENDER_COLOR: Record<MessageSenderRole, string> = {
  dispatcher: "#185FA5",
  driver: "#3B6D11",
  office: "#854F0B",
};

const SENDER_BG: Record<MessageSenderRole, string> = {
  dispatcher: "rgba(24,95,165,0.10)",
  driver: "rgba(59,109,17,0.10)",
  office: "rgba(133,79,11,0.10)",
};

function RoleIcon({ role, color, size = 10 }: { role: MessageSenderRole; color: string; size?: number }) {
  if (role === "dispatcher") {
    return (
      <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
        <path d="M2.5 7V6a3.5 3.5 0 017 0v1" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
        <rect x="1.5" y="6.5" width="2" height="3" rx="1" fill={color} />
        <rect x="8.5" y="6.5" width="2" height="3" rx="1" fill={color} />
      </svg>
    );
  }
  if (role === "driver") {
    return (
      <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
        <rect x="1" y="4" width="7.5" height="4" rx="0.75" fill={color} />
        <path d="M8.5 5.5H10.5L11 7V8H8.5V5.5Z" fill={color} />
        <circle cx="3.25" cy="8.5" r="1" fill="white" stroke={color} strokeWidth="1" />
        <circle cx="9" cy="8.5" r="1" fill="white" stroke={color} strokeWidth="1" />
      </svg>
    );
  }
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

function MessageRoleLegend() {
  const roles: MessageSenderRole[] = ["dispatcher", "office", "driver"];
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "10px 20px 0" }}>
      {roles.map((r) => (
        <div key={r} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <RoleIcon role={r} color={SENDER_COLOR[r]} size={10} />
          <span style={{ fontSize: 10.5, color: "#5F5E5A" }}>
            {r === "dispatcher" ? "Dispatch (you)" : SENDER_LABEL[r]}
          </span>
        </div>
      ))}
    </div>
  );
}

export function MessageThreadModal({ subtitle, path, arrivedAt, onActive, onRead, onClose, privateWith }: {
  subtitle: string;
  /** The API path for this conversation's messages. */
  path: string;
  /** Changes when a message lands here, so it shows now instead of on the next check. */
  arrivedAt: number;
  /** This conversation opened or closed. */
  onActive: (open: boolean) => void;
  /** Everything up to this time has been seen. */
  onRead: (upTo: string) => void;
  onClose: () => void;
  /**
   * Jobs only: also show, and allow sending, private messages about this case
   * with the office or the driver. Those sit in that person's private thread
   * with the lab: the driver never sees the office's, the office never sees
   * the driver's.
   */
  privateWith?: { jobId: string; office?: PrivateTarget; driver?: PrivateTarget };
}) {
  const { apiFetch } = useAuth();
  const { directMessageArrived } = useMessageNotifications();
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [privateMessages, setPrivateMessages] = useState<ThreadMessage[]>([]);
  const [to, setTo] = useState<"everyone" | PrivateKind>("everyone");
  const privatePath = (kind: PrivateKind) => {
    const target = privateWith?.[kind];
    return target ? privateThreadPath(`${kind}:${target.id}`) : null;
  };
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const loadPrivate = () => {
    if (!privateWith) return;
    const kinds = (["office", "driver"] as const).filter((k) => privateWith[k]);
    if (kinds.length === 0) return;
    Promise.all(kinds.map((kind) =>
      apiFetch<ApiResponse<ThreadMessage[]>>(`${privatePath(kind)}?aboutJobId=${privateWith.jobId}`)
        .then((res) => (res.data ?? []).map((m) => ({ ...m, isPrivate: kind })))
    )).then((lists) => setPrivateMessages(lists.flat())).catch(() => {});
  };

  const load = () => {
    apiFetch<ApiResponse<ThreadMessage[]>>(path).then((res) => {
      if (res.data) setMessages(res.data);
    }).catch(() => {});
    loadPrivate();
  };

  useEffect(() => {
    const thread = directMessageArrived?.thread;
    if (privateWith && thread && (["office", "driver"] as const).some((k) => privateWith[k] && thread === `${k}:${privateWith[k]!.id}`)) loadPrivate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directMessageArrived]);

  useEffect(() => {
    load();
    const id = setInterval(load, 8_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => {
    if (arrivedAt) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrivedAt]);

  useEffect(() => {
    onActive(true);
    return () => onActive(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // Read tracking covers the case conversation only. Private messages are
  // marked read on the Messages page, where the whole thread is shown.
  const newestAt = messages.length > 0 ? messages[messages.length - 1].createdAt : null;
  useEffect(() => {
    if (newestAt) onRead(newestAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, newestAt]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError(null);
    const privateTo = to !== "everyone" && privateWith?.[to] ? to : null;
    try {
      const res = await apiFetch<ApiResponse<ThreadMessage>>(privateTo ? privatePath(privateTo)! : path, {
        method: "POST",
        body: JSON.stringify(privateTo ? { body, aboutJobId: privateWith!.jobId } : { body }),
      });
      if (res.data) {
        // The live update can load this message before the send finishes.
        const sent = privateTo ? { ...res.data, isPrivate: privateTo } : res.data;
        const add = (prev: ThreadMessage[]) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]);
        if (privateTo) setPrivateMessages(add);
        else setMessages(add);
        setDraft("");
      } else {
        setSendError(res.error?.message ?? "Couldn't send. Try again.");
      }
    } catch {
      setSendError("Couldn't reach the server. Try again.");
    } finally {
      setSending(false);
    }
  };

  const privateTarget = to !== "everyone" ? privateWith?.[to] ?? null : null;
  // Who can't see a private message: the driver for the office's, the office for the driver's.
  const leftOut = to === "office" ? "driver" : "office";
  const toOptions: [("everyone" | PrivateKind), string][] = privateWith
    ? [
        ["everyone", "Office + driver"],
        ...(privateWith.office ? [["office", `${privateWith.office.name} only`] as ["office", string]] : []),
        ...(privateWith.driver ? [["driver", `${privateWith.driver.name} only`] as ["driver", string]] : []),
      ]
    : [];
  const timeline = privateMessages.length
    ? [...messages, ...privateMessages].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    : messages;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          background: "#fff", borderRadius: 14, width: "100%", maxWidth: 440,
          margin: "0 16px", boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          overflow: "hidden", maxHeight: "80vh", display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em" }}>Messages</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#5F5E5A" }}>{subtitle}</p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "#9a9a9a", padding: 4, borderRadius: 6, display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <MessageRoleLegend />

        {/* column-reverse anchors the scroll to the bottom: the thread opens on the
            newest message and stays there as new ones arrive (unless scrolled up). */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column-reverse" }}>
        <div style={{ padding: "10px 20px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          {timeline.length === 0 && (
            <div style={{ fontSize: 12.5, color: "#9a9a9a", textAlign: "center", padding: "20px 0" }}>No messages yet.</div>
          )}
          {timeline.map((m) => (
            <div key={m.id} style={{ alignSelf: m.senderRole === "dispatcher" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 4,
                justifyContent: m.senderRole === "dispatcher" ? "flex-end" : "flex-start",
                marginBottom: 2,
              }}>
                <RoleIcon role={m.senderRole} color={SENDER_COLOR[m.senderRole]} />
                <span style={{ fontSize: 10.5, fontWeight: 600, color: SENDER_COLOR[m.senderRole] }}>
                  {SENDER_LABEL[m.senderRole]}
                </span>
                {m.isPrivate && (
                  <span
                    title={m.isPrivate === "office" ? "Private with the office. The driver can't see this." : "Private with the driver. The office can't see this."}
                    style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 600, color: PRIVATE_COLOR }}
                  >
                    <LockIcon size={10} /> Private · {m.isPrivate === "office" ? "office" : "driver"}
                  </span>
                )}
              </div>
              <div style={{
                background: m.isPrivate ? PRIVATE_BG : SENDER_BG[m.senderRole],
                border: m.isPrivate ? `1px dashed ${PRIVATE_COLOR}66` : "1px solid transparent",
                color: "#1a1a1a", borderRadius: 10, padding: "7px 11px", fontSize: 13, lineHeight: 1.4, wordBreak: "break-word",
              }}>
                {m.body}
              </div>
            </div>
          ))}
        </div>
        </div>

        {sendError && <div style={{ padding: "8px 20px 0", fontSize: 12, color: "#A32D2D" }}>{sendError}</div>}
        {privateWith && (
          <div role="radiogroup" aria-label="Send to" style={{ padding: "10px 20px 0", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            <span style={{ fontSize: 11.5, color: "#5F5E5A" }}>To:</span>
            {toOptions.map(([value, label]) => {
              const on = to === value;
              const color = value !== "everyone" ? PRIVATE_COLOR : "#185FA5";
              return (
                <button
                  key={value}
                  role="radio"
                  aria-checked={on}
                  onClick={() => setTo(value)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, padding: "3px 9px", borderRadius: 20, cursor: "pointer",
                    border: `1px solid ${on ? color : "rgba(0,0,0,0.12)"}`, background: on ? (value !== "everyone" ? PRIVATE_BG : "#EBF2FA") : "#fff",
                    color: on ? color : "#3a3a3a", fontWeight: on ? 600 : 400, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                >
                  {value !== "everyone" && <LockIcon size={10} />}
                  {label}
                </button>
              );
            })}
          </div>
        )}
        <div style={{ padding: privateWith ? "8px 20px 18px" : "12px 20px 18px", display: "flex", gap: 8, borderTop: privateWith ? "none" : "1px solid rgba(0,0,0,0.06)" }}>
          <input
            className="chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
            placeholder={privateTarget ? `Private to ${privateTarget.name}. The ${leftOut} won't see this…` : "Reply to office / driver…"}
            aria-label={privateTarget ? `Private message to ${privateTarget.name}` : "Message the office and driver"}
            style={{
              width: "100%", padding: "8px 11px", fontSize: 13.5, border: `1px solid ${privateTarget ? `${PRIVATE_COLOR}88` : "rgba(0,0,0,0.14)"}`,
              borderRadius: 8, outline: "none", color: "#1a1a1a", background: privateTarget ? PRIVATE_BG : "#fff", boxSizing: "border-box",
            }}
          />
          <button
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            style={{
              padding: "8px 16px", fontSize: 13, fontWeight: 500, borderRadius: 8, border: "none",
              color: "white", background: sending || !draft.trim() ? "#9ab6d6" : "#185FA5",
              cursor: sending || !draft.trim() ? "default" : "pointer", flexShrink: 0,
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
