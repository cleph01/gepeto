import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { notifyLab } from "@/lib/realtime";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// POST /api/returns/drop  (driver)
// "Dropped at lab": moves the driver's returns still with them to at_lab.
// Body: { ids?: string[] }; omitted = every return the driver is carrying.
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "driver") {
      return Response.json({ data: null, error: { code: "FORBIDDEN", message: "Only drivers drop off returns" } }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const ids: string[] | null = Array.isArray(body.ids) ? body.ids.filter((v: unknown) => typeof v === "string") : null;

    const dropped = await db.transaction(async (trx: typeof db) => {
      const q = trx("returns").where({ lab_id: user.labId, driver_id: user.driverId, status: "with_driver" });
      if (ids) q.whereIn("id", ids);
      const rows = await q.update({ status: "at_lab", dropped_at: trx.fn.now() }).returning("id");
      if (rows.length > 0) {
        await trx("return_events").insert(
          rows.map((r: { id: string }) => ({
            return_id: r.id,
            lab_id: user.labId,
            event: "dropped_at_lab",
            actor_role: "driver",
            actor_user_id: user.id,
          }))
        );
      }
      return rows.map((r: { id: string }) => r.id);
    });

    if (dropped.length > 0) await notifyLab(user.labId, "return_changed", { change: "dropped", count: dropped.length });
    return Response.json({ data: { dropped: dropped.length }, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/returns/drop]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to drop off returns" } }, { status: 500 });
  }
}
