import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

const VALID_STATUSES = ["pending", "assigned", "picked_up", "in_transit", "arrived", "delivered", "rejected"];

// PATCH /api/jobs/[id]/status
// Driver advances the job status through its lifecycle.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "driver") {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only drivers can update job status" } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { status } = await request.json();

    if (!VALID_STATUSES.includes(status)) {
      return Response.json(
        { data: null, error: { code: "BAD_REQUEST", message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` } },
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

    const updates: Record<string, unknown> = { status };

    if (status === "delivered") {
      updates.delivered_at = new Date().toISOString();
    }

    const [updated] = await db("jobs").where({ id }).update(updates).returning("*");

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
