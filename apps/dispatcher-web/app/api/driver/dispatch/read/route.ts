import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { driverThread, driversOnly, markThreadRead } from "@/lib/direct-messages";

// POST /api/driver/dispatch/read  { upTo }: the createdAt of the newest message shown.
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "driver" || !user.driverId) return driversOnly();
    const { upTo } = await request.json().catch(() => ({}));
    return await markThreadRead(user.id, driverThread(user.driverId), upTo);
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/driver/dispatch/read]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to mark messages read" } }, { status: 500 });
  }
}
