import type { NextRequest } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

const MAX_RANGE_DAYS = 366;
const MAX_ROWS = 300;

// GET /api/track/[token]/delivered?from=<ISO>&to=<ISO>
// Public (token is the secret). This office's delivered cases with
// delivered_at in [from, to), newest first. The page's Delivered tab calls it
// with the office's local day boundaries. hasPhoto rows have a drop-off photo
// at /api/track/[token]/photo/[jobId].
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const office = await db("offices").where("tracking_token", token).select("id").first();
    if (!office) {
      return Response.json({ data: null, error: { code: "NOT_FOUND", message: "Tracking link not found" } }, { status: 404 });
    }

    const sp = request.nextUrl.searchParams;
    const from = new Date(sp.get("from") ?? "");
    const to = new Date(sp.get("to") ?? "");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "Choose a valid date range." } }, { status: 400 });
    }
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
      return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "Choose a range of a year or less." } }, { status: 400 });
    }

    const rows = await db("jobs")
      .leftJoin("drivers", "jobs.driver_id", "drivers.id")
      .where("jobs.office_id", office.id)
      .where("jobs.status", "delivered")
      .where("jobs.delivered_at", ">=", from.toISOString())
      .where("jobs.delivered_at", "<", to.toISOString())
      .orderBy("jobs.delivered_at", "desc")
      .limit(MAX_ROWS + 1)
      .select(
        "jobs.id",
        "jobs.case_id as caseId",
        "jobs.priority",
        "jobs.items",
        "jobs.delivered_at as deliveredAt",
        "drivers.name as driverName",
        db.raw("jobs.proof_of_delivery->>'recipientName' as received_by"),
        db.raw("(jobs.pod_photo_path is not null) as has_photo"),
        "jobs.pod_photo_deleted_at as photoDeletedAt"
      );

    return Response.json({
      data: { deliveries: rows.slice(0, MAX_ROWS), truncated: rows.length > MAX_ROWS },
      error: null,
    });
  } catch (err) {
    console.error("[GET /api/track/[token]/delivered]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to load deliveries" } }, { status: 500 });
  }
}
