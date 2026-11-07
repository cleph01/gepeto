import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { inRange, labHasReports, parseRange, planRequired } from "@/lib/reports";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

type Row = { deliveries: string; scheduled: string; onTime: string };

const DELIVERY_COUNTS = [
  db.raw("count(*) as deliveries"),
  db.raw("count(*) filter (where j.scheduled_at is not null) as scheduled"),
  db.raw("count(*) filter (where j.delivered_at <= j.scheduled_at) as on_time"),
];

const counts = (r: Row) => ({ deliveries: Number(r.deliveries), scheduled: Number(r.scheduled), onTime: Number(r.onTime) });

// GET /api/reports?from=&to=  (dispatcher, Growth and Pro)
// Deliveries finished and returns checked in during the period, overall, by
// driver and by office. "On time" only counts jobs that had a due time.
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "dispatcher") {
      return Response.json({ data: null, error: { code: "FORBIDDEN", message: "Dispatchers only" } }, { status: 403 });
    }
    if (!(await labHasReports(user.labId))) return planRequired();
    const range = parseRange(request.nextUrl.searchParams);
    if (range instanceof Response) return range;

    const delivered = () =>
      inRange(db("jobs as j").where({ "j.lab_id": user.labId, "j.status": "delivered" }), "j.delivered_at", range);
    const checkedIn = () =>
      inRange(db("returns as r").where({ "r.lab_id": user.labId, "r.status": "checked_in" }), "r.checked_in_at", range);

    const [total, stat, byDriver, byOffice, returns, returnsByOffice] = await Promise.all([
      delivered().select(DELIVERY_COUNTS).first(),
      delivered().where("j.priority", "stat").count("* as n").first(),
      delivered().leftJoin("drivers as d", "j.driver_id", "d.id").groupBy("d.id", "d.name").select("d.name", ...DELIVERY_COUNTS).orderBy("deliveries", "desc"),
      delivered().leftJoin("offices as o", "j.office_id", "o.id").groupBy("o.id", "o.name").select("o.id", "o.name", ...DELIVERY_COUNTS).orderBy("deliveries", "desc"),
      checkedIn().select(
        db.raw("count(*) as returns"),
        db.raw("coalesce(sum(r.received_count), 0) as cases"),
        db.raw("count(*) filter (where r.received_count <> r.case_count) as mismatched")
      ).first(),
      checkedIn().groupBy("r.office_id").select("r.office_id", db.raw("coalesce(sum(r.received_count), 0) as cases")),
    ]);

    const casesBack = new Map((returnsByOffice as { officeId: string; cases: string }[]).map((r) => [r.officeId, Number(r.cases)]));
    const officeRows = (byOffice as (Row & { id: string | null; name: string | null })[]).map((o) => ({
      name: o.name ?? "Removed office",
      ...counts(o),
      casesReturned: (o.id && casesBack.get(o.id)) || 0,
    }));
    // Offices that only sent cases back this period still belong in the list.
    const missing = [...casesBack.keys()].filter((id) => !(byOffice as { id: string | null }[]).some((o) => o.id === id));
    if (missing.length > 0) {
      const names: { id: string; name: string }[] = await db("offices").whereIn("id", missing).where({ lab_id: user.labId }).select("id", "name");
      for (const o of names) officeRows.push({ name: o.name, deliveries: 0, scheduled: 0, onTime: 0, casesReturned: casesBack.get(o.id) ?? 0 });
    }

    return Response.json({
      data: {
        ...counts(total),
        stat: Number(stat?.n ?? 0),
        returnsCheckedIn: Number(returns?.returns ?? 0),
        casesReturned: Number(returns?.cases ?? 0),
        returnsMismatched: Number(returns?.mismatched ?? 0),
        byDriver: (byDriver as (Row & { name: string | null })[]).map((d) => ({ name: d.name ?? "No driver recorded", ...counts(d) })),
        byOffice: officeRows,
      },
      error: null,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/reports]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to load reports" } }, { status: 500 });
  }
}
