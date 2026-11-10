"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiResponse } from "@gepeto/types";
import HelpLink from "@/components/help-link";
import { LockIcon, PRIVATE_COLOR, PrivateThread, type CaseRef } from "@/components/private-thread";
import { useAuth } from "@/context/auth";
import { UnreadBadge, useMessageNotifications } from "@/context/message-notifications";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useVisibleArea } from "@/hooks/use-visible-area";

// Private conversations between the lab and each office or driver. Case conversations,
// which the driver sees too, stay on each job's Messages button.

interface Conversation {
  kind: "office" | "driver";
  id: string;
  name: string;
  lastMessage: { senderRole: "dispatcher" | "office" | "driver"; body: string; createdAt: string } | null;
  unread: number;
  activeCases: CaseRef[];
}

const keyOf = (c: { kind: string; id: string }) => `${c.kind}:${c.id}`;

function shortTime(iso: string) {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function MessagesPage() {
  const { apiFetch } = useAuth();
  const { unreadByPrivate, directMessageArrived, jobsChangedAt, pendingOpenPrivate, clearPendingOpenPrivate } = useMessageNotifications();
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";
  const visible = useVisibleArea();
  const keyboardUp = bp !== "desktop" && !!visible?.keyboardOpen;
  const [list, setList] = useState<Conversation[] | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    apiFetch<ApiResponse<Conversation[]>>("/api/direct-messages")
      .then((res) => {
        if (res.data) {
          setList(res.data);
          setError(false);
        } else setError(true);
      })
      .catch(() => setError(true));
  }, [apiFetch]);

  // Reload on new messages (order and previews) and job changes (About cases).
  useEffect(() => {
    load();
  }, [load, directMessageArrived, jobsChangedAt]);

  // A toast or alert asked for this conversation ("office:<id>" or "driver:<id>"). The request lives in the shared
  // context, so it has to be handed over here.
  useEffect(() => {
    if (!pendingOpenPrivate) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(pendingOpenPrivate);
    clearPendingOpenPrivate();
  }, [pendingOpenPrivate, clearPendingOpenPrivate]);

  // Until one is picked, desktop shows the most recent conversation.
  const mostRecent = (list ?? [])
    .filter((c) => c.lastMessage)
    .sort((a, b) => b.lastMessage!.createdAt.localeCompare(a.lastMessage!.createdAt))[0];
  const selectedKey = selected ?? (isMobile || !mostRecent ? null : keyOf(mostRecent));

  // Within each section: unread first, then most recent, then everyone else by name.
  const sorted = (list ?? [])
    .filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      const ua = unreadByPrivate[keyOf(a)] ?? 0, ub = unreadByPrivate[keyOf(b)] ?? 0;
      if (!!ua !== !!ub) return ua ? -1 : 1;
      const ta = a.lastMessage?.createdAt ?? "", tb = b.lastMessage?.createdAt ?? "";
      if (ta !== tb) return tb.localeCompare(ta);
      return a.name.localeCompare(b.name);
    });
  const sections = ([["office", "Offices"], ["driver", "Drivers"]] as const)
    .map(([kind, label]) => ({ kind, label, rows: sorted.filter((c) => c.kind === kind) }))
    .filter((sec) => sec.rows.length > 0);
  const current = list?.find((c) => keyOf(c) === selectedKey) ?? null;
  const showList = !isMobile || !current;
  const showThread = !isMobile || !!current;

  return (
    <div style={{
      display: "flex", flexDirection: "column", background: "#F8F9FB",
      height: bp === "desktop" ? "100dvh" : "calc(100dvh - 56px)",
      // Below desktop: pinned to what's visible, under the 56px top bar (or to
      // the top edge if iOS has panned the bar away), so the keyboard never
      // covers the message box.
      // While the keyboard is up, it also covers the top bar: a small phone
      // has only about 250px left, and the conversation needs it.
      ...(bp !== "desktop" && visible && (() => {
        const top = keyboardUp ? visible.top : Math.max(56, visible.top);
        return { position: "fixed" as const, left: 0, right: 0, top, height: visible.top + visible.height - top, zIndex: keyboardUp ? 55 : undefined };
      })()),
    }}>
      {/* On a phone with a thread open, the thread's own header (office name,
          back arrow, privacy note) takes its place. */}
      {!(isMobile && current) && <header style={{
        padding: isMobile ? "0 16px" : "0 28px", height: 56, flexShrink: 0,
        display: "flex", alignItems: "center", background: "#FFFFFF", borderBottom: "1px solid rgba(0,0,0,0.07)",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <h1 style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", margin: 0, letterSpacing: "-0.01em" }}>Messages</h1>
            <HelpLink slug="private-messages" topic="private messages" />
          </div>
          <p style={{ fontSize: 11.5, color: "#5F5E5A", margin: 0, display: "flex", alignItems: "center", gap: 5 }}>
            <LockIcon color={PRIVATE_COLOR} /> Private conversations with your offices and drivers
          </p>
        </div>
      </header>}

      <div style={{ flex: 1, minHeight: 0, display: "flex", padding: isMobile ? 0 : 20, gap: 16 }}>
        {showList && (
          <section aria-label="Conversations" style={{
            width: isMobile ? "100%" : 300, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0,
            background: "#fff", border: isMobile ? "none" : "1px solid rgba(0,0,0,0.08)", borderRadius: isMobile ? 0 : 12, overflow: "hidden",
          }}>
            <div style={{ padding: 10, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find an office or driver…"
                aria-label="Find an office or driver"
                style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px", fontSize: 13, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 7, outline: "none", color: "#1a1a1a" }}
              />
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {error && !list && <div style={{ padding: 20, fontSize: 12.5, color: "#A32D2D" }}>Couldn&apos;t load conversations. Retrying when something changes.</div>}
              {!list && !error && <div style={{ padding: 20, fontSize: 12.5, color: "#9a9a9a" }}>Loading…</div>}
              {list && sorted.length === 0 && (
                <div style={{ padding: 20, fontSize: 12.5, color: "#9a9a9a" }}>{list.length === 0 ? "Add an office or driver to message them here." : "Nobody matches."}</div>
              )}
              {sections.map((sec) => (
                <div key={sec.kind} role="group" aria-label={sec.label}>
                <div style={{ padding: "10px 12px 4px", fontSize: 10.5, fontWeight: 600, color: "#9a9a9a", textTransform: "uppercase", letterSpacing: "0.05em" }}>{sec.label}</div>
              {sec.rows.map((c) => {
                const key = keyOf(c);
                const on = key === selectedKey;
                const unread = unreadByPrivate[key] ?? 0;
                return (
                  <button
                    key={key}
                    onClick={() => setSelected(key)}
                    aria-current={on ? "true" : undefined}
                    style={{
                      width: "100%", textAlign: "left", display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px",
                      background: on ? "#EBF2FA" : "transparent", border: "none", borderBottom: "1px solid rgba(0,0,0,0.05)",
                      borderLeft: `2px solid ${on ? "#185FA5" : "transparent"}`, cursor: "pointer",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: unread ? 600 : 500, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                        {c.lastMessage && <span style={{ fontSize: 10.5, color: "#9a9a9a", flexShrink: 0 }}>{shortTime(c.lastMessage.createdAt)}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: unread ? "#1a1a1a" : "#5F5E5A", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.lastMessage ? `${c.lastMessage.senderRole === "dispatcher" ? "You: " : ""}${c.lastMessage.body}` : <span style={{ color: "#9a9a9a" }}>No messages yet</span>}
                      </div>
                    </div>
                    <UnreadBadge count={unread} style={{ boxShadow: "none", marginTop: 2 }} />
                  </button>
                );
              })}
                </div>
              ))}
            </div>
          </section>
        )}

        {showThread && (
          <section aria-label="Conversation" style={{
            flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column",
            border: isMobile ? "none" : "1px solid rgba(0,0,0,0.08)", borderRadius: isMobile ? 0 : 12, overflow: "hidden", background: "#fff",
          }}>
            {current ? (
              <PrivateThread
                key={keyOf(current)}
                party={{ kind: current.kind, id: current.id, name: current.name }}
                activeCases={current.activeCases}
                onBack={isMobile ? () => setSelected(null) : undefined}
                compact={keyboardUp}
              />
            ) : (
              <div style={{ margin: "auto", textAlign: "center", padding: 24, maxWidth: 340 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#1a1a1a", marginBottom: 6 }}>Pick a conversation</div>
                <div style={{ fontSize: 12.5, color: "#5F5E5A", lineHeight: 1.5 }}>
                  Messages here are private between your lab and that office or driver. To include everyone on a case, use Messages on the case in Jobs.
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
