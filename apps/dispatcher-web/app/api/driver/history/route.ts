import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

const WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// A driver's rejection is logged by PATCH /api/jobs/[id]/response as a
// driver-made change back to "pending" (the job is unassigned at the same time).
const REJECTION = { "e.changed_by_role": "driver", "e.to_status": "pending" };

type HistoryRow = { jobId: string; eventId?: string; items: unknown; at: string } & Record<string, unknown>;

// GET /api/driver/history?before=<ISO>
// The signed-in driver's delivered and rejected jobs for the 30 days before
// `before` (default: now), newest first. `nextBefore` is just after the newest
// older entry, so "Load more" skips empty months; null when nothing is older.
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "driver") {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only drivers have a delivery history" } },
        { status: 403 }
      );
    }

    const beforeParam = request.nextUrl.searchParams.get("before");
    const before = beforeParam ? new Date(beforeParam) : new Date();
    if (Number.isNaN(before.getTime())) {
      return Response.json(
        { data: null, error: { code: "BAD_REQUEST", message: "Invalid 'before' date" } },
        { status: 400 }
      );
    }
    const since = new Date(before.getTime() - WINDOW_DAYS * DAY_MS);
    const deliveredAt = db.raw("coalesce(j.delivered_at, j.updated_at)");

    const delivered = await db("jobs as j")
      .leftJoin("offices as o", "o.id", "j.office_id")
      .where({ "j.lab_id": user.labId, "j.driver_id": user.driverId, "j.status": "delivered" })
      .andWhere(deliveredAt, ">=", since)
      .andWhere(deliveredAt, "<", before)
      .select(
        "j.id as job_id", "j.case_id", "j.priority", "j.items", "j.delivery_address",
        "o.name as office_name",
        db.raw("coalesce(j.delivered_at, j.updated_at) as at"),
        db.raw("(j.proof_of_delivery is not null) as has_proof")
      );

    const rejected = await db("job_status_events as e")
      .join("jobs as j", "j.id", "e.job_id")
      .leftJoin("offices as o", "o.id", "j.office_id")
      .where({ "e.lab_id": user.labId, "e.changed_by_user_id": user.id, ...REJECTION })
      .andWhere("e.created_at", ">=", since)
      .andWhere("e.created_at", "<", before)
      .select(
        "e.id as event_id", "j.id as job_id", "j.case_id", "j.priority", "j.items", "j.delivery_address",
        "o.name as office_name", "e.created_at as at"
      );

    const [olderDelivered, olderRejected] = await Promise.all([
      db("jobs as j")
        .where({ "j.lab_id": user.labId, "j.driver_id": user.driverId, "j.status": "delivered" })
        .andWhere(deliveredAt, "<", since)
        .max({ at: deliveredAt })
        .first(),
      db("job_status_events as e")
        .where({ "e.lab_id": user.labId, "e.changed_by_user_id": user.id, ...REJECTION })
        .andWhere("e.created_at", "<", since)
        .max({ at: "e.created_at" })
        .first(),
    ]);

    const parseItems = (items: unknown) => (typeof items === "string" ? JSON.parse(items) : items ?? []);
    const entries = [
      ...delivered.map((r: HistoryRow) => ({ kind: "delivered", key: `d-${r.jobId}`, ...r, items: parseItems(r.items) })),
      ...rejected.map((r: HistoryRow) => ({ kind: "rejected", key: `r-${r.eventId}`, ...r, items: parseItems(r.items), hasProof: false })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    const olderTimes = [olderDelivered?.at, olderRejected?.at].filter(Boolean).map((t) => new Date(t).getTime());
    const nextBefore = olderTimes.length ? new Date(Math.max(...olderTimes) + 1).toISOString() : null;

    return Response.json({
      data: { entries, nextBefore },
      error: null,
    });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/driver/history]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to load history" } },
      { status: 500 }
    );
  }
}
