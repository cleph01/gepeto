import type { NextRequest } from "next/server";
import { notifyLab, notifyOfficePage } from "@/lib/realtime";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

const MAX_CASES = 99;
const MAX_NOTE = 500;
const MAX_OPEN_REQUESTS = 10; // the link is public; stop runaway submissions
const MAX_READY_AHEAD_DAYS = 7;

// POST /api/track/[token]/pickups
// The office asks the lab to collect cases (remakes, adjustments, new work).
// Creates a return in "requested" with no driver; dispatch assigns one.
// Body: { caseCount, caseNumbers?: string[], note?, readyAt?: ISO }  (no readyAt = ready now)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const office = await db("offices").where("tracking_token", token).select("id", "lab_id").first();
    if (!office) {
      return Response.json({ data: null, error: { code: "NOT_FOUND", message: "Tracking link not found" } }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const caseCount = Number(body.caseCount);
    if (!Number.isInteger(caseCount) || caseCount < 1 || caseCount > MAX_CASES) {
      return Response.json({ data: null, error: { code: "BAD_REQUEST", message: `Number of cases must be between 1 and ${MAX_CASES}.` } }, { status: 400 });
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

    const open = await db("returns").where({ office_id: office.id, status: "requested" }).count("* as n").first();
    if (Number(open?.n ?? 0) >= MAX_OPEN_REQUESTS) {
      return Response.json({ data: null, error: { code: "TOO_MANY", message: "You already have several pickups waiting. Call the lab if you need more." } }, { status: 429 });
    }

    const caseNumbers = cleanCaseNumbers(body.caseNumbers);
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, MAX_NOTE) : null;

    const id = await db.transaction(async (trx: typeof db) => {
      const [row] = await trx("returns")
        .insert({
          lab_id: office.labId,
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
        lab_id: office.labId,
        event: "requested",
        detail: JSON.stringify({ caseCount, caseNumbers, readyAt: readyAt ? readyAt.toISOString() : null }),
        actor_role: "office",
        actor_user_id: null,
      });
      return row.id as string;
    });

    await notifyLab(office.labId, "return_changed", { returnId: id, change: "requested" });
    await notifyOfficePage(token, "pickups");
    return Response.json({ data: { id }, error: null }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/track/[token]/pickups]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Couldn't send the pickup request" } }, { status: 500 });
  }
}

/** Trimmed, uppercased, no blanks or repeats, at most 50 (same rule as driver-logged returns). */
function cleanCaseNumbers(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  for (const v of input) {
    if (typeof v !== "string") continue;
    const s = v.trim().toUpperCase().slice(0, 64);
    if (s) seen.add(s);
  }
  return [...seen].slice(0, 50);
}
