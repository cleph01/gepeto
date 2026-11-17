import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/auth';
import { getDriverId } from '@/lib/driver';
import { describeItem, dropPhoto, loadOutbox, saveOutbox, sendItem, type OutboxItem } from '@/lib/outbox';

// The offline queue's live state (see lib/outbox.ts). Items are sent one at a
// time, oldest first: right after they're added, when the app comes back to
// the front, and every 30 seconds while any are waiting.

const RETRY_MS = 30_000;

type OutboxContextValue = {
  /** Everything not yet saved on the server, oldest first, including refused items. */
  items: OutboxItem[];
  /** A send is in progress. */
  sending: boolean;
  /** Bumps whenever something was saved, so screens re-read from the server. */
  syncedAt: number;
  enqueue: (items: OutboxItem[]) => void;
  retryNow: () => void;
  /** Clears a refused item. */
  dismiss: (id: string) => void;
};

const OutboxContext = createContext<OutboxContextValue>({
  items: [],
  sending: false,
  syncedAt: 0,
  enqueue: () => {},
  retryNow: () => {},
  dismiss: () => {},
});

export function OutboxProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const driverId = getDriverId(session);
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [sending, setSending] = useState(false);
  const [syncedAt, setSyncedAt] = useState(0);
  // The send loop reads and writes through the ref, so items added mid-send aren't lost.
  const itemsRef = useRef<OutboxItem[]>([]);
  const flushing = useRef(false);

  const commit = useCallback((next: OutboxItem[]) => {
    itemsRef.current = next;
    setItems(next);
    if (driverId) saveOutbox(driverId, next).catch(() => {});
  }, [driverId]);

  const flush = useCallback(async () => {
    if (flushing.current || !driverId) return;
    flushing.current = true;
    setSending(true);
    let saved = false;
    let offline = false;
    try {
      for (;;) {
        const next = itemsRef.current.find((i) => !i.failed);
        if (!next) break;
        const result = await sendItem(next, (file, path) => {
          // One photo can belong to every job in a group delivery.
          commit(itemsRef.current.map((i) =>
            i.kind === 'job_status' && i.photo?.file === file ? { ...i, photo: { ...i.photo, uploadedPath: path } } : i
          ));
        });
        if (result.ok) {
          const remaining = itemsRef.current.filter((i) => i.id !== next.id);
          commit(remaining);
          if (next.kind === 'job_status' && next.photo) dropPhoto(next.photo.file, remaining);
          saved = true;
          continue;
        }
        if (result.offline) {
          offline = true;
          break;
        }
        // Refused. Later steps of the same job depend on this one, so they're refused with it.
        const message = result.message;
        commit(itemsRef.current.map((i) =>
          i.id === next.id || (next.kind === 'job_status' && i.kind === 'job_status' && i.jobId === next.jobId && !i.failed)
            ? { ...i, failed: message }
            : i
        ));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(`${describeItem(next)} wasn't saved`, message);
      }
    } finally {
      flushing.current = false;
      setSending(false);
      if (saved) setSyncedAt(Date.now());
    }
    // Something added just as the loop finished: send it too.
    if (!offline && itemsRef.current.some((i) => !i.failed)) setTimeout(flush, 0);
  }, [driverId, commit]);

  // Each driver has their own queue on the phone; load it at sign-in and send what's waiting.
  useEffect(() => {
    itemsRef.current = [];
    setItems([]);
    if (!driverId) return;
    let cancelled = false;
    loadOutbox(driverId).then((saved) => {
      if (cancelled) return;
      itemsRef.current = saved;
      setItems(saved);
      flush();
    });
    return () => { cancelled = true; };
  }, [driverId, flush]);

  // Back in the app (often with signal again): try right away.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') flush();
    });
    return () => sub.remove();
  }, [flush]);

  const waiting = items.some((i) => !i.failed);
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(flush, RETRY_MS);
    return () => clearInterval(timer);
  }, [waiting, flush]);

  const enqueue = useCallback((added: OutboxItem[]) => {
    commit([...itemsRef.current, ...added]);
    flush();
  }, [commit, flush]);

  const dismiss = useCallback((id: string) => {
    const gone = itemsRef.current.find((i) => i.id === id);
    const remaining = itemsRef.current.filter((i) => i.id !== id);
    commit(remaining);
    if (gone?.kind === 'job_status' && gone.photo) dropPhoto(gone.photo.file, remaining);
  }, [commit]);

  return (
    <OutboxContext.Provider value={{ items, sending, syncedAt, enqueue, retryNow: flush, dismiss }}>
      {children}
    </OutboxContext.Provider>
  );
}

export const useOutbox = () => useContext(OutboxContext);
