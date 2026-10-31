import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// GET /api/returns/[id]/history  (dispatcher)
// A return's events, oldest first, with who did each one and, for "linked",
// the case number of the job it was linked to.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "dispatcher") {
      return Response.json({ data: null, error: { code: "FORBIDDEN", message: "Only dispatchers can view return history" } }, { status: 403 });
    }
    const { id } = await params;

    const ret = await db("returns").where({ id, lab_id: user.labId }).first();
    if (!ret) {
      return Response.json({ data: null, error: { code: "NOT_FOUND", message: "Return not found" } }, { status: 404 });
    }

    const events = await db("return_events as e")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .leftJoin("lab_users as lu", function (this: any) {
        this.on("lu.user_id", "e.actor_user_id").andOn("lu.lab_id", "e.lab_id");
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .leftJoin("drivers as d", function (this: any) {
        this.on("d.user_id", "e.actor_user_id").andOn("d.lab_id", "e.lab_id");
      })
      .leftJoin("jobs as j", db.raw("j.id = (e.detail->>'sourceJobId')::uuid"))
      .where({ "e.return_id": id, "e.lab_id": user.labId })
      .orderBy("e.created_at", "asc")
      .select(
        "e.id",
        "e.event",
        "e.detail",
        "e.actor_role",
        "e.created_at",
        "j.case_id as linked_case_id",
        db.raw("CASE WHEN e.actor_role = 'driver' THEN d.name ELSE lu.name END as actor_name")
      );

    return Response.json({ data: events, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/returns/[id]/history]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to load return history" } }, { status: 500 });
  }
}
