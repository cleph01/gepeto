import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { notifyDriverPickups, notifyLab } from "@/lib/realtime";
import { returnsQuery } from "@/lib/returns";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// POST /api/returns/[id]/assign  (dispatcher)
// Assigns (or, with driverId: null, unassigns) the driver for an office's
// pickup request. Only while it's still a request: once picked up, the driver
// is whoever logged it.
// Body: { driverId: string | null }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "dispatcher") {
      return Response.json({ data: null, error: { code: "FORBIDDEN", message: "Only dispatchers assign pickups" } }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const ret = await db("returns").where({ id, lab_id: user.labId }).first();
    if (!ret) {
      return Response.json({ data: null, error: { code: "NOT_FOUND", message: "Pickup not found" } }, { status: 404 });
    }
    if (ret.status !== "requested") {
      return Response.json({ data: null, error: { code: "CONFLICT", message: "This pickup has already been collected or cancelled." } }, { status: 409 });
    }

    let driverId: string | null = null;
    if (body.driverId) {
      const driver = await db("drivers").where({ id: body.driverId, lab_id: user.labId }).first();
      if (!driver) {
        return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "Choose a driver from your lab." } }, { status: 400 });
      }
      driverId = driver.id;
    }
    if (driverId === ret.driverId) {
      const row = await returnsQuery(user.labId).where("r.id", id).first();
      return Response.json({ data: row, error: null });
    }

    await db.transaction(async (trx: typeof db) => {
      const updated = await trx("returns")
        .where({ id, lab_id: user.labId, status: "requested" })
        .update({ driver_id: driverId, assigned_at: driverId ? trx.fn.now() : null, updated_at: trx.fn.now() });
      if (updated === 0) {
        throw Response.json({ data: null, error: { code: "CONFLICT", message: "This pickup has already been collected or cancelled." } }, { status: 409 });
      }
      await trx("return_events").insert({
        return_id: id,
        lab_id: user.labId,
        event: "assigned",
        detail: JSON.stringify({ driverId, previousDriverId: ret.driverId }),
        actor_role: "dispatcher",
        actor_user_id: user.id,
      });
    });

    await notifyLab(user.labId, "return_changed", { returnId: id, change: "assigned" });
    if (driverId) await notifyDriverPickups(driverId, "pickup_assigned", { returnId: id });
    if (ret.driverId) await notifyDriverPickups(ret.driverId, "pickup_removed", { returnId: id });

    const row = await returnsQuery(user.labId).where("r.id", id).first();
    return Response.json({ data: row, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/returns/[id]/assign]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to assign the pickup" } }, { status: 500 });
  }
}
