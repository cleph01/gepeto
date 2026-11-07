import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { deletionDate, ENDED_STATUSES } from "@/lib/lab-deletion";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// GET /api/lab-status  (anyone in the lab)
// Whether the lab is read-only because its subscription has ended, for the
// notice on the dispatcher site and in the driver app.
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const lab = await db("labs").where({ id: user.labId }).select("subscription_status", "subscription_ended_at").first();
    const readOnly = !!lab?.subscriptionStatus && ENDED_STATUSES.includes(lab.subscriptionStatus);
    return Response.json({
      data: {
        readOnly,
        dataDeletedOn: readOnly && lab.subscriptionEndedAt ? deletionDate(lab.subscriptionEndedAt).toISOString() : null,
        isOwner: user.labRole === "owner",
      },
      error: null,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/lab-status]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to load lab status" } }, { status: 500 });
  }
}
