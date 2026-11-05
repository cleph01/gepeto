import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { apiGet, apiPost } from '@/lib/api';

type BreakState = { onBreakSince: string | null };

/**
 * The driver's break, saved on the server so it survives closing the app.
 * `since` is undefined until first loaded, null when not on a break. If it can't
 * load, tracking may go ahead: the server drops pings during a break anyway.
 */
export function useDriverBreak() {
  const [since, setSince] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      apiGet<BreakState>('/api/driver/break')
        .then((res) => {
          if (!active) return;
          if (res.data) setSince(res.data.onBreakSince);
          else setSince((current) => current ?? null);
        })
        .catch(() => {
          if (active) setSince((current) => current ?? null);
        });
      return () => {
        active = false;
      };
    }, [])
  );

  /** Resolves false when the change didn't save; the driver's state is unchanged. */
  const setOnBreak = useCallback(async (onBreak: boolean) => {
    setBusy(true);
    try {
      const res = await apiPost<BreakState>('/api/driver/break', { onBreak });
      if (!res.data) return false;
      setSince(res.data.onBreakSince);
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { since, busy, setOnBreak };
}
