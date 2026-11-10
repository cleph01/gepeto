import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { THREAD_SQL, forbidden, unreadForDispatcher } from "@/lib/direct-messages";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

const RECENT_LIMIT = 20;

// GET /api/direct-messages/unread
// Dispatcher only. Unread counts per private thread ("office:<id>" or
// "driver:<id>"), plus the newest unread messages (the client decides what to toast).
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "dispatcher") return forbidden();

    const [counts, recent] = await Promise.all([
      unreadForDispatcher(user.id, user.labId).groupByRaw(THREAD_SQL).select(db.raw(`${THREAD_SQL} as thread`)).count("* as count"),
      unreadForDispatcher(user.id, user.labId)
        .leftJoin("offices as o", "m.office_id", "o.id")
        .leftJoin("drivers as d", "m.driver_id", "d.id")
        .orderBy("m.created_at", "desc")
        .limit(RECENT_LIMIT)
        .select("m.id", db.raw(`${THREAD_SQL} as thread`), "m.sender_role", "m.body", "m.created_at", db.raw("COALESCE(o.name, d.name) as party_name")),
    ]);

    const byThread: Record<string, number> = {};
    for (const row of counts as { thread: string; count: string | number }[]) byThread[row.thread] = Number(row.count);

    return Response.json({ data: { byThread, recent }, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/direct-messages/unread]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to fetch unread messages" } }, { status: 500 });
  }
}
