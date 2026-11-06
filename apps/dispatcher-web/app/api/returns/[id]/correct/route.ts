import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { notifyDriverPickups, notifyLab, notifyOffices } from "@/lib/realtime";
import { returnsQuery } from "@/lib/returns";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

const conflict = (message: string) =>
  Response.json({ data: null, error: { code: "CONFLICT", message } }, { status: 409 });

// POST /api/returns/[id]/correct  (dispatcher)
// Fixes a mistake on a return after pickup. Each fix is logged in its history.
// Body, one of:
//   { driverId }            the cases are with a different driver (until check-in).
//                           Records who has them, so there's nothing to accept.
//   { undo: "drop_off" }    at_lab back to with_driver
//   { undo: "check_in" }    checked_in back to at_lab, clearing what check-in recorded
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "dispatcher") {
      return Response.json({ data: null, error: { code: "FORBIDDEN", message: "Only dispatchers correct returns" } }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const ret = await db("returns").where({ id, lab_id: user.labId }).first();
    if (!ret) {
      return Response.json({ data: null, error: { code: "NOT_FOUND", message: "Return not found" } }, { status: 404 });
    }

    const scope = { id, lab_id: user.labId };
    const logCorrection = (trx: typeof db, detail: Record<string, unknown>) =>
      trx("return_events").insert({
        return_id: id,
        lab_id: user.labId,
        event: "edited",
        detail: JSON.stringify(detail),
        actor_role: "dispatcher",
        actor_user_id: user.id,
      });
    // A status guard inside the transaction, so a driver or teammate acting at
    // the same moment can't be overwritten.
    const applied = async (updated: number, message: string) => {
      if (updated === 0) throw conflict(message);
    };

    let change: string;
    const refreshDrivers = new Set<string>();

    if (body.undo === "drop_off") {
      if (ret.status !== "at_lab") return conflict("Only a return waiting for check-in can go back to the driver.");
      if (!ret.driverId) return conflict("This return has no driver. Choose one first.");
      await db.transaction(async (trx: typeof db) => {
        await applied(
          await trx("returns").where({ ...scope, status: "at_lab" }).update({ status: "with_driver", dropped_at: null, updated_at: trx.fn.now() }),
          "Only a return waiting for check-in can go back to the driver."
        );
        await logCorrection(trx, { correction: "undo_drop_off" });
      });
      change = "drop_off_undone";
      refreshDrivers.add(ret.driverId);
    } else if (body.undo === "check_in") {
      if (ret.status !== "checked_in") return conflict("This return isn't checked in.");
      if (ret.redeliveryJobId) return conflict("This case already has a redelivery job, so its check-in can't be undone.");
      await db.transaction(async (trx: typeof db) => {
        await applied(
          await trx("returns").where({ ...scope, status: "checked_in" }).whereNull("redelivery_job_id").update({
            status: "at_lab",
            received_count: null,
            case_id: null,
            source_job_id: null,
            checked_in_at: null,
            checked_in_by_user_id: null,
            updated_at: trx.fn.now(),
          }),
          "This return isn't checked in."
        );
        await logCorrection(trx, { correction: "undo_check_in", caseId: ret.caseId, receivedCount: ret.receivedCount });
      });
      change = "check_in_undone";
      if (ret.driverId) refreshDrivers.add(ret.driverId);
    } else if (body.driverId) {
      if (ret.status !== "with_driver" && ret.status !== "at_lab") {
        return conflict("The driver can only be corrected after pickup and before check-in.");
      }
      const driver = await db("drivers").where({ id: body.driverId, lab_id: user.labId }).first();
      if (!driver) {
        return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "Choose a driver from your lab." } }, { status: 400 });
      }
      if (driver.id !== ret.driverId) {
        const previous = ret.driverId ? await db("drivers").where({ id: ret.driverId }).first() : null;
        await db.transaction(async (trx: typeof db) => {
          await applied(
            await trx("returns").where(scope).whereIn("status", ["with_driver", "at_lab"]).update({
              driver_id: driver.id, driver_response: "accepted", assigned_at: trx.fn.now(), updated_at: trx.fn.now(),
            }),
            "The driver can only be corrected after pickup and before check-in."
          );
          await logCorrection(trx, { correction: "driver", driverId: driver.id, previousDriverName: previous?.name ?? null });
        });
        refreshDrivers.add(driver.id);
        if (ret.driverId) refreshDrivers.add(ret.driverId);
      }
      change = "driver_corrected";
    } else {
      return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "Choose a driver or something to undo." } }, { status: 400 });
    }

    await notifyLab(user.labId, "return_changed", { returnId: id, change });
    await notifyOffices([ret.officeId], "pickups");
    // The app only reloads its list on these; it alerts only for a new request.
    for (const driverId of refreshDrivers) await notifyDriverPickups(driverId, "pickup_removed", { returnId: id });

    const row = await returnsQuery(user.labId).where("r.id", id).first();
    return Response.json({ data: row, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/returns/[id]/correct]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Couldn't correct the return" } }, { status: 500 });
  }
}
