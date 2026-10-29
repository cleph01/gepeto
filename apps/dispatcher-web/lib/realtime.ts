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

// Driver-to-dispatch: the dashboard listens on `lab:<labId>` so a driver's
// accept, reject or status step shows up without waiting for the poll.
// (postgres_changes alone proved unreliable for the dispatcher's session.)
export async function notifyLab(labId: string, event: string, payload: Record<string, unknown>) {
  await broadcast(`lab:${labId}`, event, payload);
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
