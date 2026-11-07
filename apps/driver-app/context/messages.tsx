import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Message } from '@gepeto/types';
import { supabase, channelName } from '@/lib/supabase';
import { rowToCamel } from '@/lib/transform';
import { apiGet, apiPost } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { getDriverId } from '@/lib/driver';

// App-wide message state for the driver: unread counts per job (Jobs list
// badges, the Messages card on a job) and a feed of incoming lab/office
// messages (the new-message banner in JobAlerts).
//
// Counts come from GET /api/driver/messages/unread (per-user read tracking,
// the same table the dispatch dashboard uses). New messages arrive over
// postgres_changes; row-level security limits them to this driver's jobs.
//
// Messages on returns live in their own table, reached only through the API.
// The server signals `driver-return-messages:<driverId>`, and this re-reads the
// unread list, so a forged signal shows nothing. A slow check covers a missed one.

const RETURN_POLL_MS = 30_000;

/** A lab or office message on a return, for the banner. */
export type IncomingReturnMessage = {
  id: string;
  returnId: string;
  senderRole: 'office' | 'dispatcher';
  body: string;
  createdAt: string;
  number: number;
  officeName: string | null;
};

interface MessagesContextType {
  unreadByJob: Record<string, number>;
  unreadByReturn: Record<string, number>;
  /** The conversation with the newest unread message (the Messages card on the Jobs screen opens it). */
  newestUnread: { kind: 'job' | 'return'; id: string } | null;
  /** The chat screen is showing this job: its messages are read as they arrive. */
  setActiveChat: (jobId: string | null) => void;
  activeChat: string | null;
  /** Mark a thread read up to the newest message the driver has seen. */
  markRead: (jobId: string, upTo: string) => void;
  /** Called for each lab/office message, except on the chat that's open. */
  onIncoming: (listener: (message: Message) => void) => () => void;
  setActiveReturnChat: (returnId: string | null) => void;
  markReturnRead: (returnId: string, upTo: string) => void;
  onIncomingReturn: (listener: (message: IncomingReturnMessage) => void) => () => void;
  /** Re-read return message counts, e.g. after a pickup moved on or off this driver. */
  refreshReturnUnread: () => void;
  /** Changes when a message lands on one of this driver's returns. */
  returnMessageTick: number;
}

