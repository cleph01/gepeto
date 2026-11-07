import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// GET /api/driver/history/returns/[returnId]
// Read-only summary of a return the signed-in driver brought back and the lab
// has checked in. Not found once a check-in is undone.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ returnId: string }> }
) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "driver") {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only drivers have a delivery history" } },
        { status: 403 }
      );
    }

    const { returnId } = await params;

    const row = await db("returns as r")
      .leftJoin("offices as o", "o.id", "r.office_id")
      .where({ "r.id": returnId, "r.lab_id": user.labId, "r.driver_id": user.driverId, "r.status": "checked_in" })
      .select(
        "r.id", "r.number", "r.case_count", "r.received_count", "r.case_id", "r.case_numbers", "r.note",
        "r.picked_up_at", "r.dropped_at", "r.checked_in_at",
        "o.name as office_name", "o.address as office_address"
      )
      .first();

    if (!row) {
      return Response.json(
        { data: null, error: { code: "NOT_FOUND", message: "This return isn't checked in anymore." } },
        { status: 404 }
      );
    }

    return Response.json({ data: row, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/driver/history/returns/[returnId]]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to load this return" } },
      { status: 500 }
    );
  }
}
