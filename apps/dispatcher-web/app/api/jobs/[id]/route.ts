import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { notifyDriver } from "@/lib/realtime";
import { geocodeAddress } from "@/lib/geocode";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// GET /api/jobs/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const job = await db("jobs")
      .leftJoin("offices", "jobs.office_id", "offices.id")
      .leftJoin("drivers", "jobs.driver_id", "drivers.id")
      .where({ "jobs.id": id, "jobs.lab_id": user.labId })
      .select(
        "jobs.*",
        "offices.name as office_name",
        "drivers.name as driver_name"
      )
      .first();

    if (!job) {
      return Response.json(
        { data: null, error: { code: "NOT_FOUND", message: "Job not found" } },
        { status: 404 }
      );
    }

    // Drivers can only see their own jobs
    if (user.role === "driver" && job.driverId !== user.driverId) {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Access denied" } },
        { status: 403 }
      );
    }

    return Response.json({ data: job, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/jobs/[id]]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to fetch job" } },
      { status: 500 }
    );
  }
}

const PRIORITIES = ["stat", "standard"];
// Once a driver has the job in hand it can be handed to someone else, but not
// left with no driver at all.
const UNASSIGNABLE = ["pending", "assigned"];

// PATCH /api/jobs/[id] — dispatcher only
// Body (any subset): { driverId?: string | null, priority?: "stat" | "standard",
//   caseId?: string, officeId?: string, scheduledAt?: string }
// Assigning a driver to a pending job moves it to assigned; unassigning an
// assigned job moves it back to pending. Either way the previous driver's
// accept/reject answer is cleared so the new driver is asked fresh.
// Changing the office also moves the delivery address to that office's.
// Every changed field is logged to job_edit_events for the History popup.
// The current driver sees these edits through their realtime row updates.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "dispatcher") {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only dispatchers can edit jobs" } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const badRequest = (message: string) =>
      Response.json({ data: null, error: { code: "BAD_REQUEST", message } }, { status: 400 });

    const job = await db("jobs").where({ id, lab_id: user.labId }).first();
    if (!job) {
      return Response.json(
        { data: null, error: { code: "NOT_FOUND", message: "Job not found" } },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};
    const edits: { field: string; old_value: string | null; new_value: string | null }[] = [];
    const delivered = job.status === "delivered";

    if ("priority" in body) {
      if (!PRIORITIES.includes(body.priority)) return badRequest("Priority must be 'stat' or 'standard'");
      if (body.priority !== job.priority) {
        updates.priority = body.priority;
        edits.push({ field: "priority", old_value: job.priority, new_value: body.priority });
      }
    }

    if ("caseId" in body) {
      const caseId = typeof body.caseId === "string" ? body.caseId.trim() : "";
      if (!caseId) return badRequest("Case number can't be empty");
      if (caseId !== job.caseId) {
        updates.case_id = caseId;
        edits.push({ field: "case_id", old_value: job.caseId, new_value: caseId });
      }
    }

    if ("scheduledAt" in body) {
      const when = new Date(body.scheduledAt);
      if (!body.scheduledAt || Number.isNaN(when.getTime())) return badRequest("Invalid expected delivery time");
      const oldIso = job.scheduledAt ? new Date(job.scheduledAt).toISOString() : null;
      if (when.toISOString() !== oldIso) {
        if (delivered) return badRequest("This job has already been delivered");
        updates.scheduled_at = when.toISOString();
        edits.push({ field: "scheduled_at", old_value: oldIso, new_value: when.toISOString() });
      }
    }

    if ("officeId" in body && body.officeId !== job.officeId) {
      if (delivered) return badRequest("This job has already been delivered");
      const [office, oldOffice] = await Promise.all([
        db("offices").where({ id: body.officeId, lab_id: user.labId }).first(),
        db("offices").where({ id: job.officeId }).select("name").first(),
      ]);
      if (!office) return badRequest("Office not found");
      const coords = await geocodeAddress(office.address);
      updates.office_id = office.id;
      updates.delivery_address = office.address;
      updates.delivery_lat = coords?.lat ?? null;
      updates.delivery_lng = coords?.lng ?? null;
      edits.push({ field: "office", old_value: oldOffice?.name ?? null, new_value: office.name });
    }

    if ("driverId" in body && body.driverId !== job.driverId) {
      const driverId: string | null = body.driverId || null;
      if (job.status === "delivered") return badRequest("This job has already been delivered");
      if (driverId) {
        const driver = await db("drivers").where({ id: driverId, lab_id: user.labId }).first();
        if (!driver) return badRequest("Driver not found");
      } else if (!UNASSIGNABLE.includes(job.status)) {
        return badRequest("This job is already on its way. Assign another driver instead of leaving it unassigned.");
      }
      updates.driver_id = driverId;
      updates.driver_response = "pending";
      if (driverId && job.status === "pending") updates.status = "assigned";
      if (!driverId && job.status === "assigned") updates.status = "pending";
      const names = await db("drivers").whereIn("id", [job.driverId, driverId].filter(Boolean)).select("id", "name");
      const nameOf = (driver: string | null) => names.find((d: { id: string; name: string }) => d.id === driver)?.name ?? null;
      edits.push({ field: "driver", old_value: nameOf(job.driverId), new_value: nameOf(driverId) });
    }

    if (Object.keys(updates).length > 0) {
      await db.transaction(async (trx: typeof db) => {
        await trx("jobs").where({ id }).update(updates);
        if (updates.status) {
          await trx("job_status_events").insert({
            job_id: id,
            lab_id: user.labId,
            from_status: job.status,
            to_status: updates.status,
            changed_by_role: user.role,
            changed_by_user_id: user.id,
          });
        }
        if (edits.length > 0) {
          await trx("job_edit_events").insert(
            edits.map((e) => ({ ...e, job_id: id, lab_id: user.labId, changed_by_user_id: user.id }))
          );
        }
      });
    }

    // The previous driver can no longer see the job, so tell their app directly.
    if ("driver_id" in updates && job.driverId) {
      await notifyDriver(job.driverId, "job_removed", { jobId: id });
    }

    // Same joined shape as GET /api/jobs so the jobs list can re-render the row
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
    console.error("[PATCH /api/jobs/[id]]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to update job" } },
      { status: 500 }
    );
  }
}
