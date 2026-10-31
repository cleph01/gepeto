import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { notifyLab } from "@/lib/realtime";
import { cleanCaseNumbers, returnsQuery } from "@/lib/returns";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

const MAX_CASES = 99;
const MAX_NOTE = 500;

// GET /api/returns
// Driver: their returns that aren't checked in yet (what's in their car or
// waiting at the lab), plus anything checked in today.
// Dispatcher: ?status=open (with_driver + at_lab, default) | checked_in | all,
// optional ?from=&to= (ISO dates, on picked_up_at), ?officeId=, ?driverId=.
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const q = returnsQuery(user.labId);
    const params = request.nextUrl.searchParams;

    if (user.role === "driver") {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      q.where("r.driver_id", user.driverId).where((w: typeof db) =>
        w.whereIn("r.status", ["with_driver", "at_lab"]).orWhere("r.checked_in_at", ">=", startOfToday.toISOString())
      );
    } else {
      const status = params.get("status") ?? "open";
      if (status === "open") q.whereIn("r.status", ["with_driver", "at_lab"]);
      else if (status === "checked_in") q.where("r.status", "checked_in");
      const from = params.get("from");
      const to = params.get("to");
      if (from && !Number.isNaN(Date.parse(from))) q.where("r.picked_up_at", ">=", new Date(from).toISOString());
      if (to && !Number.isNaN(Date.parse(to))) q.where("r.picked_up_at", "<", new Date(to).toISOString());
      if (params.get("officeId")) q.where("r.office_id", params.get("officeId"));
      if (params.get("driverId")) q.where("r.driver_id", params.get("driverId"));
      q.limit(500);
    }

    return Response.json({ data: await q, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/returns]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to load returns" } }, { status: 500 });
  }
}

// POST /api/returns  (driver)
// Logs cases picked up at an office to bring back to the lab.
// Body: { officeId, caseCount, caseNumbers?: string[], note?, pickedUpDuringJobId? }
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "driver") {
      return Response.json({ data: null, error: { code: "FORBIDDEN", message: "Only drivers log returns" } }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const caseCount = Number(body.caseCount);
    if (!Number.isInteger(caseCount) || caseCount < 1 || caseCount > MAX_CASES) {
      return Response.json({ data: null, error: { code: "BAD_REQUEST", message: `Case count must be between 1 and ${MAX_CASES}.` } }, { status: 400 });
    }

    const office = body.officeId
      ? await db("offices").where({ id: body.officeId, lab_id: user.labId }).first()
      : null;
    if (!office) {
      return Response.json({ data: null, error: { code: "BAD_REQUEST", message: "Choose the office these cases came from." } }, { status: 400 });
    }

    // Only link a delivery that's the driver's own job at that office.
    let pickedUpDuringJobId: string | null = null;
    if (body.pickedUpDuringJobId) {
      const job = await db("jobs")
        .where({ id: body.pickedUpDuringJobId, lab_id: user.labId, driver_id: user.driverId, office_id: office.id })
        .first();
      pickedUpDuringJobId = job?.id ?? null;
    }

    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, MAX_NOTE) : null;
    const caseNumbers = cleanCaseNumbers(body.caseNumbers);

    const created = await db.transaction(async (trx: typeof db) => {
      const [row] = await trx("returns")
        .insert({
          lab_id: user.labId,
          office_id: office.id,
          driver_id: user.driverId,
          case_count: caseCount,
          case_numbers: JSON.stringify(caseNumbers),
          note,
          picked_up_during_job_id: pickedUpDuringJobId,
        })
        .returning("id");
      await trx("return_events").insert({
        return_id: row.id,
        lab_id: user.labId,
        event: "logged",
        detail: JSON.stringify({ caseCount, caseNumbers }),
        actor_role: "driver",
        actor_user_id: user.id,
      });
      return row.id as string;
    });

    await notifyLab(user.labId, "return_changed", { returnId: created, change: "logged" });
    const ret = await returnsQuery(user.labId).where("r.id", created).first();
    return Response.json({ data: ret, error: null }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/returns]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to log the return" } }, { status: 500 });
  }
}
