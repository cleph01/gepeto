import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// GET /api/driver/history/[jobId]
// Read-only summary of a job the signed-in driver rejected. After a rejection
// the job is unassigned (and may be reassigned), so RLS no longer lets the
// driver read it directly. This returns only what the driver saw when they
// rejected it, not its current status, driver or messages.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "driver") {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only drivers have a delivery history" } },
        { status: 403 }
      );
    }

    const { jobId } = await params;

    const rejection = await db("job_status_events")
      .where({
        job_id: jobId,
        lab_id: user.labId,
        changed_by_user_id: user.id,
        changed_by_role: "driver",
        to_status: "pending",
      })
      .orderBy("created_at", "desc")
      .first("created_at");

    if (!rejection) {
      return Response.json(
        { data: null, error: { code: "NOT_FOUND", message: "Job not found" } },
        { status: 404 }
      );
    }

    const job = await db("jobs as j")
      .leftJoin("offices as o", "o.id", "j.office_id")
      .where({ "j.id": jobId, "j.lab_id": user.labId })
      .first(
        "j.id", "j.case_id", "j.priority", "j.items", "j.pickup_address", "j.delivery_address",
        "j.scheduled_at", "o.name as office_name"
      );

    if (!job) {
      return Response.json(
        { data: null, error: { code: "NOT_FOUND", message: "Job not found" } },
        { status: 404 }
      );
    }

    return Response.json({
      data: {
        ...job,
        items: typeof job.items === "string" ? JSON.parse(job.items) : job.items ?? [],
        rejectedAt: rejection.createdAt,
      },
      error: null,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/driver/history/[jobId]]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to load job" } },
      { status: 500 }
    );
  }
}
