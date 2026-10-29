import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
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

interface MessagesContextType {
  unreadByJob: Record<string, number>;
  /** The chat screen is showing this job: its messages are read as they arrive. */
  setActiveChat: (jobId: string | null) => void;
  activeChat: string | null;
  /** Mark a thread read up to the newest message the driver has seen. */
  markRead: (jobId: string, upTo: string) => void;
  /** Called for each lab/office message, except on the chat that's open. */
  onIncoming: (listener: (message: Message) => void) => () => void;
}

const MessagesContext = createContext<MessagesContextType>({
  unreadByJob: {},
  setActiveChat: () => {},
  activeChat: null,
  markRead: () => {},
  onIncoming: () => () => {},
});

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const driverId = getDriverId(session);
  const [unreadByJob, setUnreadByJob] = useState<Record<string, number>>({});
  const [activeChat, setActiveChatState] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const listeners = useRef(new Set<(message: Message) => void>());

  const refresh = useCallback(async () => {
    try {
      const res = await apiGet<{ byJob: Record<string, number> }>('/api/driver/messages/unread');
      if (!res.data) return;
      const byJob = res.data.byJob;
      // The open chat is being read live.
      if (activeRef.current) delete byJob[activeRef.current];
      setUnreadByJob(byJob);
    } catch {
      // Offline: keep the last counts.
    }
  }, []);

  useEffect(() => {
    if (!driverId) {
      // Signed out: no badges carry over to the next driver.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnreadByJob({});
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

  return (
    <MessagesContext.Provider value={{ unreadByJob, setActiveChat, activeChat, markRead, onIncoming }}>
      {children}
    </MessagesContext.Provider>
  );
}

export function useMessages() {
  return useContext(MessagesContext);
}
