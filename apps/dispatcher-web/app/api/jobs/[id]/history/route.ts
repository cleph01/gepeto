import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// GET /api/jobs/[id]/history
// Status change history for a job, oldest first, with the name of who made each change.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "dispatcher") {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only dispatchers can view job history" } },
        { status: 403 }
      );
    }

    const { id } = await params;

    const job = await db("jobs").where({ id, lab_id: user.labId }).first();
    if (!job) {
      return Response.json(
        { data: null, error: { code: "NOT_FOUND", message: "Job not found" } },
        { status: 404 }
      );
    }

    const events = await db("job_status_events as e")
      .leftJoin("lab_users as lu", function (this: any) {
        this.on("lu.user_id", "e.changed_by_user_id").andOn("lu.lab_id", "e.lab_id");
      })
      .leftJoin("drivers as d", function (this: any) {
        this.on("d.user_id", "e.changed_by_user_id").andOn("d.lab_id", "e.lab_id");
      })
      .where({ "e.job_id": id, "e.lab_id": user.labId })
      .orderBy("e.created_at", "asc")
      .select(
        "e.id",
        "e.from_status",
        "e.to_status",
        "e.changed_by_role",
        "e.created_at",
        db.raw("CASE WHEN e.changed_by_role = 'driver' THEN d.name ELSE lu.name END as changed_by_name")
      );

    return Response.json({ data: events, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/jobs/[id]/history]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to load job history" } },
      { status: 500 }
    );
  }
}
