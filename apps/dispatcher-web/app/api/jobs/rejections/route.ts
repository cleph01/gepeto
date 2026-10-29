import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// A driver rejecting a job is logged as a driver-made change back to pending
// (see PATCH /api/jobs/[id]/response).
const REJECTION = { "e.changed_by_role": "driver", "e.to_status": "pending" };

// GET /api/jobs/rejections
// Dispatcher only: driver rejections from the last 24 hours, newest first.
// Polled by the notifications provider to raise a toast for each new one.
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "dispatcher") {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only dispatchers can view rejections" } },
        { status: 403 }
      );
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const rejections = await db("job_status_events as e")
      .join("jobs as j", "j.id", "e.job_id")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .leftJoin("drivers as d", function (this: any) {
        this.on("d.user_id", "e.changed_by_user_id").andOn("d.lab_id", "e.lab_id");
      })
      .where({ ...REJECTION, "e.lab_id": user.labId })
      .where("e.created_at", ">=", since)
      .orderBy("e.created_at", "desc")
      .limit(20)
      .select("e.id", "e.job_id", "e.created_at", "j.case_id", "d.name as driver_name");

    return Response.json({ data: rejections, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/jobs/rejections]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to load rejections" } },
      { status: 500 }
    );
  }
}
