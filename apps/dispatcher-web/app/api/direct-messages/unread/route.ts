import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { forbidden, unreadOfficeMessages } from "@/lib/direct-messages";

const RECENT_LIMIT = 20;

// GET /api/direct-messages/unread
// Dispatcher only. Per-office unread counts on private threads, plus the newest
// unread messages (the client decides what to toast).
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "dispatcher") return forbidden();

    const [counts, recent] = await Promise.all([
      unreadOfficeMessages(user.id, user.labId).groupBy("m.office_id").select("m.office_id").count("* as count"),
      unreadOfficeMessages(user.id, user.labId)
        .join("offices as o", "m.office_id", "o.id")
        .orderBy("m.created_at", "desc")
        .limit(RECENT_LIMIT)
        .select("m.id", "m.office_id", "m.body", "m.created_at", "o.name as office_name"),
    ]);

    const byOffice: Record<string, number> = {};
    for (const row of counts as { officeId: string; count: string | number }[]) byOffice[row.officeId] = Number(row.count);

    return Response.json({ data: { byOffice, recent }, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/direct-messages/unread]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to fetch unread messages" } }, { status: 500 });
  }
}
