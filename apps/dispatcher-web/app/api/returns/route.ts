import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { notifyLab } from "@/lib/realtime";
import { cleanCaseNumbers, returnsQuery } from "@/lib/returns";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

const MAX_CASES = 99;
const MAX_NOTE = 500;

// GET /api/returns
// Driver: pickups assigned to them, their returns that aren't checked in yet
// (in their car or waiting at the lab), plus anything checked in today.
// Dispatcher: ?status=open (requested + with_driver + at_lab, default) | checked_in | all,
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
        w.whereIn("r.status", ["requested", "with_driver", "at_lab"]).orWhere("r.checked_in_at", ">=", startOfToday.toISOString())
      );
    } else {
      const status = params.get("status") ?? "open";
      if (status === "open") q.whereIn("r.status", ["requested", "with_driver", "at_lab"]);
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
// If that office has an open pickup request (assigned to this driver, or not
// assigned yet), the pickup fulfills it instead of creating a second return,
// so the office's request and the driver's pickup are one record.
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

    const { id: created, fulfilledRequest } = await db.transaction(async (trx: typeof db) => {
      const request = await trx("returns")
        .where({ lab_id: user.labId, office_id: office.id, status: "requested" })
        .where((w: typeof db) => w.where("driver_id", user.driverId).orWhereNull("driver_id"))
        // Prefer one assigned to this driver, then the oldest.
        .orderByRaw("(driver_id IS NULL) ASC, requested_at ASC")
        .forUpdate()
        .first();

      if (request) {
        const merged = [...new Set([...(request.caseNumbers ?? []), ...caseNumbers])].slice(0, 50);
        const mergedNote = [request.note, note].filter(Boolean).join(" · ") || null;
        await trx("returns").where({ id: request.id }).update({
          status: "with_driver",
          driver_id: user.driverId,
          case_count: caseCount,
          case_numbers: JSON.stringify(merged),
          note: mergedNote,
          picked_up_during_job_id: pickedUpDuringJobId,
          picked_up_at: trx.fn.now(),
          updated_at: trx.fn.now(),
        });
        await trx("return_events").insert({
          return_id: request.id,
          lab_id: user.labId,
          event: "logged",
          detail: JSON.stringify({ caseCount, caseNumbers, requestedCount: request.caseCount, fulfilledRequest: true }),
          actor_role: "driver",
          actor_user_id: user.id,
        });
        return { id: request.id as string, fulfilledRequest: true };
      }

      const [row] = await trx("returns")
        .insert({
          lab_id: user.labId,
          office_id: office.id,
          driver_id: user.driverId,
          case_count: caseCount,
          case_numbers: JSON.stringify(caseNumbers),
          note,
          picked_up_during_job_id: pickedUpDuringJobId,
          picked_up_at: trx.fn.now(),
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
      return { id: row.id as string, fulfilledRequest: false };
    });

    await notifyLab(user.labId, "return_changed", { returnId: created, change: "logged", fulfilledRequest });
    const ret = await returnsQuery(user.labId).where("r.id", created).first();
    return Response.json({ data: ret, error: null }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/returns]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to log the return" } }, { status: 500 });
  }
}
