import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { OFFICE_COLUMNS, ensureAccessCode, officeForLab } from "@/lib/office-access";
import { notifyReplacedOfficeAccess } from "@/lib/realtime";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// POST /api/offices/[id]/reset-link — dispatcher only
// New tracking link; the old URL stops working. The access code stays the same,
// but sessions are tied to the link, so everyone enters the code again.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "dispatcher") {
      return Response.json({ data: null, error: { code: "FORBIDDEN", message: "Only dispatchers can reset tracking links" } }, { status: 403 });
    }

    const { id } = await params;
    const oldOffice = await db("offices").where({ id, lab_id: user.labId }).first("tracking_token", "access_version");
    if (!oldOffice) {
      return Response.json({ data: null, error: { code: "NOT_FOUND", message: "Office not found" } }, { status: 404 });
    }

    const [office] = await db("offices")
      .where({ id, lab_id: user.labId })
      .update({ tracking_token: randomUUID() })
      .returning(OFFICE_COLUMNS);

    await notifyReplacedOfficeAccess(oldOffice.trackingToken, oldOffice.accessVersion);
    return Response.json({ data: officeForLab(await ensureAccessCode(office)), error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/offices/[id]/reset-link]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to reset the link" } }, { status: 500 });
  }
}
