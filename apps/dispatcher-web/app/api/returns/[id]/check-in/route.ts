import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { notifyLab } from "@/lib/realtime";
import { returnsQuery } from "@/lib/returns";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

const MAX_CASES = 99;

// POST /api/returns/[id]/check-in  (dispatcher)
// Closes out a return at the front desk: confirms how many cases actually
// arrived, records the lab's case number for it and, optionally, links the
// outbound job it came back from.
// Body: { receivedCount, caseId, sourceJobId? }
// Works from at_lab, and from with_driver too, for when the driver handed the
// cases over without tapping "Dropped off".
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "dispatcher") {
      return Response.json({ data: null, error: { code: "FORBIDDEN", message: "Only dispatchers check in returns" } }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const receivedCount = Number(body.receivedCount);
    if (!Number.isInteger(receivedCount) || receivedCount < 0 || receivedCount > MAX_CASES) {
      return Response.json({ data: null, error: { code: "BAD_REQUEST", message: `Received count must be between 0 and ${MAX_CASES}.` } }, { status: 400 });
    }
    const caseId = typeof body.caseId === "string" ? body.caseId.trim().slice(0, 64) : "";
    if (!caseId) {
      return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "Enter the lab case number for this return." } }, { status: 400 });
    }

    const ret = await db("returns").where({ id, lab_id: user.labId }).first();
    if (!ret) {
      return Response.json({ data: null, error: { code: "NOT_FOUND", message: "Return not found" } }, { status: 404 });
    }
    if (ret.status === "checked_in") {
      return Response.json({ data: null, error: { code: "CONFLICT", message: "This return is already checked in." } }, { status: 409 });
    }

    // Only link a job from this lab that went to the same office.
    let sourceJobId: string | null = null;
    if (body.sourceJobId) {
      const job = await db("jobs").where({ id: body.sourceJobId, lab_id: user.labId, office_id: ret.officeId }).first();
      if (!job) {
        return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "That job isn't from this office." } }, { status: 400 });
      }
      sourceJobId = job.id;
    }

    await db.transaction(async (trx: typeof db) => {
      // Re-check inside the transaction so two people checking in at once
      // can't both succeed.
      const updated = await trx("returns")
        .where({ id, lab_id: user.labId })
        .whereIn("status", ["with_driver", "at_lab"])
        .update({
          status: "checked_in",
          received_count: receivedCount,
          case_id: caseId,
          source_job_id: sourceJobId,
          dropped_at: ret.droppedAt ?? trx.fn.now(),
          checked_in_at: trx.fn.now(),
          checked_in_by_user_id: user.id,
          updated_at: trx.fn.now(),
        });
      if (updated === 0) {
        throw Response.json({ data: null, error: { code: "CONFLICT", message: "This return is already checked in." } }, { status: 409 });
      }

      const events = [{
        return_id: id,
        lab_id: user.labId,
        event: "checked_in",
        detail: JSON.stringify({ caseCount: ret.caseCount, receivedCount, caseId, fromStatus: ret.status }),
        actor_role: "dispatcher",
        actor_user_id: user.id,
      }];
      if (sourceJobId) {
        events.push({
          return_id: id,
          lab_id: user.labId,
          event: "linked",
          detail: JSON.stringify({ sourceJobId }),
          actor_role: "dispatcher",
          actor_user_id: user.id,
        });
      }
      await trx("return_events").insert(events);
    });

    await notifyLab(user.labId, "return_changed", { returnId: id, change: "checked_in" });
    const row = await returnsQuery(user.labId).where("r.id", id).first();
    return Response.json({ data: row, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/returns/[id]/check-in]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to check in the return" } }, { status: 500 });
  }
}
