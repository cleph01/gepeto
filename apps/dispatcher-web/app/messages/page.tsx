"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiResponse } from "@gepeto/types";
import HelpLink from "@/components/help-link";
import { LockIcon, PRIVATE_COLOR, PrivateThread, type CaseRef } from "@/components/private-thread";
import { useAuth } from "@/context/auth";
import { UnreadBadge, useMessageNotifications } from "@/context/message-notifications";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useVisibleArea } from "@/hooks/use-visible-area";

// Private conversations between the lab and each office. Case conversations,
// which the driver sees too, stay on each job's Messages button.

interface Conversation {
  kind: "office";
  id: string;
  name: string;
  lastMessage: { senderRole: "dispatcher" | "office"; body: string; createdAt: string } | null;
  unread: number;
  activeCases: CaseRef[];
}

function shortTime(iso: string) {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function MessagesPage() {
  const { apiFetch } = useAuth();
  const { unreadByOffice, directMessageArrived, jobsChangedAt, pendingOpenOffice, clearPendingOpenOffice } = useMessageNotifications();
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

  // A toast or alert asked for this office. The request lives in the shared
  // context, so it has to be handed over here.
  useEffect(() => {
    if (!pendingOpenOffice) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(pendingOpenOffice);
    clearPendingOpenOffice();
  }, [pendingOpenOffice, clearPendingOpenOffice]);

  // Until one is picked, desktop shows the most recent conversation.
  const mostRecent = (list ?? [])
    .filter((c) => c.lastMessage)
    .sort((a, b) => b.lastMessage!.createdAt.localeCompare(a.lastMessage!.createdAt))[0]?.id ?? null;
  const selectedId = selected ?? (isMobile ? null : mostRecent);

  // Unread first, then most recent, then everyone else by name.
  const sorted = (list ?? [])
    .filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      const ua = unreadByOffice[a.id] ?? 0, ub = unreadByOffice[b.id] ?? 0;
      if (!!ua !== !!ub) return ua ? -1 : 1;
      const ta = a.lastMessage?.createdAt ?? "", tb = b.lastMessage?.createdAt ?? "";
      if (ta !== tb) return tb.localeCompare(ta);
      return a.name.localeCompare(b.name);
    });
  const current = list?.find((c) => c.id === selectedId) ?? null;
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
            <LockIcon color={PRIVATE_COLOR} /> Private conversations with your offices
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
                placeholder="Find an office…"
                aria-label="Find an office"
                style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px", fontSize: 13, border: "1px solid rgba(0,0,0,0.12)", borderRadius: 7, outline: "none", color: "#1a1a1a" }}
              />
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {error && !list && <div style={{ padding: 20, fontSize: 12.5, color: "#A32D2D" }}>Couldn&apos;t load conversations. Retrying when something changes.</div>}
              {!list && !error && <div style={{ padding: 20, fontSize: 12.5, color: "#9a9a9a" }}>Loading…</div>}
              {list && sorted.length === 0 && (
                <div style={{ padding: 20, fontSize: 12.5, color: "#9a9a9a" }}>{list.length === 0 ? "Add an office on the Offices page to message it here." : "No office matches."}</div>
              )}
              {sorted.map((c) => {
                const on = c.id === selectedId;
                const unread = unreadByOffice[c.id] ?? 0;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c.id)}
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
          </section>
        )}

        {showThread && (
          <section aria-label="Conversation" style={{
            flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column",
            border: isMobile ? "none" : "1px solid rgba(0,0,0,0.08)", borderRadius: isMobile ? 0 : 12, overflow: "hidden", background: "#fff",
          }}>
            {current ? (
              <PrivateThread
                key={current.id}
                officeId={current.id}
                officeName={current.name}
                activeCases={current.activeCases}
                onBack={isMobile ? () => setSelected(null) : undefined}
                compact={keyboardUp}
              />
            ) : (
              <div style={{ margin: "auto", textAlign: "center", padding: 24, maxWidth: 340 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#1a1a1a", marginBottom: 6 }}>Pick an office</div>
                <div style={{ fontSize: 12.5, color: "#5F5E5A", lineHeight: 1.5 }}>
                  Messages here are private between your lab and that office. To include the driver, use Messages on the case in Jobs.
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
