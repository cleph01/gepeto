import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { notifyDriverPickups, notifyLab, notifyOffices } from "@/lib/realtime";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// POST /api/returns/[id]/cancel  (dispatcher)
// Cancels an office's pickup request that hasn't been collected yet.
// (Offices cancel their own from the tracking page, until a driver is assigned.)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "dispatcher") {
      return Response.json({ data: null, error: { code: "FORBIDDEN", message: "Only dispatchers cancel pickups here" } }, { status: 403 });
    }
    const { id } = await params;
    const ret = await db("returns").where({ id, lab_id: user.labId }).first();
    if (!ret) {
      return Response.json({ data: null, error: { code: "NOT_FOUND", message: "Pickup not found" } }, { status: 404 });
    }

    const cancelled = await db.transaction(async (trx: typeof db) => {
      const n = await trx("returns")
        .where({ id, lab_id: user.labId, status: "requested" })
        .update({ status: "cancelled", cancelled_at: trx.fn.now(), updated_at: trx.fn.now() });
      if (n > 0) {
        await trx("return_events").insert({
          return_id: id, lab_id: user.labId, event: "cancelled", actor_role: "dispatcher", actor_user_id: user.id,
        });
      }
      return n > 0;
    });
    if (!cancelled) {
      return Response.json({ data: null, error: { code: "CONFLICT", message: "Only a pickup that hasn't been collected can be cancelled." } }, { status: 409 });
    }

    await notifyLab(user.labId, "return_changed", { returnId: id, change: "cancelled" });
    await notifyOffices([ret.officeId], "pickups");
    if (ret.driverId) await notifyDriverPickups(ret.driverId, "pickup_removed", { returnId: id });
    return Response.json({ data: { ok: true }, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/returns/[id]/cancel]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to cancel the pickup" } }, { status: 500 });
  }
}
