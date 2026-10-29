// Server-to-driver-app messages over Supabase Realtime broadcast.
//
// Used where postgres_changes can't reach the driver: once a job is taken off
// a driver, row-level security hides it from them, so they get no change
// event. The driver app listens on `driver:<driverId>`.
//
// Broadcast channels are public, so payloads carry only ids, and the app
// re-checks the database before acting on one (a forged message does nothing).
export async function notifyDriver(driverId: string, event: string, payload: Record<string, unknown>) {
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: [{ topic: `driver:${driverId}`, event, payload }] }),
    });
    if (!res.ok) console.error("[notifyDriver]", res.status, await res.text());
  } catch (err) {
    // Best effort: the driver still sees the change on their next refresh.
    console.error("[notifyDriver]", err);
  }
}
