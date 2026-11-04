// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// Server-to-driver-app messages over Supabase Realtime broadcast.
//
// Used where postgres_changes can't reach the driver: once a job is taken off
// a driver, row-level security hides it from them, so they get no change
// event. The driver app listens on `driver:<driverId>`.
//
// Broadcast channels are public, so payloads carry only ids, and the app
// re-checks the database before acting on one (a forged message does nothing).
export async function notifyDriver(driverId: string, event: string, payload: Record<string, unknown>) {
  await broadcast(`driver:${driverId}`, event, payload);
}

// Pickup requests assigned to (or taken off) a driver. A separate topic from
// `driver:<id>`, which the app's job alerts own and reset on every subscribe.
// The app only reloads its returns list on this, so a forged message is harmless.
export async function notifyDriverPickups(driverId: string, event: string, payload: Record<string, unknown>) {
  await broadcast(`driver-pickups:${driverId}`, event, payload);
}

// Driver-to-dispatch: the dashboard listens on `lab:<labId>` so a driver's
// accept, reject or status step shows up without waiting for the poll.
// (postgres_changes alone proved unreliable for the dispatcher's session.)
export async function notifyLab(labId: string, event: string, payload: Record<string, unknown>) {
  await broadcast(`lab:${labId}`, event, payload);
}

/** What an office's tracking page should reload. */
export type OfficeChange = "jobs" | "messages" | "pickups" | "location";

// Lab-to-office: the public tracking page listens on `office:<tracking token>`.
// The token is the page's secret, so only someone with the link can listen.
// The payload says only what kind of thing changed; the page reloads it
// through its normal token-checked endpoints.
export async function notifyOffices(officeIds: (string | null | undefined)[], what: OfficeChange) {
  const ids = [...new Set(officeIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return;
  try {
    const rows: { trackingToken: string }[] = await db("offices").whereIn("id", ids).select("tracking_token");
    await Promise.all(rows.map((r) => broadcast(`office:${r.trackingToken}`, "changed", { what })));
  } catch (err) {
    // Best effort, like every broadcast: the page also polls.
    console.error("[notifyOffices]", err);
  }
}

// For a link that was just replaced: pages open on the old token get told to
// reload, which lands them on the "link isn't working" screen.
export async function notifyOldOfficeLink(token: string) {
  await broadcast(`office:${token}`, "changed", { what: "jobs" });
}

async function broadcast(topic: string, event: string, payload: Record<string, unknown>) {
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: [{ topic, event, payload }] }),
    });
    if (!res.ok) console.error("[broadcast]", topic, res.status, await res.text());
  } catch (err) {
    // Best effort: the change still shows up on the next refresh or poll.
    console.error("[broadcast]", topic, err);
  }
}
