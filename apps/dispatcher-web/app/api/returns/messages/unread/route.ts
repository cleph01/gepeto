import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { OPEN_FOR_DRIVER } from "@/lib/return-messages";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

const RECENT_LIMIT = 20;
// The Returning Cases page lists checked-in returns this far back. Anything
// older can't be opened, so it mustn't hold a badge up forever.
const CHECKED_IN_DAYS = 30;

// GET /api/returns/messages/unread
// Per-return unread counts plus the newest unread messages, for the current
// person: dispatchers hear from offices and drivers, drivers from the lab and
// offices, on returns they have now.
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const isDriver = user.role === "driver";

    const unread = () => {
      const q = db("return_messages as m")
        .join("returns as r", "m.return_id", "r.id")
        .joinRaw("LEFT JOIN return_message_reads rd ON rd.return_id = m.return_id AND rd.user_id = ?", [user.id])
        .where("r.lab_id", user.labId)
        .whereIn("m.sender_role", isDriver ? ["office", "dispatcher"] : ["office", "driver"])
        // ms truncation: see /api/messages/unread
        .whereRaw("(rd.last_read_at IS NULL OR date_trunc('milliseconds', m.created_at) > rd.last_read_at)");
      if (isDriver) {
        q.where("r.driver_id", user.driverId).whereIn("r.status", OPEN_FOR_DRIVER);
      } else {
        const cutoff = new Date(Date.now() - CHECKED_IN_DAYS * 24 * 60 * 60 * 1000).toISOString();
        q.where((w: typeof db) =>
          w.whereIn("r.status", OPEN_FOR_DRIVER).orWhere((c: typeof db) => c.where("r.status", "checked_in").where("r.checked_in_at", ">=", cutoff))
        );
      }
      return q;
    };

    const [counts, recent] = await Promise.all([
      unread().groupBy("m.return_id").select("m.return_id").count("* as count"),
      unread()
        .leftJoin("offices as o", "r.office_id", "o.id")
        .leftJoin("drivers as d", "r.driver_id", "d.id")
        .orderBy("m.created_at", "desc")
        .limit(RECENT_LIMIT)
        .select("m.id", "m.return_id", "m.sender_role", "m.body", "m.created_at", "r.number", "o.name as office_name", "d.name as driver_name"),
    ]);

    const byReturn: Record<string, number> = {};
    for (const row of counts as { returnId: string; count: string | number }[]) byReturn[row.returnId] = Number(row.count);

    return Response.json({ data: { byReturn, recent }, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/returns/messages/unread]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to fetch unread messages" } }, { status: 500 });
  }
}
