import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// GET /api/jobs/[id]/history
// A job's history, oldest first, with the name of who made each change:
// status changes (job_status_events, kind "status") merged with dispatcher
// edits to its details (job_edit_events, kind "edit").
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

    const edits = await db("job_edit_events as e")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .leftJoin("lab_users as lu", function (this: any) {
        this.on("lu.user_id", "e.changed_by_user_id").andOn("lu.lab_id", "e.lab_id");
      })
      .where({ "e.job_id": id, "e.lab_id": user.labId })
      .select("e.id", "e.field", "e.old_value", "e.new_value", "e.created_at", "lu.name as changed_by_name");

    const history = [
      ...events.map((e: Record<string, unknown>) => ({ ...e, kind: "status" })),
      ...edits.map((e: Record<string, unknown>) => ({ ...e, kind: "edit", changedByRole: "dispatcher" })),
    ].sort((a, b) => new Date(a.createdAt as string).getTime() - new Date(b.createdAt as string).getTime());

    return Response.json({ data: history, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/jobs/[id]/history]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to load job history" } },
      { status: 500 }
    );
  }
}
