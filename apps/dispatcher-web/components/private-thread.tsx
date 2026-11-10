"use client";

import { useEffect, useState } from "react";
import type { ApiResponse } from "@gepeto/types";
import { useAuth } from "@/context/auth";
import { privateThreadPath, useMessageNotifications } from "@/context/message-notifications";

// The lab's private thread with one office or one driver. Nobody else sees
// it: an office's isn't shown to drivers, a driver's isn't shown to offices.
// Shown on the Messages page.

export interface PrivateMessage {
  // camelCased by @gepeto/db
  id: string;
  senderRole: "dispatcher" | "office" | "driver";
  body: string;
  createdAt: string;
  aboutCaseId: string | null;
}

export interface CaseRef {
  id: string;
  caseId: string;
}

export const PRIVATE_COLOR = "#6B4FA0";
export const PRIVATE_BG = "rgba(107,79,160,0.08)";

export function LockIcon({ size = 11, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <rect x="2.25" y="5.25" width="7.5" height="5.25" rx="1" stroke={color} strokeWidth="1.2" />
      <path d="M4 5.25V4a2 2 0 014 0v1.25" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

const COLOR = { dispatcher: "#185FA5", office: "#854F0B", driver: "#3B6D11" } as const;
const BG = { dispatcher: "rgba(24,95,165,0.10)", office: "rgba(133,79,11,0.10)", driver: "rgba(59,109,17,0.10)" } as const;

/** Who a private thread is with. */
export type PrivateParty = { kind: "office" | "driver"; id: string; name: string };

function dayAndTime(iso: string) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return sameDay ? time : `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}

export function PrivateThread({ party, activeCases, onBack, compact = false }: {
  party: PrivateParty;
  /** This office's cases in progress, for the About picker. */
  activeCases: CaseRef[];
  /** Phones: back to the list. */
  onBack?: () => void;
  /** Keyboard up on a small screen: shorter header, more room for messages. */
  compact?: boolean;
}) {
  const { apiFetch } = useAuth();
  const { markPrivateRead, setActivePrivateThread, directMessageArrived } = useMessageNotifications();
  const [messages, setMessages] = useState<PrivateMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [about, setAbout] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const thread = `${party.kind}:${party.id}`;
  const path = privateThreadPath(thread);
  const name = party.name;
  const isOffice = party.kind === "office";

  const load = () => {
    apiFetch<ApiResponse<PrivateMessage[]>>(path).then((res) => {
      if (res.data) setMessages(res.data);
    }).catch(() => {});
  };

  // Keyed by thread where it's used, so each one starts fresh. The live
  // signal does most of the work; the slow poll covers a dropped connection.
  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    setActivePrivateThread(thread);
    return () => {
      clearInterval(id);
      setActivePrivateThread(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread]);

  useEffect(() => {
    if (directMessageArrived?.thread === thread) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directMessageArrived]);

  const newestAt = messages?.length ? messages[messages.length - 1].createdAt : null;
  useEffect(() => {
    if (newestAt) markPrivateRead(thread, newestAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread, newestAt]);

  // A case that's since been delivered drops out of the picker.
  const aboutCase = activeCases.find((c) => c.id === about) ?? null;

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await apiFetch<ApiResponse<PrivateMessage>>(path, {
        method: "POST",
        body: JSON.stringify({ body, aboutJobId: aboutCase?.id ?? null }),
      });
      if (res.data) {
        setMessages((prev) => {
          const list = prev ?? [];
          return list.some((m) => m.id === res.data!.id) ? list : [...list, res.data!];
        });
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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: "#fff" }}>
      <div style={{ padding: compact ? "6px 14px" : "12px 18px", borderBottom: "1px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {onBack && (
          <button onClick={onBack} aria-label="Back to conversations" style={{ background: "none", border: "none", cursor: "pointer", color: "#185FA5", padding: 4, display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )}
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: PRIVATE_COLOR, marginTop: 1 }}>
            <LockIcon />
            {isOffice
              ? compact ? "Private · drivers don\u2019t see this" : <>Private: only your lab and this office see this. Drivers don&apos;t.</>
              : compact ? "Private · offices don\u2019t see this" : <>Private: only your lab and this driver see this. Offices don&apos;t.</>}
          </div>
        </div>
      </div>

      {/* column-reverse keeps the newest message in view */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column-reverse" }}>
        <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          {messages === null && <div style={{ fontSize: 12.5, color: "#9a9a9a", textAlign: "center", padding: "24px 0" }}>Loading…</div>}
          {messages?.length === 0 && (
            <div style={{ fontSize: 12.5, color: "#9a9a9a", textAlign: "center", padding: "24px 12px", lineHeight: 1.5 }}>
              No private messages with {name} yet.<br />
              {isOffice
                ? <>For anything the driver should see, use the case&apos;s Messages on the Jobs page.</>
                : <>For anything the office should see, use the case&apos;s Messages on the Jobs page.</>}
            </div>
          )}
          {messages?.map((m) => {
            const mine = m.senderRole === "dispatcher";
            return (
              <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 2 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: COLOR[m.senderRole] }}>{mine ? "You (Dispatch)" : name}</span>
                  <span style={{ fontSize: 10.5, color: "#9a9a9a" }}>· {dayAndTime(m.createdAt)}</span>
                  {m.aboutCaseId && (
                    <span style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", color: "#5F5E5A", background: "#F1F1EF", borderRadius: 4, padding: "0 5px" }}>{m.aboutCaseId}</span>
                  )}
                </div>
                <div style={{ background: BG[m.senderRole], color: "#1a1a1a", borderRadius: 10, padding: "7px 11px", fontSize: 13, lineHeight: 1.4, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                  {m.body}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "10px 18px 16px", borderTop: "1px solid rgba(0,0,0,0.06)", flexShrink: 0 }}>
        {activeCases.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, color: "#5F5E5A" }}>About:</span>
            {[{ id: null as string | null, caseId: "General" }, ...activeCases].map((c) => {
              const on = (aboutCase?.id ?? null) === c.id;
              return (
                <button
                  key={c.id ?? "general"}
                  onClick={() => setAbout(c.id)}
                  aria-pressed={on}
                  style={{
                    fontSize: 11.5, fontFamily: c.id ? "ui-monospace, monospace" : "inherit", padding: "3px 9px", borderRadius: 20, cursor: "pointer",
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
            className="chat-input"
            placeholder={`Private message to ${name}…`}
            aria-label={`Private message to ${name}`}
            style={{ flex: 1, minWidth: 0, padding: "8px 11px", fontSize: 13.5, border: `1px solid ${PRIVATE_COLOR}55`, borderRadius: 8, outline: "none", color: "#1a1a1a", background: "#fff" }}
          />
          <button
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            style={{
              padding: "8px 16px", fontSize: 13, fontWeight: 500, borderRadius: 8, border: "none", color: "white", flexShrink: 0,
              background: sending || !draft.trim() ? "#9ab6d6" : "#185FA5", cursor: sending || !draft.trim() ? "default" : "pointer",
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
