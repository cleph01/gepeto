import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// PATCH /api/jobs/[id]/response
// Driver accepts or rejects an assigned job.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "driver") {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only drivers can respond to jobs" } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { driverResponse } = await request.json();

    if (driverResponse !== "accepted" && driverResponse !== "rejected") {
      return Response.json(
        { data: null, error: { code: "BAD_REQUEST", message: "driverResponse must be 'accepted' or 'rejected'" } },
        { status: 400 }
      );
    }

    const job = await db("jobs")
      .where({ id, lab_id: user.labId, driver_id: user.driverId })
      .first();

    if (!job) {
      return Response.json(
        { data: null, error: { code: "NOT_FOUND", message: "Job not found" } },
        { status: 404 }
      );
    }

    const updates: Record<string, string> = { driver_response: driverResponse };

    // When driver rejects, revert job to pending/unassigned
    if (driverResponse === "rejected") {
      updates.status = "pending";
      updates.driver_id = null as unknown as string;
    }

    const [updated] = await db("jobs").where({ id }).update(updates).returning("*");

    return Response.json({ data: updated, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[PATCH /api/jobs/[id]/response]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to update driver response" } },
      { status: 500 }
    );
  }
}
