import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { notifyLab, notifyOffices } from "@/lib/realtime";
import { cleanCaseNumbers, returnsQuery } from "@/lib/returns";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

const MAX_CASES = 99;
const MAX_NOTE = 500;
const MAX_READY_AHEAD_DAYS = 7;

// POST /api/returns/request  (dispatcher)
// Enters a pickup for an office that asked outside the app, usually by phone.
// It's the same record an office's own request creates: "requested", no driver.
// Body: { officeId, caseCount, caseNumbers?: string[], note?, readyAt?: ISO }  (no readyAt = ready now)
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "dispatcher") {
      return Response.json({ data: null, error: { code: "FORBIDDEN", message: "Only dispatchers request pickups here" } }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const caseCount = Number(body.caseCount);
    if (!Number.isInteger(caseCount) || caseCount < 1 || caseCount > MAX_CASES) {
      return Response.json({ data: null, error: { code: "BAD_REQUEST", message: `Number of cases must be between 1 and ${MAX_CASES}.` } }, { status: 400 });
    }

    const office = body.officeId
      ? await db("offices").where({ id: body.officeId, lab_id: user.labId }).first()
      : null;
    if (!office) {
      return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "Choose the office these cases are coming from." } }, { status: 400 });
    }

    let readyAt: Date | null = null;
    if (body.readyAt) {
      readyAt = new Date(body.readyAt);
      if (Number.isNaN(readyAt.getTime())) {
        return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "Choose a valid ready time." } }, { status: 400 });
      }
      if (readyAt.getTime() > Date.now() + MAX_READY_AHEAD_DAYS * 24 * 60 * 60 * 1000) {
        return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "Ready time must be within the next week." } }, { status: 400 });
      }
      if (readyAt.getTime() <= Date.now()) readyAt = null; // already passed = ready now
    }

    const caseNumbers = cleanCaseNumbers(body.caseNumbers);
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, MAX_NOTE) : null;

    const id = await db.transaction(async (trx: typeof db) => {
      const [row] = await trx("returns")
        .insert({
          lab_id: user.labId,
          office_id: office.id,
          status: "requested",
          case_count: caseCount,
          case_numbers: JSON.stringify(caseNumbers),
          note,
          requested_at: trx.fn.now(),
          ready_at: readyAt ? readyAt.toISOString() : null,
          picked_up_at: null,
        })
        .returning("id");
      await trx("return_events").insert({
        return_id: row.id,
        lab_id: user.labId,
        event: "requested",
        detail: JSON.stringify({ caseCount, caseNumbers, readyAt: readyAt ? readyAt.toISOString() : null }),
        actor_role: "dispatcher",
        actor_user_id: user.id,
      });
      return row.id as string;
    });

    // Not "requested": that alert tells dispatch an office just asked, and here dispatch already knows.
    await notifyLab(user.labId, "return_changed", { returnId: id, change: "requested_by_lab" });
    await notifyOffices([office.id], "pickups");

    const row = await returnsQuery(user.labId).where("r.id", id).first();
    return Response.json({ data: row, error: null }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/returns/request]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Couldn't create the pickup" } }, { status: 500 });
  }
}
