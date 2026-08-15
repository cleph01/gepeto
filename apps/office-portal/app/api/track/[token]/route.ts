import type { NextRequest } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// GET /api/track/[token]
// Public endpoint — token acts as the auth secret.
// Returns the office and all its active jobs.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const office = await db("offices")
      .leftJoin("labs", "offices.lab_id", "labs.id")
      .where("offices.tracking_token", token)
      .select(
        "offices.id",
        "offices.name",
        "offices.address",
        "offices.phone",
        "offices.contact_name as contactName",
        "labs.name as labName"
      )
      .first();

    if (!office) {
      return Response.json(
        { data: null, error: { code: "NOT_FOUND", message: "Tracking link not found" } },
        { status: 404 }
      );
    }

    const jobs = await db("jobs")
      .leftJoin("drivers", "jobs.driver_id", "drivers.id")
      .where("jobs.office_id", office.id)
      .whereNotIn("jobs.status", ["delivered", "rejected"])
      .orderBy("jobs.created_at", "desc")
      .select(
        "jobs.id",
        "jobs.case_id as caseId",
        "jobs.status",
        "jobs.priority",
        "jobs.delivery_address as deliveryAddress",
        "jobs.delivery_lat as deliveryLat",
        "jobs.delivery_lng as deliveryLng",
        "jobs.created_at as createdAt",
        "jobs.updated_at as updatedAt",
        "drivers.name as driverName",
        "drivers.current_location as driverLocation"
      );

    // Also fetch the most recently delivered job (for context)
    const recentDelivered = await db("jobs")
      .where("jobs.office_id", office.id)
      .where("jobs.status", "delivered")
      .orderBy("jobs.updated_at", "desc")
      .limit(3)
      .select(
        "jobs.id",
        "jobs.case_id as caseId",
        "jobs.status",
        "jobs.priority",
        "jobs.delivery_address as deliveryAddress",
        "jobs.updated_at as updatedAt"
      );

    return Response.json({
      data: { office, jobs, recentDelivered },
      error: null,
    });
  } catch (err) {
    console.error("[GET /api/track/[token]]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to load tracking data" } },
      { status: 500 }
    );
  }
}
