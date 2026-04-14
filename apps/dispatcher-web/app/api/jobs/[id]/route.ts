import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
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
