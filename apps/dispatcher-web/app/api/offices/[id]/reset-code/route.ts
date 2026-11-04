import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { OFFICE_COLUMNS, officeAccess, officeForLab } from "@/lib/office-access";
import { notifyReplacedOfficeAccess } from "@/lib/realtime";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// POST /api/offices/[id]/reset-code — dispatcher only
// New access code. Bumping access_version signs out every device using the old
// one; the signal below locks any tracking page that's open right now.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "dispatcher") {
      return Response.json({ data: null, error: { code: "FORBIDDEN", message: "Only dispatchers can reset access codes" } }, { status: 403 });
    }

    const { id } = await params;
    const old = await db("offices").where({ id, lab_id: user.labId }).first("tracking_token", "access_version");
    const [office] = await db("offices")
      .where({ id, lab_id: user.labId })
      .update({
        access_code_enc: officeAccess.encryptCode(officeAccess.generateCode()),
        access_version: db.raw("access_version + 1"),
      })
      .returning(OFFICE_COLUMNS);
    if (!office) {
      return Response.json({ data: null, error: { code: "NOT_FOUND", message: "Office not found" } }, { status: 404 });
    }

    await notifyReplacedOfficeAccess(old.trackingToken, old.accessVersion);
    return Response.json({ data: officeForLab(office), error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/offices/[id]/reset-code]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to reset the code" } }, { status: 500 });
  }
}
