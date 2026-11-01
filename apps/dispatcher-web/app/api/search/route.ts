import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

const PER_GROUP = 8;
const ACTIVE = ["pending", "assigned", "picked_up", "in_transit", "arrived"];

/** LIKE pattern with the user's own % and _ treated literally. */
const like = (s: string) => `%${s.replace(/[\\%_]/g, (c) => "\\" + c)}%`;

// GET /api/search?q=  (dispatcher)
// One search across the lab: jobs (all time, active first), returns and
// pickups, offices and drivers. Case and return numbers match loosely:
// "lab2042", "LAB 2042" and "2042" all find LAB-2042. Message text is
// deliberately not searched.
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "dispatcher") {
      return Response.json({ data: null, error: { code: "FORBIDDEN", message: "Dispatchers only" } }, { status: 403 });
    }

    const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
    const empty = { jobs: [], returns: [], offices: [], drivers: [] };
    if (q.length < 2) return Response.json({ data: empty, error: null });

    const text = like(q);
    const compact = q.toLowerCase().replace(/[^a-z0-9]/g, ""); // for case numbers
    const digits = q.replace(/\D/g, "");                        // for phones and RET numbers
    const compactLike = compact ? like(compact) : null;
    const retNumber = /^\s*(ret[\s-]*)?\d+\s*$/i.test(q) ? Number(digits) : null;
    const lab = user.labId;

    const [jobs, returns, offices, drivers] = await Promise.all([
      db("jobs as j")
        .leftJoin("offices as o", "j.office_id", "o.id")
        .leftJoin("drivers as d", "j.driver_id", "d.id")
        .where("j.lab_id", lab)
        .where((w: typeof db) => {
          w.whereILike("o.name", text)
            .orWhereILike("d.name", text)
            .orWhereILike("j.delivery_address", text)
            .orWhereRaw("EXISTS (SELECT 1 FROM jsonb_array_elements(j.items) e WHERE e->>'description' ILIKE ?)", [text]);
          if (compactLike) w.orWhereRaw("regexp_replace(lower(j.case_id), '[^a-z0-9]', '', 'g') LIKE ?", [compactLike]);
        })
        .orderByRaw(`CASE WHEN j.status IN (${ACTIVE.map(() => "?").join(",")}) THEN 0 ELSE 1 END, j.updated_at DESC`, ACTIVE)
        .limit(PER_GROUP)
        .select("j.id", "j.case_id", "j.status", "j.priority", "j.updated_at", "o.name as office_name", "d.name as driver_name"),

      db("returns as r")
        .leftJoin("offices as o", "r.office_id", "o.id")
        .leftJoin("drivers as d", "r.driver_id", "d.id")
        .where("r.lab_id", lab)
        .whereNot("r.status", "cancelled")
        .where((w: typeof db) => {
          w.whereILike("o.name", text).orWhereILike("d.name", text);
          if (retNumber !== null) w.orWhere("r.number", retNumber);
          if (compactLike) {
            w.orWhereRaw("regexp_replace(lower(coalesce(r.case_id, '')), '[^a-z0-9]', '', 'g') LIKE ?", [compactLike])
              .orWhereRaw("regexp_replace(lower(r.case_numbers::text), '[^a-z0-9]', '', 'g') LIKE ?", [compactLike]);
          }
        })
        .orderByRaw("CASE WHEN r.status = 'checked_in' THEN 1 ELSE 0 END, COALESCE(r.picked_up_at, r.requested_at, r.created_at) DESC")
        .limit(PER_GROUP)
        .select("r.id", "r.number", "r.status", "r.case_count", "r.case_numbers", "r.case_id", "o.name as office_name", "d.name as driver_name"),

      db("offices as o")
        .where("o.lab_id", lab)
        .where((w: typeof db) => {
          w.whereILike("o.name", text).orWhereILike("o.contact_name", text).orWhereILike("o.address", text);
          if (digits.length >= 3) w.orWhereRaw("regexp_replace(o.phone, '\\D', '', 'g') LIKE ?", [like(digits)]);
        })
        .orderBy("o.name")
        .limit(PER_GROUP)
        .select(
          "o.id", "o.name", "o.address", "o.contact_name",
          db.raw(`(SELECT count(*)::int FROM jobs j WHERE j.office_id = o.id AND j.status IN (${ACTIVE.map(() => "?").join(",")})) as active_jobs`, ACTIVE)
        ),

      db("drivers as d")
        .where("d.lab_id", lab)
        .where((w: typeof db) => {
          w.whereILike("d.name", text).orWhereILike("d.email", text);
          if (digits.length >= 3) w.orWhereRaw("regexp_replace(d.phone, '\\D', '', 'g') LIKE ?", [like(digits)]);
        })
        .orderBy("d.name")
        .limit(PER_GROUP)
        .select("d.id", "d.name", "d.status", "d.phone"),
    ]);

    return Response.json({ data: { jobs, returns, offices, drivers }, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/search]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Search failed" } }, { status: 500 });
  }
}
