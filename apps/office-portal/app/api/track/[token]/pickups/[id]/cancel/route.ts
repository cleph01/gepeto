import type { NextRequest } from "next/server";
import { rateLimited, requireUnlocked } from "@/lib/access";
import { notifyLab, notifyOfficePage } from "@/lib/realtime";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// POST /api/track/[token]/pickups/[id]/cancel
// The office withdraws its own pickup request, but only until dispatch has
// assigned a driver. After that it has to call the lab, so a driver isn't
// left driving to a pickup that quietly disappeared.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  try {
    const { token, id } = await params;
    const office = await requireUnlocked(token);
    if (office instanceof Response) return office;
    const limited = await rateLimited(request, token, "pickup-cancel", 20, 60 * 60);
    if (limited) return limited;

    const cancelled = await db.transaction(async (trx: typeof db) => {
      const n = await trx("returns")
        .where({ id, office_id: office.id, status: "requested" })
        .whereNull("driver_id")
        .update({ status: "cancelled", cancelled_at: trx.fn.now(), updated_at: trx.fn.now() });
      if (n > 0) {
        await trx("return_events").insert({
          return_id: id, lab_id: office.labId, event: "cancelled", actor_role: "office", actor_user_id: null,
        });
      }
      return n > 0;
    });
    if (!cancelled) {
      return Response.json({ data: null, error: { code: "CONFLICT", message: "A driver is already on it. Call the lab to cancel." } }, { status: 409 });
    }

    await notifyLab(office.labId, "return_changed", { returnId: id, change: "cancelled" });
    await notifyOfficePage(token, "pickups");
    return Response.json({ data: { ok: true }, error: null });
  } catch (err) {
    console.error("[POST /api/track/[token]/pickups/[id]/cancel]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Couldn't cancel the pickup" } }, { status: 500 });
  }
}
