import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// GET /api/jobs/driver-activity
// Dispatcher only: what drivers did in the last 24 hours that's worth a toast,
// newest first. Polled by the notifications provider, which toasts each `key`
// it hasn't seen before.
//   rejected   driver turned a job down (logged as driver → pending)
//   delivered  driver marked a job delivered
//   accepted   driver accepted a job. Not logged as a status change (the
//              status stays assigned), so it comes from jobs.driver_response.
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "dispatcher") {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only dispatchers can view driver activity" } },
        { status: 403 }
      );
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const events = await db("job_status_events as e")
      .join("jobs as j", "j.id", "e.job_id")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .leftJoin("drivers as d", function (this: any) {
        this.on("d.user_id", "e.changed_by_user_id").andOn("d.lab_id", "e.lab_id");
      })
      .where({ "e.lab_id": user.labId, "e.changed_by_role": "driver" })
      .whereIn("e.to_status", ["pending", "delivered"])
      .where("e.created_at", ">=", since)
      .orderBy("e.created_at", "desc")
      .limit(20)
      .select("e.id", "e.job_id", "e.to_status", "e.created_at as at", "j.case_id", "d.name as driver_name");

    const accepted = await db("jobs as j")
      .join("drivers as d", "d.id", "j.driver_id")
      .where({ "j.lab_id": user.labId, "j.driver_response": "accepted" })
      .where("j.updated_at", ">=", since)
      .orderBy("j.updated_at", "desc")
      .limit(20)
      .select("j.id as job_id", "j.driver_id", "j.updated_at as at", "j.case_id", "d.name as driver_name");

    const activity = [
      ...events.map((e: { id: string; jobId: string; toStatus: string; at: string; caseId: string; driverName: string | null }) => ({
        key: e.id,
        kind: e.toStatus === "pending" ? "rejected" : "delivered",
        jobId: e.jobId,
        caseId: e.caseId,
        driverName: e.driverName,
        at: e.at,
      })),
      // One per job per driver: a job reassigned and accepted again toasts again.
      ...accepted.map((a: { jobId: string; driverId: string; at: string; caseId: string; driverName: string }) => ({
        key: `accepted:${a.jobId}:${a.driverId}`,
        kind: "accepted",
        jobId: a.jobId,
        caseId: a.caseId,
        driverName: a.driverName,
        at: a.at,
      })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return Response.json({ data: activity, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/jobs/driver-activity]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to load driver activity" } },
      { status: 500 }
    );
  }
}
