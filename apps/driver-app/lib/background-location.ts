import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { apiPatch } from './api';

// Keeps the driver's location flowing to the lab and offices while they
// navigate in Google Maps / Waze / Apple Maps or lock the phone. Runs only
// once the driver has accepted work (useLocationTracking starts and stops it). iOS shows the blue location pill; Android shows a notification.
//
// The task must be defined when the app's JS loads, even if it was woken in
// the background, so app/_layout.tsx imports this file.

export const LOCATION_TASK = 'gepeto-driver-location';

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const last = data.locations[data.locations.length - 1];
  try {
    const res = await apiPatch<{ location: unknown }>('/api/drivers/location', { lat: last.coords.latitude, lng: last.coords.longitude });
    // The server didn't keep it: this driver's work ended while the app was closed.
    if (res.data && res.data.location === null) await stopBackgroundLocation();
  } catch {
    // No signal: the next update tries again.
  }
});

/** Whether the driver has allowed location while Gepeto isn't on screen. */
export async function hasBackgroundPermission(): Promise<boolean> {
  const { status } = await Location.getBackgroundPermissionsAsync().catch(() => ({ status: 'denied' }));
  return status === 'granted';
}

// Asks for "Always" (once; afterwards it's a Settings change) and starts
// updates. Returns false when background updates aren't running, in which
// case the app's own 30-second pings still cover the time it's open.
export async function startBackgroundLocation(): Promise<boolean> {
  try {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') return false;
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) return true;
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 30_000,          // Android: about every 30s
      distanceInterval: 75,          // and/or every 75 m of driving
      deferredUpdatesInterval: 30_000,
      activityType: Location.ActivityType.AutomotiveNavigation,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Sharing your location with the lab',
        notificationBody: 'Only while you have accepted work.',
        notificationColor: '#185FA5',
        killServiceOnDestroy: true,
      },
    });
    return true;
  } catch {
    // Not available in this build (e.g. Expo Go on Android).
    return false;
  }
}

export async function stopBackgroundLocation(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    }
  } catch {
    // Already stopped.
  }
}
