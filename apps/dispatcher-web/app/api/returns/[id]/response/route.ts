import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { notifyLab, notifyOffices } from "@/lib/realtime";
import { returnsQuery } from "@/lib/returns";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// POST /api/returns/[id]/response  (driver)
// The assigned driver accepts a pickup, or rejects it and it goes back to dispatch.
// Body: { driverResponse: "accepted" | "rejected" }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "driver") {
      return Response.json({ data: null, error: { code: "FORBIDDEN", message: "Only drivers respond to pickups" } }, { status: 403 });
    }
    const { id } = await params;
    const { driverResponse } = await request.json().catch(() => ({}));
    if (driverResponse !== "accepted" && driverResponse !== "rejected") {
      return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "driverResponse must be 'accepted' or 'rejected'" } }, { status: 400 });
    }

    const scope = { id, lab_id: user.labId, driver_id: user.driverId, status: "requested", driver_response: "pending" };
    const ret = await db("returns").where(scope).first();
    if (!ret) {
      return Response.json({ data: null, error: { code: "CONFLICT", message: "This pickup is no longer waiting for your answer." } }, { status: 409 });
    }

    const rejected = driverResponse === "rejected";
    await db.transaction(async (trx: typeof db) => {
      const updated = await trx("returns").where(scope).update(
        rejected
          ? { driver_id: null, assigned_at: null, updated_at: trx.fn.now() }
          : { driver_response: "accepted", updated_at: trx.fn.now() }
      );
      if (updated === 0) {
        throw Response.json({ data: null, error: { code: "CONFLICT", message: "This pickup is no longer waiting for your answer." } }, { status: 409 });
      }
      await trx("return_events").insert({
        return_id: id,
        lab_id: user.labId,
        event: rejected ? "driver_rejected" : "driver_accepted",
        detail: JSON.stringify({ driverId: user.driverId }),
        actor_role: "driver",
        actor_user_id: user.id,
      });
    });

    await notifyLab(user.labId, "return_changed", { returnId: id, change: rejected ? "rejected" : "accepted" });
    await notifyOffices([ret.officeId], "pickups");

    const row = await returnsQuery(user.labId).where("r.id", id).first();
    return Response.json({ data: row, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/returns/[id]/response]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to answer the pickup" } }, { status: 500 });
  }
}
