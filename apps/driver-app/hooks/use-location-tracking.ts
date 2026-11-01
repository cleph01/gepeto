import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { apiPatch } from '@/lib/api';
import { hasBackgroundPermission, startBackgroundLocation, stopBackgroundLocation } from '@/lib/background-location';

const INTERVAL_MS = 30_000; // 30 seconds

/**
 * Shares the driver's location while `active` (they're carrying deliveries).
 *
 * - While the app is open: a ping every 30s (covers standing still, too).
 * - In the background (navigating in another app, phone locked): the
 *   background location task, if the driver allowed "Always".
 *
 * Stops both when `active` turns false. Returns whether background sharing is
 * allowed (null until known), so the Jobs tab can ask for it.
 */
export function useLocationTracking(active: boolean): { backgroundAllowed: boolean | null } {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [backgroundAllowed, setBackgroundAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      stopBackgroundLocation();
      return;
    }

    let cancelled = false;

    async function startTracking() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      async function ping() {
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          await apiPatch('/api/drivers/location', {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          });
        } catch {
          // Silently ignore — transient network errors are expected on mobile
        }
      }

      ping(); // Immediate first ping, then on interval
      intervalRef.current = setInterval(ping, INTERVAL_MS);

      await startBackgroundLocation();
      if (!cancelled) setBackgroundAllowed(await hasBackgroundPermission());
    }

    startTracking();

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active]);

  return { backgroundAllowed };
}
