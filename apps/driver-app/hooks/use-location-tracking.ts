import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { apiPatch } from '@/lib/api';

const INTERVAL_MS = 30_000; // 30 seconds

/**
 * Tracks the driver's foreground location and pings the server every 30s.
 * Starts when `active` is true, stops (and clears interval) when false.
 */
export function useLocationTracking(active: boolean) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
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
}