const MessagesContext = createContext<MessagesContextType>({
  unreadByJob: {},
  unreadByReturn: {},
  newestUnread: null,
  setActiveChat: () => {},
  activeChat: null,
  markRead: () => {},
  onIncoming: () => () => {},
  setActiveReturnChat: () => {},
  markReturnRead: () => {},
  onIncomingReturn: () => () => {},
  refreshReturnUnread: () => {},
  returnMessageTick: 0,
});

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const driverId = getDriverId(session);
  const [unreadByJob, setUnreadByJob] = useState<Record<string, number>>({});
  const [latestByJob, setLatestByJob] = useState<Record<string, string>>({});
  const [activeChat, setActiveChatState] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const listeners = useRef(new Set<(message: Message) => void>());
  const [unreadByReturn, setUnreadByReturn] = useState<Record<string, number>>({});
  const [latestByReturn, setLatestByReturn] = useState<Record<string, string>>({});
  const [returnMessageTick, setReturnMessageTick] = useState(0);
  const activeReturnRef = useRef<string | null>(null);
  const returnListeners = useRef(new Set<(message: IncomingReturnMessage) => void>());
  const seenReturnMessages = useRef(new Set<string>());
  const returnsPrimed = useRef(false); // the first check only records what's already unread

  const refresh = useCallback(async () => {
    try {
      const res = await apiGet<{ byJob: Record<string, number>; latestByJob?: Record<string, string> }>('/api/driver/messages/unread');
      if (!res.data) return;
      const byJob = res.data.byJob;
      // The open chat is being read live.
      if (activeRef.current) delete byJob[activeRef.current];
      setUnreadByJob(byJob);
      setLatestByJob(res.data.latestByJob ?? {});
    } catch {
      // Offline: keep the last counts.
    }
  }, []);

  const refreshReturns = useCallback(async () => {
    try {
      const res = await apiGet<{ byReturn: Record<string, number>; recent: IncomingReturnMessage[] }>('/api/returns/messages/unread');
      if (!res.data) return;
      const { byReturn, recent } = res.data;
      if (activeReturnRef.current) delete byReturn[activeReturnRef.current];
      setUnreadByReturn(byReturn);
      const latest: Record<string, string> = {};
      for (const m of recent) latest[m.returnId] ??= m.createdAt; // newest first
      setLatestByReturn(latest);

      const fresh = recent.filter((m) => !seenReturnMessages.current.has(m.id));
      for (const m of fresh) seenReturnMessages.current.add(m.id);
      if (!returnsPrimed.current) {
        returnsPrimed.current = true;
        return;
      }
      const newest = fresh.find((m) => m.returnId !== activeReturnRef.current);
      if (newest) returnListeners.current.forEach((l) => l(newest));
    } catch {
      // Offline: keep the last counts.
    }
  }, []);

  useEffect(() => {
    if (!driverId) {
      seenReturnMessages.current = new Set();
      returnsPrimed.current = false;
      setUnreadByReturn({});
      setLatestByReturn({});
      return;
    }
    refreshReturns();
    const topic = `driver-return-messages:${driverId}`;
    for (const c of supabase.getChannels()) {
      if (c.topic === `realtime:${topic}`) supabase.removeChannel(c);
    }
    const channel = supabase
      .channel(topic)
      .on('broadcast', { event: 'message' }, () => {
        setReturnMessageTick((t) => t + 1);
        refreshReturns();
      })
      .subscribe();
    const timer = setInterval(refreshReturns, RETURN_POLL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshReturns();
    });
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
      sub.remove();
    };
  }, [driverId, refreshReturns]);

  useEffect(() => {
    if (!driverId) {
      // Signed out: no badges carry over to the next driver.
      setUnreadByJob({});
      setLatestByJob({});
      return;
    }
    refresh();

    const channel = supabase
      .channel(channelName('driver-messages'))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const msg = rowToCamel<Message>(payload.new as Record<string, unknown>);
        if (msg.senderRole === 'driver') return;
        if (msg.jobId === activeRef.current) return;
        setUnreadByJob((prev) => ({ ...prev, [msg.jobId]: (prev[msg.jobId] ?? 0) + 1 }));
        setLatestByJob((prev) => ({ ...prev, [msg.jobId]: msg.createdAt }));
        listeners.current.forEach((l) => l(msg));
      })
      .subscribe();

    // Catch up on anything missed while the app was in the background.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });

    return () => {
      supabase.removeChannel(channel);
      sub.remove();
    };
  }, [driverId, refresh]);

  const setActiveChat = useCallback((jobId: string | null) => {
    activeRef.current = jobId;
    setActiveChatState(jobId);
    if (jobId) {
      setUnreadByJob((prev) => {
        if (!prev[jobId]) return prev;
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
    }
  }, []);

  const markRead = useCallback((jobId: string, upTo: string) => {
    setUnreadByJob((prev) => {
      if (!prev[jobId]) return prev;
      const next = { ...prev };
      delete next[jobId];
      return next;
    });
    apiPost(`/api/jobs/${jobId}/messages/read`, { upTo }).catch(() => {});
  }, []);

  const onIncoming = useCallback((listener: (message: Message) => void) => {
    listeners.current.add(listener);
    return () => { listeners.current.delete(listener); };
  }, []);

  const setActiveReturnChat = useCallback((returnId: string | null) => {
    activeReturnRef.current = returnId;
    if (returnId) {
      setUnreadByReturn((prev) => {
        if (!prev[returnId]) return prev;
        const next = { ...prev };
        delete next[returnId];
        return next;
      });
    }
  }, []);

  const markReturnRead = useCallback((returnId: string, upTo: string) => {
    setUnreadByReturn((prev) => {
      if (!prev[returnId]) return prev;
      const next = { ...prev };
      delete next[returnId];
      return next;
    });
    apiPost(`/api/returns/${returnId}/messages/read`, { upTo }).catch(() => {});
  }, []);

  const onIncomingReturn = useCallback((listener: (message: IncomingReturnMessage) => void) => {
    returnListeners.current.add(listener);
    return () => { returnListeners.current.delete(listener); };
  }, []);

  const newestUnread = useMemo(() => {
    const options = [
      ...Object.keys(unreadByJob).map((id) => ({ kind: 'job' as const, id, at: Date.parse(latestByJob[id]) || 0 })),
      ...Object.keys(unreadByReturn).map((id) => ({ kind: 'return' as const, id, at: Date.parse(latestByReturn[id]) || 0 })),
    ].sort((a, b) => b.at - a.at);
    return options[0] ? { kind: options[0].kind, id: options[0].id } : null;
  }, [unreadByJob, latestByJob, unreadByReturn, latestByReturn]);

  return (
    <MessagesContext.Provider value={{ unreadByJob, unreadByReturn, newestUnread, setActiveChat, activeChat, markRead, onIncoming, setActiveReturnChat, markReturnRead, onIncomingReturn, refreshReturnUnread: refreshReturns, returnMessageTick }}>
      {children}
    </MessagesContext.Provider>
  );
}

export function useMessages() {
  return useContext(MessagesContext);
}
