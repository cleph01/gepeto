"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SenderRole = "dispatcher" | "driver" | "office";

interface Message {
  id: string;
  // @gepeto/db auto-camelCases every query result (see packages/db/db.js
  // postProcessResponse) — these fields are senderRole/createdAt over the
  // wire even though the DB column is sender_role/created_at.
  senderRole: SenderRole;
  body: string;
  createdAt: string;
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

function ChatIcon({ size = 16 }: { size?: number }) {
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

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
    >
      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
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

export default function MessageThread({ token, jobId }: { token: string; jobId: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/track/${token}/jobs/${jobId}/messages`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.data) setMessages(json.data);
    } catch {
      // silent — stale thread is fine, next poll will catch up
    }
  }, [token, jobId]);

  // Load once on mount regardless of open state, so the collapsed toggle
  // button can show a message count badge without polling every card.
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [open, load]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/track/${token}/jobs/${jobId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) setMessages((prev) => [...prev, json.data]);
        setDraft("");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          padding: "12px 16px",
          background: open ? "#EBF2FA" : "#FAFAFA",
          border: "none",
          textAlign: "left",
          fontSize: 13.5,
          color: "#185FA5",
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 9,
          transition: "background 0.15s",
        }}
      >
        <span style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 28, height: 28, borderRadius: "50%", background: "#185FA5", color: "white", flexShrink: 0,
        }}>
          <ChatIcon size={15} />
        </span>
        <span style={{ flex: 1 }}>Message dispatch &amp; driver</span>
        {messages.length > 0 && (
          <span style={{
            background: "#185FA5", color: "white", fontSize: 11, fontWeight: 700,
            borderRadius: 10, padding: "1px 7px", minWidth: 18, textAlign: "center", flexShrink: 0,
          }}>
            {messages.length}
          </span>
        )}
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div style={{ padding: "0 16px 14px" }}>
          <RoleLegend />
          <div
            ref={listRef}
            style={{
              maxHeight: 180,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginBottom: 10,
              padding: messages.length ? "8px 0" : 0,
            }}
          >
            {messages.length === 0 && (
              <div style={{ fontSize: 12, color: "#9a9a9a" }}>No messages yet.</div>
            )}
            {messages.map((m) => (
              <div key={m.id} style={{ alignSelf: m.senderRole === "office" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    justifyContent: m.senderRole === "office" ? "flex-end" : "flex-start",
                    marginBottom: 2,
                  }}
                >
                  <RoleIcon role={m.senderRole} color={ROLE_COLOR[m.senderRole]} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: ROLE_COLOR[m.senderRole] }}>
                    {SENDER_LABEL[m.senderRole]}
                  </span>
                </div>
                <div
                  style={{
                    background: ROLE_BG[m.senderRole],
                    color: "#1a1a1a",
                    borderRadius: 10,
                    padding: "6px 10px",
                    fontSize: 13,
                    lineHeight: 1.4,
                    wordBreak: "break-word",
                  }}
                >
                  {m.body}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              placeholder="Type a message…"
              style={{
                flex: 1,
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 13,
                color: "#1a1a1a",
                outline: "none",
              }}
            />
            <button
              onClick={handleSend}
              disabled={sending || !draft.trim()}
              style={{
                border: "none",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 500,
                color: "white",
                background: sending || !draft.trim() ? "#9ab6d6" : "#185FA5",
                cursor: sending || !draft.trim() ? "default" : "pointer",
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
