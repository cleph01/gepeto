// Tells the lab's dispatch dashboard a message just arrived, over Supabase
// Realtime broadcast (same as dispatcher-web's lib/realtime.ts). The dashboard
// listens on `lab:<labId>`; the payload carries only the job id.
export async function notifyLab(labId: string, event: string, payload: Record<string, unknown>) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Not configured: the dashboard still picks the message up on its 10s check.
  if (!url || !key) return;
  try {
    const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ topic: `lab:${labId}`, event, payload }] }),
    });
    if (!res.ok) console.error("[notifyLab]", res.status, await res.text());
  } catch (err) {
    console.error("[notifyLab]", err);
  }
}
