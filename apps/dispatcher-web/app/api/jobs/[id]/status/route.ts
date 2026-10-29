import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { notifyDriver } from "@/lib/realtime";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

const VALID_STATUSES = ["pending", "assigned", "picked_up", "in_transit", "arrived", "delivered", "rejected"];

// PATCH /api/jobs/[id]/status
// Driver advances the job status through its lifecycle; dispatchers can set
// any status on jobs in their lab. Every change is logged to job_status_events.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const { status, proofOfDelivery } = await request.json();

    if (!VALID_STATUSES.includes(status)) {
      return Response.json(
        { data: null, error: { code: "BAD_REQUEST", message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` } },
        { status: 400 }
      );
    }

    // Drivers can only update their own jobs
    const job = await db("jobs")
      .where(user.role === "driver"
        ? { id, lab_id: user.labId, driver_id: user.driverId }
        : { id, lab_id: user.labId })
      .first();

    if (!job) {
      return Response.json(
        { data: null, error: { code: "NOT_FOUND", message: "Job not found" } },
        { status: 404 }
      );
    }

    // A job can only leave pending once it has a driver (assign one via
    // PATCH /api/jobs/[id]). Drivers only ever reach jobs assigned to them.
    if (status !== "pending" && !job.driverId) {
      return Response.json(
        { data: null, error: { code: "BAD_REQUEST", message: "Assign a driver before changing the status." } },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { status };

    if (status === "delivered") {
      updates.delivered_at = new Date().toISOString();
      if (proofOfDelivery) {
        updates.proof_of_delivery = JSON.stringify(proofOfDelivery);
      }
    }

    await db.transaction(async (trx: typeof db) => {
      await trx("jobs").where({ id }).update(updates);
      if (job.status !== status) {
        await trx("job_status_events").insert({
          job_id: id,
          lab_id: user.labId,
          from_status: job.status,
          to_status: status,
          changed_by_role: user.role,
          changed_by_user_id: user.id,
        });
      }
    });

    // Dispatch changed the status of a driver's job: tell the driver. (Their own
    // changes need no alert; the app already shows them.)
    if (user.role === "dispatcher" && job.driverId && job.status !== status) {
      await notifyDriver(job.driverId, "job_status_changed", { jobId: id });
    }

    // Return the same joined shape as GET /api/jobs so the jobs list can re-render the row
    const updated = await db("jobs")
      .leftJoin("offices", "jobs.office_id", "offices.id")
      .leftJoin("drivers", "jobs.driver_id", "drivers.id")
      .where("jobs.id", id)
      .select(
        "jobs.*",
        "offices.name as office_name",
        "offices.tracking_token as office_tracking_token",
        "drivers.name as driver_name"
      )
      .first();

    return Response.json({ data: updated, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[PATCH /api/jobs/[id]/status]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to update job status" } },
      { status: 500 }
    );
  }
}
