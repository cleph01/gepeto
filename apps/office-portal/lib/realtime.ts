// Supabase Realtime broadcast (same mechanism as dispatcher-web's lib/realtime.ts).
import { officeAccess } from "./access";

// Tells the lab's dispatch dashboard something happened. The dashboard
// listens on `lab:<labId>`; payloads carry only ids.
export async function notifyLab(labId: string, event: string, payload: Record<string, unknown>) {
  await broadcast(`lab:${labId}`, event, payload);
}

/** What an office's tracking page should reload. */
export type OfficeChange = "jobs" | "messages" | "pickups" | "location";

// A message on a return this driver has. The app re-reads through the API, so
// the signal itself shows nothing. Same topic as dispatcher-web's lib/realtime.ts.
export async function notifyDriverReturnMessage(driverId: string, payload: Record<string, unknown>) {
  await broadcast(`driver-return-messages:${driverId}`, "message", payload);
}

// Tells every open copy of this office's tracking page (other tabs, other
// staff) to reload what changed. See liveTopic in @gepeto/db/office-access.
export async function notifyOfficePage(token: string, version: number, what: OfficeChange) {
  await broadcast(officeAccess.liveTopic({ token, version }), "changed", { what });
}

async function broadcast(topic: string, event: string, payload: Record<string, unknown>) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Not configured: pages still catch up on their own polling.
  if (!url || !key) return;
  try {
    const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ topic, event, payload }] }),
    });
    if (!res.ok) console.error("[broadcast]", topic, res.status, await res.text());
  } catch (err) {
    console.error("[broadcast]", topic, err);
  }
}
