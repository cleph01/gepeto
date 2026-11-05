// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

export const DEFAULT_LONG_BREAK_MINS = "45";

/** Minutes before dispatch sees a break flagged, or null when the lab has the flag off. */
export function breakFlagMins(settings: { notifications?: { longBreakAlert?: unknown; longBreakMins?: unknown } } | null | undefined): number | null {
  const notifs = settings?.notifications;
  if (notifs?.longBreakAlert !== true) return null;
  const mins = Number(notifs.longBreakMins ?? DEFAULT_LONG_BREAK_MINS);
  return mins > 0 ? mins : Number(DEFAULT_LONG_BREAK_MINS);
}

/** A driver as dispatch may see them: during a break, the location stays on the server. */
export function hideLocationOnBreak<T extends { onBreakSince?: unknown; currentLocation?: unknown }>(driver: T): T {
  return driver.onBreakSince ? { ...driver, currentLocation: null } : driver;
}

/** Offices with a case this driver is carrying, whose tracking pages show the driver's location. */
export async function officesCarriedFor(driverId: string, labId: string): Promise<string[]> {
  const rows: { officeId: string }[] = await db("jobs")
    .where({ driver_id: driverId, lab_id: labId })
    .whereIn("status", ["picked_up", "in_transit", "arrived"])
    .distinct("office_id");
  return rows.map((r) => r.officeId);
}
