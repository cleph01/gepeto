import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { driversOnly, unreadForDriver } from "@/lib/direct-messages";

const RECENT_LIMIT = 10;

// GET /api/driver/dispatch/unread
// How many of dispatch's private messages this driver hasn't seen, plus the
// newest of them (the app decides what to show a banner for).
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "driver" || !user.driverId) return driversOnly();
    const recent = await unreadForDriver(user.id, user.driverId)
      .orderBy("m.created_at", "desc")
      .limit(RECENT_LIMIT)
      .select("m.id", "m.body", "m.created_at");
    const [{ count }] = await unreadForDriver(user.id, user.driverId).count("* as count");
    return Response.json({ data: { count: Number(count), recent }, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/driver/dispatch/unread]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to fetch unread messages" } }, { status: 500 });
  }
}
